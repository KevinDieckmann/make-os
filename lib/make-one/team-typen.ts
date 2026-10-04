// ─── MAKE OS — Team aus den Daten (28.09., U4) ──────────────────────────────
// Das Team steht im Speicher `team--<haushalt>` (lib/make-one/team-speicher.ts),
// nicht im Code. Hier nur Formen und reine Regeln — client-sicher, damit die
// Aufgaben-Seite, die Säule und die Routen dieselben Regeln lesen.
//
// Aufbau des Teams:
//   · Konten des Haushalts sind feste Einträge (Kennung `konto-<speicher>`):
//     Name kommt aus dem Konto, Rolle/Bereich/Kurzwort/Farbe dürfen im
//     Speicher überschrieben werden.
//   · Alle anderen Personen stehen nur im Speicher.
//   · Ist der Speicher leer, gelten die Rollen-Platzhalter aus team-data.ts —
//     nie eine Übernahme echter Namen aus alten Code-Ständen.

import { TEAM as PLATZHALTER, type TeamMitglied } from './team-data';

/** Ein gespeicherter Eintrag in `team--<haushalt>`. */
export interface TeamEintrag {
  id: string;
  name: string;
  /** Ein Wort (Buchstaben, Ziffern, _ oder -) — steht im Delegiert-Marker „— Delegiert an <kurz>“. */
  kurz: string;
  rolle: string;
  bereich?: string;
  email?: string;
  aktiv: boolean;
  /** #rrggbb */
  farbe?: string;
  /** Kern-Team oder extern/beratend (Standard: kern). */
  kreis?: 'kern' | 'partner';
  /**
   * Seit wann die Person deaktiviert ist (ISO) — setzt NUR der Server (Team-Route bzw. Morgenlauf), nie der Browser
   * (DSGVO-Nachtrag 04.10.): 30 Tage danach löscht der Morgenlauf ihre Kapazitätsdaten (lib/kapazitaet/aufraeumen.ts).
   * Fehlt bei alten deaktivierten Einträgen (Kompatibilitätsmodus) — dann stempelt der nächste Morgenlauf „jetzt“.
   */
  deaktiviertAm?: string;
}

/** Eine Person im Team, wie Leser sie bekommen. */
export interface TeamPerson extends TeamEintrag {
  /** konto = fester Eintrag aus den Konten · daten = aus dem Speicher · platzhalter = Rückfall aus team-data.ts */
  quelle: 'konto' | 'daten' | 'platzhalter';
  kreis: 'kern' | 'partner';
  /** Nur bei Konten: der Speichername (kevin, malin, …). */
  speicher?: string;
  /** Inhaber des Haushalts — bekommt keine Aufgaben delegiert. */
  inhaber?: boolean;
  /** Fingerabdruck des gespeicherten Eintrags (fehlt, solange nichts gespeichert ist). */
  stand?: string;
}

export interface TeamAntwort {
  ok: boolean;
  team: TeamPerson[];
  /** false = der Speicher ist leer, es gelten Platzhalter → Hinweis „Team einmal eintragen“. */
  ausDaten: boolean;
  fehler?: string;
  konflikte?: unknown[];
}

/** Ein Kurzwort: ein Wort, 1–24 Zeichen, Umlaute erlaubt. */
export const KURZ_OK = /^[\p{L}\p{N}_-]{1,24}$/u;
export const FARBE_OK = /^#[0-9a-fA-F]{6}$/;
export const KONTO_PRAEFIX = 'konto-';
export const TEAM_ID_OK = /^[a-z0-9][a-z0-9-]{0,47}$/;

/** Kurzwort aus einem Namen: das erste Wort, nur zulässige Zeichen. */
export function kurzAus(name: string, rueckfall = 'Person'): string {
  const w = String(name ?? '').trim().split(/\s+/)[0] ?? '';
  const s = w.replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 24);
  return s || rueckfall;
}

/** Der Marker in der Aufgabenbeschreibung: „— Delegiert an <kurz> (tt.mm)“. */
const MARKER = /— Delegiert an ([\p{L}\p{N}_-]+)/u;

/** Kurzwort aus dem Delegiert-Marker einer Beschreibung — oder undefined. */
export function delegiertKurz(desc?: string | null): string | undefined {
  return desc ? desc.match(MARKER)?.[1] : undefined;
}

/** Person zu einem Kurzwort (ohne Groß/Klein-Unterschied). */
export function personZuKurz(team: readonly TeamPerson[], kurz?: string | null): TeamPerson | undefined {
  if (!kurz) return undefined;
  const k = kurz.toLocaleLowerCase('de');
  return team.find(p => p.kurz.toLocaleLowerCase('de') === k);
}

/** Wem eine Aufgabe laut Marker gehört — Kurzwort und, wenn im Team, die Person. */
export function delegiertAn(desc: string | null | undefined, team: readonly TeamPerson[]): { kurz: string; person?: TeamPerson } | undefined {
  const kurz = delegiertKurz(desc);
  return kurz ? { kurz, person: personZuKurz(team, kurz) } : undefined;
}

/** Wer Aufgaben bekommen darf: aktiv und nicht der Inhaber. */
export const delegierbar = (team: readonly TeamPerson[]): TeamPerson[] => team.filter(p => p.aktiv && !p.inhaber);

/** Für Prompts: eine Zeile je aktiver Person („Name (Kurzwort): Rolle — Bereich“). */
export function teamZeilenAus(team: readonly TeamPerson[]): string[] {
  return team.filter(p => p.aktiv).map(p => {
    const was = [p.rolle, p.bereich].filter(Boolean).join(' — ');
    return `${p.name}${p.kurz !== p.name ? ` (${p.kurz})` : ''}${p.kreis === 'partner' ? ' [extern]' : ''}: ${was || 'ohne Zuständigkeit'}`;
  });
}

/** Ein Platzhalter aus team-data.ts als Team-Person. */
function ausPlatzhalter(t: TeamMitglied): TeamPerson {
  return {
    id: `platzhalter-${t.kurz.toLowerCase()}`,
    name: t.name, kurz: t.kurz, rolle: t.bereiche[0] ?? '', bereich: t.bereiche.slice(1).join(', ') || undefined,
    aktiv: true, kreis: t.kreis === 'partner' ? 'partner' : 'kern', quelle: 'platzhalter',
    ...(t.kurz === 'Kevin' ? { inhaber: true } : {}),
  };
}

/** Der Rückfall für leere Speicher und Tests: die Rollen-Platzhalter aus team-data.ts. */
export const platzhalterTeam = (): TeamPerson[] => PLATZHALTER.map(ausPlatzhalter);

/** Ein Konto, soweit das Team es braucht. */
export interface TeamKonto { speicher: string; name: string; rolle: 'inhaber' | 'mitglied' }

/**
 * Konten + gespeicherte Einträge → das Team. Konten sind feste Einträge (Name aus dem Konto, immer aktiv);
 * ein gespeicherter Eintrag `konto-<speicher>` überschreibt nur Kurzwort, Rolle, Bereich, Farbe, Kreis.
 * Ohne eigene Einträge (nur Konten) kommen die Platzhalter dazu — außer denen, deren Kurzwort ein Konto trägt.
 */
export function teamZusammen(konten: readonly TeamKonto[], eintraege: readonly TeamEintrag[], staende: ReadonlyMap<string, string> = new Map()): { team: TeamPerson[]; ausDaten: boolean } {
  const nachId = new Map(eintraege.map(e => [e.id, e]));
  const platz = new Map(PLATZHALTER.map(t => [t.kurz.toLowerCase(), t]));
  const kontoPersonen: TeamPerson[] = konten.map(k => {
    const id = `${KONTO_PRAEFIX}${k.speicher}`;
    const e = nachId.get(id);
    const kurz = e?.kurz && KURZ_OK.test(e.kurz) ? e.kurz : kurzAus(k.name, k.speicher);
    // Kevin und Malin stehen mit ihren Bereichen in team-data.ts (keine Dritten) — Vorgabe, bis gepflegt.
    const vorgabe = platz.get(kurz.toLowerCase());
    return {
      id, name: k.name || kurz, kurz,
      rolle: e?.rolle || vorgabe?.bereiche[0] || (k.rolle === 'inhaber' ? 'Inhaber' : 'Mitglied'),
      ...(e?.bereich ? { bereich: e.bereich } : vorgabe && vorgabe.bereiche.length > 1 ? { bereich: vorgabe.bereiche.slice(1).join(', ') } : {}),
      ...(e?.farbe ? { farbe: e.farbe } : {}),
      aktiv: true, kreis: e?.kreis ?? 'kern', quelle: 'konto' as const, speicher: k.speicher,
      ...(k.rolle === 'inhaber' ? { inhaber: true } : {}),
      ...(staende.get(id) ? { stand: staende.get(id) } : {}),
    };
  });
  const daten: TeamPerson[] = eintraege.filter(e => !e.id.startsWith(KONTO_PRAEFIX)).map(e => ({
    ...e, kreis: e.kreis ?? 'kern', quelle: 'daten' as const, ...(staende.get(e.id) ? { stand: staende.get(e.id) } : {}),
  }));
  const ausDaten = daten.length > 0;
  if (ausDaten) return { team: [...kontoPersonen, ...daten], ausDaten };
  const vergeben = new Set(kontoPersonen.map(p => p.kurz.toLowerCase()));
  return { team: [...kontoPersonen, ...platzhalterTeam().filter(p => !vergeben.has(p.kurz.toLowerCase()))], ausDaten: false };
}
