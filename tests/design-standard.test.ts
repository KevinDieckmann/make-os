// ─── Design-Standard (03.10., DESIGN_STANDARD.md) ───────────────────────────
// Kevin: „Den Standard überall reinbringen.“ Der Test hält fest, was der Standard verspricht: die Bausteine rendern mit ihren Klassen, Rollen und
// Maßen; Netzwerken und Markttraktion hängen an den gemeinsamen Bausteinen (nicht mehr an schlank.tsx bzw. eigenen Kopien); die Dokumentation nennt jeden Baustein.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ZIEL, ECKE, RAND, FLAECHE_STIL, BEDEUTUNG_FARBE, TYP, FARBE, TIEF } from '@/lib/make-one/design';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/markttraktion' }));

// Kurzform ohne Typzwang (die Bausteine verlangen `children` im Props-Typ; hier zählt das Ergebnis im HTML).
const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

describe('Token', () => {
  it('Ziele: Hauptaktion 48, Handy 44, Rechner 40', () => {
    expect(ZIEL).toEqual({ haupt: 48, handy: 44, rechner: 40 });
  });
  it('Ecken, Ränder, Flächen und Bedeutung sind festgelegt', () => {
    expect(ECKE).toEqual({ eingabe: 12, knopf: 14, flach: 16, karte: 20 });
    expect(RAND.leer).toContain('dashed');
    expect(Object.keys(FLAECHE_STIL).sort()).toEqual(['eingabe', 'flach', 'gehoben', 'getoent', 'leise']);
    expect(FLAECHE_STIL.getoent('#58D9CD').border).toContain(TIEF.rand('#58D9CD'));
    expect(Object.keys(BEDEUTUNG_FARBE).sort()).toEqual(['achtung', 'gut', 'info', 'kritisch', 'neutral']);
  });
  it('Typo-Stufen: Beschriftung 11, Bedienung 13, Fließtext 15', () => {
    expect([TYP.mikro, TYP.bedien, TYP.body, TYP.titel]).toEqual([11, 13, 15, 20]);
  });
});

describe('Bausteine (components/os/ui)', () => {
  it('Hinweis: Bedeutung bestimmt Farbe, Symbol und Rolle', async () => {
    const { Hinweis } = await import('@/components/os/ui');
    const kritisch = renderToStaticMarkup(h(Hinweis, { art: 'kritisch' }, 'Das ging schief.'));
    expect(kritisch).toContain('role="alert"');
    expect(kritisch).toContain(TIEF.rand(BEDEUTUNG_FARBE.kritisch));
    expect(kritisch).toContain('<svg');
    const gut = renderToStaticMarkup(h(Hinweis, { art: 'gut', rolle: 'status', titel: 'Gespeichert' }, 'Alles da.'));
    expect(gut).toContain('role="status"');
    expect(gut).toContain('Gespeichert');
    // Kurzform aus Netzwerken: farbe = Zustandsfarbe → gleiche Bedeutung
    const alt = renderToStaticMarkup(h(Hinweis, { farbe: FARBE.achtung }, 'Achtung.'));
    expect(alt).toContain(TIEF.rand(BEDEUTUNG_FARBE.achtung));
    // neutral: ohne Symbol, Haarrand
    const neutral = renderToStaticMarkup(h(Hinweis, null, 'Nur eine Notiz.'));
    expect(neutral).not.toContain('<svg');
  });

  it('Knopf: haupt = 48-px-Klasse, voll = ganze Breite, leise ohne Tönung; Link mit href', async () => {
    const { Knopf } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(Knopf, { haupt: true, voll: true, children: 'Weiter' }))).toMatch(/ui-knopf[^"]*ui-knopf-haupt[^"]*ui-knopf-voll/);
    expect(renderToStaticMarkup(h(Knopf, { leise: true, children: 'Abbrechen' }))).not.toContain('ui-knopf-haupt');
    const link = renderToStaticMarkup(h(Knopf, { href: '/os/netzwerken/karte', children: 'Karte' }));
    expect(link).toContain('<a ');
    expect(link).toContain('href="/os/netzwerken/karte"');
    expect(renderToStaticMarkup(h(Knopf, { aus: true, children: 'Nicht jetzt' }))).toContain('disabled');
  });

  it('Karte: gehoben, flach, getönt — und Seite trägt den Anker der Handy-Regeln', async () => {
    const { Karte, Seite } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(Karte, null, 'x'))).toContain('linear-gradient(165deg');
    expect(renderToStaticMarkup(h(Karte, { flach: true }, 'x'))).toContain('ui-karte-flach');
    const ton = renderToStaticMarkup(h(Karte, { ton: '#FF9F43' }, 'x'));
    expect(ton).toContain(TIEF.rand('#FF9F43'));
    const seite = renderToStaticMarkup(h(Seite, { titel: 'Titel', unter: 'Ein Satz.', rechts: h('b', null, 'Aktion') }, 'Inhalt'));
    expect(seite).toContain('class="ui-seite"');
    expect(seite).toContain('<h1');
    expect(seite).toContain('ui-kopf-unter');
    expect(seite).toContain('ui-karten');
  });

  it('Pillen/Segmente: aria-pressed, einzeilig wischt; Reiter hat Rolle tablist', async () => {
    const { Pillen, Segmente, Reiter } = await import('@/components/os/ui');
    const liste = [{ id: 'a', label: 'Eins' }, { id: 'b', label: 'Zwei' }];
    const p = renderToStaticMarkup(h(Pillen, { liste, aktiv: 'a', onWahl: () => {}, einzeilig: true }));
    expect(p).toContain('ui-pillen-einzeilig');
    expect(p).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(h(Segmente, { liste, aktiv: 'b', onWahl: () => {} }))).toContain('ui-segmente');
    const r = renderToStaticMarkup(h(Reiter, { liste, aktiv: 'a', onWahl: () => {} }));
    expect(r).toContain('role="tablist"');
    expect(r).toContain('aria-selected="true"');
  });

  it('Raster: Kennzahl-Raster ab min ≤ 180, Zahl steht darin als Kachel-Klasse', async () => {
    const { Raster, Zahl } = await import('@/components/os/ui');
    const klein = renderToStaticMarkup(h(Raster, { min: 150 }, h(Zahl, { wert: '5', label: 'offen' })));
    expect(klein).toContain('ui-raster-kacheln');
    expect(klein).toContain('ui-zahl');
    expect(renderToStaticMarkup(h(Raster, { min: 360 }, 'x'))).not.toContain('ui-raster-kacheln');
  });

  it('Leerzustand und Leer: Symbol, Satz, Weg', async () => {
    const { Leerzustand, Leer } = await import('@/components/os/ui');
    const l = renderToStaticMarkup(h(Leerzustand, { symbol: h('i', null), titel: 'Noch nichts da', aktion: h('button', null, 'Anlegen') }, 'Lege das erste an.'));
    expect(l).toContain('ui-leerzustand');
    expect(l).toContain('Noch nichts da');
    expect(l).toContain('Anlegen');
    expect(renderToStaticMarkup(h(Leer, null, 'Nichts.'))).toContain('ui-leer');
  });

  it('Zeile: Pfeil nur mit Klick und ohne Zusatz rechts; Titel und Zusatz stehen in eigenen Klassen', async () => {
    const { Zeile } = await import('@/components/os/ui');
    expect(renderToStaticMarkup(h(Zeile, { titel: 'A', unter: 'b', onClick: () => {} }))).toContain('ui-zeile-pfeil');
    expect(renderToStaticMarkup(h(Zeile, { titel: 'A', onClick: () => {}, rechts: 'x' }))).not.toContain('ui-zeile-pfeil');
    expect(renderToStaticMarkup(h(Zeile, { titel: 'A' }))).not.toContain('ui-zeile-pfeil');
  });

  it('Eingaben: 48 px und 16 px (kein Zoom am iPhone), kompakt 44 px', async () => {
    const { eingabe, feld } = await import('@/components/os/ui');
    expect(eingabe.fontSize).toBe(16);
    expect(eingabe.minHeight).toBe(48);
    expect(feld.minHeight).toBe(44);
  });
});

describe('Netzwerken und Markttraktion hängen am Standard', () => {
  it('die Dateien der Markttraktion importieren keine Bausteine mehr aus schlank.tsx', () => {
    const direkt = dateien('components/os/crm').filter(f => /from '(\.\.\/)+schlank'/.test(lies(f)));
    expect(direkt).toEqual([]);
  });

  it('Netzwerken: Bausteine kommen aus ../ui (bausteine.tsx reicht nur durch)', () => {
    const b = lies('components/os/netzwerken/bausteine.tsx');
    expect(b).toMatch(/from '\.\.\/ui'/);
    for (const alt of ['export function Gross', 'export function Wahl', 'export function Hinweis', 'export function Leerzustand', 'export function Aktionsleiste', 'export function Initialen']) expect(b).not.toContain(alt);
  });

  it('Markttraktion-Fließtext steht nicht unter 13 px — außer Beschriftungen in Großbuchstaben', () => {
    // 11 / 11,5 / 12,5 px kommen im Fließtext der Markttraktion nicht mehr vor (nur als Beschriftung mit `uppercase`, Mikro-Stufe).
    const funde: string[] = [];
    for (const f of dateien('components/os/crm')) {
      lies(f).split('\n').forEach((z, i) => { if (/fontSize: (11|11\.5|12\.5)(?![\d.])/.test(z) && !z.includes('uppercase')) funde.push(`${f}:${i + 1}`); });
    }
    expect(funde).toEqual([]);
  });

  it('einfache Meldungen sind Hinweis-Karten: kein „color: LEUCHT.kritisch“-Text mit role="alert" in einer Zeile mehr', () => {
    const funde: string[] = [];
    for (const f of dateien('components/os/crm')) {
      lies(f).split('\n').forEach((z, i) => { if (/<div role="alert" style=\{\{ (fontSize: [^,]+, )?color: LEUCHT\.kritisch \}\}>/.test(z)) funde.push(`${f}:${i + 1}`); });
    }
    expect(funde).toEqual([]);
  });

  it('Handy-Netz: `.ui-seite` erzwingt 44 px und 16 px nur unter dem Anker', () => {
    const css = lies('app/globals.css');
    const ab = css.slice(css.indexOf('Sicherheitsnetz für Seiten im Standard'));
    const netz = ab.slice(0, ab.indexOf('\n}\n') + 3);
    expect(netz).toContain('.ui-seite button');
    expect(netz).toContain('min-height: 44px !important');
    expect(netz).toContain('font-size: 16px !important');
    // kein seitenweiter Hammer: jede Regel im Netz beginnt mit .ui-seite
    const regeln = netz.split('\n').filter(z => /^\s+\.[a-z]/.test(z) && !z.trim().startsWith('.ui-seite'));
    expect(regeln).toEqual([]);
  });
});

describe('Planung, Fokus und Lichtfäden hängen am Standard (03.10., „Fokus auf die Ziele, visualisiert durch die Lichtfäden“)', () => {
  const PLANUNG = ['components/os/HorizontView.tsx', 'components/os/FokusView.tsx', ...dateien('components/os/planung'), ...dateien('components/os/lichtfaeden')];
  it('keine Bausteine mehr aus schlank.tsx', () => {
    expect(PLANUNG.filter(f => /from '(\.\.?\/)+schlank'/.test(lies(f)))).toEqual([]);
  });
  it('Fließtext nicht unter 13 px — außer Beschriftungen in Großbuchstaben (Chips/Achsen 12 px erlaubt)', () => {
    const funde: string[] = [];
    for (const f of PLANUNG) lies(f).split('\n').forEach((z, i) => { if (/fontSize: (9|10|11|11\.5|12\.5)(?![\d.])/.test(z) && !z.includes('uppercase') && !z.includes('PfeilRang')) funde.push(`${f}:${i + 1}`); });
    expect(funde.filter(f => !f.startsWith('components/os/planung/PfeilRang.tsx'))).toEqual([]);
  });
  it('Seitenhinweise sind Hinweis-Karten (kein „<div role=\"status\" style={{ … color: LEUCHT.achtung }}>“ mehr)', () => {
    const funde: string[] = [];
    for (const f of PLANUNG) lies(f).split('\n').forEach((z, i) => { if (/<div role="(status|alert)" style=\{\{ fontSize: [^,]+, color: LEUCHT\.(achtung|kritisch)( \}|, marginBottom)/.test(z)) funde.push(`${f}:${i + 1}`); });
    expect(funde).toEqual([]);
  });
  it('die Lichtfäden-Karte steht auf Jahr, Ziel, Meilenstein und Fokus', () => {
    expect(lies('components/os/HorizontView.tsx')).toMatch(/<Lichtfaeden wurzel=\{spaceFilter === 'alle' \? 'gesamt'/);
    expect(lies('components/os/planung/ZielDetail.tsx')).toContain('<Lichtfaeden wurzel={`ziel:');
    expect(lies('components/os/planung/MeilensteinDetail.tsx')).toContain('<Lichtfaeden wurzel={`ms:');
    expect(lies('components/os/FokusView.tsx')).toContain('<Lichtfaeden wurzel="gesamt"');
  });
});

describe('Aufräumen 04.10.: der Standard überall (keine Altbausteine mehr)', () => {
  // Begründete Ausnahmen: components/os/ui reicht die Nicht-Standard-Teile (Ring, Balken, Punkt, Haken, Spalten, useHochzaehlen, LEUCHT …)
  // aus schlank.tsx durch — über EINE Stelle. Sonst holt keine Datei mehr etwas aus schlank.tsx.
  const AUSNAHMEN = ['components/os/ui/index.ts', 'components/os/ui/flaechen.tsx'];
  const ALLE = [...dateien('components'), ...dateien('app')];
  it('kein Import aus schlank.tsx außerhalb von components/os/ui', () => {
    const direkt = ALLE.filter(f => !AUSNAHMEN.includes(f) && /from '(@\/components\/os\/|(\.\.?\/)+)schlank'/.test(lies(f)));
    expect(direkt).toEqual([]);
  });
  it('die umgestellten Seiten: Fließtext nicht unter 13 px, Fehler als Hinweis-Karte', () => {
    const UMGESTELLT = ['BoardView', 'ContentView', 'MeetingView', 'ProspectingView', 'ResearchView', 'RoadmapView', 'RitualView', 'OnboardingView',
      'TageslaufView', 'ZusammenarbeitView', 'HeuteView', 'Abhaengigkeit', 'Faelligkeit'].map(n => `components/os/${n}.tsx`)
      .concat(dateien('components/os/bauplan'), dateien('components/os/zeit'), ['components/os/heute/Anstehend.tsx', 'components/os/netzwerken/MeineKarte.tsx',
        'components/os/mandate/ProdukteMandate.tsx', 'components/os/austausch/BeitragsVerlauf.tsx']);
    const klein: string[] = []; const fehler: string[] = [];
    for (const f of UMGESTELLT) lies(f).split('\n').forEach((z, i) => {
      if (/fontSize: (9|10|11\.5|12|12\.5)(?![\d.])/.test(z) && !z.includes('uppercase')) klein.push(`${f}:${i + 1}`);
      if (/\{(fehler|err|api\.fehler) && <(div|span)[^>]*color: LEUCHT\.kritisch/.test(z)) fehler.push(`${f}:${i + 1}`);
    });
    expect(klein).toEqual([]);
    expect(fehler).toEqual([]);
  });
});

describe('Dokumentation', () => {
  it('DESIGN_STANDARD.md nennt jeden Baustein und jeden Token', () => {
    const md = lies('DESIGN_STANDARD.md');
    for (const n of ['Seite', 'Karte', 'Ueberschrift', 'Titel', 'Kennzahl', 'Zeile', 'Eigenschaft', 'Knopf', 'Gross', 'Wahl', 'Pillen', 'Segmente', 'Reiter', 'Chip', 'Hinweis', 'Leerzustand', 'Erfolg', 'Schritte', 'Fortschritt', 'eingabe', 'Aktionsleiste']) expect(md, n).toContain(n);
    for (const t of ['ZIEL', 'ECKE', 'RAND', 'FLAECHE_STIL', 'BEDEUTUNG_FARBE']) expect(md, t).toContain(t);
    expect(md).toContain('prefers-reduced-motion');
  });
});
