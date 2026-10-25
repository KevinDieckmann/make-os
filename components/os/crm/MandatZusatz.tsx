'use client';

// ─── Mandat: Vertrag, Leistungen, Zusatzmodule (Produkte & Mandate › Mandat; 19.10., Paket P3) ─────────────────────────────────────────
// Kevin 19.10.: „Mandat = Hauptprodukt + Zusatzmodule“ — und was am Mandat bisher nur gespeichert war, ist hier pflegbar (PRODUKTE_KONZEPT.md):
//   · Vertrag      Mindestlaufzeit, Rhythmus, Zahlungsziel — daneben, was das Produkt vorsieht, und „Vom Produkt übernehmen“
//   · Leistungen   die Liste des Mandats (steht auf der Monatsrechnung)
//   · Zusatzmodule „+ Zusatzmodul“ aus Produkten mit Rolle „Zusatz“/„beides“ (Honorar vom Produkt, änderbar; ab/bis; inklusive), Vorschläge aus den
//                  Inklusive-Regeln des Hauptprodukts, „abrechnen“ mit Menge (je Einheit · Tag · Stunde) → Rechnungs-Entwurf. Ein Modul mit eigenem Ablauf
//                  hängt sich an den laufenden Fall (derselbe Weg wie „Zusatzmodul anhängen“ im Fulfillment).
// Geschrieben wird nur über den Bestand-Schreibweg mit Stand (`api.teil`, Prüfung im Server: lib/crm/produkt-karte.ts `mandatZusatzPruefen`);
// Regeln für Rechnung und Liquidität in lib/crm/mandat-zusatz.ts.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, LEUCHT, feld } from '../ui';
import { Fenster } from '../Fenster';
import { Feldzeile, Feld } from './teile';
import { Wahl } from './Wahl';
import { WEG } from '@/lib/wege';
import { localDay, tagePlus } from '@/lib/zeit';
import { eigeneTeileOffen, mandatVertragAusProdukt, mandatZahlplanAusProdukt, preiseText, preisText, teilLabel, vertragVon, zusatzAusTeil, zusatzExtras, zusatzHonorar } from '@/lib/crm/produkt-karte';
import { zusatzArt, zusatzBeschreibung, zusatzDeckel, zusatzEinheit, zusatzName, zusatzZeitraum, zusatzOptionen, teilEinheit, vertragsHinweise, JE_TEXT } from '@/lib/crm/mandat-zusatz';
import { centAusEingabe, eingabeAusCent } from '@/lib/crm/angebote';
import { leistungsmonat, monatsName } from '@/lib/crm/mandat-laufzeit';
import { entwurfAnlegen } from '../rechnung/daten';
import { useUebersichtKurz, fallAktion, neueAnfrageId, fehlerText } from '../fulfillment/prozesse/daten';
import type { Leistung, Mandat, MandatZusatz, MandatZusatzBasis, PreisTeil } from '@/lib/crm/typen';

const klein = { fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 } as const;
const RHYTHMUS = [{ id: 'monatlich' as const, label: 'monatlich' }, { id: 'quartal' as const, label: 'je Quartal' }, { id: 'einmalig' as const, label: 'einmalig' }];
const BASIS: { id: MandatZusatzBasis; label: string }[] = [
  { id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }, { id: 'einheit', label: 'je Einheit' }, { id: 'tag', label: 'je Tag' }, { id: 'stunde', label: 'je Stunde' },
];
const JA_NEIN = [{ id: 'nein' as const, label: 'berechnet' }, { id: 'ja' as const, label: 'inklusive' }];
const JE = [{ id: 'monat' as const, label: 'je Monat' }, { id: 'quartal' as const, label: 'je Quartal' }, { id: 'jahr' as const, label: 'je Jahr' }];
const DANACH: Record<string, string> = { monatlich_kuendbar: 'danach monatlich kündbar', verlaengert_um_laufzeit: 'verlängert sich um die Laufzeit', endet: 'endet danach' };
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const neueZusatzId = () => `mz-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14)}`;

type Setze = (teil: Partial<Mandat>) => Promise<unknown> | unknown;

/** Vertrag am Mandat — mit dem, was das Produkt vorsieht, und „Vom Produkt übernehmen“ (nur die Vertragsfelder; das Honorar ist verhandelt). */
export function MandatVertrag({ m, produkt, setze }: { m: Mandat; produkt?: Leistung; setze: Setze }) {
  const soll = produkt ? mandatVertragAusProdukt(produkt, m.honorar.basis) : {};
  const v = produkt ? vertragVon(produkt) : null;
  // Zahlplan des einmaligen Honorars (21.10., B2): vom Festpreis des Produkts (z. B. 50/50), am Mandat änderbar.
  const zpSoll = produkt ? mandatZahlplanAusProdukt(produkt, m.honorar.basis) : undefined;
  const zpAbweichend = !!zpSoll && zpSoll.anzahlungProzent !== m.zahlplan?.anzahlungProzent;
  const abweichend = (Object.keys(soll) as (keyof typeof soll)[]).filter(k => soll[k] !== undefined && soll[k] !== m[k]);
  const produktText = v ? [
    v.mindestlaufzeitMonate ? `${v.mindestlaufzeitMonate} Monate Mindestlaufzeit` : '', v.danach ? DANACH[v.danach] : '', v.kuendigungsfristTage != null ? `${v.kuendigungsfristTage} Tage Kündigungsfrist` : '',
    v.rechnungsrhythmus ? `Rechnung ${RHYTHMUS.find(r => r.id === v.rechnungsrhythmus)?.label}` : '', v.zahlungszielTage != null ? `Zahlungsziel ${v.zahlungszielTage} Tage` : '',
    v.ustSatz != null ? `${v.ustSatz} % USt` : '', v.reisekosten === 'separat' ? 'Reisekosten separat' : v.reisekosten === 'inklusive' ? 'Reisekosten inklusive' : '',
  ].filter(Boolean) : [];
  return (
    <Feldzeile label="Vertrag">
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Feld typ="number" wert={m.mindestlaufzeitMonate ? String(m.mindestlaufzeitMonate) : ''} breite={150} platzhalter="Mindestlaufzeit Monate" onFertig={x => setze({ mindestlaufzeitMonate: Number(x) > 0 ? Math.min(120, Math.round(Number(x))) : undefined })} />
          <Wahl label="Rechnungsrhythmus" liste={RHYTHMUS} wert={m.rechnungsrhythmus} onWahl={rechnungsrhythmus => setze({ rechnungsrhythmus })} />
          <Feld typ="number" wert={String(m.zahlungszielTage ?? 14)} breite={150} platzhalter="Zahlungsziel Tage" onFertig={x => { const n = Math.round(Number(x)); if (Number.isFinite(n) && n >= 0 && n <= 120) void setze({ zahlungszielTage: n }); }} />
          {m.honorar.basis === 'einmalig' && <Feld typ="number" wert={m.zahlplan ? String(m.zahlplan.anzahlungProzent) : ''} breite={150} platzhalter="Anzahlung %" onFertig={x => { const n = Math.round(Number(x)); void setze({ zahlplan: n >= 1 && n <= 99 ? { anzahlungProzent: n } : undefined }); }} />}
          {/* Tagessatz (21.10., B4): geplante Tage je Monat — die Liquidität plant Satz × Tage, die Rechnung nimmt die echten Tage. */}
          {m.honorar.basis === 'tag' && <Feld typ="number" wert={m.tageJeMonat ? String(m.tageJeMonat) : ''} breite={160} platzhalter="Tage/Monat geplant" onFertig={x => { const n = Math.round(Number(x.replace(',', '.')) * 100) / 100; void setze({ tageJeMonat: n >= 0.25 && n <= 744 ? n : undefined }); }} />}
        </div>
        <span style={klein}>{m.mindestlaufzeitMonate ? `${m.mindestlaufzeitMonate} Monate Mindestlaufzeit` : 'ohne Mindestlaufzeit'} · Rechnung {RHYTHMUS.find(r => r.id === m.rechnungsrhythmus)?.label} · Zahlungsziel {m.zahlungszielTage ?? 14} Tage{m.honorar.basis === 'einmalig' && m.zahlplan ? ` · Zahlung ${m.zahlplan.anzahlungProzent} % bei Beginn, Rest bei Abschluss` : ''}{m.honorar.basis === 'tag' ? (m.tageJeMonat ? ` · ${m.tageJeMonat.toLocaleString('de-DE')} Tage/Monat geplant` : ' · geplante Tage je Monat offen (ohne sie plant die Liquidität nichts)') : ''}</span>
        {/* 24.10. (Bau-Test): kostet das Produkt inzwischen anderes, sagt es ein Satz — das Mandat behält seine Bedingungen (Vertrag). */}
        {produkt && vertragsHinweise(m, produkt).map(h => <span key={h} style={{ ...klein, color: C.inkDim }}>{h}</span>)}
        {produkt && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={klein}>Vom Produkt „{produkt.name}“: {preiseText(produkt)}{produktText.length ? ` · ${produktText.join(' · ')}` : ''}</span>
            {(abweichend.length > 0 || zpAbweichend) && <Knopf leise onClick={async () => { await setze({ ...soll, ...(zpSoll ? { zahlplan: zpSoll } : {}), ...(!m.leistungen.length && produkt.lieferumfang?.length ? { leistungen: produkt.lieferumfang } : {}) }); }}>Vom Produkt übernehmen</Knopf>}
          </div>
        )}
      </div>
    </Feldzeile>
  );
}

/** Leistungen des Mandats (stehen auf der Monatsrechnung): entfernen, neue dazu. */
export function MandatLeistungen({ m, setze }: { m: Mandat; setze: Setze }) {
  return (
    <Feldzeile label="Leistungen">
      <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
        {m.leistungen.map((x, i) => (
          <div key={`${i}-${x}`} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>• {x}</span>
            <button onClick={() => setze({ leistungen: m.leistungen.filter((_, j) => j !== i) })} aria-label={`Leistung „${x.slice(0, 30)}“ entfernen`} title="Entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>
          </div>
        ))}
        <Feld platzhalter="Neue Leistung …" onFertig={t => t.trim() && setze({ leistungen: [...m.leistungen, t.trim().slice(0, 400)] })} />
      </div>
    </Feldzeile>
  );
}

/** Zusatzmodule am Mandat — Liste, „+ Zusatzmodul“, Vorschläge (inklusive), abrechnen, Ablauf am Fall. */
export function MandatZusatzModule({ m, katalog, setze }: { m: Mandat; katalog: readonly Leistung[]; setze: Setze }) {
  const heute = localDay();
  const liste = useMemo(() => m.zusatz ?? [], [m.zusatz]);
  const haupt = m.leistungId ? katalog.find(l => l.id === m.leistungId) : undefined;
  const kurz = useUebersichtKurz();
  const [meldung, setMeldung] = useState<string | null>(null);
  // „abrechnen“: das Modul selbst (je Einheit · Tag · Stunde) oder ein optionaler Teil seines Produkts (21.10., B7 — z. B. „je Messe“).
  const [abrechnen, setAbrechnen] = useState<{ z: MandatZusatz; teil?: PreisTeil } | null>(null);
  const waehlbar = katalog.filter(l => !l.geloeschtAm && l.status !== 'eingestellt' && l.id !== m.leistungId && (l.rolle === 'zusatz' || l.rolle === 'beides'));
  // 24.10. (Bau-Test): die noch nicht übernommenen eigenen Preis-Teile des Hauptprodukts (Festpreis, Tagessatz, Optionen …) — der Hauptpreis ist das Honorar.
  const eigeneOffen = haupt ? eigeneTeileOffen(haupt, liste.filter(z => z.leistungId === haupt.id).map(z => z.preisTeilId)) : [];
  const vorschlaege = (haupt?.regeln?.inklusive ?? []).filter(x => !liste.some(z => z.leistungId === x.leistungId && z.inklusive) && katalog.some(l => l.id === x.leistungId && !l.geloeschtAm));
  const schreiben = (neu: MandatZusatz[]) => setze({ zusatz: neu });
  const aendern = (id: string, teil: Partial<MandatZusatz>) => schreiben(liste.map(z => (z.id === id ? stripLeer({ ...z, ...teil }) : z)));
  // Beginn eines neuen Moduls: läuft das Mandat schon, ab heute (sonst rechnete es rückwirkend ab Beginn); sonst mit dem Mandat.
  const startVorgabe = m.start && m.start < heute ? heute : undefined;

  /** Ablauf des Moduls im Fulfillment: Paket mit „Zusatzmodul“, das dem Produkt zugeordnet ist. */
  const ablaufVon = (leistungId: string) => {
    const vid = kurz.daten?.zuordnung[leistungId]?.vorlageId;
    const p = vid ? kurz.daten?.prozesse.find(x => x.id === vid && x.art === 'paket' && x.zusatz) : undefined;
    const fall = kurz.daten?.faelle[m.id] as { vorlageId?: string; zusaetze?: string[] } | undefined;
    return p ? { id: p.id, titel: p.titel, fall: !!fall, dran: !!fall && (fall.vorlageId === p.id || !!fall.zusaetze?.includes(p.id)) } : null;
  };
  const anhaengen = async (leistungId: string, start?: string) => {
    const a = ablaufVon(leistungId);
    if (!a || !a.fall || a.dran) return;
    const r = await fallAktion({ aktion: 'starten', mandatId: m.id, vorlageId: a.id, start: start && start > heute ? start : heute, anfrageId: neueAnfrageId() });
    setMeldung(r.ok ? `Ablauf „${a.titel}“ hängt jetzt am Fall.` : `Ablauf nicht angehängt: ${fehlerText(r)}`);
    void kurz.laden();
  };

  const hinzu = async (l: Leistung, inklusiv?: { menge: number; je: NonNullable<MandatZusatz['je']> }) => {
    const ab = startVorgabe;
    const h = zusatzHonorar(l);
    const z: MandatZusatz = {
      id: neueZusatzId(), leistungId: l.id, ...(ab ? { ab } : {}),
      ...(inklusiv ? { inklusive: true, menge: inklusiv.menge, je: inklusiv.je } : h ? { honorar: h, ...zusatzExtras(l) } : {}),
      // Einmalig mit Dauer am Produkt: „bis“ = Ende der Leistung (dann kommt der Rest des Zahlplans in diesem Monat).
      ...(!inklusiv && h?.basis === 'einmalig' && l.dauerTage ? { bis: tagePlus(ab ?? m.start ?? heute, l.dauerTage - 1) } : {}),
    };
    await schreiben([...liste, z]);
    await anhaengen(l.id, z.ab);
  };

  /** Ein eigener Preis-Teil des Hauptprodukts als Modul (`zusatzAusTeil`) — Beginn wie bei jedem neuen Modul. */
  const hinzuTeil = async (t: PreisTeil) => {
    if (!haupt) return;
    const z = zusatzAusTeil(haupt, t, { ...(startVorgabe ? { ab: startVorgabe } : {}) });
    if (z) await schreiben([...liste, z]);
  };
  const ausWahl = (id: string) => {
    if (id.startsWith('teil:')) { const t = eigeneOffen.find(x => x.id === id.slice(5)); if (t) void hinzuTeil(t); return; }
    const l = waehlbar.find(x => x.id === id); if (l) void hinzu(l);
  };
  const wahlListe = [
    ...eigeneOffen.map(t => ({ id: `teil:${t.id}`, label: `${haupt!.name} · ${teilLabel(t)} · ${preisText(t)}`.slice(0, 80) })),
    ...waehlbar.map(l => ({ id: l.id, label: `${l.name} · ${preiseText(l)}`.slice(0, 80) })),
  ];

  return (
    <Feldzeile label="Zusatzmodule">
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        {!liste.length && <span style={klein}>Keine — das Mandat besteht nur aus dem Hauptprodukt.</span>}
        {liste.map(z => {
          const art = zusatzArt(z);
          const ablauf = ablaufVon(z.leistungId);
          return (
            <div key={z.id} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,.03)', minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{zusatzName(z, katalog)}</span>
                <span style={{ ...klein, flex: 1, minWidth: 0 }}>{zusatzBeschreibung(z, katalog)}</span>
                {art === 'abrechnen' && <Knopf leise onClick={() => setAbrechnen({ z })}>abrechnen</Knopf>}
                <button onClick={() => schreiben(liste.filter(x => x.id !== z.id))} aria-label={`Zusatzmodul „${zusatzName(z, katalog)}“ entfernen`} title="Entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', minWidth: 44, minHeight: 44 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Feld typ="date" wert={z.ab} breite={150} platzhalter="ab" onFertig={ab => aendern(z.id, { ab: ab || undefined })} />
                <span style={klein}>bis</span>
                <Feld typ="date" wert={z.bis} breite={150} platzhalter="bis" onFertig={bis => aendern(z.id, { bis: bis || undefined })} />
                <Wahl label="Berechnet oder inklusive" liste={JA_NEIN} wert={z.inklusive ? 'ja' : 'nein'} onWahl={x => {
                  const l = katalog.find(k => k.id === z.leistungId);
                  // Eigener Preis-Teil (24.10.): Honorar und Extras aus genau diesem Teil, nicht aus dem Hauptpreis.
                  const ausTeil = l && z.preisTeilId ? l.preise?.find(t => t.id === z.preisTeilId) : undefined;
                  const neuZ = ausTeil && l ? zusatzAusTeil(l, ausTeil) : null;
                  void aendern(z.id, x === 'ja' ? { inklusive: true, honorar: undefined, zahlplan: undefined, stundenJeMonat: undefined, tageJeMonat: undefined } : { inklusive: undefined, menge: undefined, je: undefined, ...(z.honorar ? {} : neuZ ? { honorar: neuZ.honorar, ...(neuZ.zahlplan ? { zahlplan: neuZ.zahlplan } : {}), ...(neuZ.tageJeMonat ? { tageJeMonat: neuZ.tageJeMonat } : {}), ...(neuZ.stundenJeMonat ? { stundenJeMonat: neuZ.stundenJeMonat } : {}) } : l && zusatzHonorar(l) ? { honorar: zusatzHonorar(l), ...zusatzExtras(l) } : {}) });
                }} />
              </div>
              {!z.inklusive && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Feld wert={z.honorar ? eingabeAusCent(z.honorar.betragCent) : ''} breite={130} platzhalter="Honorar €" onFertig={t => { const c = centAusEingabe(t); if (c !== null) void aendern(z.id, { honorar: { betragCent: c, basis: z.honorar?.basis ?? 'monat' } }); else if (!t.trim()) void aendern(z.id, { honorar: undefined }); }} />
                  <Wahl label="Wie oft" liste={BASIS} wert={z.honorar?.basis ?? null} onWahl={basis => aendern(z.id, { honorar: { betragCent: z.honorar?.betragCent ?? 0, basis }, ...(basis !== 'einmalig' ? { zahlplan: undefined } : {}), ...(basis !== 'stunde' ? { stundenJeMonat: undefined } : {}), ...(basis !== 'tag' ? { tageJeMonat: undefined } : {}) })} />
                  {z.honorar?.basis === 'einmalig' && <Feld typ="number" wert={z.zahlplan ? String(z.zahlplan.anzahlungProzent) : ''} breite={150} platzhalter="Anzahlung %" onFertig={t => { const n = Math.round(Number(t)); void aendern(z.id, { zahlplan: n >= 1 && n <= 99 ? { anzahlungProzent: n } : undefined }); }} />}
                  {z.honorar?.basis === 'tag' && <Feld typ="number" wert={z.tageJeMonat ? String(z.tageJeMonat) : ''} breite={160} platzhalter="Tage/Monat geplant" onFertig={t => { const n = Math.round(Number(t.replace(',', '.')) * 100) / 100; void aendern(z.id, { tageJeMonat: n >= 0.25 && n <= 744 ? n : undefined }); }} />}
                  {z.honorar?.basis === 'stunde' && <Feld typ="number" wert={z.stundenJeMonat ? String(z.stundenJeMonat) : ''} breite={160} platzhalter={`Std./Monat geplant${zusatzDeckel(z, katalog) ? ` (≤ ${zusatzDeckel(z, katalog)})` : ''}`} onFertig={t => { const n = Number(t); const d = zusatzDeckel(z, katalog); void aendern(z.id, { stundenJeMonat: n > 0 ? Math.min(n, d ?? n) : undefined }); }} />}
                </div>
              )}
              {z.inklusive && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Feld typ="number" wert={z.menge ? String(z.menge) : ''} breite={110} platzhalter="Menge" onFertig={t => { const n = Math.round(Number(t)); void aendern(z.id, n >= 1 ? { menge: n, je: z.je ?? 'quartal' } : { menge: undefined, je: undefined }); }} />
                  <Wahl label="je Zeitraum" liste={JE} wert={z.je ?? null} onWahl={je => aendern(z.id, { je, menge: z.menge ?? 1 })} />
                  <span style={klein}>steht als 0-€-Position auf der Monatsrechnung. Mehr als inklusive: dasselbe Modul noch einmal mit Preis je Einheit dazunehmen und abrechnen.</span>
                </div>
              )}
              {zusatzOptionen(z, katalog).map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={klein}>optional: {eingabeAusCent(t.betragCent!)} € netto je {teilEinheit(t)}{t.text ? ` · ${t.text}` : ''}</span>
                  <Knopf leise onClick={() => setAbrechnen({ z, teil: t })}>je {teilEinheit(t)} abrechnen</Knopf>
                </div>
              ))}
              {ablauf && (ablauf.dran
                ? <Link href={WEG.fall(m.id)} style={{ ...klein, textDecoration: 'none' }}>Ablauf „{ablauf.titel}“ hängt am Fall ›</Link>
                : ablauf.fall ? <span><Knopf leise onClick={() => anhaengen(z.leistungId, z.ab)}>Ablauf „{ablauf.titel}“ an den Fall hängen</Knopf></span>
                  : <span style={klein}>Ablauf „{ablauf.titel}“ — hängt sich an, sobald der Fall läuft (Fulfillment › Zusatzmodul anhängen).</span>)}
            </div>
          );
        })}
        {vorschlaege.map(x => {
          const l = katalog.find(k => k.id === x.leistungId)!;
          return (
            <div key={x.leistungId} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={klein}>Vorschlag aus „{haupt?.name}“: {l.name} inklusive ({x.menge} je {JE_TEXT[x.je]})</span>
              <Knopf leise onClick={() => hinzu(l, { menge: x.menge, je: x.je })}>übernehmen</Knopf>
            </div>
          );
        })}
        {wahlListe.length > 0
          ? <Wahl label="Zusatzmodul" liste={wahlListe} wert={null} leer="+ Zusatzmodul" onWahl={ausWahl} />
          : <span style={klein}>Für „+ Zusatzmodul“ ein Produkt mit der Rolle „Zusatz“ oder „beides“ anlegen (Produkte).</span>}
        {meldung && <span style={{ fontSize: TYP.bedien, color: meldung.startsWith('Ablauf nicht') ? LEUCHT.achtung : LEUCHT.gut }}>{meldung}</span>}
        {abrechnen && <AbrechnenDialog m={m} z={abrechnen.z} teil={abrechnen.teil} katalog={katalog} onZu={() => setAbrechnen(null)} />}
      </div>
    </Feldzeile>
  );
}

/** Leere Werte (undefined) aus einem Modul entfernen — sonst schickte JSON sie nicht und der Server behielte die alten. */
function stripLeer(z: MandatZusatz): MandatZusatz {
  return Object.fromEntries(Object.entries(z).filter(([, v]) => v !== undefined)) as unknown as MandatZusatz;
}

/**
 * „abrechnen“ (je Einheit · Tag · Stunde): Monat und Menge — legt den Rechnungs-Entwurf an (offener Entwurf des Monats bekommt die Position dazu,
 * eine gestellte Monatsrechnung bleibt: dann eine eigene) und öffnet ihn. Gestellt wird nur im Editor.
 */
function AbrechnenDialog({ m, z, teil, katalog, onZu }: { m: Mandat; z: MandatZusatz; teil?: PreisTeil; katalog: readonly Leistung[]; onZu: () => void }) {
  const router = useRouter();
  const heute = localDay();
  const zr = zusatzZeitraum(m, z, m.ende);
  // Vormonat, dieser und nächster Monat — nur die, in denen das Modul läuft.
  const monate = [-1, 0, 1].map(n => tagePlus(`${heute.slice(0, 7)}-15`, n * 30).slice(0, 7)).filter((mo, i, l) => l.indexOf(mo) === i && (leistungsmonat(zr, mo)?.tage ?? 0) > 0);
  const [monat, setMonat] = useState<string | null>(monate.includes(heute.slice(0, 7)) ? heute.slice(0, 7) : monate[0] ?? null);
  // Vorschlag = die geplante Menge des Moduls (24.10.: z. B. 2 Tage/Monat) — vor dem Stellen im Rechnungs-Editor änderbar.
  const [menge, setMenge] = useState(() => String(!teil && z.honorar?.basis === 'tag' && z.tageJeMonat ? z.tageJeMonat : !teil && z.honorar?.basis === 'stunde' && z.stundenJeMonat ? z.stundenJeMonat : 1).replace('.', ','));
  const [fehler, setFehler] = useState<string | null>(null);
  const einheit = teil ? teilEinheit(teil) : zusatzEinheit(z, katalog);
  const deckel = teil ? (teil.art === 'stundensatz' ? teil.deckel?.stundenJeMonat ?? null : null) : zusatzDeckel(z, katalog);
  const n = Number(menge.replace(',', '.'));
  const los = async () => {
    if (!monat || !(n > 0)) { setFehler('Bitte Monat und eine Menge größer 0.'); return; }
    const e = await entwurfAnlegen({ quelle: 'mandat', mandatId: m.id, monat, einheiten: [{ zusatzId: z.id, menge: n, ...(teil ? { teilId: teil.id } : {}) }] });
    if (!e.id) { setFehler(e.fehler ?? 'Nicht angelegt.'); return; }
    // Schließen führt zurück ins Mandat (21.10., Rundgang B8).
    router.push(WEG.rechnungSchreiben(e.id, WEG.mandat(m.id)));
  };
  return (
    <Fenster titel={`„${zusatzName(z, katalog)}“${teil ? ` · je ${einheit}` : ''} abrechnen`} onZu={onZu} breit={480}>
      <form onSubmit={ev => { ev.preventDefault(); void los(); }} style={{ display: 'grid', gap: 12 }}>
        <span style={klein}>{teil ? `optional: ${eingabeAusCent(teil.betragCent ?? 0)} € netto je ${einheit}` : zusatzBeschreibung(z, katalog)}</span>
        {!monate.length && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Das Modul läuft weder im Vormonat noch in diesem oder im nächsten Monat — ab/bis am Modul prüfen.</span>}
        {monate.length > 0 && <Wahl label="Monat" liste={monate.map(mo => ({ id: mo, label: monatsName(mo) }))} wert={monat} onWahl={setMonat} />}
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ ...klein, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: TYP.mikro }}>Menge ({einheit === 'Stunde' ? 'Stunden' : einheit === 'Tag' ? 'Tage' : einheit})</span>
          <input value={menge} inputMode="decimal" onChange={ev => setMenge(ev.target.value)} style={{ ...feld, fontSize: 16, maxWidth: 160 }} aria-label="Menge" />
        </label>
        {deckel !== null && n > deckel && <span style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Vereinbart sind höchstens {deckel} Stunden je Monat — berechnet werden {deckel}.</span>}
        {fehler && <span style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{fehler}</span>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          <Knopf haupt typ="submit" aus={!monat}>Rechnung schreiben</Knopf>
        </div>
        {zr.start && <span style={klein}>Läuft ab {tagDe(zr.start)}{zr.ende ? ` bis ${tagDe(zr.ende)}` : ''}.</span>}
      </form>
    </Fenster>
  );
}
