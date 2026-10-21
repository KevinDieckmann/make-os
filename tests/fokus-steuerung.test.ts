// ─── Fokus-Steuerung (10.10.) — Wächter „Business bekommt nie Privat, Privat nie Business“ ──────────────────────────────────────
// Entscheidung 10.10.: „Fokus und Kompass zusammenlegen und bei Planung rausnehmen — Planung soll nur Planung sein. Prio und Fokus geben
// wir im Fokus-Bereich … Zeit — Privat wie Business einzeln.“ Befund am Bildschirm: die Business-Sicht zeigte Familie & Partnerschaft,
// Gesundheit, Tagesform und „Privat · Selbstständigkeit“. Geprüft:
//   (a) die reine Regel (Vorgaben je Bereich ohne Überschneidung, Altbestand verteilt, Prüfung lehnt Fremdes ab, Ist nur aus dem eigenen
//       Bereich, Passung, Spiegel nur eigene Säulen, Zeit-Bild je Sicht, Zeit je Einheit je Sicht),
//   (b) die Routen (/api/fokus/steuerung, /api/scores?sicht= — seit 21.10. die Wirkung, /api/state/zeit?sicht=, /api/state/zeit/einheiten?sicht=) mit erfundenen
//       Personen: Inhaber, Mitglied, anderer Haushalt, Konto „nur Business“ — Sicht X bekommt nichts aus Y, getrennte Bestände,
//   (c) Navigation und Oberfläche (Planung nur Planung, Fokus-Knopf im Kopf, alte Adressen leiten weiter, Tagesform/Kompass nur Privat).
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-fokus-steuerung-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-fokus-steuerung';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

// Kalender-Blöcke der Woche (nur Privat zählt sie als „eingeplant“): eine Stunde Erholung.
vi.mock('@/lib/planung/bloecke-server', () => ({
  planBloeckeLesen: async () => [{ id: 'b1', date: '2026-10-10', startMin: 600, dauerMin: 60, titel: 'Erholung', art: 'erholung', quelle: 'kalender' }],
}));
type H = (r: Request) => Promise<Response>;
const kopf = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const anfrage = (url: string, p: string, method = 'GET', body?: unknown) => new Request(`http://test${url}`, { method, headers: kopf(p), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const wurzel = path.resolve(__dirname, '..');
const lies = (rel: string) => readFileSync(path.join(wurzel, rel), 'utf8');

let steuerung: { GET: H; PUT: H };
let db: typeof import('@/lib/store/local-db');
const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

interface Sicht { ok: boolean; bereich: string; stand: string; quelle: string; darfThemen: boolean; themen: { id: string; label: string; gewicht: number; zeit: string[]; einheit?: string; soll: number | null; ist: { sek: number; bewusstSek: number; eingeplantSek: number }; pass: { stufe: string } }[]; quellen: { id: string }[]; einheiten: { id: string }[]; passung: { stufe: string; satz: string } }
const holen = async (wer: string, bereich: string) => { const r = await steuerung.GET(anfrage(`/api/fokus/steuerung?bereich=${bereich}`, wer)); return { status: r.status, text: await r.clone().text(), d: (await r.json()) as Sicht }; };
const setzen = (wer: string, body: Record<string, unknown>) => steuerung.PUT(anfrage('/api/fokus/steuerung', wer, 'PUT', body));

/** Was eine Business-Antwort nie tragen darf (Privat-Vorgaben, Privat-Einheit, Tagesform). */
const PRIVAT_WOERTER = ['Familie', 'Gesundheit', 'Erholung', 'Freunde', 'Tagesform'];
const BUSINESS_WOERTER = ['Sales', 'Marketing', 'Kunden & Mandate', 'Netzwerken'];

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  const k = (id: string, speicher: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) =>
    ({ id, speicher, email: `${speicher}@example.invalid`, name: `${speicher} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
  await db.saveJson('konten', { konten: [
    k('k1', 'person-a', 'inhaber', 'haus-t'), k('k2', 'person-b', 'mitglied', 'haus-t'),
    k('k3', 'person-c', 'mitglied', 'anderes-haus'), k('k4', 'person-d', 'mitglied', 'haus-t', { finanzRecht: 'business' }),
  ], einladungen: [] });
  // Altbestand: die früheren, gemischten Regler und die Themen-Reihenfolge (instanzweit).
  await db.saveJson('fokus-regler', { regler: { health: 90, social: 20, business: 70, finance: 40, planning: 60 }, stand: '2026-10-01T00:00:00Z' });
  await db.saveJson('ordnung', { reihenfolge: ['produkt', 'umsatz', 'recht', 'leben'], zuordnung: {}, stichworte: {}, orgs: {} });
  // Zeit der Person A: Privat und Business mit gleich benannten Bereichen (finanzen) — Business darf die Privat-Zeit nie zählen.
  const t = (h: number) => h * 3600;
  await db.saveJson('zeit--person-a', { tage: { [heute]: {
    auto: { 'privat:gesundheit': t(2), 'privat:finanzen': t(0.5), 'business:markttraktion': t(1), 'business:finanzen': t(0.25) },
    bewusst: { 'privat:gesundheit': t(1) },
    bloecke: [{ von: `${heute}T08:00:00.000Z`, bis: `${heute}T09:00:00.000Z`, schluessel: 'privat:gesundheit', label: 'MARKE-PRIVAT-BLOCK', sek: t(1) },
      { von: `${heute}T10:00:00.000Z`, bis: `${heute}T10:30:00.000Z`, schluessel: 'business:fokus', label: 'MARKE-BUSINESS-BLOCK', sek: t(0.5), einheit: 'KD Ventures' }],
  } } });
  steuerung = (await import('@/app/api/fokus/steuerung/route')) as unknown as typeof steuerung;
}, 60_000);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); vi.restoreAllMocks(); });

describe('(a) Regel — rein', () => {
  it('Vorgaben je Bereich: allgemeine Themen ohne Überschneidung; Business je Business-Gesellschaft, Privat nur Privat-Einheiten', async () => {
    const { vorgabeThemen, einheitenFuer } = await import('@/lib/fokus/steuerung');
    const { BUSINESS_GESELLSCHAFTEN, PRIVAT_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    const p = vorgabeThemen('privat'), b = vorgabeThemen('business');
    expect(p.map(t => t.label)).toEqual(expect.arrayContaining(['Familie & Partnerschaft', 'Gesundheit & Sport', 'Erholung', 'Haushalt', 'Freunde', 'Lernen']));
    expect(b.map(t => t.label)).toEqual(expect.arrayContaining(['Sales', 'Marketing', 'Produkt', 'Kunden & Mandate', 'Finanzen & Admin', 'Netzwerken']));
    expect(p.map(t => t.id).filter(id => b.some(x => x.id === id))).toEqual([]);
    for (const e of einheitenFuer('business')) expect(BUSINESS_GESELLSCHAFTEN).toContain(e.id);
    for (const e of einheitenFuer('privat')) expect(PRIVAT_GESELLSCHAFTEN).toContain(e.id);
    expect(b.filter(t => t.einheit).map(t => t.einheit).sort()).toEqual([...BUSINESS_GESELLSCHAFTEN].sort());
  });

  it('Zeit-Quellen: Business nennt keine Privat-Seite (Gesundheit, Familie, Erholung, Kontakte), Privat keine Business-Seite', async () => {
    const { zeitQuellenFuer } = await import('@/lib/fokus/steuerung');
    const b = zeitQuellenFuer('business').map(q => q.id), p = zeitQuellenFuer('privat').map(q => q.id);
    for (const x of ['gesundheit', 'familie', 'erholung', 'kontakte']) expect(b, x).not.toContain(x);
    for (const x of ['markttraktion', 'mandate', 'unternehmen']) expect(p, x).not.toContain(x);
    expect(p).toContain('erholung');
    expect(b).toContain('markttraktion');
  });

  it('Altbestand: die gemischten Regler werden auf die Bereiche verteilt, der Business-Rang folgt der früheren Reihenfolge', async () => {
    const { themenAusAltbestand, wirksameThemen } = await import('@/lib/fokus/steuerung');
    const alt = { regler: { health: 90, social: 20, business: 70, finance: 40, planning: 60 }, reihenfolge: ['produkt', 'umsatz', 'recht', 'leben'] };
    const p = themenAusAltbestand('privat', alt), b = themenAusAltbestand('business', alt);
    expect(p.quelle).toBe('alt');
    expect(Object.fromEntries(p.themen.map(t => [t.id, t.gewicht]))).toMatchObject({ gesundheit: 90, erholung: 90, familie: 20, freunde: 20, haushalt: 50, lernen: 50 });
    expect(Object.fromEntries(b.themen.map(t => [t.id, t.gewicht]))).toMatchObject({ sales: 70, marketing: 70, kunden: 70, netzwerken: 70, finanzen: 40, produkt: 60 });
    expect(b.themen.map(t => t.id).slice(0, 6)).toEqual(['produkt', 'sales', 'marketing', 'kunden', 'netzwerken', 'finanzen']);
    expect(themenAusAltbestand('privat', null).quelle).toBe('vorgabe');
    // Ein eigener Bestand gewinnt — auch leer (bewusst geleert).
    expect(wirksameThemen('privat', { themen: [] }, alt)).toEqual({ themen: [], quelle: 'neu' });
  });

  it('Prüfung: Fremdes aus dem anderen Bereich, Doppeltes und Unsinn → 400; über den Grenzen → 413 (nie gekürzt)', async () => {
    const { themenPruefen, sollPruefen, THEMEN_MAX, LABEL_MAX } = await import('@/lib/fokus/steuerung');
    const t = (x: Record<string, unknown>) => ({ id: 'x', label: 'X', gewicht: 50, zeit: [], ...x });
    expect(themenPruefen([t({ zeit: ['gesundheit'] })], 'business')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen([t({ zeit: ['markttraktion'] })], 'privat')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen([t({ einheit: 'kdc' })], 'business')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen([t({ einheit: 'kdv' })], 'privat')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen([t({}), t({})], 'privat')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen([t({ gewicht: 140 })], 'privat')).toMatchObject({ ok: false, status: 400 });
    expect(themenPruefen(Array.from({ length: THEMEN_MAX + 1 }, (_, i) => t({ id: `t${i}` })), 'privat')).toMatchObject({ ok: false, status: 413 });
    expect(themenPruefen([t({ label: 'x'.repeat(LABEL_MAX + 1) })], 'privat')).toMatchObject({ ok: false, status: 413 });
    const ok = themenPruefen([t({ id: 'kd', label: ' KD ', gewicht: 67, einheit: 'kdv', zeit: ['markttraktion'] })], 'business');
    expect(ok).toEqual({ ok: true, wert: [{ id: 'kd', label: 'KD', gewicht: 65, zeit: [], einheit: 'kdv' }] });
    expect(sollPruefen({ unbekannt: 3 }, [t({})])).toMatchObject({ ok: false, status: 400 });
    expect(sollPruefen({ x: 99 }, [t({})])).toMatchObject({ ok: false, status: 400 });
    expect(sollPruefen({ x: 2.3 }, [t({})])).toEqual({ ok: true, wert: { x: 2.5 } });
  });

  it('Ist nur aus dem eigenen Bereich: gleich benannte Bereiche (finanzen) zählen nie über den Bereich hinweg', async () => {
    const { istJeThema } = await import('@/lib/fokus/steuerung');
    const summe = { jeSchluessel: { 'privat:finanzen': 1800, 'business:finanzen': 900 }, bewusstJeSchluessel: {} };
    const th = [{ id: 'f', label: 'F', gewicht: 50, zeit: ['finanzen'] }];
    expect(istJeThema('business', th, summe).f.sek).toBe(900);
    expect(istJeThema('privat', th, summe).f.sek).toBe(1800);
    expect(istJeThema('business', [{ id: 'g', label: 'G', gewicht: 50, zeit: [], einheit: 'kdv' }], summe, { kdv: 1200 }).g).toEqual({ sek: 1200, bewusstSek: 1200, eingeplantSek: 0 });
  });

  it('Passung: hohe Priorität mit wenig Zeit = „passen nicht zusammen“; mit Soll Ist ÷ Soll; ohne Messung offen', async () => {
    const { passung } = await import('@/lib/fokus/steuerung');
    const th = [{ id: 'a', label: 'A', gewicht: 80, zeit: ['x'] }, { id: 'b', label: 'B', gewicht: 20, zeit: ['y'] }, { id: 'c', label: 'C', gewicht: 10, zeit: ['z'] }];
    const ist = (a: number, b: number, c: number) => ({ a: { sek: a, bewusstSek: 0, eingeplantSek: 0 }, b: { sek: b, bewusstSek: 0, eingeplantSek: 0 }, c: { sek: c, bewusstSek: 0, eingeplantSek: 0 } });
    const p = passung(th, {}, ist(600, 7200, 7200), 15000);
    expect(p.stufe).toBe('kritisch');
    expect(p.satz).toContain('Fokus und Zeit passen nicht zusammen: A');
    expect(p.zeilen.find(z => z.id === 'c')?.stufe).toBe('achtung'); // niedrige Priorität, viel Zeit
    expect(passung(th, { a: 10 }, ist(36000, 0, 0), 36000).zeilen[0].stufe).toBe('gut');
    expect(passung(th, { a: 10 }, ist(3600, 0, 0), 3600).zeilen[0].stufe).toBe('kritisch');
    expect(passung(th, {}, ist(0, 0, 0), 0).stufe).toBe('offen');
  });

  it('Spiegel in den früheren Fokus-Regler: Privat setzt nur Gesundheit/Familie, Business nur Business/Finanzen/Planung', async () => {
    const { reglerAusThemen, vorgabeThemen } = await import('@/lib/fokus/steuerung');
    expect(Object.keys(reglerAusThemen('privat', vorgabeThemen('privat'))).sort()).toEqual(['health', 'social']);
    expect(Object.keys(reglerAusThemen('business', vorgabeThemen('business'))).sort()).toEqual(['business', 'finance', 'planning']);
    expect(reglerAusThemen('business', [{ id: 'gesundheit', label: 'G', gewicht: 90, zeit: [] }])).toEqual({});
  });

  it('Zeit-Bild je Sicht: Schlüssel, Summen und Blöcke des anderen Bereichs fallen heraus', async () => {
    const { bild, bildFuerSicht } = await import('@/lib/zeitmessung/modell');
    const d = (await db.loadJson('zeit--person-a')) as import('@/lib/zeitmessung/modell').ZeitDatei;
    const b = bildFuerSicht(bild(d, heute), 'business');
    const t = JSON.stringify(b);
    expect(t).not.toContain('privat:');
    expect(t).not.toContain('MARKE-PRIVAT-BLOCK');
    expect(b.sieben.gesamt.privat).toBe(0);
    expect(JSON.stringify(bildFuerSicht(bild(d, heute), 'privat'))).not.toContain('business:');
  });

  it('Zeit je Einheit je Sicht: Business ohne „Privat · …“, Privat nur die Privat-Einheiten', async () => {
    const { zeitJeEinheit } = await import('@/lib/zeitmessung/einheiten');
    const { PRIVAT_EINHEITEN_NAMEN } = await import('@/lib/einheiten');
    const d = (await db.loadJson('zeit--person-a')) as import('@/lib/zeitmessung/modell').ZeitDatei;
    const p = [{ person: 'person-a', name: 'A', datei: d }];
    const b = zeitJeEinheit(p, [], 'woche', heute, null, false, 'business');
    expect(b.gesamt.zeilen.filter(z => z.bereich === 'privat')).toEqual([]);
    for (const n of PRIVAT_EINHEITEN_NAMEN) expect(JSON.stringify(b), n).not.toContain(n);
    const pr = zeitJeEinheit(p, [], 'woche', heute, null, false, 'privat');
    expect(pr.gesamt.zeilen.every(z => z.bereich === 'privat')).toBe(true);
    expect(pr.gesamt.sek).toBe(0); // der Business-Block der Gesellschaft zählt in Privat nie
  });
});

describe('(b) Routen — Sicht X bekommt nichts aus Y', () => {
  it('Business-Sicht: nur Business-Themen, -Quellen und -Einheiten — kein Familie/Gesundheit/Erholung/Privat-Einheit', async () => {
    const { finanzOrtName, PRIVAT_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    const r = await holen('person-a', 'business');
    expect(r.status).toBe(200);
    for (const w of PRIVAT_WOERTER) expect(r.text, w).not.toContain(w);
    for (const g of PRIVAT_GESELLSCHAFTEN) expect(r.text, g).not.toContain(finanzOrtName(g));
    expect(r.d.quelle).toBe('alt');
    expect(r.d.themen[0].id).toBe('produkt');
    // Ist: nur Business-Schlüssel (finanzen 15 min, nicht die 30 min Privat) und der Block der Gesellschaft.
    expect(r.d.themen.find(t => t.id === 'finanzen')?.ist.sek).toBe(900);
    expect(r.d.themen.find(t => t.einheit === 'kdv')?.ist.sek).toBe(1800);
  });

  it('Privat-Sicht: nur Privat-Themen — kein Sales/Marketing/Business-Gesellschaft; Ist und Eingeplantes aus Privat', async () => {
    const { finanzOrtName, BUSINESS_GESELLSCHAFTEN } = await import('@/lib/einheiten');
    const r = await holen('person-a', 'privat');
    expect(r.status).toBe(200);
    for (const w of BUSINESS_WOERTER) expect(r.text, w).not.toContain(w);
    for (const g of BUSINESS_GESELLSCHAFTEN) expect(r.text, g).not.toContain(finanzOrtName(g));
    expect(r.d.themen.find(t => t.id === 'gesundheit')?.ist).toMatchObject({ sek: 3 * 3600, bewusstSek: 3600 });
    expect(r.d.themen.find(t => t.id === 'haushalt')?.ist.sek).toBe(1800);
    expect(r.d.themen.find(t => t.id === 'erholung')?.ist.eingeplantSek).toBe(3600);
  });

  it('Konto „nur Business“: Privat → 403, Business lesend (Themen nicht änderbar), eigenes Soll ja', async () => {
    expect((await holen('person-d', 'privat')).status).toBe(403);
    const b = await holen('person-d', 'business');
    expect(b.status).toBe(200);
    expect(b.d.darfThemen).toBe(false);
    for (const w of PRIVAT_WOERTER) expect(b.text, w).not.toContain(w);
    expect((await setzen('person-d', { bereich: 'business', aktion: 'themen', themen: [], stand: b.d.stand })).status).toBe(403);
    expect((await setzen('person-d', { bereich: 'privat', aktion: 'soll', soll: { familie: 2 } })).status).toBe(403);
    const s = await setzen('person-d', { bereich: 'business', aktion: 'soll', soll: { sales: 4 } });
    expect(s.status).toBe(200);
  });

  it('Soll gehört der Person: A setzt ihr Soll, B (selber Haushalt) sieht es nicht; unbekanntes Thema 400', async () => {
    expect((await setzen('person-a', { bereich: 'business', aktion: 'soll', soll: { sales: 6 } })).status).toBe(200);
    expect((await holen('person-a', 'business')).d.themen.find(t => t.id === 'sales')?.soll).toBe(6);
    expect((await holen('person-b', 'business')).d.themen.find(t => t.id === 'sales')?.soll).toBeNull();
    expect((await setzen('person-a', { bereich: 'business', aktion: 'soll', soll: { familie: 2 } })).status).toBe(400);
  });

  it('Themen schreiben: Stand/409, Fremdes 400, Grenze 413 — getrennte Bestände, Spiegel nur in die eigenen Säulen', async () => {
    const a = await holen('person-a', 'business');
    const neu = a.d.themen.map(({ id, label, gewicht, zeit, einheit }) => ({ id, label, gewicht, zeit, ...(einheit ? { einheit } : {}) }));
    neu[0] = { ...neu[0], label: 'Produkt & System', gewicht: 95 };
    expect((await setzen('person-a', { bereich: 'business', aktion: 'themen', themen: neu, stand: 'veraltet' })).status).toBe(409);
    expect((await setzen('person-a', { bereich: 'business', aktion: 'themen', themen: [{ id: 'x', label: 'X', gewicht: 50, zeit: ['gesundheit'] }], stand: a.d.stand })).status).toBe(400);
    expect((await setzen('person-a', { bereich: 'business', aktion: 'themen', themen: Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, label: 'X', gewicht: 50, zeit: [] })), stand: a.d.stand })).status).toBe(413);
    const ok = await setzen('person-a', { bereich: 'business', aktion: 'themen', themen: neu, stand: a.d.stand });
    expect(ok.status).toBe(200);
    const b = await holen('person-b', 'business');
    expect(b.d.quelle).toBe('neu');
    expect(b.d.themen[0]).toMatchObject({ label: 'Produkt & System', gewicht: 95 });
    // Getrennte Bestände: der Business-Bestand trägt kein Privat-Thema, der Privat-Bestand ist unberührt.
    expect(JSON.stringify(await db.loadJson('fokus-steuerung-business--haus-t'))).not.toMatch(/Familie|Gesundheit|Erholung/);
    expect(await db.loadJson('fokus-steuerung-privat--haus-t')).toBeNull();
    // Spiegel: Planung (Produkt) 95, Gesundheit/Familie bleiben aus dem Altbestand.
    expect(await db.loadJson('fokus-regler')).toMatchObject({ regler: { planning: 95, health: 90, social: 20 } });
    // Soll liegt je Person und je Bereich getrennt.
    expect(await db.loadJson('fokus-soll-business--person-a')).toMatchObject({ soll: { sales: 6 } });
    expect(await db.loadJson('fokus-soll-privat--person-a')).toBeNull();
  });

  it('Anderer Haushalt: eigene Vorgabe, nichts aus dem Altbestand oder den Themen des Inhaber-Haushalts', async () => {
    const c = await holen('person-c', 'business');
    expect(c.status).toBe(200);
    expect(c.d.quelle).toBe('vorgabe');
    expect(c.text).not.toContain('Produkt & System');
  });

  it('Wirkung = der Score des Bereichs (21.10.): GET /api/scores?sicht= — Business ohne Privat-Score, Privat ohne Business-Score; „nur Business“ nie Privat', async () => {
    const scores = (await import('@/app/api/scores/route')) as unknown as { GET: H };
    const t = async (wer: string, q: string) => { const r = await scores.GET(anfrage(`/api/scores${q}`, wer)); return { status: r.status, d: (await r.json()) as Record<string, unknown> }; };
    const b = await t('person-a', '?sicht=business');
    expect(b.status).toBe(200);
    expect(Object.keys(b.d).sort()).toEqual(['business', 'ok']);
    const p = await t('person-a', '?sicht=privat');
    expect(p.status).toBe(200);
    expect(Object.keys(p.d).sort()).toEqual(['ok', 'privat']);
    expect((await t('person-d', '?sicht=privat')).status).toBe(403);
    expect(Object.keys((await t('person-d', '')).d).sort()).toEqual(['business', 'ok']);
  }, 60_000);

  it('GET /api/state/zeit?sicht= und /einheiten?sicht=: nur der Bereich; „nur Business“ ohne Parameter nur Business', async () => {
    const zeit = (await import('@/app/api/state/zeit/route')) as unknown as { GET: H };
    const z = await zeit.GET(anfrage('/api/state/zeit?sicht=business', 'person-a'));
    const zt = await z.text();
    expect(z.status).toBe(200);
    expect(zt).not.toContain('privat:');
    expect(zt).not.toContain('MARKE-PRIVAT-BLOCK');
    expect((await zeit.GET(anfrage('/api/state/zeit?sicht=privat', 'person-d'))).status).toBe(403);
    expect(await (await zeit.GET(anfrage('/api/state/zeit', 'person-d'))).text()).toContain('"sicht":"business"');
    const einheiten = (await import('@/app/api/state/zeit/einheiten/route')) as unknown as { GET: H };
    const e = (await (await einheiten.GET(anfrage('/api/state/zeit/einheiten?sicht=business', 'person-a'))).json()) as { gesamt: { zeilen: { bereich: string }[] } };
    expect(e.gesamt.zeilen.filter(x => x.bereich === 'privat')).toEqual([]);
  });
});

describe('(c) Navigation und Oberfläche', () => {
  const dateien = (dir: string): string[] => readdirSync(path.join(wurzel, dir)).flatMap(n => {
    const rel = `${dir}/${n}`;
    return statSync(path.join(wurzel, rel)).isDirectory() ? dateien(rel) : /\.(tsx?|mjs)$/.test(n) ? [rel] : [];
  });

  it('Planung ist nur Planung: Tag · Woche · Monat · Quartal · Jahr & Ziele · Routinen · Kapazität', () => {
    const p = lies('components/os/PlanerLeiste.tsx');
    const labels = Array.from(p.matchAll(/label: '([^']+)', href:/g)).map(m => m[1]);
    expect(labels).toEqual(['Tag', 'Woche', 'Monat', 'Quartal', 'Jahr & Ziele', 'Routinen', 'Kapazität']);
  });

  it('alte Adressen leiten auf die Fokus-Seite; die alten Seiten gibt es nicht mehr; kein Code verlinkt sie', async () => {
    const { default: konfig } = await import('../next.config.mjs');
    const regeln = await (konfig as { redirects: () => Promise<{ source: string; destination: string }[]> }).redirects();
    const ziel = (q: string) => regeln.find(r => r.source === q)?.destination;
    // 21.10. (zwei Scores): der Wachstums-Score ist weg — seine alten Adressen führen auf Heute (oben der Score des Bereichs).
    expect(ziel('/os/wachstum')).toBe('/os');
    expect(ziel('/os/kompass')).toBe('/os/fokus#prioritaeten');
    expect(ziel('/os/planung/fokus')).toBe('/os/fokus#prioritaeten');
    expect(ziel('/os/performance')).toBe('/os');
    expect(existsSync(path.join(wurzel, 'app/os/kompass'))).toBe(false);
    expect(existsSync(path.join(wurzel, 'app/os/wachstum'))).toBe(false);
    const funde = ['app', 'components', 'lib', 'hooks', 'context'].flatMap(dateien).filter(f => /['"`]\/os\/(kompass|wachstum)\b/.test(lies(f)));
    expect(funde).toEqual([]);
  });

  it('Kopf: der Fokus-Knopf öffnet die Fokus-Seite; der laufende Zähler beendet über dieselbe Stelle wie die Seite', () => {
    const k = lies('components/os/Kopf.tsx');
    expect(k).toContain('<Link href={WEG.fokus()}');
    expect(k).toContain('fokusBeenden(laufend, bestaetigen)');
    expect(lies('components/os/FokusView.tsx')).toContain('fokusBeenden(laufend, bestaetigen)');
  });

  it('Fokus-Seite: Tagesform und „Wie wir arbeiten“ nur in Privat; Zeit-Karten und Wirkung mit der Sicht des Bereichs', () => {
    const v = lies('components/os/FokusView.tsx');
    expect(v).toMatch(/bereich === 'privat' && \(\s*<Klappbar id="tagesform"/);
    expect(v).toMatch(/bereich === 'privat' && \(\s*<Klappbar id="arbeiten"/);
    expect(v).toContain('<FokusTafel bereich={bereich} />');
    expect(v).toContain('<FokusBloeckeKarte i={i++} sicht={bereich} />');
    expect(v).toContain('<Wirkung bereich={bereich}');
    expect(v).not.toContain('<PlanerLeiste');
    // Seit 21.10. die Wirkung = der Score des Bereichs (dieselbe Quelle wie Heute: GET /api/scores).
    expect(lies('components/os/fokus/Wirkung.tsx')).toContain('useScores(bereich)');
    expect(lies('components/os/fokus/useSteuerung.ts')).toContain('/api/fokus/steuerung?bereich=${bereich}');
  });

  it('Schalter im Kopf: auf der Fokus-Seite bleibt man stehen; ein ?space= wird nur umgeschrieben', async () => {
    const { wechselZiel } = await import('@/lib/make-one/spaces');
    expect(wechselZiel('/os/fokus', '', 'business')).toBeNull();
    expect(wechselZiel('/os/fokus', '?space=privat', 'business')).toBe('/os/fokus?space=business');
    expect(wechselZiel('/os/fokus', '?space=business', 'business')).toBeNull();
  });
});
