// ─── Design-Standard · Kern (03.10., DESIGN_STANDARD.md › Umgestellt: Kern) ─────
// Globale Shell (Kopf, Leiste, ZOE-Fenster), Aufgaben, Kalender und Inbox hängen an den gemeinsamen Bausteinen aus components/os/ui.
// Der Test hält fest, was umgestellt wurde — und dass nichts zurückfällt (kleine Tippziele, alte Importe, Mini-Schrift).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { FADEN_FARBEN, LEUCHT } from '@/lib/make-one/design';
import { zielFarben, bezugNachListe, bezugVonAufgabe } from '@/lib/aufgaben/ziel-bezug';
import { meilensteinListeId } from '@/lib/planung/meilenstein-aufgaben';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/aufgaben' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

/** Rasterzellen (Zeitraster, Monat, Jahr, 4 Tage): dichte Fläche, der Block ist das Tippziel, Schrift mindestens 12 px. */
const RASTER = ['Zeitraster', 'Monat', 'Jahr', 'VierTage'].map(n => `components/os/kalender/${n}.tsx`);
const BEREICH = [
  ...dateien('components/os/aufgaben'), ...dateien('components/os/kalender'), ...dateien('components/os/inbox'),
  'components/os/AufgabenView.tsx', 'components/os/AufgabenBoard.tsx', 'components/os/InboxSchlank.tsx', 'components/os/InboxView.tsx', 'components/os/KalenderAufgabenSchalter.tsx',
];
const SHELL = ['components/os/Kopf.tsx', 'components/os/Leiste.tsx', 'components/os/Glocke.tsx'];

describe('Aufgaben, Kalender und Inbox hängen am Standard', () => {
  it('der Bereich hat die erwarteten Dateien', () => { expect(BEREICH.length).toBeGreaterThanOrEqual(60); });

  it('keine Datei holt Bausteine mehr aus schlank.tsx (alles über ui)', () => {
    expect(BEREICH.filter(f => /from '(\.\.\/|\.\/)schlank'/.test(lies(f)))).toEqual([]);
  });

  it('Fließtext steht nicht unter 13 px — außer Beschriftungen in Großbuchstaben', () => {
    const funde: string[] = [];
    for (const f of [...BEREICH.filter(x => !RASTER.includes(x)), ...SHELL]) {
      lies(f).split('\n').forEach((z, i) => { if (/fontSize: (10|10\.5|11|11\.5|12|12\.5)(?![\d.])/.test(z) && !/uppercase|MIKRO|TYP\.mikro/.test(z)) funde.push(`${f}:${i + 1}`); });
    }
    expect(funde).toEqual([]);
  });

  it('Rasterzellen gehen nicht unter 12 px', () => {
    const funde: string[] = [];
    for (const f of RASTER) lies(f).split('\n').forEach((z, i) => { if (/fontSize: (9|10|10\.5|11|11\.5)(?![\d.])/.test(z) && !/uppercase|MIKRO/.test(z)) funde.push(`${f}:${i + 1}`); });
    expect(funde).toEqual([]);
  });

  it('Seitenkopf über den Baustein Seite (kein eigenes h1)', () => {
    expect(BEREICH.filter(f => /<h1[ >]/.test(lies(f)))).toEqual([]);
  });

  it('Schließen, Entfernen und Hinweis-Kreuze sind SymbolKnöpfe (40/44 px), keine nackten ×/✕-Knöpfe', () => {
    const funde = BEREICH.filter(f => />\s*[×✕]\s*<\/button>/.test(lies(f)));
    expect(funde).toEqual([]);
  });

  it('Abhaken-Kreise haben echte Trefferfläche (HakenZiel) in Baum, Detail, Überblick, Akte, Notiz, Kalender', () => {
    for (const f of ['components/os/aufgaben/BaumAnsicht.tsx', 'components/os/aufgaben/AufgabeDetail.tsx', 'components/os/aufgaben/Ueberblick.tsx', 'components/os/aufgaben/AufgabenAkte.tsx', 'components/os/kalender/aufgaben.tsx', 'components/os/kalender/AufgabenModus.tsx']) {
      const t = lies(f);
      expect(t, f).toContain('<HakenZiel ');
      expect(t, f).not.toMatch(/<Haken /);
    }
  });
});

describe('Bausteine HakenZiel und SymbolKnopf', () => {
  it('HakenZiel: Knopf mit 44-px-Fläche, sichtbares 24-px-Feld, sagt Zustand und Titel', async () => {
    const { HakenZiel } = await import('@/components/os/ui');
    const offen = renderToStaticMarkup(h(HakenZiel, { an: false, onChange: () => {}, label: 'Steuer' }));
    expect(offen).toContain('ui-haken-ziel');
    expect(offen).toContain('aria-pressed="false"');
    expect(offen).toContain('als erledigt markieren');
    expect(offen).toContain('width:24px');
    expect(renderToStaticMarkup(h(HakenZiel, { an: true, onChange: () => {} }))).toContain('✓');
  });

  it('SymbolKnopf: Pflicht-Beschriftung, getrennt vom Nachbarn, Gefahr rot', async () => {
    const { SymbolKnopf } = await import('@/components/os/ui');
    const x = renderToStaticMarkup(h(SymbolKnopf, { ariaLabel: 'Löschen', gefahr: true }, '✕'));
    expect(x).toContain('aria-label="Löschen"');
    expect(x).toContain('ui-symbol');
    expect(x).toContain(LEUCHT.kritisch);
    expect(renderToStaticMarkup(h(SymbolKnopf, { ariaLabel: 'Weg', eingebettet: true }, '×'))).toContain('ui-symbol-ein');
  });

  it('globals.css kennt die Ziele: Haken, Symbole, Kopf-Kreise, Monatsblatt, ZOE-Fenster', () => {
    const css = lies('app/globals.css');
    for (const k of ['.ui-haken-ziel', '.ui-symbol', '.ui-symbole', '.kopf-rund', '.kopf-index-zeile', '.ui-monat-punkte', '.ui-mini-monat', '.ui-ziel-text']) expect(css, k).toContain(k);
    expect(css).toMatch(/\.kopf-rund \{ width: 40px; height: 40px;/);
    expect(css).toMatch(/\.zoe-fenster \{ right: 8px !important; width: calc\(100vw - 16px\) !important;/);
  });
});

describe('Globale Shell', () => {
  it('Kopf: runde Knöpfe über .kopf-rund (kein festes 34 px mehr), Index-Schalter am Handy in eigener Zeile', () => {
    const k = lies('components/os/Kopf.tsx');
    expect(k).not.toMatch(/width: 34/);
    expect(k).toContain('className="kopf-rund"');
    expect(k).toContain('kopf-index-zeile');
    expect(lies('components/os/Glocke.tsx')).toContain('kopf-rund');
  });

  it('Leiste unten leuchtet nur auf Seiten des Space (N3) und trägt den offenen Blattkasten mit', () => {
    const l = lies('components/os/Leiste.tsx');
    expect(l).toContain('an: aktiv.space === s.id || offen === s.id');
    expect(l).not.toContain("an: space === s.id && pfad !== '/os'");
  });

  it('Blatt und Leistenzeilen: Tippziele, Typo-Stufen aus den Token', () => {
    const l = lies('components/os/Leiste.tsx');
    expect(l).toContain('minHeight: 44');
    expect(l).toContain('fontSize: TYP.body');
    expect(l).toContain('fontSize: TYP.bedien');
  });

  it('ZOE-Fenster: Breite und Höhe ziehen den Rand ab (nicht mehr 6 px links abgeschnitten)', () => {
    const z = lies('components/os/ZoePanel.tsx');
    expect(z).toContain('calc(100vw - ${fenster.right + 8}px)');
    expect(z).not.toContain('calc(100vw - 16px))`, height');
  });
});

describe('Ziel-Bezug (Aufgabe → Meilenstein → Ziel)', () => {
  const ziele = [
    { id: 'z2', titel: 'B-Ziel', space: 'business' as const, rang: 2 },
    { id: 'z1', titel: 'A-Ziel', space: 'business' as const, rang: 1 },
    { id: 'zp', titel: 'Fit', space: 'privat' as const, rang: 1 },
    { id: 'zx', titel: 'Fertig', space: 'business' as const, rang: 3, erledigt: true },
  ];
  it('Farben wie in den Lichtfäden: je Space nach Rang durch FADEN_FARBEN', () => {
    const f = zielFarben(ziele);
    expect(f.get('z1')).toBe(FADEN_FARBEN.business[0]);
    expect(f.get('z2')).toBe(FADEN_FARBEN.business[1]);
    expect(f.get('zp')).toBe(FADEN_FARBEN.privat[0]);
    expect(f.get('zx')).toBe(FADEN_FARBEN.ohne);
  });
  it('findet das Ziel über die Liste des Meilensteins — ohne Meilenstein-Liste kein Bezug', () => {
    const karte = bezugNachListe(ziele, [{ id: 'ms1', titel: 'Vorlage', zielId: 'z1' }, { id: 'ms2', titel: 'Ohne', zielId: 'gibtsnicht' }, { id: 'ms3', titel: 'Abgeleitet', abgeleitetVon: 'zp' }]);
    const b = bezugVonAufgabe({ listeId: meilensteinListeId('ms1') }, karte);
    expect(b?.zielTitel).toBe('A-Ziel');
    expect(b?.meilensteinTitel).toBe('Vorlage');
    expect(bezugVonAufgabe({ listeId: meilensteinListeId('ms2') }, karte)).toBeNull();
    expect(bezugVonAufgabe({ listeId: meilensteinListeId('ms3') }, karte)?.zielId).toBe('zp');
    expect(bezugVonAufgabe({ listeId: 'l-normal' }, karte)).toBeNull();
    expect(bezugVonAufgabe(undefined, karte)).toBeNull();
  });
  it('ZielChip zeigt Titel und Meilenstein in der Ziel-Farbe, rein als Anzeige', async () => {
    const { ZielChip } = await import('@/components/os/ui');
    const html = renderToStaticMarkup(h(ZielChip, { bezug: { zielId: 'z1', zielTitel: 'A-Ziel', farbe: FADEN_FARBEN.business[0], meilensteinId: 'ms1', meilensteinTitel: 'Vorlage' }, mitMeilenstein: true }));
    expect(html).toContain('A-Ziel');
    expect(html).toContain('Vorlage');
    expect(html).toContain('ui-chip');
    expect(html).not.toContain('<button');
  });
  it('Aufgaben-Baum und Detail zeigen den Ziel-Chip', () => {
    expect(lies('components/os/aufgaben/BaumAnsicht.tsx')).toContain('<ZielChip');
    expect(lies('components/os/aufgaben/AufgabeDetail.tsx')).toContain('<ZielChip');
  });
});

describe('Kalender', () => {
  it('Mini-Monat: Vor-/Folgemonat als SymbolKnopf, Tage mit 40-px-Fläche und Beschriftung', () => {
    const k = lies('components/os/kalender/Kalender.tsx');
    expect(k).toContain('ariaLabel="Vormonat"');
    expect(k).toContain('ariaLabel="Folgemonat"');
    expect(k).toContain('ui-mini-monat');
    expect(k).toMatch(/minHeight: 40,/);
  });
  it('Monatsblatt: Zelle ist ein Tippziel mit Beschriftung, am Handy Punkte statt Pillen', () => {
    const m = lies('components/os/kalender/Monat.tsx');
    expect(m).toContain('role="button"');
    expect(m).toContain('ui-monat-punkte');
    expect(m).toContain('ui-monat-pillen');
  });
  it('Einstellungen: freie Tage entfernen ist ein SymbolKnopf', () => {
    expect(lies('components/os/kalender/EinstellungenBelegt.tsx')).toContain('<SymbolKnopf');
  });
});

describe('Inbox', () => {
  it('Thread bricht lange Adressen um (kein Überlauf) und das Mehr-Menü ist eine Fläche mit ganzen Knöpfen', () => {
    const g = lies('components/os/inbox/GmailDetail.tsx');
    expect(g).toContain("gridTemplateColumns: 'minmax(0, 1fr)'");
    expect(g).toContain('aria-label="Weitere Aktionen"');
  });
  it('Antwort-Entwurf im Standard-Feld, Meldungen als Hinweis-Karte', () => {
    const i = lies('components/os/InboxSchlank.tsx');
    expect(i).toContain('aria-label="Antwort-Entwurf"');
    expect(i).toContain('<Hinweis art="info"');
  });
});
