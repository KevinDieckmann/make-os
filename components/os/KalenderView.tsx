'use client';

// ─── MAKE OS — Kalender-Agent ───────────────────────────────────────────────
// Echte Termine aus Apple Kalender, Konflikte markiert; der Agent schlägt
// Reha- und Fokus-Blöcke in die freien Lücken vor — eintragen auf Klick.
// Sicht Alle/Kevin/Malin/Gemeinsam, eigener Eintrag, Einstellungen (welcher
// Apple-Kalender gehört wem, wie lange dauert was).
// 24.09.: auf das lebendige Muster umgezogen (Karten, Chips, Leuchtfarben).

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { FARBE as C, MIKRO, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Punkt, Segmente, feld, LEUCHT } from './schlank';

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
  kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Kalender' },
  dauer: { termin: 60, fokus: 90, routine: 30, aufgabe: 45, reha: 30 },
  vonStunde: 7, bisStunde: 20, standardSicht: 'alle',
};

/**
 * Die Arten, die Kevin und Malin wirklich haben. Das Präfix macht im Apple-
 * Kalender auf einen Blick sichtbar, worum es geht — dort gibt es keine Farben
 * je Art, nur den Titel.
 */
const ARTEN: { id: ArtId; label: string; farbe: string; praefix: string; beispiel: string }[] = [
  { id: 'termin', label: 'Termin', farbe: LEUCHT.puls, praefix: '', beispiel: 'Finanzmeeting mit Malin' },
  { id: 'fokus', label: 'Fokus', farbe: LEUCHT.schlaf, praefix: '◎ ', beispiel: 'Markttraktion durchrechnen' },
  { id: 'routine', label: 'Routine', farbe: LEUCHT.agenten, praefix: '↻ ', beispiel: 'Tagesstart' },
  { id: 'aufgabe', label: 'Aufgabe', farbe: LEUCHT.achtung, praefix: '✓ ', beispiel: 'Rechnung an One Finance' },
  { id: 'reha', label: 'Reha', farbe: LEUCHT.gut, praefix: '✚ ', beispiel: 'Rücken-Übungen' },
];
interface Block { title: string; date: string; startHour: number; startMin?: number; durationMin: number; calendar: string; grund?: string; }
interface AnalyseAntwort { briefing?: string; conflicts?: Conflict[]; vorschlaege?: Block[]; eingetragen?: boolean; }
interface Conflict { date: string; a: string; b: string; overlap: string; }

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Eingabe mit dunklem Datums-/Zeit-Wähler. */
const eingabe: CSSProperties = { ...feld, colorScheme: 'dark' };
const auswahl: CSSProperties = { background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark', cursor: 'pointer' };
const spalte: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 5 };
/** Wahlknopf in Kennzahlfarbe — Art des Eintrags. */
const wahl = (an: boolean, farbe: string): CSSProperties => ({
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
  background: an ? `${farbe}26` : 'rgba(255,255,255,.05)', color: an ? farbe : C.inkDim, transition: 'background .15s ease, color .15s ease',
});

/** Menschenfarben: Kevin blau, Malin rosa, KEMARIS orange, gemeinsam türkis. */
const calColor = (c?: string) => (c === 'Privat Kevin' ? LEUCHT.puls : c === 'Privat Malin' ? LEUCHT.beziehung : c === 'Kevin Dieckmann' ? LEUCHT.business : LEUCHT.geld);
const fmtTime = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayKey = (iso: string) => iso.slice(0, 10);
const dayLabel = (k: string) => { const d = new Date(`${k}T00:00:00`); return `${WD[d.getDay()]} · ${d.getDate()}.${d.getMonth() + 1}.`; };

function Absatz({ children, farbe }: { children: React.ReactNode; farbe?: string }) {
  return <div style={{ fontSize: TYP.bedien, color: farbe ?? C.inkDim, lineHeight: 1.55 }}>{children}</div>;
}

export function KalenderView() {
  // pro Render frisch — sonst steht das Datum bei offenem Tab über Mitternacht still
  const TODAY = localDay();
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

  // Sicht: wessen Kalender — Kevins Ansage: „Man soll sich jeweils die andere
  // Sicht angucken können, also Malin oder Kevin." Die Zuordnung kommt aus den
  // Einstellungen — dort steht, welcher Apple-Kalender zu wem gehört.
  const sichten: { id: 'alle' | Wer; label: string }[] = ([['alle', 'Alle'], ['kevin', 'Kevin'], ['malin', 'Malin'], ['beide', 'Gemeinsam']] as const).map(([id, label]) => {
    const n = id === 'alle' ? events.length : events.filter(e => wemGehoert(e) === id).length;
    return { id, label: `${label} ${n}` };
  });
  const artAktiv = ARTEN.find(a => a.id === art);
  const stimmt = !!titel.trim() && !speichert;

  return (
    <Seite
      titel="Kalender-Agent"
      unter={<>Die Woche schützt sich selbst: Konflikte markiert, Reha- & Fokus-Blöcke in den freien Lücken vorgeschlagen — eintragen tust du auf Klick. Hier stellst du auch ein, welcher Kalender wem gehört. Den Kalender selbst findest du oben unter <Link href="/os/planung/woche" style={{ color: LEUCHT.puls, textDecoration: 'none', fontWeight: 600 }}>Kalender ›</Link></>}
      rechts={<Chip farbe={LEUCHT.puls}>live · mit Freigabe</Chip>}
    >
      {/* Eingefroren: lieber sagen, dass es ein alter Stand ist, als so tun,
          als wäre er aktuell. */}
      {eingefroren && (
        <Karte i={0} akzent={LEUCHT.achtung}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={<Knopf leise onClick={() => fetch('/api/apple-calendar?refresh=1').then(load)}>Nochmal versuchen</Knopf>}>
            Eingefrorener Stand{stand ? ` vom ${new Date(stand).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} Uhr` : ''}
          </Ueberschrift>
          <Absatz>
            Der Apple-Kalender war gerade nicht erreichbar — du siehst den letzten guten Stand.
            Neue oder verschobene Termine fehlen hier möglicherweise.
            {frostGrund && <span style={{ color: C.inkLeise }}> ({frostGrund})</span>}
          </Absatz>
        </Karte>
      )}

      {/* Sicht + Aktionen */}
      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={loading ? 'lade …' : loadErr ? undefined : `${upcoming.length} Termine · ${conflicts.length} Konflikte`}>Sicht</Ueberschrift>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ maxWidth: '100%', overflowX: 'auto' }}><Segmente liste={sichten} aktiv={sicht} onWahl={setSicht} /></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <Knopf leise onClick={() => setAnlegen(v => !v)}>+ Termin anlegen</Knopf>
            <Knopf leise onClick={() => setZeigeEinst(v => !v)}>⚙ Einstellungen</Knopf>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <Knopf onClick={analyse} aus={analysing || loading || !!loadErr}>{analysing ? 'analysiere …' : 'Woche analysieren & schützen'}</Knopf>
          <Knopf leise onClick={load}>↻ Termine neu laden</Knopf>
        </div>
      </Karte>

      {/* Selbst eintragen — Termin, Fokus, Routine, Aufgabe oder Reha */}
      {anlegen && (
        <Karte i={2} akzent={artAktiv?.farbe}>
          <Ueberschrift farbe={artAktiv?.farbe}>Neuer Eintrag</Ueberschrift>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {ARTEN.map(a => (
              <button key={a.id} className="fassbar" onClick={() => { setArt(a.id); setDauer(einst.dauer[a.id]); }} style={wahl(art === a.id, a.farbe)}>{a.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ ...spalte, flex: '1 1 220px', minWidth: 'min(220px, 100%)' }}>
              <span style={MIKRO}>Was</span>
              <input value={titel} onChange={e => setTitel(e.target.value)} placeholder={artAktiv?.beispiel} style={feld} />
            </label>
            <label style={spalte}>
              <span style={MIKRO}>Für wen</span>
              <select value={wer} onChange={e => setWer(e.target.value as Wer)} style={auswahl}>
                <option value="kevin">Kevin</option>
                <option value="malin">Malin</option>
                <option value="beide">Gemeinsam</option>
              </select>
            </label>
            <label style={spalte}>
              <span style={MIKRO}>Tag</span>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={eingabe} />
            </label>
            <label style={spalte}>
              <span style={MIKRO}>Ab</span>
              <input type="time" value={zeit} onChange={e => setZeit(e.target.value)} step={900} style={eingabe} />
            </label>
            <label style={spalte}>
              <span style={MIKRO}>Minuten</span>
              <input type="number" min={5} max={600} step={5} value={dauer} onChange={e => setDauer(Number(e.target.value) || 0)} style={{ ...feld, width: 96 }} />
            </label>
            <Knopf onClick={eintragen} aus={!stimmt} farbe={artAktiv?.farbe}>{speichert ? 'trägt ein …' : 'In den Kalender'}</Knopf>
          </div>
          {anlegenInfo && <div style={{ fontSize: TYP.bedien, color: anlegenInfo.startsWith('✓') ? LEUCHT.gut : LEUCHT.kritisch, marginTop: 10 }}>{anlegenInfo}</div>}
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>
            Landet in „{einst.kalender[wer]}“ — gepflegt wird weiter im Apple-Kalender, MAKE OS schreibt nur hinein.
          </div>
        </Karte>
      )}

      {/* Einstellungen: welcher Kalender gehört wem, wie lange dauert was */}
      {zeigeEinst && (
        <Karte i={3}>
          <Ueberschrift>Kalender-Einstellungen</Ueberschrift>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {(['kevin', 'malin', 'beide'] as const).map(w => (
              <label key={w} style={{ ...spalte, flex: '1 1 170px', minWidth: 'min(170px, 100%)' }}>
                <span style={MIKRO}>Kalender {w === 'beide' ? 'gemeinsam' : w}</span>
                <input value={einst.kalender[w]} onChange={e => einstSetzen({ kalender: { ...einst.kalender, [w]: e.target.value } })}
                  placeholder="Name in der Kalender-App" style={feld} />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ARTEN.map(a => (
              <label key={a.id} style={spalte}>
                <span style={{ ...MIKRO, color: a.farbe }}>{a.label} · Min.</span>
                <input type="number" min={5} max={600} step={5} value={einst.dauer[a.id]}
                  onChange={e => einstSetzen({ dauer: { ...einst.dauer, [a.id]: Number(e.target.value) || 5 } })}
                  style={{ ...feld, width: 96 }} />
              </label>
            ))}
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>
            Die Namen müssen genau so heißen wie in der Kalender-App — sonst landet alles im gemeinsamen Kalender.
          </div>
        </Karte>
      )}

      {loadErr && (
        <Karte i={4} akzent={LEUCHT.kritisch}>
          <Ueberschrift farbe={LEUCHT.kritisch}>Kein Kalender-Zugriff</Ueberschrift>
          <Absatz>Systemeinstellungen → Datenschutz & Sicherheit → Kalender → Node.js/Terminal erlauben. <span style={{ color: C.inkLeise }}>({loadErr.slice(0, 120)})</span></Absatz>
        </Karte>
      )}

      {/* KI-Briefing */}
      {briefing && (
        <Karte i={4} akzent={LEUCHT.agenten}>
          <Ueberschrift farbe={LEUCHT.agenten}>Briefing</Ueberschrift>
          <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55 }}>{briefing}</div>
        </Karte>
      )}

      {/* Konflikte */}
      {conflicts.length > 0 && (
        <Karte i={5} akzent={LEUCHT.kritisch}>
          <Ueberschrift farbe={LEUCHT.kritisch} rechts={`${conflicts.length}`}>Konflikte</Ueberschrift>
          <Liste>
            {conflicts.map(c => (
              <Zeile key={conflictKey(c)} links={<Punkt farbe={LEUCHT.kritisch} />}
                titel={<><b>{c.a}</b> <span style={{ color: LEUCHT.kritisch }}>⨯</span> <b>{c.b}</b></>}
                unter={`${dayLabel(c.date)} · ${c.overlap}`} />
            ))}
          </Liste>
        </Karte>
      )}

      {/* Vorschläge */}
      {blocks.length > 0 && (
        <Karte i={6}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<><span>{blocks.length}</span><Knopf leise onClick={addAll}>Alle eintragen</Knopf></>}>Schutz-Blöcke</Ueberschrift>
          <Liste>
            {blocks.map((b, i) => (
              <Zeile key={i}
                links={<Punkt farbe={calColor(b.calendar)} />}
                titel={<>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
                  {b.grund &&<div style={{ whiteSpace: 'normal', fontSize: 12.5, fontWeight: 400, color: C.inkDim, lineHeight: 1.4, marginTop: 2 }}>{b.grund}</div>}
                </>}
                unter={<>{dayLabel(b.date)} · {String(b.startHour).padStart(2, '0')}:{String(b.startMin ?? 0).padStart(2, '0')} · {b.durationMin} Min · <span style={{ color: calColor(b.calendar) }}>{b.calendar}</span></>}
                rechts={
                  <Knopf leise={added[i] === 'ok'} aus={added[i] === 'busy' || added[i] === 'ok'} farbe={added[i] === 'err' ? LEUCHT.kritisch : LEUCHT.schlaf} onClick={() => addBlock(b, i)}>
                    {added[i] === 'ok' ? '✓ eingetragen' : added[i] === 'busy' ? '…' : added[i] === 'err' ? 'Fehler' : 'In Kalender legen'}
                  </Knopf>
                } />
            ))}
          </Liste>
        </Karte>
      )}

      {/* Wochen-Übersicht */}
      {!loadErr && (
        <Karte i={7}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={!loading && days.length ? `${days.length} Tage` : undefined}>Deine nächsten 7 Tage</Ueberschrift>
          {loading ? (
            <Leer>lade Termine …</Leer>
          ) : days.length === 0 ? (
            <Leer>Keine Termine in den nächsten Tagen.</Leer>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {days.map(k => {
                const heute = k === TODAY;
                return (
                  <div key={k}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, fontWeight: 700, color: heute ? LEUCHT.puls : C.inkDim, letterSpacing: '.02em' }}>
                      {heute && <Punkt farbe={LEUCHT.puls} groesse={7} />}{dayLabel(k)}{heute ? ' · heute' : ''}
                    </div>
                    <Liste>
                      {byDay[k].map(e => {
                        const clash = conflictTitles.has(`${k}|${e.title}`);
                        return (
                          <Zeile key={e.id}
                            links={<>
                              <span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 46, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{e.allDay ? 'ganzt.' : fmtTime(e.startDate)}</span>
                              <Punkt farbe={calColor(e.calendarName)} groesse={7} />
                            </>}
                            titel={<>{e.title}{clash && <span style={{ marginLeft: 8 }}><Chip farbe={LEUCHT.kritisch}>⨯ Konflikt</Chip></span>}</>} />
                        );
                      })}
                    </Liste>
                  </div>
                );
              })}
            </div>
          )}
        </Karte>
      )}
    </Seite>
  );
}
