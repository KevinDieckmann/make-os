import { describe, it, expect } from 'vitest';
import { LEER_ZEIT, fokusVerbuchen, blockZuordnen, blockUmbuchen, bild, type ZeitDatei, type FokusBlock } from '../lib/zeitmessung/modell';
import {
  zuordnungSaeubern, einheitVonBlock, aufgabeKurz, zeitraumVon, kalenderwoche, berlinTag, bloeckeImZeitraum, auswerten, zeitJeEinheit,
  TOP_AUFGABEN, type AufgabeKurz,
} from '../lib/zeitmessung/einheiten';
import { EINHEIT_OHNE } from '../lib/aufgaben/einheit';

// Alles erfunden: Aufgaben, Personen, Zeiten.
const A = (id: string, x: Partial<AufgabeKurz> = {}): AufgabeKurz => ({ id, titel: `Aufgabe ${id}`, business: true, offen: true, ...x });
const karte = (...l: AufgabeKurz[]) => new Map(l.map(a => [a.id, a]));
/** Ein Block, dessen Anfang als UTC-Zeitpunkt angegeben ist. */
const B = (vonUtc: string, min: number, x: Partial<FokusBlock> = {}): FokusBlock =>
  ({ von: new Date(vonUtc).toISOString(), bis: new Date(Date.parse(vonUtc) + min * 60_000).toISOString(), schluessel: 'business:aufgaben', label: 'Aufgaben', sek: min * 60, ...x });
/** Blöcke in eine Datei legen — unter ihrem UTC-Tag (die Auswertung darf sich auf den Tages-Schlüssel nicht verlassen). */
const datei = (...b: FokusBlock[]): ZeitDatei => {
  const tage: ZeitDatei['tage'] = {};
  for (const x of b) { const t = x.von.slice(0, 10); (tage[t] ??= { auto: {}, bewusst: {}, bloecke: [] }).bloecke.push(x); }
  return { tage };
};

describe('Zeit je Einheit — Säuberung der Zuordnung', () => {
  it('Privat und Gemeinsam verwerfen Aufgabe und Einheit', () => {
    expect(zuordnungSaeubern('privat:gesundheit', { aufgabeId: 'a1', einheit: 'KD Ventures' }, A('a1', { einheit: 'KD Ventures' }))).toEqual({});
    expect(zuordnungSaeubern('gemeinsam:home', { einheit: 'KD Ventures' })).toEqual({});
  });

  it('die Einheit der Aufgabe gewinnt vor der direkt gewählten', () => {
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1', einheit: 'Selbstständigkeit' }, A('a1', { einheit: 'MAKE OS UG' })))
      .toEqual({ aufgabeId: 'a1', einheit: 'MAKE OS UG' });
  });

  it('Aufgabe ohne Einheit: die direkte Wahl bleibt, Namen werden vereinheitlicht', () => {
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1', einheit: 'Neue UG' }, A('a1'))).toEqual({ aufgabeId: 'a1', einheit: 'MAKE OS UG' });
    expect(zuordnungSaeubern('business:aufgaben', { einheit: '  kdv ' })).toEqual({ einheit: 'KD Ventures' });
    expect(zuordnungSaeubern('business:aufgaben', { einheit: 'Kunde Nord' })).toEqual({ einheit: 'Kunde Nord' });
  });

  it('unbekannte, private oder falsche Aufgaben fallen weg; Unbrauchbares wird nicht gespeichert', () => {
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1' }, null)).toEqual({});
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1' }, A('a2'))).toEqual({});
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1', einheit: 'KD Ventures' }, A('a1', { business: false }))).toEqual({ einheit: 'KD Ventures' });
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'x'.repeat(81) }, A('x'.repeat(81)))).toEqual({});
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 42, einheit: 'x' })).toEqual({});
  });

  it('aufgabeKurz nimmt Space und Einheit nach den Aufgaben-Regeln (Privat trägt keine Einheit)', () => {
    const t = { id: 't1', title: 'Angebot', projectId: 'p', space: 'business' as const, einheit: 'kdc', status: 'todo' };
    expect(aufgabeKurz(t)).toEqual({ id: 't1', titel: 'Angebot', einheit: 'Selbstständigkeit', business: true, offen: true });
    expect(aufgabeKurz({ ...t, space: 'privat', status: 'done' })).toMatchObject({ einheit: undefined, business: false, offen: false });
  });
});

describe('Zeit je Einheit — Modell: verbuchen und nachträglich zuordnen', () => {
  const von = '2026-09-24T08:00:00.000Z', bis = '2026-09-24T09:00:00.000Z';

  it('fokusVerbuchen trägt die Zuordnung mit, ohne leere Felder', () => {
    const d = fokusVerbuchen(LEER_ZEIT, { von, bis, schluessel: 'business:aufgaben', label: 'Aufgaben', aufgabeId: 'a1', einheit: 'KD Ventures' });
    const b = Object.values(d.tage)[0].bloecke[0];
    expect(b).toMatchObject({ aufgabeId: 'a1', einheit: 'KD Ventures', sek: 3600 });
    const ohne = Object.values(fokusVerbuchen(LEER_ZEIT, { von, bis, schluessel: 'business:aufgaben', label: 'Aufgaben' }).tage)[0].bloecke[0];
    expect('aufgabeId' in ohne || 'einheit' in ohne).toBe(false);
  });

  it('blockZuordnen ersetzt die Zuordnung, lässt Sekunden und Summen stehen und entfernt sie mit leerer Wahl', () => {
    const d = fokusVerbuchen(LEER_ZEIT, { von, bis, schluessel: 'business:aufgaben', label: 'Aufgaben' });
    const r = blockZuordnen(d, von, { aufgabeId: 'a1', einheit: 'MAKE OS UG' });
    expect(r.gefunden).toBe(true);
    const tag = Object.keys(r.datei.tage)[0];
    expect(r.datei.tage[tag].bloecke[0]).toMatchObject({ aufgabeId: 'a1', einheit: 'MAKE OS UG', sek: 3600 });
    expect(r.datei.tage[tag].bewusst).toEqual(d.tage[tag].bewusst);
    const leer = blockZuordnen(r.datei, von, {});
    expect(leer.datei.tage[tag].bloecke[0]).not.toHaveProperty('aufgabeId');
    expect(leer.datei.tage[tag].bloecke[0]).not.toHaveProperty('einheit');
    expect(blockZuordnen(d, '2026-01-01T00:00:00.000Z', { einheit: 'KD Ventures' })).toEqual({ datei: d, gefunden: false });
    // Das Bild reicht die Zuordnung an die Oberfläche weiter.
    expect(bild(r.datei, tag).bloecke[0].aufgabeId).toBe('a1');
  });

  it('Altbestand ohne Zuordnung bleibt gültig', () => {
    const alt: ZeitDatei = datei(B('2026-09-24T08:00:00Z', 30));
    expect(auswerten(bloeckeImZeitraum(alt, '2026-09-21', '2026-09-27'), new Map()).zeilen.find(z => z.id === EINHEIT_OHNE)?.sek).toBe(1800);
  });
});

describe('Zeit je Einheit — Ableitung aus der Aufgabe', () => {
  it('die Einheit kommt live aus der Aufgabe, sonst aus dem Block', () => {
    expect(einheitVonBlock({ aufgabeId: 'a1', einheit: 'KD Ventures' }, karte(A('a1', { einheit: 'Selbstständigkeit' })))).toBe('Selbstständigkeit');
    expect(einheitVonBlock({ aufgabeId: 'a1', einheit: 'KD Ventures' }, karte(A('a1')))).toBe('KD Ventures');
    expect(einheitVonBlock({ aufgabeId: 'weg', einheit: 'ug' }, karte())).toBe('MAKE OS UG');
    expect(einheitVonBlock({}, karte())).toBeUndefined();
  });
});

describe('Zeit je Einheit — Zeitraum (Berlin)', () => {
  it('Woche Mo–So, Monat mit richtigem Ende, Kalenderwoche', () => {
    expect(zeitraumVon('woche', '2026-09-27')).toEqual({ von: '2026-09-21', bis: '2026-09-27', label: 'KW 39' });
    expect(zeitraumVon('woche', '2026-09-21').von).toBe('2026-09-21');
    expect(zeitraumVon('monat', '2026-09-27')).toEqual({ von: '2026-09-01', bis: '2026-09-30', label: 'September 2026' });
    expect(zeitraumVon('monat', '2028-02-10').bis).toBe('2028-02-29');
    expect(zeitraumVon('monat', '2026-12-05').bis).toBe('2026-12-31');
    expect(kalenderwoche('2026-01-01')).toBe(1);
    expect(kalenderwoche('2027-01-01')).toBe(53);
    expect(kalenderwoche('2025-12-29')).toBe(1);
  });

  it('der Tag eines Blocks ist der Berliner Tag — Sommer- und Winterzeit', () => {
    expect(berlinTag('2026-09-27T22:30:00Z')).toBe('2026-09-28'); // Mo 00:30 MESZ
    expect(berlinTag('2026-09-27T21:30:00Z')).toBe('2026-09-27'); // So 23:30 MESZ
    expect(berlinTag('2026-11-30T23:30:00Z')).toBe('2026-12-01'); // 00:30 MEZ
  });
});

describe('Zeit je Einheit — Auswertung', () => {
  const aufgaben = [A('a1', { einheit: 'KD Ventures' }), A('a2', { einheit: 'Selbstständigkeit' }), A('a3'), A('a4', { einheit: 'KD Ventures' }), A('a5', { einheit: 'KD Ventures' }), A('a6', { einheit: 'KD Ventures' })];

  it('Wochengrenzen nach Berliner Zeit: So 23:30 gehört zur alten, Mo 00:30 zur neuen Woche', () => {
    const d = datei(
      B('2026-09-27T21:30:00Z', 60, { aufgabeId: 'a1' }), // So 27.09. 23:30 Berlin → KW 39
      B('2026-09-27T22:30:00Z', 30, { aufgabeId: 'a1' }), // Mo 28.09. 00:30 Berlin → KW 40
      B('2026-09-20T21:59:00Z', 45, { aufgabeId: 'a1' }), // So 20.09. 23:59 Berlin → KW 38
    );
    const kw39 = zeitJeEinheit([{ person: 'p1', name: 'Eins', datei: d }], aufgaben, 'woche', '2026-09-24');
    expect(kw39.gesamt.sek).toBe(3600);
    const kw40 = zeitJeEinheit([{ person: 'p1', name: 'Eins', datei: d }], aufgaben, 'woche', '2026-09-28');
    expect(kw40.gesamt.sek).toBe(1800);
  });

  it('Monatsgrenze nach Berliner Zeit', () => {
    const d = datei(
      B('2026-09-30T21:30:00Z', 60, { einheit: 'MAKE OS UG' }), // 30.09. 23:30 Berlin → September
      B('2026-09-30T22:30:00Z', 30, { einheit: 'MAKE OS UG' }), // 01.10. 00:30 Berlin → Oktober
    );
    expect(zeitJeEinheit([{ person: 'p', name: 'P', datei: d }], [], 'monat', '2026-09-15').gesamt.sek).toBe(3600);
    expect(zeitJeEinheit([{ person: 'p', name: 'P', datei: d }], [], 'monat', '2026-10-15').gesamt.sek).toBe(1800);
  });

  it('Kerneinheiten immer, eigene nur mit Zeit, „ohne Einheit“ zuletzt; Privat zählt nicht', () => {
    const b = [
      B('2026-09-22T08:00:00Z', 60, { aufgabeId: 'a1' }),
      B('2026-09-22T10:00:00Z', 30, { einheit: 'Kunde Nord' }),
      B('2026-09-22T11:00:00Z', 15),
      B('2026-09-22T12:00:00Z', 20, { aufgabeId: 'a3' }),
      B('2026-09-22T13:00:00Z', 99, { schluessel: 'privat:gesundheit', einheit: 'KD Ventures' }),
    ];
    const a = auswerten(bloeckeImZeitraum(datei(...b), '2026-09-21', '2026-09-27'), karte(...aufgaben));
    expect(a.zeilen.map(z => [z.label, z.art, z.sek / 60])).toEqual([
      ['Selbstständigkeit', 'kern', 0], ['KD Ventures', 'kern', 60], ['MAKE OS UG', 'kern', 0], ['Kunde Nord', 'eigen', 30], ['ohne Einheit', 'ohne', 35],
    ]);
    expect(a.sek).toBe(125 * 60);
    expect(a.bloecke).toBe(4);
    const ohne = a.zeilen.at(-1)!;
    expect(ohne.id).toBe(EINHEIT_OHNE);
    expect(ohne.aufgaben).toEqual([{ id: 'a3', titel: 'Aufgabe a3', sek: 1200 }]);
    expect(ohne.ohneAufgabeSek).toBe(900);
  });

  it('Top-Aufgaben je Einheit: nach Zeit, höchstens TOP_AUFGABEN, gelöschte Aufgaben mit Platzhalter', () => {
    const b = [
      B('2026-09-22T08:00:00Z', 10, { aufgabeId: 'a1' }), B('2026-09-22T09:00:00Z', 50, { aufgabeId: 'a4' }),
      B('2026-09-22T10:00:00Z', 30, { aufgabeId: 'a5' }), B('2026-09-22T11:00:00Z', 5, { aufgabeId: 'a6' }),
      B('2026-09-22T12:00:00Z', 25, { aufgabeId: 'a1' }), B('2026-09-22T13:00:00Z', 40, { aufgabeId: 'weg', einheit: 'KD Ventures' }),
    ];
    const kdv = auswerten(b, karte(...aufgaben)).zeilen.find(z => z.label === 'KD Ventures')!;
    expect(kdv.sek).toBe(160 * 60);
    expect(kdv.aufgaben).toHaveLength(TOP_AUFGABEN);
    expect(kdv.aufgaben.map(t => [t.titel, t.sek / 60])).toEqual([['Aufgabe a4', 50], ['Aufgabe (gelöscht)', 40], ['Aufgabe a1', 35]]);
  });

  it('je Person und gesamt; ohne Blöcke alles null', () => {
    const p1 = datei(B('2026-09-22T08:00:00Z', 60, { aufgabeId: 'a2' }));
    const p2 = datei(B('2026-09-23T08:00:00Z', 30, { aufgabeId: 'a2' }), B('2026-09-23T09:00:00Z', 30, { einheit: 'MAKE OS UG' }));
    const r = zeitJeEinheit([{ person: 'p1', name: 'Eins', datei: p1 }, { person: 'p2', name: 'Zwei', datei: p2 }, { person: 'p3', name: 'Drei', datei: LEER_ZEIT }], aufgaben, 'woche', '2026-09-27');
    const s = (a: typeof r.gesamt, l: string) => a.zeilen.find(z => z.label === l)!.sek / 60;
    expect(r.personen.map(p => p.person)).toEqual(['p1', 'p2', 'p3']);
    expect(s(r.personen[0].auswertung, 'Selbstständigkeit')).toBe(60);
    expect(s(r.personen[1].auswertung, 'Selbstständigkeit')).toBe(30);
    expect(s(r.personen[1].auswertung, 'MAKE OS UG')).toBe(30);
    expect(s(r.gesamt, 'Selbstständigkeit')).toBe(90);
    expect(r.gesamt.sek).toBe(120 * 60);
    expect(r.personen[2].auswertung.sek).toBe(0);
    expect(r.personen[2].auswertung.zeilen.every(z => z.sek === 0)).toBe(true);
    expect(r).toMatchObject({ zeitraum: 'woche', von: '2026-09-21', bis: '2026-09-27', label: 'KW 39' });
  });
});

describe('Zeit je Einheit — Umbuchen Privat ↔ Business', () => {
  const von = '2026-09-24T08:00:00.000Z', bis = '2026-09-24T08:30:00.000Z';
  const privat = fokusVerbuchen(LEER_ZEIT, { von, bis, schluessel: 'privat:gesundheit', label: 'Gesundheit' });
  const tag = Object.keys(privat.tage)[0];

  it('ins Business: Schlüssel wechselt, bewusste Sekunden wandern mit, danach zuordenbar und gezählt', () => {
    const r = blockUmbuchen(privat, von, 'business');
    expect(r.gefunden).toBe(true);
    const t = r.datei.tage[tag];
    expect(t.bloecke[0].schluessel).toBe('business:gesundheit');
    expect(t.bewusst).toEqual({ 'business:gesundheit': 1800 });
    const z = blockZuordnen(r.datei, von, { einheit: 'KD Ventures' }).datei;
    const a = auswerten(bloeckeImZeitraum(z, '2026-09-21', '2026-09-27'), new Map());
    expect(a.zeilen.find(x => x.label === 'KD Ventures')?.sek).toBe(1800);
    expect(bild(z, tag).tagHeute.bewusst).toMatchObject({ business: 1800, privat: 0 });
  });

  it('zurück nach Privat verwirft Aufgabe und Einheit und zählt nicht mehr im Business', () => {
    const b = blockZuordnen(blockUmbuchen(privat, von, 'business').datei, von, { aufgabeId: 'a1', einheit: 'MAKE OS UG' }).datei;
    const r = blockUmbuchen(b, von, 'privat');
    const x = r.datei.tage[tag].bloecke[0];
    expect(x.schluessel).toBe('privat:gesundheit');
    expect(x).not.toHaveProperty('aufgabeId');
    expect(x).not.toHaveProperty('einheit');
    expect(r.datei.tage[tag].bewusst).toEqual({ 'privat:gesundheit': 1800 });
    expect(bloeckeImZeitraum(r.datei, '2026-09-21', '2026-09-27')).toHaveLength(0);
  });

  it('andere Blöcke desselben Bereichs behalten ihre Zeit; gleicher Space und fremde Blöcke ändern nichts', () => {
    const zwei = fokusVerbuchen(privat, { von: '2026-09-24T09:00:00.000Z', bis: '2026-09-24T09:10:00.000Z', schluessel: 'privat:gesundheit', label: 'Gesundheit' });
    const r = blockUmbuchen(zwei, von, 'business');
    expect(r.datei.tage[tag].bewusst).toEqual({ 'privat:gesundheit': 600, 'business:gesundheit': 1800 });
    expect(blockUmbuchen(privat, von, 'privat')).toEqual({ datei: privat, gefunden: true });
    expect(blockUmbuchen(privat, '2026-01-01T00:00:00.000Z', 'business')).toEqual({ datei: privat, gefunden: false });
  });

  it('Privat-Blöcke einer anderen Person zählen nie — auch nicht im Haushalt gesamt', () => {
    const p2 = datei(B('2026-09-22T08:00:00Z', 90, { schluessel: 'privat:gesundheit' }), B('2026-09-22T10:00:00Z', 30, { einheit: 'KD Ventures' }));
    const r = zeitJeEinheit([{ person: 'p1', name: 'Eins', datei: LEER_ZEIT }, { person: 'p2', name: 'Zwei', datei: p2 }], [], 'woche', '2026-09-27');
    expect(r.gesamt.sek).toBe(1800);
    expect(r.personen[1].auswertung.sek).toBe(1800);
    expect(JSON.stringify(r)).not.toContain('gesundheit');
  });
});
