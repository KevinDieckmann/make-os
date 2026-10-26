'use client';

// ─── Angebots-Tool · ein gestelltes Angebot (28.09.) ─────────────────────────
// Festgeschrieben: Nummer, Inhalt, PDF und Prüfsumme ändern sich nicht mehr — die
// Ansicht zeigt das Blatt aus dem Schnappschuss (Absender/Empfänger beim Stellen).
// Handlungen je Status: angenommen (→ Deal gewonnen, danach „Mandat anlegen“ über den
// bestehenden Weg, vorbelegt aus dem Angebot) · abgelehnt (Verlustgrund Pflicht) ·
// neue Version (Entwurf mit Bezug) · PDF laden · Mail erneut öffnen.
// Woche 1 (08.10.): „Angenommen“ mit Rückfrage (3.4, nicht rückgängig); nach „Mandat anlegen“ der Link zum Mandat und „Erste Rechnung“
// (der vorhandene Weg „Rechnung aus dem Honorar“, 3.5); ein gemischtes Angebot plant die Einmalposten als eigene Rechnung (3.6, Rechnungs-
// Tool, feste Kennung — idempotent; die laufende Leistung rechnet das Mandat ab).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WEG } from '@/lib/wege';
import { entwurfAnlegen } from '../../rechnung/daten';
import type { Angebot } from '@/lib/crm/typen';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Knopf, Chip, feld, useRueckfrage } from '../../ui';
import Link from 'next/link';
import { Wahl } from '../Wahl';
import type { CrmApi } from '../daten';
import { verlustgruende } from '@/lib/crm/pipeline';
import { angebotDokument } from '@/lib/crm/angebot-dokument';
import { ANGEBOT_STATUS_LABEL, angebotEinmalRest, angebotGesendetVermerkt, gesellschaftLabel, mailVorlage, produktTexteFuer } from '@/lib/crm/angebote';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { Blatt } from './Blatt';
import { FallAmDeal } from '../../fulfillment/prozesse/FallAmDeal';
import { angebotPost, pdfDateiHolen, pdfLaden, pdfTeilen, NUR_ENTWURF, type AngebotDaten, type AngebotMitStand } from './angebot-daten';
import { useMandatAnlegen } from '../MandatAnlegenFenster';
import { tagVon } from '@/lib/zeit';

export const STATUS_FARBE: Record<Angebot['status'], string> = { entwurf: C.inkDim, gestellt: LEUCHT.business, angenommen: LEUCHT.gut, abgelehnt: LEUCHT.kritisch, abgelaufen: C.inkLeise, ersetzt: C.inkLeise };
const datumDe = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

export function Ansicht({ a, api, daten, meldungStart, onOeffnen, onListe, zuKontakt, zuDeal }: {
  a: AngebotMitStand; api: CrmApi; daten: AngebotDaten; meldungStart?: { text: string; mailto?: string; pdf?: { id: string; name: string }; gmail?: { ok: true; von: string; text: string } | { ok: false; text: string } } | null;
  onOeffnen: (id: string) => void; onListe: () => void; zuKontakt?: (id: string) => void; zuDeal?: (id: string) => void;
}) {
  const crm = api.crm!;
  /** Rolle „nur Business“ (13.10.): lesen ja — gesendet, annehmen, ablehnen, neue Version, Mandat/Rechnung nicht (Server: 403). */
  const nur = daten.nurEntwuerfe;
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ablehnen, setAblehnen] = useState(false);
  const [grund, setGrund] = useState<string | null>(null);
  const [grundFrei, setGrundFrei] = useState('');
  const [mandat, setMandat] = useState<string | null>(null);
  const [mandatId, setMandatId] = useState<string | null>(null);
  const [einmal, setEinmal] = useState<{ id?: string; fehler?: string } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  // 24.10.: „Mandat anlegen“ öffnet erst die Vorbelegung zum Prüfen (Start wählbar) — angelegt wird erst dort.
  const mandatFenster = useMandatAnlegen(api);
  const router = useRouter();
  const k = a.kontaktId ? (api.kontakte ?? []).find(x => x.id === a.kontaktId) : undefined;
  const g = daten.gesellschaften.find(x => x.id === a.gesellschaft);
  const logoUrl = g?.logoDateiId ? `/api/crm/dateien?id=${encodeURIComponent(g.logoDateiId)}` : null;
  const dok = a.absender && a.empfaenger ? angebotDokument(a, a.absender, a.empfaenger, (a.gestelltAm ?? a.geaendert).slice(0, 10)) : null;
  const deal = a.dealId ? crm.stand.chancen.find(c => c.id === a.dealId) : undefined;
  const vorhandenesMandat = deal ? crm.stand.mandate.find(m => m.chanceId === deal.id) : undefined;
  const hatMandat = !!vorhandenesMandat;
  const mandatZiel = mandatId ?? vorhandenesMandat?.id ?? null;
  // Gemischtes Angebot (3.6): Einmalposten UND laufende Leistung — der Einmal-Anteil wird eine eigene geplante Rechnung. Seit 24.10. nur, was das Mandat
  // NICHT selbst abrechnet (`angebotEinmalRest`): die eigenen Preis-Teile einer Kombination (z. B. der Festpreis 50/50) stehen dort als Zusatzmodul.
  const gemischt = angebotEinmalRest(a, crm.stand.leistungen).length > 0 && a.positionen.some(p => p.basis !== 'einmalig');
  const nachfolger = a.nachfolgerId ? daten.angebote?.find(x => x.id === a.nachfolgerId) : daten.angebote?.find(x => x.vorgaengerId === a.id);
  const vorgaenger = a.vorgaengerId ? daten.angebote?.find(x => x.id === a.vorgaengerId) : undefined;

  async function aktion(body: Record<string, unknown>, ok: string) {
    const r = await angebotPost({ ...body, id: a.id, stand: a.stand });
    if (!r.ok || !r.angebot) { if (r.aktuell) daten.uebernehmen(r.aktuell); setMeldung(r.fehler ?? 'Nicht gespeichert.'); return false; }
    daten.uebernehmen(r.angebot); void api.laden(true);
    setMeldung(typeof r.hinweis === 'string' ? `${ok} ${r.hinweis}` : ok);
    return true;
  }
  /** Einmalposten als geplante Rechnung (3.6) — idempotent über die feste Kennung; ohne Finanz-Zugang kommt die Meldung. */
  async function einmalPlanen() {
    const e = await entwurfAnlegen({ quelle: 'angebot', angebotId: a.id, nur: 'einmalig' });
    setEinmal(e.id ? { id: e.id } : { fehler: e.fehler ?? 'Einmalbetrag nicht als Rechnung geplant.' });
  }
  async function mandatAnlegen() {
    if (!deal) return;
    // EIN Weg (Woche 2 · 3.10): dasselbe Fenster wie am Deal und in Kontakt › Umsatz (`useMandatAnlegen`, 24.10.).
    const r = await mandatFenster.oeffnen(deal.id);
    if (!r) return;
    if (!r.ok) { setMeldung(r.fehler ?? 'Mandat nicht angelegt.'); return; }
    setMandat(r.text ?? 'Mandat angelegt.');
    if (r.mandatId) setMandatId(r.mandatId);
    void api.laden(true);
    if (gemischt) await einmalPlanen();
  }
  /** „Erste Rechnung“ (3.5): derselbe Weg wie „Rechnung aus dem Honorar“ in der Mandatsakte — Entwurf für den laufenden Monat. */
  async function ersteRechnung() {
    if (!mandatZiel) return;
    const e = await entwurfAnlegen({ quelle: 'mandat', mandatId: mandatZiel });
    if (!e.id) { setMeldung(e.fehler ?? 'Rechnung nicht angelegt.'); return; }
    router.push(WEG.rechnungSchreiben(e.id));
  }
  async function annehmen() {
    // 3.4: nicht rückgängig — der Deal wird gewonnen, das Angebot ist danach festgeschrieben.
    if (!(await bestaetigen({ titel: 'Angebot als angenommen vermerken?', text: `${a.nummer ?? 'Das Angebot'} gilt dann als angenommen${deal ? ` und der Deal „${deal.titel}“ als gewonnen` : ''}. Das lässt sich nicht zurücknehmen.`, ja: 'Angenommen' }))) return;
    await aktion({ aktion: 'annehmen' }, deal ? 'Angenommen — Deal gewonnen.' : 'Angenommen.');
  }
  /** „Mail ist raus“ (Woche 2 · 3.15): erst jetzt entsteht die Mail-Aktivität am Kontakt — beim Stellen steht nur „gestellt“. */
  const gesendet = angebotGesendetVermerkt(k, a.nummer);
  async function alsGesendet() {
    const r = await angebotPost({ aktion: 'gesendet', id: a.id });
    setMeldung(r.ok ? String(r.text ?? 'Als gesendet vermerkt.') : r.fehler ?? 'Nicht vermerkt.');
    if (r.ok) void api.laden(true);
  }
  // „Über <Postfach> senden (mit PDF)“ (25.10.): die neue Mail in der Inbox mit dem PDF als Anhang; ohne Postfach der Rückfall `mailto`.
  // 25.10.: Begleit-Mail des Hauptprodukts, wenn gesetzt (`produktTexteFuer`) — sonst die feste.
  const firmaName = (a.firmaId ? crm.stand.firmen.find(f => f.id === a.firmaId)?.name : undefined) ?? a.empfaenger?.firma;
  const mail = mailVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: a.titel, nummer: a.nummer, gueltigBis: a.gueltigBis, absender: g ? mitVorgaben(g).name : undefined, ...(firmaName ? { firma: firmaName } : {}), heute: crm.heute }, produktTexteFuer(a, crm.stand.leistungen));
  const mailAn = a.empfaenger?.email ?? k?.email;

  return (
    // Raster ohne Spaltenvorgabe wächst auf die Mindestbreite seines breitesten Kinds (die Positions-Tabelle im Blatt) —
    // `minmax(0, 1fr)` + `minWidth: 0` halten es auf Bildschirmbreite (Sichtprüfung 29.09., F2: bei 375 px abgeschnitten).
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, minWidth: 0 }}>
      {meldungStart && (
        <Karte i={0} ton={LEUCHT.gut}>
          <div style={{ display: 'grid', gap: 8, fontSize: TYP.bedien, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: LEUCHT.gut }}>{meldungStart.text}</div>
            {/* 26.10. (Kevin): die Mail liegt als Entwurf in Gmail — dort senden. Ohne Gmail bleibt das Mail-Programm als Rückfall (PDF selbst anhängen). */}
            <div style={{ color: C.inkDim }}>Das PDF wurde heruntergeladen.{' '}
              {meldungStart.gmail?.ok ? <>{meldungStart.gmail.text}</> : meldungStart.gmail ? <span style={{ color: LEUCHT.achtung }}>Gmail-Entwurf nicht angelegt: {meldungStart.gmail.text}</span> : 'Die Mail schreibst du selbst — oder unten als Gmail-Entwurf anlegen.'}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {meldungStart.gmail?.ok && <Knopf farbe={LEUCHT.gut} href={gmailEntwuerfe(meldungStart.gmail.von)}>Gmail öffnen ›</Knopf>}
              {!meldungStart.gmail?.ok && a.pdfDateiId && !nur && <GmailEntwurfKnopf id={a.id} an={mailAn} betreff={mail.betreff} text={mail.text} onText={setMeldung} />}
              {meldungStart.pdf && <PdfTeilenKnopf dateiId={meldungStart.pdf.id} name={meldungStart.pdf.name} titel={a.titel} onText={setMeldung} />}
              {meldungStart.pdf && <button onClick={() => pdfLaden(meldungStart.pdf!.id, meldungStart.pdf!.name)} style={link}>PDF noch einmal laden</button>}
              {meldungStart.mailto && !meldungStart.gmail?.ok && <a href={meldungStart.mailto} style={link}>Mail-Programm öffnen (PDF selbst anhängen)</a>}
            </div>
            {k && !gesendet && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', color: C.inkDim }}>Ist die Mail raus? <Knopf farbe={LEUCHT.gut} onClick={alsGesendet}>Ja, gesendet</Knopf></div>}
          </div>
        </Karte>
      )}
      {meldung && <Karte i={0} akzent={LEUCHT.achtung}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: TYP.bedien, color: C.inkDim }}><span>{meldung}</span><button onClick={() => setMeldung(null)} style={link}>ok</button></div></Karte>}

      <Karte i={1}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: TYP.titel, fontWeight: 700 }}>{a.nummer ?? 'Angebot'}</span>
          <Chip farbe={STATUS_FARBE[a.status]}>{ANGEBOT_STATUS_LABEL[a.status]}</Chip>
          {a.version > 1 && <Chip farbe={C.inkDim}>Version {a.version}</Chip>}
          <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{a.titel}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onListe} style={link}>alle Angebote ›</button>
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
          {[gesellschaftLabel(a.gesellschaft), a.gestelltAm ? `gestellt ${datumDe(a.gestelltAm.slice(0, 10))}` : '', `gültig bis ${datumDe(a.gueltigBis)}`, a.angenommenAm ? `angenommen ${datumDe(a.angenommenAm)}` : '', a.abgelehntAm ? `abgelehnt ${datumDe(a.abgelehntAm)}${a.grund ? ` — ${a.grund}` : ''}` : '', a.abgelaufenAm ? `abgelaufen ${datumDe(a.abgelaufenAm)}` : '', a.personGeloest ? 'Personenbezug gelöst (Art. 17)' : '', ...(a.versendet ?? []).map(x => `versendet ${datumDe(tagVon(x.am))} über ${x.ueber}`)].filter(Boolean).join(' · ')}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien }}>
          {k && zuKontakt && <button onClick={() => zuKontakt(k.id)} style={link}>Kontakt: {`${k.vorname ?? ''} ${k.nachname ?? ''}`.trim()} ›</button>}
          {deal && zuDeal && <button onClick={() => zuDeal(deal.id)} style={link}>Deal: {deal.titel} ›</button>}
          {vorgaenger && <button onClick={() => onOeffnen(vorgaenger.id)} style={link}>Vorversion {vorgaenger.nummer ?? ''} ›</button>}
          {nachfolger && <button onClick={() => onOeffnen(nachfolger.id)} style={link}>{nachfolger.status === 'entwurf' ? 'Entwurf der neuen Version ›' : `neue Version ${nachfolger.nummer ?? ''} ›`}</button>}
          {a.pruefsumme && <span title={`SHA-256 ${a.pruefsumme}`} style={{ color: C.inkLeise }}>Prüfsumme {a.pruefsumme.slice(0, 12)}…</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {a.pdfDateiId && <Knopf leise onClick={() => pdfLaden(a.pdfDateiId!, `Angebot ${a.nummer}.pdf`)}>PDF laden</Knopf>}
          {a.pdfDateiId && !meldungStart && <PdfTeilenKnopf dateiId={a.pdfDateiId} name={`Angebot ${a.nummer}.pdf`} titel={a.titel} onText={setMeldung} knopf />}
          {(a.status === 'gestellt' || a.status === 'abgelaufen' || a.status === 'angenommen') && k && !gesendet && !meldungStart && !nur && <Knopf leise onClick={alsGesendet}>Mail ist raus — als gesendet vermerken</Knopf>}
          {/* 26.10. (Kevin): statt „Über … senden“ die Mail mit PDF als Entwurf ins eigene Gmail — gesendet wird dort. */}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && a.pdfDateiId && !nur && !meldungStart && <GmailEntwurfKnopf id={a.id} an={mailAn} betreff={mail.betreff} text={mail.text} onText={setMeldung} knopf />}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && !nur && <Knopf farbe={LEUCHT.gut} onClick={annehmen}>Angenommen</Knopf>}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && !ablehnen && !nur && <Knopf leise onClick={() => setAblehnen(true)}>Abgelehnt …</Knopf>}
          {nur && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, alignSelf: 'center' }}>{NUR_ENTWURF}</span>}
          {!nur && a.status !== 'angenommen' && a.status !== 'ersetzt' && !(nachfolger && nachfolger.status === 'entwurf') && (
            <Knopf leise onClick={async () => { const r = await angebotPost({ aktion: 'version', id: a.id }); if (r.ok && r.angebot) { daten.uebernehmen(r.angebot); onOeffnen(r.angebot.id); } else setMeldung(r.fehler ?? 'Keine neue Version.'); }}>Neue Version</Knopf>
          )}
          {/* Ein Handgriff wie am Deal (17.10., Gesamtprüfung L1 B11): „Mandat anlegen & Fall starten“ steht darunter (FallAmDeal); nur ein gemischtes Angebot legt das
              Mandat hier an (danach plant es den Einmalbetrag). */}
          {!nur && a.status === 'angenommen' && deal && !hatMandat && !mandat && gemischt && <Knopf farbe={LEUCHT.gut} onClick={mandatAnlegen}>Mandat anlegen</Knopf>}
          {mandat && <span style={{ fontSize: TYP.bedien, color: LEUCHT.gut, alignSelf: 'center' }}>{mandat}</span>}
          {a.status === 'angenommen' && hatMandat && !mandat && <Chip farbe={LEUCHT.gut}>Mandat angelegt</Chip>}
          {a.status === 'angenommen' && mandatZiel && <Link href={WEG.mandat(mandatZiel)} style={{ ...link, alignSelf: 'center' }}>Zum Mandat ›</Link>}
          {!nur && a.status === 'angenommen' && mandatZiel && <Knopf leise onClick={ersteRechnung}>Erste Rechnung</Knopf>}
          {!nur && a.status === 'angenommen' && mandatZiel && gemischt && !einmal?.id && <Knopf leise onClick={einmalPlanen}>Einmalbetrag als Rechnung planen</Knopf>}
          {einmal?.id && <Link href={WEG.rechnungSchreiben(einmal.id)} style={{ ...link, alignSelf: 'center' }}>Einmalbetrag: Rechnung (geplant) ›</Link>}
          {einmal?.fehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, alignSelf: 'center' }}>{einmal.fehler}</span>}
          {/* Angebot → Rechnung (08.10.): Entwurf mit den Positionen, Kunde, Mandat und Gesellschaft — gestellt wird im Editor. */}
          {/* Gemischt mit Mandat (3.6): Einmalbetrag und Monatsrechnung laufen getrennt — keine Rechnung über alle Positionen daneben. */}
          {/* Mit Mandat schreibt das Mandat die Rechnungen („Erste Rechnung“) — kein zweiter Knopf daneben (17.10., L1 B9: legte einen weiteren Entwurf an). */}
          {!nur && a.status === 'angenommen' && !mandatZiel && <RechnungAusAngebot angebotId={a.id} onFehler={setMeldung} />}
        </div>
        {!nur && a.status === 'angenommen' && deal && !(gemischt && !hatMandat && !mandat) && <FallAmDeal api={api} chanceId={deal.id} />}
        {ablehnen && (
          <div style={{ display: 'grid', gap: 8, marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
            <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Warum abgelehnt? (Pflicht — der Grund geht als Verlustgrund an den Deal)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Wahl<string> label="Verlustgrund" liste={verlustgruende(crm.stand.wertelisten).map(x => ({ id: x, label: x }))} wert={grund} onWahl={setGrund} onLeeren={() => setGrund(null)} />
              <input value={grundFrei} onChange={e => setGrundFrei(e.target.value)} placeholder="Ergänzung (optional)" aria-label="Ergänzung zum Grund" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', flex: '1 1 200px' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Knopf farbe={LEUCHT.kritisch} aus={!grund && !grundFrei.trim()} onClick={async () => { if (await aktion({ aktion: 'ablehnen', grund: [grund, grundFrei.trim()].filter(Boolean).join(' — ') }, 'Abgelehnt — Deal verloren mit Grund.')) setAblehnen(false); }}>Als abgelehnt markieren</Knopf>
              <Knopf leise onClick={() => setAblehnen(false)}>Abbrechen</Knopf>
            </div>
          </div>
        )}
      </Karte>
      {dok ? <Blatt d={dok} logoUrl={logoUrl} /> : <Karte i={2}><div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine Vorschau (Schnappschuss fehlt) — das PDF ist die Unterlage.</div></Karte>}
      {dialog}
      {mandatFenster.fenster}
    </div>
  );
}

// Verweise (Kontakt, Deal, Versionen) dürfen umbrechen — lange Deal-Titel schoben sonst die Kopfzeile über den Rand.
const link = { background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0, textDecoration: 'none', textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: '100%' } as const;

/**
 * „Teilen“ mit dem PDF als Datei (Woche 2 · 3.14) — die Datei wird beim Anzeigen geholt (nur, wo das Gerät teilen kann), damit das
 * Teilen-Blatt direkt im Klick aufgeht; ohne Teilen-Funktion lädt der Knopf das PDF herunter.
 */
function PdfTeilenKnopf({ dateiId, name, titel, onText, knopf }: { dateiId: string; name: string; titel?: string; onText: (t: string | null) => void; knopf?: boolean }) {
  const [datei, setDatei] = useState<File | null>(null);
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof (navigator as Navigator & { canShare?: unknown }).canShare !== 'function') return;
    let lebt = true;
    void pdfDateiHolen(dateiId, name).then(f => { if (lebt) setDatei(f); });
    return () => { lebt = false; };
  }, [dateiId, name]);
  const teilen = async () => {
    const r = await pdfTeilen(datei, dateiId, name, titel);
    onText(r === 'geladen' ? 'Teilen mit Datei geht auf diesem Gerät nicht — das PDF ist heruntergeladen.' : r === 'fehler' ? 'Teilen hat nicht geklappt — „PDF laden“ geht immer.' : null);
  };
  return knopf ? <Knopf leise onClick={teilen}>Teilen (mit PDF)</Knopf> : <button onClick={() => void teilen()} style={link}>Teilen (mit PDF)</button>;
}

/** „Rechnung schreiben“ aus einem angenommenen Angebot — legt den Entwurf an (oder öffnet den offenen) und führt in den Rechnungs-Editor. */
function RechnungAusAngebot({ angebotId, onFehler }: { angebotId: string; onFehler: (t: string) => void }) {
  const router = useRouter();
  return (
    <Knopf leise onClick={async () => {
      const e = await entwurfAnlegen({ quelle: 'angebot', angebotId });
      if (!e.id) { onFehler(e.fehler ?? 'Rechnung nicht angelegt.'); return; }
      router.push(WEG.rechnungSchreiben(e.id));
    }}>Rechnung schreiben</Knopf>
  );
}

/** Die Entwürfe im Gmail eines Kontos (öffnet das richtige Konto über die Adresse). */
export const gmailEntwuerfe = (von: string) => `https://mail.google.com/mail/u/${encodeURIComponent(von || '0')}/#drafts`;

/**
 * „Als Entwurf in Gmail (mit PDF)“ (26.10., Kevin: „die E-Mail so vorbereitet bei Google Mail — da verschicke ich sie“): legt die Mail mit dem PDF dieses
 * Angebots als Entwurf im EIGENEN Gmail ab (POST /api/crm/angebot `gmail-entwurf`). Nichts wird gesendet; danach „Gmail öffnen“.
 */
function GmailEntwurfKnopf({ id, an, betreff, text, onText, knopf }: { id: string; an?: string; betreff: string; text: string; onText: (t: string) => void; knopf?: boolean }) {
  const [von, setVon] = useState<string | null>(null);
  if (von !== null) return <Knopf farbe={LEUCHT.gut} href={gmailEntwuerfe(von)}>Gmail öffnen ›</Knopf>;
  return (
    <Knopf leise={!!knopf} farbe={knopf ? undefined : LEUCHT.gut} onClick={async () => {
      const r = await angebotPost({ aktion: 'gmail-entwurf', id, an: an ?? '', betreff, text });
      onText(r.ok ? String(r.text ?? 'Entwurf liegt in Gmail.') : r.fehler ?? 'Gmail-Entwurf nicht angelegt.');
      if (r.ok) setVon(String(r.von ?? ''));
    }}>Als Entwurf in Gmail (mit PDF)</Knopf>
  );
}
