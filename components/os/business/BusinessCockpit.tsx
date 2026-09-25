'use client';

// ─── Business-Index (25.09.) — das Business-Cockpit ─────────────────────────
// Kevin: „Die Kennzahlen des KSI-Scores sind Gold wert für den kompletten
// Business-Bereich.“ Hier steht unser Index: Finanzielle Gesundheit 50 % ·
// Unternehmer-DNA 30 % · Markttraktion 20 % — je Firma und gesamt, jede Zahl
// mit Formel und Quelle, jede fehlende mit dem Weg, sie zu schließen.
// Der Wachstums-Score nimmt genau diese Zahl als seine Business-Säule.

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Ring, Fortschritt, Segmente, Chip, LEUCHT } from '../schlank';
import { useLinkAuswahl } from '../Verlauf';
import { KennzahlKachel, KennzahlFenster, SAEULE_FARBE, AMPEL_FARBE, scoreFarbe } from './teile';
import { MonatsabschlussKarte, KoepfeKarte } from './Abschluss';
import type { BusinessIndex } from '@/lib/business/index';
import type { Monatsabschluss } from '@/lib/business/messen';
import type { Scope } from '@/lib/business/register';

interface Antwort {
  ok: boolean; scope: Scope; bi: BusinessIndex;
  sichten: Record<Scope, { index: number | null; label: string }>;
  vor30: number | null;
  wechsel: { id: string; von: string; nach: string; seit: string }[];
  verlauf: { tag: string; index: number | null; saeulen: Record<string, number | null>; werte: Record<string, number | null> }[];
  abschluesse: Monatsabschluss[];
  einstellungen: { fte: Partial<Record<'kdc' | 'kdv', number>> };
  fehler?: string;
}

const SCOPE_LABEL: Record<Scope, string> = { gesamt: 'Gesamt', kdc: 'Consulting', kdv: 'KD Ventures' };

export function BusinessCockpit() {
  const router = useRouter();
  const pfad = usePathname() ?? '/os/business';
  const params = useSearchParams();
  const scope: Scope = (['kdc', 'kdv'] as const).find(s => s === params.get('f')) ?? 'gesamt';
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

  return (
    <Seite titel="Business-Index" breit={1440}
      unter="Unsere KSI-Logik mit unseren Zahlen: Finanzielle Gesundheit 50 % · Unternehmer-DNA 30 % · Markttraktion 20 %. Jede Zahl mit Formel und Quelle — Privates zählt nie."
      rechts={<Segmente liste={(['gesamt', 'kdc', 'kdv'] as Scope[]).map(s => ({ id: s, label: d?.sichten?.[s]?.index != null ? `${SCOPE_LABEL[s]} · ${d.sichten[s].index}` : SCOPE_LABEL[s] }))} aktiv={scope} onWahl={wechsle} />}>

      {fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{fehler}</div>}

      {/* Der Index */}
      <Karte i={0} akzent={farbe}>
        <div style={{ display: 'flex', gap: 'clamp(18px, 4vw, 44px)', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ring groesse="gross" wert={bi?.index != null ? String(bi.index) : undefined} anteil={bi?.index != null ? bi.index / 100 : undefined} farbe={farbe} label={bi ? bi.label : 'lädt …'} />
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip farbe={farbe}>{SCOPE_LABEL[scope]}</Chip>
              {trend != null && trend !== 0 && <Chip farbe={trend > 0 ? LEUCHT.gut : LEUCHT.kritisch}>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)} in 30 Tagen</Chip>}
              {bi && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{Math.round(bi.abdeckung * 100)} % des Index auf echten Daten · {bi.luecken} Messlücke{bi.luecken === 1 ? '' : 'n'}</span>}
            </div>
            {bi?.saeulen.map(s => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(70px, 2fr) 40px', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink }}>{s.label} <span style={{ color: C.inkLeise, fontWeight: 400 }}>{Math.round(s.gewicht * 100)} %</span></span>
                <Fortschritt anteil={(s.score ?? 0) / 100} farbe={s.zuDuenn ? C.inkLeise : SAEULE_FARBE[s.id]} />
                <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, textAlign: 'right', color: s.score == null || s.zuDuenn ? C.inkLeise : C.ink, fontVariantNumeric: 'tabular-nums' }} title={s.zuDuenn ? 'zu wenig Daten — zählt nicht in den Index' : undefined}>{s.score ?? '—'}{s.zuDuenn ? '*' : ''}</span>
              </div>
            ))}
            {bi?.hebel && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Größter Hebel: <button onClick={() => setOffen(bi.hebel!.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontWeight: 700, cursor: 'pointer', fontSize: TYP.bedien, textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,.25)' }}>{bi.hebel.label}</button> ({bi.hebel.saeule})</div>}
            {bi?.saeulen.some(s => s.zuDuenn) && <div style={{ fontSize: 12, color: C.inkLeise }}>* zu wenig Daten (unter 40 % gemessen) — zählt noch nicht in den Index.</div>}
          </div>
        </div>
        {!!d?.wechsel.length && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5 }}>
            <span style={{ color: C.inkLeise }}>Seit {d.wechsel[0].seit.slice(8)}.{d.wechsel[0].seit.slice(5, 7)}.:</span>
            {d.wechsel.map(w => {
              const k = alleK.find(x => x.id === w.id);
              return <button key={w.id} onClick={() => setOffen(w.id)} style={{ background: `${AMPEL_FARBE[w.nach as keyof typeof AMPEL_FARBE]}1c`, border: 'none', borderRadius: 999, padding: '4px 10px', color: AMPEL_FARBE[w.nach as keyof typeof AMPEL_FARBE], cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{k?.label ?? w.id}: {w.von} → {w.nach}</button>;
            })}
          </div>
        )}
      </Karte>

      {/* Die drei Säulen */}
      {bi?.saeulen.map((s, i) => {
        const gruppen = Array.from(new Set(s.kennzahlen.map(k => k.gruppe)));
        return (
          <Karte key={s.id} i={i + 1} akzent={SAEULE_FARBE[s.id]}>
            <Ueberschrift farbe={SAEULE_FARBE[s.id]} rechts={<span>{s.kennzahlen.filter(k => k.gemessen).length} von {s.kennzahlen.length} gemessen{s.zuDuenn ? ' · zählt noch nicht' : ''}</span>}>
              {s.label} · {Math.round(s.gewicht * 100)} % {s.score != null && <span style={{ color: C.ink, marginLeft: 6, letterSpacing: 0 }}>{s.score}</span>}
            </Ueberschrift>
            <div style={{ fontSize: 12.5, color: C.inkLeise, margin: '-4px 0 12px' }}>{s.satz}</div>
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
        );
      })}

      {d && <MonatsabschlussKarte eintraege={d.abschluesse} onGespeichert={() => void laden()} />}
      {d && <KoepfeKarte fte={d.einstellungen.fte} onGespeichert={() => void laden()} />}

      <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.6 }}>
        Übernommen aus dem KSI: die Struktur (50/30/20) und Standard-Kennzahlen mit ihren Schwellen — gerechnet nur mit euren eigenen Daten,
        ohne Code oder Daten aus KEMARIS/POINCAP. Punkte: an der roten Schwelle 20, an der grünen 100, dazwischen linear; eine Säule zählt ab 40 % gemessener Kennzahlen.
        Der Wachstums-Score nimmt diesen Index als Business-Säule, die Finanzielle Gesundheit als Business-Hälfte der Finanzen.
      </div>

      {offeneK && d && (
        <KennzahlFenster key={offeneK.k.id} k={offeneK.k} saeule={offeneK.s.label} onZu={() => setOffen(null)}
          verlauf={d.verlauf.map(v => ({ tag: v.tag, wert: v.werte?.[offeneK.k.id] ?? null }))} />
      )}
    </Seite>
  );
}
