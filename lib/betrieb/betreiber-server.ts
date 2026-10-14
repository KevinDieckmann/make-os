// ─── MAKE OS — Betreiber-Instanz lesen (Server, 14.10.) ──────────────────────────────────────────────────────────────────────
// Die Regel steht rein in lib/betrieb/betreiber.ts (`betreiberAus`); hier werden nur ihre Quellen gelesen: Demo-Riegel, MAKE_OS_BETREIBER,
// die DATEI der Neustart-Marke und der Anlege-Tag des Haupt-Inhabers. Lesen schreibt nie. Fehlt etwas oder ist es unlesbar: zählt nicht
// (eine unlesbare Marke gilt — wie in lib/onboarding-neustart.ts — als vorhanden).

import { promises as fs } from 'fs';
import path from 'path';
import { datenOrdner } from '@/lib/store/local-db';
import { NEUSTART_MARKE } from '@/lib/onboarding-neustart';
import { betreiberAus, altbestandAus } from './betreiber';

async function markeDa(): Promise<boolean> {
  try { await fs.stat(path.join(datenOrdner(), NEUSTART_MARKE)); return true; } catch (e) { return (e as NodeJS.ErrnoException)?.code !== 'ENOENT'; }
}

/** Ist diese Instanz die des Betreibers? `angelegt` (Haupt-Inhaber) darf mitgegeben werden, wenn die Konten schon geladen sind. */
export async function istBetreiberInstanz(o: { hauptInhaberAngelegt?: string | null } = {}): Promise<boolean> {
  const demo = process.env.MAKE_OS_DEMO === '1';
  if (demo) return false;
  let angelegt = o.hauptInhaberAngelegt;
  if (angelegt === undefined) {
    try {
      const { ladeKonten } = await import('@/lib/zugang/konten');
      const { hauptInhaber } = await import('@/lib/zugang/inhaber');
      angelegt = hauptInhaber(await ladeKonten())?.angelegt ?? null;
    } catch { angelegt = null; }
  }
  return betreiberAus({ demo, umgebung: process.env.MAKE_OS_BETREIBER, neustartMarke: await markeDa(), altbestand: altbestandAus(angelegt) });
}
