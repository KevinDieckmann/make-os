'use client';

// ─── Netzwerken — Bausteine für Daumen und kleine Bildschirme (02.10.) ───────
// Alles hier ist für das iPhone gebaut: Ziele mindestens 48 px hoch, Eingabefelder mit 16 px Schrift (kleiner zoomt iOS
// beim Antippen die Seite auf), Knöpfe über die ganze Breite. Farben und Schrift aus lib/make-one/design.ts.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
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
  return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: C.inkLeise, margin: '2px 0 6px' }}><span>{children}</span>{rechts && <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{rechts}</span>}</div>;
}

export function Feldzeile({ label, children, fehler }: { label: string; children: ReactNode; fehler?: string }) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ fontSize: 13, color: C.inkDim }}>{label}</span>
      {children}
      {fehler && <span role="alert" style={{ fontSize: 13, color: LEUCHT.achtung, lineHeight: 1.4 }}>{fehler}</span>}
    </label>
  );
}

/** Hinweiskarte (gelb/grün/rot/neutral) — Text immer in Satzform, nie ein Kürzel. */
export function Hinweis({ farbe = C.inkDim, children, rolle }: { farbe?: string; children: ReactNode; rolle?: 'alert' | 'status' }) {
  return <div role={rolle} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${farbe === C.inkDim ? 'rgba(255,255,255,.08)' : TIEF.rand(farbe)}`, background: farbe === C.inkDim ? 'rgba(255,255,255,.03)' : TIEF.flaeche(farbe), color: C.ink, fontSize: 14, lineHeight: 1.5 }}>{children}</div>;
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
