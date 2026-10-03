// ─── Lichtfäden-Quelle Kalender: Termine → Stränge, Thema, Spanne, Privat (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import { kalenderStraenge, type KalenderTermin } from '@/lib/lichtfaeden/quellen/kalender';
import { BEIDE, fuerBetrachter } from '@/lib/lichtfaeden/modell';

const HEUTE = '2026-10-03';
const t = (x: Partial<KalenderTermin>): KalenderTermin => ({ id: 'Kal|u', titel: 'Termin', start: '2026-10-10T10:00:00', ende: '2026-10-10T11:00:00', space: 'privat', wer: 'kevin', ...x });

describe('Kalender → Stränge', () => {
  it('Thema: Gesundheit, Mandat, CRM-Bezug, sonst Ziele & Planung', () => {
    const l = kalenderStraenge({ heute: HEUTE, termine: [
      t({ id: 'a', gesundheit: true }),
      t({ id: 'b', space: 'business', bezug: { mandatId: 'md-1' } }),
      t({ id: 'c', space: 'business', bezug: { kontaktId: 'c-1' } }),
      t({ id: 'd', space: 'business' }),
    ] });
    expect(l.map(s => s.pfad.at(-1))).toEqual(['thema:privat:gesundheit', 'thema:business:mandate', 'thema:business:markttraktion', 'thema:business:planung']);
  });

  it('Fokus/Planen-Blöcke, Arbeitsort und Abgesagtes zählen nicht', () => {
    const l = kalenderStraenge({ heute: HEUTE, termine: [t({ id: 'f', art: 'fokus' }), t({ id: 'b', art: 'block' }), t({ id: 'o', art: 'arbeitsort' }), t({ id: 'x', abgesagt: true })] });
    expect(l).toEqual([]);
  });

  it('ganztägige Spanne: Ende exklusiv; lang (ganztägig / ab 3 h / abwesend) wiegt doppelt; Vergangenes leise', () => {
    const [g, k, v] = kalenderStraenge({ heute: HEUTE, termine: [
      t({ id: 'g', ganztags: true, start: '2026-10-12T00:00:00', ende: '2026-10-15T00:00:00' }),
      t({ id: 'k' }),
      t({ id: 'v', start: '2026-09-01T09:00:00', ende: '2026-09-01T13:00:00' }),
    ] });
    expect(g.zeit).toEqual({ tag: '2026-10-12', bis: '2026-10-14' });
    expect(g.gewicht).toBe(1);
    expect(k.gewicht).toBe(0.5);
    expect(v).toMatchObject({ status: 'erledigt' });
    expect(v.gewicht).toBeCloseTo(1 / 3, 2);
  });

  it('privat/Gesundheit einer Person → privat; gemeinsamer Kalender nicht; maskiert ohne Link und für die andere Person „belegt“', () => {
    const [p, gem, m] = kalenderStraenge({ heute: HEUTE, termine: [
      t({ id: 'p', sichtbarkeit: 'privat', wer: 'malin', titel: 'Privat Malin' }),
      t({ id: 'gem', sichtbarkeit: 'privat', wer: BEIDE }),
      t({ id: 'm', maskiert: true, titel: 'Belegt', wer: 'malin' }),
    ] });
    expect(p.privat).toBe(true);
    expect(gem.privat).toBeUndefined();
    expect(m.link).toBeUndefined();
    expect(fuerBetrachter(p, 'kevin').titel).toBe('Belegt');
    expect(fuerBetrachter(p, 'malin').titel).toBe('Privat Malin');
  });
});
