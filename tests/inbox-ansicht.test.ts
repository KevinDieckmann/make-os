// Inbox — Ansicht & Ordnung (09.10.): Bereichs-Leiste, Etiketten, Tag-Gruppen, „Neueste zuerst“, Postfach ohne Bereich.
// Kevin 09.10.: „Ich muss mir die Inbox und die Nachrichten, die da gekommen sind, auch ansehen können — sortiert … die Labels zu den
// einzelnen Bereichen.“ — Befund live: Gmail verbunden, aber ohne Bereich → in `?space=business` „Verbinde dein erstes Postfach“.
// Rein: lib/inbox/ansicht.ts + `imBereich`/`waehlbareBereiche`. Route (Wächter „Sicht X bekommt nichts aus Y“): Business bekommt keine
// Nachricht aus Privat und keine aus einem Postfach ohne Bereich — nur „unzugeordnet: Name + maskierte Adresse“; `space` und `bereich`
// gelten zugleich; eine andere Person sieht nichts. Erfundene Daten (@example.invalid), kein Netz.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { rmSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { bereichFarbe, bereicheAus, fuerZeigen, istBereichKennung, leisteBauen, nachTagen, ruheText, tagGruppe, zaehltInLeiste } from '@/lib/inbox/ansicht';
import { imBereich, waehlbareBereiche } from '@/lib/inbox/strom-server';
import { EINHEIT_FARBE, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { MANDANT_FARBE, PRIVAT_FARBE } from '@/lib/aufgaben/struktur';

// Datenordner VOR allen Imports (strom-server lädt local-db).
const ordner = await vi.hoisted(async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const p = await import('node:path');
  const o = fs.mkdtempSync(p.join(os.tmpdir(), 'make-os-inbox-ansicht-'));
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: o, MAKE_OS_DATEN_SCHLUESSEL: 'pruef-datenschluessel-inbox-ansicht', MAKE_OS_KEY: 'dienst-test-inbox-ansicht',
    MAKE_OS_PEPPER: 'pruef-pepper-inbox-ansicht-0123456789',
  });
  return o;
});

const D = 'example.invalid';
const GMAIL_ADRESSE = `kevin@firma.${D}`;

// Gmail ist für „kevin“ verbunden (für niemanden sonst) — ohne Netz: Status und „bereit“ nachgebaut, der Spiegel liegt im Testordner.
vi.mock('@/lib/google/verbindung', async orig => ({
  ...(await orig<typeof import('@/lib/google/verbindung')>()),
  googleStatus: async (person: string) => (person === 'kevin'
    ? { konfiguriert: true, verbunden: true, konto: `k***@firma.${D}`, funktionen: ['kalender', 'gmail'], bereit: ['kalender', 'gmail'], erlaubteDomain: null }
    : { konfiguriert: true, verbunden: false, funktionen: [], bereit: [], erlaubteDomain: null }),
  googleAdresse: async (person: string) => (person === 'kevin' ? GMAIL_ADRESSE : null),
}));
vi.mock('@/lib/gmail/abgleich', async orig => ({
  ...(await orig<typeof import('@/lib/gmail/abgleich')>()),
  gmailBereit: async (person: string) => person === 'kevin',
}));

describe('rein: Bereichs-Kennungen, Farben, Leiste', () => {
  it('Kennung generisch (privat, Gesellschaft, g-…, Kunde) — aber nie Pfad- oder Steuerzeichen', () => {
    for (const b of ['privat', 'kdv', 'ug', 'g-firma-neu1', 'm-firma-x']) expect(istBereichKennung(b), b).toBe(true);
    for (const b of ['', '../x', 'A', 'privat/x', 'x y', '~alle', `a${'b'.repeat(80)}`]) expect(istBereichKennung(b), b).toBe(false);
    expect(bereicheAus('kdv,ug,kdv')).toEqual(['kdv', 'ug']);
    expect(bereicheAus('kdv,../x')).toBeNull();
    expect(bereicheAus(Array.from({ length: 31 }, (_, i) => `b${i}`).join(','))).toBeNull();
  });
  it('Farben nur aus den vorhandenen Quellen (Privat, Kern-Einheiten, Mandanten) — Unbekanntes ruhig grau', () => {
    expect(bereichFarbe('privat')).toBe(PRIVAT_FARBE);
    expect(bereichFarbe('ug')).toBe(EINHEIT_FARBE.ug);
    expect(bereichFarbe('kdv')).toBe(EINHEIT_FARBE.kdv);
    expect(bereichFarbe('m-firma-x')).toBe(MANDANT_FARBE);
    expect(bereichFarbe('g-firma-neu1')).toBe(EINHEIT_GRAU);
    expect(bereichFarbe(null)).toBe(EINHEIT_GRAU);
  });
  it('Leiste: je Bereich ein Eintrag mit Postfächern; Ungelesen/offen zählen nur Gespräche in Arbeit, nie Rundschreiben; Business vor Privat, ohne Bereich zuletzt', () => {
    const l = leisteBauen(
      [
        { id: 'pf-p', bereich: 'privat', anzeigename: 'Privat', quelle: 'imap' },
        { id: 'pf-u1', bereich: 'ug', anzeigename: 'Postfach A', quelle: 'imap' },
        { id: 'gmail', bereich: null, anzeigename: 'Google Workspace', quelle: 'gmail' },
        { id: 'pf-u2', bereich: 'ug', anzeigename: 'Postfach B', quelle: 'whatsapp' },
        { id: 'pf-k', bereich: 'kdv', anzeigename: 'Postfach C', quelle: 'imap' },
      ],
      [
        { postfachId: 'pf-u1', bereich: 'ug', ungelesen: true, inArbeit: true, fach: 'antworten' },
        { postfachId: 'pf-u2', bereich: 'ug', ungelesen: false, inArbeit: true, fach: 'termine' },
        { postfachId: 'pf-u1', bereich: 'ug', ungelesen: true, inArbeit: true, fach: 'info' },
        { postfachId: 'pf-u1', bereich: 'ug', ungelesen: true, inArbeit: false, fach: 'antworten' },
        { postfachId: 'pf-p', bereich: 'privat', ungelesen: true, inArbeit: true, fach: 'neu' },
        { postfachId: 'pf-x', bereich: 'g-fremd', ungelesen: true, inArbeit: true, fach: 'antworten' },
      ],
      b => (b === null ? 'Ohne Bereich' : b === 'privat' ? 'Privat' : b.toUpperCase()),
    );
    expect(l.map(e => e.id)).toEqual(['kdv', 'ug', 'privat', null]);
    expect(l.find(e => e.id === 'ug')).toMatchObject({ ungelesen: 1, offen: 2, farbe: EINHEIT_FARBE.ug, postfaecher: [{ id: 'pf-u1' }, { id: 'pf-u2' }] });
    expect(l.find(e => e.id === 'privat')).toMatchObject({ ungelesen: 1, offen: 1 });
    expect(l.some(e => e.id === 'g-fremd')).toBe(false); // nur Bereiche mit Postfächern DER SICHT
    expect(zaehltInLeiste({ inArbeit: true, fach: 'geblockt' })).toBe(false);
  });
});

describe('rein: Tag-Gruppen und „Neueste zuerst“', () => {
  const heute = '2026-10-09'; // Freitag
  it('Heute · Gestern · Diese Woche (ab Montag) · Älter — nach Berliner Tag', () => {
    expect(tagGruppe('2026-10-09T05:00:00Z', heute)).toBe('heute');
    expect(tagGruppe('2026-10-08T22:30:00Z', heute)).toBe('heute'); // 00:30 Berliner Zeit am 09.10.
    expect(tagGruppe('2026-10-08T21:30:00Z', heute)).toBe('gestern'); // 23:30 am 08.10.
    expect(tagGruppe('2026-10-05T08:00:00Z', heute)).toBe('woche'); // Montag
    expect(tagGruppe('2026-10-04T08:00:00Z', heute)).toBe('aelter'); // Sonntag davor
    expect(tagGruppe('2026-10-10T08:00:00Z', heute)).toBe('heute'); // Uhr daneben: zählt als heute
    // Montag: „gestern“ (Sonntag) geht vor, „Diese Woche“ ist leer.
    expect(tagGruppe('2026-10-11T08:00:00Z', '2026-10-12')).toBe('gestern');
    expect(tagGruppe('2026-10-10T08:00:00Z', '2026-10-12')).toBe('aelter');
  });
  it('in jeder Gruppe ungelesen zuerst, dann neueste; leere Gruppen fallen weg', () => {
    const g = (id: string, am: string, ungelesen = false) => ({ id, am, ungelesen });
    const r = nachTagen([g('a', '2026-10-09T07:00:00Z'), g('b', '2026-10-09T06:00:00Z', true), g('c', '2026-10-09T09:00:00Z'), g('d', '2026-09-01T09:00:00Z', true)], heute);
    expect(r.map(x => x.id)).toEqual(['heute', 'aelter']);
    expect(r[0].liste.map(x => x.id)).toEqual(['b', 'c', 'a']);
    expect(r[0].titel).toBe('Heute');
  });
  it('Offen · Ungelesen · Auch Erledigtes — geblockte nie; Ruhe-Text sagt, warum eine Zeile nicht in Arbeit ist', () => {
    const l = [
      { id: '1', inArbeit: true, ungelesen: true, fach: 'antworten' },
      { id: '2', inArbeit: true, ungelesen: false, fach: 'warten' },
      { id: '3', inArbeit: false, ungelesen: false, fach: 'antworten' },
      { id: '4', inArbeit: true, ungelesen: true, fach: 'geblockt' },
    ];
    expect(fuerZeigen(l, 'offen').map(x => x.id)).toEqual(['1', '2']);
    expect(fuerZeigen(l, 'ungelesen').map(x => x.id)).toEqual(['1']);
    expect(fuerZeigen(l, 'alle').map(x => x.id)).toEqual(['1', '2', '3']);
    expect(ruheText({ inArbeit: true })).toBeNull();
    expect(ruheText({ inArbeit: false, wiedervorlage: '2026-10-14' })).toBe('ruht bis 14.10.');
    expect(ruheText({ inArbeit: false, verjaehrt: true })).toBe('keine Antwort mehr erwartet');
    expect(ruheText({ inArbeit: false })).toBe('erledigt');
  });
});

describe('rein: EINE Filterstelle — space und bereich zugleich', () => {
  it('space=business mit bereich=privat → nichts (der Bereich überstimmt die Sicht nie); ohne Bereich nur ohne space', () => {
    expect(imBereich('privat', { space: 'business', bereich: 'privat' })).toBe(false);
    expect(imBereich('kdv', { space: 'business', bereich: 'kdv' })).toBe(true);
    expect(imBereich('ug', { space: 'business', bereich: 'kdv' })).toBe(false);
    expect(imBereich(null, { space: 'business' })).toBe(false);
    expect(imBereich(null, { space: 'privat' })).toBe(false);
    expect(imBereich(null, {})).toBe(true);
  });
  it('„Alle“ mit ausgeblendeten Bereichen (`ohne`): Ausschluss — ein neuer Bereich erscheint sofort; ohne Bereich bleibt sichtbar', () => {
    expect(imBereich('privat', { ohne: ['privat'] })).toBe(false);
    expect(imBereich('g-firma-neu1', { ohne: ['privat'] })).toBe(true);
    expect(imBereich(null, { ohne: ['privat'] })).toBe(true);
    expect(imBereich('kdv', { space: 'business', ohne: ['kdv'] })).toBe(false);
  });
  it('wählbare Bereiche je Sicht — Business bietet nie Privat an', () => {
    const namen = { kdc: 'Einheit C', kdv: 'Einheit V', ug: 'Einheit U', 'g-firma-neu1': 'Neue Firma' };
    expect(waehlbareBereiche(namen, 'business').map(b => b.id)).toEqual(['kdv', 'ug', 'g-firma-neu1']);
    expect(waehlbareBereiche(namen, 'privat').map(b => b.id)).toEqual(['privat', 'kdc']);
    expect(waehlbareBereiche(namen).map(b => b.id)).toEqual(['privat', 'kdc', 'kdv', 'ug', 'g-firma-neu1']);
  });
});

// ── Route: Wächter „Sicht X bekommt nichts aus Y“ ───────────────────────────

type R = { GET?: (r: Request) => Promise<Response>; POST?: (r: Request) => Promise<Response> };
let inbox: R, postfaecher: R, suche: R;
let db: typeof import('@/lib/store/local-db');
const sitzung = (person: string) => ({ 'x-make-user': person, 'content-type': 'application/json' });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const j = async (r: Response) => ({ status: r.status, text: await r.clone().text(), d: await r.json().catch(() => ({})) as Record<string, any> });
const GET = (route: R, url: string, h: Record<string, string> = sitzung('kevin')) => route.GET!(new Request(`http://localhost${url}`, { headers: h })).then(j);
const POST = (route: R, url: string, body: unknown, h: Record<string, string> = sitzung('kevin')) => route.POST!(new Request(`http://localhost${url}`, { method: 'POST', headers: h, body: JSON.stringify(body) })).then(j);

const PF_PRIVAT = 'pf-00000000-0000-4000-8000-000000000001';
const PF_KDV = 'pf-00000000-0000-4000-8000-000000000002';
const KONTEN = { konten: [
  { id: 'k1', speicher: 'kevin', email: `kevin@${D}`, name: 'Kevin Beispiel', rolle: 'inhaber', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
  { id: 'k2', speicher: 'malin', email: `malin@${D}`, name: 'Malin Beispiel', rolle: 'mitglied', hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'h' },
], einladungen: [] };
const jetzt = new Date().toISOString();
const kopf = (id: string, betreff: string, von: string, extra: Record<string, unknown> = {}) => ({
  id, threadId: `t${id.replace(/\W/g, '')}`, am: jetzt, von: { email: von, name: 'Absender' }, an: [], cc: [], betreff, ausschnitt: `${betreff} – Text`,
  labels: ['INBOX', 'UNREAD'], anhaenge: [], messageId: `<${id.replace(/\W/g, '')}@${D}>`, ...extra,
});

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  inbox = await import('../app/api/inbox/route') as R;
  postfaecher = await import('../app/api/inbox/postfaecher/route') as R;
  suche = await import('../app/api/inbox/suche/route') as R;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

beforeEach(async () => {
  for (const f of readdirSync(ordner)) rmSync(path.join(ordner, f), { recursive: true, force: true });
  db.leseCacheLeeren();
  vi.stubEnv('NEXT_PUBLIC_MAKE_BAU', '');
  vi.stubGlobal('fetch', async () => { throw new Error('kein Netz im Test'); });
  await db.saveJson('konten', KONTEN);
  await db.saveJson('kontakte', { kontakte: [] });
  await db.saveJson('crm', { firmen: [], chancen: [], mandate: [], followups: [], kampagnen: [], events: [], beitraege: [], teilnahmen: [] });
  // Zwei IMAP-Postfächer (Privat, KD-Ventures-Bereich) + Gmail verbunden OHNE Register-Eintrag (= ohne Bereich, wie live am 09.10.).
  await db.saveJson('postfaecher--kevin', { v: 1, postfaecher: [
    { id: PF_PRIVAT, quelle: 'imap', bereich: 'privat', anzeigename: 'Privat · Post', adresse: `kevin.privat@${D}`, angelegtAm: '2026-10-01' },
    { id: PF_KDV, quelle: 'imap', bereich: 'kdv', anzeigename: 'Beteiligung · Post', adresse: `kevin.kdv@${D}`, angelegtAm: '2026-10-01' },
  ] });
  await db.saveJson('imap-stand--kevin', { v: 1, person: 'kevin', postfaecher: { [PF_PRIVAT]: { ordner: {}, at: jetzt }, [PF_KDV]: { ordner: {}, at: jetzt } }, koepfe: {
    [`${PF_PRIVAT}:e:1:1`]: { ...kopf(`${PF_PRIVAT}:e:1:1`, 'PRIVAT-Geburtstag', `freundin@privat.${D}`), postfachId: PF_PRIVAT, ordner: 'e', uidValidity: '1', uid: 1, wurzel: `<p1@${D}>`, labels: ['UNREAD'] },
    [`${PF_KDV}:e:1:1`]: { ...kopf(`${PF_KDV}:e:1:1`, 'KDV-Beteiligung', `partner@fonds.${D}`), postfachId: PF_KDV, ordner: 'e', uidValidity: '1', uid: 1, wurzel: `<k1@${D}>`, labels: ['UNREAD'] },
  } });
  await db.saveJson('gmail-stand--kevin', { v: 1, person: 'kevin', email: GMAIL_ADRESSE, at: jetzt, koepfe: {
    g1: kopf('g1', 'GMAIL-Vertraulich-Angebot', `kunde@kunde.${D}`),
  } });
});

describe('Route: Postfach ohne Bereich und die Trennung der Sichten', () => {
  it('Business bekommt KEINE Nachricht aus Privat und keine aus dem Postfach ohne Bereich — nur „unzugeordnet“ mit maskierter Adresse', async () => {
    const b = await GET(inbox, '/api/inbox?space=business');
    expect(b.status).toBe(200);
    expect(b.d.postfaecher.map((p: { id: string }) => p.id)).toEqual([PF_KDV]);
    expect(b.text).toContain('KDV-Beteiligung');
    expect(b.text).not.toContain('PRIVAT-Geburtstag');
    expect(b.text).not.toContain('GMAIL-Vertraulich-Angebot');
    expect(b.text).not.toContain(`kunde@kunde.${D}`);
    expect(b.text).not.toContain('freundin@');
    expect(b.text).not.toContain(GMAIL_ADRESSE); // nur maskiert
    expect(b.d.unzugeordnet).toEqual([{ id: 'gmail', quelle: 'gmail', anzeigename: 'Google Workspace', adresse: `k***@firma.${D}`, nachrichten: 1 }]);
    expect(b.d.leiste.map((e: { id: string | null }) => e.id)).toEqual(['kdv']);
    expect(b.d.leiste[0]).toMatchObject({ ungelesen: 1, offen: 1, postfaecher: [{ id: PF_KDV }] });
    expect(b.d.waehlbar.map((w: { id: string }) => w.id)).not.toContain('privat');
    expect(b.d.waehlbar.map((w: { id: string }) => w.id)).toContain('ug');
  });
  it('Privat bekommt nur Privates; das unzugeordnete Postfach steht auch hier — ohne Nachricht', async () => {
    const p = await GET(inbox, '/api/inbox?space=privat');
    expect(p.text).toContain('PRIVAT-Geburtstag');
    expect(p.text).not.toContain('KDV-Beteiligung');
    expect(p.text).not.toContain('GMAIL-Vertraulich-Angebot');
    expect(p.d.unzugeordnet.map((u: { id: string }) => u.id)).toEqual(['gmail']);
    expect(p.d.leiste.map((e: { id: string | null }) => e.id)).toEqual(['privat']);
    expect(p.d.waehlbar.every((w: { id: string }) => w.id === 'privat' || w.id === 'kdc')).toBe(true);
  });
  it('space und bereich gelten zugleich: ?space=business&bereich=privat liefert NICHTS; Postfach-Filter nur im Bereich', async () => {
    const x = await GET(inbox, '/api/inbox?space=business&bereich=privat');
    expect(x.status).toBe(200);
    expect(x.d.gespraeche).toEqual([]);
    expect(x.text).not.toContain('PRIVAT-Geburtstag');
    expect((await GET(inbox, `/api/inbox?bereich=kdv&postfach=${PF_PRIVAT}`)).d.gespraeche).toEqual([]);
    expect((await GET(inbox, `/api/inbox?bereich=kdv&postfach=${PF_KDV}`)).text).toContain('KDV-Beteiligung');
    expect((await GET(inbox, '/api/inbox?postfach=../x')).status).toBe(400);
    expect((await GET(inbox, '/api/inbox?bereich=../x')).status).toBe(400);
  });
  it('„Alle“: alles Eigene samt Postfach ohne Bereich; die Leiste nennt es zuletzt; `ohne` blendet Bereiche serverseitig aus', async () => {
    const a = await GET(inbox, '/api/inbox');
    for (const t of ['PRIVAT-Geburtstag', 'KDV-Beteiligung', 'GMAIL-Vertraulich-Angebot']) expect(a.text).toContain(t);
    expect(a.d.leiste.map((e: { id: string | null }) => e.id)).toEqual(['kdv', 'privat', null]);
    const o = await GET(inbox, '/api/inbox?ohne=privat');
    expect(o.text).not.toContain('PRIVAT-Geburtstag');
    expect(o.text).toContain('KDV-Beteiligung');
    expect(o.d.leiste.map((e: { id: string | null }) => e.id)).toEqual(['kdv', 'privat', null]); // die Leiste bleibt vollständig
    expect((await GET(inbox, '/api/inbox?ohne=../x')).status).toBe(400);
    expect((await GET(suche, '/api/inbox/suche?q=Geburtstag&ohne=privat')).d.gesamt).toBe(0);
    expect((await GET(suche, '/api/inbox/suche?q=Geburtstag')).d.gesamt).toBe(1);
    expect((await GET(suche, '/api/inbox/suche?q=Geburtstag&space=business&bereich=privat')).d.gesamt).toBe(0);
  });
  it('„jetzt zuordnen“ über den vorhandenen Schreibweg: danach steht die Gmail-Post unter dem Bereich, nichts mehr unzugeordnet', async () => {
    const r = await POST(postfaecher, '/api/inbox/postfaecher', { aktion: 'einstellen', id: 'gmail', bereich: 'ug' });
    expect(r.status, r.text).toBe(200);
    db.leseCacheLeeren();
    const b = await GET(inbox, '/api/inbox?space=business');
    expect(b.text).toContain('GMAIL-Vertraulich-Angebot');
    expect(b.d.unzugeordnet).toEqual([]);
    expect(b.d.waehlbar).toEqual([]);
    expect(b.d.leiste.map((e: { id: string | null }) => e.id)).toEqual(['kdv', 'ug']);
    const u = await GET(inbox, '/api/inbox?space=business&bereich=ug');
    expect(u.text).toContain('GMAIL-Vertraulich-Angebot');
    expect(u.text).not.toContain('KDV-Beteiligung');
    expect((await GET(inbox, '/api/inbox?space=privat')).text).not.toContain('GMAIL-Vertraulich-Angebot');
  });
  it('eine andere Person sieht weder Kevins Postfächer noch sein unzugeordnetes Gmail', async () => {
    const m = await GET(inbox, '/api/inbox', sitzung('malin'));
    expect(m.status).toBe(200);
    expect(m.d.gespraeche).toEqual([]);
    expect(m.d.unzugeordnet).toEqual([]);
    expect(m.d.leiste).toEqual([]);
    expect(m.text).not.toContain('k***@firma');
  });
});
