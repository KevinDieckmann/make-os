// ─── Landingpage makeinnovation.de: Freigabe-Prüfung (01.10., v2: Logo, Produkte, Sperrliste) ────────────────
// website/pruefen.mjs entscheidet, ob die Seite online darf. Hier wird geprüft, dass der Prüfer selbst stimmt:
// Bau-Regeln heute grün (nur die Platzhalter halten die Freigabe auf), Platzhalter und Regelbrüche werden erkannt.
// Ob heute noch Platzhalter offen sind, prüft dieser Test bewusst NICHT — das ist Kevins Freigabe, kein Fehler.
import { describe, it, expect, afterAll } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeWebsite, ANMELDEN, NICHT_OEFFENTLICH, VERSTECKT, LOGO_DATEIEN, PRODUKTE } from '../website/pruefen.mjs';

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
    ersetze(k, 'index.html', 'd="M48 184L48 64L120 136"', 'd="M50 176L50 72L119 141"');
    rmSync(join(k, 'assets/logo/kompakt.svg'));
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Bühnen-Zeichen weicht von assets\/logo\/bildmarke\.svg ab/);
    expect(f).toMatch(/srcset assets\/logo\/kompakt\.svg — Datei fehlt/);
    expect(f).toMatch(/assets\/logo\/kompakt\.svg: fehlt/);
  });

  it('Produkte: Markttraktion und Make.One aktiv, genau ein „Coming Soon“ — bei Development', () => {
    expect(PRODUKTE).toEqual({ 'produkt-markttraktion': 'aktiv', 'produkt-make-one': 'aktiv', 'produkt-development': 'bald' });
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index.match(/Coming Soon/g)).toHaveLength(1);
    expect(index).toContain('href="mailto:hello@makeinnovation.de?subject=Make.One%20%E2%80%93%20Einladung%20anfragen"');
    const k = kopie();
    fuellen(k);
    // Make.One wieder auf „Coming Soon“ zu setzen, fällt auf — ebenso ein fehlender Mail-Knopf.
    ersetze(k, 'index.html', /(<article[^>]*id="produkt-make-one"[\s\S]*?)<span class="abzeichen aktiv">Verfügbar<\/span>/, '$1<span class="abzeichen bald">Coming Soon</span>');
    ersetze(k, 'index.html', 'href="mailto:hello@makeinnovation.de?subject=Make.One%20%E2%80%93%20Einladung%20anfragen"', 'href="#kontakt"');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/#produkt-make-one ist aktiv/);
    expect(f).toMatch(/2 × „Coming Soon“/);
  });

  it('auf der Seite steht nur MAKE: fremde Namen und gesperrte Wörter fallen auf', () => {
    const k = kopie();
    fuellen(k);
    const fremd = ['Cap' + 'OS', 'POIN' + 'CAP', 'KEM' + 'ARIS', 'AST' + 'ARNA', 'Conn' + 'ect', 'One' + 'Banking', 'K' + 'SI', 'Capital ' + 'Readiness'];
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

  it('erkennt tote Links und einen fehlenden Anmelden-Knopf', () => {
    const k = kopie();
    fuellen(k);
    ersetze(k, 'index.html', 'href="#gruender"', 'href="#gibt-es-nicht"');
    ersetze(k, 'datenschutz.html', /href="https:\/\/app\.makeinnovation\.de\/anmelden"/g, 'href="index.html"');
    const f = pruefeWebsite(k).fehler.join('\n');
    expect(f).toMatch(/Anker #gibt-es-nicht fehlt/);
    expect(f).toMatch(/datenschutz\.html: Anmelden-Knopf/);
  });

  it('Anmelden zeigt auf die Software, Kontakt per mailto, Arbeitsdateien sind benannt', () => {
    expect(ANMELDEN).toBe('https://app.makeinnovation.de/anmelden');
    const index = readFileSync(join(ORDNER, 'index.html'), 'utf8');
    expect(index).toContain('href="mailto:hello@makeinnovation.de"');
    // Dieselben Dateien versteckt die Freigabe-Fassung der Caddyfile (hide nach Namen, @intern nach Pfad).
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    expect(caddy).toContain(`hide ${VERSTECKT.join(' ')}`);
    for (const d of NICHT_OEFFENTLICH) expect(caddy).toMatch(new RegExp(`@intern path [^\\n]*/${d.replace(/\./g, '\\.')}( |$)`, 'm'));
  });
});
