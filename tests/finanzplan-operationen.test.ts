// ─── Finanzplanung jetzt — Operationen, Pfade, Prüfung, leeres Dokument ──────
import { describe, it, expect } from 'vitest';
import { wendeOperationenAn, pfadTeile, lies, setze, neuerStand, pruefeDokument, leeresDokument, OperationUngueltig, nettoTabellePlatzhalter } from '../lib/finanzen/plan/operationen';
import { parseBetrag, eur, faelligeZahl, zeileName, achse, heuteIndex, tageIm, planMonatAus, bereichVon } from '../lib/finanzen/plan/hilfen';
import { rechneUG, rechnePrivat, kennzahlen } from '../lib/finanzen/rechenkern';

const HEUTE = '2026-09-27';
const JETZT = '2026-09-27T10:00:00.000Z';
const basis = () => {
  const d = leeresDokument(HEUTE);
  d.privatBudget.push({ id: 'p.b.a', name: 'Lebensmittel', einheit: 'privat', gruppe: 'Flexibel', soll: 400, typ: 'flex' });
  d.buchungen.push({ id: 'b1', d: '2026-03-05', b: -20, n: 'Rewe', k: 'gemeinsam', z: 'x.offen' }, { id: 'b2', d: '2026-04-05', b: -30, n: 'REWE', k: 'kevin', z: 'x.offen' });
  d.fokus.schritte.push({ id: 'st1', text: 'Konto eintragen', wer: 'kevin', bis: HEUTE, erledigt: false });
  return d;
};

describe('Pfade', () => {
  it('erlaubt nur die änderbaren Bereiche, nie Server-Felder oder Prototyp-Tricks', () => {
    expect(pfadTeile('/plan/p.b.a:3')).toEqual(['plan', 'p.b.a:3']);
    expect(() => pfadTeile('/stand')).toThrow(OperationUngueltig);
    expect(() => pfadTeile('/meta/x')).toThrow(OperationUngueltig);
    expect(() => pfadTeile('/protokoll/-')).toThrow(OperationUngueltig);
    expect(() => pfadTeile('/irgendwas')).toThrow(OperationUngueltig);
    expect(() => pfadTeile('/plan/__proto__')).toThrow(OperationUngueltig);
    expect(() => pfadTeile('plan/x')).toThrow(OperationUngueltig);
  });
  it('lies/setze: Objekte, Listen per Kennung, anhängen, entfernen', () => {
    const d = basis() as unknown as Record<string, unknown>;
    expect(lies(d, ['fokus', 'schritte', 'id=st1', 'text'])).toBe('Konto eintragen');
    setze(d, ['fokus', 'schritte', 'id=st1', 'erledigt'], true);
    expect(lies(d, ['fokus', 'schritte', 'id=st1', 'erledigt'])).toBe(true);
    setze(d, ['fokus', 'schritte', '-'], { id: 'st2', text: 'Neu', wer: 'malin', bis: HEUTE, erledigt: false });
    expect((lies(d, ['fokus', 'schritte']) as unknown[]).length).toBe(2);
    setze(d, ['fokus', 'schritte', 'id=st1'], undefined);
    expect(lies(d, ['fokus', 'schritte', 'id=st1'])).toBeUndefined();
    expect(() => setze(d, ['fokus', 'schritte', 'id=gibtsnicht', 'text'], 'x')).toThrow(OperationUngueltig);
  });
});

describe('wendeOperationenAn()', () => {
  it('Planzelle setzen: Wert, Meta (wer/wann) und Protokoll mit lesbarem Feld; das Original bleibt unberührt', () => {
    const d = basis();
    const r = wendeOperationenAn(d, [{ pfad: '/plan/p.b.a:3', alt: 400, neu: 450, feld: 'Lebensmittel · Dez 26' }], 'malin', JETZT);
    expect(r.dokument.plan['p.b.a:3']).toBe(450);
    expect(r.dokument.meta['p.b.a:3']).toEqual({ wer: 'malin', wann: JETZT });
    expect(r.meta['p.b.a:3']).toEqual({ wer: 'malin', wann: JETZT });
    expect(r.protokoll[0]).toMatchObject({ wer: 'malin', feld: 'Lebensmittel · Dez 26', alt: '400', neu: '450' });
    expect(r.dokument.protokoll[0].feld).toBe('Lebensmittel · Dez 26');
    expect(d.plan['p.b.a:3']).toBeUndefined();
    expect(r.nachladen).toBe(false);
  });
  it('Zelle zurücksetzen (neu fehlt) entfernt Wert und Meta', () => {
    const d = basis(); d.plan['p.b.a:3'] = 450; d.meta['p.b.a:3'] = { wer: 'kevin', wann: JETZT };
    const r = wendeOperationenAn(d, [{ pfad: '/plan/p.b.a:3', alt: 450 }], 'kevin', JETZT);
    expect('p.b.a:3' in r.dokument.plan).toBe(false);
    expect(r.dokument.meta['p.b.a:3']).toBeUndefined();
    expect(r.meta['p.b.a:3']).toBeNull();
    expect(r.protokoll[0].neu).toBe('zurückgesetzt');
  });
  it('Regel merken wirkt rückwirkend auf alle Buchungen des Empfängers und verlangt Nachladen', () => {
    const r = wendeOperationenAn(basis(), [{ pfad: '/regeln/Rewe', neu: 'p.b.a', feld: 'Regel Rewe' }], 'kevin', JETZT);
    expect(r.dokument.regeln.rewe).toBe('p.b.a');
    expect(r.dokument.buchungen.map(b => b.z)).toEqual(['p.b.a', 'p.b.a']);
    expect(r.nachladen).toBe(true);
    expect(r.protokoll[0].neu).toMatch(/2 Buchungen/);
  });
  it('Szenario: aktiv nur auf ein vorhandenes; das letzte Szenario lässt sich nicht löschen', () => {
    const d = basis();
    expect(() => wendeOperationenAn(d, [{ pfad: '/aktiv', neu: 'gibtsnicht' }], 'kevin', JETZT)).toThrow(/Szenario/);
    expect(() => wendeOperationenAn(d, [{ pfad: '/szenarien/id=basis' }], 'kevin', JETZT)).toThrow(/letzte Szenario/);
    const r = wendeOperationenAn(d, [{ pfad: '/szenarien/-', neu: { ...d.szenarien[0], id: 's2', name: 'Kopie' } }, { pfad: '/aktiv', neu: 's2' }], 'kevin', JETZT);
    expect(r.dokument.aktiv).toBe('s2');
    const r2 = wendeOperationenAn(r.dokument, [{ pfad: '/szenarien/id=s2' }], 'kevin', JETZT);
    expect(r2.dokument.aktiv).toBe('basis'); // gelöschtes Szenario fällt auf das erste zurück
  });
  it('lehnt Unsinn ab und schreibt dann nichts: zu viele Schritte, unendliche Zahl, zu langer Text', () => {
    const d = basis();
    expect(() => wendeOperationenAn(d, [], 'kevin', JETZT)).toThrow(OperationUngueltig);
    expect(() => wendeOperationenAn(d, Array.from({ length: 501 }, (_, i) => ({ pfad: `/plan/p.b.a:${i}`, neu: 1 })), 'kevin', JETZT)).toThrow(/Höchstens/);
    expect(() => wendeOperationenAn(d, [{ pfad: '/plan/p.b.a:1', neu: Number.POSITIVE_INFINITY }], 'kevin', JETZT)).toThrow(/Zahl/);
    expect(() => wendeOperationenAn(d, [{ pfad: '/notizen/p.b.a:1', neu: 'x'.repeat(5000) }], 'kevin', JETZT)).toThrow(/zu lang/);
    expect(() => wendeOperationenAn(d, [{ pfad: '/plan/p.b.a:1', neu: 1 }, { pfad: '/stand', neu: 'x' }], 'kevin', JETZT)).toThrow(OperationUngueltig);
  });
  it('Protokoll bleibt auf 500 Einträge begrenzt, jüngste zuerst', () => {
    const d = basis(); d.protokoll = Array.from({ length: 499 }, (_, i) => ({ wer: 'kevin', wann: JETZT, feld: `alt${i}`, alt: '', neu: '' }));
    const r = wendeOperationenAn(d, [{ pfad: '/plan/p.b.a:1', neu: 1, feld: 'eins' }, { pfad: '/plan/p.b.a:2', neu: 2, feld: 'zwei' }], 'kevin', JETZT);
    expect(r.dokument.protokoll).toHaveLength(500);
    expect(r.dokument.protokoll[0].feld).toBe('zwei');
    expect(r.dokument.protokoll[1].feld).toBe('eins');
  });
});

describe('neuerStand()', () => {
  it('ist immer größer als der alte Stand — auch nach einem Datum und in derselben Millisekunde', () => {
    const t = new Date('2026-09-27T12:00:00.000Z');
    expect(neuerStand('2026-09-27', t)).toBe('2026-09-27T12:00:00.000Z');
    expect(neuerStand('2026-09-27T12:00:00.000Z', t)).toBe('2026-09-27T12:00:00.001Z');
    expect(neuerStand('2030-01-01T00:00:00.000Z', t) > '2030-01-01T00:00:00.000Z').toBe(true);
    expect(neuerStand(undefined, t)).toBe(t.toISOString());
  });
});

describe('pruefeDokument() und leeresDokument()', () => {
  it('nimmt ein leeres Dokument an und rechnet es ohne Fehler durch', () => {
    const d = leeresDokument(HEUTE);
    const p = pruefeDokument(JSON.parse(JSON.stringify(d)));
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const ug = rechneUG(p.dokument, p.dokument.szenarien[0]);
    const kz = kennzahlen(ug, rechnePrivat(p.dokument, ug, p.dokument.szenarien[0]));
    expect(Number.isFinite(kz.gruppeDez28)).toBe(true);
    expect(nettoTabellePlatzhalter(d)).toBe(true);
    expect(d.monate[0]).toBe('Okt 26'); expect(d.historie).toHaveLength(9);
  });
  it('lehnt falsche Version, fehlende Szenarien/Annahmen und eine falsche Zeitachse ab', () => {
    const d = leeresDokument(HEUTE);
    expect(pruefeDokument({ ...d, version: 2 })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, szenarien: [] })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, annahmen: null })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, annahmen: { ...d.annahmen, ust: 'neunzehn' } })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, annahmen: { ...d.annahmen, nettoTabelle: [] } })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, historie: d.historie.slice(1) })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, monate: d.monate.slice(0, 3) })).toMatchObject({ ok: false });
    expect(pruefeDokument({ ...d, szenarien: [{ id: 's', name: 'kaputt' }] })).toMatchObject({ ok: false });
    expect(pruefeDokument('text')).toMatchObject({ ok: false });
  });
  it('ergänzt fehlende Nebenlisten und setzt aktiv auf ein vorhandenes Szenario', () => {
    const d = leeresDokument(HEUTE);
    const roh = { version: 3, szenarien: d.szenarien, annahmen: d.annahmen, monate: d.monate, historie: d.historie, aktiv: 'weg' };
    const p = pruefeDokument(roh);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.dokument.aktiv).toBe('basis');
    expect(p.dokument.buchungen).toEqual([]); expect(p.dokument.plan).toEqual({}); expect(p.dokument.check.punkte).toEqual([]);
    expect(p.dokument.einstellungen.heute).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('Helfer', () => {
  it('parseBetrag versteht deutsch und englisch', () => {
    expect(parseBetrag('1.234,50')).toBe(1234.5);
    expect(parseBetrag('1234.50')).toBe(1234.5);
    expect(parseBetrag('1.234')).toBe(1234);
    expect(parseBetrag('-25,9 €')).toBe(-25.9);
    expect(parseBetrag('')).toBeNull();
    expect(Number.isNaN(parseBetrag('abc') as number)).toBe(true);
  });
  it('eur formatiert deutsch und lässt Leeres leer', () => {
    expect(eur(1234.5)).toBe('1.235'); expect(eur(1234.5, 2)).toBe('1.234,50'); expect(eur(null)).toBe(''); expect(eur(NaN)).toBe('');
  });
  it('Zeitachse und Zähler', () => {
    const d = basis();
    expect(achse(d)).toHaveLength(36); expect(heuteIndex(d)).toBe(8); expect(tageIm(1)).toBe(28); expect(planMonatAus(8, d)).toBe(1); expect(planMonatAus(10, d)).toBe(2);
    d.posten.push({ id: 'p1', art: 'rechnung', einheit: 'privat', name: 'Strom', betrag: 10, status: 'offen', faellig: '2026-09-30' }, { id: 'p2', art: 'rechnung', einheit: 'privat', name: 'Später', betrag: 10, status: 'offen', faellig: '2026-12-01' }, { id: 'p3', art: 'konto', einheit: 'privat', name: 'Konto', betrag: null, status: 'eintragen', faellig: '2026-09-01' });
    expect(faelligeZahl(d)).toBe(1);
    expect(zeileName(d, 'p.b.a')).toBe('Lebensmittel'); expect(zeileName(d, 'x.offen')).toBe('Noch nicht zugeordnet'); expect(zeileName(d, 'ug.ob')).toBe('One Banking');
    expect(bereichVon('toepfe')).toBe('planen');
  });
});
