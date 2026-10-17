// ─── Fulfillment — Import vollständig (versuche, pos, pfeilText, „Siehe auch“) und Zusatzmodule (17.10. spät) ──────────────────────────────
// Kevin: „Das Fulfillment soll maximal einfach für uns sein.“ Geprüft (rein, ohne Datenordner, erfundene Daten):
//   · Säuberung: „Siehe auch“ nur auf vorhandene Bausteine, nie auf sich selbst, gelöschte fallen beim Lesen weg; `zusatz` nur an Paketen; Fall-Felder
//     (`zusaetze`, `ohneOnboarding`, `FallKnoten.zusatz`) bleiben; Altbestand ohne die Felder bleibt Byte für Byte.
//   · Import: `versuche`, `pos`, `pfeilText` an Knoten (dieselbe Prüfung wie der Editor), `zusatz` am Paket, `siehe_auch`/`sieheAuch` an Bausteinen.
//   · Zusatzmodul: ohne laufenden Fall ein Fall OHNE Onboarding; mit laufendem Fall angehängt als eigener Abschnitt (kein zweiter Fall, kein zweites Onboarding),
//     Ausführung parallel, Reise und Kunden-Sicht stimmig, neue Fassung per Übernahme ohne Verlust.
import { describe, it, expect } from 'vitest';
import { leerVorlagen, vorlagenAus, faelleAus, bausteinAus, vorlageAus } from '@/lib/fulfillment/lesen';
import { importLesen, importVorschau, importAnwenden } from '@/lib/fulfillment/prozesse/import';
import { editorAnwenden } from '@/lib/fulfillment/prozesse/editor';
import { fallStarten, fallAnwenden, zusatzAnhaengen, zusatzDiff, zusatzUebernehmen, vorlagenDiff, vorlageUebernehmen, fallFreigaben, abschnitteOrdnen, type FallKontext } from '@/lib/fulfillment/prozesse/fall';
import { onboardingStand } from '@/lib/fulfillment/prozesse/onboarding';
import { aktiveKnoten, ausfuehrungSoll } from '@/lib/fulfillment/prozesse/ausfuehrung';
import { fallReise } from '@/lib/fulfillment/prozesse/reise';
import { reiseZeile, abschlussPhaseId } from '@/lib/fulfillment/prozesse/reise-bild';
import { kundenTeile } from '@/lib/fulfillment/kunde/bild';
import { phasenOrdnen } from '@/lib/fulfillment/prozesse/phasen';
import { aktuellerKnoten, jetztPhasen, kinderVon, wurzelVon, zusatzJeKnoten } from '@/lib/fulfillment/regeln';
import { vergleicheBestand } from '@/lib/betrieb/update-probe';
import type { Fall, FallKnoten, ProzessVorlage, VorlagenDatei } from '@/lib/fulfillment/typen';

const J = '2026-10-17T09:00:00.000Z';
const HEUTE = '2026-10-17';
let N = 0;
const kid = () => `fk-z${++N}`;
const ik = (laufId: string) => ({ person: 'pia', jetzt: J, heute: HEUTE, datei: 'probe.json', laufId });
const ok = <D>(r: { ok: true; datei: D } | { ok: false; status: number; fehler: string }): D => { if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`); return r.datei; };
const roh = <T>(x: T): unknown => JSON.parse(JSON.stringify(x));
const stand = (x: object) => String(JSON.stringify(x).length);

const BAUSTEINE = {
  vorlagen: [
    { id: 'probe-leitfaden', art: 'skript', titel: 'Probe-Leitfaden', zweck: 'Erfunden.', siehe_auch: ['probe-einwand', 'probe-leitfaden', 'probe-fehlt'] },
    { id: 'probe-einwand', art: 'dokument', titel: 'Probe-Einwände', zweck: 'Erfunden.', sieheAuch: ['probe-leitfaden'] },
    { id: 'probe-mail', art: 'mail', titel: 'Probe-Erinnerung', zweck: 'Erfunden.' },
  ],
};
/** Ein Paket und ein Zusatzmodul (erfunden) — das Modul mit Versuchen, Lage und Pfeil-Beschriftung. */
const PAKETE = {
  format: 'make-os/pakete',
  pakete: [
    {
      schluessel: 'probe-paket', titel: 'Probe-Paket', abstimmungen: [{ id: 'F0', titel: 'Rahmen abgestimmt', wer: 'beide' }],
      phasen: [
        { id: 'p-analyse', titel: 'Analyse', abstimmung: 'F0', fluss: [{ id: 'a1', titel: 'Außensicht', frist: 1 }, { id: 'a2', titel: 'Fragen senden', form: 'nachricht', frist: 2 }] },
        { id: 'p-umsetzung', titel: 'Umsetzung', fluss: [{ id: 'u1', titel: 'Umsetzen', frist: 3 }] },
      ],
    },
    {
      schluessel: 'probe-telefonie', titel: 'Probe-Telefonie (Zusatzmodul)', zusatz: true, abstimmungen: [{ id: 'T1', titel: 'Liste freigegeben', wer: 'beide' }],
      phasen: [
        {
          id: 't-liste', titel: 'Liste vorbereiten', abstimmung: 'T1', dauerTage: 7, pos: { x: 40, y: 60, b: 600, h: 500 },
          fluss: [
            { id: 't1', titel: 'Liste aufbauen', frist: 0, bausteine: ['probe-leitfaden'], pos: { x: 20, y: 100 } },
            { id: 't2', titel: 'Erreicht?', form: 'entscheidung', frist: 1, zweige: { nein: 't3' }, pfeilText: { ja: 'Termin', nein: 'nicht erreicht' } },
            { id: 't3', titel: 'Nächster Versuch', form: 'erinnerung', versuche: 5, zweige: { ja: 't2' }, bausteine: ['probe-mail'] },
          ],
        },
        { id: 't-auswertung', titel: 'Auswertung', fluss: [{ id: 't4', titel: 'Bericht schreiben', frist: 2 }] },
      ],
    },
  ],
};

function bibliothek(): VorlagenDatei {
  const d = ok(importAnwenden(leerVorlagen(), BAUSTEINE, {}, ik('fi-b'), kid));
  return vorlagenAus(roh(ok(importAnwenden(d, PAKETE, {}, ik('fi-p'), kid))));
}
const paket = (d: VorlagenDatei, t: string) => d.prozesse.find(p => p.titel === t)!;
const titel = <T extends { id: string; titel: string }>(kn: readonly T[], t: string): T => kn.find(x => x.titel === t)!;
const fk = (freigaben: string[]): FallKontext => ({ person: 'pia', jetzt: J, heute: HEUTE, standVon: stand, neueId: p => `${p}-z${++N}`, ziele: [], kontaktErlaubt: () => true, ritualIds: [], freigaben });
const start = (v: ProzessVorlage, tag = '2026-10-01') => fallStarten({ mandatId: 'm-probe', vorlage: v, person: 'pia', jetzt: J, start: tag, neueId: p => `${p}-z${++N}` });
const ABL = { ziele: [], formularProzent: null, kickoffRitualIds: [], willkommenStunden: 24, jetzt: J };

describe('Säuberung', () => {
  it('„Siehe auch“: nur gültige, eindeutige Kennungen, nie der Baustein selbst — gelöschte fallen beim Lesen weg', () => {
    const b = bausteinAus({ id: 'fb-a', art: 'dokument', titel: 'A', sieheAuch: ['fb-b', 'fb-b', 'fb-a', '???', 'fb-c'] })!;
    expect(b.sieheAuch).toEqual(['fb-b', 'fb-c']);
    const d = vorlagenAus({ bausteine: [b, { id: 'fb-b', art: 'dokument', titel: 'B', sieheAuch: ['fb-weg'] }] });
    expect(d.bausteine[0].sieheAuch).toEqual(['fb-b']);
    expect('sieheAuch' in d.bausteine[1]).toBe(false);
  });
  it('`zusatz` nur an Paketen und nur als true; Fall-Felder bleiben beim Lesen', () => {
    expect(vorlageAus({ id: 'fp-a', art: 'paket', titel: 'A', knoten: [{ id: 'fk-w', titel: 'A', rang: 1 }], zusatz: true })!.zusatz).toBe(true);
    expect('zusatz' in vorlageAus({ id: 'fp-b', art: 'ablauf', titel: 'B', knoten: [{ id: 'fk-w', titel: 'B', rang: 1 }], zusatz: true })!).toBe(false);
    expect('zusatz' in vorlageAus({ id: 'fp-c', art: 'paket', titel: 'C', knoten: [{ id: 'fk-w', titel: 'C', rang: 1 }], zusatz: 'ja' })!).toBe(false);
    const d = bibliothek();
    const f = ok(zusatzAnhaengen(start(paket(d, 'Probe-Paket')), { vorlage: paket(d, 'Probe-Telefonie (Zusatzmodul)'), person: 'pia', jetzt: J, start: HEUTE }));
    const gelesen = faelleAus(roh({ version: 1, faelle: { 'm-probe': f } }));
    expect(vergleicheBestand('fulfillment-faelle--h', roh({ version: 1, faelle: { 'm-probe': f } }), roh(gelesen)).abweichungen).toEqual([]);
    const z = start(paket(d, 'Probe-Telefonie (Zusatzmodul)'));
    expect(faelleAus(roh({ version: 1, faelle: { 'm-probe': z } })).faelle['m-probe'].ohneOnboarding).toBe(true);
  });
  it('Phasen eines Zusatzmoduls bleiben beim Ordnen hinter denen des Pakets (nie eingeordnet, nie zusammengelegt)', () => {
    const kn = [
      { id: 'w', titel: 'Fall', rang: 1, status: 'offen' },
      { id: 'u', elternId: 'w', titel: 'Umsetzung', rang: 1, status: 'offen' },
      { id: 'z', elternId: 'w', titel: 'Analyse', rang: 2, status: 'offen', zusatz: 'fp-z' },
      { id: 'a', elternId: 'w', titel: 'Analyse', rang: 3, status: 'offen' },
    ];
    const r = phasenOrdnen(kn);
    expect(kinderVon('w', r).map(k => k.id)).toEqual(['a', 'u', 'z']);
  });
});

describe('Import: was bisher wegfiel, kommt an', () => {
  it('versuche, pos (Phase und Schritt) und pfeilText an Knoten, zusatz am Paket', () => {
    const g = importLesen(PAKETE);
    expect(g.fehler).toEqual([]);
    const t = g.pakete[1].v;
    expect(t.zusatz).toBe(true);
    expect(g.pakete[0].v.zusatz).toBeUndefined();
    expect(titel(t.knoten, 'Liste vorbereiten').pos).toEqual({ x: 40, y: 60, b: 600, h: 500 });
    expect(titel(t.knoten, 'Liste aufbauen').pos).toEqual({ x: 20, y: 100 });
    expect(titel(t.knoten, 'Erreicht?').pfeilText).toEqual({ ja: 'Termin', nein: 'nicht erreicht' });
    expect(titel(t.knoten, 'Nächster Versuch').versuche).toBe(5);
    // Gespeichert und wieder gelesen: alles noch da.
    const v = paket(bibliothek(), 'Probe-Telefonie (Zusatzmodul)');
    expect(v.zusatz).toBe(true);
    expect(titel(v.knoten, 'Nächster Versuch').versuche).toBe(5);
    expect(titel(v.knoten, 'Erreicht?').pfeilText).toEqual({ ja: 'Termin', nein: 'nicht erreicht' });
  });
  it('dieselbe Prüfung wie der Editor: Versuche 1–20 ganz, Lage in den Grenzen, Größe nur am Rahmen, Pfeiltext kurz', () => {
    const mit = (x: Record<string, unknown>, ph: Record<string, unknown> = {}) => importLesen({ pakete: [{ titel: 'X', phasen: [{ id: 'p', titel: 'P', ...ph, fluss: [{ id: 's', titel: 'S', ...x }] }] }] });
    expect(mit({ versuche: 0 }).blockiert).toBe(true);
    expect(mit({ versuche: 21 }).blockiert).toBe(true);
    expect(mit({ versuche: 2.5 }).blockiert).toBe(true);
    expect(mit({ pos: { x: 'a', y: 1 } }).blockiert).toBe(true);
    expect(mit({ pos: { x: 1, y: 1, b: 500 } }).blockiert).toBe(true);
    expect(mit({ pfeilText: { weiter: 'x'.repeat(61) } }).blockiert).toBe(true);
    expect(mit({ pfeil_text: { weiter: 'weiter so' } }).pakete[0].v.knoten.find(k => k.titel === 'S')!.pfeilText).toEqual({ weiter: 'weiter so' });
    expect(mit({}, { pos: { x: 0, y: 0, b: 400, h: 300 } }).blockiert).toBe(false);
    expect(importLesen({ pakete: [{ titel: 'Y', zusatz: 'ja', phasen: [{ id: 'p', titel: 'P' }] }] }).blockiert).toBe(true);
  });
  it('„siehe auch“: Kennungen der Quelle → fb-imp-…, nie sich selbst, Unbekanntes fällt mit Hinweis weg; mehr als 20 → übersprungen', () => {
    const v = importVorschau(BAUSTEINE, leerVorlagen(), 'b.json');
    expect(v.hinweise.some(h => /siehe auch/.test(h) && /fallen weg/.test(h))).toBe(true);
    const d = bibliothek();
    expect(d.bausteine.find(b => b.id === 'fb-imp-probe-leitfaden')!.sieheAuch).toEqual(['fb-imp-probe-einwand']);
    expect(d.bausteine.find(b => b.id === 'fb-imp-probe-einwand')!.sieheAuch).toEqual(['fb-imp-probe-leitfaden']);
    const viele = importLesen({ vorlagen: [{ id: 'zu-viel', art: 'dokument', titel: 'Viel', siehe_auch: Array.from({ length: 21 }, (_, i) => `b-${i}`) }] });
    expect(viele.bausteine).toEqual([]);
    expect(viele.fehler[0]).toMatch(/höchstens 20/);
  });
  it('wiederholbar: derselbe Import ist „gleich“; „siehe auch“ ergänzt einen Baustein, der es noch nicht hatte', () => {
    const d = bibliothek();
    const v = importVorschau(PAKETE, d, 'p.json');
    expect(v.paketVorlagen.map(p => p.status)).toEqual(['gleich', 'gleich']);
    const ohne = vorlagenAus(roh({ ...d, bausteine: d.bausteine.map(b => (b.id === 'fb-imp-probe-einwand' ? { ...b, sieheAuch: undefined } : b)) }));
    const b = importVorschau(BAUSTEINE, ohne, 'b.json').bausteine.find(x => x.id === 'fb-imp-probe-einwand')!;
    expect(b).toMatchObject({ status: 'ergaenzt', felder: ['sieheAuch'] });
  });
});

describe('Zusatzmodul ohne laufenden Fall', () => {
  it('startet als normaler Fall OHNE vorangestellte Onboarding-Phase — läuft sofort', () => {
    const d = bibliothek();
    const f = start(paket(d, 'Probe-Telefonie (Zusatzmodul)'));
    expect(f.ohneOnboarding).toBe(true);
    expect(f.status).toBe('laeuft');
    expect(f.knoten.some(k => k.id.startsWith('fk-ob'))).toBe(false);
    expect(kinderVon(wurzelVon(f.knoten)!.id, f.knoten).map(p => p.titel)).toEqual(['Liste vorbereiten', 'Auswertung']);
    expect(onboardingStand(f, ABL)).toEqual({ schritte: [], fertig: true, offen: 0, willkommen: { ueberfaellig: false } });
    // Das normale Paket legt sein Onboarding weiter an (unverändert).
    const p = start(paket(d, 'Probe-Paket'));
    expect(p.knoten.filter(k => k.id.startsWith('fk-ob-')).length).toBe(8);
    expect(p.ohneOnboarding).toBeUndefined();
  });
});

describe('Zusatzmodul an einen laufenden Fall', () => {
  const vorbereitet = () => {
    const d = bibliothek();
    const p = paket(d, 'Probe-Paket'), t = paket(d, 'Probe-Telefonie (Zusatzmodul)');
    const f0 = start(p);
    const f = ok(zusatzAnhaengen(f0, { vorlage: t, person: 'pia', jetzt: J, start: HEUTE }));
    return { d, p, t, f0, f };
  };
  it('kein zweiter Fall, kein zweites Onboarding: die Phasen hängen als eigener Abschnitt hinten an, markiert und mit Fälligkeiten ab dem Start', () => {
    const { f0, f, t } = vorbereitet();
    const w = wurzelVon(f.knoten)!;
    const phasen = kinderVon(w.id, f.knoten);
    expect(phasen.map(x => [x.titel, x.zusatz ?? null])).toEqual([
      ...kinderVon(w.id, f0.knoten).map(x => [x.titel, null]),
      ['Liste vorbereiten', t.id], ['Auswertung', t.id],
    ]);
    expect(phasen.map(x => x.rang)).toEqual(phasen.map((_, i) => i + 1));
    expect(f.knoten.filter(k => k.id.startsWith('fk-ob-')).length).toBe(8);
    expect(f.zusaetze).toEqual([{ vorlageId: t.id, vorlageFassung: t.fassung, wurzelId: wurzelVon(t.knoten)!.id, titel: t.titel, startAm: HEUTE, angehaengtAm: J, angehaengtVon: 'pia' }]);
    expect(titel(f.knoten, 'Liste vorbereiten').faelligAm).toBe('2026-10-24');
    expect(titel(f.knoten, 'Liste aufbauen').faelligAm).toBe(HEUTE);
    // Nichts vom bisherigen Fall geht verloren.
    for (const k of f0.knoten) expect(f.knoten.find(x => x.id === k.id), k.titel).toEqual(k);
    // Versuche kommen mit in den Fall.
    expect(titel(f.knoten, 'Nächster Versuch').versuche).toBe(5);
  });
  it('abgelehnt: schon angehängt, dasselbe Paket, kein Zusatzmodul, abgeschlossener Fall, doppelter Abstimmungspunkt', () => {
    const { p, t, f0, f } = vorbereitet();
    const r = (fall: Fall, v: ProzessVorlage) => zusatzAnhaengen(fall, { vorlage: v, person: 'pia', jetzt: J, start: HEUTE });
    expect(r(f, t)).toMatchObject({ ok: false, status: 409 });
    expect(r(start(t), t)).toMatchObject({ ok: false, status: 409 });
    expect(r(f0, p)).toMatchObject({ ok: false, status: 400 });
    expect(r({ ...f0, status: 'abgeschlossen' }, t)).toMatchObject({ ok: false, status: 409 });
    const kollision = { ...t, id: 'fp-andere', knoten: t.knoten.map(k => ({ ...k, id: `${k.id}-x`, ...(k.elternId ? { elternId: `${k.elternId}-x` } : {}), ...(k.freigabe ? { freigabe: 'F0' } : {}) })) };
    expect(r(f0, kollision)).toMatchObject({ ok: false, status: 409 });
  });
  it('Ausführung: Paket und Zusatzmodul laufen nebeneinander — je Abschnitt ein Knoten, Fälligkeit ab dem Start des Abschnitts', () => {
    const { f } = vorbereitet();
    const a = aktiveKnoten(f).map(x => [x.knoten.titel, x.faellig ?? null]);
    expect(a).toContainEqual(['Liste aufbauen', HEUTE]);
    // Das Paket steht noch im Onboarding (abgeleitete Schritte, ohne Form) — sein Knoten ist trotzdem dabei, daneben der Abschnitt des Moduls.
    const z = zusatzJeKnoten(f.knoten);
    expect(aktiveKnoten(f).some(x => !z.has(x.knoten.id))).toBe(true);
    expect(aktiveKnoten(f).filter(x => z.has(x.knoten.id)).map(x => x.knoten.titel)).toEqual(['Liste aufbauen']);
    const soll = ausfuehrungSoll(f, HEUTE);
    expect(soll.aufgaben.map(x => x.titel)).toContain('Liste aufbauen');
  });
  it('Reise und Kunden-Sicht: Abschnitt markiert, laufende Phase je Abschnitt „jetzt“; der Abschluss hängt am Paket, nie am Modul', () => {
    const { d, f } = vorbereitet();
    const fg = fallFreigaben(f, d.prozesse);
    expect(fg.map(x => x.id)).toEqual(['F0', 'T1']);
    const r = fallReise(f, fg, HEUTE);
    const liste = r.phasen.find(x => x.titel === 'Liste vorbereiten')!;
    expect(liste.modul).toEqual({ id: paket(d, 'Probe-Telefonie (Zusatzmodul)').id, titel: 'Probe-Telefonie' });
    expect(liste.zustand).toBe('jetzt');
    expect(liste.freigabe?.titel).toBe('Liste freigegeben');
    expect(r.phasen.filter(x => !x.modul).find(x => x.zustand === 'jetzt')!.id).toBe(aktuellerKnoten(f).phase!.id);
    expect(r.phasen.find(x => x.titel === 'Auswertung')!.zustand).toBe('offen');
    expect(jetztPhasen(f).size).toBe(2);
    expect(f.knoten.find(k => k.id === abschlussPhaseId(f))!.zusatz).toBeUndefined();
    const z = reiseZeile({ fall: f, freigaben: fg, heute: HEUTE });
    expect(z.spalten.filter(s => s.modul).map(s => s.titel)).toEqual(['Liste vorbereiten', 'Auswertung']);
    const k = kundenTeile({ fall: f, mandat: { ziele: [] }, heute: HEUTE, anrede: 'sie', gesperrt: new Set(), freigaben: fg });
    expect(k.phasen.filter(x => x.stand === 'aktuell').length).toBe(2);
  });
  it('die Vorlage des Pakets ändern: Diff und Übernahme fassen den Abschnitt nie an', () => {
    const { p, f } = vorbereitet();
    const v1: ProzessVorlage = { ...p, fassung: p.fassung + 1 };
    const diff = vorlagenDiff(f, v1)!;
    expect(diff.entfernt).toEqual([]);
    const neu = vorlageUebernehmen(f, v1, J, 'pia');
    const z = zusatzJeKnoten(neu.knoten);
    expect(f.knoten.filter(k => zusatzJeKnoten(f.knoten).has(k.id)).every(k => z.has(k.id))).toBe(true);
    expect(kinderVon(wurzelVon(neu.knoten)!.id, neu.knoten).slice(-2).map(x => x.titel)).toEqual(['Liste vorbereiten', 'Auswertung']);
  });
  it('neue Fassung des Zusatzmoduls: Diff zeigt nur den Abschnitt, Übernahme fügt hinzu — erledigte Schritte bleiben erledigt', () => {
    const { d, t, f, p } = vorbereitet();
    let fall = ok(fallAnwenden(f, [{ op: 'knoten-status', id: titel(f.knoten, 'Liste aufbauen').id, status: 'erledigt' }], fk(['F0', 'T1'])));
    expect(zusatzDiff(fall, t)).toBeNull();
    // Im Editor: ein neuer Schritt in „Auswertung“.
    const ausw = titel(t.knoten, 'Auswertung');
    const neueId = 'fk-00000000-0000-4000-8000-000000000077';
    const d1 = ok(editorAnwenden(d, { vorlageId: t.id, stand: stand(t), ops: [{ op: 'schritt-neu', id: neueId, ziel: { phaseId: ausw.id }, form: 'termin', titel: 'Abschluss-Termin' }] }, { person: 'pia', jetzt: J, standVon: stand, neueId: x => `${x}-z${++N}` }));
    const t1 = paket(d1, t.titel);
    expect(t1.fassung).toBe(t.fassung + 1);
    const diff = zusatzDiff(fall, t1)!;
    expect(diff.neu.map(x => x.titel)).toEqual(['Abschluss-Termin']);
    expect(diff.entfernt).toEqual([]);
    expect(vorlagenDiff(fall, p)).toBeNull();
    fall = zusatzUebernehmen(fall, t1, J, 'pia');
    expect(titel(fall.knoten, 'Abschluss-Termin')).toMatchObject({ status: 'offen', form: 'termin' });
    expect(titel(fall.knoten, 'Liste aufbauen').status).toBe('erledigt');
    expect(fall.zusaetze![0].vorlageFassung).toBe(t1.fassung);
    expect(zusatzDiff(fall, t1)).toBeNull();
  });
  it('Abschnitte ordnen: ohne Zusatzmodul dieselbe Liste (Byte für Byte), sonst das Paket zuerst', () => {
    const { f0, f } = vorbereitet();
    expect(abschnitteOrdnen(f0.knoten)).toBe(f0.knoten);
    const durcheinander = f.knoten.map(k => (k.zusatz ? { ...k, rang: k.rang - 100 } : k));
    const r = abschnitteOrdnen(durcheinander, f.zusaetze);
    expect(kinderVon(wurzelVon(r)!.id, r).slice(-2).map(x => x.titel)).toEqual(['Liste vorbereiten', 'Auswertung']);
  });
  it('der Schalter „Zusatzmodul“ im Editor ist keine neue Fassung (laufende Fälle sehen nichts)', () => {
    const d = bibliothek();
    const p = paket(d, 'Probe-Paket');
    const d1 = ok(editorAnwenden(d, { vorlageId: p.id, stand: stand(p), ops: [{ op: 'zusatz', an: true }] }, { person: 'pia', jetzt: J, standVon: stand, neueId: x => `${x}-z${++N}` }));
    expect(paket(d1, 'Probe-Paket')).toMatchObject({ zusatz: true, fassung: p.fassung });
    const d2 = ok(editorAnwenden(d1, { vorlageId: p.id, stand: stand(paket(d1, 'Probe-Paket')), ops: [{ op: 'zusatz', an: false }] }, { person: 'pia', jetzt: J, standVon: stand, neueId: x => `${x}-z${++N}` }));
    expect('zusatz' in paket(d2, 'Probe-Paket')).toBe(false);
  });
});

describe('Update-Probe: Altbestand ohne die neuen Felder', () => {
  it('Vorlagen und Fälle ohne `zusatz`, `sieheAuch`, `zusaetze` lesen und schreiben → kein Verlust', () => {
    const d = bibliothek();
    // So, wie die Online-Fassung speichert: ohne die neuen Felder.
    const alt = roh({ ...d, prozesse: d.prozesse.map(({ zusatz: _z, ...p }) => ({ ...p, knoten: p.knoten.map(({ versuche: _v, pos: _p, pfeilText: _t, ...k }) => k) })), bausteine: d.bausteine.map(({ sieheAuch: _s, ...b }) => b) });
    expect(JSON.stringify(alt)).not.toMatch(/"zusatz"|"sieheAuch"|"versuche"|"pfeilText"|"pos"/);
    expect(vergleicheBestand('fulfillment--h', alt, roh(vorlagenAus(alt))).abweichungen).toEqual([]);
    const v = (vorlagenAus(alt).prozesse.find(p => p.titel === 'Probe-Paket'))!;
    const fall = start(v);
    const altF = roh({ version: 1, faelle: { 'm-probe': fall } });
    expect(JSON.stringify(altF)).not.toMatch(/"zusaetze"|"ohneOnboarding"|"zusatz"/);
    const gelesen = faelleAus(altF);
    expect(vergleicheBestand('fulfillment-faelle--h', altF, roh(gelesen)).abweichungen).toEqual([]);
    // Ohne Zusatzmodul läuft die Ausführung wie bisher (nur der Abschnitt des Pakets).
    expect(aktiveKnoten(gelesen.faelle['m-probe']).every(x => !x.knoten.zusatz)).toBe(true);
    expect(fallReise(gelesen.faelle['m-probe'], v.freigaben, HEUTE).phasen.every(x => !x.modul)).toBe(true);
  });
});

// Typprüfung der Hilfen (nicht ausgeführt).
void (null as unknown as FallKnoten);
