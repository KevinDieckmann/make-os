'use client';

import Link from 'next/link';
// ─── MAKE OS — Tagesstart & Tagesende ───────────────────────────────────────
// Kevins 5–10-Minuten-Ritual, morgens und abends. Jeder Schritt hakt sich
// SELBST ab, sobald die echten Daten da sind (Vitals eingetragen, Journal
// geschrieben, Fokus gesetzt, an-/abgemeldet) — kein doppeltes Abhaken.
// Morgens: anmelden → wie gepennt → Kurz-Journal → Fokus → Tag checken.
// Abends: Routinen → Abend-Journal → Blick auf morgen → ausloggen.

import { useEffect, useRef, useState } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { THEME as T } from '@/lib/make-one/os-data';
import type { PlanBlock } from '@/types/planer';
import { localDay } from '@/lib/zeit';
import { useTasks } from '@/context/TasksContext';

interface Vitals { rec?: number; sleep?: number; hrv?: number; rhr?: number; note?: string }
interface JournalEintrag { text?: string; mood?: number; energy?: number; stress?: number; flags?: string[]; at?: string; tagesnote?: number }
interface Modus { an: boolean; seit: string | null; aktivMin: number }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const inp = { background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, color: T.ink, fontFamily: T.mono, fontSize: 13, padding: '6px 10px', outline: 'none' };

function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}
const stunden = (min: number) => `${(min / 60).toFixed(1).replace('.', ',')} h`;

/** Ein Ritual-Schritt: hakt sich selbst ab, wenn `done` wahr ist. */
function Schritt({ nr, titel, done, children }: { nr: number; titel: string; done: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...panel, borderLeft: `3px solid ${done ? T.accent : T.line}`, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', border: `1px solid ${done ? T.accent : T.line}`, background: done ? `${T.accent}22` : 'transparent', color: done ? T.accent : T.muted, fontFamily: T.mono, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{done ? <span className="check-pop">✓</span> : nr}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: done ? T.muted : T.ink }}>{titel}</span>
      </div>
      <div style={{ paddingLeft: 30 }}>{children}</div>
    </div>
  );
}

/** 1–5-Skala als klickbare Punkte. */
function Skala({ wert, setzen, farbe }: { wert?: number; setzen: (n: number) => void; farbe: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} onClick={() => setzen(n)}
          style={{ width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', border: `1px solid ${wert && n <= wert ? farbe : T.line}`, background: wert && n <= wert ? `${farbe}33` : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.mono, fontSize: 11, color: wert && n <= wert ? farbe : T.muted }}>
          {n}
        </span>
      ))}
    </span>
  );
}

interface Lauf { gestartet: string; art: string; ausrichtung?: { gruss?: string; prioritaeten?: { titel: string; wann?: string }[]; schutz?: string } }

export function RitualView({ startModus }: { startModus?: 'morgen' | 'abend' }) {
  const heute = localDay();
  const { state: tasksState } = useTasks();
  const [modusTab, setModusTab] = useState<'morgen' | 'abend'>(startModus ?? 'morgen');
  const [lauf, setLauf] = useState<Lauf | null>(null);
  const [laufHeute, setLaufHeute] = useState(0);
  const [zieht, setZieht] = useState(false);
  const [vitalsLog, setVitalsLog] = useState<Record<string, Vitals>>({});
  const [vEingabe, setVEingabe] = useState<{ rec: string; sleep: string; hrv: string; rhr: string; note: string }>({ rec: '', sleep: '', hrv: '', rhr: '', note: '' });
  const [journal, setJournal] = useState<Record<string, JournalEintrag>>({});
  const [abendText, setAbendText] = useState('');
  const [fokusTag, setFokusTag] = useState('');
  const [bloecke, setBloecke] = useState<PlanBlock[]>([]);
  const [routinen, setRoutinen] = useState<{ gesamt: number; erledigt: number }>({ gesamt: 0, erledigt: 0 });
  const [arbeit, setArbeit] = useState<Modus | null>(null);
  const [gespeichert, setGespeichert] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!startModus) setModusTab(new Date().getHours() >= 15 ? 'abend' : 'morgen');
  }, [startModus]);

  useEffect(() => {
    fetch('/api/state/vitals').then(r => r.json()).then(d => setVitalsLog(d.log ?? {})).catch(() => {});
    fetch('/api/state/journal').then(r => r.json()).then(d => {
      const j = d.journal ?? {};
      setJournal(j);
      setAbendText(j[heute]?.text ?? '');
    }).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setFokusTag(d.fokus?.tag ?? '')).catch(() => {});
    fetch(`/api/state/wochenplan?woche=${montagVon(heute)}`).then(r => r.json()).then(d => setBloecke(Array.isArray(d.bloecke) ? d.bloecke : [])).catch(() => {});
    Promise.all([
      fetch('/api/state/routinen').then(r => r.json()).catch(() => ({ routinen: [] })),
      fetch('/api/state/health').then(r => r.json()).catch(() => ({ log: {} })),
    ]).then(([r, h]) => {
      const aktiv = ((r.routinen ?? []) as { id: string; aktiv: boolean }[]).filter(x => x.aktiv);
      const done = new Set((h.log?.[heute] ?? []) as string[]);
      setRoutinen({ gesamt: aktiv.length, erledigt: aktiv.filter(x => done.has(x.id)).length });
    });
    fetch('/api/state/arbeitsmodus').then(r => r.json()).then(d => setArbeit(d.heute ?? null)).catch(() => {});
    fetch('/api/tageslauf').then(r => r.json()).then(d => {
      setLaufHeute(d.heute ?? 0);
      const heutiger = (Array.isArray(d.laeufe) ? (d.laeufe as Lauf[]) : []).find(l => l.gestartet?.slice(0, 10) === heute && l.ausrichtung);
      setLauf(heutiger ?? d.letzterVoll ?? null);
    }).catch(() => {});
  }, [heute]);

  // Der Loop: die Agenten ziehen alle Daten sauber zusammen (Postfach, Kalender,
  // Aufgaben, Prioritäten) — Kevins Check-in setzt darauf auf.
  async function lageZiehen() {
    setZieht(true);
    try {
      const r = await fetch('/api/tageslauf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ art: 'kurz' }) });
      const d = await r.json();
      if (d.lauf) { setLauf(d.lauf); setLaufHeute(n => n + 1); }
    } catch { /* still */ }
    setZieht(false);
  }

  const meld = (t: string) => { setGespeichert(t); setTimeout(() => setGespeichert(''), 2500); };

  async function arbeitToggle(aktion: 'an' | 'aus') {
    try {
      const r = await fetch('/api/state/arbeitsmodus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion }) });
      const d = await r.json();
      if (d.heute) setArbeit(d.heute);
    } catch { /* still */ }
  }

  async function vitalsSpeichern() {
    const vitals: Vitals = {};
    if (vEingabe.rec !== '') vitals.rec = Number(vEingabe.rec);
    if (vEingabe.sleep !== '') vitals.sleep = Number(vEingabe.sleep.replace(',', '.'));
    if (vEingabe.hrv !== '') vitals.hrv = Number(vEingabe.hrv);
    if (vEingabe.rhr !== '') vitals.rhr = Number(vEingabe.rhr);
    if (vEingabe.note.trim()) vitals.note = vEingabe.note.trim();
    if (!Object.keys(vitals).length) return;
    try {
      await fetch('/api/state/vitals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: heute, vitals }) });
      setVitalsLog(prev => ({ ...prev, [heute]: { ...prev[heute], ...vitals } }));
      meld('Werte gespeichert.');
    } catch { /* still */ }
  }

  const journalSpaeter = useNachspeichern<Record<string, JournalEintrag>>(next => {
    fetch('/api/state/journal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }).catch(() => {});
  }, 600);

  function journalSetzen(patch: Partial<JournalEintrag>) {
    const next = { ...journal, [heute]: { ...journal[heute], ...patch, at: new Date().toISOString() } };
    setJournal(next);
    journalSpaeter(next);
  }

  function fokusSpeichern(text: string) {
    setFokusTag(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont: 'tag', fokus: text }) }).catch(() => {});
    }, 600);
  }

  const morgenDatum = (() => { const d = new Date(`${heute}T12:00:00`); d.setDate(d.getDate() + 1); return localDay(d); })();
  const j = journal[heute] ?? {};
  const heuteBloecke = bloecke.filter(b => b.date === heute);
  const morgenBloecke = bloecke.filter(b => b.date === morgenDatum);

  const faelligHeute = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate === heute);
  const ueberfaellig = tasksState.tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < heute);

  // ── Selbst-abhakende Schritte ──
  const mSchritte = {
    an: !!arbeit?.an,
    lage: laufHeute > 0,
    vitals: !!vitalsLog[heute],
    journal: j.mood !== undefined,
    fokus: fokusTag.trim().length > 0,
    plan: heuteBloecke.length > 0,
  };
  const aSchritte = {
    routinen: routinen.gesamt > 0 && routinen.erledigt >= Math.ceil(routinen.gesamt / 2),
    bewertung: j.tagesnote !== undefined,
    journal: (j.text ?? '').trim().length > 0,
    morgen: morgenBloecke.length > 0,
    aus: !!arbeit && !arbeit.an && arbeit.aktivMin > 0,
  };
  const mDone = Object.values(mSchritte).filter(Boolean).length;
  const aDone = Object.values(aSchritte).filter(Boolean).length;

  // Zonen-Reaktion direkt nach der Eingabe — das eine Urteil des Morgens.
  const recHeute = vitalsLog[heute]?.rec;
  const zoneR = recHeute != null
    ? recHeute >= 66 ? { l: 'GRÜN', c: T.accent, txt: 'volle Ladung — heute darf hart gefahren werden.' }
      : recHeute >= 40 ? { l: 'GELB', c: T.amber, txt: 'halbe Ladung — zwei gute Blöcke, Pausen ernst nehmen.' }
      : { l: 'ROT', c: T.crit, txt: 'Erhaltungsmodus — heute bewusst leichter planen, Rücken schonen.' }
    : null;
  const erledigtHeute = tasksState.tasks.filter(t => t.status === 'done' && t.dueDate === heute).length;

  const datum = new Date(`${heute}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <div style={lbl}>{modusTab === 'morgen' ? 'Tagesstart' : 'Tagesende'} · {datum}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 4px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-.02em' }}>
            {modusTab === 'morgen' ? 'Rein in den Tag.' : 'Raus aus dem Tag.'}
          </h1>
          <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: (modusTab === 'morgen' ? mDone === 6 : aDone === 5) ? T.accent : T.amber }}>
            {modusTab === 'morgen' ? `${mDone}/6` : `${aDone}/5`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['morgen', 'abend'] as const).map(m => (
              <button key={m} onClick={() => setModusTab(m)}
                style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 6, padding: '3px 10px', border: `1px solid ${modusTab === m ? T.accent : T.line}`, background: modusTab === m ? `${T.accent}1c` : 'transparent', color: modusTab === m ? T.accentInk : T.muted }}>
                {m === 'morgen' ? 'Morgen' : 'Abend'}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>10–15 Minuten für dich — zahlt direkt auf Gesundheit & Energie ein. Jeder Schritt hakt sich selbst ab, sobald er wirklich passiert ist.{gespeichert && <span style={{ color: T.accent }}> {gespeichert}</span>}</p>

        {/* Fortschritt als Segmente — ein Blick zeigt, was noch fehlt */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {(modusTab === 'morgen' ? Object.values(mSchritte) : Object.values(aSchritte)).map((ok, i) => (
            <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: ok ? T.accent : T.line }} />
          ))}
        </div>

        {modusTab === 'morgen' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Schritt nr={1} titel="Anmelden — der Tag läuft" done={mSchritte.an}>
              {arbeit?.an
                ? <span style={{ fontSize: 12.5, color: T.inkDim }}>AN seit {arbeit.seit} · bisher {stunden(arbeit.aktivMin)} aktiv.</span>
                : <button onClick={() => arbeitToggle('an')} style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '6px 14px', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>● AN — Arbeitszeit läuft</button>}
            </Schritt>

            <Schritt nr={2} titel="Die Lage — Jarvis zieht alle Daten zusammen" done={mSchritte.lage}>
              {lauf?.ausrichtung ? (
                <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, marginBottom: 8 }}>
                  {lauf.ausrichtung.gruss && <div style={{ marginBottom: 4 }}>{lauf.ausrichtung.gruss} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Stand {lauf.gestartet.slice(11, 16)} Uhr</span></div>}
                  {(lauf.ausrichtung.prioritaeten ?? []).slice(0, 3).map((p, i) => (
                    <div key={i}><b style={{ color: T.ink }}>{i + 1}. {p.titel}</b>{p.wann ? <span style={{ color: T.muted }}> · {p.wann}</span> : null}</div>
                  ))}
                  {lauf.ausrichtung.schutz && <div style={{ color: '#58D9CD', marginTop: 4 }}>◇ {lauf.ausrichtung.schutz}</div>}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>Noch kein Lauf heute — Postfach, Kalender und Aufgaben werden vom Loop zusammengezogen.</div>
              )}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={lageZiehen} disabled={zieht}
                  style={{ fontFamily: T.mono, fontSize: 11, cursor: zieht ? 'wait' : 'pointer', borderRadius: 7, padding: '6px 14px', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk, opacity: zieht ? 0.6 : 1 }}>
                  {zieht ? 'zieht zusammen …' : laufHeute > 0 ? 'Lage frisch ziehen' : '⟳ Lage jetzt ziehen'}
                </button>
                <Link href="/os/tageslauf" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>Ganzer Tageslauf ›</Link>
              </div>
            </Schritt>

            <Schritt nr={3} titel="Wie gepennt? (Whoop-Werte)" done={mSchritte.vitals}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={vEingabe.rec} onChange={e => setVEingabe({ ...vEingabe, rec: e.target.value })} placeholder="Recovery %" type="number" style={{ ...inp, width: 100 }} />
                <input value={vEingabe.sleep} onChange={e => setVEingabe({ ...vEingabe, sleep: e.target.value })} placeholder="Schlaf h" style={{ ...inp, width: 84 }} />
                <input value={vEingabe.hrv} onChange={e => setVEingabe({ ...vEingabe, hrv: e.target.value })} placeholder="HRV" type="number" style={{ ...inp, width: 70 }} />
                <input value={vEingabe.rhr} onChange={e => setVEingabe({ ...vEingabe, rhr: e.target.value })} placeholder="Puls" type="number" style={{ ...inp, width: 70 }} />
                <input value={vEingabe.note} onChange={e => setVEingabe({ ...vEingabe, note: e.target.value })} placeholder="Notiz (z.B. Rücken zieht)" style={{ ...inp, flex: 1, minWidth: 150, fontFamily: T.sans }} />
                <button onClick={vitalsSpeichern} style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '6px 12px', border: `1px solid ${T.accent}`, background: `${T.accent}1c`, color: T.accentInk }}>Speichern</button>
              </div>
              {zoneR && (
                <div style={{ fontSize: 12.5, marginTop: 8 }}>
                  <b style={{ fontFamily: T.mono, color: zoneR.c }}>● {zoneR.l}</b>
                  <span style={{ color: T.inkDim }}> — {zoneR.txt}</span>
                </div>
              )}
              {mSchritte.vitals && !zoneR && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>Heute schon da — neue Eingabe überschreibt nur die ausgefüllten Felder.</div>}
            </Schritt>

            <Schritt nr={4} titel="Kurz-Journal — wie geht's rein?" done={mSchritte.journal}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.inkDim }}>Stimmung <Skala wert={j.mood} setzen={n => journalSetzen({ mood: n })} farbe={T.accent} /></span>
                <span style={{ fontSize: 12, color: T.inkDim }}>Energie <Skala wert={j.energy} setzen={n => journalSetzen({ energy: n })} farbe={T.amber} /></span>
                <span style={{ fontSize: 12, color: T.inkDim }}>Stress <Skala wert={j.stress} setzen={n => journalSetzen({ stress: n })} farbe={T.crit} /></span>
              </div>
              <Link href="/os/journal" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>Mehr im Journal ›</Link>
            </Schritt>

            <Schritt nr={5} titel="Fokus des Tages" done={mSchritte.fokus}>
              <input value={fokusTag} onChange={e => fokusSpeichern(e.target.value)} placeholder="Der eine Satz: worauf liegt heute der Fokus?"
                style={{ ...inp, width: '100%', fontFamily: T.sans, fontSize: 14, fontWeight: 600 }} />
            </Schritt>

            <Schritt nr={6} titel="Tag bauen — Blöcke, Kollisionen, Delegation" done={mSchritte.plan}>
              <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 6 }}>
                {heuteBloecke.length
                  ? `${heuteBloecke.length} Block${heuteBloecke.length > 1 ? ' e' : ''} für heute geplant.`
                  : 'Noch nichts für heute geplant — kurz reinschauen und die Lücken füllen.'}
              </div>
              {(faelligHeute.length > 0 || ueberfaellig.length > 0) && (
                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                  {faelligHeute.length > 0 && <span style={{ color: T.amber }}>{faelligHeute.length} heute fällig. </span>}
                  {ueberfaellig.length > 0 && <span style={{ color: T.crit }}>{ueberfaellig.length} überfällig — erledigen, delegieren oder ehrlich neu terminieren.</span>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 14 }}>
                <Link href="/os/planung" style={{ fontSize: 12, color: T.accentInk, textDecoration: 'none' }}>Tagesplanung ›</Link>
                <Link href="/os/aufgaben" style={{ fontSize: 12, color: T.accentInk, textDecoration: 'none' }}>Aufgaben & Delegation ›</Link>
              </div>
            </Schritt>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Schritt nr={1} titel="Routinen abschließen" done={aSchritte.routinen}>
              <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 6 }}>{routinen.erledigt}/{routinen.gesamt} heute abgehakt.</div>
              <Link href="/os/planung" style={{ fontSize: 12, color: T.accentInk, textDecoration: 'none' }}>Abhaken in der Tagesplanung ›</Link>
            </Schritt>

            <Schritt nr={2} titel="Tag bewerten — der Tag in Zahlen" done={aSchritte.bewertung}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: T.inkDim }}>Wie war der Tag?</span>
                <Skala wert={j.tagesnote} setzen={n => journalSetzen({ tagesnote: n })} farbe={T.accent} />
              </div>
              <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>
                {arbeit ? `Arbeitszeit ${stunden(arbeit.aktivMin)}` : ''} · Routinen {routinen.erledigt}/{routinen.gesamt} · {heuteBloecke.length} Blöcke geplant · {erledigtHeute} fällige erledigt
              </div>
            </Schritt>

            <Schritt nr={3} titel="Ein Satz zum Tag" done={aSchritte.journal}>
              <textarea value={abendText} onChange={e => { setAbendText(e.target.value); journalSetzen({ text: e.target.value }); }}
                placeholder="»Hat alles super geklappt, geile Gespräche« zählt auch — was war gut, was nehme ich mit?"
                rows={3} style={{ ...inp, width: '100%', fontFamily: T.sans, fontSize: 13, resize: 'vertical', lineHeight: 1.5 }} />
            </Schritt>

            <Schritt nr={4} titel="Blick auf morgen" done={aSchritte.morgen}>
              <div style={{ fontSize: 12.5, color: T.inkDim, marginBottom: 6 }}>
                {morgenBloecke.length
                  ? `${morgenBloecke.length} Block${morgenBloecke.length > 1 ? ' e' : ''} für morgen geplant — der Tag ist vorbereitet.`
                  : 'Morgen ist noch leer — zwei, drei Blöcke reichen, dann startet der Morgen ohne Denken.'}
              </div>
              <Link href="/os/planung/woche" style={{ fontSize: 12, color: T.accentInk, textDecoration: 'none' }}>Wochenplaner öffnen ›</Link>
            </Schritt>

            <Schritt nr={5} titel="Ausloggen — Feierabend ist Feierabend" done={aSchritte.aus}>
              {arbeit?.an
                ? <button onClick={() => arbeitToggle('aus')} style={{ fontFamily: T.mono, fontSize: 11, cursor: 'pointer', borderRadius: 7, padding: '6px 14px', border: `1px solid ${T.crit}`, background: `${T.crit}1a`, color: T.crit }}>○ AUS — Session beenden</button>
                : <span style={{ fontSize: 12.5, color: T.inkDim }}>{arbeit && arbeit.aktivMin > 0 ? `Ausgeloggt · heute ${stunden(arbeit.aktivMin)} aktiv gearbeitet.` : 'Heute keine Arbeits-Session erfasst.'}</span>}
            </Schritt>
          </div>
        )}
      </div>
    </div>
  );
}
