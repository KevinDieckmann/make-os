// ─── Gesamtprüfung 18.10. (L4 B6/B5): Personenlisten nur aus dem Haushalt, Gesundheit nie mit „nur Business“ ─────────────────────────
// Vorher lieferte `/api/konto/ich` in `andere` ALLE Konten der Instanz: ein frisch eingeladenes Konto ohne Haushalt sah die Namen aller Konten
// unter „Gesundheit teilen“ und „Eigene Ziele teilen“ und stand selbst in den Personenlisten der anderen; Gesundheit ließ sich mit jedem Konto
// teilen, auch mit einem Konto „nur Business“. Wächter „Konto ohne Haushalt bekommt keine Namen“ und „Business-Sicht zeigt nie Gesundheit“
// (serverseitig) plus die Texte der Oberfläche. Eigener Datenordner, erfundene Konten (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-konto-personen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-konto-personen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

let db: typeof import('@/lib/store/local-db');
let ich: typeof import('@/app/api/konto/ich/route');
let teilen: typeof import('@/app/api/konto/teilen/route');
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const k = (speicher: string, name: string, extra: Record<string, unknown> = {}) => ({
  id: `k-${speicher}`, speicher, email: `${speicher}@example.invalid`, name, rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01', teilt: { gesundheit: [] as string[] }, ...extra,
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ich = await import('@/app/api/konto/ich/route');
  teilen = await import('@/app/api/konto/teilen/route');
});
beforeEach(async () => {
  await db.saveJson('konten', { konten: [
    // Die Inhaberin hat (Altbestand) schon mit allen geteilt — auch mit dem Konto „nur Business“ und dem Konto ohne Haushalt.
    k('pa', 'Anna Prüf', { rolle: 'inhaber', haushalt: 'h-p', teilt: { gesundheit: ['pb', 'pben', 'pgast'] } }),
    k('pb', 'Bert Prüf', { haushalt: 'h-p' }),
    k('pben', 'Ben Prüfkonto', { haushalt: 'h-p', finanzRecht: 'business' }),
    k('pgast', 'Gast Prüfkonto'),
    k('pfremd', 'Fremd Prüfkonto', { haushalt: 'h-fremd' }),
  ], einladungen: [] });
});
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

const holen = async (p: string) => {
  const r = await ich.GET(new Request('http://test/api/konto/ich', { headers: kopf(p) }));
  const text = await r.text();
  return { text, d: JSON.parse(text) as { andere: { speicher: string; gesundheitTeilbar: boolean; teiltGesundheitMitMir: boolean; nurBusiness?: boolean }[]; andereKonten?: number } };
};

describe('L4 B6: Personenlisten nur aus dem eigenen Haushalt (serverseitig)', () => {
  it('Konto ohne Haushalt bekommt keine Namen — und keine Zahl der Konten', async () => {
    const { text, d } = await holen('pgast');
    expect(d.andere).toEqual([]);
    expect(d.andereKonten).toBeUndefined();
    for (const n of ['Anna', 'Bert', 'Ben', 'Fremd']) expect(text).not.toContain(n);
  });
  it('volles Mitglied: nur der eigene Haushalt — nie das Konto ohne Haushalt, nie ein fremder Haushalt', async () => {
    const { text, d } = await holen('pb');
    expect(d.andere.map(a => a.speicher).sort()).toEqual(['pa', 'pben']);
    expect(text).not.toContain('Gast Prüfkonto');
    expect(text).not.toContain('Fremd Prüfkonto');
    expect(d.andere.find(a => a.speicher === 'pben')).toMatchObject({ nurBusiness: true, gesundheitTeilbar: false });
    expect(d.andere.find(a => a.speicher === 'pa')).toMatchObject({ gesundheitTeilbar: true, teiltGesundheitMitMir: true });
    expect(d.andereKonten).toBeUndefined();
  });
  it('Inhaberin: dieselbe Liste, dazu nur die ZAHL aller anderen Konten (Konto löschen erst, wenn sie allein ist)', async () => {
    const { text, d } = await holen('pa');
    expect(d.andere.map(a => a.speicher).sort()).toEqual(['pb', 'pben']);
    expect(d.andereKonten).toBe(4);
    expect(text).not.toContain('Gast Prüfkonto');
  });
  it('Konto „nur Business“: sieht, wer die Gesundheit „teilt“, nie als geteilt', async () => {
    const { d } = await holen('pben');
    expect(d.andere.every(a => a.teiltGesundheitMitMir === false && a.gesundheitTeilbar === false)).toBe(true);
  });
});

describe('L4 B5/B6: Teilen und Sehen der Gesundheit nur zwischen vollen Mitgliedern desselben Haushalts', () => {
  it('PUT /api/konto/teilen: Gesundheit nur mit vollen Mitgliedern, eigene Ziele nur im Haushalt — der Rest fällt still weg', async () => {
    const r = await teilen.PUT(new Request('http://test/api/konto/teilen', { method: 'PUT', headers: kopf('pa'), body: JSON.stringify({ gesundheit: ['pb', 'pben', 'pgast', 'pfremd'], ziele: ['pb', 'pben', 'pgast', 'pfremd'] }) }));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.gesundheit).toEqual(['pb']);
    expect(d.ziele).toEqual(['pb', 'pben']);
  });
  it('darfGesundheitSehen: ein alter Eintrag öffnet nichts für „nur Business“ oder ein Konto ohne Haushalt', async () => {
    const { darfGesundheitSehen } = await import('@/lib/zoe/raum');
    const req = (p: string) => new Request('http://test/x', { headers: kopf(p) });
    expect(await darfGesundheitSehen(req('pb'), 'pa')).toBe(true);
    expect(await darfGesundheitSehen(req('pben'), 'pa')).toBe(false);
    expect(await darfGesundheitSehen(req('pgast'), 'pa')).toBe(false);
    expect(await darfGesundheitSehen(req('pben'), 'pben')).toBe(true);
  });
  it('rein: haushaltsNachbarn / teilenErlaubt', async () => {
    const { haushaltsNachbarn, teilenErlaubt } = await import('@/lib/zugang/konto-sicht');
    const konten = [{ speicher: 'a', haushalt: 'h' }, { speicher: 'b', haushalt: 'h' }, { speicher: 'c', haushalt: 'h', finanzRecht: 'business' }, { speicher: 'd' }, { speicher: 'e', haushalt: 'x' }];
    expect(haushaltsNachbarn(konten, 'a').map(x => x.speicher)).toEqual(['b', 'c']);
    expect(haushaltsNachbarn(konten, 'd')).toEqual([]);
    expect(teilenErlaubt(konten, 'a', 'b', 'gesundheit')).toBe(true);
    expect(teilenErlaubt(konten, 'a', 'c', 'gesundheit')).toBe(false);
    expect(teilenErlaubt(konten, 'c', 'a', 'gesundheit')).toBe(false);
    expect(teilenErlaubt(konten, 'a', 'c', 'ziele')).toBe(true);
    expect(teilenErlaubt(konten, 'a', 'd', 'ziele')).toBe(false);
    expect(teilenErlaubt(konten, 'a', 'e', 'ziele')).toBe(false);
    expect(teilenErlaubt(konten, 'a', 'a', 'ziele')).toBe(false);
  });
});

describe('L4 B5: die Oberfläche für „nur Business“ nennt keine Privat-Themen', () => {
  const lies = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');
  it('Einstellungen › Konto und die Einrichtung: Sätze ohne Gesundheit/Familie/Haushalt', async () => {
    const { einstellungenFuer } = await import('@/lib/make-one/einstellungen');
    const konto = (nb: boolean) => einstellungenFuer({ nurBusiness: nb }).flatMap(g => g.eintraege).find(e => e.href === '/os/konto')!.was;
    expect(konto(false)).toContain('Gesundheit teilen');
    expect(konto(true)).not.toMatch(/Gesundheit/);
    const { EBENEN, ebeneSatz } = await import('@/lib/make-one/onboarding-data');
    for (const e of EBENEN) expect(ebeneSatz(e, true), e.id).not.toMatch(/Gesundheit|Familie|Haushalt/);
    expect(ebeneSatz(EBENEN[0], false)).toContain('Gesundheit');
  });
  it('Konto-Karte „Gesundheit teilen“, Gruß, Kalender- und Planungs-Filter nur ohne „nur Business“', () => {
    expect(lies('components/os/KontoView.tsx')).toContain('{nurBusiness === false && (\n      <Kachel id="teilen" titel="Gesundheit teilen"');
    expect(lies('components/os/KontoView.tsx')).toContain('andere.filter(a => a.gesundheitTeilbar !== false)');
    expect(lies('components/os/Willkommen.tsx')).toContain("{nurBusiness ? '' : ' (Ziele, Gesundheit)'}");
    expect(lies('app/api/state/willkommen/route.ts')).toContain("konto!.finanzRecht === 'business' ? { nurBusiness: true }");
    expect(lies('components/os/kalender/Kalender.tsx')).toContain('{nurBusiness !== true && <div style={{ marginTop: 8 }}><Segmente');
    expect(lies('components/os/planung/ZieleMeilensteine.tsx')).toContain("filter(k => !(k === 'privat' && nurBusiness === true))");
    expect(lies('components/os/HorizontView.tsx')).toContain("nurBusinessKonto === true && spaceFilterRoh === 'privat' ? 'business'");
  });
});
