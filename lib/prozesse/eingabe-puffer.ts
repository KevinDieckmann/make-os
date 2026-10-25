// ─── Prozesse · Werkstatt — Eingaben beim Tippen übernehmen (Feinschliff 24.10., Bau-Test: „Betreff erst beim Verlassen übernommen, Kopf sagt schon gespeichert“) ──
// Regel (Kevin, Runde 2): jedes Text- und Zahlenfeld der Werkstatt (Panel, großes Fenster) übernimmt beim Tippen — entprellt (`TIPP_PAUSE_MS`) — und sofort beim
// Verlassen, Schließen und `pagehide`; „Entwurf gespeichert“ steht erst, wenn der Server geantwortet hat UND kein Feld mehr Getipptes hält.
//   · `eingabePuffer`  EIN Feld: tippen → nach der Pause übernehmen; `jetzt()` übernimmt sofort; ein Wert von außen ersetzt nur, solange nichts Getipptes offen ist.
//   · `speicherAnzeige` was der Kopf zeigt (Zustand des Speicherns + offene Eingaben).
//   · `zielPuffer`     (24.10.) ein Feld für wechselnde Ziele: jeder offene Wert geht nur an SEIN Ziel (Knoten + Feld), auch nach dem Wechsel der Auswahl.
// Rein und client-sicher (eigene Uhr für Tests); die Werkstatt hängt es über `useTippen` (components/os/prozesse/WerkstattMaske.tsx) an die Felder.

/** So lange nach dem letzten Tastendruck wird übernommen (ms) — kurz genug für „sofort“, lang genug, dass nicht jeder Buchstabe eine Fassung wird. */
export const TIPP_PAUSE_MS = 700;

/** Eine Uhr (im Browser `window.setTimeout`; Tests: eine eigene). */
export interface Uhr { setze: (f: () => void, ms: number) => unknown; loesche: (h: unknown) => void }
const UHR: Uhr = { setze: (f, ms) => setTimeout(f, ms), loesche: h => clearTimeout(h as ReturnType<typeof setTimeout>) };

export interface PufferOptionen {
  /** Der Wert, wie er gerade gespeichert ist (Anfang). */
  anfang: string;
  /** Übernehmen (nur, wenn sich etwas geändert hat und `gueltig` ja sagt). */
  uebernehmen: (v: string) => void;
  /** Darf dieser Text übernommen werden? (z. B. ein Name nie leer) — sonst bleibt er offen, bis er passt bzw. das Feld verlassen wird. */
  gueltig?: (v: string) => boolean;
  /** Meldet, ob gerade Getipptes offen ist (Kopf: „wird übernommen …“, pagehide). */
  onOffen?: (offen: boolean) => void;
  ms?: number;
  /** Ohne Uhr: nur `jetzt()` übernimmt (Felder außerhalb der Werkstatt, deren Übernahme einen Text der Vorgabe zurückbringt — z. B. Landkarte anpassen). */
  ohneUhr?: boolean;
  uhr?: Uhr;
}
export interface Puffer {
  /** Ein Tastendruck: der neue Text des Felds. */
  tippe: (v: string) => void;
  /** Sofort übernehmen (Verlassen, Enter, Schließen, pagehide). Liefert, ob übernommen wurde. */
  jetzt: () => boolean;
  /** Ein Wert von außen (Server, Rückgängig): ersetzt den Text nur, wenn nichts Getipptes offen ist. Liefert den Text, den das Feld zeigen soll. */
  vonAussen: (v: string) => string;
  /** Ist Getipptes offen (noch nicht übernommen)? */
  offen: () => boolean;
  /** Der Text, den das Feld gerade zeigt. */
  text: () => string;
  /** Uhr anhalten (Feld verschwindet — vorher `jetzt()`). */
  stopp: () => void;
}

/** Der Puffer eines Felds (siehe Kopf). */
export function eingabePuffer(o: PufferOptionen): Puffer {
  const uhr = o.uhr ?? UHR;
  const ms = o.ms ?? TIPP_PAUSE_MS;
  let gesendet = o.anfang;
  let text = o.anfang;
  let h: unknown = null;
  let warOffen = false;
  const melde = () => { const jetztOffen = text !== gesendet; if (jetztOffen !== warOffen) { warOffen = jetztOffen; o.onOffen?.(jetztOffen); } };
  const halt = () => { if (h !== null) { uhr.loesche(h); h = null; } };
  const jetzt = (): boolean => {
    halt();
    if (text === gesendet || (o.gueltig && !o.gueltig(text))) { melde(); return false; }
    gesendet = text;
    melde();
    o.uebernehmen(text);
    return true;
  };
  return {
    tippe: v => {
      text = v;
      halt();
      if (text !== gesendet && !o.ohneUhr) h = uhr.setze(() => { h = null; jetzt(); }, ms);
      melde();
    },
    jetzt,
    vonAussen: v => {
      if (text === gesendet) text = v;
      gesendet = v;
      melde();
      return text;
    },
    offen: () => text !== gesendet,
    text: () => text,
    stopp: halt,
  };
}

/**
 * Ein Feld, das nacheinander verschiedenen Zielen gehört (Kern-Bau-Test 24.10.: „Text landet im Titel eines anderen Schritts“) — z. B. das Namensfeld einer Phase,
 * dessen Panel beim Wechsel der Auswahl stehen bleibt. Regel: jeder ausstehende Wert trägt SEIN Ziel (Kennung des Knotens + Feld) und wird nur dorthin übernommen —
 * beim Wechsel sofort (vor dem neuen Wert), bei Ablauf der Pause, beim Verlassen, Schließen und `pagehide`. Ein neues Ziel beginnt mit seinem eigenen Wert.
 */
export interface ZielPuffer extends Puffer {
  /** Das Feld gehört jetzt `ziel` mit dem gespeicherten Wert `wert`: Offenes geht vorher an das bisherige Ziel. Liefert den Text, den das Feld zeigen soll. */
  wechsel: (ziel: string, wert: string) => string;
  /** Wem das Feld gerade gehört. */
  ziel: () => string;
}
export function zielPuffer(o: Omit<PufferOptionen, 'uebernehmen'> & { ziel: string; uebernehmen: (ziel: string, v: string) => void }): ZielPuffer {
  const neu = (ziel: string, anfang: string): Puffer => eingabePuffer({ ...o, anfang, uebernehmen: v => o.uebernehmen(ziel, v) });
  let ziel = o.ziel;
  let p = neu(ziel, o.anfang);
  return {
    tippe: v => p.tippe(v), jetzt: () => p.jetzt(), offen: () => p.offen(), text: () => p.text(), stopp: () => p.stopp(),
    vonAussen: v => p.vonAussen(v),
    wechsel: (z, wert) => {
      if (z === ziel) return p.vonAussen(wert);
      p.jetzt(); p.stopp();
      ziel = z; p = neu(z, wert);
      return wert;
    },
    ziel: () => ziel,
  };
}

/** Wie der Speicher-Zustand der Werkstatt heißt (Werkstatt.tsx `Speicher`). */
export type SpeicherArt = 'gespeichert' | 'ausstehend' | 'speichert' | 'fehler' | 'konflikt' | 'offline';
/**
 * Was der Kopf zeigt (rein): solange ein Feld Getipptes hält, nie „gespeichert“ — sondern „wird übernommen …“ (`tippt`); Fehler, Konflikt und offline gehen vor
 * (die sagen mehr). Sonst der Zustand des Speicherns.
 */
export function speicherAnzeige(art: SpeicherArt, offeneEingaben: number): SpeicherArt | 'tippt' {
  if (art === 'fehler' || art === 'konflikt' || art === 'offline') return art;
  return offeneEingaben > 0 ? 'tippt' : art;
}
