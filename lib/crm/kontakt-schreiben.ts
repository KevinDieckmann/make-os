// ─── Kontakt-Schreibvorgänge im Browser: nacheinander, mit dem zuletzt bekannten Serverstand (28.09., K2) ─
// Ablaufprüfung 28.09.: `kontaktTeil`/`kontaktSetzen` liefen parallel und nahmen den Stand aus der lokalen
// (optimistischen) Anzeige. Zwei schnelle Klicks (z. B. zwei Häkchen in `WahlMehrfach`) schickten beide den
// Stand VOR dem ersten Klick — der zweite PATCH bekam 409, obwohl er nur die eigene Änderung „überholte“.
//
// Jetzt:
//  · Eine Kette (`nacheinanderKette`): jeder Schreibvorgang startet erst, wenn der vorige fertig ist.
//  · Der Stand kommt erst BEIM ABSENDEN aus `KontaktStaende` — gefüllt nur aus Server-Antworten (Laden, `zeilen`
//    einer Kontakt-Änderung, der Kontakt einer Aktivität, `konflikte[].aktuell` eines 409). Nie aus der Anzeige.
//  · 409: der aktuelle Stand aus `konflikte[].aktuell` wird übernommen (Anzeige + Stand), danach lädt die Seite neu.
//
// Rein (ohne React), getestet in tests/crm-kontakt-schreiben.test.ts.

/** Ein Kontakt, wie ihn der Server schickt: Kennung + Fingerabdruck `stand`. */
export interface MitStand { id: string; stand?: string }

export interface KontaktAntwort {
  ok?: boolean;
  error?: string;
  /** 409: je Konflikt der aktuelle Eintrag (mit `stand`). */
  konflikte?: { id?: string; grund?: string; aktuell?: MitStand & Record<string, unknown> }[];
  /** 200: der neue Stand je geschriebener Kennung. */
  zeilen?: { id: string; stand: string }[];
  /** 200: Hinweis (z. B. Neuanlage stand auf der Sperrliste — mit Werbesperre angelegt). */
  hinweis?: string;
  /** 409 (29.09., A2): dieser Tab läuft mit altem Code — nichts gespeichert, bitte neu laden (lib/bau/kennung.ts). */
  neuLaden?: boolean;
}

/** Ein Op an PATCH /api/state/kontakte — `stand` setzt `kontaktSchreiben` beim Absenden. */
export type KontaktOp =
  | { op: 'teil'; id: string; felder: Record<string, unknown> }
  | { op: 'upsert'; eintrag: MitStand & Record<string, unknown> };

/** Schreibvorgänge nacheinander: `f` startet erst, wenn der vorige fertig ist (auch nach einem Fehler). */
export function nacheinanderKette(): <T>(f: () => Promise<T>) => Promise<T> {
  let kette: Promise<unknown> = Promise.resolve();
  return <T>(f: () => Promise<T>): Promise<T> => {
    const p = kette.then(f, f);
    kette = p.catch(() => undefined);
    return p;
  };
}

/** Zuletzt vom Server gemeldeter Stand je Kontakt. */
export class KontaktStaende {
  private m = new Map<string, string>();
  get(id: string): string | undefined { return this.m.get(id); }
  setzen(id: string, stand: string | undefined): void { if (stand) this.m.set(id, stand); else this.m.delete(id); }
  /** Ganze Liste (erstes Laden): der Stand genau dieser Liste. */
  alle(kontakte: MitStand[]): void { this.m = new Map(kontakte.filter(k => k.stand).map(k => [k.id, k.stand!])); }
  /** Delta bzw. einzelne Kontakte aus einer Antwort. */
  uebernehmen(kontakte: MitStand[], geloescht: string[] = []): void {
    for (const k of kontakte) this.setzen(k.id, k.stand);
    for (const id of geloescht) this.m.delete(id);
  }
  /** Antwort einer Kontakt-Änderung: neue Stände (200) bzw. der aktuelle Eintrag je Konflikt (409). */
  ausAntwort(r: KontaktAntwort): void {
    for (const z of r.zeilen ?? []) this.setzen(z.id, z.stand);
    for (const k of r.konflikte ?? []) if (k.aktuell?.id) this.setzen(k.aktuell.id, k.aktuell.stand);
  }
}

/** Die Kennung eines Ops. */
export const kontaktOpId = (o: KontaktOp) => (o.op === 'teil' ? o.id : o.eintrag.id);

/** Den Op zum Absenden bauen: Stand aus `staende` (nie aus dem Eintrag), das Feld `stand` nie im Eintrag. */
export function kontaktOpMitStand(o: KontaktOp, staende: KontaktStaende): Record<string, unknown> {
  const stand = staende.get(kontaktOpId(o));
  if (o.op === 'teil') return { op: 'teil', id: o.id, felder: o.felder, ...(stand ? { stand } : {}) };
  const { stand: _s, ...eintrag } = o.eintrag;
  return { op: 'upsert', eintrag, ...(stand ? { stand } : {}) };
}

/**
 * Einen Op senden — den Stand erst JETZT lesen (nach dem vorigen Schreibvorgang der Kette) und die Antwort
 * sofort in `staende` übernehmen, damit der nächste Op der Kette den neuen Stand trägt.
 */
export async function kontaktSchreiben(senden: (op: Record<string, unknown>) => Promise<KontaktAntwort>, o: KontaktOp, staende: KontaktStaende): Promise<KontaktAntwort> {
  const r = await senden(kontaktOpMitStand(o, staende));
  staende.ausAntwort(r);
  return r;
}

/** Klartext bei 409 (K1): nicht gespeichert, was geschah, was zu tun ist. */
export const KONTAKT_KONFLIKT = 'Nicht gespeichert — dieser Kontakt wurde inzwischen geändert. Die Anzeige zeigt jetzt den aktuellen Stand. Bitte erneut eingeben.';
