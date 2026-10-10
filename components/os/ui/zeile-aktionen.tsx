'use client';

// ─── Standard · Zeilen-Aktionen an jeder Liste (04.10., neu gebaut 10.10. — DESIGN_STANDARD.md › Zeilen-Aktionen) ──────────────────
// 04.10. Kevin: „…den Button, der kommt, wenn man z. B. nach links swiped: dann kommt da Löschen oder Archivieren.“
// 10.10. Kevin (Bildschirmfoto Mandate): die Rand-Knöpfe lagen beim Überfahren ÜBER dem Inhalt (verdeckten Chips). „Löschen und Archivieren
// muss anders laufen — z. B. nach links wischen oder rechts mit drei Punkten und Einstellungen … Bau den Standard überall mit ein.“
//   · Rechner: rechts ein ruhiges „⋯“ in einer EIGENEN, reservierten Spalte — nie über dem Inhalt. Sichtbar beim Überfahren und beim
//     Tastatur-Fokus (Einstellung „⋯ immer sichtbar“), am Handy immer. `aria-haspopup="menu"`, Pfeil runter öffnet, Escape schließt,
//     der Fokus kommt zurück. Das Menü (zeilen-menue.tsx): Öffnen · Link kopieren · In neuem Tab · Einträge der Liste (`mehr`) ·
//     ── · Archivieren/Zurückholen · Löschen.
//   · Handy: nach LINKS wischen = Archivieren, nach RECHTS = Löschen (Vorgabe, je Gerät umstellbar: Einstellungen › Bedienung) — ab der
//     Schwelle ausgelöst, darunter schnappt die Zeile zurück. Senkrechtes Scrollen hat Vorrang (`touch-action: pan-y` + Richtungs-
//     Erkennung ab 10 px). Ohne Aktion in einer Richtung gibt es dort kein Wischen. Pointer-Events, keine Bibliothek.
//   · Was die Aktionen TUN, entscheidet die Liste — immer sicher statt endgültig (lib/eintraege/sicher.ts): Archiv zurückholbar, Löschen =
//     Papierkorb + „Rückgängig“ (`useRueckgaengig`). „Vor dem Löschen nachfragen“ (Einstellung) fragt hier — außer die Liste fragt selbst
//     (`loeschenFragt`: Sperren, Grund, was mitgeht).
//   · Bewegung nur `transform`/Breite, < 0,3 s; bei „Bewegung reduzieren“ steht das Ergebnis sofort (globals.css).
// Einsatz in einer neuen Liste (2–3 Zeilen):
//   <ZeileAktionen titel={x.name} href={WEG.x(x.id)} onArchivieren={() => archivieren(x)} onLoeschen={() => loeschen(x)} darf={darf}
//     mehr={[{ id: 'bearbeiten', label: 'Bearbeiten', tun: () => bearbeiten(x) }]}>
//     <Zeile … />
//   </ZeileAktionen>

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as RKeyboardEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, TIEF, RAND, ECKE, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { RICHTUNG_AB, WAAGERECHT_FAKTOR, wischScharf, wischSchwelle, wischVersatz, wischZiel, type WischZiel } from '@/lib/make-one/bedienung';
import { Knopf, SymbolKnopf } from './knoepfe';
import { HANDY_BIS } from './medien';
import { useBedienung, ruckeln } from './bedienung';
import { ZeilenMenueFenster, zeilenMenueEintraege, type MenueEintrag, type ZeilenMehr } from './zeilen-menue';

export { RICHTUNG_AB };
/** Breite der reservierten Spalte für „⋯“ — Tabellenköpfe über Zeilen mit ZeileAktionen rücken rechts um so viel ein. */
export const ZEILE_MEHR_BREITE = 44;
const KRITISCH = BEDEUTUNG_FARBE.kritisch;

export interface ZeileAktionenProps {
  /** Die Zeile selbst (Zeile, eigene Zeile …). */
  children: ReactNode;
  /** Name des Eintrags für Vorleser und Rückfrage: „Aktionen für „Kickoff-Paket““. */
  titel: string;
  /** Archivieren (bzw. mit `archiviert` Zurückholen). Fehlt → kein Archiv-Punkt, kein Wischen dafür. */
  onArchivieren?: () => unknown;
  /** Löschen = in den Papierkorb (nie endgültig). Fehlt → kein Löschen-Punkt, kein Wischen dafür. */
  onLoeschen?: () => unknown;
  /** Der Eintrag liegt im Archiv: die ruhige Aktion heißt „Zurückholen“. */
  archiviert?: boolean;
  /** Rechte (Haushalts-Tor, Besitzer): ohne Recht nur die Zeile — kein „⋯“, kein Wischen, kein Eintrag. Entscheidet nie allein (Server). */
  darf?: boolean;
  /** Interner Weg zum Eintrag (immer über `WEG`) → „Öffnen“ (ohne `onOeffnen`), „Link kopieren“, „In neuem Tab öffnen“. */
  href?: string;
  /** Öffnen auf der Seite (Seitenfenster, Akte) — sonst öffnet `href`. */
  onOeffnen?: () => unknown;
  /** Weitere Einträge der Liste (Bearbeiten, Duplizieren, Zuständig, Wiedervorlage, Umwandeln, Verschieben nach …). */
  mehr?: readonly ZeilenMehr[];
  /** `onLoeschen` fragt selbst nach (Sperren, Grund, was mitgeht) — die Einstellung „Vor dem Löschen nachfragen“ fragt dann nicht doppelt. */
  loeschenFragt?: boolean;
}

interface Zug { x: number; y: number; breite: number; richtung: 'h' | 'v' | null; ziel: WischZiel | null; scharf: boolean }

const WISCH_TEXT: Record<WischZiel, string> = { archivieren: 'Archivieren', loeschen: 'Löschen', aktionen: 'Aktionen' };
const wischFarbe = (z: WischZiel): string => (z === 'loeschen' ? KRITISCH : z === 'archivieren' ? C.aktiv : C.inkDim);
const portal = (x: ReactNode) => (x && typeof document !== 'undefined' ? createPortal(x, document.body) : null);

export function ZeileAktionen({ children, titel, onArchivieren, onLoeschen, archiviert, darf = true, href, onOeffnen, mehr, loeschenFragt }: ZeileAktionenProps) {
  const b = useBedienung();
  const menueId = useId();
  const [menue, setMenue] = useState<{ anker: DOMRect | null; blatt: boolean } | null>(null);
  const [versatz, setVersatz] = useState(0);
  const [zieht, setZieht] = useState(false);
  const [ziel, setZiel] = useState<WischZiel | null>(null);
  const [scharf, setScharf] = useState(false);
  // Welche Seite freigewischt wird — bleibt nach dem Loslassen stehen, damit die Fläche mit der Zeile zurückfährt.
  const [seite, setSeite] = useState<'links' | 'rechts'>('rechts');
  const [meldung, setMeldung] = useState<string | null>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const zug = useRef<Zug | null>(null);
  const schlucken = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { bestaetigen, dialog } = useRueckfrage();
  useEffect(() => () => { if (schlucken.current) clearTimeout(schlucken.current); clearTimeout(meldTimer.current); }, []);

  const melde = useCallback((text: string) => {
    setMeldung(text);
    clearTimeout(meldTimer.current);
    meldTimer.current = setTimeout(() => setMeldung(null), 3000);
  }, []);
  const kopieren = useCallback(async (weg: string) => {
    const voll = typeof location === 'undefined' ? weg : new URL(weg, location.origin).href;
    try { await navigator.clipboard.writeText(voll); melde('Link kopiert'); } catch { melde(`Kopieren ging nicht — ${voll}`); }
  }, [melde]);

  const loeschen = onLoeschen ? async () => {
    if (b.loeschenNachfragen && !loeschenFragt) {
      const ok = await bestaetigen({ titel: `„${titel}“ löschen?`, text: 'Der Eintrag kommt in den Papierkorb (wo es einen gibt, 30 Tage wiederherstellbar) — danach steht kurz „Rückgängig“.', ja: 'Löschen', gefahr: true });
      if (!ok) return;
    }
    return onLoeschen();
  } : undefined;

  const eintraege = zeilenMenueEintraege({ titel, onOeffnen, href, mehr, onArchivieren, onLoeschen: loeschen, archiviert, darf, kopieren });
  if (!darf || !eintraege.length) return <>{children}</>;
  const kann = { archivieren: !!onArchivieren, loeschen: !!onLoeschen, menue: true };
  const wischbar = !!(wischZiel('links', b, kann) || wischZiel('rechts', b, kann));

  const menueAuf = (blatt?: boolean) => {
    const handy = blatt ?? (typeof window !== 'undefined' && !!window.matchMedia?.(`(max-width: ${HANDY_BIS}px)`).matches);
    setMenue({ anker: knopf.current?.getBoundingClientRect() ?? null, blatt: handy });
  };
  const menueZu = (fokus: boolean) => { setMenue(null); if (fokus) setTimeout(() => knopf.current?.focus(), 0); };
  const gewaehlt = (e: MenueEintrag) => {
    // Ein Link (Öffnen) wechselt die Seite — dann bekommt „⋯“ den Fokus nicht zurück.
    menueZu(!(e.href && !e.neuerTab));
    if (e.tun) void e.tun();
  };
  const ausloesen = (z: WischZiel) => {
    ruckeln(b, 18);
    if (z === 'archivieren') void onArchivieren?.();
    else if (z === 'loeschen') void loeschen?.();
    else menueAuf(true);
  };

  const runter = (e: RPointerEvent<HTMLDivElement>) => {
    // Nur Finger/Stift wischen — die Maus hat „⋯“.
    if (!wischbar || e.pointerType === 'mouse' || !e.isPrimary) return;
    zug.current = { x: e.clientX, y: e.clientY, breite: e.currentTarget.getBoundingClientRect().width, richtung: null, ziel: null, scharf: false };
  };
  const bewegen = (e: RPointerEvent<HTMLDivElement>) => {
    const z = zug.current;
    if (!z) return;
    const dx = e.clientX - z.x, dy = e.clientY - z.y;
    if (!z.richtung) {
      if (Math.abs(dx) < RICHTUNG_AB && Math.abs(dy) < RICHTUNG_AB) return;
      // Senkrecht (oder schräg) = scrollen: die Zeile hält still, der Browser scrollt. In eine Richtung ohne Aktion: kein Wischen.
      z.richtung = Math.abs(dx) > Math.abs(dy) * WAAGERECHT_FAKTOR ? 'h' : 'v';
      if (z.richtung === 'v' || !wischZiel(dx < 0 ? 'links' : 'rechts', b, kann)) { zug.current = null; return; }
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ältere Browser */ }
      setZieht(true);
    }
    const s = wischSchwelle(z.breite);
    const zl = dx === 0 ? null : wischZiel(dx < 0 ? 'links' : 'rechts', b, kann);
    const sch = !!zl && wischScharf(dx, s);
    if (sch && !z.scharf) ruckeln(b);
    z.ziel = zl;
    z.scharf = sch;
    if (zl) { setZiel(zl); setSeite(dx < 0 ? 'rechts' : 'links'); }
    setScharf(sch);
    setVersatz(zl ? wischVersatz(dx, s) : 0);
  };
  const los = (abbruch: boolean) => () => {
    const z = zug.current;
    zug.current = null;
    if (!z || z.richtung !== 'h') return;
    setZieht(false);
    setVersatz(0);
    setScharf(false);
    // Der Klick nach dem Wischen öffnet die Zeile nicht.
    if (schlucken.current) clearTimeout(schlucken.current);
    schlucken.current = setTimeout(() => { schlucken.current = null; }, 400);
    // Unter der Schwelle (oder abgebrochen): zurückschnappen, nichts passiert.
    if (!abbruch && z.scharf && z.ziel) ausloesen(z.ziel);
  };
  const klickPruefen = (e: RMouseEvent) => {
    if (schlucken.current) { e.preventDefault(); e.stopPropagation(); }
  };
  const knopfTaste = (e: RKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); menueAuf(); }
  };

  const f = ziel ? wischFarbe(ziel) : C.inkDim;
  const wischSymbol = ziel === 'loeschen' ? <Trash2 size={20} aria-hidden /> : ziel === 'archivieren' ? (archiviert ? <ArchiveRestore size={20} aria-hidden /> : <Archive size={20} aria-hidden />) : <MoreHorizontal size={20} aria-hidden />;
  const wischText = ziel === 'archivieren' && archiviert ? 'Zurückholen' : ziel ? WISCH_TEXT[ziel] : '';

  return (
    <div className={`ui-za${zieht ? ' ui-za-zieht' : ''}${menue ? ' ui-za-menue-offen' : ''}`}>
      <div className="ui-za-bahn">
        {/* Handy: hinter der Zeile, was das Wischen tut — nur die freigewischte Breite ist sichtbar. */}
        {ziel && (
          <div aria-hidden className={`ui-za-hinten ui-za-hinten-${seite}${scharf ? ' ui-za-scharf' : ''}`}
            style={{ width: Math.abs(versatz), backgroundColor: C.flaecheHoch, backgroundImage: `linear-gradient(${scharf ? TIEF.rand(f) : TIEF.flaeche(f)}, ${scharf ? TIEF.rand(f) : TIEF.flaeche(f)})`, color: scharf ? C.ink : f, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
            <span className="ui-za-hinweis">{wischSymbol}<span>{wischText}</span></span>
          </div>
        )}
        <div className="ui-za-inhalt" style={{ transform: versatz ? `translate3d(${versatz}px,0,0)` : undefined }}
          onPointerDown={runter} onPointerMove={bewegen} onPointerUp={los(false)} onPointerCancel={los(true)} onClickCapture={klickPruefen}>
          <div className="ui-za-kern">{children}</div>
          {/* Rechner und Handy: „⋯“ in einer eigenen Spalte — nie über dem Inhalt. */}
          <div className="ui-za-spalte">
            <button ref={knopf} type="button" className="ui-za-mehr fassbar" aria-haspopup="menu" aria-expanded={!!menue} aria-controls={menue ? menueId : undefined}
              aria-label={`Aktionen für „${titel}“`} title="Aktionen" onKeyDown={knopfTaste}
              onClick={e => { e.stopPropagation(); if (menue) menueZu(true); else menueAuf(); }}
              style={{ color: C.inkDim, borderRadius: ECKE.eingabe }}>
              <MoreHorizontal size={18} aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {menue && <ZeilenMenueFenster id={menueId} titel={titel} eintraege={eintraege} anker={menue.anker} blatt={menue.blatt} knopf={knopf.current} onZu={menueZu} onWahl={gewaehlt} />}
      {portal(dialog)}
      {portal(meldung ? <RueckgaengigLeiste text={meldung} onZu={() => setMeldung(null)} /> : null)}
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
        <div id={`${kennung}-x`} style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{frage.text}</div>
        <div className="ui-rueckfrage-wahl">
          {frage.wahl.map(w => <Knopf key={w.label} leise={w.ton === 'leise'} farbe={w.ton === 'gefahr' ? KRITISCH : undefined} onClick={() => { (onGewaehlt ?? onZu)(); return w.tun(); }}>{w.label}</Knopf>)}
          <div ref={abbrechen} style={{ display: 'contents' }}><Knopf leise onClick={onZu}>Abbrechen</Knopf></div>
        </div>
      </div>
    </div>
  );
}

/** Kurzform für eine Ja/Nein-Rückfrage (statt `window.confirm`): eine Hauptwahl, „Abbrechen“ kommt immer dazu. */
export interface Bestaetigung {
  titel: string;
  /** Erklärung: was passiert, was bleibt (Zeilenumbrüche `\n` werden gezeigt). */
  text?: ReactNode;
  /** Beschriftung der Hauptwahl, z. B. „In den Papierkorb“, „Trennen“, „Zurücknehmen“. */
  ja: string;
  /** Achtung-Farbe für die Hauptwahl (Löschen, Trennen, Verwerfen). */
  gefahr?: boolean;
}

/**
 * Rückfrage als Hook: `fragen({ titel, text, wahl })`, `dialog` einmal in die Seite hängen. Abbrechen ruft `zu` der Frage.
 * `bestaetigen({ titel, text, ja, gefahr })` ersetzt `window.confirm` (04.10.): ein Promise — `true` bei der Hauptwahl,
 * `false` bei Abbrechen/Escape/daneben. Eine neue Frage bricht eine offene ab (`false`).
 */
export function useRueckfrage(): { fragen: (f: RueckfrageDaten) => void; bestaetigen: (b: Bestaetigung) => Promise<boolean>; dialog: ReactNode } {
  const [f, setF] = useState<RueckfrageDaten | null>(null);
  const jetzt = useRef<RueckfrageDaten | null>(null);
  jetzt.current = f;
  const abbrechen = useCallback(() => { const zu = jetzt.current?.zu; jetzt.current = null; setF(null); zu?.(); }, []);
  // Gewählt: die Frage ist beantwortet — eine gleich danach gestellte (Kette) bricht sie nicht mehr „ab“.
  const gewaehlt = useCallback(() => { jetzt.current = null; setF(null); }, []);
  const fragen = useCallback((x: RueckfrageDaten) => { const offen = jetzt.current?.zu; jetzt.current = x; setF(x); offen?.(); }, []);
  const bestaetigen = useCallback((b: Bestaetigung) => new Promise<boolean>(fertig => {
    fragen({ titel: b.titel, text: b.text ?? '', wahl: [{ label: b.ja, ton: b.gefahr ? 'gefahr' : undefined, tun: () => fertig(true) }], zu: () => fertig(false) });
  }), [fragen]);
  return { fragen, bestaetigen, dialog: f ? <Rueckfrage frage={f} onZu={abbrechen} onGewaehlt={gewaehlt} /> : null };
}
