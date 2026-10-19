// ─── MAKE OS · Reise + Fluss — die gemeinsamen Formen, Zustände und Bild-Typen (17.10., Kevins Miro-Standard für das ganze System) ─────────────
// Kevin 17.10.: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung. Dann sieht das ganze System gleich klar
// aus.“ — „Lieber wenig und klar, nichts doppelt.“ Ein Ablauf wird überall gleich gezeichnet (DESIGN_STANDARD.md › Prozess-Visualisierung):
//   · Reise = EINE Zeile der Stufen (Phasen, Etappen, Meilensteine), darunter je Stufe höchstens `KAESTCHEN_MAX` kurze Kästchen, Rauten dazwischen.
//   · Fluss = eine Stufe von oben nach unten mit festen Formen (Schritt, Nachricht, Entscheidung, Erinnerung, Termin).
// Hier stehen NUR die gemeinsamen Typen und die eine Fenster-Regel (rein, client-sicher, ohne Daten-Importe). Jeder Bereich rechnet seine Zeile in
// SEINEM Modell (Fulfillment lib/fulfillment/prozesse/reise-bild.ts, Kreislauf lib/crm/kreislauf-bild.ts, Einrichtung lib/make-one/onboarding-bild.ts,
// Planung lib/planung/kette-bild.ts) aus den vorhandenen Regeln — die Zeichnung (components/os/ui/reise/*) rechnet nichts.

/** Die festen Formen (die Bedeutung hängt an der Form, die Farbe kommt dazu). */
export type FlussForm = 'schritt' | 'nachricht' | 'entscheidung' | 'erinnerung' | 'termin';
export const FORM_NAME: Record<FlussForm, string> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Entscheidung', erinnerung: 'Erinnerung', termin: 'Termin' };
/** Zustand eines Kästchens bzw. Knotens: erledigt (✓) · hier (als Nächstes, Petrol) · offen · entfällt (durchgestrichen). */
export type KaestchenZustand = 'erledigt' | 'hier' | 'offen' | 'entfaellt';
/**
 * Zustand einer Stufe: fertig (✓) · jetzt („▾ Hier“) · offen (kommt noch) · `laeuft` = alle Stufen laufen zugleich (ein Kreislauf hat kein „Hier“ — Markttraktion):
 * die Stufe steht in ihrer eigenen Farbe da, ohne Marke. Einzeln neben anderen Stufen (Fulfillment, 19.10.): durchlaufen, darin läuft noch etwas nebenher.
 */
export type ReiseZustand = 'fertig' | 'jetzt' | 'offen' | 'laeuft';
export type Haengt = 'rot' | 'gelb';

/** So viele Kästchen zeigt eine Stufe in der Reise (Rest „+n“). */
export const KAESTCHEN_MAX = 4;

/**
 * Die Kästchen einer Stufe für die Reise: höchstens `KAESTCHEN_MAX`, als zusammenhängendes Stück — mit „hier“ (ein erledigter davor als Anschluss), in der
 * laufenden Stufe ab dem ersten offenen, sonst die ersten. Der Rest steht als „+n“. EINE Regel für alle Bereiche.
 */
export function sichtbareKaestchen<K extends { zustand: KaestchenZustand }>(alle: readonly K[], zustand: ReiseZustand): K[] {
  if (alle.length <= KAESTCHEN_MAX) return [...alle];
  const hier = alle.findIndex(k => k.zustand === 'hier');
  const offen = alle.findIndex(k => k.zustand === 'offen');
  const anker = hier >= 0 ? hier : zustand === 'jetzt' && offen >= 0 ? offen : 0;
  const start = Math.max(0, Math.min(anker - 1, alle.length - KAESTCHEN_MAX));
  return alle.slice(start, start + KAESTCHEN_MAX);
}

// ── Die Reise-Zeile (was components/os/ui/reise/ReiseBild.tsx zeichnet) ───────────────────────────────────────────────────────────────────

export interface BildKaestchen { id: string; titel: string; form?: FlussForm; zustand: KaestchenZustand; haengt?: Haengt; unter?: string }
export interface BildSpalte {
  id: string; nr: number; titel: string; zustand: ReiseZustand;
  /** Ein kurzer Zähler unter der Beschriftung („2 von 5“, „erledigt“). */
  unter?: string;
  haengt?: Haengt;
  /** Eigene Farbe der Stufe (nur bei `laeuft` — z. B. die Welt im Kreislauf); sonst trägt der Zustand die Farbe. */
  farbe?: string;
  kaestchen: readonly BildKaestchen[];
  mehr: number;
  /**
   * Die Raute zwischen dieser und der nächsten Stufe: Abstimmungspunkt (Fulfillment) bzw. Abhängigkeit (Planung). `gegebenText` = Wort für „gegeben“
   * (Vorgabe „vermerkt“), ohne Raute steht dort nur ein Pfeil „›“.
   */
  raute?: { titel: string; gegeben: boolean; hier?: boolean; haengt?: Haengt; gegebenText?: string };
  /** Das Band unter der Stufe: ein kurzer Satz (was beim Kunden liegt), `achtung` = es liegt etwas bei ihm, `intern` = diese Stufe sieht er nicht. */
  band?: { text?: string; achtung?: boolean; intern?: boolean };
  /**
   * Eigener Abschnitt der Reise (17.10. spät — Zusatzmodul im Fulfillment): Stufen mit demselben Abschnitt stehen als eigene Zeile mit Titel darunter — mit
   * eigenem „Hier“ und eigenem Faden (sie laufen neben den übrigen Stufen). Fehlt überall: die Reise ist wie bisher EINE Zeile.
   */
  abschnitt?: { id: string; titel: string };
}

/**
 * Die Abschnitte einer Reise (rein): zuerst die Stufen ohne Abschnitt, dann je Abschnitt seine Stufen (Reihenfolge des ersten Auftretens). Ohne Abschnitte
 * genau EIN Teil mit allen Stufen.
 */
export function reiseAbschnitte<S extends Pick<BildSpalte, 'abschnitt'>>(spalten: readonly S[]): { abschnitt: { id: string; titel: string } | null; spalten: S[] }[] {
  const raus: { abschnitt: { id: string; titel: string } | null; spalten: S[] }[] = [{ abschnitt: null, spalten: spalten.filter(s => !s.abschnitt) }];
  for (const s of spalten) {
    if (!s.abschnitt) continue;
    const da = raus.find(t => t.abschnitt?.id === s.abschnitt!.id);
    if (da) da.spalten.push(s); else raus.push({ abschnitt: s.abschnitt, spalten: [s] });
  }
  return raus[0].spalten.length || raus.length === 1 ? raus : raus.slice(1);
}

// ── Der Fluss einer Stufe (was components/os/ui/reise/Fluss.tsx zeichnet) ─────────────────────────────────────────────────────────────────

/**
 * Ein Knoten im Fluss — die Grundform; jeder Bereich hängt eigene Felder an (Fulfillment: Stelle, Freigabe …). `Selbst` = der Typ des Bereichs, damit der
 * Nein-Zweig dieselben Felder trägt.
 */
export interface FlussKnotenBild<Selbst = unknown> {
  id: string; titel: string; form: FlussForm; zustand: KaestchenZustand;
  haengt?: Haengt;
  /** Ein kurzer Satz darunter (Frist, „macht der Kunde“, „überfällig seit …“). */
  unter?: string;
  /** Eine Entscheidung (Raute mit ja/nein) — kein Abstimmungspunkt mit dem Kunden. */
  entscheid?: true;
  /** Raute: der Nein-Pfad als Erinnerung am Rand. */
  nein?: { titel: string; unter?: string };
  /** Ein wartender Schritt: die Erinnerung daneben. */
  erinnerung?: { titel: string; unter?: string };
  /** Der Nein-Zweig als echter Knoten (steht neben der Entscheidung, nicht noch einmal im Strang). */
  neinKnoten?: Selbst;
}
export type FlussTeilBild<K> =
  | { art: 'linie'; titel?: string; knoten: readonly K[] }
  | { art: 'gruppen'; gruppen: readonly { id: string; titel: string; erledigt: number; gesamt: number; knoten: readonly K[] }[] };
export interface FlussBild<K> {
  nr: number; titel: string;
  /** Der Startpunkt (Kreis): womit die Stufe beginnt. */
  start: { titel: string; unter?: string };
  teile: readonly FlussTeilBild<K>[];
  /** Die Raute am Ende der Stufe (Abstimmung bzw. „erreicht?“). */
  abstimmung?: K;
  /** Abschluss-Stellen (nur an der letzten Stufe). */
  abschluss: readonly K[];
  /** Wohin der Fluss danach geht (die nächste Stufe bzw. das Ende). */
  ende: { titel: string };
}
