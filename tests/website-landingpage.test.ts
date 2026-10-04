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
    ersetze(k, 'index.html', /(<article[^>]*id="angebot-events"[\s\S]*?)<a class="knopf" href="#erstgespraech" data-erstgespraech>Erstgespräch anfragen(?: <span class="pfeil" aria-hidden="true">→<\/span>)?<\/a>/, '$1');
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

  // ── Standard 04.10. (Glas-Knöpfe, Mikro-Pille, Kaskade, Auftritt, Einstieg, Aurora) ──
  function szene(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
    const ctx: Record<string, unknown> = {};
    vm.createContext(ctx);
    for (const d of ['js/szene/kern.js', 'js/szene/formationen.js', 'js/drehbuch.js', 'js/szene/motor.js']) vm.runInContext(readFileSync(join(ORDNER, d), 'utf8'), ctx);
    return ctx.MakeSzene;
  }
  /** Ein kleines Stück DOM — genug für die Text-Bühne (Knoten, Klassen, Attribute, Stil-Variablen). */
  type Knoten = { nodeType: number; nodeValue?: string; tagName?: string; className?: string; childNodes: Knoten[]; attr: Record<string, string>; vars: Record<string, string>; parent?: Knoten;
    textContent: string; appendChild(k: Knoten): Knoten; replaceChildren(...k: Knoten[]): void; setAttribute(n: string, w: string): void; cloneNode(tief: boolean): Knoten; style: { setProperty(n: string, w: string): void } };
  function knoten(nodeType: number, tagName?: string, text?: string): Knoten {
    const k: Knoten = {
      nodeType, tagName, nodeValue: text, className: '', childNodes: [], attr: {}, vars: {},
      get textContent() { return nodeType === 3 ? (k.nodeValue ?? '') : k.childNodes.map(c => c.textContent).join(''); },
      set textContent(t: string) { if (nodeType === 3) k.nodeValue = t; else k.childNodes = [knoten(3, undefined, t)]; },
      appendChild(c) { c.parent = k; k.childNodes.push(c); return c; },
      replaceChildren(...c) { k.childNodes = []; for (const x of c) k.appendChild(x); },
      setAttribute(n, w) { k.attr[n] = w; },
      cloneNode() { const c = knoten(nodeType, tagName, text); c.className = k.className; c.attr = { ...k.attr }; return c; },
      style: { setProperty(n, w) { k.vars[n] = w; } },
    };
    return k;
  }
  const dok = { createElement: (t: string) => knoten(1, t), createTextNode: (t: string) => knoten(3, undefined, t) };
  /** Was ein Vorleser liest: Text ohne alles, was aria-hidden ist. */
  const vorgelesen = (k: Knoten): string => k.nodeType === 3 ? (k.nodeValue ?? '') : k.attr['aria-hidden'] === 'true' ? '' : k.childNodes.map(vorgelesen).join('');

  it('Kaskade: die zerlegte Überschrift bleibt für Vorleser ein Satz, Kindelemente bleiben, danach steht das Original wieder', () => {
    const { zerlegen } = szene().buehne;
    const h1 = knoten(1, 'H1'), ruhig = knoten(1, 'SPAN');
    ruhig.className = 'ruhig';
    h1.appendChild(knoten(3, undefined, 'Innovation braucht Umsetzung '));
    ruhig.appendChild(knoten(3, undefined, 'und Sichtbarkeit.'));
    h1.appendChild(ruhig);
    const vorher = [...h1.childNodes];
    const { buchstaben, zurueck } = zerlegen(h1, dok, 'unsichtbar');
    expect(buchstaben).toHaveLength('InnovationbrauchtUmsetzungundSichtbarkeit.'.length);
    expect(buchstaben.map((b: Knoten) => b.vars['--i'])).toEqual(buchstaben.map((_: Knoten, i: number) => String(i)));
    expect(h1.childNodes[0].className).toBe('unsichtbar');
    expect(vorgelesen(h1).replace(/\s+/g, ' ').trim()).toBe('Innovation braucht Umsetzung und Sichtbarkeit.');
    expect(h1.childNodes.find(k => k.className === 'ruhig')?.childNodes.every(k => k.nodeType === 3 || k.attr['aria-hidden'] === 'true')).toBe(true);
    zurueck();
    expect(h1.childNodes).toEqual(vorher);
    // In der Seite: nur H1/H2 werden zerlegt (nicht das Wort INNOVATION, das die Szene formt).
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const kaskaden = Array.from(index.matchAll(/<(\w+)\b[^>]*\sdata-kaskade(?![-\w])[^>]*>/g), m => m[1]);
    expect(kaskaden.length).toBeGreaterThanOrEqual(6);
    for (const t of kaskaden) expect(['h1', 'h2']).toContain(t);
    expect(index).not.toMatch(/<h2 class="wort"[^>]*data-kaskade/);
  });

  it('Auftritt: vorher · jetzt · nach am Fortschritt der Szene — Fließendes geht erst, wenn es oben hinausläuft', () => {
    const { auftritt } = szene().buehne;
    expect(auftritt('', 0, 0, null, 0, 900)).toBe('jetzt');
    expect(auftritt('', 2, 4, null, 0, 900)).toBe('vorher');
    expect(auftritt('jetzt', 4.7, 4, null, 0, 900)).toBe('nach');
    expect(auftritt('jetzt', 4.6, 4, null, 0, 900)).toBe('jetzt'); // Hysterese
    const lage = { oben: 5000, unten: 5100 };
    expect(auftritt('', 4, 4, lage, 3000, 900)).toBe('vorher'); // noch unter dem Bild
    expect(auftritt('', 4, 4, lage, 4400, 900)).toBe('jetzt');
    expect(auftritt('jetzt', 4.9, 4, lage, 4600, 900)).toBe('jetzt'); // mitten im Bild: bleibt, auch wenn T weiter ist
    expect(auftritt('jetzt', 4.9, 4, lage, 5200, 900)).toBe('nach');
  });

  it('Text-Bühne: ohne Skript und bei „Bewegung reduzieren“ steht aller Text sofort', () => {
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    // Versteckt wird nur, was der Motor markiert (text-bereit, kaskade) — und nur bei Bewegung; das Vorab-Verstecken des
    // Einstiegs gilt nur mit Skript und hat einen Notfall-Auftritt.
    const regeln = Array.from(css.matchAll(/([^{}]+)\{([^{}]*opacity:\s*0[;\s][^{}]*)\}/g), m => m[1].trim());
    for (const sel of regeln.filter(r => /data-auftritt|data-kaskade|k-b/.test(r))) expect(sel, sel).toMatch(/text-bereit|kaskade/);
    const vorab = /@media \(scripting: enabled\) and \(prefers-reduced-motion: no-preference\) \{\s*html:not\(\.text-bereit\)[^}]*animation: notfall/.exec(css);
    expect(vorab).not.toBeNull();
    const motor = readFileSync(join(ORDNER, 'js/szene/motor.js'), 'utf8');
    expect(motor.indexOf("prefers-reduced-motion: reduce")).toBeLessThan(motor.indexOf("classList.add('text-bereit'"));
  });

  it('Knöpfe und Pillen: nur CI-Farben (Tokens), keine fremde Palette oder Schrift', () => {
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    const teil = css.slice(css.indexOf('/* ── Knöpfe'), css.indexOf('/* ── Text-Bühne'));
    expect(teil.length).toBeGreaterThan(500);
    expect(teil.match(/#[0-9a-f]{3,8}\b/gi)?.filter(h => h !== '#000') ?? []).toEqual([]);
    const erlaubt = ['255, 255, 255', '0, 0, 0', '10, 14, 17', '201, 70, 92', '47, 168, 120'];
    for (const m of teil.matchAll(/rgba\((\d+, \d+, \d+),/g)) expect(erlaubt, m[0]).toContain(m[1]);
    expect(teil).toMatch(/var\(--granat\), var\(--smaragd\), var\(--granat\)/);
    const alles = [css, ...['js/szene/motor.js', 'js/szene/kern.js', 'js/drehbuch.js'].map(d => readFileSync(join(ORDNER, d), 'utf8'))].join('\n');
    expect(alles).not.toMatch(/#ff4c33|#3366ff|#ffa091|#8da9fc|'Inter'|Assistant|fonts\.googleapis/i);
    // Die Mikro-Pillen tragen den Knoten aus dem Logo (Inline-SVG, aria-hidden, Farben über Klassen).
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const pillen = Array.from(index.matchAll(/<span class="mikro pille"[^>]*>(<svg[^>]*>)/g), m => m[1]);
    expect(pillen.length).toBeGreaterThanOrEqual(9);
    for (const s of pillen) expect(s).toContain('aria-hidden="true"');
  });

  it('Einstieg, Aurora und Text-Bühne kommen aus dem Drehbuch und sind abschaltbar; die Feder folgt weich, ohne Überschwingen', () => {
    const S = szene(), K = S.kern;
    const an = K.optionen(S.drehbuch, false);
    expect(an.einstieg.dauer).toBe(2600);
    expect(an.aurora.aufloesung).toBeLessThanOrEqual(.25);
    expect(K.optionen(S.drehbuch, true).aurora.oktaven).toBeLessThan(an.aurora.oktaven);
    const aus = K.optionen({ zustaende: [] }, false);
    expect(aus.einstieg).toBeNull();
    expect(aus.aurora).toBeNull();
    expect(K.optionen({ text: false, aurora: false }, false)).toMatchObject({ text: null, aurora: null });
    expect(K.einstieg(0, an.einstieg)).toBeCloseTo(an.einstieg.naeher);
    expect(K.einstieg(1, an.einstieg)).toBe(0);
    expect(K.einstieg(.5, null)).toBe(0);
    // Feder: gleiche Wirkung bei 60 und 144 Bildern pro Sekunde, kein Überschwingen, kommt an.
    const lauf = (fps: number) => { const z = { wert: 0, v: 0 }; let max = 0; for (let t = 0; t < 4; t += 1 / fps) { K.feder(z, 1, 1 / fps, .32); max = Math.max(max, z.wert); } return { z, max }; };
    const a = lauf(60), b = lauf(144);
    expect(a.max).toBeLessThanOrEqual(1);
    expect(a.z.wert).toBe(1);
    const halb = (fps: number) => { const z = { wert: 0, v: 0 }; for (let t = 0; t < .3; t += 1 / fps) K.feder(z, 1, 1 / fps, .32); return z.wert; };
    expect(Math.abs(halb(60) - halb(144))).toBeLessThan(.03);
    expect(b.max).toBeLessThanOrEqual(1);
  });

  it('Zahlen-Trommel und Aufdeck-Fuß: zählt in 2,2 s bis zum belegten Wert, Fuß bleibt vollständig (Firmierung, Recht, Erstgespräch)', () => {
    const { trommel } = szene().buehne;
    expect(trommel(41, 0)).toEqual({ zahl: 0, rest: 1, fertig: false });
    expect(trommel(41, 2200)).toEqual({ zahl: 41, rest: 0, fertig: true });
    let vor = -1;
    for (let ms = 0; ms <= 2200; ms += 50) { const t = trommel(66, ms); expect(t.zahl).toBeGreaterThanOrEqual(vor); vor = t.zahl; }
    expect(trommel(7, 1100).zahl).toBeGreaterThan(5); // easeOutQuint: früh fast da
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index.match(/<li class="zahl zeigen trommel">/g)).toHaveLength(4);
    expect(index).toContain('<div class="aufdecken" aria-hidden="true"></div>');
    const fuss = /<footer class="fuss">[\s\S]*<\/footer>/.exec(index)?.[0] ?? '';
    expect(fuss).toMatch(/<a class="knopf gross" href="#erstgespraech" data-erstgespraech>Erstgespräch anfragen/);
    expect(fuss).toContain('eine Marke der KEMARIS Innovation GmbH');
    expect(fuss).toContain('href="impressum.html"');
    expect(fuss).toContain('href="datenschutz.html"');
    expect(fuss).toMatch(/<p class="riesen" aria-hidden="true">/);
    // Fester Fuß nur ab 768 px und nur mit Bewegung (der Motor setzt fuss-aufdecken; ohne Skript bleibt er im Fluss).
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    expect(css).toMatch(/@media \(min-width: 768px\) and \(prefers-reduced-motion: no-preference\) \{\s*\.fuss-aufdecken \.aufdecken/);
  });
});

