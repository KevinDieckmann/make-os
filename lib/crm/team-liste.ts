// ─── Markttraktion — die Team-Liste (rein, ohne Importe; 09.10., Paket „neutral-rest“) ─────────────────────────────────
// Ausgelagert aus lib/crm/team.ts, damit auch Dateien, die team.ts selbst einbindet (lib/make-one/crm.ts: Import-Owner),
// dieselbe Liste lesen — statt fester Namen im Code. Inhalt unverändert: `NEXT_PUBLIC_MAKE_OS_CRM_TEAM` (JSON-Liste
// `[{ "id": "<speicher>", "name": "…", "farbe": "#rrggbb", "verantwortet": ["sales"] }]`, 1–4 Einträge) ersetzt die Vorgabe.
// Offen (MARKTTRAKTION_BEFUND 6.4, Plattform-Paket 1): das Team aus den Konten statt aus Vorgabe/Build-Variable.

import type { Welt } from './traktion';

export interface Mitglied { id: string; name: string; farbe: string; verantwortet: Welt[] }
const WELTEN: readonly Welt[] = ['sales', 'marketing', 'event'];

function teamAusUmgebung(): Mitglied[] | null {
  const roh = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM : undefined;
  if (!roh) return null;
  try {
    const l = JSON.parse(roh) as unknown;
    if (!Array.isArray(l) || !l.length || l.length > 4) return null;
    const aus = l.map(x => x as Record<string, unknown>).map(x => ({
      id: String(x.id ?? ''), name: String(x.name ?? '').trim().slice(0, 40), farbe: /^#[0-9a-fA-F]{6}$/.test(String(x.farbe)) ? String(x.farbe) : '#58D9CD',
      verantwortet: (Array.isArray(x.verantwortet) ? x.verantwortet : []).filter((w): w is Welt => WELTEN.includes(w as Welt)),
    }));
    return aus.every(m => /^[a-z0-9-]{1,40}$/.test(m.id) && m.id !== 'beide' && m.name) && new Set(aus.map(m => m.id)).size === aus.length ? aus : null;
  } catch { return null; }
}

export const TEAM: Mitglied[] = teamAusUmgebung() ?? [
  { id: 'kevin', name: 'Kevin', farbe: '#58D9CD', verantwortet: ['sales'] },
  { id: 'malin', name: 'Malin', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] },
];
export const BEIDE = 'beide';
