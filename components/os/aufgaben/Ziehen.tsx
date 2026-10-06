'use client';
// ─── Ziehen & Ablegen im Aufgaben-Baum (06.10., Malins Bauplan-Karte) ───────────────────────────────
// Aufgaben zwischen Listen, Unteraufgaben zwischen Aufgaben, Reihenfolge in einer Liste. Ohne Bibliothek, mit Pointer-Events:
//   · Maus: Zeile greifen und ziehen (ab 6 px Bewegung — ein Klick öffnet weiter die Aufgabe).
//   · Handy/Stift: LANGE DRÜCKEN (0,45 s, kaum bewegen), dann ziehen. Wer vorher wischt/scrollt, scrollt bzw. wischt wie immer
//     (Archivieren/Löschen über `ZeileAktionen` bleibt unberührt). Während des Ziehens scrollt die Seite nicht, am Rand rollt sie mit.
//   · Ziel: obere Viertel einer Zeile = davor, untere = dahinter, Mitte = hinein (Unteraufgabe); Listenkopf und „+ Neue Aufgabe“ =
//     ans Ende der Liste. Ungültiges (Kreis, zu tief, anderer Space) zeigt sich rot und wird nicht abgelegt — die Regel steht rein
//     in lib/aufgaben/ziehen.ts, der Server prüft noch einmal.
//   · Escape bricht ab. Tastatur-Alternative: Menü „…“ › „Verschieben nach …“.
// Markierung im DOM: Zeilen tragen `data-ziel-aufgabe`, Listenköpfe/Felder `data-ziel-liste` + `data-ziel-projekt`.

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, RAND, LEUCHT, BEDEUTUNG_FARBE, ECKE } from '@/lib/make-one/design';
import type { Ablage } from '@/lib/aufgaben/ziehen';

const LANG_MS = 450;
const RUHIG_PX = 8;
const MAUS_AB_PX = 6;
const RAND_ROLLEN = 70;

interface Zug { id: string; titel: string; x: number; y: number; zeiger: number; art: 'maus' | 'finger'; aktiv: boolean; timer?: ReturnType<typeof setTimeout>; el: HTMLElement }
interface Ziel { ablage: Ablage; rect: DOMRect; fehler: string | null }

/** Ziel unter dem Zeiger: Zeile (vor/in/nach) oder Liste (ans Ende). */
function zielBei(x: number, y: number, quelle: string): { ablage: Ablage; rect: DOMRect } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const z = el?.closest<HTMLElement>('[data-ziel-aufgabe], [data-ziel-liste]');
  if (!z) return null;
  const rect = z.getBoundingClientRect();
  const aufgabe = z.getAttribute('data-ziel-aufgabe');
  if (aufgabe) {
    if (aufgabe === quelle) return null;
    const anteil = (y - rect.top) / Math.max(1, rect.height);
    return { ablage: { art: anteil < 0.28 ? 'vor' : anteil > 0.72 ? 'nach' : 'in', zielId: aufgabe }, rect };
  }
  const projektId = z.getAttribute('data-ziel-projekt');
  if (!projektId) return null;
  const liste = z.getAttribute('data-ziel-liste');
  return { ablage: { art: 'liste', projektId, listeId: liste ? liste : null }, rect };
}

export function useZiehen({ pruefen, ablegen }: { pruefen: (quelle: string, ablage: Ablage) => string | null; ablegen: (quelle: string, ablage: Ablage) => void }) {
  const zug = useRef<Zug | null>(null);
  const [zieht, setZieht] = useState<{ id: string; titel: string; x: number; y: number } | null>(null);
  const [ziel, setZiel] = useState<Ziel | null>(null);
  const zielRef = useRef<Ziel | null>(null);
  const schlucken = useRef(0);
  const pruefenRef = useRef(pruefen); pruefenRef.current = pruefen;
  const ablegenRef = useRef(ablegen); ablegenRef.current = ablegen;

  const ende = useCallback((ablegenJa: boolean) => {
    const z = zug.current;
    zug.current = null;
    if (z?.timer) clearTimeout(z.timer);
    if (z?.aktiv) {
      schlucken.current = Date.now();
      const t = zielRef.current;
      if (ablegenJa && t && !t.fehler) ablegenRef.current(z.id, t.ablage);
      try { z.el.releasePointerCapture(z.zeiger); } catch { /* schon frei */ }
    }
    zielRef.current = null;
    setZiel(null);
    setZieht(null);
  }, []);

  const bewegen = useCallback((x: number, y: number) => {
    const z = zug.current;
    if (!z?.aktiv) return;
    setZieht({ id: z.id, titel: z.titel, x, y });
    const t = zielBei(x, y, z.id);
    const neu = t ? { ...t, fehler: pruefenRef.current(z.id, t.ablage) } : null;
    zielRef.current = neu;
    setZiel(neu);
    if (y < RAND_ROLLEN) window.scrollBy(0, -14);
    else if (y > window.innerHeight - RAND_ROLLEN) window.scrollBy(0, 14);
  }, []);

  // Während des Ziehens: nicht scrollen (Finger), Escape bricht ab, der Klick nach dem Ablegen öffnet nichts.
  useEffect(() => {
    const touch = (e: TouchEvent) => { if (zug.current?.aktiv && e.cancelable) e.preventDefault(); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && zug.current?.aktiv) { e.preventDefault(); ende(false); } };
    const klick = (e: MouseEvent) => { if (Date.now() - schlucken.current < 400) { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('touchmove', touch, { passive: false });
    document.addEventListener('keydown', taste);
    document.addEventListener('click', klick, true);
    return () => { document.removeEventListener('touchmove', touch); document.removeEventListener('keydown', taste); document.removeEventListener('click', klick, true); };
  }, [ende]);

  function starten(z: Zug) {
    z.aktiv = true;
    try { z.el.setPointerCapture(z.zeiger); } catch { /* ältere Browser */ }
    if (z.art === 'finger') { try { navigator.vibrate?.(15); } catch { /* egal */ } }
    bewegen(z.x, z.y);
  }

  /** Bewegung/Loslassen — am Fenster in der Capture-Phase (06.10.): ein schneller Zug verlässt die Zeile, bevor sie die erste
   *  Bewegung sieht, und die Zeile hält die Ereignisse vom Wischen fern (stopPropagation) — das Fenster hört sie vorher. */
  const fensterZug = useRef<(() => void) | null>(null);
  const zugBewegt = useCallback((e: PointerEvent) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.zeiger) return;
    if (z.aktiv) { bewegen(e.clientX, e.clientY); return; }
    const weg = Math.hypot(e.clientX - z.x, e.clientY - z.y);
    if (z.art === 'maus' && weg >= MAUS_AB_PX) { starten(z); bewegen(e.clientX, e.clientY); return; }
    // Finger bewegt sich vor dem langen Druck: scrollen/wischen — kein Ziehen.
    if (z.art === 'finger' && weg > RUHIG_PX) { if (z.timer) clearTimeout(z.timer); zug.current = null; fensterZug.current?.(); }
  }, [bewegen]); // eslint-disable-line react-hooks/exhaustive-deps
  const zugEnde = useCallback((e: PointerEvent) => {
    const z = zug.current;
    if (z && e.pointerId !== z.zeiger) return;
    fensterZug.current?.();
    if (z) ende(e.type === 'pointerup');
  }, [ende]);
  useEffect(() => () => fensterZug.current?.(), []);

  /** Props für eine ziehbare Zeile. */
  const griff = (id: string, titel: string) => ({
    'data-ziel-aufgabe': id,
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const ziel = e.target as HTMLElement;
      if (ziel.closest('input, textarea, select, [data-nicht-ziehen]')) return;
      const z: Zug = { id, titel, x: e.clientX, y: e.clientY, zeiger: e.pointerId, art: e.pointerType === 'mouse' ? 'maus' : 'finger', aktiv: false, el: e.currentTarget };
      zug.current = z;
      fensterZug.current?.();
      window.addEventListener('pointermove', zugBewegt, true);
      window.addEventListener('pointerup', zugEnde, true);
      window.addEventListener('pointercancel', zugEnde, true);
      fensterZug.current = () => {
        window.removeEventListener('pointermove', zugBewegt, true);
        window.removeEventListener('pointerup', zugEnde, true);
        window.removeEventListener('pointercancel', zugEnde, true);
        fensterZug.current = null;
      };
      if (z.art === 'finger') z.timer = setTimeout(() => { if (zug.current === z) starten(z); }, LANG_MS);
    },
    // Während des Ziehens sieht das Wischen (`ZeileAktionen`, Eltern-Element) die Bewegung nicht.
    onPointerMove: (e: RPointerEvent<HTMLElement>) => { if (zug.current?.aktiv) e.stopPropagation(); },
    onPointerUp: (e: RPointerEvent<HTMLElement>) => { if (zug.current?.aktiv) e.stopPropagation(); },
    onContextMenu: (e: { preventDefault: () => void }) => { if (zug.current) e.preventDefault(); },
  });

  const anzeige: ReactNode = zieht ? (
    <>
      {ziel && (
        <div aria-hidden style={{
          position: 'fixed', zIndex: 70, pointerEvents: 'none', left: ziel.rect.left, width: ziel.rect.width,
          ...(ziel.ablage.art === 'vor' ? { top: ziel.rect.top - 2, height: 4, borderRadius: 2 } : ziel.ablage.art === 'nach' ? { top: ziel.rect.bottom - 2, height: 4, borderRadius: 2 } : { top: ziel.rect.top, height: ziel.rect.height, borderRadius: ECKE.eingabe }),
          ...(ziel.ablage.art === 'vor' || ziel.ablage.art === 'nach'
            ? { background: ziel.fehler ? BEDEUTUNG_FARBE.kritisch : LEUCHT.gut }
            : { border: `2px solid ${ziel.fehler ? BEDEUTUNG_FARBE.kritisch : LEUCHT.gut}`, background: ziel.fehler ? 'rgba(255,92,92,.08)' : 'rgba(61,226,139,.08)' }),
        }} />
      )}
      <div role="status" aria-live="polite" style={{
        position: 'fixed', zIndex: 71, pointerEvents: 'none', left: Math.min(zieht.x + 14, window.innerWidth - 260), top: zieht.y + 14, maxWidth: 240,
        padding: '6px 12px', borderRadius: 999, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, boxShadow: '0 12px 30px -10px rgba(0,0,0,.8)',
        fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: ziel?.fehler ? BEDEUTUNG_FARBE.kritisch : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {ziel?.fehler ? ziel.fehler : ziel ? (ziel.ablage.art === 'in' ? `„${zieht.titel}“ als Unteraufgabe` : ziel.ablage.art === 'liste' ? `„${zieht.titel}“ ans Ende der Liste` : `„${zieht.titel}“ ${ziel.ablage.art === 'vor' ? 'davor' : 'dahinter'}`) : `„${zieht.titel}“ ziehen …`}
      </div>
    </>
  ) : null;

  return { griff, anzeige, zieht: zieht?.id ?? null };
}
