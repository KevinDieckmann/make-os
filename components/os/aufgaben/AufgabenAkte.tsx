'use client';
// ─── Aufgaben in der CRM-Akte (28.09. abends) ───────────────────────────────
// Kontakt öffnen und Firmenakte zeigen die offenen Aufgaben, die mit der Person bzw. Firma (auch über ein Mandat oder
// einen Deal der Firma) verknüpft sind — mit „+ Aufgabe“, vorbelegt mit dem Bezug und bei einem Mandanten mit
// seinem Space. Die Aufgabe selbst öffnet sich auf der Aufgaben-Seite (WEG.aufgabe).

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Haken, feld, prioFarbe } from '../schlank';
import { useTasks } from '@/context/TasksContext';
import { aufgabenFuer } from '@/lib/aufgaben/crm-verweise';
import { mandantSpaceId } from '@/lib/aufgaben/struktur';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { aufgabeAnlegen } from './hilfe';

export interface AkteBezug { kontaktId?: string; firmaId?: string; mandatIds?: readonly string[]; dealIds?: readonly string[]; /** Firma mit aktivem Mandat → neue Aufgaben landen in ihrem Mandanten-Space. */ mandantFirmaId?: string }

/** Die offenen Aufgaben einer Akte (Zahl für Überschriften). */
export function useAkteAufgaben(b: AkteBezug) {
  const { state } = useTasks();
  const { kontaktId, firmaId, mandatIds, dealIds } = b;
  return useMemo(() => aufgabenFuer(state.tasks, { kontaktId, firmaId, mandatIds, dealIds }).filter(t => t.status !== 'done').sort((a, c) => (a.dueDate ?? '9').localeCompare(c.dueDate ?? '9')), [state.tasks, kontaktId, firmaId, mandatIds, dealIds]);
}

export function AufgabenAkte(b: AkteBezug) {
  const { state, dispatch } = useTasks();
  const offen = useAkteAufgaben(b);
  const [text, setText] = useState('');
  const heute = localDay();
  const spaceId = b.mandantFirmaId ? mandantSpaceId(b.mandantFirmaId) : 'kdv';
  const anlegen = () => {
    const v = text.trim();
    if (!v) return;
    aufgabeAnlegen(dispatch, state, { spaceId }, { title: v, bezug: { ...(b.kontaktId ? { kontaktId: b.kontaktId } : {}), ...((b.firmaId ?? b.mandantFirmaId) ? { firmaId: b.firmaId ?? b.mandantFirmaId } : {}) } });
    setText('');
  };
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {offen.slice(0, 8).map(t => (
        <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.045)' }}>
          <Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />
          <Link href={WEG.aufgabe(t.id)} className="fassbar" style={{ flex: 1, minWidth: 0, color: C.ink, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</Link>
          {t.dueDate && <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: t.dueDate < heute ? LEUCHT.kritisch : C.inkLeise }}>{t.dueDate.slice(8)}.{t.dueDate.slice(5, 7)}.</span>}
        </div>
      ))}
      {offen.length > 8 && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 4 }}>… und {offen.length - 8} weitere.</div>}
      {!offen.length && <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine offene Aufgabe.</div>}
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }} aria-label="Neue Aufgabe zu dieser Akte"
        placeholder="+ Aufgabe (Enter)" style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', marginTop: 6, fontFamily: SCHRIFT.text }} />
      {b.mandantFirmaId && <Link href={WEG.aufgaben({ space: 'business', r: mandantSpaceId(b.mandantFirmaId) })} style={{ fontSize: 12, color: C.aktiv, textDecoration: 'none', marginTop: 4 }}>Alle Aufgaben des Mandanten ›</Link>}
    </div>
  );
}
