// ─── Finanzplanung jetzt — alle Unterseiten rendern (Server-Render, erfundener Plan, kein Browser) ──
// Fängt Abstürze der Oberfläche ab: jede Unterseite, mit und ohne Arbeitsplan, mit Steuerprofil, leerem Plan.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FinanzDaten } from '@/lib/finanzen/rechenkern';
import { leeresDokument, wendeOperationenAn } from '@/lib/finanzen/plan/operationen';
import { steuerOps } from '@/lib/finanzen/steuern';
import { FinanzplanKontext, rechne, type PlanKontext } from '@/components/os/finanzplan/daten';
import { Lage, Check } from '@/components/os/finanzplan/Ueberblick';
import { Privat, UG, Toepfe, KDV, Selbst, Szenarien, Ziele } from '@/components/os/finanzplan/Planen';
import { Budget, Buchungen } from '@/components/os/finanzplan/Monat';
import { Schulden, ZuErledigen, Kalender } from '@/components/os/finanzplan/Verpflichtungen';
import { Entwicklung, Geldfluss, Protokoll } from '@/components/os/finanzplan/Auswerten';
import { Baukasten } from '@/components/os/finanzplan/Baukasten';
import { Gesamt } from '@/components/os/finanzplan/Gesamt';
import { Geschaeft } from '@/components/os/finanzplan/Geschaeft';
import { SteuerKarte } from '@/components/os/finanzplan/Steuern';
import { planFix, arbeitsplanFix } from './fixtures/finanz-plan';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzplan' }));

const kontext = (d: FinanzDaten, params = ''): PlanKontext => ({ d, ...rechne(d), person: 'kevin', verbergen: false, aendere: async () => true, melde: () => {}, geh: () => {}, params: new URLSearchParams(params) });
const render = (d: FinanzDaten, k: () => JSX.Element, params = '') => renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: kontext(d, params) }, h(k)));

const mitPlan = (): FinanzDaten => ({ ...planFix(14000), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1' });
const SEITEN: [string, () => JSX.Element][] = [
  ['Lage', Lage], ['Wochen-Check', Check], ['Privat', Privat], ['MAKE', UG], ['Töpfe', Toepfe], ['KD Ventures', KDV], ['Selbstständigkeit', Selbst], ['Treiber & Annahmen', Szenarien], ['Ziele', Ziele],
  ['Budget', Budget], ['Buchungen', Buchungen], ['Schulden', Schulden], ['Zu erledigen', ZuErledigen], ['Kalender', Kalender], ['Entwicklung', Entwicklung], ['Geldfluss', Geldfluss], ['Protokoll', Protokoll],
  ['Szenarien bauen', Baukasten], ['Gesamt', Gesamt],
];

describe('Alle Unterseiten rendern', () => {
  for (const [name, k] of SEITEN) {
    it(`${name}: mit Arbeitsplan`, () => { expect(render(mitPlan(), k).length).toBeGreaterThan(200); });
    it(`${name}: ohne Arbeitsplan`, () => { expect(render(planFix(), k).length).toBeGreaterThan(100); });
  }
  it('leerer Plan (frisches Konto) stürzt nirgends ab', () => {
    const leer = leeresDokument('2026-10-02');
    for (const [, k] of SEITEN) expect(() => render(leer, k)).not.toThrow();
  });
});

describe('Business-Blatt und Steuerkarte', () => {
  const blatt = (o: 'ug' | 'kdv' | 'kdc', d = mitPlan()) => render(d, () => h(Geschaeft, { ort: o }));
  it('zeigt Kacheln, Produkte, Blatt, Steuerkarte', () => {
    const t = blatt('ug');
    for (const s of ['Break-even', 'Runway', 'Produkte und Umsatz', 'Interim', 'Ergebnis vor Steuern', 'Ergebnis nach Steuern', 'Welche Steuern gelten?', 'Vorlagen (ohne Preis)']) expect(t, s).toContain(s);
    expect(blatt('kdv')).toContain('Ergebnis nach Steuern'); expect(blatt('kdc')).toContain('Liquidität');
  });
  it('Standard-GmbH: USt nur als eingeklappter Durchlauf, Einzelsteuern als Zeilen, Nullzeilen hinter „weitere …“', () => {
    const t = blatt('ug');
    expect(t).toContain('Umsatzsteuer — Durchlauf'); expect(t).toContain('Körperschaftsteuer'); expect(t).toContain('Gewerbesteuer');
    expect(t).not.toContain('(Kern rechnet hier mit)');
    // Ein leerer Plan: alle Null-Zeilen stehen hinter „weitere …“ statt als Wand aus Nullen.
    const leer = blatt('ug', leeresDokument('2026-10-02'));
    expect(leer).toMatch(/weitere Umsatzzeilen/); expect(leer).toMatch(/weitere Steuerzeilen|weitere Steuerzeile/);
    expect(leer).not.toContain('Ankermandat');
  });
  it('USt abgeschaltet: der Durchlauf-Block verschwindet; Gewerbesteuer abgeschaltet: die Zeile ist weg', () => {
    let d = mitPlan();
    d = wendeOperationenAn(d, steuerOps(d, 'ug', { art: 'an', steuer: 'ust', wert: false }), 'kevin', '2026-10-02T10:00:00.000Z').dokument;
    expect(blatt('ug', d)).not.toContain('Umsatzsteuer — Durchlauf');
    d = wendeOperationenAn(d, steuerOps(d, 'ug', { art: 'an', steuer: 'gewst', wert: false }), 'kevin', '2026-10-02T10:00:00.000Z').dokument;
    expect(blatt('ug', d)).not.toContain('>Gewerbesteuer<');
    const k = render(d, () => h(SteuerKarte, { ort: 'ug', offen: true }));
    for (const s of ['Hebesatz', 'Messzahl', 'Zahlweise', 'Verlust mindert die Folgejahre', 'keine Steuerberatung']) expect(k, s).toContain(s);
  });
  it('Karte: Felder mit Vorgabe als grauer Platzhalter, eingetragene mit „zurücksetzen“; Einkommensteuer-Tarif nur beim Einzelunternehmen', () => {
    let d = mitPlan();
    const leer = render(d, () => h(SteuerKarte, { ort: 'ug', offen: true }));
    expect(leer).toContain('placeholder="15"'); expect(leer).toContain('placeholder="5,5"'); expect(leer).not.toContain('↺ zurücksetzen');
    d = wendeOperationenAn(d, steuerOps(d, 'ug', { art: 'feld', id: 'kst.satz', wert: 0.2 }), 'kevin', '2026-10-02T10:00:00.000Z').dokument;
    expect(render(d, () => h(SteuerKarte, { ort: 'ug', offen: true }))).toContain('↺ zurücksetzen');
    expect(leer).not.toContain('Einkommensteuer-Tarif');
    const kdc = render(d, () => h(SteuerKarte, { ort: 'kdc', offen: true }));
    for (const s of ['Einkommensteuer-Tarif (Eckwerte) anpassen', 'Gewerbesteuer-Freibetrag', 'Anrechnung auf die Einkommensteuer']) expect(kdc, s).toContain(s);
  });
  it('Karte im Szenario (Baukasten): „nur dieses Szenario“, leere Felder gelten wie im Plan', () => {
    const d = mitPlan();
    const t = render(d, () => h(SteuerKarte, { ort: 'ug', offen: true, szenario: d.planszenarien![0] }));
    expect(t).toContain('Plan'); expect(t).toContain('gelten wie im Plan');
  });
  it('Selbstständigkeit: eigene Achse mit Einzelsteuern, Entnahme-Karte, Konto und Rücklage', () => {
    const t = blatt('kdc');
    for (const s of ['Einkommensteuer', 'Entnahme nach Privat', 'Kontostand', 'Steuerrücklage', 'Fixkosten (Sachkosten)', 'Zahlungsfluss und Liquidität']) expect(t, s).toContain(s);
  });
  it('Gesamt: Selbstständigkeit als eigener Strom (Block, Linie, Entnahme-Zeile)', () => {
    const t = render(mitPlan(), Gesamt);
    for (const s of ['Selbstständigkeit', 'Entnahme', 'Frei verfügbar']) expect(t, s).toContain(s);
    expect(t).not.toContain('keine Monatsachse');
  });
  it('Privat-Karte hat die Netto-Tabelle, KD Ventures KSt, Soli, Gewerbesteuer und die Steuer auf den Ausstieg', () => {
    expect(render(mitPlan(), () => h(SteuerKarte, { ort: 'privat', offen: true }))).toContain('Brutto → Netto');
    const kdv = render(mitPlan(), () => h(SteuerKarte, { ort: 'kdv', offen: true }));
    expect(kdv).toContain('Steuer auf den Ausstieg'); expect(kdv).toContain('Gewerbesteuer'); expect(kdv).toContain('Körperschaftsteuer');
  });
});
