'use client';

// ─── Netzwerken — Haken der Oberfläche (02.10.) ──────────────────────────────
//   useKontext         wer ist im Haushalt (für „zuständig“, Termin beim anderen) — GET /api/netzwerken, zuletzt Gesehenes als Rückfall
//   useWarteschlange   die lokale Warteschlange (IndexedDB) für die Anzeige auf der Netzwerken-Seite. Das automatische Senden (beim
//                      Öffnen, `online`, Sichtbarkeit, alle 30 Sekunden) macht seit 03.10. der Sender im /os-Rahmen (Sender.tsx) auf
//                      JEDER Seite — beide teilen EINE Warteschlange (`geteilteWarteschlange`)

import { useCallback, useEffect, useRef, useState } from 'react';
import { geteilteWarteschlange, type Warteschlange, type WarteEintrag, type SendeErgebnis } from '@/lib/netzwerken/warteschlange';

export interface Person { id: string; name: string; kalender: boolean }
interface Kontext { ich: string | null; personen: Person[]; heute: string; geladen: boolean; offline: boolean }

const MERKER = 'make-os-netzwerken-kontext';

/** Heutiger Tag in Berlin — als Rückfall, solange der Server noch nicht geantwortet hat. */
export const heuteLokal = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function useKontext(): Kontext {
  const [k, setK] = useState<Kontext>({ ich: null, personen: [], heute: heuteLokal(), geladen: false, offline: false });
  useEffect(() => {
    let lebt = true;
    const laden = async () => {
      try {
        const r = await fetch('/api/netzwerken', { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if (!lebt) return;
        if (r.ok && d?.ok && Array.isArray(d.personen)) {
          const neu = { ich: String(d.ich), personen: d.personen as Person[], heute: String(d.heute ?? heuteLokal()), geladen: true, offline: false };
          setK(neu);
          try { window.localStorage.setItem(MERKER, JSON.stringify({ ich: neu.ich, personen: neu.personen })); } catch { /* ohne Speicher */ }
          return;
        }
        setK(alt => ({ ...alt, geladen: true }));
      } catch {
        if (!lebt) return;
        // Kein Netz: die Personen vom letzten Mal — so lässt sich auch dann erfassen (der Server prüft beim Senden).
        try {
          const m = JSON.parse(window.localStorage.getItem(MERKER) ?? 'null') as { ich?: string; personen?: Person[] } | null;
          if (m?.ich && Array.isArray(m.personen)) { setK({ ich: m.ich, personen: m.personen, heute: heuteLokal(), geladen: true, offline: true }); return; }
        } catch { /* ohne Speicher */ }
        setK(alt => ({ ...alt, geladen: true, offline: true }));
      }
    };
    void laden();
    const wieder = () => void laden();
    window.addEventListener('online', wieder);
    return () => { lebt = false; window.removeEventListener('online', wieder); };
  }, []);
  return k;
}

export interface QueueStand {
  eintraege: WarteEintrag[];
  laeuft: boolean;
  neuLaden: boolean;
  /** Antworten des Servers je Erfassung (z. B. die Kennung der Person für „Zur Person“). */
  antworten: Record<string, { kontaktId?: string; eventId?: string; hinweise?: string[]; zusammengefuehrt?: boolean; neu?: boolean; terminUid?: string; terminTag?: string; angebotId?: string; dealId?: string; followupId?: string }>;
}

export function useWarteschlange(beiGesendet?: (r: SendeErgebnis) => void) {
  const q = useRef<Warteschlange | null>(null);
  if (!q.current) q.current = geteilteWarteschlange();
  const [stand, setStand] = useState<QueueStand>({ eintraege: [], laeuft: false, neuLaden: false, antworten: {} });
  const rueck = useRef(beiGesendet); rueck.current = beiGesendet;
  const lebt = useRef(true);
  useEffect(() => { lebt.current = true; return () => { lebt.current = false; }; }, []);

  const gesehen = useRef(q.current.gesendetZahl);
  const lesen = useCallback(async () => {
    try {
      const w = q.current!;
      const e = await w.alle();
      if (!lebt.current) return;
      // Was der geteilte Sender (oder ein anderer Aufrufer) gesendet hat, steht in der Warteschlange selbst: Antworten, „neu laden“, Zähler.
      setStand(s => ({ ...s, eintraege: e, neuLaden: w.neuLadenNoetig || s.neuLaden, antworten: { ...s.antworten, ...(w.antworten as QueueStand['antworten']) } }));
      if (w.gesendetZahl !== gesehen.current) { gesehen.current = w.gesendetZahl; rueck.current?.({ gesendet: [], wartend: 0, fehler: 0, neuLaden: false, antworten: {} }); }
    } catch { /* IndexedDB nicht lesbar — die Anzeige bleibt */ }
  }, []);

  const senden = useCallback(async (): Promise<SendeErgebnis | null> => {
    if (lebt.current) setStand(s => ({ ...s, laeuft: true }));
    try {
      const r = await q.current!.senden();
      if (lebt.current) setStand(s => ({ ...s, laeuft: false, neuLaden: r.neuLaden || s.neuLaden, antworten: { ...s.antworten, ...Object.fromEntries(Object.entries(r.antworten).map(([k, v]) => [k, (v ?? {}) as QueueStand['antworten'][string]])) } }));
      await lesen();
      return r;
    } catch {
      if (lebt.current) setStand(s => ({ ...s, laeuft: false }));
      return null;
    }
  }, [lesen]);

  const ablegen = useCallback(async (koerper: Record<string, unknown>, anzeige: WarteEintrag['anzeige']) => {
    const e = await q.current!.ablegen(koerper, anzeige);
    await lesen();
    void senden();
    return e;
  }, [lesen, senden]);

  const erneut = useCallback(async (id: string) => { await q.current!.erneut(id); await lesen(); void senden(); }, [lesen, senden]);
  /** „Ohne Termin abschließen (stattdessen Follow-up)“ — dieselbe Erfassung, der Server schließt sie mit einem Follow-up ab. */
  const ohneTermin = useCallback(async (id: string) => { await q.current!.ohneTermin(id); await lesen(); void senden(); }, [lesen, senden]);
  const verwerfen = useCallback(async (id: string) => { await q.current!.verwerfen(id); await lesen(); }, [lesen]);

  // Anzeige: beim Öffnen lesen und bei jeder Änderung der geteilten Warteschlange (Sender im Rahmen, andere Aufrufer) nachziehen.
  // Gesendet wird vom Sender im /os-Rahmen — hier nur, was die Person selbst anstößt (Speichern, „Jetzt senden“, „Erneut“).
  useEffect(() => {
    void lesen();
    return q.current!.beiAenderung(() => { void lesen(); });
  }, [lesen]);

  const wartend = stand.eintraege.filter(e => e.status === 'wartet').length;
  const fehler = stand.eintraege.filter(e => e.status === 'fehler').length;
  return { ...stand, wartend, fehler, ablegen, senden, erneut, ohneTermin, verwerfen };
}
