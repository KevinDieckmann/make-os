// ─── MAKE OS — Der Bote (Telegram) ──────────────────────────────────────────
// Kevins Entscheidung vom 23.09.: Jarvis erreicht ihn über Telegram, wenn
// die App nicht offen ist. Ein Bot, zwei Chats — Kevin und Malin.
//
// Sicherheit, weil ein Bot im Netz von jedem angeschrieben werden kann:
//   · Ein Chat wird erst durch einen Kopplungscode zu einer Person. Den Code
//     erzeugt die Software für die angemeldete Person; er gilt 15 Minuten.
//   · Ein unbekannter Chat bekommt genau einen Satz und sonst nichts —
//     keine Daten, keine Werkzeuge, kein Jarvis.
//   · Der Bot-Token liegt nur in .env.local. Nie im Vault, nie im Repo.
//
// Die reinen Teile (Codes, Zuordnung) sind ohne Netz prüfbar.

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Person } from '@/lib/jarvis/raum';

export interface Kopplung { chatId: number; person: Person; seit: string; name?: string }
export interface TelegramStand {
  kopplungen: Kopplung[];
  codes: Record<string, { person: Person; bis: string }>;
  /** Letzte verarbeitete update_id — damit nach einem Neustart nichts doppelt kommt. */
  letzteUpdate?: number;
}

const STORE = 'telegram';
const CODE_ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne 0/O, 1/I
export const CODE_MINUTEN = 15;

export function telegramKonfiguriert(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export function neuerCode(zufall: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_ZEICHEN[Math.floor(zufall() * CODE_ZEICHEN.length)];
  return c;
}

export function leererStand(): TelegramStand {
  return { kopplungen: [], codes: {} };
}

/** Abgelaufene Codes wegräumen — bei jedem Zugriff, damit nichts liegen bleibt. */
export function aufraeumen(stand: TelegramStand, jetzt: Date): TelegramStand {
  const codes = Object.fromEntries(Object.entries(stand.codes ?? {}).filter(([, v]) => Date.parse(v.bis) > jetzt.getTime()));
  return { ...stand, codes };
}

export function codeAnlegen(stand: TelegramStand, person: Person, jetzt: Date, zufall?: () => number): { stand: TelegramStand; code: string } {
  const s = aufraeumen(stand, jetzt);
  // Alte Codes derselben Person verfallen: es gilt immer nur der neueste.
  for (const [c, v] of Object.entries(s.codes)) if (v.person === person) delete s.codes[c];
  const code = neuerCode(zufall);
  s.codes[code] = { person, bis: new Date(jetzt.getTime() + CODE_MINUTEN * 60_000).toISOString() };
  return { stand: s, code };
}

export function loeseCode(stand: TelegramStand, code: string, chatId: number, jetzt: Date, name?: string):
  { stand: TelegramStand; person?: Person; grund?: string } {
  const s = aufraeumen(stand, jetzt);
  const c = code.trim().toUpperCase();
  const eintrag = s.codes[c];
  if (!eintrag) return { stand: s, grund: 'Code unbekannt oder abgelaufen.' };
  delete s.codes[c];
  // Ein Chat gehört genau einer Person, eine Person kann mehrere Chats haben
  // (Handy und Laptop). Derselbe Chat wird neu zugeordnet, nicht verdoppelt.
  s.kopplungen = s.kopplungen.filter(k => k.chatId !== chatId);
  s.kopplungen.push({ chatId, person: eintrag.person, seit: jetzt.toISOString(), ...(name ? { name: name.slice(0, 60) } : {}) });
  return { stand: s, person: eintrag.person };
}

export function personFuerChat(stand: TelegramStand, chatId: number): Person | undefined {
  return stand.kopplungen.find(k => k.chatId === chatId)?.person;
}

export function chatsFuerPerson(stand: TelegramStand, person: Person): number[] {
  return stand.kopplungen.filter(k => k.person === person).map(k => k.chatId);
}

// ── Speicher ────────────────────────────────────────────────────────────────

export async function ladeStand(): Promise<TelegramStand> {
  const s = await loadJson<TelegramStand>(STORE);
  return s && Array.isArray(s.kopplungen) ? { ...s, codes: s.codes ?? {} } : leererStand();
}

export async function aendereStand(mut: (s: TelegramStand) => TelegramStand): Promise<TelegramStand> {
  return updateJson<TelegramStand>(STORE, current => mut(current && Array.isArray(current.kopplungen) ? { ...current, codes: current.codes ?? {} } : leererStand()));
}

// ── Senden ──────────────────────────────────────────────────────────────────

const API = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
/** Telegram nimmt 4096 Zeichen je Nachricht. */
const MAX = 3900;

/** Lange Texte an Absatzgrenzen teilen — nie mitten im Satz. */
export function teile(text: string, max = MAX): string[] {
  if (text.length <= max) return [text];
  const raus: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let schnitt = rest.lastIndexOf('\n\n', max);
    if (schnitt < max / 2) schnitt = rest.lastIndexOf('\n', max);
    if (schnitt < max / 2) schnitt = rest.lastIndexOf(' ', max);
    if (schnitt < max / 2) schnitt = max;
    raus.push(rest.slice(0, schnitt).trim());
    rest = rest.slice(schnitt).trim();
  }
  if (rest) raus.push(rest);
  return raus;
}

export async function sendeAnChat(chatId: number, text: string): Promise<{ ok: boolean; fehler?: string }> {
  if (!telegramKonfiguriert()) return { ok: false, fehler: 'TELEGRAM_BOT_TOKEN fehlt.' };
  try {
    for (const stueck of teile(text)) {
      const r = await fetch(`${API()}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Kein parse_mode: Jarvis' Antworten enthalten Sternchen und Klammern,
        // und Markdown-Fehler lassen Telegram die ganze Nachricht ablehnen.
        body: JSON.stringify({ chat_id: chatId, text: stueck, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) return { ok: false, fehler: `Telegram ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message.slice(0, 120) : 'Fehler' };
  }
}

/** An alle Chats einer Person. Liefert, wie viele erreicht wurden. */
export async function sendeAnPerson(person: Person, text: string): Promise<{ erreicht: number; fehler?: string }> {
  const stand = await ladeStand();
  const chats = chatsFuerPerson(stand, person);
  if (!chats.length) return { erreicht: 0, fehler: `${person} ist nicht gekoppelt.` };
  let erreicht = 0; let fehler: string | undefined;
  for (const c of chats) { const r = await sendeAnChat(c, text); if (r.ok) erreicht++; else fehler = r.fehler; }
  return { erreicht, ...(fehler ? { fehler } : {}) };
}
