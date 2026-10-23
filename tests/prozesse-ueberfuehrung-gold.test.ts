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

/** Rechnungen (erfunden): zwei der Business-Gesellschaften, eine der Selbstständigkeit (Privat), eine bezahlt. Fällig vor 10 bzw. 16 Tagen. */
const rechnung = (id: string, firmaId: string, faellig: string, status = 'gestellt') => ({ id, firmaId, kunde: 'Beispiel GmbH', titel: `Leistung ${id}`, betrag: 1190, status, faellig, nummer: `R-${id}`, datum: faellig });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  morgen(-1);
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
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
