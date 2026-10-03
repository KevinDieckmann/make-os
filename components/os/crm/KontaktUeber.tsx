'use client';

// ─── Kontakt öffnen · Reiter „Über“ (28.09., HubSpot-Vorbild) ───────────────
//   Datensatz-Zusammenfassung   2–4 Sätze aus echten Daten (lib/crm/zusammenfassung.ts),
//                               Quellen-Nummern ①② springen in Aktivitäten (Anker), Deal oder Mandat;
//                               „Frage stellen“ und „Mit ZOE formulieren“ über /api/crm/kontakt-frage
//                               (nur mit KI — ohne Guthaben ein freundlicher Hinweis, der Knopf fehlt)
//   Nächster Schritt · Lead-Qualifizierung kurz (Score, Kernfragen) · Beziehung kurz ·
//   die letzten drei Aktivitäten mit „alle ›“.

import { useTerminZeiten } from '../kalender/TermineAkte';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../ui';
import { STUFE_LABEL, rollenVon, ROLLE_LABEL, type Kontakt } from '@/lib/make-one/crm';
import type { Qual } from '@/lib/crm/typen';
import { zusammenfassung, nummer, type ZfQuelle } from '@/lib/crm/zusammenfassung';
import { statusLabel, abgeleitet } from '@/lib/crm/leads';
import { leadScore, scoringKontext, temperaturFarbe, temperaturLabel } from '@/lib/crm/score';
import { leadZeileFuer, fehltBisSqlZeile, salesBereit } from '@/lib/crm/leads';
import { qualifizierungLink } from '@/lib/crm/adresse';
import { SeitenChip } from './quali/ScoreAnzeige';
import { phaseVon } from '@/lib/crm/phase';
import { takt } from '@/lib/crm/akte';
import { OFFENE_STUFEN } from '@/lib/crm/pipeline';
import { haeltBeziehung, nameVon } from '@/lib/crm/team';
import { WEG } from '@/lib/wege';
import { mandateLink, type AkteReiter } from '@/lib/crm/adresse';
import { type CrmApi, datum } from './daten';
import { Verlauf } from './teile';
import { Person } from './team';
import { LeadBlock } from './Leads';
import { NaechsterSchrittTeil, phaseFarbe, phaseLabel, type Setze } from './kontakt-teile';
import { Klappe, leiseKnopf, type Klappen } from './kontakt-klappe';

type Zu = (t: AkteReiter, u?: string | null, anker?: string) => void;

/** Ist KI gerade verfügbar? Einmal je Seite gefragt — null, solange die Antwort fehlt. */
function useKi(): { ki: boolean; grund?: string } | null {
  const [s, setS] = useState<{ ki: boolean; grund?: string } | null>(null);
  useEffect(() => {
    let an = true;
    fetch('/api/crm/kontakt-frage', { cache: 'no-store' }).then(r => r.json()).then(d => { if (an) setS({ ki: !!d?.ki, grund: d?.grund }); }).catch(() => { if (an) setS({ ki: false }); });
    return () => { an = false; };
  }, []);
  return s;
}

const QUAL_FARBE: Record<Qual, string> = { ja: LEUCHT.gut, nein: LEUCHT.kritisch, unklar: 'rgba(255,255,255,.18)' };

export function KontaktUeber({ k, api, heute, name, setze, klappen, breit, zuReiter, personen }: {
  k: Kontakt; api: CrmApi; heute: string; name: (p: string) => string; setze: Setze; klappen: Klappen;
  /** Genug Platz in der Mitte für zwei Spalten. */
  breit: boolean;
  zuReiter: Zu;
  /** Personen der Firma (für Lead-Score und abgeleiteten Lead-Status) — ohne Firma nur die Person. */
  personen: readonly Kontakt[];
}) {
  const router = useRouter();
  const crm = api.crm;
  // Jetzt mitgeben (28.09.): ein Meeting von heute 18 Uhr ist um 10 Uhr noch das „nächste“, kein vergangenes Gespräch.
  // K3: Meetings aus Kalenderterminen tragen ihre Zeit im Termin — über den Bezug gelesen.
  const terminZeiten = useTerminZeiten(k.id);
  const zf = useMemo(() => zusammenfassung(k, crm?.stand, heute, new Date().toISOString(), terminZeiten), [k, crm, heute, terminZeiten]);
  const ki = useKi();
  const [frage, setFrage] = useState('');
  const [antwort, setAntwort] = useState<{ text: string; art: 'ok' | 'hinweis' } | 'laedt' | null>(null);
  const [leadOffen, setLeadOffen] = useState(false);
  useEffect(() => { setFrage(''); setAntwort(null); setLeadOffen(false); }, [k.id]);

  const fragen = async (mitFrage: boolean) => {
    const f = frage.trim();
    if (mitFrage && !f) return;
    setAntwort('laedt');
    const r = await fetch('/api/crm/kontakt-frage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, ...(mitFrage ? { frage: f } : {}) }) })
      .then(x => x.json()).catch(() => null) as { ok?: boolean; text?: string; fehler?: string; error?: string } | null;
    if (r?.ok && r.text) setAntwort({ text: r.text, art: 'ok' });
    else setAntwort({ text: r?.text ?? r?.fehler ?? r?.error ?? 'ZOE ist gerade nicht erreichbar — die Zusammenfassung oben gilt weiter.', art: 'hinweis' });
  };
  const zurQuelle = (q: ZfQuelle) => {
    if (q.art === 'aktivitaet') zuReiter('aktivitaeten', 'alle', q.anker);
    else if (q.art === 'deal') router.push(WEG.deal(q.id));
    else if (q.art === 'mandat') router.push(mandateLink('mandate', q.id));
    else if (q.feld === 'naechsterSchritt') document.getElementById('kontakt-schritt')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Lead kurz: an der Firma, sonst an der Person; ohne Status abgeleitet wie in den Leads.
  const firma = k.firmaId ? crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const lead = firma?.lead ?? k.lead;
  const offenerDeal = (crm?.stand.chancen ?? []).some(c => OFFENE_STUFEN.includes(c.stufe) && (c.kontaktIds.includes(k.id) || (!!k.firmaId && c.firmaId === k.firmaId)));
  const status = lead?.status ?? abgeleitet([...personen], offenerDeal);
  // Dieselbe Rechnung wie Leads-Liste und Runde (eine Quelle): Score, Marketing- und Sales-Punkte gegen ihre Schwellen.
  const zeile = crm ? leadZeileFuer(k, api.kontakte ?? [k], crm.stand, heute) : undefined;
  const score = zeile?.score ?? leadScore([...personen], lead, heute, undefined, scoringKontext(crm?.stand));
  const ph = phaseVon(k, crm?.stand);
  const tk = takt(k, heute);
  const chip = (text: string, farbe: string) => <span style={{ fontSize: 12, fontWeight: 600, color: farbe, border: `1px solid ${farbe}55`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{text}</span>;

  const zusammen = (
    <Klappe id="ueber-zf" i={1} titel="Zusammenfassung" unter="Aus den Daten gerechnet — die Nummern führen zur Quelle." zu={klappen.istZu('ueber-zf')} umschalten={klappen.umschalten} akzent={LEUCHT.agenten}>
      <div style={{ display: 'grid', gap: 8 }}>
        {zf.saetze.map((s, i) => (
          <p key={i} style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.55, color: C.ink }}>
            {s.text}
            {s.quellen.map(nr => {
              const q = zf.quellen[nr - 1];
              const springt = q.art !== 'feld' || q.feld === 'naechsterSchritt';
              return springt
                ? <button key={nr} type="button" onClick={() => zurQuelle(q)} title={`Quelle ${nummer(nr)}: ${q.label}`} aria-label={`Quelle ${nr}: ${q.label}`} className="fassbar"
                    style={{ background: 'none', border: 'none', padding: '0 1px', marginLeft: 2, cursor: 'pointer', color: LEUCHT.agenten, fontSize: 14, fontFamily: SCHRIFT.text, lineHeight: 1 }}>{nummer(nr)}</button>
                : <span key={nr} title={q.label} style={{ color: C.inkLeise, fontSize: 14, marginLeft: 3 }}>{nummer(nr)}</span>;
            })}
          </p>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={frage} onChange={e => setFrage(e.target.value)} maxLength={500} placeholder="Frage stellen — z. B. „Was hat sie zuletzt gebraucht?“" aria-label="Frage an ZOE zu dieser Person"
            onKeyDown={e => { if (e.key === 'Enter') void fragen(true); }} style={{ ...feld, flex: '1 1 220px', minWidth: 0, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <Knopf leise aus={!frage.trim() || antwort === 'laedt'} onClick={() => void fragen(true)}>Fragen</Knopf>
          {ki?.ki && <Knopf leise aus={antwort === 'laedt'} onClick={() => void fragen(false)}>Mit ZOE formulieren</Knopf>}
        </div>
        {antwort === 'laedt' && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>ZOE liest die Daten …</div>}
        {antwort && antwort !== 'laedt' && (
          <div role="status" style={{ padding: '10px 12px', borderRadius: 10, background: antwort.art === 'ok' ? `${LEUCHT.agenten}12` : 'rgba(255,255,255,.04)', fontSize: TYP.bedien, lineHeight: 1.55, color: antwort.art === 'ok' ? C.ink : C.inkDim, whiteSpace: 'pre-wrap' }}>
            {antwort.text}
            {antwort.art === 'ok' && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>ZOE · nur aus den Daten dieser Person, ohne private Notiz · nichts gespeichert</div>}
          </div>
        )}
      </div>
    </Klappe>
  );

  const schritt = (
    <Klappe id="ueber-schritt" i={2} titel="Nächster Schritt" zu={klappen.istZu('ueber-schritt')} umschalten={klappen.umschalten}
      akzent={!k.naechsterSchritt ? LEUCHT.achtung : k.naechsterSchritt.datum < heute ? LEUCHT.kritisch : undefined}>
      <div id="kontakt-schritt"><NaechsterSchrittTeil k={k} heute={heute} setze={setze} /></div>
    </Klappe>
  );

  const leadKarte = (
    <Klappe id="ueber-lead" i={3} titel="Lead-Qualifizierung" unter={`${statusLabel(status)}${lead ? '' : ' (abgeleitet)'}${firma ? ` · an der Firma ${firma.name}` : ''}`} zu={klappen.istZu('ueber-lead')} umschalten={klappen.umschalten}
      rechts={<button type="button" onClick={() => setLeadOffen(!leadOffen)} style={leiseKnopf}>{leadOffen ? 'weniger' : 'Qualifizieren ›'}</button>}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span title={score.teile.map(x => `${x.label} ${x.punkte}/${x.max} — ${x.grund}`).join('\n')}>{chip(`Score ${score.punkte} · ${temperaturLabel(score.temperatur)}`, temperaturFarbe(score.temperatur))}</span>
        {score.scoring && <SeitenChip s={score.scoring.marketing} name="MQL" kurz />}
        {score.scoring && <SeitenChip s={score.scoring.sales} name="SQL" kurz />}
      </div>
      {score.scoring && (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8, lineHeight: 1.5 }}>
          Score {score.punkte} · Sales {score.scoring.sales.punkte} / Schwelle {score.scoring.sales.schwelle}{zeile && !salesBereit(zeile) && status !== 'sql' && status !== 'kunde' ? ` — fehlt: ${fehltBisSqlZeile(zeile).join(', ')}` : ' — SQL-Kriterien erfüllt'}
          {' '}<button type="button" onClick={() => router.push(qualifizierungLink(k.firmaId ?? k.id))} style={leiseKnopf}>In der Runde qualifizieren ›</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '4px 12px', marginTop: 10 }}>
        {(score.scoring?.sales.teile.flatMap(t => t.kriterien).filter(x => x.quelle === 'frage') ?? []).map(x => (
          <span key={x.id} title={`${x.name}: ${x.stufeText ?? 'offen'}`} aria-label={`${x.name}: ${x.stufeText ?? 'offen'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: TYP.bedien, color: x.offen ? C.inkLeise : C.ink }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: x.offen || !x.beantwortet ? QUAL_FARBE.unklar : x.punkte >= x.max * 0.6 ? QUAL_FARBE.ja : x.punkte > 0 ? QUAL_FARBE.unklar : QUAL_FARBE.nein, flex: '0 0 auto' }} />{x.name}
          </span>
        ))}
      </div>
      {leadOffen && <div style={{ marginTop: 12 }}><LeadBlock api={api} leadId={k.firmaId ?? k.id} /></div>}
    </Klappe>
  );

  const beziehung = (
    <Klappe id="ueber-beziehung" i={4} titel="Beziehung" zu={klappen.istZu('ueber-beziehung')} umschalten={klappen.umschalten}
      rechts={<button type="button" onClick={() => zuReiter('daten')} style={leiseKnopf}>Alles zur Beziehung ›</button>}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {chip(k.kreis ? `Kreis ${k.kreis}${tk ? ` · alle ${tk.tage} T` : ''}` : 'kein Kreis', k.kreis ? LEUCHT.beziehung : C.inkLeise)}
        {chip(phaseLabel(ph.phase), phaseFarbe(ph.phase))}
        {rollenVon(k).map(r => <span key={r}>{chip(ROLLE_LABEL[r], LEUCHT.business)}</span>)}
        {chip(STUFE_LABEL[k.stufe], C.inkDim)}{k.anrede && chip(k.anrede, C.inkDim)}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: C.inkLeise }}><Person id={haeltBeziehung(k)} groesse={16} />zuständig: {nameVon(haeltBeziehung(k))}</span>
      </div>
      {tk && <div style={{ fontSize: TYP.bedien, color: tk.ueberfaellig ? LEUCHT.achtung : C.inkLeise, marginTop: 8 }}>{tk.ueberfaellig ? 'Takt überschritten — jetzt melden.' : `Nach dem Takt fällig ${datum(tk.faelligAm, heute)}.`}{tk.seit !== null ? ` Seit ${tk.seit} Tagen still.` : ''}</div>}
    </Klappe>
  );

  const echte = (k.aktivitaeten ?? []).filter(a => a.art !== 'system' && a.von !== 'system');
  const letzte = echte.slice(-3);
  const aktivitaeten = (
    <Klappe id="ueber-letzte" i={5} titel="Letzte Aktivitäten" unter={echte.length ? `${letzte.length} von ${echte.length}` : 'Noch nichts festgehalten.'} zu={klappen.istZu('ueber-letzte')} umschalten={klappen.umschalten}
      rechts={<button type="button" onClick={() => zuReiter('aktivitaeten', 'alle')} style={leiseKnopf}>alle ›</button>}>
      {letzte.length ? <Verlauf liste={letzte} name={name} heute={heute} max={3} termine={terminZeiten} /> : <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Links über die Schnellaktionen festhalten: Notiz, Anruf, Meeting.</div>}
    </Klappe>
  );

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {zusammen}
      {breit ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>{schritt}{leadKarte}</div>
          <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>{aktivitaeten}{beziehung}</div>
        </div>
      ) : <>{schritt}{aktivitaeten}{leadKarte}{beziehung}</>}
    </div>
  );
}
