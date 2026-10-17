'use client';

// ─── Fulfillment › Fall › Menschen & Termine (Paket C1, 10.10. „Menschen & Entscheidungen“; 12.10. neu gezeichnet; seit 17.10. mit dem Takt — 3.2, 1.3, 5.1) ─
// Rückmeldung 17.10.: „Lieber wenig und klar.“ EIN Reiter für die Menschen und ihre Termine:
//   · Antwort zuerst als EINE Zeile (wer trägt das Projekt · was ist entschieden · wann sehen wir uns) und EINE Hauptaktion (was zuerst fehlt).
//   · Stakeholder-Karte als Raster Einfluss × Haltung (Personen NUR aus der Kartei, eingeschränkte Personen (Art. 18) lassen sich nicht eintragen; Haltung und
//     Notiz sind intern und fallen 12 Monate nach Mandatsende weg).
//   · Entscheidungs-Log getrennt in „Entschieden“ und „Noch offen“ (EINE Regel `entscheidungenTeilen` — dieselbe wie die Kunden-Seite).
//   · Zusammenarbeits-Vereinbarung (im Kick-off bestätigt) als ruhige Zusammenfassung — Bearbeiten und Lösen hinter „⋯“.
//   · Takt: Rituale mit den Terminen aus dem Kalender und Mitschriften (FallTakt.tsx).
// Gerechnet in lib/fulfillment/prozesse/ansichten.ts; geschrieben nur über die vorhandenen Fall-Ops.

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, TIEF, RAND, ECKE, SCHRIFT } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Feldzeile, Pillen, Schalter, Punkt, LEUCHT, useHandy } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { stakeholderLage, stakeholderRaster, entscheidungsStrahl, entscheidungsLage, taktLeiste, taktLage, HALTUNG_TEXT, type Antwort, type Haltung } from '@/lib/fulfillment/prozesse/ansichten';
import { entscheidungenTeilen } from '@/lib/fulfillment/kunde/bild';
import type { Stakeholder, Entscheidung, Vereinbarung, RitualVorlage } from '@/lib/fulfillment/typen';
import { useFall, fallOps, fehlerText, tagKurz, type FallAntwort, type MitStand } from './daten';
import { klein, feld, Leiste } from './teile';
import { MehrKnopf } from '../reise/teile';
import { AMPEL_FARBE } from '../reise/bilder';
import { TaktKarten, RitualTerminDialog, ritualTermin, type Melde, type TaktOps } from './FallTakt';
import { insBild, useStellenSprung } from '../reise/sprung';

const ROLLEN: { id: Stakeholder['rolle']; label: string }[] = [
  { id: 'entscheider', label: 'Entscheider' }, { id: 'sponsor', label: 'Sponsor' }, { id: 'unterstuetzer', label: 'Unterstützer' },
  { id: 'skeptiker', label: 'Skeptiker' }, { id: 'nutzer', label: 'Nutzer' }, { id: 'einkauf', label: 'Einkauf' },
];
const HALTUNG: { id: NonNullable<Stakeholder['haltung']>; label: string }[] = [{ id: 'positiv', label: 'positiv' }, { id: 'neutral', label: 'neutral' }, { id: 'kritisch', label: 'kritisch' }];
const HALTUNG_FARBE: Record<Haltung, string> = { positiv: LEUCHT.gut, neutral: C.inkDim, kritisch: LEUCHT.kritisch, offen: C.inkLeise };
const EINFLUSS = [{ id: '1' as const, label: 'Einfluss 1' }, { id: '2' as const, label: 'Einfluss 2' }, { id: '3' as const, label: 'Einfluss 3' }];
const EINFLUSS_TEXT: Record<1 | 2 | 3, string> = { 3: 'großer Einfluss', 2: 'mittlerer Einfluss', 1: 'wenig Einfluss' };
const STATUS_FARBE: Record<Entscheidung['status'], string> = { offen: LEUCHT.achtung, entschieden: LEUCHT.gut, verworfen: C.inkLeise };

type Ops = (o: Record<string, unknown>[]) => Promise<boolean>;

export function FallMenschen({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung'; aufgabe?: string } | null>(null);
  const [offen, setOffen] = useState<'stakeholder' | 'entscheidung' | 'vereinbarung' | null>(null);
  const [schreiben, setSchreiben] = useState(false);
  const [termin, setTermin] = useState<ReturnType<typeof ritualTermin> | null>(null);
  useStellenSprung();
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Reise“ das Onboarding starten.</Hinweis>;
  const f = daten.fall;
  const melde: Melde = (text, art = 'gut', aufgabe) => setMeldung(text ? { text, art, ...(aufgabe ? { aufgabe } : {}) } : null);
  const ops: Ops = async o => { const a = await fallOps(mandatId, o); setMeldung(a.ok ? null : { text: fehlerText(a), art: 'kritisch' }); return a.ok; };
  const taktOps: TaktOps = async (o, gut) => { const a = await fallOps(mandatId, o); melde(a.ok ? gut ?? null : fehlerText(a), a.ok ? 'gut' : 'kritisch'); return a.ok; };
  const heute = localDay();
  const sh = stakeholderLage(f.stakeholder);
  const strahl = entscheidungsStrahl(f.entscheidungen, heute);
  const el = entscheidungsLage(strahl);
  const rituale = daten.rituale ?? [];
  const leiste = taktLeiste({ rituale, fallRituale: f.rituale, termine: daten.termine ?? {}, heute, vorlageId: f.vorlageId, ...(daten.kalender ? { kalender: daten.kalender } : {}) });
  const letzte = [...f.mitschriften].sort((a, b) => (a.am < b.am ? 1 : -1))[0];
  const tl = taktLage(leiste, heute, letzte?.am);
  const v = f.vereinbarung ?? {};
  const zu = (was: 'stakeholder' | 'entscheidung' | 'vereinbarung') => { setOffen(was); insBild(`menschen-${was}`); };
  const terminAnlegen = (r: RitualVorlage) => setTermin(ritualTermin(daten, r, heute));
  // EINE Hauptaktion: was zuerst fehlt — Entscheider, dann der Wochen-Check im Kalender, dann die Vereinbarung, sonst die Mitschrift des letzten Termins.
  const wochencheck = rituale.find(r => r.rhythmus === 'woche');
  const ohneWochencheck = wochencheck && !leiste.zeilen.find(z => z.ritualId === wochencheck.id)?.naechster;
  const haupt = sh.ampel === 'rot' && !f.stakeholder.length ? { text: 'Stakeholder eintragen', tun: () => zu('stakeholder') }
    : ohneWochencheck ? { text: 'Wochen-Check im Kalender anlegen', tun: () => terminAnlegen(wochencheck!) }
      : !v.bestaetigtAm ? { text: 'Vereinbarung festhalten', tun: () => zu('vereinbarung') }
        : { text: 'Mitschrift festhalten', tun: () => { setSchreiben(true); insBild('takt-mitschriften'); } };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'} aktion={meldung.aufgabe ? <Link href={WEG.aufgabe(meldung.aufgabe)} style={{ color: C.aktiv, fontSize: TYP.bedien }}>Aufgabe öffnen ›</Link> : undefined}>{meldung.text}</Hinweis>}
      <KurzAntworten antworten={[
        { frage: 'Wer trägt das Projekt?', ...sh, onClick: () => insBild('menschen-stakeholder') },
        { frage: 'Was ist entschieden?', ...el, onClick: () => insBild('menschen-entscheidung') },
        { frage: 'Wann sehen wir uns?', ...tl, onClick: () => insBild('takt-leiste') },
      ]} aktion={<Knopf haupt onClick={haupt.tun}>{haupt.text}</Knopf>} />
      <StakeholderKarte daten={daten} ops={ops} hinzufuegen={offen === 'stakeholder'} setHinzufuegen={b => setOffen(b ? 'stakeholder' : null)} />
      <EntscheidungenKarte daten={daten} ops={ops} neu={offen === 'entscheidung'} setNeu={b => setOffen(b ? 'entscheidung' : null)} />
      <VereinbarungKarte daten={daten} ops={ops} bearbeiten={offen === 'vereinbarung' || !v.bestaetigtAm} setBearbeiten={b => setOffen(b ? 'vereinbarung' : null)} />
      <TaktKarten daten={daten} ops={taktOps} melde={melde} schreiben={schreiben} setSchreiben={setSchreiben} onTermin={terminAnlegen} />
      {termin && <RitualTerminDialog termin={termin} heute={heute} ops={taktOps} melde={melde} onZu={() => setTermin(null)} />}
    </div>
  );
}

/** Antwort zuerst — EINE Zeile: je Frage Ampel-Punkt und ein Satz (Tipp springt zur Karte), daneben die eine Hauptaktion. */
function KurzAntworten({ antworten, aktion }: { antworten: readonly (Antwort & { frage: string; onClick: () => void })[]; aktion: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', alignItems: 'center' }}>
      {antworten.map(a => (
        <button key={a.frage} type="button" className="fassbar" onClick={a.onClick} title={a.unter} aria-label={`${a.frage} ${a.antwort}. ${a.unter}`}
          style={{ display: 'grid', gap: 1, textAlign: 'left', minHeight: 44, padding: '2px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink, minWidth: 0 }}>
          <span style={{ ...MIKRO }}>{a.frage}</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, fontWeight: 600 }}><Punkt farbe={AMPEL_FARBE[a.ampel]} groesse={8} />{a.antwort}</span>
        </button>
      ))}
      <span style={{ marginLeft: 'auto' }}>{aktion}</span>
    </div>
  );
}

// ─── Stakeholder: Raster Einfluss × Haltung ─────────────────────────────────────────────────────────────────────────────────────────
function StakeholderKarte({ daten, ops, hinzufuegen, setHinzufuegen }: { daten: FallAntwort; ops: Ops; hinzufuegen: boolean; setHinzufuegen: (b: boolean) => void }) {
  const handy = useHandy();
  const router = useRouter();
  const [neu, setNeu] = useState<string | null>(null);
  const [rolle, setRolle] = useState<Stakeholder['rolle']>('entscheider');
  const [auf, setAuf] = useState<string | null>(null);
  const f = daten.fall!;
  const namen = new Map((daten.personen ?? []).map(p => [p.id, p]));
  const name = (s: Stakeholder) => namen.get(s.kontaktId)?.name ?? (s.kontaktId === '[gelöscht]' ? 'Person gelöscht' : 'Kontakt (nicht verfügbar)');
  // Vorschläge: Ansprechpersonen des Mandats und Personen der Firma; eingeschränkte (Art. 18) bietet die Kartei hier nicht an.
  const kandidaten = (daten.personen ?? []).filter(p => !f.stakeholder.some(s => s.kontaktId === p.id));
  const raster = stakeholderRaster(f.stakeholder);
  const nachId = new Map(f.stakeholder.map(s => [s.id, s]));
  const offenerEintrag = auf ? f.stakeholder.find(s => s.id === auf) : undefined;
  const person = (s: MitStand<Stakeholder>) => (
    <button key={s.id} type="button" className="fassbar" onClick={() => setAuf(auf === s.id ? null : s.id)} aria-expanded={auf === s.id}
      aria-label={`${name(s)} — ${ROLLEN.find(r => r.id === s.rolle)?.label}, ${EINFLUSS_TEXT[s.einfluss]}, Haltung ${HALTUNG_TEXT[s.haltung ?? 'offen']} — bearbeiten`}
      style={{ display: 'grid', gap: 1, textAlign: 'left', minHeight: 44, padding: '6px 10px', borderRadius: ECKE.eingabe, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink,
        background: TIEF.flaeche(HALTUNG_FARBE[s.haltung ?? 'offen']), border: `1px solid ${auf === s.id ? JETZT_RAND : TIEF.rand(HALTUNG_FARBE[s.haltung ?? 'offen'])}` }}>
      <span style={{ fontSize: TYP.bedien, fontWeight: 600, overflowWrap: 'anywhere' }}>{name(s)}</span>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{ROLLEN.find(r => r.id === s.rolle)?.label}
        {/* Am Handy fehlen die Haltungs-Spalten — dann steht die Haltung als Wort dabei, nie nur als Farbe. */}
        {handy && <span style={{ color: HALTUNG_FARBE[s.haltung ?? 'offen'] }}> · {HALTUNG_TEXT[s.haltung ?? 'offen']}</span>}</span>
    </button>
  );
  return (
    <Karte i={1} id="menschen-stakeholder">
      <Ueberschrift erklaerung="fulfillment.stakeholder" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span>{f.stakeholder.length}</span>
        <MehrKnopf titel="Stakeholder-Karte" mehr={[
          { id: 'neu', label: 'Person eintragen', hinweis: 'Aus der Kartei — Ansprechpersonen und Personen der Firma.', tun: () => setHinzufuegen(true) },
          { id: 'kartei', label: 'Kontakt in der Markttraktion anlegen', hinweis: 'Wer fehlt, kommt zuerst in die Kartei.', tun: () => router.push(WEG.kontakt()) },
        ]} /></span>}>Stakeholder-Karte</Ueberschrift>
      {!f.stakeholder.length ? <div style={klein}>Noch niemand eingetragen — mindestens ein Entscheider gehört zum Onboarding.</div> : handy ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {([3, 2, 1] as const).map(e => {
            const l = f.stakeholder.filter(s => s.einfluss === e);
            return l.length ? <div key={e} style={{ display: 'grid', gap: 6 }}><span style={MIKRO}>{EINFLUSS_TEXT[e]}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{l.map(person)}</div></div> : null;
          })}
        </div>
      ) : (
        <div role="table" aria-label="Stakeholder nach Einfluss und Haltung" style={{ display: 'grid', gridTemplateColumns: '110px repeat(4, minmax(0, 1fr))', gap: 6 }}>
          <span role="row" style={{ display: 'contents' }}>
            <span role="columnheader" />
            {(['positiv', 'neutral', 'kritisch', 'offen'] as const).map(h => <span key={h} role="columnheader" style={{ ...MIKRO, color: HALTUNG_FARBE[h], padding: '0 4px' }}>{HALTUNG_TEXT[h]}</span>)}
          </span>
          {([3, 2, 1] as const).map(e => (
            <span key={e} role="row" style={{ display: 'contents' }}>
              <span role="rowheader" style={{ ...MIKRO, alignSelf: 'center' }}>{EINFLUSS_TEXT[e]}</span>
              {raster.filter(z => z.einfluss === e).map(z => (
                <span key={z.haltung} role="cell" style={{ minHeight: 56, padding: 4, borderRadius: ECKE.eingabe, border: `1px dashed ${z.einfluss === 3 && z.haltung === 'kritisch' ? TIEF.rand(LEUCHT.kritisch) : RAND.haar}`, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}>
                  {z.ids.map(id => nachId.get(id)).filter((s): s is MitStand<Stakeholder> => !!s).map(person)}
                </span>
              ))}
            </span>
          ))}
        </div>
      )}
      {offenerEintrag && <StakeholderBearbeiten key={offenerEintrag.id} s={offenerEintrag} name={name(offenerEintrag)} ops={ops} onZu={() => setAuf(null)} />}
      {(hinzufuegen || !f.stakeholder.length) && (
        <form onSubmit={e => { e.preventDefault(); if (neu) void ops([{ op: 'stakeholder', eintrag: { kontaktId: neu, rolle, einfluss: rolle === 'entscheider' ? 3 : 2 } }]).then(ok => { if (ok) { setNeu(null); setHinzufuegen(false); } }); }} style={{ display: 'grid', gap: 8 }}>
          <Leiste>
            <Wahl label="Person aus der Kartei" liste={kandidaten.map(p => ({ id: p.id, label: p.name, ...(p.position ? { hinweis: p.position } : {}) }))} wert={neu} onWahl={setNeu} />
            <Wahl label="Rolle" liste={ROLLEN} wert={rolle} onWahl={setRolle} />
            <Knopf typ="submit" aus={!neu}>Eintragen</Knopf>
          </Leiste>
          <div style={klein}>Fehlt jemand? <Link href={WEG.kontakt()} style={{ color: C.aktiv }}>Kontakt in der Markttraktion anlegen ›</Link></div>
        </form>
      )}
    </Karte>
  );
}
const JETZT_RAND = TIEF.rand(LEUCHT.business);

function StakeholderBearbeiten({ s, name, ops, onZu }: { s: MitStand<Stakeholder>; name: string; ops: Ops; onZu: () => void }) {
  const [notiz, setNotiz] = useState(s.notiz ?? '');
  const teil = (eintrag: Record<string, unknown>) => ops([{ op: 'stakeholder', eintrag: { id: s.id, ...eintrag }, stand: s.stand }]);
  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, borderRadius: ECKE.flach, background: 'rgba(255,255,255,.03)', border: `1px solid ${RAND.flaeche}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><b style={{ fontSize: TYP.body, color: C.ink }}>{name}</b><Knopf leise onClick={onZu}>Schließen</Knopf></div>
      <Feldzeile label="Rolle"><Pillen liste={ROLLEN} aktiv={s.rolle} onWahl={rolle => teil({ rolle })} /></Feldzeile>
      <Feldzeile label="Einfluss"><Pillen liste={EINFLUSS} aktiv={String(s.einfluss) as '1' | '2' | '3'} onWahl={x => teil({ einfluss: Number(x) })} /></Feldzeile>
      <Feldzeile label="Haltung"><Pillen liste={HALTUNG} aktiv={s.haltung ?? null} onWahl={haltung => teil({ haltung })} /></Feldzeile>
      <Feldzeile label="Notiz (intern, kurz, ohne Privates)">
        <input value={notiz} maxLength={300} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (s.notiz ?? '')) void teil({ notiz: notiz || null }); }} style={feld} />
      </Feldzeile>
      <div><Knopf leise onClick={() => { void ops([{ op: 'stakeholder', id: s.id, weg: true, stand: s.stand }]).then(ok => { if (ok) onZu(); }); }}>Von der Karte nehmen</Knopf></div>
    </div>
  );
}

// ─── Entscheidungs-Log: Zeitstrahl ──────────────────────────────────────────────────────────────────────────────────────────────────
const E_STATUS: { id: Entscheidung['status']; label: string }[] = [{ id: 'offen', label: 'offen' }, { id: 'entschieden', label: 'entschieden' }, { id: 'verworfen', label: 'verworfen' }];
const WER: { id: Entscheidung['wer']; label: string }[] = [{ id: 'kunde', label: 'Kunde entscheidet' }, { id: 'intern', label: 'wir entscheiden' }, { id: 'beide', label: 'gemeinsam' }];

function EntscheidungenKarte({ daten, ops, neu, setNeu }: { daten: FallAntwort; ops: Ops; neu: boolean; setNeu: (b: boolean) => void }) {
  const f = daten.fall!;
  const [titel, setTitel] = useState('');
  const [wer, setWer] = useState<Entscheidung['wer']>('kunde');
  const [frist, setFrist] = useState('');
  const [geteilt, setGeteilt] = useState(false);
  const [alle, setAlle] = useState(false);
  const heute = localDay();
  // EINE Regel trennt „Entschieden“ und „Noch offen“ (dieselbe wie die Kunden-Seite — abnahme2 C6); jüngste zuerst.
  const t = entscheidungenTeilen([...f.entscheidungen].sort((a, b) => (a.am < b.am ? 1 : -1)));
  const entschieden = alle ? t.entschieden : t.entschieden.slice(0, 4);
  const zeile = (e: (typeof f.entscheidungen)[number]) => {
    const ueber = e.status === 'offen' && !!e.frist && e.frist < heute;
    return (
      <Zeile key={e.id} umbrechen links={<span style={{ width: 12, height: 12, borderRadius: e.wer === 'kunde' ? 2 : 6, transform: e.wer === 'kunde' ? 'rotate(45deg)' : undefined, background: e.status === 'offen' ? 'transparent' : STATUS_FARBE[e.status], border: `2px solid ${ueber ? LEUCHT.kritisch : STATUS_FARBE[e.status]}`, flex: '0 0 auto' }} />}
        titel={e.titel} unter={`${tagKurz(e.am)} · ${WER.find(x => x.id === e.wer)?.label}${e.frist ? ` · Frist ${tagKurz(e.frist)}${ueber ? ' (überschritten)' : ''}` : ''}${e.geteilt ? ' · mit dem Kunden geteilt' : ' · nur intern'}${e.inhalt ? ` · ${e.inhalt}` : ''}`}
        rechts={<Wahl label="Status" klein liste={E_STATUS} wert={e.status} onWahl={status => ops([{ op: 'entscheidung', eintrag: { id: e.id, status }, stand: e.stand }])} />} />
    );
  };
  return (
    <Karte i={2} id="menschen-entscheidung">
      <Ueberschrift erklaerung="fulfillment.entscheidungGeteilt" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><span>{t.offen.length} offen</span>
        <MehrKnopf titel="Entscheidungs-Log" mehr={[{ id: 'neu', label: 'Entscheidung festhalten', tun: () => setNeu(true) }]} /></span>}>Entscheidungs-Log</Ueberschrift>
      {t.entschieden.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...MIKRO }}>Entschieden</span>
          <Liste>{entschieden.map(zeile)}</Liste>
          {t.entschieden.length > 4 && <div><Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Weniger zeigen' : `Alle ${t.entschieden.length} zeigen`}</Knopf></div>}
        </div>
      )}
      {t.offen.length > 0 && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...MIKRO, color: LEUCHT.achtung }}>Noch offen</span>
          <Liste>{t.offen.map(zeile)}</Liste>
        </div>
      )}
      {!f.entscheidungen.length && <div style={klein}>Noch keine Entscheidung — die erste im Kick-off festhalten.</div>}
      {neu || !f.entscheidungen.length ? (
        <form onSubmit={x => { x.preventDefault(); if (titel.trim()) void ops([{ op: 'entscheidung', eintrag: { titel: titel.trim(), wer, geteilt, ...(frist ? { frist } : {}) } }]).then(ok => { if (ok) { setTitel(''); setFrist(''); setNeu(false); } }); }} style={{ display: 'grid', gap: 8 }}>
          <input value={titel} onChange={x => setTitel(x.target.value)} placeholder="Neue Entscheidung" aria-label="Neue Entscheidung" style={feld} />
          <Leiste>
            <Pillen liste={WER} aktiv={wer} onWahl={setWer} />
            <input type="date" value={frist} onChange={x => setFrist(x.target.value)} aria-label="Frist" style={{ ...feld, width: 170 }} />
          </Leiste>
          <Schalter an={geteilt} onChange={setGeteilt} erklaerung="fulfillment.entscheidungGeteilt">Mit dem Kunden geteilt</Schalter>
          <Leiste><Knopf typ="submit" aus={!titel.trim()}>Eintragen</Knopf>{f.entscheidungen.length > 0 && <Knopf leise onClick={() => setNeu(false)}>Abbrechen</Knopf>}</Leiste>
        </form>
      ) : null}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>◆ = der Kunde entscheidet. Offene Entscheidungen des Kunden stehen auf seiner Seite unter „Das brauchen wir von Ihnen“; geteilte sieht er unter „Gemeinsam entschieden“.</div>
    </Karte>
  );
}

// ─── Zusammenarbeits-Vereinbarung ───────────────────────────────────────────────────────────────────────────────────────────────────
const V_FELDER: { id: keyof Vereinbarung; label: string }[] = [
  { id: 'rollen', label: 'Rollen' }, { id: 'reaktionszeiten', label: 'Reaktionszeiten' }, { id: 'wirBrauchen', label: 'Was wir brauchen' }, { id: 'eskalation', label: 'Eskalation' },
  { id: 'scopeDrin', label: 'Im Scope' }, { id: 'scopeDraussen', label: 'Nicht im Scope' }, { id: 'entscheidungsrechte', label: 'Entscheidungsrechte' },
];
const WIE = [{ id: 'kickoff' as const, label: 'im Kick-off' }, { id: 'termin' as const, label: 'im Termin' }, { id: 'mail' as const, label: 'per Mail' }];
const WIE_TEXT = { kickoff: 'im Kick-off', termin: 'im Termin', mail: 'per Mail' } as const;

function VereinbarungKarte({ daten, ops, bearbeiten, setBearbeiten }: { daten: FallAntwort; ops: Ops; bearbeiten: boolean; setBearbeiten: (b: boolean) => void }) {
  const v = daten.fall!.vereinbarung ?? {};
  const stand = daten.staende?.vereinbarung;
  const [w, setW] = useState<Record<string, string>>(() => Object.fromEntries(V_FELDER.map(f => [f.id, (v[f.id] as string | undefined) ?? ''])));
  const [wie, setWie] = useState<'kickoff' | 'termin' | 'mail'>(v.bestaetigtWie ?? 'kickoff');
  const speichern = (extra: Record<string, unknown> = {}) => ops([{ op: 'vereinbarung', felder: { ...Object.fromEntries(V_FELDER.map(f => [f.id, w[f.id] || null])), ...extra }, ...(stand ? { stand } : {}) }]);
  const gefuellt = V_FELDER.filter(f => (v[f.id] as string | undefined)?.trim());
  const mehr = v.bestaetigtAm ? [
    { id: 'bearbeiten', label: bearbeiten ? 'Bearbeiten schließen' : 'Bearbeiten', tun: () => setBearbeiten(!bearbeiten) },
    { id: 'loesen', label: 'Bestätigung lösen', hinweis: 'Die Vereinbarung gilt dann wieder als offen.', tun: () => speichern({ bestaetigtAm: null, bestaetigtWie: null }) },
  ] : [];
  let inhalt: ReactNode;
  if (v.bestaetigtAm && !bearbeiten) {
    inhalt = (
      <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '10px 18px' }}>
        {gefuellt.map(f => <div key={f.id} style={{ display: 'grid', gap: 2 }}><dt style={MIKRO}>{f.label}</dt><dd style={{ margin: 0, fontSize: TYP.bedien, color: C.ink, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{v[f.id] as string}</dd></div>)}
      </dl>
    );
  } else {
    inhalt = (
      <>
        {V_FELDER.map(f => (
          <Feldzeile key={f.id} label={f.label}><textarea rows={2} value={w[f.id]} onChange={e => setW({ ...w, [f.id]: e.target.value })} style={{ ...feld, fontSize: 16 }} /></Feldzeile>
        ))}
        <Leiste>
          <Knopf leise onClick={() => { void speichern().then(ok => { if (ok && v.bestaetigtAm) setBearbeiten(false); }); }}>Speichern</Knopf>
          {!v.bestaetigtAm && <><Pillen liste={WIE} aktiv={wie} onWahl={setWie} /><Knopf onClick={() => speichern({ bestaetigtAm: localDay(), bestaetigtWie: wie })}>Als bestätigt vermerken</Knopf></>}
        </Leiste>
      </>
    );
  }
  return (
    <Karte i={3} id="menschen-vereinbarung">
      <Ueberschrift erklaerung="fulfillment.vereinbarung" rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>{v.bestaetigtAm ? <Chip farbe={LEUCHT.gut}>bestätigt {tagKurz(v.bestaetigtAm)}{v.bestaetigtWie ? ` · ${WIE_TEXT[v.bestaetigtWie]}` : ''}</Chip> : <Chip farbe={LEUCHT.achtung}>offen</Chip>}<MehrKnopf titel="Zusammenarbeits-Vereinbarung" mehr={mehr} /></span>}>Zusammenarbeits-Vereinbarung</Ueberschrift>
      {inhalt}
    </Karte>
  );
}
