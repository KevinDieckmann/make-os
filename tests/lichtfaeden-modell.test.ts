// ─── Lichtfäden v2 — Modell: Gewichte, Status, Personen-/Privat-Regel (erfundene Daten) ─
import { describe, it, expect } from 'vitest';
import {
  BEIDE, FAKTOR, GESAMT, QUELLEN, fuerBetrachter, gewichtVon, istGueltig, knotenId, passtZuPerson, statusVon, tagAus, themaPfad, verdeckt,
  type Strang,
} from '@/lib/lichtfaeden/modell';

const s = (x: Partial<Strang> = {}): Strang => ({
  id: 'termin:k|u1', quelle: 'termin', titel: 'Arzttermin Beispiel', pfad: themaPfad('privat', 'gesundheit'), person: 'malin',
  zeit: { tag: '2026-10-20' }, gewicht: 0.5, status: 'offen', link: '/os/kalender?termin=x', privat: true, ...x,
});

describe('Gewichtstabelle', () => {
  it('jede Quelle hat Gewicht > 0, eine Art (Frist/Termin) und ein Symbol', () => {
    for (const [q, d] of Object.entries(QUELLEN)) {
      expect(d.gewicht, q).toBeGreaterThan(0);
      expect(['frist', 'termin']).toContain(d.art);
      expect(d.symbol.length).toBeGreaterThan(0);
    }
  });
  it('Planung wie v1: Meilenstein 3 (erledigt 1), Ziel-Frist 3, Aufgabe 1 (dringend 1,5), Termin 0,5 (lang 1)', () => {
    expect(gewichtVon('meilenstein')).toBe(3);
    expect(gewichtVon('meilenstein', { erledigt: true })).toBe(1);
    expect(gewichtVon('ziel')).toBe(3);
    expect(gewichtVon('aufgabe')).toBe(1);
    expect(gewichtVon('aufgabe', { dringend: true })).toBe(1.5);
    expect(gewichtVon('termin')).toBe(0.5);
    expect(gewichtVon('termin', { lang: true })).toBe(0.5 * FAKTOR.lang);
  });
});

describe('Status und Tage', () => {
  it('offen / überfällig / erledigt', () => {
    expect(statusVon(false, '2026-10-01', '2026-10-03')).toBe('ueberfaellig');
    expect(statusVon(false, '2026-10-03', '2026-10-03')).toBe('offen');
    expect(statusVon(true, '2026-10-01', '2026-10-03')).toBe('erledigt');
  });
  it('tagAus nimmt Tag aus Zeitstempel, verwirft Unsinn', () => {
    expect(tagAus('2026-10-20T09:00:00')).toBe('2026-10-20');
    expect(tagAus('kaputt')).toBeNull();
    expect(tagAus(undefined)).toBeNull();
  });
  it('gültig: Pfad ab gesamt, Tag ok, Spanne nicht rückwärts, Gewicht > 0', () => {
    expect(istGueltig(s())).toBe(true);
    expect(istGueltig(s({ pfad: ['space:privat'] }))).toBe(false);
    expect(istGueltig(s({ pfad: [GESAMT] }))).toBe(false);
    expect(istGueltig(s({ zeit: { tag: '2026-10-20', bis: '2026-10-01' } }))).toBe(false);
    expect(istGueltig(s({ gewicht: 0 }))).toBe(false);
  });
});

describe('Personen-/Privat-Regel', () => {
  it('Person: „alle“ sieht alles, eine Person sich selbst und was beiden gehört', () => {
    expect(passtZuPerson({ person: 'kevin' }, { art: 'alle' })).toBe(true);
    expect(passtZuPerson({ person: BEIDE }, { art: 'person', person: 'malin' })).toBe(true);
    expect(passtZuPerson({ person: 'kevin' }, { art: 'person', person: 'malin' })).toBe(false);
  });
  it('privater Strang der ANDEREN Person → anonymes „belegt“: kein Titel, kein Link, kein Thema, verdeckte Kennung', () => {
    const b = fuerBetrachter(s(), 'kevin');
    expect(b.quelle).toBe('belegt');
    expect(b.titel).toBe('Belegt');
    expect(b.link).toBeUndefined();
    expect(b.pfad).toEqual([GESAMT, knotenId.space('privat')]);
    expect(b.id).not.toContain('k|u1');
    expect(b.id).toBe(`belegt:${verdeckt('termin:k|u1')}`);
    expect(JSON.stringify(b)).not.toContain('Arzttermin');
    expect(JSON.stringify(b)).not.toContain('gesundheit');
    expect(b.person).toBe('malin');
    expect(b.gewicht).toBe(QUELLEN.belegt.gewicht);
  });
  it('eigene private und gemeinsame Stränge bleiben unverändert', () => {
    expect(fuerBetrachter(s(), 'malin')).toEqual(s());
    expect(fuerBetrachter(s({ person: BEIDE }), 'kevin').titel).toBe('Arzttermin Beispiel');
    expect(fuerBetrachter(s({ privat: undefined }), 'kevin').titel).toBe('Arzttermin Beispiel');
  });
});
