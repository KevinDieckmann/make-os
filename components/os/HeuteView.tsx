'use client';

// ─── MAKE OS — Heute ────────────────────────────────────────────────────────
// Die Seite nach der Anmeldung. Eine Frage: Was ist heute dran? Der
// Wachstums-Score steht seit 24.09. als Kopf über JEDER Seite (WachstumsKopf),
// deshalb hier nicht noch einmal. Seit 26.09. ist Heute eine Fläche (Kevin:
// „seine eigene Seite vorne soll man sich selber gestalten“): jede Person
// ordnet, blendet aus, stellt ein, holt Widgets aus dem Katalog — der
// Standard unten ist der Aufbau, den Kevin und Malin bisher hatten.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite } from './schlank';
import { Flaeche } from './flaeche/Flaeche';
import type { StandardPlatz } from '@/lib/flaeche/modell';

/** Der Startstand: links (⅔) Aufgaben, Termine, Wer dran ist — rechts (⅓) Fokus, Körper, Finanzen privat, Jarvis. */
export const HEUTE_STANDARD: StandardPlatz[] = [
  { id: 'aufgaben', art: 'aufgaben', breite: 4 },
  { id: 'fokus', art: 'fokus', breite: 2 },
  { id: 'termine', art: 'termine', breite: 4 },
  { id: 'koerper', art: 'koerper', breite: 2 },
  { id: 'dran', art: 'dran', breite: 4 },
  { id: 'finanzen-privat', art: 'finanzen-privat', breite: 2 },
  { id: 'jarvis', art: 'jarvis', breite: 2 },
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
  const abend = new Date().getHours() >= 17;
  return (
    <Seite titel={<>{gruss}{vorname ? `, ${vorname}` : ''}</>} unter={<span suppressHydrationWarning>{datum} · <Link href={`/os/ritual?modus=${abend ? 'abend' : 'morgen'}`} style={{ color: C.inkDim }}>{abend ? 'Tagesende' : 'Tagesstart'} ›</Link></span>}>
      <Flaeche seite="heute" widgets={HEUTE_STANDARD} />
    </Seite>
  );
}
