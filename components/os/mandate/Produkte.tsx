'use client';

// ─── Produkte (Produkte & Mandate › Produkte) ───────────────────────────────
// Kevin 25.09.: „Da werden wir unsere Produkte abbilden und Mandate abbilden.“
// Je Produkt (Leistung aus dem Katalog): Linie, Stufe Einstieg → Kern →
// Premium, Preis, Status, Gesellschaft, Beschreibung, Lieferumfang, Ergebnis
// und Grenzen — dazu die Zahlen (aktive Mandate, Monatsumsatz, Pipeline,
// Abschlussquote), der Ablauf in Phasen (ein Mandat steht in einer Phase),
// die Unterlagen (Angebot, Vertrag, Deck … als https-Link oder Brain-Notiz)
// und welche Mandate und Deals darauf laufen. Gerechnet wird in
// lib/crm/produkte.ts. Änderungen gehen als Einzelfelder raus (api.teil).
// 27.09. (Kevin: „clean von vorne bis hinten“): Produkte sind die eine Quelle
// der Umsatzbausteine in der Finanzplanung — je Produkt Basis (Monat · Jahr ·
// einmalig), Laufzeit, Aufwandsanteil; was der Planung fehlt, steht dran; und
// in welchen Szenarien das Produkt steckt (lesend über /api/finanzplan/vorschlaege).
// 04.10. (Kevin: „man kann keine Produkte löschen“): jede Produktzeile hängt am Baustein `ZeileAktionen` — Handy nach links
// wischen, Rechner Knöpfe am Rand: Archivieren (= „eingestellt“, Reiter Archiv, zurückholbar) und Löschen (Papierkorb
// 30 Tage, `geloeschtAm`; laufende Mandate/offene Deals → Rückfrage). Endgültig nur aus dem Papierkorb, ohne Verweise.

import { WEG } from '@/lib/wege';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { preisBasisVon, planungFehlt, margeVon, einheitFuerBasis, produktEinheit, type PreisBasis } from '@/lib/finanzen/produkte';
import { useRouter } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Knopf, Chip, Punkt, Zahl, Raster, feld, LEUCHT, Segmente, ZeileAktionen, useRueckgaengig, useRueckfrage } from '../ui';
import type { Leistung, ProduktPhase, Unterlage, UnterlageArt } from '@/lib/crm/typen';
import { LINIEN, linienGruppen, linieVon, produktZahlen, portfolio, neuePhasenId, produktZustand, produktVerweise, verweisSatz, produktePapierkorb, produktArchivieren, produktZurueck } from '@/lib/crm/produkte';
import { PAPIERKORB_TAGE } from '@/lib/eintraege/sicher';
import { mandateLink } from '@/lib/crm/adresse';
import { type CrmApi, neueId, euro, kurzEuro, datum } from '../crm/daten';
import { Feldzeile, Pillen, Feld } from '../crm/teile';
import { GesellschaftWahl } from '../crm/GesellschaftWahl';
import { useLinkAuswahl } from '../Verlauf';
import { produktAngebotFehlt } from '@/lib/crm/angebote';
import { angebotLink } from '@/lib/crm/adresse';

const STUFE: Record<Leistung['stufe'], string> = { einstieg: 'Einstieg', kern: 'Kern', premium: 'Premium' };
const TYP_LABEL: Record<Leistung['typ'], string> = { diagnose: 'Diagnose', workshop: 'Workshop', retainer: 'Retainer', sprint: 'Sprint', vermittlung: 'Vermittlung', software: 'Software' };
const ART: { id: UnterlageArt; label: string }[] = [{ id: 'angebot', label: 'Angebot' }, { id: 'vertrag', label: 'Vertrag' }, { id: 'deck', label: 'Deck' }, { id: 'onepager', label: 'Onepager' }, { id: 'sonstiges', label: 'Sonstiges' }];
const statusFarbe = (s: Leistung['status']) => (s === 'aktiv' ? LEUCHT.gut : s === 'entwurf' ? LEUCHT.achtung : C.inkLeise);
const preisText = (l: Leistung) => (l.preis.betrag ? `${euro(l.preis.betrag)}${l.preis.bis ? `–${euro(l.preis.bis)}` : ''} ${produktEinheit(l)}` : 'Preis offen');
const klein = { fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5 } as const;
const BASIS: { id: PreisBasis; label: string }[] = [{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }];

type InSzenarien = Record<string, { id: string; name: string; arbeitsplan: boolean; menge: number }[]>;
/** In welchen Planszenarien der Finanzplanung die Produkte stecken — null ohne Zugang (Haushalt) oder ohne Plan. */
function useInSzenarien(): InSzenarien | null {
  const [v, setV] = useState<InSzenarien | null>(null);
  useEffect(() => {
    let weg = false;
    fetch('/api/finanzplan/vorschlaege', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((a: { ok?: boolean; inSzenarien?: InSzenarien } | null) => { if (!weg && a?.ok) setV(a.inSzenarien ?? {}); }).catch(() => { /* ohne Finanzplanung */ });
    return () => { weg = true; };
  }, []);
  return v;
}

type Sicht = 'produkte' | 'archiv' | 'papierkorb';

export function Produkte({ api }: { api: CrmApi }) {
  const [auswahl, setAuswahl] = useLinkAuswahl();
  const [sicht, setSicht] = useState<Sicht>('produkte');
  const { melden, hinweis } = useRueckgaengig();
  const { fragen, dialog } = useRueckfrage();
  const crm = api.crm;
  const alle = crm?.stand.leistungen;
  const aktiv = useMemo(() => (alle ?? []).filter(l => produktZustand(l) === 'aktiv'), [alle]);
  const archiv = useMemo(() => (alle ?? []).filter(l => produktZustand(l) === 'archiv'), [alle]);
  const gruppen = useMemo(() => linienGruppen(sicht === 'archiv' ? archiv : aktiv), [sicht, archiv, aktiv]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;
  const p = portfolio(crm.stand);
  const korb = produktePapierkorb(crm.stand);
  const ohnePreis = aktiv.filter(l => !l.preis.betrag).length;
  const unvollstaendig = aktiv.filter(l => planungFehlt(l).length).length;
  const neu = () => { const id = neueId('l'); void api.setze('leistungen', { id, name: 'Neues Produkt', typ: 'retainer', stufe: 'kern', preis: { betrag: 0, einheit: 'Monat netto' }, lieferumfang: [], gesellschaft: 'offen', status: 'entwurf' }); setSicht('produkte'); setAuswahl(id); };

  // ── Archivieren · Zurückholen · Löschen (04.10.) — sicher statt endgültig, jeweils mit „Rückgängig“ ──
  const archivieren = (l: Leistung) => {
    const vorher = l.status;
    if (auswahl === l.id) setAuswahl(null);
    void api.teil('leistungen', l.id, produktArchivieren(l));
    melden(`„${l.name}“ archiviert — bleibt an Deals und Mandaten lesbar`, () => void api.teil('leistungen', l.id, { status: vorher }));
  };
  const zurueckholen = (l: Leistung) => {
    const felder = produktZurueck(l, !produktAngebotFehlt(l).length);
    void api.teil('leistungen', l.id, felder);
    melden(`„${l.name}“ ist zurück — ${felder.status === 'aktiv' ? 'wieder aktiv' : 'als Entwurf (Leistungstext fehlt für „aktiv“)'}`, () => void api.teil('leistungen', l.id, { status: 'eingestellt' }));
  };
  const inPapierkorb = (l: Leistung) => {
    if (auswahl === l.id) setAuswahl(null);
    // Die Zeit setzt der Server (lib/eintraege/sicher.ts `markeVomServer`) — der Browser schickt nur „jetzt“.
    void api.teil('leistungen', l.id, { geloeschtAm: new Date().toISOString() });
    melden(`„${l.name}“ im Papierkorb — 30 Tage wiederherstellbar`, () => void api.teil('leistungen', l.id, { geloeschtAm: null }));
  };
  const loeschen = (l: Leistung) => {
    const v = produktVerweise(l.id, crm.stand);
    const laufend = verweisSatz(v);
    if (!laufend) { inPapierkorb(l); return; }
    // Verknüpfungen: nie still — die Rückfrage nennt, was daran hängt, und bietet das Archiv als ruhigeren Weg an.
    fragen({
      titel: `„${l.name}“ in den Papierkorb?`,
      text: <>An diesem Produkt hängen {laufend}. Sie bleiben, wie sie sind, und zeigen das Produkt weiter an. Endgültig gelöscht wird es erst, wenn nichts mehr daran hängt — bis dahin liegt es im Papierkorb. Soll es nur nicht mehr angeboten werden, ist <b>Archivieren</b> der ruhigere Weg.</>,
      wahl: [{ label: 'Archivieren', ton: 'leise', tun: () => archivieren(l) }, { label: 'In den Papierkorb', ton: 'gefahr', tun: () => inPapierkorb(l) }],
    });
  };
  const wiederherstellen = (id: string, name: string) => {
    void api.teil('leistungen', id, { geloeschtAm: null });
    melden(`„${name}“ wiederhergestellt`, () => void api.teil('leistungen', id, { geloeschtAm: new Date().toISOString() }));
  };
  const endgueltig = (id: string, name: string) => fragen({
    titel: `„${name}“ endgültig löschen?`,
    text: 'Das Produkt verschwindet ganz — mit Angebotstexten, Phasen und Unterlagen-Links. Das lässt sich nicht rückgängig machen.',
    wahl: [{ label: 'Endgültig löschen', ton: 'gefahr', tun: () => api.weg('leistungen', id) }],
  });

  const zeile = (l: Leistung) => {
    const z = produktZahlen(l, crm.stand);
    const zahlen = [z.mandateAktiv ? `${z.mandateAktiv} aktiv` : '', z.mrr ? `${kurzEuro(z.mrr)}/Monat` : '', z.dealsOffen ? `${z.dealsOffen} Deal${z.dealsOffen === 1 ? '' : 's'} offen` : '', z.quote !== null ? `Quote ${Math.round(z.quote * 100)} %` : ''].filter(Boolean).join(' · ');
    return (
      <div key={l.id}>
        <ZeileAktionen titel={l.name} archiviert={sicht === 'archiv'} onArchivieren={() => (sicht === 'archiv' ? zurueckholen(l) : archivieren(l))} onLoeschen={() => loeschen(l)}>
          <Zeile onClick={() => setAuswahl(auswahl === l.id ? null : l.id)} aktiv={auswahl === l.id} links={<Punkt farbe={statusFarbe(l.status)} />}
            titel={l.name} unter={[`${STUFE[l.stufe]} · ${preisText(l)}`, zahlen, sicht === 'produkte' && planungFehlt(l).length ? `Planung: ${planungFehlt(l).join(', ')} fehlt` : ''].filter(Boolean).join(' · ')}
            rechts={<span style={{ display: 'flex', gap: 6 }}>{l.phasen?.length ? <Chip farbe={C.inkDim}>{l.phasen.length} Phasen</Chip> : null}{l.status !== 'eingestellt' && produktAngebotFehlt(l).length ? <Chip farbe={LEUCHT.achtung}>Text fehlt</Chip> : null}<Chip farbe={statusFarbe(l.status)}>{l.status}</Chip></span>} />
        </ZeileAktionen>
        {auswahl === l.id && <ProduktDetail l={l} api={api} />}
      </div>
    );
  };

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<Knopf onClick={neu}>+ Produkt</Knopf>}>Produkte</Ueberschrift>
        <Raster min={150}>
          <Zahl wert={String(p.produkteAktiv)} label="aktive Produkte" farbe={LEUCHT.gut} />
          <Zahl wert={String(linienGruppen(aktiv).length)} label={linienGruppen(aktiv).length === 1 ? 'Produktlinie' : 'Produktlinien'} />
          <Zahl wert={String(ohnePreis)} label="noch ohne Preis" farbe={ohnePreis ? LEUCHT.achtung : undefined} />
          <Zahl wert={String(p.ohneProdukt)} label="laufende Mandate ohne Produkt" farbe={p.ohneProdukt ? LEUCHT.achtung : undefined} />
          <Zahl wert={String(unvollstaendig)} label="für die Planung unvollständig" farbe={unvollstaendig ? LEUCHT.achtung : undefined} />
        </Raster>
        <div style={{ ...klein, marginTop: 10 }}>Einstieg → Kern → Premium: jedes Produkt mit klarem Umfang, Preis und Ablauf. Entwürfe ohne Preis sind noch nicht verkaufbar. {p.ohneProdukt ? `${p.ohneProdukt} laufende Mandate hängen an keinem Produkt — im Mandat unter „Produkt“ zuordnen, dann zählen sie hier mit.` : ''}</div>
      </Karte>
      <Segmente<Sicht> liste={[{ id: 'produkte', label: `Produkte · ${aktiv.length}` }, { id: 'archiv', label: `Archiv · ${archiv.length}` }, { id: 'papierkorb', label: `Papierkorb · ${korb.length}` }]} aktiv={sicht} onWahl={x => { setSicht(x); setAuswahl(null); }} />
      {sicht !== 'papierkorb' && gruppen.map((g, gi) => (
        <Karte key={g.linie} i={gi + 1}>
          <Ueberschrift farbe={sicht === 'archiv' ? C.inkDim : LEUCHT.business} rechts={`${g.produkte.length} ${g.produkte.length === 1 ? 'Produkt' : 'Produkte'}`}>{g.linie}</Ueberschrift>
          <Liste>{g.produkte.map(zeile)}</Liste>
        </Karte>
      ))}
      {sicht === 'produkte' && !gruppen.length && <Karte i={1}><Leer>Noch keine Produkte — „+ Produkt“.</Leer></Karte>}
      {sicht === 'archiv' && !gruppen.length && <Karte i={1}><Leer>Das Archiv ist leer. Ein archiviertes Produkt wird nicht mehr angeboten, bleibt an Deals und Mandaten lesbar und lässt sich jederzeit zurückholen.</Leer></Karte>}
      {sicht === 'papierkorb' && (
        <Karte i={1}>
          <Ueberschrift rechts={`${PAPIERKORB_TAGE} Tage`}>Papierkorb</Ueberschrift>
          <Liste>
            {korb.map(e => (
              <Zeile key={e.id} links={<Punkt farbe={C.inkLeise} />} titel={e.name} umbrechen
                unter={`gelöscht ${datum(e.geloeschtAm.slice(0, 10))} · ${e.haengt ? `bleibt, solange ${[e.verweise.mandate ? `${e.verweise.mandate} Mandat${e.verweise.mandate === 1 ? '' : 'e'}` : '', e.verweise.deals ? `${e.verweise.deals} Deal${e.verweise.deals === 1 ? '' : 's'}` : ''].filter(Boolean).join(' und ')} darauf zeig${e.verweise.mandate + e.verweise.deals === 1 ? 't' : 'en'}` : `endgültig ab ${datum(e.bisTag)}`}`}
                rechts={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Knopf leise onClick={() => wiederherstellen(e.id, e.name)}>Wiederherstellen</Knopf>
                  {!e.haengt && <Knopf leise farbe={LEUCHT.kritisch} onClick={() => endgueltig(e.id, e.name)}>Endgültig löschen</Knopf>}
                </span>} />
            ))}
          </Liste>
          {!korb.length && <Leer>Der Papierkorb ist leer. Gelöschte Produkte liegen hier {PAPIERKORB_TAGE} Tage, bevor sie endgültig gehen.</Leer>}
        </Karte>
      )}
      {dialog}
      {hinweis}
    </>
  );
}

function ProduktDetail({ l, api }: { l: Leistung; api: CrmApi }) {
  const router = useRouter();
  const crm = api.crm!;
  const inSzenarien = useInSzenarien();
  const { bestaetigen, dialog } = useRueckfrage();
  const fehlt = planungFehlt(l);
  const basis = preisBasisVon(l);
  const marge = margeVon(l);
  const setze = (teil: Partial<Leistung>) => void api.teil('leistungen', l.id, teil as Record<string, unknown>);
  const z = produktZahlen(l, crm.stand);
  const mandate = crm.stand.mandate.filter(m => m.leistungId === l.id).sort((a, b) => (a.status === 'aktiv' ? 0 : 1) - (b.status === 'aktiv' ? 0 : 1) || a.kunde.localeCompare(b.kunde));
  const deals = crm.stand.chancen.filter(c => c.leistungId === l.id);
  const linien = Array.from(new Set([...LINIEN, ...crm.stand.leistungen.map(linieVon)]));
  const phasen = l.phasen ?? [];
  const unterlagen = l.unterlagen ?? [];
  const [neueU, setNeueU] = useState<{ titel: string; art: UnterlageArt; url: string }>({ titel: '', art: 'angebot', url: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const [statusHinweis, setStatusHinweis] = useState(false);
  const angebotFehlt = produktAngebotFehlt(l);
  const angebotText = (f: 'titel' | 'einleitung' | 'leistungstext' | 'ergebnis' | 'hinweise', v: string) => setze({ angebot: { leistungstext: l.angebot?.leistungstext ?? '', ...(l.angebot ?? {}), [f]: v } });
  const setzePhasen = (neu: ProduktPhase[]) => setze({ phasen: neu });
  const verschiebe = (i: number, d: -1 | 1) => { const n = [...phasen]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setzePhasen(n); };
  const linkOk = (u: string) => /^https:\/\/\S+$/i.test(u) || /^\/os\/wissen\?n=\S+$/.test(u);
  const unterlageDazu = () => {
    const url = neueU.url.trim();
    if (!neueU.titel.trim()) return;
    if (url && !linkOk(url)) { setFehler('Nur https-Links oder Brain-Notizen (/os/wissen?n=…).'); return; }
    setFehler(null);
    const u: Unterlage = { id: neueId('u'), titel: neueU.titel.trim(), art: neueU.art, ...(url ? { url } : {}) };
    setze({ unterlagen: [...unterlagen, u] });
    setNeueU({ titel: '', art: neueU.art, url: '' });
  };
  const textfeld = (label: string, wert: string | undefined, feldname: keyof Leistung, zeilen = 3) => (
    <Feldzeile label={label}>
      <textarea key={`${l.id}-${feldname}-${(wert ?? '').length}`} defaultValue={wert ?? ''} rows={zeilen} aria-label={label} onBlur={e => { if (e.target.value !== (wert ?? '')) setze({ [feldname]: e.target.value.trim() } as Partial<Leistung>); }}
        style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5, padding: '8px 11px' }} />
    </Feldzeile>
  );
  const abschnitt = { display: 'grid', gap: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' } as const;
  const kopf = { fontSize: 12, fontWeight: 700, color: C.inkDim, letterSpacing: '.08em', textTransform: 'uppercase' } as const;

  return (
    <div style={{ padding: '10px 2px 18px', display: 'grid', gap: 12, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <Raster min={120}>
        <Zahl wert={String(z.mandateAktiv)} label={`aktive Mandate (${z.mandateGesamt} gesamt)`} />
        <Zahl wert={kurzEuro(z.mrr)} label="je Monat aus aktiven Mandaten" farbe={LEUCHT.geld} />
        <Zahl wert={String(z.dealsOffen)} label={z.pipelineWert ? `Deals offen · ${kurzEuro(z.pipelineWert)}/Monat` : 'Deals offen'} farbe={LEUCHT.business} />
        <Zahl wert={z.quote !== null ? `${Math.round(z.quote * 100)} %` : '—'} label={`Abschlussquote (${z.gewonnen} gewonnen, ${z.verloren} verloren)`} />
      </Raster>

      <Feldzeile label="Name"><Feld wert={l.name} onFertig={name => name.trim() && setze({ name: name.trim() })} /></Feldzeile>
      <Feldzeile label="Produktlinie">
        <div>
          <input list={`linien-${l.id}`} defaultValue={l.linie ?? ''} key={`${l.id}-${l.linie ?? ''}`} placeholder={`${linieVon(l)} (aus dem Typ)`} aria-label="Produktlinie"
            onBlur={e => { const v = e.target.value.trim(); if (v !== (l.linie ?? '')) setze({ linie: v }); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <datalist id={`linien-${l.id}`}>{linien.map(x => <option key={x} value={x} />)}</datalist>
        </div>
      </Feldzeile>
      <Feldzeile label="Typ"><Pillen liste={(Object.keys(TYP_LABEL) as Leistung['typ'][]).map(t => ({ id: t, label: TYP_LABEL[t] }))} aktiv={l.typ} onWahl={typ => setze({ typ })} /></Feldzeile>
      <Feldzeile label="Stufe"><Pillen liste={[{ id: 'einstieg', label: 'Einstieg' }, { id: 'kern', label: 'Kern' }, { id: 'premium', label: 'Premium' }]} aktiv={l.stufe} onWahl={stufe => setze({ stufe })} /></Feldzeile>
      <Feldzeile label="Preis">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Feld typ="number" wert={l.preis.betrag ? String(l.preis.betrag) : ''} breite={110} platzhalter="€ ab" onFertig={b => setze({ preis: { ...l.preis, betrag: Number(b) || 0 } })} />
          <Feld typ="number" wert={l.preis.bis ? String(l.preis.bis) : ''} breite={110} platzhalter="€ bis" onFertig={b => setze({ preis: { ...l.preis, bis: Number(b) || undefined } })} />
          <div style={{ flex: 1, minWidth: 160 }}><Feld wert={l.preis.einheit} platzhalter="Einheit (z. B. Monat netto)" onFertig={einheit => setze({ preis: { ...l.preis, einheit } })} /></div>
        </div>
      </Feldzeile>
      <Feldzeile label="Basis">
        <div style={{ display: 'grid', gap: 4 }}>
          {/* Basis wählen zieht die Einheit mit, wenn sie einer anderen Basis widerspricht (einmalig → „pauschal netto“ statt „Monat netto“). */}
          <Pillen liste={BASIS} aktiv={basis} onWahl={b => setze({ preis: { ...l.preis, basis: b, einheit: einheitFuerBasis(l.preis.einheit, b) } })} />
          {!l.preis.basis && basis && <div style={klein}>aus der Einheit „{l.preis.einheit}“ abgeleitet — anklicken macht es fest.</div>}
        </div>
      </Feldzeile>
      <Feldzeile label="Laufzeit">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" wert={l.laufzeitMonate ? String(l.laufzeitMonate) : ''} breite={110} platzhalter="Monate" onFertig={v => setze({ laufzeitMonate: Math.max(0, Math.round(Number(v))) || undefined })} />
          <span style={klein}>{basis === 'einmalig' ? 'bei einmalig ohne Bedeutung' : 'typische Laufzeit — so lange läuft ein Umsatzbaustein in der Planung'}</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Aufwand">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Feld typ="number" wert={l.aufwand?.anteil != null ? String(Math.round(l.aufwand.anteil * 100)) : ''} breite={90} platzhalter="% vom Preis" onFertig={v => { const n = Number(v); setze({ aufwand: { ...(l.aufwand ?? {}), anteil: Number.isFinite(n) && v !== '' ? Math.max(0, Math.min(100, n)) / 100 : undefined } }); }} />
          <Feld typ="number" wert={l.aufwand?.stunden ? String(l.aufwand.stunden) : ''} breite={90} platzhalter="Stunden" onFertig={v => setze({ aufwand: { ...(l.aufwand ?? {}), stunden: Math.max(0, Number(v)) || undefined } })} />
          <span style={klein}>{marge ? `Marge je Einheit ${euro(marge.marge)} (${Math.round((1 - marge.anteil) * 100)} %)` : 'Kostenanteil für die Marge — optional'}</span>
        </div>
      </Feldzeile>
      <Feldzeile label="Planung">
        <div style={{ display: 'grid', gap: 4, fontSize: TYP.bedien }}>
          {fehlt.length ? <span style={{ color: LEUCHT.achtung }}>Für die Planung fehlt: {fehlt.join(', ')}</span> : <span style={{ color: LEUCHT.gut }}>planbar — Preis, Basis, Laufzeit und Gesellschaft sind da</span>}
          {inSzenarien && (inSzenarien[l.id]?.length ? <span style={{ color: C.inkDim }}>In Szenarien: {inSzenarien[l.id].map(s => `${s.arbeitsplan ? '★ ' : ''}${s.name} (${s.menge}×)`).join(' · ')}</span> : <span style={klein}>In keinem Szenario der Finanzplanung.</span>)}
          <Link href={WEG.finanzplanung('business', 'planen')} style={{ color: C.aktiv, fontSize: TYP.bedien }}>In der Finanzplanung verwenden ›</Link>
        </div>
      </Feldzeile>
      <Feldzeile label="Status">
        <div style={{ display: 'grid', gap: 4 }}>
          {/* „aktiv“ (online) erst mit Leistungstext (28.09., Kevin) — der Server lehnt sonst mit 409 ab. */}
          <Pillen liste={[{ id: 'aktiv', label: angebotFehlt.length && l.status !== 'aktiv' ? 'aktiv 🔒' : 'aktiv' }, { id: 'entwurf', label: 'Entwurf' }, { id: 'eingestellt', label: 'eingestellt' }]} aktiv={l.status}
            onWahl={status => { if (status === 'aktiv' && l.status !== 'aktiv' && angebotFehlt.length) { setStatusHinweis(true); return; } setStatusHinweis(false); setze({ status }); }} />
          {angebotFehlt.length > 0 && <span style={{ fontSize: 12.5, color: LEUCHT.achtung, fontWeight: statusHinweis ? 700 : 400 }}>für Angebote fehlt: {angebotFehlt.join(', ')}{l.status === 'aktiv' ? ' — im Angebots-Tool als „Text fehlt“ markiert' : ' — „aktiv“ ist gesperrt, bis er steht (unten unter Angebotstexte)'}</span>}
        </div>
      </Feldzeile>
      <Feldzeile label="Gesellschaft"><GesellschaftWahl wert={l.gesellschaft} onWahl={gesellschaft => setze({ gesellschaft })} /></Feldzeile>
      {textfeld('Beschreibung', l.beschreibung, 'beschreibung')}
      {textfeld('Ergebnis', l.ergebnis, 'ergebnis', 2)}
      {textfeld('Grenzen', l.grenzen, 'grenzen', 2)}
      <Feldzeile label="Lieferumfang">
        <div style={{ display: 'grid', gap: 4 }}>
          {l.lieferumfang.map((y, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim, alignItems: 'baseline' }}>
              <span style={{ flex: 1 }}>· {y}</span>
              <button onClick={() => setze({ lieferumfang: l.lieferumfang.filter((_, j) => j !== i) })} aria-label="Entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <Feld platzhalter="+ Punkt hinzufügen (Enter)" onFertig={t => t.trim() && setze({ lieferumfang: [...l.lieferumfang, t.trim()] })} />
        </div>
      </Feldzeile>

      <div style={abschnitt}>
        <div style={kopf}>Angebotstexte</div>
        <div style={klein}>Daraus baut das Angebots-Tool die Position — ein Klick im Call, der Text steht. Der Leistungstext ist Pflicht, bevor das Produkt aktiv geht. <Link href={angebotLink({})} style={{ color: C.aktiv }}>Zum Angebots-Tool ›</Link></div>
        {([['titel', 'Titel im Angebot', 1, `leer = „${l.name}“`], ['einleitung', 'Einleitung', 2, 'optional'], ['leistungstext', 'Leistungstext *', 5, 'Was genau geliefert wird — Pflicht'], ['ergebnis', 'Ergebnis', 2, 'Was der Kunde danach hat'], ['hinweise', 'Hinweise', 2, 'Voraussetzungen, Mitwirkung, Grenzen']] as const).map(([f, label, zeilen, platz]) => (
          <Feldzeile key={f} label={label}>
            <textarea key={`${l.id}-ang-${f}-${(l.angebot?.[f] ?? '').length}`} defaultValue={l.angebot?.[f] ?? ''} rows={zeilen} aria-label={label} placeholder={platz}
              onBlur={e => { if (e.target.value.trim() !== (l.angebot?.[f] ?? '')) angebotText(f, e.target.value.trim()); }}
              style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5, padding: '8px 11px', ...(f === 'leistungstext' && angebotFehlt.length ? { borderColor: `${LEUCHT.achtung}88` } : {}) }} />
          </Feldzeile>
        ))}
      </div>

      <div style={abschnitt}>
        <div style={kopf}>Ablauf in Phasen</div>
        <div style={klein}>Die Schritte, die ein Mandat auf diesem Produkt durchläuft — im Mandat steht, wo es gerade ist.</div>
        {phasen.map((ph, i) => {
          const dort = mandate.filter(m => m.status !== 'beendet' && (m.phase ?? phasen[0].id) === ph.id).length;
          return (
            <div key={ph.id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) 90px auto', gap: 8, alignItems: 'center' }}>
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, color: LEUCHT.business, textAlign: 'center' }}>{i + 1}</span>
              <Feld wert={ph.name} platzhalter="Name der Phase" onFertig={name => name.trim() && setzePhasen(phasen.map(x => (x.id === ph.id ? { ...x, name: name.trim() } : x)))} />
              <Feld typ="number" wert={ph.dauerTage ? String(ph.dauerTage) : ''} platzhalter="Tage" onFertig={d => setzePhasen(phasen.map(x => (x.id === ph.id ? { ...x, dauerTage: Number(d) || undefined } : x)))} />
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
                {dort > 0 && <Chip farbe={LEUCHT.gut}>{dort} hier</Chip>}
                <button onClick={() => verschiebe(i, -1)} aria-label="Nach oben" disabled={i === 0} style={{ background: 'none', border: 'none', color: i === 0 ? C.linie : C.inkDim, cursor: 'pointer' }}>↑</button>
                <button onClick={() => verschiebe(i, 1)} aria-label="Nach unten" disabled={i === phasen.length - 1} style={{ background: 'none', border: 'none', color: i === phasen.length - 1 ? C.linie : C.inkDim, cursor: 'pointer' }}>↓</button>
                <button onClick={async () => { if (!dort || (await bestaetigen({ titel: 'Phase trotzdem entfernen?', text: `${dort} Mandate stehen in dieser Phase. Sie rücken in die erste Phase.`, ja: 'Entfernen', gefahr: true }))) setzePhasen(phasen.filter(x => x.id !== ph.id)); }} aria-label="Phase entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
              </span>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={() => setzePhasen([...phasen, { id: neuePhasenId(l), name: `Phase ${phasen.length + 1}` }])}>+ Phase</Knopf>
          {!phasen.length && <Knopf leise onClick={() => setzePhasen([{ id: 'p1', name: 'Kickoff', dauerTage: 14 }, { id: 'p2', name: 'Diagnose', dauerTage: 30 }, { id: 'p3', name: 'Umsetzung', dauerTage: 90 }, { id: 'p4', name: 'Review & Verlängerung', dauerTage: 14 }])}>Vorschlag: Kickoff → Diagnose → Umsetzung → Review</Knopf>}
        </div>
      </div>

      <div style={abschnitt}>
        <div style={kopf}>Unterlagen</div>
        {unterlagen.map(u => (
          <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, flexWrap: 'wrap' }}>
            <Chip farbe={C.inkDim}>{ART.find(a => a.id === u.art)?.label}</Chip>
            {u.url ? <a href={u.url} target={u.url.startsWith('https://') ? '_blank' : undefined} rel="noopener noreferrer" style={{ color: C.ink, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)', textUnderlineOffset: 3 }}>{u.titel}{u.url.startsWith('https://') ? ' ↗' : ''}</a> : <span style={{ color: C.inkDim }}>{u.titel} <span style={{ color: C.inkLeise }}>(ohne Link)</span></span>}
            <span style={{ flex: 1 }} />
            <button onClick={() => setze({ unterlagen: unterlagen.filter(x => x.id !== u.id) })} aria-label="Unterlage entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>×</button>
          </div>
        ))}
        {!unterlagen.length && <div style={klein}>Noch keine — Angebotsvorlage, Vertrag, Deck oder Onepager verlinken (https) oder eine Brain-Notiz (/os/wissen?n=…).</div>}
        <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>
          <Pillen liste={ART} aktiv={neueU.art} onWahl={art => setNeueU({ ...neueU, art })} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={neueU.titel} onChange={e => setNeueU({ ...neueU, titel: e.target.value })} placeholder="Titel" aria-label="Titel der Unterlage" style={{ ...feld, flex: '1 1 160px', fontSize: TYP.bedien, padding: '8px 11px' }} />
            <input value={neueU.url} onChange={e => setNeueU({ ...neueU, url: e.target.value })} placeholder="https://… oder /os/wissen?n=…" aria-label="Link zur Unterlage" onKeyDown={e => { if (e.key === 'Enter') unterlageDazu(); }} style={{ ...feld, flex: '2 1 220px', fontSize: TYP.bedien, padding: '8px 11px' }} />
            <Knopf leise aus={!neueU.titel.trim()} onClick={unterlageDazu}>Hinzufügen</Knopf>
          </div>
          {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
        </div>
      </div>

      <div style={abschnitt}>
        <div style={kopf}>Mandate auf diesem Produkt</div>
        {mandate.map(m => {
          const ph = m.phase ? phasen.find(x => x.id === m.phase) : phasen[0];
          return (
            <Zeile key={m.id} onClick={() => router.push(mandateLink('mandate', m.id))} links={<Punkt farbe={m.status === 'aktiv' ? LEUCHT.gut : C.inkLeise} />}
              titel={<>{m.kunde}<span style={{ color: C.inkLeise }}> · {m.titel.slice(0, 60)}</span></>}
              unter={[m.status, m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : ''}` : '', ph ? `Phase: ${ph.name}` : ''].filter(Boolean).join(' · ')} />
          );
        })}
        {!mandate.length && <div style={klein}>Noch kein Mandat — im Mandat unter „Produkt“ dieses Produkt wählen.</div>}
        {deals.length > 0 && (
          <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
            <div style={kopf}>Deals</div>
            {deals.map(c => (
              <Zeile key={c.id} onClick={() => router.push(WEG.deal(c.id))} links={<Punkt farbe={c.stufe === 'gewonnen' ? LEUCHT.gut : c.stufe === 'verloren' ? C.inkLeise : LEUCHT.business} />}
                titel={c.titel} unter={`${crm.stufen.find(s => s.id === c.stufe)?.label ?? c.stufe}${c.wert.betrag ? ` · ${euro(c.wert.betrag)}` : ''}`} />
            ))}
          </div>
        )}
      </div>
      {l.quelle && <div style={klein}>Quelle: {l.quelle}</div>}
      {dialog}
    </div>
  );
}
