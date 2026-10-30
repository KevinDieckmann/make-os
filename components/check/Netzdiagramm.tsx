// ─── Innovations-Check — Netzdiagramm (24.10.) ──────────────────────────────────────────────────────────────────
// Eigener Wert (Glühen, gefüllt) gegen den Branchenwert (gestrichelt) auf 5 oder 6 Achsen, 0–100 je Dimension. Die Zahlen kommen
// fertig vom Server (lib/check/ergebnis.ts) — hier wird nur gezeichnet. Die eigene Fläche wächst einmal aus der Mitte (CSS,
// nur ohne „Bewegung reduzieren“). Mit Titel und Beschreibung (alle Werte) für Screenreader.

import s from './check.module.css';
import type { ErgebnisAchse } from '@/lib/check/ergebnis';

const MITTE = 170, RADIUS = 112;

function punkt(i: number, n: number, wert: number): [number, number] {
  const w = (-90 + (360 / n) * i) * (Math.PI / 180);
  const r = (Math.max(0, Math.min(100, wert)) / 100) * RADIUS;
  return [MITTE + r * Math.cos(w), MITTE + r * Math.sin(w)];
}
const pfad = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';

/** Lange Achsennamen („Team und Kompetenz“) in zwei Zeilen — am Leerzeichen, das der Mitte am nächsten liegt. */
function zeilen(name: string): string[] {
  if (name.length <= 12) return [name];
  const luecken = [...name].flatMap((z, i) => (z === ' ' ? [i] : []));
  if (!luecken.length) return [name];
  const i = luecken.reduce((b, x) => (Math.abs(x - name.length / 2) < Math.abs(b - name.length / 2) ? x : b));
  return [name.slice(0, i), name.slice(i + 1)];
}

export function Netzdiagramm({ achsen }: { achsen: readonly ErgebnisAchse[] }) {
  const n = achsen.length;
  if (n < 3) return null;
  const ich = achsen.map((a, i) => punkt(i, n, a.wert));
  const branche = achsen.map((a, i) => punkt(i, n, a.branche));
  const beschreibung = achsen.map(a => `${a.name}: ${a.wert} (Branche ${a.branche})`).join(', ');
  return (
    <figure style={{ margin: 0 }}>
      <svg className={s.netz} viewBox="-70 -14 480 372" role="img" aria-labelledby="netz-titel netz-text">
        <title id="netz-titel">Ihre Werte im Vergleich zur Branche</title>
        <desc id="netz-text">{beschreibung}</desc>
        {[25, 50, 75, 100].map(r => (
          <path key={r} d={pfad(achsen.map((_, i) => punkt(i, n, r)))} fill="none" stroke="var(--c-linie)" strokeWidth={r === 100 ? 1.2 : 0.8} />
        ))}
        {achsen.map((a, i) => {
          const [x, y] = punkt(i, n, 100);
          return <line key={a.key} x1={MITTE} y1={MITTE} x2={x} y2={y} stroke="var(--c-linie)" strokeWidth={0.8} />;
        })}
        <path d={pfad(branche)} fill="none" stroke="var(--c-leise)" strokeWidth={1.5} strokeDasharray="5 5" />
        <g className={s.netzIch}>
          <path d={pfad(ich)} fill="var(--c-ich-flaeche)" stroke="var(--c-ende)" strokeWidth={2.5} strokeLinejoin="round" />
          {ich.map(([x, y], i) => <circle key={achsen[i].key} cx={x} cy={y} r={3.5} fill="var(--c-lavendel)" />)}
        </g>
        {achsen.map((a, i) => {
          const w = (-90 + (360 / n) * i) * (Math.PI / 180);
          const x = MITTE + (RADIUS + 22) * Math.cos(w), y = MITTE + (RADIUS + 22) * Math.sin(w);
          const anker = Math.abs(Math.cos(w)) < 0.2 ? 'middle' : Math.cos(w) > 0 ? 'start' : 'end';
          const z = zeilen(a.name);
          // Oben stehende Beschriftungen wachsen nach oben, damit sie nie ins Netz ragen. Abstände in em — die Schrift wird am Handy größer (CSS).
          const hoch = Math.sin(w) < -0.5 ? z.length - 1 : 0;
          return (
            <text key={a.key} x={x} y={y} textAnchor={anker} dominantBaseline="middle" fill="var(--c-text)" className={s.netzText}>
              {z.map((teil, j) => <tspan key={j} x={x} dy={j ? '1.2em' : `${-hoch * 1.2}em`}>{teil}</tspan>)}
              <tspan x={x} dy="1.2em" fill="var(--c-leise)" style={{ fontFamily: 'var(--s-zahl)' }}>{a.wert}</tspan>
            </text>
          );
        })}
      </svg>
      <figcaption className={s.netzLegende}><span className={s.legendeIch}>Sie</span><span className={s.legendeBranche}>Branche</span></figcaption>
    </figure>
  );
}
