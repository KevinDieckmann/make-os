'use client';

// ─── Standard · Menü „⋯“ einer Listenzeile (10.10., DESIGN_STANDARD.md › Zeilen-Aktionen) ─────────────────────────────────────
// EINE Menü-Mechanik für jede Liste (vorher: Rand-Knöpfe über dem Inhalt + ein eigenes Aufgaben-Menü). Aufbau immer gleich:
//   1. Allgemeines, das der Baustein selbst kann: Öffnen · Link kopieren · In neuem Tab öffnen (nur interne Wege über WEG)
//   2. Einträge der Liste (`mehr`): Bearbeiten, Duplizieren, Zuständig, Wiedervorlage, Umwandeln, Verschieben nach … (mit Auswahl)
//   ── Trennlinie ──
//   3. Archivieren bzw. Zurückholen · Löschen (Papierkorb, Achtung-Farbe) — immer unten.
// Rechner: Menü am Knopf (unten bzw. oben, wenn unten kein Platz ist); Handy: Blatt von unten. Beides über ein Portal (die Zeile schneidet
// sonst ab, `.ui-za-bahn`). Tastatur: Pfeiltasten/Pos1/Ende wandern, Enter/Leertaste wählt, Escape oder Tab schließt — danach hat „⋯“
// wieder den Fokus. Rolle `menu`/`menuitem`, Trenner `separator`.

import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as RKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, Link2, ExternalLink, Archive, ArchiveRestore, Trash2, ChevronLeft } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, RAND, ECKE, ZIEL, BEDEUTUNG_FARBE, FLAECHE_STIL } from '@/lib/make-one/design';
import { internerWeg, type MenueGruppe } from '@/lib/make-one/bedienung';
import { normiere } from '@/lib/crm/wahl';

/** Eine Auswahl hinter einem Menüpunkt (Liste, Elternteil, Farbe …) — mit Suche ab 7 Einträgen. */
export interface ZeilenAuswahl { titel: string; eintraege: { id: string; label: string; hinweis?: string; punkt?: string }[]; waehlen: (id: string) => void; leer?: string }

/** Ein Eintrag der Liste im Menü (zwischen Allgemeinem und Archiv/Löschen). */
export interface ZeilenMehr {
  id: string;
  label: string;
  symbol?: ReactNode;
  /** Direkt ausführen … */
  tun?: () => unknown;
  /** … oder erst wählen (Liste, Elternteil, Person). */
  auswahl?: ZeilenAuswahl;
  /** Kurz erklärt (unter dem Punkt). */
  hinweis?: string;
  /** Achtung-Farbe (endgültig, verwerfen). */
  gefahr?: boolean;
  /** Gerade nicht möglich — steht grau da, mit `grund`. */
  deaktiviert?: boolean;
  grund?: string;
}

/** Ein fertiger Menüpunkt (Ergebnis von `zeilenMenueEintraege`). */
export interface MenueEintrag {
  id: string;
  gruppe: MenueGruppe;
  label: string;
  symbol?: ReactNode;
  hinweis?: string;
  gefahr?: boolean;
  deaktiviert?: boolean;
  grund?: string;
  tun?: () => unknown;
  auswahl?: ZeilenAuswahl;
  /** Interner Weg (Öffnen ohne eigene Funktion, In neuem Tab). */
  href?: string;
  neuerTab?: boolean;
}

export interface ZeilenMenueQuelle {
  titel: string;
  onOeffnen?: () => unknown;
  href?: string;
  mehr?: readonly ZeilenMehr[];
  onArchivieren?: () => unknown;
  onLoeschen?: () => unknown;
  archiviert?: boolean;
  /** Ohne Recht gibt es keinen Eintrag (Rechte entscheidet trotzdem der Server). */
  darf?: boolean;
  /** „Link kopieren“ — der Baustein reicht seine Kopierfunktion herein (mit Rückmeldung). */
  kopieren?: (href: string) => unknown;
}

const S = 18;

/** Baut das Menü in der festen Reihenfolge (rein, getestet): Allgemeines · Einträge der Liste · Archiv/Löschen (unten). */
export function zeilenMenueEintraege(q: ZeilenMenueQuelle): MenueEintrag[] {
  if (q.darf === false) return [];
  const weg = internerWeg(q.href) ? q.href : undefined;
  const l: MenueEintrag[] = [];
  if (q.onOeffnen) l.push({ id: 'oeffnen', gruppe: 'allgemein', label: 'Öffnen', symbol: <ArrowRight size={S} aria-hidden />, tun: q.onOeffnen });
  else if (weg) l.push({ id: 'oeffnen', gruppe: 'allgemein', label: 'Öffnen', symbol: <ArrowRight size={S} aria-hidden />, href: weg });
  if (weg && q.kopieren) { const k = q.kopieren; l.push({ id: 'link', gruppe: 'allgemein', label: 'Link kopieren', symbol: <Link2 size={S} aria-hidden />, tun: () => k(weg) }); }
  if (weg) l.push({ id: 'tab', gruppe: 'allgemein', label: 'In neuem Tab öffnen', symbol: <ExternalLink size={S} aria-hidden />, href: weg, neuerTab: true });
  const gesehen = new Set(l.map(e => e.id));
  for (const m of q.mehr ?? []) {
    if ((!m.tun && !m.auswahl) || gesehen.has(m.id)) continue;
    gesehen.add(m.id);
    l.push({ ...m, gruppe: 'mehr' });
  }
  if (q.onArchivieren) l.push(q.archiviert
    ? { id: 'archiv', gruppe: 'ablage', label: 'Zurückholen', hinweis: 'aus dem Archiv', symbol: <ArchiveRestore size={S} aria-hidden />, tun: q.onArchivieren }
    : { id: 'archiv', gruppe: 'ablage', label: 'Archivieren', symbol: <Archive size={S} aria-hidden />, tun: q.onArchivieren });
  if (q.onLoeschen) l.push({ id: 'loeschen', gruppe: 'ablage', label: 'Löschen', hinweis: 'in den Papierkorb', gefahr: true, symbol: <Trash2 size={S} aria-hidden />, tun: q.onLoeschen });
  return l;
}

const punktStil: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', background: 'none', border: 'none', borderRadius: ECKE.eingabe,
  padding: '8px 12px', minHeight: ZIEL.handy, boxSizing: 'border-box', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien,
  color: C.ink, textDecoration: 'none',
};

function PunktInhalt({ e }: { e: MenueEintrag }) {
  const unter = e.deaktiviert && e.grund ? e.grund : e.hinweis;
  return <>
    <span aria-hidden style={{ width: S, display: 'inline-flex', flex: '0 0 auto', justifyContent: 'center', color: e.gefahr ? BEDEUTUNG_FARBE.kritisch : C.inkDim }}>{e.symbol}</span>
    <span style={{ display: 'grid', gap: 1, minWidth: 0 }}>
      <span style={{ fontWeight: 600 }}>{e.label}{e.auswahl ? ' …' : ''}</span>
      {unter && <span style={{ color: C.inkLeise, fontSize: TYP.bedien, fontWeight: 400 }}>{unter}</span>}
    </span>
  </>;
}

/**
 * Die Punkte selbst (ohne Portal, ohne Lage) — auch für die Wächter (Reihenfolge, Gefahr unten). Trennlinie vor jeder neuen Gruppe.
 * `onWahl` bekommt den gewählten Punkt (Links navigieren selbst und melden nur „gewählt“).
 */
export function MenueListe({ eintraege, onWahl }: { eintraege: readonly MenueEintrag[]; onWahl: (e: MenueEintrag) => void }) {
  return <>
    {eintraege.map((e, i) => {
      const trenner = i > 0 && eintraege[i - 1].gruppe !== e.gruppe
        ? <div role="separator" aria-hidden className="ui-zm-trenner" style={{ height: 1, margin: '4px 8px', background: RAND.stark }} />
        : null;
      const stil: CSSProperties = { ...punktStil, color: e.deaktiviert ? C.inkLeise : e.gefahr ? BEDEUTUNG_FARBE.kritisch : C.ink, cursor: e.deaktiviert ? 'default' : 'pointer' };
      const gemeinsam = { role: 'menuitem' as const, 'data-menue-punkt': e.id, 'data-gruppe': e.gruppe, 'aria-disabled': e.deaktiviert || undefined, className: 'fassbar ui-zm-punkt', style: stil, tabIndex: -1 };
      const punkt = e.href && !e.deaktiviert
        ? <Link href={e.href} {...gemeinsam} {...(e.neuerTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})} onClick={() => onWahl(e)}><PunktInhalt e={e} /></Link>
        : <button type="button" {...gemeinsam} onClick={() => { if (!e.deaktiviert) onWahl(e); }}><PunktInhalt e={e} /></button>;
      return <Fragment key={e.id}>{trenner}{punkt}</Fragment>;
    })}
  </>;
}

/** Fokus zwischen den Punkten wandern lassen (Pfeiltasten, Pos1, Ende). */
function wandern(container: HTMLElement | null, e: RKeyboardEvent): boolean {
  if (!container) return false;
  const punkte = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  if (!punkte.length) return false;
  const i = punkte.indexOf(document.activeElement as HTMLElement);
  let ziel = -1;
  if (e.key === 'ArrowDown') ziel = i < 0 ? 0 : (i + 1) % punkte.length;
  else if (e.key === 'ArrowUp') ziel = i < 0 ? punkte.length - 1 : (i - 1 + punkte.length) % punkte.length;
  else if (e.key === 'Home') ziel = 0;
  else if (e.key === 'End') ziel = punkte.length - 1;
  if (ziel < 0) return false;
  punkte[ziel].focus();
  return true;
}

/**
 * Das offene Menü (Portal). `anker` = Lage des Knopfs „⋯“ (Rechner); `blatt` = Handy (Blatt von unten). `onZu(fokus)` schließt —
 * mit `fokus` bekommt „⋯“ den Fokus zurück. Ein Punkt mit `auswahl` zeigt erst die Unterliste (zurück mit „‹“ oder Escape).
 */
export function ZeilenMenueFenster({ id, titel, eintraege, anker, blatt, knopf, onZu, onWahl }: {
  id: string; titel: string; eintraege: readonly MenueEintrag[]; anker: DOMRect | null; blatt: boolean;
  knopf: HTMLElement | null; onZu: (fokus: boolean) => void; onWahl: (e: MenueEintrag) => void;
}) {
  const [wahl, setWahl] = useState<ZeilenAuswahl | null>(null);
  const [suche, setSuche] = useState('');
  const menue = useRef<HTMLDivElement>(null);
  const zu = useRef(onZu);
  zu.current = onZu;

  // Daneben tippen (Rechner), Scrollen der Seite oder Größe ändern schließt; am Handy schließt der dunkle Grund.
  useEffect(() => {
    const daneben = (e: PointerEvent) => { if (!blatt && !menue.current?.contains(e.target as Node) && !knopf?.contains(e.target as Node)) zu.current(false); };
    const rollen = (e: Event) => { if (!blatt && !menue.current?.contains(e.target as Node)) zu.current(false); };
    const groesse = () => zu.current(false);
    document.addEventListener('pointerdown', daneben, true);
    window.addEventListener('scroll', rollen, true);
    window.addEventListener('resize', groesse);
    return () => { document.removeEventListener('pointerdown', daneben, true); window.removeEventListener('scroll', rollen, true); window.removeEventListener('resize', groesse); };
  }, [blatt, knopf]);
  // Beim Öffnen und nach jedem Wechsel der Ansicht: Fokus auf das Suchfeld bzw. den ersten Punkt.
  useEffect(() => {
    const t = setTimeout(() => menue.current?.querySelector<HTMLElement>('input, [role="menuitem"]:not([aria-disabled="true"]), [role="menuitem"]')?.focus(), 0);
    return () => clearTimeout(t);
  }, [wahl]);

  const taste = (e: RKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (wahl) { setWahl(null); setSuche(''); } else zu.current(true); return; }
    if (e.key === 'Tab') { e.preventDefault(); zu.current(true); return; }
    if ((e.target as HTMLElement).tagName === 'INPUT' && (e.key === 'Home' || e.key === 'End')) return;
    if (wandern(menue.current, e)) e.preventDefault();
  };

  const hoehe = Math.min(420, 12 + eintraege.length * 50);
  const unten = !anker || typeof window === 'undefined' || anker.bottom + hoehe + 8 < window.innerHeight;
  const lage: CSSProperties = blatt || !anker
    ? { position: 'fixed', left: 8, right: 8, bottom: 'calc(8px + env(safe-area-inset-bottom))', maxHeight: '75vh' }
    : { position: 'fixed', right: Math.max(8, window.innerWidth - anker.right), width: 288, maxHeight: 420, ...(unten ? { top: anker.bottom + 4 } : { bottom: window.innerHeight - anker.top + 4 }) };
  const treffer = wahl ? wahl.eintraege.filter(x => !suche.trim() || normiere(`${x.label} ${x.hinweis ?? ''}`).includes(normiere(suche))) : [];
  const waehlen = (e: MenueEintrag) => {
    if (e.auswahl) { setWahl(e.auswahl); setSuche(''); return; }
    onWahl(e);
  };

  const inhalt = (
    <>
      {blatt && <div className="ui-zm-grund" aria-hidden onClick={() => zu.current(false)} />}
      <div ref={menue} role="menu" id={id} aria-label={wahl ? wahl.titel : `Aktionen für „${titel}“`} onKeyDown={taste} onClick={e => e.stopPropagation()}
        className={`ui-zm${blatt ? ' ui-zm-blatt' : ''}`}
        style={{ ...lage, zIndex: 9990, overflowY: 'auto', display: 'grid', alignContent: 'start', gap: 2, padding: 6, borderRadius: ECKE.flach, background: C.flaecheHoch, border: `1px solid ${RAND.stark}`, boxSizing: 'border-box' }}>
        {blatt && !wahl && <div aria-hidden style={{ padding: '6px 12px 4px', fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</div>}
        {!wahl && <MenueListe eintraege={eintraege} onWahl={waehlen} />}
        {wahl && <>
          <button type="button" role="menuitem" tabIndex={-1} onClick={() => { setWahl(null); setSuche(''); }} className="fassbar ui-zm-punkt" style={{ ...punktStil, color: C.inkDim }}>
            <ChevronLeft size={16} aria-hidden /> <span style={{ fontWeight: 700 }}>{wahl.titel}</span>
          </button>
          {wahl.eintraege.length > 6 && (
            <input value={suche} onChange={e => setSuche(e.target.value)} aria-label={`${wahl.titel}: suchen`} placeholder="suchen …" className="ui-zm-suche"
              style={{ margin: '2px 4px 6px', padding: '8px 12px', minHeight: ZIEL.handy, borderRadius: ECKE.eingabe, ...FLAECHE_STIL.eingabe, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16 }} />
          )}
          {treffer.map(x => (
            <button key={x.id} type="button" role="menuitem" tabIndex={-1} className="fassbar ui-zm-punkt" style={{ ...punktStil, display: 'grid', gap: 2 }} onClick={() => { const w = wahl; zu.current(true); w.waehlen(x.id); }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {x.punkt && <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: x.punkt, flex: '0 0 auto' }} />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.label}</span>
              </span>
              {x.hinweis && <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{x.hinweis}</span>}
            </button>
          ))}
          {!treffer.length && <span style={{ padding: '8px 12px', color: C.inkLeise, fontSize: TYP.bedien }}>{wahl.eintraege.length ? 'Nichts gefunden.' : wahl.leer ?? 'Hier passt nichts.'}</span>}
        </>}
        {blatt && <button type="button" onClick={() => zu.current(true)} className="fassbar" style={{ ...punktStil, justifyContent: 'center', color: C.inkDim, marginTop: 4, borderTop: `1px solid ${RAND.haar}`, borderRadius: 0 }}>Schließen</button>}
      </div>
    </>
  );
  return typeof document === 'undefined' ? null : createPortal(inhalt, document.body);
}
