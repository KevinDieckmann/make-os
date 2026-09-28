'use client';
// ─── Projektseite (Kevin 28.09. ~22:20: „die zweite Ebene komplett ausbauen“) ─
// Kopf: Titel, Status, Zeitraum, Mitglieder, Beschreibung, Fortschritt (offen/erledigt, überfällig, heute, blockiert,
// nächste Deadline, wer wie viel hat). Reiter (Adresse `t`): Aufgaben (Gruppen → Listen → Aufgaben → Unteraufgaben,
// Fokus auf Gruppe/Liste über die Brotkrumen) · Notizen · Dateien (Paket C2) · Felder · Verlauf (aller Aufgaben).
// „Sonstige“ ist virtuell (nie gespeichert) — dort gibt es nur die Aufgaben.

import { useEffect, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Karte, Segmente, Punkt, feld } from '../schlank';
import { Wahl, WahlMehrfach, type WahlEintrag } from '../crm/Wahl';
import { istSonstigeProjekt, type AufgabenSpace, type BaumProjekt } from '@/lib/aufgaben/struktur';
import { projektStand } from '@/lib/aufgaben/uebersicht';
import { PROJEKT_REITER, type AufgabenAdresse, type ProjektReiter } from '@/lib/aufgaben/adresse';
import { AUFGABEN_GRENZEN } from '@/lib/aufgaben/saeubern';
import type { Project, ProjektStatus, TasksState } from '@/types/tasks';
import type { AufgabenAktion } from '@/context/TasksContext';
import { BaumAnsicht, leiseKnopf } from './BaumAnsicht';
import { NotizEditor } from './Notiz';
import { ProjektDateien } from './ProjektDateien';
import { FelderVerwalten } from './EigeneFelder';
import { VerlaufListe } from './VerlaufListe';
import { ownerLabel, tagKurz, type Person } from './hilfe';

type Gehe = (z: Partial<AufgabenAdresse>) => void;
const STATUS: WahlEintrag<ProjektStatus>[] = [
  { id: 'aktiv', label: 'Aktiv', punkt: LEUCHT.gut }, { id: 'pausiert', label: 'Pausiert', punkt: LEUCHT.achtung }, { id: 'abgeschlossen', label: 'Abgeschlossen', punkt: C.inkLeise },
];
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };
const datumFeld: CSSProperties = { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, color: C.ink, fontFamily: SCHRIFT.text, fontSize: 12.5, padding: '4px 10px', minHeight: 30, colorScheme: 'dark' };

function Kennzahl({ wert, label, farbe }: { wert: ReactNode; label: string; farbe?: string }) {
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 72 }}>
      <span style={{ fontFamily: SCHRIFT.display, fontSize: 20, fontWeight: 700, color: farbe ?? C.ink, fontVariantNumeric: 'tabular-nums' }}>{wert}</span>
      <span style={mikro}>{label}</span>
    </div>
  );
}

export function ProjektSeite({ projektId, baumProjekt, state, dispatch, space, adresse, gehe, breit, personen, heute, offenId, onOeffnen }: {
  projektId: string;
  /** Der Baum dieses Projekts (gefiltert wie die Seite). */
  baumProjekt?: BaumProjekt;
  state: TasksState;
  dispatch: Dispatch<AufgabenAktion>;
  space: AufgabenSpace;
  adresse: AufgabenAdresse;
  gehe: Gehe;
  breit: boolean;
  personen: readonly Person[];
  heute: string;
  offenId: string | null;
  onOeffnen: (id: string | null) => void;
}) {
  const virtuell = istSonstigeProjekt(projektId);
  const p = state.projects.find(x => x.id === projektId);
  const reiter: ProjektReiter = virtuell ? 'aufgaben' : adresse.t ?? 'aufgaben';
  const stand = projektStand(state, { id: projektId, title: p?.title ?? 'Sonstige', color: p?.color ?? '#6E7A7D' }, heute);
  const aendern = (teil: Partial<Project>) => dispatch({ type: 'UPDATE_PROJECT', payload: { ...teil, id: projektId } });
  const [beschreibung, setBeschreibung] = useState(p?.beschreibung ?? '');
  useEffect(() => { setBeschreibung(p?.beschreibung ?? ''); }, [p?.beschreibung]);
  const offeneJe = new Map<string, number>();
  for (const t of state.tasks) if (t.projectId === projektId && t.status !== 'done') for (const w of t.assignee === 'both' ? personen.map(x => x.speicher) : [t.assignee]) offeneJe.set(w, (offeneJe.get(w) ?? 0) + 1);
  const anteil = stand.gesamt ? Math.round((stand.fertig / stand.gesamt) * 100) : 0;
  const verlauf = state.tasks.filter(t => t.projectId === projektId).flatMap(t => (t.verlauf ?? []).map(v => ({ ...v, aufgabe: { id: t.id, title: t.title } }))).sort((a, b) => a.am.localeCompare(b.am));
  const farbe = p?.color ?? space.farbe;

  return (
    <>
      <Karte i={1} akzent={farbe}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Punkt farbe={farbe} groesse={11} />
          {virtuell || !p
            ? <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel + 2, fontWeight: 700, color: C.ink }}>{virtuell ? 'Sonstige' : 'Projekt nicht gefunden'}</span>
            : <input key={p.id + p.title} defaultValue={p.title} aria-label="Projekttitel" onBlur={e => { const v = e.target.value.replace(/\s+/g, ' ').trim().slice(0, 120); if (v && v !== p.title) aendern({ title: v }); else e.target.value = p.title; }}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{ ...feld, flex: 1, minWidth: 180, width: 'auto', background: 'transparent', border: '1px solid transparent', padding: '4px 6px', fontFamily: SCHRIFT.display, fontSize: TYP.titel + 2, fontWeight: 700 }} />}
          {p && !virtuell && <Wahl klein label="Status" liste={STATUS} wert={p.status ?? 'aktiv'} farbe={STATUS.find(s => s.id === (p.status ?? 'aktiv'))?.punkt} onWahl={s => aendern({ status: s === 'aktiv' ? undefined : s })} />}
        </div>
        {p && !virtuell && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}>Start
              <input type="date" value={p.start ?? ''} onChange={e => aendern({ start: e.target.value || undefined })} style={datumFeld} aria-label="Projektstart" /></label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}>Ende
              <input type="date" value={p.ende ?? ''} min={p.start} onChange={e => aendern({ ende: e.target.value || undefined })} style={datumFeld} aria-label="Projektende" /></label>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}>Mitglieder
              <WahlMehrfach klein label="Mitglieder" liste={personen.map(x => ({ id: x.speicher, label: x.name }))} wert={p.mitglieder ?? []} onWahl={m => aendern({ mitglieder: m.length ? m : undefined })} leer="+ Person" /></span>
          </div>
        )}
        {p && !virtuell && (
          <textarea value={beschreibung} onChange={e => setBeschreibung(e.target.value)} rows={2} aria-label="Beschreibung" placeholder="Worum geht es in diesem Projekt?"
            onBlur={() => { const v = beschreibung.trim(); if (v !== (p.beschreibung ?? '') && v.length <= AUFGABEN_GRENZEN.beschreibung) aendern({ beschreibung: v || undefined }); }}
            style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, resize: 'vertical', marginTop: 10, minHeight: 44 }} />
        )}
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <div style={{ flex: '1 1 200px', minWidth: 160 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkLeise, marginBottom: 5 }}><span>Fortschritt</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{stand.fertig}/{stand.gesamt} · {anteil} %</span></div>
            <div style={{ height: 7, borderRadius: 5, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${anteil}%`, background: TIEF.verlauf(LEUCHT.gut), transition: 'width .3s ease' }} /></div>
          </div>
          <Kennzahl wert={stand.offen} label="offen" />
          <Kennzahl wert={stand.ueberfaellig} label="überfällig" farbe={stand.ueberfaellig ? LEUCHT.kritisch : C.inkLeise} />
          <Kennzahl wert={stand.heute} label="heute" farbe={stand.heute ? LEUCHT.achtung : C.inkLeise} />
          {stand.blockiert > 0 && <Kennzahl wert={stand.blockiert} label="wartet" farbe={LEUCHT.achtung} />}
          {stand.naechste && <Kennzahl wert={tagKurz(stand.naechste)} label="nächste Deadline" />}
        </div>
        {offeneJe.size > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, fontSize: 12.5, color: C.inkDim }}>
            <span style={mikro}>Verantwortlich</span>
            {Array.from(offeneJe.entries()).sort((a, b) => b[1] - a[1]).map(([w, n]) => <span key={w}>{ownerLabel(w, personen)} <b style={{ color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{n}</b></span>)}
          </div>
        )}
        {p && !virtuell && (
          <div style={{ display: 'flex', gap: 4, marginTop: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button onClick={() => aendern({ archived: !p.archived })} style={leiseKnopf}>{p.archived ? 'Aus dem Archiv holen' : 'Archivieren'}</button>
            <button onClick={() => { if (window.confirm(`Projekt „${p.title}“ löschen? Die Aufgaben bleiben — sie stehen danach unter „Sonstige“.`)) { dispatch({ type: 'DELETE_PROJECT', payload: { id: p.id } }); gehe({ ansicht: 'space', s: space.id }); } }} style={leiseKnopf}>Löschen</button>
          </div>
        )}
      </Karte>

      {!virtuell && (
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none', margin: '4px 0 12px' }}>
          <Segmente liste={PROJEKT_REITER} aktiv={reiter} onWahl={t => gehe({ ansicht: 'space', s: space.id, p: projektId, t, ...(adresse.g ? { g: adresse.g } : {}), ...(adresse.l ? { l: adresse.l } : {}) })} />
        </div>
      )}

      {reiter === 'aufgaben' && (baumProjekt
        ? <BaumAnsicht projekte={[baumProjekt]} state={state} dispatch={dispatch} raumId={space.id} offenId={offenId} onOeffnen={onOeffnen} breit={breit} personen={personen} heute={heute} fokus={{ g: adresse.g, l: adresse.l }} projektKopf={false} />
        : <Karte i={2}><div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Nichts passt zum Filter.</div></Karte>)}
      {reiter === 'notizen' && p && <Karte i={2}><NotizEditor wert={p.notiz} max={AUFGABEN_GRENZEN.notiz} onSpeichern={n => aendern({ notiz: n })} /></Karte>}
      {reiter === 'dateien' && <Karte i={2}><ProjektDateien projektId={projektId} space={space.bereich} /></Karte>}
      {reiter === 'felder' && p && <Karte i={2}><FelderVerwalten projekt={p} dispatch={dispatch} aufgaben={state.tasks.filter(t => t.projectId === projektId)} /></Karte>}
      {reiter === 'verlauf' && <Karte i={2}><VerlaufListe eintraege={verlauf} personen={personen} felder={p?.felder} aufgabe max={120} onAufgabe={id => onOeffnen(id)} /></Karte>}
    </>
  );
}
