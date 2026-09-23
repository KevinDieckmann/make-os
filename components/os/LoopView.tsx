'use client';

// ─── MAKE OS — Loops ────────────────────────────────────────────────────────
// Loops machen aus einzelnen Agenten ein Betriebssystem: sie ziehen echte
// Daten zusammen, leiten EINE Handlung ab und merken sich das Ergebnis.
// Seit 24.09. im lebendigen Muster: Loop wählen, starten, Ergebnis als
// Karten; der Verbesserungs-Loop schaut auf die Software selbst.

import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, LEUCHT } from './schlank';

type LoopKind = 'morgen' | 'woche' | 'rueckblick' | 'finanzen' | 'sales' | 'marketing' | 'operations' | 'kunden' | 'gesundheit';
interface Prio { titel: string; warum?: string; wann?: string }
interface FokusItem { titel: string; warum?: string }
interface Verbesserung { was: string; warum?: string }
interface LoopResult {
  loop?: string; error?: string; hinweis?: string;
  gruss?: string; tagesform?: string; warum?: string; prioritaeten?: Prio[]; schutz?: string; warnung?: string;
  lage?: string; vorwocheStatus?: string; fortschritt?: string[]; stillstand?: string[]; eineSache?: string; fokus?: FokusItem[];
  muster?: string[]; blindeFlecken?: string[]; verbesserungen?: Verbesserung[]; anzahl?: number;
  punkte?: FokusItem[]; stats?: Record<string, number>;
}
interface LogEntry { id: string; agent: string; title: string; ts: string }

const LOOPS: { id: LoopKind; label: string; sub: string; farbe: string }[] = [
  { id: 'woche', label: 'Wochen-Loop', sub: 'Zahlen × Pipeline × Ausführung', farbe: LEUCHT.puls },
  { id: 'finanzen', label: 'Finanz-Loop', sub: 'Forderungen × Runway × Uhrwerk', farbe: LEUCHT.geld },
  { id: 'sales', label: 'Sales-Loop', sub: 'Pipeline × Mandate × Produkte', farbe: LEUCHT.business },
  { id: 'marketing', label: 'Marketing-Loop', sub: 'Sichtbarkeit × Content × Launch', farbe: LEUCHT.beziehung },
  { id: 'operations', label: 'Operations-Loop', sub: 'Ausführung × Kapazität × Entlastung', farbe: LEUCHT.achtung },
  { id: 'kunden', label: 'Kunden-Loop', sub: 'Mandate × Rechnungen × nächste Schritte', farbe: LEUCHT.business },
  { id: 'gesundheit', label: 'Gesundheits-Loop', sub: 'privat · Trend × Etappen × Schutz', farbe: LEUCHT.gut },
  { id: 'rueckblick', label: 'Rückblick', sub: 'Was muss das System besser machen?', farbe: LEUCHT.agenten },
];
const formFarbe = (f?: string) => (f === 'gruen' ? LEUCHT.gut : f === 'rot' ? LEUCHT.kritisch : LEUCHT.achtung);
const formLabel = (f?: string) => (f === 'gruen' ? 'Grün' : f === 'rot' ? 'Rot' : 'Gelb');

function Absatz({ children, farbe }: { children: React.ReactNode; farbe?: string }) {
  return <div style={{ fontSize: TYP.body, color: farbe ?? C.ink, lineHeight: 1.55 }}>{children}</div>;
}
function Punkte({ liste, farbe }: { liste: { titel: string; warum?: string; wann?: string }[]; farbe: string }) {
  return <Liste>{liste.map((p, i) => <Zeile key={i} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, color: farbe, width: 20 }}>{i + 1}</span>} titel={p.titel} unter={[p.warum, p.wann].filter(Boolean).join(' · ')} />)}</Liste>;
}
function Striche({ liste, farbe }: { liste: string[]; farbe: string }) {
  return <div style={{ display: 'grid', gap: 6 }}>{liste.map((t, i) => <div key={i} style={{ display: 'flex', gap: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}><Punkt farbe={farbe} /><span style={{ marginTop: -2 }}>{t}</span></div>)}</div>;
}

export function LoopView() {
  const [kind, setKind] = useState<LoopKind>('woche');
  const [res, setRes] = useState<Record<string, LoopResult | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [vbBusy, setVbBusy] = useState(false);
  const [vbInfo, setVbInfo] = useState('');
  const [history, setHistory] = useState<LogEntry[]>([]);

  const ladeHistorie = () => fetch('/api/state/agent-log?prefix=loop-&limit=20').then(r => r.json()).then(d => setHistory(d.entries ?? [])).catch(() => {});
  useEffect(() => { void ladeHistorie(); }, []);

  async function run(k: LoopKind) {
    setBusy(true);
    const d = await fetch('/api/loop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loop: k, today: localDay() }) }).then(r => r.json()).catch(() => ({ error: 'Loop gerade nicht möglich.' }));
    setRes(s => ({ ...s, [k]: d })); setBusy(false); void ladeHistorie();
  }
  async function verbessern() {
    setVbBusy(true); setVbInfo('');
    const d = await fetch('/api/loop/verbesserung?jetzt=1', { method: 'POST' }).then(r => r.json()).catch(() => ({ error: 'Gerade nicht erreichbar.' }));
    setVbInfo(d.uebersprungen ? `Übersprungen — ${d.grund}` : d.ok ? `${d.anzahl} Vorschläge im Bauplan.` : (d.error ?? 'Fehlgeschlagen'));
    setVbBusy(false);
  }

  const cur = res[kind];
  const loop = LOOPS.find(l => l.id === kind)!;
  const bereich = !['morgen', 'woche', 'rueckblick'].includes(kind);

  return (
    <Seite titel="Loops" unter="Der Rhythmus des Systems: echte Daten zusammenziehen, eine Handlung ableiten, das Ergebnis merken.">
      <Karte i={0}>
        <Ueberschrift farbe={loop.farbe} rechts={cur?.stats ? Object.entries(cur.stats).map(([k, v]) => `${v} ${k}`).join(' · ') : undefined}>Welcher Loop</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
          {LOOPS.map(l => (
            <button key={l.id} onClick={() => setKind(l.id)} className="fassbar" style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 12, cursor: 'pointer', border: 'none', background: kind === l.id ? `${l.farbe}1F` : 'rgba(255,255,255,.04)', transition: 'background .15s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Punkt farbe={kind === l.id ? l.farbe : C.inkLeise} /><span style={{ fontSize: TYP.bedien, fontWeight: 700, color: kind === l.id ? C.ink : C.inkDim }}>{l.label}</span></div>
              <div style={{ fontSize: 11.5, color: C.inkLeise, marginTop: 3, lineHeight: 1.35 }}>{l.sub}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
          <Knopf onClick={() => run(kind)} aus={busy} farbe={loop.farbe}>{busy ? 'läuft …' : cur ? 'Neu laufen lassen' : `${loop.label} starten`}</Knopf>
          {busy && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>ziehe deine echten Daten zusammen …</span>}
          {!cur && !busy && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Termine, Aufgaben, Zahlen, Recovery — alles echt.</span>}
        </div>
      </Karte>

      {cur?.error && <Karte i={1} akzent={LEUCHT.kritisch}><Absatz farbe={LEUCHT.kritisch}>{cur.error}</Absatz></Karte>}
      {cur?.hinweis && <Karte i={1}><Leer>{cur.hinweis}</Leer></Karte>}

      {kind === 'morgen' && cur && !cur.error && cur.gruss && (
        <>
          <Karte i={1} akzent={formFarbe(cur.tagesform)}>
            <Ueberschrift farbe={formFarbe(cur.tagesform)} rechts={<Chip farbe={formFarbe(cur.tagesform)}>{formLabel(cur.tagesform)}</Chip>}>Heute</Ueberschrift>
            <Absatz>{cur.gruss}</Absatz>{cur.warum && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>{cur.warum}</div>}
          </Karte>
          {!!cur.prioritaeten?.length && <Karte i={2}><Ueberschrift farbe={LEUCHT.achtung}>Heute zählt nur das</Ueberschrift><Punkte liste={cur.prioritaeten} farbe={LEUCHT.achtung} /></Karte>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {cur.schutz && <Karte i={3}><Ueberschrift farbe={LEUCHT.puls}>Schutz</Ueberschrift><Absatz farbe={C.inkDim}>{cur.schutz}</Absatz></Karte>}
            {cur.warnung && <Karte i={4} akzent={LEUCHT.achtung}><Ueberschrift farbe={LEUCHT.achtung}>Achtung</Ueberschrift><Absatz farbe={C.inkDim}>{cur.warnung}</Absatz></Karte>}
          </div>
        </>
      )}

      {kind === 'woche' && cur && !cur.error && cur.lage && (
        <>
          <Karte i={1} akzent={loop.farbe}><Ueberschrift farbe={loop.farbe}>Wochenlage</Ueberschrift><Absatz>{cur.lage}</Absatz></Karte>
          {cur.vorwocheStatus && <Karte i={2}><Ueberschrift farbe={LEUCHT.schlaf}>Rückkopplung · letzte Woche</Ueberschrift><Absatz farbe={C.inkDim}>{cur.vorwocheStatus}</Absatz></Karte>}
          {cur.eineSache && <Karte i={3} akzent={LEUCHT.gut}><Ueberschrift farbe={LEUCHT.gut}>Die eine Sache</Ueberschrift><div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, lineHeight: 1.35 }}>{cur.eineSache}</div></Karte>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {!!cur.fortschritt?.length && <Karte i={4}><Ueberschrift farbe={LEUCHT.gut}>Vorwärts</Ueberschrift><Striche liste={cur.fortschritt} farbe={LEUCHT.gut} /></Karte>}
            {!!cur.stillstand?.length && <Karte i={5} akzent={LEUCHT.achtung}><Ueberschrift farbe={LEUCHT.achtung}>Stillstand</Ueberschrift><Striche liste={cur.stillstand} farbe={LEUCHT.achtung} /></Karte>}
          </div>
          {!!cur.fokus?.length && <Karte i={6}><Ueberschrift farbe={LEUCHT.schlaf}>Fokus nächste Woche</Ueberschrift><Punkte liste={cur.fokus} farbe={LEUCHT.schlaf} /></Karte>}
          {cur.schutz && <Karte i={7}><Ueberschrift farbe={LEUCHT.puls}>Freihalten</Ueberschrift><Absatz farbe={C.inkDim}>{cur.schutz}</Absatz></Karte>}
        </>
      )}

      {kind === 'rueckblick' && cur && !cur.error && (cur.muster || cur.verbesserungen) && (
        <>
          {!!cur.muster?.length && <Karte i={1} akzent={LEUCHT.agenten}><Ueberschrift farbe={LEUCHT.agenten}>Muster in meinen Empfehlungen</Ueberschrift><Striche liste={cur.muster} farbe={LEUCHT.agenten} /></Karte>}
          {!!cur.blindeFlecken?.length && <Karte i={2}><Ueberschrift farbe={LEUCHT.achtung}>Was mir fehlt</Ueberschrift><Striche liste={cur.blindeFlecken} farbe={LEUCHT.achtung} /></Karte>}
          {!!cur.verbesserungen?.length && <Karte i={3}><Ueberschrift>Was das System besser machen muss</Ueberschrift><Liste>{cur.verbesserungen.map((v, i) => <Zeile key={i} titel={v.was} unter={v.warum} />)}</Liste></Karte>}
        </>
      )}

      {bereich && cur && !cur.error && cur.lage && (
        <>
          <Karte i={1} akzent={loop.farbe}><Ueberschrift farbe={loop.farbe}>Lage</Ueberschrift><Absatz>{cur.lage}</Absatz>{cur.warnung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginTop: 8 }}>{cur.warnung}</div>}</Karte>
          {!!cur.punkte?.length && <Karte i={2}><Ueberschrift farbe={loop.farbe}>Die Moves</Ueberschrift><Punkte liste={cur.punkte} farbe={loop.farbe} /></Karte>}
          {cur.eineSache && <Karte i={3} akzent={LEUCHT.achtung}><Ueberschrift farbe={LEUCHT.achtung}>Die eine Sache</Ueberschrift><div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600 }}>{cur.eineSache}</div></Karte>}
        </>
      )}

      <Karte i={8} akzent={LEUCHT.agenten}>
        <Ueberschrift farbe={LEUCHT.agenten} rechts={<Knopf leise onClick={verbessern} aus={vbBusy}>{vbBusy ? 'schaut nach …' : 'Jetzt vorschlagen lassen'}</Knopf>}>Verbesserungs-Loop</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>Schaut auf die Software statt aufs Geschäft: was ihr benutzt, was seit Wochen niemand öffnet, welche Fehler auflaufen — und schlägt Änderungen vor. Läuft von selbst höchstens alle sieben Tage.</div>
        {vbInfo && <div style={{ fontSize: TYP.bedien, color: vbInfo.includes('Vorschläge') ? LEUCHT.gut : C.inkLeise, marginTop: 8 }}>{vbInfo}</div>}
      </Karte>

      {history.length > 0 && (
        <Karte i={9}>
          <Ueberschrift rechts={`${history.length}`}>Gedächtnis · frühere Läufe</Ueberschrift>
          <Liste>{history.slice(0, 12).map(h => <Zeile key={h.id} links={<span style={{ fontFamily: SCHRIFT.mono, fontSize: 11, color: C.inkLeise, width: 88 }}>{h.ts.slice(0, 16).replace('T', ' ')}</span>} titel={h.title} />)}</Liste>
        </Karte>
      )}
    </Seite>
  );
}
