// ─── Onboarding „Einrichtung“ (08.10. Server-Stand, 08.10. spät Paket B0, Nachbesserung nach der Gegenprüfung) ─────────────────────
// Wächter:
//   (1) Daten: kein Verweis auf den alten Mac-Betrieb, keine Personennamen, jeder Prüf-Schlüssel bekannt und zur Ebene passend,
//       Kennungen und Nummern eindeutig, jeder Link zeigt auf eine Seite (auch die Anker), alle Etappen 0–8, Telegram- und
//       Zulieferer-Schritt raus, Server-Befehle mit Ordner und Pflicht-Argumenten (keine Werte), Samstag passt in 8 Stunden.
//   (2) Prüfungen: persönliche NUR für die Person der Sitzung, Inhaber-Prüfungen NUR für den Inhaber, Instanz-Befunde für andere nur
//       ja/nein — Sicht X bekommt nichts aus Y; keine Werte; nichts grün ohne getane Arbeit (Sicherung, Einwilligung, iCloud aus der
//       Umgebung, 0-Punkt-Posten); ein kaputter Bestand trifft nur seine Prüfung.
//   (3) Häkchen (Route): je Person getrennt, fremde nie sichtbar, unbekannte Kennung 400 (nie gekürzt), Dienstweg 403, ohne Person 401,
//       Inhaber-Schritt 403, Privat-Schritt ohne Privat-Finanzen 403, Speichername statt Vorname; alte Häkchen zählen nie (höchstens
//       „bitte bestätigen“), ein Häkchen schlägt nie einen roten Befund; GET schreibt nichts.
//   (4) Fortschritt je Rolle (Samstag-Kern, „einzeln“ wie optional), Übersicht zeigt alle eigenen Schritte, Karte vorne auf Heute, Register.
// Datenordner im Temp-Ordner, erfundene Konten — nie .data/.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs, existsSync, readdirSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-onboarding-'));
const DATEN = path.join(wurzel, 'daten');
process.env.MAKE_OS_DATEN_DIR = DATEN;
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_VAULT_DIR = path.join(wurzel, 'Make.Claude'); // die Brain-Prüfung liest Regeln — nie der echte Vault
process.env.MAKE_OS_DOKU_WURZEL = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-onboarding-0123456789';
process.env.MAKE_OS_ADRESSE = 'https://instanz-geheim.example.invalid';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.MAKE_OS_DEMO;
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;
delete process.env.ICLOUD_PERSON;
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const D = await import('@/lib/make-one/onboarding-data');
const { SCHRITTE, ZONEN, ETAPPEN, DATENKARTE, ABLAUF, EBENEN, ALT_ZU_NEU, schritteFuer, fortschrittVon, istPersoenlich, istFertig, gruppeVon, samstagMinuten, frueherErlaubt } = D;
const { ALLE_PRUEFUNGEN, PERSOENLICHE_PRUEFUNGEN, GEMEINSAME_PRUEFUNGEN, INHABER_PRUEFUNGEN, INSTANZ_PRUEFUNGEN, pruefeAlles, fortschritt, kontextFuer } = await import('@/lib/onboarding-status');
const { hakenSicht, hakenLesen, hakenSetzen } = await import('@/lib/onboarding-haken');

const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: `${sp === 'erste' ? 'Erika' : sp === 'partner' ? 'Paula' : 'Zora'} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-onb', ...extra });
const KONTEN = {
  konten: [
    konto('k1', 'erste', 'inhaber', { zweiterFaktor: { geheimnis: 'GEHEIM', seit: '2026-10-01', wiederherstellung: [] } }),
    konto('k2', 'zweite', 'mitglied'),
  ],
  einladungen: [],
};

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  await fs.mkdir(DATEN, { recursive: true });
  db = await import('@/lib/store/local-db');
  // Erste Person (Inhaber): zweiter Faktor an, Postfach, Gesundheit erklärt, iCloud verbunden, ein ZOE-Gespräch. Zweite: nichts davon.
  await db.saveJson('konten', KONTEN);
  await db.saveJson('postfaecher--erste', { v: 1, postfaecher: [{ id: 'pf-1', quelle: 'imap', bereich: 'privat', anzeigename: 'Test', adresse: 'erste@test.invalid', angelegtAm: '2026-10-01' }] });
  await db.saveJson('gesundheit-einwilligungen', { ereignisse: [{ zeit: '2026-10-01T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'erste' }] });
  await db.saveJson('icloud-verbindung--erste', { v: 1, appleId: 'erste@test.invalid', passwort: 'abcd-efgh-ijkl-mnop', verbundenAm: '2026-10-01' });
  await db.saveJson('zoe-verlauf', { gespraeche: [{ id: 'g1', person: 'erste' }] });
  // Zahlen, die nie in einem Befund stehen dürfen (Beträge, Namen).
  await db.saveJson('finanzplan', {
    firmen: [{ id: 'kdv', name: 'Geheimfirma Konto', bank: 'Bank', kontostand: 98765.43, stand: '2026-01-01' }],
    rechnungen: [{ id: 'r1', firmaId: 'kdv', kunde: 'Geheimkunde', titel: 'x', betrag: 4321.09, status: 'gestellt', faellig: '2026-01-15', datum: '2026-01-01' }],
    zahlungen: [{ id: 'z1', firmaId: 'kdv', an: 'Geheimempfänger', titel: 'y', betrag: 111.22, status: 'offen' }],
  });
  await db.saveJson('kontakte', { kontakte: [{ id: 'c-1', vorname: 'Geheimvorname', nachname: 'Geheimnachname', email: 'kontakt@test.invalid', aktivitaeten: [] }] });
});

const INHABER = { inhaber: true, personen: 2, privatFinanzen: true, altbestand: true };
const ZWEITE = { inhaber: false, personen: 2, privatFinanzen: true, altbestand: true };

const TEXT_VERBOTEN = [/localhost/i, /\.env\.local/, /tailscale/i, /ipconfig/, /Kevins-IP/i, /auch Gesundheit/i, /npm install/, /start\.sh/, /iCloud-Ordner/i, /\.data\b/, /fd_p/];
/** Nur die Texte eines Schritts (nicht Kennung und Adresse). */
const texte = (s: { titel: string; warum: string; wie: string[]; danach?: string; befehl?: string; wo?: { label: string } }) => [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '', s.wo?.label ?? ''].join(' \n ');
const alleTexte = () => [
  ...SCHRITTE.map(texte), ...ETAPPEN.flatMap(e => [e.titel, e.satz, ...(e.hinweise ?? []).flatMap(h => [h.titel, h.satz, h.wann])]),
  ...DATENKARTE.map(d => `${d.fakt} ${d.hier} ${d.nicht}`), ...ABLAUF.map(a => `${a.wann} ${a.was}`), ...EBENEN.map(s => `${s.titel} ${s.satz}`),
  ...ZONEN.map(z => JSON.stringify(z)), ...Object.values(D.GRUPPEN).map(g => `${g.titel} ${g.satz}`),
  // Neustart (09.10.): dieselben Regeln für dessen Etappen, Ablauf, Gruppen und Fassungen.
  ...D.NEUSTART_ETAPPEN.flatMap(e => [e.titel, e.satz, ...(e.hinweise ?? []).flatMap(h => [h.titel, h.satz, h.wann])]), ...D.ABLAUF_NEUSTART.map(a => `${a.wann} ${a.was}`),
  ...Object.values(D.GRUPPEN_NEUSTART).map(g => `${g.titel} ${g.satz}`), ...D.neustartSchritte().map(texte),
];

/** Gibt es zu dieser Adresse eine Seite (auch über ein dynamisches Segment wie /os/planung/[horizont])? */
function seiteDa(href: string): boolean {
  const teile = href.split(/[?#]/)[0].replace(/^\//, '').split('/');
  let ordner = path.join(process.cwd(), 'app');
  for (const t of teile) {
    if (existsSync(path.join(ordner, t))) { ordner = path.join(ordner, t); continue; }
    const dyn = readdirSync(ordner).find(n => /^\[[^.]/.test(n));
    if (!dyn) return false;
    ordner = path.join(ordner, dyn);
  }
  return existsSync(path.join(ordner, 'page.tsx'));
}
const lies = (f: string) => readFileSync(path.join(process.cwd(), f), 'utf8');
const schritt = (id: string) => SCHRITTE.find(s => s.id === id)!;

describe('Onboarding-Daten', () => {
  it('kein Verweis auf den alten Mac-Betrieb oder „auch Gesundheit“ — und keine Personennamen in den Texten', () => {
    for (const t of alleTexte()) {
      for (const re of TEXT_VERBOTEN) expect(t, String(re)).not.toMatch(re);
      expect(t).not.toMatch(/\b(Kevin|Malin|Kevins|Malins)\b/);
    }
  });

  it('jeder Prüf-Schlüssel ist bekannt und passt zur Ebene (persönlich ↔ „ich“, Inhaber-Prüfung ↔ Inhaber-Schritt)', () => {
    const persoenlich = new Set<string>(PERSOENLICHE_PRUEFUNGEN);
    expect(new Set([...PERSOENLICHE_PRUEFUNGEN, ...INHABER_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN]).size).toBe(ALLE_PRUEFUNGEN.length);
    for (const s of SCHRITTE) {
      if (!s.pruefung) continue;
      expect(ALLE_PRUEFUNGEN, s.id).toContain(s.pruefung);
      expect(persoenlich.has(s.pruefung), `${s.id}: Ebene ${s.ebene} passt nicht zu ${s.pruefung}`).toBe(istPersoenlich(s));
      if ((INHABER_PRUEFUNGEN as readonly string[]).includes(s.pruefung)) expect(s.nurInhaber, s.id).toBe(true);
    }
  });

  it('Kennungen und Nummern eindeutig, jeder Link (Schritte, Datenkarte) zeigt auf eine Seite; die neuen Anker gibt es', () => {
    // Neustart-Schritte (09.10.) tragen ihre Nummer nur in der Fassung des Neustarts (tests/einrichtung-neustart.test.ts prüft deren Eindeutigkeit).
    for (const k of ['id', 'nr'] as const) { const l = SCHRITTE.filter(s => k === 'id' || !s.nurNeustart).map(s => s[k]); expect(new Set(l).size, k).toBe(l.length); }
    for (const s of SCHRITTE) if (s.wo) expect(seiteDa(s.wo.href), `${s.id}: ${s.wo.href}`).toBe(true);
    for (const d of DATENKARTE) if (d.href) expect(seiteDa(d.href), `${d.fakt}: ${d.href}`).toBe(true);
    expect(schritt('kalender-zuordnen').wo!.href).toBe('/os/kalender?einstellungen=1');
    expect(lies('components/os/kalender/Kalender.tsx')).toContain("a.get('einstellungen') === '1'");
    expect(schritt('ich-buchungsseite').wo!.href).toBe('/os/kalender?buchungen=1');
    expect(lies('components/os/kalender/Buchungsseiten.tsx')).toContain("get('buchungen') === '1'");
    expect(schritt('datenschutz').wo!.href).toBe('/os/datenschutz#verantwortlicher');
    expect(lies('components/os/datenschutz/Verantwortlicher.tsx')).toContain('id="verantwortlicher"');
    expect(schritt('ich-zoe').wo!.href).toBe('/zoe');
  });

  it('alle Etappen 0–8; Telegram- und Zulieferer-Schritt raus; Hinweise in den Etappen', () => {
    for (let e = 0; e <= 8; e++) expect(SCHRITTE.some(s => s.etappe === e), `Etappe ${e}`).toBe(true);
    for (const s of SCHRITTE) { expect(texte(s)).not.toMatch(/telegram/i); expect(s.id).not.toMatch(/telegram|zulieferer/); }
    const hinweise = ETAPPEN.flatMap(e => e.hinweise ?? []).map(h => `${h.titel} ${h.satz} ${h.wann}`).join(' ');
    for (const m of [/WhatsApp/, /Phase 1/, /Zulieferer/]) expect(hinweise).toMatch(m);
    // Update 2 (16.10.): die zweite gleichwertige Inhaberin ist kein Hinweis mehr, sondern gebaut — zwei Schritte (Rolle in der App, eigener SSH-Schlüssel).
    expect(hinweise).not.toMatch(/Update 2/);
    expect(schritt('weitere-inhaber')).toMatchObject({ ebene: 'instanz', nurInhaber: true, nurMitMehreren: true, pruefung: 'inhaber' });
    expect(schritt('ssh-zweiter-schluessel').befehl).toContain('deploy/ssh-schluessel-hinzufuegen.sh');
  });

  it('Entscheidungen 08.10. stehen in den Texten (Stichtag, Haushalt führt das Ist, Verantwortlicher)', () => {
    expect(SCHRITTE.map(texte).join(' ')).toContain('01.10.2026');
    expect(DATENKARTE.find(d => /Budget/.test(d.fakt))?.hier).toMatch(/Haushalt/);
    expect(texte(schritt('datenschutz'))).toMatch(/Verantwortlicher/);
  });

  it('Server-Befehle: keine Werte, „cd /srv/make-os/app &&“ vor docker compose/.env, Pflicht-Argumente der Sicherungs-Skripte, age-Installation', () => {
    for (const s of SCHRITTE.filter(x => x.befehl)) {
      expect(s.befehl, s.id).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
      expect(s.befehl, s.id).not.toMatch(/sslip|makeinnovation/);
      expect(s.befehl, s.id).not.toMatch(/[0-9a-f]{32,}/);
      expect(s.befehl, s.id).not.toMatch(/(PEPPER|KEY|SECRET|PASSWORT|TOKEN|SCHLUESSEL)[A-Z_]*=\s*[^<\s]/);
      for (const zeile of s.befehl!.split('\n')) if (/docker compose|\.env\b/.test(zeile.split('#')[0])) expect(zeile, `${s.id}: ${zeile}`).toContain('cd /srv/make-os/app && ');
    }
    expect(schritt('sicherung-mac').befehl).toContain('sicherung-abholen.sh --einrichten');
    expect(schritt('sicherung-mac').befehl).toMatch(/sicherung-probe\.sh \S+ <[^>]+> --app/);
    expect(texte(schritt('sicherung-mac'))).toMatch(/Abschnitt 2/);
    expect(schritt('sicherung').befehl).toContain('command -v age || sudo apt-get install -y age');
    expect(texte(schritt('sicherung'))).toMatch(/RESTORE_TEST\.md, Abschnitt 1/);
  });

  it('Samstag-Kern ≤ 8 h für den Inhaber, deutlich weniger für die zweite Person; jeder Schritt ist Freitag, Samstag oder einzeln', () => {
    const inhaber = samstagMinuten(INHABER), zweite = samstagMinuten(ZWEITE);
    expect(inhaber).toBeLessThanOrEqual(480);
    expect(zweite).toBeLessThanOrEqual(inhaber * 0.7);
    for (const s of SCHRITTE) {
      expect(!!s.samstag && !!s.spaeter, s.id).toBe(false);
      if (!s.samstag && !s.spaeter) expect(s.etappe, `${s.id} ist weder Samstag noch einzeln`).toBe(0);
    }
    for (const id of ['mail-umzug', 'whatsapp', 'sicherung-mac']) expect(gruppeVon(schritt(id)), id).toBe('spaeter');
    // ABLAUF nennt 1.8 vor 0.5 (die Einwilligung ist Voraussetzung der Übernahme).
    const freitag = ABLAUF[0].was;
    expect(freitag.indexOf('1.8')).toBeGreaterThanOrEqual(0);
    expect(freitag.indexOf('1.8')).toBeLessThan(freitag.indexOf('0.5'));
  });

  it('Steuerprofil nach dem Finanzplan (5.4), Datenkarte und Schritt widersprechen sich nicht; 0.5 und 5.1 mit richtigen Regeln', () => {
    const st = schritt('steuerprofil');
    expect(st.etappe).toBe(5);
    expect(SCHRITTE.indexOf(st)).toBeGreaterThan(SCHRITTE.indexOf(schritt('finanzplan')));
    expect(texte(st)).toMatch(/NUR in der Finanzplanung › Zahnrad/);
    expect(DATENKARTE.find(d => /Steuerparameter/.test(d.fakt))?.hier).toMatch(/Finanzplanung › Zahnrad/);
    expect(texte(schritt('altbestand'))).toMatch(/AUSDRÜCKLICH erklärter Einwilligung \(a\)/);
    expect(texte(schritt('jahresziele'))).toMatch(/erst bearbeiten, wenn 0\.5 „übernommen“ meldet/);
  });
});

describe('Onboarding-Prüfung: nur die Person der Sitzung, nie Werte, nichts grün ohne Arbeit', () => {
  it('persönliche Befunde gelten der angemeldeten Person — die zweite sieht nie den Stand der ersten', async () => {
    const erste = await pruefeAlles('erste');
    const zweite = await pruefeAlles('zweite');
    for (const k of ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'postfach', 'zoe']) {
      expect(erste[k]?.erfuellt, `erste ${k}`).toBe(true);
      expect(zweite[k]?.erfuellt, `zweite ${k}`).toBe(false);
    }
    for (const k of ['google', 'gmail', 'whoop']) expect(erste[k]?.erfuellt, k).toBe(false); // nicht eingerichtet
    const system = await pruefeAlles(null);
    for (const k of [...PERSOENLICHE_PRUEFUNGEN, ...INHABER_PRUEFUNGEN]) expect(system[k], k).toBeUndefined();
  });

  it('Inhaber-Prüfungen nur für den Inhaber; Instanz-Befunde für andere nur „Instanz eingerichtet: ja/nein“', async () => {
    const erste = await pruefeAlles('erste'); const zweite = await pruefeAlles('zweite');
    expect(erste.altbestand).toBeDefined();
    for (const k of INHABER_PRUEFUNGEN) expect(zweite[k], k).toBeUndefined();
    for (const k of INSTANZ_PRUEFUNGEN) expect(zweite[k].wert, k).toMatch(/^Instanz eingerichtet: (ja|nein)$/);
    expect(erste.adresse.wert).toBe('gesetzt, mit https');
  });

  it('Gemeinsames: Kartei, 0-Punkt-Konten, überfällige Rechnungen — nur Zähler', async () => {
    const b = await pruefeAlles('erste');
    expect(b.kontakte.erfuellt).toBe(true);
    expect(b.kontakte.wert).toMatch(/^1 Kontakt,/);
    expect(b.konten.erfuellt).toBe(false); // Stand vom 01.01. ist nicht frisch
    expect(b.posten.erfuellt).toBe(false);
    expect(b.posten.wert).toBe('1 Rechnung überfällig · 1 Posten ohne Fälligkeit');
    expect(b.ziele.erfuellt).toBe(false); // keine Jahresziele in der Planung (eine Vorgabe des Controllings zählt nie)
    expect(b.haushalt.erfuellt).toBe(true);
    expect(b.personen.erfuellt).toBe(true);
  });

  it('kein Befund trägt Geheimnis, Apple-ID, Adresse, Betrag, Name oder die Instanz-Adresse', async () => {
    const t = JSON.stringify(await pruefeAlles('erste')) + JSON.stringify(await pruefeAlles('zweite')) + JSON.stringify(await pruefeAlles(null));
    for (const m of ['GEHEIM', 'erste@test.invalid', 'abcd-efgh', '98765', '4321', '111.22', '111,22', 'Geheim', 'instanz-geheim', 'kontakt@test.invalid']) expect(t).not.toContain(m);
  });

  it('Sicherung: grün nur bei gelungenem Lauf mit age UND Wächter-Ping (und frisch) — sonst steht da, was fehlt', async () => {
    const datei = path.join(DATEN, 'system', 'sicherung.json');
    await fs.mkdir(path.dirname(datei), { recursive: true });
    const jetzt = new Date().toISOString();
    const pruef = async (j: Record<string, unknown>) => { await fs.writeFile(datei, JSON.stringify(j)); return (await pruefeAlles('erste')).sicherung; };
    expect((await pruef({ zeit: jetzt, ok: true, verfahren: 'age', ping: 'fehlt' })).wert).toBe('Wächter-Ping nicht eingerichtet');
    expect((await pruef({ zeit: jetzt, ok: true, verfahren: 'openssl', ping: 'ok' })).wert).toBe('nicht mit age verschlüsselt');
    expect((await pruef({ zeit: jetzt, ok: false, verfahren: 'age', ping: 'ok' })).erfuellt).toBe(false);
    expect((await pruef({ zeit: '2026-01-01T03:15:00Z', ok: true, verfahren: 'age', ping: 'ok' })).wert).toMatch(/nicht frisch/);
    expect((await pruef({ zeit: jetzt, ok: true, verfahren: 'age', ping: 'ok', datei: 'geheim-archiv.tar.gz.age' })).erfuellt).toBe(true);
    expect(JSON.stringify(await pruefeAlles('erste'))).not.toContain('geheim-archiv');
    await fs.rm(datei);
  });

  it('Gesundheits-Einwilligung: ein Widerruf zählt (nicht nur „irgendwann erklärt“)', async () => {
    const alt = await db.loadJson('gesundheit-einwilligungen');
    await db.saveJson('gesundheit-einwilligungen', { ereignisse: [
      { zeit: '2026-10-01T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: true, fassung: 'x', wortlaut: 'y', von: 'erste' },
      { zeit: '2026-10-02T08:00:00Z', person: 'erste', zweck: 'verarbeiten', an: false, fassung: 'x', wortlaut: 'y', von: 'erste' },
    ] });
    expect((await pruefeAlles('erste'))['gesundheit-einwilligung'].erfuellt).toBe(false);
    await db.saveJson('gesundheit-einwilligungen', alt);
  });

  it('iCloud nur aus der Server-Umgebung zählt nicht — eigener Hinweis', async () => {
    const v = await db.loadJson('icloud-verbindung--erste');
    await fs.rm(path.join(DATEN, 'icloud-verbindung--erste.json'));
    process.env.ICLOUD_APPLE_ID = 'umgebung@test.invalid'; process.env.ICLOUD_APP_PASSWORT = 'abcd-efgh-ijkl-mnop';
    try {
      const b = (await pruefeAlles('erste')).icloud;
      expect(b.erfuellt).toBe(false);
      expect(b.wert).toMatch(/Server-Umgebung/);
      expect(b.wert).not.toContain('umgebung@test.invalid');
    } finally {
      delete process.env.ICLOUD_APPLE_ID; delete process.env.ICLOUD_APP_PASSWORT;
      await db.saveJson('icloud-verbindung--erste', v);
    }
  });

  it('offene Posten des 0-Punkts werden eigens ausgewiesen (der Link „Rechnungen & Zahlungen“ zeigt sie nicht)', async () => {
    await db.saveJson('business-eroeffnung', { eintraege: [{ id: 'er-1', firma: 'kdv', stichtag: '2026-10-01', kontostand: 1000, verbindlichkeiten: [{ name: 'Geheimgläubiger', betrag: 50 }], gesetztVon: 'erste', gesetztAm: '2026-10-02T00:00:00Z' }] });
    try {
      const b = (await pruefeAlles('erste')).posten;
      expect(b.erfuellt).toBe(false);
      expect(b.wert).toMatch(/davon \d+ aus dem 0-Punkt \(dort Fälligkeit bzw\. neue Fassung\)/);
      expect(b.wert).not.toMatch(/Geheim|1000|50 €/);
      expect((await pruefeAlles('erste')).eroeffnung.wert).toMatch(/^1 von \d Business-Gesellschaften eröffnet$/);
    } finally { await fs.rm(path.join(DATEN, 'business-eroeffnung.json'), { force: true }); }
  });

  it('ein unlesbarer Bestand trifft nur seine Prüfungen — die Seite bleibt (Startfläche und Oberfläche fangen Fehler ab)', async () => {
    const datei = path.join(DATEN, 'finanzplan.json');
    const alt = await fs.readFile(datei, 'utf8');
    await fs.writeFile(datei, '{ kaputt');
    try {
      const b = await pruefeAlles('erste');
      expect(b.posten).toEqual({ erfuellt: false, wert: 'nicht prüfbar' });
      expect(b.konten).toEqual({ erfuellt: false, wert: 'nicht prüfbar' });
      expect(b.kontakte.erfuellt).toBe(true);
      expect(b['zwei-faktor'].erfuellt).toBe(true);
    } finally {
      for (const f of await fs.readdir(DATEN)) if (f.startsWith('finanzplan.json.corrupt') || f.startsWith('finanzplan.corrupt')) await fs.rm(path.join(DATEN, f), { force: true });
      await fs.writeFile(datei, alt);
    }
    expect(lies('app/api/startflaeche/route.ts')).toContain('fortschritt(personStreng(req)).catch(() => null)');
    expect(lies('components/os/OnboardingView.tsx')).toContain('if (!r.ok || !d)');
  });

  it('Altbestand (0.5): nur Inhaber, „n von 3 Teilen“; der Schritt nur auf Instanzen mit Altbestand (nicht Demo, nicht neu)', async () => {
    expect((await pruefeAlles('erste')).altbestand).toEqual({ erfuellt: false, wert: '0 von 3 Teilen übernommen bzw. entschieden' });
    await db.saveJson('gesundheit-koerper--erste', { v: 1, altbestand: '2026-10-09' });
    await db.saveJson('nordstern--haus-onb', { nordstern: { text: 'Geheimer Nordstern' }, altbestand: { nordstern: '2026-10-09' } });
    expect((await pruefeAlles('erste')).altbestand.wert).toBe('2 von 3 Teilen übernommen bzw. entschieden');
    await db.saveJson('nordstern--haus-onb', { nordstern: { text: 'Geheimer Nordstern' }, altbestand: { nordstern: '2026-10-09', kernziel: '2026-10-09' } });
    const b = await pruefeAlles('erste');
    expect(b.altbestand.erfuellt).toBe(true);
    expect(JSON.stringify(b)).not.toContain('Geheimer Nordstern');
    expect((await kontextFuer('erste'))?.altbestand).toBe(true);
    process.env.MAKE_OS_DEMO = '1';
    try { expect((await kontextFuer('erste'))?.altbestand).toBe(false); } finally { delete process.env.MAKE_OS_DEMO; }
    expect(schritteFuer({ ...INHABER, altbestand: false }).some(s => s.id === 'altbestand')).toBe(false);
    expect(schritteFuer(INHABER).some(s => s.id === 'altbestand')).toBe(true);
  });
});

type Antwort = { ok?: boolean; error?: string; erledigt: Record<string, { at: string; von: string }>; frueher: string[]; befunde: Record<string, { erfuellt: boolean; wert: string }>; ich: { inhaber: boolean; personen: number; privatFinanzen?: boolean; altbestand?: boolean } | null };
const route = async () => await import('@/app/api/onboarding/route');
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const hol = async (p: string): Promise<Antwort> => (await (await route()).GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': p } }))).json();
const setze = async (kopf: Record<string, string>, body: unknown) => (await route()).POST(new Request('http://test/api/onboarding', { method: 'POST', headers: kopf, body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('Onboarding-Häkchen (Route): je Person, sicherer Schreibweg', () => {
  it('GET liefert die persönlichen Befunde der Sitzung und die Rolle — und schreibt nichts', async () => {
    const vorher = (await fs.readdir(DATEN)).sort();
    const e = await hol('erste'); const z = await hol('zweite');
    expect((await fs.readdir(DATEN)).sort()).toEqual(vorher);
    expect(e.befunde['zwei-faktor'].erfuellt).toBe(true);
    expect(z.befunde['zwei-faktor'].erfuellt).toBe(false);
    expect(e.ich).toEqual({ inhaber: true, haupt: true, eingeladen: false, personen: 2, privatFinanzen: true, altbestand: true });
    expect(z.ich).toEqual({ inhaber: false, haupt: false, eingeladen: true, personen: 2, privatFinanzen: true, altbestand: true });
    expect(z.befunde.altbestand).toBeUndefined();
  });

  it('persönliche Häkchen bleiben bei der Person — die andere sieht sie nie; gemeinsame sehen alle (mit Speichername gespeichert)', async () => {
    expect((await setze(sitzung('zweite'), { id: 'ich-sicht', an: true })).status).toBe(200);
    expect((await setze(sitzung('zweite'), { id: 'stichtag', an: true })).status).toBe(200);
    const z = await hol('zweite'); const e = await hol('erste');
    expect(z.erledigt['ich-sicht']?.von).toBe('dir');
    expect(e.erledigt['ich-sicht']).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain(z.erledigt['ich-sicht'].at);
    expect(e.erledigt.stichtag?.von).toBe('Zora');
    const gemeinsam = await db.loadJson<{ erledigt: Record<string, { von: string }> }>('onboarding');
    expect(gemeinsam?.erledigt.stichtag.von).toBe('zweite');
    expect(gemeinsam?.erledigt['ich-sicht']).toBeUndefined();
    expect((await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding--zweite'))?.erledigt['ich-sicht']).toBeTruthy();
    expect((await setze(sitzung('zweite'), { id: 'ich-sicht', an: false })).status).toBe(200);
    expect((await hol('zweite')).erledigt['ich-sicht']).toBeUndefined();
  });

  it('unbekannte oder zu lange Kennung → 400 (nie gekürzt), falsches „an“ → 400, großer Körper → 413, nichts gespeichert', async () => {
    const vorher = JSON.stringify(await db.loadJson('onboarding'));
    expect((await setze(sitzung('erste'), { id: 'gibt-es-nicht', an: true })).status).toBe(400);
    expect((await setze(sitzung('erste'), { id: `ich-sicht${'x'.repeat(80)}`, an: true })).status).toBe(400);
    expect((await setze(sitzung('erste'), { id: 'stichtag', an: 'ja' })).status).toBe(400);
    expect((await setze(sitzung('erste'), { id: 'stichtag', an: true, polster: 'x'.repeat(5000) })).status).toBe(413);
    expect((await setze(sitzung('erste'), 'kein json')).status).toBe(400);
    expect(JSON.stringify(await db.loadJson('onboarding'))).toBe(vorher);
  });

  it('Dienstweg 403 (auch mit Person), ohne Person 401, fremder Haushalt 403', async () => {
    expect((await setze({ 'content-type': 'application/json', 'x-make-key': process.env.MAKE_OS_KEY!, 'x-make-person': 'erste' }, { id: 'stichtag' })).status).toBe(403);
    expect((await setze({ 'content-type': 'application/json' }, { id: 'stichtag' })).status).toBe(401);
    await db.saveJson('konten', { ...KONTEN, konten: [...KONTEN.konten, konto('k3', 'fremd', 'mitglied', { haushalt: 'anderes-haus' })] });
    try {
      expect((await setze(sitzung('fremd'), { id: 'ich-sicht' })).status).toBe(403);
      expect((await (await route()).GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': 'fremd' } }))).status).toBe(403);
    } finally { await db.saveJson('konten', KONTEN); }
  });

  it('Inhaber-Schritte nur der Inhaber; Privat-Schritte nicht für Konten mit „nur Business“ (weder gezählt noch abhakbar)', async () => {
    for (const id of ['datenschutz', 'update', 'eroeffnung', 'steckbrief', 'altbestand']) expect((await setze(sitzung('zweite'), { id, an: true })).status, id).toBe(403);
    expect((await setze(sitzung('erste'), { id: 'datenschutz', an: true })).status).toBe(200);
    expect((await hol('zweite')).erledigt.datenschutz?.von).toBe('Erika');
    await db.saveJson('konten', { ...KONTEN, konten: [...KONTEN.konten, konto('k4', 'partner', 'mitglied', { finanzRecht: 'business' })] });
    try {
      for (const id of ['ich-privatkonten', 'privat-fixkosten', 'finanzplan']) expect((await setze(sitzung('partner'), { id, an: true })).status, id).toBe(403);
      const p = await hol('partner');
      expect(p.ich?.privatFinanzen).toBe(false);
      const ids = schritteFuer(p.ich).map(s => s.id);
      for (const id of ['ich-privatkonten', 'privat-fixkosten', 'finanzplan']) expect(ids).not.toContain(id);
      expect((await setze(sitzung('partner'), { id: 'ich-sicht', an: true })).status).toBe(200);
    } finally { await db.saveJson('konten', KONTEN); }
  });
});

describe('Alte Häkchen und rote Befunde', () => {
  const ALT = { erledigt: {
    'malin-rundgang': { at: '2026-09-01T00:00:00.000Z', von: 'Malin' },
    'malin-konten': { at: '2026-09-02T00:00:00.000Z', von: 'Malin' },
    'kevin-ziele': { at: '2026-09-02T00:00:00.000Z', von: 'Kevin' },
    'kevin-kontakte': { at: '2026-09-02T00:00:00.000Z', von: 'Kevin' },
    'kevin-agenten': { at: '2026-09-02T00:00:00.000Z', von: 'Kevin' },
    'kevin-zoe': { at: '2026-09-03T00:00:00.000Z', von: 'Kevin' },
    'malin-telegram': { at: '2026-09-04T00:00:00.000Z', von: 'Malin' },
    updates: { at: '2026-09-05T00:00:00.000Z', von: 'Kevin' },
  } };

  it('alte Häkchen zählen nie — höchstens „bitte bestätigen“ bei Schritten ohne Prüfung und ohne Stichtagsbezug', () => {
    const m = hakenSicht(ALT, null, 'malin'); const k = hakenSicht(ALT, null, 'kevin');
    for (const s of [m, k]) expect(Object.keys(s.erledigt)).toEqual([]);
    // Seit Update 2 hat „Agenten“ eine Prüfung (B3 Teil 2) — ein altes Häkchen darf dort nie mehr „bitte bestätigen“ zeigen.
    expect(m.frueher).toEqual(['ich-rundgang', 'regeln']);
    expect(k.frueher).toEqual(['regeln']); // persönliche nur für die Person mit diesem Speichernamen
    for (const id of ['kontostaende', 'zahlenziele', 'kartei', 'ich-zoe']) expect([...m.frueher, ...k.frueher]).not.toContain(id);
    for (const [, neu] of Object.entries(ALT_ZU_NEU)) { const s = schritt(neu); if (s.pruefung || s.stichtag) expect(frueherErlaubt(s), neu).toBe(false); }
    expect(hakenSicht(ALT, null, null).frueher).toEqual(['regeln']);
  });

  it('Schreiben lässt alte Häkchen unangetastet liegen; bestätigt wird mit einem neuen Häkchen; Lesen schreibt nie', async () => {
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    await db.saveJson('onboarding', ALT);
    try {
      await hakenLesen('malin');
      expect(await db.loadJson('onboarding--malin')).toBeNull();
      const s = await hakenSetzen('malin', 'ich-rundgang', true);
      expect(s.erledigt['ich-rundgang']).toBeTruthy();
      expect(s.frueher).not.toContain('ich-rundgang');
      const g = await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding');
      for (const id of Object.keys(ALT.erledigt)) expect(g!.erledigt[id], id).toBeTruthy();
      await hakenSetzen('kevin', 'regeln', true);
      expect((await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding'))!.erledigt.updates).toBeTruthy();
    } finally { await db.saveJson('konten', KONTEN); await db.saveJson('onboarding', { erledigt: {} }); }
  });

  it('ein Häkchen schlägt nie einen roten Befund; „bestätigen“ braucht Prüfung UND Häkchen', () => {
    const kontost = schritt('kontostaende'), kartei = schritt('kartei');
    const rot = { erledigt: { kontostaende: { at: 'x', von: 'dir' } }, befunde: { konten: { erfuellt: false, wert: '0 von 2' } } };
    expect(istFertig(kontost, rot)).toBe(false);
    expect(istFertig(kartei, { erledigt: {}, befunde: { kontakte: { erfuellt: true, wert: 'x' } } })).toBe(false);
    expect(istFertig(kartei, { erledigt: { kartei: { at: 'x', von: 'dir' } }, befunde: { kontakte: { erfuellt: true, wert: 'x' } } })).toBe(true);
    expect(istFertig(kartei, { erledigt: { kartei: { at: 'x', von: 'dir' } }, befunde: { kontakte: { erfuellt: false, wert: 'x' } } })).toBe(false);
    // Update 2 (B3 Teil 2): „Agenten“ prüft den neuen Agenten-Bereich (ein Head eingestellt bzw. ein Thread) — dass alle durchgesehen sind,
    // sagt die Zahl nicht; darum Prüfung UND Häkchen.
    expect(schritt('agenten')).toMatchObject({ pruefung: 'agenten', bestaetigen: true });
    expect(lies('components/os/OnboardingView.tsx')).toContain('<details>'); // Anleitung bleibt bei erledigten Schritten aufklappbar
  });
});

describe('Fortschritt, Übersicht und die Karte auf Heute', () => {
  it('Inhaber zählt die Instanz mit, die zweite Person nicht; bei einer Person entfallen Schritte für zwei; Etappen-Reihenfolge', () => {
    const inhaber = schritteFuer(INHABER), zweite = schritteFuer(ZWEITE);
    expect(inhaber.some(s => s.id === 'pepper')).toBe(true);
    expect(zweite.some(s => s.id === 'pepper' || s.nurInhaber)).toBe(false);
    expect(zweite.some(s => s.id === 'zweite-einladung')).toBe(true);
    expect(inhaber.some(s => s.id === 'zweite-einladung')).toBe(false);
    expect(schritteFuer({ ...INHABER, personen: 1 }).some(s => s.nurMitMehreren)).toBe(false);
    for (const l of [inhaber, zweite]) for (let i = 1; i < l.length; i++) expect(l[i].etappe).toBeGreaterThanOrEqual(l[i - 1].etappe);
    // Übersicht: JEDE Person sieht alle ihre Schritte (eigene + gemeinsame + beim Inhaber Instanz und Inhaber-Spur).
    for (const s of SCHRITTE.filter(x => x.nurInhaber && !x.nurAltbestand)) expect(inhaber).toContain(s);
    expect(lies('components/os/OnboardingView.tsx')).toContain('const meine = schritteFuer(z?.ich ?? null)');
  });

  it('„einzeln“ und optionale zählen erst, wenn getan; „Als Nächstes“ ist nie ein späterer Schritt (nicht 0.7)', () => {
    const zweite = schritteFuer(ZWEITE);
    const leer = fortschrittVon(zweite, { erledigt: {}, befunde: {} });
    expect(leer.gesamt).toBe(zweite.filter(s => !s.optional && !s.spaeter).length);
    expect(fortschrittVon(zweite, { erledigt: { 'ich-rundgang': { at: 'x', von: 'dir' } }, befunde: {} }).gesamt).toBe(leer.gesamt + 1);
    const inhaber = schritteFuer(INHABER);
    const freitagFertig = Object.fromEntries(inhaber.filter(s => gruppeVon(s) === 'freitag').map(s => [s.id, { at: 'x', von: 'dir' }]));
    const befunde = Object.fromEntries(inhaber.filter(s => gruppeVon(s) === 'freitag' && s.pruefung).map(s => [s.pruefung!, { erfuellt: true, wert: 'x' }]));
    const n = fortschrittVon(inhaber, { erledigt: freitagFertig, befunde }).naechster!;
    expect(n.samstag).toBe(true);
    expect(n.id).not.toBe('sicherung-mac');
    expect(fortschrittVon(inhaber, { erledigt: {}, befunde: {} }).naechster?.spaeter).toBeUndefined();
  });

  it('fortschritt() rechnet je Person — die zweite Person hat weniger Schritte als der Inhaber', async () => {
    const e = await fortschritt('erste'); const z = await fortschritt('zweite');
    expect(e.gesamt).toBeGreaterThan(z.gesamt);
  });

  it('Heute: die Karte „Einrichtung“ steht vorne in jeder Sicht, das Widget gibt es im Katalog', () => {
    const v = lies('components/os/HeuteView.tsx');
    const std = v.slice(v.indexOf('export const HEUTE_STANDARD'));
    for (const sicht of ['alle', 'privat', 'business']) {
      const teil = std.slice(std.indexOf(`${sicht}: [`));
      expect(/\{ id: '([a-z-]+)'/.exec(teil)?.[1], sicht).toBe('einrichtung');
    }
    const w = lies('components/os/flaeche/widgets.tsx');
    expect(w).toContain("einrichtung: { art: 'einrichtung'");
    expect(w).toContain("{ art: 'einrichtung', label: 'Einrichtung'");
  });

  it('eine neue Standard-Karte rutscht auch in ein angepasstes Layout nach vorne', async () => {
    const { anwenden } = await import('@/lib/flaeche/modell');
    const std = [{ id: 'einrichtung', art: 'einrichtung', breite: 6 as const }, { id: 'anstehend', art: 'anstehend', breite: 4 as const }, { id: 'fokus', art: 'fokus', breite: 2 as const }];
    const gespeichert = { plaetze: [{ id: 'fokus', art: 'fokus', breite: 2 as const, einstellungen: {} }, { id: 'anstehend', art: 'anstehend', breite: 4 as const, einstellungen: {} }], versteckt: [], stand: 'x' };
    expect(anwenden(std, gespeichert).plaetze[0].id).toBe('einrichtung');
  });
});

describe('Register', () => {
  it('Bestände stehen im Speicher-Register (mit Angaben) und bei den Konto-Beständen — der gemeinsame nie als persönlicher', async () => {
    const { registerEintrag } = await import('@/lib/crm/speicher-register');
    for (const n of ['onboarding', 'onboarding--zweite']) {
      const e = registerEintrag(n);
      expect(e?.rechtsgrundlage, n).toMatch(/Art\. 6/);
      expect(e?.art15?.length, n).toBeGreaterThan(10);
    }
    const kd = await import('@/lib/datenschutz/konto-daten');
    expect(kd.PERSON_BESTAENDE.find(b => b.basis === 'onboarding')?.nurMitSuffix).toBe(true);
    expect(kd.personBestandNamen('kevin', ['onboarding', 'onboarding--kevin', 'onboarding--malin'])).toEqual([{ name: 'onboarding--kevin', export: true }]);
    const { ROUTEN_REGISTER } = await import('@/lib/zugang/routen-register');
    expect(ROUTEN_REGISTER.onboarding.methoden).toEqual({ GET: 'haushalt', POST: 'haushalt' });
    expect(ROUTEN_REGISTER.onboarding.getSchreibt).toBeUndefined(); // GET schreibt nichts (WHOOP wird roh gelesen)
  });
});
