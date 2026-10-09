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
import { ANGEBOT_STATUS_LABEL, angebotGesendetVermerkt, gesellschaftLabel, mailVorlage, mailtoLink } from '@/lib/crm/angebote';
import { mitVorgaben } from '@/lib/crm/gesellschaften';
import { Blatt } from './Blatt';
import { angebotPost, mandatAusDeal, pdfDateiHolen, pdfLaden, pdfTeilen, type AngebotDaten, type AngebotMitStand } from './angebot-daten';

export const STATUS_FARBE: Record<Angebot['status'], string> = { entwurf: C.inkDim, gestellt: LEUCHT.business, angenommen: LEUCHT.gut, abgelehnt: LEUCHT.kritisch, abgelaufen: C.inkLeise, ersetzt: C.inkLeise };
const datumDe = (d?: string) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

export function Ansicht({ a, api, daten, meldungStart, onOeffnen, onListe, zuKontakt, zuDeal }: {
  a: AngebotMitStand; api: CrmApi; daten: AngebotDaten; meldungStart?: { text: string; mailto?: string; pdf?: { id: string; name: string } } | null;
  onOeffnen: (id: string) => void; onListe: () => void; zuKontakt?: (id: string) => void; zuDeal?: (id: string) => void;
}) {
  const crm = api.crm!;
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ablehnen, setAblehnen] = useState(false);
  const [grund, setGrund] = useState<string | null>(null);
  const [grundFrei, setGrundFrei] = useState('');
  const [mandat, setMandat] = useState<string | null>(null);
  const [mandatId, setMandatId] = useState<string | null>(null);
  const [einmal, setEinmal] = useState<{ id?: string; fehler?: string } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  const router = useRouter();
  const k = a.kontaktId ? (api.kontakte ?? []).find(x => x.id === a.kontaktId) : undefined;
  const g = daten.gesellschaften.find(x => x.id === a.gesellschaft);
  const logoUrl = g?.logoDateiId ? `/api/crm/dateien?id=${encodeURIComponent(g.logoDateiId)}` : null;
  const dok = a.absender && a.empfaenger ? angebotDokument(a, a.absender, a.empfaenger, (a.gestelltAm ?? a.geaendert).slice(0, 10)) : null;
  const deal = a.dealId ? crm.stand.chancen.find(c => c.id === a.dealId) : undefined;
  const vorhandenesMandat = deal ? crm.stand.mandate.find(m => m.chanceId === deal.id) : undefined;
  const hatMandat = !!vorhandenesMandat;
  const mandatZiel = mandatId ?? vorhandenesMandat?.id ?? null;
  // Gemischtes Angebot (3.6): Einmalposten UND laufende Leistung — der Einmal-Anteil wird eine eigene geplante Rechnung.
  const gemischt = a.positionen.some(p => p.basis === 'einmalig') && a.positionen.some(p => p.basis !== 'einmalig');
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
    // EIN Weg (Woche 2 · 3.10): derselbe Aufruf wie in Kontakt › Umsatz (`mandatAusDeal`).
    const r = await mandatAusDeal(deal.id);
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
  function mailOeffnen() {
    const m = mailVorlage({ anrede: k?.anrede, vorname: k?.vorname, nachname: k?.nachname, titel: a.titel, nummer: a.nummer, gueltigBis: a.gueltigBis, absender: g ? mitVorgaben(g).name : undefined });
    window.location.href = mailtoLink(a.empfaenger?.email ?? k?.email, m.betreff, m.text);
  }

  return (
    // Raster ohne Spaltenvorgabe wächst auf die Mindestbreite seines breitesten Kinds (die Positions-Tabelle im Blatt) —
    // `minmax(0, 1fr)` + `minWidth: 0` halten es auf Bildschirmbreite (Sichtprüfung 29.09., F2: bei 375 px abgeschnitten).
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14, minWidth: 0 }}>
      {meldungStart && (
        <Karte i={0} ton={LEUCHT.gut}>
          <div style={{ display: 'grid', gap: 8, fontSize: TYP.bedien, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: LEUCHT.gut }}>{meldungStart.text}</div>
            <div style={{ color: C.inkDim }}>Das PDF wurde heruntergeladen und das Mail-Programm geöffnet — <b>PDF anhängen und abschicken</b>. Am Handy geht es schneller über „Teilen“ (das PDF hängt dann schon an).</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              {meldungStart.pdf && <PdfTeilenKnopf dateiId={meldungStart.pdf.id} name={meldungStart.pdf.name} titel={a.titel} onText={setMeldung} />}
              {meldungStart.pdf && <button onClick={() => pdfLaden(meldungStart.pdf!.id, meldungStart.pdf!.name)} style={link}>PDF noch einmal laden</button>}
              {meldungStart.mailto && <a href={meldungStart.mailto} style={link}>Mail noch einmal öffnen</a>}
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
          {[gesellschaftLabel(a.gesellschaft), a.gestelltAm ? `gestellt ${datumDe(a.gestelltAm.slice(0, 10))}` : '', `gültig bis ${datumDe(a.gueltigBis)}`, a.angenommenAm ? `angenommen ${datumDe(a.angenommenAm)}` : '', a.abgelehntAm ? `abgelehnt ${datumDe(a.abgelehntAm)}${a.grund ? ` — ${a.grund}` : ''}` : '', a.abgelaufenAm ? `abgelaufen ${datumDe(a.abgelaufenAm)}` : '', a.personGeloest ? 'Personenbezug gelöst (Art. 17)' : ''].filter(Boolean).join(' · ')}
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
          {(a.status === 'gestellt' || a.status === 'abgelaufen' || a.status === 'angenommen') && k && !gesendet && !meldungStart && <Knopf leise onClick={alsGesendet}>Mail ist raus — als gesendet vermerken</Knopf>}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && <Knopf leise onClick={mailOeffnen}>Mail öffnen</Knopf>}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && <Knopf farbe={LEUCHT.gut} onClick={annehmen}>Angenommen</Knopf>}
          {(a.status === 'gestellt' || a.status === 'abgelaufen') && !ablehnen && <Knopf leise onClick={() => setAblehnen(true)}>Abgelehnt …</Knopf>}
          {a.status !== 'angenommen' && a.status !== 'ersetzt' && !(nachfolger && nachfolger.status === 'entwurf') && (
            <Knopf leise onClick={async () => { const r = await angebotPost({ aktion: 'version', id: a.id }); if (r.ok && r.angebot) { daten.uebernehmen(r.angebot); onOeffnen(r.angebot.id); } else setMeldung(r.fehler ?? 'Keine neue Version.'); }}>Neue Version</Knopf>
          )}
          {a.status === 'angenommen' && deal && !hatMandat && !mandat && <Knopf farbe={LEUCHT.gut} onClick={mandatAnlegen}>Mandat anlegen</Knopf>}
          {mandat && <span style={{ fontSize: TYP.bedien, color: LEUCHT.gut, alignSelf: 'center' }}>{mandat}</span>}
          {a.status === 'angenommen' && hatMandat && !mandat && <Chip farbe={LEUCHT.gut}>Mandat angelegt</Chip>}
          {a.status === 'angenommen' && mandatZiel && <Link href={WEG.mandat(mandatZiel)} style={{ ...link, alignSelf: 'center' }}>Zum Mandat ›</Link>}
          {a.status === 'angenommen' && mandatZiel && <Knopf leise onClick={ersteRechnung}>Erste Rechnung</Knopf>}
          {a.status === 'angenommen' && mandatZiel && gemischt && !einmal?.id && <Knopf leise onClick={einmalPlanen}>Einmalbetrag als Rechnung planen</Knopf>}
          {einmal?.id && <Link href={WEG.rechnungSchreiben(einmal.id)} style={{ ...link, alignSelf: 'center' }}>Einmalbetrag: Rechnung (geplant) ›</Link>}
          {einmal?.fehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, alignSelf: 'center' }}>{einmal.fehler}</span>}
          {/* Angebot → Rechnung (08.10.): Entwurf mit den Positionen, Kunde, Mandat und Gesellschaft — gestellt wird im Editor. */}
          {/* Gemischt mit Mandat (3.6): Einmalbetrag und Monatsrechnung laufen getrennt — keine Rechnung über alle Positionen daneben. */}
          {a.status === 'angenommen' && !(gemischt && mandatZiel) && <RechnungAusAngebot angebotId={a.id} onFehler={setMeldung} />}
        </div>
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
