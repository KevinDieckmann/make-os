'use client';

// ─── Markttraktion · Planung — Umsatzziele → Aktivitäten (10.10.) ────────────────────────────────────────────────
// Kevin: „Umsatzziele auf einzelne Aktivitäten runterplanen — Sales, Marketing, was auch immer — mit Kapa und allem, was dazugehört.“
// Je Umsatzziel (Business-Gesellschaft, Zeitraum) der Rückwärts-Trichter: Umsatz ÷ Ø Deal-Wert → Deals ÷ Angebot→Gewonnen → Angebote …
// → Leads je Leadkanal, je Woche bis zum letzten Start (Ende − Sales Cycle). Darunter: was das diese Woche je Welt und je Person heißt und
// ob es in die freie Zeit passt (Kapazität). Gerechnet wird auf dem Server (lib/crm/planung.ts) — hier wird nur gezeigt und eingegeben.

import { useState, type CSSProperties } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Feldzeile, feld, auswahl, Chip, Hinweis, Leerzustand, LEUCHT, useRueckfrage } from '../../ui';
import { WELT_FARBE } from '../Ueberblick';
import type { UmsatzZiel, AktivitaetZeiten } from '@/lib/crm/planung-daten';
import type { ZielLage, PlanMachbar } from '@/lib/crm/planung';
import type { Welt } from '@/lib/crm/traktion';
import { zahl1, auf, euro, datum, type PlanungApi, type PlanungLage } from './daten';

type ZielMitStand = UmsatzZiel & { stand: string };
const ausFeld = (t: string): number | null | string => { const s = t.trim(); if (!s) return null; const n = Number(s.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : s; };
const insFeld = (n: number | undefined | null) => (n == null ? '' : String(n).replace('.', ','));
const MACHBAR_FARBE: Record<PlanMachbar, string> = { machbar: LEUCHT.gut, eng: LEUCHT.achtung, 'nicht-machbar': LEUCHT.kritisch, unbekannt: C.inkLeise, nichts: C.inkLeise };
const WELT_NAME: Record<Welt, string> = { sales: 'Sales', marketing: 'Marketing', event: 'Event' };
const zelle: CSSProperties = { padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid rgba(255,255,255,.06)' };
const kopf: CSSProperties = { ...zelle, fontSize: TYP.mikro, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 };
const jahrEnde = (heute: string) => `${heute.slice(0, 4)}-12-31`;

function ZielForm({ lage, z, api, onFertig }: { lage: PlanungLage; z: ZielMitStand | null; api: PlanungApi; onFertig: () => void }) {
  const [gesellschaft, setGesellschaft] = useState(z?.gesellschaft ?? lage.auswahl.gesellschaften[0]?.id ?? '');
  const [titel, setTitel] = useState(z?.titel ?? '');
  const [von, setVon] = useState(z?.von ?? lage.heute);
  const [bis, setBis] = useState(z?.bis ?? jahrEnde(lage.heute));
  const [umsatz, setUmsatz] = useState(insFeld(z?.umsatz));
  const [dealWert, setDealWert] = useState(insFeld(z?.dealWert));
  const [zielId, setZielId] = useState(z?.zielId ?? '');
  const [anteile, setAnteile] = useState<Record<string, string>>(() => Object.fromEntries(lage.datei.kanaele.filter(k => k.aktiv).map(k => [k.id, insFeld(z?.anteile?.[k.id])])));
  const rueckfrage = useRueckfrage();
  const ausZahlenziel = (id: string) => {
    setZielId(id);
    const x = lage.auswahl.zahlenziele.find(y => y.id === id);
    if (!x) return;
    setUmsatz(String(x.zielwert)); if (!titel) setTitel(x.titel);
    setVon(x.jahr === Number(lage.heute.slice(0, 4)) ? lage.heute : `${x.jahr}-01-01`); setBis(`${x.jahr}-12-31`);
  };
  const speichern = async () => {
    const a = Object.fromEntries(Object.entries(anteile).map(([k, v]) => [k, ausFeld(v)]).filter(([, v]) => v !== null));
    const eintrag: Record<string, unknown> = {
      ...(z ? { id: z.id } : {}), gesellschaft, titel: titel.trim() || null, von, bis, umsatz: ausFeld(umsatz), dealWert: ausFeld(dealWert), zielId: zielId || null,
      anteile: Object.keys(a).length ? a : null,
    };
    if (await api.schreibe([{ op: 'ziel', eintrag, ...(z ? { stand: z.stand } : {}) }])) onFertig();
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {lage.auswahl.zahlenziele.length > 0 && (
        <Feldzeile label="Aus einem Zahlenziel der Planung übernehmen (optional)">
          <select value={zielId} onChange={e => ausZahlenziel(e.target.value)} style={{ ...auswahl, width: '100%' }}>
            <option value="">— eigenes Umsatzziel —</option>
            {lage.auswahl.zahlenziele.map(x => <option key={x.id} value={x.id}>{x.titel} · {x.zielwert.toLocaleString('de-DE')} ({x.jahr})</option>)}
          </select>
        </Feldzeile>
      )}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <Feldzeile label="Gesellschaft">
          <select value={gesellschaft} onChange={e => setGesellschaft(e.target.value)} style={{ ...auswahl, width: '100%' }}>
            {lage.auswahl.gesellschaften.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Feldzeile>
        <Feldzeile label="Titel (optional)"><input value={titel} onChange={e => setTitel(e.target.value)} maxLength={80} style={feld} /></Feldzeile>
        <Feldzeile label="Von"><input type="date" value={von} onChange={e => setVon(e.target.value)} style={feld} /></Feldzeile>
        <Feldzeile label="Bis"><input type="date" value={bis} onChange={e => setBis(e.target.value)} style={feld} /></Feldzeile>
        <Feldzeile label="Umsatz netto (€)"><input value={umsatz} onChange={e => setUmsatz(e.target.value)} inputMode="decimal" style={feld} /></Feldzeile>
        <Feldzeile label="Ø Deal-Wert (€)"><input value={dealWert} onChange={e => setDealWert(e.target.value)} inputMode="decimal" placeholder={lage.standard.dealWert ? `gemessen ${lage.standard.dealWert.toLocaleString('de-DE')}` : 'eintragen'} style={feld} /></Feldzeile>
      </div>
      {lage.datei.kanaele.some(k => k.aktiv) && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Anteil der Deals je Leadkanal (%) — leer = nach geplanter Leistung verteilt</span>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
            {lage.datei.kanaele.filter(k => k.aktiv).map(k => <Feldzeile key={k.id} label={k.name}><input value={anteile[k.id] ?? ''} onChange={e => setAnteile({ ...anteile, [k.id]: e.target.value })} inputMode="decimal" style={feld} /></Feldzeile>)}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf haupt onClick={speichern}>{z ? 'Speichern' : 'Umsatzziel anlegen'}</Knopf>
        <Knopf leise onClick={onFertig}>Abbrechen</Knopf>
        {z && <Knopf leise farbe={LEUCHT.kritisch} onClick={async () => {
          if (await rueckfrage.bestaetigen({ titel: 'Umsatzziel entfernen?', text: 'Die Wochenziele im Scoreboard fallen dann weg.', ja: 'Entfernen', gefahr: true }) && await api.schreibe([{ op: 'ziel-weg', id: z.id, stand: z.stand }])) onFertig();
        }}>Entfernen</Knopf>}
      </div>
      {rueckfrage.dialog}
    </div>
  );
}

function Trichter({ l, gesellschaft }: { l: ZielLage; gesellschaft: string }) {
  const kette: [string, string][] = [
    ['Umsatz', euro(l.ziel.umsatz)], ...(l.ist.rest < l.ziel.umsatz ? [['noch offen', euro(l.ist.rest)] as [string, string]] : []), ['Ø Deal', l.dealWert.wert ? `${euro(l.dealWert.wert)}${l.dealWert.quelle === 'gemessen' ? ' (gemessen)' : ''}` : '—'],
    ['Deals', auf(l.summe.gewonnen)], ['Angebote', auf(l.summe.angebote)], ['SQL', auf(l.summe.sql)], ['Gespräche', auf(l.summe.gespraeche)], ['Leads', auf(l.summe.leads)],
  ];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: TYP.bedien }}>
        {kette.map(([k, v], i) => <span key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{i > 0 && <span aria-hidden style={{ color: C.inkLeise }}>→</span>}<span style={{ color: C.inkDim }}>{k}</span> <b style={{ fontFamily: SCHRIFT.display, fontSize: TYP.body }}>{v}</b></span>)}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
        {gesellschaft} · {datum(l.ziel.von)} – {datum(l.ziel.bis)} · Ist {euro(l.ist.umsatz)}{l.ist.anteil != null ? ` (${l.ist.anteil} %)` : ''} gewonnen · {euro(l.ist.offenGewichtet)} offen gewichtet{l.summe.kosten != null ? ` · Lead-Kosten ≈ ${euro(l.summe.kosten)}` : ''}
      </div>
      {l.fehlt.map(f => <Hinweis key={f} art="achtung">{f}</Hinweis>)}
      {l.kanaele.length > 0 && (
        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: TYP.bedien, minWidth: 760, width: '100%' }}>
            <thead><tr>
              <th style={{ ...kopf, textAlign: 'left' }}>Leadkanal</th><th style={kopf}>Anteil</th><th style={kopf}>Leads</th><th style={kopf}>Gespräche</th><th style={kopf}>SQL</th><th style={kopf}>Angebote</th><th style={kopf}>Deals</th>
              <th style={kopf}>je Woche</th><th style={kopf}>letzter Start</th><th style={kopf}>Leads/Monat</th>
            </tr></thead>
            <tbody>
              {l.kanaele.map(k => (
                <tr key={k.kanalId}>
                  <td style={{ ...zelle, textAlign: 'left' }}><span style={{ color: WELT_FARBE[k.welt] }}>●</span> {k.name}</td>
                  <td style={zelle}>{Math.round(k.anteil * 100)} %</td>
                  <td style={zelle}>{auf(k.leads)}</td><td style={zelle}>{auf(k.gespraeche)}</td><td style={zelle}>{auf(k.sql)}</td><td style={zelle}>{auf(k.angebote)}</td><td style={zelle}>{zahl1(k.gewonnen)}</td>
                  <td style={zelle}>{k.jeWoche ? `${zahl1(k.jeWoche.leads)} L · ${zahl1(k.jeWoche.gespraeche)} G · ${zahl1(k.jeWoche.angebote)} A` : '—'}</td>
                  <td style={{ ...zelle, color: k.zuSpaet ? LEUCHT.kritisch : C.ink }}>{datum(k.letzterStart)}{k.zuSpaet ? ' (zu spät)' : ''}</td>
                  <td style={{ ...zelle, color: k.leadsMonatNoetig != null && k.leadsMonatNoetig > k.leadsMonatPlan ? LEUCHT.achtung : C.ink }} title="nötig gegen geplant">{zahl1(k.leadsMonatNoetig)} / {zahl1(k.leadsMonatPlan)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ZeitenKarte({ lage, api }: { lage: PlanungLage; api: PlanungApi }) {
  const z = lage.datei.zeiten;
  const [werte, setWerte] = useState<Record<keyof AktivitaetZeiten, string>>(() => ({ gespraech: String(z.gespraech), angebot: String(z.angebot), nachfassen: String(z.nachfassen), beitrag: String(z.beitrag) }));
  const geaendert = (Object.keys(werte) as (keyof AktivitaetZeiten)[]).some(k => werte[k] !== String(z[k]));
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {(Object.keys(lage.auswahl.zeiten) as (keyof AktivitaetZeiten)[]).map(k => (
          <Feldzeile key={k} label={`${lage.auswahl.zeiten[k]} (min)`}><input value={werte[k]} onChange={e => setWerte({ ...werte, [k]: e.target.value })} inputMode="numeric" style={feld} /></Feldzeile>
        ))}
      </div>
      {geaendert && <div><Knopf onClick={async () => { await api.schreibe([{ op: 'zeiten', stand: lage.datei.zeitenStand, zeiten: Object.fromEntries(Object.entries(werte).map(([k, v]) => [k, ausFeld(v)])) }]); }}>Zeiten speichern</Knopf></div>}
    </div>
  );
}

export function Ziele({ api, lage, zuKanaele }: { api: PlanungApi; lage: PlanungLage; zuKanaele: () => void }) {
  const [offen, setOffen] = useState<string | 'neu' | null>(null);
  const ziele = lage.datei.ziele as ZielMitStand[];
  const name = (g: string) => lage.auswahl.gesellschaften.find(x => x.id === g)?.name ?? g;
  const teamName = (id: string) => lage.team.find(t => t.id === id)?.name ?? id;
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={offen !== 'neu' && ziele.length > 0 ? <Knopf onClick={() => setOffen('neu')}>+ Umsatzziel</Knopf> : null}>Umsatzziele → Aktivitäten</Ueberschrift>
        {!lage.datei.kanaele.some(k => k.aktiv) && <div style={{ marginBottom: 12 }}><Hinweis art="info" aktion={<Knopf leise onClick={zuKanaele}>Leadkanäle anlegen</Knopf>}>Geplant wird über Leadkanäle — ohne aktiven Kanal bleibt der Trichter leer.</Hinweis></div>}
        {offen === 'neu' && <ZielForm lage={lage} z={null} api={api} onFertig={() => setOffen(null)} />}
        {!ziele.length && offen !== 'neu' && (
          <Leerzustand symbol="◎" titel="Noch kein Umsatzziel" aktion={<Knopf haupt onClick={() => setOffen('neu')}>Umsatzziel anlegen</Knopf>}>
            Umsatz je Gesellschaft und Zeitraum — daraus rechnet die Planung Deals, Angebote, Gespräche und Leads je Kanal und Woche.
          </Leerzustand>
        )}
        <div style={{ display: 'grid', gap: 18, marginTop: offen === 'neu' ? 18 : 0 }}>
          {ziele.map(z => {
            const l = lage.ziele.find(x => x.ziel.id === z.id);
            return (
              <div key={z.id} style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: TYP.body }}>{z.titel ?? `Umsatzziel ${name(z.gesellschaft)}`}</b>
                    {l?.vorbei && <Chip farbe={C.inkLeise}>vorbei</Chip>}
                    {z.zielId && <Chip farbe={LEUCHT.planung}>aus der Planung</Chip>}
                  </span>
                  <Knopf leise onClick={() => setOffen(offen === z.id ? null : z.id)}>{offen === z.id ? 'Schließen' : 'Bearbeiten'}</Knopf>
                </div>
                {offen === z.id && <ZielForm lage={lage} z={z} api={api} onFertig={() => setOffen(null)} />}
                {l && <Trichter l={l} gesellschaft={name(z.gesellschaft)} />}
              </div>
            );
          })}
        </div>
      </Karte>
      {ziele.length > 0 && (
        <Karte i={1}>
          <Ueberschrift>Diese Woche — je Welt und je Person</Ueberschrift>
          {lage.wochenziele ? (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: '8px 22px', flexWrap: 'wrap', fontSize: TYP.body }}>
                <span>Leads <b>{lage.wochenziele.leads}</b></span><span>Gespräche <b>{lage.wochenziele.gespraeche}</b></span><span>SQL <b>{lage.wochenziele.sql}</b></span><span>Angebote <b>{lage.wochenziele.angebote}</b></span>
                <span style={{ color: C.inkDim, fontSize: TYP.bedien }}>— die Ziele im Wochen-Scoreboard (Überblick)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(lage.jeWelt) as Welt[]).filter(w => Object.values(lage.jeWelt[w]).some(n => n > 0)).map(w => (
                  <span key={w} style={{ fontSize: TYP.bedien, padding: '6px 12px', borderRadius: 999, border: `1px solid ${WELT_FARBE[w]}55`, color: C.inkDim }}>
                    <b style={{ color: WELT_FARBE[w] }}>{WELT_NAME[w]}</b> · {zahl1(lage.jeWelt[w].leads)} Leads{w === 'sales' ? ` · ${zahl1(lage.jeWelt[w].gespraeche)} Gespräche · ${zahl1(lage.jeWelt[w].angebote)} Angebote` : ''}
                  </span>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {lage.kapa.filter(x => x.status !== 'nichts').map(x => {
                  const b = lage.bedarf.find(y => y.person === x.person);
                  return (
                    <div key={x.person} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
                      <span><b>{teamName(x.person)}</b> <span style={{ color: C.inkDim }}>· {zahl1(b?.leads)} Leads · {zahl1(b?.gespraeche)} Gespräche · {zahl1(b?.angebote)} Angebote{b?.beitraege ? ` · ${zahl1(b.beitraege)} Beiträge` : ''} = {zahl1(x.stunden)} h</span></span>
                      <Chip farbe={MACHBAR_FARBE[x.status]} umbrechen>{x.text}</Chip>
                    </div>
                  );
                })}
                {!lage.kapa.some(x => x.status !== 'nichts') && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Diese Woche liegt kein Kanal im Lead-Fenster.</div>}
              </div>
            </div>
          ) : <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Diese Woche liegt kein Kanal im Lead-Fenster — die Ziele im Scoreboard bleiben die Startwerte.</div>}
        </Karte>
      )}
      <Karte i={2} flach>
        <Ueberschrift>Zeit je Aktivität</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10 }}>Damit rechnet der Abgleich mit der Kapazität (freie Stunden aus Planung › Kapazität, Ø nächste vier Wochen). Minuten je Lead stehen am Leadkanal.</div>
        <ZeitenKarte lage={lage} api={api} />
      </Karte>
    </>
  );
}
