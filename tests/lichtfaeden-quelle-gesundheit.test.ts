// ─── Lichtfäden-Quelle Gesundheit & Routinen (terminiert) → Stränge (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { gesundheitStraenge } from '@/lib/lichtfaeden/quellen/gesundheit';
import { BEIDE, GESAMT, fuerBetrachter } from '@/lib/lichtfaeden/modell';

describe('Gesundheit → Stränge', () => {
  const l = gesundheitStraenge({
    heute: '2026-10-03', links: { routinen: '/os/planung/routinen', sport: '/os/sport' },
    routinen: [
      { id: 'r-1', label: 'Vorsorge', kategorie: 'gesundheit', aktiv: true, owner: 'malin', rhythmus: 'jaehrlich', naechstesMal: '2026-11-04' },
      { id: 'r-2', label: 'Täglich', kategorie: 'gesundheit', aktiv: true, rhythmus: 'taeglich', naechstesMal: '2026-11-04' },
      { id: 'r-3', label: 'Steuer sortieren', kategorie: 'business', aktiv: true, owner: BEIDE, rhythmus: 'monatlich', naechstesMal: '2026-10-28' },
      { id: 'r-4', label: 'Pausiert', kategorie: 'leben', aktiv: false, rhythmus: 'monatlich', naechstesMal: '2026-10-28' },
    ],
    sport: [{ person: 'malin', ziele: [{ id: 's-1', titel: 'Hyrox Wettkampf', datum: '2026-11-21' }, { id: 's-2', titel: 'Ohne Datum' }] }],
  });
  const st = (id: string) => l.find(x => x.id === id)!;

  it('nur terminierte Routinen ab wöchentlich, aktiv; Kategorie bestimmt Space/Thema', () => {
    expect(l.map(x => x.id).sort()).toEqual(['routine:r-1', 'routine:r-3', 'sport:malin:s-1']);
    expect(st('routine:r-1').pfad).toEqual([GESAMT, 'space:privat', 'thema:privat:gesundheit']);
    expect(st('routine:r-3').pfad).toEqual([GESAMT, 'space:business', 'thema:business:planung']);
  });
  it('Gesundheit einer Person ist privat (die andere sieht „belegt“), gemeinsame Routinen nicht', () => {
    expect(st('routine:r-1').privat).toBe(true);
    expect(st('routine:r-3').privat).toBeUndefined();
    expect(fuerBetrachter(st('sport:malin:s-1'), 'kevin')).toMatchObject({ titel: 'Belegt', quelle: 'belegt' });
    expect(st('sport:malin:s-1')).toMatchObject({ quelle: 'wettkampf', gewicht: 2.5 });
  });
  it('08.10. (Kevin): JEDE Routine einer Person ist privat — auch „leben“/„business“; die andere sieht nur „Belegt“', () => {
    const [s] = gesundheitStraenge({
      heute: '2026-10-03', links: { routinen: '/os/planung/routinen', sport: '/os/sport' }, sport: [],
      routinen: [{ id: 'r-5', label: 'Geheimer Termin', kategorie: 'leben', aktiv: true, owner: 'malin', rhythmus: 'monatlich', naechstesMal: '2026-10-20' }],
    });
    expect(s.privat).toBe(true);
    expect(JSON.stringify(fuerBetrachter(s, 'kevin'))).not.toContain('Geheimer Termin');
    expect(fuerBetrachter(s, 'malin').titel).toBe('Geheimer Termin');
  });
});
