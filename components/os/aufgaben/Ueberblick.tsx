'use client';
// ─── Aufgaben-Überblick (Kevin 28.09. ~22:30) ───────────────────────────────
// Oben vier Kacheln: meine offenen · heute fällig · überfällig · wartet auf Freigabe (Platz für ZOEs Stapel, Paket C4).
// Ein Klick auf eine Kachel zeigt ihre Aufgaben darunter. Dann je Bereich eine Karte — Privat, die Firmen
// (Selbstständigkeit · KD Ventures · MAKE OS UG), die Mandanten — mit offenen/fälligen Aufgaben und den Projekten.
// Jede Karte öffnet ihren Space, jedes Projekt seine Projektseite. Rechnung rein in lib/aufgaben/uebersicht.ts.

import { useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT, TIEF } from '@/lib/make-one/design';
import { Karte, Leer, Punkt, Haken, prioFarbe } from '../schlank';
import { kachelAufgaben, spaceStaende, type KachelArt, type SpaceStand } from '@/lib/aufgaben/uebersicht';
import { zoeAufgaben } from '@/lib/aufgaben/zoe';
import type { AufgabenSpace } from '@/lib/aufgaben/struktur';
import type { AufgabenAdresse } from '@/lib/aufgaben/adresse';
import type { Task, TasksState } from '@/types/tasks';
import type { Dispatch } from 'react';
import type { AufgabenAktion } from '@/context/TasksContext';
import { tagKurz, spaceLabel, projektTitel } from './hilfe';
import { Papierkorb } from './Papierkorb';

type Gehe = (z: Partial<AufgabenAdresse>) => void;
const KACHELN: { id: KachelArt; label: string; farbe: string; leer: string }[] = [
  { id: 'meine', label: 'Meine offenen', farbe: C.aktiv, leer: 'Nichts offen für dich.' },
  { id: 'heute', label: 'Heute fällig', farbe: LEUCHT.achtung, leer: 'Heute ist nichts fällig.' },
  { id: 'ueberfaellig', label: 'Überfällig', farbe: LEUCHT.kritisch, leer: 'Nichts überfällig.' },
  { id: 'freigabe', label: 'Wartet auf Freigabe', farbe: LEUCHT.agenten, leer: 'Nichts wartet — hier legt ZOE ab, was sie für euch vorbereitet hat.' },
];
const mikro: CSSProperties = { fontFamily: SCHRIFT.text, fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise };

function Zahlen({ s }: { s: SpaceStand }) {
  return (
    <span style={{ display: 'inline-flex', gap: 12, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>
      <span><b style={{ color: C.ink, fontFamily: SCHRIFT.display, fontSize: 18 }}>{s.offen}</b> offen</span>
      {s.heute > 0 && <span style={{ color: LEUCHT.achtung }}>{s.heute} heute</span>}
      {s.ueberfaellig > 0 && <span style={{ color: LEUCHT.kritisch }}>{s.ueberfaellig} überfällig</span>}
    </span>
  );
}

function SpaceKarte({ s, i, gehe }: { s: SpaceStand; i: number; gehe: Gehe }) {
  const projekte = s.projekte.slice(0, 5);
  return (
    <Karte i={i} akzent={s.space.farbe}>
      <button onClick={() => gehe({ ansicht: 'space', s: s.space.id })} className="fassbar" style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', marginBottom: 10 }}>
        <Punkt farbe={s.space.farbe} groesse={10} />
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 17, fontWeight: 700, color: C.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.space.label}</span>
        <span style={{ color: C.aktiv, fontSize: 12.5 }}>öffnen ›</span>
      </button>
      <Zahlen s={s} />
      <div style={{ marginTop: 10, display: 'grid' }}>
        {projekte.map(p => (
          <button key={p.id} onClick={() => gehe({ ansicht: 'space', s: s.space.id, p: p.id })} className="fassbar" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,.05)', padding: '7px 0', cursor: 'pointer', textAlign: 'left', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>
            <Punkt farbe={p.farbe} groesse={7} />
            <span style={{ color: C.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titel}</span>
            {p.gesamt > 0 && <span aria-hidden style={{ width: 42, height: 4, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden', flex: '0 0 auto' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((p.fertig / p.gesamt) * 100)}%`, background: TIEF.verlauf(LEUCHT.gut) }} /></span>}
            <span style={{ color: p.ueberfaellig ? LEUCHT.kritisch : C.inkLeise, fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 54, textAlign: 'right' }}>{p.ueberfaellig ? `${p.ueberfaellig} überf.` : `${p.offen} offen`}</span>
          </button>
        ))}
        {!s.projekte.length && <span style={{ fontSize: 12.5, color: C.inkLeise, paddingTop: 4 }}>Noch kein Projekt.</span>}
        {s.projekte.length > projekte.length && <button onClick={() => gehe({ ansicht: 'space', s: s.space.id })} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, textAlign: 'left', padding: '6px 0', fontFamily: SCHRIFT.text }}>+ {s.projekte.length - projekte.length} weitere Projekte ›</button>}
      </div>
    </Karte>
  );
}

export function AufgabenUeberblick({ state, dispatch, spaces, ich, heute, gehe, nur }: {
  state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaces: readonly AufgabenSpace[]; ich: string; heute: string; gehe: Gehe;
  /** Seitenleiste „Business“: nur Firmen und Mandanten. */
  nur?: 'privat' | 'business';
}) {
  const [kachel, setKachel] = useState<KachelArt | null>(null);
  const aktiveSpaces = spaces.filter(s => !s.archiv && (!nur || s.bereich === nur));
  const ids = new Set(aktiveSpaces.map(s => s.id));
  const tasks = useMemo(() => state.tasks.filter(t => ids.has(t.spaceId ?? '')), [state.tasks, ids.size]); // eslint-disable-line react-hooks/exhaustive-deps
  const staende = useMemo(() => spaceStaende(state, aktiveSpaces, heute), [state, aktiveSpaces.length, heute]); // eslint-disable-line react-hooks/exhaustive-deps
  // „Wartet auf Freigabe“ = ZOEs Stapel (Paket C4, `zoeAufgaben(state).wartet`) — ein Klick öffnet die Sicht „ZOE“.
  const zahl = (k: KachelArt) => (k === 'freigabe' ? zoeAufgaben({ tasks }).wartet.length : kachelAufgaben(tasks, k, ich, heute).length);
  const liste = kachel ? kachelAufgaben(tasks, kachel, ich, heute) : [];
  const gruppe = (art: AufgabenSpace['art']) => staende.filter(s => s.space.art === art);
  const zeile = (t: Task) => (
    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />
      <button onClick={() => gehe({ ansicht: 'space', s: t.spaceId, a: t.id })} className="fassbar" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', display: 'grid', gap: 1, fontFamily: SCHRIFT.text }}>
        <span style={{ color: C.ink, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
        <span style={{ color: C.inkLeise, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{spaceLabel(spaces, t.spaceId)} › {projektTitel(state, t.projectId)}</span>
      </button>
      {t.dueDate && <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: t.dueDate < heute ? LEUCHT.kritisch : t.dueDate === heute ? LEUCHT.achtung : C.inkLeise }}>{tagKurz(t.dueDate)}</span>}
    </div>
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
        {KACHELN.map((k, i) => {
          const an = kachel === k.id;
          const n = zahl(k.id);
          return (
            <button key={k.id} onClick={() => (k.id === 'freigabe' ? gehe({ ansicht: 'ueberblick', darstellung: 'zoe' }) : setKachel(an ? null : k.id))} aria-pressed={an} className="karte os-auf fassbar"
              style={{ ['--i' as string]: i, textAlign: 'left', cursor: 'pointer', padding: '14px 16px', border: `1px solid ${an ? `${k.farbe}88` : 'rgba(255,255,255,.06)'}`, background: an ? TIEF.flaeche(k.farbe) : undefined, fontFamily: SCHRIFT.text }}>
              <div style={mikro}>{k.label}</div>
              <div style={{ fontFamily: SCHRIFT.display, fontSize: TYP.zahl, fontWeight: 700, color: n ? k.farbe : C.inkLeise, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{n}</div>
            </button>
          );
        })}
      </div>
      {kachel && (
        <Karte i={1}>
          <div style={{ ...mikro, marginBottom: 6 }}>{KACHELN.find(k => k.id === kachel)!.label}</div>
          {liste.slice(0, 30).map(zeile)}
          {liste.length > 30 && <div style={{ fontSize: 12, color: C.inkLeise, paddingTop: 6 }}>… und {liste.length - 30} weitere.</div>}
          {!liste.length && <Leer>{KACHELN.find(k => k.id === kachel)!.leer}</Leer>}
        </Karte>
      )}
      {(['privat', 'firma', 'mandant'] as const).map(art => {
        const l = gruppe(art);
        if (!l.length && art !== 'mandant') return null;
        if (art === 'mandant' && nur === 'privat') return null;
        return (
          <section key={art} style={{ marginTop: 14 }}>
            {art !== 'privat' && <div style={{ ...mikro, margin: '0 2px 8px' }}>{art === 'firma' ? 'Firmen' : 'Mandanten'}</div>}
            {l.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
                {l.map((s, i) => <SpaceKarte key={s.space.id} s={s} i={i + 2} gehe={gehe} />)}
              </div>
            ) : <Karte i={2}><Leer>Kein aktives Mandat — jede CRM-Firma mit aktivem Mandat bekommt hier automatisch einen Space.</Leer></Karte>}
          </section>
        );
      })}
    </>
  );
}

/** Archiv: beendete Mandanten (Aufgaben bleiben lesbar) und archivierte/abgeschlossene Projekte. */
export function AufgabenArchiv({ state, dispatch, spaces, heute, gehe }: { state: TasksState; dispatch: Dispatch<AufgabenAktion>; spaces: readonly AufgabenSpace[]; heute: string; gehe: Gehe }) {
  const archiv = spaces.filter(s => s.archiv);
  const staende = spaceStaende(state, archiv, heute);
  const projekte = state.projects.filter(p => p.archived || p.status === 'abgeschlossen').sort((a, b) => a.title.localeCompare(b.title, 'de'));
  return (
    <>
      <div style={{ ...mikro, margin: '0 2px 8px' }}>Mandanten ohne aktives Mandat</div>
      {staende.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
          {staende.map((s, i) => <SpaceKarte key={s.space.id} s={s} i={i + 1} gehe={gehe} />)}
        </div>
      ) : <Karte i={1}><Leer>Kein Mandant im Archiv.</Leer></Karte>}
      <div style={{ ...mikro, margin: '18px 2px 8px' }}>Abgeschlossene und archivierte Projekte</div>
      <Karte i={2}>
        {projekte.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', flexWrap: 'wrap' }}>
            <Punkt farbe={p.color} />
            <button onClick={() => gehe({ ansicht: 'space', s: p.spaceId, p: p.id })} className="fassbar" style={{ background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 14, padding: 0, textAlign: 'left' }}>{p.title}</button>
            <span style={{ fontSize: 12, color: C.inkLeise }}>{spaceLabel(spaces, p.spaceId)} · {p.archived ? 'archiviert' : 'abgeschlossen'}</span>
            <button onClick={() => dispatch({ type: 'UPDATE_PROJECT', payload: { id: p.id, archived: false, status: 'aktiv' } })} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5 }}>wieder aktiv</button>
          </div>
        ))}
        {!projekte.length && <Leer>Kein Projekt im Archiv.</Leer>}
      </Karte>
      <Papierkorb spaces={spaces} />
    </>
  );
}
