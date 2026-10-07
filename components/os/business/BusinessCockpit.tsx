'use client';

// ─── Business-Index (25.09.) — das Business-Cockpit ─────────────────────────
// Kevin: „Die Kennzahlen des KSI-Scores sind Gold wert für den kompletten
// Business-Bereich.“ Hier steht unser Index (Säulen und Gewichte: SAEULEN_TEXT in
// lib/business/register.ts) — je Firma und gesamt, jede Zahl
// mit Formel und Quelle, jede fehlende mit dem Weg, sie zu schließen.
// Der Wachstums-Score nimmt genau diese Zahl als seine Business-Säule.
// Seit 25.09. lebt das Cockpit unter Zahlen → Business (/os/finanzen?s=business);
// /os/business leitet dorthin um. Hinter jeder Kachel stehen die Punkte, aus
// denen sie besteht — jeder ein Link dorthin, wo man handelt.

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { WEG } from '@/lib/wege';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Ring, Fortschritt, Segmente, Chip, LEUCHT, Hinweis, FlussKarte } from '../ui';
import { IndexFadenLinie } from '../kennzahlen/IndexAnsicht';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { useLinkAuswahl } from '../Verlauf';
import { KennzahlKachel, KennzahlFenster, SAEULE_FARBE, AMPEL_FARBE, scoreFarbe } from './teile';
import { MonatsabschlussKarte, EinstellungenKarte } from './Abschluss';
import { EroeffnungKarte } from './Eroeffnung';
import { VerlaufKarte } from './Verlauf';
import { ModellKarte } from './Modell';
import { useZuZiel } from '../ziel';
import type { Geschaeftsmodell } from '@/lib/business/modell';
import type { BusinessIndex } from '@/lib/business/index';
import type { Monatsabschluss } from '@/lib/business/messen';
import { SCOPES, SAEULEN_TEXT, scopeAus, type Scope } from '@/lib/business/register';
import { GEHOERT_ZU_PRIVAT, gehoertZuPrivat, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';

interface Antwort {
  ok: boolean; scope: Scope; bi: BusinessIndex;
  /** Diese Sicht ist laut Register eine Holding (operative Kennzahlen zählen nicht). */
  holding?: boolean;
  sichten: Record<Scope, { index: number | null; label: string }>;
  vor30: number | null;
  wechsel: { id: string; von: string; nach: string; seit: string }[];
  verlauf: { tag: string; index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null> }[];
  abschluesse: Monatsabschluss[];
  /** 0-Punkt je Gesellschaft (Stichtag) — Abschlüsse davor sind archiviert. */
  stichtage?: Partial<Record<Gesellschaftskennung, string>>;
  einstellungen: { fte: Partial<Record<Gesellschaftskennung, number>>; ziele?: Partial<Record<Gesellschaftskennung, number>>; kapazitaet?: Partial<Record<Gesellschaftskennung, number>> };
  modell?: Geschaeftsmodell;
  fehler?: string;
}

const SCOPE_LABEL = Object.fromEntries(SCOPES.map(s => [s.id, s.label])) as Record<Scope, string>;

/** eingebettet = als Reiter „Business“ unter Zahlen (ohne eigenen Seitenrahmen). */
export function BusinessCockpit({ eingebettet = false, darunter }: { eingebettet?: boolean; darunter?: ReactNode } = {}) {
  const router = useRouter();
  const pfad = usePathname() ?? '/os/finanzen';
  const params = useSearchParams();
  const scope: Scope = scopeAus(params.get('f'));
  // Alter Link auf die Selbstständigkeit (?f=kdc): sie gehört seit 05.10. zu Privat — sagen statt still „Gesamt“ zu zeigen.
  const fRoh = params.get('f');
  const privatSicht = istGesellschaft(fRoh) && gehoertZuPrivat(fRoh) ? fRoh : null;
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useLinkAuswahl('k');

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/business?scope=${scope}`, { cache: 'no-store' }).then(x => x.json());
      if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
    } catch { setFehler('Keine Verbindung.'); }
  }, [scope]);
  useEffect(() => { void laden(); }, [laden]);
  // #abschluss, #einstellungen, #modell aus einem Link: hinspringen, sobald die Karten stehen.
  useZuZiel(null, !!d);

  const wechsle = (s: Scope) => {
    const q = new URLSearchParams(params.toString());
    if (s === 'gesamt') q.delete('f'); else q.set('f', s);
    q.delete('k');
    router.replace(`${pfad}${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };

  const bi = d?.bi.scope === scope ? d.bi : null;
  const farbe = scoreFarbe(bi?.index ?? null);
  const trend = bi?.index != null && d?.vor30 != null ? bi.index - d.vor30 : null;
  const offeneK = bi && offen ? bi.saeulen.flatMap(s => s.kennzahlen.map(k => ({ k, s }))).find(x => x.k.id === offen) : undefined;
  const alleK = bi?.saeulen.flatMap(s => s.kennzahlen) ?? [];

  const sichtWahl = <Segmente liste={SCOPES.map(x => x.id).map(s => ({ id: s, label: d?.sichten?.[s]?.index != null ? `${SCOPE_LABEL[s]} · ${d.sichten[s].index}` : SCOPE_LABEL[s] }))} aktiv={scope} onWahl={wechsle} />;
  const inhalt = (
    <>
      {eingebettet && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, maxWidth: 640, lineHeight: 1.5 }}>Business-Index: {SAEULEN_TEXT} — jede Zahl mit Formel, Quelle und den Punkten dahinter. Privates zählt nie.</span>
          {sichtWahl}
        </div>
      )}
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      {privatSicht && <Hinweis>{GEHOERT_ZU_PRIVAT(privatSicht)} Ihre Zahlen stehen unter Finanzen › Privat › Finanzplanung; hier siehst du „Gesamt“ ohne sie.</Hinweis>}

      <Flaeche seite="business">
      {/* Der Index */}
      <Kachel id="index" titel="Business-Index" breite={6}>
      <Karte i={0} ton={farbe}>
        <div style={{ display: 'flex', gap: 'clamp(18px, 4vw, 44px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring groesse="gross" wert={bi?.index != null ? String(bi.index) : undefined} anteil={bi?.index != null ? bi.index / 100 : undefined} farbe={farbe} label={bi ? bi.label : 'lädt …'} />
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip farbe={farbe}>{SCOPE_LABEL[scope]}</Chip>
              {d?.holding && d.scope === scope && scope !== 'gesamt' && <Link href={WEG.unternehmen(scope)} style={{ fontSize: TYP.bedien, color: C.inkLeise }} title="Rolle im Steckbrief — operative Vertriebs- und Produktivitätskennzahlen zählen hier nicht">Holding laut Register ›</Link>}
              {trend != null && trend !== 0 && <Chip farbe={trend > 0 ? LEUCHT.gut : LEUCHT.kritisch}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)} in 30 Tagen</Chip>}
              {bi && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{Math.round(bi.abdeckung * 100)} % des Index auf echten Daten · {bi.luecken} Messlücke{bi.luecken === 1 ? '' : 'n'}</span>}
            </div>
            {bi?.saeulen.map(s => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(70px, 2fr) 40px', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{s.label} <span style={{ color: C.inkLeise, fontWeight: 400 }}>{Math.round(s.gewicht * 100)} %</span></span>
                <Fortschritt anteil={(s.score ?? 0) / 100} farbe={s.zuDuenn ? C.inkLeise : SAEULE_FARBE[s.id]} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, textAlign: 'right', color: s.score == null || s.zuDuenn ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }} title={s.zuDuenn ? 'zu wenig Daten — zählt nicht in den Index' : undefined}>{s.score ?? '—'}{s.zuDuenn ? '*' : ''}</span>
              </div>
            ))}
            {/* Fokus-Signatur (04.10.): der Verlauf des Index als Mini-Strahl — dieselbe Reihe wie die Verlaufskarte unten. */}
            {d && <IndexFadenLinie verlauf={d.verlauf} name="Business" farbe={farbe} />}
            {bi?.hebel && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Größter Hebel: <button onClick={() => setOffen(bi.hebel!.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontWeight: 700, cursor: 'pointer', fontSize: TYP.bedien, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)' }}>{bi.hebel.label}</button> ({bi.hebel.saeule})</div>}
            {bi?.saeulen.some(s => s.zuDuenn) && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>* zu wenig Daten (unter 40 % gemessen) — zählt noch nicht in den Index.</div>}
          </div>
        </div>
        {!!d?.wechsel.length && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien }}>
            <span style={{ color: C.inkLeise }}>Seit {d.wechsel[0].seit.slice(8)}.{d.wechsel[0].seit.slice(5, 7)}.:</span>
            {d.wechsel.map(w => {
              const k = alleK.find(x => x.id === w.id);
              return <button key={w.id} onClick={() => setOffen(w.id)} style={{ background: `${AMPEL_FARBE[w.nach as keyof typeof AMPEL_FARBE]}1c`, border: 'none', borderRadius: 999, padding: '4px 10px', color: AMPEL_FARBE[w.nach as keyof typeof AMPEL_FARBE], cursor: 'pointer', fontSize: TYP.bedien, fontWeight: 600 }}>{k?.label ?? w.id}: {w.von} → {w.nach}</button>;
            })}
          </div>
        )}
      </Karte>
      </Kachel>

      {/* Die drei Säulen */}
      {bi?.saeulen.map((s, i) => {
        const gruppen = Array.from(new Set(s.kennzahlen.map(k => k.gruppe)));
        return (
          <Kachel key={s.id} id={`saeule-${s.id}`} titel={s.label} breite={6}>
          <Karte i={i + 1} akzent={SAEULE_FARBE[s.id]}>
            <Ueberschrift farbe={SAEULE_FARBE[s.id]} rechts={<span>{s.kennzahlen.filter(k => k.gemessen).length} von {s.kennzahlen.length} gemessen{s.zuDuenn ? ' · zählt noch nicht' : ''}</span>}>
              {s.label} · {Math.round(s.gewicht * 100)} % {s.score != null && <span style={{ color: C.ink, marginLeft: 6, letterSpacing: 0 }}>{s.score}</span>}
            </Ueberschrift>
            <div style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '-4px 0 12px' }}>{s.satz}</div>
            <div style={{ display: 'grid', gap: 14 }}>
              {gruppen.map(g => (
                <div key={g} style={{ display: 'grid', gap: 8 }}>
                  {gruppen.length > 1 && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>{g}</span>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                    {s.kennzahlen.filter(k => k.gruppe === g).map(k => <KennzahlKachel key={k.id} k={k} onOeffnen={() => setOffen(k.id)} />)}
                  </div>
                </div>
              ))}
            </div>
          </Karte>
          </Kachel>
        );
      })}
      </Flaeche>

      {/* Überblick „Für dich“ (04.10. abends): Ist der letzten 3 Monate → heute → Prognose aus echten Daten; serverseitig gefiltert (FlussKarte, /api/fluss). */}
      <FlussKarte bereich="finanzen-business" farbe={LEUCHT.business} />

      {d?.modell && <ModellKarte m={d.modell} />}

      {d && d.verlauf.length > 0 && <VerlaufKarte punkte={d.verlauf} />}

      {darunter}

      {/* 0-Punkt (05.10.): Stichtag + Anfangsbestand je Gesellschaft — ab dort rechnet alles neu, Älteres bleibt archiviert. */}
      {d && <EroeffnungKarte onGeaendert={() => void laden()} />}
      {d && <MonatsabschlussKarte eintraege={d.abschluesse} stichtage={d.stichtage} onGespeichert={() => void laden()} />}
      {d && <EinstellungenKarte einstellungen={d.einstellungen} onGespeichert={() => void laden()} />}

      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.6 }}>
        Übernommen aus dem KSI: die Struktur (50/30/20) und Standard-Kennzahlen mit ihren Schwellen — gerechnet nur mit euren eigenen Daten,
        ohne Code oder Daten aus KEMARIS/POINCAP. Punkte: an der roten Schwelle 20, an der grünen 100, dazwischen linear; eine Säule zählt ab 40 % gemessener Kennzahlen.
        Der Wachstums-Score nimmt diesen Index als Business-Säule, die Finanzielle Gesundheit als Business-Hälfte der Finanzen.
      </div>

      {offeneK && d && (
        <KennzahlFenster key={offeneK.k.id} k={offeneK.k} saeule={offeneK.s.label} scope={scope} onZu={() => setOffen(null)} onGespeichert={() => void laden()}
          verlauf={d.verlauf.map(v => ({ tag: v.tag, wert: v.werte?.[offeneK.k.id] ?? null }))} />
      )}
    </>
  );
  if (eingebettet) return inhalt;
  return (
    <Seite titel="Business-Index" breit={1440}
      unter={`Mit unseren eigenen Zahlen: ${SAEULEN_TEXT}. Jede Zahl mit Formel und Quelle — Privates zählt nie.`}>
      <div className="ui-reiter-zeile">{sichtWahl}</div>
      {inhalt}
    </Seite>
  );
}
