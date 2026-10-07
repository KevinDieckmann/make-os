'use client';

// ─── MAKE OS — Planung: Ziele, Meilensteine, Einheiten laden und schreiben ──
// EIN Hook für alle Horizonte (Tag · Woche · Monat · Quartal · Jahr). Ziele und
// Meilensteine sind GETEILTE Bestände: seit 28.09. gehen sie nur als
// Einzeländerungen mit Stand raus (lib/make-one/liste-stand.ts) — Anlegen,
// Ändern, Rang, Erledigt, Löschen je Eintrag. Die Antwort trägt schon die
// Kaskade (Quartal/Monat/Woche/Tag aus dem Jahr); gezeigt wird Serverstand +
// noch offene eigene Änderungen. Veralteter Stand → 409, Hinweis, aktueller
// Stand sichtbar — nichts wird still überschrieben. Einheiten je Haushalt.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ListenSchreiber, type SchreibErgebnis } from '@/lib/make-one/liste-stand';
import { localDay } from '@/lib/zeit';
import { EINHEITEN_STANDARD } from '@/lib/planung/einheiten';
import { zeitraum, type Zeitraum } from '@/lib/planung/zeitraum';
import { ZIEL_HORIZONTE, type Meilenstein, type Ziel, type ZielHorizont } from '@/lib/planung/typen';
import { NEU_ANGEFANGEN } from '@/components/os/aufgaben/NeuAnfangen';
import type { BezuegeGeloest } from '@/lib/planung/bezuege';

/** Ein Ziel aus irgendeinem Horizont, kurz — für Brotkrumen, Auswahl und das Ziel-Detail (01.10.). */
export interface ZielKurz { id: string; titel: string; horizont: ZielHorizont; fortschritt: number; erledigt: boolean; /** Für Bezüge (07.10., Seil): Bereich, Kette, Archiv. */ space?: Ziel['space']; einheit?: string; oberzielId?: string; abgeleitetVon?: string; archiviertAm?: string }

export interface PlanungStand {
  heute: string;
  zr: Zeitraum;
  geladen: boolean;
  ziele: Ziel[];
  /** Alle Ziele des geteilten Bestands, alle Horizonte (nur lesen) — der Hook schreibt weiter nur den eigenen Horizont. */
  alleZiele: ZielKurz[];
  fokus: Record<string, string>;
  ms: Meilenstein[];
  einheiten: string[];
  persistZiele: (next: Ziel[]) => void;
  persistMs: (next: Meilenstein[]) => void;
  /** Wie persistMs, aber sofort gesendet und abwartbar (true = gespeichert) — für „Speichern & öffnen“. */
  persistMsJetzt: (next: Meilenstein[]) => Promise<boolean>;
  /**
   * Wie persistZiele, aber sofort gesendet und abwartbar (07.10., Seil): liefert, ob gespeichert, und beim Löschen, welche Bezüge
   * der Server gelöst hat (`bezuegeGeloest` — Meilensteine, Unterziele, Aufgaben, Projekte), damit „Rückgängig“ sie zurücksetzen kann.
   */
  persistZieleJetzt: (next: Ziel[]) => Promise<{ ok: boolean; bezuegeGeloest: BezuegeGeloest[] }>;
  /** Meilensteine frisch vom Server holen (z. B. nachdem ein gelöschtes Ziel ihren Ziel-Bezug gelöst hat). */
  msNeuLaden: () => Promise<void>;
  /** Die Ziele dieses Horizonts frisch holen (07.10.: nachdem „Rückgängig“ Unterzielen ihr Oberziel zurückgegeben hat). */
  zieleNeuLaden: () => Promise<void>;
  fokusSetzen: (schluessel: string, wert: string) => void;
  einheitAnlegen: (name: string) => Promise<string | null>;
  /** Hinweis nach einem abgelehnten Speichern (z. B. „inzwischen geändert“) — sonst null. */
  hinweis: string | null;
}

type ZielZeile = Ziel & { stand?: string };
const kurzVon = (z: Ziel, horizont: ZielHorizont): ZielKurz => ({
  id: z.id, titel: z.titel, horizont, fortschritt: z.erledigt ? 100 : z.fortschritt, erledigt: !!z.erledigt,
  ...(z.space ? { space: z.space } : {}), ...(z.einheit ? { einheit: z.einheit } : {}), ...(z.oberzielId ? { oberzielId: z.oberzielId } : {}),
  ...(z.abgeleitetVon ? { abgeleitetVon: z.abgeleitetVon } : {}), ...(z.archiviertAm ? { archiviertAm: z.archiviertAm } : {}),
});
type MsZeile = Meilenstein & { stand?: string };

/** Text für die Ansicht, wenn ein Speichern nicht durchging. */
function hinweisAus(e: SchreibErgebnis<unknown>): string | null {
  if (e.ok) return null;
  // Eine ausdrückliche Ablehnung (Kreis, zu viele Vorgänger, Grenze) nennt den Grund — nicht „jemand hat geändert“.
  if (e.fehler?.startsWith('Abgelehnt')) return e.fehler;
  if (e.status === 409) return 'Jemand hat inzwischen geändert — der aktuelle Stand ist geladen, bitte noch einmal.';
  return e.fehler ?? 'Nicht gespeichert.';
}

const kopf = { 'Content-Type': 'application/json' };

/**
 * `aktiv = false` (30.09.): der Hook lädt nichts — für Bauteile, denen die Seite ihren Stand schon reicht
 * (Jahresplanung: EIN Stand für Zeitstrahl, Forecast und Listen, nichts doppelt geladen).
 */
export function usePlanung(horizont: ZielHorizont, aktiv = true): PlanungStand {
  const heute = localDay();
  const zr = useMemo(() => zeitraum(horizont, heute), [horizont, heute]);
  const [ziele, setZiele] = useState<ZielZeile[]>([]);
  const [alleZiele, setAlleZiele] = useState<ZielKurz[]>([]);
  const [fokus, setFokus] = useState<Record<string, string>>({});
  const [ms, setMs] = useState<MsZeile[]>([]);
  const [einheiten, setEinheiten] = useState<string[]>([...EINHEITEN_STANDARD]);
  const [geladen, setGeladen] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Nach „Neu anfangen“ oder Zurückholen (29.09.): neu laden.
  const [runde, setRunde] = useState(0);
  useEffect(() => { const neu = () => setRunde(r => r + 1); window.addEventListener(NEU_ANGEFANGEN, neu); return () => window.removeEventListener(NEU_ANGEFANGEN, neu); }, []);
  const zieleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const msTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fokusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Die aktuelle Sicht — Grundlage für „was hat die Person gerade geändert“. */
  const zieleRef = useRef<ZielZeile[]>([]);
  const msRef = useRef<MsZeile[]>([]);
  // Je Horizont ein Schreiber (Ziele) + einer für die Meilensteine.
  const zieleSchreiber = useMemo(() => new ListenSchreiber<ZielZeile>({
    pfad: '/api/state/ziele',
    koerper: ops => ({ horizont, ops }),
    liste: d => (Array.isArray(d[horizont]) ? (d[horizont] as ZielZeile[]) : null),
  }), [horizont]);
  const msSchreiber = useMemo(() => new ListenSchreiber<MsZeile>({
    pfad: '/api/state/meilensteine',
    liste: d => (Array.isArray(d.meilensteine) ? (d.meilensteine as MsZeile[]) : null),
  }), []);
  /** `alleZiele` für den eigenen Horizont nachziehen (die anderen Horizonte bleiben, wie geladen). */
  const kurzSetzen = useCallback((l: readonly Ziel[]) => setAlleZiele(a => [...a.filter(z => z.horizont !== horizont), ...l.map(z => kurzVon(z, horizont))]), [horizont]);
  const zieleZeigen = useCallback((l: ZielZeile[]) => { zieleRef.current = l; setZiele(l); }, []);
  const msZeigen = useCallback((l: MsZeile[]) => { msRef.current = l; setMs(l); }, []);

  const ladeMs = useCallback((): Promise<void> => fetch('/api/state/meilensteine', { cache: 'no-store' }).then(r => r.json()).then(d => {
    if (!Array.isArray(d.meilensteine)) return;
    msSchreiber.kenne(d.meilensteine);
    msZeigen(msSchreiber.sicht() ?? d.meilensteine);
  }).catch(() => {}), [msSchreiber, msZeigen]);

  /**
   * Die Ziele frisch holen (nur die Liste, nie den Fokus): der Server rechnet den Fortschritt der Ziele aus ihren Meilensteinen
   * nach (30.09.) — ohne Nachladen zeigte die Liste den alten Wert und der nächste Schreibversuch am Ziel bekäme ein 409 (01.10.).
   */
  const ladeZiele = useCallback((): Promise<void> => fetch('/api/state/ziele', { cache: 'no-store' }).then(r => r.json()).then(d => {
    const l: ZielZeile[] = Array.isArray(d[horizont]) ? d[horizont] : [];
    zieleSchreiber.kenne(l);
    zieleZeigen(zieleSchreiber.sicht() ?? l);
    kurzSetzen(l);
  }).catch(() => {}), [horizont, kurzSetzen, zieleSchreiber, zieleZeigen]);

  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    setGeladen(false);
    fetch('/api/state/ziele', { cache: 'no-store' }).then(r => r.json()).then(d => {
      if (!lebt) return;
      const l: ZielZeile[] = Array.isArray(d[horizont]) ? d[horizont] : [];
      zieleSchreiber.kenne(l);
      zieleZeigen(zieleSchreiber.sicht() ?? l);
      setFokus(d.fokus && typeof d.fokus === 'object' ? d.fokus : {});
      setAlleZiele(ZIEL_HORIZONTE.flatMap(h => (Array.isArray(d[h]) ? (d[h] as Ziel[]) : []).map(z => kurzVon(z, h))));
      setGeladen(true);
    }).catch(() => { if (lebt) setGeladen(true); });
    ladeMs();
    fetch('/api/planung/einheiten').then(r => r.json()).then(d => { if (lebt && Array.isArray(d.einheiten)) setEinheiten(d.einheiten); }).catch(() => {});
    return () => { lebt = false; };
  }, [aktiv, horizont, ladeMs, zieleSchreiber, zieleZeigen, runde]);

  /** Die Ansicht reicht die neue Liste — hier wird daraus je Ziel eine Änderung (nie der ganze Horizont). */
  const persistZiele = useCallback((next: Ziel[]) => {
    if (!zieleSchreiber.geladen) return; // ohne bekannten Stand wird nichts geschrieben
    // Ein gelöschtes Ziel löst am Server den Ziel-Bezug seiner Meilensteine (01.10.) — danach neu laden (sonst 409 beim nächsten Schreiben).
    const loescht = next.length < zieleRef.current.length;
    zieleSchreiber.aendern(zieleRef.current, next as ZielZeile[]);
    zieleZeigen(next as ZielZeile[]);
    kurzSetzen(next);
    clearTimeout(zieleTimer.current);
    zieleTimer.current = setTimeout(() => {
      void zieleSchreiber.senden().then(e => {
        setHinweis(hinweisAus(e));
        if (e.sicht && !e.nichts) zieleZeigen(e.sicht);
        // Termin-Ziele des Jahres sind Meilensteine geworden — den Stand nachladen.
        if (e.ok && !e.nichts && (horizont === 'jahr' || loescht)) void ladeMs();
        if (e.sicht) kurzSetzen(e.sicht);
      });
    }, 500);
  }, [horizont, kurzSetzen, ladeMs, zieleSchreiber, zieleZeigen]);

  const persistZieleJetzt = useCallback(async (next: Ziel[]) => {
    if (!zieleSchreiber.geladen) return { ok: false, bezuegeGeloest: [] };
    zieleSchreiber.aendern(zieleRef.current, next as ZielZeile[]);
    zieleZeigen(next as ZielZeile[]);
    kurzSetzen(next);
    clearTimeout(zieleTimer.current);
    const e = await zieleSchreiber.senden();
    setHinweis(hinweisAus(e));
    if (e.sicht && !e.nichts) { zieleZeigen(e.sicht); kurzSetzen(e.sicht); }
    if (e.ok && !e.nichts) void ladeMs();
    const g = e.antwort?.bezuegeGeloest;
    return { ok: e.ok, bezuegeGeloest: Array.isArray(g) ? (g as BezuegeGeloest[]) : [] };
  }, [kurzSetzen, ladeMs, zieleSchreiber, zieleZeigen]);

  const persistMs = useCallback((next: Meilenstein[]) => {
    if (!msSchreiber.geladen) return;
    msSchreiber.aendern(msRef.current, next as MsZeile[]);
    msZeigen(next as MsZeile[]);
    clearTimeout(msTimer.current);
    msTimer.current = setTimeout(() => {
      void msSchreiber.senden().then(e => {
        setHinweis(hinweisAus(e));
        if (e.sicht && !e.nichts) msZeigen(e.sicht);
        if (e.ok && !e.nichts) void ladeZiele();
      });
    }, 500);
  }, [msSchreiber, msZeigen, ladeZiele]);

  const persistMsJetzt = useCallback(async (next: Meilenstein[]) => {
    if (!msSchreiber.geladen) return false;
    msSchreiber.aendern(msRef.current, next as MsZeile[]);
    msZeigen(next as MsZeile[]);
    clearTimeout(msTimer.current);
    const e = await msSchreiber.senden();
    setHinweis(hinweisAus(e));
    if (e.sicht && !e.nichts) msZeigen(e.sicht);
    if (e.ok && !e.nichts) void ladeZiele();
    return e.ok;
  }, [msSchreiber, msZeigen, ladeZiele]);

  // Beim Verlassen: Offenes noch senden (die Absichten liegen im Schreiber).
  useEffect(() => () => {
    clearTimeout(zieleTimer.current); clearTimeout(msTimer.current);
    if (zieleSchreiber.hatOffenes) void zieleSchreiber.senden();
    if (msSchreiber.hatOffenes) void msSchreiber.senden();
  }, [zieleSchreiber, msSchreiber]);

  const fokusSetzen = useCallback((schluessel: string, wert: string) => {
    setFokus(a => ({ ...a, [schluessel]: wert }));
    clearTimeout(fokusTimer.current);
    fokusTimer.current = setTimeout(() => {
      fetch('/api/state/ziele', { method: 'PUT', headers: kopf, body: JSON.stringify({ horizont: schluessel, fokus: wert }) }).catch(() => {});
    }, 600);
  }, []);

  const einheitAnlegen = useCallback(async (name: string): Promise<string | null> => {
    try {
      const r = await fetch('/api/planung/einheiten', { method: 'POST', headers: kopf, body: JSON.stringify({ name }) });
      const d = await r.json();
      if (!r.ok || !d.einheit) return null;
      if (Array.isArray(d.einheiten)) setEinheiten(d.einheiten);
      return d.einheit as string;
    } catch { return null; }
  }, []);

  return { heute, zr, geladen, ziele, alleZiele, fokus, ms, einheiten, persistZiele, persistMs, persistMsJetzt, persistZieleJetzt, msNeuLaden: ladeMs, zieleNeuLaden: ladeZiele, fokusSetzen, einheitAnlegen, hinweis };
}
