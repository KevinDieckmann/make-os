// Steuern der Hauptgesellschaft (15.10., Kevin: „Ja, wie bei KD Ventures“): die Gesellschaft mit der Kennung `ug` hat Fristen (§ 108 AO, Werktag),
// Steuer-Aufgaben davor und eine Schätzung mit offengelegten Annahmen — wie KD Ventures. Rechtsform und Sätze kommen, wo vorhanden, aus dem
// Steuerprofil der Finanzplanung. Wächter: KD Ventures bleibt unverändert (Fristen, Kennungen, bestehende Aufgaben), Kennungen kollidieren nie,
// vor der Gründung gibt es keine Fristen. Hinweis, keine Steuerberatung. Erfundene Konten, eigener Datenordner.
import { describe, it, expect, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-steuern-ug-'));
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
for (const k of ['MAKE_OS_DATEN_SCHLUESSEL', 'MAKE_OS_DEMO', 'MAKE_OS_EINRICHTUNG']) delete process.env[k];
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const R = await import('@/lib/steuern/rechnen');
const { STANDARD_STEUERN, fristen, prognose, jahresgewinn, mitFinanzplanung, mitGruendung, uebergabeJahr, uebergabeMonat, steuernNurBusiness, STEUER_FIRMEN } = R;
const HEUTE = '2026-10-15';

/** Die Fristen von KD Ventures VOR dieser Änderung (Stand c260971a, gerechnet mit den Vorgaben am 15.10.2026) — sie dürfen sich nie ändern. */
const KDV_VORHER = [
  'kdv-ust-2026-10-12', 'kdv-gewst-2026-11-16', 'kdv-kst-2026-12-10', 'kdv-offenlegung-2026-12-31', 'kdv-ust-2027-01-11', 'kdv-gewst-2027-02-15',
  'kdv-erklaerung-2027-03-01', 'kdv-kst-2027-03-10', 'kdv-ust-2027-04-12', 'kdv-gewst-2027-05-18', 'kdv-kst-2027-06-10', 'kdv-ust-2027-07-12',
  'kdv-gewst-2027-08-16', 'kdv-kst-2027-09-10', 'kdv-ust-2027-10-11',
];

describe('Fristen: die Hauptgesellschaft wie KD Ventures', () => {
  const f = fristen(STANDARD_STEUERN, HEUTE);
  it('ug hat Termine wie kdv — USt-Voranmeldung, KSt-/GewSt-Vorauszahlungen, Erklärung, Offenlegung (Werktag nach § 108 AO)', () => {
    expect(STEUER_FIRMEN).toContain('ug');
    expect(STANDARD_STEUERN.ug).toMatchObject({ rechtsform: 'gmbh', ust: 'quartal', gewerbe: true });
    const ug = f.filter(x => x.einheit === 'ug');
    const kdv = f.filter(x => x.einheit === 'kdv');
    expect(ug.map(x => [x.art, x.datum])).toEqual(kdv.map(x => [x.art, x.datum]));
    expect(ug.map(x => x.id)).toEqual(expect.arrayContaining(['ug-ust-2026-10-12', 'ug-gewst-2026-11-16', 'ug-kst-2026-12-10', 'ug-offenlegung-2026-12-31', 'ug-erklaerung-2027-03-01']));
  });
  it('bestehende kdv-Fristen unverändert, Kennungen kollidieren nie (je Einheit eigener Präfix)', () => {
    expect(f.filter(x => x.einheit === 'kdv').map(x => x.id)).toEqual(KDV_VORHER);
    const ids = f.map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of f.filter(y => y.einheit === 'ug')) expect(x.id.startsWith('ug-')).toBe(true);
    // Die Business-Einheit der Aufgabe kommt aus der Kennung — kdv und ug verwechseln sich nie.
  });
  it('vor der Gründung (Register) keine Frist — keine Erklärung für Jahre davor, keine Vorauszahlung davor', () => {
    const e = mitGruendung(STANDARD_STEUERN, { ug: '2026-09-30' });
    const ug = fristen(e, HEUTE).filter(x => x.einheit === 'ug');
    expect(ug.some(x => x.art === 'erklaerung' && x.titel.includes('2025'))).toBe(false);
    expect(ug.some(x => x.art === 'offenlegung' && x.titel.includes('2025'))).toBe(false);
    expect(ug.every(x => x.datum > '2026-09-30')).toBe(true);
    // Andere Gesellschaften bleiben, wie sie sind; ein ungültiger Tag ändert nichts.
    expect(fristen(e, HEUTE).filter(x => x.einheit === 'kdv').map(x => x.id)).toEqual(KDV_VORHER);
    expect(mitGruendung(STANDARD_STEUERN, { ug: 'irgendwann' })).toBe(STANDARD_STEUERN);
    expect(uebergabeJahr(2025, {}, { ug: '2026-09-30' }).some(p => p.einheit === 'ug')).toBe(false);
    expect(uebergabeJahr(2025, {}).some(p => p.einheit === 'ug')).toBe(true);
  });
});

describe('Schätzung (Rücklage & Prognose)', () => {
  const ist = (u: number, k: number) => Array.from({ length: 9 }, (_, i) => ({ monat: `2026-0${i + 1}`, umsatz: u, kosten: k, quelle: 'Monatsabschluss' }));
  const g = { kdc: null, kdv: jahresgewinn(ist(5000, 4000), 2026), ug: jahresgewinn(ist(20000, 16000), 2026) };
  it('ohne Finanzplanung: wie KD Ventures (15,825 % KSt+Soli + 3,5 % × Hebesatz), mit Vorauszahlungen der Hauptgesellschaft', () => {
    const e = { ...STANDARD_STEUERN, vorauszahlung: { kstUg: 1000, gewstUg: 500 } };
    const p = prognose(e, HEUTE, g, {}, null);
    const z = p.zeilen.find(x => x.id === 'kst-ug')!;
    // 48.000 € hochgerechnet × (0,15825 + 0,035 × 4,1) − 3 KSt-VZ (März, Juni, Sept.) − 3 GewSt-VZ (Feb., Mai, Aug.)
    expect(z.betrag).toBeCloseTo(48000 * (0.15825 + 0.035 * 4.1) - 3 * 1000 - 3 * 500, 5);
    expect(z.formel).toContain('15,825 % KSt+Soli');
    expect(z.einheit).toBe('ug');
    // KD Ventures unverändert: Kennung `kst`, dieselbe Formel.
    expect(p.zeilen.find(x => x.id === 'kst')!.betrag).toBeCloseTo(12000 * (0.15825 + 0.035 * 4.1), 5);
    expect(p.je.ug.soll).toBeCloseTo(z.betrag!, 5);
  });
  it('ohne Ist-Monate: ehrlich „fehlt“ mit Weg zum Monatsabschluss — kein erfundener Betrag', () => {
    const z = prognose(STANDARD_STEUERN, HEUTE, { kdv: null, ug: null }, {}, null).zeilen.find(x => x.id === 'kst-ug')!;
    expect(z.betrag).toBeNull();
    expect(z.luecke).toMatch(/Ist-Monate .* fehlen/);
    expect(z.href).toContain('abschluss');
  });
  it('mit Finanzplanung: Rechtsform und Sätze aus dem Steuerprofil (Hebesatz, Messzahl, KSt, Soli; Gewerbesteuer an/aus)', () => {
    const profil = { kapital: true, kstAn: true, kst: 0.15, soliAn: true, soli: 0.055, gewstAn: true, messzahl: 0.035, hebesatz: 470, plan: 'Arbeitsplan' };
    const e = mitFinanzplanung(STANDARD_STEUERN, null, profil);
    expect(e.ug).toMatchObject({ rechtsform: 'gmbh', gewerbe: true, saetze: { hebesatz: 470, plan: 'Arbeitsplan' } });
    expect(e.kdv).toBe(STANDARD_STEUERN.kdv); // KD Ventures unberührt
    const z = prognose(e, HEUTE, g, {}, null).zeilen.find(x => x.id === 'kst-ug')!;
    expect(z.betrag).toBeCloseTo(48000 * (0.15 * 1.055 + 0.035 * 4.7), 5);
    expect(z.formel).toContain('Sätze aus der Finanzplanung');
    // Gewerbesteuer im Profil aus → nur KSt+Soli; keine Kapitalgesellschaft → keine Schätzung, Weg in die Finanzplanung.
    expect(prognose(mitFinanzplanung(STANDARD_STEUERN, null, { ...profil, gewstAn: false }), HEUTE, g, {}, null).zeilen.find(x => x.id === 'kst-ug')!.betrag).toBeCloseTo(48000 * 0.15 * 1.055, 5);
    const einzel = prognose(mitFinanzplanung(STANDARD_STEUERN, null, { ...profil, kapital: false }), HEUTE, g, {}, null).zeilen.find(x => x.id === 'kst-ug')!;
    expect(einzel.betrag).toBeNull();
    expect(einzel.href).toContain('steuern=ug');
    // Ohne Plan: die gespeicherte Einstellung (dasselbe Objekt).
    expect(mitFinanzplanung(STANDARD_STEUERN, null, null)).toBe(STANDARD_STEUERN);
  });
  it('Business-Sicht behält die Vorauszahlungen der Hauptgesellschaft; Übergabe: Monatsabschluss für beide Gesellschaften', () => {
    const e = { ...STANDARD_STEUERN, vorauszahlung: { est: 100, kstUg: 1000, gewstUg: 500, kst: 10 } };
    const p = prognose(e, HEUTE, g, {}, null);
    const st = steuernNurBusiness({ einstellungen: e, fristen: [], ust: [], prognose: p, gewinn: g, uebergabe: { monat: '2026-09', punkte: [], jahr: 2025, jahresPunkte: [] } });
    expect(st.einstellungen.vorauszahlung).toEqual({ kst: 10, kstUg: 1000, gewstUg: 500 });
    expect(st.prognose.zeilen.some(x => x.id === 'kst-ug')).toBe(true);
    const m = uebergabeMonat('2026-09', { rechnungen: [], belege: [], abschluesse: [{ firma: 'kdv', monat: '2026-09' }], buchungsMonate: [], abgehakt: {} });
    expect(m.find(x => x.key.endsWith(':abschluss'))).toMatchObject({ status: 'offen', unter: expect.stringContaining('nur') });
  });
});

describe('Steuer-Aufgaben (Server): ug neu, kdv unverändert, zuständig ist der Inhaber der Instanz', () => {
  it('legt Aufgaben `steuer-ug-…` an, lässt bestehende kdv-Aufgaben wie sie sind — nie eine feste Person', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [
      { id: 'k1', speicher: 'person-a', email: 'a@example.invalid', name: 'Person A', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-steuer' },
    ], einladungen: [] });
    const bestehend = { id: 'steuer-kdv-ust-2026-10-12', title: 'KD Ventures: Umsatzsteuer (Beispiel von früher)', description: 'alt', status: 'todo', priority: 'medium', assignee: 'person-a', tags: ['steuern'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-10-05T08:00:00.000Z', updatedAt: '2026-10-05T08:00:00.000Z', dueDate: '2026-10-12', spaceId: 'kdv' };
    await db.saveJson('tasks', { tasks: [bestehend], projects: [] });
    // Was die Aufgabe ausmacht (die Übernahme beim Schreiben ergänzt nur abgeleitete Felder wie Projekt „Sonstige“ und Bereich).
    const kern = (t: Record<string, unknown> | undefined) => JSON.stringify(['title', 'description', 'status', 'priority', 'assignee', 'dueDate', 'createdAt', 'updatedAt', 'spaceId', 'tags'].map(k => t?.[k]));
    const vorher = kern(bestehend);
    const { steuerAufgabenAbgleichen } = await import('@/lib/steuern/speicher');
    await steuerAufgabenAbgleichen(fristen(STANDARD_STEUERN, HEUTE), HEUTE);
    const tasks = (await db.loadJson<{ tasks: { id: string; title: string; assignee?: string; spaceId?: string; einheit?: string }[] }>('tasks'))!.tasks;
    // Die bestehende kdv-Aufgabe bleibt, wie sie war (Titel, Text, Status, Zuständig, Frist, Zeitstempel).
    expect(kern(tasks.find(t => t.id === bestehend.id) as unknown as Record<string, unknown>)).toBe(vorher);
    const ug = tasks.find(t => t.id === 'steuer-ug-ust-2026-10-12')!;
    expect(ug).toBeTruthy();
    expect(ug.spaceId).toBe('ug');
    expect(ug.assignee).toBe('person-a');
    expect(ug.title).not.toMatch(/€|\d+,\d{2}/); // ohne Betrag im Titel
    expect(tasks.filter(t => t.id === 'steuer-kdv-ust-2026-10-12')).toHaveLength(1);
    expect(tasks.some(t => t.assignee === 'kevin')).toBe(false);
  });
});
