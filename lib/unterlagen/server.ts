// ─── Unterlagen per E-Mail anfordern — Katalog, Link-Token, Anforderung (nur Server, 31.10.) ─────────────────────────────────────────
// Dateien und Katalog liegen im Repo-Ordner `unterlagen/` (NICHT öffentlich — Caddy liefert nur `fokusinnovation/` statisch aus; das Bild kopiert
// das ganze Repo), Ort per `MAKE_OS_UNTERLAGEN_DIR` überschreibbar (Tests). Kein eigener Bestand mit Personendaten: die Anforderung wird zur Anfrage
// im CRM (der EINE Anfrage-Weg `anfrageAnlegen`, Kanal Website), die Mail geht über den Website-Absender (lib/oeffentlich/website-post.ts — dort die
// Begründung der eng gefassten Ausnahme von Eiserner Regel 3), die Grenze je Adresse zählt im Arbeitsspeicher.
// Download-Link: zustandslos und signiert — `u1.<kennung>.<ablauf base36>.<HMAC>` mit dem Sitzungsgeheimnis und eigenem Zweck; enthält nur die
// Kennung der Unterlage und den Ablauf (7 Tage), NIE die Adresse.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sitzungsGeheimnis } from '@/lib/zugang/sitzung';
import { DATEI_BYTES_MAX, LINK_TAGE, katalogPruefen, dateiOk, unterlageMail, type Unterlage, type UnterlageArt } from './regeln';
import type { WebsiteLage } from '@/lib/oeffentlich/website-post';

// ── Katalog ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const unterlagenOrdner = (): string => process.env.MAKE_OS_UNTERLAGEN_DIR?.trim() || path.join(process.cwd(), 'unterlagen');

/** Katalog nicht lesbar (kaputtes JSON) — die Route antwortet 503, nie still „gibt es nicht“. */
export class KatalogKaputt extends Error {}

let gemeldet = '';
/** Den Katalog lesen — fehlt die Datei, ist er leer. Verworfene Einträge gehen (einmal je Fassung) ins Log, ohne Inhalte. */
export async function katalogLaden(): Promise<Unterlage[]> {
  let roh: string;
  try { roh = await fs.readFile(path.join(unterlagenOrdner(), 'katalog.json'), 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return []; throw new KatalogKaputt('katalog.json nicht lesbar'); }
  let json: unknown;
  try { json = JSON.parse(roh); } catch { throw new KatalogKaputt('katalog.json ist kein JSON'); }
  const { unterlagen, fehler } = katalogPruefen(json);
  if (fehler.length && gemeldet !== roh) { gemeldet = roh; console.warn(`[unterlagen] katalog.json: ${fehler.length} Eintrag/Einträge verworfen — ${fehler.slice(0, 5).join(' | ')}`); }
  return unterlagen;
}

export async function unterlageVon(id: unknown): Promise<Unterlage | null> {
  if (typeof id !== 'string') return null;
  return (await katalogLaden()).find(u => u.id === id) ?? null;
}

// ── Link-Token ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const TOKEN_FORM = /^u1\.([a-z0-9-]{1,60})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/;
const signatur = (id: string, ablauf: number) => createHmac('sha256', `${sitzungsGeheimnis()}|unterlage-link`).update(`u1|${id}|${ablauf}`).digest('base64url');

/** Ein Download-Link-Token für die Unterlage `id`, gültig `LINK_TAGE` Tage ab `jetzt`. */
export function linkToken(id: string, jetzt = new Date()): string {
  const ablauf = Math.floor(jetzt.getTime() / 1000) + LINK_TAGE * 86_400;
  return `u1.${id}.${ablauf.toString(36)}.${signatur(id, ablauf)}`;
}

/**
 * Ein Token prüfen (zeitkonstant). `ok` mit der Kennung; sonst `abgelaufen` (echt, aber zu alt — die Kennung ist dann bekannt) bzw. `ungueltig`
 * (gefälscht, kaputt — `id` nur als Vermutung aus der Form, nur für den Hinweis auf die Seite der Website).
 */
export function tokenPruefen(t: unknown, jetzt = new Date()): { ok: true; id: string } | { ok: false; grund: 'abgelaufen' | 'ungueltig'; id?: string } {
  if (typeof t !== 'string' || t.length > 140) return { ok: false, grund: 'ungueltig' };
  const m = TOKEN_FORM.exec(t);
  if (!m) return { ok: false, grund: 'ungueltig' };
  const [, id, ab36, sig] = m;
  const ablauf = parseInt(ab36, 36);
  if (!Number.isSafeInteger(ablauf)) return { ok: false, grund: 'ungueltig', id };
  const soll = Buffer.from(signatur(id, ablauf)), ist = Buffer.from(sig);
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) return { ok: false, grund: 'ungueltig', id };
  if (ablauf * 1000 < jetzt.getTime()) return { ok: false, grund: 'abgelaufen', id };
  return { ok: true, id };
}

/** Download-Link einer Datei über die Website (`/api/unterlage/laden`, Caddy leitet den Pfad an die App). */
export const downloadLink = (website: string, token: string, art: UnterlageArt): string => `${website}/api/unterlage/laden?t=${encodeURIComponent(token)}&d=${art}`;

// ── Datei lesen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die Datei einer Art lesen — nur, wenn sie wirklich IM Ordner liegt (auch nach Auflösen von Verknüpfungen), eine Datei ist und unter der Grenze bleibt.
 * Sonst null (die Route antwortet 404).
 */
export async function dateiLesen(u: Unterlage, art: UnterlageArt): Promise<{ inhalt: Buffer; name: string } | null> {
  const d = u.dateien.find(x => x.art === art);
  if (!d || !dateiOk(d.datei, art)) return null;
  try {
    const ordner = await fs.realpath(unterlagenOrdner());
    const ziel = await fs.realpath(path.join(ordner, d.datei));
    if (path.dirname(ziel) !== ordner) return null;
    const st = await fs.stat(ziel);
    if (!st.isFile() || st.size > DATEI_BYTES_MAX) return null;
    return { inhalt: await fs.readFile(ziel), name: d.name };
  } catch { return null; }
}

// ── Anfordern (nach der Antwort) ────────────────────────────────────────────────────────────────────────────────────────────────

export type AnforderungErgebnis = 'gesendet' | 'versandFehler' | 'grenze' | 'eingeschraenkt' | 'gesperrt';

export interface Anforderung { email: string; vorname: string; firma: string; newsletter: boolean }

/**
 * Eine Anforderung verarbeiten — NACH der Antwort an den Gast (die Antwort ist für jede Adresse dieselbe, auch in der Zeit). Reihenfolge:
 * Grenze je Adresse (darüber: nichts, auch keine Anfrage) → Art. 18 (nichts) → Werbesperre/Sperrliste (keine Mail, aber die Anfrage mit Vermerk
 * „nicht verschickt, bitte klären“) → Mail → Anfrage im CRM mit dem Ergebnis im Text → Newsletter-Wunsch in die Anmeldung (Double-Opt-in, Sperren dort).
 */
export async function anforderungVerarbeiten(a: Anforderung, u: Unterlage, lage: WebsiteLage, jetzt = new Date()): Promise<AnforderungErgebnis> {
  const { websiteMailSenden, websiteLink } = await import('@/lib/oeffentlich/website-post');
  const token = linkToken(u.id, jetzt);
  const links = u.dateien.map(d => ({ name: d.name, art: d.art, link: downloadLink(lage.website, token, d.art) }));
  const mail = unterlageMail({ marke: lage.marke, ...(a.vorname ? { vorname: a.vorname } : {}), titel: u.titel, links, seite: websiteLink(lage.website, u.seite) ?? lage.website, verantwortlich: lage.verantwortlich, datenschutzLink: lage.datenschutzLink });
  const r = await websiteMailSenden({ an: a.email, vorname: a.vorname, betreff: mail.betreff, text: mail.text, art: 'unterlage', lage }, jetzt);
  // Über der Grenze, Art. 18 oder Kartei nicht lesbar: nichts, auch keine Anfrage.
  if (!r.ok && (r.grund === 'grenze' || r.grund === 'eingeschraenkt' || r.grund === 'unklar' || r.grund === 'adresse' || r.grund === 'aus')) return r.grund === 'grenze' ? 'grenze' : 'eingeschraenkt';
  const ergebnis: AnforderungErgebnis = r.ok ? 'gesendet' : r.grund === 'fehler' ? 'versandFehler' : 'gesperrt';
  const vermerk = r.ok ? `Download-Links per E-Mail geschickt (über ${lage.ueber}, ${LINK_TAGE} Tage gültig)`
    : r.grund === 'fehler' ? 'die Mail ließ sich nicht verschicken — bitte die Unterlage von Hand schicken'
    : 'nicht verschickt (Werbesperre bzw. Sperrliste) — bitte am Kontakt klären';
  // Anfrage ins CRM (wie der Check): ein Fehler dort hält nichts auf, er steht nur im Log (ohne Adresse).
  try {
    const { ladeCheckEinstellungen } = await import('@/lib/check/speicher');
    const { gastgeberVon } = await import('@/lib/check/server');
    const person = (await gastgeberVon(await ladeCheckEinstellungen())) ?? 'system';
    const { anfrageAnlegen } = await import('@/lib/crm/anfrage-anlegen');
    const lead = await anfrageAnlegen({ neu: { vorname: a.vorname, email: a.email, ...(a.firma ? { firma: a.firma } : {}) }, kanal: 'website', text: `Vorlage „${u.titel}“ über die Website angefordert — ${vermerk}.` }, { person, wer: { art: 'system' } });
    if (!lead.ok) console.warn('[unterlagen] Anfrage nicht angelegt:', lead.fehler.slice(0, 120));
  } catch (x) { console.error('[unterlagen] Anfrage:', x instanceof Error ? x.message.slice(0, 200) : 'Fehler'); }
  if (a.newsletter) {
    const { newsletterBereit, anmeldungVerarbeiten } = await import('@/lib/newsletter/server');
    const nl = await newsletterBereit().catch(() => null);
    if (nl) await anmeldungVerarbeiten({ email: a.email, vorname: a.vorname }, nl, jetzt).catch(() => 'versandFehler');
  }
  return ergebnis;
}

/** Für das Verzeichnis (Art. 30): Website-Absender eingerichtet UND mindestens eine Unterlage im Katalog — dann findet die Verarbeitung statt. Wirft nie. */
export async function unterlagenEingerichtet(): Promise<boolean> {
  try {
    if (!(await katalogLaden()).length) return false;
    const { websiteLage } = await import('@/lib/oeffentlich/website-post');
    return !!(await websiteLage());
  } catch { return false; }
}
