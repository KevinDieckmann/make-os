'use client';

// ─── Markttraktion · Qualifizierung (Runde, 27.09.; umgebaut 03.10.) ──────────────────────────
// Kevin: „Ein Knopf neben Sales: Qualifizierungsrunde. Es ploppen die Leads auf, für die ich zuständig bin und die noch
// qualifiziert werden müssen.“ Seit 03.10. („derbe reingehen“):
//   · SEITENFENSTER: Kontakt und Firma öffnen rechts (am Handy als Blatt von unten) mit der vollen Bearbeitung — man bleibt an
//     seiner Stelle in der Runde; nach dem Speichern rechnet der Score sofort neu (die Runde liest Kartei und CRM live).
//   · Je Karte nur das Wichtigste: Kontakt, Firma, „Gespräch starten“ — der Rest hinter „Mehr ⋯“: Firma wechseln/neu,
//     Zusammenführen, weitere Person, Abgeben, Parken, Raus.
//   · Fragen und Stufen kommen aus den Sales-Scoring-Einstellungen; Score, MQL- und SQL-Stand überall dieselbe Rechnung.
//   · Herkunft an jeder Karte (Event, Make.One, Kampagne, Empfehlung, Foto der Visitenkarte, Sprachnotiz, letzte Aktivität).
//   · Gesprächsmodus fürs Telefonat: Fragen der Reihe nach, Notizen nebenbei, am Ende das Ergebnis.
// Logik: lib/crm/leads.ts (zuQualifizieren), lib/crm/scoring.ts; Schreibwege über /api/crm/lead.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { localDay } from '@/lib/zeit';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import { statusLabel, zuQualifizieren, type LeadZeile, type RundenFilter } from '@/lib/crm/leads';
import { kanalLeistung, temperaturFarbe, temperaturLeistung, KANAL, type KanalId } from '@/lib/crm/score';
import { type ScoringEinstellungen } from '@/lib/crm/scoring';
import { herkunftVon } from '@/lib/crm/herkunft';
import { leadGruende, type LeadGruende } from '@/lib/crm/lead-grund';
import { MINDESTMENGE } from '@/lib/crm/deal-auswertung';
import { kontaktAkte, markttraktion } from '@/lib/crm/adresse';
import { TEAM, anderer, nameVon } from '@/lib/crm/team';
import { type CrmApi, datum, holeMitStand } from './daten';
import { Pillen } from './teile';
import { Person } from './team';
import { beanFuerLead } from '@/lib/crm/bean';
import { BeanBadge, BEAN_FARBE, useOffeneAngebote } from './bean-teile';
import { useLeadZeilen, useScoringEinstellungen, useSchmal, useAblage, leadPost } from './quali/hilfen';
import { SEITENBLATT_BREITE } from './quali/Seitenblatt';
import { KontaktSeitenfenster, FirmaSeitenfenster } from './quali/SeitenfensterInhalt';
import { ScoreKopf } from './quali/ScoreAnzeige';
import { Fragen } from './quali/Fragen';
import { HerkunftBlock } from './quali/HerkunftBlock';
import { MehrMenue } from './quali/MehrMenue';
import { FirmaWechselnDialog, type FertigInfo, type NachziehenVorgabe } from './quali/FirmaWechseln';
import { ZusammenfuehrenDialog } from './quali/Zusammenfuehren';
import { WeiterePersonDialog } from './quali/WeiterePerson';
import { AbgebenDialog, ParkenDialog, RausDialog, type WeiterInfo } from './quali/KleineDialoge';
import { Gespraechsmodus } from './quali/Gespraechsmodus';
import { useLeadFragen } from './quali/useLeadFragen';

interface Daten { leads: LeadZeile[] }
type Panel = { art: 'kontakt' | 'firma'; id: string; startFirma?: string } | null;

export function Qualifizierung({ api, start, zuLeads }: { api: CrmApi; start?: string | null; zuLeads: (id?: string) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const ich = api.ich ?? TEAM[0].id;
  const schmal = useSchmal();
  const roh = useLeadZeilen(api);
  // BEAN (28.09., H4): je Lead mit den offenen Angeboten der Dateiablage nachgerechnet — für die Filter-Pille „Neu“.
  const angebote = useOffeneAngebote();
  const d = useMemo<Daten | null>(() => (roh ? { leads: roh.map(z => { const b = beanFuerLead(z, api.crm?.stand, api.kontakte ?? [], { angebote }); return b && b.bean !== z.bean ? { ...z, bean: b.bean } : z; }) } : null), [roh, api.crm, api.kontakte, angebote]);
  const einstellungen = useScoringEinstellungen(api);

  const [wer, setWer] = useState<RundenFilter['wer']>(ich);
  useEffect(() => { setWer(w => (w === TEAM[0].id && ich !== TEAM[0].id ? ich : w)); }, [ich]);
  const [auchKalt, setAuchKalt] = useState(false);
  const [kanal, setKanal] = useState<KanalId | ''>('');
  // Standard der Runde bleibt wie bisher; die Pille „Neu“ grenzt zusätzlich auf BEAN N ein (Leads zum Qualifizieren).
  const [nurNeu, setNurNeu] = useState(false);
  // Die Reihenfolge steht beim Start der Runde fest — jede Antwort würde sie sonst umsortieren.
  const [reihe, setReihe] = useState<string[] | null>(null);
  const [pos, setPos] = useState(0);
  const [erledigt, setErledigt] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [meldung, setMeldung] = useState('');
  const [nachziehen, setNachziehen] = useState<NachziehenVorgabe | null>(null);
  const filterKey = `${wer}|${auchKalt}|${kanal}|${nurNeu}`;
  const passend = useMemo(() => (d ? zuQualifizieren(d.leads, { wer, auchKalt, ...(kanal ? { kanal } : {}), ...(nurNeu ? { bean: 'N' as const } : {}), heute }) : []), [d, wer, auchKalt, kanal, nurNeu, heute]);
  const nachId = useMemo(() => new Map((d?.leads ?? []).map(z => [z.id, z])), [d]);
  // Ein Sprung aus der Akte (`start`: Firma oder Person) setzt diesen Lead an den Anfang — auch wenn er sonst nicht dran wäre.
  const startZeile = useMemo(() => (start && d ? d.leads.find(z => z.id === start || z.personen.some(p => p.id === start)) : undefined), [start, d]);
  const startKey = startZeile?.id ?? '';
  useEffect(() => { setReihe(null); setPos(0); setErledigt(0); setPanel(null); }, [filterKey, startKey]);
  useEffect(() => { if (!reihe && d) setReihe([...(startZeile ? [startZeile.id] : []), ...passend.map(z => z.id).filter(id => id !== startZeile?.id)]); }, [reihe, d, passend, startZeile]);
  const karten = (reihe ?? []).map(id => nachId.get(id)).filter((z): z is LeadZeile => !!z);
  const z = karten[pos];
  const weiter = useCallback((fertig: boolean) => { if (fertig) setErledigt(n => n + 1); setPos(p => Math.min(p + 1, karten.length)); setPanel(null); }, [karten.length]);
  /** Der Lead heißt jetzt anders (Firma gewechselt, zusammengeführt): die Karte tauscht ihren Platz, die Runde bleibt an ihrer Stelle. */
  const ersetze = useCallback((neuId: string) => setReihe(r => { if (!r) return r; const neu = r.slice(); neu[pos] = neuId; return neu.filter((x, i) => x !== neuId || i === pos); }), [pos]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setPos(p => Math.min(p + 1, karten.length)); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPos(p => Math.max(p - 1, 0)); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [karten.length]);

  const zaehl = (w: RundenFilter['wer']) => (d ? zuQualifizieren(d.leads, { wer: w, auchKalt, ...(kanal ? { kanal } : {}), ...(nurNeu ? { bean: 'N' as const } : {}), heute }).length : 0);
  const neuZahl = d ? zuQualifizieren(d.leads, { wer, auchKalt, ...(kanal ? { kanal } : {}), bean: 'N', heute }).length : 0;
  const andere = anderer(ich);
  const WER: { id: RundenFilter['wer']; label: string }[] = [
    { id: ich, label: `Meine ${zaehl(ich)}` }, { id: andere, label: `${nameVon(andere)} ${zaehl(andere)}` },
    { id: 'ohne', label: `Nicht zugeordnet ${zaehl('ohne')}` }, { id: 'alle', label: `Alle ${zaehl('alle')}` },
  ];
  const kanaele = useMemo(() => kanalLeistung(d?.leads ?? []), [d]);
  const offen = panel && !schmal;

  return (
    <>
      <div style={{ display: 'grid', gap: 14, marginRight: offen ? SEITENBLATT_BREITE + 16 : 0, transition: 'margin .2s ease' }}>
        <Karte i={0} akzent={LEUCHT.business}>
          <Ueberschrift farbe={LEUCHT.business} rechts={karten.length ? <span style={{ fontSize: 12.5, color: C.inkLeise }}>{Math.min(pos + 1, karten.length)} von {karten.length}{erledigt ? ` · ${erledigt} geprüft` : ''}</span> : undefined}>Qualifizierungsrunde</Ueberschrift>
          <div style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.55, marginBottom: 10 }}>Lead für Lead: woher er kommt, wie weit er ist, die Fragen — und im Gespräch Schritt für Schritt bis zum Ergebnis. Kontakt und Firma öffnen rechts zur Bearbeitung; wer qualifiziert, übernimmt nicht zugeordnete Leads. Kalte Leads warten im Marketing-Segment „Vernetzen“, bis sie warm werden.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={WER} aktiv={wer} onWahl={setWer} farbe={LEUCHT.business} /></div>
            <button type="button" onClick={() => setNurNeu(!nurNeu)} aria-pressed={nurNeu} title="BEAN „Neu“: kein Mandat, kein offenes Angebot — Leads zum Qualifizieren" className="fassbar"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', minHeight: 36, borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${nurNeu ? BEAN_FARBE.N : 'rgba(255,255,255,.14)'}`, background: nurNeu ? `${BEAN_FARBE.N}1F` : 'transparent', color: nurNeu ? BEAN_FARBE.N : C.inkDim }}>
              <BeanBadge bean="N" vonHand={nurNeu} /> Neu {neuZahl}
            </button>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim, cursor: 'pointer', minHeight: 36 }}><input type="checkbox" checked={auchKalt} onChange={e => setAuchKalt(e.target.checked)} /> auch kalte</label>
            <select value={kanal} onChange={e => setKanal(e.target.value as KanalId | '')} aria-label="Kanal" style={{ ...feld, fontSize: 12.5, padding: '6px 10px', width: 'auto', minHeight: 36 }}>
              <option value="">Jeder Kanal</option>
              {KANAL.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
            {karten.length > 0 && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}><Knopf leise aus={pos === 0} onClick={() => setPos(p => Math.max(0, p - 1))}>← Zurück</Knopf><Knopf leise aus={pos >= karten.length} onClick={() => setPos(p => Math.min(karten.length, p + 1))}>Weiter →</Knopf></span>}
          </div>
          {start && d && !startZeile && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, marginTop: 8 }}>Zu diesem Eintrag gibt es keinen Lead (Dienstleister, Investor oder eingeschränkt) — die Runde zeigt die übrigen.</div>}
        </Karte>

        {meldung && (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: `${LEUCHT.gut}14`, border: `1px solid ${LEUCHT.gut}44`, fontSize: TYP.bedien, lineHeight: 1.5 }}>
            <span style={{ flex: 1 }}>✓ {meldung}</span>
            <button onClick={() => setMeldung('')} aria-label="Hinweis schließen" className="fassbar" style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: 'none', color: C.inkDim, cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
        )}

        {!d && <Karte i={1}><Leer>Lädt die Leads …</Leer></Karte>}
        {d && !karten.length && (
          <Karte i={1} akzent={LEUCHT.gut}>
            <Leer>{wer === ich ? 'Alle deine Leads sind qualifiziert oder frisch geprüft. Nächste Runde in 60 Tagen — oder „Nicht zugeordnet“ öffnen.' : 'Hier wartet gerade nichts.'}</Leer>
          </Karte>
        )}
        {d && karten.length > 0 && !z && (
          <Karte i={1} akzent={LEUCHT.gut}>
            <Ueberschrift farbe={LEUCHT.gut}>Runde fertig</Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>{erledigt} von {karten.length} geprüft. Übersprungene kommen beim nächsten Start wieder.</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}><Knopf onClick={() => { setReihe(null); setPos(0); setErledigt(0); }}>Neue Runde</Knopf><Knopf leise onClick={() => zuLeads()}>Zu den Leads</Knopf></div>
          </Karte>
        )}
        {z && <QualiKarte key={z.id} z={z} api={api} einstellungen={einstellungen} ich={ich} heute={heute} weiter={weiter} ersetze={ersetze} zuLeads={zuLeads}
          oeffneKontakt={id => setPanel({ art: 'kontakt', id, startFirma: (api.kontakte ?? []).find(k => k.id === id)?.firmaId })} oeffneFirma={id => setPanel({ art: 'firma', id })} meldeFertig={setMeldung} />}

        <KanalLeistung zeilen={kanaele} i={2} />
        {d && <GruendeKarte g={leadGruende(d.leads)} i={3} />}
      </div>

      {panel?.art === 'kontakt' && <KontaktSeitenfenster key={`k-${panel.id}`} api={api} kontaktId={panel.id} startFirmaId={panel.startFirma} onZu={() => setPanel(null)} zuFirma={id => setPanel({ art: 'firma', id })}
        onFirmaGeaendert={(von, nach, personId) => setNachziehen({ von, nach, personId })} />}
      {panel?.art === 'firma' && <FirmaSeitenfenster key={`f-${panel.id}`} api={api} firmaId={panel.id} onZu={() => setPanel(null)} zuKontakt={id => setPanel({ art: 'kontakt', id, startFirma: (api.kontakte ?? []).find(k => k.id === id)?.firmaId })} zuFirma={id => setPanel({ art: 'firma', id })} />}
      {nachziehen && z && <FirmaWechselnDialog api={api} z={z} nachziehen={nachziehen} onZu={() => setNachziehen(null)} onFertig={i => { setNachziehen(null); setMeldung(i.text); if (i.neuerLeadId) ersetze(i.neuerLeadId); }} />}
    </>
  );
}

// ── Die Karte je Lead ────────────────────────────────────────────────────────────────────────
function QualiKarte({ z, api, einstellungen, ich, heute, weiter, ersetze, zuLeads, oeffneKontakt, oeffneFirma, meldeFertig }: {
  z: LeadZeile; api: CrmApi; einstellungen: ScoringEinstellungen; ich: string; heute: string; weiter: (fertig: boolean) => void; ersetze: (neuId: string) => void;
  zuLeads: (id?: string) => void; oeffneKontakt: (id: string) => void; oeffneFirma: (id: string) => void; meldeFertig: (text: string) => void;
}) {
  const router = useRouter();
  const { lokal, antworten, score, fehler, setFehler, speichern, stufeWaehlen, antwortSpeichern, bereit, fehlt } = useLeadFragen(api, z, einstellungen);
  const [notiz, setNotiz] = useState(z.notiz ?? '');
  const [werkzeug, setWerkzeug] = useState<'firma' | 'zusammen' | 'person' | 'abgeben' | 'parken' | 'raus' | 'gespraech' | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const personen = useMemo(() => z.personen.map(p => (api.kontakte ?? []).find(x => x.id === p.id)).filter((x): x is NonNullable<typeof x> => !!x), [z.personen, api.kontakte]);
  const haupt = z.personen.find(p => p.id === z.hauptKontaktId) ?? z.personen[0];
  const ablage = useAblage(haupt ? [haupt.id, ...z.personen.filter(p => p.id !== haupt.id).slice(0, 3).map(p => p.id)] : []);
  const herkunftMitDateien = useMemo(() => herkunftVon(personen, api.crm?.stand ?? { events: [], teilnahmen: [], kampagnen: [], firmen: [] }, ablage), [personen, api.crm, ablage]);

  const geprueft = async () => {
    setLaeuft(true);
    const ok = await speichern({ geprueft: true, ...(notiz !== (z.notiz ?? '') ? { notiz } : {}) });
    setLaeuft(false);
    if (ok) { void api.laden(true); weiter(true); }
  };
  const uebernehmen = async () => { const r = await leadPost({ aktion: 'uebernehmen', id: z.id, an: ich }); if (r.ok) { meldeFertig(`Übernommen — jetzt gehört der Lead ${nameVon(ich)}.`); void api.laden(true); } else setFehler(r.fehler ?? 'Nicht übernommen.'); };
  const fertig = (i: FertigInfo) => { setWerkzeug(null); meldeFertig(i.text); if (i.neuerLeadId) ersetze(i.neuerLeadId); };
  const weiterNach = (i: WeiterInfo) => { setWerkzeug(null); meldeFertig(i.text); if (i.weiter) weiter(true); };
  const firma = z.firmaId ? api.crm?.stand.firmen.find(f => f.id === z.firmaId) : undefined;

  return (
    <Karte i={1} akzent={temperaturFarbe(score.temperatur)}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 6 }}>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-.015em', overflowWrap: 'anywhere' }}>{z.name}</div>
            <div style={{ fontSize: 12.5, color: C.inkDim }}>{[z.art === 'firma' ? 'Firma' : 'Person ohne Firma', z.branche, z.stadt, statusLabel(z.status)].filter(Boolean).join(' · ')}{z.status === 'ruht' && z.wiedervorlage ? ` · Wiedervorlage ${datum(z.wiedervorlage, heute)}` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {z.ohneBesitzer ? <Chip farbe={LEUCHT.achtung}>ohne Besitzer</Chip> : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}><Person id={z.besitzer} groesse={18} /> {nameVon(z.besitzer)}</span>}
              {z.personen.length > 1 && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{z.personen.length} Personen</span>}
            </div>
          </div>
          <div style={{ flex: '1 1 300px' }}><ScoreKopf score={score} /></div>
        </div>

        <HerkunftBlock h={herkunftMitDateien} heute={heute} personName={id => z.personen.find(p => p.id === id)?.name ?? ''} />

        {z.deal && <div style={{ padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.gut}14`, fontSize: TYP.bedien }}>Deal „{z.deal.titel}“ läuft unter Deals — hier nur noch die Fragen nachziehen.</div>}

        {/* Das Wichtigste: Kontakt · Firma · Gespräch starten */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {haupt && <button type="button" onClick={() => oeffneKontakt(haupt.id)} className="fassbar" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)' }}>Kontakt ▸ {haupt.name}{haupt.position ? <span style={{ color: C.inkLeise, fontWeight: 500 }}> · {haupt.position.slice(0, 28)}</span> : null}</button>}
          {firma && <button type="button" onClick={() => oeffneFirma(firma.id)} className="fassbar" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: C.ink, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)' }}>Firma ▸ {firma.name}</button>}
          <Knopf farbe={LEUCHT.business} onClick={() => setWerkzeug('gespraech')}>Gespräch starten</Knopf>
        </div>

        <div>
          <Ueberschrift rechts={<span style={{ fontSize: 12, color: bereit ? LEUCHT.gut : C.inkLeise }}>{bereit ? 'SQL-bereit' : `bis SQL fehlt: ${fehlt.join(', ') || '—'}`}</span>}>Fragen</Ueberschrift>
          <Fragen einstellungen={einstellungen} score={score} stufen={lokal.stufen} antworten={antworten} onStufe={stufeWaehlen} onAntwort={antwortSpeichern} />
        </div>

        <div>
          <Ueberschrift>Notiz zum Lead</Ueberschrift>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (z.notiz ?? '')) void speichern({ notiz }); }} rows={2} maxLength={2000} placeholder="Was man wissen muss, bevor man anruft …" aria-label="Notiz zum Lead" style={{ ...feld, fontSize: 16, padding: '8px 11px', width: '100%', resize: 'vertical' }} />
        </div>

        {fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf onClick={() => geprueft()} aus={laeuft}>Geprüft → nächster</Knopf>
          {bereit && !z.deal?.offen && <Knopf farbe={LEUCHT.gut} onClick={() => zuLeads(z.id)}>SQL → Deal anlegen</Knopf>}
          <Knopf leise onClick={() => weiter(false)}>Später</Knopf>
          <span style={{ marginLeft: 'auto' }}>
            <MehrMenue punkte={[
              { id: 'firma', label: 'Firma wechseln oder neu …', hinweis: 'Jobwechsel, falsche Firma — Lead und Deals ziehen mit', onClick: () => setWerkzeug('firma') },
              { id: 'zusammen', label: 'Zusammenführen …', hinweis: 'Dublette bei Personen oder Firmen, mit Vorschau', onClick: () => setWerkzeug('zusammen') },
              { id: 'person', label: 'Weitere Person dazu …', hinweis: 'neuer Ansprechpartner, z. B. der Entscheider', onClick: () => setWerkzeug('person') },
              ...(z.ohneBesitzer ? [{ id: 'uebernehmen', label: `Übernehmen (${nameVon(ich)})`, hinweis: 'der Lead gehört noch niemandem', onClick: () => void uebernehmen() }] : []),
              { id: 'abgeben', label: 'Abgeben …', hinweis: 'an Kevin oder Malin, mit Aufgabe', onClick: () => setWerkzeug('abgeben') },
              { id: 'parken', label: 'Parken …', hinweis: 'ruht bis zur Wiedervorlage, dann zurück in die Runde', onClick: () => setWerkzeug('parken') },
              { id: 'raus', label: 'Raus — Kein Fit …', hinweis: 'mit Grund, der in die Auswertung fließt', gefahr: true, onClick: () => setWerkzeug('raus') },
              { id: 'akte', label: 'Akte ganz öffnen ›', hinweis: z.firmaId ? 'die Firmenakte' : 'die Kontaktakte', onClick: () => router.push(z.firmaId ? markttraktion('firmen', undefined, z.firmaId) : haupt ? kontaktAkte(haupt.id) : markttraktion('kontakte')) },
            ]} />
          </span>
        </div>
      </div>
      {werkzeug === 'firma' && <FirmaWechselnDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={fertig} />}
      {werkzeug === 'zusammen' && <ZusammenfuehrenDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={fertig} />}
      {werkzeug === 'person' && <WeiterePersonDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={fertig} />}
      {werkzeug === 'abgeben' && <AbgebenDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={weiterNach} />}
      {werkzeug === 'parken' && <ParkenDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={weiterNach} />}
      {werkzeug === 'raus' && <RausDialog api={api} z={z} onZu={() => setWerkzeug(null)} onFertig={weiterNach} />}
      {werkzeug === 'gespraech' && <Gespraechsmodus api={api} z={{ ...z, kriterien: lokal.kriterien }} einstellungen={einstellungen} score={score} stufen={lokal.stufen} antworten={antworten} onStufe={stufeWaehlen} onAntwort={antwortSpeichern} onZu={() => setWerkzeug(null)} onFertig={weiterNach} />}
    </Karte>
  );
}

/** Warum Leads ausscheiden oder warten — die Auswertung der Gründe aus „Raus“ und „Parken“. */
export function GruendeKarte({ g, i = 0 }: { g: LeadGruende; i?: number }) {
  if (!g.nAus && !g.nGeparkt) return null;
  const max = Math.max(1, ...g.ausgeschieden.map(x => x.anzahl), ...g.geparkt.map(x => x.anzahl));
  const liste = (titel: string, z: LeadGruende['ausgeschieden'], farbe: string) => z.length > 0 && (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 }}>{titel}</div>
      {z.map(x => (
        <div key={x.art} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1.4fr) 1fr auto', gap: 10, alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ color: x.art === 'ohne' ? C.inkLeise : C.ink }}>{x.label}</span>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}><div style={{ width: `${(100 * x.anzahl) / max}%`, height: '100%', background: farbe }} /></div>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>{x.anzahl}</span>
        </div>
      ))}
    </div>
  );
  return (
    <Karte i={i}>
      <Ueberschrift rechts={<span>{g.nAus} raus · {g.nGeparkt} geparkt</span>}>Warum Leads ausscheiden oder warten</Ueberschrift>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 10, lineHeight: 1.5 }}>Aus „Raus — Kein Fit“ und „Parken“: die feste Art des Grundes. „Ohne Angabe“ sind ältere Leads oder verlorene Deals.</div>
      <div style={{ display: 'grid', gap: 16 }}>{liste('Ausgeschieden (Kein Fit)', g.ausgeschieden, LEUCHT.kritisch)}{liste('Geparkt (ruht)', g.geparkt, LEUCHT.achtung)}</div>
    </Karte>
  );
}

/** Kanal-Leistung: welcher Weg warme Leads und SQLs bringt — für Runde, Sales-Auswertung und Marketing. */
export function KanalLeistung({ zeilen, i = 0, titel = 'Kanal-Leistung', rechts }: { zeilen: ReturnType<typeof kanalLeistung>; i?: number; titel?: string; rechts?: ReactNode }) {
  if (!zeilen.length) return null;
  const max = Math.max(1, ...zeilen.map(z => z.anzahl));
  return (
    <Karte i={i}>
      <Ueberschrift rechts={rechts}>{titel}</Ueberschrift>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8, lineHeight: 1.5 }}>Je Herkunftskanal: wie viele Leads, wie viele davon warm oder heiß, wie viele wurden SQL oder Kunde.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) 1fr auto auto auto', gap: '6px 12px', alignItems: 'center', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: C.inkLeise, fontSize: 11.5 }}>Kanal</span><span />
        <span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>Leads</span><span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>warm+</span><span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>SQL</span>
        {zeilen.map(z => (
          <ContainerZeile key={z.kanal}>
            <span>{z.label}</span>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${(100 * z.warm) / max}%`, background: LEUCHT.business }} />
              <div style={{ width: `${(100 * (z.anzahl - z.warm)) / max}%`, background: 'rgba(255,255,255,.14)' }} />
            </div>
            <span style={{ textAlign: 'right' }}>{z.anzahl}</span>
            <span style={{ textAlign: 'right', color: z.warm ? C.ink : C.inkLeise }}>{z.warm} <span style={{ color: C.inkLeise }}>({z.warmQuote} %)</span></span>
            <span style={{ textAlign: 'right', color: z.sql ? LEUCHT.gut : C.inkLeise }}>{z.sql} <span style={{ color: C.inkLeise }}>({z.sqlQuote} %)</span></span>
          </ContainerZeile>
        ))}
      </div>
    </Karte>
  );
}
const ContainerZeile = ({ children }: { children: ReactNode }) => <>{children}</>;

/**
 * SQL- und Gewinnquote je Temperatur (28.09., K4) — trägt die Temperatur, was sie verspricht? Quoten erst ab
 * MINDESTMENGE Leads je Temperatur; darunter nur die Anzahlen.
 */
export function TemperaturLeistung({ zeilen, i = 0 }: { zeilen: ReturnType<typeof temperaturLeistung>; i?: number }) {
  if (!zeilen.some(z => z.anzahl)) return null;
  return (
    <Karte i={i}>
      <Ueberschrift>SQL- und Gewinnquote je Temperatur</Ueberschrift>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8, lineHeight: 1.5 }}>Je Temperatur: wie viele Leads, wie viele wurden SQL oder Kunde, wie viele gewonnen. Quoten ab {MINDESTMENGE} Leads.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 120px) auto auto auto', gap: '6px 12px', alignItems: 'center', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: C.inkLeise, fontSize: 11.5 }}>Temperatur</span>
        <span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>Leads</span><span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>SQL</span><span style={{ color: C.inkLeise, fontSize: 11.5, textAlign: 'right' }}>gewonnen</span>
        {zeilen.map(z => (
          <ContainerZeile key={z.temperatur}>
            <span style={{ color: temperaturFarbe(z.temperatur) }}>{z.label}</span>
            <span style={{ textAlign: 'right' }}>{z.anzahl}</span>
            <span style={{ textAlign: 'right', color: z.sql ? LEUCHT.gut : C.inkLeise }}>{z.sql}{z.sqlQuote !== null ? <span style={{ color: C.inkLeise }}> ({z.sqlQuote} %)</span> : null}</span>
            <span style={{ textAlign: 'right', color: z.gewonnen ? LEUCHT.gut : C.inkLeise }}>{z.gewonnen}{z.gewinnQuote !== null ? <span style={{ color: C.inkLeise }}> ({z.gewinnQuote} %)</span> : null}</span>
          </ContainerZeile>
        ))}
      </div>
    </Karte>
  );
}

/** Kanal-Leistung mit eigenem Laden — für Sales › Auswertung und Marketing; `mitTemperatur` zeigt dazu die Quoten je Temperatur. */
export function KanalLeistungLaden({ i = 0, mitTemperatur = false }: { i?: number; mitTemperatur?: boolean }) {
  const [leads, setLeads] = useState<LeadZeile[]>([]);
  const staende = useRef(new Map<string, string>());
  useEffect(() => { void holeMitStand<Daten & { ok?: boolean }>('/api/crm/lead', staende.current).then(x => { if (x?.ok) setLeads(x.leads); }).catch(() => undefined); }, []);
  const zeilen = useMemo(() => kanalLeistung(leads), [leads]);
  const temperatur = useMemo(() => temperaturLeistung(leads), [leads]);
  const gruende = useMemo(() => leadGruende(leads), [leads]);
  return <>{<KanalLeistung zeilen={zeilen} i={i} />}{mitTemperatur && <TemperaturLeistung zeilen={temperatur} i={i + 1} />}{mitTemperatur && <GruendeKarte g={gruende} i={i + 2} />}</>;
}
