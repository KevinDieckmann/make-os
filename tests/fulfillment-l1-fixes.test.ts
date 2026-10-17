// Gesamtprüfung 17.10. — Linse 1 (Ende zu Ende): Funde, die die Regeln betreffen. Erfundene Daten, rein.
import { describe, it, expect } from 'vitest';
import { willkommenUhr } from '@/lib/fulfillment/prozesse/onboarding';
import { tagKurz } from '@/components/os/fulfillment/prozesse/daten';

describe('B2 · Willkommens-Uhr', () => {
  it('nur der Tag der Unterschrift bekannt: die 24 Stunden laufen ab dem Ende dieses Tages', () => {
    const u = willkommenUhr('2026-10-17', 24, undefined, '2026-10-17T19:00:00.000Z');
    expect(u.faellig).toBe('2026-10-18T22:00:00.000Z');
    expect(u.ueberfaellig).toBe(false);
    expect(u.restStunden).toBe(27);
  });
  it('mit Uhrzeit gilt die Uhrzeit', () => {
    expect(willkommenUhr('2026-10-17T18:53:00.000Z', 24, undefined, '2026-10-17T19:00:00.000Z').faellig).toBe('2026-10-18T18:53:00.000Z');
  });
  it('Datum eines Zeitstempels als Berliner Tag — nie der UTC-Tag', () => {
    expect(tagKurz('2026-10-17T22:00:00.000Z')).toBe('18.10.');
    expect(tagKurz('2026-10-17')).toBe('17.10.');
  });
});

describe('B1 · Eine Bestätigung schließt keine Phase mit offenen Schritten', () => {
  it('nur der Bestätigungs-Schritt wird erledigt; die Phase bleibt offen, bis ihre Schritte fertig sind', async () => {
    const { fallAnwenden } = await import('@/lib/fulfillment/prozesse/fall');
    const { phaseFertig } = await import('@/lib/fulfillment/regeln');
    const J = '2026-10-17T10:00:00.000Z';
    const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Record<string, unknown> = {}) => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
    const fall = {
      mandatId: 'm-b1', vorlageId: 'v', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', freigaben: {}, onboarding: {},
      knoten: [k('w', undefined, 'A', 1), k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k('s1', 'p1', 'Kick-off', 1), k('s2', 'p1', 'Zugänge', 2, { status: 'erledigt' }), k('fg', 'p1', 'Abnahme', 3, { freigabe: 'F1' })],
      stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia',
    } as never;
    const ctx = { person: 'pia', jetzt: J, heute: '2026-10-17', standVon: () => 's', neueId: (p: string) => `${p}-x`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['F0', 'F1'] };
    const r = fallAnwenden(fall, [{ op: 'freigabe', id: 'F0' }, { op: 'freigabe', id: 'F1' }], ctx as never);
    if (!r.ok) throw new Error(r.fehler);
    const p1 = r.datei.knoten.find(x => x.id === 'p1')!;
    expect(p1.status).toBe('offen');
    expect(phaseFertig(p1, r.datei.knoten)).toBe(false);
    expect(r.datei.knoten.find(x => x.id === 'fg')!.status).toBe('erledigt');
    expect(r.datei.freigaben.F0).toBeDefined();
  });
});
