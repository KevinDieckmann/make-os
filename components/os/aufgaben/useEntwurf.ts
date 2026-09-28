'use client';
// ─── Entwurf einer Notiz/Beschreibung (29.09., A3) ──────────────────────────
// Vorher speicherte die Notiz nur bei „Fertig“ oder ⌘+Enter — Tab zu, Seite gewechselt, Akku leer: weg. Jetzt:
//   · beim Tippen nach kurzer Pause (Autosave), beim Verlassen des Feldes (`onBlur`) und beim Verlassen der Seite sofort,
//   · jeder Tastendruck liegt zusätzlich als Entwurf im Sitzungsspeicher (je Kennung) — der Server bleibt die Wahrheit,
//     der Entwurf ist nur der Puffer: bestätigt der Server den Text (Zeile nicht mehr ausstehend, Wert = Text), fällt er weg,
//   · über der Grenze wird NICHT gespeichert, aber sichtbar gemeldet — der Text bleibt (nie still kürzen),
//   · solange etwas nicht gespeichert ist, warnt der Browser beim Schließen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTasks } from '@/context/TasksContext';
import type { ListenArt } from '@/lib/aufgaben/abgleich';

const SCHLUESSEL = 'make-entwurf:';
const lies = (k: string): string | null => { try { return window.sessionStorage.getItem(SCHLUESSEL + k); } catch { return null; } };
const schreibe = (k: string, v: string | null) => { try { if (v === null) window.sessionStorage.removeItem(SCHLUESSEL + k); else window.sessionStorage.setItem(SCHLUESSEL + k, v); } catch { /* voll/privat */ } };

export interface Entwurf {
  text: string;
  setText: (v: string) => void;
  /** Über der Grenze — wird nicht gespeichert (Meldung zeigen). */
  zuLang: boolean;
  /** Text weicht vom gespeicherten Wert ab (noch nicht übergeben). */
  ungespeichert: boolean;
  /** Beim Öffnen lag ein Entwurf aus dieser Sitzung vor, der vom gespeicherten Stand abweicht. */
  wiederhergestellt: boolean;
  /** Sofort übergeben (onBlur, „Fertig“). */
  jetzt: () => void;
  /** Entwurf verwerfen → gespeicherter Wert. */
  verwerfen: () => void;
  /** Wiederhergestellten Entwurf übernehmen (speichert ihn). */
  uebernehmen: () => void;
}

export function useEntwurf({ kennung, zeile, wert, speichern, max, verzoegerung = 1200 }: {
  /** Eindeutig je Feld, z. B. `aufgabe:<id>:notiz`. */
  kennung: string;
  /** Die Zeile im Aufgaben-Bestand — erst wenn der Server sie bestätigt hat, fällt der Entwurf weg. */
  zeile: { liste: ListenArt; id: string };
  wert: string | undefined;
  /** Übergibt den Text an den Bestand (der TasksContext speichert mit Stand/Warteschlange). */
  speichern: (v: string) => void;
  max: number;
  verzoegerung?: number;
}): Entwurf {
  const { istOffen, speicher } = useTasks();
  const gespeichert = wert ?? '';
  const [start] = useState(() => {
    const e = typeof window === 'undefined' ? null : lies(kennung);
    return e !== null && e !== gespeichert ? e : null;
  });
  const [text, setTextRoh] = useState(start ?? gespeichert);
  const [wiederhergestellt, setWiederhergestelltRoh] = useState(start !== null);
  /** Ein wiederhergestellter Entwurf geht erst auf ausdrückliches „Übernehmen“ (oder Weiterschreiben) raus — nie von selbst. */
  const wiederRef = useRef(start !== null);
  const setWiederhergestellt = (v: boolean) => { wiederRef.current = v; setWiederhergestelltRoh(v); };
  /** Was zuletzt übergeben wurde (bzw. vom Server kam) — weicht der Text davon ab, ist er in Arbeit. */
  const uebergeben = useRef(start === null ? gespeichert : null as string | null);
  const uhr = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const textRef = useRef(text); textRef.current = text;
  const speichernRef = useRef(speichern); speichernRef.current = speichern;
  const zuLang = text.length > max;

  // Neuer Wert von außen (anderes Gerät, Abgleich): übernehmen, solange hier nichts in Arbeit ist.
  useEffect(() => {
    if (!wiederRef.current && textRef.current === uebergeben.current) {
      uebergeben.current = gespeichert;
      setTextRoh(gespeichert);
    }
  }, [gespeichert]);

  const jetzt = useCallback(() => {
    clearTimeout(uhr.current);
    const t = textRef.current;
    if (wiederRef.current || t.length > max || t === uebergeben.current) return;
    uebergeben.current = t;
    speichernRef.current(t);
  }, [max]);

  const setText = useCallback((v: string) => {
    setTextRoh(v);
    textRef.current = v;
    if (wiederRef.current) { wiederRef.current = false; setWiederhergestelltRoh(false); uebergeben.current = null; }
    schreibe(kennung, v);
    clearTimeout(uhr.current);
    uhr.current = setTimeout(jetzt, verzoegerung);
  }, [kennung, jetzt, verzoegerung]);

  // Entwurf löschen, sobald der Server genau diesen Text bestätigt hat.
  useEffect(() => {
    if (text === gespeichert && !istOffen(zeile.liste, zeile.id) && lies(kennung) !== null) schreibe(kennung, null);
  }, [text, gespeichert, istOffen, zeile.liste, zeile.id, kennung, speicher.offen, speicher.phase]);

  // Verlassen der Seite/des Feldes: sofort übergeben; Warnung, solange etwas offen ist.
  useEffect(() => {
    const warnen = (e: BeforeUnloadEvent) => {
      // Offen: über der Grenze, wiederhergestellter Entwurf oder noch nicht übergeben — übergeben, was geht, und warnen.
      if (textRef.current === gespeichert && !wiederRef.current) return;
      jetzt();
      e.preventDefault();
      e.returnValue = '';
    };
    const verdeckt = () => { if (document.visibilityState === 'hidden') jetzt(); };
    window.addEventListener('beforeunload', warnen);
    window.addEventListener('pagehide', jetzt);
    document.addEventListener('visibilitychange', verdeckt);
    return () => { window.removeEventListener('beforeunload', warnen); window.removeEventListener('pagehide', jetzt); document.removeEventListener('visibilitychange', verdeckt); };
  }, [jetzt, gespeichert]);
  // Abbau (Reiter gewechselt, Aufgabe zu): was offen ist, geht jetzt raus.
  useEffect(() => () => { if (uhr.current) { clearTimeout(uhr.current); jetzt(); } }, [jetzt]);

  const verwerfen = useCallback(() => {
    clearTimeout(uhr.current);
    schreibe(kennung, null);
    setWiederhergestellt(false);
    uebergeben.current = gespeichert;
    textRef.current = gespeichert;
    setTextRoh(gespeichert);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kennung, gespeichert]);
  const uebernehmen = useCallback(() => { setWiederhergestellt(false); uebergeben.current = null; jetzt(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jetzt]);

  return { text, setText, zuLang, ungespeichert: text !== gespeichert, wiederhergestellt, jetzt, verwerfen, uebernehmen };
}
