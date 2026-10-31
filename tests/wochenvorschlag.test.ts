// ─── Planung mit ZOE — Wochenvorschlag (31.10.) ─────────────────────────────────────────────────────────────────────────────────
// Regelwerk (rein): freie Zeit nur in der Arbeitszeit bzw. im Privat-Fenster, nie über Termine/Abwesenheit/Business-frei/Feiertag, Puffer, nie in der
// Vergangenheit, Frist beachtet, Top 3, „nicht machbar“, deterministisch, feste UIDs. Server: Trennung je Person/Bereich, Freigabe idempotent,
// Montag-Rhythmus legt nur bereit (nichts im Kalender) und meldet einmal. Eigener Datenordner, erfundene Personen; Kalender, Aufgaben, Kapazität gemockt.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-wochenvorschlag-'));
Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-wochenvorschlag', MAKE_OS_KI_VORGABE: 'kompatibel', MAKE_OS_DOKU_WURZEL: 'aus', MAKE_OS_BRAIN_INDEX: 'aus' });
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_ALTBESTAND_PERSON;
delete process.env.ANTHROPIC_API_KEY;

const MONTAG = '2026-11-02';
const tag = (n: number) => `2026-11-0${2 + n}`;
const w = (t: string, hhmm: string) => `${t}T${hhmm}:00`;

const kal = vi.hoisted(() => ({ angelegt: [] as { person: string; uid?: string; date: string; startMin: number; dauerMin: number; titel: string; art: string; taskId?: string; privat?: boolean }[] }));
const mel = vi.hoisted(() => ({ liste: [] as { an: string; titel: string; link: string }[] }));
vi.mock('@/lib/planung/bloecke-server', () => ({
  blockAnlegen: async (person: string, b: { uid?: string; date: string; startMin: number; dauerMin: number; titel: string; art: string; taskId?: string; privat?: boolean }) => { kal.angelegt.push({ person, ...b }); return { uid: b.uid ?? 'x' }; },
  planBloeckeLesen: async (o: { person?: string }) => kal.angelegt.filter(b => b.person === o.person).map(b => ({ id: b.uid, uid: b.uid, quelle: 'kalender', date: b.date, startMin: b.startMin, dauerMin: b.dauerMin, titel: b.titel, art: 'fokus', ...(b.taskId ? { taskId: b.taskId } : {}) })),
}));
// Verfügbarkeit (K1-Form): Mo–Fr 09–17; Mo Termin 10–11; Di ganz abwesend; Mi Business-frei 13–17; Fr Feiertag. Angelegte Blöcke sind beschäftigt.
vi.mock('@/lib/kalender/verfuegbarkeit', () => ({
  verfuegbarkeitFuer: async (person: string, von: string, bis: string) => ({
    person, von, bis,
    tage: Array.from({ length: 7 }, (_, n) => {
      const t = `2026-11-0${2 + n}`;
      const werktag = n < 5;
      return {
        tag: t, wochenende: !werktag, abwesend: n === 1 ? [{ start: `${t}T00:00:00`, ende: `2026-11-04T00:00:00`, art: 'abwesend', ganztags: true }] : [],
        ganzAbwesend: n === 1, ...(n === 4 ? { feiertag: 'Prüf-Feiertag' } : {}),
        arbeitszeit: werktag && n !== 1 && n !== 4 ? [{ start: `${t}T09:00:00`, ende: `${t}T17:00:00` }] : [],
        beschaeftigt: [
          ...(n === 0 ? [{ start: `${t}T10:00:00`, ende: `${t}T11:00:00`, art: 'termin', ganztags: false }] : []),
          ...kal.angelegt.filter(b => b.person === person && b.date === t).map(b => ({ start: `${t}T${String(Math.floor(b.startMin / 60)).padStart(2, '0')}:${String(b.startMin % 60).padStart(2, '0')}:00`, ende: `${t}T${String(Math.floor((b.startMin + b.dauerMin) / 60)).padStart(2, '0')}:${String((b.startMin + b.dauerMin) % 60).padStart(2, '0')}:00`, art: 'fokus', ganztags: false })),
        ],
        ...(n === 2 ? { businessFrei: [{ start: `${t}T13:00:00`, ende: `${t}T17:00:00` }] } : {}),
      };
    }),
  }),
}));
const aufgabe = (id: string, assignee: string, spaceId: string, priority: string, dueDate?: string) => ({ id, title: `Aufgabe ${id}`, status: 'todo', priority, assignee, spaceId, projectId: 'p', dependencies: [], ...(dueDate ? { dueDate } : {}), createdAt: '2026-10-01', updatedAt: '2026-10-01' });
vi.mock('@/lib/aufgaben/sicht', () => ({
  orgZuordnung: async () => ({}),
  ladeAufgabenSicht: async () => ({ tasks: [
    aufgabe('olaf-krit', 'olaf', 'kdv', 'critical', '2026-11-04'),
    aufgabe('olaf-hoch', 'olaf', 'kdv', 'high'),
    aufgabe('olaf-privat', 'olaf', 'privat', 'critical', '2026-11-03'),
    aufgabe('pia-krit', 'pia', 'kdv', 'critical', '2026-11-03'),
    aufgabe('olaf-egal', 'olaf', 'kdv', 'low'),
  ], projects: [] }),
}));
vi.mock('@/lib/kapazitaet/server', () => ({
  kapaIdVon: (s: string) => `konto-${s}`,
  kapaStandFuer: async (person: string) => ({ bezuege: [], stand: { posten: [
    { art: 'meilenstein', id: 'ms-launch', titel: 'Launch vorbereiten', termin: '2026-11-05', rest: 4, personen: [`konto-${person}`], status: 'nicht-machbar', text: 'nicht machbar — bräuchte 3 h/Tag, frei sind 1' },
    { art: 'meilenstein', id: 'ms-fremd', titel: 'Fremder Meilenstein', termin: '2026-11-05', rest: 4, personen: ['konto-jemand'], status: 'eng', text: 'eng' },
    { art: 'meilenstein', id: 'ms-belegt', titel: 'Privat (belegt)', termin: '2026-11-05', rest: 4, personen: [], status: 'nicht-machbar', text: 'x' },
  ] } }),
}));
vi.mock('@/lib/meldungen/melden', () => ({ melde: async (m: { an: string; titel: string; link: string }) => { mel.liste.push(m); } }));

import {
  wochenvorschlagRechnen, kandidatenBauen, bloeckeWaehlen, freieSpannen, blockFrei, wvUid, WV, WV_UID_PRAEFIX, PRIVAT_FENSTER,
  type WvTag, type WvKandidat,
} from '@/lib/planung/wochenvorschlag';
import { UID_FEST } from '@/lib/kalender/eingabe';
import { wochentag } from '@/lib/kalender/verfuegbar';

// ── Reines Regelwerk ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const tagAus = (n: number, extra: Partial<WvTag> = {}): WvTag => ({
  tag: tag(n), ganzAbwesend: false, hatVorlage: true, beschaeftigt: [], abwesend: [],
  arbeitszeit: n < 5 ? [{ start: w(tag(n), '09:00'), ende: w(tag(n), '17:00') }] : [], ...extra,
});
const woche = (aenderung: Record<number, Partial<WvTag>> = {}) => Array.from({ length: 7 }, (_, n) => tagAus(n, aenderung[n]));
const k = (id: string, extra: Partial<WvKandidat> = {}): WvKandidat => ({ id: `a:${id}`, art: 'aufgabe', titel: `Aufgabe ${id}`, taskId: id, grund: 'kritisch', minuten: 90, ...extra });
const VORHER = '2026-11-01T20:00:00';
const rechne = (tage: WvTag[], kandidaten: WvKandidat[], extra: { jetzt?: string; bereich?: 'privat' | 'business'; machbarkeit?: { titel: string; status: 'nicht-machbar' | 'eng' | 'ueberfaellig'; text: string }[] } = {}) =>
  wochenvorschlagRechnen({ person: 'olaf', montag: MONTAG, bereich: extra.bereich ?? 'business', tage, kandidaten, jetzt: extra.jetzt ?? VORHER, erstellt: '2026-11-01T19:00:00.000Z', ...(extra.machbarkeit ? { machbarkeit: extra.machbarkeit } : {}) });
const ueberlappt = (b: { date: string; startMin: number; dauerMin: number }, t: string, von: string, bis: string) =>
  b.date === t && b.startMin < Number(bis.slice(0, 2)) * 60 + Number(bis.slice(3)) && Number(von.slice(0, 2)) * 60 + Number(von.slice(3)) < b.startMin + b.dauerMin;

describe('Regelwerk — freie Zeit', () => {
  it('nur in der Arbeitszeit, nie über Termine (mit 15 Minuten Puffer)', () => {
    const v = rechne(woche({ 0: { beschaeftigt: [{ start: w(tag(0), '10:00'), ende: w(tag(0), '11:00'), art: 'termin' }] } }), ['a', 'b', 'c', 'd', 'e', 'f'].map(x => k(x)));
    expect(v.bloecke.length).toBeGreaterThan(0);
    for (const b of v.bloecke) {
      expect(b.startMin).toBeGreaterThanOrEqual(9 * 60);
      expect(b.startMin + b.dauerMin).toBeLessThanOrEqual(17 * 60);
      expect(ueberlappt(b, tag(0), '09:45', '11:15')).toBe(false);
      expect(b.startMin % 15).toBe(0);
    }
    expect(Math.max(...Object.values(v.bloecke.reduce<Record<string, number>>((a, b) => ({ ...a, [b.date]: (a[b.date] ?? 0) + 1 }), {})))).toBeLessThanOrEqual(WV.MAX_JE_TAG);
  });
  it('nie an ganz abwesenden Tagen, an Feiertagen, in Business-frei oder bei zeitweiser Abwesenheit', () => {
    const v = rechne(woche({
      0: { abwesend: [{ start: w(tag(0), '08:00'), ende: w(tag(0), '18:00') }] },
      1: { ganzAbwesend: true },
      2: { businessFrei: [{ start: w(tag(2), '09:00'), ende: w(tag(2), '17:00') }] },
      3: { feiertag: 'Prüf-Feiertag' },
      4: { frei: 'freier Tag' },
    }), [k('a'), k('b')]);
    expect(v.bloecke).toEqual([]);
    expect(v.freiMin).toBe(0);
    expect(v.hinweise.map(h => h.art)).toContain('nicht-machbar');
  });
  it('zwei eigene Blöcke halten den Puffer zueinander ein, höchstens zwei je Tag', () => {
    const nurMontag = woche({ 1: { ganzAbwesend: true }, 2: { ganzAbwesend: true }, 3: { ganzAbwesend: true }, 4: { ganzAbwesend: true } });
    const v = rechne(nurMontag, [k('a'), k('b'), k('c')]);
    const mo = v.bloecke.filter(b => b.date === tag(0)).sort((a, b) => a.startMin - b.startMin);
    expect(mo).toHaveLength(2);
    expect(mo[1].startMin).toBeGreaterThanOrEqual(mo[0].startMin + mo[0].dauerMin + WV.PUFFER_MIN);
    expect(v.hinweise.some(h => h.art === 'kein-platz' && h.text.includes('Aufgabe c'))).toBe(true);
  });
  it('eine kurze Lücke vor einem Termin wird übersprungen, wenn später der ganze Block passt', () => {
    const v = rechne(woche({ 0: { beschaeftigt: [{ start: w(tag(0), '10:00'), ende: w(tag(0), '11:00'), art: 'termin' }] } }), [k('a')]);
    expect(v.bloecke[0]).toMatchObject({ date: tag(0), startMin: 11 * 60 + 15, dauerMin: 90 });
  });
  it('nie in der Vergangenheit: heute erst ab jetzt + Puffer, frühere Tage gar nicht', () => {
    const v = rechne(woche(), [k('a'), k('b'), k('c')], { jetzt: `${tag(2)}T10:05:00` });
    for (const b of v.bloecke) {
      expect(b.date >= tag(2)).toBe(true);
      if (b.date === tag(2)) expect(b.startMin).toBeGreaterThanOrEqual(10 * 60 + 30);
    }
  });
  it('Frist in der Woche: der Block liegt am oder vor dem Tag der Frist', () => {
    const v = rechne(woche({ 0: { ganzAbwesend: true } }), [k('a', { frist: tag(2), grund: 'fällig Mi' })]);
    expect(v.bloecke[0].date <= tag(2)).toBe(true);
    expect(v.bloecke[0].grund).toMatch(/Frist/);
  });
  it('Privat: im Privat-Fenster außerhalb der Arbeitszeit — Business-frei sperrt Privat nicht', () => {
    const v = rechne(woche({ 0: { businessFrei: [{ start: w(tag(0), '17:00'), ende: w(tag(0), '22:00') }] } }), [k('a'), k('b'), k('c')], { bereich: 'privat' });
    expect(v.bloecke.length).toBeGreaterThan(0);
    expect(v.bloecke[0].date).toBe(tag(0));
    for (const b of v.bloecke) {
      const f = PRIVAT_FENSTER.find(x => x.tage.includes(wochentag(b.date)))!;
      expect(b.startMin).toBeGreaterThanOrEqual(f.von);
      expect(b.startMin + b.dauerMin).toBeLessThanOrEqual(f.bis);
    }
  });
  it('freieSpannen: Termin mit Puffer, Abwesenheit ohne', () => {
    const t = tagAus(0, { beschaeftigt: [{ start: w(tag(0), '12:00'), ende: w(tag(0), '13:00'), art: 'termin' }], abwesend: [{ start: w(tag(0), '15:00'), ende: w(tag(0), '16:00') }] });
    expect(freieSpannen(t, 'business', VORHER)).toEqual([[540, 705], [795, 900], [960, 1020]]);
  });
});

describe('Regelwerk — Top 3, Kapazität, Stand', () => {
  it('Top 3 = die drei wichtigsten Kandidaten; Hinweise der Kapazität kommen mit', () => {
    const v = rechne(woche(), [k('a'), k('b'), k('c'), k('d')], { machbarkeit: [{ titel: 'Launch', status: 'nicht-machbar', text: 'nicht machbar' }] });
    expect(v.top3.map(t => t.id)).toEqual(['a:a', 'a:b', 'a:c']);
    expect(v.hinweise.some(h => h.text.includes('„Launch“'))).toBe(true);
  });
  it('„nicht machbar“, wenn der Bedarf die freie Zeit übersteigt', () => {
    const v = rechne(woche({ 1: { ganzAbwesend: true }, 2: { ganzAbwesend: true }, 3: { ganzAbwesend: true }, 4: { ganzAbwesend: true }, 0: { arbeitszeit: [{ start: w(tag(0), '09:00'), ende: w(tag(0), '11:00') }] } }), [k('a'), k('b'), k('c')]);
    expect(v.hinweise[0].art).toBe('nicht-machbar');
    expect(v.hinweise[0].text).toMatch(/bräuchten 4,5 h/);
    expect(v.hinweise.some(h => h.art === 'kein-platz')).toBe(true);
  });
  it('nichts Wichtiges → keine Blöcke „zur Auffüllung“', () => {
    const v = rechne(woche(), []);
    expect(v.bloecke).toEqual([]);
    expect(v.hinweise[0].art).toBe('woche');
  });
  it('deterministisch: gleiche Eingabe → gleicher Vorschlag, feste UIDs im Termin-Format', () => {
    const a = rechne(woche(), [k('a'), k('b')]), b = rechne(woche(), [k('a'), k('b')]);
    expect(a.bloecke).toEqual(b.bloecke);
    expect(a.stand).toBe(b.stand);
    for (const x of a.bloecke) { expect(x.uid.startsWith(WV_UID_PRAEFIX)).toBe(true); expect(UID_FEST.test(x.uid)).toBe(true); }
    expect(wvUid('olaf', MONTAG, 'business', 'a:a', 1)).not.toBe(wvUid('pia', MONTAG, 'business', 'a:a', 1));
    expect(wvUid('olaf', MONTAG, 'business', 'a:a', 1)).not.toBe(wvUid('olaf', MONTAG, 'privat', 'a:a', 1));
  });
  it('übernommene Blöcke bleiben stehen, ihr Kandidat wird nicht noch einmal geplant', () => {
    const erst = rechne(woche(), [k('a'), k('b')]);
    const fest = erst.bloecke.filter(b => b.kandidat === 'a:a');
    const neu = wochenvorschlagRechnen({ person: 'olaf', montag: MONTAG, bereich: 'business', tage: woche(), kandidaten: [k('a'), k('b')], jetzt: VORHER, erstellt: 'x', uebernommen: fest });
    expect(neu.bloecke.filter(b => b.kandidat === 'a:a')).toEqual(fest);
  });
});

describe('Kandidaten', () => {
  it('Eisenhower vor Punkten, Frist in der Woche zählt, Unwichtiges fällt weg, schon Geplantes auch', () => {
    const l = kandidatenBauen({ montag: MONTAG, schonGeplant: new Set(['geplant']), meilensteine: [], aufgaben: [
      { id: 'q2', titel: 'Q2', quadrant: 'q2', kritisch: true, punkte: 30, gruende: ['kritisch'] },
      { id: 'q1', titel: 'Q1', quadrant: 'q1', kritisch: false, punkte: 20, gruende: ['heute fällig'], faellig: tag(0) },
      { id: 'egal', titel: 'Egal', quadrant: 'q4', kritisch: false, punkte: 0, gruende: [] },
      { id: 'woche', titel: 'Woche', quadrant: 'q4', kritisch: false, punkte: 0, gruende: [], faellig: tag(3) },
      { id: 'geplant', titel: 'Geplant', quadrant: 'q1', kritisch: true, punkte: 90, gruende: [] },
    ] });
    expect(l.map(x => x.id)).toEqual(['a:q1', 'a:q2', 'a:woche']);
    expect(l[2].grund).toMatch(/^fällig Do/);
  });
  it('Meilensteine mit Termin und Rest kommen dazu — außer eine ihrer Aufgaben steht schon drin', () => {
    const ms = [{ id: 'm1', titel: 'M1', termin: tag(3), restStunden: 4, status: 'nicht-machbar' }, { id: 'm2', titel: 'M2', termin: tag(4), restStunden: 2, status: 'machbar' }, { id: 'm3', titel: 'M3', termin: '2027-01-01', restStunden: 2, status: 'machbar' }];
    const l = kandidatenBauen({ montag: MONTAG, meilensteine: ms, aufgaben: [{ id: 't', titel: 'T', quadrant: 'q1', kritisch: true, punkte: 40, gruende: ['kritisch'], msId: 'm2' }] });
    expect(l.map(x => x.id)).toEqual(['a:t', 'm:m1']);
    expect(l[1].minuten).toBe(240);
    expect(l[1].grund).toMatch(/^Meilenstein bis Do 05\.11\. · noch 4 h · nicht machbar/);
  });
});

describe('Freigabe — Auswahl und Verschieben', () => {
  const v = rechne(woche(), [k('a'), k('b')]);
  it('Auswahl nur aus dem Vorschlag', () => {
    expect(bloeckeWaehlen(v, ['gibt-es-nicht']).ok).toBe(false);
    const r = bloeckeWaehlen(v, [v.bloecke[0].id]);
    expect(r.ok && r.bloecke.map(b => b.id)).toEqual([v.bloecke[0].id]);
  });
  it('Verschieben nur in der Woche, im Raster, 06–22 Uhr', () => {
    const id = v.bloecke[0].id;
    expect(bloeckeWaehlen(v, undefined, [{ id, date: '2026-11-09', startMin: 600 }]).ok).toBe(false);
    expect(bloeckeWaehlen(v, undefined, [{ id, date: tag(3), startMin: 605 }]).ok).toBe(false);
    expect(bloeckeWaehlen(v, undefined, [{ id, date: tag(3), startMin: 21 * 60 }]).ok).toBe(false);
    const r = bloeckeWaehlen(v, undefined, [{ id, date: tag(3), startMin: 14 * 60 }]);
    expect(r.ok && r.bloecke.find(b => b.id === id)).toMatchObject({ date: tag(3), startMin: 840 });
  });
  it('blockFrei: nie über Termine/Abwesenheit, im Business nie in Business-frei oder am Feiertag', () => {
    const t = tagAus(0, { beschaeftigt: [{ start: w(tag(0), '10:00'), ende: w(tag(0), '11:00'), art: 'termin' }], businessFrei: [{ start: w(tag(0), '14:00'), ende: w(tag(0), '15:00') }] });
    expect(blockFrei(t, 'business', { date: tag(0), startMin: 600, dauerMin: 30 })).toBe(false);
    expect(blockFrei(t, 'business', { date: tag(0), startMin: 14 * 60, dauerMin: 30 })).toBe(false);
    expect(blockFrei(t, 'privat', { date: tag(0), startMin: 14 * 60, dauerMin: 30 })).toBe(true);
    expect(blockFrei(tagAus(0, { feiertag: 'x' }), 'business', { date: tag(0), startMin: 600, dauerMin: 30 })).toBe(false);
  });
});

// ── Server: Trennung, Freigabe idempotent, Montag-Rhythmus ───────────────────────────────────────────────────────────────────────

let db: typeof import('@/lib/store/local-db');
let srv: typeof import('@/lib/planung/wochenvorschlag-server');
const JETZT = new Date('2026-11-01T19:00:00Z'); // So 01.11., 20:00 in Berlin

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'olaf', email: 'olaf@example.invalid', name: 'Olaf Prüf', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus' },
    { id: 'k2', speicher: 'pia', email: 'pia@example.invalid', name: 'Pia Prüf', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', finanzRecht: 'business' },
  ], einladungen: [] });
  srv = await import('@/lib/planung/wochenvorschlag-server');
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten?.();
  rmSync(ordner, { recursive: true, force: true });
});
beforeEach(() => { kal.angelegt.length = 0; });

describe('Server — Trennung je Person und Bereich', () => {
  it('nur eigene Aufgaben des Bereichs, nur eigene Meilensteine, nie über Abwesenheit/Business-frei/Feiertag', async () => {
    const r = await srv.wochenvorschlagNeu('olaf', MONTAG, 'business', { jetzt: JETZT });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.vorschlag.bloecke.map(b => b.kandidat);
    expect(ids).toContain('a:olaf-krit');
    expect(ids).toContain('m:ms-launch');
    expect(ids).not.toContain('a:pia-krit');
    expect(ids).not.toContain('a:olaf-privat');
    expect(ids).not.toContain('a:olaf-egal');
    expect(ids).not.toContain('m:ms-fremd');
    expect(JSON.stringify(r.vorschlag)).not.toContain('Privat (belegt)');
    for (const b of r.vorschlag.bloecke) {
      expect([tag(1), tag(4), tag(5), tag(6)]).not.toContain(b.date);
      expect(ueberlappt(b, tag(0), '09:45', '11:15')).toBe(false);
      expect(ueberlappt(b, tag(2), '13:00', '17:00')).toBe(false);
    }
    expect(r.vorschlag.top3[0].id).toBe('a:olaf-krit');
    expect(r.vorschlag.hinweise.some(h => h.text.includes('Launch vorbereiten'))).toBe(true);
    expect(existsSync(path.join(ordner, 'wochenvorschlag--olaf.json'))).toBe(true);
    expect(kal.angelegt).toEqual([]); // planen legt NICHTS im Kalender an
  });
  it('ein Konto „nur Business“ bekommt Privat nie (403)', async () => {
    const r = await srv.wochenvorschlagLesen('pia', MONTAG, 'privat', JETZT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
  it('vergangene Wochen gibt es nicht', () => {
    expect(srv.wocheAus('2026-10-19', '2026-11-01')).toBeNull();
    expect(srv.wocheAus('2026-11-04', '2026-11-01')).toBe(MONTAG);
  });
});

describe('Server — Freigabe per Klick, idempotent', () => {
  it('falscher Stand → 409; richtig → angelegt; zweiter Klick → nichts doppelt', async () => {
    const p = await srv.wochenvorschlagNeu('olaf', MONTAG, 'business', { jetzt: JETZT });
    if (!p.ok) throw new Error('planen');
    const alt = await srv.wochenvorschlagUebernehmen('olaf', { montag: MONTAG, bereich: 'business', stand: 'alt', jetzt: JETZT });
    expect(alt.ok).toBe(false);
    if (!alt.ok) expect(alt.status).toBe(409);
    expect(kal.angelegt).toEqual([]);
    const r1 = await srv.wochenvorschlagUebernehmen('olaf', { montag: MONTAG, bereich: 'business', stand: p.vorschlag.stand, jetzt: JETZT });
    expect(r1.ok && r1.angelegt).toBe(p.vorschlag.bloecke.length);
    expect(kal.angelegt.every(b => b.person === 'olaf' && b.uid?.startsWith(WV_UID_PRAEFIX) && b.art === 'fokus')).toBe(true);
    expect(kal.angelegt.find(b => b.taskId === 'olaf-krit')).toBeTruthy();
    const r2 = await srv.wochenvorschlagUebernehmen('olaf', { montag: MONTAG, bereich: 'business', stand: p.vorschlag.stand, jetzt: JETZT });
    expect(r2.ok && r2.angelegt).toBe(0);
    expect(r2.ok && r2.schon).toBe(p.vorschlag.bloecke.length);
    expect(kal.angelegt).toHaveLength(p.vorschlag.bloecke.length);
    // Neu planen danach: die übernommenen bleiben stehen (gleiche UIDs), nichts wird doppelt vorgeschlagen.
    const n = await srv.wochenvorschlagNeu('olaf', MONTAG, 'business', { jetzt: JETZT });
    expect(n.ok && n.uebernommen.length).toBe(p.vorschlag.bloecke.length);
    expect(n.ok && n.vorschlag.bloecke.map(b => b.uid).sort()).toEqual(p.vorschlag.bloecke.map(b => b.uid).sort());
  });
  it('Auswahl und Verschieben: nur gewählte, verschoben über Termine → nicht angelegt', async () => {
    const p = await srv.wochenvorschlagNeu('olaf', MONTAG, 'business', { jetzt: JETZT });
    if (!p.ok) throw new Error('planen');
    const [a, b] = p.vorschlag.bloecke;
    const r = await srv.wochenvorschlagUebernehmen('olaf', { montag: MONTAG, bereich: 'business', stand: p.vorschlag.stand, ids: [a.id, b.id], verschoben: [{ id: b.id, date: tag(0), startMin: 10 * 60 }], jetzt: JETZT });
    expect(r.ok && r.angelegt).toBe(1);
    expect(r.ok && r.belegt.map(x => x.id)).toEqual([b.id]);
    expect(kal.angelegt).toHaveLength(1);
  });
});

describe('Route und Montag-Rhythmus', () => {
  it('Dienstweg → 403, ohne Sitzung → 403', async () => {
    const { GET, POST } = await import('@/app/api/planung/wochenvorschlag/route');
    const d = await GET(new Request(`http://test/api/planung/wochenvorschlag?woche=${MONTAG}`, { headers: { 'x-make-key': 'pruef-schluessel-wochenvorschlag', 'x-make-person': 'olaf' } }));
    expect(d.status).toBe(403);
    const o = await POST(new Request('http://test/api/planung/wochenvorschlag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'planen', woche: MONTAG }) }));
    expect(o.status).toBe(403);
  });
  it('Montag: je Person bereitlegen + EINE Meldung, nichts im Kalender; zweiter Lauf tut nichts', async () => {
    await db.saveJson('wochenvorschlag--olaf', { v: 1, eintraege: {} });
    mel.liste.length = 0;
    const montagFrueh = new Date('2026-11-02T06:00:00Z');
    const a = await srv.wochenvorschlaegeBereitlegen(montagFrueh);
    expect(a.personen).toBe(2);
    expect(a.neu).toBe(2);
    expect(kal.angelegt).toEqual([]);
    expect(mel.liste.map(m => m.an).sort()).toEqual(['olaf', 'pia']);
    expect(mel.liste.every(m => m.titel.startsWith('Wochenvorschlag bereit') && m.link.includes('modus=planen'))).toBe(true);
    const b = await srv.wochenvorschlaegeBereitlegen(montagFrueh);
    expect(b.neu).toBe(0);
    expect(mel.liste).toHaveLength(2);
    // Konto „nur Business“: nur der Business-Vorschlag liegt bereit.
    expect(await srv.wochenvorschlagGespeichert('pia', MONTAG, 'privat')).toBeNull();
    expect(await srv.wochenvorschlagGespeichert('pia', MONTAG, 'business')).not.toBeNull();
  });
});
