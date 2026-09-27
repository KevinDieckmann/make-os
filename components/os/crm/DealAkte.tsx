'use client';

// ─── Deal-Akte und Deal-Auswertung (27.09.) ─────────────────────────────────
// Die Akte: ein Deal auf einer ganzen Seite — Kopf mit Firma, Personen (mit
// Rolle), Wert, Ampel; die Stufen als Treppe mit Austrittskriterium; alle Felder
// (ChancenDetail aus der Pipeline); Verlauf mit Verweildauer je Stufe; die
// Aktivitäten der beteiligten Personen; die offenen Follow-ups zum Deal.
// Die Auswertung: Prognose nach Monat, Verweildauer, Umwandlung, Win/Loss, Zyklus.

import Link from 'next/link';
import { useMemo } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, Fortschritt, LEUCHT } from '../schlank';
import { type CrmApi, datum, euro, kurzEuro } from './daten';
import { Verlauf as AktivitaetenVerlauf } from './teile';
import { Wahl } from './Wahl';
import { dealRolleVorschlag, besterEntscheider } from '@/lib/crm/vorschlaege';
import { Person } from './team';
import { ChancenDetail } from './Pipeline';
import { useFollowups } from './FollowUp';
import { gesamtwert } from '@/lib/crm/pipeline';
import { verweildauer, verweildauerJeStufe, umwandlung, winLoss, zyklus, prognoseNachMonat, haengtNachWert, MINDESTMENGE } from '@/lib/crm/deal-auswertung';
import { firmaVonDeal } from '@/lib/crm/firmen-bezug';
import { mitglied } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import type { DealRolle } from '@/lib/crm/typen';

const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
/** Rollen am Deal — „Bremst“ steht im Menü, wird aber nie vorgeschlagen (lib/crm/vorschlaege.ts). */
const ROLLEN: { id: DealRolle; label: string }[] = [{ id: 'entscheider', label: 'Entscheider' }, { id: 'fuersprecher', label: 'Fürsprecher' }, { id: 'nutzer', label: 'Nutzer' }, { id: 'blocker', label: 'Bremst' }];

export function DealAkte({ api, id, zuKontakt, zurueck }: { api: CrmApi; id: string; zuKontakt: (id: string) => void; zurueck: () => void }) {
  const crm = api.crm;
  const { d: fu } = useFollowups();
  const c = crm?.stand.chancen.find(x => x.id === id);
  const personen = useMemo(() => (c ? c.kontaktIds.map(pid => (api.kontakte ?? []).find(k => k.id === pid)).filter((k): k is NonNullable<typeof k> => !!k) : []), [c, api.kontakte]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  if (!c) return <Karte i={0}><Leer>Diesen Deal gibt es nicht (mehr). <button onClick={zurueck} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer' }}>Zurück zu den Deals</button></Leer></Karte>;
  const a = crm.ampel[c.id];
  const firma = firmaVonDeal(c, crm.stand.firmen);
  const stufen = crm.stufen;
  const offeneStufen = stufen.filter(s => s.offen);
  // Bei verloren/geparkt gilt die letzte OFFENE Stufe aus der Historie als erreicht — nicht der Index im Gesamt-Array.
  const letzteOffene = [...c.historie].reverse().find(h => offeneStufen.some(s => s.id === h.stufe))?.stufe;
  const aktuell = offeneStufen.findIndex(s => s.id === (offeneStufen.some(s => s.id === c.stufe) ? c.stufe : letzteOffene));
  const verlauf = verweildauer(c, crm.heute);
  const historieSortiert = [...c.historie].sort((a, b) => a.am.localeCompare(b.am));
  // Follow-ups zum Deal selbst — und Zusagen an die beteiligten Personen, aber keine Kadenz-Erinnerungen zu anderen Themen.
  const folgen = (fu?.liste ?? []).filter(f => (f.bezug.art === 'chance' && f.bezug.id === c.id) || (f.kontaktId && c.kontaktIds.includes(f.kontaktId) && f.quelle !== 'kadenz' && f.bezug.art !== 'event' && f.bezug.art !== 'mandat'));
  const aktivitaeten = personen.flatMap(k => (k.aktivitaeten ?? []).map(x => ({ ...x, wer: anzeigename(k) }))).sort((x, y) => y.am.localeCompare(x.am)).slice(0, 40);
  // Bester Kandidat für „Entscheider“ — der Hinweis springt dorthin und legt den Fokus auf „übernehmen“.
  const bester = besterEntscheider(personen, c, crm.heute);
  const zumVorschlag = (pid: string) => {
    const el = document.getElementById(`deal-rolle-${pid}`);
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    (el?.querySelector('[data-wahl-uebernehmen]') as HTMLElement | null)?.focus({ preventScroll: true });
  };
  const setzeRolle = (pid: string, rolle: DealRolle | null) => {
    const alt = { ...(c.personenRollen ?? {}) };
    if (rolle) alt[pid] = rolle; else delete alt[pid];
    void api.teil('chancen', c.id, { personenRollen: alt });
  };
  return (
    <>
      <Karte i={0} akzent={a ? AMPEL[a.ampel] : undefined}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <button onClick={zurueck} className="fassbar" style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 10, padding: '7px 12px', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien }}>‹ Deals</button>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{c.titel}</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 12.5, color: C.inkDim }}>
              {firma ? <Link href={WEG.firma(firma.id)} style={{ color: C.ink, textDecoration: 'none' }}>🏢 {firma.name}</Link> : c.firma ? <span>🏢 {c.firma} <span style={{ color: LEUCHT.achtung }}>(keine Firma verknüpft)</span></span> : null}
              <span>· {stufen.find(s => s.id === c.stufe)?.label}</span>
              <span>· führt <Person id={c.besitzer} name groesse={16} /></span>
              {a && <span style={{ color: AMPEL[a.ampel] }}>· {a.ampel === 'gruen' ? 'in Bewegung' : a.gruende[0]}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.wert.betrag ? euro(gesamtwert(c)) : '—'}</div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>{c.wert.betrag ? `${euro(c.wert.betrag)} ${c.wert.basis === 'monat' ? 'je Monat' : c.wert.basis === 'jahr' ? 'je Jahr' : 'einmalig'}${c.wert.laufzeitMonate ? ` · ${c.wert.laufzeitMonate} Monate` : ''}` : 'ohne Wert'}</div>
          </div>
        </div>
        {/* Stufen-Treppe: wo der Deal steht und was für den nächsten Schritt auf Kundenseite passieren muss */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stufen.filter(s => s.offen).length}, minmax(0, 1fr))`, gap: 4, marginTop: 16 }}>
          {stufen.filter(s => s.offen).map((s, i) => {
            const erreicht = aktuell >= i || c.stufe === 'gewonnen';
            // (bei verloren/geparkt: erreicht bis zur letzten offenen Stufe, nicht darüber)
            const ist = c.stufe === s.id;
            return (
              <div key={s.id} title={`Weiter, wenn: ${s.weiterWenn}`} style={{ padding: '8px 6px', borderRadius: 8, background: ist ? `${LEUCHT.business}22` : 'rgba(255,255,255,.03)', borderBottom: `2px solid ${erreicht ? LEUCHT.business : 'rgba(255,255,255,.08)'}` }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: ist ? C.ink : erreicht ? C.inkDim : C.inkLeise }}>{s.label} <span style={{ fontWeight: 400 }}>· {s.p} %</span></div>
                {ist && <div style={{ fontSize: 12, color: C.inkDim, marginTop: 4 }}>Weiter, wenn: {s.weiterWenn}</div>}
              </div>
            );
          })}
        </div>
        {(c.stufe === 'gewonnen' || c.stufe === 'verloren' || c.stufe === 'geparkt') && <div style={{ marginTop: 10, fontSize: 12.5, color: c.stufe === 'gewonnen' ? LEUCHT.gut : c.stufe === 'verloren' ? LEUCHT.kritisch : C.inkDim }}>{stufen.find(s => s.id === c.stufe)?.label}{c.grund ? ` · ${c.grund}` : ''}{c.wiedervorlage ? ` · Wiedervorlage ${datum(c.wiedervorlage, crm.heute)}` : ''}</div>}
      </Karte>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 14, alignItems: 'start' }} className="deal-akte-spalten">
        <div style={{ display: 'grid', gap: 14 }}>
          <Karte i={1}>
            <Ueberschrift>Der Deal</Ueberschrift>
            <ChancenDetail c={c} api={api} personen={personen} zuKontakt={zuKontakt} />
          </Karte>
          <Karte i={3}>
            <Ueberschrift rechts={`${aktivitaeten.length}`}>Aktivitäten der Beteiligten</Ueberschrift>
            {aktivitaeten.length ? <AktivitaetenVerlauf liste={aktivitaeten} name={p => mitglied(p)?.name ?? p} heute={crm.heute} max={40} /> : <Leer>Noch keine Aktivität festgehalten — über „+ Gespräch“ oben oder ein Follow-up.</Leer>}
          </Karte>
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          <Karte i={2}>
            <Ueberschrift>Personen & Rollen</Ueberschrift>
            {personen.length ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {personen.map(k => (
                  <div key={k.id} style={{ display: 'grid', gap: 5 }}>
                    <button onClick={() => zuKontakt(k.id)} style={{ textAlign: 'left', background: 'none', border: 'none', padding: 0, color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600 }}>{anzeigename(k)}{k.position || k.jobtitel ? <span style={{ color: C.inkLeise, fontWeight: 400 }}> · {k.position ?? k.jobtitel}</span> : null}</button>
                    <Wahl id={`deal-rolle-${k.id}`} label="Rolle" liste={ROLLEN} wert={c.personenRollen?.[k.id]} farbe={LEUCHT.business}
                      vorschlag={dealRolleVorschlag(k, crm.heute)} onWahl={r => setzeRolle(k.id, r)} onLeeren={() => setzeRolle(k.id, null)} />
                  </div>
                ))}
                {!Object.values(c.personenRollen ?? {}).includes('entscheider') && (
                  <div style={{ fontSize: 12, color: LEUCHT.achtung, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span>Noch kein Entscheider markiert — ohne den wird aus dem Deal nichts.</span>
                    {bester && <button type="button" onClick={() => zumVorschlag(bester.kontakt.id)} title={bester.vorschlag.grund}
                      style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Vorschlag: {anzeigename(bester.kontakt)} ›</button>}
                  </div>
                )}
              </div>
            ) : <Leer>Noch keine Person am Deal — unten bei „Personen“ hinzufügen.</Leer>}
          </Karte>
          <Karte i={4}>
            <Ueberschrift rechts={<Link href={WEG.followup()} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12.5 }}>Follow-up ›</Link>}>Offene Follow-ups</Ueberschrift>
            {folgen.length ? <Liste>{folgen.map(f => <Zeile key={f.id} links={<Punkt farbe={f.gruppe === 'ueberfaellig' ? LEUCHT.kritisch : f.gruppe === 'heute' ? LEUCHT.achtung : LEUCHT.business} />} titel={f.text} unter={`${f.name} · ${datum(f.faellig, crm.heute)}`} rechts={<Person id={f.zustaendig} groesse={16} />} />)}</Liste> : <Leer>Kein offenes Follow-up. Der nächste Schritt oben zählt als Zusage.</Leer>}
          </Karte>
          <Karte i={5}>
            <Ueberschrift>Verlauf</Ueberschrift>
            <div style={{ display: 'grid', gap: 6 }}>
              {verlauf.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
                  <span style={{ color: i === verlauf.length - 1 ? C.ink : C.inkDim }}>{stufen.find(s => s.id === v.stufe)?.label ?? v.stufe} <span style={{ color: C.inkLeise }}>ab {datum(v.von)}{historieSortiert[i]?.von && mitglied(historieSortiert[i].von) ? ` · ${mitglied(historieSortiert[i].von)!.name}` : ''}</span></span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: v.tage > 30 && !v.bis ? LEUCHT.kritisch : C.inkDim }}>{v.tage} T</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: C.inkLeise }}>angelegt {datum(c.angelegt)} · {verlauf.reduce((a, v) => a + v.tage, 0)} Tage gesamt</div>
            </div>
          </Karte>
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .deal-akte-spalten { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </>
  );
}

export function DealAuswertung({ api, zuAkte }: { api: CrmApi; zuAkte: (id: string) => void }) {
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const chancen = crm.stand.chancen;
  const p = prognoseNachMonat(chancen, crm.heute, crm.stand.wahrscheinlichkeiten);
  const maxM = Math.max(1, ...p.map(x => x.wert));
  const vd = verweildauerJeStufe(chancen, crm.heute);
  const um = umwandlung(chancen);
  const wl = winLoss(chancen, crm.heute);
  const zy = zyklus(chancen);
  const hw = haengtNachWert(chancen, crm.ampel);
  const haengende = chancen.filter(c => crm.ampel[c.id]?.ampel === 'rot');
  return (
    <>
      <Karte i={0}>
        <Ueberschrift>Prognose nach Monat der Entscheidung</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>
          {p.map(m => (
            <div key={m.monat} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
              <span style={{ color: m.monat === 'offen' ? C.inkLeise : C.inkDim }}>{m.label}</span>
              <Fortschritt anteil={m.wert / maxM} farbe={m.monat === 'offen' ? C.inkLeise : LEUCHT.business} />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: C.ink, whiteSpace: 'nowrap' }}>{m.anzahl ? `${m.anzahl} · ${kurzEuro(m.wert)} · gew. ${kurzEuro(m.gewichtet)}` : '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>„Entscheidung bis“ am Deal legt den Monat fest. Deals ohne Datum stehen hinten — das ist der Hinweis, das Datum zu klären.</div>
      </Karte>
      <Karte i={1}>
        <Ueberschrift>Gewonnen · Verloren · Zyklus</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={wl.quote !== null ? `${wl.quote} %` : `${wl.gewonnen} · ${wl.verloren}`} label={wl.quote !== null ? 'Win Rate · 180 Tage' : `gewonnen · verloren (Quote ab ${MINDESTMENGE})`} farbe={wl.quote !== null ? (wl.quote >= 40 ? LEUCHT.gut : wl.quote >= 20 ? LEUCHT.achtung : LEUCHT.kritisch) : undefined} />
          <Zahl wert={kurzEuro(wl.wertGewonnen)} label="gewonnen · Wert" farbe={wl.wertGewonnen ? LEUCHT.gut : undefined} />
          <Zahl wert={kurzEuro(wl.wertVerloren)} label="verloren · Wert" farbe={wl.wertVerloren ? LEUCHT.kritisch : undefined} />
          <Zahl wert={zy.median !== null ? `${zy.median} T` : `${zy.n} gew.`} label={zy.median !== null ? 'Zyklus · Median' : `Zyklus ab ${MINDESTMENGE} gewonnenen`} />
          <Zahl wert={zy.dealGroesse !== null ? kurzEuro(zy.dealGroesse) : '—'} label="Ø Deal-Größe (gewonnen)" />
          <Zahl wert={hw.anteil !== null ? `${hw.anteil} %` : '—'} label="hängt · nach Wert" farbe={hw.anteil ? (hw.anteil > 40 ? LEUCHT.kritisch : hw.anteil > 15 ? LEUCHT.achtung : LEUCHT.gut) : undefined} />
        </Raster>
        {wl.gruende.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Verlustgründe · 180 Tage</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{wl.gruende.map(g => <Chip key={g.grund} farbe={LEUCHT.kritisch}>{g.grund} · {g.anzahl} · {kurzEuro(g.wert)}</Chip>)}</div>
          </div>
        )}
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Verweildauer und Umwandlung je Stufe</Ueberschrift>
        <div style={{ display: 'grid', gap: 8 }}>
          {vd.map(s => {
            const u = um.find(x => x.von === s.stufe);
            return (
              <div key={s.stufe} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
                <span style={{ color: C.inkDim }}>{s.label}</span>
                <span style={{ color: s.schnitt !== null && s.schnitt > 30 ? LEUCHT.achtung : C.ink }}>{s.schnitt !== null ? `Ø ${s.schnitt} T · längste ${s.laengste} T · ${s.n}×` : 'noch nicht durchlaufen'}</span>
                <span style={{ color: C.inkDim }}>{u ? (u.quote !== null ? `${u.quote} % weiter` : `${u.weiter} von ${u.erreicht} weiter (Quote ab ${MINDESTMENGE})`) : 'Abschluss'}</span>
              </div>
            );
          })}
        </div>
      </Karte>
      {haengende.length > 0 && (
        <Karte i={3} akzent={LEUCHT.kritisch}>
          <Ueberschrift farbe={LEUCHT.kritisch} rechts={`${haengende.length}`}>Hängt</Ueberschrift>
          <Liste>{haengende.map(c => <Zeile key={c.id} onClick={() => zuAkte(c.id)} links={<Punkt farbe={LEUCHT.kritisch} />} titel={c.titel} unter={crm.ampel[c.id]?.gruende.join(' · ')} rechts={<span style={{ fontSize: 12.5, color: C.inkDim }}>{kurzEuro(gesamtwert(c))}</span>} />)}</Liste>
        </Karte>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.inkLeise }}><span>Alle Zahlen rechnen aus den eigenen Deals; Quoten erst ab {MINDESTMENGE} Fällen.</span><Knopf leise onClick={() => zuAkte('')}>Zurück zum Board</Knopf></div>
    </>
  );
}
