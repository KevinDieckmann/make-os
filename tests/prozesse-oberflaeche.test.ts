// ─── Prozesse · Oberfläche (Etappe A, 21.10.; ANALYSE_100.md Punkte 1, 11–15, 20, 21, 24, 26, 27, 30, 93) ─────────────────────────────────────
// Ohne Browser: die Zeichnungen der drei Ebenen (SSR-Markup), die Liste aus demselben Modell, das Vollbild (Adresse rein, Seite und Fulfillment-Editor),
// Wächter für den Standard (Bausteine aus ../ui, keine Farb-Literale, Lichtfaden als Linie, reduzierte Bewegung, interne Navigation nur über next/link).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/prozesse' }));

import { SYSTEM_PROZESSE } from '@/lib/prozesse/register';
import { fliegeLage, prozessLage } from '@/lib/prozesse/landkarte';
import { alsVorlage, endeSchritte } from '@/lib/prozesse/modell';
import { flaecheBild } from '@/lib/fulfillment/prozesse/flaeche';
import { LandkarteBild, ProzessBild, AblaufBild } from '@/components/os/prozesse/Bilder';
import { ProzessListe } from '@/components/os/prozesse/ProzessListe';
import { SteckbriefKarte, SchrittKarte } from '@/components/os/prozesse/Feld';
import { vollAdresse } from '@/components/os/ui/flaeche/vollbild';
import { KUERZEL } from '@/components/os/prozesse/ProzesseSeite';
import type { Zahl } from '@/lib/prozesse/typen';

const wurzel = process.cwd();
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');
const ORDNER = 'components/os/prozesse';
const dateien = readdirSync(path.join(wurzel, ORDNER)).map(n => `${ORDNER}/${n}`);
const L = SYSTEM_PROZESSE;
const nach = new Map(L.map(p => [p.id, p]));
const zahlen: Record<string, Zahl> = { 'sp-followup': { wert: 3, wort: 'fällig', zweite: { wert: 1, wort: 'überfällig', rot: true }, href: '/os/markttraktion?s=followup' }, 'sp-deal': { wert: 0, wort: 'offen' } };
const svg = (kind: ReturnType<typeof h>) => renderToStaticMarkup(h('svg', null, kind));

describe('Ebene 1: die Fliege', () => {
  const lage = fliegeLage(L);
  const nichts = () => {};
  it('jede Kachel ist ein Knopf mit Namen (Titel, Zahl, „System“), Tastatur und Kennung zum Aufleuchten', () => {
    const html = svg(h(LandkarteBild, { lage, prozesse: nach, zahlen, stufe: 'mittel', spitze: 's', onKachel: nichts, onZahl: nichts }));
    for (const p of L) expect(html, p.id).toContain(`data-pz-id="${p.id}"`);
    expect((html.match(/role="button"/g) ?? []).length).toBe(L.length);
    expect(html).toContain('aria-label="Follow-up &amp; Power Hour, 3 fällig, 1 überfällig — System, nur lesbar; öffnen"');
    // Stufen als Wort (Farbe nie allein), Bänder, Übergaben beschriftet.
    for (const w of ['MARKETING', 'SALES', 'ÜBERGABE', 'FULFILLMENT', 'AUSBAU', 'FÜHRUNG', 'UNTERSTÜTZUNG', 'SQL', 'gewonnen']) expect(html, w).toContain(w);
    // Die Zahl: Wort dabei, „überfällig“ mit Zeichen; nie eine Null.
    expect(html).toContain('3 fällig');
    expect(html).toContain('1 überfällig');
    expect(html).not.toContain('0 offen');
  });
  it('semantischer Zoom: fern kurzer Titel + EINE Zahl, ohne Beschriftung der Wege; nah dazu Marke und Eigner', () => {
    const fern = svg(h(LandkarteBild, { lage, prozesse: nach, zahlen, stufe: 'fern', spitze: 's', onKachel: nichts, onZahl: nichts }));
    expect(fern).toContain('>Netzwerken<');
    expect(fern).not.toMatch(/>[^<]*Veranstaltungen\)?</); // sichtbarer Text nur kurz — der Name für Vorleser bleibt vollständig
    expect(fern).toContain('aria-label="Netzwerken (Erfassen auf Veranstaltungen)');
    expect(fern).not.toContain('>1 überfällig<');
    expect(fern).toContain('>3 fällig<');
    expect(fern).not.toContain('>gewonnen<');
    const nah = svg(h(LandkarteBild, { lage, prozesse: nach, zahlen, stufe: 'nah', spitze: 's', onKachel: nichts, onZahl: nichts }));
    expect(nah).toContain('SYSTEM · NUR LESBAR');
    expect(nah).toContain('Head of Sales');
  });
});

describe('Ebene 2 und 3', () => {
  const deal = nach.get('sp-deal')!;
  it('Prozess: Start, Phasen als Knöpfe, höchstens vier Schritte, Geister mit Richtung', () => {
    const html = svg(h(ProzessBild, { lage: prozessLage(deal, L), prozess: deal, zahlen: {}, stufe: 'mittel', spitze: 's', onPhase: () => {}, onGeist: () => {} }));
    expect(html).toContain('>Start<');
    expect(html).toContain('>Ergebnis<');
    for (const ph of deal.phasen) expect(html).toContain(`data-pz-id="${ph.id}"`);
    expect(html).toContain('KOMMT VON');
    expect(html).toContain('GEHT AN');
    expect(html).toContain('aria-label="Phase 3: Angebot, 4 Schritte — Ablauf öffnen"');
  });
  it('Ablauf: dieselben Formen wie der Editor, nur lesbar; Enden tragen „Ende“ und keinen Pfeil weiter', () => {
    const bild = flaecheBild(alsVorlage(deal));
    const ende = endeSchritte(deal);
    const html = svg(h(AblaufBild, { bild, prozess: deal, zahlen: {}, gewaehlt: 'ag-1', stufe: 'mittel', spitze: 's', ende, onSchritt: () => {}, onPhase: () => {} }));
    expect(html).toContain('■ Ende');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Verloren mit Grund, Ende dieses Wegs — Schritt öffnen');
    expect(bild.pfeile.some(pf => ende.has(pf.von))).toBe(true); // im Modell gibt es den Weg weiter …
    for (const id of ende) expect(html).not.toContain(`d="M${bild.knoten.find(k => k.id === id)!.x}`); // … die Zeichnung zeigt ihn nicht
  });
  it('Feld: Steckbrief mit sechs Feldern (Phasen nur als Zahl, das Bild zeigt sie), Fälle mit Weg; Schritt mit Weg in Worten', () => {
    const fu = nach.get('sp-followup')!;
    const st = renderToStaticMarkup(h(SteckbriefKarte, { p: fu, zahl: zahlen['sp-followup'] }));
    for (const f of ['Auslöser', 'Eingang', 'Phasen', 'Ergebnis', 'Empfänger', 'Eigner', '3 Phasen', 'Fälle ansehen', 'System · nur lesbar', 'Wo es läuft']) expect(st, f).toContain(f);
    const ab = deal.phasen.find(p => p.id === 'abschluss')!;
    const sk = renderToStaticMarkup(h(SchrittKarte, { p: deal, ph: ab, s: ab.schritte[0], zahl: undefined }));
    expect(sk).toContain('Wenn ja: weiter bei „Deal gewonnen“');
  });
});

describe('Liste (Punkte 20, 30)', () => {
  it('dasselbe Modell als verschachtelte Liste — jeder Prozess, Rauten in Worten, „Im Bild zeigen“', () => {
    const html = renderToStaticMarkup(h(ProzessListe, { prozesse: L, zahlen, pfad: {} }));
    for (const p of L) expect(html, p.id).toContain(p.titel.replace(/&/g, '&amp;'));
    expect(html).toContain('Wenn ja: weiter bei');
    expect(html).toContain('Alle Prozesse als Text kopieren');
    const einer = renderToStaticMarkup(h(ProzessListe, { prozesse: L, zahlen, pfad: { p: 'sp-deal', ph: 'angebot' } }));
    expect(einer).toContain('<details class="pz-liste-prozess" open="">');
    expect(einer).toContain('Im Bild zeigen');
    expect(einer).not.toContain('Kampagnen (Playbooks)');
  });
});

describe('Vollbild (Punkt 11) und Präsentieren (Punkt 93)', () => {
  it('die Adresse: an setzt voll=1, aus nimmt voll und Präsentieren weg — alle übrigen Parameter bleiben', () => {
    expect(vollAdresse('/os/prozesse', 'p=sp-deal', true)).toBe('/os/prozesse?p=sp-deal&voll=1');
    expect(vollAdresse('/os/prozesse', '?p=sp-deal&voll=1&modus=praesentieren', false)).toBe('/os/prozesse?p=sp-deal');
    expect(vollAdresse('/os/mandate/fulfillment', 'e=fp-x', true)).toBe('/os/mandate/fulfillment?e=fp-x&voll=1');
  });
  it('die Seite: Overlay über Leiste und Kopf (Portal, aria-modal), Esc zurück, Fullscreen-API des Dokuments, Präsentieren blättert', () => {
    const s = lies(`${ORDNER}/ProzesseSeite.tsx`);
    expect(s).toContain('createPortal(');
    expect(s).toContain('aria-modal="true"');
    expect(s).toContain("vollbild.an({ modus: 'praesentieren' })");
    expect(s).toMatch(/if \(e\.key === 'Escape'\)/);
    expect(s).toContain("['ArrowRight', 'PageDown', ' ']");
    const v = lies('components/os/ui/flaeche/vollbild.ts');
    expect(v).toContain('document.documentElement.requestFullscreen');
    expect(v).toContain("addEventListener('fullscreenchange'");
    const css = lies('app/globals.css');
    expect(css).toMatch(/\.pz-voll \{ position: fixed; inset: 0; z-index: 1500;/);
  });
  it('der Prozess-Editor im Fulfillment hat dasselbe Vollbild (Knopf, ?voll=1, Esc)', () => {
    const f = lies('components/os/fulfillment/editor/Flaeche.tsx');
    expect(f).toContain("import { useVollbild } from '../../ui/flaeche/vollbild';");
    expect(f).toContain("ff-flaeche-voll");
    expect(f).toContain('vollbild.aus()');
    expect(f).toContain('vollbild.an()');
    expect(lies('app/globals.css')).toMatch(/\.ff-flaeche\.ff-flaeche-voll \{ position: fixed; inset: 0;/);
  });
  it('Kürzel: Alt+1, Alt+2, Minimap, Zoom, Vollbild, Hilfe — Einzeltasten abschaltbar', () => {
    const t = KUERZEL.map(k => k.taste);
    for (const k of ['Esc', 'Alt + 1', 'Alt + 2', 'M', '?']) expect(t).toContain(k);
    expect(KUERZEL.filter(k => k.einzel).map(k => k.taste)).toEqual(['M', '+ / −', 'F', '?']);
    expect(lies(`${ORDNER}/ProzesseSeite.tsx`)).toContain("MERKER_EINZELTASTEN = 'make-prozesse-einzeltasten'");
  });
});

describe('Standard und Wächter', () => {
  it('die Seite gibt es, sie hängt an den Bausteinen (Seite, Karte aus ../ui) und lädt nur die Business-Route', () => {
    expect(existsSync(path.join(wurzel, 'app/os/prozesse/page.tsx'))).toBe(true);
    expect(lies('app/os/prozesse/page.tsx')).toContain('<ProzesseSeite />');
    const s = lies(`${ORDNER}/ProzesseSeite.tsx`);
    expect(s).toContain("from '../ui'");
    expect(s).toContain('<Seite titel="Prozesse"');
    expect(lies(`${ORDNER}/daten.ts`)).toContain("'/api/prozesse/landkarte?space=business'");
  });
  it('keine Farb-Literale in den Ansichten (Farben nur aus den Token), keine Schrift unter 11 px, kein <a href="/os…">', () => {
    for (const f of dateien.filter(d => /\.tsx?$/.test(d))) {
      const q = lies(f).split('\n').filter(z => !z.trim().startsWith('//')).join('\n');
      expect(q, f).not.toMatch(/['"`]#[0-9a-fA-F]{3,8}['"`]/);
      expect(q, f).not.toMatch(/rgba?\(/);
      expect(q, f).not.toMatch(/fontSize[=:]\s*\{?\s*(9|10)(?![\d.])/);
      expect(q, f).not.toMatch(/<a href=["'{`]\/os/);
    }
  });
  it('der Lichtfaden ist die einzige Linie (Flow-Ebene unter dem SVG), reduzierte Bewegung = Standbild, Eingabe nur am SVG', () => {
    const b = lies(`${ORDNER}/Buehne.tsx`);
    expect(b).toContain('flowEbene(c, b, { ruhig: bewegungReduziert()');
    expect(b).toContain('flaecheEingabe(el, {');
    expect(b).not.toMatch(/(window|document)\.addEventListener\(\s*['"](wheel|gesture|touch|pointer)/);
    expect(b).toContain('if (ruhig()) { setze(ziel); dann?.(); return; }');
    const css = lies('app/globals.css');
    expect(css).toContain('@media (prefers-reduced-motion: reduce) { [data-pz-leuchten] > .pz-leuchtrand { animation: none; } }');
    // Die Striche der Wege blendet dieselbe Regel wie im Editor aus, solange der Flow läuft (die Bühne trägt die Klasse der Fläche).
    expect(b).toContain('className={`ff-flaeche-buehne pz-buehne');
  });
  it('nichts Persönliches in den neuen Dateien (Plattform-Regel)', () => {
    for (const f of [...dateien, 'lib/prozesse/typen.ts', 'lib/prozesse/modell.ts', 'lib/prozesse/landkarte.ts', 'lib/prozesse/server.ts', 'lib/prozesse/vorlagen.ts', 'components/os/ui/flaeche/vollbild.ts']) {
      expect(lies(f), f).not.toMatch(/\b(kevin|malin|kemaris|ventures)\b/i);
    }
  });
});
