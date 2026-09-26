'use client';

// ─── MAKE OS — Widget-Katalog für die Flächen (26.09.) ──────────────────────
// Kevin: „alle Widgets immer zu bearbeiten, andere hinzufügen können.“ Jedes
// Widget lädt sich selbst, rendert seine eigene Karte und gibt `null`, wenn es
// für diese Person nichts zu zeigen gibt (kein Haushalt, keine Daten) — die
// Fläche blendet es dann aus. Einstellungen kommen aus dem Layout (`e`).
// Katalog „aus dem Bestand“: Aufgaben, Termine, Fokus/Wochenfokus, Körper,
// Routinen & Streak, Essen heute, Index je Säule, Finanzen privat, Jarvis &
// Inbox, Wer heute dran ist, Familie, nächste Tage.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentType, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { useTasks } from '@/context/TasksContext';
import { localDay } from '@/lib/zeit';
import { parseSchnell } from '@/lib/make-one/schnell-anlegen';
import { WEG } from '@/lib/wege';
import { markttraktion } from '@/lib/crm/adresse';
import { TAGE, MAHLZEITEN, type ErnaehrungFile } from '@/lib/ernaehrung/modell';
import type { Breite, Einstellungen, Wert } from '@/lib/flaeche/modell';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Haken, Punkt, Ring, Fortschritt, feld, zoneFarbe, prioFarbe } from '../schlank';
import { WhoopImport } from '../WhoopImport';

export interface WidgetProps { e: Einstellungen; titel?: string; i: number }
export interface EinstellungDef { k: string; label: string; art: 'wahl' | 'text' | 'schalter'; optionen?: { w: Wert; label: string }[]; standard: Wert }
export interface WidgetDef { art: string; label: string; bereich: string; beschreibung: string; breite: Breite; einstellungen?: EinstellungDef[]; Komponente: ComponentType<WidgetProps> }
/** Ein Eintrag im „+ Widget“-Katalog — darf ein Widget mit Voreinstellung sein (Wochenfokus = Fokus mit horizont=woche). */
export interface KatalogEintrag { art: string; label: string; beschreibung: string; bereich: string; breite: Breite; voreinstellung?: Einstellungen }

const link: CSSProperties = { color: C.inkLeise, textDecoration: 'none' };
const str = (v: Wert | undefined, std: string) => (typeof v === 'string' && v ? v : std);
const num = (v: Wert | undefined, std: number) => (typeof v === 'number' ? v : typeof v === 'string' && v && isFinite(Number(v)) ? Number(v) : std);

/** Einmal laden; `undefined` = lädt, `null` = nichts/kein Zugang. */
function useDaten<T>(url: string, ok: (d: unknown) => T | null): T | null | undefined {
  const [d, setD] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (aktiv) setD(x == null ? null : ok(x)); }).catch(() => { if (aktiv) setD(null); });
    return () => { aktiv = false; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  return d;
}
const uhr = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '');
const tagKurz = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const plusTage = (d: string, n: number) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// ── Aufgaben ────────────────────────────────────────────────────────────────
function AufgabenWidget({ e, titel, i }: WidgetProps) {
  const router = useRouter();
  const heute = localDay();
  const { state, dispatch } = useTasks();
  const [neu, setNeu] = useState('');
  const n = num(e.anzahl, 8), nur = str(e.nur, 'dran');
  const offen = state.tasks.filter(t => t.status !== 'done');
  const liste = (nur === 'alle' ? offen : offen.filter(t => (t.dueDate && t.dueDate <= heute) || t.priority === 'critical'))
    .sort((a, b) => ((a.dueDate ?? '9') < (b.dueDate ?? '9') ? -1 : 1)).slice(0, n);
  const projekt = (id: string) => state.projects.find(p => p.id === id)?.title ?? '';
  const anlegen = () => {
    const p = parseSchnell(neu.trim(), state.projects); if (!p.title) return;
    dispatch({ type: 'ADD_TASK', payload: { projectId: p.projectId ?? state.projects[0]?.id ?? '', title: p.title, description: '', status: 'todo', priority: p.priority, assignee: p.assignee, tags: [], subTasks: [], dependencies: [], sortOrder: 0, dueDate: p.dueDate ?? heute } });
    setNeu('');
  };
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href="/os/aufgaben" style={link}>{offen.length} offen ›</Link>}>{titel ?? (nur === 'alle' ? 'Aufgaben' : 'Aufgaben heute')}</Ueberschrift>
      <input value={neu} onChange={x => setNeu(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') anlegen(); }} placeholder="Neue Aufgabe für heute … (!! kritisch · fr · #projekt · @malin)" style={{ ...feld, marginBottom: 6 }} />
      <Liste>
        {liste.length === 0 && <Leer>{offen.length ? 'Nichts fällig, nichts kritisch.' : 'Keine Aufgaben. Eine Zeile oben, Enter — oder Jarvis sagen.'}</Leer>}
        {liste.map(t => (
          <Zeile key={t.id} onClick={() => router.push(WEG.aufgabe(t.id))}
            links={<Haken an={false} onChange={() => dispatch({ type: 'TOGGLE_TASK', payload: { id: t.id } })} farbe={prioFarbe(t.priority)} />}
            titel={t.title}
            unter={[projekt(t.projectId), t.dueDate && t.dueDate < heute ? `überfällig seit ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : t.dueDate === heute ? 'heute' : t.dueDate ? `bis ${t.dueDate.slice(8)}.${t.dueDate.slice(5, 7)}.` : ''].filter(Boolean).join(' · ')}
            rechts={<Punkt farbe={prioFarbe(t.priority)} />} />
        ))}
      </Liste>
    </Karte>
  );
}

// ── Termine (heute / nächste Tage) ──────────────────────────────────────────
interface Termin { id?: string; title?: string; startDate?: string; endDate?: string; allDay?: boolean; quelle?: 'privat' | 'business' }
function useTermine(tage: number, mitBusiness: boolean): Termin[] | undefined {
  const heute = localDay();
  const bis = plusTage(heute, tage - 1);
  const apple = useDaten<Termin[]>('/api/apple-calendar', d => (Array.isArray(d) ? (d as Termin[]) : null));
  const kem = useDaten<Termin[]>(mitBusiness ? '/api/kemaris-calendar' : '/api/kemaris-calendar?leer=1', d => {
    const ev = (d as { events?: { title?: string; start?: string; end?: string }[] })?.events;
    return Array.isArray(ev) ? ev.map(x => ({ title: x.title, startDate: x.start, endDate: x.end, quelle: 'business' as const })) : null;
  });
  return useMemo(() => {
    if (apple === undefined) return undefined;
    const alle = [...(apple ?? []).map(t => ({ ...t, quelle: 'privat' as const })), ...(mitBusiness ? kem ?? [] : [])];
    return alle.filter(t => { const d = (t.startDate ?? '').slice(0, 10); return d >= heute && d <= bis; }).sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }, [apple, kem, heute, bis, mitBusiness]);
}
function TermineWidget({ e, titel, i }: WidgetProps) {
  const router = useRouter();
  const heute = localDay();
  const tage = num(e.tage, 1);
  const termine = useTermine(tage, e.business === true);
  const gruppen = useMemo(() => {
    const m = new Map<string, Termin[]>();
    for (const t of termine ?? []) { const d = (t.startDate ?? '').slice(0, 10); m.set(d, [...(m.get(d) ?? []), t]); }
    return [...m.entries()];
  }, [termine]);
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href="/os/planung/woche" style={link}>Kalender ›</Link>}>{titel ?? (tage === 1 ? 'Termine' : `Nächste ${tage} Tage`)}</Ueberschrift>
      <Liste>
        {termine && termine.length === 0 && <Leer>{tage === 1 ? 'Keine Termine heute — freie Bahn.' : 'Nichts eingetragen — freie Bahn.'}</Leer>}
        {termine === undefined && <Leer>lade …</Leer>}
        {gruppen.map(([d, liste]) => (
          <div key={d}>
            {tage > 1 && <div style={{ fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: d === heute ? LEUCHT.puls : C.inkLeise, fontWeight: 600, padding: '8px 2px 2px' }}>{d === heute ? 'Heute' : tagKurz(d)}</div>}
            {liste.map((t, k) => (
              <Zeile key={t.id ?? `${d}-${k}`} onClick={() => router.push(WEG.woche(d))}
                links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: t.quelle === 'business' ? LEUCHT.business : LEUCHT.puls, width: 52 }}>{t.allDay ? 'Tag' : uhr(t.startDate)}</span>}
                titel={t.title ?? '—'} unter={t.endDate && !t.allDay ? `bis ${uhr(t.endDate)}${t.quelle === 'business' ? ' · KEMARIS' : ''}` : t.quelle === 'business' ? 'KEMARIS' : undefined} />
            ))}
          </div>
        ))}
      </Liste>
    </Karte>
  );
}

// ── Wer heute dran ist (Markttraktion) ──────────────────────────────────────
function DranWidget({ titel, i }: WidgetProps) {
  const router = useRouter();
  const d = useDaten<{ n: number; karten: { id: string; name: string; firma?: string; kategorie: string; gruende: string[] }[] }>('/api/crm/heute?n=12', x => { const r = x as { ok?: boolean; karten?: { id: string; name: string; firma?: string; kategorie: string; gruende: string[] }[] }; return r?.ok && r.karten?.length ? { n: r.karten.length, karten: r.karten.slice(0, 3) } : null; });
  if (!d) return null;
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.business} rechts={<Link href="/os/markttraktion?s=sales" style={link}>Power Hour ›</Link>}>{titel ?? 'Wer heute dran ist'} · {d.n}</Ueberschrift>
      <Liste>
        {d.karten.map(k => <Zeile key={k.id} onClick={() => router.push(markttraktion('kontakte', undefined, k.id))} links={<Punkt farbe={k.kategorie === 'versprechen' ? LEUCHT.kritisch : k.kategorie === 'signale' ? LEUCHT.achtung : LEUCHT.business} />} titel={<>{k.name}{k.firma && <span style={{ color: C.inkLeise }}> · {k.firma}</span>}</>} unter={k.gruende[0]} />)}
      </Liste>
    </Karte>
  );
}

// ── Fokus (heute / Woche / Monat) ───────────────────────────────────────────
function FokusWidget({ e, titel, i }: WidgetProps) {
  const f = useDaten<{ tag?: string; woche?: string; monat?: string }>('/api/state/ziele', d => ((d as { state?: { fokus?: object } }).state ?? (d as { fokus?: object }))?.fokus ?? {});
  const h = str(e.horizont, 'auto');
  const fokus = f ?? {};
  const text = h === 'tag' ? fokus.tag : h === 'woche' ? fokus.woche : h === 'monat' ? fokus.monat : fokus.tag || fokus.woche || fokus.monat;
  const wann = h === 'tag' ? 'heute' : h === 'woche' ? 'diese Woche' : h === 'monat' ? 'diesen Monat' : fokus.tag ? 'heute' : fokus.woche ? 'diese Woche' : 'diesen Monat';
  return (
    <Karte i={i} akzent={text ? LEUCHT.schlaf : undefined}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/fokus" style={link}>Fokus ›</Link>}>{titel ?? (h === 'woche' ? 'Wochenfokus' : h === 'monat' ? 'Monatsfokus' : 'Fokus')} {text && h === 'auto' ? wann : ''}</Ueberschrift>
      {text
        ? <div style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(17px,2.2vw,20px)', fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.3 }}>{text}</div>
        : <Leer>{f === undefined ? 'lade …' : <>Noch kein Fokus {wann} — <Link href="/os/fokus" style={{ color: C.inkDim }}>worauf kommt es an? ›</Link></>}</Leer>}
    </Karte>
  );
}

// ── Körper (Recovery + Routinen) ────────────────────────────────────────────
interface Stand { vitals?: { rec?: number; heute?: boolean; alterTage?: number; fallback?: boolean }; routinen?: { liste?: { id: string; label: string; heute: boolean }[]; quote7?: number }; streak?: { sauberTage: number; aktuell: boolean } }
function KoerperWidget({ titel, i }: WidgetProps) {
  const d = useDaten<Stand>('/api/gesundheit/stand', x => ((x as { vitals?: unknown }).vitals ? (x as Stand) : null));
  const v = d?.vitals;
  const frisch = !!v && (v.heute || ((v.alterTage ?? 99) <= 1 && !v.fallback));
  const liste = d?.routinen?.liste ?? [];
  const heuteN = liste.filter(r => r.heute).length;
  const farbe = frisch ? zoneFarbe(v?.rec) : C.inkLeise;
  return (
    <Karte i={i} akzent={frisch ? farbe : undefined}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href="/os/gesundheit" style={link}>Gesundheit ›</Link>}>{titel ?? 'Körper'}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/os/gesundheit" style={{ textDecoration: 'none', color: 'inherit' }}><Ring groesse="klein" label="Recovery" wert={frisch && v?.rec != null ? String(v.rec) : undefined} einheit="%" farbe={farbe} anteil={frisch && v?.rec != null ? v.rec / 100 : undefined} /></Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{frisch && v?.rec != null ? (v.rec >= 66 ? 'Grün — heute darf es Druck sein.' : v.rec >= 40 ? 'Gelb — fokussiert, mit Puffer.' : 'Rot — heute nur das Nötige.') : d === undefined ? 'lade …' : 'Noch keine Werte von heute'}</div>
          <div style={{ fontSize: 12.5, color: C.inkDim, margin: '6px 0 8px' }}>{d ? <Link href="/os/gesundheit#routinen" style={{ color: C.inkDim }}>{heuteN} von {liste.length} Routinen ›</Link> : '—'}</div>
          {d && !frisch && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}><WhoopImport kurz /><Link href="/os/ritual?modus=morgen" style={{ fontSize: 12.5, color: C.inkDim }}>von Hand eintragen ›</Link></div>}
          {d && liste.length > 0 && <Fortschritt anteil={heuteN / liste.length} farbe={LEUCHT.gut} />}
        </div>
      </div>
    </Karte>
  );
}

// ── Routinen & Streak ───────────────────────────────────────────────────────
function RoutinenWidget({ titel, i }: WidgetProps) {
  const d = useDaten<Stand>('/api/gesundheit/stand', x => ((x as { routinen?: unknown }).routinen ? (x as Stand) : null));
  const liste = d?.routinen?.liste ?? [];
  const heuteN = liste.filter(r => r.heute).length;
  const streak = d?.streak;
  return (
    <Karte i={i} akzent={liste.length && heuteN === liste.length ? LEUCHT.gut : undefined}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href={WEG.gesundheit('routinen')} style={link}>{liste.length ? `${heuteN}/${liste.length} heute ›` : 'Routinen ›'}</Link>}>{titel ?? 'Routinen & Streak'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && !liste.length && <Leer>Noch keine Routinen — unter Planung → Routinen anlegen.</Leer>}
      <Liste>
        {liste.slice(0, 8).map(r => <Zeile key={r.id} links={<Punkt farbe={r.heute ? LEUCHT.gut : C.inkLeise} />} titel={<span style={{ color: r.heute ? C.ink : C.inkDim }}>{r.label}</span>} />)}
      </Liste>
      {d && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginTop: 10 }}>
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 26, letterSpacing: '-.03em', color: streak?.aktuell ? LEUCHT.gut : C.inkLeise }}>{streak?.sauberTage ?? 0}</span>
          <span style={{ fontSize: 12.5, color: C.inkDim }}>Tage Streak{d.routinen?.quote7 != null ? ` · 7-Tage-Quote ${Math.round(d.routinen.quote7 * 100)} %` : ''}</span>
        </div>
      )}
    </Karte>
  );
}

// ── Essen heute (Ernährung) ─────────────────────────────────────────────────
function EssenWidget({ titel, i }: WidgetProps) {
  const d = useDaten<ErnaehrungFile>('/api/state/ernaehrung', x => ((x as { plan?: unknown }).plan ? (x as ErnaehrungFile) : null));
  if (d === null) return null;
  const tag = TAGE[(new Date().getDay() + 6) % 7];
  const offen = d?.einkauf.filter(p => !p.erledigt).length ?? 0;
  const gericht = (k: string) => { const id = d?.planGerichte[tag]?.[k as 'fruehstueck']; return id ? d?.gerichte.find(g => g.id === id) : undefined; };
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.gut} rechts={<Link href={WEG.ernaehrung()} style={link}>{offen ? `${offen} auf der Liste ›` : 'Ernährung ›'}</Link>}>{titel ?? 'Essen heute'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && (
        <Liste>
          {MAHLZEITEN.map(m => {
            const text = d.plan[tag][m.k], g = gericht(m.k);
            return <Zeile key={m.k} onClick={g ? () => { window.location.href = WEG.gericht(g.id); } : undefined}
              links={g?.bild
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/ernaehrung/bild?name=${encodeURIComponent(g.bild)}`} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover' }} />
                : <span style={{ fontSize: TYP.mikro, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, width: 52 }}>{m.label}</span>}
              titel={text ? <span>{g?.bild ? <span style={{ color: C.inkLeise, fontSize: 12 }}>{m.label} · </span> : ''}{text}</span> : <span style={{ color: C.inkLeise }}>noch nichts geplant</span>}
              unter={g ? [g.dauerMin ? `${g.dauerMin} Min` : '', 'Rezept ›'].filter(Boolean).join(' · ') : undefined} />;
          })}
        </Liste>
      )}
    </Karte>
  );
}

// ── Index je Säule ──────────────────────────────────────────────────────────
const INDEX_QUELLEN: Record<string, { url: string; label: string; farbe: string; ziel: string; lies: (d: unknown) => { index: number | null; label: string; saeulen: { id: string; label: string; score: number | null }[] } | null }> = {
  business: { url: '/api/business?scope=gesamt&kompakt=1', label: 'Business-Index', farbe: LEUCHT.business, ziel: WEG.business(), lies: d => { const bi = (d as { bi?: { index: number | null; label: string; saeulen: { id: string; label: string; score: number | null }[] } }).bi; return bi ? { index: bi.index, label: bi.label, saeulen: bi.saeulen } : null; } },
  privat: { url: '/api/privat?kompakt=1', label: 'Privat-Index', farbe: LEUCHT.geld, ziel: WEG.privatIndex(), lies: d => { const r = d as { ok?: boolean; index?: number | null; label?: string; saeulen?: { id: string; label: string; score: number | null }[] }; return r?.ok ? { index: r.index ?? null, label: r.label ?? '', saeulen: r.saeulen ?? [] } : null; } },
  gesundheit: { url: '/api/gesundheit/index?kompakt=1', label: 'Gesundheits-Index', farbe: LEUCHT.gut, ziel: WEG.gesundheit('index'), lies: d => { const r = d as { ok?: boolean; index?: number | null; label?: string; saeulen?: { id: string; label: string; score: number | null }[] }; return r?.ok ? { index: r.index ?? null, label: r.label ?? '', saeulen: r.saeulen ?? [] } : null; } },
  traktion: { url: '/api/crm/traktion', label: 'Traktions-Score', farbe: LEUCHT.business, ziel: markttraktion('sales'), lies: d => { const r = (d as { index?: { index: number | null; label: string; saeulen: { id: string; label: string; score: number | null }[] } }).index; return r ? { index: r.index, label: r.label, saeulen: r.saeulen } : null; } },
};
function IndexWidget({ e, titel, i }: WidgetProps) {
  const q = INDEX_QUELLEN[str(e.saeule, 'business')] ?? INDEX_QUELLEN.business;
  const d = useDaten(q.url, q.lies);
  if (d === null) return null;
  const farbe = d?.index == null ? C.inkLeise : zoneFarbe(d.index);
  return (
    <Karte i={i} akzent={d?.index != null ? farbe : undefined}>
      <Ueberschrift farbe={q.farbe} rechts={<Link href={q.ziel} style={link}>öffnen ›</Link>}>{titel ?? q.label}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Ring groesse="klein" label="Index" wert={d?.index != null ? String(Math.round(d.index)) : undefined} farbe={farbe} anteil={d?.index != null ? d.index / 100 : undefined} />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{d === undefined ? 'lade …' : d.label || (d.index == null ? 'Noch keine Messung' : '')}</div>
          {(d?.saeulen ?? []).slice(0, 4).map(s => (
            <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: s.score == null ? C.inkLeise : zoneFarbe(s.score) }}>{s.score == null ? '—' : Math.round(s.score)}</span>
              <div style={{ gridColumn: '1 / -1' }}><Fortschritt anteil={(s.score ?? 0) / 100} farbe={s.score == null ? C.inkLeise : zoneFarbe(s.score)} /></div>
            </div>
          ))}
        </div>
      </div>
    </Karte>
  );
}

// ── Finanzen privat ─────────────────────────────────────────────────────────
function FinanzenPrivatWidget({ titel, i }: WidgetProps) {
  const router = useRouter();
  const d = useDaten<string[]>('/api/haushalt?nur=signale', x => { const r = x as { ok?: boolean; leer?: boolean; punkte?: string[] }; return r?.ok && !r.leer ? r.punkte ?? [] : null; });
  if (d === null) return null;
  const rot = (t: string) => /Überfällig|kein Kontoauszug/.test(t);
  return (
    <Karte i={i} akzent={d?.some(rot) ? LEUCHT.kritisch : undefined}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={<Link href={WEG.zahlen('privat')} style={link}>Privat ›</Link>}>{titel ?? 'Finanzen · privat'}</Ueberschrift>
      <Liste>
        {d === undefined && <Leer>lade …</Leer>}
        {d && !d.length && <Leer>Nichts fällig. Alles bezahlt.</Leer>}
        {(d ?? []).slice(0, 4).map(t => <Zeile key={t} onClick={() => router.push(/Rechnung|Rate/.test(t) ? WEG.privat('schulden') : /Kontoauszug/.test(t) ? WEG.privat('buchungen') : WEG.privatIndex())} links={<Punkt farbe={rot(t) ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={<span style={{ whiteSpace: 'normal' }}>{t}</span>} />)}
      </Liste>
    </Karte>
  );
}

// ── Jarvis (Stapel) & Inbox ─────────────────────────────────────────────────
function JarvisWidget({ e, titel, i }: WidgetProps) {
  const stapel = useDaten<number>('/api/jarvis/stapel', x => { const d = x as { offen?: number | unknown[]; vorschlaege?: unknown[] }; return typeof d.offen === 'number' ? d.offen : Array.isArray(d.offen) ? d.offen.length : (d.vorschlaege ?? []).length; });
  const mitInbox = e.inbox === true;
  const inbox = useDaten<number>(mitInbox ? '/api/state/inbox' : '/api/state/inbox?leer=1', x => Object.values(((x as { status?: Record<string, { status: string }> }).status ?? {})).filter(s => s.status === 'offen' || s.status === 'warten').length);
  const n = stapel ?? null;
  return (
    <Karte i={i} akzent={n ? LEUCHT.achtung : undefined}>
      <Ueberschrift farbe={n ? LEUCHT.achtung : C.inkLeise} rechts={<Link href="/os/stapel" style={link}>Stapel ›</Link>}>{titel ?? (mitInbox ? 'Jarvis & Inbox' : 'Jarvis')}</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link href="/os/stapel" style={{ textDecoration: 'none', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(34px,4vw,44px)', letterSpacing: '-.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: n ? LEUCHT.achtung : C.inkLeise, textShadow: n ? `0 0 24px ${LEUCHT.achtung}33` : undefined }}>{n == null ? '—' : n}</Link>
        <div style={{ fontSize: TYP.body, fontWeight: 600, lineHeight: 1.35 }}>
          {n == null ? 'Jarvis' : n === 0 ? 'Nichts vorbereitet — alles erledigt.' : `Vorschl${n === 1 ? 'ag wartet' : 'äge warten'} auf dich`}
          {mitInbox && <div style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 500, marginTop: 4 }}><Link href="/os/inbox" style={{ color: C.inkDim }}>{inbox ? `${inbox} in der Inbox offen ›` : 'Inbox ›'}</Link></div>}
        </div>
      </div>
    </Karte>
  );
}

// ── Familie & Partnerschaft ─────────────────────────────────────────────────
interface FamilieStand { gespraech?: { datum: string }; tage?: { id: string; titel: string; wer: string; am: string; inTagen: number; erledigt: boolean }[]; frage?: string; kontakte?: { id: string; name: string; faellig: boolean; seit: number | null }[]; heute?: string }
function FamilieWidget({ titel, i }: WidgetProps) {
  const d = useDaten<FamilieStand>('/api/familie', x => ((x as { ok?: boolean }).ok ? (x as FamilieStand) : null));
  if (d === null) return null;
  const tage = (d?.tage ?? []).filter(t => !t.erledigt).slice(0, 2);
  const faellig = (d?.kontakte ?? []).filter(k => k.faellig).slice(0, 2);
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.beziehung} rechts={<Link href="/os/familie" style={link}>Familie ›</Link>}>{titel ?? 'Familie & Partnerschaft'}</Ueberschrift>
      {d === undefined && <Leer>lade …</Leer>}
      {d && (
        <Liste>
          {d.gespraech && <Zeile links={<Punkt farbe={LEUCHT.beziehung} />} titel="Paar-Gespräch" unter={d.gespraech.datum === d.heute ? 'heute' : `am ${tagKurz(d.gespraech.datum)}`} />}
          {tage.map(t => <Zeile key={t.id} links={<Punkt farbe={t.inTagen <= 7 ? LEUCHT.achtung : C.inkLeise} />} titel={`${t.titel} · ${t.wer}`} unter={t.inTagen === 0 ? 'heute!' : t.inTagen === 1 ? 'morgen' : `in ${t.inTagen} Tagen`} />)}
          {faellig.map(k => <Zeile key={k.id} links={<Punkt farbe={LEUCHT.achtung} />} titel={`${k.name} anrufen`} unter={k.seit == null ? 'noch nie' : `zuletzt vor ${k.seit} Tagen`} />)}
          {d.frage && <Zeile links={<span style={{ color: LEUCHT.beziehung }}>?</span>} titel={<span style={{ whiteSpace: 'normal', fontWeight: 500 }}>{d.frage}</span>} unter="Frage der Woche" />}
        </Liste>
      )}
    </Karte>
  );
}

// ── Register + Katalog ──────────────────────────────────────────────────────
const TAGE_WAHL: EinstellungDef = { k: 'tage', label: 'Zeitraum', art: 'wahl', optionen: [{ w: 1, label: 'heute' }, { w: 3, label: '3 Tage' }, { w: 7, label: '7 Tage' }, { w: 14, label: '14 Tage' }], standard: 1 };
export const WIDGETS: Record<string, WidgetDef> = {
  aufgaben: { art: 'aufgaben', label: 'Aufgaben', bereich: 'Tag', beschreibung: 'Fällige und kritische Aufgaben, Schnellanlage', breite: 4, Komponente: AufgabenWidget,
    einstellungen: [{ k: 'nur', label: 'Zeigt', art: 'wahl', optionen: [{ w: 'dran', label: 'fällig & kritisch' }, { w: 'alle', label: 'alle offenen' }], standard: 'dran' }, { k: 'anzahl', label: 'Anzahl', art: 'wahl', optionen: [{ w: 5, label: '5' }, { w: 8, label: '8' }, { w: 12, label: '12' }], standard: 8 }] },
  termine: { art: 'termine', label: 'Termine', bereich: 'Tag', beschreibung: 'Heute oder die nächsten Tage aus dem Kalender', breite: 4, Komponente: TermineWidget,
    einstellungen: [TAGE_WAHL, { k: 'business', label: 'KEMARIS-Termine dazu', art: 'schalter', standard: false }] },
  fokus: { art: 'fokus', label: 'Fokus', bereich: 'Tag', beschreibung: 'Worauf es heute, diese Woche oder diesen Monat ankommt', breite: 2, Komponente: FokusWidget,
    einstellungen: [{ k: 'horizont', label: 'Horizont', art: 'wahl', optionen: [{ w: 'auto', label: 'der nächste gesetzte' }, { w: 'tag', label: 'heute' }, { w: 'woche', label: 'Woche' }, { w: 'monat', label: 'Monat' }], standard: 'auto' }] },
  koerper: { art: 'koerper', label: 'Körper', bereich: 'Gesundheit', beschreibung: 'Recovery und Routinen von heute', breite: 2, Komponente: KoerperWidget },
  routinen: { art: 'routinen', label: 'Routinen & Streak', bereich: 'Gesundheit', beschreibung: 'Welche Routinen heute schon stehen, dein Streak', breite: 2, Komponente: RoutinenWidget },
  essen: { art: 'essen', label: 'Essen heute', bereich: 'Gesundheit', beschreibung: 'Die drei Mahlzeiten von heute mit Rezept und die offene Einkaufsliste', breite: 2, Komponente: EssenWidget },
  index: { art: 'index', label: 'Index je Säule', bereich: 'Zahlen', beschreibung: 'Business-, Privat-, Gesundheits-Index oder Traktions-Score mit Säulen', breite: 2, Komponente: IndexWidget,
    einstellungen: [{ k: 'saeule', label: 'Säule', art: 'wahl', optionen: [{ w: 'business', label: 'Business' }, { w: 'privat', label: 'Privat' }, { w: 'gesundheit', label: 'Gesundheit' }, { w: 'traktion', label: 'Traktion' }], standard: 'business' }] },
  'finanzen-privat': { art: 'finanzen-privat', label: 'Finanzen · privat', bereich: 'Zahlen', beschreibung: 'Fällige Raten, Rechnungen, fehlende Kontoauszüge', breite: 2, Komponente: FinanzenPrivatWidget },
  jarvis: { art: 'jarvis', label: 'Jarvis & Inbox', bereich: 'Jarvis', beschreibung: 'Vorschläge im Stapel, offene Inbox', breite: 2, Komponente: JarvisWidget,
    einstellungen: [{ k: 'inbox', label: 'Inbox dazu', art: 'schalter', standard: false }] },
  dran: { art: 'dran', label: 'Wer heute dran ist', bereich: 'Business', beschreibung: 'Die wichtigsten Kontakte der Power Hour', breite: 4, Komponente: DranWidget },
  familie: { art: 'familie', label: 'Familie & Partnerschaft', bereich: 'Familie', beschreibung: 'Paar-Gespräch, wichtige Tage, wer einen Anruf verdient, Frage der Woche', breite: 2, Komponente: FamilieWidget },
};
export const KATALOG: KatalogEintrag[] = [
  { art: 'aufgaben', label: 'Aufgaben', beschreibung: WIDGETS.aufgaben.beschreibung, bereich: 'Tag', breite: 4 },
  { art: 'termine', label: 'Termine heute', beschreibung: 'Die Termine von heute', bereich: 'Tag', breite: 4 },
  { art: 'termine', label: 'Nächste 7 Tage', beschreibung: 'Was in der Woche ansteht — privat und KEMARIS', bereich: 'Tag', breite: 4, voreinstellung: { tage: 7, business: true } },
  { art: 'fokus', label: 'Fokus', beschreibung: 'Der nächste gesetzte Fokus', bereich: 'Tag', breite: 2 },
  { art: 'fokus', label: 'Wochenfokus', beschreibung: 'Worauf es diese Woche ankommt', bereich: 'Tag', breite: 2, voreinstellung: { horizont: 'woche' } },
  { art: 'koerper', label: 'Körper', beschreibung: WIDGETS.koerper.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'routinen', label: 'Routinen & Streak', beschreibung: WIDGETS.routinen.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'essen', label: 'Essen heute', beschreibung: WIDGETS.essen.beschreibung, bereich: 'Gesundheit', breite: 2 },
  { art: 'index', label: 'Business-Index', beschreibung: 'Der Index mit seinen Säulen', bereich: 'Zahlen', breite: 2, voreinstellung: { saeule: 'business' } },
  { art: 'index', label: 'Privat-Index', beschreibung: 'Der Privat-Index mit seinen Säulen', bereich: 'Zahlen', breite: 2, voreinstellung: { saeule: 'privat' } },
  { art: 'index', label: 'Gesundheits-Index', beschreibung: 'Der Gesundheits-Index mit seinen Säulen', bereich: 'Gesundheit', breite: 2, voreinstellung: { saeule: 'gesundheit' } },
  { art: 'index', label: 'Traktions-Score', beschreibung: 'Der Traktions-Score der Markttraktion', bereich: 'Business', breite: 2, voreinstellung: { saeule: 'traktion' } },
  { art: 'finanzen-privat', label: 'Finanzen · privat', beschreibung: WIDGETS['finanzen-privat'].beschreibung, bereich: 'Zahlen', breite: 2 },
  { art: 'jarvis', label: 'Jarvis & Inbox', beschreibung: WIDGETS.jarvis.beschreibung, bereich: 'Jarvis', breite: 2, voreinstellung: { inbox: true } },
  { art: 'dran', label: 'Wer heute dran ist', beschreibung: WIDGETS.dran.beschreibung, bereich: 'Business', breite: 4 },
  { art: 'familie', label: 'Familie & Partnerschaft', beschreibung: WIDGETS.familie.beschreibung, bereich: 'Familie', breite: 2 },
];
export const widgetDef = (art: string): WidgetDef | undefined => WIDGETS[art];
export type { ReactNode };
