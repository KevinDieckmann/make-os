'use client';
// ─── Aufgaben: Schnell anlegen ganz oben (28.09. abends, Kevin + Malin) ─────
// Titel tippen, dann per Klick zuordnen: Space, Projekt, Liste oder übergeordnete Aufgabe — vorbelegt mit dem, was
// gerade offen ist; Enter legt an. Neues Projekt / neue Liste direkt aus der Auswahl („+ neu …“, `onNeu`).
// Kürzel wie bisher (lib/make-one/schnell-anlegen.ts): !! kritisch · ! hoch · heute/morgen/mo–so/24.09. · #projekt · @malin/@beide.
// Nicht zugeordnet → „Sonstige“.

import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, feld, LEUCHT } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { parseSchnell } from '@/lib/make-one/schnell-anlegen';
import { sonstigeProjektId, istSonstigeProjekt, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, projektAnlegen, listeAnlegen, projekteImSpace, spacesOderFest } from './hilfe';

const SONST = '__sonstige__';

export function SchnellAnlegen({ state, dispatch, spaces, vorbelegt, onAngelegt }: {
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  spaces: readonly AufgabenSpace[];
  /** Was gerade offen ist: Space, Projekt, Liste. */
  vorbelegt: { spaceId: string; projectId?: string; listeId?: string };
  onAngelegt?: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [spaceId, setSpaceId] = useState(vorbelegt.spaceId);
  const [projektId, setProjektId] = useState<string>(vorbelegt.projectId ?? sonstigeProjektId(vorbelegt.spaceId));
  const [listeId, setListeId] = useState<string>(vorbelegt.listeId ?? SONST);
  const [parentId, setParentId] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);
  const schluessel = `${vorbelegt.spaceId}|${vorbelegt.projectId ?? ''}|${vorbelegt.listeId ?? ''}`;
  // Neue Vorbelegung (anderer Space/Projekt/Liste offen) → Auswahl folgt.
  useEffect(() => {
    setSpaceId(vorbelegt.spaceId);
    setProjektId(vorbelegt.projectId ?? sonstigeProjektId(vorbelegt.spaceId));
    setListeId(vorbelegt.listeId ?? SONST);
    setParentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  const alle = spacesOderFest(spaces).filter(s => !s.archiv || s.id === spaceId);
  const space = alle.find(s => s.id === spaceId);
  const projekte = projekteImSpace(state, spaceId);
  const spaceListe: WahlEintrag<string>[] = alle.map(s => ({ id: s.id, label: s.label, punkt: s.farbe, hinweis: s.bereich === 'privat' ? 'Privat' : s.art === 'mandant' ? 'Mandant' : 'Firma' }));
  const projektListe: WahlEintrag<string>[] = [...projekte.map(p => ({ id: p.id, label: p.title, punkt: p.color })), { id: sonstigeProjektId(spaceId), label: 'Sonstige' }];
  const listen = (state.listen ?? []).filter(l => l.projektId === projektId && !l.archiviert).sort((a, b) => a.sortOrder - b.sortOrder);
  const listenListe: WahlEintrag<string>[] = [...listen.map(l => ({ id: l.id, label: l.titel })), { id: SONST, label: 'Sonstige' }];
  const elternListe: WahlEintrag<string>[] = useMemo(() => state.tasks
    .filter(t => t.spaceId === spaceId && !t.parentId && t.status !== 'done' && t.projectId === projektId && (listeId === SONST ? !t.listeId || !listen.some(l => l.id === t.listeId) : t.listeId === listeId))
    .sort((a, b) => a.title.localeCompare(b.title, 'de'))
    .map(t => ({ id: t.id, label: t.title })), [state.tasks, spaceId, projektId, listeId, listen]);

  const anlegen = () => {
    const roh = text.trim();
    if (!roh) { eingabe.current?.focus(); return; }
    const p = parseSchnell(roh, projekte);
    if (!p.title) return;
    const pid = p.projectId ?? projektId;
    const id = aufgabeAnlegen(dispatch, state, {
      spaceId, projectId: pid, listeId: pid === projektId && listeId !== SONST ? listeId : undefined, parentId: parentId ?? undefined,
    }, { title: p.title, priority: p.priority, assignee: p.assignee, dueDate: p.dueDate });
    setText('');
    setHinweis(`Angelegt: „${p.title}“`);
    setTimeout(() => setHinweis(null), 2500);
    onAngelegt?.(id);
  };

  const chip = { klein: true } as const;
  return (
    <Karte i={0} akzent={LEUCHT.achtung}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={eingabe} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
          aria-label="Neue Aufgabe" placeholder="Neue Aufgabe … (!! kritisch · heute / mo–so / 24.09. · #projekt · @malin)"
          style={{ ...feld, fontSize: TYP.body, flex: 1, minWidth: 0, width: 'auto' }} />
        <Knopf onClick={anlegen}>Anlegen</Knopf>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10, fontFamily: SCHRIFT.text, fontSize: 12.5, color: C.inkLeise }}>
        <span>in</span>
        <Wahl {...chip} label="Space" liste={spaceListe} wert={spaceId} farbe={space?.farbe ?? C.aktiv}
          onWahl={id => { setSpaceId(id); setProjektId(sonstigeProjektId(id)); setListeId(SONST); setParentId(null); }} />
        <span aria-hidden>›</span>
        <Wahl {...chip} label="Projekt" liste={projektListe} wert={projektId}
          onWahl={id => { setProjektId(id); setListeId(SONST); setParentId(null); }}
          onNeu={async titel => projektAnlegen(dispatch, spaceId, titel, space?.farbe ?? '#58D9CD')} neuMax={80} />
        <span aria-hidden>›</span>
        <Wahl {...chip} label="Liste" liste={listenListe} wert={listeId}
          onWahl={id => { setListeId(id); setParentId(null); }}
          onNeu={async titel => listeAnlegen(dispatch, state, projektId, titel)} neuMax={80} />
        {elternListe.length > 0 && <>
          <span aria-hidden>›</span>
          <Wahl {...chip} label="Übergeordnete Aufgabe" leer="+ als Unteraufgabe" liste={elternListe} wert={parentId} onWahl={setParentId} onLeeren={() => setParentId(null)} leerenLabel="keine (eigene Aufgabe)" />
        </>}
        {istSonstigeProjekt(projektId) && listeId === SONST && !parentId && <span style={{ color: C.inkLeise }}>· landet unter „Sonstige“</span>}
        {hinweis && <span role="status" style={{ marginLeft: 'auto', color: LEUCHT.gut }}>{hinweis}</span>}
      </div>
    </Karte>
  );
}
