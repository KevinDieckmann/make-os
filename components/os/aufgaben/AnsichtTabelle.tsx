'use client';
// ─── Aufgaben als Tabelle (28.09. spät, Paket C5 — Kevin: „Spalten sortierbar“) ─
// Zeilen = Aufgaben des aktuellen Kontexts (Space/Projekt/Filter wie in der Liste), Unteraufgaben aufklappbar und
// eingerückt. Spalten: Aufgabe, Status, Zuständig, Deadline, Priorität, Liste/Gruppe, CRM-Bezug, Wartet auf und die
// eigenen Felder der Projekte (typgerecht, Betrag aus Cent). Spalten ein-/ausblenden und die Sortierung merkt sich
// der Browser je Person (localStorage, still bei Fehlern). Kopfklick sortiert (auf → ab → wie die Liste).
// Status/Zuständig/Deadline/Priorität/Felder sind direkt änderbar — jede Änderung ist eine Einzeländerung über den
// Aufgaben-Kontext (Stand/409; den Hinweis bei Konflikt zeigt die Aufgaben-Seite). Summenzeile für Zahl/Betrag.
// Am Handy scrollt die Tabelle im eigenen Behälter quer, die Seite nicht; die Aufgaben-Spalte bleibt stehen.
// Rechnen (Spalten, Sortierung, Summen, Werte) rein in lib/aufgaben/ansichten.ts.
// Paket T2 (29.09.): Datumsfelder speichern beim Verlassen (#65), kein „Beide“ mehr, 🔒/abgebrochen/Priorität als Zeichen,
// Status über den HandlungProvider (Rückfrage + „Rückgängig“), „wartet“ über eine Karte je Render, ab 200 Zeilen in Stücken.

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { ChevronRight, Columns3, Repeat } from 'lucide-react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Leer, Punkt, prioFarbe } from '../ui';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { baum, statusListe, statusVon } from '@/lib/aufgaben/struktur';
import { bezugName, bezugLink, BEZUG_ARTEN, BEZUG_LABEL } from '@/lib/aufgaben/crm-verweise';
import {
  tabellenSpalten, tabelleZeilen, nachVorgabe, naechsteSortierung, summen, merkerLesen, feldWertVon, feldText, felderMit,
  betragText, zahlText, betragLesen, zahlLesen, istUeberfaellig, istTag, PRIORITAETEN,
  type SpalteDef, type Sortierung, type SortKontext,
} from '@/lib/aufgaben/ansichten';
import type { FeldWert, Task, TasksState } from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import type { AufgabenAktion } from '@/context/TasksContext';
import { useCrmVerweise, ownerLabel, projektTitel, type Person } from './hilfe';
import { useHandlung } from './Handlung';
import { DatumFeld } from './DatumFeld';
import { NurIchZeichen, PrioZeichen, titelStil } from './Zeichen';
import { FENSTER_ZEILEN } from './BaumAnsicht';

const MERKER = 'make-aufgaben-tabelle';
const lies = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const merke = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

const kopfStil: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, textAlign: 'left', padding: '8px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,.08)', background: C.flaeche };
const zelle: CSSProperties = { padding: '5px 8px', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien, color: C.inkDim, verticalAlign: 'middle', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const eingabe: CSSProperties = { background: 'transparent', border: '1px solid transparent', borderRadius: 8, color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '4px 6px', width: '100%', minHeight: 28, colorScheme: 'dark' };
const leiseKnopf: CSSProperties = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '4px 6px' };
const PRIO_WAHL: WahlEintrag<Priority>[] = PRIORITAETEN.map(p => ({ id: p.id, label: p.label, punkt: p.farbe }));

/** Text/Zahl/Betrag/Link: eine Eingabe, die erst beim Verlassen (oder Enter) speichert; Escape verwirft. */
function TextZelle({ wert, anzeige, typ, label, onSpeichern }: { wert: string; anzeige: string; typ: 'text' | 'zahl' | 'betrag' | 'link'; label: string; onSpeichern: (text: string) => boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  const bearbeitet = text !== null;
  const fertig = () => {
    if (text === null) return;
    if (text.trim() === wert.trim()) { setText(null); setFehler(false); return; }
    if (onSpeichern(text)) { setText(null); setFehler(false); } else setFehler(true);
  };
  return (
    <input value={bearbeitet ? text : anzeige} aria-label={label} aria-invalid={fehler || undefined} inputMode={typ === 'zahl' || typ === 'betrag' ? 'decimal' : undefined}
      title={fehler ? (typ === 'link' ? 'Nur Links mit https:// oder /os/…' : 'Keine gültige Zahl — nicht gespeichert') : undefined}
      onFocus={() => { if (!bearbeitet) setText(wert); }}
      onChange={e => { setText(e.target.value); setFehler(false); }}
      onBlur={fertig}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setText(null); setFehler(false); (e.target as HTMLInputElement).blur(); } }}
      style={{ ...eingabe, textAlign: typ === 'zahl' || typ === 'betrag' ? 'right' : 'left', fontVariantNumeric: 'tabular-nums', ...(fehler ? { borderColor: `${LEUCHT.kritisch}99` } : {}) }} />
  );
}

const LINK = /^(https?:\/\/[^\s<>"']+|\/os\/[^\s<>"']*)$/i;

/** Eine Zelle eines eigenen Feldes — typgerecht anzeigen und ändern. Aufgaben anderer Projekte: leer. */
function FeldZelle({ t, s, personen, setzen }: { t: Task; s: SpalteDef; personen: readonly Person[]; setzen: (wert: FeldWert | null) => void }) {
  const f = s.feld;
  if (!f || t.projectId !== s.projektId) return <span aria-hidden style={{ color: 'rgba(255,255,255,.12)' }}>·</span>;
  const w = feldWertVon(t, s);
  const label = `${f.name} von „${t.title}“`;
  switch (f.typ) {
    case 'auswahl':
      return <Wahl klein label={f.name} leer="–" liste={(f.optionen ?? []).map(o => ({ id: o, label: o }))} wert={typeof w === 'string' ? w : null} onWahl={v => setzen(v)} onLeeren={() => setzen(null)} leerenLabel="leeren" />;
    case 'person':
      return <Wahl klein label={f.name} leer="–" liste={personen.map(p => ({ id: p.speicher, label: p.name }))} wert={typeof w === 'string' ? w : null} onWahl={v => setzen(v)} onLeeren={() => setzen(null)} leerenLabel="leeren" />;
    case 'datum':
      return <DatumFeld wert={typeof w === 'string' ? w : undefined} label={label} onWert={d => setzen(d ?? null)} style={eingabe} />;
    case 'betrag':
      return <TextZelle typ="betrag" label={label} wert={typeof w === 'number' ? (w / 100).toFixed(2).replace('.', ',') : ''} anzeige={typeof w === 'number' ? betragText(w) : ''}
        onSpeichern={x => { const c = betragLesen(x); if (c !== null && !Number.isFinite(c)) return false; setzen(c); return true; }} />;
    case 'zahl':
      return <TextZelle typ="zahl" label={label} wert={typeof w === 'number' ? String(w).replace('.', ',') : ''} anzeige={typeof w === 'number' ? zahlText(w) : ''}
        onSpeichern={x => { const n = zahlLesen(x); if (n !== null && !Number.isFinite(n)) return false; setzen(n); return true; }} />;
    case 'link':
      return <TextZelle typ="link" label={label} wert={w === undefined ? '' : String(w)} anzeige={w === undefined ? '' : String(w)}
        onSpeichern={x => { const v = x.trim(); if (v && !LINK.test(v)) return false; setzen(v || null); return true; }} />;
    default:
      return <TextZelle typ="text" label={label} wert={w === undefined ? '' : String(w)} anzeige={feldText(f, w)} onSpeichern={x => { setzen(x.trim() ? x.trim().slice(0, 2000) : null); return true; }} />;
  }
}

export function AnsichtTabelle({ state, dispatch, spaceId, aufgaben, personen, heute, ich, offenId, onOeffnen }: {
  state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaceId: string; aufgaben: Task[]; personen: readonly Person[]; heute: string; ich: string; offenId: string | null; onOeffnen: (id: string) => void;
}) {
  const eigene = state.statusEigen ?? [];
  const merker = `${MERKER}:${ich || 'gast'}`;
  const [aus, setAus] = useState<Set<string>>(new Set());
  const [sort, setSortRoh] = useState<Sortierung | null>(null);
  const [auf, setAuf] = useState<Set<string>>(new Set());
  const [waehler, setWaehler] = useState(false);
  useEffect(() => { const m = merkerLesen(lies(merker)); setAus(new Set(m.aus)); setSortRoh(m.sort); }, [merker]);
  const speichern = (a: Set<string>, s: Sortierung | null) => merke(merker, JSON.stringify({ aus: Array.from(a), sort: s }));
  const setSort = (s: Sortierung | null) => { setSortRoh(s); speichern(aus, s); };
  const umschalten = (id: string) => { const n = new Set(aus); if (n.has(id)) n.delete(id); else n.add(id); setAus(n); speichern(n, sort); };

  const spalten = useMemo(() => tabellenSpalten(state, aufgaben), [state, aufgaben]);
  const sichtbar = spalten.filter(s => s.immer || !aus.has(s.id));
  const verweise = useCrmVerweise(sichtbar.some(s => s.id === 'crm'));
  const aendern = (t: Task, teil: Partial<Task>) => dispatch({ type: 'UPDATE_TASK', payload: { id: t.id, ...teil } });
  const handlung = useHandlung(dispatch, state.statusEigen);
  const [grenze, setGrenze] = useState(FENSTER_ZEILEN);
  // Einmal je Render (#84) statt je Zeile eine Karte zu bauen.
  const nachId = useMemo(() => new Map(state.tasks.map(x => [x.id, x])), [state.tasks]);
  const wartetAuf = (t: Task): Task[] => (t.abhaengigVon ?? []).map(id => nachId.get(id)).filter((x): x is Task => !!x && x.status !== 'done');

  // ── Namen und Ränge für Anzeige und Sortierung ──
  const projekteImKontext = useMemo(() => new Set(aufgaben.map(t => t.projectId)), [aufgaben]);
  const ortText = (t: Task): string => {
    const l = t.listeId ? (state.listen ?? []).find(x => x.id === t.listeId) : undefined;
    const g = l?.gruppeId ? (state.gruppen ?? []).find(x => x.id === l.gruppeId) : undefined;
    return [projekteImKontext.size > 1 ? projektTitel(state, t.projectId) : null, g?.titel, l?.titel ?? 'Sonstige'].filter(Boolean).join(' › ');
  };
  const crmTeile = (t: Task) => BEZUG_ARTEN.filter(a => t.bezug?.[a]).map(a => ({ art: a, id: t.bezug![a]!, name: bezugName(verweise, a, t.bezug![a]!) ?? BEZUG_LABEL[a] }));
  const kontext: SortKontext = {
    statusRang: t => { const l = statusListe(t.spaceId, eigene); const i = l.findIndex(s => s.id === statusVon(t, eigene).id); return i < 0 ? l.length : i; },
    person: o => ownerLabel(o, personen),
    ort: ortText,
    crm: t => crmTeile(t)[0]?.name ?? '',
    wartet: t => wartetAuf(t).length,
    spalten,
  };

  // Vorgabe-Reihenfolge = die der Liste (Projekte → Listen → Aufgaben → Unteraufgaben).
  const reihe = useMemo(() => {
    const ids: string[] = [];
    for (const p of baum(state, spaceId)) for (const l of p.listen) for (const a of l.aufgaben) { ids.push(a.task.id); for (const u of a.unter) ids.push(u.id); }
    return ids;
  }, [state, spaceId]);
  const geordnet = useMemo(() => nachVorgabe(aufgaben, reihe), [aufgaben, reihe]);
  const zeilen = tabelleZeilen(geordnet, sort, kontext, auf);
  const sum = summen(aufgaben, sichtbar);
  const breite = sichtbar.reduce((s, x) => s + x.breite, 0);

  const kopf = (s: SpalteDef, i: number) => {
    const an = sort?.spalte === s.id;
    const pfeil = an ? (sort!.richtung === 'auf' ? '▲' : '▼') : '';
    return (
      <th key={s.id} scope="col" aria-sort={an ? (sort!.richtung === 'auf' ? 'ascending' : 'descending') : 'none'}
        style={{ ...kopfStil, width: s.breite, ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 2 } : {}) }}>
        <button onClick={() => setSort(naechsteSortierung(sort, s.id))} className="fassbar" title={s.projektTitel ? `Eigenes Feld im Projekt ${s.projektTitel} — sortieren` : 'Sortieren'}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: an ? C.aktiv : 'inherit', display: 'inline-flex', gap: 5, alignItems: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>{pfeil && <span aria-hidden style={{ fontSize: TYP.bedien }}>{pfeil}</span>}
        </button>
      </th>
    );
  };

  const inhalt = (t: Task, s: SpalteDef, tiefe: number, unter: number): ReactNode => {
    switch (s.id) {
      case 'titel': {
        const offen = auf.has(t.id);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: tiefe * 22, minWidth: 0 }}>
            {unter > 0 ? (
              <button onClick={() => setAuf(a => { const n = new Set(a); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} aria-expanded={offen}
                aria-label={offen ? `Unteraufgaben von „${t.title}“ zuklappen` : `${unter} Unteraufgaben von „${t.title}“ aufklappen`} className="fassbar"
                style={{ width: 22, height: 22, display: 'grid', placeItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: C.inkDim, padding: 0, flex: '0 0 auto' }}>
                <ChevronRight size={14} style={{ transform: offen ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease' }} />
              </button>
            ) : <span style={{ width: 22, flex: '0 0 auto' }} />}
            <Punkt farbe={prioFarbe(t.priority)} groesse={7} />
            <PrioZeichen p={t.priority} />
            <button id={`oeffnen-${t.id}`} onClick={() => onOeffnen(t.id)} className="fassbar" title={t.title}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: tiefe ? 12.5 : 13.5, fontWeight: tiefe ? 500 : 600, ...titelStil(t), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</button>
            {t.sichtbarkeit === 'nur-ich' && <NurIchZeichen />}
            {t.wiederholung && <span title="wiederkehrend" aria-label="wiederkehrend" style={{ color: C.inkLeise, display: 'inline-flex' }}><Repeat size={12} /></span>}
            {unter > 0 && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{unter}</span>}
          </span>
        );
      }
      case 'status': {
        const st = statusVon(t, eigene);
        return <Wahl klein label="Status" liste={statusListe(t.spaceId, eigene).map(x => ({ id: x.id, label: x.label, punkt: x.farbe }))} wert={st.id} farbe={st.farbe} onWahl={id => handlung.statusSetzen(t, id)} />;
      }
      case 'zustaendig':
        return <Wahl klein label="Zuständig" liste={[...personen.map(p => ({ id: p.speicher as Owner, label: p.name })), ...(t.assignee === 'both' ? [{ id: 'both' as Owner, label: 'Beide (alt)' }] : [])]} wert={t.assignee} onWahl={a => aendern(t, { assignee: a })} />;
      case 'deadline': {
        const rot = istUeberfaellig(t, heute);
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }} title={rot ? 'überfällig' : undefined}>
            {rot && <span aria-label="überfällig" style={{ color: LEUCHT.kritisch, fontWeight: 800 }}>!</span>}
            <DatumFeld wert={istTag(t.dueDate) ? t.dueDate : undefined} label={`Deadline von „${t.title}“${rot ? ' (überfällig)' : ''}`} onWert={d => handlung.verschieben(t, { dueDate: d }, d ? 'verschoben' : 'ohne Deadline')}
              style={{ ...eingabe, color: rot ? LEUCHT.kritisch : t.dueDate === heute ? LEUCHT.achtung : C.ink, fontVariantNumeric: 'tabular-nums' }} />
          </span>
        );
      }
      case 'prioritaet':
        return <Wahl klein label="Priorität" liste={PRIO_WAHL} wert={t.priority} farbe={prioFarbe(t.priority)} onWahl={p => aendern(t, { priority: p })} />;
      case 'ort':
        return <span title={ortText(t)}>{ortText(t)}</span>;
      case 'crm': {
        const b = crmTeile(t);
        if (!b.length) return <span style={{ color: C.inkLeise }}>–</span>;
        return (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
            <Link href={bezugLink(b[0].art, b[0].id)} title={`${BEZUG_LABEL[b[0].art]}: ${b[0].name}`} style={{ color: C.aktiv, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b[0].name}</Link>
            {b.length > 1 && <span title={b.slice(1).map(x => `${BEZUG_LABEL[x.art]}: ${x.name}`).join(' · ')} style={{ color: C.inkLeise }}>+{b.length - 1}</span>}
          </span>
        );
      }
      case 'wartet': {
        const w = wartetAuf(t);
        if (!w.length) return <span style={{ color: C.inkLeise }}>–</span>;
        return (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', minWidth: 0 }} title={`wartet auf: ${w.map(x => x.title).join(', ')}`}>
            <button onClick={() => onOeffnen(w[0].id)} className="fassbar" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: LEUCHT.achtung, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⧗ {w[0].title}</button>
            {w.length > 1 && <span style={{ color: C.inkLeise }}>+{w.length - 1}</span>}
          </span>
        );
      }
      default:
        return <FeldZelle t={t} s={s} personen={personen} setzen={wert => aendern(t, { felder: felderMit(t.felder, s.feld!.id, wert) })} />;
    }
  };

  const summenZeile = sichtbar.some(s => s.summe);
  return (
    <Karte i={2} style={{ padding: 0, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px 6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{aufgaben.filter(t => !t.parentId).length} Aufgaben{sort ? ' · sortiert' : ''}</span>
        {sort && <button onClick={() => setSort(null)} style={leiseKnopf}>Sortierung aufheben</button>}
        <button onClick={() => setWaehler(w => !w)} aria-expanded={waehler} className="fassbar" style={{ ...leiseKnopf, marginLeft: 'auto', display: 'inline-flex', gap: 5, alignItems: 'center', color: waehler ? C.aktiv : C.inkLeise }}>
          <Columns3 size={14} /> Spalten{aus.size ? ` (${spalten.length - sichtbar.length} aus)` : ''}
        </button>
      </div>
      {waehler && (
        <div role="group" aria-label="Spalten ein- und ausblenden" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 10px' }}>
          {spalten.filter(s => !s.immer).map(s => {
            const an = !aus.has(s.id);
            return (
              <label key={s.id} className="fassbar" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: an ? C.ink : C.inkLeise, border: `1px solid ${an ? `${C.aktiv}66` : 'rgba(255,255,255,.1)'}`, borderRadius: 999, padding: '4px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={an} onChange={() => umschalten(s.id)} style={{ accentColor: C.aktiv }} />{s.label}
              </label>
            );
          })}
        </div>
      )}
      {!aufgaben.length ? <div style={{ padding: '0 12px 12px' }}><Leer>Nichts passt zum Filter.</Leer></div> : (
        // Eigener Behälter für den Querlauf — die Seite selbst läuft nie quer (Handy).
        <div style={{ overflowX: 'auto', maxWidth: '100%', WebkitOverflowScrolling: 'touch' } as CSSProperties} role="region" aria-label="Aufgaben-Tabelle" tabIndex={0}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', width: breite, minWidth: '100%', fontFamily: SCHRIFT.text }}>
            <colgroup>{sichtbar.map(s => <col key={s.id} style={{ width: s.breite }} />)}</colgroup>
            <thead><tr>{sichtbar.map(kopf)}</tr></thead>
            <tbody>
              {zeilen.slice(0, grenze).map(({ task: t, tiefe, unter }) => (
                <tr key={t.id} data-aufgabe={t.id} style={{ background: offenId === t.id ? 'rgba(255,255,255,.05)' : undefined }}>
                  {sichtbar.map((s, i) => (
                    <td key={s.id} style={{ ...zelle, ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 1, background: offenId === t.id ? C.flaecheHoch : C.flaeche } : {}) }}>{inhalt(t, s, tiefe, unter)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            {summenZeile && (
              <tfoot>
                <tr>
                  {sichtbar.map((s, i) => (
                    <td key={s.id} style={{ ...zelle, borderBottom: 'none', borderTop: '1px solid rgba(255,255,255,.1)', color: C.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: s.summe ? 'right' : 'left', ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 1, background: C.flaeche } : {}) }}
                      title={s.summe ? `Summe über ${sum[s.id]?.anzahl ?? 0} Aufgaben mit Wert (auch Unteraufgaben)` : undefined}>
                      {i === 0 ? 'Summe' : s.summe && sum[s.id] ? (s.feld?.typ === 'betrag' ? betragText(sum[s.id].summe) : zahlText(sum[s.id].summe)) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
          {zeilen.length > grenze && (
            <button onClick={() => setGrenze(g => g + FENSTER_ZEILEN)} style={{ ...leiseKnopf, color: C.aktiv, padding: '12px', minHeight: 44 }}>
              weitere {Math.min(FENSTER_ZEILEN, zeilen.length - grenze)} von {zeilen.length - grenze} Zeilen zeigen
            </button>
          )}
        </div>
      )}
    </Karte>
  );
}
