'use client';

// ─── Netzwerken — Bausteine für Daumen und kleine Bildschirme (02.10.) ───────
// Alles hier ist für das iPhone gebaut: Ziele mindestens 48 px hoch, Eingabefelder mit 16 px Schrift (kleiner zoomt iOS
// beim Antippen die Seite auf), Knöpfe über die ganze Breite. Farben und Schrift aus lib/make-one/design.ts.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';

export const ZIEL = 48;

export const eingabe: CSSProperties = {
  width: '100%', minHeight: ZIEL, boxSizing: 'border-box', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12,
  padding: '12px 14px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16, outline: 'none', WebkitAppearance: 'none', appearance: 'none',
};

/** Großer Knopf über die ganze Breite. `ton`: Hauptaktion getönt, sonst leise. */
export function Gross({ children, onClick, ton = 'leise', aus, href, kleinerAbstand, titel }: { children: ReactNode; onClick?: () => void; ton?: 'haupt' | 'leise' | 'gut' | 'warn'; aus?: boolean; href?: string; kleinerAbstand?: boolean; titel?: string }) {
  const f = ton === 'gut' ? LEUCHT.gut : ton === 'warn' ? LEUCHT.achtung : C.aktiv;
  const stil: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: ZIEL + (kleinerAbstand ? 0 : 4), boxSizing: 'border-box', padding: '12px 16px', borderRadius: 14,
    fontFamily: SCHRIFT.text, fontSize: 16, fontWeight: 700, textAlign: 'center', textDecoration: 'none', cursor: aus ? 'default' : 'pointer',
    ...(aus ? { border: '1px solid transparent', background: 'rgba(255,255,255,.08)', color: C.inkLeise } : ton === 'leise' ? { border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', color: C.ink } : TIEF.knopf(f)),
  };
  if (href && !aus) return <a href={href} onClick={onClick} className="fassbar" style={stil} title={titel}>{children}</a>;
  return <button type="button" onClick={aus ? undefined : onClick} disabled={aus} className="fassbar" style={stil} title={titel}>{children}</button>;
}

/** Wahl-Chip (ein Wert aus mehreren) — mindestens 48 px hoch. */
export function Wahl({ an, onClick, children, farbe = C.aktiv, klein }: { an: boolean; onClick: () => void; children: ReactNode; farbe?: string; klein?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={an} className="fassbar" style={{
      minHeight: klein ? 40 : ZIEL, padding: klein ? '8px 14px' : '10px 16px', borderRadius: 14, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: klein ? 14 : 15, fontWeight: 600, lineHeight: 1.25, textAlign: 'center',
      border: `1px solid ${an ? TIEF.rand(farbe) : 'rgba(255,255,255,.1)'}`, background: an ? TIEF.flaeche(farbe) : 'rgba(255,255,255,.04)', color: an ? farbe : C.ink,
    }}>{children}</button>
  );
}

export function Beschriftung({ children, rechts }: { children: ReactNode; rechts?: ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: C.inkLeise, margin: '2px 0 6px' }}><span>{children}</span>{rechts && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{rechts}</span>}</div>;
}

export function Feldzeile({ label, children, fehler }: { label: string; children: ReactNode; fehler?: string }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>{label}</span>
      {children}
      {fehler && <span role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.4 }}>{fehler}</span>}
    </label>
  );
}

/** Hinweiskarte (gelb/grün/rot/neutral) — Text immer in Satzform, nie ein Kürzel. */
export function Hinweis({ farbe = C.inkDim, children, rolle }: { farbe?: string; children: ReactNode; rolle?: 'alert' | 'status' }) {
  return <div role={rolle} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${farbe === C.inkDim ? 'rgba(255,255,255,.08)' : TIEF.rand(farbe)}`, background: farbe === C.inkDim ? 'rgba(255,255,255,.03)' : TIEF.flaeche(farbe), color: C.ink, fontSize: TYP.body, lineHeight: 1.5 }}>{children}</div>;
}

/** Wert im Browser merken (localStorage nur als Komfort — fehlt es oder wirft es, läuft alles ohne). */
export function useGemerkt<T>(schluessel: string, start: T): [T, (v: T) => void] {
  const [wert, setWert] = useState<T>(start);
  useEffect(() => {
    try { const roh = window.localStorage.getItem(schluessel); if (roh) setWert(JSON.parse(roh) as T); } catch { /* ohne Speicher */ }
  }, [schluessel]);
  const setze = (v: T) => { setWert(v); try { window.localStorage.setItem(schluessel, JSON.stringify(v)); } catch { /* ohne Speicher */ } };
  return [wert, setze];
}

export const kopfStil: CSSProperties = { fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2, margin: 0, color: C.ink };

/** „Fr 02.10.“ aus einem Tag. */
export const tagText = (tag: string): string => `${['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${tag}T12:00:00Z`).getUTCDay()]} ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`;

/** Kreis mit den Anfangsbuchstaben einer Person — tiefer Akzent statt Neon (Rezept TIEF). */
export function Initialen({ name, farbe = LEUCHT.beziehung, groesse = 40 }: { name: string; farbe?: string; groesse?: number }) {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  const kuerzel = ((teile[0]?.[0] ?? '?') + (teile.length > 1 ? teile[teile.length - 1][0] : '')).toUpperCase();
  return <span aria-hidden style={{ width: groesse, height: groesse, borderRadius: groesse / 2, flex: '0 0 auto', display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: groesse > 36 ? 15 : 13, fontWeight: 700, color: farbe, background: TIEF.flaeche(farbe), border: `1px solid ${TIEF.rand(farbe)}` }}>{kuerzel}</span>;
}

/** Fortschritt in Schritten: Kreise mit Nummer bzw. Haken, dazwischen eine Linie, die sich beim Weitergehen füllt. */
export function Fortschritt({ punkte, nr }: { punkte: readonly string[]; nr: number }) {
  return (
    <ol aria-label="Fortschritt" style={{ display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
      {punkte.map((p, i) => {
        const fertig = i < nr, jetzt = i === nr;
        return (
          <li key={p} aria-current={jetzt ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < punkte.length - 1 ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
              <span aria-hidden style={{ width: 24, height: 24, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: TYP.bedien, fontWeight: 700, fontVariantNumeric: 'tabular-nums', transition: 'background .25s ease, border-color .25s ease, color .25s ease',
                color: jetzt ? C.aktiv : fertig ? C.grund : C.inkLeise, background: fertig ? C.aktiv : jetzt ? C.aktivSanft : 'transparent', border: `1.5px solid ${fertig || jetzt ? C.aktiv : 'rgba(255,255,255,.16)'}` }}>
                {fertig ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span style={{ fontSize: TYP.bedien, fontWeight: jetzt ? 700 : 600, color: jetzt ? C.ink : fertig ? C.inkDim : C.inkLeise, whiteSpace: 'nowrap' }}><span className="sr-only">{i + 1} · </span>{p}</span>
            </span>
            {i < punkte.length - 1 && <span aria-hidden style={{ flex: 1, height: 2, borderRadius: 1, minWidth: 8, background: fertig ? C.aktiv : 'rgba(255,255,255,.09)', transition: 'background .3s ease' }} />}
          </li>
        );
      })}
    </ol>
  );
}

/** Die Hauptaktion des Schritts: am Handy unten mitlaufend (globals.css › .netz-aktion), sonst ganz normal am Ende. */
export function Aktionsleiste({ children }: { children: ReactNode }) {
  return <div className="netz-aktion">{children}</div>;
}

/** Freundlicher leerer Zustand: Symbol, ein Satz, was jetzt zu tun ist — und ein Weg dorthin. */
export function Leerzustand({ symbol, titel, children, aktion }: { symbol: ReactNode; titel: string; children: ReactNode; aktion?: ReactNode }) {
  return (
    <section style={{ display: 'grid', justifyItems: 'center', gap: 10, textAlign: 'center', padding: '28px 18px 22px', borderRadius: 18, border: '1px dashed rgba(255,255,255,.14)', background: 'rgba(255,255,255,.025)' }}>
      <span aria-hidden style={{ width: 56, height: 56, borderRadius: 28, display: 'grid', placeItems: 'center', color: C.aktiv, background: C.aktivSanft, border: `1px solid ${TIEF.rand(C.aktiv)}` }}>{symbol}</span>
      <h2 style={{ ...kopfStil, fontSize: TYP.titel }}>{titel}</h2>
      <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5, maxWidth: 360 }}>{children}</div>
      {aktion && <div style={{ width: '100%', maxWidth: 360, marginTop: 4 }}>{aktion}</div>}
    </section>
  );
}

export interface LinkChip { label: string; href: string }
/** Eine Zeile kleiner Verknüpfungen (Kontakt · Termin · Deal · Follow-up · Event) — Chips mit Ziel ≥ 44 px, leer = nichts. */
export function LinkChips({ links }: { links: readonly LinkChip[] }) {
  if (!links.length) return null;
  return (
    <ul aria-label="Verknüpfungen" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: 0, padding: 0, listStyle: 'none' }}>
      {links.map(l => (
        <li key={`${l.label}|${l.href}`}>
          <Link href={l.href} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 14px', borderRadius: 999, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, color: C.ink, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)' }}>{l.label} ›</Link>
        </li>
      ))}
    </ul>
  );
}
