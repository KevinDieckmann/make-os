'use client';

// ─── MAKE OS — Datenbasis (Datenstand aus der Einrichtung) ──────────────────
// Onboarding B8 (Update 2, 16.10., ONBOARDING_PLAN.md A5): EIN Bild, welche Daten das System trägt — je Bereich „gepflegt / leer / veraltet /
// offen“, jede Zeile mit dem Weg dorthin, wo eingetragen wird. Gebaut aus DENSELBEN Prüfungen wie die Einrichtung (/api/onboarding →
// lib/onboarding-status.ts): nur ja/nein und Zähler, serverseitig nach Rechten gefiltert (B11 — wer die Privat-Finanzen nicht sehen darf,
// bekommt ihre Befunde gar nicht, also auch keine Zeile). Die alten Lesewege (Monatswerte aus `state/finance`, `state/kunden`, Produkte aus
// dem Finanzplan, feste Namen und eine erfundene Agenten-Zahl) sind raus — keine zweite Wahrheit neben der Einrichtung.

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { MODULE, datenStandVon, fassungFuer, modulVon, schrittFuer, sichtbarFuer, SCHRITTE, texteFuer, type DatenStand, type Modul, type Schritt } from '@/lib/make-one/onboarding-data';
import { useOnboarding, DatenkarteKarte, type Zustand } from './OnboardingView';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Punkt, Zahl, Fortschritt, Hinweis, LEUCHT } from './ui';

const STAND: Record<DatenStand, { label: string; farbe: string }> = {
  gepflegt: { label: 'gepflegt', farbe: LEUCHT.gut },
  leer: { label: 'leer', farbe: C.inkLeise },
  veraltet: { label: 'veraltet', farbe: LEUCHT.achtung },
  offen: { label: 'offen', farbe: LEUCHT.kritisch },
  unbekannt: { label: 'ohne Prüfung', farbe: C.inkLeise },
};
const absatz: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 };

/**
 * Die Zeilen dieser Person: Schritte MIT Prüfung, die sie hat oder (gemeinsam) sieht — und nur, wenn der Server ihr den Befund gibt (B11:
 * fehlt der Befund, fehlt die Zeile). Rein, aus Konto + Befunden.
 */
export function datenbasisZeilen(z: Pick<Zustand, 'befunde' | 'ich'> | null): { s: Schritt; stand: DatenStand }[] {
  if (!z) return [];
  // In der Fassung dieser Instanz (Neustart: Nummer und Texte des Neustarts, `fassungFuer`).
  return SCHRITTE
    .filter(s => !!s.pruefung && !!z.befunde[s.pruefung] && (schrittFuer(s, z.ich) || (s.ebene === 'gemeinsam' && sichtbarFuer(s, z.ich))))
    .map(s => ({ s: fassungFuer(s, z.ich), stand: datenStandVon(z.befunde[s.pruefung!]) }));
}

export function DatenbasisView() {
  const { z, meldung } = useOnboarding();
  const zeilen = datenbasisZeilen(z);
  const zahl = (st: DatenStand) => zeilen.filter(x => x.stand === st).length;
  const offen = zahl('offen'), veraltet = zahl('veraltet'), gepflegt = zahl('gepflegt'), leer = zahl('leer');
  const ampel = offen ? LEUCHT.kritisch : veraltet ? LEUCHT.achtung : LEUCHT.gut;
  // Je Bereich (Modul) in der Reihenfolge der Module — Bereiche ohne Zeile fallen weg.
  const bereiche = (Object.keys(MODULE) as Modul[]).map(m => ({ m, liste: zeilen.filter(x => modulVon(x.s) === m) })).filter(b => b.liste.length);

  return (
    <Seite titel="Datenbasis" unter="Was das System trägt — aus denselben Prüfungen wie die Einrichtung.">
      {meldung && <Hinweis art="achtung" rolle="alert">{meldung}</Hinweis>}
      <Karte i={0} ton={z ? ampel : undefined}>
        <Ueberschrift farbe={z ? ampel : C.inkLeise} rechts={z ? `${gepflegt} von ${zeilen.length} gepflegt` : undefined}>Datenstand</Ueberschrift>
        {!z ? <Leer>prüfe die Bestände …</Leer> : (
          <>
            <div style={{ fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.01em', marginBottom: 14 }}>
              {offen ? `${offen} ${offen === 1 ? 'Bereich ist' : 'Bereiche sind'} offen` : veraltet ? `${veraltet} ${veraltet === 1 ? 'Stand ist' : 'Stände sind'} veraltet` : 'Alles Geprüfte ist gepflegt'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
              <Zahl wert={gepflegt ? String(gepflegt) : undefined} label="gepflegt" farbe={LEUCHT.gut} />
              <Zahl wert={veraltet ? String(veraltet) : undefined} label="veraltet" farbe={LEUCHT.achtung} />
              <Zahl wert={offen ? String(offen) : undefined} label="offen" farbe={LEUCHT.kritisch} />
              <Zahl wert={leer ? String(leer) : undefined} label="leer" farbe={C.inkLeise} />
            </div>
            <div style={{ marginTop: 14 }}><Fortschritt anteil={zeilen.length ? gepflegt / zeilen.length : 0} farbe={ampel} /></div>
            <p style={{ ...absatz, marginTop: 12 }}>
              „Leer“ heißt: es gibt noch nichts zu prüfen (z. B. kein laufendes Mandat) — dann zählt in der <Link href="/os/onboarding" style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>Einrichtung ›</Link> euer Häkchen.
              Prüfungen zeigen nur ja/nein und Zähler, nie Werte.
            </p>
          </>
        )}
      </Karte>

      {bereiche.map((b, i) => (
        <Karte key={b.m} i={Math.min(1 + i, 6)}>
          <Ueberschrift rechts={`${b.liste.filter(x => x.stand === 'gepflegt').length} von ${b.liste.length}`}>{MODULE[b.m]}</Ueberschrift>
          <Liste>
            {b.liste.map(({ s, stand }) => (
              <Link key={s.id} href={s.wo?.href ?? '/os/onboarding'} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Zeile onClick={() => {}} umbrechen
                  links={<Punkt farbe={STAND[stand].farbe} />}
                  titel={texteFuer(s, z?.ich).titel}
                  unter={<span style={{ color: stand === 'gepflegt' || stand === 'leer' ? C.inkLeise : STAND[stand].farbe }}>{z!.befunde[s.pruefung!].wert}</span>}
                  rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Chip farbe={STAND[stand].farbe}>{STAND[stand].label}</Chip><span style={{ color: C.inkLeise }}>›</span></span>} />
              </Link>
            ))}
          </Liste>
        </Karte>
      ))}

      <DatenkarteKarte i={6} altbestand={!!z?.ich?.altbestand} />
    </Seite>
  );
}
