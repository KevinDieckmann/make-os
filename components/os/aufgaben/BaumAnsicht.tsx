'use client';
// ─── Aufgaben-Baum: Projekt → Gruppe → Liste → Aufgabe → Unteraufgabe (28.09. spät) ─
// Kevin: „Unteraufgaben erstellen, in Gruppen unterteilbar (Marketing, Sales, Operations …).“ Gruppen farbig und
// einklappbar (`eingeklappt` liegt an der Gruppe — gilt für beide), Listen per „Gruppe ▾“ in eine Gruppe verschieben,
// Unteraufgaben inline (Enter = nächste). Blockierte Aufgaben („wartet auf …“) sind markiert.
// Genutzt vom Space (alle Projekte) und von der Projektseite (ein Projekt, ohne Kopf, optional Fokus auf Gruppe/Liste).
// Paket T2 (29.09.): 🔒 „nur ich“, „abgebrochen“ grau/durchgestrichen, Priorität/überfällig auch als Zeichen (#88), Haken mit
// Titel (#62), Erledigen/Löschen über den HandlungProvider (Rückfrage bei offenen Unteraufgaben, „Rückgängig“), Wartende
// über EINE Karte je Render (#84), lange Listen in Stücken zu 200 Zeilen („weitere zeigen“).

import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { MessageSquare, Link2, ChevronRight, Lock, Sparkles, StickyNote } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Haken, Punkt, feld, prioFarbe } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { statusVon, fortschritt, sonstigeProjektId, type BaumProjekt, type BaumAufgabe, type BaumListe } from '@/lib/aufgaben/struktur';
import { useHandlung } from './Handlung';
import { NurIchZeichen, PrioZeichen, FristZeichen, titelStil, AbgebrochenSchild } from './Zeichen';
import type { Task, TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, listeAnlegen, gruppeAnlegen, ownerLabel, GRUPPEN_FARBEN, type Person } from './hilfe';
import { SerienZeichen } from './WiederholungWahl';
import { ListeSerieKnopf } from './SerienListeEinstellen';

const ZU_MERKER = 'make-aufgaben-zu';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
export const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '4px 6px' };
const DIREKT = '__direkt__';
/** Fensterung (#84): so viele Zeilen je Liste auf einmal, dann „weitere zeigen“. */
export const FENSTER_ZEILEN = 200;

/** Umbenennen/Löschen: breit in der Zeile, schmal hinter „⋯“. */
export function Aktionen({ breit, children }: { breit: boolean; children: ReactNode }) {
  const [auf, setAuf] = useState(false);
  if (breit) return <span style={{ display: 'inline-flex', flex: '0 0 auto', alignItems: 'center' }}>{children}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {auf && children}
      <button onClick={() => setAuf(a => !a)} aria-label={auf ? 'Aktionen schließen' : 'Aktionen'} aria-expanded={auf} className="fassbar" style={{ ...leiseKnopf, fontSize: 16, lineHeight: 1 }}>{auf ? '×' : '⋯'}</button>
    </span>
  );
}

/** Eine Eingabezeile „+ …“, die bei Enter anlegt und für die nächste offen bleibt. */
export function NeuZeile({ platzhalter, onNeu, einzug = 0 }: { platzhalter: string; onNeu: (text: string) => void; einzug?: number }) {
  const [text, setText] = useState('');
  return (
    <input value={text} onChange={e => setText(e.target.value)} aria-label={platzhalter}
      onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onNeu(text.trim()); setText(''); } if (e.key === 'Escape') setText(''); }}
      placeholder={platzhalter} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', background: 'transparent', border: '1px dashed rgba(255,255,255,.08)', margin: `6px 0 2px ${einzug}px`, width: `calc(100% - ${einzug}px)` }} />
  );
}

const chevron = (zu: boolean, groesse = 15) => <ChevronRight size={groesse} style={{ transform: zu ? 'none' : 'rotate(90deg)', transition: 'transform .15s ease' }} />;
const klappKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 22, height: 22, flex: '0 0 auto' };

export function BaumAnsicht({ projekte, state, dispatch, raumId, offenId, onOeffnen, onProjekt, breit, personen, heute, fokus, projektKopf = true, iStart = 2 }: {
  projekte: readonly BaumProjekt[];
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  raumId: string;
  offenId: string | null;
  onOeffnen: (id: string | null) => void;
  /** Projekt öffnen (Projektseite) — fehlt auf der Projektseite selbst. */
  onProjekt?: (id: string) => void;
  breit: boolean;
  personen: readonly Person[];
  heute: string;
  /** Nur diese Gruppe / Liste zeigen (Projektseite, Brotkrumen). */
  fokus?: { g?: string; l?: string };
  projektKopf?: boolean;
  iStart?: number;
}) {
  const [zu, setZu] = useState<Set<string>>(new Set());
  const [mehr, setMehr] = useState<Record<string, number>>({});
  const handlung = useHandlung(dispatch, state.statusEigen);
  // Einmal je Render (#84): Kennung → Aufgabe, für „wartet auf …“ jeder Zeile.
  const nachId = useMemo(() => new Map(state.tasks.map(x => [x.id, x])), [state.tasks]);
  const wartetAuf = (t: Task): Task[] => (t.abhaengigVon ?? []).map(id => nachId.get(id)).filter((x): x is Task => !!x && x.status !== 'done');
  const [auf, setAuf] = useState<Set<string>>(new Set());
  useEffect(() => { try { setZu(new Set(JSON.parse(lies(ZU_MERKER) ?? '[]') as string[])); } catch { /* egal */ } }, []);
  // Die offene Aufgabe ist eine Unteraufgabe → ihr Elternteil aufklappen.
  useEffect(() => {
    const t = offenId ? state.tasks.find(x => x.id === offenId) : undefined;
    if (t?.parentId && !auf.has(t.parentId)) setAuf(a => new Set(a).add(t.parentId!));
  }, [offenId]); // eslint-disable-line react-hooks/exhaustive-deps
  const umschalten = (menge: Set<string>, setze: (s: Set<string>) => void, id: string, merker?: string) => {
    const n = new Set(menge); if (n.has(id)) n.delete(id); else n.add(id);
    setze(n); if (merker) merke(merker, JSON.stringify(Array.from(n)));
  };

  const meta = (t: Task, unter: Task[], schmal: boolean) => {
    const s = statusVon(t, state.statusEigen ?? []);
    const f = fortschritt(unter);
    const wartet = t.status !== 'done' && t.status !== 'cancelled' ? wartetAuf(t) : [];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: schmal ? 8 : 10, fontSize: 12, color: C.inkLeise, flex: '0 0 auto', flexWrap: 'wrap' }}>
        <PrioZeichen p={t.priority} />
        {t.sichtbarkeit === 'nur-ich' && <NurIchZeichen />}
        {t.status === 'cancelled' && <AbgebrochenSchild />}
        {wartet.length > 0 && <span title={`Wartet auf: ${wartet.map(w => w.title).join(', ')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: LEUCHT.achtung, fontWeight: 600 }}><Lock size={11} />wartet</span>}
        {s.id !== 'todo' && s.id !== 'done' && s.id !== 'cancelled' && <span style={{ color: s.farbe, border: `1px solid ${s.farbe}55`, borderRadius: 999, padding: '0 7px', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>}
        {t.zoe && t.zoe.status !== 'freigegeben' && t.zoe.status !== 'abgelehnt' && <span title="ZOE bereitet vor" style={{ display: 'inline-flex', color: LEUCHT.agenten }}><Sparkles size={12} /></span>}
        {f.gesamt > 0 && (
          <span title="Unteraufgaben erledigt" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
            <span aria-hidden style={{ width: 28, height: 4, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((f.fertig / f.gesamt) * 100)}%`, background: LEUCHT.gut }} /></span>
            {f.fertig}/{f.gesamt}
          </span>
        )}
        <SerienZeichen w={t.wiederholung} groesse={12} />
        {!!t.notiz && <span title="Mit Notiz" style={{ display: 'inline-flex' }}><StickyNote size={12} /></span>}
        {!!t.kommentare?.length && <span title="Kommentare" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} />{t.kommentare.length}</span>}
        {t.bezug && <span title="Mit dem CRM verknüpft" style={{ display: 'inline-flex' }}><Link2 size={12} /></span>}
        <span title={`Zuständig: ${ownerLabel(t.assignee, personen)}${t.beteiligte?.length ? ` · beteiligt: ${t.beteiligte.map(b => ownerLabel(b, personen)).join(', ')}` : ''}`}>{schmal ? ownerLabel(t.assignee, personen) : ownerLabel(t.assignee, personen).slice(0, 1)}{t.beteiligte?.length ? ` +${t.beteiligte.length}` : ''}</span>
        <FristZeichen t={t} heute={heute} />
      </span>
    );
  };

  const zeile = (a: BaumAufgabe, tiefe = 0): ReactNode => {
    const t = a.task;
    const aufgeklappt = auf.has(t.id);
    const istOffen = offenId === t.id;
    return (
      <div key={t.id}>
        <div className="zeile" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', paddingLeft: 4 + tiefe * 26, borderBottom: '1px solid rgba(255,255,255,.05)', minHeight: 44, background: istOffen ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: istOffen ? 10 : 0 }}>
          {tiefe === 0 && (
            <button onClick={() => umschalten(auf, setAuf, t.id)} aria-label={aufgeklappt ? 'Unteraufgaben zuklappen' : 'Unteraufgaben aufklappen'} aria-expanded={aufgeklappt} className="fassbar"
              style={{ ...klappKnopf, color: a.unter.length ? C.inkDim : 'rgba(255,255,255,.18)' }}>{chevron(!aufgeklappt)}</button>
          )}
          <Haken an={t.status === 'done'} onChange={() => handlung.erledigen(t)} farbe={prioFarbe(t.priority)} label={t.title} />
          <button id={`oeffnen-${t.id}`} onClick={() => onOeffnen(istOffen ? null : t.id)} aria-expanded={istOffen} className="fassbar" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 2px', minHeight: 40, cursor: 'pointer', fontFamily: SCHRIFT.text, display: 'grid', gap: 2 }}>
            <span style={{ fontSize: tiefe ? TYP.bedien : 14.5, fontWeight: tiefe ? 500 : 550, ...titelStil(t), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            {!breit && meta(t, a.unter, true)}
          </button>
          {breit && meta(t, a.unter, false)}
        </div>
        {tiefe === 0 && aufgeklappt && <>
          {a.unter.map(u => zeile({ task: u, unter: [] }, 1))}
          <NeuZeile einzug={30} platzhalter="+ Unteraufgabe (Enter = nächste)" onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, parentId: t.id }, { title, assignee: t.assignee, bezug: t.bezug })} />
        </>}
      </div>
    );
  };

  const listeBlock = (p: BaumProjekt, l: BaumListe, zeigeKopf: boolean, gruppenWahl: WahlEintrag<string>[]) => {
    const lk = `l:${p.id}:${l.id}`;
    const lz = zu.has(lk);
    return (
      <div key={lk} style={{ marginTop: zeigeKopf ? 10 : 0 }}>
        {zeigeKopf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.07)', flexWrap: 'wrap' }}>
            <button onClick={() => umschalten(zu, setZu, lk, ZU_MERKER)} aria-label={lz ? 'Liste aufklappen' : 'Liste zuklappen'} aria-expanded={!lz} className="fassbar" style={{ ...klappKnopf, color: C.inkLeise, width: 20, height: 20 }}>{chevron(lz, 14)}</button>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: l.virtuell ? C.inkLeise : C.inkDim }}>{l.titel}</span>
            <span style={{ fontSize: 12, color: C.inkLeise }}>{l.offen || ''}</span>
            {!l.virtuell && <ListeSerieKnopf listeId={l.id} />}
            {!l.virtuell && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}><Aktionen breit={breit}>
              {gruppenWahl.length > 1 && <Wahl klein label="Gruppe" liste={gruppenWahl} wert={l.gruppeId ?? DIREKT} onWahl={g => dispatch({ type: 'UPDATE_LISTE', payload: { id: l.id, gruppeId: g === DIREKT ? undefined : g } })} />}
              <button onClick={() => { const v = window.prompt('Liste umbenennen', l.titel)?.trim(); if (v && v !== l.titel) dispatch({ type: 'UPDATE_LISTE', payload: { id: l.id, titel: v.slice(0, 80) } }); }} style={leiseKnopf}>Umbenennen</button>
              <button onClick={() => { if (window.confirm(`Liste „${l.titel}“ löschen? Die Aufgaben bleiben — unter „Sonstige“.`)) dispatch({ type: 'DELETE_LISTE', payload: { id: l.id } }); }} style={leiseKnopf}>Löschen</button>
            </Aktionen></span>}
          </div>
        )}
        {!lz && <>
          {l.aufgaben.slice(0, mehr[lk] ?? FENSTER_ZEILEN).map(a => zeile(a))}
          {l.aufgaben.length > (mehr[lk] ?? FENSTER_ZEILEN) && (
            <button onClick={() => setMehr(m => ({ ...m, [lk]: (m[lk] ?? FENSTER_ZEILEN) + FENSTER_ZEILEN }))} style={{ ...leiseKnopf, color: C.aktiv, padding: '10px 4px', minHeight: 44 }}>
              weitere {Math.min(FENSTER_ZEILEN, l.aufgaben.length - (mehr[lk] ?? FENSTER_ZEILEN))} von {l.aufgaben.length - (mehr[lk] ?? FENSTER_ZEILEN)} zeigen
            </button>
          )}
          {!l.aufgaben.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '8px 4px' }}>Noch keine Aufgabe.</div>}
          <NeuZeile platzhalter={`+ Aufgabe in ${l.virtuell ? p.titel : l.titel} (Enter)`} onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, projectId: p.virtuell ? sonstigeProjektId(raumId) : p.id, listeId: l.virtuell ? undefined : l.id }, { title })} />
        </>}
      </div>
    );
  };

  const projektKarte = (p: BaumProjekt, i: number) => {
    const pz = projektKopf && zu.has(p.id);
    const pid = p.virtuell ? sonstigeProjektId(raumId) : p.id;
    const gruppenWahl: WahlEintrag<string>[] = [{ id: DIREKT, label: 'Direkt im Projekt' }, ...p.gruppen.map(g => ({ id: g.id, label: g.titel, punkt: g.farbe }))];
    const nurGruppe = fokus?.g && p.gruppen.some(g => g.id === fokus.g) ? fokus.g : undefined;
    const nurListe = fokus?.l && p.listen.some(l => l.id === fokus.l) ? fokus.l : undefined;
    const listenSichtbar = p.listen.filter(l => (!nurListe || l.id === nurListe) && (!nurGruppe || l.gruppeId === nurGruppe));
    const direkt = listenSichtbar.filter(l => !l.gruppeId);
    const gruppen = p.gruppen.filter(g => (!nurGruppe || g.id === nurGruppe) && (!nurListe || listenSichtbar.some(l => l.gruppeId === g.id)));
    const zeigeKopf = (l: BaumListe) => p.listen.length > 1 || !l.virtuell || p.gruppen.length > 0;
    return (
      <Karte key={p.id} i={i + iStart}>
        {projektKopf && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pz ? 0 : 6 }}>
            <button onClick={() => umschalten(zu, setZu, p.id, ZU_MERKER)} aria-label={pz ? 'Projekt aufklappen' : 'Projekt zuklappen'} aria-expanded={!pz} className="fassbar" style={klappKnopf}>{chevron(pz, 16)}</button>
            <Punkt farbe={p.farbe} />
            <button onClick={() => onProjekt?.(pid)} className="fassbar" title="Projekt öffnen"
              style={{ background: 'none', border: 'none', padding: 0, cursor: onProjekt ? 'pointer' : 'default', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: C.ink, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</button>
            {p.fremd && <span style={{ fontSize: 12, color: C.inkLeise }}>aus einem anderen Space</span>}
            <span style={{ fontSize: 12.5, color: C.inkLeise, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.offen} offen</span>
            {!p.virtuell && !p.fremd && onProjekt && <button onClick={() => onProjekt(pid)} style={{ ...leiseKnopf, color: C.aktiv }}>öffnen ›</button>}
          </div>
        )}
        {!pz && <>
          {gruppen.map(g => {
            const gl = listenSichtbar.filter(l => l.gruppeId === g.id);
            return (
              <div key={g.id} style={{ marginTop: 12, borderLeft: `3px solid ${g.farbe}`, paddingLeft: 10, borderRadius: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', flexWrap: 'wrap' }}>
                  <button onClick={() => dispatch({ type: 'UPDATE_GRUPPE', payload: { id: g.id, eingeklappt: g.eingeklappt ? undefined : true } })} aria-label={g.eingeklappt ? 'Gruppe aufklappen' : 'Gruppe zuklappen'} aria-expanded={!g.eingeklappt} className="fassbar" style={{ ...klappKnopf, color: g.farbe }}>{chevron(g.eingeklappt)}</button>
                  <span style={{ fontFamily: SCHRIFT.display, fontSize: 15, fontWeight: 700, color: g.farbe }}>{g.titel}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{g.offen ? `${g.offen} offen` : ''}</span>
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}><Aktionen breit={breit}>
                    <button onClick={() => { const n = GRUPPEN_FARBEN[(GRUPPEN_FARBEN.indexOf(g.farbe as typeof GRUPPEN_FARBEN[number]) + 1) % GRUPPEN_FARBEN.length]; dispatch({ type: 'UPDATE_GRUPPE', payload: { id: g.id, farbe: n } }); }} style={leiseKnopf} aria-label="Farbe wechseln"><Punkt farbe={g.farbe} groesse={8} /> Farbe</button>
                    <button onClick={() => { const v = window.prompt('Gruppe umbenennen', g.titel)?.trim(); if (v && v !== g.titel) dispatch({ type: 'UPDATE_GRUPPE', payload: { id: g.id, titel: v.slice(0, 60) } }); }} style={leiseKnopf}>Umbenennen</button>
                    <button onClick={() => { if (window.confirm(`Gruppe „${g.titel}“ löschen? Die Listen bleiben — direkt im Projekt.`)) dispatch({ type: 'DELETE_GRUPPE', payload: { id: g.id } }); }} style={leiseKnopf}>Löschen</button>
                  </Aktionen></span>
                </div>
                {!g.eingeklappt && <>
                  {gl.map(l => listeBlock(p, l, true, gruppenWahl))}
                  {!gl.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '6px 4px' }}>Noch keine Liste in {g.titel}.</div>}
                  {!p.fremd && !nurListe && <NeuZeile platzhalter={`+ Liste in ${g.titel} (Enter)`} onNeu={titel => { listeAnlegen(dispatch, state, pid, titel.slice(0, 80), g.id); }} />}
                </>}
              </div>
            );
          })}
          {direkt.map(l => listeBlock(p, l, zeigeKopf(l), gruppenWahl))}
          {!p.fremd && !nurGruppe && !nurListe && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ flex: '2 1 220px' }}><NeuZeile platzhalter="+ Liste, z. B. Januar (Enter)" onNeu={titel => { listeAnlegen(dispatch, state, pid, titel.slice(0, 80)); }} /></span>
              {!p.virtuell && <span style={{ flex: '1 1 180px' }}><NeuZeile platzhalter="+ Gruppe, z. B. Marketing (Enter)" onNeu={titel => { gruppeAnlegen(dispatch, state, pid, titel); }} /></span>}
            </div>
          )}
        </>}
      </Karte>
    );
  };

  return <>{projekte.map((p, i) => projektKarte(p, i))}</>;
}
