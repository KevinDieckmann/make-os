// Kalender K1 (29.09.): Anlege-Dialog wie Google — Formular → Anfrage (Termin-Route oder dieselbe Aufgabe), Art-Wechsel,
// Prüfung; Aufziehen im Raster („(Kein Titel) 4–5 Uhr“). Erfundene Daten.
import { describe, it, expect } from 'vitest';
import { formularStart, artWechseln, formularFehler, formularAnfrage, entwurfWertvoll } from '../lib/kalender/formular';
import { ziehSpanne, spanneText } from '../lib/kalender/layout';
import { anlegenPruefen } from '../lib/kalender/eingabe';

describe('Anlege-Formular', () => {
  it('Start aus Aufziehen: Termin mit Zeit, Standard-Erinnerung 10 Min., Berlin', () => {
    const f = formularStart({ tag: '2026-09-30', von: '04:00', bis: '05:00' }, 60);
    expect(f).toMatchObject({ art: 'termin', von: '04:00', bis: '05:00', ganztags: false, zone: 'Europe/Berlin', erinnerungen: [10], sichtbarkeit: 'standard', beschaeftigt: null });
    expect(formularStart({ tag: '2026-09-30', art: 'abwesend' }, 60)).toMatchObject({ ganztags: true, erinnerungen: [] });
    expect(formularStart({ tag: '2026-09-30', art: 'fokus', von: '09:00' }, 60, 90).bis).toBe('10:30');
  });
  it('Art wechseln: Arbeitsort ganztägig, Fokuszeit mit Fokusdauer, Eingetipptes bleibt', () => {
    const f = { ...formularStart({ tag: '2026-09-30', von: '09:00' }, 60), titel: 'Angebot' };
    expect(artWechseln(f, 'arbeitsort', 60)).toMatchObject({ art: 'arbeitsort', ganztags: true, titel: 'Angebot' });
    expect(artWechseln(f, 'fokus', 60, 120)).toMatchObject({ art: 'fokus', ganztags: false, bis: '11:00' });
    expect(artWechseln(artWechseln(f, 'fokus', 60, 120), 'termin', 60).bis).toBe('10:00');
  });
  it('Termin → Körper der Route; die Route nimmt ihn an', () => {
    const f = { ...formularStart({ tag: '2026-09-30', von: '10:00', bis: '11:30', wer: 'malin' }, 60), titel: 'Steuer', farbe: 'gold', sichtbarkeit: 'privat' as const, zone: 'America/New_York', erinnerungen: [60, 10], wiederholung: { freq: 'WEEKLY' as const, tage: ['WE' as const] }, ort: 'Büro' };
    const a = formularAnfrage(f);
    expect(a).toEqual({ art: 'termin', koerper: { art: 'termin', titel: 'Steuer', ganztags: false, start: '2026-09-30T10:00', ende: '2026-09-30T11:30', wer: 'malin', ort: 'Büro', wiederholung: { freq: 'WEEKLY', tage: ['WE'] }, erinnerungenMin: [10, 60], farbe: 'gold', sichtbarkeit: 'privat', zone: 'America/New_York' } });
    expect(anlegenPruefen((a as { koerper: Record<string, unknown> }).koerper)).toMatchObject({ ok: true, e: { zone: 'America/New_York', wer: 'malin', beschaeftigt: true } });
  });
  it('Abwesend über mehrere Tage (Ende exklusiv), Arbeitsort ohne Titel, Fokus mit Bezug nur als Kennung', () => {
    const ab = { ...formularStart({ tag: '2026-10-05', art: 'abwesend' }, 60), titel: 'Urlaub', bisTag: '2026-10-09' };
    expect((formularAnfrage(ab) as { koerper: Record<string, unknown> }).koerper).toMatchObject({ art: 'abwesend', ganztags: true, start: '2026-10-05', ende: '2026-10-10' });
    const ort = { ...formularStart({ tag: '2026-10-05', art: 'arbeitsort' }, 60), arbeitsort: { art: 'buero' as const } };
    expect(formularFehler(ort)).toBeNull();
    expect(anlegenPruefen((formularAnfrage(ort) as { koerper: Record<string, unknown> }).koerper)).toMatchObject({ ok: true, e: { titel: 'Büro', art: 'arbeitsort', beschaeftigt: false } });
    const fo = { ...formularStart({ tag: '2026-10-05', art: 'fokus', von: '09:00' }, 60), titel: 'Deep Work', fokus: { aufgabeId: 't-1', mandatId: 'm-1' } };
    expect((formularAnfrage(fo) as { koerper: Record<string, unknown> }).koerper).toMatchObject({ art: 'fokus', bezug: { aufgabeId: 't-1', mandatId: 'm-1' } });
    expect((formularAnfrage(fo) as { koerper: Record<string, unknown> }).koerper).not.toHaveProperty('beschaeftigt');
  });
  it('Aufgabe → dieselbe Aufgabe im Aufgaben-Modell (Deadline + Uhrzeit, Ort in den Aufgaben)', () => {
    const f = { ...formularStart({ tag: '2026-10-02', art: 'aufgabe', von: '14:30', spaceId: 'kdc' }, 60), titel: 'Rechnung prüfen', notiz: 'bis mittags' };
    expect(formularAnfrage(f)).toEqual({ art: 'aufgabe', neu: { title: 'Rechnung prüfen', dueDate: '2026-10-02', dueTime: '14:30', description: 'bis mittags' }, ziel: { spaceId: 'kdc' } });
    expect(formularAnfrage({ ...f, aufgabe: { ...f.aufgabe, mitZeit: false, projectId: 'p-1', listeId: 'l-1' } })).toMatchObject({ neu: { title: 'Rechnung prüfen', dueDate: '2026-10-02' }, ziel: { spaceId: 'kdc', projectId: 'p-1', listeId: 'l-1' } });
    expect((formularAnfrage({ ...f, aufgabe: { ...f.aufgabe, mitZeit: false } }) as { neu: object }).neu).not.toHaveProperty('dueTime');
  });
  it('Prüfung und Entwurf', () => {
    const f = formularStart({ tag: '2026-09-30', von: '10:00' }, 60);
    expect(formularFehler(f)).toBe('Ein Titel fehlt.');
    expect(formularFehler({ ...f, titel: 'x', bis: '09:00' })).toBe('Das Ende liegt vor dem Anfang.');
    expect(formularFehler({ ...f, titel: 'x', ganztags: true, bisTag: '2026-09-29' })).toBe('Der letzte Tag liegt vor dem ersten.');
    expect(entwurfWertvoll(f)).toBe(false); expect(entwurfWertvoll({ ...f, notiz: 'Idee' })).toBe(true);
  });
});

describe('Aufziehen im Raster', () => {
  it('15-Minuten-Raster, beide Richtungen, mindestens ein Schritt, im Tag', () => {
    expect(ziehSpanne(240, 300)).toEqual({ von: 240, bis: 300 });
    expect(ziehSpanne(305, 244)).toEqual({ von: 240, bis: 300 });
    expect(ziehSpanne(600, 603)).toEqual({ von: 600, bis: 615 });
    expect(ziehSpanne(1430, 1500)).toEqual({ von: 1425, bis: 1440 });
    expect(spanneText(240, 300)).toBe('4–5 Uhr');
    expect(spanneText(570, 615)).toBe('9:30–10:15 Uhr');
    expect(spanneText(1380, 1440)).toBe('23–0 Uhr');
  });
});
