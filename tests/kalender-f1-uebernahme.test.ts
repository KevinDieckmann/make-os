// ─── F1 (Gesamtprüfung Prüfer 1, 29.09.): Übernahme der Wochenplan-Blöcke — der Block ist die Wahrheit (#3), kein
// Block hält die Übernahme auf (#4). Beleg des Prüfers als echter Test:
//   · pb-1: im alten Planer auf 14:00 verschoben, die Apple-Kopie blieb um 09:00 → nach der Übernahme steht der Termin
//     um 14:00 mit dem Titel des Blocks (Art „fokus“), die Kopie ist DER Block (keine zweite).
//   · pb-2: die Apple-Kopie wurde in Apple zur Serie → Rückfall: neuer Termin mit fester UID, die Serie bleibt unberührt.
//   · pb-3: ohne Apple-Kopie → neuer Termin (wie bisher).
//   · pb-4: Serie UND der neue Termin scheitert → „übersprungen“ mit Grund (nie Titel), pb-5 danach wird trotzdem
//     übernommen, die Absicht ist fertig, ein zweiter Lauf versucht pb-4 nicht endlos neu.
// Eigener Datenordner, iCloud gemockt (Objekte als echtes ICS), alle Daten erfunden.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-f1-uebernahme-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-f1-ue';
process.env.SESSION_SECRET = 'pruef-sitzung-f1-ue-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-f1-ue-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-f1-ue-nur-im-test-0123456789abcdef';

const ic = vi.hoisted(() => ({ objekte: new Map<string, { kal: string; ics: string; etag: string }>(), angelegt: 0, geaendert: 0, anlegenScheitert: new Set<string>() }));
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const ics = await import('@/lib/kalender/ics');
  const bz = await import('@/lib/kalender/bezug');
  const KAL = ['Testkalender', 'Malin-Kalender', 'Gemeinsam'].map(n => ({ id: `K-${n}`, name: n, schreibbar: true }));
  const stand = () => ({ at: new Date().toISOString(), kalender: KAL, objekte: Object.fromEntries(KAL.map(k => [k.id, [...ic.objekte.entries()].filter(([, o]) => o.kal === k.name).map(([uid, o]) => ({ href: `h/${uid}`, etag: o.etag, ics: o.ics }))])) });
  return {
    ...echt, verbunden: () => true, ladeStand: async () => stand(), frischerStand: async () => stand(), abgleichen: async () => stand(),
    terminAufloesen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); return o ? { schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true } : null; },
    anlegen: async (e: import('@/lib/kalender/icloud').NeuEingabe) => {
      const { kalender, uid: fest, ...rest } = e;
      if (fest && ic.anlegenScheitert.has(fest)) throw new echt.KalenderFehler(`„${kalender}“ ist nur lesbar (geteilt ohne Schreibrecht).`, 403);
      if (fest && ic.objekte.has(fest)) return { uid: fest, schluessel: `K-${ic.objekte.get(fest)!.kal}|${fest}`, kalender, gaeste: 0, schonDa: true as const };
      ic.angelegt++;
      const uid = fest ?? `U-${ic.angelegt}`;
      ic.objekte.set(uid, { kal: kalender, ics: ics.baueTermin({ uid, ...rest }), etag: 'e0' });
      return { uid, schluessel: `K-${kalender}|${uid}`, kalender, gaeste: 0 };
    },
    aendern: async (ref: string, a: import('@/lib/kalender/ics').Aenderung) => {
      const uid = bz.uidVonSchluessel(ref);
      const o = ic.objekte.get(uid)!;
      const r = ics.aendereTermin(o.ics, a);
      if ('fehler' in r) throw new echt.KalenderFehler(r.fehler, 400);
      ic.geaendert++;
      ic.objekte.set(uid, { ...o, ics: r.ics, etag: `e${ic.geaendert}` });
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
  };
});

const HAUS = 'test-haus-f1-ue';
let db: typeof import('@/lib/store/local-db');
let ab: typeof import('@/lib/store/absichten');
let ue: typeof import('@/lib/planung/wochenplan-uebernahme-server');
/** Die Zeile `name` im VEVENT (nicht in VTIMEZONE). */
const zeile = (ics: string, name: string) => new RegExp(`^${name}[^\\r\\n]*`, 'm').exec(ics.slice(ics.indexOf('BEGIN:VEVENT')))?.[0] ?? '';

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-05T06:00:00Z'));
  db = await import('@/lib/store/local-db');
  ab = await import('@/lib/store/absichten');
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'K', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS }], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  await db.saveJson('wochenplan', { '2026-10-05': [
    { id: 'pb-1', date: '2026-10-06', startMin: 840, dauerMin: 90, titel: 'Fokus Angebot (verschoben)', art: 'fokus', appleUid: 'APPLE-1' },
    { id: 'pb-2', date: '2026-10-07', startMin: 480, dauerMin: 30, titel: 'Reha', art: 'reha', appleUid: 'APPLE-SERIE' },
    { id: 'pb-3', date: '2026-10-08', startMin: 600, dauerMin: 60, titel: 'Fokus danach', art: 'fokus' },
    { id: 'pb-4', date: '2026-10-09', startMin: 480, dauerMin: 30, titel: 'Reha Freitag', art: 'reha', appleUid: 'APPLE-SERIE-2' },
    { id: 'pb-5', date: '2026-10-09', startMin: 600, dauerMin: 60, titel: 'Fokus Freitag', art: 'fokus' },
  ] });
  const ics = await import('@/lib/kalender/ics');
  ic.objekte.set('APPLE-1', { kal: 'Testkalender', ics: ics.baueTermin({ uid: 'APPLE-1', titel: 'Fokus Angebot', start: '2026-10-06T09:00:00', ende: '2026-10-06T10:30:00' }), etag: 'e0' });
  ic.objekte.set('APPLE-SERIE', { kal: 'Testkalender', ics: ics.baueTermin({ uid: 'APPLE-SERIE', titel: 'Reha', start: '2026-10-07T08:00:00', ende: '2026-10-07T08:30:00', wiederholung: { freq: 'WEEKLY' } as never }), etag: 'e0' });
  ic.objekte.set('APPLE-SERIE-2', { kal: 'Testkalender', ics: ics.baueTermin({ uid: 'APPLE-SERIE-2', titel: 'Reha Freitag', start: '2026-10-09T08:00:00', ende: '2026-10-09T08:30:00', wiederholung: { freq: 'WEEKLY' } as never }), etag: 'e0' });
  ue = await import('@/lib/planung/wochenplan-uebernahme-server');
  const { uidFuerBlock } = await import('@/lib/planung/wochenplan-uebernahme');
  ic.anlegenScheitert.add(uidFuerBlock('kevin', 'pb-4'));
});
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('F1 #3/#4 Übernahme', () => {
  it('Block ist die Wahrheit; Serie → Rückfall; Fehler → übersprungen mit Grund, die anderen laufen durch', async () => {
    const { uidFuerBlock } = await import('@/lib/planung/wochenplan-uebernahme');
    const serieVorher = ic.objekte.get('APPLE-SERIE')!.ics;
    const r = await ue.uebernahmeAusfuehren(HAUS, 'kevin');
    expect(r).toMatchObject({ ok: true, uebernommen: 4, uebersprungen: 1 });
    // pb-1: die stehen gebliebene Apple-Kopie zieht auf die Zeit und den Titel des Blocks.
    const a1 = ic.objekte.get('APPLE-1')!.ics;
    expect(zeile(a1, 'DTSTART')).toContain('20261006T140000');
    expect(zeile(a1, 'DTEND')).toContain('20261006T153000');
    expect(zeile(a1, 'SUMMARY')).toContain('Fokus Angebot (verschoben)');
    expect(zeile(a1, 'X-MAKE-ART')).toContain('fokus');
    const stand = (await db.loadJson<{ personen: Record<string, { bloecke: Record<string, string>; uebersprungen?: Record<string, string> }> }>('wochenplan-uebernahme'))!;
    const k = stand.personen.kevin;
    expect(k.bloecke['pb-1']).toBe('APPLE-1');
    // pb-2: Serie bleibt unberührt, der Block wird ein eigener Termin mit fester UID.
    expect(ic.objekte.get('APPLE-SERIE')!.ics).toBe(serieVorher);
    expect(k.bloecke['pb-2']).toBe(uidFuerBlock('kevin', 'pb-2'));
    expect(ic.objekte.has(uidFuerBlock('kevin', 'pb-2'))).toBe(true);
    expect(k.bloecke['pb-3']).toBe(uidFuerBlock('kevin', 'pb-3'));
    // pb-4: übersprungen mit Grund (Serie + nur lesbar), ohne Titel; pb-5 danach trotzdem übernommen.
    expect(k.bloecke['pb-4']).toBeUndefined();
    expect(k.uebersprungen?.['pb-4']).toMatch(/Serientermin/);
    expect(k.uebersprungen?.['pb-4']).not.toContain('Reha');
    expect(k.bloecke['pb-5']).toBe(uidFuerBlock('kevin', 'pb-5'));
    expect((await ab.absichtenLaden(HAUS)).filter(a => a.art === 'wochenplan-uebernahme').map(a => a.status)).toEqual(['fertig']);
    // Der übersprungene Block bleibt als Archiv sichtbar (wartet nicht mehr), kein endloser neuer Versuch.
    const arch = await ue.archivFuer('kevin', '2026-10-05', '2026-10-12');
    expect(arch.map(b => [b.id, !!b.uebersprungen, !!b.wartet])).toEqual([['archiv:kevin:pb-4', true, false]]);
    const angelegt = ic.angelegt;
    const r2 = await ue.uebernahmeAusfuehren(HAUS, 'kevin');
    expect(r2).toMatchObject({ ok: true, uebernommen: 0 });
    expect(ic.angelegt).toBe(angelegt);
    expect((await ue.uebernahmeVorschau()).offen).toBe(0);
  });
});
