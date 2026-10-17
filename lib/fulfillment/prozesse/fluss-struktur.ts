// ─── Fulfillment · Prozesse — die Struktur des Flusses einer Phase und ihre Zweige (Prozess-Editor, 17.10.) ─────────────────────────────
// Rückmeldung 17.10.: „Jeder baut seine Abläufe selbst in der App: Schritte, Nachrichten, Entscheidungen und Erinnerungen per Ziehen anlegen.“ EINE Stelle für:
//   · Welche Knoten einer Phase die Schritte ihres Flusses sind, in welcher Reihenfolge — dieselbe Regel wie die Ansicht (`phaseGruppen`, ./reise.ts):
//     Ebene 3 ohne Kinder ist selbst ein Schritt; ein Sammel-Teilprozess (`istSammelTeil`: heißt wie seine Phase bzw. „Weitere Bausteine“) zeigt seine
//     Schritte direkt im Strang; ein benannter Teilprozess steht als Gruppe. Bausteine (Ebene 5) hängen an ihrem Schritt, sie sind keine Schritte.
//   · Die Zweige ja/nein (`ProzessKnoten.zweige`): nur an Entscheidungen (ja, nein) und Erinnerungen (ja = „danach zurück zu …“), nur auf Schritte DERSELBEN
//     Phase, ein Schritt ist höchstens einmal Nein-Zweig. Kreise nur über eine Erinnerung zurück zur Entscheidung (die typische Schleife) — sonst 409.
// Rein und client-sicher; Server (Schreibwege) und Browser (Editor) rechnen nur hiermit. Tests: tests/fulfillment-editor-modell.test.ts.

import type { KnotenForm, ProzessKnoten, Zweige } from '../typen';
import { kinderVon, wurzelVon } from '../regeln';
import { istSammelTeil } from './reise';
import { nein } from './pruefen';

type K = Pick<ProzessKnoten, 'id' | 'elternId' | 'titel' | 'rang'> & { bausteinId?: string; form?: KnotenForm; zweige?: Zweige };

/** Ein Abschnitt im Fluss einer Phase: ein Strang (Schritte untereinander) oder eine Gruppe (benannter Teilprozess mit seinen Schritten). */
export interface FlussAbschnitt<T> { art: 'strang' | 'gruppe'; gruppe?: T; schritte: T[] }

/** Die Phasen (Ebene 2) einer Vorlage bzw. eines Falls in Rang-Reihenfolge. */
export function phasenDer<T extends K>(kn: readonly T[]): T[] {
  const w = wurzelVon(kn);
  return w ? kinderVon(w.id, kn) : [];
}

/** Die Abschnitte des Flusses einer Phase (Lese-Reihenfolge) — aufeinanderfolgende Schritte ohne Gruppe bilden EINEN Strang. */
export function phasenAbschnitte<T extends K>(kn: readonly T[], phaseId: string): FlussAbschnitt<T>[] {
  const p = kn.find(x => x.id === phaseId);
  if (!p) return [];
  const raus: FlussAbschnitt<T>[] = [];
  const strang = (s: readonly T[]) => {
    const l = raus.at(-1);
    if (l?.art === 'strang') l.schritte.push(...s);
    else raus.push({ art: 'strang', schritte: [...s] });
  };
  for (const t of kinderVon(phaseId, kn)) {
    const kinder = kinderVon(t.id, kn).filter(c => !c.bausteinId);
    if (!kinderVon(t.id, kn).length) { strang([t]); continue; }
    if (istSammelTeil(t, p)) { strang(kinder); continue; }
    raus.push({ art: 'gruppe', gruppe: t, schritte: kinder });
  }
  return raus;
}

/** Alle Schritte einer Phase in Lese-Reihenfolge (Bausteine nicht). */
export const phasenSchritte = <T extends K>(kn: readonly T[], phaseId: string): T[] => phasenAbschnitte(kn, phaseId).flatMap(a => a.schritte);

/** Die Phase (Ebene 2), in der ein Knoten liegt — die Phase selbst für eine Phase; null für die Wurzel oder Unbekanntes. */
export function phaseVonKnoten(kn: readonly K[], id: string): string | null {
  const w = wurzelVon(kn);
  if (!w) return null;
  const nach = new Map(kn.map(x => [x.id, x]));
  let x = nach.get(id);
  const gesehen = new Set<string>();
  while (x && x.elternId && !gesehen.has(x.id)) {
    gesehen.add(x.id);
    if (x.elternId === w.id) return x.id;
    x = nach.get(x.elternId);
  }
  return null;
}

/** Je Schritt die Entscheidung, deren Nein-Zweig er ist (er steht im Bild neben ihr, nicht im Strang). */
export function neinZiele(kn: readonly K[]): Map<string, string> {
  const raus = new Map<string, string>();
  for (const k of kn) if (k.form === 'entscheidung' && k.zweige?.nein && !raus.has(k.zweige.nein)) raus.set(k.zweige.nein, k.id);
  return raus;
}

/**
 * Die Kanten des Flusses einer Phase (für die Kreis-Prüfung): ein Schritt im Strang geht zum nächsten (oder zu seinem Ja-Zweig), eine Entscheidung zusätzlich
 * zu ihrem Nein-Zweig; ein Nein-Zweig geht „danach“ zu seinem Ja-Zweig (zurück) — sonst nach der Entscheidung weiter.
 */
function flussKanten(kn: readonly K[], phaseId: string, nz: ReadonlyMap<string, string>): Map<string, string[]> {
  const schritte = phasenSchritte(kn, phaseId);
  const haupt = schritte.filter(s => !nz.has(s.id));
  const kanten = new Map<string, string[]>();
  const dazu = (a: string, b: string | undefined) => { if (b) kanten.set(a, [...(kanten.get(a) ?? []), b]); };
  haupt.forEach((s, i) => { dazu(s.id, s.zweige?.ja ?? haupt[i + 1]?.id); dazu(s.id, s.zweige?.nein); });
  for (const s of schritte) {
    const e = nz.get(s.id);
    if (!e) continue;
    const i = haupt.findIndex(x => x.id === e);
    dazu(s.id, s.zweige?.ja ?? (i >= 0 ? haupt[i + 1]?.id : undefined));
    dazu(s.id, s.zweige?.nein);
  }
  return kanten;
}

/**
 * Die Zweige einer Vorlage prüfen (gegen den Endstand, wirft `Abgelehnt`): nur an Entscheidungen (ja/nein) und Erinnerungen (ja), Ziele sind Schritte
 * derselben Phase (sonst 409), nie der Knoten selbst, ein Schritt ist höchstens einmal Nein-Zweig (409). Kreise nur über eine Erinnerung zurück zur
 * Entscheidung — jeder andere Kreis 409.
 */
export function zweigePruefen(kn: readonly K[]): void {
  if (!kn.some(k => k.zweige)) return;
  const nach = new Map(kn.map(x => [x.id, x]));
  const schrittPhase = new Map<string, string>();
  const phasen = phasenDer(kn);
  for (const p of phasen) for (const s of phasenSchritte(kn, p.id)) schrittPhase.set(s.id, p.id);
  const gesehen = new Map<string, string>();
  for (const k of kn) {
    const z = k.zweige;
    if (!z) continue;
    const ph = schrittPhase.get(k.id);
    if (!ph) nein(`„${k.titel}“ ist kein Schritt eines Ablaufs — Zweige gibt es nur dort.`);
    if (z.nein && k.form !== 'entscheidung') nein(`„${k.titel}“: einen Nein-Zweig hat nur eine Entscheidung.`);
    if (z.ja && k.form !== 'entscheidung' && k.form !== 'erinnerung') nein(`„${k.titel}“: Zweige gibt es nur an Entscheidungen und Erinnerungen.`);
    for (const [art, ziel] of [['Ja', z.ja], ['Nein', z.nein]] as const) {
      if (!ziel) continue;
      if (ziel === k.id) nein(`Der ${art}-Zweig von „${k.titel}“ zeigt auf sich selbst.`);
      if (!schrittPhase.has(ziel)) nein(`Der ${art}-Zweig von „${k.titel}“ zeigt auf keinen Schritt.`);
      if (schrittPhase.get(ziel) !== ph) nein(`Der ${art}-Zweig von „${k.titel}“ zeigt in eine andere Phase — Zweige bleiben in ihrer Phase. Erst den Zweig lösen.`, 409);
    }
    if (z.nein) {
      if (gesehen.has(z.nein)) nein(`„${nach.get(z.nein)?.titel ?? ''}“ ist schon der Nein-Zweig einer anderen Entscheidung.`, 409);
      gesehen.set(z.nein, k.id);
    }
  }
  const nz = neinZiele(kn);
  for (const p of phasen) {
    const kanten = flussKanten(kn, p.id, nz);
    // Erlaubt ist nur die Rückkante Erinnerung → Entscheidung — ohne sie muss der Fluss kreisfrei sein.
    const erlaubt = (a: string, b: string) => nach.get(a)?.form === 'erinnerung' && nach.get(b)?.form === 'entscheidung';
    const zustand = new Map<string, 1 | 2>();
    const geh = (x: string): string | null => {
      zustand.set(x, 1);
      for (const y of kanten.get(x) ?? []) {
        if (erlaubt(x, y)) continue;
        const z = zustand.get(y);
        if (z === 1) return y;
        if (!z) { const r = geh(y); if (r) return r; }
      }
      zustand.set(x, 2);
      return null;
    };
    for (const x of kanten.keys()) {
      if (zustand.has(x)) continue;
      const kreis = geh(x);
      if (kreis) nein(`Kreis im Ablauf bei „${nach.get(kreis)?.titel ?? ''}“ — eine Schleife geht nur über eine Erinnerung zurück zur Entscheidung. Nichts gespeichert.`, 409);
    }
  }
}

/** Zweige, die auf gelöschte Knoten zeigen, entfernen — mit den gelösten Verweisen (für „Zurückholen“). */
export function zweigeOhne<T extends K>(kn: readonly T[], weg: ReadonlySet<string>): { knoten: T[]; verweise: { knotenId: string; zweig: 'ja' | 'nein' }[] } {
  const verweise: { knotenId: string; zweig: 'ja' | 'nein' }[] = [];
  const knoten = kn.map(k => {
    if (!k.zweige || weg.has(k.id)) return k;
    const z = { ...k.zweige };
    for (const art of ['ja', 'nein'] as const) if (z[art] && weg.has(z[art]!)) { verweise.push({ knotenId: k.id, zweig: art }); delete z[art]; }
    if (z.ja === k.zweige.ja && z.nein === k.zweige.nein) return k;
    const neu = { ...k };
    if (z.ja || z.nein) neu.zweige = z; else delete neu.zweige;
    return neu;
  });
  return { knoten, verweise };
}
