// ─── Prozesse · Überführung mit Ausbau (24.10., Paket Ü 2 — Entscheidung „Als neuen Ablauf bauen“) — von Ende zu Ende ─────────────────────────────────────
// Event-Nachfassen und der Rest der Übergabe: der gleichwertige Kern bleibt der Gold-/Schatten-Vergleich, die neuen Wirkungen kommen als zusätzliche Schritte dazu —
// im Schatten nur gezählt („neu gegenüber dem alten Weg“), scharf nach C1 (Aufgaben und Follow-ups intern, nach außen nur über den Stapel), idempotent mit festen
// Kennungen. Eigener Datenordner, erfundene Personen (@example.invalid), kein Netz, kein Modell. Für das Umschalten stehen die Stellschrauben auf 1 Lauf / 1 Tag.
//   Event-Nachfassen: GOLD = die abgeleitete Glocke „n Danke-Mails bereit“ (Kern) ist vor und nach dem Umschalten dieselbe; neu sind nur die Follow-ups
//     `fu-nf-<teilnahme>` — nie doppelt zum Follow-up des Erfassens (`fu-<erfassung>`), nie bei „Nur Kontakt“, Art. 18 oder Werbesperre; zweimal = einmal
//   Übergabe: der Kern (Onboarding-Vorschlag) wie in Paket Ü; neu nach „Deal gewonnen“: Mandat-Vorschlag (nur ohne Mandat) bzw. die Aufgabe „Übergabe
//     vervollständigen“ — im Schatten nichts geschrieben, scharf genau einmal
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, chmodSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessEintrag } from '@/lib/prozesse/definition';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ue-ausbau-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ue-ausbau';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM = JSON.stringify([{ id: 'pia', name: 'Pia', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'olaf', name: 'Olaf', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-ausbau';
const RECHTE = { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true };
const WER = { art: 'person' as const, person: 'pia' };
const um = (tag: string, uhr: string) => vi.setSystemTime(new Date(`${tag}T${uhr}:00+01:00`));
const T = (n: number) => { const d = new Date('2026-11-02T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

let db: typeof import('@/lib/store/local-db');
let L: typeof import('@/lib/prozesse/lauf-server');
let UE: typeof import('@/lib/prozesse/ueberfuehrung-server');
let W: typeof import('@/lib/prozesse/werkstatt-server');
let NF: typeof import('@/lib/crm/nachfassen-server');

const prozess = async (id: string): Promise<ProzessEintrag> => (await W.prozesseLesen(H)).prozesse.find(p => p.id === id)!;
interface FU { id: string; kontaktId?: string; status: string; bezug: { art: string; id: string } }
const followups = async (): Promise<FU[]> => ((await db.loadJson<{ followups?: FU[] }>('crm'))?.followups ?? []);
const dankeGlocke = async (person: string) => (await (await import('@/lib/heute/anstehend-server')).anstehendLesen(person)).danke ?? [];
/** Umschalten schneller (Stellschrauben „Überführung“ auf 1 Lauf / 1 Tag) — nur per Aufruf einer Person, wie in der Oberfläche. */
async function regelEinsEins(): Promise<void> {
  const S = await import('@/lib/prozesse/stellschrauben-werte-server');
  const r = await S.stellschraubenSchreiben(H, { stand: S.stellschraubenStand(await S.stellschraubenLesen(H)), ops: [{ id: 'ueberfuehrung.laeufe', wert: 1 }, { id: 'ueberfuehrung.tage', wert: 1 }], person: 'pia', jetzt: new Date().toISOString(), wer: WER });
  expect(r.ok, JSON.stringify(r)).toBe(true);
}

const teilnahme = (id: string, eventId: string, kontaktId: string, schritt: string, von: string, erfasst: string, extra: Record<string, unknown> = {}) => ({
  id, eventId, kontaktId, status: 'da', geaendert: `${erfasst}T20:00:00.000Z`,
  netzwerken: { erfassungId: id.slice(2), schritt, zustaendig: von, erfasstVon: von, erfasstAm: `${erfasst}T19:00:00.000Z` }, ...extra,
});
/** Persönlich bekannt (Stufe „Gespräch“) — sonst wäre die Mail-Ampel ohne Einwilligung rot und es gäbe keine Danke-Mail. */
const person = (id: string, extra: Record<string, unknown> = {}) => ({ id, vorname: 'Beispiel', nachname: id, email: `${id}@example.invalid`, stufe: 'gespraech', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...extra });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  um(T(-10), '12:00');
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [person('c-eins'), person('c-zwei'), person('c-drei'), person('c-vier', { eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'pia' } }), person('c-fuenf', { werbesperre: { seit: '2026-10-01' } }), person('c-sechs')] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  const { leererBestand } = await import('@/lib/crm/speicher');
  const ev = (id: string, datum: string) => ({ id, titel: `Beispiel-Unternehmertag ${id}`, format: 'sonstig', ziel: '', datum, status: 'geplant', marke: 'Netzwerken', geaendert: '2026-09-01' });
  await db.saveJson('crm', { ...leererBestand(),
    events: [ev('ev-a', T(3)), ev('ev-b', T(6))],
    teilnahmen: [
      // ev-a: Pia erfasst zwei (eine mit eigenem Follow-up aus dem Erfassen), Olaf eine „Nur Kontakt“.
      teilnahme('t-a1', 'ev-a', 'c-eins', 'followup', 'pia', T(3)), teilnahme('t-a2', 'ev-a', 'c-zwei', 'qualifizieren', 'pia', T(3)), teilnahme('t-a3', 'ev-a', 'c-drei', 'nur-kontakt', 'olaf', T(3)),
      // ev-b (nach dem Umschalten): eine normale, eine eingeschränkte, eine mit Werbesperre, eine mit „followUpAm“ (schon nachgefasst).
      teilnahme('t-b1', 'ev-b', 'c-zwei', 'andere', 'pia', T(6)), teilnahme('t-b2', 'ev-b', 'c-vier', 'andere', 'pia', T(6)), teilnahme('t-b3', 'ev-b', 'c-fuenf', 'andere', 'olaf', T(6)),
      teilnahme('t-b4', 'ev-b', 'c-sechs', 'andere', 'olaf', T(6), { followUpAm: T(6) }),
    ],
    followups: [{ id: 'fu-a1', bezug: { art: 'event', id: 'ev-a' }, kontaktId: 'c-eins', art: 'nachricht', text: 'Nachfassen', faellig: T(5), zustaendig: 'pia', status: 'offen', quelle: 'event', angelegt: '2026-11-05T19:00:00.000Z', geaendert: '2026-11-05T19:00:00.000Z' }],
  });
  L = await import('@/lib/prozesse/lauf-server');
  UE = await import('@/lib/prozesse/ueberfuehrung-server');
  W = await import('@/lib/prozesse/werkstatt-server');
  NF = await import('@/lib/crm/nachfassen-server');
  await regelEinsEins();
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Event-Nachfassen: Kern (abgeleitete Glocke) im Vergleich, neu die Follow-ups', () => {
  let pz = '';
  let goldA: unknown = null;
  it('ohne Überführung (alter Weg): am Tag nach dem Event zeigt die Glocke je Person die offenen Danke-Mails — und schreibt nichts', async () => {
    um(T(4), '09:00');
    goldA = { pia: await dankeGlocke('pia'), olaf: await dankeGlocke('olaf') };
    expect((await dankeGlocke('pia')).map(d => [d.id, d.n])).toEqual([['danke-ev-a', 2]]);
    expect((await dankeGlocke('olaf')).map(d => [d.id, d.n])).toEqual([['danke-ev-a', 1]]);
    expect((await NF.nachfassLageBild(null, T(4))).map(b => `${b.ziel}|${b.zustaendig}`)).toEqual(['danke-ev-a|olaf', 'danke-ev-a|pia']);
    expect((await NF.nachfassLageMorgenlauf(T(4))).gemeldet).toBe(0); // ohne Überführung: nichts zu melden
  });
  it('überführen → Schatten: der Morgenlauf meldet die Glocke, der neue Prozess dieselbe Lage; die Follow-ups werden nur gezählt (nichts angelegt)', async () => {
    um(T(0), '12:00');
    const r = await UE.ueberfuehren({ sp: 'sp-event-nachfassen', person: 'olaf', rechte: RECHTE, h: H, wer: { art: 'person', person: 'olaf' } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    expect(await prozess(pz)).toMatchObject({ status: 'probelauf', ersetzt: 'sp-event-nachfassen', ueberfuehrung: { phase: 'schatten' } });
    await L.prozesseImTakt(); // erster Takt: der Datums-Auslöser merkt sich nur den Moment
    um(T(4), '07:00');
    expect((await NF.nachfassLageMorgenlauf(T(4))).gemeldet).toBe(2);
    um(T(4), '08:05');
    await L.prozesseImTakt();
    const laeufe = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz);
    expect(laeufe.map(l => [l.modus, l.fall.art, l.fall.id])).toEqual([['schatten', 'event', 'ev-a']]);
    const v = (await prozess(pz)).ueberfuehrung!.vergleich;
    expect(v.offen?.tag).toBe(T(4));
    expect(v.offen?.alt).toHaveLength(2);
    expect(v.offen?.alt).toEqual(v.offen?.neu);
    // Neu gegenüber dem alten Weg: ein Follow-up würde entstehen (c-zwei) — c-eins hat das Follow-up des Erfassens, c-drei ist „Nur Kontakt“.
    expect(v.zusatz?.arten.followup).toBe(1);
    expect((await followups()).map(f => f.id)).toEqual(['fu-a1']);
    expect({ pia: await dankeGlocke('pia'), olaf: await dankeGlocke('olaf') }).toEqual(goldA);
    const a = await UE.ueberfuehrungAnsicht(await prozess(pz), H);
    expect(a?.zusatz?.satz).toMatch(/Neu gegenüber dem alten Weg/);
  });
  it('Umschalten (nach einem gleichen Tag) → scharf: die Glocke bleibt dieselbe (Kern abgeleitet), neu sind genau die zulässigen Follow-ups — zweimal = einmal', async () => {
    um(T(5), '09:00');
    const e = await prozess(pz);
    const u = await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(await UE.wegFuer('sp-event-nachfassen')).toMatchObject({ weg: 'neu' });
    // ev-b ist am Tag 6; am Tag 7 um 8:05 startet der scharfe Lauf.
    um(T(7), '07:00');
    const goldB = { pia: await dankeGlocke('pia'), olaf: await dankeGlocke('olaf') };
    expect((await NF.nachfassLageMorgenlauf(T(7))).gemeldet).toBe(0); // scharf: der Morgenlauf meldet nichts mehr
    um(T(7), '08:05');
    await L.prozesseImTakt();
    const lauf = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.modus === 'scharf');
    expect(lauf.map(l => l.fall.id)).toEqual(['ev-b']);
    // Nur c-zwei: c-vier eingeschränkt (Art. 18), c-fünf Werbesperre, c-sechs schon nachgefasst (followUpAm).
    expect((await followups()).map(f => f.id).sort()).toEqual(['fu-a1', 'fu-nf-t-b1']);
    expect((await followups()).find(f => f.id === 'fu-nf-t-b1')).toMatchObject({ kontaktId: 'c-zwei', status: 'offen', bezug: { art: 'event', id: 'ev-b' } });
    expect(lauf[0].schritte.flatMap(s => s.wirkung ?? []).filter(w => w.art === 'followup').map(w => w.id)).toEqual(['fu-nf-t-b1']);
    // GOLD (Kern): die Glocke ist dieselbe wie ohne den neuen Weg.
    expect({ pia: await dankeGlocke('pia'), olaf: await dankeGlocke('olaf') }).toEqual(goldB);
    // Zweimal = einmal (feste Kennung, Prüfung in der Sperre).
    const n = await NF.nachfassFollowupsKern('ev-b', T(7), { schreiben: true, person: 'pia' });
    expect(n.neu).toEqual([]);
    expect((await followups()).filter(f => f.id === 'fu-nf-t-b1')).toHaveLength(1);
  });
  it('Weiche nicht lesbar → der Morgenlauf meldet nichts, der Motor legt nichts an — die Glocke (Kern) bleibt: nie keine, nie zwei', async () => {
    const datei = path.join(ordner, `prozesse--${H}.json`);
    chmodSync(datei, 0o000);
    utimesSync(datei, new Date(), new Date(Date.now() + 5000));
    try {
      um(T(7), '10:00');
      expect(await UE.wegFuer('sp-event-nachfassen')).toEqual({ weg: 'alt', schatten: false });
      expect((await NF.nachfassLageMorgenlauf(T(7))).gemeldet).toBe(0);
      expect((await dankeGlocke('pia')).length).toBeGreaterThan(0);
    } finally { chmodSync(datei, 0o600); utimesSync(datei, new Date(), new Date(Date.now() + 10000)); }
  });
});

describe('Übergabe: Kern (Onboarding-Vorschlag) im Vergleich, neu nach „Deal gewonnen“', () => {
  let pz = '';
  interface V { id: string; werkzeug: string; eingabe: Record<string, unknown>; status?: string }
  const stapel = async (): Promise<V[]> => ((await db.loadJson<{ vorschlaege: V[] }>('zoe-stapel'))?.vorschlaege ?? []);
  const aufgaben = async (): Promise<{ id: string; title: string }[]> => ((await db.loadJson<{ tasks: { id: string; title: string }[] }>('tasks'))?.tasks ?? []);
  beforeAll(async () => {
    um(T(10), '12:00');
    // Zwei gewonnene Deals: d-ohne (ohne Mandat), d-mit (Mandat da, Vertrag nicht unterschrieben). Fulfillment eingerichtet (Kern), ohne Paket.
    await db.updateJson<Record<string, unknown>>('crm', c => ({ ...c!,
      firmen: [{ id: 'f-probe', name: 'Probe GmbH', rolle: 'kunde', geaendert: '2026-09-01T00:00:00.000Z' }],
      chancen: [
        { id: 'd-ohne', titel: 'Beratung', firma: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-zwei'], stufe: 'gewonnen', wert: 1000, gesellschaft: 'ug', angelegt: '2026-10-01', geaendert: '2026-11-01T00:00:00.000Z', historie: [] },
        { id: 'd-mit', titel: 'Begleitung', firma: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-zwei'], stufe: 'gewonnen', wert: 2000, gesellschaft: 'ug', angelegt: '2026-10-01', geaendert: '2026-11-01T00:00:00.000Z', historie: [] },
      ],
      mandate: [{ id: 'm-mit', chanceId: 'd-mit', kunde: 'Probe GmbH', firmaId: 'f-probe', kontaktIds: ['c-zwei'], titel: 'Mandat Begleitung', art: 'retainer', gesellschaft: 'ug', status: 'aktiv', vertragUnterschrieben: false,
        start: T(0), verlaengerung: 'offen', honorar: { betrag: 1000, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [],
        health: { beteiligung: null, umsetzung: null, wirkung: null, zahlung: null, stimmung: null }, leistungen: [], offen: [], geaendert: '2026-09-01T00:00:00.000Z' }],
    }));
    await db.saveJson(`fulfillment--${H}`, { version: 1, prozesse: [], bausteine: [], rituale: [], zuordnung: {}, agentZusatz: {}, einstellungen: {}, importLaeufe: [], marken: { 'fulfillment-eingerichtet': T(-40) } });
    await db.saveJson(`fulfillment-faelle--${H}`, { version: 1, faelle: {} });
  });
  const morgen = async (n: number) => {
    um(T(n), '08:30');
    await (await import('@/lib/fulfillment/prozesse/server')).prozesseMorgenlauf(H, T(n));
    await L.prozesseNachLoop('morgen');
  };
  const gewonnen = async (deal: string) => (await import('@/lib/ereignisse/server')).ereignis({ id: `crm:${deal}:stufe-g`, art: 'deal-stufe', quelle: 'crm', bezug: { dealId: deal }, bereich: 'business', person: 'pia', stufe: 'gewonnen' });

  it('überführen → Schatten: der Kern vergleicht wie gehabt; „Deal gewonnen“ läuft nur gezählt mit — kein Mandat-Vorschlag, keine Aufgabe', async () => {
    um(T(10), '12:00');
    const r = await UE.ueberfuehren({ sp: 'sp-uebergabe', person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    expect(await prozess(pz), JSON.stringify(r.body)).toMatchObject({ status: 'probelauf', ersetzt: 'sp-uebergabe' });
    await L.prozesseImTakt(); // Cursor der Ereignisse: ab jetzt
    await morgen(11);
    // Der Kern: beide Wege sehen den neuen Kunden (gewonnener Deal mit Mandat, noch ohne Fall) — dasselbe Bild.
    const offen = (await prozess(pz)).ueberfuehrung!.vergleich.offen;
    expect(offen?.tag).toBe(T(11));
    expect(offen?.alt).toHaveLength(1);
    expect(offen?.alt, 'beide Wege melden denselben Kern').toEqual(offen?.neu);
    const vorher = { stapel: (await stapel()).length, aufgaben: (await aufgaben()).length };
    um(T(11), '10:00');
    await gewonnen('d-ohne');
    await L.prozesseImTakt();
    const laeufe = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.fall.art === 'deal');
    expect(laeufe.map(l => [l.modus, l.fall.id])).toEqual([['schatten', 'd-ohne']]);
    const v = (await prozess(pz)).ueberfuehrung!.vergleich;
    // Gezählt (nie angelegt): der Mandat-Vorschlag des Deals ohne Mandat — und was danach käme.
    const arten = v.zusatz?.arten ?? {};
    expect((arten['crm-vorschlag'] ?? 0) + (arten.vorschlag ?? 0), JSON.stringify(v.zusatz)).toBeGreaterThan(0);
    expect(Object.values(arten).reduce((a, n) => a + n, 0)).toBe(v.zusatz?.wirkungen);
    expect(v.zusatz?.wirkungen).toBeGreaterThan(0);
    expect({ stapel: (await stapel()).length, aufgaben: (await aufgaben()).length }).toEqual(vorher);
  });
  it('Umschalten → scharf: „Deal gewonnen“ mit Mandat → genau EINE Aufgabe „Übergabe vervollständigen“, kein Mandat-Vorschlag; zweiter Takt legt nichts doppelt an', async () => {
    um(T(12), '08:00');
    await morgen(12);
    um(T(13), '07:30');
    const e = await prozess(pz);
    const u = await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    um(T(13), '10:00');
    await gewonnen('d-mit');
    await L.prozesseImTakt();
    await L.prozesseImTakt();
    const t = (await aufgaben()).filter(x => x.title === 'Übergabe vervollständigen (acht Blöcke)');
    expect(t).toHaveLength(1);
    expect((await stapel()).filter(v => JSON.stringify(v.eingabe).includes('d-mit') && /mandat/i.test(v.werkzeug + JSON.stringify(v.eingabe)) && v.werkzeug !== 'fulfillment_onboarding')).toEqual([]);
    const lauf = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.fall.id === 'd-mit');
    expect(lauf).toHaveLength(1);
    expect(lauf[0]).toMatchObject({ modus: 'scharf', status: 'wartet' });
  });
});
