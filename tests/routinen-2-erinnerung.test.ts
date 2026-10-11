// ─── Routinen 2 (10.10.) — Erinnerungen (Glocke abgeleitet, Handy neutral), Kalender-Blöcke, Vorlagen, Editor-Entwurf ─────────────────
// Die Glocke leitet Routinen-Erinnerungen beim Lesen ab (nie gespeichert); aufs Handy nur mit der Einstellung der Person, Einwilligung (a),
// einmal je Routine und Uhrzeit, und IMMER ohne Namen der Routine. Kalender-Blöcke nur für eigene Routinen, feste UIDs, idempotent, entfernt
// werden nur eigene künftige. Eigener Datenordner, erfundene Personen; Kalender und Bote gemockt.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-routinen-2-erinnerung-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-routinen-2e', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;

const bote = vi.hoisted(() => ({ gesendet: [] as { person: string; art: string; text: string }[] }));
vi.mock('@/lib/zoe/an-person', () => ({ anPersonMelden: async (person: string, art: string, text: string) => { bote.gesendet.push({ person, art, text }); return { kanal: 'telegram', erreicht: 1 }; } }));
const kal = vi.hoisted(() => ({ angelegt: [] as { person: string; uid?: string; date: string; startMin: number; titel: string; art: string; privat?: boolean }[], geloescht: [] as string[], fehler: null as string | null }));
vi.mock('@/lib/planung/bloecke-server', () => ({
  blockAnlegen: async (person: string, b: { uid?: string; date: string; startMin: number; titel: string; art: string; privat?: boolean }) => {
    if (kal.fehler) throw new Error(kal.fehler);
    kal.angelegt.push({ person, ...b });
    return { uid: b.uid ?? 'x' };
  },
}));
vi.mock('@/lib/kalender/termin-server', () => ({ terminLoeschenServer: async (uid: string) => { kal.geloescht.push(uid); } }));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async () => {} }));

import { offeneErinnerungen, imFenster, blockSoll, blockDiff, routineBlockUid, erinnerungsZeiten, KALENDER_FENSTER_TAGE, KALENDER_UHRZEITEN_MAX, uhrAusBlockUid, kalenderBetroffen } from '@/lib/planung/routinen-erinnerung';
import { termineHeute, istRoutinenBlock } from '@/lib/heute/anstehend';
import { ROUTINEN_VORLAGEN, vorlageAnlegen } from '@/lib/planung/routinen-vorlagen';
import { entwurfAus, routineAusEntwurf, entwurfFehler, regelAusEntwurf } from '@/lib/planung/routine-entwurf';
import { sauberRoutine } from '@/lib/planung/routinen';
import { UID_FEST } from '@/lib/kalender/eingabe';
import { hinweisRoutine, telegramInhalteFinden } from '@/lib/datenschutz/telegram-text';
import type { Routine } from '@/lib/planung/typen';

type Handler = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const dienst = (p?: string) => ({ 'content-type': 'application/json', 'x-make-key': 'pruef-schluessel-routinen-2e', ...(p ? { 'x-make-person': p } : {}) });
const rufe = async (h: Handler, methode: string, pfad: string, kopf: Record<string, string>, body?: unknown) => {
  const r = await h(new Request(`http://test${pfad}`, { method: methode, headers: kopf, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  const text = await r.text();
  return { status: r.status, text, json: (text ? JSON.parse(text) : {}) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
const roh = (name: string) => { const d = path.join(ordner, `${name}.json`); return existsSync(d) ? readFileSync(d, 'utf8') : null; };

const basis = { wann: 'morgen' as const, kategorie: 'gesundheit' as const, dauerMin: 15, aktiv: true };
// Montag, 12.10.2026, 09:00 in Berlin (Sommerzeit: UTC+2).
const JETZT = new Date('2026-10-12T07:00:00Z');
const HEUTE = '2026-10-12';

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'olaf', email: 'olaf@example.invalid', name: 'Olaf Prüf', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
    { id: 'k2', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia Prüf', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
  ], einladungen: [] });
  const ein = await import('@/lib/datenschutz/gesundheit-einwilligung');
  expect((await ein.gesundheitErklaeren('pia', 'verarbeiten', true, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
  // Olaf hat die Einwilligung (a) ausdrücklich NICHT gegeben.
  expect((await ein.gesundheitErklaeren('olaf', 'verarbeiten', false, ein.GESUNDHEIT_FASSUNG)).ok).toBe(true);
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

describe('Erinnerungen — rein', () => {
  const tabletten: Routine = { ...basis, id: 'tabletten', label: 'Tabletten', owner: 'pia', uhrzeiten: ['08:00', '20:00'], erinnerung: true };
  it('mehrmals täglich: je Uhrzeit, solange der Zähler darunter liegt — höchstens EINE je Routine', () => {
    expect(offeneErinnerungen([tabletten], {}, {}, HEUTE, '09:00').map(e => e.schluessel)).toEqual(['tabletten@08:00']);
    expect(offeneErinnerungen([tabletten], {}, {}, HEUTE, '21:00').map(e => e.schluessel)).toEqual(['tabletten@20:00']);
    expect(offeneErinnerungen([tabletten], {}, { [HEUTE]: { tabletten: 1 } }, HEUTE, '12:00')).toEqual([]);
    expect(offeneErinnerungen([tabletten], {}, { [HEUTE]: { tabletten: 1 } }, HEUTE, '20:10').map(e => e.uhr)).toEqual(['20:00']);
    expect(offeneErinnerungen([tabletten], { [HEUTE]: ['tabletten'] }, { [HEUTE]: { tabletten: 2 } }, HEUTE, '21:00')).toEqual([]);
    expect(offeneErinnerungen([tabletten], {}, {}, HEUTE, '07:59')).toEqual([]);
  });
  it('ohne Uhrzeit die Tageszeit; ohne Schalter, nicht dran, in einer Pause oder verdeckt: keine', () => {
    const morgens: Routine = { ...basis, id: 'm', label: 'Dehnen', erinnerung: true };
    expect(erinnerungsZeiten(morgens)).toEqual(['07:30']);
    expect(offeneErinnerungen([morgens], {}, {}, HEUTE, '07:45').map(e => e.uhr)).toEqual(['07:30']);
    expect(offeneErinnerungen([{ ...morgens, erinnerung: undefined }], {}, {}, HEUTE, '09:00')).toEqual([]);
    expect(offeneErinnerungen([{ ...morgens, regel: { art: 'wochentage', tage: [2] } }], {}, {}, HEUTE, '09:00')).toEqual([]); // heute Montag
    expect(offeneErinnerungen([{ ...morgens, pausen: [{ von: HEUTE, bis: HEUTE }] }], {}, {}, HEUTE, '09:00')).toEqual([]);
    expect(offeneErinnerungen([{ ...morgens, belegt: true }], {}, {}, HEUTE, '09:00')).toEqual([]);
    expect(offeneErinnerungen([{ ...morgens, space: 'business' }], {}, {}, HEUTE, '09:00')[0].business).toBe(true);
  });
  it('Handy nur frisch (≤ 20 Min.), Text immer neutral', () => {
    expect(imFenster('08:00', '08:15')).toBe(true);
    expect(imFenster('08:00', '08:25')).toBe(false);
    expect(imFenster('20:00', '08:15')).toBe(false);
    const t = hinweisRoutine(2, 'https://beispiel.invalid/os/planung/routinen');
    expect(t).toMatch(/^Ein paar Routinen stehen an — Details in MAKE OS/);
    expect(telegramInhalteFinden(t)).toEqual([]);
  });
});

describe('Kalender-Blöcke — rein', () => {
  const laufen: Routine = { ...basis, id: 'laufen', label: 'Laufen', owner: 'pia', kalender: true, regel: { art: 'wochentage', tage: [1, 4] }, uhrzeiten: ['07:00'], dauerMin: 45 };
  it('nur eigene Routinen mit Schalter; je geplantem Tag und Uhrzeit ein Block mit fester UID (UID_FEST)', () => {
    const soll = blockSoll('pia', [laufen, { ...laufen, id: 'gem', owner: 'beide' }, { ...laufen, id: 'olaf-r', owner: 'olaf' }, { ...laufen, id: 'aus', kalender: undefined }], {}, HEUTE);
    expect(soll.map(b => b.tag)).toEqual(['2026-10-12', '2026-10-15', '2026-10-19', '2026-10-22']);
    expect(soll.every(b => b.routineId === 'laufen' && b.uhr === '07:00' && UID_FEST.test(b.uid))).toBe(true);
    expect(routineBlockUid('pia', 'laufen', HEUTE, '07:00')).not.toMatch(/pia|laufen/);
    expect(KALENDER_FENSTER_TAGE).toBe(14);
    // x-mal pro Woche hat keinen festen Tag — kein Block; Pausen fallen weg.
    expect(blockSoll('pia', [{ ...laufen, regel: { art: 'pro-woche', anzahl: 2 } }], {}, HEUTE)).toEqual([]);
    expect(blockSoll('pia', [{ ...laufen, pausen: [{ von: '2026-10-14', bis: '2026-10-20' }] }], {}, HEUTE).map(b => b.tag)).toEqual(['2026-10-12', '2026-10-22']);
  });
  it('Diff: anlegen, was fehlt; entfernen nur eigene ab morgen; Vergangenes fällt aus dem Bestand', () => {
    const soll = blockSoll('pia', [laufen], {}, HEUTE);
    const bestand = { alt: { r: 'laufen', tag: '2026-10-10' }, heute: { r: 'laufen', tag: HEUTE }, weg: { r: 'laufen', tag: '2026-10-13' }, [soll[1].uid]: { r: 'laufen', tag: soll[1].tag } };
    const d = blockDiff(soll, bestand, HEUTE);
    expect(d.anlegen.map(b => b.tag)).toEqual(['2026-10-12', '2026-10-19', '2026-10-22']);
    expect(d.entfernen).toEqual(['weg']);
    expect(Object.keys(d.behalten).sort()).toEqual(['heute', soll[1].uid].sort());
  });
  it('Prüf-Fund 11.10.: mehr als drei Uhrzeiten → EIN Block je Tag (zur ersten Uhrzeit); bis drei je Uhrzeit einer', () => {
    const acht = { ...laufen, regel: undefined, uhrzeiten: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '21:00'] };
    const s8 = blockSoll('pia', [acht], {}, HEUTE);
    expect(s8).toHaveLength(KALENDER_FENSTER_TAGE);
    expect(new Set(s8.map(b => b.uhr))).toEqual(new Set(['08:00']));
    const drei = blockSoll('pia', [{ ...acht, uhrzeiten: ['08:00', '12:00', '18:00'] }], {}, HEUTE);
    expect(drei).toHaveLength(KALENDER_FENSTER_TAGE * KALENDER_UHRZEITEN_MAX);
  });
  it('Prüf-Fund 11.10.: heute noch nicht begonnene eigene Blöcke werden mit entfernt; verstrichene heute nicht neu angelegt', () => {
    const uid = (tag: string, uhr: string) => routineBlockUid('pia', 'laufen', tag, uhr);
    expect(uhrAusBlockUid(uid(HEUTE, '07:00'))).toBe('07:00');
    expect(uhrAusBlockUid('weg')).toBeNull();
    const bestand = { [uid(HEUTE, '07:00')]: { r: 'laufen', tag: HEUTE }, [uid(HEUTE, '18:00')]: { r: 'laufen', tag: HEUTE } };
    // Schalter aus um 09:00: der 07:00-Block hat begonnen bzw. ist vorbei → bleibt; 18:00 ist noch nicht dran → weg.
    const d = blockDiff([], bestand, HEUTE, '09:00');
    expect(d.entfernen).toEqual([uid(HEUTE, '18:00')]);
    expect(Object.keys(d.behalten)).toEqual([uid(HEUTE, '07:00')]);
    // Ohne Uhrzeit wie bisher: heute bleibt alles.
    expect(blockDiff([], bestand, HEUTE).entfernen).toEqual([]);
    // Anlegen: der heutige 07:00-Block ist um 09:00 verstrichen — nicht mehr neu.
    expect(blockDiff(blockSoll('pia', [laufen], {}, HEUTE), {}, HEUTE, '09:00').anlegen.map(b => b.tag)).toEqual(['2026-10-15', '2026-10-19', '2026-10-22']);
  });
  it('Prüf-Fund 11.10.: Aktiv/Kalender/Uhrzeit in der Liste ändern stößt den Abgleich an — nur bei Routinen mit Kalender', () => {
    expect(kalenderBetroffen({ kalender: true }, { aktiv: false })).toBe(true);
    expect(kalenderBetroffen({}, { kalender: true })).toBe(true);
    expect(kalenderBetroffen({ kalender: true }, { uhrzeiten: ['09:00'] })).toBe(true);
    expect(kalenderBetroffen({}, { aktiv: false })).toBe(false);
    expect(kalenderBetroffen({ kalender: true }, { rang: 3 })).toBe(false);
    const quelle = readFileSync(path.join(process.cwd(), 'components/os/RoutinenPlanerView.tsx'), 'utf8');
    expect(quelle).toMatch(/const patch = [^\n]*kalenderBetroffen\(/);
  });
  it('Prüf-Fund 11.10.: Routinen-Blöcke sind keine Termine (Glocke, Steht an, Briefing)', () => {
    const t = (id: string, x: Record<string, unknown> = {}) => ({ id: `kal|${id}`, uid: id, titel: id, start: `${HEUTE}T18:00:00`, ende: `${HEUTE}T18:30:00`, ganztags: false, wer: 'pia', kalender: 'Pia', kalenderId: 'kal', ...x });
    const liste = [t(routineBlockUid('pia', 'laufen', HEUTE, '18:00')), t('planen-1', { art: 'block', blockArt: 'routine' }), t('echt-1')];
    expect(liste.map(x => istRoutinenBlock(x))).toEqual([true, true, false]);
    expect(termineHeute(liste as unknown as Parameters<typeof termineHeute>[0], 'pia', HEUTE, `${HEUTE}T09:00:00`).map(x => x.titel)).toEqual(['echt-1']);
  });
});

describe('Vorlagen und Editor-Entwurf', () => {
  it('Vorlagen sind neutral und werden gesäubert gespeichert, wie sie gemeint sind', () => {
    expect(ROUTINEN_VORLAGEN.map(v => v.id)).toEqual(['morgen', 'abend', 'trinken', 'mobility', 'lesen']);
    expect(JSON.stringify(ROUTINEN_VORLAGEN)).not.toMatch(/kevin|malin|hyrox|psoriasis|bandscheibe|rücken/i);
    const [trinken] = vorlageAnlegen(ROUTINEN_VORLAGEN.find(v => v.id === 'trinken')!, { owner: 'pia', heute: HEUTE, rangAb: 4 });
    expect(sauberRoutine(trinken)).toMatchObject({ label: 'Wasser trinken', owner: 'pia', tagesZiel: 8, zaehlWort: 'Gläser', angelegtAm: HEUTE, rang: 4 });
    const [mob] = vorlageAnlegen(ROUTINEN_VORLAGEN.find(v => v.id === 'mobility')!, { owner: 'beide', heute: HEUTE, rangAb: 1 });
    // 3× pro Woche lässt sich als alter Rhythmus schreiben — gespeichert wird die alte Form.
    expect(sauberRoutine(mob)).toMatchObject({ kategorie: 'erholung', rhythmus: '3x-woche' });
    expect(sauberRoutine(mob)).not.toHaveProperty('regel');
  });
  it('Altbestand → Entwurf → Routine: nichts geändert = dieselbe gespeicherte Form', () => {
    const alt: Routine[] = [
      { ...basis, id: 'a', label: 'Journal' },
      { ...basis, id: 'b', label: 'Steuer', kategorie: 'business', space: 'business', owner: 'pia', rhythmus: 'jaehrlich', naechstesMal: '2027-05-31', rang: 3 },
      { ...basis, id: 'c', label: 'Sport', rhythmus: '3x-woche', owner: 'beide' },
    ];
    for (const r of alt) {
      const zurueck = sauberRoutine(routineAusEntwurf(entwurfAus(r, {}, HEUTE), r));
      expect(JSON.stringify(zurueck), r.id).toBe(JSON.stringify(sauberRoutine(r)));
    }
  });
  it('neue Regeln aus dem Entwurf; Fehler in ganzen Sätzen', () => {
    const e = entwurfAus(null, { label: 'Laufen', art: 'wochentage', tage: [4, 1], owner: 'pia', uhrzeiten: ['07:00'], kalender: true }, HEUTE);
    expect(regelAusEntwurf(e)).toEqual({ art: 'wochentage', tage: [1, 4] });
    const r = sauberRoutine(routineAusEntwurf(e, { id: 'r-n', aktiv: true, angelegtAm: HEUTE }))!;
    expect(r).toMatchObject({ regel: { art: 'wochentage', tage: [1, 4] }, uhrzeiten: ['07:00'], kalender: true, angelegtAm: HEUTE, owner: 'pia' });
    expect(entwurfFehler({ ...e, label: ' ', tage: [] })).toEqual(['Bitte einen Namen eintragen.', 'Bitte mindestens einen Wochentag wählen.']);
    expect(entwurfFehler({ ...e, owner: 'beide' })[0]).toMatch(/nur für die Routine einer Person/);
    const zaehler = sauberRoutine(routineAusEntwurf({ ...e, art: 'taeglich', tagesZiel: 1, uhrzeiten: ['08:00', '13:00', '20:00'], kalender: false }, { id: 'r-z', aktiv: true }))!;
    expect(zaehler).toMatchObject({ tagesZiel: 3, uhrzeiten: ['08:00', '13:00', '20:00'] });
    expect(zaehler).not.toHaveProperty('regel');
  });
});

describe('Server: Glocke, Handy, Kalender, Einstellung', () => {
  it('Glocke: die offene Routine mit Namen in der EIGENEN Glocke, je Bereich — nie gespeichert', async () => {
    await db.saveJson('routinen', { routinen: [
      { ...basis, id: 'tabletten', label: 'Tabletten', owner: 'pia', uhrzeiten: ['08:00', '20:00'], erinnerung: true },
      { ...basis, id: 'wochenplan', label: 'Wochenplan', owner: 'pia', space: 'business', kategorie: 'business', erinnerung: true, uhrzeiten: ['08:30'] },
      { ...basis, id: 'olaf-r', label: 'Geheim', owner: 'olaf', erinnerung: true, uhrzeiten: ['08:00'] },
    ] });
    const { meldungenSicht } = await import('@/lib/meldungen/speicher');
    const s = await meldungenSicht('pia', JETZT);
    const r = s.meldungen.filter(m => m.art === 'routine');
    expect(r.map(m => m.titel).sort()).toEqual(['Routine um 08:00: Tabletten (0 von 2)', 'Routine um 08:30: Wochenplan']);
    expect(JSON.stringify(s)).not.toContain('Geheim');
    expect((await meldungenSicht('pia', JETZT, 'privat')).meldungen.filter(m => m.art === 'routine').map(m => m.titel)).toEqual(['Routine um 08:00: Tabletten (0 von 2)']);
    expect((await meldungenSicht('pia', JETZT, 'business')).meldungen.filter(m => m.art === 'routine').map(m => m.titel)).toEqual(['Routine um 08:30: Wochenplan']);
    expect(roh('meldungen--pia') ?? '').not.toContain('Tabletten');
  });

  it('Handy: nur mit Einstellung + Einwilligung, neutral, einmal je Routine und Uhrzeit', async () => {
    const { routinenErinnerungenImTakt } = await import('@/lib/planung/routinen-takt');
    bote.gesendet.length = 0;
    expect((await routinenErinnerungenImTakt(JETZT)).gesendet).toBe(0); // Einstellung aus
    const route = (await import('@/app/api/planung/routinen-person/route')) as unknown as { GET: Handler; PATCH: Handler; POST: Handler };
    expect((await rufe(route.PATCH, 'PATCH', '/api/planung/routinen-person', dienst('pia'), { handy: true })).status).toBe(403);
    expect((await rufe(route.PATCH, 'PATCH', '/api/planung/routinen-person', sitzung('olaf'), { handy: true })).status).toBe(403); // keine Einwilligung (a)
    expect((await rufe(route.PATCH, 'PATCH', '/api/planung/routinen-person', sitzung('pia'), { handy: 'ja' })).status).toBe(400);
    const an = await rufe(route.PATCH, 'PATCH', '/api/planung/routinen-person', sitzung('pia'), { handy: true });
    expect(an.json).toMatchObject({ ok: true, handy: true });
    expect((await rufe(route.GET, 'GET', '/api/planung/routinen-person', sitzung('pia'))).json).toMatchObject({ handy: true });
    // 09:00: 08:00 liegt über 20 Min. zurück → nichts; 08:35: 08:30 (Business) und 08:00 (> 20 Min.) → nur Wochenplan.
    expect((await routinenErinnerungenImTakt(JETZT)).gesendet).toBe(0);
    const frueh = new Date('2026-10-12T06:35:00Z');
    expect((await routinenErinnerungenImTakt(frueh)).gesendet).toBe(1);
    expect(bote.gesendet).toHaveLength(1);
    expect(bote.gesendet[0]).toMatchObject({ person: 'pia', art: 'erinnerung' });
    expect(bote.gesendet[0].text).toMatch(/^Eine Routine steht an — Details in MAKE OS/);
    expect(bote.gesendet[0].text).not.toMatch(/Wochenplan|Tabletten/);
    expect((await routinenErinnerungenImTakt(frueh)).gesendet).toBe(0); // Riegel
    expect(JSON.parse(roh('routinen-person--pia')!).erinnert[HEUTE]).toEqual(['wochenplan@08:30']);
    // Ausschalten geht immer.
    expect((await rufe(route.PATCH, 'PATCH', '/api/planung/routinen-person', sitzung('pia'), { handy: false })).json).toMatchObject({ handy: false });
  });

  it('Kalender: eigene Routine → Blöcke (privat, feste UID), zweiter Lauf legt nichts doppelt an, Änderung zieht nach, aus = künftige weg', async () => {
    const { routineBloeckeAbgleichen } = await import('@/lib/planung/routinen-takt');
    const laufen = { ...basis, id: 'laufen', label: 'Laufen', owner: 'pia', kalender: true, regel: { art: 'wochentage', tage: [1, 4] }, uhrzeiten: ['07:00'], dauerMin: 45 };
    await db.saveJson('routinen', { routinen: [laufen, { ...laufen, id: 'gem', owner: 'beide' }] });
    kal.angelegt.length = 0; kal.geloescht.length = 0;
    // 09:00: der heutige 07:00-Termin ist verstrichen — er wird nicht mehr angelegt (Prüf-Fund 11.10.), die drei künftigen schon.
    expect(await routineBloeckeAbgleichen('pia', JETZT)).toEqual({ angelegt: 3, entfernt: 0 });
    expect(kal.angelegt.every(b => b.person === 'pia' && b.privat === true && b.art === 'routine' && b.startMin === 420 && b.titel === 'Laufen')).toBe(true);
    expect(await routineBloeckeAbgleichen('pia', JETZT)).toEqual({ angelegt: 0, entfernt: 0 });
    expect(await routineBloeckeAbgleichen('olaf', JETZT)).toEqual({ angelegt: 0, entfernt: 0 });
    // Uhrzeit geändert: neue Blöcke (auch heute 18:00), die künftigen alten weg.
    await db.saveJson('routinen', { routinen: [{ ...laufen, uhrzeiten: ['18:00'] }] });
    const r = await routineBloeckeAbgleichen('pia', JETZT);
    expect(r).toEqual({ angelegt: 4, entfernt: 3 });
    // Schalter aus: alle künftigen eigenen weg — auch der heutige um 18:00, der noch nicht begonnen hat (Prüf-Fund 11.10.).
    await db.saveJson('routinen', { routinen: [{ ...laufen, kalender: undefined }] });
    expect((await routineBloeckeAbgleichen('pia', JETZT)).entfernt).toBe(4);
    // Kalender nicht erreichbar: Satz, nichts festgehalten, nichts doppelt.
    await db.saveJson('routinen', { routinen: [laufen] });
    kal.fehler = 'Kein Kalender verbunden';
    const route = (await import('@/app/api/planung/routinen-person/route')) as unknown as { POST: Handler };
    const f = await rufe(route.POST, 'POST', '/api/planung/routinen-person', sitzung('pia'), { aktion: 'kalender' });
    expect(f.status).toBe(409);
    expect(f.json.error).toMatch(/Kein Kalender/);
    kal.fehler = null;
    expect((await rufe(route.POST, 'POST', '/api/planung/routinen-person', sitzung('pia'), { aktion: 'kalender' })).json).toMatchObject({ ok: true });
    expect((await rufe(route.POST, 'POST', '/api/planung/routinen-person', dienst('pia'), { aktion: 'kalender' })).status).toBe(403);
  });
});
