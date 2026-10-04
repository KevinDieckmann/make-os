// ─── Landingpage makeinnovation.de: Freigabe-Prüfung (01.10., v3: Markttraktion, Make.One, Beteiligungen) ───────
// website/pruefen.mjs entscheidet, ob die Seite online darf. Hier wird geprüft, dass der Prüfer selbst stimmt:
// Bau-Regeln heute grün (nur die Platzhalter halten die Freigabe auf), Platzhalter und Regelbrüche werden erkannt.
// Ob heute noch Platzhalter offen sind, prüft dieser Test bewusst NICHT — das ist Kevins Freigabe, kein Fehler.
import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeWebsite, ANMELDEN, NICHT_OEFFENTLICH, VERSTECKT, LOGO_DATEIEN, ANGEBOTE, BUCHUNG_MUSTER, ERSTGESPRAECH_MAIL, MAIL_BETREFFE, QUELLEN_LINKS, NAVIGATION, STAEDTE, FOKUS_SEITE, GEWICHT_GRENZE, STEMPEL_VERWEIS, stempelVon, stempeln } from '../website/pruefen.mjs';
import vm from 'node:vm';

const ORDNER = join(process.cwd(), 'website');
const kopien: string[] = [];
function kopie(): string {
  const ziel = mkdtempSync(join(tmpdir(), 'make-website-'));
  cpSync(ORDNER, ziel, { recursive: true });
  kopien.push(ziel);
  return ziel;
}
function ersetze(ordner: string, datei: string, von: RegExp | string, nach: string) {
  const p = join(ordner, datei);
  writeFileSync(p, readFileSync(p, 'utf8').replace(von, nach));
}
/** Ein gültiger Buchungs-Slug (Form wie SLUG in lib/kalender/buchung.ts) — für die spätere Umstellung. */
const SLUG = 'erstgespraech-0123456789abcdef01234567';
/** Alle Platzhalter samt gelber Markierung durch Text ersetzen — so, wie Kevin sie füllt. */
function fuellen(ordner: string) {
  for (const d of readdirSync(ordner).filter(n => n.endsWith('.html'))) ersetze(ordner, d, /<span class="ph">\[\[KEVIN:[^\]]*\]\]<\/span>/g, 'Beispielwert');
}
afterAll(() => { for (const k of kopien) rmSync(k, { recursive: true, force: true }); });

describe('website/pruefen.mjs', () => {
  it('Bau-Regeln sind heute erfüllt (nur Platzhalter dürfen offen sein)', () => {
    const { fehler } = pruefeWebsite(ORDNER);
    expect(fehler, fehler.join('\n')).toEqual([]);
  });

  it('jeder Platzhalter blockiert die Freigabe — gefüllt wird sie grün', () => {
    const k = kopie();
    fuellen(k);
    expect(pruefeWebsite(k)).toEqual({ fehler: [], platzhalter: [], freigabefaehig: true });
    ersetze(k, 'datenschutz.html', 'abgesichert. Beispielwert', 'abgesichert. [[KEVIN: Anbieter]]');
    const r = pruefeWebsite(k);
    expect(r.freigabefaehig).toBe(false);
    expect(r.platzhalter).toEqual([expect.objectContaining({ datei: 'datenschutz.html', text: 'Anbieter' })]);
  });

  it('gelbe Markierung ohne Platzhalter darin fällt auf', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'datenschutz.html', 'abgesichert. Beispielwert', 'abgesichert. <span class="ph">Anbieter</span>');
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/gelbe Platzhalter-Markierung/);
  });

  it('Logo-Dateien sind da, die Bühne zeichnet dieselbe Wortmarke, Kopf und Favicons zeigen darauf', () => {
    for (const d of LOGO_DATEIEN) expect(existsSync(join(ORDNER, d)), d).toBe(true);
    const k = kopie();
    fuellen(k);
    // Ein anderer Strich in der Bühne fällt genauso auf wie ein anderer Buchstabe.
    ersetze(k, 'index.html', /(<svg class="zeichen"[\s\S]*?<rect class="strich strich-ke") x="[\d.]+"/, '$1 x="190"');
    rmSync(join(k, 'assets/logo/kompakt.svg'));
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Bühnen-Zeichen weicht von assets\/logo\/wortmarke\.svg ab/);
    expect(f).toMatch(/srcset assets\/logo\/kompakt\.svg — Datei fehlt/);
    expect(f).toMatch(/assets\/logo\/kompakt\.svg: fehlt/);
  });

  it('Angebote: Interim CSO, Interim Head of Sales, Events gleichwertig mit „Erstgespräch anfragen“, genau ein „Coming Soon“', () => {
    expect(ANGEBOTE).toEqual({ 'angebot-interim-cso': 'aktiv', 'angebot-head-of-sales': 'aktiv', 'angebot-events': 'aktiv', 'angebot-development': 'bald' });
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index.match(/Coming Soon/g)).toHaveLength(1);
    expect(index).toContain('href="mailto:hello@makeinnovation.de?subject=Make.One%20%E2%80%93%20Einladung"');
    expect(index).toContain('href="mailto:hello@makeinnovation.de?subject=Make.Beteiligungen%20%E2%80%93%20Projekt"');
    expect(Object.keys(MAIL_BETREFFE)).toEqual(['Make.One – Einladung', 'Make.Beteiligungen – Projekt']);
    const k = kopie();
    fuellen(k);
    // Ein Angebot ohne Termin-Knopf, ein zweites „Coming Soon“, ein fehlender Beteiligungen-Knopf und ein Preis fallen auf.
    ersetze(k, 'index.html', /(<article[^>]*id="angebot-events"[\s\S]*?)<a class="knopf" href="#erstgespraech" data-erstgespraech>Erstgespräch anfragen<\/a>/, '$1');
    ersetze(k, 'index.html', '<span class="rolle">Sales-Aufbau auf Zeit</span>', '<span class="abzeichen bald">Coming Soon</span>');
    ersetze(k, 'index.html', 'subject=Make.Beteiligungen%20%E2%80%93%20Projekt', 'subject=Projekt');
    ersetze(k, 'index.html', '<li>Laufzeit 6–12 Monate</li>', '<li>Laufzeit 6–12 Monate, ab 1.500 € pro Tag</li>');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/#angebot-events — Knopf „Erstgespräch anfragen“/);
    expect(f).toMatch(/2 × „Coming Soon“/);
    expect(f).toMatch(/Mail-Knopf „Make\.Beteiligungen – Projekt“ fehlt/);
    expect(f).toMatch(/keine Preise/);
  });

  it('Erstgespräch: das Ziel steht an genau einer Stelle — heute vorbereitete Mail, später mit einer Zeile die Buchungsseite', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const ziel = /<a\b[^>]*id="erstgespraech-link" href="([^"]+)"/.exec(index)?.[1] ?? '';
    expect(ziel).toMatch(ERSTGESPRAECH_MAIL);
    expect(ziel).toContain('Firma%3A%0AWorum%20es%20geht%3A%0A2%E2%80%933%20Terminvorschl%C3%A4ge');
    expect(index.match(/subject=Erstgespr%C3%A4ch/g)).toHaveLength(1);
    expect(index).not.toContain('app.makeinnovation.de/buchen');
    expect((index.match(/data-erstgespraech/g) ?? []).length).toBeGreaterThanOrEqual(5);
    // js/erstgespraech.js übernimmt Mail oder (später) gültige Buchungsseite — sonst nichts.
    const skript = readFileSync(join(ORDNER, 'js/erstgespraech.js'), 'utf8');
    const muster = Array.from(skript.matchAll(/\/(\^(?:mailto|https):.*?)\/\.test/g), m => new RegExp(m[1]));
    const passt = (url: string) => muster.some(m => m.test(url));
    expect(muster).toHaveLength(2);
    expect(passt(ziel.replace(/&amp;/g, '&'))).toBe(true);
    expect(passt(`https://app.makeinnovation.de/buchen/${SLUG}`)).toBe(true);
    expect(passt('https://example.org/')).toBe(false);
    // Umstellung auf die Buchungsseite: nur das eine href ersetzen — bleibt grün.
    const k = kopie();
    fuellen(k);
    expect(pruefeWebsite(k).freigabefaehig).toBe(true);
    ersetze(k, 'index.html', `id="erstgespraech-link" href="${ziel}"`, `id="erstgespraech-link" href="https://app.makeinnovation.de/buchen/${SLUG}"`);
    expect(BUCHUNG_MUSTER.test(`https://app.makeinnovation.de/buchen/${SLUG}`)).toBe(true);
    expect(pruefeWebsite(k)).toEqual({ fehler: [], platzhalter: [], freigabefaehig: true });
    // Ungültiger Slug, Knopf ins Leere, zweite Erstgespräch-Mail, Buchungslink auf einer Unterseite: alles fällt auf.
    ersetze(k, 'index.html', `/buchen/${SLUG}"`, '/buchen/falsch"');
    ersetze(k, 'index.html', '<a class="knopf leise" href="#erstgespraech" data-erstgespraech>', '<a class="knopf leise" href="#kontakt" data-erstgespraech>');
    ersetze(k, 'index.html', '<a class="mail" href="mailto:hello@makeinnovation.de">', `<a class="mail" href="${ziel}">`);
    ersetze(k, 'impressum.html', '</main>', `<p><a href="https://app.makeinnovation.de/buchen/${SLUG}">Termin</a></p></main>`);
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Ziel des Erstgesprächs https:\/\/app\.makeinnovation\.de\/buchen\/falsch/);
    expect(f).toMatch(/data-erstgespraech zeigt nicht auf #erstgespraech/);
    expect(f).toMatch(/impressum\.html: Buchungslink — nur als Ziel des Erstgesprächs/);
  });

  it('der Name der Software steht nirgends im Ordner — auch nicht in Arbeitsdateien', () => {
    for (const ort of [['index.html', '</main>', '<p>MAKE OS</p></main>'], ['LIESMICH.md', '# Landingpage', '# Landingpage MakeOS'], ['js/menue.js', '// MAKE', '// MAKE OS']] as const) {
      const k = kopie();
      fuellen(k);
      ersetze(k, ort[0], ort[1], ort[2]);
      expect(pruefeWebsite(k).fehler.join('\n'), ort[0]).toMatch(/Name der Software/);
    }
  });

  it('auf der Seite steht nur MAKE: fremde Namen und gesperrte Wörter fallen auf', () => {
    const k = kopie();
    fuellen(k);
    const fremd = ['Cap' + 'OS', 'POIN' + 'CAP', 'KEM' + 'ARIS', 'AST' + 'ARNA', 'Conn' + 'ect', 'One' + 'Banking', 'One ' + 'Banking', 'K' + 'SI', 'Capital ' + 'Readiness', 'Infin' + 'ity', 'Infin' + 'ity Future'];
    for (const [i, name] of fremd.entries()) {
      const k2 = kopie();
      fuellen(k2);
      ersetze(k2, i % 2 ? 'impressum.html' : 'index.html', '</main>', `<p>${name}</p></main>`);
      expect(pruefeWebsite(k2).fehler.join('\n'), name).toMatch(/fremder Name/);
    }
    ersetze(k, 'index.html', '</main>', '<p>Unser Dash' + 'board</p></main>');
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/Wortregeln/);
    // Firmierung (Kevin 03.10.): eine GmbH namens MAKE Innovation gibt es nicht; jede Seite trägt die Marke der KEMARIS Innovation GmbH.
    const k3 = kopie();
    fuellen(k3);
    expect(pruefeWebsite(k3).fehler).toEqual([]);
    ersetze(k3, 'impressum.html', '</main>', '<p>MAKE Innovation ' + 'GmbH</p></main>');
    ersetze(k3, '404.html', /eine Marke der KEMARIS Innovation GmbH/g, 'MAKE');
    const f3 = pruefeWebsite(k3).fehler.join('\n');
    expect(f3).toMatch(/impressum\.html:\d+: „MAKE Innovation GmbH“ — die GmbH ist nicht eingetragen/);
    expect(f3).toMatch(/404\.html: Firmierung/);
  });

  it('Skripte nur als eigene Datei aus js/ — und die lesen, speichern und senden nichts', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'impressum.html', '</body>', '<script>alert(1)</script></body>');
    writeFileSync(join(k, 'js/menue.js'), readFileSync(join(k, 'js/menue.js'), 'utf8') + "\nfetch('/x');\n");
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/impressum\.html: <script> — nur eigene Dateien aus js\//);
    expect(f).toMatch(/js\/menue\.js: „fetch“/);
  });

  it('erkennt, was die strenge CSP brechen oder Daten abfließen lassen würde', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', '<body>', '<body style="color:red"><script src="https://example.org/x.js"></script>');
    ersetze(k, 'css/seite.css', ':root {', "@import url('https://fonts.googleapis.com/css2?family=Inter');\n:root {");
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/style="…"/);
    expect(f).toMatch(/<script>/);
    expect(f).toMatch(/fremde Quelle https:\/\/example\.org/);
    expect(f).toMatch(/@import/);
    expect(f).toMatch(/fremder Dienst/);
  });

  it('erkennt tote Links und einen fehlenden Login-Knopf', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', 'href="#ueber-uns"', 'href="#gibt-es-nicht"');
    ersetze(k, 'datenschutz.html', /href="https:\/\/app\.makeinnovation\.de\/anmelden"/g, 'href="index.html"');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Anker #gibt-es-nicht fehlt/);
    expect(f).toMatch(/datenschutz\.html: Login-Knopf/);
  });

  it('Login zeigt auf die Anmeldung (klein, ohne Produktnamen), Kontakt per mailto, Arbeitsdateien sind benannt', () => {
    expect(ANMELDEN).toBe('https://app.makeinnovation.de/anmelden');
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index).toContain(`<a class="knopf anmelden" href="${ANMELDEN}">Login</a>`);
    expect(index).toContain('href="mailto:hello@makeinnovation.de"');
    // Dieselben Dateien versteckt die Freigabe-Fassung der Caddyfile (hide nach Namen, @intern nach Pfad).
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    expect(caddy).toContain(`hide ${VERSTECKT.join(' ')}`);
    for (const d of NICHT_OEFFENTLICH) expect(caddy).toMatch(new RegExp(`@intern path [^\\n]*/${d.replace(/\./g, '\\.')}( |$)`, 'm'));
  });

  it('belegte Zahlen: jede Kachel hat eine Fußnote mit geprüftem Quellenlink — fremde Links und lose Zahlen fallen auf', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index.match(/<li class="zahl /g)).toHaveLength(4);
    for (const u of QUELLEN_LINKS) expect(index).toContain(`href="${u}" rel="noopener noreferrer"`);
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', QUELLEN_LINKS[3], 'https://example.org/zahl');
    ersetze(k, 'index.html', '<sup><a href="#fn-1" aria-label="Quelle 1">1</a></sup>', '');
    ersetze(k, 'index.html', ' rel="noopener noreferrer"', '');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/unerwarteter externer Link https:\/\/example\.org\/zahl/);
    expect(f).toMatch(/Zahlen-Kachel ohne Zahl oder ohne Fußnote/);
    expect(f).toMatch(/ohne rel="noopener noreferrer"/);
    expect(f).toMatch(/Fußnote ohne genau einen geprüften Quellenlink/);
  });

  it('v5 Szene: Drehbuch und Seite passen zusammen, jedes Kapitel hat sein Standbild, Skripte nur aus js/ und js/szene/', () => {
    const k = kopie();
    fuellen(k);
    // Ein Kapitel ohne Standbild, ein Standbild mit falschem Namen, ein Skript aus einem fremden Ordner fallen auf.
    ersetze(k, 'index.html', '<img class="still" src="assets/szene/sales.svg" width="800" height="800" alt="" loading="lazy" decoding="async">', '');
    ersetze(k, 'index.html', 'src="assets/szene/ki.svg"', 'src="assets/szene/wirkung.svg"');
    ersetze(k, 'index.html', /<script src="js\/drehbuch\.js\?v=[a-f0-9]+" defer><\/script>/, '<script src="js/fremd/drehbuch.js" defer></script>');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/jeder Abschnitt mit data-zustand beginnt mit seinem Standbild/);
    expect(f).toMatch(/Standbild von „ki“ ist assets\/szene\/wirkung\.svg/);
    expect(f).toMatch(/<script> — nur eigene Dateien aus js\//);
    // Reihenfolge im Drehbuch ≠ Seite.
    const k2 = kopie();
    fuellen(k2);
    ersetze(k2, 'js/drehbuch.js', "{ name: 'ki',", "{ name: 'kix',");
    expect(pruefeWebsite(k2).fehler.join('\n')).toMatch(/passen nicht zum Drehbuch/);
    // Die Leinwand bleibt rein dekorativ.
    const k3 = kopie();
    fuellen(k3);
    ersetze(k3, 'index.html', '<div class="szene" aria-hidden="true">', '<div class="szene">');
    expect(pruefeWebsite(k3).fehler.join('\n')).toMatch(/Szene .* nicht aria-hidden/);
  });

  it('Stempel: jeder Verweis auf css/ und js/ trägt die Prüfsumme der Datei — geänderte Datei ohne neuen Stempel fällt auf', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const verweise = Array.from(index.matchAll(STEMPEL_VERWEIS));
    expect(verweise.length).toBeGreaterThanOrEqual(7);
    for (const m of verweise) expect(m[3]).toBe(stempelVon(readFileSync(join(ORDNER, m[2]))));
    const k = kopie();
    fuellen(k);
    writeFileSync(join(k, 'js/menue.js'), readFileSync(join(k, 'js/menue.js'), 'utf8') + '\n// geändert\n');
    ersetze(k, 'impressum.html', /css\/seite\.css\?v=[a-f0-9]+/, 'css/seite.css');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/index\.html: js\/menue\.js ohne aktuellen Stempel/);
    expect(f).toMatch(/impressum\.html: css\/seite\.css ohne aktuellen Stempel/);
    // stempeln() bringt alle Seiten wieder in Ordnung (menue.js hängt an jeder Seite).
    for (const d of readdirSync(k).filter(d => d.endsWith('.html'))) writeFileSync(join(k, d), stempeln(k, readFileSync(join(k, d), 'utf8')));
    expect(pruefeWebsite(k).fehler.join('\n')).not.toMatch(/Stempel/);
  });

  it('v5 Fokus Innovation: Menüpunkt und Kapitel verlinken auf fokusinnovation.de, alle sechs Städte inkl. Dresden', () => {
    expect(STAEDTE).toEqual(['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München', 'Dresden']);
    expect(NAVIGATION).toContain(FOKUS_SEITE);
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const nav = /<nav class="haupt"[\s\S]*?<\/nav>/.exec(index)?.[0] ?? '';
    expect(nav).toContain(`href="${FOKUS_SEITE}"`);
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', '<li><b>Dresden</b></li>', '');
    ersetze(k, 'index.html', `<a class="knopf gross" href="${FOKUS_SEITE}">`, '<a class="knopf gross" href="#kontakt">');
    ersetze(k, 'index.html', `<a href="${FOKUS_SEITE}">Fokus Innovation <span class="aussen" aria-hidden="true">↗</span></a>\n      <a href="#ueber-uns">`, '<a href="#ueber-uns">');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Stadt Dresden fehlt/);
    expect(f).toMatch(/Kapitel Fokus Innovation ohne Link/);
    expect(f).toMatch(/Navigation ohne https:\/\/fokusinnovation\.de/);
  });

  it('v5 Gewicht: Startseite (HTML, CSS, Skripte, gzip) bleibt unter der Grenze — ein schwerer Zusatz fällt auf', () => {
    expect(GEWICHT_GRENZE).toBe(400 * 1024);
    const k = kopie();
    fuellen(k);
    // 2 MB Zufall (lässt sich nicht packen) als Skript-Kommentar anhängen.
    let z = 7; const zufall = Array.from({ length: 2_000_000 }, () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return String.fromCharCode(97 + (z % 26)); }).join('');
    writeFileSync(join(k, 'js/drehbuch.js'), readFileSync(join(k, 'js/drehbuch.js'), 'utf8') + `\n/* ${zufall} */\n`);
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/Startseite wiegt \d+ KB gzip/);
  });

  it('v5 Geometrie: läuft ohne DOM, Deutschlandkarte nimmt eine eigene Städte-Liste (Schnittstelle für fokus/)', () => {
    const ctx: Record<string, unknown> = {};
    vm.createContext(ctx);
    for (const d of ['js/szene/kern.js', 'js/szene/formationen.js', 'js/drehbuch.js']) vm.runInContext(readFileSync(join(ORDNER, d), 'utf8'), ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const S = ctx.MakeSzene as any;
    const logo = S.formationen.logoAusSvg(readFileSync(join(ORDNER, 'assets/logo/wortmarke.svg'), 'utf8'));
    expect(logo.knoten).toEqual([154.84, 77.5]);
    const welt = S.formationen.bauen(S.drehbuch, { handy: true, logo, anzahl: 600 });
    expect(welt.formationen).toHaveLength(S.drehbuch.zustaende.length);
    for (const f of welt.formationen) expect(f.punkte.length).toBe(600 * 4);
    const karte = welt.formationen[welt.Z.findIndex((z: { formation: string }) => z.formation === 'karte')];
    expect(karte.marken).toHaveLength(6);
    // Eigene Liste: drei Städte → drei Marken; Dresden liegt östlich und südlich von Berlin, Köln westlich (echte Koordinaten).
    const eigene = S.formationen.bauen({ zustaende: [{ name: 'k', formation: 'karte', s: 50, optionen: { staedte: [{ name: 'Berlin', lat: 52.52, lon: 13.405 }, { name: 'Dresden', lat: 51.05, lon: 13.738 }, { name: 'Köln', lat: 50.938, lon: 6.96 }] } }, { name: 'z', formation: 'funken', s: 90 }] }, { anzahl: 400 });
    const [berlin, dresden, koeln] = eigene.formationen[0].marken;
    const r = S.kern.rahmen(50), lokal = (p: number[]) => [S.kern.dot(S.kern.sub(p, r.p), r.r), S.kern.dot(S.kern.sub(p, r.p), r.t)]; // [Osten, Norden]
    expect(lokal(dresden)[0]).toBeGreaterThan(lokal(berlin)[0]);
    expect(lokal(dresden)[1]).toBeLessThan(lokal(berlin)[1]);
    expect(lokal(koeln)[0]).toBeLessThan(lokal(berlin)[0]);
    // Die Kamera liefert für jeden Scroll-Stand endliche Werte.
    for (const T of [0, .5, 3.3, welt.Z.length - 1]) {
      const kam = S.kern.kamera(welt.Z, T, 0, 0, 1.6, { kante: .05 });
      expect([...kam.auge, ...kam.ziel].every(Number.isFinite)).toBe(true);
    }
  });
});
