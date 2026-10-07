// ─── Postfächer — Jobs im Takt und IDLE-Wächter (Server, 06.10.2026) ──────────────────────────────────────────────
// Der Takt (app/api/zoe/takt, jede Minute, vom Arbeiter angestoßen, läuft im App-Prozess) hält die IMAP-Spiegel frisch:
//   · Abgleich je Person × Postfach: alle 2 Minuten, mit laufendem IDLE alle 15 Minuten (`imapFaellig`) — nie nach abgelehnter
//     Anmeldung (bis „Verbindung erneuern“), nie während einer Pause nach Fehler
//   · IDLE (RFC 2177), wo der Server es anbietet: EINE ruhende Verbindung je Postfach auf dem Posteingang; meldet der Server neue Post,
//     gleicht MAKE OS nach 3 s ab (gebündelt). Bricht die Verbindung ab, startet der nächste Takt sie neu (frühestens nach 2 · n Min.).
//     Abschaltbar je Instanz: MAKE_OS_IMAP_IDLE=aus (dann nur Abfrage). Höchstens `MAX_WAECHTER` Verbindungen je Instanz (1 vCPU).
// Nie blockierend; Fehler als EINE Zeile `[postfach] …` ohne Adresse oder Betreff.

import { alleSpeicher } from '@/lib/zugang/konten';
import { ladePostfaecher } from './register';
import { imapAbgleichen, imapAbgleichLaeuft, imapFaellig, zugangFuer } from './abgleich';
import { aendereImapStand, ladeImapStand } from './spiegel';
import { leitungen } from './transport';
import type { Postfach } from './typen';

const MAX_WAECHTER = 8;
const kurz = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message.slice(0, 120)}` : 'Fehler');

interface Waechter { stop?: () => Promise<void>; gestartet: number; fehlerFolge: number; naechsterVersuch: number; laeuft: boolean; zeit?: ReturnType<typeof setTimeout> }
const REG_KEY = Symbol.for('make-os.postfach-waechter');
const register = (): Map<string, Waechter> => {
  const g = globalThis as unknown as Record<symbol, Map<string, Waechter> | undefined>;
  return (g[REG_KEY] ??= new Map());
};

export const idleAn = (): boolean => !/^(aus|0|nein|false)$/i.test(process.env.MAKE_OS_IMAP_IDLE ?? '');

async function idleMerken(person: string, postfach: string, an: boolean): Promise<void> {
  await aendereImapStand(person, cur => {
    const alt = cur.postfaecher[postfach];
    if (!alt || !!alt.idleSeit === an) return null;
    const { idleSeit: _i, ...rest } = alt;
    return { ...cur, postfaecher: { ...cur.postfaecher, [postfach]: an ? { ...rest, idleSeit: new Date().toISOString() } : rest } };
  }).catch(() => { /* nur Anzeige */ });
}

async function waechterStarten(person: string, p: Postfach, jetzt: number): Promise<void> {
  const key = `${person}|${p.id}`;
  const reg = register();
  const w = reg.get(key) ?? { gestartet: 0, fehlerFolge: 0, naechsterVersuch: 0, laeuft: false };
  if (w.laeuft || jetzt < w.naechsterVersuch || reg.size >= MAX_WAECHTER && !reg.has(key)) return;
  reg.set(key, w);
  w.laeuft = true;
  const ende = (e?: unknown) => {
    if (!w.laeuft) return;
    w.laeuft = false; w.stop = undefined; w.fehlerFolge++;
    w.naechsterVersuch = Date.now() + Math.min(60, 2 * w.fehlerFolge) * 60_000;
    if (e) console.warn(`[postfach] IDLE beendet: ${kurz(e)}`);
    void idleMerken(person, p.id, false);
  };
  try {
    const l = await leitungen(p.anbieter === 'demo');
    const z = await zugangFuer(person, p);
    const r = await l.waechter(z, p.ordner?.posteingang ?? 'INBOX', () => {
      if (w.zeit) clearTimeout(w.zeit);
      w.zeit = setTimeout(() => { void imapAbgleichen(person, p.id, { nachlauf: true }).catch(x => console.warn(`[postfach] Abgleich nach IDLE: ${kurz(x)}`)); }, 3000);
    }, ende);
    w.stop = r.stop; w.gestartet = Date.now(); w.fehlerFolge = 0;
    await idleMerken(person, p.id, true);
  } catch (e) { ende(e); }
}

/** Wächter beenden, deren Postfach es nicht mehr gibt (Trennen) bzw. die nicht mehr laufen sollen. */
export async function waechterStoppen(person: string, postfach?: string): Promise<void> {
  const reg = register();
  for (const [key, w] of reg) {
    if (!key.startsWith(`${person}|`) || (postfach && key !== `${person}|${postfach}`)) continue;
    w.laeuft = false;
    if (w.zeit) clearTimeout(w.zeit);
    await w.stop?.().catch(() => { /* schon weg */ });
    reg.delete(key);
  }
}

export async function postfachJobsImTakt(jetzt = Date.now()): Promise<{ gestartet: string[] }> {
  const gestartet: string[] = [];
  for (const person of await alleSpeicher().catch(() => [] as string[])) {
    const liste = (await ladePostfaecher(person).catch(() => [] as Postfach[])).filter(p => p.quelle === 'imap');
    if (!liste.length) { await waechterStoppen(person); continue; }
    const stand = await ladeImapStand(person).catch(() => null);
    const ids = new Set(liste.map(p => p.id));
    for (const key of register().keys()) if (key.startsWith(`${person}|`) && !ids.has(key.slice(person.length + 1))) await waechterStoppen(person, key.slice(person.length + 1));
    for (const p of liste) {
      const sync = stand?.postfaecher[p.id];
      if (!imapAbgleichLaeuft(person, p.id) && imapFaellig(sync, jetzt)) {
        gestartet.push(`${person}|${p.id}`);
        void imapAbgleichen(person, p.id).catch(e => console.warn(`[postfach] Abgleich: ${kurz(e)}`));
      }
      if (p.idle && idleAn() && !sync?.fehlerAnmeldung && sync?.at) await waechterStarten(person, p, jetzt);
      if (sync?.fehlerAnmeldung) await waechterStoppen(person, p.id);
    }
  }
  return { gestartet };
}
