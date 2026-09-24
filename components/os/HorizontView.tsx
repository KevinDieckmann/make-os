'use client';

import Link from 'next/link';
// ─── MAKE OS — Planung nach Horizont (Monat · Quartal · Jahr) ───────────────
// Eine Seite je Zeithorizont: Ziele (editierbar, mit Fortschritt) + die
// Aufgaben, die in diesem Zeitraum fällig sind + beim Jahr die Meilensteine
// und der Nordstern. Die Zielebene ÜBER dem Taskmanagement.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile/Haken/Zahl).

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { listeSchreiben } from '@/lib/make-one/liste-sync';
import { PlanerLeiste } from './PlanerLeiste';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { NORDSTERN } from '@/lib/make-one/nordstern-data';
import { Zeitstrahl, type StrahlMarker, type StrahlTick } from './Zeitstrahl';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Haken, Zahl, feld, prioFarbe, LEUCHT } from './schlank';

interface Ziel { id: string; titel: string; fortschritt: number; notiz?: string; erledigt?: boolean }
interface Meilenstein { id: string; titel: string; bereich: 'business' | 'gesundheit'; faellig?: string; zeitfenster?: string; messlatte?: string; fortschritt: number; erledigt: boolean; erledigtAm?: string }
type Horizont = 'monat' | 'quartal' | 'jahr';

const META: Record<Horizont, { titel: string; claim: string; hinweis: string }> = {
  monat: { titel: 'Monatsplanung', claim: 'Was diesen Monat zählt.', hinweis: '3–5 Ziele — mehr ist Verzettelung.' },
  quartal: { titel: 'Quartalsplanung', claim: 'Die Etappe zum Jahresziel.', hinweis: 'Welche 3 Dinge müssen in 3 Monaten stehen?' },
  jahr: { titel: 'Jahresplanung & Ziele', claim: 'Das Jahr, an dem du dich misst.', hinweis: 'Nordstern + Meilensteine + deine Jahresziele.' },
};
/** Eine Farbe je Horizont — dieselbe wie auf der Wachstums-Seite. */
const HFARBE: Record<Horizont, string> = { jahr: LEUCHT.schlaf, quartal: LEUCHT.puls, monat: LEUCHT.gut };

const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);
const prozent = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' as const, width: 40, textAlign: 'right' as const, flex: '0 0 auto' };
const loeschen = { fontSize: TYP.bedien, color: C.inkLeise, background: 'transparent', border: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '2px 4px' } as const;
const wahl = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark' as const, outline: 'none' };

/** Zeitraum-Grenzen des Horizonts (lokal). */
function zeitraum(h: Horizont): { von: string; bis: string; label: string } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  if (h === 'monat') {
    const m = d.getMonth();
    return { von: `${y}-${p(m + 1)}-01`, bis: `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}`, label: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  }
  if (h === 'quartal') {
    const q = Math.floor(d.getMonth() / 3);
    return { von: `${y}-${p(q * 3 + 1)}-01`, bis: `${y}-${p(q * 3 + 3)}-${p(new Date(y, q * 3 + 3, 0).getDate())}`, label: `Q${q + 1} ${y}` };
  }
  return { von: `${y}-01-01`, bis: `${y}-12-31`, label: String(y) };
}

export function HorizontView({ horizont }: { horizont: Horizont }) {
  const meta = META[horizont];
  const zr = zeitraum(horizont);
  const farbe = HFARBE[horizont];
  const { state: tasksState } = useTasks();
  const [ziele, setZiele] = useState<Ziel[]>([]);
  const [fokus, setFokus] = useState('');
  const [neu, setNeu] = useState('');
  const [geladen, setGeladen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Zuletzt gelesener/geschriebener Stand — Basis für die Unterschiede. */
  const gespeichert = useRef<Meilenstein[] | null>(null);

  useEffect(() => {
    fetch('/api/state/ziele').then(r => r.json()).then(d => {
      setZiele(Array.isArray(d[horizont]) ? d[horizont] : []);
      setFokus(d.fokus?.[horizont] ?? '');
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, [horizont]);

  // Meilensteine — pflegbarer Store (Jahr verwaltet, Monat zeigt die nächsten).
  const [ms, setMs] = useState<Meilenstein[]>([]);
  const [msNeu, setMsNeu] = useState({ titel: '', bereich: 'business' as Meilenstein['bereich'], faellig: '' });
  const msTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    fetch('/api/state/meilensteine').then(r => r.json()).then(d => { const l = Array.isArray(d.meilensteine) ? d.meilensteine : []; gespeichert.current = l; setMs(l); }).catch(() => {});
  }, [horizont]);
  function msPersist(next: Meilenstein[]) {
    setMs(next);
    clearTimeout(msTimer.current);
    msTimer.current = setTimeout(() => {
      const alt = gespeichert.current;
      gespeichert.current = next;
      void listeSchreiben<Meilenstein>('/api/state/meilensteine', 'meilensteine', alt, next);
    }, 500);
  }
  const msPatch = (id: string, p: Partial<Meilenstein>) => msPersist(ms.map(m => m.id === id ? { ...m, ...p } : m));
  const msFaelligLabel = (m: Meilenstein) => m.faellig ? `${m.faellig.slice(8)}.${m.faellig.slice(5, 7)}.` : (m.zeitfenster ?? '');

  function persist(next: Ziel[]) {
    setZiele(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont, ziele: next }) }).catch(() => {});
    }, 500);
  }

  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function fokusSetzen(v: string) {
    setFokus(v);
    clearTimeout(fokusTimer.current);
    fokusTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont, fokus: v }) }).catch(() => {});
    }, 600);
  }

  const addZiel = () => {
    const t = neu.trim();
    if (!t) return;
    persist([...ziele, { id: `z-${Date.now().toString(36)}`, titel: t, fortschritt: 0 }]);
    setNeu('');
  };

  // Aufgaben, die in diesem Zeitraum fällig sind.
  const heute = localDay();
  const faellig = tasksState.tasks
    .filter(t => t.status !== 'done' && t.dueDate && t.dueDate >= zr.von && t.dueDate <= zr.bis)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const schnitt = ziele.length ? Math.round(ziele.reduce((s, z) => s + (z.erledigt ? 100 : z.fortschritt), 0) / ziele.length) : null;

  // Zeitstrahl: Ticks je Horizont, darauf offene Meilensteine + (Monat) fällige Aufgaben.
  const MON_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const p2 = (n: number) => String(n).padStart(2, '0');
  const ticks: StrahlTick[] = (() => {
    const y = zr.von.slice(0, 4);
    if (horizont === 'jahr') return MON_KURZ.map((l, i) => ({ date: `${y}-${p2(i + 1)}-01`, label: l }));
    if (horizont === 'quartal') {
      const m0 = Number(zr.von.slice(5, 7));
      return [0, 1, 2].map(i => ({ date: `${y}-${p2(m0 + i)}-01`, label: MON_KURZ[m0 + i - 1] }));
    }
    const letzter = Number(zr.bis.slice(8));
    return [1, 8, 15, 22, 29].filter(t => t <= letzter).map(t => ({ date: `${zr.von.slice(0, 8)}${p2(t)}`, label: `${t}.` }));
  })();
  const strahlMarker: StrahlMarker[] = ms
    .filter(m => !m.erledigt && m.faellig)
    .map(m => ({ date: m.faellig!, label: m.titel, farbe: m.bereich === 'gesundheit' ? LEUCHT.gut : LEUCHT.achtung, symbol: '◇', href: horizont === 'jahr' ? undefined : '/os/planung/jahr' }));
  if (horizont === 'monat') {
    const proTag: Record<string, string[]> = {};
    faellig.forEach(t => { proTag[t.dueDate!] = [...(proTag[t.dueDate!] ?? []), t.title]; });
    Object.keys(proTag).forEach(d => {
      const titel = proTag[d];
      strahlMarker.push({ date: d, label: titel.length === 1 ? titel[0] : `${titel.length} Aufgaben`, farbe: C.inkDim, symbol: '●', titel: titel.join(' · '), href: '/os/aufgaben' });
    });
  }

  // Forecast: Zeit verstrichen vs. Fortschritt — ehrlich gerechnet, nicht geraten.
  const verstrichen = (() => {
    const von = new Date(`${zr.von}T00:00:00`).getTime();
    const bis = new Date(`${zr.bis.slice(0, 8)}${Math.min(31, Number(zr.bis.slice(8)))}T23:59:59`).getTime();
    const jetzt = Date.now();
    if (jetzt <= von) return 0;
    if (jetzt >= bis) return 100;
    return Math.round(((jetzt - von) / (bis - von)) * 100);
  })();
  const prognose = schnitt != null && verstrichen > 5 ? Math.min(150, Math.round((schnitt / verstrichen) * 100)) : null;
  const prognoseFarbe = prognose == null ? C.inkLeise : prognose >= 95 ? LEUCHT.gut : prognose >= 70 ? LEUCHT.achtung : LEUCHT.kritisch;

  const offeneMs = ms.filter(m => !m.erledigt).sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999'));
  const fokusTitel = horizont === 'jahr' ? 'Fokus des Jahres' : horizont === 'quartal' ? 'Fokus des Quartals' : 'Fokus des Monats';
  let k = 0; // laufender Karten-Index fürs gestaffelte Erscheinen

  return (
    <Seite
      titel={meta.claim}
      unter={<>{meta.titel} · {zr.label} — {meta.hinweis}</>}
      rechts={schnitt != null ? <Chip farbe={col(schnitt)}>Ziele Ø {schnitt} %</Chip> : undefined}
    >
      <PlanerLeiste aktiv={horizont} />

      {/* Fokus dieses Horizonts — die eine Richtung, gegen die geplant wird */}
      <Karte i={k++} akzent={farbe}>
        <Ueberschrift farbe={farbe} rechts="Sichtbar im Wochenplaner und in der Tagesplanung — Jarvis plant dagegen.">{fokusTitel}</Ueberschrift>
        <input value={fokus} onChange={e => fokusSetzen(e.target.value)} aria-label={fokusTitel}
          placeholder={horizont === 'monat' ? 'z. B. Gesundheit stabilisieren + F&F-Kunden onboarden' : 'Woran richtet sich alles aus?'}
          style={{ ...feld, fontWeight: 600 }} />
      </Karte>

      {/* Zeitstrahl — der Zeitraum als Linie: Heute-Anker, Meilensteine, Fälligkeiten */}
      <Zeitstrahl von={zr.von} bis={zr.bis} ticks={ticks} marker={strahlMarker} />

      {/* Forecast — Zeit vs. Fortschritt, deterministisch */}
      {schnitt != null && prognose != null && (
        <Karte i={k++}>
          <Ueberschrift farbe={prognoseFarbe}>Forecast</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
            <Zahl wert={String(verstrichen)} label="% der Zeit vorbei" />
            <Zahl wert={String(schnitt)} label="% Ziele im Schnitt" farbe={col(schnitt)} />
            <Zahl wert={String(prognose)} label="% am Ende bei diesem Tempo" farbe={prognoseFarbe} />
          </div>
          <p style={{ fontSize: TYP.body, fontWeight: 600, color: prognoseFarbe, margin: '14px 0 0' }}>
            → bei diesem Tempo ~{prognose} % am Ende{prognose < 95 ? ' — nachschärfen oder Ziel ehrlich kürzen' : ' — Kurs hält'}
          </p>
        </Karte>
      )}

      {/* Monat: die nächsten offenen Meilensteine — fällige zuerst, mit Fortschritt */}
      {horizont === 'monat' && (
        <Karte i={k++}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href="/os/planung/jahr" style={{ color: C.inkLeise, textDecoration: 'none' }}>pflegen ›</Link>}>Meilensteine im Blick</Ueberschrift>
          {!offeneMs.length && <Leer>Alle Meilensteine erledigt.</Leer>}
          <Liste>
            {offeneMs.slice(0, 6).map(m => {
              const spaet = !!m.faellig && m.faellig < localDay();
              const wann = msFaelligLabel(m);
              return (
                <Zeile key={m.id}
                  links={<Punkt farbe={spaet ? LEUCHT.kritisch : LEUCHT.achtung} />}
                  titel={m.titel}
                  unter={[wann ? `${spaet ? 'überfällig ' : ''}${wann}` : '', m.messlatte ?? ''].filter(Boolean).join(' · ') || undefined}
                  rechts={<Chip farbe={col(m.fortschritt)}>{m.fortschritt} %</Chip>} />
              );
            })}
          </Liste>
        </Karte>
      )}

      {/* Jahr: Nordstern + Meilenstein-Verwaltung (Business & Gesundheit) */}
      {horizont === 'jahr' && (
        <>
          <Karte i={k++}>
            <Ueberschrift farbe={LEUCHT.schlaf}>Nordstern</Ueberschrift>
            <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55, margin: 0 }}>{NORDSTERN}</p>
          </Karte>
          {(['business', 'gesundheit'] as const).map(bereich => {
            const bf = bereich === 'gesundheit' ? LEUCHT.gut : LEUCHT.business;
            const meine = ms.filter(m => m.bereich === bereich);
            return (
              <Karte key={bereich} i={k++}>
                <Ueberschrift farbe={bf} rechts="fließen in den MAKE Score">Meilensteine · {bereich === 'gesundheit' ? 'Gesundheit' : 'Business'}</Ueberschrift>
                {!meine.length && <Leer>Noch kein Meilenstein — unten einen anlegen.</Leer>}
                <Liste>
                  {meine.map(m => {
                    const spaet = !!m.faellig && m.faellig < localDay() && !m.erledigt;
                    const wann = msFaelligLabel(m);
                    return (
                      <Zeile key={m.id}
                        links={<Haken an={m.erledigt} farbe={bf} onChange={() => msPatch(m.id, { erledigt: !m.erledigt, fortschritt: !m.erledigt ? 100 : m.fortschritt, erledigtAm: !m.erledigt ? localDay() : undefined })} />}
                        titel={<span style={{ color: m.erledigt ? C.inkLeise : C.ink, textDecoration: m.erledigt ? 'line-through' : 'none' }}>{m.titel}</span>}
                        unter={wann || m.messlatte ? (
                          <>
                            {wann && <span style={{ color: spaet ? LEUCHT.kritisch : undefined }}>{spaet ? 'überfällig ' : ''}{wann}</span>}
                            {wann && m.messlatte ? ' · ' : ''}
                            {m.messlatte && <>Messlatte: {m.messlatte}</>}
                          </>
                        ) : undefined}
                        rechts={!m.erledigt ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                            <input type="range" min={0} max={100} step={5} value={m.fortschritt} aria-label="Fortschritt"
                              onChange={e => msPatch(m.id, { fortschritt: Number(e.target.value) })}
                              style={{ width: 'clamp(70px, 12vw, 110px)', accentColor: col(m.fortschritt) }} />
                            <span style={{ ...prozent, color: col(m.fortschritt) }}>{m.fortschritt} %</span>
                            <button onClick={() => msPersist(ms.filter(x => x.id !== m.id))} aria-label="Meilenstein löschen" style={loeschen}>✕</button>
                          </span>
                        ) : <Chip farbe={bf}>erledigt</Chip>} />
                    );
                  })}
                </Liste>
              </Karte>
            );
          })}
          <Karte i={k++}>
            <Ueberschrift>Neuer Meilenstein</Ueberschrift>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={msNeu.titel} onChange={e => setMsNeu({ ...msNeu, titel: e.target.value })} placeholder="Neuer Meilenstein …" aria-label="Titel"
                style={{ ...feld, width: 'auto', flex: '1 1 180px', minWidth: 0 }} />
              <input type="date" value={msNeu.faellig} onChange={e => setMsNeu({ ...msNeu, faellig: e.target.value })} aria-label="Fällig am"
                style={{ ...feld, width: 'auto', flex: '0 1 160px', colorScheme: 'dark' }} />
              <select value={msNeu.bereich} onChange={e => setMsNeu({ ...msNeu, bereich: e.target.value as Meilenstein['bereich'] })} aria-label="Bereich" style={wahl}>
                <option value="business">Business</option>
                <option value="gesundheit">Gesundheit</option>
              </select>
              <Knopf onClick={() => {
                if (!msNeu.titel.trim()) return;
                msPersist([...ms, { id: `ms-${Date.now().toString(36)}`, titel: msNeu.titel.trim(), bereich: msNeu.bereich, faellig: msNeu.faellig || undefined, fortschritt: 0, erledigt: false }]);
                setMsNeu({ titel: '', bereich: msNeu.bereich, faellig: '' });
              }}>+ Meilenstein</Knopf>
            </div>
          </Karte>
        </>
      )}

      {/* Ziele */}
      <Karte i={k++}>
        <Ueberschrift farbe={farbe} rechts={schnitt != null ? <span style={{ color: col(schnitt), fontWeight: 700 }}>Ø {schnitt} %</span> : undefined}>Ziele ({ziele.length})</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addZiel(); }} aria-label="Neues Ziel"
            placeholder={`Neues ${horizont === 'jahr' ? 'Jahres' : horizont === 'quartal' ? 'Quartals' : 'Monats'}ziel …`}
            style={{ ...feld, width: 'auto', flex: '1 1 200px', minWidth: 0 }} />
          <Knopf onClick={addZiel}>+ Ziel</Knopf>
        </div>
        {!geladen ? (
          <Leer>lade …</Leer>
        ) : !ziele.length ? (
          <Leer>Noch keine Ziele für {zr.label}. Was soll am Ende stehen?</Leer>
        ) : (
          <Liste>
            {ziele.map(z => {
              const v = z.erledigt ? 100 : z.fortschritt;
              return (
                <Zeile key={z.id}
                  links={<Haken an={!!z.erledigt} farbe={farbe} onChange={() => persist(ziele.map(x => x.id === z.id ? { ...x, erledigt: !x.erledigt } : x))} />}
                  titel={<span style={{ fontWeight: 600, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : 'none' }}>{z.titel}</span>}
                  rechts={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto', opacity: z.erledigt ? 0.6 : 1 }}>
                      <input type="range" min={0} max={100} step={5} value={v} aria-label="Fortschritt"
                        onChange={e => persist(ziele.map(x => x.id === z.id ? { ...x, fortschritt: Number(e.target.value) } : x))}
                        disabled={z.erledigt} style={{ width: 'clamp(70px, 14vw, 120px)', accentColor: col(v) }} />
                      <span style={{ ...prozent, color: col(v) }}>{v} %</span>
                      <button onClick={() => persist(ziele.filter(x => x.id !== z.id))} aria-label="Ziel löschen" style={loeschen}>✕</button>
                    </span>
                  } />
              );
            })}
          </Liste>
        )}
      </Karte>

      {/* Aufgaben im Zeitraum */}
      <Karte i={k++}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={faellig.length > 15 ? `die nächsten 15 von ${faellig.length}` : undefined}>Fällig in {zr.label} ({faellig.length})</Ueberschrift>
        {!faellig.length && <Leer>Keine terminierten Aufgaben in diesem Zeitraum.</Leer>}
        <Liste>
          {faellig.slice(0, 15).map(t => (
            <Link key={t.id} href="/os/aufgaben" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
              <Zeile
                links={<span style={{ fontSize: TYP.bedien, fontFamily: SCHRIFT.display, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.dueDate && t.dueDate < heute ? LEUCHT.kritisch : C.inkLeise, flex: '0 0 auto', width: 78 }}>{t.dueDate}</span>}
                titel={t.title}
                rechts={<Chip farbe={prioFarbe(t.priority)}>{t.priority}</Chip>} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}
