// ─── MAKE OS — Der Arbeiter ─────────────────────────────────────────────────
// Baustein 3 (07.09.). Bis hierher war „Hintergrund" ein offener Browser-Tab:
// components/os/Taktgeber.tsx, ein setInterval im Fenster. Tab zu, alles steht.
//
// Dieser Prozess läuft neben der App. Er holt sich Aufträge aus der
// Warteschlange und lässt sie ausführen — so viele nebeneinander, wie die
// Maschine trägt. Kevins Bedingung: „so viele wie der Mac verträgt."
//
// Er kennt bewusst KEINE Fachlogik. Für jeden Auftrag ruft er die App auf und
// die führt ihn durch dieselbe eine Stelle aus wie Jarvis selbst — mit
// Risiko-Stufe, Trockenlauf und Protokoll. Ein Werkzeug, das eine Freigabe
// braucht, landet auch nachts im Stapel und nicht im Bestand.
//
// Start: node worker.mjs   (start.sh macht das automatisch)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const ORT = process.env.MAKE_OS_URL ?? 'http://localhost:3001';

function schluessel() {
  if (process.env.MAKE_OS_KEY) return process.env.MAKE_OS_KEY;
  try {
    const zeile = readFileSync(new URL('.env.local', import.meta.url), 'utf8')
      .split('\n').find(z => z.startsWith('MAKE_OS_KEY='));
    return zeile ? zeile.slice('MAKE_OS_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
  } catch { return ''; }
}
const KEY = schluessel();
if (!KEY) {
  console.error('[Arbeiter] Kein MAKE_OS_KEY gefunden — ohne den darf ich nichts. Beende.');
  process.exit(1);
}

// Nur ein Arbeiter je MAKE OS (25.09.): Seit MAKE OS im schnellen Modus läuft,
// wird es nach Code-Änderungen neu gestartet — und start.sh startet dabei
// jedes Mal einen Arbeiter. Der ältere tritt ab, statt doppelt mitzuarbeiten.
const PID_DATEI = new URL('.data/worker.pid', import.meta.url);
try {
  const alt = Number(readFileSync(PID_DATEI, 'utf8').trim());
  if (alt && alt !== process.pid && execFileSync('ps', ['-p', String(alt), '-o', 'command='], { encoding: 'utf8' }).includes('worker.mjs')) {
    process.kill(alt, 'SIGTERM');
    console.log(`[Arbeiter] Älterer Arbeiter (${alt}) tritt ab.`);
  }
} catch { /* keiner da oder schon weg */ }
try { mkdirSync(new URL('.data/', import.meta.url), { recursive: true }); writeFileSync(PID_DATEI, String(process.pid)); } catch { /* ohne Datei geht es auch */ }

const KERNE = os.cpus().length || 4;
/** Obergrenze: die Arbeit ist Warten auf Netz und Modell, nicht Rechnen —
 *  deshalb darf es mehr als Kerne sein. Nach oben gedeckelt, damit ein
 *  Videocall nebenher nicht ruckelt. */
const MAX_PARALLEL = Math.max(4, Math.min(12, Math.round(KERNE * 1.5)));

/** Wie viel wir uns gerade zutrauen. Ist die Maschine schon ausgelastet,
 *  nehmen wir weniger — „drosselt selbst". */
function plaetze(belegt) {
  const last = os.loadavg()[0] / KERNE;
  const grenze = last > 1.1 ? Math.max(2, Math.floor(MAX_PARALLEL / 3))
    : last > 0.8 ? Math.max(3, Math.floor(MAX_PARALLEL / 2))
    : MAX_PARALLEL;
  return Math.max(0, grenze - belegt);
}

const kopf = { 'Content-Type': 'application/json', 'x-make-key': KEY };
const zeit = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let laufend = 0;
let letzterTakt = 0;

/**
 * Einmal je Minute fragen, was der Takt für fällig hält, und es einreihen.
 * Bis zum 07.09. war das ein setInterval im Browser — wer den Tab schloss,
 * hielt die Uhr an. Der Server entscheidet die Fälligkeit aus dem echten
 * Zustand, deshalb ist ein zweiter Frager (der Browser als Rückfall)
 * gefahrlos: derselbe Auftrag bleibt nur einmal offen.
 */
async function takt() {
  if (Date.now() - letzterTakt < 60_000) return;
  letzterTakt = Date.now();
  try {
    const r = await fetch(`${ORT}/api/jarvis/takt`, { method: 'POST', headers: kopf, signal: AbortSignal.timeout(20_000) });
    const d = await r.json();
    if (d.eingereiht) console.log(`[${zeit()}] Takt: ${d.eingereiht} eingereiht — ${(d.was ?? []).join(', ')}`);
  } catch { /* nächste Minute wieder */ }
}
let stillGesehen = 0;
let appWeg = 0;

async function fuehreAus(auftrag) {
  laufend++;
  const start = Date.now();
  try {
    const r = await fetch(`${ORT}/api/jarvis/auftraege/lauf`, {
      method: 'POST', headers: kopf, body: JSON.stringify({ id: auftrag.id }),
      signal: AbortSignal.timeout(280_000),
    });
    const d = await r.json();
    const s = Math.round((Date.now() - start) / 1000);
    const wie = d.gestapelt ? 'in den Stapel' : d.ok ? 'fertig' : 'fehlgeschlagen';
    console.log(`[${zeit()}] ${auftrag.art}/${auftrag.name} — ${wie} (${s}s)`);
  } catch (err) {
    // Der Auftrag bleibt in der Warteschlange: die Pacht läuft ab und ein
    // späterer Versuch nimmt ihn wieder auf.
    console.log(`[${zeit()}] ${auftrag.art}/${auftrag.name} — abgebrochen: ${String(err?.message ?? err).slice(0, 90)}`);
  } finally {
    laufend--;
  }
}

async function runde() {
  await takt();
  const frei = plaetze(laufend);
  if (frei <= 0) return false;
  const r = await fetch(`${ORT}/api/jarvis/auftraege/nimm`, {
    method: 'POST', headers: kopf, body: JSON.stringify({ anzahl: frei, pacht: 300 }),
    signal: AbortSignal.timeout(20_000),
  });
  const d = await r.json();
  const neue = Array.isArray(d.auftraege) ? d.auftraege : [];
  if (!neue.length) return false;
  console.log(`[${zeit()}] ${neue.length} übernommen (${laufend} laufen schon, bis zu ${MAX_PARALLEL} parallel)`);
  // Bewusst NICHT awaiten: die Läufe laufen nebeneinander weiter, während die
  // nächste Runde schon wieder nachfüllt.
  for (const a of neue) void fuehreAus(a);
  return true;
}

console.log(`[${zeit()}] Arbeiter läuft. ${KERNE} Kerne, bis zu ${MAX_PARALLEL} Aufträge gleichzeitig. Ziel: ${ORT}`);

let weiter = true;
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { console.log(`[${zeit()}] Arbeiter hört auf.`); weiter = false; setTimeout(() => process.exit(0), 500); });
}

while (weiter) {
  try {
    const gabWas = await runde();
    appWeg = 0;
    stillGesehen = gabWas ? 0 : stillGesehen + 1;
  } catch {
    appWeg++;
    stillGesehen++;
    // Ist die App zwanzig Runden lang weg, ist sie beendet worden. Dann geht
    // der Arbeiter auch — sonst läuft er als Waise weiter.
    if (appWeg >= 20) { console.log(`[${zeit()}] App seit Langem nicht erreichbar. Arbeiter beendet sich.`); break; }
  }
  // Ruhig, wenn nichts los ist; sofort wieder da, sobald Arbeit kam.
  const pause = stillGesehen === 0 ? 1200 : Math.min(15_000, 2000 + stillGesehen * 800);
  await new Promise(r => setTimeout(r, pause));
}
