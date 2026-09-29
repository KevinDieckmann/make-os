// ─── Upload U1 B3 (29.09.): der Event-Spiegel im Takt schreibt nichts ungefragt in iCloud ─
// Befund des Prüfers: Beim ersten Takt nach dem Upload hätte der Spiegel alte `mac-…`-Kennungen selbst aufgelöst,
// Titel/Dauer bei jedem Takt überschrieben und Termine abgesagter Events gelöscht — ohne Klick. Jetzt:
//   · im Takt nur künftige Events mit Bezug `eventId` (von MAKE OS angelegt/verknüpft), nie `mac-…`
//   · überschrieben nur, wenn sich das Event seit dem letzten Spiegeln geändert hat (Marke am Bezug)
//   · Absage im Takt → Glocke (einmal), gelöscht wird nur per Klick (`eventSpiegelLoeschen`)
// Eigener Datenordner (vor allen Imports), iCloud und Glocke gemockt, alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-spiegel-takt-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-spiegel-takt', SESSION_SECRET: 'pruef-sitzung-spiegel-takt-nur-im-test',
    MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-sp-takt-nur-im-test', MAKE_OS_PEPPER: 'pruef-pepper-spiegel-takt-nur-im-test-0123456789abcdef',
  });
  return { ordner, objekte: new Map<string, { kal: string; ics: string; etag: string }>(), schreib: 0, meldungen: [] as { an: string; art: string; titel: string; link: string }[] };
});
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const ics = await import('@/lib/kalender/ics');
  const bz = await import('@/lib/kalender/bezug');
  const KAL = ['Testkalender', 'Malin-Kalender', 'Gemeinsam'].map(n => ({ id: `K-${n}`, name: n, schreibbar: true }));
  let n = 0;
  const stand = () => ({ at: new Date(Date.now() + n++).toISOString(), kalender: KAL, objekte: Object.fromEntries(KAL.map(k => [k.id, [...ic.objekte.entries()].filter(([, o]) => o.kal === k.name).map(([uid, o]) => ({ href: `h/${uid}`, etag: o.etag, ics: o.ics }))])) });
  return {
    ...echt, verbunden: () => true, ladeStand: async () => stand(), frischerStand: async () => stand(), abgleichen: async () => stand(),
    terminAufloesen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); return o ? { schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true } : null; },
    anlegen: async (t: { uid?: string; kalender: string; titel: string; start: string; ende: string; ganztags?: boolean; ort?: string }) => {
      const uid = t.uid!;
      if (ic.objekte.has(uid)) return { uid, schluessel: `K-${t.kalender}|${uid}`, kalender: t.kalender, schonDa: true as const };
      ic.schreib++;
      ic.objekte.set(uid, { kal: t.kalender, ics: ics.baueTermin({ uid, titel: t.titel, start: t.start, ende: t.ende, ganztags: t.ganztags, ort: t.ort }), etag: 'e0' });
      return { uid, schluessel: `K-${t.kalender}|${uid}`, kalender: t.kalender };
    },
    aendern: async (ref: string, a: import('@/lib/kalender/ics').Aenderung) => {
      const uid = bz.uidVonSchluessel(ref);
      const o = ic.objekte.get(uid)!;
      const r = ics.aendereTermin(o.ics, a);
      if ('fehler' in r) throw new echt.KalenderFehler(r.fehler, 400);
      ic.schreib++;
      ic.objekte.set(uid, { ...o, ics: r.ics, etag: `e${ic.schreib}` });
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
    loeschen: async (ref: string) => {
      const uid = bz.uidVonSchluessel(ref);
      const o = ic.objekte.get(uid); if (!o) return { gaeste: 0 };
      ic.schreib++;
      ic.objekte.delete(uid);
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
  };
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string; link: string }) => { ic.meldungen.push(m); } }));

import * as db from '@/lib/store/local-db';
import * as sp from '@/lib/kalender/spiegel-server';
import { spiegelSchritt, spiegelMarke, eventSoll, MARKE_WEG } from '@/lib/kalender/spiegel';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { baueTermin } from '@/lib/kalender/ics';

const T0 = new Date('2026-10-05T06:00:00Z');
const WER = { art: 'person' as const, person: 'kevin' };
const ev = (x: Record<string, unknown>) => ({ titel: 'Stammtisch', format: 'stammtisch', ziel: 'x', datum: '2026-10-10', uhrzeit: '18:30', ort: 'Probehaus', status: 'geplant', geaendert: T0.toISOString(), ...x });
const takt = async (plusMin: number) => { sp.spiegelTaktZuruecksetzen(); return sp.eventSpiegelImTakt(T0.getTime() + plusMin * 60_000); };
const setze = (id: string, teil: Record<string, unknown>) => aendereCrm(b => ({ ...b, events: b.events.map(e => (e.id === id ? { ...e, ...teil } : e)) }), { art: 'system' });
const ics = (uid: string) => ic.objekte.get(uid)?.ics ?? '';

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0);
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'K', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus-takt' },
    { id: 'k2', speicher: 'malin', email: 'm@example.invalid', name: 'M', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus-takt' },
  ], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
});
afterAll(() => { vi.useRealTimers(); rmSync(ic.ordner, { recursive: true, force: true }); });

describe('spiegelSchritt (rein)', () => {
  const soll = eventSoll(ev({}));
  const m = spiegelMarke(soll)!;
  it('fremd → nichts; ohne Marke → merken; gleiche Marke → nichts; geändert → ändern; Klick → ändern', () => {
    expect(spiegelSchritt(soll, m, { bekannt: false, loeschenErlaubt: true })).toBe('nichts');
    expect(spiegelSchritt(soll, undefined, { bekannt: true, loeschenErlaubt: false })).toBe('merken');
    expect(spiegelSchritt(soll, m, { bekannt: true, loeschenErlaubt: false })).toBe('nichts');
    expect(spiegelSchritt(eventSoll(ev({ datum: '2026-10-11' })), m, { bekannt: true, loeschenErlaubt: false })).toBe('aendern');
    expect(spiegelSchritt(soll, m, { bekannt: false, erzwingen: true, loeschenErlaubt: false })).toBe('aendern');
  });
  it('abgesagt: Person → löschen; Takt → melden, danach (Marke weg) nichts; fremd → nichts', () => {
    const weg = eventSoll(ev({ status: 'abgesagt' }));
    expect(spiegelSchritt(weg, m, { bekannt: true, loeschenErlaubt: true })).toBe('loeschen');
    expect(spiegelSchritt(weg, m, { bekannt: true, loeschenErlaubt: false })).toBe('melden');
    expect(spiegelSchritt(weg, MARKE_WEG, { bekannt: true, loeschenErlaubt: false })).toBe('nichts');
    expect(spiegelSchritt(weg, m, { bekannt: false, loeschenErlaubt: true })).toBe('nichts');
  });
  it('die Marke enthält keinen Titel', () => {
    expect(m).toMatch(/^s[a-z0-9]+$/);
    expect(m).not.toMatch(/stammtisch/i);
  });
});

describe('Takt nach dem Upload', () => {
  it('erster Takt: alte `mac-…`-Kennung, fremde echte UID ohne Bezug, vergangenes Event → nichts geschrieben', async () => {
    ic.objekte.set('ALT-1', { kal: 'Gemeinsam', ics: baueTermin({ uid: 'ALT-1', titel: 'Workshop', start: '2026-10-12T10:00:00', ende: '2026-10-12T12:00:00' }), etag: 'e0' });
    ic.objekte.set('APPLE-FREMD', { kal: 'Gemeinsam', ics: baueTermin({ uid: 'APPLE-FREMD', titel: 'Anders in Apple', start: '2026-10-14T09:00:00', ende: '2026-10-14T10:00:00' }), etag: 'e0' });
    ic.objekte.set('makeos-event-ev-alt', { kal: 'Gemeinsam', ics: baueTermin({ uid: 'makeos-event-ev-alt', titel: 'Vergangen', start: '2026-10-01T18:30:00', ende: '2026-10-01T21:30:00' }), etag: 'e0' });
    await db.saveJson('kalender-bezug', { bezuege: { 'K-Gemeinsam|makeos-event-ev-alt': { eventId: 'ev-alt', geaendert: T0.toISOString() } } });
    await db.saveJson('crm', { events: [
      ev({ id: 'ev-mac', titel: 'Workshop', datum: '2026-10-12', uhrzeit: '10:00', kalenderUid: 'mac-0f3c' }),
      ev({ id: 'ev-fremd', datum: '2026-10-14', uhrzeit: '09:00', kalenderUid: 'APPLE-FREMD' }),
      ev({ id: 'ev-alt', datum: '2026-10-02', kalenderUid: 'makeos-event-ev-alt' }),
    ] });
    const vorher = new Map(ic.objekte);
    await takt(0);
    expect(ic.schreib).toBe(0);
    expect(ic.objekte).toEqual(vorher);
    expect((await ladeCrm()).events.map(e => e.kalenderUid)).toEqual(['mac-0f3c', 'APPLE-FREMD', 'makeos-event-ev-alt']);
    expect(ic.meldungen).toEqual([]);
  });

  it('eigener Spiegel: Apple-Änderung bleibt stehen, bis sich das Event ändert', async () => {
    await aendereCrm(b => ({ ...b, events: [...b.events, ev({ id: 'ev-1', zustaendig: 'malin' }) as never] }), WER);
    const { uid } = await sp.eventSpiegelAnlegen('ev-1', 'kevin', WER);
    const nachAnlegen = ic.schreib;
    expect(await takt(30)).toBe(2); // ev-1 und ev-fremd (künftig, echte UID) geprüft — geschrieben wird nichts
    expect(ic.schreib).toBe(nachAnlegen); // Marke gleich → nichts
    // Jemand benennt den Termin in Apple um — der Takt überschreibt das nicht.
    ic.objekte.set(uid, { ...ic.objekte.get(uid)!, ics: ics(uid).replace('SUMMARY:Stammtisch', 'SUMMARY:Stammtisch (Tisch 4)') });
    await takt(60);
    expect(ics(uid)).toContain('SUMMARY:Stammtisch (Tisch 4)');
    expect(ic.schreib).toBe(nachAnlegen);
    // Das Event ändert sich (z. B. über ZOE, ohne Bestand-PATCH) → der Takt zieht nach.
    await setze('ev-1', { datum: '2026-10-17' });
    await takt(90);
    expect(ics(uid)).toMatch(/DTSTART;TZID=Europe\/Berlin:20261017T183000/);
    expect(ic.schreib).toBe(nachAnlegen + 1);
    await takt(120);
    expect(ic.schreib).toBe(nachAnlegen + 1);
  });

  it('Absage im Takt: kein Löschen, eine Glocke an die Zuständige; Löschen erst per Klick', async () => {
    const uid = 'makeos-event-ev-1';
    await setze('ev-1', { status: 'abgesagt' });
    const vorher = ic.schreib;
    await takt(150);
    await takt(180);
    expect(ic.objekte.has(uid)).toBe(true);
    expect(ic.schreib).toBe(vorher);
    expect(ic.meldungen).toEqual([{ an: 'malin', art: 'kalender', titel: expect.stringMatching(/ist abgesagt — der Termin steht noch im Kalender/), link: expect.stringContaining('ev-1') }]);
    await expect(sp.eventSpiegelLoeschen('ev-mac', WER)).rejects.toThrow(/abgesagten/);
    expect(await sp.eventSpiegelLoeschen('ev-1', WER)).toEqual({ geloescht: true });
    expect(ic.objekte.has(uid)).toBe(false);
    expect((await ladeCrm()).events.find(e => e.id === 'ev-1')?.kalenderUid).toBeUndefined();
  });

  it('Absage durch eine Person (Bestand-PATCH) löscht wie bisher', async () => {
    await aendereCrm(b => ({ ...b, events: [...b.events, ev({ id: 'ev-2', datum: '2026-10-20' }) as never] }), WER);
    const { uid } = await sp.eventSpiegelAnlegen('ev-2', 'kevin', WER);
    await setze('ev-2', { status: 'abgesagt' });
    const r = await sp.eventSpiegelNachziehen(['ev-2'], WER);
    expect(r.abgesagt).toEqual([]);
    expect(ic.objekte.has(uid)).toBe(false);
  });
});
