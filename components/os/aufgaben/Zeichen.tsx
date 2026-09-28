'use client';
// ─── Kennzeichen an Aufgaben-Zeilen und -Karten (29.09., Paket T2) ─────────
// Eine Stelle für: 🔒 „nur ich“ (Kevin 29.09.), „Abgebrochen“ (grau, durchgestrichen), Priorität und „überfällig“
// zusätzlich als Text/Symbol (#88 — nicht nur Farbe), Titelstil erledigt/abgebrochen. Genutzt von Baum, Board, Tabelle,
// Überblick und Detail.

import type { CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { FARBE as C, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import type { Task } from '@/types/tasks';

/** Farbe „Abgebrochen“ (wie GRUNDSTATUS in lib/aufgaben/struktur.ts). */
export const ABGEBROCHEN_FARBE = '#8A8F98';

export const istNurIchTask = (t: Pick<Task, 'sichtbarkeit'>): boolean => t.sichtbarkeit === 'nur-ich';

/** 🔒 — nur die Anlegerin sieht diese Aufgabe. */
export function NurIchZeichen({ groesse = 12, text }: { groesse?: number; text?: boolean }) {
  return (
    <span title="Nur ich — nur du siehst diese Aufgabe" aria-label="nur ich" role="img" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: LEUCHT.schlaf, flex: '0 0 auto', fontSize: 12, fontWeight: 600 }}>
      <Lock size={groesse} aria-hidden />{text && 'nur ich'}
    </span>
  );
}

/** Titel: erledigt leise + durchgestrichen, abgebrochen grau + durchgestrichen. */
export function titelStil(t: Pick<Task, 'status'>): CSSProperties {
  if (t.status === 'done') return { color: C.inkLeise, textDecoration: 'line-through' };
  if (t.status === 'cancelled') return { color: ABGEBROCHEN_FARBE, textDecoration: 'line-through', fontStyle: 'italic' };
  return { color: C.ink, textDecoration: 'none' };
}

/** „abgebrochen“ als kleines Schild (für Zeilen, in denen der Status sonst nicht steht). */
export function AbgebrochenSchild() {
  return <span style={{ color: ABGEBROCHEN_FARBE, border: `1px solid ${ABGEBROCHEN_FARBE}66`, borderRadius: 999, padding: '0 7px', fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: SCHRIFT.text }}>abgebrochen</span>;
}

const PRIO_TEXT: Record<string, { zeichen: string; wort: string; farbe: string }> = {
  critical: { zeichen: '!!', wort: 'kritisch', farbe: LEUCHT.kritisch },
  high: { zeichen: '!', wort: 'hoch', farbe: LEUCHT.achtung },
};
/** Priorität als Zeichen (#88): „!!“ kritisch, „!“ hoch — mit Text für Screenreader. Normal/niedrig: nichts. */
export function PrioZeichen({ p }: { p: string }) {
  const x = PRIO_TEXT[p];
  if (!x) return null;
  return <span title={`Priorität ${x.wort}`} aria-label={`Priorität ${x.wort}`} style={{ color: x.farbe, fontWeight: 800, fontFamily: SCHRIFT.display, fontSize: 12.5, flex: '0 0 auto' }}>{x.zeichen}</span>;
}

/** Überfällig? (offen und Deadline vor heute) */
export const istUeberfaellig = (t: Pick<Task, 'status' | 'dueDate'>, heute: string): boolean => !!t.dueDate && t.dueDate < heute && t.status !== 'done' && t.status !== 'cancelled';

/** Deadline kurz — überfällig rot MIT „!“ und Text (#88), heute gelb mit „heute“. */
export function FristZeichen({ t, heute, stil }: { t: Pick<Task, 'status' | 'dueDate'>; heute: string; stil?: CSSProperties }) {
  if (!t.dueDate) return null;
  const d = `${t.dueDate.slice(8, 10)}.${t.dueDate.slice(5, 7)}.`;
  const ueber = istUeberfaellig(t, heute);
  const heuteFaellig = t.dueDate === heute && t.status !== 'done' && t.status !== 'cancelled';
  return (
    <span aria-label={ueber ? `überfällig seit ${d}` : heuteFaellig ? `heute fällig` : `fällig ${d}`} title={ueber ? 'überfällig' : undefined}
      style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: ueber ? LEUCHT.kritisch : heuteFaellig ? LEUCHT.achtung : C.inkLeise, ...stil }}>
      {ueber ? `! ${d}` : heuteFaellig ? 'heute' : d}
    </span>
  );
}
