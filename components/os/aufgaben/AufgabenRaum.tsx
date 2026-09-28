'use client';
// ─── MAKE OS — Aufgaben wie Monday/ClickUp (28.09. abends, Kevin + Malin) ───
// Ganz oben: Schnell anlegen. Darunter der Bereich — Privat | Business, im Business die Firmen (Selbstständigkeit ·
// KD Ventures · MAKE OS UG) und die Mandanten (jede CRM-Firma mit aktivem Mandat, beendet → Archiv). Im Space:
// Projekte → Listen → Aufgaben (aufklappbar) → Unteraufgaben. Ohne Liste/Projekt: „Sonstige“.
// Ansichten: Liste (Baum, Standard) und Board nach Status; Filter meine/alle, Status, fällig.
// Adresse: ?space=privat|business · r=<Space> · p=<Projekt> · ansicht=board · offen=<Aufgabe> (WEG.aufgabe).
// Regeln rein in lib/aufgaben/struktur.ts; Schreiben über den Aufgaben-Kontext (Einzeländerungen mit Stand).

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, Link2, ChevronRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Seite, Karte, Spalten, Spalte, Segmente, Leer, Haken, Punkt, feld, prioFarbe, useBreit } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { useLinkAuswahl } from '../Verlauf';
import { useTasks, AUFGABEN_KONFLIKT } from '@/context/TasksContext';
import { useSpace } from '@/hooks/useSpace';
import { localDay } from '@/lib/zeit';
import {
  baum, passtFilter, statusListe, statusVon, bereichVonSpace, istSpaceId, fortschritt, FILTER_STANDARD, sonstigeProjektId,
  type AufgabenFilter, type FaelligFilter, type BaumProjekt, type BaumAufgabe,
} from '@/lib/aufgaben/struktur';
import type { Task } from '@/types/tasks';
import { SchnellAnlegen } from './SchnellAnlegen';
import { AufgabeDetail } from './AufgabeDetail';
import { StatusVerwalten } from './StatusVerwalten';
import { StatusBoard } from './StatusBoard';
import { ZoeAufgabenSicht } from './ZoeAufgabe';
import { SerienZeichen } from './WiederholungWahl';
import { ListeSerieKnopf } from './SerienListeEinstellen';
import { VorlagenKnopf } from './VorlagenDialog';
import { aufgabeAnlegen, projektAnlegen, listeAnlegen, spacesOderFest, usePersonen, useIch, ownerLabel } from './hilfe';

const RAUM_MERKER = 'make-aufgaben-raum';
const FILTER_MERKER = 'make-aufgaben-filter';
const ZU_MERKER = 'make-aufgaben-zu';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

const pille = (an: boolean, farbe: string = C.aktiv): CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 600, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
  border: `1px solid ${an ? `${farbe}99` : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : C.inkDim,
});
const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '4px 6px' };
const FAELLIG: { id: FaelligFilter; label: string }[] = [{ id: 'alle', label: 'Jederzeit' }, { id: 'ueberfaellig', label: 'Überfällig' }, { id: 'heute', label: 'Bis heute' }, { id: 'woche', label: '7 Tage' }, { id: 'ohne', label: 'Ohne Datum' }];
const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '');

/** Umbenennen/Löschen: breit in der Zeile, schmal hinter „⋯“ (sonst bliebe für den Namen kein Platz). */
function Aktionen({ breit, children }: { breit: boolean; children: ReactNode }) {
  const [auf, setAuf] = useState(false);
  if (breit) return <span style={{ display: 'inline-flex', flex: '0 0 auto' }}>{children}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}>
      {auf && children}
      <button onClick={() => setAuf(a => !a)} aria-label={auf ? 'Aktionen schließen' : 'Umbenennen oder löschen'} aria-expanded={auf} className="fassbar" style={{ ...leiseKnopf, fontSize: 16, lineHeight: 1 }}>{auf ? '×' : '⋯'}</button>
    </span>
  );
}

/** Eine Eingabezeile „+ …“, die bei Enter anlegt. */
function NeuZeile({ platzhalter, onNeu, einzug = 0 }: { platzhalter: string; onNeu: (text: string) => void; einzug?: number }) {
  const [text, setText] = useState('');
  return (
    <input value={text} onChange={e => setText(e.target.value)} aria-label={platzhalter}
      onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onNeu(text.trim()); setText(''); } if (e.key === 'Escape') setText(''); }}
      placeholder={platzhalter} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', background: 'transparent', border: '1px dashed rgba(255,255,255,.08)', margin: `6px 0 2px ${einzug}px`, width: `calc(100% - ${einzug}px)` }} />
  );
}

export function AufgabenRaum() {
  const { state, dispatch, spaces: rohSpaces, ready } = useTasks();
  const spaces = spacesOderFest(rohSpaces);
  const params = useSearchParams();
  const router = useRouter();
  const pfad = usePathname() ?? '/os/aufgaben';
  const [offenId, setOffenId] = useLinkAuswahl('offen');
  const { space: bereichGemerkt, setzen: bereichSetzen } = useSpace();
  const breit = useBreit();
  const personen = usePersonen();
  const ich = useIch();
  const heute = localDay();

  const [filter, setFilterRoh] = useState<AufgabenFilter>(FILTER_STANDARD);
  const [raumGemerkt, setRaumGemerkt] = useState<string | null>(null);
  const [zu, setZu] = useState<Set<string>>(new Set());
  const [auf, setAuf] = useState<Set<string>>(new Set());
  const [archiv, setArchiv] = useState(false);
  const [statusZeigen, setStatusZeigen] = useState(false);
  const [neuProjekt, setNeuProjekt] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  useEffect(() => {
    try { const f = JSON.parse(lies(FILTER_MERKER) ?? 'null') as Partial<AufgabenFilter> | null; if (f) setFilterRoh({ ...FILTER_STANDARD, ...f }); } catch { /* egal */ }
    setRaumGemerkt(lies(RAUM_MERKER));
    try { setZu(new Set(JSON.parse(lies(ZU_MERKER) ?? '[]') as string[])); } catch { /* egal */ }
  }, []);
  useEffect(() => {
    const k = () => { setHinweis('Nicht gespeichert — jemand hat die Aufgabe inzwischen geändert. Die Anzeige zeigt jetzt den aktuellen Stand, bitte noch einmal.'); setTimeout(() => setHinweis(null), 8000); };
    window.addEventListener(AUFGABEN_KONFLIKT, k);
    return () => window.removeEventListener(AUFGABEN_KONFLIKT, k);
  }, []);
  // Am Handy steht das Detail über dem Baum — beim Öffnen dorthin springen.
  useEffect(() => {
    if (!offenId || breit) return;
    const t = setTimeout(() => document.getElementById(`aufgabe-${offenId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [offenId, breit]);
  const setFilter = (f: Partial<AufgabenFilter>) => setFilterRoh(alt => { const n = { ...alt, ...f }; merke(FILTER_MERKER, JSON.stringify({ wer: n.wer, status: n.status, faellig: n.faellig })); return n; });
  const umschalten = (menge: Set<string>, setze: (s: Set<string>) => void, id: string, merker?: string) => {
    const n = new Set(menge); if (n.has(id)) n.delete(id); else n.add(id);
    setze(n); if (merker) merke(merker, JSON.stringify(Array.from(n)));
  };

  // ── Wo sind wir? Bereich → Space → (Projekt) ──
  const offen = offenId ? state.tasks.find(t => t.id === offenId) : undefined;
  const qBereich = params.get('space');
  const qRaum = params.get('r');
  const qProjekt = params.get('p');
  const ansicht = params.get('ansicht') === 'board' ? 'board' : params.get('ansicht') === 'zoe' ? 'zoe' : 'liste';
  const bereich: 'privat' | 'business' = qBereich === 'privat' || qBereich === 'business' ? qBereich
    : istSpaceId(qRaum) ? bereichVonSpace(qRaum)
      : offen?.spaceId ? bereichVonSpace(offen.spaceId) : bereichGemerkt;
  const raumId = bereich === 'privat' ? 'privat'
    : istSpaceId(qRaum) && qRaum !== 'privat' ? qRaum
      : offen?.spaceId && offen.spaceId !== 'privat' ? offen.spaceId
        : raumGemerkt && raumGemerkt !== 'privat' && spaces.some(s => s.id === raumGemerkt) ? raumGemerkt : 'kdc';
  const raum = spaces.find(s => s.id === raumId) ?? { id: raumId, label: 'Mandant', bereich: 'business' as const, art: 'mandant' as const, farbe: C.inkDim, archiv: true };
  const projektFokus = qProjekt && (state.projects.some(p => p.id === qProjekt) || qProjekt === sonstigeProjektId(raumId)) ? qProjekt : null;

  const gehe = useCallback((neu: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(neu)) { if (v) q.set(k, v); else q.delete(k); }
    router.replace(`${pfad}${q.toString() ? `?${q}` : ''}`, { scroll: false });
  }, [params, router, pfad]);
  const raumWaehlen = (id: string) => {
    const b = bereichVonSpace(id);
    if (b !== bereichGemerkt) bereichSetzen(b);
    if (id !== 'privat') { merke(RAUM_MERKER, id); setRaumGemerkt(id); }
    gehe({ space: b, r: id === 'privat' ? null : id, p: null, offen: null });
  };

  // ── Zahlen je Space (offene Aufgaben, ohne Unteraufgaben) ──
  const offenJe = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of state.tasks) if (!t.parentId && t.status !== 'done' && t.spaceId) m.set(t.spaceId, (m.get(t.spaceId) ?? 0) + 1);
    return m;
  }, [state.tasks]);

  const zeigen = (t: Task) => passtFilter(t, { ...filter, ich }, heute);
  const standard = filter.wer === 'alle' && filter.faellig === 'alle' && (filter.status === 'offen' || filter.status === 'alle');
  const projekteBaum = useMemo(() => baum(state, raumId, zeigen, standard), [state, raumId, filter, ich, heute]); // eslint-disable-line react-hooks/exhaustive-deps
  const sichtbar = projektFokus ? projekteBaum.filter(p => p.id === projektFokus) : projekteBaum;
  const imRaum = state.tasks.filter(t => t.spaceId === raumId && zeigen(t) && (!projektFokus || t.projectId === projektFokus || (projektFokus === sonstigeProjektId(raumId) && !state.projects.some(p => p.id === t.projectId && p.spaceId === raumId))));
  const statusWahl: WahlEintrag<string>[] = [{ id: 'offen', label: 'Nicht erledigt' }, { id: 'alle', label: 'Alle' }, ...statusListe(raumId, state.statusEigen ?? []).map(s => ({ id: s.id, label: s.label, punkt: s.farbe }))];

  // ── Angaben einer Zeile: Status (wenn nicht Offen/Erledigt), Unteraufgaben, Kommentare, CRM, Zuständig, Deadline ──
  const meta = (t: Task, s: ReturnType<typeof statusVon>, f: { fertig: number; gesamt: number }, schmal: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: schmal ? 8 : 10, fontSize: 12, color: C.inkLeise, flex: '0 0 auto', flexWrap: 'wrap' }}>
      {s.id !== 'todo' && s.id !== 'done' && <span style={{ color: s.farbe, border: `1px solid ${s.farbe}55`, borderRadius: 999, padding: '0 7px', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>}
      <SerienZeichen w={t.wiederholung} groesse={12} />
      {f.gesamt > 0 && <span title="Unteraufgaben erledigt" style={{ fontVariantNumeric: 'tabular-nums' }}>{f.fertig}/{f.gesamt}</span>}
      {!!t.kommentare?.length && <span title="Kommentare" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageSquare size={12} />{t.kommentare.length}</span>}
      {t.bezug && <span title="Mit dem CRM verknüpft" style={{ display: 'inline-flex' }}><Link2 size={12} /></span>}
      <span title={`Zuständig: ${ownerLabel(t.assignee, personen)}`}>{t.assignee === 'both' ? 'Beide' : schmal ? ownerLabel(t.assignee, personen) : ownerLabel(t.assignee, personen).slice(0, 1)}</span>
      {t.dueDate && <span style={{ fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', color: t.dueDate < heute && t.status !== 'done' ? LEUCHT.kritisch : t.dueDate === heute ? LEUCHT.achtung : C.inkLeise }}>{datum(t.dueDate)}</span>}
    </span>
  );

  // ── Eine Aufgabe als Zeile (mit Unteraufgaben, aufklappbar) ──
  const zeile = (a: BaumAufgabe, tiefe = 0): ReactNode => {
    const t = a.task;
    const s = statusVon(t, state.statusEigen ?? []);
    const f = fortschritt(a.unter);
    const aufgeklappt = auf.has(t.id);
    const istOffen = offenId === t.id;
    return (
      <div key={t.id}>
        <div className="zeile" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', paddingLeft: 4 + tiefe * 26, borderBottom: '1px solid rgba(255,255,255,.05)', minHeight: 44, background: istOffen ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: istOffen ? 10 : 0 }}>
          {tiefe === 0 ? (
            <button onClick={() => umschalten(auf, setAuf, t.id)} aria-label={aufgeklappt ? 'Unteraufgaben zuklappen' : 'Unteraufgaben aufklappen'} aria-expanded={aufgeklappt} className="fassbar"
              style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: a.unter.length ? C.inkDim : 'rgba(255,255,255,.18)', padding: 0, flex: '0 0 auto' }}>
              <ChevronRight size={15} style={{ transform: aufgeklappt ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }} />
            </button>
          ) : null}
          <Haken an={t.status === 'done'} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />
          {/* Breit: Titel links, Angaben rechts. Schmal (Handy): Angaben in einer zweiten Zeile unter dem Titel. */}
          <button onClick={() => setOffenId(istOffen ? null : t.id)} className="fassbar" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', fontFamily: SCHRIFT.text, display: 'grid', gap: 2 }}>
            <span style={{ fontSize: tiefe ? TYP.bedien : 14.5, fontWeight: tiefe ? 500 : 550, color: t.status === 'done' ? C.inkLeise : C.ink, textDecoration: t.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            {!breit && meta(t, s, f, true)}
          </button>
          {breit && meta(t, s, f, false)}
        </div>
        {tiefe === 0 && aufgeklappt && <>
          {a.unter.map(u => zeile({ task: u, unter: [] }, 1))}
          <NeuZeile einzug={30} platzhalter="+ Unteraufgabe (Enter)" onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, parentId: t.id }, { title, assignee: t.assignee, bezug: t.bezug })} />
        </>}
      </div>
    );
  };

  const detail = (t: Task) => (
    <AufgabeDetail task={t} state={state} dispatch={dispatch} spaces={spaces} personen={personen} ich={ich} onSchliessen={() => setOffenId(null)} onOeffnen={id => setOffenId(id)} />
  );

  const projektKarte = (p: BaumProjekt, i: number) => {
    const pz = zu.has(p.id);
    return (
      <Karte key={p.id} i={i + 2}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pz ? 0 : 6 }}>
          <button onClick={() => umschalten(zu, setZu, p.id, ZU_MERKER)} aria-label={pz ? 'Projekt aufklappen' : 'Projekt zuklappen'} aria-expanded={!pz} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 22, height: 22 }}>
            <ChevronRight size={16} style={{ transform: pz ? 'none' : 'rotate(90deg)', transition: 'transform .15s ease' }} />
          </button>
          <Punkt farbe={p.farbe} />
          <button onClick={() => gehe({ p: projektFokus === p.id ? null : p.id })} className="fassbar" title={projektFokus === p.id ? 'Alle Projekte zeigen' : 'Nur dieses Projekt'}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: C.ink, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</button>
          {p.fremd && <span style={{ fontSize: 12, color: C.inkLeise }}>aus einem anderen Space</span>}
          <span style={{ fontSize: 12.5, color: C.inkLeise, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.offen} offen</span>
          {!p.virtuell && !p.fremd && <Aktionen breit={breit}>
            <button onClick={() => { const v = window.prompt('Projekt umbenennen', p.titel)?.trim(); if (v && v !== p.titel) dispatch({ type: 'UPDATE_PROJECT', payload: { id: p.id, title: v.slice(0, 120) } }); }} style={leiseKnopf}>Umbenennen</button>
            <button onClick={() => { if (window.confirm(`Projekt „${p.titel}“ löschen? Die Aufgaben bleiben — sie stehen danach unter „Sonstige“.`)) dispatch({ type: 'DELETE_PROJECT', payload: { id: p.id } }); }} style={leiseKnopf}>Löschen</button>
          </Aktionen>}
        </div>
        {!pz && p.listen.map(l => {
          const lk = `l:${p.id}:${l.id}`;
          const lz = zu.has(lk);
          const zeigeKopf = p.listen.length > 1 || !l.virtuell;
          return (
            <div key={lk} style={{ marginTop: zeigeKopf ? 10 : 0 }}>
              {zeigeKopf && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                  <button onClick={() => umschalten(zu, setZu, lk, ZU_MERKER)} aria-label={lz ? 'Liste aufklappen' : 'Liste zuklappen'} aria-expanded={!lz} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 20, height: 20 }}>
                    <ChevronRight size={14} style={{ transform: lz ? 'none' : 'rotate(90deg)', transition: 'transform .15s ease' }} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: l.virtuell ? C.inkLeise : C.inkDim }}>{l.titel}</span>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{l.offen || ''}</span>
                  {!l.virtuell && <ListeSerieKnopf listeId={l.id} />}
                  {!l.virtuell && <span style={{ marginLeft: 'auto', display: 'inline-flex' }}><Aktionen breit={breit}>
                    <button onClick={() => { const v = window.prompt('Liste umbenennen', l.titel)?.trim(); if (v && v !== l.titel) dispatch({ type: 'UPDATE_LISTE', payload: { id: l.id, titel: v.slice(0, 80) } }); }} style={leiseKnopf}>Umbenennen</button>
                    <button onClick={() => { if (window.confirm(`Liste „${l.titel}“ löschen? Die Aufgaben bleiben — unter „Sonstige“.`)) dispatch({ type: 'DELETE_LISTE', payload: { id: l.id } }); }} style={leiseKnopf}>Löschen</button>
                  </Aktionen></span>}
                </div>
              )}
              {!lz && <>
                {l.aufgaben.map(a => zeile(a))}
                {!l.aufgaben.length && <div style={{ fontSize: 12.5, color: C.inkLeise, padding: '8px 4px' }}>Noch keine Aufgabe.</div>}
                <NeuZeile platzhalter={`+ Aufgabe in ${l.virtuell ? p.titel : l.titel} (Enter)`} onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, projectId: p.virtuell ? sonstigeProjektId(raumId) : p.id, listeId: l.virtuell ? undefined : l.id }, { title })} />
              </>}
            </div>
          );
        })}
        {!pz && !p.fremd && <NeuZeile platzhalter="+ Liste, z. B. Januar (Enter)" onNeu={titel => { listeAnlegen(dispatch, state, p.virtuell ? sonstigeProjektId(raumId) : p.id, titel.slice(0, 80)); }} />}
      </Karte>
    );
  };

  // ── Kopf: Bereich, Firmen, Mandanten ──
  const firmen = spaces.filter(s => s.art === 'firma');
  const mandanten = spaces.filter(s => s.art === 'mandant' && !s.archiv);
  const archivSpaces = spaces.filter(s => s.art === 'mandant' && s.archiv);
  const raumPille = (s: { id: string; label: string; farbe: string }) => (
    <button key={s.id} onClick={() => raumWaehlen(s.id)} className="fassbar" style={pille(raumId === s.id, s.farbe)}>
      {s.label}{offenJe.get(s.id) ? <span style={{ marginLeft: 6, opacity: .75, fontVariantNumeric: 'tabular-nums' }}>{offenJe.get(s.id)}</span> : null}
    </button>
  );
  const kopf = (
    <div className="os-auf" style={{ display: 'grid', gap: 10, margin: '4px 0 16px' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['privat', 'business'] as const).map(b => (
          <button key={b} onClick={() => raumWaehlen(b === 'privat' ? 'privat' : (raumGemerkt && raumGemerkt !== 'privat' && spaces.some(s => s.id === raumGemerkt) ? raumGemerkt : 'kdc'))} className="fassbar"
            style={{ ...pille(bereich === b, b === 'privat' ? '#D9A45B' : '#6E7EF5'), fontSize: TYP.bedien, padding: '8px 16px' }}>{b === 'privat' ? 'Privat' : 'Business'}</button>
        ))}
      </div>
      {bereich === 'business' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, marginRight: 2 }}>Firmen</span>
          {firmen.map(raumPille)}
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, margin: '0 2px 0 10px' }}>Mandanten</span>
          {mandanten.map(raumPille)}
          {!mandanten.length && <span style={{ fontSize: 12.5, color: C.inkLeise }}>kein aktives Mandat</span>}
          {archivSpaces.length > 0 && <button onClick={() => setArchiv(a => !a)} style={{ ...leiseKnopf, marginLeft: 4 }}>{archiv ? 'Archiv ausblenden' : `Archiv (${archivSpaces.length})`}</button>}
          {archiv && archivSpaces.map(raumPille)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Segmente liste={[{ id: 'alle', label: 'Alle' }, { id: 'meine', label: 'Meine' }]} aktiv={filter.wer} onWahl={w => setFilter({ wer: w })} />
        <Wahl klein label="Status" liste={statusWahl} wert={filter.status} onWahl={s => setFilter({ status: s })} />
        <Wahl klein label="Fällig" liste={FAELLIG} wert={filter.faellig} onWahl={f => setFilter({ faellig: f })} />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {projektFokus && <button onClick={() => gehe({ p: null })} style={leiseKnopf}>‹ alle Projekte</button>}
          <button onClick={() => setNeuProjekt(n => (n === null ? '' : null))} style={{ ...leiseKnopf, color: C.aktiv }}>+ Projekt</button>
          <VorlagenKnopf spaceId={raumId} projektId={projektFokus ?? undefined} />
          <button onClick={() => setStatusZeigen(z => !z)} style={leiseKnopf}>{statusZeigen ? 'Status schließen' : 'Status verwalten'}</button>
        </span>
      </div>
      {neuProjekt !== null && (
        <input autoFocus value={neuProjekt} onChange={e => setNeuProjekt(e.target.value)} aria-label="Neues Projekt"
          onKeyDown={e => { if (e.key === 'Escape') setNeuProjekt(null); if (e.key === 'Enter' && neuProjekt.trim()) { projektAnlegen(dispatch, raumId, neuProjekt.trim().slice(0, 120), raum.farbe); setNeuProjekt(null); } }}
          placeholder={`Neues Projekt in ${raum.label}, z. B. Buchhaltung (Enter)`} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />
      )}
    </div>
  );

  const leer = !sichtbar.length || sichtbar.every(p => p.listen.every(l => !l.aufgaben.length) && p.virtuell);
  const baumKarten = (
    <>
      {sichtbar.map((p, i) => projektKarte(p, i))}
      {leer && ready && (
        <Karte i={2}><Leer>{filter.wer !== 'alle' || filter.faellig !== 'alle' || (filter.status !== 'offen' && filter.status !== 'alle') ? 'Nichts passt zum Filter.' : `Noch nichts in ${raum.label}. Oben eine Zeile tippen — oder „+ Projekt“ (z. B. Buchhaltung) mit Listen wie Januar, Februar.`}</Leer></Karte>
      )}
    </>
  );

  return (
    <Seite titel={bereich === 'privat' ? 'Aufgaben · Privat' : `Aufgaben · ${raum.label}`} rechts={
      <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmente liste={[{ id: 'liste', label: 'Liste' }, { id: 'board', label: 'Board' }, { id: 'zoe', label: 'ZOE' }]} aktiv={ansicht} onWahl={a => gehe({ ansicht: a === 'board' || a === 'zoe' ? a : null })} />
        <Link href={bereich === 'privat' ? '/os/aufgaben/board?space=privat' : '/os/aufgaben/board?space=business'} style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Zeitstrahl ›</Link>
      </span>
    }>
      <SchnellAnlegen state={state} dispatch={dispatch} spaces={spaces} vorbelegt={{ spaceId: raumId, ...(projektFokus ? { projectId: projektFokus } : {}) }} />
      {kopf}
      {hinweis && <div role="alert" onClick={() => setHinweis(null)} style={{ background: `${LEUCHT.achtung}1F`, border: `1px solid ${LEUCHT.achtung}66`, color: LEUCHT.achtung, borderRadius: 12, padding: '10px 14px', fontSize: TYP.bedien, marginBottom: 12, cursor: 'pointer' }}>{hinweis}</div>}
      {!ready && <Karte i={1}><Leer>lade …</Leer></Karte>}
      {ready && ansicht === 'board' && (
        <>
          {offen && <div style={{ marginBottom: 14 }}>{detail(offen)}</div>}
          <StatusBoard state={state} dispatch={dispatch} spaceId={raumId} aufgaben={imRaum} personen={personen} heute={heute} offenId={offenId} onOeffnen={id => setOffenId(offenId === id ? null : id)} />
          {statusZeigen && <div style={{ marginTop: 14 }}><StatusVerwalten state={state} dispatch={dispatch} spaceId={raumId} spaceLabel={raum.label} /></div>}
        </>
      )}
      {ready && ansicht === 'zoe' && (
        <>
          {offen && <div style={{ marginBottom: 14 }}>{detail(offen)}</div>}
          <ZoeAufgabenSicht state={state} personen={personen} ich={ich} offenId={offenId} onOeffnen={id => setOffenId(offenId === id ? null : id)} />
        </>
      )}
      {ready && ansicht === 'liste' && (breit ? (
        <Spalten verhaeltnis="3:2">
          <Spalte>{baumKarten}</Spalte>
          <Spalte klebt>
            {offen ? detail(offen) : <Karte i={1}><Leer>Eine Aufgabe antippen — hier stehen Status, Deadline, Zuständig, CRM-Verknüpfung, Unteraufgaben und Kommentare.</Leer></Karte>}
            {statusZeigen && <StatusVerwalten state={state} dispatch={dispatch} spaceId={raumId} spaceLabel={raum.label} i={3} />}
          </Spalte>
        </Spalten>
      ) : (
        <>
          {offen && <div style={{ marginBottom: 12 }}>{detail(offen)}</div>}
          {statusZeigen && <StatusVerwalten state={state} dispatch={dispatch} spaceId={raumId} spaceLabel={raum.label} />}
          {baumKarten}
        </>
      ))}
    </Seite>
  );
}
