'use client';
// ─── Papierkorb der Aufgaben (29.09., A7) ───────────────────────────────────
// Unter Aufgaben › Archiv. Gelöschte Projekte (samt Aufgaben, Notiz, Feldern, Listen, Dateien) und Aufgaben (samt
// Unteraufgaben) liegen hier 30 Tage: „Wiederherstellen“ holt die ganze Kette zurück, „Endgültig löschen“ ist ein
// eigener Schritt mit Rückfrage (erst dann gehen auch die Dateien). Regeln: lib/aufgaben/papierkorb.ts.

import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Leer, useRueckfrage } from '../ui';
import { useTasks } from '@/context/TasksContext';
import { aufgabeUmfang, projektUmfang, umfangText } from '@/lib/aufgaben/papierkorb';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import { spaceLabel, tagKurz } from './hilfe';

const mikro = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise } as const;

/** Wie viele Dateien hängen an Projekt/Aufgabe? (für die Rückfrage; 0, wenn die Ablage nicht antwortet) */
export async function dateienZaehlen(bezug: { projektId?: string; aufgabeId?: string }): Promise<number> {
  const q = bezug.aufgabeId ? `aufgabeId=${encodeURIComponent(bezug.aufgabeId)}` : `projektId=${encodeURIComponent(bezug.projektId ?? '')}`;
  try {
    const r = await fetch(`/api/aufgaben/dateien?${q}`, { cache: 'no-store' });
    const d = (await r.json().catch(() => null)) as { anzahl?: number } | null;
    return r.ok && typeof d?.anzahl === 'number' ? d.anzahl : 0;
  } catch { return 0; }
}

export function Papierkorb({ spaces }: { spaces: readonly AufgabenSpace[] }) {
  const { papierkorb, voll, dispatch } = useTasks();
  const { bestaetigen, dialog } = useRueckfrage();
  const endgueltig = async (art: 'projekt' | 'aufgabe', id: string, titel: string) => {
    const dateien = await dateienZaehlen(art === 'projekt' ? { projektId: id } : { aufgabeId: id });
    // Der Umfang zählt, was im Papierkorb mit dieser Wurzel liegt (Aufgaben tragen dort schon ihre Marke).
    const u = art === 'projekt'
      ? { ...projektUmfang({ ...voll, tasks: voll.tasks.map(t => (t.geloeschtMit === id ? { ...t, geloeschtAm: undefined } : t)) }, id, dateien) }
      : aufgabeUmfang({ ...voll, tasks: voll.tasks.map(t => (t.geloeschtMit === id ? { ...t, geloeschtAm: undefined } : t)) }, id, dateien);
    const mit = umfangText(u);
    if (!(await bestaetigen({ titel: `„${titel}“ endgültig löschen?`, text: `${mit ? `Damit gehen auch: ${mit}.\n\n` : ''}Das lässt sich nicht rückgängig machen.`, ja: 'Endgültig löschen', gefahr: true }))) return;
    dispatch({ type: 'ENDGUELTIG_LOESCHEN', payload: { art, id } });
  };
  return (
    <>
      <div style={{ ...mikro, margin: '18px 2px 8px' }}>Papierkorb · 30 Tage</div>
      <Karte i={3}>
        {papierkorb.map(e => (
          <div key={`${e.art}:${e.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise, minWidth: 58 }}>{e.art === 'projekt' ? 'Projekt' : 'Aufgabe'}</span>
            <span style={{ color: C.ink, fontSize: 14 }}>{e.titel}</span>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
              {spaceLabel(spaces, e.spaceId)}{e.mit ? ` · mit ${e.mit} ${e.art === 'projekt' ? (e.mit === 1 ? 'Aufgabe' : 'Aufgaben') : (e.mit === 1 ? 'Unteraufgabe' : 'Unteraufgaben')}` : ''} · gelöscht {tagKurz(e.geloeschtAm.slice(0, 10))} · endgültig ab {tagKurz(e.bisTag)}
            </span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
              <button onClick={() => dispatch({ type: 'WIEDERHERSTELLEN', payload: { art: e.art, id: e.id } })} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Wiederherstellen</button>
              <button onClick={() => void endgueltig(e.art, e.id, e.titel)} style={{ background: 'none', border: 'none', color: LEUCHT.kritisch, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Endgültig löschen</button>
            </span>
          </div>
        ))}
        {!papierkorb.length && <Leer>Der Papierkorb ist leer.</Leer>}
      </Karte>
      {dialog}
    </>
  );
}
