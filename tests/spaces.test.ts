// Spaces (26.09.; Aufräumen Etappe 1, 08.10.): Muster-Matching, aktiver Eintrag, Space aus der Adresse, die Leiste je Space.
import { describe, it, expect } from 'vitest';
import { passtZu, aktiverSpaceEintrag, aktiverLeistenPunkt, spaceVonAdresse, wechselZiel, leisteFuer, wahlVon, wahlAusParameter, wahlInfo, SPACES, SPACE_WAHLEN, ALLES_EINTRAEGE, ALLES_GRUPPEN, ZOE_EINTRAG } from '../lib/make-one/spaces';

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
    expect(aktiverSpaceEintrag('/os/wachstum', '')).toMatchObject({ space: null, eintrag: { label: 'Planung' } });
    expect(aktiverSpaceEintrag('/os/inbox', '?space=business')).toMatchObject({ space: 'business', eintrag: { label: 'Inbox' } });
    expect(aktiverSpaceEintrag('/os/unternehmen', '')).toMatchObject({ space: 'business', eintrag: { label: 'Mandate & Unternehmen' } });
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
    expect(leisteFuer('business').map(e => e.label)).toEqual(['Heute', 'Inbox', 'Kalender', 'Aufgaben', 'Planung', 'Finanzen', 'Markttraktion', 'Mandate & Unternehmen', 'Kontakte', 'ZOE']);
  });
  it('Hervorhebung in der Leiste passt zum Fundort', () => {
    expect(aktiverLeistenPunkt('business', '/os/markttraktion', '?s=kontakte&a=akte&k=c-1')?.label).toBe('Kontakte');
    expect(aktiverLeistenPunkt('business', '/os/markttraktion', '?s=deals')?.label).toBe('Markttraktion');
    expect(aktiverLeistenPunkt('privat', '/os', '')?.label).toBe('Heute');
    expect(aktiverLeistenPunkt('privat', '/os/kompass', '')?.label).toBe('Planung');
    expect(aktiverLeistenPunkt('privat', '/os/fokus', '')?.label).toBe('Planung');
    expect(aktiverLeistenPunkt('business', '/os/kalender', '?modus=planen')?.label).toBe('Kalender');
    expect(aktiverLeistenPunkt('business', '/os/board', '')?.label).toBe('ZOE');
    expect(aktiverLeistenPunkt('business', '/os/meeting', '')?.label).toBe('ZOE');
    expect(aktiverLeistenPunkt('privat', '/os/menschen', '')?.label).toBe('Kontakte');
    expect(aktiverLeistenPunkt('privat', '/os/konto', '')).toBeNull();
  });
  it('Space-Schalter: Gegenstück im anderen Space, sonst Heute; gemeinsame Seiten bleiben stehen', () => {
    expect(wechselZiel('/os/aufgaben', '?space=privat', 'business')).toBe('/os/aufgaben?space=business');
    expect(wechselZiel('/os/menschen', '', 'business')).toBe('/os/markttraktion?s=kontakte');
    expect(wechselZiel('/os/markttraktion', '?s=deals', 'privat')).toBe('/os?space=privat');
    expect(wechselZiel('/os', '', 'business')).toBe('/os?space=business');
    expect(wechselZiel('/os/konto', '', 'business')).toBeNull();
    expect(wechselZiel('/os/stapel', '', 'privat')).toBeNull();
  });

  // Nachbesserung 08.10. (Kevin: „ein Schalter, oben, mit Alles“)
  it('Wahl: ?space= gewinnt (auch alles); gemerktes „Alles“ bleibt auf Seiten eines Bereichs; gemerkter Space folgt der Seite', () => {
    expect(SPACE_WAHLEN).toEqual(['alles', 'privat', 'business']);
    expect(wahlAusParameter('?space=alles')).toBe('alles');
    expect(wahlAusParameter('?space=foo')).toBeNull();
    expect(wahlVon('/os', '', 'alles')).toBe('alles');
    expect(wahlVon('/os', '?space=privat', 'alles')).toBe('privat');
    expect(wahlVon('/os/aufgaben', '?space=alles', 'business')).toBe('alles');
    // Seiten nur eines Bereichs: bei „Alles“ springt der Schalter nicht um …
    expect(wahlVon('/os/gesundheit', '', 'alles')).toBe('alles');
    expect(wahlVon('/os/markttraktion', '?s=deals', 'alles')).toBe('alles');
    // … bei gemerktem Space wie bisher (die Seite legt ihn fest).
    expect(wahlVon('/os/markttraktion', '?s=deals', 'privat')).toBe('business');
    expect(wahlVon('/os/inbox', '', 'business')).toBe('business');
    // Alte Links bleiben gültig.
    expect(spaceVonAdresse('/os/aufgaben', '?space=alles')).toBeNull();
    expect(wahlInfo('alles')).toMatchObject({ label: 'Alles', start: '/os' });
  });
  it('Leiste bei „Alles“: gemeinsame Punkte ohne Space-Parameter, darunter Privat- und Business-Gruppe — höchstens zwölf', () => {
    const l = leisteFuer('alles');
    expect(l.length).toBeLessThanOrEqual(12);
    expect(new Set(l.map(e => e.href)).size).toBe(l.length);
    expect(ALLES_EINTRAEGE.map(e => e.label)).toEqual(['Heute', 'Inbox', 'Kalender', 'Aufgaben', 'Planung', 'Finanzen', 'Kontakte', 'ZOE']);
    expect(ALLES_EINTRAEGE.at(-1)).toBe(ZOE_EINTRAG);
    for (const e of ALLES_EINTRAEGE) expect(e.href, e.label).not.toContain('space=');
    expect(ALLES_GRUPPEN.map(g => [g.label, g.eintraege.map(e => e.label)])).toEqual([['Privat', ['Gesundheit', 'Familie']], ['Business', ['Markttraktion', 'Mandate & Unternehmen']]]);
    expect(aktiverLeistenPunkt('alles', '/os', '')?.label).toBe('Heute');
    expect(aktiverLeistenPunkt('alles', '/os/gesundheit', '?s=sport')?.label).toBe('Gesundheit');
    expect(aktiverLeistenPunkt('alles', '/os/finanzen', '?s=privat')?.label).toBe('Finanzen');
    expect(aktiverLeistenPunkt('alles', '/os/menschen', '')?.label).toBe('Kontakte');
    expect(aktiverLeistenPunkt('alles', '/os/unternehmen', '')?.label).toBe('Mandate & Unternehmen');
  });
  it('Schalter mit „Alles“: Gegenstück ohne Parameter, Seiten eines Bereichs bleiben stehen, Rückweg in einen Space', () => {
    expect(wechselZiel('/os/aufgaben', '?space=privat', 'alles')).toBe('/os/aufgaben');
    expect(wechselZiel('/os', '?space=business', 'alles')).toBe('/os');
    expect(wechselZiel('/os', '', 'alles')).toBeNull();
    expect(wechselZiel('/os/gesundheit', '?s=sport', 'alles')).toBeNull();
    expect(wechselZiel('/os/markttraktion', '?s=deals', 'alles')).toBeNull();
    expect(wechselZiel('/os/markttraktion', '?s=kontakte&a=akte&k=c-1', 'alles')).toBeNull();
    expect(wechselZiel('/os/konto', '', 'alles')).toBeNull();
    expect(wechselZiel('/os/aufgaben', '', 'business')).toBe('/os/aufgaben?space=business');
    expect(wechselZiel('/os/gesundheit', '', 'privat')).toBeNull();
    expect(wechselZiel('/os/gesundheit', '', 'business')).toBe('/os?space=business');
    expect(wechselZiel('/os/finanzen', '?s=gesamt', 'privat')).toBe('/os/finanzen?s=privat');
  });
});
