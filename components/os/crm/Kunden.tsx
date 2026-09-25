'use client';

// ─── Markttraktion · Sales › Kunden & Mandate — und der Leistungskatalog ─────────────────────
// Oben MRR und Kundenkonzentration. Je Mandat: Status, Laufzeit und Frist,
// Health (DEAR: Beteiligung, Umsetzung, Wirkung, Zahlung, Stimmung), die
// offenen Punkte und Widersprüche — sichtbar, nicht geglättet — und ob das
// Mandat im Liquiditätsplan steht. Darunter der Leistungskatalog.
// Zu zweit (25.09.): Je Mandat ist jemand zuständig (ohne Eintrag Kevin als
// Sales-Verantwortung) — Filter „Alle · Meins · Malin“, Plakette, Zeile je
// Person, Übergeben. Änderungen gehen als Einzelfelder raus (api.teil).

import { useLinkAuswahl } from '../Verlauf';
import { useEffect, useState } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, LEUCHT } from '../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { HEALTH_GEWICHTE, HEALTH_LABEL, kundenJePerson } from '@/lib/crm/kunden';
import { werZahlen } from '@/lib/crm/pipeline';
import { zustaendig, mitglied, nameVon } from '@/lib/crm/team';
import type { Mandat, Leistung } from '@/lib/crm/typen';
import { type CrmApi, neueId, datum, euro, kurzEuro } from './daten';
import { Feldzeile, Pillen, Feld } from './teile';
import { Person, ZustaendigWahl, Uebergeben, WerFilter, useWerFilter, passtWer } from './team';
import { HeadPanel } from './HeadPanel';

const AMPEL = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch } as const;
const STATUS: { id: Mandat['status']; label: string }[] = [{ id: 'angebot', label: 'Angebot' }, { id: 'verhandlung', label: 'Verhandlung' }, { id: 'aktiv', label: 'Aktiv' }, { id: 'pausiert', label: 'Pausiert' }, { id: 'beendet', label: 'Beendet' }];
const GES = [{ id: 'kdc', label: 'Selbstständigkeit' }, { id: 'kdv', label: 'KD Ventures' }, { id: 'ug', label: 'Neue UG' }, { id: 'offen', label: 'offen' }] as const;
const statusFarbe = (s: string) => (s === 'aktiv' ? LEUCHT.gut : s === 'verhandlung' || s === 'angebot' ? LEUCHT.business : C.inkLeise);
/** Einzeländerung: nur diese Felder; „undefined“ heißt leeren (als '' gesendet — der Server lässt das Feld dann weg). */
const nurFelder = (t: Record<string, unknown>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v === undefined ? '' : v]));
interface LiquiLage { id: string; lage: 'fehlt' | 'ok' | 'abweichend' | 'kein-posten'; vorschlag: { betrag: number; ab: string; rhythmus: string } | null; vorhanden: { id: string; betrag: number } | null }

export function Kunden({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  // Offenes Mandat bzw. offene Leistung im Link (k): Zurück schließt es wieder.
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const [liqui, setLiqui] = useState<{ mandate: LiquiLage[]; freiePosten: { id: string; titel: string; betrag: number }[] } | null>(null);
  const [alle, setAlle] = useState(false);
  const [wahl, setWahl] = useWerFilter('kunden');
  const ladeLiqui = () => fetch('/api/crm/liquiplan').then(r => r.json()).then(d => d.ok && setLiqui(d)).catch(() => {});
  useEffect(() => { void ladeLiqui(); }, []);
  const crm = api.crm;
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const ich = api.ich;
  const REIHE = ['aktiv', 'verhandlung', 'angebot', 'pausiert', 'beendet'];
  const mandate = [...crm.stand.mandate].sort((a, b) => REIHE.indexOf(a.status) - REIHE.indexOf(b.status) || a.kunde.localeCompare(b.kunde));
  const laufend = mandate.filter(m => m.status !== 'beendet');
  const gefiltert = mandate.filter(m => passtWer(wahl, m.zustaendig, 'sales', ich));
  const sichtbar = alle ? gefiltert : gefiltert.filter(m => m.status !== 'beendet');
  const beendetVerborgen = gefiltert.length - gefiltert.filter(m => m.status !== 'beendet').length;
  const zahlen = werZahlen(laufend, m => m.zustaendig, 'sales', ich);
  const offenePunkte = laufend.reduce((a, m) => a + m.offen.length, 0);
  const radar = mandate.filter(m => m.status === 'aktiv' && (crm.mandate[m.id]?.endeIn ?? 999) <= 90);
  const jePerson = kundenJePerson(crm.stand.mandate, crm.heute, crm.mandate);
  const meine = ich ? jePerson.find(x => x.person === ich) : undefined;
  // Neues Mandat: für die gefilterte Person, sonst für mich (im Team) — ohne beides gilt die Sales-Verantwortung.
  const neuFuer = wahl !== 'alle' && wahl !== 'ich' && mitglied(wahl) ? wahl : mitglied(ich)?.id;

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={() => { const id = neueId('m'); void api.setze('mandate', { id, kunde: 'Neuer Kunde', titel: 'Mandat', kontaktIds: [], art: 'retainer', gesellschaft: 'offen', status: 'verhandlung', vertragUnterschrieben: false, verlaengerung: 'offen', honorar: { betrag: 0, basis: 'monat', netto: true }, ustSatz: 19, rechnungsrhythmus: 'monatlich', zahlungszielTage: 14, ziele: [], health: {}, leistungen: [], offen: [], ...(neuFuer ? { zustaendig: neuFuer } : {}) }); setAuswahl(id); }}>+ Mandat</Knopf>}>Kunden & Mandate</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={kurzEuro(crm.mrr)} label="wiederkehrend je Monat (netto)" farbe={LEUCHT.geld} />
          <Zahl wert={String(mandate.filter(m => m.status === 'aktiv').length)} label="aktive Mandate" />
          <Zahl wert={crm.konzentration ? `${crm.konzentration.anteil} %` : '—'} label={crm.konzentration ? `größter Kunde: ${crm.konzentration.kunde.slice(0, 22)}` : 'Kundenkonzentration'} farbe={crm.konzentration && crm.konzentration.anteil > 50 ? LEUCHT.kritisch : undefined} />
          <Zahl wert={String(offenePunkte)} label="offene Punkte & Widersprüche" farbe={offenePunkte ? LEUCHT.achtung : undefined} />
        </Raster>
        {crm.konzentration && crm.konzentration.anteil > 50 && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch, marginTop: 10 }}>Mehr als die Hälfte des wiederkehrenden Umsatzes hängt an einem Kunden — der Head of Sales priorisiert neue Mandate.</div>}
        {radar.length > 0 && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, marginTop: 6 }}>Laufzeitradar: {radar.map(m => { const t = crm.mandate[m.id]?.endeIn ?? 0; return `${m.kunde} (${t < 0 ? `seit ${-t} Tagen abgelaufen — Status klären` : `endet in ${t} Tagen`})`; }).join(' · ')}</div>}
        {jePerson.length > 1 && (
          <div style={{ display: 'grid', gap: 5, marginTop: 12 }}>
            {jePerson.map(x => (
              <div key={x.person} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim }}>
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
          <div style={{ fontSize: 12.5, color: C.ink, marginTop: 10 }}>Als Nächstes: {meine.kritisch > 0 ? `${meine.kritisch} deiner Mandate ${meine.kritisch === 1 ? 'ist' : 'sind'} kritisch — Health prüfen, offene Punkte klären, Verlängerung ansprechen.` : `${meine.reviews} Kundenreview${meine.reviews === 1 ? '' : 's'} in den nächsten 7 Tagen — Health bewerten, offene Punkte klären.`}</div>
        )}
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={`${sichtbar.length} ${sichtbar.length === 1 ? 'Mandat' : 'Mandate'}`}>Mandate</Ueberschrift>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <WerFilter wahl={wahl} onWahl={setWahl} ich={ich} zahlen={zahlen} />
          <button onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>{alle ? 'Beendete ausblenden' : `Beendete zeigen (${beendetVerborgen})`}</button>
        </div>
        <Liste>
          {sichtbar.map(m => {
            const l = crm.mandate[m.id];
            const lq = liqui?.mandate.find(x => x.id === m.id);
            return (
              <div key={m.id}>
                <Zeile onClick={() => setAuswahl(auswahl === m.id ? null : m.id)} aktiv={auswahl === m.id}
                  links={<Punkt farbe={l?.ampel ? AMPEL[l.ampel] : statusFarbe(m.status)} />}
                  titel={<>{m.kunde}<span style={{ color: C.inkLeise }}> · {m.titel}</span></>}
                  unter={[m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : m.honorar.basis === 'tag' ? '/Tag' : ' einmalig'}` : 'Honorar offen', l?.endeAm ? `bis ${datum(l.endeAm)}` : '', l?.health != null ? `Health ${l.health}` : '', m.offen.length ? `${m.offen.length} offen` : ''].filter(Boolean).join(' · ')}
                  rechts={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {lq?.lage === 'fehlt' && <Chip farbe={LEUCHT.achtung}>nicht im Liquiplan</Chip>}
                    {lq?.lage === 'abweichend' && <Chip farbe={LEUCHT.achtung}>Liquiplan weicht ab</Chip>}
                    {!m.vertragUnterschrieben && m.status !== 'beendet' && <Chip farbe={C.inkLeise}>ohne Vertrag</Chip>}
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
      <Katalog api={api} />
    </>
  );
}

function MandatDetail({ m, api, lq, frei, neuLaden, zuKontakt }: { m: Mandat; api: CrmApi; lq?: LiquiLage; frei: { id: string; titel: string; betrag: number }[]; neuLaden: () => void; zuKontakt: (id: string) => void }) {
  const crm = api.crm!;
  const l = crm.mandate[m.id];
  // Nur die geänderten Felder — Kevin und Malin können gleichzeitig am selben Mandat arbeiten.
  const setze = (teil: Partial<Mandat>) => api.teil('mandate', m.id, nurFelder(teil));
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
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>
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
      <Feldzeile label="Status"><Pillen liste={STATUS} aktiv={m.status} onWahl={status => setze({ status })} /></Feldzeile>
      <Feldzeile label="Vertrag"><Pillen liste={[{ id: 'ja', label: 'unterschrieben' }, { id: 'nein', label: 'nicht unterschrieben' }]} aktiv={m.vertragUnterschrieben ? 'ja' : 'nein'} onWahl={x => setze({ vertragUnterschrieben: x === 'ja' })} /></Feldzeile>
      <Feldzeile label="Kunde"><Feld wert={m.kunde} onFertig={kunde => kunde.trim() && setze({ kunde: kunde.trim() })} /></Feldzeile>
      <Feldzeile label="Titel"><Feld wert={m.titel} onFertig={titel => titel.trim() && setze({ titel: titel.trim() })} /></Feldzeile>
      <Feldzeile label="Honorar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={m.honorar.betrag ? String(m.honorar.betrag) : ''} breite={120} platzhalter="€" onFertig={b => setze({ honorar: { ...m.honorar, betrag: Number(b) || 0 } })} />
          <Pillen liste={[{ id: 'monat', label: 'je Monat' }, { id: 'einmalig', label: 'einmalig' }, { id: 'tag', label: 'je Tag' }]} aktiv={m.honorar.basis} onWahl={basis => setze({ honorar: { ...m.honorar, basis } })} />
          <Pillen liste={[{ id: 'netto', label: 'netto' }, { id: 'brutto', label: 'brutto' }]} aktiv={m.honorar.netto ? 'netto' : 'brutto'} onWahl={x => setze({ honorar: { ...m.honorar, netto: x === 'netto' } })} />
          <Pillen liste={[{ id: '19', label: '19 % USt' }, { id: '0', label: 'Reverse Charge' }]} aktiv={String(m.ustSatz)} onWahl={x => setze({ ustSatz: Number(x) })} />
        </div>
      </Feldzeile>
      <Feldzeile label="Laufzeit">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="date" wert={m.start} breite={150} platzhalter="Start" onFertig={start => setze({ start: start || undefined })} />
          <span style={{ color: C.inkLeise }}>bis</span>
          <Feld typ="date" wert={m.ende} breite={150} platzhalter="Ende" onFertig={ende => setze({ ende: ende || undefined })} />
          <Feld typ="number" wert={m.kuendigungsfristTage ? String(m.kuendigungsfristTage) : ''} breite={120} platzhalter="Frist Tage" onFertig={f => setze({ kuendigungsfristTage: Number(f) || undefined })} />
          <Pillen liste={[{ id: 'auto', label: 'verlängert sich' }, { id: 'manuell', label: 'endet' }, { id: 'offen', label: 'offen' }]} aktiv={m.verlaengerung} onWahl={verlaengerung => setze({ verlaengerung })} />
        </div>
        {l?.endeAm && <div style={{ fontSize: 12, color: l.endeIn !== null && l.endeIn <= 90 ? LEUCHT.achtung : C.inkLeise, marginTop: 4 }}>Ende {datum(l.endeAm)} ({l.endeIn} Tage){l.fristBis && l.fristBis !== l.endeAm ? ` · kündbar bis ${datum(l.fristBis)}` : ''}</div>}
      </Feldzeile>
      <Feldzeile label="Gesellschaft"><Pillen liste={[...GES]} aktiv={m.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      <Feldzeile label="Nächstes Review"><Feld typ="date" wert={m.naechstesReview} breite={160} platzhalter="Datum" onFertig={r => setze({ naechstesReview: r || undefined })} /></Feldzeile>
      <div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>Health {l?.health != null ? `· ${l.health}` : '— noch nicht bewertet'} (unter 60 rot, bis 75 gelb){m.health.zahlung === null && crm.zahlung?.[m.id] ? ` · Zahlung aus dem Finanzplan: ${crm.zahlung[m.id]!.wert} (${crm.zahlung[m.id]!.text})` : ''}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(Object.keys(HEALTH_GEWICHTE) as (keyof typeof HEALTH_GEWICHTE)[]).map(f => (
            <div key={f} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 44px', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, color: C.inkDim }}>{HEALTH_LABEL[f]} <span style={{ color: C.inkLeise }}>{HEALTH_GEWICHTE[f]}</span></span>
              {m.health[f] == null
                ? <button onClick={() => setze({ health: { ...m.health, [f]: 70 } })} style={{ justifySelf: 'start', background: 'none', border: '1px dashed rgba(255,255,255,.15)', borderRadius: 8, color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: '3px 10px' }}>bewerten</button>
                : <input type="range" min={0} max={100} step={5} value={m.health[f]!} aria-label={HEALTH_LABEL[f]} onChange={e => setze({ health: { ...m.health, [f]: Number(e.target.value) } })} style={{ accentColor: m.health[f]! >= 75 ? LEUCHT.gut : m.health[f]! >= 60 ? LEUCHT.achtung : LEUCHT.kritisch }} />}
              <span style={{ fontSize: 12.5, color: m.health[f] == null ? C.inkLeise : C.ink, textAlign: 'right' }}>{m.health[f] ?? '–'}</span>
            </div>
          ))}
        </div>
      </div>
      <Feldzeile label="Liquiditätsplan">
        {lq?.lage === 'ok' && <span style={{ fontSize: 12.5, color: LEUCHT.gut }}>steht drin ({lq.vorhanden?.id})</span>}
        {lq?.lage === 'kein-posten' && <span style={{ fontSize: 12.5, color: C.inkLeise }}>kein Posten (Status oder Honorar fehlt)</span>}
        {(lq?.lage === 'fehlt' || lq?.lage === 'abweichend') && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12.5, color: LEUCHT.achtung }}>{lq.lage === 'fehlt' ? `Fehlt: würde ${euro(lq.vorschlag!.betrag)} brutto ${lq.vorschlag!.rhythmus} ab ${datum(lq.vorschlag!.ab)} eintragen.` : `Weicht ab: Plan ${euro(lq.vorhanden!.betrag)}, Mandat ${euro(lq.vorschlag!.betrag)}.`}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Knopf leise onClick={() => liquiplan('anlegen')}>{lq.lage === 'fehlt' ? 'Eintragen' : 'Plan angleichen'}</Knopf>
              {lq.lage === 'fehlt' && frei.slice(0, 4).map(p => <Knopf key={p.id} leise onClick={() => liquiplan('verknuepfen', p.id)}>= {p.titel.slice(0, 26)} ({euro(p.betrag)})</Knopf>)}
            </div>
          </div>
        )}
      </Feldzeile>
      <Feldzeile label="Ansprechpartner">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{personen.map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 999, padding: '5px 10px', color: C.ink, cursor: 'pointer', fontSize: 12.5 }}>{anzeigename(k)}</button>)}{!personen.length && <span style={{ fontSize: 12.5, color: C.inkLeise }}>—</span>}</div>
      </Feldzeile>
      {m.leistungen.length > 0 && <div><div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 4 }}>Leistungen</div><ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>{m.leistungen.map((x, i) => <li key={i} style={{ fontSize: 12.5, color: C.inkDim }}>{x}</li>)}</ul></div>}
      <Feldzeile label="Offener Punkt"><Feld platzhalter="Neuer offener Punkt …" onFertig={t => t.trim() && setze({ offen: [...m.offen, t.trim()] })} /></Feldzeile>
      {m.quelle && <div style={{ fontSize: 12, color: C.inkLeise }}>Quelle: {m.quelle}</div>}
    </div>
  );
}

function Katalog({ api }: { api: CrmApi }) {
  // Offenes Mandat bzw. offene Leistung im Link (k): Zurück schließt es wieder.
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const l = api.crm?.stand.leistungen ?? [];
  const STUFE: Record<Leistung['stufe'], string> = { einstieg: 'Einstieg', kern: 'Kern', premium: 'Premium' };
  const sortiert = [...l].sort((a, b) => ['einstieg', 'kern', 'premium'].indexOf(a.stufe) - ['einstieg', 'kern', 'premium'].indexOf(b.stufe) || a.name.localeCompare(b.name));
  return (
    <Karte i={2}>
      <Ueberschrift rechts={<Knopf leise onClick={() => { const id = neueId('l'); void api.setze('leistungen', { id, name: 'Neue Leistung', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'offen', status: 'entwurf' }); setAuswahl(id); }}>+ Leistung</Knopf>}>Leistungskatalog</Ueberschrift>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>Einstieg → Kern → Premium: jede Leistung hat einen klaren Umfang und Preis. Entwürfe ohne Preis sind noch nicht verkaufbar.</div>
      <Liste>
        {sortiert.map(x => (
          <div key={x.id}>
            <Zeile onClick={() => setAuswahl(auswahl === x.id ? null : x.id)} aktiv={auswahl === x.id} links={<Punkt farbe={x.status === 'aktiv' ? LEUCHT.gut : x.status === 'entwurf' ? LEUCHT.achtung : C.inkLeise} />}
              titel={x.name} unter={`${STUFE[x.stufe]} · ${x.typ}${x.preis.betrag ? ` · ${euro(x.preis.betrag)} ${x.preis.einheit}` : ' · Preis offen'}`}
              rechts={<Chip farbe={x.status === 'aktiv' ? LEUCHT.gut : C.inkLeise}>{x.status}</Chip>} />
            {auswahl === x.id && (
              <div style={{ padding: '8px 2px 16px' }}>
                <Feldzeile label="Name"><Feld wert={x.name} onFertig={name => name.trim() && api.teil('leistungen', x.id, { name: name.trim() })} /></Feldzeile>
                <Feldzeile label="Stufe"><Pillen liste={[{ id: 'einstieg', label: 'Einstieg' }, { id: 'kern', label: 'Kern' }, { id: 'premium', label: 'Premium' }]} aktiv={x.stufe} onWahl={stufe => api.teil('leistungen', x.id, { stufe })} /></Feldzeile>
                <Feldzeile label="Preis">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Feld typ="number" wert={x.preis.betrag ? String(x.preis.betrag) : ''} breite={120} platzhalter="€" onFertig={b => api.teil('leistungen', x.id, { preis: { ...x.preis, betrag: Number(b) || 0 } })} />
                    <Feld wert={x.preis.einheit} platzhalter="Einheit" onFertig={einheit => api.teil('leistungen', x.id, { preis: { ...x.preis, einheit } })} />
                  </div>
                </Feldzeile>
                <Feldzeile label="Status"><Pillen liste={[{ id: 'aktiv', label: 'aktiv' }, { id: 'entwurf', label: 'Entwurf' }, { id: 'eingestellt', label: 'eingestellt' }]} aktiv={x.status} onWahl={status => api.teil('leistungen', x.id, { status })} /></Feldzeile>
                {x.beschreibung && <p style={{ fontSize: 12.5, color: C.inkDim, lineHeight: 1.5 }}>{x.beschreibung}</p>}
                {x.lieferumfang.length > 0 && <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>{x.lieferumfang.map((y, i) => <li key={i} style={{ fontSize: 12.5, color: C.inkDim }}>{y}</li>)}</ul>}
                {x.quelle && <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 6 }}>Quelle: {x.quelle}</div>}
              </div>
            )}
          </div>
        ))}
      </Liste>
      {!l.length && <Leer>Noch keine Leistungen.</Leer>}
    </Karte>
  );
}
