'use client';

// ─── MAKE OS — System ───────────────────────────────────────────────────────
// Das Zahnrad: alles, was nicht der Alltag ist. Eine Liste, keine Kacheln.

import Link from 'next/link';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile } from './schlank';
import { Flaeche, Kachel } from './flaeche/Flaeche';

const GRUPPEN: { titel: string; eintraege: { href: string; label: string; was: string }[] }[] = [
  // Alles, was seit 24.09. abends im Kopf oben liegt — hier noch einmal zum Nachschlagen.
  { titel: 'Alle Bereiche', eintraege: [
    { href: '/os', label: 'Heute', was: 'der Tag auf einen Blick' },
    { href: '/os/inbox', label: 'Inbox', was: 'Postfächer, priorisiert' },
    { href: '/os/wachstum', label: 'Wachstum', was: 'der Score über allem' },
    { href: '/os/gesundheit', label: 'Gesundheit', was: 'Körper, Journal, Ernährung' },
    { href: '/os/finanzen', label: 'Zahlen', was: 'Privat, Business, Gesamt, Head of Finance' },
    { href: '/os/familie', label: 'Familie & Partnerschaft', was: 'wir zwei zuerst, dann die Familie' },
    { href: '/os/markttraktion', label: 'Markttraktion', was: 'Sales, Marketing und Event — Traction-Score, Power Hour, Kampagnen, Kontakte und Firmen' },
  ] },
  { titel: 'Jarvis', eintraege: [
    { href: '/os/stapel', label: 'Aufträge & Freigaben', was: 'was vorbereitet ist und auf dich wartet' },
    { href: '/os/agenten', label: 'Agenten', was: 'wer live ist, wer nicht — und warum' },
    { href: '/os/loop', label: 'Loops', was: 'die Regelkreise' },
  ] },
  { titel: 'Zugang & Daten', eintraege: [
    { href: '/os/konto', label: 'Konto', was: 'Name, Passwort, Telegram, Einladen, Gesundheit teilen' },
    { href: '/os/verbindungen', label: 'Verbindungen', was: 'Whoop, Microsoft, Miro' },
    { href: '/os/datenbasis', label: 'Datenbasis', was: 'wo welche Zahl herkommt' },
    { href: '/os/stammdaten', label: 'Stammdaten', was: 'Firmen, Konten, Adressen' },
  ] },
  { titel: 'Bauen', eintraege: [
    { href: '/os/bauplan', label: 'Bauplan', was: 'was als Nächstes gebaut wird' },
    { href: '/os/roadmap', label: 'Roadmap', was: 'der lange Weg' },
    { href: '/os/onboarding', label: 'Onboarding', was: 'die Einrichtungsspur je Person' },
    { href: '/os/research', label: 'Research', was: 'Recherche-Agent' },
    { href: '/os/content', label: 'Content', was: 'Text-Agent' },
  ] },
];

export function SystemView() {
  return (
    <Seite titel="System" unter="Alles, was nicht täglich ist: Jarvis, Zugang, Bauen.">
      <Flaeche seite="system">
      {GRUPPEN.map((g, i) => (
        <Kachel key={g.titel} id={g.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')} titel={g.titel} breite={2}>
        <Karte i={i}>
          <Ueberschrift>{g.titel}</Ueberschrift>
          <Liste>
            {g.eintraege.map(e => (
              <Link key={e.href} href={e.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Zeile onClick={() => {}} titel={e.label} unter={e.was} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
              </Link>
            ))}
          </Liste>
        </Karte>
        </Kachel>
      ))}
      </Flaeche>
    </Seite>
  );
}
