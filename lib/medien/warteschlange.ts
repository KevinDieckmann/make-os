// ─── Medien — Warteschlange auf dem Gerät und Sender (Browser, 09.10., Paket 5) ─────────────────────────────────────────────
// Muster: lib/netzwerken/warteschlange.ts (IndexedDB, AES-GCM mit NICHT exportierbarem WebCrypto-Schlüssel, `ausfallsicher`, idempotent
// per UUID, Sender im /os-Rahmen). Anders als dort: Medien sind groß — gespeichert wird je 8-MiB-Stück ein verschlüsselter Block (nie das
// ganze Video im Speicher, nie Base64). Was nicht aufs Gerät passt (Speicher voll, privates Fenster), liest der Sender direkt aus der
// gewählten Datei — dann „Seite offen lassen“ (Hinweis), bis gesendet.
// Ablauf je Eintrag: anlegen (POST /api/medien/upload, gleiche UUID = gleiche Sitzung) → Vorschauen → fehlende Stücke (Kopf `x-make-sha256`,
// gesendetes Stück wird vom Gerät gelöscht) → fertig (Prüfsumme über die Stück-Prüfsummen). Abbruch, Neuladen, Netz weg: beim nächsten
// Lauf fragt der Server, was fehlt. iOS hält Uploads im Hintergrund an — Wake Lock hält den Bildschirm an, solange gesendet wird.
// Medien werden auf dem Gerät NICHT nach 30 Tagen verworfen (eigene Aufnahmen; research/agenten/MEDIEN.md D3) — ab 14 Tagen ein Hinweis.
// Bewertung der Antworten und Ablauf rein (getestet mit dem Arbeitsspeicher und einem Sender-Fake, tests/medien-warteschlange.test.ts).

import { patchesAnwenden, type Patch } from './mp4-ort';
import { GRENZEN, teileVon, teilLaenge } from './typen';

export type MedienStatus = 'wartet' | 'fehler';
export interface MedienEintrag {
  /** UUID — zugleich Kennung der Upload-Sitzung (`up-<uuid>`) und des Mediums (`md-<uuid>`). */
  id: string;
  person?: string;
  angelegt: number;
  status: MedienStatus;
  hinweis?: string;
  versuche: number;
  /** Körper für POST /api/medien/upload (ohne `id`). */
  anlegen: Record<string, unknown>;
  bytes: number;
  teile: number;
  teilHashes: string[];
  /** Vorschauen, die es auf dem Gerät gibt (Schlüssel im Stück-Speicher). */
  vorschau: ('raster' | 'ansicht' | 'poster')[];
  anzeige: { name: string; art: 'bild' | 'video' };
  /** Stücke liegen nicht (alle) auf dem Gerät — gelesen wird aus der Datei, solange die Seite offen ist. */
  nurDatei?: boolean;
}

export interface MedienGeraet {
  alle(): Promise<MedienEintrag[]>;
  setze(e: MedienEintrag): Promise<void>;
  entferne(id: string): Promise<void>;
  stueckSetzen(id: string, teil: string, b: Uint8Array): Promise<void>;
  stueck(id: string, teil: string): Promise<Uint8Array | null>;
  stueckWeg(id: string, teil: string): Promise<void>;
}

export const MEDIEN_ALT_TAGE = 14;
export const MEDIEN_WARTET = 'Wird gesendet, sobald Netz da ist — App offen lassen bei großen Videos.';
export const MEDIEN_NUR_DATEI = 'Der Speicher des Geräts reicht nicht — bitte die Seite offen lassen, bis gesendet.';

/** Gerät im Arbeitsspeicher (Tests, Rückfall). */
export function ramGeraet(): MedienGeraet {
  const e = new Map<string, MedienEintrag>(), s = new Map<string, Uint8Array>();
  return {
    alle: async () => Array.from(e.values()).map(x => structuredClone(x)),
    setze: async x => { e.set(x.id, structuredClone(x)); },
    entferne: async id => { e.delete(id); for (const k of Array.from(s.keys())) if (k.startsWith(`${id}#`)) s.delete(k); },
    stueckSetzen: async (id, t, b) => { s.set(`${id}#${t}`, b.slice()); },
    stueck: async (id, t) => s.get(`${id}#${t}`) ?? null,
    stueckWeg: async (id, t) => { s.delete(`${id}#${t}`); },
  };
}

// ── Prüfsummen (WebCrypto) ───────────────────────────────────────────────────────────────────────────────────────────────

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
export const sha256Hex = async (b: Uint8Array): Promise<string> => hex(await globalThis.crypto.subtle.digest('SHA-256', b as BufferSource));
/** Wie der Server (`pruefsummeAusTeilen`): SHA-256 über die rohen Stück-Prüfsummen in Reihenfolge. */
export async function pruefsumme(teilHashes: readonly string[]): Promise<string> {
  const roh = new Uint8Array(teilHashes.length * 32);
  teilHashes.forEach((h, i) => { for (let k = 0; k < 32; k++) roh[i * 32 + k] = parseInt(h.slice(2 * k, 2 * k + 2), 16); });
  return sha256Hex(roh);
}

// ── Quellen im Arbeitsspeicher (Datei + Patches), wenn das Gerät die Stücke nicht nimmt ─────────────────────────────────────

const QUELLEN = new Map<string, { datei: Blob; patches: Patch[] }>();
async function ausDatei(id: string, nr: number, bytes: number): Promise<Uint8Array | null> {
  const q = QUELLEN.get(id);
  if (!q) return null;
  const von = nr * GRENZEN.teil;
  const roh = new Uint8Array(await q.datei.slice(von, von + teilLaenge(bytes, nr)).arrayBuffer());
  return patchesAnwenden(roh, von, q.patches);
}

// ── Senden ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Antwort { status: number; daten: unknown }
export interface MedienSender {
  anlegen(id: string, koerper: Record<string, unknown>): Promise<Antwort>;
  vorschau(id: string, variante: string, b: Uint8Array): Promise<Antwort>;
  teil(id: string, nr: number, b: Uint8Array, sha: string): Promise<Antwort>;
  fertig(id: string, pruefsumme: string): Promise<Antwort>;
}

export type Bewertung = { art: 'ok' } | { art: 'stopp'; grund: string } | { art: 'wiederholen'; grund: string } | { art: 'fehler'; text: string } | { art: 'neu-anlegen' } | { art: 'neuladen' };

/** Antwort bewerten: kein Netz/abgemeldet/gedrosselt/Server voll → alle warten; 5xx → wiederholen; Eingabe/Rechte → Fehler (bleibt liegen). */
export function bewerten(status: number, d: unknown): Bewertung {
  const o = (d && typeof d === 'object' ? d : {}) as { ok?: unknown; fehler?: unknown; neuLaden?: unknown };
  if (status >= 200 && status < 300 && o.ok !== false) return { art: 'ok' };
  const text = typeof o.fehler === 'string' && o.fehler ? o.fehler : `Nicht gespeichert (Fehler ${status}).`;
  if (status === 409 && o.neuLaden === true) return { art: 'neuladen' };
  if (status === 0 || status === 429) return { art: 'stopp', grund: MEDIEN_WARTET };
  if (status === 401) return { art: 'stopp', grund: 'Bitte neu anmelden — die Medien bleiben auf dem Gerät.' };
  if (status === 503 || status === 507) return { art: 'stopp', grund: text };
  if (status === 404) return { art: 'neu-anlegen' };
  if (status === 408 || status >= 500) return { art: 'wiederholen', grund: text };
  return { art: 'fehler', text };
}

const MAX_VERSUCHE = 3;

export class MedienSchlange {
  private laeuft = false;
  private hoerer = new Set<() => void>();
  person: string | null = null;
  /** Fortschritt je Eintrag (gesendete Bytes) — für die Anzeige. */
  readonly fortschritt = new Map<string, number>();
  /** Fertig gesendete Medien seit dem Laden (die Galerie lädt dann neu). */
  fertigZahl = 0;
  neuLadenNoetig = false;
  constructor(private geraet: MedienGeraet, private sender: MedienSender) {}

  beiAenderung(f: () => void): () => void { this.hoerer.add(f); return () => { this.hoerer.delete(f); }; }
  private geaendert(): void { for (const f of this.hoerer) { try { f(); } catch { /* nie den Lauf stören */ } } }
  async alle(): Promise<MedienEintrag[]> { return (await this.geraet.alle()).sort((a, b) => a.angelegt - b.angelegt); }

  /**
   * Ein vorbereitetes Medium ablegen: Stücke (Patches angewandt, SHA-256) verschlüsselt aufs Gerät; was nicht passt, bleibt als Datei-Quelle
   * im Arbeitsspeicher. `daten` (Foto) oder `datei` + `patches` (Video).
   */
  async ablegen(e: { id: string; person?: string; anlegen: Record<string, unknown>; bytes: number; daten: Uint8Array | null; datei: Blob | null; patches: Patch[]; vorschau: Partial<Record<'raster' | 'ansicht' | 'poster', Blob>>; anzeige: MedienEintrag['anzeige'] }, beiFortschritt?: (anteil: number) => void): Promise<MedienEintrag> {
    const da = (await this.geraet.alle()).find(x => x.id === e.id);
    if (da) return da;
    const teile = teileVon(e.bytes);
    const quelle: Blob = e.daten ? new Blob([e.daten as BlobPart]) : e.datei!;
    const teilHashes: string[] = [];
    let nurDatei = false;
    for (let nr = 0; nr < teile; nr++) {
      const von = nr * GRENZEN.teil;
      const roh = new Uint8Array(await quelle.slice(von, von + teilLaenge(e.bytes, nr)).arrayBuffer());
      const b = e.daten ? roh : patchesAnwenden(roh, von, e.patches);
      teilHashes.push(await sha256Hex(b));
      if (!nurDatei) { try { await this.geraet.stueckSetzen(e.id, String(nr), b); } catch { nurDatei = true; } }
      beiFortschritt?.((nr + 1) / teile);
    }
    if (nurDatei) QUELLEN.set(e.id, { datei: quelle, patches: e.daten ? [] : e.patches });
    const vorschau: MedienEintrag['vorschau'] = [];
    for (const [k, v] of Object.entries(e.vorschau) as ['raster' | 'ansicht' | 'poster', Blob | undefined][]) {
      if (!v) continue;
      try { await this.geraet.stueckSetzen(e.id, k, new Uint8Array(await v.arrayBuffer())); vorschau.push(k); }
      catch { QUELLEN.set(`${e.id}#${k}`, { datei: v, patches: [] }); vorschau.push(k); }
    }
    const eintrag: MedienEintrag = { id: e.id, ...(e.person ? { person: e.person } : {}), angelegt: Date.now(), status: 'wartet', hinweis: nurDatei ? MEDIEN_NUR_DATEI : MEDIEN_WARTET, versuche: 0, anlegen: e.anlegen, bytes: e.bytes, teile, teilHashes, vorschau, anzeige: e.anzeige, ...(nurDatei ? { nurDatei: true } : {}) };
    await this.geraet.setze(eintrag);
    this.geaendert();
    return eintrag;
  }

  async verwerfen(id: string): Promise<void> { await this.geraet.entferne(id); QUELLEN.delete(id); this.fortschritt.delete(id); this.geaendert(); }
  async erneut(id: string): Promise<void> {
    const e = (await this.geraet.alle()).find(x => x.id === id);
    if (e) { await this.geraet.setze({ ...e, status: 'wartet', versuche: 0, hinweis: MEDIEN_WARTET }); this.geaendert(); }
  }

  private async stueck(e: MedienEintrag, teil: string): Promise<Uint8Array | null> {
    const g = await this.geraet.stueck(e.id, teil).catch(() => null);
    if (g) return g;
    if (/^\d+$/.test(teil)) return ausDatei(e.id, Number(teil), e.bytes);
    const q = QUELLEN.get(`${e.id}#${teil}`);
    return q ? new Uint8Array(await q.datei.arrayBuffer()) : null;
  }

  /** Alles Wartende der angemeldeten Person nacheinander senden. */
  async senden(): Promise<{ fertig: number; wartend: number; fehler: number }> {
    if (this.laeuft) return { fertig: 0, wartend: 0, fehler: 0 };
    this.laeuft = true;
    let fertig = 0;
    try {
      for (const e of (await this.alle()).filter(x => x.status === 'wartet' && (!x.person || !this.person || x.person === this.person))) {
        const r = await this.einen(e);
        if (r === 'fertig') fertig++;
        if (r === 'stopp') break;
      }
    } finally { this.laeuft = false; this.geaendert(); }
    const rest = await this.alle();
    return { fertig, wartend: rest.filter(x => x.status === 'wartet').length, fehler: rest.filter(x => x.status === 'fehler').length };
  }

  private async einen(e: MedienEintrag): Promise<'fertig' | 'weiter' | 'stopp'> {
    const halt = async (b: Bewertung): Promise<'weiter' | 'stopp'> => {
      if (b.art === 'stopp') { await this.geraet.setze({ ...e, hinweis: b.grund }); return 'stopp'; }
      if (b.art === 'neuladen') { this.neuLadenNoetig = true; await this.geraet.setze({ ...e, hinweis: 'MAKE OS wurde aktualisiert — bitte die Seite neu laden. Die Medien bleiben auf dem Gerät.' }); return 'stopp'; }
      if (b.art === 'fehler') { await this.geraet.setze({ ...e, status: 'fehler', hinweis: b.text }); return 'weiter'; }
      const versuche = e.versuche + 1;
      const grund = b.art === 'wiederholen' ? b.grund : 'Der Upload war abgelaufen — er beginnt neu.';
      await this.geraet.setze({ ...e, versuche, ...(versuche >= MAX_VERSUCHE ? { status: 'fehler' as const, hinweis: `Nach ${MAX_VERSUCHE} Versuchen nicht gespeichert: ${grund}` } : { hinweis: grund }) });
      return 'weiter';
    };
    const fang = async <T,>(f: () => Promise<T>): Promise<T | Antwort> => { try { return await f(); } catch { return { status: 0, daten: null }; } };
    // 1 · anlegen (idempotent)
    const a = await fang(() => this.sender.anlegen(e.id, e.anlegen)) as Antwort;
    const ba = bewerten(a.status, a.daten);
    if (ba.art !== 'ok') return halt(ba.art === 'neu-anlegen' ? { art: 'fehler', text: 'Upload nicht angenommen.' } : ba);
    const d = a.daten as { fertig?: boolean; sitzung?: { fehlend: number[]; vorschau: string[] } };
    if (d.fertig) { await this.geraet.entferne(e.id); QUELLEN.delete(e.id); this.fertigZahl++; return 'fertig'; }
    const sitzung = d.sitzung ?? { fehlend: Array.from({ length: e.teile }, (_, i) => i), vorschau: [] };
    // 2 · Vorschauen
    for (const v of e.vorschau.filter(x => !sitzung.vorschau.includes(x))) {
      const b = await this.stueck(e, v);
      if (!b) continue;
      const r = await fang(() => this.sender.vorschau(e.id, v, b)) as Antwort;
      const bw = bewerten(r.status, r.daten);
      if (bw.art !== 'ok') return halt(bw);
    }
    // 3 · fehlende Stücke
    let gesendet = (e.teile - sitzung.fehlend.length) * GRENZEN.teil;
    for (const nr of sitzung.fehlend) {
      const b = await this.stueck(e, String(nr));
      if (!b) { await this.geraet.setze({ ...e, status: 'fehler', hinweis: 'Ein Stück fehlt auf dem Gerät (Seite neu geladen?) — bitte das Foto/Video neu auswählen.' }); return 'weiter'; }
      const r = await fang(() => this.sender.teil(e.id, nr, b, e.teilHashes[nr])) as Antwort;
      const bw = bewerten(r.status, r.daten);
      if (bw.art !== 'ok') return halt(bw);
      await this.geraet.stueckWeg(e.id, String(nr)).catch(() => {});
      gesendet += b.length;
      this.fortschritt.set(e.id, Math.min(1, gesendet / e.bytes));
      this.geaendert();
    }
    // 4 · fertig
    const f = await fang(async () => this.sender.fertig(e.id, await pruefsumme(e.teilHashes))) as Antwort;
    const bf = bewerten(f.status, f.daten);
    if (bf.art !== 'ok') return halt(bf);
    await this.geraet.entferne(e.id);
    QUELLEN.delete(e.id);
    for (const v of e.vorschau) QUELLEN.delete(`${e.id}#${v}`);
    this.fortschritt.delete(e.id);
    this.fertigZahl++;
    return 'fertig';
  }
}

/** Hinweis ab 14 Tagen (eigene Aufnahmen werden nie automatisch verworfen). */
export function altHinweis(e: Pick<MedienEintrag, 'angelegt'>, jetzt = Date.now()): string | null {
  const tage = Math.floor((jetzt - e.angelegt) / 864e5);
  return tage >= MEDIEN_ALT_TAGE ? `Liegt seit ${tage} Tagen auf dem Gerät und ist noch nicht gesendet — senden oder verwerfen.` : null;
}

// ── IndexedDB (verschlüsselt) und der Sender über fetch ──────────────────────────────────────────────────────────────────

/** IndexedDB mit nicht exportierbarem AES-GCM-Schlüssel; `null` ohne IndexedDB. Stücke tragen die AAD `<id>#<teil>`. */
export function indexedDbGeraet(name = 'make-os-medien'): MedienGeraet | null {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return null;
  const oeffnen = () => new Promise<IDBDatabase>((ok, nein) => {
    let fertig = false;
    const uhr = setTimeout(() => { fertig = true; nein(new Error('IndexedDB antwortet nicht')); }, 5000);
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      for (const s of ['eintraege', 'stuecke', 'schluessel']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, s === 'stuecke' ? undefined : { keyPath: 'id' });
    };
    r.onsuccess = () => { clearTimeout(uhr); if (fertig) r.result.close(); else { fertig = true; ok(r.result); } };
    r.onerror = () => { clearTimeout(uhr); nein(r.error ?? new Error('IndexedDB nicht verfügbar')); };
  });
  const lauf = async <T,>(store: string, modus: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
    const db = await oeffnen();
    try {
      return await new Promise<T | undefined>((ok, nein) => {
        const t = db.transaction(store, modus);
        const r = f(t.objectStore(store));
        t.oncomplete = () => ok(r ? r.result : undefined);
        t.onerror = () => nein(t.error ?? new Error('IndexedDB-Fehler'));
        t.onabort = () => nein(t.error ?? new Error('IndexedDB abgebrochen'));
      });
    } finally { db.close(); }
  };
  let schluessel: Promise<CryptoKey> | null = null;
  const key = () => (schluessel ??= (async () => {
    const da = await lauf<{ key?: CryptoKey }>('schluessel', 'readonly', s => s.get('medien'));
    if (da?.key) return da.key;
    const neu = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await lauf('schluessel', 'readwrite', s => { s.put({ id: 'medien', key: neu }); });
    return neu;
  })().catch(e => { schluessel = null; throw e; }));
  const aad = (id: string, t: string) => new TextEncoder().encode(`${id}#${t}`);
  return {
    alle: async () => (await lauf<MedienEintrag[]>('eintraege', 'readonly', s => s.getAll() as IDBRequest<MedienEintrag[]>)) ?? [],
    setze: async e => { await lauf('eintraege', 'readwrite', s => { s.put(e); }); },
    entferne: async id => {
      await lauf('eintraege', 'readwrite', s => { s.delete(id); });
      await lauf('stuecke', 'readwrite', s => { s.delete(IDBKeyRange.bound(`${id}#`, `${id}#￿`)); });
    },
    stueckSetzen: async (id, t, b) => {
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const daten = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(id, t) }, await key(), b as BufferSource);
      await lauf('stuecke', 'readwrite', s => { s.put({ iv, daten }, `${id}#${t}`); });
    },
    stueck: async (id, t) => {
      const x = await lauf<{ iv: Uint8Array; daten: ArrayBuffer }>('stuecke', 'readonly', s => s.get(`${id}#${t}`));
      if (!x) return null;
      return new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv: x.iv as BufferSource, additionalData: aad(id, t) }, await key(), x.daten));
    },
    stueckWeg: async (id, t) => { await lauf('stuecke', 'readwrite', s => { s.delete(`${id}#${t}`); }); },
  };
}

/** Fällt das Gerät aus, liegt alles im Arbeitsspeicher (Hinweis „Seite offen lassen“). */
export function ausfallsicherGeraet(primaer: MedienGeraet | null): MedienGeraet & { imArbeitsspeicher(): boolean } {
  const ram = ramGeraet();
  let ausgefallen = !primaer;
  const nimm = async <T,>(f: (g: MedienGeraet) => Promise<T>): Promise<T> => {
    if (primaer && !ausgefallen) { try { return await f(primaer); } catch { ausgefallen = true; } }
    return f(ram);
  };
  return {
    imArbeitsspeicher: () => ausgefallen,
    alle: async () => { const a = primaer ? await primaer.alle().catch(() => []) : []; const r = await ram.alle(); const ids = new Set(r.map(x => x.id)); return [...a.filter(x => !ids.has(x.id)), ...r]; },
    setze: e => nimm(g => g.setze(e)),
    entferne: async id => { await ram.entferne(id); if (primaer) await primaer.entferne(id).catch(() => {}); },
    stueckSetzen: (id, t, b) => nimm(g => g.stueckSetzen(id, t, b)),
    stueck: async (id, t) => (await ram.stueck(id, t)) ?? (primaer ? await primaer.stueck(id, t).catch(() => null) : null),
    stueckWeg: async (id, t) => { await ram.stueckWeg(id, t); if (primaer) await primaer.stueckWeg(id, t).catch(() => {}); },
  };
}

const ZEIT_MS = 180_000;
async function holen(url: string, init: RequestInit): Promise<Antwort> {
  const ctrl = new AbortController();
  const uhr = setTimeout(() => ctrl.abort(), ZEIT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    return { status: r.status, daten: await r.json().catch(() => null) };
  } finally { clearTimeout(uhr); }
}

export const fetchSender: MedienSender = {
  anlegen: (id, k) => holen('/api/medien/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...k, id }) }),
  vorschau: (id, v, b) => holen(`/api/medien/upload/up-${id}?variante=${v}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: b as BodyInit }),
  teil: (id, nr, b, sha) => holen(`/api/medien/upload/up-${id}?teil=${nr}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'x-make-sha256': sha }, body: b as BodyInit }),
  fertig: (id, p) => holen(`/api/medien/upload/up-${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pruefsumme: p }) }),
};

/** Die EINE Warteschlange dieses Browsers (Seite, Einstiege und Sender im /os-Rahmen teilen sie). */
export function geteilteMedienSchlange(): MedienSchlange {
  const G = globalThis as unknown as { __makeosMedienSchlange?: MedienSchlange };
  return (G.__makeosMedienSchlange ??= new MedienSchlange(ausfallsicherGeraet(indexedDbGeraet()), fetchSender));
}

/**
 * Abmelden (Muster Netzwerken `vorAbmelden`): liegen noch Medien der Person auf dem Gerät, erst nachfragen — „Ja“ löscht sie vom Gerät
 * (das Original bleibt in der Mediathek), „Nein“ bleibt angemeldet, damit gesendet werden kann. Ohne Medien: sofort weiter.
 */
export async function medienVorAbmelden(person: string | null, bestaetigen: (text: string) => Promise<boolean>, q: MedienSchlange = geteilteMedienSchlange()): Promise<boolean> {
  let eigene: MedienEintrag[] = [];
  try { eigene = (await q.alle()).filter(e => !e.person || !person || e.person === person); } catch { return true; }
  if (!eigene.length) return true;
  const ja = await bestaetigen(`${eigene.length === 1 ? 'Ein Foto/Video ist' : `${eigene.length} Fotos/Videos sind`} noch nicht gesendet. Beim Abmelden werden sie von diesem Gerät gelöscht (in der Mediathek bleiben sie). Trotzdem abmelden?`);
  if (!ja) return false;
  for (const e of eigene) await q.verwerfen(e.id).catch(() => {});
  return true;
}
