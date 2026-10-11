'use client';

// ─── Heute: Tages-Briefing (10.10., Branch `heute-top3`) ────────────────────────────────────────────────────────────────────────
// Kevin 08.10. (Fragebogen): „kurzes Tages-Briefing als Text“. Drei bis fünf Sätze: was ansteht, was brennt, was auf Freigabe wartet, die Top 3,
// ein Hinweis zum Fokus. Der Text kommt vom Server (GET /api/heute/briefing?space=…, Regelwerk aus den Zahlen DIESES Bereichs — kein Modell,
// nichts aus dem anderen Bereich) und frischt sich auf, wenn sich etwas ändert (Top 3 festgelegt) oder man ins Fenster zurückkehrt.
// 11.10. (Kevin: „über die Visualisierungen verstehen“): ÜBER dem Text steht die Lage als Bild — Termine, Top 3, Überfällig, Freigaben (Business
// dazu fällige Follow-ups) als Kacheln mit dem Weg dorthin (`Lage`, components/os/ui/lage.tsx). Dieselben Zahlen wie im Text, vom Server.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE, SPACE_LABEL } from '@/lib/make-one/space-regeln';
import { WEG } from '@/lib/wege';
import { Karte, Ueberschrift, Leer, Lage, type LageEintrag } from '../ui';
import type { TopBereich } from '@/lib/heute/top3';
import type { BriefingZahlen } from '@/lib/heute/briefing';

/** Die Lage des Tages als Kacheln (höchstens fünf): was als Nächstes kommt, wo wir stehen, was hängt — Rot nur bei Überfälligem. */
export function briefingLage(z: BriefingZahlen, sicht: TopBereich): LageEintrag[] {
  const t = z.termine;
  const n = z.top3.titel.length;
  const fertig = z.top3.art === 'festgelegt' && n > 0 && z.top3.erledigt >= n;
  const liste: LageEintrag[] = [
    { id: 'termine', wert: String(t.anzahl), label: t.anzahl === 1 ? 'Termin heute' : 'Termine heute', unter: t.erster ? (t.erster.uhr ? `zuerst ${t.erster.uhr}` : 'ganztägig') : 'freie Bahn', href: `/os/kalender?space=${sicht}` },
    {
      id: 'top3', label: 'Top 3', wert: z.top3.art === 'festgelegt' ? `${z.top3.erledigt}/${n}` : z.top3.art === 'vorschlag' ? String(n) : '—',
      unter: z.top3.art === 'festgelegt' ? (fertig ? 'alle erledigt' : 'erledigt') : z.top3.art === 'vorschlag' ? 'Vorschlag von ZOE' : 'noch keine',
      ...(z.top3.art === 'festgelegt' && n ? { anteil: z.top3.erledigt / n } : {}), ...(fertig ? { bedeutung: 'gut' as const } : {}),
    },
    {
      id: 'ueberfaellig', wert: String(z.ueberfaellig), label: 'Überfällig', bedeutung: z.ueberfaellig ? 'kritisch' : 'gut', href: WEG.aufgaben({ space: sicht }),
      unter: [z.kritisch ? `${z.kritisch} kritisch` : '', z.heuteFaellig ? `${z.heuteFaellig} heute fällig` : ''].filter(Boolean).join(' · ') || 'nichts brennt',
    },
    { id: 'freigaben', wert: String(z.freigaben), label: 'Freigaben', unter: z.freigaben ? 'warten auf dich' : 'nichts offen', ...(z.freigaben ? { bedeutung: 'achtung' as const } : {}), href: WEG.freigaben(undefined, sicht) },
  ];
  if (sicht === 'business' && z.followups > 0) liste.push({ id: 'followups', wert: String(z.followups), label: z.followups === 1 ? 'Follow-up fällig' : 'Follow-ups fällig', bedeutung: 'achtung', href: WEG.followup() });
  return liste;
}

/** Andere Karten von Heute melden hiermit, dass sich etwas geändert hat, das im Briefing steht (Top 3 festgelegt). */
export const HEUTE_GEAENDERT = 'make-heute-geaendert';
export const heuteGeaendert = (): void => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(HEUTE_GEAENDERT)); };

/** `vorgabe` (+ `vorgabeZahlen`): schon geladene Sätze und Zahlen als Startzustand (Render-Test, Vorschau) — im Betrieb leer, die Karte lädt dann selbst. */
export function BriefingKarte({ i, sicht, titel, vorgabe, vorgabeZahlen }: { i: number; sicht: TopBereich; titel?: string; vorgabe?: string[]; vorgabeZahlen?: BriefingZahlen }) {
  const [saetze, setSaetze] = useState<string[] | null | undefined>(vorgabe);
  const [zahlen, setZahlen] = useState<BriefingZahlen | null>(vorgabeZahlen ?? null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/heute/briefing?space=${sicht}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() as { saetze?: string[]; zahlen?: BriefingZahlen } : null;
      setSaetze(Array.isArray(d?.saetze) && d!.saetze!.length ? d!.saetze! : null);
      setZahlen(d?.zahlen && typeof d.zahlen === 'object' ? d.zahlen : null);
    } catch { setSaetze(prev => prev ?? null); }
  }, [sicht]);
  useEffect(() => { setSaetze(undefined); void laden(); }, [laden]);
  useEffect(() => {
    const frisch = () => { if (document.visibilityState === 'visible') void laden(); };
    const spaeter = () => { window.setTimeout(() => { void laden(); }, 600); };
    document.addEventListener('visibilitychange', frisch);
    window.addEventListener('focus', frisch);
    window.addEventListener(HEUTE_GEAENDERT, spaeter);
    return () => { document.removeEventListener('visibilitychange', frisch); window.removeEventListener('focus', frisch); window.removeEventListener(HEUTE_GEAENDERT, spaeter); };
  }, [laden]);

  if (saetze === null) return null; // der Bereich gehört nicht zu dieser Person oder nichts erreichbar — keine leere Karte
  return (
    <Karte i={i} akzent={SPACE_FARBE[sicht]}>
      <Ueberschrift farbe={SPACE_FARBE[sicht]} erklaerung="heute.briefing">{titel ?? `Tages-Briefing · ${SPACE_LABEL[sicht]}`}</Ueberschrift>
      {zahlen && <div style={{ marginBottom: 14 }}><Lage eintraege={briefingLage(zahlen, sicht)} label={`Lage heute · ${SPACE_LABEL[sicht]}`} /></div>}
      {saetze === undefined ? <Leer>lade …</Leer> : <p style={{ margin: 0, fontSize: TYP.body, lineHeight: 1.6, color: zahlen ? C.inkDim : C.ink }}>{saetze.join(' ')}</p>}
    </Karte>
  );
}
