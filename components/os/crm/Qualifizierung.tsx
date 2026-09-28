'use client';

// ─── Markttraktion · Qualifizierung (Runde, 27.09.) ──────────────────────────
// Kevin: „Ein Knopf neben Sales: Qualifizierungsrunde. Es ploppen die Leads auf,
// für die ich zuständig bin und die noch qualifiziert werden müssen — mit den
// Kernfragen, einem Freitext je Schmerz/Bedarf, dem Lead-Score live, und von
// dort in die Akte.“ Malin sieht ihre Leads zuerst, kann Kevins dazuschalten
// und Leads ohne Besitzer per Klick übernehmen. Logik: lib/crm/leads.ts
// (zuQualifizieren) und lib/crm/score.ts; Schreibwege über /api/crm/lead.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { localDay } from '@/lib/zeit';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Knopf, Chip, feld, LEUCHT } from '../schlank';
import type { Kriterien, Qual } from '@/lib/crm/typen';
import { KRITERIEN, sqlBereit, fehltBisSql, statusLabel, zuQualifizieren, type LeadZeile, type RundenFilter } from '@/lib/crm/leads';
import { leadScore, kanalLeistung, kanalLabel, temperaturLabel, temperaturFarbe, KANAL, type KanalId, type LeadScore } from '@/lib/crm/score';
import { TEAM, anderer, nameVon } from '@/lib/crm/team';
import { type CrmApi, datum, holeMitStand } from './daten';
import { Pillen } from './teile';
import { Person } from './team';
import { useNachfrage } from './Nachfrage';
import { beanFuerLead } from '@/lib/crm/bean';
import { BeanBadge, BEAN_FARBE, useOffeneAngebote } from './bean-teile';

interface Daten { leads: LeadZeile[] }
const Q_FARBE: Record<Qual, string> = { ja: LEUCHT.gut, nein: LEUCHT.kritisch, unklar: C.inkLeise };

export function Qualifizierung({ api, zuKontakt, zuFirma, zuLeads }: { api: CrmApi; zuKontakt: (id: string) => void; zuFirma: (id: string) => void; zuLeads: (id?: string) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const ich = api.ich ?? TEAM[0].id;
  const [roh, setRoh] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState('');
  const staende = useRef(new Map<string, string>());
  const laden = useCallback(() => holeMitStand<Daten & { ok?: boolean; fehler?: string }>('/api/crm/lead', staende.current).then(x => { if (x?.ok) { setRoh(x); setFehler(''); } else if (x && !x.ok) setFehler(x.fehler ?? 'Leads nicht geladen.'); }).catch(() => setFehler('Leads nicht erreichbar.')), []);
  useEffect(() => { void laden(); }, [laden]);
  // BEAN (28.09., H4): je Lead mit den offenen Angeboten der Dateiablage nachgerechnet — für die Filter-Pille „Neu“.
  const angebote = useOffeneAngebote();
  const d = useMemo<Daten | null>(() => (roh ? { leads: roh.leads.map(z => { const b = beanFuerLead(z, api.crm?.stand, api.kontakte ?? [], { angebote }); return b && b.bean !== z.bean ? { ...z, bean: b.bean } : z; }) } : null), [roh, api.crm, api.kontakte, angebote]);

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
  const filterKey = `${wer}|${auchKalt}|${kanal}|${nurNeu}`;
  const passend = useMemo(() => (d ? zuQualifizieren(d.leads, { wer, auchKalt, ...(kanal ? { kanal } : {}), ...(nurNeu ? { bean: 'N' as const } : {}), heute }) : []), [d, wer, auchKalt, kanal, nurNeu, heute]);
  useEffect(() => { setReihe(null); setPos(0); setErledigt(0); }, [filterKey]);
  useEffect(() => { if (!reihe && d) setReihe(passend.map(z => z.id)); }, [reihe, d, passend]);
  const nachId = useMemo(() => new Map((d?.leads ?? []).map(z => [z.id, z])), [d]);
  const karten = (reihe ?? []).map(id => nachId.get(id)).filter((z): z is LeadZeile => !!z);
  const z = karten[pos];
  const weiter = (fertig: boolean) => { if (fertig) setErledigt(n => n + 1); setPos(p => Math.min(p + 1, karten.length)); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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
    { id: 'ohne', label: `Ohne Besitzer ${zaehl('ohne')}` }, { id: 'alle', label: `Alle ${zaehl('alle')}` },
  ];
  const kanaele = useMemo(() => kanalLeistung(d?.leads ?? []), [d]);

  return (
    <>
      <Karte i={0} akzent={LEUCHT.business}>
        <Ueberschrift farbe={LEUCHT.business} rechts={karten.length ? <span style={{ fontSize: 12.5, color: C.inkLeise }}>{Math.min(pos + 1, karten.length)} von {karten.length}{erledigt ? ` · ${erledigt} geprüft` : ''}</span> : undefined}>Qualifizierungsrunde</Ueberschrift>
        <div style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.55, marginBottom: 10 }}>Lead für Lead: die sechs Kernfragen, was genau dahintersteckt, und wie warm es ist. Wer qualifiziert, übernimmt Leads ohne Besitzer. Kalte Leads warten im Marketing-Segment „Vernetzen“, bis sie warm werden.</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ overflowX: 'auto', scrollbarWidth: 'none' }}><Pillen einzeilig liste={WER} aktiv={wer} onWahl={setWer} farbe={LEUCHT.business} /></div>
          <button type="button" onClick={() => setNurNeu(!nurNeu)} aria-pressed={nurNeu} title="BEAN „Neu“: kein Mandat, kein offenes Angebot — Leads zum Qualifizieren" className="fassbar"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 600,
              border: `1px solid ${nurNeu ? BEAN_FARBE.N : 'rgba(255,255,255,.14)'}`, background: nurNeu ? `${BEAN_FARBE.N}1F` : 'transparent', color: nurNeu ? BEAN_FARBE.N : C.inkDim }}>
            <BeanBadge bean="N" vonHand={nurNeu} /> Neu {neuZahl}
          </button>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim, cursor: 'pointer' }}><input type="checkbox" checked={auchKalt} onChange={e => setAuchKalt(e.target.checked)} /> auch kalte</label>
          <select value={kanal} onChange={e => setKanal(e.target.value as KanalId | '')} aria-label="Kanal" style={{ ...feld, fontSize: 12.5, padding: '6px 10px', width: 'auto' }}>
            <option value="">Jeder Kanal</option>
            {KANAL.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          {karten.length > 0 && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6 }}><Knopf leise aus={pos === 0} onClick={() => setPos(p => Math.max(0, p - 1))}>← Zurück</Knopf><Knopf leise aus={pos >= karten.length} onClick={() => setPos(p => Math.min(karten.length, p + 1))}>Weiter →</Knopf></span>}
        </div>
        {fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien, marginTop: 8 }}>{fehler} <Knopf leise onClick={() => void laden()}>Noch einmal</Knopf></div>}
      </Karte>

      {!d && !fehler && <Karte i={1}><Leer>Lädt die Leads …</Leer></Karte>}
      {d && !karten.length && (
        <Karte i={1} akzent={LEUCHT.gut}>
          <Leer>{wer === ich ? 'Alle deine Leads sind qualifiziert oder frisch geprüft. Nächste Runde in 60 Tagen — oder „Ohne Besitzer“ öffnen.' : 'Hier wartet gerade nichts.'}</Leer>
        </Karte>
      )}
      {d && karten.length > 0 && !z && (
        <Karte i={1} akzent={LEUCHT.gut}>
          <Ueberschrift farbe={LEUCHT.gut}>Runde fertig</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>{erledigt} von {karten.length} geprüft. Übersprungene kommen beim nächsten Start wieder.</div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}><Knopf onClick={() => { setReihe(null); setPos(0); setErledigt(0); void laden(); }}>Neue Runde</Knopf><Knopf leise onClick={() => zuLeads()}>Zu den Leads</Knopf></div>
        </Karte>
      )}
      {z && <QualiKarte key={z.id} z={z} api={api} ich={ich} heute={heute} laden={laden} weiter={weiter} zuKontakt={zuKontakt} zuFirma={zuFirma} zuLeads={zuLeads} />}

      <KanalLeistung zeilen={kanaele} i={2} />
    </>
  );
}

function ScoreBlock({ score }: { score: LeadScore }) {
  const f = temperaturFarbe(score.temperatur);
  return (
    <div style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.04)', border: `1px solid ${f}33` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: 30, fontWeight: 700, letterSpacing: '-.02em', color: f, fontVariantNumeric: 'tabular-nums' }}>{score.punkte}</span>
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>von 100</span>
        <Chip farbe={f}>{temperaturLabel(score.temperatur)}</Chip>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
        {score.teile.map(t => (
          <div key={t.id} title={t.grund}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkDim, marginBottom: 3 }}><span>{t.label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{t.punkte}/{t.max}</span></div>
            <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${(100 * t.punkte) / t.max}%`, height: '100%', background: f, transition: 'width .3s' }} /></div>
            <div style={{ fontSize: 11, color: C.inkLeise, marginTop: 3, lineHeight: 1.35 }}>{t.grund}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualiKarte({ z, api, ich, heute, laden, weiter, zuKontakt, zuFirma, zuLeads }: { z: LeadZeile; api: CrmApi; ich: string; heute: string; laden: () => Promise<void>; weiter: (fertig: boolean) => void; zuKontakt: (id: string) => void; zuFirma: (id: string) => void; zuLeads: (id?: string) => void }) {
  const [k, setK] = useState<Kriterien>(z.kriterien);
  const [antworten, setAntworten] = useState<Partial<Record<keyof Kriterien, string>>>(z.antworten ?? {});
  const [fit, setFit] = useState<Qual | undefined>(z.fit);
  const [notiz, setNotiz] = useState(z.notiz ?? '');
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const { frage, dialog } = useNachfrage();
  const personen = useMemo(() => z.personen.map(p => (api.kontakte ?? []).find(x => x.id === p.id)).filter((x): x is NonNullable<typeof x> => !!x), [z.personen, api.kontakte]);
  // Der Score rechnet live mit — jede Antwort verschiebt ihn sichtbar.
  const score = useMemo(() => leadScore(personen, { status: z.status, kriterien: k, ...(fit ? { fit } : {}) }, heute, k), [personen, z.status, k, fit, heute]);
  const post = (body: Record<string, unknown>) => fetch('/api/crm/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
  const setze = async (felder: Record<string, unknown>) => { const r = await post({ aktion: 'setze', id: z.id, felder }); if (!r.ok) setMeldung(r.fehler ?? 'Nicht gespeichert.'); return !!r.ok; };
  const kriterium = (id: keyof Kriterien, w: Qual) => {
    const neu = { ...k, [id]: w }; setK(neu);
    const nachStatus = ['neu', 'kontaktiert', 'im_gespraech'].includes(z.status) ? 'qualifizierung' : z.status;
    void setze({ kriterien: { [id]: w }, ...(nachStatus !== z.status ? { status: nachStatus } : {}) });
  };
  const antwortSpeichern = (id: keyof Kriterien) => { if ((antworten[id] ?? '') !== (z.antworten?.[id] ?? '')) void setze({ antworten: { [id]: antworten[id] ?? '' } }); };
  const abschliessen = async (status?: 'kein_fit' | 'ruht') => {
    setLaeuft(true);
    let ok = true;
    if (status) {
      const grund = await frage(status === 'kein_fit' ? 'Warum kein Fit?' : 'Warum ruht es?', { hinweis: 'Ein kurzer Satz — steht später an der Firma.' });
      if (grund === null) { setLaeuft(false); return; }
      ok = await setze({ status, grund, geprueft: true });
    } else ok = await setze({ geprueft: true, ...(notiz !== (z.notiz ?? '') ? { notiz } : {}) });
    setLaeuft(false);
    if (ok) { void laden(); weiter(true); }
  };
  const uebernehmen = async () => { const r = await post({ aktion: 'uebernehmen', id: z.id, an: ich }); if (r.ok) { setMeldung(`Übernommen — ${r.uebernommen} ${r.uebernommen === 1 ? 'Person gehört' : 'Personen gehören'} jetzt ${nameVon(ich)}.`); void laden(); void api.laden(); } else setMeldung(r.fehler ?? 'Nicht übernommen.'); };
  const bereit = sqlBereit(k);
  const fehlt = fehltBisSql(k);
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '8px 11px', width: '100%', resize: 'vertical' as const };

  return (
    <Karte i={1} akzent={temperaturFarbe(score.temperatur)}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-.015em' }}>{z.name}</div>
            <div style={{ fontSize: 12.5, color: C.inkDim, marginTop: 2 }}>{[z.art === 'firma' ? 'Firma' : 'Person ohne Firma', z.branche, z.stadt, statusLabel(z.status), `Kanal: ${kanalLabel(z.kanal)}`, z.letzterKontakt ? `zuletzt ${datum(z.letzterKontakt, heute)}` : 'noch kein Kontakt'].filter(Boolean).join(' · ')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
              {z.ohneBesitzer ? <Chip farbe={LEUCHT.achtung}>ohne Besitzer</Chip> : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}><Person id={z.besitzer} groesse={18} /> {nameVon(z.besitzer)}</span>}
              {z.personen.map(p => <button key={p.id} onClick={() => zuKontakt(p.id)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, padding: '4px 10px', color: C.ink, cursor: 'pointer', fontSize: 12.5 }}>{p.name}{p.position ? ` · ${p.position}` : ''}</button>)}
            </div>
          </div>
          <div style={{ flex: '1 1 300px' }}><ScoreBlock score={score} /></div>
        </div>

        {z.deal && <div style={{ padding: '10px 12px', borderRadius: 12, background: `${LEUCHT.gut}14`, fontSize: TYP.bedien }}>Deal „{z.deal.titel}“ läuft unter Deals — hier nur noch die Kernfragen nachziehen.</div>}

        <div>
          <Ueberschrift rechts={<span style={{ fontSize: 12, color: bereit ? LEUCHT.gut : C.inkLeise }}>{bereit ? 'SQL-bereit' : `bis SQL fehlt: ${fehlt.join(', ')}`}</span>}>Kernfragen</Ueberschrift>
          <div style={{ display: 'grid', gap: 12 }}>
            {KRITERIEN.map(x => (
              <div key={x.id} style={{ display: 'grid', gap: 6, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{x.label}</div>
                    <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.4 }}>{x.frage}</div>
                  </div>
                  <span style={{ display: 'inline-flex', gap: 3 }}>
                    {(['ja', 'unklar', 'nein'] as Qual[]).map(w => (
                      <button key={w} onClick={() => kriterium(x.id, w)} aria-pressed={k[x.id] === w} style={{ padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: SCHRIFT.text,
                        border: `1px solid ${k[x.id] === w ? Q_FARBE[w] : 'rgba(255,255,255,.1)'}`, background: k[x.id] === w ? `${w === 'unklar' ? '#ffffff' : Q_FARBE[w]}1f` : 'transparent', color: k[x.id] === w ? C.ink : C.inkDim }}>{w}</button>
                    ))}
                  </span>
                </div>
                <textarea value={antworten[x.id] ?? ''} onChange={e => setAntworten(a => ({ ...a, [x.id]: e.target.value }))} onBlur={() => antwortSpeichern(x.id)} rows={2} maxLength={1000}
                  placeholder={PLATZHALTER[x.id]} aria-label={`${x.label} — was genau`} style={eingabe} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div>
            <Ueberschrift>Fit zu uns</Ueberschrift>
            <Pillen liste={[{ id: 'ja', label: 'Passt' }, { id: 'unklar', label: 'Offen' }, { id: 'nein', label: 'Kein Fit' }]} aktiv={fit ?? 'unklar'} onWahl={w => { setFit(w as Qual); void setze({ fit: w }); }} farbe={LEUCHT.business} />
          </div>
          <div>
            <Ueberschrift>Notiz</Ueberschrift>
            <textarea value={notiz} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (z.notiz ?? '')) void setze({ notiz }); }} rows={2} maxLength={2000} placeholder="Was man wissen muss, bevor man anruft …" aria-label="Notiz" style={eingabe} />
          </div>
        </div>

        {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{meldung}</div>}
        {dialog}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf onClick={() => void abschliessen()} aus={laeuft}>Geprüft → nächster</Knopf>
          {bereit && !z.deal?.offen && <Knopf farbe={LEUCHT.gut} onClick={() => zuLeads(z.id)}>SQL → Deal anlegen</Knopf>}
          {z.ohneBesitzer && <Knopf leise onClick={() => void uebernehmen()}>Übernehmen ({nameVon(ich)})</Knopf>}
          <Knopf leise onClick={() => (z.firmaId ? zuFirma(z.firmaId) : z.personen[0] ? zuKontakt(z.personen[0].id) : undefined)}>{z.firmaId ? 'Firma öffnen' : 'Kontakt öffnen'}</Knopf>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <Knopf leise onClick={() => void abschliessen('ruht')}>Ruht</Knopf>
            <Knopf leise onClick={() => void abschliessen('kein_fit')}>Kein Fit</Knopf>
            <Knopf leise onClick={() => weiter(false)}>Später</Knopf>
          </span>
        </div>
      </div>
    </Karte>
  );
}

const PLATZHALTER: Record<keyof Kriterien, string> = {
  schmerz: 'Was genau tut weh — Zahlen, Beispiel, Zitat …',
  entscheider: 'Wer entscheidet, wer zahlt, wie nah sind wir dran …',
  budget: 'Rahmen, Vergleichsausgaben, was der Schmerz kostet …',
  zeitpunkt: 'Bis wann, welcher Anlass, was passiert sonst …',
  wirkung: 'Woran wird der Erfolg gemessen …',
  alternative: 'Wer ist noch im Rennen, was ist Plan B …',
};

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

/** Kanal-Leistung mit eigenem Laden — für Sales › Auswertung und Marketing. */
export function KanalLeistungLaden({ i = 0 }: { i?: number }) {
  const [zeilen, setZeilen] = useState<ReturnType<typeof kanalLeistung>>([]);
  const staende = useRef(new Map<string, string>());
  useEffect(() => { void holeMitStand<Daten & { ok?: boolean }>('/api/crm/lead', staende.current).then(x => { if (x?.ok) setZeilen(kanalLeistung(x.leads)); }).catch(() => undefined); }, []);
  return <KanalLeistung zeilen={zeilen} i={i} />;
}
