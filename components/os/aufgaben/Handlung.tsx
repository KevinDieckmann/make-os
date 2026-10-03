'use client';
// ─── Aufgaben-Handlungen mit Rückfrage und „Rückgängig“ (29.09., Paket T2) ─────
// Eine Stelle für Handlungen, die man bereuen kann:
//   · Erledigen / Status „Erledigt“ mit offenen Unteraufgaben (#66): „mit erledigen · offen lassen · abbrechen“ — auch beim
//     Ablegen auf „Erledigt“ im Board. Seit 01.10. für den ganzen Teilbaum (alle Ebenen darunter).
//   · Deadline der Hauptaufgabe verschieben, Unteraufgaben haben eigene Deadlines (#68): „Unteraufgaben mitverschieben
//     (Abstand halten)“ oder nur diese.
//   · Nach Löschen (Papierkorb), Erledigen, Status und Verschieben: Hinweis unten mit „Rückgängig“ (10 s, #87).
// Ohne Provider (z. B. Flächen) fallen die Handlungen auf die direkten Aktionen zurück.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Fenster } from '../Fenster';
import { Knopf, SymbolKnopf } from '../ui';
import { useTasks, type AufgabenAktion } from '@/context/TasksContext';
import { istOffen, statusTeil, statusListe, bereichVonSpace } from '@/lib/aufgaben/struktur';
import { berlinerTag, kurzTag, tagPlus, tageZwischen } from '@/lib/aufgaben/wiederholung';
import { serieLaeuft, serieUeberspringen } from '@/lib/aufgaben/serie';
import { aufgabeUmfang, umfangText } from '@/lib/aufgaben/papierkorb';
import { nachfahrenIn } from '@/lib/aufgaben/ebenen';
import type { AufgabenStatus, Task } from '@/types/tasks';
import { dateienZaehlen } from './Papierkorb';

export const RUECKGAENGIG_MS = 10_000;

interface Hinweis { id: number; text: string; rueck?: () => void }
interface Frage { titel: string; text: string; wahl: { label: string; farbe?: string; leise?: boolean; tun: () => void }[]; /** Schließen ohne Wahl. */ zu?: () => void }

export interface Handlungen {
  /** Haken: erledigt ↔ offen. Offene Unteraufgaben → Rückfrage. */
  erledigen: (t: Task) => void;
  /** Status setzen (eigener oder Grundstatus). Wird es „erledigt“ und es gibt offene Unteraufgaben → Rückfrage. */
  statusSetzen: (t: Task, statusId: string) => void;
  /**
   * In den Papierkorb (mit Umfang in der Rückfrage) — danach „Rückgängig“. Eine offene Instanz einer laufenden Serie fragt:
   * „Nur diese überspringen“ oder „Serie beenden“ (T1: Löschen einer Instanz = überspringen). Liefert true, wenn weg.
   */
  loeschen: (t: Task) => Promise<boolean>;
  /** Nur diesen Termin der Serie auslassen: Tag → `ausnahmen`, die nächste Instanz entsteht sofort (#29). */
  ueberspringen: (t: Task) => boolean;
  /** Deadline/Start/Ort ändern mit „Rückgängig“; Deadline der Hauptaufgabe → Unteraufgaben mitverschieben? */
  verschieben: (t: Task, teil: Partial<Task>, was?: string) => void;
  /** In einen anderen Space umziehen (`teil` aus `umzugTeil`). Business → Privat mit CRM-Bezug fragt: lösen oder behalten (#4). */
  umziehen: (t: Task, teil: Partial<Task>) => void;
}

const Ctx = createContext<Handlungen | null>(null);

/** Offene Unteraufgaben im GANZEN Teilbaum (mehrstufig seit 01.10.) — die Rückfrage gilt für alle Ebenen darunter. */
const offeneUnter = (t: Task, alle: readonly Task[]) => nachfahrenIn(t.id, alle).filter(istOffen);
const zahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
const fertigTeil = (_t: Task): Partial<Task> => ({ status: 'done', statusId: undefined, completedAt: new Date().toISOString() });
/** Die alten Werte der Felder, die ein Teil ändert (undefined = Feld fehlte). */
const vorher = (t: Task, teil: Partial<Task>): Partial<Task> => Object.fromEntries(Object.keys(teil).map(k => [k, (t as unknown as Record<string, unknown>)[k]])) as Partial<Task>;

export function HandlungProvider({ children }: { children: ReactNode }) {
  const { state, dispatch } = useTasks();
  const stateRef = useRef(state);
  stateRef.current = state;
  const [frage, setFrage] = useState<Frage | null>(null);
  const [hinweis, setHinweis] = useState<Hinweis | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const zaehler = useRef(0);

  const melden = useCallback((text: string, rueck?: () => void) => {
    clearTimeout(timer.current);
    const id = ++zaehler.current;
    setHinweis({ id, text, rueck });
    timer.current = setTimeout(() => setHinweis(h => (h?.id === id ? null : h)), RUECKGAENGIG_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const upd = useCallback((id: string, teil: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id, ...teil } }), [dispatch]);

  /** Status-Teile anwenden und „Rückgängig“ anbieten (stellt die alten Status-Felder wieder her). */
  const statusAnwenden = useCallback((schritte: { t: Task; teil: Partial<Task> }[], text: string) => {
    const alt = schritte.map(s => ({ id: s.t.id, teil: { status: s.t.status, statusId: s.t.statusId, completedAt: s.t.completedAt } as Partial<Task> }));
    for (const s of schritte) upd(s.t.id, s.teil);
    melden(text, () => { for (const a of alt) upd(a.id, a.teil); });
  }, [upd, melden]);

  const erledigen = useCallback((t: Task) => {
    const alle = stateRef.current.tasks;
    if (t.status === 'done') {
      dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } });
      melden(`„${t.title}“ wieder offen`, () => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } }));
      return;
    }
    const offen = offeneUnter(t, alle);
    const einfach = () => {
      dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } });
      melden(`„${t.title}“ erledigt`, () => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } }));
    };
    if (!offen.length) { einfach(); return; }
    setFrage({
      titel: `„${t.title}“ erledigen?`,
      text: `${zahl(offen.length, 'Unteraufgabe ist', 'Unteraufgaben sind')} noch offen: ${offen.slice(0, 4).map(u => `„${u.title}“`).join(', ')}${offen.length > 4 ? ' …' : ''}.`,
      wahl: [
        { label: 'Mit erledigen', tun: () => {
          dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } });
          for (const u of offen) upd(u.id, fertigTeil(u));
          melden(`„${t.title}“ + ${zahl(offen.length, 'Unteraufgabe', 'Unteraufgaben')} erledigt`, () => {
            dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } });
            for (const u of offen) upd(u.id, { status: u.status, statusId: u.statusId, completedAt: u.completedAt });
          });
        } },
        { label: 'Unteraufgaben offen lassen', leise: true, tun: einfach },
        { label: 'Abbrechen', leise: true, tun: () => undefined },
      ],
    });
  }, [dispatch, melden, upd]);

  const statusSetzen = useCallback((t: Task, statusId: string) => {
    const eigene = stateRef.current.statusEigen ?? [];
    const teil = statusTeil(t, statusId, eigene);
    const label = statusListe(t.spaceId, eigene).find(s => s.id === statusId)?.label ?? statusId;
    const wirdFertig = teil.status === 'done' && t.status !== 'done';
    const offen = wirdFertig ? offeneUnter(t, stateRef.current.tasks) : [];
    const mitDatum = wirdFertig ? { ...teil, completedAt: new Date().toISOString() } : teil.status && teil.status !== 'done' && t.status === 'done' ? { ...teil, completedAt: undefined } : teil;
    if (!offen.length) { statusAnwenden([{ t, teil: mitDatum }], `„${t.title}“ → ${label}`); return; }
    setFrage({
      titel: `„${t.title}“ auf ${label}?`,
      text: `${zahl(offen.length, 'Unteraufgabe ist', 'Unteraufgaben sind')} noch offen.`,
      wahl: [
        { label: 'Mit erledigen', tun: () => statusAnwenden([{ t, teil: mitDatum }, ...offen.map(u => ({ t: u, teil: fertigTeil(u) }))], `„${t.title}“ + ${zahl(offen.length, 'Unteraufgabe', 'Unteraufgaben')} erledigt`) },
        { label: 'Unteraufgaben offen lassen', leise: true, tun: () => statusAnwenden([{ t, teil: mitDatum }], `„${t.title}“ → ${label}`) },
        { label: 'Abbrechen', leise: true, tun: () => undefined },
      ],
    });
  }, [statusAnwenden]);

  const ueberspringen = useCallback((t: Task) => {
    // Rein über lib/aufgaben/serie.ts (dieselbe Regel wie der Server): Kennung der nächsten Instanz ist fest (w-…-Tag).
    const r = serieUeberspringen(t, stateRef.current.tasks, berlinerTag(), new Date().toISOString());
    if (!r) return false;
    upd(t.id, { wiederholung: r.geloescht.wiederholung });
    dispatch({ type: 'DELETE_TASK', payload: { id: t.id } });
    for (const n of r.neu) { const { createdAt: _c, updatedAt: _u, ...ohneZeit } = n; dispatch({ type: 'ADD_TASK_MIT_ID', payload: ohneZeit }); }
    const naechste = r.neu.find(n => !n.parentId)?.dueDate;
    // Kein „Rückgängig“: die neue Instanz steht schon, ein Zurückholen ergäbe zwei offene.
    melden(`„${t.title}“ übersprungen${naechste ? ` — nächste: ${kurzTag(naechste)}` : ''}`);
    return true;
  }, [dispatch, upd, melden]);

  const loeschen = useCallback(async (t: Task) => {
    const serie = serieLaeuft(t) && !t.parentId && istOffen(t) && !!t.dueDate;
    if (serie) {
      return new Promise<boolean>(fertig => setFrage({
        titel: `„${t.title}“ gehört zu einer Serie`,
        text: `Nur diesen Termin (${kurzTag(t.dueDate!)}) überspringen — die nächste Instanz kommt sofort — oder die ganze Serie beenden (diese Aufgabe geht in den Papierkorb, es kommt keine weitere)?`,
        wahl: [
          { label: 'Nur diese überspringen', tun: () => fertig(ueberspringen(t)) },
          { label: 'Serie beenden', leise: true, tun: () => {
            const alt = t.wiederholung!;
            upd(t.id, { wiederholung: { ...alt, serieBeendet: true } });
            dispatch({ type: 'DELETE_TASK', payload: { id: t.id } });
            melden(`Serie „${t.title}“ beendet`, () => { dispatch({ type: 'WIEDERHERSTELLEN', payload: { art: 'aufgabe', id: t.id } }); upd(t.id, { wiederholung: alt }); });
            fertig(true);
          } },
          { label: 'Abbrechen', leise: true, tun: () => fertig(false) },
        ],
        zu: () => fertig(false),
      }));
    }
    const mit = umfangText(aufgabeUmfang(stateRef.current, t.id, await dateienZaehlen({ aufgabeId: t.id })));
    if (mit && !window.confirm(`„${t.title}“ in den Papierkorb legen?\n\nEs geht mit: ${mit}.\n\n30 Tage lang unter Aufgaben › Archiv › Papierkorb wiederherstellbar.`)) return false;
    dispatch({ type: 'DELETE_TASK', payload: { id: t.id } });
    melden(`„${t.title}“ im Papierkorb`, () => dispatch({ type: 'WIEDERHERSTELLEN', payload: { art: 'aufgabe', id: t.id } }));
    return true;
  }, [dispatch, melden, upd, ueberspringen]);

  const verschieben = useCallback((t: Task, teil: Partial<Task>, was = 'verschoben') => {
    const alt = vorher(t, teil);
    // Alle Ebenen darunter (01.10.) — „Abstand halten“ gilt für den ganzen Teilbaum.
    const unter = nachfahrenIn(t.id, stateRef.current.tasks).filter(x => x.dueDate && istOffen(x));
    const tun = (mitUnter: boolean) => {
      upd(t.id, teil);
      const d = t.dueDate && teil.dueDate ? tageZwischen(t.dueDate, teil.dueDate) : 0;
      const bewegt = mitUnter && d ? unter.map(u => ({ id: u.id, alt: { dueDate: u.dueDate, startDate: u.startDate } as Partial<Task>, neu: { dueDate: tagPlus(u.dueDate!, d), ...(u.startDate ? { startDate: tagPlus(u.startDate, d) } : {}) } as Partial<Task> })) : [];
      for (const b of bewegt) upd(b.id, b.neu);
      melden(`„${t.title}“ ${was}${bewegt.length ? ` (+ ${zahl(bewegt.length, 'Unteraufgabe', 'Unteraufgaben')})` : ''}`, () => { upd(t.id, alt); for (const b of bewegt) upd(b.id, b.alt); });
    };
    const deadlineNeu = 'dueDate' in teil && !!teil.dueDate && !!t.dueDate && teil.dueDate !== t.dueDate;
    if (!deadlineNeu || !unter.length) { tun(false); return; }
    const d = tageZwischen(t.dueDate!, teil.dueDate!);
    setFrage({
      titel: 'Unteraufgaben mitverschieben?',
      text: `„${t.title}“ rückt um ${Math.abs(d)} Tag${Math.abs(d) === 1 ? '' : 'e'} ${d > 0 ? 'nach hinten' : 'nach vorn'}. ${zahl(unter.length, 'Unteraufgabe hat', 'Unteraufgaben haben')} eine eigene Deadline.`,
      wahl: [
        { label: 'Mitverschieben (Abstand halten)', tun: () => tun(true) },
        { label: 'Nur die Hauptaufgabe', leise: true, tun: () => tun(false) },
        { label: 'Abbrechen', leise: true, tun: () => undefined },
      ],
    });
  }, [upd, melden]);

  const umziehen = useCallback((t: Task, teil: Partial<Task>) => {
    const nachPrivat = bereichVonSpace(teil.spaceId ?? t.spaceId) === 'privat' && bereichVonSpace(t.spaceId) === 'business';
    const b = t.bezug;
    const verknuepft = !!b && !!(b.kontaktId || b.firmaId || b.mandatId || b.dealId);
    if (!nachPrivat || !verknuepft) { verschieben(t, teil, 'verschoben'); return; }
    const arten = [b!.kontaktId ? 'Kontakt' : '', b!.firmaId ? 'Firma' : '', b!.mandatId ? 'Mandat' : '', b!.dealId ? 'Deal' : ''].filter(Boolean).join(', ');
    setFrage({
      titel: `„${t.title}“ nach Privat?`,
      text: `Die Aufgabe ist mit dem CRM verknüpft (${arten}). Bleibt die Verknüpfung, steht sie weiter in der Akte. Dateien an der Aufgabe werden „privat“.`,
      wahl: [
        { label: 'Verknüpfung lösen und verschieben', tun: () => verschieben(t, { ...teil, bezug: undefined }, 'nach Privat verschoben (ohne CRM-Bezug)') },
        { label: 'Verknüpfung behalten', leise: true, tun: () => verschieben(t, teil, 'nach Privat verschoben') },
        { label: 'Abbrechen', leise: true, tun: () => undefined },
      ],
    });
  }, [verschieben]);

  const wert = useMemo<Handlungen>(() => ({ erledigen, statusSetzen, loeschen, ueberspringen, verschieben, umziehen }), [erledigen, statusSetzen, loeschen, ueberspringen, verschieben, umziehen]);
  return (
    <Ctx.Provider value={wert}>
      {children}
      {frage && (
        <Fenster titel={frage.titel} onZu={() => { const zu = frage.zu; setFrage(null); zu?.(); }} breit={480}>
          <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 }}>{frage.text}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {frage.wahl.map((w, i) => <Knopf key={i} leise={w.leise} farbe={w.farbe} onClick={() => { setFrage(null); w.tun(); }}>{w.label}</Knopf>)}
          </div>
        </Fenster>
      )}
      {hinweis && (
        <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 9998, width: 'min(460px, calc(100vw - 32px))',
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px', borderRadius: 14, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 16px 40px -12px rgba(0,0,0,.7)', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hinweis.text}</span>
          {hinweis.rueck && <button onClick={() => { const r = hinweis.rueck; setHinweis(null); r?.(); }} className="fassbar" style={{ background: 'none', border: `1px solid ${C.aktiv}66`, borderRadius: 10, color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '8px 12px', minHeight: 40 }}>Rückgängig</button>}
          <SymbolKnopf onClick={() => setHinweis(null)} ariaLabel="Hinweis schließen">×</SymbolKnopf>
        </div>
      )}
    </Ctx.Provider>
  );
}

/**
 * Die Handlungen — ohne Provider (Flächen, CRM-Kachel, Tests) die direkten Aktionen über das mitgegebene `dispatch`
 * (ohne Rückfrage/Rückgängig).
 */
export function useHandlung(dispatch: Dispatch<AufgabenAktion>, statusEigen?: readonly AufgabenStatus[]): Handlungen {
  const ctx = useContext(Ctx);
  return useMemo<Handlungen>(() => ctx ?? {
    erledigen: t => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } }),
    statusSetzen: (t, id) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...statusTeil(t, id, statusEigen ?? []) } }),
    loeschen: async t => { dispatch({ type: 'DELETE_TASK', payload: { id: t.id } }); return true; },
    ueberspringen: () => false,
    umziehen: (t, teil) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...teil } }),
    verschieben: (t, teil) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...teil } }),
  }, [ctx, dispatch, statusEigen]);
}

/** Kleiner Warnhinweis: Unteraufgabe nach der Deadline der Hauptaufgabe (#68). */
export function NachElternFrist({ unter, eltern }: { unter: Pick<Task, 'dueDate'>; eltern?: Pick<Task, 'dueDate'> }) {
  if (!unter.dueDate || !eltern?.dueDate || unter.dueDate <= eltern.dueDate) return null;
  return <span role="note" title="Deadline liegt nach der Deadline der Hauptaufgabe" style={{ color: LEUCHT.achtung, fontSize: TYP.bedien, whiteSpace: 'nowrap' }}>⚠ nach Hauptfrist</span>;
}
