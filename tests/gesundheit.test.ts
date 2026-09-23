// ─── Gesundheit: die Regeln des Takts und der Einträge ──────────────────────
// Jeder Test schützt eine Regel, deren Bruch Kevin entweder nervt (doppelte
// Nachrichten) oder verletzt (ein Streak, der wegen eines vergessenen Abends
// auf null springt).

import { describe, it, expect } from 'vitest';
import {
  saeubereHaut, saeubereStreak, hautTrend, streakStand, routineQuote, routineAusZuruf, tageZurueck,
  type HautLog, type StreakLog,
} from '../lib/gesundheit/eintraege';
import { faelligeSlots, markiere, morgenText, abendText, wochenText, type TaktStand } from '../lib/gesundheit/takt';
import { neuerCode, codeAnlegen, loeseCode, personFuerChat, chatsFuerPerson, leererStand, teile } from '../lib/telegram';

const HEUTE = '2026-09-23';
const AT = '2026-09-23T21:00:00.000Z';
const um = (h: number, tag = HEUTE) => new Date(`${tag}T${String(h).padStart(2, '0')}:30:00`);

describe('Takt', () => {
  it('sendet jeden Slot genau einmal am Tag', () => {
    let stand: TaktStand = {};
    expect(faelligeSlots(stand, 'kevin', um(8), HEUTE)).toEqual(['morgen']);
    stand = markiere(stand, 'kevin', 'morgen', HEUTE);
    expect(faelligeSlots(stand, 'kevin', um(8), HEUTE)).toEqual([]);
    expect(faelligeSlots(stand, 'kevin', um(13), HEUTE)).toEqual(['mittag']);
  });

  it('holt eine verpasste Morgennachricht nicht am Nachmittag nach', () => {
    expect(faelligeSlots({}, 'kevin', um(16), HEUTE)).toEqual([]);
  });

  it('kennt den Wochenrückblick nur sonntags', () => {
    const sonntag = '2026-09-27';
    expect(faelligeSlots({}, 'kevin', um(19, sonntag), sonntag)).toEqual(['woche']);
    expect(faelligeSlots({}, 'kevin', um(19), HEUTE)).toEqual([]);
  });

  it('hält die Personen auseinander', () => {
    const stand = markiere({}, 'kevin', 'morgen', HEUTE);
    expect(faelligeSlots(stand, 'malin', um(8), HEUTE)).toEqual(['morgen']);
  });

  it('nachts ist Ruhe', () => {
    expect(faelligeSlots({}, 'kevin', um(2), HEUTE)).toEqual([]);
  });
});

describe('Texte', () => {
  it('sagt morgens ehrlich, wenn keine Werte da sind', () => {
    const t = morgenText({ name: 'Kevin', vitals: { heute: false, rec: 74 }, routinen: [] });
    expect(t).toContain('noch keine Werte');
    expect(t).not.toContain('74');
  });

  it('färbt die Lage nach Whoops Schwellen 66/40', () => {
    expect(morgenText({ name: 'K', vitals: { heute: true, rec: 70 }, routinen: [] })).toContain('grün');
    expect(morgenText({ name: 'K', vitals: { heute: true, rec: 50 }, routinen: [] })).toContain('gelb');
    expect(morgenText({ name: 'K', vitals: { heute: true, rec: 30 }, routinen: [] })).toContain('rot');
  });

  it('fragt abends nach dem Streak nur, wenn er läuft', () => {
    expect(abendText({ name: 'K', routinen: [], streakAktiv: true })).toContain('Sauber');
    expect(abendText({ name: 'K', routinen: [], streakAktiv: false })).not.toContain('Sauber');
  });

  it('nennt in der Woche den häufigsten Auslöser', () => {
    const haut = hautTrend({ [HEUTE]: { juckreiz: 5, schub: false, ausloeser: 'Stress', at: AT }, '2026-09-22': { juckreiz: 6, schub: true, ausloeser: 'stress', at: AT } }, HEUTE);
    const t = wochenText({ name: 'K', routinenQuote: 0.5, routinenTage: 4, journalTage: 3, haut, streak: streakStand({}, HEUTE) });
    expect(t).toContain('Auslöser: stress');
  });
});

describe('Haut', () => {
  it('nimmt nur Einträge mit Juckreiz — und hält ihn zwischen 0 und 10', () => {
    expect(saeubereHaut({}, AT)).toBeNull();
    expect(saeubereHaut({ juckreiz: 14 }, AT)?.juckreiz).toBe(10);
    expect(saeubereHaut({ juckreiz: -3 }, AT)?.juckreiz).toBe(0);
  });

  it('wertet Juckreiz ab 7 als Schub, auch ohne Angabe', () => {
    expect(saeubereHaut({ juckreiz: 8 }, AT)?.schub).toBe(true);
    expect(saeubereHaut({ juckreiz: 3 }, AT)?.schub).toBe(false);
    expect(saeubereHaut({ juckreiz: 3, schub: 'ja' }, AT)?.schub).toBe(true);
  });

  it('erkennt die Richtung im Vergleich zur Woche davor', () => {
    const log: HautLog = {};
    for (const d of tageZurueck(HEUTE, 7)) log[d] = { juckreiz: 3, schub: false, at: AT };
    for (const d of tageZurueck(HEUTE, 14).slice(7)) log[d] = { juckreiz: 6, schub: true, at: AT };
    const t = hautTrend(log, HEUTE);
    expect(t.richtung).toBe('besser');
    expect(t.juckreiz7).toBe(3);
    expect(t.schuebe30).toBe(7);
  });

  it('sagt „unbekannt", wenn die Vorwoche fehlt', () => {
    expect(hautTrend({ [HEUTE]: { juckreiz: 2, schub: false, at: AT } }, HEUTE).richtung).toBe('unbekannt');
  });
});

describe('Streak', () => {
  it('zählt Tage seit dem letzten Rückfall, nicht Tage mit Eintrag', () => {
    const log: StreakLog = { '2026-09-10': { sauber: false, at: AT }, '2026-09-11': { sauber: true, at: AT }, [HEUTE]: { sauber: true, at: AT } };
    expect(streakStand(log, HEUTE).sauberTage).toBe(13);
    expect(streakStand(log, HEUTE).letzterRueckfall).toBe('2026-09-10');
  });

  it('verliert den Zähler nicht, wenn ein Abend vergessen wurde', () => {
    const log: StreakLog = { '2026-09-15': { sauber: true, at: AT }, '2026-09-22': { sauber: true, at: AT } };
    expect(streakStand(log, HEUTE).sauberTage).toBe(9);
    expect(streakStand(log, HEUTE).aktuell).toBe(true);
  });

  it('zeigt nach drei stummen Tagen keinen Zähler mehr, sondern „unbekannt"', () => {
    const log: StreakLog = { '2026-09-15': { sauber: true, at: AT } };
    const s = streakStand(log, HEUTE);
    expect(s.aktuell).toBe(false);
    expect(s.sauberTage).toBe(0);
  });

  it('nimmt nur echte Ja/Nein-Antworten', () => {
    expect(saeubereStreak({ sauber: 'ja' }, AT)).toBeNull();
    expect(saeubereStreak({ sauber: true, craving: 40 }, AT)?.craving).toBe(10);
  });
});

describe('Routinen', () => {
  it('rechnet die Quote nur über vollständige Tage', () => {
    const log = { [HEUTE]: ['reha', 'supps'], '2026-09-22': ['reha'] };
    expect(routineQuote(log, ['reha', 'supps'], HEUTE, 2).quote).toBe(0.5);
    expect(routineQuote(log, ['reha'], HEUTE, 2).quote).toBe(1);
  });

  it('versteht einen Zuruf', () => {
    const r = [{ id: 'reha', label: 'Reha & Mobilität · 20 Min' }, { id: 'supps', label: 'Supplements genommen' }, { id: 'lesen', label: 'Lesen · 30 Min' }];
    expect(routineAusZuruf('Reha gemacht', r)).toBe('reha');
    expect(routineAusZuruf('supplements', r)).toBe('supps');
    expect(routineAusZuruf('gelesen', r)).toBeUndefined();
    expect(routineAusZuruf('lesen', r)).toBe('lesen');
  });
});

describe('Telegram-Kopplung', () => {
  const jetzt = new Date('2026-09-23T10:00:00Z');

  it('erzeugt Codes ohne verwechselbare Zeichen', () => {
    for (let i = 0; i < 50; i++) expect(neuerCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('koppelt einen Chat genau einmal und nur mit gültigem Code', () => {
    const { stand, code } = codeAnlegen(leererStand(), 'kevin', jetzt);
    const falsch = loeseCode(stand, 'XXXXXX', 1, jetzt);
    expect(falsch.person).toBeUndefined();
    const richtig = loeseCode(stand, code.toLowerCase(), 1, jetzt, 'Kevin');
    expect(richtig.person).toBe('kevin');
    expect(personFuerChat(richtig.stand, 1)).toBe('kevin');
    // Derselbe Code ein zweites Mal: verbraucht.
    expect(loeseCode(richtig.stand, code, 2, jetzt).person).toBeUndefined();
  });

  it('lässt Codes nach 15 Minuten verfallen', () => {
    const { stand, code } = codeAnlegen(leererStand(), 'malin', jetzt);
    const spaeter = new Date(jetzt.getTime() + 16 * 60_000);
    expect(loeseCode(stand, code, 5, spaeter).grund).toContain('abgelaufen');
  });

  it('ersetzt den alten Code einer Person durch den neuen', () => {
    const a = codeAnlegen(leererStand(), 'kevin', jetzt);
    const b = codeAnlegen(a.stand, 'kevin', jetzt);
    expect(loeseCode(b.stand, a.code, 1, jetzt).person).toBeUndefined();
    expect(loeseCode(b.stand, b.code, 1, jetzt).person).toBe('kevin');
  });

  it('erlaubt einer Person mehrere Chats, aber einem Chat nur eine Person', () => {
    let s = leererStand();
    let c = codeAnlegen(s, 'kevin', jetzt); s = loeseCode(c.stand, c.code, 1, jetzt).stand;
    c = codeAnlegen(s, 'kevin', jetzt); s = loeseCode(c.stand, c.code, 2, jetzt).stand;
    c = codeAnlegen(s, 'malin', jetzt); s = loeseCode(c.stand, c.code, 2, jetzt).stand;
    expect(chatsFuerPerson(s, 'kevin')).toEqual([1]);
    expect(personFuerChat(s, 2)).toBe('malin');
  });

  it('teilt lange Nachrichten an Absatzgrenzen', () => {
    const t = Array.from({ length: 30 }, (_, i) => `Absatz ${i} ${'x'.repeat(200)}`).join('\n\n');
    const st = teile(t, 1000);
    expect(st.length).toBeGreaterThan(1);
    for (const s of st) expect(s.length).toBeLessThanOrEqual(1000);
    expect(st.join('\n\n').replace(/\s+/g, '')).toBe(t.replace(/\s+/g, ''));
  });
});
