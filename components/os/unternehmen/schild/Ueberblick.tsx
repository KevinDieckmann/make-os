'use client';

// ─── Unternehmen › Überblick: die Compliance-Ampel je Gesellschaft und gesamt (10.10.) ──────────────────────────────
// Vier Teile je Business-Gesellschaft — Dokumente · Pflichten · Risiken · Marken & Versicherungen — jeweils mit Ampel und „was fehlt“
// samt Weg zum Beheben; oben die Ampel gesamt und was in den nächsten Wochen ansteht. Gerechnet in lib/gesellschaften/schild/ampel.ts.

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster, Kennzahl, Leerzustand, Liste, Zeile, Knopf } from '../../ui';
import { WEG } from '@/lib/wege';
import { AMPEL_TEXT, type Lage, type GesellschaftLage, type Teil } from '@/lib/gesellschaften/schild/ampel';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { AmpelChip, AMPEL_FARBE, PunktListe, SchildFuss, klein } from './teile';

const TEILE: { id: keyof GesellschaftLage['compliance']['teile']; label: string; reiter: 'dokumente' | 'pflichten' | 'risiken' | 'schutz' }[] = [
  { id: 'dokumente', label: 'Dokumente', reiter: 'dokumente' }, { id: 'pflichten', label: 'Pflichten', reiter: 'pflichten' },
  { id: 'risiken', label: 'Risiken', reiter: 'risiken' }, { id: 'schutz', label: 'Marken & Versicherungen', reiter: 'schutz' },
];

const zahlenText = (id: string, t: Teil) => id === 'dokumente' ? `${t.zahlen.ok} von ${t.zahlen.soll} im Lot`
  : id === 'pflichten' ? `${t.zahlen.ueberfaellig} überfällig · ${t.zahlen.offen} offen`
    : id === 'risiken' ? `${t.zahlen.erfasst} erfasst · ${t.zahlen.rot} rot`
      : `${t.zahlen.marken} Marken · ${t.zahlen.domains} Domains · ${t.zahlen.versicherungen} Policen`;

export function Ueberblick({ lage }: { lage: Lage }) {
  if (!lage.gesellschaften.length) {
    return <Karte><Leerzustand symbol={<ShieldCheck size={22} />} titel="Noch keine Business-Gesellschaft" aktion={<Knopf leise href={WEG.schild('gesellschaften')}>Zu den Gesellschaften</Knopf>}>Das Schild führt die Gesellschaften im Bereich Business — legt eine an oder setzt ihren Steckbrief.</Leerzustand></Karte>;
  }
  const steht = lage.gesellschaften.flatMap(g => g.pflichten.filter(p => p.status === 'ueberfaellig' || p.status === 'faellig').map(p => ({ g, p })))
    .sort((a, b) => a.p.frist.localeCompare(b.p.frist)).slice(0, 8);
  return (
    <>
      <Karte ton={AMPEL_FARBE[lage.gesamt.ampel]}>
        <Ueberschrift rechts={<AmpelChip a={lage.gesamt.ampel} />}>Das Schild gesamt</Ueberschrift>
        <Raster min={150}>
          <Kennzahl wert={String(lage.gesellschaften.length)} label="Gesellschaften" />
          <Kennzahl wert={String(lage.gesamt.rot)} label="handeln (rot)" ton={lage.gesamt.rot ? AMPEL_FARBE.rot : undefined} />
          <Kennzahl wert={String(lage.gesamt.ueberfaellig)} label="Pflichten überfällig" ton={lage.gesamt.ueberfaellig ? AMPEL_FARBE.rot : undefined} />
          <Kennzahl wert={String(lage.gesamt.faellig)} label="Pflichten fällig" ton={lage.gesamt.faellig ? AMPEL_FARBE.gelb : undefined} />
        </Raster>
        <SchildFuss>Die Ampel prüft Dokumente, Pflichten, Risiken und Schutzrechte — sie ersetzt keine Prüfung durch Kanzlei oder Steuerbüro.</SchildFuss>
      </Karte>
      {steht.length > 0 && (
        <Karte>
          <Ueberschrift>Steht an</Ueberschrift>
          <Liste>
            {steht.map(({ g, p }) => (
              <Link key={`${g.id}-${p.schluessel}`} href={WEG.schild('pflichten', g.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Zeile titel={`${p.titel} (${p.periodeLabel})`} unter={`${g.name} · ${p.norm}`} rechts={<span style={{ fontSize: TYP.bedien, color: AMPEL_FARBE[p.status === 'ueberfaellig' ? 'rot' : 'gelb'], fontVariantNumeric: 'tabular-nums' }}>{p.status === 'ueberfaellig' ? 'seit' : 'bis'} {tagText(p.frist)}</span>} />
              </Link>
            ))}
          </Liste>
        </Karte>
      )}
      {lage.gesellschaften.map(g => (
        <Karte key={g.id}>
          <Ueberschrift rechts={<AmpelChip a={g.compliance.ampel} />}>{g.name}</Ueberschrift>
          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
            {TEILE.map(t => {
              const teil = g.compliance.teile[t.id];
              return (
                <section key={t.id} aria-label={t.label} style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
                  <Link href={WEG.schild(t.reiter, g.id)} style={{ display: 'flex', gap: 8, alignItems: 'center', color: C.ink, textDecoration: 'none', minHeight: 40 }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: AMPEL_FARBE[teil.ampel] }} />
                    <strong style={{ fontSize: TYP.body }}>{t.label}</strong>
                    <span style={{ ...klein, marginLeft: 'auto' }}>{AMPEL_TEXT[teil.ampel]} ›</span>
                  </Link>
                  <span style={klein}>{zahlenText(t.id, teil)}</span>
                  <PunktListe punkte={teil.punkte} max={4} />
                </section>
              );
            })}
          </div>
        </Karte>
      ))}
    </>
  );
}
