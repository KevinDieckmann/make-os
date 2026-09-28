// ─── Zeit & Fokus — der laufende Fokus im Browser (27.09. spät) ─────────────
// Der Fokus-Zähler im Kopf merkt den laufenden Block in localStorage (`make-fokus`),
// damit er Seitenwechsel übersteht. Seit 27.09. spät kann er eine Aufgabe und eine
// Einheit tragen, und er lässt sich auch von außen starten (Aufgaben-Detail →
// „Fokus starten“): wer den Merker ändert, sendet FOKUS_EREIGNIS — der Kopf liest neu.
// Seit 29.09.: der Server hält den laufenden Fokus je Person fest (/api/state/fokus) — `fokusMerken` schreibt ihn mit,
// `fokusAbgleichen` holt ihn beim Öffnen/Fokus (anderes Gerät, gelöschte Tab-Daten). Der Browser bleibt die Anzeige.
// Nur im Browser benutzen.

import { schluesselFuer, teile } from './modell';
import { bereichVon } from './bereich';
import { laufendAbgleich, laufendSaeubern } from './fokus-regeln';

export const FOKUS_MERKER = 'make-fokus';
export const FOKUS_EREIGNIS = 'make-fokus-geaendert';

/** Der laufende Block — seit 28.09. auch mit Mandat (`mandatId`, nur im Business; Firma/Einheit leitet der Server ab). */
export interface LaufenderFokus { von: string; schluessel: string; label: string; aufgabeId?: string; einheit?: string; mandatId?: string }

export function gemerkterFokus(): LaufenderFokus | null {
  try {
    const v = localStorage.getItem(FOKUS_MERKER);
    const l = v ? (JSON.parse(v) as LaufenderFokus) : null;
    return l && typeof l.von === 'string' && typeof l.schluessel === 'string' ? l : null;
  } catch { return null; }
}

/** Merker setzen (oder mit null löschen), allen Zählern Bescheid geben und den Server mitschreiben (überlebt das Schließen des Tabs). */
export function fokusMerken(l: LaufenderFokus | null, opt: { server?: boolean } = {}): void {
  try { if (l) localStorage.setItem(FOKUS_MERKER, JSON.stringify(l)); else localStorage.removeItem(FOKUS_MERKER); } catch { /* egal */ }
  window.dispatchEvent(new Event(FOKUS_EREIGNIS));
  if (opt.server !== false) {
    void fetch('/api/state/fokus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ laufend: l }), keepalive: true }).catch(() => { /* offline: der nächste Abgleich lädt hoch */ });
  }
}

/** Beim Öffnen und bei Fokus: laufenden Fokus mit dem Server abgleichen (Server gewinnt; kennt er keinen → hochladen). */
export async function fokusAbgleichen(): Promise<void> {
  try {
    const r = await fetch('/api/state/fokus', { cache: 'no-store' });
    if (!r.ok) return;
    const d = (await r.json()) as { laufend?: unknown };
    const a = laufendAbgleich(laufendSaeubern(d.laufend ?? null), gemerkterFokus());
    if (a.art === 'uebernehmen') fokusMerken(a.laufend, { server: false });
    else if (a.art === 'hochladen') fokusMerken(a.laufend);
  } catch { /* offline — beim nächsten Mal */ }
}

/**
 * Fokus für eine Business-Aufgabe (aus dem Aufgaben-Detail): startet einen Block im Business, im Bereich der aktuellen
 * Adresse — oder ordnet einen schon laufenden Block dieser Aufgabe zu (dann zählt er im Business, Anfang bleibt).
 */
export function fokusFuerAufgabe(a: { id: string; einheit?: string }, pfad = window.location.pathname, suche = window.location.search): 'gestartet' | 'zugeordnet' {
  const zuordnung = { aufgabeId: a.id, ...(a.einheit ? { einheit: a.einheit } : {}) };
  const l = gemerkterFokus();
  if (l) {
    // Die Aufgabe ersetzt die ganze bisherige Zuordnung (auch ein gewähltes Mandat — die Aufgabe kann zu einem anderen gehören).
    const { aufgabeId: _a, einheit: _e, mandatId: _m, ...rest } = l;
    fokusMerken({ ...rest, schluessel: schluesselFuer('business', teile(l.schluessel).bereich), ...zuordnung });
    return 'zugeordnet';
  }
  const bereich = bereichVon(pfad, suche);
  fokusMerken({ von: new Date().toISOString(), schluessel: schluesselFuer('business', bereich.id), label: bereich.label, ...zuordnung });
  return 'gestartet';
}
