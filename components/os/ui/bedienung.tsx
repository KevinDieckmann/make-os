'use client';

// ─── Standard · Bedienung je Gerät (10.10., DESIGN_STANDARD.md › Zeilen-Aktionen) ────────────────────────────────────────────
// Die Einstellungen aus Einstellungen › Bedienung (Regeln rein in lib/make-one/bedienung.ts): EIN Abo für alle Zeilen der Seite
// (`useSyncExternalStore` — der gemerkte Wert steht schon im ersten gemalten Bild, keine Liste springt). `BedienungAnwenden` hängt im
// /os-Rahmen und setzt die Merkmale am <html>, die das CSS liest (`data-za-mehr="immer"`, `data-dichte="kompakt"`) — so braucht keine
// Zeile für „⋯ immer sichtbar“ oder die Dichte eigenen Code.

import { useEffect, useSyncExternalStore } from 'react';
import { BEDIENUNG_EREIGNIS, BEDIENUNG_MERKER, BEDIENUNG_VORGABE, bedienungLesen, bedienungSaeubern, bedienungSchreiben, type Bedienung } from '@/lib/make-one/bedienung';

let stand: Bedienung | null = null;
const lesen = (): Bedienung => (stand ??= bedienungLesen());

function abonnieren(neu: () => void): () => void {
  // Eigene Änderung: `stand` ist schon gesetzt (auch wenn der Speicher gesperrt ist) — nur neu zeichnen. Anderer Tab: neu lesen.
  const ereignis = (e: StorageEvent) => { if (e.key === null || e.key === BEDIENUNG_MERKER) { stand = null; neu(); } };
  window.addEventListener(BEDIENUNG_EREIGNIS, neu);
  window.addEventListener('storage', ereignis);
  return () => { window.removeEventListener(BEDIENUNG_EREIGNIS, neu); window.removeEventListener('storage', ereignis); };
}

/** Die Einstellungen dieses Geräts (auf dem Server: die Vorgabe). */
export function useBedienung(): Bedienung {
  return useSyncExternalStore(abonnieren, lesen, () => BEDIENUNG_VORGABE as Bedienung);
}

/** Ändert Einstellungen dieses Geräts; alle offenen Zeilen lesen sofort neu. `false` = Speicher gesperrt (gilt bis zum Neuladen). */
export function bedienungAendern(teil: Partial<Bedienung>): boolean {
  const neu = bedienungSaeubern({ ...lesen(), ...teil });
  const ok = bedienungSchreiben(neu);
  stand = neu;
  try { window.dispatchEvent(new Event(BEDIENUNG_EREIGNIS)); } catch { /* egal */ }
  return ok;
}

/** Kurzes Vibrieren nach der Einstellung (nur wo der Browser es kann — iPhone-Safari kann es nicht, dann still). */
export function ruckeln(b: Pick<Bedienung, 'haptik'>, ms = 12): void {
  if (!b.haptik) return;
  try { (navigator as Navigator & { vibrate?: (p: number) => boolean }).vibrate?.(ms); } catch { /* egal */ }
}

/** Kann dieses Gerät vibrieren? (Für den Hinweis in den Einstellungen.) */
export function kannVibrieren(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function';
}

/** Setzt die Merkmale am <html> — einmal im /os-Rahmen. */
export function BedienungAnwenden() {
  const b = useBedienung();
  useEffect(() => {
    const el = document.documentElement;
    if (b.mehrImmer) el.dataset.zaMehr = 'immer'; else delete el.dataset.zaMehr;
    if (b.dichte === 'kompakt') el.dataset.dichte = 'kompakt'; else delete el.dataset.dichte;
  }, [b.mehrImmer, b.dichte]);
  return null;
}
