'use client';

// ─── Markttraktion · Überblick ──────────────────────────────────────────────
// Oben „Für dich“ und „Zuletzt im Team“, dann der Traktions-Index (26.09.):
// derselbe Kern wie Business- und Privat-Index — Sales 50 % · Marketing 40 % ·
// Event 10 % (KEMARIS-Konzept, geometrisches Mittel), dazu die Grundlage, die
// nicht zählt. Jede Kennzahl mit Ampel, den Punkten dahinter (Personen, Deals,
// Beiträge, Events — je mit Weg dorthin) und Fenster mit Formel, Schwellen,
// Verlauf. In jeder Welt steht ihr Head. Darunter Scoreboard, Übergaben, Befunde.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Punkt, LEUCHT } from '../schlank';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Befund } from '@/lib/crm/befunde';
import type { Traktion, Uebergabe, Welt } from '@/lib/crm/traktion';
import type { FuerDich, TeamEreignis } from '@/lib/crm/team';
import { verantwortlich, nameVon } from '@/lib/crm/team';
import type { IndexErgebnis, SaeulenStand } from '@/lib/kennzahlen/kern';
import type { IndexVerlauf } from '@/lib/kennzahlen/speicher';
import { IndexAnsicht } from '../kennzahlen/IndexAnsicht';
import { WEG } from '@/lib/wege';
import { Person } from './team';
import { Scoreboard } from './Scoreboard';
import type { CrmApi } from './daten';
import { datum } from './daten';

/** Farbe je Welt — dieselbe in der Leiste, im Überblick und an den Übergaben. */
export const WELT_FARBE: Record<Welt, string> = { sales: LEUCHT.business, marketing: LEUCHT.puls, event: LEUCHT.beziehung };
const WELT_LABEL: Record<Welt, string> = { sales: 'Sales', marketing: 'Marketing', event: 'Event' };
const INDEX_FARBE: Record<string, string> = { ...WELT_FARBE, grundlage: C.inkLeise };
const STATUS = { ruhig: LEUCHT.gut, beobachten: LEUCHT.achtung, handeln: LEUCHT.kritisch } as const;
/** Wohin ein Befund gehört — für die Farbe am Rand. */
const BEFUND_WELT: Record<Befund['bereich'], Welt | null> = { heute: 'sales', pipeline: 'sales', kunden: 'sales', marketing: 'marketing', events: 'event', kontakte: null, firmen: null, stammdaten: null };
const PRIO = { 1: LEUCHT.kritisch, 2: LEUCHT.achtung, 3: LEUCHT.puls, 4: C.inkDim, 5: C.inkLeise } as const;

interface HeadKurz { id: Welt; name: string; verantwortlich: string; offen: number; status: 'ruhig' | 'beobachten' | 'handeln' | null; zeit: string | null; zusammenfassung: string | null }
interface Daten { heute: string; ich: string; fuerDich: FuerDich[]; teamFeed: TeamEreignis[]; traktion: Traktion; index: IndexErgebnis; indexVerlauf: IndexVerlauf; uebergaben: Uebergabe[]; befunde: Befund[]; heads: HeadKurz[]; bestand: Record<string, number> }

const leise = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 } as const;

export function Ueberblick({ api, zuBereich }: { api: CrmApi; zuBereich: (b: string, a?: string, k?: string) => void }) {
  const [d, setD] = useState<Daten | null>(null);
  const [alle, setAlle] = useState(false);
  const laden = useCallback(() => fetch('/api/crm/traktion', { cache: 'no-store' }).then(r => r.json()).then(x => x.ok && setD(x)).catch(() => {}), []);
  useEffect(() => { void laden(); }, [laden]);
  useAbgleich(laden, { alle: 60_000 });
  if (!d) return <Karte i={0}><Leer>{api.fehler ?? 'Lädt …'}</Leer></Karte>;
  const befunde = alle ? d.befunde : d.befunde.slice(0, 5);
  const zeit = (iso: string) => { const tg = iso.slice(0, 10); return tg === d.heute ? iso.slice(11, 16) : datum(tg, d.heute); };
  const zahl = (n: number, wort: string, href: string) => <Link href={href} style={{ color: C.inkDim, textDecoration: 'none', borderBottom: '1px dotted rgba(255,255,255,.25)' }}>{n} {wort}</Link>;

  /** Oben in jeder Welt-Karte: wer sie verantwortet und was ihr Head zuletzt gesagt hat; in der Grundlage der Bestand. */
  const saeuleKopf = (s: SaeulenStand) => {
    if (s.id === 'grundlage') {
      const b = d.bestand;
      return (
        <div style={{ fontSize: 12.5, color: C.inkDim, marginBottom: 12, display: 'flex', gap: '4px 10px', flexWrap: 'wrap' }}>
          {zahl(b.kontakte, 'Kontakte', WEG.kontakt())} · {zahl(b.firmen, 'Firmen', WEG.firma())} · {zahl(b.chancen, 'Deals', WEG.deals())} · {zahl(b.mandate, 'Mandate', WEG.mandat())} · {zahl(b.events, 'Events', WEG.event())} · {zahl(b.kampagnen, 'Kampagnen', WEG.kampagne())}
          <button onClick={() => zuBereich('stammdaten')} style={leise}>Stammdaten ›</button>
        </div>
      );
    }
    const w = s.id as Welt;
    const h = d.heads.find(x => x.id === w);
    const v = verantwortlich(w);
    return (
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: C.inkDim, flexWrap: 'wrap' }}>
          <Person id={v} groesse={18} /> verantwortet {nameVon(v)}{v === d.ich ? ' · dein Bereich' : ''}
          <button onClick={() => zuBereich(w)} style={{ ...leise, marginLeft: 'auto' }}>{WELT_LABEL[w]} öffnen ›</button>
        </div>
        <div style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 12, background: 'rgba(199,125,255,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Punkt farbe={LEUCHT.agenten} groesse={7} />
            <span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{h?.name ?? 'Head'}</span>
            {h?.status && <Chip farbe={STATUS[h.status]}>{h.status}</Chip>}
            {!!h?.offen && <Link href="/os/stapel" style={{ textDecoration: 'none' }}><Chip farbe={LEUCHT.agenten}>{h.offen} zur Freigabe</Chip></Link>}
          </div>
          <div style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {h?.zusammenfassung ?? 'Noch kein Lauf — der Head liest Kartei und Bestand und legt Vorschläge zur Freigabe vor.'}
          </div>
          {h?.zeit && <div style={{ fontSize: 11.5, color: C.inkLeise }}>{datum(h.zeit, d.heute)}</div>}
        </div>
      </div>
    );
  };

  return (
    <>
      <Flaeche seite="markttraktion-ueberblick">
          <Kachel id="fuer-dich" titel="Für dich" breite={3}>
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
          </Kachel>
          <Kachel id="team" titel="Zuletzt im Team" breite={3}>
          <Karte i={1}>
            <Ueberschrift rechts={<span>14 Tage</span>}>Zuletzt im Team</Ueberschrift>
            {!d.teamFeed.length ? <Leer>Noch nichts festgehalten. Was Kevin und Malin notieren, übergeben und bearbeiten, steht hier.</Leer> : (
              <Liste>
                {d.teamFeed.slice(0, 7).map((e, i) => (
                  <Zeile key={i} onClick={() => zuBereich(e.ziel.s, e.ziel.a, e.ziel.k)} links={<Person id={e.person} />}
                    titel={<span style={{ whiteSpace: 'normal', fontSize: TYP.bedien }}>{e.text}</span>}
                    unter={`${nameVon(e.person)} · ${zeit(e.zeit)}`} />
                ))}
              </Liste>
            )}
          </Karte>
          </Kachel>

      <Kachel id="traktion" titel="Traktions-Score" breite={6}>
      <IndexAnsicht d={{ pi: d.index, ...d.indexVerlauf }} name="Traktion" chip="Traktions-Index" farben={INDEX_FARBE} scope="markttraktion" i0={2}
        chips={d.traktion.vorlaeufig ? <Chip farbe={LEUCHT.achtung}>vorläufig</Chip> : undefined}
        schwelleSenden={schwelle => fetch('/api/crm/traktion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schwelle }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }))}
        onGespeichert={() => void laden()} saeuleKopf={saeuleKopf} zwischen={<Scoreboard api={api} />}
        hinweis={<>{d.traktion.hinweis}. Die fünf Säulen des Markttraktion-Konzepts (Sichtbarkeit, Marketing, Vertrieb, Events, Conversions) liegen in den drei Welten. Punkte je Kennzahl: an der roten Schwelle 20, an der grünen 100, dazwischen linear; gesamt als gewichtetes geometrisches Mittel — ein Ungleichgewicht zwischen den Welten kostet mehr als ein Durchschnitt. Dieselbe Zahl steht als „Traktions-Score“ im Business-Index.</>} />
      </Kachel>

          <Kachel id="uebergaben" titel="Übergaben" breite={3}>
          <Karte i={8}>
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
          </Kachel>
          <Kachel id="befunde" titel="Was jetzt zu tun ist" breite={3}>
          <Karte i={9}>
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
            {d.befunde.length > 5 && <button onClick={() => setAlle(!alle)} style={{ marginTop: 6, ...leise }}>{alle ? 'weniger' : `alle ${d.befunde.length}`}</button>}
          </Karte>
          </Kachel>
      </Flaeche>
    </>
  );
}
