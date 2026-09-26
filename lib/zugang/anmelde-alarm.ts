// ─── Anmelde-Alarm (rein, getestet, 27.09.) ─────────────────────────────────
// Sicherheitspaket A (26.09. besprochen, 27.09. gebaut): Kevin und Malin
// erfahren per Telegram, wenn sich jemand von einer NEUEN Adresse anmeldet
// oder wenn jemand ihr Passwort zu oft falsch eingibt. Die Adresse ist wie im
// Anmelde-Protokoll gekürzt (Netz, nicht Gerät) — genug, um „das war ich nicht“
// zu erkennen. Die Entscheidung steht hier ohne Dateizugriff; gesendet wird in
// der Anmelde-Route.

import type { Anmeldung } from './anmeldungen';

/** So viele erfolgreiche Anmeldungen zurück gilt eine Adresse als „bekannt“. */
export const BEKANNT_FENSTER = 30;
/** Fehlschläge in diesem Fenster … */
export const FEHL_MINUTEN = 10;
/** … ab dieser Zahl lösen sie einen Alarm aus. */
export const FEHL_AB = 5;
/** Nach einem Alarm derselben Art frühestens wieder nach so vielen Minuten. */
export const RUHE_MINUTEN = 30;

/** Neue Adresse: keine der letzten erfolgreichen Anmeldungen dieses Kontos kam aus diesem Netz. Beim allerersten Login gibt es keinen Alarm. */
export function neueAdresse(eintraege: Anmeldung[], speicher: string, adresse: string): boolean {
  const erfolge = eintraege.filter(e => e.speicher === speicher && e.art === 'anmelden' && e.ok).slice(-BEKANNT_FENSTER);
  if (!erfolge.length) return false;
  return !erfolge.some(e => e.adresse === adresse);
}

/** Zu viele Fehlschläge für dieses Konto im Fenster (die aktuelle Fehlmeldung ist schon eingetragen). */
export function zuVieleFehlschlaege(eintraege: Anmeldung[], speicher: string, jetzt: string, minuten = FEHL_MINUTEN, ab = FEHL_AB): { alarm: boolean; anzahl: number; adressen: string[] } {
  const ab_ms = Date.parse(jetzt) - minuten * 60_000;
  const fehl = eintraege.filter(e => e.speicher === speicher && e.art === 'anmelden' && !e.ok && Date.parse(e.zeit) >= ab_ms);
  return { alarm: fehl.length >= ab && fehl.length % ab === 0, anzahl: fehl.length, adressen: Array.from(new Set(fehl.map(e => e.adresse))) };
}

const zuletzt = new Map<string, number>();
/** Höchstens ein Alarm je Konto und Art in RUHE_MINUTEN — sonst wird ein Angriff zur Nachrichtenflut. */
export function darfMelden(schluessel: string, jetztMs = Date.now(), ruheMinuten = RUHE_MINUTEN): boolean {
  const l = zuletzt.get(schluessel) ?? 0;
  if (jetztMs - l < ruheMinuten * 60_000) return false;
  zuletzt.set(schluessel, jetztMs);
  return true;
}
export function alarmeVergessen(): void { zuletzt.clear(); }

const uhr = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function textNeueAdresse(adresse: string, jetzt: string): string {
  return `🔐 MAKE OS: Neue Anmeldung in dein Konto um ${uhr(jetzt)} Uhr aus dem Netz ${adresse}. Warst du das nicht: unter Konto „alle anderen Geräte abmelden“ und das Passwort ändern.`;
}
export function textFehlschlaege(anzahl: number, adressen: string[], jetzt: string): string {
  return `🔐 MAKE OS: ${anzahl} falsche Passwörter für dein Konto in ${FEHL_MINUTEN} Minuten (bis ${uhr(jetzt)} Uhr) aus ${adressen.join(', ')}. Die Anmeldung ist gebremst; der Zweite Faktor schützt zusätzlich.`;
}
