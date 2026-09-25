'use client';

// ─── Text mit anklickbaren Verweisen in die App (25.09.) ────────────────────
// Aufgaben aus Übergaben, Heads und Event-Checklisten tragen ihren Ort als
// Pfad in der Beschreibung („/os/markttraktion?s=event&k=…“). Bis heute stand
// der nur als Text da. Hier wird jeder Pfad unter /os/ ein Link (mit
// Verlaufseintrag, also kommt man mit Zurück wieder in die Aufgabe).

import Link from 'next/link';
import { Fragment } from 'react';
import { FARBE as C } from '@/lib/make-one/design';

const PFAD = /(\/os\/[A-Za-z0-9_\-/]*(?:\?[A-Za-z0-9_\-=&%.]*)?)/g;

/** Freundlicher Name für einen Pfad — statt der nackten Adresse. */
function name(pfad: string): string {
  const [p, q = ''] = pfad.split('?');
  const s = new URLSearchParams(q).get('s');
  if (p.startsWith('/os/markttraktion')) return s === 'event' ? 'Event öffnen' : s === 'kontakte' ? 'Person öffnen' : s === 'firmen' ? 'Firma öffnen' : s === 'sales' ? 'In Sales öffnen' : s === 'marketing' ? 'In Marketing öffnen' : 'In der Markttraktion öffnen';
  if (p.startsWith('/os/mandate')) return new URLSearchParams(q).get('s') === 'produkte' ? 'Produkt öffnen' : 'Mandat öffnen';
  if (p.startsWith('/os/finanzen')) return 'In Zahlen öffnen';
  if (p.startsWith('/os/aufgaben')) return 'Aufgabe öffnen';
  if (p.startsWith('/os/gesundheit')) return 'In Gesundheit öffnen';
  if (p.startsWith('/os/wissen')) return 'Im Brain öffnen';
  return 'Öffnen';
}

export function TextMitLinks({ text, style }: { text: string; style?: React.CSSProperties }) {
  const teile = text.split(PFAD);
  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, ...style }}>
      {teile.map((t, i) => (i % 2 === 1
        ? <Link key={i} href={t} style={{ color: C.aktiv, textDecoration: 'underline', textUnderlineOffset: 3 }}>{name(t)} ›</Link>
        : <Fragment key={i}>{t}</Fragment>))}
    </div>
  );
}
