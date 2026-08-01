'use client';

// ─── MAKE OS — Kompass ──────────────────────────────────────────────────────
// Der Zustand, in dem das System läuft. Vier Ebenen: Lage → Regler → Wirkung
// → Reichweite. Siehe lib/make-one/kompass-data.ts für das Konzept.
//
// Der wichtigste Trick: Der Kompass schreibt in dieselben Speicher, die die
// übrige Software ohnehin liest (Fokus-Regler, Ordnung). Dadurch wirkt jede
// Änderung sofort überall — ohne dass eine einzige andere Seite davon weiß.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { SAEULE_VON_PROJEKT, FOKUS_SCHWELLE } from '@/lib/make-one/fokus-data';
import { THEMEN, THEMA, STANDARD_ORDNUNG, sortierteThemen, themaVon } from '@/lib/make-one/ordnung-data';
import { ORGS } from '@/lib/make-one/organisation-data';
import { STICHWORTE, stichworteVon, mitEigenen } from '@/lib/make-one/stichworte-data';
import { FAECHER } from '@/lib/make-one/inbox-data';
import { WER_LABEL, einschaetzen, dauerText } from '@/lib/make-one/umsetzung-data';
import {
  MODI, MODUS, STANDARD_MODUS, BEREICHE, REGLER, wertVon, abweichungen, stufeText,
  type ReglerId,
} from '@/lib/make-one/kompass-data';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none' };

const SAEULE_VON_REGLER: Record<string, string> = {
  'fokus-health': 'health', 'fokus-business': 'business', 'fokus-planning': 'planning',
  'fokus-finance': 'finance', 'fokus-social': 'social',
};

interface EigenerFilter {
  id: string; name: string; wo: 'aufgaben' | 'inbox';
  themen?: string[]; orgs?: string[]; prios?: string[]; stichworte?: string[]; wege?: string[]; faecher?: string[];
  besitzer?: string; suche?: string;
}
interface EigenesStichwort { id: string; label: string; thema: string; woerter: string[]; kpi?: boolean }

const PRIOS = [['critical', 'kritisch'], ['high', 'hoch'], ['medium', 'mittel'], ['low', 'niedrig']] as const;

export function KompassView() {
  const { state } = useTasks();

  // ── Lage & Regler ──
  const [modus, setModus] = useState<string>(STANDARD_MODUS);
  const [eigene, setEigene] = useState<Partial<Record<ReglerId, number>>>({});
  const [geladen, setGeladen] = useState(false);
  const [reihenfolge, setReihenfolge] = useState<string[]>(STANDARD_ORDNUNG);
  const [tiefer, setTiefer] = useState(false);

  useEffect(() => {
    fetch('/api/state/kompass').then(r => r.json()).then(d => {
      if (d.modus) setModus(d.modus);
      if (d.eigene) setEigene(d.eigene);
      setGeladen(true);
    }).catch(() => setGeladen(true));
    fetch('/api/state/ordnung').then(r => r.json()).then(d => {
      if (Array.isArray(d.reihenfolge) && d.reihenfolge.length) setReihenfolge(d.reihenfolge);
    }).catch(() => {});
  }, []);

  const wert = (id: ReglerId) => wertVon(id, modus, eigene);
  const abw = abweichungen(modus, eigene);

  /** Fokuswerte in den Speicher schreiben, den die übrige Software liest. */
  function fokusSpiegeln(werte: Partial<Record<ReglerId, number>>, basisModus: string) {
    const regler: Record<string, number> = {};
    for (const [rid, saeule] of Object.entries(SAEULE_VON_REGLER)) {
      regler[saeule] = wertVon(rid as ReglerId, basisModus, werte);
    }
    fetch('/api/state/fokus-regler', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regler }) }).catch(() => {});
  }

  function reglerSetzen(id: ReglerId, v: number) {
    const next = { ...eigene, [id]: v };
    setEigene(next);
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eigene: { [id]: v } }) }).catch(() => {});
    if (SAEULE_VON_REGLER[id]) fokusSpiegeln(next, modus);
  }

  /** Lage wechseln: setzt alle Regler, die Themen-Reihenfolge und den Fokus. */
  function lageWechseln(id: string) {
    const m = MODUS[id];
    if (!m) return;
    setModus(id);
    setEigene({});
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ modus: id }) }).catch(() => {});
    setReihenfolge(m.ordnung);
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: m.ordnung }) }).catch(() => {});
    fokusSpiegeln({}, id);
  }

  function zuruecksetzen() {
    setEigene({});
    fetch('/api/state/kompass', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zuruecksetzen: true }) }).catch(() => {});
    const m = MODUS[modus];
    if (m) {
      setReihenfolge(m.ordnung);
      fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: m.ordnung }) }).catch(() => {});
    }
    fokusSpiegeln({}, modus);
  }

  function schieben(id: string, richtung: -1 | 1) {
    const i = reihenfolge.indexOf(id), j = i + richtung;
    if (i < 0 || j < 0 || j >= reihenfolge.length) return;
    const next = [...reihenfolge];
    [next[i], next[j]] = [next[j], next[i]];
    setReihenfolge(next);
    fetch('/api/state/ordnung', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reihenfolge: next }) }).catch(() => {});
  }

  // ── Eigene Filter & Stichworte ──
  const [filter, setFilter] = useState<EigenerFilter[]>([]);
  const [eigeneSw, setEigeneSw] = useState<EigenesStichwort[]>([]);
  useEffect(() => {
    fetch('/api/state/filter').then(r => r.json()).then(d => {
      setFilter(Array.isArray(d.filter) ? d.filter : []);
      setEigeneSw(Array.isArray(d.stichworte) ? d.stichworte : []);
    }).catch(() => {});
  }, []);
  function speichern(next: { filter?: EigenerFilter[]; stichworte?: EigenesStichwort[] }) {
    if (next.filter) setFilter(next.filter);
    if (next.stichworte) setEigeneSw(next.stichworte);
    fetch('/api/state/filter', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: next.filter ?? filter, stichworte: next.stichworte ?? eigeneSw }),
    }).catch(() => {});
  }

  // ── Türsteher-Stand fürs Wirkungs-Feedback ──
  const [offeneAbsender, setOffeneAbsender] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/state/inbox-absender').then(r => r.json()).then(d => setOffeneAbsender(Object.keys(d.bekannt ?? {}).length)).catch(() => {});
  }, []);

  // ── WIRKUNG: was der Regler gerade bewirkt, in echten Zahlen ──
  const offen = useMemo(() => state.tasks.filter(t => t.status !== 'done'), [state.tasks]);
  const heute = localDay();
  const wirkung = (id: ReglerId): string => {
    const v = wert(id);
    const saeule = SAEULE_VON_REGLER[id];
    if (saeule) {
      const n = offen.filter(t => SAEULE_VON_PROJEKT[t.projectId] === saeule).length;
      if (!n) return 'gerade keine Aufgaben in dieser Säule';
      return v >= FOKUS_SCHWELLE ? `${n} Aufgaben wandern nach oben` : `${n} Aufgaben laufen normal mit`;
    }
    if (id === 'tageslast') {
      const heuteMin = offen.filter(t => t.dueDate === heute).reduce((s, t) => s + einschaetzen(t).dauer, 0);
      if (!heuteMin) return `heute nichts terminiert · Grenze ${v} h`;
      const ueber = heuteMin > v * 60;
      return `heute ${dauerText(heuteMin)} geplant — ${ueber ? `${dauerText(heuteMin - v * 60)} über der Grenze` : 'passt in die Grenze'}`;
    }
    if (id === 'kritisch-grenze') {
      const k = offen.filter(t => t.priority === 'critical').length;
      return k > v ? `${k} kritisch offen — ${k - v} über deiner Grenze` : `${k} kritisch offen — im Rahmen`;
    }
    if (id === 'vorschau-tage') {
      const bis = new Date(); bis.setDate(bis.getDate() + v);
      const grenze = localDay(bis);
      const n = offen.filter(t => t.dueDate && t.dueDate >= heute && t.dueDate <= grenze).length;
      return `${n} Aufgaben liegen in diesem Fenster`;
    }
    if (id === 'tuersteher') {
      const n = offeneAbsender;
      if (v >= 88) return n ? `nur die ${n} entschiedenen Absender kommen durch` : 'noch niemand entschieden — Postfach bleibt offen';
      if (v <= 12) return 'jeder darf rein, der Türsteher schweigt';
      return n != null ? `${n} Absender bereits entschieden` : 'Türsteher arbeitet mit';
    }
    return stufeText(v, REGLER.find(r => r.id === id)?.skala);
  };

  const themen = sortierteThemen(reihenfolge);
  const stichListe = useMemo(() => mitEigenen(eigeneSw), [eigeneSw]);
  const aktLage = MODUS[modus] ?? MODUS[STANDARD_MODUS];

  // ── Filter-Bearbeitung ──
  const [neuName, setNeuName] = useState('');
  const [offenId, setOffenId] = useState<string | null>(null);
  function filterAnlegen() {
    const name = neuName.trim();
    if (!name) return;
    const f: EigenerFilter = { id: `f-${Date.now().toString(36)}`, name, wo: 'aufgaben', themen: [], orgs: [], prios: [], stichworte: [], wege: [] };
    speichern({ filter: [...filter, f] });
    setNeuName('');
    setOffenId(f.id);
  }
  const patch = (id: string, p: Partial<EigenerFilter>) => speichern({ filter: filter.map(f => f.id === id ? { ...f, ...p } : f) });
  const kippen = (liste: string[] | undefined, w: string) =>
    (liste ?? []).includes(w) ? (liste ?? []).filter(x => x !== w) : [...(liste ?? []), w];

  /** Wie viele Aufgaben ein Filter gerade trifft — sofortiges Feedback. */
  const trefferVon = (f: EigenerFilter) => offen.filter(t => {
    if (f.themen?.length && !f.themen.includes(themaVon(t, {}))) return false;
    if (f.prios?.length && !f.prios.includes(t.priority)) return false;
    if (f.wege?.length && !f.wege.includes(einschaetzen(t).wer)) return false;
    if (f.besitzer && t.assignee !== f.besitzer) return false;
    if (f.stichworte?.length) {
      const meine = stichworteVon(t, {}, stichListe);
      if (!f.stichworte.some(s => meine.includes(s))) return false;
    }
    if (f.suche && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(f.suche.toLowerCase())) return false;
    return true;
  }).length;

  const [swLabel, setSwLabel] = useState('');
  const [swWoerter, setSwWoerter] = useState('');
  const [swThema, setSwThema] = useState('umsatz');
  function stichwortAnlegen() {
    const label = swLabel.trim();
    if (!label) return;
    const woerter = swWoerter.split(',').map(w => w.trim()).filter(Boolean);
    speichern({ stichworte: [...eigeneSw, { id: `eig-${Date.now().toString(36)}`, label, thema: swThema, woerter: woerter.length ? woerter : [label] }] });
    setSwLabel(''); setSwWoerter('');
  }

  const chip = (an: boolean, farbe: string, text: string, onClick: () => void, key: string) => (
    <button key={key} onClick={onClick} style={{
      fontFamily: T.sans, fontSize: 11.5, padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
      border: `1px solid ${an ? farbe : T.line}`, background: an ? `${farbe}1c` : 'transparent', color: an ? farbe : T.inkDim,
    }}>{text}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <div style={lbl}>Kompass</div>
        <h1 style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-.02em', margin: '6px 0 4px' }}>Woran sich alles ausrichtet.</h1>
        <p style={{ fontSize: 13.5, color: T.inkDim, maxWidth: 680, lineHeight: 1.5, marginBottom: 18 }}>
          Erst die Lage wählen — sie stellt das ganze System um. Danach einzeln nachjustieren, wenn nötig.
          Was hier steht, wirkt sofort in Aufgaben, Tag, Dashboard und Postfach.
        </p>

        {/* ── EBENE 1: DIE LAGE ── */}
        <div style={{ ...panel, borderLeft: `3px solid ${aktLage.farbe}`, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={lbl}>Lage</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: aktLage.farbe }}>
              {aktLage.label}{abw.length > 0 && <span style={{ color: T.amber, fontWeight: 500 }}>, angepasst</span>}
            </span>
            {abw.length > 0 && (
              <button onClick={zuruecksetzen} style={{ fontFamily: T.sans, fontSize: 11.5, padding: '3px 11px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${T.line}`, background: 'transparent', color: T.muted }}>
                ↺ {abw.length} Abweichung{abw.length === 1 ? '' : 'en'} zurücknehmen
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 9 }}>
            {MODI.map(m => {
              const an = m.id === modus;
              return (
                <button key={m.id} onClick={() => lageWechseln(m.id)} style={{
                  textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${an ? m.farbe : T.line}`, background: an ? `${m.farbe}16` : T.panel2,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: an ? m.farbe : T.ink, marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.45 }}>{m.satz}</div>
                </button>
              );
            })}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted, marginTop: 10 }}>
            Ein Klick stellt Fokus, Reihenfolge, Tageslast, Postfach-Strenge und Agenten-Leine gemeinsam um.
          </div>
        </div>

        {/* ── EBENE 2+3: REGLER MIT WIRKUNG ── */}
        {!geladen ? (
          <div style={{ ...panel, padding: '24px', color: T.muted, fontSize: 13 }}>lädt …</div>
        ) : BEREICHE.map(b => {
          const meine = REGLER.filter(r => r.bereich === b.id);
          // Schrittweise Tiefe: Fokus und Zeit stehen offen, der Rest auf Wunsch.
          const immer = b.id === 'fokus' || b.id === 'zeit';
          if (!immer && !tiefer) return null;
          return (
            <div key={b.id} style={{ ...panel, padding: '16px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ ...lbl, color: b.farbe }}>{b.label}</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>{b.satz}</span>
              </div>
              {meine.map((r, i) => {
                const v = wert(r.id);
                const eigenerWert = typeof eigene[r.id] === 'number' && eigene[r.id] !== aktLage.werte[r.id];
                return (
                  <div key={r.id} style={{ padding: '11px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, width: 168, flex: '0 0 auto' }}>
                        {r.label}
                        {eigenerWert && <span style={{ color: T.amber, marginLeft: 5 }} title="weicht von der Lage ab">•</span>}
                      </span>
                      <input type="range" min={r.min} max={r.max} step={r.schritt} value={v}
                        onChange={e => reglerSetzen(r.id, Number(e.target.value))}
                        aria-label={r.label}
                        style={{ flex: 1, minWidth: 140, accentColor: b.farbe, cursor: 'pointer' }} />
                      <span style={{ fontFamily: T.mono, fontSize: 12, color: b.farbe, width: 56, textAlign: 'right', flex: '0 0 auto' }}>
                        {v}{r.einheit ? ` ${r.einheit}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline', marginTop: 4, paddingLeft: 2 }}>
                      <span style={{ fontSize: 12, color: T.inkDim }}>→ {wirkung(r.id)}</span>
                      <span style={{ fontSize: 11.5, color: T.muted }}>{r.erklaert}</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
                        {r.wirktIn.map(w => (
                          <Link key={w.href} href={w.href} style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, textDecoration: 'none', borderBottom: `1px dotted ${T.line}` }}>{w.label}</Link>
                        ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {geladen && (
          <button onClick={() => setTiefer(!tiefer)} style={{
            width: '100%', fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '10px', borderRadius: 10, cursor: 'pointer',
            border: `1px dashed ${T.line}`, background: 'transparent', color: T.inkDim, marginBottom: 14,
          }}>
            {tiefer ? '− Postfach, Agenten und Schutz einklappen' : '+ Postfach, Agenten und Schutz einstellen'}
          </button>
        )}

        {/* ── Reihenfolge der Themen ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={lbl}>Unsere Ordnung</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>Was zuerst zählt, wenn alles wichtig ist. Die Lage setzt sie — hier feinjustieren.</span>
          </div>
          {themen.map((b, i) => {
            const n = offen.filter(t => themaVon(t, {}) === b.id).length;
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderTop: i ? `1px solid ${T.lineSoft}` : 0 }}>
                <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 700, color: b.farbe, width: 16 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.label} <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.muted }}>{n} offen</span></div>
                  <div style={{ fontSize: 11.5, color: T.muted }}>{b.satz}</div>
                </div>
                <button onClick={() => schieben(b.id, -1)} disabled={i === 0} aria-label="Nach oben"
                  style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === 0 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === 0 ? 'default' : 'pointer' }}>▲</button>
                <button onClick={() => schieben(b.id, 1)} disabled={i === themen.length - 1} aria-label="Nach unten"
                  style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: i === themen.length - 1 ? T.line : T.inkDim, padding: '3px 9px', cursor: i === themen.length - 1 ? 'default' : 'pointer' }}>▼</button>
              </div>
            );
          })}
        </div>

        {/* ── Eigene Filter ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={lbl}>Eigene Filter</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>Eine Auswahl einmal einstellen, dann jederzeit mit einem Klick aufrufen.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={neuName} onChange={e => setNeuName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') filterAnlegen(); }}
              placeholder="Name, z. B. Was Malin heute macht — oder: Alles zum Steuerberater" aria-label="Neuer Filter"
              style={{ ...feld, flex: 1 }} />
            <button onClick={filterAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Anlegen</button>
          </div>

          {!filter.length && <div style={{ fontSize: 12.5, color: T.muted }}>Noch keine eigenen Filter. Leg einen an — er erscheint dann oben im Taskmanagement.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filter.map(f => {
              const auf = offenId === f.id;
              const treffer = f.wo === 'aufgaben' ? trefferVon(f) : null;
              const teile = [
                ...(f.themen ?? []).map(x => THEMA[x]?.label),
                ...(f.orgs ?? []).map(x => ORGS.find(o => o.id === x)?.kurz),
                ...(f.prios ?? []).map(x => PRIOS.find(p => p[0] === x)?.[1]),
                ...(f.wege ?? []).map(x => WER_LABEL[x as keyof typeof WER_LABEL]),
                ...(f.stichworte ?? []).map(x => STICHWORTE.find(s => s.id === x)?.label ?? eigeneSw.find(s => s.id === x)?.label),
              ].filter(Boolean);
              return (
                <div key={f.id} style={{ background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 10, padding: '10px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <input value={f.name} onChange={e => patch(f.id, { name: e.target.value })} aria-label="Filtername"
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: T.ink, fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 140 }} />
                    {treffer != null && <span style={{ fontFamily: T.mono, fontSize: 11, color: treffer ? T.accent : T.muted }}>{treffer} Treffer</span>}
                    <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted }}>{f.wo === 'inbox' ? 'Postfach' : 'Aufgaben'}</span>
                    <button onClick={() => setOffenId(auf ? null : f.id)} style={{ background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.inkDim, padding: '3px 10px', fontSize: 11.5, cursor: 'pointer' }}>{auf ? 'Fertig' : 'Einstellen'}</button>
                    <button onClick={() => speichern({ filter: filter.filter(x => x.id !== f.id) })} aria-label="Filter löschen"
                      style={{ background: 'transparent', border: 'none', color: T.muted, cursor: 'pointer', fontSize: 13 }}>✕</button>
                  </div>
                  {!auf && teile.length > 0 && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{teile.join(' · ')}</div>}
                  {!auf && !teile.length && <div style={{ fontSize: 11.5, color: T.amber, marginTop: 3 }}>Noch nichts eingestellt — Einstellen klicken.</div>}

                  {auf && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ ...lbl, width: 74 }}>Gilt für</span>
                        {chip(f.wo === 'aufgaben', T.accent, 'Aufgaben', () => patch(f.id, { wo: 'aufgaben' }), 'w-a')}
                        {chip(f.wo === 'inbox', T.accent, 'Postfach', () => patch(f.id, { wo: 'inbox' }), 'w-i')}
                      </div>
                      {f.wo === 'aufgaben' ? (
                        <>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Thema</span>
                            {THEMEN.map(b => chip((f.themen ?? []).includes(b.id), b.farbe, b.label, () => patch(f.id, { themen: kippen(f.themen, b.id) }), b.id))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Ort</span>
                            {ORGS.map(o => chip((f.orgs ?? []).includes(o.id), o.farbe, o.kurz, () => patch(f.id, { orgs: kippen(f.orgs, o.id) }), o.id))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Stufe</span>
                            {PRIOS.map(([k, label]) => chip((f.prios ?? []).includes(k), T.accent, label, () => patch(f.id, { prios: kippen(f.prios, k) }), k))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Weg</span>
                            {(['jarvis', 'gemeinsam', 'mensch'] as const).map(w => chip((f.wege ?? []).includes(w), T.accent, WER_LABEL[w], () => patch(f.id, { wege: kippen(f.wege, w) }), w))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ ...lbl, width: 74 }}>Wer</span>
                            {(['kevin', 'malin', 'both'] as const).map(p => chip(f.besitzer === p, T.accent, p === 'both' ? 'Beide' : p === 'kevin' ? 'Kevin' : 'Malin', () => patch(f.id, { besitzer: f.besitzer === p ? undefined : p }), p))}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ ...lbl, width: 74 }}>Fach</span>
                          {FAECHER.map(fa => chip((f.faecher ?? []).includes(fa.id), fa.farbe, fa.label, () => patch(f.id, { faecher: kippen(f.faecher, fa.id) }), fa.id))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ ...lbl, width: 74 }}>Text</span>
                        <input value={f.suche ?? ''} onChange={e => patch(f.id, { suche: e.target.value })}
                          placeholder="muss im Text vorkommen (optional)" aria-label="Suchtext"
                          style={{ ...feld, flex: 1, fontSize: 12 }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Eigene Stichworte ── */}
        <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={lbl}>Eigene Stichworte</span>
            <span style={{ fontSize: 12.5, color: T.muted }}>{STICHWORTE.length} sind eingebaut — hier kommen eure eigenen dazu.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input value={swLabel} onChange={e => setSwLabel(e.target.value)} placeholder="Name, z. B. Zoo Palais"
              aria-label="Name des Stichworts" style={{ ...feld, width: 190 }} />
            <input value={swWoerter} onChange={e => setSwWoerter(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') stichwortAnlegen(); }}
              placeholder="Wörter zum Erkennen, mit Komma getrennt" aria-label="Erkennungswörter" style={{ ...feld, flex: 1, minWidth: 200 }} />
            <select value={swThema} onChange={e => setSwThema(e.target.value)} aria-label="Thema" style={{ ...feld, cursor: 'pointer' }}>
              {THEMEN.map(b => <option key={b.id} value={b.id} style={{ background: T.panel }}>{b.label}</option>)}
            </select>
            <button onClick={stichwortAnlegen} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', background: T.accent, color: '#04110F', cursor: 'pointer' }}>+ Anlegen</button>
          </div>
          {!eigeneSw.length && <div style={{ fontSize: 12.5, color: T.muted }}>Noch keine eigenen. Beispiel: Name Zoo Palais, Wörter: Zoo Palais, Pressekonferenz, Volllaunch.</div>}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {eigeneSw.map(s => (
              <span key={s.id} title={s.woerter.join(', ')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.inkDim, border: `1px solid ${THEMA[s.thema]?.farbe ?? T.line}55`, borderRadius: 999, padding: '4px 11px' }}>
                {s.label}
                <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted }}>{s.woerter.length} Wörter</span>
                <button onClick={() => speichern({ stichworte: eigeneSw.filter(x => x.id !== s.id) })} aria-label="Stichwort löschen"
                  style={{ background: 'none', border: 'none', color: T.muted, cursor: 'pointer', padding: 0, fontSize: 11 }}>✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* ── Reichweite: wo sonst noch eingestellt wird ── */}
        <div style={{ ...panel, padding: '14px 20px' }}>
          <div style={{ ...lbl, marginBottom: 8 }}>Weiter einstellen</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { href: '/os/aufgaben', label: 'Aufgaben · Stichworte & Orte je Aufgabe' },
              { href: '/os/inbox', label: 'Postfach · Türsteher & Fächer' },
              { href: '/os/datenbasis', label: 'Datenbasis · Quellen & Verbindungen' },
              { href: '/os/agenten', label: 'Agenten · was läuft' },
              { href: '/os/planung/jahr', label: 'Jahr · Ziele & Meilensteine' },
              { href: '/os/bauplan', label: 'Bauplan · was wir noch bauen' },
            ].map(l => (
              <Link key={l.href} href={l.href} style={{ fontSize: 12.5, color: T.accentInk, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 12px' }}>{l.label} ›</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
