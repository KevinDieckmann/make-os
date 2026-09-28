'use client';

// ─── Zeit & Fokus — Block einer Aufgabe oder Einheit zuordnen (27.09. spät) ──
// Kevin: „Fokus-Blöcke einer Aufgabe zuordnen, damit wir die Zeit je Einheit
// sehen.“ Zwei Chips nebeneinander: [Aufgabe ▾] wählt aus den offenen
// Business-Aufgaben (Suche ab acht Einträgen, auch nach Einheit) und übernimmt
// deren Einheit; [Einheit ▾] setzt die Einheit direkt, wenn keine Aufgabe
// dahintersteht oder die Aufgabe keine trägt. Trägt die Aufgabe eine Einheit,
// steht sie nur als Marke da — geändert wird sie an der Aufgabe.
// Die Aufgaben kommen aus dem TasksContext (liegt ohnehin geladen) — kein Abruf.
// Seit 28.09. („Mandat an Zielen und Zeit“) dazwischen [Mandat ▾] (aktive Mandate,
// „Firma · Mandatstitel“): das Mandat bestimmt die Einheit (seine Gesellschaft) —
// dann steht auch sie nur als Marke da. Die Zeit je Mandat: ZeitJeMandat.tsx.

import { useMemo } from 'react';
import { useTasks } from '@/context/TasksContext';
import { spaceVonAufgabe } from '@/lib/make-one/space-regeln';
import { einheitName } from '@/lib/einheiten';
import { einheitFarbe } from '@/lib/aufgaben/einheit';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { EinheitWahl, EinheitMarke, useEinheiten } from '../aufgaben/Einheit';
import { MandatWahl, useMandate } from './MandatWahl';
import type { Task } from '@/types/tasks';

export interface Zuordnung { aufgabeId?: string; einheit?: string; mandatId?: string }

const PRIO: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const HOECHSTENS = 300;

/** Offene Business-Aufgaben für die Wahl — kritische und fällige zuerst; die gerade gewählte bleibt drin, auch wenn sie erledigt ist. */
export function aufgabenFuerWahl(tasks: readonly Task[], gewaehlt?: string): WahlEintrag<string>[] {
  return tasks
    .filter(t => t.id === gewaehlt || (t.status !== 'done' && spaceVonAufgabe(t) === 'business'))
    .sort((a, b) => (PRIO[a.priority] ?? 9) - (PRIO[b.priority] ?? 9) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title, 'de'))
    .slice(0, HOECHSTENS)
    .map(t => {
      const e = einheitName(t.einheit);
      return { id: t.id, label: t.title.length > 70 ? `${t.title.slice(0, 69)}…` : t.title, ...(e ? { hinweis: e, punkt: einheitFarbe(e) } : {}) };
    });
}

export function ZuordnungWahl({ wert, setzen, klein, aus }: { wert: Zuordnung; setzen: (z: Zuordnung) => void; klein?: boolean; aus?: boolean }) {
  const { state } = useTasks();
  const { einheiten, anlegen } = useEinheiten();
  const { karte: mandate } = useMandate();
  const liste = useMemo(() => aufgabenFuerWahl(state.tasks, wert.aufgabeId), [state.tasks, wert.aufgabeId]);
  const aufgabe = wert.aufgabeId ? state.tasks.find(t => t.id === wert.aufgabeId) : undefined;
  // Das Mandat ist das Konkreteste (wie im Schreibweg): seine Einheit vor der der Aufgabe.
  const ausMandat = einheitName(wert.mandatId ? mandate.get(wert.mandatId)?.einheit : undefined);
  const fest = ausMandat ?? einheitName(aufgabe?.einheit);
  const mitMandat = wert.mandatId ? { mandatId: wert.mandatId } : {};
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0, maxWidth: '100%' }}>
      <span style={{ display: 'inline-flex', minWidth: 0, maxWidth: '100%' }}>
      <Wahl<string> liste={aufgabe || !wert.aufgabeId ? liste : [...liste, { id: wert.aufgabeId, label: 'Aufgabe (gelöscht)' }]}
        wert={wert.aufgabeId} label="Aufgabe" leer="+ Aufgabe" klein={klein} aus={aus} leerenLabel="ohne Aufgabe"
        onWahl={id => { const t = state.tasks.find(x => x.id === id); setzen({ ...mitMandat, aufgabeId: id, einheit: ausMandat ?? einheitName(t?.einheit) ?? wert.einheit }); }}
        onLeeren={() => setzen({ ...mitMandat, einheit: wert.einheit })} />
      </span>
      <MandatWahl wert={wert.mandatId} klein={klein} aus={aus}
        setzen={m => setzen({ ...(wert.aufgabeId ? { aufgabeId: wert.aufgabeId } : {}), ...(m ? { mandatId: m.id } : {}), einheit: einheitName(m?.einheit) ?? wert.einheit })} />
      {fest
        ? <EinheitMarke name={fest} />
        : <EinheitWahl wert={wert.einheit} setzen={e => setzen({ ...wert, einheit: e })} einheiten={einheiten} anlegen={anlegen} leer="+ nur Einheit" titel="Einheit des Blocks" />}
    </span>
  );
}
