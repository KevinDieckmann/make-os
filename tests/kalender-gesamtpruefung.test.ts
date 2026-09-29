// ─── Kalender: Funde der Gesamtprüfung (29.09.) ──────────────────────────────
// · Ansicht beim Öffnen: ohne gemerkte Wahl am Rechner die Woche (vorher blieb „Tag“ stehen, weil `useBreit` beim ersten
//   Zeichnen immer „schmal“ meldet und die Wirkung danach nicht mehr auf „Woche“ zurückstellte).
// · Wohin das Zeitraster beim Öffnen rollt (eine Stelle, `startMinute`) — das Rollen selbst wartet jetzt, bis die Liste
//   wirklich rollen kann (Zeitraster.tsx, ResizeObserver).

import { describe, it, expect } from 'vitest';
import { startAnsicht, KALENDER_ANSICHTEN } from '@/lib/kalender/modus';
import { startMinute } from '@/lib/kalender/layout';

describe('startAnsicht', () => {
  it('ohne gemerkte Wahl: Woche am Rechner, Tag am Handy', () => {
    expect(startAnsicht(null, true)).toBe('woche');
    expect(startAnsicht(null, false)).toBe('tag');
    expect(startAnsicht(undefined, true)).toBe('woche');
  });
  it('die erste Zeichnung (schmal) und danach breit ergibt Woche — nicht Tag', () => {
    const erst = startAnsicht(null, false);
    const dann = startAnsicht(null, true);
    expect(erst).toBe('tag');
    expect(dann).toBe('woche');
  });
  it('eine gemerkte Wahl gilt immer, Unbekanntes fällt weg', () => {
    for (const a of KALENDER_ANSICHTEN) { expect(startAnsicht(a, true)).toBe(a); expect(startAnsicht(a, false)).toBe(a); }
    expect(startAnsicht('quartal', true)).toBe('woche');
    expect(startAnsicht('', false)).toBe('tag');
  });
});

describe('startMinute', () => {
  it('heute sichtbar: eine Stunde vor jetzt, nie unter 0', () => {
    expect(startMinute(['2026-09-28', '2026-09-29'], '2026-09-29', 19 * 60 + 40)).toBe(18 * 60 + 40);
    expect(startMinute(['2026-09-29'], '2026-09-29', 30)).toBe(0);
  });
  it('heute nicht sichtbar: 7 Uhr', () => {
    expect(startMinute(['2026-10-05', '2026-10-06'], '2026-09-29', 19 * 60)).toBe(7 * 60);
  });
});
