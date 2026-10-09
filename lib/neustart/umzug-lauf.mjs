// ─── Neustart-Umzug: der Ablauf mit Dateien (09.10.2026) ────────────────────────────────────────────────────────────────
// Liest NUR aus dem alten Datenordner (`von`), schreibt NUR in einen leeren neuen (`nach`). Standard ist der Probelauf: alles
// lesen, entschlüsseln, prüfen, rechnen, Bericht — nichts schreiben (auch kein Ordner). Erst `ausfuehren: true` schreibt.
// Regeln (was mitkommt, Aufgaben-Filter, Namen) im reinen Kern lib/neustart/umzug.mjs; Kommandozeile scripts/neustart-umzug.mjs.
//
// Abbruch VOR dem ersten Schreiben (UmzugAbbruch, nichts geschrieben), wenn:
//   · ein Pfad ungültig ist (`.data`-Glied, gleich/ineinander, `nach` nicht leer),
//   · eine lebende App einen der Ordner hält (Lockfile `.schreiber`, lib/store/schreiber.mjs),
//   · ein mitzunehmender Bestand oder eine Datei nicht lesbar ist (Schlüssel, Klartext bei gesetztem Schlüssel, kaputtes JSON),
//   · offene/gescheiterte Absichten von Kartei, CRM oder Aufgaben im alten Ordner liegen (erst dort fertig laufen lassen),
//   · der Pepper der Umgebung nicht der ist, mit dem die Sperrliste umgerechnet wurde.
// Geschrieben wird im Format des Modus (MAKE_OS_FORMAT, lib/store/huelle.mjs `huelleImModus` / datei-huelle.mjs `binImModus`)
// mit dem aktiven Datenschlüssel — AAD = NEUER Bestandsname bzw. NEUER Haushalt/Kennung. Danach wird ALLES zurückgelesen und
// verglichen (Text für Text, Datei für Datei über SHA-256); erst dann entsteht die Marke system/neustart.json. Fehlt die Marke,
// ist der Lauf nicht fertig geworden: den NEUEN Ordner leeren und noch einmal (der alte bleibt immer unberührt).

import { promises as fs, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { atomarSchreiben } from '../store/atomar.mjs';
import { schluesselRing, huellenVersion, huelleOeffnen, huelleImModus, formatModus, HUELLE } from '../store/huelle.mjs';
import { binVersion, binOeffnen, binImModus, BILD_NAME } from '../store/datei-huelle.mjs';
import { schreiberLesen, schreiberLebt, schreiberSetzen, schreiberHerz, schreiberEntfernenSync } from '../store/schreiber.mjs';
import * as K from './umzug.mjs';

/** Abbruch mit Gründen. `code`: 2 = Eingaben/Inhalt (nichts geschrieben), 3 = eine App hält einen Ordner, 1 = Fehler beim Schreiben/Prüfen. */
export class UmzugAbbruch extends Error {
  constructor(gruende, code = 2) { super(gruende.join(' · ')); this.name = 'UmzugAbbruch'; this.gruende = gruende; this.code = code; }
}

const DATEI_ID = /^d-[a-z0-9-]{4,60}$/;
const GESELLSCHAFT_ID = /^g-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const sha = b => createHash('sha256').update(b).digest('hex');
const istObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const istOrdner = async p => { try { return (await fs.stat(p)).isDirectory(); } catch { return false; } };
const leer = async p => { try { return (await fs.readdir(p)).length === 0; } catch (e) { if (e?.code === 'ENOENT') return true; throw e; } };

/** Rohtext einer Bestandsdatei → Klartext (wie lib/store/local-db.ts `rohOeffnen`, ohne Migrationsschalter-Zähler). Wirft mit Satz. */
function textOeffnen(roh, aad, ring, env) {
  if (roh.startsWith('{') && roh.slice(0, 48).includes(`"${HUELLE}"`)) {
    let o = null;
    try { o = JSON.parse(roh); } catch { /* unten: kaputt */ }
    if (o && huellenVersion(o)) return huelleOeffnen(o, ring, aad).text;
  }
  if (ring.aktiv && env.MAKE_OS_KLARTEXT_MIGRATION !== '1') {
    try { JSON.parse(roh); } catch { return roh; } // kaputt: der Aufrufer meldet es
    throw new Error('liegt als Klartext vor, obwohl ein Datenschlüssel gesetzt ist (erst `scripts/daten-verschluesselung.mjs --verschluesseln` im alten Ordner)');
  }
  return roh;
}

/** Datei der Ablage bzw. ein Bild → Klartext-Bytes. Ohne Kopf = Klartext (wie die App liest). */
function binLesen(roh, ring, ordner, id) {
  if (!binVersion(roh)) return roh;
  return binOeffnen(roh, ring, ordner, id).klar;
}

/** Werte im Bestand, die genau eine Kennung des Gesellschafts-Registers sind (`g-<uuid>`) — für den Hinweis „Register mitnehmen?“. */
function gesellschaftsVerweise(wert) {
  const ids = new Set();
  const geh = v => {
    if (typeof v === 'string') { if (GESELLSCHAFT_ID.test(v)) ids.add(v); return; }
    if (Array.isArray(v)) { for (const e of v) geh(e); return; }
    if (istObj(v)) for (const e of Object.values(v)) geh(e);
  };
  geh(wert);
  return ids.size;
}

/**
 * Den Umzug planen (Probelauf) bzw. ausführen. Liefert den Bericht (nur Namen, Zahlen, Fingerabdrücke — nie Inhalte).
 * @param {object} opt  von, nach, ausfuehren, auch[], mitBauplan, mitHeadAufgaben, personen/haushalte (Map alt → neu),
 *                      grabsteinOrdner, absichtenIgnorieren, env, jetzt (Date), kennung (Tests), cwd, host (Tests)
 */
export async function umzugLaufen(opt) {
  const env = opt.env ?? process.env;
  const jetzt = opt.jetzt ?? new Date();
  const cwd = opt.cwd ?? process.cwd();
  const gruende = K.pfadeGruende(opt.von, opt.nach, path, cwd);
  if (gruende.length) throw new UmzugAbbruch(gruende);
  const von = path.resolve(cwd, opt.von), nach = path.resolve(cwd, opt.nach);
  if (!(await istOrdner(von))) throw new UmzugAbbruch([`--von ${von} ist kein Ordner.`]);
  if (await istOrdner(nach) ? !(await leer(nach)) : (await fs.stat(nach).then(() => true, () => false))) {
    throw new UmzugAbbruch([`--nach ${nach} ist nicht leer bzw. kein Ordner — der Umzug schreibt nur in einen LEEREN neuen Ordner.`]);
  }
  const auch = opt.auch ?? [];
  const auchFehler = K.auchPruefen(auch);
  if (auchFehler.length) throw new UmzugAbbruch(auchFehler);
  let paare;
  try { paare = K.abbildungenVereinen(opt.personen ?? new Map(), opt.haushalte ?? new Map()); }
  catch (e) { throw new UmzugAbbruch([e instanceof Error ? e.message : String(e)]); }

  // Hält eine lebende App einen der Ordner? (Über Container-Grenzen zählt nur der Herzschlag.)
  const host = opt.host ?? env.MAKE_OS_PRUEF_HOST ?? os.hostname();
  for (const [was, p] of [['alten', von], ['neuen', nach]]) {
    const e = await schreiberLesen(p);
    if (schreiberLebt(e, Date.now(), host)) throw new UmzugAbbruch([`Eine laufende App hält den ${was} Datenordner (${p}) — erst anhalten: docker compose stop app arbeiter.`], 3);
  }

  const ring = schluesselRing(env);
  const modus = formatModus(env);
  const bericht = {
    version: K.UMZUG_VERSION, probelauf: !opt.ausfuehren, am: jetzt.toISOString(), von, nach,
    format: modus, verschluesselt: !!ring.aktiv, pepper: null, konten: { personen: [], haushalt: null }, haushalteImAlten: [],
    bestaende: [], nicht: [], aufgaben: null, aufgabenDateien: [], dateien: null, grabsteine: null, verweise: null, hinweise: [], geschrieben: null,
  };

  // ── Inventar ──
  const namen = (await fs.readdir(von, { withFileTypes: true }))
    .filter(d => d.isFile() && /\.json$/.test(d.name)).map(d => d.name.slice(0, -5)).filter(n => K.BESTAND_NAME.test(n)).sort();
  const einteilung = new Map(namen.map(n => [n, K.bestandEinteilen(n, { auch, mitBauplan: !!opt.mitBauplan })]));

  const unlesbar = [];
  const gelesen = new Map(); // name → { text, wert }
  const lesen = async name => {
    if (gelesen.has(name)) return gelesen.get(name);
    let r = null;
    try {
      const roh = await fs.readFile(path.join(von, `${name}.json`), 'utf8');
      const text = textOeffnen(roh, name, ring, env);
      let wert;
      try { wert = JSON.parse(text); } catch { throw new Error('beschädigt (kein JSON)'); }
      r = { text, wert };
    } catch (e) { unlesbar.push(`${name}: ${e instanceof Error ? e.message.slice(0, 200) : 'nicht lesbar'}`); }
    gelesen.set(name, r);
    return r;
  };

  // ── Konten (nur Speichernamen, Rolle, Haushalt — nie Adressen) ──
  if (einteilung.has('konten')) {
    // Nur für den Bericht — ein unlesbarer Konten-Bestand hält den Umzug nicht an (er kommt ohnehin nicht mit).
    let k = null;
    try { k = JSON.parse(textOeffnen(await fs.readFile(path.join(von, 'konten.json'), 'utf8'), 'konten', ring, env)); }
    catch { bericht.hinweise.push('Die Konten des alten Ordners sind nicht lesbar — Speichernamen und Haushalt bitte selbst prüfen.'); }
    if (istObj(k)) {
      const konten = Array.isArray(k.konten) ? k.konten : [];
      const inhaber = konten.filter(x => x?.rolle === 'inhaber');
      const fest = k.einstellungen?.hauptInhaber;
      const haupt = (fest ? inhaber.find(x => x.speicher === fest) : undefined) ?? inhaber[0];
      bericht.konten = {
        personen: konten.filter(x => typeof x?.speicher === 'string').map(x => ({ speicher: x.speicher, rolle: x.rolle === 'inhaber' ? 'inhaber' : 'mitglied', ...(typeof x.haushalt === 'string' ? { haushalt: x.haushalt } : {}), ...(x.finanzRecht === 'business' ? { finanzRecht: 'business' } : {}), ...(x === haupt ? { hauptInhaber: true } : {}) })),
        haushalt: typeof haupt?.haushalt === 'string' ? haupt.haushalt : null,
      };
    }
  }
  bericht.haushalteImAlten = Array.from(new Set(namen.filter(n => einteilung.get(n).entscheidung !== 'nie' && /--/.test(n) && /^(crm-|kennung-alias|uebergabe-journal|netzwerken-erfassungen|aufgaben-dateien|planung-einheiten)/.test(n)).map(n => n.split('--')[1]))).sort();

  // ── Absichten: offen/gescheitert von Kartei, CRM, Aufgaben → erst im alten Ordner fertig laufen lassen ──
  const absichtenKern = {}, absichtenSonst = {};
  for (const n of namen.filter(x => x.startsWith('absichten--'))) {
    const a = await lesen(n);
    if (!a) continue;
    const o = K.absichtenOffen(a.wert);
    for (const [k, v] of Object.entries(o.kern)) absichtenKern[k] = (absichtenKern[k] ?? 0) + v;
    for (const [k, v] of Object.entries(o.sonst)) absichtenSonst[k] = (absichtenSonst[k] ?? 0) + v;
  }
  const kernText = Object.entries(absichtenKern).map(([k, v]) => `${v}× ${k}`).join(', ');
  if (kernText && !opt.absichtenIgnorieren) {
    throw new UmzugAbbruch([`Im alten Ordner sind Vorgänge nicht fertig: ${kernText}. Erst die alte App starten (sie nimmt offene Vorgänge beim Start wieder auf) bzw. im Head of IT „erneut“, dann neu.`]);
  }
  if (kernText) bericht.hinweise.push(`Nicht fertige Vorgänge bewusst übergangen (--absichten-ignorieren): ${kernText}.`);
  const sonstText = Object.entries(absichtenSonst).map(([k, v]) => `${v}× ${k}`).join(', ');
  if (sonstText) bericht.hinweise.push(`Nicht fertige Vorgänge außerhalb von Kartei/CRM/Aufgaben bleiben im Archiv: ${sonstText}.`);

  // ── Pepper: dieselben Fingerabdrücke wie die Sperrliste? ──
  const pf = K.pepperFingerabdruck(env, p => { try { return readFileSync(p, 'utf8').split(/\r?\n/)[0]; } catch { return null; } });
  bericht.pepper = pf ? 'gesetzt' : 'fehlt';
  if (einteilung.has('datenschutz-migration')) {
    const m = await lesen('datenschutz-migration');
    const alt = m?.wert?.v2?.pepper;
    if (alt && alt !== pf) throw new UmzugAbbruch([pf ? 'Der Pepper der Umgebung ist ein anderer als der, mit dem die Sperrliste umgerechnet wurde — dieselbe .env verwenden (MAKE_OS_PEPPER bzw. …_DATEI).' : 'Der Pepper fehlt in der Umgebung — die Sperrliste trägt Fingerabdrücke mit Pepper (MAKE_OS_PEPPER bzw. …_DATEI setzen, dieselbe .env).']);
  }

  // ── Grabsteine: ist die Kartei nach dem jetzigen Stand bereinigt? ──
  const gOrdner = opt.grabsteinOrdner || env.MAKE_OS_GRABSTEINE_DIR?.trim() || `${von.replace(/[\\/]+$/, '')}-grabsteine`;
  let gRoh = null;
  try { gRoh = await fs.readFile(path.join(gOrdner, 'grabsteine.json')); } catch (e) { if (e?.code !== 'ENOENT') unlesbar.push(`Grabsteine (${gOrdner}): nicht lesbar`); }
  let gAnzahl = 0;
  if (gRoh) { try { const g = JSON.parse(gRoh.toString('utf8')); gAnzahl = Array.isArray(g?.eintraege) ? g.eintraege.length : 0; } catch { unlesbar.push(`Grabsteine (${gOrdner}): beschädigt`); } }
  const gStand = K.grabsteinStandAus(gRoh);
  const gMarke = einteilung.has('datenschutz-grabsteine') ? (await lesen('datenschutz-grabsteine'))?.wert : null;
  const markeMit = !!gStand && gMarke?.stand === gStand;
  bericht.grabsteine = { ordner: gOrdner, gefunden: !!gRoh, anzahl: gAnzahl, angewendetAufDemStand: markeMit, markeUebernommen: markeMit };
  if (!gRoh) bericht.hinweise.push(`Keine Grabsteine gefunden (${gOrdner}) — stimmt der Ordner? Auf dem Server: MAKE_OS_GRABSTEINE_DIR=/grabsteine (compose).`);
  else if (!markeMit) bericht.hinweise.push(`Die Grabsteine (${gAnzahl}) sind seit dem letzten Anwenden neu — nach dem Start der neuen Instanz anwenden (Anleitung: Schritt „Grabsteine“).`);

  // ── Mitzunehmende Bestände lesen ──
  const mit = namen.filter(n => {
    const e = einteilung.get(n);
    return e.entscheidung === 'mit' || e.entscheidung === 'gefiltert' || (e.entscheidung === 'bedingt' && markeMit);
  });
  for (const n of mit) await lesen(n);
  if (unlesbar.length) throw new UmzugAbbruch([`Nicht lesbar — es wird NICHTS geschrieben: ${unlesbar.join(' · ')}`]);

  // ── Aufgaben und Aufgaben-Dateien filtern ──
  const kartei = gelesen.get('kontakte')?.wert ?? null;
  const altTasks = gelesen.get('tasks')?.wert ?? null;
  const aufgaben = altTasks ? K.aufgabenUebernehmen(altTasks, { kennung: opt.kennung, jetzt: jetzt.toISOString(), mitHeadAufgaben: !!opt.mitHeadAufgaben }) : null;
  const ctx = aufgaben
    ? { projektUm: aufgaben.projektUm, listeUm: aufgaben.listeUm, aufgabenIds: aufgaben.aufgabenIds, listenIds: aufgaben.listenIds, projektIds: aufgaben.projektIds, belege: K.belegKennungen(kartei) }
    : { projektUm: new Map(), listeUm: new Map(), aufgabenIds: new Set(), listenIds: new Set(), projektIds: new Set(), belege: K.belegKennungen(kartei) };
  if (aufgaben) bericht.aufgaben = aufgaben.bericht;

  /** name → { neuName, text, wert, alt: Fingerabdruck } — was geschrieben wird. */
  const plan = [];
  const aufgabenDateienNeu = new Map(); // haushalt → Einträge (neu)
  for (const n of mit) {
    const g = gelesen.get(n);
    const e = einteilung.get(n);
    let wert = g.wert, text = g.text, geaendert = false;
    if (e.bearbeiten === 'aufgaben' && aufgaben) { wert = aufgaben.stand; geaendert = true; }
    if (e.bearbeiten === 'aufgaben-dateien') {
      const r = K.aufgabenDateienUebernehmen(g.wert, ctx);
      wert = r.datei; geaendert = true;
      bericht.aufgabenDateien.push({ name: n, ...r.bericht });
      aufgabenDateienNeu.set(n.split('--')[1], r.datei.eintraege);
    }
    if (paare.size) { const r = K.namenErsetzen(wert, paare); if (r.n) { wert = r.wert; geaendert = true; } }
    if (geaendert) text = JSON.stringify(wert);
    const neuName = K.bestandsnameAbbilden(n, paare);
    plan.push({ name: n, neuName, text, wert, alt: K.fingerabdruck(g.wert), neu: K.fingerabdruck(wert), unveraendert: !geaendert, entscheidung: e.entscheidung, grund: e.grund, art: e.art ?? null });
  }
  for (const p of plan) {
    bericht.bestaende.push({
      name: p.name, ...(p.neuName !== p.name ? { neuName: p.neuName } : {}), entscheidung: p.entscheidung, grund: p.grund,
      alt: p.alt.anzahl, neu: p.neu.anzahl, kennungenAlt: p.alt.hash, kennungenNeu: p.neu.hash, inhalt: p.unveraendert ? 'unverändert' : 'angepasst',
    });
  }
  for (const n of namen) {
    const e = einteilung.get(n);
    if (mit.includes(n)) continue;
    bericht.nicht.push({ name: n, entscheidung: e.entscheidung, bereich: e.bereich, grund: e.entscheidung === 'bedingt' ? 'Grabsteine sind seit dem letzten Anwenden neu — die neue Instanz wendet sie an.' : e.grund });
  }

  // ── Dateien (Ablage je Haushalt, Bilder des Bauplans) ──
  const dateienPlan = []; // { ordner, id, nachOrdner, quelle, ziel, sha, groesse }
  const dbericht = { crm: { eintraege: 0, mitDatei: 0, fehlen: 0, groesseAbweichend: 0 }, aufgaben: { eintraege: 0, mitDatei: 0, fehlen: 0, groesseAbweichend: 0 }, nichtUebernommen: 0, ohneEintrag: 0, bilder: 0, bytes: 0 };
  const dateienDaAlt = new Set();
  const altCrmEintraege = [], altAufgabenEintraege = [];
  for (const n of namen.filter(x => x.startsWith('crm-dateien--') || x.startsWith('aufgaben-dateien--'))) {
    const g = await lesen(n);
    if (!g) continue;
    (n.startsWith('crm-') ? altCrmEintraege : altAufgabenEintraege).push(...(Array.isArray(g.wert?.eintraege) ? g.wert.eintraege : []));
  }
  if (unlesbar.length) throw new UmzugAbbruch([`Nicht lesbar — es wird NICHTS geschrieben: ${unlesbar.join(' · ')}`]);
  const haushaltOrdner = await fs.readdir(path.join(von, 'dateien'), { withFileTypes: true }).then(l => l.filter(d => d.isDirectory()).map(d => d.name), () => []);
  const vorhandene = new Map(); // haushalt → Set<id>
  for (const h of haushaltOrdner) {
    const ids = (await fs.readdir(path.join(von, 'dateien', h)).catch(() => [])).filter(x => /\.bin$/.test(x)).map(x => x.slice(0, -4)).filter(x => DATEI_ID.test(x));
    vorhandene.set(h, new Set(ids));
    for (const id of ids) dateienDaAlt.add(id);
  }
  const genutzt = new Map(); // haushalt → Set<id> (Einträge im alten Bestand, auch nicht übernommene)
  const nimm = (h, id) => { if (!genutzt.has(h)) genutzt.set(h, new Set()); genutzt.get(h).add(id); };
  const dateiPruefen = async (ordnerName, id, quelle, zielOrdner, sollGroesse, zaehler) => {
    let roh;
    try { roh = await fs.readFile(quelle); } catch (e) { if (e?.code === 'ENOENT') { zaehler.fehlen++; return; } unlesbar.push(`${ordnerName}/${id}: nicht lesbar`); return; }
    let klar;
    try { klar = binLesen(roh, ring, ordnerName, id); } catch (e) { unlesbar.push(`${ordnerName}/${id}: ${e instanceof Error ? e.message.slice(0, 120) : 'nicht lesbar'}`); return; }
    if (typeof sollGroesse === 'number' && sollGroesse !== klar.length) zaehler.groesseAbweichend++;
    dateienPlan.push({ ordnerName, id, zielOrdner, quelle, sha: sha(klar), groesse: klar.length });
    dbericht.bytes += klar.length;
  };
  // CRM-Ablage: alle Einträge mit Datei.
  for (const n of mit.filter(x => x.startsWith('crm-dateien--'))) {
    const h = n.split('--')[1];
    const hNeu = paare.get(h) ?? h;
    for (const e of gelesen.get(n).wert?.eintraege ?? []) {
      dbericht.crm.eintraege++;
      if (!istObj(e) || !e.datei || !DATEI_ID.test(String(e.id))) continue;
      dbericht.crm.mitDatei++;
      nimm(h, e.id);
      await dateiPruefen(h, e.id, path.join(von, 'dateien', h, `${e.id}.bin`), path.join('dateien', hNeu), e.datei.groesse, dbericht.crm);
    }
  }
  // Aufgaben-Ablage: nur die übernommenen Einträge.
  for (const n of namen.filter(x => x.startsWith('aufgaben-dateien--'))) {
    const h = n.split('--')[1];
    for (const e of gelesen.get(n)?.wert?.eintraege ?? []) if (istObj(e) && DATEI_ID.test(String(e.id))) nimm(h, e.id);
  }
  for (const [h, eintraege] of aufgabenDateienNeu) {
    const hNeu = paare.get(h) ?? h;
    for (const e of eintraege) {
      dbericht.aufgaben.eintraege++;
      if (!istObj(e) || !e.datei || !DATEI_ID.test(String(e.id))) continue;
      dbericht.aufgaben.mitDatei++;
      await dateiPruefen(h, e.id, path.join(von, 'dateien', h, `${e.id}.bin`), path.join('dateien', hNeu), e.datei.groesse, dbericht.aufgaben);
    }
  }
  const geplant = new Set(dateienPlan.map(d => `${d.ordnerName}/${d.id}`));
  for (const [h, ids] of vorhandene) for (const id of ids) {
    if (geplant.has(`${h}/${id}`)) continue;
    if (genutzt.get(h)?.has(id)) dbericht.nichtUebernommen++; else dbericht.ohneEintrag++;
  }
  // Bauplan-Bilder (nur mit --mit-bauplan): alle Bilder, AAD `bauplan-bilder/<name>`.
  if (opt.mitBauplan) {
    for (const b of (await fs.readdir(path.join(von, 'bauplan-bilder')).catch(() => [])).filter(x => BILD_NAME.test(x))) {
      await dateiPruefen('bauplan-bilder', b, path.join(von, 'bauplan-bilder', b), 'bauplan-bilder', undefined, { fehlen: 0, groesseAbweichend: 0 });
      dbericht.bilder++;
    }
  }
  if (unlesbar.length) throw new UmzugAbbruch([`Nicht lesbar — es wird NICHTS geschrieben: ${unlesbar.join(' · ')}`]);
  bericht.dateien = dbericht;

  // ── Verweise alt ↔ neu (nur Zahlen) ──
  const neuWert = name => plan.find(p => p.name === name)?.wert;
  const neuCrmEintraege = plan.filter(p => p.name.startsWith('crm-dateien--')).flatMap(p => p.wert?.eintraege ?? []);
  const neuAufgabenEintraege = Array.from(aufgabenDateienNeu.values()).flat();
  const nichtUebernommen = new Set((altTasks?.tasks ?? []).map(t => t?.id).filter(id => id && !aufgaben?.aufgabenIds.has(id)));
  bericht.verweise = {
    alt: K.verweisePruefen({ kartei, crm: gelesen.get('crm')?.wert, tasks: altTasks, crmDateien: altCrmEintraege, aufgabenDateien: altAufgabenEintraege, dateienDa: dateienDaAlt }),
    neu: K.verweisePruefen({ kartei: neuWert('kontakte'), crm: neuWert('crm'), tasks: neuWert('tasks'), crmDateien: neuCrmEintraege, aufgabenDateien: neuAufgabenEintraege, dateienDa: new Set(dateienPlan.map(d => d.id)), nichtUebernommen }),
  };

  // ── Hinweise für die Einrichtung ──
  const personen = bericht.konten.personen;
  const haupt = personen.find(p => p.hauptInhaber);
  const neuName = n => paare.get(n) ?? n;
  if (haupt) bericht.hinweise.push(`Erstes Konto (Inhaber): Vorname so eintragen, dass der Speichername „${neuName(haupt.speicher)}“ entsteht (erstes Wort, klein, ä → ae …).`);
  for (const p of personen.filter(x => !x.hauptInhaber)) bericht.hinweise.push(`Weitere Person einladen (Konto › Einladen) mit Vorname „${neuName(p.speicher)}“ — das bindet den Speichernamen.`);
  if (bericht.konten.haushalt) bericht.hinweise.push(`Haushalt in Konto › Haushaltsfinanzen › „Name des Haushalts“ genau „${neuName(bericht.konten.haushalt)}“ eintragen und das eigene Konto zuordnen, danach jedes weitere Konto — gleich nach dem ersten Anmelden (und dem zweiten Faktor), vor allem anderen.`);
  // Liegen die Bestände unter einem anderen Haushalt als dem des Inhabers (z. B. „haupt“, solange keiner eingetragen war), fände die neue
  // Instanz sie nicht — dann diesen Namen eintragen bzw. mit --haushalt umbenennen.
  const hInhaber = bericht.konten.haushalt ?? 'haupt';
  if (bericht.haushalteImAlten.length && !bericht.haushalteImAlten.includes(hInhaber)) bericht.hinweise.push(`Achtung: die Bestände je Haushalt liegen unter ${bericht.haushalteImAlten.map(h => `„${h}“`).join(', ')}, der Inhaber hat aber ${bericht.konten.haushalt ? `„${hInhaber}“` : 'keinen Haushalt (dann gilt „haupt“)'} — in der neuen Instanz den Haushalt so eintragen, wie die Bestände heißen, oder mit --haushalt <alt>=<neu> umbenennen.`);
  if (bericht.haushalteImAlten.length > 1) bericht.hinweise.push(`Im alten Ordner liegen Bestände mehrerer Haushalte (${bericht.haushalteImAlten.join(', ')}) — alle kommen mit; es gilt der Haushalt des Inhabers.`);
  const gRefs = gesellschaftsVerweise(gelesen.get('crm')?.wert) + gesellschaftsVerweise(aufgaben?.stand);
  if (gRefs && !mit.some(n => n.startsWith('gesellschaften--'))) bericht.hinweise.push(`CRM bzw. Aufgaben nennen ${gRefs} Gesellschaft(en) aus dem Register (g-…) — neu angelegte bekämen andere Kennungen: dann mit --auch gesellschaften--<haushalt> übernehmen.`);
  const head = aufgaben?.bericht.nicht.modul['Head-Aufgabe (Agenten beginnen leer)'] ?? 0;
  if (head) bericht.hinweise.push(`${head} Head-Aufgabe(n) bleiben im Archiv — mit --mit-head-aufgaben doch übernehmen.`);

  if (!opt.ausfuehren) return bericht;

  // ════ Ausführen ════
  if (!(await leer(nach))) throw new UmzugAbbruch([`--nach ${nach} ist inzwischen nicht mehr leer.`]);
  await fs.mkdir(nach, { recursive: true, mode: 0o700 });
  const start = new Date().toISOString();
  await schreiberSetzen(nach, 'neustart-umzug');
  const herz = setInterval(() => { void schreiberHerz(nach, start, 'neustart-umzug').catch(() => {}); }, 30_000);
  herz.unref?.();
  const geschrieben = { bestaende: 0, dateien: 0, bytes: 0 };
  try {
    for (const p of plan) {
      const daten = ring.aktiv ? huelleImModus(p.text, ring.aktiv, p.neuName, env) : p.text;
      await atomarSchreiben(path.join(nach, `${p.neuName}.json`), daten);
      geschrieben.bestaende++;
    }
    for (const d of dateienPlan) {
      const ziel = path.join(nach, d.zielOrdner);
      await fs.mkdir(ziel, { recursive: true, mode: 0o700 });
      const klar = binLesen(await fs.readFile(d.quelle), ring, d.ordnerName, d.id);
      if (sha(klar) !== d.sha) throw new Error(`${d.ordnerName}/${d.id}: hat sich seit dem Lesen geändert`);
      // AAD: Ablage = (Haushalt, Kennung), Bilder = (Ordner, Dateiname) — wie lib/dateien/ablage.ts bzw. lib/store/bild-ablage.ts.
      const bild = d.zielOrdner === 'bauplan-bilder';
      const zielH = bild ? 'bauplan-bilder' : path.basename(d.zielOrdner);
      const datei = path.join(ziel, bild ? d.id : `${d.id}.bin`);
      await atomarSchreiben(datei, ring.aktiv ? binImModus(klar, ring.aktiv, zielH, d.id, env) : klar);
      geschrieben.dateien++; geschrieben.bytes += klar.length;
    }

    // ── Zurücklesen und vergleichen ──
    const abweichend = [];
    for (const p of plan) {
      const roh = await fs.readFile(path.join(nach, `${p.neuName}.json`), 'utf8');
      let t;
      try { t = textOeffnen(roh, p.neuName, ring, env); } catch { abweichend.push(p.neuName); continue; }
      if (t !== p.text) abweichend.push(p.neuName);
    }
    for (const d of dateienPlan) {
      const zielH = d.zielOrdner === 'bauplan-bilder' ? 'bauplan-bilder' : path.basename(d.zielOrdner);
      const datei = d.zielOrdner === 'bauplan-bilder' ? path.join(nach, d.zielOrdner, d.id) : path.join(nach, d.zielOrdner, `${d.id}.bin`);
      try { if (sha(binLesen(await fs.readFile(datei), ring, zielH, d.id)) !== d.sha) abweichend.push(`${d.zielOrdner}/${d.id}`); }
      catch { abweichend.push(`${d.zielOrdner}/${d.id}`); }
    }
    if (abweichend.length) throw new Error(`Zurückgelesen weicht ab: ${abweichend.slice(0, 10).join(', ')}${abweichend.length > 10 ? ` (+${abweichend.length - 10})` : ''}`);

    // ── Marke (Klartext wie system/sicherung.json; nur Zeitpunkt, Zahlen, Fingerabdrücke — keine Namen, keine Inhalte) ──
    const marke = K.markeBauen({
      am: jetzt.toISOString(), quelle: path.basename(von), format: modus, verschluesselt: !!ring.aktiv,
      neu: Object.fromEntries(['kontakte', 'crm', 'tasks'].map(n => [n, plan.find(p => p.name === n)?.wert]).filter(([, w]) => w)),
      dateien: geschrieben.dateien, grabsteine: { anzahl: gAnzahl, markeUebernommen: markeMit }, nichtUebernommen: bericht.nicht.length,
    });
    await fs.mkdir(path.join(nach, 'system'), { recursive: true, mode: 0o700 });
    await atomarSchreiben(path.join(nach, K.NEUSTART_MARKE), `${JSON.stringify(marke, null, 2)}\n`);
    bericht.geschrieben = { ...geschrieben, geprueft: plan.length + dateienPlan.length };
  } catch (e) {
    throw new UmzugAbbruch([`Abgebrochen beim Schreiben: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}. Der NEUE Ordner ist unvollständig (keine Marke ${K.NEUSTART_MARKE}) — ihn leeren und neu laufen lassen; der alte ist unberührt.`], 1);
  } finally {
    clearInterval(herz);
    schreiberEntfernenSync(nach);
  }
  return bericht;
}
