'use client';
// ─── Aufgaben-Board nach Status (28.09. abends) ─────────────────────────────
// Spalten = Status des Space (fest + eigene, in ihrer Reihenfolge); Karten zieht man dazwischen — das setzt Status
// und Grundstatus (statusTeil). Nur Aufgaben (Unteraufgaben zählen als Fortschritt auf der Karte). Das alte Board mit
// Bahnen nach Person/Firma und Zeitstrahl liegt weiter unter /os/aufgaben/board.
// Paket T2 (29.09.): Karten per Tastatur bedienbar (Titel = Knopf, „Status ▾“ direkt auf der Karte, #62), 🔒 „nur ich“,
// „Abgebrochen“ als eigene Spalte (nur mit Karten oder auf Wunsch), Priorität/überfällig auch als Zeichen (#88), Ablegen auf
// „Erledigt“ fragt bei offenen Unteraufgaben (#66) und bietet „Rückgängig“ (#87). Gruppieren einmal je Render (#84).

import { useMemo, useState, type Dispatch } from 'react';
import { MessageSquare, ListChecks } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Punkt, prioFarbe } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { statusListe, statusVon, fortschritt } from '@/lib/aufgaben/struktur';
import type { Task, TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { projektTitel, ownerLabel, type Person } from './hilfe';
import { useHandlung } from './Handlung';
import { NurIchZeichen, PrioZeichen, FristZeichen, titelStil } from './Zeichen';

export function StatusBoard({ state, dispatch, spaceId, aufgaben, personen, heute, offenId, onOeffnen }: {
  state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaceId: string; aufgaben: Task[]; personen: readonly Person[]; heute: string; offenId: string | null; onOeffnen: (id: string) => void;
}) {
  const eigene = useMemo(() => state.statusEigen ?? [], [state.statusEigen]);
  const handlung = useHandlung(dispatch, state.statusEigen);
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [abgebrochenZeigen, setAbgebrochenZeigen] = useState(false);
  // Einmal je Render (#84): Karten je Status und Unteraufgaben je Aufgabe.
  const { jeStatus, kinder } = useMemo(() => {
    const js = new Map<string, Task[]>();
    for (const t of aufgaben) if (!t.parentId) { const id = statusVon(t, eigene).id; js.set(id, [...(js.get(id) ?? []), t]); }
    const k = new Map<string, Task[]>();
    for (const t of state.tasks) if (t.parentId) k.set(t.parentId, [...(k.get(t.parentId) ?? []), t]);
    return { jeStatus: js, kinder: k };
  }, [aufgaben, state.tasks, eigene]);
  const alleSpalten = statusListe(spaceId, eigene);
  const statusWahl: WahlEintrag<string>[] = alleSpalten.map(s => ({ id: s.id, label: s.label, punkt: s.farbe }));
  const spalten = alleSpalten.filter(s => s.basis !== 'cancelled' || abgebrochenZeigen || (jeStatus.get(s.id)?.length ?? 0) > 0);
  const ablegen = (statusId: string) => {
    const t = zieht ? state.tasks.find(x => x.id === zieht) : undefined;
    setZieht(null); setUeber(null);
    if (!t || statusVon(t, eigene).id === statusId) return;
    handlung.statusSetzen(t, statusId);
  };
  return (
    <>
      {!spalten.some(s => s.basis === 'cancelled') && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-4px 0 6px' }}>
          <button onClick={() => setAbgebrochenZeigen(true)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, minHeight: 32 }}>+ Spalte „Abgebrochen“</button>
        </div>
      )}
      <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(250px, 1fr)', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollSnapType: 'x proximity' }}>
        {spalten.map(s => {
          const karten = (jeStatus.get(s.id) ?? []).slice().sort((a, b) => (a.dueDate ?? '9').localeCompare(b.dueDate ?? '9'));
          return (
            <section key={s.id} aria-label={`${s.label} (${karten.length})`} onDragOver={e => { e.preventDefault(); setUeber(s.id); }} onDragLeave={() => setUeber(u => (u === s.id ? null : u))} onDrop={() => ablegen(s.id)}
              style={{ scrollSnapAlign: 'start', background: ueber === s.id ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.02)', borderRadius: 14, padding: 10, minHeight: 220, transition: 'background .15s ease', border: `1px solid ${ueber === s.id ? `${s.farbe}66` : 'rgba(255,255,255,.04)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 4px 10px', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, fontFamily: SCHRIFT.text }}>
                <Punkt farbe={s.farbe} /> {s.label}<span style={{ marginLeft: 'auto', color: C.inkLeise, fontWeight: 600 }}>{karten.length}</span>
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {karten.map(t => {
                  const f = fortschritt(kinder.get(t.id) ?? []);
                  const st = statusVon(t, eigene);
                  return (
                    <div key={t.id} role="group" aria-label={t.title} draggable onDragStart={() => setZieht(t.id)} onDragEnd={() => { setZieht(null); setUeber(null); }}
                      style={{ background: offenId === t.id ? 'rgba(255,255,255,.08)' : C.flaeche, borderRadius: 12, padding: '8px 10px 8px 12px', cursor: 'grab', border: `1px solid ${offenId === t.id ? `${C.aktiv}55` : 'rgba(255,255,255,.05)'}`, opacity: zieht === t.id ? 0.5 : 1 }}>
                      <button id={`oeffnen-${t.id}`} onClick={() => onOeffnen(t.id)} aria-expanded={offenId === t.id} className="fassbar"
                        style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', minHeight: 36, cursor: 'pointer', fontFamily: SCHRIFT.text }}>
                        <span style={{ marginTop: 6 }}><Punkt farbe={prioFarbe(t.priority)} groesse={7} /></span>
                        <span style={{ fontSize: TYP.bedien, fontWeight: 600, lineHeight: 1.35, ...titelStil(t) }}>{t.title}</span>
                      </button>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4, fontSize: 12, color: C.inkLeise, alignItems: 'center' }}>
                        <PrioZeichen p={t.priority} />
                        {t.sichtbarkeit === 'nur-ich' && <NurIchZeichen />}
                        <span>{projektTitel(state, t.projectId)}</span>
                        <span>{ownerLabel(t.assignee, personen)}{t.beteiligte?.length ? ` +${t.beteiligte.length}` : ''}</span>
                        {f.gesamt > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><ListChecks size={12} aria-hidden />{f.fertig}/{f.gesamt}</span>}
                        {!!t.kommentare?.filter(k => !k.entfernt).length && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} aria-hidden />{t.kommentare.filter(k => !k.entfernt).length}</span>}
                        <FristZeichen t={t} heute={heute} />
                        <span style={{ marginLeft: 'auto' }}><Wahl klein label={`Status von „${t.title}“`} liste={statusWahl} wert={st.id} farbe={st.farbe} onWahl={id => handlung.statusSetzen(t, id)} /></span>
                      </div>
                    </div>
                  );
                })}
                {!karten.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '8px 4px' }}>hierher ziehen oder „Status ▾“ an der Karte</div>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
