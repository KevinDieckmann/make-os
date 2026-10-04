'use client';

// ─── Standard · Zeilen-Aktionen: Archivieren & Löschen an jeder Liste (04.10., DESIGN_STANDARD.md) ───────────────────
// Kevin 04.10.: „Für die Usability können wir auch immer Tasks, Produkte etc. einfach löschen bzw. den Button, der kommt,
// wenn man z. B. nach links swiped: dann kommt da Löschen oder Archivieren. Alles andere macht da keinen Sinn.“
//   · Handy: die Zeile nach links wischen → „Archivieren“ (ruhig) und „Löschen“ (Achtung-Farbe). Zurückwischen, Tippen
//     daneben oder Escape schließt; es ist immer nur EINE Zeile offen. Senkrechtes Scrollen bleibt frei (`touch-action: pan-y`
//     + Richtungs-Erkennung ab 10 px) — keine Bibliothek, Pointer-Events.
//   · Rechner: dieselben zwei Aktionen als Symbol-Knöpfe am rechten Rand der Zeile, sichtbar beim Überfahren und beim
//     Tastatur-Fokus (Tab erreicht sie), mit Vorleser-Beschriftung „„Titel“ archivieren“.
//   · Was die Aktionen TUN, entscheidet die Liste — immer sicher statt endgültig (lib/eintraege/sicher.ts): Archiv
//     zurückholbar, Löschen = Papierkorb mit Frist + „Rückgängig“ (`useRueckgaengig`), Rückfragen über `Rueckfrage`.
//   · Bewegung nur `transform`/Breite, < 0,3 s; bei „Bewegung reduzieren“ steht das Ergebnis sofort (globals.css).
// Einsatz in einer neuen Liste (2–3 Zeilen):
//   <ZeileAktionen titel={x.name} onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)} darf={darf}>
//     <Zeile … />
//   </ZeileAktionen>

import { useCallback, useEffect, useId, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, TIEF, RAND, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf, SymbolKnopf } from './knoepfe';

/** Breite einer Aktion hinter der Zeile (Tippziel weit über 44 px). */
export const AKTION_BREITE = 88;
/** Ab so vielen Pixeln steht fest, ob gewischt (waagerecht) oder gescrollt (senkrecht) wird. */
export const RICHTUNG_AB = 10;
/** Ab diesem Anteil der Aktionsbreite bleibt die Zeile offen. */
const OFFEN_AB = 0.4;
const KRITISCH = BEDEUTUNG_FARBE.kritisch;

/** Nur eine Zeile offen: wer aufgeht, schließt die vorige. */
let offeneZeile: { id: string; zu: () => void } | null = null;

export interface ZeileAktionenProps {
  /** Die Zeile selbst (Zeile, eigene Zeile …). */
  children: ReactNode;
  /** Name des Eintrags für Vorleser und Tooltip: „„Kickoff-Paket“ archivieren“. */
  titel: string;
  /** Archivieren (bzw. mit `archiviert` Zurückholen). Fehlt → keine ruhige Aktion. */
  onArchivieren?: () => unknown;
  /** Löschen = in den Papierkorb (nie endgültig). Fehlt → keine Achtung-Aktion. */
  onLoeschen?: () => unknown;
  /** Der Eintrag liegt im Archiv: die ruhige Aktion heißt „Zurückholen“. */
  archiviert?: boolean;
  /** Rechte (Haushalts-Tor, Besitzer): ohne Recht nur die Zeile — die Aktion erscheint gar nicht. */
  darf?: boolean;
}

interface Aktion { art: 'archiv' | 'loeschen'; label: string; aria: string; tun: () => unknown; symbol: ReactNode }

export function ZeileAktionen({ children, titel, onArchivieren, onLoeschen, archiviert, darf = true }: ZeileAktionenProps) {
  const id = useId();
  const [versatz, setVersatz] = useState(0);
  const [zieht, setZieht] = useState(false);
  const versatzJetzt = useRef(0);
  versatzJetzt.current = versatz;
  const wurzel = useRef<HTMLDivElement>(null);
  const zug = useRef<{ x: number; y: number; basis: number; richtung: 'h' | 'v' | null } | null>(null);
  const schlucken = useRef<ReturnType<typeof setTimeout> | null>(null);

  const aktionen: Aktion[] = [];
  if (onArchivieren) aktionen.push(archiviert
    ? { art: 'archiv', label: 'Zurückholen', aria: `„${titel}“ aus dem Archiv zurückholen`, tun: onArchivieren, symbol: <ArchiveRestore size={18} aria-hidden /> }
    : { art: 'archiv', label: 'Archivieren', aria: `„${titel}“ archivieren`, tun: onArchivieren, symbol: <Archive size={18} aria-hidden /> });
  if (onLoeschen) aktionen.push({ art: 'loeschen', label: 'Löschen', aria: `„${titel}“ löschen (Papierkorb)`, tun: onLoeschen, symbol: <Trash2 size={18} aria-hidden /> });
  const breite = aktionen.length * AKTION_BREITE;

  const zu = useCallback(() => { setVersatz(0); if (offeneZeile?.id === id) offeneZeile = null; }, [id]);
  const auf = useCallback(() => {
    if (offeneZeile && offeneZeile.id !== id) offeneZeile.zu();
    offeneZeile = { id, zu: () => setVersatz(0) };
    setVersatz(-breite);
  }, [id, breite]);

  // Offen: Tippen daneben (irgendwo außerhalb dieser Zeile) oder Escape schließt.
  useEffect(() => {
    if (versatz === 0) return;
    const daneben = (e: PointerEvent) => { if (!wurzel.current?.contains(e.target as Node)) zu(); };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') zu(); };
    document.addEventListener('pointerdown', daneben, true);
    document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('pointerdown', daneben, true); document.removeEventListener('keydown', taste); };
  }, [versatz, zu]);
  useEffect(() => () => { if (offeneZeile?.id === id) offeneZeile = null; if (schlucken.current) clearTimeout(schlucken.current); }, [id]);

  if (!darf || !aktionen.length) return <>{children}</>;

  const runter = (e: RPointerEvent<HTMLDivElement>) => {
    // Nur Finger/Stift wischen — die Maus hat die Knöpfe am Rand.
    if (e.pointerType === 'mouse' || !e.isPrimary) return;
    zug.current = { x: e.clientX, y: e.clientY, basis: versatzJetzt.current, richtung: null };
  };
  const bewegen = (e: RPointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z) return;
    const dx = e.clientX - z.x, dy = e.clientY - z.y;
    if (!z.richtung) {
      if (Math.abs(dx) < RICHTUNG_AB && Math.abs(dy) < RICHTUNG_AB) return;
      // Senkrecht (oder schräg) = scrollen: die Zeile hält still, der Browser scrollt.
      z.richtung = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'h' : 'v';
      if (z.richtung === 'v' || (z.basis === 0 && dx > 0)) { zug.current = null; return; }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ältere Browser */ }
      if (offeneZeile && offeneZeile.id !== id) offeneZeile.zu();
      setZieht(true);
    }
    const roh = z.basis + dx;
    // Über die Aktionen hinaus nur zäh (Gummiband), nach rechts nie über die Ruhelage.
    setVersatz(roh < -breite ? -breite + (roh + breite) * 0.25 : Math.min(0, roh));
  };
  const los = (abbruch: boolean) => () => {
    const z = zug.current;
    zug.current = null;
    if (!z || z.richtung !== 'h') return;
    setZieht(false);
    // Der Klick nach dem Wischen öffnet die Zeile nicht.
    if (schlucken.current) clearTimeout(schlucken.current);
    schlucken.current = setTimeout(() => { schlucken.current = null; }, 400);
    const offen = abbruch ? z.basis < 0 : versatzJetzt.current < -breite * OFFEN_AB;
    if (offen) auf(); else zu();
  };
  const klickPruefen = (e: RMouseEvent) => {
    if (schlucken.current || versatzJetzt.current !== 0) {
      e.preventDefault();
      e.stopPropagation();
      // Tippen auf die offene Zeile schließt sie (statt sie zu öffnen).
      if (!schlucken.current) zu();
    }
  };
  const ausfuehren = (a: Aktion) => { zu(); void a.tun(); };
  const offen = versatz <= -breite + 0.5;

  return (
    <div ref={wurzel} className={`ui-za${zieht ? ' ui-za-zieht' : ''}${versatz !== 0 ? ' ui-za-offen' : ''}`}>
      <div className="ui-za-bahn">
        {/* Handy: die Aktionen hinter der Zeile — nur die freigewischte Breite ist sichtbar. */}
        <div className="ui-za-hinten" aria-hidden={!offen} style={{ width: Math.max(0, -versatz) }}>
          <div className="ui-za-reihe" style={{ width: breite }}>
            {aktionen.map(a => (
              <button key={a.art} type="button" tabIndex={offen ? 0 : -1} aria-label={a.aria} onClick={() => ausfuehren(a)} className="ui-za-aktion"
                style={a.art === 'loeschen'
                  ? { background: TIEF.rand(KRITISCH), color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }
                  : { background: C.flaecheHoch, color: C.ink, borderLeft: `1px solid ${RAND.stark}`, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
                {a.symbol}<span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ui-za-inhalt" style={{ transform: versatz ? `translate3d(${versatz}px,0,0)` : undefined }}
          onPointerDown={runter} onPointerMove={bewegen} onPointerUp={los(false)} onPointerCancel={los(true)} onClickCapture={klickPruefen}>
          {children}
        </div>
      </div>
      {/* Rechner: dieselben Aktionen am rechten Rand, sichtbar beim Überfahren und beim Tastatur-Fokus. */}
      <div className="ui-za-schnell" role="group" aria-label={`Aktionen für „${titel}“`} style={{ background: C.flaecheHoch, border: `1px solid ${RAND.stark}` }}>
        {aktionen.map(a => (
          <button key={a.art} type="button" aria-label={a.aria} title={a.label} onClick={() => ausfuehren(a)} className="ui-za-knopf"
            style={{ color: a.art === 'loeschen' ? KRITISCH : C.inkDim }}>{a.symbol}</button>
        ))}
      </div>
    </div>
  );
}

// ── „Rückgängig“ für einige Sekunden (eine Stelle für Aufgaben, Planung, Produkte …) ──────────────────────────────────

/** So lange steht ein Hinweis mit „Rückgängig“ (#87, Aufgaben 29.09.). */
export const RUECKGAENGIG_MS = 10_000;

/** Der Hinweis unten mit „Rückgängig“ — Aussehen für alle Listen gleich. */
export function RueckgaengigLeiste({ text, onRueck, onZu }: { text: string; onRueck?: () => void; onZu: () => void }) {
  return (
    <div role="status" aria-live="polite" className="ui-rueckgaengig" style={{ background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
      {onRueck && <button type="button" onClick={onRueck} className="fassbar ui-rueckgaengig-knopf" style={{ border: `1px solid ${TIEF.rand(C.aktiv)}`, color: C.aktiv, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Rückgängig</button>}
      <SymbolKnopf onClick={onZu} ariaLabel="Hinweis schließen">×</SymbolKnopf>
    </div>
  );
}

export interface Rueckgaengig {
  /** Hinweis zeigen; mit `rueck` gibt es den Knopf „Rückgängig“ (RUECKGAENGIG_MS lang). */
  melden: (text: string, rueck?: () => void) => void;
  /** Der Hinweis selbst — einmal in die Seite hängen. */
  hinweis: ReactNode;
}

export function useRueckgaengig(): Rueckgaengig {
  const [h, setH] = useState<{ id: number; text: string; rueck?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zaehler = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const melden = useCallback((text: string, rueck?: () => void) => {
    const id = ++zaehler.current;
    setH({ id, text, rueck });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setH(x => (x?.id === id ? null : x)), RUECKGAENGIG_MS);
  }, []);
  const hinweis = h ? <RueckgaengigLeiste text={h.text} onRueck={h.rueck ? () => { const r = h.rueck; setH(null); r?.(); } : undefined} onZu={() => setH(null)} /> : null;
  return { melden, hinweis };
}

// ── Rückfrage (statt window.confirm) ─────────────────────────────────────────────────────────────────────────────

export interface RueckfrageWahl {
  label: string;
  /** `gefahr` = Achtung-Farbe (Löschen), `leise` = Nebenwahl; sonst die Hauptwahl. */
  ton?: 'gefahr' | 'leise';
  tun: () => unknown;
}
export interface RueckfrageDaten {
  titel: string;
  text: ReactNode;
  wahl: RueckfrageWahl[];
  /** Schließen ohne Wahl (Abbrechen, Escape, daneben tippen). */
  zu?: () => void;
}

/**
 * Die Rückfrage vor einer Handlung mit Folgen — Karte in der Mitte (am Handy unten), Rolle `alertdialog`. „Abbrechen“ steht
 * immer da und hat den Fokus (Enter löst nie aus Versehen etwas aus); Escape und Tippen daneben brechen ab.
 */
export function Rueckfrage({ frage, onZu, onGewaehlt }: { frage: RueckfrageDaten; /** Abbrechen (ohne Wahl). */ onZu: () => void; /** Eine Wahl getroffen — schließt nur. */ onGewaehlt?: () => void }) {
  const kennung = useId();
  const abbrechen = useRef<HTMLDivElement>(null);
  const zu = useRef(onZu);
  zu.current = onZu;
  // Einmal beim Öffnen: Fokus auf „Abbrechen“, Escape bricht ab (der Aufrufer rendert oft neu — der Fokus springt nicht).
  useEffect(() => {
    abbrechen.current?.querySelector('button')?.focus();
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); zu.current(); } };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, []);
  return (
    <div className="ui-rueckfrage-grund" onClick={e => { if (e.target === e.currentTarget) onZu(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={`${kennung}-t`} aria-describedby={`${kennung}-x`} className="ui-rueckfrage"
        style={{ background: C.flaeche, border: `1px solid ${RAND.stark}`, color: C.ink, fontFamily: SCHRIFT.text }}>
        <h2 id={`${kennung}-t`} style={{ margin: 0, fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.01em', lineHeight: 1.3 }}>{frage.titel}</h2>
        <div id={`${kennung}-x`} style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55 }}>{frage.text}</div>
        <div className="ui-rueckfrage-wahl">
          {frage.wahl.map(w => <Knopf key={w.label} leise={w.ton === 'leise'} farbe={w.ton === 'gefahr' ? KRITISCH : undefined} onClick={() => { (onGewaehlt ?? onZu)(); return w.tun(); }}>{w.label}</Knopf>)}
          <div ref={abbrechen} style={{ display: 'contents' }}><Knopf leise onClick={onZu}>Abbrechen</Knopf></div>
        </div>
      </div>
    </div>
  );
}

/** Rückfrage als Hook: `fragen({ titel, text, wahl })`, `dialog` einmal in die Seite hängen. Abbrechen ruft `zu` der Frage. */
export function useRueckfrage(): { fragen: (f: RueckfrageDaten) => void; dialog: ReactNode } {
  const [f, setF] = useState<RueckfrageDaten | null>(null);
  const jetzt = useRef<RueckfrageDaten | null>(null);
  jetzt.current = f;
  const abbrechen = useCallback(() => { const zu = jetzt.current?.zu; setF(null); zu?.(); }, []);
  const gewaehlt = useCallback(() => setF(null), []);
  const fragen = useCallback((x: RueckfrageDaten) => setF(x), []);
  return { fragen, dialog: f ? <Rueckfrage frage={f} onZu={abbrechen} onGewaehlt={gewaehlt} /> : null };
}
