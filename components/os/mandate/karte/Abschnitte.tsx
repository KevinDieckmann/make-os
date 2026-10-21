'use client';

// ─── Produkt-Karte · die Abschnitte (P2, 19.10.) ─────────────────────────────────────────────────────────────────────────
// Vertrag · Regeln · Texte · Lieferumfang · Aufwand & Kapazität · Ziel & Planung · Mandate & Deals · Name, Linie & Unterlagen. Jeder Abschnitt
// baut seine Änderung über lib/crm/produkt-katalog.ts (geprüft wie der Server) und schreibt über `speichern` (= `api.teil` mit Stand). Ein
// abgelehnter Wert bleibt mit Satz am Feld stehen; was der Server ablehnt, zeigt die Karte im Abschnitt.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, ECKE, FLAECHE_STIL } from '@/lib/make-one/design';
import { Pillen, Chip, Hinweis, Knopf, SymbolKnopf, Liste, Zeile, Punkt, Leer, feld, LEUCHT } from '../../ui';
import { Wahl, WahlMehrfach } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { mandateLink } from '@/lib/crm/adresse';
import { titelOhneFirma } from '@/lib/crm/mandat-name';
import { vertragVon, PRODUKT_GRENZEN, INKLUSIVE_JE } from '@/lib/crm/produkt-karte';
import {
  vertragAenderung, regelnAenderung, textAenderung, texteVon, lieferumfangDazu, lieferumfangBeimSchliessen, aufwandText, planungsSicht, DANACH_LABEL, RHYTHMUS_LABEL, TEXT_FELDER, LIEFER_MAX,
} from '@/lib/crm/produkt-katalog';
import { planungFehlt, margeVon } from '@/lib/finanzen/produkte';
import type { CrmBestand, Leistung, ProduktVertrag, Unterlage, UnterlageArt } from '@/lib/crm/typen';
import { euro, neueId } from '../../crm/daten';
import { Feld, ZahlFeld, TextFeld } from './felder';

export type Speichern = (felder: Record<string, unknown>) => Promise<boolean>;
const raster = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', minWidth: 0 } as const;
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const ruhig = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;

// ── Vertrag ──────────────────────────────────────────────────────────────────

export function VertragTeil({ l, speichern }: { l: Leistung; speichern: Speichern }) {
  const v = vertragVon(l);
  const setze = async (feldName: keyof ProduktVertrag, wert: ProduktVertrag[keyof ProduktVertrag] | null): Promise<string | undefined> => {
    const r = vertragAenderung(l, feldName, wert);
    if (!r.ok) return r.fehler;
    return (await speichern(r.felder)) ? undefined : 'Nicht gespeichert.';
  };
  const ausAlt = v.mindestlaufzeitMonate != null && l.vertrag?.mindestlaufzeitMonate == null;
  return (
    <div style={raster}>
      <ZahlFeld label="Mindestlaufzeit (Monate)" wert={v.mindestlaufzeitMonate} min={1} max={PRODUKT_GRENZEN.mindestlaufzeitMonate} onFertig={n => setze('mindestlaufzeitMonate', n)}
        hinweis={ausAlt ? 'aus der bisherigen Laufzeit' : 'leer = ohne Mindestlaufzeit'} />
      <Feld label="Danach"><div><Wahl label="Danach" liste={(Object.keys(DANACH_LABEL) as (keyof typeof DANACH_LABEL)[]).map(id => ({ id, label: DANACH_LABEL[id] }))} wert={v.danach ?? null} leer="offen" onWahl={x => void setze('danach', x)} onLeeren={() => void setze('danach', null)} /></div></Feld>
      <ZahlFeld label="Kündigungsfrist (Tage)" wert={v.kuendigungsfristTage} max={PRODUKT_GRENZEN.kuendigungsfristTage} onFertig={n => setze('kuendigungsfristTage', n)} />
      <Feld label="Rechnung"><div><Wahl label="Rechnung" liste={(Object.keys(RHYTHMUS_LABEL) as (keyof typeof RHYTHMUS_LABEL)[]).map(id => ({ id, label: RHYTHMUS_LABEL[id] }))} wert={v.rechnungsrhythmus ?? null} leer="wie das Honorar" onWahl={x => void setze('rechnungsrhythmus', x)} onLeeren={() => void setze('rechnungsrhythmus', null)} /></div></Feld>
      <ZahlFeld label="Zahlungsziel (Tage)" wert={v.zahlungszielTage} max={PRODUKT_GRENZEN.zahlungszielTage} onFertig={n => setze('zahlungszielTage', n)} />
      <Feld label="Umsatzsteuer"><Pillen<string> liste={[{ id: '19', label: '19 %' }, { id: '7', label: '7 %' }, { id: '0', label: '0 %' }]} aktiv={String(v.ustSatz ?? 19)} onWahl={x => { if (Number(x) !== (v.ustSatz ?? 19)) void setze('ustSatz', Number(x)); }} /></Feld>
      <Feld label="Reisekosten"><div><Wahl label="Reisekosten" liste={[{ id: 'separat' as const, label: 'separat abgerechnet' }, { id: 'inklusive' as const, label: 'inklusive' }]} wert={v.reisekosten ?? null} leer="nicht festgelegt" onWahl={x => void setze('reisekosten', x)} onLeeren={() => void setze('reisekosten', null)} /></div></Feld>
    </div>
  );
}

// ── Regeln ───────────────────────────────────────────────────────────────────

export function RegelnTeil({ l, alle, anrechnungAlt, speichern }: { l: Leistung; alle: readonly Leistung[]; /** Anrechnung als Text an der gespeicherten Stufe (vor der Karte) */ anrechnungAlt?: string; speichern: Speichern }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const r = l.regeln ?? {};
  const andere = alle.filter(x => x.id !== l.id && !x.geloeschtAm);
  const liste = andere.map(x => ({ id: x.id, label: x.name }));
  const bekannt = (id: string) => andere.some(x => x.id === id);
  const setze = async (teil: Record<string, unknown>): Promise<string | undefined> => {
    const a = regelnAenderung(l, teil, bekannt);
    if (!a.ok) { setFehler(a.fehler); return a.fehler; }
    setFehler(null);
    return (await speichern(a.felder)) ? undefined : 'Nicht gespeichert.';
  };
  const inkl = r.inklusive ?? [];
  const setzeInkl = (n: typeof inkl) => setze({ inklusive: n.length ? n : null });
  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      <div style={raster}>
        <Feld label="Wird angerechnet auf" hinweis={!r.anrechnung && anrechnungAlt ? `Bisher als Text an der Stufe: „${anrechnungAlt}“` : 'z. B. ein Workshop auf das spätere Mandat'}>
          <div><WahlMehrfach label="Angerechnet auf" liste={liste} wert={r.anrechnung?.auf ?? []} leer="auf kein Produkt" onWahl={ids => void setze({ anrechnung: ids.length ? { auf: ids, anteilProzent: r.anrechnung?.anteilProzent ?? 100 } : null })} /></div>
        </Feld>
        {r.anrechnung && <ZahlFeld label="Angerechnet zu (%)" wert={r.anrechnung.anteilProzent} min={1} max={100} onFertig={n => setze({ anrechnung: { ...r.anrechnung!, anteilProzent: n ?? 100 } })} />}
        <ZahlFeld label="Höchstens gleichzeitig (Plätze)" wert={r.maxGleichzeitig} min={1} max={PRODUKT_GRENZEN.maxGleichzeitig} onFertig={n => setze({ maxGleichzeitig: n })} hinweis="leer = ohne Grenze" />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Inklusive Leistungen</span>
        {inkl.map((x, i) => (
          <div key={`${x.leistungId}-${i}`} style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: 10, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', alignItems: 'end' }}>
            <Feld label="Produkt"><div><Wahl label="Inklusive Produkt" liste={liste} wert={x.leistungId} onWahl={id => void setzeInkl(inkl.map((y, j) => (j === i ? { ...y, leistungId: id } : y)))} /></div></Feld>
            <ZahlFeld label="Menge" wert={x.menge} min={1} max={PRODUKT_GRENZEN.inklusiveMenge} onFertig={n => setzeInkl(inkl.map((y, j) => (j === i ? { ...y, menge: n ?? 1 } : y)))} />
            <Feld label="je"><Pillen<typeof INKLUSIVE_JE[number]> liste={INKLUSIVE_JE.map(j => ({ id: j, label: j === 'monat' ? 'Monat' : j === 'quartal' ? 'Quartal' : 'Jahr' }))} aktiv={x.je} onWahl={je => void setzeInkl(inkl.map((y, j) => (j === i ? { ...y, je } : y)))} /></Feld>
            <span><SymbolKnopf ariaLabel="Inklusive Leistung entfernen" gefahr onClick={() => void setzeInkl(inkl.filter((_, j) => j !== i))}>×</SymbolKnopf></span>
          </div>
        ))}
        {inkl.length < PRODUKT_GRENZEN.inklusive && liste.length > 0 && (
          <div><Wahl label="Leistung inklusive" liste={liste} wert={null} leer="+ Leistung inklusive" onWahl={id => void setzeInkl([...inkl, { leistungId: id, menge: 1, je: 'quartal' }])} /></div>
        )}
        {!liste.length && <span style={ruhig}>Inklusive und Anrechnung verweisen auf andere Produkte — es gibt noch keine.</span>}
      </div>
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
    </div>
  );
}

// ── Texte (genau EINE Stelle je Text) ────────────────────────────────────────

export function TexteTeil({ l, speichern }: { l: Leistung; speichern: Speichern }) {
  const t = texteVon(l);
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={klein}>Diese Texte stehen im Angebot, im Mandat und in der Treppe — es gibt sie nur hier.</div>
      {TEXT_FELDER.filter(f => !f.nurWennDa || t[f.id]).map(f => (
        <TextFeld key={f.id} label={f.id === 'leistungstext' ? 'Leistungstext *' : f.label} wert={t[f.id]} max={f.max} zeilen={f.zeilen} platzhalter={f.platzhalter} pflicht={f.id === 'leistungstext'}
          hinweis={f.id === 'leistungstext' && !t.leistungstext ? 'Pflicht, bevor das Produkt aktiv geht.' : undefined}
          onFertig={async wert => { const a = textAenderung(l, f.id, wert); if (!a.ok) return a.fehler; return (await speichern(a.felder)) ? undefined : 'Nicht gespeichert.'; }} />
      ))}
    </div>
  );
}

// ── Lieferumfang ─────────────────────────────────────────────────────────────

/**
 * Entwürfe, die beim Schließen nicht gespeichert werden konnten (zu lang, Liste voll, Server lehnte ab) — je Produkt, nur in dieser Sitzung des Browsers.
 * Beim nächsten Öffnen stehen sie wieder im Feld (mit Satz): nichts geht still verloren (21.10., Rundgang B9).
 */
const LIEFER_ENTWURF = new Map<string, string>();

export function LieferumfangTeil({ l, speichern }: { l: Leistung; speichern: Speichern }) {
  const liste = l.lieferumfang ?? [];
  const [neu, setNeu] = useState(() => LIEFER_ENTWURF.get(l.id) ?? '');
  const [fehler, setFehler] = useState<string | null>(() => {
    const t = LIEFER_ENTWURF.get(l.id);
    if (!t) return null;
    const r = lieferumfangBeimSchliessen(liste, t);
    return r.art === 'behalten' ? r.fehler : 'Noch nicht übernommen — Enter oder „Hinzufügen“.';
  });
  // Beim Schließen (Karte „Fertig“/×, Abschnitt zugeklappt): ein getippter Punkt ohne Enter wird übernommen — dieselbe Regel wie das Anlege-Feld
  // (`lieferumfangBeimSchliessen` → `feldAbschluss`): leer speichert nichts, ein Punkt der Liste kommt nie doppelt (21.10., Rundgang B9).
  const offen = useRef({ neu, liste, speichern });
  offen.current = { neu, liste, speichern };
  useEffect(() => {
    LIEFER_ENTWURF.delete(l.id);
    return () => {
      const { neu: t, liste: jetzt, speichern: sp } = offen.current;
      const r = lieferumfangBeimSchliessen(jetzt, t);
      if (r.art === 'behalten') LIEFER_ENTWURF.set(l.id, t);
      else if (r.art === 'speichern') void sp({ lieferumfang: r.liste }).then(ok => { if (!ok) LIEFER_ENTWURF.set(l.id, t); });
    };
  }, [l.id]);
  const dazu = async () => {
    const r = lieferumfangDazu(liste, neu);
    if (!r.ok) { setFehler(r.fehler); return; }
    setFehler(null);
    setNeu('');
    offen.current.neu = ''; // schon unterwegs — ein Schließen gleich danach hängt ihn nicht noch einmal an
    if (!(await speichern({ lieferumfang: r.liste }))) setNeu(neu);
  };
  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
      {liste.map((y, i) => (
        <div key={`${i}-${y}`} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.body, color: C.ink, minWidth: 0 }}>
          <span aria-hidden style={{ color: C.inkLeise }}>·</span>
          <span style={{ flex: 1, minWidth: 0, overflowWrap: 'break-word' }}>{y}</span>
          <SymbolKnopf ariaLabel={`„${y}“ entfernen`} onClick={() => void speichern({ lieferumfang: liste.filter((_, j) => j !== i) })}>×</SymbolKnopf>
        </div>
      ))}
      {!liste.length && <span style={ruhig}>Noch nichts — was der Kunde konkret bekommt, je Punkt eine Zeile (wird je Kunde abgehakt).</span>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        <input value={neu} maxLength={LIEFER_MAX.zeichen + 40} onChange={e => { setNeu(e.target.value); if (fehler) setFehler(null); }} placeholder="+ Punkt (Enter)" aria-label="Neuer Punkt im Lieferumfang"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void dazu(); } }} style={{ ...feld, flex: '1 1 200px', width: 'auto' }} />
        <Knopf leise aus={!neu.trim()} onClick={dazu}>Hinzufügen</Knopf>
      </div>
      <span style={ruhig}>{fehler ? <span role="alert" style={{ color: LEUCHT.achtung }}>{fehler}</span> : neu.trim() ? 'Enter oder „Hinzufügen“ — sonst beim Schließen übernommen.' : `je Punkt höchstens ${LIEFER_MAX.zeichen} Zeichen, höchstens ${LIEFER_MAX.anzahl} Punkte`}</span>
    </div>
  );
}

// ── Aufwand & Kapazität ──────────────────────────────────────────────────────

export function AufwandTeil({ l, aufwand, stufe, speichern }: {
  l: Leistung; aufwand: { stunden: number; annahme: boolean } | null; /** Belegung der Stufe (Kunden jetzt, h/Woche zusammen) */ stufe?: { kunden: number; stundenWoche: number } | null; speichern: Speichern;
}) {
  const a = aufwandText({ aufwand }, l);
  const marge = margeVon(l);
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={{ fontSize: TYP.body, color: C.ink }}>{a.wert} je Kunde{stufe && stufe.kunden ? <span style={{ color: C.inkDim }}> · zusammen {stufe.stundenWoche.toLocaleString('de-DE')} h/Woche bei {stufe.kunden} {stufe.kunden === 1 ? 'Kunde' : 'Kunden'}</span> : null}</div>
      <div style={aufwand?.annahme ? { ...klein, color: LEUCHT.achtung } : klein}>{a.satz}</div>
      <div style={raster}>
        <ZahlFeld label="Aufwand (h je Woche und Kunde)" ganz={false} wert={l.aufwandStundenWoche} min={0.01} max={PRODUKT_GRENZEN.aufwandStundenWoche}
          onFertig={async n => ((await speichern(n === null ? { aufwandStundenWoche: null, aufwand: l.aufwand?.anteil ? { anteil: l.aufwand.anteil } : null } : { aufwandStundenWoche: n })) ? undefined : 'Nicht gespeichert.')} />
        <ZahlFeld label="Dauer (Tage)" wert={l.dauerTage} min={1} max={PRODUKT_GRENZEN.dauerTage} hinweis="bei einmaligen Produkten: verteilt den Aufwand"
          onFertig={async n => ((await speichern({ dauerTage: n })) ? undefined : 'Nicht gespeichert.')} />
        <ZahlFeld label="Kosten (% vom Preis)" wert={l.aufwand?.anteil != null ? Math.round(l.aufwand.anteil * 100) : undefined} max={100}
          hinweis={marge ? `Marge je Einheit ${euro(marge.marge)}` : 'für die Marge — optional'}
          onFertig={async n => {
            const rest = { ...(l.aufwand ?? {}) }; delete rest.anteil;
            const neu = n === null ? rest : { ...rest, anteil: n / 100 };
            return (await speichern({ aufwand: Object.keys(neu).length ? neu : null })) ? undefined : 'Nicht gespeichert.';
          }} />
      </div>
    </div>
  );
}

// ── Ziel & Planung ───────────────────────────────────────────────────────────

type InSzenarien = Record<string, { id: string; name: string; arbeitsplan: boolean; menge: number }[]>;
/** In welchen Planszenarien der Finanzplanung die Produkte stecken — null ohne Zugang oder ohne Plan. */
function useInSzenarien(): InSzenarien | null {
  const [v, setV] = useState<InSzenarien | null>(null);
  useEffect(() => {
    let weg = false;
    fetch('/api/finanzplan/vorschlaege', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((a: { ok?: boolean; inSzenarien?: InSzenarien } | null) => { if (!weg && a?.ok) setV(a.inSzenarien ?? {}); }).catch(() => { /* ohne Finanzplanung */ });
    return () => { weg = true; };
  }, []);
  return v;
}

export function ZielTeil({ l, ziel, zielJahr, speichern }: { l: Leistung; ziel?: { umsatz?: number; kunden?: number }; zielJahr?: number; speichern: Speichern }) {
  const inSzenarien = useInSzenarien();
  const fehlt = planungFehlt(l);
  const setze = async (teil: { umsatz?: number | null; kunden?: number | null }) => {
    const n: Record<string, number> = { ...(l.ziel ?? {}) } as Record<string, number>;
    for (const [k, v] of Object.entries(teil)) if (v == null || v === 0) delete n[k]; else n[k] = v;
    return (await speichern({ ziel: Object.keys(n).length ? n : null })) ? undefined : 'Nicht gespeichert.';
  };
  const ausStufe = !l.ziel && ziel;
  return (
    <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      <div style={raster}>
        <ZahlFeld label={`Umsatzziel ${zielJahr ?? ''} (€)`.replace('  ', ' ')} ganz={false} wert={l.ziel?.umsatz ?? ziel?.umsatz} max={PRODUKT_GRENZEN.zielUmsatz} onFertig={n => setze({ umsatz: n })} hinweis={ausStufe ? 'aus der Stufe der Treppe' : undefined} />
        <ZahlFeld label={`Kundenziel ${zielJahr ?? ''}`.trim()} wert={l.ziel?.kunden ?? ziel?.kunden} max={PRODUKT_GRENZEN.zielKunden} onFertig={n => setze({ kunden: n })} />
      </div>
      <div style={{ display: 'grid', gap: 4, fontSize: TYP.bedien }}>
        {fehlt.length ? <span style={{ color: LEUCHT.achtung }}>Für die Planung fehlt: {fehlt.join(', ')}</span> : <span style={{ color: LEUCHT.gut }}>planbar — Preis, Laufzeit und Gesellschaft sind da</span>}
        {inSzenarien && (inSzenarien[l.id]?.length ? <span style={{ color: C.inkDim }}>In Szenarien: {inSzenarien[l.id].map(s => `${s.arbeitsplan ? '★ ' : ''}${s.name} (${s.menge}×)`).join(' · ')}</span> : <span style={ruhig}>In keinem Szenario der Finanzplanung.</span>)}
        <Link href={WEG.finanzplanungProdukt(l.id, planungsSicht(l))} style={{ color: C.aktiv }}>In der Finanzplanung verwenden ›</Link>
      </div>
    </div>
  );
}

// ── Mandate & Deals ──────────────────────────────────────────────────────────

export function MandateTeil({ l, crm, stufen }: { l: Leistung; crm: Pick<CrmBestand, 'mandate' | 'chancen'>; stufen: readonly { id: string; label: string }[] }) {
  const router = useRouter();
  const mandate = crm.mandate.filter(m => m.leistungId === l.id && !m.geloeschtAm).sort((a, b) => (a.status === 'aktiv' ? 0 : 1) - (b.status === 'aktiv' ? 0 : 1) || a.kunde.localeCompare(b.kunde, 'de'));
  const deals = crm.chancen.filter(c => c.leistungId === l.id);
  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <div><Knopf href={WEG.mandatAusProdukt(l.id)}>Mandat aus diesem Produkt anlegen</Knopf></div>
      {mandate.length ? (
        <Liste>
          {mandate.map(m => (
            <Zeile key={m.id} onClick={() => router.push(mandateLink('mandate', m.id))} links={<Punkt farbe={m.status === 'aktiv' ? LEUCHT.gut : C.inkLeise} />} umbrechen
              titel={<>{m.kunde}{titelOhneFirma(m.kunde, m.titel) && <span style={{ color: C.inkLeise }}> · {titelOhneFirma(m.kunde, m.titel).slice(0, 60)}</span>}</>}
              unter={[m.status, m.honorar.betrag ? `${euro(m.honorar.betrag)}${m.honorar.basis === 'monat' ? '/Monat' : ''}` : ''].filter(Boolean).join(' · ')} />
          ))}
        </Liste>
      ) : <Leer>Noch kein Mandat auf diesem Produkt.</Leer>}
      {deals.length > 0 && (
        <Liste>
          {deals.map(c => (
            <Zeile key={c.id} onClick={() => router.push(WEG.deal(c.id))} links={<Punkt farbe={c.stufe === 'gewonnen' ? LEUCHT.gut : c.stufe === 'verloren' ? C.inkLeise : LEUCHT.business} />} umbrechen
              titel={c.titel} unter={`Deal · ${stufen.find(s => s.id === c.stufe)?.label ?? c.stufe}${c.wert.betrag ? ` · ${euro(c.wert.betrag)}` : ''}`} />
          ))}
        </Liste>
      )}
    </div>
  );
}

// ── Name, Linie & Unterlagen ─────────────────────────────────────────────────

const ART: { id: UnterlageArt; label: string }[] = [{ id: 'angebot', label: 'Angebot' }, { id: 'vertrag', label: 'Vertrag' }, { id: 'deck', label: 'Deck' }, { id: 'onepager', label: 'Onepager' }, { id: 'sonstiges', label: 'Sonstiges' }];
const linkOk = (u: string) => /^https:\/\/\S+$/i.test(u) || /^\/os\/wissen\?n=\S+$/.test(u);

export function MehrTeil({ l, linien, speichern }: { l: Leistung; linien: readonly string[]; speichern: Speichern }) {
  const [neuU, setNeuU] = useState<{ titel: string; art: UnterlageArt; url: string }>({ titel: '', art: 'angebot', url: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const unterlagen = l.unterlagen ?? [];
  const dazu = async () => {
    const url = neuU.url.trim();
    if (!neuU.titel.trim()) return;
    if (url && !linkOk(url)) { setFehler('Nur https-Links oder Brain-Notizen (/os/wissen?n=…).'); return; }
    setFehler(null);
    const u: Unterlage = { id: neueId('u'), titel: neuU.titel.trim().slice(0, 120), art: neuU.art, ...(url ? { url } : {}) };
    if (await speichern({ unterlagen: [...unterlagen, u] })) setNeuU({ titel: '', art: neuU.art, url: '' });
  };
  return (
    <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
      <div style={raster}>
        <TextFeld label="Name" wert={l.name} max={160} onFertig={async t => (t.trim() ? ((await speichern({ name: t.trim() })) ? undefined : 'Nicht gespeichert.') : 'Der Name darf nicht leer sein.')} />
        <TextFeld label="Produktlinie (Filter)" wert={l.linie ?? ''} max={80} platzhalter={linien[0] ?? 'z. B. Beratung & Begleitung'} hinweis="leer = aus der Art abgeleitet"
          onFertig={async t => ((await speichern({ linie: t.trim() || null })) ? undefined : 'Nicht gespeichert.')} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Unterlagen</span>
        {unterlagen.map(u => (
          <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, flexWrap: 'wrap', minWidth: 0 }}>
            <Chip farbe={C.inkDim}>{ART.find(a => a.id === u.art)?.label}</Chip>
            {u.url ? <a href={u.url} target={u.url.startsWith('https://') ? '_blank' : undefined} rel="noopener noreferrer" style={{ color: C.ink, overflowWrap: 'anywhere' }}>{u.titel}{u.url.startsWith('https://') ? ' ↗' : ''}</a> : <span style={{ color: C.inkDim }}>{u.titel} (ohne Link)</span>}
            <span style={{ flex: 1 }} />
            <SymbolKnopf ariaLabel={`Unterlage „${u.titel}“ entfernen`} onClick={() => void speichern({ unterlagen: unterlagen.filter(x => x.id !== u.id) })}>×</SymbolKnopf>
          </div>
        ))}
        <Pillen liste={ART} aktiv={neuU.art} onWahl={art => setNeuU({ ...neuU, art })} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <input value={neuU.titel} onChange={e => setNeuU({ ...neuU, titel: e.target.value })} placeholder="Titel" aria-label="Titel der Unterlage" style={{ ...feld, flex: '1 1 160px', width: 'auto' }} />
          <input value={neuU.url} onChange={e => setNeuU({ ...neuU, url: e.target.value })} placeholder="https://… oder /os/wissen?n=…" aria-label="Link zur Unterlage" onKeyDown={e => { if (e.key === 'Enter') void dazu(); }} style={{ ...feld, flex: '2 1 200px', width: 'auto' }} />
          <Knopf leise aus={!neuU.titel.trim()} onClick={dazu}>Hinzufügen</Knopf>
        </div>
        {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      </div>
      {l.quelle && <div style={ruhig}>Quelle: {l.quelle}</div>}
    </div>
  );
}
