'use client';

// ─── MAKE OS — Heute ────────────────────────────────────────────────────────
// Die Seite nach dem Empfang. Eine Frage: Was ist heute dran? Begrüßung, der
// Score als großer Ring mit den fünf Säulen als kleine Ringe daneben, dann
// Karten: Fokus, Termine, Aufgaben (mit Schnellanlage), Körper, Jarvis.
// 24.09.: lebendig nach Whoop — Farbe, Glow, Bewegung. Nie eine Null.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { parseSchnell } from '@/lib/make-one/schnell-anlegen';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, Ring, Balken, Chip, Fortschritt, feld, zoneFarbe, prioFarbe, LEUCHT } from './schlank';

interface Perf { index: number | null; label: string; hebel: string | null; stand?: string; saeulen: { key: string; label: string; score: number | null; zuDuenn: boolean }[] }
interface Termin { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean }
interface Punkt14 { date: string; index: number | null }

const SAEULE: Record<string, { label: string; farbe: string; href: string }> = {
  health: { label: 'Gesundheit', farbe: LEUCHT.gut, href: '/os/gesundheit' },
  business: { label: 'Business', farbe: LEUCHT.business, href: '/os/saeule/business' },
  planning: { label: 'Planung', farbe: LEUCHT.planung, href: '/os/saeule/planning' },
  finance: { label: 'Finanzen', farbe: LEUCHT.geld, href: '/os/finanzen' },
  social: { label: 'Beziehung', farbe: LEUCHT.beziehung, href: '/os/saeule/social' },
};

export function HeuteView() {
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const [datum, setDatum] = useState('');
  const [gruss, setGruss] = useState('Hallo');
  const [vorname, setVorname] = useState('');
  const [perf, setPerf] = useState<Perf | null>(null);
  const [verlauf, setVerlauf] = useState<Punkt14[]>([]);
  const [fokus, setFokus] = useState<{ tag?: string; woche?: string; monat?: string }>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [koerper, setKoerper] = useState<{ rec?: number; frisch: boolean; routinen: number; von: number } | null>(null);
  const [stapel, setStapel] = useState<number | null>(null);
  const [neu, setNeu] = useState('');

  useEffect(() => {
    const jetzt = new Date();
    setDatum(jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    setGruss(jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend');
    fetch('/api/konto/ich').then(r => r.json()).then(d => setVorname((d.ich?.name ?? '').split(' ')[0])).catch(() => {});
    fetch('/api/performance').then(r => r.json()).then(d => { setPerf(d.aktuell ?? null); setVerlauf((d.verlauf ?? []).slice(-14)); }).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setFokus((d.state ?? d)?.fokus ?? {})).catch(() => {});
    fetch('/api/apple-calendar').then(r => r.json()).then((l: Termin[]) => {
      if (!Array.isArray(l)) return;
      setTermine(l.filter(t => (t.startDate ?? '').slice(0, 10) === heute).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')));
    }).catch(() => {});
    fetch('/api/gesundheit/stand').then(r => r.json()).then(d => {
      if (!d?.vitals) return;
      const v = d.vitals;
      setKoerper({ rec: v.rec, frisch: v.heute || (v.alterTage <= 1 && !v.fallback), routinen: (d.routinen?.liste ?? []).filter((r: { heute: boolean }) => r.heute).length, von: (d.routinen?.liste ?? []).length });
    }).catch(() => {});
    fetch('/api/jarvis/stapel').then(r => r.json()).then(d => setStapel(typeof d.offen === 'number' ? d.offen : Array.isArray(d.offen) ? d.offen.length : (d.vorschlaege ?? []).length)).catch(() => {});
  }, [heute]);

  const anlegen = () => {
    const p = parseSchnell(neu.trim(), state.projects);
    if (!p.title) return;
    dispatch({ type: 'ADD_TASK', payload: { projectId: p.projectId ?? state.projects[0]?.id ?? '', title: p.title, description: '', status: 'todo', priority: p.priority, assignee: p.assignee, tags: [], subTasks: [], dependencies: [], sortOrder: 0, dueDate: p.dueDate ?? heute } });
    setNeu('');
  };

  const offen = state.tasks.filter(t => t.status !== 'done');
  const dran = offen.filter(t => (t.dueDate && t.dueDate <= heute) || t.priority === 'critical').sort((a, b) => ((a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)).slice(0, 8);
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title ?? '';
  const fokusText = fokus.tag || fokus.woche || fokus.monat;
  const fokusWann = fokus.tag ? 'heute' : fokus.woche ? 'diese Woche' : 'diesen Monat';
  const uhr = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');
  const zone = zoneFarbe(perf?.index);
  const koerperFarbe = koerper?.frisch ? zoneFarbe(koerper.rec) : C.inkLeise;

  return (
    <Seite titel={<>{gruss}{vorname ? `, ${vorname}` : ''}</>} unter={<span suppressHydrationWarning>{datum}</span>}>
      <Karte i={0} akzent={perf?.index != null ? zone : undefined}>
        <Ueberschrift farbe={zone} rechts={<Link href="/os/wachstum" style={{ color: C.inkLeise, textDecoration: 'none' }}>Wachstum ›</Link>}>MAKE Score</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,44px)', alignItems: 'center' }}>
          <Ring groesse="gross" label={perf?.stand ? `Stand ${perf.stand.slice(8)}.${perf.stand.slice(5, 7)}.` : 'Score'} wert={perf?.index != null ? String(perf.index) : undefined} farbe={zone} anteil={perf?.index != null ? perf.index / 100 : undefined}
            unter={perf?.index != null ? <Chip farbe={zone}>{perf.label}</Chip> : undefined} />
          <div style={{ minWidth: 0, width: '100%' }}>
            <div className="heute-saeulen" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {(perf?.saeulen ?? []).map(s => {
                const m = SAEULE[s.key] ?? { label: s.label, farbe: C.inkLeise, href: '/os' };
                const w = s.score == null || s.score === 0 ? undefined : String(s.score);
                return (
                  <Link key={s.key} href={m.href} style={{ textDecoration: 'none', color: 'inherit' }} title={s.zuDuenn ? `${m.label} — noch dünn gemessen` : m.label}>
                    <Ring groesse="klein" label={m.label} wert={w} farbe={s.zuDuenn ? `${m.farbe}99` : m.farbe} anteil={w ? Number(w) / 100 : undefined} />
                  </Link>
                );
              })}
            </div>
            {perf?.hebel && <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '16px 0 0' }}>Größter Hebel: <b style={{ color: C.ink, fontWeight: 600 }}>{perf.hebel}</b></p>}
            {perf && perf.index == null && <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '16px 0 0' }}>Noch zu wenig gemessen, um einen Score zu nennen.</p>}
            {verlauf.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11.5, color: C.inkLeise, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Verlauf · {verlauf.length} Messungen</div>
                <Balken werte={verlauf.map(p => p.index)} max={100} farbe={zone} hoehe={38} titel={verlauf.map(p => `${p.date.slice(8)}.${p.date.slice(5, 7)}. · ${p.index ?? '—'}`)} />
              </div>
            )}
          </div>
        </div>
      </Karte>

      {fokusText && (
        <Karte i={1} akzent={LEUCHT.schlaf}>
          <Ueberschrift farbe={LEUCHT.schlaf}>Fokus {fokusWann}</Ueberschrift>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>{fokusText}</div>
        </Karte>
      )}

      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href="/os/kalender" style={{ color: C.inkLeise, textDecoration: 'none' }}>Kalender ›</Link>}>Termine</Ueberschrift>
        <Liste>
          {termine.length === 0 && <Leer>Keine Termine heute — freie Bahn.</Leer>}
          {termine.map((t, i) => (
            <Zeile key={t.id ?? i} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: LEUCHT.puls, width: 52 }}>{t.allDay ? 'Tag' : uhr(t.startDate)}</span>} titel={t.title ?? '—'} unter={t.endDate && !t.allDay ? `bis ${uhr(t.endDate)}` : undefined} />
          ))}
        </Liste>
      </Karte>

      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href="/os/aufgaben" style={{ color: C.inkLeise, textDecoration: 'none' }}>{offen.length} offen ›</Link>}>Aufgaben</Ueberschrift>
        <input value={neu} onChange={e => setNeu(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') anlegen(); }} placeholder="Neue Aufgabe für heute … (!! kritisch · fr · #projekt · @malin)" style={{ ...feld, marginBottom: 6 }} />
        <Liste>
          {dran.length === 0 && <Leer>{offen.length ? 'Nichts fällig, nichts kritisch.' : 'Keine Aufgaben. Eine Zeile oben, Enter — oder Jarvis sagen.'}</Leer>}
          {dran.map(t => (
            <Zeile key={t.id}
              links={<Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />}
              titel={t.title}
              unter={[projekt(t.projectId), t.dueDate && t.dueDate < heute ? `überfällig seit ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : t.dueDate === heute ? 'heute' : ''].filter(Boolean).join(' · ')}
              rechts={<Punkt farbe={prioFarbe(t.priority)} />} />
          ))}
        </Liste>
      </Karte>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        <Karte i={4} akzent={koerper?.frisch ? koerperFarbe : undefined}>
          <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit" style={{ color: C.inkLeise, textDecoration: 'none' }}>Gesundheit ›</Link>}>Körper</Ueberschrift>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Ring groesse="klein" label="Recovery" wert={koerper?.frisch && koerper.rec != null ? String(koerper.rec) : undefined} einheit="%" farbe={koerperFarbe} anteil={koerper?.frisch && koerper.rec != null ? koerper.rec / 100 : undefined} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{koerper?.frisch ? (koerper.rec! >= 66 ? 'Grün — heute darf es Druck sein.' : koerper.rec! >= 40 ? 'Gelb — fokussiert, mit Puffer.' : 'Rot — heute nur das Nötige.') : 'Noch keine Werte von heute'}</div>
              <div style={{ fontSize: 12.5, color: C.inkDim, margin: '6px 0 8px' }}>{koerper ? `${koerper.routinen} von ${koerper.von} Routinen` : '—'}</div>
              {koerper && koerper.von > 0 && <Fortschritt anteil={koerper.routinen / koerper.von} farbe={LEUCHT.gut} />}
            </div>
          </div>
        </Karte>
        <Karte i={5} akzent={stapel ? LEUCHT.achtung : undefined}>
          <Ueberschrift farbe={stapel ? LEUCHT.achtung : C.inkLeise} rechts={<Link href="/os/stapel" style={{ color: C.inkLeise, textDecoration: 'none' }}>Stapel ›</Link>}>Jarvis</Ueberschrift>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(34px,4vw,44px)', letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: stapel ? LEUCHT.achtung : C.inkLeise, textShadow: stapel ? `0 0 24px ${LEUCHT.achtung}66` : undefined }}>{stapel == null ? '—' : stapel === 0 ? '0' : stapel}</div>
            <div style={{ fontSize: TYP.body, fontWeight: 600, lineHeight: 1.35 }}>{stapel == null ? 'Jarvis' : stapel === 0 ? 'Nichts vorbereitet — alles erledigt.' : `Vorschl${stapel === 1 ? 'ag wartet' : 'äge warten'} auf dich`}</div>
          </div>
        </Karte>
      </div>
    </Seite>
  );
}
