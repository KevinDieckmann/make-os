// ─── Routinen 2 (10.10.) — Oberfläche: Editor, Abhaken/Zählen, Anschluss in Planer, Gesundheit und Heute ──────────────────────────
// Der Editor zeigt jede Rhythmus-Wahl mit Erklärung, die Vorschau rechnet über lib/planung (nie in der Ansicht), Eingaben in 16 px (iPhone
// zoomt sonst). Abhaken und Zählen gehen als EIN PATCH je Tipp — keine Ansicht schreibt mehr den ganzen Gesundheits-Log.
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/planung/routinen' }));

import { RoutineEditor } from '@/components/os/routinen/RoutineEditor';
import { RoutineSteuer, streakText } from '@/components/os/routinen/haken';
import type { Routine } from '@/lib/planung/typen';

const h = (c: unknown, props: unknown) => createElement(c as never, props as never);
const lies = (p: string) => readFileSync(path.join(path.resolve(__dirname, '..'), p), 'utf8');
const KAT = [{ id: 'gesundheit' as const, label: 'Gesundheit', farbe: '#7ED6A5' }, { id: 'erholung' as const, label: 'Erholung', farbe: '#7AA7FF' }, { id: 'leben' as const, label: 'Leben', farbe: '#E9A6FF' }, { id: 'business' as const, label: 'Business', farbe: '#F2B880' }];
const editor = (routine: Routine | null) => renderToStaticMarkup(h(RoutineEditor, {
  routine, heute: '2026-10-12', ich: 'pia', personen: [{ speicher: 'pia', name: 'Pia' }, { speicher: 'olaf', name: 'Olaf' }], kategorien: KAT,
  einheiten: [], einheitAnlegen: async () => null, onSpeichern: () => {}, onZu: () => {},
}));

describe('Routine-Editor', () => {
  const laufen: Routine = { id: 'r-l', label: 'Laufen', wann: 'morgen', kategorie: 'gesundheit', dauerMin: 40, aktiv: true, owner: 'pia', regel: { art: 'wochentage', tage: [1, 4] }, uhrzeiten: ['07:00'], erinnerung: true };
  it('alle Rhythmen zur Wahl, die Vorschau rechnet die nächsten Termine', () => {
    const html = editor(laufen);
    for (const t of ['Täglich', 'Werktage', 'Feste Tage', 'x-mal pro Woche', 'Alle x …', 'Monatlich']) expect(html).toContain(t);
    expect(html).toContain('jeden Montag und Donnerstag — nächste: 12.10. · 15.10. · 19.10.');
    expect(html).toContain('Routine einstellen');
  });
  it('jede Einstellung mit „i“ (Erklärung + Beispiel): Rhythmus, Uhrzeiten, Zähler, Erinnerung, Kalender, Zeitraum, Pause, Ziel', () => {
    const html = editor(laufen);
    expect((html.match(/data-erklaerung="knopf"/g) ?? []).length).toBeGreaterThanOrEqual(8);
    for (const t of ['Erinnern, wenn sie dran ist', 'Als Block in meinen Kalender', 'Pausen', 'Zahlt ein auf', 'Feste Uhrzeiten', 'Wie oft am Tag', 'Zeitraum']) expect(html).toContain(t);
  });
  it('Handy: Eingaben 16 px, Tippziele über die Bausteine; neue Routine ohne Daten', () => {
    const html = editor(null);
    expect(html).toContain('Neue Routine');
    expect(html).toContain('font-size:16px');
    expect(html).toContain('Routine anlegen');
    // Gemeinsam (Vorgabe) → Kalender-Block nicht wählbar, mit Satz.
    expect(html).toContain('Kalender-Blöcke gibt es nur für die Routine einer Person.');
  });
  it('rechnet nichts selbst: Rhythmus, Vorschau und Speichern kommen aus lib/planung', () => {
    const src = lies('components/os/routinen/RoutineEditor.tsx');
    expect(src).toContain("from '@/lib/planung/routine-entwurf'");
    expect(src).toContain("from '@/lib/planung/rhythmus'");
    expect(src).not.toMatch(/new Date\(/);
  });
});

describe('Abhaken und Zählen', () => {
  it('Tagesziel 1: Haken; Zähler: „− 5/8 +“ mit sprechenden Namen; fremde Ansicht nur lesen', () => {
    const haken = renderToStaticMarkup(h(RoutineSteuer, { label: 'Dehnen', ziel: 1, ist: 0, erledigt: false, onHaken: () => {}, onZaehlen: () => {} }));
    expect(haken).toContain('aria-pressed="false"');
    const zaehler = renderToStaticMarkup(h(RoutineSteuer, { label: 'Wasser', ziel: 8, ist: 5, erledigt: false, onHaken: () => {}, onZaehlen: () => {} }));
    expect(zaehler).toContain('aria-label="Wasser: eins weniger"');
    expect(zaehler).toContain('aria-label="Wasser: eins mehr"');
    expect(zaehler).toContain('aria-label="Wasser: 5 von 8"');
    const lesen = renderToStaticMarkup(h(RoutineSteuer, { label: 'Wasser', ziel: 8, ist: 5, erledigt: false, aus: true, onHaken: () => {}, onZaehlen: () => {} }));
    expect(lesen).not.toContain('eins mehr');
    expect(streakText(4, 'woche')).toBe('Streak 4 Wochen');
    expect(streakText(0, 'tag')).toBe('');
  });
  it('keine Ansicht schreibt mehr den ganzen Gesundheits-Log für Routinen (PUT) — Gesundheit, Heute-Widget, Tagesplanung, Journal nehmen den PATCH', () => {
    const alle = (dir: string): string[] => readdirSync(path.join(path.resolve(__dirname, '..'), dir), { withFileTypes: true })
      .flatMap(d => (d.isDirectory() ? alle(`${dir}/${d.name}`) : d.name.endsWith('.tsx') ? [`${dir}/${d.name}`] : []));
    expect(alle('components').filter(f => /'\/api\/state\/health', \{ method: 'PUT'/.test(lies(f)))).toEqual([]);
    for (const f of ['components/os/GesundheitView.tsx', 'components/os/flaeche/widgets.tsx', 'components/os/TagesplanView.tsx', 'components/os/JournalView.tsx']) {
      expect(lies(f), f).toContain('routineHakenSenden');
    }
  });
});

describe('Anschluss', () => {
  it('Planer: Editor, Vorlagen, Streak/Quote mit Erklärung, Handy-Einstellung; Löschen weiter über den Baustein', () => {
    const p = lies('components/os/RoutinenPlanerView.tsx');
    expect(p).toContain('<RoutineEditor');
    expect(p).toContain('ROUTINEN_VORLAGEN');
    expect(p).toContain("kennzahlTextVon('routinen.streak')");
    expect(p).toContain('erklaerung="routinen.handy"');
    expect(p).toMatch(/<ZeileAktionen key=\{r\.id\} titel=\{r\.label\} onLoeschen=\{\(\) => routineLoeschen\(r\)\}/);
  });
  it('Gesundheit › Heute und das Heute-Widget zeigen nach Rhythmus (Server bzw. heuteFaellig) mit Zähler und Streak', () => {
    const s = lies('app/api/gesundheit/stand/route.ts');
    expect(s).toContain('heuteFaellig(');
    expect(s).toContain('routineStatistik(');
    expect(lies('components/os/GesundheitView.tsx')).toContain('<RoutineSteuer');
    expect(lies('components/os/flaeche/widgets.tsx')).toContain('<RoutineSteuer');
  });
});
