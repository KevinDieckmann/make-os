// ─── Upload U1 (29.09.): Wochenplan-Übernahme — M1 (Netzfehler = später weiter, nicht „übersprungen“; „Erneut
// versuchen“) und H1 (Warnung; „Übernahme zurücknehmen“ mit Probelauf + Bestätigung, nur Termine `makeos-wochenplan-…`,
// Teilnehmer-Sperre) ─
// Eigener Datenordner (vor allen Imports), iCloud gemockt (echte ICS-Texte, nie ein Netzaufruf), erfundene Daten.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ic = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-uebernahme-u1-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-ueb-u1', SESSION_SECRET: 'pruef-sitzung-ueb-u1-nur-im-test',
    MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-ueb-u1-nur-im-test', MAKE_OS_PEPPER: 'pruef-pepper-ueb-u1-nur-im-test-0123456789abcdef',
  });
  return { ordner, objekte: new Map<string, { kal: string; ics: string; etag: string }>(), verbunden: true, stoerung: null as null | ((uid: string) => Error | null), angelegt: 0, n: 0 };
});
vi.mock('@/lib/kalender/icloud', async orig => {
  const echt = await orig<typeof import('@/lib/kalender/icloud')>();
  const ics = await import('@/lib/kalender/ics');
  const bz = await import('@/lib/kalender/bezug');
  const KAL = ['Testkalender', 'Malin-Kalender', 'Gemeinsam'].map(n => ({ id: `K-${n}`, name: n, schreibbar: true }));
  const stand = () => ({ at: new Date(Date.UTC(2026, 9, 5, 6) + ic.n++).toISOString(), kalender: KAL, objekte: Object.fromEntries(KAL.map(k => [k.id, [...ic.objekte.entries()].filter(([, o]) => o.kal === k.name).map(([uid, o]) => ({ href: `h/${uid}`, etag: o.etag, ics: o.ics }))])) });
  return {
    ...echt,
    verbunden: () => ic.verbunden, ladeStand: async () => stand(), frischerStand: async () => stand(), abgleichen: async () => stand(),
    terminAufloesen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); return o ? { schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true } : null; },
    anlegen: async (e: import('@/lib/kalender/icloud').NeuEingabe) => {
      const { kalender, uid: fest, ...rest } = e;
      const f = ic.stoerung?.(fest ?? '');
      if (f) throw f;
      if (fest && ic.objekte.has(fest)) return { uid: fest, schluessel: `K-${ic.objekte.get(fest)!.kal}|${fest}`, kalender, gaeste: 0, schonDa: true as const };
      ic.angelegt++;
      ic.objekte.set(fest!, { kal: kalender, ics: ics.baueTermin({ uid: fest!, ...rest }, new Date()), etag: 'e0' });
      return { uid: fest!, schluessel: `K-${kalender}|${fest}`, kalender, gaeste: 0 };
    },
    aendern: async (ref: string, a: import('@/lib/kalender/ics').Aenderung) => {
      const uid = bz.uidVonSchluessel(ref);
      const o = ic.objekte.get(uid)!;
      const r = ics.aendereTermin(o.ics, a);
      if ('fehler' in r) throw new echt.KalenderFehler(r.fehler, 400);
      ic.objekte.set(uid, { ...o, ics: r.ics, etag: 'e1' });
      return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true };
    },
    loeschen: async (ref: string) => { const uid = bz.uidVonSchluessel(ref); const o = ic.objekte.get(uid); if (!o) return { gaeste: 0 }; ic.objekte.delete(uid); return { gaeste: 0, schluessel: `K-${o.kal}|${uid}`, uid, eindeutig: true }; },
  };
});

import * as db from '@/lib/store/local-db';
import * as ab from '@/lib/store/absichten';
import * as ue from '@/lib/planung/wochenplan-uebernahme-server';
import { uebernahmeTexte, UEBERNAHME_WARNUNG, uebersprungeneFreigeben, ruecknahmeStand, LEER_STAND } from '@/lib/planung/wochenplan-uebernahme';
import { KalenderUeberlastet, KalenderZeitueberschreitung, KalenderFehler, voruebergehenderFehler } from '@/lib/kalender/icloud';
import { baueTermin } from '@/lib/kalender/ics';

const HAUS = 'test-haus-ueb-u1';
const T0 = new Date('2026-10-05T06:00:00Z');
const block = (id: string, date: string, startMin = 540) => ({ id, date, startMin, dauerMin: 60, titel: `Fokus ${id}`, art: 'fokus' });
const WER = { art: 'person' as const, person: 'kevin' };
const offeneUebernahme = async () => (await ab.absichtenLaden(HAUS)).filter(a => a.art === 'wochenplan-uebernahme' && ab.istOffen(a));

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0);
  await db.saveJson('konten', { konten: [{ id: 'k1', speicher: 'kevin', email: 'k@example.invalid', name: 'K', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS }], einladungen: [] });
  await db.saveJson('kalender-einstellungen', { kalender: { kevin: 'Testkalender', malin: 'Malin-Kalender', beide: 'Gemeinsam' } });
  await db.saveJson('wochenplan', { '2026-10-05': [block('pb-1', '2026-10-06'), block('pb-2', '2026-10-07'), block('pb-3', '2026-10-08')] });
  ic.objekte.set('FREMD-1', { kal: 'Testkalender', ics: baueTermin({ uid: 'FREMD-1', titel: 'Zahnarzt', start: '2026-10-06T14:00:00', ende: '2026-10-06T15:00:00' }), etag: 'e0' });
});
afterAll(() => { vi.useRealTimers(); rmSync(ic.ordner, { recursive: true, force: true }); });

describe('rein', () => {
  it('H1: die Rückfrage trägt die Warnung', () => {
    expect(uebernahmeTexte(3).frage).toContain(UEBERNAHME_WARNUNG);
    expect(UEBERNAHME_WARNUNG).toMatch(/stabilen Tagen.*Rückweg zur alten Version nur mit Aufräumen/);
  });
  it('M1: vorübergehende Fehler erkennen', () => {
    expect(voruebergehenderFehler(new KalenderUeberlastet('503'), true)).toBe(true);
    expect(voruebergehenderFehler(new KalenderZeitueberschreitung(), true)).toBe(true);
    expect(voruebergehenderFehler(new KalenderFehler('iCloud: „x“ nicht lesbar (500).'), true)).toBe(true);
    expect(voruebergehenderFehler(new TypeError('fetch failed'), true)).toBe(true);
    expect(voruebergehenderFehler(new KalenderFehler('Apple-Kopie ist nur lesbar', 400), false)).toBe(true); // nicht verbunden
    expect(voruebergehenderFehler(new KalenderFehler('Serie', 400), true)).toBe(false);
    expect(voruebergehenderFehler(new KalenderFehler('gekürzt (507)', 507), true)).toBe(false);
  });
  it('Freigeben und Zurücksetzen des Stands', () => {
    const s = { version: 1 as const, archiv: 'a.json', personen: { kevin: { am: 'x', bloecke: { a: 'makeos-wochenplan-kevin-a', b: 'APPLE-1' }, uebersprungen: { c: 'Serie' } } } };
    expect(uebersprungeneFreigeben(s)).toEqual({ stand: { ...s, personen: { kevin: { am: 'x', bloecke: s.personen.kevin.bloecke } } }, frei: 1 });
    expect(ruecknahmeStand(s, new Set(), true)).toEqual({ ...LEER_STAND, personen: {}, archiv: 'a.json' });
    expect(ruecknahmeStand(s, new Set(['makeos-wochenplan-kevin-a']), false).personen.kevin).toEqual({ bloecke: {}, uebersprungen: { c: 'Serie' } });
  });
});

describe('M1: Netzfehler → später weiter, nicht übersprungen', () => {
  it('503 bei pb-2: Lauf bricht ab, pb-2 NICHT übersprungen, Absicht offen, Vorschau „unterbrochen“', async () => {
    ic.stoerung = uid => (uid.endsWith('pb-2') ? new KalenderUeberlastet('iCloud ist gerade überlastet (503) — neuer Versuch später.') : null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(ue.uebernahmeAusfuehren(HAUS, 'kevin')).rejects.toThrow(/überlastet/);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/\[wochenplan-uebernahme\] unterbrochen/);
    warn.mockRestore();
    const s = await ue.ladeUebernahme();
    expect(Object.keys(s.personen.kevin.bloecke)).toEqual(['pb-1']);
    expect(s.personen.kevin.uebersprungen).toBeUndefined();
    expect(await offeneUebernahme()).toHaveLength(1);
    const v = await ue.uebernahmeVorschau(T0, HAUS);
    expect(v).toMatchObject({ unterbrochen: true, uebersprungen: 0 });
  });

  it('Wiederaufnahme ohne iCloud fängt gar nicht an; mit iCloud macht sie weiter — nichts doppelt', async () => {
    const [a] = await offeneUebernahme();
    ic.verbunden = false;
    await expect(ue.wochenplanUebernahmeFortsetzen(HAUS, a)).rejects.toThrow(/nicht verbunden/);
    ic.verbunden = true;
    ic.stoerung = null;
    const vorher = ic.angelegt;
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    await ue.wochenplanUebernahmeFortsetzen(HAUS, (await offeneUebernahme())[0]);
    info.mockRestore();
    expect(ic.angelegt).toBe(vorher + 2);
    expect(Object.keys((await ue.ladeUebernahme()).personen.kevin.bloecke).sort()).toEqual(['pb-1', 'pb-2', 'pb-3']);
    expect(await offeneUebernahme()).toHaveLength(0);
  });

  it('ein dauerhafter Grund überspringt; „Erneut versuchen“ gibt frei und holt nach', async () => {
    await db.updateJson<Record<string, unknown>>('wochenplan', cur => ({ ...cur, '2026-10-12': [block('pb-9', '2026-10-13')] }));
    ic.stoerung = uid => (uid.endsWith('pb-9') ? new KalenderFehler('Kalender lehnt ab (400).', 400) : null);
    const r = await ue.uebernahmeAusfuehren(HAUS, 'kevin');
    expect(r).toMatchObject({ ok: true, uebersprungen: 1 });
    expect((await ue.uebernahmeVorschau(T0, HAUS)).uebersprungen).toBe(1);
    ic.stoerung = null;
    const e = await ue.uebernahmeErneut(HAUS, 'kevin');
    expect(e).toMatchObject({ ok: true, uebernommen: 1 });
    expect((await ue.uebernahmeVorschau(T0, HAUS))).toMatchObject({ uebersprungen: 0, offen: 0, zuruecknehmbar: 4 });
  });
});

describe('H1: Übernahme zurücknehmen', () => {
  it('Probelauf zählt nur; Termin mit Gästen bleibt gesperrt; bestätigt löscht nur `makeos-wochenplan-…`', async () => {
    const gast = 'makeos-wochenplan-kevin-gast';
    ic.objekte.set(gast, { kal: 'Testkalender', ics: `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//T//T//DE\r\nBEGIN:VEVENT\r\nUID:${gast}\r\nDTSTAMP:20261001T100000Z\r\nDTSTART;TZID=Europe/Berlin:20261009T090000\r\nDTEND;TZID=Europe/Berlin:20261009T100000\r\nSUMMARY:Block mit Gast\r\nORGANIZER:mailto:k@example.invalid\r\nATTENDEE:mailto:gast@example.invalid\r\nEND:VEVENT\r\nEND:VCALENDAR` , etag: 'e0' });
    const probe = await ue.uebernahmeZuruecknehmen(HAUS, WER, false);
    expect(probe).toEqual({ ok: true, probelauf: true, termine: 5, gesperrt: 1 });
    expect(ic.objekte.size).toBe(6);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const r = await ue.uebernahmeZuruecknehmen(HAUS, WER, true);
    info.mockRestore();
    expect(r).toMatchObject({ ok: false, probelauf: false, termine: 5, gesperrt: 1, geloescht: 4, fehler: 0 });
    expect([...ic.objekte.keys()].sort()).toEqual(['FREMD-1', gast]);
    // Nicht alles ging (Gast) → nur die gelöschten fallen aus dem Stand; die übrigen Blöcke „warten“ wieder.
    expect((await ue.uebernahmeVorschau(T0, HAUS))).toMatchObject({ offen: 4, zuruecknehmbar: 1 });
    // Der alte Bestand ist unverändert.
    expect(Object.keys(await db.loadJson<Record<string, unknown>>('wochenplan') ?? {})).toEqual(['2026-10-05', '2026-10-12']);
  });

  it('ohne Gast-Termin: vollständig — Stand leer (Archiv-Verweis bleibt)', async () => {
    ic.objekte.delete('makeos-wochenplan-kevin-gast');
    const r = await ue.uebernahmeZuruecknehmen(HAUS, WER, true);
    expect(r).toMatchObject({ ok: true, termine: 0, geloescht: 0 });
    const s = await ue.ladeUebernahme();
    expect(s.personen).toEqual({});
    expect(s.archiv).toMatch(/^wochenplan-vor-uebernahme-/);
  });

  it('nie während einer unterbrochenen Übernahme', async () => {
    ic.stoerung = uid => (uid.endsWith('pb-2') ? new KalenderUeberlastet('503') : null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(ue.uebernahmeAusfuehren(HAUS, 'kevin')).rejects.toThrow();
    warn.mockRestore();
    const r = await ue.uebernahmeZuruecknehmen(HAUS, WER, true);
    expect(r).toMatchObject({ ok: false, grund: expect.stringMatching(/unterbrochen/) });
    ic.stoerung = null;
  });
});
