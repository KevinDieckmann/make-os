// ─── Funde — Startseite eines Betriebs lesen + PageSpeed (nur Server) ───────────────────────────────────────────────────────
// Sicher holen: nur http(s) auf 80/443, jede Station (auch nach Weiterleitung, höchstens 3) über `zielPruefen` (nie Loopback/privat/CGNAT),
// höchstens 512 KB, 8 s, eigener User-Agent, robots.txt „Disallow: /“ für alle → nicht lesen (dann zählt nur HTTPS). Ein Abruf je Fund.
// PageSpeed Insights (Google, kostenlos; Kontingent laut Konsole ~25.000/Tag) nur mit `PAGESPEED_API_KEY` — gesendet wird nur die Adresse der
// Website des Betriebs (Empfänger-Register `google-pagespeed`).

import { zielPruefen } from '@/lib/postfach/transport';
import { seiteAuswerten, type SeitenSignale } from './bewertung';

const UA = 'MAKE-OS-Funde/1.0 (Website-Check)';
const MAX_BYTES = 512 * 1024;

type F = typeof fetch;

async function sicherHolen(url: string, f: F, ms: number): Promise<{ url: string; status: number; text: string } | null> {
  let ziel = url;
  for (let i = 0; i < 4; i++) {
    let u: URL;
    try { u = new URL(ziel); } catch { return null; }
    if (!/^https?:$/.test(u.protocol) || (u.port && u.port !== '80' && u.port !== '443')) return null;
    try { await zielPruefen(u.hostname); } catch { return null; }
    const r = await f(u.toString(), { redirect: 'manual', headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5' }, signal: AbortSignal.timeout(ms) }).catch(() => null);
    if (!r) return null;
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

/** Die Startseite lesen und auswerten. Nicht erreichbar → `{ erreichbar: false … }`. */
export async function seitePruefen(website: string, o: { fetchFn?: F } = {}): Promise<SeitenSignale> {
  const f = o.fetchFn ?? fetch;
  const nichts: SeitenSignale = { erreichbar: false, https: website.startsWith('https://'), mobil: false, alteTechnik: false, impressum: false };
  try {
    const robots = await sicherHolen(new URL('/robots.txt', website).toString(), f, 5000);
    if (robots && robots.status === 200 && robotsVerbietet(robots.text.slice(0, 20_000))) {
      // Nicht lesen — nur, ob die Seite sicher ausgeliefert wird (ohne Inhalt keine weiteren Aussagen).
      return { erreichbar: true, https: website.startsWith('https://'), mobil: true, alteTechnik: false, impressum: true };
    }
    const r = await sicherHolen(website, f, 8000);
    if (!r || r.status >= 400) return nichts;
    return seiteAuswerten(r.text, r.url);
  } catch { return nichts; }
}

/** PageSpeed-Mobilwert 0–100 oder null (ohne Schlüssel, Fehler, Zeitüberschreitung). */
export async function pagespeed(website: string, o: { fetchFn?: F } = {}): Promise<number | null> {
  const key = (process.env.PAGESPEED_API_KEY ?? '').trim();
  if (!key) return null;
  const f = o.fetchFn ?? fetch;
  const q = new URLSearchParams({ url: website, strategy: 'mobile', category: 'performance', key });
  try {
    const r = await f(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const j = await r.json() as { lighthouseResult?: { categories?: { performance?: { score?: number } } } };
    const s = j.lighthouseResult?.categories?.performance?.score;
    return typeof s === 'number' ? Math.round(s * 100) : null;
  } catch { return null; }
}
