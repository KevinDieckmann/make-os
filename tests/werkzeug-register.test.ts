// ─── Die Risiko-Stufen sind das Sicherheitsnetz ─────────────────────────────
// Kevins Festlegung vom 06.09.: Geld, Ziele, Kompass und alles Ausgehende
// gehen nie ohne ihn. Diese Regel steht bewusst im Register und nicht im
// Prompt — ein Prompt lässt sich überreden, eine Tabelle nicht.
//
// Der wichtigste Test ist der erste: ein neues Werkzeug ohne Eintrag im
// Register würde sonst mit der Standardstufe laufen. Der Standard ist zwar
// fail-closed (freigabe), aber unbemerkt bleiben soll es trotzdem nicht.

import { describe, it, expect } from 'vitest';
import { WERKZEUGE } from '../lib/jarvis/werkzeuge';
import { REGISTER, risikoVon, fehlendeStufen } from '../lib/jarvis/register';

describe('Werkzeug-Register', () => {
  it('kennt jedes Werkzeug, das es gibt', () => {
    expect(fehlendeStufen(), 'ohne Risiko-Stufe').toEqual([]);
  });

  it('stuft alles mit Geld, Zielen und Kompass als freigabepflichtig ein', () => {
    for (const name of [
      'setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten',
      'setze_ziele', 'setze_meilenstein', 'setze_fokus',
    ]) {
      expect(risikoVon(name), name).toBe('freigabe');
    }
  });

  it('lässt Aufgaben, Postfach, eigenen Kalender und CRM durchlaufen', () => {
    for (const name of ['plan_block', 'lies_postfach', 'setze_vitalwerte', 'setze_kunde']) {
      expect(risikoVon(name), name).toBe('frei');
    }
  });

  it('behandelt ein unbekanntes Werkzeug als freigabepflichtig, nicht als frei', () => {
    expect(risikoVon('gibt_es_nicht')).toBe('freigabe');
  });

  it('hat für jedes Werkzeug auch eine Implementierung', () => {
    for (const name of Object.keys(REGISTER)) {
      expect(WERKZEUGE[name], `${name} steht im Register, hat aber keine Wirkung`).toBeTruthy();
    }
  });
});

describe('Haushaltsfinanzen-Werkzeuge (24.09.)', () => {
  it('Ändern braucht die Freigabe, Lesen läuft durch', () => {
    for (const n of ['haushalt_zuordnen', 'haushalt_rechnung_bezahlt', 'haushalt_rechnung_erfassen']) expect(risikoVon(n), n).toBe('freigabe');
    for (const n of ['haushalt_stand', 'haushalt_buchungen']) expect(risikoVon(n), n).toBe('frei');
  });
  it('ohne benannte Person (Hintergrund, Rücknahme) verweigern alle — private Finanzen nie im Auftrag von niemandem', async () => {
    for (const n of ['haushalt_stand', 'haushalt_buchungen', 'haushalt_zuordnen', 'haushalt_rechnung_bezahlt', 'haushalt_rechnung_erfassen']) {
      expect(await WERKZEUGE[n].lauf({}, 'http://localhost', undefined), n).toMatch(/^Nicht verfügbar/);
    }
  });
});
