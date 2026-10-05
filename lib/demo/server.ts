// ─── MAKE OS — Demo-Instanz: Säen und Zurücksetzen (Server, 05.10.) ────────────────────────────────────────────────────
// Zwei Wege, beide mit den Riegeln aus lib/demo/schutz.ts:
//   demoSaenInLeerenOrdner   scripts/demo-saat.mjs — eigener Datenordner, leer, nie `.data`.
//   demoZuruecksetzen        Knopf „Demo zurücksetzen“ (System, nur Inhaber, Rückfrage; Route app/api/demo) — NUR mit
//                            `MAKE_OS_DEMO=1`, Demo-Marke und ausschließlich `@example.invalid`-Konten. Leert den Datenordner
//                            (bis auf den Such-Index, der sich selbst nachbaut) und sät neu. Hash/Salz der Konten bleiben, damit
//                            die Sitzung des Vorführenden gültig bleibt; alles andere kommt auf den Ausgangsstand.
// Alles in der Demo bleibt bearbeitbar und löschbar wie in jeder Instanz — es gibt keinen Sonderweg außer diesem Zurücksetzen.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { datenOrdner, loadJson, leseCacheLeeren, schreibpauseSetzen, schreibpauseAufheben } from '@/lib/store/local-db';
import { memoLeeren } from '@/lib/store/memo';
import { ladeKonten, type KontenStand } from '@/lib/zugang/konten';
import { localDay } from '@/lib/zeit';
import { DEMO_MARKE, BLEIBT_BEIM_ZURUECKSETZEN, istDemoInstanz, ordnerGruende, leerGruende, zuruecksetzenGruende, umgebungGruende, namenHinweise } from './schutz';
import { demoSaen, DemoFehler, type SaatBericht, type Zugang } from './saat';

export class DemoGesperrt extends Error { constructor(readonly gruende: string[]) { super(gruende.join(' ')); } }

const vaultImOrdner = (dir: string): string | null => {
  const v = process.env.MAKE_VAULT_DIR?.trim();
  return v && path.resolve(v).startsWith(path.resolve(dir) + path.sep) ? path.resolve(v) : null;
};

async function eintraege(dir: string): Promise<string[]> {
  try { return await fs.readdir(dir); } catch { return []; }
}

/** Säen in einen leeren, eigenen Ordner (Skript). Wirft `DemoGesperrt` mit Gründen. */
export async function demoSaenInLeerenOrdner(o: { passwort: string; heute?: string }): Promise<SaatBericht & { hinweise: string[] }> {
  const gruende = ordnerGruende({ env: process.env, cwd: process.cwd() });
  if (gruende.length) throw new DemoGesperrt(gruende);
  const dir = datenOrdner();
  const leer = leerGruende(await eintraege(dir));
  if (leer.length) throw new DemoGesperrt(leer);
  await fs.mkdir(dir, { recursive: true });
  const bericht = await demoSaen({ passwort: o.passwort, heute: o.heute ?? localDay(), vaultDir: vaultImOrdner(dir) });
  return { ...bericht, hinweise: [...umgebungGruende(process.env, dir), ...namenHinweise(process.env)] };
}

/** Zustand für die Oberfläche: Demo? Und darf zurückgesetzt werden (Gründe, falls nicht)? */
export async function demoLage(): Promise<{ demo: boolean; gruende: string[]; marke: unknown }> {
  if (!istDemoInstanz()) return { demo: false, gruende: ['Keine Demo-Instanz.'], marke: null };
  const dir = datenOrdner();
  const [marke, konten] = await Promise.all([loadJson(DEMO_MARKE).catch(() => null), ladeKonten().catch(() => null)]);
  const gruende = [
    ...ordnerGruende({ env: process.env, cwd: process.cwd() }),
    ...zuruecksetzenGruende({ marke, konten: konten?.konten ?? null }),
    ...umgebungGruende(process.env, dir),
  ];
  return { demo: true, gruende, marke };
}

/**
 * Zurücksetzen: Riegel prüfen, Datenordner leeren, neu säen. Wirft `DemoGesperrt`, wenn ein Riegel greift — dann wurde nichts
 * verändert. `person` = Inhaber der Demo (prüft die Route).
 */
export async function demoZuruecksetzen(person: string): Promise<SaatBericht> {
  const lage = await demoLage();
  if (!lage.demo || lage.gruende.length) throw new DemoGesperrt(lage.gruende);
  const dir = datenOrdner();
  const konten: KontenStand = await ladeKonten();
  if (!konten.konten.some(k => k.speicher === person && k.rolle === 'inhaber')) throw new DemoGesperrt(['Zurücksetzen darf nur der Inhaber der Demo.']);
  // Zugang behalten: dieselben Hash/Salz (Sitzung bleibt gültig), zweiter Faktor und Abmelde-Stand.
  const zugang: Record<string, Zugang> = {};
  for (const k of konten.konten) {
    zugang[k.speicher] = { hash: k.hash, salz: k.salz, ...(k.kdf ? { kdf: k.kdf } : {}), ...(k.zweiterFaktor ? { zweiterFaktor: k.zweiterFaktor } : {}), ...(k.sitzungenAb ? { sitzungenAb: k.sitzungenAb } : {}), ...(k.widerrufen ? { widerrufen: k.widerrufen } : {}) };
  }
  // Schreibpause: laufende Schreibungen zu Ende kommen lassen, dann leeren (unsere eigenen Schreibungen kommen erst danach).
  await schreibpauseSetzen(15_000, 10_000);
  try {
    for (const name of await eintraege(dir)) {
      if (BLEIBT_BEIM_ZURUECKSETZEN.test(name)) continue;
      await fs.rm(path.join(dir, name), { recursive: true, force: true });
    }
  } finally {
    schreibpauseAufheben();
    leseCacheLeeren();
    memoLeeren();
  }
  try {
    return await demoSaen({ zugang, heute: localDay(), vaultDir: vaultImOrdner(dir) });
  } catch (e) {
    throw e instanceof DemoFehler ? e : new DemoFehler(e instanceof Error ? e.message : 'Saat fehlgeschlagen.');
  }
}
