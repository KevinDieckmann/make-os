import { describe, it, expect } from 'vitest';
import {
  LEER_ZEIT, verbuchen, fokusVerbuchen, aufraeumen, bild, bereicheNachZeit, bereichZeit, zeitText, teile, schluesselFuer, letzteTage,
  MAX_LUECKE_SEK, FOKUS_TAG_SEK, type ZeitDatei,
} from '../lib/zeitmessung/modell';
import { bereichVon, zeitSchluessel, bereichId } from '../lib/zeitmessung/bereich';
import { localDay } from '../lib/zeit';

// Zeiten in Ortszeit, damit der Tag stabil ist.
const um = (tag: string, hhmmss: string) => new Date(`${tag}T${hhmmss}`).toISOString();
const HEUTE = localDay(new Date('2026-09-26T12:00:00'));
const GESTERN = localDay(new Date('2026-09-25T12:00:00'));

describe('Zeit & Fokus — verbuchen', () => {
  it('der erste Ping verbucht nichts, der zweite die Differenz auf den Schlüssel des ersten', () => {
    let d: ZeitDatei = verbuchen(LEER_ZEIT, um(HEUTE, '10:00:00'), 'privat:gesundheit');
    expect(Object.keys(d.tage)).toHaveLength(0);
    d = verbuchen(d, um(HEUTE, '10:00:30'), 'privat:gesundheit');
    expect(d.tage[HEUTE].auto['privat:gesundheit']).toBe(30);
    // Wechsel des Bereichs: die 30 s gehören noch dem alten Schlüssel.
    d = verbuchen(d, um(HEUTE, '10:01:00'), 'business:markttraktion');
    expect(d.tage[HEUTE].auto['privat:gesundheit']).toBe(60);
    expect(d.tage[HEUTE].auto['business:markttraktion']).toBeUndefined();
    d = verbuchen(d, um(HEUTE, '10:01:30'), 'business:markttraktion');
    expect(d.tage[HEUTE].auto['business:markttraktion']).toBe(30);
  });

  it('eine lange Stille zählt nicht (Fenster zu, Rechner schlief)', () => {
    let d = verbuchen(LEER_ZEIT, um(HEUTE, '10:00:00'), 'privat:familie');
    d = verbuchen(d, um(HEUTE, '10:05:00'), 'privat:familie');
    expect(d.tage[HEUTE]).toBeUndefined();
    d = verbuchen(d, um(HEUTE, '10:06:30'), 'privat:familie'); // genau MAX_LUECKE_SEK später
    expect(d.tage[HEUTE].auto['privat:familie']).toBe(MAX_LUECKE_SEK);
  });

  it('bewusste Blöcke werden gutgeschrieben, gedeckelt und gemerkt', () => {
    let d = fokusVerbuchen(LEER_ZEIT, { von: um(HEUTE, '09:00:00'), bis: um(HEUTE, '09:45:00'), schluessel: 'privat:gesundheit', label: 'Gesundheit' });
    expect(d.tage[HEUTE].bewusst['privat:gesundheit']).toBe(45 * 60);
    expect(d.tage[HEUTE].bloecke).toHaveLength(1);
    d = fokusVerbuchen(d, { von: um(HEUTE, '10:00:00'), bis: um(HEUTE, '23:00:00'), schluessel: 'business:markttraktion', label: 'Markttraktion' });
    expect(d.tage[HEUTE].bewusst['business:markttraktion']).toBe(8 * 3600);
    // Unsinn (Ende vor Anfang) ändert nichts.
    expect(fokusVerbuchen(d, { von: um(HEUTE, '12:00:00'), bis: um(HEUTE, '11:00:00'), schluessel: 'x:y', label: '' })).toBe(d);
  });

  it('aufräumen behält die jüngsten Tage', () => {
    const tage: ZeitDatei['tage'] = {};
    for (let i = 0; i < 5; i++) tage[`2026-01-0${i + 1}`] = { auto: { 'privat:home': 1 }, bewusst: {}, bloecke: [] };
    const d = aufraeumen({ tage }, '2026-09-26', 3);
    expect(Object.keys(d.tage).sort()).toEqual(['2026-01-03', '2026-01-04', '2026-01-05']);
  });
});

describe('Zeit & Fokus — Bild', () => {
  const datei: ZeitDatei = {
    tage: {
      [GESTERN]: { auto: { 'privat:gesundheit': 1800, 'business:markttraktion': 3600 }, bewusst: { 'privat:gesundheit': FOKUS_TAG_SEK }, bloecke: [{ von: um(GESTERN, '09:00:00'), bis: um(GESTERN, '09:25:00'), schluessel: 'privat:gesundheit', label: 'Gesundheit', sek: FOKUS_TAG_SEK }] },
      [HEUTE]: { auto: { 'privat:familie': 600, 'gemeinsam:home': 120 }, bewusst: { 'business:markttraktion': 900 }, bloecke: [] },
      '2020-01-01': { auto: { 'privat:home': 99999 }, bewusst: {}, bloecke: [] },
    },
  };
  const b = bild(datei, HEUTE);

  it('summiert heute und die letzten sieben Tage je Space', () => {
    expect(b.tagHeute.gesamt).toEqual({ privat: 600, business: 900, gemeinsam: 120 });
    expect(b.tagHeute.bewusst.business).toBe(900);
    expect(b.sieben.gesamt.privat).toBe(1800 + FOKUS_TAG_SEK + 600);
    expect(b.sieben.gesamt.business).toBe(3600 + 900);
    expect(b.sieben.bewusst.privat).toBe(FOKUS_TAG_SEK);
    // Uralte Tage zählen nicht mit.
    expect(b.sieben.jeSchluessel['privat:home']).toBeUndefined();
  });

  it('zählt Fokus-Tage je Space und listet Blöcke', () => {
    expect(b.fokusTage.privat).toBe(1);
    expect(b.fokusTage.business).toBe(0); // 900 s heute sind weniger als 25 min
  });

  it('Bereiche nach Zeit', () => {
    expect(bereicheNachZeit(b.sieben, 'privat').map(x => x.bereich)).toEqual(['gesundheit', 'familie']);
    expect(bereichZeit(b.sieben, 'business', 'markttraktion')).toBe(4500);
  });
});

describe('Zeit & Fokus — Helfer', () => {
  it('Schlüssel und Text', () => {
    expect(teile('privat:ziele-planung')).toEqual({ space: 'privat', bereich: 'ziele-planung' });
    expect(teile('irgendwas')).toEqual({ space: 'gemeinsam', bereich: 'irgendwas' });
    expect(schluesselFuer('business', 'mandate')).toBe('business:mandate');
    expect(zeitText(0)).toBe('—');
    expect(zeitText(30)).toBe('< 1 min');
    expect(zeitText(25 * 60)).toBe('25 min');
    expect(zeitText(80 * 60)).toBe('1 h 20');
    expect(zeitText(2 * 3600)).toBe('2 h');
    expect(letzteTage('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('Bereich aus der Adresse', () => {
    expect(bereichVon('/os').id).toBe('home');
    expect(bereichVon('/os/heute').id).toBe('heute');
    expect(bereichVon('/os/gesundheit', '?s=koerper').id).toBe('gesundheit');
    expect(bereichVon('/os/markttraktion').id).toBe('markttraktion');
    expect(bereichVon('/os/finanzen', '?s=privat').label).toBe('Finanzen');
    expect(bereichVon('/os/planung/jahr', '?space=business').id).toBe('ziele-planung');
    expect(bereichId('Ziele & Planung')).toBe('ziele-planung');
  });

  it('Schlüssel: Adresse gewinnt, sonst der Modus', () => {
    expect(zeitSchluessel('/os/markttraktion', '', 'privat').schluessel).toBe('business:markttraktion');
    expect(zeitSchluessel('/os/heute', '', 'privat').schluessel).toBe('privat:heute');
    expect(zeitSchluessel('/os/heute', '', null).schluessel).toBe('gemeinsam:heute');
    expect(zeitSchluessel('/os/uebersicht', '?space=privat', 'business').space).toBe('privat');
  });
});
