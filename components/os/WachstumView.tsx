'use client';

// ─── MAKE OS — Wachstum ─────────────────────────────────────────────────────
// Kevin, 23.09.: „wir müssen daraus einen gesamt performance score bauen für
// wachstum. Gesundheit ist die Basis." — 24.09.: „Nimm als Score das ganze
// Thema Wachstum mit rein. Einen eigenen Bereich."
//
// Der Wachstums-Score im Zentrum, darunter die fünf Säulen mit ihren Faktoren
// (echt gemessen oder noch nicht), der Verlauf, die Ziele je Horizont und der
// Fokus. Alles, was Wachstum misst, auf einer Seite.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Ring, Balken, Chip, Fortschritt, Zahl, zoneFarbe, LEUCHT } from './schlank';

interface Faktor { label: string; wert: number; echt: boolean; quelle?: string }
interface Saeule { key: string; label: string; gewicht: number; score: number | null; zuDuenn: boolean; faktoren?: Faktor[] }
interface Perf { index: number | null; label: string; hebel: string | null; abdeckung: number; stand: string; saeulen: Saeule[] }
interface Messung { date: string; index: number | null }
interface Ziel { id: string; titel: string; fortschritt: number; erledigt: boolean }
interface Ziele { monat: Ziel[]; quartal: Ziel[]; jahr: Ziel[]; fokus: { monat?: string; woche?: string; tag?: string } }

const FARBE_JE: Record<string, string> = { health: LEUCHT.gut, business: LEUCHT.business, planning: LEUCHT.planung, finance: LEUCHT.geld, social: LEUCHT.beziehung, agents: LEUCHT.agenten };
const KURZ: Record<string, string> = { health: 'Gesundheit', business: 'Business', planning: 'Planung', finance: 'Finanzen', social: 'Beziehung', agents: 'Agenten' };
const HREF: Record<string, string> = { health: '/os/gesundheit', finance: '/os/finanzen', agents: '/os/agenten' };

export function WachstumView() {
  const [perf, setPerf] = useState<Perf | null>(null);
  const [verlauf, setVerlauf] = useState<Messung[]>([]);
  const [ziele, setZiele] = useState<Ziele | null>(null);
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/performance').then(r => r.json()).then(d => { setPerf(d.aktuell ?? null); setVerlauf(d.verlauf ?? []); }).catch(() => {});
    fetch('/api/state/ziele').then(r => r.json()).then(d => setZiele(d.state ?? d)).catch(() => {});
  }, []);

  const zone = zoneFarbe(perf?.index);
  const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '');
  const erste = verlauf[0]?.date;
  const bester = verlauf.reduce<Messung | null>((b, m) => (m.index != null && (b == null || (b.index ?? 0) < m.index) ? m : b), null);
  const horizonte: { id: 'jahr' | 'quartal' | 'monat'; label: string; href: string; farbe: string }[] = [
    { id: 'jahr', label: 'Jahr', href: '/os/planung/jahr', farbe: LEUCHT.schlaf },
    { id: 'quartal', label: 'Quartal', href: '/os/planung/quartal', farbe: LEUCHT.puls },
    { id: 'monat', label: 'Monat', href: '/os/planung/monat', farbe: LEUCHT.gut },
  ];

  return (
    <Seite titel="Wachstum" unter="Der Score, auf den wir hinarbeiten: wachsen, uns optimieren, Unternehmertum, Firmen optimieren, mehr Geld verdienen. Gesundheit ist die Basis.">
      <Karte i={0} akzent={perf?.index != null ? zone : undefined}>
        <Ueberschrift farbe={zone} rechts={perf?.stand ? `Stand ${datum(perf.stand)}` : undefined}>Wachstums-Score</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,44px)', alignItems: 'center' }}>
          <Ring groesse="gross" label="Wachstums-Score" wert={perf?.index != null ? String(perf.index) : undefined} farbe={zone} anteil={perf?.index != null ? perf.index / 100 : undefined}
            unter={perf?.index != null ? <Chip farbe={zone}>{perf.label}</Chip> : undefined} />
          <div style={{ minWidth: 0, width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
              <Zahl wert={perf ? `${Math.round(perf.abdeckung * 100)}` : undefined} label="% der Messpunkte echt gemessen" farbe={perf ? (perf.abdeckung >= 0.6 ? LEUCHT.gut : perf.abdeckung >= 0.4 ? LEUCHT.achtung : LEUCHT.kritisch) : undefined} />
              <Zahl wert={bester?.index != null ? String(bester.index) : undefined} label={bester ? `Bestwert · ${datum(bester.date)}` : 'Bestwert'} farbe={zoneFarbe(bester?.index)} />
              <Zahl wert={verlauf.length ? String(verlauf.length) : undefined} label={erste ? `Messungen seit ${datum(erste)}` : 'Messungen'} />
            </div>
            {perf?.hebel && <p style={{ fontSize: TYP.body, color: C.inkDim, margin: '16px 0 0' }}>Größter Hebel: <b style={{ color: C.ink, fontWeight: 600 }}>{perf.hebel}</b></p>}
            {perf && perf.index == null && <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '16px 0 0' }}>Noch zu wenig gemessen, um einen Score zu nennen — unter 40 % Abdeckung gibt es keine Zahl.</p>}
            {verlauf.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11.5, color: C.inkLeise, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Verlauf</div>
                <Balken werte={verlauf.slice(-30).map(m => m.index)} max={100} farbe={zone} hoehe={44} titel={verlauf.slice(-30).map(m => `${datum(m.date)} · ${m.index ?? '—'}`)} />
              </div>
            )}
          </div>
        </div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts="Klick zeigt die Faktoren">Die sechs Säulen</Ueberschrift>
        <Liste>
          {(perf?.saeulen ?? []).map(s => {
            const f = FARBE_JE[s.key] ?? C.inkLeise;
            const w = s.score == null || s.score === 0 ? undefined : String(s.score);
            const echt = (s.faktoren ?? []).filter(x => x.echt).length;
            const auf = offen === s.key;
            return (
              <div key={s.key}>
                <Zeile onClick={() => setOffen(o => (o === s.key ? null : s.key))} aktiv={auf}
                  links={<Ring groesse="klein" label="" wert={w} farbe={s.zuDuenn ? `${f}99` : f} anteil={w ? Number(w) / 100 : undefined} />}
                  titel={<><span>{KURZ[s.key] ?? s.label}</span><span style={{ color: C.inkLeise, fontWeight: 400 }}> · {Math.round(s.gewicht * 100)} % Gewicht</span></>}
                  unter={s.faktoren?.length ? `${echt} von ${s.faktoren.length} Faktoren echt gemessen${s.zuDuenn ? ' · noch dünn' : ''}` : undefined}
                  rechts={<Chip farbe={s.zuDuenn || !w ? C.inkLeise : zoneFarbe(s.score)}>{w ?? '—'}</Chip>} />
                {auf && (
                  <div style={{ padding: '4px 2px 14px 82px' }}>
                    {(s.faktoren ?? []).map(x => (
                      <div key={x.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 200px) 1fr 44px', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                        <span style={{ fontSize: TYP.bedien, color: x.echt ? C.ink : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.quelle}>{x.label}</span>
                        <Fortschritt anteil={x.echt ? x.wert / 100 : 0} farbe={f} />
                        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: x.echt ? C.inkDim : C.inkLeise, textAlign: 'right' }}>{x.echt ? x.wert : '—'}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>
                      {(s.faktoren ?? []).filter(x => !x.echt).length > 0 && <>Nicht gemessen: {(s.faktoren ?? []).filter(x => !x.echt).map(x => x.quelle ?? x.label).slice(0, 3).join(' · ')}. </>}
                      <Link href={HREF[s.key] ?? `/os/saeule/${s.key}`} style={{ color: C.inkDim }}>Zur Säule ›</Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {perf && !perf.saeulen.length && <Leer>Noch keine Säulen berechnet.</Leer>}
        </Liste>
      </Karte>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        {horizonte.map((h, i) => {
          const liste = ziele?.[h.id] ?? [];
          return (
            <Karte key={h.id} i={2 + i}>
              <Ueberschrift farbe={h.farbe} rechts={<Link href={h.href} style={{ color: C.inkLeise, textDecoration: 'none' }}>pflegen ›</Link>}>Ziele · {h.label}</Ueberschrift>
              {!liste.length && <Leer>Noch kein Ziel für {h.id === 'jahr' ? 'dieses Jahr' : h.id === 'quartal' ? 'dieses Quartal' : 'diesen Monat'}.</Leer>}
              {liste.map(z => (
                <div key={z.id} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: TYP.body, fontWeight: 500, color: z.erledigt ? C.inkLeise : C.ink, textDecoration: z.erledigt ? 'line-through' : undefined }}>{z.titel}</span>
                    <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>{z.fortschritt} %</span>
                  </div>
                  <Fortschritt anteil={z.fortschritt / 100} farbe={h.farbe} />
                </div>
              ))}
            </Karte>
          );
        })}
      </div>

      <Karte i={5} akzent={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href="/os/kompass" style={{ color: C.inkLeise, textDecoration: 'none' }}>Kompass ›</Link>}>Fokus</Ueberschrift>
        <Liste>
          {(['monat', 'woche', 'tag'] as const).map(k => (
            <Zeile key={k} links={<span style={{ fontSize: 12, color: C.inkLeise, width: 52, textTransform: 'uppercase', letterSpacing: '.04em' }}>{k === 'monat' ? 'Monat' : k === 'woche' ? 'Woche' : 'Tag'}</span>}
              titel={ziele?.fokus?.[k] ? <span style={{ fontWeight: 600 }}>{ziele.fokus[k]}</span> : <span style={{ color: C.inkLeise }}>noch nicht gesetzt</span>} />
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}
