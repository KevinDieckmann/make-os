'use client';

// ─── Zahlen · Gesamt: die Brücke Privat → Business ──────────────────────────
// Was muss die Selbstständigkeit mindestens bringen, damit euer Leben bezahlt
// ist? Jede Zahl mit Quelle, jede Annahme als Annahme markiert.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WEG } from '@/lib/wege';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import { bruecke, type BusinessZahlen } from '@/lib/finanzen/haushalt/gesamt';
import { datumDe } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Knopf, feld, LEUCHT } from '../schlank';
import { useHaushalt, Meldungen, Hinweis } from './gemeinsam';

function Stufe({ n, titel, wert, quelle, farbe, stark, href }: { n: string; titel: string; wert: string; quelle: string; farbe?: string; stark?: boolean; href?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 12, alignItems: 'baseline', padding: '10px 2px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
      <span style={{ color: C.inkLeise, fontSize: 13, textAlign: 'center' }}>{n}</span>
      <div><div style={{ fontSize: TYP.body, fontWeight: stark ? 700 : 500 }}>{href ? <Link href={href} style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted rgba(255,255,255,.3)' }}>{titel} ›</Link> : titel}</div><div style={{ fontSize: 12, color: C.inkLeise }}>{quelle}</div></div>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: stark ? 20 : 15, color: farbe ?? C.ink, whiteSpace: 'nowrap' }}>{wert}</span>
    </div>
  );
}

export function GesamtView() {
  const { daten: h, kein, aktion, laden, melde, meldungen, weg } = useHaushalt();
  const [business, setBusiness] = useState<(BusinessZahlen & { stand?: string }) | null | undefined>(undefined);
  const [quote, setQuote] = useState('');
  useEffect(() => {
    fetch('/api/state/grundlage').then(r => r.json()).then(d => setBusiness(d?.vorhanden && d.kennzahlen ? { ...d.kennzahlen, stand: d.stand } : null)).catch(() => setBusiness(null));
  }, []);
  useEffect(() => { if (h?.meta.steuerquote != null) setQuote(String(h.meta.steuerquote)); }, [h?.meta.steuerquote]);
  const b = useMemo(() => (h ? bruecke(h, business ?? null, h.meta.steuerquote) : null), [h, business]);

  if (kein) return <Karte i={1}><Leer>{kein}</Leer></Karte>;
  if (!h || !b || business === undefined) return <Karte i={1}><Leer>Rechne …</Leer></Karte>;
  const q = h.meta.steuerquote;
  return (
    <>
      <Karte i={1} akzent={b.deckung === null ? undefined : b.deckung >= 100 ? LEUCHT.gut : LEUCHT.kritisch}>
        <Ueberschrift farbe={LEUCHT.geld}>Was die Selbstständigkeit mindestens bringen muss</Ueberschrift>
        <Stufe n="1" href={WEG.privat('fixkosten')} titel="Privater Sockel" wert={`${eur(b.sockel, false)} / Monat`} quelle="Fixkosten + Kreditraten, 12 volle Monate · Zahlen → Privat → Fixkosten" />
        <Stufe n="−" href={WEG.privat('einnahmen')} titel="Planbares Einkommen ohne Kevins Entnahme" wert={`${eur(b.planbarOhneEntnahme, false)} / Monat`} quelle="Gehalt & andere planbare Eingänge, Schnitt der letzten 3 vollen Monate" />
        <Stufe n="=" href={WEG.grundlage()} titel="Nötige Entnahme aus der Selbstständigkeit" wert={`${eur(b.noetigeEntnahme, false)} / Monat`} quelle={`tatsächlich entnommen: ${eur(b.entnahmeIst, false)} / Monat (3 volle Monate)`} farbe={b.entnahmeIst >= b.noetigeEntnahme ? LEUCHT.gut : LEUCHT.achtung} stark />
        <Stufe n="÷" titel={`Steuerrücklage ${q === null ? '— bitte als Annahme setzen' : `${q} % (Annahme)`}`} wert={b.noetigerGewinn === null ? '–' : `${eur(b.noetigerGewinn, false)} / Monat`} quelle="nötiger Gewinn vor Steuern — pauschal, keine Steuerberechnung" />
        <Stufe n="+" href={WEG.planposten()} titel="Betriebs-Fixkosten" wert={b.betriebsFix === null ? '–' : `${eur(b.betriebsFix, false)} / Monat`} quelle={business ? `brutto, aus der Grundlage (Malins altes Cockpit, Stand ${datumDe(business.stand)})` : 'keine Grundlage geladen'} />
        <Stufe n="=" href={WEG.business({ k: 'run_rate' })} titel="Mindestumsatz" wert={b.mindestUmsatz === null ? '–' : `${eur(b.mindestUmsatz, false)} / Monat`} quelle={b.fehlt.length ? `fehlt: ${b.fehlt.join(', ')}` : 'so viel muss im Schnitt jeden Monat reinkommen'} farbe={LEUCHT.geld} stark />
        {b.umsatzIst !== null && (
          <Stufe n="↔" href={WEG.abschluss()} titel="Tatsächlicher Umsatz" wert={`${eur(b.umsatzIst, false)} / Monat`} quelle={`netto, Schnitt über ${business!.monate} Monate der Grundlage${b.deckung !== null ? ` · deckt ${b.deckung.toFixed(0)} % des Mindestumsatzes` : ''}`} farbe={b.deckung === null ? undefined : b.deckung >= 100 ? LEUCHT.gut : LEUCHT.kritisch} />
        )}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
          <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: C.inkDim }}>Steuerrücklage in % (Annahme)
            <input inputMode="decimal" value={quote} onChange={e => setQuote(e.target.value)} placeholder="z. B. 30" style={{ ...feld, width: 140 }} />
          </label>
          <Knopf leise onClick={async () => { const n = quote.trim() === '' ? null : Number(quote.replace(',', '.')); const d = await aktion({ aktion: 'steuerquote', steuerquote: n }); if (d?.ok) { melde('ok', 'Annahme gespeichert'); await laden(); } }}>Übernehmen</Knopf>
        </div>
        <Hinweis>Vereinfachung mit Absicht: Die Steuerrücklage ist ein pauschaler Anteil, kein Steuerbescheid. Die Betriebs-Fixkosten stammen aus Malins altem Cockpit (brutto) und sind nur so aktuell wie dessen letzter Export. Kein Sparziel eingerechnet — der Mindestumsatz deckt das Leben, nicht mehr.</Hinweis>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Wo die Zahlen herkommen</Ueberschrift>
        <div style={{ fontSize: TYP.body, lineHeight: 1.6, color: C.inkDim }}>
          Privat: <Link href="/os/finanzen?s=privat" style={{ color: LEUCHT.geld }}>eure Haushaltsfinanzen</Link> (nur ihr seht sie). Business: <Link href="/os/finanzen?s=business" style={{ color: LEUCHT.geld }}>Firmen, Liquidität, Grundlage</Link>. Die Entnahme erscheint auf beiden Seiten — im Business als Privatentnahme, im Haushalt als planbares Einkommen. Hier zählt sie genau einmal.
        </div>
      </Karte>
      <Meldungen liste={meldungen} weg={weg} />
    </>
  );
}
