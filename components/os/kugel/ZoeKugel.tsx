'use client';

// ─── MAKE OS — ZOE als Lichtkugel (05.10.2026, UMBAU_ABEND_0410.md 1) ────────
// Kevin: „Immer wenn wir mit ZOE sprechen: die Kugel als ihr Gesicht.“ Groß im Empfang (/zoe, wo vorher das SVG-Hirn
// stand), klein als Symbol unten im ZoePanel. KEINE Verwandlung in einen Weg (die gibt es nur auf der Homepage).
// Zustände wie im ZoeHirn — zuhören · denken · sprechen · ruhe — über Atem-Tempo und Farbgewicht (Smaragd kühl beim
// Zuhören, Granat warm beim Denken, weiter und heller beim Sprechen), nie über ein Effektfeuerwerk.
// Rückfall: ohne WebGL das bisherige ZoeHirn-SVG (groß) bzw. das ruhige Symbol (klein); „Bewegung reduzieren“ = Standbild.

import { useMemo, type ReactNode } from 'react';
import { Kugel } from './Kugel';
import { zoeParameter, type ZoeZustand } from './geometrie';
import { zoeWolke, ZOE_PUNKTE } from './wolke';
import { useHandy } from '../ui/medien';
import { FARBE, KUGEL, mischHex } from '@/lib/make-one/design';

/**
 * Die Töne der vier Zustände für Hof, Zustandszeile und Bedienung im Empfang — aus dem Kugel-Paar abgeleitet (keine
 * fremden Farben): ruht Smaragd · hört zu Smaragd hell (kühl) · denkt Granat (warm) · spricht Granat hell (weiter).
 */
export const ZOE_KUGEL_TON: Record<ZoeZustand, string> = {
  ruht: KUGEL.smaragd,
  hoert: mischHex(KUGEL.smaragd, FARBE.ink, 0.3),
  denkt: KUGEL.granat,
  spricht: mischHex(KUGEL.granat, FARBE.ink, 0.3),
};

export interface ZoeKugelProps {
  zustand: ZoeZustand;
  /** Lautstärke 0 … 1 (Mikrofon beim Zuhören, gerechnet beim Sprechen). */
  pegel?: number;
  /** Laufende Aufträge — der Atem wird etwas schneller, nie hektisch. */
  aktiv?: number;
  /** groß (Empfang) oder Symbol (ZoePanel). */
  groesse: 'gross' | 'symbol';
  /** Was ohne WebGL erscheint. */
  rueckfall: ReactNode;
}

export function ZoeKugel({ zustand, pegel = 0, aktiv = 0, groesse, rueckfall }: ZoeKugelProps) {
  const handy = useHandy();
  const n = groesse === 'symbol' ? ZOE_PUNKTE.symbol : handy ? ZOE_PUNKTE.handy : ZOE_PUNKTE.gross;
  const daten = useMemo(() => zoeWolke(n), [n]);
  // Pegel gerundet: der Empfang rendert ~20× je Sekunde — so bekommt der Motor nur echte Änderungen.
  const p = Math.round(pegel * 20) / 20;
  const ziel = useMemo(() => zoeParameter(zustand, p, aktiv), [zustand, p, aktiv]);
  return (
    <Kugel
      name={groesse === 'symbol' ? 'zoe-symbol' : 'zoe'}
      art={groesse}
      daten={daten}
      zustand={ziel}
      zeiger={groesse === 'gross'}
      // Am Handy weniger Bilder für die große Kugel: ruhiger Akku, kaum sichtbarer Unterschied.
      optionen={groesse === 'gross' && handy ? { fps: 40, punktPx: 1.5 } : undefined}
      rueckfall={rueckfall}
    />
  );
}
