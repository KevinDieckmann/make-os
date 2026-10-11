#!/usr/bin/env node
// ─── Update-Probe: ein Lauf EINER Version auf dem Probe-Ordner (10.10.) ─────────────────────────────────────────────────────
// Wird von scripts/update-probe.mjs als eigener Prozess gestartet — einmal mit der ALTEN (online) Version, einmal mit der NEUEN:
//
//   node kind.mjs saat     --wurzel <alt>  --aus <ergebnis.json> --passwort <…>   Demo-Saat + Ergänzungen + Grundlauf (wie live seit Tagen)
//   node kind.mjs neu      --wurzel <neu>  --aus <ergebnis.json> --marken <…>     Start-Haken, alle GET, Takt+Arbeiter, Morgenlauf, Löschfristen, Klicks
//   node kind.mjs rueckweg --wurzel <alt>  --aus <ergebnis.json>                   alte Version auf dem neuen Stand: Start, alle GET, jeder Bestand lesbar?
//   (Gegenprobe: Rolle `neu` mit der ALTEN Wurzel auf einer Kopie, `--etikett gegenprobe`.)
//
// Die Routen der jeweiligen Version laufen in-process (jiti, `@` → --wurzel), mit der Person im Kopf `x-make-user` (wie nach der Middleware)
// bzw. dem Dienstschlüssel `x-make-key` (Systemlauf, Arbeiter). Netz ist gesperrt: `fetch` an die eigene Instanz (`MAKE_OS_INTERN=
// http://probe.intern`) wird in-process an die Route gereicht, alles andere wirft sofort — kein iCloud, kein Google, kein Modell, nie :3001.
// Die Umgebung (Datenordner, Test-Schlüssel, Demo-Riegel) setzt der Aufrufer.

import { createRequire } from 'node:module';
import { existsSync, readdirSync, statSync, promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const rolle = argv[0];
const arg = (n, vorgabe) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : vorgabe; };
const wurzel = path.resolve(arg('wurzel', '.'));
const ausDatei = path.resolve(arg('aus', 'ergebnis.json'));
if (!['saat', 'neu', 'rueckweg'].includes(rolle)) { console.error('Rolle: saat | neu | rueckweg'); process.exit(2); }
if (process.env.MAKE_OS_INTERN !== 'http://probe.intern') { console.error('MAKE_OS_INTERN muss http://probe.intern sein (sonst gingen interne Aufrufe an eine echte Instanz).'); process.exit(2); }
const dir = process.env.MAKE_OS_DATEN_DIR ?? '';
if (!dir || dir.split(path.sep).includes('.data')) { console.error('MAKE_OS_DATEN_DIR fehlt oder enthält „.data“ — abgebrochen.'); process.exit(2); }

process.chdir(wurzel);
const require = createRequire(path.join(wurzel, 'package.json'));
const jiti = require('jiti')(path.join(wurzel, 'update-probe.js'), {
  alias: { '@': wurzel, 'node:sqlite': path.join(hier, 'sqlite-shim.cjs'), sqlite: path.join(hier, 'sqlite-shim.cjs') },
  interopDefault: true, cache: path.join(os.tmpdir(), 'make-os-update-probe-jiti'), requireCache: true,
});
const lade = spez => jiti(spez);

const log = (...t) => console.log(`[probe:${arg('etikett', rolle)}]`, ...t);
const ergebnis = { rolle, wurzel, start: new Date().toISOString(), schritte: [], routen: null, marken: {}, unlesbarAlt: null };
const schritt = (name, ok, info) => { ergebnis.schritte.push({ name, ok, ...(info ? { info: String(info).slice(0, 300) } : {}) }); log(ok ? '✓' : '✗', name, info ?? ''); };
const versuch = async (name, fn) => {
  try { const r = await fn(); schritt(name, true, typeof r === 'string' ? r : r === undefined ? undefined : JSON.stringify(r).slice(0, 200)); return r; }
  catch (e) { schritt(name, false, e instanceof Error ? e.message : String(e)); return undefined; }
};

// ── Routen in-process ────────────────────────────────────────────────────────────────────────────────────────────────
const API = path.join(wurzel, 'app', 'api');
const dirCache = new Map();
const lies = d => { if (!dirCache.has(d)) dirCache.set(d, existsSync(d) ? readdirSync(d) : []); return dirCache.get(d); };
function routeFinden(teile) {
  let d = API;
  const params = {};
  for (let i = 0; i < teile.length; i++) {
    const t = decodeURIComponent(teile[i]);
    const e = lies(d);
    if (e.includes(t) && statSync(path.join(d, t)).isDirectory()) { d = path.join(d, t); continue; }
    const dyn = e.find(x => /^\[[^.\]]+\]$/.test(x));
    if (dyn) { params[dyn.slice(1, -1)] = t; d = path.join(d, dyn); continue; }
    const rest = e.find(x => /^\[\.\.\.[^\]]+\]$/.test(x));
    if (rest) { params[rest.slice(4, -1)] = teile.slice(i).map(decodeURIComponent); d = path.join(d, rest); break; }
    return null;
  }
  const datei = path.join(d, 'route.ts');
  return existsSync(datei) ? { datei, params } : null;
}
async function anRoute(req) {
  const u = new URL(req.url);
  const r = routeFinden(u.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean));
  if (!r) return new Response(JSON.stringify({ ok: false, error: 'Route fehlt (Probe)' }), { status: 404 });
  const mod = lade(r.datei);
  const fn = mod[req.method];
  if (typeof fn !== 'function') return new Response(JSON.stringify({ ok: false, error: 'Methode fehlt (Probe)' }), { status: 405 });
  const los = () => fn(req, { params: Promise.resolve(r.params) });
  // Ein interner Hop ist im echten Betrieb eine eigene Anfrage — eigener Ablauf der Datenschicht (Sperren), nicht der des Aufrufers.
  const als = globalThis.__makeosDatenschicht?.als;
  return als ? als.exit(los) : los();
}
globalThis.fetch = async (input, init) => {
  const req = input instanceof Request ? (init ? new Request(input, init) : input) : new Request(String(input), init);
  const u = new URL(req.url);
  if (u.hostname === 'probe.intern') return anRoute(req);
  throw new TypeError(`fetch failed (Update-Probe: kein Netz — ${u.hostname})`);
};

const mitFrist = async (p, ms) => {
  let t;
  try { return await Promise.race([p, new Promise(res => { t = setTimeout(() => res('__frist'), ms); })]); } finally { clearTimeout(t); }
};
let bau = '';
try { bau = lade('@/lib/bau/kennung').bauKennung() ?? ''; } catch { /* alte Version ohne Kennung */ }

/** Eine Route aufrufen. `person` = Sitzung, `dienst` = Dienstweg (mit `person` als x-make-person). */
async function rufe(methode, pfad, o = {}) {
  const form = typeof FormData !== 'undefined' && o.body instanceof FormData;
  const kopf = form ? {} : { 'content-type': 'application/json' };
  if (o.dienst) { kopf['x-make-key'] = process.env.MAKE_OS_KEY; if (o.person) kopf['x-make-person'] = o.person; }
  else if (o.person) kopf['x-make-user'] = o.person;
  if (bau && methode !== 'GET') kopf['x-make-bau'] = bau;
  const req = new Request(`http://probe.intern${pfad}`, { method: methode, headers: kopf, ...(o.body === undefined ? {} : { body: form ? o.body : JSON.stringify(o.body) }) });
  try {
    const r = await mitFrist(anRoute(req), o.frist ?? 25_000);
    if (r === '__frist') return { status: 'frist', text: '', json: null };
    const text = await mitFrist(r.text(), 10_000);
    if (text === '__frist') return { status: 'frist', text: '', json: null };
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
    return { status: r.status, text, json };
  } catch (e) { return { status: 'wirft', text: e instanceof Error ? e.message : String(e), json: null }; }
}
/** Wie rufe, aber wirft bei Fehlern (für die Saat). */
async function muss(methode, pfad, person, body, o = {}) {
  const r = await rufe(methode, pfad, { person, body, ...o });
  if (typeof r.status !== 'number' || r.status >= 400 || r.json?.ok === false) {
    throw new Error(`${methode} ${pfad} → ${r.status}: ${String(r.json?.error ?? r.json?.fehler ?? r.text).slice(0, 240)}`);
  }
  return r.json ?? {};
}

// ── Bausteine der Läufe ──────────────────────────────────────────────────────────────────────────────────────────────
const SEGMENTE = { head: 'sales', slug: 'probe-0123456789abcdef01234567', token: 'x', pfad: ['wissen'], link: 'x', id: 'x' };
const ZUSATZ = { 'state/flaeche': 'seite=heute', 'aufgaben/zeit': 'ids=t-demo-serie', 'agenten/skills': 'head=assistenz' };

/** Alle lesenden Routen des Registers: als jede Person (Klasse offen/dienst: einmal ohne Person bzw. als Systemlauf). */
async function alleGets(personen, marken) {
  const { ROUTEN_REGISTER } = lade('@/lib/zugang/routen-register');
  const routen = Object.entries(ROUTEN_REGISTER).filter(([p, e]) => e.methoden.GET && p !== 'jarvis/[...pfad]').sort(([a], [b]) => a.localeCompare(b));
  const aus = { aufgerufen: 0, jeStatus: {}, fehler: [] };
  const gefunden = {};
  for (const [pfad, e] of routen) {
    const konkret = pfad.replace(/\[\.\.\.([a-z]+)\]/g, (_, n) => [].concat(SEGMENTE[n] ?? 'x').join('/')).replace(/\[([a-z]+)\]/g, (_, n) => SEGMENTE[n] ?? 'x');
    const q = ZUSATZ[pfad] ? `?${ZUSATZ[pfad]}` : '';
    const wer = e.methoden.GET === 'offen' ? [null] : e.methoden.GET === 'dienst' ? ['__dienst'] : personen;
    for (const p of wer) {
      const r = await rufe('GET', `/api/${konkret}${q}`, p === '__dienst' ? { dienst: true } : { person: p ?? undefined }, );
      aus.aufgerufen++;
      const s = String(r.status);
      aus.jeStatus[s] = (aus.jeStatus[s] ?? 0) + 1;
      if (typeof r.status !== 'number' || r.status >= 500) aus.fehler.push(`${pfad} (${p ?? '—'}): ${s} ${r.text.replace(/\s+/g, ' ').slice(0, 160)}`);
      if (p && p !== '__dienst' && marken?.[p]) {
        for (const m of marken[p]) if (r.text.includes(m)) (gefunden[p] ??= new Set()).add(m);
      }
    }
  }
  return { routen: aus, gefunden: Object.fromEntries(Object.entries(gefunden).map(([p, s]) => [p, [...s]])) };
}

/** Takt + Arbeiter wie auf dem Server: einreihen, dann nacheinander abarbeiten (höchstens `max` Aufträge bzw. `budget` ms). */
async function taktUndArbeiter(max = 40, budget = 8 * 60_000) {
  const t = await rufe('POST', '/api/zoe/takt', { dienst: true, frist: 120_000 });
  schritt('Takt (Systemlauf)', t.status === 200, `${t.status} · eingereiht ${t.json?.eingereiht ?? '?'}${t.json?.was ? ` — ${t.json.was.join(', ').slice(0, 220)}` : ''}`);
  const start = Date.now();
  const erledigt = [];
  for (let n = 0; n < max && Date.now() - start < budget; n++) {
    const r = await rufe('POST', '/api/zoe/auftraege/nimm', { dienst: true, body: { anzahl: 1, pacht: 300, wartenMs: 0 } });
    const a = r.json?.auftraege?.[0];
    if (!a) break;
    const l = await rufe('POST', '/api/zoe/auftraege/lauf', { dienst: true, body: { id: a.id, token: a.pachtToken }, frist: 4 * 60_000 });
    erledigt.push(`${a.art}/${a.name}: ${l.status}${l.json?.ok === false ? ' (ok:false)' : ''}`);
  }
  schritt('Arbeiter (Aufträge der Warteschlange)', true, `${erledigt.length}: ${erledigt.join(' · ').slice(0, 280)}`);
}

async function startHaken() {
  await versuch('Start-Riegel', () => { lade('@/lib/zugang/start-riegel-lauf').startRiegel(); return 'geprüft'; });
  await versuch('Betrieb starten (Lockfile, Herzschlag)', async () => { await lade('@/lib/store/betrieb').betriebStarten(); return 'ok'; });
  await versuch('iCloud-Hauptzugang laden', async () => { const m = lade('@/lib/kalender/icloud-person'); if (m.hauptZugangAuffrischen) await m.hauptZugangAuffrischen(); return m.hauptZugangAuffrischen ? 'ok' : 'gibt es nicht'; });
  await versuch('ZOE-WhatsApp-Prüfung', () => { try { lade('@/lib/zoe-whatsapp/konfig').zoeWhatsappStartPruefung(); return 'ok'; } catch (e) { if (/Cannot find module/.test(String(e))) return 'gibt es nicht'; throw e; } });
  await versuch('Absichten fortsetzen (+5 s)', async () => JSON.stringify(await lade('@/lib/store/absichten-fortsetzen').offeneFertigstellen()));
  await versuch('Brain-Index nach dem Start (+20 s)', async () => { const m = lade('@/lib/brain/index'); if (m.indexNachStart) { await m.indexNachStart(); return 'ok'; } return 'gibt es nicht'; });
}

async function morgenUndFristen() {
  const m = await rufe('POST', '/api/tagesstart', { dienst: true, body: { force: true }, frist: 5 * 60_000 });
  schritt('Morgenlauf (Systemlauf)', m.status === 200, `${m.status} · ${(m.json?.schritte ?? []).map(s => `${s.ok ? '' : '✗'}${s.name}`).join(', ').slice(0, 260)}`);
  const n = (m.json?.schritte ?? []).filter(s => !s.ok);
  if (n.length) schritt('Morgenlauf: gescheiterte Schritte', true, n.map(s => `${s.name}: ${s.info ?? ''}`).join(' | ').slice(0, 290));
  const l = await rufe('POST', '/api/tagesstart', { person: 'kevin', body: { force: true }, frist: 5 * 60_000 });
  schritt('Morgenlauf (Kevin)', l.status === 200, String(l.status));
  await versuch('Löschfristen-Lauf (erzwungen)', async () => {
    const r = await lade('@/lib/crm/loeschfristen-lauf').loeschfristenLauf(new Date(), true);
    return JSON.stringify(r).slice(0, 200);
  });
}

async function stillWerden() {
  await new Promise(r => setTimeout(r, 4_000)); // „void“-Läufe des Takts (Abgleiche, Erinnerungen) zu Ende kommen lassen
  try { await lade('@/lib/store/leseprotokoll').leseprotokollWarten?.(); } catch { /* alte Version */ }
  try { await lade('@/lib/store/local-db').warteBisStill(30_000); } catch { /* egal */ }
}

// ── Rollen ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const personen = ['kevin', 'malin', 'lena', 'ben']; // wie live + Demo-Mitglied + Partner „nur Business“
try {
  if (rolle === 'saat') {
    const { demoSaenInLeerenOrdner } = lade('@/lib/demo/server.ts');
    const b = await demoSaenInLeerenOrdner({ passwort: arg('passwort') });
    schritt('Demo-Saat der alten Version', true, b.schritte.map(s => `${s.name} ${s.anzahl}`).join(', ').slice(0, 290));
    const { zusatzSaen, altformenSchreiben } = await import(pathToFileURL(path.join(hier, 'saat-zusatz.mjs')).href);
    const marken = await zusatzSaen({ rufe, muss, lade, schritt, versuch });
    // Grundlauf: so lebt live jeder Bestand seit Tagen — Start, Seiten (alle GET), Takt mit Arbeiter, Morgenlauf, Löschfristen.
    await startHaken();
    const g = await alleGets(personen, marken);
    ergebnis.routen = g.routen;
    await taktUndArbeiter();
    await morgenUndFristen();
    // Altformen nach dem Grundlauf (direkt in den Bestand): Formen, die die Schreibwege heute nicht mehr erzeugen, die ein Bestand aber
    // tragen kann — danach nur noch LESEN (eine weitere Schreibung der alten Version würde sie selbst schon säubern).
    for (const [p, m] of Object.entries(await altformenSchreiben({ lade, schritt, versuch }))) marken[p].push(...m);
    const g2 = await alleGets(['kevin', 'malin'], marken);
    // Sichtbar vorher = in einer Antwort an die eigene Person nach dem Grundlauf (nur diese Marken zählen nachher).
    ergebnis.marken = Object.fromEntries(Object.entries(marken).map(([p, l]) => [p, l.filter(m => (g2.gefunden[p] ?? []).includes(m))]));
    ergebnis.markenUnsichtbarSchonVorher = Object.fromEntries(Object.entries(marken).map(([p, l]) => [p, l.filter(m => !(g2.gefunden[p] ?? []).includes(m))]));
    await stillWerden();
  } else if (rolle === 'neu') {
    const marken = JSON.parse(arg('marken', '{}'));
    await startHaken();
    const g = await alleGets(personen, marken);
    ergebnis.routen = g.routen;
    await taktUndArbeiter();
    await morgenUndFristen();
    const { klicks } = await import(pathToFileURL(path.join(hier, 'klicks.mjs')).href);
    await klicks({ rufe, schritt, versuch });
    await stillWerden();
    const g2 = await alleGets(['kevin', 'malin'], marken);
    const gesehen = {};
    for (const p of Object.keys(marken)) gesehen[p] = [...new Set([...(g.gefunden[p] ?? []), ...(g2.gefunden[p] ?? [])])];
    ergebnis.unsichtbar = Object.entries(marken).flatMap(([p, l]) => l.filter(m => !gesehen[p].includes(m)).map(m => `${p}: ${m}`));
    await stillWerden();
  } else if (rolle === 'rueckweg') {
    await startHaken();
    const g = await alleGets(['kevin', 'malin'], {});
    ergebnis.routen = g.routen;
    // Jeder Bestand mit der Datenschicht der ALTEN Version lesen.
    const db = lade('@/lib/store/local-db');
    const unlesbar = [];
    for (const f of (await fs.readdir(dir)).filter(f => /^[a-z0-9][a-z0-9-]*\.json$/.test(f)).sort()) {
      try { await db.loadJson(f.slice(0, -5)); } catch (e) { unlesbar.push(`${f.slice(0, -5)}: ${(e instanceof Error ? e.message : String(e)).slice(0, 120)}`); }
    }
    ergebnis.unlesbarAlt = unlesbar;
    schritt('Alle Bestände mit der alten Datenschicht lesen', unlesbar.length === 0, `${unlesbar.length} nicht lesbar`);
    await stillWerden();
  }
} catch (e) {
  schritt('Abbruch', false, e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 4).join(' ')}` : String(e));
  ergebnis.abbruch = true;
}
ergebnis.ende = new Date().toISOString();
await fs.writeFile(ausDatei, JSON.stringify(ergebnis, null, 1));
process.exit(ergebnis.abbruch ? 1 : 0);
