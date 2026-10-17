'use client';

// ─── Standard · Reise + Fluss — Ziehen & Ablegen (17.10.; aus dem Prozess-Editor hierher gezogen, EINE Bedienung für alle Bereiche) ─────────────────
// Ohne Bibliothek, mit Pointer-Events (Vorbild: components/os/aufgaben/Ziehen.tsx):
//   · Maus und Trackpad: greifen und ziehen ab 5 px Bewegung — ein Klick ohne Bewegung wählt nur aus.
//   · Finger/Stift: LANGE DRÜCKEN (0,45 s, kaum bewegen), dann ziehen; wer vorher wischt, scrollt wie immer. Während des Ziehens scrollt die Seite nicht,
//     am Rand rollt sie mit. Escape bricht ab.
//   · Wohin sagt der Bereich (`zielBei` liest die Markierungen `data-ff-ziel` aus dem DOM, rechnet nichts); was nicht geht, sagt `pruefen` (Satz, rot) —
//     es wird nicht abgelegt. Die Regeln prüft der Schreibweg noch einmal.
// Genutzt vom Prozess-Editor (Fulfillment: Palette, Schritte, Phasen — components/os/fulfillment/editor/ziehen.tsx) und von Planung › Ziel (Meilensteine
// in der Reise umsortieren). Die Tastatur-Alternative legt jeder Bereich an das Element (Alt+Pfeile), am Handy zusätzlich ▲▼.

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, RAND, LEUCHT, BEDEUTUNG_FARBE, ECKE } from '@/lib/make-one/design';

/** Ab so vielen Pixeln Bewegung zieht die Maus (darunter ist es ein Klick). */
export const MAUS_AB_PX = 5;
/** So lange drückt der Finger, bevor er zieht. */
export const LANG_MS = 450;
const RUHIG_PX = 8;
const RAND_ROLLEN = 70;

export type ZiehLinie = 'oben' | 'unten' | 'links' | 'rechts';
export interface ZiehTreffer<Z> { ziel: Z; rect: DOMRect; linie?: ZiehLinie }

/**
 * Das Ziel unter dem Zeiger, wenn eine STUFE der Reise (Phasen-Pille, Meilenstein) umsortiert wird: die Pille trägt `data-ff-ziel="phase"`, `data-ff-id`,
 * `data-ff-titel` und `data-ff-vorher` (Kennung der Stufe davor, leer = erste). Linke Hälfte = davor (`nach` = die Stufe davor bzw. null), rechte = dahinter.
 */
export function stufenZielBei(x: number, y: number, quelleId: string): ZiehTreffer<{ nach: string | null; text: string }> | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const z = el?.closest<HTMLElement>('[data-ff-ziel="phase"]');
  if (!z) return null;
  const id = z.getAttribute('data-ff-id') ?? '';
  if (id === quelleId) return null;
  const rect = z.getBoundingClientRect();
  const titel = z.getAttribute('data-ff-titel') ?? '';
  const links = x < rect.left + rect.width / 2;
  const vorher = z.getAttribute('data-ff-vorher') || null;
  return { ziel: { nach: links ? vorher : id, text: links ? `vor „${titel}“` : `hinter „${titel}“` }, rect, linie: links ? 'links' : 'rechts' };
}

interface Zug<Q> { quelle: Q; x: number; y: number; zeiger: number; art: 'maus' | 'finger'; aktiv: boolean; timer?: ReturnType<typeof setTimeout>; el: HTMLElement }
interface Treffer<Z> extends ZiehTreffer<Z> { fehler: string | null }

/**
 * Ziehen in einer Reise bzw. einem Fluss: `griff(quelle)` auf das Ziehbare legen; `zielBei` findet das Ziel unter dem Zeiger, `pruefen` sagt, was nicht geht
 * (Satz), `ablegen` führt aus, `gleich` erkennt die gezogene Quelle wieder (halb durchsichtig, `data-ff-zieht`). `anzeige` gehört einmal in die Seite.
 */
export function useReiseZiehen<Q extends { titel: string }, Z extends { text: string }>({ zielBei, pruefen, ablegen, gleich, aus }: {
  zielBei: (x: number, y: number, q: Q) => ZiehTreffer<Z> | null;
  pruefen: (q: Q, z: Z) => string | null; ablegen: (q: Q, z: Z) => void; gleich: (a: Q, b: Q) => boolean; aus?: boolean;
}) {
  const zug = useRef<Zug<Q> | null>(null);
  const [zieht, setZieht] = useState<{ quelle: Q; x: number; y: number } | null>(null);
  const [treffer, setTreffer] = useState<Treffer<Z> | null>(null);
  const trefferRef = useRef<Treffer<Z> | null>(null);
  const schlucken = useRef(0);
  const pruefenRef = useRef(pruefen); pruefenRef.current = pruefen;
  const ablegenRef = useRef(ablegen); ablegenRef.current = ablegen;
  const zielBeiRef = useRef(zielBei); zielBeiRef.current = zielBei;
  const fensterZug = useRef<(() => void) | null>(null);

  const ende = useCallback((ablegenJa: boolean) => {
    const z = zug.current;
    zug.current = null;
    if (z?.timer) clearTimeout(z.timer);
    if (z?.aktiv) {
      schlucken.current = Date.now();
      const t = trefferRef.current;
      if (ablegenJa && t && !t.fehler) ablegenRef.current(z.quelle, t.ziel);
      try { z.el.releasePointerCapture(z.zeiger); } catch { /* schon frei */ }
    }
    trefferRef.current = null;
    setTreffer(null);
    setZieht(null);
  }, []);

  const bewegen = useCallback((x: number, y: number) => {
    const z = zug.current;
    if (!z?.aktiv) return;
    setZieht({ quelle: z.quelle, x, y });
    const t = zielBeiRef.current(x, y, z.quelle);
    const neu = t ? { ...t, fehler: pruefenRef.current(z.quelle, t.ziel) } : null;
    trefferRef.current = neu;
    setTreffer(neu);
    if (y < RAND_ROLLEN) window.scrollBy(0, -14);
    else if (y > window.innerHeight - RAND_ROLLEN) window.scrollBy(0, 14);
  }, []);

  useEffect(() => {
    const touch = (e: TouchEvent) => { if (zug.current?.aktiv && e.cancelable) e.preventDefault(); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && zug.current?.aktiv) { e.preventDefault(); ende(false); } };
    const klick = (e: MouseEvent) => { if (Date.now() - schlucken.current < 400) { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('touchmove', touch, { passive: false });
    document.addEventListener('keydown', taste);
    document.addEventListener('click', klick, true);
    return () => { document.removeEventListener('touchmove', touch); document.removeEventListener('keydown', taste); document.removeEventListener('click', klick, true); fensterZug.current?.(); };
  }, [ende]);

  const starten = useCallback((z: Zug<Q>) => {
    z.aktiv = true;
    try { z.el.setPointerCapture(z.zeiger); } catch { /* ältere Browser */ }
    if (z.art === 'finger') { try { navigator.vibrate?.(15); } catch { /* egal */ } }
    bewegen(z.x, z.y);
  }, [bewegen]);

  const zugBewegt = useCallback((e: PointerEvent) => {
    const z = zug.current;
    if (!z || e.pointerId !== z.zeiger) return;
    if (z.aktiv) { bewegen(e.clientX, e.clientY); return; }
    const weg = Math.hypot(e.clientX - z.x, e.clientY - z.y);
    if (z.art === 'maus' && weg >= MAUS_AB_PX) { starten(z); bewegen(e.clientX, e.clientY); return; }
    if (z.art === 'finger' && weg > RUHIG_PX) { if (z.timer) clearTimeout(z.timer); zug.current = null; fensterZug.current?.(); }
  }, [bewegen, starten]);
  const zugEnde = useCallback((e: PointerEvent) => {
    const z = zug.current;
    if (z && e.pointerId !== z.zeiger) return;
    fensterZug.current?.();
    if (z) ende(e.type === 'pointerup');
  }, [ende]);

  /** Props für ein ziehbares Element. */
  const griff = (quelle: Q) => ({
    'data-ff-zieht': zieht && gleich(zieht.quelle, quelle) ? 'ja' : undefined,
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (aus || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [data-nicht-ziehen]')) return;
      const z: Zug<Q> = { quelle, x: e.clientX, y: e.clientY, zeiger: e.pointerId, art: e.pointerType === 'mouse' ? 'maus' : 'finger', aktiv: false, el: e.currentTarget };
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
    onContextMenu: (e: { preventDefault: () => void }) => { if (zug.current) e.preventDefault(); },
  });

  const anzeige: ReactNode = zieht ? (
    <>
      {treffer && (
        <div aria-hidden style={{
          position: 'fixed', zIndex: 70, pointerEvents: 'none',
          ...(treffer.linie === 'oben' || treffer.linie === 'unten'
            ? { left: treffer.rect.left, width: treffer.rect.width, top: (treffer.linie === 'oben' ? treffer.rect.top : treffer.rect.bottom) - 2, height: 4, borderRadius: 2, background: treffer.fehler ? BEDEUTUNG_FARBE.kritisch : LEUCHT.gut }
            : treffer.linie === 'links' || treffer.linie === 'rechts'
              ? { top: treffer.rect.top, height: treffer.rect.height, left: (treffer.linie === 'links' ? treffer.rect.left : treffer.rect.right) - 2, width: 4, borderRadius: 2, background: treffer.fehler ? BEDEUTUNG_FARBE.kritisch : LEUCHT.gut }
              : { left: treffer.rect.left, top: treffer.rect.top, width: treffer.rect.width, height: treffer.rect.height, borderRadius: ECKE.eingabe, border: `2px solid ${treffer.fehler ? BEDEUTUNG_FARBE.kritisch : LEUCHT.gut}` }),
        }} />
      )}
      <div role="status" aria-live="polite" style={{
        position: 'fixed', zIndex: 71, pointerEvents: 'none', left: Math.min(zieht.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 800) - 280), top: zieht.y + 14, maxWidth: 260,
        padding: '6px 12px', borderRadius: 999, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, boxShadow: '0 12px 30px -10px rgba(0,0,0,.8)',
        fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: treffer?.fehler ? BEDEUTUNG_FARBE.kritisch : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {treffer?.fehler ? treffer.fehler : treffer ? `„${zieht.quelle.titel}“ ${treffer.ziel.text}` : `„${zieht.quelle.titel}“ ziehen …`}
      </div>
    </>
  ) : null;

  return { griff, anzeige, zieht: zieht?.quelle ?? null };
}
