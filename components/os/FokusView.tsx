'use client';

// ─── MAKE OS — Fokus (neu 24.09.) ───────────────────────────────────────────
// Kevin: „Fokus, das haben wir ja auch als riesiges Thema. Auch wenn es ein
// Score von Planung ist.“ Vorher lag Fokus über fünf Stellen verstreut, und
// /os/fokus leitete auf Gesundheit um. Jetzt eine Seite:
//   1. Unser Fokus — ein Satz für heute, die Woche, den Monat (ziele.fokus)
//   2. Tagesform — die echte Recovery von heute, auf Wunsch mit KI-Einordnung
//   3. Worauf die Energie geht — die Fokus-Regler je Säule (gepflegt im Kompass)

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Rich } from './Rich';
import { Seite, Karte, Ueberschrift, Ring, Chip, Knopf, Leer, feld, zoneFarbe, LEUCHT } from './schlank';

type Horizont = 'tag' | 'woche' | 'monat';
const HORIZONTE: { id: Horizont; label: string; frage: string }[] = [
  { id: 'tag', label: 'Heute', frage: 'Was muss heute passieren, damit der Tag gut war?' },
  { id: 'woche', label: 'Diese Woche', frage: 'Worauf zahlt diese Woche ein?' },
  { id: 'monat', label: 'Dieser Monat', frage: 'Was ist das eine Ergebnis des Monats?' },
];
const SAEULEN: Record<string, { name: string; farbe: string }> = {
  health: { name: 'Gesundheit', farbe: LEUCHT.gut }, business: { name: 'Business', farbe: LEUCHT.business }, planning: { name: 'Planung', farbe: LEUCHT.planung },
  finance: { name: 'Finanzen', farbe: LEUCHT.geld }, social: { name: 'Familie & Partnerschaft', farbe: LEUCHT.beziehung },
};

export function FokusView() {
  const [fokus, setFokus] = useState<Partial<Record<Horizont, string>>>({});
  const [entwurf, setEntwurf] = useState<Partial<Record<Horizont, string>>>({});
  const [gespeichert, setGespeichert] = useState<Horizont | null>(null);
  const [rec, setRec] = useState<number | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [regler, setRegler] = useState<Record<string, number> | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/state/ziele').then(r => r.json()).then(d => { const f = (d.state ?? d)?.fokus ?? {}; setFokus(f); setEntwurf(f); }).catch(() => {});
    fetch('/api/gesundheit/stand').then(r => r.json()).then(d => { if (d?.vitals) { setRec(typeof d.vitals.rec === 'number' ? d.vitals.rec : null); setFrisch(!!(d.vitals.heute || (d.vitals.alterTage <= 1 && !d.vitals.fallback))); } }).catch(() => {});
    fetch('/api/state/fokus-regler').then(r => r.json()).then(d => setRegler(d.regler ?? null)).catch(() => {});
  }, []);

  async function speichern(h: Horizont) {
    const text = (entwurf[h] ?? '').trim();
    if (text === (fokus[h] ?? '')) return;
    const r = await fetch('/api/state/ziele', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ horizont: h, fokus: text }) }).then(x => x.json()).catch(() => null);
    if (r?.ok) { setFokus(r.fokus ?? { ...fokus, [h]: text }); setGespeichert(h); setTimeout(() => setGespeichert(null), 1800); }
  }
  async function ausrichten() {
    setBusy(true);
    try { const d = await fetch('/api/fokus', { method: 'POST' }).then(r => r.json()); setPlan(d.reply ?? d.error ?? 'Keine Antwort.'); }
    catch { setPlan('Nicht erreichbar.'); }
    setBusy(false);
  }

  const zone = rec == null ? null : rec >= 67 ? 'Grün' : rec >= 34 ? 'Gelb' : 'Rot';
  const zoneText = rec == null ? 'Noch keine Recovery von heute — der Tag wird nach Prioritäten geplant.'
    : rec >= 67 ? 'Grün: Tiefe Arbeit zuerst. Der schwerste Block gehört in den Vormittag.'
    : rec >= 34 ? 'Gelb: Eine tiefe Einheit, dann Routine. Keine neuen Großbaustellen.'
    : 'Rot: Nur das Nötige. Termine schieben, Erholung einplanen.';

  return (
    <Seite titel="Fokus" unter="Worauf es heute, diese Woche und diesen Monat ankommt — und ob der Körper mitmacht.">
      <Karte i={0} akzent={LEUCHT.planung}>
        <Ueberschrift farbe={LEUCHT.planung}>Unser Fokus</Ueberschrift>
        <div style={{ display: 'grid', gap: 14 }}>
          {HORIZONTE.map(h => (
            <label key={h.id} style={{ display: 'grid', gap: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: TYP.mikro, letterSpacing: '.1em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 600 }}>
                {h.label}{gespeichert === h.id && <span style={{ color: LEUCHT.gut, letterSpacing: 0, textTransform: 'none' }}>gespeichert</span>}
              </span>
              <input value={entwurf[h.id] ?? ''} placeholder={h.frage} onChange={e => setEntwurf({ ...entwurf, [h.id]: e.target.value })}
                onBlur={() => void speichern(h.id)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                style={{ ...feld, fontSize: h.id === 'tag' ? 17 : TYP.body, fontWeight: h.id === 'tag' ? 600 : 400 }} aria-label={`Fokus ${h.label}`} />
            </label>
          ))}
        </div>
      </Karte>

      <Karte i={1} akzent={zone ? zoneFarbe(rec) : undefined}>
        <Ueberschrift farbe={zone ? zoneFarbe(rec) : undefined} rechts={<Link href="/os/gesundheit" style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>Gesundheit ›</Link>}>Tagesform</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,40px)', alignItems: 'center' }}>
          <Ring label="Recovery" wert={rec != null ? String(rec) : undefined} farbe={zoneFarbe(rec)} anteil={rec != null ? rec / 100 : undefined}
            unter={zone ? <Chip farbe={zoneFarbe(rec)}>{frisch ? `Zone ${zone}` : `${zone} · nicht von heute`}</Chip> : undefined} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{zoneText}</p>
            <div style={{ marginTop: 14 }}><Knopf onClick={ausrichten} aus={busy}>{busy ? 'richtet aus …' : plan ? '↻ Neu ausrichten' : 'Tag mit Jarvis ausrichten'}</Knopf></div>
          </div>
        </div>
        {plan && <div style={{ marginTop: 16 }}><Rich text={plan} /></div>}
      </Karte>

      <Karte i={2}>
        <Ueberschrift rechts={<Link href="/os/kompass" style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>Im Kompass ändern ›</Link>}>Worauf die Energie geht</Ueberschrift>
        {regler ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {Object.entries(SAEULEN).map(([k, s]) => {
              const w = regler[k] ?? 0;
              return (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 40px', gap: 12, alignItems: 'center', fontSize: TYP.bedien }}>
                  <span style={{ color: C.inkDim }}>{s.name}</span>
                  <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,.06)' }}><div style={{ width: `${w}%`, height: '100%', borderRadius: 99, background: s.farbe, boxShadow: `0 0 10px ${s.farbe}66` }} /></div>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink, textAlign: 'right' }}>{w}</span>
                </div>
              );
            })}
            <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 4 }}>Die Regler bestimmen, welche Aufgaben im Tagesplan als Fokus markiert werden und wie der Wochenplan gewichtet.</div>
          </div>
        ) : <Leer>Noch keine Regler gesetzt — im Kompass einstellen.</Leer>}
      </Karte>
    </Seite>
  );
}
