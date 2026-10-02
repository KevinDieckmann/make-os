// ─── Netzwerken — Warteschlange (Browser, 02.10.) ────────────────────────────
// Auf einer Veranstaltung ist das Netz schlecht. Jede Erfassung geht deshalb ZUERST in eine lokale Warteschlange
// (IndexedDB, Fotos als Base64-Text — das geht auch in Safari am iPhone zuverlässig) und wird DANN gesendet. Klappt das
// Senden nicht (kein Netz, Server 5xx), bleibt sie liegen und wird beim Wiederkehren des Netzes, beim Öffnen der Seite und
// alle 30 Sekunden erneut versucht — nie doppelt: die Kennung der Erfassung (UUID) macht den Server idempotent
// (lib/crm/netzwerken-server.ts). Was der Server ablehnt (400/403/404/413/415), bleibt als „Fehler“ mit Klartext sichtbar und
// geht nicht verloren; ein veralteter Tab (409 „bitte neu laden“) wartet, bis die Seite neu geladen ist.
// Rein bis auf `indexedDbSpeicher` — getestet mit dem Speicher im Arbeitsspeicher (tests/netzwerken-logik.test.ts).

export type WarteStatus = 'wartet' | 'fehler';
export interface WarteEintrag {
  /** Kennung der Erfassung (UUID) — zugleich Schlüssel in der Warteschlange. */
  id: string;
  angelegt: number;
  versuche: number;
  status: WarteStatus;
  /** Klartext für die Anzeige: warum es noch liegt. */
  hinweis?: string;
  /** Der Körper an POST /api/netzwerken (Bilder als Base64). */
  koerper: Record<string, unknown>;
  /** Kurzform für die Anzeige (ohne Fotos). */
  anzeige: { name: string; schritt: string; eventTitel: string; termin?: string };
}

export interface WarteSpeicher {
  alle(): Promise<WarteEintrag[]>;
  setze(e: WarteEintrag): Promise<void>;
  entferne(id: string): Promise<void>;
}

/** Was eine Antwort des Servers für den Eintrag bedeutet. */
export type Bewertung =
  | { art: 'erledigt' }
  | { art: 'wiederholen'; grund: string }
  | { art: 'neuladen'; grund: string }
  | { art: 'fehler'; text: string };

export const WARTET_TEXT = 'Wird gesendet, sobald Netz da ist.';
export const NEU_LADEN_WARTE = 'MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Erfassung bleibt auf dem Gerät.';

/**
 * Antwort bewerten. `status` 0 = kein Netz (fetch warf). Alles, was ein späterer Versuch heilen kann (Netz, 5xx, abgemeldet),
 * wird wiederholt; was die Eingabe selbst betrifft (400, 404, 413, 415) oder die Rechte (403), nicht.
 */
export function bewerten(status: number, d: unknown): Bewertung {
  const o = (d && typeof d === 'object' ? d : {}) as { ok?: unknown; fehler?: unknown; neuLaden?: unknown; teilweise?: unknown };
  if (status >= 200 && status < 300 && o.ok === true) return { art: 'erledigt' };
  const text = typeof o.fehler === 'string' && o.fehler ? o.fehler : '';
  if (status === 409 && o.neuLaden === true) return { art: 'neuladen', grund: NEU_LADEN_WARTE };
  if (status === 0 || status === 408 || status === 429 || status >= 500) return { art: 'wiederholen', grund: status >= 500 && text ? text : WARTET_TEXT };
  if (status === 401) return { art: 'wiederholen', grund: 'Bitte neu anmelden — die Erfassung bleibt auf dem Gerät.' };
  // 409 mit „teilweise“ (z. B. Kalender nicht verbunden): die Person ist erfasst, ein Rest fehlt — sichtbar, erneut versuchbar.
  return { art: 'fehler', text: text || `Nicht gespeichert (Fehler ${status}).` };
}

export function ramSpeicher(): WarteSpeicher {
  const m = new Map<string, WarteEintrag>();
  return {
    alle: async () => Array.from(m.values()).map(e => structuredClone(e)),
    setze: async e => { m.set(e.id, structuredClone(e)); },
    entferne: async id => { m.delete(id); },
  };
}

/** IndexedDB — `null`, wenn der Browser keine hat (privates Fenster in alten Versionen): dann bleibt es im Arbeitsspeicher. */
export function indexedDbSpeicher(name = 'make-os-netzwerken'): WarteSpeicher | null {
  if (typeof indexedDB === 'undefined') return null;
  const oeffnen = () => new Promise<IDBDatabase>((ok, nein) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('warteschlange')) r.result.createObjectStore('warteschlange', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => nein(r.error ?? new Error('IndexedDB nicht verfügbar'));
    r.onblocked = () => nein(new Error('IndexedDB blockiert'));
  });
  const lauf = async <T>(modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await oeffnen();
    try {
      return await new Promise<T>((ok, nein) => {
        const t = db.transaction('warteschlange', modus);
        const r = f(t.objectStore('warteschlange'));
        t.oncomplete = () => ok(r.result);
        t.onerror = () => nein(t.error ?? new Error('IndexedDB-Fehler'));
        t.onabort = () => nein(t.error ?? new Error('IndexedDB abgebrochen'));
      });
    } finally { db.close(); }
  };
  return {
    alle: () => lauf<WarteEintrag[]>('readonly', s => s.getAll() as IDBRequest<WarteEintrag[]>),
    setze: async e => { await lauf('readwrite', s => s.put(e)); },
    entferne: async id => { await lauf('readwrite', s => s.delete(id)); },
  };
}

export interface SendeErgebnis { gesendet: WarteEintrag[]; wartend: number; fehler: number; neuLaden: boolean; antworten: Record<string, unknown> }

export type Sender = (koerper: Record<string, unknown>) => Promise<{ status: number; daten: unknown }>;

export class Warteschlange {
  private laeuft = false;
  /** Während eines Laufs kam etwas Neues dazu — danach noch einmal durchgehen. */
  private nochmal = false;
  constructor(private speicher: WarteSpeicher, private sender: Sender) {}

  async alle(): Promise<WarteEintrag[]> { return (await this.speicher.alle()).sort((a, b) => a.angelegt - b.angelegt); }

  /** Eine Erfassung ablegen — lokal, noch nicht gesendet. Dieselbe Kennung zweimal legt nichts doppelt ab. */
  async ablegen(koerper: Record<string, unknown>, anzeige: WarteEintrag['anzeige'], jetzt = Date.now()): Promise<WarteEintrag> {
    const id = String(koerper.erfassungId ?? '');
    if (!id) throw new Error('Erfassung ohne Kennung');
    const da = (await this.speicher.alle()).find(e => e.id === id);
    if (da) return da;
    const e: WarteEintrag = { id, angelegt: jetzt, versuche: 0, status: 'wartet', hinweis: WARTET_TEXT, koerper, anzeige };
    await this.speicher.setze(e);
    return e;
  }

  /** Einen Eintrag wieder zum Senden freigeben (nach „Fehler“). */
  async erneut(id: string): Promise<void> {
    const e = (await this.speicher.alle()).find(x => x.id === id);
    if (e) await this.speicher.setze({ ...e, status: 'wartet', hinweis: WARTET_TEXT });
  }
  async verwerfen(id: string): Promise<void> { await this.speicher.entferne(id); }

  /**
   * Alles Wartende nacheinander senden, ältestes zuerst. Beim ersten Netzfehler Schluss (das Netz fehlt für alle).
   * Läuft schon ein Lauf, kehrt der zweite sofort zurück — der Server wäre ohnehin idempotent, aber so entsteht kein Stau.
   */
  async senden(): Promise<SendeErgebnis> {
    const raus: SendeErgebnis = { gesendet: [], wartend: 0, fehler: 0, neuLaden: false, antworten: {} };
    if (this.laeuft) { this.nochmal = true; return raus; }
    this.laeuft = true;
    try {
      let runde = 0;
      do {
        this.nochmal = false;
        const r = await this.lauf(raus);
        if (r === 'stopp') break;
      } while (this.nochmal && ++runde < 3);
      const rest = await this.alle();
      raus.wartend = rest.filter(x => x.status === 'wartet').length;
      raus.fehler = rest.filter(x => x.status === 'fehler').length;
      return raus;
    } finally { this.laeuft = false; }
  }

  /** Ein Durchgang über alles Wartende — 'stopp', wenn Netz oder Server fehlen. */
  private async lauf(raus: SendeErgebnis): Promise<'weiter' | 'stopp'> {
    for (const e of (await this.alle()).filter(x => x.status === 'wartet')) {
      let b: Bewertung, daten: unknown = null;
      try {
        const a = await this.sender(e.koerper);
        daten = a.daten;
        b = bewerten(a.status, a.daten);
      } catch { b = { art: 'wiederholen', grund: WARTET_TEXT }; }
      if (b.art === 'erledigt') { await this.speicher.entferne(e.id); raus.gesendet.push(e); raus.antworten[e.id] = daten; continue; }
      if (b.art === 'fehler') { await this.speicher.setze({ ...e, versuche: e.versuche + 1, status: 'fehler', hinweis: b.text }); continue; }
      await this.speicher.setze({ ...e, versuche: e.versuche + 1, hinweis: b.grund });
      if (b.art === 'neuladen') raus.neuLaden = true;
      return 'stopp'; // Netz oder Server fehlen — die übrigen warten mit
    }
    return 'weiter';
  }
}

/** Sender über `fetch` (mit Zeitgrenze — Fotos auf schlechtem Netz brauchen Zeit, aber nicht ewig). */
export const fetchSender = (url = '/api/netzwerken', zeitMs = 90_000): Sender => async koerper => {
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), zeitMs);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(koerper), signal: ctrl.signal });
    const daten = await r.json().catch(() => null);
    return { status: r.status, daten };
  } finally { clearTimeout(uhr); }
};
