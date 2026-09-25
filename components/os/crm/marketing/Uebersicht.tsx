'use client';

// ─── Markttraktion · Marketing › Übersicht ───────────────────────────────────────────
// Oben die Wirkung (Kennzahlen aus lib/crm/marketing.ts, grau solange nichts
// gemessen ist). Darunter, was Marketing hier steuert: Wie viele Menschen
// dürfen wir überhaupt ansprechen (Einwilligungsbestand je Kanal), wo läuft
// eine Frist (Art. 14), woher kommen Chancen wirklich (Quelle und
// Selbstauskunft) und welche Themen nennen Kunden in Gesprächen (die „Stimme
// der Kunden“ aus den Notizen — Rohstoff für Beiträge). Keine Likes, keine
// Öffnungsraten.

import { useMemo } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Zahl, Raster, Fortschritt, LEUCHT } from '../../schlank';
import { anzeigename } from '@/lib/make-one/crm';
import { kanalStatus, art14 } from '@/lib/crm/recht';
import { marketingKennzahlen } from '@/lib/crm/marketing';
import { type CrmApi, datum } from '../daten';
import { KpiLeiste } from './gemeinsam';

export function Uebersicht({ api, zuKontakt }: { api: CrmApi; zuKontakt: (id: string) => void }) {
  const kontakte = useMemo(() => api.kontakte ?? [], [api.kontakte]);
  const crm = api.crm;
  const heute = crm?.heute ?? new Date().toISOString().slice(0, 10);
  const kpis = useMemo(() => (crm ? marketingKennzahlen(kontakte, crm.stand, heute) : []), [kontakte, crm, heute]);
  const z = useMemo(() => {
    const aktive = kontakte.filter(k => !k.werbesperre);
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
  const QLABEL: Record<string, string> = { empfehlung: 'Empfehlung', event: 'Event', content: 'Content', outreach: 'Ansprache', bestand: 'Bestand', inbound: 'Anfrage', unbekannt: 'nicht erfasst' };
  const chancenGesamt = z.quellen.reduce((a, [, n]) => a + n, 0);

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts="grau = noch nichts gemessen">Wirkung</Ueberschrift>
        {crm ? <KpiLeiste liste={kpis} /> : <Leer>Lädt …</Leer>}
        <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 10 }}>Gemessen an Gesprächen und Chancen, nicht an Likes oder Öffnungsraten. Wirkung trägst du im Redaktionsplan am Beitrag ein.</div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift>Wen wir ansprechen dürfen</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={String(z.mail)} label="Mail freigegeben" farbe={LEUCHT.gut} />
          <Zahl wert={String(z.newsletter)} label="Newsletter (Double-Opt-in)" />
          <Zahl wert={`${z.kreisACmail}/${z.kreisAC}`} label="Kreis A–C mit Mail-Grundlage" />
          <Zahl wert={String(z.gesperrt)} label="Werbesperren" farbe={z.gesperrt ? LEUCHT.kritisch : undefined} />
        </Raster>
        <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 10 }}>Ziel: Der Anteil von Kreis A–C mit gültiger Mail-Grundlage steigt. Einwilligungen holst du im Gespräch — Wortlaut in der Karteikarte festhalten.</div>
      </Karte>

      <Karte i={2} akzent={z.art14.length ? LEUCHT.kritisch : undefined}>
        <Ueberschrift farbe={z.art14.length ? LEUCHT.kritisch : undefined} rechts={z.art14offen ? `${z.art14offen} laufen noch` : undefined}>Art. 14 — Informationspflicht</Ueberschrift>
        {z.art14.length ? (
          <div style={{ display: 'grid', gap: 4 }}>
            {z.art14.slice(0, 12).map(k => <button key={k.id} onClick={() => zuKontakt(k.id)} style={{ textAlign: 'left', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien, padding: '3px 0' }}>{anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null} <span style={{ color: LEUCHT.kritisch }}>· {art14(k, heute)?.tage} Tage</span></button>)}
            <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 6 }}>Wer aus Recherche oder Listen stammt, muss spätestens beim ersten Kontakt, sonst binnen eines Monats informiert werden. In der Karteikarte „Informiert“ setzen.</div>
          </div>
        ) : <Leer>Nichts fällig. Personen aus Recherche oder Listen in der Karteikarte als „Recherche/Liste“ markieren — dann läuft die Uhr.</Leer>}
      </Karte>

      <Karte i={3}>
        <Ueberschrift>Woher Chancen kommen</Ueberschrift>
        {chancenGesamt ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {z.quellen.map(([q, n]) => (
              <div key={q} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}>
                <span style={{ color: C.inkDim }}>{QLABEL[q] ?? q}</span><Fortschritt anteil={n / chancenGesamt} farbe={q === 'unbekannt' ? C.inkLeise : LEUCHT.business} /><span style={{ textAlign: 'right' }}>{n}</span>
              </div>
            ))}
            {z.selbstauskunft.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: C.inkDim }}>„{s.text}“ <span style={{ color: C.inkLeise }}>— {s.titel}</span></div>)}
            <div style={{ fontSize: 12.5, color: C.inkLeise }}>Die Selbstauskunft („Wie sind Sie auf uns aufmerksam geworden?“) ist ehrlicher als jede Klick-Zuordnung.</div>
          </div>
        ) : <Leer>Noch keine Chancen mit Quelle.</Leer>}
      </Karte>

      <Karte i={4}>
        <Ueberschrift>Stimme der Kunden</Ueberschrift>
        {z.stimmen.length ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {z.stimmen.map((s, i) => <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>„{s.bedarf}“ <button onClick={() => zuKontakt(s.id)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0 }}>— {s.name}, {datum(s.am)}</button></div>)}
            <div style={{ fontSize: 12.5, color: C.inkLeise }}>Themen für Beiträge und Newsletter kommen von hier — im Redaktionsplan mit einem Klick als Idee übernehmen.</div>
          </div>
        ) : <Leer>Sobald Gesprächsnotizen das Feld „Bedarf / Schmerz“ haben, sammeln sich hier die Themen.</Leer>}
        {z.alteEinwilligung.length > 0 && <div style={{ fontSize: 12.5, color: LEUCHT.achtung, marginTop: 10 }}>{z.alteEinwilligung.length} Einwilligungen sind älter als zwei Jahre — auffrischen.</div>}
      </Karte>
    </>
  );
}
