// ─── Fulfillment · Analyse — was die Dossier-Route ausliefert (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.6/4.7, Abschnitt 9) — rein ────────────────
// EINE Filterstelle für die Antwort von GET/POST `/api/fulfillment/dossier`:
//   · KEIN Personenteil: der Entwurf eines Personen-Laufs (A4) erscheint nur als Zähler (Karten liegen getrennt, Route `personen`); die Entwürfe
//     von A11–A13 (lesen den Personenteil) ohne Recht auf den Personenteil ebenso (Prüf-Fund 11.10.)
//   · der Leseteil-Verweis (Tiefenbericht) nur als „es gibt einen, gestartet am …, eigener ja/nein“ — die Kennung nur für die auslösende Person
//   · verwaiste Läufe als „abgebrochen“ angezeigt (geschrieben wird das erst beim nächsten Start bzw. im Morgenlauf)
// Rein und client-sicher (die Oberfläche nutzt dieselben Typen).

import type { AbschnittId, AnalyseLauf, Dossier, LaufStatus } from '../typen';
import { laufStatusAnzeige } from './agenten';

/** Namen der Abschnitte (Oberfläche). */
export const ABSCHNITT_LABEL: Readonly<Record<AbschnittId, string>> = {
  fazit: 'Management-Fazit', unternehmen: 'Unternehmen', gesellschafter: 'Gesellschafter & Beteiligungen', markt: 'Markt & Wettbewerb',
  aussen: 'Außendarstellung & Sichtbarkeit', vertrieb: 'Vertriebsaufstellung & Signale', reputation: 'Reputation & News', finanzen: 'Finanzsignale',
  chancen_risiken: 'Chancen & Risiken', good_bad: 'Good News / Bad News', hypothesen: 'Hypothesen für die Diagnose', fragen: 'Offene Fragen fürs Kick-off', recht: 'Anhang Recht',
};
/** Reihenfolge im Dossier (FT §9.4). */
export const ABSCHNITT_REIHE: readonly AbschnittId[] = ['fazit', 'unternehmen', 'gesellschafter', 'markt', 'aussen', 'vertrieb', 'reputation', 'finanzen', 'chancen_risiken', 'good_bad', 'hypothesen', 'fragen'];
/** Namen der Lauf-Zustände. */
export const LAUF_LABEL: Readonly<Record<LaufStatus, string>> = {
  bereit: 'bereit', laeuft: 'läuft', fertig: 'Entwurf fertig', fehler: 'Fehler', abgebrochen: 'abgebrochen', uebernommen: 'übernommen', verworfen: 'verworfen',
};

export interface DossierAntwort extends Omit<Dossier, 'leseteil' | 'laeufe'> {
  laeufe: AnalyseLauf[];
  leseteil?: { gestartetAm: string; eigen: boolean; id?: string };
}

/** Agenten, die den Personenteil LESEN (A11–A13) — ihre Entwürfe sieht ein Konto ohne Recht auf den Personenteil nur als Zähler. */
const LIEST_PERSONEN: ReadonlySet<string> = new Set(['a11', 'a12', 'a13']);
const leer = (v: unknown): object[] => (Array.isArray(v) ? v.map(() => ({})) : []);

/**
 * Ein Lauf für die Antwort, Status wie angezeigt: A4 nur mit Zählern (keine Personendaten). A11–A13 (lesen den Personenteil) für Konten OHNE
 * Recht auf den Personenteil (`personenteil` false — Vorgabe) ebenfalls nur als Zähler: dieselbe Form, aber leere Einträge (Prüf-Fund 11.10.).
 */
export function laufFuerAntwort(l: AnalyseLauf, jetztMs: number, personenteil = false): AnalyseLauf {
  const status = laufStatusAnzeige(l, jetztMs);
  if (l.agent === 'a4') {
    const e = l.ergebnis as { funktion?: string; karten?: unknown; zaehler?: unknown; ausgelassen?: unknown } | undefined;
    return { ...l, status, ...(e ? { ergebnis: { funktion: e.funktion, karten: Array.isArray(e.karten) ? e.karten.length : 0, zaehler: e.zaehler, ausgelassen: e.ausgelassen } } : {}) };
  }
  if (!LIEST_PERSONEN.has(l.agent) || personenteil || !l.ergebnis) return { ...l, status };
  const e = l.ergebnis as { abschnitte?: Record<string, unknown>; quellen?: unknown; diagnose?: { top5?: unknown; quickWins?: unknown; fragen?: unknown }; befunde?: unknown; zaehler?: unknown; ausgelassen?: unknown };
  return {
    ...l, status,
    ergebnis: {
      nurZaehler: true,
      abschnitte: Object.fromEntries(Object.entries(e.abschnitte ?? {}).map(([k, v]) => [k, leer(v)])), quellen: leer(e.quellen),
      ...(e.diagnose ? { diagnose: { top5: leer(e.diagnose.top5), quickWins: leer(e.diagnose.quickWins), fragen: leer(e.diagnose.fragen) } } : {}),
      ...(e.befunde ? { befunde: leer(e.befunde) } : {}), zaehler: e.zaehler, ausgelassen: e.ausgelassen,
    },
  };
}

export function dossierFuerAntwort(d: Dossier, person: string, jetztMs: number, personenteil = false): DossierAntwort {
  const { leseteil, laeufe, ...rest } = d;
  return {
    ...rest,
    laeufe: laeufe.map(l => laufFuerAntwort(l, jetztMs, personenteil)),
    ...(leseteil ? { leseteil: { gestartetAm: leseteil.gestartetAm, eigen: leseteil.person === person, ...(leseteil.person === person ? { id: leseteil.id } : {}) } } : {}),
  };
}
