'use client';

// ─── Gesundheit › Heute: „Zuerst“ — was morgens oben steht, je Person einstellbar (09.10.2026) ─────────────────────────────
// Wunsch der trainierenden Person (09.10.): morgens Schlaf zuerst; Handy, auch im Gym — große Zahlen, die Einheit des Tages mit EINEM
// Tipp abhaken. Generisch gebaut: die Person wählt, was zuerst steht (Tagesform · Schlaf · Training heute · Countdown; Vorgabe Tagesform,
// gespeichert im eigenen Sport-Bestand `einstellungen.zuerst`), die drei anderen stehen kompakt darunter. Daten: die Werte des Morgen-
// Checks (von der Seite übergeben, dasselbe Art.-9-Tor) und der EIGENE Sport-Bestand (/api/sport — nur die Person selbst). Rechnen nur in
// lib/sport/* und lib/gesundheit/*. Vorschläge, keine Trainings- oder ärztliche Beratung.

import { useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, Fortschritt, Pillen, LEUCHT } from '../ui';
import { useSport } from '../sport/daten';
import { einheitText, KLASSE_FARBE } from '../sport/teile';
import { ZUERST, ZUERST_LABEL, neueId, type Op, type SportStand, type Zuerst } from '@/lib/sport/modell';
import { planGegenIst, saison } from '@/lib/sport/plan-bau';
import { tagesformHinweis } from '@/lib/sport/tagesform';
import { montagVon, formatPace, zielPace } from '@/lib/sport/pace';
import { belastungLage } from '@/lib/gesundheit/belastung';
import type { Koerperwerte } from '@/lib/gesundheit/koerperwerte';
import { WEG } from '@/lib/wege';

const zone = (r?: number) => (r == null ? C.inkLeise : r >= 66 ? LEUCHT.gut : r >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const hm = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

interface Werte { heute: string; rec?: number; schlaf?: number; strain?: number; kw?: Koerperwerte }

export function HeuteZuerst(p: Werte) {
  const { d, schicke } = useSport();
  return <HeuteZuerstAnsicht {...p} stand={d?.stand} schicke={schicke} />;
}

/** Die Ansicht ohne Laden (testbar): `stand` = eigener Sport-Bestand (fehlt = lädt noch). */
export function HeuteZuerstAnsicht({ heute, rec, schlaf, strain, kw, stand, schicke }: Werte & { stand?: SportStand; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const zuerst: Zuerst = stand?.einstellungen?.zuerst ?? 'tagesform';
  const pi = useMemo(() => (stand ? planGegenIst(stand, montagVon(heute), heute) : null), [stand, heute]);
  const heuteZeilen = pi?.zeilen.filter(z => z.plan.datum === heute) ?? [];
  const rennen = stand ? saison(stand.ziele, heute)[0] : undefined;
  const belastung = belastungLage(strain, rec);
  const bedarf = kw?.schlaf.bedarf;

  const teile: Record<Zuerst, (gross: boolean) => ReactNode> = {
    tagesform: gross => (
      <Teil titel="Tagesform" gross={gross} farbe={zone(rec)}>
        <Gross wert={rec != null ? `${rec}` : '—'} einheit={rec != null ? '%' : ''} farbe={zone(rec)} gross={gross} unter="Recovery" />
        {belastung && rec != null && <p style={satz(gross)}>{belastung.text}</p>}
        {rec == null && <p style={satz(gross)}>Noch keine Recovery von heute.</p>}
      </Teil>
    ),
    schlaf: gross => (
      <Teil titel="Schlaf" gross={gross} farbe={LEUCHT.schlaf}>
        <Gross wert={schlaf != null ? hm(schlaf) : '—'} einheit={schlaf != null ? 'h' : ''} farbe={LEUCHT.schlaf} gross={gross} unter={bedarf != null ? `Bedarf ${hm(bedarf)}` : 'geschlafen'} />
        {schlaf != null && bedarf != null && bedarf > 0 && <div style={{ marginTop: 6 }}><Fortschritt anteil={schlaf / bedarf} farbe={LEUCHT.schlaf} /></div>}
        {gross && kw?.schlaf.konsistenz != null && <p style={satz(gross)}>Regelmäßigkeit {kw.schlaf.konsistenz} %{kw.schlaf.leistung != null ? ` · Schlafleistung ${kw.schlaf.leistung} %` : ''}</p>}
      </Teil>
    ),
    training: gross => (
      <Teil titel="Training heute" gross={gross} farbe={C.aktiv}>
        {!stand ? <p style={satz(gross)}>…</p> : !heuteZeilen.length ? (
          <p style={satz(gross)}>Heute nichts geplant. <Link href={WEG.sport()} style={{ color: C.inkDim }}>Plan öffnen ›</Link></p>
        ) : heuteZeilen.map(z => {
          const tf = z.status !== 'erfuellt' ? tagesformHinweis(z.plan.einheit, rec) : null;
          return (
            <div key={z.plan.einheit.id} style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: KLASSE_FARBE[z.plan.einheit.sparte] }} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? TYP.titel : TYP.body }}>{einheitText(z.plan.einheit)}</span>
                {z.status === 'erfuellt' && <Chip farbe={LEUCHT.gut}>✓ erledigt</Chip>}
              </div>
              {tf && <p style={{ ...satz(gross), color: tf.stufe === 'rot' ? LEUCHT.kritisch : LEUCHT.achtung }}><b>{tf.kurz}</b> — <span style={{ color: C.inkDim }}>{tf.text}</span></p>}
              {z.status !== 'erfuellt' && gross && (
                <div style={{ marginTop: 8 }}>
                  <Knopf haupt voll farbe={KLASSE_FARBE[z.plan.einheit.sparte]} onClick={async () => { await schicke([{ op: 'training', eintrag: { id: neueId('tr'), datum: heute, sport: einheitText({ ...z.plan.einheit, dauerMin: undefined }), art: z.plan.einheit.sparte, dauerMin: z.plan.einheit.dauerMin ?? 45 } }], 'Erledigt — gut gemacht.'); }}>Erledigt</Knopf>
                </div>
              )}
            </div>
          );
        })}
      </Teil>
    ),
    countdown: gross => (
      <Teil titel="Countdown" gross={gross} farbe={LEUCHT.business}>
        {rennen ? (
          <>
            <Gross wert={String(rennen.tage)} einheit={rennen.tage === 1 ? 'Tag' : 'Tage'} farbe={LEUCHT.business} gross={gross} unter={rennen.ziel.titel} />
            {gross && rennen.ziel.art === 'lauf' && zielPace(rennen.ziel) != null && <p style={satz(gross)}>Ziel-Pace {formatPace(zielPace(rennen.ziel))} min/km — gleichmäßig starten.</p>}
          </>
        ) : <p style={satz(gross)}>Kein Wettkampf mit Datum. <Link href={WEG.sport()} style={{ color: C.inkDim }}>Ziel setzen ›</Link></p>}
      </Teil>
    ),
  };
  const rest = ZUERST.filter(z => z !== zuerst);

  return (
    <Karte i={0} akzent={zuerst === 'tagesform' ? zone(rec) : undefined} dicht>
      {teile[zuerst](true)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 14 }}>
        {rest.map(z => <div key={z} style={{ padding: 12, borderRadius: 14, border: `1px solid ${RAND.flaeche}`, minWidth: 0 }}>{teile[z](false)}</div>)}
      </div>
      {stand && (
        <div style={{ marginTop: 12 }}>
          <span style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Zuerst zeigen</span>
          <div style={{ marginTop: 4 }}><Pillen liste={ZUERST.map(z => ({ id: z, label: ZUERST_LABEL[z] }))} aktiv={zuerst} onWahl={z => void schicke([{ op: 'einstellungen', werte: { zuerst: z === 'tagesform' ? null : z } }], `Zuerst: ${ZUERST_LABEL[z]}.`)} /></div>
        </div>
      )}
    </Karte>
  );
}

const satz = (gross: boolean) => ({ margin: '6px 0 0', fontSize: gross ? TYP.body : TYP.bedien, color: C.inkDim, lineHeight: 1.45 }) as const;

function Teil({ titel, gross, farbe, children }: { titel: string; gross: boolean; farbe: string; children: ReactNode }) {
  return (
    <section aria-label={titel} style={{ minWidth: 0 }}>
      <div style={{ fontSize: TYP.mikro, color: gross ? farbe : C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>{titel}</div>
      {children}
    </section>
  );
}

function Gross({ wert, einheit, farbe, gross, unter }: { wert: string; einheit: string; farbe: string; gross: boolean; unter?: string }) {
  return (
    <div style={{ marginTop: 4 }}>
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: gross ? TYP.held : TYP.zahl, lineHeight: 1, color: wert === '—' ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }}>{wert}</span>
      {einheit && <span style={{ fontSize: gross ? TYP.titel : TYP.bedien, color: farbe, marginLeft: 4, fontWeight: 600 }}>{einheit}</span>}
      {unter && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{unter}</div>}
    </div>
  );
}
