// Event-Seite fokusinnovation.de (fokus/, 03.10.; „Klar“ 05.10.): Bau-Regeln, gemeinsame Dateien aus EINER Quelle, Inhalt ohne
// Erfundenes, Showreel nach denselben Regeln wie makeinnovation.de.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pruefeFokus, TERMIN, MENGEN, EXTERN_ERLAUBT, impressumKern, GROESSE_MAX, SZENE_MAX } from '../fokus/pruefen.mjs';
import { pruefen, STAEDTE, UMRISS, projiziere, karteSvg, markenHtml, staedteJs } from '../scripts/fokus-seite.mjs';

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
    expect(r.groesse).toBeLessThan(GROESSE_MAX);
    expect(r.szene).toBeLessThan(SZENE_MAX);
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
      k.aendern('index.html', t => t.replace('subject=Fokus%20Innovation%20%E2%80%93%20Gastgeber', 'subject=Hallo'));
      k.aendern('datenschutz.html', t => t.split('eine Marke der KEMARIS Innovation GmbH').join('eine Marke'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/Betreff „Hallo“/);
      expect(f).toMatch(/Knopf „Gastgeber werden“/);
      expect(f).toMatch(/datenschutz\.html: Firmierung/);
    } finally { k.weg(); }
  });

  it('Überschrift und Kartentitel nennen die Zahl der Städte (sechs, seit Dresden 04.10.)', () => {
    const k = kopie();
    try {
      k.aendern('index.html', t => t.replace('in sechs Städte.', 'in fünf Städte.'));
      expect(pruefeFokus(k.fokus).fehler.join('\n')).toMatch(/„in sechs Städte\.“ erwartet/);
    } finally { k.weg(); }
  });

  it('Muster: Datum und Mengen ja, Nummerierung und „sechs Städte“ nein', () => {
    for (const ja of ['am 12.11.', '12.11.2026', '5. November', 'November 2026']) expect(TERMIN.test(ja)).toBe(true);
    for (const nein of ['§ 5 DDG', 'Art. 6 Abs. 1', '01 Ankommen']) expect(TERMIN.test(nein)).toBe(false);
    expect(MENGEN.test('40 Gäste')).toBe(true);
    expect(MENGEN.test('02   Unternehmen und Rolle')).toBe(false);
    expect(MENGEN.test('in sechs Städte')).toBe(false);
    expect(EXTERN_ERLAUBT).toContain('https://makeinnovation.de');
  });

  it('Impressum = Pflicht-Block von makeinnovation.de, wörtlich', () => {
    const hier = impressumKern(readFileSync(join(FOKUS, 'impressum.html'), 'utf8'));
    expect(hier.length).toBeGreaterThan(200);
    expect(hier).toBe(impressumKern(readFileSync(join(wurzel, 'website', 'impressum.html'), 'utf8')));
  });
});

describe('Städte — EINE Liste (Review 03.10.)', () => {
  it('fokus/pruefen.mjs (ohne Abhängigkeiten) prüft dieselben Städte, die scripts/fokus-seite.mjs zeichnet', async () => {
    const { STAEDTE: GEPRUEFT } = await import('../fokus/pruefen.mjs');
    expect(GEPRUEFT).toEqual(Object.fromEntries((STAEDTE as { id: string; name: string }[]).map(s => [s.id, s.name])));
  });
  it('fokus/pruefen.mjs nimmt alleDateien aus website/pruefen.mjs (keine Kopie)', async () => {
    const { readFileSync } = await import('node:fs');
    const t = readFileSync(new URL('../fokus/pruefen.mjs', import.meta.url), 'utf8');
    expect(t).not.toMatch(/function alleDateien/);
    expect(t).toMatch(/import \{[^}]*\balleDateien\b[^}]*\} from '\.\.\/website\/pruefen\.mjs'/);
  });
});

describe('Karte — echte Positionen', () => {
  it('sechs Städte, Berlin ist der Knoten; Lage stimmt in Himmelsrichtung', () => {
    expect(STAEDTE.map((s: { name: string }) => s.name)).toEqual(['Berlin', 'Hamburg', 'Bielefeld', 'Köln', 'München', 'Dresden']);
    const dresden = (STAEDTE as { id: string; breite: number; laenge: number }[]).find(s => s.id === 'dresden')!;
    expect([dresden.breite, dresden.laenge]).toEqual([51.0504, 13.7373]); // echte Koordinaten (Kevin 04.10.)
    const p = Object.fromEntries(STAEDTE.map((s: { id: string; breite: number; laenge: number }) => [s.id, projiziere([s.breite, s.laenge])]));
    expect(p.hamburg[1]).toBeLessThan(p.berlin[1]); // Hamburg nördlicher
    expect(p.muenchen[1]).toBeGreaterThan(p.koeln[1]); // München südlicher als Köln
    expect(p.koeln[0]).toBeLessThan(p.bielefeld[0]); // Köln westlicher als Bielefeld
    expect(p.berlin[0]).toBeGreaterThan(p.hamburg[0]); // Berlin östlicher als Hamburg
    expect(p.dresden[1]).toBeGreaterThan(p.berlin[1]); // Dresden südlicher als Berlin
    expect(p.dresden[0]).toBeGreaterThan(p.berlin[0]); // … und ein Stück östlicher
    const svg = karteSvg();
    expect((svg.match(/class="faden faden-rot"/g) ?? []).length).toBe(5);
    expect(svg).toContain('Fokus Innovation in sechs Städten');
    expect(svg).toContain('data-stadt="berlin"');
  });
  it('jede Stadt liegt im Umriss (Punkt-in-Polygon)', () => {
    const proj = projiziere as (p: number[]) => [number, number];
    const poly = (UMRISS as number[][]).map(p => proj(p));
    const innen = ([x, y]: [number, number]) => { let drin = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) drin = !drin; } return drin; };
    for (const s of STAEDTE as { name: string; breite: number; laenge: number }[]) expect(innen(proj([s.breite, s.laenge])), s.name).toBe(true);
  });
});

describe('Showreel „Klar“ (05.10.) — dieselben Regeln wie makeinnovation.de', () => {
  it('Standbild, Lichter, Buchstaben-Bewegung, Schluss mit Wortmarke, Stempel und H1 fallen auf, wenn sie nicht stimmen', () => {
    const k = kopie();
    try {
      rmSync(join(k.fokus, 'assets/szene/abend.svg'));
      k.aendern('index.html', t => t.replace('<canvas class="verlauf" aria-hidden="true"></canvas>', '<canvas class="verlauf" aria-hidden="true"></canvas><canvas></canvas>')
        .replace('<h2 id="themen-titel">', '<h2 id="themen-titel" data-aufstieg>')
        .replace('src="assets/logo/fokus-wortmarke.svg"', 'src="assets/logo/make-quer.svg"')
        .replace(/css\/fokus\.css\?v=[a-f0-9]{10}/, 'css/fokus.css?v=0000000000')
        .replace('Fokus <span class="ruhig">Innovation</span></h1>', 'Fokus</h1>'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/assets\/szene\/abend\.svg: fehlt \(node website\/standbild\.mjs fokus\)/);
      expect(f).toMatch(/3 Leinwände — die Lichter stehen an höchstens 2 Stellen/);
      expect(f).toMatch(/Buchstaben-Bewegung nur an der H1/);
      expect(f).toMatch(/Schlussblock ohne Wortmarke \(assets\/logo\/fokus-wortmarke\.svg\)/);
      expect(f).toMatch(/css\/fokus\.css ohne aktuellen Stempel/);
      expect(f).toMatch(/H1 „Fokus Innovation“ fehlt/);
    } finally { k.weg(); }
  });

  it('eine geänderte Kopie der Szene oder eine Stadt, die in Drehbuch oder Beschriftung fehlt, fällt auf', () => {
    const k = kopie();
    try {
      k.aendern('js/szene/spur.js', t => `${t}\n// eigene Fassung\n`);
      k.aendern('js/drehbuch.js', t => t.replace("{ name: 'Dresden', lat: ", "{ name: 'Leipzig', lat: "));
      k.aendern('index.html', t => t.replace('data-nr="5">Dresden</span>', 'data-nr="5">Leipzig</span>'));
      const f = pruefeFokus(k.fokus).fehler.join('\n');
      expect(f).toMatch(/js\/szene\/spur\.js: weicht von website\/js\/szene\/spur\.js ab/);
      expect(f).toMatch(/js\/drehbuch\.js: Stadt Dresden fehlt auf der Karte der Szene/);
      expect(f).toMatch(/Stadt Dresden fehlt in den Beschriftungen der Szene/);
    } finally { k.weg(); }
  });

  it('die Szene zählt nicht in die 250 KB, hat aber ihre eigene Grenze; das Eigene der Seite bleibt bei 250 KB', () => {
    const k = kopie();
    try {
      writeFileSync(join(k.fokus, 'assets/szene/abend.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${' '.repeat(260 * 1024)}</svg>`);
      expect(pruefeFokus(k.fokus).fehler.join('\n')).toMatch(/KB ausgeliefert \(ohne die Kopie der Szene\) — höchstens 250 KB/);
    } finally { k.weg(); }
  });

  it('die Städte stehen aus EINER Liste im Drehbuch und in den Beschriftungen der Szene (node scripts/fokus-seite.mjs)', () => {
    const drehbuch = readFileSync(join(FOKUS, 'js', 'drehbuch.js'), 'utf8'), index = readFileSync(join(FOKUS, 'index.html'), 'utf8');
    for (const zeile of staedteJs().split('\n')) expect(drehbuch).toContain(zeile.trim());
    for (const zeile of markenHtml().split('\n')) expect(index).toContain(zeile);
    expect(markenHtml()).toContain('class="marke stadt start" data-zustand="staedte" data-nr="0">Berlin</span>');
  });

  it('kein Vorhang, kein Laufband, kein Kachel-Flug — und die Szene ruht erst, wenn der Schluss sie verdeckt', () => {
    const drehbuch = readFileSync(join(FOKUS, 'js', 'drehbuch.js'), 'utf8'), index = readFileSync(join(FOKUS, 'index.html'), 'utf8');
    expect(drehbuch).toMatch(/vorhang: false/);
    expect(index).not.toMatch(/class="(?:laufband|flug|kacheln|karussell)/);
    expect(drehbuch).toMatch(/ruht: p => p > \.9/);
  });
});
