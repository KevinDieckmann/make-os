'use client';

// ─── Routinen 2 (10.10.) — Abhaken und Zählen, EIN Baustein für Gesundheit › Heute, das Heute-Widget und den Planer ───────────
// Einfache Routine: der Haken (wie bisher). Zähler / mehrmals täglich: „− 5/8 +“ — jeder Tipp ist EIN PATCH auf /api/state/health
// (`zaehler: 'plus' | 'minus'`); der Server zählt und setzt den Haken, sobald das Tagesziel erreicht ist (lib/planung/routinen-haken-server.ts).
// Nie mehr der ganze Log aus dem Browser — zwei Geräte überschreiben sich so nicht.

import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { HakenZiel, SymbolKnopf, LEUCHT } from '../ui';

export interface HakenAntwort { ok: boolean; tag?: string; erledigt?: string[]; ist?: number; ziel?: number; error?: string }

/** Eine Routine abhaken bzw. zählen. `zaehler` nur für Zähler-Routinen; sonst `erledigt`. Wirft nie — Fehler kommen als `ok: false`. */
export async function routineHakenSenden(routine: string, schritt: { erledigt: boolean } | { zaehler: 'plus' | 'minus' }, tag?: string): Promise<HakenAntwort> {
  try {
    const r = await fetch('/api/state/health', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routine, ...schritt, ...(tag ? { tag } : {}) }) });
    const d = (await r.json().catch(() => ({}))) as HakenAntwort;
    return r.ok ? { ...d, ok: true } : { ok: false, error: d.error ?? `Nicht gespeichert (${r.status}).` };
  } catch { return { ok: false, error: 'Keine Verbindung — nicht gespeichert.' }; }
}

/** Abhaken bzw. Zählen in einer Zeile: Haken bei Tagesziel 1, sonst „− ist/ziel +“ (44-px-Ziele). `aus` = nur ansehen (fremde Ansicht). */
export function RoutineSteuer({ label, ziel, ist, erledigt, aus, farbe = LEUCHT.gut, onHaken, onZaehlen }: {
  label: string; ziel: number; ist: number; erledigt: boolean; aus?: boolean; farbe?: string;
  onHaken: () => void; onZaehlen: (s: 'plus' | 'minus') => void;
}) {
  if (ziel <= 1) return aus
    ? <span aria-label={`${label}: ${erledigt ? 'erledigt' : 'offen'}`} style={{ fontSize: TYP.bedien, color: erledigt ? LEUCHT.gut : C.inkLeise }}>{erledigt ? '✓' : '—'}</span>
    : <HakenZiel an={erledigt} farbe={farbe} label={label} onChange={onHaken} />;
  const voll = ist >= ziel;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }} onClick={e => e.stopPropagation()}>
      {!aus && <SymbolKnopf ariaLabel={`${label}: eins weniger`} aus={ist <= 0} onClick={() => onZaehlen('minus')}>−</SymbolKnopf>}
      <span aria-live="polite" aria-label={`${label}: ${ist} von ${ziel}`} style={{ minWidth: 44, textAlign: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, fontVariantNumeric: 'tabular-nums', color: voll ? LEUCHT.gut : C.ink }}>
        {ist}<span style={{ color: C.inkLeise, fontWeight: 500 }}>/{ziel}</span>
      </span>
      {!aus && <SymbolKnopf ariaLabel={`${label}: eins mehr`} onClick={() => onZaehlen('plus')}>+</SymbolKnopf>}
    </span>
  );
}

/** „Streak 4 Tage“ — Einheit je Rhythmus (lib/planung/rhythmus.ts `routineStatistik`). Leer bei 0. */
export function streakText(streak: number, einheit: 'tag' | 'woche' | 'termin'): string {
  if (streak <= 0) return '';
  const wort = einheit === 'woche' ? (streak === 1 ? 'Woche' : 'Wochen') : einheit === 'termin' ? (streak === 1 ? 'Mal' : 'Mal') : (streak === 1 ? 'Tag' : 'Tage');
  return `Streak ${streak} ${wort}`;
}
