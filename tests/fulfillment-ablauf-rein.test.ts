// ─── Fulfillment · Ausführung der Abläufe — die reinen Regeln (17.10. abends) ─────────────────────────────────────────────────────────────
// Schritt → Aufgabe → weiter (idempotent über Marken), Entscheidung ja/nein, Erinnerung nach Frist (höchstens n Runden, dann „eskaliert“), Ja-Zweig nach vorn
// (Übersprungenes entfällt), parallele Teilprozesse, Abstimmungspunkt hält an, Kunden-Schritt wartet, Mail-Entwurf aus dem Baustein (nie gesendet — hier gibt es
// gar keinen Versand), Live-Lage = Reise = Cockpit, Update-Probe (Altbestand ohne die neuen Felder bleibt, wie er ist). Erfundene Daten, kein Datenordner.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import type { Fall, FallKnoten, ProzessKnoten } from '@/lib/fulfillment/typen';
import {
  ablaufAktiv, aktiveKnoten, ausfuehrungSoll, ablaufAbschluesse, ablaufAufgabeId, aufgabeZuKnoten, opNachAufgabe, nachrichtEntwurf, ablaufStand,
  ABLAUF_MARKE, VERSUCHE_VORGABE,
} from '@/lib/fulfillment/prozesse/ausfuehrung';
import { fallAnwenden, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { naechsterPunkt, fallStelle } from '@/lib/fulfillment/prozesse/reise';
import { reiseZeile, knotenHaengt } from '@/lib/fulfillment/prozesse/reise-bild';
import { cockpitZeile, wasHaengt } from '@/lib/fulfillment/prozesse/cockpit';
import { onboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { faelleAus, vorlagenAus, leerVorlagen } from '@/lib/fulfillment/lesen';
import { vergleicheBestand } from '@/lib/betrieb/update-probe';
import { tagPlus } from '@/lib/kalender/zeit';

const START = '2026-10-01';
const J = '2026-10-01T08:00:00.000Z';
const stand = (x: object) => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
let N = 0;
const kontext = (heute: string): FallKontext => ({ person: 'pia', jetzt: `${heute}T09:00:00.000Z`, heute, standVon: stand, neueId: p => `${p}-t${++N}`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben: ['FA'] });
const ok = (r: ReturnType<typeof fallAnwenden>): Fall => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };
const k = (id: string, elternId: string | undefined, titel: string, rang: number, x: Partial<ProzessKnoten> = {}): FallKnoten => ({ id, ...(elternId ? { elternId } : {}), titel, rang, status: 'offen', ...x } as FallKnoten);

/** Ein Ablauf wie aus dem Editor: Angebot (Schritt → Nachricht → Entscheidung mit Nein-Erinnerung zurück → Termin, Abstimmungspunkt) → Start (Schritt). */
function ablauf(x: { loop?: boolean; ja?: string; kunde?: boolean } = {}): FallKnoten[] {
  return [
    k('w', undefined, 'Ablauf', 1),
    k('p1', 'w', 'Angebot', 1, { freigabe: 'FA' }),
    k('s1', 'p1', 'Bedarf aufnehmen', 1, { form: 'schritt', frist: 2, zustaendig: x.kunde ? 'kunde' : 'intern' }),
    k('s2', 'p1', 'Angebot senden', 2, { form: 'nachricht', frist: 3 }),
    k('e', 'p1', 'Angebot angenommen?', 3, { form: 'entscheidung', frist: 7, zweige: { nein: 'r', ...(x.ja ? { ja: x.ja } : {}) } }),
    k('r', 'p1', 'Nach einer Woche nachfassen', 4, { form: 'erinnerung', frist: 7, ...(x.loop !== false ? { zweige: { ja: 'e' } } : {}) }),
    k('s3', 'p1', 'Start-Termin vereinbaren', 5, { form: 'termin', frist: 2 }),
    k('s4', 'p1', 'Vertrag ablegen', 6, { form: 'schritt' }),
    k('p2', 'w', 'Start', 2),
    k('s5', 'p2', 'Zugänge einrichten', 1, { form: 'schritt', frist: 5 }),
  ];
}
const fall = (knoten: FallKnoten[], x: Partial<Fall> = {}): Fall => ({
  mandatId: 'm-1', vorlageId: 'v-1', vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status: 'laeuft', knoten, freigaben: {}, onboarding: {},
  stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia', ...x,
});
const kn = (f: Fall, id: string) => f.knoten.find(x => x.id === id)!;
const erledige = (f: Fall, id: string, am: string) => ok(fallAnwenden(f, [{ op: 'knoten-status', id, status: 'erledigt', am }], kontext(am)));
const antworte = (f: Fall, id: string, antwort: 'ja' | 'nein', am: string) => ok(fallAnwenden(f, [{ op: 'antwort', id, antwort, am }], kontext(am)));
/** Die Marken der Wirkungen setzen (wie der Server nach dem Anlegen). */
const gemacht = (f: Fall, soll: ReturnType<typeof ausfuehrungSoll>): Fall => ({ ...f, marken: { ...f.marken, ...Object.fromEntries([...soll.aufgaben, ...soll.nachrichten, ...soll.glocken].map(x => [x.marke, 'x'])) } });

describe('Schritt → Aufgabe → weiter', () => {
  it('der erste Schritt ist dran (Frist ab Start), EINE Aufgabe mit fester Kennung — idempotent über die Marke', () => {
    const f = fall(ablauf());
    expect(ablaufAktiv(f)).toBe(true);
    const a = aktiveKnoten(f);
    expect(a.map(x => x.knoten.id)).toEqual(['s1']);
    expect(a[0]).toMatchObject({ art: 'aufgabe', ankunft: START, faellig: tagPlus(START, 2) });
    const soll = ausfuehrungSoll(f, START);
    expect(soll.aufgaben).toEqual([expect.objectContaining({ id: ablaufAufgabeId('m-1', 's1'), knotenId: 's1', titel: 'Bedarf aufnehmen', faellig: tagPlus(START, 2), art: 'schritt' })]);
    expect(soll.ops).toEqual([{ op: 'knoten-status', id: 's1', faelligAm: tagPlus(START, 2) }]);
    expect(ablaufAufgabeId('m-1', 's1')).toBe(ablaufAufgabeId('m-1', 's1'));
    expect(ablaufAufgabeId('m-1', 's1')).not.toBe(ablaufAufgabeId('m-2', 's1'));
    // Zweiter Lauf: Marke gesetzt → nichts doppelt.
    expect(ausfuehrungSoll(gemacht(f, soll), START).aufgaben).toEqual([]);
  });

  it('Schritt erledigt → die Nachricht ist dran (Vorschlag), Frist ab Erledigung; die Aufgabe des Schritts schließt sich (einmal)', () => {
    const f0 = fall(ablauf());
    let f = erledige(gemacht(f0, ausfuehrungSoll(f0, START)), 's1', '2026-10-02');
    expect(aktiveKnoten(f).map(x => [x.knoten.id, x.art])).toEqual([['s2', 'nachricht']]);
    expect(kn(f, 's2').faelligAm).toBe('2026-10-05');
    const soll = ausfuehrungSoll(f, '2026-10-02');
    expect(soll.aufgaben).toEqual([]);
    expect(soll.nachrichten).toEqual([expect.objectContaining({ knotenId: 's2', runde: 0, bezugId: 'p:nachricht:m-1:s2:0' })]);
    expect(soll.abschluss).toEqual([expect.objectContaining({ id: ablaufAufgabeId('m-1', 's1'), status: 'done', marke: ABLAUF_MARKE.zu('s1', 0) })]);
    f = gemacht(f, soll);
    // Geschlossen vermerkt → nie wieder gefragt; eine Aufgabe, die die Ausführung nie angelegt hat, schließt sie auch nicht.
    expect(ausfuehrungSoll({ ...f, marken: { ...f.marken, [ABLAUF_MARKE.zu('s1', 0)]: 'x' } }, '2026-10-03').abschluss).toEqual([]);
    expect(ausfuehrungSoll(erledige(fall(ablauf()), 's1', '2026-10-02'), '2026-10-02').abschluss).toEqual([]);
    expect(ausfuehrungSoll(f, '2026-10-03').nachrichten).toEqual([]);
  });

  it('Aufgabe erledigt → Op „erledigt“ für ihren Knoten; schon erledigt → nichts (kein Ping-Pong)', () => {
    const f = fall(ablauf());
    const z = aufgabeZuKnoten(f, ablaufAufgabeId('m-1', 's1'));
    expect(z).toEqual({ knotenId: 's1', runde: 0 });
    expect(opNachAufgabe(f, 's1', 0)).toEqual({ op: 'knoten-status', id: 's1', status: 'erledigt' });
    expect(opNachAufgabe(erledige(f, 's1', '2026-10-02'), 's1', 0)).toBeNull();
    expect(aufgabeZuKnoten(f, 'ff-ab-unbekannt')).toBeNull();
    expect(aufgabeZuKnoten(f, 'nicht-ablauf')).toBeNull();
  });

  it('macht der Kunde den Schritt: „wartet auf Kunde“ ab Ankunft, die Aufgabe heißt „Beim Kunden: …“, Live-Lage „kunde“', () => {
    const f = fall(ablauf({ kunde: true }));
    const soll = ausfuehrungSoll(f, START);
    expect(soll.ops).toEqual([{ op: 'knoten-status', id: 's1', faelligAm: tagPlus(START, 2), status: 'wartet_kunde', am: START }]);
    expect(soll.aufgaben[0].titel).toBe('Beim Kunden: Bedarf aufnehmen');
    const nach = ok(fallAnwenden(f, soll.ops, kontext(START)));
    expect(naechsterPunkt(nach, [], START)).toMatchObject({ id: 's1', wartetAuf: 'kunde', zustand: 'wartet_kunde' });
  });
});

describe('Entscheidung fragt nach — ja / nein', () => {
  const bisEntscheidung = () => erledige(erledige(fall(ablauf()), 's1', '2026-10-02'), 's2', '2026-10-03');

  it('offen nach der Frist → EINE Glocke je Runde; vorher keine', () => {
    const f = bisEntscheidung();
    expect(kn(f, 'e').faelligAm).toBe('2026-10-10');
    expect(aktiveKnoten(f).map(x => x.knoten.id)).toEqual(['e']);
    expect(ausfuehrungSoll(f, '2026-10-10').glocken).toEqual([]);
    const soll = ausfuehrungSoll(f, '2026-10-11');
    expect(soll.glocken).toEqual([{ art: 'frage', knotenId: 'e', titel: 'Angebot angenommen?', marke: ABLAUF_MARKE.frage('e', 0) }]);
    expect(ausfuehrungSoll(gemacht(f, soll), '2026-10-12').glocken).toEqual([]);
    expect(naechsterPunkt(f, [], '2026-10-11')).toMatchObject({ id: 'e', wartetAuf: 'entscheidung', ueberfaellig: true });
  });

  it('„ja“ → weiter zum nächsten Schritt, der Nein-Zweig entfällt', () => {
    const f = antworte(bisEntscheidung(), 'e', 'ja', '2026-10-04');
    expect(kn(f, 'e')).toMatchObject({ status: 'erledigt', antwort: 'ja', antwortAm: '2026-10-04' });
    expect(kn(f, 'r')).toMatchObject({ status: 'entfaellt', grund: 'Entscheidung: ja' });
    expect(kn(f, 's3').faelligAm).toBe('2026-10-06');
    expect(aktiveKnoten(f).map(x => x.knoten.id)).toEqual(['s3']);
    // Alter Weg: „erledigt“ an der Entscheidung heißt weiter „ja“.
    const g = erledige(bisEntscheidung(), 'e', '2026-10-04');
    expect(kn(g, 'e').antwort).toBe('ja');
    expect(kn(g, 'r').status).toBe('entfaellt');
  });

  it('„nein“ → die Erinnerung läuft (fällig nach ihrer Frist) und ist „hier“; ihre Aufgabe entsteht erst mit der Frist', () => {
    const f = antworte(bisEntscheidung(), 'e', 'nein', '2026-10-04');
    expect(kn(f, 'e')).toMatchObject({ status: 'offen', antwort: 'nein', runden: 1 });
    expect(kn(f, 'e').faelligAm).toBeUndefined();
    expect(kn(f, 'r').faelligAm).toBe('2026-10-11');
    expect(aktiveKnoten(f)).toEqual([expect.objectContaining({ knoten: expect.objectContaining({ id: 'r' }), art: 'erinnerung', runde: 1, entscheidungId: 'e' })]);
    expect(naechsterPunkt(f, [], '2026-10-05')).toMatchObject({ id: 'r', wartetAuf: 'entscheidung' });
    expect(ausfuehrungSoll(f, '2026-10-10').aufgaben).toEqual([]);
    const soll = ausfuehrungSoll(f, '2026-10-11', () => true);
    expect(soll.aufgaben).toEqual([expect.objectContaining({ id: ablaufAufgabeId('m-1', 'r', 1), runde: 1, art: 'erinnerung', titel: `Nach einer Woche nachfassen (Versuch 1 von ${VERSUCHE_VORGABE})` })]);
    expect(soll.nachrichten).toEqual([expect.objectContaining({ knotenId: 'r', runde: 1, bezugId: 'p:nachricht:m-1:r:1' })]);
    // Die Reise markiert die Erinnerung als „hier“ (dieselbe Rechnung).
    expect(reiseZeile({ fall: f, freigaben: [], heute: '2026-10-05' }).hier).toEqual({ phaseId: 'p1', id: 'r' });
  });

  it('Erinnerung erledigt → die Entscheidung fragt wieder (Frist ab heute), Runde gezählt; die Aufgabe der Runde schließt sich', () => {
    let f = antworte(bisEntscheidung(), 'e', 'nein', '2026-10-04');
    f = erledige(f, 'r', '2026-10-12');
    expect(kn(f, 'r')).toMatchObject({ status: 'offen', runden: 1 });
    expect(kn(f, 'r').faelligAm).toBeUndefined();
    expect(kn(f, 'e')).toMatchObject({ status: 'offen', runden: 1, faelligAm: '2026-10-19' });
    expect(kn(f, 'e').antwort).toBeUndefined();
    expect(aktiveKnoten(f).map(x => [x.knoten.id, x.runde])).toEqual([['e', 1]]);
    expect(naechsterPunkt(f, [], '2026-10-12')).toMatchObject({ id: 'e' });
    expect(ablaufAbschluesse(f)).toContainEqual(expect.objectContaining({ id: ablaufAufgabeId('m-1', 'r', 1), status: 'done' }));
    // Die Aufgabe der Runde 1 rückt nichts mehr (Runde vorbei).
    expect(opNachAufgabe(f, 'r', 1)).toBeNull();
  });

  it('höchstens n Runden — danach „eskaliert“: Glocke einmal, Hänger rot, kein weiteres „nein“ startet eine Runde', () => {
    let f = bisEntscheidung();
    let tag = '2026-10-04';
    for (let i = 1; i <= VERSUCHE_VORGABE; i++) {
      f = antworte(f, 'e', 'nein', tag);
      expect(aktiveKnoten(f)[0]).toMatchObject({ art: 'erinnerung', runde: i });
      tag = tagPlus(tag, 8);
      f = erledige(f, 'r', tag);
    }
    expect(kn(f, 'e').eskaliertAm).toBe(tag);
    const soll = ausfuehrungSoll(f, tag);
    expect(soll.glocken).toEqual([expect.objectContaining({ art: 'eskaliert', knotenId: 'e' })]);
    expect(ausfuehrungSoll(gemacht(f, soll), tagPlus(tag, 1)).glocken).toEqual([]);
    expect(knotenHaengt(kn(f, 'e'), f, tag)).toBe('rot');
    const ob = onboardingStand(f, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: J });
    expect(wasHaengt({ fall: f, kunde: 'K', titel: 'T', onboarding: ob, health: null, report: { faellig: false }, pulsSchwelle: 6, heute: tag })).toContainEqual(expect.objectContaining({ schwere: 'rot', text: expect.stringContaining('eskaliert') }));
    const weiter = antworte(f, 'e', 'nein', tag);
    expect(kn(weiter, 'e').runden).toBe(VERSUCHE_VORGABE);
    expect(aktiveKnoten(weiter).map(x => x.knoten.id)).toEqual(['e']);
    // „ja“ beendet die Schleife jederzeit.
    expect(kn(antworte(weiter, 'e', 'ja', tag), 'r').status).toBe('entfaellt');
  });

  it('die Grenze kommt aus dem Ablauf (`versuche` an der Erinnerung)', () => {
    const kn0 = ablauf().map(x => (x.id === 'r' ? { ...x, versuche: 2 } : x));
    let f = erledige(erledige(fall(kn0), 's1', '2026-10-02'), 's2', '2026-10-03');
    f = erledige(antworte(f, 'e', 'nein', '2026-10-04'), 'r', '2026-10-05');
    expect(kn(f, 'e').eskaliertAm).toBeUndefined();
    f = erledige(antworte(f, 'e', 'nein', '2026-10-06'), 'r', '2026-10-07');
    expect(kn(f, 'e').eskaliertAm).toBe('2026-10-07');
  });

  it('„nein“ während die Erinnerung läuft, dann „ja“ (der Kunde antwortet doch): Erinnerung entfällt, ihre laufende Aufgabe wird abgebrochen', () => {
    let f = antworte(bisEntscheidung(), 'e', 'nein', '2026-10-04');
    f = antworte(f, 'e', 'ja', '2026-10-06');
    expect(kn(f, 'r').status).toBe('entfaellt');
    expect(ablaufAbschluesse(f)).toContainEqual(expect.objectContaining({ id: ablaufAufgabeId('m-1', 'r', 1), status: 'cancelled' }));
  });

  it('Nein-Zweig ohne Rückweg: Erinnerung erledigt → Entscheidung „nein“ entschieden, weiter nach der Entscheidung', () => {
    let f = erledige(erledige(fall(ablauf({ loop: false })), 's1', '2026-10-02'), 's2', '2026-10-03');
    f = antworte(f, 'e', 'nein', '2026-10-04');
    f = erledige(f, 'r', '2026-10-09');
    expect(kn(f, 'e')).toMatchObject({ status: 'erledigt', antwort: 'nein' });
    expect(kn(f, 'r')).toMatchObject({ status: 'erledigt', runden: 1 });
    expect(aktiveKnoten(f).map(x => x.knoten.id)).toEqual(['s3']);
  });

  it('Ja-Zweig nach vorn: Übersprungenes entfällt', () => {
    let f = erledige(erledige(fall(ablauf({ ja: 's4' })), 's1', '2026-10-02'), 's2', '2026-10-03');
    f = antworte(f, 'e', 'ja', '2026-10-04');
    expect(kn(f, 's3')).toMatchObject({ status: 'entfaellt' });
    expect(aktiveKnoten(f).map(x => x.knoten.id)).toEqual(['s4']);
    expect(ablaufAbschluesse(f)).toContainEqual(expect.objectContaining({ id: ablaufAufgabeId('m-1', 's3'), status: 'cancelled' }));
  });

  it('auf einen Schritt ohne Entscheidung gibt es keine Antwort (400)', () => {
    const r = fallAnwenden(fall(ablauf()), [{ op: 'antwort', id: 's1', antwort: 'ja' }], kontext(START));
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(fallAnwenden(fall(ablauf()), [{ op: 'antwort', id: 'e', antwort: 'vielleicht' }], kontext(START))).toMatchObject({ ok: false, status: 400 });
  });
});

describe('Phasen, Abstimmungspunkt, Teilprozesse', () => {
  it('Abstimmungspunkt hält an — erst vermerkt geht es in die nächste Phase (Frist ab dem Abstimmungspunkt)', () => {
    let f = antworte(erledige(erledige(fall(ablauf()), 's1', '2026-10-02'), 's2', '2026-10-03'), 'e', 'ja', '2026-10-04');
    f = erledige(erledige(f, 's3', '2026-10-05'), 's4', '2026-10-06');
    expect(aktiveKnoten(f)).toEqual([]);
    expect(naechsterPunkt(f, [{ id: 'FA', titel: 'Auftrag bestätigt', wer: 'beide' }], '2026-10-06')).toMatchObject({ art: 'freigabe', wartetAuf: 'abstimmung' });
    f = ok(fallAnwenden(f, [{ op: 'freigabe', id: 'FA', am: '2026-10-08' }], kontext('2026-10-08')));
    expect(aktiveKnoten(f)).toEqual([expect.objectContaining({ knoten: expect.objectContaining({ id: 's5' }), ankunft: '2026-10-08', faellig: '2026-10-13' })]);
  });

  it('zwei benannte Teilprozesse nebeneinander laufen parallel', () => {
    const knoten = [
      k('w', undefined, 'Ablauf', 1), k('p1', 'w', 'Aufbau', 1),
      k('g1', 'p1', 'Technik', 1), k('a1', 'g1', 'Server', 1, { form: 'schritt' }), k('a2', 'g1', 'Daten', 2, { form: 'schritt' }),
      k('g2', 'p1', 'Team', 2), k('b1', 'g2', 'Schulung', 1, { form: 'termin' }),
    ];
    const f = fall(knoten);
    expect(aktiveKnoten(f).map(x => x.knoten.id).sort()).toEqual(['a1', 'b1']);
    expect(ausfuehrungSoll(f, START).aufgaben.map(x => x.knotenId).sort()).toEqual(['a1', 'b1']);
    const g = erledige(f, 'a1', '2026-10-02');
    expect(aktiveKnoten(g).map(x => x.knoten.id).sort()).toEqual(['a2', 'b1']);
  });

  it('ein Knoten ohne Form hält die Bahn an (von Hand abhaken) — ohne jede Form läuft keine Ausführung', () => {
    const knoten = [k('w', undefined, 'A', 1), k('p1', 'w', 'P', 1), k('x', 'p1', 'Alter Schritt', 1), k('y', 'p1', 'Neu', 2, { form: 'schritt' })];
    const f = fall(knoten);
    expect(aktiveKnoten(f)).toEqual([expect.objectContaining({ knoten: expect.objectContaining({ id: 'x' }), art: null })]);
    expect(ausfuehrungSoll(f, START).aufgaben).toEqual([]);
    const alt = fall(knoten.map(x => { const { form: _f, ...r } = x; return r as FallKnoten; }));
    expect(ablaufAktiv(alt)).toBe(false);
    expect(ausfuehrungSoll(alt, START)).toEqual({ ops: [], aufgaben: [], nachrichten: [], glocken: [], abschluss: [] });
    expect(ablaufStand(alt, START)).toEqual({ aktiv: false, knoten: {} });
  });

  it('pausiert oder abgeschlossen: nichts ist dran', () => {
    expect(aktiveKnoten(fall(ablauf(), { status: 'pausiert' }))).toEqual([]);
    expect(ausfuehrungSoll(fall(ablauf(), { status: 'abgeschlossen' }), START).aufgaben).toEqual([]);
  });
});

describe('Live-Lage = Reise = Cockpit (EINE Rechnung)', () => {
  it('der Knoten „hier“, „wartet auf“ und überfällig — Fall-Kopf (fallStelle), Reise-Zeile und Cockpit-Zeile stimmen überein', () => {
    let f = erledige(erledige(fall(ablauf()), 's1', '2026-10-02'), 's2', '2026-10-03');
    f = antworte(f, 'e', 'nein', '2026-10-04');
    const heute = '2026-10-13';
    const st = fallStelle(f, [], heute);
    const z = reiseZeile({ fall: f, freigaben: [], heute });
    const ob = onboardingStand(f, { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: J });
    const c = cockpitZeile({ fall: f, kunde: 'K', titel: 'T', onboarding: ob, health: null, report: { faellig: false }, pulsSchwelle: 6, heute });
    expect(st.naechster).toMatchObject({ id: 'r', wartetAuf: 'entscheidung', ueberfaellig: true, faelligAm: '2026-10-11' });
    expect(z.hier?.id).toBe('r');
    expect(c.schritt).toBe(st.naechster!.titel);
    expect(c.schrittLage).toEqual({ wartetAuf: 'entscheidung', faelligAm: '2026-10-11', ueberfaellig: true });
    // Die Erinnerung hängt (überfällig) — in der Reise wie im Cockpit.
    expect(knotenHaengt(kn(f, 'r'), f, heute)).toBe('gelb');
    expect(c.haengt.some(h => h.text.includes('Nach einer Woche nachfassen'))).toBe(true);
    const st2 = ablaufStand(f, heute);
    expect(st2.knoten.r).toMatchObject({ aktiv: true, art: 'erinnerung', runde: 1, entscheidung: 'e', ueberfaellig: true, aufgabe: ablaufAufgabeId('m-1', 'r', 1) });
    expect(st2.knoten.e).toMatchObject({ aktiv: false, antwort: 'nein', nein: 'r', neinLaeuft: true, versuche: VERSUCHE_VORGABE });
  });

  it('ein wartender Nein-Zweig ist nie „als Nächstes“, auch wenn er vor der Entscheidung steht', () => {
    const knoten = ablauf().map(x => (x.id === 'r' ? { ...x, rang: 0 } : x));
    const f = fall(knoten);
    expect(naechsterPunkt(f, [], START)?.id).toBe('s1');
    const g = erledige(erledige(f, 's1', '2026-10-02'), 's2', '2026-10-03');
    expect(naechsterPunkt(g, [], '2026-10-03')?.id).toBe('e');
  });
});

describe('Nachricht → Entwurf (gefüllt, nie gesendet)', () => {
  it('Betreff aus der ersten Zeile, Platzhalter gefüllt, Unbekanntes bleibt sichtbar; ohne Termin fällt der Satz weg (17.10., L1 B12)', () => {
    const v = 'Betreff: Ihr Angebot, {{kunde}}\n\n{{anrede}},\n\nwie besprochen — Termin: {{termin}}.\n{{unbekannt}}\n\nViele Grüße\n{{absender}}';
    const m = nachrichtEntwurf(v, { anrede: 'Sie', vorname: 'Testa', nachname: 'Probe', kunde: 'Probe GmbH', absender: 'Pia' }, 'Angebot senden');
    expect(m.betreff).toBe('Ihr Angebot, Probe GmbH');
    expect(m.text).toBe('Guten Tag Testa Probe,\n\n{{unbekannt}}\n\nViele Grüße\nPia');
    const du = nachrichtEntwurf('{{anrede}}, bis {{termin}}', { anrede: 'Du', vorname: 'Testa', termin: 'Di, 14.10., 10:00 Uhr' }, 'X');
    expect(du).toEqual({ betreff: 'X', text: 'Hallo Testa, bis Di, 14.10., 10:00 Uhr' });
    expect(nachrichtEntwurf(undefined, { anrede: 'Sie' }, 'Angebot senden')).toEqual({ betreff: 'Angebot senden', text: 'Guten Tag,\n\n\n\nFreundliche Grüße' });
  });
});

describe('Update-Probe: Altbestand ohne die neuen Felder', () => {
  const roh = <T>(x: T): unknown => JSON.parse(JSON.stringify(x));
  it('Fälle mit Antwort, Runden, Eskalation und Versuchen bleiben beim Lesen erhalten; alte Fälle ohne Feld unverändert', () => {
    let f = erledige(erledige(fall(ablauf().map(x => (x.id === 'r' ? { ...x, versuche: 3 } : x))), 's1', '2026-10-02'), 's2', '2026-10-03');
    f = erledige(antworte(f, 'e', 'nein', '2026-10-04'), 'r', '2026-10-05');
    f = { ...f, knoten: f.knoten.map(x => (x.id === 'e' ? { ...x, eskaliertAm: '2026-10-05', antwort: 'nein' as const } : x)) };
    const neu = roh({ version: 1, faelle: { 'm-1': f } });
    expect(vergleicheBestand('fulfillment-faelle--h', neu, roh(faelleAus(neu))).abweichungen).toEqual([]);
    const alt = roh({ version: 1, faelle: { 'm-1': fall(ablauf().map(x => { const { form: _a, frist: _b, zweige: _c, ...r } = x; return r as FallKnoten; })) } });
    expect(JSON.stringify(alt)).not.toMatch(/"antwort"|"runden"|"eskaliertAm"|"versuche"/);
    expect(vergleicheBestand('fulfillment-faelle--h', alt, roh(faelleAus(alt))).abweichungen).toEqual([]);
  });
  it('Vorlagen mit `versuche` an einer Erinnerung bleiben erhalten', () => {
    const d = leerVorlagen();
    const v = { ...d, prozesse: [{ id: 'fp-1', art: 'paket' as const, titel: 'P', knoten: [{ id: 'w', titel: 'W', rang: 1 }, { id: 'p', elternId: 'w', titel: 'P', rang: 1 }, { id: 'r', elternId: 'p', titel: 'R', rang: 1, form: 'erinnerung' as const, versuche: 3 }], uebergaenge: [], freigaben: [], rollen: [], fassung: 1, geaendert: J, geaendertVon: 'pia' }] };
    const r = roh(v);
    expect(vergleicheBestand('fulfillment--h', r, roh(vorlagenAus(r))).abweichungen).toEqual([]);
  });
});
