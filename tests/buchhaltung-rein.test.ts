// ─── Buchhaltung — reine Regeln (02.11.): Gegenkonto je Rechtsart, Regeln, Arbeitsliste, Export, Prüfmodus, Paket ───────────────────────
// Erfundene Werte; Bereich/Rechtsart über `EinheitenInfo` austauschbar (keine feste Firma).
import { describe, it, expect } from 'vitest';
import { gegenArt, businessKategorie, umbuchungVorschlaege, type EinheitenInfo } from '@/lib/finanzen/buchhaltung/gegenkonto';
import { regelPruefen, regelFuer, regelDarf, rueckwirkend, type BuchungsRegel } from '@/lib/finanzen/buchhaltung/regeln';
import { filtern, seiteVon, offenGruende, mitGegenbuchung, monatssummen, summen, type BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import { feld, betragDe, exportCsv, exportName } from '@/lib/finanzen/buchhaltung/export';
import { zuPruefen, ohneFrageBestaetigbar, pruefGruppen, pruefHinweise } from '@/lib/finanzen/buchhaltung/pruefung';
import { teilAnwenden } from '@/lib/finanzen/buchhaltung/teil';
import { PAKET_ART, paketPruefen, paketPlanen, eintragAnwenden } from '@/lib/finanzen/buchhaltung/paket';
import { testIban } from './fixtures/kontoauszug';

const b = (x: Partial<BhBuchung> & { id: string }): BhBuchung => ({ datum: '2026-10-01', wer: 'Beispiel', betrag: -10, kategorie: 'Sonstiges', ort: 'ug', ...x });
const INFO: EinheitenInfo = {
  bereich: g => (g === 'kdc' ? 'privat' : 'business'),
  rechtsart: g => (g === 'kdc' ? 'einzelunternehmen' : 'kapitalgesellschaft'),
};
const INFO_EU_BUSINESS: EinheitenInfo = { bereich: () => 'business', rechtsart: g => (g === 'kdc' ? 'einzelunternehmen' : 'kapitalgesellschaft') };

describe('Gegenkonto — Entnahme/Einlage statt Umbuchung', () => {
  it('Einzelunternehmen im Business: Abfluss = Privatentnahme, Zufluss = Privateinlage', () => {
    expect(gegenArt('kdc', 'privat', -5000, INFO_EU_BUSINESS)).toEqual({ art: 'entnahme', gesellschaft: 'kdc' });
    expect(gegenArt('kdc', 'privat', 5000, INFO_EU_BUSINESS)).toEqual({ art: 'einlage', gesellschaft: 'kdc' });
    // aus Sicht des Privatkontos: Zufluss privat = Abfluss in der Firma
    expect(gegenArt('privat', 'kdc', 5000, INFO_EU_BUSINESS)).toEqual({ art: 'entnahme', gesellschaft: 'kdc' });
  });
  it('Kapitalgesellschaft: Gesellschafterdarlehen/Ausschüttung — zuordnen', () => {
    expect(gegenArt('ug', 'privat', -5000, INFO).art).toBe('gesellschafter');
    expect(businessKategorie('gesellschafter')).toEqual({ kategorie: 'Sonstiges', zuordnen: 'gesellschafter' });
  });
  it('zwischen Gesellschaften: Verrechnung; Privat ↔ Privat und Gesellschaft im Privat-Bereich bleiben Umbuchung', () => {
    expect(gegenArt('ug', 'kdv', -1, INFO).art).toBe('verrechnung');
    expect(gegenArt('privat', 'gemeinsam', -1, INFO).art).toBe('umbuchung');
    expect(gegenArt('kdc', 'privat', -1, INFO).art).toBe('umbuchung');
  });
  it('Vorschläge für gespeicherte Umbuchungen: Hand gewinnt, Partner bei anderer Gesellschaft → Verrechnung', () => {
    const alle = [
      b({ id: 'a', kategorie: 'Umbuchung', betrag: -100, ort: 'ug', konto: 'K1' }),
      b({ id: 'p', kategorie: 'Umbuchung', betrag: 100, ort: 'kdv', konto: 'K2', datum: '2026-10-02' }),
      b({ id: 'h', kategorie: 'Umbuchung', betrag: -7, ort: 'ug', kategorieHand: true }),
      b({ id: 'x', kategorie: 'Umbuchung', betrag: -9, ort: 'kdv' }),
    ];
    const v = umbuchungVorschlaege(alle, INFO);
    expect(v.find(x => x.id === 'a')).toMatchObject({ art: 'verrechnung', zuordnen: 'verrechnung' });
    expect(v.find(x => x.id === 'h')).toBeUndefined();
    expect(v.find(x => x.id === 'x')).toMatchObject({ art: 'gesellschafter' });
  });
});

describe('Regeln', () => {
  const r = (x: Partial<BuchungsRegel> & { id: string }): BuchungsRegel => ({ feld: 'wer', muster: 'Beispiel', kategorie: 'Büro', angelegt: '2026-11-01T00:00:00Z', ...x });
  it('Regel der Gesellschaft vor allgemeiner, längeres Muster vor kürzerem', () => {
    const regeln = [r({ id: 'br-a', muster: 'Beispiel' }), r({ id: 'br-b', muster: 'Beispiel', ort: 'ug', kategorie: 'Reise' }), r({ id: 'br-c', muster: 'Laden Beispiel', kategorie: 'Marketing' })];
    expect(regelFuer(regeln, b({ id: '1', wer: 'Laden Beispiel' }))!.id).toBe('br-b');
    expect(regelFuer(regeln, b({ id: '1', wer: 'Laden Beispiel', ort: 'kdv' }))!.id).toBe('br-c');
  });
  it('Hand gewinnt, Gegenkonto-Kategorien nicht per Regel, Muster zu kurz 400, zu lang 413', () => {
    expect(regelDarf(b({ id: '1', kategorieHand: true }))).toBe(false);
    expect(regelDarf(b({ id: '1', kategorie: 'Privatentnahme' }))).toBe(false);
    expect(regelPruefen({ muster: 'ab', kategorie: 'Büro' }, { id: 'br-1', jetzt: '', erlaubteOrte: () => true })).toMatchObject({ ok: false, status: 400 });
    expect(regelPruefen({ muster: 'x'.repeat(81), kategorie: 'Büro' }, { id: 'br-1', jetzt: '', erlaubteOrte: () => true })).toMatchObject({ ok: false, status: 413 });
    expect(regelPruefen({ muster: 'Beispiel', kategorie: 'Umbuchung' }, { id: 'br-1', jetzt: '', erlaubteOrte: () => true })).toMatchObject({ ok: false, status: 400 });
    const w = rueckwirkend([b({ id: '1' }), b({ id: '2', kategorieHand: true })], [r({ id: 'br-a' })]);
    expect(w.map(x => x.id)).toEqual(['1']);
  });
});

describe('Arbeitsliste', () => {
  const alle = [
    b({ id: 'b1', datum: '2026-10-03', betrag: 100, kategorie: 'Erlöse' }),
    b({ id: 'b2', datum: '2026-10-01', kategorie: 'Sonstiges', wer: 'Ärger Beispiel' }),
    b({ id: 'b3', datum: '2026-09-15', kategorie: 'Büro', konto: 'K' }),
  ];
  it('filtert nach Monat, Suche (Umlaute), „nicht zugeordnet“; sortiert auf/ab', () => {
    expect(filtern(alle, { monat: '2026-10' }).map(x => x.id)).toEqual(['b1', 'b2']);
    expect(filtern(alle, { richtung: 'auf' }).map(x => x.id)).toEqual(['b3', 'b2', 'b1']);
    expect(filtern(alle, { suche: 'ÄRGER' }).map(x => x.id)).toEqual(['b2']);
    expect(filtern(alle, { offen: 'alle' }).map(x => x.id).sort()).toEqual(['b1', 'b2']);
    expect(offenGruende(alle[0], mitGegenbuchung(alle))).toEqual(['rechnung']);
  });
  it('Seiten statt Grenze: nichts fällt weg', () => {
    const viele = Array.from({ length: 250 }, (_, i) => i);
    expect(seiteVon(viele, 3)).toMatchObject({ seite: 3, seiten: 3, gesamt: 250, von: 201, bis: 250 });
    expect(seiteVon(viele, 99).seite).toBe(3);
    expect(seiteVon([], 1)).toMatchObject({ von: 0, bis: 0, seiten: 1 });
  });
  it('Summen und Monatssummen auf den Cent', () => {
    expect(summen([b({ id: '1', betrag: 0.1 }), b({ id: '2', betrag: 0.2 }), b({ id: '3', betrag: -0.3 })])).toEqual({ einCent: 30, ausCent: 30 });
    const m = monatssummen(alle);
    expect(m.monate).toEqual(['2026-09', '2026-10']);
    expect(m.zeilen.find(z => z.kategorie === 'Erlöse')!.je['2026-10']).toBe(10000);
  });
});

describe('Export', () => {
  it('Formel-Anfänge neutralisiert, Beträge bleiben Zahlen, Zeilenumbrüche weg', () => {
    expect(feld('=SUMME(A1)')).toBe(`"'=SUMME(A1)"`);
    expect(feld('-12,50')).toBe('"-12,50"');
    expect(feld('@x')).toBe(`"'@x"`);
    expect(feld('a\r\nb "c"')).toBe('"a b ""c"""');
    expect(betragDe(-1234.5)).toBe('-1.234,50');
    expect(betragDe(0.1 + 0.2)).toBe('0,30');
  });
  it('IBAN nur maskiert, BOM, Dateiname ohne Namen', () => {
    const iban = testIban('37040044', '532013000');
    const csv = exportCsv([b({ id: '1', konto: 'Geschäftskonto', wer: '+Tel' })], { kontoIban: new Map([['Geschäftskonto', iban]]) });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).not.toContain(iban);
    expect(csv).toContain(`"'+Tel"`);
    expect(exportName(['ug'], '2026-10-01', '2026-10-31')).toBe('buchungen-ug-2026-10-01-bis-2026-10-31.csv');
  });
});

describe('Prüfmodus', () => {
  it('zu prüfen: offene Prüfung oder Bewirtung ohne Anlass/Teilnehmer; „ohne Frage“ nur ohne offene Frage', () => {
    const offen = b({ id: '1', pruefung: { status: 'offen', vorschlag: 'Büro' } });
    const frage = b({ id: '2', pruefung: { status: 'offen', vorschlag: 'Büro', frage: { text: 'Wofür?' } } });
    const bew = b({ id: '3', kategorie: 'Bewirtung', bewirtung: { anlass: 'Kundentermin' } });
    expect([offen, frage, bew].map(zuPruefen)).toEqual([true, true, true]);
    expect(ohneFrageBestaetigbar(offen)).toBe(true);
    expect(ohneFrageBestaetigbar(frage)).toBe(false);
    expect(pruefHinweise(bew)).toContain('Anlass/Teilnehmer fehlen');
    const g = pruefGruppen([offen, frage, b({ id: '4', wer: 'Andere', pruefung: { status: 'offen' } })]);
    expect(g[0]).toMatchObject({ gegenseite: 'Beispiel', summeCent: -2000 });
  });
  it('„Passt“ stempelt nur mit Person; der Vorschlag wird die Kategorie (von Hand)', () => {
    const alt = b({ id: '1', pruefung: { status: 'offen', vorschlag: 'Reise' } });
    const ohne = teilAnwenden(alt, { bestaetigen: true }, { alle: [alt], rechnungen: [], sicht: 'business' });
    expect(ohne).toMatchObject({ ok: false, status: 403 });
    const mit = teilAnwenden(alt, { bestaetigen: true }, { alle: [alt], rechnungen: [], sicht: 'business', wer: 'pb', jetzt: '2026-11-02T10:00:00Z' });
    expect(mit.ok && mit.neu).toMatchObject({ kategorie: 'Reise', kategorieHand: true, pruefung: { status: 'bestaetigt', geprueftVon: 'pb' } });
  });
  it('Business darf keine private Buchung anfassen (403)', () => {
    expect(teilAnwenden(b({ id: '1', ort: 'privat' }), { notiz: 'x' }, { alle: [], rechnungen: [], sicht: 'business' })).toMatchObject({ ok: false, status: 403 });
  });
});

describe('Paket', () => {
  const IBAN = testIban('37040044', '532013000');
  const konten = [{ id: 'k1', name: 'Geschäftskonto', iban: IBAN, ort: 'ug' }];
  const leer = { regeln: [], kategorien: [] };
  const pruef = (eintraege: unknown[], regeln: unknown[] = [], orte = (o: string) => o !== 'kdc') =>
    paketPruefen({ art: PAKET_ART, version: 1, erstellt: '2026-11-01', regeln, eintraege }, { orteErlaubt: orte });
  const e = (x: Record<string, unknown> = {}) => ({ gesellschaft: 'ug', konto: IBAN, datum: '2026-10-05', betragCent: -1000, gegenseite: 'Beispiel', ...x });

  it('Form: falsche Art/Version 400, fremde Gesellschaft 403, unbekannte Kategorie 400, zwei Muster in einer Regel 400', () => {
    expect(paketPruefen({ art: 'x', version: 1 }, { orteErlaubt: () => true })).toMatchObject({ ok: false, status: 400 });
    expect(paketPruefen({ art: PAKET_ART, version: 2, erstellt: '2026-11-01' }, { orteErlaubt: () => true })).toMatchObject({ ok: false, status: 400 });
    expect(pruef([e({ gesellschaft: 'kdc' })])).toMatchObject({ ok: false, status: 403 });
    expect(pruef([e({ kategorie: 'Gibt es nicht' })])).toMatchObject({ ok: false, status: 400 });
    expect(pruef([], [{ gesellschaft: 'ug', muster: { gegenseite: 'Bei', zweck: 'Abo' }, kategorie: 'Büro' }])).toMatchObject({ ok: false, status: 400 });
    expect(pruef([], [{ gesellschaft: 'ug', muster: { gegenseite: 'Eigenes Konto' }, kategorie: 'Umbuchung' }])).toMatchObject({ ok: false, status: 400 });
    expect(pruef([e({ kategorie: 'büro' })])).toMatchObject({ ok: true, paket: { eintraege: [{ kategorie: 'Büro' }] } });
  });

  it('Mehrdeutigkeit: passende Gegenseite gewinnt, gleiche Doppelte der Reihe nach, jede Buchung höchstens einmal', () => {
    const buchungen = [
      b({ id: 'x2', konto: 'Geschäftskonto', datum: '2026-10-05', betrag: -10, wer: 'Andere GmbH' }),
      b({ id: 'x1', konto: 'Geschäftskonto', datum: '2026-10-05', betrag: -10, wer: 'Beispiel GmbH' }),
      b({ id: 'x3', konto: 'Geschäftskonto', datum: '2026-10-05', betrag: -10, wer: 'Andere GmbH' }),
    ];
    const p = pruef([e({ notiz: 'erste' }), e({ gegenseite: 'Andere', notiz: 'zweite' }), e({ gegenseite: 'Andere', notiz: 'dritte' }), e({ gegenseite: 'Andere', notiz: 'vierte' })]);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const plan = paketPlanen(p.paket, { buchungen, konten, regeln: leer, jetzt: '', neueId: () => 'br-x' });
    expect(plan.aenderungen.get('x1')!.notiz).toBe('erste');
    expect(plan.aenderungen.get('x2')!.notiz).toBe('zweite');
    expect(plan.aenderungen.get('x3')!.notiz).toBe('dritte');
    expect(plan.ohneBuchung).toHaveLength(1);
    expect(plan.zugeordnet).toBe(3);
  });

  it('Hand gewinnt; Notiz/Beleg/Bewirtung füllen nur Lücken; idempotent', () => {
    const hand = b({ id: 'h', kategorie: 'Büro', kategorieHand: true, notiz: 'meine' });
    const r = eintragAnwenden(hand, { gesellschaft: 'ug', konto: IBAN, datum: '2026-10-01', betragCent: -1000, gegenseite: 'Beispiel', kategorie: 'Reise', notiz: 'paket', bewirtung: { anlass: 'A' } });
    expect(r.handBehalten).toBe(true);
    expect(r.neu.pruefung).toBeUndefined();
    expect(r.neu.notiz).toBe('meine');
    expect(r.neu.bewirtung).toEqual({ anlass: 'A' });
    const p = pruef([e({ kategorie: 'Reise' })]);
    if (!p.ok) throw new Error('Paket');
    const einmal = paketPlanen(p.paket, { buchungen: [b({ id: 'z', konto: 'Geschäftskonto', datum: '2026-10-05' })], konten, regeln: leer, jetzt: '', neueId: () => 'br-x' });
    const danach = [einmal.aenderungen.get('z')!];
    const zweimal = paketPlanen(p.paket, { buchungen: danach, konten, regeln: leer, jetzt: '', neueId: () => 'br-x' });
    expect(zweimal.aenderungen.size).toBe(0);
    expect(zweimal.unveraendert).toBe(1);
  });

  it('Konto fremder Gesellschaft bzw. unbekannt → ohne Buchung (mit Grund)', () => {
    const p = pruef([e({ gesellschaft: 'kdv' }), e({ konto: testIban('10010010', '123456789') })]);
    if (!p.ok) throw new Error('Paket');
    const plan = paketPlanen(p.paket, { buchungen: [], konten, regeln: leer, jetzt: '', neueId: () => 'br-x' });
    expect(plan.ohneBuchung.map(o => o.grund)).toEqual(['Konto gehört zu einer anderen Gesellschaft', 'Konto nicht im Konten-Register']);
  });
});
