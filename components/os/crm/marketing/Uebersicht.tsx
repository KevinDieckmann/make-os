'use client';

// ─── Markttraktion · Marketing › Übersicht ───────────────────────────────────────────
// Oben die Wirkung (Kennzahlen aus lib/crm/marketing.ts, grau solange nichts
// gemessen ist). Darunter, was Marketing hier steuert: Wie viele Menschen
// dürfen wir überhaupt ansprechen (Einwilligungsbestand je Kanal), wo läuft
// eine Frist (Art. 14), woher kommen Chancen wirklich (Quelle und
// Selbstauskunft) und welche Themen nennen Kunden in Gesprächen (die „Stimme
// der Kunden“ aus den Notizen — Rohstoff für Beiträge). Keine Likes, keine
// Öffnungsraten.
//
// Zu zweit (25.09.): „Wartet auf Freigabe“ zeigt, was bei wem liegt (Beiträge
// und Newsletter, am längsten Wartendes zuerst), „Beiträge je Person“ zählt
// Veröffentlichungen und Gespräche/Anfragen aus deren Wirkung — jede Zahl mit
// Beleg, grau statt erfundener Null (lib/crm/marketing.ts).
//
// Marketing-Strecke (27.09., Kevin: „das ganze Thema Marketing haben wir noch
// gar nicht angepasst“): oben der Trichter Reichweite → Resonanz → Anfragen →
// Übergabe an Sales mit Umwandlung je Stufe, darunter die Kosten (Beiträge +
// Kampagnen) als Kosten je Anfrage und je SQL — Quoten erst ab fünf Fällen
// (marketingTrichter). Leerzustände führen zur Handlung: ersten Beitrag planen,
// Anfrage erfassen, Positionierung schreiben.
//
// Fläche (27.09.): die Übersicht ist eine gestaltbare Fläche (lib/crm/flaechen.ts
// KACHELN.marketing) — jede Karte eine Kachel, dazu die Kurzkarten „Anfragen“
// und „Segmente“; je Person anordnen, ausblenden, Katalog-Widgets dazulegen.

import { localDay } from '@/lib/zeit';
import { useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Zahl, Raster, Fortschritt, Liste, Zeile, Punkt, Knopf, Chip, LEUCHT } from '../../ui';
import { anzeigename } from '@/lib/make-one/crm';
import { kanalStatus, art14 } from '@/lib/crm/recht';
import { TEAM, BEIDE, nameVon } from '@/lib/crm/team';
import { marketingKennzahlen, marketingTrichter, freigabeLage, liegtBei, beitraegeJePerson, genitiv, einstellungAus, MINDESTMENGE, type FreigabePosten, type TrichterStufe } from '@/lib/crm/marketing';
import { type CrmApi, datum, euro } from '../daten';
import { Person } from '../team';
import { KpiLeiste, AlsNaechstes, STAND_FARBE } from './gemeinsam';
import { Pillen } from '../teile';
import Link from 'next/link';
import { netzRunde } from '@/lib/crm/netzwerk';
import { markttraktion } from '@/lib/crm/adresse';
import { anfragenListe, kanalInfo } from '@/lib/crm/anfragen';
import { kontextAus, segmentAuswerten } from '@/lib/crm/segmente';
import { Flaeche, Kachel } from '../../flaeche/Flaeche';
import { FLAECHE, kachel, standardVon } from '@/lib/crm/flaechen';
import { ausgenommen } from '@/lib/crm/einschraenkung';

const K = (id: string) => kachel('marketing', id);

/** Wohin ein Klick auf einen Posten führt — Redaktionsplan oder Newsletter mit geöffnetem Eintrag. */
export type ZuEintrag = (ansicht: 'redaktion' | 'newsletter', id: string) => void;
/** Reiter im Marketing, zu denen die Übersicht springt (Leerzustände mit Handlung). */
export type ZuAnsicht = (ansicht: 'anfragen' | 'redaktion' | 'positionierung' | 'kampagnen' | 'segmente' | 'newsletter') => void;
const STUFEN_FARBE: Record<TrichterStufe['id'], string> = { reichweite: LEUCHT.puls, resonanz: LEUCHT.achtung, anfragen: LEUCHT.business, uebergabe: LEUCHT.gut };

function postenText(p: FreigabePosten, heute: string): string {
  const art = p.art === 'beitrag' ? 'Beitrag' : 'Newsletter';
  const seit = p.seit ? datum(p.seit.slice(0, 10), heute) : '';
  if (p.stand === 'offen') return `${art} · angefragt${p.von ? ` von ${nameVon(p.von)}` : ''}${seit ? ` · ${seit}` : ''}${p.datum ? ` · geplant ${datum(p.datum, heute)}` : ''}`;
  if (p.stand === 'aenderung') return `${art} · ${nameVon(p.an)} wünscht eine Änderung${p.notiz ? `: „${p.notiz.length > 90 ? `${p.notiz.slice(0, 89)}…` : p.notiz}“` : ''}`;
  return `${art} · geplant${p.datum ? ` ${datum(p.datum, heute)}` : ''} ohne ${genitiv(nameVon(p.an))} Okay`;
}

export function Uebersicht({ api, zuKontakt, zu, zuAnsicht }: { api: CrmApi; zuKontakt: (id: string) => void; zu?: ZuEintrag; zuAnsicht?: ZuAnsicht }) {
  const [tage, setTage] = useState<30 | 90>(90);
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const crm = api.crm;
  const ich = api.ich;
  const heute = crm?.heute ?? localDay();
  const kpis = useMemo(() => (crm ? marketingKennzahlen(kontakte, crm.stand, heute) : []), [kontakte, crm, heute]);
  const trichter = useMemo(() => (crm ? marketingTrichter(kontakte, crm.stand, heute, tage) : null), [kontakte, crm, heute, tage]);
  const positionierungFehlt = !einstellungAus(crm?.stand ?? {}).positionierung.trim();
  const lage = useMemo(() => (crm ? freigabeLage(crm.stand) : []), [crm]);
  const jePerson = useMemo(() => (crm ? beitraegeJePerson(crm.stand.beitraege ?? [], heute) : []), [crm, heute]);
  const beiWem = useMemo(() => [...TEAM.map(t => t.id), BEIDE].map(p => ({ person: p, posten: lage.filter(x => x.bei === p) })).filter(g => g.posten.length), [lage]);
  const beiMir = lage.filter(x => liegtBei(x, ich));
  const z = useMemo(() => {
    const aktive = kontakte.filter(k => !ausgenommen(k));
    const kreisAC = aktive.filter(k => k.kreis && k.kreis !== 'D');
    const mailOk = (k: typeof kontakte[number]) => kanalStatus(k, 'mail').farbe === 'gruen';
    const quellen = new Map<string, number>();
    for (const c of crm?.stand.chancen ?? []) quellen.set(c.quelle ?? 'unbekannt', (quellen.get(c.quelle ?? 'unbekannt') ?? 0) + 1);
    const stimmen = aktive.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.notiz?.bedarf).map(a => ({ id: k.id, name: anzeigename(k), am: a.am, bedarf: a.notiz!.bedarf! }))).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 12);
    const alteEinwilligung = kontakte.filter(k => (k.einwilligungen ?? []).some(e => !e.widerrufenAm && e.grundlage === 'einwilligung' && (Date.parse(heute) - Date.parse(e.erteiltAm)) / 864e5 > 730));
    return {
      gesamt: kontakte.length, gesperrt: kontakte.length - aktive.length,
      mail: aktive.filter(mailOk).length, newsletter: aktive.filter(k => kanalStatus(k, 'newsletter').farbe === 'gruen').length,
      kreisAC: kreisAC.length, kreisACmail: kreisAC.filter(mailOk).length,
      art14: kontakte.filter(k => art14(k, heute)?.faellig), art14offen: kontakte.filter(k => art14(k, heute) && !art14(k, heute)!.faellig).length,
      quellen: Array.from(quellen.entries()).sort((a, b) => b[1] - a[1]),
      selbstauskunft: (crm?.stand.chancen ?? []).filter(c => c.selbstauskunft).map(c => ({ titel: c.titel, text: c.selbstauskunft! })),
      stimmen, alteEinwilligung,
    };
  }, [kontakte, crm, heute]);
  // LinkedIn-Netzwerk je Profil (25.09.): was heute in der Vernetzen-Runde ansteht.
  const netz = useMemo(() => TEAM.map(t => ({ id: t.id, z: netzRunde(kontakte, t.id, heute).zahlen })), [kontakte, heute]);
  const QLABEL: Record<string, string> = { empfehlung: 'Empfehlung', event: 'Event', content: 'Content', kampagne: 'Kampagne', outreach: 'Ansprache', bestand: 'Bestand', inbound: 'Anfrage', unbekannt: 'nicht erfasst' };
  const chancenGesamt = z.quellen.reduce((a, [, n]) => a + n, 0);

  const k = trichter?.kosten;
  const leerHandlungen = trichter && !trichter.reichweite.messbar && !trichter.anfragen.messbar;
  // Kurzkarten der Fläche (27.09.): der Eingang und die Zielgruppen — offene Anfragen zuerst, Segmente mit Live-Zahl.
  const anfragen = useMemo(() => (crm ? anfragenListe(kontakte, crm.stand, heute) : []).sort((a, b) => Number(b.offen) - Number(a.offen) || b.am.localeCompare(a.am)), [kontakte, crm, heute]);
  const offeneAnfragen = anfragen.filter(a => a.offen).length;
  const ctx = useMemo(() => (crm ? kontextAus(crm.stand, heute) : null), [crm, heute]);
  const segmente = useMemo(() => (crm && ctx ? (crm.stand.segmente ?? []).map(sg => ({ id: sg.id, name: sg.name, anzahl: segmentAuswerten(kontakte, sg.kriterien, ctx).anzahl })) : []), [crm, ctx, kontakte]);
  const leiseKnopf = { background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 } as const;

  return (
    <Flaeche seite={FLAECHE.marketing} standard={standardVon('marketing')}>
      <Kachel {...K('strecke')}>
      <Karte i={0} ton={LEUCHT.puls}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={<Pillen liste={[{ id: '30', label: '30 Tage' }, { id: '90', label: '90 Tage' }]} aktiv={String(tage)} onWahl={t => setTage(t === '30' ? 30 : 90)} />}>Marketing-Strecke</Ueberschrift>
        {trichter ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8, alignItems: 'stretch' }}>
              {trichter.stufen.map((s, i) => (
                <div key={s.id} style={{ display: 'grid', gap: 6, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,.03)', borderLeft: `3px solid ${s.wert === null ? C.inkLeise : STUFEN_FARBE[s.id]}`, alignContent: 'start' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>{i + 1} · {s.label}</div>
                  <Zahl wert={s.wert === null ? undefined : String(s.wert)} label={s.unter} farbe={STUFEN_FARBE[s.id]} />
                  {s.umwandlung && <div style={{ fontSize: TYP.bedien, color: s.umwandlung.wert === null ? C.inkLeise : C.inkDim, lineHeight: 1.4 }}>↓ {s.umwandlung.text}</div>}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <Raster min={150}>
                <Zahl wert={k?.messbar ? euro(k.gesamt) : undefined} label={k?.messbar ? `Kosten · ${euro(k.beitraege)} Beiträge, ${euro(k.kampagnen)} Kampagnen` : 'Kosten — noch keine eingetragen'} />
                <Zahl wert={k?.jeAnfrage !== null && k?.jeAnfrage !== undefined ? euro(k.jeAnfrage) : undefined} label={k?.jeAnfrage !== null && k?.jeAnfrage !== undefined ? `je Anfrage · ${trichter.anfragen.gesamt} Anfragen` : `je Anfrage — ab ${MINDESTMENGE} Anfragen${k?.messbar ? '' : ' und Kosten'}`} farbe={LEUCHT.business} />
                <Zahl wert={k?.jeSql !== null && k?.jeSql !== undefined ? euro(k.jeSql) : undefined} label={k?.jeSql !== null && k?.jeSql !== undefined ? `je SQL aus Marketing · ${trichter.uebergabe.sql} SQL` : `je SQL — ab ${MINDESTMENGE} SQL${k?.messbar ? '' : ' und Kosten'}`} farbe={LEUCHT.gut} />
                <Zahl wert={trichter.anfragen.messbar ? String(trichter.anfragen.offen) : undefined} label="Anfragen offen" farbe={trichter.anfragen.offen ? LEUCHT.achtung : undefined} />
              </Raster>
            </div>
            {leerHandlungen ? (
              <div style={{ marginTop: 12 }}>
                <AlsNaechstes>
                  <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Die Strecke ist leer — so beginnt sie:</span>
                    {positionierungFehlt && zuAnsicht && <Knopf leise onClick={() => zuAnsicht('positionierung')}>Positionierung schreiben</Knopf>}
                    {zuAnsicht && <Knopf leise onClick={() => zuAnsicht('redaktion')}>Ersten Beitrag planen</Knopf>}
                    {zuAnsicht && <Knopf leise onClick={() => zuAnsicht('anfragen')}>Anfrage erfassen</Knopf>}
                  </span>
                </AlsNaechstes>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <AlsNaechstes>
                  <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{trichter.anfragen.offen ? `${trichter.anfragen.offen} ${trichter.anfragen.offen === 1 ? 'Anfrage wartet' : 'Anfragen warten'} auf Antwort.` : !trichter.reichweite.beitraege ? `Kein veröffentlichter Beitrag in ${tage} Tagen — Reichweite entsteht nur durch Regelmäßigkeit.` : !trichter.kosten.messbar ? 'Kosten an Beiträgen und Kampagnen eintragen — dann rechnet sich, was eine Anfrage kostet.' : trichter.uebergabe.sql ? 'Läuft. Quoten je Stufe zeigen, wo die Strecke reißt.' : 'Anfragen werden erst zu SQL, wenn Sales qualifiziert — Übergabe über Leads.'}</span>
                    {zuAnsicht && trichter.anfragen.offen > 0 && <Knopf leise onClick={() => zuAnsicht('anfragen')}>Zu den Anfragen</Knopf>}
                    {zuAnsicht && !trichter.reichweite.beitraege && <Knopf leise onClick={() => zuAnsicht('redaktion')}>Beitrag planen</Knopf>}
                    {positionierungFehlt && zuAnsicht && <Knopf leise onClick={() => zuAnsicht('positionierung')}>Positionierung schreiben</Knopf>}
                  </span>
                </AlsNaechstes>
              </div>
            )}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10, lineHeight: 1.5 }}>Reichweite: veröffentlichte Beiträge und versendete Ausgaben. Resonanz: Reaktionen an Beiträgen, je Person und Beitrag einmal. Anfragen: Wirkung „Anfrage“ an Beiträgen und der Anfragen-Eingang, je Person und Tag einmal. Übergabe: Deals mit Quelle Content, Anfrage oder Kampagne — oder mit einer Person, die in den 90 Tagen davor über einen Beitrag oder eine Anfrage kam; ein Deal in der Pipeline ist das SQL. Quoten und Kosten je Stück erst ab {MINDESTMENGE} Fällen.</div>
          </>
        ) : <Leer>Lädt …</Leer>}
      </Karte>
      </Kachel>

      <Kachel {...K('anfragen')}>
        <Karte i={0} akzent={offeneAnfragen ? LEUCHT.achtung : undefined}>
          <Ueberschrift farbe={offeneAnfragen ? LEUCHT.achtung : undefined} rechts={zuAnsicht ? <button onClick={() => zuAnsicht('anfragen')} style={leiseKnopf}>{anfragen.length ? `alle ${anfragen.length} ›` : 'Anfragen ›'}</button> : undefined}>Anfragen · 30 Tage</Ueberschrift>
          {anfragen.length ? (
            <Liste>
              {anfragen.slice(0, 5).map(a => (
                <Zeile key={a.id} onClick={() => zuKontakt(a.kontaktId)} links={<Punkt farbe={a.offen ? LEUCHT.achtung : a.deal ? LEUCHT.gut : C.inkLeise} />}
                  titel={<>{a.name}{a.firma && <span style={{ color: C.inkLeise }}> · {a.firma}</span>}</>} unter={`${kanalInfo(a.kanal)?.label ?? a.kanal} · ${datum(a.am.slice(0, 10), heute)}`}
                  rechts={a.offen ? <Chip farbe={LEUCHT.achtung}>offen</Chip> : a.deal ? <Chip farbe={LEUCHT.gut}>Deal</Chip> : undefined} />
              ))}
            </Liste>
          ) : <Leer>Keine Anfrage in 30 Tagen. {zuAnsicht ? <button onClick={() => zuAnsicht('anfragen')} style={{ ...leiseKnopf, color: C.inkDim }}>Anfrage erfassen ›</button> : null}</Leer>}
        </Karte>
      </Kachel>

      <Kachel {...K('segmente')}>
        <Karte i={0}>
          <Ueberschrift rechts={zuAnsicht ? <button onClick={() => zuAnsicht('segmente')} style={leiseKnopf}>Segmente ›</button> : undefined}>Segmente</Ueberschrift>
          {segmente.length ? (
            <Liste>
              {segmente.slice(0, 6).map(sg => <Zeile key={sg.id} onClick={zuAnsicht ? () => zuAnsicht('segmente') : undefined} titel={sg.name} rechts={<span style={{ fontVariantNumeric: 'tabular-nums', color: sg.anzahl ? C.ink : C.inkLeise }}>{sg.anzahl}</span>} />)}
              {segmente.length > 6 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, padding: '4px 2px' }}>und {segmente.length - 6} weitere</div>}
            </Liste>
          ) : <Leer>Noch kein Segment — ein gespeicherter Filter über die Kartei, eine Vorlage reicht. {zuAnsicht ? <button onClick={() => zuAnsicht('segmente')} style={{ ...leiseKnopf, color: C.inkDim }}>Anlegen ›</button> : null}</Leer>}
        </Karte>
      </Kachel>

      <Kachel {...K('netzwerk')}>
        <Karte i={0} akzent={netz.some(n => n.z.schreiben) ? LEUCHT.gut : undefined}>
          <Ueberschrift farbe={LEUCHT.business} rechts={<Link href={markttraktion('kontakte', 'runde-vernetzen')} style={{ color: LEUCHT.business, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600 }}>Vernetzen-Runde ›</Link>}>LinkedIn-Netzwerk</Ueberschrift>
          <div style={{ display: 'grid', gap: 10 }}>
            {netz.map(n => (
              <div key={n.id} style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}><Person id={n.id} name /><span style={{ color: C.inkLeise }}>· {n.z.vernetzt} vernetzt · {n.z.warten} Anfragen offen</span></div>
                <div style={{ fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5 }}>
                  {n.z.schreiben ? <b style={{ color: LEUCHT.gut }}>{n.z.schreiben} angenommen — schreiben. </b> : null}
                  {n.z.nachfassen ? `${n.z.nachfassen} nachfassen. ` : ''}
                  {n.z.restHeute && n.z.anfragen ? `Heute noch ${Math.min(n.z.restHeute, n.z.anfragen)} Anfragen. ` : n.z.anfragen ? 'Tagesportion erledigt. ' : ''}
                  {n.z.anreichern ? `${n.z.anreichern} ohne Profil.` : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>Erst vernetzen, nach der Annahme schreiben — Texte je Kampagne „LinkedIn: vernetzen & anschreiben“. Den LinkedIn-Export importieren, dann kommen Annahmen von selbst.</div>
        </Karte>
      </Kachel>
      <Kachel {...K('freigabe')}>
        <Karte i={0} akzent={beiMir.length ? LEUCHT.achtung : undefined}>
          <Ueberschrift farbe={lage.length ? LEUCHT.achtung : undefined} rechts={lage.length ? `${lage.length} offen` : undefined}>Wartet auf Freigabe</Ueberschrift>
          {beiWem.length ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {beiWem.map(g => (
                <div key={g.person}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}>
                    <Person id={g.person} name /> <span style={{ color: C.inkLeise }}>· {g.posten.length} {g.posten.length === 1 ? 'liegt' : 'liegen'} {g.person === BEIDE ? 'bei euch beiden' : `bei ${nameVon(g.person)}`}</span>
                  </div>
                  <Liste>
                    {g.posten.map(p => (
                      <Zeile key={`${p.art}-${p.id}`} onClick={zu ? () => zu(p.art === 'beitrag' ? 'redaktion' : 'newsletter', p.id) : undefined} titel={p.titel} unter={postenText(p, heute)}
                        links={<Punkt farbe={STAND_FARBE[p.stand]} />} />
                    ))}
                  </Liste>
                </div>
              ))}
              <AlsNaechstes>{beiMir.length
                ? `${beiMir.length} ${beiMir.length === 1 ? 'Posten liegt' : 'Posten liegen'} bei dir — ${[
                  beiMir.some(x => x.stand === 'offen') ? 'lesen, dann freigeben oder Änderung wünschen' : '',
                  beiMir.some(x => x.stand === 'aenderung') ? 'Änderungswünsche einarbeiten und erneut schicken' : '',
                  beiMir.some(x => x.stand === 'fehlt') ? 'Geplantes zur Freigabe schicken' : '',
                ].filter(Boolean).join(' · ')}.`
                : 'Bei dir liegt nichts — der Rest wartet auf die andere Seite.'}</AlsNaechstes>
            </div>
          ) : <Leer>Nichts offen. Erscheint ein Beitrag im Namen einer Person, die ihn nicht selbst schreibt, geht er vor dem Planen hierher — Newsletter auf Wunsch.</Leer>}
        </Karte>
      </Kachel>

      <Kachel {...K('je-person')}>
        <Karte i={1}>
          <Ueberschrift rechts="30 Tage">Beiträge je Person</Ueberschrift>
          <div style={{ display: 'grid', gap: 14 }}>
            {jePerson.map(p => (
              <div key={p.person}>
                <div style={{ marginBottom: 8 }}><Person id={p.person} name /></div>
                <Raster min={110}>
                  <Zahl wert={p.veroeffentlicht === null ? undefined : String(p.veroeffentlicht)} label="veröffentlicht" />
                  <Zahl wert={p.gespraeche === null ? undefined : String(p.gespraeche)} label="Gespräche/Anfragen" farbe={p.gespraeche ? LEUCHT.gut : undefined} />
                  <Zahl wert={p.inIhremNamen === null ? undefined : String(p.inIhremNamen)} label={`in ${genitiv(nameVon(p.person))} Namen`} />
                </Raster>
                {p.belege.length > 0 && (
                  <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6, lineHeight: 1.5 }}>
                    {p.belege.slice(0, 4).map((b, i) => <span key={b.id}>{i ? ' · ' : ''}{zu ? <button onClick={() => zu('redaktion', b.id)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>„{b.titel}“</button> : `„${b.titel}“`} {datum(b.datum, heute)}</span>)}
                    {p.belege.length > 4 && <span> · und {p.belege.length - 4} weitere</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 12, lineHeight: 1.5 }}>Gezählt beim Autor (wer schreibt); gemeinsame Beiträge zählen bei beiden. Gespräche/Anfragen aus der Wirkung an ihren Beiträgen, je Person und Beitrag einmal. — heißt: noch nichts, was sich zählen ließe.</div>
        </Karte>
      </Kachel>

      <Kachel {...K('wirkung')}>
      <Karte i={2}>
        <Ueberschrift rechts="grau = noch nichts gemessen">Wirkung</Ueberschrift>
        {crm ? <KpiLeiste liste={kpis} /> : <Leer>Lädt …</Leer>}
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Gemessen an Gesprächen und Chancen, nicht an Likes oder Öffnungsraten. Wirkung trägst du im Redaktionsplan am Beitrag ein.</div>
      </Karte>
      </Kachel>

      <Kachel {...K('duerfen')}>
      <Karte i={3}>
        <Ueberschrift>Wen wir ansprechen dürfen</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={String(z.mail)} label="Mail freigegeben" farbe={LEUCHT.gut} />
          <Zahl wert={String(z.newsletter)} label="Newsletter (Double-Opt-in)" />
          <Zahl wert={`${z.kreisACmail}/${z.kreisAC}`} label="Kreis A–C mit Mail-Grundlage" />
          <Zahl wert={String(z.gesperrt)} label="Werbesperren" farbe={z.gesperrt ? LEUCHT.kritisch : undefined} />
        </Raster>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Ziel: Der Anteil von Kreis A–C mit gültiger Mail-Grundlage steigt. Einwilligungen holst du im Gespräch — Wortlaut in der Karteikarte festhalten.</div>
      </Karte>
      </Kachel>

      <Kachel {...K('art14')}>
      <Karte i={4} akzent={z.art14.length ? LEUCHT.kritisch : undefined}>
        <Ueberschrift farbe={z.art14.length ? LEUCHT.kritisch : undefined} rechts={z.art14offen ? `${z.art14offen} laufen noch` : undefined}>Art. 14 — Informationspflicht</Ueberschrift>
        {z.art14.length ? (
          <div style={{ display: 'grid', gap: 4 }}>
            {z.art14.slice(0, 12).map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ textAlign: 'left', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 0' }}>{anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null} <span style={{ color: LEUCHT.kritisch }}>· {art14(k, heute)?.tage} Tage</span></button>)}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Wer aus Recherche oder Listen stammt, muss spätestens beim ersten Kontakt, sonst binnen eines Monats informiert werden. In der Karteikarte „Informiert“ setzen.</div>
          </div>
        ) : <Leer>Nichts fällig. Personen aus Recherche oder Listen in der Karteikarte als „Recherche/Liste“ markieren — dann läuft die Uhr.</Leer>}
      </Karte>
      </Kachel>

      <Kachel {...K('quellen')}>
      <Karte i={5}>
        <Ueberschrift>Woher Chancen kommen</Ueberschrift>
        {chancenGesamt ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {z.quellen.map(([q, n]) => (
              <div key={q} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
                <span style={{ color: C.inkDim }}>{QLABEL[q] ?? q}</span><Fortschritt anteil={n / chancenGesamt} farbe={q === 'unbekannt' ? C.inkLeise : LEUCHT.business} /><span style={{ textAlign: 'right' }}>{n}</span>
              </div>
            ))}
            {z.selbstauskunft.map((s, i) => <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim }}>„{s.text}“ <span style={{ color: C.inkLeise }}>— {s.titel}</span></div>)}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Die Selbstauskunft („Wie sind Sie auf uns aufmerksam geworden?“) ist ehrlicher als jede Klick-Zuordnung.</div>
          </div>
        ) : <Leer>Noch keine Deals mit Quelle. Ein Deal aus einer Anfrage oder Kampagne bringt seine Quelle mit — {zuAnsicht ? <button onClick={() => zuAnsicht('anfragen')} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>Anfrage erfassen</button> : 'Anfrage erfassen'}.</Leer>}
      </Karte>
      </Kachel>

      <Kachel {...K('stimme')}>
      <Karte i={6}>
        <Ueberschrift>Stimme der Kunden</Ueberschrift>
        {z.stimmen.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {z.stimmen.map((s, i) => <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>„{s.bedarf}“ <button onClick={() => zuKontakt(s.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>— {s.name}, {datum(s.am)}</button></div>)}
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Themen für Beiträge und Newsletter kommen von hier — im Redaktionsplan mit einem Klick als Idee übernehmen.</div>
          </div>
        ) : <Leer>Sobald Gesprächsnotizen das Feld „Bedarf / Schmerz“ haben, sammeln sich hier die Themen.</Leer>}
        {z.alteEinwilligung.length > 0 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 10 }}>{z.alteEinwilligung.length} Einwilligungen sind älter als zwei Jahre — auffrischen.</div>}
      </Karte>
      </Kachel>
    </Flaeche>
  );
}
