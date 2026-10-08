// ─── ZOE erreicht eine Person — EIN Sendeweg für Hinweise aufs Handy (Server, 08.10.2026) ─────────────────────────────────
// Kevin 08.10. (R5): „Zweite Business-Nummer nur für ZOE.“ Alles, was MAKE OS einer Person von sich aus schickt — Briefing am Morgen
// (Gesundheits-Takt, Markttraktion), Wochenstart/Rückblick, Erinnerungen, Head of IT, Sicherheits-Hinweise der Anmeldung — geht über
// `anPersonMelden`. Die Funktion wählt den Kanal:
//
//   1. ZOE auf WhatsApp (lib/zoe-whatsapp) — eingerichtet, die Person hat ihre Nummer per Code bestätigt und eingewilligt
//   2. sonst Telegram (lib/telegram.ts `sendeAnPerson`) — wie bisher, wenn gekoppelt
//   3. sonst nur die Glocke — NUR, wenn der Aufrufer das ausdrücklich will (`glocke: true`); die bisherigen Aufrufer tun es nicht,
//      damit sich ohne ZOE-Kanal nichts ändert (Test „ohne ZOE-Kanal wie bisher“)
//
// Dieselben Regeln wie Telegram (`telegramSicher`): neutral mit Link, Inhalte nur mit der Ausnahme der Person — für WhatsApp gilt die
// Ausnahme „Inhalte senden“ des ZOE-Kanals, für Telegram „ZOE-Antworten vollständig über Telegram“. Wer seinen Text je nach Ausnahme
// baut (Gesundheits-Takt), fragt vorher `inhalteErlaubtFuer` — das liefert die Ausnahme DES Kanals, der genutzt wird.
// Nie blockierend: Fehler kommen als `fehler` zurück, nie als Ausnahme.

import type { Person } from './raum';

/** Wofür die Meldung ist (Kosten-/Ruhe-Regel der Vorlage, Sammeln je Art, Glocke). */
export type MeldeArt = 'gesundheit' | 'briefing' | 'wochenstart' | 'rueckblick' | 'erinnerung' | 'markttraktion' | 'hoi' | 'sicherheit' | 'test';

export type BotenKanal = 'whatsapp' | 'telegram';
export interface MeldeErgebnis {
  /** Wo es ankam — `keiner`: kein Kanal (bzw. alle scheiterten). */
  kanal: BotenKanal | 'glocke' | 'keiner';
  /** Erreichte Geräte/Chats (WhatsApp: 1). */
  erreicht: number;
  fehler?: string;
  /** WhatsApp außerhalb des Fensters: Vorlage „Briefing bereit“ bzw. gesammelt bis zur nächsten Antwort. */
  wie?: 'frei' | 'vorlage' | 'gesammelt';
}

/** Gibt es überhaupt einen Boten auf dieser Instanz (ZOE-Nummer oder Telegram-Bot)? Für den Takt (reiht sonst nichts ein). */
export async function botenEingerichtet(): Promise<boolean> {
  const [{ zoeWhatsappEingerichtet }, { telegramKonfiguriert }] = await Promise.all([import('@/lib/zoe-whatsapp/konfig'), import('@/lib/telegram')]);
  return zoeWhatsappEingerichtet() || telegramKonfiguriert();
}

/** Über welchen Kanal erreicht MAKE OS diese Person gerade (ohne Glocke)? null = gar nicht. */
export async function botenKanalFuer(person: Person): Promise<BotenKanal | null> {
  const [{ zoeWhatsappEingerichtet }, { ladeKanal }, { kanalAktiv }] = await Promise.all([import('@/lib/zoe-whatsapp/konfig'), import('@/lib/zoe-whatsapp/speicher'), import('@/lib/zoe-whatsapp/senden')]);
  if (zoeWhatsappEingerichtet() && kanalAktiv(await ladeKanal(person).catch(() => ({ v: 1 as const, status: 'aus' as const, ereignisse: [] })))) return 'whatsapp';
  const t = await import('@/lib/telegram');
  if (t.telegramKonfiguriert() && t.chatsFuerPerson(await t.ladeStand(), person).length) return 'telegram';
  return null;
}

/** Darf der Kanal, der genutzt wird, Inhalte tragen? WhatsApp: Ausnahme „Inhalte senden“; sonst (auch ohne Kanal) wie bisher Telegram. */
export async function inhalteErlaubtFuer(person: Person): Promise<boolean> {
  try {
    if ((await botenKanalFuer(person)) === 'whatsapp') {
      const { ladeKanal } = await import('@/lib/zoe-whatsapp/speicher');
      return !!(await ladeKanal(person)).inhalte?.seit;
    }
    const { telegramVollFuer } = await import('@/lib/datenschutz/ki-einstellungen');
    return await telegramVollFuer(person);
  } catch { return false; }
}

const GLOCKE_TEXT = 'Neue Nachricht von ZOE — Details in MAKE OS.';

/** Eine Meldung an eine Person — über den Kanal, den sie hat (siehe Kopf). Wirft nie. */
export async function anPersonMelden(person: Person, art: MeldeArt, text: string, o: { link?: string; glocke?: boolean } = {}): Promise<MeldeErgebnis> {
  let fehler: string | undefined;
  try {
    if ((await botenKanalFuer(person)) === 'whatsapp') {
      const { zoeAnPersonSenden } = await import('@/lib/zoe-whatsapp/senden');
      const r = await zoeAnPersonSenden(person, art, text, { link: o.link });
      if (r.ok) return { kanal: 'whatsapp', erreicht: 1, wie: r.wie };
      fehler = r.grund === 'meta' ? r.fehler ?? 'WhatsApp: nicht zugestellt' : undefined;
    }
  } catch (e) { fehler = e instanceof Error ? e.message.slice(0, 120) : 'WhatsApp: Fehler'; }
  // Rückfall Telegram — genau der bisherige Weg (inkl. Sicherheitsnetz `telegramSicher`).
  try {
    const t = await import('@/lib/telegram');
    if (t.telegramKonfiguriert()) {
      const r = await t.sendeAnPerson(person, text);
      if (r.erreicht > 0) return { kanal: 'telegram', erreicht: r.erreicht };
      fehler = fehler ?? r.fehler;
    } else fehler = fehler ?? 'Kein Bote eingerichtet.';
  } catch (e) { fehler = fehler ?? (e instanceof Error ? e.message.slice(0, 120) : 'Telegram: Fehler'); }
  if (o.glocke) {
    const { melde } = await import('@/lib/meldungen/melden');
    await melde({ an: person, art: art === 'sicherheit' ? 'sicherheit' : 'zoe', titel: GLOCKE_TEXT, link: o.link ?? '/os' });
    return { kanal: 'glocke', erreicht: 0, ...(fehler ? { fehler } : {}) };
  }
  return { kanal: 'keiner', erreicht: 0, ...(fehler ? { fehler } : {}) };
}
