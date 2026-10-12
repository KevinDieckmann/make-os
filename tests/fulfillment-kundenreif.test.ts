// ─── Fulfillment — kundenreif (12.10.): keine losen Enden, Antworten zuerst, „Dem Kunden zeigen“, ruhige Marken ────────────────────────────────
// Rückmeldung 12.10.: „Kann ich das einem Kunden zeigen? … keine losen Enden, alles strukturiert sauber — auch aus der Visualisierung heraus.“
//   · Rechnung der neuen Antworten und Bilder (lib/fulfillment/prozesse/ansichten.ts): Verweise der Schritte, Stakeholder-Raster, Entscheidungs-Strahl,
//     Takt-Leiste (nie ein erfundener Termin), Report-Achse, Puls ↔ Health, Nachsorge-Plan, Kreislauf-Stand, der Handgriff am Ende.
//   · Analyse → Fall (lib/fulfillment/analyse/nach-fall.ts): nur, was noch nicht im Fall steht; Maßnahmen in die Phase nach der Diagnose.
//   · Nachtragen (`am`) an den Fall-Ops — nie in der Zukunft.
//   · Ablauf: der Sammel-Teilprozess „Weitere Bausteine“ ist keine doppelte Überschrift.
//   · WÄCHTER „Dem Kunden zeigen“: die Präsentation zeigt GENAU die Kunden-Ansicht der Positivliste — nichts Internes.
//   · Die vier Reiter rendern Antwort zuerst, Bild statt Liste, EINE Hauptaktion.
// Erfundene Daten, rein — keine Route, kein Netz.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/mandate/fulfillment' }));
const lese = vi.hoisted(() => ({ fall: null as unknown }));
vi.mock('@/components/os/fulfillment/prozesse/daten', async orig => ({
  ...(await orig<typeof import('@/components/os/fulfillment/prozesse/daten')>()),
  useFall: () => ({ daten: lese.fall, fehler: null, laden: async () => {} }),
}));

import {
  schrittVerweis, stakeholderLage, stakeholderRaster, entscheidungsStrahl, entscheidungsLage, taktLeiste, taktLage, reportAchse, reportLage, pulsReihe,
  nachsorgePlan, kreislaufStand, abschlussSchritt, kreislaufLage, montagVon,
} from '@/lib/fulfillment/prozesse/ansichten';
import { diagnoseUebergabe, massnahmenOps, massnahmenPhase, massnahmeTitel } from '@/lib/fulfillment/analyse/nach-fall';
import { fallAnwenden, fallStartTag, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { phaseGruppen } from '@/lib/fulfillment/prozesse/reise';
import { kundenSicht, kundeHinweis, SICHT_SCHLUESSEL, type SichtEingabe } from '@/lib/fulfillment/kunde/sicht';
import { leerKunde } from '@/lib/fulfillment/lesen';
import { tagPlus } from '@/lib/kalender/zeit';
import type { Baustein, Dossier, Fall, FallKnoten } from '@/lib/fulfillment/typen';
import { PraesentationInhalt, PRAESENTATION_QUELLE } from '@/components/os/fulfillment/reise/Praesentation';
import { KundenAnsicht } from '@/components/os/fulfillment/kunde/KundenAnsicht';
import { BausteinMarken } from '@/components/os/fulfillment/prozesse/teile';
import { FallMenschen } from '@/components/os/fulfillment/prozesse/FallMenschen';
import { FallTakt } from '@/components/os/fulfillment/prozesse/FallTakt';
import { FallKreislauf } from '@/components/os/fulfillment/prozesse/FallKreislauf';

const HEUTE = '2026-10-12'; // ein Montag
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x });

describe('Verweise der Schritte (lose Enden im Ablauf)', () => {
  it('Quick Wins, Befähigung, Wirkungsbericht, Diagnosebericht, Dossier — am Titel bzw. an der Kennung des Musters; sonst nichts', () => {
    expect(schrittVerweis({ id: 'fk-muster-p1-diagnose-quickwins', titel: 'Quick Wins' })).toBe('quickwins');
    expect(schrittVerweis({ id: 'x', titel: 'Befähigung „läuft ohne uns“' })).toBe('befaehigung');
    expect(schrittVerweis({ id: 'fk-muster-p1-uebergabe-wirkung', titel: 'Abschlussbericht' })).toBe('wirkung');
    expect(schrittVerweis({ id: 'y', titel: 'Diagnosebericht' })).toBe('diagnose');
    expect(schrittVerweis({ id: 'fk-muster-p1-analyse-dossier', titel: 'Dossier' })).toBe('dossier');
    expect(schrittVerweis({ id: 'z', titel: 'Leitfaden schreiben' })).toBeNull();
  });
});

describe('Menschen: Raster und Strahl', () => {
  it('Raster Einfluss 3→1 × Haltung (offen, wenn keine); die Antwort warnt bei fehlendem Entscheider und kritischer Stimme mit Einfluss', () => {
    const r = stakeholderRaster([{ id: 'a', einfluss: 3, haltung: 'positiv' }, { id: 'b', einfluss: 1 }]);
    expect(r).toHaveLength(12);
    expect(r.find(z => z.einfluss === 3 && z.haltung === 'positiv')!.ids).toEqual(['a']);
    expect(r.find(z => z.einfluss === 1 && z.haltung === 'offen')!.ids).toEqual(['b']);
    expect(stakeholderLage([]).ampel).toBe('rot');
    expect(stakeholderLage([{ rolle: 'nutzer', einfluss: 2 }]).antwort).toBe('Kein Entscheider auf der Karte');
    expect(stakeholderLage([{ rolle: 'entscheider', einfluss: 3, haltung: 'positiv' }, { rolle: 'skeptiker', einfluss: 2, haltung: 'kritisch' }]).ampel).toBe('rot');
    expect(stakeholderLage([{ rolle: 'entscheider', einfluss: 3, haltung: 'positiv' }]).ampel).toBe('gruen');
  });

  it('Entscheidungs-Strahl: ältester links, offene mit Frist als Strecke, überfällig erkannt; Antwort nennt, was beim Kunden liegt', () => {
    const s = entscheidungsStrahl([
      { id: 'e1', titel: 'Zielgruppe', am: '2026-09-01', status: 'entschieden', wer: 'beide', geteilt: true },
      { id: 'e2', titel: 'Angebot', am: '2026-10-08', status: 'offen', wer: 'kunde', geteilt: true, frist: '2026-10-17' },
      { id: 'e3', titel: 'Preise', am: '2026-09-20', status: 'offen', wer: 'kunde', geteilt: false, frist: '2026-10-01' },
    ], HEUTE);
    expect(s.punkte.map(p => p.id)).toEqual(['e1', 'e3', 'e2']);
    expect(s.punkte[0].x).toBe(0);
    expect(s.punkte.find(p => p.id === 'e2')!.fristX).toBe(1);
    expect(s.ueberfaellig).toBe(1);
    expect(entscheidungsLage(s).ampel).toBe('rot');
    const ohne = entscheidungsStrahl([{ id: 'e2', titel: 'Angebot', am: '2026-10-08', status: 'offen', wer: 'kunde', geteilt: true, frist: '2026-10-17' }], HEUTE);
    expect(entscheidungsLage(ohne)).toMatchObject({ ampel: 'gelb', antwort: '1 Entscheidung beim Kunden' });
  });
});

describe('Takt: Kalender-Leiste ohne erfundene Termine', () => {
  const rituale = [
    { id: 'r-woche', titel: 'Wochen-Check', rhythmus: 'woche' as const, dauerMin: 15 },
    { id: 'r-steering', titel: 'Steering', rhythmus: 'monat' as const, dauerMin: 60 },
    { id: 'r-kick', titel: 'Kick-off', rhythmus: 'einmal' as const, dauerMin: 90 },
  ];
  it('ein echter Termin + im Rhythmus erwartete; ohne Termin leer; der nächste echte Termin ist die Antwort', () => {
    const l = taktLeiste({ rituale, fallRituale: [{ ritualId: 'r-woche', terminUids: ['u1'] }, { ritualId: 'r-kick', terminUids: ['u0'] }], termine: { 'r-woche': '2026-10-13' }, heute: HEUTE });
    expect(l.wochen[0]).toBe(montagVon(HEUTE));
    expect(l.wochen).toHaveLength(6);
    const w = l.zeilen.find(z => z.ritualId === 'r-woche')!;
    expect(w.tage[0]).toEqual({ tag: '2026-10-13', erwartet: false });
    expect(w.tage.slice(1).every(t => t.erwartet)).toBe(true);
    expect(w.tage.map(t => t.tag)).toContain('2026-10-20');
    expect(l.zeilen.find(z => z.ritualId === 'r-steering')!.tage).toEqual([]); // ohne Termin: nichts erfunden
    expect(l.naechster).toEqual({ titel: 'Wochen-Check', tag: '2026-10-13' });
    expect(l.ohneTermin).toBe(1);
    expect(taktLage(l, HEUTE, '2026-10-09')).toMatchObject({ ampel: 'gelb', antwort: 'Nächster Termin: Wochen-Check morgen' });
    expect(taktLage(taktLeiste({ rituale, fallRituale: [], termine: {}, heute: HEUTE }), HEUTE).ampel).toBe('rot');
  });
});

describe('Kunde & Reports: Report-Achse, Puls ↔ Health', () => {
  it('Reports als Punkte, Soll im Zwei-Wochen-Takt (erfüllt/offen), nächster fällig = letzter + 14', () => {
    const a = reportAchse({ start: '2026-08-28', heute: HEUTE, reports: [{ am: '2026-09-14T10:00:00Z' }, { am: '2026-09-28T10:00:00Z' }], gesendetAm: '2026-09-28' });
    expect(a.reports.map(r => [r.tag, r.gesendet])).toEqual([['2026-09-14', true], ['2026-09-28', true]]);
    expect(a.naechsterFaellig).toBe('2026-10-12');
    expect(a.takt[0]).toMatchObject({ tag: '2026-09-11', erfuellt: false });
    expect(a.takt.find(t => t.tag === '2026-09-25')!.erfuellt).toBe(true);
    expect(reportLage(a, HEUTE)).toMatchObject({ ampel: 'gelb', antwort: 'Report heute fällig' });
    expect(reportLage(reportAchse({ start: '2026-08-01', heute: HEUTE, reports: [] }), HEUTE)).toMatchObject({ ampel: 'rot', antwort: 'Noch kein Report gesendet' });
  });

  it('Puls-Verlauf ältester links; weicht die Health vom letzten Puls ab, ist „übernehmen“ der Vorschlag (Puls × 10)', () => {
    const r = pulsReihe([{ am: '2026-10-12T09:00:00Z', wert: 8 }, { am: '2026-09-26T09:00:00Z', wert: 7, satz: 'gut' }], 70);
    expect(r.punkte.map(p => [p.tag, p.x])).toEqual([['2026-09-26', 0], ['2026-10-12', 1]]);
    expect(r).toMatchObject({ letzter: { wert: 8 }, health: 70, healthPasst: false, vorschlagHealth: 80 });
    expect(pulsReihe([{ am: '2026-10-12T09:00:00Z', wert: 8 }], 80).healthPasst).toBe(true);
  });
});

describe('Kreislauf und Abschluss: was nach dem letzten Schritt kommt', () => {
  it('Nachsorge-Plan: ohne Mandatsende „wartet“, danach Datum; vorgeschlagen über die Marke des Morgenlaufs', () => {
    expect(nachsorgePlan({ mandatId: 'm', ende: null, tage: [14, 45, 90], marken: {}, heute: HEUTE }).map(p => [p.tag, p.art, p.zustand])).toEqual([[14, 'checkin', 'wartet'], [45, 'empfehlung', 'wartet'], [90, 'stufe', 'wartet']]);
    const p = nachsorgePlan({ mandatId: 'm', ende: '2026-09-01', tage: [14, 45, 90], marken: { 'nachsorge:m:14': '2026-09-15' }, heute: HEUTE });
    expect(p.map(x => [x.am, x.zustand])).toEqual([['2026-09-15', 'vorgeschlagen'], ['2026-10-16', 'kommt'], ['2026-11-30', 'kommt']]);
  });

  it('Kreislauf-Stand: läuft → Fulfillment, abgeschlossen → nach der Leistung, Nachsorge durch → Wiederkauf', () => {
    expect(kreislaufStand({ status: 'laeuft' }, [])).toBe('fulfillment');
    expect(kreislaufStand({ status: 'abgeschlossen' }, [{ zustand: 'kommt' }])).toBe('nachher');
    expect(kreislaufStand({ status: 'abgeschlossen' }, [{ zustand: 'vorgeschlagen' }, { zustand: 'vorgeschlagen' }])).toBe('wiederkauf');
  });

  it('der Handgriff am Ende: abschließen → Wirkungsbericht → Mandat beenden → Nachsorge; solange Phasen offen sind, keiner', () => {
    expect(abschlussSchritt({ fall: { status: 'laeuft' }, allePhasenFertig: false, mandatEnde: null, nachsorge: [] })).toBeNull();
    expect(abschlussSchritt({ fall: { status: 'laeuft' }, allePhasenFertig: true, mandatEnde: null, nachsorge: [] })?.art).toBe('abschliessen');
    expect(abschlussSchritt({ fall: { status: 'abgeschlossen' }, allePhasenFertig: true, mandatEnde: null, nachsorge: [] })?.art).toBe('wirkung');
    expect(abschlussSchritt({ fall: { status: 'abgeschlossen', wirkung: { erstelltAm: HEUTE } }, allePhasenFertig: true, mandatEnde: null, nachsorge: [] })?.art).toBe('mandat-beenden');
    const plan = nachsorgePlan({ mandatId: 'm', ende: '2026-10-01', tage: [14, 45, 90], marken: {}, heute: HEUTE });
    expect(abschlussSchritt({ fall: { status: 'abgeschlossen', wirkung: { erstelltAm: HEUTE } }, allePhasenFertig: true, mandatEnde: '2026-10-01', nachsorge: plan })?.text).toBe('Nachsorge: Check-in nach dem Mandat am 15.10.');
    expect(kreislaufLage('fulfillment', null).ampel).toBe('gruen');
  });
});

describe('Analyse → Fall: nur Neues, Maßnahmen in die Phase nach der Diagnose', () => {
  const fall = {
    knoten: [k('w', undefined, 'Paket', 1), k('p1', 'w', 'Analyse', 1), k('p2', 'w', 'Diagnose', 2), k('p3', 'w', 'Aufbau', 3), k('x', 'p3', 'Erstgespräche mit fester Agenda und Bedarfsfragen führen.', 1, { extra: true })],
    quickWins: [{ id: 'q', text: 'Agenda für Erstgespräche einführen', bis: HEUTE, quelle: 'analyse' as const }],
    kickoffFragen: [],
  };
  const diagnose: NonNullable<Dossier['diagnose']> = {
    top5: [
      { id: 'm1', text: 'Erstgespräche mit fester Agenda und Bedarfsfragen führen.', hebel: 'umwandlung', wirkung: 'mehr Angebote', aufwand: 'klein', evidenz: 'B' },
      { id: 'm2', text: 'Wartungsverträge aktiv in jedes Angebot aufnehmen.', hebel: 'dealwert', wirkung: 'höherer Auftragswert', aufwand: 'mittel', evidenz: 'B' },
    ],
    quickWins: ['Agenda für Erstgespräche einführen', 'Kontakt-Knopf auf der Startseite'],
    fragen: [{ frage: 'Wer führt die Erstgespräche?', an: 'vertrieb', warum: 'x' }],
  };
  it('was schon im Fall steht, kommt nicht doppelt; Ziel ist die Phase nach „Diagnose“', () => {
    const u = diagnoseUebergabe(diagnose, fall);
    expect(u.quickWins).toEqual(['Kontakt-Knopf auf der Startseite']);
    expect(u.fragen).toHaveLength(1);
    expect(u.massnahmen.map(m => m.id)).toEqual(['m2']);
    expect(u.ziel).toEqual({ id: 'p3', titel: 'Aufbau' });
    expect(massnahmenPhase({ knoten: fall.knoten.filter(x => x.id !== 'p3' && x.id !== 'x') })?.id).toBe('p1'); // ohne Phase danach: die aktuelle
    const ops = massnahmenOps(u.massnahmen, 'p3');
    expect(ops).toEqual([{ op: 'knoten-extra', eintrag: { elternId: 'p3', titel: 'Wartungsverträge aktiv in jedes Angebot aufnehmen.', ergebnis: 'höherer Auftragswert', kundeSichtbar: false } }]);
  });
  it('ein zu langer Maßnahmen-Text wird an einer Wortgrenze gekürzt — der volle Text steht im Ziel', () => {
    const lang = `${'Sehr lange Maßnahme '.repeat(10)}Ende.`;
    const t = massnahmeTitel(lang);
    expect(t.titel.length).toBeLessThanOrEqual(120);
    expect(t.titel.endsWith('…')).toBe(true);
    expect(t.ziel).toBe(lang);
  });
});

describe('Fall-Ops: nachtragen (`am`), nie in der Zukunft', () => {
  const basis: Fall = {
    mandatId: 'm', vorlageId: 'v', vorlageFassung: 1, gestartetAm: `${HEUTE}T08:00:00Z`, startAm: '2026-08-28', gestartetVon: 'p', status: 'laeuft',
    knoten: [k('w', undefined, 'Paket', 1), k('p1', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k('s1', 'p1', 'Kick-off', 1)],
    freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [{ id: 'q1', text: 'QW', bis: HEUTE, quelle: 'hand' }], kickoffFragen: [], wertKonto: {},
    befaehigung: [{ id: 'bf-1', text: 'Kriterium', erfuellt: false }], marken: {}, geaendert: '', geaendertVon: 'p',
  };
  const ctx: FallKontext = { person: 'p', jetzt: `${HEUTE}T09:00:00Z`, heute: HEUTE, standVon: () => 's', neueId: p => `${p}-neu`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['F0'] };
  it('erledigt, Freigabe, Entscheidung, Quick Win und Befähigung tragen den nachgetragenen Tag; Zukunft → 400', () => {
    const r = fallAnwenden(basis, [
      { op: 'knoten-status', id: 's1', status: 'erledigt', am: '2026-08-31' },
      { op: 'freigabe', id: 'F0', kunde: { wie: 'kickoff', am: '2026-08-31' }, am: '2026-08-31' },
      { op: 'entscheidung', eintrag: { titel: 'Zielgruppe', status: 'entschieden', wer: 'beide', geteilt: true, am: '2026-09-02' } },
      { op: 'quickwin', id: 'q1', erledigt: true, am: '2026-09-20' },
      { op: 'befaehigung', id: 'bf-1', erfuellt: true, am: '2026-10-01' },
    ], ctx);
    if (!r.ok) throw new Error(r.fehler);
    expect(r.datei.knoten.find(x => x.id === 's1')).toMatchObject({ status: 'erledigt', erledigtAm: '2026-08-31' });
    expect(r.datei.freigaben.F0.am).toBe('2026-08-31');
    expect(r.datei.entscheidungen[0].am).toBe('2026-09-02');
    expect(r.datei.quickWins[0].erledigtAm).toBe('2026-09-20');
    expect(r.datei.befaehigung[0].am).toBe('2026-10-01');
    expect(fallStartTag(r.datei)).toBe('2026-08-28');
    const zukunft = fallAnwenden(basis, [{ op: 'knoten-status', id: 's1', status: 'erledigt', am: tagPlus(HEUTE, 1) }], ctx);
    expect(zukunft.ok).toBe(false);
    // ohne `am` wie bisher: heute
    const heute = fallAnwenden(basis, [{ op: 'quickwin', id: 'q1', erledigt: true }], ctx);
    expect(heute.ok && heute.datei.quickWins[0].erledigtAm).toBe(HEUTE);
  });
});

describe('Ablauf: der Sammel-Teilprozess „Weitere Bausteine“ ist keine eigene Überschrift', () => {
  it('Schritte unter „Weitere Bausteine“ (bzw. gleichnamig mit der Phase) stehen direkt in der Phase; echte Teilprozesse bleiben Gruppe', () => {
    const l = [
      k('w', undefined, 'Paket', 1), k('p', 'w', 'Umsetzung', 1),
      k('t1', 'p', 'Weitere Bausteine', 1), k('s1', 't1', 'Wochenplan Vertrieb', 1), k('b1', 's1', 'Wochenplan Vertrieb', 1, { bausteinId: 'fb-1' }),
      k('t2', 'p', 'Skripte', 2), k('s2', 't2', 'Anruf-Skript', 1),
      k('t3', 'p', 'Umsetzung', 3), k('s3', 't3', 'Kartei-Pflege', 1),
    ];
    const g = phaseGruppen({ knoten: l }, 'p', HEUTE);
    expect(g.map(x => x.teil?.titel ?? null)).toEqual([null, 'Skripte', null]);
    expect(g[0].zeilen.map(z => z.knoten.titel)).toEqual(['Wochenplan Vertrieb']);
    expect(g[0].zeilen[0].bausteine.map(b => b.id)).toEqual(['b1']); // der Baustein hängt am Schritt, keine zweite Zeile
  });
});

// ── WÄCHTER „Dem Kunden zeigen“ ──────────────────────────────────────────────────────────────────────────────────────────────────────

const B = (id: string, extra: Partial<Baustein> & Record<string, unknown> = {}): Baustein => ({
  id, art: 'formular', titel: `Formular ${id.slice(3)}`, gliederung: ['GLIEDERUNG-INTERN'], text: 'TEXT-INTERN', platzhalter: [], tags: ['TAG-INTERN'], wer: 'kunde', kundeSichtbar: true, kundeFuellt: true,
  hinweis: 'HINWEIS-INTERN', warum: 'WARUM-INTERN', fassung: 1, geaendert: '', geaendertVon: 'person-intern', fragen: [{ id: 'q1', abschnitt: 'A', frage: 'Frage eins?', art: 'text' }], ...extra,
} as Baustein);
const VOLL: Fall = {
  mandatId: 'm-1', vorlageId: 'fp-x', vorlageFassung: 3, gestartetAm: '2026-09-01T00:00:00Z', gestartetVon: 'person-intern', status: 'laeuft',
  knoten: [
    k('w', undefined, 'Wurzel', 1),
    k('p1', 'w', 'Phase sichtbar', 1, { status: 'in_arbeit', kundeSichtbar: true, ziel: 'ZIEL-INTERN', ergebnis: 'ERGEBNIS-INTERN', kennzahl: 'KENNZAHL-INTERN', freigabe: 'F3' }),
    k('p2', 'w', 'PHASE-INTERN', 2),
    k('s1', 'p1', 'SCHRITT-INTERN', 1, { status: 'erledigt', erledigtAm: '2026-10-08' }),
    k('s2', 'p1', 'Schritt sichtbar', 2, { kundeSichtbar: true, faelligAm: '2026-10-20' }),
    k('s3', 'p1', 'MASSNAHME-INTERN', 3, { extra: true, kundeSichtbar: false }),
    k('b2', 's2', 'BAUSTEIN-NURINTERN', 1, { bausteinId: 'fb-nurintern', kundeSichtbar: true }),
  ],
  freigaben: { F0: { am: '2026-09-02', von: 'person-intern', notiz: 'FREIGABE-NOTIZ' } }, onboarding: {},
  vereinbarung: { rollen: 'VEREINBARUNG-INTERN', eskalation: 'ESKALATION-INTERN' },
  stakeholder: [{ id: 'fs-1', kontaktId: 'c-geheim', rolle: 'skeptiker', einfluss: 3, haltung: 'kritisch', notiz: 'STAKEHOLDER-NOTIZ' }],
  entscheidungen: [{ id: 'fe-1', am: '2026-10-02', titel: 'Geteilt', status: 'entschieden', wer: 'beide', geteilt: true, von: 'person-intern' }, { id: 'fe-2', am: '2026-10-02', titel: 'ENTSCHEIDUNG-INTERN', status: 'offen', wer: 'kunde', geteilt: false, von: 'person-intern' }],
  rituale: [{ ritualId: 'fr-1', terminUids: ['TERMIN-UID-INTERN'], angelegtAm: '2026-09-02' }],
  mitschriften: [{ id: 'fn-1', am: '2026-10-01', anlass: 'MITSCHRIFT-INTERN', ergebnis: 'MITSCHRIFT-ERGEBNIS', naechster: 'y', von: 'person-intern' }],
  quickWins: [], kickoffFragen: [{ id: 'fx-1', frage: 'KICKOFF-INTERN', an: 'gruender', quelle: 'analyse' }],
  wertKonto: { z1: { ausgang: 'wenig', zielZahl: 10, festgelegtAm: '2026-09-02', messungen: [{ am: '2026-10-01', wert: 5, quelle: 'hand' }] } },
  befaehigung: [{ id: 'bf-1', text: 'BEFAEHIGUNG-INTERN', erfuellt: false }], wirkung: { erstelltAm: '2026-10-01', zitat: { text: 'ZITAT-INTERN', einwilligungAm: '2026-10-01', wie: 'mail' } },
  marken: { m: 'MARKE-INTERN' }, geaendert: '', geaendertVon: 'person-intern',
};
const EINGABE: SichtEingabe = {
  modus: 'voll', heute: HEUTE,
  mandat: { id: 'm-1', titel: 'Mandat Eins', kunde: 'Erfundene Werke GmbH', ziele: [{ id: 'z1', text: 'Termine', ziel: '10', ist: '4' }], honorar: { betrag: 77777 }, health: { stimmung: 12 }, notiz: 'MANDAT-NOTIZ' } as never,
  paket: 'Paket Eins', fall: VOLL, bausteine: [B('fb-nurintern', { tags: ['nur-intern'] })], marken: { m: 'MARKE-INTERN' },
  rituale: [{ id: 'fr-1', titel: 'Wochen-Check', rhythmus: 'woche', dauerMin: 15, agenda: ['AGENDA-INTERN'], teilnehmende: ['intern'], geaendert: '', geaendertVon: '' }],
  kunde: { ...leerKunde(), unterlagen: [{ id: 'ud-1', mandatId: 'm-1', name: 'DATEINAME-INTERN.pdf', typ: 'application/pdf', groesse: 1, am: '2026-10-01', herkunft: 'kunde', zweck: 'sonstig', status: 'ungeprueft' }] },
  rechte: { formular: true, upload: true, puls: true }, standVon: () => 'stand-1',
  datenschutz: kundeHinweis({ verantwortlich: 'Erfundene Firma, Musterweg 1, 12345 Musterstadt', seite: null, mandatsdatenMonate: 12, unterlagenTage: 90 }), uploadFrei: 19,
};
const INTERN = ['STAKEHOLDER-NOTIZ', 'c-geheim', 'kritisch', 'VEREINBARUNG-INTERN', 'ESKALATION-INTERN', 'ENTSCHEIDUNG-INTERN', 'MITSCHRIFT-INTERN', 'MITSCHRIFT-ERGEBNIS', 'TERMIN-UID-INTERN',
  'PHASE-INTERN', 'SCHRITT-INTERN', 'MASSNAHME-INTERN', 'BAUSTEIN-NURINTERN', 'ZIEL-INTERN', 'ERGEBNIS-INTERN', 'KENNZAHL-INTERN', 'FREIGABE-NOTIZ', 'BEFAEHIGUNG-INTERN', 'ZITAT-INTERN',
  'MARKE-INTERN', 'MANDAT-NOTIZ', '77777', 'DATEINAME-INTERN', 'AGENDA-INTERN', 'person-intern', 'TEXT-INTERN', 'HINWEIS-INTERN', 'WARUM-INTERN', 'GLIEDERUNG-INTERN',
  'nur intern', 'vor Verkauf', 'rechtlich prüfen', 'Health', 'Honorar', 'Dossier'];

describe('Wächter: „Dem Kunden zeigen“ zeigt nur die Kunden-Ansicht der Positivliste', () => {
  const sicht = kundenSicht(EINGABE);
  it('die Präsentation ist GENAU die Kunden-Ansicht (dieselbe Komponente, gesperrt) — keine zweite Filterlogik, kein eigenes Layout', () => {
    const html = renderToStaticMarkup(h(PraesentationInhalt, { sicht }));
    expect(html).toContain(renderToStaticMarkup(h(KundenAnsicht, { sicht })));
    expect(Object.keys(sicht).every(x => (SICHT_SCHLUESSEL as readonly string[]).includes(x))).toBe(true);
  });
  it('bei einem Fall VOLLER interner Daten steht nichts davon in der Präsentation', () => {
    const html = renderToStaticMarkup(h(PraesentationInhalt, { sicht }));
    expect(html).toContain('Erfundene Werke GmbH');
    expect(html).toContain('Schritt sichtbar');
    for (const x of INTERN) expect(html, x).not.toContain(x);
    // nichts auszufüllen: jedes Feld der Kunden-Ansicht ist gesperrt (ohne Aktionen = Vorschau-Modus der Komponente)
    for (const feld of html.match(/<(input|textarea|select)\b[^>]*>/g) ?? []) expect(feld).toContain('disabled');
  });
  it('die Präsentation holt ihre Daten NUR über die Route der Kunden-Sicht und zeichnet NUR mit KundenAnsicht', () => {
    const src = readFileSync(path.join(process.cwd(), 'components/os/fulfillment/reise/Praesentation.tsx'), 'utf8');
    expect(PRAESENTATION_QUELLE).toBe('/api/fulfillment/kunde/vorschau');
    const fetches = [...src.matchAll(/fetch\((`[^`]*`|'[^']*')/g)].map(m => m[1]);
    expect(fetches).toEqual(['`${PRAESENTATION_QUELLE}?m=${encodeURIComponent(mandatId)}`', "'/api/crm/treppe/report'"]); // Daten nur von dort; das PDF ist der vorhandene Report-Weg (POST)
    expect(src).not.toMatch(/useFall|useCrm|useAnalyse|from '\.\.\/prozesse\/daten'|from '@\/lib\/fulfillment\/kunde\/server'/);
    expect(src).toMatch(/<KundenAnsicht sicht=\{sicht\} \/>/);
    expect(src).toMatch(/key === 'Escape'/);
  });
});

describe('Interne Marken ruhig: ein Zeichen mit Tooltip statt eines Chips', () => {
  it('kein sichtbarer Text „nur intern“ — die Bedeutung steht im Tooltip und für Vorleser', () => {
    const html = renderToStaticMarkup(h(BausteinMarken, { b: { nurIntern: true, rechtOffen: true, vorVerkaufOffen: true } }));
    expect(html.replace(/<[^>]+>/g, '')).toBe('');
    expect(html).toContain('title="Nur intern');
    expect(html).toContain('aria-label="Vor Einsatz rechtlich prüfen');
    expect(renderToStaticMarkup(h(BausteinMarken, { b: { nurIntern: false, rechtOffen: false, vorVerkaufOffen: false } }))).toBe('');
  });
});

// ── Die Reiter: Antwort zuerst, Bild statt Liste, EINE Hauptaktion ───────────────────────────────────────────────────────────────────

describe('Reiter Menschen, Takt, Abschluss & Kreislauf', () => {
  const s = (x: object) => ({ ...x, stand: 's' });
  const fall: Fall = {
    ...VOLL, mandatId: 'm-1', startAm: '2026-08-28', vereinbarung: { rollen: 'GF entscheidet', bestaetigtAm: '2026-09-02', bestaetigtWie: 'kickoff' },
    stakeholder: [{ id: 'fs-1', kontaktId: 'c-1', rolle: 'entscheider', einfluss: 3, haltung: 'positiv' }],
    entscheidungen: [{ id: 'fe-1', am: '2026-09-05', titel: 'Zielgruppe zuerst', status: 'entschieden', wer: 'beide', geteilt: true, von: 'p' }, { id: 'fe-2', am: '2026-10-08', titel: 'Neues Angebot', status: 'offen', wer: 'kunde', geteilt: true, frist: '2026-10-17', von: 'p' }],
    rituale: [{ ritualId: 'r-woche', terminUids: ['u1'], angelegtAm: '2026-09-02' }],
    mitschriften: [{ id: 'fn-1', am: '2026-10-09', anlass: 'Wochen-Check', ergebnis: 'Zwei neue Termine.', naechster: 'Angebot vorbereiten', frist: '2026-10-16', von: 'p' }],
    befaehigung: [{ id: 'bf-1', text: 'Zwei Abschlüsse ohne Gründer', erfuellt: true, am: '2026-10-04' }, { id: 'bf-2', text: 'Rhythmen ohne uns', erfuellt: false }], wirkung: undefined,
  };
  lese.fall = {
    inhaber: true, mandat: { id: 'm-1', titel: 'Begleitung', kunde: 'Beispiel GmbH', firmaId: 'f-1', kontaktIds: ['c-1'], leistungId: null, ziele: [], gesellschaft: 'ug', status: 'aktiv', start: '2026-08-27', zustaendig: null, business: true },
    unterschrift: null, fall: { ...fall, knoten: fall.knoten.map(s), stakeholder: fall.stakeholder.map(s), entscheidungen: fall.entscheidungen.map(s) },
    staende: { vereinbarung: 's', wertKonto: {} }, vorlage: { id: 'v', titel: 'Paket', fassung: 1, freigaben: [], rollen: [] },
    personen: [{ id: 'c-1', name: 'Erfundene Person', position: 'Geschäftsführerin', email: 'person@example.invalid', firmaId: 'f-1' }],
    rituale: [{ id: 'r-woche', titel: 'Wochen-Check', rhythmus: 'woche', dauerMin: 15, agenda: [], teilnehmende: ['intern'], geaendert: '', geaendertVon: '' }, { id: 'r-steering', titel: 'Steering', rhythmus: 'monat', dauerMin: 60, agenda: [], teilnehmende: ['intern'], geaendert: '', geaendertVon: '' }],
    termine: { 'r-woche': tagPlus(new Date().toISOString().slice(0, 10), 1) }, reports: [], followups: [{ id: 'fu-1', text: 'Nach einer Empfehlung fragen', faellig: '2026-10-20', status: 'offen' }],
    nachsorge: { ende: null, plan: nachsorgePlan({ mandatId: 'm-1', ende: null, tage: [14, 45, 90], marken: {}, heute: HEUTE }) },
  };
  const haupt = (html: string) => (html.match(/ui-knopf-haupt/g) ?? []).length;

  it('Menschen: drei Antworten, Raster Einfluss × Haltung, Entscheidungen als Zeitstrahl, Vereinbarung als Zusammenfassung — EINE Hauptaktion', () => {
    const html = renderToStaticMarkup(h(FallMenschen, { mandatId: 'm-1' }));
    expect(html).toContain('Wer trägt das Projekt?');
    expect(html).toContain('Der Entscheider trägt das Projekt');
    expect(html).toContain('Stakeholder nach Einfluss und Haltung');
    expect(html).toContain('role="img" aria-label="Entscheidungen von');
    expect(html).toContain('Vereinbarung bestätigt am 02.09.');
    expect(html).not.toContain('<textarea'); // bestätigt → Zusammenfassung, Bearbeiten hinter „⋯“
    expect(haupt(html)).toBe(1);
  });

  it('Takt: „Wann sehen wir uns?“, Rituale als Kalender-Leiste (Steering ohne Termin = „+“), Mitschriften — EINE Hauptaktion', () => {
    const html = renderToStaticMarkup(h(FallTakt, { mandatId: 'm-1' }));
    expect(html).toContain('Wann sehen wir uns?');
    expect(html).toContain('Nächster Termin: Wochen-Check');
    expect(html).toContain('Steering: noch kein Termin — anlegen');
    expect(html).toContain('Was kam zuletzt heraus?');
    expect(html).not.toContain('Befähigung'); // steht seit 12.10. unter „Abschluss & Kreislauf“
    expect(haupt(html)).toBe(1);
  });

  it('Abschluss & Kreislauf: Kreislauf-Rad mit „hier steht …“, Befähigung, Wirkungsbericht, Nach der Leistung mit Nachsorge-Plan', () => {
    const html = renderToStaticMarkup(h(FallKreislauf, { mandatId: 'm-1' }));
    expect(html).toContain('Wo steht der Kunde im Kreislauf?');
    expect(html).toContain('In Lieferung');
    expect(html).toContain('hier steht dieser Kunde');
    expect(html).toContain('1 von 2 Kriterien erfüllt');
    expect(html).toContain('id="kreislauf-wirkung"');
    expect(html).toContain('Tag 14 · Check-in nach dem Mandat');
    expect(html).toContain('startet mit dem Mandatsende');
    expect(html).toContain('Nach einer Empfehlung fragen');
    expect(haupt(html)).toBe(1);
  });
});
