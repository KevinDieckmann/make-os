// ─── MAKE OS — Team-Speicher je Haushalt (28.09., U4) ───────────────────────
// Bestand `team--<haushalt>` = { team: TeamEintrag[] } über local-db (also
// verschlüsselt wie alles). Nur Server. Leser (Delegation, Inbox-Triage, Loop,
// Brain → ZOE) holen das Team über `teamVon`/`teamFuerPerson`/`teamFuerAnfrage`;
// die Oberfläche über GET /api/team (ETag). Namen stehen nur hier in den Daten.

import { loadJson } from '@/lib/store/local-db';
import { mitStand } from '@/lib/store/fingerabdruck';
import { ladeKonten } from '@/lib/zugang/konten';
import { hauptInhaber } from '@/lib/zugang/inhaber';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers, karteiZugang, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import {
  teamZusammen, ohneTeam, KURZ_OK, FARBE_OK, TEAM_ID_OK, KONTO_PRAEFIX, kurzAus,
  type TeamEintrag, type TeamKonto, type TeamPerson,
} from './team-typen';
import { neueKennung } from '@/lib/kennung';

export interface TeamDatei { team: TeamEintrag[] }

export function teamSpeicherName(haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `team--${haushalt}`;
}

/** Konten eines Haushalts (der Inhaber zählt immer zu seinem Haushalt). Inhaber zuerst; `haupt` markiert den Haupt-Inhaber (09.10.). */
export async function kontenDesHaushalts(haushalt: string): Promise<TeamKonto[]> {
  const st = await ladeKonten();
  const haupt = hauptInhaber(st)?.speicher;
  return st.konten
    .filter(k => k.haushalt === haushalt)
    .sort((a, b) => Number(b.rolle === 'inhaber') - Number(a.rolle === 'inhaber'))
    .map(k => ({ speicher: k.speicher, name: k.name, rolle: k.rolle, haupt: k.speicher === haupt }));
}

/** Die gespeicherten Einträge — leer, wenn es den Bestand noch nicht gibt. Lesefehler werfen (local-db). */
export async function ladeTeamEintraege(haushalt: string): Promise<TeamEintrag[]> {
  const f = await loadJson<TeamDatei>(teamSpeicherName(haushalt));
  return Array.isArray(f?.team) ? f.team : [];
}

/** Team + „kommt es aus den Daten?“ für einen Haushalt. `null` = kein Haushalt → kein Team. */
export async function teamStand(haushalt: string | null): Promise<{ team: TeamPerson[]; ausDaten: boolean }> {
  if (!haushalt || !HAUSHALT_OK.test(haushalt)) return { team: ohneTeam(), ausDaten: false };
  const [konten, eintraege] = await Promise.all([kontenDesHaushalts(haushalt), ladeTeamEintraege(haushalt)]);
  const staende = new Map(mitStand(eintraege).map(e => [e.id, e.stand]));
  return teamZusammen(konten, eintraege, staende);
}

/** Das Team eines Haushalts (Konten + Speicher; ohne Speicher nur die Konten mit neutraler Rolle). */
export async function teamVon(haushalt: string | null): Promise<TeamPerson[]> {
  return (await teamStand(haushalt)).team;
}

/** Nur lesen, nie danach schreiben: ein unlesbarer Bestand fällt für Prompts auf „kein Team“ zurück. */
async function teamSicher(haushalt: string | null): Promise<TeamPerson[]> {
  try { return await teamVon(haushalt); } catch { return ohneTeam(); }
}

/** Team für eine Person: gehört sie zum Haushalt des Inhabers, dessen Team — sonst keins. */
export async function teamFuerPerson(person: string | null | undefined): Promise<TeamPerson[]> {
  if (!(await personImHaushaltDesInhabers(person))) return ohneTeam();
  return teamSicher(await haushaltDesInhabers());
}

/** Team für eine Anfrage (Sitzung oder Dienstweg): Haushalt des Inhabers, sonst keins. */
export async function teamFuerAnfrage(req: Request): Promise<TeamPerson[]> {
  const w = await karteiZugang(req).catch(() => null);
  if (!w) return ohneTeam();
  return teamSicher(await haushaltDesInhabers());
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Deaktivierungszeitpunkt serverseitig festhalten (DSGVO-Nachtrag 04.10.) — `saeubereTeamEintrag` verwirft das Feld aus dem
 * Netz, hier kommt es vom Server zurück: aktiv → Feld weg (Reaktivierung, die Frist ist vorbei); war schon inaktiv → alter
 * Zeitpunkt bleibt (fehlt er, stempelt der Morgenlauf); wird gerade deaktiviert → `jetzt`.
 */
export function deaktivierungStempeln(neu: TeamEintrag, alt: TeamEintrag | undefined, jetzt: string): TeamEintrag {
  const { deaktiviertAm: _weg, ...ohne } = neu;
  void _weg;
  if (neu.aktiv || neu.id.startsWith(KONTO_PRAEFIX)) return ohne;
  if (alt && !alt.aktiv) return alt.deaktiviertAm ? { ...ohne, deaktiviertAm: alt.deaktiviertAm } : ohne;
  return { ...ohne, deaktiviertAm: jetzt };
}

/**
 * Ein Eintrag aus dem Netz, geprüft — oder null. Konten-Einträge (`konto-…`) sind immer aktiv und tragen
 * keine E-Mail (die steht am Konto). Kennung fehlt → neue.
 */
export function saeubereTeamEintrag(roh: unknown): TeamEintrag | null {
  const e = (roh ?? {}) as Record<string, unknown>;
  const name = text(e.name, 80);
  if (!name) return null;
  const idRoh = text(e.id, 48);
  const id = idRoh && TEAM_ID_OK.test(idRoh) ? idRoh : !idRoh ? neueKennung('t') : null;
  if (!id) return null;
  const kurzRoh = text(e.kurz, 24);
  const kurz = kurzRoh ? kurzRoh : kurzAus(name);
  if (!KURZ_OK.test(kurz)) return null;
  const konto = id.startsWith(KONTO_PRAEFIX);
  const email = text(e.email, 160).toLowerCase();
  const bereich = text(e.bereich, 300);
  const farbe = text(e.farbe, 7);
  return {
    id, name, kurz,
    rolle: text(e.rolle, 80),
    ...(bereich ? { bereich } : {}),
    ...(!konto && email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? { email } : {}),
    aktiv: konto ? true : e.aktiv !== false,
    ...(FARBE_OK.test(farbe) ? { farbe } : {}),
    ...(e.kreis === 'partner' ? { kreis: 'partner' as const } : {}),
  };
}
