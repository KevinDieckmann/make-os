'use client';

// ─── Unternehmen › Pflichten als Jahres-Zeitstrahl + Jahresplan (11.10.) ────────────────────────────────────────────────────────────
// Eine Linie über zwölf Monate: Fristen als Marken, verstrichen rot (nur gesetzliche Fristen), die nächsten 90 Tage hervorgehoben, heute als Strich. Darunter
// dieselben Fristen als Liste je Monat (Handy, Bildschirmleser — die Marken selbst sind nur Bild). Export: die Fristen stehen schon in der Fristen-Ebene
// des Kalenders; zusätzlich als Kalenderdatei (.ics) zum Herunterladen. Gerechnet in lib/gesellschaften/schild/jahresstrahl.ts — hier nur gezeichnet.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarCheck } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, TIEF, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Leerzustand, Klappbar, useHandy } from '../../ui';
import { WEG } from '@/lib/wege';
import { jahresStrahl, jeMonat, fristenIcs, strahlEintraege, type StrahlEintrag, type StrahlTon } from '@/lib/gesellschaften/schild/jahresstrahl';
import type { Lage } from '@/lib/gesellschaften/schild/ampel';
import { tagText } from '@/lib/gesellschaften/schild/zeit';
import { SCHILD_HINWEIS } from '@/lib/gesellschaften/schild/typen';
import { WasSeheIch, beschriftung, klein } from './teile';

const STRAHL_FARBE: Record<StrahlTon, string> = { rot: LEUCHT.kritisch, gelb: LEUCHT.achtung, neutral: C.inkDim, erledigt: LEUCHT.gut };
const STRAHL_TEXT: Record<StrahlTon, string> = { rot: 'Frist verstrichen', gelb: 'bald (90 Tage)', neutral: 'später', erledigt: 'erledigt' };
const REIHE = 15;

/** Der Strahl selbst (Bild) — Monate, heute, „bald“-Band, Marken in Reihen. */
export function Strahl({ eintraege, heute }: { eintraege: readonly StrahlEintrag[]; heute: string }) {
  const s = useMemo(() => jahresStrahl(eintraege, heute), [eintraege, heute]);
  const schmal = useHandy();
  const hoehe = 22 + s.reihen * REIHE + 8;
  const pct = (x: number) => `${(x * 100).toFixed(3)}%`;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div role="img" aria-label={`Zeitstrahl ${tagText(s.von)} bis ${tagText(s.bis)}: ${s.marken.filter(m => m.ton === 'rot').length} verstrichen, ${s.marken.filter(m => m.ton === 'gelb').length} bald, ${s.marken.filter(m => m.ton === 'neutral').length} später`}
        style={{ position: 'relative', height: hoehe, borderRadius: 12, background: 'rgba(255,255,255,.025)', border: `1px solid ${RAND.flaeche}`, overflow: 'hidden' }}>
        {/* die nächsten 90 Tage */}
        <span aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(s.bald.von), width: pct(Math.max(0, s.bald.bis - s.bald.von)), background: TIEF.flaeche(LEUCHT.achtung) }} />
        {s.monate.map((m, i) => (
          <span key={m.key} aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: pct(m.von), width: pct(m.bis - m.von), borderLeft: i ? `1px solid ${m.jahresbeginn ? RAND.stark : RAND.haar}` : undefined }}>
            <span style={{ position: 'absolute', top: 4, left: 4, ...beschriftung, color: m.heute ? C.ink : C.inkLeise, whiteSpace: 'nowrap' }}>{schmal ? m.label.slice(0, 1) : m.label}{!schmal && (m.jahresbeginn || i === 0) ? ` ${String(m.jahr).slice(2)}` : ''}</span>
          </span>
        ))}
        <span aria-hidden title={`heute, ${tagText(heute)}`} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(s.heuteX), width: 2, marginLeft: -1, background: C.ink, opacity: 0.7 }} />
        {s.marken.map(m => (
          <span key={m.id} aria-hidden title={`${tagText(m.tag)} · ${m.titel} · ${m.unter}`}
            style={{ position: 'absolute', left: pct(m.x), top: 22 + m.reihe * REIHE, width: 10, height: 10, marginLeft: -5, borderRadius: 5,
              background: m.ton === 'neutral' ? 'transparent' : STRAHL_FARBE[m.ton], border: `2px solid ${STRAHL_FARBE[m.ton]}`, opacity: m.ton === 'erledigt' ? 0.55 : 1 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: TYP.bedien, color: C.inkDim }}>
        {(['rot', 'gelb', 'neutral', 'erledigt'] as const).map(t => (
          <span key={t} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: t === 'neutral' ? 'transparent' : STRAHL_FARBE[t], border: `2px solid ${STRAHL_FARBE[t]}` }} />{STRAHL_TEXT[t]}</span>
        ))}
        {s.vorher.anzahl > 0 && <span>· vor {tagText(s.von)}: {s.vorher.anzahl} offen{s.vorher.rot ? ` (${s.vorher.rot} verstrichen)` : ''}</span>}
        {s.danach > 0 && <span>· danach: {s.danach}</span>}
      </div>
    </div>
  );
}

/** Dieselben Fristen als Liste je Monat — die Zeilen sind die Ziele (≥ 44 px). */
export function FristenListe({ eintraege, heute, mitGesellschaft, jeGruppe = 6 }: { eintraege: readonly StrahlEintrag[]; heute: string; mitGesellschaft?: boolean; jeGruppe?: number }) {
  const s = useMemo(() => jahresStrahl(eintraege, heute), [eintraege, heute]);
  const gruppen = jeMonat(eintraege, heute, s);
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  if (!gruppen.length) return <span style={klein}>Keine offene Frist im Zeitraum.</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {gruppen.map((gr, i) => {
        const auf = offen[gr.key] ?? i < 3;
        const zeigen = auf ? gr.eintraege.slice(0, jeGruppe) : [];
        return (
          <Klappbar key={gr.key} id={`fristen-${gr.key}`} titel={gr.titel} zaehler={gr.eintraege.length} offen={auf} umschalten={() => setOffen(o => ({ ...o, [gr.key]: !auf }))}>
            <div style={{ display: 'grid' }}>
              {zeigen.map(e => (
                <Link key={e.id} href={e.href} className="fassbar" style={{ display: 'flex', gap: 10, alignItems: 'baseline', minHeight: 44, padding: '6px 2px', color: C.ink, textDecoration: 'none', borderTop: `1px solid ${RAND.haar}` }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 5, flex: '0 0 auto', background: e.ton === 'neutral' ? 'transparent' : STRAHL_FARBE[e.ton], border: `2px solid ${STRAHL_FARBE[e.ton]}` }} />
                  <span style={{ fontSize: TYP.bedien, color: e.ton === 'rot' ? STRAHL_FARBE.rot : C.inkDim, fontVariantNumeric: 'tabular-nums', minWidth: 74 }}>{tagText(e.tag)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{e.titel}{mitGesellschaft ? <span style={{ color: C.inkDim }}> · {e.gesellschaft}</span> : null}</span>
                  <span aria-hidden style={{ color: C.inkLeise }}>›</span>
                </Link>
              ))}
              {gr.eintraege.length > zeigen.length && auf && <span style={{ ...klein, padding: '6px 2px' }}>… und {gr.eintraege.length - zeigen.length} weitere — im Reiter der Gesellschaft.</span>}
            </div>
          </Klappbar>
        );
      })}
    </div>
  );
}

/** Kalenderdatei herunterladen (nur im Browser, nichts geht an einen Dienst). */
function icsLaden(eintraege: readonly StrahlEintrag[], name: string) {
  const blob = new Blob([fristenIcs(eintraege, new Date().toISOString(), name)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name.replace(/[^a-z0-9äöüß -]/gi, '').replace(/\s+/g, '-').toLowerCase() || 'fristen'}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Die Karte: Strahl + Liste + Export — für eine Gesellschaft (`nur`) oder alle (Jahresplan). `kompakt` = nur der Strahl mit Weg zu den Pflichten
 * (Überblick).
 */
export function JahresstrahlKarte({ lage, nur, kompakt, titel }: { lage: Pick<Lage, 'heute' | 'gesellschaften'>; nur?: string; kompakt?: boolean; titel?: string }) {
  const eintraege = useMemo(() => strahlEintraege(lage, nur), [lage, nur]);
  const alle = !nur && lage.gesellschaften.length > 1;
  const name = titel ?? (alle ? 'Jahresplan der Pflichten' : 'Pflichten im Jahr');
  const offen = eintraege.filter(e => e.ton !== 'erledigt');
  return (
    <Karte>
      <Ueberschrift erklaerung="unternehmen.blick.jahresstrahl" rechts={kompakt ? <Knopf leise href={WEG.schild('pflichten')}>Pflichten & Fristen ›</Knopf> : undefined}>{name}</Ueberschrift>
      {!eintraege.length
        ? <Leerzustand symbol={<CalendarCheck size={22} />} titel="Noch keine Fristen" aktion={<Knopf leise href={WEG.schild('gesellschaften')}>Zu den Gesellschaften</Knopf>}>Fristen entstehen aus Rechtsform, Geschäftsjahr und Ereignissen — trage im Steckbrief Rechtsform und Gründung ein.</Leerzustand>
        : (
          <>
            <Strahl eintraege={eintraege} heute={lage.heute} />
            <WasSeheIch>Zwölf Monate auf einer Linie — jeder Punkt ist eine Frist{alle ? ' einer eurer Gesellschaften' : ''}. Der helle Strich ist heute, die getönte Fläche die nächsten 90 Tage. Rot heißt: eine gesetzliche Frist ist verstrichen.</WasSeheIch>
            {!kompakt && <div style={{ marginTop: 12 }}><FristenListe eintraege={eintraege} heute={lage.heute} mitGesellschaft={alle} /></div>}
            {!kompakt && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <Knopf leise href={WEG.kalender()}>Im Kalender ansehen</Knopf>
                <Knopf leise aus={!offen.length} onClick={() => icsLaden(eintraege, name)}>Als Kalenderdatei (.ics)</Knopf>
              </div>
            )}
            {!kompakt && <div style={{ ...klein, marginTop: 8 }}>Die Fristen stehen ohnehin in der Fristen-Ebene eures Kalenders. Die Datei enthält {offen.length} offene Frist{offen.length === 1 ? '' : 'en'} mit Erinnerung eine Woche vorher — sie verlässt MAKE OS nur, wenn du sie weitergibst. {SCHILD_HINWEIS}</div>}
          </>
        )}
    </Karte>
  );
}
