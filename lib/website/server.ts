// ─── Website — Bestand, öffentliche Inhalte, Bilder, Erstgespräch (nur Server, 31.10.) ────────────────────────────────────────────────
// Regeln: lib/website/regeln.ts (Kopf). EINE Schreibstelle `websiteAendern` (Sperre des Bestands, Stand je Eintrag, alles oder nichts, Protokoll ohne
// Werte). Die öffentliche Form baut nur `websiteOeffentlich` — aus dem Bestand, dem Bausteine-Katalog (mit Überlagerung), den eigenen Events und den
// für die Website freigegebenen Medien; nie Personen, nie Gäste, nie interne Kennungen.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import {
  WEBSITE_BESTAND, WEB_LISTEN, WebFehler, erstgespraechZiel, inhaltAus, leererInhalt, oeffentlicherInhalt, opsAnwenden,
  type EventQuelle, type WebKonflikt, type WebOp, type WebsiteInhalt, type WebsiteOeffentlich,
} from './regeln';

export async function ladeWebsiteInhalt(): Promise<WebsiteInhalt> {
  return inhaltAus(await loadJson<unknown>(WEBSITE_BESTAND));
}

export class WebKonfliktFehler extends Error { constructor(readonly konflikte: WebKonflikt[], readonly inhalt: WebsiteInhalt) { super('Konflikt'); } }

/** Änderungen schreiben (EINE Sperre). Konflikt → WebKonfliktFehler (409 mit aktuellem Bestand), Unsinn/Grenze → WebFehler (400/413/409). */
export async function websiteAendern(ops: readonly WebOp[], person: string, wer: Wer, jetzt = new Date()): Promise<WebsiteInhalt> {
  let konflikte: WebKonflikt[] = [];
  let stand: WebsiteInhalt = leererInhalt();
  const nachher = await updateJson<unknown>(WEBSITE_BESTAND, roh => {
    const alt = inhaltAus(roh);
    const r = opsAnwenden(alt, ops, { person, jetzt: jetzt.toISOString() });
    konflikte = r.konflikte;
    stand = alt;
    return konflikte.length ? (roh ?? alt) : r.inhalt;
  });
  if (konflikte.length) throw new WebKonfliktFehler(konflikte, stand);
  await protokolliere(WEBSITE_BESTAND, ops.map(o => ({ liste: o.liste, op: o.art === 'weg' ? 'geloescht' as const : 'geaendert' as const, id: 'id' in o ? o.id : 'einstellungen' })), wer).catch(() => {});
  return inhaltAus(nachher);
}

// ── Quellen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eigene Events (nie besuchte) in der Form, die die Website zeigen darf. */
export async function eventQuellen(): Promise<EventQuelle[]> {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const { istBesuch } = await import('@/lib/crm/besuche-form');
  const crm = await ladeCrm();
  return (crm.events ?? []).map(e => ({
    id: e.id, titel: e.titel, datum: e.datum, ...(e.uhrzeit ? { uhrzeit: e.uhrzeit } : {}), ...((e as { bisDatum?: string }).bisDatum ? { bisDatum: (e as { bisDatum?: string }).bisDatum } : {}),
    ...(e.ort ? { ort: e.ort } : {}), format: e.format, status: e.status, besucht: istBesuch(e),
  }));
}

/** Medien des Business-Bereichs, die für den Kanal „Website“ freigegeben sind (Bilder, nicht gelöscht) — Kennung → Name. Wirft nie. */
export async function websiteMedien(): Promise<Map<string, { name?: string; breite?: number; hoehe?: number }>> {
  const raus = new Map<string, { name?: string; breite?: number; hoehe?: number }>();
  try {
    const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
    const { katalogName, ladeKatalog, lageFuer } = await import('@/lib/medien/server');
    const { wirksamerStatus } = await import('@/lib/medien/regeln');
    const kat = await ladeKatalog(katalogName('business', await karteiHaushalt()));
    const lage = await lageFuer(kat);
    for (const m of kat.medien) {
      if (m.art !== 'bild' || m.geloeschtAm) continue;
      if (wirksamerStatus(m, lage).status !== 'freigegeben' || !(m.marketing.kanaele ?? []).includes('website')) continue;
      raus.set(m.id, { ...(m.name ? { name: m.name } : {}), ...(m.breite ? { breite: m.breite } : {}), ...(m.hoehe ? { hoehe: m.hoehe } : {}) });
    }
  } catch { /* ohne Medien keine Bilder */ }
  return raus;
}

/** Die öffentliche Antwort (der Vertrag mit der Website). */
export async function websiteOeffentlich(heute = localDay()): Promise<WebsiteOeffentlich> {
  const { katalogLaden } = await import('@/lib/bausteine/server');
  const [inhalt, katalog, events, medien] = await Promise.all([
    ladeWebsiteInhalt(), katalogLaden().catch(() => []), eventQuellen().catch(() => [] as EventQuelle[]),
    websiteMedien(),
  ]);
  return oeffentlicherInhalt(inhalt, { katalog, events, bildOk: m => medien.has(m), heute });
}

// ── Erstgespräch ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export async function erstgespraechWohin(): Promise<ReturnType<typeof erstgespraechZiel>> {
  try {
    const { ladeBuchungBestand } = await import('@/lib/kalender/buchung-speicher');
    const [inhalt, buchung] = await Promise.all([ladeWebsiteInhalt(), ladeBuchungBestand()]);
    return erstgespraechZiel({ gewaehlt: inhalt.einstellungen.erstgespraechSlug, aktiveSeiten: buchung.seiten.filter(s => s.aktiv).map(s => s.slug) });
  } catch { return { art: 'keins' }; }
}

// ── Startwerte ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Ort der Startwerte (vom Website-Bau geschrieben) — `MAKE_OS_WEBSITE_STARTWERTE` biegt ihn um (Tests, andere Instanz). */
export const startwerteDatei = (): string => process.env.MAKE_OS_WEBSITE_STARTWERTE?.trim() || path.join(process.cwd(), 'website', 'startwerte-inhalt.json');

/** Die Startwerte lesen — fehlt die Datei, null; kaputt → WebFehler 409. */
export async function startwerteLesen(): Promise<unknown | null> {
  let roh: string;
  try { roh = await fs.readFile(startwerteDatei(), 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null; throw new WebFehler('Startwerte nicht lesbar.', 409); }
  try { return JSON.parse(roh); } catch { throw new WebFehler('Startwerte sind kein JSON.', 409); }
}

export { WEB_LISTEN };
