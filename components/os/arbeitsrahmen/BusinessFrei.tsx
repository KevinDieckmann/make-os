'use client';

// ─── Business-frei — Bausteine der Oberfläche (08.10., Lücke 7) ─────────────────────────────────────────────────────────
// Kevin: „Business-freie Zeiten durchsetzen.“ Die Regel steht in lib/arbeitsrahmen/regel.ts, der Server in /api/arbeitsrahmen.
//   useArbeitsrahmen(von, bis)  eigene Spannen im Zeitraum + Status jetzt (Kalender, Heute) — nur die eigene Person
//   BusinessFreiStatus          kleiner Hinweis „Business-frei bis 23:59“ (Heute) — nur, wenn es gerade gilt
//   EigeneBusinessFrei          die eigene Ergänzung (Familie › Rahmen) — nur einschränken, nie die gemeinsamen Zeiten aufheben

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Knopf, Hinweis, feld, LEUCHT, Wahl as UiWahl } from '../ui';
import type { BusinessFreiFenster, Spanne } from '@/lib/arbeitsrahmen/regel';
import { EIGENE_MAX } from '@/lib/arbeitsrahmen/regel';

export interface ArbeitsrahmenAntwort {
  ok: boolean; von: string; bis: string;
  jetzt: { frei: boolean; bis?: string; bisText?: string };
  fenster: Spanne[];
  eigene: { fenster: BusinessFreiFenster[]; stand: string };
  familie: { gilt: boolean };
}

/** Eigene Business-freie Spannen im Zeitraum [von, bis) — `null`, solange nichts geladen ist (dann zeichnet niemand etwas). */
export function useArbeitsrahmen(von: string, bis: string): ArbeitsrahmenAntwort | null {
  const [d, setD] = useState<ArbeitsrahmenAntwort | null>(null);
  useEffect(() => {
    let weg = false;
    if (!von || !bis) return;
    fetch(`/api/arbeitsrahmen?von=${von}&bis=${bis}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (!weg && x?.ok) setD(x as ArbeitsrahmenAntwort); }).catch(() => {});
    return () => { weg = true; };
  }, [von, bis]);
  return d;
}

/** „Business-frei bis 23:59“ — nur für die eigene Person, nur wenn es gerade gilt. */
export function BusinessFreiStatus() {
  const [s, setS] = useState<ArbeitsrahmenAntwort['jetzt'] | null>(null);
  useEffect(() => {
    let weg = false;
    const holen = () => fetch('/api/arbeitsrahmen', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => { if (!weg && x?.ok) setS(x.jetzt); }).catch(() => {});
    void holen();
    const t = setInterval(holen, 5 * 60_000);
    return () => { weg = true; clearInterval(t); };
  }, []);
  if (!s?.frei) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, border: `1px solid ${LEUCHT.beziehung}55`, background: `${LEUCHT.beziehung}14`, color: LEUCHT.beziehung, fontWeight: 600 }}>
        <Moon size={14} strokeWidth={2} aria-hidden /> Business-frei {s.bisText ?? ''}
      </span>
      <span>Business-Hinweise warten bis danach.</span>
    </div>
  );
}

const WT = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const leer: BusinessFreiFenster = { tage: [6], von: '18:00', bis: '23:59' };

/** Die eigene Ergänzung — zusätzliche Business-freie Zeiten nur für mich. */
export function EigeneBusinessFrei() {
  const [d, setD] = useState<ArbeitsrahmenAntwort | null>(null);
  const [liste, setListe] = useState<BusinessFreiFenster[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);
  const laden = useCallback(async () => {
    const x = await fetch('/api/arbeitsrahmen', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (x?.ok) { setD(x); setListe(x.eigene.fenster); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (!d) return null;
  const geaendert = JSON.stringify(liste) !== d.eigene.stand;
  const setze = (i: number, teil: Partial<BusinessFreiFenster>) => { setGespeichert(false); setListe(l => l.map((x, j) => (j === i ? { ...x, ...teil } : x))); };
  const speichern = async () => {
    setFehler(null);
    const r = await fetch('/api/arbeitsrahmen', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fenster: liste, stand: d.eigene.stand }) })
      .then(async x => ({ status: x.status, j: await x.json().catch(() => ({})) })).catch(() => ({ status: 0, j: { fehler: 'Keine Verbindung — nichts gespeichert.' } }));
    if (r.j?.ok) { setGespeichert(true); await laden(); return; }
    setFehler(r.j?.fehler ?? 'Nicht gespeichert.');
    if (r.status === 409) await laden();
  };
  const zeit = (v: string, onW: (x: string) => void, label: string) => <input type="time" value={v === '24:00' ? '23:59' : v} aria-label={label} onChange={x => onW(x.target.value)} style={{ ...feld, width: 'auto', colorScheme: 'dark' }} />;
  return (
    <div id="business-frei-eigene" style={{ display: 'grid', gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.linie}` }}>
      <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim }}>Nur für mich zusätzlich</div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>
        Eigene Zeiten kommen zu den gemeinsamen dazu — sie heben keine gemeinsame Zeit auf. Andere sehen davon nur „nicht verfügbar“.
      </div>
      {liste.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {WT.map((w, t) => {
              const an = b.tage.includes(t);
              return <UiWahl key={w} klein an={an} farbe={LEUCHT.beziehung} onClick={() => setze(i, { tage: an ? b.tage.filter(y => y !== t) : [...b.tage, t].sort((x, y) => x - y) })}>{w.slice(0, 2)}</UiWahl>;
            })}
          </div>
          {zeit(b.von, von => setze(i, { von }), 'von')}
          {zeit(b.bis, bis => setze(i, { bis }), 'bis')}
          <Knopf leise onClick={() => { setGespeichert(false); setListe(l => l.filter((_, j) => j !== i)); }}>Entfernen</Knopf>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {liste.length < EIGENE_MAX && <Knopf leise onClick={() => { setGespeichert(false); setListe(l => [...l, { ...leer }]); }}>+ Eigenes Zeitfenster</Knopf>}
        {geaendert && <Knopf farbe={LEUCHT.beziehung} onClick={speichern}>Speichern</Knopf>}
        {gespeichert && !geaendert && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gespeichert.</span>}
      </div>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
    </div>
  );
}

/** Ein ruhiger Link zu den Business-freien Zeiten (Kapazität, Kalender-Einstellungen). */
export function BusinessFreiLink({ text = 'Business-freie Zeiten' }: { text?: string }) {
  return <Link href={WEG.familie('rahmen')} style={{ color: LEUCHT.beziehung }}>{text} ›</Link>;
}
