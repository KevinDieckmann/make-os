// ─── Fixkosten bearbeiten, Rhythmus klären, Umstufen fix ↔ variabel (27.09.) ──
// Malins Rückmeldung nach ihrem Test. Erfundene Beträge, fester Stichtag.
import { describe, it, expect } from 'vitest';
import type { Buchung } from '../lib/finanzen/haushalt/typen';
import { rhythmus, rhythmusVorschlag, posten, postenProMonat, sockel, wiederkehrend } from '../lib/finanzen/haushalt/fixkosten';
import { einordnen, summen, type KatName } from '../lib/finanzen/haushalt/einordnung';
import { istWert } from '../lib/finanzen/haushalt/kennzahlen';
import { TURNUS, TURNUS_REIHE, proMonat, turnusAus, turnusName } from '../lib/finanzen/haushalt/regeln';
import { opsAnwenden, sauberBuchung } from '../lib/finanzen/haushalt/speicher';
import { vollMonate } from '../lib/finanzen/haushalt/monat';

const HEUTE = '2026-09-27';
const M = vollMonate(12, 0, HEUTE); // neuester zuerst: 2026-08 … 2025-09
const tag = (i: number, t = '05') => `${M[i]}-${t}`;
let n = 0;
function b(teil: Partial<Buchung> & { betrag: number; datum: string }): Buchung {
  n++;
  return {
    id: `b${n}`, stand: 1, konto_id: 'k1', beschreibung: teil.empfaenger ?? 'X', empfaenger: 'X', kategorie_id: null,
    ist_umbuchung: false, ist_fixkosten: false, turnus: 'monatlich', einheit: 'privat', zeilen_hash: null,
    notiz: null, import_id: null, erfasst_von: null, geaendert: '2026-09-27T00:00:00Z', ...teil,
  };
}
const kat: KatName = id => (id === 'wohnen' ? 'Miete & Wohnen' : id === 'abo' ? 'Abos & Verträge' : '');

describe('Rhythmus-Vorschlag aus den Abständen', () => {
  it('erkennt monatlich, vierteljährlich, halbjährlich, jährlich', () => {
    expect(rhythmusVorschlag(['2026-01', '2026-02', '2026-03', '2026-04'])).toMatchObject({ turnus: 'monatlich', sicher: true, abstand: 1 });
    expect(rhythmusVorschlag(['2025-10', '2026-01', '2026-04', '2026-07'])).toMatchObject({ turnus: 'quartal', sicher: true, abstand: 3 });
    expect(rhythmusVorschlag(['2025-12', '2026-06'])).toMatchObject({ turnus: 'halbjahr', sicher: true, abstand: 6 });
    expect(rhythmusVorschlag(['2025-03', '2026-03'])).toMatchObject({ turnus: 'jahr', sicher: true, abstand: 12 });
  });
  it('kein Muster → „unregelmäßig“ und unsicher; eine Zahlung → kein Abstand', () => {
    const v = rhythmusVorschlag(['2025-09', '2025-10', '2026-03', '2026-04', '2026-10']);
    expect(v.turnus).toBe('unregelmaessig'); expect(v.sicher).toBe(false); expect(v.text).toMatch(/kein klares Muster/);
    expect(rhythmusVorschlag(['2026-05'])).toMatchObject({ turnus: 'unregelmaessig', sicher: false, abstand: null });
    expect(rhythmusVorschlag([])).toMatchObject({ turnus: 'unregelmaessig', sicher: false });
  });
  it('Abstände 1 · 5 · 1 · 6 sind kein Quartal mehr (Schnitt 3,25 täuschte)', () => {
    expect(rhythmus(['2025-09', '2025-10', '2026-03', '2026-04', '2026-10'])).toBeNull();
    expect(rhythmus(['2025-10', '2026-01', '2026-04'])).toBe('quartal');
    expect(rhythmus(['2026-01', '2026-01', '2026-02'])).toBe('monatlich'); // doppelter Monat zählt einmal
  });
  it('Turnus-Tabelle: fünf Werte, jeder benannt, Fremdes fällt auf monatlich', () => {
    expect(TURNUS_REIHE).toEqual(['monatlich', 'quartal', 'halbjahr', 'jahr', 'unregelmaessig']);
    for (const t of TURNUS_REIHE) { expect(TURNUS[t].name).toBeTruthy(); expect(turnusAus(t)).toBe(t); }
    expect(turnusAus('vierteljährlich')).toBe('monatlich');
    expect(turnusName('halbjahr')).toBe('halbjährlich');
    expect(proMonat(60000, 'halbjahr')).toBe(10000);
  });
});

describe('Posten: Monatswert, Kennungen, „unklar“ nur bis jemand klärt', () => {
  it('unregelmäßig rechnet Σ / Fenstermonate statt Mittel × Faktor', () => {
    expect(postenProMonat([14900, 14900, 14900], 'unregelmaessig', 12)).toBe(44700 / 12);
    expect(postenProMonat([18000, 18000], 'quartal', 12)).toBe(6000);
    expect(postenProMonat([], 'monatlich', 12)).toBe(0);
  });
  it('Posten trägt Buchungs-Kennungen, Kategorie/Konto der jüngsten und einen Vorschlag', () => {
    const fix = [0, 3, 6, 9].map(i => b({ empfaenger: 'Versicherung Beispiel', betrag: -18000, datum: tag(i), ist_fixkosten: true, turnus: 'quartal', kategorie_id: i === 0 ? 'neu' : 'alt', konto_id: i === 0 ? 'k-neu' : 'k1' }));
    const [p] = posten(fix, 12);
    expect(p.ids).toHaveLength(4); expect(p.kategorie_id).toBe('neu'); expect(p.konto_id).toBe('k-neu');
    expect(p.vorschlag).toBe('quartal'); expect(p.unsicher).toBe(false); expect(p.proMonat).toBe(6000);
  });
  it('unklare Abstände → unsicher; turnus_geklaert auf einer Zeile → geklärt, Turnus gilt', () => {
    const wirr = [0, 1, 6, 7, 11].map(i => b({ empfaenger: 'Unklarer Dienst', betrag: -14900, datum: tag(i), ist_fixkosten: true }));
    expect(posten(wirr, 12)[0]).toMatchObject({ unsicher: true, geklaert: false, vorschlag: 'unregelmaessig' });
    const geklaert = wirr.map(x => ({ ...x, turnus: 'unregelmaessig' as const, turnus_geklaert: true }));
    const p = posten(geklaert, 12)[0];
    expect(p).toMatchObject({ unsicher: false, geklaert: true, turnus: 'unregelmaessig' });
    expect(p.proMonat).toBe(5 * 14900 / 12);
    // Eine einzelne Zahlung ist nie „unklar“ — es gibt keinen Abstand zu bewerten.
    expect(posten([b({ empfaenger: 'Kfz-Steuer', betrag: -19000, datum: tag(4), ist_fixkosten: true, turnus: 'jahr' })], 12)[0].unsicher).toBe(false);
  });
  it('wiederkehrend: gleiche Beträge ohne Muster bleiben als „unklar“ sichtbar, geklärt verschwindet der Chip', () => {
    const liste = [0, 1, 6, 7, 11].map(i => b({ empfaenger: 'Unklarer Dienst', betrag: -14900, datum: tag(i) }));
    const [w] = wiederkehrend(liste, kat, HEUTE);
    expect(w).toMatchObject({ name: 'Unklarer Dienst', unsicher: true, vorschlag: null, bereitsMarkiert: false });
    const [g] = wiederkehrend(liste.map(x => ({ ...x, turnus: 'halbjahr' as const, turnus_geklaert: true })), kat, HEUTE);
    expect(g).toMatchObject({ unsicher: false, turnus: 'halbjahr' });
    // Zwei kleine Zahlungen ohne Muster sind Rauschen, nicht Fixkosten-Kandidaten.
    expect(wiederkehrend([0, 8].map(i => b({ empfaenger: 'Kiosk', betrag: -500, datum: tag(i) })), kat, HEUTE)).toHaveLength(0);
  });
});

describe('Umstufen fix ↔ variabel wirkt in Einordnung, Summen, Sockel, Ist gegen Soll', () => {
  const miete = M.map(m => b({ empfaenger: 'Musterwohnung', betrag: -125000, datum: `${m}-03`, ist_fixkosten: true, kategorie_id: 'wohnen' }));
  const abo = M.map(m => b({ empfaenger: 'Streamdienst', betrag: -1299, datum: `${m}-05`, ist_fixkosten: true, kategorie_id: 'abo' }));
  const alle = [...miete, ...abo];
  const nurAbo = alle.map(x => (x.empfaenger === 'Streamdienst' ? { ...x, ist_fixkosten: false, stand: 2 } : x));
  it('nur dieser Posten wechselt — die Miete bleibt fix', () => {
    expect(einordnen(abo[0], kat)).toBe('ausgabe-fix');
    expect(einordnen({ ...abo[0], ist_fixkosten: false }, kat)).toBe('ausgabe-variabel');
    const vorher = summen(alle.filter(x => x.datum.startsWith(M[0])), kat), nachher = summen(nurAbo.filter(x => x.datum.startsWith(M[0])), kat);
    expect(vorher).toMatchObject({ ausFix: 126299, ausVar: 0 });
    expect(nachher).toMatchObject({ ausFix: 125000, ausVar: 1299, aus: 126299 });
  });
  it('Sockel verliert den Posten; „Ausgaben“ unter Ist gegen Soll bleiben gleich (fix + variabel = Ausgaben)', () => {
    const s1 = sockel(alle, [], HEUTE, kat), s2 = sockel(nurAbo, [], HEUTE, kat);
    expect(s1.posten.map(p => p.name)).toEqual(['Musterwohnung', 'Streamdienst']);
    expect(s2.posten.map(p => p.name)).toEqual(['Musterwohnung']);
    expect(s1.ausBuchungen - s2.ausBuchungen).toBe(1299);
    expect(istWert('Ausgaben', alle, M[0], kat)).toBe(istWert('Ausgaben', nurAbo, M[0], kat));
  });
  it('Rückweg: wieder fix, per Patch mit Stand — veralteter Stand wird abgelehnt', () => {
    const stamm = { konten: [{ id: 'k1', stand: 1, name: 'K', inhaber: null, einheit: 'privat' as const, iban_suffix: null, bank: null, waehrung: 'EUR', aktiv: true }], kategorien: [{ id: 'abo', stand: 1, name: 'Abos & Verträge', typ: 'ausgabe' as const, sortierung: 1, monatsbudget: null }], regeln: [], aliase: {} };
    const saeubern = (r: Record<string, unknown>) => ({ ...sauberBuchung(r, stamm), geaendert: 'x' });
    const zeilen = nurAbo.filter(x => x.empfaenger === 'Streamdienst');
    const ops = zeilen.map(x => ({ op: 'upsert' as const, stand: x.stand, eintrag: { ...x, ist_fixkosten: true, turnus: 'monatlich', turnus_geklaert: true } }));
    const e = opsAnwenden<Buchung>(zeilen, ops, saeubern, 'x', true);
    expect(e.ok).toBe(true);
    if (e.ok) { expect(e.liste!.every(x => x.ist_fixkosten && x.turnus_geklaert === true && x.stand === 3)).toBe(true); }
    const alt = opsAnwenden<Buchung>(zeilen, [{ ...ops[0], stand: 1 }], saeubern, 'x', true);
    expect(alt.ok).toBe(false); if (!alt.ok) expect(alt.status).toBe(409);
    // Von außen kommt nur `true` durch — alles andere lässt das Feld weg.
    expect('turnus_geklaert' in sauberBuchung({ ...zeilen[0], turnus_geklaert: 'ja' } as unknown as Record<string, unknown>, stamm)).toBe(false);
    expect(sauberBuchung({ ...zeilen[0], turnus: 'halbjahr' } as unknown as Record<string, unknown>, stamm).turnus).toBe('halbjahr');
  });
});
