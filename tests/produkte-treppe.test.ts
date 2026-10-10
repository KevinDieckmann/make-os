// ─── Produkte · Leistungstreppe — die reinen Regeln (10.10.) ──────────────────────────────────────────────────────────
// Erfundene Stufen, Mandate und Produkte — nie echte Inhalte einer Instanz. Geprüft wird:
//   · Lesen robust (kaputte Einträge fallen weg), Schreiben nur per Einzel-Schritt mit Stand (409), Grenzen 413, Unsinn 400 — nie still gekürzt
//   · Stufe je Kunde (gewählt vor abgeleitet), nächste Stufe nach Regel, Report alle zwei Wochen, Health-Ampel, Zielbild, Kapazität
//   · Vorschlag aus einem Dokument: gesäubert, nur angehakte Teile übernommen, Stufen kommen neu dazu
//   · Report-Aufbau und Mail-Vorlage (Du/Sie), Mail mit Anhang (multipart, Dateiname nach RFC 2231)
import { describe, it, expect } from 'vitest';
import {
  leereTreppe, treppeAus, treppeAnwenden, vorschlagSauber, vorschlagTeile, vorschlagAnwenden, TREPPE_GRENZEN,
  type TreppeDatei, type AnwendenKontext,
} from '@/lib/crm/treppe-daten';
import { ebenenVon, stufeVonMandat, stufeReif, reportFaellig, kundenZeilen, kundenAmpel, zielbild, umsatzImJahr, kapaBedarf, kundenreise, preisText } from '@/lib/crm/treppe';
import { reportDokument, mailVorlage, reportDateiname } from '@/lib/crm/treppe-report';
import { mimeBauen, ANHANG_GRENZEN } from '@/lib/gmail/mime';
import type { Mandat, Leistung } from '@/lib/crm/typen';

let n = 0;
const K: AnwendenKontext = { person: 'pa', jetzt: '2026-10-10T08:00:00.000Z', heute: '2026-10-10', standVon: x => JSON.stringify(x).length.toString(36) + JSON.stringify(x).slice(0, 40), neueId: p => `${p}-test${(++n).toString().padStart(4, '0')}` };
const anwenden = (d: TreppeDatei, ops: unknown[]) => treppeAnwenden(d, ops, K);
const ok = (d: TreppeDatei, ops: unknown[]): TreppeDatei => { const r = anwenden(d, ops); if (!r.ok) throw new Error(JSON.stringify(r)); return r.datei; };

const mandat = (x: Partial<Mandat>): Mandat => ({
  id: 'm-a', kunde: 'Beispiel GmbH', kontaktIds: ['c-a'], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'auto', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: '2026-08-01T00:00:00Z', ...x,
} as Mandat);
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: '', ...x } as Leistung);

/** Eine erfundene Treppe: Einstieg (kostenlos) → Analyse (fest) → zwei Monatspakete als Alternativen. */
function treppe(): TreppeDatei {
  return ok(leereTreppe(2026), [
    { op: 'stufe', eintrag: { id: 'ts-eins', name: 'Erstgespräch', ebene: 1, preis: { art: 'kostenlos' } } },
    { op: 'stufe', eintrag: { id: 'ts-zwei', name: 'Analyse', ebene: 2, preis: { art: 'fest', betrag: 3000 }, dauerTage: 20, aufwandStunden: 12, lieferobjekte: ['Befund', 'Fahrplan'], leistungIds: ['l-ana'], ziel: { umsatz: 30000, kunden: 10 } } },
    { op: 'stufe', eintrag: { id: 'ts-drei', name: 'Paket operativ', ebene: 3, preis: { art: 'monat', betrag: 2000 }, aufwandStunden: 26, leistungIds: ['l-a'], regeln: { mindestlaufzeitMonate: 6, maxGleichzeitig: 1 } } },
    { op: 'stufe', eintrag: { id: 'ts-vier', name: 'Paket strategisch', ebene: 3, preis: { art: 'monat', betrag: 4000 } } },
  ]);
}

describe('Lesen und Schreiben', () => {
  it('liest robust: nichts → leer; kaputte Einträge fallen weg, gültige bleiben', () => {
    expect(treppeAus(null, 2026)).toEqual(leereTreppe(2026));
    const d = treppeAus({ zielJahr: 2027, stufen: [{ id: 'ts-gut1', name: 'A', ebene: 2, preis: { art: 'unsinn' } }, { id: 'kaputt', name: 'B' }, 'x'], kreislauf: [{ id: 'st-gut1', name: 'S', stufeId: 'ts-gut1' }], marken: { 'report:m-a': '2026-10-01', fremd: '2026-10-01' } }, 2026);
    expect(d.zielJahr).toBe(2027);
    expect(d.stufen.map(s => s.id)).toEqual(['ts-gut1']);
    expect(d.stufen[0].preis.art).toBe('fest');
    expect(d.kreislauf[0].stufeId).toBe('ts-gut1');
    expect(d.marken).toEqual({ 'report:m-a': '2026-10-01' });
  });
  it('neu ohne Stand; ändern nur mit dem Stand, sonst 409 — nichts geändert', () => {
    const d = treppe();
    const s = d.stufen.find(x => x.id === 'ts-zwei')!;
    expect(anwenden(d, [{ op: 'stufe', eintrag: { id: 'ts-zwei', name: 'Neu' } }])).toMatchObject({ ok: false, status: 409, konflikte: [{ op: 0, id: 'ts-zwei' }] });
    const r = anwenden(d, [{ op: 'stufe', eintrag: { id: 'ts-zwei', name: 'Analyse plus', regeln: { bonus: 'bei Ziel' } }, stand: K.standVon(s) }]);
    expect(r.ok).toBe(true);
    const neu = r.ok ? r.datei.stufen.find(x => x.id === 'ts-zwei')! : null;
    // Teil-Änderung: der Rest der Stufe bleibt (Preis, Lieferobjekte, Ziel), Regeln werden gemischt.
    expect(neu).toMatchObject({ name: 'Analyse plus', preis: { art: 'fest', betrag: 3000 }, lieferobjekte: ['Befund', 'Fahrplan'], ziel: { umsatz: 30000, kunden: 10 }, regeln: { bonus: 'bei Ziel' }, geaendertVon: 'pa' });
  });
  it('Grenzen → 413, Unsinn → 400 — nie still gekürzt', () => {
    const d = treppe();
    expect(anwenden(d, Array.from({ length: TREPPE_GRENZEN.ops + 1 }, () => ({ op: 'zieljahr', jahr: 2026 })))).toMatchObject({ ok: false, status: 413 });
    expect(anwenden(d, [{ op: 'stufe', eintrag: { name: 'X', lieferobjekte: Array.from({ length: 21 }, (_, i) => `L${i}`) } }])).toMatchObject({ ok: false, status: 413 });
    expect(anwenden(d, [{ op: 'stufe', eintrag: { name: 'X', preis: { art: 'gratis' } } }])).toMatchObject({ ok: false, status: 400 });
    expect(anwenden(d, [{ op: 'stufe', eintrag: { name: '' } }])).toMatchObject({ ok: false, status: 400 });
    expect(anwenden(d, [{ op: 'unbekannt' }])).toMatchObject({ ok: false, status: 400 });
    expect(anwenden(d, [{ op: 'vorlage' }])).toMatchObject({ ok: false, status: 400 });
  });
  it('Stufe entfernen löst Verweise (Station, Paket, Kunde) — nichts wird mitgelöscht', () => {
    let d = treppe();
    d = ok(d, [{ op: 'station', eintrag: { id: 'st-test1', name: 'Analyse', stufeId: 'ts-zwei' } }, { op: 'paket', eintrag: { id: 'rp-test1', titel: 'Neu', stufeId: 'ts-zwei', start: '2026-11' } }, { op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei' } }]);
    const s = d.stufen.find(x => x.id === 'ts-zwei')!;
    d = ok(d, [{ op: 'stufe-weg', id: 'ts-zwei', stand: K.standVon(s) }]);
    expect(d.stufen.map(x => x.id)).not.toContain('ts-zwei');
    expect(d.kreislauf[0]).toMatchObject({ id: 'st-test1', name: 'Analyse' });
    expect(d.kreislauf[0].stufeId).toBeUndefined();
    expect(d.roadmap[0].stufeId).toBeUndefined();
    expect(d.kunden['m-a'].stufeId).toBeUndefined();
    expect(d.kunden['m-a'].verlauf).toHaveLength(1);
  });
  it('Kunde: Stufe wechseln schreibt den Verlauf; Lieferobjekt idempotent; nächster Schritt braucht Datum; Report gesendet', () => {
    let d = treppe();
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei' } }]);
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-drei' }, stand: K.standVon(d.kunden['m-a']) }]);
    expect(d.kunden['m-a'].verlauf.map(v => v.stufeId)).toEqual(['ts-zwei', 'ts-drei']);
    d = ok(d, [{ op: 'lieferobjekt', mandatId: 'm-a', was: 'Befund', erledigt: true }, { op: 'lieferobjekt', mandatId: 'm-a', was: 'Befund', erledigt: true }]);
    expect(d.kunden['m-a'].erledigt).toEqual([{ was: 'Befund', am: '2026-10-10', von: 'pa' }]);
    expect(anwenden(d, [{ op: 'kunde', mandatId: 'm-a', felder: { naechster: { text: 'Termin', datum: 'morgen' } }, stand: K.standVon(d.kunden['m-a']) }])).toMatchObject({ ok: false, status: 400 });
    d = ok(d, [{ op: 'report-gesendet', mandatId: 'm-a' }]);
    expect(d.reports['m-a']).toMatchObject({ gesendetAm: '2026-10-10', gesendetVon: 'pa' });
  });
  it('Positionierung nur mit Stand; leere Vorlage nur auf eine leere Treppe (Platzhalter, keine Inhalte)', () => {
    let d = leereTreppe(2026);
    d = ok(d, [{ op: 'positionierung', felder: { claim: 'Ein Satz' }, stand: K.standVon(d.positionierung) }]);
    expect(d.positionierung.claim).toBe('Ein Satz');
    expect(anwenden(d, [{ op: 'positionierung', felder: { claim: 'X' }, stand: 'alt' }])).toMatchObject({ ok: false, status: 409 });
    expect(anwenden(d, [{ op: 'positionierung', felder: { unbekannt: 'X' }, stand: K.standVon(d.positionierung) }])).toMatchObject({ ok: false, status: 400 });
    d = ok(d, [{ op: 'vorlage' }]);
    expect(d.stufen.map(s => s.name)).toEqual(['Stufe 1', 'Stufe 2', 'Stufe 3', 'Stufe 4', 'Stufe 5']);
    expect(d.kreislauf).toHaveLength(5);
    expect(d.stufen.every(s => !s.aufgabe && !s.preis.betrag)).toBe(true);
  });
});

describe('Rechnungen', () => {
  it('Ebenen: gleiche Ebene = Alternativen nebeneinander', () => {
    expect(ebenenVon(treppe().stufen).map(e => [e.ebene, e.stufen.map(s => s.name)])).toEqual([[1, ['Erstgespräch']], [2, ['Analyse']], [3, ['Paket operativ', 'Paket strategisch']]]);
  });
  it('Stufe je Kunde: gewählt vor abgeleitet (Produkt ∈ Leistungen der Stufe)', () => {
    let d = treppe();
    expect(stufeVonMandat({ id: 'm-a', leistungId: 'l-a' }, d)).toMatchObject({ stufe: { id: 'ts-drei' }, quelle: 'produkt' });
    expect(stufeVonMandat({ id: 'm-a', leistungId: 'l-unbekannt' }, d)).toBeNull();
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei' } }]);
    expect(stufeVonMandat({ id: 'm-a', leistungId: 'l-a' }, d)).toMatchObject({ stufe: { id: 'ts-zwei' }, quelle: 'hand' });
  });
  it('nächste Stufe: alle Lieferobjekte · letzte Phase · Dauer um — und nie auf der obersten Ebene', () => {
    const d = treppe();
    const zwei = d.stufen.find(s => s.id === 'ts-zwei')!;
    const basis = { stufe: zwei, stufen: d.stufen, erledigt: [] as string[], phase: null, heute: '2026-10-10' };
    expect(stufeReif(basis)).toBeNull();
    expect(stufeReif({ ...basis, erledigt: ['Befund', 'Fahrplan'] })).toMatchObject({ grund: 'alle Lieferobjekte erledigt', stufen: [{ id: 'ts-drei' }, { id: 'ts-vier' }] });
    expect(stufeReif({ ...basis, phase: { nr: 3, von: 3 } })?.grund).toBe('letzte Phase des Produkts erreicht');
    expect(stufeReif({ ...basis, seit: '2026-09-01' })?.grund).toContain('Dauer');
    expect(stufeReif({ ...basis, stufe: d.stufen.find(s => s.id === 'ts-drei')!, erledigt: ['x'], phase: { nr: 3, von: 3 } })).toBeNull();
  });
  it('Report alle zwei Wochen; ein neues Mandat erst nach einer Woche; nur aktive', () => {
    expect(reportFaellig({ status: 'aktiv', start: '2026-10-08' }, undefined, undefined, '2026-10-10').faellig).toBe(false);
    expect(reportFaellig({ status: 'aktiv', start: '2026-09-01' }, undefined, undefined, '2026-10-10').faellig).toBe(true);
    expect(reportFaellig({ status: 'aktiv', start: '2026-09-01' }, { gesendetAm: '2026-10-01' }, undefined, '2026-10-10')).toEqual({ faellig: false, letzter: '2026-10-01' });
    expect(reportFaellig({ status: 'aktiv', start: '2026-09-01' }, { gesendetAm: '2026-09-20' }, '2026-09-27', '2026-10-10').faellig).toBe(false);
    expect(reportFaellig({ status: 'aktiv', start: '2026-09-01' }, { gesendetAm: '2026-09-20' }, '2026-09-26', '2026-10-10').faellig).toBe(true);
    expect(reportFaellig({ status: 'pausiert', start: '2026-01-01' }, undefined, undefined, '2026-10-10').faellig).toBe(false);
  });
  it('Health-Ampel: Termine, Lieferungen, Zahlungen, Zufriedenheit — schlechteste gilt', () => {
    const d = treppe();
    const zwei = d.stufen.find(s => s.id === 'ts-zwei')!;
    const a = kundenAmpel({ m: mandat({ naechstesReview: '2026-10-01', health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: 90, stimmung: 65 } }), stufe: zwei, f: undefined, seit: '2026-09-20', heute: '2026-10-10' });
    expect(a.teile.map(t => [t.id, t.farbe])).toEqual([['termine', 'rot'], ['lieferungen', 'rot'], ['zahlungen', 'gruen'], ['zufriedenheit', 'gelb']]);
    expect(a.gesamt).toBe('rot');
    const b = kundenAmpel({ m: mandat({ naechstesReview: '2026-10-20' }), stufe: null, f: undefined, heute: '2026-10-10' });
    expect(b.teile[0]).toMatchObject({ farbe: 'gruen' });
    expect(b.gesamt).toBe('gruen');
  });
  it('Kundenzeilen: Schritt = Phase des Mandats, Lieferobjekte mit Häkchen, Report fällig', () => {
    let d = treppe();
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei' } }, { op: 'lieferobjekt', mandatId: 'm-a', was: 'Befund', erledigt: true }]);
    const z = kundenZeilen({ datei: d, crm: { mandate: [mandat({ leistungId: 'l-a', phase: 'p2' }), mandat({ id: 'm-alt', status: 'beendet' })], leistungen: [leistung({ phasen: [{ id: 'p1', name: 'Start' }, { id: 'p2', name: 'Mitte' }, { id: 'p3', name: 'Ende' }] })] }, heute: '2026-10-10' });
    expect(z).toHaveLength(1);
    expect(z[0]).toMatchObject({ stufe: { id: 'ts-zwei' }, stufeQuelle: 'hand', schritt: { nr: 2, von: 3, name: 'Mitte', naechste: 'Ende' }, lieferobjekte: [{ was: 'Befund', erledigt: true }, { was: 'Fahrplan', erledigt: false }], report: { faellig: true } });
  });
  it('Zielbild: Umsatz aus Monatshonoraren bis heute, Kunden je Firma einmal, Übergänge aus dem Verlauf', () => {
    expect(umsatzImJahr(mandat({ start: '2026-08-15' }), 2026, '2026-10-10')).toBe(3000);
    expect(umsatzImJahr(mandat({ start: '2025-11-01', ende: '2026-02-28' }), 2026, '2026-10-10')).toBe(2000);
    expect(umsatzImJahr(mandat({ honorar: { betrag: 5000, basis: 'einmalig', netto: true }, start: '2026-03-01' }), 2026, '2026-10-10')).toBe(5000);
    let d = treppe();
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei' } }]);
    d = ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-drei' }, stand: K.standVon(d.kunden['m-a']) }]);
    const zb = zielbild({ datei: d, crm: { mandate: [mandat({ firmaId: 'f-a' }), mandat({ id: 'm-b', leistungId: 'l-a', firmaId: 'f-a' })], chancen: [{ id: 'ch-a', leistungId: 'l-ana', firmaId: 'f-b', angelegt: '2026-05-01T00:00:00Z' } as never] }, heute: '2026-10-10' });
    expect(zb.zeilen.find(z => z.stufeId === 'ts-drei')!.ist).toEqual({ umsatz: 6000, kunden: 1 });
    expect(zb.zeilen.find(z => z.stufeId === 'ts-zwei')!.ist.kunden).toBe(1);
    expect(zb.uebergaenge).toEqual([{ von: 'Analyse', nach: 'Paket operativ', anzahl: 1 }]);
    expect(zb.summe.zielUmsatz).toBe(30000);
    d = ok(d, [{ op: 'station', eintrag: { id: 'st-test9', name: 'Analyse', stufeId: 'ts-zwei', ziel: 4 } }, { op: 'station', eintrag: { id: 'st-test8', name: 'Sichtbarkeit', ist: 12 } }]);
    expect(kundenreise(d, zb).map(s => [s.name, s.ist, s.istQuelle])).toEqual([['Analyse', 1, 'stufe'], ['Sichtbarkeit', 12, 'hand']]);
  });
  it('Kapazität: Monatspakete Aufwand × 12 ÷ 52 je Kunde, Plätze gegen „höchstens N gleichzeitig“', () => {
    const d = treppe();
    const z = kundenZeilen({ datei: d, crm: { mandate: [mandat({ leistungId: 'l-a' }), mandat({ id: 'm-b', leistungId: 'l-a' })], leistungen: [] }, heute: '2026-10-10' });
    const k = kapaBedarf(d, z);
    expect(k.jeStufe.find(x => x.stufeId === 'ts-drei')).toMatchObject({ kunden: 2, stundenWoche: 12, max: 1, voll: true, ueber: true });
    expect(k.stundenWoche).toBe(12);
    expect(preisText({ art: 'monat', betrag: 2000 })).toBe('2.000 € je Monat');
    expect(preisText({ art: 'kostenlos' })).toBe('kostenlos');
  });
});

describe('Vorschlag aus einem Dokument', () => {
  const roh = {
    stufen: [{ name: 'Check', ebene: 1, preis: { art: 'kostenlos' } }, { name: 'Analyse', ebene: 2, preis: { art: 'fest', betrag: '2.500' }, lieferobjekte: ['Bericht'] }, { name: '' }],
    kreislauf: [{ name: 'Sichtbarkeit', messgroesse: 'Anfragen je Monat' }, { name: 'Analyse', stufeIndex: 1 }],
    positionierung: { claim: 'Klarer Satz', zielgruppe: 'Mittelstand', unbekannt: 'x' },
  };
  it('gesäubert: leere Stufen fallen weg, Zahlen deutsch gelesen, keine fremden Felder', () => {
    const v = vorschlagSauber(roh);
    expect(v.stufen.map(s => s.name)).toEqual(['Check', 'Analyse']);
    expect(v.stufen[1].preis).toEqual({ art: 'fest', betrag: 2500 });
    expect(v.positionierung).toEqual({ claim: 'Klarer Satz', zielgruppe: 'Mittelstand' });
    expect(vorschlagTeile(v)).toEqual(['stufe:0', 'stufe:1', 'station:0', 'station:1', 'pos:claim', 'pos:zielgruppe']);
  });
  it('nur die angehakten Teile — Stufen kommen NEU dazu (über der vorhandenen Treppe), Stationen hängen an der neuen Stufe', () => {
    const d = treppe();
    const r = vorschlagAnwenden(d, vorschlagSauber(roh), ['stufe:1', 'station:1', 'pos:claim'], K);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datei.stufen).toHaveLength(d.stufen.length + 1);
    const neu = r.datei.stufen[r.datei.stufen.length - 1];
    expect(neu).toMatchObject({ name: 'Analyse', ebene: 5, lieferobjekte: ['Bericht'] });
    expect(r.datei.kreislauf).toEqual([expect.objectContaining({ name: 'Analyse', stufeId: neu.id })]);
    expect(r.datei.positionierung).toMatchObject({ claim: 'Klarer Satz' });
    expect(r.datei.positionierung.zielgruppe).toBeUndefined();
    expect(vorschlagAnwenden(d, vorschlagSauber(roh), [], K)).toMatchObject({ ok: false, status: 400 });
  });
});

describe('Report und Mail', () => {
  const d = treppe();
  const z = kundenZeilen({ datei: ok(d, [{ op: 'kunde', mandatId: 'm-a', felder: { stufeId: 'ts-zwei', naechster: { text: 'Abschlussgespräch', datum: '2026-10-20' } } }, { op: 'lieferobjekt', mandatId: 'm-a', was: 'Befund', erledigt: true }]), crm: { mandate: [mandat({})], leistungen: [] }, heute: '2026-10-10' })[0];
  const doc = reportDokument(z, d.stufen.find(s => s.id === 'ts-zwei')!, { kunde: 'Beispiel GmbH', titel: 'Begleitung', ziele: [{ id: 'z1', text: 'Marge', ziel: '20 %', ist: '14 %' }] }, '2026-10-10', 'Absender GmbH');
  it('Aufbau: erreicht, nächste Schritte, Kennzahlen', () => {
    expect(doc).toMatchObject({ kunde: 'Beispiel GmbH', paket: 'Analyse', stand: '10.10.2026', absender: 'Absender GmbH' });
    expect(doc.erreicht[0]).toBe('Befund (10.10.2026)');
    expect(doc.naechste).toEqual(['Abschlussgespräch — bis 20.10.2026', 'Fahrplan']);
    expect(doc.kennzahlen).toContainEqual({ name: 'Marge', wert: 'Ist: 14 % · Ziel: 20 %' });
    expect(reportDateiname('Müller & Söhne GmbH', '2026-10-10')).toBe('Fortschritt-Muller-Sohne-GmbH-2026-10-10.pdf');
  });
  it('Mail: Du nach der Akte locker, sonst Sie — der Bericht hängt an', () => {
    const du = mailVorlage({ anrede: 'Du', vorname: 'Erika', doc, absender: 'Pia Probe' });
    expect(du.text.startsWith('Hey Erika,\n\nich wollte dich gerade updaten')).toBe(true);
    expect(du.text).toContain('- Befund (10.10.2026)');
    expect(du.text.trim().endsWith('Pia Probe')).toBe(true);
    expect(du.betreff).toBe('Fortschritt Analyse — Stand 10.10.2026');
    const sie = mailVorlage({ vorname: 'Erika', nachname: 'Beispiel', doc });
    expect(sie.text.startsWith('Guten Tag Erika Beispiel,\n\nich möchte Sie kurz')).toBe(true);
    expect(sie.text).toContain('finden Sie im Anhang');
  });
  it('Mail mit Anhang: multipart/mixed, Text zuerst, Datei base64 mit Namen nach RFC 2231; Grenzen', () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 erfunden');
    const roh = mimeBauen({ von: { email: 'absender@example.invalid' }, an: [{ email: 'kunde@example.invalid' }], betreff: 'Stand', text: 'Hallo', anhaenge: [{ name: 'Fortschritt-Süd.pdf', typ: 'application/pdf', bytes: pdf }] });
    expect(roh).toMatch(/Content-Type: multipart\/mixed; boundary="mk-[A-Za-z0-9]+"/);
    expect(roh).toContain("filename*=UTF-8''Fortschritt-S%C3%BCd.pdf");
    expect(roh).toContain(Buffer.from(pdf).toString('base64'));
    expect(roh.indexOf('text/plain')).toBeLessThan(roh.indexOf('application/pdf'));
    expect(() => mimeBauen({ von: { email: 'a@example.invalid' }, an: [{ email: 'b@example.invalid' }], betreff: 'x', text: 'x', anhaenge: Array.from({ length: ANHANG_GRENZEN.anzahl + 1 }, () => ({ name: 'a.pdf', typ: 'application/pdf', bytes: pdf })) })).toThrow();
    // Ohne Anhang: wie bisher einteilig.
    expect(mimeBauen({ von: { email: 'a@example.invalid' }, an: [{ email: 'b@example.invalid' }], betreff: 'x', text: 'x' })).toContain('Content-Type: text/plain; charset="UTF-8"');
  });
});
