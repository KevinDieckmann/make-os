// ─── Zeit-Auswertung „wie Google Time Insights“ (29.09., K2) — reine Rechnung ─
import { describe, it, expect } from 'vitest';
import { wocheAuswerten, zeitAuswertung, terminKategorie, auswertungMarkdown, montagDer, stundenAus, abweichungText, type ATermin, type AuswertungEingabe } from '@/lib/kalender/auswertung';
import { istFeiertag } from '@/lib/zeit/kalender-kern';
import { ausWandzeit } from '@/lib/kalender/zeit';

const T = (start: string, ende: string, x: Partial<ATermin> = {}): ATermin => ({ start, ende, ganztags: false, space: 'business', ...x });
const iso = (wand: string) => ausWandzeit(wand).toISOString();
const E = (x: Partial<AuswertungEingabe> = {}): AuswertungEingabe => ({ termine: [], bloecke: [], arbeitszeit: { vonStunde: 9, bisStunde: 17 }, feiertag: istFeiertag, ...x });

describe('Arten', () => {
  it('Meeting = mit Gästen oder Art termin; Fokuszeit; Abwesend; Aufgabe/Arbeitsort/frei zählen nicht', () => {
    expect(terminKategorie({ ganztags: false })).toBe('meeting');
    expect(terminKategorie({ ganztags: false, art: 'fokuszeit' })).toBe('fokus');
    expect(terminKategorie({ ganztags: true, art: 'abwesend' })).toBe('abwesend');
    expect(terminKategorie({ ganztags: false, art: 'aufgabe' })).toBeNull();
    expect(terminKategorie({ ganztags: false, art: 'aufgabe', mitTeilnehmern: true })).toBe('meeting');
    expect(terminKategorie({ ganztags: false, frei: true })).toBeNull();
    expect(terminKategorie({ ganztags: false, frei: true, mitTeilnehmern: true })).toBe('meeting');
    expect(terminKategorie({ ganztags: true })).toBeNull(); // Geburtstag, Feiertag
  });
});

describe('Eine Woche', () => {
  it('Berliner Woche Mo–So, Stichtag irgendwo darin', () => {
    const w = wocheAuswerten(E(), '2026-10-01');
    expect([w.von, w.bis, w.kw]).toEqual(['2026-09-28', '2026-10-04', 40]);
    expect(montagDer('2026-10-04')).toBe('2026-09-28');
    expect(w.laenge).toBe(7 * 24 * 60);
  });
  it('Überlappungen zählen nie doppelt — Vorrang abwesend > Meeting > Fokus', () => {
    const w = wocheAuswerten(E({
      termine: [T('2026-09-29T10:00:00', '2026-09-29T11:00:00'), T('2026-09-29T10:30:00', '2026-09-29T11:30:00'), T('2026-09-29T11:00:00', '2026-09-29T13:00:00', { art: 'fokuszeit' })],
      bloecke: [{ von: iso('2026-09-29T12:00:00'), bis: iso('2026-09-29T14:00:00'), space: 'business' }],
    }), '2026-09-29');
    expect(w.minuten.meetings).toBe(90); // 10:00–11:30
    expect(w.minuten.fokus).toBe(150); // 11:30–14:00 (Termin + Block vereint)
    expect(w.minuten.belegt).toBe(240);
    expect(w.anzahlMeetings).toBe(2);
    expect(w.tage[1]).toEqual({ tag: '2026-09-29', meetings: 90, fokus: 150, abwesend: 0 });
  });
  it('frei = Arbeitszeit Mo–Fr ohne Feiertage minus Belegtes', () => {
    // KW 40/2026: Sa 3.10. ist Feiertag, aber ohnehin Wochenende → 5 × 8 h Arbeitszeit
    const w = wocheAuswerten(E({ termine: [T('2026-09-29T09:00:00', '2026-09-29T10:00:00'), T('2026-09-29T20:00:00', '2026-09-29T21:00:00')] }), '2026-09-29');
    expect(w.minuten.arbeitszeit).toBe(5 * 8 * 60);
    expect(w.minuten.frei).toBe(5 * 8 * 60 - 60); // der Abendtermin liegt außerhalb der Arbeitszeit
    expect(w.minuten.meetings).toBe(120);
    // Woche mit Fronleichnam (Do 4.6.2026): nur 4 Arbeitstage
    expect(wocheAuswerten(E(), '2026-06-03').minuten.arbeitszeit).toBe(4 * 8 * 60);
  });
  it('Soll-Arbeitszeit aus der Wochenvorlage (K1-Verfügbarkeit) ersetzt das Standardfenster', () => {
    const w = wocheAuswerten(E({
      arbeitszeitJeTag: { '2026-09-29': [{ start: '2026-09-29T08:00:00', ende: '2026-09-29T12:00:00' }, { start: '2026-09-29T13:00:00', ende: '2026-09-29T15:00:00' }] },
      termine: [T('2026-09-29T11:00:00', '2026-09-29T13:30:00'), T('2026-09-30T00:00:00', '2026-10-01T00:00:00', { ganztags: true, art: 'abwesend' })],
    }), '2026-09-29');
    expect(w.minuten.arbeitszeit).toBe(6 * 60); // nur Dienstag laut Vorlage
    expect(w.minuten.frei).toBe(6 * 60 - 90); // 11–12 und 13–13:30 belegt
    expect(w.minuten.abwesend).toBe(0); // Mittwoch hat laut Vorlage keine Arbeitszeit
  });
  it('ganztägig abwesend = Arbeitszeit dieses Tages', () => {
    const w = wocheAuswerten(E({ termine: [T('2026-09-30T00:00:00', '2026-10-02T00:00:00', { ganztags: true, art: 'abwesend' }), T('2026-09-30T10:00:00', '2026-09-30T11:00:00')] }), '2026-09-30');
    expect(w.minuten.abwesend).toBe(2 * 8 * 60); // Mi + Do
    expect(w.minuten.meetings).toBe(0); // Meeting im Urlaub zählt als abwesend
    expect(w.minuten.frei).toBe(3 * 8 * 60);
  });
  it('Zeitumstellung: Woche mit 167 bzw. 169 Stunden, Nachttermin über die Umstellung', () => {
    const maerz = wocheAuswerten(E({ termine: [T('2026-03-29T01:30:00', '2026-03-29T03:30:00')] }), '2026-03-29');
    expect(maerz.laenge).toBe(167 * 60);
    expect(maerz.minuten.meetings).toBe(60); // 01:30–03:30 Wandzeit = eine echte Stunde
    const oktober = wocheAuswerten(E({ termine: [T('2026-10-25T01:30:00', '2026-10-25T03:30:00')] }), '2026-10-25');
    expect(oktober.laenge).toBe(169 * 60);
    expect(oktober.minuten.meetings).toBe(180);
    expect(oktober.tage[6].meetings).toBe(180);
  });
  it('Privat/Business, je Firma, je Mandat und Kontakte (K3-Schnittstelle)', () => {
    const w = wocheAuswerten(E({
      termine: [T('2026-09-29T10:00:00', '2026-09-29T11:00:00', { mandatId: 'm-1', kontakte: ['c-anna-test', 'c-bert-test'] }), T('2026-09-30T18:00:00', '2026-09-30T19:00:00', { space: 'privat', kontakte: ['c-anna-test'] })],
      bloecke: [{ von: iso('2026-10-01T09:00:00'), bis: iso('2026-10-01T10:30:00'), space: 'business', einheit: 'KD Ventures', mandatId: 'm-1' }, { von: iso('2026-10-01T20:00:00'), bis: iso('2026-10-01T20:30:00'), space: 'privat' }],
    }), '2026-09-29');
    expect(w.space).toEqual({ privat: 90, business: 150 });
    expect(w.jeEinheit).toEqual([{ einheit: 'KD Ventures', minuten: 90 }]);
    expect(w.jeMandat).toEqual([{ mandatId: 'm-1', minuten: 150 }]);
    expect(w.kontakte).toEqual([{ id: 'c-anna-test', termine: 2, minuten: 120 }, { id: 'c-bert-test', termine: 1, minuten: 60 }]);
  });
});

describe('Vergleich zum 4-Wochen-Schnitt und Brain-Text', () => {
  it('Schnitt der vier Vorwochen, Abweichung je Kennzahl', () => {
    const termine = [
      T('2026-09-01T10:00:00', '2026-09-01T12:00:00'), // KW 36
      T('2026-09-08T10:00:00', '2026-09-08T14:00:00'), // KW 37
      T('2026-09-29T10:00:00', '2026-09-29T15:00:00'), // KW 40 (die Woche)
    ];
    const a = zeitAuswertung(E({ termine }), '2026-09-30');
    expect(a.vorher.map(w => w.kw)).toEqual([36, 37, 38, 39]);
    expect(a.schnitt.meetings).toBe(90); // (120 + 240 + 0 + 0) / 4
    expect(a.abweichung.meetings).toBe(300 - 90);
    expect(abweichungText(a.abweichung.meetings)).toBe('+3,5 h');
    expect(stundenAus(90)).toBe('1,5 h');
    const md = auswertungMarkdown(a, { mandat: () => 'X' });
    expect(md).toContain('## Zeit KW 40');
    expect(md).toContain('- Meetings: 5 h (Ø 4 Wochen 1,5 h, +3,5 h) · 1 Termine');
    expect(md).not.toContain('10:00'); // keine Termin-Titel/Uhrzeiten im Brain
  });
});
