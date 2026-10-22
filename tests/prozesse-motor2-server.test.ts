// ─── Prozesse · Motor-Rest (22.10. spät) — von Ende zu Ende im Motor-Server (lib/prozesse/lauf-server.ts) ──────────────────────────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz; das Modell ist nachgebaut (gezählt, ohne Netz). Geprüft:
//   · Schleife über eine CRM-Abfrage: nur Business, Art. 18 heraus, Obergrenze je Lauf mit sichtbarem Rest, der Rest kommt im nächsten Lauf; ein Abbruch mitten
//     in der Schleife startet beim Wiederholen nichts doppelt
//   · Nachtlauf (E-V5): Abfrage und Schleife laufen um 02:00, die Agenten-Schritte der Teil-Läufe warten bis 07:00 — dann gedrosselt je Takt
//   · Research nur als Vorschlag mit Feldern (Häkchen je Feld, nie direkt in die Karte), Vertrag an die Raute, fremd + Frische 90 Tage über alle Prozesse
//   · Platzhalter: Eigner-Rolle aufgelöst bzw. klarer Halt, Postfach des Laufs (ohne Business-Postfach Halt, mit einem: im Sende-Auftrag), Gesellschaft des Falls
//   · V01 (Nächtlicher Prospecting-Lauf) und sein Teilprozess laufen im Probelauf mit dem Beispiel-Fall ganz durch
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentSchritt, ProzessDefinition, ProzessEintrag } from '@/lib/prozesse/definition';
import type { ProzessLauf } from '@/lib/prozesse/lauf-typen';
import { definition, fk, schritt, konto, J } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-prozesse-motor2-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-prozesse-motor2';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

// Das Modell — nachgebaut: zählt Aufrufe und Web-Recherchen, antwortet mit der Antwort des Tests (Kosten über die Tokens, zwei Web-Suchen).
const modell = vi.hoisted(() => ({ aufrufe: 0, web: 0, suchen: 0 as number | undefined, kategorien: [] as string[][], antwort: '' }));
vi.mock('@/lib/anthropic', async () => {
  const echt = await vi.importActual<typeof import('@/lib/anthropic')>('@/lib/anthropic');
  const antwort = async (o: { ki?: { kategorien?: string[] } }) => {
    modell.aufrufe++; modell.kategorien.push([...(o.ki?.kategorien ?? [])]);
    return { ok: true, status: 200, text: modell.antwort, usage: { ein: 2000, aus: 300, cacheLesen: 0, cacheSchreiben: 0 }, raw: { usage: { server_tool_use: { web_search_requests: 2 } } } };
  };
  return {
    ...echt,
    askText: vi.fn(antwort),
    askWithSearch: vi.fn(async (o: { webMaxUses?: number; ki?: { kategorien?: string[] } }) => { modell.web++; modell.suchen = o.webMaxUses; return { ...(await antwort(o)), webUsed: true }; }),
  };
});

const H = 'haus-m2';
const pz = (n: number) => `pz-00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEIL = pz(11), HAUPT = pz(12), RTEIL = pz(13), RHAUPT = pz(14), RTEIL2 = pz(15), RTEIL3 = pz(16), PLATZ = pz(17), OHNE_EIGNER = pz(18), GES = pz(19);
const uhr = (iso: string) => new Date(iso);
// 22.10.2026, 10:00 Berlin (Sommerzeit bis 25.10.) — und die Nacht zum 23.10.
const TAG = '2026-10-22T08:00:00.000Z', NACHT = '2026-10-23T00:00:00.000Z', SIEBEN = '2026-10-23T05:00:30.000Z';
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });

let S: typeof import('@/lib/prozesse/lauf-server');
let db: typeof import('@/lib/store/local-db');

const eintrag = (id: string, def: ProzessDefinition): ProzessEintrag => ({
  id, entwurf: { ...def, id }, status: 'aktiv', angelegtAm: J, angelegtVon: 'pia', entwurfAm: J, entwurfVon: 'pia',
  versionen: [{ nr: 1, name: 'v1', am: J, von: 'pia', definition: { ...def, id } }],
});
const scharf = () => ({ einstellung: { scharf: { am: J, von: 'pia', version: 1, budgetCent: 5000, schaetzungCent: 0, bestehende: 'nur-neue' as const, bestehendeAnzahl: 0 } }, verlauf: [] });
const ende = (n: number, rang: number) => schritt(n, 'Ende', rang, { form: 'ende', ende: { ergebnis: 'erfolg' } });

const RESEARCH: AgentSchritt = {
  wer: { art: 'fach', agentId: 'research' }, auftrag: 'Öffentliche Angaben zur Firma mit Quelle: Branche, Webseite; dazu den Schmerz und eine Einschätzung des Fit (0–100).',
  modell: 'schnell', budgetCent: 50, gedaechtnis: { brain: false, akte: true }, werkzeuge: [], eingabe: [], ausgabe: [{ id: 'fit', art: 'zahl' }],
  warumKeineRegel: 'Öffentliche Angaben stehen nicht im CRM — eine Regel kann sie nicht kennen.', ergebnis: 'vorschlag', vorschlagFelder: ['firma.branche', 'firma.website', 'lead.schmerz'],
};

async function laeufe(): Promise<ProzessLauf[]> { return (await S.laeufeLesen(H)).laeufe; }
async function lauf(id: string): Promise<ProzessLauf> { return (await laeufe()).find(l => l.id === id)!; }
const kinder = async (von: string) => (await laeufe()).filter(l => l.herkunft?.laufId === von);
async function stapel(): Promise<{ id: string; status: string; person?: string; anlass?: string; einmalig?: string; bezug?: { art: string; id: string }; eingabe: Record<string, unknown>; titel: string }[]> {
  return ((await db.loadJson<{ vorschlaege: never[] }>('zoe-stapel'))?.vorschlaege ?? []);
}
async function start(prozessId: string, periode: string, jetzt: string, fall: ProzessLauf['fall'] = { art: 'keiner' }): Promise<string> {
  const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
  const e = (await prozesseLesen(H)).prozesse.find(p => p.id === prozessId)!;
  const r = await S.prozessLaufStarten({
    id: (await import('@/lib/kennung')).neueKennung('pl'), prozessId, version: 1, def: e.versionen[0].definition, fall, modus: 'scharf', person: 'pia',
    ausloeser: { art: 'hand', knoten: fk(3) }, automatisch: false, periode, jetzt,
  }, H);
  if (!r.ok) throw new Error(r.grund);
  return r.lauf.id;
}
const schrittVon = (l: ProzessLauf, knoten: string) => [...l.schritte].reverse().find(s => s.knoten === knoten);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  const k = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Probe', nachname: id, email: `${id}@example.invalid`, stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-01-05', geaendertAm: '2026-01-05', ...extra });
  await db.saveJson('kontakte', { kontakte: [
    // c-a: Mail-Einwilligung mit vollem Nachweis (Kanal-Ampel grün) — sonst wäre die Nachfass-Mail „rot“ und würde übersprungen.
    k('c-a', { einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'Formular', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'pia', wortlaut: 'Ja, gern per Mail.', wortlautVersion: 'v1', belegRef: 'Gespräch vom 01.09.' }] }),
    k('c-b'), k('c-c'), k('c-x'), k('c-priv'),
    k('c-gesperrt', { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }),
    ...[1, 2, 3, 4, 5].map(n => k(`c-r${n}`, { firmaId: `f-r${n}`, firma: `Ruhig ${n} GmbH` })),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const deal = (id: string, kontakt: string, extra: Record<string, unknown> = {}) => ({ id, titel: `Probe ${id}`, kontaktIds: [kontakt], stufe: 'qualifiziert', historie: [], wert: { betrag: 1000, basis: 'einmalig' }, art: 'projekt', gesellschaft: 'ug', besitzer: 'pia', angelegt: '2026-10-01', geaendert: '2026-10-01', ...extra });
  await db.saveJson('crm', {
    ...leererBestand(),
    firmen: [1, 2, 3, 4, 5].map(n => ({ id: `f-r${n}`, name: `Ruhig ${n} GmbH`, rolle: 'interessent' })),
    chancen: [deal('ch-a', 'c-a'), deal('ch-b', 'c-b'), deal('ch-c', 'c-c'), deal('ch-x', 'c-x', { naechsterSchritt: { text: 'Anrufen', datum: '2026-11-02' } }), deal('ch-priv', 'c-priv', { gesellschaft: 'kdc' }), deal('ch-art18', 'c-gesperrt')],
  });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { schlossSetzen } = await import('@/lib/prozesse/schloss');
  const mit = { laeuftAls: 'pia', eigner: 'konto-pia' } as const;
  // Teilprozess (Deal): ein Menschen-Schritt.
  const teil = definition([schritt(10, 'Deal klären', 1), ende(11, 2)], { ...mit, fallArt: 'deal' });
  // Hauptprozess: Abfrage → Schleife (höchstens 2) → Glocke an den Eigner → Ende.
  const haupt = definition([
    schritt(20, 'Deals ohne Schritt', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'deals-ohne-schritt', hoechstens: 10 } }),
    schritt(21, 'Jeden Deal klären', 2, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(20)}`, prozessId: TEIL, hoechstens: 2 } }),
    schritt(22, 'Lage melden', 3, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text: 'Deals sind aufgegriffen.' } } }),
    ende(23, 4),
  ], { ...mit, fallArt: 'keiner' });
  // Teilprozess (Firma) mit Research — das Schloss dahinter setzt die Regel (tödliches Dreieck).
  const rteil = schlossSetzen(definition([
    schritt(30, 'Firma recherchieren', 1, { form: 'agent', katalog: { id: 'agent.research' }, agent: RESEARCH }),
    schritt(31, 'Fit stark?', 2, { form: 'entscheidung', katalog: { id: 'entscheidung.regel' }, raute: { art: 'regel', bedingungen: [{ feld: 'agent.fit', op: 'groesser', wert: 69 }] }, zweige: { nein: fk(34) } }),
    schritt(32, 'Outreach vorbereiten', 3, { katalog: { id: 'aufgabe.anlegen', werte: { titel: 'Outreach vorbereiten', wer: 'rolle:zustaendig' } } }),
    ende(33, 4), schritt(34, 'Bleibt in der Pflege', 5, { form: 'ende', ende: { ergebnis: 'erfolg' } }),
  ], { ...mit, fallArt: 'firma' })).definition;
  const rhaupt = definition([
    schritt(40, 'Ruhende Firmen', 1, { katalog: { id: 'crm.abfragen' }, abfrage: { art: 'firmen-ruhend', tage: 90, hoechstens: 10 } }),
    schritt(41, 'Jede Firma prüfen', 2, { form: 'schleife', katalog: { id: 'schleife.je-eintrag' }, schleife: { liste: `abfrage:${fk(40)}`, prozessId: RTEIL, hoechstens: 5 } }),
    ende(42, 3),
  ], { ...mit, fallArt: 'keiner' });
  const platz = schlossSetzen(definition([
    schritt(50, 'Melden', 1, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text: 'Ein Deal wird nachgefasst.' } } }),
    schritt(51, 'Nachfass-Mail', 2, { form: 'nachricht', katalog: { id: 'inbox.mail-entwurf', werte: { postfach: 'postfach.lauf', an: 'fall.kontakt', betreff: 'Kurz nachgefragt', text: 'Guten Tag {{kontakt.nachname}}, kurz nachgefragt.' } } }),
    ende(52, 3),
  ], { ...mit, fallArt: 'deal' })).definition;
  const ohneEigner = definition([schritt(60, 'Melden', 1, { form: 'nachricht', katalog: { id: 'glocke.melden', werte: { wer: 'rolle:eigner', text: 'x' } } }), ende(61, 2)], { laeuftAls: 'pia', eigner: 'konto-niemand', fallArt: 'deal' });
  const ges = definition([schritt(70, 'Angebot entwerfen', 1, { katalog: { id: 'angebot.entwurf', werte: { gesellschaft: 'fall.gesellschaft' } } }), ende(71, 2)], { ...mit, fallArt: 'deal' });
  const { prozesseBestand } = await import('@/lib/prozesse/definition');
  await db.saveJson(prozesseBestand(H), { v: 1, prozesse: [eintrag(TEIL, teil), eintrag(HAUPT, haupt), eintrag(RTEIL, rteil), eintrag(RHAUPT, rhaupt), eintrag(RTEIL2, rteil), eintrag(RTEIL3, rteil), eintrag(PLATZ, platz), eintrag(OHNE_EIGNER, ohneEigner), eintrag(GES, ges)] });
  const { laeufeBestand } = await import('@/lib/prozesse/lauf-typen');
  await db.saveJson(laeufeBestand(H), { v: 1, laeufe: [], zurueckgehalten: [], prozesse: Object.fromEntries([TEIL, HAUPT, RTEIL, RHAUPT, RTEIL2, RTEIL3, PLATZ, OHNE_EIGNER, GES].map(id => [id, scharf()])) });
  S = await import('@/lib/prozesse/lauf-server');
  S._agentKostenSetzen({ schnell: 2, ausgewogen: 3, stark: 5 });
  modell.antwort = JSON.stringify({
    ergebnis: 'Öffentliche Angaben gefunden: Maschinenbau, eigene Webseite.', werte: { fit: 80 },
    felder: { 'firma.branche': 'Maschinenbau', 'firma.website': 'https://ruhig.example.invalid', 'lead.schmerz': 'Zu viel Handarbeit im Vertrieb', 'firma.sitz': 'Köln' },
    quellen: ['https://ruhig.example.invalid/impressum'],
  });
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Schleife über eine CRM-Abfrage', () => {
  let erster = '', zweiter = '';
  it('nur Business, Art. 18 heraus: drei Deals ohne Schritt — die Schleife startet höchstens 2 Teil-Läufe, der Rest steht sichtbar am Schritt; die Glocke geht an den Eigner', async () => {
    erster = await start(HAUPT, 'p1', TAG);
    const kx = await S.kontextLaden(uhr(TAG), H);
    const l = (await S.laufVoran(erster, kx))!;
    expect(l).toMatchObject({ status: 'fertig', ergebnis: 'erfolg' });
    expect(schrittVon(l, fk(20))).toMatchObject({ status: 'erledigt', anzahl: 3 });
    expect(schrittVon(l, fk(21))).toMatchObject({ status: 'erledigt', anzahl: 2, rest: 1, grund: 'schleife-rest' });
    expect(l.daten).toMatchObject({ 'abfrage.anzahl': '3', 'schleife.gestartet': '2', 'schleife.rest': '1' });
    // Die Liste lebt nur, solange der Lauf offen ist.
    expect(l.listen).toBeUndefined();
    const k = await kinder(erster);
    expect(k.map(x => x.fall.id).sort()).toEqual(['ch-a', 'ch-b']);
    expect(k.every(x => x.prozessId === TEIL && x.tiefe === 1 && x.person === 'pia' && x.modus === 'scharf')).toBe(true);
    expect(schrittVon(l, fk(21))!.wirkung!.map(w => w.id).sort()).toEqual(k.map(x => x.id).sort());
    // Nie ein privater Deal, nie einer mit eingeschränkter Person; nie ein Deal mit nächstem Schritt.
    expect(JSON.stringify(await laeufe())).not.toMatch(/ch-priv|ch-art18|ch-x/);
    const m = await db.loadJson<{ eintraege: { titel: string }[] }>('meldungen--pia');
    expect(m?.eintraege.some(x => x.titel === 'Deals sind aufgegriffen.')).toBe(true);
    // Die Teil-Läufe bringt der Motor voran: je Deal eine Aufgabe.
    for (const x of k) await S.laufVoran(x.id, kx);
    expect((await kinder(erster)).every(x => x.status === 'wartet' && x.wartet?.art === 'aufgabe')).toBe(true);
  });
  it('der nächste Lauf nimmt den Rest: die schon versorgten Deals sind nicht mehr in der Liste', async () => {
    zweiter = await start(HAUPT, 'p2', TAG);
    const l = (await S.laufVoran(zweiter, await S.kontextLaden(uhr(TAG), H)))!;
    expect(schrittVon(l, fk(20))).toMatchObject({ anzahl: 1, uebersprungen: 2 });
    expect(schrittVon(l, fk(21))).toMatchObject({ anzahl: 1 });
    expect(schrittVon(l, fk(21))!.rest).toBeUndefined();
    expect((await kinder(zweiter)).map(x => x.fall.id)).toEqual(['ch-c']);
    // Ein dritter Lauf findet nichts mehr.
    const dritter = await start(HAUPT, 'p3', TAG);
    const d = (await S.laufVoran(dritter, await S.kontextLaden(uhr(TAG), H)))!;
    expect(schrittVon(d, fk(20))).toMatchObject({ anzahl: 0, uebersprungen: 3 });
    expect(await kinder(dritter)).toEqual([]);
  });
  it('Abbruch mitten in der Schleife (Teil-Läufe gestartet, Ergebnis nicht festgehalten): das Wiederholen startet nichts doppelt und findet die Teil-Läufe wieder', async () => {
    const vorher = (await laeufe()).filter(x => x.prozessId === TEIL).length;
    const alt = await lauf(zweiter);
    const bis = alt.schritte.findIndex(s => s.knoten === fk(21));
    await S.laeufeAendern(d => ({ datei: { ...d, laeufe: d.laeufe.map(x => {
      if (x.id !== zweiter) return x;
      const n: ProzessLauf = { ...x, status: 'laeuft', aktuell: fk(21), schritte: [...x.schritte.slice(0, bis), { knoten: fk(21), status: 'laeuft', ab: TAG }], listen: { [fk(20)]: { faelle: [{ art: 'deal', id: 'ch-c' }], gesamt: 1, am: TAG } }, geaendert: TAG };
      delete n.ende; delete n.ergebnis;
      return n;
    }) }, r: null }), H);
    const l = (await S.laufVoran(zweiter, await S.kontextLaden(uhr(TAG), H)))!;
    expect(l.status).toBe('fertig');
    expect((await laeufe()).filter(x => x.prozessId === TEIL).length).toBe(vorher);
    expect(schrittVon(l, fk(21))).toMatchObject({ anzahl: 1 });
    expect(schrittVon(l, fk(21))!.wirkung!.map(w => w.id)).toEqual((await kinder(zweiter)).map(x => x.id));
  });
});

describe('Nachtlauf, Research mit Feldern, Frische', () => {
  let haupt = '';
  it('02:00: Abfrage und Schleife laufen sofort — die Agenten-Schritte der Teil-Läufe warten bis 07:00 (kein Modellaufruf in der Nacht)', async () => {
    haupt = await start(RHAUPT, 'nacht-1', NACHT);
    const kx = await S.kontextLaden(uhr(NACHT), H);
    const l = (await S.laufVoran(haupt, kx))!;
    expect(l.status).toBe('fertig');
    expect(schrittVon(l, fk(40))).toMatchObject({ anzahl: 5 });
    const k = await kinder(haupt);
    expect(k).toHaveLength(5);
    for (const x of k) await S.laufVoran(x.id, kx);
    const w = await kinder(haupt);
    expect(w.every(x => x.status === 'wartet' && x.wartet?.art === 'fenster' && x.wartet.bis === '2026-10-23T05:00:00.000Z')).toBe(true);
    expect(w.every(x => schrittVon(x, fk(30))?.grund === 'fenster')).toBe(true);
    expect(modell.aufrufe).toBe(0);
  });
  it('07:00: der Takt weckt — höchstens 4 Agenten-Schritte je Takt, der fünfte wartet gedrosselt; Ergebnis nur als CRM-Vorschlag mit Feldern, die Karte bleibt unverändert', async () => {
    await S.prozesseImTakt(uhr(SIEBEN));
    expect(modell.web).toBe(4);
    expect(modell.suchen).toBe(3);
    expect(modell.kategorien.every(k => k.includes('crm') && k.includes('web'))).toBe(true);
    const k = await kinder(haupt);
    const gedrosselt = k.filter(x => schrittVon(x, fk(30))?.grund === 'gedrosselt');
    expect(gedrosselt).toHaveLength(1);
    expect(gedrosselt[0]).toMatchObject({ status: 'wartet', wartet: { art: 'fenster' } });
    const fertig = k.filter(x => schrittVon(x, fk(30))?.status === 'erledigt');
    expect(fertig).toHaveLength(4);
    for (const x of fertig) {
      // Vertrag an die Raute, fremd gelesen, Recherche-Stempel, Kosten (Tokens + 2 Suchen) ins Budget.
      expect(x).toMatchObject({ fremd: true, daten: { 'agent.fit': '80', 'agent.felder': '3' } });
      expect(schrittVon(x, fk(30))).toMatchObject({ recherche: true });
      expect(x.kostenCent).toBeGreaterThanOrEqual(2);
      // Dahinter das Schloss (tödliches Dreieck) — der Lauf wartet auf die Freigabe.
      expect(x.status).toBe('wartet');
      expect(x.wartet?.art).toBe('freigabe');
    }
    const st = await stapel();
    const f1 = fertig[0].fall.id!;
    const firma = st.find(v => v.bezug?.art === 'crm' && v.eingabe.art === 'firma_felder' && v.eingabe.firmaId === f1)!;
    expect(firma.eingabe).toMatchObject({ felder: { branche: 'Maschinenbau', webseite: 'https://ruhig.example.invalid' }, _uebernahme: 'je-feld', quelle: 'https://ruhig.example.invalid/impressum' });
    // Nur die Zielfelder des Schritts — „Sitz“ stand nicht im Auftrag und fällt weg.
    expect(JSON.stringify(firma.eingabe)).not.toContain('Köln');
    expect(firma.person).toBe('pia');
    const quali = st.find(v => v.bezug?.art === 'crm' && v.eingabe.art === 'qualifizierung' && v.eingabe.leadId === f1)!;
    expect((quali.eingabe.felder as { antworten: Record<string, string> }).antworten).toEqual({ schmerz: 'Zu viel Handarbeit im Vertrieb' });
    // Nie direkt in die Karte: die Firma ist unverändert.
    const crm = await db.loadJson<{ firmen: { id: string; branche?: string; webseite?: string }[] }>('crm');
    expect(crm!.firmen.find(f => f.id === f1)).not.toHaveProperty('branche');
    // Der Lauf trägt keine Texte aus dem Web.
    expect(JSON.stringify(fertig[0])).not.toMatch(/Maschinenbau|Handarbeit|example\.invalid/);
  });
  it('Häkchen je Feld: freigegeben wird nur das angehakte Feld — erst dann steht es in der Karte', async () => {
    const f1 = (await kinder(haupt)).find(x => schrittVon(x, fk(30))?.status === 'erledigt')!.fall.id!;
    const v = (await stapel()).find(x => x.bezug?.art === 'crm' && x.eingabe.art === 'firma_felder' && x.eingabe.firmaId === f1)!;
    const { POST } = await import('@/app/api/zoe/stapel/route');
    const nichts = await POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ id: v.id, entscheidung: 'freigeben', eingabe: { _felder: [] } }) }));
    expect(nichts.status).toBe(400);
    const r = await POST(new Request('http://test/api/zoe/stapel', { method: 'POST', headers: sitzung('pia'), body: JSON.stringify({ id: v.id, entscheidung: 'freigeben', eingabe: { _felder: ['branche'] } }) }));
    expect(r.status).toBe(200);
    const crm = await db.loadJson<{ firmen: { id: string; branche?: string; webseite?: string }[] }>('crm');
    const f = crm!.firmen.find(x => x.id === f1)!;
    expect(f.branche).toBe('Maschinenbau');
    expect(f.webseite).toBeUndefined();
  });
  it('Recherche-Frische: dieselbe Firma in einem ANDEREN Prozess wird binnen 90 Tagen nicht noch einmal recherchiert (übersprungen, kein Modellaufruf) — nach 91 Tagen wieder', async () => {
    const f1 = (await kinder(haupt)).find(x => schrittVon(x, fk(30))?.status === 'erledigt')!.fall.id!;
    const vorher = modell.aufrufe;
    const zweit = await start(RTEIL2, 'frisch', '2026-10-23T09:00:00.000Z', { art: 'firma', id: f1 });
    const l = (await S.laufVoran(zweit, await S.kontextLaden(uhr('2026-10-23T09:00:00.000Z'), H)))!;
    expect(schrittVon(l, fk(30))).toMatchObject({ status: 'uebersprungen', grund: 'recherche-frisch' });
    expect(modell.aufrufe).toBe(vorher);
    // Ohne Fit aus der Recherche geht die Raute in den harmlosen Ast.
    expect(l).toMatchObject({ status: 'fertig' });
    expect(l.schritte.map(s => s.knoten)).toContain(fk(34));
    const spaeter = '2027-01-23T09:00:00.000Z';
    const dritt = await start(RTEIL3, 'spaeter', spaeter, { art: 'firma', id: f1 });
    const d = (await S.laufVoran(dritt, await S.kontextLaden(uhr(spaeter), H)))!;
    expect(schrittVon(d, fk(30))).toMatchObject({ status: 'erledigt', recherche: true });
    expect(modell.aufrufe).toBe(vorher + 1);
  });
});

describe('Platzhalter: Rolle, Postfach, Gesellschaft', () => {
  it('Eigner-Rolle → Glocke an den Eigner; Postfach des Laufs ohne Business-Postfach → Halt mit Grund an der Mail; mit Postfach → im Sende-Auftrag der Freigabe', async () => {
    const id = await start(PLATZ, 'platz', TAG, { art: 'deal', id: 'ch-a' });
    const l = (await S.laufVoran(id, await S.kontextLaden(uhr(TAG), H)))!;
    expect(schrittVon(l, fk(50))).toMatchObject({ status: 'erledigt' });
    expect(l).toMatchObject({ status: 'fehler', grund: 'kein-postfach', aktuell: fk(51) });
    const m = await db.loadJson<{ eintraege: { titel: string }[] }>('meldungen--pia');
    expect(m?.eintraege.some(x => x.titel === 'Ein Deal wird nachgefasst.')).toBe(true);
    // Ein IMAP-Postfach mit Business-Bereich — dann „erneut ab hier“.
    await db.saveJson('postfaecher--pia', { v: 1, postfaecher: [{ id: 'pf-00000000-0000-4000-8000-000000000001', quelle: 'imap', bereich: 'ug', anzeigename: 'MAKE', adresse: 'pia@example.invalid' }] });
    const r = await S.laufErneut(id);
    expect(r.ok).toBe(true);
    const n = await lauf(id);
    expect(n).toMatchObject({ status: 'wartet', wartet: { art: 'freigabe' } });
    const v = (await stapel()).find(x => x.einmalig === n.wartet!.wirkung || x.bezug?.id === n.wartet!.wirkung)!;
    expect(v.eingabe._sende).toMatchObject({ kanal: 'mail', postfach: 'pf-00000000-0000-4000-8000-000000000001', an: { kontaktId: 'c-a' } });
  });
  it('Eigner ohne Konto → Halt „Rolle fehlt“ (nie Rückfall auf den Inhaber); Gesellschaft des Falls privat → Halt „Gesellschaft fehlt“', async () => {
    const id = await start(OHNE_EIGNER, 'ohne', TAG, { art: 'deal', id: 'ch-b' });
    expect(await S.laufVoran(id, await S.kontextLaden(uhr(TAG), H))).toMatchObject({ status: 'fehler', grund: 'rolle-fehlt' });
    const g = await start(GES, 'ges', TAG, { art: 'deal', id: 'ch-priv' });
    expect(await S.laufVoran(g, await S.kontextLaden(uhr(TAG), H))).toMatchObject({ status: 'fehler', grund: 'gesellschaft-fehlt' });
  });
});

describe('V01 · Nächtlicher Prospecting-Lauf im Probelauf (Beispiel-Fall)', () => {
  it('Hauptprozess und Teilprozess laufen ganz durch — ohne Halt, ohne Wirkung', async () => {
    const [{ ausVorlageAnwenden }, { prozessRechte }, { prozesseAendern }] = await Promise.all([
      import('@/lib/prozesse/kundengewinnung/uebernehmen'), import('@/lib/prozesse/rollen'), import('@/lib/prozesse/werkstatt-server'),
    ]);
    let n = 100;
    const neu = (p: 'pz' | 'fk') => `${p}-00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    let ids: string[] = [];
    await prozesseAendern<object>(d => {
      const r = ausVorlageAnwenden(d, 'kg-v01', { person: 'pia', jetzt: TAG, rechte: prozessRechte({ imHaushalt: true, vollesMitglied: true, inhaber: true, nurBusiness: false }), neueKennung: neu, eigner: 'konto-pia' });
      if (!r.ok) throw new Error('Übernahme gescheitert');
      ids = r.datei.prozesse.filter(p => !d.prozesse.some(x => x.id === p.id)).map(p => p.id);
      return { ok: true, datei: r.datei };
    }, { art: 'person', person: 'pia' }, H);
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const alle = (await prozesseLesen(H)).prozesse.filter(p => ids.includes(p.id));
    const haupt = alle.find(p => p.entwurf.herkunft?.quelleIds?.includes('kg-v01'))!;
    const teil = alle.find(p => p.entwurf.herkunft?.quelleIds?.includes('kg-v01a'))!;
    const vorher = JSON.stringify(await laeufe());
    for (const p of [haupt, teil]) {
      const r = await S.probelauf({ prozessId: p.id, quelle: 'version', fall: 'beispiel', person: 'pia' });
      expect(r.ok, p.entwurf.titel).toBe(true);
      if (!r.ok) continue;
      expect(r.schritte.filter(z => z.status === 'fehler'), JSON.stringify(r.schritte)).toEqual([]);
      expect(r.schritte.at(-1)!.text).toMatch(/^endet|würde/);
    }
    const h = await S.probelauf({ prozessId: haupt.id, quelle: 'version', fall: 'beispiel', person: 'pia' });
    if (h.ok) {
      expect(h.schritte.filter(z => /würde im CRM abfragen/.test(z.text))).toHaveLength(2);
      expect(h.schritte.filter(z => /würde je Fall einen Teil-Lauf starten/.test(z.text))).toHaveLength(2);
    }
    // Der Probelauf schreibt nichts.
    expect(JSON.stringify(await laeufe())).toBe(vorher);
  });
});
