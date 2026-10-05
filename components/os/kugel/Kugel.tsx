'use client';

// ─── MAKE OS — Kugel (React-Hülle um den Motor, 05.10.2026) ─────────────────
// Der wiederverwendbare Kern für ZOE (ZoeKugel) und das Brain (BrainKugel): eine Leinwand, ein Motor, ein Rückfall.
//   · Ohne WebGL zeigt sie `rueckfall` (ZOE: das bisherige ZoeHirn-SVG bzw. das Symbol; Brain: nur die Liste).
//   · „Bewegung reduzieren“ (System) → ruhiges Standbild, ohne Einstieg, ohne Schleife.
//   · Die Leinwand ist dekorativ (aria-hidden) — was sie zeigt, steht immer zusätzlich als Text daneben.
// Farben kommen nur aus den Token (KUGEL in lib/make-one/design.ts) — Wächter tests/kugeln.test.ts.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { KUGEL } from '@/lib/make-one/design';
import { alsRgb, type KugelZustand } from './geometrie';
import { starteMotor, type KugelDaten, type Motor, type MotorOptionen } from './motor';

/** Voreinstellungen: groß (ZOE-Empfang), Symbol (unten im ZoePanel), Brain (Datenpunkte). */
export const KUGEL_VORGABEN: Record<'gross' | 'symbol' | 'brain', Omit<MotorOptionen, 'ruhig' | 'farben'>> = {
  gross: { fps: 60, punktPx: 2.1, verlauf: true, drehTempo: 0.05, neigung: 0.32, fuellung: 0.78, einstieg: true, zeigerRadius: 0.42, flare: 0.22, grund: 0.2 },
  symbol: { fps: 24, punktPx: 1.6, verlauf: true, drehTempo: 0.12, neigung: 0.3, fuellung: 0.86, einstieg: true, zeigerRadius: 0, flare: 0, grund: 0.3 },
  brain: { fps: 60, punktPx: 5, verlauf: false, drehTempo: 0.035, neigung: 0.28, fuellung: 0.8, einstieg: true, zeigerRadius: 0.2, flare: 0.1, grund: 0.32 },
};

export const KUGEL_FARBEN = { a: alsRgb(KUGEL.smaragd), b: alsRgb(KUGEL.granat), glut: alsRgb(KUGEL.glut) };

/** Bevorzugt das System weniger Bewegung? (Hook, folgt Änderungen.) */
export function useRuhig(): boolean {
  const [ruhig, setRuhig] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setRuhig(m.matches);
    const hoere = () => setRuhig(m.matches);
    m.addEventListener('change', hoere);
    return () => m.removeEventListener('change', hoere);
  }, []);
  return ruhig;
}

export interface KugelProps {
  daten: KugelDaten;
  zustand: KugelZustand;
  art: keyof typeof KUGEL_VORGABEN;
  /** Einzelne Vorgaben überschreiben (z. B. fps). */
  optionen?: Partial<Omit<MotorOptionen, 'ruhig' | 'farben'>>;
  /** Ohne WebGL (und solange es geprüft wird, nichts). */
  rueckfall: ReactNode;
  /** Zeiger-Ausbruch an der Stelle des Zeigers (ZOE groß). Die Brain-Kugel steuert den Zeiger selbst über `onMotor`. */
  zeiger?: boolean;
  onMotor?: (m: Motor | null) => void;
  style?: CSSProperties;
  className?: string;
  /** Messpunkt auch in der Produktion (data-bilder, data-mittel-ms …). */
  messen?: boolean;
  /** Kennung für Prüfungen (data-kugel). */
  name: string;
}

export function Kugel({ daten, zustand, art, optionen, rueckfall, zeiger, onMotor, style, className, messen, name }: KugelProps) {
  const leinwand = useRef<HTMLCanvasElement>(null);
  const motor = useRef<Motor | null>(null);
  const [ohne, setOhne] = useState(false);
  const ruhig = useRuhig();
  const zustandRef = useRef(zustand);
  zustandRef.current = zustand;
  const onMotorRef = useRef(onMotor);
  onMotorRef.current = onMotor;
  const opt = { ...KUGEL_VORGABEN[art], ...optionen };
  const optSchluessel = JSON.stringify(opt);

  useEffect(() => {
    const c = leinwand.current;
    if (!c) return;
    let m: Motor | null = null;
    try { m = starteMotor(c, daten, { ...JSON.parse(optSchluessel), ruhig, farben: KUGEL_FARBEN }, zustandRef.current); } catch { m = null; }
    if (!m) { setOhne(true); onMotorRef.current?.(null); return; }
    motor.current = m;
    onMotorRef.current?.(m);
    return () => { m?.zerstoere(); motor.current = null; onMotorRef.current?.(null); };
    // Daten wechseln über setzeDaten (eigener Effekt) — hier nur, was den Motor grundsätzlich ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruhig, optSchluessel]);

  useEffect(() => { motor.current?.setzeDaten(daten); }, [daten]);
  useEffect(() => { motor.current?.setzeZustand(zustand); }, [zustand]);

  if (ohne) return <>{rueckfall}</>;

  const zeigerAn = zeiger && !ruhig;
  return (
    <canvas
      ref={leinwand}
      aria-hidden="true"
      data-kugel={name}
      {...(messen ? { 'data-messen': '' } : {})}
      className={className}
      onPointerMove={zeigerAn ? e => { const r = e.currentTarget.getBoundingClientRect(); motor.current?.zeiger(e.clientX - r.left, e.clientY - r.top); } : undefined}
      onPointerLeave={zeigerAn ? () => motor.current?.zeiger(null) : undefined}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: zeigerAn ? 'pan-y' : undefined, ...style }}
    />
  );
}
