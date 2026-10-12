// ─── Unternehmen › Schild: Titel der Pflicht-Erinnerungen (12.10.) ──────────────────────────────────────────────────────────────────────
// Gefunden in der Demo: Heute › Top 3 zeigte zweimal „Unternehmen: Frist im Pflichten-Kalender — <Gesellschaft> — bis 31.08.2026“ — seit dem
// Prüf-Fund H4 (11.10.) waren ALLE Pflicht-Titel gleich neutral. Die Aufgaben gehen inzwischen nur an Konten mit Zugang zur Firmen-Akte
// (`rechtPersonen`), darum jetzt: „<Pflicht kurz> — <Gesellschaft> — bis <Datum>“ (ohne Norm, ohne Folge), Beschreibung und Glocke neutral.
// Geprüft wird: Kurzform, eindeutige Titel (zwei Pflichten nie gleich), Nachziehen offener Aufgaben mit dem alten Titel (nur Titel, idempotent,
// nur unerledigte, nie von Hand geänderte), Glocke und Telegram neutral, Konto „nur Business“ bekommt keine Glocke.
// Eigener Datenordner, erfundene Konten (@example.invalid) und Gesellschaften.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-pflicht-titel-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: o, MAKE_OS_KEY: 'pflicht-titel-schluessel', MAKE_OS_PEPPER: 'pflicht-titel-pepper-0123456789abcdef01', MAKE_OS_OHNE_APPLE: '1' });
  delete process.env.MAKE_OS_GRABSTEINE_DIR;
  delete process.env.ANTHROPIC_API_KEY;
  return o;
});
import { lageAus, faelligeSchildErinnerungen, pflichtKurz, pflichtTitel, neutralerPflichtTitel, ALT_PFLICHT_TITEL_PRAEFIX, NEUTRAL_BESCHREIBUNG } from '@/lib/gesellschaften/schild/ampel';
import { PFLICHT_REGELN, EREIGNIS_ARTEN, ZUSATZ_SCHRITTE } from '@/lib/gesellschaften/schild/pflichten';
import type { RegisterGesellschaft } from '@/lib/gesellschaften/modell';
import type { SchildDatei } from '@/lib/gesellschaften/schild/typen';

const GMBH: RegisterGesellschaft = { id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }] };
const ev = (id: string, art: string, datum: string) => ({ id, art, datum });

describe('Kurzform der Pflicht', () => {
  it('ohne Klammer-Zusatz, ohne „— Zusatz“, bei „A, B“ nur A (wenn A mehr als ein Wort ist)', () => {
    expect(pflichtKurz('Jahresabschluss feststellen, Gewinnverwendung beschließen')).toBe('Jahresabschluss feststellen');
    expect(pflichtKurz('Gesellschafterversammlung einladen (Zugang mindestens eine Woche vorher)')).toBe('Gesellschafterversammlung einladen');
    expect(pflichtKurz('Insolvenzantrag — ohne schuldhaftes Zögern, spätestens nach 3 Wochen')).toBe('Insolvenzantrag');
    expect(pflichtKurz('Laufzeit, Kündigung, Verlängerung unter „Verträge“ eintragen (Kalender)')).toBe('Laufzeit, Kündigung, Verlängerung unter „Verträge“ eintragen');
    expect(pflichtKurz('Transparenzregister aktualisieren')).toBe('Transparenzregister aktualisieren');
  });
  it('jede Pflicht des Katalogs: kurz, nie eine Norm, nie leer', () => {
    const titel = [...PFLICHT_REGELN.map(r => r.titel), ...EREIGNIS_ARTEN.flatMap(e => e.pflichten.map(p => p.titel)), ...ZUSATZ_SCHRITTE.map(z => z.titel)];
    const normen = [...PFLICHT_REGELN.map(r => r.norm), ...EREIGNIS_ARTEN.flatMap(e => e.pflichten.map(p => p.norm))].filter(n => n !== '—');
    for (const t of titel) {
      const k = pflichtKurz(t);
      expect(k.length).toBeGreaterThan(3);
      expect(k.length).toBeLessThanOrEqual(73);
      expect(k).not.toMatch(/§|Folge|Bußgeld|Ordnungsgeld/);
      for (const n of normen) expect(k).not.toContain(n);
    }
  });
});

describe('Erinnerungs-Titel: aussagekräftig, eindeutig, Glocke neutral', () => {
  const schild = { gesellschaften: [{ id: 'ug', ereignisse: [
    // Zwei verschiedene Ereignisse am selben Tag tragen Pflichten mit gleichem Klartext („Neue Gesellschafterliste einreichen“) …
    ev('ev-aaaa-0001', 'anteilsuebertragung', '2026-10-01'), ev('ev-aaaa-0002', 'kapitalmassnahme', '2026-10-01'),
    // … und zweimal dasselbe Ereignis am selben Tag sogar mit gleichem Zeitraum.
    ev('ev-aaaa-0003', 'anteilsuebertragung', '2026-10-01'),
  ] }] } as unknown as SchildDatei;
  const lage = lageAus({ gesellschaften: [GMBH] }, schild, '2026-10-10');
  const pflichten = faelligeSchildErinnerungen(lage).filter(x => x.aufgabeId.startsWith('usp-') && !x.erledigt);
  const name = lage.gesellschaften.find(g => g.id === 'ug')!.name;

  it('„<Pflicht kurz> — <Gesellschaft> — bis <Datum>“ ohne Norm und Folge; Beschreibung neutral', () => {
    expect(pflichten.length).toBeGreaterThanOrEqual(6);
    for (const x of pflichten) {
      expect(x.titel).toMatch(new RegExp(`^.+ — ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — bis \\d{2}\\.\\d{2}\\.\\d{4}( · \\d+)?$`));
      expect(x.titel.startsWith(ALT_PFLICHT_TITEL_PRAEFIX)).toBe(false);
      expect(x.titel).not.toMatch(/§|Folge|Bußgeld|Ordnungsgeld/);
      expect(x.beschreibung).toContain(NEUTRAL_BESCHREIBUNG);
      expect(x.beschreibung).not.toMatch(/§|Folge bei Versäumnis/);
    }
    expect(pflichten.some(x => x.titel.startsWith('Neue Gesellschafterliste einreichen'))).toBe(true);
  });
  it('zwei verschiedene Pflichten tragen nie denselben Titel (auch nicht bei gleichem Klartext, Tag und Zeitraum)', () => {
    const t = pflichten.map(x => x.titel);
    expect(new Set(t).size).toBe(t.length);
    expect(t.filter(x => x.startsWith('Neue Gesellschafterliste einreichen')).length).toBeGreaterThanOrEqual(3);
    // Über ALLE offenen Pflichten der Lage (auch die noch nicht fälligen) ebenso.
    const alle = [...pflichtTitel(lage).values()];
    expect(new Set(alle).size).toBe(alle.length);
  });
  it('die Glocke bleibt neutral (alter Titel), Telegram ohnehin über die Kennung', async () => {
    for (const x of pflichten) expect(x.glocke).toBe(neutralerPflichtTitel(name, x.dueDate));
    const { telegramText } = await import('@/lib/meldungen/speicher');
    expect(telegramText({ art: 'vertrag', titel: pflichten[0].titel, bezug: { art: 'aufgabe', id: pflichten[0].aufgabeId } })).toBe('Eine Unternehmens-Pflicht naht — Details in MAKE OS');
    expect(telegramText({ art: 'faellig', titel: `„${pflichten[0].titel}“ ist heute fällig`, bezug: { art: 'aufgabe', id: pflichten[0].aufgabeId } })).toBe('Eine Unternehmens-Pflicht naht — Details in MAKE OS');
  });
});

// ── Server: Nachziehen offener Aufgaben mit dem alten Titel ────────────────────────────────────────────────────────────────────────────

const D = 'example.invalid';
const H = 'h-titel';
const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plus = (n: number) => { const d = new Date(`${heute()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'ta', email: `ta@${D}`, name: 'Tara Titel', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H, teilt: { gesundheit: [] } },
    { id: '2', speicher: 'tb', email: `tb@${D}`, name: 'Tom Titel', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H, finanzRecht: 'business', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  await db.saveJson(`gesellschaften--${H}`, { gesellschaften: [GMBH] });
  // Eine Anteilsübertragung vor zehn Tagen — ihre Pflichten sind jetzt fällig bzw. überfällig.
  await db.saveJson(`unternehmen-schild--${H}`, { gesellschaften: [{ id: 'ug', ereignisse: [ev('ev-bbbb-0001', 'anteilsuebertragung', plus(-10))] }] });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

describe('Server: offene Aufgaben mit dem alten neutralen Titel ziehen nach — nur Titel, idempotent, nur unerledigte', () => {
  it('alter Titel offen → neuer Titel; erledigt bzw. von Hand geändert → bleibt; zweiter Lauf ändert nichts; Glocke neutral, „nur Business“ ohne Glocke', async () => {
    const { schildErinnerungen, unternehmenLage } = await import('@/lib/gesellschaften/schild-server');
    const e = faelligeSchildErinnerungen(await unternehmenLage(H)).filter(x => x.aufgabeId.startsWith('usp-') && !x.erledigt);
    expect(e.length).toBeGreaterThanOrEqual(3);
    const [a, b, c] = e;
    const J = '2026-10-01T08:00:00.000Z';
    const t = (id: string, title: string, status: string, x: Record<string, unknown> = {}) => ({
      id, title, description: 'Aus dem Bereich Unternehmen — die Einzelheiten stehen dort (Link in der Notiz).', status, priority: 'high', assignee: 'ta',
      tags: ['unternehmen', 'pflicht'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: J, updatedAt: J, space: 'business', spaceId: 'ug', dueDate: a.dueDate, ...x,
    });
    await db.saveJson('tasks', { projects: [], listen: [], statusEigen: [], gruppen: [], vorlagen: [], tasks: [
      t(a.aufgabeId, a.glocke!, 'todo'),
      t(b.aufgabeId, b.glocke!, 'done', { completedAt: J }),
      t(c.aufgabeId, 'Von Hand umbenannt', 'todo'),
    ] });
    const r = await schildErinnerungen(H);
    expect(r.umbenannt).toBe(1);
    const nach = (await db.loadJson<{ tasks: { id: string; title: string; status: string; description?: string }[] }>('tasks'))!.tasks;
    const von = (id: string) => nach.find(x => x.id === id)!;
    expect(von(a.aufgabeId).title).toBe(a.titel);
    expect(von(a.aufgabeId).status).toBe('todo');
    expect(von(a.aufgabeId).description).toContain(NEUTRAL_BESCHREIBUNG);
    expect(von(b.aufgabeId).title).toBe(b.glocke);
    expect(von(c.aufgabeId).title).toBe('Von Hand umbenannt');
    // Neue Aufgaben tragen gleich den neuen Titel; Glocke neutral und nur für Konten mit Zugang zur Firmen-Akte.
    for (const x of e.slice(3)) expect(von(x.aufgabeId).title).toBe(x.titel);
    const m = await db.loadJson<{ eintraege: { art: string; titel: string; bezug?: { id: string } }[] }>('meldungen--ta');
    const usp = (m?.eintraege ?? []).filter(x => /^usp-/.test(x.bezug?.id ?? ''));
    expect(usp.some(x => x.art === 'vertrag')).toBe(true);
    // Die Erinnerungs-Glocke (Art „vertrag“) bleibt neutral; JEDE Meldung zu einer Pflicht-Aufgabe geht neutral auf einen Messenger.
    for (const x of usp.filter(y => y.art === 'vertrag')) expect(x.titel.startsWith(ALT_PFLICHT_TITEL_PRAEFIX)).toBe(true);
    const { telegramText } = await import('@/lib/meldungen/speicher');
    for (const x of usp) expect(telegramText(x as Parameters<typeof telegramText>[0])).toBe('Eine Unternehmens-Pflicht naht — Details in MAKE OS');
    expect(await db.loadJson('meldungen--tb')).toBeNull();
    // Zweiter Lauf: nichts mehr nachzuziehen, nichts neu.
    const r2 = await schildErinnerungen(H);
    expect(r2.umbenannt).toBeUndefined();
    expect(r2.neu).toBe(0);
  });
});
