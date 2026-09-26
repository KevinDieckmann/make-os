'use client';

// ─── MAKE OS — Home ─────────────────────────────────────────────────────────
// Die Seite nach der Anmeldung. Eine Frage: Was ist heute dran? Der
// Seit 26.09. abends heißt sie „Home“ (Kevin): der Überblick über Privat und Business
// zusammen, jede Person klickt sich ihr eigenes Dashboard zusammen. Seit 26.09. ist Heute eine Fläche (Kevin:
// „seine eigene Seite vorne soll man sich selber gestalten“): jede Person
// ordnet, blendet aus, stellt ein, holt Widgets aus dem Katalog — der
// Standard unten ist der Aufbau, den Kevin und Malin bisher hatten.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite } from './schlank';
import { Flaeche } from './flaeche/Flaeche';
import type { StandardPlatz } from '@/lib/flaeche/modell';

/** Der Startstand: oben Score · Fokus · Jarvis, dann Aufgaben (⅔) + Körper, Termine (⅔) + Finanzen privat, Wer dran ist. */
export const HEUTE_STANDARD: StandardPlatz[] = [
  // Home (Kevin 26.09.): „erstmal der Überblick über Business und Privat jeweils zusammengeholt“ —
  // links Privat, rechts Business; jede Person baut sich das über „Anpassen“ um.
  { id: 'index-privat', art: 'index', breite: 3, einstellungen: { saeule: 'privat' }, titel: 'Privat · Index' },
  { id: 'index-business', art: 'index', breite: 3, einstellungen: { saeule: 'business' }, titel: 'Business · Index' },
  { id: 'aufgaben-privat', art: 'aufgaben', breite: 3, einstellungen: { space: 'privat', nur: 'dran' }, titel: 'Aufgaben · Privat' },
  { id: 'aufgaben-business', art: 'aufgaben', breite: 3, einstellungen: { space: 'business', nur: 'dran' }, titel: 'Aufgaben · Business' },
  { id: 'finanzen-privat', art: 'finanzen-privat', breite: 3 },
  { id: 'dran', art: 'dran', breite: 3 },
  { id: 'koerper', art: 'koerper', breite: 3 },
  { id: 'jarvis', art: 'jarvis', breite: 3, einstellungen: { inbox: true } },
  { id: 'termine', art: 'termine', breite: 3, einstellungen: { tage: 3, business: true }, titel: 'Nächste 3 Tage' },
  { id: 'fokus', art: 'fokus', breite: 3 },
  { id: 'score', art: 'score', breite: 3 },
];

export function HeuteView() {
  const [datum, setDatum] = useState('');
  const [gruss, setGruss] = useState('Hallo');
  const [vorname, setVorname] = useState('');
  useEffect(() => {
    const jetzt = new Date();
    setDatum(jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    setGruss(jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend');
    fetch('/api/konto/ich').then(r => r.json()).then(d => setVorname((d.ich?.name ?? '').split(' ')[0])).catch(() => {});
  }, []);
  return (
    <Seite titel="Home" unter={<span suppressHydrationWarning>{gruss}{vorname ? `, ${vorname}` : ''} · {datum} · dein Dashboard, Privat und Business zusammen — über „Anpassen“ frei gestaltbar · <Link href="/os/heute" style={{ color: C.inkDim }}>Heute ›</Link></span>}>
      <Flaeche seite="heute" widgets={HEUTE_STANDARD} />
    </Seite>
  );
}
