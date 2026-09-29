// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.) #5: Spiegel nachziehen — je Eintrag abgefangen, Teilergebnis gespeichert,
// Hinweise statt Stille. Ein Event/Date, dessen Termin sich nicht ändern lässt (iCloud lehnt ab), hält die übrigen
// nicht auf; der Hinweis nennt Kennung + Grund, nie Titel; mit auslösender Person landet er in ihrer Glocke.
// Eigener Datenordner, iCloud gemockt (Objekte als echtes ICS), Glocke gemockt, alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-spiegel-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-f1-spiegel';
process.env.SESSION_SECRET = 'pruef-sitzung-f1-spiegel-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f1-sp-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-f1-spiegel-nur-im-test-0123456789abcdef';

const ic = vi.hoisted(() => ({ objekte: new Map<string, { kal: string; ics: string; etag: string }>(), scheitert: new Set<string>(), meldungen: [] as { an: string; art: string; titel: string }[] }));
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const ics = await import('@/lib/kalender/ics');
  const bz = await import('@/lib/kalender/bezug');
  const KAL = ['Testkalender', 'Malin-Kalender', 'Gemeinsam'].map(n => ({ id: `K-${n}`, name: n, schreibbar: true }));
  const stand = () => ({ at: new Date().toISOString(), kalender: KAL, objekte: Object.fromEntries(KAL.map(k => [k.id, [...ic.objekte.entries()].filter(([, o]) => o.kal === k.name).map(([uid, o]) => ({ href: `h/${uid}`, etag: o.etag, ics: o.ics }))])) });
  return {
    ...echt, verbunden: () => true, ladeStand: async () => stand(), frischerStand: async () => stand(), abgleichen: async () => stand(),
    terminAufloesen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); return o ? { schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true } : null; },
    aendern: async (ref: string, a: import('@/lib/kalender/ics').Aenderung) => {
      const uid = bz.uidVonSchluessel(ref);
      if (ic.scheitert.has(uid)) throw new echt.KalenderKonflikt('Der Termin wurde inzwischen woanders geändert — deine Fassung ist unten noch da.', null);
      const o = ic.objekte.get(uid)!;
      const r = ics.aendereTermin(o.ics, a);
      if ('fehler' in r) throw new echt.KalenderFehler(r.fehler, 400);
      ic.objekte.set(uid, { ...o, ics: r.ics, etag: 'e1' });
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
    loeschen: async (ref: string) => {
      const uid = bz.uidVonSchluessel(ref);
      if (ic.scheitert.has(uid)) throw new echt.KalenderFehler('iCloud hat den Termin nicht gelöscht (503).', 502);
      const o = ic.objekte.get(uid); if (!o) return { gaeste: 0 };
      ic.objekte.delete(uid);
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
  };
});
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; art: string; titel: string }) => { ic.meldungen.push(m); } }));

const HAUS = 'test-haus-f1-sp';
const WER = { art: 'person' as const, person: 'kevin' };
let db: typeof import('@/lib/store/local-db');
let sp: typeof import('@/lib/kalender/spiegel-server');
const dtstart = (uid: string) => /DTSTART[^\r\n]*/.exec(ic.objekte.get(uid)!.ics.slice(ic.objekte.get(uid)!.ics.indexOf('BEGIN:VEVENT')))?.[0] ?? '';

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T06:00:00Z'));
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'K', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS }], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  const ics = await import('@/lib/kalender/ics');
  for (const [uid, start, ende] of [['makeos-event-ev-a', '2026-10-10T18:30:00', '2026-10-10T21:30:00'], ['makeos-event-ev-b', '2026-10-11T18:30:00', '2026-10-11T21:30:00']] as const) {
    ic.objekte.set(uid, { kal: 'Gemeinsam', ics: ics.baueTermin({ uid, titel: 'Stammtisch Geheim', start, ende, ort: 'Probehaus' }), etag: 'e0' });
  }
  ic.objekte.set('makeos-date-d-1', { kal: 'Gemeinsam', ics: ics.baueTermin({ uid: 'makeos-date-d-1', titel: 'Date', start: '2026-10-09', ende: '2026-10-10', ganztags: true }), etag: 'e0' });
  ic.objekte.set('makeos-date-d-2', { kal: 'Gemeinsam', ics: ics.baueTermin({ uid: 'makeos-date-d-2', titel: 'Date', start: '2026-10-12', ende: '2026-10-13', ganztags: true }), etag: 'e0' });
  // U1 B3: nur Spiegel mit Bezug (von MAKE OS angelegt) werden nachgezogen — und nur, wenn sich das Modul seit der
  // Marke geändert hat. Hier: alte Marke `salt`, damit das Nachziehen schreibt.
  const b = (x: Record<string, string>) => ({ ...x, spiegel: 'salt', geaendert: '2026-10-01T00:00:00Z' });
  await db.saveJson('kalender-bezug', { bezuege: {
    'K-Gemeinsam|makeos-event-ev-a': b({ eventId: 'ev-a' }), 'K-Gemeinsam|makeos-event-ev-b': b({ eventId: 'ev-b' }),
    'K-Gemeinsam|makeos-date-d-1': b({ von: 'kevin' }), 'K-Gemeinsam|makeos-date-d-2': b({ von: 'kevin' }),
  } });
  sp = await import('@/lib/kalender/spiegel-server');
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('F1 #5 Spiegel: je Eintrag abgefangen, Hinweise statt Stille', () => {
  it('Events: ev-a scheitert (Konflikt), ev-b zieht trotzdem nach; Hinweis ohne Titel, Glocke an die Person', async () => {
    const ev = (id: string, datum: string) => ({ id, titel: 'Stammtisch Geheim', format: 'stammtisch', ziel: 'x', datum, uhrzeit: '18:30', ort: 'Probehaus', status: 'geplant', geaendert: new Date().toISOString(), kalenderUid: `makeos-event-${id}` });
    await db.saveJson('crm', { events: [ev('ev-a', '2026-10-17'), ev('ev-b', '2026-10-18')] });
    ic.scheitert.add('makeos-event-ev-a');
    const r = await sp.eventSpiegelNachziehen(null, WER);
    expect(r.geprueft).toBe(2);
    expect(dtstart('makeos-event-ev-b')).toContain('20261018T183000'); // der zweite lief durch
    expect(dtstart('makeos-event-ev-a')).toContain('20261010T183000'); // der erste blieb, wie er war
    expect(r.hinweise).toEqual([{ art: 'event', id: 'ev-a', grund: expect.stringMatching(/woanders geändert/) }]);
    expect(JSON.stringify(r.hinweise)).not.toMatch(/Stammtisch|Probehaus/);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await sp.spiegelHinweiseMelden(r.hinweise, 'kevin');
    expect(warn.mock.calls.flat().join(' ')).toMatch(/event:ev-a/);
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/Stammtisch|Probehaus/);
    warn.mockRestore();
    expect(ic.meldungen).toEqual([{ an: 'kevin', art: 'kalender', titel: expect.stringMatching(/1 Kalender-Termin \(Event\) ließ sich nicht nachziehen/), link: '/os/kalender' }]);
    ic.scheitert.clear();
  });

  it('Familie: d-1 scheitert, d-2 (abgesagt) wird gelöscht und die Kennung gespeichert entfernt (Teilergebnis)', async () => {
    const { startBestand } = await import('@/lib/familie/speicher');
    const date = (id: string, datum: string, status: string) => ({ id, titel: 'Date', ideeId: null, datum, planer: 'kevin', status, neuesErlebnis: false, nachklang: [], von: 'kevin', am: new Date().toISOString(), kalenderUid: `makeos-date-${id}` });
    await db.saveJson(`familie--${HAUS}`, { ...startBestand(new Date().toISOString()), dates: [date('d-1', '2026-10-16', 'geplant'), date('d-2', '2026-10-12', 'abgesagt')] });
    ic.scheitert.add('makeos-date-d-1');
    const hinweise = await sp.familieSpiegelNachziehen(HAUS, WER);
    expect(hinweise.map(h => [h.art, h.id])).toEqual([['date', 'd-1']]);
    expect(ic.objekte.has('makeos-date-d-2')).toBe(false);
    const f = (await import('@/lib/familie/speicher')).ladeFamilie(HAUS);
    const dates = (await f).dates;
    expect(dates.find(d => d.id === 'd-2')?.kalenderUid).toBeUndefined();
    expect(dates.find(d => d.id === 'd-1')?.kalenderUid).toBe('makeos-date-d-1');
    ic.scheitert.clear();
  });
});
