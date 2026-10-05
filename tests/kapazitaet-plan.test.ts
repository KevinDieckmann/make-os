// ─── Wochenplan festhalten (Kevin 05.10.): Schnappschuss je Woche, echte Plan-Treue „geplant vs. Ist“, Löschfristen, Auskunft ─
// Eigener Datenordner, erfundene Personen (@example.invalid), erfundene Werte — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { rmSync } from 'node:fs';

// Vor allen Imports (auch den statischen weiter unten): eigener Datenordner.
const { ordner } = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { default: path } = await import('node:path');
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'make-os-kapa-plan-'));
  Object.assign(process.env, { MAKE_OS_DATEN_DIR: ordner, MAKE_OS_KEY: 'pruef-schluessel-kapa-plan', MAKE_OS_OHNE_APPLE: '1' });
  delete process.env.MAKE_OS_DATENSCHLUESSEL;
  return { ordner };
});

import { kapazitaetRechnen } from '@/lib/kapazitaet/modell';
import { kpMessung } from '@/lib/kapazitaet/kennzahlen';
import { planFesthalten, planOhnePersonen, planFuerPerson, treueAusPlaenen, sauberPlanDatei, planAufbewahrenAb, schnappschussAus } from '@/lib/kapazitaet/plan';
import type { KapaEingabe, PersonEingabe, PostenEingabe, PlanSchnappschuss } from '@/lib/kapazitaet/typen';
import { SPEICHER_REGISTER, registerEintrag } from '@/lib/crm/speicher-register';
import { LOESCHREGELN, verarbeitungenOrganisation, verarbeitungenOrganisationNachtragen } from '@/lib/crm/datenschutz';

const HEUTE = '2026-10-05'; // Montag
const A: PersonEingabe = { id: 'konto-a', name: 'Anna', quelle: 'konto' };
const T: PersonEingabe = { id: 't-frei', name: 'Frieda', quelle: 'team' };
const ms = (id: string, x: Partial<PostenEingabe> = {}): PostenEingabe => ({ art: 'meilenstein', id, titel: `MS ${id}`, termin: '2026-10-16', fortschritt: 0, erledigt: false, ...x });
const rechne = (x: Partial<KapaEingabe> = {}) => kapazitaetRechnen({
  heute: HEUTE, wochen: 12, personen: [A, T], posten: [],
  datei: { personen: { 'konto-a': { stundenWoche: 40 }, 't-frei': { stundenWoche: 20 } }, zuweisungen: [{ id: 'kz-1', person: 'konto-a', art: 'mandat', bezugId: 'm-1', stundenWoche: 10 }] },
  ...x,
});
const schnapp = (woche: string, geplantA: number, x: Partial<PlanSchnappschuss> = {}): PlanSchnappschuss => ({
  woche, ab: woche, erstellt: `${woche}T06:00:00.000Z`,
  personen: [
    { id: 'konto-a', quelle: 'konto', verfuegbar: 40, geplant: geplantA, gebunden: 10, posten: [], zuweisungen: [] },
    { id: 't-frei', quelle: 'team', verfuegbar: 20, geplant: 15, gebunden: 0, posten: [], zuweisungen: [] },
  ],
  ...x,
});

describe('Wochenplan aus der Rechnung', () => {
  it('je Person: verfügbar (Netto), geplant = Bedarf, gebunden, je Meilenstein und je Zuweisung — Summen stimmen', () => {
    const st = rechne({ posten: [ms('x', { aufwand: 40, personen: ['konto-a'] }), ms('y', { aufwand: 10, termin: '2026-10-09' })] });
    const plan = st.wochenPlan!;
    expect(plan.woche).toBe('2026-10-05');
    expect(plan.ab).toBe(HEUTE);
    const a = plan.personen.find(p => p.id === 'konto-a')!;
    expect(a.verfuegbar).toBe(40);
    expect(a.gebunden).toBe(10);
    expect(a.zuweisungen).toEqual([{ id: 'kz-1', stunden: 10 }]);
    expect(a.geplant).toBe(st.personen[0].wochen[0].bedarf);
    const summePosten = a.posten.reduce((s, p) => s + p.stunden, 0);
    expect(Math.abs(a.gebunden + summePosten - a.geplant)).toBeLessThan(0.3);
    expect(a.posten.map(p => p.id).sort()).toEqual(['x', 'y']);
    // y (ganzes Team, Termin Freitag) liegt auch bei Frieda.
    expect(plan.personen.find(p => p.id === 't-frei')!.posten.map(p => p.id)).toEqual(['y']);
  });

  it('verfügbar OHNE Kopf & Energie (Art. 9: kein Gesundheitswert im Schnappschuss)', () => {
    const st = rechne({ personen: [{ ...A, erholung: 20 }] });
    expect(st.personen[0].wochen[0].belastbar).toBeLessThan(st.personen[0].wochen[0].netto);
    expect(st.wochenPlan!.personen[0].verfuegbar).toBe(st.personen[0].wochen[0].netto);
    expect(JSON.stringify(schnappschussAus(st.wochenPlan!, 'x'))).not.toMatch(/erholung|titel|name/i);
  });

  it('Team-Personen ohne Grundwert stehen nicht im Plan (keine geratene Kapa)', () => {
    const st = rechne({ datei: { personen: { 'konto-a': { stundenWoche: 40 } }, zuweisungen: [] } });
    expect(st.wochenPlan!.personen.map(p => p.id)).toEqual(['konto-a']);
  });
});

describe('Festhalten — idempotent, Löschfrist 24 Monate', () => {
  const plan = rechne({ posten: [ms('x', { aufwand: 20 })] }).wochenPlan!;
  it('erster Lauf der Woche hält fest, der zweite (auch am Mittwoch) ändert nichts', () => {
    const r1 = planFesthalten(null, plan, HEUTE, '2026-10-05T06:00:00.000Z');
    expect(r1).toMatchObject({ neu: true, geaendert: true, entfernt: 0 });
    expect(r1.datei.wochen).toHaveLength(1);
    const r2 = planFesthalten(r1.datei, { ...plan, ab: '2026-10-07' }, '2026-10-07', '2026-10-07T06:00:00.000Z');
    expect(r2).toMatchObject({ neu: false, geaendert: false });
    expect(r2.datei).toEqual(r1.datei);
  });
  it('erster Lauf erst am Mittwoch: festgehalten ab Mittwoch (ab), Woche = Montag', () => {
    const mi = rechne({ heute: '2026-10-07' }).wochenPlan!;
    const r = planFesthalten(null, mi, '2026-10-07', 'x');
    expect(r.datei.wochen[0]).toMatchObject({ woche: '2026-10-05', ab: '2026-10-07' });
  });
  it('Wochen älter als 24 Monate fallen weg, jüngere bleiben', () => {
    expect(planAufbewahrenAb('2026-10-05')).toBe('2024-10-05');
    expect(planAufbewahrenAb('2026-03-31')).toBe('2024-03-31');
    expect(planAufbewahrenAb('2027-03-31', 1)).toBe('2027-02-28');
    const alt = { wochen: [schnapp('2024-09-23', 30), schnapp('2024-09-30', 30), schnapp('2025-01-06', 30)] };
    const r = planFesthalten(alt, null, HEUTE, 'x');
    expect(r.datei.wochen.map(w => w.woche)).toEqual(['2024-09-30', '2025-01-06']);
    expect(r).toMatchObject({ neu: false, entfernt: 1, geaendert: true });
  });
  it('Säubern: Unbrauchbares raus, eine Woche nur einmal, sortiert', () => {
    const d = sauberPlanDatei({ wochen: [schnapp('2026-09-28', 1), { woche: 'kaputt' }, schnapp('2026-09-21', 2), schnapp('2026-09-28', 99)] });
    expect(d.wochen.map(w => [w.woche, w.personen[0].geplant])).toEqual([['2026-09-21', 2], ['2026-09-28', 1]]);
    expect(sauberPlanDatei(null)).toEqual({ wochen: [] });
  });
});

describe('Plan-Treue: geplant (festgehalten) vs. Ist — sonst die Näherung, klar beschriftet', () => {
  const ist = [
    { person: 'konto-a', tag: '2026-09-29', stunden: 12 }, { person: 'konto-a', tag: '2026-10-02', stunden: 12 }, // Woche 28.09.: 24 h
    { person: 'konto-a', tag: '2026-09-22', stunden: 10 }, // Woche 21.09.: 10 h
    { person: 'konto-a', tag: '2026-08-31', stunden: 99 }, // älter als 4 Wochen
  ];
  it('nur abgeschlossene Wochen der letzten 4, nur Personen mit Konto, nur Ist ab dem Festhalten', () => {
    const w = treueAusPlaenen([schnapp('2026-09-21', 20), schnapp('2026-09-28', 30, { ab: '2026-09-30' }), schnapp('2026-10-05', 40), schnapp('2026-08-31', 40)], ist, HEUTE);
    expect(w).toEqual([
      { woche: '2026-09-21', geplant: 20, ist: 10, personen: 1 },
      { woche: '2026-09-28', geplant: 30, ist: 12, personen: 1 }, // der Montag-Wert (29.09.) liegt vor dem Festhalten
    ]);
  });
  it('mit festgehaltenen Wochen: Σ Ist ÷ Σ geplant, Quelle „festgehalten“, Detail je Woche auf die Kapazität', () => {
    const k = rechne({ ist, plaene: [schnapp('2026-09-21', 20), schnapp('2026-09-28', 30)] }).kennzahlen;
    expect(k.planTreueQuelle).toBe('festgehalten');
    expect(k.planTreue).toBe(68); // 34 h ÷ 50 h
    expect(k.planStdWoche).toBe(25);
    expect(k.istStdWoche).toBe(17);
    const m = kpMessung('kp_treue', k);
    expect('wert' in m && m.quelle).toMatch(/geplant vs\. Ist · 2 festgehaltene Wochen/);
    expect(m.details?.map(d => d.titel)).toEqual(['Woche ab 28.09.', 'Woche ab 21.09.']);
    expect(m.details?.every(d => d.href?.startsWith('/os/planung/kapazitaet'))).toBe(true);
  });
  it('ohne festgehaltene Woche: die bisherige Näherung — als Näherung beschriftet', () => {
    const k = rechne({ ist, posten: [ms('x', { aufwand: 40 })] }).kennzahlen;
    expect(k.planTreueQuelle).toBe('naeherung');
    expect(k.treueWochen).toEqual([]);
    const m = kpMessung('kp_treue', k);
    expect('wert' in m && m.quelle).toMatch(/^Näherung \(noch kein Wochenplan festgehalten\)/);
    expect(m.details?.length).toBeGreaterThan(0);
  });
  it('Lücke behält einen Weg zur Kapazität', () => {
    const k = rechne().kennzahlen;
    const m = kpMessung('kp_treue', { ...k, planTreue: null });
    expect('luecke' in m).toBe(true);
    expect(m.details?.[0].href).toContain('/os/planung/kapazitaet');
  });
});

describe('Löschen und Auskunft (rein)', () => {
  it('planOhnePersonen nimmt nur die Zeilen der Person, planFuerPerson liefert nur ihre', () => {
    const d = { wochen: [schnapp('2026-09-21', 20), schnapp('2026-09-28', 30)] };
    const r = planOhnePersonen(d, new Set(['t-frei']));
    expect(r.teile).toBe(2);
    expect(r.datei.wochen.every(w => w.personen.every(p => p.id !== 't-frei'))).toBe(true);
    expect(planOhnePersonen(d, new Set(['niemand'])).teile).toBe(0);
    expect(planFuerPerson(d, 't-frei')).toEqual([
      { woche: '2026-09-21', ab: '2026-09-21', verfuegbar: 20, geplant: 15, gebunden: 0, posten: [], zuweisungen: [] },
      { woche: '2026-09-28', ab: '2026-09-28', verfuegbar: 20, geplant: 15, gebunden: 0, posten: [], zuweisungen: [] },
    ]);
  });
  it('Register und Löschkonzept kennen den Bestand (24 Monate, Beschäftigtendaten)', () => {
    const e = registerEintrag('kapazitaet-plan--h-x');
    expect(e?.muster).toBe('kapazitaet-plan--*');
    expect(e).toMatchObject({ bezug: 'haushalt', kategorie: ['beschaeftigte'] });
    expect(e?.loeschfrist).toContain('24 Monate');
    expect(SPEICHER_REGISTER.filter(x => x.muster === 'kapazitaet-plan--*')).toHaveLength(1);
    expect(LOESCHREGELN.find(r => r.id === 'kapazitaet-plan')?.frist).toBe('24 Monate je Woche');
  });
  it('Verzeichnis: unveränderte Fassung vom 04.10. wird gehoben, von Hand Geändertes bleibt', () => {
    const neu = verarbeitungenOrganisation('2026-10-05T10:00:00.000Z').find(v => v.id === 'vv-kapazitaet')!;
    expect(neu.loeschfrist).toContain('Wochenpläne');
    const alt04 = { ...neu, loeschfrist: neu.loeschfrist.replace(/; festgehaltene Wochenpläne.*$/, '') };
    expect(verarbeitungenOrganisationNachtragen([alt04], '2026-10-05T10:00:00.000Z').find(v => v.id === 'vv-kapazitaet')?.loeschfrist).toBe(neu.loeschfrist);
  });
});

// ── Server: Morgenlauf-Schritt, Team-Löschfrist, Auskunft ──

type Handler = (r: Request) => Promise<Response>;
let db: typeof import('@/lib/store/local-db');
let server: typeof import('@/lib/kapazitaet/server');
let kapa: { GET: Handler };
const HAUS = 'h-plan';
const PLAN = `kapazitaet-plan--${HAUS}`;
const konto = (id: string, sp: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt: string) => ({ id, speicher: sp, email: `${sp}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('1', 'pa', 'Anna Prüf', 'inhaber', HAUS), konto('2', 'pb', 'Bert Prüf', 'mitglied', HAUS)], einladungen: [] });
  await db.saveJson(`team--${HAUS}`, { team: [{ id: 't-frei', name: 'Frieda Erfunden', kurz: 'Frieda', rolle: 'Freie Mitarbeit', email: 'frieda@example.invalid', aktiv: true }] });
  await db.saveJson(`kapazitaet--${HAUS}`, { personen: { 'konto-pa': { stundenWoche: 40 }, 't-frei': { stundenWoche: 20 } }, zuweisungen: [] });
  await db.saveJson('meilensteine', { meilensteine: [
    { id: 'ms-plan', titel: 'Erfundener Schritt', space: 'business', bereich: 'business', faellig: '2026-10-30', fortschritt: 0, erledigt: false, aufwand: 60 },
  ] });
  server = await import('@/lib/kapazitaet/server');
  kapa = (await import('@/app/api/kapazitaet/route')) as unknown as typeof kapa;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Morgenlauf „Wochenplan festhalten“', () => {
  it('hält einmal je Woche fest (idempotent), danach rechnet die Kapazität mit dem Plan', async () => {
    const r1 = await server.kapaPlanFesthalten(HAUS, HEUTE, new Date('2026-10-05T06:00:00.000Z'));
    expect(r1).toMatchObject({ neu: true, woche: '2026-10-05', entfernt: 0 });
    expect(r1.personen).toBeGreaterThanOrEqual(2);
    const d1 = await db.loadJson<{ wochen: PlanSchnappschuss[] }>(PLAN);
    expect(d1?.wochen).toHaveLength(1);
    expect(d1!.wochen[0].personen.find(p => p.id === 'konto-pa')?.posten[0]).toMatchObject({ art: 'meilenstein', id: 'ms-plan' });
    const r2 = await server.kapaPlanFesthalten(HAUS, '2026-10-07', new Date('2026-10-07T06:00:00.000Z'));
    expect(r2.neu).toBe(false);
    expect(await db.loadJson(PLAN)).toEqual(d1);
    // Kein Name, kein Titel im Schnappschuss.
    expect(JSON.stringify(d1)).not.toMatch(/Erfunden|Anna|Frieda/);
  });

  it('Art. 15: die Auskunft der Team-Person enthält ihre festgehaltenen Wochen', async () => {
    const r = await kapa.GET(new Request('http://test/api/kapazitaet?auskunft=t-frei', { headers: { 'x-make-user': 'pa' } }));
    expect(r.status).toBe(200);
    const a = await r.json();
    expect(a.wochenplaene).toHaveLength(1);
    expect(a.wochenplaene[0]).toMatchObject({ woche: '2026-10-05', verfuegbar: 20 });
    expect(a.hinweise.join(' ')).toContain('24 Monate');
  });

  it('Team-Löschfrist gilt mit: 30 Tage nach dem Deaktivieren fallen auch ihre Plan-Zeilen', async () => {
    await db.saveJson(`team--${HAUS}`, { team: [{ id: 't-frei', name: 'Frieda Erfunden', kurz: 'Frieda', rolle: 'Freie Mitarbeit', aktiv: false, deaktiviertAm: '2026-10-01T09:00:00.000Z' }] });
    const b = await server.kapaDeaktivierteAufraeumen(HAUS, new Date('2026-11-01T09:00:00.000Z'));
    expect(b.personen).toBe(1);
    const d = await db.loadJson<{ wochen: PlanSchnappschuss[] }>(PLAN);
    expect(d!.wochen[0].personen.map(p => p.id)).toEqual(['konto-pa', 'konto-pb']);
  });
});
