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
import { planFix, arbeitsplanFix, pruefPlan } from './fixtures/finanz-plan';
import { LageBusiness } from '@/components/os/finanzplan/Ueberblick';
import { businessSicht } from '@/lib/finanzen/plan/sicht';

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
  it('finanzplan-5: Selbstständigkeit (Privat) zeigt die gemeinsame Einkommensteuer je Jahr und den Abschluss mit Gehalt Jan–Sep und Vorauszahlungen', () => {
    const t = render(mitPlan(), Selbst);
    for (const s of ['Einkommensteuer gemeinsam', 'Lohneinkünfte', 'Mehrsteuer durch die Selbstständigkeit', 'Gehalt brutto Jan–Sep 2026', 'Vorauszahlungen 2026 schon bezahlt', 'Darlehen, die noch hinausgehen', '2026', '2027', '2028']) expect(t, s).toContain(s);
  });
  it('finanzplan-5: Schulden zeigen die Darlehen (auch das Altdarlehen aus den Annahmen, nur lesbar)', () => {
    const d = { ...mitPlan(), darlehen: [{ id: 'dl-1', name: 'Privat an KD Ventures', geber: 'privat' as const, nehmer: 'kdv' as const, betrag: 1500, aus: 0, zurueck: 5 }] };
    const t = render(d, Schulden);
    for (const s of ['Darlehen zwischen', 'Privat an KD Ventures', 'Gesellschafterdarlehen (alt)', 'vor Planbeginn']) expect(t, s).toContain(s);
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

// finanzplan-5 (05.10.): jede Ansicht einmal gegen den Prüfstand — die Zahlen, die tests/finanzplan-pruefstand.test.ts von Hand rechnet, müssen
// so in den Seiten stehen (Stichtag Okt 26). Privat-Bereich sieht alles, Business-Bereich nur die Gesellschaften.
describe('Ansichten gegen den Prüfstand (Zahlen von Hand, finanzplan-5)', () => {
  const d = (): FinanzDaten => ({ ...pruefPlan(), einstellungen: { heute: '2026-10-01', reserveMonate: 2 } });
  const renderB = (k: () => JSX.Element) => { const b = businessSicht(d()); return renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: { ...kontext(b), sicht: 'business' } }, h(k))); };
  it('Lage (Privat): frei privat 1.100, mit Selbstständigkeit 3.947, alles zusammen 37.647', () => {
    const t = render(d(), Lage);
    for (const s of ['1.100', '3.947', '37.647']) expect(t, s).toContain(s);
  });
  it('Lage (Business): frei 33.700 = MAKE 23.800 + KDV 9.900 — ohne Selbstständigkeit', () => {
    const t = renderB(LageBusiness);
    for (const s of ['33.700', '23.800', '9.900']) expect(t, s).toContain(s);
    expect(t).not.toContain('Selbstst');
  });
  it('Gesamt (Privat): frei 37.647, Selbstständigkeit Jan–Sep frei 676 mit Steuer-Anteil 3.324', () => {
    const t = render(d(), Gesamt);
    for (const s of ['37.647', '676', '3.324']) expect(t, s).toContain(s);
  });
  it('Gesamt (Business): frei 33.700, keine Selbstständigkeit', () => {
    const t = renderB(Gesamt);
    expect(t).toContain('33.700'); expect(t).not.toContain('Selbstst');
  });
  it('Selbstständigkeit (Privat): Einkommensteuer gemeinsam 2026 und 2027 wie von Hand; Abschluss zvE 26.770 und Anteil 3.324', () => {
    const t = render(d(), Selbst);
    // 2026: Gewinn 33.400, Lohn 10.770, zvE 44.170, ESt 8.559, GewSt 1.246 · 2027: 69.600, 46.770, 116.370, 37.739, Lohn 9.432, Mehrsteuer 28.307, GewSt 6.314, Soli 1.318, Summe 29.625
    for (const s of ['33.400', '10.770', '44.170', '8.559', '1.246', '69.600', '46.770', '116.370', '37.739', '9.432', '28.307', '6.314', '1.318', '29.625', '26.770', '3.324']) expect(t, s).toContain(s);
  });
  it('Geldfluss/Gruppe (Privat): Freies Geld Gruppe Jan 27 = 47.897', () => {
    expect(render(d(), Geldfluss)).toContain('47.897');
  });
  it('Kalender: Entnahme 2.000 im Nov (Privat sieht sie, Business nicht)', () => {
    expect(render(d(), Kalender)).toContain('Entnahme');
    expect(renderB(Kalender)).not.toContain('Entnahme');
  });
});
