// Spaces (26.09.; Aufräumen Etappe 1, 08.10.; nur zwei Bereiche, 09.10.): Muster-Matching, aktiver Eintrag, Space aus der Adresse,
// die Leiste je Space, die Wahl im Kopf (nur Privat · Business) und der Umgang mit alten „Alles“-Adressen und -Merkern.
import { describe, it, expect } from 'vitest';
import * as spaces from '../lib/make-one/spaces';
import { passtZu, aktiverSpaceEintrag, aktiverLeistenPunkt, spaceVonAdresse, wechselZiel, leisteFuer, wahlVon, wahlAusParameter, gemerkteWahlAus, altesAlles, adresseOhneAlles, istSpaceWahl, SPACES, SPACE_WAHLEN, SPACE_VORGABE, ZOE_EINTRAG } from '../lib/make-one/spaces';

describe('Spaces', () => {
  it('passtZu: Pfad gleich oder Unterpfad, Parameter müssen stimmen; „=“ heißt genau dieser Pfad', () => {
    expect(passtZu('/os/aufgaben/board', '?space=privat&offen=1', '/os/aufgaben?space=privat')).toBe(true);
    expect(passtZu('/os/aufgaben', '?space=business', '/os/aufgaben?space=privat')).toBe(false);
    expect(passtZu('/os/planung/woche', '', '/os/planung')).toBe(true);
    expect(passtZu('/os/planungx', '', '/os/planung')).toBe(false);
    expect(passtZu('/os/finanzen/liquiditaet', '', '/os/finanzen/')).toBe(true);
    expect(passtZu('/os', '?space=privat', '=/os')).toBe(true);
    expect(passtZu('/os/familie', '', '=/os')).toBe(false);
  });
  it('aktiver Eintrag: genauestes Muster gewinnt; gemeinsame Seiten tragen keinen Space', () => {
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=steuern')).toMatchObject({ space: 'business', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/finanzen', '?s=privat')).toMatchObject({ space: 'privat', eintrag: { label: 'Finanzen' } });
    expect(aktiverSpaceEintrag('/os/gesundheit', '?s=ernaehrung')).toMatchObject({ space: 'privat', eintrag: { label: 'Gesundheit' } });
    expect(aktiverSpaceEintrag('/os/stapel', '')).toMatchObject({ space: null, eintrag: { label: 'ZOE' } });
    expect(aktiverSpaceEintrag('/os/wissen', '')).toMatchObject({ space: null, eintrag: { label: 'ZOE' } });
    expect(aktiverSpaceEintrag('/os/research', '')).toMatchObject({ space: null, eintrag: { label: 'ZOE' } });
    // 10.10.: die Fokus-Seite (oben rechts im Kopf) gehört zu keinem Punkt der Leiste — auch nicht zur Planung.
    expect(aktiverSpaceEintrag('/os/fokus', '')).toMatchObject({ space: null, eintrag: null });
    expect(aktiverSpaceEintrag('/os/inbox', '?space=business')).toMatchObject({ space: 'business', eintrag: { label: 'Inbox' } });
    expect(aktiverSpaceEintrag('/os/unternehmen', '')).toMatchObject({ space: 'business', eintrag: { label: 'Unternehmen' } });
    expect(aktiverSpaceEintrag('/os/mandate', '')).toMatchObject({ space: 'business', eintrag: { label: 'Produkte & Mandate' } });
    expect(aktiverSpaceEintrag('/os/konto', '').eintrag).toBeNull();
  });
  it('Space aus der Adresse: ?space= gewinnt, sonst der Eintrag, sonst null', () => {
    expect(spaceVonAdresse('/os/planung/jahr', '?space=business')).toBe('business');
    expect(spaceVonAdresse('/os/markttraktion', '?s=sales')).toBe('business');
    expect(spaceVonAdresse('/os/familie', '')).toBe('privat');
    expect(spaceVonAdresse('/os', '')).toBeNull();
    expect(spaceVonAdresse('/os', '?space=business')).toBe('business');
    expect(spaceVonAdresse('/os/inbox', '')).toBeNull();
    expect(spaceVonAdresse('/os/agenten', '')).toBeNull();
  });
  it('Leiste je Space: Heute zuerst, höchstens zwölf Punkte, eindeutige Adressen, ZOE als letzter (gemeinsam)', () => {
    for (const s of SPACES) {
      const l = leisteFuer(s.id);
      expect(l.length).toBeLessThanOrEqual(12);
      expect(new Set(l.map(e => e.href)).size).toBe(l.length);
      expect(l[0].label).toBe('Heute');
      expect(l.at(-1)).toBe(ZOE_EINTRAG);
      expect(s.start).toBe(`/os?space=${s.id}`);
    }
    expect(leisteFuer('privat').map(e => e.label)).toEqual(['Heute', 'Inbox', 'Kalender', 'Aufgaben', 'Planung', 'Finanzen', 'Gesundheit', 'Familie', 'Kontakte', 'ZOE']);
    expect(leisteFuer('business').map(e => e.label)).toEqual(['Heute', 'Inbox', 'Kalender', 'Aufgaben', 'Planung', 'Finanzen', 'Markttraktion', 'Produkte & Mandate', 'Unternehmen', 'ZOE']);
  });
  it('Hervorhebung in der Leiste passt zum Fundort', () => {
    // 10.10.: Kontakte stehen im Business nicht mehr in der Leiste — die Kartei gehört zur Markttraktion.
    expect(aktiverLeistenPunkt('business', '/os/markttraktion', '?s=kontakte&a=akte&k=c-1')?.label).toBe('Markttraktion');
    expect(aktiverLeistenPunkt('business', '/os/markttraktion', '?s=deals')?.label).toBe('Markttraktion');
    expect(aktiverLeistenPunkt('privat', '/os', '')?.label).toBe('Heute');
    expect(aktiverLeistenPunkt('privat', '/os/fokus', '')).toBeNull();
    expect(aktiverLeistenPunkt('business', '/os/fokus', '?space=business')).toBeNull();
    expect(aktiverLeistenPunkt('privat', '/os/planung/kapazitaet', '')?.label).toBe('Planung');
    expect(aktiverLeistenPunkt('business', '/os/kalender', '?modus=planen')?.label).toBe('Kalender');
    expect(aktiverLeistenPunkt('business', '/os/board', '')?.label).toBe('ZOE');
    expect(aktiverLeistenPunkt('business', '/os/meeting', '')?.label).toBe('ZOE');
    expect(aktiverLeistenPunkt('privat', '/os/menschen', '')?.label).toBe('Kontakte');
    expect(aktiverLeistenPunkt('privat', '/os/konto', '')).toBeNull();
  });
  it('Space-Schalter: Gegenstück im anderen Space, sonst Heute; gemeinsame Seiten bleiben stehen', () => {
    expect(wechselZiel('/os/aufgaben', '?space=privat', 'business')).toBe('/os/aufgaben?space=business');
    expect(wechselZiel('/os/menschen', '', 'business')).toBe('/os?space=business');
    expect(wechselZiel('/os/markttraktion', '?s=deals', 'privat')).toBe('/os?space=privat');
    expect(wechselZiel('/os', '', 'business')).toBe('/os?space=business');
    expect(wechselZiel('/os/konto', '', 'business')).toBeNull();
    expect(wechselZiel('/os/stapel', '', 'privat')).toBeNull();
  });

  // Nur zwei Bereiche (09.10., Kevin: „Oben der Knopf ‚Alles‘ kann raus — es gibt nur Business oder Privat“).
  it('Wahl: nur Privat · Business; ?space= gewinnt, sonst die Seite, sonst der gemerkte Space', () => {
    expect(SPACE_WAHLEN).toEqual(['privat', 'business']);
    expect(istSpaceWahl('alles')).toBe(false);
    expect(wahlAusParameter('?space=privat')).toBe('privat');
    expect(wahlAusParameter('?space=foo')).toBeNull();
    expect(wahlVon('/os', '', 'privat')).toBe('privat');
    expect(wahlVon('/os', '?space=business', 'privat')).toBe('business');
    expect(wahlVon('/os/gesundheit', '', 'business')).toBe('privat');
    expect(wahlVon('/os/markttraktion', '?s=deals', 'privat')).toBe('business');
    expect(wahlVon('/os/inbox', '', 'business')).toBe('business');
    // „Alles“ gibt es im Modul nicht mehr — kein Export erzeugt es.
    for (const n of ['ALLES', 'ALLES_EINTRAEGE', 'ALLES_GRUPPEN', 'wahlInfo']) expect(Object.keys(spaces), n).not.toContain(n);
  });
  it('alte Adressen ?space=alles: zählen wie kein Parameter — die Seite bzw. der gemerkte Space gilt', () => {
    expect(wahlAusParameter('?space=alles')).toBeNull();
    expect(wahlVon('/os', '?space=alles', 'privat')).toBe('privat');
    expect(wahlVon('/os/aufgaben', '?space=alles', 'business')).toBe('business');
    expect(wahlVon('/os/gesundheit', '?space=alles', 'business')).toBe('privat');
    expect(spaceVonAdresse('/os/aufgaben', '?space=alles')).toBeNull();
    expect(altesAlles('?space=alles&s=gesamt')).toBe(true);
    expect(altesAlles('?space=privat')).toBe(false);
    // Umschreiben (replace): nur der Parameter wird konkret, alle anderen bleiben in ihrer Reihenfolge.
    expect(adresseOhneAlles('/os', '?space=alles', 'business')).toBe('/os?space=business');
    expect(adresseOhneAlles('/os/aufgaben', '?p=x&space=alles&a=1', 'privat')).toBe('/os/aufgaben?p=x&space=privat&a=1');
    expect(adresseOhneAlles('/os/aufgaben', '?space=privat', 'business')).toBeNull();
    expect(adresseOhneAlles('/os', '', 'privat')).toBeNull();
  });
  it('gemerkter Space: Merker gewinnt; ein altes „alles“ nimmt den zuletzt konkreten, sonst Business; „nur Business“ immer Business', () => {
    expect(SPACE_VORGABE).toBe('business');
    expect(gemerkteWahlAus('privat', 'business')).toBe('privat');
    expect(gemerkteWahlAus('alles', 'privat')).toBe('privat');
    expect(gemerkteWahlAus('alles', null)).toBe('business');
    expect(gemerkteWahlAus(null, null)).toBe('business');
    expect(gemerkteWahlAus('kaputt', 'auch-kaputt')).toBe('business');
    expect(gemerkteWahlAus('privat', 'privat', true)).toBe('business');
  });
  it('Schalter mit zwei Werten: Gegenstück im anderen Space, Seiten ohne Gegenstück → dessen Heute, gemeinsame bleiben stehen', () => {
    expect(wechselZiel('/os/aufgaben', '', 'business')).toBe('/os/aufgaben?space=business');
    expect(wechselZiel('/os/gesundheit', '', 'privat')).toBeNull();
    expect(wechselZiel('/os/gesundheit', '', 'business')).toBe('/os?space=business');
    expect(wechselZiel('/os/stapel', '?space=business', 'privat')).toBe('/os?space=privat');
    // Etappe 2 (08.10.): „Gesamt“ gehört zu Privat — wer dort auf Privat schaltet, bleibt stehen; aus einem Business-Reiter geht es zum Privat-Überblick.
    expect(wechselZiel('/os/finanzen', '?s=gesamt', 'privat')).toBeNull();
    expect(wechselZiel('/os/finanzen', '?s=rechnungen', 'privat')).toBe('/os/finanzen?s=privat');
    // Kein Punkt der Leiste führt mehr auf „alles“.
    for (const w of SPACE_WAHLEN) for (const e of leisteFuer(w)) expect(e.href, e.label).not.toMatch(/space=alles/);
  });
});
