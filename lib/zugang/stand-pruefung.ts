// ─── MAKE OS — Gilt ein Sitzungszettel noch? (26.09.) ───────────────────────
// Die Middleware läuft am Rand (kein Dateizugriff). Sie fragt deshalb den
// Server nach dem Stand des Kontos — mit dem Dienstschlüssel, höchstens alle 15 Sekunden
// je Konto (bei einem unpassenden Zettel einmal sofort). Drei Dinge
// machen einen signierten Zettel ungültig: ein neues Passwort (Stand), „alle
// anderen Geräte abmelden“ (ausgestellt vor `ab`) und Abmelden (Widerruf der
// Kennung).
//
// Seit 05.10. (Paket „Zugang & Schlüssel härten“ Punkt 7):
//   · Fail-closed: antwortet der Server nicht, gilt ein Stand, der höchstens KULANZ_MS (5 min) alt ist, weiter — kurze
//     Aussetzer (Neustart, Last) werfen niemanden raus. Ist kein Stand da oder er ist älter, heißt es „unklar“: die
//     Middleware antwortet 503 („gleich noch einmal“), ohne die Sitzung zu löschen. Vorher ließ ein unbekannter Stand
//     still durch.
//   · Leerlauf-Ende: wer länger als `leerlaufStunden` (Konto › Zugang der Instanz, Standard 12 h) keine Anfrage gestellt
//     hat, muss sich neu anmelden — zusätzlich zur 14-Tage-Grenze. Gemerkt wird die letzte Aktivität je Zettel hier im
//     Prozess; nach einem Neustart beginnt die Uhr für bestehende Zettel neu (keine Abmelde-Welle beim Upload). Ein
//     abgelaufener Zettel wird zusätzlich beim Server widerrufen (POST /api/konto/stand) — das überlebt den Neustart.

import { innenAdresse } from '@/lib/innen';
import type { Sitzung } from '@/lib/zugang/sitzung';

// 15 Sekunden: ein beim Abmelden widerrufener (etwa gestohlener) Zettel stirbt binnen dieser Frist überall.
const TTL_MS = 15_000;
/** Ein schon abgelehnter Zettel wird frühestens nach so vielen ms erneut beim Server nachgefragt. */
const NACHFRAGE_MS = 5_000;
/** So lange gilt ein gemerkter Stand weiter, wenn der Server nicht antwortet — danach „unklar“ (503). */
export const KULANZ_MS = 5 * 60_000;
/** Leerlauf ohne Angabe des Servers (alter Server-Stand): 12 Stunden. */
const LEERLAUF_STANDARD_MS = 12 * 3_600_000;
interface Stand { stand: string; ab: number; widerrufen: string[]; bis: number; geholt: number; abgelehnt: Map<string, number>; /** 2FA-Pflicht offen (05.10.) und ab wann. */ zfOffen: boolean; zfAb: number; /** Leerlauf-Ende (ms). */ leerlaufMs: number }
export type StandUrteil = 'gueltig' | 'ungueltig' | 'unklar';
/** sid → letzte Anfrage (ms); TOT = wegen Leerlauf beendet. */
const aktiv = new Map<string, number>();
const TOT = -1;
/** speicher → Stand laut Server (stand '' = Konto gibt es nicht mehr). */
const gemerkt = new Map<string, Stand>();
/** Läuft für ein Konto gerade eine Nachfrage, hängen sich alle anderen Anfragen daran (27.09., Tempo): ein Seitenstart
 *  stellt ~28 Anfragen parallel — vorher fragte jede einzeln beim Server nach. */
const laufend = new Map<string, Promise<Stand>>();

async function nachfragen(req: Request, speicher: string, schluessel: string, alt: Stand | undefined, jetzt: number): Promise<Stand> {
  const l = laufend.get(speicher);
  if (l) return l;
  const p = (async () => {
    const r = await fetch(`${innenAdresse(req)}/api/konto/stand?speicher=${encodeURIComponent(speicher)}`, { headers: { 'x-make-key': schluessel }, cache: 'no-store' });
    if (!r.ok && r.status !== 404) throw new Error(`Stand: ${r.status}`);
    const d = r.status === 404 ? { stand: '', ab: 0, widerrufen: [] } : ((await r.json()) as { stand?: unknown; ab?: unknown; widerrufen?: unknown; zfOffen?: unknown; zfAb?: unknown; leerlaufMin?: unknown });
    if (typeof d.stand !== 'string') throw new Error('Stand: keine Antwort');
    const neu: Stand = {
      stand: d.stand, ab: typeof d.ab === 'number' ? d.ab : 0,
      widerrufen: Array.isArray(d.widerrufen) ? d.widerrufen.filter((x): x is string => typeof x === 'string') : [],
      bis: jetzt + TTL_MS, geholt: jetzt, abgelehnt: alt?.abgelehnt ?? new Map<string, number>(),
      zfOffen: 'zfOffen' in d && d.zfOffen === true, zfAb: 'zfAb' in d && typeof d.zfAb === 'number' ? d.zfAb : 0,
      leerlaufMs: 'leerlaufMin' in d && typeof d.leerlaufMin === 'number' && d.leerlaufMin >= 60 ? d.leerlaufMin * 60_000 : LEERLAUF_STANDARD_MS,
    };
    gemerkt.set(speicher, neu);
    return neu;
  })().finally(() => { laufend.delete(speicher); });
  laufend.set(speicher, p);
  return p;
}

const passt = (m: Stand, s: Sitzung) => m.stand === s.stand && s.ausgestellt >= m.ab && !m.widerrufen.includes(s.sid);

export async function standPruefen(req: Request, s: Sitzung, schluessel: string, jetzt: number = Date.now()): Promise<StandUrteil> {
  const alt = gemerkt.get(s.speicher);
  const kennung = `${s.stand}.${s.sid}`;
  let urteil: StandUrteil | null = null;
  // Ein Zettel, der NACH dem letzten Nachfragen ausgestellt wurde (frische Anmeldung, „alle anderen Geräte
  // abmelden“, zweiter Faktor an), erzwingt ein Nachfragen — so fliegen die anderen Geräte sofort, nicht erst
  // nach einer Minute.
  const frisch = !!alt && s.ausgestellt > alt.geholt;
  if (alt && alt.bis > jetzt && !frisch) {
    if (passt(alt, s)) urteil = 'gueltig';
    else {
      // Unpassend: ein noch nie gesehener Zettel (gerade Passwort geändert / neu angemeldet) wird sofort
      // nachgefragt, ein schon abgelehnter (altes Gerät) frühestens nach fünf Sekunden wieder.
      const zuletzt = alt.abgelehnt.get(kennung);
      if (zuletzt && zuletzt + NACHFRAGE_MS > jetzt) return 'ungueltig';
    }
  }
  if (!urteil) {
    try {
      const neu = await nachfragen(req, s.speicher, schluessel, alt, jetzt);
      const ok = passt(neu, s);
      if (!ok) neu.abgelehnt.set(kennung, jetzt);
      neu.abgelehnt.forEach((t, k) => { if (t + TTL_MS < jetzt) neu.abgelehnt.delete(k); });
      urteil = ok ? 'gueltig' : 'ungueltig';
    } catch {
      // Fail-closed (05.10.): nur ein frischer gemerkter Stand trägt über einen Aussetzer; sonst „unklar“ (503, kein Abmelden).
      if (!alt || jetzt - alt.geholt > KULANZ_MS) return 'unklar';
      urteil = passt(alt, s) ? 'gueltig' : 'ungueltig';
    }
  }
  if (urteil !== 'gueltig') return urteil;
  return leerlaufGueltig(req, s, schluessel, jetzt) ? 'gueltig' : 'ungueltig';
}

/** Wie bisher als Ja/Nein: nur „gültig“ ist ja (unklar heißt nicht mehr still ja). */
export async function standGueltig(req: Request, s: Sitzung, schluessel: string): Promise<boolean> {
  return (await standPruefen(req, s, schluessel)) === 'gueltig';
}

/** Leerlauf-Ende (05.10.): letzte Anfrage dieses Zettels zu lange her → beenden und beim Server widerrufen. */
function leerlaufGueltig(req: Request, s: Sitzung, schluessel: string, jetzt: number): boolean {
  const zuletzt = aktiv.get(s.sid);
  if (zuletzt === TOT) return false;
  const leerlauf = gemerkt.get(s.speicher)?.leerlaufMs ?? LEERLAUF_STANDARD_MS;
  if (zuletzt !== undefined && jetzt - zuletzt > leerlauf) {
    aktiv.set(s.sid, TOT);
    void fetch(`${innenAdresse(req)}/api/konto/stand`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-make-key': schluessel },
      body: JSON.stringify({ speicher: s.speicher, sid: s.sid, bis: s.ablauf }), cache: 'no-store', signal: AbortSignal.timeout(5_000),
    }).catch(() => { /* der Zettel ist hier schon tot; der Widerruf beim Server ist Zusatz */ });
    return false;
  }
  aktiv.set(s.sid, jetzt);
  if (aktiv.size > 20_000) aktiv.forEach((t, k) => { if (t !== TOT && jetzt - t > 14 * 864e5) aktiv.delete(k); });
  return true;
}

/**
 * 2FA-Pflicht (05.10.): muss diese Sitzung erst den zweiten Faktor einrichten? Nur nach `standGueltig` (der Stand ist dann
 * höchstens 15 s alt). Sitzungen, die VOR dem Einschalten der Pflicht ausgestellt wurden, laufen bis zu ihrem Ende weiter.
 */
export function zweiterFaktorOffen(s: Sitzung): boolean {
  const m = gemerkt.get(s.speicher);
  return !!m && m.zfOffen && s.ausgestellt >= m.zfAb;
}

/** Für Tests: den gemerkten Stand (und die Leerlauf-Uhr) vergessen. */
export function standVergessen(speicher?: string) {
  if (speicher) gemerkt.delete(speicher); else { gemerkt.clear(); aktiv.clear(); }
}
