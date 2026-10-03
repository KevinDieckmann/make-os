'use client';

// ─── Der Entwurf der Scoring-Einstellungen (Hook, 03.10.) ──────────────────────────────────────
// Lädt die Einstellungen von /api/crm/scoring, hält die Änderungen als Entwurf (nichts wirkt, bevor es gespeichert ist), prüft
// live (`scoringPruefen`), speichert mit Stand (409 → neu geladen, nichts überschrieben) und sichert den Entwurf im Browser,
// damit ein Seitenwechsel nichts kostet. „Vorschlag übernehmen“, „auf Standard zurück“ und „letzte Änderung zurücknehmen“
// schreiben sofort (mit Stand) — der Dialog zeigt vorher die Wirkung auf die vorhandenen Leads.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scoringPruefen, type ScoringEinstellungen, type ScoringFehler, type MessungId } from '@/lib/crm/scoring';
import { istGeaendert, kopie } from '@/lib/crm/scoring-bearbeiten';
import type { CrmApi } from '../daten';

export interface ScoringDaten {
  einstellungen: ScoringEinstellungen; stand: string; standard: ScoringEinstellungen; vorschlag: ScoringEinstellungen;
  messungen: { id: MessungId; label: string; hinweis: string; stufen: { id: string; text: string }[] }[];
  verlauf: { am: string; von: string; quelle: string; was: string }[]; zurueckMoeglich: boolean;
}
const MERKER = 'quali-scoring-entwurf';

export function useScoringEntwurf(api: CrmApi) {
  const [daten, setDaten] = useState<ScoringDaten | null>(null);
  const [entwurf, setEntwurfRoh] = useState<ScoringEinstellungen | null>(null);
  const [fehler, setFehler] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [felder, setFelder] = useState<ScoringFehler[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [wiederhergestellt, setWiederhergestellt] = useState(false);
  const datenRef = useRef<ScoringDaten | null>(null);
  datenRef.current = daten;

  const laden = useCallback(async (behalteEntwurf = false) => {
    try {
      const r = await fetch('/api/crm/scoring', { cache: 'no-store' }).then(x => x.json());
      if (!r?.ok) { setFehler(r?.fehler ?? 'Die Einstellungen sind nicht erreichbar.'); return; }
      const d = r as ScoringDaten & { ok: boolean };
      setDaten(d);
      setEntwurfRoh(alt => {
        if (behalteEntwurf && alt) return alt;
        // Ein gesicherter Entwurf von vorhin (anderer Reiter, Seitenwechsel) kommt zurück, wenn er auf demselben Stand beruht.
        try {
          const m = sessionStorage.getItem(MERKER);
          const gesichert = m ? JSON.parse(m) as { stand: string; entwurf: ScoringEinstellungen } : null;
          if (gesichert && gesichert.stand === d.stand && !scoringPruefen(gesichert.entwurf).length && istGeaendert(gesichert.entwurf, d.einstellungen)) { setWiederhergestellt(true); return gesichert.entwurf; }
        } catch { /* ohne Speicher: kein Rückholen */ }
        return kopie(d.einstellungen);
      });
      setFehler('');
    } catch { setFehler('Die Einstellungen sind nicht erreichbar.'); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const geaendert = !!(daten && entwurf && istGeaendert(entwurf, daten.einstellungen));
  const fehlerLive = useMemo(() => (entwurf ? scoringPruefen(entwurf) : []), [entwurf]);
  useEffect(() => {
    if (!daten || !entwurf) return;
    try { if (geaendert) sessionStorage.setItem(MERKER, JSON.stringify({ stand: daten.stand, entwurf })); else sessionStorage.removeItem(MERKER); } catch { /* egal */ }
  }, [geaendert, entwurf, daten]);
  // Ungespeichertes sichtbar machen: beim Neuladen oder Schließen des Tabs fragt der Browser nach.
  useEffect(() => {
    if (!geaendert) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [geaendert]);

  const setEntwurf = useCallback((f: (e: ScoringEinstellungen) => ScoringEinstellungen) => { setEntwurfRoh(alt => (alt ? f(alt) : alt)); setHinweis(''); setFelder([]); }, []);

  const senden = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    const d = datenRef.current;
    if (!d || laeuft) return false;
    setLaeuft(true); setFehler(''); setHinweis(''); setFelder([]);
    try {
      const r = await fetch('/api/crm/scoring', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, stand: d.stand }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }));
      if (r.ok) {
        try { sessionStorage.removeItem(MERKER); } catch { /* egal */ }
        setWiederhergestellt(false);
        await laden(false);
        void api.laden(true);
        return true;
      }
      if (r.konflikt) { setHinweis('Die Einstellungen wurden inzwischen von jemand anderem geändert — neu geladen. Bitte noch einmal.'); try { sessionStorage.removeItem(MERKER); } catch { /* egal */ } await laden(false); return false; }
      setFehler(r.fehler ?? 'Nicht gespeichert.'); setFelder(Array.isArray(r.felder) ? r.felder : []);
      return false;
    } finally { setLaeuft(false); }
  }, [laeuft, laden, api]);

  const speichern = useCallback(async () => { if (entwurf && (await senden({ aktion: 'speichern', einstellungen: entwurf }))) setHinweis('Gespeichert — Leads, Akte und Runde rechnen ab jetzt damit.'); }, [entwurf, senden]);
  const aktion = useCallback(async (a: 'vorschlag' | 'standard' | 'zurueck') => {
    if (await senden({ aktion: a })) setHinweis(a === 'vorschlag' ? 'Vorschlag übernommen — mit „Letzte Änderung zurücknehmen“ geht es zurück.' : a === 'standard' ? 'Auf den Standard zurückgesetzt.' : 'Letzte Änderung zurückgenommen.');
  }, [senden]);
  const verwerfen = useCallback(() => { if (datenRef.current) setEntwurfRoh(kopie(datenRef.current.einstellungen)); setFelder([]); setFehler(''); setHinweis(''); setWiederhergestellt(false); try { sessionStorage.removeItem(MERKER); } catch { /* egal */ } }, []);

  return { daten, entwurf, setEntwurf, geaendert, fehlerLive, fehler, hinweis, felder, laeuft, wiederhergestellt, speichern, aktion, verwerfen, laden };
}
export type ScoringEntwurf = ReturnType<typeof useScoringEntwurf>;
