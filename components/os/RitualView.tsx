'use client';

import Link from 'next/link';
// ─── MAKE OS — Tagesstart & Tagesende ───────────────────────────────────────
// Kevins 5–10-Minuten-Ritual, morgens und abends. Jeder Schritt hakt sich
// SELBST ab, sobald die echten Daten da sind (Vitals eingetragen, Journal
// geschrieben, Fokus gesetzt, an-/abgemeldet) — kein doppeltes Abhaken.
// Morgens: anmelden → wie gepennt → Kurz-Journal → Fokus → Tag checken.
// Abends: Routinen → Abend-Journal → Blick auf morgen → ausloggen.
// 24.09.: auf das lebendige Muster umgezogen — jeder Schritt ist eine Karte.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNachspeichern } from '@/lib/make-one/nachspeichern';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { PlanBlock } from '@/types/planer';
import { localDay } from '@/lib/zeit';
import { useTasks } from '@/context/TasksContext';
import { Seite, Karte, Chip, Knopf, Segmente, feld, LEUCHT } from './schlank';

interface Vitals { rec?: number; sleep?: number; hrv?: number; rhr?: number; note?: string }
interface JournalEintrag { text?: string; mood?: number; energy?: number; stress?: number; flags?: string[]; at?: string; tagesnote?: number }
interface Modus { an: boolean; seit: string | null; aktivMin: number }

const link = { fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' as const };
const zahlenFeld = { ...feld, width: 'auto', flex: '1 1 96px', minWidth: 0 } as const;

function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}
const stunden = (min: number) => `${(min / 60).toFixed(1).replace('.', ',')} h`;

/** Ein Ritual-Schritt: eine Karte, die sich selbst abhakt, wenn `done` wahr ist. */
function Schritt({ nr, titel, done, children }: { nr: number; titel: string; done: boolean; children: ReactNode }) {
  return (
    <Karte i={nr}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{
          width: 26, height: 26, borderRadius: '50%', flex: '0 0 auto', display: 'grid', placeItems: 'center',
          fontFamily: SCHRIFT.display, fontSize: TYP.bedien, fontWeight: 700, transition: 'background .2s ease, box-shadow .2s ease',
          background: done ? LEUCHT.gut : 'rgba(255,255,255,.08)', color: done ? C.grund : C.inkLeise, boxShadow: done ? `0 0 12px ${LEUCHT.gut}33` : undefined,
        }}>{done ? <span className="check-pop">✓</span> : nr}</span>
        <span style={{ fontSize: TYP.body, fontWeight: 700, color: done ? C.inkDim : C.ink }}>{titel}</span>
      </div>
      <div style={{ paddingLeft: 'clamp(0px, 4vw, 38px)' }}>{children}</div>
    </Karte>
  );
}

/** 1–5-Skala als klickbare Punkte. */
function Skala({ wert, setzen, farbe }: { wert?: number; setzen: (n: number) => void; farbe: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, verticalAlign: 'middle' }}>
      {[1, 2, 3, 4, 5].map(n => {
        const an = !!wert && n <= wert;
        return (
          <button key={n} onClick={() => setzen(n)} aria-label={`${n}`} className="fassbar" style={{
            width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', border: 'none', display: 'inline-grid', placeItems: 'center',
            fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700, transition: 'background .15s ease',
            background: an ? farbe : 'rgba(255,255,255,.08)', color: an ? C.grund : C.inkLeise, boxShadow: an ? `0 0 8px ${farbe}33` : undefined,
          }}>{n}</button>
        );
      })}
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
  const alleFertig = modusTab === 'morgen' ? mDone === 6 : aDone === 5;

  // Zonen-Reaktion direkt nach der Eingabe — das eine Urteil des Morgens.
  const recHeute = vitalsLog[heute]?.rec;
  const zoneR = recHeute != null
    ? recHeute >= 66 ? { l: 'GRÜN', c: LEUCHT.gut, txt: 'volle Ladung — heute darf hart gefahren werden.' }
      : recHeute >= 40 ? { l: 'GELB', c: LEUCHT.achtung, txt: 'halbe Ladung — zwei gute Blöcke, Pausen ernst nehmen.' }
      : { l: 'ROT', c: LEUCHT.kritisch, txt: 'Erhaltungsmodus — heute bewusst leichter planen, Rücken schonen.' }
    : null;
  const erledigtHeute = tasksState.tasks.filter(t => t.status === 'done' && t.dueDate === heute).length;

  const datum = new Date(`${heute}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const hinweis = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 8 } as const;

  return (
    <Seite
      titel={modusTab === 'morgen' ? 'Rein in den Tag.' : 'Raus aus dem Tag.'}
      unter={<>{modusTab === 'morgen' ? 'Tagesstart' : 'Tagesende'} · {datum} — 10–15 Minuten für dich, zahlt direkt auf Gesundheit & Energie ein. Jeder Schritt hakt sich selbst ab, sobald er wirklich passiert ist.{gespeichert && <span style={{ color: LEUCHT.gut }}> {gespeichert}</span>}</>}
      rechts={<div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip farbe={alleFertig ? LEUCHT.gut : LEUCHT.achtung}>{modusTab === 'morgen' ? `${mDone}/6` : `${aDone}/5`}</Chip>
        <Segmente liste={[{ id: 'morgen', label: 'Morgen' }, { id: 'abend', label: 'Abend' }]} aktiv={modusTab} onWahl={setModusTab} />
      </div>}
      breit={760}
    >
      {/* Fortschritt als Segmente — ein Blick zeigt, was noch fehlt */}
      <div className="os-auf" style={{ display: 'flex', gap: 4 }}>
        {(modusTab === 'morgen' ? Object.values(mSchritte) : Object.values(aSchritte)).map((ok, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: ok ? LEUCHT.gut : 'rgba(255,255,255,.08)', boxShadow: ok ? `0 0 8px ${LEUCHT.gut}33` : undefined, transition: 'background .3s ease' }} />
        ))}
      </div>

      {modusTab === 'morgen' ? (
        <>
          <Schritt nr={1} titel="Anmelden — der Tag läuft" done={mSchritte.an}>
            {arbeit?.an
              ? <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>AN seit {arbeit.seit} · bisher {stunden(arbeit.aktivMin)} aktiv.</span>
              : <Knopf onClick={() => arbeitToggle('an')} farbe={LEUCHT.gut}>● AN — Arbeitszeit läuft</Knopf>}
          </Schritt>

          <Schritt nr={2} titel="Die Lage — Jarvis zieht alle Daten zusammen" done={mSchritte.lage}>
            {lauf?.ausrichtung ? (
              <div style={hinweis}>
                {lauf.ausrichtung.gruss && <div style={{ marginBottom: 4 }}>{lauf.ausrichtung.gruss} <span style={{ fontSize: TYP.mikro, color: C.inkLeise }}>Stand {lauf.gestartet.slice(11, 16)} Uhr</span></div>}
                {(lauf.ausrichtung.prioritaeten ?? []).slice(0, 3).map((p, i) => (
                  <div key={i}><b style={{ color: C.ink }}>{i + 1}. {p.titel}</b>{p.wann ? <span style={{ color: C.inkLeise }}> · {p.wann}</span> : null}</div>
                ))}
                {lauf.ausrichtung.schutz && <div style={{ color: C.aktiv, marginTop: 4 }}>◇ {lauf.ausrichtung.schutz}</div>}
              </div>
            ) : (
              <div style={{ ...hinweis, color: C.inkLeise }}>Noch kein Lauf heute — Postfach, Kalender und Aufgaben werden vom Loop zusammengezogen.</div>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Knopf onClick={lageZiehen} aus={zieht} farbe={LEUCHT.agenten}>
                {zieht ? 'zieht zusammen …' : laufHeute > 0 ? 'Lage frisch ziehen' : '⟳ Lage jetzt ziehen'}
              </Knopf>
              <Link href="/os/tageslauf" style={link}>Ganzer Tageslauf ›</Link>
            </div>
          </Schritt>

          <Schritt nr={3} titel="Wie gepennt? (Whoop-Werte)" done={mSchritte.vitals}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={vEingabe.rec} onChange={e => setVEingabe({ ...vEingabe, rec: e.target.value })} placeholder="Recovery %" type="number" style={zahlenFeld} />
              <input value={vEingabe.sleep} onChange={e => setVEingabe({ ...vEingabe, sleep: e.target.value })} placeholder="Schlaf h" style={zahlenFeld} />
              <input value={vEingabe.hrv} onChange={e => setVEingabe({ ...vEingabe, hrv: e.target.value })} placeholder="HRV" type="number" style={zahlenFeld} />
              <input value={vEingabe.rhr} onChange={e => setVEingabe({ ...vEingabe, rhr: e.target.value })} placeholder="Puls" type="number" style={zahlenFeld} />
              <input value={vEingabe.note} onChange={e => setVEingabe({ ...vEingabe, note: e.target.value })} placeholder="Notiz (z.B. Rücken zieht)" style={{ ...feld, width: 'auto', flex: '2 1 160px', minWidth: 0 }} />
              <Knopf onClick={vitalsSpeichern}>Speichern</Knopf>
            </div>
            {zoneR && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
                <Chip farbe={zoneR.c}>● {zoneR.l}</Chip>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{zoneR.txt}</span>
              </div>
            )}
            {mSchritte.vitals && !zoneR && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Heute schon da — neue Eingabe überschreibt nur die ausgefüllten Felder.</div>}
          </Schritt>

          <Schritt nr={4} titel="Kurz-Journal — wie geht's rein?" done={mSchritte.journal}>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, display: 'inline-flex', gap: 8, alignItems: 'center' }}>Stimmung <Skala wert={j.mood} setzen={n => journalSetzen({ mood: n })} farbe={LEUCHT.gut} /></span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, display: 'inline-flex', gap: 8, alignItems: 'center' }}>Energie <Skala wert={j.energy} setzen={n => journalSetzen({ energy: n })} farbe={LEUCHT.achtung} /></span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, display: 'inline-flex', gap: 8, alignItems: 'center' }}>Stress <Skala wert={j.stress} setzen={n => journalSetzen({ stress: n })} farbe={LEUCHT.kritisch} /></span>
            </div>
            <Link href="/os/journal" style={link}>Mehr im Journal ›</Link>
          </Schritt>

          <Schritt nr={5} titel="Fokus des Tages" done={mSchritte.fokus}>
            <input value={fokusTag} onChange={e => fokusSpeichern(e.target.value)} placeholder="Der eine Satz: worauf liegt heute der Fokus?"
              style={{ ...feld, fontWeight: 600 }} />
          </Schritt>

          <Schritt nr={6} titel="Tag bauen — Blöcke, Kollisionen, Delegation" done={mSchritte.plan}>
            <div style={hinweis}>
              {heuteBloecke.length
                ? `${heuteBloecke.length} Block${heuteBloecke.length > 1 ? ' e' : ''} für heute geplant.`
                : 'Noch nichts für heute geplant — kurz reinschauen und die Lücken füllen.'}
            </div>
            {(faelligHeute.length > 0 || ueberfaellig.length > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                {faelligHeute.length > 0 && <Chip farbe={LEUCHT.achtung}>{faelligHeute.length} heute fällig</Chip>}
                {ueberfaellig.length > 0 && <><Chip farbe={LEUCHT.kritisch}>{ueberfaellig.length} überfällig</Chip><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>erledigen, delegieren oder ehrlich neu terminieren.</span></>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link href="/os/planung" style={link}>Tagesplanung ›</Link>
              <Link href="/os/aufgaben" style={link}>Aufgaben & Delegation ›</Link>
            </div>
          </Schritt>
        </>
      ) : (
        <>
          <Schritt nr={1} titel="Routinen abschließen" done={aSchritte.routinen}>
            <div style={hinweis}>{routinen.erledigt}/{routinen.gesamt} heute abgehakt.</div>
            <Link href="/os/planung" style={link}>Abhaken in der Tagesplanung ›</Link>
          </Schritt>

          <Schritt nr={2} titel="Tag bewerten — der Tag in Zahlen" done={aSchritte.bewertung}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Wie war der Tag?</span>
              <Skala wert={j.tagesnote} setzen={n => journalSetzen({ tagesnote: n })} farbe={LEUCHT.gut} />
            </div>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>
              {arbeit ? `Arbeitszeit ${stunden(arbeit.aktivMin)}` : ''} · Routinen {routinen.erledigt}/{routinen.gesamt} · {heuteBloecke.length} Blöcke geplant · {erledigtHeute} fällige erledigt
            </div>
          </Schritt>

          <Schritt nr={3} titel="Ein Satz zum Tag" done={aSchritte.journal}>
            <textarea value={abendText} onChange={e => { setAbendText(e.target.value); journalSetzen({ text: e.target.value }); }}
              placeholder="»Hat alles super geklappt, geile Gespräche« zählt auch — was war gut, was nehme ich mit?"
              rows={3} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} />
          </Schritt>

          <Schritt nr={4} titel="Blick auf morgen" done={aSchritte.morgen}>
            <div style={hinweis}>
              {morgenBloecke.length
                ? `${morgenBloecke.length} Block${morgenBloecke.length > 1 ? ' e' : ''} für morgen geplant — der Tag ist vorbereitet.`
                : 'Morgen ist noch leer — zwei, drei Blöcke reichen, dann startet der Morgen ohne Denken.'}
            </div>
            <Link href="/os/planung/woche" style={link}>Wochenplaner öffnen ›</Link>
          </Schritt>

          <Schritt nr={5} titel="Ausloggen — Feierabend ist Feierabend" done={aSchritte.aus}>
            {arbeit?.an
              ? <Knopf onClick={() => arbeitToggle('aus')} farbe={LEUCHT.kritisch}>○ AUS — Session beenden</Knopf>
              : <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{arbeit && arbeit.aktivMin > 0 ? `Ausgeloggt · heute ${stunden(arbeit.aktivMin)} aktiv gearbeitet.` : 'Heute keine Arbeits-Session erfasst.'}</span>}
          </Schritt>
        </>
      )}
    </Seite>
  );
}
