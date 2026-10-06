'use client';
// ─── Aufgaben: Schnelleingabe ganz oben (28.09. abends; seit 06.10. nach Malins Bauplan-Karte) ─────
// Legt IMMER eine Aufgabe an — nie eine Liste, ein Projekt oder eine Gruppe (vorher konnte man aus den Wahl-Chips heraus Projekte
// und Listen anlegen; Malin tippte so eine Aufgabe als Liste). Ort = die Liste, in der man gerade ist; sonst die Auswahl „Wohin?“
// mit Suche über Firma › Projekt › Liste. Im Text geht auch `#Projekt/Liste` (z. B. `#Rechnungswesen/offene RE-Onebanking`, Groß/
// Klein egal, Leerzeichen erlaubt); `#projekt` gilt weiter. Ein unbekanntes Ziel legt NICHT an: „Liste nicht gefunden“ + Vorschlag.
// Kürzel wie bisher (lib/make-one/schnell-anlegen.ts): !! kritisch · ! hoch · heute/morgen/mo–so/24.09. · @Name (aus dem Team)/@beide.
// 29.09. (Paket T2): Schalter „🔒 nur ich“; Vorschau dessen, was erkannt wurde, BEVOR gespeichert wird (#21).

import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { Lock } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Knopf, feld, LEUCHT, useHandy } from '../ui';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { parseSchnell, schnellVorschau, schnellZustaendigkeit, zielKuerzel, type SchnellPerson, type SchnellZiel } from '@/lib/make-one/schnell-anlegen';
import { sonstigeProjektId, type AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, projekteImSpace, spacesOderFest, usePersonen, useIch } from './hilfe';
import type { Owner } from '@/types/common';
import { nachIdKarte, darfUnteraufgabe, pfadText } from '@/lib/aufgaben/ebenen';

/** Ort als Schlüssel: Space | Projekt | Liste (leer = „Sonstige“ des Projekts). */
const ortSchluessel = (spaceId: string, projektId: string, listeId?: string) => `${spaceId}|${projektId}|${listeId ?? ''}`;
const ortAus = (k: string) => { const [spaceId, projektId, listeId] = k.split('|'); return { spaceId, projektId, listeId: listeId || undefined }; };

export function SchnellAnlegen({ state, dispatch, spaces, vorbelegt, onAngelegt }: {
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  spaces: readonly AufgabenSpace[];
  /** Was gerade offen ist: Space, Projekt, Liste. */
  vorbelegt: { spaceId: string; projectId?: string; listeId?: string };
  onAngelegt?: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const start = ortSchluessel(vorbelegt.spaceId, vorbelegt.projectId ?? sonstigeProjektId(vorbelegt.spaceId), vorbelegt.listeId);
  const [ort, setOrt] = useState(start);
  const [parentId, setParentId] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [nurIch, setNurIch] = useState(false);
  const handy = useHandy();
  const [ortAuf, setOrtAuf] = useState(false);
  const personen = usePersonen();
  const ich = useIch();
  const eingabe = useRef<HTMLInputElement>(null);
  // Neue Vorbelegung (anderer Space/Projekt/Liste offen) → Ort folgt.
  useEffect(() => { setOrt(start); setParentId(null); }, [start]);

  const alle = spacesOderFest(spaces).filter(s => !s.archiv || s.id === vorbelegt.spaceId);
  const o = ortAus(ort);
  // Alle Listen über Firma › Projekt › Liste — der aktuelle Space zuerst (bei gleichem Namen gewinnt er auch beim `#…`).
  const reihe = [...alle.filter(s => s.id === o.spaceId), ...alle.filter(s => s.id !== o.spaceId)];
  const ziele: SchnellZiel[] = useMemo(() => reihe.flatMap(s => projekteImSpace(state, s.id).flatMap(p => (state.listen ?? [])
    .filter(l => l.projektId === p.id && !l.archiviert && !l.archiviertAm).sort((a, b) => a.sortOrder - b.sortOrder)
    .map(l => ({ spaceId: s.id, projektId: p.id, projektTitel: p.title, listeId: l.id, listeTitel: l.titel })))),
  [state, reihe.map(s => s.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const wohinListe: WahlEintrag<string>[] = useMemo(() => reihe.flatMap(s => [
    ...projekteImSpace(state, s.id).flatMap(p => [
      ...(state.listen ?? []).filter(l => l.projektId === p.id && !l.archiviert && !l.archiviertAm).sort((a, b) => a.sortOrder - b.sortOrder)
        .map(l => ({ id: ortSchluessel(s.id, p.id, l.id), label: `${p.title} › ${l.titel}`, hinweis: s.label, punkt: l.farbe ?? p.color })),
      { id: ortSchluessel(s.id, p.id), label: `${p.title} › Sonstige`, hinweis: s.label, punkt: p.color },
    ]),
    { id: ortSchluessel(s.id, sonstigeProjektId(s.id)), label: 'Sonstige (ohne Projekt)', hinweis: s.label, punkt: s.farbe },
  ]), [state, reihe.map(s => s.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const ortEintrag = wohinListe.find(x => x.id === ort);
  const space = alle.find(s => s.id === o.spaceId);
  const projekte = projekteImSpace(state, o.spaceId);
  // Übergeordnete Aufgabe auf jeder Ebene (01.10.): alle offenen am Ort, unter denen noch eine Ebene Platz hat — mit Pfad.
  const elternListe: WahlEintrag<string>[] = useMemo(() => {
    const nachId = nachIdKarte(state.tasks);
    return state.tasks
      .filter(t => t.spaceId === o.spaceId && t.status !== 'done' && t.status !== 'cancelled' && t.projectId === o.projektId && (o.listeId ? t.listeId === o.listeId : !t.listeId || !(state.listen ?? []).some(l => l.id === t.listeId && l.projektId === o.projektId)) && darfUnteraufgabe(t, nachId))
      .map(t => ({ id: t.id, label: pfadText(t, nachId) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de'));
  }, [state.tasks, state.listen, o.spaceId, o.projektId, o.listeId]);

  // @Name aus dem Team (29.09., F4): Vorname, Kurzname, Speichername — nicht mehr fest @kevin/@malin.
  const schnellPersonen = useMemo<SchnellPerson[]>(() => personen.map(x => ({ speicher: x.speicher, namen: x.namen })), [personen]);
  const erkannt = text.trim() ? parseSchnell(text.trim(), projekte, undefined, schnellPersonen, ziele) : null;
  const vorschau = erkannt ? schnellVorschau(erkannt, projekte, Object.fromEntries(personen.map(x => [x.speicher, x.name]))) : [];
  const vorschlagNehmen = () => {
    const u = erkannt?.zielUnbekannt;
    if (!u?.vorschlag) return;
    setText(t => t.replace(u.text, zielKuerzel(u.vorschlag!)));
    eingabe.current?.focus();
  };
  const anlegen = () => {
    const roh = text.trim();
    if (!roh) { eingabe.current?.focus(); return; }
    const p = parseSchnell(roh, projekte, undefined, schnellPersonen, ziele);
    // Unbekanntes Ziel: NICHT anlegen (sonst landet die Aufgabe still woanders) — der Hinweis steht schon unter dem Feld.
    if (p.zielUnbekannt) { eingabe.current?.focus(); return; }
    if (!p.title) return;
    // Ort: `#Projekt/Liste` › `#projekt` (dessen „Sonstige“) › die Auswahl „Wohin?“.
    const ziel = p.ziel ? { spaceId: p.ziel.spaceId, projectId: p.ziel.projektId, listeId: p.ziel.listeId }
      : p.projectId ? { spaceId: o.spaceId, projectId: p.projectId }
      : { spaceId: o.spaceId, projectId: o.projektId, listeId: o.listeId, parentId: parentId ?? undefined };
    // Eine Verantwortliche (29.09.): ohne @ = ich; erste @Person verantwortlich, weitere beteiligt; „@beide“ = ich + alle anderen.
    const selbst = ich || personen[0]?.speicher || 'both';
    // „Nur ich“ gehört der Anlegerin — zuständig kann nur sie sein, Beteiligte gibt es dann nicht (Server-Regel T1).
    const z = schnellZustaendigkeit(p, selbst, personen.map(x => x.speicher), nurIch);
    const id = aufgabeAnlegen(dispatch, state, ziel, { title: p.title, priority: p.priority, assignee: z.assignee as Owner, dueDate: p.dueDate, ...(z.beteiligte?.length ? { beteiligte: z.beteiligte } : {}), ...(nurIch ? { sichtbarkeit: 'nur-ich' as const } : {}) });
    setText('');
    // „nur ich“ gilt für GENAU diese Aufgabe (29.09., F3) — danach wieder aus, sonst wird die nächste still privat.
    setNurIch(false);
    const wo = p.ziel ? `${p.ziel.projektTitel} › ${p.ziel.listeTitel}` : p.projectId ? `${projekte.find(x => x.id === p.projectId)?.title ?? ''} › Sonstige` : ortEintrag?.label ?? '';
    setHinweis(`Aufgabe angelegt: „${p.title}“ in ${wo}${p.dueDate ? ` · fällig ${vorschau[0] ?? ''}` : ''}${nurIch ? ' · nur ich' : ''}`);
    setTimeout(() => setHinweis(null), 3000);
    onAngelegt?.(id);
  };

  const unbekannt = erkannt?.zielUnbekannt;
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
        <Knopf onClick={anlegen} aus={!!unbekannt}>Aufgabe anlegen</Knopf>
      </div>
      {!text.trim() && <div id="schnell-kuerzel" style={{ marginTop: 6, fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>Legt immer eine Aufgabe an. Kürzel: !! kritisch · heute / mo–so / 24.09. · #Projekt/Liste · @{personen.find(x => x.speicher !== ich)?.name ?? 'Name'}</div>}
      {unbekannt && (
        <div role="alert" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8, fontSize: TYP.bedien, color: LEUCHT.kritisch }}>
          <span>Liste nicht gefunden: „{unbekannt.text.trim()}“ — nichts angelegt.</span>
          {unbekannt.vorschlag && <button type="button" onClick={vorschlagNehmen} className="fassbar" style={{ background: 'none', border: `1px solid ${C.aktiv}66`, borderRadius: 999, padding: '4px 12px', minHeight: 40, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Meintest du {zielKuerzel(unbekannt.vorschlag)}?</button>}
        </div>
      )}
      {erkannt && !unbekannt && (vorschau.length > 0 || erkannt.datumUngueltig) && (
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
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Wohin: <b style={{ color: space?.farbe ?? C.ink, fontWeight: 600 }}>{space?.label ?? 'Space'}</b> › {ortEintrag?.label ?? 'Sonstige'}</span>
          <span style={{ color: C.aktiv, fontWeight: 600 }}>ändern</span>
        </button>
      )}
      {(!handy || ortAuf) && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkLeise }}>
        <span>Wohin?</span>
        <Wahl klein label="Wohin? (Firma › Projekt › Liste)" liste={wohinListe} wert={ort} farbe={space?.farbe ?? C.aktiv} onWahl={k => { setOrt(k); setParentId(null); }} />
        {elternListe.length > 0 && <>
          <span aria-hidden>›</span>
          <Wahl klein label="Übergeordnete Aufgabe" leer="+ als Unteraufgabe" liste={elternListe} wert={parentId} onWahl={setParentId} onLeeren={() => setParentId(null)} leerenLabel="keine (eigene Aufgabe)" />
        </>}
        {hinweis && <span role="status" style={{ marginLeft: 'auto', color: LEUCHT.gut }}>{hinweis}</span>}
      </div>}
      {!(!handy || ortAuf) && hinweis && <span role="status" style={{ display: 'block', marginTop: 8, fontSize: TYP.bedien, color: LEUCHT.gut }}>{hinweis}</span>}
    </Karte>
  );
}
