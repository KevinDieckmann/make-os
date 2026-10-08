// ─── Finanzplanung — Blätter zusammengelegt (08.10. abends, Fragebogen Teil 3 Frage 10) ───────────────────────────────
// Kevin: „Vorschlag so übernehmen · MAKE und KD Ventures zusammen als ‚Gesellschaften‘ · Wochen-Check bleibt eigenes Blatt“.
// Wächter: höchstens 9 Blätter (Privat) bzw. 6 (Business); jede frühere Ansicht bleibt erreichbar; jede gerechnete Zahl (HAND_FELDER)
// behält eine Eingabestelle; je Blatt-Tabelle jede Kennung höchstens einmal; zugeklappte Abschnitte werden nicht gerendert.
// Gerechnet wird wie vorher — hier geht es nur um die Ordnung der Oberfläche. Erfundene Zahlen (Fixtures), nie echte.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { FinanzDaten } from '@/lib/finanzen/rechenkern';
import { HAND_FELDER } from '@/lib/finanzen/handwerte';
import { GESELLSCHAFTEN } from '@/lib/einheiten';
import { blaetterFuer, ZAHNRAD, ABSCHNITTE, type Unterseite } from '@/lib/finanzen/plan/hilfen';
import { FinanzplanKontext, rechne, type PlanKontext } from '@/components/os/finanzplan/daten';
import { BlattSeite, ABSCHNITT_INHALT, BLATT_KOPF } from '@/components/os/finanzplan/Blaetter';
import { Lage, Check, LageBusiness } from '@/components/os/finanzplan/Ueberblick';
import { Privat, UG, Toepfe, KDV, Selbst, Szenarien, Ziele } from '@/components/os/finanzplan/Planen';
import { Budget, Buchungen } from '@/components/os/finanzplan/Monat';
import { Schulden, ZuErledigen, Kalender } from '@/components/os/finanzplan/Verpflichtungen';
import { Entwicklung, Geldfluss, Protokoll } from '@/components/os/finanzplan/Auswerten';
import { Baukasten } from '@/components/os/finanzplan/Baukasten';
import { Gesamt } from '@/components/os/finanzplan/Gesamt';
import { Klappbar } from '@/components/os/ui';
import { planFix, arbeitsplanFix, pruefPlan } from './fixtures/finanz-plan';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/finanzen' }));

const wurzel = path.resolve(__dirname, '..');
const kontext = (d: FinanzDaten): PlanKontext => ({ d, ...rechne(d), person: 'kevin', verbergen: false, aendere: async () => true, melde: () => {}, geh: () => {}, params: new URLSearchParams() });
const blatt = (d: FinanzDaten, u: Unterseite) => renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: kontext(d) }, h(BlattSeite, { u, alleOffen: true })));
const mitPlan = (): FinanzDaten => ({ ...planFix(14000), planszenarien: [arbeitsplanFix()], arbeitsplan: 'ps1' });
const ALLE: Unterseite[] = [...blaetterFuer('privat').map(b => b.id), ZAHNRAD.id];

describe('Blätter — wenige, flach, alles erreichbar', () => {
  it('höchstens 9 Blätter unter Privat, höchstens 6 unter Business', () => {
    expect(blaetterFuer('privat').length).toBeLessThanOrEqual(9);
    expect(blaetterFuer('business').length).toBeLessThanOrEqual(6);
  });
  it('jede Ansicht von vor dem 08.10. steht auf einem Blatt (als Kopf oder Abschnitt)', () => {
    const erreichbar = new Set<unknown>([...Object.values(ABSCHNITT_INHALT), ...Object.values(BLATT_KOPF), Lage, LageBusiness]);
    const frueher = { Lage, LageBusiness, Check, Budget, Buchungen, Privat, UG, Toepfe, KDV, Selbst, Szenarien, Ziele, Schulden, ZuErledigen, Kalender, Entwicklung, Geldfluss, Protokoll, Baukasten, Gesamt };
    for (const [name, k] of Object.entries(frueher)) expect(erreichbar.has(k), name).toBe(true);
    // Jeder Abschnitt hat seinen Inhalt.
    for (const u of Object.keys(ABSCHNITTE) as Unterseite[]) for (const a of ABSCHNITTE[u]) expect(ABSCHNITT_INHALT[a.id], a.id).toBeTypeOf('function');
  });
  it('jede gerechnete Zahl (HAND_FELDER) hat eine Eingabestelle — auch das Gehalt 2 brutto über die Selbstständigkeit (Lücke geschlossen)', () => {
    const ordner = path.join(wurzel, 'components/os/finanzplan');
    const quelle = readdirSync(ordner).filter(f => f.endsWith('.tsx')).map(f => readFileSync(path.join(ordner, f), 'utf8')).join('\n');
    const da = new Set([...quelle.matchAll(/edit: '([^']+)'/g), ...quelle.matchAll(/hz\('([^']+)'/g), ...quelle.matchAll(/kennung[=:] ?['"]([^'"]+)['"]/g)].map(m => m[1]));
    // Steuerzeilen der Geschäftsblätter tragen die Kennung `<ort>.<art>` (Geschaeft.tsx › z(name, art, reihe …)).
    for (const m of quelle.matchAll(/'([a-zA-Z]+)', a\.[a-zA-Z]+[,)]/g)) for (const o of GESELLSCHAFTEN) da.add(`${o}.${m[1]}`);
    const ohne = Object.keys(HAND_FELDER).filter(k => !da.has(k));
    expect(ohne).toEqual([]);
    expect(da.has('p.malinSelbst')).toBe(true);
  });
  it('das Blatt „Gruppe“ des Geldflusses ist weg — jede seiner Kennungen steht im Gesamt-Blatt', () => {
    const html = blatt(pruefPlan(), 'gesamt');
    const gesamtBlatt = html.split('class="ui-tabelle"').find(t => t.includes('data-e="g.frei"')) ?? '';
    for (const k of ['ug.frei', 'kdv.frei', 'kdc.frei', 'p.angespart', 'kdv.darlehenOffen', 'g.frei']) expect(gesamtBlatt, k).toContain(`data-e="${k}"`);
  });
});

describe('Blätter — je Blatt-Tabelle jede Kennung höchstens einmal', () => {
  for (const u of ALLE) {
    it(`${u}: keine Kennung doppelt in einer Tabelle`, () => {
      for (const d of [mitPlan(), pruefPlan()]) {
        const tabellen = blatt(d, u).split('class="ui-tabelle"').slice(1);
        for (const t of tabellen) {
          const paare = [...t.matchAll(/data-e="([^"]+)" data-m="(\d+)"/g)].map(m => `${m[1]}:${m[2]}`);
          const doppelt = paare.filter((p, i) => paare.indexOf(p) !== i);
          expect(doppelt, u).toEqual([]);
        }
      }
    });
  }
});

describe('Sprünge mit Parametern auf zusammengelegten Blättern', () => {
  const mitParams = (u: Unterseite, q: string) => renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: { ...kontext(mitPlan()), params: new URLSearchParams(q) } }, h(BlattSeite, { u, alleOffen: true })));
  /** Steuerkarte einer Gesellschaft offen? (Knopf „Zuklappen“ statt „Anpassen“ in ihrer Karte.) */
  const steuerOffen = (html: string, ort: string) => (html.split(`id="steuern-${ort}"`)[1] ?? '').slice(0, 1500).includes('Zuklappen');
  it('steuern=<ort> öffnet nur die Steuerkarte DIESER Gesellschaft — MAKE und KD Ventures stehen auf einem Blatt', () => {
    const ug = mitParams('gesellschaften', 'steuern=ug');
    expect(steuerOffen(ug, 'ug')).toBe(true); expect(steuerOffen(ug, 'kdv')).toBe(false);
    const kdv = mitParams('gesellschaften', 'steuern=kdv');
    expect(steuerOffen(kdv, 'ug')).toBe(false); expect(steuerOffen(kdv, 'kdv')).toBe(true);
    // Alte Links (steuern=1) öffnen wie bisher MAKE, nicht KD Ventures.
    const alt = mitParams('gesellschaften', 'steuern=1');
    expect(steuerOffen(alt, 'ug')).toBe(true); expect(steuerOffen(alt, 'kdv')).toBe(false);
  });
});

describe('Klappbar (components/os/ui)', () => {
  it('Kopfzeile ist ein Knopf mit aria-expanded, der Abschnitt trägt den Anker; zugeklappt kein Inhalt', () => {
    const offen = renderToStaticMarkup(h(Klappbar, { id: 'kalender', titel: 'Kalender & Verträge', offen: true, umschalten: () => {}, zaehler: 3, children: h('p', null, 'Inhalt da') }));
    expect(offen).toContain('id="kalender"'); expect(offen).toContain('data-abschnitt="kalender"');
    expect(offen).toContain('aria-expanded="true"'); expect(offen).toContain('aria-controls="kalender-inhalt"'); expect(offen).toContain('Inhalt da');
    expect(offen).toContain('fp-zaehler');
    const zu = renderToStaticMarkup(h(Klappbar, { id: 'kalender', titel: 'Kalender & Verträge', offen: false, umschalten: () => {}, children: h('p', null, 'Inhalt da') }));
    expect(zu).toContain('aria-expanded="false"'); expect(zu).not.toContain('Inhalt da'); expect(zu).toContain('ui-klappbar-zu');
  });
  it('ohne Merker gilt die Vorgabe: Monat zeigt Budget und Ist-Buchungen, Fällig & Schulden nur „Zu erledigen“, Planen die Ziele zugeklappt', () => {
    const r = (u: Unterseite) => renderToStaticMarkup(h(FinanzplanKontext.Provider, { value: kontext(mitPlan()) }, h(BlattSeite, { u })));
    const monat = r('monat'); expect(monat).toContain('id="budget-inhalt"'); expect(monat).toContain('id="buchungen-inhalt"');
    const faellig = r('faellig'); expect(faellig).toContain('id="posten-inhalt"'); expect(faellig).not.toContain('id="kalender-inhalt"'); expect(faellig).not.toContain('id="schulden-inhalt"');
    const planen = r('planen'); expect(planen).toContain('data-abschnitt="ziele"'); expect(planen).not.toContain('id="ziele-inhalt"');
  });
});
