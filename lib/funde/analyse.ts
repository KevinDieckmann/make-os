// ─── Funde — Website-Analyse gegen unser Niveau (rein, getestet; 31.10.2026, Kevin: „saubere Analysen über die, die eine Homepage haben,
// die aber maximal unter dem Niveau ist, was wir anbieten“) ──────────────────────────────────────────────────────────────────────────────
// Maßstab = das, was unser Einstiegspaket verspricht (Website › Homepage Landing): in 5 Sekunden verständlich, mit einem Klick anfragen, Handy,
// Ladezeit, Suche (inkl. strukturierte Daten), Impressum/Datenschutz, ohne Tracking und fremde Dienste. Für Gastronomie dazu, was Gäste suchen:
// Speisekarte (als Seite, nicht nur PDF), Öffnungszeiten, Reservierung, Telefon zum Antippen, Adresse/Karte.
// Gemessen nur, was die Startseite selbst zeigt (ohne KI); Ladezeit und Design kommen von außen dazu (Chrome-Messung bzw. PageSpeed, Blick auf den
// Handy-Screenshot) und sind optional. Ergebnis: Niveau 0–100 (100 = unser Standard), Lücken in ganzen Sätzen und Gesprächsaufhänger.

export interface AnalyseMerkmale {
  https: boolean; mobil: boolean;
  titel: boolean; beschreibung: boolean; h1: boolean; strukturierteDaten: boolean; vorschaubild: boolean;
  speisekarte: boolean; speisekarteNurPdf: boolean; oeffnungszeiten: boolean; reservierung: boolean; telefonKlickbar: boolean; adresseKarte: boolean; instagram: boolean;
  impressum: boolean; datenschutz: boolean; googleFontsExtern: boolean; tracker: boolean;
  baukasten?: string; jahr?: number; alteTechnik: boolean;
}

export interface LeistungMessung { lcpMs?: number; gewichtKb?: number; anfragen?: number; cls?: number; quelle: 'chrome' | 'pagespeed' }
export interface AnalyseErgebnis {
  niveau: number;
  teile: { technik: number; gaeste: number; auffindbar: number; recht: number };
  design?: number;
  luecken: string[];
  aufhaenger: string[];
  gemessenAm: string;
}

const hat = (h: string, re: RegExp) => re.test(h);

/** Merkmale aus dem HTML der Startseite (+ tatsächliche Adresse). Rein. */
export function merkmaleAus(html: string, url: string): AnalyseMerkmale {
  const h = html.slice(0, 1_500_000);
  const text = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const titel = /<title[^>]*>([^<]{10,90})<\/title>/i.exec(h);
  const gen = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']{2,60})["']/i.exec(h)?.[1];
  const baukasten = gen ?? (hat(h, /wix\.com|wixstatic/i) ? 'Wix' : hat(h, /jimdo/i) ? 'Jimdo' : hat(h, /squarespace/i) ? 'Squarespace' : hat(h, /webnode/i) ? 'Webnode' : hat(h, /mywebsite|ionos|1and1/i) ? 'IONOS-Baukasten' : undefined);
  const jahre = [...h.matchAll(/(?:©|&copy;|&#169;|copyright)[^<]{0,40}?((?:19|20)\d{2})(?:\s*[-–]\s*((?:19|20)\d{2}))?/gi)].flatMap(m => [m[1], m[2]].filter(Boolean).map(Number));
  const pdfKarte = hat(h, /href=["'][^"']*(?:speisekarte|karte|menu|menü)[^"']*\.pdf/i);
  const karteSeite = hat(h, /href=["'][^"']*(?:speisekarte|menu|menue|karte|food|drinks|getraenke)(?:[/"'?#]|\.html)/i) || hat(text, /\b(Vorspeisen|Hauptgerichte|Hauptspeisen|Desserts|Frühstück|Getränke|Antipasti|Pasta|Pizza)\b[\s\S]{0,400}\d+[,.]\d{2}\s?(€|EUR)/i);
  return {
    https: url.toLowerCase().startsWith('https://'),
    mobil: hat(h, /<meta[^>]+name\s*=\s*["']?viewport/i),
    titel: !!titel, beschreibung: hat(h, /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{40,}/i), h1: hat(h, /<h1[\s>]/i),
    strukturierteDaten: hat(h, /application\/ld\+json[\s\S]{0,4000}?(Restaurant|CafeOrCoffeeShop|FoodEstablishment|LocalBusiness|BarOrPub)/i),
    vorschaubild: hat(h, /property=["']og:image["']/i),
    speisekarte: karteSeite || pdfKarte, speisekarteNurPdf: pdfKarte && !karteSeite,
    oeffnungszeiten: hat(text, /(Mo|Di|Mi|Do|Fr|Sa|So|Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)[^0-9]{0,25}\d{1,2}([:.]\d{2})?\s*(Uhr)?\s*[-–bis]+\s*\d{1,2}/i) || hat(h, /openingHours/i),
    reservierung: hat(h, /opentable|quandoo|resmio|thefork|bookatable|formitable|tablein|aleno|guestu|reservierung|reservieren|tisch buchen|book a table|reservation/i),
    telefonKlickbar: hat(h, /href=["']tel:/i),
    adresseKarte: hat(h, /maps\.google|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo|openstreetmap|apple\.com\/maps/i) || hat(text, /\b1[0-4]\d{3}\s+Berlin\b/),
    instagram: hat(h, /instagram\.com\//i),
    impressum: hat(h, /impressum|imprint/i), datenschutz: hat(h, /datenschutz|privacy/i),
    googleFontsExtern: hat(h, /fonts\.googleapis\.com|fonts\.gstatic\.com/i),
    tracker: hat(h, /googletagmanager|google-analytics|gtag\(|fbq\(|connect\.facebook\.net|hotjar/i),
    ...(baukasten ? { baukasten } : {}), ...(jahre.length ? { jahr: Math.max(...jahre) } : {}),
    alteTechnik: hat(h, /<font[\s>]|<center[\s>]|<marquee|<frameset|\.swf["'?]|jquery[-.]1\.[0-7]\b|<table[^>]+(?:bgcolor|background)=/i),
  };
}

/** Punkte für die Ladezeit am Handy (LCP): ≤ 2,5 s voll, bis 4 s halb, darüber nichts. Ohne Messung: neutral (zählt nicht). */
function ladePunkte(l?: LeistungMessung): number | null {
  if (!l || typeof l.lcpMs !== 'number') return null;
  return l.lcpMs <= 2500 ? 1 : l.lcpMs <= 4000 ? 0.5 : 0;
}

/**
 * Niveau 0–100 gegen unseren Standard. Teile: Technik 35 (HTTPS 8 · Handy 10 · Ladezeit 17), Gäste 35 (Speisekarte 8 · Öffnungszeiten 7 · Reservierung 7 ·
 * Telefon zum Antippen 5 · Adresse/Karte 4 · Instagram 4), Auffindbarkeit 15 (Titel 4 · Beschreibung 4 · strukturierte Daten 4 · Vorschaubild 3), Recht & Vertrauen
 * 15 (Impressum 5 · Datenschutz 5 · keine externen Google Fonts/Tracker 5). Ohne Ladezeit-Messung wird die Technik auf 18 Punkte hochgerechnet. Design (1–5, optional)
 * fließt mit 30 % ein. Rein.
 */
export function niveauBerechnen(m: AnalyseMerkmale, o: { leistung?: LeistungMessung; design?: number; jahrHeute: number; gemessenAm: string }): AnalyseErgebnis {
  const lp = ladePunkte(o.leistung);
  const techRoh = (m.https ? 8 : 0) + (m.mobil ? 10 : 0) + (lp == null ? 0 : lp * 17);
  const technik = lp == null ? Math.round((techRoh / 18) * 35) : Math.round(techRoh);
  const gaeste = (m.speisekarte ? (m.speisekarteNurPdf ? 4 : 8) : 0) + (m.oeffnungszeiten ? 7 : 0) + (m.reservierung ? 7 : 0) + (m.telefonKlickbar ? 5 : 0) + (m.adresseKarte ? 4 : 0) + (m.instagram ? 4 : 0);
  const auffindbar = (m.titel ? 4 : 0) + (m.beschreibung ? 4 : 0) + (m.strukturierteDaten ? 4 : 0) + (m.vorschaubild ? 3 : 0);
  const recht = (m.impressum ? 5 : 0) + (m.datenschutz ? 5 : 0) + (!m.googleFontsExtern && !m.tracker ? 5 : 0);
  let niveau = technik + gaeste + auffindbar + recht;
  if (m.alteTechnik) niveau -= 5;
  if (m.jahr && o.jahrHeute - m.jahr >= 4) niveau -= 5;
  const d = typeof o.design === 'number' && o.design >= 1 && o.design <= 5 ? Math.round(o.design) : undefined;
  if (d) niveau = 0.7 * niveau + 0.3 * ((d - 1) / 4) * 100;
  niveau = Math.max(0, Math.min(100, Math.round(niveau)));

  // Lücken (in der Reihenfolge, wie sehr sie Gäste kosten) und die drei stärksten als Gesprächsaufhänger.
  const l: { satz: string; aufhaenger: string; gewicht: number }[] = [];
  const add = (b: boolean, gewicht: number, satz: string, aufhaenger: string) => { if (b) l.push({ satz, aufhaenger, gewicht }); };
  add(!m.mobil, 10, 'Nicht für Handys eingerichtet.', 'Die meisten Gäste suchen am Handy — dort ist die Seite schwer zu lesen.');
  add(lp === 0, 9, `Lädt am Handy sehr langsam (${Math.round((o.leistung?.lcpMs ?? 0) / 100) / 10} s bis der Inhalt steht).`, `Am Handy dauert es ${Math.round((o.leistung?.lcpMs ?? 0) / 1000)} Sekunden, bis man etwas sieht — viele springen vorher ab.`);
  add(lp === 0.5, 4, `Lädt am Handy eher langsam (${Math.round((o.leistung?.lcpMs ?? 0) / 100) / 10} s).`, 'Die Seite lädt am Handy spürbar langsam.');
  add(!m.https, 8, 'Keine sichere Verbindung (HTTPS) — Browser zeigen „nicht sicher“.', 'Ihr Browser zeigt bei der Seite „nicht sicher“ an — das schreckt Gäste ab.');
  add(!m.speisekarte, 8, 'Keine Speisekarte auf der Seite.', 'Gäste finden auf der Seite keine Speisekarte — genau die suchen sie zuerst.');
  add(m.speisekarteNurPdf, 5, 'Speisekarte nur als PDF (am Handy mühsam, für Google unsichtbar).', 'Die Speisekarte ist nur ein PDF — am Handy zoomt man sich durch, Google liest sie nicht.');
  add(!m.reservierung, 6, 'Keine Möglichkeit, online zu reservieren oder anzufragen.', 'Man kann auf der Seite nicht reservieren — Gäste müssen anrufen oder gehen woandershin.');
  add(!m.oeffnungszeiten, 6, 'Öffnungszeiten nicht auf der Startseite.', 'Die Öffnungszeiten stehen nicht auf der Startseite.');
  add(!m.telefonKlickbar, 4, 'Telefonnummer nicht antippbar.', 'Am Handy kann man die Nummer nicht einfach antippen.');
  add(!m.strukturierteDaten, 3, 'Keine strukturierten Daten für Google und KI-Suchen.', 'Google und KI-Suchen erkennen die Seite nicht als Restaurant mit Zeiten und Karte.');
  add(!m.beschreibung || !m.titel, 3, 'Titel/Beschreibung für Suchmaschinen fehlen.', 'In den Suchergebnissen erscheint keine ordentliche Beschreibung.');
  add(m.googleFontsExtern, 4, 'Lädt Google Fonts von Google-Servern (Datenschutz-Risiko, Abmahnungen bekannt).', 'Die Seite lädt Schriften direkt bei Google — dafür gab es schon Abmahnungen.');
  add(m.tracker, 2, 'Bindet Tracking-Dienste ein.', 'Auf der Seite laufen Tracking-Dienste — wir bauen ohne.');
  add(!m.impressum || !m.datenschutz, 5, 'Impressum oder Datenschutzerklärung nicht verlinkt.', 'Impressum bzw. Datenschutz sind nicht zu finden — das ist Pflicht.');
  add(!!m.jahr && o.jahrHeute - m.jahr >= 4, 3, `Vermutlich seit ${m.jahr} nicht gepflegt.`, `Auf der Seite steht noch ${m.jahr} — sie wirkt nicht gepflegt.`);
  add(m.alteTechnik, 3, 'Veraltete Technik im Aufbau.', 'Die Technik der Seite ist veraltet.');
  add(!!d && d <= 2, 9, 'Gestaltung wirkt veraltet bzw. unruhig (Blick auf die Handy-Ansicht).', 'Optisch wirkt die Seite in die Jahre gekommen — das passt nicht zu Ihrem Laden.');
  l.sort((a, b) => b.gewicht - a.gewicht);
  return { niveau, teile: { technik, gaeste, auffindbar, recht }, ...(d ? { design: d } : {}), luecken: l.map(x => x.satz), aufhaenger: l.slice(0, 3).map(x => x.aufhaenger), gemessenAm: o.gemessenAm };
}

/** „Deutlich unter unserem Niveau“: Niveau < 55 oder Design ≤ 2. */
export const UNTER_NIVEAU = 55;
export const unterNiveau = (a: Pick<AnalyseErgebnis, 'niveau' | 'design'>): boolean => a.niveau < UNTER_NIVEAU || (a.design != null && a.design <= 2);
