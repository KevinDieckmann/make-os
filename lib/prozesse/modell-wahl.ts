// ─── Prozesse — welche Modelle ein Schritt wählen darf (Etappe B1, 21.10.; Kevin 21.10.: „später auch andere Anbieter, sobald angebunden“) ─────────
// KEINE eigene Modellliste: der Andockpunkt „Modell“ (Agenten-Schritt, Modell-Raute) nimmt
//   · die Modellstufe als Vorgabe (`AgentSchritt.modell` — Rollen wie im Anbieter-Tor: Mitarbeiter schnell, Head ausgewogen, Review stark,
//     lib/ki/modelle.ts `STUFE_JE_ROLLE`) — so wirkt ein Modellwechsel der Instanz (`stufenModelle`) automatisch und es bleibt günstig;
//   · optional ein bestimmtes angebundenes Modell (`modellWahl`) — die Auswahlquelle `modell` ist der vorhandene Katalog: je Zugang des Anbieter-Tors
//     mit Fähigkeit Text (lib/ki/anbieter.ts `KI_ANBIETER`) das Modell je Stufe der Instanz (lib/ki/modelle.ts `stufenModelle`, Namen aus `MODELLE`).
// Wählbar ist ein Zugang genau dann, wenn die vorhandene Regel `anbieterWaehlen` ihn für die KI-Kategorien des Schritts nähme (Datenschutzstufe je
// Kategorie, angebunden, Eintrag im Empfänger-/AVV-Register, AVV bei neuen Anbietern bzw. „streng“). Ein neuer Anbieter (Gemini, OpenAI …) erscheint,
// sobald er im Anbieter-Tor steht und Text kann. Ausgeführt wird weiter NUR über das EINE KI-Tor (`askText` mit `ki: {…}`) — die Mehr-Anbieter-Ausführung
// kommt später; hier nur Typ, Liste und Wählbarkeit. Rein; Tests: tests/prozesse-agent-baustein.test.ts.

import { KI_ANBIETER, anbieterWaehlen, istAnbieterId, type AnbieterId, type AnbieterZustand, type AuswahlGrund } from '@/lib/ki/anbieter';
import { MODELL_STUFEN, STUFE_JE_ROLLE, modellVon, type ModellStufe } from '@/lib/ki/modelle';
import type { AgentWer, Befund, KiKategorie, ModellWahl, ModelTier } from './definition';

export interface ModellOption extends ModellWahl {
  /** `<anbieter>:<modell>` — der Wert der Auswahl in der Maske. */
  schluessel: string;
  anbieterName: string;
  /** Anzeigename des Modells (Katalog lib/ki/modelle.ts), sonst die Kennung. */
  name: string;
  waehlbar: boolean;
  /** Warum nicht wählbar (ein Satz, ohne Werte). */
  grund?: string;
}

export const modellSchluessel = (w: Pick<ModellWahl, 'anbieter' | 'modell'>): string => `${w.anbieter}:${w.modell}`;

/** Die Vorgabe-Stufe eines Agenten-Schritts (Rollen des Anbieter-Tors): Head und ZOE ausgewogen, Skills und Fach-Agenten wie Mitarbeiter (schnell). */
export function stufeVorgabe(wer: AgentWer | null | undefined): ModelTier {
  return wer?.art === 'skill' || wer?.art === 'fach' ? STUFE_JE_ROLLE.mitarbeiter : STUFE_JE_ROLLE.head;
}

const GRUND_TEXT: Readonly<Record<AuswahlGrund, string>> = {
  'anbieter-stufe': 'erreicht die Datenschutzstufe der Daten dieses Schritts nicht',
  'kategorie-nicht-erlaubt': 'darf diese Daten nicht bekommen',
  'anbieter-nicht-eingerichtet': 'nicht angebunden (Einrichtung › KI-Anbieter)',
  'avv-offen': 'kein Eintrag bzw. kein bestätigter Auftragsverarbeitungsvertrag im Empfänger-Register',
  'anbieter-ausgefallen': 'gerade ausgefallen',
};

/**
 * Die Modelle der Instanz für den Andockpunkt „Modell“ (rein): je Zugang mit Fähigkeit Text und je Stufe das wirksame Modell der Instanz (`stufen` =
 * `stufenModelle(env, einstellung)`). Wählbar nach `anbieterWaehlen` mit genau diesem Zugang und den KI-Kategorien des Schritts. Alle Optionen kommen
 * zurück, nicht wählbare mit Grund.
 */
export function modellOptionen(e: {
  zustand: Partial<Record<AnbieterId, AnbieterZustand>>;
  stufen: Record<ModellStufe, string>;
  kategorien?: readonly KiKategorie[];
  streng?: boolean;
}): ModellOption[] {
  const raus: ModellOption[] = [];
  for (const a of KI_ANBIETER) {
    if (!a.faehigkeiten.includes('text')) continue;
    const w = anbieterWaehlen({ faehigkeit: 'text', kategorien: e.kategorien ?? [], zustand: e.zustand, streng: e.streng, route: [a.id] });
    for (const stufe of MODELL_STUFEN) {
      const modell = e.stufen[stufe];
      if (!modell) continue;
      raus.push({
        anbieter: a.id, modell, stufe: stufe as ModelTier, schluessel: modellSchluessel({ anbieter: a.id, modell }), anbieterName: a.name,
        name: modellVon(modell)?.name ?? modell, waehlbar: w.ok, ...(!w.ok ? { grund: GRUND_TEXT[w.grund] } : {}),
      });
    }
  }
  return raus;
}

/**
 * Eine Modell-Wahl aus der Eingabe prüfen (rein): Form (Anbieter, Kennung, Stufe) → sonst `fehler`; nicht (mehr) in der Liste der Instanz bzw. nicht
 * wählbar → `offen` (der Entwurf bleibt, veröffentlicht wird erst mit einem wählbaren Modell — oder ohne Wahl: dann gilt die Stufe). Ohne Liste nur die Form.
 */
export function modellWahlAus(roh: unknown, optionen?: readonly ModellOption[] | null, knotenId?: string): { wahl: ModellWahl | null; befunde: Befund[] } {
  if (roh === undefined || roh === null || roh === '') return { wahl: null, befunde: [] };
  const b = (stufe: Befund['stufe'], text: string): Befund => ({ stufe, text: `Modell: ${text}`, feld: 'modellWahl', ...(knotenId ? { knotenId } : {}) });
  const o = typeof roh === 'object' && !Array.isArray(roh) ? roh as Record<string, unknown> : null;
  const stufe = o?.stufe;
  if (!o || !istAnbieterId(o.anbieter) || typeof o.modell !== 'string' || !/^[a-z0-9][a-z0-9._@-]{1,80}$/.test(o.modell) || !(MODELL_STUFEN as readonly string[]).includes(stufe as string)) {
    return { wahl: null, befunde: [b('fehler', 'Anbieter, Modell und Stufe aus der Liste der Instanz.')] };
  }
  const wahl: ModellWahl = { anbieter: o.anbieter, modell: o.modell, stufe: stufe as ModelTier };
  if (!optionen) return { wahl, befunde: [] };
  const opt = optionen.find(x => x.schluessel === modellSchluessel(wahl));
  if (!opt) return { wahl, befunde: [b('offen', 'dieses Modell ist in dieser Instanz nicht (mehr) angebunden — neu wählen oder die Stufe nehmen.')] };
  if (!opt.waehlbar) return { wahl, befunde: [b('offen', `${opt.anbieterName}: ${opt.grund ?? 'nicht wählbar'}.`)] };
  return { wahl: opt.stufe !== wahl.stufe ? { ...wahl, stufe: opt.stufe } : wahl, befunde: [] };
}
