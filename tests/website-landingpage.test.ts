// ─── Landingpage makeinnovation.de: Freigabe-Prüfung (01.10.; „Klar 2“ 07.10.: ruhige Seite; „v3 · Der Weg“ 07.10. abends) ───
// website/pruefen.mjs entscheidet, ob die Seite online darf. Hier wird geprüft, dass der Prüfer selbst stimmt:
// Bau-Regeln heute grün (nur die Platzhalter halten die Freigabe auf), Platzhalter und Regelbrüche werden erkannt.
// Ob heute noch Platzhalter offen sind, prüft dieser Test bewusst NICHT — das ist Kevins Freigabe, kein Fehler.
// 07.10. Kevin: „Wir wollen innovativ UND seriös wirken. Wir haben auch in [unserer Software] keine Spielereien.“ Der Scroll-Film
// (Spur, Bühne, WebGL-Szene, Zahlen-Trommel) ist entfernt; die Tests dazu sind durch die Ruhe-Regeln ersetzt (pruefeRuhe).
// 07.10. abends Kevin: „Nimm die Kugel raus. Bau das Ganze nochmal und bring Innovation nach vorne. Ich brauche keine 0815-KI-Homepage.“
// → v3: Linienplan „Der Weg der Innovation“, eine Farbfläche, zwei dunkle Abschnitte, Arbeits-Schemata, Bewegung genau einmal; kein
// Kugel-Bild mehr. Die Ruhe-Tests sind entsprechend angepasst. Die Regeln zu Firmierung, Software-Name, CSP, noindex, Erstgespräch und
// Datenschutz sind unverändert.
import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeWebsite, ANMELDEN, NICHT_OEFFENTLICH, VERSTECKT, LOGO_DATEIEN, ANGEBOTE, BUCHUNG_MUSTER, ERSTGESPRAECH_MAIL, MAIL_BETREFFE, NAVIGATION, STAEDTE, FOKUS_SEITE, GEWICHT_GRENZE, DUNKEL_HOECHSTENS, FARBFLAECHE_HOECHSTENS, STATISTIK, STEMPEL_VERWEIS, stempelVon, stempeln, bewegungsBloecke } from '../website/pruefen.mjs';
import { ECKE, FARBE, KUGEL } from '@/lib/make-one/design';

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
    ersetze(k, 'datenschutz.html', 'abgesichert.</p>', 'abgesichert. [[KEVIN: Anbieter]]</p>');
    const r = pruefeWebsite(k);
    expect(r.freigabefaehig).toBe(false);
    expect(r.platzhalter).toEqual([expect.objectContaining({ datei: 'datenschutz.html', text: 'Anbieter' })]);
  });

  it('gelbe Markierung ohne Platzhalter darin fällt auf', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'datenschutz.html', 'abgesichert.</p>', 'abgesichert. <span class="ph">Anbieter</span></p>');
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/gelbe Platzhalter-Markierung/);
  });

  it('Logo-Dateien sind da, der Kopf zeigt das helle Logo, der Fuß die Wortmarke', () => {
    for (const d of LOGO_DATEIEN) expect(existsSync(join(ORDNER, d)), d).toBe(true);
    const k = kopie();
    fuellen(k);
    // 07.10. Kevin (heller Kopf auf Off-White): Kopf = quer-hell/kompakt-hell, die Wortmarke steht im dunklen Fuß statt im Schlussblock.
    ersetze(k, 'index.html', '<img src="assets/logo/wortmarke.svg" width="277"', '<img src="assets/logo/quer.svg" width="277"');
    ersetze(k, 'index.html', '<img src="assets/logo/quer-hell.svg"', '<img src="assets/logo/quer.svg"');
    rmSync(join(k, 'assets/logo/kompakt-hell.svg'));
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Fuß ohne Wortmarke/);
    expect(f).toMatch(/Logo \(assets\/logo\/quer-hell\.svg\) fehlt im Kopf/);
    expect(f).toMatch(/srcset assets\/logo\/kompakt-hell\.svg — Datei fehlt/);
    expect(f).toMatch(/assets\/logo\/kompakt-hell\.svg: fehlt/);
  });

  it('Angebote: Interim CSO, Interim Head of Sales, Sichtbarkeit, Events gleichwertig mit „Erstgespräch anfragen“, genau ein „Coming Soon“', () => {
    // 07.10. abends (v3): „Sichtbarkeit & Marketing“ als eigene Leistung (aus den Beratungsfeldern Botschaft, Unterlagen, Kanäle).
    expect(ANGEBOTE).toEqual({ 'angebot-interim-cso': 'aktiv', 'angebot-head-of-sales': 'aktiv', 'angebot-sichtbarkeit': 'aktiv', 'angebot-events': 'aktiv', 'angebot-development': 'bald' });
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index.match(/Coming Soon/g)).toHaveLength(1);
    expect(index).toContain('href="mailto:hello@makeinnovation.de?subject=Make.One%20%E2%80%93%20Einladung"');
    expect(index).toContain('href="mailto:hello@makeinnovation.de?subject=Make.Beteiligungen%20%E2%80%93%20Projekt"');
    expect(Object.keys(MAIL_BETREFFE)).toEqual(['Make.One – Einladung', 'Make.Beteiligungen – Projekt']);
    const k = kopie();
    fuellen(k);
    // Ein Angebot ohne Termin-Knopf, ein zweites „Coming Soon“, ein fehlender Beteiligungen-Knopf und ein Preis fallen auf.
    ersetze(k, 'index.html', /(<article[^>]*id="angebot-events"[\s\S]*?)<a class="knopf zweit" href="#erstgespraech" data-erstgespraech>Erstgespräch anfragen(?: <span class="pfeil" aria-hidden="true">→<\/span>)?<\/a>/, '$1');
    ersetze(k, 'index.html', '<p class="rolle mikro"><span class="halt-marke gruen" aria-hidden="true"></span>Sales-Aufbau auf Zeit</p>', '<span class="abzeichen bald">Coming Soon</span>');
    ersetze(k, 'index.html', 'subject=Make.Beteiligungen%20%E2%80%93%20Projekt', 'subject=Projekt');
    ersetze(k, 'index.html', '<dd>6–12 Monate, mit Kevin Dieckmann.</dd>', '<dd>6–12 Monate, ab 1.500 € pro Tag.</dd>');
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
    ersetze(k, 'index.html', '<a class="knopf ruf" href="#erstgespraech" data-erstgespraech>', '<a class="knopf ruf" href="#kontakt" data-erstgespraech>');
    ersetze(k, 'index.html', '<a class="mail" href="mailto:hello@makeinnovation.de">', `<a class="mail" href="${ziel}">`);
    ersetze(k, 'impressum.html', '</main>', `<p><a href="https://app.makeinnovation.de/buchen/${SLUG}">Termin</a></p></main>`);
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Ziel des Erstgesprächs https:\/\/app\.makeinnovation\.de\/buchen\/falsch/);
    expect(f).toMatch(/data-erstgespraech zeigt nicht auf #erstgespraech/);
    expect(f).toMatch(/impressum\.html: Buchungslink — nur als Ziel des Erstgesprächs/);
  });

  it('der Name der Software steht nirgends im Ordner — auch nicht in Arbeitsdateien', () => {
    for (const ort of [['index.html', '</main>', '<p>MAKE OS</p></main>'], ['LIESMICH.md', '# Landingpage', '# Landingpage MakeOS'], ['js/menue.js', '// MAKE', '// MAKE OS'], ['css/start.css', '/* ───', '/* MAKE OS ───']] as const) {
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

  it('Belege (Kevin 07.10.): nur Prinzipien — keine Statistiken, Prozentzahlen oder Quellenlinks auf der Startseite', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const sichtbar = index.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ');
    expect(sichtbar).not.toMatch(STATISTIK);
    expect(index).not.toMatch(/class="zahl|id="fn-\d|kfw\.de|bitkom\.org/);
    for (const ja of ['66 % der Unternehmen', '7&nbsp;%'.replace('&nbsp;', ' '), 'zwölf Prozent', '2 Mio. Menschen', '3 Milliarden']) expect(STATISTIK.test(ja), ja).toBe(true);
    for (const nein of ['ca. 2 Tage pro Woche', 'Laufzeit 6–12 Monate', '2–3 Terminvorschläge', 'Phase 01']) expect(STATISTIK.test(nein), nein).toBe(false);
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', '<article class="angebot bald"', '<p>41 % der Unternehmen <a href="https://www.kfw.de/x.pdf">Quelle</a></p><article class="angebot bald"');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/keine Statistiken oder Prozentzahlen/);
    expect(f).toMatch(/unerwarteter externer Link https:\/\/www\.kfw\.de/);
  });

  it('Ruhe (v3): kein Scroll-Film, keine Kugel, zwei dunkle Abschnitte und eine Farbfläche, Bewegung nur einmal und nie scroll-gebunden', () => {
    // 07.10. abends Kevin: „Nimm die Kugel raus.“ — und Rhythmus statt EINES dunklen Abschnitts (begründet in website/LIESMICH.md › v3).
    expect([DUNKEL_HOECHSTENS, FARBFLAECHE_HOECHSTENS]).toEqual([2, 1]);
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index).not.toMatch(/<canvas\b|class="(?:spur|buehne|szene|karussell|laufband|flug|vorhang)\b|data-spur-p|data-zerfall|data-aufstieg|kugel|class="licht"/i);
    expect(index.match(/\sclass="[^"]*\bdunkel\b[^"]*"/g)).toHaveLength(2);
    expect(index.match(/\sclass="[^"]*\bfarbflaeche\b[^"]*"/g)).toHaveLength(1);
    expect(existsSync(join(ORDNER, 'assets/bild'))).toBe(false);
    // Drei kleine Skripte (Menü, Erstgespräch, die Linie zeichnet sich einmal) — keine Szene mehr im Ordner.
    expect(Array.from(index.matchAll(/<script src="(js\/[a-z-]+\.js)/g), m => m[1])).toEqual(['js/menue.js', 'js/erstgespraech.js', 'js/weg.js']);
    expect(readdirSync(join(ORDNER, 'js')).sort()).toEqual(['erstgespraech.js', 'menue.js', 'weg.js']);
    const k = kopie();
    fuellen(k);
    // Leinwand, Kugel-Bild, dritter dunkler Abschnitt, zweite Farbfläche, totes Bild, Animation außerhalb der Bewegungs-Blöcke,
    // endlose Animation, Scroll-Skript, Beobachter ohne Abmelden, Skript aus fremdem Ordner: alles fällt auf.
    ersetze(k, 'index.html', '<section class="abschnitt" id="ueber-uns"', '<canvas></canvas><figure class="licht" aria-hidden="true"><img src="assets/bild/kugel.svg" alt=""></figure><section class="dunkel" id="noch-dunkel"></section><section class="farbflaeche" id="noch-bunt"></section><section class="abschnitt" id="ueber-uns"');
    mkdirSync(join(k, 'assets/bild'), { recursive: true });
    writeFileSync(join(k, 'assets/bild/kugel.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(join(k, 'assets/bild/alt.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    writeFileSync(join(k, 'css/start.css'), readFileSync(join(k, 'css/start.css'), 'utf8') + '\n@keyframes schweben { from { opacity: 0; } }\n.x { animation: schweben 2s infinite; }\n');
    writeFileSync(join(k, 'js/erstgespraech.js'), readFileSync(join(k, 'js/erstgespraech.js'), 'utf8') + "\nwindow.addEventListener('scroll', () => {});\n");
    ersetze(k, 'js/weg.js', 'beobachter.unobserve(e.target);', '');
    ersetze(k, 'index.html', /<script src="js\/menue\.js\?v=[a-f0-9]+" defer><\/script>/, '<script src="js/szene/motor.js" defer></script>');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/„<canvas“ — kein Scroll-Film mehr/);
    expect(f).toMatch(/assets\/bild\/kugel\.svg: kein Kugel-Bild/);
    expect(f).toMatch(/index\.html: „[^“]*“ — kein Kugel-Bild, kein dekoratives Licht/);
    expect(f).toMatch(/3 dunkle Abschnitte — höchstens 2/);
    expect(f).toMatch(/2 Farbflächen — höchstens 1/);
    expect(f).toMatch(/assets\/bild\/alt\.svg: von keiner Seite gezeigt — tote Datei/);
    expect(f).toMatch(/css\/start\.css: „infinite“ — keine Dauer-Animation/);
    expect(f).toMatch(/css\/start\.css: „@keyframes“ außerhalb von @media \(prefers-reduced-motion: no-preference\)/);
    expect(f).toMatch(/js\/erstgespraech\.js: „addEventListener\('scroll'/);
    expect(f).toMatch(/js\/weg\.js: IntersectionObserver ohne unobserve\/disconnect/);
    expect(f).toMatch(/<script> — nur eigene Dateien aus js\//);
    // „Bewegung reduzieren“ muss in den Stilen stehen.
    const k2 = kopie();
    fuellen(k2);
    ersetze(k2, 'css/seite.css', '@media (prefers-reduced-motion: reduce) {\n  *, *::before', '@media print {\n  *, *::before');
    expect(pruefeWebsite(k2).fehler.join('\n')).toMatch(/kein @media \(prefers-reduced-motion: reduce\)/);
  });

  it('Ruhe (v3): im Ruhezustand ist alles sichtbar — verborgen nur vor dem einmaligen Zeichnen, im Bewegungs-Block unter .wartet', () => {
    // „Klar 2“ verbot jede Animation; v3 lässt die Linie EINMAL zeichnen (Kevin 07.10. abends: „bring Innovation nach vorne“). Dafür
    // muss sie kurz verborgen sein. Damit daraus kein „Aufdecken beim Scrollen“ wird, gilt: nur in @media (prefers-reduced-motion:
    // no-preference), nur unter .wartet (setzt js/weg.js, ohne Skript nie gesetzt) oder als Anfang eines @keyframes.
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    expect(bewegungsBloecke(css).bloecke.join('\n')).toMatch(/\.strecke\.zeichnen\.wartet li::before \{ transform: scaleX\(0\); \}/);
    const weg = readFileSync(join(ORDNER, 'js/weg.js'), 'utf8');
    expect(weg).toContain("classList.add('wartet')");
    expect(weg).toMatch(/prefers-reduced-motion: reduce/);
    expect(pruefeWebsite(ORDNER).fehler.filter(f => /verborgen|Ruhezustand/.test(f))).toEqual([]);
    const k = kopie();
    fuellen(k);
    // Außerhalb des Bewegungs-Blocks verborgen (Inhalt wäre ohne Skript weg) und im Block ohne .wartet (Aufdecken für alle): beides fällt auf.
    writeFileSync(join(k, 'css/start.css'), readFileSync(join(k, 'css/start.css'), 'utf8')
      + '\n.person { opacity: 0; }\n@media (prefers-reduced-motion: no-preference) {\n  .fragen details { transform: scaleY(0); }\n  .strecke.zeichnen.wartet .halt { opacity: 0; }\n}\n');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/css\/start\.css: „\.person \{ opacity: 0 \}“ außerhalb von @media \(prefers-reduced-motion: no-preference\)/);
    expect(f).toMatch(/css\/start\.css: „\.fragen details \{ scaleY\(0\) \}“ — verborgen nur unter \.wartet/);
    expect(f).not.toMatch(/„\.strecke\.zeichnen\.wartet \.halt/);
  });

  it('Stempel: jeder Verweis auf css/ und js/ trägt die Prüfsumme der Datei — geänderte Datei ohne neuen Stempel fällt auf', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const verweise = Array.from(index.matchAll(STEMPEL_VERWEIS));
    expect(verweise.length).toBe(5); // css/seite.css, css/start.css, js/menue.js, js/erstgespraech.js, js/weg.js
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

  it('Fokus Innovation: Menüpunkt und Kasten verlinken auf fokusinnovation.de, alle sechs Städte inkl. Dresden', () => {
    expect(STAEDTE).toEqual(['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München', 'Dresden']);
    expect(NAVIGATION).toContain(FOKUS_SEITE);
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    const nav = /<nav class="haupt"[\s\S]*?<\/nav>/.exec(index)?.[0] ?? '';
    expect(nav).toContain(`href="${FOKUS_SEITE}"`);
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', '<li><b>Dresden</b></li>', '');
    ersetze(k, 'index.html', `<a class="knopf zweit karte-link" href="${FOKUS_SEITE}">`, '<a class="knopf zweit karte-link" href="#kontakt">');
    ersetze(k, 'index.html', `<a href="${FOKUS_SEITE}">Fokus Innovation <span class="aussen" aria-hidden="true">↗</span></a>\n      <a href="#ueber-uns">`, '<a href="#ueber-uns">');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Stadt Dresden fehlt/);
    expect(f).toMatch(/Kapitel Fokus Innovation ohne Link/);
    expect(f).toMatch(/Navigation ohne https:\/\/fokusinnovation\.de/);
  });

  it('Gewicht: Startseite (HTML, CSS, Skripte, gzip) bleibt unter der Grenze — ein schwerer Zusatz fällt auf', () => {
    expect(GEWICHT_GRENZE).toBe(80 * 1024);
    const k = kopie();
    fuellen(k);
    // 2 MB Zufall (lässt sich nicht packen) als Skript-Kommentar anhängen.
    let z = 7; const zufall = Array.from({ length: 2_000_000 }, () => { z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff; return String.fromCharCode(97 + (z % 26)); }).join('');
    writeFileSync(join(k, 'js/erstgespraech.js'), readFileSync(join(k, 'js/erstgespraech.js'), 'utf8') + `\n/* ${zufall} */\n`);
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/Startseite wiegt \d+ KB gzip/);
  });

  it('Gestaltungsgrundlage wie die Software: Farben und Ecken aus lib/make-one/design.ts, Off-White und Tinte als Tokens', () => {
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    for (const [token, wert] of [['--grund', FARBE.grund], ['--ink', FARBE.ink], ['--inkDim', FARBE.inkDim], ['--inkLeise', FARBE.inkLeise], ['--aktiv', FARBE.aktiv], ['--granat', KUGEL.granat], ['--smaragd', KUGEL.smaragd]] as const)
      expect(css, token).toContain(`${token}: ${wert};`);
    for (const [token, wert] of [['--r-knopf', ECKE.knopf], ['--r-flach', ECKE.flach], ['--r-karte', ECKE.karte]] as const) expect(css, token).toMatch(new RegExp(`${token}: ${wert}px;`));
    expect(css).toMatch(/--papier: #F4F3EF;/);
    expect(css).toMatch(/--tinte: #0B0E10;/);
    // Die Startseite setzt keine eigenen Tokens (eine Quelle für beide Seiten).
    expect(readFileSync(join(ORDNER, 'css/start.css'), 'utf8')).not.toMatch(/--[a-zA-Z-]+\s*:/);
  });

  it('Knöpfe: nur CI-Farben über Tokens, eine Hauptaktion (dunkel); Animation nur in den Bewegungs-Blöcken (v3: die Linie zeichnet sich einmal)', () => {
    const css = readFileSync(join(ORDNER, 'css/seite.css'), 'utf8');
    const teil = css.slice(css.indexOf('/* ── Knöpfe'), css.indexOf('/* ── Held'));
    expect(teil.length).toBeGreaterThan(500);
    expect(teil.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    const erlaubt = ['255, 255, 255', '0, 0, 0', '11, 14, 16'];
    for (const m of teil.matchAll(/rgba\((\d+, \d+, \d+),/g)) expect(erlaubt, m[0]).toContain(m[1]);
    expect(teil).toMatch(/\.knopf \{[^}]*background: var\(--tinte\); color: var\(--papier\);/);
    expect(teil).toMatch(/\.knopf:hover \.pfeil \{ transform: translateX\(3px\); \}/);
    expect(css).not.toMatch(/#ff4c33|#3366ff|'Inter'|fonts\.googleapis|\binfinite\b/i);
    const { bloecke, rest } = bewegungsBloecke(css);
    expect(bloecke.length).toBeGreaterThanOrEqual(1);
    expect(rest).not.toMatch(/@keyframes|\banimation(?:-name)?\s*:(?!\s*none)/);
    expect(bloecke.join('\n')).toMatch(/@keyframes wk-zeichnen/);
    // Der Knoten aus dem Logo steht klein in der Vorzeile (Inline-SVG, aria-hidden, Farben über Klassen).
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index).toMatch(/<p class="vorzeile mikro"><svg class="knoten-zeichen"[^>]*aria-hidden="true"/);
  });

  it('Einstieg: WER · WAS · FÜR WEN auf dem ersten Bildschirm, der Linienplan als Leitmotiv; Fuß vollständig (Firmierung, Recht, Login, Kontakt)', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index).toContain('<h1 id="titel">Innovation braucht Umsetzung <span class="ruhig">und Sichtbarkeit.</span></h1>');
    const held = /<section class="held"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
    expect(held).toMatch(/gegründet von Malin &amp; Kevin/);
    for (const wort of ['Wer', 'Was', 'Für wen']) expect(held).toContain(`<dt class="mikro">${wort}</dt>`);
    // Der Linienplan: eine Grafik mit Titel und Beschreibung, fünf Halte und der Knoten aus dem Logo.
    expect(held).toMatch(/<figure class="wegkarte">\s*<svg [^>]*role="img" aria-labelledby="wk-titel wk-text"/);
    for (const halt of ['Signal', 'Strategie', 'Umsetzung', 'Vertrieb', 'Sichtbarkeit', 'Markt']) expect(held).toContain(`>${halt}</text>`);
    expect(held).toMatch(/class="wk-k-rot"[\s\S]*class="wk-k-gruen"/);
    // Der Weg (dunkel) führt das Motiv aus: sechs Etappen, der Knoten in der Mitte, die Linie zeichnet sich einmal (.zeichnen).
    const weg = /<section class="abschnitt dunkel" id="weg"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
    expect(weg).toMatch(/<ol class="strecke zeichnen"/);
    expect(weg.match(/<li class="[^"]*"><span class="halt"/g)).toHaveLength(6);
    expect(weg).toContain('<li class="knoten">');
    const fuss = /<footer class="fuss">[\s\S]*<\/footer>/.exec(index)?.[0] ?? '';
    expect(fuss).toContain('eine Marke der KEMARIS Innovation GmbH');
    expect(fuss).toContain('href="impressum.html"');
    expect(fuss).toContain('href="datenschutz.html"');
    expect(fuss).toContain(`href="${ANMELDEN}"`);
    expect(fuss).toContain('href="mailto:hello@makeinnovation.de"');
    expect(fuss).toContain('src="assets/logo/wortmarke.svg"');
    expect(index).not.toMatch(/class="(?:aufdecken|riesen)"/);
  });

  it('Die Seite sagt alles: je Leistung Ausgangslage · Was wir tun · Was danach steht · Dauer & Form und ein Schema; Gründer; 5–7 Fragen', () => {
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    for (const id of ['angebot-interim-cso', 'angebot-head-of-sales', 'angebot-sichtbarkeit', 'angebot-events']) {
      const art = new RegExp(`<article class="leistung raster" id="${id}"[\\s\\S]*?</article>`).exec(index)?.[0] ?? '';
      for (const begriff of ['Ausgangslage', 'Was wir tun', 'Was danach steht', 'Dauer &amp; Form']) expect(art, `${id} ${begriff}`).toContain(`<dt class="mikro">${begriff}</dt>`);
      // Jedes Schema sagt, dass es eins ist (oder ein Beispiel) — keine echten Zahlen, Kunden oder Termine.
      expect(art, id).toMatch(/<figure class="schema">\s*<figcaption class="mikro">(?:Schema|Beispiel) · /);
    }
    const reihenfolge = ['id="haltung"', 'id="markttraktion"', 'id="weg"', 'id="make-one"', 'id="beteiligungen"', 'id="ueber-uns"', 'id="fragen"', 'id="kontakt"'].map(a => index.indexOf(a));
    expect(reihenfolge.every((w, i) => w > 0 && (i === 0 || w > reihenfolge[i - 1]))).toBe(true);
    const fragen = /<div class="fragen[^"]*">[\s\S]*?<\/div>/.exec(index)?.[0] ?? '';
    const zahl = (fragen.match(/<details>/g) ?? []).length;
    expect(zahl).toBeGreaterThanOrEqual(5);
    expect(zahl).toBeLessThanOrEqual(7);
    // Gründer: nur belegte Angaben (Malin, Kevin Dieckmann; Satz zur Vertriebserfahrung von Kevin gewählt, 08.10.).
    const gruender = /<section class="abschnitt" id="ueber-uns"[\s\S]*?<\/section>/.exec(index)?.[0] ?? '';
    expect(gruender).toContain('<h3>Malin</h3>');
    expect(gruender).toContain('<h3>Kevin Dieckmann</h3>');
    expect(gruender).toContain('aufgebaut — in Fintech, Software und Beratung');
  });
});
