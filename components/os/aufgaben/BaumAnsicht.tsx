'use client';
// ─── Aufgaben-Baum: Projekt › Liste › Aufgabe › Unteraufgabe (06.10., Malins Bauplan-Karte) ─
// Vorher (28.09. spät) gab es zwischen Projekt und Liste noch „Gruppen“ und vier gleich aussehende Eingabefelder — Malin tippte
// eine Aufgabe ins Listenfeld. Seit 06.10. (Umbau v3, lib/aufgaben/umbau-gruppen.ts): keine Gruppen, und pro Ebene GENAU EIN
// Feld, das aussieht wie das, was es anlegt (NeuFelder.tsx): im Projekt unten „+ Neue Liste“ (Überschrift-Stil), in jeder Liste
// unten „+ Neue Aufgabe“ (Haken-Zeile), in einer aufgeklappten Aufgabe „+ Unteraufgabe“ (eingerückt).
// Menü „…“ je Zeile (ZeilenMenue.tsx): Liste → Aufgabe, Aufgabe → Liste, Aufgabe ↔ Unteraufgabe, „Verschieben nach …“ — jeweils
// mit „Rückgängig“ (lib/aufgaben/umwandeln.ts, über die bestehenden Ops; der Server prüft Eltern, Tiefe, Kreise und Ort).
// Ziehen & Ablegen (Ziehen.tsx, Regel lib/aufgaben/ziehen.ts): Aufgaben zwischen Listen, Unteraufgaben zwischen Aufgaben,
// Reihenfolge — Maus ziehen, Handy lange drücken; Tastatur über „Verschieben nach …“.
// Weiter wie bisher: 🔒 „nur ich“, „abgebrochen“ grau, Zeichen für Priorität/überfällig, Erledigen/Löschen über den
// HandlungProvider, Wartende über EINE Karte je Render (#84), lange Listen in Stücken zu 200 Zeilen, mehrstufige Unteraufgaben bis
// `AUFGABEN_EBENEN_MAX` (n/m je Ebene), Wischen = Archivieren/Löschen (`ZeileAktionen`, Kevin 04.10.).
// Genutzt vom Space (alle Projekte), der Projektseite und dem Meilenstein (ein Projekt, ohne Kopf, optional Fokus auf eine Liste).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { MessageSquare, Link2, ChevronRight, Lock, Sparkles, StickyNote } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, HakenZiel, Punkt, prioFarbe, ZielChip, useZielBezug, ZeileAktionen, useRueckgaengig, useRueckfrage } from '../ui';
import { dateienZaehlen } from './Papierkorb';
import { projektUmfang, umfangText } from '@/lib/aufgaben/papierkorb';
import { istMeilensteinListe } from '@/lib/planung/meilenstein-aufgaben';
import { statusVon, fortschritt, sonstigeProjektId, nachReihe, type BaumProjekt, type BaumAufgabe, type BaumListe } from '@/lib/aufgaben/struktur';
import { kinderKarte, vorfahren, nachIdKarte, elternKandidaten, pfadText, AUFGABEN_EBENEN_MAX } from '@/lib/aufgaben/ebenen';
import { listeZuAufgabe, aufgabeZuListe, umhaengen, zeilenAenderungen, istFehler, type Ergebnis } from '@/lib/aufgaben/umwandeln';
import { ablegen, type Ablage } from '@/lib/aufgaben/ziehen';
import { useHandlung } from './Handlung';
import { NurIchZeichen, PrioZeichen, FristZeichen, titelStil, AbgebrochenSchild } from './Zeichen';
import type { Task, TasksState } from '@/types/tasks';
import { useTasks, type AufgabenAktion } from '@/context/TasksContext';
import { aufgabeAnlegen, listeAnlegen, ownerLabel, LISTEN_FARBEN, useIch, type Person } from './hilfe';
import { SerienZeichen } from './WiederholungWahl';
import { ListeSerieKnopf } from './SerienListeEinstellen';
import { NeueListeFeld, NeueAufgabeFeld, NeueUnteraufgabeFeld } from './NeuFelder';
import { ZeilenMenue, type MenuePunkt } from './ZeilenMenue';
import { useZiehen } from './Ziehen';

const ZU_MERKER = 'make-aufgaben-zu';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
export const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '8px 10px', minHeight: 40, borderRadius: 10 };
/** Fensterung (#84): so viele Zeilen je Liste auf einmal, dann „weitere zeigen“. */
export const FENSTER_ZEILEN = 200;
/** Ziehbare Zeilen: kein Textmarkieren/Kontextmenü beim langen Drücken (iOS). */
const ZIEHBAR: CSSProperties = { userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as CSSProperties;

/** Umbenennen/Löschen: breit in der Zeile, schmal hinter „⋯“. */
export function Aktionen({ breit, children }: { breit: boolean; children: ReactNode }) {
  const [auf, setAuf] = useState(false);
  if (breit) return <span style={{ display: 'inline-flex', flex: '0 0 auto', alignItems: 'center' }}>{children}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {auf && children}
      <button onClick={() => setAuf(a => !a)} aria-label={auf ? 'Aktionen schließen' : 'Aktionen'} aria-expanded={auf} className="fassbar" style={{ ...leiseKnopf, minWidth: 44, minHeight: 44, fontSize: 18, lineHeight: 1 }}>{auf ? '×' : '⋯'}</button>
    </span>
  );
}

const chevron = (zu: boolean, groesse = 15) => <ChevronRight size={groesse} style={{ transform: zu ? 'none' : 'rotate(90deg)', transition: 'transform .15s ease' }} />;
const klappKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', padding: 0, display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, flex: '0 0 auto' };

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
  /** Nur diese Liste zeigen (Projektseite, Brotkrumen, Meilenstein). */
  fokus?: { l?: string };
  projektKopf?: boolean;
  iStart?: number;
}) {
  const [zu, setZu] = useState<Set<string>>(new Set());
  const [mehr, setMehr] = useState<Record<string, number>>({});
  const handlung = useHandlung(dispatch, state.statusEigen);
  const { melden, hinweis } = useRueckgaengig();
  const { bestaetigen, dialog } = useRueckfrage();
  const ich = useIch();
  // Umwandeln/Ziehen rechnen auf dem VOLLEN Stand (mit Papierkorb/Archiv) — sonst blieben verborgene Zeilen an einer gelöschten Liste hängen.
  const { voll } = useTasks();
  const vollRef = useRef(voll);
  vollRef.current = voll;

  /** Ein Ergebnis anwenden: Zeilen setzen (gehen als Einzeländerungen an den Server), Hinweis mit „Rückgängig“. */
  const anwenden = (r: Ergebnis): boolean => {
    if (istFehler(r)) { if (r.fehler) melden(r.fehler); return false; }
    const d = zeilenAenderungen(vollRef.current, r.state);
    if (!d.zeilen.length) return false;
    dispatch({ type: 'ZEILEN_SETZEN', payload: d.zeilen });
    melden(r.text, () => dispatch({ type: 'ZEILEN_SETZEN', payload: d.rueck }));
    return true;
  };
  const jetzt = () => new Date().toISOString();

  // ── Ziehen & Ablegen ──
  const pruefMerker = useRef<{ k: string; f: string | null } | null>(null);
  const ziehen = useZiehen({
    pruefen: (q, a) => {
      const k = `${q}|${a.art}|${'zielId' in a ? a.zielId : `${a.projektId}/${a.listeId ?? ''}`}`;
      if (pruefMerker.current?.k === k) return pruefMerker.current.f;
      const r = ablegen(vollRef.current, q, a, jetzt());
      const f = istFehler(r) ? (r.fehler || null) : null;
      pruefMerker.current = { k, f };
      return f;
    },
    ablegen: (q: string, a: Ablage) => { pruefMerker.current = null; anwenden(ablegen(vollRef.current, q, a, jetzt())); },
  });

  // ── Köpfe: Liste · Projekt (04.10.) — der Inhalt bleibt immer; „Rückgängig“ stellt die Zuordnung wieder her. ──
  const listeLoeschen = (id: string) => {
    const l = (state.listen ?? []).find(x => x.id === id);
    if (!l) return;
    const aufgaben = state.tasks.filter(t => t.listeId === id).map(t => t.id);
    dispatch({ type: 'DELETE_LISTE', payload: { id } });
    melden(`Liste „${l.titel}“ gelöscht — ${aufgaben.length ? `${aufgaben.length} Aufgabe${aufgaben.length === 1 ? '' : 'n'} unter „Sonstige“` : 'sie war leer'}`, () => {
      dispatch({ type: 'ADD_LISTE', payload: l });
      for (const tid of aufgaben) dispatch({ type: 'UPDATE_TASK', payload: { id: tid, listeId: id } });
    });
  };
  const projektArchivieren = (id: string, titel: string) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: { id, archived: true } });
    melden(`Projekt „${titel}“ archiviert — in der Projektseite „Aus dem Archiv holen“`, () => dispatch({ type: 'UPDATE_PROJECT', payload: { id, archived: false } }));
  };
  const projektLoeschen = async (id: string, titel: string) => {
    // Papierkorb (29.09., A7): die Rückfrage nennt, was mitgeht; 30 Tage wiederherstellbar (Aufgaben › Archiv › Papierkorb).
    const mit = umfangText(projektUmfang(state, id, await dateienZaehlen({ projektId: id })));
    if (!(await bestaetigen({ titel: `Projekt „${titel}“ in den Papierkorb legen?`, text: `${mit ? `Es geht mit: ${mit}.\n\n` : ''}30 Tage lang unter Aufgaben › Archiv › Papierkorb wiederherstellbar.`, ja: 'In den Papierkorb', gefahr: true }))) return;
    dispatch({ type: 'DELETE_PROJECT', payload: { id } });
    melden(`Projekt „${titel}“ im Papierkorb`, () => dispatch({ type: 'WIEDERHERSTELLEN', payload: { art: 'projekt', id } }));
  };
  // Ziel-Bezug (03.10.): liegt eine Aufgabe in der Liste eines Meilensteins, zeigt ihre Zeile das Ziel — nur lesen, nur wenn es solche Listen gibt.
  const ziel = useZielBezug(useMemo(() => state.tasks.some(t => istMeilensteinListe(t.listeId)), [state.tasks]));
  // Einmal je Render (#84): Kennung → Aufgabe, für „wartet auf …“ jeder Zeile.
  const nachId = useMemo(() => nachIdKarte(state.tasks), [state.tasks]);
  // Kinder je Aufgabe (alle Ebenen, einmal je Render), sortiert wie die Liste.
  const kinder = useMemo(() => { const k = kinderKarte(state.tasks); for (const l of Array.from(k.values())) l.sort(nachReihe); return k; }, [state.tasks]);
  const wartetAuf = (t: Task): Task[] => (t.abhaengigVon ?? []).map(id => nachId.get(id)).filter((x): x is Task => !!x && x.status !== 'done');
  const [auf, setAuf] = useState<Set<string>>(new Set());
  useEffect(() => { try { setZu(new Set(JSON.parse(lies(ZU_MERKER) ?? '[]') as string[])); } catch { /* egal */ } }, []);
  // Die offene Aufgabe ist eine Unteraufgabe → alle ihre Vorfahren aufklappen (jede Ebene).
  useEffect(() => {
    const t = offenId ? nachId.get(offenId) : undefined;
    const kette = t ? vorfahren(t, nachId).map(x => x.id).filter(id => !auf.has(id)) : [];
    if (kette.length) setAuf(a => { const n = new Set(a); for (const id of kette) n.add(id); return n; });
  }, [offenId]); // eslint-disable-line react-hooks/exhaustive-deps
  const umschalten = (menge: Set<string>, setze: (s: Set<string>) => void, id: string, merker?: string) => {
    const n = new Set(menge); if (n.has(id)) n.delete(id); else n.add(id);
    setze(n); if (merker) merke(merker, JSON.stringify(Array.from(n)));
  };

  // Ziele für „Verschieben nach …“: alle Listen der Projekte in diesem Baum (+ „Sonstige“ je Projekt).
  const listenZiele = useMemo(() => projekte.filter(p => !p.fremd).flatMap(p => {
    const pid = p.virtuell ? sonstigeProjektId(raumId) : p.id;
    return p.listen.map(l => ({ id: `${pid}|${l.virtuell ? '' : l.id}`, label: `${p.titel} › ${l.titel}`, ...(l.farbe ? { punkt: l.farbe } : { punkt: p.farbe }) }));
  }), [projekte, raumId]);
  const verschiebenNach = (t: Task): MenuePunkt => ({
    label: 'Verschieben nach', hinweis: 'in eine andere Liste (auch ohne Maus)',
    auswahl: { titel: 'Verschieben nach …', eintraege: listenZiele, waehlen: k => { const [projektId, listeId] = k.split('|'); anwenden(ablegen(vollRef.current, t.id, { art: 'liste', projektId, listeId: listeId || null }, jetzt())); } },
  });
  const aufgabenMenue = (t: Task, tiefe: number): MenuePunkt[] => {
    const punkte: MenuePunkt[] = [verschiebenNach(t)];
    const eltern = elternKandidaten(t, state.tasks).map(x => ({ id: x.id, label: pfadText(x, nachId) })).sort((a, b) => a.label.localeCompare(b.label, 'de'));
    if (tiefe === 0) {
      punkte.push({ label: 'In Liste umwandeln', hinweis: (kinder.get(t.id)?.length ?? 0) ? 'Unteraufgaben werden ihre Aufgaben; die Aufgabe selbst kommt ins Archiv' : 'Die Aufgabe selbst kommt ins Archiv (zurückholbar)', tun: () => { anwenden(aufgabeZuListe(vollRef.current, t.id, { jetzt: jetzt() })); } });
      punkte.push({ label: 'Zur Unteraufgabe machen', hinweis: 'unter eine andere Aufgabe hängen', auswahl: { titel: 'Unteraufgabe von …', eintraege: eltern, waehlen: id => { anwenden(umhaengen(vollRef.current, t.id, id, jetzt())); }, leer: 'Keine passende Aufgabe in diesem Projekt.' } });
    } else {
      punkte.push({ label: 'Zur Hauptaufgabe machen', hinweis: 'steht dann direkt in der Liste', tun: () => { anwenden(umhaengen(vollRef.current, t.id, null, jetzt())); } });
      if (eltern.length) punkte.push({ label: 'Umhängen unter', auswahl: { titel: 'Umhängen unter …', eintraege: eltern, waehlen: id => { anwenden(umhaengen(vollRef.current, t.id, id, jetzt())); } } });
    }
    return punkte;
  };
  const listenMenue = (p: BaumProjekt, l: BaumListe): MenuePunkt[] => {
    const punkte: MenuePunkt[] = [
      { label: 'Umbenennen', tun: () => { const v = window.prompt('Liste umbenennen', l.titel)?.trim(); if (v && v !== l.titel) dispatch({ type: 'UPDATE_LISTE', payload: { id: l.id, titel: v.slice(0, 80) } }); } },
      { label: 'Farbe', auswahl: { titel: 'Farbe der Liste', eintraege: [{ id: '', label: 'ohne Farbe' }, ...LISTEN_FARBEN.map(f => ({ id: f, label: f, punkt: f }))], waehlen: f => dispatch({ type: 'UPDATE_LISTE', payload: { id: l.id, farbe: f || undefined } }) } },
    ];
    if (!istMeilensteinListe(l.id)) {
      const ziele = [...p.listen.filter(x => !x.virtuell && x.id !== l.id).map(x => ({ id: x.id, label: x.titel, ...(x.farbe ? { punkt: x.farbe } : {}) })), { id: '', label: 'Sonstige (ohne Liste)' }];
      punkte.push({ label: 'In Aufgabe umwandeln', hinweis: 'die Liste wird eine Aufgabe, ihre Aufgaben deren Unteraufgaben', auswahl: { titel: 'Als Aufgabe in Liste …', eintraege: ziele, waehlen: z => { anwenden(listeZuAufgabe(vollRef.current, l.id, z || null, { jetzt: jetzt(), ich })); } } });
    }
    return punkte;
  };

  const meta = (t: Task, unter: Task[], schmal: boolean) => {
    const s = statusVon(t, state.statusEigen ?? []);
    const f = fortschritt(unter);
    const wartet = t.status !== 'done' && t.status !== 'cancelled' ? wartetAuf(t) : [];
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: schmal ? 8 : 10, fontSize: TYP.bedien, color: C.inkLeise, flex: '0 0 auto', flexWrap: 'wrap' }}>
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

  /** Eine Zeile samt (aufgeklappt) ihren Unteraufgaben — rekursiv bis zur Grenze. `tiefe` 0 = Hauptaufgabe. */
  const zeile = (a: BaumAufgabe, tiefe = 0, gesehen: ReadonlySet<string> = new Set()): ReactNode => {
    const t = a.task;
    const aufgeklappt = auf.has(t.id);
    const istOffen = offenId === t.id;
    const darfUnter = tiefe + 1 < AUFGABEN_EBENEN_MAX;
    const klappbar = a.unter.length > 0 || darfUnter;
    const weiter = new Set(gesehen).add(t.id);
    const einzug = 4 + tiefe * (breit ? 26 : 16);
    const gezogen = ziehen.zieht === t.id;
    return (
      <div key={t.id}>
        <ZeileAktionen titel={t.title} onArchivieren={() => handlung.archivieren(t)} onLoeschen={() => { void handlung.loeschen(t).then(weg => { if (weg && istOffen) onOeffnen(null); }); }}>
        <div className="zeile" {...ziehen.griff(t.id, t.title)} style={{ ...ZIEHBAR, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 4px', paddingLeft: einzug, borderBottom: '1px solid rgba(255,255,255,.05)', minHeight: 44, background: istOffen ? 'rgba(255,255,255,.05)' : 'transparent', borderRadius: istOffen ? 10 : 0, opacity: gezogen ? 0.45 : 1 }}>
          {klappbar ? (
            <button onClick={() => umschalten(auf, setAuf, t.id)} aria-label={aufgeklappt ? `Unteraufgaben von „${t.title}“ zuklappen` : `Unteraufgaben von „${t.title}“ aufklappen`} aria-expanded={aufgeklappt} className="fassbar"
              style={{ ...klappKnopf, color: a.unter.length ? C.inkDim : 'rgba(255,255,255,.18)' }}>{chevron(!aufgeklappt)}</button>
          ) : <span aria-hidden style={{ width: 36, flex: '0 0 auto' }} />}
          <HakenZiel an={t.status === 'done'} onChange={() => handlung.erledigen(t)} farbe={prioFarbe(t.priority)} label={t.title} />
          <button id={`oeffnen-${t.id}`} onClick={() => onOeffnen(istOffen ? null : t.id)} aria-expanded={istOffen} className="fassbar" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 2px', minHeight: 40, cursor: 'pointer', fontFamily: SCHRIFT.text, display: 'grid', gap: 2 }}>
            <span style={{ fontSize: tiefe ? TYP.bedien : 14.5, fontWeight: tiefe ? 500 : 550, ...titelStil(t), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
            {ziel(t) && <span style={{ display: 'flex', minWidth: 0 }}><ZielChip bezug={ziel(t)!} /></span>}
            {!breit && meta(t, a.unter, true)}
          </button>
          {breit && meta(t, a.unter, false)}
          <span data-nicht-ziehen><ZeilenMenue titel={t.title} punkte={aufgabenMenue(t, tiefe)} /></span>
        </div>
        </ZeileAktionen>
        {aufgeklappt && <>
          {a.unter.filter(u => !weiter.has(u.id)).map(u => zeile({ task: u, unter: kinder.get(u.id) ?? [] }, tiefe + 1, weiter))}
          {darfUnter
            ? <NeueUnteraufgabeFeld elternTitel={t.title} einzug={46 + tiefe * (breit ? 26 : 16)} onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, parentId: t.id }, { title, assignee: t.assignee, bezug: t.bezug })} />
            : <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: `4px 0 6px ${46 + tiefe * (breit ? 26 : 16)}px` }}>Tiefste Ebene ({AUFGABEN_EBENEN_MAX}) — weitere Schritte als Checkliste in der Notiz.</div>}
        </>}
      </div>
    );
  };

  const listeBlock = (p: BaumProjekt, l: BaumListe, zeigeKopf: boolean) => {
    const lk = `l:${p.id}:${l.id}`;
    const lz = zu.has(lk);
    const pid = p.virtuell ? sonstigeProjektId(raumId) : p.id;
    const zielListe = { 'data-ziel-liste': l.virtuell ? '' : l.id, 'data-ziel-projekt': pid };
    return (
      <div key={lk} style={{ marginTop: zeigeKopf ? 12 : 0 }}>
        {zeigeKopf && (
          <ZeileAktionen titel={`Liste ${l.titel}`} darf={!l.virtuell} onLoeschen={() => listeLoeschen(l.id)}>
          <div {...zielListe} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: `1px solid ${l.farbe ? `${l.farbe}55` : 'rgba(255,255,255,.07)'}`, flexWrap: 'wrap' }}>
            <button onClick={() => umschalten(zu, setZu, lk, ZU_MERKER)} aria-label={lz ? `Liste „${l.titel}“ aufklappen` : `Liste „${l.titel}“ zuklappen`} aria-expanded={!lz} className="fassbar" style={{ ...klappKnopf, color: C.inkLeise, width: 32, height: 32 }}>{chevron(lz, 14)}</button>
            {l.farbe && <Punkt farbe={l.farbe} groesse={8} />}
            <span style={{ fontSize: TYP.bedien, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: l.virtuell ? C.inkLeise : (l.farbe ?? C.inkDim) }}>{l.titel}</span>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{l.offen || ''}</span>
            {!l.virtuell && <ListeSerieKnopf listeId={l.id} />}
            {!l.virtuell && !p.fremd && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}><ZeilenMenue titel={`Liste ${l.titel}`} punkte={listenMenue(p, l)} /></span>}
          </div>
          </ZeileAktionen>
        )}
        {!lz && <>
          {l.aufgaben.slice(0, mehr[lk] ?? FENSTER_ZEILEN).map(a => zeile(a))}
          {l.aufgaben.length > (mehr[lk] ?? FENSTER_ZEILEN) && (
            <button onClick={() => setMehr(m => ({ ...m, [lk]: (m[lk] ?? FENSTER_ZEILEN) + FENSTER_ZEILEN }))} style={{ ...leiseKnopf, color: C.aktiv, padding: '10px 4px', minHeight: 44 }}>
              weitere {Math.min(FENSTER_ZEILEN, l.aufgaben.length - (mehr[lk] ?? FENSTER_ZEILEN))} von {l.aufgaben.length - (mehr[lk] ?? FENSTER_ZEILEN)} zeigen
            </button>
          )}
          <div {...zielListe}>
            {!l.aufgaben.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '8px 4px 2px 42px' }}>Noch keine Aufgabe.</div>}
            {!p.fremd && <NeueAufgabeFeld listeTitel={l.titel} onNeu={title => aufgabeAnlegen(dispatch, state, { spaceId: raumId, projectId: pid, listeId: l.virtuell ? undefined : l.id }, { title })} />}
          </div>
        </>}
      </div>
    );
  };

  const projektKarte = (p: BaumProjekt, i: number) => {
    const pz = projektKopf && zu.has(p.id);
    const pid = p.virtuell ? sonstigeProjektId(raumId) : p.id;
    const nurListe = fokus?.l && p.listen.some(l => l.id === fokus.l) ? fokus.l : undefined;
    const listenSichtbar = p.listen.filter(l => !nurListe || l.id === nurListe);
    const zeigeKopf = (l: BaumListe) => p.listen.length > 1 || !l.virtuell;
    return (
      <Karte key={p.id} i={i + iStart}>
        {projektKopf && (
          <ZeileAktionen titel={`Projekt ${p.titel}`} darf={!p.virtuell && !p.fremd} onArchivieren={() => projektArchivieren(p.id, p.titel)} onLoeschen={() => void projektLoeschen(p.id, p.titel)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pz ? 0 : 6 }}>
            <button onClick={() => umschalten(zu, setZu, p.id, ZU_MERKER)} aria-label={pz ? 'Projekt aufklappen' : 'Projekt zuklappen'} aria-expanded={!pz} className="fassbar" style={klappKnopf}>{chevron(pz, 16)}</button>
            <Punkt farbe={p.farbe} />
            <button onClick={() => onProjekt?.(pid)} className="fassbar" title="Projekt öffnen"
              style={{ background: 'none', border: 'none', padding: 0, cursor: onProjekt ? 'pointer' : 'default', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: C.ink, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</button>
            {p.fremd && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>aus einem anderen Space</span>}
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{p.offen} offen</span>
            {!p.virtuell && !p.fremd && onProjekt && <button onClick={() => onProjekt(pid)} style={{ ...leiseKnopf, color: C.aktiv }}>öffnen ›</button>}
          </div>
          </ZeileAktionen>
        )}
        {!pz && <>
          {listenSichtbar.map(l => listeBlock(p, l, zeigeKopf(l)))}
          {!p.fremd && !nurListe && <NeueListeFeld projektTitel={p.titel} onNeu={titel => { listeAnlegen(dispatch, state, pid, titel); }} />}
        </>}
      </Karte>
    );
  };

  return <>{projekte.map((p, i) => projektKarte(p, i))}{dialog}{hinweis}{ziehen.anzeige}</>;
}
