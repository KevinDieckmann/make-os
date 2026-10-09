'use client';

// ─── Sport — Wettkampf: Countdown, Ziel ehrlich neben der Prognose, Pacing, Taper-Woche (09.10.2026) ────────────────────
// Die nächste Station der Saison zuerst: wie viele Tage noch, was das Ziel heißt (Pace), was die Prognose aus einer Referenzzeit sagt
// (lib/sport/wettkampf.ts — Riegel-Spanne), wie man gleichmäßig startet (Splits), und die letzten 7 Tage als Taper-Vorschlag zum
// Übernehmen (Plan einzelner Tage). Rechnen nur in lib/sport/*. Vorschläge, keine Trainingsberatung.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, LEUCHT, Pillen as UiPillen, useRueckfrage } from '../ui';
import { Feld, Zeitfeld, Hinweis, datumKurz, de, SPORT_FARBE, einheitText, stundeMinute } from './teile';
import { WOCHENTAG_LABEL, type Op, type SportStand, type Ziel } from '@/lib/sport/modell';
import { saison } from '@/lib/sport/plan-bau';
import { wettkampfRechnung, taperTage, taperUebernommen, EINSCHAETZUNG_LABEL, type Einschaetzung } from '@/lib/sport/wettkampf';
import { formatPace, formatZeit } from '@/lib/sport/pace';
import { wochentagVon } from '@/lib/sport/plan';
import { splitsAusZielzeit } from '@/lib/sport/hyrox';

const EIN_FARBE: Record<Einschaetzung, string> = { vorsichtig: LEUCHT.gut, realistisch: LEUCHT.gut, ambitioniert: LEUCHT.achtung, 'sehr-ambitioniert': LEUCHT.kritisch, offen: C.inkDim };
const REF_DIST = [{ id: '5', label: '5 km' }, { id: '10', label: '10 km' }, { id: '21.1', label: 'Halbmarathon' }] as const;
const tagText = (d: string) => `${WOCHENTAG_LABEL[wochentagVon(d)]} ${datumKurz(d)}`;

export function WettkampfKarte({ stand, heute, schicke }: { stand: SportStand; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const reihe = useMemo(() => saison(stand.ziele, heute), [stand.ziele, heute]);
  const naechster = reihe[0];
  if (!naechster) return null;
  const z = naechster.ziel;
  const farbe = SPORT_FARBE[z.art === 'kraft' ? 'gym' : z.art === 'grundlagen' ? 'erholung' : z.art];
  return (
    <Karte i={0} ton={farbe}>
      <Ueberschrift farbe={farbe} rechts={tagText(z.datum!)}>Nächster Wettkampf</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(20px,3vw,26px)', letterSpacing: '-.02em' }}>{z.titel}</div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2 }}>{naechster.tage <= 1 ? (naechster.tage === 0 ? 'Heute ist Wettkampftag.' : 'Morgen geht es los.') : `Noch ${naechster.tage} Tage.`}</div>
        </div>
        <div aria-label={`${naechster.tage} Tage bis zum Start`} style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.held, lineHeight: 1, color: farbe, fontVariantNumeric: 'tabular-nums' }}>{naechster.tage}</div>
          <div style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>{naechster.tage === 1 ? 'Tag' : 'Tage'}</div>
        </div>
      </div>
      {z.art === 'lauf' && z.distanzKm ? <LaufRechner stand={stand} ziel={z} heute={heute} schicke={schicke} /> : null}
      {z.art === 'hyrox' && z.zielzeitSek ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <Zahl wert={formatZeit(z.zielzeitSek)} label="Zielzeit" farbe={farbe} />
          <Zahl wert={formatPace(splitsAusZielzeit(z.zielzeitSek).laufJeKm)} label="Lauf je km im Ziel" />
        </div>
      ) : null}
      {naechster.tage <= 14 && <TaperTeil stand={stand} ziel={z} heute={heute} schicke={schicke} />}
      {reihe.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>Danach in der Saison</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{reihe.slice(1, 5).map(w => <Chip key={w.ziel.id} farbe={C.inkDim}>{w.ziel.titel} · {w.text}</Chip>)}</div>
        </div>
      )}
      <Hinweis>Vorschlag, keine Trainingsberatung. Prognose aus der Riegel-Hochrechnung als Spanne — sie ersetzt keinen Leistungstest.</Hinweis>
    </Karte>
  );
}

function LaufRechner({ stand, ziel, heute, schicke }: { stand: SportStand; ziel: Ziel; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const r = useMemo(() => wettkampfRechnung(stand, ziel, heute), [stand, ziel, heute]);
  const [refDist, setRefDist] = useState<string>(String(ziel.referenz?.distanzKm ?? 10));
  const [refZeit, setRefZeit] = useState<number | undefined>(ziel.referenz?.sek);
  const [offen, setOffen] = useState(false);
  if (!r) return null;
  const speichern = async () => { if (!refZeit) return; const ok = await schicke([{ op: 'ziel', eintrag: { ...ziel, referenz: { distanzKm: Number(refDist), sek: refZeit } } }], 'Referenz gespeichert.'); if (ok) setOffen(false); };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <div><Zahl wert={r.ziel ? formatZeit(r.ziel.sek) : undefined} label="Ziel" /><div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{r.ziel ? `${formatPace(r.ziel.pace)} min/km` : 'keine Zielzeit'}</div></div>
        <div><Zahl wert={r.prognose ? `${stundeMinute(r.prognose.von)}–${stundeMinute(r.prognose.bis)}` : undefined} label="Prognose" /><div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{r.prognose ? `${formatPace(r.prognose.paceVon)}–${formatPace(r.prognose.paceBis)} min/km` : 'Referenz fehlt'}</div></div>
        <div style={{ alignSelf: 'center' }}><Chip farbe={EIN_FARBE[r.einschaetzung]}>{EINSCHAETZUNG_LABEL[r.einschaetzung]}</Chip></div>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>{r.saetze.map((s, i) => <p key={i} style={{ margin: 0, fontSize: TYP.bedien, color: i === 0 ? C.ink : C.inkDim, lineHeight: 1.5 }}>{s}</p>)}</div>
      {r.splits.length > 0 && (
        <div aria-label="Zwischenzeiten" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.splits.map(s => (
            <div key={s.km} style={{ padding: '8px 10px', borderRadius: 12, border: `1px solid ${RAND.flaeche}`, minWidth: 72 }}>
              <div style={{ fontSize: TYP.mikro, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase' }}>km {de(s.km)}</div>
              <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, fontVariantNumeric: 'tabular-nums' }}>{formatZeit(s.sek)}</div>
            </div>
          ))}
        </div>
      )}
      <div>
        {!offen
          ? <Knopf leise onClick={() => setOffen(true)}>{r.referenz ? `Referenz: ${de(r.referenz.distanzKm)} km in ${formatZeit(r.referenz.sek)}${r.referenz.quelle === 'bestzeit' ? ' (Bestzeit)' : r.referenz.quelle === 'ausgang' ? ' (Ausgangswert)' : ''} · ändern` : 'Referenzzeit eintragen'}</Knopf>
          : (
            <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 10 }}>
              <Feld label="Referenz-Distanz"><UiPillen liste={REF_DIST.map(x => ({ id: x.id, label: x.label }))} aktiv={refDist} onWahl={setRefDist} /></Feld>
              <Feld label="Zeit (aktuell, ehrlich)"><Zeitfeld wert={refZeit} onWert={setRefZeit} placeholder="mm:ss" /></Feld>
              <div style={{ display: 'flex', gap: 8 }}><Knopf typ="submit" aus={!refZeit}>Speichern</Knopf><Knopf leise onClick={() => setOffen(false)}>Abbrechen</Knopf></div>
            </form>
          )}
      </div>
    </div>
  );
}

function TaperTeil({ stand, ziel, heute, schicke }: { stand: SportStand; ziel: Ziel; heute: string; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const tage = useMemo(() => taperTage(ziel, heute), [ziel, heute]);
  const drin = taperUebernommen(stand, ziel, heute);
  const { bestaetigen, dialog } = useRueckfrage();
  const liste = Object.entries(tage).sort(([a], [b]) => (a < b ? -1 : 1));
  if (!liste.length) return null;
  const ueberschreibt = liste.some(([d]) => stand.tage?.[d]) && !drin;
  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${RAND.flaeche}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>Taper — die letzten Tage</span>
        {drin && <Chip farbe={LEUCHT.gut}>im Plan</Chip>}
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {liste.map(([d, t]) => (
          <div key={d} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', fontSize: TYP.bedien }}>
            <span style={{ width: 82, flex: '0 0 auto', color: d === ziel.datum ? C.ink : C.inkLeise, fontWeight: d === ziel.datum ? 700 : 400, fontVariantNumeric: 'tabular-nums' }}>{tagText(d)}</span>
            <span style={{ color: d === ziel.datum ? C.ink : C.inkDim, minWidth: 0 }}>
              {t.einheiten?.length ? t.einheiten.map(e => `${einheitText(e)}${e.notiz && d !== ziel.datum ? ` — ${e.notiz}` : ''}`).join(' + ') : t.art === 'ruhe' ? 'Ruhe' : 'frei'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        {!drin
          ? <Knopf haupt onClick={async () => { if (ueberschreibt && !(await bestaetigen({ titel: 'Taper übernehmen?', text: 'Einige dieser Tage hast du schon einzeln geplant — sie werden durch den Taper ersetzt.', ja: 'Übernehmen' }))) return; await schicke([{ op: 'plan-tage', tage }], 'Taper ist im Plan.'); }}>Taper-Woche übernehmen</Knopf>
          : <Knopf leise onClick={async () => { if (await bestaetigen({ titel: 'Taper zurücknehmen?', text: 'Die Tage gelten wieder nach deinem Wochenplan.', ja: 'Zurücknehmen' })) await schicke([{ op: 'plan-tage', tage: Object.fromEntries(liste.map(([d]) => [d, null])) }], 'Taper zurückgenommen.'); }}>Taper zurücknehmen</Knopf>}
      </div>
      <Hinweis>Umfang runter, ein paar kurze Reize im Renntempo, Ruhe zwei Tage vorher — jeden Tag kannst du danach unter „Diese Woche“ verschieben oder ändern.</Hinweis>
      {dialog}
    </div>
  );
}
