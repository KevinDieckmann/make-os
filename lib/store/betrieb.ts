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
//   · 5 s nach dem Start: offene Absichten fertigstellen (lib/store/absichten-fortsetzen.ts, Paket D-C #17).
//   · 20 s nach dem Start: Brain-Index im tmpfs/Arbeitsspeicher neu bauen, alten Klartext-Index löschen (lib/brain/index.ts).
//   · 9 s nach dem Start (nur mit MAKE_OS_ALTBESTAND_PERSON): einmalige Übernahme des Nordsterns (lib/altbestand/nordstern-uebernahme.ts).

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

  // Absichtsprotokoll (29.09., Paket D-C #17): abgebrochene Vorgänge über mehrere Bestände (Art. 17, Import, Dubletten,
  // Kennungs-Umzug, Angebot) wenige Sekunden nach dem Start fertigstellen — nicht blockierend, wirft nie.
  const nachStart = setTimeout(() => {
    void import('./absichten-fortsetzen').then(m => m.offeneFertigstellen()).then(r => {
      if (r.gefunden) console.log(`[MAKE OS] Absichten beim Start: ${r.gefunden} aufgenommen, ${r.fertig} fertig, ${r.weiterOffen} weiter offen, ${r.gescheitert} gescheitert.`);
    }).catch(e => console.error('[MAKE OS] Absichten beim Start nicht fertiggestellt:', e instanceof Error ? e.message : e));
  }, 5_000);
  nachStart.unref?.();

  // Einmalige Übernahme des Altbestands „Nordstern“ (08.10. abends, Fragebogen Teil 3, Paket A2): NUR mit MAKE_OS_ALTBESTAND_PERSON
  // (unser Server) — Demo- und Kunden-Instanzen setzen die Variable nie, dann wird das Modul gar nicht erst geladen. Idempotent, wirft
  // nie. Wird mit dem übernächsten Upload samt Modul entfernt (lib/altbestand/nordstern-uebernahme.ts).
  if (process.env.MAKE_OS_ALTBESTAND_PERSON) {
    const nordsternAltbestand = setTimeout(() => {
      void import('@/lib/altbestand/nordstern-uebernahme').then(m => m.nordsternAltbestandUebernehmen()).catch(e => console.error('[MAKE OS] Altbestand Nordstern nach dem Start:', e instanceof Error ? e.name : 'unbekannt'));
    }, 9_000);
    nordsternAltbestand.unref?.();
  }

  // Brain-Index (05.10., Paket „Verschlüsselung lückenlos“): liegt nur noch im tmpfs bzw. Arbeitsspeicher — nach dem Start
  // leer. 20 s nach dem Start (Seiten zuerst) alten Klartext-Index entfernen und neu bauen; bis dahin sucht ZOE über die Dateien.
  const brainNachStart = setTimeout(() => {
    void import('@/lib/brain/index').then(m => m.indexNachStart()).catch(e => console.error('[MAKE OS] Brain-Index nach dem Start:', e instanceof Error ? e.message : e));
  }, 20_000);
  brainNachStart.unref?.();

  // Einmalige Übernahme des Altbestands (08.10. abends, Fragebogen Teil 3): NUR mit MAKE_OS_ALTBESTAND_PERSON (unser Server) —
  // Demo- und Kunden-Instanzen setzen die Variable nie, dann wird das Modul gar nicht erst geladen. Idempotent, wirft nie.
  // Wird mit dem übernächsten Upload samt Modul entfernt (lib/altbestand/uebernahme.ts).
  if (process.env.MAKE_OS_ALTBESTAND_PERSON) {
    const altbestandNachStart = setTimeout(() => {
      void import('@/lib/altbestand/uebernahme').then(m => m.altbestandUebernehmen()).catch(e => console.error('[MAKE OS] Altbestand nach dem Start:', e instanceof Error ? e.name : 'unbekannt'));
    }, 8_000);
    altbestandNachStart.unref?.();
  }

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
