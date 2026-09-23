'use client';

// ─── MAKE OS — Heute ────────────────────────────────────────────────────────
// Die Seite nach dem Empfang. Eine Frage: Was ist heute dran? Der Score als
// Nordstern, dann Fokus, Termine, Aufgaben, Körper, Jarvis — jeweils eine
// Zeile oder eine kurze Liste, nie eine Kachelwand. Das alte Dashboard
// (MakeOsHome, 901 Zeilen) liegt unter /os/uebersicht, bis nichts mehr fehlt.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { Seite, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, Ring, zoneFarbe, prioFarbe } from './schlank';

interface Perf { index: number | null; label: string; hebel: string | null; saeulen: { key: string; label: string; score: number | null; zuDuenn: boolean }[] }
interface Termin { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean }

const KURZ: Record<string, string> = { health: 'Gesundheit', business: 'Business', planning: 'Planung', finance: 'Finanzen', social: 'Beziehung' };

export function HeuteView() {
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const [datum, setDatum] = useState('');
  const [perf, setPerf] = useState<Perf | null>(null);
  const [fokus, setFokus] = useState<{ tag?: string; woche?: string; monat?: string }>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [koerper, setKoerper] = useState<{ rec?: number; frisch: boolean; routinen: number; von: number } | null>(null);
  const [stapel, setStapel] = useState<number | null>(null);

  useEffect(() => {
    setDatum(new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    fetch('/api/performance').then(r => r.json()).then(d => setPerf(d.aktuell ?? null)).catch(() => {});
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

  const offen = state.tasks.filter(t => t.status !== 'done');
  const dran = offen
    .filter(t => (t.dueDate && t.dueDate <= heute) || t.priority === 'critical')
    .sort((a, b) => (a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)
    .slice(0, 8);
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title ?? '';
  const fokusText = fokus.tag || fokus.woche || fokus.monat;
  const fokusWann = fokus.tag ? 'heute' : fokus.woche ? 'diese Woche' : fokus.monat ? 'diesen Monat' : '';
  const uhr = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <Seite titel={<>Heute <span style={{ color: C.inkLeise, fontWeight: 500, fontSize: 15 }} suppressHydrationWarning>{datum}</span></>}>
      <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(16px,4vw,40px)', alignItems: 'center', margin: '4px 0 6px' }}>
        <Ring label={perf?.label ?? 'MAKE Score'} wert={perf?.index != null ? String(perf.index) : undefined} farbe={zoneFarbe(perf?.index)} anteil={perf?.index != null ? perf.index / 100 : undefined} />
        <div>
          <div className="heute-saeulen" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
            {(perf?.saeulen ?? []).map(s => (
              <Link key={s.key} href={s.key === 'health' ? '/os/gesundheit' : s.key === 'finance' ? '/os/finanzen' : `/os/saeule/${s.key}`} style={{ textDecoration: 'none' }}>
                <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 22, fontVariantNumeric: 'tabular-nums', color: s.score == null || s.zuDuenn ? C.inkLeise : zoneFarbe(s.score) }}>{s.score == null || s.score === 0 ? '—' : s.score}</div>
                <div style={{ fontSize: 12, color: C.inkDim }}>{KURZ[s.key] ?? s.label}{s.zuDuenn && s.score ? ' · dünn' : ''}</div>
              </Link>
            ))}
          </div>
          {perf?.hebel && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 12 }}>Größter Hebel: <b style={{ color: C.ink, fontWeight: 600 }}>{perf.hebel}</b></div>}
          {perf && perf.index == null && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12 }}>Noch zu wenig gemessen, um einen Score zu nennen.</div>}
        </div>
      </div>

      {fokusText && (
        <p style={{ margin: '18px 0 0', fontSize: TYP.body, color: C.inkDim }}>
          <span style={{ color: C.inkLeise, fontSize: 12, letterSpacing: '.04em', textTransform: 'uppercase', marginRight: 10 }}>Fokus {fokusWann}</span>
          <b style={{ color: C.ink, fontWeight: 600 }}>{fokusText}</b>
        </p>
      )}

      <Ueberschrift rechts={<Link href="/os/kalender" style={{ color: C.inkLeise, textDecoration: 'none' }}>Kalender</Link>}>Termine</Ueberschrift>
      <Liste>
        {termine.length === 0 && <Leer>Keine Termine heute.</Leer>}
        {termine.map((t, i) => (
          <Zeile key={t.id ?? i} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: C.inkDim, width: 48 }}>{t.allDay ? 'ganztags' : uhr(t.startDate)}</span>} titel={t.title ?? '—'} unter={t.endDate && !t.allDay ? `bis ${uhr(t.endDate)}` : undefined} />
        ))}
      </Liste>

      <Ueberschrift rechts={<Link href="/os/aufgaben" style={{ color: C.inkLeise, textDecoration: 'none' }}>{offen.length} offen</Link>}>Aufgaben</Ueberschrift>
      <Liste>
        {dran.length === 0 && <Leer>{offen.length ? 'Nichts fällig, nichts kritisch — freie Bahn.' : 'Keine Aufgaben. Anlegen unter Aufgaben oder Jarvis sagen.'}</Leer>}
        {dran.map(t => (
          <Zeile key={t.id}
            links={<Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />}
            titel={t.title}
            unter={[projekt(t.projectId), t.dueDate && t.dueDate < heute ? `überfällig seit ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : t.dueDate === heute ? 'heute' : ''].filter(Boolean).join(' · ')}
            rechts={<Punkt farbe={prioFarbe(t.priority)} />} />
        ))}
      </Liste>

      <Ueberschrift>Körper und Jarvis</Ueberschrift>
      <Liste>
        <Link href="/os/gesundheit" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Zeile links={<Punkt farbe={koerper?.frisch ? zoneFarbe(koerper.rec) : C.inkLeise} />}
            titel={koerper?.frisch ? `Recovery ${koerper.rec} % — ${koerper.rec! >= 66 ? 'grün' : koerper.rec! >= 40 ? 'gelb' : 'rot'}` : 'Noch keine Werte von heute'}
            unter={koerper ? `${koerper.routinen} von ${koerper.von} Routinen abgehakt` : undefined}
            rechts={<span style={{ color: C.inkLeise }}>›</span>} />
        </Link>
        <Link href="/os/stapel" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Zeile links={<Punkt farbe={stapel ? C.achtung : C.inkLeise} />}
            titel={stapel == null ? 'Jarvis' : stapel === 0 ? 'Jarvis hat nichts vorbereitet' : `${stapel} Vorschl${stapel === 1 ? 'ag' : 'äge'} von Jarvis warten auf dich`}
            rechts={<span style={{ color: C.inkLeise }}>›</span>} />
        </Link>
      </Liste>
    </Seite>
  );
}
