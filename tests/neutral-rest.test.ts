// ─── Wächter „Plattform neutral — Rest-Durchgang“ (09.10., Branch neutral-rest) ─────────────────────────────────────────
// Kevin 01.10./04.10.: „Sofort so bauen, dass wir ein richtiges Tool daraus machen können“ — keine festen Personen, Firmen,
// Ziele oder privaten Inhalte in Code, Prompts und Standards. Geprüft wird:
//   1. Quelltext: Prompts (B), Vorgaben/Standards (Paket 6) und public/ ohne Vornamen, fremde Firmen, Produkte, Diagnosen.
//   2. Verhalten mit erfundenen Werten: Datenschutz-Rückfall „fehlt“ (Paket 4), Message-ID-Domain, Team nur aus Konten,
//      Orte aus lib/einheiten.ts, Import-Owner aus der Team-Liste, Absender/Produkte aus Konto/Katalog, Bauplan-Block.
//   3. Altbestand liest sich wie vorher: frühere feste Kennungen (Hand-Zuordnung einer Beteiligung, Personen-Block im Bauplan,
//      Liquiplan-Zuordnung) bleiben stehen und werden beim Lesen übersetzt.
// Ausnahmen (mit Grund) stehen in AUSNAHMEN — sonst ist der Wächter rot. Eigener Datenordner, erfundene Konten, kein Netz.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const WURZEL = path.resolve(__dirname, '..');
const ordner = mkdtempSync(path.join(tmpdir(), 'make-os-neutral-rest-'));
process.env.MAKE_OS_DATEN_DIR = ordner;
process.env.MAKE_OS_KEY = 'pruef-schluessel-neutral-rest';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.NEXT_PUBLIC_MAKE_DATENSCHUTZ_MAIL;
delete process.env.NEXT_PUBLIC_MAKE_DATENSCHUTZ_SEITE;
delete process.env.MAKE_OS_VERBOTENE_WOERTER;

const lies = (rel: string) => readFileSync(path.join(WURZEL, rel), 'utf8');
/** Quelltext ohne Kommentare — geprüft wird, was als Text an ein Modell, an Dritte oder in die Oberfläche geht. */
const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(z => !/^\s*(\/\/|\*|\{\/\*)/.test(z)).map(z => z.replace(/\s\/\/ .*$/, '')).join('\n');
const funde = (rel: string, muster: RegExp) => ohneKommentare(lies(rel)).split('\n').filter(z => muster.test(z)).map(z => `${rel}: ${z.trim().slice(0, 140)}`);

/**
 * Vornamen der gewachsenen Instanz (als Anzeigename), fremde Firmen/Produkte und Diagnose-/Substanzwörter (allgemeine Liste wie
 * tests/vor-upload-datenschutz). Kleingeschriebene Speicher-Kennungen prüft `FEST` getrennt — nur in Dateien, deren Personen-Logik
 * dieses Paket neutralisiert hat (Kalendermodell, `speicherFuer`-Sonderfall und Finanzkern-Felder sind offen, UPDATES.md; die Vault-Sicht
 * ist seit 09.10. neutral — Branch brain-neutral, Wächter tests/vault-sicht.test.ts).
 */
const PERSONEN = /\b(Kevin|Malin|Kevins|Malins)\b|Dieckmann|Würriehausen/;
const FIRMEN = /KEMARIS|POINCAP|CapOS|ASTARNA|KD Management|Grant Pilot|Innovation Group/;
const GESUNDHEIT = /[Pp]soria|[Bb]andscheib|[Cc]annabis|[Nn]eurodermit/;
const ALLES = new RegExp(`${PERSONEN.source}|${FIRMEN.source}|${GESUNDHEIT.source}`);

const konto = (id: string, speicher: string, name: string, rolle: 'inhaber' | 'mitglied', haushalt = 'haus-nr') =>
  ({ id, speicher, email: `${speicher}@example.invalid`, name, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt });

let db: typeof import('@/lib/store/local-db');
const echtesFetch = globalThis.fetch;
beforeAll(async () => {
  globalThis.fetch = (async () => { throw new Error('Netz im Test gesperrt'); }) as typeof fetch;
  db = await import('@/lib/store/local-db');
  await db.saveJson('konten', { konten: [konto('k1', 'pia', 'Pia Probe', 'inhaber'), konto('k2', 'olaf', 'Olaf Probe', 'mitglied')], einladungen: [] });
});
afterAll(() => { globalThis.fetch = echtesFetch; rmSync(ordner, { recursive: true, force: true }); });

describe('1. Quelltext: Prompts, Vorgaben und public/ ohne feste Personen, Firmen, Diagnosen', () => {
  // Prompts außerhalb der von anderen Paketen geführten Dateien (B im Suchbericht). Jede Zeile ohne Kommentar zählt.
  const PROMPTS = [
    'app/api/board/route.ts', 'app/api/performance/route.ts', 'app/api/research/route.ts', 'app/api/loop/route.ts', 'app/api/loop/verbesserung/route.ts',
    'app/api/delegation/route.ts', 'app/api/meeting/route.ts', 'app/api/outreach/route.ts', 'app/api/content/route.ts', 'app/api/prospecting/score/route.ts',
    'app/api/crm/kontakt-frage/route.ts', 'lib/ansprache.ts', 'lib/heads/prompt.ts', 'lib/finanzen/chef/prompt.ts', 'lib/brain/konsolidierung.ts',
    'lib/zoe/brain-chat.ts', 'lib/zoe/ausfuehren.ts', 'lib/zoe/selbstbild.ts', 'lib/finanzen/haushalt/zoe.ts', 'lib/crm/absender.ts',
  ];
  it('Prompts (B): keine Vornamen, keine fremden Firmen oder Produkte, keine Diagnosen', () => {
    expect(PROMPTS.flatMap(d => funde(d, ALLES))).toEqual([]);
  });

  // Vorgaben/Standards der behobenen Stellen (Paket 4/6, CRM 6.5, E/H).
  const STANDARDS = [
    'lib/make-one/team-typen.ts', 'lib/make-one/team-speicher.ts', 'lib/make-one/orte.ts', 'lib/make-one/stichworte-data.ts', 'lib/make-one/fokus-data.ts',
    'lib/make-one/ordnung-data.ts', 'lib/make-one/agents-data.ts', 'lib/make-one/prospecting-data.ts', 'lib/make-one/backlog-data.ts', 'lib/make-one/schnell-anlegen.ts',
    'lib/finanzen/finanzplan-bestand.ts', 'lib/finanzen/haushalt/entflechtung.ts', 'lib/crm/netzwerken-recht.ts', 'lib/gmail/mime.ts', 'lib/crm/aktivitaeten.ts',
    'lib/kalender/zoe-sicht-server.ts', 'lib/performance.ts', 'lib/zoe/vault.ts', 'lib/crm/datenschutz.ts', 'lib/steuern/rechnen.ts', 'lib/mac.ts',
    'app/api/state/liquiplan/route.ts', 'app/api/state/ordnung/route.ts', 'app/api/crm/import/route.ts', 'app/api/state/backlog/route.ts',
    'components/os/TagesplanView.tsx', 'components/os/MeetingView.tsx', 'components/os/ResearchView.tsx',
    'components/os/JournalView.tsx', 'components/os/KompassView.tsx', 'components/os/TeamKarte.tsx', 'components/os/bauplan/BauplanBoard.tsx',
    'components/os/bauplan/KarteDetail.tsx', 'components/os/bauplan/Phasen.tsx', 'components/os/bauplan/gemeinsam.tsx', 'components/os/crm/Kartei.tsx',
    'components/os/crm/Vernetzen.tsx', 'components/os/crm/Runden.tsx', 'components/os/crm/stammdaten/Verweise.tsx',
    'components/os/GrundlageView.tsx', 'components/os/flaeche/widgets.tsx',
  ];
  it('Vorgaben und Oberflächen-Texte der behobenen Stellen: keine Vornamen, Firmen, Diagnosen', () => {
    expect(STANDARDS.flatMap(d => funde(d, ALLES))).toEqual([]);
    // Teilweise offen (Kalendermodell bzw. Finanzkern-Felder): hier nur die Bausteine/Beschriftungen, die dieses Paket neutral gemacht hat.
    expect(funde('components/os/kalender/Planen.tsx', /Rücken|Termin mit /)).toEqual([]);
    expect(funde('components/os/finanzplan/Planen.tsx', FIRMEN)).toEqual([]);
    expect(lies('lib/zoe/vault.ts')).not.toMatch(/Make Privat|❤/);
  });

  // Dateien, deren feste Personen-Logik dieses Paket vollständig neutralisiert hat — hier darf keine Speicher-Kennung mehr stehen.
  const OHNE_KENNUNG = [
    'lib/make-one/team-typen.ts', 'lib/make-one/team-speicher.ts', 'lib/make-one/schnell-anlegen.ts', 'lib/crm/aktivitaeten.ts', 'lib/make-one/backlog-data.ts',
    'lib/bauplan/board.ts', 'app/api/state/backlog/route.ts', 'app/api/tasks/create/route.ts', 'app/api/meeting/route.ts', 'app/api/delegation/route.ts',
    'app/api/loop/verbesserung/route.ts', 'components/os/aufgaben/hilfe.ts', 'components/os/aufgaben/VorlagenDialog.tsx', 'components/os/KompassView.tsx',
    'components/os/NutzungsMelder.tsx', 'components/os/WissenView.tsx', 'components/os/flaeche/widgets.tsx', 'components/os/crm/Vernetzen.tsx',
    'components/os/crm/kontakt-teile.tsx', 'components/os/crm/SchnellErfassen.tsx', 'components/os/crm/Kartei.tsx', 'components/os/MeetingView.tsx',
    'components/os/bauplan/BauplanBoard.tsx', 'components/os/bauplan/KarteDetail.tsx', 'components/os/bauplan/Phasen.tsx', 'components/os/bauplan/gemeinsam.tsx',
    // Vault- und Brain-Sicht (09.10., Paket 5): Personen aus den Konten, Eigentümer = Haupt-Inhaber.
    'lib/zoe/vault.ts', 'lib/brain/inbox.ts', 'lib/brain/regeln.ts', 'lib/brain/konsolidierung.ts', 'lib/brain/kugel-server.ts', 'components/os/wissen/Regeln.tsx',
    'components/os/wissen/Inbox.tsx', 'app/api/brain/regeln/route.ts', 'app/api/brain/inbox/route.ts', 'app/api/zoe/wissen/route.ts',
  ];
  it('keine festen Personen-Kennungen als Rückfall oder Sonderfall in den neutralisierten Dateien', () => {
    const FEST = /'(kevin|malin)'/;
    expect(OHNE_KENNUNG.flatMap(d => funde(d, FEST))).toEqual([]);
  });

  it('public/: keine Namen, Firmen oder Diagnosen in Textdateien', () => {
    const texte: string[] = [];
    const lauf = (d: string) => { for (const n of readdirSync(path.join(WURZEL, d))) { const rel = `${d}/${n}`; if (statSync(path.join(WURZEL, rel)).isDirectory()) lauf(rel); else if (/\.(json|webmanifest|txt|html?|svg|css|js)$/i.test(n)) texte.push(rel); } };
    lauf('public');
    expect(texte.flatMap(d => lies(d).split('\n').filter(z => ALLES.test(z)).map(z => `${d}: ${z.trim().slice(0, 100)}`))).toEqual([]);
  });

  // Rundgang 09.10. (PRIVATE_INHALTE_SUCHE.md › G „Umzug aus … Cockpit → Altsystem“): Finanzen › Privat, die Übernahme und ihre Fehlertexte
  // zeigen jeder Instanz — keine Person, kein „Cockpit von …“.
  const FINANZ_PRIVAT = [
    ...readdirSync(path.join(WURZEL, 'components/os/haushalt')).filter(n => /\.tsx?$/.test(n)).map(n => `components/os/haushalt/${n}`),
    'components/os/ZahlenView.tsx', 'components/os/FinanzenView.tsx', 'components/os/GrundlageView.tsx',
    'app/api/haushalt/route.ts', 'app/api/haushalt/umzug/route.ts', 'app/api/haushalt/sicherung/route.ts', 'app/api/haushalt/aktion/route.ts', 'app/api/haushalt/pruefliste/route.ts',
    'lib/finanzen/haushalt/supabase-umzug.ts', 'lib/finanzen/haushalt/datei-umzug.ts', 'lib/finanzen/haushalt/altsystem.ts',
  ];
  it('Finanzen › Privat und die Übernahme aus dem Altsystem: keine Personennamen in sichtbaren Texten', () => {
    expect(FINANZ_PRIVAT.flatMap(d => funde(d, PERSONEN))).toEqual([]);
    expect(FINANZ_PRIVAT.flatMap(d => funde(d, /Cockpit von|Malins? Cockpit/))).toEqual([]);
  });

  it('die zweite Firmenliste, die Team-Platzhalter und die feste Kalenderquelle einer Beteiligung sind weg', () => {
    expect(existsSync(path.join(WURZEL, 'lib/make-one/organisation-data.ts'))).toBe(false);
    expect(existsSync(path.join(WURZEL, 'lib/make-one/team-data.ts'))).toBe(false);
    expect(existsSync(path.join(WURZEL, 'app/api/kemaris-calendar/route.ts'))).toBe(false);
  });

  it('Ausnahmen nur an ihren Orten: Altnamen (lib/einheiten.ts), Projekt-Kennungen des Startbestands (alt-projekte.ts), Team-Vorgabe (6.4 offen)', () => {
    // Altkennungen alter Projekte dürfen nur an EINER Stelle stehen — und dort nie als Anzeigename.
    const ALT = /'proj-(capos|ig|kdm)'/;
    const quellen: string[] = [];
    const lauf = (d: string) => { for (const n of readdirSync(path.join(WURZEL, d))) { const rel = `${d}/${n}`; if (statSync(path.join(WURZEL, rel)).isDirectory()) { if (n !== 'node_modules') lauf(rel); } else if (/\.(ts|tsx)$/.test(n)) quellen.push(rel); } };
    for (const d of ['app', 'lib', 'components']) lauf(d);
    expect(quellen.filter(q => ALT.test(ohneKommentare(lies(q))))).toEqual(['lib/make-one/alt-projekte.ts']);
    expect(ohneKommentare(lies('lib/make-one/alt-projekte.ts'))).not.toMatch(ALLES);
  });
});

describe('2. Verhalten mit erfundenen Werten', () => {
  it('Paket 4 — Danke-Mail ohne Datenschutz-Einrichtung: „Verantwortlicher fehlt“ und Platzhalter, nie eine Firma aus dem Code', async () => {
    const { datenschutzAngaben, datenschutzAngabenAus, datenschutzHinweisText, KONTAKTWEG_FEHLT } = await import('@/lib/crm/netzwerken-recht');
    const { VERANTWORTLICHER_FEHLT } = await import('@/lib/datenschutz/einrichtung');
    expect(datenschutzAngaben()).toEqual({ mail: '', seite: '', verantwortlich: VERANTWORTLICHER_FEHLT, fehlt: true });
    expect(datenschutzAngabenAus(null).fehlt).toBe(true);
    expect(datenschutzAngabenAus({ name: 'Beispiel GmbH', mail: 'post@beispiel.example' })).toMatchObject({ verantwortlich: 'Beispiel GmbH', mail: 'post@beispiel.example' });
    const t = datenschutzHinweisText({ du: false });
    expect(t).toContain(VERANTWORTLICHER_FEHLT);
    expect(t).toContain(KONTAKTWEG_FEHLT);
    expect(t).not.toMatch(/makeinnovation|MAKE Innovation/i);
  });

  it('Paket 4 — Message-ID: Domain des Absenders, sonst der Instanz, sonst .invalid (nie eine feste Firmen-Domain)', async () => {
    const { messageIdDomain } = await import('@/lib/gmail/mime');
    expect(messageIdDomain('a@post.example')).toBe('post.example');
    expect(messageIdDomain('ohne-at', { MAKE_OS_ADRESSE: 'https://os.beispiel.example' })).toBe('os.beispiel.example');
    expect(messageIdDomain('ohne-at', {})).toBe('make-os.invalid');
  });

  it('Paket 4 — Team ohne Speicher: nur Konten mit neutraler Rolle; kein Konto erbt Rollen über seinen Namen', async () => {
    const { teamZusammen, ohneTeam } = await import('@/lib/make-one/team-typen');
    expect(ohneTeam()).toEqual([]);
    const { team, ausDaten } = teamZusammen([{ speicher: 'kevin', name: 'Kevin', rolle: 'mitglied' }, { speicher: 'pia', name: 'Pia Probe', rolle: 'inhaber' }], []);
    expect(ausDaten).toBe(false);
    expect(team.map(p => [p.speicher, p.rolle, p.bereich, !!p.inhaber])).toEqual([['kevin', 'Mitglied', undefined, false], ['pia', 'Inhaber', undefined, true]]);
  });

  it('Rundgang 09.10. — Finanzen › Privat: ohne Altsystem keine Übernahme, der Server entscheidet (Feld `altsystem`, Umzug 404)', async () => {
    delete process.env.MAKE_ORGA_URL; delete process.env.MAKE_ORGA_KEY;
    const route = await import('@/app/api/haushalt/route');
    const umzug = await import('@/app/api/haushalt/umzug/route');
    const kopf = { 'content-type': 'application/json', 'x-make-user': 'pia' };
    const lesen = async () => (await (await route.GET(new Request('http://test/api/haushalt', { headers: kopf }))).json()) as { ok: boolean; altsystem?: boolean };
    const neu = await lesen();
    expect(neu.ok).toBe(true);
    expect(neu.altsystem).toBe(false);
    const probe = await umzug.POST(new Request('http://test/api/haushalt/umzug', { method: 'POST', headers: kopf, body: JSON.stringify({ schritt: 'dateien', sicherung: { buchungen: [] } }) }));
    expect(probe.status).toBe(404);
    expect(await db.loadJson('haushalt-umzug--haus-nr')).toBeNull();
    // Eingerichtet über die Umgebung der Instanz …
    process.env.MAKE_ORGA_URL = 'https://beispiel.supabase.co'; process.env.MAKE_ORGA_KEY = 'pruef-schluessel';
    try { expect((await lesen()).altsystem).toBe(true); } finally { delete process.env.MAKE_ORGA_URL; delete process.env.MAKE_ORGA_KEY; }
    // … oder weil der Haushalt schon einmal übernommen hat (gewachsene Instanz).
    const { aendereMeta } = await import('@/lib/finanzen/haushalt/speicher');
    await aendereMeta('haus-nr', m => ({ ...m, umzug: { zeit: '2026-09-24T10:00:00.000Z', wer: 'pia', ziel: 'haus-nr', zaehlung: {}, supabase: {} } }));
    expect((await lesen()).altsystem).toBe(true);
    // Oberfläche: jeder Weg in die Übernahme hängt an `h.altsystem`; sonst der Leerzustand mit „Konto anlegen“ und dem Weg zum Kontoauszug.
    const view = ohneKommentare(lies('components/os/haushalt/HaushaltView.tsx'));
    const wege = Array.from(view.matchAll(/setUmzugAuf\(true\)/g), m => view.slice(Math.max(0, m.index! - 400), m.index));
    expect(wege).toHaveLength(2);
    for (const w of wege) expect(w).toMatch(/h\.altsystem/);
    expect(view).toMatch(/<Leerzustand[^>]*titel="Noch keine Konten und Buchungen"/);
    expect(view).toMatch(/Konten &amp; Buchungen › Kontoauszug einlesen/);
  });

  it('Paket 6 — Orte nur aus lib/einheiten.ts; Hand-Zuordnung eines Altwerts liest sich als Business', async () => {
    const { ORTE, ortVon, ORT_BUSINESS_STANDARD } = await import('@/lib/make-one/orte');
    const { FINANZ_ORT_IDS } = await import('@/lib/einheiten');
    expect(ORTE.map(o => o.id).sort()).toEqual([...FINANZ_ORT_IDS].sort());
    const t = { id: 't1', title: 'Irgendwas', projectId: 'p-x' };
    expect(ortVon(t, { t1: 'altfirma' })).toBe(ORT_BUSINESS_STANDARD);
    expect(ortVon(t, { t1: 'privat' })).toBe('privat');
    expect(ortVon({ ...t, title: 'Urlaub planen' })).toBe('privat');
    expect(ortVon({ ...t, title: 'Steuer der Selbstständigkeit' })).toBe('kdc');
    const { spaceVonAufgabe } = await import('@/lib/make-one/space-regeln');
    expect(spaceVonAufgabe(t, { t1: 'altfirma' })).toBe('business');
  });

  it('CRM 6.5 — Import-Owner aus der Team-Liste (nicht aus festen Namen)', async () => {
    const { besitzerAusOwner } = await import('@/lib/make-one/crm');
    const team = [{ id: 'pia', name: 'Pia' }, { id: 'olaf', name: 'Olaf Probe' }];
    expect(besitzerAusOwner('Pia Probe', team)).toBe('pia');
    expect(besitzerAusOwner('Olaf & Pia', team)).toBe('beide');
    expect(besitzerAusOwner('Jemand Fremdes', team)).toBeUndefined();
    expect(besitzerAusOwner('', team)).toBeUndefined();
  });

  it('CRM 6.5 — Personenfilter der Aktivitäten aus dem Team', async () => {
    const { personenFilter } = await import('@/lib/crm/aktivitaeten');
    expect(personenFilter([{ id: 'pia', name: 'Pia' }])).toEqual([{ id: 'pia', label: 'Pia' }, { id: 'beide', label: 'Beide' }]);
  });

  it('B — Entwürfe nach außen: Absender aus dem Konto, Produkte aus dem Katalog, ohne Produkt keine Produktbehauptung', async () => {
    const { absenderZeilen, absenderLaden } = await import('@/lib/crm/absender');
    const ohne = absenderZeilen({ name: '', produkte: [] }).join('\n');
    expect(ohne).toMatch(/kein Name bekannt/);
    expect(ohne).toMatch(/keines im Katalog hinterlegt/);
    const mit = absenderZeilen({ name: 'Pia Probe', produkte: [{ name: 'Beispiel-Paket', satz: 'Ein erfundener Satz.' }] }).join('\n');
    expect(mit).toContain('ABSENDER: Pia Probe');
    expect(mit).toContain('<daten quelle="produkte">');
    expect((await absenderLaden('pia')).name).toBe('Pia Probe');
    expect((await absenderLaden(null)).name).toBe('');
  });

  it('Heads — verbotene Wörter: allgemeine Vorgabe, eigene Liste nur aus der Instanz-Einstellung', async () => {
    const { verboteneWoerter, verbotenMuster } = await import('@/lib/heads/prompt');
    expect(verboteneWoerter({})).not.toContain('dashboard');
    const eigene = verboteneWoerter({ MAKE_OS_VERBOTENE_WOERTER: 'Werkzeugkiste, Beispielwort' });
    expect(eigene).toEqual(expect.arrayContaining(['werkzeugkiste', 'beispielwort']));
    const m = verbotenMuster(eigene);
    expect(m.test('Das ist ein Beispielwort.')).toBe(true);
    expect(m.test('Beispielworte')).toBe(false); // nur ganze Wörter
  });

  it('Bauplan — „wartet auf den Inhaber“: frühere Personen-Kennung liest sich als „inhaber“', async () => {
    const { blockAus, mitBlock } = await import('@/lib/make-one/backlog-data');
    expect(blockAus('altkennung')).toBe('inhaber');
    expect(blockAus('frei')).toBe('frei');
    expect(mitBlock({ id: 'b1', block: 'altkennung' }).block).toBe('inhaber');
  });
});

describe('3. Altbestand: frühere feste Kennungen bleiben stehen und werden beim Lesen übersetzt', () => {
  const sitzung = (person: string) => ({ 'content-type': 'application/json', 'x-make-user': person });
  it('Liquiplan: eine gespeicherte Altzuordnung bleibt, Gesellschaften (auch ug) und Register-Kennungen sind zulässig, Unsinn fällt weg', async () => {
    const route = await import('@/app/api/state/liquiplan/route');
    const posten = [
      { id: 'lp1', titel: 'Alt', betrag: -10, rhythmus: 'monatlich', ab: '2026-10-01', sicher: true, firmaId: 'altfirma' },
      { id: 'lp2', titel: 'UG', betrag: -20, rhythmus: 'monatlich', ab: '2026-10-01', sicher: true, firmaId: 'ug' },
      { id: 'lp3', titel: 'Register', betrag: -30, rhythmus: 'monatlich', ab: '2026-10-01', sicher: true, firmaId: 'g-abcd1234' },
      { id: 'lp4', titel: 'Unsinn', betrag: -40, rhythmus: 'monatlich', ab: '2026-10-01', sicher: true, firmaId: '../x' },
    ];
    const r = await route.PUT(new Request('http://test/api/state/liquiplan', { method: 'PUT', headers: sitzung('pia'), body: JSON.stringify({ posten }) }));
    expect(r.status).toBe(200);
    const gespeichert = (await db.loadJson<{ posten: { id: string; firmaId?: string }[] }>('liquiplan'))!.posten;
    expect(gespeichert.map(p => [p.id, p.firmaId])).toEqual([['lp1', 'altfirma'], ['lp2', 'ug'], ['lp3', 'g-abcd1234'], ['lp4', undefined]]);
  });

  it('Ordnung: eine gespeicherte Hand-Zuordnung bleibt stehen; neue Zuordnungen nur auf Orte aus lib/einheiten.ts', async () => {
    await db.saveJson('ordnung', { reihenfolge: ['recht', 'umsatz', 'produkt', 'leben'], zuordnung: {}, stichworte: {}, orgs: { 'alt-aufgabe': 'altfirma' } });
    const route = await import('@/app/api/state/ordnung/route');
    const r = await route.PUT(new Request('http://test/api/state/ordnung', { method: 'PUT', headers: sitzung('pia'), body: JSON.stringify({ orgs: { 'neu-1': 'ug', 'neu-2': 'altfirma' } }) }));
    expect(r.status).toBe(200);
    const f = await db.loadJson<{ orgs: Record<string, string> }>('ordnung');
    expect(f!.orgs).toEqual({ 'alt-aufgabe': 'altfirma', 'neu-1': 'ug' });
  });
});
