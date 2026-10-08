'use client';

// ─── Inbox 2 — Browser: Typen und Aufrufe (06.10.2026) ──────────────────────────────────────────────────────────
// EIN Ort für die Wege der Oberfläche zu /api/inbox/*. Der Browser kennt nur Gesprächs-Kennungen (keine Nachrichten-Kennungen beim
// Schreiben) und nie ein Passwort. `cache: 'no-cache'` lässt den Browser mit ETag nachfragen (304 beim 60-s-Abgleich).

import type { Gespraech, LageZeile, ZoeSatz } from '@/lib/inbox/strom';
import type { PostfachOeffentlich } from '@/lib/postfach/typen';
import type { GespraechAnsicht } from '@/lib/inbox/gespraech-server';
import type { Uebergabe, UebergabeZeile } from '@/lib/inbox/teilen';
import type { SuchTreffer } from '@/lib/inbox/suche-server';

export type { UebergabeZeile, Uebergabe, SuchTreffer };

export type GespraechZeile = Omit<Gespraech, 'nachrichten'>;
export interface StromAntwort {
  ok: boolean; postfaecher: PostfachOeffentlich[]; gespraeche: GespraechZeile[]; lage: LageZeile[]; zoe: ZoeSatz;
  bereiche: { id: string; name: string }[]; google: { konfiguriert: boolean; verbunden: boolean; bereit: boolean; konto?: string; getrennt?: boolean }; heute: string; fehler?: string;
  /** Übergaben an bzw. von mir (08.10., ohne Texte). */
  uebergaben: UebergabeZeile[];
}
/** Eine Übergabe geöffnet (GET /api/inbox/uebergaben?id=): Kopie, Zeile, neuere Nachrichten im Original, Postfächer zum Antworten. */
export interface UebergabeDetail { ok: boolean; uebergabe: Uebergabe; zeile: UebergabeZeile; neuer: number; postfaecher: { id: string; name: string; adresse: string }[]; fehler?: string }
/** Suche (GET /api/inbox/suche). */
export interface SuchAntwort { ok: boolean; treffer: SuchTreffer[]; gesamt: number; ab: number; seite: number; hinweis?: string; fehler?: string }
/** Eine Übergabe-Kennung (`ub-<uuid>`) — die Inbox öffnet sie über denselben Link-Parameter `offen` wie ein Gespräch. */
export const istUebergabeId = (v: string | null | undefined): v is string => !!v && /^ub-[0-9a-f-]{36}$/.test(v);
export type Ansicht = Omit<GespraechAnsicht, 'gespraech'> & { gespraech: GespraechZeile; ok: boolean; fehler?: string };

export interface PostfaecherAntwort {
  ok: boolean; postfaecher: PostfachOeffentlich[]; bereiche: { id: string; name: string }[];
  anbieter: { id: string; name: string; passwortWort: string; anleitung: string[]; link?: { text: string; url: string }; sendeHinweis?: string; eigeneServer: boolean }[];
  demo: boolean; absender: { adresse: string; status: 'zugelassen' | 'geblockt'; seit: string }[];
  google: StromAntwort['google']; fehler?: string;
  /** Business-Sicht (07.10. abends): der Server hat auf Business-Postfächer gefiltert. */
  nurBusiness?: boolean;
  /** Team-Postfächer anderer Personen, die ich sehe (08.10., nur ansehen). */
  mitDirGeteilt?: { id: string; anzeigename: string; bereichName: string; adresse: string; besitzerName: string; zustand: PostfachOeffentlich['zustand'] }[];
}

export interface Ergebnis<T = Record<string, unknown>> { status: number; d: T & { ok?: boolean; fehler?: string; code?: string; text?: string } }

export async function holen<T>(url: string): Promise<Ergebnis<T>> {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    return { status: r.status, d: await r.json().catch(() => ({})) as Ergebnis<T>['d'] };
  } catch { return { status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } as Ergebnis<T>['d'] }; }
}

export async function senden<T = Record<string, unknown>>(url: string, body: unknown): Promise<Ergebnis<T>> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, d: await r.json().catch(() => ({})) as Ergebnis<T>['d'] };
  } catch { return { status: 0, d: { ok: false, fehler: 'Keine Verbindung — nichts geändert.' } as Ergebnis<T>['d'] }; }
}

export const aktion = (id: string, a: string, extra: Record<string, unknown> = {}) => senden<{ text?: string }>('/api/inbox', { aktion: a, id, ...extra });
/** Übergabe-Aktion (zurueck · erledigt · wieder · kuemmert · aktualisieren) bzw. `uebergeben` (mit `gespraech`, `an`). */
export const uebergabeAktion = (a: string, extra: Record<string, unknown>) => senden<{ text?: string; id?: string }>('/api/inbox/uebergaben', { aktion: a, ...extra });
/** „Wer kümmert sich“ (Team-Postfach, WhatsApp) — mit dem gesehenen Stand (409 bei fremder Änderung). */
export const kuemmern = (id: string, wer: string | null, stand: string) => senden<{ text?: string; stand?: string; konflikt?: boolean }>('/api/inbox', { aktion: 'kuemmert', id, wer, stand });

/** „vor 5 Min.“, „3 Std.“, „gestern“, „Mo“, „12.10.“ (rein). */
export function zeitKurz(iso: string, jetzt = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((jetzt - t) / 60_000);
  if (min < 1) return 'jetzt';
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} Std.`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'gestern';
  if (d < 7) return new Date(t).toLocaleDateString('de-DE', { weekday: 'short' });
  return new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export const datumLang = (iso: string) => new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
export const groesse = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

/** Tage für „Später“ (Berliner Tag im Browser). */
export function tagIn(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function naechsterMontag(): string { const d = new Date(); const n = ((8 - d.getDay()) % 7) || 7; return tagIn(n); }

/** Name der Gegenseite für Zeilen und Sätze. */
export const nameVon = (g: Pick<GespraechZeile, 'zuordnung' | 'gegenueber'>) => g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email;

/** Wohin ein Anhang zeigt (Gmail: eigener Weg; IMAP: /api/inbox/anhang; WhatsApp: /api/whatsapp/medien — eigener Server, nie Meta). */
export function anhangLink(quelle: string, nachricht: string, teil: string): string {
  if (quelle === 'whatsapp') return `/api/whatsapp/medien?id=${encodeURIComponent(nachricht)}`;
  return quelle === 'gmail'
    ? `/api/gmail/anhang?id=${encodeURIComponent(nachricht)}&teil=${encodeURIComponent(teil)}`
    : `/api/inbox/anhang?nachricht=${encodeURIComponent(nachricht)}&teil=${encodeURIComponent(teil)}`;
}

/** Wie lang ist es her — „vor 5 Min.“, „vor 2 Std.“, „vor 3 Tagen“ (Statuszeile der Postfächer; rein). */
export function vorText(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'noch nie';
  if (min < 1) return 'gerade eben';
  if (min < 120) return `vor ${min} Min.`;
  if (min < 48 * 60) return `vor ${Math.round(min / 60)} Std.`;
  return `vor ${Math.round(min / 1440)} Tagen`;
}
