// ─── Prüf-Funde 11.10. (CRM/Inbox/Unternehmen) — die Server-Wege ────────────────────────────────────────────────────────
// Eigener Datenordner, erfundene Konten (@example.invalid), Firmen und Verträge — nie der echte Bestand. Geprüft wird:
//   · H4/Fund 11: Pflicht-/Vertragsfristen und Glocke NUR für Konten mit Zugang zur Firmen-Akte (nie „nur Business“)
//   · M8/N10: Konto löschen tilgt den Speichernamen in Treppe, Vertriebsplanung, Register-Fassungen; Übergaben samt Dateien weg; Export nennt sie
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-pruef-1110-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-1110';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-1110-0123456789abcdef0123';
process.env.MAKE_OS_OHNE_APPLE = '1';
delete process.env.MAKE_OS_GRABSTEINE_DIR;
delete process.env.ANTHROPIC_API_KEY;

const D = 'example.invalid';
const H = 'h-pruef';
const heute = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const plus = (n: number) => { const d = new Date(`${heute()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
let db: typeof import('@/lib/store/local-db');

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'pa', email: `pa@${D}`, name: 'Anna Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H, teilt: { gesundheit: [] } },
    { id: '2', speicher: 'pb', email: `pb@${D}`, name: 'Bert Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H, finanzRecht: 'business', teilt: { gesundheit: [] } },
    { id: '3', speicher: 'pc', email: `pc@${D}`, name: 'Clara Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', haushalt: H, teilt: { gesundheit: [] } },
  ], einladungen: [] });
  // Register: eine GmbH mit fälliger Pflicht (gegründet 2023) und ein Vertrag mit „kündigen bis“ im Vorlauf; eine Fassung von „pc“.
  await db.saveJson(`gesellschaften--${H}`, { gesellschaften: [{
    id: 'ug', rechtsform: 'gmbh', status: 'eingetragen', gegruendetAm: '2023-01-10', stammkapitalCent: 2_500_000, geaendertVon: 'pc',
    gesellschafter: [{ id: 'gs-aaaa-0001', wer: { art: 'gesellschaft', id: 'kdv' }, nennbetragCent: 2_500_000, einlage: 'ja' }],
    vertraege: [{ id: 'vt-aaaa-0001', art: 'sonstiges', titel: 'Erfundener Geheimvertrag', status: 'laufend', kuendigenBis: plus(10), kuendigungsfrist: '3 Monate' }],
    fassungen: [{ id: 'fs-aaaa-0001', merkmal: 'sitz', ab: '2026-01-01', text: 'Erfundener Ort', von: 'pc', angelegt: '2026-01-02T00:00:00.000Z' }],
  }] });
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten().catch(() => {});
  rmSync(ordner, { recursive: true, force: true });
});

describe('H4 / Fund 11 — Firmen-Akte nur mit Zugang: Fristen, Aufgaben-Texte, Glocke', () => {
  it('Pflicht- und Vertragsfristen: Konto „nur Business“ bekommt keine, volles Mitglied schon; ohne Person keine', async () => {
    const { schildFristenLesen } = await import('@/lib/gesellschaften/schild-server');
    const { vertragsFristenLesen, fristenLesen } = await import('@/lib/kalender/fristen-server');
    expect((await schildFristenLesen('pa')).length).toBeGreaterThan(0);
    expect(await schildFristenLesen('pb')).toEqual([]);
    expect(await schildFristenLesen(null)).toEqual([]);
    expect((await vertragsFristenLesen('pa')).length).toBe(1);
    expect(await vertragsFristenLesen('pb')).toEqual([]);
    const f = await fristenLesen(plus(-400), plus(400), heute(), 'pb');
    expect(JSON.stringify(f)).not.toMatch(/Geheimvertrag|Jahresabschluss|§/);
  });
  it('Erinnerungen: Aufgaben neutral, Glocke NUR an Konten mit Zugang zur Firmen-Akte', async () => {
    const { schildErinnerungen } = await import('@/lib/gesellschaften/schild-server');
    const { vertragsErinnerungen } = await import('@/lib/gesellschaften/server');
    expect((await schildErinnerungen(H)).neu).toBeGreaterThan(0);
    expect((await vertragsErinnerungen(H)).neu).toBe(1);
    const tasks = (await db.loadJson<{ tasks: { id: string; title: string; description?: string }[] }>('tasks'))!.tasks.filter(t => /^(usp|usd|usm|usr|vte)-/.test(t.id));
    expect(tasks.length).toBeGreaterThan(1);
    expect(JSON.stringify(tasks)).not.toMatch(/Geheimvertrag|3 Monate|Folge bei Versäumnis|§/);
    expect((await db.loadJson<{ eintraege: unknown[] }>('meldungen--pa'))?.eintraege.length ?? 0).toBeGreaterThan(0);
    expect(await db.loadJson('meldungen--pb')).toBeNull();
  });
});

describe('M8 / N10 — Konto löschen: Stempel getilgt, Übergaben samt Dateien weg; Export nennt die eigenen Stempel', () => {
  it('Treppe, Vertriebsplanung, Register-Fassungen und Übergaben', async () => {
    const J = '2026-10-01T08:00:00.000Z';
    await db.saveJson(`produkt-treppe--${H}`, {
      version: 1, zielJahr: 2026, roadmap: [], kreislauf: [], marken: {},
      stufen: [{ id: 'ts-aaaa-0001', name: 'Stufe', ebene: 1, lieferobjekte: ['Befund'], preis: { art: 'fest', betrag: 100 }, regeln: {}, leistungIds: [], geaendert: J, geaendertVon: 'pc' }],
      positionierung: { claim: 'Erfundener Claim', geaendert: J, geaendertVon: 'pc' },
      kunden: { 'm-1': { erledigt: [{ was: 'Befund', am: '2026-10-01', von: 'pc' }], verlauf: [], geaendert: J, geaendertVon: 'pa' } },
      reports: { 'm-1': { gesendetAm: '2026-10-02', gesendetVon: 'pc' } },
    });
    await db.saveJson(`markttraktion-planung--${H}`, {
      version: 1, kanaele: [], ziele: [], zeiten: { gespraech: 45, angebot: 120, nachfassen: 15, beitrag: 30 },
      challenges: [{ id: 'chl-aaaa-0001', woche: '2026-10-05', art: 'gespraeche', titel: 'Erfunden', ziel: 3, person: 'beide', geaendert: J, geaendertVon: 'pc' }],
      nachLeistung: { 'm-1': { testimonial: { am: '2026-10-01', von: 'pc' } } },
    });
    const { bildAblegen, bildOeffnen } = await import('@/lib/store/bild-ablage');
    const datei = 'ua-11111111-2222-4333-8444-555555555555.bin';
    await bildAblegen('inbox-uebergaben', datei, Buffer.from('%PDF-1.4 erfunden'));
    const nachricht = { id: 'n1', am: J, von: { email: `a@kunde.${D}` }, an: [], cc: [], betreff: 'B', text: 'T', vonUns: false, anhaenge: [{ teil: '2', name: 'a.pdf', typ: 'application/pdf', groesse: 3, ablage: datei }] };
    await db.saveJson(`inbox-uebergaben--${H}`, { v: 1, uebergaben: [
      { id: 'ub-weg', von: 'pc', an: 'pa', gespraech: 'gm~1', quelle: 'gmail', postfachId: 'gmail', bereich: 'ug', betreff: 'B', gegenueber: { email: `a@kunde.${D}` }, kuemmert: 'pa', status: 'offen', angelegtAm: J, kopieAm: J, geaendertAm: J, nachrichten: [nachricht], verlauf: [] },
      { id: 'ub-bleibt', von: 'pa', an: 'pb', gespraech: 'gm~2', quelle: 'gmail', postfachId: 'gmail', bereich: 'ug', betreff: 'B', gegenueber: { email: `b@kunde.${D}` }, kuemmert: 'pb', status: 'offen', angelegtAm: J, kopieAm: J, geaendertAm: J, nachrichten: [{ ...nachricht, id: 'n2', anhaenge: [] }], verlauf: [] },
    ] });
    const K = await import('@/lib/datenschutz/konto-daten');
    const ex = await K.kontoExport('pc');
    expect(ex!.eintraege[`produkt-treppe--${H}`]?.length).toBe(4);
    expect(ex!.eintraege[`markttraktion-planung--${H}`]?.length).toBe(2);
    expect(ex!.eintraege[`gesellschaften--${H}`]).toEqual([{ gesellschaftId: 'ug', id: 'fs-aaaa-0001', merkmal: 'sitz', ab: '2026-01-01', angelegt: '2026-01-02T00:00:00.000Z' }]);
    const b = await K.kontoLoeschen('pc', { grabstein: false });
    expect(b!.eintraege[`inbox-uebergaben--${H}`]).toBe(1);
    for (const n of [`produkt-treppe--${H}`, `markttraktion-planung--${H}`, `gesellschaften--${H}`]) {
      const roh = JSON.stringify(await db.loadJson(n));
      expect(roh, n).not.toContain('"pc"');
      expect(roh, n).toContain('[gelöscht]');
    }
    expect(JSON.stringify(await db.loadJson(`gesellschaften--${H}`))).toContain('Erfundener Ort');
    const ub = await db.loadJson<{ uebergaben: { id: string }[] }>(`inbox-uebergaben--${H}`);
    expect(ub!.uebergaben.map(u => u.id)).toEqual(['ub-bleibt']);
    expect(await bildOeffnen('inbox-uebergaben', datei)).toBeNull();
  });
});
