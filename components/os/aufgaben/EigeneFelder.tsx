'use client';
// ─── Eigene Felder je Projekt (28.09. spät) ─────────────────────────────────
// Kevin: „Eigene Felder je Projekt (Text, Zahl, Betrag, Datum, Auswahl, Link, Person).“ Die Definition liegt am
// Projekt (`Project.felder`), die Werte an der Aufgabe (`Task.felder`) — der Server prüft sie typgerecht
// (lib/aufgaben/saeubern.ts `feldWerteTypisieren`; Betrag in ganzen Cent). Feld löschen lässt die Werte an den
// Aufgaben stehen (kommt das Feld wieder, sind sie da) — sie werden nur nicht mehr gezeigt.

import Link from 'next/link';
import { useEffect, useState, type CSSProperties, type Dispatch } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld } from '../schlank';
import { Wahl, type WahlEintrag } from '../crm/Wahl';
import { AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import type { EigenesFeld, FeldTyp, FeldWert, Project, Task } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { neueKennung, type Person } from './hilfe';

export const FELD_TYP_LABEL: Record<FeldTyp, string> = { text: 'Text', zahl: 'Zahl', betrag: 'Betrag (€)', datum: 'Datum', auswahl: 'Auswahl', link: 'Link', person: 'Person' };
const TYPEN: WahlEintrag<FeldTyp>[] = (Object.keys(FELD_TYP_LABEL) as FeldTyp[]).map(id => ({ id, label: FELD_TYP_LABEL[id] }));
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const klein: CSSProperties = { ...feld, fontSize: TYP.bedien, padding: '7px 10px', borderRadius: 10 };

/** Cent → „1.500,40 €“. */
export const betragText = (cent: number): string => (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
/** „1.500,40“ → 150040 Cent (null, wenn keine Zahl). */
export function centAus(text: string): number | null {
  const t = text.replace(/[€\s]/g, '');
  if (!t) return null;
  const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Ein Wert zur Anzeige (Tabelle, Zeile). */
export function feldWertText(f: EigenesFeld, w: FeldWert | undefined, personen: readonly Person[] = []): string {
  if (w === undefined || w === '') return '';
  if (f.typ === 'betrag' && typeof w === 'number') return betragText(w);
  if (f.typ === 'zahl' && typeof w === 'number') return w.toLocaleString('de-DE');
  if (f.typ === 'datum' && typeof w === 'string') return `${w.slice(8, 10)}.${w.slice(5, 7)}.${w.slice(0, 4)}`;
  if (f.typ === 'person') return personen.find(p => p.speicher === w)?.name ?? String(w);
  return String(w);
}

// ── Definitionen verwalten (Reiter „Felder“ der Projektseite) ────────────────
export function FelderVerwalten({ projekt, dispatch, aufgaben }: { projekt: Project; dispatch: Dispatch<AufgabenAktion>; aufgaben: readonly Task[] }) {
  const felder = projekt.felder ?? [];
  const [name, setName] = useState('');
  const [typ, setTyp] = useState<FeldTyp>('text');
  const [optionen, setOptionen] = useState('');
  const setze = (neu: EigenesFeld[]) => dispatch({ type: 'UPDATE_PROJECT', payload: { id: projekt.id, felder: neu.length ? neu : undefined } });
  const anlegen = () => {
    const n = name.trim().slice(0, 60);
    if (!n || felder.length >= AUFGABEN_GRENZEN.felder) return;
    const o = typ === 'auswahl' ? Array.from(new Set(optionen.split(/[,;\n]/).map(x => x.trim().slice(0, 60)).filter(Boolean))).slice(0, AUFGABEN_GRENZEN.optionen) : [];
    setze([...felder, { id: neueKennung('f'), name: n, typ, ...(o.length ? { optionen: o } : {}) }]);
    setName(''); setOptionen('');
  };
  const genutzt = (id: string) => aufgaben.filter(t => t.felder?.[id] !== undefined).length;
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {!felder.length && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Noch keine eigenen Felder. Beispiele: Budget (Betrag), Kanal (Auswahl), Ansprechpartner (Person), Link zum Entwurf.</div>}
      {felder.map((f, i) => (
        <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <input defaultValue={f.name} aria-label="Feldname" onBlur={e => { const v = e.target.value.trim().slice(0, 60); if (v && v !== f.name) setze(felder.map(x => (x.id === f.id ? { ...x, name: v } : x))); }} style={{ ...klein, width: 200, flex: '1 1 160px' }} />
          <span style={{ fontSize: 12.5, color: C.inkDim }}>{FELD_TYP_LABEL[f.typ]}</span>
          {f.typ === 'auswahl' && <input defaultValue={(f.optionen ?? []).join(', ')} aria-label="Auswahl-Werte" placeholder="Werte, mit Komma getrennt"
            onBlur={e => { const o = Array.from(new Set(e.target.value.split(/[,;\n]/).map(x => x.trim().slice(0, 60)).filter(Boolean))).slice(0, AUFGABEN_GRENZEN.optionen); setze(felder.map(x => (x.id === f.id ? { ...x, ...(o.length ? { optionen: o } : { optionen: undefined }) } : x))); }}
            style={{ ...klein, flex: '2 1 200px', width: 'auto' }} />}
          <span style={{ fontSize: 12, color: C.inkLeise }}>{genutzt(f.id) ? `an ${genutzt(f.id)} Aufgabe${genutzt(f.id) === 1 ? '' : 'n'}` : ''}</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
            <button disabled={i === 0} onClick={() => { const n = [...felder]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setze(n); }} aria-label="nach oben" className="fassbar" style={{ background: 'none', border: 'none', color: i ? C.inkDim : 'rgba(255,255,255,.15)', cursor: i ? 'pointer' : 'default' }}>↑</button>
            <button onClick={() => { if (window.confirm(`Feld „${f.name}“ entfernen? Die Werte an den Aufgaben bleiben gespeichert, werden aber nicht mehr gezeigt.`)) setze(felder.filter(x => x.id !== f.id)); }} className="fassbar" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>Entfernen</button>
          </span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }} placeholder="Neues Feld, z. B. Budget" aria-label="Neues Feld" style={{ ...klein, flex: '1 1 180px', width: 'auto' }} />
        <Wahl klein label="Typ" liste={TYPEN} wert={typ} onWahl={setTyp} />
        {typ === 'auswahl' && <input value={optionen} onChange={e => setOptionen(e.target.value)} placeholder="Werte: Messe, Web, Presse" aria-label="Auswahl-Werte" style={{ ...klein, flex: '2 1 200px', width: 'auto' }} />}
        <Knopf onClick={anlegen} aus={!name.trim() || felder.length >= AUFGABEN_GRENZEN.felder}>+ Feld</Knopf>
      </div>
    </div>
  );
}

// ── Werte an einer Aufgabe ──────────────────────────────────────────────────
function Eingabe({ f, wert, personen, setze }: { f: EigenesFeld; wert: FeldWert | undefined; personen: readonly Person[]; setze: (w: FeldWert | undefined) => void }) {
  const start = wert === undefined ? '' : f.typ === 'betrag' && typeof wert === 'number' ? (wert / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : f.typ === 'zahl' && typeof wert === 'number' ? String(wert).replace('.', ',') : String(wert);
  const [text, setText] = useState(start);
  useEffect(() => { setText(start); }, [start]);
  if (f.typ === 'auswahl') return <Wahl klein label={f.name} liste={(f.optionen ?? []).map(o => ({ id: o, label: o }))} wert={typeof wert === 'string' ? wert : null} onWahl={setze} onLeeren={() => setze(undefined)} leerenLabel="leeren" leer="+ wählen" />;
  if (f.typ === 'person') return <Wahl klein label={f.name} liste={personen.map(p => ({ id: p.speicher, label: p.name }))} wert={typeof wert === 'string' ? wert : null} onWahl={setze} onLeeren={() => setze(undefined)} leerenLabel="leeren" leer="+ wählen" />;
  if (f.typ === 'datum') return <input type="date" value={typeof wert === 'string' ? wert : ''} onChange={e => setze(e.target.value || undefined)} aria-label={f.name} style={{ ...klein, width: 'auto', colorScheme: 'dark' }} />;
  const speichern = () => {
    const v = text.trim();
    if (!v) { if (wert !== undefined) setze(undefined); return; }
    if (f.typ === 'betrag') { const c = centAus(v); if (c !== null && c !== wert) setze(c); else if (c === null) setText(start); return; }
    if (f.typ === 'zahl') { const n = Number(v.replace(/\s/g, '').replace(',', '.')); if (Number.isFinite(n) && n !== wert) setze(n); else if (!Number.isFinite(n)) setText(start); return; }
    if (v !== wert) setze(v.slice(0, AUFGABEN_GRENZEN.feldText));
  };
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}>
      <input value={text} onChange={e => setText(e.target.value)} onBlur={speichern} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} aria-label={f.name}
        inputMode={f.typ === 'zahl' || f.typ === 'betrag' ? 'decimal' : undefined} placeholder={f.typ === 'betrag' ? '0,00 €' : f.typ === 'link' ? 'https://…' : ''} style={{ ...klein, flex: 1, minWidth: 0, width: 'auto' }} />
      {f.typ === 'link' && typeof wert === 'string' && (wert.startsWith('/os/')
        ? <Link href={wert} style={{ color: C.aktiv, fontSize: 12.5, textDecoration: 'none' }}>öffnen ›</Link>
        : <a href={wert} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv, fontSize: 12.5, textDecoration: 'none' }}>öffnen ›</a>)}
    </span>
  );
}

export function FeldWerte({ task, defs, personen, aendern }: { task: Task; defs: readonly EigenesFeld[]; personen: readonly Person[]; aendern: (teil: Partial<Task>) => void }) {
  if (!defs.length) return null;
  const setze = (id: string, w: FeldWert | undefined) => {
    const n: Record<string, FeldWert> = { ...(task.felder ?? {}) };
    if (w === undefined) delete n[id]; else n[id] = w;
    aendern({ felder: Object.keys(n).length ? n : undefined });
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ ...mikro, marginBottom: 6 }}>Felder</div>
      <div style={{ display: 'grid', gap: 6 }}>
        {defs.map(f => (
          <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '120px minmax(0,1fr)', alignItems: 'center', gap: 10, minHeight: 34 }}>
            <span style={{ fontSize: 12.5, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={FELD_TYP_LABEL[f.typ]}>{f.name}</span>
            <div style={{ display: 'flex', minWidth: 0 }}><Eingabe f={f} wert={task.felder?.[f.id]} personen={personen} setze={w => setze(f.id, w)} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
