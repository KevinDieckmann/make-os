'use client';

// ─── Kalender — Darstellung je Gerät (10.10.) ──────────────────────────────────────────────────────────────────────────────────
// Kevin 10.10.: „Den Kalender überall in der Ansicht anpassen — nicht gut zu sehen, nicht gut zu scrollen … im Vergleich zu Google.“
// Zeilenhöhe Kompakt · Normal · Groß, Zoom (Strg/⌘ + Mausrad bzw. Pinch im Raster), „Aufgaben ohne Uhrzeit anzeigen“ und die
// Bedienungshilfe unter dem Raster — je GERÄT (Regeln rein in lib/kalender/darstellung.ts, Vorbild Einstellungen › Bedienung).
// EIN Abo für alle Stellen (`useSyncExternalStore`: der gemerkte Wert steht schon im ersten gemalten Bild); geändert wird nur über
// `kalenderDarstellungAendern`. Die Felder stehen im Kalender (Knopf „Darstellung“ in der Kopfzeile) und unter Einstellungen › Bedienung.

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Segmente, Schalter, Knopf, SymbolKnopf, Beschriftung } from '../ui';
import {
  DARSTELLUNG_EREIGNIS, DARSTELLUNG_MERKER, DARSTELLUNG_VORGABE, ZEILENHOEHEN, darstellungLesen, darstellungSaeubern, darstellungSchreiben, volleHoehe,
  type KalenderDarstellung, type Zeilenhoehe,
} from '@/lib/kalender/darstellung';

let stand: KalenderDarstellung | null = null;
const lesen = (): KalenderDarstellung => (stand ??= darstellungLesen());

function abonnieren(neu: () => void): () => void {
  const ereignis = (e: StorageEvent) => { if (e.key === null || e.key === DARSTELLUNG_MERKER) { stand = null; neu(); } };
  window.addEventListener(DARSTELLUNG_EREIGNIS, neu);
  window.addEventListener('storage', ereignis);
  return () => { window.removeEventListener(DARSTELLUNG_EREIGNIS, neu); window.removeEventListener('storage', ereignis); };
}

/** Die Darstellung dieses Geräts (auf dem Server: die Vorgabe). */
export function useKalenderDarstellung(): KalenderDarstellung {
  return useSyncExternalStore(abonnieren, lesen, () => DARSTELLUNG_VORGABE as KalenderDarstellung);
}

/** Ändert die Darstellung dieses Geräts; der offene Kalender zeichnet sofort neu. `false` = Speicher gesperrt (gilt bis zum Neuladen). */
export function kalenderDarstellungAendern(teil: Partial<KalenderDarstellung>): boolean {
  const neu = darstellungSaeubern({ ...lesen(), ...teil });
  const ok = darstellungSchreiben(neu);
  stand = neu;
  try { window.dispatchEvent(new Event(DARSTELLUNG_EREIGNIS)); } catch { /* egal */ }
  return ok;
}

/** Die Felder: Zeilenhöhe, Zoom zurücksetzen, Aufgaben ohne Uhrzeit, Bedienungshilfe. */
export function DarstellungFelder() {
  const d = useKalenderDarstellung();
  const [gesperrt, setGesperrt] = useState(false);
  const setze = (teil: Partial<KalenderDarstellung>) => setGesperrt(!kalenderDarstellungAendern(teil));
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <Beschriftung erklaerung="kalender.zeilenhoehe">Zeilenhöhe</Beschriftung>
        {/* Eine Stufe wählen setzt den Zoom zurück — sonst wirkte „Normal“ nach dem Zoomen nicht normal. */}
        <Segmente<Zeilenhoehe> liste={[...ZEILENHOEHEN]} aktiv={d.zeilen} onWahl={z => setze({ zeilen: z, zoom: 1 })} />
        {d.zoom !== 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
            <span>Zoom {Math.round(d.zoom * 100)} %</span>
            <Knopf leise onClick={() => setze({ zoom: 1 })}>Zurücksetzen</Knopf>
          </div>
        )}
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>Im Raster zoomen: Strg/⌘ + Mausrad oder zwei Finger auseinanderziehen.</span>
      </div>
      <Schalter erklaerung="kalender.aufgabenOhneZeit" an={d.aufgabenOhneZeit} onChange={v => setze({ aufgabenOhneZeit: v })}>Aufgaben ohne Uhrzeit anzeigen</Schalter>
      <Schalter erklaerung="kalender.hilfe" an={d.hilfe} onChange={v => setze({ hilfe: v })}>Bedienungshilfe unter dem Raster</Schalter>
      {gesperrt && <span role="status" style={{ fontSize: TYP.bedien, color: C.inkDim }}>Dieser Browser lässt das Merken nicht zu — die Wahl gilt bis zum Neuladen.</span>}
    </div>
  );
}

/** Knopf „Darstellung“ in der Kopfzeile: klappt die Felder als kleines Fenster auf (Esc oder Klick daneben schließt). */
export function DarstellungKnopf() {
  const [auf, setAuf] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!auf) return;
    const weg = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') setAuf(false); };
    document.addEventListener('mousedown', weg); document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  return (
    <div ref={box} style={{ position: 'relative', display: 'inline-flex' }}>
      <SymbolKnopf ariaLabel="Darstellung des Kalenders" titel="Darstellung — Zeilenhöhe, Aufgaben ohne Uhrzeit, Bedienungshilfe" offen={auf} steuert="kalender-darstellung" onClick={() => setAuf(a => !a)}>
        <SlidersHorizontal size={18} />
      </SymbolKnopf>
      {auf && (
        <div id="kalender-darstellung" role="dialog" aria-label="Darstellung des Kalenders"
          style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 45, width: 'min(340px, calc(100vw - 32px))', padding: 14, borderRadius: 14, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)', fontFamily: SCHRIFT.text }}>
          <DarstellungFelder />
        </div>
      )}
    </div>
  );
}

/**
 * Volle Höhe für den Kalender (10.10.): wie viel Platz vom oberen Rand des Elements bis zum unteren Fensterrand bleibt (abzüglich der
 * Handy-Leiste unten, Regel `volleHoehe` in lib/kalender/darstellung.ts). Gemessen im Inhaltsbereich (`<main>` rollt, der Kopf steht darin
 * oben fest) — neu bei Fenstergröße, wenn sich über dem Kalender etwas ändert (Hinweis, Verbindungs-Karte) und wenn der Kopf wächst.
 * `null` bis zur ersten Messung (Server, erstes Bild).
 */
export function useVolleHoehe(ref: RefObject<HTMLElement | null>): number | null {
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let bild = 0;
    const messen = () => {
      bild = 0;
      const e = ref.current; if (!e) return;
      const main = e.closest('main');
      const mainOben = main ? Math.max(0, main.getBoundingClientRect().top) : 0;
      const oben = e.getBoundingClientRect().top - mainOben + (main?.scrollTop ?? 0);
      const fenster = Math.min(window.innerHeight - mainOben, main?.clientHeight ?? window.innerHeight);
      const leiste = document.querySelector<HTMLElement>('.leiste-mobil');
      const lr = leiste && getComputedStyle(leiste).display !== 'none' ? leiste.getBoundingClientRect() : null;
      // Nur der Teil der Leiste, der über dem Inhalt liegt (18.10.): seit der Ablage unten endet `<main>` über der Leiste — dann zählt sie nicht doppelt.
      const mainUnten = main ? main.getBoundingClientRect().bottom : window.innerHeight;
      const unten = lr && lr.height > 0 ? Math.max(0, Math.min(window.innerHeight, mainUnten) - lr.top) : 0;
      const neu = volleHoehe(fenster, oben, { unten });
      setH(alt => (alt === neu ? alt : neu));
    };
    const spaeter = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener('resize', spaeter);
    window.visualViewport?.addEventListener('resize', spaeter);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(spaeter);
    const seite = el.closest('.ui-seite'); if (ro && seite) ro.observe(seite);
    const kopf = document.querySelector('.wachstum-kopf'); if (ro && kopf) ro.observe(kopf);
    return () => { window.removeEventListener('resize', spaeter); window.visualViewport?.removeEventListener('resize', spaeter); ro?.disconnect(); if (bild) cancelAnimationFrame(bild); };
  }, [ref]);
  return h;
}
