// ─── Prozesse · Überführung (22.10., Paket Ü) — von Ende zu Ende: Schatten, Umschalten, Gold, hin und zurück, Weiche nicht lesbar ──────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), Rechnungen, Mandate und Produkte — kein Netz, kein Modell. Geprüft je überführtem Teil:
//   · Schatten: der alte Weg arbeitet weiter (schreibt wie vorher), der neue rechnet im Motor mit und schreibt NICHTS; beide melden ihr Wirkungsbild — nach N gleichen
//     Läufen und M Tagen geht „Umschalten“ (vorher 409 mit Grund), umgeschaltet wird nur per Aufruf einer Person
//   · GOLD: derselbe erfundene Bestand → alter Code allein vs. neuer Prozess (scharf, der alte Weg nur noch mit seinem Rest) → dieselben Schreibungen.
//     Ausgenommen (ausdrücklich): die Reihenfolge der Einträge (Aufgaben-Liste, Stapel, Glocke — der neue Weg schreibt nach dem Morgen-Loop), die zufälligen
//     Kennungen der Stapel-Vorschläge und der Glocke (`id`), das Änderungsprotokoll, Ereignisse und der Lauf-Bestand des Motors (Herkunft, Läufe).
//   · hin und zurück umschalten (anhalten, wieder aktiv, zurück in den Schatten): nichts doppelt (Kennungs-Brücke), nichts verloren (jede fällige Stufe hat ihre Aufgabe)
//   · Weiche nicht lesbar (Werkstatt-Bestand gesperrt) → der alte Weg arbeitet, der neue nicht — nie keiner, nie beide
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
// 25.10. (Fulfillment für die Selbstständigkeit): dieser Test prüft die Grenze „Privat bekommt kein Fulfillment“ wie bisher — mit einer Privat-Einheit OHNE
// Arbeit (Instanz `{"kdc":{"arbeit":false}}`). Die Selbstständigkeit als Arbeit (Vorgabe) prüft tests/fulfillment-selbst.test.ts.
vi.hoisted(() => { process.env.NEXT_PUBLIC_MAKE_OS_EINHEITEN = JSON.stringify({ kdc: { arbeit: false } }); });
import { mkdtempSync, rmSync, chmodSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessEintrag } from '@/lib/prozesse/definition';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ueberfuehrung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ueberfuehrung';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM = JSON.stringify([{ id: 'pia', name: 'Pia', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'olaf', name: 'Olaf', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-ue';
const RECHTE = { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true };
const WER = { art: 'person' as const, person: 'pia' };
const T0 = '2026-11-02'; // Montag
const tag = (n: number) => { const d = new Date(`${T0}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Berliner Vormittag des Tages n (der Morgenlauf). */
const morgen = (n: number) => vi.setSystemTime(new Date(`${tag(n)}T08:30:00Z`));

let db: typeof import('@/lib/store/local-db');
let L: typeof import('@/lib/prozesse/lauf-server');
let UE: typeof import('@/lib/prozesse/ueberfuehrung-server');
let W: typeof import('@/lib/prozesse/werkstatt-server');

interface Aufgabe { id: string; title: string; [k: string]: unknown }
const aufgaben = async (): Promise<Aufgabe[]> => ((await db.loadJson<{ tasks: Aufgabe[] }>('tasks'))?.tasks ?? []);
const mahnIds = async () => (await aufgaben()).filter(t => t.id.startsWith('mahn-')).map(t => t.id).sort();
const nachId = <T extends { id: string }>(l: readonly T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));

/** Bestände sichern und zurückspielen (fehlte er, wird er wieder entfernt — über local-db, nie an der Datei vorbei). */
async function sichern(namen: readonly string[]): Promise<Record<string, unknown>> {
  return Object.fromEntries(await Promise.all(namen.map(async n => [n, await db.loadJson<unknown>(n)] as const)));
}
async function zurueck(s: Record<string, unknown>): Promise<void> {
  for (const [n, v] of Object.entries(s)) { if (v === null) await db.bestandEntfernen(n); else await db.saveJson(n, v); }
}
const prozess = async (id: string): Promise<ProzessEintrag> => (await W.prozesseLesen(H)).prozesse.find(p => p.id === id)!;
/** Ein Morgen: der alte Einstiegspunkt (wie im Tagesstart) und danach die Prozesse „nach dem Morgen-Loop“. */
async function mahnMorgen(n: number): Promise<void> {
  morgen(n);
  await (await import('@/lib/finanzen/rechnung/server')).mahnAufgabenNachziehen();
  await L.prozesseNachLoop('morgen');
}
async function treppeMorgen(n: number): Promise<void> {
  morgen(n);
  await (await import('@/lib/crm/treppe-server')).treppeMorgenlauf();
  await L.prozesseNachLoop('morgen');
}

/** Rechnungen (erfunden): zwei der Business-Gesellschaften, eine der Selbstständigkeit (Privat), eine bezahlt. Fällig vor 10 bzw. 16 Tagen. */
const rechnung = (id: string, firmaId: string, faellig: string, status = 'gestellt') => ({ id, firmaId, kunde: 'Beispiel GmbH', titel: `Leistung ${id}`, betrag: 1190, status, faellig, nummer: `R-${id}`, datum: faellig });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  morgen(-1);
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H }), konto('k3', 'bea', 'mitglied', { haushalt: H, finanzRecht: 'business' }), konto('k4', 'gast', 'mitglied', { haushalt: 'haus-fremd' })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-erika', vorname: 'Erika', nachname: 'Beispiel', email: 'erika@example.invalid', stufe: 'kontakt', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  await db.saveJson('finanzplan', { firmen: [], zahlungen: [], merkposten: [], rechnungen: [
    rechnung('r-ug', 'ug', tag(-10)), rechnung('r-kdv', 'kdv', tag(-16)), rechnung('r-kdc', 'kdc', tag(-12)), rechnung('r-bezahlt', 'ug', tag(-30), 'bezahlt'),
  ] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const mandat = (id: string, gesellschaft: string, leistungId: string, zustaendig?: string) => ({
    id, kunde: `Kunde ${id}`, firmaId: 'f-probe', kontaktIds: ['c-erika'], titel: `Mandat ${id}`, art: 'retainer', leistungId, gesellschaft, status: 'aktiv', vertragUnterschrieben: true,
    start: tag(-30), verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
    health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: '2026-09-01T00:00:00.000Z', ...(zustaendig ? { zustaendig } : {}),
  });
  const leistung = (id: string) => ({ id, name: `Produkt ${id}`, typ: 'retainer', stufe: 'kern', preis: { betrag: 100, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'ug', status: 'aktiv', geaendert: '2026-09-01T00:00:00.000Z' });
  await db.saveJson('crm', { ...leererBestand(), firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: '2026-09-01T00:00:00.000Z' }], leistungen: [leistung('l-a'), leistung('l-b')],
    mandate: [mandat('m-a', 'ug', 'l-a', 'pia'), mandat('m-b', 'kdv', 'l-b'), mandat('m-privat', 'kdc', 'l-b')] });
  // Die Treppe: zwei Stufen; m-a hat alles geliefert → „nächste Stufe“ (bleibt im Code), beide Business-Mandate sind für den Report dran.
  const { treppeSchreiben } = await import('@/lib/crm/treppe-server');
  const t = await treppeSchreiben([
    { op: 'stufe', eintrag: { id: 'ts-ue-eins', name: 'Einstieg', ebene: 1, preis: { art: 'fest', betrag: 500 }, leistungIds: ['l-a'], lieferobjekte: ['Befund'] } },
    { op: 'stufe', eintrag: { id: 'ts-ue-zwei', name: 'Begleitung', ebene: 2, preis: { art: 'monat', betrag: 900 } } },
  ], 'pia');
  expect(t.ok, JSON.stringify(t)).toBe(true);
  expect((await treppeSchreiben([{ op: 'lieferobjekt', mandatId: 'm-a', was: 'Befund', erledigt: true }], 'pia')).ok).toBe(true);
  // Fulfillment (Onboarding-Vorschlag): eingerichtet vor 40 Tagen, ein Paket am Produkt l-a — beide Business-Mandate sind neue Kunden ohne Fall.
  await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [{
    id: 'fp-paket', art: 'paket', titel: 'Paket liefern', fassung: 1, geaendert: '2026-09-01T00:00:00.000Z', geaendertVon: 'pia', uebergaenge: [], freigaben: [], rollen: [],
    knoten: [{ id: 'fk-w', titel: 'Paket liefern', rang: 0 }, { id: 'fk-p', elternId: 'fk-w', titel: 'Start', rang: 0 }, { id: 'fk-s', elternId: 'fk-p', titel: 'Kick-off', rang: 0, form: 'termin' }],
  }], bausteine: [], rituale: [], zuordnung: { 'l-a': { vorlageId: 'fp-paket' } }, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: { 'fulfillment-eingerichtet': tag(-40) } });
  await db.saveJson(`fulfillment-faelle--${H}`, { version: 1, faelle: {} });
  L = await import('@/lib/prozesse/lauf-server');
  UE = await import('@/lib/prozesse/ueberfuehrung-server');
  W = await import('@/lib/prozesse/werkstatt-server');
  await L.prozesseImTakt();
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

// ══ Mahnaufgaben (sp-rechnung) ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Mahnaufgaben: Schatten → Umschalten → Gold → hin und zurück', () => {
  let goldAlt: Aufgabe[] = [];
  let start: Record<string, unknown> = {};
  let pz = '';
  it('ohne Überführung: der Morgenlauf legt alle fälligen Stufen an (Business und Privat) — wie vorher', async () => {
    start = await sichern(['tasks']);
    morgen(0);
    expect((await (await import('@/lib/finanzen/rechnung/server')).mahnAufgabenNachziehen()).neu).toBe(3);
    goldAlt = (await aufgaben()).filter(t => t.id.startsWith('mahn-'));
    expect(goldAlt.map(t => t.id).sort()).toEqual(['mahn-r-kdc-1', 'mahn-r-kdv-1', 'mahn-r-ug-1']);
    await zurueck(start);
  });
  it('überführen: neuer Prozess im Probelauf, Phase Schatten — ein zweites Mal 409; ohne volle Rechte 403', async () => {
    morgen(1);
    expect((await UE.ueberfuehren({ sp: 'sp-rechnung', person: 'olaf', rechte: { ...RECHTE, status: false }, h: H, wer: WER })).status).toBe(403);
    const r = await UE.ueberfuehren({ sp: 'sp-rechnung', person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    const e = await prozess(pz);
    expect(e).toMatchObject({ status: 'probelauf', ersetzt: 'sp-rechnung', ueberfuehrung: { phase: 'schatten' } });
    expect(e.entwurf.eigner).toBe('konto-pia');
    expect((await UE.ueberfuehren({ sp: 'sp-rechnung', person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(409);
    expect(await UE.wegFuer('sp-rechnung')).toMatchObject({ weg: 'alt', schatten: true, prozessId: pz });
  });
  it('Schatten: der alte Weg schreibt wie vorher, der neue schreibt nichts — und beide melden dasselbe Bild', async () => {
    await mahnMorgen(1);
    expect(await mahnIds()).toEqual(goldAlt.map(t => t.id).sort());
    const laeufe = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]).toMatchObject({ modus: 'schatten', status: 'fertig' });
    expect(laeufe[0].schritte.some(s => s.status === 'wuerde')).toBe(true);
    const v = (await prozess(pz)).ueberfuehrung!.vergleich;
    expect(v.offen?.tag).toBe(tag(1));
    expect(v.offen?.alt).toEqual(v.offen?.neu);
    expect(v.offen?.alt).toHaveLength(2); // nur Business
    // Umschalten geht noch nicht (409 mit Grund).
    const u = await UE.umschalten({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(u.status).toBe(409);
    expect(String(u.body.fehler)).toMatch(/Erst im Schatten vergleichen/);
  });
  it('nach fünf gleichen Läufen über drei Tage geht „Umschalten“ — nur volle Mitglieder; danach arbeitet der neue Weg', async () => {
    for (let n = 2; n <= 6; n++) await mahnMorgen(n);
    const e = await prozess(pz);
    const a = await UE.ueberfuehrungAnsicht(e, H);
    expect(a).toMatchObject({ phase: 'schatten', arbeitet: 'alt', vergleich: { laeufe: 5, gleich: 5, abweichend: 0, gleichLaeufe: 5 }, umschalten: { erlaubt: true } });
    expect((await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'olaf', rechte: { ...RECHTE, status: false }, h: H, wer: WER })).status).toBe(403);
    expect((await UE.umschalten({ prozessId: pz, stand: 'veraltet', person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(409);
    const u = await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(await prozess(pz)).toMatchObject({ status: 'aktiv', ueberfuehrung: { phase: 'scharf', umgeschaltetVon: 'pia' } });
    expect(await UE.wegFuer('sp-rechnung')).toMatchObject({ weg: 'neu', schatten: false });
  });
  it('GOLD: derselbe Bestand — alter Code allein vs. neuer Prozess scharf (alter Weg nur Privat) → dieselben Aufgaben', async () => {
    const nachUmschalten = await sichern(['tasks']);
    await zurueck(start);
    await mahnMorgen(0);
    const neu = (await aufgaben()).filter(t => t.id.startsWith('mahn-'));
    // Wer was schrieb: Privat der alte Weg (Morgenlauf), Business der feste Schritt im scharfen Lauf.
    const lauf = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.modus === 'scharf');
    expect(lauf).toHaveLength(1);
    expect(lauf[0].schritte.flatMap(s => s.wirkung ?? []).map(w => w.id).sort()).toEqual(['mahn-r-kdv-1', 'mahn-r-ug-1']);
    expect(nachId(neu)).toEqual(nachId(goldAlt));
    await zurueck(nachUmschalten);
  });
  it('hin und zurück: anhalten → der alte Weg; wieder aktiv → der neue; zurück in den Schatten → der alte — nichts doppelt, nichts verloren', async () => {
    const statusSetzen = async (status: 'pausiert' | 'aktiv') => {
      const { werkstattAnwenden } = await import('@/lib/prozesse/bestand');
      const { neueKennung } = await import('@/lib/kennung');
      const e = await prozess(pz);
      const r = await W.prozesseAendern<object>(d => werkstattAnwenden(d, { aktion: 'status', id: pz, stand: W.standVon(e), status }, { person: 'pia', jetzt: new Date().toISOString(), rechte: RECHTE, standVon: W.standVon, neueKennung: p => neueKennung(p) }) as never, WER, H);
      expect(r.ok, JSON.stringify(r)).toBe(true);
    };
    // Eine neue Rechnung wird fällig (Tag 7): der neue Weg legt sie an.
    await db.updateJson<{ rechnungen: unknown[] }>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, rechnung('r-neu', 'ug', tag(0))] }));
    await mahnMorgen(7);
    expect(await mahnIds()).toContain('mahn-r-neu-1');
    await statusSetzen('pausiert');
    expect((await UE.wegFuer('sp-rechnung')).weg).toBe('alt');
    // Tag 8: der alte Weg erkennt die Aufgaben des neuen (dieselben Kennungen) — und legt die nächste Stufe an.
    await mahnMorgen(8);
    let ids = await mahnIds();
    expect(new Set(ids).size).toBe(ids.length);
    await statusSetzen('aktiv');
    expect((await UE.wegFuer('sp-rechnung')).weg).toBe('neu');
    await mahnMorgen(9);
    expect(await UE.zurueckInDenSchattenServer({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER })).toMatchObject({ status: 200 });
    expect(await UE.wegFuer('sp-rechnung')).toMatchObject({ weg: 'alt', schatten: true });
    await mahnMorgen(10);
    ids = await mahnIds();
    expect(new Set(ids).size, 'nichts doppelt').toBe(ids.length);
    // Nichts verloren: jede heute fällige Stufe (alle Gesellschaften) hat ihre Aufgabe.
    const { mahnAufgabenKern } = await import('@/lib/finanzen/rechnung/server');
    const soll = (await mahnAufgabenKern(tag(10), { bereich: 'alle', schreiben: false })).soll.map(s => s.id);
    for (const id of soll) expect(ids, id).toContain(id);
    // Im Schatten zählt der Vergleich neu (die Summen bleiben).
    expect((await prozess(pz)).ueberfuehrung!.vergleich).toMatchObject({ gleichLaeufe: 0 });
  });
  it('Weiche nicht lesbar (Werkstatt-Bestand gesperrt) → der alte Weg arbeitet allein, auch für Business', async () => {
    // Wieder scharf (nach fünf gleichen Läufen) — dann den Bestand unlesbar machen.
    for (let n = 11; n <= 16; n++) await mahnMorgen(n);
    const e = await prozess(pz);
    expect((await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(200);
    await db.updateJson<{ rechnungen: unknown[] }>('finanzplan', f => ({ ...f!, rechnungen: [...f!.rechnungen, rechnung('r-spaet', 'kdv', tag(9))] }));
    const datei = path.join(ordner, `prozesse--${H}.json`);
    chmodSync(datei, 0o000);
    utimesSync(datei, new Date(), new Date(Date.now() + 5000));
    try {
      expect(await UE.wegFuer('sp-rechnung')).toEqual({ weg: 'alt', schatten: false });
      await mahnMorgen(17);
      expect(await mahnIds(), 'der alte Weg legte die Business-Rechnung an').toContain('mahn-r-spaet-1');
      // Der Motor startete nichts (er kann den Bestand nicht lesen) — keine zweite Wirkung.
      expect((await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.start.startsWith(tag(17)))).toEqual([]);
    } finally { chmodSync(datei, 0o600); utimesSync(datei, new Date(), new Date(Date.now() + 10000)); }
    const ids = await mahnIds();
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ══ Fortschritts-Report (sp-treppe) ══════════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('Fortschritts-Report: Schatten → Umschalten → Gold', () => {
  const BESTAENDE = ['zoe-stapel', 'meldungen--pia', 'meldungen--olaf', `produkt-treppe--${H}`];
  interface V { id: string; werkzeug: string; titel: string; eingabe: Record<string, unknown>; person?: string; bezug?: unknown; zeit: string; tag: string; [k: string]: unknown }
  const vorschlaege = async (): Promise<V[]> => ((await db.loadJson<{ vorschlaege: V[] }>('zoe-stapel'))?.vorschlaege ?? []).filter(v => v.werkzeug === 'fortschritt_report' || v.werkzeug === 'naechste_stufe');
  const ohneId = <T extends { id?: unknown }>(l: readonly T[]) => l.map(({ id: _i, ...r }) => r).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const glocken = async () => ({
    pia: ohneId((await db.loadJson<{ eintraege: { id: string }[] }>('meldungen--pia'))?.eintraege ?? []),
    olaf: ohneId((await db.loadJson<{ eintraege: { id: string }[] }>('meldungen--olaf'))?.eintraege ?? []),
  });
  const marken = async () => ((await db.loadJson<{ marken?: Record<string, string> }>(`produkt-treppe--${H}`))?.marken ?? {});
  let start: Record<string, unknown> = {};
  let gold: { v: unknown; g: unknown; m: unknown } = { v: null, g: null, m: null };
  let pz = '';
  it('ohne Überführung: Report-Vorschläge für beide Business-Mandate (nie Privat) + „nächste Stufe“ — wie vorher', async () => {
    start = await sichern(BESTAENDE);
    morgen(19);
    const { treppeMorgenlauf } = await import('@/lib/crm/treppe-server');
    expect(await treppeMorgenlauf()).toEqual({ reports: 2, stufen: 1 });
    const v = await vorschlaege();
    expect(v.filter(x => x.werkzeug === 'fortschritt_report').map(x => x.eingabe.mandatId).sort()).toEqual(['m-a', 'm-b']);
    gold = { v: ohneId(v), g: await glocken(), m: await marken() };
    await zurueck(start);
  });
  it('überführen → Schatten: der alte Weg schlägt vor, der neue schreibt nichts; dasselbe Bild — die Marke von heute bremst den Vergleich nicht', async () => {
    morgen(20);
    const r = await UE.ueberfuehren({ sp: 'sp-treppe', person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    await treppeMorgen(20);
    expect((await vorschlaege()).filter(x => x.werkzeug === 'fortschritt_report')).toHaveLength(2);
    const v = (await prozess(pz)).ueberfuehrung!.vergleich;
    expect(v.offen?.alt).toHaveLength(2);
    expect(v.offen?.neu).toEqual(v.offen?.alt);
    for (let n = 21; n <= 26; n++) await treppeMorgen(n);
    expect((await vorschlaege()).filter(x => x.werkzeug === 'fortschritt_report'), 'gebremst — kein zweiter Vorschlag').toHaveLength(2);
    const a = await UE.ueberfuehrungAnsicht(await prozess(pz), H);
    expect(a).toMatchObject({ vergleich: { gleich: 6, abweichend: 0 }, umschalten: { erlaubt: true } });
    expect((await UE.umschalten({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(200);
  });
  it('GOLD: derselbe Bestand — alter Code allein vs. neuer Prozess scharf (der alte Weg nur noch „nächste Stufe“) → dieselben Vorschläge, Glocken, Marken', async () => {
    // Ein Tag ohne Schatten-Lauf (am Tag des Umschaltens hat der alte Weg morgens schon gearbeitet — der Lauf dieses Tages ist der des Schattens).
    await zurueck(start);
    await treppeMorgen(19);
    expect({ v: ohneId(await vorschlaege()), g: await glocken(), m: await marken() }).toEqual(gold);
    const lauf = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.modus === 'scharf');
    expect(lauf).toHaveLength(1);
    expect(lauf[0].schritte.flatMap(s => s.wirkung ?? []).filter(w => w.art === 'vorschlag')).toHaveLength(2);
    // Ein zweiter Morgen am selben Tag legt nichts doppelt (Marke = Kennungs-Brücke), auch nicht der alte Weg nach dem Anhalten.
    await treppeMorgen(19);
    expect((await vorschlaege()).filter(x => x.werkzeug === 'fortschritt_report')).toHaveLength(2);
  });
});

// ══ Onboarding-Vorschlag „Fall starten“ (sp-uebergabe) ═══════════════════════════════════════════════════════════════════════════════════════════

describe('Onboarding-Vorschlag: Schatten → Umschalten → Gold', () => {
  const BESTAENDE = ['zoe-stapel', 'meldungen--pia', 'meldungen--olaf', `fulfillment--${H}`];
  interface V { id: string; werkzeug: string; eingabe: Record<string, unknown>; [k: string]: unknown }
  const vorschlaege = async (): Promise<V[]> => ((await db.loadJson<{ vorschlaege: V[] }>('zoe-stapel'))?.vorschlaege ?? []).filter(v => v.werkzeug === 'fulfillment_onboarding');
  const ohneId = <T extends { id?: unknown }>(l: readonly T[]) => l.map(({ id: _i, ...r }) => r).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const glocken = async () => ({
    pia: ohneId(((await db.loadJson<{ eintraege: { id: string; titel: string }[] }>('meldungen--pia'))?.eintraege ?? []).filter(m => m.titel.includes('Onboarding'))),
    olaf: ohneId(((await db.loadJson<{ eintraege: { id: string; titel: string }[] }>('meldungen--olaf'))?.eintraege ?? []).filter(m => m.titel.includes('Onboarding'))),
  });
  const marken = async () => Object.fromEntries(Object.entries((await db.loadJson<{ marken?: Record<string, string> }>(`fulfillment--${H}`))?.marken ?? {}).filter(([k]) => k.startsWith('onboarding-vorschlag:')));
  const morgenlauf = async (n: number) => {
    morgen(n);
    await (await import('@/lib/fulfillment/prozesse/server')).prozesseMorgenlauf(H, tag(n));
    await L.prozesseNachLoop('morgen');
  };
  let start: Record<string, unknown> = {};
  let gold: unknown = null;
  let pz = '';
  it('ohne Überführung: je neuem Business-Kunden ein Vorschlag „Fall starten“ + Glocke + Marke (nie Privat) — wie vorher', async () => {
    start = await sichern(BESTAENDE);
    morgen(49);
    expect((await (await import('@/lib/fulfillment/prozesse/server')).prozesseMorgenlauf(H, tag(49))).vorschlaege).toBe(2);
    expect((await vorschlaege()).map(v => v.eingabe.mandatId).sort()).toEqual(['m-a', 'm-b']);
    gold = { v: ohneId(await vorschlaege()), g: await glocken(), m: await marken() };
    await zurueck(start);
  });
  it('überführen → Schatten über sechs Morgen: der alte Weg schlägt einmal vor, der neue schreibt nichts; dasselbe Bild → Umschalten', async () => {
    morgen(50);
    const r = await UE.ueberfuehren({ sp: 'sp-uebergabe', person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    for (let n = 50; n <= 56; n++) await morgenlauf(n);
    expect(await vorschlaege(), 'je Kunde genau ein Vorschlag (Marke)').toHaveLength(2);
    const a = await UE.ueberfuehrungAnsicht(await prozess(pz), H);
    expect(a).toMatchObject({ vergleich: { abweichend: 0 }, umschalten: { erlaubt: true } });
    expect((await UE.umschalten({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(200);
  });
  it('GOLD: derselbe Bestand — alter Code allein vs. neuer Prozess scharf (der alte Weg nur noch Nachsorge) → dieselben Vorschläge, Glocken, Marken', async () => {
    await zurueck(start);
    await morgenlauf(49);
    expect({ v: ohneId(await vorschlaege()), g: await glocken(), m: await marken() }).toEqual(gold);
    const lauf = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.modus === 'scharf');
    expect(lauf).toHaveLength(1);
    expect(lauf[0].schritte.flatMap(s => s.wirkung ?? []).filter(w => w.art === 'vorschlag')).toHaveLength(2);
    await morgenlauf(49);
    expect(await vorschlaege(), 'nichts doppelt').toHaveLength(2);
  });
});

// ══ Route: nur volle Mitglieder per Sitzung — Dienstweg, „nur Business“, fremder Haushalt und Sicht Privat bekommen nichts ═════════════════════════════

describe('Route /api/prozesse/werkstatt — Überführung', () => {
  type Mod = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  const dienst = (person?: string) => ({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, ...(person ? { 'x-make-person': person } : {}) });
  const post = async (k: Record<string, string>, body: unknown, space = 'business') => {
    const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Mod;
    const r = await m.POST(new Request(`http://test/api/prozesse/werkstatt?space=${space}`, { method: 'POST', headers: k, body: JSON.stringify(body) }));
    return { status: r.status, j: await r.json().catch(() => ({})) as Record<string, unknown> };
  };
  it('überführen: nur volle Mitglieder — „nur Business“, fremder Haushalt, Dienstweg, Sicht Privat → 403; schon überführt → 409 mit dem Prozess', async () => {
    const b = { aktion: 'ueberfuehren', sp: 'sp-rechnung', anfrageId: 'pzu-00000000-0000-4000-8000-000000000001' };
    for (const k of [sitzung('bea'), sitzung('gast'), dienst('pia'), dienst()]) expect((await post(k, { ...b, anfrageId: undefined })).status, JSON.stringify(k)).toBe(403);
    expect((await post(sitzung('pia'), b, 'privat')).status).toBe(403);
    const r = await post(sitzung('pia'), b);
    expect(r.status).toBe(409);
    expect(r.j.prozessId).toMatch(/^pz-/);
    expect((await post(sitzung('pia'), { ...b, sp: 'sp-bauplan', anfrageId: undefined })).status).toBe(404);
  });
  it('umschalten und zurück: „nur Business“ und Dienstweg → 403; GET ?id= trägt den Vergleich (nur Zahlen und Kennungen)', async () => {
    const pz = (await W.prozesseLesen(H)).prozesse.find(p => p.ersetzt === 'sp-rechnung')!;
    for (const aktion of ['umschalten', 'ueberfuehrung-zurueck']) {
      expect((await post(sitzung('bea'), { aktion, id: pz.id, stand: W.standVon(pz) })).status).toBe(403);
      expect((await post(dienst('pia'), { aktion, id: pz.id, stand: W.standVon(pz) })).status).toBe(403);
    }
    const m = await import('@/app/api/prozesse/werkstatt/route') as unknown as Mod;
    const g = await m.GET(new Request(`http://test/api/prozesse/werkstatt?space=business&id=${pz.id}`, { headers: sitzung('olaf') }));
    const j = await g.json() as { ueberfuehrung?: { sp: string; vergleich: Record<string, unknown> } };
    expect(j.ueberfuehrung).toMatchObject({ sp: 'sp-rechnung', vergleich: { laeufe: expect.any(Number) } });
    expect(JSON.stringify(j.ueberfuehrung?.vergleich)).not.toMatch(/pia|olaf|Beispiel/);
  });
  it('Landkarte: der System-Prozess sagt „überführt“ und nennt den Prozess, der Werkstatt-Prozess, wen er ersetzt', async () => {
    const { landkarteLesen } = await import('@/lib/prozesse/server');
    const k = await landkarteLesen(tag(30));
    const sys = k.prozesse.find(p => p.id === 'sp-rechnung')!;
    const pz = (await W.prozesseLesen(H)).prozesse.find(p => p.ersetzt === 'sp-rechnung')!;
    expect(sys.ueberfuehrung).toMatchObject({ rolle: 'alt', teil: 'Mahnaufgaben', stand: 'scharf', prozessId: pz.id });
    expect(k.prozesse.find(p => p.id === pz.id)?.ueberfuehrung).toMatchObject({ rolle: 'neu', stand: 'scharf', prozessId: 'sp-rechnung' });
    expect(k.prozesse.find(p => p.id === 'sp-bauplan')?.ueberfuehrung).toBeUndefined();
  });
});
