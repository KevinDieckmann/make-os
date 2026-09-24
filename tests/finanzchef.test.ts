// Head of Finance: der Code rechnet und prüft — das Modell ordnet nur ein.
import { describe, it, expect } from 'vitest';
import { rechne } from '../lib/finanzen/chef/rechne';

describe('Rechner', () => {
  it('rechnet Punkt vor Strich und Klammern', () => {
    expect(rechne('1200 - 350 * 2')).toBe(500);
    expect(rechne('(1200 - 350) * 2')).toBe(1700);
    expect(rechne('10 / 3')).toBe(3.33);
    expect(rechne('−5 + 2,5')).toBe(-2.5);
  });
  it('lehnt alles andere ab', () => {
    expect(rechne('process.exit()')).toBeNull();
    expect(rechne('1/0')).toBeNull();
    expect(rechne('2 +')).toBeNull();
  });
});

import { baueFinanzbild, type Eingaben } from '../lib/finanzen/chef/finanzbild';
import { normalisiere, pruefe, sauber, pfadDa, korrekturAuftrag, STEUER_SATZ } from '../lib/finanzen/chef/pruefer';
import { vorschlaegeMischen, leererStand, type ChefVorschlag } from '../lib/finanzen/chef/stand';
import { faelligerModus, dritterWerktag } from '../lib/finanzen/chef/plan';
import { haushalteAus } from '../lib/finanzen/chef/takt';
import { testHaushalt } from '../lib/finanzen/haushalt/testdaten';
import { leereMeta } from '../lib/finanzen/haushalt/speicher';
import { DEFAULT_FINANCE } from '../lib/make-one/finance-data';
import { STANDARD_EINSTELLUNG } from '../lib/finanzen/chef/steuertermine';

const HEUTE = '2026-09-24';
const basis = (mitHaushalt: boolean): Eingaben => ({
  heute: HEUTE,
  finance: { ...DEFAULT_FINANCE, startMonat: 5, months: DEFAULT_FINANCE.months.map((m, i) => (i === 5 || i === 6 ? { ...m, umsatz: 12000, kosten: 5000 } : { ...m })) },
  plan: {
    firmen: [{ id: 'kdv', name: 'KD Ventures', kontostand: 20000, stand: '2026-09-20' }, { id: 'privat', name: 'Privat', kontostand: 4711.13, stand: '2026-09-20' }],
    rechnungen: [{ id: 'r1', kunde: 'Beispielkunde GmbH', titel: 'Beratung', betrag: 3000, status: 'gestellt', faellig: '2026-08-10', firmaId: 'kdv' }],
    zahlungen: [], merkposten: [],
  },
  planposten: [], grundlage: null,
  steuer: { ...STANDARD_EINSTELLUNG, ruecklageQuote: null },
  haushalt: mitHaushalt ? { ...testHaushalt(HEUTE), meta: { ...leereMeta(), steuerquote: 30 } } : null,
});

describe('Finanzbild', () => {
  it('rechnet Business ohne Haushalt — und kennt die Datenlücken', () => {
    const b = baueFinanzbild(basis(false));
    expect(b.umfang).toBe('business');
    expect(b.business.kasse).toMatchObject({ betrag: 20000, quelle: 'konten', konten: 1 });
    expect(b.business.controlling?.leere_monate).toEqual(['Aug']);
    expect(b.business.forderungen.ueberfaellig[0]).toMatchObject({ kunde: 'Beispielkunde GmbH', tage: 45 });
    expect(b.hinweise.some(h => /Aug/.test(h.text) && h.bereich === 'daten')).toBe(true);
    expect(b.haushalt).toBeNull();
    expect(b.gesamt).toBeNull();
  });
  it('Kanarienvogel: der private Kontostand taucht im Business-Bild nirgends auf', () => {
    expect(JSON.stringify(baueFinanzbild(basis(false)))).not.toContain('4711.13');
  });
  it('mit Haushalt: Kennzahlen, Brücke und Auffälligkeiten sind da', () => {
    const b = baueFinanzbild(basis(true));
    expect(b.umfang).toBe('business+haushalt');
    expect(b.haushalt?.sparquote_prozent).toEqual(expect.any(Number));
    expect(b.gesamt?.fehlt).toContain('Business-Zahlen (Grundlage)');
    expect(Array.isArray(b.auffaelligkeiten)).toBe(true);
  });
});

const daten = { business: { kasse: { betrag: 20000 }, forderungen: { offen_summe: 3000 } }, steuern: { termine_60_tage: [{ datum: '2026-10-12', titel: 'USt Q3' }] } };
const antwort = (over: Record<string, unknown> = {}) => normalisiere({
  modus: 'wochenreview', status: 'beobachten', zusammenfassung: 'Kasse 20.000 €, offene Forderungen 3.000 €.', ampel: [],
  befunde: [{ titel: 'Forderung offen', was: '3.000 € offen', bedeutung: 'Nachfassen.', typ: 'fakt', schwere: 'mittel', bereich: 'business', steuerhinweis: false, quelle: ['business.forderungen'] }],
  vorschlaege: [{ titel: 'USt bereitstellen', begruendung: 'Termin steht.', betrag_eur: null, frist: '2026-10-12', prioritaet: 'hoch', verantwortlich: 'kevin', bereich: 'steuern', art: 'steuer', quelle: ['steuern.termine_60_tage.0'], dedup_schluessel: 'steuer:ust:2026-q3' }],
  fragen: [], datenluecken: [], antwort: null, bericht_markdown: null, ...over,
}, 'wochenreview');

describe('Prüfer', () => {
  it('lässt eine saubere Antwort durch', () => {
    expect(sauber(pruefe(antwort(), daten))).toBe(true);
  });
  it('findet erfundene Zahlen, Quellen, Beträge und Fristen', () => {
    const a = antwort({ zusammenfassung: 'Kasse 27.500 € — reicht.', vorschlaege: [{ titel: 'Rücklage', begruendung: 'x', betrag_eur: 1234, frist: '2026-11-30', prioritaet: 'mittel', verantwortlich: 'beide', bereich: 'steuern', art: 'ruecklage', quelle: ['business.gibtsnicht'], dedup_schluessel: 'r' }] });
    const p = pruefe(a, daten);
    expect(p.unbelegt.map(u => u.text)).toContain('27.500 €');
    expect(p.quellenFehlen).toEqual(['business.gibtsnicht']);
    expect(p.betraegeUnbelegt).toHaveLength(1);
    expect(p.fristenUnbelegt).toHaveLength(1);
    expect(korrekturAuftrag(p)).toMatch(/27\.500 €/);
  });
  it('Summe zweier Datenwerte gilt als belegt, Rechner-Ergebnisse auch', () => {
    expect(pruefe(antwort({ zusammenfassung: 'Zusammen 23.000 €.' }), daten).unbelegt).toEqual([]);
    expect(pruefe(antwort({ zusammenfassung: 'Szenario: 17.777 €.' }), daten, [17777], ['rechne']).unbelegt).toEqual([]);
  });
  it('Vollzugsmeldung und Anlageprodukt sind Verstöße', () => {
    expect(pruefe(antwort({ zusammenfassung: 'Ich habe die Rate überwiesen.' }), daten).verstoesse).toHaveLength(1);
    expect(pruefe(antwort({ zusammenfassung: 'Legt den Rest in einen ETF.' }), daten).verstoesse[0]).toMatch(/Anlage/);
  });
  it('Steuerbefunde tragen den Hinweis, auch wenn das Modell ihn vergisst', () => {
    const a = antwort({ befunde: [{ titel: 'USt', was: 'Termin 12.10.', bedeutung: 'Geld bereithalten.', typ: 'hinweis', schwere: 'mittel', bereich: 'steuern', steuerhinweis: true, quelle: [] }] });
    expect(a.befunde[0].bedeutung.endsWith(STEUER_SATZ)).toBe(true);
  });
  it('Pfade: Arrays über Index, Werkzeuge nur wenn gelaufen', () => {
    expect(pfadDa(daten, 'steuern.termine_60_tage.0.datum')).toBe(true);
    expect(pfadDa(daten, 'steuern.termine_60_tage[0]')).toBe(true);
    expect(pfadDa(daten, 'werkzeug:rechne')).toBe(false);
    expect(pfadDa(daten, 'werkzeug:rechne', ['rechne'])).toBe(true);
  });
  it('kaputtes JSON wird zur gültigen, leeren Form statt zum Absturz', () => {
    const a = normalisiere(null, 'tagescheck');
    expect(a).toMatchObject({ modus: 'tagescheck', status: 'beobachten', befunde: [], vorschlaege: [] });
  });
});

describe('Freigabe-Liste', () => {
  const v = antwort().vorschlaege[0];
  it('ein offener Vorschlag wird aktualisiert, nicht verdoppelt', () => {
    const erst = vorschlaegeMischen([], [v], 'b1', '2026-09-20T08:00:00Z');
    const dann = vorschlaegeMischen(erst.liste, [{ ...v, begruendung: 'neu' }], 'b2', '2026-09-24T08:00:00Z');
    expect(dann.liste).toHaveLength(1);
    expect(dann).toMatchObject({ neu: 0, aktualisiert: 1 });
    expect(dann.liste[0].begruendung).toBe('neu');
  });
  it('anders formuliert, gleiche Sache: wird zusammengeführt', () => {
    const a = { ...v, art: 'daten', titel: 'Controlling-Zahlen für August nachtragen', dedup_schluessel: 'daten:controlling-august:2026-08' };
    const b = { ...v, art: 'daten', titel: 'August im Controlling nachtragen und Kontostände aktualisieren', dedup_schluessel: 'daten:controlling-aug-kontostaende:2026-09' };
    const c = { ...v, art: 'daten', titel: 'Haushalts-Kontoauszüge importieren', dedup_schluessel: 'daten:haushalt-import:2026-09' };
    const m = vorschlaegeMischen(vorschlaegeMischen([], [a], 'b1', '2026-09-24T08:00:00Z').liste, [b, c], 'b2', '2026-09-24T09:00:00Z');
    expect(m).toMatchObject({ neu: 1, aktualisiert: 1 });
    expect(m.liste.map(x => x.titel)).toEqual([b.titel, c.titel]);
  });
  it('abgelehnt kommt 30 Tage nicht wieder, danach schon', () => {
    const abgelehnt: ChefVorschlag = { ...vorschlaegeMischen([], [v], 'b1', '2026-09-01T08:00:00Z').liste[0], status: 'abgelehnt', entschieden: '2026-09-01T09:00:00Z' };
    expect(vorschlaegeMischen([abgelehnt], [v], 'b2', '2026-09-20T08:00:00Z').neu).toBe(0);
    expect(vorschlaegeMischen([abgelehnt], [v], 'b3', '2026-10-05T08:00:00Z').neu).toBe(1);
  });
});

describe('Zeitplan', () => {
  const termine = [{ datum: '2026-10-12' }];
  const stand = (over = {}) => ({ ...leererStand(), ...over });
  it('dritter Werktag: Oktober 2026 → 05.10. (03.10. Feiertag, Wochenende)', () => {
    expect(dritterWerktag('2026-10')).toBe('2026-10-05');
  });
  it('Monatsabschluss geht vor, danach Steuercheck, Wochenreview, Tagescheck', () => {
    const j = new Date('2026-10-05T09:00:00');
    expect(faelligerModus(stand(), '2026-10-05', 1, 9, termine, j)?.modus).toBe('monatsabschluss');
    const mitAbschluss = stand({ berichte: [{ modus: 'monatsabschluss', monat: '2026-09' }] });
    expect(faelligerModus(mitAbschluss, '2026-10-05', 1, 9, termine, j)?.modus).toBe('steuercheck');
    expect(faelligerModus({ ...mitAbschluss, letzte: { steuercheck: '2026-10-02T08:00:00Z' } }, '2026-10-05', 1, 9, termine, j)?.modus).toBe('wochenreview');
    expect(faelligerModus({ ...mitAbschluss, letzte: { steuercheck: '2026-10-02T08:00:00Z', wochenreview: '2026-10-05T08:00:00Z' } }, '2026-10-05', 1, 9, termine, j)).toBeNull();
  });
  it('solange ein Lauf läuft, plant der Takt keinen zweiten', () => {
    const s = stand({ versuche: { wochenreview: '2026-09-24T09:00:00' } });
    expect(faelligerModus(s, '2026-09-24', 4, 9, [], new Date('2026-09-24T09:05:00'))).toBeNull();
    expect(faelligerModus({ ...s, letzte: { wochenreview: '2026-09-24T09:03:00' } }, '2026-09-24', 4, 9, [], new Date('2026-09-24T09:05:00'))).toBeNull(); // Wochenreview ersetzt den Tagescheck
    expect(faelligerModus(s, '2026-09-24', 4, 9, [], new Date('2026-09-24T09:20:00'))?.modus).toBe('tagescheck');
  });
  it('nach dem 20. wird der Vormonat nicht mehr abgeschlossen', () => {
    expect(faelligerModus(stand(), '2026-09-24', 4, 9, [], new Date('2026-09-24T09:00:00'))?.modus).toBe('wochenreview');
  });
  it('„abschluss“ außerhalb des Monatsabschlusses wird zur Klärung', () => {
    const a = normalisiere({ vorschlaege: [{ titel: 'Ziel neu setzen', art: 'abschluss' }] }, 'wochenreview');
    expect(a.vorschlaege[0].art).toBe('klaeren');
  });
  it('nachts nichts, und ein gescheiterter Versuch sperrt eine Stunde', () => {
    expect(faelligerModus(stand(), '2026-09-24', 4, 6, [], new Date('2026-09-24T06:00:00'))).toBeNull();
    const s = stand({ berichte: [{ modus: 'monatsabschluss', monat: '2026-08' }], letzte: { wochenreview: '2026-09-21T08:00:00Z' }, versuche: { tagescheck: '2026-09-24T08:30:00' } });
    expect(faelligerModus(s, '2026-09-24', 4, 9, [], new Date('2026-09-24T09:00:00'))).toBeNull();
    expect(faelligerModus(s, '2026-09-24', 4, 10, [], new Date('2026-09-24T09:45:00'))?.modus).toBe('tagescheck');
  });
  it('Takt: nur echte Haushalte, je Haushalt ein Mitglied', () => {
    const m = haushalteAus([{ speicher: 'malin', haushalt: 'kevin-malin' }, { speicher: 'kevin', haushalt: 'kevin-malin' }, { speicher: 'testmitglied', haushalt: 'test' }, { speicher: 'x', haushalt: 'a-probe' }, { speicher: 'gast' }]);
    expect(Array.from(m.entries())).toEqual([['kevin-malin', 'kevin']]);
  });
});
