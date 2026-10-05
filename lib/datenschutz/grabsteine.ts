// ─── Grabsteine gelöschter Personen — außerhalb des Datenordners (29.09., Paket D-B #70) ─
// Problem: nach einer Löschung (Art. 17) holt jedes Zurückspielen einer älteren Sicherung die Person zurück — und die
// Sperrliste liegt IM Datenordner, wird also mit zurückgespielt und kennt sie dann auch nicht mehr.
// Lösung: je gelöschter Person ein Grabstein aus Fingerabdrücken (nie Klartext) in einem eigenen Ordner NEBEN den
// Daten — er wird nie mit dem Datenordner zurückgespielt, aber mit ins Offsite-Paket gesichert (deploy/sicherung.sh).
//
//   Ordner    MAKE_OS_GRABSTEINE_DIR (Server: eigenes Volume, siehe DEPLOY.md), sonst `<daten>-grabsteine` (neben dem
//             Datenordner, z. B. `.data-grabsteine` — je Datenordner eigener, damit Tests sich nie gegenseitig treffen)
//   Datei     grabsteine.json  { eintraege: [{ k, m[], v, am }] }   0600, atomar (tmp + fsync + rename)
//             k = Fingerabdruck der Kontakt-Kennung, m = Sperrlisten-Hashes der Merkmale (Adressen, HubSpot, Name+Firma),
//             v = Version (v2 HMAC mit Pepper, v1 ohne), am = Tag der Löschung
//   Anwenden  `grabsteineAnwenden()`: jede Person der Kartei, deren Kennung oder Merkmal auf einem Grabstein steht,
//             wird erneut über ALLE Speicher entfernt (`personEntfernen`), und die Merkmale kommen (wieder) auf die
//             Sperrliste. Wann: im Löschfristen-Lauf, sobald sich die Grabsteine seit dem letzten Anwenden geändert haben
//             (Marke `datenschutz-grabsteine` IM Datenordner — ein Restore bringt eine alte Marke mit, also läuft es nach
//             jedem Restore beim nächsten Takt von selbst) und ZWINGEND im Restore-Skript (deploy/wiederherstellen.sh →
//             POST /api/crm/datenschutz { aktion: 'grabsteine' }).
//   Frist     13 Monate (länger als jede Sicherung — die älteste Monatsgeneration ist bis zu 12 Monate alt; Wächter
//             tests/datenschutz-sicherungsfrist.test.ts; Löschklasse „grabsteine“) — danach fallen sie weg; die Sperrliste bleibt.

import { promises as fs } from 'fs';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import { hmacHex, kennungsVersion, shaHex, type KennungsVersion } from './pepper';
import { sperrHashes, sperrHashesAlle, sperrHashesAufnehmen } from '@/lib/crm/sperrliste';
import type { Kontakt } from '@/lib/make-one/crm';

export interface Grabstein { k: string; m: string[]; v: KennungsVersion; am: string }
interface GrabsteinDatei { eintraege: Grabstein[] }

export const GRABSTEIN_MARKE = 'datenschutz-grabsteine';
export interface GrabsteinMarke { stand?: string; am?: string; angewendet?: number }

export const grabsteinOrdner = () => {
  const env = process.env.MAKE_OS_GRABSTEINE_DIR?.trim();
  if (env) return env;
  // Tests (vitest): im Temp-Datenordner, damit jeder Testlauf seinen eigenen hat und nichts im Temp-Verzeichnis liegen bleibt.
  if (process.env.VITEST) return path.join(datenOrdner(), '.grabsteine-test');
  return `${datenOrdner().replace(/[\\/]+$/, '')}-grabsteine`;
};
const grabsteinDatei = () => path.join(grabsteinOrdner(), 'grabsteine.json');
/** Liegt der Ordner ausdrücklich konfiguriert (Server: eigenes Volume)? */
export const grabsteinOrdnerKonfiguriert = () => !!process.env.MAKE_OS_GRABSTEINE_DIR?.trim();

/** Fingerabdruck einer Kontakt-Kennung für den Grabstein (v2 mit Pepper, sonst v1). */
export function grabsteinKennung(id: string, v: KennungsVersion = kennungsVersion()): string | null {
  return v === 'v2' ? hmacHex('make-os-grabstein-v2', id) : shaHex(`make-os-grabstein-v1|${id}`);
}

/** Der Grabstein einer Person (rein). */
export function grabsteinFuer(id: string, person: Parameters<typeof sperrHashes>[0] | null | undefined, am: string): Grabstein {
  const v = kennungsVersion();
  return { k: grabsteinKennung(id, v) ?? '', m: person ? sperrHashes(person) : [], v, am: am.slice(0, 10) };
}

/** Trifft ein Grabstein diesen Kontakt (Kennung in jeder Version oder ein Merkmal)? Rein. */
export function grabsteinTrifft(g: readonly Grabstein[], k: Pick<Kontakt, 'id'> & Parameters<typeof sperrHashesAlle>[0]): Grabstein | null {
  if (!g.length) return null;
  const ks = new Set([grabsteinKennung(k.id, 'v2'), grabsteinKennung(k.id, 'v1')].filter((x): x is string => !!x));
  const ms = new Set(sperrHashesAlle(k));
  return g.find(x => ks.has(x.k) || x.m.some(h => ms.has(h))) ?? null;
}

const HEX = /^[0-9a-f]{64}$/;
function saeubern(roh: unknown): Grabstein[] {
  const l = (roh as GrabsteinDatei | null)?.eintraege;
  if (!Array.isArray(l)) return [];
  return l.flatMap(e => {
    const k = typeof e?.k === 'string' && HEX.test(e.k) ? e.k : '';
    const m = Array.isArray(e?.m) ? e.m.filter((x: unknown): x is string => typeof x === 'string' && HEX.test(x)) : [];
    if (!k && !m.length) return [];
    return [{ k, m, v: e?.v === 'v2' ? 'v2' as const : 'v1' as const, am: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.am)) ? String(e.am) : '' }];
  });
}

export async function grabsteineLesen(): Promise<Grabstein[]> {
  try { return saeubern(JSON.parse(await fs.readFile(grabsteinDatei(), 'utf8'))); }
  catch (e) { if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return []; throw e; }
}

/** Stand der Grabsteine (Fingerabdruck der Datei) — '' ohne Datei. */
export async function grabsteinStand(): Promise<string> {
  try { return createHash('sha256').update(await fs.readFile(grabsteinDatei())).digest('hex').slice(0, 16); }
  catch { return ''; }
}

let kette: Promise<unknown> = Promise.resolve();
/** Atomar schreiben: tmp im selben Ordner, fsync, rename, Ordner-fsync. Ein Schreiber je Prozess (Kette). */
async function schreiben(eintraege: Grabstein[]): Promise<void> {
  const ordner = grabsteinOrdner();
  await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
  const ziel = grabsteinDatei();
  const tmp = `${ziel}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  const h = await fs.open(tmp, 'w', 0o600);
  try { await h.writeFile(JSON.stringify({ eintraege })); await h.sync(); } finally { await h.close(); }
  await fs.rename(tmp, ziel);
  try { const d = await fs.open(ordner, 'r'); try { await d.sync(); } finally { await d.close(); } } catch { /* nicht jedes System kann Ordner syncen */ }
}
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  const p = kette.then(f, f);
  kette = p.catch(() => undefined);
  return p;
}

/** Grabstein setzen (idempotent: gleiche Kennung → Merkmale vereint). Wirft bei Schreibfehlern. */
export async function grabsteinSetzen(g: Grabstein): Promise<void> {
  if (!g.k && !g.m.length) return;
  await nacheinander(async () => {
    const alle = await grabsteineLesen();
    const i = alle.findIndex(x => (g.k && x.k === g.k) || x.m.some(h => g.m.includes(h)));
    if (i < 0) alle.push(g);
    else {
      const m = Array.from(new Set([...alle[i].m, ...g.m]));
      if (m.length === alle[i].m.length && (alle[i].k || !g.k)) return;
      alle[i] = { ...alle[i], k: alle[i].k || g.k, m };
    }
    await schreiben(alle);
  });
}

/** Grabsteine älter als `grenze` (Tag) entfernen — Löschklasse „grabsteine“. Liefert die Zahl. */
export async function grabsteineAufraeumen(grenze: string): Promise<number> {
  return nacheinander(async () => {
    const alle = await grabsteineLesen();
    const rest = alle.filter(g => !g.am || g.am >= grenze);
    if (rest.length !== alle.length) await schreiben(rest);
    return alle.length - rest.length;
  });
}

export interface GrabsteinLauf { grabsteine: number; entfernt: number; sperrliste: number; uebersprungen: boolean; stand: string }

/**
 * Grabsteine auf den Datenordner anwenden. Ohne `erzwingen` nur, wenn sich die Grabsteine seit dem letzten Anwenden
 * (Marke im Datenordner) geändert haben. Wirft, wenn die Grabsteine nicht lesbar sind — das Restore-Skript bricht dann ab.
 */
export async function grabsteineAnwenden(opt: { erzwingen?: boolean; jetzt?: Date } = {}): Promise<GrabsteinLauf> {
  const stand = await grabsteinStand();
  const marke = (await loadJson<GrabsteinMarke>(GRABSTEIN_MARKE)) ?? {};
  if (!opt.erzwingen && (marke.stand ?? '') === stand) return { grabsteine: 0, entfernt: 0, sperrliste: 0, uebersprungen: true, stand };
  const g = await grabsteineLesen();
  let entfernt = 0, sperrliste = 0;
  if (g.length) {
    const kontakte = (await loadJson<{ kontakte?: Kontakt[] }>('kontakte'))?.kontakte ?? [];
    const { personEntfernen } = await import('@/lib/crm/person-bestaende');
    for (const k of kontakte) {
      if (!grabsteinTrifft(g, k)) continue;
      const r = await personEntfernen(k.id, undefined, { grabstein: false });
      if (Object.keys(r.speicher).length) entfernt++;
    }
    const am = (opt.jetzt ?? new Date()).toISOString();
    for (const x of g) if (x.m.length) sperrliste += await sperrHashesAufnehmen(x.m, 'loeschung', x.am || am);
  }
  await updateJson<GrabsteinMarke>(GRABSTEIN_MARKE, () => ({ stand, am: (opt.jetzt ?? new Date()).toISOString(), angewendet: entfernt }));
  return { grabsteine: g.length, entfernt, sperrliste, uebersprungen: false, stand };
}

/** Für den Takt: sind die Grabsteine seit dem letzten Anwenden neu (oder nach einem Restore)? Wirft nie. */
export async function grabsteineOffen(): Promise<boolean> {
  try {
    const stand = await grabsteinStand();
    if (!stand) return false;
    return ((await loadJson<GrabsteinMarke>(GRABSTEIN_MARKE))?.stand ?? '') !== stand;
  } catch { return false; }
}
