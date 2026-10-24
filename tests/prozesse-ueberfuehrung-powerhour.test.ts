// ─── Prozesse · Überführung der Power-Hour-Vorbereitung (24.10., Paket Ü 2) — von Ende zu Ende ──────────────────────────────────────────────────────────
// Entscheidung 24.10.: „Power-Hour: Ja, ins Update“ — mit dem neuen Auslöser „je Person ab Uhrzeit“. Eigener Datenordner, zwei erfundene Konten (@example.invalid
// über die Bau-Hilfe), kein Netz, kein Modell, kein Arbeiter: der „Arbeiter“ ist hier eine Hilfe, die eingereihte Power-Hour-Aufträge erledigt und den Riegel
// des Head of Sales setzt (wie `headLauf`). Geprüft:
//   · Gold (alter Weg allein): je Arbeitstag Pia ab 7 Uhr, Olaf erst nach seiner Business-freien Zeit (bis 10 Uhr) — Nachholen am selben Tag; der Feiertag
//     (Fr 25.12.) zählt wie im Takt der Heads mit (Mo–Fr), Samstag nichts
//   · überführen → Schatten: der alte Weg reiht ein wie vorher, der neue rechnet je Person mit und reiht NICHTS ein; beide melden dasselbe Bild; erster Takt merkt nur
//   · nach fünf gleichen Tagen „Umschalten“ (nur per Aufruf einer Person) → der neue Weg reiht ein, der alte nicht mehr → dieselben Aufträge wie Gold
//   · Weiche nicht lesbar → nur der alte Weg; hin und zurück (anhalten mitten am Tag, wieder aktiv, zurück in den Schatten) → nie doppelt, nie keiner
// Ausgenommen vom Gold-Vergleich (ausdrücklich): die Kennungen und Zeiten der Aufträge in der Warteschlange und die Minute des Einreihens (der neue Weg reiht im
// Motor-Teil desselben Takts ein), der Lauf-Bestand des Motors.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, chmodSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ProzessEintrag } from '@/lib/prozesse/definition';
import { konto } from './fixtures/prozess-bau';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-ue-powerhour-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-ue-powerhour';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.NEXT_PUBLIC_MAKE_OS_CRM_TEAM = JSON.stringify([{ id: 'pia', name: 'Pia', farbe: '#58D9CD', verantwortet: ['sales'] }, { id: 'olaf', name: 'Olaf', farbe: '#A79BFF', verantwortet: ['marketing', 'event'] }]);
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;

const H = 'haus-ph';
const RECHTE = { sehen: true, entwurf: true, veroeffentlichen: true, status: true, webhook: true };
const WER = { art: 'person' as const, person: 'pia' };
/** Berliner Winterzeit (UTC+1). */
const um = (tag: string, uhr: string) => vi.setSystemTime(new Date(`${tag}T${uhr}:00+01:00`));
const ARBEITSTAGE_GOLD = ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25', '2026-12-26'];

let db: typeof import('@/lib/store/local-db');
let L: typeof import('@/lib/prozesse/lauf-server');
let UE: typeof import('@/lib/prozesse/ueberfuehrung-server');
let W: typeof import('@/lib/prozesse/werkstatt-server');
let HT: typeof import('@/lib/heads/takt');

interface Auftrag { id: string; name: string; auftrag?: string; tag: string; status: string; zeit: string }
const auftraege = async (): Promise<Auftrag[]> => ((await db.loadJson<{ auftraege: Auftrag[] }>('zoe-auftraege'))?.auftraege ?? []);
/** Die Power-Hour-Aufträge als „Tag|Person“ (sortiert) — das, was der Gold-Vergleich vergleicht. */
const powerHour = async (): Promise<string[]> => (await auftraege()).filter(a => a.name === 'head-sales' && /^modus:power_hour person:/.test(a.auftrag ?? ''))
  .map(a => `${a.tag}|${a.auftrag!.split('person:')[1]}`).sort();
const prozess = async (id: string): Promise<ProzessEintrag> => (await W.prozesseLesen(H)).prozesse.find(p => p.id === id)!;
async function sichern(namen: readonly string[]): Promise<Record<string, unknown>> {
  return Object.fromEntries(await Promise.all(namen.map(async n => [n, await db.loadJson<unknown>(n)] as const)));
}
async function zurueck(s: Record<string, unknown>): Promise<void> {
  for (const [n, v] of Object.entries(s)) { if (v === null) await db.bestandEntfernen(n); else await db.saveJson(n, v); }
}

/** Der „Arbeiter“: erledigt eingereihte Power-Hour-Aufträge und setzt den Riegel des Head of Sales (wie `headLauf` am Ende). */
async function arbeiter(): Promise<void> {
  const offen = (await auftraege()).filter(a => a.status === 'offen' && a.name === 'head-sales');
  if (!offen.length) return;
  const jetzt = new Date().toISOString();
  await db.updateJson<{ auftraege: Auftrag[] }>('zoe-auftraege', s => ({ ...s!, auftraege: s!.auftraege.map(a => (offen.some(o => o.id === a.id) ? { ...a, status: 'fertig', beendet: jetzt } : a)) }));
  await db.updateJson<{ letzte?: Record<string, string> }>('head-sales', s => ({ berichte: [], vorschlaege: [], versuche: {}, ...(s ?? {}), letzte: { ...(s?.letzte ?? {}), ...Object.fromEntries(offen.map(o => [`power_hour:${o.auftrag!.split('person:')[1]}`, jetzt])) } }));
}

/** Ein Takt wie die Takt-Route: der alte Weg (Heads, nach dem Morgenlauf, mit den Sperren; eingereiht → Meldung an den Vergleich), dann der Motor; danach der Arbeiter. */
async function takt(tag: string, uhr: string): Promise<void> {
  um(tag, uhr);
  await db.saveJson('tagesstart', { lastRun: tag });
  const { sperrenFiltern, morgenlaufDurch } = await import('@/lib/zoe/takt');
  if (await morgenlaufDurch()) {
    const f = await sperrenFiltern(await HT.headsFaellig(new Date()));
    const r = await (await import('@/lib/zoe/auftraege')).reihe(f.map(x => x.auftrag));
    await HT.powerHourEingereihtMelden(r.angelegt);
  }
  await L.prozesseImTakt();
  await arbeiter();
}
/** Ein Arbeitstag: 7:05 (Pia), 7:06 (nichts mehr — Olaf ist Business-frei), 10:05 (Olaf holt nach), 10:06. */
async function tagLauf(tag: string): Promise<void> {
  for (const uhr of ['07:05', '07:06', '10:05', '10:06']) await takt(tag, uhr);
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  um('2026-12-01', '12:00');
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'inhaber', { haushalt: H }), konto('k2', 'olaf', 'mitglied', { haushalt: H })], einladungen: [] });
  // Olaf: Mo–Fr bis 10 Uhr Business-frei (eigener Rahmen) — seine Power Hour kommt danach am selben Tag.
  await db.saveJson('arbeitsrahmen--olaf', { businessFrei: [{ tage: [1, 2, 3, 4, 5], von: '00:00', bis: '10:00' }] });
  await db.saveJson('tasks', { tasks: [], projects: [] });
  L = await import('@/lib/prozesse/lauf-server');
  UE = await import('@/lib/prozesse/ueberfuehrung-server');
  W = await import('@/lib/prozesse/werkstatt-server');
  HT = await import('@/lib/heads/takt');
});
afterAll(async () => {
  vi.useRealTimers();
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => null);
  rmSync(ordner, { recursive: true, force: true });
});

describe('Power-Hour-Vorbereitung: Gold → Schatten → Umschalten → Gold → Weiche → hin und zurück', () => {
  let gold: string[] = [];
  let pz = '';
  it('GOLD alter Weg allein: je Arbeitstag Pia ab 7, Olaf nach seiner freien Zeit (Nachholen) — der Feiertag zählt (Mo–Fr), Samstag nichts', async () => {
    const start = await sichern(['zoe-auftraege', 'head-sales', 'tagesstart']);
    for (const t of ARBEITSTAGE_GOLD) await tagLauf(t);
    gold = await powerHour();
    expect(gold).toEqual(ARBEITSTAGE_GOLD.slice(0, 5).flatMap(t => [`${t}|olaf`, `${t}|pia`]));
    // Nachholen: um 7:05 nur Pia, Olafs Auftrag entstand erst ab 10 Uhr.
    const olaf = (await auftraege()).filter(a => a.auftrag?.endsWith('person:olaf'));
    expect(olaf.every(a => new Date(a.zeit).getUTCHours() >= 9)).toBe(true);
    await zurueck(start);
    expect(await powerHour()).toEqual([]);
  });

  it('überführen: neuer Prozess im Probelauf, Schatten, Auslöser je Person mit der Uhrzeit der Stellschraube — der erste Takt merkt nur', async () => {
    um('2026-12-13', '12:00'); // Sonntag
    const r = await UE.ueberfuehren({ sp: 'sp-followup', person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    pz = String(r.body.prozessId);
    const e = await prozess(pz);
    expect(e).toMatchObject({ status: 'probelauf', ersetzt: 'sp-followup', ueberfuehrung: { phase: 'schatten' } });
    const t = e.versionen.at(-1)!.definition.knoten.find(k => k.form === 'ausloeser')!;
    expect(t.ausloeser).toEqual({ art: 'person', uhrzeit: '07:00', bis: '22:00', tage: 'mo-fr', nachMorgenlauf: true, stundeAus: 'head.sales.power_hour.stunde' });
    await takt('2026-12-13', '12:00');
    const st = (await L.laeufeLesen(H)).prozesse[pz];
    expect(st.person?.[t.id]).toEqual({ seit: '2026-12-13', tage: {} });
    expect((await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz)).toEqual([]);
  });

  it('Schatten (Mo–Fr): der alte Weg reiht ein wie vorher, der neue rechnet je Person mit und reiht nichts ein — dasselbe Bild', async () => {
    const tage = ['2026-12-14', '2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18'];
    await tagLauf(tage[0]);
    expect(await powerHour()).toEqual([`${tage[0]}|olaf`, `${tage[0]}|pia`]);
    const laeufe = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz);
    expect(laeufe.map(l => [l.modus, l.status, l.person]).sort()).toEqual([['schatten', 'fertig', 'olaf'], ['schatten', 'fertig', 'pia']]);
    const v = (await prozess(pz)).ueberfuehrung!.vergleich;
    expect(v.offen?.tag).toBe(tage[0]);
    expect(v.offen?.alt).toHaveLength(2);
    expect(v.offen?.alt).toEqual(v.offen?.neu);
    // Umschalten geht noch nicht.
    expect((await UE.umschalten({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER })).status).toBe(409);
    for (const t of tage.slice(1)) await tagLauf(t);
    expect(await powerHour()).toEqual(tage.flatMap(t => [`${t}|olaf`, `${t}|pia`]));
  });

  it('nach fünf gleichen Tagen geht „Umschalten“ — dann arbeitet der neue Weg', async () => {
    um('2026-12-21', '06:30');
    const e = await prozess(pz);
    const a = await UE.ueberfuehrungAnsicht(e, H);
    expect(a).toMatchObject({ phase: 'schatten', arbeitet: 'alt', vergleich: { laeufe: 5, gleich: 5, abweichend: 0, gleichLaeufe: 5 }, umschalten: { erlaubt: true } });
    const u = await UE.umschalten({ prozessId: pz, stand: W.standVon(e), person: 'pia', rechte: RECHTE, h: H, wer: WER });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    expect(await UE.wegFuer('sp-followup')).toMatchObject({ weg: 'neu', schatten: false });
  });

  it('GOLD neuer Weg scharf: dieselben Aufträge wie der alte Weg allein (Nachholen, Feiertag, Samstag) — und nur der Motor hat sie eingereiht', async () => {
    const vorher = new Set((await auftraege()).map(a => a.id));
    for (const t of ARBEITSTAGE_GOLD) await tagLauf(t);
    const neu = (await powerHour()).filter(x => x >= '2026-12-21');
    expect(neu).toEqual(gold);
    // Die übrigen Läufe des Head of Sales (Lead-Review am Montag …) reiht weiter der Takt ein — gezählt werden nur die Power-Hour-Aufträge.
    const ids = (await auftraege()).filter(a => !vorher.has(a.id) && a.name === 'head-sales' && /^modus:power_hour /.test(a.auftrag ?? '')).map(a => a.id).sort();
    const ausLaeufen = (await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.modus === 'scharf').flatMap(l => l.schritte.flatMap(s => s.wirkung ?? [])).filter(w => w.art === 'auftrag').map(w => w.id).sort();
    expect(ausLaeufen).toEqual(ids);
  });

  it('Weiche nicht lesbar (Werkstatt-Bestand gesperrt) → der alte Weg arbeitet allein — nie keiner, nie beide', async () => {
    const datei = path.join(ordner, `prozesse--${H}.json`);
    chmodSync(datei, 0o000);
    utimesSync(datei, new Date(), new Date(Date.now() + 5000));
    try {
      um('2026-12-28', '07:00');
      expect(await UE.wegFuer('sp-followup')).toEqual({ weg: 'alt', schatten: false });
      await tagLauf('2026-12-28');
      expect((await powerHour()).filter(x => x.startsWith('2026-12-28'))).toEqual(['2026-12-28|olaf', '2026-12-28|pia']);
      expect((await L.laeufeLesen(H)).laeufe.filter(l => l.prozessId === pz && l.start.startsWith('2026-12-28'))).toEqual([]);
    } finally { chmodSync(datei, 0o600); utimesSync(datei, new Date(), new Date(Date.now() + 10000)); }
  });

  it('hin und zurück: anhalten mitten am Tag → der alte Weg übernimmt den Rest; wieder aktiv → der neue erkennt Erledigtes; Schatten → der alte — nie doppelt', async () => {
    const statusSetzen = async (status: 'pausiert' | 'aktiv') => {
      const { werkstattAnwenden } = await import('@/lib/prozesse/bestand');
      const { neueKennung } = await import('@/lib/kennung');
      const e = await prozess(pz);
      const r = await W.prozesseAendern<object>(d => werkstattAnwenden(d, { aktion: 'status', id: pz, stand: W.standVon(e), status }, { person: 'pia', jetzt: new Date().toISOString(), rechte: RECHTE, standVon: W.standVon, neueKennung: p => neueKennung(p) }) as never, WER, H);
      expect(r.ok, JSON.stringify(r)).toBe(true);
    };
    const tag = (t: string) => powerHour().then(l => l.filter(x => x.startsWith(t)));
    // Di 29.12.: 7:05 der neue Weg (Pia), um 8 Uhr angehalten, ab 10 Uhr der alte Weg (Olaf) — jede Person genau einmal.
    await takt('2026-12-29', '07:05');
    expect(await tag('2026-12-29')).toEqual(['2026-12-29|pia']);
    um('2026-12-29', '08:00');
    await statusSetzen('pausiert');
    expect((await UE.wegFuer('sp-followup')).weg).toBe('alt');
    await takt('2026-12-29', '10:05');
    await takt('2026-12-29', '10:06');
    expect(await tag('2026-12-29')).toEqual(['2026-12-29|olaf', '2026-12-29|pia']);
    // Mi 30.12.: angehalten bis 11 Uhr (der alte Weg macht beide), dann wieder aktiv — der neue Weg startet, erkennt den Riegel und reiht nichts doppelt ein.
    await tagLauf('2026-12-30');
    um('2026-12-30', '11:00');
    await statusSetzen('aktiv');
    expect((await UE.wegFuer('sp-followup')).weg).toBe('neu');
    await takt('2026-12-30', '11:05');
    expect(await tag('2026-12-30')).toEqual(['2026-12-30|olaf', '2026-12-30|pia']);
    // Do 31.12.: zurück in den Schatten → der alte Weg arbeitet, der neue rechnet nur mit.
    um('2026-12-31', '06:30');
    expect(await UE.zurueckInDenSchattenServer({ prozessId: pz, stand: W.standVon(await prozess(pz)), person: 'pia', rechte: RECHTE, h: H, wer: WER })).toMatchObject({ status: 200 });
    expect(await UE.wegFuer('sp-followup')).toMatchObject({ weg: 'alt', schatten: true });
    await tagLauf('2026-12-31');
    expect(await tag('2026-12-31')).toEqual(['2026-12-31|olaf', '2026-12-31|pia']);
    const alle = await powerHour();
    expect(new Set(alle).size, 'nichts doppelt').toBe(alle.length);
  });

  it('Stellschraube „an/aus“ der Power Hour gilt für beide Wege (eine Wahrheit) — aus: niemand reiht ein, der Vergleich zählt den Tag nicht', async () => {
    const { stellschraubenSchreiben, stellschraubenLesen, stellschraubenStand } = await import('@/lib/prozesse/stellschrauben-werte-server');
    um('2027-01-03', '12:00');
    const r = await stellschraubenSchreiben(H, { stand: stellschraubenStand(await stellschraubenLesen(H)), ops: [{ id: 'head.sales.power_hour.an', wert: false }], person: 'pia', jetzt: new Date().toISOString(), wer: WER });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const v0 = (await prozess(pz)).ueberfuehrung!.vergleich;
    await tagLauf('2027-01-04');
    expect((await powerHour()).filter(x => x.startsWith('2027-01-04'))).toEqual([]);
    um('2027-01-05', '06:00');
    const a = await UE.ueberfuehrungAnsicht(await prozess(pz), H);
    expect(a?.vergleich.abweichend).toBe(v0.abweichend);
  });
});
