'use client';

// ─── MAKE OS — OKR-/Ziel-Agent ──────────────────────────────────────────────
// Der Agent klammert Nordstern, Controlling-Zahlen und Aufgaben zusammen.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zahl/Fortschritt).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { DEFAULT_FINANCE, computeMetrics, eur, type FinanceState } from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Zahl, Fortschritt, Chip, Knopf, Leer, Punkt, LEUCHT } from './schlank';
import { Flaeche, Kachel } from './flaeche/Flaeche';

interface Objective { titel: string; warum?: string; keyResults?: string[]; hebelTasks?: string[]; luecke?: string; }
interface TaskLite { title: string; status?: string; priority?: string; description?: string; }

const MIKRO_LABEL = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: C.inkLeise };

export function OkrView() {
  const [fin, setFin] = useState<FinanceState>(DEFAULT_FINANCE);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [lage, setLage] = useState('');
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/state/finance').then(r => r.json()).catch(() => ({ state: null })),
      fetch('/api/state/tasks').then(r => r.json()).catch(() => ({ state: null })),
    ]).then(([f, t]) => {
      if (f.state?.months?.length === 12) setFin(f.state);
      const list: TaskLite[] = (t.state?.tasks ?? []).filter((x: TaskLite) => x.status !== 'done').map((x: { title: string; status?: string; priority?: string; description?: string }) => ({ title: x.title, status: x.status, priority: x.priority, description: x.description }));
      setTasks(list);
      setReady(true);
    });
  }, []);

  const m = computeMetrics(fin);
  const pct = Math.min(100, Math.round(m.fortschritt * 100));

  async function build() {
    setBusy(true);
    try {
      const r = await fetch('/api/okr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finance: fin, tasks }) });
      const d = await r.json();
      setLage(d.lage ?? ''); setObjectives(d.objectives ?? []);
    } catch { setLage('Analyse gerade nicht möglich.'); }
    setBusy(false);
  }

  return (
    <Seite
      titel="Der Weg auf 1 Mio."
      unter={<>OKR-/Ziel-Agent · Der Agent klammert deinen Nordstern mit den echten Controlling-Zahlen und deinen Aufgaben zusammen — Objectives, Key Results, welche Aufgabe einzahlt und <b style={{ color: C.ink, fontWeight: 600 }}>wo eine Lücke klafft</b>.</>}
      rechts={<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip farbe={LEUCHT.agenten}>live · Vorschlag</Chip>
        <Link href="/os/agenten" style={{ fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none' }}>Agenten ›</Link>
      </div>}
    >
      <Flaeche seite="okr">
      <Kachel id="nordstern" titel="Nordstern" breite={6}>
      <Karte i={0} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld} rechts={`${eur(m.istUmsatz)} / ${eur(fin.zielUmsatz)} · Gewinnziel ${eur(fin.zielGewinn)}`}>Nordstern · KD Ventures</Ueberschrift>
        <div style={{ display: 'flex', gap: 'clamp(16px,3vw,32px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Zahl gross wert={m.aktiveMonate > 0 || pct > 0 ? String(pct) : undefined} label="% des Umsatzziels" farbe={LEUCHT.geld} />
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div style={{ fontSize: TYP.body, color: C.inkDim, marginBottom: 10 }}>1 Mio € Umsatz → min. 300k € für dich & Malin</div>
            <Fortschritt anteil={pct / 100} farbe={LEUCHT.geld} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 18 }}>
          <Knopf onClick={build} aus={busy || !ready}>{busy ? 'baue den Zielbaum …' : objectives.length ? 'Neu berechnen' : 'Zielbaum bauen'}</Knopf>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{ready ? `${tasks.length} offene Aufgaben · ${m.aktiveMonate > 0 ? 'Zahlen da' : 'Controlling leer'}` : 'lade …'}</span>
        </div>
      </Karte>
      </Kachel>

      {lage && (
        <Kachel id="lage" titel="Lage zum Nordstern" breite={6}>
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.agenten}>Lage zum Nordstern</Ueberschrift>
          <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55, margin: 0 }}>{lage}</p>
        </Karte>
        </Kachel>
      )}

      {objectives.map((o, i) => (
        <Kachel key={i} id={`objective-${i + 1}`} titel={`Objective ${i + 1}`} breite={3}>
        <Karte i={2 + i}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Objective {i + 1}</Ueberschrift>
          <h3 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 700, letterSpacing: '-.02em', color: C.ink, margin: 0, lineHeight: 1.25 }}>{o.titel}</h3>
          {o.warum && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 4, lineHeight: 1.5 }}>{o.warum}</div>}

          {!!o.keyResults?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...MIKRO_LABEL, marginBottom: 6 }}>Key Results</div>
              {o.keyResults.map((k, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, padding: '3px 0' }}>
                  <span style={{ paddingTop: 5 }}><Punkt farbe={LEUCHT.schlaf} groesse={7} /></span><span>{k}</span>
                </div>
              ))}
            </div>
          )}

          {!!o.hebelTasks?.length && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...MIKRO_LABEL, marginBottom: 8 }}>Zahlt ein (deine Aufgaben)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {o.hebelTasks.map((t, j) => <Chip key={j} farbe={LEUCHT.gut}>✓ {t}</Chip>)}
              </div>
            </div>
          )}

          {o.luecke && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, background: `${LEUCHT.achtung}14`, borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ color: LEUCHT.achtung, flex: '0 0 auto' }}>⚠</span>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><b style={{ color: LEUCHT.achtung }}>Lücke: </b>{o.luecke}</div>
            </div>
          )}
        </Karte>
        </Kachel>
      ))}

      {objectives.length === 0 && !busy && lage === '' && (
        <Kachel id="start" titel="Zielbaum" breite={6}>
        <Karte i={1}>
          <Leer>„Zielbaum bauen“ — der Agent zerlegt die 1 Mio in Objectives, ordnet deine Aufgaben zu und zeigt, wo noch nichts einzahlt.</Leer>
        </Karte>
        </Kachel>
      )}
      </Flaeche>
    </Seite>
  );
}
