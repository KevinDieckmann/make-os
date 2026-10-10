'use client';

// ─── Markttraktion · Planung — Leadkanäle (10.10.) ───────────────────────────────────────────────────────────────
// Kevin: „Man kann neue Leadkanäle anlegen (z. B. aus Marketing oder aus der eigenen Eventreihe), worüber die Sales geplant werden — dann
// Qualifizierung je Leadkanal.“ Je Kanal: Herkunft (welche Leads und Deals dazugehören, wird nur ABGELEITET — an den Leads ändert sich nichts),
// Plan-Leads je Monat, Sales Cycle, Plan-Quoten mit dem gemessenen Wert daneben („übernehmen“), Kosten und Zeit je Lead, wer verantwortet.
// Gespeichert wird je Eintrag mit Stand (409 bei fremder Änderung) — lib/crm/planung-daten.ts.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, auswahl, MehrfachPillen, Schalter, Chip, Hinweis, Leerzustand, LEUCHT, useRueckfrage } from '../../ui';
import { KANAL, type KanalId } from '@/lib/crm/kanal';
import { herkunftVon, type KanalHerkunft, type LeadKanal, type PlanQuote } from '@/lib/crm/planung-daten';
import type { KanalStand } from '@/lib/crm/planung';
import { WELT_FARBE } from '../Ueberblick';
import { zahl1, euro, type PlanungApi, type PlanungLage } from './daten';

type KanalMitStand = LeadKanal & { stand: string };
const WER_LEER = '';

/** Zahl aus dem Feld — leer = null (entfernt den Wert), sonst die Zahl (Komma erlaubt). Ungültiges bleibt Text und der Server sagt, warum. */
const ausFeld = (t: string): number | null | string => { const s = t.trim(); if (!s) return null; const n = Number(s.replace(',', '.')); return Number.isFinite(n) ? n : s; };
const insFeld = (n: number | undefined | null) => (n == null ? '' : String(n).replace('.', ','));

function KanalForm({ lage, k, st, api, onFertig }: { lage: PlanungLage; k: KanalMitStand | null; st?: KanalStand; api: PlanungApi; onFertig: () => void }) {
  const [name, setName] = useState(k?.name ?? '');
  const [herkunft, setHerkunft] = useState<KanalHerkunft>(k?.herkunft ?? 'netzwerk');
  const [bezug, setBezug] = useState(k?.bezug ?? '');
  const [kanaele, setKanaele] = useState<KanalId[]>(k?.kanaele ?? [...herkunftVon('netzwerk').kanaele]);
  const [leadsMonat, setLeadsMonat] = useState(insFeld(k?.leadsMonat ?? 10));
  const [zyklus, setZyklus] = useState(insFeld(k?.zyklusWochen ?? lage.standard.zyklusWochen ?? 8));
  const [kosten, setKosten] = useState(insFeld(k?.kostenJeLead));
  const [minuten, setMinuten] = useState(insFeld(k?.minutenJeLead));
  const [beitraege, setBeitraege] = useState(insFeld(k?.beitraegeWoche));
  const [verantwortlich, setVerantwortlich] = useState(k?.verantwortlich ?? WER_LEER);
  const [vertrieb, setVertrieb] = useState(k?.vertrieb ?? WER_LEER);
  const [aktiv, setAktiv] = useState(k?.aktiv ?? true);
  const [quoten, setQuoten] = useState<Record<PlanQuote, string>>(() => Object.fromEntries(lage.auswahl.quoten.map(q => [q.id, insFeld(k?.quoten[q.id])])) as Record<PlanQuote, string>);
  const h = herkunftVon(herkunft);
  const rueckfrage = useRueckfrage();
  const wechsleHerkunft = (n: KanalHerkunft) => { setHerkunft(n); setBezug(''); if (!k) setKanaele([...herkunftVon(n).kanaele]); };
  const speichern = async () => {
    const q: Record<string, number | string | null> = {};
    for (const x of lage.auswahl.quoten) q[x.id] = ausFeld(quoten[x.id]);
    const eintrag: Record<string, unknown> = {
      ...(k ? { id: k.id } : {}), name, herkunft, bezug: bezug || null, kanaele, leadsMonat: ausFeld(leadsMonat) ?? 0, zyklusWochen: ausFeld(zyklus) ?? 8,
      kostenJeLead: ausFeld(kosten), minutenJeLead: ausFeld(minuten), beitraegeWoche: ausFeld(beitraege),
      verantwortlich: verantwortlich || null, vertrieb: vertrieb || null, aktiv,
      // Eine leere Quote fällt weg (dann gilt die Annahme) — der Server bekommt nur die gesetzten.
      quoten: Object.fromEntries(Object.entries(q).filter(([, v]) => v !== null)),
    };
    if (await api.schreibe([{ op: 'kanal', eintrag, ...(k ? { stand: k.stand } : {}) }])) onFertig();
  };
  const wer = [{ id: WER_LEER, name: 'Vorgabe (Verantwortung der Welt)' }, ...lage.team.map(t => ({ id: t.id, name: t.name })), { id: 'beide', name: 'Beide' }];
  const bezugListe = h.bezug === 'kampagne' ? lage.auswahl.kampagnen : h.bezug === 'reihe' ? lage.auswahl.reihen : [];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Feldzeile label="Name"><input value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="z. B. Eigene Eventreihe" style={feld} /></Feldzeile>
        <Feldzeile label="Herkunft">
          <select value={herkunft} onChange={e => wechsleHerkunft(e.target.value as KanalHerkunft)} style={{ ...auswahl, width: '100%' }}>
            {lage.auswahl.herkunft.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Feldzeile>
        {h.bezug && (
          <Feldzeile label={h.bezug === 'kampagne' ? 'Kampagne (genauer Bezug)' : 'Eventreihe (genauer Bezug)'}>
            <select value={bezug} onChange={e => setBezug(e.target.value)} style={{ ...auswahl, width: '100%' }}>
              <option value="">— ohne —</option>
              {bezugListe.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Feldzeile>
        )}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Welche Herkunft der Kartei zählt hierher (nur abgeleitet)</span>
        <MehrfachPillen liste={KANAL.filter(x => x.id !== 'unbekannt').map(x => ({ id: x.id, label: x.label }))} aktiv={kanaele} onWahl={ids => setKanaele(ids)} farbe={WELT_FARBE[h.welt]} />
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Feldzeile label="Plan-Leads je Monat"><input value={leadsMonat} onChange={e => setLeadsMonat(e.target.value)} inputMode="decimal" style={feld} /></Feldzeile>
        <Feldzeile label="Sales Cycle (Wochen)"><input value={zyklus} onChange={e => setZyklus(e.target.value)} inputMode="numeric" style={feld} /></Feldzeile>
        <Feldzeile label="Kosten je Lead (€)"><input value={kosten} onChange={e => setKosten(e.target.value)} inputMode="decimal" placeholder="optional" style={feld} /></Feldzeile>
        <Feldzeile label="Minuten je Lead"><input value={minuten} onChange={e => setMinuten(e.target.value)} inputMode="numeric" placeholder={`Vorgabe ${h.minutenJeLead}`} style={feld} /></Feldzeile>
        <Feldzeile label="Beiträge je Woche"><input value={beitraege} onChange={e => setBeitraege(e.target.value)} inputMode="numeric" placeholder="optional" style={feld} /></Feldzeile>
      </div>
      {lage.standard.zyklusWochen != null && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Gemessener Sales Cycle (Median der gewonnenen Deals): {lage.standard.zyklusWochen} Wochen{' '}
        <Knopf leise onClick={() => setZyklus(String(lage.standard.zyklusWochen))}>übernehmen</Knopf></div>}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Feldzeile label="Leads erzeugt"><select value={verantwortlich} onChange={e => setVerantwortlich(e.target.value)} style={{ ...auswahl, width: '100%' }}>{wer.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Feldzeile>
        <Feldzeile label="Gespräche & Angebote führt"><select value={vertrieb} onChange={e => setVertrieb(e.target.value)} style={{ ...auswahl, width: '100%' }}>{wer.map(x => <option key={x.id} value={x.id}>{x.id === WER_LEER ? 'Vorgabe (Sales-Verantwortung)' : x.name}</option>)}</select></Feldzeile>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Plan-Quoten (%) — leer = Annahme</span>
        {lage.auswahl.quoten.map(q => {
          const s = st?.quoten[q.id];
          return (
            <div key={q.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 96px auto', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien }}>{q.label}</span>
              <input value={quoten[q.id]} onChange={e => setQuoten({ ...quoten, [q.id]: e.target.value })} inputMode="decimal" aria-label={`${q.label} in Prozent`}
                placeholder={`${lage.standard.quoten[q.id]}`} style={{ ...feld, textAlign: 'right' }} />
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, whiteSpace: 'nowrap' }}>
                {s?.ist != null ? <>Ist {s.ist} % <span style={{ color: C.inkLeise }}>(n = {s.n})</span> <Knopf leise onClick={() => setQuoten({ ...quoten, [q.id]: String(s.ist) })}>übernehmen</Knopf></> : <span style={{ color: C.inkLeise }}>Ist: noch zu wenig ({s?.n ?? 0})</span>}
              </span>
            </div>
          );
        })}
      </div>
      <Schalter an={aktiv} onChange={setAktiv}>Aktiv — wird geplant und zugeordnet</Schalter>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf haupt onClick={speichern}>{k ? 'Speichern' : 'Leadkanal anlegen'}</Knopf>
        <Knopf leise onClick={onFertig}>Abbrechen</Knopf>
        {k && <Knopf leise farbe={LEUCHT.kritisch} onClick={async () => {
          const ja = await rueckfrage.bestaetigen({ titel: `Leadkanal „${k.name}“ entfernen?`, text: 'Leads und Deals bleiben, wie sie sind — nur die Planung über diesen Kanal fällt weg.', ja: 'Entfernen', gefahr: true });
          if (ja && await api.schreibe([{ op: 'kanal-weg', id: k.id, stand: k.stand }])) onFertig();
        }}>Entfernen</Knopf>}
      </div>
      {rueckfrage.dialog}
    </div>
  );
}

export function Kanaele({ api, lage, kanal, onKanal }: { api: PlanungApi; lage: PlanungLage; kanal: string | null; onKanal: (k: string | null) => void }) {
  const [offen, setOffen] = useState<string | 'neu' | null>(null);
  const eintraege = lage.datei.kanaele as KanalMitStand[];
  const stand = useMemo(() => new Map(lage.kanaele.map(s => [s.id, s])), [lage.kanaele]);
  useEffect(() => { if (offen && offen !== 'neu' && !eintraege.some(k => k.id === offen)) setOffen(null); }, [offen, eintraege]);
  if (!eintraege.length && offen !== 'neu') {
    return (
      <Karte i={0}>
        <Leerzustand symbol="↻" titel="Noch kein Leadkanal" aktion={<Knopf haupt onClick={() => setOffen('neu')}>Ersten Leadkanal anlegen</Knopf>}>
          Über Leadkanäle wird geplant: eigene Eventreihe, Kampagne, Netzwerk, Empfehlung, Partner … Welche Leads dazugehören, leitet die Planung aus der Herkunft ab.
        </Leerzustand>
      </Karte>
    );
  }
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={offen !== 'neu' ? <Knopf onClick={() => setOffen('neu')}>+ Leadkanal</Knopf> : null}>Leadkanäle</Ueberschrift>
        {offen === 'neu' && <KanalForm lage={lage} k={null} api={api} onFertig={() => setOffen(null)} />}
        <div style={{ display: 'grid', gap: 10, marginTop: offen === 'neu' ? 16 : 0 }}>
          {eintraege.map(k => {
            const st = stand.get(k.id);
            const f = WELT_FARBE[herkunftVon(k.herkunft).welt];
            return (
              <div key={k.id} style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10, opacity: k.aktiv ? 1 : 0.6 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: TYP.body }}>{k.name}</b>
                    <Chip farbe={f}>{herkunftVon(k.herkunft).label}</Chip>
                    {!k.aktiv && <Chip farbe={C.inkLeise}>inaktiv</Chip>}
                  </span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Knopf leise onClick={() => onKanal(kanal === k.id ? null : k.id)}>{kanal === k.id ? 'Filter aus' : 'Im Kreislauf zeigen'}</Knopf>
                    <Knopf leise onClick={() => setOffen(offen === k.id ? null : k.id)}>{offen === k.id ? 'Schließen' : 'Bearbeiten'}</Knopf>
                  </span>
                </div>
                {st && (
                  <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, marginTop: 6 }}>
                    <span>Plan <b style={{ color: C.ink }}>{zahl1(k.leadsMonat)}</b> Leads/Monat · Ist <b style={{ color: C.ink }}>{zahl1(st.neueLeadsMonat)}</b></span>
                    <span>{st.leads} Leads ({st.inArbeit} in Arbeit)</span>
                    <span>{st.dealsOffen} Deals offen · {euro(st.wertOffen)}</span>
                    <span>{st.gewonnen} gewonnen</span>
                    <span>Sales Cycle {k.zyklusWochen} Wo.</span>
                    {st.kostenJeSql != null && <span>≈ {euro(st.kostenJeSql)} je SQL</span>}
                  </div>
                )}
                {st && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {lage.auswahl.quoten.map(q => {
                      const x = st.quoten[q.id];
                      const unter = x.ist != null && x.ist < x.plan.wert;
                      return <span key={q.id} title={x.plan.quelle === 'annahme' ? 'Plan ist eine Annahme' : 'Plan von Hand'} style={{ fontSize: TYP.bedien, padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,.10)', color: C.inkDim }}>
                        {q.label}: <b style={{ color: C.ink }}>{x.plan.wert} %</b>{x.plan.quelle === 'annahme' ? '*' : ''} · Ist <b style={{ color: x.ist == null ? C.inkLeise : unter ? LEUCHT.achtung : LEUCHT.gut }}>{x.ist == null ? '—' : `${x.ist} %`}</b>
                      </span>;
                    })}
                  </div>
                )}
                {offen === k.id && <div style={{ marginTop: 12 }}><KanalForm lage={lage} k={k} st={st} api={api} onFertig={() => setOffen(null)} /></div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12 }}><Hinweis>* Annahme: ohne eigene Quote gelten die Wahrscheinlichkeiten der Pipeline (Stammdaten › Stufen) bzw. Startwerte. „Ist“ zählt erst ab fünf Fällen.</Hinweis></div>
      </Karte>
    </>
  );
}
