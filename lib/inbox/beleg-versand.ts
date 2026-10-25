// ─── Inbox — ein Beleg (Angebot · Rechnung) per Klick über ein eigenes Postfach senden (Server, 25.10.2026) ─────────────────────────────────
// Kevin 25.10.: Rechnungsstellung „zumindest als PDF vorbereiten und dann per Google Mail verschicken“. Angebot-Ansicht und Rechnungs-Editor öffnen
// eine neue Mail in der Inbox (lib/inbox/neue-mail.ts — nie Adresse/Text in der URL) mit dem PDF als Anhang (`anhaenge: [{ datei }]`) und dem Beleg
// (`beleg: { art, id }`). Hier: (a) VOR dem Senden prüfen, dass der Anhang GENAU das PDF dieses Belegs ist (eine fremde Datei-Kennung → 400, nichts
// gesendet), (b) NACH dem Senden „versendet am … über …“ vermerken (Angebot: dazu die Mail-Aktivität am Kontakt). Gesendet wird nur per Klick der
// Person (Route /api/inbox/senden, Sitzung) — Rechnungen gehen nie automatisch raus (Eiserne Regel 3 bleibt für Rechnungen).

import { SendenFehler } from '@/lib/gmail/senden';
import { adresseMaskiert } from '@/lib/zugang/konten';
import type { Wer } from '@/lib/store/aenderungsprotokoll';

export interface Beleg { art: 'angebot' | 'rechnung'; id: string }
const ID = /^[a-z0-9][a-z0-9-]{2,79}$/;

/** `beleg` aus dem Körper: fehlt → null; falsche Form → 400. */
export function belegAus(roh: unknown): Beleg | null {
  if (roh === undefined || roh === null) return null;
  const o = roh && typeof roh === 'object' ? roh as Record<string, unknown> : {};
  if ((o.art !== 'angebot' && o.art !== 'rechnung') || typeof o.id !== 'string' || !ID.test(o.id)) throw new SendenFehler('versand', 'beleg: { art: angebot | rechnung, id } — nichts gesendet.', 400);
  return { art: o.art, id: o.id };
}

/** Die PDF-Kennung des Belegs (gestellt bzw. mit PDF) — wirft 404/409, bevor etwas gesendet wird. */
async function pdfVon(b: Beleg): Promise<string> {
  if (b.art === 'angebot') {
    const a = ((await import('@/lib/crm/speicher').then(m => m.ladeCrm())).angebote ?? []).find(x => x.id === b.id);
    if (!a) throw new SendenFehler('nicht-gefunden', 'Dieses Angebot gibt es nicht (mehr) — nichts gesendet.', 404);
    if (a.status === 'entwurf' || !a.pdfDateiId) throw new SendenFehler('versand', 'Erst stellen — ein Entwurf hat noch kein PDF. Nichts gesendet.', 409);
    return a.pdfDateiId;
  }
  const r = await import('@/lib/finanzen/rechnung/server').then(m => m.rechnungPdfKennung(b.id));
  if (!r) throw new SendenFehler('nicht-gefunden', 'Zu dieser Rechnung gibt es kein PDF aus MAKE OS — nichts gesendet.', 404);
  if (r.status === 'geplant') throw new SendenFehler('versand', 'Erst stellen — eine geplante Rechnung geht nicht hinaus. Nichts gesendet.', 409);
  return r.pdfDateiId;
}

/** Anhang = GENAU das PDF dieses Belegs (eine Datei, diese Kennung) — sonst 400, nichts gesendet. */
export async function belegPruefen(b: Beleg, anhangIds: readonly string[]): Promise<void> {
  const pdf = await pdfVon(b);
  if (anhangIds.length !== 1 || anhangIds[0] !== pdf) throw new SendenFehler('versand', `Der Anhang ist nicht das PDF dieses ${b.art === 'angebot' ? 'Angebots' : 'Belegs'} — nichts gesendet.`, 400);
}

/** Nach dem Senden: „versendet am … über <Postfach maskiert>“; beim Angebot dazu die Mail-Aktivität am Kontakt (`angebotGesendet`, idempotent). Wirft nie. */
export async function belegVermerken(b: Beleg, o: { person: string; von: string; wer: Wer }): Promise<void> {
  const ueber = adresseMaskiert(o.von);
  try {
    if (b.art === 'angebot') {
      const s = await import('@/lib/crm/angebot-server');
      await s.angebotVersendetVermerken({ id: b.id, ueber, von: o.person, wer: o.wer });
      await s.angebotGesendet({ id: b.id, person: o.person, wer: o.wer }).catch(() => null);
    } else {
      await (await import('@/lib/finanzen/rechnung/server')).rechnungVersendetVermerken({ id: b.id, ueber, person: o.person, wer: o.wer });
    }
  } catch (e) { console.warn('[inbox] Versand-Vermerk nicht geschrieben:', e instanceof Error ? e.message.slice(0, 120) : 'Fehler'); }
}
