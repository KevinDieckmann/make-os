// ─── Newsletter-Anmeldung über die Website (30.10.): öffentliche Seite, Double-Opt-in, CRM, Einstellungen, Middleware, Caddy ─────────
// Eigener Datenordner, Datenschlüssel und Pepper gesetzt, Konten mit Test-Haushalt, Verantwortlicher der Einrichtung gemockt, Absender-Prüfung
// und Sendeweg (Inbox) als Fake — es geht nichts hinaus. Alle Namen und Adressen erfunden (@example.invalid). Prüft: kommt AUS (404),
// Honigtopf/Mindestzeit mit demselben Text, dieselbe Antwort für jede Adresse, Token nur als Hash, höchstens 3 Mails je Tag, Bestätigung →
// Einwilligung mit vollem Nachweis und grüne Ampel, benutzt/abgelaufen neutral, Art. 18 und Werbesperre schreiben nichts, Drossel,
// Einstellungen nur Inhaber, Middleware offen nur für /newsletter und POST /api/newsletter, Caddy-Pfade, Art. 17, Löschfrist, Verzeichnis.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { NextRequest } from 'next/server';
import type { Kontakt } from '@/lib/make-one/crm';
import type { AnmeldungenBestand } from '@/lib/newsletter/regeln';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-newsletter-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-newsletter';
process.env.SESSION_SECRET = 'pruef-sitzung-newsletter-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-newsletter-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-newsletter-nur-im-test-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

const ds = vi.hoisted(() => ({ wert: { verantwortlich: null as string | null, seite: null as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));
// Absender-Postfach: echte Prüfung steht in tests/angebot-formular*.test.ts — hier nur „gibt es / gibt es nicht“.
const fake = vi.hoisted(() => ({ absenderOk: true, senden: { status: 200, body: { ok: true, von: 'versand@example.invalid' } as Record<string, unknown> }, gesendet: [] as { person: string; an: string; betreff?: string; text: string; uwg: unknown }[] }));
vi.mock('@/lib/crm/angebot-versand', () => ({
  absenderPruefen: async (a?: { postfach: string }) => (!a ? { ok: false, grund: 'Absender-Postfach fehlt.' } : fake.absenderOk && a.postfach === 'pf-probe' ? { ok: true, adresse: 'versand@example.invalid' } : { ok: false, grund: 'Dieses Postfach gibt es nicht.' }),
}));
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (person: string, b: { neu?: { betreff?: string }; an?: { email: string }[]; text?: string; uwgBestaetigt?: unknown }) => {
    fake.gesendet.push({ person, an: b.an?.[0]?.email ?? '', betreff: b.neu?.betreff, text: String(b.text ?? ''), uwg: b.uwgBestaetigt });
    return fake.senden;
  },
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let S: typeof import('@/lib/newsletter/server');
let SP: typeof import('@/lib/newsletter/speicher');
let R: typeof import('@/lib/newsletter/regeln');
let oeffentlich: { POST: (r: Request) => Promise<Response> };
let intern: { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
const HAUS = 'test-haus';
const D = 'example.invalid';
const sitzung = (wer = 'kevin') => ({ 'content-type': 'application/json', 'x-make-user': wer });
const post = async (body: Record<string, unknown>): Promise<Antwort> => { const r = await oeffentlich.POST(new Request('http://test/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const innen = async (body: Record<string, unknown>, wer = 'kevin', kopf: Record<string, string> = {}): Promise<Antwort> => { const r = await intern.POST(new Request('http://test/api/newsletter/intern', { method: 'POST', headers: { ...sitzung(wer), ...kopf }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const innenLesen = async (wer = 'kevin'): Promise<Antwort> => { const r = await intern.GET(new Request('http://test/api/newsletter/intern', { headers: sitzung(wer) })); return { status: r.status, d: await r.json() }; };
const kontakte = async () => (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
const bestand = async () => (await db.loadJson<AnmeldungenBestand>('newsletter-anmeldungen')) ?? { anmeldungen: [] };
const k = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Vera', nachname: `Muster ${id.slice(2)}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);

const T0 = new Date('2026-11-10T08:00:00Z');
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };
/** Eine Anmeldung, wie die Seite sie schickt — Stempel 10 s alt. */
const anmeldung = async (email: string, x: Record<string, unknown> = {}) => post({ aktion: 'anmelden', email, vorname: '', einwilligung: true, fassung: (await S.newsletterBereit())?.fassung, stempel: SP.newsletterStempel(uhr - 10_000), webseite: '', ...x });
/** Das Token aus der zuletzt an `email` gesendeten Mail. */
const tokenAus = (email: string) => { const m = [...fake.gesendet].reverse().find(x => x.an === email); return /#t=([A-Za-z0-9_-]{43})/.exec(m?.text ?? '')?.[1] ?? ''; };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    { id: 'k2', speicher: 'malin', email: `m@${D}`, name: 'Proba Partnerin', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS },
    // 02.11. (Prüfung D): ein volles Mitglied steuert wie ein Inhaber — die Sperre gilt einem Konto „nur Business“.
    { id: 'k3', speicher: 'nurbusiness', email: `nb@${D}`, name: 'Proba Team', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: HAUS, finanzRecht: 'business' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    k('c-bekannt', { email: `bekannt@${D}` }),
    k('c-sperre', { email: `sperre@${D}`, werbesperre: { seit: '2026-09-01', grund: 'Widerspruch' } }),
    k('c-eng', { email: `eng@${D}`, eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } }),
    k('c-spaeter', { email: `spaeter@${D}` }),
  ] });
  S = await import('@/lib/newsletter/server');
  SP = await import('@/lib/newsletter/speicher');
  R = await import('@/lib/newsletter/regeln');
  oeffentlich = await import('@/app/api/newsletter/route');
  intern = await import('@/app/api/newsletter/intern/route');
});
afterEach(() => drossel._zuruecksetzen());
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('kommt ausgeschaltet — einschalten nur der Inhaber und nur, wenn alles da ist', () => {
  it('aus: jede Aktion 404, keine Seite', async () => {
    expect((await post({ aktion: 'anmelden', email: `x@${D}` })).status).toBe(404);
    expect((await post({ aktion: 'bestaetigen', token: 'x'.repeat(43) })).status).toBe(404);
    expect(await S.newsletterBereit()).toBeNull();
  });
  it('Einstellungen nur der Inhaber per Sitzung — nie Partner, nie Dienstweg, nie fremd', async () => {
    expect((await innen({ aktion: 'einstellungen', aktiv: true }, 'nurbusiness')).status).toBe(403);
    expect((await innen({ aktion: 'einstellungen', aktiv: true }, 'gast')).status).toBe(403);
    const dienst = await intern.POST(new Request('http://test/api/newsletter/intern', { method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'kevin' }, body: JSON.stringify({ aktion: 'einstellungen', aktiv: true }) }));
    expect(dienst.status).toBe(403);
    expect((await intern.GET(new Request('http://test/api/newsletter/intern'))).status).toBe(403);
    expect((await innenLesen('gast')).status).toBe(403);
  });
  it('einschalten nur mit Absender, Verantwortlichem und Website (sonst 409 mit Grund)', async () => {
    const ohne = await innen({ aktion: 'einstellungen', aktiv: true });
    expect(ohne.status).toBe(409);
    expect(ohne.d.fehler).toMatch(/Absender-Postfach fehlt/);
    expect((await innen({ aktion: 'einstellungen', absender: 'pf-fremd' })).status).toBe(400);
    expect((await innen({ aktion: 'einstellungen', absender: 'pf-probe', website: 'http://example.invalid' })).status).toBe(400);
    expect((await innen({ aktion: 'einstellungen', absender: 'pf-probe', website: `https://www.${D}/`, marke: 'Probe Marke' })).status).toBe(200);
    const ohneVerantwortlich = await innen({ aktion: 'einstellungen', aktiv: true });
    expect(ohneVerantwortlich.status).toBe(409);
    expect(ohneVerantwortlich.d.fehler).toMatch(/Verantwortlicher fehlt/);
    ds.wert = { verantwortlich: `Probe GmbH, datenschutz@${D}`, seite: `${D}/datenschutz` };
    const an = await innen({ aktion: 'einstellungen', aktiv: true });
    expect(an.status).toBe(200);
    const b = await S.newsletterBereit();
    expect(b).toMatchObject({ marke: 'Probe Marke', website: `https://www.${D}`, verantwortlich: `Probe GmbH, datenschutz@${D}`, datenschutzLink: `https://${D}/datenschutz`, fassung: 'newsletter-einwilligung-2' }); // der Name änderte den Wortlaut → Fassung 2
    expect(b!.wortlaut).toContain('Newsletter von Probe Marke');
  });
});

describe('anmelden: Schutz und immer dieselbe Antwort', () => {
  it('Honigtopf, zu schneller, zu alter und gefälschter Stempel: DERSELBE Text', async () => {
    const texte = new Set<string>();
    for (const x of [{ webseite: 'https://spam.example.invalid' }, { stempel: SP.newsletterStempel(uhr) }, { stempel: SP.newsletterStempel(uhr - 3 * 3600_000) }, { stempel: `${uhr - 10_000}.gefaelscht` }]) {
      const r = await anmeldung(`honig@${D}`, x);
      expect(r.status).toBe(400);
      texte.add(r.d.fehler);
    }
    expect(texte.size).toBe(1);
    await S._nachlauf();
    expect(fake.gesendet).toHaveLength(0);
  });
  it('ohne Häkchen, falsche Adresse, Link im Vornamen, alte Fassung, zu groß → abgelehnt, nichts gespeichert', async () => {
    expect((await anmeldung(`a@${D}`, { einwilligung: false })).status).toBe(400);
    expect((await anmeldung('keine-adresse')).status).toBe(400);
    expect((await anmeldung(`a@${D}`, { vorname: 'Besuchen Sie https://spam.example.invalid' })).status).toBe(400);
    expect((await anmeldung(`a@${D}`, { vorname: 'Klick 123' })).status).toBe(400);
    expect((await anmeldung(`a@${D}`, { fassung: 'newsletter-einwilligung-0' })).status).toBe(409);
    expect((await post({ aktion: 'anmelden', email: `a@${D}`, rest: 'x'.repeat(5000) })).status).toBe(413);
    await S._nachlauf();
    expect((await bestand()).anmeldungen).toHaveLength(0);
  });
  it('bekannt, unbekannt, gesperrt, eingeschränkt: dieselbe Antwort — Mail nur an die, die eine bekommen dürfen', async () => {
    const antworten = [];
    for (const email of [`neu@${D}`, `bekannt@${D}`, `sperre@${D}`, `eng@${D}`]) {
      const r = await anmeldung(email, email === `neu@${D}` ? { vorname: 'Nora' } : {});
      antworten.push({ status: r.status, d: r.d });
    }
    for (const a of antworten) expect(a).toEqual(antworten[0]);
    expect(antworten[0]).toEqual({ status: 200, d: { ok: true, text: R.ANMELDUNG_TEXT } });
    await S._nachlauf();
    expect(fake.gesendet.map(m => m.an).sort()).toEqual([`bekannt@${D}`, `neu@${D}`]);
    const b = await bestand();
    expect(b.anmeldungen.find(a => a.email === `sperre@${D}`)).toMatchObject({ gesperrt: 'werbesperre' });
    expect(b.anmeldungen.find(a => a.email === `sperre@${D}`)!.tokenHash).toBeUndefined();
    expect(b.anmeldungen.some(a => a.email === `eng@${D}`)).toBe(false); // Art. 18: nicht einmal eine Zeile
  });
  it('die Mail: fester Text ohne Werbung, Link mit Token nur im Fragment, über das gewählte Postfach', async () => {
    const m = fake.gesendet.find(x => x.an === `neu@${D}`)!;
    expect(m.person).toBe('kevin');
    expect(m.betreff).toBe('Bitte bestätigen Sie Ihre Anmeldung — Probe Marke');
    expect(m.text).toMatch(new RegExp(`https://www\\.example\\.invalid/newsletter#t=[A-Za-z0-9_-]{43}`));
    expect(m.text).toContain('Guten Tag Nora,');
    expect(m.text).toContain('Wenn Sie das nicht waren, ignorieren Sie diese Mail');
    expect(m.text).toContain(`Verantwortlich ist Probe GmbH, datenschutz@${D}`);
    expect(m.text).not.toMatch(/Angebot|Rabatt|kostenlos|gratis/i);
  });
  it('das Token liegt nur als SHA-256 im Bestand — nie im Klartext', async () => {
    const t = tokenAus(`neu@${D}`);
    const a = (await bestand()).anmeldungen.find(x => x.email === `neu@${D}`)!;
    expect(a.tokenHash).toBe(createHash('sha256').update(`make-os-newsletter|${t}`).digest('hex'));
    expect(JSON.stringify(await bestand())).not.toContain(t);
    expect(a.id).toMatch(R.ID_OK);
    expect(a).toMatchObject({ vorname: 'Nora', fassung: 'newsletter-einwilligung-2', mailGesendet: expect.any(String) });
    expect(a.wortlaut).toContain('Newsletter von Probe Marke');
  });
  it('schon mit vollem Double-Opt-in angemeldet: dieselbe Antwort, keine Mail', async () => {
    const vorher = fake.gesendet.length;
    const voll = await db.loadJson<{ kontakte: Kontakt[] }>('kontakte');
    await db.saveJson('kontakte', { kontakte: [...voll!.kontakte, k('c-voll', { email: `voll@${D}`, einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-10-01', nachweis: 'DOI', zeitpunkt: '2026-10-01T08:00:00Z', erfasstVon: 'system', wortlaut: 'Ja, Newsletter.', belegRef: 'newsletter:alt' }] })] });
    expect(await anmeldung(`voll@${D}`)).toEqual({ status: 200, d: { ok: true, text: R.ANMELDUNG_TEXT } });
    await S._nachlauf();
    expect(fake.gesendet.length).toBe(vorher);
  });
  it('höchstens 3 Bestätigungsmails je Adresse und Tag — am nächsten Tag wieder', async () => {
    const zahl = () => fake.gesendet.filter(m => m.an === `oft@${D}`).length;
    for (let i = 0; i < 4; i++) { expect((await anmeldung(`oft@${D}`)).status).toBe(200); await S._nachlauf(); }
    expect(zahl()).toBe(3);
    expect((await bestand()).anmeldungen.filter(a => a.email === `oft@${D}`)).toHaveLength(1); // eine Zeile je Adresse
    weiter(24 * 3600);
    await anmeldung(`oft@${D}`); await S._nachlauf();
    expect(zahl()).toBe(4);
  });
  it('Drossel je Netz: nach acht Anmeldungen in der Viertelstunde 429', async () => {
    let letzte = 0;
    for (let i = 0; i < 10; i++) letzte = (await anmeldung(`drossel${i}@${D}`)).status;
    expect(letzte).toBe(429);
    await S._nachlauf();
  });
});

describe('bestätigen: Einwilligung mit vollem Nachweis, einmalig, neutral', () => {
  it('neue Adresse → Kontakt mit Einwilligung „Newsletter“ (voller Nachweis), Ampel grün, Empfänger mit Double-Opt-in', async () => {
    weiter(120);
    const t = tokenAus(`neu@${D}`);
    const r = await post({ aktion: 'bestaetigen', token: t });
    expect(r).toEqual({ status: 200, d: { ok: true, text: R.BESTAETIGT_TEXT } });
    const a = (await bestand()).anmeldungen.find(x => x.email === `neu@${D}`)!;
    expect(a.bestaetigt).toBe(new Date(uhr).toISOString());
    expect(a.tokenHash).toBeUndefined();
    expect(a.crm).toMatchObject({ status: 'ok', kontaktId: S.kontaktKennungFuer(a.id) });
    const p = (await kontakte()).find(x => x.id === a.crm!.kontaktId)!;
    expect(p).toMatchObject({ email: `neu@${D}`, vorname: 'Nora', herkunft: 'selbst', rechtsgrundlage: 'einwilligung', quelle: 'Newsletter (Website)' });
    const ew = p.einwilligungen!.find(e => e.kanal === 'newsletter')!;
    expect(ew).toMatchObject({ grundlage: 'einwilligung', erteiltAm: '2026-11-11', wortlautVersion: 'newsletter-einwilligung-2', belegRef: `newsletter:${a.id}`, erfasstVon: 'system', zeitpunkt: expect.any(String) });
    expect(ew.wortlaut).toBe(a.wortlaut);
    expect(ew.nachweis).toMatch(/^Double-Opt-in bestätigt am 11\.11\.2026, 09:02 · angemeldet 10\.11\.2026, 09:00 · Bestätigungsmail 10\.11\.2026, 09:00 · über die Website$/);
    const { nachweisLuecken } = await import('@/lib/crm/einwilligung');
    expect(nachweisLuecken(ew)).toEqual([]);
    const { kanalStatus } = await import('@/lib/crm/recht');
    expect(kanalStatus(p, 'newsletter')).toMatchObject({ farbe: 'gruen', grund: 'Double-Opt-in' });
    const { newsletterEmpfaenger } = await import('@/lib/crm/marketing');
    expect(newsletterEmpfaenger(await kontakte()).map(x => x.id)).toContain(p.id);
  });
  it('vorhandene Person: dieselbe Akte bekommt die Einwilligung und einen Vermerk — keine zweite Person', async () => {
    const vorher = (await kontakte()).length;
    const r = await post({ aktion: 'bestaetigen', token: tokenAus(`bekannt@${D}`) });
    expect(r.status).toBe(200);
    const p = (await kontakte()).find(x => x.id === 'c-bekannt')!;
    expect((await kontakte()).length).toBe(vorher);
    const { kanalStatus } = await import('@/lib/crm/recht');
    expect(kanalStatus(p, 'newsletter').farbe).toBe('gruen');
    expect(p.aktivitaeten.at(-1)).toMatchObject({ art: 'system', text: 'Newsletter über die Website angemeldet (Double-Opt-in bestätigt)', von: 'system' });
  });
  it('benutzt, unbekannt, kaputt, abgelaufen: DERSELBE neutrale Fehler', async () => {
    const texte = new Set<string>();
    for (const token of [tokenAus(`neu@${D}`), 'A'.repeat(43), 'kaputt', 42]) {
      const r = await post({ aktion: 'bestaetigen', token });
      expect(r.status).toBe(404);
      texte.add(r.d.fehler);
    }
    await anmeldung(`alt@${D}`); await S._nachlauf();
    const t = tokenAus(`alt@${D}`);
    weiter(8 * 24 * 3600);
    const r = await post({ aktion: 'bestaetigen', token: t });
    expect(r.status).toBe(404);
    texte.add(r.d.fehler);
    expect([...texte]).toEqual([R.LINK_UNGUELTIG]);
    expect((await bestand()).anmeldungen.find(a => a.email === `alt@${D}`)!.bestaetigt).toBeUndefined();
  });
  it('Art. 18 nach der Anmeldung: Bestätigung neutral, an der Akte wird nichts geschrieben', async () => {
    await anmeldung(`spaeter@${D}`); await S._nachlauf();
    const t = tokenAus(`spaeter@${D}`);
    const alle = await kontakte();
    await db.saveJson('kontakte', { kontakte: alle.map(x => (x.id === 'c-spaeter' ? { ...x, eingeschraenkt: { seit: '2026-11-10', grund: 'Art. 18', von: 'kevin' } } : x)) });
    const vorher = JSON.stringify((await kontakte()).find(x => x.id === 'c-spaeter'));
    const r = await post({ aktion: 'bestaetigen', token: t });
    expect(r).toEqual({ status: 200, d: { ok: true, text: R.BESTAETIGT_TEXT } });
    expect(JSON.stringify((await kontakte()).find(x => x.id === 'c-spaeter'))).toBe(vorher);
    expect((await bestand()).anmeldungen.find(a => a.email === `spaeter@${D}`)!.crm).toMatchObject({ status: 'abgelehnt', grund: expect.stringMatching(/Art\. 18/) });
  });
  it('Sperrliste (z. B. nach Art. 17): keine Mail, keine Person, keine Einwilligung', async () => {
    const { sperren } = await import('@/lib/crm/sperrliste');
    await sperren([{ email: `geloescht@${D}` }], 'loeschung', '2026-11-01');
    const vorher = (await kontakte()).length;
    expect((await anmeldung(`geloescht@${D}`)).d).toEqual({ ok: true, text: R.ANMELDUNG_TEXT });
    await S._nachlauf();
    expect(fake.gesendet.some(m => m.an === `geloescht@${D}`)).toBe(false);
    expect((await bestand()).anmeldungen.find(a => a.email === `geloescht@${D}`)).toMatchObject({ gesperrt: 'sperrliste' });
    expect((await kontakte()).length).toBe(vorher);
  });
  it('Drossel: falsche Tokens zählen wie Fehlversuche (429)', async () => {
    let letzte = 0;
    for (let i = 0; i < 24; i++) letzte = (await post({ aktion: 'bestaetigen', token: `${String(i).padStart(2, '0')}${'B'.repeat(41)}` })).status;
    expect(letzte).toBe(429);
  });
});

describe('intern: Liste maskiert, Fassung, Löschen', () => {
  it('der Haushalt sieht die Anmeldungen nur maskiert — nie Adresse, nie Token-Fingerabdruck', async () => {
    const r = await innenLesen('nurbusiness');
    expect(r.status).toBe(200);
    expect(r.d.istInhaber).toBe(false);
    const text = JSON.stringify(r.d);
    expect(text).not.toContain(`neu@${D}`);
    expect(text).not.toContain('tokenHash');
    expect(r.d.liste.find((z: { email: string; stand: string }) => z.email === `n***@${D}` && z.stand === 'bestaetigt')).toBeTruthy();
    expect(r.d.einstellungen.absender).toMatchObject({ postfach: 'pf-probe', eigenes: false });
  });
  it('Einwilligungstext ändern → neue Fassung; die alte Seite (alte Fassung) wird abgewiesen', async () => {
    const r = await innen({ aktion: 'einstellungen', einwilligungstext: 'Ja, ich möchte den Newsletter von {marke} erhalten. Abmelden geht jederzeit.' });
    expect(r.d.fassung).toBe(3);
    expect((await anmeldung(`fassung@${D}`, { fassung: 'newsletter-einwilligung-2' })).status).toBe(409);
    expect((await anmeldung(`fassung@${D}`)).status).toBe(200);
    await S._nachlauf();
    expect((await bestand()).anmeldungen.find(a => a.email === `fassung@${D}`)).toMatchObject({ fassung: 'newsletter-einwilligung-3', wortlaut: 'Ja, ich möchte den Newsletter von Probe Marke erhalten. Abmelden geht jederzeit.' });
    expect((await innen({ aktion: 'einstellungen', einwilligungstext: '<script>' })).status).toBe(400);
    expect((await innen({ aktion: 'einstellungen', marke: 'Probe Marke' })).d.fassung).toBe(3); // gleicher Wortlaut, gleiche Fassung
  });
  it('löschen nur der Inhaber', async () => {
    const id = (await bestand()).anmeldungen.find(a => a.email === `fassung@${D}`)!.id;
    expect((await innen({ aktion: 'loeschen', id }, 'nurbusiness')).status).toBe(403);
    expect((await innen({ aktion: 'loeschen', id })).status).toBe(200);
    expect((await bestand()).anmeldungen.some(a => a.id === id)).toBe(false);
  });
  it('ohne gültigen Absender ist die Anmeldung aus (404)', async () => {
    fake.absenderOk = false;
    try {
      expect((await post({ aktion: 'anmelden', email: `x@${D}` })).status).toBe(404);
      expect(await S.newsletterBereit()).toBeNull();
    } finally { fake.absenderOk = true; }
  });
});

describe('Datenschutz: Art. 17, Löschfrist, Verzeichnis, Kopfdaten', () => {
  it('Art. 17: Anmeldungen mit einer Adresse der Person fallen weg', async () => {
    const { WEITERE_SPEICHER } = await import('@/lib/crm/person-weitere');
    const w = WEITERE_SPEICHER.find(x => x.name === 'newsletter-anmeldungen')!;
    const b = await bestand();
    const r = w.wirkung(b as never, { id: 'c-x', name: 'Nora', emails: [`neu@${D}`], fingerabdruecke: [] }) as unknown as { neu: AnmeldungenBestand; n: number };
    expect(r.n).toBeGreaterThan(0);
    expect(r.neu.anmeldungen.some(a => a.email === `neu@${D}`)).toBe(false);
    expect(r.neu.anmeldungen.length).toBe(b.anmeldungen.length - 1);
  });
  it('Löschfrist: unbestätigte nach 30 Tagen; bestätigte, solange die Einwilligung besteht', async () => {
    const b = await bestand();
    const bestaetigte = b.anmeldungen.filter(a => a.bestaetigt && a.crm?.status === 'ok').map(a => a.id);
    expect(bestaetigte.length).toBeGreaterThan(0);
    const spaeter = new Date(uhr + 31 * 86_400_000);
    const aktiv = new Set(bestaetigte.map(R.belegRefVon));
    const r = R.anmeldungenAufraeumen(b, spaeter, aktiv);
    expect(r.bestand.anmeldungen.map(a => a.id).sort()).toEqual([...bestaetigte].sort());
    expect(R.anmeldungenAufraeumen(b, spaeter, new Set()).bestand.anmeldungen).toHaveLength(0); // widerrufen → Nachweis liegt an der Akte
    expect(R.anmeldungenAufraeumen(b, spaeter, null).bestand.anmeldungen.map(a => a.id).sort()).toEqual([...bestaetigte].sort()); // Kartei nicht lesbar
    // Der Lauf selbst liest die Kartei: die bestätigten bleiben, die alten unbestätigten fallen.
    vi.setSystemTime(spaeter);
    try {
      const n = await S.newsletterFristLauf(spaeter);
      expect(n).toBe(b.anmeldungen.length - bestaetigte.length);
      expect((await bestand()).anmeldungen.map(a => a.id).sort()).toEqual([...bestaetigte].sort());
    } finally { vi.setSystemTime(new Date(uhr)); }
  });
  it('Verzeichnis: Verarbeitung erst, wenn die Anmeldung eingerichtet ist', async () => {
    const { verzeichnisVervollstaendigen, VV_NEWSLETTER_ID } = await import('@/lib/crm/datenschutz');
    const jetzt = new Date(uhr).toISOString();
    expect(verzeichnisVervollstaendigen([], jetzt).liste.some(v => v.id === VV_NEWSLETTER_ID)).toBe(false);
    expect(verzeichnisVervollstaendigen([], jetzt, { newsletter: true }).liste.some(v => v.id === VV_NEWSLETTER_ID)).toBe(true);
    expect(await S.newsletterEingerichtet()).toBe(true);
  });
  it('Kopfdaten ohne Grundgerüst der Anwendung, nie der Name der Software', () => {
    for (const datei of ['app/newsletter/page.tsx', 'app/newsletter/not-found.tsx']) expect(readFileSync(datei, 'utf8'), datei).toContain('...OEFFENTLICH_META');
    for (const datei of ['app/newsletter/page.tsx', 'app/newsletter/not-found.tsx', 'components/newsletter/NewsletterAnmeldung.tsx', 'lib/newsletter/regeln.ts']) {
      const q = readFileSync(datei, 'utf8').replace(/^\s*\/\/.*$/gm, '');
      expect(q, datei).not.toMatch(/MAKE OS|make os|Life & Business OS/i);
    }
  });
});

describe('Middleware: nur /newsletter und POST /api/newsletter sind offen', () => {
  let middleware: typeof import('@/middleware').middleware;
  beforeAll(async () => { ({ middleware } = await import('@/middleware')); });
  const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
  const lauf = (pfad: string, init: { method?: string; headers?: Record<string, string> } = {}) => middleware(new NextRequest(`http://localhost:3001${pfad}`, init as never));
  it('Seite (GET/HEAD) und Schnittstelle (POST) offen, ohne Köpfe einer Person', async () => {
    expect(offen(await lauf('/newsletter'))).toBe(true);
    expect(offen(await lauf('/newsletter', { method: 'HEAD' }))).toBe(true);
    const r = await lauf('/api/newsletter', { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001', 'x-make-user': 'kevin' } });
    expect(offen(r)).toBe(true);
    expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
  });
  it('alles andere bleibt zu — auch die interne Verwaltung', async () => {
    for (const [p, m] of [['/api/newsletter', 'GET'], ['/api/newsletter/intern', 'GET'], ['/api/newsletter/intern', 'POST'], ['/newsletter', 'POST'], ['/newsletter/x', 'GET'], ['/newsletters', 'GET'], ['/api/newsletters', 'POST']] as const) {
      const r = await lauf(p, m === 'POST' ? { method: 'POST', headers: { origin: 'http://localhost:3001', host: 'localhost:3001' } } : {});
      expect(offen(r), `${m} ${p}`).toBe(false);
    }
  });
});

describe('Caddy und Köpfe: makeinnovation.de (bis 12.11. fokusinnovation.de) leitet genau die zwei Pfade an die App', () => {
  it('@app im Block makeinnovation.de trägt /newsletter und /api/newsletter — nie /api/newsletter/*', () => {
    const caddy = readFileSync('deploy/caddy/Caddyfile', 'utf8');
    const block = caddy.slice(caddy.search(/^makeinnovation\.de \{/m));
    const app = /^\s*@app path (.+)$/m.exec(block)?.[1].split(/\s+/) ?? [];
    expect(app).toContain('/newsletter');
    expect(app).toContain('/api/newsletter');
    expect(app.some(p => p.startsWith('/api/newsletter/') || p === '/newsletter/*')).toBe(false);
  });
  it('next.config.mjs: strenge Köpfe (wie die Buchung) für Seite und Schnittstelle', () => {
    const cfg = readFileSync('next.config.mjs', 'utf8');
    expect(cfg).toContain("{ source: '/newsletter', headers: buchung }");
    expect(cfg).toContain("{ source: '/api/newsletter', headers: buchung }");
  });
});
