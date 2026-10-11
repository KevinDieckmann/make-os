#!/usr/bin/env node
// ─── MAKE OS — Update-Probe mit Altbestand (10.10., Pflicht-Gate vor jedem Upload) ──────────────────────────────────────────
// Kevin 10.10.: „Malin trägt schon aktuelle Daten ein — die müssen nach dem Update auch noch da sein!“
//
//   node scripts/update-probe.mjs --alt <Worktree der Online-Version> --neu <Worktree der neuen Version> --ordner <leerer Probe-Ordner> \
//        [--bericht <pfad.md>] [--ab neu] [--ohne-rueckweg]
//
// Ablauf (jede Version in einem eigenen Prozess, scripts/update-probe/kind.mjs):
//   1. ALT säen: Demo-Saat der Online-Version + Ergänzungen (Haken, Vitalwerte, eigene Ziele, Unteraufgaben/Serien, Familie, Ernährung,
//      Rechnungen, Beschlüsse, Inbox-Zustand, Fokus …) + Grundlauf (alle GET, Takt mit Arbeiter, Morgenlauf, Löschfristen) + Altformen.
//      Format wie live: Datenschlüssel gesetzt, OHNE MAKE_OS_FORMAT (= kompatibel, Hülle v1).
//   2. Schnappschuss vorher (jeder Bestand entschlüsselt, jede Kennung, jedes Feld; Dateien mit Fingerabdruck) + Kopie `<ordner>.vorher`.
//   3. NEU starten auf demselben Ordner: Start-Haken, alle GET als Inhaberin/Mitglied/Partner, Takt + Arbeiter, Morgenlauf, Löschfristen,
//      typische Schreib-Klicks.
//   4. Schnappschuss nachher + Vergleich (lib/betrieb/update-probe.ts) → Bericht (Markdown + JSON) mit „VERLUSTFREI: ja/nein“.
//   5. Rückweg (wenn nicht --ohne-rueckweg): ALT wieder auf den Ordner — lesbar? (nur berichtet).
//   Gegenprobe: die ALTE Version macht auf einer Kopie (`<ordner>.gegenprobe`) dasselbe wie die neue (Start, GET, Takt, Morgenlauf, Klicks).
//   Eine Abweichung, die sie genauso hat, ist kein Verlust DURCH das Update — sie steht als „bestehender Verlust“ im Bericht, blockiert nicht.
// `--ab neu` überspringt die Saat und beginnt wieder bei Schritt 3 mit der Kopie `<ordner>.vorher` (schneller zweiter Lauf).
// Ausgang: 0 = verlustfrei, 1 = Abweichungen (kein Upload), 2/3 = Aufruf/Einrichtung falsch.
//
// Sicherheit: nie `.data` (Abbruch), nur ein leerer bzw. von der Probe selbst angelegter Ordner (Marke `<ordner>.update-probe.json`),
// nur Test-Schlüssel, kein Netz (fetch gesperrt, interne Aufrufe in-process), keine echten Quellen (Apple, iCloud, Vault, Google).
// Last (Kevin: ≤ 80 %): Kinder laufen mit `nice -n 10` und `--max-old-space-size=3072`, nacheinander.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream, existsSync, promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const schalter = n => argv.includes(`--${n}`);
const fehler = (t, code = 2) => { console.error(`Update-Probe: ${t}`); process.exit(code); };

const alt = arg('alt') && path.resolve(arg('alt'));
const neu = path.resolve(arg('neu') ?? path.join(hier, '..'));
const ordner = arg('ordner') && path.resolve(arg('ordner'));
if (!alt || !ordner) fehler('Aufruf: node scripts/update-probe.mjs --alt <pfad> --neu <pfad> --ordner <pfad> [--bericht <pfad.md>] [--ab neu] [--ohne-rueckweg]');
for (const [n, w] of [['alt', alt], ['neu', neu]]) if (!existsSync(path.join(w, 'app', 'api')) || !existsSync(path.join(w, 'node_modules'))) fehler(`--${n} ${w}: kein MAKE-OS-Stand mit node_modules (Symlink auf das Haupt-Repo genügt).`);
if (ordner.split(path.sep).includes('.data')) fehler(`--ordner ${ordner}: enthält „.data“ — so heißt der echte Datenordner. Abgebrochen.`);
if (ordner === path.parse(ordner).root || [alt, neu].some(w => ordner === w || ordner.startsWith(w + path.sep))) fehler('--ordner darf weder die Wurzel noch in einem Repo liegen.');
const bericht = path.resolve(arg('bericht') ?? `${ordner}-bericht.md`);
const arbeit = `${ordner}-probe`;
const marke = `${ordner}.update-probe.json`;
const kopie = `${ordner}.vorher`;
const abNeu = arg('ab') === 'neu';

// Test-Geheimnisse: fest für die Probe (keine echten Schlüssel, nichts davon verlässt den Probe-Ordner).
const SCHLUESSEL = 'update-probe-datenschluessel-nur-fuer-den-test-0001';
const env = {
  PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: 'de_DE.UTF-8', TZ: 'Europe/Berlin',
  MAKE_OS_DATEN_DIR: ordner, MAKE_VAULT_DIR: path.join(ordner, 'wissen'), MAKE_OS_DOKU_WURZEL: 'aus',
  MAKE_OS_DATEN_SCHLUESSEL: SCHLUESSEL, // OHNE MAKE_OS_FORMAT — wie live: kompatibel (Hülle v1, kein `_v`)
  MAKE_OS_KEY: 'update-probe-dienstschluessel-nur-fuer-den-test-0001', SESSION_SECRET: 'update-probe-sitzung-nur-fuer-den-test-000000001',
  MAKE_OS_PEPPER: 'update-probe-pepper-nur-fuer-den-test-00000000001',
  MAKE_OS_DEMO: '1', MAKE_OS_OHNE_APPLE: '1', MAKE_OS_INTERN: 'http://probe.intern',
  MAKE_OS_BRAIN_INDEX: 'speicher', MAKE_OS_EMBEDDINGS: 'aus', MAKE_OS_KI_VORGABE: 'kompatibel',
};
Object.assign(process.env, { MAKE_OS_DATEN_SCHLUESSEL: SCHLUESSEL });
delete process.env.MAKE_OS_FORMAT;

const require = createRequire(path.join(neu, 'package.json'));
const jiti = require('jiti')(path.join(neu, 'update-probe.js'), { alias: { '@': neu }, interopDefault: true });
const probe = jiti(path.join(neu, 'lib/betrieb/update-probe.ts'));
const { schnappschuss } = await import(pathToFileURL(path.join(hier, 'update-probe', 'lesen.mjs')).href);
const kommitVon = async w => new Promise(res => { const p = spawn('git', ['-C', w, 'log', '-1', '--format=%h %s'], { stdio: ['ignore', 'pipe', 'ignore'] }); let t = ''; p.stdout.on('data', d => { t += d; }); p.on('close', () => res(t.trim().slice(0, 90) || w)); });

/** Ein Kind (eine Version) laufen lassen — Ausgabe in die Konsole und ins Log. `o.ordner` = anderer Datenordner (Gegenprobe), `o.name` = Dateiname. */
function kind(rolle, wurzel, extra = [], o = {}) {
  const name = o.name ?? rolle;
  const aus = path.join(arbeit, `${name}.json`);
  const logDatei = createWriteStream(path.join(arbeit, `${name}.log`));
  const d = o.ordner ?? ordner;
  return new Promise((res, rej) => {
    const p = spawn('nice', ['-n', '10', process.execPath, '--max-old-space-size=3072', path.join(hier, 'update-probe', 'kind.mjs'), rolle, '--wurzel', wurzel, '--aus', aus, ...extra],
      { env: { ...env, MAKE_OS_DATEN_DIR: d, MAKE_VAULT_DIR: path.join(d, 'wissen') }, stdio: ['ignore', 'pipe', 'pipe'] });
    const weiter = d => { logDatei.write(d); for (const z of String(d).split('\n')) if (z.startsWith('[probe:')) console.log(z.slice(0, 220)); };
    p.stdout.on('data', weiter);
    p.stderr.on('data', d => logDatei.write(d));
    p.on('error', rej);
    p.on('close', async code => {
      logDatei.end();
      try { res({ code, ...JSON.parse(await fs.readFile(aus, 'utf8')) }); }
      catch { rej(new Error(`${name}: kein Ergebnis (Ausgang ${code}) — siehe ${path.join(arbeit, `${name}.log`)}`)); }
    });
  });
}
const leer = async d => { try { return (await fs.readdir(d)).filter(f => f !== '.DS_Store').length === 0; } catch { return true; } };
const laufBericht = l => l && ({ schritte: l.schritte, routen: l.routen ?? undefined, unsichtbar: l.unsichtbar, unsichtbarAuchAlt: l.unsichtbarAuchAlt, unlesbarAlt: l.unlesbarAlt ?? undefined });
const gegenOrdner = `${ordner}.gegenprobe`;

// ── 1. Ordner vorbereiten + Saat ───────────────────────────────────────────────────────────────────────────────────────
await fs.mkdir(arbeit, { recursive: true });
let saat;
if (abNeu) {
  if (!existsSync(kopie) || !existsSync(path.join(arbeit, 'vorher.json')) || !existsSync(path.join(arbeit, 'saat.json'))) fehler(`--ab neu braucht einen früheren vollen Lauf (${kopie}, ${arbeit}/vorher.json).`, 3);
  if (!existsSync(marke)) fehler(`${ordner} wurde nicht von der Probe angelegt (Marke ${marke} fehlt) — abgebrochen.`, 3);
  await fs.rm(ordner, { recursive: true, force: true });
  await fs.cp(kopie, ordner, { recursive: true });
  saat = JSON.parse(await fs.readFile(path.join(arbeit, 'saat.json'), 'utf8'));
  console.log(`Update-Probe: Saat übersprungen — ${ordner} aus ${kopie} wiederhergestellt.`);
} else {
  if (!(await leer(ordner))) {
    if (!existsSync(marke)) fehler(`${ordner} ist nicht leer und wurde nicht von der Probe angelegt (Marke fehlt) — abgebrochen.`, 3);
    await fs.rm(ordner, { recursive: true, force: true });
  }
  await fs.rm(kopie, { recursive: true, force: true });
  await fs.mkdir(ordner, { recursive: true });
  await fs.writeFile(marke, JSON.stringify({ angelegt: new Date().toISOString(), alt, neu }, null, 1));
  console.log(`Update-Probe: Saat mit der alten Version (${alt}) …`);
  saat = await kind('saat', alt, ['--passwort', randomBytes(12).toString('base64url')]);
  if (saat.abbruch) fehler(`Saat abgebrochen — ${path.join(arbeit, 'saat.log')}`, 3);
  const vorher = await schnappschuss(ordner, { wurzel: neu, bestandBild: probe.bestandBild });
  await fs.writeFile(path.join(arbeit, 'vorher.json'), JSON.stringify(vorher));
  await fs.cp(ordner, kopie, { recursive: true });
  console.log(`Update-Probe: vorher ${Object.keys(vorher.bestaende).length} Bestände, ${Object.keys(vorher.dateien).length} Dateien.`);
}
const vorher = JSON.parse(await fs.readFile(path.join(arbeit, 'vorher.json'), 'utf8'));

// ── 2. Gegenprobe: die ALTE Version macht auf einer Kopie genau dasselbe wie gleich die neue (Start, GET, Takt, Morgenlauf, Klicks) ─────
//    Was dort genauso verloren geht, ist kein Verlust DURCH das Update — es bleibt im Bericht (bestehender Fehler), blockiert aber nicht.
const { KLICK_ERLAUBT } = await import(pathToFileURL(path.join(hier, 'update-probe', 'klicks.mjs')).href);
const regeln = [...probe.ERLAUBT, ...KLICK_ERLAUBT];
const marken = JSON.stringify(saat.marken ?? {});
console.log('Update-Probe: Gegenprobe — alte Version, dieselben Läufe und Klicks auf einer Kopie …');
await fs.rm(gegenOrdner, { recursive: true, force: true });
await fs.cp(kopie, gegenOrdner, { recursive: true });
const gegenLauf = await kind('neu', alt, ['--marken', marken, '--etikett', 'gegenprobe'], { ordner: gegenOrdner, name: 'gegenprobe' });
const gegenNachher = await schnappschuss(gegenOrdner, { wurzel: neu, bestandBild: probe.bestandBild });
const tagVon = l => new Date(l.start ?? Date.now()).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const gegen = probe.vergleiche(vorher, gegenNachher, { mitSchluessel: true, erlaubt: regeln, heute: tagVon(gegenLauf) });

// ── 3. Neue Version ────────────────────────────────────────────────────────────────────────────────────────────────────
console.log(`Update-Probe: neue Version (${neu}) auf dem Bestand …`);
const neuLauf = await kind('neu', neu, ['--marken', marken]);
const nachher = await schnappschuss(ordner, { wurzel: neu, bestandBild: probe.bestandBild });
await fs.writeFile(path.join(arbeit, 'nachher.json'), JSON.stringify(nachher));
const ergebnis = probe.mitGegenprobe(probe.vergleiche(vorher, nachher, { mitSchluessel: true, erlaubt: regeln, heute: tagVon(neuLauf) }), gegen);
const gegenUnsichtbar = new Set(gegenLauf.unsichtbar ?? []);
neuLauf.unsichtbarAuchAlt = (neuLauf.unsichtbar ?? []).filter(m => gegenUnsichtbar.has(m));
neuLauf.unsichtbar = (neuLauf.unsichtbar ?? []).filter(m => !gegenUnsichtbar.has(m));

// ── 4. Rückweg ─────────────────────────────────────────────────────────────────────────────────────────────────────────
let rueckweg;
if (!schalter('ohne-rueckweg')) {
  console.log('Update-Probe: Rückweg — alte Version auf dem neuen Stand …');
  rueckweg = await kind('rueckweg', alt).catch(e => ({ schritte: [{ name: 'Rückweg', ok: false, info: e.message }] }));
}

// ── 5. Bericht ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const schonVorherUnsichtbar = Object.entries(saat.markenUnsichtbarSchonVorher ?? {}).flatMap(([p, l]) => l.map(m => `${p}: ${m}`));
// Selbsttest: sieht das Werkzeug auf DIESEN Bildern überhaupt einen Verlust? (Eintrag + Feld im Speicher entfernt — muss gemeldet werden.)
const st = probe.selbsttest(vorher, nachher, { mitSchluessel: true, erlaubt: regeln, heute: tagVon(neuLauf) });
const selbsttestText = `${st.ok ? 'ja, erkannt' : 'NEIN — das Werkzeug sieht den Verlust nicht'} (${st.erwartet.join(' · ') || 'nichts Geeignetes gefunden'})`;
const markenZahl = Object.values(saat.marken ?? {}).reduce((n, l) => n + l.length, 0);
const sichtprobe = `${markenZahl} Marken aus der Saat (vorher sichtbar) in den Antworten an ihre Person gesucht — nachher nicht mehr sichtbar: ${(neuLauf.unsichtbar?.length ?? 0) + (neuLauf.unsichtbarAuchAlt?.length ?? 0)}.`;
const meta = { alt: await kommitVon(alt), neu: await kommitVon(neu), ordner, zeit: new Date().toISOString(), saat: laufBericht(saat), neuLauf: laufBericht(neuLauf), gegenprobe: laufBericht(gegenLauf), rueckweg: laufBericht(rueckweg), schonVorherUnsichtbar, selbsttest: selbsttestText, sichtprobe };
const verlustfrei = ergebnis.verlustfrei && !(neuLauf.unsichtbar?.length) && st.ok;
await fs.writeFile(bericht, probe.berichtMarkdown({ ...ergebnis, verlustfrei }, meta));
await fs.writeFile(bericht.replace(/\.md$/, '') + '.json', JSON.stringify({ meta, ergebnis: { ...ergebnis, verlustfrei } }, null, 1));
console.log(`\nVERLUSTFREI: ${verlustfrei ? 'ja' : 'nein'} — ${ergebnis.abweichungen.length} Abweichung(en) durch das Update, ${neuLauf.unsichtbar?.length ?? 0} nicht mehr sichtbar · bestehend (alt genauso): ${(ergebnis.auchAlt?.length ?? 0) + (neuLauf.unsichtbarAuchAlt?.length ?? 0)} · ${ergebnis.erlaubt.length} erlaubt · ${ergebnis.formaenderungen.length} Formänderungen.`);
console.log(`Bericht: ${bericht}`);
process.exit(verlustfrei ? 0 : 1);
