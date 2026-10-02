'use client';

// ─── Netzwerken — Abend-Zähler im Event-Kopf (03.10., Schliff) ───────────────
// „Heute bei <Event>: n Kontakte · n Termine · n Follow-ups“ — kleine Zahlen, die beim Laden und bei jeder neuen Erfassung
// sanft hochzählen (≈ 0,75 s), dazu ein dünner Ring: wie viele der erfassten Personen haben einen festen Folgeschritt
// (alles außer „Nur Kontakt“). Gerechnet wird nur aus den Teilnahmen des Events (`teilnahme.netzwerken`) — dieselbe Quelle
// wie der Abendbericht, keine zweite Zählung. Bei „Bewegung reduzieren“ steht die Zahl sofort da.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, ZIFFERN } from '@/lib/make-one/design';
import type { Teilnahme } from '@/lib/crm/typen';

export interface AbendZahlen { kontakte: number; termine: number; followups: number; mitFolgeschritt: number }

/** Die Zahlen des Abends für ein Event — aus den über „Netzwerken“ erfassten Teilnahmen. */
export function abendZahlen(teilnahmen: readonly Teilnahme[], eventId: string): AbendZahlen {
  const personen = new Set<string>();
  const z: AbendZahlen = { kontakte: 0, termine: 0, followups: 0, mitFolgeschritt: 0 };
  for (const t of teilnahmen) {
    const n = t.netzwerken;
    if (!n || t.eventId !== eventId || personen.has(t.kontaktId)) continue;
    personen.add(t.kontaktId);
    z.kontakte += 1;
    if (n.schritt === 'termin') z.termine += 1;
    if (n.schritt === 'followup') z.followups += 1;
    if (n.schritt !== 'nur-kontakt') z.mitFolgeschritt += 1;
  }
  return z;
}

const ohneBewegung = (): boolean => typeof window === 'undefined' || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Eine Zahl, die zu ihrem Ziel hochzählt (ease-out). `null` = noch unbekannt. `puls` zählt hoch, wenn das Ziel gestiegen ist
 * (für den kurzen Atemzug der Zahl). Unterbrochene Läufe setzen dort fort, wo die Zahl gerade steht — nie ein Rücksprung.
 */
export function useZaehlen(ziel: number | null, dauerMs = 750): { wert: number | null; puls: number } {
  const [wert, setWert] = useState(0);
  const [puls, setPuls] = useState(0);
  const jetzt = useRef(0);
  const vorher = useRef<number | null>(null);
  useEffect(() => {
    if (ziel === null) return;
    const alt = vorher.current;
    vorher.current = ziel;
    if (ohneBewegung()) { jetzt.current = ziel; setWert(ziel); return; }
    if (alt !== null && ziel > alt) setPuls(p => p + 1);
    const von = jetzt.current;
    const start = performance.now();
    let raf = 0;
    const schritt = (t: number) => {
      const p = Math.min(1, (t - start) / dauerMs);
      const v = Math.round(von + (ziel - von) * (1 - Math.pow(1 - p, 3)));
      jetzt.current = v; setWert(v);
      if (p < 1) raf = requestAnimationFrame(schritt);
    };
    raf = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(raf);
  }, [ziel, dauerMs]);
  return { wert: ziel === null ? null : wert, puls };
}

/** Dünner Ring mit „n/m“ in der Mitte. `anteil` 0–1; die Füllung läuft per CSS-Übergang ein. */
export function Ring({ anteil, farbe, text, titel, groesse = 46 }: { anteil: number; farbe: string; text: string; titel: string; groesse?: number }) {
  const r = (groesse - 6) / 2;
  const umfang = 2 * Math.PI * r;
  const [gefuellt, setGefuellt] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setGefuellt(Math.max(0, Math.min(1, anteil)))); return () => cancelAnimationFrame(id); }, [anteil]);
  return (
    <div role="img" aria-label={titel} title={titel} style={{ position: 'relative', width: groesse, height: groesse, flex: '0 0 auto' }}>
      <svg width={groesse} height={groesse} viewBox={`0 0 ${groesse} ${groesse}`} aria-hidden style={{ display: 'block', transform: 'rotate(-90deg)' }}>
        <circle cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={3} />
        <circle className="netz-ring-fuell" cx={groesse / 2} cy={groesse / 2} r={r} fill="none" stroke={farbe} strokeWidth={3} strokeLinecap="round" strokeDasharray={umfang} strokeDashoffset={umfang * (1 - gefuellt)} />
      </svg>
      <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: SCHRIFT.display, fontSize: TYP.mikro, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: C.ink }}>{text}</span>
    </div>
  );
}

function Stand({ ziel, einzahl, mehrzahl, farbe }: { ziel: number | null; einzahl: string; mehrzahl: string; farbe: string }) {
  const { wert, puls } = useZaehlen(ziel);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...ZIFFERN, fontSize: TYP.zahl, fontWeight: 700, lineHeight: 1.1, color: ziel ? farbe : C.inkLeise }}>
        <span key={puls} className={puls ? 'netz-zahl-puls' : undefined}>{wert === null ? '–' : wert}</span>
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 2, whiteSpace: 'nowrap' }}>{ziel === 1 ? einzahl : mehrzahl}</div>
    </div>
  );
}

/** Die Zeile im Event-Kopf: drei Zahlen, rechts der Ring. `zahlen` = null, solange die Kartei noch lädt (Platz bleibt reserviert). */
export function AbendZaehler({ zahlen, eventTitel, farbe }: { zahlen: AbendZahlen | null; eventTitel: string; farbe: string }) {
  const satz = zahlen ? `Heute bei ${eventTitel}: ${zahlen.kontakte} ${zahlen.kontakte === 1 ? 'Kontakt' : 'Kontakte'} · ${zahlen.termine} ${zahlen.termine === 1 ? 'Termin' : 'Termine'} · ${zahlen.followups} Follow-up${zahlen.followups === 1 ? '' : 's'}` : `Heute bei ${eventTitel}: Zahlen werden geladen`;
  const anteil = zahlen && zahlen.kontakte ? zahlen.mitFolgeschritt / zahlen.kontakte : 0;
  return (
    <div role="group" aria-label={satz} style={{ display: 'grid', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.08)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto', gap: 10, alignItems: 'center' }}>
        <Stand ziel={zahlen ? zahlen.kontakte : null} einzahl="Kontakt" mehrzahl="Kontakte" farbe={C.ink} />
        <Stand ziel={zahlen ? zahlen.termine : null} einzahl="Termin" mehrzahl="Termine" farbe={C.ink} />
        <Stand ziel={zahlen ? zahlen.followups : null} einzahl="Follow-up" mehrzahl="Follow-ups" farbe={C.ink} />
        <Ring anteil={anteil} farbe={farbe} text={zahlen && zahlen.kontakte ? `${zahlen.mitFolgeschritt}/${zahlen.kontakte}` : '–'} titel={zahlen ? `${zahlen.mitFolgeschritt} von ${zahlen.kontakte} mit festem Folgeschritt` : 'Folgeschritte werden geladen'} />
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.4 }}>
        {!zahlen ? 'Zahlen werden geladen …' : zahlen.kontakte === 0 ? 'Noch niemand erfasst — die erste Karte füllt diese Zeile.' : zahlen.mitFolgeschritt === zahlen.kontakte ? 'Alle mit festem Folgeschritt.' : `${zahlen.mitFolgeschritt} von ${zahlen.kontakte} mit festem Folgeschritt.`}
      </div>
    </div>
  );
}
