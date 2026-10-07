// ─── WhatsApp — Vorlagen (Message Templates) des Business-Kontos lesen (Server, 07.10.2026) ──────────────────────────────
// Meta: GET /<WABA_ID>/message_templates liefert name, language, status (APPROVED, PENDING, REJECTED, PAUSED, DISABLED …), category
// (MARKETING, UTILITY, AUTHENTICATION), components; Platzhalter {{1}}, {{2}} bzw. benannt; senden nur mit APPROVED
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview, abgerufen 07.10.2026).
// Angelegt und genehmigt werden Vorlagen bei Meta (WhatsApp Manager) — MAKE OS liest nur. Zwischengespeichert 1 Stunde in
// `whatsapp-zustand` (keine Personendaten); „Neu laden“ holt sofort.

import { graph, graphUrl } from './graph';
import type { WaKonfig } from './konfig';
import { aendereWaZustand, ladeWaZustand } from './spiegel';
import { platzhalter, type Vorlage } from './typen';

const CACHE_MS = 3600_000;
const SEITEN = 5;

interface RohKomponente { type?: string; text?: string; format?: string }
interface RohVorlage { name?: string; language?: string; status?: string; category?: string; components?: RohKomponente[] }
interface RohSeite { data?: RohVorlage[]; paging?: { next?: string } }

const kurz = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, n) : '');

/** Eine Vorlage von Meta → unsere Form (rein). null bei unbrauchbarer Form. */
export function vorlageAus(r: RohVorlage): Vorlage | null {
  const name = kurz(r.name, 512);
  const sprache = kurz(r.language, 20);
  if (!/^[a-z0-9_]{1,512}$/.test(name) || !/^[a-z]{2,3}(_[A-Za-z]{2,4})?$/.test(sprache)) return null;
  const k = Array.isArray(r.components) ? r.components : [];
  const teil = (t: string) => k.find(x => String(x?.type ?? '').toUpperCase() === t);
  const text = kurz(teil('BODY')?.text, 1100);
  const kopf = teil('HEADER');
  const kopfText = kopf && String(kopf.format ?? 'TEXT').toUpperCase() === 'TEXT' ? kurz(kopf.text, 120) : '';
  const fuss = kurz(teil('FOOTER')?.text, 120);
  return {
    name, sprache, status: kurz(r.status, 30).toUpperCase() || 'UNBEKANNT', kategorie: kurz(r.category, 30).toUpperCase() || 'UNBEKANNT',
    text, parameter: platzhalter(text), ...(kopfText ? { kopf: kopfText } : {}), ...(fuss ? { fuss } : {}),
  };
}

/** Die Vorlagen des Kontos (Cache 1 Stunde, `neu` = sofort bei Meta). Wirft `WhatsappFehler`. */
export async function vorlagenLaden(k: WaKonfig, o: { neu?: boolean } = {}, jetzt = Date.now()): Promise<{ liste: Vorlage[]; at: string }> {
  const z = await ladeWaZustand();
  if (!o.neu && z.vorlagen && jetzt - Date.parse(z.vorlagen.at) < CACHE_MS) return z.vorlagen;
  const liste: Vorlage[] = [];
  let seite = await graph<RohSeite>(k, `/${k.wabaId}/message_templates`, { query: { fields: 'name,language,status,category,components', limit: '100' } });
  for (let i = 0; i < SEITEN; i++) {
    for (const r of Array.isArray(seite.data) ? seite.data : []) { const v = vorlageAus(r); if (v) liste.push(v); }
    const next = seite.paging?.next;
    if (!next || i === SEITEN - 1) break;
    seite = await graphUrl<RohSeite>(k, next);
  }
  liste.sort((a, b) => Number(b.status === 'APPROVED') - Number(a.status === 'APPROVED') || a.name.localeCompare(b.name) || a.sprache.localeCompare(b.sprache));
  const at = new Date(jetzt).toISOString();
  await aendereWaZustand(cur => ({ ...cur, vorlagen: { at, liste } }));
  return { liste, at };
}

/** Eine sendbare Vorlage finden (rein): Name + Sprache, Status APPROVED. */
export const sendbareVorlage = (liste: readonly Vorlage[], name: string, sprache: string): Vorlage | null =>
  liste.find(v => v.name === name && v.sprache === sprache && v.status === 'APPROVED') ?? null;
