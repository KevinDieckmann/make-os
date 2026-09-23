'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { todayISO } from '@/components/os/kit';
import { localDay } from '@/lib/zeit';
import { Seitenkopf } from './Seitenkopf';

interface Ev { id: string; title: string; startDate: string; endDate: string; allDay?: boolean; calendarName?: string; location?: string; category?: string; }

type Wer = string | 'beide';
type ArtId = 'termin' | 'fokus' | 'routine' | 'aufgabe' | 'reha';
interface Einstellungen {
  kalender: Record<Wer, string>;
  dauer: Record<ArtId, number>;
  vonStunde: number; bisStunde: number;
  standardSicht: 'alle' | Wer;
}
const EINST_LEER: Einstellungen = {
  kalender: { kevin: 'Privat Kevin', malin: 'Malin', beide: 'Kalender' },
  dauer: { termin: 60, fokus: 90, routine: 30, aufgabe: 45, reha: 30 },
  vonStunde: 7, bisStunde: 20, standardSicht: 'alle',
};

/**
 * Die Arten, die Kevin und Malin wirklich haben. Das Präfix macht im Apple-
 * Kalender auf einen Blick sichtbar, worum es geht — dort gibt es keine Farben
 * je Art, nur den Titel.
 */
const ARTEN: { id: ArtId; label: string; farbe: string; praefix: string; beispiel: string }[] = [
  { id: 'termin', label: 'Termin', farbe: T.accentInk, praefix: '', beispiel: 'Finanzmeeting mit Malin' },
  { id: 'fokus', label: 'Fokus', farbe: T.accent, praefix: '◎ ', beispiel: 'Markttraktion durchrechnen' },
  { id: 'routine', label: 'Routine', farbe: '#C77DFF', praefix: '↻ ', beispiel: 'Tagesstart' },
  { id: 'aufgabe', label: 'Aufgabe', farbe: T.amber, praefix: '✓ ', beispiel: 'Rechnung an One Finance' },
  { id: 'reha', label: 'Reha', farbe: '#58D9CD', praefix: '✚ ', beispiel: 'Rücken-Übungen' },
];
interface Block { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string; }
interface AnalyseAntwort { briefing?: string; conflicts?: Conflict[]; vorschlaege?: Block[]; eingetragen?: boolean; }
interface Conflict { date: string; a: string; b: string; overlap: string; }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const feld = { background: T.void, border: `1px solid ${T.line}`, borderRadius: 8, color: T.ink, fontFamily: T.sans, fontSize: 13, padding: '8px 11px', outline: 'none' };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const calColor = (c?: string) => (c === 'Privat Kevin' ? T.accentInk : c === 'Privat Malin' ? '#C77DFF' : c === 'Kevin Dieckmann' ? T.amber : T.accent);
const fmtTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (k: string) => { const d = new Date(`${k}T00:00:00`); return `${WD[d.getDay()]} · ${d.getDate()}.${d.getMonth() + 1}.`; };

export function KalenderView() {
  // pro Render frisch — sonst steht das Datum bei offenem Tab über Mitternacht still
  const TODAY = todayISO();
  const [events, setEvents] = useState<Ev[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [briefing, setBriefing] = useState('');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [added, setAdded] = useState<Record<number, 'ok' | 'err' | 'busy'>>({});
  // Woher die Termine kommen: frisch gelesen oder letzter guter Stand.
  const [stand, setStand] = useState<string | null>(null);
  const [eingefroren, setEingefroren] = useState(false);
  const [frostGrund, setFrostGrund] = useState<string | null>(null);

  // ── Sicht, Anlegen und Einstellungen (Kevins Ansage 02.08.) ──
  const [sicht, setSicht] = useState<'alle' | Wer>('alle');
  const [anlegen, setAnlegen] = useState(false);
  const [zeigeEinst, setZeigeEinst] = useState(false);
  const [einst, setEinst] = useState<Einstellungen>(EINST_LEER);
  const [art, setArt] = useState<ArtId>('termin');
  const [titel, setTitel] = useState('');
  const [wer, setWer] = useState<Wer>('kevin');
  const [datum, setDatum] = useState('');
  const [zeit, setZeit] = useState('09:00');
  const [dauer, setDauer] = useState(60);
  const [speichert, setSpeichert] = useState(false);
  const [anlegenInfo, setAnlegenInfo] = useState('');

  useEffect(() => {
    setDatum(localDay());
    fetch('/api/state/kalender-einstellungen').then(r => r.json()).then((e: Einstellungen) => {
      setEinst(e);
      setDauer(e.dauer?.termin ?? 60);
      if (e.standardSicht) setSicht(e.standardSicht);
    }).catch(() => {});
  }, []);

  const einstSetzen = (teil: Partial<Einstellungen>) => {
    const next = { ...einst, ...teil };
    setEinst(next);
    fetch('/api/state/kalender-einstellungen', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next), keepalive: true,
    }).catch(() => {});
  };

  /** Wem gehört ein Termin — anhand des Kalendernamens aus den Einstellungen. */
  const wemGehoert = (e: Ev): Wer => {
    const n = (e.calendarName ?? '').trim();
    if (n && n === einst.kalender.kevin) return 'kevin';
    if (n && n === einst.kalender.malin) return 'malin';
    return 'beide';
  };

  async function eintragen() {
    if (!titel.trim() || speichert) return;
    setSpeichert(true); setAnlegenInfo('');
    const [h, m] = zeit.split(':').map(Number);
    try {
      const r = await fetch('/api/apple-calendar/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{
          title: `${ARTEN.find(a => a.id === art)?.praefix ?? ''}${titel.trim()}`,
          calendar: einst.kalender[wer],
          date: datum, startHour: h || 9, startMin: m || 0, durationMin: dauer,
        }] }),
      });
      const d = await r.json();
      if (d.ok) { setAnlegenInfo('✓ Eingetragen — im Apple-Kalender sichtbar.'); setTitel(''); load(); }
      else setAnlegenInfo(d.error ?? 'Konnte nicht eintragen.');
    } catch { setAnlegenInfo('Kalender gerade nicht erreichbar.'); }
    setSpeichert(false);
  }

  async function load() {
    setLoading(true); setLoadErr(null);
    try {
      const r = await fetch('/api/apple-calendar');
      const d = await r.json();
      if (Array.isArray(d)) {
        setEvents(d);
        // Eingefroren erkennen: die Route liefert bei Nichterreichbarkeit den
        // letzten guten Stand. Ohne diese Kennzeichnung sähen alte Termine aus
        // wie aktuelle — und der Tagesplan würde darauf aufbauen.
        setStand(r.headers.get('X-Stand'));
        setEingefroren(r.headers.get('X-Cache') === 'stale');
        setFrostGrund(r.headers.get('X-Grund'));
      } else setLoadErr(d.detail || d.error || 'Kein Zugriff.');
    } catch (e) { setLoadErr(e instanceof Error ? e.message : 'Fehler'); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function analyse() {
    setAnalysing(true); setAdded({});
    try {
      const r = await fetch('/api/kalender/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, today: TODAY }) });
      const d: AnalyseAntwort = await r.json();
      setBriefing(d.briefing ?? ''); setConflicts(d.conflicts ?? []); setBlocks(d.vorschlaege ?? []);
      // Autonom eingetragen? Dann Knöpfe direkt auf „eingetragen" stellen + neu laden.
      if (d.eingetragen) {
        setAdded(Object.fromEntries((d.vorschlaege ?? []).map((_, i) => [i, 'ok' as const])));
        setTimeout(load, 800);
      }
    } catch { setBriefing('Analyse gerade nicht möglich.'); }
    setAnalysing(false);
  }

  async function addBlock(b: Block, i: number) {
    setAdded(a => ({ ...a, [i]: 'busy' }));
    try {
      const r = await fetch('/api/apple-calendar/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [b] }) });
      const d = await r.json();
      setAdded(a => ({ ...a, [i]: d.ok ? 'ok' : 'err' }));
      if (d.ok) setTimeout(load, 600);
    } catch { setAdded(a => ({ ...a, [i]: 'err' })); }
  }

  async function addAll() {
    const pending = blocks.map((b, i) => ({ b, i })).filter(x => added[x.i] !== 'ok');
    for (const { b, i } of pending) await addBlock(b, i);
  }

  // Termine ab heute, nach Tag gruppiert
  // Die gewählte Sicht filtert die Liste — Kevin, Malin, gemeinsam oder alles.
  const upcoming = events
    .filter(e => e.startDate && dayKey(e.startDate) >= TODAY)
    .filter(e => sicht === 'alle' || wemGehoert(e) === sicht)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const byDay = upcoming.reduce<Record<string, Ev[]>>((acc, e) => { const k = dayKey(e.startDate); (acc[k] ??= []).push(e); return acc; }, {});
  const days = Object.keys(byDay).sort().slice(0, 8);
  const conflictKey = (c: Conflict) => `${c.date}|${c.a}|${c.b}`;
  const conflictTitles = new Set(conflicts.flatMap(c => [`${c.date}|${c.a}`, `${c.date}|${c.b}`]));

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/agenten" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Agenten</Link>
          <Seitenkopf
            rubrik={<>Kalender-Agent <span style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, border: `1px solid ${T.accent}55`, borderRadius: 5, padding: '2px 7px' }}>live · mit Freigabe</span></>}
            titel={<>Die Woche schützt sich selbst.</>}
            satz={<>Echte Termine aus Apple Kalender, Konflikte markiert. Der Agent schlägt Reha- & Fokus-Blöcke in die freien Lücken vor — eintragen tust du auf Klick.</>}
          />

        {/* Eingefroren: lieber sagen, dass es ein alter Stand ist, als so tun,
            als wäre er aktuell. */}
        {eingefroren && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '13px 17px', marginTop: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: T.amber }}>
              Eingefrorener Stand{stand ? ` vom ${new Date(stand).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr` : ''}
            </div>
            <div style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, marginTop: 4 }}>
              Der Apple-Kalender war gerade nicht erreichbar — du siehst den letzten guten Stand.
              Neue oder verschobene Termine fehlen hier möglicherweise.
              {frostGrund && <span style={{ color: T.muted }}> ({frostGrund})</span>}
            </div>
            <button onClick={() => fetch('/api/apple-calendar?refresh=1').then(load)} style={{
              marginTop: 9, fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 8,
              cursor: 'pointer', border: `1px solid ${T.amber}`, background: 'transparent', color: T.amber,
            }}>Nochmal versuchen</button>
          </div>
        )}

        {/* ── SICHT: wessen Kalender ─────────────────────────────────────────
            Kevins Ansage: „Man soll sich jeweils die andere Sicht angucken
            können, also Malin oder Kevin." Die Zuordnung kommt aus den
            Einstellungen — dort steht, welcher Apple-Kalender zu wem gehört. */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
          <span style={lbl}>Sicht</span>
          {([['alle', 'Alle'], ['kevin', 'Kevin'], ['malin', 'Malin'], ['beide', 'Gemeinsam']] as const).map(([id, label]) => {
            const an = sicht === id;
            const n = id === 'alle' ? events.length : events.filter(e => wemGehoert(e) === id).length;
            return (
              <button key={id} onClick={() => setSicht(id)} style={{
                fontFamily: T.sans, fontSize: 12.5, fontWeight: an ? 700 : 500, padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                border: `1px solid ${an ? T.accent : T.line}`, background: an ? T.accentSoft : 'transparent', color: an ? T.accent : T.inkDim,
              }}>{label} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{n}</span></button>
            );
          })}
          <button onClick={() => setAnlegen(v => !v)} style={{
            marginLeft: 'auto', fontFamily: T.sans, fontSize: 12.5, fontWeight: 700, padding: '6px 14px', borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${T.accent}`, background: anlegen ? T.accentSoft : 'transparent', color: T.accent,
          }}>+ Termin anlegen</button>
          <button onClick={() => setZeigeEinst(v => !v)} title="Kalender-Einstellungen" style={{
            fontFamily: T.mono, fontSize: 11, padding: '6px 11px', borderRadius: 9, cursor: 'pointer',
            border: `1px solid ${T.line}`, background: 'transparent', color: T.muted,
          }}>⚙</button>
        </div>

        {/* Selbst eintragen — Termin, Fokus, Routine, Aufgabe oder Reha */}
        {anlegen && (
          <div style={{ ...panel, padding: '16px 20px', marginTop: 12 }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Neuer Eintrag</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
              {ARTEN.map(a => (
                <button key={a.id} onClick={() => { setArt(a.id); setDauer(einst.dauer[a.id]); }} style={{
                  fontFamily: T.sans, fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${art === a.id ? a.farbe : T.line}`, background: art === a.id ? `${a.farbe}1c` : 'transparent',
                  color: art === a.id ? a.farbe : T.inkDim,
                }}>{a.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 210 }}>
                <span style={lbl}>Was</span>
                <input value={titel} onChange={e => setTitel(e.target.value)} placeholder={ARTEN.find(a => a.id === art)?.beispiel}
                  style={feld} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Für wen</span>
                <select value={wer} onChange={e => setWer(e.target.value as Wer)} style={{ ...feld, cursor: 'pointer' }}>
                  <option value="kevin" style={{ background: T.panel }}>Kevin</option>
                  <option value="malin" style={{ background: T.panel }}>Malin</option>
                  <option value="beide" style={{ background: T.panel }}>Gemeinsam</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Tag</span>
                <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={feld} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Ab</span>
                <input type="time" value={zeit} onChange={e => setZeit(e.target.value)} step={900} style={feld} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={lbl}>Minuten</span>
                <input type="number" min={5} max={600} step={5} value={dauer} onChange={e => setDauer(Number(e.target.value) || 0)}
                  style={{ ...feld, width: 84 }} />
              </label>
              <button onClick={eintragen} disabled={!titel.trim() || speichert} style={{
                fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 17px', borderRadius: 9, border: 'none',
                cursor: !titel.trim() || speichert ? 'default' : 'pointer',
                background: !titel.trim() || speichert ? T.line : T.accent, color: !titel.trim() || speichert ? T.muted : '#04110F',
              }}>{speichert ? 'trägt ein …' : 'In den Kalender'}</button>
            </div>
            {anlegenInfo && <div style={{ fontSize: 12.5, color: anlegenInfo.startsWith('✓') ? T.accent : T.crit, marginTop: 9 }}>{anlegenInfo}</div>}
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 9 }}>
              Landet in „{einst.kalender[wer]}" — gepflegt wird weiter im Apple-Kalender, MAKE OS schreibt nur hinein.
            </div>
          </div>
        )}

        {/* Einstellungen: welcher Kalender gehört wem, wie lange dauert was */}
        {zeigeEinst && (
          <div style={{ ...panel, padding: '16px 20px', marginTop: 12 }}>
            <div style={{ ...lbl, marginBottom: 10 }}>Kalender-Einstellungen</div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 12 }}>
              {(['kevin', 'malin', 'beide'] as const).map(w => (
                <label key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={lbl}>Kalender {w === 'beide' ? 'gemeinsam' : w}</span>
                  <input value={einst.kalender[w]} onChange={e => einstSetzen({ kalender: { ...einst.kalender, [w]: e.target.value } })}
                    placeholder="Name in der Kalender-App" style={{ ...feld, width: 170 }} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {ARTEN.map(a => (
                <label key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={lbl}>{a.label} · Min.</span>
                  <input type="number" min={5} max={600} step={5} value={einst.dauer[a.id]}
                    onChange={e => einstSetzen({ dauer: { ...einst.dauer, [a.id]: Number(e.target.value) || 5 } })}
                    style={{ ...feld, width: 84 }} />
                </label>
              ))}
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 10 }}>
              Die Namen müssen genau so heißen wie in der Kalender-App — sonst landet alles im gemeinsamen Kalender.
            </div>
          </div>
        )}

        {/* Aktionsleiste */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '18px 0 16px' }}>
          <button onClick={analyse} disabled={analysing || loading || !!loadErr} style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700, padding: '9px 16px', borderRadius: 9, border: 'none', cursor: analysing || loading || loadErr ? 'default' : 'pointer', background: analysing || loading || loadErr ? T.line : T.accent, color: analysing || loading || loadErr ? T.muted : '#04110F' }}>
            {analysing ? 'analysiere …' : 'Woche analysieren & schützen'}
          </button>
          <button onClick={load} style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, padding: '9px 14px', borderRadius: 9, border: `1px solid ${T.line}`, background: 'transparent', color: T.inkDim, cursor: 'pointer' }}>↻ Termine neu laden</button>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{loading ? 'lade …' : loadErr ? '' : `${upcoming.length} Termine · ${conflicts.length} Konflikte`}</span>
        </div>

        {loadErr && (
          <div style={{ ...panel, borderColor: `${T.crit}55`, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: T.inkDim, lineHeight: 1.5 }}>
            <b style={{ color: T.crit }}>Kein Kalender-Zugriff.</b> Systemeinstellungen → Datenschutz & Sicherheit → Kalender → Node.js/Terminal erlauben. <span style={{ color: T.muted }}>({loadErr.slice(0, 120)})</span>
          </div>
        )}

        {/* KI-Briefing */}
        {briefing && (
          <div style={{ ...panel, borderTop: `2px solid ${T.accent}`, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ ...lbl, marginBottom: 6 }}>Briefing</div>
            <div style={{ fontSize: 14, color: T.ink, lineHeight: 1.55 }}>{briefing}</div>
          </div>
        )}

        {/* Konflikte */}
        {conflicts.length > 0 && (
          <div style={{ ...panel, borderColor: `${T.crit}44`, padding: '14px 18px', marginBottom: 16 }}>
            <div style={{ ...lbl, color: T.crit, marginBottom: 8 }}>Konflikte ({conflicts.length})</div>
            {conflicts.map(c => (
              <div key={conflictKey(c)} style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.6 }}>
                <span style={{ color: T.crit }}>⨯</span> {dayLabel(c.date)} — <b style={{ color: T.ink }}>{c.a}</b> ⨯ <b style={{ color: T.ink }}>{c.b}</b> <span style={{ color: T.muted }}>({c.overlap})</span>
              </div>
            ))}
          </div>
        )}

        {/* Vorschläge */}
        {blocks.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={lbl}>Schutz-Blöcke ({blocks.length})</div>
              <button onClick={addAll} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 8, border: `1px solid ${T.accent}`, background: `${T.accent}22`, color: T.accent, cursor: 'pointer' }}>Alle eintragen</button>
            </div>
            <div style={{ ...panel, overflow: 'hidden' }}>
              {blocks.map((b, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: i ? `1px solid ${T.lineSoft}` : 0, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{dayLabel(b.date)} · {String(b.startHour).padStart(2, '0')}:{String(b.startMin ?? 0).padStart(2, '0')} · {b.durationMin} Min · <span style={{ color: calColor(b.calendar) }}>{b.calendar}</span></div>
                    {b.grund && <div style={{ fontSize: 12.5, color: T.inkDim, marginTop: 4, lineHeight: 1.4 }}>{b.grund}</div>}
                  </div>
                  <button onClick={() => addBlock(b, i)} disabled={added[i] === 'busy' || added[i] === 'ok'} style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 8, whiteSpace: 'nowrap', cursor: added[i] === 'ok' ? 'default' : 'pointer', border: `1px solid ${added[i] === 'err' ? T.crit : T.accent}`, background: added[i] === 'ok' ? 'transparent' : `${T.accent}22`, color: added[i] === 'err' ? T.crit : T.accent }}>
                    {added[i] === 'ok' ? '✓ eingetragen' : added[i] === 'busy' ? '…' : added[i] === 'err' ? 'Fehler' : 'In Kalender legen'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wochen-Übersicht */}
        {!loadErr && (
          <div>
            <div style={{ ...lbl, marginBottom: 10 }}>Deine nächsten 7 Tage</div>
            {loading ? (
              <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>lade Termine …</div>
            ) : days.length === 0 ? (
              <div style={{ ...panel, padding: '22px', textAlign: 'center', color: T.inkDim, fontSize: 13 }}>Keine Termine in den nächsten Tagen.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {days.map(k => (
                  <div key={k} style={{ ...panel, padding: '12px 16px' }}>
                    <div style={{ fontFamily: T.mono, fontSize: 11, color: k === TODAY ? T.accent : T.inkDim, marginBottom: 8, letterSpacing: '.05em' }}>{dayLabel(k)}{k === TODAY ? ' · heute' : ''}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {byDay[k].map(e => {
                        const clash = conflictTitles.has(`${k}|${e.title}`);
                        return (
                          <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, width: 46, flex: '0 0 auto' }}>{e.allDay ? 'ganzt.' : fmtTime(e.startDate)}</span>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: calColor(e.calendarName), flex: '0 0 auto', marginTop: 5 }} />
                            <span style={{ fontSize: 13.5, color: T.ink }}>{e.title}{clash && <span style={{ color: T.crit, marginLeft: 6, fontSize: 11 }}>⨯ Konflikt</span>}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
