'use client';

// ─── Kalender: Agenda (27.09.) ──────────────────────────────────────────────
// Die Liste: Tag für Tag, was ansteht — Termine, Fristen, Erinnerungen. Mit
// der Suche oben wird sie zur Trefferliste über den geladenen Zeitraum.

import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Liste, Zeile, Leer, Punkt, Chip, LEUCHT } from '../schlank';
import { FRIST_ZEICHEN, WER_LABEL, type KTermin, type KFrist, type KErinnerung } from './teile';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const tagText = (tag: string) => { const d = new Date(`${tag}T12:00:00`); return `${WD[d.getDay()]}, ${d.getDate()}. ${d.toLocaleDateString('de-DE', { month: 'long' })}`; };

export function Agenda({ tage, heute, termine, fristen, erinnerungen, farbe, suche, onOeffnen }: {
  tage: string[]; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[]; farbe: (t: KTermin) => string; suche: string; onOeffnen: (t: KTermin) => void;
}) {
  const treffer = tage.map(tag => ({
    tag,
    termine: termine.filter(t => t.start.slice(0, 10) === tag || (t.ganztags && t.start.slice(0, 10) < tag && t.ende.slice(0, 10) > tag)).sort((a, b) => Number(b.ganztags) - Number(a.ganztags) || a.start.localeCompare(b.start)),
    fristen: fristen.filter(f => f.tag === tag), erinnerungen: erinnerungen.filter(e => e.tag === tag),
  })).filter(t => t.termine.length || t.fristen.length || t.erinnerungen.length);
  if (!treffer.length) return <Leer>{suche ? `Nichts zu „${suche}“ im Zeitraum.` : 'Nichts in diesem Zeitraum.'}</Leer>;
  return (
    <div style={{ display: 'grid', gap: 14, fontFamily: SCHRIFT.text }}>
      {treffer.map(t => (
        <div key={t.tag}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, fontWeight: 700, color: t.tag === heute ? LEUCHT.puls : C.inkDim, marginBottom: 2 }}>
            {t.tag === heute && <Punkt farbe={LEUCHT.puls} groesse={7} />}{tagText(t.tag)}{t.tag === heute ? ' · heute' : ''}
          </div>
          <Liste>
            {t.termine.map(x => (
              <Zeile key={x.id} onClick={() => onOeffnen(x)} links={<><span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 52, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{x.ganztags ? 'ganzt.' : x.start.slice(11, 16)}</span><Punkt farbe={farbe(x)} groesse={7} /></>}
                titel={<span>{!x.bearbeitbar && <span aria-label="nur in Apple" style={{ marginRight: 4 }}>🔒</span>}{x.titel}</span>} unter={`${x.ganztags ? '' : `bis ${x.ende.slice(11, 16)} · `}${x.kalender} (${WER_LABEL[x.wer]})${x.ort ? ` · ${x.ort}` : ''}`} rechts={x.serie ? <Chip farbe={C.inkLeise}>Serie</Chip> : undefined} />
            ))}
            {t.fristen.map(f => <Zeile key={f.id} links={<><span style={{ width: 52, flex: '0 0 auto' }} /><span style={{ color: FRIST_ZEICHEN[f.art].farbe }}>{FRIST_ZEICHEN[f.art].zeichen}</span></>} titel={<a href={f.href} style={{ color: 'inherit', textDecoration: f.erledigt ? 'line-through' : 'none' }}>{f.titel}</a>} unter={`${FRIST_ZEICHEN[f.art].label}${f.unter ? ` · ${f.unter}` : ''}`} />)}
            {t.erinnerungen.map(e => <Zeile key={e.id} links={<><span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 52, flex: '0 0 auto' }}>{e.zeit ?? ''}</span><span style={{ color: LEUCHT.schlaf }}>◷</span></>} titel={e.titel} unter={`Erinnerung${e.liste ? ` · ${e.liste}` : ''}`} />)}
          </Liste>
        </div>
      ))}
    </div>
  );
}
