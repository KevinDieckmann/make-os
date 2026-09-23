'use client';

// ─── MAKE OS — System ───────────────────────────────────────────────────────
// Das Zahnrad: alles, was nicht der Alltag ist. Eine Liste, keine Kacheln.

import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP, ABSTAND as A } from '@/lib/make-one/design';

const GRUPPEN: { titel: string; eintraege: { href: string; label: string; was: string }[] }[] = [
  { titel: 'Weitere Bereiche', eintraege: [
    { href: '/os/finanzen', label: 'Zahlen', was: 'Liquidität, Konten, Buchungen' },
    { href: '/os/crm', label: 'Kontakte', was: 'wer heute dran ist, alle Kontakte, Mandate' },
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
    { href: '/os/start', label: 'Startfläche', was: 'das Widget-Brett — zum Ziehen und Ablegen' },
    { href: '/os/uebersicht', label: 'Übersicht (alt)', was: 'das frühere Dashboard, bis nichts mehr fehlt' },
  ] },
];

export function SystemView() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: `34px clamp(20px,4vw,56px) 60px`, color: C.ink, fontFamily: SCHRIFT.text }}>
      <h1 style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 22, letterSpacing: '-.02em', margin: `0 0 ${A.xl}px` }}>System</h1>
      {GRUPPEN.map(g => (
        <section key={g.titel} style={{ marginBottom: A.xl }}>
          <h2 style={{ fontSize: 12, fontWeight: 600, color: C.inkLeise, letterSpacing: '.04em', textTransform: 'uppercase', margin: '0 0 4px' }}>{g.titel}</h2>
          <div style={{ borderTop: `1px solid ${C.linie}` }}>
            {g.eintraege.map(e => (
              <Link key={e.href} href={e.href} className="fassbar" style={{ display: 'flex', alignItems: 'baseline', gap: A.m, padding: '12px 2px', borderBottom: `1px solid ${C.linie}`, textDecoration: 'none', color: C.ink }}>
                <span style={{ fontSize: TYP.body, fontWeight: 500, minWidth: 200 }}>{e.label}</span>
                <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{e.was}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
