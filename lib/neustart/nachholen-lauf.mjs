// ─── Neustart: einzelne Bestände aus dem Archiv nachholen — der Ablauf mit Dateien (09.10.2026 spät) ─────────────────────────────────
// Liest NUR aus dem Archiv-Ordner (`archiv`, der alte Datenordner des Neustart-Umzugs) und schreibt NUR die ausdrücklich genannten, erlaubten
// Bestände (lib/neustart/nachholen.mjs: nur Business-Heads `head-sales`/`-marketing`/`-event`) in den LAUFENDEN Datenordner (`daten`).
// Standard ist der Probelauf (lesen, entschlüsseln, filtern, zusammenführen, Bericht — nichts geschrieben). Erst `ausfuehren` schreibt.
//   • Abbruch VOR dem Schreiben (NachholenAbbruch, Code 2): Pfade ungültig (`.data`, gleich/ineinander), Name nicht erlaubt, eine Datei nicht
//     lesbar (Schlüssel, Klartext bei gesetztem Schlüssel, kaputtes JSON). Code 3: eine lebende App hält einen der Ordner (erst anhalten).
//   • Ziel fehlt → der gefilterte Stand; Ziel da → zusammengeführt (das Ziel gewinnt, aus dem Archiv kommt nur, was fehlt) — vorher geht die
//     bisherige Datei UNVERÄNDERT (Byte für Byte, also verschlüsselt wie sie war) nach `<daten>/archiv/nachholen-vor-<name>-<zeit>.json`.
//   • Geschrieben im Format des Modus mit dem aktiven Schlüssel, AAD = Bestandsname (dieselbe Krypto wie der Umzug: `textOeffnen` aus
//     umzug-lauf.mjs, `huelleImModus` aus lib/store/huelle.mjs), danach zurückgelesen und verglichen; Schreiber-Sperre wie beim Umzug.
// Ausgegeben werden nie Inhalte — nur Bestandsnamen und Zahlen.

import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomarSchreiben } from '../store/atomar.mjs';
import { schluesselRing, huelleImModus, formatModus } from '../store/huelle.mjs';
import { schreiberLesen, schreiberLebt, schreiberSetzen, schreiberHerz, schreiberEntfernenSync } from '../store/schreiber.mjs';
import { textOeffnen } from './umzug-lauf.mjs';
import * as N from './nachholen.mjs';

/** Abbruch mit Gründen. `code`: 2 = Eingaben/Inhalt (nichts geschrieben), 3 = eine App hält einen Ordner, 1 = Fehler beim Schreiben/Prüfen. */
export class NachholenAbbruch extends Error {
  constructor(gruende, code = 2) { super(gruende.join(' · ')); this.name = 'NachholenAbbruch'; this.gruende = gruende; this.code = code; }
}

const istOrdner = async p => { try { return (await fs.stat(p)).isDirectory(); } catch { return false; } };

/** Pfade prüfen (rein): beide da, nie `.data`, nicht gleich, nicht ineinander. */
export function pfadeGruende(archiv, daten, cwd) {
  const g = [];
  if (!archiv || !daten) return ['Aufruf: --archiv <alter Datenordner> --daten <laufender Datenordner>.'];
  const a = path.resolve(cwd, archiv), d = path.resolve(cwd, daten);
  for (const [was, p] of [['--archiv', a], ['--daten', d]]) {
    if (p.split(path.sep).some(t => t === '.data')) g.push(`${was} enthält „.data“ (${p}) — das Nachholen läuft nur auf dem Server mit eigenen Ordnernamen.`);
  }
  if (a === d) g.push('--archiv und --daten sind derselbe Ordner.');
  else if (d.startsWith(a + path.sep) || a.startsWith(d + path.sep)) g.push('--archiv und --daten liegen ineinander.');
  return g;
}

/** JSON-Datei eines Bestands lesen und entschlüsseln — null, wenn sie fehlt; wirft mit Satz, wenn sie nicht lesbar ist. */
async function bestandLesen(ordner, name, ring, env) {
  let roh;
  try { roh = await fs.readFile(path.join(ordner, `${name}.json`), 'utf8'); } catch (e) { if (e?.code === 'ENOENT') return null; throw new Error(`${name}: nicht lesbar`); }
  let text;
  try { text = textOeffnen(roh, name, ring, env); } catch (e) { throw new Error(`${name}: ${e instanceof Error ? e.message.slice(0, 160) : 'nicht lesbar'}`); }
  try { return { roh, wert: JSON.parse(text) }; } catch { throw new Error(`${name}: beschädigt (kein JSON)`); }
}

/**
 * Nachholen planen (Probelauf) bzw. ausführen. Liefert den Bericht (nur Namen und Zahlen).
 * @param {object} opt  archiv, daten, bestaende[], ausfuehren, env, jetzt (Date), cwd, host (Tests)
 */
export async function nachholenLaufen(opt) {
  const env = opt.env ?? process.env;
  const jetzt = opt.jetzt ?? new Date();
  const cwd = opt.cwd ?? process.cwd();
  const pg = pfadeGruende(opt.archiv, opt.daten, cwd);
  if (pg.length) throw new NachholenAbbruch(pg);
  const archiv = path.resolve(cwd, opt.archiv), daten = path.resolve(cwd, opt.daten);
  for (const [was, p] of [['--archiv', archiv], ['--daten', daten]]) if (!(await istOrdner(p))) throw new NachholenAbbruch([`${was} ${p} ist kein Ordner.`]);
  const namen = Array.from(new Set(opt.bestaende ?? []));
  const ng = N.nachholenPruefen(namen);
  if (ng.length) throw new NachholenAbbruch(ng);

  // Hält eine lebende App einen der Ordner? (Über Container-Grenzen zählt nur der Herzschlag.)
  const host = opt.host ?? env.MAKE_OS_PRUEF_HOST ?? os.hostname();
  for (const [was, p] of [['Archiv-', archiv], ['laufenden ', daten]]) {
    const e = await schreiberLesen(p);
    if (schreiberLebt(e, Date.now(), host)) throw new NachholenAbbruch([`Eine laufende App hält den ${was}Ordner (${p}) — erst anhalten: docker compose stop app arbeiter.`], 3);
  }

  const ring = schluesselRing(env);
  const modus = formatModus(env);
  const bericht = { probelauf: !opt.ausfuehren, am: jetzt.toISOString(), archiv, daten, format: modus, verschluesselt: !!ring.aktiv, bestaende: [], geschrieben: null };
  const plan = [];
  const unlesbar = [];
  for (const name of namen) {
    let quelle = null, ziel = null;
    try { quelle = await bestandLesen(archiv, name, ring, env); } catch (e) { unlesbar.push(`Archiv › ${e.message}`); continue; }
    try { ziel = await bestandLesen(daten, name, ring, env); } catch (e) { unlesbar.push(`laufend › ${e.message}`); continue; }
    if (!quelle) { bericht.bestaende.push({ name, aktion: 'fehlt-im-archiv', archiv: null, vorher: ziel ? N.headZaehler(ziel.wert) : null, nachher: null }); continue; }
    let wert, aktion;
    if (!ziel) { wert = N.headStandFiltern(quelle.wert); aktion = 'neu'; }
    else {
      const z = N.headStandZusammenfuehren(ziel.wert, quelle.wert);
      wert = z.wert; aktion = z.neu ? 'zusammengefuehrt' : 'unveraendert';
    }
    // Im Kompatibilitätsmodus schreibt local-db nie `_v` (Rückweg zum alten Stand) — dann auch hier nicht.
    if (modus !== 'v2' && wert && typeof wert === 'object') delete wert._v;
    bericht.bestaende.push({ name, aktion, archiv: N.headZaehler(quelle.wert), vorher: ziel ? N.headZaehler(ziel.wert) : null, nachher: N.headZaehler(wert) });
    if (aktion !== 'unveraendert') plan.push({ name, text: JSON.stringify(wert), zielRoh: ziel?.roh ?? null });
  }
  if (unlesbar.length) throw new NachholenAbbruch([`Nicht lesbar — es wird NICHTS geschrieben: ${unlesbar.join(' · ')}`]);
  if (!opt.ausfuehren) return bericht;

  // ════ Ausführen ════
  const start = new Date().toISOString();
  await schreiberSetzen(daten, 'neustart-nachholen');
  const herz = setInterval(() => { void schreiberHerz(daten, start, 'neustart-nachholen').catch(() => {}); }, 30_000);
  herz.unref?.();
  const geschrieben = { bestaende: 0, gesichert: [] };
  try {
    const stempel = jetzt.toISOString().replace(/[:.]/g, '-');
    for (const p of plan) {
      if (p.zielRoh !== null) {
        const sicherung = path.join('archiv', `nachholen-vor-${p.name}-${stempel}.json`);
        await fs.mkdir(path.join(daten, 'archiv'), { recursive: true, mode: 0o700 });
        await atomarSchreiben(path.join(daten, sicherung), p.zielRoh);
        geschrieben.gesichert.push(sicherung);
      }
      await atomarSchreiben(path.join(daten, `${p.name}.json`), ring.aktiv ? huelleImModus(p.text, ring.aktiv, p.name, env) : p.text);
      geschrieben.bestaende++;
    }
    const abweichend = [];
    for (const p of plan) {
      try { if (textOeffnen(await fs.readFile(path.join(daten, `${p.name}.json`), 'utf8'), p.name, ring, env) !== p.text) abweichend.push(p.name); }
      catch { abweichend.push(p.name); }
    }
    if (abweichend.length) throw new Error(`Zurückgelesen weicht ab: ${abweichend.join(', ')}`);
    bericht.geschrieben = geschrieben;
  } catch (e) {
    throw new NachholenAbbruch([`Abgebrochen beim Schreiben: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}. Bisherige Dateien liegen unter <daten>/archiv/nachholen-vor-… (zurückkopieren, falls nötig).`], 1);
  } finally {
    clearInterval(herz);
    schreiberEntfernenSync(daten);
  }
  return bericht;
}
