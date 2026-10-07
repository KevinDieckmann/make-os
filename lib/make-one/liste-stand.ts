// ─── MAKE OS — Geteilte Listen: Einzeländerungen mit Stand (28.09.) ─────────
// Prüfbericht 28.09.: Ziele schrieben den GANZEN Horizont zurück (PUT), die
// Wochenblöcke die Blöcke BEIDER Personen — wer zuletzt speicherte, löschte
// still, was der andere inzwischen angelegt hatte. Regel seitdem: geteilte
// Listen nur per Einzeländerung mit Stand.
//
// Der Schreiber merkt sich die ABSICHT (was die Person geändert hat: anlegen,
// ändern, Rang, erledigt, löschen — je Kennung), nicht einen Vollstand. Beim
// Senden trägt jede Änderung den Stand (Fingerabdruck), den der Server zuletzt
// für diese Zeile geliefert hat. Passt er nicht mehr, antwortet der Server 409
// mit dem aktuellen Bestand — nichts wird überschrieben. Nach jeder Antwort ist
// die Sicht = Serverstand + noch nicht gesendete eigene Änderungen, so kommen
// die Änderungen des anderen herein, ohne die eigenen zu verlieren.
// Senden läuft nacheinander (eine Kette), nie zwei Aufrufe gleichzeitig.
// Rein bis auf fetch; getestet in tests/liste-stand.test.ts.

export interface MitStand { id: string; stand?: string }
export type StandOp<E> = { op: 'upsert'; eintrag: E; stand?: string } | { op: 'delete'; id: string; stand?: string };

/** Stabile Textform (Schlüssel sortiert, undefined fällt weg) — Vergleich unabhängig von der Feldreihenfolge. */
function stabil(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stabil).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter(k => o[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${stabil(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

export function ohneStand<E extends MitStand>(e: E): E {
  const { stand: _s, ...rest } = e;
  return rest as E;
}

/** Was sich zwischen zwei Fassungen einer Liste geändert hat — je Kennung eine Änderung (ohne Stand). */
export function absichten<E extends MitStand>(vorher: readonly E[], nachher: readonly E[]): StandOp<E>[] {
  const alt = new Map(vorher.map(e => [e.id, e]));
  const ops: StandOp<E>[] = [];
  for (const e of nachher) {
    const a = alt.get(e.id);
    if (!a || stabil(ohneStand(a)) !== stabil(ohneStand(e))) ops.push({ op: 'upsert', eintrag: ohneStand(e) });
  }
  const ids = new Set(nachher.map(e => e.id));
  for (const a of vorher) if (!ids.has(a.id)) ops.push({ op: 'delete', id: a.id });
  return ops;
}

/** Änderungen auf eine Liste legen (für die Sicht: Serverstand + eigene, noch offene Änderungen). */
export function auflegen<E extends MitStand>(liste: readonly E[], ops: readonly StandOp<E>[]): E[] {
  const aus = [...liste];
  for (const o of ops) {
    const id = o.op === 'delete' ? o.id : o.eintrag.id;
    const i = aus.findIndex(e => e.id === id);
    if (o.op === 'delete') { if (i >= 0) aus.splice(i, 1); }
    else if (i >= 0) aus[i] = { ...o.eintrag, ...(aus[i].stand ? { stand: aus[i].stand } : {}) };
    else aus.push(o.eintrag);
  }
  return aus;
}

export interface SchreibErgebnis<E> {
  ok: boolean;
  /** HTTP-Status (0 = keine Verbindung). 409 = inzwischen geändert — die Sicht zeigt jetzt den aktuellen Stand. */
  status: number;
  /** Serverstand + noch offene eigene Änderungen — das zeigt die Ansicht. */
  sicht: E[] | null;
  fehler?: string;
  /** Es gab nichts zu senden. */
  nichts?: boolean;
  /** Die ganze Antwort des Servers (07.10.: z. B. `bezuegeGeloest` beim Löschen eines Ziels — Grundlage für „Rückgängig“). */
  antwort?: Record<string, unknown>;
}

export interface SchreiberOptionen<E> {
  pfad: string;
  /** Aus der Antwort die Liste (mit `stand` je Zeile) lesen — auch aus einer 409-Antwort. */
  liste: (antwort: Record<string, unknown>) => E[] | null;
  /** Körper des PATCH aus den Änderungen, Standard `{ ops }`. */
  koerper?: (ops: StandOp<E>[]) => Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export class ListenSchreiber<E extends MitStand> {
  private basis: E[] | null = null;
  /** Offene Absichten je Kennung — die jüngste gilt. */
  private offen = new Map<string, StandOp<E>>();
  private kette: Promise<unknown> = Promise.resolve();

  constructor(private readonly o: SchreiberOptionen<E>) {}

  /** Serverstand bekannt machen (nach dem Laden). */
  kenne(liste: readonly E[] | null): void { this.basis = liste ? liste.map(e => ({ ...e })) : null; }
  /** Ist der Serverstand bekannt? Ohne ihn wird nichts gesendet. */
  get geladen(): boolean { return this.basis !== null; }
  get hatOffenes(): boolean { return this.offen.size > 0; }

  /** Eine Änderung der Person vormerken: aus der Sicht vorher → nachher. */
  aendern(vorher: readonly E[], nachher: readonly E[]): void {
    for (const op of absichten(vorher, nachher)) this.offen.set(op.op === 'delete' ? op.id : op.eintrag.id, op);
  }

  /** Serverstand + offene Änderungen. */
  sicht(): E[] | null { return this.basis ? auflegen(this.basis, [...this.offen.values()]) : null; }

  /** Offenes senden — nacheinander, jede Änderung mit dem zuletzt bekannten Stand ihrer Zeile. */
  senden(): Promise<SchreibErgebnis<E>> {
    const lauf = this.kette.then(() => this.einmal());
    this.kette = lauf.catch(() => {});
    return lauf;
  }

  private async einmal(): Promise<SchreibErgebnis<E>> {
    if (!this.basis) return { ok: false, status: 0, sicht: null, fehler: 'Stand nicht geladen — nichts gespeichert.' };
    if (!this.offen.size) return { ok: true, status: 200, sicht: this.sicht(), nichts: true };
    const staende = new Map(this.basis.map(e => [e.id, e.stand]));
    const paket = [...this.offen.entries()];
    this.offen.clear();
    const ops: StandOp<E>[] = paket.map(([id, op]) => {
      const stand = staende.get(id);
      return stand ? { ...op, stand } : op;
    });
    const zurueck = () => { for (const [id, op] of paket) if (!this.offen.has(id)) this.offen.set(id, op); };
    let r: Response;
    try {
      r = await (this.o.fetchImpl ?? fetch)(this.o.pfad, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.o.koerper ? this.o.koerper(ops) : { ops }),
      });
    } catch {
      zurueck();
      return { ok: false, status: 0, sicht: this.sicht(), fehler: 'Keine Verbindung — noch nicht gespeichert.' };
    }
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const liste = this.o.liste(d);
    if (liste) this.basis = liste.map(e => ({ ...e }));
    const ok = r.ok && d.ok !== false;
    // Serverfehler (5xx): die Änderungen bleiben offen für den nächsten Versuch. 409/4xx: verworfen — die Sicht zeigt den aktuellen Stand.
    if (!ok && r.status >= 500) zurueck();
    const fehler = typeof d.error === 'string' ? d.error : typeof d.fehler === 'string' ? d.fehler : undefined;
    return { ok, status: r.status, sicht: this.sicht(), antwort: d, ...(fehler ? { fehler } : {}) };
  }
}
