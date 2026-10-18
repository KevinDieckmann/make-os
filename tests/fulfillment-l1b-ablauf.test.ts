// ─── Fulfillment · Nachprüfung L1b (18.10.) — der Ablauf läuft an, EIN Stand je Fall ──────────────────────────────────────────────────────────────
// N2: ein neuer Fall bekam keine Ablauf-Aufgabe, bis die GANZE Phase 1 fertig war (auch das Kunden-Playbook und Bausteine ohne Form). Jetzt: nach fertigem
// Onboarding sofort die erste Aufgabe — und Reise, „hier“, Cockpit und Kunden-Seite sagen dasselbe wie die Ausführung. Dazu N5 (Kunden-Seite: kein Schritt der
// nächsten Phase unter „hier stehen wir“), N9 (abgeschlossen = kein „hier“), N10 (Zusatzmodul zählt nicht im Hauptstrahl), N11 (EINE Onboarding-Zählung),
// N13 (Kick-off „Termin steht anderswo“ sichtbar), N19 (die Bestätigung zählt für den Kunden als erledigt). Erfundene Daten, rein, kein Datenordner.
import { describe, it, expect } from 'vitest';
import type { Fall, FallKnoten, Freigabepunkt, ProzessKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';
import { MUSTER_FREIGABEN, MUSTER_P1, MUSTER_RITUALE } from '@/lib/fulfillment/muster';
import { fallStarten, fallAnwenden, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { fallWirksam, onboardingStand, onboardingZaehlung, kickoffVermerkText, obKnotenId, type OnboardingAbleitung } from '@/lib/fulfillment/prozesse/onboarding';
import { ablaufAktiv, aktiveKnoten, ausfuehrungSoll } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { alleSchritte, fallReise, fallStelle, naechsterPunkt, reiseKurz } from '@/lib/fulfillment/prozesse/reise';
import { reiseZeile } from '@/lib/fulfillment/prozesse/reise-bild';
import { cockpitZeile } from '@/lib/fulfillment/prozesse/cockpit';
import { taktLage, taktLeiste } from '@/lib/fulfillment/prozesse/ansichten';
import { aktuellerKnoten, ebeneVon, inReihenfolge, jetztPhasen, laeuftNebenher, phaseDurch, phaseFertig } from '@/lib/fulfillment/regeln';
import { kundenReise, kundenTeile } from '@/lib/fulfillment/kunde/bild';

const HEUTE = '2026-10-18';
const J = `${HEUTE}T09:00:00.000Z`;
let N = 0;
const neueId = (p: string) => `${p}-t${++N}`;
const ctx = (heute = HEUTE): FallKontext => ({ person: 'pia', jetzt: `${heute}T09:00:00.000Z`, heute, standVon: () => 's', neueId, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: MUSTER_FREIGABEN.map(f => f.id) });
const ok = (r: ReturnType<typeof fallAnwenden>): Fall => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };
const P1 = 'fk-muster-p1';

/** P1 aus dem Muster, dazu je Phase ein Sammel-Schritt mit Bausteinen ohne Form (wie der Import — „Kick-off-Agenda“, „Ziel-Workshop“). */
function vorlageMitBausteinen(): ProzessVorlage {
  const extra = (phase: string, n: number, titel: string): ProzessKnoten[] => [
    { id: `${P1}-${phase}-sammelteil`, elternId: `${P1}-${phase}`, titel: 'Weitere Bausteine', rang: 90 },
    { id: `${P1}-${phase}-sammel`, elternId: `${P1}-${phase}-sammelteil`, titel: 'Zugeordnete Bausteine', rang: 1 },
    { id: `${P1}-${phase}-b${n}`, elternId: `${P1}-${phase}-sammel`, titel, rang: 1, bausteinId: `bb-${n}` },
  ];
  return { ...MUSTER_P1, id: 'v-p1', knoten: [...MUSTER_P1.knoten, ...extra('vorlauf', 1, 'Kick-off-Agenda'), ...extra('analyse', 2, 'Ziel-Workshop vorbereiten'), ...extra('diagnose', 3, 'Zielkunden-Profil')] };
}
const id = (f: Pick<Fall, 'knoten'>, titel: string) => f.knoten.find(k => k.titel === titel)!.id;
const ableitung = (playbook: number | null): OnboardingAbleitung => ({ ziele: [{ id: 'z1', text: 'Abschlüsse je Monat', ziel: '8' }], formularProzent: playbook, kickoffRitualIds: [], unterschrift: '2026-10-16', willkommenStunden: 24, jetzt: J, kundenTermine: [] });

/** Ein frischer Fall; mit `onboardingFertig` sind alle zählenden Onboarding-Schritte erfüllt (Bestätigung 1 vermerkt), das Playbook läuft noch (40 %). */
function neuerFall(o: { onboardingFertig?: boolean } = {}): { f: Fall; w: Fall; abl: OnboardingAbleitung } {
  let f = fallStarten({ mandatId: 'm-neu', vorlage: vorlageMitBausteinen(), person: 'pia', jetzt: J, start: HEUTE, playbookId: 'bb-playbook', neueId });
  if (o.onboardingFertig) {
    f = {
      ...f, onboarding: { willkommenGesendetAm: J, willkommenVon: 'pia', kickoffAm: HEUTE, kickoffVon: 'pia' },
      vereinbarung: { bestaetigtAm: HEUTE, bestaetigtWie: 'kickoff' },
      stakeholder: [{ id: 'fs-1', kontaktId: 'c-1', rolle: 'entscheider', einfluss: 3 }],
      entscheidungen: [{ id: 'fe-1', am: HEUTE, titel: 'Start', status: 'entschieden', wer: 'beide', geteilt: true, von: 'pia' }],
      wertKonto: { z1: { ausgangZahl: 2, zielZahl: 8, zielBis: '2027-03-31', festgelegtAm: HEUTE, messungen: [] } } as never,
    };
    f = ok(fallAnwenden(f, [{ op: 'freigabe', id: 'F0' }], ctx()));
  }
  const abl = ableitung(40);
  return { f, w: fallWirksam(f, abl), abl };
}
const FREIGABEN: readonly Pick<Freigabepunkt, 'id' | 'titel' | 'wer'>[] = MUSTER_FREIGABEN;

describe('N2 · nach fertigem Onboarding läuft der Ablauf sofort an', () => {
  it('Onboarding fertig, Playbook und Bausteine offen → die erste Aufgabe der Analyse entsteht sofort', () => {
    const { f, w, abl } = neuerFall({ onboardingFertig: true });
    const st = onboardingStand(f, abl);
    expect(st.fertig).toBe(true);
    expect(st.schritte.find(s => s.schluessel === 'playbook')!.erfuellt).toBe(false);
    expect(w.status).toBe('laeuft');
    // Was noch offen ist, läuft nebenher — es ist weiter sichtbar, hält aber nichts an.
    const vorlauf = w.knoten.find(k => k.id === `${P1}-vorlauf`)!;
    expect(phaseFertig(vorlauf, w.knoten)).toBe(false);
    expect(phaseDurch(vorlauf, w.knoten)).toBe(true);
    expect(laeuftNebenher(w.knoten.find(k => k.id === obKnotenId('playbook'))!, w.knoten)).toBe(true);
    expect(laeuftNebenher(w.knoten.find(k => k.titel === 'Kick-off-Agenda')!, w.knoten)).toBe(true);
    expect(alleSchritte(w, vorlauf.id, HEUTE).filter(z => !z.fertig).map(z => z.knoten.titel)).toEqual(['Kunden-Playbook', 'Kick-off-Agenda']);

    expect(ablaufAktiv(w)).toBe(true);
    expect(aktiveKnoten(w).map(a => a.knoten.titel)).toEqual(['Analyse-Umfang']);
    const soll = ausfuehrungSoll(w, HEUTE);
    expect(soll.aufgaben).toEqual([expect.objectContaining({ titel: 'Analyse-Umfang', faellig: '2026-10-25', art: 'schritt' })]);
  });

  it('EIN Stand: Ausführung, „hier“, Reise, Cockpit und Kunden-Seite stehen in derselben Phase', () => {
    const { f, w, abl } = neuerFall({ onboardingFertig: true });
    const analyse = `${P1}-analyse`;
    expect(aktiveKnoten(w)[0].phaseId).toBe(analyse);
    expect(naechsterPunkt(w, FREIGABEN, HEUTE)).toMatchObject({ art: 'schritt', id: id(w, 'Analyse-Umfang'), phaseId: analyse });
    expect(aktuellerKnoten(w).phase!.id).toBe(analyse);
    const r = fallReise(w, FREIGABEN, HEUTE);
    expect(r.phasen.map(p => p.zustand).slice(0, 3)).toEqual(['fertig', 'jetzt', 'offen']);
    expect(fallStelle(w, FREIGABEN, HEUTE).phase).toMatchObject({ id: analyse, nr: 2, von: 8 });
    expect(reiseZeile({ fall: w, freigaben: FREIGABEN, heute: HEUTE }).hier).toEqual({ phaseId: analyse, id: id(w, 'Analyse-Umfang') });
    const c = cockpitZeile({ fall: w, kunde: 'Beispiel GmbH', titel: 'Begleitung', onboarding: onboardingStand(f, abl), health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN });
    expect(c).toMatchObject({ phase: 'Analyse', phaseNr: 2, phasenAnzahl: 8, schritt: 'Analyse-Umfang' });
    const t = kundenTeile({ fall: w, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: FREIGABEN });
    expect(t.phasen.slice(0, 2).map(p => [p.titel, p.stand])).toEqual([['Vorlauf / Onboarding', 'erledigt'], ['Analyse', 'aktuell']]);
    // Die Schritte des Musters sind nicht für Kunden sichtbar — nichts aus einer anderen Phase rückt nach (N5).
    expect(t.naechstes).toEqual([]);
  });

  it('Bausteine ohne Form halten eine spätere Phase nicht an — die Bestätigung schon, und dort steht auch „hier“', () => {
    const { w } = neuerFall({ onboardingFertig: true });
    let g = ok(fallAnwenden(w, [{ op: 'knoten-status', id: id(w, 'Analyse-Umfang'), status: 'erledigt' }, { op: 'knoten-status', id: id(w, 'Dossier'), status: 'erledigt' }], ctx()));
    const analyse = `${P1}-analyse`;
    // Der Ziel-Workshop (Baustein ohne Form) ist offen, die Phase ist durch — der Ablauf wartet auf Bestätigung 2 (intern), nicht auf den Baustein.
    expect(aktiveKnoten(g)).toEqual([]);
    expect(naechsterPunkt(g, FREIGABEN, HEUTE)).toMatchObject({ art: 'freigabe', freigabe: 'F2', phaseId: analyse });
    expect(aktuellerKnoten(g).phase!.id).toBe(analyse);
    expect(fallReise(g, FREIGABEN, HEUTE).phasen.map(p => p.zustand).slice(0, 3)).toEqual(['fertig', 'jetzt', 'offen']);
    expect(reiseZeile({ fall: g, freigaben: FREIGABEN, heute: HEUTE }).hier).toEqual({ phaseId: analyse, id: 'fg-F2' });
    g = ok(fallAnwenden(g, [{ op: 'freigabe', id: 'F2' }], ctx()));
    expect(aktiveKnoten(g).map(a => a.knoten.titel)).toEqual(['Diagnosebericht']);
    expect(ausfuehrungSoll(g, HEUTE).aufgaben.map(a => a.titel)).toEqual(['Diagnosebericht']);
    expect(fallReise(g, FREIGABEN, HEUTE).phasen.map(p => p.zustand).slice(0, 3)).toEqual(['fertig', 'fertig', 'jetzt']);
  });

  it('ein ausgeführter Schritt hält an, auch wenn darunter nur ein Baustein hängt (Mail-Entwurf) — er gehört zu seinem Schritt', () => {
    const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
    const f = { ...neuerFall().f, status: 'laeuft' as const, freigaben: {}, knoten: [
      // Wie im Editor: der Schritt (Ebene 4) im Strang der Phase, sein Baustein (Ebene 5) darunter.
      k('w', undefined, 'A', 1), k('p1', 'w', 'Angebot', 1), k('t1', 'p1', 'Angebot', 1), k('s1', 't1', 'Angebot senden', 1, { form: 'nachricht', frist: 2 }), k('m1', 's1', 'Angebots-Mail', 1, { bausteinId: 'bb-mail' }),
      k('p2', 'w', 'Start', 2), k('s2', 'p2', 'Zugänge', 1, { form: 'schritt', frist: 3 }),
    ] };
    expect(laeuftNebenher(f.knoten.find(x => x.id === 'm1')!, f.knoten)).toBe(false);
    expect(aktiveKnoten(f).map(a => a.knoten.id)).toEqual(['s1']);
    expect(naechsterPunkt(f, [], HEUTE)!.id).toBe('s1');
  });

  it('Phasen nur aus Bausteinen läuft der Ablauf durch — die Frist danach zählt ab der letzten Bestätigung, nicht ab dem Start des Falls', () => {
    const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
    const sammel = (p: string, n: number): FallKnoten[] => [k(`${p}-t`, p, 'Weitere Bausteine', 1), k(`${p}-s`, `${p}-t`, 'Zugeordnete Bausteine', 1), k(`${p}-b`, `${p}-s`, `Baustein ${n}`, 1, { bausteinId: `bb-${n}` })];
    const f: Fall = { ...neuerFall().f, status: 'laeuft', startAm: '2026-10-01', freigaben: { F0: { am: '2026-10-12', von: 'pia' } }, marken: { 'ablauf-aufgabe:x:0': 'x' }, knoten: [
      k('w', undefined, 'A', 1), k('p0', 'w', 'Vorlauf', 1, { freigabe: 'F0' }), k('s0', 'p0', 'Kick-off', 1, { status: 'erledigt', erledigtAm: '2026-10-10' }),
      k('p1', 'w', 'Analyse', 2), ...sammel('p1', 1), k('p2', 'w', 'Diagnose', 3), ...sammel('p2', 2),
      k('p3', 'w', 'Einführung', 4), k('s3', 'p3', 'Statusmodell', 1, { form: 'schritt', frist: 7 }),
    ] };
    const a = aktiveKnoten(f);
    expect(a.map(x => [x.knoten.id, x.ankunft, x.faellig])).toEqual([['s3', '2026-10-12', '2026-10-19']]);
    expect(fallReise(f, [], HEUTE).phasen.map(p => p.zustand)).toEqual(['fertig', 'fertig', 'fertig', 'jetzt']);
    expect(naechsterPunkt(f, [], HEUTE)!.id).toBe('s3');
  });

  it('Altbestand bleibt, wo nichts davon zutrifft: ohne Ausführung halten Bausteine weiter an; vor fertigem Onboarding steht alles in Phase 1', () => {
    // Die alte Regel (bis 18.10.): die erste Phase, die nicht fertig ist.
    const alt = (f: Pick<Fall, 'knoten'>) => inReihenfolge(f.knoten).find(k => ebeneVon(k, f.knoten) === 2 && !phaseFertig(k, f.knoten))?.id ?? null;
    const frisch = neuerFall().w;
    expect(aktuellerKnoten(frisch).phase!.id).toBe(alt(frisch));
    // Im Onboarding hält der erste offene Onboarding-Schritt die Bahn (ohne Aufgabe — er wird abgeleitet), wie bisher.
    expect(aktiveKnoten(frisch).map(a => [a.knoten.id, a.art])).toEqual([[obKnotenId('willkommen'), null]]);
    expect(ausfuehrungSoll(frisch, HEUTE).aufgaben).toEqual([]);
    // Ohne jede Form (Altbestand): Bausteine sind die Arbeit — sie halten weiter an, „hier“ bleibt, wo es war.
    const ohneForm = (f: Fall): Fall => ({ ...f, knoten: f.knoten.map(({ form: _f, frist: _x, ...r }) => r as FallKnoten) });
    const { f, abl } = neuerFall({ onboardingFertig: true });
    const w0 = fallWirksam(ohneForm(f), { ...abl, formularProzent: 100 });
    expect(ablaufAktiv(w0)).toBe(false);
    expect(aktuellerKnoten(w0).phase!.id).toBe(alt(w0));
    expect(aktuellerKnoten(w0).phase!.id).toBe(`${P1}-vorlauf`);
    expect(naechsterPunkt(w0, FREIGABEN, HEUTE)!.titel).toBe('Kick-off-Agenda');
  });
});

describe('N5 · Kunden-Seite: kein Schritt der nächsten Phase unter „hier stehen wir“', () => {
  it('ist der nächste Punkt nicht geteilt, steht ein geteilter Schritt einer späteren Phase unter seiner Phase („Danach in …“)', () => {
    const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
    const f: Fall = { ...neuerFall().f, status: 'laeuft', freigaben: {}, knoten: [
      k('w', undefined, 'A', 1), k('p1', 'w', 'Diagnose', 1, { kundeSichtbar: true }), k('d1', 'p1', 'Diagnosebericht', 1, { kundeSichtbar: true, status: 'erledigt', erledigtAm: '2026-10-17' }),
      k('d2', 'p1', 'Interne Vorbereitung', 2), k('p2', 'w', 'Aufbau', 2, { kundeSichtbar: true }), k('a1', 'p2', 'Prozess', 1, { kundeSichtbar: true }), k('a2', 'p2', 'CRM', 2, { kundeSichtbar: true }),
    ] };
    expect(naechsterPunkt(f, [], HEUTE)!.id).toBe('d2');
    const t = kundenTeile({ fall: f, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set() });
    expect(t.naechstes).toEqual(['Danach in „Aufbau“: Prozess, CRM']);
    const r = kundenReise(t.phasen, t.naechstes, 0);
    expect(r.map(s => [s.titel, s.zustand, s.kaestchen.map(x => `${x.titel}:${x.zustand}`)])).toEqual([
      ['Diagnose', 'jetzt', []],
      ['Aufbau', 'offen', ['Prozess:offen', 'CRM:offen']],
    ]);
  });
});

describe('N9 · abgeschlossen = kein „hier“', () => {
  it('die Reise hat keine Phase „jetzt“, die Kunden-Seite kein „Als Nächstes“', () => {
    const { w } = neuerFall({ onboardingFertig: true });
    const zu = ok(fallAnwenden(w, [{ op: 'fall-status', status: 'abgeschlossen' }], ctx()));
    expect(zu.status).toBe('abgeschlossen');
    expect(jetztPhasen(zu).size).toBe(0);
    const r = fallReise(zu, FREIGABEN, HEUTE);
    expect(r.jetzt).toBe(-1);
    expect(r.phasen.some(p => p.zustand === 'jetzt')).toBe(false);
    expect(reiseZeile({ fall: zu, freigaben: FREIGABEN, heute: HEUTE }).spalten.some(s => s.zustand === 'jetzt')).toBe(false);
    expect(fallStelle(zu, FREIGABEN, HEUTE)).toMatchObject({ phase: null, naechster: null });
    const t = kundenTeile({ fall: zu, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: FREIGABEN });
    expect(t.phasen.some(p => p.stand === 'aktuell')).toBe(false);
    expect(t.naechstes).toEqual([]);
  });
});

describe('N10 · ein Zusatzmodul zählt nicht im Hauptstrahl', () => {
  it('„Phase n von m“ zählt die Phasen des Pakets; die Phasen des Moduls zählen in ihrer Zeile ab 1', () => {
    const k = (i: string, e: string | undefined, titel: string, rang: number, x: Partial<FallKnoten> = {}): FallKnoten => ({ id: i, ...(e ? { elternId: e } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);
    const f: Fall = { ...neuerFall().f, status: 'laeuft', freigaben: {}, zusaetze: [{ vorlageId: 'v-z', vorlageFassung: 1, wurzelId: 'zw', titel: 'Telefonie', startAm: HEUTE, angehaengtAm: J, angehaengtVon: 'pia' }], knoten: [
      k('w', undefined, 'A', 1), k('p1', 'w', 'Vorlauf', 1), k('s1', 'p1', 'Kick-off', 1, { status: 'erledigt' }), k('p2', 'w', 'Analyse', 2), k('s2', 'p2', 'Umfang', 1),
      k('z1', 'w', 'Angebot', 3, { zusatz: 'v-z' }), k('t1', 'z1', 'Bedarf', 1), k('z2', 'w', 'Start', 4, { zusatz: 'v-z' }), k('t2', 'z2', 'Zugänge', 1),
    ] };
    const r = fallReise(f, [], HEUTE);
    expect(r.phasen.map(p => `${p.titel}:${p.nr}:${p.zustand}`)).toEqual(['Vorlauf:1:fertig', 'Analyse:2:jetzt', 'Angebot:1:jetzt', 'Start:2:offen']);
    expect(fallStelle(f, [], HEUTE).phase).toMatchObject({ id: 'p2', nr: 2, von: 2 });
    expect(reiseKurz(r).map(p => p.titel)).toEqual(['Vorlauf', 'Analyse']);
    // Ist das Paket durch, steht die Phase des Moduls mit seiner Zählung da.
    const nurModul = { ...f, knoten: f.knoten.map(x => (x.id === 's2' ? { ...x, status: 'erledigt' as const } : x)) };
    expect(fallStelle(nurModul, [], HEUTE).phase).toMatchObject({ id: 'z1', nr: 1, von: 2 });
  });
});

describe('N11 · EINE Onboarding-Zählung', () => {
  it('die Karte zählt offen = gesamt − erledigt wie der Fall („3 von 8“ → 5 offen), das Playbook mitgezählt', () => {
    const { f, w, abl } = neuerFall();
    const g = { ...f, onboarding: { willkommenGesendetAm: J, kickoffAm: HEUTE } };
    const st = onboardingStand(g, abl);
    const z = onboardingZaehlung(st.schritte);
    expect(z).toEqual({ erledigt: 2, gesamt: 8 });
    const c = cockpitZeile({ fall: fallWirksam(g, abl), kunde: 'Beispiel GmbH', titel: 'Begleitung', onboarding: st, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN });
    expect(c.onboarding).toMatchObject({ offen: 6, erledigt: 2, gesamt: 8, fertig: false });
    expect(st.offen).toBe(5); // „fertig“ fragt weiter nur die zählenden Schritte (das Playbook darf laufen)
    expect(w.status).toBe('onboarding');
  });
});

describe('N13 · Kick-off „Termin steht anderswo“', () => {
  it('nach dem Vermerk sagt der Fall „Kick-off vermerkt am … (Termin steht anderswo)“ — im Schritt, unter „Menschen & Termine“ und für das Mandat', () => {
    expect(kickoffVermerkText('2026-10-18')).toBe('Kick-off vermerkt am 18.10. (Termin steht anderswo)');
    const { f, abl } = neuerFall();
    const v = ok(fallAnwenden(f, [{ op: 'kickoff-vermerkt' }], ctx()));
    expect(v.onboarding.kickoffAm).toBe(HEUTE);
    expect(onboardingStand(v, abl).schritte.find(s => s.schluessel === 'kickoff')).toMatchObject({ erfuellt: true, text: 'Kick-off vermerkt am 18.10. (Termin steht anderswo).' });
    const leiste = taktLeiste({ rituale: MUSTER_RITUALE, fallRituale: [], termine: {}, heute: HEUTE });
    expect(taktLage(leiste, HEUTE)).toMatchObject({ ampel: 'rot', antwort: 'Kein Termin im Kalender' });
    expect(taktLage(leiste, HEUTE, undefined, v.onboarding.kickoffAm)).toMatchObject({ ampel: 'gelb', antwort: 'Kick-off vermerkt am 18.10. (Termin steht anderswo)' });
    const c = cockpitZeile({ fall: fallWirksam(v, abl), kunde: 'Beispiel GmbH', titel: 'Begleitung', onboarding: onboardingStand(v, abl), health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE, freigaben: FREIGABEN });
    expect(c.kickoffVermerktAm).toBe(HEUTE);
    expect(cockpitZeile({ fall: fallWirksam(f, abl), kunde: 'B', titel: 'T', onboarding: onboardingStand(f, abl), health: null, report: { faellig: false }, pulsSchwelle: 6, heute: HEUTE }).kickoffVermerktAm).toBeUndefined();
  });
});

describe('N19 · die Bestätigung zählt für den Kunden als erledigt', () => {
  it('Bestätigung 1 vermerkt → „Erledigt“ nennt sie (Onboarding-Schritte bleiben intern); eine interne Bestätigung nie', () => {
    const { w } = neuerFall({ onboardingFertig: true });
    const t = kundenTeile({ fall: w, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: FREIGABEN });
    expect(t.erledigt).toEqual(['Bestätigung: Mandatsrahmen & Zugänge (18.10.2026)']);
    expect(t.erledigt.some(x => /Willkommen|Stakeholder|Entscheidungs/.test(x))).toBe(false);
    const g = ok(fallAnwenden(ok(fallAnwenden(w, [{ op: 'knoten-status', id: id(w, 'Analyse-Umfang'), status: 'erledigt' }, { op: 'knoten-status', id: id(w, 'Dossier'), status: 'erledigt' }], ctx())), [{ op: 'freigabe', id: 'F2' }], ctx()));
    const t2 = kundenTeile({ fall: g, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: FREIGABEN });
    // Bestätigung 2 ist intern (das Muster: „Dossier geprüft“) — sie steht beim Kunden nie.
    expect(g.freigaben.F2).toBeDefined();
    expect(t2.erledigt).toEqual(['Bestätigung: Mandatsrahmen & Zugänge (18.10.2026)']);
    // Ohne Bestätigung im Fenster: die bisherige Liste (Byte für Byte).
    const frisch = neuerFall().w;
    expect(kundenTeile({ fall: frisch, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: FREIGABEN }).erledigt).toEqual([]);
  });
});
