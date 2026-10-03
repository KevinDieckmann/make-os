'use client';

// ─── Markttraktion · Wahl-Chip (27.09., Kevin: „Chip + Menü + Vorschlag“) ────
// „Dass man immer alle Optionen sieht, ist von der Usability nicht gut.“
// Sichtbar ist nur, was gesetzt ist — als Chip [Entscheider ▾]. Ein Klick
// öffnet ein kleines Menü mit allen Werten (der aktuelle markiert, unten
// „– entfernen“, wenn das Feld leer sein darf). Ein leeres Feld zeigt
// [+ Rolle] — oder, wenn die Daten es hergeben, einen Vorschlag:
// „Vorschlag: Nutzer [✓ übernehmen] [andere ▾]“. Vorschläge werden nie still
// gespeichert (lib/crm/vorschlaege.ts), immer ein Klick.
//
// Das Menü hängt am Chip und bleibt im Fenster (am Handy ein Blatt von unten),
// schließt bei Klick daneben, Esc oder Auswahl; Tastatur ↑ ↓ Pos1 Ende Enter
// Esc, danach steht der Fokus wieder auf dem Chip. Ab SUCHE_AB_WAHL Werten
// gibt es ein Suchfeld. Es ist immer nur EIN Menü offen.
// Neu anlegen (27.09. spät): Mit `onNeu` hat das Menü immer ein Suchfeld
// („suchen oder neu …“) und unten „+ neu …“ — bzw. bei einer Suche ohne
// gleichnamigen Wert „„<Suchtext>“ anlegen“. Enter legt an und wählt; die
// Länge prüft `neuPruefen` (neuMin/neuMax), Fehler stehen im Menü. `fuss`
// (z. B. „Pflegen ›“) steht darunter. Genutzt von Typ/Kategorie der Akte
// (WertelistenMehrfachWahl) und der Einheit an Aufgaben/Routinen (EinheitWahl).
// Regel (CLAUDE.md): Auswahl in Formularen = Wahl; Pillenreihen nur für
// Filter, Reiter, Navigation und echte Zweier-Umschalter.

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type KeyboardEvent as TastenEreignis } from 'react';
import { createPortal } from 'react-dom';
import { FARBE as C, LEUCHT, TYP, SCHRIFT } from '@/lib/make-one/design';
import { wahlFiltern, naechsterIndex, istWahlTaste, startIndex, wahlLabel, menuLage, normiere, anlegenZeile, neuPruefen, SUCHE_AB_WAHL, ALS_BLATT_BIS, NEU_MIN, NEU_MAX, type WahlEintrag, type WahlVorschlag } from '@/lib/crm/wahl';

export type { WahlEintrag, WahlVorschlag };

// ── Nur ein Menü gleichzeitig ────────────────────────────────────────────────
let offenesMenue: symbol | null = null;
const schliesser = new Map<symbol, () => void>();
function menueOeffnen(wer: symbol, schliessen: () => void) {
  if (offenesMenue && offenesMenue !== wer) schliesser.get(offenesMenue)?.();
  offenesMenue = wer;
  schliesser.set(wer, schliessen);
}
function menueZu(wer: symbol) {
  if (offenesMenue === wer) offenesMenue = null;
  schliesser.delete(wer);
}

interface Gemeinsam<T extends string> {
  /** Alle Werte, in der Reihenfolge des Menüs. */
  liste: readonly WahlEintrag<T>[];
  /** Feldname — Titel des Menüs, Vorlesetext und Leer-Text „+ <label>“. */
  label: string;
  /** Text für das leere Feld, Standard „+ <label>“. */
  leer?: string;
  /** Akzent des gesetzten Chips (Standard: Interaktionsfarbe). */
  farbe?: string;
  /** Kleiner Chip — für dichte Zeilen (Gästeliste, Wert-Zeilen). */
  klein?: boolean;
  /** Nur lesen. */
  aus?: boolean;
  /** Kennung am äußeren Element — z. B. für den Sprung „zum Vorschlag“. */
  id?: string;
}

export interface WahlProps<T extends string> extends Gemeinsam<T> {
  wert: T | null | undefined;
  onWahl: (id: T) => void;
  /** Darf das Feld leer werden? Dann steht „– entfernen“ unten im Menü. */
  onLeeren?: () => void;
  /** Vorschlag aus den Daten — erscheint nur, solange das Feld leer ist. */
  vorschlag?: WahlVorschlag<T> | null;
  /** Text der Leeren-Zeile im Menü (Standard „entfernen“, z. B. „ohne Einheit“). */
  leerenLabel?: string;
  /**
   * Neu anlegen aus dem Menü: bekommt den gesäuberten, längengeprüften Text und
   * gibt den angelegten (ggf. vereinheitlichten) Wert zurück — danach wird er
   * gewählt. `null` = nicht angelegt; ein geworfener Fehler zeigt seinen Text im Menü.
   */
  onNeu?: (text: string) => Promise<T | null>;
  /** Länge eines neuen Werts (Standard NEU_MIN–NEU_MAX aus lib/crm/wahl.ts). */
  neuMin?: number;
  neuMax?: number;
  /** Fuß des Menüs, z. B. ein Link „Pflegen ›“ — ein Klick darauf schließt das Menü. */
  fuss?: ReactNode;
}

export interface WahlMehrfachProps<T extends string> extends Gemeinsam<T> {
  wert: readonly T[];
  onWahl: (ids: T[]) => void;
  /** Vorschläge aus den Daten — nur die, die noch nicht gesetzt sind, erscheinen. */
  vorschlag?: WahlVorschlag<T> | readonly WahlVorschlag<T>[] | null;
  /** Neu anlegen aus dem Menü (28.09., wie bei `Wahl`): der angelegte Wert kommt dazu. */
  onNeu?: (text: string) => Promise<T | null>;
  neuMin?: number;
  neuMax?: number;
  /** Fuß des Menüs, z. B. „Pflegen ›“. */
  fuss?: ReactNode;
}

// ── Aussehen ─────────────────────────────────────────────────────────────────
const chipGrund = (klein?: boolean): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600,
  padding: klein ? '4px 11px' : '6px 12px', minHeight: klein ? 32 : 36, borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.2, maxWidth: '100%',
});
const gesetztStil = (farbe: string, klein?: boolean): CSSProperties => ({ ...chipGrund(klein), border: `1px solid ${farbe}66`, background: `${farbe}1A`, color: farbe });
const leerStil = (klein?: boolean): CSSProperties => ({ ...chipGrund(klein), fontWeight: 500, border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: C.inkDim });
const vorschlagStil = (farbe: string, klein?: boolean): CSSProperties => ({ ...chipGrund(klein), border: `1px dashed ${farbe}99`, background: `${farbe}10`, color: farbe });
const pfeil = <span aria-hidden style={{ fontSize: '.8em', opacity: .7, marginLeft: 1 }}>▾</span>;
const aussStil: CSSProperties = { cursor: 'default', opacity: .55 };

// ── Einzelwahl ───────────────────────────────────────────────────────────────
export function Wahl<T extends string>({ liste, wert, onWahl, onLeeren, label, leer, vorschlag, farbe = C.aktiv, klein, aus, id, leerenLabel, onNeu, neuMin = NEU_MIN, neuMax = NEU_MAX, fuss }: WahlProps<T>) {
  // Offen = das Element, an dem das Menü hängt (beim Öffnen gemerkt — nie ein Ref im Rendern lesen).
  const [anker, setAnker] = useState<HTMLElement | null>(null);
  const offen = !!anker;
  const knopf = useRef<HTMLButtonElement>(null);
  const [ich] = useState(() => Symbol('wahl'));
  const menuId = `wahl-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  useEffect(() => () => menueZu(ich), [ich]);
  const gesetzt = wert != null && wert !== '';
  const v = !gesetzt && vorschlag && liste.some(e => e.id === vorschlag.id) ? vorschlag : null;
  const oeffnen = () => { if (aus || !knopf.current) return; menueOeffnen(ich, () => setAnker(null)); setAnker(knopf.current); };
  const schliessen = (fokus: boolean) => { setAnker(null); menueZu(ich); if (fokus) setTimeout(() => knopf.current?.focus(), 0); };
  const tasteAmChip = (e: TastenEreignis) => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !offen) { e.preventDefault(); oeffnen(); } };
  const aria = { 'aria-haspopup': 'listbox' as const, 'aria-expanded': offen, 'aria-controls': offen ? menuId : undefined };
  const name = wahlLabel(liste, wert);
  return (
    // Klicks (auch aus dem Menü, das über ein Portal am Seitenende hängt) sollen keine Zeile dahinter öffnen.
    <span id={id} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
      {gesetzt ? (
        <button ref={knopf} type="button" onClick={() => (offen ? schliessen(false) : oeffnen())} onKeyDown={tasteAmChip} disabled={aus} className="fassbar" aria-label={`${label}: ${name} — ändern`} {...aria}
          style={{ ...gesetztStil(farbe, klein), ...(aus ? aussStil : {}) }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>{!aus && pfeil}
        </button>
      ) : v ? (
        <>
          <span style={{ fontSize: klein ? 12 : 12.5, color: C.inkLeise, whiteSpace: 'nowrap' }} title={v.grund}>Vorschlag: <b style={{ color: C.ink, fontWeight: 600 }}>{wahlLabel(liste, v.id)}</b></span>
          <button type="button" data-wahl-uebernehmen onClick={() => onWahl(v.id)} disabled={aus} className="fassbar" title={v.grund} aria-label={`Vorschlag ${wahlLabel(liste, v.id)} als ${label} übernehmen — ${v.grund}`}
            style={{ ...vorschlagStil(farbe, klein), ...(aus ? aussStil : {}) }}>✓ übernehmen</button>
          <button ref={knopf} type="button" onClick={() => (offen ? schliessen(false) : oeffnen())} onKeyDown={tasteAmChip} disabled={aus} className="fassbar" aria-label={`Andere ${label} wählen`} {...aria}
            style={{ ...leerStil(klein), ...(aus ? aussStil : {}) }}>andere{pfeil}</button>
          {!klein && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{v.grund}</span>}
        </>
      ) : (
        <button ref={knopf} type="button" onClick={() => (offen ? schliessen(false) : oeffnen())} onKeyDown={tasteAmChip} disabled={aus} className="fassbar" aria-label={`${label} wählen`} {...aria}
          style={{ ...leerStil(klein), ...(aus ? aussStil : {}) }}>{leer ?? `+ ${label}`}</button>
      )}
      {anker && (
        <WahlMenue anker={anker} menuId={menuId} liste={liste} label={label} farbe={farbe}
          gewaehlt={gesetzt ? [wert as T] : []} vorschlaege={v ? [v] : []}
          entfernen={gesetzt && !!onLeeren} leerenLabel={leerenLabel} fuss={fuss}
          neu={onNeu ? { min: neuMin, max: neuMax, anlegen: onNeu } : undefined}
          onWert={id2 => { schliessen(true); if (id2 !== wert) onWahl(id2); }}
          onEntfernen={() => { schliessen(true); onLeeren?.(); }}
          onSchliessen={schliessen} />
      )}
    </span>
  );
}

// ── Mehrfachwahl ─────────────────────────────────────────────────────────────
export function WahlMehrfach<T extends string>({ liste, wert, onWahl, label, leer, vorschlag, farbe = C.aktiv, klein, aus, id, onNeu, neuMin = NEU_MIN, neuMax = NEU_MAX, fuss }: WahlMehrfachProps<T>) {
  // Offen = das Element, an dem das Menü hängt (beim Öffnen gemerkt — nie ein Ref im Rendern lesen).
  const [anker, setAnker] = useState<HTMLElement | null>(null);
  const offen = !!anker;
  const knopf = useRef<HTMLButtonElement>(null);
  const [ich] = useState(() => Symbol('wahl'));
  const menuId = `wahl-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  useEffect(() => () => menueZu(ich), [ich]);
  const vorschlaege = (vorschlag ? (Array.isArray(vorschlag) ? vorschlag : [vorschlag]) as readonly WahlVorschlag<T>[] : [])
    .filter(v => !wert.includes(v.id) && liste.some(e => e.id === v.id));
  const oeffnen = () => { if (aus || !knopf.current) return; menueOeffnen(ich, () => setAnker(null)); setAnker(knopf.current); };
  const schliessen = (fokus: boolean) => { setAnker(null); menueZu(ich); if (fokus) setTimeout(() => knopf.current?.focus(), 0); };
  const umschalten = (x: T) => onWahl(wert.includes(x) ? wert.filter(y => y !== x) : [...wert, x]);
  return (
    // Klicks (auch aus dem Menü, das über ein Portal am Seitenende hängt) sollen keine Zeile dahinter öffnen.
    <span id={id} onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
      {wert.map(x => (
        <span key={x} style={{ ...gesetztStil(farbe, klein), cursor: 'default', paddingRight: klein ? 4 : 6 }}>
          {wahlLabel(liste, x)}
          {!aus && <button type="button" onClick={() => onWahl(wert.filter(y => y !== x))} aria-label={`${wahlLabel(liste, x)} entfernen`} className="fassbar"
            style={{ background: 'none', border: 'none', color: farbe, cursor: 'pointer', padding: '0 4px', fontSize: 14, lineHeight: 1, opacity: .75, borderRadius: 999, minWidth: 20, minHeight: 20 }}>×</button>}
        </span>
      ))}
      {!aus && vorschlaege.map(v => (
        <button key={v.id} type="button" data-wahl-uebernehmen onClick={() => onWahl([...wert, v.id])} className="fassbar" title={v.grund}
          aria-label={`Vorschlag ${wahlLabel(liste, v.id)} als ${label} übernehmen — ${v.grund}`} style={vorschlagStil(farbe, klein)}>
          <span style={{ fontWeight: 500, opacity: .8 }}>Vorschlag:</span> {wahlLabel(liste, v.id)} ✓
        </button>
      ))}
      {!aus && (wert.length < liste.length || offen || !!onNeu) && (
        <button ref={knopf} type="button" onClick={() => (offen ? schliessen(false) : oeffnen())} onKeyDown={e => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !offen) { e.preventDefault(); oeffnen(); } }}
          className="fassbar" aria-label={wert.length ? `${label} hinzufügen` : `${label} wählen`} aria-haspopup="listbox" aria-expanded={offen} aria-controls={offen ? menuId : undefined}
          style={{ ...leerStil(klein), ...(wert.length ? { minWidth: klein ? 26 : 30, justifyContent: 'center', padding: klein ? '3px 8px' : '5px 10px' } : {}) }}>
          {wert.length ? '+' : leer ?? `+ ${label}`}
        </button>
      )}
      {aus && !wert.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>—</span>}
      {anker && (
        <WahlMenue anker={anker} menuId={menuId} liste={liste} label={label} farbe={farbe} mehrfach
          gewaehlt={wert} vorschlaege={vorschlaege} entfernen={false} fuss={fuss}
          neu={onNeu ? { min: neuMin, max: neuMax, anlegen: onNeu } : undefined}
          onWert={umschalten} onEntfernen={() => undefined} onSchliessen={schliessen} />
      )}
    </span>
  );
}

// ── Das Menü ─────────────────────────────────────────────────────────────────
type Eintrag<T extends string> = { art: 'wert'; e: WahlEintrag<T> } | { art: 'entfernen' } | { art: 'neu' } | { art: 'anlegen'; text: string };

function WahlMenue<T extends string>({ anker, menuId, liste, label, farbe, gewaehlt, vorschlaege, entfernen, leerenLabel = 'entfernen', mehrfach, neu, fuss, onWert, onEntfernen, onSchliessen }: {
  anker: HTMLElement; menuId: string; liste: readonly WahlEintrag<T>[]; label: string; farbe: string;
  gewaehlt: readonly T[]; vorschlaege: readonly WahlVorschlag<T>[]; entfernen: boolean; leerenLabel?: string; mehrfach?: boolean;
  /** Neu anlegen (mit `onNeu` — Einzel- und seit 28.09. auch Mehrfachwahl). */
  neu?: { min: number; max: number; anlegen: (text: string) => Promise<T | null> };
  fuss?: ReactNode;
  onWert: (id: T) => void; onEntfernen: () => void; onSchliessen: (fokus: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const suchfeld = useRef<HTMLInputElement>(null);
  // Mit „neu“ immer ein Suchfeld — es ist zugleich das Namensfeld für den neuen Wert.
  const mitSuche = liste.length >= SUCHE_AB_WAHL || !!neu;
  const [suche, setSuche] = useState('');
  const [blatt, setBlatt] = useState(false);
  const [lage, setLage] = useState<{ top: number; left: number; maxHoehe: number } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const gefiltert = useMemo(() => wahlFiltern(liste, suche), [liste, suche]);
  const eintraege: Eintrag<T>[] = useMemo(() => {
    const zeile = neu ? anlegenZeile(liste, suche) : null;
    return [
      ...gefiltert.map(e => ({ art: 'wert' as const, e })),
      ...(entfernen && !suche.trim() ? [{ art: 'entfernen' as const }] : []),
      ...(zeile ? [zeile] : []),
    ];
  }, [gefiltert, entfernen, suche, neu, liste]);
  const [aktiv, setAktiv] = useState(() => startIndex(liste, gewaehlt, vorschlaege[0]?.id));
  useEffect(() => { setAktiv(i => (suche ? (eintraege.length ? 0 : -1) : i)); setFehler(null); }, [suche, eintraege.length]);

  /** Neuen Wert anlegen und wählen — Länge vorher prüfen, Fehler im Menü zeigen. */
  const anlegen = async (text: string) => {
    if (!neu || laeuft) return;
    const p = neuPruefen(text, label, neu.min, neu.max);
    if (!p.ok) { setFehler(p.fehler); return; }
    setLaeuft(true); setFehler(null);
    let fertig: T | null = null;
    try {
      fertig = await neu.anlegen(p.wert);
      if (fertig == null) setFehler(`${label} „${p.wert}“ nicht angelegt — bitte noch einmal versuchen.`);
    } catch (e) {
      setFehler(e instanceof Error && e.message ? e.message : `${label} „${p.wert}“ nicht angelegt.`);
    }
    setLaeuft(false);
    if (fertig != null) onWert(fertig);
  };

  // Lage: am Chip, im Fenster; am Handy als Blatt. Beim Scrollen und bei Größenänderung neu.
  useLayoutEffect(() => {
    const legen = () => {
      const schmal = window.innerWidth <= ALS_BLATT_BIS;
      setBlatt(schmal);
      if (schmal || !box.current) { setLage(null); return; }
      const r = anker.getBoundingClientRect();
      const l = menuLage({ top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width }, { breite: box.current.offsetWidth, hoehe: box.current.scrollHeight }, { breite: window.innerWidth, hoehe: window.innerHeight });
      setLage({ top: l.top, left: l.left, maxHoehe: l.maxHoehe });
    };
    legen();
    window.addEventListener('resize', legen);
    window.addEventListener('scroll', legen, true);
    return () => { window.removeEventListener('resize', legen); window.removeEventListener('scroll', legen, true); };
  }, [anker, eintraege.length]);

  // Fokus einmal ins Menü (Suchfeld oder Liste); Klick daneben schließt ohne Fokus-Sprung.
  const schliessenRef = useRef(onSchliessen);
  useEffect(() => { schliessenRef.current = onSchliessen; }, [onSchliessen]);
  useEffect(() => {
    // Direkt nach dem Einhängen (kein requestAnimationFrame — der ruht in Hintergrund-Tabs).
    const t = setTimeout(() => (mitSuche ? suchfeld.current : listeRef.current)?.focus({ preventScroll: true }), 0);
    const daneben = (e: PointerEvent) => {
      const z = e.target as Node;
      if (box.current?.contains(z) || anker.contains(z)) return;
      schliessenRef.current(false);
    };
    document.addEventListener('pointerdown', daneben, true);
    return () => { clearTimeout(t); document.removeEventListener('pointerdown', daneben, true); };
  }, [anker, mitSuche]);

  // Der aktive Eintrag bleibt sichtbar.
  useEffect(() => { listeRef.current?.querySelector(`#${menuId}-o-${aktiv}`)?.scrollIntoView({ block: 'nearest' }); }, [aktiv, menuId]);

  const waehle = (i: number) => {
    const x = eintraege[i];
    if (!x) return;
    if (x.art === 'entfernen') onEntfernen();
    else if (x.art === 'neu') { setFehler(null); suchfeld.current?.focus(); }
    else if (x.art === 'anlegen') void anlegen(x.text);
    else onWert(x.e.id);
  };
  const taste = (e: TastenEreignis) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (suche) setSuche(''); else onSchliessen(true); return; }
    if (e.key === 'Tab') { e.preventDefault(); onSchliessen(true); return; }
    if (istWahlTaste(e.key)) { e.preventDefault(); e.stopPropagation(); setAktiv(i => naechsterIndex(i, eintraege.length, e.key as Parameters<typeof naechsterIndex>[2])); return; }
    if (e.key === 'Enter' || (e.key === ' ' && !mitSuche)) { e.preventDefault(); e.stopPropagation(); waehle(aktiv); return; }
    // Ohne Suchfeld: ein Buchstabe springt zum nächsten Wert, der so beginnt.
    if (!mitSuche && e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const b = normiere(e.key);
      const n = eintraege.length;
      for (let s = 1; s <= n; s++) {
        const j = (aktiv + s + n) % n;
        const x = eintraege[j];
        if (x.art === 'wert' && normiere(x.e.label).startsWith(b)) { setAktiv(j); break; }
      }
    }
  };

  const vorschlagIds = new Set(vorschlaege.map(v => v.id));
  const stil: CSSProperties = blatt
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '72vh', borderRadius: '16px 16px 0 0', padding: '10px 10px calc(12px + env(safe-area-inset-bottom))' }
    : { position: 'fixed', top: lage?.top ?? -9999, left: lage?.left ?? -9999, minWidth: Math.max(200, anker.offsetWidth), maxWidth: 'min(340px, calc(100vw - 16px))', maxHeight: lage?.maxHoehe ?? 360, borderRadius: 12, padding: 6, visibility: lage ? 'visible' : 'hidden' };

  const inhalt = (
    <>
      <style>{MENUE_CSS}</style>
      {blatt && <div aria-hidden className="wahl-hinter" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000 }} />}
      <div ref={box} data-wahl-menue onKeyDown={taste} className={blatt ? 'wahl-blatt' : 'wahl-menue'}
        style={{ ...stil, zIndex: 2001, display: 'flex', flexDirection: 'column', gap: 4, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 48px rgba(0,0,0,.55), 0 2px 8px rgba(0,0,0,.35)', color: C.ink, fontFamily: SCHRIFT.text, overflow: 'hidden' }}>
        {blatt && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 6px 6px' }}>
            <span style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise }}>{label}</span>
            <button type="button" onClick={() => onSchliessen(true)} aria-label="Schließen" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 18, minWidth: 36, minHeight: 36 }}>×</button>
          </div>
        )}
        {vorschlaege.length > 0 && !suche && (
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px 8px 2px', lineHeight: 1.4 }}>
            {vorschlaege.map(v => <div key={v.id}>Vorschlag: <span style={{ color: farbe, fontWeight: 600 }}>{wahlLabel(liste, v.id)}</span> — {v.grund}</div>)}
          </div>
        )}
        {mitSuche && (
          <input ref={suchfeld} value={suche} onChange={e => setSuche(e.target.value)} placeholder={neu ? (label.length <= 14 ? `${label} suchen oder neu …` : 'Suchen oder neu …') : `${label} suchen …`} aria-label={neu ? `${label} suchen oder neu anlegen` : `${label} suchen`} aria-busy={laeuft || undefined}
            aria-controls={`${menuId}`} aria-activedescendant={aktiv >= 0 ? `${menuId}-o-${aktiv}` : undefined} autoComplete="off"
            style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 9, padding: '8px 10px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, outline: 'none' }} />
        )}
        <div ref={listeRef} id={menuId} role="listbox" aria-label={label} aria-multiselectable={mehrfach || undefined} tabIndex={mitSuche ? -1 : 0}
          aria-activedescendant={!mitSuche && aktiv >= 0 ? `${menuId}-o-${aktiv}` : undefined}
          style={{ overflowY: 'auto', display: 'grid', gap: 1, outline: 'none', minHeight: 0, scrollbarWidth: 'thin' }}>
          {eintraege.map((x, i) => {
            const an = i === aktiv;
            if (x.art === 'entfernen') {
              return (
                <div key="__entfernen" id={`${menuId}-o-${i}`} role="option" aria-selected={false} className="wahl-option" data-aktiv={an}
                  onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAktiv(i)} onClick={() => waehle(i)}
                  style={{ ...zeileStil(blatt), color: C.inkLeise, borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 3, paddingTop: blatt ? 12 : 8 }}>
                  <span style={{ width: 16, textAlign: 'center' }} aria-hidden>–</span>{leerenLabel}
                </div>
              );
            }
            if (x.art === 'neu' || x.art === 'anlegen') {
              return (
                <div key="__neu" id={`${menuId}-o-${i}`} role="option" aria-selected={false} aria-disabled={laeuft || undefined} className="wahl-option" data-aktiv={an} data-wahl-neu
                  onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAktiv(i)} onClick={() => waehle(i)}
                  style={{ ...zeileStil(blatt), color: C.aktiv, fontWeight: 600, borderTop: '1px solid rgba(255,255,255,.06)', marginTop: 3, paddingTop: blatt ? 12 : 8, cursor: laeuft ? 'wait' : 'pointer' }}>
                  <span style={{ width: 16, textAlign: 'center' }} aria-hidden>+</span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {x.art === 'neu' ? 'neu …' : laeuft ? `legt „${x.text}“ an …` : <>„{x.text}“ anlegen</>}
                  </span>
                  {x.art === 'anlegen' && !laeuft && <span style={{ fontSize: 12, color: C.inkLeise, fontWeight: 500 }}>Enter</span>}
                </div>
              );
            }
            const gew = gewaehlt.includes(x.e.id);
            return (
              <div key={x.e.id} id={`${menuId}-o-${i}`} role="option" aria-selected={gew} className="wahl-option" data-aktiv={an}
                onMouseDown={e => e.preventDefault()} onMouseEnter={() => setAktiv(i)} onClick={() => waehle(i)}
                style={{ ...zeileStil(blatt), color: gew ? farbe : C.ink, fontWeight: gew ? 600 : 500 }}>
                <span aria-hidden style={{ width: 16, textAlign: 'center', color: farbe }}>{gew ? '✓' : ''}</span>
                {x.e.punkt && <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: x.e.punkt, flex: '0 0 auto' }} />}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.e.label}</span>
                {vorschlagIds.has(x.e.id) && <span style={{ fontSize: 12, color: farbe, border: `1px dashed ${farbe}88`, borderRadius: 999, padding: '0 6px' }}>Vorschlag</span>}
                {x.e.hinweis && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, whiteSpace: 'nowrap' }}>{x.e.hinweis}</span>}
              </div>
            );
          })}
          {!eintraege.length && <div style={{ padding: '8px 10px', fontSize: TYP.bedien, color: C.inkLeise }}>Nichts passt zu „{suche}“.</div>}
        </div>
        {fehler && <div role="alert" style={{ padding: '4px 10px 2px', fontSize: TYP.bedien, color: LEUCHT.kritisch, lineHeight: 1.4 }}>{fehler}</div>}
        {fuss && (
          <div onClick={() => onSchliessen(false)} style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '4px 8px 2px', borderTop: '1px solid rgba(255,255,255,.06)', fontSize: TYP.bedien }}>{fuss}</div>
        )}
        {mehrfach && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 4px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <button type="button" onClick={() => onSchliessen(true)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600, fontFamily: SCHRIFT.text, padding: '6px 8px', minHeight: 32 }}>fertig</button>
          </div>
        )}
      </div>
    </>
  );
  return createPortal(inhalt, document.body);
}

const zeileStil = (blatt: boolean): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 8, padding: blatt ? '12px 10px' : '7px 10px', minHeight: blatt ? 44 : 32, borderRadius: 8, cursor: 'pointer', fontSize: TYP.bedien, userSelect: 'none',
});

const MENUE_CSS = `
@keyframes wahlAuf { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
@keyframes wahlBlatt { from { transform: translateY(100%); } to { transform: none; } }
@keyframes wahlHinter { from { opacity: 0; } to { opacity: 1; } }
.wahl-menue { animation: wahlAuf .14s cubic-bezier(.22,1,.36,1) both; }
.wahl-blatt { animation: wahlBlatt .22s cubic-bezier(.22,1,.36,1) both; }
.wahl-hinter { animation: wahlHinter .2s ease both; }
.wahl-option[data-aktiv="true"] { background: rgba(255,255,255,.08); }
[data-wahl-menue] [role="listbox"]:focus-visible { outline: none; box-shadow: none; }
[data-wahl-menue] [role="listbox"]:focus-visible .wahl-option[data-aktiv="true"] { outline: 2px solid var(--fokus, #58D9CD); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .wahl-menue, .wahl-blatt, .wahl-hinter { animation: none; } }
`;
