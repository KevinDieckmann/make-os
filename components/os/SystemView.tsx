'use client';

// ─── MAKE OS — System ───────────────────────────────────────────────────────
// Das Zahnrad: alles, was nicht der Alltag ist. Eine Liste, keine Kacheln.

import Link from 'next/link';
import { FARBE as C } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile } from './ui';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { MeldenKnopf } from './Leiste';
import { DemoKarte } from './DemoKarte';
import { TYP } from '@/lib/make-one/design';

const GRUPPEN: { titel: string; eintraege: { href: string; label: string; was: string }[] }[] = [
  // Alles, was seit 24.09. abends im Kopf oben liegt — hier noch einmal zum Nachschlagen.
  { titel: 'Alle Bereiche', eintraege: [
    { href: '/os', label: 'Home', was: 'dein Dashboard, frei gestaltbar' },
    { href: '/os/heute', label: 'Heute', was: 'der Tag auf einen Blick' },
    { href: '/os/wachstum', label: 'Wachstum', was: 'die Gesamtansicht und der Score' },
    { href: '/os/inbox', label: 'Inbox', was: 'Postfächer, priorisiert' },
    { href: '/os/wachstum', label: 'Wachstum', was: 'der Score über allem' },
    { href: '/os/gesundheit', label: 'Gesundheit', was: 'Körper, Journal, Ernährung' },
    { href: '/os/finanzen', label: 'Zahlen', was: 'Privat, Business, Gesamt, Head of Finance' },
    { href: '/os/familie', label: 'Familie & Partnerschaft', was: 'wir zwei zuerst, dann die Familie' },
    { href: '/os/markttraktion', label: 'Markttraktion', was: 'Sales, Marketing und Event — Traction-Score, Power Hour, Kampagnen, Kontakte und Firmen' },
  ] },
  { titel: 'ZOE', eintraege: [
    { href: '/os/stapel', label: 'Aufträge & Freigaben', was: 'was vorbereitet ist und auf dich wartet' },
    { href: '/os/agenten', label: 'Agenten', was: 'wer live ist, wer nicht — und warum' },
    { href: '/os/loop', label: 'Loops', was: 'die Regelkreise' },
    { href: '/os/hoi', label: 'Head of IT', was: 'Server, App, Sicherheit und der Blick von außen — in Ampeln' },
  ] },
  { titel: 'Zugang & Daten', eintraege: [
    { href: '/os/konto', label: 'Konto', was: 'Name, Passwort, Telegram, Einladen, Gesundheit teilen' },
    { href: '/os/datenschutz', label: 'Datenschutz', was: 'Gesundheits-Einwilligung, KI-Schalter, Telegram, KI-Protokoll' },
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
    <Seite titel="System" unter="Alles, was nicht täglich ist: ZOE, Zugang, Bauen."
      // Am Handy steht in der Leiste unten jetzt Netzwerken — „Problem oder Idee melden“ bleibt hier und im Blatt von Privat/Business erreichbar.
      rechts={<MeldenKnopf zu={false} stil={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600 }} />}>
      {/* Nur in einer Demo-Instanz und nur für ihren Inhaber (GET /api/demo — sonst 404, die Karte bleibt weg). */}
      <DemoKarte />
      <Flaeche seite="system">
      {GRUPPEN.map((g, i) => (
        <Kachel key={g.titel} id={g.titel.toLowerCase().replace(/[^a-z0-9]+/g, '-')} titel={g.titel} breite={2}>
        <Karte i={i}>
          <Ueberschrift>{g.titel}</Ueberschrift>
          <Liste>
            {g.eintraege.map((e, j) => (
              <Link key={`${e.href}#${j}`} href={e.href} style={{ textDecoration: 'none', color: 'inherit' }}>
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
