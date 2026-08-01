// ─── MAKE OS — Organisationen ───────────────────────────────────────────────
// Die zweite Sortier-Achse neben den Themen: WO gehört eine Aufgabe hin.
// Kevin trennt bewusst: die Beteiligungsgesellschaft, die Selbständigkeit,
// die Beteiligung KEMARIS und das Private. Jede Aufgabe hat genau einen Ort.
//
// Client-safe: keine Server-Importe.

export interface Organisation {
  id: string;
  label: string;
  kurz: string;
  satz: string;
  farbe: string;
  muster: RegExp;
}

export const ORGS: Organisation[] = [
  {
    id: 'kdv', label: 'KD Ventures UG', kurz: 'Ventures',
    satz: 'Die Beteiligungsgesellschaft — hält, steuert, streut das Risiko.',
    farbe: '#DE9E63',
    muster: /kd ventures|\bkdv\b|beteiligungsgesellschaft|holding|kd management/i,
  },
  {
    id: 'kdc', label: 'Kevin Dieckmann Consulting', kurz: 'Selbständigkeit',
    satz: 'Die Selbständigkeit — das Einzelunternehmen, das heute verdient.',
    farbe: '#21B5AA',
    muster: /selbst[äa]ndig|consulting|einzelunternehm|freiberuf/i,
  },
  {
    id: 'kemaris', label: 'KEMARIS', kurz: 'KEMARIS',
    satz: 'Die größte Beteiligung — eigenes Team, eigene Struktur.',
    farbe: '#4A6CF7',
    muster: /kemaris|innovation group|capos|markttraktion|f&f|connect\b|\bkig\b/i,
  },
  {
    id: 'privat', label: 'Privat', kurz: 'Privat',
    satz: 'Kevin & Malin — Gesundheit, Zuhause, gemeinsame Ziele.',
    farbe: '#58D9CD',
    muster: /privat|wohnung|gesundheit|urlaub|familie|haushalt/i,
  },
];

export const ORG = Object.fromEntries(ORGS.map(o => [o.id, o])) as Record<string, Organisation>;

/** Projekte, die immer zu einer Organisation gehören. */
const PROJEKT_ORG: Record<string, string> = {
  'proj-ig': 'kemaris',
  'proj-capos': 'kemaris',
  'proj-kdm': 'kdv',
  'proj-health': 'privat',
  'proj-privat': 'privat',
  'proj-make': 'privat',
};

/** Ort einer Aufgabe: von Hand > Text (spezifisch) > Projekt > KD Ventures. */
export function orgVon(
  t: { id: string; title: string; description?: string; projectId: string },
  zuordnung: Record<string, string> = {},
): string {
  const hand = zuordnung[t.id];
  if (hand && ORG[hand]) return hand;
  // Der Text schlägt das Projekt: „Selbständigkeit: Buchhaltung" liegt in
  // proj-kdm, gehört aber zur Selbständigkeit.
  const text = `${t.title} ${t.description ?? ''}`;
  for (const o of ORGS) if (o.muster.test(text)) return o.id;
  return PROJEKT_ORG[t.projectId] ?? 'kdv';
}
