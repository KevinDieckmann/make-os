'use client';

// ─── Sport — kleine Bausteine: Felder, Skala, Zahlen deutsch ────────────────
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, TYP, SCHRIFT, LEUCHT, TIEF } from '@/lib/make-one/design';
import { feld, Pillen as UiPillen } from '../ui';
import { parseZeit, formatZeit } from '@/lib/sport/pace';
import type { Klasse, PlanEinheit, Quelle } from '@/lib/sport/modell';
import { PLAN_LABEL, TYP_LABEL, INTENSITAET_LABEL } from '@/lib/sport/modell';

export const de = (n: number | null | undefined, stellen = 1) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('de-DE', { maximumFractionDigits: stellen }));
export const datumKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
export const datumLang = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;

export const klein: CSSProperties = { ...feld, padding: '9px 12px', fontSize: TYP.bedien, borderRadius: 10 };
export const beschriftung: CSSProperties = { fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' };
export const hinweisStil: CSSProperties = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5, marginTop: 12 };

export function Feld({ label, children, breit }: { label: string; children: ReactNode; breit?: boolean }) {
  return <label style={{ display: 'block', minWidth: 0, gridColumn: breit ? '1 / -1' : undefined }}><span style={beschriftung}>{label}</span>{children}</label>;
}

/** Formularraster — auf dem Handy eine Spalte, sonst so viele, wie passen. */
export function Raster({ children, min = 150 }: { children: ReactNode; min?: number }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 }}>{children}</div>;
}

/** Zeit als Text („23:45“, „1:23:45“, „45“) — beim Verlassen in Sekunden übersetzt. */
export function Zeitfeld({ wert, onWert, placeholder = 'mm:ss', stil }: { wert: number | undefined; onWert: (sek: number | undefined) => void; placeholder?: string; stil?: CSSProperties }) {
  const [text, setText] = useState(wert ? formatZeit(wert) : '');
  useEffect(() => { setText(wert ? formatZeit(wert) : ''); }, [wert]);
  return (
    <input value={text} inputMode="numeric" placeholder={placeholder} onChange={e => setText(e.target.value)}
      onBlur={() => { const s = parseZeit(text); onWert(s ?? undefined); setText(s ? formatZeit(s) : ''); }}
      style={{ ...klein, fontVariantNumeric: 'tabular-nums', ...stil }} />
  );
}

/** Zahl mit Komma erlaubt. */
export function Zahlfeld({ wert, onWert, placeholder, schritt, stil, einheit }: { wert: number | undefined; onWert: (n: number | undefined) => void; placeholder?: string; schritt?: number; stil?: CSSProperties; einheit?: string }) {
  const [text, setText] = useState(wert != null ? String(wert).replace('.', ',') : '');
  useEffect(() => { setText(wert != null ? String(wert).replace('.', ',') : ''); }, [wert]);
  return (
    <div style={{ position: 'relative' }}>
      <input value={text} inputMode="decimal" placeholder={placeholder} step={schritt} onChange={e => setText(e.target.value)}
        onBlur={() => { const n = Number(text.replace(',', '.')); onWert(text.trim() && Number.isFinite(n) ? n : undefined); }}
        style={{ ...klein, fontVariantNumeric: 'tabular-nums', paddingRight: einheit ? 36 : undefined, ...stil }} />
      {einheit && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: TYP.bedien, color: C.inkLeise }}>{einheit}</span>}
    </div>
  );
}

/** Fünf Stufen zum Tippen — Gefühl, Muskelkater. */
export function Skala({ wert, onWert, farbe, umgekehrt }: { wert: number | undefined; onWert: (n: number) => void; farbe?: (n: number) => string; umgekehrt?: boolean }) {
  const f = (n: number) => farbe ? farbe(n) : umgekehrt ? (n >= 4 ? LEUCHT.kritisch : n >= 3 ? LEUCHT.achtung : LEUCHT.gut) : (n >= 4 ? LEUCHT.gut : n >= 3 ? LEUCHT.achtung : LEUCHT.kritisch);
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onWert(n)} aria-label={`${n} von 5`} aria-pressed={wert === n} className="fassbar" style={{
          width: 40, height: 40, borderRadius: 12, border: `1px solid ${wert != null && n <= wert ? TIEF.rand(f(wert)) : 'rgba(255,255,255,.08)'}`, cursor: 'pointer',
          fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, background: wert != null && n <= wert ? TIEF.flaeche(f(wert)) : 'rgba(255,255,255,.04)', color: wert != null && n <= wert ? f(wert) : C.inkLeise,
        }}>{n}</button>
      ))}
    </div>
  );
}

/** Auswahl aus Pillen — Art des Laufs, Art der Einheit (Standard-Baustein, Tippziel 44 px am Handy). */
export function Pillen<T extends string>({ liste, wert, onWert, farbe = C.aktiv }: { liste: { id: T; label: string }[]; wert: T; onWert: (id: T) => void; farbe?: string }) {
  return <UiPillen liste={liste} aktiv={wert} onWahl={onWert} farbe={farbe} />;
}

export function Hinweis({ children }: { children: ReactNode }) {
  return <p style={hinweisStil}>{children}</p>;
}

/** Kleiner Löschen-Knopf in Listen. */
export function Weg({ onClick, label = 'Entfernen' }: { onClick: () => void; label?: string }) {
  return <button type="button" onClick={onClick} aria-label={label} title={label} className="fassbar" style={{ border: 'none', background: 'transparent', color: C.inkLeise, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '4px 6px' }}>×</button>;
}

export const stilLink: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
export const SPORT_FARBE = {
  hyrox: LEUCHT.business, lauf: LEUCHT.puls, gym: LEUCHT.agenten, erholung: LEUCHT.schlaf, ruhe: LEUCHT.schlaf, frei: C.inkLeise,
  // 09.10. (Training sichtbar): die übrigen Sparten — Rosa, Petrol, Lavendel; was nicht zählt, bleibt leise.
  rad: LEUCHT.beziehung, ausdauer: C.aktiv, mobility: C.lavendel, sonstiges: C.inkDim, alltag: C.inkLeise,
} as const;
/** Farbe je Sparte (Training, Plan). */
export const KLASSE_FARBE: Record<Klasse, string> = SPORT_FARBE;

/** Herzfrequenz-Zonen 0–5: von leise über blau, grün, gelb, orange bis rot (nur Token). */
export const ZONE_FARBE = [C.inkLeise, LEUCHT.puls, LEUCHT.gut, LEUCHT.achtung, LEUCHT.business, LEUCHT.kritisch] as const;

/** Minuten je Zone als ein Balken (Anteile) — mit Text für Vorleser. */
export function ZonenBalken({ zonen, hoehe = 8 }: { zonen: readonly number[]; hoehe?: number }) {
  const summe = zonen.reduce((a, b) => a + b, 0);
  if (!summe) return null;
  const text = zonen.map((m, i) => `Zone ${i} ${de(m, 0)} min`).join(', ');
  return (
    <div role="img" aria-label={`Herzfrequenz-Zonen: ${text}`} style={{ display: 'flex', height: hoehe, borderRadius: hoehe / 2, overflow: 'hidden', background: 'rgba(255,255,255,.05)' }}>
      {zonen.map((m, i) => (m > 0 ? <span key={i} style={{ flex: `${m} 1 0`, background: ZONE_FARBE[i], opacity: i === 0 ? 0.5 : 0.85 }} /> : null))}
    </div>
  );
}

/** Eine geplante Einheit als kurzer Text: „Lauf · Intervall · 45 min“ (mit `voll` auch Intensität und Zone). */
export function einheitText(e: PlanEinheit, voll = false): string {
  return [PLAN_LABEL[e.sparte], e.typ ? TYP_LABEL[e.typ] : null, e.dauerMin ? `${e.dauerMin} min` : null,
    voll && e.intensitaet ? INTENSITAET_LABEL[e.intensitaet] : null, voll && e.zone ? `Zone ${e.zone}` : null, voll && e.strain !== undefined ? `Strain ${de(e.strain)}` : null,
  ].filter(Boolean).join(' · ');
}
/** Sekunden als „2:07“ (Stunden:Minuten, gerundet) — für Spannen, die auf die Minute genau reichen. */
export const stundeMinute = (sek: number) => { const m = Math.round(sek / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

const QUELLE_NAME: Record<Quelle, string> = { hand: 'von Hand', whoop: 'WHOOP', strava: 'Strava', 'apple-health': 'Apple Health' };
/** Woher eine Einheit kommt (führende Quelle + weitere). */
export const quelleText = (q: Quelle, auch?: readonly Quelle[]) => [q, ...(auch ?? [])].map(x => QUELLE_NAME[x]).join(' + ');
