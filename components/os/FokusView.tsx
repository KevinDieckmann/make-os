'use client';

// ─── MAKE OS — Fokus (neu 24.09.) ───────────────────────────────────────────
// Kevin: „Fokus, das haben wir ja auch als riesiges Thema. Auch wenn es ein
// Score von Planung ist.“ Vorher lag Fokus über fünf Stellen verstreut, und
// /os/fokus leitete auf Gesundheit um. Jetzt eine Seite:
//   1. Unser Fokus — ein Satz für heute, die Woche, den Monat (ziele.fokus)
//   2. Tagesform — die echte Recovery von heute, auf Wunsch mit KI-Einordnung
//   3. Worauf die Energie geht — die Fokus-Regler je Säule (gepflegt im Kompass)
//   4. Zeit je Einheit + Fokus-Blöcke (27.09. spät) — bewusste Business-Zeit je Selbstständigkeit ·
//      KD Ventures · MAKE Innovation GmbH, Blöcke nachträglich einer Aufgabe/Einheit zuordnen
//   5. Zeit je Mandat (28.09., „Mandat an Zielen und Zeit“) — für Abrechnung und Auslastung
//   6. Lichtfäden (03.10.) — übergreifend (Wurzel Gesamt): alle Stränge, Engstellen, eine Ebene tiefer per Tippen
//   Fokus-Signatur (04.10., Schaufenster): „Unser Fokus“ ist DIE Fokus-Karte (Lichtfaden an der Kante, Netz-Motiv), die Regler
//   stehen als Segmentbalken, die Fokus-Blöcke tragen ihre Minuten je Tag als FadenLinie, darunter läuft der Strahl v3.
//   09.10. (Kevin: „dass wir selber alle immer Fokusse einstellen können … Muss ja auch wieder individuell sein“): die Fokus-Karte ist die
//   Fokus-Tafel (components/os/planung/FokusTafel.tsx) — je Bereich (Privat · Business, im Business je Gesellschaft) und Horizont (Jahr ·
//   Quartal · Monat · Woche · Heute) „Unser Fokus“ und „Mein Fokus“ (teilbar), getrennte Bestände (lib/planung/fokus.ts).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Rich } from './Rich';
import { Seite, Karte, Ueberschrift, Ring, Chip, Knopf, Leer, zoneFarbe, LEUCHT, Segmentbalken } from './ui';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { ZeitJeEinheitKarte, FokusBloeckeKarte } from './zeit/ZeitJeEinheit';
import { ZeitJeMandatKarte } from './zeit/ZeitJeMandat';
import { Lichtfaeden } from './lichtfaeden/Lichtfaeden';
import { PlanerLeiste } from './PlanerLeiste';
import { FokusTafel } from './planung/FokusTafel';
import { useSpace } from '@/hooks/useSpace';

const SAEULEN: Record<string, { name: string; farbe: string }> = {
  health: { name: 'Gesundheit', farbe: LEUCHT.gut }, business: { name: 'Business', farbe: LEUCHT.business }, planning: { name: 'Planung', farbe: LEUCHT.planung },
  finance: { name: 'Finanzen', farbe: LEUCHT.geld }, social: { name: 'Familie & Partnerschaft', farbe: LEUCHT.beziehung },
};

export function FokusView() {
  const { space } = useSpace();
  const [rec, setRec] = useState<number | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [regler, setRegler] = useState<Record<string, number> | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/gesundheit/stand').then(r => r.json()).then(d => { if (d?.vitals) { setRec(typeof d.vitals.rec === 'number' ? d.vitals.rec : null); setFrisch(!!(d.vitals.heute || (d.vitals.alterTage <= 1 && !d.vitals.fallback))); } }).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? null)).catch(() => {});
  }, []);

  async function ausrichten() {
    setBusy(true);
    try { const d = await fetch('/api/fokus', { method: 'POST' }).then(r => r.json()); setPlan(d.reply ?? d.error ?? 'Keine Antwort.'); }
    catch { setPlan('Nicht erreichbar.'); }
    setBusy(false);
  }

  const zone = rec == null ? null : rec >= 66 ? 'Grün' : rec >= 40 ? 'Gelb' : 'Rot';
  const zoneText = rec == null ? 'Noch keine Recovery von heute — der Tag wird nach Prioritäten geplant.'
    : rec >= 66 ? 'Grün: Tiefe Arbeit zuerst. Der schwerste Block gehört in den Vormittag.'
    : rec >= 40 ? 'Gelb: Eine tiefe Einheit, dann Routine. Keine neuen Großbaustellen.'
    : 'Rot: Nur das Nötige. Termine schieben, Erholung einplanen.';

  return (
    <Seite titel="Fokus" unter="Worauf es ankommt — gemeinsam und für jede Person, vom Jahr bis heute — und ob der Körper mitmacht.">
      {/* Einstieg unter Planung (08.10.): dieselbe Reiterzeile wie Tag · Woche · Monat · Quartal · Jahr. */}
      <PlanerLeiste aktiv="fokus" />
      <Flaeche seite="fokus">
      <Kachel id="fokus" titel="Unser Fokus" breite={6}>
      <Karte i={0} ton="fokus" netz>
        <Ueberschrift farbe={LEUCHT.planung}>Unser Fokus · Mein Fokus</Ueberschrift>
        <FokusTafel vorgabe={space} />
      </Karte>
      </Kachel>

      {/* Lichtfäden (03.10., Kevin: „ein Werkzeug, was Fokus anzeigt, weil extrem viele Stränge zusammenlaufen“): übergreifend,
          Wurzel = Gesamt — Business und Privat in einem Strang, Engstellen der nächsten Wochen; zuerst die eigenen Stränge. */}
      <Kachel id="lichtfaeden" titel="Lichtfäden" breite={6}>
        <Lichtfaeden wurzel="gesamt" person="ich" titel="Wo alles zusammenläuft" i={1} />
      </Kachel>

      <Kachel id="tagesform" titel="Tagesform" breite={3}>
      <Karte i={1} akzent={zone ? zoneFarbe(rec) : undefined}>
        <Ueberschrift farbe={zone ? zoneFarbe(rec) : undefined} rechts={<Link href="/os/gesundheit" style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>Gesundheit ›</Link>}>Tagesform</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,40px)', alignItems: 'center' }}>
          <Ring label="Recovery" wert={rec != null ? String(rec) : undefined} farbe={zoneFarbe(rec)} anteil={rec != null ? rec / 100 : undefined}
            unter={zone ? <Chip farbe={zoneFarbe(rec)}>{frisch ? `Zone ${zone}` : `${zone} · nicht von heute`}</Chip> : undefined} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{zoneText}</p>
            <div style={{ marginTop: 14 }}><Knopf onClick={ausrichten} aus={busy}>{busy ? 'richtet aus …' : plan ? '↻ Neu ausrichten' : 'Tag mit ZOE ausrichten'}</Knopf></div>
          </div>
        </div>
        {plan && <div style={{ marginTop: 16 }}><Rich text={plan} /></div>}
      </Karte>
      </Kachel>

      <Kachel id="regler" titel="Worauf die Energie geht" breite={3}>
      <Karte i={2}>
        <Ueberschrift rechts={<Link href="/os/kompass" style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>Im Kompass ändern ›</Link>}>Worauf die Energie geht</Ueberschrift>
        {regler ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(SAEULEN).map(([k, s]) => {
              const w = regler[k] ?? 0;
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 40px', gap: 12, alignItems: 'center', fontSize: TYP.bedien }}>
                  <span style={{ color: C.inkDim }}>{s.name}</span>
                  <Segmentbalken anteil={w / 100} label={`${s.name}: ${w} von 100`} farbe={s.farbe} segmente={20} hoehe={12} />
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink, textAlign: 'right' }}>{w}</span>
                </div>
              );
            })}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>Die Regler bestimmen, welche Aufgaben im Tagesplan als Fokus markiert werden und wie der Wochenplan gewichtet.</div>
          </div>
        ) : <Leer>Noch keine Regler gesetzt — im Kompass einstellen.</Leer>}
      </Karte>
      </Kachel>

      {/* Zeit & Fokus (27.09. spät, Kevin: „Zeit je Einheit sehen“) — Auswertung und nachträgliches Zuordnen der Blöcke */}
      <Kachel id="zeit-einheit" titel="Zeit je Einheit" breite={3}>
        <ZeitJeEinheitKarte i={3} />
      </Kachel>
      <Kachel id="fokus-bloecke" titel="Fokus-Blöcke" breite={3}>
        <FokusBloeckeKarte i={4} />
      </Kachel>
      {/* Mandat an Zielen und Zeit (28.09.): Zeit je Mandat — Abrechnung und Auslastung */}
      <Kachel id="zeit-mandat" titel="Zeit je Mandat" breite={3}>
        <ZeitJeMandatKarte i={5} />
      </Kachel>
      </Flaeche>
    </Seite>
  );
}
