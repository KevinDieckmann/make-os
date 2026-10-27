'use client';

// ─── Markttraktion · Social — Daten im Browser (26.10.2026) ──────────────────────────────────────────────────────────────────────────
// EIN Weg zu `/api/social`: laden, Einzel-Schritte schreiben (mit dem Stand aus der letzten Antwort), Import. Bei 409 übernimmt die Ansicht den
// aktuellen Bestand aus der Antwort und zeigt den Satz — die Eingabe bleibt im Formular stehen, bis sie erneut gespeichert wird.

import { useCallback, useEffect, useState } from 'react';
import type { SocialKanal, SocialFormat, SocialFolge, SocialPlattform } from '@/lib/social/typen';
import type { Befund } from '@/lib/social/pruefer';
import type { AutonomieErgebnis } from '@/lib/social/autonomie';
import type { KanalAnalyse, Wochenbericht } from '@/lib/social/analyse';
import type { ImportVorschau } from '@/lib/social/csv';
import type { ZielStand } from '@/lib/social/ziele';
import type { AutomatikLage } from '@/lib/social/server';

export type MitStand<T> = T & { stand: string };
export interface Lage {
  heute: string;
  ich: string | null;
  /** Kennungen, die der letzte Schreibschritt geändert bzw. neu angelegt hat (nur in der Antwort auf PATCH). */
  geaendert?: string[];
  kanaele: Record<string, { befunde: Befund[]; ziele: ZielStand[] }>;
  datei: { kanaele: MitStand<SocialKanal>[]; formate: MitStand<SocialFormat>[]; folgen: MitStand<SocialFolge>[] };
  folgen: Record<string, { befunde: Befund[]; weg: AutonomieErgebnis }>;
  analyse: Record<string, KanalAnalyse>;
  woche: Record<string, Wochenbericht>;
  /** Automatik (27.10.): je Folge und Plattform der Zustand, Verbindungen (ohne Token), Wege, letzte Läufe, freie Plätze. */
  automatik: AutomatikLage;
}

export interface SocialApi {
  lage: Lage | null;
  fehler: string | null;
  laden: () => Promise<void>;
  /** Einzel-Schritte schreiben; die neue Lage = gespeichert, null = nicht gespeichert (Satz in `fehler`). */
  schreiben: (ops: unknown[]) => Promise<Lage | null>;
  importieren: (aktion: 'import-vorschau' | 'import', kanalId: string, plattform: SocialPlattform, text: string, stand: string, zuordnung?: Record<string, string>) => Promise<{ vorschau?: ImportVorschau; uebernommen?: number; uebersprungen?: number } | null>;
  setFehler: (f: string | null) => void;
  /** Automatik-Aktionen (Entwürfe schreiben, Verbinden, Trennen) — die Antwort trägt die neue Lage. */
  aktion: (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
}

export function useSocial(): SocialApi {
  const [lage, setLage] = useState<Lage | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/social', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Social konnte nicht geladen werden.'); return; }
      setLage(j as Lage);
    } catch { setFehler('Keine Verbindung — bitte gleich noch einmal.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const schreiben = useCallback(async (ops: unknown[]) => {
    try {
      const r = await fetch('/api/social', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ops }) });
      const j = await r.json();
      if (j.datei) setLage(j as Lage);
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht gespeichert.'); return null; }
      setFehler(null);
      return j as Lage;
    } catch { setFehler('Keine Verbindung — nicht gespeichert.'); return null; }
  }, []);
  const importieren = useCallback<SocialApi['importieren']>(async (aktion, kanalId, plattform, text, stand, zuordnung) => {
    try {
      const r = await fetch('/api/social', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion, kanalId, plattform, text, stand, zuordnung }) });
      const j = await r.json();
      if (j.datei) setLage(j as Lage);
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Import nicht möglich.'); return j.vorschau ? { vorschau: j.vorschau } : null; }
      setFehler(null);
      return j;
    } catch { setFehler('Keine Verbindung — nichts übernommen.'); return null; }
  }, []);
  const aktion = useCallback<SocialApi['aktion']>(async body => {
    try {
      const r = await fetch('/api/social', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.datei) setLage(j as Lage);
      if (!r.ok || !j.ok) { setFehler(j.fehler ?? 'Nicht möglich.'); return null; }
      setFehler(null);
      return j;
    } catch { setFehler('Keine Verbindung — bitte gleich noch einmal.'); return null; }
  }, []);
  return { lage, fehler, laden, schreiben, importieren, setFehler, aktion };
}

/** Komma- oder zeilengetrennte Wortliste aus einem Eingabefeld. */
export const woerterAus = (s: string) => s.split(/[,\n]/).map(x => x.trim()).filter(Boolean);
