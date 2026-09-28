// ─── Mandat an Zielen und Zeit (28.09.): Ableitung, Säuberung, Zeit je Mandat, Verbindungsprüfung ─
// Alles erfunden: Firmen, Mandate, Zeiten.
import { describe, it, expect } from 'vitest';
import { bezugSaeubern, sauberKennung, mandatKurzListe, mitMandatBezug, mandatWahlListe, hatMandatKennung, honorarMonatNetto, type CrmFuerMandat, type MandatKurz } from '../lib/planung/mandat';
import { sauberZiel } from '../lib/planung/ziele';
import { sauberMeilenstein } from '../lib/planung/meilensteine';
import { abgeleitetesZiel, meilensteineAbleiten } from '../lib/planung/kaskade';
import { zuordnungSaeubern, einheitVonBlock, type AufgabeKurz } from '../lib/zeitmessung/einheiten';
import { blockZuordnen, blockUmbuchen, fokusVerbuchen, LEER_ZEIT, type FokusBlock, type ZeitDatei } from '../lib/zeitmessung/modell';
import { zeitJeMandat, mandateAuswerten, honorarImZeitraum, MANDAT_OHNE, SATZ_AB_SEK } from '../lib/zeitmessung/mandate';
import { planungPruefen, planungReparieren, bezugBereinigen, zieleDateiBereinigen, meilensteinDateiBereinigen, zeitDateiBereinigen, type PlanungBestand } from '../lib/crm/verbindungen-planung';

const CRM: CrmFuerMandat = {
  firmen: [{ id: 'f-nord', name: 'Nord GmbH' }, { id: 'f-sued', name: 'Süd AG' }],
  chancen: [{ id: 'd-1', gesellschaft: 'kdv' }],
  leistungen: [{ id: 'l-1', gesellschaft: 'kdc' }],
  mandate: [
    { id: 'm-ug', titel: 'Retainer', firmaId: 'f-nord', kunde: 'Alter Name', status: 'aktiv', gesellschaft: 'ug', honorar: { betrag: 3000, basis: 'monat', netto: true }, ustSatz: 19 },
    { id: 'm-deal', titel: 'Sprint', firmaId: 'f-sued', status: 'aktiv', gesellschaft: 'offen', chanceId: 'd-1', honorar: { betrag: 1190, basis: 'monat', netto: false }, ustSatz: 19 },
    { id: 'm-alt', titel: 'Workshop', kunde: 'Ohne Firma KG', status: 'beendet', gesellschaft: 'offen', leistungId: 'l-1', honorar: { betrag: 900, basis: 'tag', netto: true } },
  ],
};
const MANDATE = mandatKurzListe(CRM);
const KARTE = new Map(MANDATE.map(m => [m.id, m]));

describe('Mandat — Säuberung (nur Form, nur Business)', () => {
  it('Kennungen: CRM-Form, getrimmt; alles andere fällt weg', () => {
    expect(sauberKennung(' m-ug ')).toBe('m-ug');
    expect(sauberKennung('M-UG')).toBeUndefined();
    expect(sauberKennung('m')).toBeUndefined();
    expect(sauberKennung('x'.repeat(65))).toBeUndefined();
    expect(sauberKennung(42)).toBeUndefined();
    expect(bezugSaeubern({ mandatId: 'm-ug', firmaId: 'f nord' }, true)).toEqual({ mandatId: 'm-ug' });
    expect(bezugSaeubern({ mandatId: 'm-ug', firmaId: 'f-nord' }, false)).toEqual({});
    expect(bezugSaeubern(null, true)).toEqual({});
  });

  it('Ziel: Bezug nur im Business — gemeinsam und privat verlieren ihn', () => {
    expect(sauberZiel({ titel: 'Umsatz', space: 'business', mandatId: 'm-ug', firmaId: 'f-nord' })).toMatchObject({ mandatId: 'm-ug', firmaId: 'f-nord' });
    expect(sauberZiel({ titel: 'Umsatz', mandatId: 'm-ug' })).not.toHaveProperty('mandatId');
    expect(sauberZiel({ titel: 'Laufen', space: 'privat', mandatId: 'm-ug' })).not.toHaveProperty('mandatId');
    expect(sauberZiel({ titel: 'Umsatz', space: 'business', mandatId: '<script>' })).not.toHaveProperty('mandatId');
  });

  it('Meilenstein: Bezug nur im Business (auch aus dem Altfeld bereich)', () => {
    expect(sauberMeilenstein({ titel: 'Go-live', bereich: 'business', mandatId: 'm-ug' })).toMatchObject({ space: 'business', mandatId: 'm-ug' });
    expect(sauberMeilenstein({ titel: 'Arzt', space: 'privat', mandatId: 'm-ug', firmaId: 'f-nord' })).not.toHaveProperty('mandatId');
    expect(sauberMeilenstein({ titel: 'Arzt', space: 'privat', firmaId: 'f-nord' })).not.toHaveProperty('firmaId');
  });

  it('hatMandatKennung findet eine Kennung auch in Ops (dann lohnt das Laden des CRM)', () => {
    expect(hatMandatKennung([{ op: 'upsert', eintrag: { titel: 'x', mandatId: 'm-ug' } }])).toBe(true);
    expect(hatMandatKennung([{ op: 'upsert', eintrag: { titel: 'x' } }, { op: 'delete', id: 'z-1' }])).toBe(false);
    expect(hatMandatKennung({ aktion: 'fokus', mandatId: '' })).toBe(false);
  });
});

describe('Mandat — Kurzform und Ableitung der Einheit', () => {
  it('Einheit aus der Gesellschaft: Mandat, sonst Deal, sonst Produkt; Firma aus dem CRM, sonst Kunde', () => {
    expect(KARTE.get('m-ug')).toMatchObject({ firma: 'Nord GmbH', firmaId: 'f-nord', einheit: 'MAKE OS UG', aktiv: true, honorarMonat: 3000 });
    expect(KARTE.get('m-deal')).toMatchObject({ firma: 'Süd AG', einheit: 'KD Ventures', honorarMonat: 1000 });
    expect(KARTE.get('m-alt')).toMatchObject({ firma: 'Ohne Firma KG', einheit: 'Selbstständigkeit', aktiv: false });
    expect(KARTE.get('m-alt')).not.toHaveProperty('honorarMonat');
    // aktive zuerst
    expect(MANDATE.map(m => m.id)).toEqual(['m-ug', 'm-deal', 'm-alt']);
  });

  it('Honorar netto: brutto über den USt-Satz zurück, andere Basis oder 0 € → keins', () => {
    expect(honorarMonatNetto({ betrag: 1190, basis: 'monat', netto: false }, 19)).toBe(1000);
    expect(honorarMonatNetto({ betrag: 500, basis: 'monat', netto: false }, 0)).toBe(500);
    expect(honorarMonatNetto({ betrag: 0, basis: 'monat', netto: true })).toBeUndefined();
    expect(honorarMonatNetto({ betrag: 900, basis: 'tag', netto: true })).toBeUndefined();
  });

  it('mitMandatBezug: Firma und Einheit aus dem Mandat — das Mandat gewinnt vor einer gesetzten Einheit', () => {
    expect(mitMandatBezug({ mandatId: 'm-ug', einheit: 'KD Ventures' }, KARTE, true)).toEqual({ mandatId: 'm-ug', firmaId: 'f-nord', einheit: 'MAKE OS UG' });
    expect(mitMandatBezug({ mandatId: 'm-ug' }, MANDATE, true)).toEqual({ mandatId: 'm-ug', firmaId: 'f-nord', einheit: 'MAKE OS UG' });
  });

  it('mitMandatBezug: unbekanntes Mandat oder keine Mandate → unverändert; nicht Business → Bezug fällt weg', () => {
    const e = { mandatId: 'm-weg', firmaId: 'f-nord', einheit: 'Kunden' };
    expect(mitMandatBezug(e, KARTE, true)).toBe(e);
    expect(mitMandatBezug(e, null, true)).toBe(e);
    expect(mitMandatBezug({ ...e, titel: 'x' }, KARTE, false)).toEqual({ einheit: 'Kunden', titel: 'x' });
    // Mandat ohne Firma und ohne Einheit: die gesetzten Werte bleiben
    const ohne: MandatKurz = { id: 'm-leer', titel: 'x', firma: 'y', status: 'aktiv', aktiv: true };
    expect(mitMandatBezug({ mandatId: 'm-leer', firmaId: 'f-sued', einheit: 'Kunden' }, [ohne], true)).toEqual({ mandatId: 'm-leer', firmaId: 'f-sued', einheit: 'Kunden' });
  });

  it('Mandat-Chip: aktive Mandate „Firma · Titel“, das gewählte bleibt, ein gelöschtes steht als solches', () => {
    expect(mandatWahlListe(MANDATE).map(e => e.label)).toEqual(['Nord GmbH · Retainer', 'Süd AG · Sprint']);
    expect(mandatWahlListe(MANDATE, 'm-alt').map(e => e.id)).toEqual(['m-ug', 'm-deal', 'm-alt']);
    expect(mandatWahlListe(MANDATE, 'm-alt').at(-1)?.hinweis).toContain('nicht aktiv');
    expect(mandatWahlListe(MANDATE, 'm-weg').at(-1)).toEqual({ id: 'm-weg', label: 'Mandat (gelöscht)' });
    expect(mandatWahlListe(MANDATE)[0]).toMatchObject({ hinweis: 'MAKE OS UG' });
  });

  it('Kaskade: abgeleitete Ziele und Termin-Meilensteine tragen das Mandat des Jahresziels', () => {
    const jahr = { id: 'z-j', titel: 'Neukunden', fortschritt: 0, space: 'business' as const, einheit: 'MAKE OS UG', mandatId: 'm-ug', firmaId: 'f-nord', zielwert: 12, termin: '2026-12-01' };
    expect(abgeleitetesZiel(jahr, 'quartal', 2026)).toMatchObject({ mandatId: 'm-ug', firmaId: 'f-nord', einheit: 'MAKE OS UG' });
    expect(meilensteineAbleiten([jahr], [])[0]).toMatchObject({ mandatId: 'm-ug', firmaId: 'f-nord', space: 'business' });
    expect(abgeleitetesZiel({ ...jahr, mandatId: undefined, firmaId: undefined }, 'monat', 2026)).not.toHaveProperty('mandatId');
  });
});

describe('Zeit — Zuordnung mit Mandat', () => {
  const A = (id: string, x: Partial<AufgabeKurz> = {}): AufgabeKurz => ({ id, titel: id, business: true, offen: true, ...x });

  it('Mandat gewinnt vor der Einheit der Aufgabe; Firma kommt aus dem Mandat', () => {
    expect(zuordnungSaeubern('business:aufgaben', { aufgabeId: 'a1', mandatId: 'm-ug' }, A('a1', { einheit: 'KD Ventures' }), KARTE))
      .toEqual({ aufgabeId: 'a1', einheit: 'MAKE OS UG', mandatId: 'm-ug', firmaId: 'f-nord' });
    expect(zuordnungSaeubern('business:aufgaben', { mandatId: 'm-deal', einheit: 'Selbstständigkeit' }, undefined, KARTE))
      .toEqual({ einheit: 'KD Ventures', mandatId: 'm-deal', firmaId: 'f-sued' });
  });

  it('ohne geladene Mandate bleibt die Kennung (Form geprüft); Privat verwirft alles; Unförmiges fällt weg', () => {
    expect(zuordnungSaeubern('business:aufgaben', { mandatId: 'm-weg', einheit: 'kdv' })).toEqual({ einheit: 'KD Ventures', mandatId: 'm-weg' });
    expect(zuordnungSaeubern('privat:gesundheit', { mandatId: 'm-ug' }, undefined, KARTE)).toEqual({});
    expect(zuordnungSaeubern('business:aufgaben', { mandatId: 'M UG', firmaId: 42 }, undefined, KARTE)).toEqual({});
  });

  it('Einheit eines Blocks: mit Mandat die gespeicherte (aus dem Mandat), sonst live die der Aufgabe', () => {
    const aufgaben = new Map([['a1', A('a1', { einheit: 'KD Ventures' })]]);
    expect(einheitVonBlock({ aufgabeId: 'a1', einheit: 'MAKE OS UG', mandatId: 'm-ug' }, aufgaben)).toBe('MAKE OS UG');
    expect(einheitVonBlock({ aufgabeId: 'a1', einheit: 'MAKE OS UG' }, aufgaben)).toBe('KD Ventures');
  });

  it('Nachträglich zuordnen ersetzt auch das Mandat; nach Privat umbuchen nimmt es mit weg', () => {
    const d = fokusVerbuchen(LEER_ZEIT, { von: '2026-09-28T08:00:00.000Z', bis: '2026-09-28T09:00:00.000Z', schluessel: 'business:aufgaben', label: 'x', mandatId: 'm-ug', firmaId: 'f-nord', einheit: 'MAKE OS UG' });
    const b = Object.values(d.tage)[0].bloecke[0];
    expect(b).toMatchObject({ mandatId: 'm-ug', firmaId: 'f-nord', sek: 3600 });
    const neu = blockZuordnen(d, b.von, { einheit: 'Kunden' }).datei;
    expect(Object.values(neu.tage)[0].bloecke[0]).toEqual({ von: b.von, bis: b.bis, schluessel: 'business:aufgaben', label: 'x', sek: 3600, einheit: 'Kunden' });
    const privat = blockUmbuchen(d, b.von, 'privat').datei;
    const p = Object.values(privat.tage)[0].bloecke[0];
    expect(p).not.toHaveProperty('mandatId');
    expect(p).not.toHaveProperty('firmaId');
    expect(p.schluessel).toBe('privat:aufgaben');
  });
});

describe('Zeit je Mandat — Summen, Berliner Woche und Monat, grober Satz', () => {
  /** Block, Anfang als UTC-Zeitpunkt. */
  const B = (vonUtc: string, min: number, x: Partial<FokusBlock> = {}): FokusBlock =>
    ({ von: new Date(vonUtc).toISOString(), bis: new Date(Date.parse(vonUtc) + min * 60_000).toISOString(), schluessel: 'business:aufgaben', label: 'x', sek: min * 60, ...x });
  const datei = (...b: FokusBlock[]): ZeitDatei => {
    const tage: ZeitDatei['tage'] = {};
    for (const x of b) { const t = x.von.slice(0, 10); (tage[t] ??= { auto: {}, bewusst: {}, bloecke: [] }).bloecke.push(x); }
    return { tage };
  };

  it('Summen je Mandat, „ohne Mandat“ zuletzt, gelöschtes Mandat bleibt mit Zeit sichtbar', () => {
    const a = mandateAuswerten([
      B('2026-09-28T08:00:00Z', 120, { mandatId: 'm-ug' }), B('2026-09-29T08:00:00Z', 60, { mandatId: 'm-ug' }),
      B('2026-09-29T10:00:00Z', 90, { mandatId: 'm-deal' }), B('2026-09-30T10:00:00Z', 30), B('2026-09-30T11:00:00Z', 15, { mandatId: 'm-weg', firmaId: 'f-x' }),
    ], KARTE, 'monat');
    expect(a.sek).toBe((120 + 60 + 90 + 30 + 15) * 60);
    expect(a.mitMandatSek).toBe((120 + 60 + 90 + 15) * 60);
    expect(a.zeilen.map(z => [z.id, z.sek / 60])).toEqual([['m-ug', 180], ['m-deal', 90], ['m-weg', 15], [MANDAT_OHNE, 30]]);
    expect(a.zeilen[0]).toMatchObject({ label: 'Nord GmbH · Retainer', einheit: 'MAKE OS UG', bloecke: 2, honorarMonat: 3000, honorarZeitraum: 3000, euroJeStunde: 1000 });
    expect(a.zeilen[2]).toMatchObject({ label: 'Mandat (gelöscht)', art: 'geloescht', firmaId: 'f-x' });
    expect(a.zeilen.at(-1)).toMatchObject({ label: 'ohne Mandat', art: 'ohne' });
  });

  it('grober Satz: Woche = 12/52 des Monatshonorars; unter der Schwelle kein Satz', () => {
    expect(honorarImZeitraum(5200, 'woche')).toBe(1200);
    const w = mandateAuswerten([B('2026-09-28T08:00:00Z', 240, { mandatId: 'm-ug' })], KARTE, 'woche');
    expect(w.zeilen[0].euroJeStunde).toBe(Math.round(honorarImZeitraum(3000, 'woche') / 4));
    const kurz = mandateAuswerten([B('2026-09-28T08:00:00Z', SATZ_AB_SEK / 60 - 1, { mandatId: 'm-ug' })], KARTE, 'monat');
    expect(kurz.zeilen[0].euroJeStunde).toBeUndefined();
    expect(kurz.zeilen[0].honorarZeitraum).toBe(3000);
  });

  it('Berliner Woche: Mo 00:30 Berlin (So 22:30 UTC) zählt in die neue Woche, So 23:30 Berlin in die alte', () => {
    const d = datei(
      B('2026-09-27T22:30:00Z', 60, { mandatId: 'm-ug' }), // Mo 28.09. 00:30 Berlin
      B('2026-09-27T21:30:00Z', 30, { mandatId: 'm-ug' }), // So 27.09. 23:30 Berlin
      B('2026-10-04T21:00:00Z', 45, { mandatId: 'm-deal' }), // So 04.10. 23:00 Berlin — noch diese Woche
      B('2026-10-04T22:10:00Z', 20, { mandatId: 'm-deal' }), // Mo 05.10. 00:10 Berlin — nächste Woche
    );
    const w = zeitJeMandat([{ person: 'kevin', name: 'Kevin', datei: d }], KARTE, 'woche', '2026-09-30');
    expect(w).toMatchObject({ von: '2026-09-28', bis: '2026-10-04', label: 'KW 40' });
    expect(w.gesamt.zeilen.map(z => [z.id, z.sek / 60])).toEqual([['m-ug', 60], ['m-deal', 45], [MANDAT_OHNE, 0]]);
  });

  it('Berliner Monat und je Person + gesamt; Privat-Blöcke zählen nie', () => {
    const kevin = datei(B('2026-09-30T21:30:00Z', 60, { mandatId: 'm-ug' }) /* 30.09. 23:30 Berlin */, B('2026-09-30T22:30:00Z', 60, { mandatId: 'm-ug' }) /* 01.10. 00:30 Berlin */);
    const malin = datei(B('2026-09-10T08:00:00Z', 90, { mandatId: 'm-ug' }), B('2026-09-11T08:00:00Z', 50, { schluessel: 'privat:gesundheit', mandatId: 'm-ug' }));
    const m = zeitJeMandat([{ person: 'kevin', name: 'Kevin', datei: kevin }, { person: 'malin', name: 'Malin', datei: malin }], KARTE, 'monat', '2026-09-15');
    expect(m).toMatchObject({ von: '2026-09-01', bis: '2026-09-30', label: 'September 2026' });
    expect(m.personen.map(p => p.auswertung.zeilen[0].sek / 60)).toEqual([60, 90]);
    expect(m.gesamt.zeilen[0]).toMatchObject({ id: 'm-ug', sek: 150 * 60, bloecke: 2, euroJeStunde: 1200 });
  });
});

describe('Verbindungsprüfung — Mandat an Zielen und Zeit', () => {
  const lebend = { mandate: new Set(['m-ug', 'm-deal']), firmen: new Set(['f-nord', 'f-sued']) };
  const planung = (): PlanungBestand => ({
    ziele: [{ speicher: 'ziele', ziele: [{ id: 'z-1', mandatId: 'm-ug', firmaId: 'f-nord' }, { id: 'z-2', mandatId: 'm-weg', firmaId: 'f-nord' }] }, { speicher: 'ziele-eigen--malin', ziele: [{ id: 'z-3', firmaId: 'f-weg' }] }],
    meilensteine: [{ id: 'ms-1' }, { id: 'ms-2', mandatId: 'm-weg' }],
  });
  const fokus = () => [{ person: 'kevin', bloecke: [{ von: 'a', bis: 'b', schluessel: 'business:x', label: 'x', sek: 60, mandatId: 'm-weg', firmaId: 'f-nord', einheit: 'MAKE OS UG' }, { von: 'c', bis: 'd', schluessel: 'business:x', label: 'x', sek: 60, mandatId: 'm-ug' }] }];

  it('meldet tote Mandate/Firmen an Zielen, Meilensteinen und Fokus-Blöcken — nur Kennungen', () => {
    const funde: [string, string][] = [];
    planungPruefen({ planung: planung(), fokus: fokus() }, lebend, (id, k) => funde.push([id, k]));
    expect(funde).toEqual([['ziel-mandat-tot', 'z-2'], ['ziel-mandat-tot', 'z-3'], ['meilenstein-mandat-tot', 'ms-2'], ['zeit-mandat-tot', 'm-weg']]);
  });

  it('nichts geladen → nichts geprüft', () => {
    const funde: string[] = [];
    planungPruefen({ planung: null, fokus: null }, lebend, id => funde.push(id));
    expect(funde).toEqual([]);
  });

  it('Reparieren entfernt nur die tote Kennung; zweimal ändert nichts mehr', () => {
    const r = planungReparieren({ planung: planung(), fokus: fokus() }, new Set(['ziel-mandat-tot', 'meilenstein-mandat-tot', 'zeit-mandat-tot']), lebend);
    expect(r.aenderungen.map(a => [a.befundId, a.speicher, a.anzahl])).toEqual([['ziel-mandat-tot', 'ziele', 2], ['meilenstein-mandat-tot', 'meilensteine', 1], ['zeit-mandat-tot', 'zeit', 1]]);
    expect(r.planung!.ziele[0].ziele[1]).toEqual({ id: 'z-2', firmaId: 'f-nord' });
    expect(r.planung!.ziele[1].ziele[0]).toEqual({ id: 'z-3' });
    expect(r.fokus![0].bloecke[0]).toEqual({ von: 'a', bis: 'b', schluessel: 'business:x', label: 'x', sek: 60, firmaId: 'f-nord', einheit: 'MAKE OS UG' });
    const zwei = planungReparieren({ planung: r.planung, fokus: r.fokus }, new Set(['ziel-mandat-tot', 'meilenstein-mandat-tot', 'zeit-mandat-tot']), lebend);
    expect(zwei.aenderungen).toEqual([]);
    // nur gewählte Befunde
    const nurZeit = planungReparieren({ planung: planung(), fokus: fokus() }, new Set(['zeit-mandat-tot']), lebend);
    expect(nurZeit.planung).toEqual(planung());
  });

  it('bezugBereinigen: lebender Bezug → derselbe Eintrag (keine Schreibung)', () => {
    const x = { id: 'z-1', mandatId: 'm-ug' };
    expect(bezugBereinigen(x, lebend)).toBe(x);
  });

  it('ganze Dateien: Ziele je Horizont, Meilensteine, Zeit — andere Felder und Sekunden bleiben', () => {
    const z = zieleDateiBereinigen({ tag: [], woche: [{ id: 'z-2', titel: 'T', fortschritt: 10, mandatId: 'm-weg' }], monat: [], quartal: [], jahr: [{ id: 'z-1', titel: 'J', fortschritt: 0, mandatId: 'm-ug' }], fokus: { tag: 'x' } }, lebend);
    expect(z.anzahl).toBe(1);
    expect(z.datei.woche).toEqual([{ id: 'z-2', titel: 'T', fortschritt: 10 }]);
    expect(z.datei.fokus).toEqual({ tag: 'x' });
    const sauber = { tag: [], jahr: [{ id: 'z-1', mandatId: 'm-ug' }] };
    expect(zieleDateiBereinigen(sauber, lebend).datei).toBe(sauber);
    const m = meilensteinDateiBereinigen({ meilensteine: [{ id: 'ms-2', titel: 'M', firmaId: 'f-weg' }, { id: 'ms-1', titel: 'N' }] }, lebend);
    expect(m).toEqual({ datei: { meilensteine: [{ id: 'ms-2', titel: 'M' }, { id: 'ms-1', titel: 'N' }] }, anzahl: 1 });
    const d = fokusVerbuchen(LEER_ZEIT, { von: '2026-09-28T08:00:00.000Z', bis: '2026-09-28T08:30:00.000Z', schluessel: 'business:x', label: 'x', mandatId: 'm-weg' });
    const zt = zeitDateiBereinigen(d, lebend);
    expect(zt.anzahl).toBe(1);
    const tag = Object.keys(d.tage)[0];
    expect(zt.datei.tage[tag].bloecke[0]).not.toHaveProperty('mandatId');
    expect(zt.datei.tage[tag].bewusst).toEqual(d.tage[tag].bewusst);
    expect(zeitDateiBereinigen(zt.datei, lebend).datei).toBe(zt.datei);
  });
});
