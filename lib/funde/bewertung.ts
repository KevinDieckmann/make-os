// ─── Funde — „Wie schlecht ist die Website?“ (rein, getestet; KAMPAGNE_HOMEPAGE_PLAN.md › 0) ─────────────────────────────────
// Ohne KI gerechnet aus messbaren Merkmalen: keine Website · nicht erreichbar · kein HTTPS · nicht mobil (Viewport fehlt) · PageSpeed-Mobilwert ·
// veraltet (Copyright-Jahr, alte Technik) · kein Impressum. Ergebnis: Bedarf 0–100 (hoch = schlecht) + Gründe in ganzen Sätzen.
// Gelesen wird nur das HTML der Startseite (lib/funde/web.ts holt es) — nichts davon landet in der Vorschau (Urheberrecht).

import type { FundBewertung } from './typen';

export interface SeitenSignale {
  erreichbar: boolean;
  https: boolean;
  mobil: boolean;
  jahr?: number;
  alteTechnik: boolean;
  impressum: boolean;
  /** Die geschäftliche Adresse, die der Betrieb selbst auf der Startseite angibt (erster `mailto:`), sonst fehlt sie. */
  email?: string;
  /** Warum nicht erreichbar: Domain weg · Zertifikat ungültig · keine Verbindung · Fehlerseite (4xx/5xx). */
  fehler?: 'dns' | 'zertifikat' | 'verbindung' | 'status';
  /** Die Seite weist automatische Abrufe ab (401/403/429) — nicht prüfbar, also KEIN Mangel. */
  blockiert?: boolean;
}

const FEHLER_GRUND: Record<NonNullable<SeitenSignale['fehler']>, string> = {
  dns: 'Die Adresse der Website führt ins Leere — die Domain gibt es nicht (mehr).',
  zertifikat: 'Das Sicherheitszertifikat der Website ist ungültig — Browser zeigen Besuchern eine Warnung.',
  verbindung: 'Die angegebene Website ist nicht erreichbar.',
  status: 'Die angegebene Website zeigt nur eine Fehlerseite.',
};

/** Erste veröffentlichte Mail-Adresse (`mailto:`) — keine Plattform-/Platzhalter-Adressen. */
export function mailAusHtml(html: string): string | undefined {
  for (const m of html.slice(0, 600_000).matchAll(/mailto:([^"'?\s>]+)/gi)) {
    let a = m[1];
    try { a = decodeURIComponent(a); } catch { /* wie gelesen */ }
    a = a.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(a) && a.length <= 160 && !/(@example\.(com|org|net|de)$|sentry|wixpress|@domain\.|ihre-?mail|^name@)/.test(a)) return a;
  }
  return undefined;
}

/** Merkmale aus dem HTML der Startseite. `url` = die tatsächlich geladene Adresse (nach Weiterleitungen). */
export function seiteAuswerten(html: string, url: string): SeitenSignale {
  const h = html.slice(0, 600_000);
  const mobil = /<meta[^>]+name\s*=\s*["']?viewport["']?[^>]*>/i.test(h);
  // Jahr: „© 2017“, „Copyright 2015–2019“, „(c) 2014“ — das jüngste Jahr in der Nähe des Zeichens.
  const jahre: number[] = [];
  for (const m of h.matchAll(/(?:©|&copy;|&#169;|copyright|\(c\))[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)) {
    for (const j of [m[1], m[2]]) if (j) jahre.push(Number(j));
  }
  const alteTechnik = /<font[\s>]|<center[\s>]|<marquee|<frameset|\.swf["'?]|<table[^>]+(?:bgcolor|background)=|jquery[-.]1\.[0-7]\b|<blink/i.test(h);
  const impressum = /impressum|imprint|anbieterkennzeichnung/i.test(h);
  const email = mailAusHtml(h);
  return { erreichbar: true, https: url.toLowerCase().startsWith('https://'), mobil, ...(jahre.length ? { jahr: Math.max(...jahre) } : {}), alteTechnik, impressum, ...(email ? { email } : {}) };
}

/**
 * Bedarf aus den Signalen. Ohne Website = 100. Sonst Summe der Mängel (gedeckelt bei 100):
 * nicht erreichbar 90 · kein HTTPS 25 · nicht mobil 25 · PageSpeed < 30: 30, < 50: 20, < 70: 10 · Jahr ≥ 4 Jahre alt 15 · alte Technik 10 · ohne Impressum 5.
 */
export function bewerten(o: { website: boolean; signale?: SeitenSignale | null; pagespeed?: number | null; jahrHeute: number; gemessenAm: string }): FundBewertung {
  const basis = { gemessenAm: o.gemessenAm };
  if (!o.website) return { ...basis, punkte: 100, website: false, gruende: ['Keine eigene Website gefunden.'] };
  const s = o.signale;
  if (s?.blockiert) return { ...basis, punkte: 0, website: true, erreichbar: true, gruende: ['Die Seite lässt keine automatische Prüfung zu — bei Bedarf von Hand ansehen.'] };
  if (!s || !s.erreichbar) return { ...basis, punkte: 90, website: true, erreichbar: false, gruende: [FEHLER_GRUND[s?.fehler ?? 'verbindung']] };
  let p = 0;
  const g: string[] = [];
  if (!s.https) { p += 25; g.push('Keine sichere Verbindung (kein HTTPS) — Browser warnen Besucher.'); }
  if (!s.mobil) { p += 25; g.push('Nicht für Smartphones eingerichtet (kein Viewport).'); }
  const ps = typeof o.pagespeed === 'number' && Number.isFinite(o.pagespeed) ? Math.round(Math.min(100, Math.max(0, o.pagespeed))) : undefined;
  if (ps != null) {
    if (ps < 30) { p += 30; g.push(`Sehr langsam auf dem Handy (PageSpeed ${ps} von 100).`); }
    else if (ps < 50) { p += 20; g.push(`Langsam auf dem Handy (PageSpeed ${ps} von 100).`); }
    else if (ps < 70) { p += 10; g.push(`Mittelmäßig schnell auf dem Handy (PageSpeed ${ps} von 100).`); }
  }
  if (s.jahr && o.jahrHeute - s.jahr >= 4) { p += 15; g.push(`Vermutlich lange nicht gepflegt (Copyright ${s.jahr}).`); }
  if (s.alteTechnik) { p += 10; g.push('Veraltete Technik im Aufbau der Seite.'); }
  if (!s.impressum) { p += 5; g.push('Kein Impressum auf der Startseite verlinkt.'); }
  if (!g.length) g.push('Keine deutlichen Mängel gemessen.');
  return {
    ...basis, punkte: Math.min(100, p), website: true, erreichbar: true, https: s.https, mobil: s.mobil,
    ...(ps != null ? { pagespeed: ps } : {}), ...(s.jahr ? { jahr: s.jahr } : {}), impressum: s.impressum, gruende: g,
  };
}

/** Eine Website-Angabe säubern: nur http(s), ohne Leerzeichen; ohne Schema → https://. Sonst null. */
export function websiteNormal(roh: string | undefined | null): string | null {
  const t = String(roh ?? '').trim().split(/[\s;]+/)[0] ?? '';
  if (!t) return null;
  const mit = /^https?:\/\//i.test(t) ? t : /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(t) ? `https://${t}` : '';
  try {
    const u = new URL(mit);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.') || (u.port && u.port !== '80' && u.port !== '443')) return null;
    return u.toString();
  } catch { return null; }
}

/**
 * Zeigt die Angabe auf eine tiefe Unterseite (z. B. `hotel.example/standorte/berlin/restaurant`)? Dann gehört der Betrieb zu einem Haus mit
 * eigener Website (Hotel, Museum, Kette) — keine Persona „inhabergeführt“, kein Fund. Rein.
 */
export function fremdeUnterseite(url: string | null): boolean {
  if (!url) return false;
  try { return new URL(url).pathname.split('/').filter(Boolean).length >= 2; } catch { return false; }
}

/** Seiten großer Plattformen sind keine eigene Website (Facebook, Instagram, Lieferdienste …) — sie zählen als „keine Website“. */
const FREMDE_PLATTFORMEN = /(^|\.)(facebook\.com|instagram\.com|fb\.com|lieferando\.de|wolt\.com|ubereats\.com|tripadvisor\.[a-z.]+|yelp\.[a-z.]+|google\.[a-z.]+|linktr\.ee|treatwell\.de|booksy\.com)$/i;
export function eigeneWebsite(url: string | null): boolean {
  if (!url) return false;
  try { return !FREMDE_PLATTFORMEN.test(new URL(url).hostname); } catch { return false; }
}
