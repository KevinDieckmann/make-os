// ─── Postfächer — erfundene Post für die Demo-Instanz (Server, 06.10.2026) ────────────────────────────────────────
// Nur mit MAKE_OS_DEMO=1 und Anbieter „demo“ (lib/postfach/transport.ts `leitungen`): ein Postfach im Arbeitsspeicher je Adresse, gefüllt
// mit erfundenen Gesprächen (`@example.invalid`, Namen aus der Demo-Saat) — so zeigt die Demo jedes Fach der Inbox: Antworten mit
// Frist, Rechnung mit PDF, Einladung mit Kalenderdatei, Nachfassen fällig, Warten mit Abwesenheitsnotiz, neuer Absender, Rundschreiben.
// Nichts geht ins Netz; „Senden“ legt die Mail nur in „Gesendet“ dieses Speichers. Passwort „falsch“ = Fehlerfall Anmeldung.

import { DEMO_DOMAIN } from '@/lib/demo/schutz';
import { PostSpeicher, rohNachricht } from './post-speicher';
import { PostfachFehler, FEHLER_TEXT, type ImapOeffner, type ImapWaechter, type SmtpSender } from './transport';

const D = DEMO_DOMAIN;
const SPEICHER_KEY = Symbol.for('make-os.demo-post');
type Ablage = Map<string, PostSpeicher>;
const ablage = (): Ablage => {
  const g = globalThis as unknown as Record<symbol, Ablage | undefined>;
  return (g[SPEICHER_KEY] ??= new Map());
};

const vor = (stunden: number) => new Date(Date.now() - stunden * 3600_000).toISOString();

/** Ein Demo-Postfach mit erfundener Post (je Adresse einmal, bis zum Neustart). */
export function demoPostfach(adresse: string): PostSpeicher {
  const a = adresse.toLowerCase();
  const da = ablage().get(a);
  if (da) return da;
  const s = new PostSpeicher({ passwort: '*' });
  const ich = a;
  const ein = (h: number, o: Parameters<typeof rohNachricht>[0], flags: string[] = []) => s.ablegen('INBOX', rohNachricht({ ...o, datum: vor(h) }), { am: vor(h), flags });
  const aus = (h: number, o: Parameters<typeof rohNachricht>[0]) => s.ablegen('Sent Messages', rohNachricht({ ...o, datum: vor(h) }), { am: vor(h), flags: ['\\Seen'] });

  ein(3, { von: `Sophie Brandt <sophie@${D}>`, an: ich, betreff: 'Angebot Kennzahlen-Paket Q4', messageId: `<demo-1@${D}>`, text: 'Hallo,\n\nkönnen Sie mir das Angebot für das Kennzahlen-Paket bis Freitag schicken? Wir möchten es in der Runde am Montag besprechen.\n\nViele Grüße\nSophie Brandt' });
  ein(26, { von: `Paul Neumann <paul@${D}>`, an: ich, betreff: 'Rechnung 2026-117 (Workshop September)', messageId: `<demo-2@${D}>`, text: 'Guten Tag,\n\nanbei die Rechnung für den Workshop im September. Zahlbar innerhalb von 14 Tagen.\n\nBeste Grüße\nPaul Neumann', anhang: { name: 'Rechnung-2026-117.pdf', typ: 'application/pdf', inhalt: '%PDF-1.4 Demo-Rechnung (erfunden)' } });
  ein(5, { von: `Elif Kaya <elif@${D}>`, an: ich, betreff: 'Einladung: Planungs-Workshop am Donnerstag', messageId: `<demo-3@${D}>`, text: 'Hallo,\n\nich lade Sie zum Planungs-Workshop am Donnerstag um 10 Uhr ein. Passt das?\n\nElif Kaya', anhang: { name: 'einladung.ics', typ: 'text/calendar', inhalt: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Planungs-Workshop (Demo)\r\nEND:VEVENT\r\nEND:VCALENDAR' } });
  aus(122, { von: ich, an: `Tobias Lange <tobias@${D}>`, betreff: 'Unterlagen für unser Gespräch', messageId: `<demo-4@${D}>`, text: 'Hallo Herr Lange,\n\nwie besprochen die Unterlagen. Ich freue mich auf Ihre Rückmeldung.\n\nBeste Grüße' });
  aus(20, { von: ich, an: `Marie Vogel <marie@${D}>`, betreff: 'Kurze Frage zur Planung', messageId: `<demo-5@${D}>`, text: 'Hallo Frau Vogel,\n\nhaben Sie die Zahlen für Oktober schon?\n\nBeste Grüße' });
  ein(19, { von: `Marie Vogel <marie@${D}>`, an: ich, betreff: 'Automatische Antwort: Kurze Frage zur Planung', messageId: `<demo-6@${D}>`, inReplyTo: `<demo-5@${D}>`, references: [`<demo-5@${D}>`], kopf: { 'Auto-Submitted': 'auto-replied' }, text: 'Ich bin bis Montag nicht im Büro und antworte danach.' }, ['\\Seen']);
  ein(8, { von: `Hanna Berg <hanna.berg@${D}>`, an: ich, betreff: 'Kooperationsanfrage', messageId: `<demo-7@${D}>`, text: 'Guten Tag,\n\nwir sind eine kleine Agentur und würden gern über eine Zusammenarbeit sprechen.\n\nHanna Berg' });
  ein(30, { von: `Wochenbrief <news@brief.${D}>`, an: ich, betreff: 'Der Wochenbrief: fünf Ideen für Ihre Planung', messageId: `<demo-8@${D}>`, kopf: { 'List-Unsubscribe': `<mailto:abmelden@brief.${D}>`, 'List-Id': `<wochenbrief.brief.${D}>` }, text: 'Diese Woche: fünf Ideen …' });
  ein(50, { von: `Versand <noreply@shop.${D}>`, an: ich, betreff: 'Ihr Paket ist unterwegs', messageId: `<demo-9@${D}>`, kopf: { 'Auto-Submitted': 'auto-generated' }, text: 'Ihre Bestellung wurde versendet.' }, ['\\Seen']);
  aus(72, { von: ich, an: `David Roth <david@${D}>`, betreff: 'Vertragsentwurf', messageId: `<demo-10@${D}>`, text: 'Hallo David,\n\nanbei der Entwurf. Was meinst du?' });
  ein(48, { von: `David Roth <david@${D}>`, an: ich, betreff: 'Re: Vertragsentwurf', messageId: `<demo-11@${D}>`, inReplyTo: `<demo-10@${D}>`, references: [`<demo-10@${D}>`], text: 'Sieht gut aus, nur Punkt 4 würde ich ändern. Kannst du bis 15.10. eine neue Fassung schicken?\n\nDavid' });
  ablage().set(a, s);
  return s;
}

const speicherFuer = (benutzer: string, passwort: string): PostSpeicher => {
  if (passwort === 'falsch') throw new PostfachFehler('anmeldung', FEHLER_TEXT.anmeldung);
  const s = demoPostfach(benutzer);
  s.passwort = passwort; // Demo: jedes Passwort außer „falsch“ gilt
  return s;
};

export const demoImap: ImapOeffner = async z => speicherFuer(z.benutzer, z.passwort).sitzung(z);
export const demoSmtp: SmtpSender = async (z, umschlag, roh) => speicherFuer(z.benutzer, z.passwort).senden(z, umschlag, roh);
export const demoWaechter: ImapWaechter = async (z, _pfad, neu) => {
  const s = speicherFuer(z.benutzer, z.passwort);
  const ab = s.beobachten(neu);
  return { stop: async () => ab() };
};
