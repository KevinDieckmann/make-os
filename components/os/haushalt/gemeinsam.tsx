'use client';

// ─── Haushaltsfinanzen: gemeinsame Bausteine der Oberfläche ─────────────────
// Datenzugriff mit Konfliktbehandlung, eigene Dialoge (Malins Fallstrick:
// Browser-Dialoge können abgeschaltet sein und liefern dann still „nein“),
// Meldungen — Fehler bleiben stehen, bis man sie wegklickt.

import { useCallback, useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { useAbgleich } from '@/hooks/useAbgleich';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Haushalt, Kategorie } from '@/lib/finanzen/haushalt/typen';
import { eur } from '@/lib/finanzen/haushalt/typen';
import type { Meta } from '@/lib/finanzen/haushalt/speicher';
import { LEUCHT, Knopf, feld } from '../schlank';

export type HaushaltDaten = Haushalt & { meta: Meta; haushalt: string; person: string };
export interface Meldung { id: number; art: 'ok' | 'fehler' | 'info'; titel: string; text?: string }
export type Op = { op: 'upsert' | 'delete'; eintrag?: Record<string, unknown>; id?: string; stand?: number };

export function useHaushalt() {
  const [daten, setDaten] = useState<HaushaltDaten | null>(null);
  const [kein, setKein] = useState<string | null>(null);
  const [meldungen, setMeldungen] = useState<Meldung[]>([]);

  const melde = useCallback((art: Meldung['art'], titel: string, text?: string) => {
    const id = Date.now() + Math.random();
    setMeldungen(m => [...m, { id, art, titel, text }]);
    if (art !== 'fehler') setTimeout(() => setMeldungen(m => m.filter(x => x.id !== id)), 5000);
  }, []);
  const weg = (id: number) => setMeldungen(m => m.filter(x => x.id !== id));

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/haushalt');
      const d = await r.json();
      if (r.status === 403) { setKein(d.fehler ?? 'Kein Zugang.'); return; }
      if (!d.ok) { melde('fehler', 'Daten konnten nicht geladen werden', d.fehler); return; }
      setKein(null); setDaten(d);
    } catch { melde('fehler', 'Keine Verbindung', 'MAKE OS ist gerade nicht erreichbar.'); }
  }, [melde]);
  useEffect(() => { void laden(); }, [laden]);
  // Zu zweit (24.09.): Malins Änderungen erscheinen von selbst. Gleichzeitiges
  // Bearbeiten derselben Zeile fängt die Stand-Prüfung ab (409 → neu laden).
  useAbgleich(laden, { alle: 20_000 });

  /** Einzeländerungen. Bei Konflikt: Meldung und frischer Stand statt stillem Überschreiben. */
  const patch = useCallback(async (teil: string, ops: Op[]): Promise<boolean> => {
    try {
      const r = await fetch('/api/haushalt', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teil, ops }) });
      const d = await r.json();
      if (!d.ok) {
        melde('fehler', r.status === 409 ? 'Inzwischen geändert' : 'Nicht gespeichert', d.fehler);
        if (r.status === 409) await laden();
        return false;
      }
      await laden();
      return true;
    } catch { melde('fehler', 'Nicht gespeichert', 'Keine Verbindung.'); return false; }
  }, [laden, melde]);

  const aktion = useCallback(async <T = Record<string, unknown>>(body: Record<string, unknown>): Promise<(T & { ok: boolean; fehler?: string; text?: string }) | null> => {
    try {
      const r = await fetch('/api/haushalt/aktion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!d.ok) melde('fehler', d.fehler ?? 'Das hat nicht geklappt', d.text);
      return d;
    } catch { melde('fehler', 'Keine Verbindung', 'MAKE OS ist gerade nicht erreichbar.'); return null; }
  }, [melde]);

  return { daten, kein, laden, patch, aktion, melde, meldungen, weg };
}

export function Meldungen({ liste, weg }: { liste: Meldung[]; weg: (id: number) => void }) {
  if (!liste.length) return null;
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 90, zIndex: 80, display: 'grid', gap: 8, maxWidth: 380 }}>
      {liste.map(m => {
        const f = m.art === 'fehler' ? LEUCHT.kritisch : m.art === 'ok' ? LEUCHT.gut : LEUCHT.puls;
        return (
          <div key={m.id} role={m.art === 'fehler' ? 'alert' : 'status'} className="os-auf" style={{ background: C.flaeche, borderRadius: 14, padding: '12px 14px', boxShadow: `0 12px 32px rgba(0,0,0,.45), inset 3px 0 0 ${f}`, color: C.ink, fontFamily: SCHRIFT.text }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong style={{ fontSize: TYP.bedien, color: f }}>{m.titel}</strong>
              <button onClick={() => weg(m.id)} aria-label="Schließen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            {m.text && <div style={{ fontSize: 13, color: C.inkDim, marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{m.text}</div>}
          </div>
        );
      })}
    </div>
  );
}

/** Eigener Dialog. Escape oder Klick daneben schließt. */
export function Dialog({ titel, children, onZu, aktionen }: { titel: string; children: ReactNode; onZu: () => void; aktionen?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onZu(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onZu]);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onZu(); }} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={titel} className="karte os-auf" style={{ width: 'min(560px, 100%)', maxHeight: '88vh', overflowY: 'auto', color: C.ink, fontFamily: SCHRIFT.text }}>
        <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 19, marginBottom: 12 }}>{titel}</div>
        <div style={{ display: 'grid', gap: 12, fontSize: TYP.body, lineHeight: 1.5 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          {aktionen}
        </div>
      </div>
    </div>
  );
}

export function Feld({ label, children }: { label: string; children: ReactNode }) {
  return <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: C.inkDim }}>{label}{children}</label>;
}

export function Haken({ an, onChange, children }: { an: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: TYP.bedien, color: C.ink, cursor: 'pointer' }}>
      <input type="checkbox" checked={an} onChange={e => onChange(e.target.checked)} style={{ marginTop: 3, accentColor: LEUCHT.geld }} />
      <span>{children}</span>
    </label>
  );
}

export const auswahl: CSSProperties = { ...feld, padding: '9px 12px', fontSize: TYP.bedien, appearance: 'auto' };

/** Betrag in Cent, rechtsbündig mit festen Ziffernbreiten. */
export function Betrag({ cent, farbe, gross, vorzeichen }: { cent: number | null | undefined; farbe?: string; gross?: boolean; vorzeichen?: boolean }) {
  const f = farbe ?? (cent === null || cent === undefined ? C.inkLeise : cent < 0 ? LEUCHT.achtung : cent > 0 ? LEUCHT.gut : C.inkDim);
  return <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? 17 : 14.5, color: f, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{vorzeichen && cent && cent > 0 ? '+' : ''}{eur(cent)}</span>;
}

/** Kategorien für eine Auswahl, nach Typ gruppiert. Jeder Wert, den die Logik erzeugen kann, steht drin. */
export function KategorieOptionen({ kategorien, nur }: { kategorien: Kategorie[]; nur?: Kategorie['typ'][] }) {
  const gruppen: [Kategorie['typ'], string][] = [['ausgabe', 'Ausgaben'], ['einnahme', 'Einnahmen'], ['umbuchung', 'Umbuchung']];
  return (
    <>
      {gruppen.filter(([t]) => !nur || nur.includes(t)).map(([t, name]) => {
        const drin = kategorien.filter(k => k.typ === t).sort((a, b) => a.sortierung - b.sortierung || a.name.localeCompare(b.name));
        return drin.length ? <optgroup key={t} label={name}>{drin.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</optgroup> : null;
      })}
    </>
  );
}

export function Hinweis({ children, farbe }: { children: ReactNode; farbe?: string }) {
  return <div style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.55, marginTop: 10, ...(farbe ? { color: farbe } : {}) }}>{children}</div>;
}

/** Kachelzeile: große Zahl, darunter Beschriftung und Zusatz. */
export function Kachel({ titel, wert, zusatz, farbe }: { titel: string; wert: ReactNode; zusatz?: ReactNode; farbe?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.inkLeise, letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}>{titel}</div>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(20px, 2.2vw, 26px)', color: farbe ?? C.ink, fontVariantNumeric: 'tabular-nums', margin: '4px 0 2px', whiteSpace: 'nowrap' }}>{wert}</div>
      {zusatz && <div style={{ fontSize: 12.5, color: C.inkDim }}>{zusatz}</div>}
    </div>
  );
}

export function Kacheln({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>{children}</div>;
}

/** Waagrechter Balken mit Anteil. */
export function Leiste({ anteil, farbe }: { anteil: number; farbe: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.07)', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ width: `${Math.max(0, Math.min(100, anteil))}%`, height: '100%', background: farbe, borderRadius: 3, boxShadow: `0 0 8px ${farbe}33` }} />
    </div>
  );
}
