// ─── Telegram minimieren (05.10., DSGVO-Paket „KI, Gesundheit, Telegram“) ───────────────────────────────────────────
// Telegram-Bot-Chats sind NICHT Ende-zu-Ende-verschlüsselt, der Anbieter sitzt außerhalb der EU (Drittland). Deshalb gehen
// per Telegram nur noch neutrale Hinweise („Neue Nachricht in MAKE OS“ mit Link) — keine Gesundheitswerte, keine
// CRM-/Vertrags-Inhalte, keine ZOE-Antworttexte. Ausnahme je Person, ausdrücklich einzuschalten (System › Datenschutz,
// Vorgabe aus): „ZOE-Antworten vollständig über Telegram“ — dann kommen ZOE-Antworten und die Fragen des
// Gesundheits-Takts wie früher im Wortlaut (mit Hinweis, Zeitpunkt und Fassung als Nachweis).
// Rein, ohne Abhängigkeiten — geprüft im Wächter tests/ki-datenschutz.test.ts („Telegram-Text ohne Inhalte“).

export const TELEGRAM_VOLL_FASSUNG = 'telegram-voll-2026-10-05';
export const TELEGRAM_VOLL_HINWEIS = 'Telegram-Nachrichten von Bots sind nicht Ende-zu-Ende-verschlüsselt; der Dienst sitzt außerhalb der EU (Drittland). Schaltest du das ein, schickt MAKE OS dir ZOEs Antworten und die Fragen des Gesundheits-Takts vollständig über Telegram — sie können Gesundheits-, Kontakt- und Vertragsangaben enthalten. Ohne diese Ausnahme kommt nur ein Hinweis mit Link. Jederzeit wieder ausschaltbar.';

/** Link in die App (Instanz-Adresse aus der Umgebung) — ohne Adresse nur der Pfad. */
export function appLink(adresse: string | null | undefined, pfad: string): string {
  const basis = (adresse ?? '').trim().replace(/\/+$/, '');
  return `${basis}${pfad.startsWith('/') ? pfad : `/${pfad}`}`;
}

/** Neutraler Hinweis: eine neue Nachricht von ZOE liegt in MAKE OS. */
export const hinweisNeueNachricht = (link: string) => `Neue Nachricht in MAKE OS — ${link}`;

/** Neutraler Hinweis für die Takt-Slots des Gesundheitsbereichs (ohne Werte, ohne Fragen zu Beschwerden). */
export function hinweisCheckIn(name: string, slot: 'morgen' | 'mittag' | 'abend' | 'woche', link: string): string {
  const was = slot === 'morgen' ? 'Dein Morgen-Check' : slot === 'mittag' ? 'Dein Mittags-Check' : slot === 'abend' ? 'Dein Tagesabschluss' : 'Dein Wochenrückblick';
  return `${name}, ${was} wartet in MAKE OS — ${link}`;
}

/** Hinweis zur Kopplung — neutral, ohne Personen oder Haushalt zu nennen (Plattform-Regel). */
export const TELEGRAM_FREMD = 'Dieser Bot gehört zu einer privaten MAKE-OS-Instanz. Koppeln geht nur aus MAKE OS heraus (Konto › Telegram).';

/**
 * Prüft einen Telegram-Text auf Inhalte, die dort nicht hingehören (rein, für den Wächter): Gesundheitswerte (Recovery,
 * Schlaf, HRV, Puls, Haut, Schub, Verlangen …), Geldbeträge, E-Mail-Adressen. Leere Liste = sauber.
 */
export function telegramInhalteFinden(text: string): string[] {
  const funde: string[] = [];
  if (/recovery|erholung\s*\d|schlaf\s*\d|\bhrv\b|ruhepuls|puls\s*\d|juckreiz|schub|verlangen|sauber geblieben|haut\b/i.test(text)) funde.push('gesundheit');
  if (/\d[\d.]*,?\d*\s?(€|eur\b)|€\s?\d/i.test(text)) funde.push('betrag');
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(text)) funde.push('adresse');
  return funde;
}
