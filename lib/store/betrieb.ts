// ─── Betrieb der Datenschicht: Start, Herzschlag, Abschaltung (29.09., Paket D-A #9/#16) ─
// Läuft einmal je Server-Prozess (instrumentation.ts → register, nur Node-Laufzeit):
//   · Lockfile `<daten>/.schreiber` setzen und alle 30 s auffrischen — Skripte, die in den
//     Datenordner schreiben, brechen ab, solange eine lebende App ihn hält (lib/store/schreiber.mjs).
//     Hält schon ein anderer lebender Prozess denselben Ordner (lokal: 3001 + 3011), meldet es der
//     Head of IT als Befund — die App startet trotzdem.
//   · SIGTERM/SIGINT (Docker stop, `stop_grace_period: 60s` in compose.yml): laufende Vorgänge
//     dürfen noch 20 s schreiben (mehrstufige Abläufe werden fertig), danach lehnt die Datenschicht
//     neue Schreibungen mit 503 ab (`SchreibenGesperrt`). Next schließt parallel den Server und
//     wartet auf offene Anfragen. Beim Beenden verschwindet das Lockfile (nur das eigene).

import { datenOrdner, abschaltungBeginnen, warteBisStill, datenschichtLage } from './local-db';
import { schreiberSetzen, schreiberHerz, schreiberEntfernenSync, HERZ_MS, type SchreiberEintrag } from './schreiber.mjs';

interface BetriebZustand { gestartet: boolean; start: string; fremd: SchreiberEintrag | null; herz?: ReturnType<typeof setInterval> }
const g = globalThis as unknown as { __makeosBetrieb?: BetriebZustand };
const B: BetriebZustand = (g.__makeosBetrieb ??= { gestartet: false, start: new Date().toISOString(), fremd: null });

/** Ein zweiter lebender Schreiber auf demselben Datenordner (für den Head of IT) — nur PID/Host, keine Inhalte. */
export const fremderSchreiber = (): { pid: number; host: string } | null => (B.fremd ? { pid: B.fremd.pid, host: B.fremd.host } : null);

export async function betriebStarten(): Promise<void> {
  if (B.gestartet) return;
  B.gestartet = true;
  const ordner = datenOrdner();
  try {
    const r = await schreiberSetzen(ordner, 'app');
    B.fremd = r.fremd;
    if (r.fremd) console.error(`[MAKE OS] Achtung: ein zweiter Prozess schreibt in denselben Datenordner (PID ${r.fremd.pid} auf „${r.fremd.host}“).`);
  } catch (e) { console.error('[MAKE OS] Lockfile .schreiber nicht gesetzt:', e instanceof Error ? e.message : e); }
  B.herz = setInterval(() => {
    schreiberHerz(ordner, B.start, 'app').then(r => { B.fremd = r.fremd; }).catch(() => {});
  }, HERZ_MS);
  B.herz.unref?.();

  const beenden = (signal: string) => {
    abschaltungBeginnen();
    const l = datenschichtLage();
    console.log(`[MAKE OS] ${signal}: Abschaltung — ${l.laufend} Schreibung(en) laufen noch; neue Schreibungen ab +20 s mit 503 abgelehnt.`);
    void warteBisStill(45_000).then(still => console.log(`[MAKE OS] Datenschicht ${still ? 'ist still' : 'schreibt nach 45 s noch'} — Beenden.`));
  };
  process.once('SIGTERM', () => beenden('SIGTERM'));
  process.once('SIGINT', () => beenden('SIGINT'));
  process.once('exit', () => { if (B.herz) clearInterval(B.herz); schreiberEntfernenSync(ordner); });
}
