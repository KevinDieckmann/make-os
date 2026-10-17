// ─── Fulfillment · Design-Überarbeitung (11.10.) — die Ansichten rendern (Rauchtest ohne Browser) ─────────────────────────────────────────────
// Seit 17.10. (Kevins Miro-Standard): Kopf des Falls (knapp — Ampel mit einem Satz, „Dem Kunden zeigen“), Reise (laufende Phase gewählt: Fluss + Detail des
// nächsten Schritts, Bausteine als Chip, „+ Zusatz-Schritt“ EINMAL je Phase, Abstimmungspunkt als Raute), Prozesse (Legende, Paket-Karten), Cockpit (Kunden-
// Karten nach „braucht Aufmerksamkeit“) und die Lage als EINE Zeile. Daten erfunden; die Lese-Haken sind ersetzt — keine Route, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));

const lese = vi.hoisted(() => ({ fall: null as unknown, uebersicht: null as unknown, cockpit: null as unknown }));
vi.mock('@/components/os/fulfillment/prozesse/daten', async orig => ({
  ...(await orig<typeof import('@/components/os/fulfillment/prozesse/daten')>()),
  useFall: () => ({ daten: lese.fall, fehler: null, laden: async () => {} }),
  useUebersicht: () => ({ daten: lese.uebersicht, fehler: null, laden: async () => {} }),
  useUebersichtKurz: () => ({ daten: null, fehler: null, laden: async () => {} }),
  useCockpit: () => ({ daten: lese.cockpit, fehler: null, laden: async () => {} }),
}));

import { FallKopf } from '@/components/os/fulfillment/reise/FallKopf';
import { FallReise } from '@/components/os/fulfillment/reise/FallReise';
import { Prozesse } from '@/components/os/fulfillment/prozesse/Prozesse';
import { Cockpit } from '@/components/os/fulfillment/prozesse/Visualisierung';
import { LageStreifen } from '@/components/os/fulfillment/reise/LageStreifen';
import { leerVorlagen } from '@/lib/fulfillment/lesen';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { onboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { cockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { allesWasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

const HEUTE = new Date().toISOString().slice(0, 10);
const JETZT = new Date().toISOString();
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const knoten: FallKnoten[] = [
  k('w', undefined, 'Paket', 1),
  k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k('p1-a', 'p1', 'Kick-off', 1, { status: 'erledigt' }),
  k('p2', 'w', 'Diagnose', 2, { freigabe: 'F3' }), k('p2-t', 'p2', 'Bericht', 1),
  k('p2-s1', 'p2-t', 'Interviews führen', 1, { status: 'erledigt' }),
  k('p2-s2', 'p2-t', 'Leitfaden schreiben', 2), k('p2-s2-b', 'p2-s2', 'Leitfaden schreiben', 1, { bausteinId: 'fb-leitfaden' }),
  k('p2-q', 'p2', 'Quick Wins', 2),
  k('p3', 'w', 'Umsetzung', 3),
];
const fall: Fall = {
  mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: JETZT, gestartetVon: 'pia', status: 'laeuft', knoten,
  freigaben: { F0: { am: HEUTE, von: 'pia' } }, onboarding: { willkommenGesendetAm: JETZT }, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [],
  quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: JETZT, geaendertVon: 'pia',
};
const ob = onboardingStand(fall, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT });
lese.fall = {
  inhaber: true, mandat: { id: 'm-1', titel: 'Begleitung', kunde: 'Beispiel GmbH', firmaId: null, kontaktIds: [], leistungId: null, ziele: [], gesellschaft: 'ug', status: 'aktiv', start: null, zustaendig: null, business: true },
  unterschrift: null, fall: { ...fall, knoten: knoten.map(x => ({ ...x, stand: `st-${x.id}` })), stakeholder: [], entscheidungen: [] },
  onboarding: ob, diff: null, vorlage: { id: 'v-1', titel: 'Paket', fassung: 1, freigaben: [{ id: 'F0', titel: 'Mandatsrahmen', wer: 'beide' }, { id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide' }], rollen: [] },
  wartet: [], wertKonto: [], fortschritt: 25, bausteine: [{ id: 'fb-leitfaden', titel: 'Leitfaden Erstgespräch', art: 'skript', kundeFuellt: false, nurIntern: false, rechtOffen: true, vorVerkaufOffen: false, lieferobjekt: null }],
};

describe('Fall (seit 17.10. Kopf + vier Reiter — Kevins Miro-Standard)', () => {
  it('Kopf: knapp — zurück, Ampel mit einem Satz, „Dem Kunden zeigen“; kein Strahl und keine Antwort-Kacheln mehr (das zeigt die Reise)', () => {
    const html = renderToStaticMarkup(h(FallKopf, { mandatId: 'm-1' }));
    expect(html).toContain('‹ Fulfillment');
    expect(html).not.toContain('Wo steht der Kunde?');
    expect(html).not.toContain('Sie sind hier');
    expect(html).toContain('>Dem Kunden zeigen<');
    expect(html).not.toMatch(/ui-knopf-haupt/);
  });

  it('Reise: die laufende Phase ist gewählt (Fluss + Detail des nächsten Schritts), Baustein als Chip im Detail, „+ Zusatz-Schritt“ einmal, Abstimmungspunkt als Raute', () => {
    const html = renderToStaticMarkup(h(FallReise, { mandatId: 'm-1' }));
    expect(html).toContain('Phase 2 · Diagnose');
    expect(html).toContain('Leitfaden Erstgespräch');
    expect(html).toContain('rechtlich prüfen');
    expect((html.match(/\+ Zusatz-Schritt/g) ?? []).length).toBe(1);
    expect(html).toContain('Bestätigung 2 · Diagnose-Abnahme'); // 14.10. (Abnahme B19): Nummer lückenlos statt „Freigabe F3“; 17.10. spät „Bestätigung“
    expect(html).not.toMatch(/Freigabe F\d/);
    // Die Willkommensmail ist gesendet → keine eigene Karte; höchstens EINE Hauptaktion (der Handgriff des nächsten Schritts).
    expect(html).not.toContain('id="willkommen"');
    expect((html.match(/ui-knopf-haupt/g) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe('Startseite, Prozesse, Cockpit', () => {
  const d = vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], { person: 'pia', jetzt: JETZT, heute: HEUTE, standVon: () => 's', neueId: (() => { let n = 0; return (p: string) => `${p}-t${++n}`; })() });
  if (!d.ok) throw new Error(d.fehler);
  lese.uebersicht = {
    inhaber: true, prozesse: d.datei.prozesse.map(p => ({ ...p, stand: 's', knoten: p.knoten.map(x => ({ ...x, stand: 's' })) })), bausteine: [], rituale: [], zuordnung: {},
    einstellungen: d.datei.einstellungen, importLaeufe: [], musterOffen: [], kandidaten: [], faelle: {}, zaehler: {}, mandate: {}, kennzahlen: [], leistungen: [],
  };
  const z = (kunde: string, rot: boolean) => cockpitZeile({ fall: { ...fall, mandatId: kunde }, kunde, titel: 'T', onboarding: { ...ob, willkommen: { ueberfaellig: rot } }, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE });
  const zeilen = [z('Ruhig AG', false), z('Dringend GmbH', true)];
  lese.cockpit = { heute: HEUTE, zeilen, haengt: allesWasHaengt(zeilen), kapa: null };

  it('Prozesse: Legende des Hochhauses und Paket-Vorlagen als Karten mit Phasen-Kette', () => {
    // 17.10. spät (`ff-einfach`): oben „Heute im Fulfillment“, das Hochhaus zugeklappt — offen, sobald ein Kasten gewählt ist (`?k=`).
    const html = renderToStaticMarkup(h(Prozesse, {}));
    expect(html).toContain('Unser Unternehmen als Hochhaus');
    expect(html).toContain('Heute im Fulfillment');
    const lk = (lese.uebersicht as { prozesse: { art: string; knoten: { id: string; elternId?: string }[] }[] }).prozesse.find(p => p.art === 'landkarte')!;
    const mitK = renderToStaticMarkup(h(Prozesse, { k: lk.knoten.find(x => !x.elternId)!.id }));
    expect(mitK).toContain('Etagen — der Weg eines Kunden durch uns');
    expect(mitK).toContain('Fundament — was alles trägt');
    expect(html).toContain('Vertriebsleitung auf Zeit');
    expect(html).toContain('Phasen von Vertriebsleitung auf Zeit');
    expect(html).toContain('noch keinem Produkt zugeordnet');
  });

  it('Cockpit: je Kunde eine Karte, wer Aufmerksamkeit braucht zuerst; die Lage oben als EINE Zeile', () => {
    const html = renderToStaticMarkup(h(Cockpit));
    expect(html.indexOf('Dringend GmbH')).toBeLessThan(html.indexOf('Ruhig AG'));
    expect(html).toContain('braucht Aufmerksamkeit');
    const lage = renderToStaticMarkup(h(LageStreifen));
    expect(lage).toContain('Kunden in Lieferung');
    expect(lage).toContain('2 Kunden');
    // 17.10. (Gesamtprüfung L2 B8): EINE Zählung mit „Heute im Fulfillment“ — „Heute: n zu tun“.
    expect(lage).toContain('Heute');
    expect(lage).toMatch(/zu tun|Nichts/);
    expect(lage).toContain('class="ff-lage"');
  });
});
