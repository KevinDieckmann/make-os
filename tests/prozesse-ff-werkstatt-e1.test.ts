// ─── Fulfillment in die Werkstatt — Etappe 1 „Öffnen & Rundweg“ (22.10., Entscheidung: Weg A; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ───────────
// Gold und Wächter (erfundene Daten, kein Netz, eigener Datenordner für die Route):
//   1. Werkstatt-Säuberer vorher = nachher: jede Vorlage der Kundengewinnung (Haupt- und Teilprozesse) gibt durch `definitionAus`/`prozesseAus` dieselben Bytes
//      wie im Stand 451bd6fd (Fixture tests/fixtures/prozesse-saeuberer-vorher.json — Eingabe + Fingerabdruck der Ausgabe von damals).
//   2. Paket vorher = Paket nachher nach „Öffnen + Speichern ohne Änderung“ (JSON hin und zurück → Säuberer der Werkstatt → `paketAusDefinition` über `vorlageAus`):
//      die Muster-Pakete, ein Paket aus dem Editor (Gruppe, Entscheidung mit Nein-Erinnerung, Baustein, Bestätigung, Lage, Pfeiltext, Papierkorb, Zusatzmodul)
//      und ein Voll-Paket mit JEDEM Feld (`Record<…>` — ein neues Feld im Modell ohne Eintrag hier ist bei tsc rot). Bit-gleich, gleicher Stand.
//   3. Der Säuberer der Werkstatt allein verliert kein Fulfillment-Feld (`feldVerluste` leer).
//   4. Fulfillment-Modus: jede Art, die der Fall nicht ausführt, ist ein Fehler — `paketAusDefinition` lehnt ab, nichts wird still verworfen.
//   5. Ansicht: Bahnen Kunde/Team, Bestätigung als Raute am Ende der Phase, Gruppen, Bausteine nicht als Knoten, Lage rechnet.
//   6. Route GET ?paket=: Rechte (fremder Haushalt/Testkunde/Dienstweg ohne Person 403, Privat 403), 400/404, Inhalt (Stand, Befunde, Kunden-Regel, laufende
//      Kunden nur Business, Produkte) — und Lesen schreibt nie (Bytes des Datenordners vorher = nachher: Fall vorher = Fall nachher).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { definitionAus, prozesseAus } from '@/lib/prozesse/bestand';
import { feldVerluste, fulfillmentModusBefunde, NUR_WERKSTATT_DEFINITION, NUR_WERKSTATT_KNOTEN, paketAlsDefinition, paketAnsicht, paketAusDefinition, paketKnotenZeilen, paketUnterzeile, abstimmungsKnoten, FULFILLMENT_FORMEN } from '@/lib/prozesse/fulfillment-modus';
import { leerVorlagen, vorlagenAus } from '@/lib/fulfillment/lesen';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { editorAnwenden, type EditorOp } from '@/lib/fulfillment/prozesse/editor';
import { werkstattLage } from '@/lib/prozesse/werkstatt-lage';
import { kantenVon } from '@/lib/prozesse/fluss';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import type { KnotenForm, ProzessDefinition, ProzessKnoten, ProzessVorlage } from '@/lib/prozesse/definition';
import type { Baustein, VorlagenDatei } from '@/lib/fulfillment/typen';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ff-werkstatt-e1-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ff-werkstatt';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const J = '2026-10-22T08:00:00.000Z';
const fp = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const json = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** „Öffnen + Speichern ohne Änderung“: Server → Browser → Server, durch den Säuberer der Werkstatt und zurück ins Fulfillment. */
function oeffnenSpeichern(v: ProzessVorlage): ProzessVorlage {
  const imBrowser = json(paketAlsDefinition(v));
  const d = definitionAus(json(imBrowser) as unknown as Record<string, unknown>);
  if (!d) throw new Error('Säuberer der Werkstatt: unlesbar');
  const r = paketAusDefinition(d);
  if (!r.ok) throw new Error(`abgelehnt: ${r.befunde.map(b => b.text).join(' | ')}`);
  return r.vorlage;
}
/** Wie der Bestand ein Paket liefert (der Säuberer des Fulfillments ordnet beim Lesen). */
const gelesen = (d: VorlagenDatei): VorlagenDatei => vorlagenAus(json(d));

// ── Beispiele ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

let n = 0;
const kx = { person: 'pia', jetzt: J, heute: J.slice(0, 10), standVon: (x: object) => fingerabdruck(x as Record<string, unknown>), neueId: (p: string) => `${p}-e1t${++n}` };
function musterDatei(): VorlagenDatei {
  const a = vorlagenAnwenden(leerVorlagen(), [{ op: 'aus-muster' }], kx);
  if (!a.ok) throw new Error('aus-muster');
  return gelesen(a.datei);
}

const u = (i: number) => `fk-00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const MAIL: Baustein = { id: 'fb-mail', art: 'mail', titel: 'Begrüßungsmail', gliederung: [], platzhalter: [], tags: [], wer: 'intern', kundeSichtbar: false, fassung: 1, geaendert: J, geaendertVon: 'pia' };
const INTERN: Baustein = { ...MAIL, id: 'fb-intern', art: 'dokument', titel: 'Internes Skript', tags: ['nur-intern'] };
function editorDatei(): VorlagenDatei {
  const v: ProzessVorlage = {
    id: 'fp-editor', art: 'paket', titel: 'Testpaket', fassung: 1, geaendert: J, geaendertVon: 'pia', uebergaenge: [], rollen: [], freigaben: [{ id: 'F0', titel: 'Rahmen', wer: 'beide' }],
    knoten: [
      { id: 'fk-w', titel: 'Testpaket', rang: 1 },
      { id: 'fk-p1', elternId: 'fk-w', titel: 'Start', rang: 1, kundeSichtbar: true, freigabe: 'F0' },
      { id: 'fk-p2', elternId: 'fk-w', titel: 'Umsetzung', rang: 2, kundeSichtbar: true },
      { id: 'fk-a', elternId: 'fk-p1', titel: 'Kick-off', rang: 1, zustaendig: 'beide' },
      { id: 'fk-b', elternId: 'fk-p1', titel: 'Fragebogen', rang: 2, zustaendig: 'kunde', kundeSichtbar: true },
      { id: 'fk-g', elternId: 'fk-p2', titel: 'Skripte', rang: 1 },
      { id: 'fk-g1', elternId: 'fk-g', titel: 'Leitfaden', rang: 1 },
      { id: 'fk-g2', elternId: 'fk-g', titel: 'Einwände', rang: 2 },
      { id: 'fk-c', elternId: 'fk-p2', titel: 'Training', rang: 2 },
    ],
  };
  let d: VorlagenDatei = { ...leerVorlagen(), prozesse: [v], bausteine: [MAIL, INTERN] };
  let m = 0; // eigener Zähler: jeder Aufruf baut dasselbe Paket (deterministisch)
  const tun = (ops: EditorOp[]) => {
    const st = fingerabdruck(d.prozesse.find(p => p.id === 'fp-editor')! as unknown as Record<string, unknown>);
    const r = editorAnwenden(d, { vorlageId: 'fp-editor', stand: st, ops }, { person: 'pia', jetzt: J, standVon: x => fingerabdruck(x as Record<string, unknown>), neueId: p => `${p}-e1e${++m}` });
    if (!r.ok) throw new Error(`${r.status}: ${r.fehler}`);
    d = r.datei;
  };
  tun([
    { op: 'schritt-neu', id: u(1), ziel: { phaseId: 'fk-p2', nach: 'fk-c' }, form: 'nachricht', titel: 'Zwischenstand senden', frist: 3 },
    { op: 'schritt-neu', id: u(2), ziel: { phaseId: 'fk-p2', nach: u(1) }, form: 'entscheidung', titel: 'Passt es?', frist: 7 },
    { op: 'nein-erinnerung', id: u(3), entscheidungId: u(2), titel: 'Nachfassen' },
    { op: 'schritt-neu', id: u(4), ziel: { phaseId: 'fk-p2', nach: u(2) }, form: 'termin', titel: 'Abschluss-Termin' },
    { op: 'baustein-dazu', id: u(5), schrittId: u(1), bausteinId: MAIL.id },
    { op: 'baustein-dazu', id: u(6), schrittId: 'fk-g1', bausteinId: INTERN.id },
    { op: 'abstimmung', phaseId: 'fk-p2', an: true, titel: 'Abnahme', wer: 'kunde' },
  ]);
  tun([{ op: 'schritt-neu', id: u(7), ziel: { phaseId: 'fk-p1', nach: 'fk-b' }, form: 'schritt', titel: 'Wird gelöscht' }]);
  tun([{ op: 'weg', id: u(7) }]);
  tun([{ op: 'lage', eintraege: [{ id: 'fk-p1', pos: { x: 100, y: 40, b: 900, h: 1200 } }, { id: 'fk-a', pos: { x: 60, y: 300 } }] }, { op: 'pfeil-text', id: 'fk-a', art: 'weiter', text: 'danach' }]);
  tun([{ op: 'zusatz', an: true }]);
  return gelesen(d);
}

/** Jedes Feld eines Knotens, das das Fulfillment kennt — `Record` zwingt: ein neues Feld im Modell muss hier stehen (sonst tsc rot). */
type FfKnotenFeld = Exclude<keyof ProzessKnoten<KnotenForm>, (typeof NUR_WERKSTATT_KNOTEN)[number]>;
const KNOTEN_FELDER: Record<FfKnotenFeld, true> = {
  id: true, elternId: true, titel: true, rang: true, zone: true, kreislauf: true, ort: true, verweis: true, ziel: true, warum: true, eingang: true, ergebnis: true, kennzahl: true,
  zustaendig: true, rolle: true, dauerTage: true, aufwandStunden: true, freigabe: true, kundeSichtbar: true, phaseId: true, bausteinId: true, heute: true, werkzeuge: true,
  dokumentation: true, art: true, optional: true, ausgang: true, original: true, beleg: true, form: true, frist: true, zweige: true, pos: true, pfeilText: true, versuche: true,
};
type FfVorlageFeld = Exclude<keyof ProzessVorlage<KnotenForm>, (typeof NUR_WERKSTATT_DEFINITION)[number] | 'bereich' | 'fallArt'>;
const VORLAGE_FELDER: Record<FfVorlageFeld, true> = {
  id: true, art: true, titel: true, beschreibung: true, form: true, quelleHinweis: true, vorbehalt: true, zeichenhinweise: true, knoten: true, uebergaenge: true, freigaben: true,
  rollen: true, fassung: true, herkunft: true, geaendert: true, geaendertVon: true, phasenVonHand: true, papierkorb: true, zusatz: true,
};
function vollPaket(): ProzessVorlage {
  const roh = {
    id: 'fp-voll', art: 'paket', titel: 'Voll-Paket', beschreibung: 'Jedes Feld einmal', form: 'fluss', quelleHinweis: 'aus dem Probe-Import', vorbehalt: 'nur Probe',
    zeichenhinweise: ['oben nach unten'], uebergaenge: [{ von: 'fk-v1', nach: 'fk-v2', art: 'weiter', weiche: 'wenn ja', beleg: 'ergaenzung' }],
    freigaben: [{ id: 'F0', titel: 'Rahmen', wer: 'kunde' }], rollen: [{ id: 'r-1', titel: 'Begleitung', aufgabe: 'führt durch' }],
    fassung: 3, herkunft: { art: 'import', datei: 'probe.json', quelleIds: ['Quelle S. 4', 'q-2'], importLauf: 'il-1', am: J }, geaendert: J, geaendertVon: 'pia',
    phasenVonHand: true, zusatz: true,
    papierkorb: [{ id: 'fk-weg', am: J, von: 'pia', art: 'schritt', phaseId: 'fk-v1', platz: { nach: 'fk-v2' }, knoten: [{ id: 'fk-weg', elternId: 'fk-v1', titel: 'Alt', rang: 9 }], verweise: [{ knotenId: 'fk-v2', zweig: 'ja', ziel: 'fk-weg' }] }],
    knoten: [
      { id: 'fk-v0', titel: 'Voll-Paket', rang: 0 },
      { id: 'fk-v1', elternId: 'fk-v0', titel: 'Phase', rang: 1, zone: 'etage', kreislauf: ['fulfillment', 'nachher'], ort: 'markttraktion', freigabe: 'F0', kundeSichtbar: true, pos: { x: 10, y: 20, b: 800, h: 600 } },
      { id: 'fk-v2', elternId: 'fk-v1', titel: 'Teil', rang: 1, ziel: 'Ziel', warum: 'Warum', eingang: 'Eingang', ergebnis: 'Ergebnis', kennzahl: 'Kennzahl' },
      { id: 'fk-v3', elternId: 'fk-v2', titel: 'Schritt', rang: 1, zustaendig: 'kunde', rolle: 'r-1', dauerTage: 3, aufwandStunden: 2, phaseId: 'fk-v1', heute: 'so heute', werkzeuge: ['Tabelle'],
        dokumentation: 'Doku', art: 'stufe', optional: true, ausgang: 'weiter', original: 'Original', beleg: 'quelle', form: 'entscheidung', frist: 5,
        zweige: { ja: 'fk-v4', nein: 'fk-v5' }, pos: { x: 40, y: 80 }, pfeilText: { weiter: 'dann', ja: 'passt', nein: 'nicht' }, versuche: 4 },
      { id: 'fk-v4', elternId: 'fk-v2', titel: 'Weiter', rang: 2, form: 'schritt', verweis: 'fp-voll-ziel' },
      { id: 'fk-v5', elternId: 'fk-v2', titel: 'Erinnern', rang: 3, form: 'erinnerung', zweige: { ja: 'fk-v3' } },
      { id: 'fk-v6', elternId: 'fk-v3', titel: 'Mail', rang: 1, bausteinId: 'fb-mail', kundeSichtbar: false },
    ],
  };
  const v = vorlagenAus(json({ ...leerVorlagen(), prozesse: [roh] })).prozesse[0];
  return v;
}

// ══ 1. Werkstatt-Säuberer vorher = nachher (Gold 451bd6fd) ══════════════════════════════════════════════════════════════════════════════════

describe('Gold: der Säuberer der Werkstatt liefert für Werkstatt-Prozesse dieselben Bytes wie vor der Erweiterung', () => {
  const gold = JSON.parse(readFileSync(path.join(__dirname, 'fixtures/prozesse-saeuberer-vorher.json'), 'utf8')) as { stand: string; eingabe: Record<string, unknown>[]; definitionAus: string[]; prozesseAus: string };
  it('jede Definition der Vorlagen (Haupt- und Teilprozesse) — definitionAus', () => {
    expect(gold.eingabe.length).toBeGreaterThan(18);
    gold.eingabe.forEach((d, i) => expect(fp(definitionAus(json(d))), String(d.titel)).toBe(gold.definitionAus[i]));
  });
  it('der ganze Bestand mit Entwurf und Version — prozesseAus', () => {
    const pz = (i: number) => `pz-00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const datei = { v: 1, prozesse: gold.eingabe.map((d, i) => ({ id: pz(i), entwurf: { ...d, id: pz(i) }, versionen: [{ nr: 1, name: 'v1', am: '2026-10-22T08:00:00.000Z', von: 'pia', definition: { ...d, id: pz(i) } }], status: 'probelauf', angelegtAm: '2026-10-22T08:00:00.000Z', angelegtVon: 'pia', entwurfAm: '2026-10-22T08:00:00.000Z', entwurfVon: 'pia' })) };
    expect(fp(prozesseAus(json(datei)))).toBe(gold.prozesseAus);
  });
});

// ══ 2./3. Paket vorher = Paket nachher ═════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Gold: Paket vorher = Paket nachher nach Öffnen + Speichern ohne Änderung', () => {
  const pruefe = (v: ProzessVorlage) => {
    const nachher = oeffnenSpeichern(v);
    expect(JSON.stringify(nachher), v.titel).toBe(JSON.stringify(v));
    expect(fingerabdruck(nachher as unknown as Record<string, unknown>)).toBe(fingerabdruck(v as unknown as Record<string, unknown>));
    // Der Säuberer der Werkstatt allein verliert kein Feld.
    expect(feldVerluste(json(v), json(definitionAus(json(v) as unknown as Record<string, unknown>)))).toEqual([]);
  };
  it('die Muster-Pakete', () => {
    const pakete = musterDatei().prozesse.filter(p => p.art === 'paket');
    expect(pakete.length).toBeGreaterThanOrEqual(3);
    for (const v of pakete) pruefe(v);
  });
  it('ein Paket aus dem Editor (Gruppe, Entscheidung + Nein-Erinnerung, Baustein, Bestätigung, Lage, Pfeiltext, Papierkorb, Zusatzmodul)', () => {
    const v = editorDatei().prozesse[0];
    expect(v.zusatz).toBe(true);
    expect(v.papierkorb?.length).toBe(1);
    expect(v.freigaben.length).toBe(2);
    expect(v.phasenVonHand).toBe(true);
    pruefe(v);
  });
  it('ein Voll-Paket mit JEDEM Feld, das das Fulfillment kennt', () => {
    const v = vollPaket();
    const knotenFelder = new Set(v.knoten.flatMap(k => Object.keys(k)));
    for (const f of Object.keys(KNOTEN_FELDER)) expect(knotenFelder.has(f), `Knoten-Feld ${f} fehlt im Voll-Paket (bzw. im Säuberer)`).toBe(true);
    for (const f of Object.keys(VORLAGE_FELDER)) expect((v as unknown as Record<string, unknown>)[f], `Feld ${f}`).toBeDefined();
    pruefe(v);
  });
  it('Bereich „Fulfillment“ und Fall „Mandat“ dürfen ausdrücklich dabeistehen (Fehlen heißt dasselbe) — sonst nichts', () => {
    const v = editorDatei().prozesse[0];
    const r = paketAusDefinition({ ...paketAlsDefinition(v), bereich: 'fulfillment', fallArt: 'mandat' });
    expect(r.ok && JSON.stringify(r.vorlage)).toBe(JSON.stringify(v));
  });
});

// ══ 4. Fulfillment-Modus ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Fulfillment-Modus: was der Fall nicht ausführt, ist ein Fehler — nie still verworfen', () => {
  const basis = () => paketAlsDefinition(editorDatei().prozesse[0]);
  const mitKnoten = (extra: Partial<ProzessKnoten<never>> & Record<string, unknown>): ProzessDefinition => {
    const d = basis();
    return { ...d, knoten: d.knoten.map(k => (k.id === 'fk-a' ? { ...k, ...extra } : k)) } as ProzessDefinition;
  };
  it('die Palette sind genau die sechs Formen des Fall-Ausführers', () => {
    expect([...FULFILLMENT_FORMEN]).toEqual(['schritt', 'nachricht', 'entscheidung', 'erinnerung', 'termin', 'abstimmung']);
  });
  it('ein Paket ohne Werkstatt-Arten hat keinen Befund', () => {
    expect(fulfillmentModusBefunde(basis())).toEqual([]);
  });
  it('jede Werkstatt-Form, jedes Werkstatt-Feld am Knoten und an der Definition → abgelehnt mit Befund', () => {
    const faelle: [string, ProzessDefinition][] = [
      ...(['ausloeser', 'agent', 'warten', 'schleife', 'teilprozess', 'freigabe', 'ende'] as const).map(f => [`Form ${f}`, mitKnoten({ form: f } as never)] as [string, ProzessDefinition]),
      ['katalog', mitKnoten({ katalog: { id: 'aufgabe.anlegen' } })], ['ausloeser', mitKnoten({ ausloeser: { art: 'hand' } })],
      ['raute', mitKnoten({ raute: { art: 'score', pruefung: 'mql' } })], ['warten', mitKnoten({ warten: { art: 'dauer', tage: 1 } })],
      ['schloss', mitKnoten({ schloss: { fuer: 'fk-b', grund: 'aussen' } })], ['bahn', mitKnoten({ bahn: 'agent' })],
      ['zweige.fehler', mitKnoten({ zweige: { fehler: 'fk-b' } })], ['pfeilText.abgelaufen', mitKnoten({ pfeilText: { abgelaufen: 'zu spät' } })],
      ['eigner', { ...basis(), eigner: 'team-1' }], ['startKriterium', { ...basis(), startKriterium: 'wenn' }],
      ['zettel', { ...basis(), zettel: [{ id: 'z-1', text: 'Notiz', pos: { x: 0, y: 0 } }] }],
      ['bereich', { ...basis(), bereich: 'sales' }], ['fallArt', { ...basis(), fallArt: 'deal' }],
    ];
    for (const [name, d] of faelle) {
      const r = paketAusDefinition(d);
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.befunde.every(b => b.stufe === 'fehler'), name).toBe(true);
    }
  });
  it('was das Fulfillment nicht speichern kann, wird abgelehnt — mit Pfad (Verlust-Wächter)', () => {
    const r = paketAusDefinition({ ...basis(), titel: '' });
    expect(r.ok).toBe(false);
    const d = basis();
    const r2 = paketAusDefinition({ ...d, knoten: d.knoten.map(k => (k.id === 'fk-a' ? { ...k, frist: 99_999 } : k)) });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.befunde[0].feld).toBe('knoten[fk-a].frist');
  });
  it('feldVerluste: Listen mit Kennung über die Kennung, Reihenfolge egal; fehlende und geänderte Werte mit Pfad', () => {
    expect(feldVerluste({ l: [{ id: 'a', x: 1 }, { id: 'b' }] }, { l: [{ id: 'b' }, { id: 'a', x: 1 }] })).toEqual([]);
    expect(feldVerluste({ l: [{ id: 'a', x: 1 }] }, { l: [{ id: 'a' }] })).toEqual(['l[a].x']);
    expect(feldVerluste({ l: [{ id: 'a' }] }, { l: [] })).toEqual(['l[a]']);
    expect(feldVerluste({ t: ['x', 'y'] }, { t: ['y', 'x'] })).toEqual(['t']);
    expect(feldVerluste({ bereich: 'fulfillment', fallArt: 'mandat' }, {})).toEqual([]);
    expect(feldVerluste({ bereich: 'sales' }, {})).toEqual(['bereich']);
  });
});

// ══ 5. Ansicht ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Ansicht: dieselbe Fläche wie jeder Werkstatt-Prozess', () => {
  const d0 = editorDatei();
  const v = d0.prozesse[0];
  const bibliothek = [{ id: MAIL.id, titel: MAIL.titel, art: 'mail', kundeFrei: true }, { id: INTERN.id, titel: INTERN.titel, art: 'dokument', kundeFrei: false, grund: 'nur intern' }];
  const a = paketAnsicht(v, bibliothek);
  const k = (id: string) => a.definition.knoten.find(x => x.id === id)!;
  it('Bahnen aus „Zuständig“: Kunde → Bahn Kunde, sonst das Team; Formen wie im Editor (gesetzt oder abgeleitet)', () => {
    expect(k('fk-b').bahn).toBe('kunde');
    expect(k('fk-a').bahn).toBe('mensch');
    expect(k(u(2)).form).toBe('entscheidung');
    expect(k('fk-c').form).toBe('schritt');
    expect(a.info['fk-c'].formGesetzt).toBe(false);
  });
  it('Bestätigung als Raute am Ende ihrer Phase, Weg: letzter Schritt → Raute → erster Schritt der nächsten Phase', () => {
    const r = abstimmungsKnoten('fk-p1');
    expect(k(r).form).toBe('abstimmung');
    expect(k(r).titel).toContain('Bestätigung 1');
    expect(a.abstimmungen[r]).toBe('F0');
    const kanten = kantenVon(a.definition);
    expect(kanten.find(x => x.von === 'fk-b')?.nach).toBe(r);
    expect(kanten.find(x => x.von === r)?.nach).toBe('fk-g1');
    expect(k(abstimmungsKnoten('fk-p2')).bahn).toBe('kunde'); // „Abnahme“: der Kunde bestätigt
  });
  it('Gruppen bleiben Gruppen; Bausteine stehen nicht als Knoten, sondern im Seitenfeld (mit der Kunden-Regel)', () => {
    expect(k('fk-g1').elternId).toBe('fk-g');
    expect(a.definition.knoten.some(x => x.bausteinId)).toBe(false);
    expect(a.info[u(1)].bausteine).toEqual([{ knotenId: u(5), bausteinId: 'fb-mail', titel: 'Begrüßungsmail', art: 'mail', kundeFrei: true }]);
    expect(a.info['fk-g1'].bausteine[0]).toMatchObject({ kundeFrei: false, grund: 'nur intern' });
    expect(paketUnterzeile(a.info[u(1)])).toBe('Frist 3 T. · 1 Baustein');
    expect(paketKnotenZeilen(a.info[u(2)]).map(z => z.name)).toContain('Weg');
  });
  it('die Lage rechnet (Rahmen je Phase, Bahnen Kunde und Mensch) — und die Ansicht ändert das Paket nicht', () => {
    const vorher = JSON.stringify(v);
    const l = werkstattLage(a.definition);
    expect(l.rahmen.length).toBe(2);
    expect(l.bahnen.map(b => b.schluessel).sort()).toEqual(['kunde', 'mensch']);
    expect(JSON.stringify(v)).toBe(vorher);
    expect(fulfillmentModusBefunde(a.definition).filter(b => b.feld !== 'bahn')).toEqual([]); // die Bahnen sind nur Ansicht (nie gespeichert)
  });
  it('die Muster-Pakete lassen sich ansehen (keine Ausnahme, jeder Schritt mit Info)', () => {
    for (const p of musterDatei().prozesse.filter(x => x.art === 'paket')) {
      const x = paketAnsicht(p);
      expect(Object.keys(x.info).length, p.titel).toBeGreaterThan(0);
      expect(() => werkstattLage(x.definition)).not.toThrow();
    }
  });
});

// ══ 6. Route GET ?paket= ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const sitzung = (person: string) => ({ 'x-make-user': person });
const dienst = (person?: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
async function hole(kopf: Record<string, string>, suche: string): Promise<{ status: number; j: Record<string, unknown> | null }> {
  const { GET } = await import('@/app/api/prozesse/werkstatt/route');
  const r = await GET(new Request(`http://test/api/prozesse/werkstatt${suche}`, { headers: kopf }));
  return { status: r.status, j: await r.json().catch(() => null) };
}
function bytes(): Record<string, string> {
  const raus: Record<string, string> = {};
  const geh = (o: string) => { for (const x of readdirSync(o)) { const p = path.join(o, x); if (statSync(p).isDirectory()) geh(p); else raus[path.relative(ordner, p)] = fp(readFileSync(p).toString('base64')); } };
  geh(ordner);
  return raus;
}
const fall = (mandatId: string, vorlageId: string, status = 'laeuft') => ({
  mandatId, vorlageId, vorlageFassung: 1, gestartetAm: J, gestartetVon: 'pia', status, knoten: [{ id: 'fk-a', titel: 'Kick-off', rang: 1, status: 'offen' }], freigaben: {}, onboarding: {},
  stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {}, befaehigung: [], marken: {}, geaendert: J, geaendertVon: 'pia',
});
let vorher: Record<string, string> = {};

describe('Route GET /api/prozesse/werkstatt?paket= — nur lesen', () => {
  beforeAll(async () => {
    const db = await import('@/lib/store/local-db');
    const konto = (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
      ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Probe`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, ...extra });
    await db.saveJson('konten', { konten: [
      konto('k1', 'pia', 'inhaber', { haushalt: 'haus-ff' }), konto('k2', 'olaf', 'mitglied', { haushalt: 'haus-ff' }),
      konto('k3', 'partnerin', 'mitglied', { haushalt: 'haus-ff', finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'anderer-haus' }), konto('k5', 'kunde', 'mitglied'),
    ], einladungen: [] });
    const d = editorDatei();
    await db.saveJson('fulfillment--haus-ff', { ...d, zuordnung: { 'p-probe': { vorlageId: 'fp-editor' } } });
    const { leererBestand } = await import('@/lib/crm/speicher');
    const mandat = (id: string, gesellschaft: string) => ({ id, kunde: 'Probe GmbH', titel: 'Probe', art: 'retainer', gesellschaft, status: 'aktiv', vertragUnterschrieben: true, geaendert: J });
    await db.saveJson('crm', { ...leererBestand(), mandate: [mandat('ma-1', 'ug'), mandat('ma-2', 'ug'), mandat('ma-3', 'kdc'), mandat('ma-4', 'ug')],
      leistungen: [{ id: 'p-probe', name: 'Probe-Produkt', typ: 'retainer', stufe: 'kern', preis: { betrag: 1, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: J }] });
    // Zwei laufende Business-Fälle, einer abgeschlossen, einer an einem Mandat der Selbstständigkeit (Privat) — gezählt werden nur die zwei.
    await db.saveJson('fulfillment-faelle--haus-ff', { version: 1, faelle: {
      'ma-1': fall('ma-1', 'fp-editor'), 'ma-2': fall('ma-2', 'fp-editor', 'onboarding'), 'ma-3': fall('ma-3', 'fp-editor'), 'ma-4': fall('ma-4', 'fp-editor', 'abgeschlossen'),
    } });
    vorher = bytes();
  });
  afterAll(async () => {
    await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => undefined);
    rmSync(ordner, { recursive: true, force: true });
  });
  it('fremder Haushalt, Testkunde, Dienstweg ohne Person → 403; Sicht Privat → 403', async () => {
    for (const k of [sitzung('gast'), sitzung('kunde'), dienst()]) expect((await hole(k, '?space=business&paket=fp-editor')).status).toBe(403);
    expect((await hole(sitzung('pia'), '?space=privat&paket=fp-editor')).status).toBe(403);
  });
  it('400 bei unsinniger Kennung, 404 bei unbekanntem Paket', async () => {
    expect((await hole(sitzung('pia'), '?space=business&paket=pz-falsch')).status).toBe(400);
    expect((await hole(sitzung('pia'), '?space=business&paket=fp-gibt-es-nicht')).status).toBe(404);
  });
  it('liefert das Paket aus dem Fulfillment-Bestand (keine Kopie), Stand, Befunde, Kunden-Regel, laufende Business-Kunden, Produkte', async () => {
    for (const p of ['pia', 'olaf', 'partnerin']) {
      const r = await hole(sitzung(p), '?space=business&paket=fp-editor');
      expect(r.status, p).toBe(200);
      const j = r.j as { paket: ProzessVorlage; stand: string; befunde: unknown[]; bibliothek: { id: string; kundeFrei: boolean }[]; laufende: number; produkte: { id: string; name: string }[]; editor: string; bearbeiten: boolean };
      expect(JSON.stringify(j.paket)).toBe(JSON.stringify(editorDatei().prozesse[0]));
      expect(j.stand).toBe(fingerabdruck(j.paket as unknown as Record<string, unknown>));
      expect(j.befunde).toEqual([]);
      expect(j.bibliothek.map(b => [b.id, b.kundeFrei]).sort()).toEqual([['fb-intern', false], ['fb-mail', true]]);
      expect(j.laufende).toBe(2);
      expect(j.produkte).toEqual([{ id: 'p-probe', name: 'Probe-Produkt' }]);
      expect(j.editor).toContain('/os/mandate/fulfillment');
      // Seit E2 bearbeiten volle Mitglieder (wie im Editor des Fulfillments); „nur Business“ sieht nur.
      expect(j.bearbeiten).toBe(p !== 'partnerin');
    }
  });
  it('Lesen schreibt nie: Bytes des Datenordners vorher = nachher (Fall vorher = Fall nachher), kein Eintrag in prozesse--…', async () => {
    await hole(sitzung('pia'), '?space=business&paket=fp-editor');
    await hole(sitzung('pia'), '?space=business');
    expect(bytes()).toEqual(vorher);
  });
  it('die Liste der Werkstatt führt das Paket weiter als Fulfillment (nur lesen) — nichts doppelt', async () => {
    const r = await hole(sitzung('pia'), '?space=business');
    const l = (r.j as { prozesse: { id: string; quelle: string; nurLesen: boolean }[] }).prozesse.filter(p => p.id === 'fp-editor');
    expect(l).toEqual([expect.objectContaining({ quelle: 'fulfillment', nurLesen: true })]);
  });
});
