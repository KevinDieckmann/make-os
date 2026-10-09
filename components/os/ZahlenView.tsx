'use client';

// ─── MAKE OS — Finanzen › Business › Überblick (unter dem Cockpit) ───────────
// Eine Heldenzahl (was auf den Konten liegt), darunter je eine Zeile: wohin es
// in zwölf Wochen läuft, was raus muss, was reinkommt. Dann Malins Grundlage,
// was als Nächstes fällig ist, der laufende Monat — und die Bereiche als Liste.
// Nichts davon ist neu; es ist das alte Finanz-Dashboard ohne Kacheln.
// 08.10. (Aufräumen Etappe 2): die Karte „Bereiche“ ist weg — Rechnungen & Zahlungen, Liquidität, Buchungen und Controlling sind Reiter.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WEG } from '@/lib/wege';
import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import { vorschau, businessFirmen, nurBusiness, type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten } from '@/lib/make-one/liquiditaet';
import { MONAT_KURZ, type Kennzahlen } from '@/lib/make-one/grundlage';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Zahl, Fortschritt, LEUCHT } from './ui';
import { BUSINESS_GESELLSCHAFTEN, finanzOrtAus, finanzOrtKurz, finanzOrtName, gehoertZuPrivat, istBusinessGesellschaft, istFinanzOrt } from '@/lib/einheiten';
import { Flaeche, Kachel } from './flaeche/Flaeche';
import { IndexStreifen, STREIFEN } from './business/IndexStreifen';
import { useGeltendeEroeffnung } from './business/Eroeffnung';
import { abEroeffnung, buchungVor } from '@/lib/business/eroeffnung';
import { mitRegister } from '@/lib/finanzen/konten/register';
import { useKontenKasse } from './konten/KontenKarte';

interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }
interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string; ort?: string }


/** Business: Konten, Fälliges, Monat, Grundlage, Belege. Unter Finanzen › Business steht es unter dem Cockpit (ohne eigenen Index-Streifen). */
export function ZahlenBusiness({ ohneStreifen = false }: { ohneStreifen?: boolean } = {}) {
  const router = useRouter();
  const heute = localDay();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [posten, setPosten] = useState<Planposten[]>([]);
  const [alleBuchungen, setBuchungen] = useState<Buchung[]>([]);
  const [grund, setGrund] = useState<{ vorhanden: boolean; stand?: string; kennzahlen?: Kennzahlen } | null>(null);

  useEffect(() => {
    fetch('/api/state/finanzplan').then(r => r.json()).then(setPlan).catch(() => {});
    fetch('/api/state/liquiplan').then(r => r.json()).then(d => setPosten(d.posten ?? [])).catch(() => {});
    // Nur Firmen-Buchungen des Business: ohne „ort“ gilt eine Buchung als privat (Regel der Buchungs-Route), die der Selbstständigkeit
    // gehören seit 05.10. zu Privat (`istBusinessGesellschaft`).
    fetch('/api/state/buchungen').then(r => r.json()).then(d => setBuchungen((d.buchungen ?? []).filter((b: Buchung) => istBusinessGesellschaft(b.ort)))).catch(() => {});
    fetch('/api/state/grundlage').then(r => r.json()).then(setGrund).catch(() => {});
  }, []);

  // 0-Punkt (05.10.): Konten, Posten und Buchungen ab der Eröffnung je Gesellschaft (lib/business/eroeffnung.ts) — ohne Eröffnung unverändert.
  const eroeffnung = useGeltendeEroeffnung();
  // Konten-Register (08.10.): die Kasse je Gesellschaft, die das Register führt, vor dem 0-Punkt (ohne Register wie bisher).
  const kasse = useKontenKasse('business');
  const ab = useMemo(() => (plan ? abEroeffnung(mitRegister({ ...plan, planposten: posten }, kasse), eroeffnung) : null), [plan, posten, eroeffnung, kasse]);
  const v = useMemo(() => (ab ? vorschau(ab.firmen, ab.rechnungen, ab.zahlungen, ab.merkposten, heute, 12, false, ab.planposten, 'real', undefined, true) : null), [ab, heute]);
  const konten = businessFirmen(ab?.firmen ?? []).reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const mussRaus = nurBusiness(ab?.zahlungen ?? []).filter(z => z.status === 'offen');
  const kommtRein = nurBusiness((ab?.rechnungen ?? []) as (Rechnung & { firmaId?: string })[]).filter(r => r.status !== 'bezahlt' && r.status !== 'storniert' && r.betrag > 0);
  const faellig = mussRaus.slice().sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999')).slice(0, 6);

  const monat = useMemo(() => {
    const buchungen = alleBuchungen.filter(b => !buchungVor(b, eroeffnung));
    const dieser = heute.slice(0, 7);
    const alle = Array.from(new Set(buchungen.map(b => b.datum.slice(0, 7)))).sort();
    const zeige = buchungen.some(b => b.datum.startsWith(dieser)) ? dieser : alle.at(-1) ?? dieser;
    const im = buchungen.filter(b => b.datum.startsWith(zeige));
    const ein = im.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const aus = Math.abs(im.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0));
    const kat = new Map<string, number>(); im.filter(b => b.betrag < 0).forEach(b => kat.set(b.kategorie, (kat.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    const top = Array.from(kat.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s).slice(0, 6);
    return { zeige, im, ein, aus, top, label: new Date(`${zeige}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  }, [alleBuchungen, eroeffnung, heute]);

  const stand12 = v?.wochen.at(-1)?.stand;
  const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '—');
  const k = grund?.kennzahlen;

  return (
    <>
      {/* Business-Index (25.09.): die Finanz-Kennzahlen, dieselbe Zahl wie im Cockpit. */}
      {!ohneStreifen && <IndexStreifen ids={STREIFEN.zahlen} titel="Business-Index · Finanzen" />}
      <Flaeche seite="zahlen">
      <Kachel id="konten" titel="Auf den Konten" breite={6}>
      <Karte i={0} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld}>Auf den Konten</Ueberschrift>
        <Link href={WEG.kontostaende()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl gross wert={plan ? eur(konten) : undefined} farbe={konten < 0 ? LEUCHT.kritisch : LEUCHT.geld} label="Kontostand · pflegen ›" /></Link>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 14 }}>
          <Link href={WEG.liquiditaet()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl wert={stand12 != null ? eur(stand12) : undefined} label={`${v?.engpass ? `in 12 Wochen · eng ab ${v.engpass.label}` : v ? `in 12 Wochen · Tief ${eur(v.tiefpunkt.stand)}` : 'in 12 Wochen'} ›`} farbe={v ? (v.engpass ? LEUCHT.kritisch : (stand12 ?? 0) < 2000 ? LEUCHT.achtung : LEUCHT.gut) : C.inkLeise} /></Link>
          <Link href={WEG.rechnungen()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl wert={plan ? eur(mussRaus.reduce((s, z) => s + z.betrag, 0)) : undefined} label={`muss raus · ${mussRaus.length} Posten ›`} farbe={mussRaus.length ? LEUCHT.achtung : C.inkLeise} /></Link>
          <Link href={WEG.rechnungen()} style={{ textDecoration: 'none', color: 'inherit' }}><Zahl wert={plan ? eur(kommtRein.reduce((s, r) => s + r.betrag, 0)) : undefined} label={`kommt rein · ${kommtRein.length} Rechnungen ›`} farbe={kommtRein.length ? LEUCHT.gut : C.inkLeise} /></Link>
        </div>
      </Karte>
      </Kachel>
      <Kachel id="faellig" titel="Als Nächstes fällig" breite={4}>
      <Karte i={2} akzent={faellig.some(z => z.faellig && z.faellig < heute) ? LEUCHT.kritisch : undefined}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href={WEG.rechnungen()} style={{ color: C.inkLeise, textDecoration: 'none' }}>alle ›</Link>}>Als Nächstes fällig</Ueberschrift>
        <Liste>
          {plan && !faellig.length && <Leer>Nichts offen.</Leer>}
          {faellig.map(z => {
            const spaet = !!z.faellig && z.faellig < heute;
            return <Zeile key={z.id} onClick={() => router.push(WEG.zahlung(z.id))} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: spaet ? LEUCHT.kritisch : C.inkDim, width: 48 }}>{datum(z.faellig)}</span>}
              titel={z.an} unter={z.titel} rechts={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: spaet ? LEUCHT.kritisch : C.ink }}>{eur(z.betrag)}</span>} />;
          })}
        </Liste>
      </Karte>
      </Kachel>
      {monat.im.length > 0 && (
        <Kachel id="monat" titel="Dieser Monat" breite={4}>
        <Karte i={3}>
          <Ueberschrift farbe={LEUCHT.puls} rechts={<Link href={WEG.buchungen()} style={{ color: C.inkLeise, textDecoration: 'none' }}>{alleBuchungen.length} Buchungen ›</Link>}>{monat.label}</Ueberschrift>
          <div style={{ display: 'flex', gap: 18, padding: '4px 0 12px', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 17, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: LEUCHT.gut }}>+{eur(monat.ein)}</span><span style={{ color: LEUCHT.achtung }}>−{eur(monat.aus)}</span>
            <span style={{ color: monat.ein - monat.aus >= 0 ? LEUCHT.gut : LEUCHT.kritisch }}>= {monat.ein - monat.aus >= 0 ? '+' : ''}{eur(monat.ein - monat.aus)}</span>
          </div>
          <div style={{ display: 'grid', gap: 9 }}>
            {monat.top.map(x => (
              <Link key={x.k} href={WEG.buchungen({ monat: monat.zeige, kat: x.k, ort: 'geschaeft' })} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,150px) 1fr 84px', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k} ›</span>
                <Fortschritt anteil={x.s / Math.max(monat.top[0]?.s ?? 1, 1)} farbe={LEUCHT.achtung} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right' }}>{eur(x.s)}</span>
              </Link>
            ))}
          </div>
        </Karte>
        </Kachel>
      )}
      {k && (
        <Kachel id="grundlage" titel="Grundlage · Kassenbuch (Altsystem)" breite={2}>
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.schlaf} rechts={<Link href={WEG.grundlage()} style={{ color: C.inkLeise, textDecoration: 'none' }}>Stand {datum(grund?.stand)} ›</Link>}>Grundlage · Kassenbuch (Altsystem)</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, padding: '4px 0' }}>
            <Zahl wert={eur(k.umsatzNetto)} label="Umsatz netto" farbe={LEUCHT.gut} />
            <Zahl wert={eur(k.kostenNetto)} label="Kosten netto" farbe={LEUCHT.achtung} />
            <Zahl wert={eur(k.ergebnisNetto)} label="Ergebnis" farbe={k.ergebnisNetto >= 0 ? LEUCHT.gut : LEUCHT.kritisch} />
            <Zahl wert={eur(k.umsatzProMonat)} label="Ø je Monat" />
          </div>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>{MONAT_KURZ(k.vonMonat)} bis {MONAT_KURZ(k.bisMonat)} {k.bisMonat.slice(0, 4)} · {k.monate} Monate seit dem ersten Beleg</div>
        </Karte>
        </Kachel>
      )}
      <Kachel id="belege" titel="Rechnungen & Belege" breite={2}><BelegeBusiness /></Kachel>
      </Flaeche>
    </>
  );
}

/**
 * Rechnungen und fehlende Belege der Gesellschaften (24.09.; seit 28.09. die eine Einheitenliste,
 * 30.09. Namen aus lib/einheiten.ts — vorher stand dort fest „UG“, und KD Ventures erschien als Selbstständigkeit).
 * Sie stehen in Malins Datenmodell bei den Haushaltsfinanzen (Spalte einheit)
 * und sind deshalb nur für Haushaltsmitglieder lesbar — andere sehen die
 * Karte nicht.
 */
function BelegeBusiness() {
  const [liste, setListe] = useState<{ id: string; art: string; bezeichnung: string; empfaenger: string | null; betrag: number | null; faellig_am: string | null; einheit: string; erledigt: boolean }[] | null>(null);
  useEffect(() => { fetch('/api/haushalt').then(r => (r.ok ? r.json() : null)).then(d => setListe(d?.ok ? (d.belege ?? []).filter((b: { einheit: string; erledigt: boolean }) => !gehoertZuPrivat(finanzOrtAus(b.einheit) ?? b.einheit) && !b.erledigt) : null)).catch(() => {}); }, []);
  if (!liste) return null;
  const heute = localDay();
  return (
    <Karte i={5}>
      <Ueberschrift farbe={LEUCHT.achtung} rechts={<Link href={WEG.steuern('ust')} style={{ color: C.inkLeise, textDecoration: 'none' }}>erledigen ›</Link>}>Rechnungen & Belege · {BUSINESS_GESELLSCHAFTEN.map(finanzOrtKurz).join(' / ')}</Ueberschrift>
      <Liste>
        {!liste.length && <Leer>Nichts offen.</Leer>}
        {liste.slice(0, 8).map(b => (
          <Zeile key={b.id} links={<span style={{ fontSize: TYP.bedien, color: C.inkLeise, width: 56 }}>{b.art === 'rechnung' ? 'Rechnung' : 'Beleg'}</span>}
            titel={b.empfaenger || b.bezeichnung} unter={`${b.bezeichnung}${b.faellig_am ? ` · fällig ${b.faellig_am.slice(8, 10)}.${b.faellig_am.slice(5, 7)}.` : ''} · ${istFinanzOrt(b.einheit) ? finanzOrtName(b.einheit) : b.einheit}`}
            rechts={b.betrag ? <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: b.faellig_am && b.faellig_am < heute ? LEUCHT.kritisch : C.ink }}>{(b.betrag / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span> : undefined} />
        ))}
      </Liste>
    </Karte>
  );
}
