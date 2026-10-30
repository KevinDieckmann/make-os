// ─── Newsletter-Anmeldung — die EINE Bestätigungsmail (nur Server, 30.10., Branch `newsletter-anmeldung`) ──────────────────────────────
// Eiserne Regel 3 („nichts verlässt das System ohne Freigabe“) hat dafür eine zweite dokumentierte Ausnahme neben „Angebot anfordern“
// (lib/crm/angebot-versand.ts) — und genauso eng:
//   · die Freigabe ist die Wahl des Absender-Postfachs durch einen Inhaber (Markttraktion › Marketing › Newsletter › „Anmeldung über die Website“);
//     ohne Absender ist die Anmeldung aus und nichts geht raus
//   · nur die Bestätigungsmail (fester Text aus lib/newsletter/regeln.ts `bestaetigungsMail`: Bitte um Bestätigung, Link, „wenn Sie das nicht waren“,
//     Datenschutz — KEINE Werbung, keine KI, nichts vom Aufrufer)
//   · nur an die Adresse, die die Person selbst eingetragen hat (aus der gespeicherten Anmeldung, nie aus dem Aufruf), höchstens `MAILS_JE_TAG` je Tag
//   · nur mit dem Token GENAU dieser Anmeldung (der Hash muss passen)
//   · gesendet über den vorhandenen Weg der Inbox (`inboxSenden`: Absender = das gewählte Postfach, Art. 18 dort, Spiegel, Protokoll ohne Text)
// Die Funktion nimmt nur die Kennung der Anmeldung, das frische Token und die geprüfte Lage der Instanz. Aufrufer: lib/newsletter/server.ts.

import { adresseMaskiert } from '@/lib/zugang/konten';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { bestaetigungsMail } from './regeln';
import { ANMELDUNGEN, aendereAnmeldung, ladeAnmeldungen, tokenHash } from './speicher';
import type { Bereit } from './server';

export type VersandErgebnis = { ok: true; ueber: string } | { ok: false; grund: string };

export async function bestaetigungsmailSenden(id: string, token: string, b: Bereit): Promise<VersandErgebnis> {
  const a = (await ladeAnmeldungen()).anmeldungen.find(x => x.id === id);
  if (!a || a.bestaetigt || a.gesperrt || !a.tokenHash || a.tokenHash !== tokenHash(token)) return { ok: false, grund: 'Diese Anmeldung wartet nicht (mehr) auf eine Mail.' };
  const link = `${b.website}/newsletter#t=${token}`;
  const mail = bestaetigungsMail({ marke: b.marke, ...(a.vorname ? { vorname: a.vorname } : {}), link, verantwortlich: b.verantwortlich, datenschutzLink: b.datenschutzLink });
  const { inboxSenden } = await import('@/lib/inbox/senden-server');
  let r: { status: number; body: Record<string, unknown> };
  try {
    // `uwgBestaetigt`: die Mail ist die Antwort auf die eigene Anmeldung der Person, fester Text ohne Werbung — die Rückfrage zu § 7 UWG (für
    // frei geschriebene Mails) gilt hier nicht. Art. 18 prüft der Sendeweg trotzdem (eingeschränkte Personen bekommen nie etwas).
    r = await inboxSenden(b.absender.person, {
      neu: { postfach: b.absender.postfach, betreff: mail.betreff }, an: [{ email: a.email, ...(a.vorname ? { name: a.vorname } : {}) }], text: mail.text, uwgBestaetigt: true,
    }, { art: 'system' });
  } catch (err) { r = { status: 502, body: { fehler: err instanceof Error ? err.message.slice(0, 200) : 'Versand gescheitert.' } }; }
  if (r.status !== 200 || r.body.ok !== true) {
    const grund = `Bestätigungsmail nicht verschickt: ${String(r.body.fehler ?? 'unbekannter Fehler').slice(0, 200)}`;
    await aendereAnmeldung(id, x => ({ ...x, versandFehler: grund }));
    return { ok: false, grund };
  }
  const ueber = adresseMaskiert(String(r.body.von ?? ''));
  const am = new Date().toISOString();
  await aendereAnmeldung(id, x => { const { versandFehler: _v, ...rest } = x; return { ...rest, mailGesendet: am }; });
  await protokolliere(ANMELDUNGEN, [{ liste: 'anmeldungen', op: 'geaendert', id, felder: ['mailGesendet'] }], { art: 'system' }).catch(() => { /* nur Protokoll */ });
  return { ok: true, ueber };
}
