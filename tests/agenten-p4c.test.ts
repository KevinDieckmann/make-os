// ─── Paket 4c: Medien ↔ Heads, Bild & Video über das Anbieter-Tor (09.10.2026) ─────────────────────────────────────────────────
// Eigener Datenordner, erfundene Personen (@example.invalid), nachgebauter Google-Zugang (kein Netz). Wächter:
//   · EINE Ablage: KI-Bilder/-Videos sind Medien (urheber „ki“) mit derselben Verschlüsselung, Freigabe und Filterstelle; Bytes unverändert;
//     `ki-medien` nur Auftragsbuch + Lese-Übergang (Übernahme idempotent, Altbestand bleibt liegen)
//   · KI-Kennzeichnung: Freigabe nur mit bestätigtem Zeichen, Herkunft nie änderbar, Kopf + Herkunftsangabe beim Laden
//   · Foto mit erkennbaren Personen ohne Einwilligung „KI“ → abgelehnt (kein Byte geht hinaus); Schalter „Bilder an die KI“ (Kategorie medien)
//   · Privat nie an Business-Heads; „An Head geben“ nur an Heads mit Medien-Bezug; Glocke „Freigabe angefragt“ an die zweite Person
//   · Video nur mit Klick (Stapel); Budget-Prüfung vor dem Aufruf; nach fremdem Text erzeugt nichts selbst
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-p4c-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-p4c';
process.env.MAKE_OS_OHNE_APPLE = '1';
process.env.MAKE_OS_KI_VORGABE = 'kompatibel';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.MAKE_OS_DATENSCHLUESSEL;
delete process.env.MAKE_OS_KI_ANBIETER_TOR;
delete process.env.MAKE_OS_MEDIEN;

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
const DIENSTKONTO = Buffer.from(JSON.stringify({ type: 'service_account', client_email: 'make-os-test@test-projekt.iam.gserviceaccount.com', private_key: privateKey, token_uri: 'https://oauth2.googleapis.com/token' })).toString('base64');
process.env.GOOGLE_VERTEX_PROJEKT = 'test-projekt-123';
process.env.GOOGLE_VERTEX_DIENSTKONTO = DIENSTKONTO;
process.env.GOOGLE_VERTEX_MEDIEN = 'an';

type Db = typeof import('@/lib/store/local-db');
let db: Db;
let ke: typeof import('@/lib/datenschutz/ki-einstellungen');
let http: typeof import('@/lib/ki/adapter/http');
let aufruf: typeof import('@/lib/ki/aufruf');
let ablage: typeof import('@/lib/medien/ki-ablage');
let server: typeof import('@/lib/medien/server');
let upload: typeof import('@/lib/medien/upload-server');
let wz: typeof import('@/lib/agenten/medien-werkzeuge');
let katalog: typeof import('@/lib/agenten/katalog');
let stapel: typeof import('@/lib/zoe/stapel');
let demoPng: typeof import('@/lib/demo/saat-agenten').demoPng;

/** Nachgebauter Google (Token, Gemini-Bild, Video). Das Bild trägt erkennbare Kennzeichnungs-Marken (bleiben unverändert). */
interface Aufruf { url: string; body: string }
let aufrufe: Aufruf[] = [];
const PNG_KI = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('caBX-c2pa-MANIFEST-SynthID-Pruefmuster', 'utf8')]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42-c2pa-VIDEO', 'utf8')]);
function googleFake(url: string, init: RequestInit): Promise<Response> {
  aufrufe.push({ url, body: String(init.body ?? '') });
  const j = (x: unknown) => Promise.resolve(new Response(JSON.stringify(x), { status: 200 }));
  if (url === 'https://oauth2.googleapis.com/token') return j({ access_token: 'tok-test', expires_in: 3600 });
  if (url.endsWith(':generateContent')) return j({ candidates: [{ content: { parts: [{ text: 'Bild' }, { inlineData: { mimeType: 'image/png', data: PNG_KI.toString('base64') } }] } }] });
  if (url.endsWith(':predictLongRunning')) return j({ name: 'projects/test-projekt-123/locations/global/publishers/google/models/gemini-omni-1.1-flash/operations/op-123' });
  if (url.endsWith(':fetchPredictOperation')) return j({ done: true, response: { videos: [{ mimeType: 'video/mp4', bytesBase64Encoded: MP4.toString('base64') }] } });
  return Promise.resolve(new Response('nicht nachgebaut', { status: 404 }));
}
const anGoogle = (endung: string) => aufrufe.filter(a => a.url.endsWith(endung));

async function einrichten(o: { bild?: boolean; video?: boolean; bilder?: Record<string, boolean>; budget?: { monatEuroCent?: number; auftragEuroCent?: number } } = {}) {
  const { EMPFAENGER_START } = await import('@/lib/datenschutz/einrichtung');
  await db.saveJson('datenschutz-einrichtung', { empfaenger: EMPFAENGER_START.map(e => (e.id === 'google-vertex' ? { ...e, archiviert: undefined, avv: { status: 'bestaetigt' as const, am: '2026-10-09' } } : e)) });
  await ke.aendereKiEinstellungen(d => ({
    ...d, instanz: { medien: { bild: o.bild !== false, video: o.video !== false }, ...(o.budget ? { budget: o.budget } : {}) },
    personen: Object.fromEntries(Object.entries(o.bilder ?? {}).map(([p, an]) => [p, { bilderAnKi: an }])),
  }));
}

/** Ein Foto über den Upload-Weg (wie die Warteschlange im Browser). */
async function foto(person: string, o: { bereich?: 'business' | 'privat'; personen?: 'ja' | 'nein' } = {}): Promise<string> {
  const png = demoPng(48, 48, [10, 120, 110], [200, 80, 40]);
  const id = randomUUID();
  const s = await upload.uploadAnlegen(person, { id, typ: 'image/png', bytes: png.length, bereich: o.bereich ?? 'business', ortsdatenEntfernt: true, erkennbarePersonen: o.personen ?? 'nein', breite: 48, hoehe: 48 });
  if (!s.ok || !('sitzung' in s)) throw new Error(JSON.stringify(s));
  const upId = s.sitzung.id;
  const hash = createHash('sha256').update(png).digest('hex');
  expect((await upload.teilAnnehmen(person, upId, 0, png, hash)).ok).toBe(true);
  for (const v of ['raster', 'ansicht']) expect((await upload.vorschauAnnehmen(person, upId, v, png)).ok).toBe(true);
  const f = await upload.uploadFertig(person, upId, { pruefsumme: createHash('sha256').update(Buffer.from(hash, 'hex')).digest('hex') });
  if (!f.ok) throw new Error(JSON.stringify(f));
  return (f.medium as { id: string }).id;
}
const business = async () => (await db.loadJson<import('@/lib/medien/typen').MedienKatalog>('medien--h-test'))!;
const mediumIm = async (id: string) => (await business()).medien.find(m => m.id === id)!;
const aktion = (person: string, a: Record<string, unknown>) => server.aktionAusfuehren(person, a);
const kontext = (o: Partial<import('@/lib/agenten/medien-werkzeuge').MedienKontext> = {}): import('@/lib/agenten/medien-werkzeuge').MedienKontext => ({
  person: 'lena', head: katalog.headDef('marketing')!, agent: { art: 'mitarbeiter', headId: 'marketing', mitarbeiterId: 'marketing-bild-video' }, hintergrund: false, fremdGelesen: false, ...o,
});
const offeneVorschlaege = async (werkzeug: string) => (await stapel.lies('offen')).filter(v => v.werkzeug === werkzeug);

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  ke = await import('@/lib/datenschutz/ki-einstellungen');
  http = await import('@/lib/ki/adapter/http');
  aufruf = await import('@/lib/ki/aufruf');
  ablage = await import('@/lib/medien/ki-ablage');
  server = await import('@/lib/medien/server');
  upload = await import('@/lib/medien/upload-server');
  wz = await import('@/lib/agenten/medien-werkzeuge');
  katalog = await import('@/lib/agenten/katalog');
  stapel = await import('@/lib/zoe/stapel');
  demoPng = (await import('@/lib/demo/saat-agenten')).demoPng;
  await db.saveJson('konten', { konten: [
    { id: '1', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena Prüf', rolle: 'inhaber', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-test' },
    { id: '2', speicher: 'jonas', email: 'jonas@example.invalid', name: 'Jonas Prüf', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-test' },
    { id: '3', speicher: 'gast', email: 'gast@example.invalid', name: 'Gast Fremd', rolle: 'mitglied', hash: 'x', salz: 'x', angelegt: '2026-09-01T08:00:00.000Z', teilt: { gesundheit: [] }, haushalt: 'h-fremd' },
  ], einladungen: [] });
  http._kiFetchSetzen(googleFake);
});
afterEach(async () => {
  aufrufe = [];
  (await import('@/lib/ki/adapter/google-auth'))._tokenVergessen();
  await ke.aendereKiEinstellungen(d => ({ ...d, instanz: {}, personen: {} }));
  await db.saveJson('ki-verbrauch', { tage: [] });
});
afterAll(() => { http._kiFetchSetzen(null); rmSync(ordner, { recursive: true, force: true }); });

describe('EINE Ablage: KI-Medien sind Medien wie alle anderen', () => {
  it('Bild: liegt verschlüsselt in medien--<haushalt> (urheber „ki“), Bytes unverändert, das Auftragsbuch bleibt leer', async () => {
    await einrichten();
    const r = await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, prompt: 'PROMPT-GEHEIM Abendlicht über einem Tisch', sichtbar: { realistisch: true, orte: true } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const e = r.medien[0];
    expect(e).toMatchObject({ art: 'bild', mime: 'image/png', bereich: 'business', anbieter: 'google-vertex', kennzeichnung: { synthid: true, c2pa: true, eigeneMarke: true }, zeichenNoetig: true });
    expect(e.id).toMatch(/^md-[0-9a-f-]{36}$/);
    const m = await mediumIm(e.id);
    expect(m.urheber).toMatchObject({ art: 'ki', ki: { anbieter: 'google-vertex', zeichenNoetig: true, prompt: 'PROMPT-GEHEIM Abendlicht über einem Tisch' } });
    expect(m.erkennbarePersonen).toBe('nein');
    expect(m.marketing.status).toBe('intern');
    expect(m.schluessel.dek).toBeTruthy();
    expect((await ablage.kiMediumOeffnen('jonas', e.id))?.bytes.equals(PNG_KI)).toBe(true);
    // Der Speicher sieht nur Chiffrat: die Kennzeichnungs-Marke steht nirgends im Klartext.
    const { promises: fs } = await import('node:fs');
    const roh = await fs.readFile(path.join(ordner, 'medien', 'obj', `m/${e.id}/original.mkm`));
    expect(roh.includes(Buffer.from('SynthID'))).toBe(false);
    expect(await db.loadJson('ki-medien--h-test')).toBeNull();
    // Dieselbe Filterstelle: beide sehen es (Business), der fremde Haushalt nichts.
    expect((await server.medienListe('jonas'))?.medien.some(x => x.id === e.id && x.urheber.art === 'ki')).toBe(true);
    expect(await server.medienListe('gast')).toBeNull();
  });
  it('„nur ich“ → Privat der Person (Unsortiert sieht nur sie); fremder Haushalt bekommt gar nichts (403, kein Aufruf)', async () => {
    await einrichten();
    const r = await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, prompt: 'Nur für mich', sichtbarkeit: 'nur-ich' });
    expect(r.ok && r.medien[0].bereich).toBe('privat');
    const id = r.ok ? r.medien[0].id : '';
    expect((await server.medienListe('lena'))?.medien.some(x => x.id === id)).toBe(true);
    expect((await server.medienListe('jonas'))?.medien.some(x => x.id === id)).toBe(false);
    expect(await ablage.kiMediumOeffnen('jonas', id)).toBeNull();
    aufrufe = [];
    expect(await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'gast', kategorien: ['allgemein'] }, prompt: 'x' })).toMatchObject({ ok: false, status: 403 });
    expect(anGoogle(':generateContent')).toEqual([]);
  });
  it('Video: Auftragsbuch bis zum Abholen, dann Medium in der Ablage (Glocke neutral), Buch trägt nur die Marke', async () => {
    await einrichten();
    const ki = { lauf: 'aufruf' as const, person: 'lena', kategorien: ['allgemein' as const] };
    const ohne = await aufruf.kiVideoStarten({ ki, prompt: 'Kamerafahrt über eine Stadt', sekunden: 10 });
    expect(ohne).toMatchObject({ ok: false, status: 409, error: 'ki-gesperrt:kosten-rueckfrage' });
    const mit = await aufruf.kiVideoStarten({ ki, prompt: 'Kamerafahrt über eine Stadt', sekunden: 10, name: 'Stadt (Test)', bestaetigtCent: ohne.ok ? 0 : ohne.schaetzung!.euroCent });
    expect(mit.ok).toBe(true);
    expect((await aufruf.kiAuftraegeAbholen())).toMatchObject({ fertig: 1, fehler: 0 });
    const buch = (await db.loadJson<{ medien: import('@/lib/ki/medien').KiMedium[] }>('ki-medien--h-test'))!.medien;
    expect(buch[0]).toMatchObject({ status: 'fertig' });
    expect(buch[0].uebernommenAls).toMatch(/^md-/);
    const v = await mediumIm(buch[0].uebernommenAls!);
    expect(v).toMatchObject({ art: 'video', typ: 'video/mp4', name: 'Stadt (Test)', urheber: { art: 'ki' } });
    expect((await ablage.kiMediumOeffnen('lena', v.id))?.bytes.equals(MP4)).toBe(true);
    const glocke = await db.loadJson<{ eintraege: { art: string; titel: string; link: string }[] }>('meldungen--lena');
    expect(glocke?.eintraege.find(x => x.art === 'medien')).toMatchObject({ titel: 'Ein KI-Video ist fertig', link: expect.stringContaining(v.id) });
  });
  it('Lese-Übergang: fertige Einträge des Altbestands einmal übernommen (feste Kennung, idempotent), Altbestand bleibt liegen', async () => {
    const alt = await import('@/lib/ki/medien');
    const km = await alt.mediumAblegen('h-test', { art: 'bild', status: 'fertig', mime: 'image/png', anbieter: 'google-vertex', modell: 'gemini-nano-banana-2.1', person: 'jonas', sichtbarkeit: 'haushalt', prompt: 'Altes Bild', kennzeichnung: { synthid: true, c2pa: true, eigeneMarke: true }, zeichenNoetig: false, kosten: { euroCent: 4, geschaetzt: true } }, PNG_KI);
    const u1 = await ablage.kiMedienUebernehmen('h-test');
    expect(u1.uebernommen).toBe(1);
    const neu = await mediumIm(`md-${km.id.slice(3)}`);
    expect(neu).toMatchObject({ von: 'jonas', urheber: { art: 'ki', ki: { alt: km.id, prompt: 'Altes Bild' } } });
    expect((await ablage.kiMediumOeffnen('lena', neu.id))?.bytes.equals(PNG_KI)).toBe(true);
    expect((await ablage.kiMedienUebernehmen('h-test')).uebernommen).toBe(0);
    expect((await business()).medien.filter(m => m.id === neu.id)).toHaveLength(1);
    // Der Altbestand bleibt (Rückweg): Eintrag mit Marke, Datei noch da.
    const buch = (await db.loadJson<{ medien: import('@/lib/ki/medien').KiMedium[] }>('ki-medien--h-test'))!.medien.find(x => x.id === km.id)!;
    expect(buch.uebernommenAls).toBe(neu.id);
    expect((await alt.mediumOeffnen('h-test', 'jonas', km.id))?.bytes.equals(PNG_KI)).toBe(true);
    // Auch der tägliche Medien-Lauf übernimmt (Schritt 7) — hier nichts mehr offen.
    const { medienPflege } = await import('@/lib/medien/pflege');
    expect((await medienPflege({ uploadTage: 7, papierkorbTage: 30, rohMonate: 12 })).kiUebernommen ?? 0).toBe(0);
  });
});

describe('KI-Kennzeichnung (KI-VO Art. 50): nie ohne Kennzeichen nach außen', () => {
  it('Freigabe nur mit bestätigtem sichtbarem Zeichen; die Herkunft lässt sich nicht ändern', async () => {
    await einrichten();
    const r = await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, prompt: 'Realistischer Platz', sichtbar: { realistisch: true, orte: true } });
    const id = r.ok ? r.medien[0].id : '';
    const frei = { aktion: 'freigabe', id, schritt: 'freigeben', kanaele: ['website'], bis: '2099-01-01' };
    expect(await aktion('lena', frei)).toMatchObject({ ok: false, status: 400, fehler: expect.stringMatching(/KI-generiert/) });
    expect(await aktion('lena', { aktion: 'aendern', id, urheber: { art: 'team' } })).toMatchObject({ ok: false, status: 409 });
    expect(await aktion('lena', { ...frei, kiZeichenBestaetigt: true })).toMatchObject({ ok: true });
    expect((await mediumIm(id)).marketing).toMatchObject({ status: 'freigegeben', kiKennzeichnung: { sichtbar: true, bestaetigtVon: 'lena' } });
  });
  it('Inhalt: Kopf „X-KI-Generiert“, Download-Name „ki-generiert-…“, Herkunftsangabe als JSON (nur wer es sieht)', async () => {
    await einrichten();
    const r = await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, prompt: 'Muster' });
    const id = r.ok ? r.medien[0].id : '';
    const route = await import('@/app/api/medien/inhalt/route');
    const anf = (person: string, q: string) => route.GET(new Request(`http://test/api/medien/inhalt?id=${id}&${q}`, { headers: { 'x-make-user': person } }));
    const o = await anf('jonas', 'v=original&download=1');
    expect(o.status).toBe(200);
    expect(o.headers.get('x-ki-generiert')).toBe('1');
    expect(o.headers.get('content-disposition')).toContain(`ki-generiert-${id}.png`);
    expect(Buffer.from(await o.arrayBuffer()).equals(PNG_KI)).toBe(true);
    const h = await anf('lena', 'herkunft=1');
    expect(await h.json()).toMatchObject({ ki_generiert: true, anbieter: 'google-vertex', rechtsgrundlage: expect.stringMatching(/Art\. 50/), medium: id });
    expect((await anf('gast', 'herkunft=1')).status).toBe(403);
  });
});

describe('Fotos mit Personen, Privat, Heads', () => {
  it('Foto mit erkennbarer Person ohne Einwilligung „KI“ → abgelehnt mit Grund, kein Byte geht hinaus; mit Einwilligung + Schalter → bearbeitet', async () => {
    await einrichten({ bilder: { lena: true } });
    const id = await foto('lena', { personen: 'ja' });
    const pm = await aktion('lena', { aktion: 'person-markieren', id, person: { art: 'konto', konto: 'jonas', rolle: 'haupt' } });
    expect(pm.ok).toBe(true);
    expect(await aktion('lena', { aktion: 'an-head', id, head: 'marketing', auftrag: ['auswahl', 'zuschnitt', 'text'] })).toMatchObject({ ok: true });
    expect(await ablage.kiVorlageLaden('lena', id, { headId: 'marketing' })).toMatchObject({ ok: false, status: 409, fehler: expect.stringMatching(/Einwilligung/) });
    const a = await wz.medienWerkzeugAusfuehren('bild_bearbeiten', { medium: id, anweisung: 'Hintergrund ruhiger' }, kontext());
    expect(a.ok).toBe(false);
    expect(a.text).toMatch(/Nicht ausgeführt: .*Einwilligung/);
    expect(anGoogle(':generateContent')).toEqual([]);
    // Einwilligung mit Zweck „KI“ (nur anhängend im Business-Bestand) an der Markierung → jetzt darf das Foto hinaus.
    await server.katalogAendern('medien--h-test', k => ({ ok: true as const, katalog: { ...k, einwilligungen: [...(k.einwilligungen ?? []), { id: 'ew-test-ki-00000001', am: new Date().toISOString(), erfasstVon: 'lena', person: { konto: 'jonas' }, zwecke: ['social', 'ki'], wortlaut: 'Test', fassung: 'ew1-test' }] } }));
    const personId = (await mediumIm(id)).personen[0].id;
    expect((await aktion('lena', { aktion: 'person-aendern', id, personId, einwilligungId: 'ew-test-ki-00000001' })).ok).toBe(true);
    const b = await wz.medienWerkzeugAusfuehren('bild_bearbeiten', { medium: id, anweisung: 'Hintergrund ruhiger' }, kontext());
    expect(b).toMatchObject({ ok: true, gestapelt: true });
    const gen = anGoogle(':generateContent');
    expect(gen).toHaveLength(1);
    expect(gen[0].body).toContain('"inlineData"');
    const neu = (await business()).medien.find(m => m.abgeleitetVon?.id === id && m.abgeleitetVon.art === 'ki')!;
    expect(neu).toMatchObject({ erkennbarePersonen: 'ja', urheber: { art: 'ki', ki: { vorschlag: 'offen', agent: 'mitarbeiter:marketing:marketing-bild-video' } } });
    expect(neu.personen[0]).toMatchObject({ konto: 'jonas', einwilligungId: 'ew-test-ki-00000001' });
  });
  it('ohne Schalter „Bilder an die KI“: nicht angeboten, und das KI-Tor sperrt (medien-aus) — Minderjährige und Unbekannte nie', async () => {
    await einrichten();
    const id = await foto('lena', { personen: 'ja' });
    await aktion('lena', { aktion: 'person-markieren', id, person: { art: 'unbekannt', anzahl: 1, rolle: 'beiwerk' } });
    await aktion('lena', { aktion: 'an-head', id, head: 'marketing', auftrag: ['auswahl'] });
    expect(await ablage.kiVorlageLaden('lena', id, { headId: 'marketing' })).toMatchObject({ ok: false, fehler: expect.stringMatching(/unbekannte/i) });
    const nein = await foto('lena', { personen: 'nein' });
    await aktion('lena', { aktion: 'an-head', id: nein, head: 'marketing', auftrag: ['auswahl'] });
    expect(await aufruf.kiBild({ ki: { lauf: 'aufruf', person: 'lena', kategorien: ['allgemein'] }, prompt: 'x', vorlage: { mediumId: nein, headId: 'marketing' } })).toMatchObject({ ok: false, error: 'ki-gesperrt:medien-aus' });
    expect(anGoogle(':generateContent')).toEqual([]);
    const schalter = await ke.kiSchalterFuer('lena');
    expect(wz.medienWerkzeugeFuer({ art: 'mitarbeiter', head: katalog.headDef('marketing')!, mitarbeiter: { id: 'marketing-bild-video' }, schalter })).not.toContain('bild_bearbeiten');
    await einrichten({ bilder: { lena: true } });
    expect(wz.medienWerkzeugeFuer({ art: 'mitarbeiter', head: katalog.headDef('marketing')!, mitarbeiter: { id: 'marketing-bild-video' }, schalter: await ke.kiSchalterFuer('lena') })).toContain('bild_bearbeiten');
    const kind = await foto('lena', { personen: 'ja' });
    await aktion('lena', { aktion: 'person-markieren', id: kind, person: { art: 'konto', konto: 'jonas', rolle: 'beiwerk', minderjaehrig: true } });
    expect(await ablage.kiVorlageLaden('lena', kind)).toMatchObject({ ok: false, fehler: expect.stringMatching(/Minderjährige/) });
  });
  it('Privat nie an Business-Heads: kein „An Head“, keine Vorlage, nicht in medien_suchen', async () => {
    await einrichten({ bilder: { lena: true } });
    const id = await foto('lena', { bereich: 'privat' });
    expect(await aktion('lena', { aktion: 'an-head', id, head: 'marketing', auftrag: ['auswahl'] })).toMatchObject({ ok: false, status: 400 });
    expect(await ablage.kiVorlageLaden('lena', id)).toMatchObject({ ok: false, status: 403 });
    const s = await wz.medienWerkzeugAusfuehren('medien_suchen', {}, kontext({ agent: { art: 'head', headId: 'marketing' } }));
    expect(s.text).not.toContain(id);
    // Privat-Heads bekommen keine Medien-Werkzeuge — auch nicht über einen Katalog-Fehler.
    expect(wz.medienWerkzeugeFuer({ art: 'head', head: katalog.headDef('familie')!, schalter: await ke.kiSchalterFuer('lena') })).toEqual([]);
    expect((await wz.medienWerkzeugAusfuehren('bild_erzeugen', { beschreibung: 'x' }, kontext({ head: katalog.headDef('familie')! }))).ok).toBe(false);
  });
  it('„An Head geben“ nur an Heads mit Medien-Bezug; medien_suchen listet nur Gegebenes des eigenen Heads', async () => {
    await einrichten();
    const id = await foto('lena');
    expect(await aktion('lena', { aktion: 'an-head', id, head: 'finanzen', auftrag: ['auswahl'] })).toMatchObject({ ok: false, status: 400, fehler: expect.stringMatching(/mit Bildern/) });
    expect(await aktion('lena', { aktion: 'an-head', id, head: 'event', auftrag: ['text'] })).toMatchObject({ ok: true });
    expect((await wz.medienWerkzeugAusfuehren('medien_suchen', {}, kontext({ head: katalog.headDef('event')!, agent: { art: 'head', headId: 'event' } }))).text).toContain(id);
    expect((await wz.medienWerkzeugAusfuehren('medien_suchen', {}, kontext({ head: katalog.headDef('sales')!, agent: { art: 'head', headId: 'sales' } }))).text).not.toContain(id);
  });
  it('Glocke „Freigabe angefragt“ an die zweite Person (Vier-Augen), neutral, nie an die anfragende', async () => {
    await einrichten();
    const id = await foto('jonas', { personen: 'ja' });
    await aktion('jonas', { aktion: 'person-markieren', id, person: { art: 'unbekannt', anzahl: 3, rolle: 'beiwerk' } });
    expect((await aktion('jonas', { aktion: 'freigabe', id, schritt: 'anfragen', kanaele: ['social'], bis: '2099-01-01' })).ok).toBe(true);
    const lena = await db.loadJson<{ eintraege: { art: string; titel: string; link: string }[] }>('meldungen--lena');
    expect(lena?.eintraege.find(x => x.art === 'medien' && x.link.includes(id))).toMatchObject({ titel: 'Ein Foto wartet auf deine Freigabe (Vier-Augen)' });
    expect(JSON.stringify(lena)).not.toMatch(/Jonas|png/);
    const jonas = await db.loadJson<{ eintraege: { link: string }[] }>('meldungen--jonas');
    expect((jonas?.eintraege ?? []).some(x => x.link.includes(id))).toBe(false);
    const { telegramText } = await import('@/lib/meldungen/speicher');
    expect(telegramText({ art: 'medien', titel: 'Ein Foto wartet auf deine Freigabe (Vier-Augen)' })).toMatch(/Details in MAKE OS/);
  });
});

describe('Bild & Video: Kosten, Klick, Stapel', () => {
  it('bild_erzeugen: Ergebnis als Vorschlag (Medium „offen“ + Stapel); übernehmen per Klick, ablehnen → Papierkorb', async () => {
    await einrichten();
    const r = await wz.medienWerkzeugAusfuehren('bild_erzeugen', { beschreibung: 'Ruhige Fläche in Petrol', format: '4:5' }, kontext());
    expect(r).toMatchObject({ ok: true, gestapelt: true });
    expect(r.text).toMatch(/€/);
    const [v] = await offeneVorschlaege('ki_bild');
    expect(v.person).toBe('lena');
    const m = await mediumIm(v.bezug!.id);
    expect(m.urheber.ki?.vorschlag).toBe('offen');
    // Offen: nicht freigebbar, nicht an Heads.
    expect(await aktion('lena', { aktion: 'freigabe', id: m.id, schritt: 'freigeben', kanaele: ['social'], bis: '2099-01-01', kiZeichenBestaetigt: true })).toMatchObject({ ok: false, fehler: expect.stringMatching(/Freigabe-Stapel/) });
    const { stapelArtVon } = await import('@/lib/zoe/stapel-arten');
    const art = (await stapelArtVon(v))!;
    expect(await art.freigeben(v, 'jonas', {})).toMatchObject({ ok: false, status: 403 });
    expect(await art.freigeben(v, 'lena', {})).toMatchObject({ ok: true });
    expect((await mediumIm(m.id)).urheber.ki?.vorschlag).toBe('uebernommen');
    // Ein zweites Bild wird abgelehnt → Papierkorb.
    await wz.medienWerkzeugAusfuehren('bild_erzeugen', { beschreibung: 'Zweites Motiv' }, kontext());
    const [w] = await offeneVorschlaege('ki_bild');
    await stapel.entscheide(w.id, 'abgelehnt', { von: 'lena' });
    await art.nachAblehnen!(w, 'lena');
    expect(await mediumIm(w.bezug!.id)).toMatchObject({ geloeschtAm: expect.any(String), urheber: { ki: { vorschlag: 'verworfen' } } });
  });
  it('video_starten: NUR als Auftrag im Stapel (kein Aufruf) — erst der Klick startet mit genau der gezeigten Schätzung', async () => {
    await einrichten();
    const r = await wz.medienWerkzeugAusfuehren('video_starten', { beschreibung: 'Kurzer Schwenk über einen Stand', sekunden: 10 }, kontext());
    expect(r).toMatchObject({ ok: true, gestapelt: true });
    expect(r.text).toMatch(/NICHT GESTARTET/);
    expect(anGoogle(':predictLongRunning')).toEqual([]);
    const [v] = await offeneVorschlaege('ki_auftrag');
    expect(v.eingabe).toMatchObject({ art: 'video', sekunden: 10, schaetzungCent: expect.any(Number) });
    const { stapelArtVon } = await import('@/lib/zoe/stapel-arten');
    const art = (await stapelArtVon(v))!;
    expect(await art.freigeben(v, 'lena', { sammel: 'ch-x' })).toMatchObject({ ok: false, status: 409 });
    expect(await art.freigeben(v, 'lena', {})).toMatchObject({ ok: true });
    expect(anGoogle(':predictLongRunning')).toHaveLength(1);
    expect((await stapel.hole(v.id))?.status).toBe('freigegeben');
  });
  it('Budget-Prüfung VOR dem Aufruf: über dem Budget bzw. der Grenze je Auftrag geht nichts hinaus', async () => {
    await einrichten({ budget: { monatEuroCent: 1 } });
    const r = await wz.medienWerkzeugAusfuehren('bild_erzeugen', { beschreibung: 'Teures Motiv' }, kontext());
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/Budget/);
    expect(anGoogle(':generateContent')).toEqual([]);
    await einrichten({ budget: { auftragEuroCent: 1 } });
    const v = await wz.medienWerkzeugAusfuehren('video_starten', { beschreibung: 'Teures Video', sekunden: 10 }, kontext());
    expect(v.ok).toBe(false);
    expect(v.text).toMatch(/Grenze je Auftrag/);
    expect((await offeneVorschlaege('ki_auftrag')).some(x => (x.eingabe as { prompt?: string }).prompt === 'Teures Video')).toBe(false);
  });
  it('nach fremdem Text im Thread erzeugt bild_erzeugen nichts selbst — Auftrag mit Schätzung in den Stapel', async () => {
    await einrichten();
    const r = await wz.medienWerkzeugAusfuehren('bild_erzeugen', { beschreibung: 'Motiv aus einer Mail' }, kontext({ fremdGelesen: true }));
    expect(r).toMatchObject({ ok: true, gestapelt: true });
    expect(anGoogle(':generateContent')).toEqual([]);
    expect((await offeneVorschlaege('ki_auftrag')).some(x => (x.eingabe as { art: string; prompt: string }).prompt === 'Motiv aus einer Mail')).toBe(true);
  });
});

describe('Angebot und Einhängen', () => {
  it('wer welche Medien-Werkzeuge bekommt; Helfer nur lesend; mitMedien reicht andere Werkzeuge durch', async () => {
    const s = await ke.kiSchalterFuer('lena');
    expect(wz.medienWerkzeugeFuer({ art: 'head', head: katalog.headDef('marketing')!, schalter: s })).toEqual(['medien_suchen']);
    expect(wz.medienWerkzeugeFuer({ art: 'head', head: katalog.headDef('sales')!, schalter: s })).toEqual([]);
    expect(wz.medienWerkzeugeFuer({ art: 'mitarbeiter', head: katalog.headDef('sales')!, mitarbeiter: { id: 'marketing-bild-video' }, schalter: s })).toContain('video_starten');
    expect(wz.medienWerkzeugeFuer({ art: 'mitarbeiter', head: katalog.headDef('marketing')!, mitarbeiter: { id: 'marketing-bild-video' }, schalter: s, helfer: true })).toEqual(['medien_suchen']);
    const angebot = { tools: [], register: new Set<string>(), agenten: new Set<string>() };
    wz.medienAngebotErgaenzen(angebot, { art: 'head', head: katalog.headDef('marketing')!, schalter: s });
    expect(angebot.tools.map(t => (t as { name: string }).name)).toEqual(['medien_suchen']);
    const h = wz.mitMedien({ ausfuehren: async n => ({ text: `durch:${n}`, ok: true }) }, { person: 'lena', head: katalog.headDef('marketing')!, agent: { art: 'head', headId: 'marketing' }, hintergrund: false });
    expect((await h.ausfuehren('skill_laden', {}, { fremdGelesen: false } as never)).text).toBe('durch:skill_laden');
    // Agenten-Werkzeuge: nie im ZOE-Register (keine Namensgleichheit), nie mit den übrigen Agenten-Werkzeugen.
    const { REGISTER } = await import('@/lib/zoe/register');
    const { WERKZEUGE } = await import('@/lib/zoe/werkzeuge');
    const { AGENTEN_WERKZEUG_NAMEN } = await import('@/lib/agenten/werkzeuge');
    for (const w of wz.MEDIEN_WERKZEUG_NAMEN) { expect((REGISTER as Record<string, unknown>)[w], w).toBeUndefined(); expect(WERKZEUGE[w], w).toBeUndefined(); expect(AGENTEN_WERKZEUG_NAMEN.has(w), w).toBe(false); }
    // Werkzeug-Limit je Head (20, Vertrag) inkl. Medien-Werkzeuge.
    const { HEAD_WERKZEUGE, GRENZEN } = await import('@/lib/agenten/typen');
    for (const head of katalog.KATALOG) expect(head.werkzeuge.length + HEAD_WERKZEUGE.length + (wz.MEDIEN_AGENTEN.heads[head.id]?.length ?? 0), head.id).toBeLessThanOrEqual(GRENZEN.werkzeugeJeHead);
  });
  it('KI-Kategorie „medien“: im Tor ohne Schalter gesperrt, nur die Person selbst schaltet ein (Vorgabe aus)', async () => {
    const { torEntscheiden } = await import('@/lib/datenschutz/ki-tor');
    const { KI_KATEGORIEN, vorgabeSchalter, wirksameSchalter } = ke;
    expect(KI_KATEGORIEN).toContain('medien');
    const k = { lauf: 'aufruf' as const, person: 'lena', kategorien: ['allgemein', 'medien'] as import('@/lib/datenschutz/ki-einstellungen').KiKategorie[] };
    expect(torEntscheiden(vorgabeSchalter('kompatibel'), false, k, false)).toMatchObject({ ok: false, grund: 'medien-aus' });
    expect(torEntscheiden({ ...vorgabeSchalter('kompatibel'), bilder: true }, false, k, false).ok).toBe(true);
    const d = { vorgabe: 'kompatibel' as const, festgelegtAm: '2026-10-01', personen: { lena: { bilderAnKi: true } } };
    expect(wirksameSchalter(d, 'lena').bilder).toBe(true);
    expect(wirksameSchalter(d, 'jonas').bilder).toBeUndefined();
    expect(wirksameSchalter(d, null).bilder).toBeUndefined();
    // Route: nur die Person selbst (Dienstweg nie).
    const route = await import('@/app/api/datenschutz/ki/route');
    const put = (kopf: Record<string, string>, body: unknown) => route.PUT(new Request('http://test/api/datenschutz/ki', { method: 'PUT', headers: { 'content-type': 'application/json', ...kopf }, body: JSON.stringify(body) }));
    expect((await put({ 'x-make-key': 'pruef-schluessel-p4c', 'x-make-person': 'lena' }, { ebene: 'person', bilderAnKi: true })).status).toBe(403);
    expect((await put({ 'x-make-user': 'jonas' }, { ebene: 'person', bilderAnKi: true, person: 'lena' })).status).toBe(403);
    const r = await put({ 'x-make-user': 'lena' }, { ebene: 'person', bilderAnKi: true });
    expect((await r.json()).eigen.bilderAnKi).toBe(true);
    expect((await ke.kiSchalterFuer('lena')).bilder).toBe(true);
    expect((await ke.kiSchalterFuer('jonas')).bilder).toBeUndefined();
  });
});
