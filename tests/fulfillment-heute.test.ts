// ─── Fulfillment „maximal einfach“ (17.10. spät, Branch `ff-einfach`) — Wächter ─────────────────────────────────────────────────────────────
// Kevin 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist, sodass wir das gut verkloppen können.“
//   · „Heute im Fulfillment“ zeigt DIESELBEN Punkte wie Fall und Cockpit: je Fall der nächste Punkt (`fallStelle().naechster`) und jeder Hänger (`wasHaengt`) —
//     ein Hänger, der derselbe Punkt ist, steht nicht doppelt da; pausierte Fälle und Bestandsmandate fehlen; der Handgriff folgt den Regeln der Karte im Fall.
//   · Die Liste rendert den Handgriff in der Zeile (Ja/Nein, Entwurf öffnen, abhaken, Fall starten, öffnen) — auf Heute und auf dem Fulfillment-Start.
//   · Am gewonnenen Deal: „Mandat anlegen & Fall starten“ bzw. „Fall starten“ bzw. „Fall öffnen ›“.
//   · Fachbegriffe (Abstimmungspunkt, Knoten, A0–A13, Paket-Vorlage) stehen nirgends in der internen Fulfillment-Oberfläche.
// Erfundene Daten, rein — keine Route, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os' }));
const lese = vi.hoisted(() => ({ cockpit: null as unknown, kurz: null as unknown }));
vi.mock('@/components/os/fulfillment/prozesse/daten', async orig => ({
  ...(await orig<typeof import('@/components/os/fulfillment/prozesse/daten')>()),
  useCockpit: () => ({ daten: lese.cockpit, fehler: null, laden: async () => {} }),
  useUebersichtKurz: () => ({ daten: lese.kurz, fehler: null, laden: async () => {} }),
  useFall: () => ({ daten: null, fehler: null, laden: async () => {} }),
}));

import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';
import { cockpitZeile, wasHaengt, type CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { fallStelle, ONBOARDING_SPRUNG } from '@/lib/fulfillment/prozesse/reise';
import { heuteImFulfillment, heuteZahlen, knotenAktion, gewonneneOhneMandat, DEAL_OHNE_MANDAT_TAGE } from '@/lib/fulfillment/prozesse/heute';
import { tageZwischen } from '@/lib/fulfillment/regeln';
import { obKnotenId, type OnboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { nachrichtEntwurf } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { abstimmungName, abstimmungsNummern } from '@/lib/fulfillment/prozesse/darstellung';
import { fallAnwenden, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { FACHBEGRIFFE, fachbegriffeIn } from '@/lib/fulfillment/fachbegriffe';
import { widgetSicht } from '@/lib/flaeche/sicht';
import { HEUTE_STANDARD } from '@/components/os/HeuteView';
import { HeuteImFulfillment } from '@/components/os/fulfillment/reise/HeuteListe';
import { Cockpit } from '@/components/os/fulfillment/prozesse/Visualisierung';
import { LageStreifen } from '@/components/os/fulfillment/reise/LageStreifen';
import { FallAmDeal } from '@/components/os/fulfillment/prozesse/FallAmDeal';
import type { CrmApi } from '@/components/os/crm/daten';

const HEUTE = new Date().toISOString().slice(0, 10);
const vor = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const J = `${HEUTE}T08:00:00.000Z`;
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
const FREIGABEN = [{ id: 'FA', titel: 'Auftrag bestätigt', wer: 'beide' as const }];
const fall = (mandatId: string, knoten: FallKnoten[], x: Partial<Fall> = {}): Fall => ({
  mandatId, vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', knoten, freigaben: {}, onboarding: {},
  stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia', ...x,
} as Fall);
const kontext = (): FallKontext => ({ person: 'pia', jetzt: J, heute: HEUTE, standVon: () => 's', neueId: p => `${p}-x`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['FA'] });
const ok = (r: ReturnType<typeof fallAnwenden>): Fall => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };

/**
 * Ein Ablauf aus dem Editor: Angebot (Schritt → Nachricht → Entscheidung, Nein-Zweig = Erinnerung mit Mail-Baustein → Termin, Bestätigung) → Start. Schritte mit
 * Baustein stehen — wie im Editor — in einem Sammel-Teilprozess, der heißt wie die Phase (Ebene 3), der Baustein auf Ebene 5.
 */
const ablauf = (): FallKnoten[] => [
  k('w', undefined, 'Ablauf', 1),
  k('p1', 'w', 'Angebot', 1, { freigabe: 'FA' }),
  k('t1', 'p1', 'Angebot', 1),
  k('s1', 't1', 'Bedarf aufnehmen', 1, { form: 'schritt', frist: 2 }),
  k('s1-b', 's1', 'Bedarfsbogen', 1, { bausteinId: 'fb-doc' }),
  k('s2', 't1', 'Angebot senden', 2, { form: 'nachricht', frist: 3 }),
  k('e', 't1', 'Angebot angenommen?', 3, { form: 'entscheidung', frist: 7, zweige: { nein: 'r' } }),
  k('r', 't1', 'Nach einer Woche nachfassen', 4, { form: 'erinnerung', frist: 7, zweige: { ja: 'e' } }),
  k('r-m', 'r', 'Nachfass-Mail', 1, { bausteinId: 'fb-mail' }),
  k('s3', 't1', 'Start-Termin vereinbaren', 5, { form: 'termin', frist: 2 }),
  k('p2', 'w', 'Start', 2),
  k('s5', 'p2', 'Zugänge einrichten', 1, { form: 'schritt', frist: 5 }),
];
const erledigt = (l: FallKnoten[], ...ids: string[]) => l.map(x => (ids.includes(x.id) ? { ...x, status: 'erledigt' as const, erledigtAm: HEUTE } : x));
const mitMail = (x: FallKnoten) => x.bausteinId === 'fb-mail' || x.id === 'r';
const OB: OnboardingStand = { offen: 0, schritte: [], fertig: true, willkommen: { ueberfaellig: false } } as unknown as OnboardingStand;
const zeile = (f: Fall, kunde: string, ob: OnboardingStand = OB): CockpitZeile => cockpitZeile({ fall: f, kunde, titel: 'Begleitung', onboarding: ob, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN, mitMail });

// A: die Entscheidung ist dran (Schritt und Nachricht erledigt) → Ja/Nein.
const fA = fall('m-a', erledigt(ablauf(), 's1', 's1-b', 's2'));
// B: „nein“ geantwortet → die Erinnerung läuft, sie trägt einen Mail-Baustein → Entwurf öffnen.
const fB = ok(fallAnwenden(fall('m-b', erledigt(ablauf(), 's1', 's1-b', 's2')), [{ op: 'antwort', id: 'e', antwort: 'nein', am: HEUTE }], kontext()));
// C: der erste Schritt ist überfällig (mit Baustein darunter) → abhaken (Schritt + Baustein); der Hänger ist derselbe Punkt.
const fC = fall('m-c', ablauf().map(x => (x.id === 's1' ? { ...x, faelligAm: vor(3) } : x)));
// D: pausiert → nicht in der Liste.
const fD = fall('m-d', ablauf(), { status: 'pausiert' });
// E: im Onboarding, Willkommensmail überfällig → öffnet die Willkommensmail; der Hänger geht in der Zeile auf (dringend).
const fE = fall('m-e', [k('w', undefined, 'Ablauf', 1), k('p0', 'w', 'Vorlauf', 1), k(obKnotenId('willkommen'), 'p0', 'Willkommen in 24 Stunden', 1)], { status: 'onboarding' });
const obE = { offen: 1, schritte: [], fertig: false, willkommen: { ueberfaellig: true, faellig: `${vor(1)}T08:00:00.000Z` } } as unknown as OnboardingStand;

const zeilen = [zeile(fA, 'Kunde A'), zeile(fB, 'Kunde B'), zeile(fC, 'Kunde C'), zeile(fD, 'Kunde D'), zeile(fE, 'Kunde E', obE)];
const KANDIDATEN = [
  { mandatId: 'm-neu', kunde: 'Kunde Neu', titel: 'Diagnose', uhr: { faellig: `${vor(1)}T10:00:00.000Z`, ueberfaellig: true } },
  { mandatId: 'm-alt', kunde: 'Kunde Bestand', titel: 'Alt', bestand: true as const },
];
const liste = heuteImFulfillment(zeilen, KANDIDATEN, HEUTE);

describe('Heute im Fulfillment — dieselben Punkte wie Fall und Cockpit', () => {
  it('je laufendem Fall der nächste Punkt aus `fallStelle` (dieselbe Kennung, derselbe Titel wie „Als Nächstes“ im Cockpit)', () => {
    for (const [f, z] of [[fA, zeilen[0]], [fB, zeilen[1]], [fC, zeilen[2]], [fE, zeilen[4]]] as const) {
      const n = fallStelle(f, FREIGABEN, HEUTE).naechster!;
      const e = liste.find(x => x.mandatId === f.mandatId && x.quelle === 'naechster');
      expect(e, f.mandatId).toBeDefined();
      expect(e!.knotenId).toBe(n.id);
      expect(e!.titel).toBe(z.schritt);
      expect(z.naechster?.id).toBe(n.id);
    }
  });

  it('jeder Hänger des Cockpits steht in der Liste — als eigene Zeile oder in „als Nächstes“ aufgegangen, nie doppelt', () => {
    for (const z of zeilen.filter(x => x.status !== 'pausiert')) {
      const eigene = liste.filter(e => e.mandatId === z.mandatId && e.quelle === 'haengt');
      const aufgegangen = liste.filter(e => e.mandatId === z.mandatId && e.quelle === 'naechster' && e.haengt).length;
      expect(eigene.length + aufgegangen, z.mandatId).toBe(z.haengt.length);
      for (const e of eigene) expect(z.haengt.map(x => x.text)).toContain(e.titel);
    }
    // C: der überfällige Schritt IST der nächste Punkt → eine Zeile, mit „hängt“.
    const c = liste.filter(e => e.mandatId === 'm-c');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ quelle: 'naechster', ueberfaellig: true, jetzt: true });
    expect(c[0].haengt).toMatch(/überfällig/);
    expect(wasHaengt({ fall: fC, kunde: 'Kunde C', titel: 'T', onboarding: OB, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE })[0].knotenId).toBe('s1');
  });

  it('der Handgriff folgt den Regeln der Karte im Fall: Entscheidung → Ja/Nein, Erinnerung mit Mail → Entwurf, Schritt → abhaken samt Baustein, Onboarding → öffnen', () => {
    expect(liste.find(e => e.mandatId === 'm-a')!.aktion).toEqual({ art: 'ja-nein', knotenId: 'e' });
    expect(liste.find(e => e.mandatId === 'm-b')!.aktion).toEqual({ art: 'entwurf', knotenId: 'r' });
    expect(liste.find(e => e.mandatId === 'm-c')!.aktion).toEqual({ art: 'abhaken', knotenId: 's1', ids: ['s1', 's1-b'] });
    const ob = liste.find(e => e.mandatId === 'm-e')!;
    expect(ob.aktion).toEqual({ art: 'oeffnen', text: ONBOARDING_SPRUNG.willkommen.text });
    expect(ob.href).toContain('#willkommen');
    expect(ob.dringend).toBe(true);
    // Ohne Mail-Baustein ist die Erinnerung ein Schritt zum Abhaken; eine offene Bestätigung und ein abgeleiteter Onboarding-Schritt öffnen nur.
    expect(knotenAktion(fB, 'r')).toMatchObject({ art: 'abhaken', knotenId: 'r' });
    expect(knotenAktion(fA, 'p1')).toBeNull();
    expect(knotenAktion(fE, obKnotenId('willkommen'))).toBeNull();
  });

  it('pausierte Fälle und Bestandsmandate fehlen; ein wartender Start steht da (dringend, wenn die Uhr abgelaufen ist); dringend zuerst', () => {
    expect(liste.some(e => e.mandatId === 'm-d')).toBe(false);
    expect(liste.some(e => e.mandatId === 'm-alt')).toBe(false);
    const neu = liste.find(e => e.mandatId === 'm-neu')!;
    expect(neu).toMatchObject({ quelle: 'start', aktion: { art: 'starten' }, dringend: true, titel: 'Diagnose' });
    const erstNichtDringend = liste.findIndex(e => !e.dringend);
    expect(liste.slice(erstNichtDringend).some(e => e.dringend)).toBe(false);
    expect(heuteZahlen(liste).dringend).toBe(liste.filter(e => e.jetzt && e.dringend).length);
  });
});

describe('Gewonnene Deals ohne Mandat: „Mandat anlegen & Fall starten“ direkt in der Liste', () => {
  const crm = {
    chancen: [
      { id: 'ch-neu', stufe: 'gewonnen', titel: 'Diagnose Neu', firma: 'Kunde Neu', gesellschaft: 'ug', leistungId: 'l-1', historie: [{ stufe: 'angebot', am: `${vor(5)}T08:00:00Z` }, { stufe: 'gewonnen', am: `${HEUTE}T08:00:00Z` }] },
      { id: 'ch-mandat', stufe: 'gewonnen', titel: 'Hat Mandat', firma: 'X', gesellschaft: 'ug', historie: [{ stufe: 'gewonnen', am: `${HEUTE}T08:00:00Z` }] },
      { id: 'ch-alt', stufe: 'gewonnen', titel: 'Alt', firma: 'Y', gesellschaft: 'ug', historie: [{ stufe: 'gewonnen', am: `${vor(DEAL_OHNE_MANDAT_TAGE + 5)}T08:00:00Z` }] },
      { id: 'ch-privat', stufe: 'gewonnen', titel: 'Privat', firma: 'Z', gesellschaft: 'kdc', historie: [{ stufe: 'gewonnen', am: `${HEUTE}T08:00:00Z` }] },
      { id: 'ch-offen', stufe: 'angebot', titel: 'Offen', firma: 'W', gesellschaft: 'ug', historie: [] },
    ],
    mandate: [{ chanceId: 'ch-mandat' }],
  };
  it('nur gewonnen, Business, ohne Mandat, nicht älter als 30 Tage — und als Zeile mit dem einen Knopf', () => {
    const d = gewonneneOhneMandat(crm, HEUTE, g => g === 'ug', tageZwischen);
    expect(d).toEqual([{ chanceId: 'ch-neu', kunde: 'Kunde Neu', titel: 'Diagnose Neu', gewonnenAm: HEUTE, leistungId: 'l-1' }]);
    const l = heuteImFulfillment([], [], HEUTE, d);
    expect(l).toEqual([expect.objectContaining({ quelle: 'deal', titel: 'Diagnose Neu', kunde: 'Kunde Neu', jetzt: true, aktion: { art: 'mandat-starten', chanceId: 'ch-neu', leistungId: 'l-1' } })]);
  });
});

describe('Die Liste in der Oberfläche', () => {
  lese.cockpit = { heute: HEUTE, zeilen, haengt: zeilen.flatMap(z => z.haengt), kapa: null };
  lese.kurz = { kandidaten: KANDIDATEN.map(x => ({ ...x, grund: 'deal', unterschrift: null, vorgeschlagen: false })), zuordnung: {}, faelle: {}, prozesse: [{ id: 'v-1', titel: 'Begleitung', art: 'paket' }], deals: [{ chanceId: 'ch-neu', kunde: 'Firma Deal', titel: 'Diagnose Deal' }] };

  it('Fulfillment-Start: jeder Punkt mit seinem Handgriff in der Zeile', () => {
    const s = renderToStaticMarkup(h(HeuteImFulfillment, {}));
    expect(s).toContain('Heute im Fulfillment');
    expect(s).toContain('id="ff-heute"');
    for (const t of ['Angebot angenommen?', 'Nach einer Woche nachfassen', 'Bedarf aufnehmen', 'Willkommen in 24 Stunden', 'Kunde Neu']) expect(s, t).toContain(t);
    for (const t of ['>Ja<', '>Nein<', '>Entwurf öffnen<', '>Fall starten<', 'Willkommensmail vorbereiten ›', '„Bedarf aufnehmen“ als erledigt markieren', 'Mandat anlegen &amp; Fall starten']) expect(s, t).toContain(t);
    expect(s).not.toContain('Kunde D');
  });

  it('Heute › Business: dieselbe Liste als Karte (Widget `fulfillment`, nur Business, im Standard)', () => {
    const s = renderToStaticMarkup(h(HeuteImFulfillment, { kompakt: true, max: 3 }));
    expect(s).toContain('Fulfillment ›');
    expect(s).toContain('weitere ›');
    expect(widgetSicht('fulfillment')).toBe('business');
    expect(HEUTE_STANDARD.business.some(p => p.art === 'fulfillment')).toBe(true);
    expect(HEUTE_STANDARD.privat.some(p => p.art === 'fulfillment')).toBe(false);
  });

  it('die Kunden-Karten zeigen nur noch, WO jeder steht — „Als Nächstes“ und „Hängt:“ stehen in der Liste darüber (nichts doppelt)', () => {
    const s = renderToStaticMarkup(h(Cockpit));
    expect(s).toContain('Kunde A');
    expect(s).not.toContain('Als Nächstes');
    expect(s).not.toContain('Hängt:');
    expect(s).not.toContain('Der Kunde sieht');
    expect(s).not.toContain('Wert-Konto: noch keine Messung');
  });
});

describe('Am gewonnenen Deal: Fall starten', () => {
  const api = (mandate: unknown[]) => ({ crm: { stand: { chancen: [{ id: 'ch-1', stufe: 'gewonnen', titel: 'Diagnose', firma: 'Kunde Neu', gesellschaft: 'ug', kontaktIds: [], historie: [] }], mandate } }, laden: async () => {}, setFehler: () => {} } as unknown as CrmApi);
  it('ohne Mandat: „Mandat anlegen & Fall starten“ (und „Nur Mandat anlegen“); mit Mandat: „Fall starten“; mit Fall: „Fall öffnen ›“', () => {
    lese.kurz = { kandidaten: [], zuordnung: {}, faelle: {}, prozesse: [{ id: 'v-1', titel: 'Begleitung', art: 'paket' }] };
    const a = renderToStaticMarkup(h(FallAmDeal, { api: api([]), chanceId: 'ch-1' }));
    expect(a).toContain('Mandat anlegen &amp; Fall starten');
    expect(a).toContain('Nur Mandat anlegen');
    const m = { id: 'm-neu', chanceId: 'ch-1', kunde: 'Kunde Neu', gesellschaft: 'ug', titel: 'Diagnose' };
    expect(renderToStaticMarkup(h(FallAmDeal, { api: api([m]), chanceId: 'ch-1' }))).toContain('>Fall starten<');
    lese.kurz = { kandidaten: [], zuordnung: {}, faelle: { 'm-neu': { mandatId: 'm-neu', status: 'laeuft', fortschritt: 0, phase: 'Angebot' } }, prozesse: [] };
    expect(renderToStaticMarkup(h(FallAmDeal, { api: api([m]), chanceId: 'ch-1' }))).toContain('Fall öffnen ›');
  });
});

describe('Kleinkram aus dem Durchspielen', () => {
  it('„({{termin}})“ ohne Termin wird „(Termin folgt)“ — nicht „((Termin folgt))“', () => {
    const m = nachrichtEntwurf('Betreff: X\n{{anrede}},\nim nächsten Termin ({{termin}}).', { anrede: 'Sie', vorname: 'Testa', nachname: 'Probe' }, 'X');
    expect(m.text).toContain('im nächsten Termin (Termin folgt).');
    expect(m.text).not.toContain('((');
  });
  it('Bestätigung statt „Abstimmungspunkt“ (Kennungen bleiben)', () => {
    const nr = abstimmungsNummern([k('w', undefined, 'A', 1), k('p', 'w', 'P', 1, { freigabe: 'F3' })]);
    expect(abstimmungName('F3', nr, 'Diagnose-Abnahme')).toBe('Bestätigung 1 · Diagnose-Abnahme');
  });
});

// ── Fachbegriffe: nirgends in der internen Oberfläche ────────────────────────────────────────────────────────────────────────────────

const WURZEL = path.resolve(__dirname, '..');
const alle = (p: string): string[] => (statSync(p).isDirectory() ? readdirSync(p).flatMap(n => alle(path.join(p, n))) : /\.(ts|tsx)$/.test(p) ? [p] : []);
/** Sichtbare Texte einer Quelldatei: Zeichenketten und JSX-Text — ohne Kommentare und ohne Bezeichner (eine Komponente darf `Knoten` heißen). */
function texte(src: string): string[] {
  const raus: string[] = [];
  let i = 0, code = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') { s += src[j + 1] ?? ''; j += 2; continue; } if (c !== '`' && src[j] === '\n') break; s += src[j]; j++; }
      raus.push(c === '`' ? s.replace(/\$\{[^}]*\}/g, ' ') : s);
      code += ' ';
      i = j + 1; continue;
    }
    code += c; i++;
  }
  for (const m of code.matchAll(/>([^<>{}=;()]+)</g)) raus.push(m[1]);
  return raus;
}

describe('Fachbegriffe raus (Abstimmungspunkt, Knoten, A0–A13, Paket-Vorlage)', () => {
  it('kein sichtbarer Text der internen Fulfillment-Oberfläche nennt sie', () => {
    const dateien = [
      ...['components/os/fulfillment/analyse', 'components/os/fulfillment/editor', 'components/os/fulfillment/prozesse', 'components/os/fulfillment/reise', 'components/os/ui/reise'].flatMap(d => alle(path.join(WURZEL, d))),
      ...['components/os/fulfillment/FulfillmentSeite.tsx', 'lib/erklaerungen/fulfillment-prozesse.ts', 'lib/erklaerungen/fulfillment-analyse.ts', 'lib/fulfillment/prozesse/darstellung.ts', 'lib/fulfillment/prozesse/reise.ts', 'lib/fulfillment/prozesse/reise-bild.ts', 'lib/fulfillment/prozesse/heute.ts', 'lib/fulfillment/prozesse/cockpit.ts', 'lib/reise/bild.ts'].map(d => path.join(WURZEL, d)),
    ];
    const funde: string[] = [];
    for (const d of dateien) for (const t of texte(readFileSync(d, 'utf8'))) { const f = fachbegriffeIn(t); if (f.length) funde.push(`${path.relative(WURZEL, d)}: ${f.join(', ')} in „${t.slice(0, 80)}“`); }
    expect(funde).toEqual([]);
  });
  it('gerenderte Ansichten (Liste, Kunden-Karten, Lage) ebenso', () => {
    lese.kurz = { kandidaten: [], zuordnung: {}, faelle: {}, prozesse: [] };
    for (const s of [renderToStaticMarkup(h(HeuteImFulfillment, {})), renderToStaticMarkup(h(Cockpit)), renderToStaticMarkup(h(LageStreifen))]) {
      const ohneTags = s.replace(/<[^>]+>/g, ' ');
      expect(fachbegriffeIn(ohneTags)).toEqual([]);
    }
    expect(FACHBEGRIFFE.map(f => f.wort)).toEqual(['Abstimmungspunkt', 'Knoten', 'A0–A13', 'Paket-Vorlage']);
  });
});

describe('Zusatzmodule in „Heute“ und im Cockpit (17.10., Gesamtprüfung L2 B1)', () => {
  // Ein Fall mit Paket (Angebot → Start) und angehängtem Zusatzmodul „Telefonie“ (eigene Phase, Abschnitt `fp-zu`).
  const mitZusatz = fall('m-z', [
    ...erledigt(ablauf(), 's1', 's1-b', 's2'),
    k('pz', 'w', 'Telefonie', 3, { zusatz: 'fp-zu' }),
    k('tz', 'pz', 'Telefonie', 1),
    k('sz', 'tz', 'Rufnummern einrichten', 1, { form: 'schritt', frist: 3 }),
  ], { zusaetze: [{ vorlageId: 'fp-zu', vorlageFassung: 1, wurzelId: 'wz', titel: 'Telefonie', startAm: HEUTE, angehaengtAm: J, angehaengtVon: 'pia' }] });
  const z = zeile(mitZusatz, 'Kunde Z');

  it('das Zusatzmodul hat seinen eigenen nächsten Punkt — neben dem des Pakets', () => {
    expect(z.naechster?.id).toBe('e');
    expect(z.zusaetze).toHaveLength(1);
    expect(z.zusaetze![0]).toMatchObject({ vorlageId: 'fp-zu', titel: 'Telefonie', schritt: 'Rufnummern einrichten' });
    const l = heuteImFulfillment([z], [], HEUTE).filter(e => e.mandatId === 'm-z' && e.quelle === 'naechster');
    expect(l.map(e => e.knotenId).sort()).toEqual(['e', 'sz']);
    expect(l.find(e => e.knotenId === 'sz')!.unter).toMatch(/^Telefonie/);
  });

  it('ohne Zusatzmodul kein Feld; ist das Paket fertig, steht das Modul nur einmal da', () => {
    expect(zeile(fA, 'Kunde A').zusaetze).toBeUndefined();
    const paketFertig = fall('m-z2', [
      ...erledigt(ablauf(), 's1', 's1-b', 's2', 'e', 'r', 'r-m', 's3', 's5'),
      k('pz', 'w', 'Telefonie', 3, { zusatz: 'fp-zu' }), k('tz', 'pz', 'Telefonie', 1), k('sz', 'tz', 'Rufnummern einrichten', 1, { form: 'schritt', frist: 3 }),
    ], { freigaben: { FA: { am: HEUTE, von: 'pia' } } as unknown as Fall['freigaben'] });
    const z2 = zeile(paketFertig, 'Kunde Z2');
    expect(z2.naechster?.id).toBe('sz');
    expect(z2.zusaetze).toBeUndefined();
  });
});

describe('Fall-Kopf ohne Cockpit-Zeile (17.10., Gesamtprüfung L2 A2)', () => {
  it('abgeschlossen, pausiert und Fehler stehen als Satz da — nie dauerhaft „Lädt …“', async () => {
    const { ampelSatz } = await import('@/components/os/fulfillment/reise/FallKopf');
    expect(ampelSatz(null, 'abgeschlossen').text).toBe('Der Fall ist abgeschlossen');
    expect(ampelSatz(null, 'pausiert').text).toBe('Der Fall ist pausiert');
    expect(ampelSatz(null, 'laeuft', 'Keine Verbindung').text).toMatch(/nicht abrufbar/);
    expect(ampelSatz(null, 'laeuft').text).toBe('Lädt …');
  });
});

describe('Heute-Liste schreibt mit Stand (17.10., Gesamtprüfung Schreibwege B3)', () => {
  it('die Knoten der Handgriffe sind bekannt — der Server legt ihren Stand an die Zeile, die Liste schickt ihn mit', async () => {
    const { handgriffKnoten } = await import('@/lib/fulfillment/prozesse/cockpit');
    expect(handgriffKnoten(zeilen[2]).sort()).toEqual(['s1', 's1-b']);
    expect(handgriffKnoten(zeilen[0])).toEqual(['e']);
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/fulfillment/reise/HeuteListe.tsx'), 'utf8');
    expect(quelle).toMatch(/mitStand\(e, liste0\)/);
    expect(quelle).not.toMatch(/status: 'offen' \}\)\)\)\} \/>/);
  });
});
