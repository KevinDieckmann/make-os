// ─── Funde — Lage je Firma (31.10.2026, lib/funde/lage.ts) — rein, erfundene Daten ─────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { lageBewerten, leadScoreTief, vertriebsleitungStatus, LAGE_REGELN, type LageSignale } from '@/lib/funde/lage';
import { steckbriefSaeubern } from '@/lib/crm/icp-firma';

const H = '2026-10-31';
const s = (x: Partial<LageSignale>): LageSignale => ({ passung: 70, heute: H, ...x });

describe('Vertriebsleitung — Beleg-Leiter', () => {
  it('Website schlägt Team-Seite, Presse, Stellenanzeige', () => {
    const r = vertriebsleitungStatus(s({ leitungWebsite: { rolle: 'Head of Sales', url: 'https://beispiel.de/management' }, leitungGesucht: { titel: 'Head of Sales (m/w/d)' } }));
    expect(r.status).toBe('besetzt');
    expect(r.beleg?.url).toBe('https://beispiel.de/management');
  });
  it('Pressemeldung zur Besetzung zählt als besetzt', () => {
    expect(vertriebsleitungStatus(s({ leitungPresse: { titel: 'Beispiel ernennt neuen CRO', datum: '2026-05-02' } })).status).toBe('besetzt');
  });
  it('Stellenanzeige = gesucht, nie besetzt', () => {
    expect(vertriebsleitungStatus(s({ leitungGesucht: { titel: 'Vertriebsleiter (m/w/d)' }, vertriebsleitungTeam: 'nein' })).status).toBe('gesucht');
  });
  it('Vertriebsstellen ohne Leitung → Vertrieb ohne sichtbare Leitung', () => {
    const r = vertriebsleitungStatus(s({ vertriebsstellen: 2, vertriebsleitungTeam: 'nein' }));
    expect(r.status).toBe('team-ohne-leitung');
    expect(r.beleg?.text).toContain('2 Vertriebsstellen');
  });
  it('Team-Seite gelesen, nichts → keine sichtbar; nichts gelesen → unbekannt', () => {
    expect(vertriebsleitungStatus(s({ vertriebsleitungTeam: 'nein' })).status).toBe('keine-sichtbar');
    expect(vertriebsleitungStatus(s({})).status).toBe('unbekannt');
  });
});

describe('Bedarf, Potenzial, Segment', () => {
  it('frisch finanziert, Vertriebsstellen offen, keine Leitung → jetzt ansprechen', () => {
    const l = lageBewerten(s({ vertriebsleitungTeam: 'nein', vertriebsstellen: 3, stellen: 12, finanzierung: { datum: '2026-06-10', betrag: '8 Mio.' }, mitarbeitende: 40 }));
    expect(l.vertriebsleitung).toBe('team-ohne-leitung');
    expect(l.bedarf).toBe(30 + 20 + 15 + 5);
    expect(l.potenzial).toBe(20 + 5 + 15 + 10);
    expect(l.segment).toBe('jetzt');
    expect(l.satz).toMatch(/Jetzt ansprechen\.$/);
  });
  it('sehr hoher Bedarf reicht schon mit etwas Potenzial; ohne Potenzial bleibt es Aufbauen', () => {
    const hoch = s({ leitungGesucht: { titel: 'Head of Sales' }, vertriebsstellen: 3, mitarbeitende: 30, versionen12: 4, gruendungsjahr: 2021 });
    expect(lageBewerten(hoch).segment).toBe('jetzt');
    expect(lageBewerten(s({ leitungGesucht: { titel: 'Head of Sales' }, vertriebsstellen: 3 })).segment).toBe('aufbauen');
  });
  it('Leitung besetzt → beobachten, egal wie viel Potenzial', () => {
    expect(lageBewerten(s({ vertriebsleitungTeam: 'ja', rolleTeam: 'VP Sales', stellen: 30 })).segment).toBe('beobachten');
  });
  it('geringe Passung oder weder Bedarf noch Potenzial → kein Fokus', () => {
    expect(lageBewerten(s({ passung: 30, vertriebsleitungTeam: 'nein' })).segment).toBe('kein-fokus');
    expect(lageBewerten(s({ belege: true })).segment).toBe('kein-fokus');
  });
  it('alte Finanzierung zählt nicht, Übernahme senkt das Potenzial, Grenzen 0–100', () => {
    const l = lageBewerten(s({ finanzierung: { datum: '2023-01-01' }, uebernahme: true, belege: true }));
    expect(l.potenzial).toBe(0);
    const voll = lageBewerten(s({ leitungGesucht: { titel: 'CSO' }, vertriebsstellen: 9, demoGefuehrt: true, finanzierung: { datum: '2026-09-01', betrag: '1,2 Mrd.' }, euLaufend: 2, stellen: 40, mitarbeitende: 120, tranco: 9000, international: true, kunden: 900, wachstumsMeldungen: 3, zertifikate: 2, versionen12: 20, gruendungsjahr: 2020 }));
    expect(voll.bedarf).toBeLessThanOrEqual(100);
    expect(voll.potenzial).toBe(100);
  });
  it('frische Innovations-Auszeichnung hebt das Potenzial, alte nicht', () => {
    const ohne = lageBewerten(s({})).potenzial;
    const frisch = lageBewerten(s({ auszeichnung: { jahr: 2025, titel: 'TOP 100' } }));
    expect(frisch.potenzial - ohne).toBe(10);
    expect(frisch.gruendePotenzial.join(' ')).toContain('TOP 100 2025');
    expect(lageBewerten(s({ auszeichnung: { jahr: 2021, titel: 'TOP 100' } })).potenzial).toBe(ohne);
    expect(LAGE_REGELN.potenzial).toContain('Innovationspreis');
  });
  it('laufendes Bundes-Förderprojekt zählt wie ein EU-Projekt, nicht doppelt', () => {
    const ohne = lageBewerten(s({ belege: true })).potenzial;
    const bund = lageBewerten(s({ belege: true, bundLaufend: 2 }));
    expect(bund.potenzial - ohne).toBe(7);
    expect(bund.gruendePotenzial.join(' ')).toContain('Bundes-Förderprojekt');
    expect(lageBewerten(s({ belege: true, bundLaufend: 1, euLaufend: 1 })).potenzial - ohne).toBe(7);
    expect(lageBewerten(s({ bundLaufend: 1 })).gruendeBedarf.join(' ')).toContain('Bundes-Förderprojekt läuft');
  });
  it('Lead-Score nach Regel, Ausschluss = 0', () => {
    expect(leadScoreTief(80, { bedarf: 60, potenzial: 40 }, { mobil: '+49 170 0000000' })).toBe(Math.round(36 + 15 + 8 + 10));
    expect(leadScoreTief(0, { bedarf: 100, potenzial: 100 }, { mobil: 'x' })).toBe(0);
    expect(LAGE_REGELN.leadScore).toContain('45 %');
  });
});

describe('Steckbrief: Lage und Reichweite', () => {
  it('übernimmt gültige Werte, verwirft Unsinn', () => {
    const sb = steckbriefSaeubern({ gemessenAm: '2026-10-31T10:00:00.000Z',
      lage: { vertriebsleitung: 'gesucht', beleg: { text: 'Stellenanzeige: Head of Sales', url: 'https://beispiel.de/jobs/1' }, bedarf: 140, potenzial: 30, segment: 'jetzt', satz: 'Sucht eine Vertriebsleitung — Jetzt ansprechen.' },
      reichweite: { tranco: 54321, archivSeit: 2017, versionen12: 4 } });
    expect(sb?.lage).toMatchObject({ vertriebsleitung: 'gesucht', bedarf: 100, segment: 'jetzt' });
    expect(sb?.reichweite).toEqual({ tranco: 54321, archivSeit: 2017, versionen12: 4 });
    const kaputt = steckbriefSaeubern({ gemessenAm: '2026-10-31T10:00:00.000Z', lage: { vertriebsleitung: 'vielleicht', segment: 'jetzt', satz: 'x' }, reichweite: { tranco: 0, archivSeit: 12 }, branche: 'SaaS & Software' });
    expect(kaputt?.lage).toBeUndefined();
    expect(kaputt?.reichweite).toBeUndefined();
  });
});
