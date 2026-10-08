'use client';

// ─── MAKE OS — Einstellungen (bis 08.10. „System“, Adresse bleibt /os/system) ─
// Aufräumen Etappe 1 (Kevin 08.10.: „ich weiß gar nicht mehr wo alles ist“): vier klare Gruppen, jede Seite genau einmal —
// Konto & Sicherheit · Verbindungen · Daten & Datenschutz · Betrieb (Liste in lib/make-one/einstellungen.ts). ZOE, Agenten,
// Freigaben, Loops und Brain liegen unter ZOE in der Leiste; Research, Content, Meeting, Board und Prospecting über ZOE › Agenten.

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile } from './ui';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { MeldenKnopf } from './Leiste';
import { DemoKarte } from './DemoKarte';
import { EINSTELLUNGEN_GRUPPEN } from '@/lib/make-one/einstellungen';

export function SystemView() {
  return (
    <Seite titel="Einstellungen"
      // Am Handy steht in der Leiste unten Netzwerken — „Problem oder Idee melden“ bleibt hier und im Blatt von Privat/Business erreichbar.
      rechts={<MeldenKnopf zu={false} stil={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 14px', borderRadius: 11, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600 }} />}>
      {/* Nur in einer Demo-Instanz und nur für ihren Inhaber (GET /api/demo — sonst 404, die Karte bleibt weg). */}
      <DemoKarte />
      {/* Fläche „system“ wie bisher: die alten Kacheln (andere Kennungen) fallen beim Lesen weg, eigene Widgets bleiben. */}
      <Flaeche seite="system">
      {EINSTELLUNGEN_GRUPPEN.map((g, i) => (
        <Kachel key={g.id} id={g.id} titel={g.titel} breite={3}>
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
