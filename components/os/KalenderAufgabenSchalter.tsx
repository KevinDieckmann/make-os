'use client';

// ─── Umschalter Kalender | Aufgaben (29.09., K5 — Kevin: wie oben rechts im Google Kalender) ─
// Zwei Symbole in einer Pille: links Kalender, rechts Aufgaben (Haken); der aktive Teil ist hinterlegt. Steht im Kopf
// des Kalenders (/os/kalender — Aufgaben = `?modus=aufgaben`, lib/kalender/modus.ts) und in den Aufgaben
// (/os/aufgaben — Kalender springt mit Space/Projekt/Filter in den Kalender). Je Seite entweder ein Klick-Handler
// (im selben Fenster umschalten) oder ein Link. Trefferfläche ≥ 40 px, am Handy beide Symbole sichtbar.

import Link from 'next/link';
import { CalendarDays, CircleCheckBig } from 'lucide-react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { LEUCHT } from './ui';

export type ZeitSeite = 'kalender' | 'aufgaben';
type Ziel = { href: string } | { onClick: () => void };

const KNOPF: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 40, border: 'none', borderRadius: 10,
  cursor: 'pointer', textDecoration: 'none', transition: 'background .2s ease, color .2s ease', fontFamily: SCHRIFT.text,
};

function Teil({ an, titel, taste, ziel, children }: { an: boolean; titel: string; taste?: string; ziel: Ziel; children: React.ReactNode }) {
  const stil: React.CSSProperties = { ...KNOPF, background: an ? `${LEUCHT.puls}38` : 'transparent', color: an ? C.ink : C.inkDim, boxShadow: an ? `inset 0 0 0 1px ${LEUCHT.puls}66` : undefined };
  const label = taste ? `${titel} (Taste ${taste})` : titel;
  if ('href' in ziel) return <Link href={ziel.href} title={label} aria-label={titel} aria-current={an ? 'page' : undefined} className="fassbar" style={stil}>{children}</Link>;
  return <button type="button" onClick={ziel.onClick} title={label} aria-label={titel} aria-pressed={an} className="fassbar" style={stil}>{children}</button>;
}

/**
 * `aktiv`: welche Seite gerade zu sehen ist. `kalender`/`aufgaben`: wohin der jeweilige Teil führt (Link oder Klick).
 * `tasten`: Kürzel für die Tooltips (die Tasten selbst hört die Seite).
 */
export function KalenderAufgabenSchalter({ aktiv, kalender, aufgaben, tasten }: { aktiv: ZeitSeite; kalender: Ziel; aufgaben: Ziel; tasten?: { kalender?: string; aufgaben?: string } }) {
  return (
    <div role="group" aria-label="Kalender oder Aufgaben" data-schalter="kalender-aufgaben" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 12, background: 'rgba(255,255,255,.06)', flex: '0 0 auto' }}>
      <Teil an={aktiv === 'kalender'} titel="Kalender" taste={tasten?.kalender} ziel={kalender}><CalendarDays size={18} strokeWidth={2} aria-hidden /></Teil>
      <Teil an={aktiv === 'aufgaben'} titel="Aufgaben" taste={tasten?.aufgaben} ziel={aufgaben}><CircleCheckBig size={18} strokeWidth={2} aria-hidden /></Teil>
    </div>
  );
}
