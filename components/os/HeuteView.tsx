'use client';

// ─── MAKE OS — Heute: die eine Startseite (Aufräumen Etappe 1, 08.10.) ──────
// Kevin (08.10.): „Die Software wirkt unaufgeräumt und überladen, ich weiß gar nicht mehr wo alles ist.“ Bis dahin gab es
// vier Startseiten — Home (/os), Heute (/os/heute), Übersicht je Space (/os/uebersicht?space=) und Wachstum. Jetzt ist /os
// „Heute“: Gruß und Datum EINMAL oben, darunter die gestaltbare Fläche (Kevin 26.09.: „seine eigene Seite vorne soll man sich
// selber gestalten“) — je Bereich des Kopf-Schalters (`?space=` gewinnt; seit 09.10. immer Privat oder Business). Standard: Steht an, Fokus,
// Termine, Aufgaben, Index und Wachstums-Score als Karten (der Score und der Index standen bis 08.10. im Kopf).
//
// Die gespeicherten Layouts bleiben: die Flächen-Kennungen sind die alten (`home` = bis 09.10. zusammen, `uebersicht-privat`,
// `uebersicht-business`), neue Karten rutschen über `anwenden` an ihre Standardstelle. /os/heute und /os/uebersicht leiten
// hierher (next.config.mjs, der Space-Parameter wandert mit). Wachstum bleibt eine eigene Seite (Score-Karte, Planung).
//
// Nachbesserung 08.10. (Kevin: „ein Schalter, oben“): Heute hat KEINE eigene Umschaltung mehr — die Sicht folgt dem Schalter im
// Kopf (`useSpace().wahl`).
//
// Nur zwei Bereiche (09.10., Kevin: „Oben der Knopf ‚Alles‘ kann raus — es gibt nur Business oder Privat. Und die Zeit wird jedes
// Mal im Hintergrund gemessen, und dann sehen wir das Ganze.“): Heute ist immer Privat ODER Business. Die Fläche `home` (die
// frühere Sicht „Alles“) wird nicht mehr gezeigt — gespeicherte Layouts darunter bleiben liegen, nichts wird gelöscht. „Das Ganze“
// zeigt in beiden Sichten die Zeit-Karte Privat gegen Business (Widget `zeit` mit `space: 'beide'`: heute, 7 Tage, Anteil).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite, ZielBezug } from './ui';
import { Flaeche } from './flaeche/Flaeche';
import { Anlaesse } from './kalender/Anlaesse';
import { BusinessFreiStatus } from './arbeitsrahmen/BusinessFrei';
import { useSpace } from '@/hooks/useSpace';
import type { StandardPlatz } from '@/lib/flaeche/modell';
import type { SpaceId } from '@/lib/make-one/space-regeln';

/** Die Sicht von Heute = der Bereich im Kopf (seit 09.10. nur Privat oder Business). */
export type HeuteSicht = SpaceId;

/**
 * Flächen-Kennung je Sicht — die alten Namen, damit kein gespeichertes Layout verloren geht. Die frühere Sicht „Alles“ hieß `home`;
 * sie wird seit 09.10. nicht mehr gezeigt, ihre gespeicherten Layouts bleiben liegen (`HEUTE_FLAECHE_FRUEHER_ALLES`, nie löschen).
 */
export const HEUTE_FLAECHE: Record<HeuteSicht, string> = { privat: 'uebersicht-privat', business: 'uebersicht-business' };
export const HEUTE_FLAECHE_FRUEHER_ALLES = 'home';

/**
 * Der Standard je Sicht (wird nie gespeichert). Kennungen der bisherigen Übersichts-Standards bleiben gleich. „Zeit“ (09.10.) steht
 * in beiden Sichten gleich hinter dem Index: Privat gegen Business, heute und 7 Tage — so sieht man „das Ganze“ in jedem Bereich.
 */
export const HEUTE_STANDARD: Record<HeuteSicht, StandardPlatz[]> = {
  privat: [
    // Einrichtung (08.10. spät, Onboarding B5): vorne, solange die eigene Einrichtung offen ist — `anwenden` setzt sie auch in angepasste Layouts.
    { id: 'einrichtung', art: 'einrichtung', breite: 6 },
    { id: 'anstehend', art: 'anstehend', breite: 4 },
    { id: 'fokus', art: 'fokus', breite: 2, einstellungen: { space: 'privat' } },
    { id: 'termine', art: 'termine', breite: 4, einstellungen: { tage: 3, space: 'privat' }, titel: 'Nächste 3 Tage · Privat' },
    { id: 'index', art: 'index', breite: 2, einstellungen: { saeule: 'privat' } },
    { id: 'zeit', art: 'zeit', breite: 2, einstellungen: { space: 'beide' } },
    { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'privat', nur: 'dran' } },
    { id: 'koerper', art: 'koerper', breite: 2 },
    { id: 'finanzen-privat', art: 'finanzen-privat', breite: 2 },
    { id: 'familie', art: 'familie', breite: 2 },
    { id: 'essen', art: 'essen', breite: 2 },
    { id: 'routinen', art: 'routinen', breite: 2 },
    { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } },
    { id: 'score', art: 'score', breite: 2 },
  ],
  business: [
    { id: 'einrichtung', art: 'einrichtung', breite: 6 },
    { id: 'anstehend', art: 'anstehend', breite: 4 },
    { id: 'fokus', art: 'fokus', breite: 2, einstellungen: { space: 'business' } },
    { id: 'termine', art: 'termine', breite: 4, einstellungen: { tage: 3, space: 'business', business: true }, titel: 'Nächste 3 Tage · Business' },
    { id: 'index', art: 'index', breite: 2, einstellungen: { saeule: 'business' } },
    { id: 'zeit', art: 'zeit', breite: 2, einstellungen: { space: 'beide' } },
    { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'business', nur: 'dran' } },
    { id: 'traktion', art: 'index', breite: 2, einstellungen: { saeule: 'traktion' } },
    { id: 'dran', art: 'dran', breite: 2 },
    { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } },
    { id: 'score', art: 'score', breite: 2 },
  ],
};

export function HeuteView() {
  // Die Sicht folgt dem Schalter im Kopf (die Adresse `?space=` gewinnt dort schon) — kein zweiter Schalter hier.
  const sicht: HeuteSicht = useSpace().wahl;
  const [datum, setDatum] = useState('');
  const [gruss, setGruss] = useState('Hallo');
  const [vorname, setVorname] = useState('');
  const [abend, setAbend] = useState(false);
  useEffect(() => {
    const jetzt = new Date();
    setDatum(jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    setGruss(jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend');
    setAbend(jetzt.getHours() >= 17);
    fetch('/api/konto/ich').then(r => r.json()).then(d => setVorname((d.ich?.name ?? '').split(' ')[0])).catch(() => {});
  }, []);
  return (
    <Seite titel="Heute"
      unter={<span suppressHydrationWarning>{gruss}{vorname ? `, ${vorname}` : ''} · {datum} · <Link href={`/os/ritual?modus=${abend ? 'abend' : 'morgen'}`} style={{ color: C.inkDim }}>{abend ? 'Tagesende' : 'Tagesstart'} ›</Link></span>}
>
      {/* K2 (29.09.): Feiertag NRW heute/morgen. Geburtstage stehen nur in „Steht an“ (F2 M2, eine Stelle). */}
      <Anlaesse geburtstage={false} />
      {/* Business-frei (08.10., Lücke 7): nur die eigene Person, nur solange es gilt. */}
      <BusinessFreiStatus />
      {sicht === 'privat' && <ZielBezug bereich="privat" max={2} />}
      <Flaeche key={sicht} seite={HEUTE_FLAECHE[sicht]} widgets={HEUTE_STANDARD[sicht]} />
    </Seite>
  );
}
