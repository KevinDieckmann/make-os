'use client';

// ─── MAKE OS — Finanz-Dashboard ─────────────────────────────────────────────
// Der Einstieg in alles Finanzielle: die Lage in Zahlen, darunter die
// Unterbereiche. Was Kevin und Malin in ihrem eigenen Dashboard gebaut haben,
// lebt hier weiter — nur direkt im System, mit denselben Daten.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, ABSTAND as A, MIKRO, ZIFFERN } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { eur } from '@/lib/make-one/finance-data';
import { vorschau, type Firma, type Rechnung, type Zahlung, type Merkposten, type Planposten } from '@/lib/make-one/liquiditaet';
import { MONAT_KURZ, type Kennzahlen } from '@/lib/make-one/grundlage';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

interface Plan { firmen: Firma[]; rechnungen: Rechnung[]; zahlungen: Zahlung[]; merkposten: Merkposten[]; produkte?: unknown[] }
interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string }

const UNTERFELDER = [
  { href: '/os/finanzen/grundlage', titel: 'Grundlage', satz: 'Malins gepflegtes Kassenbuch — die Zahlen, auf denen alles steht.' },
  { href: '/os/finanzen/liquiditaet', titel: 'Liquiditäts-Planung', satz: 'Wie viel Geld wann da ist — in vier Ebenen.' },
  { href: '/os/finanzen/buchungen', titel: 'Buchungen', satz: 'Was auf den Konten wirklich passiert ist.' },
  { href: '/os/finanzen/planung', titel: 'Rechnungen & Zahlungen', satz: 'Was reinkommt, was raus muss, in welcher Reihenfolge.' },
  { href: '/os/controlling', titel: 'Controlling & Ziele', satz: 'Kurs aufs Jahresziel, Run-Rate, Runway.' },
  { href: '/os/finanzen/dashboard', titel: 'Malins Dashboard', satz: 'Das gewachsene Werkzeug, unverändert.' },
];

export function FinanzDashboard() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [posten, setPosten] = useState<Planposten[]>([]);
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  // Malins Kassenbuch ist die Grundlage — es steht oben, bevor irgendetwas
  // geplant oder hochgerechnet wird.
  const [grund, setGrund] = useState<{ vorhanden: boolean; stand?: string; kennzahlen?: Kennzahlen } | null>(null);
  const heute = localDay();

  useEffect(() => {
    fetch('/api/state/finanzplan').then(r => r.json()).then(setPlan).catch(() => {});
    fetch('/api/state/liquiplan').then(r => r.json()).then(d => setPosten(d.posten ?? [])).catch(() => {});
    fetch('/api/state/buchungen').then(r => r.json()).then(d => setBuchungen(d.buchungen ?? [])).catch(() => {});
    fetch('/api/state/grundlage').then(r => r.json()).then(setGrund).catch(() => {});
  }, []);

  const v = useMemo(
    () => plan ? vorschau(plan.firmen, plan.rechnungen, plan.zahlungen, plan.merkposten, heute, 12, false, posten, 'real') : null,
    [plan, posten, heute],
  );

  // Der laufende Monat aus den echten Buchungen — was Malins Dashboard zeigt.
  const monat = heute.slice(0, 7);
  const monatsBuchungen = buchungen.filter(b => b.datum.slice(0, 7) === monat);
  const letzterMonat = useMemo(() => {
    const alle = Array.from(new Set(buchungen.map(b => b.datum.slice(0, 7)))).sort();
    return alle.at(-1) ?? monat;
  }, [buchungen, monat]);
  const zeigeMonat = monatsBuchungen.length ? monat : letzterMonat;
  const imMonat = buchungen.filter(b => b.datum.slice(0, 7) === zeigeMonat);
  const ein = imMonat.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
  const aus = Math.abs(imMonat.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0));

  const nachKategorie = useMemo(() => {
    const m = new Map<string, number>();
    imMonat.filter(b => b.betrag < 0).forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    return Array.from(m.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s).slice(0, 7);
  }, [imMonat]);

  const offeneZahlungen = (plan?.zahlungen ?? []).filter(z => z.status === 'offen');
  const offeneRechnungen = (plan?.rechnungen ?? []).filter(r => r.status !== 'bezahlt' && r.betrag > 0);
  const konten = (plan?.firmen ?? []).reduce((s, f) => s + (f.kontostand ?? 0), 0);
  const monatLabel = new Date(`${zeigeMonat}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const Zahl = ({ titel, wert, farbe, sub }: { titel: string; wert: string; farbe?: string; sub?: string }) => (
    <div style={{ ...panel, padding: '14px 17px', flex: 1, minWidth: 155 }}>
      <div style={lbl}>{titel}</div>
      <div style={{ fontSize: 23, fontWeight: 700, color: farbe ?? T.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{wert}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 56px' }}>
        <Link href="/os" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Übersicht</Link>
        <Seitenkopf
          rubrik={<>Finanzen</>}
          titel={<>Dashboard</>}
        />

        {/* Grundlage zuerst: was wirklich geflossen ist, aus Malins Kassenbuch */}
        {grund?.vorhanden && grund.kennzahlen && (
          <Link href="/os/finanzen/grundlage" style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '14px 18px', marginBottom: 12, display: 'block', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={lbl}>Grundlage · Malins Finanz-Dashboard</span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                Stand {grund.stand ? `${grund.stand.slice(8)}.${grund.stand.slice(5, 7)}.` : '—'}
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk }}>aufschlagen ›</span>
            </div>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {([
                ['Umsatz netto', eur(grund.kennzahlen.umsatzNetto), T.accent],
                ['Kosten netto', eur(grund.kennzahlen.kostenNetto), T.amber],
                ['Ergebnis', eur(grund.kennzahlen.ergebnisNetto), grund.kennzahlen.ergebnisNetto >= 0 ? T.accent : T.crit],
                ['Ø / Monat', eur(grund.kennzahlen.umsatzProMonat), T.ink],
              ] as [string, string, string][]).map(([t, w, f]) => (
                <div key={t}>
                  <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '.1em', textTransform: 'uppercase' }}>{t}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: f, fontVariantNumeric: 'tabular-nums' }}>{w}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 7 }}>
              {MONAT_KURZ(grund.kennzahlen.vonMonat)}–{MONAT_KURZ(grund.kennzahlen.bisMonat)} {grund.kennzahlen.bisMonat.slice(0, 4)} · {grund.kennzahlen.monate} Monate seit dem ersten Beleg — nicht seit Januar.
            </div>
          </Link>
        )}

        {/* ─── Die Lage in Zahlen (UX 3, 06.09.) ────────────────────────────
            Vorher vier gleich große Kacheln, die miteinander konkurrierten.
            N26 macht es umgekehrt: EINE Heldenzahl — der Kontostand — und
            alles andere tritt als Zeile darunter zurück. Man sieht in einer
            halben Sekunde, wie man dasteht. */}
        <div style={{ marginBottom: A.l }}>
          <div style={MIKRO}>Auf den Konten</div>
          <div style={{
            ...ZIFFERN, fontSize: TYP.held, fontWeight: 700, lineHeight: 1.05,
            color: konten < 0 ? C.kritisch : C.ink, margin: '2px 0 2px',
          }}>{eur(konten)}</div>
          <div style={{ display: 'flex', gap: A.l, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkLeise, marginTop: A.s }}>
            <span>{plan?.firmen.length ?? 0} Konten</span>
            {v && (
              <span>
                In 12 Wochen{' '}
                <b style={{
                  ...ZIFFERN, fontWeight: 600,
                  color: v.engpass ? C.kritisch : (v.wochen.at(-1)?.stand ?? 0) < 2000 ? C.achtung : C.gut,
                }}>{eur(v.wochen.at(-1)?.stand ?? 0)}</b>
                {v.engpass ? ` · eng ab ${v.engpass.label}` : ` · Tief ${eur(v.tiefpunkt.stand)}`}
              </span>
            )}
            <span>
              Muss raus{' '}
              <b style={{ ...ZIFFERN, fontWeight: 600, color: offeneZahlungen.length ? C.achtung : C.inkLeise }}>
                {eur(offeneZahlungen.reduce((s, z) => s + z.betrag, 0))}
              </b> · {offeneZahlungen.length} Posten
            </span>
            <span>
              Kommt rein{' '}
              <b style={{ ...ZIFFERN, fontWeight: 600, color: C.gut }}>
                {eur(offeneRechnungen.reduce((s, r) => s + r.betrag, 0))}
              </b> · {offeneRechnungen.length} Rechnungen
            </span>
          </div>
        </div>

        {/* Der Monat aus den echten Buchungen */}
        {!!imMonat.length && (
          <div style={{ ...panel, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={lbl}>{monatLabel}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent }}>+{eur(ein)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.amber }}>−{eur(aus)}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: ein - aus >= 0 ? T.accent : T.crit }}>
                = {ein - aus >= 0 ? '+' : ''}{eur(ein - aus)}
              </span>
              <Link href="/os/finanzen/buchungen" style={{ marginLeft: 'auto', fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>
                alle {buchungen.length} Buchungen ›
              </Link>
            </div>
            {(() => {
              const max = Math.max(...nachKategorie.map(x => x.s), 1);
              return nachKategorie.map(x => (
                <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 0' }}>
                  <span style={{ fontSize: 12.5, color: T.inkDim, width: 160, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k}</span>
                  <div style={{ flex: 1, height: 8, background: T.void, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round((x.s / max) * 100)}%`, height: '100%', background: T.amber, opacity: 0.75, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, width: 78, textAlign: 'right' }}>{eur(x.s)}</span>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Was jetzt dran ist */}
        {!!offeneZahlungen.length && (
          <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '14px 18px', marginBottom: 14 }}>
            <div style={{ ...lbl, marginBottom: 8 }}>Als Nächstes fällig</div>
            {offeneZahlungen
              .slice()
              .sort((a, b) => (a.faellig ?? '9999').localeCompare(b.faellig ?? '9999'))
              .slice(0, 5)
              .map(z => {
                const spaet = !!z.faellig && z.faellig < heute;
                return (
                  <div key={z.id} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '4px 0' }}>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: spaet ? T.crit : T.muted, width: 62 }}>
                      {z.faellig ? `${z.faellig.slice(8)}.${z.faellig.slice(5, 7)}.` : '—'}
                    </span>
                    <span style={{ fontSize: 13, color: T.ink, flex: 1, minWidth: 0 }}>{z.an}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: spaet ? T.crit : T.inkDim }}>{eur(z.betrag)}</span>
                  </div>
                );
              })}
            <Link href="/os/finanzen/planung" style={{ display: 'inline-block', marginTop: 8, fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>Prioritätenliste öffnen ›</Link>
          </div>
        )}

        {/* Unterbereiche */}
        <div style={{ ...lbl, margin: '18px 0 8px' }}>Bereiche</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
          {UNTERFELDER.map(u => (
            <Link key={u.href} href={u.href} style={{ ...panel, padding: '14px 16px', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{u.titel}</div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3, lineHeight: 1.45 }}>{u.satz}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
