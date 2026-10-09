// ─── Nahtstellen-Prüfung „Zugang & Trennung“ (09.10., nach der Nacht 08./09.10.) ─────────────────────────────────────────────
// Pakete, die je für sich richtig sind, ergaben zusammen eine Lücke. Wächter für die behobenen Nahtstellen:
//   (1) Instanz-Export (05.10., „nur Inhaber“) × mehrere Inhaber (R9, 09.10.): der Export enthält JEDEN Bestand entschlüsselt — ein weiterer
//       Inhaber bekäme so Gesundheit, Journal, „nur ich“ der anderen Person. „Inhaber heißt Verwaltung, nicht Einsicht“ → nur der Haupt-Inhaber.
//   (2) Instanz-Export ohne Zugangsdaten (09.10.) × ZOE-Kanäle: offene Kopplungs-/Bestätigungscodes (Telegram, ZOE auf WhatsApp) nie in der Datei.
//   (3) KI-Budget (Anbieter-Tor, 09.10.) × mehrere Inhaber: die Warnung geht an JEDEN Inhaber (Regel „Meldungen an den Inhaber an alle“).
//   (4) Konto löschen × KI-Medien-Auftragsbuch × wiedervergebene Speichernamen: nichts der gelöschten Person fällt einem neuen Konto zu.
//   (5) Art. 15/17 über die neuen KI-Bestände (Tiefenbericht, KI-Medien) und die Konto-Auskunft (Verarbeitung „KI über weitere Anbieter“).
//   (6) Einzel-Wiederherstellung (29.09., „nur Inhaber“) × mehrere Inhaber: Tageskopien GEMEINSAMER Bestände tragen „nur ich“-Aufgaben und
//       `konten` mit dem Geheimnis des zweiten Faktors — per Sitzung nur noch Tage/Vorschau; Inhalte und Übernahme nur eigene persönliche Bestände.
// Eigener Datenordner, erfundene Konten (@example.invalid), kein Netz, kein Modell.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-nahtstellen-zugang-'));
process.env.MAKE_OS_DATEN_DIR = path.join(ordner, 'daten');
process.env.MAKE_OS_GRABSTEINE_DIR = path.join(ordner, 'grabsteine');
process.env.MAKE_OS_KEY = 'pruef-schluessel-nahtstellen-zugang';
process.env.MAKE_VAULT_DIR = path.join(ordner, 'vault');
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ANTHROPIC_API_KEY;
mkdirSync(process.env.MAKE_OS_DATEN_DIR, { recursive: true });
mkdirSync(process.env.MAKE_VAULT_DIR, { recursive: true });

const PW = 'TESTPASSWORT-nahtstellen-zugang';
const G = { erste: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP', zweite: 'KRUGS4ZANFZSAYJAORSXG5BAMNXWIZJA' };
const MARKE = { journal: 'NAHT-GEHEIM-JOURNAL-ERSTE', telegramCode: 'NAHTC2', zoeCode: 'NAHT-GEHEIM-ZOE-CODE-HASH' };
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });

let db: typeof import('@/lib/store/local-db');
let totp: typeof import('@/lib/zugang/totp');
const echtesFetch = globalThis.fetch;

beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  db = await import('@/lib/store/local-db');
  totp = await import('@/lib/zugang/totp');
  const K = await import('@/lib/zugang/konten');
  const konto = async (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({
    id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Probe`, rolle, ...(await K.passwortHashen(PW, K.KDF_STANDARD)),
    angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt: 'haus', ...extra,
  });
  const faktor = (g: string) => ({ zweiterFaktor: { geheimnis: g, seit: '2026-10-01', wiederherstellung: [] } });
  await db.saveJson('konten', { konten: [
    await konto('k1', 'erste', 'inhaber', faktor(G.erste)),
    await konto('k2', 'zweite', 'inhaber', faktor(G.zweite)),
    await konto('k3', 'dritte', 'mitglied'),
  ], einladungen: [], einstellungen: { hauptInhaber: 'erste' } });
  // Persönlicher Bestand der ersten Person (nicht geteilt) — darf nie über einen Weg der zweiten Inhaberin hinaus.
  await db.saveJson('journal--erste', { '2026-10-01': { text: MARKE.journal } });
  // Offene Codes: Telegram-Kopplung (Klartext) und ZOE auf WhatsApp (Fingerabdruck eines 6-Zeichen-Codes).
  const bis = new Date(Date.now() + 10 * 60_000).toISOString();
  await db.saveJson('telegram', { kopplungen: [], codes: { [MARKE.telegramCode]: { person: 'erste', bis } } });
  await db.saveJson('zoe-kanal--erste', { v: 1, status: 'wartet', nummer: '491700000009', code: { hash: MARKE.zoeCode, bis, versuche: 0 }, ereignisse: [] });
}, 60_000);
afterAll(async () => {
  globalThis.fetch = echtesFetch;
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  rmSync(ordner, { recursive: true, force: true });
});

const code = (wer: keyof typeof G, plus = 0) => totp.codeFuer(G[wer], totp.stufeVon() + plus);
type H = (r: Request) => Promise<Response>;
const exportRoute = async () => (await import('@/app/api/datenschutz/instanz-export/route')) as unknown as { GET: H; POST: H };

describe('(1) Instanz-Export nur beim Haupt-Inhaber — auch eine gleichwertige zweite Inhaberin bekommt die Instanz nicht', () => {
  it('GET: Haupt-Inhaber 200 (Umfang), zweite Inhaberin 403, Mitglied 403', async () => {
    const { GET } = await exportRoute();
    expect((await GET(new Request('http://test/api/datenschutz/instanz-export', { headers: sitzung('erste') }))).status).toBe(200);
    expect((await GET(new Request('http://test/api/datenschutz/instanz-export', { headers: sitzung('zweite') }))).status).toBe(403);
    expect((await GET(new Request('http://test/api/datenschutz/instanz-export', { headers: sitzung('dritte') }))).status).toBe(403);
  });

  it('POST: die zweite Inhaberin mit richtigem Passwort UND Code → 403, kein Byte des persönlichen Bestands der anderen Person', async () => {
    const { POST } = await exportRoute();
    const r = await POST(new Request('http://test/api/datenschutz/instanz-export', { method: 'POST', headers: sitzung('zweite'), body: JSON.stringify({ passwort: PW, code: code('zweite') }) }));
    expect(r.status).toBe(403);
    expect(await r.text()).not.toContain(MARKE.journal);
  });

  it('Gegenprobe: der Haupt-Inhaber bekommt den Export (mit Passwort und Code) — der Bestand liegt wirklich da', async () => {
    const { POST } = await exportRoute();
    const r = await POST(new Request('http://test/api/datenschutz/instanz-export', { method: 'POST', headers: sitzung('erste'), body: JSON.stringify({ passwort: PW, code: code('erste', 1) }) }));
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(text).toContain(MARKE.journal);
    // (2) im selben Export: keine offenen Codes.
    expect(text).not.toContain(MARKE.telegramCode);
    expect(text).not.toContain(MARKE.zoeCode);
    const j = JSON.parse(text) as { bestaende: Record<string, Record<string, unknown>> };
    expect(j.bestaende.telegram.codes).toEqual({});
    expect(j.bestaende['zoe-kanal--erste']).toMatchObject({ status: 'wartet' });
    expect('code' in j.bestaende['zoe-kanal--erste']).toBe(false);
  }, 60_000);
});

describe('(2) Instanz-Export: offene Kopplungs- und Bestätigungscodes nie in der Datei (rein)', () => {
  it('ohneOffeneCodes: telegram.codes leer, zoe-kanal--*.code weg, alles andere unverändert', async () => {
    const { ohneOffeneCodes } = await import('@/lib/datenschutz/instanz-export');
    expect(ohneOffeneCodes('telegram', { kopplungen: [{ chatId: 1 }], codes: { X: { person: 'a' } }, letzteUpdate: 5 })).toEqual({ kopplungen: [{ chatId: 1 }], codes: {}, letzteUpdate: 5 });
    expect(ohneOffeneCodes('zoe-kanal--a', { v: 1, status: 'verbunden', code: { hash: 'h' }, ereignisse: [] })).toEqual({ v: 1, status: 'verbunden', ereignisse: [] });
    const anders = { code: 'bleibt' };
    expect(ohneOffeneCodes('ziele', anders)).toBe(anders);
  });
});

describe('(3) KI-Budget-Glocke an JEDEN Inhaber', () => {
  it('80 % des Monatsbudgets: beide Inhaber bekommen die Meldung, das Mitglied nicht', async () => {
    const { budgetMelden } = await import('@/lib/ki/tor');
    expect(await budgetMelden(80, new Date('2026-10-09T10:00:00Z'))).toBe(true);
    const text = async (p: string) => JSON.stringify(await db.loadJson(`meldungen--${p}`));
    expect(await text('erste')).toContain('KI-Budget des Monats ist zu 80 %');
    expect(await text('zweite')).toContain('KI-Budget des Monats ist zu 80 %');
    expect(await text('dritte')).not.toContain('KI-Budget');
  }, 60_000);
});

describe('(4) Konto löschen × KI-Medien: nichts fällt einem neuen Konto mit demselben Speichernamen zu', () => {
  const km = (id: string, person: string, extra: Record<string, unknown>) => ({
    id: `km-00000000-0000-4000-8000-${id.padStart(12, '0')}`, art: 'bild', status: 'fertig', anbieter: 'google', modell: 'm', erzeugtAm: '2026-10-08T10:00:00.000Z', person,
    sichtbarkeit: 'haushalt', prompt: `Auftrag von ${person}`, kennzeichnung: { synthid: true, c2pa: false, eigeneMarke: true }, zeichenNoetig: false, kosten: { euroCent: 1, geschaetzt: true }, ...extra,
  });

  it('kiMedienOhnePerson (rein): laufend → Fehler + Papierkorb, „nur ich“/Ziel Privat → Papierkorb, übrige → „[gelöscht]“, andere unberührt', async () => {
    const { kiMedienOhnePerson } = await import('@/lib/ki/medien');
    const liste = [
      km('1', 'dritte', { sichtbarkeit: 'nur-ich' }),
      km('2', 'dritte', { status: 'laeuft', art: 'video', operation: 'op-1' }),
      km('3', 'dritte', {}),
      km('4', 'dritte', { ziel: { bereich: 'privat' } }),
      km('5', 'erste', { sichtbarkeit: 'nur-ich' }),
    ] as unknown as Parameters<typeof kiMedienOhnePerson>[0];
    const r = kiMedienOhnePerson(liste, 'dritte', '[gelöscht]', '2026-10-09T10:00:00.000Z');
    expect(r.anzahl).toBe(4);
    expect(r.medien.filter(m => m.person === 'dritte')).toEqual([]);
    expect(r.medien[0]).toMatchObject({ person: '[gelöscht]', geloeschtAm: '2026-10-09T10:00:00.000Z' });
    expect(r.medien[1]).toMatchObject({ status: 'fehler', fehler: 'Konto gelöscht', geloeschtAm: '2026-10-09T10:00:00.000Z' });
    expect(r.medien[2].geloeschtAm).toBeUndefined();
    expect(r.medien[3].geloeschtAm).toBe('2026-10-09T10:00:00.000Z');
    expect(r.medien[4]).toBe(liste[4]);
  });

  it('kontoLoeschen räumt das Auftragsbuch; der Takt holt danach nichts mehr ab, die Übernahme legt nichts unter dem Namen ab', async () => {
    await db.saveJson('ki-medien--haus', { medien: [
      km('11', 'dritte', { sichtbarkeit: 'nur-ich' }),
      km('12', 'dritte', { status: 'laeuft', art: 'video', operation: 'op-2' }),
      km('13', 'erste', { status: 'laeuft', art: 'video', operation: 'op-3' }),
    ] });
    const { kontoLoeschen } = await import('@/lib/datenschutz/konto-daten');
    expect(await kontoLoeschen('dritte', { grabstein: false })).toBeTruthy();
    const nach = (await db.loadJson<{ medien: { person: string; status: string; geloeschtAm?: string }[] }>('ki-medien--haus'))!.medien;
    expect(nach.filter(m => m.person === 'dritte')).toEqual([]);
    const { laufendeMedien } = await import('@/lib/ki/medien');
    expect((await laufendeMedien('haus')).map(m => m.person)).toEqual(['erste']);
    // Ein neues Konto bekommt denselben Speichernamen (speicherName vergibt frei gewordene Namen wieder).
    const K = await import('@/lib/zugang/konten');
    expect(K.speicherName('Dritte Neu', (await K.ladeKonten()).konten.map(k => k.speicher))).toBe('dritte');
    const { kiMedienUebernehmen } = await import('@/lib/medien/ki-ablage');
    await kiMedienUebernehmen('haus');
    expect(await db.loadJson('medien-privat--dritte')).toBeNull();
  }, 60_000);
});

describe('(5) Art. 15/17 über die neuen KI-Bestände', () => {
  it('Tiefenbericht und KI-Medien werden bei Art. 17 getilgt (Register „tilgen“ + Umsetzung)', async () => {
    const { WEITERE_SPEICHER } = await import('@/lib/crm/person-weitere');
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    for (const name of ['ki-tiefenbericht--erste', 'ki-medien--haus']) {
      expect(WEITERE_SPEICHER.find(s => s.muster.test(name))?.behandlung, name).toBe('tilgen');
      expect(registerEintrag(name)?.behandlung, name).toBe('tilgen');
    }
  });

  it('die Konto-Auskunft kennt die Verarbeitung „KI über weitere Anbieter“', async () => {
    const { KONTO_VERARBEITUNGEN } = await import('@/lib/datenschutz/art15');
    const { VV_KI_ANBIETER } = await import('@/lib/datenschutz/vvt-ki');
    expect(KONTO_VERARBEITUNGEN as readonly string[]).toContain(VV_KI_ANBIETER);
  });
});

describe('(6) Einzel-Wiederherstellung: Tageskopien gemeinsamer Bestände öffnen per Sitzung nichts Persönliches und keine Geheimnisse', () => {
  const TAG = '2026-10-01';
  const NURICH = 'NAHT-GEHEIM-NURICH-AUFGABE';
  const EIGEN = 'NAHT-EIGENES-ZIEL-ZWEITE';
  beforeAll(() => {
    // Tageskopien wie local-db sie anlegt (ohne Datenschlüssel: JSON) — konten mit Hash/Salz/2FA, tasks mit einer „nur ich“-Aufgabe der ersten Person.
    const b = path.join(process.env.MAKE_OS_DATEN_DIR!, 'backup');
    mkdirSync(b, { recursive: true });
    writeFileSync(path.join(b, `konten-${TAG}.json`), JSON.stringify({ konten: [{ id: 'k1', speicher: 'erste', rolle: 'inhaber', hash: 'h', salz: 's', zweiterFaktor: { geheimnis: G.erste, seit: TAG, wiederherstellung: [] } }], einladungen: [] }));
    writeFileSync(path.join(b, `tasks-${TAG}.json`), JSON.stringify({ projects: [], tasks: [{ id: 't-naht-geheim', title: NURICH, status: 'todo', sichtbarkeit: 'nur-ich', angelegtVon: 'erste', assignee: 'erste' }] }));
    writeFileSync(path.join(b, `ziele-eigen--zweite-${TAG}.json`), JSON.stringify({ jahr: [{ id: 'z-eigen', titel: EIGEN }] }));
  });
  type R = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
  const route = async () => (await import('@/app/api/intern/wiederherstellen/route')) as unknown as R;
  const hol = async (kopf: Record<string, string>, q: string) => { const r = await (await route()).GET(new Request(`http://test/api/intern/wiederherstellen?${q}`, { headers: kopf })); return { status: r.status, text: await r.text() }; };

  it('zweite Inhaberin: `konten` und „nur ich“-Aufgabe aus der Tageskopie → 403, kein Geheimnis, kein Titel', async () => {
    for (const q of [`bestand=konten&tag=${TAG}&liste=konten&ids=k1`, `bestand=tasks&tag=${TAG}&liste=tasks&ids=t-naht-geheim`]) {
      const r = await hol(sitzung('zweite'), q);
      expect(r.status, q).toBe(403);
      expect(r.text).not.toContain(G.erste);
      expect(r.text).not.toContain(NURICH);
    }
    // Übernahme ebenso nicht (sie könnte sonst z. B. den zweiten Faktor der anderen Person auf einen alten Stand zurücksetzen).
    const p = await (await route()).POST(new Request('http://test/api/intern/wiederherstellen', { method: 'POST', headers: sitzung('zweite'), body: JSON.stringify({ bestand: 'konten', tag: TAG, liste: 'konten', auswahl: { k1: null } }) }));
    expect(p.status).toBe(403);
  });

  it('auch der Haupt-Inhaber per Sitzung bekommt keine Zugangsgeheimnisse aus `konten`; die Vorschau nennt nur Kennungen', async () => {
    const r = await hol(sitzung('erste'), `bestand=konten&tag=${TAG}&liste=konten&ids=k1`);
    expect(r.status).toBe(403);
    expect(r.text).not.toContain(G.erste);
    const v = await hol(sitzung('zweite'), `bestand=tasks&tag=${TAG}`);
    expect(v.status).toBe(200);
    expect(v.text).not.toContain(NURICH);
  });

  it('Gegenprobe: eigene persönliche Bestände per Sitzung lesbar; das Skript am Server (Systemlauf) liest alles', async () => {
    const eigen = await hol(sitzung('zweite'), `bestand=ziele-eigen--zweite&tag=${TAG}&liste=jahr&ids=z-eigen`);
    expect(eigen.status).toBe(200);
    expect(eigen.text).toContain(EIGEN);
    const skript = await hol({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! }, `bestand=tasks&tag=${TAG}&liste=tasks&ids=t-naht-geheim`);
    expect(skript.status).toBe(200);
    expect(skript.text).toContain(NURICH);
  });
});
