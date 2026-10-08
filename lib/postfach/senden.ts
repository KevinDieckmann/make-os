// ─── Postfächer — Antworten über SMTP (Server, 06.10.2026) ──────────────────────────────────────────────────────
// Gesendet wird NUR auf den Einzelklick der Person (die Route lehnt den Dienstweg ab — ZOE, Takt und Arbeiter können nie senden).
// Dieselben Regeln wie bei Gmail (lib/gmail/senden.ts — die Prüfungen werden geteilt, nicht kopiert):
//   · Absender = das Postfach, in dem das Gespräch liegt (Adresse + Absendername des Postfachs) — nie eine andere Adresse;
//     so geht eine KD-Ventures-Antwort nie aus Versehen über das private Postfach
//   · Antwort im Gespräch: In-Reply-To + References + „Re:“; Empfänger Reply-To bzw. Absender (allen: + An/Cc ohne eigene Adresse)
//   · Art. 18 → 409; § 7 UWG: werbliche Wörter + fehlende Grundlage → Rückfrage 409 `uwg`
//   · nach dem Senden: Kopie in „Gesendet“ (APPEND) — außer der Anbieter legt sie selbst ab (Suche nach der Message-ID), danach
//     sofort ein Abgleich, damit die Antwort im Gespräch steht
// Kein Text in Protokollen.

import { antwortEmpfaenger, pruefeEmpfaenger, SendenFehler, TEXT_MAX, EMPFAENGER_MAX, type AntwortBezug } from '@/lib/gmail/senden';
import { adresseGueltig, adresseKlein, antwortBetreff, mimeBauen, referenzenFuer, zeilenfrei } from '@/lib/gmail/mime';
import type { Adr } from '@/lib/gmail/typen';
import { ladePostfach, zugangLesen } from './register';
import { imapAbgleichen, sitzungFuer } from './abgleich';
import { ladeImapStand, type ImapKopf } from './spiegel';
import { leitungen, PostfachFehler, FEHLER_TEXT } from './transport';
import type { Postfach } from './typen';

export interface ImapSendenEingabe {
  person: string;
  postfach: string;
  /** Antwort auf diese Nachricht (Kopf-Kennung im Spiegel). */
  ausNachricht?: string;
  an?: Adr[];
  cc?: Adr[];
  betreff?: string;
  text: string;
  uwgBestaetigt?: boolean;
  /** Antwort auf eine übergebene Mail (08.10.) — wie bei Gmail (lib/gmail/senden.ts `AntwortBezug`). */
  bezug?: AntwortBezug;
}

export interface ImapSendenErgebnis { messageId: string; von: string; an: string[]; abgelegt: 'selbst' | 'anbieter' | 'nicht' }

const sauber = (l: readonly Adr[] | undefined): Adr[] => {
  const raus: Adr[] = [];
  for (const a of l ?? []) {
    const email = adresseKlein(String(a?.email ?? ''));
    if (!adresseGueltig(email)) throw new SendenFehler('adresse', `„${zeilenfrei(String(a?.email ?? '')).slice(0, 80)}“ ist keine gültige E-Mail-Adresse.`, 400);
    if (!raus.some(x => x.email === email)) raus.push({ ...(a.name ? { name: zeilenfrei(a.name).slice(0, 120) } : {}), email });
  }
  return raus;
};

/** Die eigenen Adressen eines IMAP-Postfachs (für „von uns?“ und „allen antworten“). Rein. */
export const eigeneAdressenVon = (p: Pick<Postfach, 'adresse'>): string[] => [adresseKlein(p.adresse)];

export async function imapSenden(e: ImapSendenEingabe): Promise<ImapSendenErgebnis> {
  const p = await ladePostfach(e.person, e.postfach);
  if (!p || p.quelle !== 'imap' || !p.smtp) throw new SendenFehler('nicht-verbunden', 'Dieses Postfach gibt es nicht (mehr).', 404);
  const text = String(e.text ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  if (!text.trim()) throw new SendenFehler('kein-text', 'Die Mail hat keinen Text.', 400);
  if (text.length > TEXT_MAX) throw new SendenFehler('zu-lang', `Der Text ist zu lang (höchstens ${TEXT_MAX} Zeichen).`, 413);
  const stand = await ladeImapStand(e.person);
  const auf: ImapKopf | undefined = e.ausNachricht ? stand.koepfe[e.ausNachricht] : undefined;
  if (e.ausNachricht && (!auf || auf.postfachId !== p.id)) throw new SendenFehler('nicht-gefunden', 'Die Mail, auf die geantwortet wird, gibt es im Spiegel nicht (mehr).', 404);
  const eigene = eigeneAdressenVon(p);
  const standard = auf ? antwortEmpfaenger(auf, eigene, false) : { an: e.bezug?.empfaenger ?? [], cc: [] };
  const an = sauber(e.an?.length ? e.an : standard.an);
  const cc = sauber(e.cc);
  if (!an.length) throw new SendenFehler('kein-empfaenger', 'Es fehlt ein Empfänger.', 400);
  if (an.length + cc.length > EMPFAENGER_MAX) throw new SendenFehler('zu-viele', `Höchstens ${EMPFAENGER_MAX} Empfänger.`, 400);
  const betreff = auf ? antwortBetreff(auf.betreff) : e.bezug ? antwortBetreff(zeilenfrei(e.bezug.betreff)) : zeilenfrei(e.betreff ?? '');
  if (!betreff) throw new SendenFehler('betreff', 'Es fehlt ein Betreff.', 400);

  const pr = await pruefeEmpfaenger([...an, ...cc].map(a => a.email), text);
  if (pr.eingeschraenkt.length) throw new SendenFehler('eingeschraenkt', `${pr.eingeschraenkt.join(', ')}: Verarbeitung eingeschränkt (Art. 18) — keine Mail aus MAKE OS. Erst unter Kontakt › Datenschutz klären.`, 409);
  if (pr.hinweise.length && pr.woerter.length && !e.uwgBestaetigt) {
    throw new SendenFehler('uwg', 'Der Text klingt werblich, und für mindestens eine Person fehlt die Grundlage für Werbung (§ 7 UWG). Nur senden, wenn es eine persönliche 1:1-Antwort bleibt.', 409, { uwg: { woerter: pr.woerter, empfaenger: pr.hinweise } });
  }

  const roh = mimeBauen({
    von: { ...(p.absenderName ? { name: p.absenderName } : {}), email: p.adresse }, an, ...(cc.length ? { cc } : {}), betreff, text,
    ...(auf?.messageId ? { inReplyTo: auf.messageId, references: referenzenFuer(auf.references, auf.messageId) } : {}),
    ...(!auf && e.bezug?.messageId ? { inReplyTo: e.bezug.messageId, references: referenzenFuer(e.bezug.references, e.bezug.messageId) } : {}),
  });
  const messageId = (/^Message-ID: (<[^>]+>)/m.exec(roh) ?? [])[1] ?? '';
  const passwort = await zugangLesen(e.person, p.id);
  if (!passwort) throw new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
  const l = await leitungen(p.anbieter === 'demo');
  const bytes = Buffer.from(roh, 'utf8');
  try {
    await l.smtp({ host: p.smtp.host, port: p.smtp.port, sicherheit: p.smtp.sicherheit, benutzer: p.smtpBenutzer ?? p.adresse, passwort }, { von: p.adresse, an: [...an, ...cc].map(a => a.email) }, bytes);
  } catch (x) {
    const f = x instanceof PostfachFehler ? x : new PostfachFehler('server', FEHLER_TEXT.server, 502);
    throw new SendenFehler('versand', `Nicht gesendet: ${f.message}`, f.code === 'anmeldung' ? 409 : 502);
  }
  // Kopie in „Gesendet“: nur, wenn der Anbieter sie nicht selbst abgelegt hat (Suche nach der Message-ID). Fehler hier halten nichts auf.
  let abgelegt: ImapSendenErgebnis['abgelegt'] = 'nicht';
  if (p.ordner?.gesendet && messageId) {
    try {
      const s = await sitzungFuer(e.person, p);
      try {
        await s.oeffnen(p.ordner.gesendet, true);
        if ((await s.sucheMessageId(messageId)).length) abgelegt = 'anbieter';
        else { await s.anhaengen(p.ordner.gesendet, bytes, ['\\Seen']); abgelegt = 'selbst'; }
      } finally { await s.schliessen(); }
    } catch { /* der Versand ist durch; die Kopie fehlt dann nur in „Gesendet“ */ }
  }
  await imapAbgleichen(e.person, p.id, { nachlauf: true }).catch(() => { /* der Takt holt es */ });
  return { messageId, von: p.adresse, an: an.map(a => a.email), abgelegt };
}
