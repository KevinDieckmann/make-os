// ─── ZOE auf WhatsApp — Hinweise an eine Person senden (Server, 08.10.2026) ──────────────────────────────────────────────
// Aufgerufen NUR über lib/zoe/an-person.ts `anPersonMelden` (die eine Stelle, die den Kanal wählt) und für Antworten im Eingang
// (lib/zoe-whatsapp/eingang.ts). Regeln:
//   · Inhalte nur mit der Ausnahme „Inhalte senden“ der Person — sonst geht ein Text, der Gesundheitswerte, Beträge oder Adressen trägt,
//     als neutraler Hinweis mit Link hinaus (dieselbe Prüfung wie Telegram: `telegramInhalteFinden`). Die Absender bauen ihre Texte
//     ohnehin neutral; das hier fängt, was ein künftiger Absender vergisst.
//   · Im 24-h-Fenster frei; außerhalb NUR die genehmigte Vorlage „Briefing bereit“ (Name/Sprache einstellbar). Was sie ankündigt, liegt
//     in `ausstehend` (je Art die jüngste Nachricht) und geht hinaus, sobald die Person antwortet.
//   · Höchstens eine Vorlage je `vorlageStunden`, solange die Person nicht geantwortet hat (Kosten und Ruhe) — außer Sicherheits-
//     Hinweise. Weitere Nachrichten sammeln sich in `ausstehend`.

import { WhatsappFehler } from '@/lib/whatsapp/graph';
import { fensterBerechnen } from '@/lib/whatsapp/typen';
import { appLink, hinweisNeueNachricht, telegramInhalteFinden } from '@/lib/datenschutz/telegram-text';
import { aussenAdresse } from '@/lib/innen';
import { zoeWhatsappKonfig } from './konfig';
import { KANAL_GRENZEN, type ZoeKanal } from './kanal';
import { aendereKanal, aendereZoeZustand, ladeKanal } from './speicher';
import { zoeTextSenden, zoeVorlageSenden } from './meta';

export type ZoeSendeErgebnis =
  | { ok: true; wie: 'frei' | 'vorlage' | 'gesammelt' }
  | { ok: false; grund: 'nicht-eingerichtet' | 'nicht-verbunden' | 'meta'; fehler?: string };

/** Ist der Kanal dieser Person nutzbar (eingerichtet, verbunden, mit Nummer)? */
export const kanalAktiv = (k: ZoeKanal): boolean => k.status === 'verbunden' && !!k.nummer;

/** Der sichere Text (rein): ohne Ausnahme und mit erkannten Inhalten nur der neutrale Hinweis. */
export function sichererText(k: Pick<ZoeKanal, 'inhalte'>, text: string, link: string): string {
  if (k.inhalte?.seit || !telegramInhalteFinden(text).length) return text;
  return hinweisNeueNachricht(link);
}

/**
 * Soll statt einer weiteren Vorlage nur gesammelt werden? (rein) — ja, wenn schon eine Vorlage nach der letzten Nachricht der Person
 * hinausging und sie jünger als `vorlageStunden` ist. Sicherheits-Hinweise gehen immer.
 */
export function nurSammeln(k: Pick<ZoeKanal, 'letzteVorlage' | 'zuletztEingehend'>, art: string, jetzt: number): boolean {
  if (art === 'sicherheit' || !k.letzteVorlage) return false;
  const seitAntwort = !k.zuletztEingehend || k.letzteVorlage > k.zuletztEingehend;
  return seitAntwort && jetzt - Date.parse(k.letzteVorlage) < KANAL_GRENZEN.vorlageStunden * 3600_000;
}

/** Eine Meldung an die verbundene Person (über `anPersonMelden`). Wirft nie. */
export async function zoeAnPersonSenden(person: string, art: string, text: string, o: { link?: string; jetzt?: number } = {}): Promise<ZoeSendeErgebnis> {
  const k = zoeWhatsappKonfig();
  if (!k) return { ok: false, grund: 'nicht-eingerichtet' };
  const jetzt = o.jetzt ?? Date.now();
  const kanal = await ladeKanal(person);
  if (!kanalAktiv(kanal)) return { ok: false, grund: 'nicht-verbunden' };
  const link = appLink(aussenAdresse(), o.link ?? '/os');
  const sicher = sichererText(kanal, text, link);
  const neutral = sicher === hinweisNeueNachricht(link);
  const merke = (wie: 'frei' | 'vorlage' | 'gesammelt') => aendereKanal(person, cur => ({
    ...cur,
    ...(wie === 'frei' ? { zuletztGesendet: new Date(jetzt).toISOString() } : {}),
    ...(wie === 'vorlage' ? { letzteVorlage: new Date(jetzt).toISOString(), zuletztGesendet: new Date(jetzt).toISOString() } : {}),
    // Angekündigtes merken — außer es ist nur der Hinweis mit Link (den hat die Vorlage schon gesagt).
    ...(wie !== 'frei' && !neutral ? { ausstehend: { ...(cur.ausstehend ?? {}), [art]: { text: sicher, am: new Date(jetzt).toISOString() } } } : {}),
  }), jetzt);
  try {
    if (fensterBerechnen(kanal.zuletztEingehend, jetzt).offen) {
      try {
        await zoeTextSenden(k, kanal.nummer!, sicher);
        await merke('frei');
        return { ok: true, wie: 'frei' };
      } catch (e) {
        // Die Uhr von Meta sagt „Fenster zu“ (131047) — dann wie außerhalb des Fensters weiter.
        if (!(e instanceof WhatsappFehler && e.code === 131047)) throw e;
      }
    }
    if (nurSammeln(kanal, art, jetzt)) { await merke('gesammelt'); return { ok: true, wie: 'gesammelt' }; }
    await zoeVorlageSenden(k, kanal.nummer!, link);
    await merke('vorlage');
    return { ok: true, wie: 'vorlage' };
  } catch (e) {
    const fehler = e instanceof WhatsappFehler ? e.message : 'Meta ist gerade nicht erreichbar.';
    if (e instanceof WhatsappFehler && e.status === 409 && e.art === 'empfaenger') await aendereZoeZustand(z => ({ ...z, fehlgeschlagen: [...(z.fehlgeschlagen ?? []), new Date(jetzt).toISOString()].filter(t => jetzt - Date.parse(t) < 7 * 86_400_000) })).catch(() => {});
    return { ok: false, grund: 'meta', fehler };
  }
}

/** Eine Antwort im offenen Fenster (Eingang). Wirft `WhatsappFehler`. */
export async function zoeAntworten(person: string, nummer: string, text: string, antwortAuf?: string, jetzt = Date.now()): Promise<string> {
  const k = zoeWhatsappKonfig();
  if (!k) throw new WhatsappFehler('unbekannt', 'ZOE auf WhatsApp ist nicht eingerichtet.', 404);
  const id = await zoeTextSenden(k, nummer, text, antwortAuf);
  await aendereKanal(person, cur => ({ ...cur, zuletztGesendet: new Date(jetzt).toISOString() }), jetzt).catch(() => {});
  return id;
}
