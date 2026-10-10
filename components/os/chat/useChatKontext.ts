'use client';

// ─── Chat je Bereich: der Kontext der Seite für den Chat unten (10.10.) ────────────────────────────────────────────────────────────────
// Liest Pfad, Parameter und die Sicht des Kopfs und schlägt den passenden Head vor (rein: lib/agenten/kontext-head.ts). Welche Heads die
// Person nutzen DARF, sagt allein der Server (GET /api/agenten/chat?space=…, EINE Filterstelle lib/agenten/sicht.ts) — der Browser blendet
// nichts selbst aus, er fragt nur nach. Die Wahl „passender Head“/„immer ZOE“ liegt beim Server je Person (POST /api/agenten/chat).
// Geladen wird erst, wenn der Chat einmal offen war (`aktiv`) — vorher kostet der schwebende Knopf keine Anfrage.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSpace } from '@/hooks/useSpace';
import { CHAT_WAHL_VORGABE, kontextHeadFuer, seitenBezug, type ChatFehlt, type ChatHead, type ChatKontextAntwort, type ChatWahl } from '@/lib/agenten/kontext-head';
import type { CrmBezug } from '@/lib/zoe/crm-bezug';
import type { Bereich } from '@/lib/agenten/typen';

export interface ChatKontext {
  space: Bereich;
  /** Der Head, der zur Seite passt (Vorschlag) — oder null (ZOE). */
  vorschlag: string | null;
  /** Kontext der Seite (offener Kontakt, Firma, Deal, Angebot, Mandat) — nur Art + Kennung. */
  bezug: CrmBezug | null;
  /** Schlüssel der Seite (Pfad + Parameter) — ein Wechsel lässt einen weggeklickten Bezug wieder zu. */
  seite: string;
  heads: ChatHead[];
  wahl: ChatWahl;
  fehlt: Partial<Record<string, ChatFehlt>>;
  /** Die Antwort des Servers für DIESE Sicht ist da (vorher keine Hinweise zeigen). */
  bereit: boolean;
  setzeWahl: (w: ChatWahl) => Promise<boolean>;
}

export function useChatKontext(aktiv: boolean): ChatKontext {
  const pfad = usePathname() ?? '/os';
  const params = useSearchParams();
  const suche = params?.toString() ?? '';
  const { space } = useSpace();
  const vorschlag = useMemo(() => kontextHeadFuer(pfad, suche, space), [pfad, suche, space]);
  const bezug = useMemo(() => seitenBezug(pfad, suche), [pfad, suche]);
  const [daten, setDaten] = useState<{ space: Bereich; antwort: ChatKontextAntwort } | null>(null);
  const [wahl, setWahl] = useState<ChatWahl | null>(null);

  useEffect(() => {
    if (!aktiv) return;
    let lebt = true;
    fetch(`/api/agenten/chat?space=${space}`, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then((d: ChatKontextAntwort | null) => {
        if (!lebt) return;
        // Ohne Antwort (Netz, kein Agenten-Bereich für dieses Konto): keine Heads — dann antwortet ZOE, ohne Hinweis.
        setDaten({ space, antwort: d && d.ok ? d : { ok: true, heads: [], wahl: CHAT_WAHL_VORGABE, fehlt: {} } });
      })
      .catch(() => { if (lebt) setDaten({ space, antwort: { ok: true, heads: [], wahl: CHAT_WAHL_VORGABE, fehlt: {} } }); });
    return () => { lebt = false; };
  }, [aktiv, space]);

  const setzeWahl = useCallback(async (w: ChatWahl) => {
    const vorher = wahl;
    setWahl(w);
    try {
      const r = await fetch('/api/agenten/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wahl: w }) });
      if (!r.ok) throw new Error(String(r.status));
      return true;
    } catch {
      setWahl(vorher); // nicht gespeichert — die Anzeige geht zurück
      return false;
    }
  }, [wahl]);

  const antwort = daten && daten.space === space ? daten.antwort : null;
  return {
    space, vorschlag, bezug, seite: `${pfad}?${suche}`,
    heads: antwort?.heads ?? [],
    wahl: wahl ?? antwort?.wahl ?? CHAT_WAHL_VORGABE,
    fehlt: antwort?.fehlt ?? {},
    bereit: !!antwort,
    setzeWahl,
  };
}
