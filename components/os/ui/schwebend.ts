'use client';

// ─── Standard · Schwebendes weicht beim Lesen aus (Nachprüfung 18.10., N20) ──────────────────────────────────────────────────────────
// Die ZOE-Kugel und die Anwesenheits-Plakette („<Name> ist in …“) liegen fest in der Ecke unten rechts — beim Durchrollen einer Seite lagen
// sie über Knöpfen („In der Inbox öffnen“, am Handy „Entwurf öffnen“). Am Seitenende ist Platz für sie reserviert (Seite unten 72 px, am Handy
// `main` 150 px), mittendrin nicht. Jetzt: wer nach unten liest, dem gehen sie aus dem Weg; ein Stück nach oben, ganz oben oder am Ende
// (dort ist der Platz frei) sind sie wieder da. Mit Tastatur-Fokus bleiben sie sichtbar (CSS `.schwebend-weg:focus-within`, app/globals.css).
// Die Regel ist rein (`schwebendWeiter`), der Haken liest nur den Bildlauf des EINEN Seiten-Scrollers (`.os-shell main`).

import { useEffect, useState } from 'react';

/** Ab hier oben zählt die Seite als „ganz oben“ — dann immer sichtbar. */
export const SCHWEBEND_OBEN = 48;
/** So nah am Ende zählt die Seite als „am Ende“ — dort ist Platz reserviert, also sichtbar. */
export const SCHWEBEND_UNTEN = 24;
/** So weit (px) in eine Richtung, bevor sich etwas ändert — kleines Zittern des Fingers ändert nichts. */
export const SCHWEBEND_SCHWELLE = 24;
/** Ein Sprung dieser Größe zwischen zwei Bildern ist kein Lesen, sondern ein Sprung (Zurück stellt die Stelle wieder her, Anker) — sichtbar lassen. */
export const SCHWEBEND_SPRUNG = 600;

export interface SchwebendStand { weg: boolean; anker: number; letzt: number }
export const SCHWEBEND_START: SchwebendStand = { weg: false, anker: 0, letzt: 0 };

/** Der nächste Stand nach einem Bildlauf auf `y` (`rest` = Abstand zum Ende). Rein. */
export function schwebendWeiter(s: SchwebendStand, y: number, rest: number): SchwebendStand {
  if (y <= SCHWEBEND_OBEN || rest <= SCHWEBEND_UNTEN || Math.abs(y - s.letzt) >= SCHWEBEND_SPRUNG) return { weg: false, anker: y, letzt: y };
  // Richtungswechsel: ab dem Umkehrpunkt neu messen.
  const anker = (y - s.letzt) * (s.letzt - s.anker) < 0 ? s.letzt : s.anker;
  const d = y - anker;
  const weg = d > SCHWEBEND_SCHWELLE ? true : d < -SCHWEBEND_SCHWELLE ? false : s.weg;
  return { weg, anker, letzt: y };
}

/** Soll das Schwebende gerade ausweichen? Liest den Bildlauf des Seiten-Scrollers (`.os-shell main`); ohne ihn nie. */
export function useSchwebendWeicht(): boolean {
  const [weg, setWeg] = useState(false);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.os-shell main');
    if (!main) return;
    let s: SchwebendStand = { ...SCHWEBEND_START, anker: main.scrollTop, letzt: main.scrollTop };
    let bild = 0;
    const messen = () => {
      bild = 0;
      s = schwebendWeiter(s, main.scrollTop, main.scrollHeight - main.clientHeight - main.scrollTop);
      setWeg(alt => (alt === s.weg ? alt : s.weg));
    };
    const beimRollen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    main.addEventListener('scroll', beimRollen, { passive: true });
    return () => { main.removeEventListener('scroll', beimRollen); if (bild) cancelAnimationFrame(bild); };
  }, []);
  return weg;
}
