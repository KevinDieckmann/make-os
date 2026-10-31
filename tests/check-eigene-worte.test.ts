// Wächter: Checks mit eigenen Worten (31.10., Kevin: „immer Auswahlmöglichkeiten geben, aber zwischendrin auch einfach was schreiben“).
// Freiwillig zu jeder Auswahlfrage eine eigene Antwort (zählt nicht in die Punkte, geht an kein KI-Modell), dazu je Check ein bis zwei
// Pflichtfragen in eigenen Worten am Ende des Kurzchecks — nie überspringbar, ohne Punkte. Rein, ohne Server.
import { describe, expect, it } from 'vitest';
import { alleFragen, VORLAGEN } from '@/lib/check/katalog';
import { ANMERKUNG_MAX, EIGENE_WORTE_AUSZUG, antwortPruefen, eigeneWorte, kurzSequenz, ueberspringbar } from '@/lib/check/ablauf';
import { auswerten, profilAus, saeulenAuswerten } from '@/lib/check/auswertung';
import { oeffentlicherKatalog } from '@/lib/check/oeffentlich';
import type { CheckAntworten } from '@/lib/check/typen';

const inno = VORLAGEN['innovations-check'];
const frage = (v: typeof inno, id: string) => alleFragen(v.katalog).find(f => f.id === id)!;

describe('eigene Antwort zu einer Auswahlfrage (freiwillig)', () => {
  const f = frage(inno, 'B1');
  it('wird getrimmt gespeichert, leer fällt weg', () => {
    const r = antwortPruefen(f, { optionIds: ['B1_1'], anmerkung: '  Wir sind gerade mitten im Umbau.  ' });
    expect(r.ok && r.antwort).toEqual({ optionIds: ['B1_1'], anmerkung: 'Wir sind gerade mitten im Umbau.' });
    const leer = antwortPruefen(f, { optionIds: ['B1_1'], anmerkung: '   ' });
    expect(leer.ok && leer.antwort).toEqual({ optionIds: ['B1_1'] });
  });
  it('ersetzt nie die Auswahl, über der Grenze 413 (nie gekürzt), falscher Typ 400', () => {
    expect(antwortPruefen(f, { anmerkung: 'Nur Text' }).ok).toBe(false);
    const lang = antwortPruefen(f, { optionIds: ['B1_1'], anmerkung: 'x'.repeat(ANMERKUNG_MAX + 1) });
    expect(lang.ok === false && lang.status).toBe(413);
    const typ = antwortPruefen(f, { optionIds: ['B1_1'], anmerkung: 42 });
    expect(typ.ok === false && typ.status).toBe(400);
  });
  it('ändert keine Punkte', () => {
    const ohne: CheckAntworten = { A1: { optionIds: ['A1_0'] }, B1: { optionIds: ['B1_2'] }, C1: { optionIds: ['C1_1'] } };
    const mit: CheckAntworten = { ...ohne, B1: { optionIds: ['B1_2'], anmerkung: 'Strategie gibt es, aber nur im Kopf.' } };
    const p = profilAus(inno.katalog, ohne);
    expect(auswerten(inno.katalog, inno.regeln, p, mit)).toEqual(auswerten(inno.katalog, inno.regeln, p, ohne));
  });
});

describe('Pflichtfragen in eigenen Worten', () => {
  for (const [id, v] of Object.entries(VORLAGEN)) {
    it(`${id}: ein bis zwei, offen, ohne Punkte, am Ende des Kurzchecks, im Browser als Pflicht markiert`, () => {
      const pflicht = alleFragen(v.katalog).filter(f => f.pflicht);
      expect(pflicht.length).toBeGreaterThanOrEqual(1);
      expect(pflicht.length).toBeLessThanOrEqual(2);
      for (const f of pflicht) {
        expect(f.typ).toBe('offen');
        expect(f.punkte).toBe(false);
        expect(f.kurzcheck).toBe(true);
      }
      const kurz = kurzSequenz(v).map(f => f.id);
      expect(kurz.slice(-pflicht.length)).toEqual(pflicht.map(f => f.id));
      const oeff = oeffentlicherKatalog(v).fragen.filter(f => f.pflicht).map(f => f.id);
      expect(oeff).toEqual(pflicht.map(f => f.id));
    });
  }
  it('nie überspringbar — auch nicht in Vertiefung oder Branchen-Modul; andere offene Fragen bleiben überspringbar', () => {
    const w1 = frage(inno, 'W1');
    for (const phase of ['kurzcheck', 'vertiefung', 'branche'] as const) expect(ueberspringbar(w1, phase)).toBe(false);
    expect(ueberspringbar(frage(inno, 'C5'), 'kurzcheck')).toBe(true);
  });
  it('leer abgelehnt mit freundlichem Satz', () => {
    const r = antwortPruefen(frage(inno, 'W1'), { freitext: '  ' });
    expect(r.ok === false && r.fehler).toBe('Bitte ein paar Worte schreiben — ein Satz reicht.');
  });
  it('zählen nicht in Bereiche oder Gesamtwert (Säulen-Check)', () => {
    const v = VORLAGEN['vertriebs-check'];
    const ohne: CheckAntworten = { A1: { optionIds: ['A1_1'] }, V1: { optionIds: ['V1_2'] }, V2: { optionIds: ['V2_3'] } };
    const mit: CheckAntworten = { ...ohne, W1: { freitext: 'Angebote bleiben liegen.' }, W2: { freitext: 'Jede Anfrage hat einen nächsten Schritt.' } };
    const p = profilAus(v.katalog, ohne);
    const a = auswerten(v.katalog, v.regeln, p, ohne), b = auswerten(v.katalog, v.regeln, p, mit);
    expect(saeulenAuswerten(v.katalog, v.regeln, mit, b)).toEqual(saeulenAuswerten(v.katalog, v.regeln, ohne, a));
  });
});

describe('eigene Worte in der Anfrage im CRM', () => {
  const v = VORLAGEN['vertriebs-check'];
  it('Frage und Antwort im Wortlaut, ohne Pflichtantworten leer', () => {
    expect(eigeneWorte(v, {})).toBe('');
    expect(eigeneWorte(v, { W1: { freitext: 'Angebote  bleiben\nliegen.' } })).toBe('In eigenen Worten: Wo hakt es in Ihrem Vertrieb gerade am meisten? „Angebote bleiben liegen.“');
  });
  it('lange Antworten sichtbar gekürzt mit Hinweis — nie still', () => {
    const t = eigeneWorte(v, { W1: { freitext: 'a'.repeat(EIGENE_WORTE_AUSZUG + 50) } });
    expect(t).toContain(`${'a'.repeat(EIGENE_WORTE_AUSZUG)} …“`);
    expect(t).toContain('(gekürzt, vollständig in der Check-Verwaltung)');
    expect(t.length).toBeLessThan(1500);
  });
  it('freiwillige Anmerkungen gehen nicht in die Anfrage (nur in die Check-Verwaltung)', () => {
    expect(eigeneWorte(v, { V1: { optionIds: ['V1_1'], anmerkung: 'privat' } })).toBe('');
  });
});
