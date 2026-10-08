// ─── Ernährungsprofile nur selbst oder geteilt (08.10., Kevin) — reine Regeln ───────────────────────────────────────────
// Erfundene Werte. Wächter mit Route: tests/messlatte-malin.test.ts.
import { describe, it, expect } from 'vitest';
import { profileFuerBetrachter, wendeAn, sauberDatei, type Profil, type Op } from '@/lib/ernaehrung/modell';

const p = (person: string, konto: boolean): Profil => ({ person, name: person, bedarf: `Bedarf-${person}`, unvertraeglich: [], nie: [], gern: [], ziel: '', konto, stand: '2026-10-01' });

describe('profileFuerBetrachter', () => {
  const alle = [p('person-a', true), p('person-b', true), p('gast-x', false)];
  it('eigenes + Gäste; fremde Konto-Profile nur, wenn geteilt', () => {
    expect(profileFuerBetrachter(alle, 'person-b', new Set()).map(x => x.person)).toEqual(['person-b', 'gast-x']);
    expect(profileFuerBetrachter(alle, 'person-b', new Set(['person-a'])).map(x => x.person)).toEqual(['person-a', 'person-b', 'gast-x']);
  });
});

describe('wendeAn: Profile mit Konten-Liste', () => {
  const konten = ['person-a', 'person-b'];
  const upsert = (eintrag: Partial<Profil>) => [{ liste: 'profile', op: 'upsert', eintrag } as unknown as Op];
  it('kein „Gast“ unter dem Namen einer Person — auch wenn sie noch kein Profil hat', () => {
    const f = sauberDatei({ profile: [] });
    expect(wendeAn(f, upsert({ person: 'person-a', name: 'A', konto: false }), 'person-b', undefined, konten).abgelehnt).toContain('profile:fremd');
    expect(wendeAn(f, upsert({ person: 'gast-y', name: 'Y', konto: false }), 'person-b', undefined, konten).abgelehnt).toEqual([]);
  });
  it('ein als Gast gespeichertes Profil mit Konto-Namen löscht nur die Person selbst', () => {
    const f = sauberDatei({ profile: [p('person-a', false)] });
    expect(wendeAn(f, [{ liste: 'profile', op: 'delete', id: 'person-a' } as unknown as Op], 'person-b', undefined, konten).abgelehnt).toContain('profile:fremd');
  });
});
