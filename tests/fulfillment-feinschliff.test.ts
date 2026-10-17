// ─── Fulfillment · Feinschliff an der Reise (17.10., aus der Sichtung) ──────────────────────────────────────────────────────────────────────
// Lange Wörter in Kästchen und Pillen trennt die Silbentrennung (`hyphens: auto`, `lang="de"`) statt mitten im Wort, Titel höchstens zwei Zeilen mit „…“
// und Tooltip; das Band „Kunde“ sagt, was beim Kunden liegt (sonst „nichts offen beim Kunden“); die Lage-Zeile der Startseite zeigt nur Zahlen — „was
// hängt“ und „als Nächstes“ stehen nur in der Kundenkarte. Erfundene Daten, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));
const lese = vi.hoisted(() => ({ cockpit: null as unknown }));
vi.mock('@/components/os/fulfillment/prozesse/daten', async orig => ({
  ...(await orig<typeof import('@/components/os/fulfillment/prozesse/daten')>()),
  useCockpit: () => ({ daten: lese.cockpit, fehler: null, laden: async () => {} }),
}));

import { bandTexte, reiseZeile } from '@/lib/fulfillment/prozesse/reise-bild';
import { LageStreifen } from '@/components/os/fulfillment/reise/LageStreifen';
import { cockpitZeile, allesWasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

const WURZEL = path.resolve(__dirname, '..');
const quelle = (f: string) => readFileSync(path.join(WURZEL, f), 'utf8');
const J = '2026-10-17T09:00:00.000Z';

// ── Feinschliff ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });
const HEUTE = new Date().toISOString().slice(0, 10);
const vor = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const FG = [{ id: 'F1', titel: 'Rahmen', wer: 'beide' as const }];
const fall = (knoten: FallKnoten[], x: Partial<Fall> = {}): Fall => ({
  mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', knoten, freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [],
  rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia', ...x,
});

describe('Feinschliff: Titel, Band „Kunde“, Lage-Zeile', () => {
  it('Titel trennen mit Silbentrennung statt mitten im Wort, höchstens zwei Zeilen mit „…“ und Tooltip', () => {
    const css = quelle('app/globals.css');
    expect(css).toMatch(/\.ff-reise-text, \.ff-titel \{[^}]*-webkit-line-clamp: 2;[^}]*hyphens: auto;/);
    const rb = quelle('components/os/fulfillment/reise/ReiseBild.tsx');
    expect(rb).toContain('className="ff-titel" title={s.titel}');
    expect(rb).not.toMatch(/overflowWrap: 'anywhere'/);
    expect(quelle('app/layout.tsx')).toContain('lang="de"');
  });
  it('Band „Kunde“: was beim Kunden liegt (wartet, Abstimmungspunkt offen) — sonst „nichts offen beim Kunden“', () => {
    const f1 = fall([k('w', undefined, 'P', 1), k('p1', 'w', 'Start', 1, { freigabe: 'F1', kundeSichtbar: true }), k('a', 'p1', 'Zahlen liefern', 1, { status: 'wartet_kunde', seit: vor(3), zustaendig: 'kunde' }), k('p2', 'w', 'Weiter', 2), k('b', 'p2', 'B', 1)]);
    const z1 = reiseZeile({ fall: f1, freigaben: FG, heute: HEUTE });
    expect(bandTexte(z1)[0]).toBe('wartet: Zahlen liefern');
    const f2 = fall([k('w', undefined, 'P', 1), k('p1', 'w', 'Start', 1, { freigabe: 'F1', kundeSichtbar: true }), k('a', 'p1', 'A', 1, { status: 'erledigt' }), k('p2', 'w', 'Weiter', 2), k('b', 'p2', 'B', 1)]);
    const z2 = reiseZeile({ fall: f2, freigaben: FG, heute: HEUTE });
    expect(bandTexte(z2)[0]).toBe('Abstimmungspunkt 1 offen');
    const f3 = fall([k('w', undefined, 'P', 1), k('p1', 'w', 'Start', 1), k('a', 'p1', 'A', 1)]);
    const z3 = reiseZeile({ fall: f3, freigaben: [], heute: HEUTE });
    expect(bandTexte(z3)[0]).toBe('nichts offen beim Kunden');
    expect(bandTexte(z3).filter(Boolean)).toHaveLength(1);
  });
  it('Lage-Zeile nur mit Zahlen — „Was hängt“ und „Als Nächstes“ stehen nur in der Kundenkarte', () => {
    const f = fall([k('w', undefined, 'P', 1), k('p1', 'w', 'Start', 1), k('a', 'p1', 'Leitfaden schreiben', 1, { faelligAm: vor(3) })]);
    const z = cockpitZeile({ fall: f, kunde: 'Beispiel GmbH', titel: 'Begleitung', onboarding: { offen: 0, schritte: [], willkommen: { ueberfaellig: false } } as never, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: [] });
    lese.cockpit = { heute: HEUTE, zeilen: [z], haengt: allesWasHaengt([z]), kapa: null };
    const s = renderToStaticMarkup(h(LageStreifen));
    expect(s).toContain('Kunden in Lieferung');
    expect(s).toContain('1 Kunde');
    expect(s).toMatch(/1 Punkt hängt/);
    expect(s).not.toContain('Beispiel GmbH');
    expect(s).not.toContain('Leitfaden schreiben');
    expect(s).not.toContain('Als Nächstes');
  });
});
