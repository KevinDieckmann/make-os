// ─── Planen — Blöcke lesen und anlegen (Server, 29.09., Paket K5) ────────────
// EINE Lesefunktion für alle Leser der Blöcke (Gesundheit, Business-Index, Risiko-Schilde, Loops, ZOE-Vorschlag,
// GET /api/planung/bloecke für Ritual/Energie/Tagesplan): Blöcke = iCloud-Termine der Art Fokus/Block
// (lib/planung/bloecke.ts), gelesen ohne Netz über `termineLesen` (K2), dazu die nicht übernommenen Blöcke des
// alten Wochenplans (Archiv, nur lesen — lib/planung/wochenplan-uebernahme-server.ts). Anlegen nur über
// lib/kalender/termin-server.ts (iCloud → kalender-bezug → Änderungsprotokoll).

import { termineLesen } from '@/lib/kalender/termine-lesen';
import { ladeEinstellungen, type Wer } from '@/lib/kalender/einstellungen';
import { terminAnlegenServer } from '@/lib/kalender/termin-server';
import { KalenderFehler } from '@/lib/kalender/icloud';
import { maskieren } from '@/lib/kalender/bezug';
import { bloeckeAus, blockAnfrage, gehoertZu, icsVonPlanArt, type BlockNeu, type PlanBlockSicht } from './bloecke';
import { archivFuer, altPersonen } from './wochenplan-uebernahme-server';
import type { Wer as ProtokollWer } from '@/lib/store/aenderungsprotokoll';

export interface BloeckeLesen {
  /** Nur Blöcke dieser Person (Speichername); ohne = alle (Systemsicht, z. B. Risiko-Schilde). */
  person?: string | null;
  /** Berliner Tage, bis exklusiv. */
  von: string; bis: string;
  /** Wer ansieht (Browser-Route): private Blöcke der anderen Person nur als „Belegt“ (K1 `maskieren`). Server-Leser ohne. */
  betrachter?: string | null;
  /** Archiv (nicht übernommene alte Blöcke) mitlesen — Standard ja. */
  archiv?: boolean;
  jetzt?: Date;
}

export async function planBloeckeLesen(o: BloeckeLesen): Promise<PlanBlockSicht[]> {
  const einst = await ladeEinstellungen();
  const g = await termineLesen(einst, o.von, o.bis);
  const termine = g.termine.filter(t => !o.person || gehoertZu(t, o.person));
  const ausKalender = bloeckeAus(o.betrachter !== undefined ? termine.map(t => maskieren(t, o.betrachter)) : termine);
  if (o.archiv === false) return ausKalender;
  const personen = o.person ? [o.person] : await altPersonen();
  const archiv: PlanBlockSicht[] = [];
  for (const p of personen) archiv.push(...(await archivFuer(p, o.von, o.bis, o.jetzt).catch(() => [])));
  return [...ausKalender, ...archiv].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}

/** Einen Block anlegen (ZOE `plan_block`, Kalender-Agent) — im Kalender der Person. */
export async function blockAnlegen(person: string, b: BlockNeu, wer: ProtokollWer): Promise<{ uid: string }> {
  // Regel 5: kein Rückfall auf „kevin“ — nur, wer einen eigenen Kalender in den Einstellungen hat.
  if (person !== 'kevin' && person !== 'malin') throw new KalenderFehler('Für diese Person gibt es keinen eigenen Kalender.', 400);
  const kalenderWer: Wer = person;
  const a = blockAnfrage(b, kalenderWer);
  const { art, blockArt } = icsVonPlanArt(b.art);
  const r = await terminAnlegenServer({
    titel: String(a.titel), start: String(a.start), ende: String(a.ende), wer: kalenderWer, art, ...(blockArt ? { blockArt } : {}), beschaeftigt: true, von: person,
    ...(b.taskId ? { bezug: { aufgabeId: b.taskId } } : {}),
  }, wer);
  return { uid: r.uid };
}
