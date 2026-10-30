'use client';

// ─── Standard · Bereichsfarbe und „hier bist du“-Ring (31.10.) ─────────────────────────────────────────────────────────────────────────────
// Rückmeldung: „Überall, wenn wir irgendwo draufgehen, das Ganze so sichtbar wie hier bei der Selbstständigkeit — dann sehen wir immer direkt,
// wo wir sind, immer in den Farben, wie angemessen.“ Vorbild war der Tastatur-Fokusring (Kontur + weicher Schein). Seitdem trägt JEDE aktive
// Wahl (Pillen, Segmente, Reiter, Punkte der linken Leiste) diesen Ring — Klasse `ui-an` in app/globals.css, Farbe über `--an`/`--an-schein`.
// Ohne eigene Farbe einer Seite gilt die Farbe des Bereichs (Privat/Business, lib/make-one/space-regeln.ts SPACE_FARBE). Auch der Fokusring der
// Tastatur folgt dem Bereich (`--fokus` am <html>).
import { createContext, useContext, useEffect, type CSSProperties, type ReactNode } from 'react';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { FARBE as C } from '@/lib/make-one/design';

const Kontext = createContext<string | null>(null);

/** Farbe des aktuellen Bereichs (außerhalb der Hülle: das Aktiv-Türkis). */
export function useBereichFarbe(): string { return useContext(Kontext) ?? C.aktiv; }

/** Stellt die Farbe des Bereichs bereit und setzt sie für den Fokusring am <html>. Einmal in der Hülle (app/os/layout.tsx). */
export function BereichFarbeQuelle({ children }: { children: ReactNode }) {
  const { wahl } = useSpace();
  const farbe = SPACE_FARBE[wahl] ?? C.aktiv;
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--fokus', farbe);
    r.style.setProperty('--fokus-schein', `${farbe}26`);
  }, [farbe]);
  return <Kontext.Provider value={farbe}>{children}</Kontext.Provider>;
}

/** Inline-Variablen für den Ring einer aktiven Wahl (Farbe als #RRGGBB). */
export const anRing = (farbe: string): CSSProperties => ({ ['--an' as string]: farbe, ['--an-schein' as string]: `${farbe}2E` } as CSSProperties);
