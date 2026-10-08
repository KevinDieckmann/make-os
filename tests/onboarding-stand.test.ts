// ─── Onboarding „Einrichtung“ (08.10. Server-Stand, 08.10. spät Paket B0) ───────────────────────────────────────────────────
// Wächter:
//   (1) Daten: kein Verweis auf den alten Mac-Betrieb, keine Personennamen, jeder Prüf-Schlüssel bekannt und zur Ebene passend,
//       Kennungen eindeutig, jeder Link zeigt auf eine Seite, alle Etappen 0–8, Telegram- und Zulieferer-Schritt raus, alte Häkchen
//       zeigen auf vorhandene Schritte, Server-Schritte zeigen nur Befehle (keine Werte).
//   (2) Prüfungen: persönliche NUR für die Person der Sitzung — Sicht X bekommt nichts aus Y; Befunde tragen keine Werte
//       (Geheimnis, Apple-ID, Adresse, Beträge, Instanz-Adresse).
//   (3) Häkchen (Route): je Person getrennt, fremde nie sichtbar, unbekannte Kennung 400 (nie gekürzt), Dienstweg 403, ohne
//       Person 401, Inhaber-Schritt für die zweite Person 403, Speichername statt Vorname, alte Häkchen gehen nicht verloren.
//   (4) Fortschritt je Rolle, Karte vorne auf Heute, Register.
// Datenordner im Temp-Ordner, erfundene Konten — nie .data/.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs, existsSync, readdirSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';

const wurzel = await fs.mkdtemp(path.join(os.tmpdir(), 'make-os-onboarding-'));
process.env.MAKE_OS_DATEN_DIR = path.join(wurzel, 'daten');
process.env.MAKE_OS_BRAIN_INDEX = 'aus';
process.env.MAKE_OS_KEY = 'pruef-schluessel-onboarding-0123456789';
process.env.MAKE_OS_ADRESSE = 'https://instanz-geheim.example.invalid';
delete process.env.MAKE_OS_DATEN_SCHLUESSEL;
delete process.env.ICLOUD_APPLE_ID;
delete process.env.ICLOUD_APP_PASSWORT;
delete process.env.ICLOUD_PERSON;
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true, maxRetries: 3 }); });

const { SCHRITTE, ZONEN, ETAPPEN, DATENKARTE, ABLAUF, SPUREN, ALT_ZU_NEU, schritteFuer, schritteVon, fortschrittVon, istPersoenlich } = await import('@/lib/make-one/onboarding-data');
const { ALLE_PRUEFUNGEN, PERSOENLICHE_PRUEFUNGEN, GEMEINSAME_PRUEFUNGEN, pruefeAlles, fortschritt } = await import('@/lib/onboarding-status');
const { hakenSicht, altUebernehmen, hakenLesen, hakenSetzen } = await import('@/lib/onboarding-haken');

const konto = (id: string, sp: string, rolle: 'inhaber' | 'mitglied', extra: Record<string, unknown> = {}) =>
  ({ id, speicher: sp, email: `${sp}@test.invalid`, name: `${sp === 'erste' ? 'Erika' : 'Zora'} Test`, rolle, hash: 'x', salz: 'y', angelegt: '2026-01-01', teilt: { gesundheit: [] }, haushalt: 'haus-onb', ...extra });

let db: typeof import('@/lib/store/local-db');
beforeAll(async () => {
  await fs.mkdir(process.env.MAKE_OS_DATEN_DIR!, { recursive: true });
  db = await import('@/lib/store/local-db');
  // Erste Person (Inhaber): zweiter Faktor an, Postfach, Gesundheit erklärt, iCloud verbunden, ein ZOE-Gespräch. Zweite: nichts davon.
  await db.saveJson('konten', {
    konten: [
      konto('k1', 'erste', 'inhaber', { zweiterFaktor: { geheimnis: 'GEHEIM', seit: '2026-10-01', wiederherstellung: [] } }),
      konto('k2', 'zweite', 'mitglied'),
    ],
    einladungen: [],
  });
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

const TEXT_VERBOTEN = [/localhost/i, /\.env\.local/, /tailscale/i, /ipconfig/, /Kevins-IP/i, /auch Gesundheit/i, /npm install/, /start\.sh/, /iCloud-Ordner/i, /\.data\b/, /fd_p/];
/** Nur die Texte eines Schritts (nicht Kennung und Adresse — die alten Spur-Adressen /os/onboarding/kevin|malin bleiben bewusst). */
const texte = (s: { titel: string; warum: string; wie: string[]; danach?: string; befehl?: string; wo?: { label: string } }) => [s.titel, s.warum, ...s.wie, s.danach ?? '', s.befehl ?? '', s.wo?.label ?? ''].join(' \n ');
const alleTexte = () => [
  ...SCHRITTE.map(texte), ...ETAPPEN.flatMap(e => [e.titel, e.satz, ...(e.hinweise ?? []).flatMap(h => [h.titel, h.satz, h.wann])]),
  ...DATENKARTE.map(d => `${d.fakt} ${d.hier} ${d.nicht}`), ...ABLAUF.map(a => `${a.wann} ${a.was}`), ...SPUREN.map(s => `${s.titel} ${s.satz}`),
  ...ZONEN.map(z => JSON.stringify(z)),
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

describe('Onboarding-Daten (B0)', () => {
  it('kein Verweis auf den alten Mac-Betrieb oder „auch Gesundheit“ — und keine Personennamen in den Texten', () => {
    for (const t of alleTexte()) {
      for (const re of TEXT_VERBOTEN) expect(t, String(re)).not.toMatch(re);
      expect(t).not.toMatch(/\b(Kevin|Malin|Kevins|Malins)\b/);
    }
  });

  it('jeder Prüf-Schlüssel ist bekannt und passt zur Ebene (persönlich ↔ „ich“)', () => {
    const persoenlich = new Set<string>(PERSOENLICHE_PRUEFUNGEN);
    expect(new Set([...PERSOENLICHE_PRUEFUNGEN, ...GEMEINSAME_PRUEFUNGEN]).size).toBe(ALLE_PRUEFUNGEN.length);
    for (const s of SCHRITTE) {
      if (!s.pruefung) continue;
      expect(ALLE_PRUEFUNGEN, s.id).toContain(s.pruefung);
      expect(persoenlich.has(s.pruefung), `${s.id}: Ebene ${s.ebene} passt nicht zu ${s.pruefung}`).toBe(istPersoenlich(s));
    }
  });

  it('Kennungen eindeutig, jeder Link (Schritte und Datenkarte) zeigt auf eine vorhandene Seite', () => {
    const ids = SCHRITTE.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SCHRITTE) if (s.wo) expect(seiteDa(s.wo.href), `${s.id}: ${s.wo.href}`).toBe(true);
    for (const d of DATENKARTE) if (d.href) expect(seiteDa(d.href), `${d.fakt}: ${d.href}`).toBe(true);
  });

  it('alle Etappen 0–8 haben Schritte; Telegram- und Zulieferer-Schritt sind raus, die Hinweise stehen in den Etappen', () => {
    for (let e = 0; e <= 8; e++) expect(SCHRITTE.some(s => s.etappe === e), `Etappe ${e}`).toBe(true);
    expect(SCHRITTE.length).toBeGreaterThanOrEqual(70);
    for (const s of SCHRITTE) {
      expect(texte(s)).not.toMatch(/telegram/i);
      expect(s.id).not.toMatch(/telegram|zulieferer/);
    }
    const hinweise = ETAPPEN.flatMap(e => e.hinweise ?? []).map(h => `${h.titel} ${h.satz} ${h.wann}`).join(' ');
    expect(hinweise).toMatch(/WhatsApp/);
    expect(hinweise).toMatch(/Phase 1/);
    expect(hinweise).toMatch(/Zulieferer/);
    expect(hinweise).toMatch(/Update 2/);
  });

  it('Entscheidungen 08.10. stehen in den Texten (Stichtag 01.10., Haushalt führt das Ist, Verantwortlicher eingetragen)', () => {
    const t = SCHRITTE.map(texte).join(' ');
    expect(t).toContain('01.10.2026');
    expect(DATENKARTE.find(d => /Budget/.test(d.fakt))?.hier).toMatch(/Haushalt/);
    expect(texte(SCHRITTE.find(s => s.id === 'datenschutz')!)).toMatch(/Verantwortlicher/);
  });

  it('Server-Schritte zeigen Befehle mit Platzhaltern — keine Werte, keine Adressen', () => {
    for (const s of SCHRITTE.filter(x => x.befehl)) {
      expect(s.befehl, s.id).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
      expect(s.befehl, s.id).not.toMatch(/sslip|makeinnovation/);
      expect(s.befehl, s.id).not.toMatch(/[0-9a-f]{32,}/);
      expect(s.befehl, s.id).not.toMatch(/(PEPPER|KEY|SECRET|PASSWORT|TOKEN|SCHLUESSEL)[A-Z_]*=\s*[^<\s]/); // Geheimnisse nur als <Platzhalter>
    }
  });

  it('jedes alte Häkchen zeigt auf einen vorhandenen Schritt', () => {
    for (const [alt, neu] of Object.entries(ALT_ZU_NEU)) expect(SCHRITTE.some(s => s.id === neu), `${alt} → ${neu}`).toBe(true);
  });

  it('Spuren: neutrale Titel, Kennungen und Adressen bleiben; persönliche Spuren tragen „Meine Einrichtung“', () => {
    expect(SPUREN.map(s => s.titel)).toEqual(['Instanz & Gemeinsam', 'Inhaber', 'Zweite Person']);
    expect(SPUREN.map(s => s.href)).toEqual(['/os/onboarding', '/os/onboarding/kevin', '/os/onboarding/malin']);
    for (const sp of ['kevin', 'malin'] as const) expect(schritteVon(sp).some(s => s.id === 'ich-rundgang' && s.spur === 'ich')).toBe(true);
    for (const sp of ['kevin', 'malin'] as const) for (const id of ['ich-whoop', 'ich-rundgang', 'ich-bauplan']) expect(schritteVon(sp).map(s => s.id), `${sp}: ${id}`).toContain(id);
  });
});

describe('Onboarding-Prüfung: nur die Person der Sitzung, nie Werte', () => {
  it('persönliche Befunde gelten der angemeldeten Person — die zweite sieht nie den Stand der ersten', async () => {
    const erste = await pruefeAlles('erste');
    const zweite = await pruefeAlles('zweite');
    for (const k of ['zwei-faktor', 'gesundheit-einwilligung', 'icloud', 'postfach', 'zoe']) {
      expect(erste[k]?.erfuellt, `erste ${k}`).toBe(true);
      expect(zweite[k]?.erfuellt, `zweite ${k}`).toBe(false);
    }
    for (const k of ['google', 'gmail', 'whoop']) expect(erste[k]?.erfuellt, k).toBe(false); // nicht eingerichtet
    const system = await pruefeAlles(null);
    for (const k of PERSOENLICHE_PRUEFUNGEN) expect(system[k], k).toBeUndefined();
  });

  it('gemeinsame Prüfungen lesen Kartei, 0-Punkt-Konten, überfällige Rechnungen — und zeigen nur Zähler', async () => {
    const b = await pruefeAlles('erste');
    expect(b.kontakte.erfuellt).toBe(true);
    expect(b.kontakte.wert).toMatch(/^1 Kontakt,/);
    expect(b.konten.erfuellt).toBe(false); // Stand vom 01.01. ist nicht frisch
    expect(b.posten.erfuellt).toBe(false);
    expect(b.posten.wert).toMatch(/1 Rechnung überfällig · 1 Zahlung ohne Fälligkeit/);
    expect(b.ziele.erfuellt).toBe(false); // keine Jahresziele in der Planung (eine Vorgabe des Controllings zählt nie)
    expect(b.haushalt.erfuellt).toBe(true);
    expect(b.personen.erfuellt).toBe(true);
    expect(b.adresse.erfuellt).toBe(true);
  });

  it('kein Befund trägt Geheimnis, Apple-ID, Adresse, Betrag, Name oder die Instanz-Adresse', async () => {
    const t = JSON.stringify(await pruefeAlles('erste')) + JSON.stringify(await pruefeAlles('zweite')) + JSON.stringify(await pruefeAlles(null));
    for (const m of ['GEHEIM', 'erste@test.invalid', 'abcd-efgh', '98765', '4321', '111.22', '111,22', 'Geheim', 'instanz-geheim', 'kontakt@test.invalid']) expect(t).not.toContain(m);
  });
});

type Antwort = { ok?: boolean; error?: string; erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, { erfuellt: boolean }>; ich: { inhaber: boolean; personen: number } | null };
const route = async () => await import('@/app/api/onboarding/route');
const sitzung = (p: string) => ({ 'content-type': 'application/json', 'x-make-user': p });
const hol = async (p: string): Promise<Antwort> => (await (await route()).GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': p } }))).json();
const setze = async (kopf: Record<string, string>, body: unknown) => (await route()).POST(new Request('http://test/api/onboarding', { method: 'POST', headers: kopf, body: typeof body === 'string' ? body : JSON.stringify(body) }));

describe('Onboarding-Häkchen (Route): je Person, sicherer Schreibweg', () => {
  it('GET liefert die persönlichen Befunde der Sitzung und die Rolle', async () => {
    const e = await hol('erste'); const z = await hol('zweite');
    expect(e.befunde['zwei-faktor'].erfuellt).toBe(true);
    expect(z.befunde['zwei-faktor'].erfuellt).toBe(false);
    expect(e.ich).toEqual({ inhaber: true, personen: 2 });
    expect(z.ich).toEqual({ inhaber: false, personen: 2 });
  });

  it('persönliche Häkchen bleiben bei der Person — die andere sieht sie nie; gemeinsame sehen alle (mit Speichername gespeichert)', async () => {
    expect((await setze(sitzung('zweite'), { id: 'ich-sicht', an: true })).status).toBe(200);
    expect((await setze(sitzung('zweite'), { id: 'stichtag', an: true })).status).toBe(200);
    const z = await hol('zweite'); const e = await hol('erste');
    expect(z.erledigt['ich-sicht']?.von).toBe('dir');
    expect(e.erledigt['ich-sicht']).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain(z.erledigt['ich-sicht'].at);
    expect(e.erledigt.stichtag?.von).toBe('Zora'); // Anzeige aus dem Konto …
    const gemeinsam = await db.loadJson<{ erledigt: Record<string, { von: string }> }>('onboarding');
    expect(gemeinsam?.erledigt.stichtag.von).toBe('zweite'); // … gespeichert der Speichername, nie der Vorname
    expect(gemeinsam?.erledigt['ich-sicht']).toBeUndefined();
    expect((await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding--zweite'))?.erledigt['ich-sicht']).toBeTruthy();
    // Häkchen wieder entfernen
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
    await db.saveJson('konten', { ...(await db.loadJson<Record<string, unknown>>('konten')), konten: [...((await db.loadJson<{ konten: unknown[] }>('konten'))!.konten), konto('k3', 'fremd', 'mitglied', { haushalt: 'anderes-haus' })] });
    expect((await setze(sitzung('fremd'), { id: 'ich-sicht' })).status).toBe(403);
    expect((await (await route()).GET(new Request('http://test/api/onboarding', { headers: { 'x-make-user': 'fremd' } }))).status).toBe(403);
    await db.saveJson('konten', { ...(await db.loadJson<Record<string, unknown>>('konten')), konten: ((await db.loadJson<{ konten: { speicher: string }[] }>('konten'))!.konten).filter(k => k.speicher !== 'fremd') });
  });

  it('Inhaber-Schritte hakt nur der Inhaber ab (zweite Person 403, Inhaber 200)', async () => {
    for (const id of ['datenschutz', 'update', 'eroeffnung', 'steckbrief']) {
      const r = await setze(sitzung('zweite'), { id, an: true });
      expect(r.status, id).toBe(403);
    }
    expect((await setze(sitzung('erste'), { id: 'datenschutz', an: true })).status).toBe(200);
    expect((await hol('zweite')).erledigt.datenschutz?.von).toBe('Erika');
  });
});

describe('Alte Häkchen (Spuren kevin-…/malin-…) gehen nicht verloren', () => {
  const ALT = { erledigt: {
    'malin-rundgang': { at: '2026-09-01T00:00:00.000Z', von: 'Malin' },
    'malin-konten': { at: '2026-09-02T00:00:00.000Z', von: 'Malin' },
    'kevin-zoe': { at: '2026-09-03T00:00:00.000Z', von: 'Kevin' },
    'malin-telegram': { at: '2026-09-04T00:00:00.000Z', von: 'Malin' },
    updates: { at: '2026-09-05T00:00:00.000Z', von: 'Kevin' },
    regeln: { at: '2026-09-06T00:00:00.000Z', von: 'Kevin' },
  } };

  it('beim Lesen: persönliche nur für die Person mit diesem Speichernamen, gemeinsame für alle', () => {
    const m = hakenSicht(ALT, null, 'malin');
    const k = hakenSicht(ALT, null, 'kevin');
    expect(m['ich-rundgang']?.at).toBe('2026-09-01T00:00:00.000Z');
    expect(k['ich-rundgang']).toBeUndefined();
    expect(k['ich-zoe']?.at).toBe('2026-09-03T00:00:00.000Z');
    expect(m['ich-zoe']).toBeUndefined();
    expect(m.kontostaende?.von).toBe('malin');
    expect(k.kontostaende?.von).toBe('malin');
    expect(k.regeln?.at).toBe('2026-09-06T00:00:00.000Z'); // vorhandenes neues Häkchen gewinnt vor `updates`
    expect(hakenSicht(ALT, null, null)['ich-rundgang']).toBeUndefined();
  });

  it('beim Schreiben: übernommen nur für die schreibende Person; Unbekanntes bleibt liegen; Lesen schreibt nie', async () => {
    const r = altUebernehmen(ALT, 'malin');
    expect(Object.keys(r.eigen)).toEqual(['ich-rundgang']);
    expect(r.gemeinsam.erledigt['malin-rundgang']).toBeUndefined();
    expect(r.gemeinsam.erledigt['kevin-zoe']).toBeTruthy(); // gehört einer anderen Person — bleibt
    expect(r.gemeinsam.erledigt['malin-telegram']).toBeTruthy(); // kein Schritt mehr — bleibt liegen
    expect(r.gemeinsam.erledigt.kontostaende?.von).toBe('malin');

    // Von Ende zu Ende mit eigenen Konten „kevin“/„malin“ (Speichernamen der alten Spuren).
    const vorher = await db.loadJson('konten');
    await db.saveJson('konten', { konten: [konto('k1', 'kevin', 'inhaber'), konto('k2', 'malin', 'mitglied')], einladungen: [] });
    await db.saveJson('onboarding', ALT);
    await hakenLesen('malin');
    expect(await db.loadJson('onboarding--malin')).toBeNull(); // Lesen schreibt nie
    await hakenSetzen('malin', 'ich-sicht', true);
    const eigen = await db.loadJson<{ erledigt: Record<string, unknown> }>('onboarding--malin');
    expect(Object.keys(eigen!.erledigt).sort()).toEqual(['ich-rundgang', 'ich-sicht']);
    expect((await hakenLesen('kevin'))['ich-zoe']).toBeTruthy();
    expect((await hakenLesen('kevin'))['ich-rundgang']).toBeUndefined();
    await db.saveJson('konten', vorher);
  });
});

describe('Fortschritt je Rolle und die Karte auf Heute', () => {
  it('Inhaber zählt die Instanz mit, die zweite Person nicht; bei einer Person entfallen Schritte für zwei', () => {
    const inhaber = schritteFuer({ inhaber: true, personen: 2 });
    const zweite = schritteFuer({ inhaber: false, personen: 2 });
    expect(inhaber.some(s => s.id === 'pepper')).toBe(true);
    expect(zweite.some(s => s.id === 'pepper' || s.nurInhaber)).toBe(false);
    expect(zweite.some(s => s.id === 'zweite-einladung')).toBe(true);
    expect(inhaber.some(s => s.id === 'zweite-einladung')).toBe(false);
    expect(schritteFuer({ inhaber: true, personen: 1 }).some(s => s.nurMitMehreren)).toBe(false);
    // Optionale zählen erst, wenn sie getan sind.
    const leer = fortschrittVon(zweite, { erledigt: {}, befunde: {} });
    expect(leer.gesamt).toBe(zweite.filter(s => !s.optional).length);
    expect(fortschrittVon(zweite, { erledigt: { 'ich-whoop': { at: 'x', von: 'dir' } }, befunde: {} }).gesamt).toBe(leer.gesamt + 1);
  });

  it('fortschritt() rechnet je Person — die zweite Person hat weniger Schritte als der Inhaber', async () => {
    const e = await fortschritt('erste'); const z = await fortschritt('zweite');
    expect(e.gesamt).toBeGreaterThan(z.gesamt);
    expect(z.fertig).toBeGreaterThanOrEqual(1); // „Stichtag“ (gemeinsam) hat die zweite Person abgehakt
  });

  it('Heute: die Karte „Einrichtung“ steht vorne in jeder Sicht, das Widget gibt es im Katalog', () => {
    const v = readFileSync(path.join(process.cwd(), 'components/os/HeuteView.tsx'), 'utf8');
    const std = v.slice(v.indexOf('export const HEUTE_STANDARD'));
    for (const sicht of ['alle', 'privat', 'business']) {
      const teil = std.slice(std.indexOf(`${sicht}: [`));
      const erste = /\{ id: '([a-z-]+)'/.exec(teil)?.[1];
      expect(erste, sicht).toBe('einrichtung');
    }
    const w = readFileSync(path.join(process.cwd(), 'components/os/flaeche/widgets.tsx'), 'utf8');
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
  });
});
