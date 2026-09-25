'use client';

// ─── MAKE OS — Sauber zurück, überall (25.09.) ──────────────────────────────
// Kevin: „alle Funktionen grundsätzlich miteinander verbinden, dass wir
// überall sauber zurückkommen.“ Die Prüfung vom 25.09. fand drei Muster, die
// das verhinderten: Wechsel überschrieben den Verlaufseintrag (Zurück sprang
// aus dem ganzen Bereich), eigene Zurück-Knöpfe legten einen doppelten Eintrag
// an (der nächste Browser-Schritt wirkte tot), und nach dem Zurück stand die
// Seite oben statt dort, wo man war.
// Dieser Baustein ist die eine Regel für alle Seiten:
//   · Jeder Verlaufseintrag trägt seine Tiefe in der App (Browser-„state“).
//     Ein Zurück-Knopf geht einen echten Schritt zurück, wenn es innerhalb
//     der App einen gibt — sonst (direkt über einen Link gekommen) zur
//     übergeordneten Seite, die der Knopf nennt.
//   · Die Scrollposition im Inhaltsbereich (<main>) wird je Eintrag gemerkt
//     und beim Zurück/Vor wiederhergestellt.
// Regel für neue Oberflächen: Ort wechseln (Bereich, Reiter, etwas öffnen)
// = router.push; nur Gleichrangiges austauschen (in einer Liste die nächste
// Person) = router.replace. Zurück-Knöpfe nehmen useZurueck().

import { useCallback, useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';

const FELD = '__makeOs';
interface Stand { tiefe: number; id: string }
const neueId = () => Math.random().toString(36).slice(2, 10);
const positionen = new Map<string, number>();
let installiert = false;

/** Stand des aktuellen Verlaufseintrags — ohne Eintrag (erster Aufruf): Tiefe 0. */
export function verlaufStand(): Stand {
  if (typeof window === 'undefined') return { tiefe: 0, id: 'start' };
  const s = (window.history.state as Record<string, unknown> | null)?.[FELD] as Stand | undefined;
  return s && typeof s.tiefe === 'number' && typeof s.id === 'string' ? s : { tiefe: 0, id: 'start' };
}

const inhalt = () => document.querySelector('main');
/**
 * Die zuletzt GESCROLLTE Position — nicht die aktuelle: Eine neue Seite setzt
 * den Inhalt oft schon auf „oben“, einen Moment bevor Next den neuen
 * Verlaufseintrag anlegt. Mit scrollTop würde dann „oben“ für die alte Seite
 * gemerkt. Scroll-Ereignisse kommen erst danach — der Wert hier ist also
 * immer der der Seite, die man gerade verlässt.
 */
let zuletzt = 0;
/** Bis hierhin zählt Scrollen nicht als Position der Seite (die App springt selbst nach oben). */
let ruheBis = 0;

/**
 * Den Inhalt nach oben setzen, wenn ein neuer Ort beginnt — über diesen
 * Baustein, damit der Sprung nicht als Position der Seite gilt, die man
 * gerade verlässt (sonst käme man mit Zurück oben an statt an der alten Stelle).
 */
export function nachOben() {
  ruheBis = Date.now() + 700;
  inhalt()?.scrollTo({ top: 0 });
}

function merken() {
  positionen.set(verlaufStand().id, zuletzt);
}

function wiederherstellen() {
  const ziel = positionen.get(verlaufStand().id);
  if (ziel === undefined) return;
  // Der Inhalt baut sich nach dem Zurück erst auf — mehrmals versuchen, bis die Höhe reicht.
  zuletzt = ziel;
  for (const ms of [0, 60, 200, 450, 900]) setTimeout(() => { const m = inhalt(); if (m && Math.abs(m.scrollTop - ziel) > 2) m.scrollTop = ziel; }, ms);
}

function installieren() {
  if (installiert || typeof window === 'undefined') return;
  installiert = true;
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  // Der erste Eintrag bekommt seinen Stand, ohne die Daten von Next zu verlieren.
  if (!(window.history.state as Record<string, unknown> | null)?.[FELD]) replace({ ...((window.history.state as object | null) ?? {}), [FELD]: { tiefe: 0, id: neueId() } }, '');
  window.history.pushState = (state: unknown, unused: string, url?: string | URL | null) => {
    merken();
    const s: Stand = { tiefe: verlaufStand().tiefe + 1, id: neueId() };
    push({ ...((state as object | null) ?? {}), [FELD]: s }, unused, url);
  };
  window.history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    const eigener = (state as Record<string, unknown> | null)?.[FELD];
    replace({ ...((state as object | null) ?? {}), [FELD]: eigener ?? verlaufStand() }, unused, url);
  };
  window.addEventListener('popstate', wiederherstellen);
  // Laufend mitschreiben, damit auch „Vor“ an die richtige Stelle springt.
  let geplant = false;
  document.addEventListener('scroll', e => {
    if (geplant || e.target !== inhalt()) return;
    geplant = true;
    requestAnimationFrame(() => { geplant = false; if (Date.now() < ruheBis) return; zuletzt = inhalt()?.scrollTop ?? 0; merken(); });
  }, { capture: true, passive: true });
}

/** Einmal im Wurzel-Layout: richtet die Verlaufs-Regel ein. */
export function VerlaufWaechter() {
  useEffect(() => { installieren(); }, []);
  return null;
}

/**
 * Zurück wie der Browser — aber nie aus der App hinaus: Gibt es davor einen
 * Eintrag in der App, geht es dorthin; sonst zu `ersatz` (die übergeordnete Seite).
 */
export function useZurueck() {
  const router = useRouter();
  return useCallback((ersatz: string) => {
    if (verlaufStand().tiefe > 0) router.back();
    else router.push(ersatz);
  }, [router]);
}

/** Der Zurück-Knopf für alle Seiten: ein echter Schritt zurück, sonst zu `ersatz`. */
export function ZurueckKnopf({ ersatz, children = 'Zurück', onClick }: { ersatz: string; children?: ReactNode; onClick?: () => void }) {
  const zurueck = useZurueck();
  return (
    <button onClick={() => (onClick ? onClick() : zurueck(ersatz))} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 11px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700 }}>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>‹</span> {children}
    </button>
  );
}

/**
 * Was in einer Liste offen ist, steht im Link (Standard: k) — so schließt
 * Zurück ein Detail wieder, statt die Seite zu verlassen, und ein geteilter
 * Link zeigt dasselbe. Das erste Öffnen ist ein neuer Verlaufseintrag, jedes
 * weitere tauscht nur (sonst bräuchte es zehnmal Zurück nach zehn Klicks),
 * Schließen ersetzt.
 */
export function useLinkAuswahl(param = 'k'): [string | null, (id: string | null) => void] {
  const router = useRouter();
  const params = useSearchParams();
  const pfad = usePathname() ?? '';
  const wert = params.get(param);
  const setze = useCallback((id: string | null) => {
    if ((id ?? null) === wert) return;
    const q = new URLSearchParams(params.toString());
    if (id) q.set(param, id); else q.delete(param);
    const ziel = `${pfad}${q.toString() ? `?${q}` : ''}`;
    if (wert && id) router.replace(ziel, { scroll: false });
    else if (id) router.push(ziel, { scroll: false });
    else router.replace(ziel, { scroll: false });
  }, [router, params, pfad, param, wert]);
  return [wert, setze];
}
