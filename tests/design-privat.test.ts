// ─── Design-Standard · Privat, ZOE, System (03.10., DESIGN_STANDARD.md) ─────
// Gesundheit (mit Sport), Familie & Partnerschaft, Kompass, Brain, Privat-Übersicht, Wachstum, ZOE (Stapel, Agenten, Loops, HOI) und System
// (Konto, Verbindungen, Datenbasis, Stammdaten) hängen an den gemeinsamen Bausteinen aus components/os/ui. Der Test hält fest, was umgestellt wurde,
// dass nichts zurückfällt — und die reine Auswahl des Ziel-Bezugs („zahlt ein auf …“).
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { zielBezug, type BezugZiel } from '@/lib/make-one/ziel-bezug';
import { zielThema } from '@/lib/lichtfaeden/modell';
import type { Meilenstein } from '@/lib/planung/typen';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/gesundheit' }));

const h = (c: unknown, props: unknown, ...kids: unknown[]) => createElement(c as never, props as never, ...(kids as never[]));
const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
function dateien(dir: string, ende = /\.tsx?$/): string[] {
  return readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel, ende) : ende.test(n) ? [rel] : [];
  });
}

/** Alle Dateien des Bereichs Privat · ZOE · System. */
const ORDNER = ['components/os/familie', 'components/os/sport', 'components/os/wissen', 'components/os/gesundheit', 'components/os/flaeche'];
const EINZELN = [
  'GesundheitView', 'JournalView', 'ErnaehrungView', 'EnergieView', 'WhoopImport', 'RoutinenPlanerView', 'SaeuleView', 'KompassView', 'WissenView',
  'SpaceUebersichtView', 'HomeView', 'WachstumView', 'StapelView', 'StapelVoll', 'AgentenView', 'AgentenHirn', 'LoopView', 'HoiView', 'TeamKarte',
  'KontoView', 'AnmeldeAdressen', 'SystemView', 'VerbindungenView', 'DatenbasisView', 'StammdatenView', 'ZoeStart',
].map(n => `components/os/${n}.tsx`);
const ALLE = [...ORDNER.flatMap(d => dateien(d)), ...EINZELN];

describe('Privat · ZOE · System hängen am Standard', () => {
  it('der Bereich hat die erwarteten Dateien', () => {
    expect(ALLE.length).toBeGreaterThanOrEqual(46);
  });

  it('keine Datei holt Bausteine mehr aus schlank.tsx (alles über ../ui)', () => {
    const direkt = ALLE.filter(f => /from '(\.\.\/|\.\/)schlank'/.test(lies(f)));
    expect(direkt).toEqual([]);
  });

  it('Fließtext steht nicht unter 13 px — kleinere Schrift nur als Beschriftung in Großbuchstaben', () => {
    const funde: string[] = [];
    for (const f of ALLE) {
      lies(f).split('\n').forEach((z, i) => {
        if (/fontSize: (10|10\.5|11|11\.5|12|12\.5)(?![\d.])/.test(z) && !/uppercase|MIKRO/.test(z)) funde.push(`${f}:${i + 1}`);
      });
    }
    expect(funde).toEqual([]);
  });

  it('Seitenkopf über den Baustein `Seite` (kein eigenes h1)', () => {
    expect(ALLE.filter(f => /<h1[ >]/.test(lies(f)))).toEqual([]);
  });

  it('Umschalter stehen im Inhalt als wischbare Leiste, nicht im Kopf (Gesundheit, Familie, Sport)', () => {
    for (const f of ['components/os/GesundheitView.tsx', 'components/os/familie/FamilieView.tsx', 'components/os/sport/SportView.tsx']) {
      const t = lies(f);
      expect(t, f).toContain('<Segmente');
      expect(/rechts=\{[^}]*<Segmente/.test(t), f).toBe(false);
    }
  });

  it('Fehler sind Hinweis-Karten mit Bedeutung (kritisch), nicht eine rote Zeile', () => {
    for (const f of ['components/os/HoiView.tsx', 'components/os/LoopView.tsx', 'components/os/StammdatenView.tsx', 'components/os/sport/SportView.tsx']) {
      expect(lies(f), f).toMatch(/<Hinweis art="kritisch"/);
    }
  });
});

describe('Konto: beschriftete Felder statt abgeschnittener Platzhalter', () => {
  it('Passwort, Anmelde-Adressen und Zweiter Faktor nutzen Feldzeile', () => {
    const k = lies('components/os/KontoView.tsx');
    expect(k).not.toContain('placeholder="altes Passwort"');
    expect(k).not.toContain('placeholder="neues, mindestens 10 Zeichen"');
    expect(k).toContain('<Feldzeile label="Altes Passwort">');
    expect(k).toContain('Neues Passwort (mindestens 10 Zeichen)');
    const a = lies('components/os/AnmeldeAdressen.tsx');
    expect(a).toContain('<Feldzeile label="Aktuelles Passwort zur Bestätigung">');
    expect(a).not.toContain('placeholder="aktuelles Passwort"');
  });

  it('die EINE getönte Karte ist der Zweite Faktor, Fehler stehen als Hinweis', () => {
    const k = lies('components/os/KontoView.tsx');
    expect(k).toContain('<Karte i={2} ton={ich.zweiterFaktorAn');
    expect(k).toContain('<Hinweis art={meldungKritisch ?');
  });

  it('globals.css kennt die Feldreihe', () => {
    expect(lies('app/globals.css')).toContain('.konto-feldreihe');
  });
});

describe('Praxis-Fund N7: Rücklage speichert mit Enter', () => {
  it('die Rücklage-Karte ist ein Formular mit Absenden', () => {
    const p = lies('components/os/privat/PrivatIndex.tsx');
    expect(p).toMatch(/<form onSubmit=\{e => \{ e\.preventDefault\(\); void speichern\(\); \}\}/);
    expect(p).toContain('typ="submit"');
  });
});

describe('Ziel-Bezug — die reine Auswahl', () => {
  // Die Farbe kommt im Betrieb vom Server (lib/planung/ziel-farben-server.ts); hier eine Platzhalter-Farbe je Ziel.
  const z = (id: string, titel: string, rang: number, extra: Partial<BezugZiel> = {}): BezugZiel => ({ id, titel, fortschritt: 40, rang, space: 'privat', horizont: 'jahr', farbe: `#${id.padEnd(6, '0').slice(0, 6).replace(/[^0-9a-f]/gi, '0')}`, ...extra });
  const m = (id: string, zielId: string, extra: Partial<Meilenstein> = {}): Meilenstein => ({ id, titel: id, bereich: 'gesundheit', space: 'privat', zielId, fortschritt: 20, erledigt: false, ...extra });
  const ziele = [z('z1', 'Rücklage aufbauen', 1), z('z2', 'Fit und beschwerdefrei', 2), z('z3', 'Mehr Zeit als Paar', 3), z('zb', 'Umsatz', 1, { space: 'business' })];

  it('Gesundheit: das Thema der Meilensteine führt zum Ziel („zahlt ein auf“) — dieselbe Zuordnung wie die Lichtfäden (zielThema)', () => {
    const r = zielBezug('gesundheit', ziele, [m('m1', 'z2')]);
    expect(r.map(x => x.id)).toEqual(['z2']);
    expect(r[0].grund).toBe('thema');
    expect(zielThema(ziele[1], [m('m1', 'z2')])).toBe('gesundheit');
    // Meilenstein an einem abgeleiteten Ziel zählt für das Jahresziel.
    const mitQuartal = [...ziele, z('z2~quartal', 'Etappe', 0, { horizont: 'quartal', abgeleitetVon: 'z2' })];
    expect(zielBezug('training', mitQuartal, [m('m2', 'z2~quartal')]).map(x => [x.id, x.grund])).toEqual([['z2', 'thema']]);
  });

  it('keine Stichworte mehr: „Profit“, „Buchhaltung“, „Paar“ im Titel stiften keinen Bezug — ehrlich „Oberstes Ziel“', () => {
    const l = [z('p1', 'Profit steigern', 1), z('p2', 'Buchhaltung digital', 2), z('p3', 'Mehr Zeit als Paar', 3)];
    for (const b of ['gesundheit', 'training', 'wissen', 'beziehung'] as const) {
      const r = zielBezug(b, l, []);
      expect(r.map(x => [x.id, x.grund])).toEqual([['p1', 'rang']]);
    }
    // Keine Stichwort-Liste und kein Personenname mehr im Code.
    const code = lies('lib/make-one/ziel-bezug.ts').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/stichwort|malin|kevin|RegExp|\.test\(/i);
    expect(code).toContain('zielThema');
  });

  it('ohne Treffer zeigt der Bereich das oberste private Ziel — ehrlich als „rang“, nie ein Business-Ziel', () => {
    const r = zielBezug('wissen', ziele, []);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('z1');
    expect(r[0].grund).toBe('rang');
  });

  it('Space ohne Angabe ist Business (spaceVonZiel, dieselbe Regel wie Planung und Lichtfäden) — kein privates Ziel', () => {
    expect(zielBezug('privat', [z('ohne', 'Ohne Space', 1, { space: undefined })], [])).toEqual([]);
  });

  it('nur Jahresziele; erledigte Ziele zählen nicht; ohne Ziele bleibt die Liste leer', () => {
    expect(zielBezug('gesundheit', [z('z2', 'Fit', 1, { erledigt: true })], [m('m1', 'z2')])).toEqual([]);
    expect(zielBezug('privat', [z('w', 'Woche', 1, { horizont: 'woche' })], [])).toEqual([]);
    expect(zielBezug('privat', [], [])).toEqual([]);
  });

  it('höchstens `max` Treffer; die Farbe ist die vom Server gelieferte (der Ziel-Bezug rechnet keine)', () => {
    expect(zielBezug('privat', ziele, [], 1)).toHaveLength(1);
    const viele = [z('a', 'Eins', 1), z('b', 'Zwei', 2), z('c', 'Drei', 3)];
    const rr = zielBezug('gesundheit', viele, viele.map(v => m(`m-${v.id}`, v.id)), 5);
    expect(rr.map(x => x.id)).toEqual(['a', 'b', 'c']);
    expect(rr.map(x => x.farbe)).toEqual(viele.map(v => v.farbe));
  });

  it('der Baustein hält beim ersten Zeichnen seinen Platz (kein Springen) und ist für Hilfsmittel versteckt', async () => {
    const { ZielBezug } = await import('@/components/os/ui/ziel-bezug');
    const html = renderToStaticMarkup(h(ZielBezug, { bereich: 'gesundheit' }));
    expect(html).toContain('ui-ziel-bezug');
    expect(html).toContain('aria-hidden');
    expect(html).toContain('min-height:44px');
  });
});
