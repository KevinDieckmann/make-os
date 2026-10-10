'use client';

// ─── Fulfillment › Fall › Menschen & Entscheidungen (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 3.2, 1.3) ───────────────────────────────
// Stakeholder-Karte (Entscheider, Unterstützer, Skeptiker … — Personen NUR aus der Kartei, eingeschränkte Personen (Art. 18) lassen sich nicht
// eintragen; Haltung und Notiz sind intern und fallen 12 Monate nach Mandatsende weg), Zusammenarbeits-Vereinbarung (im Kick-off bestätigt) und
// das Entscheidungs-Log (geteilte Entscheidungen sieht der Kunde in seiner Ansicht).

import { useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Chip, Feldzeile, Pillen, Schalter, LEUCHT } from '../../ui';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import type { Stakeholder, Entscheidung, Vereinbarung } from '@/lib/fulfillment/typen';
import { useFall, fallOps, fehlerText, tagKurz, type FallAntwort, type MitStand } from './daten';
import { klein, feld, Leiste, Meldung } from './teile';

const ROLLEN: { id: Stakeholder['rolle']; label: string }[] = [
  { id: 'entscheider', label: 'Entscheider' }, { id: 'sponsor', label: 'Sponsor' }, { id: 'unterstuetzer', label: 'Unterstützer' },
  { id: 'skeptiker', label: 'Skeptiker' }, { id: 'nutzer', label: 'Nutzer' }, { id: 'einkauf', label: 'Einkauf' },
];
const HALTUNG: { id: NonNullable<Stakeholder['haltung']>; label: string }[] = [{ id: 'positiv', label: 'positiv' }, { id: 'neutral', label: 'neutral' }, { id: 'kritisch', label: 'kritisch' }];
const HALTUNG_FARBE = { positiv: LEUCHT.gut, neutral: C.inkDim, kritisch: LEUCHT.kritisch } as const;
const EINFLUSS = [{ id: '1' as const, label: 'Einfluss 1' }, { id: '2' as const, label: 'Einfluss 2' }, { id: '3' as const, label: 'Einfluss 3' }];

export function FallMenschen({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<string | null>(null);
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const ops = async (o: Record<string, unknown>[]) => { const a = await fallOps(mandatId, o); setMeldung(a.ok ? null : fehlerText(a)); return a.ok; };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung} art="kritisch" />
      <StakeholderKarte daten={daten} ops={ops} />
      <VereinbarungKarte daten={daten} ops={ops} />
      <EntscheidungenKarte daten={daten} ops={ops} />
    </div>
  );
}

function StakeholderKarte({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<boolean> }) {
  const [neu, setNeu] = useState<string | null>(null);
  const [rolle, setRolle] = useState<Stakeholder['rolle']>('entscheider');
  const f = daten.fall!;
  const namen = new Map((daten.personen ?? []).map(p => [p.id, p]));
  // Vorschläge: Ansprechpersonen des Mandats und Personen der Firma; eingeschränkte (Art. 18) bietet die Kartei hier nicht an.
  const kandidaten = (daten.personen ?? []).filter(p => !f.stakeholder.some(s => s.kontaktId === p.id));
  return (
    <Karte i={1}>
      <Ueberschrift erklaerung="fulfillment.stakeholder" rechts={<span>{f.stakeholder.length}</span>}>Stakeholder-Karte</Ueberschrift>
      {!f.stakeholder.length && <div style={klein}>Noch niemand eingetragen — mindestens ein Entscheider gehört zum Onboarding.</div>}
      {f.stakeholder.length > 0 && (
        <Liste>
          {f.stakeholder.map(s => <StakeholderZeile key={s.id} s={s} name={namen.get(s.kontaktId)?.name ?? (s.kontaktId === '[gelöscht]' ? 'Person gelöscht' : 'Kontakt (nicht verfügbar)')} position={namen.get(s.kontaktId)?.position ?? undefined} ops={ops} />)}
        </Liste>
      )}
      <form onSubmit={e => { e.preventDefault(); if (neu) void ops([{ op: 'stakeholder', eintrag: { kontaktId: neu, rolle, einfluss: 2 } }]).then(ok => { if (ok) setNeu(null); }); }} style={{ display: 'grid', gap: 8 }}>
        <Leiste>
          <Wahl label="Person aus der Kartei" liste={kandidaten.map(p => ({ id: p.id, label: p.name, ...(p.position ? { hinweis: p.position } : {}) }))} wert={neu} onWahl={setNeu} />
          <Wahl label="Rolle" liste={ROLLEN} wert={rolle} onWahl={setRolle} />
          <Knopf typ="submit" aus={!neu}>Eintragen</Knopf>
        </Leiste>
        <div style={klein}>Fehlt jemand? <Link href={WEG.kontakt()} style={{ color: C.aktiv }}>Kontakt in der Markttraktion anlegen ›</Link></div>
      </form>
    </Karte>
  );
}

function StakeholderZeile({ s, name, position, ops }: { s: MitStand<Stakeholder>; name: string; position?: string; ops: (o: Record<string, unknown>[]) => Promise<boolean> }) {
  const [auf, setAuf] = useState(false);
  const [notiz, setNotiz] = useState(s.notiz ?? '');
  const teil = (eintrag: Record<string, unknown>) => ops([{ op: 'stakeholder', eintrag: { id: s.id, ...eintrag }, stand: s.stand }]);
  return (
    <div style={{ display: 'grid', gap: 6, padding: '6px 0' }}>
      <Zeile titel={name} umbrechen unter={[position, ROLLEN.find(r => r.id === s.rolle)?.label, `Einfluss ${s.einfluss}`].filter(Boolean).join(' · ')}
        rechts={<Leiste>{s.haltung && <Chip farbe={HALTUNG_FARBE[s.haltung]}>{s.haltung}</Chip>}<Knopf leise onClick={() => setAuf(!auf)}>{auf ? 'Schließen' : 'Bearbeiten'}</Knopf></Leiste>} />
      {auf && (
        <div style={{ display: 'grid', gap: 8, paddingLeft: 8 }}>
          <Pillen liste={ROLLEN} aktiv={s.rolle} onWahl={rolle => teil({ rolle })} />
          <Pillen liste={EINFLUSS} aktiv={String(s.einfluss) as '1' | '2' | '3'} onWahl={x => teil({ einfluss: Number(x) })} />
          <Pillen liste={HALTUNG} aktiv={s.haltung ?? null} onWahl={haltung => teil({ haltung })} />
          <Feldzeile label="Notiz (intern, kurz, ohne Privates)">
            <input value={notiz} maxLength={300} onChange={e => setNotiz(e.target.value)} onBlur={() => { if (notiz !== (s.notiz ?? '')) void teil({ notiz: notiz || null }); }} style={feld} />
          </Feldzeile>
          <div><Knopf leise onClick={() => ops([{ op: 'stakeholder', id: s.id, weg: true, stand: s.stand }])}>Von der Karte nehmen</Knopf></div>
        </div>
      )}
    </div>
  );
}

const V_FELDER: { id: keyof Vereinbarung; label: string }[] = [
  { id: 'rollen', label: 'Rollen' }, { id: 'reaktionszeiten', label: 'Reaktionszeiten' }, { id: 'wirBrauchen', label: 'Was wir brauchen' }, { id: 'eskalation', label: 'Eskalation' },
  { id: 'scopeDrin', label: 'Im Scope' }, { id: 'scopeDraussen', label: 'Nicht im Scope' }, { id: 'entscheidungsrechte', label: 'Entscheidungsrechte' },
];
const WIE = [{ id: 'kickoff' as const, label: 'im Kick-off' }, { id: 'termin' as const, label: 'im Termin' }, { id: 'mail' as const, label: 'per Mail' }];

function VereinbarungKarte({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<boolean> }) {
  const v = daten.fall!.vereinbarung ?? {};
  const stand = daten.staende?.vereinbarung;
  const [w, setW] = useState<Record<string, string>>(() => Object.fromEntries(V_FELDER.map(f => [f.id, (v[f.id] as string | undefined) ?? ''])));
  const [wie, setWie] = useState<'kickoff' | 'termin' | 'mail'>(v.bestaetigtWie ?? 'kickoff');
  const speichern = (extra: Record<string, unknown> = {}) => ops([{ op: 'vereinbarung', felder: { ...Object.fromEntries(V_FELDER.map(f => [f.id, w[f.id] || null])), ...extra }, ...(stand ? { stand } : {}) }]);
  return (
    <Karte i={2}>
      <Ueberschrift erklaerung="fulfillment.vereinbarung" rechts={v.bestaetigtAm ? <Chip farbe={LEUCHT.gut}>bestätigt {tagKurz(v.bestaetigtAm)}</Chip> : undefined}>Zusammenarbeits-Vereinbarung</Ueberschrift>
      {V_FELDER.map(f => (
        <Feldzeile key={f.id} label={f.label}><textarea rows={2} value={w[f.id]} onChange={e => setW({ ...w, [f.id]: e.target.value })} style={{ ...feld, fontSize: 16 }} /></Feldzeile>
      ))}
      <Leiste>
        <Knopf leise onClick={() => speichern()}>Speichern</Knopf>
        {!v.bestaetigtAm && <><Pillen liste={WIE} aktiv={wie} onWahl={setWie} /><Knopf onClick={() => speichern({ bestaetigtAm: localDay(), bestaetigtWie: wie })}>Als bestätigt vermerken</Knopf></>}
        {v.bestaetigtAm && <Knopf leise onClick={() => speichern({ bestaetigtAm: null, bestaetigtWie: null })}>Bestätigung lösen</Knopf>}
      </Leiste>
    </Karte>
  );
}

const E_STATUS: { id: Entscheidung['status']; label: string }[] = [{ id: 'offen', label: 'offen' }, { id: 'entschieden', label: 'entschieden' }, { id: 'verworfen', label: 'verworfen' }];
const WER: { id: Entscheidung['wer']; label: string }[] = [{ id: 'kunde', label: 'Kunde entscheidet' }, { id: 'intern', label: 'wir entscheiden' }, { id: 'beide', label: 'gemeinsam' }];

function EntscheidungenKarte({ daten, ops }: { daten: FallAntwort; ops: (o: Record<string, unknown>[]) => Promise<boolean> }) {
  const f = daten.fall!;
  const [titel, setTitel] = useState('');
  const [wer, setWer] = useState<Entscheidung['wer']>('kunde');
  const [frist, setFrist] = useState('');
  const [geteilt, setGeteilt] = useState(false);
  const liste = [...f.entscheidungen].sort((a, b) => (a.am < b.am ? 1 : -1));
  return (
    <Karte i={3}>
      <Ueberschrift rechts={<span>{f.entscheidungen.filter(e => e.status === 'offen').length} offen</span>}>Entscheidungs-Log</Ueberschrift>
      {liste.length > 0 && (
        <Liste>
          {liste.map(e => (
            <div key={e.id} style={{ display: 'grid', gap: 4, padding: '6px 0' }}>
              <Zeile titel={e.titel} umbrechen unter={`${tagKurz(e.am)} · ${WER.find(x => x.id === e.wer)?.label}${e.frist ? ` · Frist ${tagKurz(e.frist)}` : ''}${e.geteilt ? ' · mit dem Kunden geteilt' : ''}${e.inhalt ? ` · ${e.inhalt}` : ''}`}
                rechts={<Wahl label="Status" klein liste={E_STATUS} wert={e.status} onWahl={status => ops([{ op: 'entscheidung', eintrag: { id: e.id, status }, stand: e.stand }])} />} />
            </div>
          ))}
        </Liste>
      )}
      <form onSubmit={x => { x.preventDefault(); if (titel.trim()) void ops([{ op: 'entscheidung', eintrag: { titel: titel.trim(), wer, geteilt, ...(frist ? { frist } : {}) } }]).then(ok => { if (ok) { setTitel(''); setFrist(''); } }); }} style={{ display: 'grid', gap: 8 }}>
        <input value={titel} onChange={x => setTitel(x.target.value)} placeholder="Neue Entscheidung" aria-label="Neue Entscheidung" style={feld} />
        <Leiste>
          <Pillen liste={WER} aktiv={wer} onWahl={setWer} />
          <input type="date" value={frist} onChange={x => setFrist(x.target.value)} aria-label="Frist" style={{ ...feld, width: 170 }} />
        </Leiste>
        <Schalter an={geteilt} onChange={setGeteilt} erklaerung="fulfillment.entscheidungGeteilt">Mit dem Kunden geteilt</Schalter>
        <div><Knopf typ="submit" aus={!titel.trim()}>Eintragen</Knopf></div>
      </form>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Offene Entscheidungen, die der Kunde trifft, stehen unter „wartet auf euch“ und im Report.</div>
    </Karte>
  );
}
