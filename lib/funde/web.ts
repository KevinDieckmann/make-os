// ─── Funde — Startseite eines Betriebs lesen + PageSpeed (nur Server) ───────────────────────────────────────────────────────
// Sicher holen: nur http(s) auf 80/443, jede Station (auch nach Weiterleitung, höchstens 3) über `zielOk` (nie Loopback/privat/CGNAT; NAT64 nach eingebetteter IPv4),
// höchstens 512 KB, 8 s, eigener User-Agent, robots.txt „Disallow: /“ für alle → nicht lesen (dann zählt nur HTTPS). Ein Abruf je Fund.
// PageSpeed Insights (Google, kostenlos; Kontingent laut Konsole ~25.000/Tag) nur mit `PAGESPEED_API_KEY` — gesendet wird nur die Adresse der
// Website des Betriebs (Empfänger-Register `google-pagespeed`).

import { lookup } from 'node:dns/promises';
import { ipIntern } from '@/lib/netz/oeffentlich';
import { merkmaleAus, type AnalyseMerkmale } from './analyse';
import { seiteAuswerten, seitePasstZumNamen, type SeitenSignale } from './bewertung';

const UA = 'MAKE-OS-Funde/1.0 (Website-Check)';
const MAX_BYTES = 512 * 1024;

type F = typeof fetch;

/**
 * Wie `ipIntern` (lib/netz/oeffentlich.ts), aber eine Adresse im NAT64-Präfix `64:ff9b::/96` (DNS64-Netze, z. B. am Mac) zählt nach der darin
 * eingebetteten IPv4 — die gemeinsame Regel lehnt NAT64 pauschal ab, „weil es auf interne IPv4 zeigen könnte“; genau das prüfen wir hier. Rein.
 */
export function adresseIntern(ip: string): boolean {
  const x = ip.toLowerCase().trim();
  const m = /^64:ff9b::(?:(\d{1,3}(?:\.\d{1,3}){3})|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(x);
  if (m) {
    if (m[1]) return ipIntern(m[1]);
    const h = parseInt(m[2], 16), l = parseInt(m[3], 16);
    return ipIntern(`${h >> 8}.${h & 255}.${l >> 8}.${l & 255}`);
  }
  return ipIntern(x);
}

/** Löst den Namen auf; IRGENDEINE interne Adresse → nein (fail-closed, auch ohne Antwort). */
async function zielOk(host: string): Promise<boolean> {
  try {
    const a = await lookup(host, { all: true });
    return a.length > 0 && !a.some(x => adresseIntern(x.address));
  } catch { return false; }
}

type Holfehler = { fehler: NonNullable<SeitenSignale['fehler']> };
/** Netzfehler einordnen: Domain weg · Zertifikat kaputt · sonst keine Verbindung. Rein. */
export function fehlerArt(e: unknown): Holfehler['fehler'] {
  const c = String((e as { cause?: { code?: string } })?.cause?.code ?? (e as { code?: string })?.code ?? '');
  if (c === 'ENOTFOUND' || c === 'EAI_AGAIN') return 'dns';
  if (/CERT|SSL|TLS|SELF_SIGNED|LEAF_SIGNATURE|ALTNAME/.test(c)) return 'zertifikat';
  return 'verbindung';
}

async function sicherHolen(url: string, f: F, ms: number): Promise<{ url: string; status: number; text: string } | Holfehler | null> {
  let ziel = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(ziel); } catch { return null; }
    if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== '80' && u.port !== '443')) return null;
    if (!(await zielOk(u.hostname))) {
      // Name ohne Antwort = Domain weg; eine interne Adresse bleibt „nichts“ (nie ein Hinweis darauf, was dahinter liegt).
      try { await lookup(u.hostname); } catch (e) { return { fehler: fehlerArt(e) }; }
      return null;
    }
    let r: Response;
    try { r = await f(u.toString(), { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, signal: AbortSignal.timeout(ms) }); }
    catch (e) { return { fehler: fehlerArt(e) }; }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { ziel = new URL(r.headers.get('location') as string, u).toString(); continue; }
    const reader = r.body?.getReader();
    let n = 0;
    const teile: Uint8Array[] = [];
    if (reader) {
      while (n < MAX_BYTES) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done || !value) break;
        teile.push(value); n += value.length;
      }
      await reader.cancel().catch(() => { /* fertig */ });
    }
    const buf = new Uint8Array(Math.min(n, MAX_BYTES));
    let o = 0;
    for (const t of teile) { const s = t.subarray(0, Math.max(0, buf.length - o)); buf.set(s, o); o += s.length; }
    return { url: u.toString(), status: r.status, text: new TextDecoder('utf-8', { fatal: false }).decode(buf) };
  }
  return null;
}

/** robots.txt: verbietet „User-agent: *“ die ganze Seite? (Nur diese eine, häufige Regel — der Rest bleibt unberührt.) */
export function robotsVerbietet(txt: string): boolean {
  let fuerAlle = false;
  for (const zeile of txt.split(/\r?\n/)) {
    const z = zeile.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(z);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') fuerAlle = v === '*';
    else if (k === 'disallow' && fuerAlle && v === '/') return true;
  }
  return false;
}

/** Die Startseite lesen und auswerten. Nicht erreichbar → `{ erreichbar: false, fehler }`; Bot-Sperre (401/403/429) → `blockiert` (kein Mangel). */
export async function seitePruefen(website: string, o: { fetchFn?: F; merkmale?: (m: AnalyseMerkmale) => void; name?: string } = {}): Promise<SeitenSignale> {
  const f = o.fetchFn ?? fetch;
  const nichts: SeitenSignale = { erreichbar: false, https: website.startsWith('https://'), mobil: false, alteTechnik: false, impressum: false };
  try {
    const robots = await sicherHolen(new URL('/robots.txt', website).toString(), f, 5000);
    if (robots && 'status' in robots && robots.status === 200 && robotsVerbietet(robots.text.slice(0, 20_000))) {
      // Nicht lesen — nur, ob die Seite sicher ausgeliefert wird (ohne Inhalt keine weiteren Aussagen).
      return { erreichbar: true, https: website.startsWith('https://'), mobil: true, alteTechnik: false, impressum: true };
    }
    const r = await sicherHolen(website, f, 8000);
    if (!r) return nichts;
    if ('fehler' in r) return { ...nichts, fehler: r.fehler };
    // 401/403/429: die Seite weist automatische Abrufe ab — das ist KEIN Mangel (nicht prüfbar, kein Fund).
    if (r.status === 401 || r.status === 403 || r.status === 429) return { ...nichts, erreichbar: true, blockiert: true };
    if (r.status >= 400) return { ...nichts, fehler: 'status' };
    // Gehört die Seite überhaupt zum Betrieb? Sonst kein Fund (31.10.) — und keine Analyse einer fremden Seite.
    if (o.name && !seitePasstZumNamen(r.text, r.url, o.name)) return { ...nichts, erreichbar: true, fremd: true };
    // Dieselbe Seite zusätzlich für die Niveau-Analyse (lib/funde/analyse.ts) — kein zweiter Abruf.
    o.merkmale?.(merkmaleAus(r.text, r.url));
    return seiteAuswerten(r.text, r.url);
  } catch { return nichts; }
}

/** PageSpeed-Mobilwert 0–100 oder null (ohne Schlüssel, Fehler, Zeitüberschreitung). `lcp` erhält die gemessene LCP-Zeit (ms), wenn vorhanden. */
export async function pagespeed(website: string, o: { fetchFn?: F; lcp?: (ms: number) => void } = {}): Promise<number | null> {
  const key = (process.env.PAGESPEED_API_KEY ?? '').trim();
  if (!key) return null;
  const f = o.fetchFn ?? fetch;
  const q = new URLSearchParams({ url: website, strategy: 'mobile', category: 'performance', key });
  try {
    const r = await f(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const j = await r.json() as { lighthouseResult?: { categories?: { performance?: { score?: number } }; audits?: Record<string, { numericValue?: number }> } };
    const lcp = j.lighthouseResult?.audits?.['largest-contentful-paint']?.numericValue;
    if (typeof lcp === 'number') o.lcp?.(Math.round(lcp));
    const s = j.lighthouseResult?.categories?.performance?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  } catch { return null; }
}
