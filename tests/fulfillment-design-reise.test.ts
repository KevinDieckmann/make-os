// ─── Fulfillment · Design-Überarbeitung (11.10.) — die reinen Lese-Helfer der Bilder ───────────────────────────────────────────────────────────
// Rückmeldung 11.10.: „So ist es sehr unübersichtlich … es muss einfach zu verstehen sein — über Visualisierungen.“ Geprüft wird, was die Bilder rechnen:
// Reise eines Falls (Phasen, „Sie sind hier“, Freigaben), Schritte einer Phase (Bausteine am Schritt statt doppelter Zeile), Status für Schritt +
// Bausteine in einer Anfrage, der nächste Handgriff, Ampel je Etage, Paket-Steckbrief, Bausteine nach Paket/Phase, Reihenfolge im Cockpit, Wellen-Bild,
// gemeinsame Sperrgründe, Pfeile der Landkarte beschriftet, und dass die Zeichen-Bausteine ohne Daten-Literale rendern. Erfundene Daten, kein Netz.
import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MUSTER_P1, MUSTER_LANDKARTE } from '@/lib/fulfillment/muster';
import { fallStarten } from '@/lib/fulfillment/prozesse/fall';
import { onboardingStand, obKnotenId } from '@/lib/fulfillment/prozesse/onboarding';
import { fallReise, phaseGruppen, naechsteSchritte, statusOps, naechsterHandgriff, reiseKurz } from '@/lib/fulfillment/prozesse/reise';
import { knotenAmpel, kundenAmpel, paketSteckbrief, bausteinOrte, nachAufmerksamkeit, wellenBild, naechsterLauf, gemeinsameSaetze, ohneGemeinsame } from '@/lib/fulfillment/prozesse/darstellung';
import { landkarteLage } from '@/lib/fulfillment/prozesse/landkarte';
import { cockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { PhasenStrahl, MiniStrahl, WellenBild, WertBalken } from '@/components/os/fulfillment/reise/bilder';
import type { Fall, FallKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';
import type { CockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';

const HEUTE = '2026-10-11';
const JETZT = '2026-10-11T09:00:00.000Z';
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });

/** Ein kleiner Fall: drei Phasen, die erste erledigt (Freigabe F0 vermerkt), die zweite läuft (Teilprozess mit Schritt + Baustein), die dritte kommt. */
function fall(x: Partial<Fall> = {}): Fall {
  const knoten: FallKnoten[] = [
    k('w', undefined, 'Paket', 1),
    k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0' }),
    k('p1-a', 'p1', 'Kick-off', 1, { status: 'erledigt' }),
    k('p2', 'w', 'Diagnose', 2, { freigabe: 'F3' }),
    k('p2-t', 'p2', 'Bericht', 1),
    k('p2-s1', 'p2-t', 'Interviews führen', 1, { status: 'erledigt' }),
    k('p2-s2', 'p2-t', 'Leitfaden schreiben', 2, { faelligAm: '2026-10-05' }),
    k('p2-s2-b', 'p2-s2', 'Leitfaden schreiben', 1, { bausteinId: 'fb-leitfaden' }),
    k('p2-s3', 'p2-t', 'Entwurf abstimmen', 3, { status: 'wartet_kunde', seit: '2026-10-01' }),
    k('p2-q', 'p2', 'Quick Wins', 2),
    k('p3', 'w', 'Umsetzung', 3),
  ];
  return {
    mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: JETZT, gestartetVon: 'pia', status: 'laeuft', knoten,
    freigaben: { F0: { am: '2026-10-02', von: 'pia' } }, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [],
    quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: JETZT, geaendertVon: 'pia', ...x,
  };
}
const FREIGABEN = [{ id: 'F0', titel: 'Mandatsrahmen', wer: 'beide' as const }, { id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide' as const }];

describe('Reise eines Falls', () => {
  it('Phasen mit Zustand, Anteil, Freigabe in Klartext; „jetzt“ = aktuelle Phase; überfällig und „wartet“ je Phase', () => {
    const r = fallReise(fall(), FREIGABEN, HEUTE);
    expect(r.phasen.map(p => [p.titel, p.zustand])).toEqual([['Vorlauf', 'fertig'], ['Diagnose', 'jetzt'], ['Umsetzung', 'offen']]);
    expect(r.jetzt).toBe(1);
    const d = r.phasen[1];
    // Blätter: Interviews (erledigt), Leitfaden-Baustein, Entwurf, Quick Wins → 1 von 4.
    expect([d.erledigt, d.gesamt]).toEqual([1, 4]);
    expect(d.anteil).toBeCloseTo(0.25);
    expect(d.ueberfaellig).toBe(true);
    expect(d.wartet).toBe(1);
    expect(d.freigabe).toEqual({ id: 'F3', titel: 'Diagnose-Abnahme', wer: 'beide', gegeben: false });
    expect(r.phasen[0].freigabe).toMatchObject({ id: 'F0', gegeben: true, am: '2026-10-02' });
    expect(r.phasen[2].anteil).toBe(0);
    expect(reiseKurz(r)[1]).toEqual({ titel: 'Diagnose', zustand: 'jetzt', anteil: 0.25, freigabe: { id: 'F3', gegeben: false } });
  });

  it('Schritte einer Phase: Teilprozess als Gruppe, Baustein hängt am Schritt (keine doppelte Zeile), wirksamer Stand', () => {
    const g = phaseGruppen(fall(), 'p2', HEUTE);
    expect(g.map(x => x.teil?.titel ?? null)).toEqual(['Bericht', null]);
    expect(g[0].zeilen.map(z => z.knoten.titel)).toEqual(['Interviews führen', 'Leitfaden schreiben', 'Entwurf abstimmen']);
    const leitfaden = g[0].zeilen[1];
    expect(leitfaden.bausteine.map(b => b.id)).toEqual(['p2-s2-b']);
    expect(leitfaden.ueberfaellig).toBe(true);
    // Keine Zeile für den Baustein selbst.
    expect(g.flatMap(x => x.zeilen).some(z => z.knoten.id === 'p2-s2-b')).toBe(false);
    // Baustein erledigt → der Schritt gilt als erledigt.
    const f2 = fall();
    f2.knoten = f2.knoten.map(x => (x.id === 'p2-s2-b' ? { ...x, status: 'erledigt' } : x));
    expect(phaseGruppen(f2, 'p2', HEUTE)[0].zeilen[1]).toMatchObject({ zustand: 'erledigt', fertig: true });
    // Eine Phase ohne Kinder ist selbst ihr einziger Schritt.
    expect(phaseGruppen(fall(), 'p3', HEUTE)[0].zeilen.map(z => z.knoten.id)).toEqual(['p3']);
  });

  it('nächste Schritte: nur offene der laufenden Phase, in Ablauf-Reihenfolge, höchstens n', () => {
    expect(naechsteSchritte(fall(), HEUTE).map(z => z.knoten.titel)).toEqual(['Leitfaden schreiben', 'Entwurf abstimmen', 'Quick Wins']);
    expect(naechsteSchritte(fall(), HEUTE, 1)[0].phase).toBe('Diagnose');
  });

  it('Status setzt Schritt UND Bausteine in einer Anfrage; Onboarding-Schritte und „erledigt“ an Freigabe-Schritten bleiben unberührt', () => {
    const z = phaseGruppen(fall(), 'p2', HEUTE)[0].zeilen[1];
    expect(statusOps(z, 'erledigt', undefined, n => `st-${n.id}`)).toEqual([
      { op: 'knoten-status', id: 'p2-s2', status: 'erledigt', stand: 'st-p2-s2' },
      { op: 'knoten-status', id: 'p2-s2-b', status: 'erledigt', stand: 'st-p2-s2-b' },
    ]);
    expect(statusOps(z, 'entfaellt', 'passt nicht')[0]).toMatchObject({ status: 'entfaellt', grund: 'passt nicht' });
    const ob = { knoten: k(obKnotenId('kickoff'), 'x', 'Kick-off terminieren', 1), bausteine: [] };
    expect(statusOps(ob, 'erledigt')).toEqual([]);
    const fg = { knoten: k('f', 'x', 'Freigabe', 1, { freigabe: 'F3' }), bausteine: [] };
    expect(statusOps(fg, 'erledigt')).toEqual([]);
    expect(statusOps(fg, 'in_arbeit')).toHaveLength(1);
  });
});

describe('Der nächste Handgriff (eine Hauptaktion)', () => {
  const start = () => fallStarten({ mandatId: 'm-x', vorlage: MUSTER_P1, person: 'pia', jetzt: JETZT, start: HEUTE, neueId: (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}` });
  const abl = { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: JETZT, unterschrift: '2026-10-09' };

  it('neuer Fall: zuerst die Willkommensmail (dringend nach 24 h), danach der erste offene Onboarding-Schritt', () => {
    const f = start();
    const ob = onboardingStand(f, abl);
    expect(naechsterHandgriff(f, ob, MUSTER_P1.freigaben, HEUTE)).toMatchObject({ art: 'willkommen', dringend: true });
    const f2: Fall = { ...f, onboarding: { willkommenGesendetAm: JETZT } };
    const g = naechsterHandgriff(f2, onboardingStand(f2, abl), MUSTER_P1.freigaben, HEUTE);
    expect(g).toMatchObject({ art: 'onboarding', schluessel: 'kickoff', reiter: 'takt' });
  });

  it('laufender Fall: nächster offener Schritt; sind alle Schritte einer Phase erledigt, die Freigabe in Klartext; abgeschlossen = fertig', () => {
    expect(naechsterHandgriff(fall(), undefined, FREIGABEN, HEUTE)).toMatchObject({ art: 'schritt', id: 'p2-s2', text: 'Als Nächstes: Leitfaden schreiben' });
    const f = fall();
    f.knoten = f.knoten.map(x => (x.id.startsWith('p2-') ? { ...x, status: 'erledigt' } : x));
    expect(naechsterHandgriff(f, undefined, FREIGABEN, HEUTE)).toEqual({ art: 'freigabe', id: 'F3', text: 'Freigabe F3 vermerken (Diagnose-Abnahme)' });
    expect(naechsterHandgriff({ ...fall(), status: 'abgeschlossen' }, undefined, FREIGABEN, HEUTE).art).toBe('fertig');
  });
});

describe('Landkarte, Paket-Karten, Bibliothek, Cockpit', () => {
  const haenger = (schwere: 'rot' | 'gelb') => ({ art: 'faellig' as const, mandatId: 'm', kunde: 'K', text: 't', schwere, href: '/os/' });
  const zeile = (mandatId: string, x: Partial<CockpitZeile> = {}): CockpitZeile => ({
    mandatId, kunde: mandatId, titel: 'T', status: 'laeuft', fortschritt: 50, wartet: 0, health: null, report: { faellig: false }, pulsKritisch: false, pulsOffen: false, link: 'aus',
    analyse: null, onboarding: { offen: 0, fertig: true, willkommenUeberfaellig: false }, haengt: [], ...x,
  });

  it('Ampel je Kasten = schlechtester Kunde dort; ohne Kunden keine Ampel', () => {
    const zeilen = [zeile('a'), zeile('b', { haengt: [haenger('gelb')] }), zeile('c', { health: 'rot' })];
    expect(kundenAmpel(zeilen[0])).toBe('gruen');
    expect(knotenAmpel({ x: ['a', 'b'], y: ['a'], z: ['c', 'a'], leer: [] }, zeilen)).toEqual({ x: 'gelb', y: 'gruen', z: 'rot' });
  });

  it('Cockpit: rot vor gelb vor ruhig — bei Gleichstand weniger Fortschritt zuerst', () => {
    const l = nachAufmerksamkeit([zeile('ruhig', { fortschritt: 10 }), zeile('rot', { haengt: [haenger('rot')] }), zeile('gelb', { haengt: [haenger('gelb')] }), zeile('weiter', { fortschritt: 90 })]);
    expect(l.map(z => z.mandatId)).toEqual(['rot', 'gelb', 'ruhig', 'weiter']);
  });

  it('Cockpit-Zeile trägt die Phasen als Mini-Strahl und das Wert-Konto (Ø Zielerreichung)', () => {
    const f = fall({ wertKonto: { z1: { ausgangZahl: 4, zielZahl: 12, messungen: [{ am: '2026-10-01', wert: 8, quelle: 'hand' }] } } });
    const z = cockpitZeile({ fall: f, kunde: 'K', titel: 'T', onboarding: { schritte: [], fertig: true, offen: 0, willkommen: { ueberfaellig: false } }, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE });
    expect(z.phasen?.map(p => p.zustand)).toEqual(['fertig', 'jetzt', 'offen']);
    expect(z.wert).toEqual({ wert: 50, ziele: 1 });
  });

  it('Paket-Steckbrief: Phasen mit Freigaben, Zahl der Schritte, Bausteine', () => {
    const sb = paketSteckbrief(MUSTER_P1);
    expect(sb.phasen).toHaveLength(8);
    expect(sb.phasen[0]).toMatchObject({ titel: 'Vorlauf / Onboarding', freigabe: 'F0' });
    expect(sb.schritte).toBe(MUSTER_P1.knoten.length - 1);
    expect(sb.freigaben).toBe(7);
  });

  it('Bausteine nach Paket und Phase: aus den Ebene-5-Knoten der Paket-Vorlagen', () => {
    const v: Pick<ProzessVorlage, 'art' | 'titel' | 'knoten'> = { art: 'paket', titel: 'Paket A', knoten: [
      { id: 'w', titel: 'Paket A', rang: 1 }, { id: 'p', elternId: 'w', titel: 'Aufbau', rang: 1 }, { id: 't', elternId: 'p', titel: 'Skripte', rang: 1 },
      { id: 's', elternId: 't', titel: 'Leitfaden', rang: 1 }, { id: 'b', elternId: 's', titel: 'Leitfaden', rang: 1, bausteinId: 'fb-1' },
    ] };
    expect(bausteinOrte([v, { ...v, art: 'landkarte', titel: 'Karte' }])).toEqual({ 'fb-1': { pakete: ['Paket A'], phasen: ['Aufbau'] } });
  });

  it('Landkarte: genau zwei beschriftete Pfeile (Weg des Kunden nach oben, zurück in den Kreis)', () => {
    const l = landkarteLage(MUSTER_LANDKARTE, {}, 960);
    expect(l.pfeile.map(p => [p.art, p.text])).toEqual([['kreislauf', 'Weg des Kunden'], ['zurueck', 'Zurück in den Kreis']]);
    for (const p of l.pfeile) expect(Number.isFinite(p.tx) && Number.isFinite(p.ty)).toBe(true);
  });
});

describe('Analyse: Wellen-Bild, nächster Lauf, gemeinsame Gründe', () => {
  const a = (id: 'a0' | 'a1' | 'a2' | 'a6' | 'tb', welle: number, zustand: 'bereit' | 'gesperrt' | 'laeuft', letzter?: string, x: { gruende?: string[]; hinweise?: string[] } = {}) =>
    ({ id, welle, zustand, ...(letzter ? { letzter } : {}), grundNoetig: false, gruende: x.gruende ?? [], hinweise: x.hinweise ?? [] });

  it('Wellen 0–3 mit Stufe je Agent (Ergebnis vor Zustand)', () => {
    const w = wellenBild([a('a0', 0, 'bereit', 'uebernommen'), a('a1', 1, 'bereit', 'fertig'), a('a2', 1, 'gesperrt'), a('a6', 2, 'laeuft')]);
    expect(w.map(x => x.titel)).toEqual(['Start', 'Unternehmen', 'Vertiefung', 'Synthese und Prüfung']);
    expect(w[1].agenten.map(x => x.stufe)).toEqual(['entwurf', 'gesperrt']);
    expect(w[0].agenten[0].stufe).toBe('uebernommen');
    expect(w[2].agenten[0].stufe).toBe('laeuft');
  });

  it('nächster Lauf: erster bereiter des Minimalsets ohne Ergebnis; der Tiefenbericht nie', () => {
    const l = [a('tb', 1, 'bereit'), a('a0', 0, 'bereit', 'uebernommen'), a('a2', 1, 'bereit'), a('a1', 1, 'bereit')];
    expect(naechsterLauf(l, ['a0', 'a1', 'a2'])?.id).toBe('a1');
    expect(naechsterLauf([a('tb', 1, 'bereit')], [])).toBeNull();
  });

  it('gemeinsame Sätze stehen einmal oben — in der Zeile bleibt nur das Eigene', () => {
    const ki = 'Kein KI-Zugang eingerichtet.';
    const l = [1, 2, 3].map(() => a('a1', 1, 'gesperrt', undefined, { gruende: [`Erst A2. ${ki}`] }));
    const g = new Set(gemeinsameSaetze(l));
    expect(g.has(ki)).toBe(true);
    expect(ohneGemeinsame(`Erst A0. ${ki}`, new Set([ki]))).toBe('Erst A0.');
  });
});

describe('Zeichen-Bausteine rendern (ohne Browser)', () => {
  const r = fallReise(fall(), FREIGABEN, HEUTE);
  it('Phasen-Strahl: „Sie sind hier“, Freigabe in Klartext, aria-current an der laufenden Phase', () => {
    const html = renderToStaticMarkup(h(PhasenStrahl, { phasen: r.phasen, onPhase: () => {} }));
    expect(html).toContain('Sie sind hier');
    expect(html).toContain('F3 · Diagnose-Abnahme');
    expect(html).toContain('aria-current="step"');
  });
  it('Mini-Strahl: „Phase n von m“; Wert-Balken ohne Messung ein leiser Satz; Wellen kompakt mit Text für Vorleser', () => {
    expect(renderToStaticMarkup(h(MiniStrahl, { phasen: r.phasen }))).toContain('Phase 2 von 3 · Diagnose');
    expect(renderToStaticMarkup(h(WertBalken, { wert: null }))).toContain('noch keine Messung');
    expect(renderToStaticMarkup(h(WertBalken, { wert: 63, ziele: 2, kompakt: true }))).toContain('63 % des Wegs');
    const w = renderToStaticMarkup(h(WellenBild, { kompakt: true, wellen: wellenBild([{ id: 'a0', welle: 0, zustand: 'bereit', letzter: 'uebernommen' }]) }));
    expect(w).toContain('A0 im Dossier');
  });
});
