// ─── Produkte & Mandate · Karte + Katalog-Oberfläche (P2, 19.10.) ─────────────────────────────────────────────────────
// Erfundene Produkte, Preise und Namen — nie echte Inhalte einer Instanz (Plattform-Regel). Geprüft wird:
//   · der Katalog als Treppe aus den Karten (`katalogAnsicht`): Altbestand, Karten mit Ebene, Stufen ohne Produkt, „Ohne Stufe“, Archiv, Linie
//   · der Faden unter der Treppe (`treppenFaden`): hell bis zur höchsten Stufe mit Kunden, kein Faden ohne Weg
//   · geführtes Anlegen und „Als Produkt anlegen“ — beide gehen unverändert durch den Server-Säuberer und die Prüfung (kein 400)
//   · Preis-Teile bearbeiten (je Form nur passende Felder), Vertrag, Regeln, Texte an EINER Stelle (ohne Datenverlust), Lieferumfang (Enter + Verlassen)
//   · Angebots-Tool: mehrere Preis-Teile → mehrere Positionen, Optionen zum Anhaken; Adressen „Mandat aus Produkt“ und „Finanzplanung mit Produkt“
//   · Wächter: die Oberfläche liest die Ansicht aus den Karten (nie mehr die gespeicherte Treppe), der Katalog rendert
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  katalogAnsicht, treppenFaden, belegungText, preisTextStufe, neuesProdukt, karteAusStufe, teilFuerArt, neuerPreisTeil, preiseVerschieben, hauptpreisId,
  teilFeldSetzen, teilFeldWert, preisePruefen, vertragAenderung, vertragText, regelnAenderung, regelnText, texteVon, textAenderung, zusammen, lieferumfangDazu,
  kartenLuecken, ebenenWahl, angebotKachel, aufwandText, zahlAus, planungsSicht, PREIS_TEIL_FELDER, LIEFER_MAX,
} from '@/lib/crm/produkt-katalog';
import { angebotPositionenAusProdukt, preiseText, produktPruefen, katalogTreppe, PREIS_TEIL_ARTEN, type PreisTeil } from '@/lib/crm/produkt-karte';
import { treppeAus, type TreppeDatei } from '@/lib/crm/treppe-daten';
import { saeubern, wendeCrmAn, leererBestand } from '@/lib/crm/speicher';
import { mandatNeuAusAdresse } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';
import type { CrmBestand, Leistung, Mandat } from '@/lib/crm/typen';

const J = '2026-10-19T08:00:00.000Z';
const leistung = (x: Partial<Leistung>): Leistung => ({ id: 'l-a', name: 'Produkt A', typ: 'retainer', stufe: 'kern', preis: { betrag: 1000, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J, ...x } as Leistung);
const teil = (x: Partial<PreisTeil>): PreisTeil => ({ id: 'pt-1', art: 'fest', rolle: 'grund', ...x } as PreisTeil);
const mandat = (x: Partial<Mandat>): Mandat => ({
  id: 'm-a', kunde: 'Beispiel GmbH', kontaktIds: [], titel: 'Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: true,
  start: '2026-08-01', verlaengerung: 'auto', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14,
  ziele: [], health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: J, ...x,
} as Mandat);
/** Erfundene, gespeicherte Treppe: Erstgespräch ohne Produkt → Analyse (l-ana) → Paket (l-a; l-b + l-c gemeinsam). */
function gespeichert(): TreppeDatei {
  return treppeAus({
    zielJahr: 2026,
    stufen: [
      { id: 'ts-eins', name: 'Erstgespräch', ebene: 1, preis: { art: 'kostenlos' } },
      { id: 'ts-zwei', name: 'Analyse', ebene: 2, preis: { art: 'fest', betrag: 3000 }, dauerTage: 21, aufwandStunden: 12, lieferobjekte: ['Befund', 'Fahrplan'], leistungIds: ['l-ana'], ziel: { umsatz: 30000, kunden: 10 }, aufgabe: 'Lage klären', regeln: { bonus: 'Bonus bei Zielen', anrechnung: 'voll aufs Paket' } },
      { id: 'ts-drei', name: 'Paket', ebene: 3, preis: { art: 'monat', betrag: 2000 }, leistungIds: ['l-b', 'l-c'], regeln: { maxGleichzeitig: 2 } },
    ],
  }, 2026);
}
const ALT = [
  leistung({ id: 'l-ana', name: 'Analyse-Produkt', preis: { betrag: 3000, einheit: 'pauschal', basis: 'einmalig' } }),
  leistung({ id: 'l-b', name: 'Paket B' }), leistung({ id: 'l-c', name: 'Paket C', linie: 'Software' }),
];

// ── Katalog als Treppe ────────────────────────────────────────────────────────────────────────────────────────────────

describe('katalogAnsicht: die Treppe aus den Karten', () => {
  it('Altbestand: Stufen der Besitzer, Stufe ohne Produkt gestrichelt, verknüpftes Zweitprodukt unter „Ohne Stufe“ mit Satz', () => {
    const d = gespeichert();
    const a = katalogAnsicht({ leistungen: ALT, gespeicherte: d.stufen, belegung: [{ stufeId: 'ts-drei', kunden: 2, max: 2, voll: true, ueber: false }] });
    expect(a.ebenen.map(e => [e.ebene, e.kacheln.map(k => k.name)])).toEqual([[1, ['Erstgespräch']], [2, ['Analyse-Produkt']], [3, ['Paket B']]]);
    expect(a.ebenen[0].kacheln[0]).toMatchObject({ ohneProdukt: true, leistungId: null, stufeId: 'ts-eins', preisText: 'kostenlos' });
    expect(a.ebenen[1].kacheln[0]).toMatchObject({ leistungId: 'l-ana', stufeId: 'ts-zwei', preisText: '3.000 € netto einmalig', kunden: 0, plaetze: null });
    expect(a.ebenen[2].kacheln[0]).toMatchObject({ leistungId: 'l-b', kunden: 2, plaetze: { max: 2, voll: true, ueber: false } });
    expect(belegungText(a.ebenen[2].kacheln[0])).toBe('2 Kunden jetzt · 2/2 Plätze');
    expect(a.ohneStufe.map(k => k.leistungId)).toEqual(['l-c']);
    expect(a.ohneStufe[0].hinweis).toMatch(/„Paket“ verknüpft/);
  });
  it('Karten mit Ebene bekommen ihre Stufe; Archiv und Papierkorb stehen nicht auf der Treppe; Linie filtert (ohne Stufen ohne Produkt)', () => {
    const d = gespeichert();
    const neu = leistung({ id: 'l-neu', name: 'Neue Karte', ebene: 2, preise: [teil({ art: 'monatlich', betragCent: 150_000 }), teil({ id: 'pt-2', art: 'je_einheit', betragCent: 50_000, einheit: 'Event', rolle: 'option' })] });
    const weg = leistung({ id: 'l-weg', name: 'Weg', ebene: 1, preise: [teil({})], geloeschtAm: J });
    const alt = leistung({ id: 'l-alt', name: 'Alt', ebene: 1, preise: [teil({})], status: 'eingestellt' });
    const a = katalogAnsicht({ leistungen: [...ALT, neu, weg, alt], gespeicherte: d.stufen });
    const zwei = a.ebenen.find(e => e.ebene === 2)!;
    expect(zwei.kacheln.map(k => k.name)).toEqual(['Analyse-Produkt', 'Neue Karte']);
    expect(zwei.kacheln[1]).toMatchObject({ stufeId: 'ts-k-l-neu', preisText: '1.500 € netto/Monat · optional: 500 € netto je Event' });
    expect(JSON.stringify(a)).not.toMatch(/l-weg|l-alt/);
    const nurSoftware = katalogAnsicht({ leistungen: ALT, gespeicherte: d.stufen, linie: 'Software' });
    expect(nurSoftware.ebenen).toEqual([]);
    expect(nurSoftware.ohneStufe.map(k => k.leistungId)).toEqual(['l-c']);
    expect(katalogAnsicht({ leistungen: ALT, gespeicherte: d.stufen }).linien).toEqual(['Beratung & Begleitung', 'Software']);
  });
  it('Privat-Gesellschaft mit Ebene: nicht auf der Treppe, mit Satz; Mandate zählen „Ohne Stufe“ und Plätze', () => {
    const kdc = leistung({ id: 'l-kdc', name: 'Einzelleistung', gesellschaft: 'kdc', ebene: 2, preise: [teil({ art: 'tagessatz', betragCent: 90_000 })], regeln: { maxGleichzeitig: 1 } });
    const a = katalogAnsicht({ leistungen: [kdc], gespeicherte: [], mandate: [mandat({ leistungId: 'l-kdc' }), mandat({ id: 'm-b', leistungId: 'l-kdc' }), mandat({ id: 'm-c', leistungId: 'l-kdc', status: 'beendet' })] });
    expect(a.ebenen).toEqual([]);
    expect(a.ohneStufe[0]).toMatchObject({ kunden: 2, plaetze: { max: 1, voll: true, ueber: true } });
    expect(a.ohneStufe[0].hinweis).toMatch(/Privat/);
  });
  it('Preis einer Stufe ohne Produkt in der Sprache der Karten', () => {
    expect(preisTextStufe({ preis: { art: 'monat', betrag: 2500 } })).toBe('2.500 € netto/Monat');
    expect(preisTextStufe({ preis: { art: 'fest' } })).toBe('Festpreis offen');
  });
});

describe('treppenFaden: der Faden unter der Treppe', () => {
  const b = (i: number, kunden: number, ueber = false) => ({ a0: i * 200, a1: i * 200 + 170, q: 100 - i * 22, farbe: '#112233', kunden, ueber });
  const ton = { basis: '#21B5AA', rot: '#FF5C5C' };
  it('kein Weg (eine Stufe) = kein Faden', () => { expect(treppenFaden([b(0, 1)], 'quer', ton)).toBeNull(); });
  it('hell bis zur höchsten Stufe mit Kunden, dahinter gedämpft und ausgefranst; ohne Kunden ganz gedämpft', () => {
    const f = treppenFaden([b(0, 3), b(1, 1), b(2, 0)], 'quer', ton)!;
    expect(f.punkte).toHaveLength(6);
    expect(f.hier).toBe(true);
    expect(f.frans).toBe(true);
    expect(f.bisHier!).toBeGreaterThan(0.5);
    expect(f.bisHier!).toBeLessThan(1);
    expect(f.farben).toHaveLength(3);
    expect(treppenFaden([b(0, 0), b(1, 0)], 'quer', ton)).toMatchObject({ bisHier: 0, hier: false, frans: true });
    expect(treppenFaden([b(0, 1), b(1, 2)], 'quer', ton)).toMatchObject({ bisHier: 1, hier: false, frans: false });
  });
  it('über der Platzgrenze in der Warnfarbe; am Handy senkrecht', () => {
    expect(treppenFaden([b(0, 1), b(1, 3, true)], 'quer', ton)!.farben![1].farbe).toBe('#FF5C5C');
    const s = treppenFaden([{ a0: 0, a1: 80, q: 10, farbe: '#112233', kunden: 0 }, { a0: 100, a1: 180, q: 10, farbe: '#112233', kunden: 1 }], 'senkrecht', ton)!;
    expect(s.punkte[0]).toEqual([10, 0]);
    expect(s.punkte[3]).toEqual([10, 180]);
  });
});

// ── Anlegen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('geführtes Anlegen und „Als Produkt anlegen“', () => {
  it('neues Produkt: Entwurf mit EINEM Preis-Teil, Fehler je Feld; geht unverändert durch Säubern und Prüfen', () => {
    expect(neuesProdukt({ name: ' ', art: 'monatlich', preis: '', gesellschaft: 'ug', ebene: null, leistungstext: '' }, 'l-x')).toMatchObject({ ok: false, fehler: { name: expect.any(String) } });
    expect(neuesProdukt({ name: 'X', art: 'monatlich', preis: 'zwei', gesellschaft: 'ug', ebene: null, leistungstext: '' }, 'l-x')).toMatchObject({ ok: false, fehler: { preis: expect.stringMatching(/Zahl/) } });
    const r = neuesProdukt({ name: 'Begleitung', art: 'monatlich', preis: '2.990', gesellschaft: 'ug', ebene: 2, leistungstext: 'Monatliche Begleitung.' }, 'l-neu');
    if (!r.ok) throw new Error('erwartet ok');
    expect(r.eintrag).toMatchObject({ status: 'entwurf', ebene: 2, preise: [{ id: 'pt-1', art: 'monatlich', betragCent: 299_000, rolle: 'grund' }], angebot: { leistungstext: 'Monatliche Begleitung.' }, typ: 'retainer' });
    expect(produktPruefen(r.eintrag as unknown as Record<string, unknown>)).toEqual([]);
    const b = wendeCrmAn(leererBestand(), [{ liste: 'leistungen', op: 'upsert', eintrag: r.eintrag as unknown as Record<string, unknown> }], J, 'pa');
    expect(b.ungueltig ?? []).toEqual([]);
    expect(b.bestand.leistungen[0]).toMatchObject({ preis: { betrag: 2990, einheit: 'Monat netto', basis: 'monat' }, ebene: 2 });
    const aufwand = neuesProdukt({ name: 'Tage', art: 'aufwand', satz: 'tag', preis: '1.200', gesellschaft: 'offen', ebene: null, leistungstext: '' }, 'l-t');
    expect(aufwand.ok && aufwand.eintrag.preise).toEqual([{ id: 'pt-1', art: 'tagessatz', rolle: 'grund', betragCent: 120_000 }]);
    const frei = neuesProdukt({ name: 'Check', art: 'kostenlos', preis: '500', gesellschaft: 'ug', ebene: 1, leistungstext: '' }, 'l-k');
    expect(frei.ok && frei.eintrag.preise).toEqual([{ id: 'pt-1', art: 'kostenlos', rolle: 'grund' }]);
  });
  it('aus einer Stufe ohne Produkt: Preis, Ebene, Texte, Lieferumfang, Vertrag, Plätze, Ziel, Bonus; Aufwand nur ohne Annahme', () => {
    const s = gespeichert().stufen.find(x => x.id === 'ts-zwei')!;
    const k = karteAusStufe({ ...s, regeln: { ...s.regeln, mindestlaufzeitMonate: 3, maxGleichzeitig: 4 } }, 'l-s');
    expect(k).toMatchObject({
      name: 'Analyse', ebene: 2, status: 'entwurf', gesellschaft: 'offen', aufgabe: 'Lage klären', lieferumfang: ['Befund', 'Fahrplan'], ziel: { umsatz: 30000, kunden: 10 },
      vertrag: { mindestlaufzeitMonate: 3 }, regeln: { maxGleichzeitig: 4 }, aufwandStundenWoche: 4,
      preise: [{ id: 'pt-1', art: 'fest', betragCent: 300_000, rolle: 'grund' }, { id: 'pt-2', art: 'erfolg', rolle: 'grund', text: 'Bonus bei Zielen' }],
    });
    expect(produktPruefen(k as unknown as Record<string, unknown>)).toEqual([]);
    expect(saeubern('leistungen', k as unknown as Record<string, unknown>, J, 'pa')).toMatchObject({ preise: k.preise, ebene: 2, aufwandStundenWoche: 4 });
    expect(karteAusStufe(gespeichert().stufen[0], 'l-e')).toMatchObject({ preise: [{ art: 'kostenlos' }], typ: 'diagnose' });
    expect(karteAusStufe({ ...s, dauerTage: undefined }, 'l-o').aufwandStundenWoche).toBeUndefined();
  });
  it('danach führt die Karte die Stufe — Kennung bleibt, kein „ohne Produkt“ mehr', () => {
    const d = gespeichert();
    const k = karteAusStufe(d.stufen[0], 'l-e');
    const verknuepft = d.stufen.map(s => (s.id === 'ts-eins' ? { ...s, leistungIds: ['l-e'] } : s));
    const kat = katalogTreppe([...ALT, k], verknuepft);
    expect(kat.ohneProdukt).toEqual([]);
    expect(kat.herkunft['ts-eins']).toEqual({ leistungId: 'l-e', gespeichert: true, karte: true });
  });
});

// ── Preis-Teile ───────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Preis-Teile bearbeiten', () => {
  it('je Form nur die passenden Felder; ein Wechsel der Form räumt auf (sonst lehnte der Server ab)', () => {
    expect(PREIS_TEIL_FELDER.je_einheit).toContain('einheit');
    expect(PREIS_TEIL_FELDER.monatlich).not.toContain('einheit');
    expect(PREIS_TEIL_FELDER.stundensatz).toContain('deckel');
    expect(PREIS_TEIL_FELDER.kostenlos).toEqual(['text']);
    expect(Object.keys(PREIS_TEIL_FELDER).sort()).toEqual(PREIS_TEIL_ARTEN.map(a => a.id).sort());
    const je = teil({ art: 'je_einheit', betragCent: 1000, bisCent: 2000, einheit: 'Event', zahlplan: { anzahlungProzent: 50 }, text: 'je Abend' });
    expect(teilFuerArt(je, 'monatlich')).toEqual({ id: 'pt-1', art: 'monatlich', rolle: 'grund', betragCent: 1000, bisCent: 2000, text: 'je Abend' });
    expect(teilFuerArt(je, 'kostenlos')).toEqual({ id: 'pt-1', art: 'kostenlos', rolle: 'grund', text: 'je Abend' });
    expect(preisePruefen([teilFuerArt(je, 'stundensatz')])).toEqual([]);
    expect(preisePruefen([{ ...je, art: 'monatlich' }]).length).toBeGreaterThan(0);
  });
  it('Felder: Betrag deutsch, „bis“ nur größer, Anzahlung 1–99, leer entfernt', () => {
    const t = teil({ art: 'fest' });
    const b = teilFeldSetzen(t, 'betrag', '2.990,50');
    expect(b).toEqual({ ok: true, teil: { ...t, betragCent: 299_050 } });
    if (!b.ok) return;
    expect(teilFeldWert(b.teil, 'betrag')).toBe('2.990,50');
    expect(teilFeldSetzen(b.teil, 'bis', '1.000')).toMatchObject({ ok: false });
    expect(teilFeldSetzen(t, 'bis', '1.000')).toMatchObject({ ok: false, fehler: expect.stringMatching(/Betrag davor/) });
    expect(teilFeldSetzen(b.teil, 'anzahlung', '100')).toMatchObject({ ok: false });
    expect(teilFeldSetzen(b.teil, 'anzahlung', '50')).toMatchObject({ ok: true, teil: { zahlplan: { anzahlungProzent: 50 } } });
    expect(teilFeldSetzen(b.teil, 'betrag', '')).toEqual({ ok: true, teil: t });
    expect(teilFeldSetzen(t, 'text', 'x'.repeat(301))).toMatchObject({ ok: false });
  });
  it('Reihenfolge: der erste, der immer gilt, ist der Hauptpreis; neue Kennungen frei', () => {
    const p = [teil({ id: 'pt-1', rolle: 'option' }), teil({ id: 'pt-2', art: 'monatlich' }), teil({ id: 'pt-3', art: 'erfolg' })];
    expect(hauptpreisId(p)).toBe('pt-2');
    expect(hauptpreisId(preiseVerschieben(p, 2, -1))).toBe('pt-3');
    expect(preiseVerschieben(p, 0, -1)).toEqual(p);
    expect(neuerPreisTeil(p, 'tagessatz')).toEqual({ id: 'pt-4', art: 'tagessatz', rolle: 'grund' });
    expect(neuerPreisTeil([teil({ id: 'pt-2' })], 'fest').id).toBe('pt-3');
  });
});

// ── Vertrag, Regeln ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('Vertrag und Regeln', () => {
  it('Vertrag: ein Feld setzen/leeren; Mindestlaufzeit leeren leert auch die alte Laufzeit; Unsinn → Satz', () => {
    expect(vertragAenderung({ vertrag: undefined, laufzeitMonate: undefined }, 'kuendigungsfristTage', 30)).toEqual({ ok: true, felder: { vertrag: { kuendigungsfristTage: 30 } } });
    expect(vertragAenderung({ vertrag: { mindestlaufzeitMonate: 6 }, laufzeitMonate: 6 }, 'mindestlaufzeitMonate', null)).toEqual({ ok: true, felder: { vertrag: null, laufzeitMonate: null } });
    expect(vertragAenderung({ vertrag: {}, laufzeitMonate: undefined }, 'mindestlaufzeitMonate', 500)).toMatchObject({ ok: false });
    expect(vertragText({ mindestlaufzeitMonate: 6, danach: 'monatlich_kuendbar', kuendigungsfristTage: 30, ustSatz: 19 })).toBe('6 Monate, danach monatlich kündbar · 30 Tage Frist');
    expect(vertragText({})).toBe('nichts festgelegt');
  });
  it('Regeln: nie auf sich selbst, nur bekannte Produkte; leer entfernt das Feld', () => {
    const l = leistung({ id: 'l-ws' });
    const bekannt = (id: string) => id === 'l-hos';
    expect(regelnAenderung(l, { anrechnung: { auf: ['l-ws'], anteilProzent: 100 } }, bekannt)).toMatchObject({ ok: false });
    expect(regelnAenderung(l, { anrechnung: { auf: ['l-weg'], anteilProzent: 100 } }, bekannt)).toMatchObject({ ok: false });
    expect(regelnAenderung(l, { anrechnung: { auf: ['l-hos'], anteilProzent: 100 } }, bekannt)).toEqual({ ok: true, felder: { regeln: { anrechnung: { auf: ['l-hos'], anteilProzent: 100 } } } });
    expect(regelnAenderung(leistung({ regeln: { maxGleichzeitig: 2 } }), { maxGleichzeitig: null }, bekannt)).toEqual({ ok: true, felder: { regeln: null } });
    expect(regelnText({ anrechnung: { auf: ['l-hos'], anteilProzent: 100 }, maxGleichzeitig: 2, inklusive: [{ leistungId: 'l-ev', menge: 1, je: 'quartal' }] }, id => (id === 'l-hos' ? 'Begleitung' : 'Event')))
      .toBe('voll angerechnet auf Begleitung · höchstens 2 gleichzeitig · inklusive 1× Event je Quartal');
  });
});

// ── Texte an EINER Stelle ─────────────────────────────────────────────────────────────────────────────────────────────

describe('Texte: genau eine Stelle je Text, ohne Datenverlust', () => {
  it('Lesen führt die Doppelungen zusammen (gleich → einmal, verschieden → beide)', () => {
    expect(zusammen('Ein Plan.', 'Ein Plan.')).toBe('Ein Plan.');
    expect(zusammen('Ein klarer Plan.', 'Plan.')).toBe('Ein klarer Plan.');
    expect(zusammen('A', 'B')).toBe('A\n\nB');
    expect(texteVon({ beschreibung: 'Kurz.', ergebnis: 'Alt-Ergebnis', grenzen: 'Grenze', angebot: { leistungstext: 'Text', ergebnis: 'Neu-Ergebnis' } }))
      .toMatchObject({ kurz: 'Kurz.', leistungstext: 'Text', ergebnis: 'Neu-Ergebnis\n\nAlt-Ergebnis', grenzen: 'Grenze', titel: '', einleitung: '' });
  });
  it('Schreiben: Ergebnis und Grenzen an beide Stellen (alle Leser sehen denselben Text); über den Server bleiben beide gleich', () => {
    const l = leistung({ ergebnis: 'Alt', angebot: { leistungstext: 'Text', ergebnis: 'Anders', titel: 'Titel' } });
    const a = textAenderung(l, 'ergebnis', 'Ein Ergebnis.');
    expect(a).toEqual({ ok: true, felder: { ergebnis: 'Ein Ergebnis.', angebot: { leistungstext: 'Text', ergebnis: 'Ein Ergebnis.', titel: 'Titel' } } });
    const g = textAenderung(l, 'grenzen', '');
    expect(g).toEqual({ ok: true, felder: { grenzen: null, angebot: { leistungstext: 'Text', ergebnis: 'Anders', titel: 'Titel' } } });
    if (!a.ok) return;
    const b: CrmBestand = { ...leererBestand(), leistungen: [l] };
    const r = wendeCrmAn(b, [{ liste: 'leistungen', op: 'teil', id: l.id, felder: a.felder }], J, 'pa');
    expect(r.bestand.leistungen[0]).toMatchObject({ ergebnis: 'Ein Ergebnis.', angebot: { ergebnis: 'Ein Ergebnis.', leistungstext: 'Text', titel: 'Titel' } });
  });
  it('zu lang → Satz statt still gekürzt; ein aktives Produkt verliert den Leistungstext nicht', () => {
    expect(textAenderung(leistung({}), 'ergebnis', 'x'.repeat(601))).toMatchObject({ ok: false, fehler: expect.stringMatching(/zu lang/) });
    expect(textAenderung(leistung({ status: 'aktiv', angebot: { leistungstext: 'T' } }), 'leistungstext', '')).toMatchObject({ ok: false });
    expect(textAenderung(leistung({ status: 'entwurf', angebot: { leistungstext: 'T' } }), 'leistungstext', '')).toEqual({ ok: true, felder: { angebot: { leistungstext: '' } } });
    expect(textAenderung(leistung({}), 'kurz', '')).toEqual({ ok: true, felder: { beschreibung: null } });
  });
});

describe('Lieferumfang: Enter + Verlassen hängt nie zweimal an (Rundgang A6)', () => {
  it('leer, doppelt, zu lang, zu viele → Satz; sonst angehängt und gesäubert', () => {
    expect(lieferumfangDazu(['A'], '  B  ')).toEqual({ ok: true, liste: ['A', 'B'] });
    expect(lieferumfangDazu(['A'], 'a')).toMatchObject({ ok: false, fehler: expect.stringMatching(/schon/) });
    expect(lieferumfangDazu([], ' ')).toMatchObject({ ok: false });
    expect(lieferumfangDazu([], 'x'.repeat(LIEFER_MAX.zeichen + 1))).toMatchObject({ ok: false, fehler: expect.stringMatching(/Zu lang/) });
    expect(lieferumfangDazu(Array.from({ length: LIEFER_MAX.anzahl }, (_, i) => `P${i}`), 'neu')).toMatchObject({ ok: false });
  });
});

// ── Antwort zuerst, Hilfen ────────────────────────────────────────────────────────────────────────────────────────────

describe('Antwort zuerst: was fehlt, Aufwand, Ebenen', () => {
  it('Lücken mit Weg in den Abschnitt — höchstens drei', () => {
    const l = leistung({ status: 'entwurf', gesellschaft: 'offen', preise: [teil({ art: 'monatlich' })] });
    expect(kartenLuecken(l, { ablauf: false }).map(x => x.abschnitt)).toEqual(['texte', 'preis', 'vertrag']);
    expect(kartenLuecken(leistung({ angebot: { leistungstext: 'T' }, preise: [teil({ art: 'fest', betragCent: 100 })] }), { ablauf: true })).toEqual([]);
    expect(kartenLuecken(leistung({ angebot: { leistungstext: 'T' }, preise: [teil({ art: 'fest', betragCent: 100 })] }), { ablauf: false }).map(x => x.abschnitt)).toEqual(['ablauf']);
  });
  it('Aufwand mit Herkunft (eingetragen · umgerechnet · Annahme)', () => {
    expect(aufwandText({ aufwand: null }, {})).toMatchObject({ wert: 'offen' });
    expect(aufwandText({ aufwand: { stunden: 4.25, annahme: false } }, { aufwandStundenWoche: 4.25 })).toEqual({ wert: '4,3 h/Woche', satz: 'Eingetragen je Kunde und Woche.' });
    expect(aufwandText({ aufwand: { stunden: 3, annahme: true } }, {}).satz).toMatch(/Annahme/);
  });
  it('Ebenen zur Wahl, Zahlen aus Eingaben, Sicht der Planung', () => {
    expect(ebenenWahl([])).toEqual([1, 2]);
    expect(ebenenWahl([1, 3])).toEqual([1, 2, 3, 4]);
    expect(ebenenWahl([12])).toHaveLength(12);
    expect(zahlAus('1.500')).toBe(1500);
    expect(zahlAus('2,5')).toBe(2.5);
    expect(zahlAus('')).toBeNull();
    expect(Number.isNaN(zahlAus('abc'))).toBe(true);
    expect(planungsSicht({ gesellschaft: 'kdc' })).toBe('privat');
    expect(planungsSicht({ gesellschaft: 'offen' })).toBe('business');
  });
});

// ── Angebots-Tool, Adressen ───────────────────────────────────────────────────────────────────────────────────────────

describe('Angebots-Tool: mehrere Preis-Teile, Optionen zum Anhaken', () => {
  const EVENT = leistung({ id: 'l-ev', name: 'Eventvertrieb', angebot: { leistungstext: 'Vertrieb am Abend.' }, preise: [teil({ id: 'pt-auf', art: 'fest', betragCent: 500_000 }), teil({ id: 'pt-mon', art: 'monatlich', betragCent: 100_000 }), teil({ id: 'pt-je', art: 'je_einheit', betragCent: 150_000, einheit: 'Event', rolle: 'option' })] });
  it('Kachel: Grund-Teile in einer Zeile, Optionen getrennt; ohne Preis-Teile keine Optionen', () => {
    expect(angebotKachel(EVENT)).toEqual({ preisText: '5.000 € netto einmalig · 1.000 € netto/Monat', optionen: [{ id: 'pt-je', text: '1.500 € netto je Event' }] });
    expect(angebotKachel(leistung({}))).toEqual({ preisText: '1.000 € netto/Monat', optionen: [] });
    expect(preiseText(EVENT)).toContain('optional');
  });
  it('ohne Option zwei Positionen, mit angehakter Option drei', () => {
    expect(angebotPositionenAusProdukt(EVENT, [], { idBasis: 'p-x' }).map(p => p.id)).toEqual(['p-x', 'p-x-2']);
    expect(angebotPositionenAusProdukt(EVENT, ['pt-je'], { idBasis: 'p-x' }).map(p => p.einheit)).toEqual(['pauschal', 'Monat', 'Event']);
  });
});

describe('Adressen: Mandat aus Produkt (für P3) und Finanzplanung mit Produkt (B15)', () => {
  it('WEG.mandatAusProdukt ↔ mandatNeuAusAdresse', () => {
    const url = WEG.mandatAusProdukt('l-abc-1');
    expect(url).toBe('/os/mandate?neu=mandat&produkt=l-abc-1');
    expect(mandatNeuAusAdresse(new URL(`https://x${url}`).searchParams)).toEqual({ leistungId: 'l-abc-1' });
    expect(mandatNeuAusAdresse(new URLSearchParams('neu=mandat&produkt=../x'))).toBeNull();
    expect(mandatNeuAusAdresse(new URLSearchParams('produkt=l-a'))).toBeNull();
  });
  it('WEG.finanzplanungProdukt wählt das Produkt vor', () => {
    expect(WEG.finanzplanungProdukt('l-a')).toBe('/os/finanzen?s=finanzplanung&space=business&u=planen&feld=umsatz&produkt=l-a');
    expect(WEG.finanzplanungProdukt('l-a', 'privat')).toContain('space=privat');
  });
});

// ── Wächter: die Oberfläche ───────────────────────────────────────────────────────────────────────────────────────────

const wurzel = path.resolve(__dirname, '..');
const lies = (p: string) => readFileSync(path.join(wurzel, p), 'utf8');

describe('Wächter: Katalog und Karte', () => {
  it('der Katalog liest die Ansicht aus den Karten — nie mehr die gespeicherte Treppe zur Anzeige', () => {
    const q = lies('components/os/mandate/Produkte.tsx');
    expect(q).toContain('katalogAnsicht({');
    expect(q).toContain('<KatalogTreppe ');
    expect(q).not.toMatch(/linienGruppen\(/);
    expect(lies('components/os/mandate/treppe/Treppe.tsx')).not.toMatch(/datei\.stufen/);
    for (const f of ['components/os/mandate/treppe/Teile.tsx', 'components/os/mandate/treppe/Fortschritt.tsx']) expect(lies(f), f).not.toMatch(/const stufen = lage\.datei\.stufen/);
  });
  it('geführtes Anlegen statt Sofort-Entwurf mit Vorgaben; die Karte schreibt nur über den Bestand (api.teil)', () => {
    const q = lies('components/os/mandate/Produkte.tsx');
    expect(q).not.toMatch(/name: 'Neues Produkt'/);
    expect(q).toContain('<ProduktAnlegen ');
    const k = lies('components/os/mandate/karte/ProduktKarte.tsx');
    expect(k).toContain("api.teil('leistungen', l.id, felder)");
    expect(k).toContain('<Fenster ');
    for (const f of ['ProduktKarte', 'PreisTeile', 'Abschnitte', 'Ablauf', 'ProduktAnlegen', 'felder']) expect(lies(`components/os/mandate/karte/${f}.tsx`), f).not.toMatch(/fetch\('\/api\/crm\/bestand'/);
  });
  it('Angebots-Tool: Produktwahl über die Preis-Teile; Fulfillment hat einen Weg zur Karte (B14); Finanzplanung liest das Produkt (B15)', () => {
    const p = lies('components/os/crm/angebot/Positionen.tsx');
    expect(p).toContain('angebotPositionenAusProdukt(p, optionen[p.id] ?? []');
    expect(p).not.toMatch(/positionAusProdukt\(/);
    expect(lies('components/os/fulfillment/prozesse/Prozesse.tsx')).toMatch(/href=\{WEG\.produkt\(x\.id\)\}/);
    expect(lies('components/os/finanzplan/Baukasten.tsx')).toContain("params.get('produkt')");
    expect(lies('components/os/mandate/karte/Abschnitte.tsx')).toContain('WEG.finanzplanungProdukt(l.id, planungsSicht(l))');
  });
  it('der Katalog rendert (Server, ohne Absturz) mit Kacheln, Stufe ohne Produkt und „+ Produkt auf Stufe“', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { KatalogTreppe } = await import('@/components/os/mandate/KatalogTreppe');
    const ansicht = katalogAnsicht({ leistungen: ALT, gespeicherte: gespeichert().stufen });
    const html = renderToStaticMarkup(createElement(KatalogTreppe, { ansicht, onOeffnen: () => {}, onNeu: () => {}, onAusStufe: () => {}, onStufeWeg: () => {} }));
    expect(html).toContain('Analyse-Produkt');
    expect(html).toContain('Als Produkt anlegen');
    expect(html).toContain('+ Produkt auf Stufe 4');
    expect(html.match(/data-pk-balken/g)).toHaveLength(3);
  });
});
