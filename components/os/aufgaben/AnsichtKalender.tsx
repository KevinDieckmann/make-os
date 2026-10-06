'use client';
// ─── Aufgaben als Kalender / Zeitachse (28.09. spät, Paket C5 — Kevin: „Kalender/Zeitachse nach Deadline“) ─
// Monat (Standard) und Woche. Jede Aufgabe mit Deadline steht an ihrem Tag; mit Start läuft ein Balken von Start
// bis Deadline (über Wochengrenzen weiter). Farbe nach Status oder nach Liste (Listenfarbe, sonst Projektfarbe), überfällig rot
// markiert, wiederkehrende mit ↻. Klick öffnet das Detail. Ziehen auf einen anderen Tag verschiebt die Deadline
// (der Start wandert mit, die Dauer bleibt); für Tastatur und Handy dasselbe über „verschieben auf …“ an der
// geöffneten Aufgabe. Aufgaben ohne Datum stehen in der Seitenliste (auch von dort auf einen Tag ziehbar).
// Heute = Berliner Tag. Rechnen (Tage, Einträge, Bahnen, Verschieben) rein in lib/aufgaben/ansichten.ts; Monat/
// Woche/Farbe merkt sich der Browser (localStorage, still bei Fehlern). Geschrieben wird über den Aufgaben-Kontext.

import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Leer, Punkt, Segmente, prioFarbe } from '../ui';
import { statusListe, statusVon } from '@/lib/aufgaben/struktur';
import { tagPlus } from '@/lib/kalender/zeit';
import {
  berlinHeute, kalenderTage, ankerSchritt, kalenderTitel, kalenderEintraege, ohneDatum, wochenLegen, verdecktJeTag, verschiebenTeil,
  datumKurz, datumLang, istTag, istUeberfaellig, type KalenderAnsicht, type Balken,
} from '@/lib/aufgaben/ansichten';
import type { Task, TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { useHandlung } from './Handlung';

const MERKER = 'make-aufgaben-kalender';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
/** Sichtbare Bahnen je Woche im Monat — der Rest als „+n“ (Klick öffnet die Woche). */
const MONAT_BAHNEN = 3;
const BAHN_HOEHE = 24;
const KOPF_HOEHE = 30;

type FarbeNach = 'status' | 'liste';
const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '6px 8px', borderRadius: 8 };
const rundKnopf: CSSProperties = { ...leiseKnopf, width: 32, height: 32, display: 'grid', placeItems: 'center', padding: 0, border: '1px solid rgba(255,255,255,.08)', color: C.inkDim };
const pille = (an: boolean): CSSProperties => ({ ...leiseKnopf, border: `1px solid ${an ? `${C.aktiv}66` : 'rgba(255,255,255,.08)'}`, color: an ? C.aktiv : C.inkDim, borderRadius: 999, padding: '4px 10px' });

export function AnsichtKalender({ state, dispatch, aufgaben, heute: heuteVorgabe, offenId, onOeffnen, anker: ankerVorgabe }: {
  state: TasksState; dispatch: Dispatch<AufgabenAktion>; aufgaben: Task[]; offenId: string | null; onOeffnen: (id: string) => void;
  /** Heute (Berliner Tag) — nur für Tests vorzugeben. */
  heute?: string;
  /** Anfangs gezeigter Tag (Standard heute). */
  anker?: string;
}) {
  const heute = heuteVorgabe ?? berlinHeute();
  const eigene = state.statusEigen ?? [];
  const [ansicht, setAnsichtRoh] = useState<KalenderAnsicht>('monat');
  const [farbeNach, setFarbeNachRoh] = useState<FarbeNach>('status');
  const [anker, setAnker] = useState(ankerVorgabe ?? heute);
  const [zieht, setZieht] = useState<string | null>(null);
  const [ueber, setUeber] = useState<string | null>(null);
  const [verschieben, setVerschieben] = useState(false);
  useEffect(() => {
    try { const m = JSON.parse(lies(MERKER) ?? 'null') as { ansicht?: unknown; farbe?: unknown } | null; if (m?.ansicht === 'woche' || m?.ansicht === 'monat') setAnsichtRoh(m.ansicht); if (m?.farbe === 'liste' || m?.farbe === 'gruppe' || m?.farbe === 'status') setFarbeNachRoh(m.farbe === 'status' ? 'status' : 'liste'); } catch { /* egal */ }
  }, []);
  const sichern = (a: KalenderAnsicht, f: FarbeNach) => merke(MERKER, JSON.stringify({ ansicht: a, farbe: f }));
  const setAnsicht = (a: KalenderAnsicht) => { setAnsichtRoh(a); sichern(a, farbeNach); };
  const setFarbeNach = (f: FarbeNach) => { setFarbeNachRoh(f); sichern(ansicht, f); };
  useEffect(() => { setVerschieben(false); }, [offenId]);

  const tage = useMemo(() => kalenderTage(ansicht, anker), [ansicht, anker]);
  const eintraege = useMemo(() => kalenderEintraege(aufgaben, heute), [aufgaben, heute]);
  const wochen = useMemo(() => wochenLegen(tage, eintraege), [tage, eintraege]);
  const ohne = useMemo(() => ohneDatum(aufgaben), [aufgaben]);
  const monat = Number(anker.slice(5, 7));

  // ── Farbe: Status (fest/eigen des Space) oder Farbe der Liste (06.10.: die früheren Gruppen-Farben; sonst Projektfarbe) ──
  const farbe = (t: Task): string => {
    if (farbeNach === 'status') return statusVon(t, eigene).farbe;
    const l = t.listeId ? (state.listen ?? []).find(x => x.id === t.listeId) : undefined;
    return l?.farbe ?? state.projects.find(p => p.id === t.projectId)?.color ?? C.inkLeise;
  };
  const legende = useMemo(() => {
    if (farbeNach === 'status') {
      const spaces = new Set(aufgaben.map(t => t.spaceId));
      const l = statusListe(spaces.size === 1 ? [...spaces][0] : undefined, eigene);
      return l.map(s => ({ id: s.id, label: s.label, farbe: s.farbe }));
    }
    const m = new Map<string, { id: string; label: string; farbe: string }>();
    for (const t of aufgaben) {
      const l = t.listeId ? (state.listen ?? []).find(x => x.id === t.listeId) : undefined;
      if (l?.farbe) m.set(l.id, { id: l.id, label: l.titel, farbe: l.farbe });
    }
    return Array.from(m.values());
  }, [farbeNach, aufgaben, state.listen, eigene]);

  // Seit 29.09. über den HandlungProvider: „Rückgängig“ (#87) und „Unteraufgaben mitverschieben?“ (#68).
  const handlung = useHandlung(dispatch, state.statusEigen);
  const verschiebeAuf = (id: string, tag: string) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    const teil = verschiebenTeil(t, tag);
    if (teil) handlung.verschieben(t, teil, `auf ${tag.slice(8, 10)}.${tag.slice(5, 7)}. verschoben`);
  };
  const ablegen = (tag: string, e: DragEvent) => {
    let id = zieht;
    if (!id) { try { id = e.dataTransfer.getData('text/plain') || null; } catch { id = null; } }
    setZieht(null); setUeber(null);
    if (id && aufgaben.some(t => t.id === id)) verschiebeAuf(id, tag);
  };
  const ziehStart = (id: string) => (e: DragEvent) => {
    try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch { /* egal */ }
    // Erst nach dem Start des Ziehens umstellen — sonst bricht mancher Browser das Ziehen ab.
    setTimeout(() => setZieht(id), 0);
  };
  const ziehEnde = () => { setZieht(null); setUeber(null); };

  const offen = offenId ? aufgaben.find(t => t.id === offenId) : undefined;
  const woche = ansicht === 'woche';

  // ── Ein Balken (Abschnitt einer Aufgabe in einer Woche) ──
  const balken = (b: Balken) => {
    const t = b.eintrag.task;
    const f = farbe(t);
    const rot = b.eintrag.ueberfaellig;
    const fertig = t.status === 'done';
    const zeitraum = b.eintrag.start !== b.eintrag.ende ? `${datumKurz(b.eintrag.start)}–${datumKurz(b.eintrag.ende)}` : datumKurz(b.eintrag.ende);
    const ist = offenId === t.id;
    return (
      <button key={`${t.id}-${b.von}`} type="button" draggable onDragStart={ziehStart(t.id)} onDragEnd={ziehEnde} onClick={() => onOeffnen(t.id)} className="fassbar ui-kein-ziel" data-aufgabe={t.id}
        aria-label={`${t.title} · Deadline ${datumLang(b.eintrag.ende)}${b.eintrag.start !== b.eintrag.ende ? ` · Start ${datumLang(b.eintrag.start)}` : ''} · ${statusVon(t, eigene).label}${rot ? ' · überfällig' : ''}${b.eintrag.wiederkehrend ? ' · wiederkehrend' : ''}`}
        title={`${t.title} · ${zeitraum}${rot ? ' · überfällig' : ''}`}
        style={{
          gridColumn: `${b.von + 1} / ${b.bis + 2}`, gridRow: b.bahn + 1, pointerEvents: zieht ? 'none' : 'auto', minWidth: 0,
          display: 'flex', alignItems: 'center', gap: 4, height: BAHN_HOEHE - 4, margin: `2px ${b.ende ? 3 : 0}px 2px ${b.anfang ? 3 : 0}px`, padding: '0 6px',
          border: `1px solid ${ist ? C.aktiv : rot ? `${LEUCHT.kritisch}AA` : `${f}55`}`, borderLeft: b.anfang ? `3px solid ${rot ? LEUCHT.kritisch : f}` : `1px dashed ${f}88`,
          borderRadius: `${b.anfang ? 6 : 0}px ${b.ende ? 6 : 0}px ${b.ende ? 6 : 0}px ${b.anfang ? 6 : 0}px`,
          background: `${f}${fertig ? '14' : '2B'}`, color: fertig ? C.inkLeise : C.ink, cursor: 'grab', opacity: zieht === t.id ? 0.4 : 1,
          fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, textAlign: 'left', lineHeight: 1.2, overflow: 'hidden',
        }}>
        {!b.anfang && <span aria-hidden style={{ color: C.inkLeise }}>‹</span>}
        {rot && <span aria-hidden style={{ color: LEUCHT.kritisch, fontWeight: 800 }}>!</span>}
        {b.eintrag.wiederkehrend && <span aria-hidden title="wiederkehrend" style={{ color: C.inkDim }}>↻</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: fertig ? 'line-through' : 'none' }}>{t.title}</span>
        {!b.ende && <span aria-hidden style={{ marginLeft: 'auto', color: C.inkLeise }}>›</span>}
      </button>
    );
  };

  // ── Leiste „verschieben auf …“ an der geöffneten Aufgabe (Tastatur/Handy) ──
  const leiste = offen && (
    <div role="group" aria-label="Deadline verschieben" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 10px', margin: '0 0 10px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
      <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>„{offen.title}“</span>
      <span style={{ fontSize: TYP.bedien, color: istUeberfaellig(offen, heute) ? LEUCHT.kritisch : C.inkLeise }}>{istTag(offen.dueDate) ? `Deadline ${datumLang(offen.dueDate)}` : 'ohne Datum'}</span>
      <button onClick={() => setVerschieben(v => !v)} aria-expanded={verschieben} className="fassbar" style={pille(verschieben)}>{istTag(offen.dueDate) ? 'verschieben auf …' : 'Datum setzen …'}</button>
      {verschieben && (
        <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <input type="date" aria-label={`Neue Deadline für „${offen.title}“`} defaultValue={istTag(offen.dueDate) ? offen.dueDate : heute} key={`${offen.id}-${offen.dueDate ?? ''}`}
            onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (istTag(v)) verschiebeAuf(offen.id, v); } }}
            onChange={e => { const v = e.target.value; if (istTag(v)) verschiebeAuf(offen.id, v); }}
            style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '4px 10px', minHeight: 30, colorScheme: 'dark' }} />
          <button onClick={() => verschiebeAuf(offen.id, heute)} className="fassbar" style={pille(false)}>Heute</button>
          <button onClick={() => verschiebeAuf(offen.id, tagPlus(heute, 1))} className="fassbar" style={pille(false)}>Morgen</button>
          {istTag(offen.dueDate) && <>
            <button onClick={() => verschiebeAuf(offen.id, tagPlus(offen.dueDate!, -1))} className="fassbar" style={pille(false)} aria-label="einen Tag früher">− 1 Tag</button>
            <button onClick={() => verschiebeAuf(offen.id, tagPlus(offen.dueDate!, 1))} className="fassbar" style={pille(false)} aria-label="einen Tag später">+ 1 Tag</button>
            <button onClick={() => verschiebeAuf(offen.id, tagPlus(offen.dueDate!, 7))} className="fassbar" style={pille(false)} aria-label="eine Woche später">+ 1 Woche</button>
          </>}
        </span>
      )}
    </div>
  );

  const blatt = (
    <div style={{ border: '1px solid rgba(255,255,255,.07)', borderRadius: 14, overflow: 'hidden', background: 'rgba(255,255,255,.015)', fontFamily: SCHRIFT.text, minWidth: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
        {WD.map((w, i) => <div key={w} style={{ padding: '8px 4px', textAlign: 'center', fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{w}{woche ? ` ${datumKurz(tage[i])}` : ''}</div>)}
      </div>
      {wochen.map(z => {
        const max = woche ? z.bahnen : MONAT_BAHNEN;
        const verdeckt = verdecktJeTag(z, max);
        const zeigen = Math.min(z.bahnen, max);
        const hoehe = Math.max(woche ? 180 : 92, KOPF_HOEHE + zeigen * BAHN_HOEHE + (verdeckt.some(Boolean) ? 20 : 6));
        return (
          <div key={z.tage[0]} style={{ position: 'relative', height: hoehe, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
            {/* Tage = Ablageflächen */}
            <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {z.tage.map((tag, i) => {
                const h = tag === heute;
                const imMonat = woche || Number(tag.slice(5, 7)) === monat;
                return (
                  <div key={tag} data-tag={tag} aria-label={datumLang(tag)}
                    onDragOver={e => { if (!zieht) return; e.preventDefault(); if (ueber !== tag) setUeber(tag); }}
                    onDragLeave={() => setUeber(u => (u === tag ? null : u))}
                    onDrop={e => { e.preventDefault(); ablegen(tag, e); }}
                    style={{ minWidth: 0, borderRight: i < 6 ? '1px solid rgba(255,255,255,.05)' : 'none', background: ueber === tag ? `${C.aktiv}1A` : h ? 'rgba(255,255,255,.035)' : undefined, opacity: imMonat ? 1 : .5, position: 'relative', transition: 'background .12s ease' }}>
                    <div style={{ height: KOPF_HOEHE, display: 'flex', alignItems: 'center', padding: '0 5px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: TYP.bedien, fontWeight: 700, background: h ? LEUCHT.puls : 'transparent', color: h ? '#0b0b0c' : C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{Number(tag.slice(8, 10))}</span>
                    </div>
                    {verdeckt[i] > 0 && (
                      <button onClick={() => { setAnker(tag); setAnsicht('woche'); }} className="fassbar" aria-label={`${verdeckt[i]} weitere am ${datumLang(tag)} — Woche zeigen`}
                        style={{ position: 'absolute', left: 4, bottom: 2, background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkLeise }}>+{verdeckt[i]}</button>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Balken darüber — beim Ziehen durchlässig, damit die Tage die Ablage bekommen. */}
            <div style={{ position: 'absolute', left: 0, right: 0, top: KOPF_HOEHE, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: BAHN_HOEHE, pointerEvents: 'none' }}>
              {z.balken.filter(b => b.bahn < max).map(balken)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const seitenliste = (
    <aside aria-label="Aufgaben ohne Datum" style={{ flex: '1 1 220px', minWidth: 0, maxWidth: '100%' }}>
      <div style={{ fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, margin: '2px 2px 8px' }}>Ohne Datum · {ohne.length}</div>
      {!ohne.length ? <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px 2px' }}>Alle Aufgaben haben eine Deadline.</div> : (
        <div style={{ display: 'grid', gap: 6, maxHeight: 520, overflowY: 'auto' }}>
          {ohne.map(t => (
            <button key={t.id} type="button" draggable onDragStart={ziehStart(t.id)} onDragEnd={ziehEnde} onClick={() => onOeffnen(t.id)} className="fassbar ui-kein-ziel" data-aufgabe={t.id}
              aria-label={`${t.title} · ohne Datum — öffnen; auf einen Tag ziehen setzt die Deadline`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', background: offenId === t.id ? 'rgba(255,255,255,.07)' : C.flaeche, border: `1px solid ${offenId === t.id ? `${C.aktiv}55` : 'rgba(255,255,255,.05)'}`, borderRadius: 10, padding: '7px 10px', cursor: 'grab', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: t.status === 'done' ? C.inkLeise : C.ink, minWidth: 0, opacity: zieht === t.id ? .4 : 1 }}>
              <Punkt farbe={farbe(t)} groesse={7} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
              {t.wiederholung && <span aria-hidden title="wiederkehrend" style={{ color: C.inkDim }}>↻</span>}
              <span aria-hidden style={{ flex: '0 0 auto' }}><Punkt farbe={prioFarbe(t.priority)} groesse={6} /></span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );

  return (
    <Karte i={2} style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setAnker(ankerSchritt(ansicht, anker, -1))} aria-label={woche ? 'Vorige Woche' : 'Voriger Monat'} className="fassbar" style={rundKnopf}><ChevronLeft size={16} /></button>
        <button onClick={() => setAnker(ankerSchritt(ansicht, anker, 1))} aria-label={woche ? 'Nächste Woche' : 'Nächster Monat'} className="fassbar" style={rundKnopf}><ChevronRight size={16} /></button>
        <button onClick={() => setAnker(heute)} className="fassbar" style={pille(false)}>Heute</button>
        <h2 aria-live="polite" style={{ margin: '0 4px', fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: C.ink }}>{kalenderTitel(ansicht, anker)}</h2>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmente liste={[{ id: 'monat', label: 'Monat' }, { id: 'woche', label: 'Woche' }]} aktiv={ansicht} onWahl={a => setAnsicht(a)} />
          <Segmente liste={[{ id: 'status', label: 'Farbe: Status' }, { id: 'liste', label: 'Liste' }]} aktiv={farbeNach} onWahl={f => setFarbeNach(f)} />
        </span>
      </div>
      {leiste}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, maxWidth: '100%' }}>
          {blatt}
          {legende.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>
              {legende.map(l => <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Punkt farbe={l.farbe} groesse={7} />{l.label}</span>)}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: LEUCHT.kritisch, fontWeight: 800 }}>!</span>überfällig</span>
              <span>↻ wiederkehrend</span>
            </div>
          )}
          {!eintraege.length && <div style={{ marginTop: 10 }}><Leer>Keine Aufgabe mit Deadline in dieser Auswahl — Aufgaben aus „Ohne Datum“ auf einen Tag ziehen oder öffnen und „Datum setzen …“.</Leer></div>}
        </div>
        {seitenliste}
      </div>
    </Karte>
  );
}
