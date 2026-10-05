// ─── Betroffenenrechte v2 (05.10.) — Wächter für jedes Recht ─────────────────────────────────────────────────────
// Art. 15 vollständig (Kontakt + Konto, Angaben a–h, alle Empfänger aus dem Register, HTML), Art. 20/17 je Konto (Export, Löschen mit
// Passwort/zweitem Faktor, kein Personenbezug außer Grabstein/Protokoll, Restore holt nichts zurück), Instanz-Export nur Inhaber,
// Art. 14 (Vorlage, Entwurf, „ist raus“, Frist in der Selbstprüfung), Buchungsseiten (Verantwortlicher aus der Einrichtung, Link),
// Abmeldelink (verrät nie, ob die Adresse existiert), Speicher-Register (anmeldungen 12 Monate, jedes `--*` eingeordnet), Löschskript.
// Eigener Datenordner, erfundene Konten und Daten (@example.invalid) — nie der echte Bestand.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-betroffenenrechte-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-betroffenenrechte';
process.env.MAKE_OS_PEPPER = 'pruef-pepper-betroffenenrechte-0123456789abcdef';
process.env.MAKE_OS_ADRESSE = 'https://instanz.example.invalid';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_GRABSTEINE_DIR;

type Handler = (r: Request, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Route = { GET?: Handler; POST?: Handler };
type Kontakt = import('@/lib/make-one/crm').Kontakt;

const HAUS = 'haus';
const PW = 'TESTPASSWORT-nur-fuer-den-test';
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const req = (pfad: string, kopf: Record<string, string>, method = 'GET', body?: unknown) => new Request(`http://test${pfad}`, { method, headers: kopf, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

let db: typeof import('@/lib/store/local-db');
let K: typeof import('@/lib/zugang/konten');
let totp: typeof import('@/lib/zugang/totp');
let drossel: typeof import('@/lib/zugang/drossel');
let kette: typeof import('@/lib/store/protokoll-kette');
let lese: typeof import('@/lib/store/leseprotokoll');
let art15: typeof import('@/lib/datenschutz/art15');
let art14: typeof import('@/lib/datenschutz/art14');
let ab: typeof import('@/lib/datenschutz/abmelden');
let kd: typeof import('@/lib/datenschutz/konto-daten');
let ein: typeof import('@/lib/datenschutz/einrichtung');
let kontoDaten: Route, instanz: Route, crmDs: Route, abmelden: Route;

const GEHEIM = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const konto = async (id: string, speicher: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) => ({
  id, speicher, email: `${speicher}@example.invalid`, name: `${speicher[0].toUpperCase()}${speicher.slice(1)} Probe`, rolle, ...(await K.passwortHashen(PW)),
  angelegt: '2026-01-01', teilt: { gesundheit: [] as string[] }, haushalt: HAUS, ...extra,
});
const person = (id: string, x: Partial<Kontakt> = {}): Kontakt => ({ id, vorname: 'Gerda', nachname: 'Fremd', eignung: '', prio: '', stufe: 'neu', aktivitaeten: [], importiertAm: '2026-09-01', geaendertAm: '2026-09-01', ...x });
const EINRICHTUNG = {
  verantwortlicher: { name: 'Beispiel GmbH', anschrift: 'Weg 1\n12345 Ort', mail: 'datenschutz@example.invalid', seite: 'example.invalid/datenschutz', aufsicht: 'Landesbeauftragte für Datenschutz (Beispiel)' },
  empfaenger: [
    { id: 'hosting', name: 'Hoster EU', rolle: 'auftragsverarbeiter', zweck: 'Server', daten: 'alles', drittland: '', garantie: 'eu', avv: { status: 'offen' }, dritte: true },
    { id: 'ki-usa', name: 'KI-Anbieter USA', rolle: 'auftragsverarbeiter', zweck: 'KI', daten: 'Ausschnitte', drittland: 'USA', garantie: 'dpf-scc', avv: { status: 'offen' }, dritte: true },
    { id: 'bote', name: 'Bote ohne Dritte', rolle: 'eigener-verantwortlicher', zweck: 'Hinweise', daten: 'Chat-Kennung', drittland: 'außerhalb der EU', garantie: 'keine', avv: { status: 'nicht-noetig' }, dritte: false },
    { id: 'alt', name: 'Archivierter Dienst', rolle: 'auftragsverarbeiter', zweck: 'früher', daten: 'x', drittland: '', garantie: 'eu', avv: { status: 'offen' }, dritte: true, archiviert: true },
  ],
};

/** Alle Dateien (rekursiv) unter dem Datenordner, ohne die Tagessicherungen in backup/ (Sicherung mit eigener Frist). */
function dateien(d = ordner): string[] {
  const raus: string[] = [];
  for (const n of readdirSync(d)) {
    const p = path.join(d, n);
    if (statSync(p).isDirectory()) { if (n !== 'backup') raus.push(...dateien(p)); }
    else raus.push(p);
  }
  return raus;
}

beforeAll(async () => {
  db = await import('@/lib/store/local-db');
  K = await import('@/lib/zugang/konten');
  totp = await import('@/lib/zugang/totp');
  drossel = await import('@/lib/zugang/drossel');
  kette = await import('@/lib/store/protokoll-kette');
  lese = await import('@/lib/store/leseprotokoll');
  art15 = await import('@/lib/datenschutz/art15');
  art14 = await import('@/lib/datenschutz/art14');
  ab = await import('@/lib/datenschutz/abmelden');
  kd = await import('@/lib/datenschutz/konto-daten');
  ein = await import('@/lib/datenschutz/einrichtung');
  await db.saveJson('konten', { konten: [
    await konto('k-chef', 'chef', 'inhaber'),
    await konto('k-lena', 'lena', 'mitglied', { zweiterFaktor: { geheimnis: GEHEIM, seit: '2026-01-01', wiederherstellung: [] } }),
    await konto('k-mira', 'mira', 'mitglied', { teilt: { gesundheit: ['lena'] } }),
  ], einladungen: [{ code: 'x', von: 'lena', bis: '2099-01-01' }] });
  await db.saveJson('datenschutz-einrichtung', EINRICHTUNG);
  await db.saveJson('crm', (await import('@/lib/crm/speicher')).leererBestand());
  await db.saveJson('kontakte', { kontakte: [
    person('c-gerda', { email: 'gerda@example.invalid', fremddaten: true, herkunft: 'recherche', quelle: 'Branchenliste', importiertAm: '2026-08-20' }),
    person('c-ohne', { vorname: 'Otto', nachname: 'Ohnemail', fremddaten: true, herkunft: 'empfehlung', importiertAm: '2026-10-01' }),
    person('c-news', { vorname: 'Nora', nachname: 'News', email: 'nora@example.invalid', emails: [{ adresse: 'nora@example.invalid' }, { adresse: 'nora.privat@example.invalid' }] as Kontakt['emails'],
      einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'DOI' }] }),
  ] });
  // Persönliche Bestände (lena, mira) und geteilte Bestände mit Einträgen je Person.
  await db.saveJson('vitals--lena', { tage: [{ tag: '2026-10-01', notiz: 'Lena Probe schlief gut' }] });
  await db.saveJson('journal--lena', { eintraege: [{ text: 'Mein Tag, lena@example.invalid' }] });
  await db.saveJson('meldungen--lena', { eintraege: [{ titel: 'Hallo Lena Probe' }] });
  await db.saveJson('vitals--mira', { tage: [{ tag: '2026-10-01' }] });
  await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g1', person: 'lena', titel: 'Lena fragt', nachrichten: [] }, { id: 'g2', person: 'mira', titel: 'Mira fragt', nachrichten: [] }] });
  await db.saveJson('telegram', { kopplungen: [{ chatId: 1, person: 'lena', seit: '2026-01-01', name: 'Lena Probe' }, { chatId: 2, person: 'mira', seit: '2026-01-01' }], codes: { ABC: { person: 'lena', bis: '2099-01-01' } } });
  await db.saveJson('ki-einstellungen', { vorgabe: 'kompatibel', festgelegtAm: '2026-01-01', personen: { lena: { hintergrund: false }, mira: { websuche: false } } });
  await db.saveJson('gesundheit-einwilligungen', { ereignisse: [{ zeit: '2026-09-01T10:00:00.000Z', person: 'lena', zweck: 'verarbeiten', an: true, fassung: '1', wortlaut: 'abc', von: 'lena' }] });
  await db.saveJson('tasks', { tasks: [{ id: 't1', title: 'privat', assignee: 'lena', sichtbarkeit: 'nur-ich', angelegtVon: 'lena' }, { id: 't2', title: 'Team-Aufgabe', assignee: 'lena', angelegtVon: 'chef' }] });
  await db.saveJson(`team--${HAUS}`, { team: [{ id: 'konto-lena', rolle: 'Vertrieb' }, { id: 'konto-mira', rolle: 'Marketing' }] });
  await kette.anhaengenVerkettet(`leseprotokoll--${HAUS}--2026-10`, [{ at: '2026-10-01T09:00:00.000Z', wer: 'person', person: 'lena', bereich: 'gesundheit', betroffen: 'lena' }, { at: '2026-10-01T09:05:00.000Z', wer: 'person', person: 'mira', bereich: 'kontakte' }]);
  await kette.anhaengenVerkettet(`aenderungsprotokoll--${HAUS}--2026-10`, [{ at: '2026-10-01T09:00:00.000Z', wer: 'person', person: 'lena', bestand: 'tasks', op: 'neu', id: 't1' }]);
  await kette.anhaengenVerkettet('anmeldungen', [{ zeit: new Date().toISOString(), speicher: 'lena', art: 'anmelden', ok: true, adresse: '10.0.0.x' }]);
  kontoDaten = (await import('@/app/api/konto/daten/route')) as Route;
  instanz = (await import('@/app/api/datenschutz/instanz-export/route')) as Route;
  crmDs = (await import('@/app/api/crm/datenschutz/route')) as Route;
  abmelden = (await import('@/app/api/abmelden/[token]/route')) as unknown as Route;
});
afterAll(() => { rmSync(ordner, { recursive: true, force: true }); });

// ── Art. 15 ─────────────────────────────────────────────────────────────────────

describe('Art. 15 — Angaben a–h (rein)', () => {
  it('Kontakt-Auskunft nennt ALLE Empfänger aus dem Register mit Daten Dritter (Drittland + Garantie), Konto-Auskunft alle in Gebrauch', () => {
    const liste = EINRICHTUNG.empfaenger as unknown as import('@/lib/datenschutz/einrichtung').Empfaenger[];
    const a = art15.art15Angaben({ art: 'kontakt', verantwortlicher: null, empfaenger: liste, verarbeitungen: [], sicherungen: 's', herkunft: [] });
    expect(a.empfaenger.map(e => e.name)).toEqual(liste.filter(e => !e.archiviert && e.dritte).map(e => e.name));
    expect(a.empfaenger.find(e => e.name === 'KI-Anbieter USA')).toMatchObject({ drittland: 'USA', garantie: expect.stringContaining('Standardvertragsklauseln') });
    const k = art15.art15Angaben({ art: 'konto', verantwortlicher: null, empfaenger: liste, verarbeitungen: [], sicherungen: 's', herkunft: [] });
    expect(k.empfaenger.map(e => e.name)).toEqual(liste.filter(e => !e.archiviert).map(e => e.name));
    // Vorgabe-Liste: jeder Eintrag in Gebrauch mit `dritte` steht in der Kontakt-Auskunft.
    const s = art15.art15Angaben({ art: 'kontakt', verantwortlicher: null, empfaenger: ein.EMPFAENGER_START, verarbeitungen: [], sicherungen: 's', herkunft: [] });
    expect(s.empfaenger.length).toBe(ein.EMPFAENGER_START.filter(e => !e.archiviert && e.dritte).length);
  });
  it('Rechte (Berichtigung, Löschung, Einschränkung, Widerspruch), Beschwerde, Herkunft, automatisierte Entscheidungen ehrlich', () => {
    const a = art15.art15Angaben({ art: 'kontakt', verantwortlicher: { name: 'X', anschrift: 'Y', mail: 'z@example.invalid', aufsicht: 'Behörde Z' }, empfaenger: [], verarbeitungen: [], sicherungen: 's', herkunft: ['aus einer Liste'] });
    const rechte = a.rechte.map(r => r.norm).join(' ');
    for (const n of ['Art. 15', 'Art. 16', 'Art. 17', 'Art. 18', 'Art. 20', 'Art. 21', 'Art. 7 Abs. 3']) expect(rechte).toContain(n);
    expect(a.beschwerde).toMatchObject({ text: expect.stringContaining('Art. 77'), behoerde: 'Behörde Z' });
    expect(a.herkunft).toEqual(['aus einer Liste']);
    expect(a.automatisiert.art22).toBe(false);
    expect(a.automatisiert.verfahren.map(v => v.name).join(' ')).toMatch(/Lead-Score.*KI-Auswertung/);
  });
  it('Verarbeitungen je Bereich: Buchung nur, wenn Buchungen da sind', () => {
    expect(art15.verarbeitungenFuer('kontakt', [])).not.toContain('vv-buchung');
    expect(art15.verarbeitungenFuer('kontakt', art15.kontaktBereiche({ buchungen: [{ id: 'b' }] }))).toContain('vv-buchung');
  });
  it('HTML ist escaped und ohne Skripte', () => {
    const a = art15.art15Angaben({ art: 'kontakt', verantwortlicher: null, empfaenger: [], verarbeitungen: [], sicherungen: 's', herkunft: [] });
    const h = art15.auskunftHtml({ titel: 'T', erstellt: new Date().toISOString(), angaben: a, daten: { notiz: '<script>alert(1)</script>' } });
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('Verantwortlicher fehlt');
  });
});

describe('Art. 15 — Kontakt-Auskunft (Route)', () => {
  it('JSON mit art15 (alle Empfänger des Registers), Datei ohne Kennung im Namen, Lese-Protokoll', async () => {
    const r = await crmDs.GET!(req('/api/crm/datenschutz?id=c-gerda', sitzung('chef')));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).not.toContain('c-gerda');
    const d = await r.json();
    expect(d.person.email).toBe('gerda@example.invalid');
    expect(d.art15.empfaenger.map((e: { name: string }) => e.name)).toEqual(['Hoster EU', 'KI-Anbieter USA']);
    expect(d.art15.verantwortlich).toMatchObject({ name: 'Beispiel GmbH' });
    expect(d.art15.herkunft.join(' ')).toContain('Branchenliste');
    expect(d.art15.zwecke.length).toBeGreaterThan(0);
    await lese.leseprotokollWarten();
    const monat = new Date().toISOString().slice(0, 7);
    const l = await lese.leseprotokollMonat(HAUS, monat);
    expect(l.some(e => e.bereich === 'kontakte' && e.person === 'chef')).toBe(true);
  });
  it('druckbares HTML mit CSP ohne Skripte; fremder Haushalt → 403', async () => {
    const r = await crmDs.GET!(req('/api/crm/datenschutz?id=c-gerda&format=html', sitzung('chef')));
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
    const t = await r.text();
    expect(t).toContain('h) Automatisierte Entscheidungen');
    expect(t).toContain('KI-Anbieter USA');
    expect((await crmDs.GET!(req('/api/crm/datenschutz?id=c-gerda', sitzung('fremd')))).status).toBe(403);
  });
});

// ── Art. 14 ─────────────────────────────────────────────────────────────────────

describe('Art. 14 — Vorlage, Entwurf, „ist raus“, Frist', () => {
  it('Frist: spätestens 1 Monat; bald ab Tag 25; informiert → keine Uhr; eigene Daten → keine Pflicht', () => {
    expect(art14.einMonatNach('2026-01-31')).toBe('2026-02-28');
    expect(art14.art14Frist({ fremddaten: true, importiertAm: '2026-09-01' }, '2026-09-10')).toMatchObject({ pflicht: true, stufe: 'offen', bis: '2026-10-01' });
    expect(art14.art14Frist({ fremddaten: true, importiertAm: '2026-09-01' }, '2026-09-27')).toMatchObject({ stufe: 'bald' });
    expect(art14.art14Frist({ herkunft: 'recherche', importiertAm: '2026-09-01' }, '2026-10-02')).toMatchObject({ stufe: 'ueberfaellig' });
    expect(art14.art14Frist({ fremddaten: true, importiertAm: '2026-09-01', art14InformiertAm: '2026-09-05' }, '2026-12-01')).toEqual({ pflicht: true, informiertAm: '2026-09-05' });
    expect(art14.art14Frist({ herkunft: 'selbst', importiertAm: '2026-01-01' }, '2026-12-01')).toEqual({ pflicht: false });
  });
  it('Vorlage braucht {{verantwortlicher}} und {{herkunft}}; unbekannte Platzhalter abgelehnt; Füllen lässt nie {{…}} stehen', () => {
    expect(art14.art14VorlagePruefen({ betreff: 'Info', text: 'x'.repeat(50) })).toMatchObject({ ok: false });
    expect(art14.art14VorlagePruefen({ betreff: 'Info', text: `{{verantwortlicher}} {{herkunft}} {{unsinn}} ${'x'.repeat(40)}` })).toMatchObject({ ok: false, fehler: expect.stringContaining('unsinn') });
    expect(art14.art14VorlagePruefen(art14.ART14_STANDARD)).toMatchObject({ ok: true });
    expect(art14.art14Fuellen(art14.ART14_STANDARD, { verantwortlicher: 'X' }).text).not.toMatch(/\{\{/);
  });
  it('Entwurf aus der Einrichtung — versendet nichts; ohne Mail kein mailto; „ist raus“ setzt den Tag (Server) + Verlauf', async () => {
    const e = await (await crmDs.POST!(req('/api/crm/datenschutz', sitzung('chef'), 'POST', { aktion: 'art14-entwurf', id: 'c-gerda' }))).json();
    expect(e.ok).toBe(true);
    expect(e.text).toContain('Beispiel GmbH');
    expect(e.text).toContain('Branchenliste');
    expect(e.text).toContain('KI-Anbieter USA (USA;');
    expect(e.mailto).toMatch(/^mailto:gerda@example\.invalid\?subject=/);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(k => k.id === 'c-gerda')!.art14InformiertAm).toBeUndefined();
    const ohne = await (await crmDs.POST!(req('/api/crm/datenschutz', sitzung('chef'), 'POST', { aktion: 'art14-entwurf', id: 'c-ohne' }))).json();
    expect(ohne).toMatchObject({ ok: true, mailto: null, an: null });
    expect((await crmDs.POST!(req('/api/crm/datenschutz', sitzung('chef'), 'POST', { aktion: 'art14-raus', id: 'c-gerda' }))).status).toBe(200);
    const k = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(x => x.id === 'c-gerda')!;
    expect(k.art14InformiertAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(k.aktivitaeten.at(-1)?.text).toContain('Art. 14');
  });
  it('Selbstprüfung: Frist überschritten → offen, mit „spätestens 1 Monat“', async () => {
    const { selbstpruefung } = await import('@/lib/crm/datenschutz');
    const crm = (await import('@/lib/crm/speicher')).leererBestand();
    const p = selbstpruefung([person('c-x', { fremddaten: true, importiertAm: '2026-08-01' })], crm, '2026-10-05', { konten: 1, mitPasswort: 1 }).find(x => x.id === 'art14')!;
    expect(p.status).toBe('offen');
    expect(p.titel).toContain('1 Monat');
    expect(p.befund).toContain('Frist überschritten');
  });
});

// ── Buchungsseiten ──────────────────────────────────────────────────────────────

describe('Buchungsseiten: Verantwortlicher + Datenschutzhinweis aus der Einrichtung', () => {
  it('Seite ohne eigenen Eintrag ist mit Einrichtung gültig, ohne nicht; öffentliche Sicht nennt Einrichtung und Link', async () => {
    const b = await import('@/lib/kalender/buchung');
    const fest = { id: 'bs-1', slug: 'probe-0123456789abcdef01234567', angelegt: 'x' };
    const roh = { titel: 'Test', person: 'chef', fenster: [{ tage: [1], von: '09:00', bis: '10:00' }], zielKalender: 'K' };
    expect(b.seiteSauber(roh, fest, 'chef', 'j')).toMatchObject({ ok: false });
    const r = b.seiteSauber(roh, fest, 'chef', 'j', { einrichtung: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ds = { verantwortlich: 'Beispiel GmbH, Weg 1, datenschutz@example.invalid', seite: 'example.invalid/datenschutz' };
    expect(b.oeffentlich(r.seite, undefined, ds)).toMatchObject({ verantwortlich: ds.verantwortlich, datenschutzLink: 'https://example.invalid/datenschutz' });
    expect(b.oeffentlich({ ...r.seite, verantwortlich: 'Abweichend AG, a@example.invalid' }, undefined, ds).verantwortlich).toBe('Abweichend AG, a@example.invalid');
    expect(b.datenschutzLink({ verantwortlich: null, seite: 'javascript:alert(1)' })).toBeNull();
  });
});

// ── Konto: Export (Art. 15/20) ─────────────────────────────────────────────────

describe('Konto › Meine Daten — Export', () => {
  it('nur die eigene Person, nie Geheimnisse, eigene Einträge aus geteilten Beständen, alle Empfänger', async () => {
    const r = await kontoDaten.GET!(req('/api/konto/daten', sitzung('lena')));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(Object.keys(d.bestaende)).toEqual(expect.arrayContaining(['vitals--lena', 'journal--lena', 'meldungen--lena']));
    expect(Object.keys(d.bestaende)).not.toContain('vitals--mira');
    const text = JSON.stringify(d);
    expect(text).not.toContain('"hash"');
    expect(text).not.toContain('"salz"');
    expect(text).not.toContain(GEHEIM);
    expect(d.eintraege['zoe-verlauf'].map((g: { id: string }) => g.id)).toEqual(['g1']);
    expect(d.eintraege.telegram).toHaveLength(1);
    expect(d.protokolle.anmeldungen.length).toBeGreaterThan(0);
    expect(d.art15.empfaenger.map((e: { name: string }) => e.name)).toEqual(['Hoster EU', 'KI-Anbieter USA', 'Bote ohne Dritte']);
  });
  it('ohne Sitzung bzw. Dienstweg → 403; HTML druckbar', async () => {
    expect((await kontoDaten.GET!(req('/api/konto/daten', { 'content-type': 'application/json' }))).status).toBe(403);
    expect((await kontoDaten.GET!(req('/api/konto/daten', { 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'lena' }))).status).toBe(403);
    const h = await kontoDaten.GET!(req('/api/konto/daten?format=html', sitzung('mira')));
    expect(h.headers.get('content-type')).toContain('text/html');
    expect(await h.text()).toContain('Meine Daten');
  });
});

// ── Instanz-Export ─────────────────────────────────────────────────────────────

describe('Instanz-Export nur Inhaber', () => {
  it('Mitglied, Dienstweg, falsches Passwort → 403; Inhaber mit Passwort → alles entschlüsselt + Lese-Protokoll', async () => {
    drossel._zuruecksetzen();
    expect((await instanz.POST!(req('/api/datenschutz/instanz-export', sitzung('mira'), 'POST', { passwort: PW }))).status).toBe(403);
    expect((await instanz.GET!(req('/api/datenschutz/instanz-export', sitzung('mira')))).status).toBe(403);
    expect((await instanz.POST!(req('/api/datenschutz/instanz-export', { 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY! }, 'POST', { passwort: PW }))).status).toBe(403);
    expect((await instanz.POST!(req('/api/datenschutz/instanz-export', sitzung('chef'), 'POST', { passwort: 'falsch-falsch-falsch' }))).status).toBe(403);
    drossel._zuruecksetzen();
    const r = await instanz.POST!(req('/api/datenschutz/instanz-export', sitzung('chef'), 'POST', { passwort: PW }));
    expect(r.status).toBe(200);
    const d = JSON.parse(await r.text());
    expect(d.kopf.von).toBe('chef');
    expect(d.bestaende.konten.konten.length).toBe(3);
    expect(d.bestaende['vitals--lena']).toBeTruthy();
    expect(d.fehler).toEqual([]);
    await lese.leseprotokollWarten();
    const l = await lese.leseprotokollMonat(HAUS, new Date().toISOString().slice(0, 7));
    expect(l.some(e => e.bereich === 'export' && e.person === 'chef')).toBe(true);
  });
});

// ── Konto löschen (Art. 17) ─────────────────────────────────────────────────────

describe('Konto löschen', () => {
  it('Inhaber mit anderen Konten → 409 mit klarer Meldung; falsches Passwort → 403; zweiter Faktor fehlt → 403', async () => {
    drossel._zuruecksetzen();
    const i = await kontoDaten.POST!(req('/api/konto/daten', sitzung('chef'), 'POST', { aktion: 'loeschen', passwort: PW, bestaetigung: 'LÖSCHEN' }));
    expect(i.status).toBe(409);
    expect((await i.json()).fehler).toContain('keine anderen Konten');
    expect((await kontoDaten.POST!(req('/api/konto/daten', sitzung('lena'), 'POST', { aktion: 'loeschen', passwort: PW, bestaetigung: 'nein' }))).status).toBe(400);
    expect((await kontoDaten.POST!(req('/api/konto/daten', sitzung('lena'), 'POST', { aktion: 'loeschen', passwort: 'falsch-falsch-falsch', bestaetigung: 'LÖSCHEN' }))).status).toBe(403);
    drossel._zuruecksetzen();
    const z = await kontoDaten.POST!(req('/api/konto/daten', sitzung('lena'), 'POST', { aktion: 'loeschen', passwort: PW, bestaetigung: 'LÖSCHEN' }));
    expect(z.status).toBe(403);
    expect(await z.json()).toMatchObject({ zweiterFaktor: true });
    expect((await K.ladeKonten()).konten.some(k => k.speicher === 'lena')).toBe(true);
  });
  it('mit Passwort + Code: Konto weg, kein Personenbezug außer Grabstein/Protokoll („[gelöscht]“), Kette gültig', async () => {
    drossel._zuruecksetzen();
    const code = totp.codeFuer(GEHEIM, totp.stufeVon());
    const r = await kontoDaten.POST!(req('/api/konto/daten', sitzung('lena'), 'POST', { aktion: 'loeschen', passwort: PW, code, bestaetigung: 'löschen' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
    const d = await r.json();
    expect(d.bericht.aufgabenZugewiesen).toBe(1);
    const st = await K.ladeKonten();
    expect(st.konten.map(k => k.speicher).sort()).toEqual(['chef', 'mira']);
    expect(st.konten.find(k => k.speicher === 'mira')!.teilt.gesundheit).toEqual([]);
    expect(st.einladungen).toEqual([]);
    for (const n of ['vitals--lena', 'journal--lena', 'meldungen--lena']) expect(existsSync(path.join(ordner, `${n}.json`)), n).toBe(false);
    expect(existsSync(path.join(ordner, 'vitals--mira.json'))).toBe(true);
    expect(readdirSync(path.join(ordner, 'backup')).filter(f => f.startsWith('vitals--lena') || f.startsWith('journal--lena'))).toEqual([]);
    // Kein Personenbezug: weder Adresse noch Name irgendwo; die Kennung nur noch als Zuständige einer Team-Aufgabe (bleibt Arbeit des Haushalts).
    for (const f of dateien()) {
      const t = readFileSync(f, 'utf8');
      expect(t, f).not.toContain('lena@example.invalid');
      expect(t, f).not.toContain('Lena Probe');
      if (!f.endsWith(`${path.sep}tasks.json`)) expect(t, f).not.toMatch(/"lena"/);
    }
    expect(((await db.loadJson<{ tasks: { id: string }[] }>('tasks'))!.tasks).map(t => t.id)).toEqual(['t2']);
    expect(((await db.loadJson<{ gespraeche: { id: string }[] }>('zoe-verlauf'))!.gespraeche).map(g => g.id)).toEqual(['g2']);
    expect(((await db.loadJson<{ team: { id: string }[] }>(`team--${HAUS}`))!.team).map(t => t.id)).toEqual(['konto-mira']);
    // Protokolle: Einträge bleiben, Kennung „[gelöscht]“ — die Kette bleibt gültig (rechtmäßige Umschreibung).
    const anm = (await db.loadJson<{ eintraege: { speicher: string | null; art: string }[] }>('anmeldungen'))!.eintraege;
    expect(anm.some(e => e.speicher === '[gelöscht]' && e.art === 'konto-loeschen')).toBe(true);
    const lp = (await db.loadJson<{ eintraege: { person?: string; betroffen?: string }[] }>(`leseprotokoll--${HAUS}--2026-10`))!.eintraege;
    expect(lp[0]).toMatchObject({ person: '[gelöscht]', betroffen: '[gelöscht]' });
    expect(lp[1]).toMatchObject({ person: 'mira' });
    const p = await kette.kettenPruefen();
    expect(p.ok, JSON.stringify(p.befunde)).toBe(true);
    expect(p.getilgt).toBeGreaterThan(0);
    // Einwilligungs-Nachweis bleibt als Nachweis — ohne Kennung.
    expect((await db.loadJson<{ ereignisse: { person: string }[] }>('gesundheit-einwilligungen'))!.ereignisse[0].person).toBe('[gelöscht]');
  });
  it('Zurückspielen einer Sicherung holt das Konto nicht zurück (Grabstein)', async () => {
    const st = await K.ladeKonten();
    await db.saveJson('konten', { ...st, konten: [...st.konten, await konto('k-lena', 'lena', 'mitglied')] });
    await db.saveJson('vitals--lena', { tage: [{ tag: '2026-10-01' }] });
    const { grabsteineAnwenden } = await import('@/lib/datenschutz/grabsteine');
    const r = await grabsteineAnwenden({ erzwingen: true });
    expect(r.konten).toBe(1);
    expect((await K.ladeKonten()).konten.some(k => k.speicher === 'lena')).toBe(false);
    expect(existsSync(path.join(ordner, 'vitals--lena.json'))).toBe(false);
  });
  it('ein neues Konto mit gleichem Vornamen trifft der Grabstein nicht (andere Konto-Kennung)', async () => {
    const st = await K.ladeKonten();
    await db.saveJson('konten', { ...st, konten: [...st.konten, await konto('k-lena-neu', 'lena', 'mitglied')] });
    const { grabsteineAnwenden } = await import('@/lib/datenschutz/grabsteine');
    await grabsteineAnwenden({ erzwingen: true });
    expect((await K.ladeKonten()).konten.some(k => k.id === 'k-lena-neu')).toBe(true);
  });
});

// ── Abmeldelink ────────────────────────────────────────────────────────────────

describe('Abmeldelink (Art. 21) — verrät nie, ob die Adresse existiert', () => {
  const post = async (token: string) => { const r = await abmelden.POST!(req(`/api/abmelden/${token}`, { 'content-type': 'application/x-www-form-urlencoded' }, 'POST'), { params: Promise.resolve({ token }) }); return { status: r.status, text: await r.text() }; };
  it('Token ohne Kennung/Adresse; Link nur mit Pepper und Instanz-Adresse; One-Click-Köpfe', () => {
    const t = ab.abmeldeToken('Nora@Example.invalid')!;
    expect(t).toMatch(ab.ABMELDE_TOKEN);
    expect(t).not.toContain('nora');
    expect(ab.abmeldeToken(' nora@example.invalid ')).toBe(t);
    const l = ab.abmeldeLink('nora@example.invalid')!;
    expect(l.link).toBe(`https://instanz.example.invalid/abmelden/${t}`);
    expect(l.listUnsubscribe).toBe(`<${l.link}>`);
    expect(l.listUnsubscribePost).toBe('List-Unsubscribe=One-Click');
    expect(ab.abmeldeLink('nora@example.invalid', null)).toBeNull();
  });
  it('gleiche Antwort für vorhandene, unbekannte und unsinnige Tokens; Wirkung nur bei der vorhandenen', async () => {
    drossel._zuruecksetzen();
    const bekannt = await post(ab.abmeldeToken('nora.privat@example.invalid')!);
    const unbekannt = await post(ab.abmeldeToken('niemand@example.invalid')!);
    const unsinn = await post('a1-00000000000000000000000000000000');
    expect(bekannt).toEqual(unbekannt);
    expect(unbekannt).toEqual(unsinn);
    expect(bekannt.status).toBe(200);
    expect(JSON.parse(bekannt.text).text).toBe(ab.ABMELDE_ANTWORT);
    const nora = (await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(k => k.id === 'c-news')!;
    expect(nora.werbesperre?.grund).toContain('Abmeldelink');
    expect(nora.einwilligungen![0].widerrufenAm).toMatch(/^\d{4}-/);
    expect(JSON.stringify(await db.loadJson('crm-sperrliste--haus')) + JSON.stringify(await db.loadJson('crm-sperrliste--haupt'))).toContain('werbesperre');
    // Ein zweites Mal: dieselbe Antwort, keine zweite Aktivität.
    const n = nora.aktivitaeten.length;
    expect(await post(ab.abmeldeToken('nora@example.invalid')!)).toEqual(bekannt);
    expect((await db.loadJson<{ kontakte: Kontakt[] }>('kontakte'))!.kontakte.find(k => k.id === 'c-news')!.aktivitaeten.length).toBe(n);
  });
  it('GET leitet nur auf die Seite um; Middleware lässt Seite und Schnittstelle ohne Sitzung durch (als niemand)', async () => {
    const t = ab.abmeldeToken('x@example.invalid')!;
    const g = await abmelden.GET!(req(`/api/abmelden/${t}`, {}), { params: Promise.resolve({ token: t }) });
    expect(g.status).toBe(303);
    expect(g.headers.get('location')).toContain(`/abmelden/${t}`);
    const { NextRequest } = await import('next/server');
    const { middleware } = await import('@/middleware');
    const offen = (r: Response) => r.headers.get('x-middleware-next') === '1';
    for (const p of [`/abmelden/${t}`, `/api/abmelden/${t}`]) {
      const r = await middleware(new NextRequest(`http://localhost:3001${p}`, { headers: { 'x-make-user': 'chef' } } as never));
      expect(offen(r), p).toBe(true);
      expect(r.headers.get('x-middleware-request-x-make-user')).toBeNull();
    }
    expect(offen(await middleware(new NextRequest(`http://localhost:3001/api/abmelden/${t}`, { method: 'POST' } as never)))).toBe(true);
    expect(offen(await middleware(new NextRequest('http://localhost:3001/api/abmelden/a1-kurz', {} as never)))).toBe(false);
  });
  it('Massen-Mail-Export trägt je Empfänger den Abmeldelink (nur mit Funktion — sonst wie bisher)', async () => {
    const { newsletterCsv } = await import('@/lib/crm/marketing');
    const k = [person('c-n', { email: 'n@example.invalid', einwilligungen: [{ kanal: 'newsletter', grundlage: 'einwilligung', erteiltAm: '2026-09-01', nachweis: 'DOI', zeitpunkt: '2026-09-01T10:00:00.000Z', erfasstVon: 'chef', wortlaut: 'ja', belegRef: 'DOI' }] })];
    expect(newsletterCsv(k).split('\n')[0]).toBe('﻿name;email');
    const mit = newsletterCsv(k, e => ab.abmeldeLink(e));
    expect(mit.split('\n')[0]).toBe('﻿name;email;abmeldelink;list_unsubscribe;list_unsubscribe_post');
    expect(mit.split('\n')).toHaveLength(2);
    expect(mit).toContain(`https://instanz.example.invalid/abmelden/${ab.abmeldeToken('n@example.invalid')};<https://`);
  });
});

// ── Speicher-Register ──────────────────────────────────────────────────────────

describe('Speicher-Register', () => {
  it('anmeldungen mit 12-Monats-Frist und Angaben', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    const e = registerEintrag('anmeldungen')!;
    expect(e.loeschfrist).toContain('12 Monate');
    expect(e.rechtsgrundlage).toBeTruthy();
    expect(e.art15).toContain('Meine Daten');
  });
  it('jedes `…--*`-Muster ist für Konto-Export/-Löschung eingeordnet (persönlich oder mit Grund nicht persönlich)', async () => {
    const { SPEICHER_REGISTER } = await import('@/lib/crm/speicher-register');
    const persoenlich = new Set(kd.PERSON_BESTAENDE.map(b => `${b.basis}--*`));
    const offen = SPEICHER_REGISTER.map(e => e.muster).filter(m => m.endsWith('--*') && !persoenlich.has(m) && !(m in kd.NICHT_PERSOENLICH));
    expect(offen, 'neues Muster in lib/datenschutz/konto-daten.ts einordnen').toEqual([]);
  });
  it('personBestandNamen: nur vorhandene, nur die eigene Person', () => {
    expect(kd.personBestandNamen('lena', ['vitals--lena', 'vitals--lenab', 'journal--mira', 'google-verbindung--lena'])).toEqual([
      { name: 'google-verbindung--lena', export: false }, { name: 'vitals--lena', export: true },
    ]);
    expect(kd.personBestandNamen('../x', ['vitals--../x'])).toEqual([]);
  });
});

// ── Löschskript ────────────────────────────────────────────────────────────────

describe('scripts/instanz-loeschen.mjs', () => {
  const lauf = (args: string[]) => { try { return { code: 0, out: execFileSync(process.execPath, ['scripts/instanz-loeschen.mjs', ...args], { encoding: 'utf8', env: { ...process.env, MAKE_OS_GRABSTEINE_DIR: '' } }) }; } catch (e) { const x = e as { status: number; stdout: string; stderr: string }; return { code: x.status, out: `${x.stdout}${x.stderr}` }; } };
  it('Trockenlauf löscht nichts; falscher Code bricht ab; richtiger Code löscht Daten- und Grabstein-Ordner', () => {
    const basis = mkdtempSync(path.join(tmpdir(), 'make-os-instanz-loeschen-'));
    const daten = path.join(basis, 'daten');
    mkdirSync(path.join(daten, 'system'), { recursive: true });
    writeFileSync(path.join(daten, 'konten.json'), '{}');
    mkdirSync(`${daten}-grabsteine`);
    writeFileSync(path.join(`${daten}-grabsteine`, 'grabsteine.json'), '{}');
    const t = lauf(['--ordner', daten, '--sicherungen', path.join(basis, 'keine')]);
    expect(t.code).toBe(0);
    expect(t.out).toContain('TROCKENLAUF');
    expect(t.out).toContain('spätestens überschrieben');
    expect(existsSync(daten)).toBe(true);
    const code = /--code ([0-9A-F]{8})/.exec(t.out)![1];
    expect(lauf(['--ordner', daten, '--ausfuehren', '--code', 'FALSCH00']).code).toBe(4);
    expect(lauf(['--ordner', daten, '--ausfuehren']).code).toBe(4);
    expect(existsSync(daten)).toBe(true);
    const a = lauf(['--ordner', daten, '--ausfuehren', '--code', code, '--sicherungen', path.join(basis, 'keine')]);
    expect(a.code).toBe(0);
    expect(a.out).toContain('Löschbestätigung');
    expect(existsSync(daten)).toBe(false);
    expect(existsSync(`${daten}-grabsteine`)).toBe(false);
    rmSync(basis, { recursive: true, force: true });
  });
  it('nie ohne --ordner, nie ein Ordner namens .data, nie ein fremder Ordner', () => {
    expect(lauf([]).code).toBe(2);
    const basis = mkdtempSync(path.join(tmpdir(), 'make-os-instanz-loeschen-'));
    mkdirSync(path.join(basis, '.data', 'system'), { recursive: true });
    expect(lauf(['--ordner', path.join(basis, '.data')]).out).toContain('.data');
    mkdirSync(path.join(basis, 'fremd'));
    expect(lauf(['--ordner', path.join(basis, 'fremd')]).out).toContain('nicht wie ein MAKE-OS-Datenordner');
    rmSync(basis, { recursive: true, force: true });
  });
});
