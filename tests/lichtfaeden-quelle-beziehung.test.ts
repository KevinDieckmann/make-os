// ─── Lichtfäden-Quelle Familie & Beziehung → Stränge (erfundene Daten) ─────
import { describe, it, expect } from 'vitest';
import { beziehungStraenge, vorkommen } from '@/lib/lichtfaeden/quellen/beziehung';
import { BEIDE, GESAMT } from '@/lib/lichtfaeden/modell';

const PFAD = [GESAMT, 'space:privat', 'thema:privat:beziehung'];

describe('Familie & Beziehung → Stränge', () => {
  it('Vorkommen: MM-TT jedes Jahr im Fenster, volles Datum einmal', () => {
    expect(vorkommen('06-14', '2026-01-01', '2027-12-31')).toEqual(['2026-06-14', '2027-06-14']);
    expect(vorkommen('2026-06-14', '2026-01-01', '2027-12-31')).toEqual(['2026-06-14']);
    expect(vorkommen('2025-06-14', '2026-01-01', '2027-12-31')).toEqual([]);
    expect(vorkommen('kaputt', '2026-01-01', '2027-12-31')).toEqual([]);
  });

  const l = beziehungStraenge({
    von: '2026-01-01', bis: '2027-12-31', heute: '2026-10-03', link: '/os/familie',
    geburtstage: [{ id: 'g-1', name: 'Oma Beispiel', tag: '2026-11-02', href: '/os/familie' }],
    tage: [
      { id: 't-1', titel: 'Jahrestag', art: 'jahrestag', datum: '08-20', von: 'kevin', erledigt: [2026] },
      { id: 't-2', titel: 'Geburtstag doppelt', art: 'geburtstag', datum: '11-02', von: 'kevin', erledigt: [] },
      { id: 't-3', titel: 'Überraschung', art: 'sonstig', datum: '12-24', von: 'malin', nurIch: true, erledigt: [] },
    ],
    dates: [{ id: 'd-1', titel: 'Kino', datum: '2026-10-17', status: 'geplant', von: 'kevin' }, { id: 'd-2', titel: 'Abgesagt', datum: '2026-10-18', status: 'abgesagt', von: 'kevin' }],
    vereinbarungen: [{ id: 'v-1', text: 'Urlaub buchen', faellig: '2026-10-31', status: 'offen', wer: 'kevin' }, { id: 'v-2', text: 'Erledigt', faellig: '2026-10-31', status: 'erledigt' },
      { id: 'v-3', text: 'Ring abholen', faellig: '2026-11-13', status: 'offen', wer: 'beide', von: 'malin', nurIch: true }, { id: 'v-4', text: 'Ohne Anlegerin', faellig: '2026-11-13', status: 'offen', nurIch: true }],
  });
  const st = (id: string) => l.find(x => x.id === id)!;

  it('alles in Privat › Familie & Beziehung', () => {
    for (const s of l) expect(s.pfad).toEqual(PFAD);
  });
  it('Geburtstage nur aus der einen Quelle (kein doppelter Wichtiger Tag), wichtige Tage je Jahr, erledigtes Jahr leise', () => {
    expect(st('geburtstag:g-1:2026-11-02')).toMatchObject({ quelle: 'wichtiger-tag', titel: 'Geburtstag Oma Beispiel', person: BEIDE });
    expect(l.some(x => x.id.startsWith('tag:t-2'))).toBe(false);
    expect(st('tag:t-1:2026-08-20').status).toBe('erledigt');
    expect(st('tag:t-1:2027-08-20').status).toBe('offen');
  });
  it('„nur ich“ ist privat und gehört der Anlegerin; Dates geplant, Vereinbarungen offen', () => {
    expect(st('tag:t-3:2026-12-24')).toMatchObject({ privat: true, person: 'malin' });
    expect(st('date:d-1')).toMatchObject({ quelle: 'date', gewicht: 1.5, person: BEIDE });
    expect(l.some(x => x.id === 'date:d-2' || x.id === 'vereinbarung:v-2')).toBe(false);
    expect(st('vereinbarung:v-1')).toMatchObject({ person: 'kevin', quelle: 'vereinbarung' });
    // Vereinbarung „nur ich“: privat und der Anlegerin (nicht „beide“) — ohne Anlegerin fällt sie weg.
    expect(st('vereinbarung:v-3')).toMatchObject({ privat: true, person: 'malin' });
    expect(l.some(x => x.id === 'vereinbarung:v-4')).toBe(false);
  });
});
