'use client';
// ─── Aufgabe im Detail (28.09. abends, Kevin + Malin: „wie Monday/ClickUp“) ─
// Status (fest + eigene des Space), Zuständig, Priorität, Start, Deadline, Ort (Space › Projekt › Liste),
// Beschreibung, Verknüpfung mit dem CRM (Kontakt, Firma, Mandat, Deal — Link in die Akte), Unteraufgaben,
// Kommentare mit @-Erwähnung. Jede Änderung ist eine Einzeländerung über den Aufgaben-Kontext (Stand/409).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Haken, Knopf, feld, prioFarbe } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { TextMitLinks } from '../TextMitLinks';
import { statusListe, statusVon, statusTeil, erwaehnungen, sonstigeProjektId, fortschritt, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import { crmSuchen, bezugName, bezugLink, bezugSetzen, bezugOhne, BEZUG_ARTEN, BEZUG_LABEL } from '@/lib/aufgaben/crm-verweise';
import { fokusFuerAufgabe } from '@/lib/zeitmessung/fokus-laufend';
import type { Task, TasksState, AufgabeKommentar } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, projektAnlegen, listeAnlegen, projekteImSpace, spacesOderFest, umzugTeil, useCrmVerweise, neueKennung, ownerLabel, type Person } from './hilfe';
import { WiederholungWahl } from './WiederholungWahl';
import { wiederholungSetzen } from '@/lib/aufgaben/serie';

const PRIO: WahlEintrag<Priority>[] = [
  { id: 'critical', label: 'Kritisch', punkt: LEUCHT.kritisch }, { id: 'high', label: 'Hoch', punkt: LEUCHT.achtung },
  { id: 'medium', label: 'Normal', punkt: LEUCHT.puls }, { id: 'low', label: 'Niedrig', punkt: C.inkLeise },
];
const SONST = '__sonstige__';
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const datumFeld: CSSProperties = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '4px 10px', minHeight: 30, colorScheme: 'dark' };
const zeit = (iso: string) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', alignItems: 'center', gap: 10, minHeight: 34 }}>
      <span style={mikro}>{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function AufgabeDetail({ task: t, state, dispatch, spaces, personen, ich, onSchliessen, onOeffnen, i = 1 }: {
  task: Task;
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  spaces: readonly AufgabenSpace[];
  personen: readonly Person[];
  ich: string;
  onSchliessen: () => void;
  onOeffnen: (id: string) => void;
  i?: number;
}) {
  const aendern = (teil: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...teil } });
  const alleSpaces = spacesOderFest(spaces);
  const space = alleSpaces.find(s => s.id === t.spaceId);
  const eltern = t.parentId ? state.tasks.find(x => x.id === t.parentId) : undefined;
  const unter = state.tasks.filter(x => x.parentId === t.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const eigene = state.statusEigen ?? [];
  const status = statusVon(t, eigene);
  const statusWahl: WahlEintrag<string>[] = statusListe(t.spaceId, eigene).map(s => ({ id: s.id, label: s.label, punkt: s.farbe, ...(s.eigen ? { hinweis: 'eigener Status' } : {}) }));
  const personenWahl: WahlEintrag<Owner>[] = [...personen.map(p => ({ id: p.speicher as Owner, label: p.name })), { id: 'both', label: 'Beide' }];
  const projekte = projekteImSpace(state, t.spaceId ?? 'privat');
  const projektWahl: WahlEintrag<string>[] = [...projekte.map(p => ({ id: p.id, label: p.title, punkt: p.color })), { id: sonstigeProjektId(t.spaceId ?? 'privat'), label: 'Sonstige' }];
  const listen = (state.listen ?? []).filter(l => l.projektId === t.projectId && !l.archiviert).sort((a, b) => a.sortOrder - b.sortOrder);
  const listenWahl: WahlEintrag<string>[] = [...listen.map(l => ({ id: l.id, label: l.titel })), { id: SONST, label: 'Sonstige' }];
  const spaceWahl: WahlEintrag<string>[] = alleSpaces.filter(s => !s.archiv || s.id === t.spaceId).map(s => ({ id: s.id, label: s.label, punkt: s.farbe }));
  const fremdesProjekt = !projekte.some(p => p.id === t.projectId) && state.projects.some(p => p.id === t.projectId);

  const [titel, setTitel] = useState(t.title);
  useEffect(() => { setTitel(t.title); }, [t.id, t.title]);
  const [neuUnter, setNeuUnter] = useState('');

  return (
    <Karte i={i} akzent={status.farbe} id={`aufgabe-${t.id}`}>
      {/* Pfad: Space › Projekt › Liste (› übergeordnete Aufgabe) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12.5, color: C.inkLeise, marginBottom: 8 }}>
        <span style={{ color: space?.farbe ?? C.inkDim, fontWeight: 600 }}>{space?.label ?? 'Space'}</span>
        <span aria-hidden>›</span><span>{state.projects.find(p => p.id === t.projectId)?.title ?? 'Sonstige'}</span>
        <span aria-hidden>›</span><span>{listen.find(l => l.id === t.listeId)?.titel ?? 'Sonstige'}</span>
        {eltern && <><span aria-hidden>›</span><button onClick={() => onOeffnen(eltern.id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>{eltern.title}</button></>}
        <button onClick={onSchliessen} aria-label="Schließen" className="fassbar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 6px' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ paddingTop: 8 }}><Haken an={t.status === 'done'} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} /></div>
        <textarea value={titel} onChange={e => setTitel(e.target.value)} rows={1} aria-label="Titel"
          onBlur={() => { const v = titel.replace(/\s+/g, ' ').trim(); if (v && v !== t.title) aendern({ title: v }); else setTitel(t.title); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
          style={{ ...feld, fontFamily: SCHRIFT.display, fontSize: 19, fontWeight: 700, letterSpacing: '-.01em', background: 'transparent', border: '1px solid transparent', padding: '6px 8px', resize: 'none', lineHeight: 1.3, textDecoration: t.status === 'done' ? 'line-through' : 'none', color: t.status === 'done' ? C.inkDim : C.ink, fieldSizing: 'content' } as CSSProperties} />
      </div>

      <div style={{ display: 'grid', gap: 4, marginBottom: 14 }}>
        <Feld label="Status">
          <Wahl klein label="Status" liste={statusWahl} wert={status.id} farbe={status.farbe} onWahl={id => aendern(statusTeil(t, id, eigene))} />
        </Feld>
        <Feld label="Zuständig">
          <Wahl klein label="Zuständig" liste={personenWahl} wert={t.assignee} onWahl={a => aendern({ assignee: a })} />
        </Feld>
        <Feld label="Priorität">
          <Wahl klein label="Priorität" liste={PRIO} wert={t.priority} farbe={prioFarbe(t.priority)} onWahl={p => aendern({ priority: p })} />
        </Feld>
        <Feld label="Zeitraum">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}>Start
            <input type="date" value={t.startDate ?? ''} onChange={e => aendern({ startDate: e.target.value || undefined })} style={datumFeld} aria-label="Startdatum" /></label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}>Deadline
            <input type="date" value={t.dueDate ?? ''} onChange={e => aendern({ dueDate: e.target.value || undefined })} style={datumFeld} aria-label="Deadline" /></label>
        </Feld>
        {!eltern && <Feld label="Wiederholt"><WiederholungWahl wert={t.wiederholung} basis={t.dueDate} onChange={w => aendern(wiederholungSetzen(t, w))} /></Feld>}
        {!eltern && (
          <Feld label="Ort">
            <Wahl klein label="Space" liste={spaceWahl} wert={t.spaceId} farbe={space?.farbe} onWahl={id => aendern(umzugTeil(state, t, { spaceId: id }))} />
            <Wahl klein label="Projekt" liste={fremdesProjekt ? [{ id: t.projectId, label: state.projects.find(p => p.id === t.projectId)?.title ?? '' }, ...projektWahl] : projektWahl} wert={t.projectId}
              onWahl={id => aendern(umzugTeil(state, t, { projectId: id, listeId: null }))}
              onNeu={async titel => projektAnlegen(dispatch, t.spaceId ?? 'privat', titel, space?.farbe ?? '#58D9CD')} neuMax={80} />
            <Wahl klein label="Liste" liste={listenWahl} wert={t.listeId && listen.some(l => l.id === t.listeId) ? t.listeId : SONST}
              onWahl={id => aendern(umzugTeil(state, t, { listeId: id === SONST ? null : id }))}
              onNeu={async titel => listeAnlegen(dispatch, state, t.projectId, titel)} neuMax={80} />
          </Feld>
        )}
      </div>

      <div style={{ ...mikro, marginBottom: 6 }}>Beschreibung</div>
      <textarea key={`${t.id}-${t.updatedAt}`} defaultValue={t.description ?? ''} placeholder="Worum geht es? Links (z. B. aus der Markttraktion) werden klickbar."
        onBlur={e => { const v = e.target.value.trim(); if (v !== (t.description ?? '').trim()) aendern({ description: v }); }}
        rows={3} style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, resize: 'vertical', minHeight: 70 }} />
      {/(\/os\/|https?:\/\/)/.test(t.description ?? '') && <TextMitLinks text={(t.description ?? '').trim()} style={{ fontSize: 12.5, color: C.inkDim, marginTop: 6, maxHeight: 160, overflowY: 'auto' }} />}

      <CrmVerknuepfung task={t} aendern={aendern} />

      {!eltern && (
        <>
          <div style={{ ...mikro, margin: '16px 0 6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Unteraufgaben</span>{unter.length > 0 && <span>{fortschritt(unter).fertig}/{unter.length}</span>}
          </div>
          {unter.map(u => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <Haken an={u.status === 'done'} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: u.id } })} farbe={prioFarbe(u.priority)} />
              <button onClick={() => onOeffnen(u.id)} className="fassbar" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', color: u.status === 'done' ? C.inkLeise : C.ink, textDecoration: u.status === 'done' ? 'line-through' : 'none', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.title}</button>
              {u.assignee !== t.assignee && <span style={{ fontSize: 12, color: C.inkLeise }}>{ownerLabel(u.assignee, personen)}</span>}
              {u.dueDate && <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{u.dueDate.slice(8)}.{u.dueDate.slice(5, 7)}.</span>}
            </div>
          ))}
          <input value={neuUnter} onChange={e => setNeuUnter(e.target.value)} aria-label="Neue Unteraufgabe"
            onKeyDown={e => { if (e.key === 'Enter' && neuUnter.trim()) { aufgabeAnlegen(dispatch, state, { spaceId: t.spaceId ?? 'privat', parentId: t.id }, { title: neuUnter.trim(), assignee: t.assignee, bezug: t.bezug }); setNeuUnter(''); } }}
            placeholder="+ Unteraufgabe (Enter)" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px', marginTop: 6 }} />
        </>
      )}

      <Kommentare task={t} ich={ich} personen={personen} aendern={aendern} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
        {t.spaceId !== 'privat' && t.status !== 'done' && (
          <Knopf leise onClick={() => fokusFuerAufgabe({ id: t.id, einheit: t.einheit })}>▶ Fokus</Knopf>
        )}
        <span style={{ fontSize: 12, color: C.inkLeise }}>angelegt {zeit(t.createdAt)}</span>
        <button onClick={() => {
          if (unter.length && !window.confirm(`„${t.title}“ mit ${unter.length} Unteraufgabe${unter.length === 1 ? '' : 'n'} löschen?`)) return;
          dispatch({ type: 'DELETE_TASK', payload: { id: t.id } }); onSchliessen();
        }} className="fassbar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>Löschen</button>
      </div>
    </Karte>
  );
}

// ── CRM-Verknüpfung ─────────────────────────────────────────────────────────
function CrmVerknuepfung({ task: t, aendern }: { task: Task; aendern: (teil: Partial<Task>) => void }) {
  const [suche, setSuche] = useState('');
  const [offen, setOffen] = useState(false);
  const verweise = useCrmVerweise(offen || !!t.bezug);
  const treffer = useMemo(() => crmSuchen(verweise, suche), [verweise, suche]);
  const feldRef = useRef<HTMLInputElement>(null);
  const gesetzt = BEZUG_ARTEN.filter(a => t.bezug?.[a]);
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...mikro, marginBottom: 6 }}>Verknüpft im CRM</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {gesetzt.map(a => {
          const id = t.bezug![a]!;
          const name = bezugName(verweise, a, id);
          return (
            <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${LEUCHT.business}55`, background: `${LEUCHT.business}14`, borderRadius: 999, padding: '3px 4px 3px 10px', fontSize: 12.5 }}>
              <span style={{ color: C.inkLeise }}>{BEZUG_LABEL[a]}</span>
              <Link href={bezugLink(a, id)} style={{ color: LEUCHT.business, textDecoration: 'none', fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name ?? (verweise ? 'nicht mehr im CRM' : '…')}</Link>
              <button onClick={() => aendern({ bezug: bezugOhne(t.bezug, a) })} aria-label={`${BEZUG_LABEL[a]} lösen`} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 14, padding: '0 6px' }}>×</button>
            </span>
          );
        })}
        {!offen && <button onClick={() => { setOffen(true); setTimeout(() => feldRef.current?.focus(), 0); }} className="fassbar" style={{ border: '1px dashed rgba(255,255,255,.2)', background: 'transparent', color: C.inkDim, borderRadius: 999, padding: '4px 11px', fontSize: 12.5, cursor: 'pointer', fontFamily: SCHRIFT.text }}>+ Kontakt, Firma, Mandat, Deal</button>}
      </div>
      {offen && (
        <div style={{ marginTop: 8 }}>
          <input ref={feldRef} value={suche} onChange={e => setSuche(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setOffen(false); setSuche(''); } if (e.key === 'Enter' && treffer[0]) { aendern({ bezug: bezugSetzen(t.bezug, treffer[0], verweise) }); setSuche(''); setOffen(false); } }}
            placeholder={verweise ? 'Name, Firma, Mandat oder Deal suchen …' : 'Kartei wird geladen …'} aria-label="Im CRM suchen" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 12px' }} />
          <div style={{ marginTop: 4, display: 'grid' }}>
            {treffer.map(x => (
              <button key={`${x.art}-${x.id}`} onClick={() => { aendern({ bezug: bezugSetzen(t.bezug, x, verweise) }); setSuche(''); setOffen(false); }} className="fassbar"
                style={{ display: 'flex', gap: 10, alignItems: 'baseline', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '8px 4px', cursor: 'pointer', color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
                <span style={{ ...mikro, width: 62, flex: '0 0 auto' }}>{BEZUG_LABEL[x.art]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                {x.unter && <span style={{ color: C.inkLeise, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.unter}</span>}
              </button>
            ))}
            {suche.trim() && verweise && !treffer.length && <span style={{ fontSize: 12.5, color: C.inkLeise, padding: '6px 4px' }}>Nichts gefunden.</span>}
            <button onClick={() => { setOffen(false); setSuche(''); }} style={{ justifySelf: 'start', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12, padding: '6px 4px' }}>fertig</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Kommentare mit @-Erwähnung ──────────────────────────────────────────────
function Kommentare({ task: t, ich, personen, aendern }: { task: Task; ich: string; personen: readonly Person[]; aendern: (teil: Partial<Task>) => void }) {
  const [text, setText] = useState('');
  const liste = t.kommentare ?? [];
  // Angefangenes @-Wort am Ende → Vorschläge zum Antippen.
  const angefangen = /(^|\s)@([\p{L}\p{N}_-]*)$/u.exec(text)?.[2]?.toLocaleLowerCase('de-DE');
  const vorschlaege = angefangen !== undefined ? personen.filter(p => p.speicher !== ich && p.namen.some(n => n.toLocaleLowerCase('de-DE').startsWith(angefangen))) : [];
  const senden = () => {
    const v = text.trim();
    if (!v || !ich) return;
    const k: AufgabeKommentar = { id: neueKennung('k'), von: ich, text: v, am: new Date().toISOString(), erwaehnt: erwaehnungen(v, personen) };
    if (!k.erwaehnt?.length) delete k.erwaehnt;
    aendern({ kommentare: [...liste, k] });
    setText('');
  };
  const name = (s: string) => personen.find(p => p.speicher === s)?.name ?? s;
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...mikro, marginBottom: 6 }}>Kommentare{liste.length ? ` · ${liste.length}` : ''}</div>
      {liste.map(k => (
        <div key={k.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: C.inkLeise }}>
            <b style={{ color: C.inkDim, fontWeight: 600 }}>{name(k.von)}</b><span>{zeit(k.am)}</span>
            {k.von === ich && <button onClick={() => aendern({ kommentare: liste.filter(x => x.id !== k.id) })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, fontFamily: SCHRIFT.text }}>entfernen</button>}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.ink, whiteSpace: 'pre-wrap', marginTop: 3, lineHeight: 1.5 }}>
            {k.text.split(/(@[\p{L}\p{N}_-]+)/u).map((s, n) => (s.startsWith('@') && erwaehnungen(s, personen).length ? <b key={n} style={{ color: C.aktiv, fontWeight: 600 }}>{s}</b> : <span key={n}>{s}</span>))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} aria-label="Kommentar"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); senden(); } }}
          placeholder="Kommentar … @ erwähnt jemanden (⌘ + Enter sendet)" style={{ ...feld, fontSize: TYP.bedien, resize: 'vertical', flex: 1, minWidth: 0, width: 'auto', padding: '8px 12px' }} />
        <Knopf onClick={senden} aus={!text.trim() || !ich}>Senden</Knopf>
      </div>
      {vorschlaege.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {vorschlaege.map(p => (
            <button key={p.speicher} onClick={() => setText(x => x.replace(/@([\p{L}\p{N}_-]*)$/u, `@${p.name} `))} className="fassbar"
              style={{ border: `1px solid ${C.aktiv}66`, background: `${C.aktiv}14`, color: C.aktiv, borderRadius: 999, padding: '3px 10px', fontSize: 12.5, cursor: 'pointer', fontFamily: SCHRIFT.text }}>@{p.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
