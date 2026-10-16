// ─── Gerät merken für den zweiten Faktor (16.10.) ───────────────────────────────────────────────────────────────────────────
// Kevin: „nervt mega“ — Code nur noch einmal je Gerät, 90 Tage. Der Schutz bleibt: ein gestohlenes Passwort reicht auf einem fremden
// Gerät nicht, Token und Hash stehen nie in Antworten oder Protokollen, alle Bremsen greifen weiter. Eigener Datenordner, nur Test-Werte.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest } from 'next/server';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-geraet-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-geraet-nur-test';
process.env.SESSION_SECRET = 'pruef-sitzungsgeheimnis-geraet-nur-test-0000000';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;

const PW = 'TESTPASSWORT-nur-fuer-den-test';
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let S: typeof import('@/lib/zugang/sitzung');
let G: typeof import('@/lib/zugang/geraete');
let totp: typeof import('@/lib/zugang/totp');
let drossel: typeof import('@/lib/zugang/drossel');
let anmelden: typeof import('@/app/api/konto/anmelden/route');
let geraeteRoute: typeof import('@/app/api/konto/geraete/route');
let ichRoute: typeof import('@/app/api/konto/ich/route');
let zfRoute: typeof import('@/app/api/konto/zwei-faktor/route');
let middleware: typeof import('@/middleware').middleware;
let probe: typeof import('@/lib/betrieb/update-probe');
let exportMod: typeof import('@/lib/datenschutz/instanz-export');

const GEHEIM: Record<string, string> = {};

async function grundzustand() {
  const hash = await K.passwortHashen(PW);
  GEHEIM['person-a'] = totp.neuesGeheimnis();
  GEHEIM['person-b'] = totp.neuesGeheimnis();
  const zf = (sp: string) => ({ geheimnis: GEHEIM[sp], seit: '2026-10-01T00:00:00.000Z', wiederherstellung: [] });
  await db.saveJson('konten', {
    konten: [
      { id: 'k-a', speicher: 'person-a', email: 'a@example.invalid', name: 'A', rolle: 'inhaber', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', zweiterFaktor: zf('person-a') },
      { id: 'k-b', speicher: 'person-b', email: 'b@example.invalid', name: 'B', rolle: 'mitglied', ...hash, angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', zweiterFaktor: zf('person-b') },
    ],
    einladungen: [],
  });
  await db.saveJson('anmeldungen', { eintraege: [] });
  drossel._zuruecksetzen();
}

/** Ein frischer Code (der Wiederholungsschutz merkt sich die letzte Stufe — für den Test zurückgesetzt). */
async function code(speicher: string): Promise<string> {
  await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === speicher && k.zweiterFaktor ? { ...k, zweiterFaktor: { ...k.zweiterFaktor, letzteStufe: undefined } } : k) }));
  const k = (await K.ladeKonten()).konten.find(x => x.speicher === speicher)!;
  return totp.codeFuer(k.zweiterFaktor!.geheimnis, totp.stufeVon(Date.now()));
}

interface Login { code?: string; merken?: boolean; cookie?: string; email?: string; passwort?: string }
async function login(o: Login = {}): Promise<{ status: number; body: Record<string, unknown>; text: string; geraet: string | null; geraetKopf: string | null; sitzung: boolean }> {
  const res = await anmelden.POST(new Request('http://test/api/konto/anmelden', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA_MAC, ...(o.cookie !== undefined ? { cookie: o.cookie } : {}) },
    body: JSON.stringify({ email: o.email ?? 'a@example.invalid', passwort: o.passwort ?? PW, ...(o.code !== undefined ? { code: o.code } : {}), ...(o.merken !== undefined ? { merken: o.merken } : {}) }),
  }));
  const text = await res.text();
  const kekse = res.headers.getSetCookie();
  const kopf = kekse.find(c => c.startsWith(`${S.GERAET_COOKIE}=`)) ?? null;
  const roh = kopf ? kopf.slice(S.GERAET_COOKIE.length + 1).split(';')[0] : null;
  return { status: res.status, body: JSON.parse(text), text, geraet: roh === null ? null : decodeURIComponent(roh), geraetKopf: kopf, sitzung: kekse.some(c => c.startsWith(`${S.SITZUNG_COOKIE}=`) && !c.startsWith(`${S.SITZUNG_COOKIE}=;`)) };
}
const keks = (wert: string) => `${S.GERAET_COOKIE}=${encodeURIComponent(wert)}`;

/** Passwort + Code + merken → Wert des Geräte-Cookies. */
async function merken(speicher = 'person-a', cookie?: string): Promise<string> {
  const r = await login({ email: speicher === 'person-a' ? 'a@example.invalid' : 'b@example.invalid', code: await code(speicher), merken: true, cookie });
  expect(r.status).toBe(200);
  expect(r.geraet).toBeTruthy();
  return r.geraet!;
}
const geraeteVon = async (speicher: string) => (await K.ladeKonten()).konten.find(k => k.speicher === speicher)!.zweiterFaktor?.geraete ?? [];

/** Alle Dateien des Datenordners als Text (ohne Verschlüsselung in diesem Test lesbar). */
function alleDateien(): { pfad: string; text: string }[] {
  const aus: { pfad: string; text: string }[] = [];
  const lauf = (d: string) => { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) lauf(p); else aus.push({ pfad: path.relative(ordner, p), text: readFileSync(p, 'utf8') }); } };
  lauf(ordner);
  return aus;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  S = await import('@/lib/zugang/sitzung');
  G = await import('@/lib/zugang/geraete');
  totp = await import('@/lib/zugang/totp');
  drossel = await import('@/lib/zugang/drossel');
  anmelden = await import('@/app/api/konto/anmelden/route');
  geraeteRoute = await import('@/app/api/konto/geraete/route');
  ichRoute = await import('@/app/api/konto/ich/route');
  zfRoute = await import('@/app/api/konto/zwei-faktor/route');
  ({ middleware } = await import('@/middleware'));
  probe = await import('@/lib/betrieb/update-probe');
  exportMod = await import('@/lib/datenschutz/instanz-export');
});
beforeEach(() => grundzustand());
afterAll(() => rmSync(ordner, { recursive: true, force: true }));

describe('Merken → nächste Anmeldung ohne Code', () => {
  it('Passwort allein fragt nach dem Code; mit Code + merken: Cookie; danach genügt das Passwort', async () => {
    const erst = await login();
    expect(erst.body).toEqual({ ok: false, zweiterFaktor: true });
    expect(erst.sitzung).toBe(false);
    const wert = await merken();
    const g = await geraeteVon('person-a');
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ beschreibung: 'Safari · Mac' });
    expect(Date.parse(g[0].bis) - Date.parse(g[0].angelegt)).toBe(90 * 864e5);

    const zweit = await login({ cookie: keks(wert) });
    expect(zweit.status).toBe(200);
    expect(zweit.body.ok).toBe(true);
    expect(zweit.body.zweiterFaktor).toBeUndefined();
    expect(zweit.sitzung).toBe(true);
    // Protokoll: „angemeldet (gemerktes Gerät)“ mit Kennung, und das Merken selbst.
    const prot = ((await db.loadJson<{ eintraege: { art: string; ok: boolean; geraet?: string }[] }>('anmeldungen'))?.eintraege ?? []);
    expect(prot.filter(e => e.art === 'geraet-gemerkt' && e.geraet === g[0].id)).toHaveLength(1);
    expect(prot.at(-1)).toMatchObject({ art: 'anmelden', ok: true, geraet: g[0].id });
  });

  it('das Cookie: HttpOnly, SameSite=Strict, Pfad /, 90 Tage — und nur, wenn „merken“ angehakt ist', async () => {
    const ohne = await login({ code: await code('person-a'), merken: false });
    expect(ohne.status).toBe(200);
    expect(ohne.geraet).toBeNull();
    expect(await geraeteVon('person-a')).toHaveLength(0);
    const mit = await login({ code: await code('person-a'), merken: true });
    expect(mit.geraetKopf).toMatch(/HttpOnly/i);
    expect(mit.geraetKopf).toMatch(/SameSite=strict/i);
    expect(mit.geraetKopf).toMatch(/Path=\//);
    expect(mit.geraetKopf).toMatch(/Max-Age=7776000/);
    expect(mit.geraet).toMatch(/^g-[a-f0-9]{16}\.[A-Za-z0-9_-]{43}$/);
  });

  it('auch nach einem Wiederherstellungscode', async () => {
    const [w] = totp.neueWiederherstellungscodes(1);
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-a' ? { ...k, zweiterFaktor: { ...k.zweiterFaktor!, wiederherstellung: [{ hash: totp.wiederherstellungHash(w, k.salz) }] } } : k) }));
    const r = await login({ code: w, merken: true });
    expect(r.status).toBe(200);
    expect((await login({ cookie: keks(r.geraet!) })).body.ok).toBe(true);
  });

  it('Glocke „sicherheit“ mit neutralem Titel beim neu gemerkten Gerät', async () => {
    await merken();
    const treffer = alleDateien().filter(d => d.pfad.startsWith('meldungen--person-a'));
    expect(treffer.length).toBeGreaterThan(0);
    const t = treffer.map(d => d.text).join('\n');
    expect(t).toContain('Neues Gerät für die Anmeldung gemerkt');
    expect(t).toContain('"sicherheit"');
    expect(t).not.toContain('Safari');
  });
});

describe('Wann wieder der Code kommt', () => {
  it('abgelaufen → Code', async () => {
    const wert = await merken();
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-a' ? { ...k, zweiterFaktor: { ...k.zweiterFaktor!, geraete: k.zweiterFaktor!.geraete!.map(g => ({ ...g, bis: new Date(Date.now() - 1000).toISOString() })) } } : k) }));
    expect((await login({ cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
  });

  it('fremdes Konto mit dem Token → Code (still, ohne Hinweis)', async () => {
    const wertA = await merken('person-a');
    const r = await login({ email: 'b@example.invalid', cookie: keks(wertA) });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: false, zweiterFaktor: true });
  });

  it('falsches oder kaputtes Token → still die Codeabfrage, keine Fehlermeldung', async () => {
    const wert = await merken();
    const [id] = wert.split('.');
    for (const falsch of [`${id}.${'A'.repeat(43)}`, 'g-0000000000000000.' + 'B'.repeat(43), 'unsinn', '~~~', `${wert}.mehr`]) {
      const r = await login({ cookie: keks(falsch) });
      expect(r.status, falsch).toBe(200);
      expect(r.body, falsch).toEqual({ ok: false, zweiterFaktor: true });
    }
  });

  it('Passwortwechsel → Code (Liste geleert; auch ein zurückgespieltes Gerät passt wegen des neuen Stands nicht mehr)', async () => {
    const wert = await merken();
    const vorher = await geraeteVon('person-a');
    const NEU = 'NEUES-TESTPASSWORT-nur-fuer-den-test';
    const r = await ichRoute.PUT(new Request('http://test/api/konto/ich', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' }, body: JSON.stringify({ passwortAlt: PW, passwortNeu: NEU }) }));
    expect(r.status).toBe(200);
    expect(await geraeteVon('person-a')).toHaveLength(0);
    expect((await login({ passwort: NEU, cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
    // Rückweg-Fall: der alte Stand ändert das Passwort und trägt die Liste weiter — der Stand passt nicht mehr.
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-a' ? { ...k, zweiterFaktor: { ...k.zweiterFaktor!, geraete: vorher } } : k) }));
    expect((await login({ passwort: NEU, cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
  });

  it('zweiten Faktor neu einrichten → Code; ausschalten → Geräte weg', async () => {
    const wert = await merken();
    const vorher = await geraeteVon('person-a');
    const post = (b: unknown) => zfRoute.POST(new Request('http://test/api/konto/zwei-faktor', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a' }, body: JSON.stringify(b) }));
    const beginn = await (await post({ aktion: 'beginnen' })).json();
    expect((await post({ aktion: 'bestaetigen', code: totp.codeFuer(beginn.geheimnis, totp.stufeVon(Date.now())) })).status).toBe(200);
    expect(await geraeteVon('person-a')).toHaveLength(0);
    expect((await login({ cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
    // Auch zurückgespielt: an den neuen Faktor gebunden (Beginn) — passt nicht.
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-a' ? { ...k, zweiterFaktor: { ...k.zweiterFaktor!, geraete: vorher } } : k) }));
    expect((await login({ cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
    expect((await post({ aktion: 'aus', passwort: PW })).status).toBe(200);
    expect((await K.ladeKonten()).konten.find(k => k.speicher === 'person-a')!.zweiterFaktor).toBeUndefined();
  });

  it('Gerät vergessen → Code; „alle“ ebenso; das Cookie verliert den Eintrag', async () => {
    const wert = await merken();
    const [id] = wert.split('.');
    const post = (b: unknown, cookie?: string) => geraeteRoute.POST(new Request('http://test/api/konto/geraete', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-user': 'person-a', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(b) }));
    const r = await post({ aktion: 'vergessen', id }, keks(wert));
    expect(r.status).toBe(200);
    expect(r.headers.getSetCookie().find(c => c.startsWith(`${S.GERAET_COOKIE}=`))).toMatch(/Max-Age=0/);
    expect((await login({ cookie: keks(wert) })).body).toEqual({ ok: false, zweiterFaktor: true });
    expect((await post({ aktion: 'vergessen', id })).status).toBe(404);

    const w1 = await merken(), w2 = await merken();
    expect(await geraeteVon('person-a')).toHaveLength(2);
    expect((await post({ aktion: 'alle' })).status).toBe(200);
    expect(await geraeteVon('person-a')).toHaveLength(0);
    for (const w of [w1, w2]) expect((await login({ cookie: keks(w) })).body).toEqual({ ok: false, zweiterFaktor: true });
    const prot = ((await db.loadJson<{ eintraege: { art: string; geraet?: string }[] }>('anmeldungen'))?.eintraege ?? []).map(e => e.art);
    expect(prot).toContain('geraet-vergessen');
    expect(prot).toContain('geraete-vergessen');
  });
});

describe('Grenzen', () => {
  it('höchstens 10 Geräte — das älteste fällt bei einem neuen heraus', async () => {
    const werte: string[] = [];
    for (let i = 0; i < 11; i++) werte.push(await merken());
    const g = await geraeteVon('person-a');
    expect(g).toHaveLength(10);
    expect(g.map(x => x.id)).not.toContain(werte[0].split('.')[0]);
    expect((await login({ cookie: keks(werte[0]) })).body).toEqual({ ok: false, zweiterFaktor: true });
    expect((await login({ cookie: keks(werte[10]) })).body.ok).toBe(true);
  });

  it('derselbe Browser merkt neu → ersetzt seinen alten Eintrag (kein Doppel); ein geteiltes Gerät trägt zwei Konten', async () => {
    const a1 = await merken('person-a');
    const a2 = await merken('person-a', keks(a1));
    expect(await geraeteVon('person-a')).toHaveLength(1);
    expect(a2.split('~')).toHaveLength(1);
    const beide = await merken('person-b', keks(a2));
    expect(beide.split('~')).toHaveLength(2);
    expect((await login({ cookie: keks(beide) })).body.ok).toBe(true);
    expect((await login({ email: 'b@example.invalid', cookie: keks(beide) })).body.ok).toBe(true);
  });
});

describe('Nie Token oder Hash nach draußen', () => {
  it('Antworten, Protokolle und alle Dateien: das Token nirgends, der Hash nur im Kontenbestand', async () => {
    const r = await login({ code: await code('person-a'), merken: true });
    const token = r.geraet!.split('.')[1];
    const hash = (await geraeteVon('person-a'))[0].hash;
    expect(r.text).not.toContain(token);
    expect(r.text).not.toContain(hash);
    const zweit = await login({ cookie: keks(r.geraet!) });
    for (const t of [zweit.text]) { expect(t).not.toContain(token); expect(t).not.toContain(hash); }
    const ich = await (await ichRoute.GET(new Request('http://test/api/konto/ich', { headers: { 'x-make-user': 'person-a' } }))).text();
    const liste = await (await geraeteRoute.GET(new Request('http://test/api/konto/geraete', { headers: { 'x-make-user': 'person-a', cookie: keks(r.geraet!) } }))).text();
    for (const t of [ich, liste]) { expect(t).not.toContain(token); expect(t).not.toContain(hash); }
    expect(JSON.parse(liste).geraete).toEqual([expect.objectContaining({ beschreibung: 'Safari · Mac', dieses: true })]);
    expect(JSON.parse(ich).ich.geraete).toEqual([expect.objectContaining({ beschreibung: 'Safari · Mac' })]);
    expect(JSON.stringify(JSON.parse(ich).ich.geraete)).not.toMatch(/hash|stand/);
    for (const d of alleDateien()) {
      expect(d.text.includes(token), d.pfad).toBe(false);
      if (!/(^|\/)konten[^/]*\.json$/.test(d.pfad)) expect(d.text.includes(hash), d.pfad).toBe(false);
    }
  });

  it('Konto-Export (oeffentlich) ohne Hash; Instanz-Export lässt den zweiten Faktor samt Geräten weg', async () => {
    await merken();
    const k = (await K.ladeKonten()).konten.find(x => x.speicher === 'person-a')!;
    const o = K.oeffentlich(k);
    expect(o.geraete).toHaveLength(1);
    expect(JSON.stringify(o)).not.toContain(k.zweiterFaktor!.geraete![0].hash);
    const ex = exportMod.kontenOhneGeheimnisse(await K.ladeKonten()) as { konten: Record<string, unknown>[] };
    expect(JSON.stringify(ex)).not.toContain(k.zweiterFaktor!.geraete![0].hash);
    expect(ex.konten[0].zweiterFaktor).toBeUndefined();
  });
});

describe('Zugang zur Verwaltung', () => {
  it('Dienstweg und fehlende Sitzung → 403; JSON begrenzt; unbekannte Aktion 400', async () => {
    const dienst = { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'person-a' };
    expect((await geraeteRoute.GET(new Request('http://test/api/konto/geraete', { headers: dienst }))).status).toBe(403);
    expect((await geraeteRoute.POST(new Request('http://test/api/konto/geraete', { method: 'POST', headers: dienst, body: JSON.stringify({ aktion: 'alle' }) }))).status).toBe(403);
    expect((await geraeteRoute.GET(new Request('http://test/api/konto/geraete'))).status).toBe(403);
    const sitz = { 'content-type': 'application/json', 'x-make-user': 'person-a' };
    expect((await geraeteRoute.POST(new Request('http://test/api/konto/geraete', { method: 'POST', headers: sitz, body: JSON.stringify({ aktion: 'loeschen' }) }))).status).toBe(400);
    expect((await geraeteRoute.POST(new Request('http://test/api/konto/geraete', { method: 'POST', headers: sitz, body: JSON.stringify({ aktion: 'alle', x: 'y'.repeat(10_000) }) }))).status).toBe(413);
  });

  it('nur die eigenen Geräte: B sieht A’s Geräte nicht und kann sie nicht vergessen', async () => {
    const wert = await merken('person-a');
    const [id] = wert.split('.');
    const b = { 'content-type': 'application/json', 'x-make-user': 'person-b' };
    expect((await (await geraeteRoute.GET(new Request('http://test/api/konto/geraete', { headers: b }))).json()).geraete).toEqual([]);
    expect((await geraeteRoute.POST(new Request('http://test/api/konto/geraete', { method: 'POST', headers: b, body: JSON.stringify({ aktion: 'vergessen', id }) }))).status).toBe(404);
    expect(await geraeteVon('person-a')).toHaveLength(1);
  });

  it('das Geräte-Cookie ist keine Sitzung (Middleware)', async () => {
    const wert = await merken();
    const api = await middleware(new NextRequest('http://localhost:3001/api/state/tasks', { headers: { cookie: keks(wert) } } as never));
    expect(api.status).toBe(401);
    const seite = await middleware(new NextRequest('http://localhost:3001/os', { headers: { cookie: keks(wert) } } as never));
    expect(seite.headers.get('x-middleware-next')).toBeNull();
    expect(seite.headers.get('location') ?? '').toContain('/anmelden');
  });
});

describe('Bremsen greifen weiter', () => {
  it('Paar-/IP-Bremse: nach sechs falschen Passwörtern hilft auch ein gemerktes Gerät nicht', async () => {
    const wert = await merken();
    for (let i = 0; i < 6; i++) expect((await login({ passwort: 'falsch-falsch-falsch', cookie: keks(wert) })).status).toBe(401);
    expect((await login({ cookie: keks(wert) })).status).toBe(429);
  });
  it('2FA-Bremse: nach sechs falschen Codes auch über das gemerkte Gerät 429', async () => {
    const wert = await merken();
    for (let i = 0; i < 6; i++) expect((await login({ code: '000000' })).status).toBe(401);
    expect((await login({ cookie: keks(wert) })).status).toBe(429);
  });
  it('ein falsches Token zählt nicht als Fehlversuch und sperrt nichts', async () => {
    await merken();
    for (let i = 0; i < 10; i++) expect((await login({ cookie: keks('g-0000000000000000.' + 'C'.repeat(43)) })).body).toEqual({ ok: false, zweiterFaktor: true });
    expect((await login({ code: await code('person-a') })).status).toBe(200);
  });
});

describe('Rein: Beschreibung, Cookie, Liste', () => {
  it('Gerätebeschreibung grob aus dem User-Agent — nie die IP', () => {
    expect(G.geraetBeschreibung(UA_MAC)).toBe('Safari · Mac');
    expect(G.geraetBeschreibung('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iPhone');
    expect(G.geraetBeschreibung('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36')).toBe('Chrome · Android');
    expect(G.geraetBeschreibung('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox · Windows');
    expect(G.geraetBeschreibung('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0')).toBe('Edge · Windows');
    expect(G.geraetBeschreibung(null)).toBe('Browser · unbekanntes System');
  });
  it('Cookie lesen: nur gültige Form, höchstens fünf, ohne Doppelte', () => {
    const e = (n: number) => `g-${n.toString(16).padStart(16, '0')}.${'A'.repeat(43)}`;
    expect(G.cookieEintraegeLesen([e(1), 'x.y', e(1), e(2)].join('~')).map(x => x.id)).toEqual(['g-0000000000000001', 'g-0000000000000002']);
    expect(G.cookieEintraegeLesen([1, 2, 3, 4, 5, 6, 7].map(e).join('~'))).toHaveLength(5);
    expect(G.cookieEintraegeLesen('x'.repeat(2000))).toEqual([]);
  });
  it('geraetDazu: Abgelaufenes und fremder Stand fallen heraus, höchstens 10', () => {
    const jetzt = Date.parse('2026-10-16T12:00:00.000Z');
    const g = (i: number, stand = 'aaaaaaaaaaaa', bisTage = 30): import('@/lib/zugang/geraete').GemerktesGeraet => ({ id: `g-${i.toString(16).padStart(16, '0')}`, hash: 'f'.repeat(64), stand, angelegt: new Date(jetzt - (100 - i) * 1000).toISOString(), zuletzt: new Date(jetzt).toISOString(), bis: new Date(jetzt + bisTage * 864e5).toISOString(), beschreibung: 'Safari · Mac' });
    const liste = [...Array.from({ length: 10 }, (_, i) => g(i + 1)), g(20, 'bbbbbbbbbbbb'), g(21, 'aaaaaaaaaaaa', -1)];
    const neu = G.geraetDazu(liste, g(50), { stand: 'aaaaaaaaaaaa', jetzt });
    expect(neu).toHaveLength(10);
    expect(neu.map(x => x.id)).not.toContain(g(1).id);
    expect(neu.map(x => x.id)).not.toContain(g(20).id);
    expect(neu.map(x => x.id)).not.toContain(g(21).id);
    expect(neu.at(-1)!.id).toBe(g(50).id);
  });
});

describe('Instanz: additiv', () => {
  it('Konten ohne Feld funktionieren wie heute (mit und ohne zweiten Faktor)', async () => {
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'person-b' ? { ...k, zweiterFaktor: undefined } : k) }));
    const b = await login({ email: 'b@example.invalid' });
    expect(b.body.ok).toBe(true);
    expect(b.geraet).toBeNull();
    expect((await login()).body).toEqual({ ok: false, zweiterFaktor: true });
    expect(K.oeffentlich((await K.ladeKonten()).konten[0]).geraete).toBeUndefined();
  });
  it('Update-Probe: ein gemerktes Gerät ist ein neues Feld, kein Verlust (lib/betrieb/update-probe.ts)', async () => {
    const vorher = await db.loadJson('konten');
    await merken();
    await login({ cookie: keks((await merken())) });
    const nachher = await db.loadJson('konten');
    expect(JSON.stringify(nachher)).toContain('"geraete"');
    expect(probe.vergleicheBestand('konten', vorher, nachher).abweichungen).toEqual([]);
  });
  it('Änderungsprotokoll der Konten nennt nur den Feldnamen „geraete“', () => {
    const basis = { id: 'k-x', speicher: 'x', email: 'x@example.invalid', name: 'X', rolle: 'mitglied' as const, hash: '00', salz: '00', angelegt: '2026-01-01', teilt: { gesundheit: [] }, zweiterFaktor: { geheimnis: 'A', seit: 's', wiederherstellung: [] } };
    const alt = { konten: [basis], einladungen: [] };
    const neu = { konten: [{ ...basis, zweiterFaktor: { ...basis.zweiterFaktor, geraete: [{ id: 'g-0000000000000001', hash: 'f'.repeat(64), stand: 'aaaaaaaaaaaa', angelegt: 'a', zuletzt: 'a', bis: '2099-01-01T00:00:00.000Z', beschreibung: 'Safari · Mac' }] } }], einladungen: [] };
    expect(K.kontoAenderungen(alt, neu)).toEqual([{ op: 'geaendert', id: 'k-x', felder: ['geraete'] }]);
    expect(K.kontoAenderungen(neu, neu)).toEqual([]);
  });
});
