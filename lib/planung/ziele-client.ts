'use client';

// ─── MAKE OS — Ziele & Meilensteine im Browser lesen: EIN Zwischenspeicher (Review 03.10.) ─
// Vorher holten drei Bausteine dieselben Planungsdaten je mit eigenem Speicher (Ziel-Chip, Ziel-Bezug, Meilenstein-Verweis —
// einer davon ohne `r.ok`-Prüfung). Jetzt: EINE Ladung je 30 Sekunden für alle Chips einer Seite, nur lesend.
//   · Ziele aller Horizonte des gemeinsamen Bestands, je mit `horizont` und der Farbe vom Server (`farbe`,
//     lib/planung/ziel-farben-server.ts) — der Browser rechnet keine Ziel-Farbe selbst.
//   · Meilensteine (gemeinsamer Bestand).
// Fehler (offline, 401, 500) ergeben leere Listen — und werden nicht gemerkt, der nächste Aufruf versucht es neu.

import { useEffect, useState } from 'react';
import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZielHorizont } from './typen';

/** Ein Ziel, wie der Browser es liest: mit Horizont und der Farbe vom Server. */
export type ZielMitFarbe = Ziel & { horizont: ZielHorizont; farbe: string };
export interface ZieleUndMeilensteine { ziele: ZielMitFarbe[]; meilensteine: Meilenstein[] }

const MERKEN_MS = 30_000;
let ladung: { zeit: number; wert: Promise<ZieleUndMeilensteine> } | null = null;

const holeJson = (pfad: string): Promise<Record<string, unknown> | null> =>
  fetch(pfad, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);

/** Aus der Antwort von GET /api/state/ziele: alle Ziele mit Horizont (jedes nur einmal, nur mit Farbe vom Server). */
export function zieleAusAntwort(d: Record<string, unknown> | null): ZielMitFarbe[] {
  const aus: ZielMitFarbe[] = [];
  const gesehen = new Set<string>();
  for (const horizont of ZIEL_HORIZONTE) {
    const l = d?.[horizont];
    if (!Array.isArray(l)) continue;
    for (const z of l as Partial<ZielMitFarbe>[]) {
      if (!z || typeof z.id !== 'string' || typeof z.farbe !== 'string' || gesehen.has(z.id)) continue;
      gesehen.add(z.id);
      aus.push({ ...(z as Ziel), horizont, farbe: z.farbe });
    }
  }
  return aus;
}

/** Ziele und Meilensteine — einmal je halbe Minute für alle Bausteine der Seite (`neu` = frisch holen). */
export function zieleUndMeilensteineHolen(neu = false): Promise<ZieleUndMeilensteine> {
  if (!neu && ladung && Date.now() - ladung.zeit < MERKEN_MS) return ladung.wert;
  const wert = Promise.all([holeJson('/api/state/ziele'), holeJson('/api/state/meilensteine')]).then(([z, m]) => {
    if ((!z || !m) && ladung?.wert === wert) ladung = null; // ein Fehler wird nicht gemerkt
    return { ziele: zieleAusAntwort(z), meilensteine: Array.isArray(m?.meilensteine) ? (m!.meilensteine as Meilenstein[]) : [] };
  });
  ladung = { zeit: Date.now(), wert };
  return wert;
}

/** Hook: die Planungsdaten (null, solange sie laden). Mit `aktiv = false` wird nichts geladen. */
export function useZieleUndMeilensteine(aktiv = true): ZieleUndMeilensteine | null {
  const [daten, setDaten] = useState<ZieleUndMeilensteine | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    void zieleUndMeilensteineHolen().then(d => { if (lebt) setDaten(d); });
    return () => { lebt = false; };
  }, [aktiv]);
  return daten;
}
