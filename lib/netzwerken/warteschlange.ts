// ─── Netzwerken — Warteschlange (Browser, 02.10.) ────────────────────────────
// Auf einer Veranstaltung ist das Netz schlecht. Jede Erfassung geht deshalb ZUERST in eine lokale Warteschlange
// (IndexedDB, Fotos als Base64-Text — das geht auch in Safari am iPhone zuverlässig) und wird DANN gesendet. Klappt das
// Senden nicht, bleibt sie liegen und wird beim Wiederkehren des Netzes, beim Öffnen JEDER Seite (Sender im /os-Rahmen,
// components/os/netzwerken/Sender.tsx) und alle 30 Sekunden erneut versucht — nie doppelt: die Kennung der Erfassung (UUID)
// macht den Server idempotent (lib/crm/netzwerken-server.ts).
//   kein Netz (Status 0), abgemeldet (401), zu viele Anfragen (429)  → der ganze Durchlauf bricht ab, alle warten mit
//   Serverfehler (5xx) an EINER Erfassung  → drei Versuche, dann „Fehler“ mit Klartext; der Durchlauf geht beim nächsten weiter
//                                            (eine kaputte Erfassung blockiert nie die anderen)
//   Eingabe/Rechte (400/403/404/413/415)   → „Fehler“ mit Klartext, geht nicht verloren
//   409 „teilweise“ (Person erfasst, nur der Termin fehlt) → „Fehler“ mit Klartext + „Ohne Termin abschließen“
//   409 „andere Person“ (am Gerät ist inzwischen jemand anderes angemeldet) → wartet auf die richtige Person, sendet nie fremd
//   409 „neu laden“ (veralteter Tab) → wartet, bis die Seite neu geladen ist
// Rein bis auf `indexedDbSpeicher` — getestet mit dem Speicher im Arbeitsspeicher (tests/netzwerken-logik.test.ts).
//
// Datenschutz (03.10., Paket „netz-recht“) — die Warteschlange trägt Daten Dritter (Name, Mail, Telefon, Foto der Karte, Sprachnotiz):
//   · Alter: ab 14 Tagen steht „Erfassung vom … noch nicht gesendet: senden oder verwerfen“ (`altHinweis`); nach 30 Tagen wird der Eintrag
//     AUTOMATISCH verworfen (`altVerwerfen`, mit Anzeige `verworfenAlt`) — kein Vorrat auf dem Gerät (Art. 5 Abs. 1 lit. e). Der Server nähme eine
//     Erfassung ohnehin nur bis 14 Tage nach der Begegnung mit ihrem Zeitpunkt an.
//   · Verschlüsselt: in IndexedDB liegt der Körper (Angaben, Fotos, Sprachnotiz) nur noch verschlüsselt — AES-GCM mit einem NICHT exportierbaren
//     WebCrypto-Schlüssel, der selbst in IndexedDB steckt (`verschluesselterSpeicher`). Der Schlüssel lässt sich nicht auslesen, nur benutzen; wer
//     die Datenbank kopiert, hat ohne den Browser nichts. Ohne WebCrypto (kein sicherer Kontext) geht der Eintrag in den Arbeitsspeicher
//     (`ausfallsicher`, Hinweis „Seite offen lassen“) — nie unverschlüsselt auf die Platte. Abmelden löscht Daten UND Schlüssel.

import type { EventFuer } from '@/lib/crm/typen';

export type WarteStatus = 'wartet' | 'fehler';
/** Verschlüsselter Körper (nur im Speicher IndexedDB): Version, Zufallswert (12 Byte) und Chiffretext — nie im Klartext daneben. */
export interface Verschluesselt { v: 1; iv: Uint8Array; daten: ArrayBuffer }

export interface WarteEintrag {
  /** Kennung der Erfassung (UUID) — zugleich Schlüssel in der Warteschlange. */
  id: string;
  angelegt: number;
  versuche: number;
  status: WarteStatus;
  /** Klartext für die Anzeige: warum es noch liegt. */
  hinweis?: string;
  /** Wer erfasst hat (`erfasstVon` im Körper) — die Warteschlange zählt und sendet für die angemeldete Person (03.10.). */
  person?: string;
  /** „Fehler“, weil der Termin nicht ging (kein Kalender, iCloud weg): die Person ist erfasst, es lässt sich ohne Termin abschließen. */
  teilweise?: boolean;
  /** „Fehler“, weil das Event nicht (mehr) passt (gelöscht, abgesagt, Datum falsch): die Erfassung lässt sich einem anderen Event zuordnen (`eventWechseln`). */
  eventFehler?: boolean;
  /** Der Körper an POST /api/netzwerken (Bilder als Base64). Im Speicher IndexedDB leer — dort steht er in `verschluesselt`. */
  koerper: Record<string, unknown>;
  /** Nur im Speicher IndexedDB: der Körper, verschlüsselt (AES-GCM, nicht exportierbarer Schlüssel). `alle()` gibt ihn entschlüsselt als `koerper` zurück. */
  verschluesselt?: Verschluesselt;
  /** Der Schlüssel dieses Geräts fehlt (Browserdaten gelöscht): der Körper ist nicht mehr lesbar — nur noch verwerfen. */
  unlesbar?: boolean;
  /** Kurzform für die Anzeige (ohne Fotos). */
  anzeige: { name: string; schritt: string; eventTitel: string; termin?: string };
}

export interface WarteSpeicher {
  alle(): Promise<WarteEintrag[]>;
  setze(e: WarteEintrag): Promise<void>;
  entferne(id: string): Promise<void>;
  /** Nur bei `ausfallsicher`: liegt mindestens eine Erfassung nur im Arbeitsspeicher (IndexedDB fiel aus)? Dann darf die Seite nicht geschlossen werden. */
  imArbeitsspeicher?(): boolean;
}

/** Text, wenn IndexedDB ausfällt (privates Fenster, Speicher voll, Safari-Fehler): die Erfassung liegt nur im Arbeitsspeicher dieser Seite. */
export const NUR_RAM_HINWEIS = 'Bitte Seite offen lassen, bis gesendet — der Speicher des Geräts ist nicht verfügbar.';

/** Was eine Antwort des Servers für den Eintrag bedeutet. */
export type Bewertung =
  | { art: 'erledigt' }
  /** `stopp`: kein Netz/abgemeldet/gedrosselt — alle warten mit; sonst ein Serverfehler an dieser einen Erfassung. */
  | { art: 'wiederholen'; grund: string; stopp: boolean; teilweise?: boolean }
  | { art: 'neuladen'; grund: string }
  /** Die Erfassung gehört einer anderen Person dieses Geräts — sie wartet, bis diese angemeldet ist. */
  | { art: 'andere'; grund: string }
  | { art: 'fehler'; text: string; teilweise?: boolean; eventFehler?: boolean };

/** So viele Versuche mit Serverfehler (5xx), dann „Fehler“. */
export const MAX_SERVER_VERSUCHE = 3;
/** Ab so vielen Tagen steht dabei „noch nicht gesendet: senden oder verwerfen“. */
export const WARTE_ALT_TAGE = 14;
/** Nach so vielen Tagen wird ein Eintrag automatisch verworfen (mit Anzeige). */
export const WARTE_VERWERFEN_TAGE = 30;
const TAG_MS = 864e5;
const tagDe = (ms: number) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });

/** Alter eines Eintrags in ganzen Tagen. */
export const alterTage = (e: Pick<WarteEintrag, 'angelegt'>, jetzt: number = Date.now()): number => Math.floor((jetzt - e.angelegt) / TAG_MS);
/** Ist der Eintrag alt genug für die Warnung (≥ 14 Tage)? */
export const istAlt = (e: Pick<WarteEintrag, 'angelegt'>, jetzt: number = Date.now()): boolean => alterTage(e, jetzt) >= WARTE_ALT_TAGE;
/** „Erfassung vom 18.09. noch nicht gesendet: senden oder verwerfen“ — nur ab 14 Tagen, sonst null. Nennt, wann sie von selbst verschwindet. */
export function altHinweis(e: Pick<WarteEintrag, 'angelegt'>, jetzt: number = Date.now()): string | null {
  if (!istAlt(e, jetzt)) return null;
  const rest = Math.max(0, WARTE_VERWERFEN_TAGE - alterTage(e, jetzt));
  return `Erfassung vom ${tagDe(e.angelegt)} noch nicht gesendet: senden oder verwerfen — nach ${WARTE_VERWERFEN_TAGE} Tagen wird sie vom Gerät gelöscht${rest ? ` (in ${rest} ${rest === 1 ? 'Tag' : 'Tagen'})` : ''}.`;
}
/** Was nach 30 Tagen automatisch verworfen wurde — für die Anzeige („Erfassung von X vom … wurde nach 30 Tagen vom Gerät gelöscht“). */
export interface VerworfenAlt { id: string; am: number; name: string; schritt: string; eventTitel: string }
/** localStorage-Schlüssel der Anzeige „nach 30 Tagen verworfen“ (Präfix `make-os-netzwerken-` → das Abmelden räumt ihn mit weg). */
export const VERWORFEN_KEY = 'make-os-netzwerken-verworfen';
export const verworfenText = (v: VerworfenAlt): string => `Die Erfassung von ${v.name} (${v.eventTitel}) vom ${tagDe(v.am)} wurde nach ${WARTE_VERWERFEN_TAGE} Tagen ohne Senden vom Gerät gelöscht.`;

export const WARTET_TEXT = 'Wird gesendet, sobald Netz da ist.';
export const NEU_LADEN_WARTE = 'MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Erfassung bleibt auf dem Gerät.';

/**
 * Antwort bewerten. `status` 0 = kein Netz (fetch warf). Alles, was ein späterer Versuch heilen kann (Netz, 5xx, abgemeldet),
 * wird wiederholt; was die Eingabe selbst betrifft (400, 404, 413, 415) oder die Rechte (403), nicht.
 */
export function bewerten(status: number, d: unknown): Bewertung {
  const o = (d && typeof d === 'object' ? d : {}) as { ok?: unknown; fehler?: unknown; neuLaden?: unknown; teilweise?: unknown; andere?: unknown; eventFehler?: unknown };
  if (status >= 200 && status < 300 && o.ok === true) return { art: 'erledigt' };
  const text = typeof o.fehler === 'string' && o.fehler ? o.fehler : '';
  const teilweise = o.teilweise === true;
  if (status === 409 && o.neuLaden === true) return { art: 'neuladen', grund: NEU_LADEN_WARTE };
  if (status === 409 && o.andere === true) return { art: 'andere', grund: text || 'Diese Erfassung gehört einer anderen Person — sie wird unter deren Konto gesendet.' };
  if (status === 0 || status === 429) return { art: 'wiederholen', grund: WARTET_TEXT, stopp: true };
  if (status === 401) return { art: 'wiederholen', grund: 'Bitte neu anmelden — die Erfassung bleibt auf dem Gerät.', stopp: true };
  if (status === 408 || status >= 500) return { art: 'wiederholen', grund: status >= 500 && text ? text : WARTET_TEXT, stopp: false, ...(teilweise ? { teilweise: true } : {}) };
  // 409 mit „teilweise“ (z. B. Kalender nicht verbunden): die Person ist erfasst, ein Rest fehlt — sichtbar, „Ohne Termin abschließen“ möglich.
  return { art: 'fehler', text: text || `Nicht gespeichert (Fehler ${status}).`, ...(teilweise ? { teilweise: true } : {}), ...(o.eventFehler === true ? { eventFehler: true } : {}) };
}

export function ramSpeicher(): WarteSpeicher {
  const m = new Map<string, WarteEintrag>();
  return {
    alle: async () => Array.from(m.values()).map(e => structuredClone(e)),
    setze: async e => { m.set(e.id, structuredClone(e)); },
    entferne: async id => { m.delete(id); },
  };
}

/**
 * Fällt der Speicher auf dem Gerät aus (`indexedDB.open` scheitert, Schreiben scheitert, Platte voll), geht die Erfassung in den
 * Arbeitsspeicher — und wird trotzdem gesendet. So geht beim Erfassen nie etwas verloren, solange die Seite offen bleibt;
 * `imArbeitsspeicher()` sagt der Oberfläche, dass sie den Hinweis „Bitte Seite offen lassen, bis gesendet“ zeigen muss.
 * Ohne `primaer` (Browser ohne IndexedDB) läuft alles gleich im Arbeitsspeicher.
 */
export function ausfallsicher(primaer: WarteSpeicher | null, rueckfall: WarteSpeicher = ramSpeicher()): WarteSpeicher {
  /** Kennungen, die NUR im Arbeitsspeicher liegen (das Gerät konnte sie nicht aufnehmen). */
  const imRam = new Set<string>();
  return {
    imArbeitsspeicher: () => imRam.size > 0,
    alle: async () => {
      let a: WarteEintrag[] = [];
      if (primaer) { try { a = await primaer.alle(); } catch { /* Gerät nicht lesbar: es zählt, was im Arbeitsspeicher liegt */ } }
      const r = await rueckfall.alle();
      const rIds = new Set(r.map(x => x.id));
      return [...a.filter(x => !rIds.has(x.id)), ...r];   // was im Arbeitsspeicher liegt, ist der neuere Stand
    },
    setze: async e => {
      if (primaer) {
        // Lag sie schon im Arbeitsspeicher, noch einmal auf das Gerät versuchen (der Speicher kann wieder da sein).
        try { await primaer.setze(e); if (imRam.delete(e.id)) await rueckfall.entferne(e.id); return; } catch { /* Rückfall */ }
      }
      await rueckfall.setze(e); imRam.add(e.id);
    },
    entferne: async id => {
      imRam.delete(id);
      await rueckfall.entferne(id);
      if (primaer) { try { await primaer.entferne(id); } catch { /* bleibt auf dem Gerät liegen; beim nächsten Senden wäre es ohnehin idempotent */ } }
    },
  };
}

// ── Verschlüsselung (AES-GCM, nicht exportierbarer Schlüssel) ──────────────

const TE = () => new TextEncoder();
/** Körper → verschlüsselt. Die Kennung der Erfassung ist zusätzlich authentifiziert (AAD): ein Chiffretext lässt sich nicht an einen anderen Eintrag hängen. */
export async function koerperVerschluesseln(key: CryptoKey, id: string, koerper: Record<string, unknown>, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<Verschluesselt> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const daten = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: TE().encode(id) }, key, TE().encode(JSON.stringify(koerper)));
  return { v: 1, iv, daten };
}
/** Verschlüsselt → Körper. Wirft, wenn der Schlüssel nicht passt oder etwas verändert wurde. */
export async function koerperEntschluesseln(key: CryptoKey, id: string, v: Verschluesselt, subtle: SubtleCrypto = globalThis.crypto.subtle): Promise<Record<string, unknown>> {
  const klar = await subtle.decrypt({ name: 'AES-GCM', iv: v.iv as BufferSource, additionalData: TE().encode(id) }, key, v.daten);
  const k = JSON.parse(new TextDecoder().decode(klar)) as unknown;
  if (!k || typeof k !== 'object' || Array.isArray(k)) throw new Error('Körper ungültig');
  return k as Record<string, unknown>;
}

/**
 * Hüllt einen Speicher ein: `setze` legt den Körper nur noch verschlüsselt ab (der Klartext-Körper wird durch `{}` ersetzt), `alle` gibt ihn
 * entschlüsselt zurück. Alte Einträge ohne Hülle (vor dem 03.10.) bleiben lesbar und werden beim nächsten Schreiben verschlüsselt. Ist der
 * Schlüssel nicht mehr da (Browserdaten gelöscht), kommt der Eintrag als `unlesbar` mit Klartext-Hinweis zurück — verwerfen geht, senden nicht.
 * `key()` liefert den Schlüssel (wirft ohne WebCrypto — dann scheitert `setze`, und `ausfallsicher` nimmt den Arbeitsspeicher).
 */
export function verschluesselterSpeicher(inner: WarteSpeicher, key: () => Promise<CryptoKey>): WarteSpeicher {
  return {
    imArbeitsspeicher: inner.imArbeitsspeicher?.bind(inner),
    alle: async () => {
      const roh = await inner.alle();
      let k: CryptoKey | null = null;
      return Promise.all(roh.map(async e => {
        if (!e.verschluesselt) return e;
        try {
          k ??= await key();
          const { verschluesselt: _h, ...rest } = e;
          return { ...rest, koerper: await koerperEntschluesseln(k, e.id, e.verschluesselt) } as WarteEintrag;
        } catch {
          const { verschluesselt: _h, ...rest } = e;
          return { ...rest, koerper: {}, unlesbar: true, status: 'fehler' as const, hinweis: 'Auf diesem Gerät nicht mehr lesbar (der Schlüssel fehlt, etwa nach dem Löschen der Browserdaten) — bitte verwerfen und neu erfassen.' };
        }
      }));
    },
    setze: async e => {
      if (e.unlesbar) { await inner.setze(e); return; } // nur Hinweis/Status — nichts zu verschlüsseln
      const k = await key();
      const { koerper, ...rest } = e;
      await inner.setze({ ...rest, koerper: {}, verschluesselt: await koerperVerschluesseln(k, e.id, koerper) });
    },
    entferne: id => inner.entferne(id),
  };
}

/** IndexedDB — `null`, wenn der Browser keine hat (privates Fenster in alten Versionen): dann bleibt es im Arbeitsspeicher. Der Körper liegt dort nur verschlüsselt. */
export function indexedDbSpeicher(name = 'make-os-netzwerken'): WarteSpeicher | null {
  if (typeof indexedDB === 'undefined') return null;
  const oeffnen = () => new Promise<IDBDatabase>((ok, nein) => {
    let fertig = false;
    // Safari am iPhone antwortet manchmal nie: nach 5 Sekunden gilt der Speicher als ausgefallen (Rückfall auf den Arbeitsspeicher).
    const uhr = setTimeout(() => { fertig = true; nein(new Error('IndexedDB antwortet nicht')); }, 5000);
    // Version 2 (03.10.): dazu der Speicher `schluessel` für den nicht exportierbaren AES-Schlüssel.
    const r = indexedDB.open(name, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains('warteschlange')) r.result.createObjectStore('warteschlange', { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains('schluessel')) r.result.createObjectStore('schluessel', { keyPath: 'id' });
    };
    r.onsuccess = () => { clearTimeout(uhr); if (fertig) r.result.close(); else { fertig = true; ok(r.result); } };
    r.onerror = () => { clearTimeout(uhr); nein(r.error ?? new Error('IndexedDB nicht verfügbar')); };
    r.onblocked = () => { clearTimeout(uhr); nein(new Error('IndexedDB blockiert')); };
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
  const roh: WarteSpeicher = {
    alle: () => lauf<WarteEintrag[]>('readonly', s => s.getAll() as IDBRequest<WarteEintrag[]>),
    setze: async e => { await lauf('readwrite', s => s.put(e)); },
    entferne: async id => { await lauf('readwrite', s => s.delete(id)); },
  };
  // Der Schlüssel: einmal erzeugt (nicht exportierbar, `extractable: false`), in IndexedDB abgelegt, danach nur benutzt. Zwei Tabs: wer zuerst
  // schreibt, gewinnt (die Prüfung steckt in derselben Transaktion) — beide benutzen danach denselben.
  let schluessel: Promise<CryptoKey> | null = null;
  const holeSchluessel = (): Promise<CryptoKey> => {
    if (schluessel) return schluessel;
    const p = (async () => {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) throw new Error('WebCrypto nicht verfügbar (kein sicherer Kontext)');
      const db = await oeffnen();
      try {
        const gelesen = await new Promise<CryptoKey | undefined>((ok, nein) => {
          const t = db.transaction('schluessel', 'readonly'); const r = t.objectStore('schluessel').get('warteschlange');
          t.oncomplete = () => ok((r.result as { key?: CryptoKey } | undefined)?.key); t.onerror = () => nein(t.error ?? new Error('IndexedDB-Fehler')); t.onabort = () => nein(t.error ?? new Error('IndexedDB abgebrochen'));
        });
        if (gelesen) return gelesen;
        const neu = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        return await new Promise<CryptoKey>((ok, nein) => {
          const t = db.transaction('schluessel', 'readwrite'); const st = t.objectStore('schluessel');
          let gewinner = neu;
          const g = st.get('warteschlange');
          g.onsuccess = () => { const da = (g.result as { key?: CryptoKey } | undefined)?.key; if (da) gewinner = da; else st.put({ id: 'warteschlange', key: neu }); };
          t.oncomplete = () => ok(gewinner); t.onerror = () => nein(t.error ?? new Error('IndexedDB-Fehler')); t.onabort = () => nein(t.error ?? new Error('IndexedDB abgebrochen'));
        });
      } finally { db.close(); }
    })();
    schluessel = p;
    p.catch(() => { if (schluessel === p) schluessel = null; }); // beim nächsten Mal neu versuchen
    return p;
  };
  return verschluesselterSpeicher(roh, holeSchluessel);
}

/** Wie viele Erfassungen warten für diese Person? (Zähler-Abzeichen, Abmelden.) Ohne Person im Eintrag zählt er für jede. */
export const wartendFuer = (l: readonly WarteEintrag[], person: string | null): number => l.filter(x => x.status === 'wartet' && (!x.person || !person || x.person === person)).length;
/** Alles, was für diese Person noch nicht gespeichert ist (wartend ODER Fehler) — wer sich abmeldet, soll das wissen. */
export const offenFuer = (l: readonly WarteEintrag[], person: string | null): number => l.filter(x => !x.person || !person || x.person === person).length;

export interface SendeErgebnis { gesendet: WarteEintrag[]; wartend: number; fehler: number; neuLaden: boolean; antworten: Record<string, unknown> }

export type Sender = (koerper: Record<string, unknown>) => Promise<{ status: number; daten: unknown }>;

export class Warteschlange {
  private laeuft = false;
  /** Während eines Laufs kam etwas Neues dazu — danach noch einmal durchgehen. */
  private nochmal = false;
  private hoerer = new Set<() => void>();
  /** Die angemeldete Person, sobald bekannt: Erfassungen einer anderen Person werden hier gar nicht erst gesendet (der Server lehnte sie ohnehin ab). */
  person: string | null = null;
  /** Antworten des Servers je gesendeter Erfassung (Kennungen für „Zur Person“, Termin, Deal …) — auch wenn ein anderer Aufrufer gesendet hat. */
  readonly antworten: Record<string, unknown> = {};
  /**
   * Event-Kennungen, die der Server umgehängt hat (M7): gab es ein gleichnamiges Event desselben Tages schon, hängt die Erfassung daran und meldet
   * dessen Kennung zurück — `von` (Körper) → `nach` (Server). Die Oberfläche hängt ihre Auswahl („Heute bei“) danach um.
   */
  readonly umgehaengt: Record<string, string> = {};
  /** Wie viele Erfassungen seit dem Laden erfolgreich gesendet wurden — die Anzeige lädt dann das CRM neu. */
  gesendetZahl = 0;
  /** Der Server sagte „MAKE OS wurde aktualisiert“ — die Seite soll neu geladen werden. */
  neuLadenNoetig = false;
  /** Was nach 30 Tagen automatisch verworfen wurde (seit dem Laden) — die Anzeige nennt es, damit nichts still verschwindet. */
  readonly verworfenAlt: VerworfenAlt[] = [];
  constructor(private speicher: WarteSpeicher, private sender: Sender) {}

  /** Meldet jede Änderung am Bestand (abgelegt, gesendet, Fehler, verworfen) — für Zähler-Abzeichen und Anzeige. Gibt die Abmeldung zurück. */
  beiAenderung(f: () => void): () => void { this.hoerer.add(f); return () => { this.hoerer.delete(f); }; }
  private geaendert(): void { for (const f of this.hoerer) { try { f(); } catch { /* ein Hörer darf den Lauf nie stören */ } } }

  /** Liegt etwas nur im Arbeitsspeicher (Speicher auf dem Gerät fiel aus)? Dann bitte die Seite offen lassen, bis gesendet. */
  nurImArbeitsspeicher(): boolean { return this.speicher.imArbeitsspeicher?.() === true; }

  async alle(): Promise<WarteEintrag[]> { return (await this.speicher.alle()).sort((a, b) => a.angelegt - b.angelegt); }

  /** Eine Erfassung ablegen — lokal, noch nicht gesendet. Dieselbe Kennung zweimal legt nichts doppelt ab. */
  async ablegen(koerper: Record<string, unknown>, anzeige: WarteEintrag['anzeige'], jetzt = Date.now()): Promise<WarteEintrag> {
    const id = String(koerper.erfassungId ?? '');
    if (!id) throw new Error('Erfassung ohne Kennung');
    const da = (await this.speicher.alle()).find(e => e.id === id);
    if (da) return da;
    const person = typeof koerper.erfasstVon === 'string' && koerper.erfasstVon ? koerper.erfasstVon : undefined;
    const e: WarteEintrag = { id, angelegt: jetzt, versuche: 0, status: 'wartet', hinweis: WARTET_TEXT, koerper, anzeige, ...(person ? { person } : {}) };
    await this.speicher.setze(e);
    this.geaendert();
    return e;
  }

  /** Einen Eintrag wieder zum Senden freigeben (nach „Fehler“) — mit frischen drei Versuchen. */
  async erneut(id: string): Promise<void> {
    const e = (await this.speicher.alle()).find(x => x.id === id);
    if (e) { const { teilweise: _t, eventFehler: _f, ...rest } = e; await this.speicher.setze({ ...rest, versuche: 0, status: 'wartet', hinweis: WARTET_TEXT }); this.geaendert(); }
  }
  /**
   * „Ohne Termin abschließen“: der Termin ging nicht (kein Kalender, iCloud weg). Dieselbe Erfassung wird mit `ohneTermin` erneut
   * gesendet — der Server schließt sie dann mit einem Follow-up „Termin vereinbaren“ (nächster Werktag) ab.
   */
  async ohneTermin(id: string): Promise<void> {
    const e = (await this.speicher.alle()).find(x => x.id === id);
    if (e) { const { teilweise: _t, ...rest } = e; await this.speicher.setze({ ...rest, koerper: { ...e.koerper, ohneTermin: true }, versuche: 0, status: 'wartet', hinweis: WARTET_TEXT }); this.geaendert(); }
  }
  /**
   * „Anderes Event wählen“ (H1): das Event dieser Erfassung ist gelöscht, abgesagt oder falsch — die Erfassung wird einem anderen Event zugeordnet
   * (Kennung, Titel, Datum, Ort, für wen) und noch einmal gesendet. `eventNeu` steht immer im Körper, damit der Server das Event bei Bedarf anlegen kann.
   */
  async eventWechseln(id: string, ziel: { eventId: string; titel: string; datum: string; ort?: string; fuer?: EventFuer }): Promise<void> {
    const e = (await this.speicher.alle()).find(x => x.id === id);
    if (!e) return;
    const { teilweise: _t, eventFehler: _f, ...rest } = e;
    const eventNeu = { titel: ziel.titel, datum: ziel.datum, ...(ziel.ort ? { ort: ziel.ort } : {}), ...(ziel.fuer?.art === 'kunde' ? { fuer: ziel.fuer } : {}) };
    await this.speicher.setze({ ...rest, koerper: { ...e.koerper, eventId: ziel.eventId, eventNeu }, anzeige: { ...e.anzeige, eventTitel: ziel.titel }, versuche: 0, status: 'wartet', hinweis: WARTET_TEXT });
    this.geaendert();
  }
  /**
   * „Für wen“ des Events wurde geändert (H2): alles Wartende bei diesem Event trägt es mit (`eventNeu.fuer`) — legt der Server das Event erst jetzt an,
   * entsteht es mit dem richtigen Kunden. Gibt zurück, wie viele Erfassungen geändert wurden.
   */
  async fuerUmschreiben(eventId: string, fuer: EventFuer): Promise<number> {
    let n = 0;
    for (const e of await this.speicher.alle()) {
      const neu = e.koerper.eventNeu;
      if (e.koerper.eventId !== eventId || !neu || typeof neu !== 'object') continue;
      const { fuer: _alt, ...rest } = neu as Record<string, unknown>;
      await this.speicher.setze({ ...e, koerper: { ...e.koerper, eventNeu: { ...rest, ...(fuer.art === 'kunde' ? { fuer } : {}) } } });
      n++;
    }
    if (n) this.geaendert();
    return n;
  }
  async verwerfen(id: string): Promise<void> { await this.speicher.entferne(id); this.geaendert(); }

  /**
   * Einträge, die älter als `WARTE_VERWERFEN_TAGE` (30) sind, verwerfen — ob wartend oder Fehler. Gibt sie zurück und merkt sie in `verworfenAlt`
   * (die Oberfläche zeigt „… wurde nach 30 Tagen vom Gerät gelöscht“). Aufrufer: der Sender im /os-Rahmen und die Netzwerken-Seite beim Öffnen — nie
   * `senden()` selbst, damit Tests mit Fantasie-Zeiten unberührt bleiben.
   */
  async altVerwerfen(jetzt: number = Date.now()): Promise<VerworfenAlt[]> {
    const alt = (await this.speicher.alle()).filter(e => alterTage(e, jetzt) >= WARTE_VERWERFEN_TAGE);
    const raus: VerworfenAlt[] = [];
    for (const e of alt) {
      await this.speicher.entferne(e.id);
      raus.push({ id: e.id, am: e.angelegt, name: e.anzeige.name, schritt: e.anzeige.schritt, eventTitel: e.anzeige.eventTitel });
    }
    if (raus.length) { this.verworfenAlt.push(...raus); this.geaendert(); }
    return raus;
  }

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
      // Jede Erfassung wird in EINEM Aufruf höchstens einmal versucht — sonst zählten zwei Auslöser kurz nacheinander (Öffnen + Netz da)
      // als zwei von drei Serverversuchen.
      const versucht = new Set<string>();
      do {
        this.nochmal = false;
        const r = await this.lauf(raus, versucht);
        if (r === 'stopp') break;
      } while (this.nochmal && ++runde < 3);
      const rest = await this.alle();
      raus.wartend = rest.filter(x => x.status === 'wartet').length;
      raus.fehler = rest.filter(x => x.status === 'fehler').length;
      return raus;
    } finally { this.laeuft = false; this.geaendert(); }
  }

  /** Ein Durchgang über alles Wartende — 'stopp' nur, wenn das Netz fehlt (oder abgemeldet/gedrosselt/veralteter Tab). */
  private async lauf(raus: SendeErgebnis, versucht: Set<string>): Promise<'weiter' | 'stopp'> {
    for (const e of (await this.alle()).filter(x => x.status === 'wartet' && !versucht.has(x.id) && (!x.person || !this.person || x.person === this.person))) {
      versucht.add(e.id);
      let b: Bewertung, daten: unknown = null;
      try {
        const a = await this.sender(e.koerper);
        daten = a.daten;
        b = bewerten(a.status, a.daten);
      } catch { b = { art: 'wiederholen', grund: WARTET_TEXT, stopp: true }; }
      if (b.art === 'erledigt') { const nach = (daten as { eventId?: unknown } | null)?.eventId, von = e.koerper.eventId; if (typeof nach === 'string' && typeof von === 'string' && nach !== von) this.umgehaengt[von] = nach; await this.speicher.entferne(e.id); raus.gesendet.push(e); raus.antworten[e.id] = daten; this.antworten[e.id] = daten; this.gesendetZahl++; continue; }
      if (b.art === 'fehler') { await this.speicher.setze({ ...e, versuche: e.versuche + 1, status: 'fehler', hinweis: b.text, ...(b.teilweise ? { teilweise: true } : {}), ...(b.eventFehler ? { eventFehler: true } : {}) }); continue; }
      if (b.art === 'andere') { await this.speicher.setze({ ...e, hinweis: b.grund }); continue; } // wartet auf die richtige Person — die übrigen laufen weiter
      if (b.art === 'neuladen') { await this.speicher.setze({ ...e, versuche: e.versuche + 1, hinweis: b.grund }); raus.neuLaden = true; this.neuLadenNoetig = true; return 'stopp'; }
      // wiederholen
      const versuche = e.versuche + 1;
      if (b.stopp) { await this.speicher.setze({ ...e, versuche, hinweis: b.grund }); return 'stopp'; } // das Netz fehlt für alle
      // Serverfehler an dieser Erfassung: nach drei Versuchen „Fehler“ (sichtbar, erneut versuchbar) — die nächste kommt trotzdem dran.
      if (versuche >= MAX_SERVER_VERSUCHE) await this.speicher.setze({ ...e, versuche, status: 'fehler', hinweis: `Der Server konnte diese Erfassung nach ${MAX_SERVER_VERSUCHE} Versuchen nicht speichern: ${b.grund} Sie bleibt auf dem Gerät.`, ...(b.teilweise ? { teilweise: true } : {}) });
      else await this.speicher.setze({ ...e, versuche, hinweis: b.grund, ...(b.teilweise ? { teilweise: true } : {}) });
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

/**
 * Die EINE Warteschlange dieses Browsers (IndexedDB, sonst Arbeitsspeicher): Sender im /os-Rahmen, Netzwerken-Seite und Abmelden
 * teilen sie — so gibt es nur einen Lauf zur Zeit, nie zwei Sender, die dieselbe Erfassung gleichzeitig versuchen.
 */
export function geteilteWarteschlange(): Warteschlange {
  const G = globalThis as unknown as { __makeosNetzwerkenQueue?: Warteschlange };
  return (G.__makeosNetzwerkenQueue ??= new Warteschlange(ausfallsicher(indexedDbSpeicher()), fetchSender()));
}
