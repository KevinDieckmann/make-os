'use client';

// ─── Kalender: Quellen „Feiertage NRW“ und „Geburtstage“ im Browser (29.09., Paket K2) ─
// Beide erscheinen als ganztägige, schreibgeschützte Einträge in ALLEN Ansichten (Tag · 4 Tage · Woche · Monat · Jahr ·
// Termine) — technisch als KTermin mit `quelle`, damit Raster, Monat und Liste sie ohne eigene Wege zeigen. Ein Klick
// öffnet NIE das Termin-Fenster: Geburtstag → Person/Kontaktakte (`href`), Feiertag → nichts (nur Hinweis).
// Ein-/Ausblenden wie jeder Kalender über den Namen (FEIERTAGE_KALENDER / GEBURTSTAGE_KALENDER), gemerkt im Browser.

import { useEffect, useMemo, useState } from 'react';
import { tagPlus } from '@/lib/kalender/zeit';
import { feiertageIm, FEIERTAGE_KALENDER, FEIERTAG_FARBE } from '@/lib/kalender/quellen-feiertage';
import { GEBURTSTAGE_KALENDER, GEBURTSTAG_FARBE, geburtstagTitel, type Geburtstag } from '@/lib/kalender/geburtstag';
import type { KTermin } from './teile';

export { FEIERTAGE_KALENDER, FEIERTAG_FARBE, GEBURTSTAGE_KALENDER, GEBURTSTAG_FARBE };

/** Ein Eintrag aus einer Quelle — ein KTermin mit Herkunft, Farbe, Ziel und Space. */
export type QuellTermin = KTermin & { quelle: 'feiertag' | 'geburtstag'; farbe: string; href?: string; space: 'privat' | 'business'; hinweis: string };

export const istQuellTermin = (t: KTermin): t is QuellTermin => typeof (t as Partial<QuellTermin>).quelle === 'string';

const ganztags = (tag: string) => ({ start: `${tag}T00:00:00`, ende: `${tagPlus(tag, 1)}T00:00:00`, ganztags: true, wer: 'beide' as const, serie: false, mitTeilnehmern: false, bearbeitbar: false });

/** Feiertage → Einträge (rein). */
export function feiertagsTermine(von: string, bis: string): QuellTermin[] {
  return feiertageIm(von, bis).map(f => ({
    id: `feiertag-${f.tag}`, uid: `feiertag-${f.tag}`, titel: f.name, kalender: FEIERTAGE_KALENDER, ...ganztags(f.tag),
    quelle: 'feiertag', farbe: FEIERTAG_FARBE, space: 'privat', hinweis: `Gesetzlicher Feiertag in NRW — schreibgeschützt`,
  }));
}

/** Geburtstage → Einträge (rein). */
export function geburtstagsTermine(liste: readonly Geburtstag[]): QuellTermin[] {
  return liste.map(g => ({
    id: `geburtstag-${g.id}`, uid: `geburtstag-${g.id}`, titel: `🎂 ${geburtstagTitel(g)}`, kalender: GEBURTSTAGE_KALENDER, ...ganztags(g.tag),
    quelle: 'geburtstag', farbe: GEBURTSTAG_FARBE, href: g.href, space: g.space,
    hinweis: `${g.herkunft === 'crm' ? 'Kontakt' : 'Familie'}${g.alter !== undefined && g.alter > 0 ? ` · wird ${g.alter}` : ''} — Klick öffnet ${g.herkunft === 'crm' ? 'die Kontaktakte' : 'die Person'}`,
  }));
}

/** Geburtstage eines Zeitraums vom Server (Familie + CRM, ohne Art.-18-Kontakte). */
export function useGeburtstage(von: string, bis: string, an = true): Geburtstag[] {
  const [liste, setListe] = useState<{ schluessel: string; g: Geburtstag[] }>({ schluessel: '', g: [] });
  const schluessel = `${von}|${bis}`;
  useEffect(() => {
    if (!an) return;
    let lebt = true;
    fetch(`/api/kalender/quellen?von=${von}&bis=${bis}`, { cache: 'no-store' }).then(r => r.json())
      .then(d => { if (lebt && d?.ok) setListe({ schluessel, g: Array.isArray(d.geburtstage) ? d.geburtstage : [] }); }).catch(() => {});
    return () => { lebt = false; };
  }, [von, bis, an, schluessel]);
  return an && liste.schluessel === schluessel ? liste.g : [];
}

/** Beide Quellen für den Zeitraum als Einträge. */
export function useQuellTermine(von: string, bis: string): QuellTermin[] {
  const g = useGeburtstage(von, bis);
  return useMemo(() => [...feiertagsTermine(von, bis), ...geburtstagsTermine(g)], [von, bis, g]);
}

/** Die zwei Quell-Kalender für die Seitenleiste (Name, Farbe, Hinweis). */
export const QUELL_KALENDER: { name: string; farbe: string; hinweis: string }[] = [
  { name: FEIERTAGE_KALENDER, farbe: FEIERTAG_FARBE, hinweis: 'gesetzlich, schreibgeschützt' },
  { name: GEBURTSTAGE_KALENDER, farbe: GEBURTSTAG_FARBE, hinweis: 'Familie + Kontakte' },
];
