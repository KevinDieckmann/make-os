// ─── Auskunft nach Art. 15 — Angaben laden (Server, 05.10., Paket „Betroffenenrechte v2“) ───────────────────────
// EINE Stelle, an der Kontakt-Auskunft (GET /api/crm/datenschutz?id=…) und Konto-Auskunft (GET /api/konto/daten) die Angaben
// nach Art. 15 Abs. 1 a–h holen: Verzeichnis (im Speicher vervollständigt, nie hier geschrieben), Einrichtung (Verantwortlicher,
// Empfänger), wirksame Löschfristen. Die Regeln selbst sind rein (./art15.ts). Wirft nie wegen fehlender Einrichtung — dann steht
// „Verantwortlicher fehlt“ in der Auskunft.

import { loadJson } from '@/lib/store/local-db';
import { ladeCrm } from '@/lib/crm/speicher';
import { verzeichnisVervollstaendigen } from '@/lib/crm/datenschutz';
import { googleKonfiguriert } from '@/lib/google/verbindung';
import { icloudInGebrauch } from '@/lib/kalender/icloud-person';
import { whatsappEingerichtet } from '@/lib/whatsapp/konfig';
import { whoopKonfiguriert } from '@/lib/whoop/konfig';
import { LOESCHFRISTEN_SPEICHER, SICHERUNG_SATZ, fristText, fristenWirksam, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { empfaengerWirksam, verantwortlicherWirksam } from './einrichtung';
import { ladeEinrichtung } from './einrichtung-server';
import { art15Angaben, type Art15Angaben, type AuskunftArt } from './art15';

export async function auskunftAngaben(art: AuskunftArt, o: { bereiche?: readonly string[]; herkunft: readonly string[]; fristen?: readonly { bereich: string; frist: string }[] }): Promise<Art15Angaben> {
  const jetzt = new Date().toISOString();
  let einrichtung = {};
  try { einrichtung = await ladeEinrichtung(); } catch { /* „fehlt“ steht dann in der Auskunft */ }
  const crm = await ladeCrm();
  const verarbeitungen = verzeichnisVervollstaendigen(crm.verarbeitungen, jetzt, { google: googleKonfiguriert(), icloud: await icloudInGebrauch(), whatsapp: whatsappEingerichtet(), whoop: whoopKonfiguriert() }).liste;
  const fristen = fristenWirksam(((await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER).catch(() => null)) ?? {}).fristen);
  const lf = (id: Parameters<typeof fristText>[0], bereich: string, satz: (t: string) => string) => ({ bereich, frist: satz(fristText(id, fristen[id])) });
  const kontaktFristen = art === 'kontakt' ? [
    lf('kontakte', 'Kontaktdaten ohne Beziehung und Aktivität', t => `${t} nach der letzten Spur (letzter Kontakt, Aktivität, Prüfung) — dann prüfen wir, ob wir löschen; Kunden 36 Monate nach Vertragsende, Rechnungen 8–10 Jahre (§ 147 AO, § 257 HGB)`),
    lf('signale', 'Betreff von Mails und Titel von Terminen an Ihrer Akte', t => `${t}, danach bleibt nur das Ereignis`),
    lf('buchungen', 'Terminbuchungen', t => `${t} nach dem Termin bzw. dem Endzustand`),
    { bereich: 'Werbewiderspruch', frist: 'dauerhaft, damit wir Sie nicht wieder anschreiben — nur als nicht umkehrbarer Fingerabdruck (Sperrliste)' },
  ] : [];
  const e = einrichtung as Parameters<typeof verantwortlicherWirksam>[0];
  return art15Angaben({
    art, verantwortlicher: verantwortlicherWirksam(e).v, empfaenger: empfaengerWirksam(e), verarbeitungen,
    ...(o.bereiche ? { bereiche: o.bereiche } : {}), fristen: [...kontaktFristen, ...(o.fristen ?? [])], sicherungen: SICHERUNG_SATZ, herkunft: o.herkunft,
  });
}
