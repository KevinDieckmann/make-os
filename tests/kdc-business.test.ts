// ─── Selbstständigkeit wieder im Business (02.11.) ───────────────────────────────────────────────
// Kevin 02.11.: die Selbstständigkeit (kdc) gehört mit Buchhaltung, Business-Index, Monatsabschluss, Finanzplanung, Gewerbe- und Umsatzsteuer
// wieder ins Business — die Einkommensteuer bleibt gemeinsam und privat. Plattform-Regel: NICHT fest eingebaut, sondern über die Instanz-
// Einstellung `NEXT_PUBLIC_MAKE_OS_EINHEITEN` `{"kdc":{"bereich":"business"}}` (lib/einheiten.ts `bereichVon`). Dieser Test setzt sie; ohne die
// Variable rechnen alle übrigen Tests wie bisher (finanzplan-regression, selbst-privat*, Gegenstück tests/kdc-business-ohne.test.ts).
// Erfundene Zahlen und Namen — nie echte.
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => { process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { bereich: 'business' } }); });

import type { FinanzDaten } from '../lib/finanzen/rechenkern';
import { rechneMit, auswertung } from '../lib/finanzen/szenarien';
import { businessSicht, businessPfadErlaubt, SELBST_PRIVAT_WERTE } from '../lib/finanzen/plan/sicht';
import { schreibeAlsBusiness } from '../lib/finanzen/plan/business-schreiben';
import { blaetterFuer } from '../lib/finanzen/plan/hilfen';
import { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN, bereichVon, istBusinessGesellschaft, selbstImBusiness, selbstArbeitsEinheit, privatArbeitsEinheit, finanzOrtName } from '../lib/einheiten';
import { DARLEHEN_BUSINESS } from '../lib/finanzen/darlehen';
import { kontenIstAus, sichtbarIn, type RegisterKonto } from '../lib/finanzen/konten/register';
import { STANDARD_STEUERN, prognose, steuernNurBusiness, type SteuerEinstellungen } from '../lib/steuern/rechnen';
import { arbeitsPruefer, sichtPruefer } from '../lib/zeitmessung/einheiten';
import type { FokusBlock } from '../lib/zeitmessung/modell';
import { gespeicherterSpace, spaceVonAufgabe } from '../lib/make-one/space-regeln';
import { gesamtAbMonat } from '../lib/business/eroeffnung';
import { abschlussFirmen } from '../lib/business/speicher';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

const SELBST = 'kdc' as const;

/** Plan mit privaten Merkmalen (Gehalt, Haushalt, Schulden) und Werten der Selbstständigkeit. */
function plan(): FinanzDaten {
  const d = planFix(14000);
  const ps = arbeitsplanFix();
  ps.bausteine.push({ id: 'bk', art: 'umsatz', einheit: 'kdc', name: 'Selbstauftrag', kunde: 'Beispielkunde', preis: 9345.67, menge: 1, rhythmus: 'monatlich', start: 1, an: true });
  return {
    ...d, planszenarien: [ps], arbeitsplan: ps.id,
    privatBudget: [...d.privatBudget, { id: 'p.b.geheim', name: 'Geheimmiete', einheit: 'privat', gruppe: 'Fixkosten', soll: 7777.77, typ: 'fix' }],
    privatEinnahmen: [{ id: 'p.e.geheim', name: 'Geheimjob', einheit: 'privat', gruppe: 'Einnahmen', soll: 1234, ab: 1 }],
    privatSchulden: [{ id: 'p.d.geheim', name: 'Geheimkredit', einheit: 'privat', gruppe: 'Schulden', soll: 99, ab: 1 }],
    selbst: { ...d.selbst, posten: [{ id: 'sp-s', name: 'Selbsthonorar', art: 'einnahme', betrag: 3456.78, status: 'bezahlt' }], lohnVorPlan: 8765.43, vorsorge: 4321.09 },
    darlehen: [{ id: 'dl-s', name: 'Darlehen an die Selbstständigkeit', geber: 'privat', nehmer: 'kdc', betrag: 1000, aus: 0, zurueck: 4 }],
    plan: { ...d.plan, 'kdc.est:3': 111.11, 'kdc.konto:2': 222.22 },
  };
}

describe('Instanz-Einstellung: die Selbstständigkeit steht im Business', () => {
  it('EINE Zuordnung — bereichVon, Business-Gesellschaften, Abschluss, Darlehen', () => {
    expect(selbstImBusiness()).toBe(true);
    expect(bereichVon(SELBST)).toBe('business');
    expect(BUSINESS_GESELLSCHAFTEN).toContain(SELBST);
    expect(PRIVAT_GESELLSCHAFTEN).not.toContain(SELBST);
    expect(abschlussFirmen('business')).toContain(SELBST);
    expect(abschlussFirmen('privat')).toEqual([]);       // die Karte unter Privat verschwindet (keine Firmen)
    expect(DARLEHEN_BUSINESS).toContain(SELBST);
  });
  it('0-Punkt: Gesamt zählt erst ab dem Stichtag, wenn auch die Selbstständigkeit einen hat', () => {
    const e = (firma: string, stichtag: string) => ({ id: `er-${firma}`, firma, stichtag, kontostand: 1, forderungen: [], verbindlichkeiten: [], am: '2026-11-02T10:00:00.000Z', von: 'x' });
    const ohne = { ug: e('ug', '2026-06-01'), kdv: e('kdv', '2026-06-01') } as unknown as Parameters<typeof gesamtAbMonat>[0];
    expect(gesamtAbMonat(ohne)).toBeNull();
    expect(gesamtAbMonat({ ...ohne, kdc: e('kdc', '2026-06-01') } as unknown as Parameters<typeof gesamtAbMonat>[0])).toBe('2026-06');
  });
});

describe('Finanzplanung — Sicht Business', () => {
  const voll = plan();
  const b = businessSicht(voll);
  const text = JSON.stringify(b);
  it('enthält die Selbstständigkeit (Posten, Kontostart, Bausteine, Blatt)', () => {
    expect(b.selbst.posten.map(p => p.name)).toEqual(['Selbsthonorar']);
    expect(b.selbst.kontoStart).toBe(voll.selbst.kontoStart);
    expect(b.planszenarien?.[0].bausteine.some(x => x.einheit === 'kdc')).toBe(true);
    expect(b.plan['kdc.konto:2']).toBe(222.22);
    expect(blaetterFuer('business').map(x => x.id)).toContain('selbst');
  });
  it('Sicht Business bekommt nichts aus Privat (Haushalt, Gehalt, Schulden, Einkommensteuer, Vorsorge)', () => {
    for (const geheim of ['Geheimmiete', 'Geheimjob', 'Geheimkredit', '7777.77', '8765.43', '4321.09', '111.11']) expect(text).not.toContain(geheim);
    expect('kdc.est:3' in b.plan).toBe(false);
    expect(b.selbst.lohnVorPlan).toBeUndefined();
    expect(SELBST_PRIVAT_WERTE.has('kdc.est')).toBe(true);
  });
  it('Business darf die Selbstständigkeit schreiben — aber nie Privates', () => {
    expect(businessPfadErlaubt('/plan/kdc.konto:3', voll, 5)).toBeNull();
    expect(businessPfadErlaubt('/selbst/kontoStart', voll, 6000)).toBeNull();
    expect(businessPfadErlaubt('/plan/kdc.est:3', voll, 5)).not.toBeNull();
    expect(businessPfadErlaubt('/selbst/lohnVorPlan', voll, 1)).not.toBeNull();
    expect(businessPfadErlaubt('/privatBudget/id=p.b.geheim/soll', voll, 1)).not.toBeNull();
    const ok = schreibeAlsBusiness(voll, [{ pfad: '/selbst/kontoStart', neu: 6000 }], 'pruefer', '2026-11-02T10:00:00.000Z');
    expect(ok.ok).toBe(true);
    const nein = schreibeAlsBusiness(voll, [{ pfad: '/selbst/vorsorge', neu: 1 }], 'pruefer', '2026-11-02T10:00:00.000Z');
    expect(nein.ok).toBe(false);
  });
  it('Business-Zahlen der Selbstständigkeit ohne die gemeinsame Einkommensteuer', () => {
    const a = rechneMit(voll, voll.planszenarien![0]), c = rechneMit(b, b.planszenarien![0]);
    expect(a.kdc.some(m => m.st.est > 0)).toBe(true);           // in der vollen Sicht fällt Einkommensteuer an …
    expect(c.kdc.every(m => m.st.est === 0)).toBe(true);        // … in der Business-Sicht nie
    expect(c.kdc.some(m => m.st.gewst > 0)).toBe(true);         // die Gewerbesteuer schon
  });
});

describe('Runway Privat und Kasse — keine Doppelzählung', () => {
  it('Runway Privat zählt das freie Geld der Selbstständigkeit nicht mehr; es zählt im Business', () => {
    const d = plan();
    const g = rechneMit(d, d.planszenarien![0]);
    const a = auswertung(g.d, g.ug, g.pr, g.kdc);
    expect(a.frei.privatBereich).toBeCloseTo(a.frei.privat, 6);
    expect(a.frei.business).toBeCloseTo(a.frei.ug + a.frei.kdv + a.frei.kdc, 6);
    expect(a.frei.gesamt).toBeCloseTo(a.frei.business + a.frei.privat, 6);   // jede Kasse genau einmal
  });
  it('Konten der Selbstständigkeit: sichtbar im Business, nie in der Privat-Kasse', () => {
    const konto = (id: string, ort: RegisterKonto['ort'], betrag: number): RegisterKonto => ({ id, name: id, art: 'giro', ort, staende: [{ id: `ks-${id}`, betrag, datum: '2026-10-01', quelle: 'hand', erfasstVon: 'x', erfasstAm: '2026-10-01T10:00:00.000Z' }], angelegtVon: 'x', angelegtAm: '2026-10-01T10:00:00.000Z' });
    expect(sichtbarIn({ ort: SELBST }, 'business')).toBe(true);
    const ist = kontenIstAus([konto('kt-p', 'privat', 100), konto('kt-s', SELBST, 50)]);
    expect(ist?.privat?.betrag).toBe(100);
    expect(ist?.selbststaendigkeit?.betrag).toBe(50);
  });
});

describe('Steuern — Gewerbe- und Umsatzsteuer der Selbstständigkeit im Business, Einkommensteuer privat', () => {
  it('steuernNurBusiness behält die Firmen-Einstellungen und die GewSt-Vorauszahlung, nie die ESt', () => {
    const e: SteuerEinstellungen = { ...STANDARD_STEUERN, vorauszahlung: { est: 2500, gewstKdc: 400 } };
    const p = prognose(e, '2026-11-02', { kdc: null, kdv: null }, {}, null);
    const st = steuernNurBusiness({ einstellungen: e, fristen: [], ust: [], prognose: p, gewinn: { kdc: null, kdv: null }, uebergabe: { monat: '2026-10', punkte: [], jahr: 2025, jahresPunkte: [] } });
    expect(st.einstellungen.kdc).toBeDefined();
    expect(st.einstellungen.vorauszahlung).toEqual({ gewstKdc: 400 });
    expect(st.prognose.vorauszahlung.est).toBe(0);
    expect(st.prognose.zeilen.some(z => z.id === 'est')).toBe(false);
    expect(st.einstellungen.privat).toBeUndefined();
  });
});

describe('Zeit & Aufgaben — Altbestand zählt weiter', () => {
  const block = (schluessel: string, einheit?: string): FokusBlock => ({ von: '2026-10-01T08:00:00.000Z', bis: '2026-10-01T09:00:00.000Z', schluessel, label: 'x', sek: 3600, ...(einheit ? { einheit } : {}) });
  const name = finanzOrtName(SELBST);
  it('ein alter Privat-Fokus-Block der Selbstständigkeit bleibt Arbeit und gehört zur Sicht Business', () => {
    expect(privatArbeitsEinheit(SELBST)).toBeUndefined();
    expect(selbstArbeitsEinheit(SELBST)).toBe(SELBST);
    const alt = block('privat:fokuszeit', name);
    expect(arbeitsPruefer()(alt)).toBe(true);
    expect(sichtPruefer('business')(alt)).toBe(true);
    expect(sichtPruefer('privat')(alt)).toBe(false);
    expect(arbeitsPruefer()(block('privat:fokuszeit'))).toBe(false);   // ohne Einheit bleibt Privat Privat
  });
  it('Aufgaben im Space der Selbstständigkeit gelten als Business — auch mit altem gespeichertem „privat“', () => {
    const t = { id: 't1', title: 'x', projectId: 'p', space: 'privat' as const, spaceId: SELBST };
    expect(spaceVonAufgabe(t)).toBe('business');
    expect(gespeicherterSpace(t)).toBe('business');
    expect(gespeicherterSpace({ space: 'privat', spaceId: 'privat' })).toBe('privat');
    expect(istBusinessGesellschaft(SELBST)).toBe(true);
  });
});
