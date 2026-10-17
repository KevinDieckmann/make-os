'use client';

// ─── Fulfillment · Prozess-Editor — Ziehen & Ablegen (17.10.) ─────────────────────────────────────────────────────────────────────────────
// Ohne Bibliothek, mit Pointer-Events (Vorbild: components/os/aufgaben/Ziehen.tsx):
//   · Maus und Trackpad: greifen und ziehen ab 5 px Bewegung — ein Klick ohne Bewegung wählt nur aus.
//   · Finger/Stift: LANGE DRÜCKEN (0,45 s, kaum bewegen), dann ziehen; wer vorher wischt, scrollt wie immer. Während des Ziehens scrollt die Seite nicht,
//     am Rand rollt sie mit. Escape bricht ab.
//   · Was gezogen wird: ein neuer Knoten aus der Palette, ein Schritt im Fluss, eine Phase in der Reise.
//   · Wohin (Markierung im DOM, `data-ff-ziel`): ein Schritt (obere Hälfte = davor, untere = dahinter), eine Gruppe (ans Ende), „nach der Gruppe“, der Start
//     (an den Anfang), das Ende der Phase, der freie Nein-Platz einer Entscheidung, eine Phasen-Pille (Phase: davor/dahinter; Schritt: ans Ende dieser Phase).
//   · Ungültiges zeigt sich rot mit Satz und wird nicht abgelegt — die Regeln prüft der Server noch einmal (lib/fulfillment/prozesse/editor.ts).
// Die Tastatur-Alternative steht am Knoten (Alt+Pfeile, Entf, Enter) und im Seitenfeld („Einfügen nach …“, „Verschieben nach …“).

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, RAND, LEUCHT, BEDEUTUNG_FARBE, ECKE } from '@/lib/make-one/design';
import type { KnotenForm } from '@/lib/fulfillment/typen';
import type { EditorZiel } from '@/lib/fulfillment/prozesse/editor';

/** Ab so vielen Pixeln Bewegung zieht die Maus (darunter ist es ein Klick). */
export const MAUS_AB_PX = 5;
/** So lange drückt der Finger, bevor er zieht. */
export const LANG_MS = 450;
const RUHIG_PX = 8;
const RAND_ROLLEN = 70;

export type ZiehQuelle =
  | { art: 'neu'; form: KnotenForm | 'baustein'; titel: string }
  | { art: 'schritt'; id: string; titel: string; phaseId: string }
  | { art: 'phase'; id: string; titel: string };
export type ZiehZiel =
  | { art: 'fluss'; ziel: EditorZiel; text: string }
  | { art: 'nein'; entscheidungId: string; text: string }
  | { art: 'phase'; nach: string | null; text: string }
  | { art: 'in-phase'; phaseId: string; text: string };

/** Das Ziel unter dem Zeiger — aus den Markierungen `data-ff-ziel` (rein aus dem DOM gelesen, keine Rechnung). */
function zielBei(x: number, y: number, q: ZiehQuelle): { ziel: ZiehZiel; rect: DOMRect; linie?: 'oben' | 'unten' | 'links' | 'rechts' } | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  const z = el?.closest<HTMLElement>('[data-ff-ziel]');
  if (!z) return null;
  const rect = z.getBoundingClientRect();
  const art = z.getAttribute('data-ff-ziel');
  const id = z.getAttribute('data-ff-id') ?? '';
  const phaseId = z.getAttribute('data-ff-phase') ?? '';
  const titel = z.getAttribute('data-ff-titel') ?? '';
  if (q.art === 'phase') {
    if (art !== 'phase' || id === q.id) return null;
    const links = x < rect.left + rect.width / 2;
    const vorher = z.getAttribute('data-ff-vorher') || null;
    return { ziel: { art: 'phase', nach: links ? vorher : id, text: links ? `vor „${titel}“` : `hinter „${titel}“` }, rect, linie: links ? 'links' : 'rechts' };
  }
  if (art === 'phase') return { ziel: { art: 'in-phase', phaseId: id, text: `ans Ende von „${titel}“` }, rect };
  if (art === 'schritt') {
    if (q.art === 'schritt' && id === q.id) return null;
    const oben = y < rect.top + rect.height / 2;
    return { ziel: { art: 'fluss', ziel: { phaseId, ...(oben ? { vor: id } : { nach: id }) }, text: oben ? `vor „${titel}“` : `hinter „${titel}“` }, rect, linie: oben ? 'oben' : 'unten' };
  }
  if (art === 'gruppe') return { ziel: { art: 'fluss', ziel: { phaseId, inGruppe: id }, text: `in „${titel}“` }, rect };
  if (art === 'nachgruppe') return { ziel: { art: 'fluss', ziel: { phaseId, nachGruppe: id }, text: `hinter „${titel}“` }, rect };
  if (art === 'anfang') return { ziel: { art: 'fluss', ziel: { phaseId, anfang: true }, text: 'an den Anfang' }, rect };
  if (art === 'ende') return { ziel: { art: 'fluss', ziel: { phaseId }, text: 'ans Ende der Phase' }, rect };
  if (art === 'nein') return { ziel: { art: 'nein', entscheidungId: id, text: `als Nein-Zweig von „${titel}“` }, rect };
  return null;
}

interface Zug { quelle: ZiehQuelle; x: number; y: number; zeiger: number; art: 'maus' | 'finger'; aktiv: boolean; timer?: ReturnType<typeof setTimeout>; el: HTMLElement }
interface Treffer { ziel: ZiehZiel; rect: DOMRect; linie?: 'oben' | 'unten' | 'links' | 'rechts'; fehler: string | null }

/** Ziehen im Editor: `griff(quelle)` auf das Ziehbare legen; `pruefen` sagt, was nicht geht (Satz), `ablegen` führt aus. */
export function useEditorZiehen({ pruefen, ablegen, aus }: { pruefen: (q: ZiehQuelle, z: ZiehZiel) => string | null; ablegen: (q: ZiehQuelle, z: ZiehZiel) => void; aus?: boolean }) {
  const zug = useRef<Zug | null>(null);
  const [zieht, setZieht] = useState<{ quelle: ZiehQuelle; x: number; y: number } | null>(null);
  const [treffer, setTreffer] = useState<Treffer | null>(null);
  const trefferRef = useRef<Treffer | null>(null);
  const schlucken = useRef(0);
  const pruefenRef = useRef(pruefen); pruefenRef.current = pruefen;
  const ablegenRef = useRef(ablegen); ablegenRef.current = ablegen;
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
    const t = zielBei(x, y, z.quelle);
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

  const starten = useCallback((z: Zug) => {
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
  const griff = (quelle: ZiehQuelle) => ({
    'data-ff-zieht': zieht && sameQuelle(zieht.quelle, quelle) ? 'ja' : undefined,
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (aus || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [data-nicht-ziehen]')) return;
      const z: Zug = { quelle, x: e.clientX, y: e.clientY, zeiger: e.pointerId, art: e.pointerType === 'mouse' ? 'maus' : 'finger', aktiv: false, el: e.currentTarget };
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

const sameQuelle = (a: ZiehQuelle, b: ZiehQuelle) => a.art === b.art && (a.art === 'neu' ? a.form === (b as typeof a).form : a.id === (b as { id: string }).id);
