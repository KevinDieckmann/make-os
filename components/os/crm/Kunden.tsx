'use client';

// ─── Mandate (Produkte & Mandate, /os/mandate) — und die Kurzfassung für Sales ───
// Seit 25.09. leben die Mandate im eigenen Bereich links unter Aufgaben (Kevin:
// „Mandaten-Abteil … Produkte und Mandate“); Deals › Kunden zeigt nur noch
// die Kurzfassung mit Sprung dorthin (KundenKurz). Je Mandat jetzt auch das
// Produkt und die Phase in dessen Ablauf. Die Produkte: components/os/mandate/Produkte.tsx.
// Oben MRR und Kundenkonzentration. Je Mandat: Status, Laufzeit und Frist,
// Health (DEAR: Beteiligung, Umsetzung, Wirkung, Zahlung, Stimmung), die
// offenen Punkte und Widersprüche — sichtbar, nicht geglättet — und ob das
// Mandat im Liquiditätsplan steht.
// Zu zweit (25.09.): Je Mandat ist jemand zuständig (ohne Eintrag Kevin als
// Sales-Verantwortung) — Filter „Alle · Meins · Malin“, Plakette, Zeile je
// Person, Übergeben. Änderungen gehen als Einzelfelder raus (api.teil).
// 28.09.: Filter nach Gesellschaft (Alle · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH)
// neben dem Personen-Filter; „+ Mandat“ übernimmt die gefilterte Gesellschaft. Rechnungen
// aus dem Honorar landen bei der Gesellschaft des Mandats (firmaFuerGesellschaft).

import { TermineAkte } from '../kalender/TermineAkte';
import { localDay, tagePlus } from '@/lib/zeit';
import { bruttoAusNetto } from '@/lib/finanzen/ust';
import { useLinkAuswahl } from '../Verlauf';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { mandateLink } from '@/lib/crm/adresse';
import { WEG } from '@/lib/wege';
import { rechnungPasst } from '@/lib/crm/kunden';
import { mandatPhase, portfolio } from '@/lib/crm/produkte';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, Segmente, useBreit, LEUCHT } from '../ui';
import { anzeigename } from '@/lib/make-one/crm';
import { HEALTH_GEWICHTE, HEALTH_LABEL, kundenJePerson, GESELLSCHAFT_FILTER, passtGesellschaft, type GesellschaftFilter } from '@/lib/crm/kunden';
import { werZahlen } from '@/lib/crm/pipeline';
import { zustaendig, mitglied, nameVon } from '@/lib/crm/team';
import type { Mandat } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, euro, kurzEuro, nurFelder } from './daten';
import { Feldzeile, Feld } from './teile';
import { Wahl } from './Wahl';
import { GESELLSCHAFT_WAHL } from '@/lib/crm/wahl';
import { firmaFuerGesellschaft } from '@/lib/einheiten';
import { firmaVonMandat } from '@/lib/crm/firmen-bezug';
import { MandantLink } from './MandantLink';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';
import { useZiel, useZuZiel } from '../ziel';
import { MandatZeitMonat } from '../zeit/ZeitJeMandat';
import { neueKennung } from '@/lib/kennung';

const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const STATUS: { id: Mandat['status']; label: string }[] = [{ id: 'angebot', label: 'Angebot' }, { id: 'verhandlung', label: 'Verhandlung' }, { id: 'aktiv', label: 'Aktiv' }, { id: 'pausiert', label: 'Pausiert' }, { id: 'beendet', label: 'Beendet' }];
const VERTRAG = [{ id: 'ja', label: 'unterschrieben' }, { id: 'nein', label: 'nicht unterschrieben' }] as const;
const HONORAR_BASIS = [{ id: 'monat', label: 'je Monat' }, { id: 'einmalig', label: 'einmalig' }, { id: 'tag', label: 'je Tag' }] as const;
const NETTO = [{ id: 'netto', label: 'netto' }, { id: 'brutto', label: 'brutto' }] as const;
const UST = [{ id: '19', label: '19 % USt' }, { id: '0', label: 'Reverse Charge' }] as const;
const VERLAENGERUNG = [{ id: 'auto', label: 'verlängert sich' }, { id: 'manuell', label: 'endet' }, { id: 'offen', label: 'offen' }] as const;
const statusFarbe = (s: string) => (s === 'aktiv' ? LEUCHT.gut : s === 'verhandlung' || s === 'angebot' ? LEUCHT.business : C.inkLeise);
interface LiquiLage { id: string; lage: 'fehlt' | 'ok' | 'abweichend' | 'kein-posten'; vorschlag: { betrag: number; ab: string; rhythmus: string } | null; vorhanden: { id: string; betrag: number } | null }

/** Alle Mandate mit Kennzahlen, Filter und Detail — der Hauptteil von Produkte & Mandate. */
export function MandateUebersicht({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  // Offenes Mandat bzw. offene Leistung im Link (k): Zurück schließt es wieder.
  const [auswahl, setAuswahl] = useLinkAuswahl();
  // Am Handy: Hinweise in die Zeile darunter — sonst drücken die Chips den Kundennamen weg.
  const breit = useBreit();
  const [liqui, setLiqui] = useState<{ mandate: LiquiLage[]; freiePosten: { id: string; titel: string; betrag: number }[] } | null>(null);
  const [alle, setAlle] = useState(false);
  const [wahl, setWahl] = useWerFilter('kunden');
  // Filter nach Gesellschaft (28.09.): Alle · Selbstständigkeit · KD Ventures · MAKE Innovation GmbH — zusätzlich zur Person.
  const [ges, setGes] = useState<GesellschaftFilter>('alle');
  // Kommt man über einen Link auf ein Mandat, springt die Liste einmal dorthin.
  useZuZiel(useZiel('k'), !!api.crm);
  const ladeLiqui = () => fetch('/api/crm/liquiplan').then(r => r.json()).then(d => d.ok && setLiqui(d)).catch(() => {});
  useEffect(() => { void ladeLiqui(); }, []);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const ich = api.ich;
  const REIHE = ['aktiv', 'verhandlung', 'angebot', 'pausiert', 'beendet'];
  const mandate = [...crm.stand.mandate].sort((a, b) => REIHE.indexOf(a.status) - REIHE.indexOf(b.status) || a.kunde.localeCompare(b.kunde));
  const laufend = mandate.filter(m => m.status !== 'beendet');
  const gefiltert = mandate.filter(m => passtWer(wahl, m.zustaendig, 'sales', ich) && passtGesellschaft(ges, m.gesellschaft));
  // Ein Mandat aus einem Link (z. B. hinter der Kündigungsrate) ist immer sichtbar — auch beendet oder bei jemand anderem.
  const gewaehlt = auswahl ? mandate.find(m => m.id === auswahl) : undefined;
  const basis = alle ? gefiltert : gefiltert.filter(m => m.status !== 'beendet');
  const sichtbar = gewaehlt && !basis.includes(gewaehlt) ? [...basis, gewaehlt] : basis;
  const beendetVerborgen = gefiltert.length - gefiltert.filter(m => m.status !== 'beendet').length;
  const zahlen = werZahlen(laufend, m => m.zustaendig, 'sales', ich);
  const offenePunkte = laufend.reduce((a, m) => a + m.offen.length, 0);
  const radar = mandate.filter(m => m.status === 'aktiv' && (crm.mandate[m.id]?.endeIn ?? 999) <= 90);
  const jePerson = kundenJePerson(crm.stand.mandate, crm.heute, crm.mandate);
  const meine = ich ? jePerson.find(x => x.person === ich) : undefined;
  // Neues Mandat: für die gefilterte Person, sonst für mich (im Team) — ohne beides gilt die Sales-Verantwortung.
  const neuFuer = wahl !== 'alle' && wahl !== 'ich' && mitglied(wahl) ? wahl : mitglied(ich)?.id;
  const produktName = (m: Mandat) => { const p = crm.stand.leistungen.find(x => x.id === m.leistungId); const ph = mandatPhase(m, p); return p ? `${p.name.slice(0, 40)}${ph ? ` · Phase ${ph.nr}/${ph.von}` : ''}` : ''; };

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={() => { const id = neueId('m'); void api.setze('mandate', { id, kunde: 'Neuer Kunde', titel: 'Mandat', kontaktIds: [], art: 'retainer', gesellschaft: ges !== 'alle' ? ges : 'offen', status: 'verhandlung', vertragUnterschrieben: false, verlaengerung: 'offen', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], ...(neuFuer ? { zustaendig: neuFuer } : {}) }); setAuswahl(id); }}>+ Mandat</Knopf>}>Überblick</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={kurzEuro(crm.mrr)} label="wiederkehrend je Monat (netto)" farbe={LEUCHT.geld} />
          <Zahl wert={String(mandate.filter(m => m.status === 'aktiv').length)} label="aktive Mandate" />
          <Zahl wert={crm.konzentration ? `${crm.konzentration.anteil} %` : '—'} label={crm.konzentration ? `größter Kunde: ${crm.konzentration.kunde.slice(0, 22)}` : 'Kundenkonzentration'} farbe={crm.konzentration && crm.konzentration.anteil > 50 ? LEUCHT.kritisch : undefined} />
          <Zahl wert={String(offenePunkte)} label="offene Punkte & Widersprüche" farbe={offenePunkte ? LEUCHT.achtung : undefined} />
        </Raster>
        {crm.konzentration && crm.konzentration.anteil > 50 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, marginTop: 10 }}>Mehr als die Hälfte des wiederkehrenden Umsatzes hängt an einem Kunden — der Head of Sales priorisiert neue Mandate.</div>}
        {radar.length > 0 && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, marginTop: 6 }}>Laufzeitradar: {radar.map(m => { const t = crm.mandate[m.id]?.endeIn ?? 0; return `${m.kunde} (${t < 0 ? `seit ${-t} Tagen abgelaufen — Status klären` : `endet in ${t} Tagen`})`; }).join(' · ')}</div>}
        {jePerson.length > 1 && (
          <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
            {jePerson.map(x => (
              <div key={x.person} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
                <span style={{ minWidth: 76 }}><Person id={x.person} name groesse={18} /></span>
                <span>{x.aktiv} aktiv</span>
                <span><b style={{ color: C.ink }}>{kurzEuro(x.mrr)}</b> je Monat</span>
                {x.reviews > 0 && <span style={{ color: LEUCHT.achtung }}>{x.reviews} {x.reviews === 1 ? 'Review' : 'Reviews'} in 7 Tagen</span>}
                {x.kritisch > 0 && <span style={{ color: LEUCHT.kritisch }}>{x.kritisch} kritisch</span>}
                {x.offen > 0 && <span>{x.offen} offene Punkte</span>}
              </div>
            ))}
          </div>
        )}
        {meine && (meine.kritisch > 0 || meine.reviews > 0) && (
          <div style={{ fontSize: TYP.bedien, color: C.ink, marginTop: 10 }}>Als Nächstes: {meine.kritisch > 0 ? `${meine.kritisch} deiner Mandate ${meine.kritisch === 1 ? 'ist' : 'sind'} kritisch — Health prüfen, offene Punkte klären, Verlängerung ansprechen.` : `${meine.reviews} Kundenreview${meine.reviews === 1 ? '' : 's'} in den nächsten 7 Tagen — Health bewerten, offene Punkte klären.`}</div>
        )}
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={`${sichtbar.length} ${sichtbar.length === 1 ? 'Mandat' : 'Mandate'}`}>Mandate</Ueberschrift>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
            <span role="group" aria-label="Nach Gesellschaft filtern"><Segmente liste={GESELLSCHAFT_FILTER.map(g => ({ id: g.id, label: breit ? g.label : g.kurz }))} aktiv={ges} onWahl={setGes} /></span>
          </div>
          <button onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien }}>{alle ? 'Beendete ausblenden' : `Beendete zeigen (${beendetVerborgen})`}</button>
        </div>
        <Liste>
          {sichtbar.map(m => {
            const l = crm.mandate[m.id];
            const lq = liqui?.mandate.find(x => x.id === m.id);
            return (
              <div key={m.id} id={`ziel-${m.id}`}>
                <Zeile onClick={() => setAuswahl(auswahl === m.id ? null : m.id)} aktiv={auswahl === m.id}
                  links={<Punkt farbe={l?.ampel ? AMPEL[l.ampel] : statusFarbe(m.status)} />}
                  titel={<>{m.kunde}<span style={{ color: C.inkLeise }}> · {m.titel}</span></>}
                  unter={[produktName(m), ...(!breit ? [lq?.lage === 'fehlt' ? 'nicht im Liquiplan' : lq?.lage === 'abweichend' ? 'Liquiplan weicht ab' : '', !m.vertragUnterschrieben && m.status !== 'beendet' ? 'ohne Vertrag' : ''] : []), m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'Honorar offen', l?.endeAm ? `bis ${datum(l.endeAm)}` : '', l?.health != null ? `Health ${l.health}` : '', m.offen.length ? `${m.offen.length} offen` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {breit && lq?.lage === 'fehlt' && <Chip farbe={LEUCHT.achtung}>nicht im Liquiplan</Chip>}
                    {breit && lq?.lage === 'abweichend' && <Chip farbe={LEUCHT.achtung}>Liquiplan weicht ab</Chip>}
                    {breit && !m.vertragUnterschrieben && m.status !== 'beendet' && <Chip farbe={C.inkLeise}>ohne Vertrag</Chip>}
                    <Chip farbe={statusFarbe(m.status)}>{STATUS.find(s => s.id === m.status)?.label}</Chip>
                    <Person id={zustaendig(m.zustaendig, 'sales')} groesse={18} />
                  </span>} />
                {auswahl === m.id && <MandatDetail m={m} api={api} lq={lq} frei={liqui?.freiePosten ?? []} neuLaden={ladeLiqui} zuKontakt={zuKontakt} />}
              </div>
            );
          })}
        </Liste>
        {!sichtbar.length && <Leer>{mandate.length && wahl !== 'alle' ? `Hier liegt kein laufendes Mandat bei ${wahl === 'ich' ? 'dir' : nameVon(wahl)} — „Alle“ zeigen oder ein Mandat übergeben.` : 'Noch keine Mandate.'}</Leer>}
      </Karte>

      <HeadPanel head="sales" standardModus="kundenreview" zuKontakt={zuKontakt} i={2} />
    </>
  );
}

function MandatDetail({ m, api, lq, frei, neuLaden, zuKontakt }: { m: Mandat; api: CrmApi; lq?: LiquiLage; frei: { id: string; titel: string; betrag: number }[]; neuLaden: () => void; zuKontakt: (id: string) => void }) {
  const crm = api.crm!;
  const l = crm.mandate[m.id];
  // Nur die geänderten Felder — Kevin und Malin können gleichzeitig am selben Mandat arbeiten.
  const setze = (teil: Partial<Mandat>) => api.teil('mandate', m.id, nurFelder(teil));
  const produkt = m.leistungId ? crm.stand.leistungen.find(x => x.id === m.leistungId) : undefined;
  const firma = firmaVonMandat(m, crm.stand.firmen);
  const personen = m.kontaktIds.map(id => (api.kontakte ?? []).find(k => k.id === id)).filter((k): k is NonNullable<typeof k> => !!k);
  const liquiplan = async (aktion: 'anlegen' | 'verknuepfen', postenId?: string) => {
    await fetch('/api/crm/liquiplan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mandatId: m.id, aktion, postenId }) });
    neuLaden(); void api.laden();
  };
  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      {m.offen.length > 0 && (
        <div style={{ padding: 12, borderRadius: 12, background: `${LEUCHT.achtung}10`, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: LEUCHT.achtung, letterSpacing: '.06em', textTransform: 'uppercase' }}>Offen & widersprüchlich</div>
          {m.offen.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
              <span style={{ flex: 1 }}>{o}</span>
              <button onClick={() => setze({ offen: m.offen.filter((_, j) => j !== i) })} title="Geklärt" aria-label="Geklärt" style={{ background: 'none', border: 'none', color: LEUCHT.gut, cursor: 'pointer' }}>✓</button>
            </div>
          ))}
        </div>
      )}
      <Feldzeile label="Zuständig">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <ZustaendigWahl wert={m.zustaendig} welt="sales" onWahl={z => void api.teil('mandate', m.id, { zustaendig: z })} />
          <Uebergeben api={api} art="mandat" id={m.id} jetzt={zustaendig(m.zustaendig, 'sales')} klein />
        </div>
      </Feldzeile>
      {m.chanceId && <Feldzeile label="Deal"><Link href={WEG.deal(m.chanceId)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>Deal öffnen ›</Link></Feldzeile>}
      <Feldzeile label="Status"><Wahl label="Status" liste={STATUS} wert={m.status} onWahl={status => setze({ status })} /></Feldzeile>
      <Feldzeile label="Vertrag"><Wahl label="Vertrag" liste={VERTRAG} wert={m.vertragUnterschrieben ? 'ja' : 'nein'} farbe={m.vertragUnterschrieben ? LEUCHT.gut : C.aktiv} onWahl={x => setze({ vertragUnterschrieben: x === 'ja' })} /></Feldzeile>
      <Feldzeile label="Kunde"><Feld wert={m.kunde} onFertig={kunde => kunde.trim() && setze({ kunde: kunde.trim() })} /></Feldzeile>
      {/* Mandanten klickbar (28.09.): das Mandat führt zurück in die Firmenakte (per Kennung, sonst eindeutiger Name). */}
      {firma ? <Feldzeile label="Firma"><span style={{ fontSize: TYP.bedien }}><MandantLink firmaId={firma.id} firmaDa name={firma.name} /></span></Feldzeile>
        : m.firmaId ? <Feldzeile label="Firma"><span style={{ fontSize: TYP.bedien }}><MandantLink firmaId={m.firmaId} firmaDa={false} name={m.kunde} /></span></Feldzeile> : null}
      <Feldzeile label="Titel"><Feld wert={m.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Produkt">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Wahl label="Produkt" liste={crm.stand.leistungen.filter(x => x.status !== 'eingestellt' || x.id === m.leistungId).map(x => ({ id: x.id, label: x.name }))} wert={m.leistungId}
            onWahl={leistungId => leistungId !== m.leistungId && setze({ leistungId, phase: undefined })} onLeeren={() => setze({ leistungId: undefined, phase: undefined })} />
          {produkt && <Link href={mandateLink('produkte', produkt.id)} style={{ fontSize: TYP.bedien, color: C.inkDim, textDecoration: 'none' }}>Produkt öffnen ›</Link>}
        </div>
      </Feldzeile>
      {produkt && (produkt.phasen?.length
        ? <Feldzeile label="Phase"><Wahl label="Phase" liste={produkt.phasen.map(p => ({ id: p.id, label: p.name }))} wert={m.phase ?? produkt.phasen[0].id} onWahl={phase => setze({ phase })} farbe={LEUCHT.business} /></Feldzeile>
        : <Feldzeile label="Phase"><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Das Produkt hat noch keinen Ablauf — unter Produkte anlegen.</span></Feldzeile>)}
      <Feldzeile label="Honorar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={m.honorar.betrag ? String(m.honorar.betrag) : ''} breite={120} platzhalter="€" onFertig={b => setze({ honorar: { ...m.honorar, betrag: Number(b) || 0 } })} />
          <Wahl label="Honorar-Basis" liste={HONORAR_BASIS} wert={m.honorar.basis} onWahl={basis => setze({ honorar: { ...m.honorar, basis } })} />
          <Wahl label="netto oder brutto" liste={NETTO} wert={m.honorar.netto ? 'netto' : 'brutto'} onWahl={x => setze({ honorar: { ...m.honorar, netto: x === 'netto' } })} />
          <Wahl label="Umsatzsteuer" liste={UST} wert={String(m.ustSatz) === '0' ? '0' : String(m.ustSatz) === '19' ? '19' : null} onWahl={x => setze({ ustSatz: Number(x) })} />
        </div>
      </Feldzeile>
      {/* Mandat an Zielen und Zeit (28.09.): erfasste Fokus-Zeit dieses Mandats im laufenden Monat */}
      <Feldzeile label="Zeit"><MandatZeitMonat mandatId={m.id} /></Feldzeile>
      {/* K3 (30.09.): am Mandat verknüpfte Termine (kalender-bezug), Klick öffnet den Kalender. */}
      <Feldzeile label="Termine"><TermineAkte frage={{ mandate: [m.id] }} heute={crm.heute} /></Feldzeile>
      <Feldzeile label="Laufzeit">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="date" wert={m.start} breite={150} platzhalter="Start" onFertig={start => setze({ start: start || undefined })} />
          <span style={{ color: C.inkLeise }}>bis</span>
          <Feld typ="date" wert={m.ende} breite={150} platzhalter="Ende" onFertig={ende => setze({ ende: ende || undefined })} />
          <Feld typ="number" wert={m.kuendigungsfristTage ? String(m.kuendigungsfristTage) : ''} breite={120} platzhalter="Frist Tage" onFertig={f => setze({ kuendigungsfristTage: Number(f) || undefined })} />
          <Wahl label="Verlängerung" liste={VERLAENGERUNG} wert={m.verlaengerung} onWahl={verlaengerung => setze({ verlaengerung })} />
        </div>
        {l?.endeAm && <div style={{ fontSize: TYP.bedien, color: l.endeIn !== null && l.endeIn <= 90 ? LEUCHT.achtung : C.inkLeise, marginTop: 4 }}>Ende {datum(l.endeAm)} ({l.endeIn} Tage){l.fristBis && l.fristBis !== l.endeAm ? ` · kündbar bis ${datum(l.fristBis)}` : ''}</div>}
      </Feldzeile>
      <Feldzeile label="Gesellschaft"><Wahl label="Gesellschaft" liste={GESELLSCHAFT_WAHL} wert={m.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      <Feldzeile label="Nächstes Review"><Feld typ="date" wert={m.naechstesReview} breite={160} platzhalter="Datum" onFertig={r => setze({ naechstesReview: r || undefined })} /></Feldzeile>
      <div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 6 }}>Health {l?.health != null ? `· ${l.health}` : '— noch nicht bewertet'} (unter 60 rot, bis 75 gelb){m.health.zahlung === null && crm.zahlung?.[m.id] ? ` · Zahlung aus dem Finanzplan: ${crm.zahlung[m.id]!.wert} (${crm.zahlung[m.id]!.text})` : ''}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(HEALTH_GEWICHTE) as (keyof typeof HEALTH_GEWICHTE)[]).map(f => (
            <div key={f} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 44px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{HEALTH_LABEL[f]} <span style={{ color: C.inkLeise }}>{HEALTH_GEWICHTE[f]}</span></span>
              {m.health[f] == null
                ? <button onClick={() => setze({ health: { ...m.health, [f]: 70 } })} style={{ justifySelf: 'start', background: 'none', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 8, color: C.inkLeise, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 10px' }}>bewerten</button>
                : <input type="range" min={0} max={100} step={5} value={m.health[f]!} aria-label={HEALTH_LABEL[f]} onChange={e => setze({ health: { ...m.health, [f]: Number(e.target.value) } })} style={{ accentColor: m.health[f]! >= 75 ? LEUCHT.gut : m.health[f]! >= 60 ? LEUCHT.achtung : LEUCHT.kritisch }} />}
              <span style={{ fontSize: TYP.bedien, color: m.health[f] == null ? C.inkLeise : C.ink, textAlign: 'right' }}>{m.health[f] ?? '–'}</span>
            </div>
          ))}
        </div>
      </div>
      <Feldzeile label="Liquiditätsplan">
        {lq?.lage === 'ok' && <Link href={WEG.planposten(lq.vorhanden?.id)} style={{ fontSize: TYP.bedien, color: LEUCHT.gut, textDecoration: 'none' }}>steht drin — Posten öffnen ›</Link>}
        {lq?.lage === 'kein-posten' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>kein Posten (Status oder Honorar fehlt)</span>}
        {(lq?.lage === 'fehlt' || lq?.lage === 'abweichend') && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>{lq.lage === 'fehlt' ? `Fehlt: würde ${euro(lq.vorschlag!.betrag)} brutto ${lq.vorschlag!.rhythmus} ab ${datum(lq.vorschlag!.ab)} eintragen.` : `Weicht ab: Plan ${euro(lq.vorhanden!.betrag)}, Mandat ${euro(lq.vorschlag!.betrag)}.`}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Knopf leise onClick={() => liquiplan('anlegen')}>{lq.lage === 'fehlt' ? 'Eintragen' : 'Plan angleichen'}</Knopf>
              {lq.lage === 'fehlt' && frei.slice(0, 4).map(p => <Knopf key={p.id} leise onClick={() => liquiplan('verknuepfen', p.id)}>= {p.titel.slice(0, 26)} ({euro(p.betrag)})</Knopf>)}
            </div>
          </div>
        )}
      </Feldzeile>
      <Feldzeile label="Ansprechpartner">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{personen.map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 999, padding: '5px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>{anzeigename(k)}</button>)}{!personen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>—</span>}</div>
      </Feldzeile>
      <MandatRechnungen m={m} />
      {m.leistungen.length > 0 && <div><div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 4 }}>Leistungen</div><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>{m.leistungen.map((x, i) => <li key={i} style={{ fontSize: TYP.bedien, color: C.inkDim }}>{x}</li>)}</ul></div>}
      <Feldzeile label="Offener Punkt"><Feld platzhalter="Neuer offener Punkt …" onFertig={t => t.trim() && setze({ offen: [...m.offen, t.trim()] })} /></Feldzeile>
      {m.quelle && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Quelle: {m.quelle}</div>}
    </div>
  );
}

/**
 * Deals › Kunden (seit 25.09., Reiter seit 27.09.): nur noch die Kurzfassung — Monatsumsatz,
 * laufende Mandate, ein Klick öffnet das Mandat unter Produkte & Mandate.
 */
export function KundenKurz({ api }: { api: CrmApi }) {
  const router = useRouter();
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const p = portfolio(crm.stand);
  const REIHE = ['aktiv', 'verhandlung', 'angebot', 'pausiert'];
  const laufend = crm.stand.mandate.filter(m => m.status !== 'beendet').sort((a, b) => REIHE.indexOf(a.status) - REIHE.indexOf(b.status) || a.kunde.localeCompare(b.kunde));
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<Link href={mandateLink()} style={{ color: LEUCHT.business, textDecoration: 'none', fontSize: TYP.bedien, fontWeight: 600 }}>Produkte & Mandate ›</Link>}>Ebene 3 · Kunden</Ueberschrift>
      <Raster min={150}>
        <Zahl wert={kurzEuro(p.mrr)} label="wiederkehrend je Monat (netto)" farbe={LEUCHT.geld} />
        <Zahl wert={String(p.aktiv)} label="aktive Mandate" />
        <Zahl wert={p.groessterKunde ? `${Math.round(p.groessterKunde.anteil * 100)} %` : '—'} label={p.groessterKunde ? `größter Kunde: ${p.groessterKunde.kunde.slice(0, 22)}` : 'Kundenkonzentration'} farbe={p.groessterKunde && p.groessterKunde.anteil > 0.5 ? LEUCHT.kritisch : undefined} />
      </Raster>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '10px 0 4px', lineHeight: 1.5 }}>Die Mandate und Produkte leben unter „Produkte & Mandate“ (links in der Leiste). Aus einem gewonnenen Deal entsteht das Mandat wie bisher über „Mandat anlegen“.</div>
      <Liste>
        {laufend.map(m => (
          <Zeile key={m.id} onClick={() => router.push(mandateLink('mandate', m.id))} links={<Punkt farbe={crm.mandate[m.id]?.ampel ? AMPEL[crm.mandate[m.id]!.ampel!] : statusFarbe(m.status)} />}
            titel={<>{m.kunde}<span style={{ color: C.inkLeise }}> · {m.titel}</span></>}
            unter={m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'Honorar offen'}
            rechts={<Chip farbe={statusFarbe(m.status)}>{STATUS.find(s => s.id === m.status)?.label}</Chip>} />
        ))}
      </Liste>
      {!laufend.length && <Leer>Noch keine laufenden Mandate.</Leer>}
    </Karte>
  );
}

interface RechnungKurz { id: string; kunde: string; titel: string; betrag: number; status: string; faellig?: string; bezahltAm?: string; mandatId?: string; firmaId?: string }

/** Rechnungen zum Mandat (26.09.): was gestellt, offen, überfällig ist — je Zeile die Rechnung; „Rechnung anlegen“ legt sie vorbelegt an. */
function MandatRechnungen({ m }: { m: Mandat }) {
  const router = useRouter();
  const [liste, setListe] = useState<RechnungKurz[] | null>(null);
  const heute = localDay();
  useEffect(() => { fetch('/api/state/finanzplan').then(r => r.json()).then(d => setListe((d.rechnungen ?? []) as RechnungKurz[])).catch(() => setListe([])); }, [m.id]);
  const eigene = (liste ?? []).filter(r => r.mandatId === m.id || (!r.mandatId && rechnungPasst(m, r))).sort((a, b) => (b.faellig ?? '').localeCompare(a.faellig ?? ''));
  const offen = eigene.filter(r => r.status === 'gestellt');
  const ueber = offen.filter(r => r.faellig && r.faellig < heute);
  const anlegen = async () => {
    const id = neueKennung('r');
    // Eine USt-Funktion, auf den Cent (28.09., K3); fällig ab dem Berliner Tag, nicht dem UTC-Tag.
    const brutto = m.honorar.netto ? bruttoAusNetto(m.honorar.betrag, m.ustSatz) : m.honorar.betrag;
    const eintrag = { id, kunde: m.kunde, titel: m.titel, betrag: brutto, status: 'geplant', firmaId: firmaFuerGesellschaft(m.gesellschaft), mandatId: m.id, ustSatz: m.ustSatz, ...(m.honorar.netto ? { netto: m.honorar.betrag } : {}), faellig: tagePlus(heute, m.zahlungszielTage || 0) };
    const r = await fetch('/api/state/finanzplan', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ops: [{ liste: 'rechnungen', op: 'upsert', eintrag }] }) }).then(x => x.json()).catch(() => null);
    if (r?.ok !== false) router.push(WEG.rechnung(id));
  };
  return (
    <Feldzeile label="Rechnungen">
      <div style={{ display: 'grid', gap: 6 }}>
        {liste === null && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>lädt …</span>}
        {liste && !eigene.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>noch keine Rechnung zu diesem Mandat</span>}
        {eigene.slice(0, 5).map(r => (
          <Link key={r.id} href={WEG.rechnung(r.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien, color: C.ink, textDecoration: 'none' }}>
            <Punkt farbe={r.status === 'bezahlt' ? LEUCHT.gut : r.faellig && r.faellig < heute ? LEUCHT.kritisch : r.status === 'gestellt' ? LEUCHT.achtung : C.inkLeise} groesse={7} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titel || r.kunde} <span style={{ color: C.inkLeise }}>· {r.status}{r.faellig ? ` · fällig ${datum(r.faellig)}` : ''}</span></span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euro(r.betrag)}</span><span style={{ color: C.inkLeise }}>›</span>
          </Link>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {m.honorar.betrag > 0 && <Knopf leise onClick={() => void anlegen()}>+ Rechnung aus dem Honorar</Knopf>}
          {ueber.length > 0 && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{ueber.length} überfällig</span>}
          {eigene.length > 5 && <Link href={WEG.rechnungen()} style={{ fontSize: TYP.bedien, color: C.inkLeise }}>alle ›</Link>}
        </div>
      </div>
    </Feldzeile>
  );
}
