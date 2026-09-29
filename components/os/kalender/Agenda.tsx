'use client';

// ─── Kalender: Agenda (27.09.) ──────────────────────────────────────────────
// Die Liste: Tag für Tag, was ansteht — Termine, Fristen, Erinnerungen. Mit
// der Suche oben wird sie zur Trefferliste über den geladenen Zeitraum.
// Seit 30.09. (K3): Aufgaben an ihrer Deadline (Haken, Klick öffnet die Aufgabe).
// Seit 29.09. (R-K2 #17/#88): mehrtägige Termine mit Uhrzeit (Fr 18:00 – So 14:00) stehen auch an den Folgetagen —
// als „läuft weiter“ mit dem Ende, damit die Reise am Samstag nicht unsichtbar ist.

import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Liste, Zeile, Leer, Punkt, Chip, Haken, prioFarbe, LEUCHT } from '../schlank';
import { FRIST_ZEICHEN, WER_LABEL, type KTermin, type KFrist, type KErinnerung } from './teile';
import type { KalenderAufgabe } from '@/lib/kalender/aufgaben';
import { letzterTag, laeuftWeiter } from '@/lib/kalender/layout';
import { anderesJahr, tagKurz } from '@/lib/zeit/kalender-kern';

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Restpunkte 29.09.: Jahreszahl nur außerhalb des laufenden Jahres — eine Regel mit Aufgaben-Modus, Glocke und Heute.
const tagText = (tag: string, heute: string) => { const d = new Date(`${tag}T12:00:00`); return `${WD[d.getDay()]}, ${d.getDate()}. ${d.toLocaleDateString('de-DE', { month: 'long' })}${anderesJahr(tag, heute) ? ` ${tag.slice(0, 4)}` : ''}`; };
/** „So 14.09. 14:00“ */
const endeText = (wand: string, heute: string) => `${WD[new Date(`${wand.slice(0, 10)}T12:00:00`).getDay()]} ${tagKurz(wand.slice(0, 10), heute)} ${wand.slice(11, 16)}`;

export function Agenda({ tage, heute, termine, fristen, erinnerungen, farbe, suche, onOeffnen, aufgaben = [], onAufgabe, onAufgabeHaken }: {
  tage: string[]; heute: string; termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[]; farbe: (t: KTermin) => string; suche: string; onOeffnen: (t: KTermin) => void;
  aufgaben?: KalenderAufgabe[]; onAufgabe?: (id: string) => void; onAufgabeHaken?: (id: string) => void;
}) {
  const treffer = tage.map(tag => ({
    tag,
    termine: termine.filter(t => t.start.slice(0, 10) === tag || (t.ganztags && t.start.slice(0, 10) < tag && t.ende.slice(0, 10) > tag) || laeuftWeiter(t, tag))
      .sort((a, b) => Number(b.ganztags) - Number(a.ganztags) || Number(laeuftWeiter(b, tag)) - Number(laeuftWeiter(a, tag)) || a.start.localeCompare(b.start)),
    fristen: fristen.filter(f => f.tag === tag), erinnerungen: erinnerungen.filter(e => e.tag === tag),
    aufgaben: aufgaben.filter(a => a.tag === tag).sort((a, b) => (a.zeit ?? '99').localeCompare(b.zeit ?? '99')),
  })).filter(t => t.termine.length || t.fristen.length || t.erinnerungen.length || t.aufgaben.length);
  if (!treffer.length) return <Leer>{suche ? `Nichts zu „${suche}“ im Zeitraum.` : 'Nichts in diesem Zeitraum.'}</Leer>;
  return (
    <div style={{ display: 'grid', gap: 14, fontFamily: SCHRIFT.text }}>
      {treffer.map(t => (
        <div key={t.tag}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, fontWeight: 700, color: t.tag === heute ? LEUCHT.puls : C.inkDim, marginBottom: 2 }}>
            {t.tag === heute && <Punkt farbe={LEUCHT.puls} groesse={7} />}{tagText(t.tag, heute)}{t.tag === heute ? ' · heute' : ''}
          </div>
          <Liste>
            {t.termine.map(x => { const weiter = laeuftWeiter(x, t.tag), mehr = !x.ganztags && letzterTag(x) > x.start.slice(0, 10); return (
              <Zeile key={x.id} onClick={() => onOeffnen(x)} links={<><span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 52, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{x.ganztags ? 'ganzt.' : weiter ? '…' : x.start.slice(11, 16)}</span><Punkt farbe={farbe(x)} groesse={7} /></>}
                titel={<span>{!x.bearbeitbar && <span aria-label="nur in Apple" style={{ marginRight: 4 }}>🔒</span>}{x.titel}</span>}
                unter={`${x.ganztags ? '' : weiter ? `läuft weiter · bis ${endeText(x.ende, heute)} · ` : mehr ? `bis ${endeText(x.ende, heute)} · ` : `bis ${x.ende.slice(11, 16)} · `}${x.kalender} (${WER_LABEL[x.wer]})${x.ort ? ` · ${x.ort}` : ''}`} rechts={x.serie ? <Chip farbe={C.inkLeise}>Serie</Chip> : undefined} />
            ); })}
            {t.fristen.map(f => <Zeile key={f.id} links={<><span style={{ width: 52, flex: '0 0 auto' }} /><span style={{ color: FRIST_ZEICHEN[f.art].farbe }}>{FRIST_ZEICHEN[f.art].zeichen}</span></>} titel={<a href={f.href} style={{ color: 'inherit', textDecoration: f.erledigt ? 'line-through' : 'none' }}>{f.titel}</a>} unter={`${FRIST_ZEICHEN[f.art].label}${f.unter ? ` · ${f.unter}` : ''}`} />)}
            {t.aufgaben.map(a => (
              <Zeile key={`a:${a.id}`} onClick={onAufgabe ? () => onAufgabe(a.id) : undefined}
                links={<><span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 52, flex: '0 0 auto' }}>{a.zeit ?? ''}</span>{onAufgabeHaken ? <Haken an={false} onChange={() => onAufgabeHaken(a.id)} farbe={prioFarbe(a.priority ?? 'medium')} label={a.title} /> : <span aria-hidden>☐</span>}</>}
                titel={<span>{a.eltern ? <span style={{ color: C.inkLeise }}>↳ </span> : null}{a.title}</span>} unter={`Aufgabe${a.eltern ? ` · Unteraufgabe von „${a.eltern}“` : ''}${a.start ? ` · seit ${tagKurz(a.start.slice(0, 10), heute)}` : ''}`} />
            ))}
            {t.erinnerungen.map(e => <Zeile key={e.id} links={<><span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 52, flex: '0 0 auto' }}>{e.zeit ?? ''}</span><span style={{ color: LEUCHT.schlaf }}>◷</span></>} titel={e.titel} unter={`Erinnerung${e.liste ? ` · ${e.liste}` : ''}`} />)}
          </Liste>
        </div>
      ))}
    </div>
  );
}
