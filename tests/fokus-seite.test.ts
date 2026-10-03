// Event-Seite fokusinnovation.de (fokus/, 03.10.): Bau-Regeln, gemeinsame Dateien aus EINER Quelle, Inhalt ohne Erfundenes.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeFokus, TERMIN, MENGEN, EXTERN_ERLAUBT, impressumKern } from '../fokus/pruefen.mjs';
import { pruefen, STAEDTE, UMRISS, projiziere, karteSvg } from '../scripts/fokus-seite.mjs';

const wurzel = process.cwd();
const FOKUS = join(wurzel, 'fokus');

/** Eine Kopie von fokus/ + website/ zum Verändern (der echte Ordner bleibt unberührt). */
function kopie() {
  const d = mkdtempSync(join(tmpdir(), 'fokus-seite-'));
  cpSync(FOKUS, join(d, 'fokus'), { recursive: true });
  cpSync(join(wurzel, 'website'), join(d, 'website'), { recursive: true });
  return { d, fokus: join(d, 'fokus'), aendern: (datei: string, f: (t: string) => string) => writeFileSync(join(d, 'fokus', datei), f(readFileSync(join(d, 'fokus', datei), 'utf8'))), weg: () => rmSync(d, { recursive: true, force: true }) };
}

describe('fokus/ — Freigabe-Prüfung', () => {
  it('Bau-Regeln sind erfüllt; offen sind nur die Datenschutz-Platzhalter', () => {
    const r = pruefeFokus(FOKUS);
    expect(r.fehler).toEqual([]);
    expect(r.platzhalter.every((p: { datei: string }) => p.datei === 'datenschutz.html')).toBe(true);
    expect(r.groesse).toBeLessThan(250 * 1024);
  });

  it('gemeinsame und erzeugte Dateien passen zur Quelle (node scripts/fokus-seite.mjs)', async () => {
    expect(await pruefen(wurzel)).toEqual([]);
  });

  it('erfundene Termine, Mengen, Formulare, fremde Links und Inline-Stile fallen auf', () => {
    const k = kopie();
    try {
      k.aendern('index.html', t => t.replace('<span>Termin in Planung</span>', '<span>12.11.2026</span>')
        .replace('Gespräche mit Substanz.', 'Gespräche mit Substanz. 40 Gäste, 99 € <form></form><a href="https://example.com">x</a> <i style="color:red">y</i>'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/Berlin — Zeile mit „Termin in Planung“ fehlt/);
      expect(f).toMatch(/keine Termine/);
      expect(f).toMatch(/keine erfundenen Zahlen/);
      expect(f).toMatch(/keine Preise/);
      expect(f).toMatch(/Formular/);
      expect(f).toMatch(/unerwarteter externer Link https:\/\/example\.com/);
      expect(f).toMatch(/Inline-Stile/);
    } finally { k.weg(); }
  });

  it('gemeinsame Dateien: weicht Schrift, Impressum oder ein Token von makeinnovation.de ab, ist die Seite nicht freigabefähig', () => {
    const k = kopie();
    try {
      writeFileSync(join(k.fokus, 'assets/fonts/archivo-latin.woff2'), 'kaputt');
      k.aendern('impressum.html', t => t.replace('HRB 19873', 'HRB 1'));
      k.aendern('css/fokus.css', t => t.replace('--aktiv: #58D9CD;', '--aktiv: #FF0000;'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/archivo-latin\.woff2: weicht von website/);
      expect(f).toMatch(/Pflichtangaben weichen von website\/impressum\.html ab/);
      expect(f).toMatch(/Token --aktiv/);
    } finally { k.weg(); }
  });

  it('Mail nur an die MAKE-Adresse mit Betreff „Fokus Innovation …“; Firmierung und Absender auf jeder Seite', () => {
    const k = kopie();
    try {
      k.aendern('index.html', t => t.replace('subject=Fokus%20Innovation%20Hamburg%20%E2%80%93%20Teilnahme', 'subject=Hallo'));
      k.aendern('datenschutz.html', t => t.split('eine Marke der KEMARIS Innovation GmbH').join('eine Marke'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/Betreff „Hallo“/);
      expect(f).toMatch(/datenschutz\.html: Firmierung/);
    } finally { k.weg(); }
  });

  it('Muster: Datum und Mengen ja, Nummerierung und „fünf Städte“ nein', () => {
    for (const ja of ['am 12.11.', '12.11.2026', '5. November', 'November 2026']) expect(TERMIN.test(ja)).toBe(true);
    for (const nein of ['§ 5 DDG', 'Art. 6 Abs. 1', '01 Ankommen']) expect(TERMIN.test(nein)).toBe(false);
    expect(MENGEN.test('40 Gäste')).toBe(true);
    expect(MENGEN.test('02   Unternehmen und Rolle')).toBe(false);
    expect(MENGEN.test('in fünf Städte')).toBe(false);
    expect(EXTERN_ERLAUBT).toContain('https://makeinnovation.de');
  });

  it('Impressum = Pflicht-Block von makeinnovation.de, wörtlich', () => {
    const hier = impressumKern(readFileSync(join(FOKUS, 'impressum.html'), 'utf8'));
    expect(hier.length).toBeGreaterThan(200);
    expect(hier).toBe(impressumKern(readFileSync(join(wurzel, 'website', 'impressum.html'), 'utf8')));
  });
});

describe('Karte — echte Positionen', () => {
  it('fünf Städte, Berlin ist der Knoten; Lage stimmt in Himmelsrichtung', () => {
    expect(STAEDTE.map((s: { name: string }) => s.name)).toEqual(['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München']);
    const p = Object.fromEntries(STAEDTE.map((s: { id: string; breite: number; laenge: number }) => [s.id, projiziere([s.breite, s.laenge])]));
    expect(p.hamburg[1]).toBeLessThan(p.berlin[1]); // Hamburg nördlicher
    expect(p.muenchen[1]).toBeGreaterThan(p.koeln[1]); // München südlicher als Köln
    expect(p.koeln[0]).toBeLessThan(p.bielefeld[0]); // Köln westlicher als Bielefeld
    expect(p.berlin[0]).toBeGreaterThan(p.hamburg[0]); // Berlin östlicher als Hamburg
    const svg = karteSvg();
    expect((svg.match(/class="faden faden-rot"/g) ?? []).length).toBe(4);
    expect(svg).toContain('data-stadt="berlin"');
  });
  it('jede Stadt liegt im Umriss (Punkt-in-Polygon)', () => {
    const proj = projiziere as (p: number[]) => [number, number];
    const poly = (UMRISS as number[][]).map(p => proj(p));
    const innen = ([x, y]: [number, number]) => { let drin = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin; } return drin; };
    for (const s of STAEDTE as { name: string; breite: number; laenge: number }[]) expect(innen(proj([s.breite, s.laenge])), s.name).toBe(true);
  });
});
