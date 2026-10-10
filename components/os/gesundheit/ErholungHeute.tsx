'use client';

// ─── Heute-Widget „Erholung heute“ (10.10.) ──────────────────────────────────────────────────────────────────────────────────────
// Die EIGENE Erholung auf Heute (Privat-Sicht im Standard, im Katalog unter Gesundheit): Vorschlag aus den eigenen Körperwerten, heute
// fällige Programme (abhakbar), Streak, Erholungs-Ziele, eigener Fokus-Satz, nächste Pause im Arbeitstag („Pause gemacht“). Daten nur über
// /api/gesundheit/erholung (die eigene Person — nie eine andere). Ohne Inhalt und ohne Vorschlag zeichnet das Widget nichts.

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Chip, Fortschritt, Schalter, Zeile, Knopf } from '../ui';
import { localDay } from '@/lib/zeit';
import { WEG } from '@/lib/wege';
import { erholungHatInhalt } from '@/lib/gesundheit/erholung';
import { naechstePause, VORSCHLAG_TITEL } from '@/lib/gesundheit/erholung-lage';
import { useErholung, ERHOLUNG_FARBE } from './erholung-daten';

export function ErholungHeuteWidget({ titel, i }: { titel?: string; i: number }) {
  const { d, aendern } = useErholung();
  const [jetzt] = useState(() => new Date());
  const heute = localDay();
  if (!d || !d.eigene) return null;
  const s = d.erholung, sicht = d.sicht;
  if (!erholungHatInhalt(s) && !sicht.vorschlag) return null;
  const p = s.einstellungen.pausen;
  const minJetzt = jetzt.getHours() * 60 + jetzt.getMinutes();
  // Letzte Pause heute = jüngste Bildschirmpause von heute (Zeitpunkt des Eintrags).
  const letzte = s.einheiten.filter(e => e.tag === heute && e.art === 'bildschirmpause' && e.am).map(e => { const t = new Date(e.am); return t.getHours() * 60 + t.getMinutes(); }).sort((a, b) => b - a)[0];
  const pause = naechstePause(p, minJetzt, letzte);
  const offen = sicht.faellig.filter(f => !f.erledigt).length;
  return (
    <Karte i={i} akzent={ERHOLUNG_FARBE}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={<Link href={WEG.erholung()} style={{ color: C.inkLeise, textDecoration: 'none' }}>Erholung ›</Link>}>{titel ?? 'Erholung heute'}</Ueberschrift>
      {s.einstellungen.vorschlag !== false && sicht.vorschlag && (
        <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
          <div><Chip farbe={ERHOLUNG_FARBE}>{VORSCHLAG_TITEL[sicht.vorschlag.art]}</Chip></div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>{sicht.vorschlag.text}</div>
        </div>
      )}
      {s.fokus.trim() && <div style={{ fontSize: TYP.bedien, color: C.ink, marginBottom: 6 }}>{s.fokus}</div>}
      {sicht.faellig.slice(0, 4).map(f => (
        <Zeile key={f.programm.id} titel={f.programm.name} unter={f.grund}
          rechts={<Schalter an={f.erledigt} farbe={ERHOLUNG_FARBE} ariaLabel={`${f.programm.name} heute erledigt`}
            onChange={an => { void aendern([an ? { op: 'einheit', einheit: { tag: heute, programmId: f.programm.id } } : { op: 'einheit-weg', programmId: f.programm.id, tag: heute }]); }} />} />
      ))}
      {sicht.ziele.slice(0, 2).map(z => (
        <div key={z.id} style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien, color: C.inkDim }}><span>{z.titel}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(z.anteil * 100)} %</span></div>
          <Fortschritt anteil={z.anteil} farbe={ERHOLUNG_FARBE} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
        <span>{offen ? `${offen} heute offen` : sicht.faellig.length ? 'heute alles erledigt' : 'heute nichts fällig'}{sicht.streak.tage ? ` · ${sicht.streak.tage} Tage in Folge` : ''}</span>
        {pause && <span style={{ color: pause.faellig ? ERHOLUNG_FARBE : C.inkLeise }}>Pause {pause.faellig ? 'jetzt' : `um ${pause.um}`}</span>}
        {pause?.faellig && <Knopf leise onClick={() => aendern([{ op: 'einheit', einheit: { tag: heute, art: 'bildschirmpause' } }])}>Pause gemacht</Knopf>}
      </div>
    </Karte>
  );
}

/**
 * Erholungs-Ziele in der Planung (10.10., „Ziele überall einstellbar“): Planung › Woche/Monat zeigt die EIGENEN Erholungs-Ziele des Zeitraums
 * mit Fortschritt (nur lesen, gepflegt unter Gesundheit › Erholung). Die Ziele liegen im Art.-9-Bestand der Person, nicht in den Planungs-Zielen —
 * darum hier nur eine Karte, nie im gemeinsamen Bestand. Ohne Erholungs-Ziel dieses Zeitraums zeichnet sie nichts.
 */
export function ErholungZielePlanung({ zeitraum, i }: { zeitraum: 'woche' | 'monat'; i: number }) {
  const { d } = useErholung();
  if (!d || !d.eigene) return null;
  const ziele = d.sicht.ziele.filter(z => z.zeitraum === zeitraum);
  if (!ziele.length) return null;
  return (
    <Karte i={i} akzent={ERHOLUNG_FARBE}>
      <Ueberschrift farbe={ERHOLUNG_FARBE} rechts={<Link href={WEG.erholung()} style={{ color: C.inkLeise, textDecoration: 'none' }}>pflegen ›</Link>}>Erholungs-Ziele · {zeitraum === 'woche' ? 'diese Woche' : 'diesen Monat'}</Ueberschrift>
      {ziele.map(z => (
        <div key={z.id} style={{ display: 'grid', gap: 4, marginTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien, color: C.inkDim }}><span style={{ color: C.ink }}>{z.titel}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{[z.soll.einheiten ? `${z.ist.einheiten}/${z.soll.einheiten}` : '', z.soll.minuten ? `${z.ist.minuten}/${z.soll.minuten} min` : ''].filter(Boolean).join(' · ')}</span></div>
          <Fortschritt anteil={z.anteil} farbe={ERHOLUNG_FARBE} />
        </div>
      ))}
    </Karte>
  );
}
