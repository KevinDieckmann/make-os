'use client';

// ─── Mandat-Chip (28.09., Kevin: „Mandat an Zielen und Zeit“) ───────────────
// Ein Chip [Firma · Mandatstitel ▾] für Ziele, Meilensteine und Fokus-Blöcke —
// die Suche läuft über die aktiven Mandate (Firma, Titel, Einheit); das gerade
// gewählte bleibt sichtbar, auch wenn es nicht mehr aktiv ist. Die Mandate kommen
// als Kurzform aus /api/crm/mandat-wahl (einmal je Minute im Fenster gemerkt).
// Wer keinen Zugang zum CRM hat (nicht im Haushalt des Inhabers), sieht keinen Chip;
// ein schon gesetztes Mandat steht dann nur als Marke da.
// Seit 28.09. (Mandanten klickbar): neben dem gewählten Mandat ein „›“ in die Mandatsakte
// (Baustein components/os/crm/MandantLink.tsx), abschaltbar mit `ohneLink`.
// Firma und Einheit leitet der Server beim Speichern aus dem Mandat ab
// (lib/planung/mandat.ts `mitMandatBezug`); `setzen` bekommt das Mandat trotzdem
// mit, damit die Anzeige sofort stimmt.

import { useMemo } from 'react';
import { LEUCHT } from '@/lib/make-one/design';
import { mandatWahlListe, type MandatKurz } from '@/lib/planung/mandat';
import { Wahl } from '../crm/Wahl';
import { MandantLink } from '../crm/MandantLink';
import { Chip } from '../ui';
import { useMandate } from './useMandate';

// Der Abruf lebt in ./useMandate.ts (auch MandantLink braucht ihn) — hier weiter angeboten.
export { useMandate };

export function MandatWahl({ wert, setzen, klein, aus, leer = '+ Mandat', ohneLink }: {
  wert?: string;
  /** Neues Mandat (null = entfernen). */
  setzen: (m: MandatKurz | null) => void;
  klein?: boolean;
  aus?: boolean;
  leer?: string;
  /** Ohne „›“ zum Mandat neben dem Chip (z. B. beim Anlegen). */
  ohneLink?: boolean;
}) {
  const { mandate, zugang, geladen, karte } = useMandate();
  const liste = useMemo(() => mandatWahlListe(mandate, wert), [mandate, wert]);
  if (!geladen) return wert ? <Chip farbe={LEUCHT.business}>Mandat …</Chip> : null;
  if (!zugang) return wert ? <Chip farbe={LEUCHT.business}>Mandat</Chip> : null;
  if (!wert && !liste.length) return null;
  const wahl = (
    <Wahl<string> liste={liste} wert={wert} label="Mandat" leer={leer} klein={klein} aus={aus} farbe={LEUCHT.business} leerenLabel="ohne Mandat"
      onWahl={id => { const m = karte.get(id); if (m && id !== wert) setzen(m); }} onLeeren={() => setzen(null)} />
  );
  // Mandanten klickbar (28.09.): neben dem gewählten Wert ein „›“ in die Mandatsakte — nur, wenn es das Mandat noch gibt.
  if (!wert || ohneLink || !karte.has(wert)) return wahl;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}>
      {wahl}
      <MandantLink mandatId={wert} mandatDa klein farbe={LEUCHT.business}>
        <span style={{ padding: '2px 6px', fontSize: 14, lineHeight: 1 }}>›</span>
      </MandantLink>
    </span>
  );
}
