// Kalender: linke Spalte einklappbar (09.10.). Kevin: „Guck mal, ob du den Kalender links einklappbar machen kannst, das sieht noch so
// verloren aus … dann sieht man den Kalender danach besser und er hat ausreichend Platz.“
// Geprüft: Merker (Vorgabe offen, „zu“ bleibt, gesperrter Speicher), Taste ⌘B/Strg+B (nicht im Feld, nicht ⌘.), nur breit einklappbar,
// Planen öffnet eine zugeklappte Spalte, und die Seite hängt die Regeln so ein (Knöpfe mit aria-expanded, Erstellen bleibt erreichbar).

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LINKS_ID, LINKS_MERKER, LINKS_TASTE, linksOffenLesen, linksOffenMerken, linksSichtbar, linksTaste, oeffnenFuerPlanen } from '@/components/os/kalender/klappen';

const lies = (rel: string) => readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const t = (key: string, x: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean; defaultPrevented: boolean }> = {}) =>
  ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...x });

describe('Kalender — linke Spalte einklappen', () => {
  it('Merker je Browser: eigener Schlüssel, Vorgabe offen, „zu“ bleibt zu, gesperrter Speicher → offen ohne Fehler', () => {
    expect(LINKS_MERKER).toBe('make-kalender-links');
    const speicher = new Map<string, string>();
    const s = { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); } };
    expect(linksOffenLesen(s)).toBe(true);
    linksOffenMerken(false, s);
    expect(speicher.get('make-kalender-links')).toBe('zu');
    expect(linksOffenLesen(s)).toBe(false);
    linksOffenMerken(true, s);
    expect(speicher.get('make-kalender-links')).toBe('auf');
    expect(linksOffenLesen(s)).toBe(true);
    // Die Agenten-Seite hat ihren eigenen Merker — der Kalender fasst ihn nicht an.
    expect([...speicher.keys()]).toEqual(['make-kalender-links']);
    const kaputt = { getItem: () => { throw new Error('gesperrt'); }, setItem: () => { throw new Error('gesperrt'); } };
    expect(linksOffenLesen(kaputt)).toBe(true);
    expect(() => linksOffenMerken(false, kaputt)).not.toThrow();
    expect(linksOffenLesen(null)).toBe(true);
  });

  it('Taste: ⌘B / Strg+B — nie im Eingabefeld, nie mit Umschalt/Alt, nie bei Wiederholung; ⌘. und die Kürzel ohne Modifier bleiben frei', () => {
    expect(LINKS_TASTE).toBe('⌘B · Strg+B');
    expect(linksTaste(t('b', { metaKey: true }), null)).toBe(true);
    expect(linksTaste(t('B', { ctrlKey: true }), { tagName: 'BUTTON' })).toBe(true);
    expect(linksTaste(t('.', { metaKey: true }), null)).toBe(false);
    for (const k of ['b', 'd', 'x', 'w', 'm', 'y', 'a', 'p', 'k', 'u', 'c', 'n', 't']) expect(linksTaste(t(k), null)).toBe(false);
    expect(linksTaste(t('b', { metaKey: true, shiftKey: true }), null)).toBe(false);
    expect(linksTaste(t('b', { metaKey: true, altKey: true }), null)).toBe(false);
    expect(linksTaste(t('b', { metaKey: true, repeat: true }), null)).toBe(false);
    expect(linksTaste(t('b', { metaKey: true, defaultPrevented: true }), null)).toBe(false);
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) expect(linksTaste(t('b', { metaKey: true }), { tagName })).toBe(false);
    expect(linksTaste(t('b', { ctrlKey: true }), { isContentEditable: true })).toBe(false);
  });

  it('nur breit einklappbar: schmal (Spalte unter dem Raster) immer sichtbar', () => {
    expect(linksSichtbar(true, true)).toBe(true);
    expect(linksSichtbar(true, false)).toBe(false);
    expect(linksSichtbar(false, false)).toBe(true);
    expect(linksSichtbar(false, true)).toBe(true);
  });

  it('Planen öffnet eine zugeklappte Spalte (die Bausteine stehen dort) — nur breit, nur wenn zu', () => {
    expect(oeffnenFuerPlanen('planen', true, false)).toBe(true);
    expect(oeffnenFuerPlanen('planen', true, true)).toBe(false);
    expect(oeffnenFuerPlanen('planen', false, false)).toBe(false);
    expect(oeffnenFuerPlanen('kalender', true, false)).toBe(false);
    expect(oeffnenFuerPlanen('aufgaben', true, false)).toBe(false);
  });

  it('die Seite hängt die Regeln ein: Knöpfe mit aria-expanded/aria-controls, Erstellen zugeklappt in der Kopfzeile, Spalte bleibt geladen', () => {
    const seite = lies('components/os/kalender/Kalender.tsx');
    expect(LINKS_ID).toBe('kalender-links');
    // Zuklappen neben „Erstellen“, Öffnen vorne in der Kopfzeile — beide als SymbolKnopf (≥ 44 px, aria-expanded über `offen`, aria-controls über `steuert`).
    expect(seite).toMatch(/<SymbolKnopf ariaLabel=\{`Spalte zuklappen \(\$\{LINKS_TASTE\}\)`\} offen steuert=\{LINKS_ID\}/);
    expect(seite).toMatch(/\{breit && !linksOffen && <SymbolKnopf ariaLabel=\{`Spalte öffnen[^`]*\(\$\{LINKS_TASTE\}\)`\} offen=\{false\} steuert=\{LINKS_ID\}/);
    expect(seite).toMatch(/\{breit && !linksOffen && <ErstellenMenue breit=\{false\}/);
    // Zugeklappt: `hidden` (Zustand bleibt), das Raster nimmt die ganze Breite; schmal ohne `hidden`.
    expect(seite).toMatch(/<div id=\{LINKS_ID\} hidden=\{!linksSichtbar\(breit, linksOffen\)\}/);
    expect(seite).toMatch(/gridTemplateColumns: breit && linksSichtbar\(breit, linksOffen\) \? '280px minmax\(0, 1fr\)' : 'minmax\(0, 1fr\)'/);
    // Taste, Merker, Planen.
    expect(seite).toMatch(/!linksTaste\(e, document\.activeElement/);
    expect(seite).toMatch(/setLinksOffen\(linksOffenLesen\(\)\)/);
    expect(seite).toMatch(/linksOffenMerken\(n\)/);
    expect(seite).toMatch(/if \(oeffnenFuerPlanen\(modus, breit, linksOffen\)\) setLinksOffen\(true\)/);
    // Der Kalender fragt ⌘/Strg-Tasten nie selbst ab — nur über die gemeinsame Regel (lib/make-one/klappen.ts).
    expect(seite).not.toMatch(/(metaKey|ctrlKey)[^\n]{0,80}key(\.toLowerCase\(\))? === '(b|B)'/);
  });
});
