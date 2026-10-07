// ─── WhatsApp — wer darf, Zustand der Verbindung, Glocke bei ungültigem Schlüssel (Server, 07.10.2026) ──────────────────
// Zugang (Plattform-Regel „Trennung serverseitig“): Die Business-Nummer hat EINEN Bereich (immer Business, `WHATSAPP_BEREICH`).
// Sehen und schreiben dürfen nur Konten im Haushalt des Inhabers — und, wenn `WHATSAPP_PERSONEN` gesetzt ist, nur diese. Der Strom
// (lib/inbox/strom-server.ts) filtert dazu nach Bereich: die Sicht „Privat“ bekommt die Business-Nummer nie. Der Dienstweg (ZOE, Takt,
// Skripte) liest und sendet nie (die Routen nehmen `eigenePerson`).

import { ladeKonten } from '@/lib/zugang/konten';
import { istInhaber, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { melde } from '@/lib/meldungen/melden';
import { graph, tokenHakenSetzen, WhatsappFehler } from './graph';
import { whatsappKonfig, whatsappFehlend, webhookAdresse, type WaKonfig } from './konfig';
import { aendereWaZustand, ladeWaSpiegel, ladeWaZustand } from './spiegel';
import type { WhatsappStatus } from './typen';

/** Die Einrichtung — nur, wenn diese Person Zugang hat (sonst null). */
export async function whatsappFuer(person: string | null | undefined): Promise<WaKonfig | null> {
  const k = whatsappKonfig();
  if (!k || !person || !/^[a-z0-9-]{1,40}$/.test(person)) return null;
  if (k.personen && !k.personen.includes(person)) return null;
  return (await personImHaushaltDesInhabers(person)) ? k : null;
}

/** Alle Personen mit Zugang (für die Glocke). */
export async function personenMitZugang(): Promise<string[]> {
  const k = whatsappKonfig();
  if (!k) return [];
  const raus: string[] = [];
  for (const kt of (await ladeKonten()).konten) if (await whatsappFuer(kt.speicher)) raus.push(kt.speicher);
  return raus;
}

// ── Schlüssel ungültig → EINE Glocke „Verbindung erneuern“; wieder gültig → zurücksetzen ─────────────

const TOKEN_TEXT = 'WhatsApp braucht einen neuen Zugriffsschlüssel — bitte „Verbindung erneuern“ (Verbindungen › WhatsApp Business).';

/** Vom Graph-Haken gerufen. Schreibt nur bei einem Wechsel (kein Schreiben je Anfrage). */
export async function tokenZustand(ok: boolean, jetzt = new Date()): Promise<void> {
  const z = await ladeWaZustand();
  if (ok && !z.token?.fehlerAt) return;
  if (!ok && z.token?.gemeldet) return;
  await aendereWaZustand(cur => (ok ? { ...cur, token: { okAt: jetzt.toISOString() } } : { ...cur, token: { ...(cur.token ?? {}), fehlerAt: jetzt.toISOString(), gemeldet: true } }));
  if (!ok) for (const p of await personenMitZugang()) await melde({ an: p, art: 'postfach', titel: TOKEN_TEXT, link: '/os/verbindungen#whatsapp' });
}
tokenHakenSetzen(ok => tokenZustand(ok));

// ── Telefonnummer-Angaben (Cache 15 Min.) ───────────────────────────────────

const TELEFON_MS = 15 * 60_000;
interface TelefonAntwort { display_phone_number?: string; verified_name?: string; quality_rating?: string; throughput?: { level?: string } }

/**
 * Nummer, Anzeigename, Qualität, Durchsatz der Business-Nummer — Felder laut Meta (display_phone_number, verified_name,
 * quality_rating, throughput: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/manage-phone-numbers).
 * Höchstens alle 15 Minuten bei Meta (`erzwingen` beim Klick „Verbindung prüfen“).
 */
export async function telefonAngaben(k: WaKonfig, erzwingen = false, jetzt = Date.now()): Promise<void> {
  const z = await ladeWaZustand();
  if (!erzwingen && z.telefon && jetzt - Date.parse(z.telefon.at) < TELEFON_MS) return;
  try {
    const r = await graph<TelefonAntwort>(k, `/${k.telefonnummerId}`, { query: { fields: 'display_phone_number,verified_name,quality_rating,throughput' } });
    const s = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} +()./&'-]/gu, '').slice(0, n) : undefined);
    await aendereWaZustand(cur => ({ ...cur, telefon: { at: new Date(jetzt).toISOString(), ...(s(r.display_phone_number, 40) ? { nummer: s(r.display_phone_number, 40) } : {}), ...(s(r.verified_name, 120) ? { anzeigename: s(r.verified_name, 120) } : {}), ...(s(r.quality_rating, 20) ? { qualitaet: s(r.quality_rating, 20) } : {}), ...(s(r.throughput?.level, 30) ? { durchsatz: s(r.throughput?.level, 30) } : {}) }, fehler: undefined }));
  } catch (e) {
    const text = e instanceof WhatsappFehler ? e.message : 'Meta ist gerade nicht erreichbar.';
    await aendereWaZustand(cur => ({ ...cur, telefon: { ...(cur.telefon ?? {}), at: new Date(jetzt).toISOString() }, fehler: { at: new Date(jetzt).toISOString(), text } }));
  }
}

/** Was die Karte unter Verbindungen zeigt (nie Schlüssel/Geheimnisse; fehlende Variablen nur als Namen). */
export async function whatsappStatus(person: string, o: { pruefen?: boolean } = {}): Promise<WhatsappStatus> {
  const k = whatsappKonfig();
  const basis = { ok: true as const, webhookAdresse: webhookAdresse() };
  if (!k) return { ...basis, eingerichtet: false, fehlend: whatsappFehlend(), zugang: false, verbindung: 'ungeprueft' };
  const mein = await whatsappFuer(person);
  if (!mein) return { ...basis, eingerichtet: true, fehlend: [], zugang: false, verbindung: 'ungeprueft' };
  await telefonAngaben(mein, !!o.pruefen);
  const [z, s] = await Promise.all([ladeWaZustand(), ladeWaSpiegel()]);
  const { bereichNamen } = await import('@/lib/postfach/register');
  const namen = await bereichNamen().catch(() => ({} as Record<string, string>));
  const tokenKaputt = !!z.token?.fehlerAt && (!z.token.okAt || z.token.fehlerAt > z.token.okAt);
  const medienOffen = Object.values(s.nachrichten).filter(m => m.medium?.zustand === 'offen').length;
  return {
    ...basis, eingerichtet: true, fehlend: [], zugang: true, bereich: k.bereich, bereichName: namen[k.bereich] ?? k.bereich,
    ...(z.telefon?.nummer ? { nummer: z.telefon.nummer } : {}), ...(z.telefon?.anzeigename ? { anzeigename: z.telefon.anzeigename } : {}),
    ...(z.telefon?.qualitaet ? { qualitaet: z.telefon.qualitaet } : {}), ...(z.telefon?.durchsatz ? { durchsatz: z.telefon.durchsatz } : {}),
    ...(z.telefon?.at ? { telefonAt: z.telefon.at } : {}),
    webhook: { anzahl: z.webhook?.anzahl ?? 0, abgelehnt: z.webhook?.abgelehnt ?? 0, ...(z.webhook?.zuletzt ? { zuletzt: z.webhook.zuletzt } : {}), ...(z.webhook?.zuletztAbgelehnt ? { zuletztAbgelehnt: z.webhook.zuletztAbgelehnt } : {}) },
    verbindung: tokenKaputt ? 'token' : z.fehler && (!z.telefon?.nummer || z.fehler.at >= (z.telefon.at ?? '')) ? 'fehler' : z.telefon?.nummer ? 'ok' : 'ungeprueft',
    ...(tokenKaputt ? { fehler: 'Der Zugriffsschlüssel wurde von Meta abgelehnt.' } : z.fehler ? { fehler: z.fehler.text } : {}),
    gespraeche: Object.keys(s.kontakte).length, medienOffen,
    ...(z.registriert ? { registriert: z.registriert } : {}), inhaber: await istInhaber(person),
  };
}

// ── Nummer registrieren (einmalig, nur der Inhaber, per Klick) ─────────────────────────────────────────────
// Meta: „You can only register a number via the API“ — POST /<PHONE_NUMBER_ID>/register mit messaging_product, pin (6 Ziffern, die
// Zwei-Schritt-PIN — neu, wenn noch keine gesetzt ist) und optional data_localization_region (Local Storage, u. a. „DE“ = EU/Deutschland);
// höchstens 10 Anfragen je Nummer in 72 Stunden
// (https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration, abgerufen 07.10.2026).
// Local Storage geht NUR vor bzw. mit der Registrierung (Faktendatei A4). „No Storage“ ist hier nicht belegt → bei Meta prüfen.
// Die PIN wird nirgends gespeichert und nie protokolliert.

/** Die Nummer bei der Cloud API registrieren — mit Speicherort Deutschland (Vorgabe) oder ohne Local Storage. Wirft `WhatsappFehler`. */
export async function nummerRegistrieren(k: WaKonfig, pin: string, speicherort: 'DE' | 'ohne'): Promise<void> {
  if (!/^[0-9]{6}$/.test(pin)) throw new WhatsappFehler('parameter', 'Die PIN hat genau 6 Ziffern.', 400);
  await graph<{ success?: boolean }>(k, `/${k.telefonnummerId}/register`, { method: 'POST', body: { messaging_product: 'whatsapp', pin, ...(speicherort === 'DE' ? { data_localization_region: 'DE' } : {}) } });
  await aendereWaZustand(cur => ({ ...cur, registriert: { am: new Date().toISOString(), speicherort } }));
}
