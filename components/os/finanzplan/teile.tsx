'use client';

// ─── Finanzplanung jetzt — gemeinsame Bauteile ───────────────────────────────
// Alles auf den Bausteinen aus schlank.tsx und den Farben aus design.ts:
// Farbe bedeutet Zustand (gut/achtung/kritisch), Türkis ist Aktion, Kupfer
// ist Geld im Diagramm, Lila ist IST. Beträge gehen durch <Geld>, damit
// „Verbergen“ überall greift.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, MIKRO, TIEF } from '@/lib/make-one/design';
import { LEUCHT, feld } from '../schlank';
import { mitglied, nameVon } from '@/lib/crm/team';
import type { Einheit } from '@/lib/finanzen/rechenkern';
import { EINHEIT_LABEL, eur, parseBetrag, personKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan, type Meldung } from './daten';

export const KUPFER = '#DE9E63';
export const LILA = C.lavendel;
export const HAAR = 'rgba(255,255,255,.06)';
export const EINHEIT_FARBE: Record<Einheit, string> = { privat: LEUCHT.schlaf, selbststaendigkeit: LEUCHT.business, ug: LEUCHT.geld, kdv: LEUCHT.puls };

export const personFarbe = (wer: string | null | undefined): string => mitglied(personKennung(wer))?.farbe ?? C.inkLeise;
export const personName = (wer: string | null | undefined): string => { const k = personKennung(wer); return k === 'beide' ? 'Beide' : mitglied(k)?.name ?? (wer ? String(wer) : '—'); };
export { nameVon };

/** Zustandsfarbe für eine Kennzahl: gut · achtung · kritisch. */
export const ampel = (ok: boolean, warn: boolean): string => (ok ? LEUCHT.gut : warn ? LEUCHT.achtung : LEUCHT.kritisch);
/** Vorzeichen-Farbe: unter null kritisch, sonst normal. */
export const vorzeichenFarbe = (v: number | null | undefined): string | undefined => (v != null && v < -0.5 ? LEUCHT.kritisch : undefined);

// ── Beträge ─────────────────────────────────────────────────────────────────
export function Geld({ v, dezimal = 0, farbe, plus, einheit = '', gross, stil }: { v: number | null | undefined; dezimal?: number; farbe?: string; plus?: boolean; einheit?: string; gross?: boolean; stil?: CSSProperties }) {
  const { verbergen } = usePlan();
  const text = v == null || Number.isNaN(v) ? '—' : `${plus && v > 0 ? '+' : ''}${eur(v, dezimal)}${einheit}`;
  return (
    <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em', whiteSpace: 'nowrap', fontWeight: gross ? 700 : 600, fontSize: gross ? 'clamp(20px,2.4vw,26px)' : undefined,
      color: farbe ?? (v == null ? C.inkLeise : vorzeichenFarbe(v) ?? C.ink), ...(verbergen ? { filter: 'blur(7px)', userSelect: 'none' } : {}), ...stil }}>{text}</span>
  );
}

/** Kennzahl-Kachel: Beschriftung, große Zahl, Zusatz — optional mit Zustandspunkt. */
export function Kachel({ label, wert, unter, punkt, farbe }: { label: ReactNode; wert: ReactNode; unter?: ReactNode; punkt?: string; farbe?: string }) {
  return (
    <div style={{ minWidth: 0, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.03)', boxShadow: farbe ? `inset 3px 0 0 ${farbe}` : undefined }}>
      <div style={{ ...MIKRO, display: 'flex', alignItems: 'center', gap: 7 }}>{punkt && <span style={{ width: 8, height: 8, borderRadius: '50%', background: punkt, boxShadow: `0 0 8px ${punkt}55`, flex: '0 0 auto' }} />}{label}</div>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(20px,2.4vw,26px)', letterSpacing: '-.03em', lineHeight: 1.1, margin: '6px 0 3px', color: C.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wert}</div>
      {unter && <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.4 }}>{unter}</div>}
    </div>
  );
}
export function Kacheln({ children, min = 150 }: { children: ReactNode; min?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10, marginBottom: 14 }}>{children}</div>;
}

/** Kleines Etikett für die Einheit (Privat · MAKE Innovation GmbH · KD Ventures · Selbstständigkeit) — Namen aus lib/einheiten.ts. */
export function Etikett({ einheit, text }: { einheit?: Einheit; text?: string }) {
  const f = einheit ? EINHEIT_FARBE[einheit] : C.inkLeise;
  return <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', padding: '2px 8px', borderRadius: 999, background: `${f}1F`, color: f, whiteSpace: 'nowrap' }}>{text ?? (einheit ? EINHEIT_LABEL[einheit] : '')}</span>;
}

/** Statuspille für Ziele und Abschlüsse. */
export function StatusPille({ status }: { status: string }) {
  const f = status === 'erreicht' || status === 'im Plan' || status === 'abgeschlossen' ? LEUCHT.gut : status === 'knapp' ? LEUCHT.achtung : status === 'verfehlt' ? LEUCHT.kritisch : C.inkDim;
  return <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: `${f}22`, color: f, whiteSpace: 'nowrap' }}>{status}</span>;
}

/** Plakette der Person (Kevin türkis, Malin lila), klein. */
export function PersonMarke({ wer, mitName }: { wer: string | null | undefined; mitName?: boolean }) {
  const k = personKennung(wer);
  if (k === 'beide') return <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', fontSize: 12, color: C.inkDim }}><PersonMarke wer="kevin" /><PersonMarke wer="malin" />{mitName && 'Beide'}</span>;
  const f = personFarbe(k); const n = personName(k);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.inkDim, whiteSpace: 'nowrap' }}>
      <span title={n} style={{ width: 18, height: 18, borderRadius: '50%', display: 'inline-grid', placeItems: 'center', background: `${f}26`, color: f, border: `1px solid ${f}66`, fontSize: 11, fontWeight: 700 }}>{n.charAt(0)}</span>
      {mitName && n}
    </span>
  );
}

// ── Tabellen ────────────────────────────────────────────────────────────────
export const TH: CSSProperties = { ...MIKRO, textAlign: 'left', padding: '6px 8px', borderBottom: `1px solid ${HAAR}`, whiteSpace: 'nowrap', fontWeight: 700 };
export const THr: CSSProperties = { ...TH, textAlign: 'right' };
export const TD: CSSProperties = { padding: '7px 8px', borderBottom: `1px solid ${HAAR}`, fontSize: TYP.bedien, color: C.ink, verticalAlign: 'middle' };
export const TDr: CSSProperties = { ...TD, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
export const TDleise: CSSProperties = { ...TD, color: C.inkLeise };

export function Tabelle({ children, klein }: { children: ReactNode; klein?: boolean }) {
  return <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: klein ? 12.5 : TYP.bedien }}>{children}</table></div>;
}
/** Gruppen-Überschrift in einer Tabelle. */
export function Gruppenzeile({ text, spalten }: { text: string; spalten: number }) {
  return <tr><td colSpan={spalten} style={{ ...MIKRO, padding: '14px 8px 4px', color: C.inkLeise }}>{text}</td></tr>;
}

// ── Eingaben ────────────────────────────────────────────────────────────────
export const eingabeStil: CSSProperties = { ...feld, fontSize: TYP.bedien, padding: '7px 10px', borderRadius: 10 };
export const auswahlStil: CSSProperties = { ...eingabeStil, appearance: 'auto', width: 'auto', minWidth: 0 };

/** Betrag-Feld: übernimmt beim Verlassen oder Enter; leer = null; Unsinn wird verworfen. */
export function ZahlFeld({ wert, onFertig, breite = 110, dezimal = 2, platzhalter, leer, rechts = true, titel }: { wert: number | null | undefined; onFertig: (v: number | null) => void; breite?: number | string; dezimal?: number; platzhalter?: string; leer?: boolean; rechts?: boolean; titel?: string }) {
  const { verbergen } = usePlan();
  const text = wert == null ? '' : eur(wert, dezimal);
  const [t, setT] = useState(text);
  const [fokus, setFokus] = useState(false);
  useEffect(() => { if (!fokus) setT(text); }, [text, fokus]);
  const fertig = () => {
    setFokus(false);
    const v = parseBetrag(t);
    if (v === null) { if (leer) onFertig(null); else setT(text); return; }
    if (Number.isNaN(v)) { setT(text); return; }
    if (wert == null || Math.abs(v - wert) > 1e-9) onFertig(v); else setT(text);
  };
  return <input value={t} placeholder={platzhalter} aria-label={titel ?? platzhalter ?? 'Betrag'} title={titel} inputMode="decimal" onFocus={() => setFokus(true)} onChange={e => setT(e.target.value)} onBlur={fertig}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setT(text); (e.target as HTMLInputElement).blur(); } }}
    style={{ ...eingabeStil, width: breite, textAlign: rechts ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', ...(verbergen && !fokus ? { filter: 'blur(6px)' } : {}) }} />;
}

/** Text-Feld, das beim Verlassen speichert. */
export function TextFeld({ wert = '', onFertig, platzhalter, breite, typ = 'text', titel }: { wert?: string; onFertig: (t: string) => void; platzhalter?: string; breite?: number | string; typ?: string; titel?: string }) {
  const [t, setT] = useState(wert);
  const [fokus, setFokus] = useState(false);
  useEffect(() => { if (!fokus) setT(wert); }, [wert, fokus]);
  return <input type={typ} value={t} placeholder={platzhalter} aria-label={titel ?? platzhalter ?? 'Text'} title={titel} onFocus={() => setFokus(true)} onChange={e => setT(e.target.value)}
    onBlur={() => { setFokus(false); if (t !== wert) onFertig(t); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    style={{ ...eingabeStil, ...(breite ? { width: breite } : {}) }} />;
}

export function Auswahl<T extends string>({ wert, onWahl, optionen, breite, titel }: { wert: T; onWahl: (v: T) => void; optionen: { id: T; label: string }[] | readonly { id: T; label: string }[]; breite?: number | string; titel?: string }) {
  return <select value={wert} aria-label={titel ?? 'Auswahl'} title={titel} onChange={e => onWahl(e.target.value as T)} style={{ ...auswahlStil, ...(breite ? { width: breite } : {}) }}>{optionen.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
}

/** Monat wählen (Plan-Monate; mit `aus` auch „aus“ = 0). */
export function MonatWahl({ wert, onWahl, monate, aus, leer, breite = 104 }: { wert: number | undefined; onWahl: (m: number) => void; monate: string[]; aus?: boolean; leer?: string; breite?: number }) {
  return (
    <select value={wert ?? 0} aria-label="Monat" onChange={e => onWahl(Number(e.target.value))} style={{ ...auswahlStil, width: breite }}>
      {aus && <option value={0}>aus</option>}{leer && <option value={0}>{leer}</option>}
      {monate.map((l, i) => <option key={l} value={i + 1}>{l}</option>)}
    </select>
  );
}

export function Schalter({ an, onChange, children }: { an: boolean; onChange: (v: boolean) => void; children?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={an} onClick={() => onChange(!an)} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 30, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.inkDim, fontSize: TYP.bedien, fontFamily: SCHRIFT.text }}>
      <span aria-hidden style={{ width: 30, height: 18, borderRadius: 999, position: 'relative', background: an ? C.aktiv : 'rgba(255,255,255,.14)', transition: 'background .2s ease', flex: '0 0 auto' }}>
        <span style={{ position: 'absolute', top: 2, left: an ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: C.grund, transition: 'left .2s ease' }} />
      </span>
      {children}
    </button>
  );
}

export function KnopfKlein({ children, onClick, farbe, aus, titel }: { children: ReactNode; onClick?: () => void; farbe?: string; aus?: boolean; titel?: string }) {
  const f = farbe ?? C.aktiv;
  return <button type="button" onClick={onClick} disabled={aus} title={titel} className="fassbar" style={{ fontFamily: SCHRIFT.text, fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 9, cursor: aus ? 'default' : 'pointer', whiteSpace: 'nowrap', ...(aus ? { border: '1px solid transparent', background: 'rgba(255,255,255,.06)', color: C.inkLeise } : TIEF.knopf(f)) }}>{children}</button>;
}

export function Hinweis({ children, farbe }: { children: ReactNode; farbe?: string }) {
  return <div style={{ fontSize: 12.5, color: farbe ?? C.inkLeise, lineHeight: 1.55, marginTop: 10 }}>{children}</div>;
}

/** Waagrechter Anteil-Balken, optional mit Markierung (heute) — Budget-Tempo. */
export function AnteilBalken({ anteil, farbe, marke, hoehe = 8 }: { anteil: number; farbe: string; marke?: number; hoehe?: number }) {
  return (
    <div style={{ position: 'relative', height: hoehe, borderRadius: hoehe / 2, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, anteil * 100))}%`, height: '100%', background: TIEF.verlauf(farbe), borderRadius: hoehe / 2, transition: 'width .6s cubic-bezier(.22,1,.36,1)' }} />
      {marke != null && <div title="heute" style={{ position: 'absolute', top: -2, bottom: -2, left: `${Math.max(0, Math.min(100, marke * 100))}%`, width: 2, background: C.ink, opacity: .8 }} />}
    </div>
  );
}

// ── Kontextmenü (Rechtsklick / langer Druck) ────────────────────────────────
export interface MenueEintrag { label: string; tun: () => void; aus?: boolean }
export function Kontextmenue({ x, y, titel, eintraege, onZu }: { x: number; y: number; titel?: string; eintraege: MenueEintrag[]; onZu: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zu = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onZu(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onZu(); };
    document.addEventListener('mousedown', zu); document.addEventListener('touchstart', zu); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', zu); document.removeEventListener('touchstart', zu); document.removeEventListener('keydown', esc); };
  }, [onZu]);
  const links = typeof window !== 'undefined' ? Math.min(x, window.innerWidth - 250) : x;
  const oben = typeof window !== 'undefined' ? Math.min(y, window.innerHeight - 40 - eintraege.length * 34) : y;
  return (
    <div ref={ref} role="menu" className="os-auf" style={{ position: 'fixed', left: links, top: oben, zIndex: 90, minWidth: 230, background: C.flaecheHoch, borderRadius: 12, padding: 6, boxShadow: '0 16px 40px -12px rgba(0,0,0,.8), inset 0 0 0 1px rgba(255,255,255,.06)' }}>
      {titel && <div style={{ ...MIKRO, padding: '6px 10px 4px' }}>{titel}</div>}
      {eintraege.map(e => (
        <button key={e.label} type="button" role="menuitem" disabled={e.aus} onClick={() => { onZu(); e.tun(); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none', background: 'transparent', color: e.aus ? C.inkLeise : C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: e.aus ? 'default' : 'pointer' }}
          onMouseEnter={ev => { if (!e.aus) (ev.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.06)'; }} onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>{e.label}</button>
      ))}
    </div>
  );
}

// ── Meldungen: Fehler bleiben stehen, Erfolg verschwindet, „Rückgängig“ direkt daran ──
export function Meldungen({ liste, weg }: { liste: Meldung[]; weg: (id: number) => void }) {
  if (!liste.length) return null;
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 90, zIndex: 80, display: 'grid', gap: 8, maxWidth: 380 }}>
      {liste.map(m => {
        const f = m.art === 'fehler' ? LEUCHT.kritisch : m.art === 'ok' ? LEUCHT.gut : LEUCHT.puls;
        return (
          <div key={m.id} role={m.art === 'fehler' ? 'alert' : 'status'} className="os-auf" style={{ background: C.flaeche, borderRadius: 14, padding: '11px 14px', boxShadow: `0 12px 32px rgba(0,0,0,.45), inset 3px 0 0 ${f}`, color: C.ink, fontFamily: SCHRIFT.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <strong style={{ fontSize: TYP.bedien, color: f }}>{m.titel}</strong>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {m.aktion && <KnopfKlein onClick={() => { weg(m.id); m.aktion?.tun(); }}>{m.aktion.label}</KnopfKlein>}
                <button onClick={() => weg(m.id)} aria-label="Schließen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </span>
            </div>
            {m.text && <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 3, whiteSpace: 'pre-wrap', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.text}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Eigener Dialog (Escape/Klick daneben schließt) — Browser-Dialoge können abgeschaltet sein. */
export function Dialog({ titel, children, onZu, aktionen, breit }: { titel: string; children: ReactNode; onZu: () => void; aktionen?: ReactNode; breit?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onZu(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onZu]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onZu(); }} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={titel} className="karte os-auf" style={{ width: `min(${breit ? 760 : 560}px, 100%)`, maxHeight: '88vh', overflowY: 'auto', color: C.ink, fontFamily: SCHRIFT.text }}>
        <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 19, marginBottom: 12 }}>{titel}</div>
        <div style={{ display: 'grid', gap: 12, fontSize: TYP.body, lineHeight: 1.5 }}>{children}</div>
        {aktionen && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>{aktionen}</div>}
      </div>
    </div>
  );
}

export function Feld({ label, children, breit }: { label: string; children: ReactNode; breit?: boolean }) {
  return <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: C.inkDim, ...(breit ? { gridColumn: '1 / -1' } : {}) }}>{label}{children}</label>;
}

/** Zwei-Spalten-Formular, das auf dem Handy eine Spalte wird. */
export function Formular({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>{children}</div>;
}

/** Bereiche mit Zähler-Plakette (Monat: offene Buchungen · Verpflichtungen: fällig). */
export function BereichLeiste<T extends string>({ liste, aktiv, onWahl }: { liste: { id: T; label: string; zahl?: number }[]; aktiv: T; onWahl: (id: T) => void }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: 3, overflowX: 'auto', maxWidth: '100%' }}>
      {liste.map(s => {
        const an = aktiv === s.id;
        return (
          <button key={s.id} role="tab" aria-selected={an} onClick={() => onWahl(s.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, whiteSpace: 'nowrap', transition: 'background .2s ease, color .2s ease', background: an ? C.ink : 'transparent', color: an ? C.grund : C.inkDim }}>
            {s.label}
            {!!s.zahl && <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: an ? `${LEUCHT.achtung}` : `${LEUCHT.achtung}33`, color: an ? C.grund : LEUCHT.achtung }}>{s.zahl}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Pillen zum Umschalten — gleiche Form wie in der Markttraktion, ohne deren Modulgraph im Bündel. */
export function Pillen<T extends string>({ liste, aktiv, onWahl, farbe = C.aktiv, einzeilig }: { liste: { id: T; label: string }[] | readonly { id: T; label: string }[]; aktiv: T | null | undefined; onWahl: (id: T) => void; farbe?: string; einzeilig?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: einzeilig ? 'nowrap' : 'wrap', whiteSpace: einzeilig ? 'nowrap' : undefined, overflowX: einzeilig ? 'auto' : undefined, maxWidth: '100%' }}>
      {liste.map(l => {
        const an = l.id === aktiv;
        return <button key={l.id} type="button" onClick={e => { e.stopPropagation(); onWahl(l.id); }} className="fassbar" aria-pressed={an} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, border: `1px solid ${an ? farbe : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim, whiteSpace: 'nowrap' }}>{l.label}</button>;
      })}
    </div>
  );
}

/** Leerer Zustand in einer Karte. */
export function Nichts({ children }: { children: ReactNode }) {
  return <div style={{ padding: '10px 2px', color: C.inkLeise, fontSize: TYP.bedien, lineHeight: 1.55 }}>{children}</div>;
}

/** Legende: Farbpunkt + Text. */
export function Legende({ eintraege }: { eintraege: { farbe: string; text: string }[] }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: C.inkDim }}>{eintraege.map(e => <span key={e.text} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: e.farbe }} />{e.text}</span>)}</div>;
}
