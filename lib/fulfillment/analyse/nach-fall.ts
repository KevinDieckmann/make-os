// ─── Fulfillment · Analyse → Fall: was aus der Diagnose in den Fall gehört (12.10., „keine losen Enden“) ────────────────────────────────────
// Der Diagnose-Entwurf (A12, nach F2 geprüft) trägt drei Dinge: Quick Wins (sichtbarer Erfolg in 30 Tagen), Fragen fürs Kick-off und die Top-5-Maßnahmen.
// Bis 11.10. gingen nur Quick Wins und Fragen per Klick in den Fall — die Maßnahmen blieben im Dossier liegen. Jetzt: EINE reine Stelle, die sagt, was
// davon noch NICHT im Fall steht (Vergleich in der Vergleichsform des Titels), und die Maßnahmen als Zusatz-Schritte der Phase nach der Diagnose
// (meist „Aufbau“) anlegt — über die vorhandene Fall-Op `knoten-extra`, nie automatisch: der Klick „in den Fall“ (Dossier bzw. Überblick) schickt sie.
// Rein und client-sicher; genutzt von lib/fulfillment/analyse/dossier-server.ts (`nachFall`) und der Fall-Route (Hinweis im Überblick).

import type { Dossier, Fall, FallKnoten, Massnahme } from '../typen';
import { aktuellerKnoten, inReihenfolge, kinderVon, wurzelVon } from '../regeln';
import { TEXT_MAX } from '../grenzen';

const form = (t: string) => t.normalize('NFC').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();

/** Titel eines Maßnahmen-Schritts: der Text, bei Überlänge an einer Wortgrenze gekürzt — der volle Text steht dann im Ziel (nichts geht verloren). */
export function massnahmeTitel(text: string): { titel: string; ziel?: string } {
  const t = text.trim();
  if (t.length <= TEXT_MAX.titel) return { titel: t };
  const schnitt = t.slice(0, TEXT_MAX.titel - 1);
  const wort = schnitt.lastIndexOf(' ');
  return { titel: `${(wort > 40 ? schnitt.slice(0, wort) : schnitt).trimEnd()}…`, ziel: t.slice(0, TEXT_MAX.ziel) };
}

/** Die Phase, in die die Maßnahmen gehören: die Phase NACH der Diagnose (Titel beginnt mit „Diagnose“), sonst die aktuelle Phase. */
export function massnahmenPhase(fall: Pick<Fall, 'knoten'>): FallKnoten | null {
  const w = wurzelVon(fall.knoten);
  const phasen = w ? kinderVon(w.id, fall.knoten) : inReihenfolge(fall.knoten).filter(k => !k.elternId);
  const i = phasen.findIndex(p => form(p.titel).startsWith('diagnose'));
  if (i >= 0 && phasen[i + 1]) return phasen[i + 1];
  return aktuellerKnoten(fall).phase ?? phasen.at(-1) ?? null;
}

export interface DiagnoseUebergabe {
  /** Quick Wins der Diagnose, die der Fall noch nicht hat. */
  quickWins: string[];
  /** Kick-off-Fragen der Diagnose, die der Fall noch nicht hat. */
  fragen: NonNullable<Dossier['diagnose']>['fragen'];
  /** Maßnahmen der Diagnose, die noch kein Schritt im Fall sind. */
  massnahmen: Massnahme[];
  /** Wohin die Maßnahmen gehen (Titel für die Anzeige). */
  ziel: { id: string; titel: string } | null;
}

/** Was aus der Diagnose noch nicht im Fall steht. Ohne Diagnose: alles leer. */
export function diagnoseUebergabe(d: Dossier['diagnose'] | undefined, fall: Pick<Fall, 'quickWins' | 'kickoffFragen' | 'knoten'>): DiagnoseUebergabe {
  const phase = massnahmenPhase(fall);
  const leer: DiagnoseUebergabe = { quickWins: [], fragen: [], massnahmen: [], ziel: phase ? { id: phase.id, titel: phase.titel } : null };
  if (!d) return leer;
  const qw = new Set(fall.quickWins.map(q => form(q.text)));
  const fr = new Set(fall.kickoffFragen.map(q => form(q.frage)));
  const schritte = new Set(fall.knoten.flatMap(k => [form(k.titel), ...(k.ziel ? [form(k.ziel)] : [])]));
  return {
    ...leer,
    quickWins: d.quickWins.filter(t => !qw.has(form(t))),
    fragen: d.fragen.filter(f => !fr.has(form(f.frage))),
    massnahmen: d.top5.filter(m => !schritte.has(form(m.text)) && !schritte.has(form(massnahmeTitel(m.text).titel))),
  };
}

/** Die Maßnahmen als Fall-Ops (`knoten-extra`) unter der Ziel-Phase — Wirkung als Ziel, intern bis ihr sie im Ablauf für Kunden sichtbar stellt. */
export function massnahmenOps(massnahmen: readonly Massnahme[], phaseId: string): Record<string, unknown>[] {
  return massnahmen.map(m => {
    const t = massnahmeTitel(m.text);
    return { op: 'knoten-extra', eintrag: { elternId: phaseId, titel: t.titel, ...(t.ziel ? { ziel: t.ziel } : {}), ...(m.wirkung ? { ergebnis: m.wirkung.slice(0, TEXT_MAX.ergebnis) } : {}), kundeSichtbar: false } };
  });
}
