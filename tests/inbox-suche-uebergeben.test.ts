// Inbox — Lücken aus ROADMAP_Q4.md (Lücke 6 + Phase 1, 10.10.): Suche auch über Anhang-NAMEN, Übergabe mit ausdrücklich angehakten Anhängen
// (verschlüsselte Kopie), „Zurückziehen“, Kennzeichen Werbesperre/Art. 18 in der Kopie, ZOE-Entwurf zur Übergabe, Aufgaben-Vorschläge aus
// Mails/WhatsApp (Regelwerk ohne Modell → eigener Freigabe-Stapel → Aufgabe erst per Klick).
// Wächter: Person B bekommt nichts aus As Spiegel außer der übergebenen Kopie (Suche, Übergaben, Anhänge, Vorschläge); die Business-Sicht zeigt
// keine Treffer/Kopien aus Privat-Postfächern; Dienstweg/fremder Haushalt 403. Nachgebauter Anbieter (PostSpeicher), erfundene Daten.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Kontakt } from '@/lib/make-one/crm';
import type { PostSpeicher as PS } from '@/lib/postfach/post-speicher';
import {
  ablageNamen, ablageUebernehmen, ablageWeg, anhangWahlSauber, nachrichtTreffer, TeilenFehler, uebergabenNachMailFrist, zurueckziehenPruefen, type Uebergabe, type UebergabeNachricht,
} from '@/lib/inbox/teilen';
import { aufgabeAusHandlung, aufgabeEingabe, handlungAus, ohneZitat, stapelTitel, vorschlagKandidat } from '@/lib/inbox/aufgaben-vorschlag';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/os/inbox' }));

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-inbox-suche-uebergeben-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_DATEN_SCHLUESSEL = 'pruef-datenschluessel-inbox-suche-uebergeben';
process.env.MAKE_OS_KEY = 'dienst-test-inbox-suche-uebergeben';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-inbox-suche-uebergeben-0123456789';
delete process.env.MAKE_OS_GRABSTEINE_DIR;

const D = 'example.invalid';
const PW_KDV = 'Kennwort-KDV-0815';
const PW_PRIVAT = 'abcd-efgh-ijkl-mnop';
type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, gespraech: R, postfaecher: R, uebergaben: R, suche: R, vorschlaege: R, entwurf: R;
let db: typeof import('@/lib/store/local-db');
let A: typeof import('@/lib/postfach/abgleich');
let T: typeof import('@/lib/postfach/transport');
let P: typeof import('@/lib/postfach/post-speicher');
const server = new Map<string, PS>();

const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
const dienst = (person: string) => ({ 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const ROH = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h }));
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);
const k = (id: string, vorname: string, nachname: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname, nachname, stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', anrede: 'Sie', ...x } as Kontakt);
const konto = (id: string, speicher: string, name: string, rolle: string, haushalt: string, extra: Record<string, unknown> = {}) =>
  ({ id, speicher, email: `${speicher}@${D}`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt, ...extra });
const KONTEN = { konten: [
  konto('k1', 'kevin', 'Erster Beispiel', 'inhaber', 'h'),
  konto('k2', 'malin', 'Zweite Beispiel', 'mitglied', 'h'),
  konto('k3', 'partner', 'Partner Beispiel', 'mitglied', 'h', { finanzRecht: 'business' }),
  konto('k4', 'fremd', 'Fremd Beispiel', 'mitglied', 'anderer-haushalt'),
], einladungen: [] };
const PRIVAT_MARKE = 'PRIVAT-Hochzeit-Planung';
const PDF_INHALT = 'PDF-ANFRAGE-GEHEIM-0815';
const ABLAGE = () => path.join(ordner, 'inbox-uebergaben');

beforeAll(async () => {
  db = await import('@/lib/store/local-db'); A = await import('@/lib/postfach/abgleich'); T = await import('@/lib/postfach/transport'); P = await import('@/lib/postfach/post-speicher');
  inbox = await import('../app/api/inbox/route') as R; gespraech = await import('../app/api/inbox/gespraech/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R; uebergaben = await import('../app/api/inbox/uebergaben/route') as R;
  suche = await import('../app/api/inbox/suche/route') as R; vorschlaege = await import('../app/api/inbox/vorschlaege/route') as R;
  entwurf = await import('../app/api/inbox/entwurf/route') as R;
});
afterAll(async () => {
  await (await import('@/lib/store/leseprotokoll')).leseprotokollWarten();
  T.transportSetzen(null); rmSync(ordner, { recursive: true, force: true });
});

const anbieter = (benutzer: string): PS => {
  const s = server.get(benutzer);
  if (!s) throw new T.PostfachFehler('netz', 'Server unbekannt', 503);
  return s;
};

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('GOOGLE_CLIENT_ID', ''); vi.stubEnv('GOOGLE_CLIENT_SECRET', ''); vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', ''); vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  (await import('@/lib/store/leseprotokoll')).leseDrosselLeeren();
  server.clear();
  server.set(`eins.kdv@firma.${D}`, new P.PostSpeicher({ passwort: PW_KDV, ordner: [{ pfad: 'INBOX' }, { pfad: 'Gesendete Objekte' }] }));
  server.set('eins.privat', new P.PostSpeicher({ passwort: PW_PRIVAT }));
  T.transportSetzen({
    imap: z => anbieter(z.benutzer).sitzung(z),
    smtp: (z, u, roh) => anbieter(z.benutzer === 'eins.privat@icloud.com' ? 'eins.privat' : z.benutzer).senden(z, u, roh),
    waechter: async (z, _p, neu) => ({ stop: async () => { anbieter(z.benutzer).beobachten(neu)(); } }),
  });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [
    k('c-anna', 'Anna', 'Schmidt', { email: `anna@kunde.${D}` }),
    k('c-paul', 'Paul', 'Kern', { email: `paul@lieferant.${D}` }),
    k('c-freundin', 'Frieda', 'Freundlich', { email: `freundin@privat.${D}` }),
  ] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  const kdv = server.get(`eins.kdv@firma.${D}`)!;
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Anna Schmidt <anna@kunde.${D}>`, an: `eins.kdv@firma.${D}`, betreff: 'Angebot Müller', text: 'Können Sie bis Freitag ein Angebot für Müller schicken?', messageId: `<a1@kunde.${D}>`, anhang: { name: 'Anfrage-Mueller.pdf', typ: 'application/pdf', inhalt: PDF_INHALT } }));
  kdv.ablegen('INBOX', P.rohNachricht({ von: `Paul Kern <paul@lieferant.${D}>`, an: `eins.kdv@firma.${D}`, betreff: 'Unterlagen', text: 'Hallo,\n\nwir haben die Unterlagen erhalten. Könnten Sie uns bitte die unterschriebene Vollmacht zurückschicken?\n\nGruß Paul', messageId: `<p1@lieferant.${D}>` }));
  server.get('eins.privat')!.ablegen('INBOX', P.rohNachricht({ von: `Frieda <freundin@privat.${D}>`, an: 'eins.privat@icloud.com', betreff: PRIVAT_MARKE, text: 'Hast du am Samstag Zeit für die Planung?', messageId: `<f1@${D}>`, anhang: { name: 'Sitzplan-Hochzeit.pdf', typ: 'application/pdf', inhalt: 'PDF-PRIVAT' } }));
});

async function verbinden(): Promise<{ kdv: string; privat: string }> {
  const a = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'ionos', adresse: `eins.kdv@firma.${D}`, passwort: PW_KDV, bereich: 'kdv', anzeigename: 'KD Ventures' });
  const b = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'hinzufuegen', anbieter: 'icloud', adresse: 'eins.privat@icloud.com', passwort: PW_PRIVAT, bereich: 'privat', anzeigename: 'Privat · iCloud' });
  expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
  await A.imapAbgleichen('kevin', a.d.id); await A.imapAbgleichen('kevin', b.d.id);
  return { kdv: a.d.id, privat: b.d.id };
}
const gespraecheVon = async (person: string) => (await GET(inbox, '/api/inbox', sitzung(person))).d.gespraeche as { id: string; betreff: string; fach: string }[];
const finde = async (betreff: string) => (await gespraecheVon('kevin')).find(g => g.betreff === betreff)!;
const anhaengeVon = async (id: string) => ((await GET(gespraech, `/api/inbox/gespraech?id=${encodeURIComponent(id)}`)).d.nachrichten as { id: string; anhaenge: { teil: string; name: string }[] }[])
  .flatMap(n => n.anhaenge.map(a => ({ nachricht: n.id, teil: a.teil, name: a.name })));

// ── Rein ────────────────────────────────────────────────────────────────────

const nachricht = (x: Partial<UebergabeNachricht> = {}): UebergabeNachricht => ({ id: 'n1', am: '2026-10-08T08:00:00.000Z', von: { email: `a@${D}` }, an: [], cc: [], betreff: 'Hallo', text: 'Text', vonUns: false, anhaenge: [], ...x });

describe('Regeln (rein)', () => {
  it('Suche trifft Anhang-NAMEN (nicht eingebettete), nie ihren Inhalt', () => {
    const n = { betreff: 'Unterlagen', von: { email: `x@${D}` }, an: [], cc: [], text: 'siehe Anlage', anhaenge: [{ name: 'Rechnung-2026-117.pdf' }, { name: 'logo.png', eingebettet: true }] };
    expect(nachrichtTreffer(n, 'rechnung 117')).toMatchObject({ wo: 'anhang' });
    expect(nachrichtTreffer(n, 'logo')).toBeNull();
    expect(nachrichtTreffer({ ...n, anhaenge: undefined }, 'rechnung')).toBeNull();
  });
  it('Anhänge mitgeben: Wahl säubern (doppelt weg, Unsinn 400, zu viele 413), Ablage behalten/wegräumen, Zurückziehen nur die übergebende Person', () => {
    expect(anhangWahlSauber([{ nachricht: 'pf:e:1:1', teil: '2' }, { nachricht: 'pf:e:1:1', teil: '2' }])).toHaveLength(1);
    expect(anhangWahlSauber(undefined)).toEqual([]);
    expect(() => anhangWahlSauber([{ nachricht: '../x', teil: '2' }])).toThrow(TeilenFehler);
    expect(() => anhangWahlSauber(Array.from({ length: 11 }, (_, i) => ({ nachricht: `n${i}`, teil: '2' })))).toThrow(expect.objectContaining({ status: 413 }));
    const ab = 'ua-11111111-2222-4333-8444-555555555555.bin';
    const alt = [nachricht({ anhaenge: [{ teil: '2', name: 'a.pdf', typ: 'application/pdf', groesse: 3, ablage: ab }] })];
    const neu = ablageUebernehmen(alt, [nachricht({ anhaenge: [{ teil: '2', name: 'a.pdf', typ: 'application/pdf', groesse: 3 }] }), nachricht({ id: 'n2' })]);
    expect(neu[0].anhaenge[0].ablage).toBe(ab);
    expect(ablageNamen({ nachrichten: neu })).toEqual([ab]);
    expect(ablageWeg([{ nachrichten: alt }], [])).toEqual([ab]);
    expect(ablageWeg([{ nachrichten: alt }], [{ nachrichten: neu }])).toEqual([]);
    expect(() => zurueckziehenPruefen({ von: 'kevin' } as Uebergabe, 'malin')).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => zurueckziehenPruefen({ von: 'kevin' } as Uebergabe, 'kevin')).not.toThrow();
  });
  it('Löschfrist wie der Mail-Spiegel: die Kopie lebt nicht länger als ihre jüngste Nachricht im Spiegel (jeder Status)', () => {
    const u = (id: string, am: string) => ({ id, kopieAm: '2026-01-01T00:00:00.000Z', nachrichten: [nachricht({ am })] }) as Uebergabe;
    const l = [u('alt', '2026-03-01T10:00:00.000Z'), u('neu', '2026-09-01T10:00:00.000Z')];
    expect(uebergabenNachMailFrist(l, '2026-04-13').map(x => x.id)).toEqual(['neu']);
    expect(uebergabenNachMailFrist(l, '2026-01-01').map(x => x.id)).toEqual(['alt', 'neu']);
  });
  it('Regelwerk: Frist, Dokument, Bitte, Frage — Zitate, Floskeln und Smalltalk zählen nicht', () => {
    const heute = '2026-10-07'; // ein Mittwoch
    expect(handlungAus({ betreff: 'Angebot', text: 'Können Sie bis Freitag ein Angebot schicken?' }, heute)).toMatchObject({ grund: 'frist', datum: '2026-10-09' });
    expect(handlungAus({ betreff: 'Unterlagen', text: 'anbei', anhaenge: [{ name: 'Rechnung-117.pdf' }] }, heute)).toMatchObject({ grund: 'dokument', dokument: 'Rechnung' });
    expect(handlungAus({ betreff: '2. Mahnung', text: 'siehe oben' }, heute)).toMatchObject({ grund: 'dokument', dokument: 'Mahnung' });
    expect(handlungAus({ betreff: 'Vollmacht', text: 'Könnten Sie uns bitte die unterschriebene Vollmacht zurückschicken?' }, heute)).toMatchObject({ grund: 'bitte' });
    expect(handlungAus({ betreff: 'Kurz', text: 'Haben Sie die Zahlen für Oktober schon?' }, heute)).toMatchObject({ grund: 'frage' });
    expect(handlungAus({ betreff: 'Hi', text: 'Wie geht es dir? Bis bald!' }, heute)).toBeNull();
    expect(handlungAus({ betreff: 'Info', text: 'Bitte beachten Sie unsere neuen Öffnungszeiten.' }, heute)).toBeNull();
    // Unsere eigene frühere Bitte im Zitat schlägt nicht an.
    const mitZitat = 'Danke, ist angekommen.\n\nAm 06.10.2026 schrieb Beispiel <x@example.invalid>:\n> Könnten Sie bitte die Vollmacht unterschreiben und zurückschicken?';
    expect(ohneZitat(mitZitat)).toBe('Danke, ist angekommen.\n');
    expect(handlungAus({ betreff: 'Re: Vollmacht', text: mitZitat }, heute)).toBeNull();
  });
  it('Kandidaten: nur Arbeit (Antworten/Termine/Geld), nie Art. 18; Team/WhatsApp nur für die Person, die sich kümmert', () => {
    const g = { fach: 'antworten' as const, inArbeit: true, quelle: 'imap' as const };
    expect(vorschlagKandidat(g, 'kevin')).toBe(true);
    for (const fach of ['info', 'neu', 'warten', 'geblockt'] as const) expect(vorschlagKandidat({ ...g, fach }, 'kevin'), fach).toBe(false);
    expect(vorschlagKandidat({ ...g, inArbeit: false }, 'kevin')).toBe(false);
    expect(vorschlagKandidat({ ...g, zuordnung: { kontaktId: 'c', name: 'X', sperre: 'eingeschraenkt' } as never }, 'kevin')).toBe(false);
    const team = { stand: '0', personen: [], kuemmert: { person: 'malin', name: 'Zweite', seit: '' } };
    expect(vorschlagKandidat({ ...g, quelle: 'whatsapp', team }, 'kevin')).toBe(false);
    expect(vorschlagKandidat({ ...g, quelle: 'whatsapp', team }, 'malin')).toBe(true);
    expect(vorschlagKandidat({ ...g, quelle: 'whatsapp', team: { stand: '0', personen: [] } }, 'malin')).toBe(false);
  });
  it('Aufgabe über denselben Weg wie „Aufgabe daraus machen“ (Link zurück, Frist); Stapel-Titel ohne Betreff und Namen', () => {
    const g = { id: 'im~pf-11111111-2222-4333-8444-555555555555~0123456789abcdef0123', betreff: 'Re: Angebot Müller', gegenueber: { email: `anna@${D}`, name: 'Anna' }, zuordnung: null, bereich: 'kdv' };
    const a = aufgabeAusHandlung(g, { grund: 'frist', datum: '2026-10-09', stueck: 'bis Freitag' });
    expect(a).toMatchObject({ title: 'Angebot Müller', dueDate: '2026-10-09', space: 'business' });
    expect(a.description).toContain(`/os/inbox?offen=${g.id}`);
    expect(aufgabeAusHandlung(g, { grund: 'bitte', stueck: 'x' }).title).toBe('Erledigen: Angebot Müller');
    expect(stapelTitel({ grund: 'frist', datum: '2026-10-09', stueck: 'bis Freitag' })).toBe('Aufgabe aus der Inbox — Frist 09.10.');
    expect(stapelTitel({ grund: 'dokument', dokument: 'Rechnung', stueck: 'Rechnung-Mueller.pdf' })).not.toMatch(/Mueller|Müller/);
    expect(aufgabeEingabe(a)).toMatchObject({ title: 'Angebot Müller', space: 'business' });
    expect(aufgabeEingabe({ ...a, space: 'irgendwo' })).toBeNull();
    expect(aufgabeEingabe({ ...a, title: 'x'.repeat(301) })).toBeNull();
  });
});

// ── Suche über Anhang-Namen ─────────────────────────────────────────────────

describe('Suche: Anhang-Namen, eigene Spiegel, Bereich', () => {
  it('findet den Anhang-Namen nur in eigenen Postfächern; Business-Sicht nie Privat; andere Personen nichts', async () => {
    await verbinden();
    const t = await GET(suche, '/api/inbox/suche?q=Anfrage-Mueller');
    expect(t.d.treffer[0]).toMatchObject({ betreff: 'Angebot Müller', wo: 'anhang' });
    expect((await GET(suche, '/api/inbox/suche?q=Sitzplan')).d.gesamt).toBe(1);
    expect((await GET(suche, '/api/inbox/suche?q=Sitzplan&space=business')).d.gesamt).toBe(0);
    for (const p of ['malin', 'partner']) for (const q of ['Sitzplan', 'Anfrage-Mueller', 'Vollmacht']) expect((await GET(suche, `/api/inbox/suche?q=${q}`, sitzung(p))).d.gesamt, `${p}/${q}`).toBe(0);
    expect((await GET(suche, '/api/inbox/suche?q=Sitzplan', dienst('kevin'))).status).toBe(403);
  });
});

// ── Übergabe mit Anhängen, Zurückziehen, Kennzeichen ────────────────────────

describe('Übergabe: angehakte Anhänge als verschlüsselte Kopie, Zurückziehen, Kennzeichen', () => {
  it('nur der angehakte Anhang geht mit — verschlüsselt abgelegt; nur die Beteiligten laden ihn; Suche findet bei B nur die Kopie', async () => {
    await verbinden();
    const g = await finde('Angebot Müller');
    const [pdf] = await anhaengeVon(g.id);
    expect(pdf.name).toBe('Anfrage-Mueller.pdf');
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', anhaenge: [{ nachricht: pdf.nachricht, teil: pdf.teil }] });
    expect(r.status, r.text).toBe(200);
    expect(r.d.text).toContain('Anhang');
    // Auf der Platte nur die Hülle — nie der Klartext.
    const dateien = readdirSync(ABLAGE());
    expect(dateien).toHaveLength(1);
    expect(readFileSync(path.join(ABLAGE(), dateien[0])).toString('latin1')).not.toContain(PDF_INHALT);
    const u = (await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung('malin'))).d.uebergabe as Uebergabe;
    const a = u.nachrichten.flatMap(n => n.anhaenge).find(x => x.ablage)!;
    expect(a.name).toBe('Anfrage-Mueller.pdf');
    const datei = await ROH(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}&anhang=${a.ablage}`, sitzung('malin'));
    expect(datei.status).toBe(200);
    expect(datei.headers.get('content-disposition')).toContain('attachment');
    expect(datei.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await datei.arrayBuffer()).toString()).toBe(PDF_INHALT);
    expect((await ROH(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}&anhang=${a.ablage}`)).status).toBe(200); // die übergebende Person auch
    for (const p of ['partner', 'fremd']) expect((await ROH(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}&anhang=${a.ablage}`, sitzung(p))).status, p).not.toBe(200);
    expect((await ROH(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}&anhang=${a.ablage}`, dienst('malin'))).status).toBe(403);
    expect((await ROH(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}&anhang=../konten.json`, sitzung('malin'))).status).toBe(400);
    // B findet die Kopie (auch über den Anhang-Namen) — sonst nichts aus As Spiegel.
    const s = (await GET(suche, '/api/inbox/suche?q=Anfrage-Mueller', sitzung('malin'))).d;
    expect(s.treffer).toEqual([expect.objectContaining({ art: 'uebergabe', id: r.d.id, wo: 'anhang' })]);
    expect((await GET(suche, '/api/inbox/suche?q=Vollmacht', sitzung('malin'))).d.gesamt).toBe(0);
  });

  it('Zurückziehen: nur die übergebende Person; danach ist die Kopie samt Datei weg, die Empfängerin bekommt eine neutrale Glocke', async () => {
    await verbinden();
    const g = await finde('Angebot Müller');
    const [pdf] = await anhaengeVon(g.id);
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', anhaenge: [pdf] });
    expect(r.status, r.text).toBe(200);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'zurueckziehen', id: r.d.id }, sitzung('malin'))).status).toBe(403);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'zurueckziehen', id: r.d.id }, dienst('kevin'))).status).toBe(403);
    const z = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'zurueckziehen', id: r.d.id });
    expect(z.status, z.text).toBe(200);
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung('malin'))).status).toBe(404);
    expect((await GET(suche, '/api/inbox/suche?q=Mueller', sitzung('malin'))).d.gesamt).toBe(0);
    expect(existsSync(ABLAGE()) ? readdirSync(ABLAGE()) : []).toEqual([]);
    const gl = JSON.stringify(await db.loadJson('meldungen--malin'));
    expect(gl).toContain('zurückgezogen');
    expect(gl).not.toContain('Müller');
    // Ohne Anhang wieder übergeben geht (kein „schon übergeben“).
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin' })).status).toBe(200);
  });

  it('verwaiste Dateien räumt der tägliche Lauf weg; zu große Auswahl → 413, nichts übergeben', async () => {
    await verbinden();
    const g = await finde('Angebot Müller');
    const [pdf] = await anhaengeVon(g.id);
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', anhaenge: [pdf] });
    // Art. 17 o. ä. ändert den Bestand direkt — die Datei bleibt zunächst liegen …
    const { uebergabenName, ablageVerwaisteRaeumen } = await import('@/lib/inbox/uebergaben-speicher');
    await db.saveJson(uebergabenName('h'), { v: 1, uebergaben: [] });
    expect(readdirSync(ABLAGE())).toHaveLength(1);
    expect(await ablageVerwaisteRaeumen(new Date(Date.now() + 2 * 3600_000))).toBe(1);
    expect(readdirSync(ABLAGE())).toHaveLength(0);
    expect(r.status).toBe(200);
    const elf = Array.from({ length: 11 }, (_, i) => ({ nachricht: pdf.nachricht, teil: `${i + 1}` }));
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', anhaenge: elf })).status).toBe(413);
    expect((await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: g.id, an: 'malin', anhaenge: [{ nachricht: pdf.nachricht, teil: '99' }] })).status).toBe(404);
  });

  it('Kennzeichen der Gegenseite wandern mit: Art. 18 → Hinweis + kein ZOE-Entwurf (409); Werbesperre gekennzeichnet', async () => {
    await db.saveJson('kontakte', { kontakte: [
      k('c-anna', 'Anna', 'Schmidt', { email: `anna@kunde.${D}`, eingeschraenkt: { seit: '2026-10-01', grund: 'Antrag', von: 'kevin' } } as Partial<Kontakt>),
      k('c-paul', 'Paul', 'Kern', { email: `paul@lieferant.${D}`, werbesperre: { seit: '2026-10-01', grund: 'Widerspruch' } }),
    ] });
    await verbinden();
    const a = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: (await finde('Angebot Müller')).id, an: 'malin' });
    const b = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: (await finde('Unterlagen')).id, an: 'malin' });
    expect(a.status, a.text).toBe(200); expect(b.status, b.text).toBe(200);
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${a.d.id}`, sitzung('malin'))).d.uebergabe.sperre).toBe('eingeschraenkt');
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${b.d.id}`, sitzung('malin'))).d.zeile.sperre).toBe('werbesperre');
    const e = await POST(entwurf, '/api/inbox/entwurf', { uebergabe: a.d.id }, sitzung('malin'));
    expect(e.status).toBe(409);
    expect((await POST(entwurf, '/api/inbox/entwurf', { uebergabe: a.d.id }, sitzung('partner'))).status).toBe(404);
  });

  it('Business-Sicht: keine Kopie aus einem Privat-Postfach, auch nicht in der Suche', async () => {
    await verbinden();
    const r = await POST(uebergaben, '/api/inbox/uebergaben', { aktion: 'uebergeben', gespraech: (await finde(PRIVAT_MARKE)).id, an: 'malin' });
    expect(r.status, r.text).toBe(200);
    expect(((await GET(uebergaben, '/api/inbox/uebergaben?space=business', sitzung('malin'))).d.uebergaben as unknown[]).length).toBe(0);
    expect(((await GET(uebergaben, '/api/inbox/uebergaben?space=privat', sitzung('malin'))).d.uebergaben as unknown[]).length).toBe(1);
    expect((await GET(suche, `/api/inbox/suche?q=${PRIVAT_MARKE}&space=business`, sitzung('malin'))).d.gesamt).toBe(0);
    expect((await GET(suche, `/api/inbox/suche?q=${PRIVAT_MARKE}`, sitzung('partner'))).d.gesamt).toBe(0);
    expect((await GET(uebergaben, `/api/inbox/uebergaben?id=${r.d.id}`, sitzung('partner'))).status).toBe(404);
  });
});

// ── Aufgaben-Vorschläge ─────────────────────────────────────────────────────

describe('Aufgaben-Vorschläge aus Mails: Regelwerk → eigener Stapel → Aufgabe erst per Klick', () => {
  it('legt Vorschläge nur für die Postfach-Person, idempotent je Nachricht, Titel ohne Betreff; Freigabe legt die Aufgabe mit Link an', async () => {
    await verbinden();
    const r = await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'holen' });
    expect(r.status, r.text).toBe(200);
    expect(r.d.gelegt).toBe(3); // Frist (Angebot), Bitte (Vollmacht), Frage (Privat — die Kartei kennt die Absenderin)
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'holen' })).d.gelegt).toBe(0);
    const { lies } = await import('@/lib/zoe/stapel');
    const offen = (await lies('offen')).filter(v => v.bezug?.art === 'inbox');
    expect(offen).toHaveLength(3);
    expect(offen.every(v => v.person === 'kevin')).toBe(true);
    for (const v of offen) expect(v.titel).not.toMatch(/Müller|Vollmacht|Anna|Paul|Hochzeit/);
    const privat = offen.find(v => v.eingabe.space === 'privat')!;
    expect(privat.bereich).toBe('privat');
    const angebot = offen.find(v => /Frist/.test(v.titel))!;
    expect(angebot.bereich).toBe('business');
    // Malin sieht nichts davon, gibt nichts frei; ihr eigener Lauf findet nichts aus Kevins Spiegel.
    const { vorschlaegeFuer } = await import('@/lib/zoe/stapel');
    expect((await vorschlaegeFuer('malin', 'offen')).filter(v => v.bezug?.art === 'inbox')).toHaveLength(0);
    const { INBOX_STAPEL_ART } = await import('@/lib/inbox/aufgaben-vorschlag-server');
    expect(await INBOX_STAPEL_ART.freigeben(angebot, 'malin', {})).toMatchObject({ ok: false, status: 403 });
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'holen' }, sitzung('malin'))).d.gelegt).toBe(0);
    // Kevin gibt frei → Aufgabe mit Frist und Link zurück ins Gespräch.
    const f = await INBOX_STAPEL_ART.freigeben(angebot, 'kevin', {});
    expect(f, JSON.stringify(f)).toMatchObject({ ok: true });
    const { ladeAufgabenSicht } = await import('@/lib/aufgaben/sicht');
    const t = (await ladeAufgabenSicht('kevin')).tasks.find(x => x.title === 'Angebot Müller')!;
    expect(t).toBeTruthy();
    expect(t.dueDate).toBeTruthy();
    expect(t.description).toContain('/os/inbox?offen=im~');
    // Ins dauerhafte Protokoll gehen weder Betreff noch Name noch Mailtext.
    const roh = readdirSync(ordner).filter(n => n.startsWith('zoe-entscheidungen') || n.startsWith('zoe-protokoll'));
    for (const n of roh) {
      const inhalt = JSON.stringify(await db.loadJson(n.replace(/\.json$/, '')));
      expect(inhalt, n).not.toMatch(/Müller|Freitag ein Angebot|Anna Schmidt/);
    }
    expect((await (await import('@/lib/zoe/stapel')).hole(angebot.id))?.status).toBe('freigegeben');
  });

  it('Schalter „automatisch“ nur für sich selbst; Takt respektiert ihn; Dienstweg und fremder Haushalt 403', async () => {
    await verbinden();
    expect((await GET(vorschlaege, '/api/inbox/vorschlaege')).d).toMatchObject({ ok: true, automatisch: true, offen: 0 });
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'automatisch', an: false })).status).toBe(200);
    const { inboxVorschlaegeImTakt } = await import('@/lib/inbox/aufgaben-vorschlag-server');
    expect(await inboxVorschlaegeImTakt(new Date(Date.now() + 3600_000))).toBe(0);
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'automatisch', an: true })).status).toBe(200);
    expect(await inboxVorschlaegeImTakt(new Date(Date.now() + 2 * 3600_000))).toBe(3);
    expect((await GET(vorschlaege, '/api/inbox/vorschlaege')).d.offen).toBe(3);
    expect((await GET(vorschlaege, '/api/inbox/vorschlaege', sitzung('malin'))).d).toMatchObject({ automatisch: true, offen: 0 });
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'holen' }, dienst('kevin'))).status).toBe(403);
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'holen' }, sitzung('fremd'))).status).toBe(403);
    expect((await GET(vorschlaege, '/api/inbox/vorschlaege', sitzung('fremd'))).status).toBe(403);
    expect((await POST(vorschlaege, '/api/inbox/vorschlaege', { aktion: 'automatisch', an: 'ja' })).status).toBe(400);
    // Der Merker trägt nur Fingerabdrücke — keine Kennung, kein Betreff.
    const s = JSON.stringify(await db.loadJson('inbox-vorschlaege--kevin'));
    expect(s).not.toMatch(/pf-|Müller|example\.invalid/);
  });
});
