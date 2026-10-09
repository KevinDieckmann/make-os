/* eslint-disable @typescript-eslint/no-explicit-any -- die Tests lesen beliebige Bestände als JSON */
// ─── Neustart-Umzug (09.10.2026): neue leere Instanz, Kartei + Markttraktion + eigene Aufgaben kommen mit ────────────────
// Erfundene Daten in Wegwerf-Ordnern (nie .data): alter Ordner verschlüsselt (v2), Dateiablage, Grabsteine, Absichten.
// Geprüft: Probelauf schreibt nichts · nichts aus Kartei/CRM geht verloren (jede Kennung, jeder Text) · System-Aufgaben,
// Papierkorb und Archiv bleiben draußen · Meilenstein-Listen ziehen nach „Übernommen“ · Dateien nur, was mitkommt (+ Belege) ·
// die App liest den neuen Ordner (local-db) · Grabstein greift in der neuen Instanz · Format kompatibel (v1) · Namen-Abbildung
// mit neuer AAD · Abbrüche (unlesbar, nicht leer, `.data`, App läuft, offene Absichten, anderer Pepper) · Kommandozeile.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const { wurzel, neuHaupt, PEPPER } = await vi.hoisted(async () => {
  const fsm = await import('node:fs');
  const os = await import('node:os');
  const { default: p } = await import('node:path');
  const wurzel = fsm.mkdtempSync(p.join(os.tmpdir(), 'make-os-neustart-'));
  const neuHaupt = p.join(wurzel, 'neu-haupt');
  const KEY = 'pruef-schluessel-neustart-umzug-nicht-echt';
  const PEPPER = 'pruef-pepper-neustart-umzug-nicht-echt-0123456789';
  Object.assign(process.env, {
    MAKE_OS_DATEN_DIR: neuHaupt, MAKE_OS_DATEN_SCHLUESSEL: KEY, MAKE_OS_PEPPER: PEPPER, MAKE_OS_FORMAT: 'v2',
    MAKE_OS_GRABSTEINE_DIR: p.join(wurzel, 'grabsteine'), MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_OHNE_APPLE: '1',
  });
  return { wurzel, neuHaupt, KEY, PEPPER };
});

import { schluesselRing, huelleImModus, huelleOeffnen, huellenVersion } from '@/lib/store/huelle.mjs';
import { binImModus, binOeffnen, binVersion } from '@/lib/store/datei-huelle.mjs';
import { umzugLaufen, UmzugAbbruch } from '@/lib/neustart/umzug-lauf.mjs';
import * as K from '@/lib/neustart/umzug.mjs';
import { SPEICHER_REGISTER } from '@/lib/crm/speicher-register';

const H = 'demo-haus';
const ENV = { ...process.env } as NodeJS.ProcessEnv;
let nr = 0;
const kennung = (p: string) => `${p}-00000000-0000-4000-8000-${String(++nr).padStart(12, '0')}`;

async function schreibe(ordner: string, name: string, wert: unknown, env: NodeJS.ProcessEnv = ENV) {
  await fs.mkdir(ordner, { recursive: true });
  const ring = schluesselRing(env);
  const text = JSON.stringify(wert);
  await fs.writeFile(path.join(ordner, `${name}.json`), ring.aktiv ? huelleImModus(text, ring.aktiv, name, env) : text);
}
async function lies<T = any>(ordner: string, name: string, env: NodeJS.ProcessEnv = ENV): Promise<T> {
  const roh = await fs.readFile(path.join(ordner, `${name}.json`), 'utf8');
  const o = JSON.parse(roh);
  return JSON.parse(huellenVersion(o) ? huelleOeffnen(o, schluesselRing(env), name).text : roh);
}
async function datei(ordner: string, h: string, id: string, inhalt: string, env: NodeJS.ProcessEnv = ENV) {
  await fs.mkdir(path.join(ordner, 'dateien', h), { recursive: true });
  const ring = schluesselRing(env);
  await fs.writeFile(path.join(ordner, 'dateien', h, `${id}.bin`), ring.aktiv ? binImModus(Buffer.from(inhalt), ring.aktiv, h, id, env) : inhalt);
}
const pdf = (n: string) => ({ name: `${n}.pdf`, typ: 'pdf', groesse: `inhalt ${n}`.length, verschluesselt: true });

/** Ein erfundener alter Datenordner. `kontakteZahl` erzeugt zusätzlich viele Personen (nichts darf verloren gehen). */
async function altBauen(ordner: string, opt: { kontakteZahl?: number; grabsteinMarke?: string; absichten?: unknown[]; env?: NodeJS.ProcessEnv } = {}) {
  const env = opt.env ?? ENV;
  const s = (n: string, w: unknown) => schreibe(ordner, n, w, env);
  await s('konten', { konten: [
    { id: 'k-1', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena', rolle: 'inhaber', haushalt: H, hash: 'x', salz: 'y', angelegt: '2026-09-01', teilt: { gesundheit: [] } },
    { id: 'k-2', speicher: 'jonas', email: 'jonas@example.invalid', name: 'Jonas', rolle: 'mitglied', haushalt: H, hash: 'x', salz: 'y', angelegt: '2026-09-02', teilt: { gesundheit: [] } },
  ], einladungen: [] });
  const viele = Array.from({ length: opt.kontakteZahl ?? 0 }, (_, i) => ({ id: `c-viel-${i}`, vorname: `Person${i}`, nachname: 'Beispiel', email: `p${i}@example.invalid`, besitzer: i % 2 ? 'lena' : 'jonas', aktivitaeten: [{ am: '2026-09-10T10:00:00Z', art: 'notiz', text: `Notiz ${i}`, von: 'jonas' }] }));
  await s('kontakte', { kontakte: [
    { id: 'c-1', vorname: 'Anna', nachname: 'Beispiel', email: 'anna@example.invalid', firmaId: 'f-1', besitzer: 'lena', privatNotiz: 'nur für Lena', privatNotizVon: 'lena',
      netzwerk: { lena: { stand: 'vernetzt' }, jonas: { stand: 'angefragt' } },
      einwilligungen: [{ kanal: 'mail', grundlage: 'einwilligung', am: '2026-09-01', belegRef: 'd-beleg-aufgabe-1', wortlaut: 'Ja', erfasstVon: 'lena' }],
      aktivitaeten: [{ am: '2026-09-02T09:00:00Z', art: 'meeting', text: 'Kennenlernen', von: 'lena', terminUid: 'u-1' }] },
    { id: 'c-2', vorname: 'Bert', nachname: 'Muster', email: 'bert@example.invalid', werbesperre: true },
    { id: 'c-3', vorname: 'Clara', nachname: 'Probe', eingeschraenkt: { seit: '2026-09-05', grund: 'Antrag', von: 'lena' } },
    { id: 'c-grab', vorname: 'Gerd', nachname: 'Grab', email: 'grab@example.invalid' },
    ...viele,
  ] });
  await s('crm', {
    firmen: [{ id: 'f-1', name: 'Beispiel GmbH' }, ...Array.from({ length: Math.ceil((opt.kontakteZahl ?? 0) / 10) }, (_, i) => ({ id: `f-viel-${i}`, name: `Firma ${i}` }))],
    chancen: [{ id: 'ch-1', titel: 'Beratung', firmaId: 'f-1', besitzer: 'jonas', stufe: 'angebot' }],
    mandate: [{ id: 'm-1', kunde: 'Beispiel GmbH', firmaId: 'f-1', gesellschaft: 'ug', zustaendig: 'lena' }, { id: 'm-2', kunde: 'Beispiel GmbH', firmaId: 'f-1', gesellschaft: 'g-11111111-2222-4333-8444-555555555555', zustaendig: 'jonas' }],
    leistungen: [{ id: 'l-1', name: 'Paket A' }],
    events: [{ id: 'e-1', titel: 'Abend', checkliste: [{ id: 'p1', text: 'Raum', aufgabeId: 'ev-e-1-p1' }] }],
    teilnahmen: [{ id: 't-e1-c1', eventId: 'e-1', kontaktId: 'c-1', status: 'da' }],
    sitzungen: [{ id: 'ph-1' }], antraege: [{ id: 'an-1', art: 'auskunft' }], verarbeitungen: [{ id: 'vv-1', name: 'Kontakte' }],
    segmente: [{ id: 'seg-1' }], beitraege: [{ id: 'b-1' }], newsletter: [{ id: 'nl-1' }],
    kampagnen: [{ id: 'k1', name: 'Herbst', kontaktIds: ['c-1'], schritte: [{ id: 's1', text: 'Anrufen', aufgabeId: 'kp-k1-s1' }] }],
    followups: [{ id: 'fu-1', kontaktId: 'c-1', aufgabeId: 't-follow', status: 'offen' }, { id: 'fu-2', kontaktId: 'c-1', aufgabeId: 't-korb', status: 'offen' }],
    angebote: [{ id: 'ang-1', gesellschaft: 'ug', lauf: { jahr: 2026, nr: 7 } }],
    wertelisten: { labels: ['A'] },
  });
  await s(`crm-sperrliste--${H}`, { eintraege: [{ h: ['a'.repeat(64)], grund: 'werbesperre', am: '2026-09-01' }] });
  await s('crm-loeschprotokoll', { eintraege: [{ id: 'lp-1', am: '2026-09-03', grund: 'antrag', status: 'vollstaendig' }] });
  await s(`kennung-alias--${H}`, { alias: { 'c-alt': 'c-1' } });
  await s(`uebergabe-journal--${H}`, { eintraege: [{ eventId: 'e-1', anzahl: 1 }] });
  await s('events-geloescht', { eintraege: [{ id: 'e-weg', am: '2026-09-04' }] });
  await s('crm-scoring', { fassung: 3, mql: 9 });
  await s('traktion-verlauf', { tage: [{ tag: '2026-09-01', wert: 40 }] });
  await s('traktion-index', { verlauf: [], schwellen: {} });
  await s('prospects', { eintraege: [{ id: 'pr-1', name: 'Ziel AG' }] });
  await s(`netzwerken-erfassungen--${H}`, { eintraege: [{ id: 'nw-1', fertig: true }] });
  await s('visitenkarten--lena', { profile: [{ id: 'v-1', name: 'Lena' }] });
  await s('datenschutz-pannen', { pannen: [] });
  await s('crm-import-konflikte', { konflikte: [] });
  const { pepperFingerabdruck } = await import('@/lib/datenschutz/pepper');
  await s('datenschutz-migration', { v2: { pepper: pepperFingerabdruck(), am: '2026-09-30', sperrliste: 1, protokoll: 0 } });
  if (opt.grabsteinMarke !== undefined) await s('datenschutz-grabsteine', { stand: opt.grabsteinMarke, am: '2026-09-30', angewendet: 0 });
  await s(`crm-dateien--${H}`, { eintraege: [
    { id: 'd-vertrag-0001', art: 'vertrag', kontaktId: 'c-1', datei: pdf('vertrag'), hochgeladenAm: '2026-09-01', hochgeladenVon: 'lena' },
    { id: 'd-angebot-0001', art: 'angebot', angebotId: 'ang-1', firmaId: 'f-1', datei: pdf('angebot'), hochgeladenAm: '2026-09-02', hochgeladenVon: 'jonas' },
    { id: 'd-ohnedatei-01', art: 'angebot', firmaId: 'f-1', hochgeladenAm: '2026-09-02', hochgeladenVon: 'jonas' },
    { id: 'd-fehlt-00001', art: 'vertrag', kontaktId: 'c-1', datei: pdf('fehlt'), hochgeladenAm: '2026-09-02', hochgeladenVon: 'jonas' },
  ] });
  await datei(ordner, H, 'd-vertrag-0001', 'inhalt vertrag', env);
  await datei(ordner, H, 'd-angebot-0001', 'inhalt angebot', env);
  await s(`aufgaben-dateien--${H}`, { eintraege: [
    { id: 'd-aufgabe-0001', art: 'sonstiges', projektId: 'p-eigen', aufgabeId: 't-eigen', bereich: 'privat', datei: pdf('aufgabe1'), hochgeladenAm: '2026-09-03', hochgeladenVon: 'lena' },
    { id: 'd-aufgabe-0002', art: 'sonstiges', aufgabeId: 'steuer-ust-2026', bereich: 'business', datei: pdf('aufgabe2'), hochgeladenAm: '2026-09-03', hochgeladenVon: 'lena' },
    { id: 'd-beleg-aufgabe-1', art: 'sonstiges', aufgabeId: 'hd-v1', bereich: 'business', datei: pdf('beleg'), hochgeladenAm: '2026-09-03', hochgeladenVon: 'lena' },
    { id: 'd-ms-00000001', art: 'sonstiges', projektId: 'pm-privat', listeId: 'lm-ms1-abc', aufgabeId: 't-ms', bereich: 'privat', datei: pdf('ms'), hochgeladenAm: '2026-09-03', hochgeladenVon: 'lena' },
    { id: 'd-projekt-0001', art: 'sonstiges', projektId: 'p-eigen', bereich: 'privat', datei: pdf('projekt'), hochgeladenAm: '2026-09-03', hochgeladenVon: 'lena' },
  ] });
  for (const [id, n] of [['d-aufgabe-0001', 'aufgabe1'], ['d-aufgabe-0002', 'aufgabe2'], ['d-beleg-aufgabe-1', 'beleg'], ['d-ms-00000001', 'ms'], ['d-projekt-0001', 'projekt']]) await datei(ordner, H, id, `inhalt ${n}`, env);
  await datei(ordner, H, 'd-waise-00001', 'ohne eintrag', env);
  const t = (id: string, felder: Record<string, unknown> = {}) => ({ id, projectId: '', title: `Titel ${id}`, status: 'todo', priority: 'medium', assignee: 'lena', tags: [], subTasks: [], dependencies: [], sortOrder: 0, createdAt: '2026-09-01T08:00:00Z', updatedAt: '2026-09-01T08:00:00Z', ...felder });
  await s('tasks', {
    umbauVersion: 3,
    projects: [
      { id: 'p-eigen', title: 'Eigenes', category: 'joint', owner: 'both', color: '#111111', tags: [], archived: false, spaceId: 'privat', zielId: 'z-1', createdAt: 'x', updatedAt: 'x' },
      { id: 'p-korb', title: 'Weg', category: 'joint', owner: 'both', color: '#111111', tags: [], archived: false, spaceId: 'privat', geloeschtAm: '2026-09-05', createdAt: 'x', updatedAt: 'x' },
      { id: 'p-archiv', title: 'Alt', category: 'business', owner: 'both', color: '#111111', tags: [], archived: false, spaceId: 'kdv', archiviertAm: '2026-09-29', archivId: 'na-1', createdAt: 'x', updatedAt: 'x' },
      { id: 'p-hand', title: 'Von Hand abgelegt', category: 'business', owner: 'both', color: '#111111', tags: [], archived: true, spaceId: 'kdv', createdAt: 'x', updatedAt: 'x' },
      { id: 'pm-privat', title: 'Meilensteine', category: 'joint', owner: 'both', color: '#E0A84E', tags: [], archived: false, spaceId: 'privat', createdAt: 'x', updatedAt: 'x' },
    ],
    listen: [
      { id: 'l-1', projektId: 'p-eigen', titel: 'Liste', sortOrder: 1 },
      { id: 'l-archiv', projektId: 'p-eigen', titel: 'Archivierte Liste', sortOrder: 2, archiviertAm: '2026-09-29', archivId: 'na-1' },
      { id: 'lm-ms1-abc', projektId: 'pm-privat', titel: 'Umzug planen', sortOrder: 20261101 },
      { id: 'lm-leer-xyz', projektId: 'pm-privat', titel: 'Leerer Meilenstein', sortOrder: 20261201 },
    ],
    statusEigen: [{ id: 'st-1', spaceId: 'privat', label: 'Wartet', farbe: '#222222', basis: 'blocked', sortOrder: 1 }],
    vorlagen: [{ id: 'v-1', art: 'liste', titel: 'Vorlage', inhalt: { aufgaben: [] } }],
    tasks: [
      t('t-eigen', { projectId: 'p-eigen', listeId: 'l-1', angelegtVon: 'lena', zielId: 'z-1', bezug: { kontaktId: 'c-1', firmaId: 'f-1' }, abhaengigVon: ['steuer-ust-2026', 't-unter'], dependencies: [{ blockedByTaskId: 'steuer-ust-2026' }, { blockedByTaskId: 't-unter' }], zoe: { status: 'wartet_freigabe', stapelId: 's-1', von: 'lena' }, sichtbarkeit: 'nur-ich' }),
      t('t-unter', { projectId: 'p-eigen', listeId: 'l-1', parentId: 't-eigen' }),
      t('t-enkel', { projectId: 'p-eigen', listeId: 'l-1', parentId: 't-unter', assignee: 'jonas' }),
      t('steuer-ust-2026'), t('steuer-ust-2026-u1', { parentId: 'steuer-ust-2026' }),
      t('beleg-b1'), t('vte-g1-v1'), t('loeschfrist-kontakte'), t('mahn-r1-1'), t('hof-v1'), t('md-art17-pruefen'), t('hd-v1', { tags: ['head-sales'] }),
      t('ev-e-1-p1', { bezug: { firmaId: 'f-1' } }), t('kp-k1-s1'), t('nw-e1'), t('ueb-1', { assignee: 'jonas' }), t('t-follow', { bezug: { kontaktId: 'c-1' } }),
      t('w-abc-20261001', { serieId: 't-serie', wiederholung: { regel: 'woechentlich', wochentage: [1] } }), t('t-serie', { status: 'done', serieId: 't-serie' }),
      t('t-korb', { geloeschtAm: '2026-09-06' }), t('t-unter-korb', { parentId: 't-korb' }), t('t-im-korb-projekt', { projectId: 'p-korb' }),
      t('t-archiv', { archiviertAm: '2026-09-29', archivId: 'na-1' }), t('t-im-archiv-projekt', { projectId: 'p-archiv' }),
      t('t-hand', { projectId: 'p-hand' }),
      t('t-ms', { projectId: 'pm-privat', listeId: 'lm-ms1-abc', zoe: { status: 'freigegeben', von: 'lena' } }), t('t-ms-unter', { projectId: 'pm-privat', listeId: 'lm-ms1-abc', parentId: 't-ms' }),
      t('t-liste-archiv', { projectId: 'p-eigen', listeId: 'l-archiv' }),
    ],
  });
  await s(`planung-einheiten--${H}`, { einheiten: ['Kunden'] });
  await s('ordnung', { reihenfolge: ['umsatz'], zuordnung: {}, stichworte: {}, orgs: {} });
  // Was NICHT mitkommt
  await s('finanzplan', { firmen: [] });
  await s('vitals--lena', { tage: { '2026-09-01': { schlaf: 7 } } });
  await s('zoe-stapel', { vorschlaege: [{ id: 's-1' }] });
  await s('head-sales', { vorschlaege: [] });
  await s('kalender-bezug', { eintraege: {} });
  await s(`gesellschaften--${H}`, { gesellschaften: [] });
  await s(`team--${H}`, { team: [] });
  await s('meldungen--lena', { eintraege: [] });
  await s(`absichten--${H}`, { absichten: opt.absichten ?? [{ id: 'ab-1', art: 'import', status: 'fertig', schritte: [] }, { id: 'ab-2', art: 'kontoauszug', status: 'offen', schritte: [] }] });
  await fs.mkdir(path.join(ordner, 'backup'), { recursive: true });
  await fs.writeFile(path.join(ordner, 'backup', 'kontakte-2026-10-08.json'), '{}');
  await fs.mkdir(path.join(ordner, 'system'), { recursive: true });
  await fs.writeFile(path.join(ordner, 'system', 'lage.json'), '{"ok":1}');
}

const altHaupt = path.join(wurzel, 'alt-haupt');
let bericht: Awaited<ReturnType<typeof umzugLaufen>>;
let grabStand = '';

beforeAll(async () => {
  // Grabstein für „c-grab“ (wie Art. 17 ihn hinterließe) — über den echten Weg der App.
  const { grabsteinFuer, grabsteinSetzen, grabsteinStand } = await import('@/lib/datenschutz/grabsteine');
  await grabsteinSetzen(grabsteinFuer('c-grab', { email: 'grab@example.invalid', vorname: 'Gerd', nachname: 'Grab' }, '2026-10-01'));
  grabStand = await grabsteinStand();
  // Die Marke im alten Ordner ist ÄLTER als die Grabsteine → die neue Instanz muss sie anwenden.
  await altBauen(altHaupt, { kontakteZahl: 250, grabsteinMarke: 'alter-stand' });
}, 60_000);
afterAll(async () => { await fs.rm(wurzel, { recursive: true, force: true }); });

describe('Kern (rein)', () => {
  it('jedes Muster der Entscheidungstabelle steht im Speicher-Register (oder ist ein bekannter Index-Bestand) — keine Tippfehler', () => {
    const register = SPEICHER_REGISTER.map(e => e.muster);
    const bekannt = new Set(['traktion-index', 'crm-dateien']);
    for (const r of [...K.MITNEHMEN, ...K.NICHT_MITNEHMEN]) {
      expect(register.includes(r.muster) || bekannt.has(r.muster), r.muster).toBe(true);
    }
    for (const m of K.NIE_MITNEHMEN) expect(register.includes(m) || m === 'demo-instanz', m).toBe(true);
  });

  it('jeder Bestand der Kartei/des CRM aus dem Register ist ausdrücklich entschieden (mit Grund)', () => {
    const crmNah = SPEICHER_REGISTER.filter(e => /^(kontakte|crm|crm-|kennung-alias|uebergabe-journal|events-geloescht|netzwerk|kunden|stammdaten|prospects|netzwerken-|visitenkarten|traktion|head|buchung--|datenschutz-(pannen|migration|grabsteine|einrichtung))/.test(e.muster));
    expect(crmNah.length).toBeGreaterThan(15);
    for (const e of crmNah) {
      const probe = e.muster.replace(/\*/g, 'probe');
      const ausdruecklich = [...K.MITNEHMEN, ...K.NICHT_MITNEHMEN].some(r => K.musterTrifft(r.muster, probe));
      expect(ausdruecklich, e.muster).toBe(true);
    }
  });

  it('Einteilung: Kartei/CRM mit, Konten nie (auch nicht mit --auch), Rest nicht — mit Bereich', () => {
    expect(K.bestandEinteilen('kontakte').entscheidung).toBe('mit');
    expect(K.bestandEinteilen(`crm-sperrliste--${H}`).entscheidung).toBe('mit');
    expect(K.bestandEinteilen('tasks').entscheidung).toBe('gefiltert');
    expect(K.bestandEinteilen('datenschutz-grabsteine').entscheidung).toBe('bedingt');
    expect(K.bestandEinteilen('konten', { auch: ['konten'] }).entscheidung).toBe('nie');
    expect(K.bestandEinteilen('postfach-zugang--lena').entscheidung).toBe('nie');
    expect(K.bestandEinteilen('finanzplan')).toMatchObject({ entscheidung: 'nicht', bereich: 'Finanzen, Steuern, Business-Index' });
    expect(K.bestandEinteilen('kalender-bezug', { auch: ['kalender-bezug'] }).entscheidung).toBe('mit');
    expect(K.bestandEinteilen('backlog').entscheidung).toBe('nicht');
    expect(K.bestandEinteilen('backlog', { mitBauplan: true }).entscheidung).toBe('mit');
    expect(K.auchPruefen(['konten'])).toHaveLength(1);
    expect(K.auchPruefen(['google-verbindung--*'])).toHaveLength(1);
    expect(K.auchPruefen(['gesellschaften--demo-haus', 'buchung--*'])).toEqual([]);
    expect(K.auchPruefen(['../x'])).toHaveLength(1);
  });

  it('Namen-Abbildung: nur ganze Werte und Schlüssel, Teilwörter bleiben; Kollision und Ketten werden abgelehnt', () => {
    const paare = K.abbildungenVereinen(K.abbildungAus(['lena=lea']), K.abbildungAus(['demo-haus=neu-haus'], 'Haushalt'));
    const r = K.namenErsetzen({ besitzer: 'lena', netzwerk: { lena: 1, jonas: 2 }, text: '@lena schreibt lena@example.invalid', liste: ['lena', 'x'], h: 'demo-haus' }, paare);
    expect(r.wert).toEqual({ besitzer: 'lea', netzwerk: { lea: 1, jonas: 2 }, text: '@lena schreibt lena@example.invalid', liste: ['lea', 'x'], h: 'neu-haus' });
    expect(r.n).toBe(4);
    const gleich = { a: 'x' };
    expect(K.namenErsetzen(gleich, paare).wert).toBe(gleich);
    expect(() => K.namenErsetzen({ netzwerk: { lena: 1, lea: 2 } }, paare)).toThrow(/zusammenwerfen/);
    expect(() => K.abbildungAus(['a=b', 'b=c'])).toThrow(/Ketten/);
    expect(() => K.abbildungAus(['a=c', 'b=c'])).toThrow(/denselben/);
    expect(() => K.abbildungAus(['A=b'])).toThrow();
    expect(K.bestandsnameAbbilden('visitenkarten--lena', paare)).toBe('visitenkarten--lea');
    expect(K.bestandsnameAbbilden('crm-dateien--demo-haus', paare)).toBe('crm-dateien--neu-haus');
    expect(K.bestandsnameAbbilden('lena', paare)).toBe('lena');
  });

  it('Pepper- und Grabstein-Fingerabdruck rechnen wie die App', async () => {
    const { pepperFingerabdruck } = await import('@/lib/datenschutz/pepper');
    expect(K.pepperFingerabdruck(process.env)).toBe(pepperFingerabdruck());
    expect(K.pepperFingerabdruck({ MAKE_OS_PEPPER_DATEI: '/x' } as unknown as NodeJS.ProcessEnv, () => PEPPER)).toBe(pepperFingerabdruck());
    expect(K.pepperFingerabdruck({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(K.grabsteinStandAus(readFileSync(path.join(wurzel, 'grabsteine', 'grabsteine.json')))).toBe(grabStand);
    expect(K.grabsteinStandAus(null)).toBe('');
  });

  it('Pfade: nie „.data“, nicht gleich, nicht ineinander', () => {
    expect(K.pfadeGruende('/a/.data', '/b', path, '/')).toHaveLength(1);
    expect(K.pfadeGruende('/a', '/a', path, '/')).toHaveLength(1);
    expect(K.pfadeGruende('/a', '/a/neu', path, '/')).toHaveLength(1);
    expect(K.pfadeGruende('/srv/alt', '/srv/neu', path, '/')).toEqual([]);
  });
});

describe('Probelauf', () => {
  it('liest, prüft und berichtet — schreibt nichts, legt nicht einmal den Ordner an', async () => {
    const nach = path.join(wurzel, 'probe-neu');
    const b = await umzugLaufen({ von: altHaupt, nach, kennung });
    expect(b.probelauf).toBe(true);
    expect(existsSync(nach)).toBe(false);
    expect(b.konten.personen.map(p => p.speicher)).toEqual(['lena', 'jonas']);
    expect(b.konten.haushalt).toBe(H);
    expect(b.bestaende.find(x => x.name === 'kontakte')?.alt.kontakte).toBe(254);
    expect(b.bestaende.find(x => x.name === 'crm')?.alt).toMatchObject({ firmen: 26, chancen: 1, mandate: 2, followups: 2, angebote: 1, kampagnen: 1, events: 1 });
    expect(b.nicht.map(x => x.name)).toEqual(expect.arrayContaining(['konten', 'finanzplan', 'vitals--lena', 'zoe-stapel', 'head-sales', 'kalender-bezug', `gesellschaften--${H}`, `team--${H}`, 'meldungen--lena', `absichten--${H}`, 'datenschutz-grabsteine']));
    expect(b.hinweise.join(' ')).toMatch(/kontoauszug \(offen\)/);
    expect(b.hinweise.join(' ')).toMatch(/Grabsteine \(1\) sind seit dem letzten Anwenden neu/);
    expect(b.hinweise.join(' ')).toMatch(/Speichername „lena“/);
    expect(b.hinweise.join(' ')).toMatch(/Vorname „jonas“/);
    expect(b.hinweise.join(' ')).toMatch(/Haushalt .* genau „demo-haus“/);
    expect(b.hinweise.join(' ')).toMatch(/nennen 1 Gesellschaft\(en\) aus dem Register/);
    // Der Bericht trägt keine Inhalte: keine Adresse, kein Name, keine Notiz.
    const text = JSON.stringify(b);
    for (const x of ['anna@example.invalid', 'Beispiel GmbH', 'nur für Lena', 'Kennenlernen', 'inhalt vertrag']) expect(text).not.toContain(x);
  });
});

describe('Ausführen (Format v2) — der Hauptfall', () => {
  beforeAll(async () => { bericht = await umzugLaufen({ von: altHaupt, nach: neuHaupt, ausfuehren: true, kennung }); }, 60_000);

  it('nichts aus Kartei und CRM geht verloren: jede Kennung, jeder Text — und die Pflicht-Bestände sind da', async () => {
    for (const n of ['kontakte', 'crm', `crm-sperrliste--${H}`, 'crm-loeschprotokoll', `kennung-alias--${H}`, `uebergabe-journal--${H}`, 'events-geloescht', 'crm-scoring', 'traktion-verlauf', 'traktion-index', 'prospects', `netzwerken-erfassungen--${H}`, 'visitenkarten--lena', 'datenschutz-pannen', 'datenschutz-migration', 'crm-import-konflikte', `crm-dateien--${H}`, `planung-einheiten--${H}`, 'ordnung']) {
      expect(await lies(neuHaupt, n), n).toEqual(await lies(altHaupt, n));
    }
    const alt = await lies(altHaupt, 'kontakte'), neu = await lies(neuHaupt, 'kontakte');
    expect(neu.kontakte.map((k: { id: string }) => k.id)).toEqual(alt.kontakte.map((k: { id: string }) => k.id));
    expect(neu.kontakte).toHaveLength(254);
    const crmAlt = await lies(altHaupt, 'crm'), crmNeu = await lies(neuHaupt, 'crm');
    for (const l of ['firmen', 'chancen', 'mandate', 'leistungen', 'events', 'teilnahmen', 'sitzungen', 'antraege', 'verarbeitungen', 'segmente', 'beitraege', 'newsletter', 'kampagnen', 'followups', 'angebote']) {
      expect(crmNeu[l], l).toEqual(crmAlt[l]);
    }
    const b = bericht.bestaende.find(x => x.name === 'kontakte')!;
    expect(b.kennungenAlt).toBe(b.kennungenNeu);
    expect(b.inhalt).toBe('unverändert');
    expect(bericht.geschrieben?.bestaende).toBe(bericht.bestaende.length);
  });

  it('bleibt draußen: Konten, Finanzen, Gesundheit, ZOE, Heads, Kalender, Register, Team, Glocke, Absichten, Sicherungen, system/', () => {
    for (const n of ['konten', 'finanzplan', 'vitals--lena', 'zoe-stapel', 'head-sales', 'kalender-bezug', `gesellschaften--${H}`, `team--${H}`, 'meldungen--lena', `absichten--${H}`, 'datenschutz-grabsteine']) {
      expect(existsSync(path.join(neuHaupt, `${n}.json`)), n).toBe(false);
    }
    expect(existsSync(path.join(neuHaupt, 'backup'))).toBe(false);
    expect(existsSync(path.join(neuHaupt, 'system', 'lage.json'))).toBe(false);
    expect(existsSync(path.join(neuHaupt, '.schreiber'))).toBe(false);
  });

  it('Aufgaben: eigene mit, Papierkorb/Archiv/Module/Heads draußen (samt Unteraufgaben), Meilenstein-Listen → „Übernommen“', async () => {
    const st = await lies(neuHaupt, 'tasks');
    const ids = st.tasks.map((t: { id: string }) => t.id).sort();
    expect(ids).toEqual(['ev-e-1-p1', 'kp-k1-s1', 'nw-e1', 't-eigen', 't-enkel', 't-follow', 't-hand', 't-liste-archiv', 't-ms', 't-ms-unter', 't-serie', 't-unter', 'ueb-1', 'w-abc-20261001'].sort());
    const nach = new Map(st.tasks.map((t: { id: string }) => [t.id, t])) as Map<string, any>;
    // Ziel weg, ZOE-Auftrag wieder offen (sein Vorschlag lag im Stapel), Abhängigkeit auf die Steuer-Aufgabe gelöst, „nur ich“ bleibt.
    expect(nach.get('t-eigen')).toMatchObject({ zoe: { status: 'offen', von: 'lena' }, abhaengigVon: ['t-unter'], dependencies: [{ blockedByTaskId: 't-unter' }], sichtbarkeit: 'nur-ich', bezug: { kontaktId: 'c-1', firmaId: 'f-1' } });
    expect(nach.get('t-eigen').zielId).toBeUndefined();
    expect(nach.get('t-eigen').zoe.stapelId).toBeUndefined();
    expect(nach.get('t-ms').zoe).toEqual({ status: 'freigegeben', von: 'lena' });
    expect(nach.get('t-liste-archiv').listeId).toBeUndefined();
    expect(nach.get('w-abc-20261001').wiederholung).toEqual({ regel: 'woechentlich', wochentage: [1] });
    // Projekte: ohne Papierkorb, Archiv und „Meilensteine“; von Hand abgelegtes bleibt; dazu „Übernommen“ (Privat).
    const proj = st.projects.map((p: { id: string; title: string }) => p.title).sort();
    expect(proj).toEqual(['Eigenes', 'Von Hand abgelegt', 'Übernommen']);
    const ueb = st.projects.find((p: { title: string }) => p.title === 'Übernommen');
    expect(ueb).toMatchObject({ spaceId: 'privat', archived: false });
    expect(st.projects.find((p: { id: string }) => p.id === 'p-eigen').zielId).toBeUndefined();
    const lm = st.listen.find((l: { titel: string }) => l.titel === 'Umzug planen');
    expect(lm.id).toMatch(/^l-/);
    expect(lm.projektId).toBe(ueb.id);
    expect(nach.get('t-ms')).toMatchObject({ projectId: ueb.id, listeId: lm.id });
    expect(nach.get('t-ms-unter')).toMatchObject({ projectId: ueb.id, listeId: lm.id, parentId: 't-ms' });
    expect(st.listen.map((l: { id: string }) => l.id)).not.toContain('lm-leer-xyz');
    expect(st.listen.map((l: { id: string }) => l.id)).not.toContain('l-archiv');
    expect(st.statusEigen).toHaveLength(1);
    expect(st.vorlagen).toHaveLength(1);
    expect(st.umbauVersion).toBe(3);
    const a = bericht.aufgaben!;
    expect(a.nicht).toMatchObject({ papierkorb: 3, archiv: 2 });
    expect(a.nicht.modul).toMatchObject({ 'Steuern (das Modul legt seine Fristen neu an)': 2, 'Head-Aufgabe (Agenten beginnen leer)': 1, 'Löschfristen-Prüfung (der Lauf legt sie neu an)': 1 });
    expect(a.geloest).toMatchObject({ ziel: 2, zoe: 1, liste: 1 });
  });

  it('Dateien: CRM-Ablage ganz, Aufgaben-Dateien nur übernommene + Einwilligungs-Beleg; neu verschlüsselt mit derselben AAD', async () => {
    const ad = await lies(neuHaupt, `aufgaben-dateien--${H}`);
    const ids = ad.eintraege.map((e: { id: string }) => e.id).sort();
    expect(ids).toEqual(['d-aufgabe-0001', 'd-beleg-aufgabe-1', 'd-ms-00000001', 'd-projekt-0001']);
    const st = await lies(neuHaupt, 'tasks');
    const ueb = st.projects.find((p: { title: string }) => p.title === 'Übernommen');
    expect(ad.eintraege.find((e: { id: string }) => e.id === 'd-ms-00000001')).toMatchObject({ projektId: ueb.id, aufgabeId: 't-ms' });
    const dateien = (await fs.readdir(path.join(neuHaupt, 'dateien', H))).sort();
    expect(dateien).toEqual(['d-angebot-0001.bin', 'd-aufgabe-0001.bin', 'd-beleg-aufgabe-1.bin', 'd-ms-00000001.bin', 'd-projekt-0001.bin', 'd-vertrag-0001.bin']);
    for (const f of dateien) {
      const roh = await fs.readFile(path.join(neuHaupt, 'dateien', H, f));
      expect(binVersion(roh)).toBe(2);
      expect(binOeffnen(roh, schluesselRing(), H, f.slice(0, -4)).klar.toString()).toMatch(/^inhalt /);
    }
    expect(bericht.dateien).toMatchObject({ crm: { mitDatei: 3, fehlen: 1 }, aufgaben: { mitDatei: 4 }, nichtUebernommen: 1, ohneEintrag: 1 });
    // Der Umzug zerbricht keinen Verweis (CRM → Aufgaben im Papierkorb zählt eigens).
    const { alt, neu } = bericht.verweise!;
    for (const k of Object.keys(neu) as (keyof typeof neu)[]) if (k !== 'crmAufgabeNichtUebernommen' && k !== 'aufgabenDateiBezugTot') expect(neu[k], k).toBeLessThanOrEqual(alt[k]);
    // Einzige Ausnahme mit Absicht: der Einwilligungs-Beleg an einer Head-Aufgabe bleibt als Nachweis (Art. 7 Abs. 1), seine Aufgabe nicht.
    expect(bericht.aufgabenDateien[0]).toMatchObject({ alt: 5, neu: 4, nicht: 1, beleg: 1 });
    expect(neu.aufgabenDateiBezugTot).toBe(alt.aufgabenDateiBezugTot + 1);
    expect(neu.crmAufgabeNichtUebernommen).toBe(1); // fu-2 → t-korb
    expect(neu.einwilligungBelegTot).toBe(0);
  });

  it('die App liest den neuen Ordner (local-db, Dateiablage) — und die Marke trägt keine Inhalte', async () => {
    const db = await import('@/lib/store/local-db');
    const k = await db.loadJson<{ kontakte: { id: string }[] }>('kontakte');
    expect(k?.kontakte).toHaveLength(254);
    const crm = await db.loadJson<{ chancen: unknown[] }>('crm');
    expect(crm?.chancen).toHaveLength(1);
    const { inhaltLaden } = await import('@/lib/dateien/ablage');
    expect((await inhaltLaden(H, 'd-vertrag-0001'))?.toString()).toBe('inhalt vertrag');
    // Marke für die Einrichtung (lib/onboarding-neustart.ts): Klartext-JSON mit `am` und `zaehler` (Name → Zahl) — keine Namen, keine Inhalte.
    const roh = await fs.readFile(path.join(neuHaupt, 'system', 'neustart.json'), 'utf8');
    const marke = JSON.parse(roh);
    expect(marke.__verschluesselt).toBeUndefined();
    expect(Number.isFinite(Date.parse(marke.am))).toBe(true);
    expect(marke).toMatchObject({ version: 1, quelle: 'alt-haupt', format: 'v2', verschluesselt: true, grabsteine: { anzahl: 1, markeUebernommen: false } });
    expect(marke.zaehler).toEqual({ kontakte: 254, firmen: 26, deals: 1, mandate: 2, followups: 2, angebote: 1, kampagnen: 1, events: 1, aufgaben: 14, projekte: 3, dateien: 6 });
    // Die Einrichtung zeigt die ersten sechs Zähler — das Wichtigste vorn — und liest die Marke wie hier geschrieben.
    expect(Object.keys(marke.zaehler).slice(0, 6)).toEqual(['kontakte', 'firmen', 'deals', 'mandate', 'aufgaben', 'dateien']);
    const { neustartAusText } = await import('@/lib/onboarding-neustart');
    expect(neustartAusText(roh)).toEqual({ am: marke.am.slice(0, 10), zaehler: { kontakte: 254, firmen: 26, deals: 1, mandate: 2, aufgaben: 14, dateien: 6 } });
    expect(marke.fingerabdruecke.kontakte).toBe(bericht.bestaende.find(x => x.name === 'kontakte')!.kennungenAlt);
    for (const x of ['@', 'Beispiel GmbH', 'Anna', 'nur für Lena', 'lena', 'jonas', H]) expect(roh).not.toContain(x);
  });

  it('Grabstein greift in der neuen Instanz: Konto + Haushalt anlegen, Grabsteine anwenden → die gelöschte Person ist weg', async () => {
    const db = await import('@/lib/store/local-db');
    await db.saveJson('konten', { konten: [{ id: 'k-neu', speicher: 'lena', email: 'lena@example.invalid', name: 'Lena', rolle: 'inhaber', haushalt: H, hash: 'x', salz: 'y', angelegt: '2026-10-09', teilt: { gesundheit: [] } }], einladungen: [] });
    const { grabsteineAnwenden } = await import('@/lib/datenschutz/grabsteine');
    const r = await grabsteineAnwenden({ erzwingen: true });
    expect(r).toMatchObject({ grabsteine: 1, entfernt: 1, uebersprungen: false });
    const k = await db.loadJson<{ kontakte: { id: string }[] }>('kontakte');
    expect(k?.kontakte.map(x => x.id)).not.toContain('c-grab');
    expect(k?.kontakte).toHaveLength(253);
  }, 60_000);
});

describe('weitere Fälle', () => {
  it('Format kompatibel: alter Ordner v2 → neuer Ordner v1 („MKOSDAT1“), alles lesbar und gleich', async () => {
    const env = { ...ENV, MAKE_OS_FORMAT: 'kompatibel' } as NodeJS.ProcessEnv;
    const nach = path.join(wurzel, 'neu-v1');
    const b = await umzugLaufen({ von: altHaupt, nach, ausfuehren: true, env, kennung });
    expect(b.format).toBe('kompatibel');
    expect(JSON.parse(await fs.readFile(path.join(nach, 'crm.json'), 'utf8')).__verschluesselt).toBe(1);
    expect(binVersion(await fs.readFile(path.join(nach, 'dateien', H, 'd-vertrag-0001.bin')))).toBe(1);
    expect(await lies(nach, 'kontakte', env)).toEqual(await lies(altHaupt, 'kontakte'));
  }, 60_000);

  it('Grabsteine schon angewendet (Marke = Stand): die Marke kommt mit', async () => {
    const alt = path.join(wurzel, 'alt-marke');
    await altBauen(alt, { grabsteinMarke: grabStand });
    const nach = path.join(wurzel, 'neu-marke');
    const b = await umzugLaufen({ von: alt, nach, ausfuehren: true, kennung });
    expect(b.grabsteine).toMatchObject({ angewendetAufDemStand: true, markeUebernommen: true });
    expect(await lies(nach, 'datenschutz-grabsteine')).toMatchObject({ stand: grabStand });
  }, 60_000);

  it('Personen- und Haushalts-Abbildung: Bestände umbenannt, Werte und Schlüssel ersetzt, Dateien mit neuer AAD', async () => {
    const nach = path.join(wurzel, 'neu-abbildung');
    const b = await umzugLaufen({ von: altHaupt, nach, ausfuehren: true, kennung, personen: new Map([['lena', 'lea']]), haushalte: new Map([[H, 'neu-haus']]) });
    expect(existsSync(path.join(nach, 'visitenkarten--lea.json'))).toBe(true);
    expect(existsSync(path.join(nach, 'crm-sperrliste--neu-haus.json'))).toBe(true);
    expect(existsSync(path.join(nach, `crm-sperrliste--${H}.json`))).toBe(false);
    const k = await lies(nach, 'kontakte');
    const anna = k.kontakte.find((x: { id: string }) => x.id === 'c-1');
    expect(anna).toMatchObject({ besitzer: 'lea', privatNotizVon: 'lea', netzwerk: { lea: { stand: 'vernetzt' }, jonas: { stand: 'angefragt' } } });
    expect(anna.einwilligungen[0].erfasstVon).toBe('lea');
    expect(k.kontakte.map((x: { id: string }) => x.id)).toEqual((await lies(altHaupt, 'kontakte')).kontakte.map((x: { id: string }) => x.id));
    const st = await lies(nach, 'tasks');
    expect(st.tasks.find((t: { id: string }) => t.id === 't-eigen')).toMatchObject({ assignee: 'lea', angelegtVon: 'lea' });
    const roh = await fs.readFile(path.join(nach, 'dateien', 'neu-haus', 'd-vertrag-0001.bin'));
    expect(binOeffnen(roh, schluesselRing(), 'neu-haus', 'd-vertrag-0001').klar.toString()).toBe('inhalt vertrag');
    expect(() => binOeffnen(roh, schluesselRing(), H, 'd-vertrag-0001')).toThrow();
    expect(b.bestaende.find(x => x.name === 'kontakte')).toMatchObject({ inhalt: 'angepasst' });
    expect(b.hinweise.join(' ')).toMatch(/Speichername „lea“/);
    const marke = await fs.readFile(path.join(nach, 'system', 'neustart.json'), 'utf8');
    for (const x of ['lea', 'neu-haus', H]) expect(marke).not.toContain(x);
    expect(JSON.parse(marke).zaehler.kontakte).toBe(254);
  }, 60_000);

  it('ohne Datenschlüssel (Klartext am Mac-Prüfstand): Klartext rein, Klartext raus', async () => {
    const env = { ...ENV } as NodeJS.ProcessEnv;
    delete env.MAKE_OS_DATEN_SCHLUESSEL;
    const alt = path.join(wurzel, 'alt-klar'), nach = path.join(wurzel, 'neu-klar');
    await altBauen(alt, { env });
    const b = await umzugLaufen({ von: alt, nach, ausfuehren: true, env, kennung, absichtenIgnorieren: false });
    expect(b.verschluesselt).toBe(false);
    expect(JSON.parse(await fs.readFile(path.join(nach, 'kontakte.json'), 'utf8')).kontakte).toHaveLength(4);
    expect((await fs.readFile(path.join(nach, 'dateien', H, 'd-vertrag-0001.bin'))).toString()).toBe('inhalt vertrag');
  }, 60_000);
});

describe('Abbrüche — nichts wird geschrieben', () => {
  const erwarte = async (p: Promise<unknown>, muster: RegExp, code = 2) => {
    const e = await p.then(() => null, x => x);
    expect(e).toBeInstanceOf(UmzugAbbruch);
    expect((e as UmzugAbbruch).code).toBe(code);
    expect((e as UmzugAbbruch).message).toMatch(muster);
  };

  it('ein unlesbarer Bestand (falscher Schlüssel) bricht ab, bevor irgendetwas geschrieben ist', async () => {
    const alt = path.join(wurzel, 'alt-kaputt');
    await altBauen(alt);
    await schreibe(alt, 'crm', { firmen: [] }, { ...ENV, MAKE_OS_DATEN_SCHLUESSEL: 'ein-ganz-anderer-schluessel-zum-pruefen' } as NodeJS.ProcessEnv);
    const nach = path.join(wurzel, 'neu-kaputt');
    await erwarte(umzugLaufen({ von: alt, nach, ausfuehren: true, kennung }), /Nicht lesbar.*crm/);
    expect(existsSync(nach)).toBe(false);
  });

  it('kaputtes JSON in den Aufgaben ebenso', async () => {
    const alt = path.join(wurzel, 'alt-kaputt2');
    await altBauen(alt);
    const ring = schluesselRing();
    await fs.writeFile(path.join(alt, 'tasks.json'), huelleImModus('{ kein json', ring.aktiv!, 'tasks'));
    const nach = path.join(wurzel, 'neu-kaputt2');
    await fs.mkdir(nach);
    await erwarte(umzugLaufen({ von: alt, nach, ausfuehren: true, kennung }), /tasks: beschädigt/);
    expect(await fs.readdir(nach)).toEqual([]);
  });

  it('Klartext bei gesetztem Schlüssel wird abgelehnt (wie die App)', async () => {
    const alt = path.join(wurzel, 'alt-klartext');
    await altBauen(alt);
    await fs.writeFile(path.join(alt, 'prospects.json'), '{"eintraege":[]}');
    await erwarte(umzugLaufen({ von: alt, nach: path.join(wurzel, 'neu-klartext'), kennung }), /prospects: liegt als Klartext vor/);
  });

  it('Ziel nicht leer, „.data“ im Pfad, gleicher Ordner', async () => {
    const nach = path.join(wurzel, 'nicht-leer');
    await fs.mkdir(nach);
    await fs.writeFile(path.join(nach, 'x.json'), '{}');
    await erwarte(umzugLaufen({ von: altHaupt, nach, ausfuehren: true }), /nicht leer/);
    await erwarte(umzugLaufen({ von: altHaupt, nach: path.join(wurzel, '.data') }), /„\.data“/);
    await erwarte(umzugLaufen({ von: altHaupt, nach: altHaupt }), /derselbe Ordner/);
  });

  it('eine laufende App hält den alten Ordner (frischer Herzschlag) → Code 3', async () => {
    const alt = path.join(wurzel, 'alt-laeuft');
    await altBauen(alt);
    await fs.writeFile(path.join(alt, '.schreiber'), JSON.stringify({ pid: 1, host: 'anderer-container', start: new Date().toISOString(), herz: new Date().toISOString(), art: 'app' }));
    await erwarte(umzugLaufen({ von: alt, nach: path.join(wurzel, 'neu-laeuft'), host: 'umzug-container' }), /laufende App/, 3);
  });

  it('offene Absicht der Kartei (Art. 17 offen) hält an — mit --absichten-ignorieren nur als Hinweis', async () => {
    const alt = path.join(wurzel, 'alt-absicht');
    await altBauen(alt, { absichten: [{ id: 'ab-9', art: 'art17', status: 'offen', schritte: [] }] });
    await erwarte(umzugLaufen({ von: alt, nach: path.join(wurzel, 'neu-absicht') }), /1× art17 \(offen\)/);
    const b = await umzugLaufen({ von: alt, nach: path.join(wurzel, 'neu-absicht'), absichtenIgnorieren: true });
    expect(b.hinweise.join(' ')).toMatch(/bewusst übergangen/);
  });

  it('anderer Pepper als der der Sperrliste → Abbruch', async () => {
    const env = { ...ENV, MAKE_OS_PEPPER: 'ein-anderer-pepper-mit-mindestens-zweiunddreissig-zeichen' } as NodeJS.ProcessEnv;
    await erwarte(umzugLaufen({ von: altHaupt, nach: path.join(wurzel, 'neu-pepper'), env }), /Pepper/);
    const ohne = { ...ENV } as NodeJS.ProcessEnv;
    delete ohne.MAKE_OS_PEPPER;
    await erwarte(umzugLaufen({ von: altHaupt, nach: path.join(wurzel, 'neu-pepper'), env: ohne }), /Pepper fehlt/);
  });

  it('--auch nimmt nie Konten oder Zugänge', async () => {
    await erwarte(umzugLaufen({ von: altHaupt, nach: path.join(wurzel, 'neu-auch'), auch: ['konten'] }), /nie mit/);
  });
});

describe('Kommandozeile', () => {
  const lauf = (args: string[]) => spawnSync(process.execPath, [path.join(process.cwd(), 'scripts', 'neustart-umzug.mjs'), ...args], { env: { ...process.env }, encoding: 'utf8' });

  it('Probelauf: Ausgang 0, Bericht ohne Inhalte, nichts geschrieben', () => {
    const nach = path.join(wurzel, 'cli-neu');
    const r = lauf(['--von', altHaupt, '--nach', nach]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain('PROBELAUF');
    expect(r.stdout).toContain('Kontakte 254');
    expect(r.stdout).toContain('Übernommen');
    for (const x of ['anna@example.invalid', 'Beispiel GmbH', 'nur für Lena']) expect(r.stdout).not.toContain(x);
    expect(existsSync(nach)).toBe(false);
  });

  it('Abbruch mit Ausgang 2 bei „.data“ und bei falscher Abbildung', () => {
    expect(lauf(['--von', altHaupt, '--nach', path.join(wurzel, '.data')]).status).toBe(2);
    expect(lauf(['--von', altHaupt, '--nach', path.join(wurzel, 'x'), '--person', 'a=b', '--person', 'b=c']).status).toBe(2);
  });
});

