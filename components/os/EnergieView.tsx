'use client';

// ─── MAKE OS — Energie erhöhen (4-Wochen-Blick) ─────────────────────────────
// Kevins Frage: „Was habe ich in den nächsten 4 Wochen für meine Gesundheit
// geplant?" — Sport/Reha-Blöcke aus dem Wochenplaner, Gesundheits-Termine aus
// beiden Kalendern, fällige Gesundheits-Etappen, dazu Ernährung und Routinen.
// Privat. Lücken werden ehrlich benannt — eine leere Woche ist eine Ansage.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import type { PlanBlock } from '@/types/planer';
import { localDay } from '@/lib/zeit';
import { Seitenkopf } from './Seitenkopf';

interface Termin { titel: string; date: string; zeit: string }
interface Meilenstein { titel: string; faellig?: string; zeitfenster?: string; messlatte?: string; fortschritt: number; erledigt: boolean; bereich: string }

const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };
const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const GES_TERMIN = /arzt|dr\.|physio|reha|spritze|infiltration|neurolog|orthop|training|sport|gym|fitness|schwimm|massage|therapie/i;
const GES_BLOCK = /sport|train|gym|lauf|schwimm|spazier|bewegung|yoga|dehn/i;
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function montagVon(tag: string): string {
  const d = new Date(`${tag}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDay(d);
}
const tagPlus = (t: string, n: number) => { const d = new Date(`${t}T12:00:00`); d.setDate(d.getDate() + n); return localDay(d); };

export function EnergieView({ eingebettet = false }: { eingebettet?: boolean } = {}) {
  const heute = localDay();
  const startMontag = montagVon(heute);
  const wochen = [0, 1, 2, 3].map(i => tagPlus(startMontag, i * 7));

  const [bloecke, setBloecke] = useState<Record<string, PlanBlock[]>>({});
  const [termine, setTermine] = useState<Termin[]>([]);
  const [etappen, setEtappen] = useState<Meilenstein[]>([]);
  const [essenGeplant, setEssenGeplant] = useState<number | null>(null);
  const [routinen, setRoutinen] = useState<{ label: string; wann: string; kategorie: string }[]>([]);

  useEffect(() => {
    wochen.forEach(w => {
      fetch(`/api/state/wochenplan?woche=${w}`).then(r => r.json())
        .then(d => setBloecke(prev => ({ ...prev, [w]: Array.isArray(d.bloecke) ? d.bloecke : [] }))).catch(() => {});
    });
    Promise.all([
      fetch('/api/apple-calendar').then(r => r.json()).catch(() => []),
      fetch('/api/kemaris-calendar').then(r => r.json()).catch(() => ({ events: [] })),
    ]).then(([apple, kem]) => {
      const bis = tagPlus(startMontag, 28);
      const roh = [
        ...(Array.isArray(apple) ? apple : []).filter((e: { allDay?: boolean; startDate?: string }) => !e.allDay && e.startDate)
          .map((e: { title?: string; startDate?: string }) => ({ t: e.title ?? '', s: e.startDate! })),
        ...((kem?.events ?? []) as { title?: string; start?: string }[]).filter(e => e.start).map(e => ({ t: e.title ?? '', s: e.start! })),
      ];
      const gesehen = new Set<string>();
      setTermine(roh
        .filter(e => GES_TERMIN.test(e.t) && e.s.slice(0, 10) >= startMontag && e.s.slice(0, 10) < bis)
        .filter(e => { const k = `${e.t.toLowerCase()}|${e.s.slice(0, 16)}`; if (gesehen.has(k)) return false; gesehen.add(k); return true; })
        .map(e => ({ titel: e.t, date: e.s.slice(0, 10), zeit: e.s.slice(11, 16) })));
    });
    fetch('/api/state/meilensteine').then(r => r.json())
      .then(d => setEtappen((d.meilensteine ?? []).filter((m: Meilenstein) => m.bereich === 'gesundheit' && !m.erledigt))).catch(() => {});
    fetch('/api/state/ernaehrung').then(r => r.json())
      .then(d => setEssenGeplant(Object.values(d.plan ?? {}).reduce((s: number, t) => s + ['fruehstueck', 'mittag', 'abend'].filter(k => (t as Record<string, string>)[k]?.trim()).length, 0))).catch(() => {});
    fetch('/api/state/routinen').then(r => r.json())
      .then(d => setRoutinen((d.routinen ?? []).filter((x: { aktiv: boolean; kategorie: string }) => x.aktiv && x.kategorie === 'gesundheit'))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wochenDaten = wochen.map((w, wi) => {
    const tage = Array.from({ length: 7 }, (_, i) => tagPlus(w, i));
    const wb = (bloecke[w] ?? []).filter(b => !wi ? b.date >= heute : true);
    const reha = wb.filter(b => b.art === 'reha');
    const sport = wb.filter(b => b.art !== 'reha' && GES_BLOCK.test(b.titel));
    const term = termine.filter(t => tage.includes(t.date));
    const ms = etappen.filter(m => m.faellig && tage.includes(m.faellig));
    return { w, wi, tage, reha, sport, term, ms };
  });

  const wLabel = (w: string, wi: number) => wi === 0 ? 'Diese Woche' : wi === 1 ? 'Nächste Woche' : `ab ${w.slice(8)}.${w.slice(5, 7)}.`;
  const tagKurz = (d: string) => ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][new Date(`${d}T12:00:00`).getDay()];

  return (
    <div style={eingebettet ? { color: T.ink, fontFamily: T.sans } : { minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div className="stagger" style={eingebettet ? {} : { maxWidth: 860, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        {!eingebettet && <Seitenkopf
          rubrik={<>Gesundheit · Energie erhöhen</>}
          titel={<>Die nächsten 4 Wochen.</>}
          satz={<>Was für Körper und Energie wirklich geplant ist — Sport, Reha, Termine, Etappen. Eine leere Woche ist keine freie Woche, sondern eine Ansage.</>}
        />}

        {/* 4 Wochen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '18px 0' }}>
          {wochenDaten.map(({ w, wi, reha, sport, term, ms }) => {
            const leer = !reha.length && !sport.length && !term.length && !ms.length;
            return (
              <div key={w} style={{ ...panel, borderLeft: `3px solid ${leer ? T.amber : '#58D9CD'}`, padding: '14px 18px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: leer ? 0 : 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{wLabel(w, wi)}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 11, color: reha.length ? T.accent : T.amber }}>
                    Reha {reha.length}× {reha.length === 0 ? '— Bandscheibe braucht täglich' : reha.length < 5 ? '— Luft nach oben' : '✓'}
                  </span>
                  {leer && <span style={{ fontSize: 12, color: T.amber }}>nichts geplant — <Link href="/os/planung/woche" style={{ color: T.accentInk, textDecoration: 'none' }}>Blöcke reinziehen ›</Link></span>}
                </div>
                {(reha.length > 0 || sport.length > 0) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: term.length || ms.length ? 8 : 0 }}>
                    {[...reha, ...sport].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin).map((b, i) => (
                      <span key={i} style={{ fontFamily: T.mono, fontSize: 11, color: b.art === 'reha' ? '#58D9CD' : T.accentInk, border: `1px solid ${b.art === 'reha' ? '#58D9CD44' : `${T.accent}44`}`, borderRadius: 6, padding: '3px 9px' }}>
                        {tagKurz(b.date)} {mm(b.startMin)} {b.titel}
                      </span>
                    ))}
                  </div>
                )}
                {term.map((t, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>
                    <span style={{ color: T.muted }}>🔒 {tagKurz(t.date)} {t.date.slice(8)}.{t.date.slice(5, 7)}. {t.zeit}</span> {t.titel}
                  </div>
                ))}
                {ms.map((m, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>
                    <span style={{ color: T.amber }}>◇</span> <b style={{ color: T.ink }}>{m.titel}</b> fällig {m.faellig!.slice(8)}.{m.faellig!.slice(5, 7)}. · {m.fortschritt}%{m.messlatte ? ` — ${m.messlatte}` : ''}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Etappen + Ernährung + Routinen */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          <div style={{ ...panel, padding: '14px 18px' }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Etappen</div>
            {etappen.length ? etappen.map((m, i) => (
              <div key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6, marginBottom: 4 }}>
                <b style={{ color: T.ink }}>{m.titel}</b> · {m.fortschritt}%
                {m.messlatte && <div style={{ fontSize: 11, color: T.muted }}>{m.messlatte}</div>}
              </div>
            )) : <span style={{ fontSize: 12, color: T.muted }}>keine offenen</span>}
            <Link href="/os/planung/jahr" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>pflegen ›</Link>
          </div>
          <div style={{ ...panel, padding: '14px 18px' }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Ernährung</div>
            <div style={{ fontSize: 12.5, color: essenGeplant ? T.inkDim : T.amber, lineHeight: 1.55 }}>
              {essenGeplant == null ? 'lade …' : essenGeplant ? `Essens-Woche: ${essenGeplant}/21 Mahlzeiten geplant.` : 'Keine Essens-Woche geplant — Jarvis macht dir in 30 Sekunden eine.'}
            </div>
            <Link href="/os/ernaehrung" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>Ernährung öffnen ›</Link>
          </div>
          <div style={{ ...panel, padding: '14px 18px' }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Tägliche Gesundheits-Routinen</div>
            {routinen.length ? routinen.map((r, i) => (
              <div key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6 }}>· {r.label} <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>({r.wann})</span></div>
            )) : <span style={{ fontSize: 12, color: T.muted }}>keine aktiv</span>}
            <Link href="/os/planung/routinen" style={{ fontSize: 11.5, color: T.accentInk, textDecoration: 'none' }}>planen ›</Link>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 16 }}>
          Geplant wird im <Link href="/os/planung/woche" style={{ color: T.accentInk, textDecoration: 'none' }}>Wochenplaner</Link> (Reha-Baustein reinziehen) — hier siehst du, ob die 4 Wochen tragen.
        </div>
      </div>
    </div>
  );
}
