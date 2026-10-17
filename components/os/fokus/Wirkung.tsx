'use client';

// ─── Fokus › Wirkung (10.10., früher die Seite „Wachstum“) ───────────────────────────────────────────────────────────────────────
// Kevin, 23.09.: „wir müssen daraus einen gesamt performance score bauen für wachstum. Gesundheit ist die Basis.“ Seit 10.10. steht der
// Score als Abschnitt auf der Fokus-Seite — und folgt dem Bereich: der Server liefert mit `?sicht=` NUR die Säulen dieses Bereichs
// (lib/fokus/wirkung.ts — Privat: Gesundheit, Familie, Privat-Finanzen; Business: Business-Index, Business-Finanzen). Der Gesamt-Score über
// beide Bereiche steht weiter als Karte auf Heute.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import type { SteuerBereich } from '@/lib/fokus/steuerung';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Ring, Balken, Chip, Fortschritt, Zahl, Hinweis, zoneFarbe } from '../ui';
import { kennzahlTextVon } from '@/lib/erklaerungen/kennzahlen';

interface Faktor { label: string; wert: number; echt: boolean; quelle?: string; href?: string }
interface Saeule { key: string; label: string; gewicht: number; score: number | null; zuDuenn: boolean; faktoren?: Faktor[] }
interface Perf { index: number | null; label: string; hebel: string | null; abdeckung: number; stand: string; saeulen: Saeule[] }
interface Messung { date: string; index: number | null }

const FARBE_JE: Record<string, string> = { health: LEUCHT.gut, business: LEUCHT.business, finance: LEUCHT.geld, social: LEUCHT.beziehung };
const KURZ: Record<string, string> = { health: 'Gesundheit', business: 'Business', finance: 'Finanzen', social: 'Familie' };
const HREF: Record<SteuerBereich, Record<string, string>> = {
  privat: { health: WEG.gesundheit('index'), social: '/os/familie', finance: '/os/finanzen?s=privat' },
  business: { business: '/os/finanzen?s=business', finance: '/os/finanzen?s=business' },
};

export function Wirkung({ bereich, i = 0 }: { bereich: SteuerBereich; i?: number }) {
  const [perf, setPerf] = useState<Perf | null | undefined>(undefined);
  const [verlauf, setVerlauf] = useState<Messung[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  useEffect(() => {
    setPerf(undefined);
    fetch(`/api/performance?sicht=${bereich}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
      .then(d => { setPerf(d?.aktuell ?? null); setVerlauf(d?.verlauf ?? []); }).catch(() => setPerf(null));
  }, [bereich]);

  const zone = zoneFarbe(perf?.index);
  const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '');
  const bester = verlauf.reduce<Messung | null>((b, m) => (m.index != null && (b == null || (b.index ?? 0) < m.index) ? m : b), null);
  if (perf === undefined) return <Karte i={i}><Leer>lädt …</Leer></Karte>;
  if (!perf) return <Karte i={i}><Hinweis art="achtung">Die Wirkung ist gerade nicht erreichbar.</Hinweis></Karte>;
  return (
    <>
      <Karte i={i} ton={perf.index != null ? zone : undefined}>
        <Ueberschrift farbe={zone} erklaerung="fokus.wirkung" rechts={perf.stand ? `Stand ${datum(perf.stand)}` : undefined}>Wirkung {bereich === 'privat' ? 'Privat' : 'Business'}</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,44px)', alignItems: 'center' }}>
          {/* Der Ring führt weiter (17.10., Abnahme 3 · C1): Business → Verlauf des Business-Index, Privat → Wachstums-Score auf Heute. */}
          <Ring groesse="gross" label={`Wirkung ${bereich === 'privat' ? 'Privat' : 'Business'}`}
            href={bereich === 'business' ? `${WEG.business()}#index-verlauf` : WEG.heute('privat')}
            hinweis={bereich === 'business' ? 'Verlauf des Business-Index öffnen' : 'Wachstums-Score auf Heute öffnen'} wert={perf.index != null ? String(perf.index) : undefined} farbe={zone} anteil={perf.index != null ? perf.index / 100 : undefined}
            unter={perf.index != null ? <Chip farbe={zone}>{perf.label}</Chip> : undefined} />
          <div style={{ minWidth: 0, width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 16 }}>
              <Zahl erklaerung={kennzahlTextVon('fokus.wirkung.abdeckung')} wert={`${Math.round(perf.abdeckung * 100)}`} label="% der Messpunkte echt gemessen" farbe={perf.abdeckung >= 0.6 ? LEUCHT.gut : perf.abdeckung >= 0.4 ? LEUCHT.achtung : LEUCHT.kritisch} />
              <Zahl erklaerung={kennzahlTextVon('fokus.wirkung.bestwert')} wert={bester?.index != null ? String(bester.index) : undefined} label={bester ? `Bestwert · ${datum(bester.date)}` : 'Bestwert'} farbe={zoneFarbe(bester?.index)} />
            </div>
            {perf.hebel && <p style={{ fontSize: TYP.body, color: C.inkDim, margin: '16px 0 0' }}>Größter Hebel: <b style={{ color: C.ink, fontWeight: 600 }}>{perf.hebel}</b></p>}
            {perf.index == null && <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '16px 0 0' }}>Noch zu wenig gemessen, um eine Zahl zu nennen.</p>}
            {verlauf.length > 1 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: TYP.mikro, color: C.inkLeise, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Verlauf</div>
                <Balken werte={verlauf.slice(-30).map(m => m.index)} max={100} farbe={zone} hoehe={44} titel={verlauf.slice(-30).map(m => `${datum(m.date)} · ${m.index ?? '—'}`)} />
              </div>
            )}
          </div>
        </div>
      </Karte>
      <Karte i={i + 1}>
        <Ueberschrift rechts="Klick zeigt die Faktoren">Säulen</Ueberschrift>
        <Liste>
          {perf.saeulen.map(s => {
            const f = FARBE_JE[s.key] ?? C.inkLeise;
            const w = s.score == null || s.score === 0 ? undefined : String(s.score);
            const echt = (s.faktoren ?? []).filter(x => x.echt).length;
            const auf = offen === s.key;
            return (
              <div key={s.key}>
                <Zeile onClick={() => setOffen(o => (o === s.key ? null : s.key))} aktiv={auf}
                  links={<Ring groesse="klein" label="" wert={w} farbe={s.zuDuenn ? `${f}99` : f} anteil={w ? Number(w) / 100 : undefined} />}
                  titel={<span>{KURZ[s.key] ?? s.label}</span>}
                  unter={s.faktoren?.length ? `${echt} von ${s.faktoren.length} Faktoren echt gemessen${s.zuDuenn ? ' · noch dünn' : ''}` : undefined}
                  rechts={<Chip farbe={s.zuDuenn || !w ? C.inkLeise : zoneFarbe(s.score)}>{w ?? '—'}</Chip>} />
                {auf && (
                  <div className="fokus-wirkung-faktoren" style={{ padding: '4px 2px 14px' }}>
                    {(s.faktoren ?? []).map(x => (
                      <div key={x.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 200px) 1fr 44px', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                        <span style={{ fontSize: TYP.bedien, color: x.echt ? C.ink : C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.quelle}>{x.href ? <Link href={x.href} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted rgba(255,255,255,.3)' }}>{x.label}</Link> : x.label}</span>
                        <Fortschritt anteil={x.echt ? x.wert / 100 : 0} farbe={f} />
                        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: x.echt ? C.inkDim : C.inkLeise, textAlign: 'right' }}>{x.echt ? x.wert : '—'}</span>
                      </div>
                    ))}
                    {HREF[bereich][s.key] && <Link href={HREF[bereich][s.key]} style={{ fontSize: TYP.bedien, color: C.inkDim }}>Zur Säule ›</Link>}
                  </div>
                )}
              </div>
            );
          })}
          {!perf.saeulen.length && <Leer>Noch keine Säulen berechnet.</Leer>}
        </Liste>
      </Karte>
    </>
  );
}
