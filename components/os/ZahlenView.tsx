'use client';

// ─── MAKE OS — Zahlen ───────────────────────────────────────────────────────
// Eine Heldenzahl (was auf den Konten liegt), darunter je eine Zeile: wohin es
// in zwölf Wochen läuft, was raus muss, was reinkommt. Dann Malins Grundlage,
// was als Nächstes fällig ist, der laufende Monat — und die Bereiche als Liste.
// Nichts davon ist neu; es ist das alte Finanz-Dashboard ohne Kacheln.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import { vorschau, type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten } from '@/lib/make-one/liquiditaet';
import { MONAT_KURZ, type Kennzahlen } from '@/lib/make-one/grundlage';
import { Seite, Ueberschrift, Liste, Zeile, Leer } from './schlank';

interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[] }
interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string }

const BEREICHE = [
  { href: '/os/finanzen/grundlage', titel: 'Grundlage', satz: 'Malins Kassenbuch — die Zahlen, auf denen alles steht' },
  { href: '/os/finanzen/liquiditaet', titel: 'Liquidität', satz: 'wie viel Geld wann da ist' },
  { href: '/os/finanzen/buchungen', titel: 'Buchungen', satz: 'was auf den Konten wirklich passiert ist' },
  { href: '/os/finanzen/planung', titel: 'Rechnungen & Zahlungen', satz: 'was reinkommt, was raus muss, in welcher Reihenfolge' },
  { href: '/os/controlling', titel: 'Controlling & Ziele', satz: 'Kurs aufs Jahresziel, Run-Rate, Runway' },
  { href: '/os/finanzen/dashboard', titel: 'Malins Dashboard', satz: 'das gewachsene Werkzeug, unverändert' },
];

const Zahl = ({ wert, label, farbe }: { wert: string; label: string; farbe?: string }) => (
  <div>
    <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(18px,2.4vw,22px)', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: farbe ?? C.ink }}>{wert}</div>
    <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2 }}>{label}</div>
  </div>
);

export function ZahlenView() {
  const heute = localDay();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [posten, setPosten] = useState<Planposten[]>([]);
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [grund, setGrund] = useState<{ vorhanden: boolean; stand?: string; kennzahlen?: Kennzahlen } | null>(null);

  useEffect(() => {
    fetch('/api/state/finanzplan').then(r => r.json()).then(setPlan).catch(() => {});
    fetch('/api/state/liquiplan').then(r => r.json()).then(d => setPosten(d.posten ?? [])).catch(() => {});
    fetch('/api/state/buchungen').then(r => r.json()).then(d => setBuchungen(d.buchungen ?? [])).catch(() => {});
    fetch('/api/state/grundlage').then(r => r.json()).then(setGrund).catch(() => {});
  }, []);

  const v = useMemo(() => (plan ? vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, 12, false, posten, 'real') : null), [plan, posten, heute]);
  const konten = (plan?.firmen ?? []).reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const mussRaus = (plan?.zahlungen ?? []).filter(z => z.status === 'offen');
  const kommtRein = (plan?.rechnungen ?? []).filter(r => r.status !== 'bezahlt' && r.betrag > 0);
  const faellig = mussRaus.slice().sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999')).slice(0, 6);

  const monat = useMemo(() => {
    const dieser = heute.slice(0, 7);
    const alle = Array.from(new Set(buchungen.map(b => b.datum.slice(0, 7)))).sort();
    const zeige = buchungen.some(b => b.datum.startsWith(dieser)) ? dieser : alle.at(-1) ?? dieser;
    const im = buchungen.filter(b => b.datum.startsWith(zeige));
    const ein = im.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
    const aus = Math.abs(im.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0));
    const kat = new Map<string, number>(); im.filter(b => b.betrag < 0).forEach(b => kat.set(b.kategorie, (kat.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    const top = Array.from(kat.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s).slice(0, 6);
    return { zeige, im, ein, aus, top, label: new Date(`${zeige}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }) };
  }, [buchungen, heute]);

  const stand12 = v?.wochen.at(-1)?.stand;
  const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '—');
  const k = grund?.kennzahlen;

  return (
    <Seite titel="Zahlen">
      <div style={{ fontSize: 12, color: C.inkDim }}>Auf den Konten{plan?.firmen.length ? ` · ${plan.firmen.length} Konten` : ''}</div>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 'clamp(34px,5vw,46px)', letterSpacing: '-.03em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: !plan ? C.inkLeise : konten < 0 ? C.kritisch : C.ink, margin: '4px 0 18px' }}>
        {plan ? eur(konten) : '—'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}>
        <Zahl wert={stand12 != null ? eur(stand12) : '—'} label={v?.engpass ? `in 12 Wochen · eng ab ${v.engpass.label}` : v ? `in 12 Wochen · Tief ${eur(v.tiefpunkt.stand)}` : 'in 12 Wochen'} farbe={v ? (v.engpass ? C.kritisch : (stand12 ?? 0) < 2000 ? C.achtung : C.gut) : C.inkLeise} />
        <Zahl wert={plan ? eur(mussRaus.reduce((s, z) => s + z.betrag, 0)) : '—'} label={`muss raus · ${mussRaus.length} Posten`} farbe={mussRaus.length ? C.achtung : C.inkLeise} />
        <Zahl wert={plan ? eur(kommtRein.reduce((s, r) => s + r.betrag, 0)) : '—'} label={`kommt rein · ${kommtRein.length} Rechnungen`} farbe={kommtRein.length ? C.gut : C.inkLeise} />
      </div>

      {k && (
        <>
          <Ueberschrift rechts={<Link href="/os/finanzen/grundlage" style={{ color: C.inkLeise, textDecoration: 'none' }}>Stand {datum(grund?.stand)} ›</Link>}>Grundlage · Malins Kassenbuch</Ueberschrift>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, padding: '12px 0 4px' }}>
            <Zahl wert={eur(k.umsatzNetto)} label="Umsatz netto" farbe={C.gut} />
            <Zahl wert={eur(k.kostenNetto)} label="Kosten netto" farbe={C.achtung} />
            <Zahl wert={eur(k.ergebnisNetto)} label="Ergebnis" farbe={k.ergebnisNetto >= 0 ? C.gut : C.kritisch} />
            <Zahl wert={eur(k.umsatzProMonat)} label="Ø je Monat" />
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise }}>{MONAT_KURZ(k.vonMonat)} bis {MONAT_KURZ(k.bisMonat)} {k.bisMonat.slice(0, 4)} · {k.monate} Monate seit dem ersten Beleg</div>
        </>
      )}

      <Ueberschrift rechts={<Link href="/os/finanzen/planung" style={{ color: C.inkLeise, textDecoration: 'none' }}>alle ›</Link>}>Als Nächstes fällig</Ueberschrift>
      <Liste>
        {plan && !faellig.length && <Leer>Nichts offen.</Leer>}
        {faellig.map(z => {
          const spaet = !!z.faellig && z.faellig < heute;
          return <Zeile key={z.id} links={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: spaet ? C.kritisch : C.inkDim, width: 48 }}>{datum(z.faellig)}</span>}
            titel={z.an} unter={z.titel} rechts={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: spaet ? C.kritisch : C.ink }}>{eur(z.betrag)}</span>} />;
        })}
      </Liste>

      {monat.im.length > 0 && (
        <>
          <Ueberschrift rechts={<Link href="/os/finanzen/buchungen" style={{ color: C.inkLeise, textDecoration: 'none' }}>{buchungen.length} Buchungen ›</Link>}>{monat.label}</Ueberschrift>
          <div style={{ display: 'flex', gap: 18, padding: '12px 0 8px', fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: C.gut }}>+{eur(monat.ein)}</span><span style={{ color: C.achtung }}>−{eur(monat.aus)}</span>
            <span style={{ color: monat.ein - monat.aus >= 0 ? C.gut : C.kritisch }}>= {monat.ein - monat.aus >= 0 ? '+' : ''}{eur(monat.ein - monat.aus)}</span>
          </div>
          {monat.top.map(x => (
            <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '5px 0' }}>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, width: 150, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k}</span>
              <div style={{ flex: 1, height: 6, background: C.flaeche, borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${Math.round((x.s / Math.max(monat.top[0]?.s ?? 1, 1)) * 100)}%`, height: '100%', background: C.achtung, borderRadius: 3 }} /></div>
              <span style={{ fontFamily: SCHRIFT.display, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, width: 84, textAlign: 'right' }}>{eur(x.s)}</span>
            </div>
          ))}
        </>
      )}

      <Ueberschrift>Bereiche</Ueberschrift>
      <Liste>
        {BEREICHE.map(b => (
          <Link key={b.href} href={b.href} style={{ textDecoration: 'none', color: 'inherit' }}>
            <Zeile titel={b.titel} unter={b.satz} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
          </Link>
        ))}
      </Liste>
    </Seite>
  );
}
