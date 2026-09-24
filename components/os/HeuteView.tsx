'use client';

// ─── MAKE OS — Heute ────────────────────────────────────────────────────────
// Die Seite nach der Anmeldung. Eine Frage: Was ist heute dran? Der
// Wachstums-Score steht seit 24.09. als Kopf über JEDER Seite (WachstumsKopf),
// deshalb hier nicht noch einmal. Begrüßung, dann Karten: Fokus, Termine,
// Aufgaben mit Schnellanlage, Körper, Jarvis. Nie eine Null.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { parseSchnell } from '@/lib/make-one/schnell-anlegen';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, Ring, Fortschritt, feld, zoneFarbe, prioFarbe, LEUCHT, Spalten, Spalte } from './schlank';

interface Termin { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean }

export function HeuteView() {
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const [datum, setDatum] = useState('');
  const [gruss, setGruss] = useState('Hallo');
  const [vorname, setVorname] = useState('');
  const [fokus, setFokus] = useState<{ tag?: string; woche?: string; monat?: string }>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [koerper, setKoerper] = useState<{ rec?: number; frisch: boolean; routinen: number; von: number } | null>(null);
  const [stapel, setStapel] = useState<number | null>(null);
  // CRM (24.09.): wer heute dran ist — die drei wichtigsten Karten der Power Hour.
  const [crm, setCrm] = useState<{ n: number; karten: { id: string; name: string; firma?: string; kategorie: string; gruende: string[] }[] } | null>(null);
  useEffect(() => { fetch('/api/crm/heute?n=12').then(r => (r.ok ? r.json() : null)).then(d => d?.ok && setCrm({ n: d.karten.length, karten: d.karten.slice(0, 3) })).catch(() => {}); }, []);
  const [neu, setNeu] = useState('');
  // Haushaltsfinanzen (24.09.): nur, wer einem Haushalt angehört, bekommt die Karte.
  const [finanzen, setFinanzen] = useState<string[] | null>(null);
  useEffect(() => { fetch('/api/haushalt?nur=signale').then(r => (r.ok ? r.json() : null)).then(d => setFinanzen(d?.ok && !d.leer ? d.punkte : null)).catch(() => {}); }, []);

  useEffect(() => {
    const jetzt = new Date();
    setDatum(jetzt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));
    setGruss(jetzt.getHours() < 11 ? 'Guten Morgen' : jetzt.getHours() < 18 ? 'Guten Tag' : 'Guten Abend');
    fetch('/api/konto/ich').then(r => r.json()).then(d => setVorname((d.ich?.name ?? '').split(' ')[0])).catch(() => {});
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
  const koerperFarbe = koerper?.frisch ? zoneFarbe(koerper.rec) : C.inkLeise;

  return (
    <Seite titel={<>{gruss}{vorname ? `, ${vorname}` : ''}</>} unter={<span suppressHydrationWarning>{datum}</span>}>
      <Spalten verhaeltnis="2:1">
        <Spalte>
      <Karte i={2}>
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

      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href="/os/kalender" style={{ color: C.inkLeise, textDecoration: 'none' }}>Kalender ›</Link>}>Termine</Ueberschrift>
        <Liste>
          {termine.length === 0 && <Leer>Keine Termine heute — freie Bahn.</Leer>}
          {termine.map((t, i) => (
            <Zeile key={t.id ?? i} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: LEUCHT.puls, width: 52 }}>{t.allDay ? 'Tag' : uhr(t.startDate)}</span>} titel={t.title ?? '—'} unter={t.endDate && !t.allDay ? `bis ${uhr(t.endDate)}` : undefined} />
          ))}
        </Liste>
      </Karte>

      {crm && crm.n > 0 && (
        <Karte i={2}>
          <Ueberschrift farbe={LEUCHT.business} rechts={<Link href="/os/crm" style={{ color: C.inkLeise, textDecoration: 'none' }}>Power Hour ›</Link>}>Wer heute dran ist · {crm.n}</Ueberschrift>
          <Liste>
            {crm.karten.map(k => <Zeile key={k.id} onClick={() => { window.location.href = `/os/crm?s=kontakte&k=${k.id}`; }} links={<Punkt farbe={k.kategorie === 'versprechen' ? LEUCHT.kritisch : k.kategorie === 'signale' ? LEUCHT.achtung : LEUCHT.business} />} titel={<>{k.name}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.gruende[0]} />)}
          </Liste>
        </Karte>
      )}

        </Spalte>
        <Spalte>
      {fokusText && (
        <Karte i={0} akzent={LEUCHT.schlaf}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/wachstum" style={{ color: C.inkLeise, textDecoration: 'none' }}>Wachstum ›</Link>}>Fokus {fokusWann}</Ueberschrift>
          <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>{fokusText}</div>
        </Karte>
      )}

        <Karte i={3} akzent={koerper?.frisch ? koerperFarbe : undefined}>
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
        {finanzen && (
          <Karte i={4} akzent={finanzen.some(t => /Überfällig|kein Kontoauszug/.test(t)) ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={LEUCHT.geld} rechts={<Link href="/os/finanzen" style={{ color: C.inkLeise, textDecoration: 'none' }}>Zahlen ›</Link>}>Finanzen · privat</Ueberschrift>
            <Liste>
              {!finanzen.length && <Leer>Nichts fällig. Alles bezahlt.</Leer>}
              {finanzen.slice(0, 4).map(t => <Zeile key={t} links={<Punkt farbe={/Überfällig|kein Kontoauszug/.test(t) ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={<span style={{ whiteSpace: 'normal' }}>{t}</span>} />)}
            </Liste>
          </Karte>
        )}
        <Karte i={4} akzent={stapel ? LEUCHT.achtung : undefined}>
          <Ueberschrift farbe={stapel ? LEUCHT.achtung : C.inkLeise} rechts={<Link href="/os/stapel" style={{ color: C.inkLeise, textDecoration: 'none' }}>Stapel ›</Link>}>Jarvis</Ueberschrift>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(34px,4vw,44px)', letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: stapel ? LEUCHT.achtung : C.inkLeise, textShadow: stapel ? `0 0 24px ${LEUCHT.achtung}66` : undefined }}>{stapel == null ? '—' : stapel === 0 ? '0' : stapel}</div>
            <div style={{ fontSize: TYP.body, fontWeight: 600, lineHeight: 1.35 }}>{stapel == null ? 'Jarvis' : stapel === 0 ? 'Nichts vorbereitet — alles erledigt.' : `Vorschl${stapel === 1 ? 'ag wartet' : 'äge warten'} auf dich`}</div>
          </div>
        </Karte>
        </Spalte>
      </Spalten>
    </Seite>
  );
}
