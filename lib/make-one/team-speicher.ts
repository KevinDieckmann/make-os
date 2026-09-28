// ─── MAKE OS — Team-Speicher je Haushalt (28.09., U4) ───────────────────────
// Bestand `team--<haushalt>` = { team: TeamEintrag[] } über local-db (also
// verschlüsselt wie alles). Nur Server. Leser (Delegation, Inbox-Triage, Loop,
// Brain → ZOE) holen das Team über `teamVon`/`teamFuerPerson`/`teamFuerAnfrage`;
// die Oberfläche über GET /api/team (ETag). Namen stehen nur hier in den Daten.

import { loadJson } from '@/lib/store/local-db';
import { mitStand } from '@/lib/store/fingerabdruck';
import { ladeKonten } from '@/lib/zugang/konten';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import { haushaltDesInhabers, karteiZugang, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import {
  teamZusammen, platzhalterTeam, KURZ_OK, FARBE_OK, TEAM_ID_OK, KONTO_PRAEFIX, kurzAus,
  type TeamEintrag, type TeamKonto, type TeamPerson,
} from './team-typen';

export interface TeamDatei { team: TeamEintrag[] }

export function teamSpeicherName(haushalt: string): string {
  if (!HAUSHALT_OK.test(haushalt)) throw new Error(`Ungültiger Haushalt: ${haushalt}`);
  return `team--${haushalt}`;
}

/** Konten eines Haushalts (der Inhaber zählt immer zu seinem Haushalt). */
export async function kontenDesHaushalts(haushalt: string): Promise<TeamKonto[]> {
  const { konten } = await ladeKonten();
  return konten
    .filter(k => k.haushalt === haushalt)
    .sort((a, b) => Number(b.rolle === 'inhaber') - Number(a.rolle === 'inhaber'))
    .map(k => ({ speicher: k.speicher, name: k.name, rolle: k.rolle }));
}

/** Die gespeicherten Einträge — leer, wenn es den Bestand noch nicht gibt. Lesefehler werfen (local-db). */
export async function ladeTeamEintraege(haushalt: string): Promise<TeamEintrag[]> {
  const f = await loadJson<TeamDatei>(teamSpeicherName(haushalt));
  return Array.isArray(f?.team) ? f.team : [];
}

/** Team + „kommt es aus den Daten?“ für einen Haushalt. `null` = kein Haushalt → nur Platzhalter. */
export async function teamStand(haushalt: string | null): Promise<{ team: TeamPerson[]; ausDaten: boolean }> {
  if (!haushalt || !HAUSHALT_OK.test(haushalt)) return { team: platzhalterTeam(), ausDaten: false };
  const [konten, eintraege] = await Promise.all([kontenDesHaushalts(haushalt), ladeTeamEintraege(haushalt)]);
  const staende = new Map(mitStand(eintraege).map(e => [e.id, e.stand]));
  return teamZusammen(konten, eintraege, staende);
}

/** Das Team eines Haushalts (Konten + Speicher; Rückfall Platzhalter). */
export async function teamVon(haushalt: string | null): Promise<TeamPerson[]> {
  return (await teamStand(haushalt)).team;
}

/** Nur lesen, nie danach schreiben: ein unlesbarer Bestand fällt für Prompts auf die Platzhalter zurück. */
async function teamSicher(haushalt: string | null): Promise<TeamPerson[]> {
  try { return await teamVon(haushalt); } catch { return platzhalterTeam(); }
}

/** Team für eine Person: gehört sie zum Haushalt des Inhabers, dessen Team — sonst die Platzhalter. */
export async function teamFuerPerson(person: string | null | undefined): Promise<TeamPerson[]> {
  if (!(await personImHaushaltDesInhabers(person))) return platzhalterTeam();
  return teamSicher(await haushaltDesInhabers());
}

/** Team für eine Anfrage (Sitzung oder Dienstweg): Haushalt des Inhabers, sonst die Platzhalter. */
export async function teamFuerAnfrage(req: Request): Promise<TeamPerson[]> {
  const w = await karteiZugang(req).catch(() => null);
  if (!w) return platzhalterTeam();
  return teamSicher(await haushaltDesInhabers());
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Ein Eintrag aus dem Netz, geprüft — oder null. Konten-Einträge (`konto-…`) sind immer aktiv und tragen
 * keine E-Mail (die steht am Konto). Kennung fehlt → neue.
 */
export function saeubereTeamEintrag(roh: unknown): TeamEintrag | null {
  const e = (roh ?? {}) as Record<string, unknown>;
  const name = text(e.name, 80);
  if (!name) return null;
  const idRoh = text(e.id, 48);
  const id = idRoh && TEAM_ID_OK.test(idRoh) ? idRoh : !idRoh ? `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : null;
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
