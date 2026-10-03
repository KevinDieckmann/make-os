'use client';

// ─── Netzwerken — Bausteine für Daumen und kleine Bildschirme (02.10.) ───────
// Alles hier ist für das iPhone gebaut: Ziele mindestens 48 px hoch, Eingabefelder mit 16 px Schrift (kleiner zoomt iOS
// beim Antippen die Seite auf), Knöpfe über die ganze Breite. Farben und Schrift aus lib/make-one/design.ts.

import { useCallback, useSyncExternalStore, type CSSProperties } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eingabe, Gross, Wahl, Beschriftung, Feldzeile, Hinweis, Initialen, Schritte, Aktionsleiste, Leerzustand } from '../ui';

// Die Bausteine wohnen seit 03.10. im Standard (components/os/ui, DESIGN_STANDARD.md) — hier nur noch die Namen für die Netzwerken-Dateien
// und das, was nur Netzwerken braucht (gemerkter Wert, Tagtext, Verknüpfungs-Chips).
export const ZIEL = 48;
export { eingabe, Gross, Wahl, Beschriftung, Feldzeile, Hinweis, Initialen, Aktionsleiste, Leerzustand };
export { Schritte as Fortschritt };

// ── Gemerkter Wert (localStorage nur als Komfort) ────────────────────────────
// `useSyncExternalStore` statt „erst leer rendern, dann im Effekt laden“: der gemerkte Wert steht schon im ersten gemalten Bild — der Kopf „Heute bei“ sprang vorher
// von der leeren Karte zur gefüllten (Layout-Sprung). Ohne Speicher (privates Fenster, gesperrt) hält ein Arbeitsspeicher-Ersatz den Wert für diese Sitzung.
const GEMERKT_HOERER = new Set<() => void>();
const GEMERKT_ZWISCHEN = new Map<string, { roh: string | null; wert: unknown }>();
const GEMERKT_ERSATZ = new Map<string, unknown>();
function gemerktLesen(schluessel: string): unknown {
  let roh: string | null = null;
  try { roh = window.localStorage.getItem(schluessel); } catch { /* ohne Speicher */ }
  if (roh === null) return GEMERKT_ERSATZ.get(schluessel);
  const z = GEMERKT_ZWISCHEN.get(schluessel);
  if (z && z.roh === roh) return z.wert;   // gleicher Text → derselbe Wert (stabile Kennung für React)
  let wert: unknown;
  try { wert = JSON.parse(roh); } catch { wert = undefined; }
  GEMERKT_ZWISCHEN.set(schluessel, { roh, wert });
  return wert;
}
const gemerktAbonnieren = (f: () => void): (() => void) => {
  GEMERKT_HOERER.add(f);
  if (typeof window !== 'undefined') window.addEventListener('storage', f);
  return () => { GEMERKT_HOERER.delete(f); if (typeof window !== 'undefined') window.removeEventListener('storage', f); };
};

/** Wert im Browser merken (localStorage nur als Komfort — fehlt es oder wirft es, läuft alles ohne). */
export function useGemerkt<T>(schluessel: string, start: T): [T, (v: T) => void] {
  const gelesen = useSyncExternalStore(gemerktAbonnieren, () => gemerktLesen(schluessel), () => undefined);
  const setze = useCallback((v: T) => {
    try { window.localStorage.setItem(schluessel, JSON.stringify(v)); GEMERKT_ERSATZ.delete(schluessel); } catch { GEMERKT_ERSATZ.set(schluessel, v); }
    for (const f of Array.from(GEMERKT_HOERER)) f();
  }, [schluessel]);
  return [gelesen === undefined ? start : (gelesen as T), setze];
}

export const kopfStil: CSSProperties = { fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: 0, color: C.ink };

/** „Fr 02.10.“ aus einem Tag. */
export const tagText = (tag: string): string => `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

export interface LinkChip { label: string; href: string }
/** Eine Zeile kleiner Verknüpfungen (Kontakt · Termin · Deal · Follow-up · Event) — Chips mit Ziel ≥ 44 px, leer = nichts. */
export function LinkChips({ links }: { links: readonly LinkChip[] }) {
  if (!links.length) return null;
  return (
    <ul aria-label="Verknüpfungen" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
      {links.map(l => (
        <li key={`${l.label}|${l.href}`}>
          <Link href={l.href} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 999, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, color: C.ink, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)' }}>{l.label} ›</Link>
        </li>
      ))}
    </ul>
  );
}
