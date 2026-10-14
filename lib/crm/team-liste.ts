// ─── Markttraktion — die Team-Liste (rein, ohne Importe; 09.10., Paket „neutral-rest“) ─────────────────────────────────
// Ausgelagert aus lib/crm/team.ts, damit auch Dateien, die team.ts selbst einbindet (lib/make-one/crm.ts: Import-Owner),
// dieselbe Liste lesen — statt fester Namen im Code. `NEXT_PUBLIC_MAKE_OS_CRM_TEAM` (JSON-Liste
// `[{ "id": "<speicher>", "name": "…", "farbe": "#rrggbb", "verantwortet": ["sales"] }]`, 1–4 Einträge) ersetzt alles.
//
// Seit 14.10. (Kevins Entscheidung, Abnahme: „feste Vorgaben aus den Konten ableiten“): OHNE Umgebungsvariable kommt das Team aus den
// KONTEN des Haushalts der Inhaberin/des Inhabers (`teamAusKonten`) — Kennung = Speichername, Name = Vorname aus dem Konto, Farbe der Reihe
// nach, Verantwortung: die erste Person (Inhaber) Sales, die zweite Marketing + Event (eine Person allein: alles). Für Kevins Instanz ist das
// dasselbe wie die frühere Vorgabe (kevin: Sales, malin: Marketing + Event) — nur ohne Namen im Code. Gesetzt wird es an Ort und Stelle
// (`teamSetzen`, dasselbe Array — alle Leser lesen `TEAM` weiter synchron): auf dem Server bei jedem Lesen der Konten
// (lib/zugang/konten.ts `ladeKonten`), im Browser durch `TeamQuelle` im OS-Rahmen (app/os/layout.tsx, vom Server gerechnet). Kennungen in
// den Daten (zuständig, besitzer …) bleiben unverändert. Solange nichts bekannt ist (reine Läufe, Tests ohne Konten), gelten Rollen-
// Platzhalter — nie ein Personenname.

import type { Welt } from './traktion';

export interface Mitglied { id: string; name: string; farbe: string; verantwortet: Welt[] }
const WELTEN: readonly Welt[] = ['sales', 'marketing', 'event'];
/** Farben der Reihe nach (die ersten zwei wie die frühere Vorgabe). */
const FARBEN = ['#58D9CD', '#A79BFF', '#E9A23B', '#6FCF97'] as const;

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

/** Was `teamAusKonten` von einem Konto braucht (Server UND Browser — nie Hash, Salz, Adresse). */
export interface KontoKurz { speicher: string; name?: string; rolle?: string; haushalt?: string; finanzRecht?: string; angelegt?: string }

/**
 * Das CRM-Team aus den Konten (rein, 14.10.): die Konten im Haushalt der Inhaberin/des Inhabers mit vollem Zugang (ein Konto „nur Business“
 * ist Partner, kein Team-Mitglied), Inhaber zuerst, dann nach Anlage; höchstens vier. `null`, wenn es kein Konto gibt.
 */
export function teamAusKonten(konten: readonly KontoKurz[]): Mitglied[] | null {
  const ok = konten.filter(k => typeof k?.speicher === 'string' && /^[a-z0-9-]{1,40}$/.test(k.speicher) && k.speicher !== 'beide');
  const inhaber = ok.find(k => k.rolle === 'inhaber');
  if (!inhaber) return null;
  const haus = inhaber.haushalt;
  const mitglieder = ok
    .filter(k => k.speicher === inhaber.speicher || (k.finanzRecht !== 'business' && (haus ? k.haushalt === haus : !k.haushalt)))
    .sort((a, b) => Number(b.speicher === inhaber.speicher) - Number(a.speicher === inhaber.speicher) || String(a.angelegt ?? '').localeCompare(String(b.angelegt ?? '')) || a.speicher.localeCompare(b.speicher))
    .slice(0, 4);
  return mitglieder.map((k, i) => ({
    id: k.speicher,
    name: (String(k.name ?? '').trim().split(/\s+/)[0] || k.speicher).slice(0, 40),
    farbe: FARBEN[i] ?? FARBEN[0],
    verantwortet: mitglieder.length === 1 ? [...WELTEN] : i === 0 ? ['sales'] : i === 1 ? ['marketing', 'event'] : [],
  }));
}

/** Rollen-Platzhalter, solange weder Umgebung noch Konten bekannt sind — Rollen, nie eine Person. */
const PLATZHALTER: Mitglied[] = [
  { id: 'person-1', name: 'Person 1', farbe: FARBEN[0], verantwortet: ['sales'] },
  { id: 'person-2', name: 'Person 2', farbe: FARBEN[1], verantwortet: ['marketing', 'event'] },
];

const AUS_UMGEBUNG = teamAusUmgebung();
export const TEAM: Mitglied[] = [...(AUS_UMGEBUNG ?? PLATZHALTER)];
export const BEIDE = 'beide';

/** Kommt das Team aus der Umgebung (`NEXT_PUBLIC_MAKE_OS_CRM_TEAM`)? Dann ändern die Konten nichts. */
export const teamAusDerUmgebung = (): boolean => !!AUS_UMGEBUNG;

/**
 * Das Team an Ort und Stelle ersetzen (dasselbe Array — alle Leser bleiben synchron). Mit Umgebungsvariable und ohne Liste: nichts.
 * Gleiche Liste: nichts (kein Flackern, kein unnötiges Schreiben).
 */
export function teamSetzen(liste: readonly Mitglied[] | null | undefined): void {
  if (AUS_UMGEBUNG || !liste?.length) return;
  if (liste.length === TEAM.length && liste.every((m, i) => m.id === TEAM[i].id && m.name === TEAM[i].name && m.farbe === TEAM[i].farbe && m.verantwortet.join() === TEAM[i].verantwortet.join())) return;
  TEAM.splice(0, TEAM.length, ...liste.map(m => ({ ...m, verantwortet: [...m.verantwortet] })));
}
