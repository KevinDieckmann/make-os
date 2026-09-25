'use client';

// ─── Markttraktion · Überblick ──────────────────────────────────────────────
// Oben der Traction-Score über Sales (50 %), Marketing (40 %) und Event
// (10 %) — Gewichte aus dem KEMARIS-Konzept, Rechnung in lib/crm/traktion.ts.
// Darunter je Welt ihr Head (Status, was zur Freigabe liegt) und ihre
// Kennzahlen, dann die Übergaben zwischen den Welten (was eine Welt der
// anderen hingelegt hat) und was jetzt zu tun ist. Jede Zeile führt dorthin,
// wo sie erledigt wird. Grau = noch nichts gemessen, nie eine erfundene Null.
// Zu zweit (25.09.): ganz oben „Für dich“ (nur das Eigene der angemeldeten
// Person) und „Zuletzt im Team“; die eigenen Welten stehen vorn, an jeder
// Welt steht, wer sie verantwortet.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, leuchtFarbe } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Punkt, Ring, Fortschritt, Raster, Spalten, Spalte, LEUCHT } from '../schlank';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Kpi } from '@/lib/crm/kennzahlen';
import type { Befund } from '@/lib/crm/befunde';
import type { Traktion, Uebergabe, Welt } from '@/lib/crm/traktion';
import type { FuerDich, TeamEreignis } from '@/lib/crm/team';
import { verantwortlich, nameVon } from '@/lib/crm/team';
import { Person } from './team';
import { Scoreboard } from './Scoreboard';
import type { CrmApi } from './daten';
import { datum } from './daten';

/** Farbe je Welt — dieselbe in der Leiste, im Überblick und an den Übergaben. */
export const WELT_FARBE: Record<Welt, string> = { sales: LEUCHT.business, marketing: LEUCHT.puls, event: LEUCHT.beziehung };
const WELT_LABEL: Record<Welt, string> = { sales: 'Sales', marketing: 'Marketing', event: 'Event' };
const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: C.inkLeise } as const;
const STATUS = { ruhig: LEUCHT.gut, beobachten: LEUCHT.achtung, handeln: LEUCHT.kritisch } as const;
/** Wohin ein Befund gehört — für die Farbe am Rand. */
const BEFUND_WELT: Record<Befund['bereich'], Welt | null> = { heute: 'sales', pipeline: 'sales', kunden: 'sales', marketing: 'marketing', events: 'event', kontakte: null, firmen: null, stammdaten: null };
const PRIO = { 1: LEUCHT.kritisch, 2: LEUCHT.achtung, 3: LEUCHT.puls, 4: C.inkDim, 5: C.inkLeise } as const;

interface HeadKurz { id: Welt; name: string; verantwortlich: string; offen: number; status: 'ruhig' | 'beobachten' | 'handeln' | null; zeit: string | null; zusammenfassung: string | null }
interface Daten { heute: string; ich: string; fuerDich: FuerDich[]; teamFeed: TeamEreignis[]; traktion: Traktion; grundlage: Kpi[]; uebergaben: Uebergabe[]; befunde: Befund[]; heads: HeadKurz[]; bestand: Record<string, number> }

function KpiZeile({ k }: { k: Kpi }) {
  return (
    <div title={`${k.quelle} · Ziel ${k.ziel}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <Punkt farbe={AMPEL[k.ampel]} groesse={7} />
      <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.35 }}>{k.label}</span>
      <span style={{ fontSize: TYP.body, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: k.ampel === 'grau' ? C.inkLeise : C.ink, whiteSpace: 'nowrap' }}>{k.anzeige}</span>
    </div>
  );
}

export function Ueberblick({ api, zuBereich }: { api: CrmApi; zuBereich: (b: string, a?: string) => void }) {
  const [d, setD] = useState<Daten | null>(null);
  const [alle, setAlle] = useState(false);
  const laden = useCallback(() => fetch('/api/crm/traktion', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden]);
  useAbgleich(laden, { alle: 60_000 });
  if (!d) return <Karte i={0}><Leer>{api.fehler ?? 'Lädt …'}</Leer></Karte>;
  const t = d.traktion;
  const befunde = alle ? d.befunde : d.befunde.slice(0, 5);
  // Die eigenen Welten zuerst — Kevin sieht Sales vorn, Malin Marketing und Event.
  const welten = [...t.welten].sort((a, b) => Number(verantwortlich(b.id) === d.ich) - Number(verantwortlich(a.id) === d.ich));
  const zeit = (iso: string) => { const tg = iso.slice(0, 10); return tg === d.heute ? iso.slice(11, 16) : datum(tg, d.heute); };

  return (
    <>
      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={0} akzent={d.fuerDich.length ? LEUCHT.gut : undefined}>
            <Ueberschrift rechts={<Person id={d.ich} name />}>Für dich</Ueberschrift>
            {!d.fuerDich.length ? <Leer>Bei dir liegt gerade nichts Fälliges — Zeit für die Power Hour oder einen Beitrag.</Leer> : (
              <Liste>
                {d.fuerDich.map(f => (
                  <Zeile key={f.id} onClick={() => zuBereich(f.ziel.s, f.ziel.a)} links={<Punkt farbe={WELT_FARBE[f.welt]} />}
                    titel={<span style={{ whiteSpace: 'normal' }}>{f.titel}</span>} unter={<span style={{ whiteSpace: 'normal' }}>{WELT_LABEL[f.welt]} · {f.text}</span>}
                    rechts={<Chip farbe={WELT_FARBE[f.welt]}>{f.anzahl}</Chip>} />
                ))}
              </Liste>
            )}
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={1}>
            <Ueberschrift rechts={<span>14 Tage</span>}>Zuletzt im Team</Ueberschrift>
            {!d.teamFeed.length ? <Leer>Noch nichts festgehalten. Was Kevin und Malin notieren, übergeben und bearbeiten, steht hier.</Leer> : (
              <Liste>
                {d.teamFeed.slice(0, 7).map((e, i) => (
                  <Zeile key={i} onClick={() => zuBereich(e.ziel.s, e.ziel.a)} links={<Person id={e.person} />}
                    titel={<span style={{ whiteSpace: 'normal', fontSize: TYP.bedien }}>{e.text}</span>}
                    unter={`${nameVon(e.person)} · ${zeit(e.zeit)}`} />
                ))}
              </Liste>
            )}
          </Karte>
        </Spalte>
      </Spalten>

      <Karte i={2} akzent={t.score !== null ? leuchtFarbe(t.score) : undefined}>
        <Ueberschrift farbe={t.score !== null ? leuchtFarbe(t.score) : C.inkLeise}>Traction-Score</Ueberschrift>
        <div style={{ display: 'flex', gap: 'clamp(18px,3vw,36px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring label={t.vorlaeufig ? 'vorläufig' : 'Traktion'} wert={t.score !== null ? String(t.score) : undefined} anteil={t.score !== null ? t.score / 100 : undefined} farbe={t.score !== null ? leuchtFarbe(t.score) : C.inkLeise} />
          <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 14 }}>
            {welten.map(w => (
              <button key={w.id} onClick={() => zuBereich(w.id)} className="fassbar" style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <Punkt farbe={WELT_FARBE[w.id]} groesse={8} />
                  <b style={{ fontSize: TYP.body, fontWeight: 600 }}>{w.label}</b>
                  <span style={{ fontSize: 12, color: C.inkLeise }}>{w.gewicht} % · {w.saeulen}</span>
                  <span style={{ marginLeft: 'auto', fontSize: TYP.body, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: w.score === null ? C.inkLeise : C.ink }}>{w.score ?? '—'}</span>
                </span>
                <Fortschritt anteil={(w.score ?? 0) / 100} farbe={w.score === null ? 'rgba(255,255,255,.08)' : WELT_FARBE[w.id]} />
                <span style={{ fontSize: 12, color: C.inkLeise }}>{w.gemessen} von {w.von} Kennzahlen gemessen</span>
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: C.inkLeise, margin: '14px 0 0', lineHeight: 1.5 }}>
          {t.hinweis}. Die fünf Säulen des Markttraktion-Konzepts (Sichtbarkeit, Marketing, Vertrieb, Events, Conversions) liegen in den drei Welten. Punkte je Kennzahl aus der Ampel (grün 100, gelb 60, rot 20), gesamt als gewichtetes geometrisches Mittel — ein Ungleichgewicht zwischen den Welten kostet mehr als ein Durchschnitt.
        </p>
      </Karte>

      <Scoreboard api={api} />

      <Raster min={290}>
        {welten.map((w, i) => {
          const h = d.heads.find(x => x.id === w.id);
          const v = verantwortlich(w.id);
          return (
            <Karte key={w.id} i={i + 3}>
              <Ueberschrift farbe={WELT_FARBE[w.id]} rechts={<button onClick={() => zuBereich(w.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>öffnen ›</button>}>{w.label}</Ueberschrift>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 12.5, color: C.inkDim }}>
                <Person id={v} groesse={18} /> verantwortet {nameVon(v)}{v === d.ich ? ' · dein Bereich' : ''}
              </div>
              <div style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 12, background: 'rgba(199,125,255,.06)', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Punkt farbe={LEUCHT.agenten} groesse={7} />
                  <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{w.head}</span>
                  {h?.status && <Chip farbe={STATUS[h.status]}>{h.status}</Chip>}
                  {!!h?.offen && <Chip farbe={LEUCHT.agenten}>{h.offen} zur Freigabe</Chip>}
                </div>
                <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {h?.zusammenfassung ?? 'Noch kein Lauf — der Head liest Kartei und Bestand und legt Vorschläge zur Freigabe vor.'}
                </div>
                {h?.zeit && <div style={{ fontSize: 11.5, color: C.inkLeise }}>{datum(h.zeit, d.heute)}</div>}
              </div>
              {w.kpis.map(k => <KpiZeile key={k.id} k={k} />)}
            </Karte>
          );
        })}
      </Raster>

      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={4}>
            <Ueberschrift rechts={<span>was eine Welt der anderen hinlegt</span>}>Übergaben</Ueberschrift>
            {!d.uebergaben.length ? <Leer>Nichts liegt zwischen den Welten — alles ist übergeben.</Leer> : (
              <Liste>
                {d.uebergaben.map(u => (
                  <Zeile key={u.id} onClick={() => zuBereich(u.ziel.s, u.ziel.a)}
                    links={<span aria-label={`${WELT_LABEL[u.von]} an ${WELT_LABEL[u.an]}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.inkLeise }}><Punkt farbe={WELT_FARBE[u.von]} groesse={7} />→<Punkt farbe={WELT_FARBE[u.an]} groesse={7} /></span>}
                    titel={<span style={{ whiteSpace: 'normal' }}>{u.titel}</span>}
                    unter={<span style={{ whiteSpace: 'normal' }}>{WELT_LABEL[u.von]} → {WELT_LABEL[u.an]} · {u.text}</span>}
                    rechts={<Chip farbe={WELT_FARBE[u.an]}>{u.anzahl}</Chip>} />
                ))}
              </Liste>
            )}
          </Karte>
          <Karte i={6}>
            <Ueberschrift rechts={<button onClick={() => zuBereich('stammdaten')} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>Stammdaten ›</button>}>Grundlage</Ueberschrift>
            {d.grundlage.map(k => <KpiZeile key={k.id} k={k} />)}
            <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>
              {d.bestand.kontakte} Kontakte · {d.bestand.firmen} Firmen · {d.bestand.chancen} Chancen · {d.bestand.mandate} Mandate · {d.bestand.events} Events · {d.bestand.kampagnen} Kampagnen — Pflicht, keine Traktion: zählt nicht in den Score.
            </div>
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={5}>
            <Ueberschrift rechts={d.befunde.length ? <span>{d.befunde.length}</span> : undefined}>Was jetzt zu tun ist</Ueberschrift>
            {!d.befunde.length ? <Leer>Nichts Rotes — alles im Rahmen.</Leer> : (
              <Liste>
                {befunde.map((b, i) => {
                  // Runden aus der Kartei, die in Sales wirken (Qualifizierung), zählen zu Sales.
                  const w = b.ansicht === 'runde-chancen' ? 'sales' : BEFUND_WELT[b.bereich];
                  return <Zeile key={i} onClick={() => zuBereich(b.bereich, b.ansicht)} links={<Punkt farbe={PRIO[b.prio]} />}
                    titel={<span style={{ whiteSpace: 'normal' }}>{b.titel}</span>} unter={<span style={{ whiteSpace: 'normal' }}>{b.grund}</span>}
                    rechts={<span style={{ fontSize: 11.5, color: w ? WELT_FARBE[w] : C.inkLeise, whiteSpace: 'nowrap' }}>{w ? WELT_LABEL[w] : 'Grundlage'} ›</span>} />;
                })}
              </Liste>
            )}
            {d.befunde.length > 5 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>{alle ? 'weniger' : `alle ${d.befunde.length}`}</button>}
          </Karte>
        </Spalte>
      </Spalten>
    </>
  );
}
