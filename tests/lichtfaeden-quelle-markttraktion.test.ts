// ─── Lichtfäden-Quelle Markttraktion: Follow-ups, Deals, Events → Stränge, Ziel-Bezug (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { markttraktionStraenge } from '@/lib/lichtfaeden/quellen/markttraktion';
import { BEIDE, GESAMT } from '@/lib/lichtfaeden/modell';

const HEUTE = '2026-10-03';
const ZIEL = [GESAMT, 'space:business', 'thema:business:mandate', 'ziel:z-1'];

describe('Markttraktion → Stränge', () => {
  const l = markttraktionStraenge({
    heute: HEUTE,
    bezuege: { firma: new Map([['f-1', ZIEL]]), mandat: new Map() },
    followups: [
      { id: 'fu-1', text: 'Nachfassen', name: 'Erika Beispiel', faellig: '2026-10-01', zustaendig: 'malin', kontaktId: 'c-1' },
      { id: 'v:review:md-1', text: 'Review', faellig: '2026-10-12', zustaendig: BEIDE, bezug: { art: 'firma', id: 'f-1' } },
    ],
    deals: [
      { id: 'd-1', titel: 'Retainer Muster', erwartetAm: '2026-11-15', offen: true, besitzer: 'kevin', firmaId: 'f-1' },
      { id: 'd-2', titel: 'Verloren', erwartetAm: '2026-11-15', offen: false },
    ],
    events: [
      { id: 'e-1', titel: 'Stammtisch', datum: '2026-10-22', status: 'geplant', link: '/os/markttraktion?r=event', zustaendig: 'kevin' },
      { id: 'e-2', titel: 'Messe', datum: '2026-11-03', bisDatum: '2026-11-05', status: 'einladung', link: '/x' },
      { id: 'e-3', titel: 'Idee', datum: '2026-11-03', status: 'idee', link: '/x' },
      { id: 'e-4', titel: 'Abgesagt', datum: '2026-11-03', status: 'abgesagt', link: '/x' },
    ],
  });
  const st = (id: string) => l.find(x => x.id === id)!;

  it('Follow-ups: Markttraktion, zuständige Person, überfällig erkannt, Titel mit Name, Link zur Akte', () => {
    expect(st('followup:fu-1')).toMatchObject({ pfad: [GESAMT, 'space:business', 'thema:business:markttraktion'], person: 'malin', status: 'ueberfaellig', titel: 'Nachfassen · Erika Beispiel' });
    expect(st('followup:fu-1').link).toContain('c-1');
  });
  it('Ziel-Bezug über die Firma: Follow-up und Deal laufen in das Ziel', () => {
    expect(st('followup:v:review:md-1').pfad).toEqual(ZIEL);
    expect(st('deal:d-1').pfad).toEqual(ZIEL);
    expect(st('deal:d-1')).toMatchObject({ gewicht: 2, person: 'kevin' });
  });
  it('nur offene Deals; Events ohne Idee/Abgesagt; mehrtägig als Spanne; ohne Zuständige gehören sie beiden', () => {
    expect(l.some(x => x.id === 'deal:d-2' || x.id === 'event:e-3' || x.id === 'event:e-4')).toBe(false);
    expect(st('event:e-2').zeit).toEqual({ tag: '2026-11-03', bis: '2026-11-05' });
    expect(st('event:e-2').person).toBe(BEIDE);
    expect(st('event:e-1')).toMatchObject({ quelle: 'event', gewicht: 2 });
  });
});
