// Kalender K5 (29.09.) — Server-Abläufe mit gemocktem iCloud (echte ICS-Texte, nie ein Netzaufruf): Übernahme der alten
// Wochenplan-Blöcke (Vorschau, Archivkopie, Absichtsprotokoll, Abbruch nach Schritten, idempotent), Blöcke lesen,
// Spiegel von Make.One-Events und Familien-Terminen (echte feste UID, nachziehen, absagen, alte Schein-Kennung).
// Eigener Datenordner, erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-k5-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-k5';
process.env.SESSION_SECRET = 'pruef-sitzung-k5-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-k5-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-k5-nur-im-test-0123456789abcdef';

// ── iCloud gemockt: ein Stand aus echten ICS-Texten im Speicher dieses Tests ──
const ic = vi.hoisted(() => ({ objekte: new Map<string, { kal: string; ics: string; etag: string }>(), angelegt: 0, geaendert: 0, geloescht: 0 }));
/** Jeder Stand hat seinen eigenen Zeitpunkt (wie nach jedem echten Abgleich) — der Termin-Zwischenspeicher hängt daran. */
function fassung(): string {
  let h = 5381;
  for (const [uid, o] of ic.objekte) for (const c of `${uid}|${o.kal}|${o.ics}`) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return new Date(Date.UTC(2026, 9, 5, 6, 0, 0) + (h % 3_600_000)).toISOString();
}
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const ics = await import('@/lib/kalender/ics');
  const bz = await import('@/lib/kalender/bezug');
  const KAL = ['Testkalender', 'Malin-Kalender', 'Gemeinsam'].map(n => ({ id: `K-${n}`, name: n, schreibbar: true }));
  const stand = () => ({ at: fassung(), kalender: KAL, objekte: Object.fromEntries(KAL.map(k => [k.id, [...ic.objekte.entries()].filter(([, o]) => o.kal === k.name).map(([uid, o]) => ({ href: `h/${uid}`, etag: o.etag, ics: o.ics }))])) });
  return {
    ...echt,
    verbunden: () => true,
    ladeStand: async () => stand(),
    frischerStand: async () => stand(),
    abgleichen: async () => stand(),
    terminBekannt: async (uid: string) => ic.objekte.has(uid),
    // R-K1 #46: Schlüssel = Kalender-Kennung + UID (hier `K-<Name>|<uid>`); der Verweis darf beide Formen haben.
    terminAufloesen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); return o ? { schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true } : null; },
    anlegen: async (e: import('@/lib/kalender/icloud').NeuEingabe) => {
      const { kalender, uid: fest, ...rest } = e;
      if (fest && ic.objekte.has(fest)) return { uid: fest, schluessel: `K-${ic.objekte.get(fest)!.kal}|${fest}`, kalender, gaeste: 0, schonDa: true as const };
      ic.angelegt++;
      const uid = fest ?? `UID-K5-${ic.angelegt}`;
      ic.objekte.set(uid, { kal: kalender, ics: ics.baueTermin({ uid, ...rest }, new Date()), etag: 'e0' });
      return { uid, schluessel: `K-${kalender}|${uid}`, kalender, gaeste: 0 };
    },
    aendern: async (ref: string, a: import('@/lib/kalender/ics').Aenderung) => {
      const uid = bz.uidVonSchluessel(ref);
      const o = ic.objekte.get(uid);
      if (!o) throw new echt.KalenderFehler('Termin nicht gefunden.', 404);
      const r = ics.aendereTermin(o.ics, a);
      if ('fehler' in r) throw new echt.KalenderFehler(r.fehler, 400);
      ic.geaendert++;
      ic.objekte.set(uid, { ...o, ics: r.ics, etag: `e${ic.geaendert}` });
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
    loeschen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); if (!o) return { gaeste: 0 }; ic.objekte.delete(uid); ic.geloescht++; return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true }; },
  };
});

const HAUS = 'test-haus';
const T0 = new Date('2026-10-05T06:00:00Z'); // Mo 08:00 Berlin
const WER = { art: 'person' as const, person: 'kevin' };
let db: typeof import('@/lib/store/local-db');
let ab: typeof import('@/lib/store/absichten');
let ue: typeof import('@/lib/planung/wochenplan-uebernahme-server');
let bl: typeof import('@/lib/planung/bloecke-server');
let sp: typeof import('@/lib/kalender/spiegel-server');

const ALT_KEVIN = {
  '2026-09-28': [{ id: 'pb-alt', date: '2026-10-01', startMin: 540, dauerMin: 60, titel: 'Fokus alt', art: 'fokus' }],
  '2026-10-05': [
    { id: 'pb-1', date: '2026-10-06', startMin: 540, dauerMin: 90, titel: 'Fokus Angebot', art: 'fokus', appleUid: 'APPLE-1' },
    { id: 'pb-2', date: '2026-10-07', startMin: 600, dauerMin: 60, titel: 'Aufgabe Probe', art: 'aufgabe', taskId: 't-1', appleUid: 'APPLE-WEG' },
    { id: 'pb-3', date: '2026-10-08', startMin: 450, dauerMin: 30, titel: 'Reha / Rücken', art: 'reha' },
  ],
};
const ALT_MALIN = { '2026-10-05': [{ id: 'pb-m', date: '2026-10-09', startMin: 480, dauerMin: 60, titel: 'Fokus Malin', art: 'fokus' }] };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  ab = await import('@/lib/store/absichten');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'Kevin Test', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'Malin Test', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  await db.saveJson('wochenplan', ALT_KEVIN);
  await db.saveJson('wochenplan--malin', ALT_MALIN);
  // Die alte Apple-Kopie von pb-1 (ein gewöhnlicher Termin, ohne Art).
  const ics = await import('@/lib/kalender/ics');
  ic.objekte.set('APPLE-1', { kal: 'Testkalender', ics: ics.baueTermin({ uid: 'APPLE-1', titel: 'Fokus Angebot', start: '2026-10-06T09:00:00', ende: '2026-10-06T10:30:00' }), etag: 'e0' });
  ue = await import('@/lib/planung/wochenplan-uebernahme-server');
  bl = await import('@/lib/planung/bloecke-server');
  sp = await import('@/lib/kalender/spiegel-server');
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('Übernahme der Wochenplan-Blöcke', () => {
  it('vorher: die alten Blöcke bleiben lesbar (Archiv, künftige „wartet“) — nichts verschwindet', async () => {
    const b = await bl.planBloeckeLesen({ person: 'kevin', von: '2026-09-28', bis: '2026-10-12' });
    expect(b.map(x => [x.id, x.quelle, !!(x as { wartet?: true }).wartet])).toEqual([
      ['archiv:kevin:pb-alt', 'archiv', false], ['archiv:kevin:pb-1', 'archiv', true], ['archiv:kevin:pb-2', 'archiv', true], ['archiv:kevin:pb-3', 'archiv', true],
    ]);
  });

  it('Vorschau je Person: künftige (davon mit Apple-Kopie), vergangene, Beispiele', async () => {
    const v = await ue.uebernahmeVorschau();
    expect(v).toMatchObject({ icloud: true, offen: 4 });
    expect(v.personen.find(p => p.person === 'kevin')).toMatchObject({ zukuenftig: 3, mitApple: 1, vergangen: 1, schon: 0 });
    expect(v.personen.find(p => p.person === 'malin')).toMatchObject({ zukuenftig: 1, vergangen: 0 });
  });

  it('Abbruch nach einem Block (vor dem Abhaken) und nach dem Abschluss — die Wiederaufnahme legt nichts doppelt an', async () => {
    ab.absichtTest.vorAbhaken = (art, name) => { if (art === 'wochenplan-uebernahme' && name === 'b:kevin:pb-2') throw new ab.TestAbbruch(name); };
    await expect(ue.uebernahmeAusfuehren(HAUS, 'kevin')).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.vorAbhaken = null;
    ab.absichtTest.nachAbhaken = (art, name) => { if (art === 'wochenplan-uebernahme' && name === 'abschluss') throw new ab.TestAbbruch(name); };
    await expect(ue.uebernahmeAusfuehren(HAUS, 'kevin')).rejects.toThrow(/Testabbruch/);
    ab.absichtTest.nachAbhaken = null;
    const r = await ue.uebernahmeAusfuehren(HAUS, 'kevin');
    expect(r.ok).toBe(true);
    // pb-1 wurde die vorhandene Apple-Kopie (keine zweite), pb-2 (Kopie weg), pb-3, pb-m neu — je genau einmal.
    expect(ic.angelegt).toBe(3);
    expect(ic.objekte.size).toBe(4);
    expect(ic.objekte.get('APPLE-1')!.ics).toContain('X-MAKE-ART:fokus');
    const pb3 = [...ic.objekte.entries()].find(([uid]) => uid === 'makeos-wochenplan-kevin-pb-3')!;
    expect(pb3[1].ics).toContain('X-MAKE-BLOCK:reha');
    expect(pb3[1].kal).toBe('Testkalender');
    expect(ic.objekte.get('makeos-wochenplan-malin-pb-m')!.kal).toBe('Malin-Kalender');
    const absichten = await ab.absichtenLaden(HAUS);
    expect(absichten.filter(a => a.art === 'wochenplan-uebernahme').map(a => a.status)).toEqual(['fertig']);
  });

  it('Archivkopie liegt vor, der alte Bestand ist unverändert, der Stand hält nur Kennungen', async () => {
    expect(readdirSync(path.join(ordner, 'archiv')).some(n => n.startsWith('wochenplan-vor-uebernahme-'))).toBe(true);
    expect(await db.loadJson('wochenplan')).toEqual(ALT_KEVIN);
    const s = await ue.ladeUebernahme();
    expect(s.personen.kevin.bloecke).toEqual({ 'pb-1': 'APPLE-1', 'pb-2': 'makeos-wochenplan-kevin-pb-2', 'pb-3': 'makeos-wochenplan-kevin-pb-3' });
    expect(s.personen.malin.am).toBeTruthy();
    expect(JSON.stringify(s)).not.toMatch(/Fokus|Reha|Aufgabe Probe/);
  });

  it('danach: Blöcke kommen aus dem Kalender (Art, Unterart, verknüpfte Aufgabe) + Archiv der vergangenen', async () => {
    const b = await bl.planBloeckeLesen({ person: 'kevin', von: '2026-09-28', bis: '2026-10-12' });
    expect(b.map(x => [x.date, x.art, x.quelle, x.taskId ?? null])).toEqual([
      ['2026-10-01', 'fokus', 'archiv', null], ['2026-10-06', 'fokus', 'kalender', null], ['2026-10-07', 'aufgabe', 'kalender', 't-1'], ['2026-10-08', 'reha', 'kalender', null],
    ]);
    expect((await bl.planBloeckeLesen({ person: 'malin', von: '2026-10-05', bis: '2026-10-12' })).map(x => x.titel)).toEqual(['Fokus Malin']);
  });

  it('ein zweiter Lauf tut nichts', async () => {
    const vorher = ic.angelegt;
    const r = await ue.uebernahmeAusfuehren(HAUS, 'kevin');
    expect(r).toMatchObject({ ok: true, uebernommen: 0 });
    expect(ic.angelegt).toBe(vorher);
    expect((await ue.uebernahmeVorschau()).offen).toBe(0);
  });

  it('ZOE legt einen Block im Kalender der Person an (mit Protokoll, ohne Rückfall auf „kevin“)', async () => {
    const r = await bl.blockAnlegen('malin', { date: '2026-10-09', startMin: 600, dauerMin: 30, titel: 'Pause', art: 'pause' }, { art: 'zoe', person: 'malin' });
    expect(ic.objekte.get(r.uid)!.kal).toBe('Malin-Kalender');
    await expect(bl.blockAnlegen('gast', { date: '2026-10-09', startMin: 600, dauerMin: 30, titel: 'x', art: 'block' }, { art: 'zoe', person: 'gast' })).rejects.toThrow(/keinen eigenen Kalender/);
  });
});

describe('Spiegel: Make.One-Event', () => {
  const ev = (x: Record<string, unknown> = {}) => ({ id: 'ev-1', titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-10', uhrzeit: '18:30', ort: 'Probehaus', status: 'geplant', geaendert: T0.toISOString(), ...x });
  const crm = async () => (await import('@/lib/crm/speicher')).ladeCrm();
  const setzeEvent = async (teil: Record<string, unknown>, id = 'ev-1') => (await import('@/lib/crm/speicher')).aendereCrm(b => ({ ...b, events: b.events.map(e => (e.id === id ? { ...e, ...teil } : e)) }), WER);

  it('anlegen: echter Termin (feste UID) im Kalender „Gemeinsam“, Ort als Feld, Bezug eventId — zweimal = einmal', async () => {
    await db.saveJson('crm', { events: [ev(), ev({ id: 'ev-2', titel: 'Workshop', datum: '2026-10-12', uhrzeit: '10:00', kalenderUid: 'mac-0f3c' })] });
    const vorher = ic.angelegt;
    const r = await sp.eventSpiegelAnlegen('ev-1', 'kevin', WER);
    expect(r.uid).toBe('makeos-event-ev-1');
    const o = ic.objekte.get(r.uid)!;
    expect(o.kal).toBe('Gemeinsam');
    expect(o.ics).toMatch(/LOCATION:Probehaus/);
    expect(o.ics).toMatch(/DTSTART;TZID=Europe\/Berlin:20261010T183000/);
    expect((await crm()).events.find(e => e.id === 'ev-1')?.kalenderUid).toBe('makeos-event-ev-1');
    const bezug = await db.loadJson<{ bezuege: Record<string, { eventId?: string }> }>('kalender-bezug');
    expect(bezug?.bezuege['K-Gemeinsam|makeos-event-ev-1']?.eventId).toBe('ev-1');
    await sp.eventSpiegelAnlegen('ev-1', 'kevin', WER);
    expect(ic.angelegt).toBe(vorher + 1);
    expect(await sp.eventSpiegelLage('ev-1')).toMatchObject({ lage: 'da', uid: 'makeos-event-ev-1' });
  });

  it('Datum im Event geändert → der Termin zieht nach; abgesagt → Termin weg, Kennung weg', async () => {
    await setzeEvent({ datum: '2026-10-17' });
    await sp.eventSpiegelNachziehen(['ev-1'], WER);
    expect(ic.objekte.get('makeos-event-ev-1')!.ics).toMatch(/DTSTART;TZID=Europe\/Berlin:20261017T183000/);
    await setzeEvent({ status: 'abgesagt' });
    await sp.eventSpiegelNachziehen(['ev-1'], WER);
    expect(ic.objekte.has('makeos-event-ev-1')).toBe(false);
    expect((await crm()).events.find(e => e.id === 'ev-1')?.kalenderUid).toBeUndefined();
  });

  it('alte Schein-Kennung (Befund 4): der eindeutige Termin am Tag wird verknüpft, nicht doppelt angelegt', async () => {
    const ics = await import('@/lib/kalender/ics');
    ic.objekte.set('ALT-WS', { kal: 'Gemeinsam', ics: ics.baueTermin({ uid: 'ALT-WS', titel: 'Workshop · Probehaus', start: '2026-10-12T10:00:00', ende: '2026-10-12T13:00:00' }), etag: 'e0' });
    expect(await sp.eventSpiegelLage('ev-2')).toMatchObject({ lage: 'schein' });
    const vorher = ic.angelegt;
    await sp.eventSpiegelNachziehen(['ev-2'], WER);
    expect(ic.angelegt).toBe(vorher);
    expect((await crm()).events.find(e => e.id === 'ev-2')?.kalenderUid).toBe('ALT-WS');
    expect(ic.objekte.get('ALT-WS')!.ics).toMatch(/SUMMARY:Workshop\r?\n/);
    const bezug = await db.loadJson<{ bezuege: Record<string, { eventId?: string }> }>('kalender-bezug');
    expect(bezug?.bezuege['K-Gemeinsam|ALT-WS']?.eventId).toBe('ev-2');
  });
});

describe('Spiegel: Familie (Date, Paar-Gespräch)', () => {
  const h = HAUS;
  const fam = async () => (await import('@/lib/familie/speicher')).ladeFamilie(h);
  const aendern = async (f: (x: import('@/lib/familie/typen').Familie) => import('@/lib/familie/typen').Familie) => db.updateJson<import('@/lib/familie/typen').Familie>(`familie--${h}`, cur => f(cur!));

  it('Date und Gespräch in den gemeinsamen Kalender — UID merkt der Server', async () => {
    const { startBestand } = await import('@/lib/familie/speicher');
    await db.saveJson(`familie--${h}`, { ...startBestand(T0.toISOString()), dates: [{ id: 'd-1', titel: 'Kino', ideeId: null, datum: '2026-10-09', planer: 'kevin', status: 'geplant', neuesErlebnis: false, nachklang: [], von: 'kevin', am: T0.toISOString() }] });
    const d = await sp.familieSpiegelAnlegen(h, 'date', 'd-1', 'kevin', WER);
    expect(d.uid).toBe('makeos-date-d-1');
    expect(ic.objekte.get(d.uid)!.ics).toMatch(/DTSTART;VALUE=DATE:20261009/);
    expect((await fam()).dates[0].kalenderUid).toBe('makeos-date-d-1');
    const g = await sp.familieSpiegelAnlegen(h, 'gespraech', '2026-10-11', 'kevin', WER);
    expect(g.uid).toBe(`makeos-gespraech-${h}-2026-10-11`);
    expect((await fam()).einstellungen.kalenderTermine).toEqual({ '2026-10-11': g.uid });
  });

  it('verschoben / neue Uhrzeit / anderer Wochentag → nachziehen; abgesagt → weg', async () => {
    await aendern(x => ({ ...x, dates: x.dates.map(d => ({ ...d, datum: '2026-10-10' })), einstellungen: { ...x.einstellungen, gespraech: { ...x.einstellungen.gespraech, uhrzeit: '20:00' } } }));
    await sp.familieSpiegelNachziehen(h, WER);
    expect(ic.objekte.get('makeos-date-d-1')!.ics).toMatch(/DTSTART;VALUE=DATE:20261010/);
    const guid = `makeos-gespraech-${h}-2026-10-11`;
    expect(ic.objekte.get(guid)!.ics).toMatch(/DTSTART;TZID=Europe\/Berlin:20261011T200000/);
    // Wochentag Donnerstag → das nächste Gespräch ist der 08.10. — der gemerkte Termin zieht um.
    await aendern(x => ({ ...x, einstellungen: { ...x.einstellungen, gespraech: { ...x.einstellungen.gespraech, wochentag: 4 } } }));
    await sp.familieSpiegelNachziehen(h, WER);
    expect((await fam()).einstellungen.kalenderTermine).toEqual({ '2026-10-08': guid });
    expect(ic.objekte.get(guid)!.ics).toMatch(/DTSTART;TZID=Europe\/Berlin:20261008T200000/);
    await aendern(x => ({ ...x, dates: x.dates.map(d => ({ ...d, status: 'abgesagt' as const })) }));
    await sp.familieSpiegelNachziehen(h, WER);
    expect(ic.objekte.has('makeos-date-d-1')).toBe(false);
    expect((await fam()).dates[0].kalenderUid).toBeUndefined();
  });
});
