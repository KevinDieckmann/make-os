// Zweige über Phasen und Korrekturschleifen im Paket-Motor (26.10.): „erneut ab …“ an einer Entscheidung (die Schritte laufen noch einmal, je Runde eigene
// Aufgaben), „danach: Ablauf endet“ und „weiter bei …“ auch über Phasen. Rein — ohne Server.
import { describe, it, expect } from 'vitest';
import { ablaufAbschluesse, aktiveKnoten, antwortAnwenden, aufgabeZuKnoten, ausfuehrungSoll, nachErledigung, opNachAufgabe } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { sprungPruefen } from '@/lib/fulfillment/prozesse/fluss-struktur';
import { importLesen } from '@/lib/fulfillment/prozesse/import';
import type { Fall, FallKnoten } from '@/lib/fulfillment/typen';

const T1 = '2026-11-02', T2 = '2026-11-04', T3 = '2026-11-06', T4 = '2026-11-09';
const k = (x: Partial<FallKnoten> & { id: string }): FallKnoten => ({ titel: x.id, rang: 1, status: 'offen', ...x });

function fall(knoten: FallKnoten[]): Fall {
  return {
    mandatId: 'm-probe', vorlageId: 'fp-probe', vorlageFassung: 1, gestartetAm: `${T1}T08:00:00.000Z`, gestartetVon: 'pia', status: 'laeuft', startAm: T1,
    knoten, freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {},
    befaehigung: [], marken: {}, geaendert: `${T1}T08:00:00.000Z`, geaendertVon: 'pia',
  };
}
/** Einen Schritt erledigen wie der Schreibweg: Status setzen, dann `nachErledigung`. */
function erledige(kn: FallKnoten[], id: string, am: string): FallKnoten[] {
  return nachErledigung(kn.map(x => (x.id === id ? { ...x, status: 'erledigt' as const, seit: am, erledigtAm: am, erledigtVon: 'pia' } : x)), id, am, 'pia');
}
function antworte(kn: FallKnoten[], id: string, a: 'ja' | 'nein', am: string): FallKnoten[] {
  const r = antwortAnwenden(kn, id, a, am, 'pia');
  if ('fehler' in r) throw new Error(r.fehler);
  return r.knoten;
}
const hol = (kn: FallKnoten[], id: string) => kn.find(x => x.id === id)!;
const aktiv = (kn: FallKnoten[]) => aktiveKnoten(fall(kn)).map(a => `${a.knoten.id}#${a.runde}`);

// Korrekturschleife: Entwurf senden → Korrekturen sammeln (Kunde) → umsetzen → „Korrekturen abgeschlossen?“ (nein → erneut ab „sammeln“, höchstens 2×) → Abnahme.
const schleife = (): FallKnoten[] => [
  k({ id: 'w', titel: 'Homepage' }),
  k({ id: 'p1', elternId: 'w', titel: 'Bau und Korrekturen', rang: 1 }),
  k({ id: 't', elternId: 'p1', titel: 'Bau und Korrekturen', rang: 1 }),   // Sammel-Teilprozess (heißt wie die Phase), weil ein Schritt Bausteine trägt
  k({ id: 'a', elternId: 't', titel: 'Ersten Entwurf senden', rang: 1, form: 'nachricht' }),
  k({ id: 'b', elternId: 't', titel: 'Korrekturen sammeln und schicken', rang: 2, form: 'schritt', zustaendig: 'kunde', frist: 3 }),
  k({ id: 'b1', elternId: 'b', titel: 'Korrekturliste', rang: 1, bausteinId: 'fb-liste' }),
  k({ id: 'c', elternId: 't', titel: 'Korrekturen umsetzen', rang: 3, form: 'schritt', frist: 2 }),
  k({ id: 'd', elternId: 't', titel: 'Korrekturen abgeschlossen?', rang: 4, form: 'entscheidung', frist: 1, erneut: { ab: 'b', hoechstens: 2 } }),
  k({ id: 'p2', elternId: 'w', titel: 'Abnahme', rang: 2 }),
  k({ id: 'e', elternId: 'p2', titel: 'Abnahme einholen', rang: 1, form: 'schritt' }),
];

describe('„erneut ab …“ — Korrekturschleife als echte Runde', () => {
  it('nein öffnet die Schritte ab „sammeln“ noch einmal, je Runde eine eigene Aufgabe; ausgeschöpft → eskaliert; ja → nächste Phase', () => {
    let kn = schleife();
    kn = erledige(kn, 'a', T1);
    kn = kn.map(x => (x.id === 'b1' ? { ...x, status: 'erledigt' as const, erledigtAm: T1 } : x));   // die Korrekturliste ist ausgefüllt
    kn = erledige(kn, 'b', T1);
    kn = erledige(kn, 'c', T2);
    expect(aktiv(kn)).toEqual(['d#0']);

    // Runde 2
    kn = antworte(kn, 'd', 'nein', T2);
    expect(hol(kn, 'b')).toMatchObject({ status: 'offen', durchlauf: 1, seit: T2, faelligAm: '2026-11-07' });
    expect(hol(kn, 'b').erledigtAm).toBeUndefined();
    expect(hol(kn, 'b1').status).toBe('offen');                      // der Baustein unter dem Schritt öffnet mit
    expect(hol(kn, 'c')).toMatchObject({ status: 'offen', durchlauf: 1 });
    expect(hol(kn, 'd')).toMatchObject({ status: 'offen', antwort: 'nein', runden: 1 });
    expect(hol(kn, 'a').status).toBe('erledigt');                    // vor dem Ziel bleibt alles, wie es war
    expect(aktiv(kn)).toEqual(['b#1']);
    const soll = ausfuehrungSoll(fall(kn), T2);
    expect(soll.aufgaben).toHaveLength(1);
    expect(soll.aufgaben[0]).toMatchObject({ knotenId: 'b', runde: 1, titel: 'Beim Kunden: Korrekturen sammeln und schicken (Runde 2)' });
    // Die Aufgabe der Runde 2 führt zurück zum Knoten; eine alte Aufgabe der Runde 1 erledigt den neuen Durchlauf nicht.
    expect(aufgabeZuKnoten(fall(kn), soll.aufgaben[0].id)).toEqual({ knotenId: 'b', runde: 1 });
    expect(opNachAufgabe(fall(kn), 'b', 0)).toBeNull();
    expect(opNachAufgabe(fall(kn), 'b', 1)).toMatchObject({ op: 'knoten-status', id: 'b', status: 'erledigt' });

    kn = kn.map(x => (x.id === 'b1' ? { ...x, status: 'erledigt' as const, erledigtAm: T3 } : x));   // Runde 2: die Liste neu ausgefüllt
    kn = erledige(kn, 'b', T3);
    kn = erledige(kn, 'c', T3);
    expect(aktiv(kn)).toEqual(['d#1']);
    // Die Aufgaben der Runde 2 gelten als erledigt (zum Schließen).
    expect(ablaufAbschluesse(fall(kn)).filter(x => x.knotenId === 'c').map(x => `${x.runde}:${x.status}`)).toEqual(['1:done']);

    // Runde 3
    kn = antworte(kn, 'd', 'nein', T3);
    expect(hol(kn, 'b').durchlauf).toBe(2);
    expect(hol(kn, 'b1').status).toBe('offen');
    kn = kn.map(x => (x.id === 'b1' ? { ...x, status: 'erledigt' as const, erledigtAm: T4 } : x));
    kn = erledige(erledige(kn, 'b', T4), 'c', T4);
    // Ausgeschöpft: keine weitere Runde, die Entscheidung hängt rot
    kn = antworte(kn, 'd', 'nein', T4);
    expect(hol(kn, 'd').eskaliertAm).toBe(T4);
    expect(hol(kn, 'b').status).toBe('erledigt');
    // ja → weiter in der nächsten Phase
    kn = antworte(kn, 'd', 'ja', T4);
    expect(aktiv(kn)).toEqual(['e#0']);
  });
});

describe('„danach“ — Ablauf endet bzw. weiter bei … über Phasen', () => {
  const laufzeit = (): FallKnoten[] => [
    k({ id: 'w', titel: 'Mandat' }),
    k({ id: 'p1', elternId: 'w', titel: 'Bilanz', rang: 1 }),
    k({ id: 'g', elternId: 'p1', titel: 'Abschlussgespräch führen', rang: 1, form: 'termin' }),
    k({ id: 'l', elternId: 'p1', titel: 'Laufzeit 12 Monate gebucht?', rang: 2, form: 'entscheidung', zweige: { nein: 'f' } }),
    k({ id: 'f', elternId: 'p1', titel: 'Folgeangebot senden', rang: 3, form: 'nachricht', danach: { ende: true } }),
    k({ id: 'p2', elternId: 'w', titel: 'Verlängerung', rang: 2, freigabe: 'F9' }),
    k({ id: 'v1', elternId: 'p2', titel: 'Quartalsbilanz', rang: 1, form: 'schritt' }),
    k({ id: 'v2', elternId: 'p2', titel: 'Jahresbilanz', rang: 2, form: 'schritt' }),
  ];
  it('Nein-Zweig mit „Ablauf endet“: die Entscheidung ist „nein“, alles Spätere entfällt, nichts läuft mehr', () => {
    let kn = erledige(laufzeit(), 'g', T1);
    kn = antworte(kn, 'l', 'nein', T1);
    expect(aktiv(kn)).toEqual(['f#1']);   // der Nein-Zweig läuft in Runde 1
    kn = erledige(kn, 'f', T2);
    expect(hol(kn, 'l')).toMatchObject({ status: 'erledigt', antwort: 'nein' });
    for (const id of ['p2', 'v1', 'v2']) expect(hol(kn, id)).toMatchObject({ status: 'entfaellt', grund: 'Ablauf endet nach „Folgeangebot senden“' });
    expect(hol(kn, 'w').status).toBe('offen');
    expect(aktiv(kn)).toEqual([]);
  });
  it('ja: der Ablauf läuft wie immer in der Verlängerung weiter', () => {
    let kn = erledige(laufzeit(), 'g', T1);
    kn = antworte(kn, 'l', 'ja', T1);
    expect(hol(kn, 'f').status).toBe('entfaellt');
    expect(aktiv(kn)).toEqual(['v1#0']);
  });
  it('„weiter bei“ in eine spätere Phase: der Rest der Phase und die Phase dazwischen (samt Bestätigung) entfallen', () => {
    let kn: FallKnoten[] = [
      k({ id: 'w', titel: 'Paket' }),
      k({ id: 'p1', elternId: 'w', titel: 'Eins', rang: 1 }),
      k({ id: 's1', elternId: 'p1', titel: 'Testmarkt nötig?', rang: 1, form: 'entscheidung' }),
      k({ id: 's2', elternId: 'p1', titel: 'Testmarkt anlegen', rang: 2, form: 'schritt' }),
      k({ id: 's3', elternId: 'p1', titel: 'Nur mit Testmarkt', rang: 3, form: 'schritt', danach: { ziel: 'u1' } }),
      k({ id: 'p2', elternId: 'w', titel: 'Zwei', rang: 2, freigabe: 'F2' }),
      k({ id: 't1', elternId: 'p2', titel: 'Übersprungen', rang: 1, form: 'schritt' }),
      k({ id: 'p3', elternId: 'w', titel: 'Drei', rang: 3 }),
      k({ id: 'u0', elternId: 'p3', titel: 'Vor dem Ziel', rang: 1, form: 'schritt' }),
      k({ id: 'u1', elternId: 'p3', titel: 'Ziel', rang: 2, form: 'schritt', frist: 2 }),
    ];
    kn = antworte(kn, 's1', 'ja', T1);
    kn = erledige(kn, 's2', T1);
    kn = erledige(kn, 's3', T2);
    for (const id of ['p2', 't1', 'u0']) expect(hol(kn, id).status).toBe('entfaellt');
    expect(hol(kn, 'u0').grund).toBe('übersprungen (weiter bei „Ziel“)');
    expect(hol(kn, 'u1')).toMatchObject({ status: 'offen', faelligAm: T3 });
    expect(aktiv(kn)).toEqual(['u1#0']);
  });
});

describe('Regel `sprungPruefen`', () => {
  const basis = (): FallKnoten[] => [
    k({ id: 'w' }), k({ id: 'p1', elternId: 'w', rang: 1 }), k({ id: 'p2', elternId: 'w', rang: 2 }),
    k({ id: 'a', elternId: 'p1', rang: 1, form: 'schritt' }), k({ id: 'b', elternId: 'p1', rang: 2, form: 'entscheidung' }),
    k({ id: 'c', elternId: 'p2', rang: 1, form: 'schritt' }),
  ];
  const mit = (id: string, t: Partial<FallKnoten>) => basis().map(x => (x.id === id ? { ...x, ...t } : x));
  it('erlaubt: weiter nach vorn (auch über Phasen), Ende, erneut zurück in der Phase', () => {
    expect(() => sprungPruefen(mit('a', { danach: { ziel: 'c' } }))).not.toThrow();
    expect(() => sprungPruefen(mit('c', { danach: { ende: true } }))).not.toThrow();
    expect(() => sprungPruefen(mit('b', { erneut: { ab: 'a', hoechstens: 3 } }))).not.toThrow();
  });
  it('lehnt ab: zurück mit „weiter bei“, erneut nach vorn/in eine andere Phase/an einem Schritt/mit Nein-Zweig, Grenzen', () => {
    expect(() => sprungPruefen(mit('c', { danach: { ziel: 'a' } }))).toThrow(/nur nach vorn/);
    expect(() => sprungPruefen(mit('a', { danach: { ziel: 'a' } }))).toThrow(/sich selbst/);
    expect(() => sprungPruefen(mit('a', { danach: { ziel: 'p2' } }))).toThrow(/keinen Schritt/);
    expect(() => sprungPruefen(mit('b', { erneut: { ab: 'c', hoechstens: 1 } }))).toThrow(/dieser Phase/);
    expect(() => sprungPruefen(mit('a', { erneut: { ab: 'a', hoechstens: 1 } }))).toThrow(/nur an einer Entscheidung/);
    expect(() => sprungPruefen(mit('b', { erneut: { ab: 'a', hoechstens: 0 } }))).toThrow(/höchstens/);
    expect(() => sprungPruefen(mit('b', { erneut: { ab: 'a', hoechstens: 2 }, zweige: { nein: 'a' } }))).toThrow(/nicht beides/);
  });
});

describe('Import: „danach“ und „erneut“ aus Kennungen der Quelle', () => {
  const datei = (extra: Record<string, unknown>) => ({ format: 'make-os/pakete', pakete: [{ titel: 'Probe', phasen: [
    { id: 'p1', titel: 'Bau', fluss: [
      { id: 's-sammeln', titel: 'Korrekturen sammeln', zustaendig: 'kunde' },
      { id: 's-umsetzen', titel: 'Korrekturen umsetzen' },
      { id: 's-fertig', titel: 'Korrekturen abgeschlossen?', form: 'entscheidung', ...extra },
    ] },
    { id: 'p2', titel: 'Live', fluss: [{ id: 's-live', titel: 'Live schalten', danach: 'ende' }] },
  ] }] });
  it('wird aufgelöst und geprüft', () => {
    const r = importLesen(datei({ erneut: { ab: 's-sammeln', hoechstens: 2 } }));
    expect(r.fehler).toEqual([]);
    const kn = r.pakete[0].v.knoten;
    const sammeln = kn.find(x => x.titel === 'Korrekturen sammeln')!;
    expect(kn.find(x => x.titel === 'Korrekturen abgeschlossen?')!.erneut).toEqual({ ab: sammeln.id, hoechstens: 2 });
    expect(kn.find(x => x.titel === 'Live schalten')!.danach).toEqual({ ende: true });
  });
  it('unbekanntes Ziel oder Unsinn blockiert das Paket', () => {
    expect(importLesen(datei({ erneut: { ab: 's-gibtsnicht', hoechstens: 2 } })).fehler.join(' ')).toContain('gibt es im Paket nicht');
    expect(importLesen(datei({ erneut: { ab: 's-sammeln', hoechstens: 99 } })).fehler.join(' ')).toContain('höchstens');
    expect(importLesen(datei({ erneut: { ab: 's-live', hoechstens: 2 } })).pakete).toHaveLength(0);
  });
});
