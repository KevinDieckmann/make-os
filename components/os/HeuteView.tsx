'use client';

// ─── MAKE OS — Heute: die eine Startseite (Aufräumen Etappe 1, 08.10.) ──────
// Kevin (08.10.): „Die Software wirkt unaufgeräumt und überladen, ich weiß gar nicht mehr wo alles ist.“ Bis dahin gab es
// vier Startseiten — Home (/os), Heute (/os/heute), Übersicht je Space (/os/uebersicht?space=) und Wachstum. Jetzt ist /os
// „Heute“: Gruß und Datum EINMAL oben, darunter die gestaltbare Fläche (Kevin 26.09.: „seine eigene Seite vorne soll man sich
// selber gestalten“) — ohne Space Privat und Business zusammen, mit `?space=` nur dieser Space. Standard: Steht an, Fokus,
// Termine, Aufgaben, Index und Wachstums-Score als Karten (der Score und der Index standen bis 08.10. im Kopf).
//
// Die gespeicherten Layouts bleiben: die Flächen-Kennungen sind die alten (`home` = zusammen, `uebersicht-privat`,
// `uebersicht-business`), neue Karten rutschen über `anwenden` an ihre Standardstelle. /os/heute und /os/uebersicht leiten
// hierher (next.config.mjs, der Space-Parameter wandert mit). Wachstum bleibt eine eigene Seite (Score-Karte, Planung).
//
// Nachbesserung 08.10. (Kevin: „ein Schalter, oben, mit Alles“): Heute hat KEINE eigene Umschaltung mehr — die Sicht folgt dem
// Schalter im Kopf (`useSpace().wahl`: Alles → `home`, Privat, Business).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite, ZielBezug } from './ui';
import { Flaeche } from './flaeche/Flaeche';
import { Anlaesse } from './kalender/Anlaesse';
import { BusinessFreiStatus } from './arbeitsrahmen/BusinessFrei';
import { useSpace } from '@/hooks/useSpace';
import type { StandardPlatz } from '@/lib/flaeche/modell';

export type HeuteSicht = 'alle' | 'privat' | 'business';

/** Flächen-Kennung je Sicht — die alten Namen, damit kein gespeichertes Layout verloren geht. */
export const HEUTE_FLAECHE: Record<HeuteSicht, string> = { alle: 'home', privat: 'uebersicht-privat', business: 'uebersicht-business' };

/** Der Standard je Sicht (wird nie gespeichert). Kennungen der bisherigen Home-/Übersichts-Standards bleiben gleich. */
export const HEUTE_STANDARD: Record<HeuteSicht, StandardPlatz[]> = {
  alle: [
    // Einrichtung (08.10. spät, Onboarding B5): vorne, solange die eigene Einrichtung offen ist — `anwenden` setzt sie auch in angepasste Layouts.
    { id: 'einrichtung', art: 'einrichtung', breite: 6 },
    { id: 'anstehend', art: 'anstehend', breite: 4 },
    { id: 'fokus', art: 'fokus', breite: 2 },
    { id: 'termine', art: 'termine', breite: 3, einstellungen: { tage: 3, business: true }, titel: 'Nächste 3 Tage' },
    { id: 'zoe', art: 'zoe', breite: 3, einstellungen: { inbox: true } },
    { id: 'aufgaben-privat', art: 'aufgaben', breite: 3, einstellungen: { space: 'privat', nur: 'dran' }, titel: 'Aufgaben · Privat' },
    { id: 'aufgaben-business', art: 'aufgaben', breite: 3, einstellungen: { space: 'business', nur: 'dran' }, titel: 'Aufgaben · Business' },
    // Heute fällige Routinen (27.09., Malin): je Space, abhakbar — verschwinden, wenn nichts dran ist.
    { id: 'routinen-heute-privat', art: 'routinen-heute', breite: 3, einstellungen: { space: 'privat' }, titel: 'Routinen heute · Privat' },
    { id: 'routinen-heute-business', art: 'routinen-heute', breite: 3, einstellungen: { space: 'business' }, titel: 'Routinen heute · Business' },
    { id: 'koerper', art: 'koerper', breite: 3 },
    { id: 'finanzen-privat', art: 'finanzen-privat', breite: 3 },
    { id: 'dran', art: 'dran', breite: 3 },
    { id: 'score', art: 'score', breite: 3 },
    { id: 'index-privat', art: 'index', breite: 3, einstellungen: { saeule: 'privat' }, titel: 'Privat · Index' },
    { id: 'index-business', art: 'index', breite: 3, einstellungen: { saeule: 'business' }, titel: 'Business · Index' },
  ],
  privat: [
    { id: 'einrichtung', art: 'einrichtung', breite: 6 },
    { id: 'anstehend', art: 'anstehend', breite: 4 },
    { id: 'fokus', art: 'fokus', breite: 2, einstellungen: { space: 'privat' } },
    { id: 'termine', art: 'termine', breite: 4, einstellungen: { tage: 3, space: 'privat' }, titel: 'Nächste 3 Tage · Privat' },
    { id: 'index', art: 'index', breite: 2, einstellungen: { saeule: 'privat' } },
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
    { id: 'aufgaben', art: 'aufgaben', breite: 4, einstellungen: { space: 'business', nur: 'dran' } },
    { id: 'traktion', art: 'index', breite: 2, einstellungen: { saeule: 'traktion' } },
    { id: 'dran', art: 'dran', breite: 2 },
    { id: 'zoe', art: 'zoe', breite: 2, einstellungen: { inbox: true } },
    { id: 'score', art: 'score', breite: 2 },
  ],
};

/** Wahl im Kopf (bzw. `?space=`) → Sicht; alles andere = zusammen. */
export const heuteSicht = (space: string | null | undefined): HeuteSicht => (space === 'privat' || space === 'business' ? space : 'alle');

export function HeuteView() {
  // Die Sicht folgt dem Schalter im Kopf (die Adresse `?space=` gewinnt dort schon) — kein zweiter Schalter hier.
  const sicht = heuteSicht(useSpace().wahl);
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
