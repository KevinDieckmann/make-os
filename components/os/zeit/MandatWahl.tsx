'use client';

// ─── Mandat-Chip (28.09., Kevin: „Mandat an Zielen und Zeit“) ───────────────
// Ein Chip [Firma · Mandatstitel ▾] für Ziele, Meilensteine und Fokus-Blöcke —
// die Suche läuft über die aktiven Mandate (Firma, Titel, Einheit); das gerade
// gewählte bleibt sichtbar, auch wenn es nicht mehr aktiv ist. Die Mandate kommen
// als Kurzform aus /api/crm/mandat-wahl (einmal je Minute im Fenster gemerkt).
// Wer keinen Zugang zum CRM hat (nicht im Haushalt des Inhabers), sieht keinen Chip;
// ein schon gesetztes Mandat steht dann nur als Marke da.
// Firma und Einheit leitet der Server beim Speichern aus dem Mandat ab
// (lib/planung/mandat.ts `mitMandatBezug`); `setzen` bekommt das Mandat trotzdem
// mit, damit die Anzeige sofort stimmt.

import { useEffect, useMemo, useState } from 'react';
import { LEUCHT } from '@/lib/make-one/design';
import { mandatWahlListe, type MandatKurz } from '@/lib/planung/mandat';
import { Wahl } from '../crm/Wahl';
import { Chip } from '../schlank';

interface MandateStand { mandate: MandatKurz[]; zugang: boolean }
const HALTBAR_MS = 60_000;
let zwischen: { t: number; w: MandateStand } | null = null;
let unterwegs: Promise<MandateStand> | null = null;

function holen(): Promise<MandateStand> {
  if (zwischen && Date.now() - zwischen.t < HALTBAR_MS) return Promise.resolve(zwischen.w);
  unterwegs ??= fetch('/api/crm/mandat-wahl', { cache: 'no-store' })
    .then(async r => {
      const d = (await r.json().catch(() => null)) as { ok?: boolean; mandate?: MandatKurz[] } | null;
      const w: MandateStand = { mandate: d?.ok && Array.isArray(d.mandate) ? d.mandate : [], zugang: r.ok && !!d?.ok };
      zwischen = { t: Date.now(), w };
      return w;
    })
    .catch(() => ({ mandate: [], zugang: false }))
    .finally(() => { unterwegs = null; });
  return unterwegs;
}

/** Die Mandate als Kurzform (und ob es Zugang gibt) — geteilt von allen Chips im Fenster. */
export function useMandate(): MandateStand & { geladen: boolean; karte: ReadonlyMap<string, MandatKurz> } {
  const [w, setW] = useState<MandateStand | null>(zwischen?.w ?? null);
  useEffect(() => { let aktiv = true; void holen().then(x => { if (aktiv) setW(x); }); return () => { aktiv = false; }; }, []);
  const karte = useMemo(() => new Map((w?.mandate ?? []).map(m => [m.id, m])), [w]);
  return { mandate: w?.mandate ?? [], zugang: w?.zugang ?? false, geladen: !!w, karte };
}

export function MandatWahl({ wert, setzen, klein, aus, leer = '+ Mandat' }: {
  wert?: string;
  /** Neues Mandat (null = entfernen). */
  setzen: (m: MandatKurz | null) => void;
  klein?: boolean;
  aus?: boolean;
  leer?: string;
}) {
  const { mandate, zugang, geladen, karte } = useMandate();
  const liste = useMemo(() => mandatWahlListe(mandate, wert), [mandate, wert]);
  if (!geladen) return wert ? <Chip farbe={LEUCHT.business}>Mandat …</Chip> : null;
  if (!zugang) return wert ? <Chip farbe={LEUCHT.business}>Mandat</Chip> : null;
  if (!wert && !liste.length) return null;
  return (
    <Wahl<string> liste={liste} wert={wert} label="Mandat" leer={leer} klein={klein} aus={aus} farbe={LEUCHT.business} leerenLabel="ohne Mandat"
      onWahl={id => { const m = karte.get(id); if (m && id !== wert) setzen(m); }} onLeeren={() => setzen(null)} />
  );
}
