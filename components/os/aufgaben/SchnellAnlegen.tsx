'use client';
// ─── Aufgaben: Schnell anlegen ganz oben (28.09. abends, Kevin + Malin) ─────
// Titel tippen, dann per Klick zuordnen: Space, Projekt, Gruppe (28.09. spät), Liste oder übergeordnete Aufgabe — vorbelegt mit dem, was
// gerade offen ist; Enter legt an. Neues Projekt / neue Liste direkt aus der Auswahl („+ neu …“, `onNeu`).
// Kürzel wie bisher (lib/make-one/schnell-anlegen.ts): !! kritisch · ! hoch · heute/morgen/mo–so/24.09. · #projekt · @Name (aus dem Team)/@beide.
// Nicht zugeordnet → „Sonstige“.
// 29.09. (Paket T2): Schalter „🔒 nur ich“; Vorschau dessen, was erkannt wurde („Fr 02.10. · kritisch · @Malin“), BEVOR
// gespeichert wird (#21); „@beide“ = ich verantwortlich + die andere beteiligt (kein „Beide“ mehr); ohne @ = ich.

import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { Lock } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, feld, LEUCHT } from '../ui';
import { useHandy } from '@/hooks/useHandy';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { parseSchnell, schnellVorschau, schnellZustaendigkeit, type SchnellPerson } from '@/lib/make-one/schnell-anlegen';
import { sonstigeProjektId, istSonstigeProjekt, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, projektAnlegen, listeAnlegen, gruppeAnlegen, projekteImSpace, spacesOderFest, usePersonen, useIch } from './hilfe';
import type { Owner } from '@/types/common';
import { nachIdKarte, darfUnteraufgabe, pfadText } from '@/lib/aufgaben/ebenen';

const SONST = '__sonstige__';
const ALLE = '__alle__';

export function SchnellAnlegen({ state, dispatch, spaces, vorbelegt, onAngelegt }: {
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  spaces: readonly AufgabenSpace[];
  /** Was gerade offen ist: Space, Projekt, Liste. */
  vorbelegt: { spaceId: string; projectId?: string; gruppeId?: string; listeId?: string };
  onAngelegt?: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const [spaceId, setSpaceId] = useState(vorbelegt.spaceId);
  const [projektId, setProjektId] = useState<string>(vorbelegt.projectId ?? sonstigeProjektId(vorbelegt.spaceId));
  const [gruppeId, setGruppeId] = useState<string>(vorbelegt.gruppeId ?? ALLE);
  const [listeId, setListeId] = useState<string>(vorbelegt.listeId ?? SONST);
  const [parentId, setParentId] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [nurIch, setNurIch] = useState(false);
  // Am Handy steht der Ort als EINE Zeile („in KD Ventures › Projekt › Liste · ändern“); die Wahl-Chips klappen erst auf Wunsch auf.
  const handy = useHandy();
  const [ortAuf, setOrtAuf] = useState(false);
  const personen = usePersonen();
  const ich = useIch();
  const eingabe = useRef<HTMLInputElement>(null);
  const schluessel = `${vorbelegt.spaceId}|${vorbelegt.projectId ?? ''}|${vorbelegt.gruppeId ?? ''}|${vorbelegt.listeId ?? ''}`;
  // Neue Vorbelegung (anderer Space/Projekt/Liste offen) → Auswahl folgt.
  useEffect(() => {
    setSpaceId(vorbelegt.spaceId);
    setProjektId(vorbelegt.projectId ?? sonstigeProjektId(vorbelegt.spaceId));
    setGruppeId(vorbelegt.gruppeId ?? ALLE);
    setListeId(vorbelegt.listeId ?? SONST);
    setParentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  const alle = spacesOderFest(spaces).filter(s => !s.archiv || s.id === spaceId);
  const space = alle.find(s => s.id === spaceId);
  const projekte = projekteImSpace(state, spaceId);
  const spaceListe: WahlEintrag<string>[] = alle.map(s => ({ id: s.id, label: s.label, punkt: s.farbe, hinweis: s.bereich === 'privat' ? 'Privat' : s.art === 'mandant' ? 'Mandant' : 'Firma' }));
  const projektListe: WahlEintrag<string>[] = [...projekte.map(p => ({ id: p.id, label: p.title, punkt: p.color })), { id: sonstigeProjektId(spaceId), label: 'Sonstige' }];
  const gruppen = (state.gruppen ?? []).filter(g => g.projektId === projektId).sort((a, b) => a.sortOrder - b.sortOrder);
  const gruppenListe: WahlEintrag<string>[] = [{ id: ALLE, label: 'ohne Gruppe' }, ...gruppen.map(g => ({ id: g.id, label: g.titel, punkt: g.farbe }))];
  const listen = (state.listen ?? []).filter(l => l.projektId === projektId && !l.archiviert && (gruppeId === ALLE || l.gruppeId === gruppeId)).sort((a, b) => a.sortOrder - b.sortOrder);
  const listenListe: WahlEintrag<string>[] = [...listen.map(l => ({ id: l.id, label: l.titel })), { id: SONST, label: 'Sonstige' }];
  // Übergeordnete Aufgabe auf jeder Ebene (01.10.): alle offenen im Ort, unter denen noch eine Ebene Platz hat — mit Pfad.
  const elternListe: WahlEintrag<string>[] = useMemo(() => {
    const nachId = nachIdKarte(state.tasks);
    return state.tasks
      .filter(t => t.spaceId === spaceId && t.status !== 'done' && t.status !== 'cancelled' && t.projectId === projektId && (listeId === SONST ? !t.listeId || !listen.some(l => l.id === t.listeId) : t.listeId === listeId) && darfUnteraufgabe(t, nachId))
      .map(t => ({ id: t.id, label: pfadText(t, nachId) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [state.tasks, spaceId, projektId, listeId, listen]);

  // @Name aus dem Team (29.09., F4): Vorname, Kurzname, Speichername — nicht mehr fest @kevin/@malin.
  const schnellPersonen = useMemo<SchnellPerson[]>(() => personen.map(x => ({ speicher: x.speicher, namen: x.namen })), [personen]);
  const erkannt = text.trim() ? parseSchnell(text.trim(), projekte, undefined, schnellPersonen) : null;
  const vorschau = erkannt ? schnellVorschau(erkannt, projekte, Object.fromEntries(personen.map(x => [x.speicher, x.name]))) : [];
  const anlegen = () => {
    const roh = text.trim();
    if (!roh) { eingabe.current?.focus(); return; }
    const p = parseSchnell(roh, projekte, undefined, schnellPersonen);
    if (!p.title) return;
    const pid = p.projectId ?? projektId;
    // Eine Verantwortliche (29.09.): ohne @ = ich; erste @Person verantwortlich, weitere beteiligt; „@beide“ = ich + alle anderen.
    const selbst = ich || personen[0]?.speicher || 'kevin';
    // „Nur ich“ gehört der Anlegerin — zuständig kann nur sie sein, Beteiligte gibt es dann nicht (Server-Regel T1).
    const z = schnellZustaendigkeit(p, selbst, personen.map(x => x.speicher), nurIch);
    const id = aufgabeAnlegen(dispatch, state, {
      spaceId, projectId: pid, listeId: pid === projektId && listeId !== SONST ? listeId : undefined, parentId: parentId ?? undefined,
    }, { title: p.title, priority: p.priority, assignee: z.assignee as Owner, dueDate: p.dueDate, ...(z.beteiligte?.length ? { beteiligte: z.beteiligte } : {}), ...(nurIch ? { sichtbarkeit: 'nur-ich' as const } : {}) });
    setText('');
    // „nur ich“ gilt für GENAU diese Aufgabe (29.09., F3) — danach wieder aus, sonst wird die nächste still privat.
    setNurIch(false);
    setHinweis(`Angelegt: „${p.title}“${p.dueDate ? ` · fällig ${vorschau[0] ?? ''}` : ''}${nurIch ? ' · nur ich' : ''}`);
    setTimeout(() => setHinweis(null), 2500);
    onAngelegt?.(id);
  };

  const chip = { klein: true } as const;
  return (
    <Karte i={0} akzent={LEUCHT.achtung}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={eingabe} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }}
          aria-label="Neue Aufgabe" placeholder="Neue Aufgabe …" aria-describedby="schnell-kuerzel"
          style={{ ...feld, fontSize: TYP.body, flex: '1 1 240px', minWidth: 0, width: 'auto' }} />
        <button type="button" aria-pressed={nurIch} onClick={() => setNurIch(n => !n)} className="fassbar" title="Nur ich: niemand sonst sieht die Aufgabe"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 44, padding: '0 12px', borderRadius: 12, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, whiteSpace: 'nowrap',
            border: `1px solid ${nurIch ? `${LEUCHT.schlaf}99` : 'rgba(255,255,255,.1)'}`, background: nurIch ? `${LEUCHT.schlaf}22` : 'rgba(255,255,255,.03)', color: nurIch ? LEUCHT.schlaf : C.inkLeise }}>
          <Lock size={13} aria-hidden /> nur ich
        </button>
        <Knopf onClick={anlegen}>Anlegen</Knopf>
      </div>
      {!text.trim() && <div id="schnell-kuerzel" style={{ marginTop: 6, fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Kürzel: !! kritisch · heute / mo–so / 24.09. · #projekt · @{personen.find(x => x.speicher !== ich)?.name ?? 'Name'}</div>}
      {erkannt && (vorschau.length > 0 || erkannt.datumUngueltig) && (
        <div aria-live="polite" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: TYP.bedien, color: C.inkDim }}>
          <span style={{ color: C.inkLeise }}>erkannt:</span>
          {vorschau.map((v, i) => <span key={i} style={{ border: `1px solid ${i === 0 && erkannt.dueDate ? `${LEUCHT.achtung}77` : 'rgba(255,255,255,.12)'}`, borderRadius: 999, padding: '1px 9px', color: i === 0 && erkannt.dueDate ? LEUCHT.achtung : C.inkDim }}>{v}</span>)}
          {nurIch && erkannt.zustaendigGetippt && <span style={{ color: LEUCHT.achtung }}>„nur ich“: zuständig bist du</span>}
          {erkannt.datumUngueltig && <span style={{ color: LEUCHT.kritisch }}>„{erkannt.datumUngueltig}“ gibt es nicht — kein Datum gesetzt</span>}
          <span style={{ color: C.inkLeise }}>· Titel: „{erkannt.title}“</span>
        </div>
      )}
      {handy && !ortAuf && (
        <button type="button" onClick={() => setOrtAuf(true)} aria-expanded={false} className="fassbar" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', marginTop: 10, padding: '0 12px', minHeight: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left', cursor: 'pointer' }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>in <b style={{ color: space?.farbe ?? C.ink, fontWeight: 600 }}>{space?.label ?? 'Space'}</b> › {projektListe.find(p => p.id === projektId)?.label ?? 'Sonstige'}{listeId !== SONST ? ` › ${listenListe.find(l => l.id === listeId)?.label ?? ''}` : ''}</span>
          <span style={{ color: C.aktiv, fontWeight: 600 }}>ändern</span>
        </button>
      )}
      {(!handy || ortAuf) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkLeise }}>
        <span>in</span>
        <Wahl {...chip} label="Space" liste={spaceListe} wert={spaceId} farbe={space?.farbe ?? C.aktiv}
          onWahl={id => { setSpaceId(id); setProjektId(sonstigeProjektId(id)); setGruppeId(ALLE); setListeId(SONST); setParentId(null); }} />
        <span aria-hidden>›</span>
        <Wahl {...chip} label="Projekt" liste={projektListe} wert={projektId}
          onWahl={id => { setProjektId(id); setGruppeId(ALLE); setListeId(SONST); setParentId(null); }}
          onNeu={async titel => projektAnlegen(dispatch, spaceId, titel, space?.farbe ?? '#58D9CD')} neuMax={80} />
        {!istSonstigeProjekt(projektId) && <>
          <span aria-hidden>›</span>
          <Wahl {...chip} label="Gruppe" liste={gruppenListe} wert={gruppeId} farbe={gruppen.find(g => g.id === gruppeId)?.farbe ?? C.inkDim}
            onWahl={id => { setGruppeId(id); setListeId(SONST); setParentId(null); }}
            onNeu={async titel => gruppeAnlegen(dispatch, state, projektId, titel)} neuMax={60} />
        </>}
        <span aria-hidden>›</span>
        <Wahl {...chip} label="Liste" liste={listenListe} wert={listeId}
          onWahl={id => { setListeId(id); setParentId(null); }}
          onNeu={async titel => listeAnlegen(dispatch, state, projektId, titel, gruppeId === ALLE ? undefined : gruppeId)} neuMax={80} />
        {elternListe.length > 0 && <>
          <span aria-hidden>›</span>
          <Wahl {...chip} label="Übergeordnete Aufgabe" leer="+ als Unteraufgabe" liste={elternListe} wert={parentId} onWahl={setParentId} onLeeren={() => setParentId(null)} leerenLabel="keine (eigene Aufgabe)" />
        </>}
        {istSonstigeProjekt(projektId) && listeId === SONST && !parentId && <span style={{ color: C.inkLeise }}>· landet unter „Sonstige“</span>}
        {hinweis && <span role="status" style={{ marginLeft: 'auto', color: LEUCHT.gut }}>{hinweis}</span>}
      </div>}
      {!(!handy || ortAuf) && hinweis && <span role="status" style={{ display: 'block', marginTop: 8, fontSize: TYP.bedien, color: LEUCHT.gut }}>{hinweis}</span>}
    </Karte>
  );
}
