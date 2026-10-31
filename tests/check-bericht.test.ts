// ─── Checks — ausführlich nur mit E-Mail, Bericht per Mail genau einmal (31.10.) ─────────────────────────────────────────────────
// Eigener Datenordner, Datenschlüssel und Pepper gesetzt, Konten mit Test-Haushalt, Verantwortlicher der Einrichtung gemockt, Absender-Prüfung und
// Sendeweg (Inbox) als Fake — es geht nichts hinaus. Alle Namen und Adressen erfunden (@example.invalid). Prüft: der ausführliche Check liefert ohne
// Kontakt NUR die Vorschau (Wächter „Sicht ohne E-Mail bekommt nichts aus dem Bericht“), mit Kontakt die volle Ansicht; der Bericht geht genau einmal je
// Sitzung — egal ob Kontakt vor oder nach dem Ergebnis —, mit Werten, Branchenvergleich, Schritten, Angebot und Erstgespräch über die Website-Adresse;
// Art. 18 → keine Mail (nach außen gleich), ohne Website-Absender kein Versprechen, ein Vorname mit Link landet nie in der Mail, Fehlversuche begrenzt.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CheckBestand } from '@/lib/check/speicher';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-check-bericht-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-check-bericht';
process.env.SESSION_SECRET = 'pruef-sitzung-check-bericht-nur-im-test';
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-check-bericht-nur-im-test';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-check-bericht-nur-im-test-0123456789abcdef';
delete process.env.MAKE_OS_ADRESSE;

const ds = vi.hoisted(() => ({ wert: { verantwortlich: 'Probe GmbH, datenschutz@example.invalid' as string | null, seite: 'example.invalid/datenschutz' as string | null } }));
vi.mock('@/lib/datenschutz/einrichtung-server', async () => ({
  ...(await vi.importActual<typeof import('@/lib/datenschutz/einrichtung-server')>('@/lib/datenschutz/einrichtung-server')),
  datenschutzOeffentlichLaden: async () => ds.wert,
}));
const fake = vi.hoisted(() => ({ senden: { status: 200, body: { ok: true, von: 'versand@example.invalid' } as Record<string, unknown> }, gesendet: [] as { an: string; name?: string; betreff?: string; text: string }[] }));
vi.mock('@/lib/crm/angebot-versand', () => ({
  absenderPruefen: async (a?: { postfach: string }) => (!a ? { ok: false, grund: 'Absender-Postfach fehlt.' } : a.postfach === 'pf-probe' ? { ok: true, adresse: 'versand@example.invalid' } : { ok: false, grund: 'Dieses Postfach gibt es nicht.' }),
}));
vi.mock('@/lib/inbox/senden-server', () => ({
  inboxSenden: async (_p: string, b: { neu?: { betreff?: string }; an?: { email: string; name?: string }[]; text?: string }) => {
    fake.gesendet.push({ an: b.an?.[0]?.email ?? '', name: b.an?.[0]?.name, betreff: b.neu?.betreff, text: String(b.text ?? '') });
    return fake.senden;
  },
}));

type Antwort = { status: number; d: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
let db: typeof import('@/lib/store/local-db');
let drossel: typeof import('@/lib/zugang/drossel');
let W: typeof import('@/lib/oeffentlich/website-post');
let oeffentlich: { POST: (r: Request) => Promise<Response> };
const D = 'example.invalid';
const SLUG = 'erstgespraech-0123456789abcdef01234567';
const check = async (body: Record<string, unknown>): Promise<Antwort> => { const r = await oeffentlich.POST(new Request('http://test/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, d: await r.json() }; };
const bestand = async () => (await db.loadJson<CheckBestand>('check-sitzungen'))!;
const sitzungVon = async (id: string) => (await bestand()).sitzungen.find(x => x.id === id)!;
const an = (email: string) => fake.gesendet.filter(x => x.an === email);

const KURZ: [string, Record<string, unknown>][] = [
  ['A1', { optionIds: ['A1_0'], zusatz: false }], ['A2', { optionIds: ['A2_2'] }], ['A6', { optionIds: ['A6_1'] }],
  ['B1', { optionIds: ['B1_1'] }], ['B2', { optionIds: ['B2_1'] }], ['B4', { optionIds: ['B4_1'] }],
  ['C1', { optionIds: ['C1_1'] }], ['C2', { optionIds: ['C2_1'] }], ['C3', { optionIds: ['C3_1'] }],
  ['C5', { freitext: 'Wir probieren ein Werkzeug für Angebotstexte aus.' }], ['D1', { optionIds: ['D1_1'] }], ['D2', { optionIds: ['D2_1'] }],
  ['D7', { optionIds: ['D7_1'] }], ['E1', { optionIds: ['E1_1'] }], ['E4', { optionIds: ['E4_2'] }], ['E6', { optionIds: ['E6_1'] }],
  ['G1', { optionIds: ['G1_1'] }], ['G2', { optionIds: ['G2_1'] }], ['G6', { optionIds: ['G6_1'] }],
  ['W1', { freitext: 'Uns fehlt die Zeit, Neues in Ruhe auszuprobieren.' }],
];
const T0 = new Date('2026-11-09T08:00:00Z');
let uhr = T0.getTime();
const weiter = (sek: number) => { uhr += sek * 1000; vi.setSystemTime(new Date(uhr)); };

/** Start + alle Kurzcheck-Antworten; `lang` = ausführlich mit „Jetzt auswerten“ gleich nach dem Kurzcheck. */
async function durch(umfang?: 'kurz' | 'lang'): Promise<{ S: string; T: string }> {
  const st = await check({ aktion: 'start', ...(umfang ? { umfang } : {}) });
  const S = st.d.sitzung, T = st.d.token;
  for (const [frage, a] of KURZ) await check({ aktion: 'antwort', sitzung: S, token: T, frage, ...a });
  if (umfang === 'lang') expect((await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'ergebnis' })).d.schritt).toEqual({ art: 'kontakt' });
  weiter(60);
  return { S, T };
}
const kontakt = (S: string, T: string, email: string, x: Record<string, unknown> = {}) => check({ aktion: 'kontakt', sitzung: S, token: T, vorname: 'Testa', email, firma: 'Probe Handwerk GmbH', rolle: 'A5_0', newsletter: false, webseite: '', ...x });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
  db = await import('@/lib/store/local-db');
  drossel = await import('@/lib/zugang/drossel');
  await db.saveJson('konten', { konten: [
    { id: 'k1', speicher: 'kevin', email: `k@${D}`, name: 'Testo Inhaber', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'test-haus' },
  ], einladungen: [] });
  await db.saveJson('kontakte', { kontakte: [
    { id: 'c-eng', vorname: 'Vera', nachname: 'Muster', email: `eng@${D}`, eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', eingeschraenkt: { seit: '2026-09-01', grund: 'Art. 18', von: 'kevin' } } as Kontakt,
  ] });
  await db.saveJson('check-einstellungen', { aktiv: true, buchungSlug: SLUG, website: `https://www.${D}`, marke: 'Probe Marke', angebote: { innovation: { titel: 'KI im Alltag', text: 'Ein Satz zum Angebot.', link: '/innovation/' } } });
  await db.saveJson('newsletter-einstellungen', { aktiv: false, fassung: 1, absender: { person: 'kevin', postfach: 'pf-probe', gesetztAm: T0.toISOString() } });
  W = await import('@/lib/oeffentlich/website-post');
  oeffentlich = await import('@/app/api/check/route');
});
afterEach(async () => { await W._nachlauf(); drossel._zuruecksetzen(); W._websitePostZuruecksetzen(); });
afterAll(() => { vi.useRealTimers(); rmSync(ordner, { recursive: true, force: true }); });

describe('ausführlich: ohne E-Mail nur die Vorschau (serverseitig)', () => {
  it('Sicht ohne E-Mail bekommt nichts aus dem Bericht — keine Werte je Bereich, kein Branchenvergleich, keine Schritte, kein Angebot', async () => {
    const { S, T } = await durch('lang');
    expect((await check({ aktion: 'ohne-kontakt', sitzung: S, token: T })).d.schritt).toEqual({ art: 'ergebnis' });
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.status).toBe(200);
    const a = r.d.ansicht;
    expect(Object.keys(a).sort()).toEqual(['bereiche', 'genauigkeit', 'gesamt', 'gesperrt', 'stufe', 'stufeKurz', 'stufeName', 'stufen', 'zoe']);
    expect(a.gesperrt).toBe(true);
    expect(a.bereiche).toEqual(['Strategie und Führung', 'KI im Alltag', 'Automatisierung', 'Daten und Systeme', 'Team und Kompetenz']);
    expect(a.bereiche.every((x: unknown) => typeof x === 'string')).toBe(true);
    // Außer der Vorschau nur der Stand der Strecke (eigene Antworten, Schritt) — kein Feld des Berichts.
    expect(Object.keys(r.d).sort()).toEqual(['ansicht', 'antworten', 'fortschritt', 'kontakt', 'ok', 'schritt', 'uebersprungen', 'umfang', 'wahl']);
    const text = JSON.stringify(r.d);
    for (const geheim of ['achsen', 'branche', 'schritte', 'Ein Satz zum Angebot', '/innovation/', 'luecken', 'innovation', 'gespraech', '"bericht"', 'siegel', 'saeulen']) expect(text, geheim).not.toContain(geheim);
    const s = await sitzungVon(S);
    expect(s.ergebnis!.gesamt).toBe(a.gesamt);
    expect(a.zoe.join(' ')).toContain(`Stufe ${a.stufe}`);
    expect(a.zoe.join(' ')).toContain('per E-Mail');
    await W._nachlauf();
    expect(fake.gesendet).toHaveLength(0);
    expect(s.bericht).toBeUndefined();
  });
  it('kurz ohne E-Mail, dann „Ausführlich weitermachen“ bis zum genauen Ergebnis: ebenfalls nur die Vorschau (kein Umweg)', async () => {
    const { S, T } = await durch('kurz');
    await check({ aktion: 'ohne-kontakt', sitzung: S, token: T });
    // Der kurze Check bleibt frei (vorläufig) …
    const kurz = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(kurz.d.ansicht.gesperrt).toBeUndefined();
    expect(kurz.d.ansicht.genauigkeit).toBe('vorlaeufig');
    // … aber wer weitermacht, bekommt den ganzen ausführlichen Bericht nur mit E-Mail.
    let schritt = (await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'mehr' })).d.schritt;
    const katalog = (await check({ aktion: 'stand', sitzung: S, token: T })).d.katalog as { fragen: { id: string; optionen?: { id: string }[] }[] };
    for (let i = 0; i < 120 && schritt?.art === 'frage'; i++) {
      const f = katalog.fragen.find(x => x.id === schritt.frageId);
      const versuch = f?.optionen?.length ? await check({ aktion: 'antwort', sitzung: S, token: T, frage: schritt.frageId, optionIds: [f.optionen[0].id], zusatz: false }) : null;
      schritt = versuch?.status === 200 ? versuch.d.schritt
        : (await check({ aktion: 'antwort', sitzung: S, token: T, frage: schritt.frageId, freitext: 'Wir prüfen gerade einen ersten Anwendungsfall.' })).status === 200
          ? (await check({ aktion: 'stand', sitzung: S, token: T })).d.schritt
          : (await check({ aktion: 'ueberspringen', sitzung: S, token: T, frage: schritt.frageId })).d.schritt;
    }
    const lang = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(lang.status).toBe(200);
    expect(lang.d.ansicht.gesperrt).toBe(true);
    expect(lang.d.ansicht.genauigkeit).toBe('genau');
    expect(JSON.stringify(lang.d)).not.toContain('achsen');
    // Mit E-Mail danach: alles.
    await kontakt(S, T, `umweg@${D}`);
    const voll = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(voll.d.ansicht.gesperrt).toBeUndefined();
    expect(voll.d.ansicht.innovation.achsen.length).toBeGreaterThanOrEqual(5);
  });
  it('mit Kontakt (danach): volle Ansicht, „unterwegs an“ maskiert, der Bericht genau einmal — auch bei erneutem Abruf', async () => {
    const { S, T } = await durch('lang');
    await check({ aktion: 'ohne-kontakt', sitzung: S, token: T });
    expect((await check({ aktion: 'ergebnis', sitzung: S, token: T })).d.ansicht.gesperrt).toBe(true);
    const k = await kontakt(S, T, `Lang.Probe@${D}`);
    expect(k.status).toBe(200);
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.d.ansicht.gesperrt).toBeUndefined();
    expect(r.d.ansicht.innovation.achsen.length).toBe(5);
    expect(r.d.ansicht.schritte[0].angebot).toEqual({ titel: 'KI im Alltag', text: 'Ein Satz zum Angebot.', link: '/innovation/' });
    expect(r.d.bericht).toEqual({ perMail: true, an: `l***@${D}` });
    await check({ aktion: 'ergebnis', sitzung: S, token: T });
    await W._nachlauf();
    const mails = an(`lang.probe@${D}`);
    expect(mails).toHaveLength(1);
    const m = mails[0];
    expect(m.betreff).toBe('Ihr Bericht: Innovations-Check — Probe Marke');
    expect(m.text).toMatch(/^Guten Tag Testa,/);
    expect(m.text).toContain(`Stufe ${r.d.ansicht.stufe}:`);
    expect(m.text).toContain(`${r.d.ansicht.gesamt} von 100 Punkten`);
    for (const x of r.d.ansicht.innovation.achsen) expect(m.text).toContain(`· ${x.name}: ${x.wert} von 100 (Ihre Branche: ${x.branche})`);
    expect(m.text).toContain(r.d.ansicht.innovation.branchenSatz);
    expect(m.text).toContain('IHRE NÄCHSTEN SCHRITTE');
    expect(m.text).toContain('Passendes Angebot: KI im Alltag — Ein Satz zum Angebot.');
    expect(m.text).toContain(`https://www.${D}/innovation/`);
    expect(m.text).toContain(`Termin wählen: https://www.${D}/buchen/${SLUG}`);
    expect(m.text).toContain('Verantwortlich: Probe GmbH, datenschutz@example.invalid');
    const s = await sitzungVon(S);
    expect(s.bericht).toMatchObject({ status: 'gesendet', versuche: 1, ueber: `v***@${D}` });
  });
});

describe('Bericht per Mail für alle Checks', () => {
  it('kurz: Kontakt vor dem Ergebnis → genau eine Mail; „mehr“ und ein neues Ergebnis schicken keine zweite', async () => {
    const { S, T } = await durch('kurz');
    await kontakt(S, T, `kurz@${D}`);
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.d.ansicht.innovation.achsen.length).toBe(5);
    expect(r.d.bericht).toEqual({ perMail: true, an: `k***@${D}` });
    await W._nachlauf();
    expect(an(`kurz@${D}`)).toHaveLength(1);
    await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'mehr' });
    await check({ aktion: 'wahl', sitzung: S, token: T, wahl: 'ergebnis' });
    await check({ aktion: 'ergebnis', sitzung: S, token: T });
    await W._nachlauf();
    expect(an(`kurz@${D}`)).toHaveLength(1);
  });
  it('Kontakt NACH dem Ergebnis (kurz, „Termin buchen“): die Mail geht schon mit dem Kontakt', async () => {
    const { S, T } = await durch('kurz');
    await check({ aktion: 'ohne-kontakt', sitzung: S, token: T });
    const frei = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(frei.d.ansicht.innovation).toBeTruthy(); // kurz bleibt frei
    expect(frei.d.bericht).toBeUndefined();
    await W._nachlauf();
    expect(fake.gesendet.filter(x => x.an === `danach@${D}`)).toHaveLength(0);
    await kontakt(S, T, `danach@${D}`);
    await W._nachlauf();
    expect(an(`danach@${D}`)).toHaveLength(1);
  });
  it('Art. 18: keine Mail — nach außen dieselbe Antwort; der Grund steht nur intern', async () => {
    const { S, T } = await durch('kurz');
    await kontakt(S, T, `eng@${D}`);
    const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
    expect(r.d.bericht).toEqual({ perMail: true, an: `e***@${D}` });
    await W._nachlauf();
    expect(an(`eng@${D}`)).toHaveLength(0);
    expect((await sitzungVon(S)).bericht?.status).toBe('gesperrt');
    // Gesperrt wird nie wiederholt.
    await check({ aktion: 'ergebnis', sitzung: S, token: T });
    await W._nachlauf();
    expect(an(`eng@${D}`)).toHaveLength(0);
  });
  it('ein Vorname mit Link landet nie in der Mail', async () => {
    const { S, T } = await durch('kurz');
    await kontakt(S, T, `link@${D}`, { vorname: 'www.fremd.example.invalid' });
    await check({ aktion: 'ergebnis', sitzung: S, token: T });
    await W._nachlauf();
    const m = an(`link@${D}`)[0];
    expect(m.text).toMatch(/^Guten Tag,/);
    expect(m.text).not.toContain('fremd');
    expect(m.name).toBeUndefined();
  });
  it('Versand scheitert: höchstens drei Versuche, jeweils beim nächsten Abruf', async () => {
    const { S, T } = await durch('kurz');
    await kontakt(S, T, `wackel@${D}`);
    fake.senden = { status: 502, body: { fehler: 'Postfach nicht erreichbar' } };
    try {
      for (let i = 0; i < 5; i++) { await check({ aktion: 'ergebnis', sitzung: S, token: T }); await W._nachlauf(); }
      expect(an(`wackel@${D}`)).toHaveLength(3);
      expect((await sitzungVon(S)).bericht).toMatchObject({ status: 'fehler', versuche: 3 });
    } finally { fake.senden = { status: 200, body: { ok: true, von: 'versand@example.invalid' } }; }
  });
  it('ohne Website-Absender: kein Versprechen „unterwegs“, kein Versand, Vermerk intern; ausführlich ohne Kontakt sagt nichts von E-Mail', async () => {
    await db.saveJson('newsletter-einstellungen', { aktiv: false, fassung: 1 });
    try {
      const { S, T } = await durch('kurz');
      await kontakt(S, T, `ohne@${D}`);
      const r = await check({ aktion: 'ergebnis', sitzung: S, token: T });
      expect(r.d.bericht).toEqual({ perMail: false });
      await W._nachlauf();
      expect(an(`ohne@${D}`)).toHaveLength(0);
      expect((await sitzungVon(S)).bericht?.status).toBe('ohneAbsender');
      const l = await durch('lang');
      await check({ aktion: 'ohne-kontakt', sitzung: l.S, token: l.T });
      const v = await check({ aktion: 'ergebnis', sitzung: l.S, token: l.T });
      expect(v.d.ansicht.gesperrt).toBe(true);
      expect(v.d.ansicht.zoe.join(' ')).not.toContain('E-Mail');
      expect((await check({ aktion: 'stand', sitzung: l.S, token: l.T })).d.zoe.kontaktLang.join(' ')).not.toMatch(/schicke ich Ihnen per E-Mail/);
    } finally {
      await db.saveJson('newsletter-einstellungen', { aktiv: false, fassung: 1, absender: { person: 'kevin', postfach: 'pf-probe', gesetztAm: T0.toISOString() } });
    }
  });
});
