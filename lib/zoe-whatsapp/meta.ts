// ─── ZOE auf WhatsApp — Anfragen an Meta für die ZOE-Nummer (Server, 08.10.2026) ──────────────────────────────────────────
// Wiederverwendet: lib/whatsapp/graph.ts (`graph`, `graphUrl`, `medienLaden` — Versions-Konstante, Hosts, Fehlertexte) mit EIGENEM
// Zugang (Schlüssel der ZOE-Nummer) und EIGENEM Haken für „Schlüssel abgelehnt“ — ein Fehler der ZOE-Nummer setzt nie die
// Business-Nummer auf „Verbindung erneuern“ (und umgekehrt).
// Meta (https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages, abgerufen 07.10.2026):
//   POST /<PHONE_NUMBER_ID>/messages — type text (text.body) bzw. template (template.name/language.code/components); `context.message_id`
//   macht eine Antwort zur Antwort auf eine bestimmte Nachricht. Vorlagen: GET /<WABA_ID>/message_templates (nur APPROVED senden).
// Frei schreiben nur im 24-h-Fenster (Faktendatei A3) — das prüft der Aufrufer (lib/zoe-whatsapp/senden.ts).

import { graph, graphUrl, WhatsappFehler, type GraphZugang } from '@/lib/whatsapp/graph';
import { vorlageAus } from '@/lib/whatsapp/vorlagen';
import { WA_ID, type Vorlage } from '@/lib/whatsapp/typen';
import { teile } from '@/lib/telegram';
import { melde } from '@/lib/meldungen/melden';
import type { ZoeWaKonfig } from './konfig';
import { KANAL_GRENZEN } from './kanal';
import { aendereZoeZustand, ladeZoeZustand } from './speicher';

const TOKEN_TEXT = 'ZOE auf WhatsApp braucht einen neuen Zugriffsschlüssel — bitte „Verbindung erneuern“ (Verbindungen › ZOE auf WhatsApp).';

/** Meta hat den Schlüssel der ZOE-Nummer abgelehnt bzw. wieder angenommen — schreibt nur bei einem Wechsel, EINE Glocke an den Inhaber. */
export async function zoeTokenZustand(ok: boolean, jetzt = new Date()): Promise<void> {
  const z = await ladeZoeZustand();
  if (ok && !z.token?.fehlerAt) return;
  if (!ok && z.token?.gemeldet) return;
  await aendereZoeZustand(cur => (ok ? { ...cur, token: { okAt: jetzt.toISOString() } } : { ...cur, token: { ...(cur.token ?? {}), fehlerAt: jetzt.toISOString(), gemeldet: true } }));
  if (!ok) {
    // An jeden Inhaber (09.10., R9 — mehrere Inhaber verwalten die Instanz gleichwertig).
    const { alleInhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
    for (const inhaber of await alleInhaberSpeicher()) await melde({ an: inhaber, art: 'verbindung', titel: TOKEN_TEXT, link: '/os/verbindungen#zoe-whatsapp' });
  }
}

/** Der Graph-Zugang der ZOE-Nummer (eigener Schlüssel, eigener Haken). */
export const zoeZugang = (k: ZoeWaKonfig): GraphZugang => ({ zugriff: k.zugriff, haken: ok => zoeTokenZustand(ok) });

interface SendeAntwort { messages?: { id?: string }[] }

/** Einen freien Text senden (im 24-h-Fenster). Lange Texte in mehreren Nachrichten (an Absatzgrenzen). Liefert die WAMID der letzten. */
export async function zoeTextSenden(k: ZoeWaKonfig, nummer: string, text: string, antwortAuf?: string): Promise<string> {
  let letzte = '';
  for (const [i, stueck] of teile(text, KANAL_GRENZEN.text - 96).entries()) {
    const r = await graph<SendeAntwort>(zoeZugang(k), `/${k.telefonnummerId}/messages`, { method: 'POST', body: {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: nummer, type: 'text', text: { preview_url: false, body: stueck },
      ...(i === 0 && antwortAuf && WA_ID.test(antwortAuf) ? { context: { message_id: antwortAuf } } : {}),
    } });
    const id = r.messages?.[0]?.id;
    if (typeof id !== 'string' || !WA_ID.test(id)) throw new WhatsappFehler('unbekannt', 'Meta hat die Nachricht ohne Kennung angenommen.', 502);
    letzte = id;
  }
  return letzte;
}

const CACHE_MS = 3600_000;
interface RohSeite { data?: Parameters<typeof vorlageAus>[0][]; paging?: { next?: string } }

/** Die Vorlagen des Kontos der ZOE-Nummer (Cache 1 Stunde, `neu` = sofort bei Meta). Wirft `WhatsappFehler`. */
export async function zoeVorlagenLaden(k: ZoeWaKonfig, o: { neu?: boolean } = {}, jetzt = Date.now()): Promise<Vorlage[]> {
  const z = await ladeZoeZustand();
  if (!o.neu && z.vorlagen && jetzt - Date.parse(z.vorlagen.at) < CACHE_MS) return z.vorlagen.liste;
  const liste: Vorlage[] = [];
  let seite = await graph<RohSeite>(zoeZugang(k), `/${k.wabaId}/message_templates`, { query: { fields: 'name,language,status,category,components', limit: '100' } });
  for (let i = 0; i < 5; i++) {
    for (const r of Array.isArray(seite.data) ? seite.data : []) { const v = vorlageAus(r); if (v) liste.push(v); }
    if (!seite.paging?.next || i === 4) break;
    seite = await graphUrl<RohSeite>(zoeZugang(k), seite.paging.next);
  }
  await aendereZoeZustand(cur => ({ ...cur, vorlagen: { at: new Date(jetzt).toISOString(), liste } }));
  return liste;
}

/**
 * Die Vorlage „Briefing bereit“ prüfen (rein): genehmigt, nicht Werbung (MARKETING), höchstens EIN Platzhalter (der Link in MAKE OS).
 * Liefert die Vorlage oder einen deutschen Satz.
 */
export function briefingVorlagePruefen(liste: readonly Vorlage[], name: string, sprache: string): { ok: true; v: Vorlage } | { ok: false; fehler: string } {
  const v = liste.find(x => x.name === name && x.sprache === sprache);
  if (!v) return { ok: false, fehler: `Die Vorlage „${name}“ (${sprache}) gibt es bei Meta nicht — bitte im WhatsApp Manager einreichen (UPDATES.md › 08.10. „ZOE auf WhatsApp“).` };
  if (v.status !== 'APPROVED') return { ok: false, fehler: `Die Vorlage „${name}“ ist bei Meta noch nicht genehmigt (${v.status}).` };
  if (v.kategorie === 'MARKETING') return { ok: false, fehler: `Die Vorlage „${name}“ ist als Werbung (MARKETING) eingestuft — für ZOE bitte als UTILITY einreichen.` };
  if (v.parameter.length > 1) return { ok: false, fehler: `Die Vorlage „${name}“ hat ${v.parameter.length} Platzhalter — erlaubt ist höchstens einer (der Link).` };
  return { ok: true, v };
}

/** Die Vorlage „Briefing bereit“ senden (außerhalb des Fensters). Der eine Platzhalter (falls vorhanden) ist der Link. */
export async function zoeVorlageSenden(k: ZoeWaKonfig, nummer: string, link: string): Promise<string> {
  let p = briefingVorlagePruefen(await zoeVorlagenLaden(k), k.vorlage.name, k.vorlage.sprache);
  if (!p.ok) p = briefingVorlagePruefen(await zoeVorlagenLaden(k, { neu: true }), k.vorlage.name, k.vorlage.sprache); // vielleicht gerade genehmigt
  if (!p.ok) throw new WhatsappFehler('vorlage', p.fehler, 409);
  const v = p.v;
  const benannt = v.parameter.some(x => !/^\d+$/.test(x));
  const r = await graph<SendeAntwort>(zoeZugang(k), `/${k.telefonnummerId}/messages`, { method: 'POST', body: {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: nummer, type: 'template',
    template: { name: v.name, language: { code: v.sprache }, ...(v.parameter.length ? { components: [{ type: 'body', parameters: [{ type: 'text', text: link, ...(benannt ? { parameter_name: v.parameter[0] } : {}) }] }] } : {}) },
  } });
  const id = r.messages?.[0]?.id;
  if (typeof id !== 'string' || !WA_ID.test(id)) throw new WhatsappFehler('unbekannt', 'Meta hat die Vorlage ohne Kennung angenommen.', 502);
  return id;
}

const TELEFON_MS = 15 * 60_000;
interface TelefonAntwort { display_phone_number?: string; verified_name?: string; quality_rating?: string }

/** Nummer/Anzeigename/Qualität der ZOE-Nummer (Cache 15 Min.) — für die Karte („an diese Nummer schreiben“) und den Head of IT. */
export async function zoeTelefonAngaben(k: ZoeWaKonfig, erzwingen = false, jetzt = Date.now()): Promise<void> {
  const z = await ladeZoeZustand();
  if (!erzwingen && z.telefon && jetzt - Date.parse(z.telefon.at) < TELEFON_MS) return;
  try {
    const r = await graph<TelefonAntwort>(zoeZugang(k), `/${k.telefonnummerId}`, { query: { fields: 'display_phone_number,verified_name,quality_rating' } });
    const s = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} +()./&'-]/gu, '').slice(0, n) : undefined);
    await aendereZoeZustand(cur => ({ ...cur, telefon: { at: new Date(jetzt).toISOString(), ...(s(r.display_phone_number, 40) ? { nummer: s(r.display_phone_number, 40) } : {}), ...(s(r.verified_name, 120) ? { anzeigename: s(r.verified_name, 120) } : {}), ...(s(r.quality_rating, 20) ? { qualitaet: s(r.quality_rating, 20) } : {}) } }));
  } catch {
    await aendereZoeZustand(cur => ({ ...cur, telefon: { ...(cur.telefon ?? {}), at: new Date(jetzt).toISOString() } }));
  }
}

/**
 * Die ZOE-Nummer bei der Cloud API registrieren (einmalig, nur der Inhaber per Klick) — wie die Business-Nummer (lib/whatsapp/server.ts
 * `nummerRegistrieren`): POST /<PHONE_NUMBER_ID>/register mit messaging_product, pin (6 Ziffern, Zwei-Schritt-PIN) und optional
 * data_localization_region „DE“ (Local Storage nur vor bzw. mit der Registrierung; höchstens 10 Versuche je Nummer in 72 Stunden —
 * https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration). Die PIN wird nie gespeichert.
 */
export async function zoeNummerRegistrieren(k: ZoeWaKonfig, pin: string, speicherort: 'DE' | 'ohne'): Promise<void> {
  if (!/^[0-9]{6}$/.test(pin)) throw new WhatsappFehler('parameter', 'Die PIN hat genau 6 Ziffern.', 400);
  await graph<{ success?: boolean }>(zoeZugang(k), `/${k.telefonnummerId}/register`, { method: 'POST', body: { messaging_product: 'whatsapp', pin, ...(speicherort === 'DE' ? { data_localization_region: 'DE' } : {}) } });
  await aendereZoeZustand(cur => ({ ...cur, registriert: { am: new Date().toISOString(), speicherort } }));
}
