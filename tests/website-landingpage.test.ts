// ─── Landingpage makeinnovation.de: Freigabe-Prüfung (01.10., v3: Markttraktion, Make.One, Beteiligungen) ───────
// website/pruefen.mjs entscheidet, ob die Seite online darf. Hier wird geprüft, dass der Prüfer selbst stimmt:
// Bau-Regeln heute grün (nur die Platzhalter halten die Freigabe auf), Platzhalter und Regelbrüche werden erkannt.
// Ob heute noch Platzhalter offen sind, prüft dieser Test bewusst NICHT — das ist Kevins Freigabe, kein Fehler.
import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeWebsite, ANMELDEN, NICHT_OEFFENTLICH, VERSTECKT, LOGO_DATEIEN, ANGEBOTE, BUCHUNG_MUSTER, ERSTGESPRAECH_MAIL, MAIL_BETREFFE } from '../website/pruefen.mjs';

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
    ersetze(k, 'impressum.html', 'HRB Beispielwert', 'HRB [[KEVIN: Nummer]]');
    const r = pruefeWebsite(k);
    expect(r.freigabefaehig).toBe(false);
    expect(r.platzhalter).toEqual([expect.objectContaining({ datei: 'impressum.html', text: 'Nummer' })]);
  });

  it('gelbe Markierung ohne Platzhalter darin fällt auf', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'impressum.html', 'HRB Beispielwert', 'HRB <span class="ph">12345</span>');
    expect(pruefeWebsite(k).fehler.join('\n')).toMatch(/gelbe Platzhalter-Markierung/);
  });

  it('Logo-Dateien sind da, die Bühne zeichnet dieselbe Bildmarke, Kopf und Favicons zeigen darauf', () => {
    for (const d of LOGO_DATEIEN) expect(existsSync(join(ORDNER, d)), d).toBe(true);
    const k = kopie();
    fuellen(k);
    // Ein anderer Punkt in der Bühne fällt genauso auf wie ein anderer Zug.
    ersetze(k, 'index.html', /(<svg class="zeichen"[\s\S]*?)<circle cx="120" cy="92"/, '$1<circle cx="120" cy="136"');
    rmSync(join(k, 'assets/logo/kompakt.svg'));
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Bühnen-Zeichen weicht von assets\/logo\/bildmarke\.svg ab/);
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
});
