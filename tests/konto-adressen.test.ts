// ─── Mehrere Anmelde-Adressen je Konto (03.10.) ─────────────────────────────
// Hauptadresse + weitere: alle führen ins selbe Konto (Passwort, zweiter Faktor, Bremse je KONTO). Eine Adresse kommt in der
// Instanz nur einmal vor (Konten, offene Einladungen). Änderungen nur mit Passwort, nur für sich selbst, protokolliert + Glocke.
// Eigener Datenordner, erfundene Konten und Adressen (@example.invalid).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-konto-adressen-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-konto-adressen';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.TRUST_PROXY;

const KEY = process.env.MAKE_OS_KEY!;
const PW = 'TESTPASSWORT-nur-fuer-den-test';
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const post = (pfad: string, kopf: Record<string, string>, body: unknown) => new Request(`http://test${pfad}`, { method: 'POST', headers: kopf, body: JSON.stringify(body) });
const ohne = { 'content-type': 'application/json' };

let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let drossel: typeof import('@/lib/zugang/drossel');
let anmelden: typeof import('@/app/api/konto/anmelden/route');
let adressen: typeof import('@/app/api/konto/adressen/route');
let einladen: typeof import('@/app/api/konto/einladen/route');
let beitreten: typeof import('@/app/api/konto/beitreten/route');
let ich: typeof import('@/app/api/konto/ich/route');
let totp: typeof import('@/lib/zugang/totp');

const konto = async (speicher: string, email: string, extra: Record<string, unknown> = {}) => ({
  id: `k-${speicher}`, speicher, email, name: speicher, rolle: speicher === 'kevin' ? 'inhaber' : 'mitglied', ...(await K.passwortHashen(PW)),
  angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus', ...extra,
});

async function grundzustand() {
  await db.saveJson('konten', {
    konten: [
      await konto('kevin', 'kevin@example.invalid'),
      await konto('malin', 'malin@example.invalid'),
      // altes Konto ohne das neue Feld, ohne Haushalt
      await konto('alt', 'alt@example.invalid', { haushalt: undefined }),
    ],
    einladungen: [],
  });
  await db.saveJson('anmeldungen', { eintraege: [] });
  await db.saveJson('meldungen--kevin', { eintraege: [], einstellungen: { telegram: false } });
  drossel._zuruecksetzen();
}
const stand = async () => (await K.ladeKonten());
const kevin = async () => (await stand()).konten.find(k => k.speicher === 'kevin')!;
const adr = (aktion: string, email: string, passwort: string | null = PW, person = 'kevin') =>
  adressen.POST(post('/api/konto/adressen', sitzung(person), { aktion, email, ...(passwort !== null ? { passwort } : {}) }));
const login = (email: string, passwort = PW, code?: string) =>
  anmelden.POST(post('/api/konto/anmelden', ohne, { email, passwort, ...(code ? { code } : {}) }));

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  drossel = await import('@/lib/zugang/drossel');
  anmelden = await import('@/app/api/konto/anmelden/route');
  adressen = await import('@/app/api/konto/adressen/route');
  einladen = await import('@/app/api/konto/einladen/route');
  beitreten = await import('@/app/api/konto/beitreten/route');
  ich = await import('@/app/api/konto/ich/route');
  totp = await import('@/lib/zugang/totp');
});
beforeEach(grundzustand);
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

describe('Adress-Regeln (rein)', () => {
  it('alleAdressen: Hauptadresse zuerst, klein, ohne Doppelte; ohne Feld nur die Hauptadresse', () => {
    expect(K.alleAdressen({ email: 'A@example.invalid' })).toEqual(['a@example.invalid']);
    expect(K.alleAdressen({ email: 'a@example.invalid', weitereEmails: ['B@example.invalid', 'a@example.invalid', ' c@example.invalid '] })).toEqual(['a@example.invalid', 'b@example.invalid', 'c@example.invalid']);
  });
  it('kontoMitAdresse findet Haupt- ODER weitere Adresse, Groß-/Kleinschreibung egal, Unsinn nie', () => {
    const k = [{ email: 'a@example.invalid' }, { email: 'b@example.invalid', weitereEmails: ['b2@example.invalid'] }];
    expect(K.kontoMitAdresse(k, ' B2@Example.Invalid ')).toBe(k[1]);
    expect(K.kontoMitAdresse(k, 'a@example.invalid')).toBe(k[0]);
    expect(K.kontoMitAdresse(k, 'x@example.invalid')).toBeUndefined();
    expect(K.kontoMitAdresse(k, 'kein-at')).toBeUndefined();
    expect(K.kontoMitAdresse(k, undefined)).toBeUndefined();
  });
  it('adresseMaskiert zeigt nur den ersten Buchstaben', () => {
    expect(K.adresseMaskiert('kevin@example.invalid')).toBe('k***@example.invalid');
    expect(K.adresseMaskiert('kaputt')).toBe('***');
  });
  it('adresseVergeben zählt Konten (beide Arten) und offene, nicht abgelaufene Einladungen; „ausser“ nimmt das eigene Konto aus', () => {
    const s = { konten: [{ speicher: 'a', email: 'a@example.invalid', weitereEmails: ['a2@example.invalid'] }], einladungen: [{ code: 'X', von: 'a', bis: '2099-01-01T00:00:00Z', email: 'e@example.invalid' }, { code: 'Y', von: 'a', bis: '2000-01-01T00:00:00Z', email: 'alt@example.invalid' }] } as never;
    expect(K.adresseVergeben(s, 'A2@example.invalid')).toBe(true);
    expect(K.adresseVergeben(s, 'e@example.invalid')).toBe(true);
    expect(K.adresseVergeben(s, 'alt@example.invalid')).toBe(false);
    expect(K.adresseVergeben(s, 'a2@example.invalid', 'a')).toBe(false);
  });
});

describe('Anmelden mit Haupt- und weiterer Adresse', () => {
  it('beide führen ins selbe Konto — auch in anderer Schreibweise; Antwort zeigt die Hauptadresse', async () => {
    expect((await adr('hinzu', 'kevin@alt.example.invalid')).status).toBe(200);
    for (const e of ['kevin@example.invalid', 'KEVIN@Example.Invalid', 'kevin@alt.example.invalid', ' Kevin@Alt.Example.Invalid ']) {
      const r = await login(e);
      expect(r.status).toBe(200);
      const d = await r.json();
      expect(d.konto.speicher).toBe('kevin');
      expect(d.konto.email).toBe('kevin@example.invalid');
      expect(r.headers.get('set-cookie')).toContain('make-os-sitzung=');
    }
  });
  it('falsches Passwort oder unbekannte Adresse: dieselbe 401-Antwort, kein Hinweis auf die Adresse', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    const a = await login('kevin@alt.example.invalid', 'falsch');
    const b = await login('niemand@example.invalid', 'falsch');
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(await a.json()).toEqual(await b.json());
  });
  it('zweiter Faktor gilt auch über die weitere Adresse: erst Passwort, dann Code', async () => {
    const geheimnis = totp.neuesGeheimnis();
    await K.aendereKonten(s => ({ ...s, konten: s.konten.map(k => k.speicher === 'kevin' ? { ...k, weitereEmails: ['kevin@alt.example.invalid'], zweiterFaktor: { geheimnis, seit: '2026-01-01', wiederherstellung: [] } } : k) }));
    const erst = await login('kevin@alt.example.invalid');
    expect(await erst.json()).toMatchObject({ ok: false, zweiterFaktor: true });
    expect(erst.headers.get('set-cookie')).toBeNull();
    const schlecht = await login('kevin@alt.example.invalid', PW, '000000');
    expect(schlecht.status).toBe(401);
    const code = totp.codeFuer(geheimnis, totp.stufeVon() + 0);
    const gut = await login('kevin@alt.example.invalid', PW, code);
    expect(gut.status).toBe(200);
    expect((await gut.json()).konto.speicher).toBe('kevin');
  });
  it('alte Konten ohne das Feld melden sich wie bisher an und bleiben ohne Feld', async () => {
    expect((await login('alt@example.invalid')).status).toBe(200);
    const alt = (await stand()).konten.find(k => k.speicher === 'alt')!;
    expect('weitereEmails' in alt).toBe(false);
    const info = await (await ich.GET(new Request('http://test/api/konto/ich', { headers: sitzung('alt') }))).json();
    expect(info.ich.weitereEmails).toBeUndefined();
  });
});

describe('Bremse je KONTO', () => {
  it('Haupt- und weitere Adresse teilen EIN Versuchsbudget (Paar IP + Konto), unbekannte Adressen zählen je Text', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    drossel._zuruecksetzen();
    const adressenListe = ['kevin@example.invalid', 'kevin@alt.example.invalid'];
    for (let i = 0; i < 6; i++) expect((await login(adressenListe[i % 2], 'falsch')).status).toBe(401);
    // Die IP-Bremse zurücksetzen: allein das Konto-Paar hält die Sperre — mit JEDER seiner Adressen.
    drossel.erfolg('ip:direkt');
    expect((await login('kevin@alt.example.invalid', PW)).status).toBe(429);
    expect((await login('kevin@example.invalid', PW)).status).toBe(429);
    expect(drossel.pruefe('paar:direkt|konto:kevin').erlaubt).toBe(false);
    // Ein anderes Konto ist davon nicht betroffen (die IP-Bremse ist ja zurückgesetzt).
    expect((await login('malin@example.invalid', PW)).status).toBe(200);
    // Unbekannte Adresse: eigener Schlüssel je Text
    drossel._zuruecksetzen();
    for (let i = 0; i < 2; i++) await login('niemand@example.invalid', 'falsch');
    expect(drossel.pruefe('paar:direkt|niemand@example.invalid').erlaubt).toBe(true);
  });
});

describe('Adressen ändern: nur mit Passwort, nur selbst', () => {
  it('hinzufügen: ohne/mit falschem Passwort 403, mit Passwort 200 und im Konto; Liste über /api/konto/ich', async () => {
    expect((await adr('hinzu', 'kevin@alt.example.invalid', null)).status).toBe(403);
    expect((await adr('hinzu', 'kevin@alt.example.invalid', 'falsch')).status).toBe(403);
    expect((await kevin()).weitereEmails).toBeUndefined();
    const r = await adr('hinzu', ' Kevin@Alt.Example.Invalid ');
    expect(r.status).toBe(200);
    expect((await kevin()).weitereEmails).toEqual(['kevin@alt.example.invalid']);
    const info = await (await ich.GET(new Request('http://test/api/konto/ich', { headers: sitzung('kevin') }))).json();
    expect(info.ich.weitereEmails).toEqual(['kevin@alt.example.invalid']);
    expect(info.ich.hash).toBeUndefined();
  });
  it('ungültige Adresse 400, Dienstweg und fehlende Sitzung 403, falsche Aktion 400, nur das eigene Konto', async () => {
    expect((await adr('hinzu', 'kein-at')).status).toBe(400);
    expect((await adressen.POST(post('/api/konto/adressen', { ...ohne, 'x-make-key': KEY, 'x-make-person': 'kevin' }, { aktion: 'hinzu', email: 'x@example.invalid', passwort: PW }))).status).toBe(403);
    expect((await adressen.POST(post('/api/konto/adressen', ohne, { aktion: 'hinzu', email: 'x@example.invalid', passwort: PW }))).status).toBe(403);
    expect((await adressen.POST(post('/api/konto/adressen', sitzung('kevin'), { aktion: 'loeschen', email: 'x@example.invalid', passwort: PW }))).status).toBe(400);
    // Malin ändert nur Malins Konto — Kevins Passwort ist für sie nutzlos, ihr eigenes wirkt nur auf ihr Konto.
    expect((await adr('hinzu', 'm2@example.invalid', PW, 'malin')).status).toBe(200);
    expect((await kevin()).weitereEmails).toBeUndefined();
    expect((await stand()).konten.find(k => k.speicher === 'malin')!.weitereEmails).toEqual(['m2@example.invalid']);
  });
  it('Passwortraten ist gebremst (wie Passwort ändern)', async () => {
    for (let i = 0; i < 6; i++) await adr('hinzu', 'x@example.invalid', 'falsch');
    expect((await adr('hinzu', 'x@example.invalid', PW)).status).toBe(429);
  });
  it('höchstens drei weitere Adressen', async () => {
    for (const n of [1, 2, 3]) expect((await adr('hinzu', `k${n}@example.invalid`)).status).toBe(200);
    const r = await adr('hinzu', 'k4@example.invalid');
    expect(r.status).toBe(409);
    expect((await kevin()).weitereEmails).toHaveLength(3);
  });
  it('Hauptadresse tauschen: alte wird weitere, beide melden weiter an; nur eine vorhandene weitere Adresse', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    expect((await adr('haupt', 'kevin@alt.example.invalid', 'falsch')).status).toBe(403);
    expect((await adr('haupt', 'kevin@example.invalid')).status).toBe(409);
    expect((await adr('haupt', 'fremd@example.invalid')).status).toBe(404);
    expect((await adr('haupt', 'kevin@alt.example.invalid')).status).toBe(200);
    const k = await kevin();
    expect(k.email).toBe('kevin@alt.example.invalid');
    expect(k.weitereEmails).toEqual(['kevin@example.invalid']);
    for (const e of ['kevin@example.invalid', 'kevin@alt.example.invalid']) expect((await login(e)).status).toBe(200);
  });
  it('entfernen: die Hauptadresse nie (also nie die letzte), unbekannte 404, weitere mit Passwort; danach geht sie nicht mehr', async () => {
    expect((await adr('weg', 'kevin@example.invalid')).status).toBe(409);
    await adr('hinzu', 'kevin@alt.example.invalid');
    expect((await adr('weg', 'kevin@alt.example.invalid', 'falsch')).status).toBe(403);
    expect((await adr('weg', 'fremd@example.invalid')).status).toBe(404);
    expect((await adr('weg', 'kevin@alt.example.invalid')).status).toBe(200);
    const k = await kevin();
    expect(k.email).toBe('kevin@example.invalid');
    expect('weitereEmails' in k).toBe(false);
    expect((await login('kevin@alt.example.invalid')).status).toBe(401);
    expect((await login('kevin@example.invalid')).status).toBe(200);
  });
});

describe('Eindeutigkeit in der ganzen Instanz', () => {
  it('eine Adresse eines anderen Kontos (Haupt oder weitere) lässt sich nicht hinzufügen; die eigene auch nicht doppelt', async () => {
    await adr('hinzu', 'm2@example.invalid', PW, 'malin');
    expect((await adr('hinzu', 'malin@example.invalid')).status).toBe(409);
    expect((await adr('hinzu', 'M2@example.invalid')).status).toBe(409);
    expect((await adr('hinzu', 'kevin@example.invalid')).status).toBe(409);
    expect((await kevin()).weitereEmails).toBeUndefined();
  });
  it('eine für eine offene Einladung reservierte Adresse ist vergeben', async () => {
    const e = await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { fuer: 'Anna', email: 'anna@example.invalid' }));
    expect(e.status).toBe(200);
    expect((await adr('hinzu', 'Anna@example.invalid')).status).toBe(409);
  });
  it('Einladung an eine schon als Alias vergebene (oder Haupt-)Adresse wird abgelehnt, ebenso an eine bereits eingeladene', async () => {
    await adr('hinzu', 'm2@example.invalid', PW, 'malin');
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { email: 'm2@example.invalid' }))).status).toBe(409);
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { email: 'KEVIN@example.invalid' }))).status).toBe(409);
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { email: 'neu@example.invalid' }))).status).toBe(200);
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { email: 'neu@example.invalid' }))).status).toBe(409);
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { email: 'kein-at' }))).status).toBe(400);
    // Ohne Adresse bleibt es wie bisher
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { fuer: 'Bob' }))).status).toBe(200);
    // Mitglieder dürfen nicht einladen
    expect((await einladen.POST(post('/api/konto/einladen', sitzung('malin'), { email: 'x@example.invalid' }))).status).toBe(403);
  });
  it('Beitreten mit einer Alias-Adresse eines Kontos: 409; mit der reservierten Adresse: ok; mit einer anderen zur gebundenen Einladung: 400', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    const a = await (await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), { fuer: 'Anna', email: 'anna@example.invalid' }))).json();
    const b = (email: string) => beitreten.POST(post('/api/konto/beitreten', ohne, { code: a.code, email, name: 'Anna Test', passwort: PW }));
    expect((await b('kevin@alt.example.invalid')).status).toBe(400); // gebunden an anna@…
    expect((await b('andere@example.invalid')).status).toBe(400);
    const frei = await (await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), {}))).json();
    expect((await beitreten.POST(post('/api/konto/beitreten', ohne, { code: frei.code, email: 'kevin@alt.example.invalid', name: 'Eve Test', passwort: PW }))).status).toBe(409);
    const ok = await b('Anna@Example.Invalid');
    expect(ok.status).toBe(200);
    expect((await ok.json()).konto.email).toBe('anna@example.invalid');
    // freie Einladung ohne Adresse: jede freie Adresse, aber nie eine vergebene
    const c = await (await einladen.POST(post('/api/konto/einladen', sitzung('kevin'), {}))).json();
    const b2 = (email: string) => beitreten.POST(post('/api/konto/beitreten', ohne, { code: c.code, email, name: 'Bob Test', passwort: PW }));
    expect((await b2('anna@example.invalid')).status).toBe(409);
    expect((await b2('bob@example.invalid')).status).toBe(200);
  });
});

describe('Protokoll und Glocke', () => {
  it('jede Änderung steht im Sicherheitsprotokoll (Adresse maskiert) und als Meldung im Konto selbst', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    await adr('haupt', 'kevin@alt.example.invalid');
    await adr('weg', 'kevin@example.invalid');
    const log = (await db.loadJson<{ eintraege: { art: string; ok: boolean; detail?: string; speicher: string }[] }>('anmeldungen'))!.eintraege;
    expect(log.map(e => e.art)).toEqual(['adresse-hinzu', 'adresse-haupt', 'adresse-weg']);
    expect(log.map(e => e.detail)).toEqual(['k***@alt.example.invalid', 'k***@alt.example.invalid', 'k***@example.invalid']);
    expect(log.every(e => e.ok && e.speicher === 'kevin')).toBe(true);
    expect(JSON.stringify(log)).not.toContain('kevin@');
    const m = (await db.loadJson<{ eintraege: { art: string; titel: string; link: string }[] }>('meldungen--kevin'))!.eintraege;
    expect(m).toHaveLength(3);
    expect(m.every(x => x.art === 'sicherheit' && x.link === '/os/konto')).toBe(true);
    expect(m.map(x => x.titel).join('|')).toContain('Anmelde-Adresse hinzugefügt: k***@alt.example.invalid');
    expect(JSON.stringify(m)).not.toContain('kevin@');
  });
  it('ein falsches Passwort wird als fehlgeschlagen protokolliert, ohne Änderung und ohne Meldung', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid', 'falsch');
    const log = (await db.loadJson<{ eintraege: { art: string; ok: boolean }[] }>('anmeldungen'))!.eintraege;
    expect(log).toMatchObject([{ art: 'adresse-hinzu', ok: false }]);
    expect((await db.loadJson<{ eintraege: unknown[] }>('meldungen--kevin'))!.eintraege).toHaveLength(0);
  });
});

describe('Kompatibilität', () => {
  it('Ohne weitere Adressen bleibt die Konten-Datei im alten Zuschnitt (Feld fehlt ganz) — auch nach Hinzufügen und Entfernen', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    await adr('weg', 'kevin@alt.example.invalid');
    const dateien = readdirSync(ordner).filter(n => n.startsWith('konten'));
    const roh = readFileSync(path.join(ordner, dateien[0]), 'utf8');
    expect(roh).not.toContain('weitereEmails');
  });
  it('oeffentlich() reicht die weiteren Adressen durch, nie Hash/Salz', async () => {
    await adr('hinzu', 'kevin@alt.example.invalid');
    const o = K.oeffentlich(await kevin()) as Record<string, unknown>;
    expect(o.weitereEmails).toEqual(['kevin@alt.example.invalid']);
    expect(o.hash).toBeUndefined(); expect(o.salz).toBeUndefined();
  });
});
