import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';

// ─── Microsoft 365 (KEMARIS) — Postfach als Bestand ─────────────────────────
// Die Mails leben seit 03.08. in .data/m365-postfach.json und werden über PUT
// aktualisiert — Kevin sagt Claude „KEMARIS-Postfach aktualisieren", Claude
// zieht den Eingang über die Microsoft-Anbindung und schreibt ihn hierher.
// Vorher war der Stand IM CODE eingefroren (unten als DATA, bleibt als
// Rückfalllösung und für Kalender/Teams/Dokumente).
//
// Voll-Live ohne Claude dazwischen braucht eine Azure-App-Registrierung
// (MS_CLIENT_ID/SECRET/TENANT in .env.local) — steht im Bauplan.

/** Form, die Inbox und Feed erwarten. */
interface M365Mail {
  id: string; subject: string; senderName?: string; senderEmail?: string;
  preview?: string; receivedAt: string; isRead: boolean;
  hasAttachment?: boolean; importance?: string; webLink?: string;
}
interface PostfachStore { stand: string; mails: M365Mail[] }

const DATA = {
  lastUpdated: '2026-07-30T07:00:00.000Z',

  emails: [
    {
      id: 'ms-mail-1',
      subject: 'Rückfragen Market Traction',
      senderName: 'Alexander Groß-Ophoff',
      senderEmail: 'gross-ophoff@quapler.de',
      preview: 'Rückfragen zu den Market-Traction-Kennzahlen (mit Anhang) — die echten Zahlen für POINCAP/Investoren. Antwort nötig. Mit den besten Grüßen, Groß-Ophoff Alexander, Quapler GmbH & Co. KG.',
      receivedAt: '2026-07-28T10:43:57.000Z',
      isRead: false,
      hasAttachment: true,
      importance: 'high',
      category: 'extern',
    },
    {
      id: 'ms-mail-2',
      subject: 'KEMARIS Innovation GmbH — Gründungsurkunden (UVZ R 487/488 2026)',
      senderName: 'Notariat LSP · M. Eisermann',
      senderEmail: 'Melanie.Eisermann@lspartner.de',
      preview: 'Liebe Herren, leider gab es einen Fehler beim Speichervorgang. Anliegend die korrigierten Reinschriften zur Firmierung sowie den Scan der Gründungsurkunde für Ihre Bank.',
      receivedAt: '2026-07-29T09:26:56.000Z',
      isRead: true,
      hasAttachment: true,
      importance: 'high',
      category: 'recht',
    },
    {
      id: 'ms-mail-3',
      subject: 'Tagesübersicht — 3 Benachrichtigungen',
      senderName: 'POINCAP · Quapler',
      senderEmail: 'kemaris@quapler.de',
      preview: 'Hallo Kevin Dieckmann, hier deine Tagesübersicht mit 3 Benachrichtigungen: 2× Dashboard-Alert — Lieferantenkonzentration (Top-Lieferant) über 60 (aktuell 100).',
      receivedAt: '2026-07-28T08:02:01.000Z',
      isRead: false,
      hasAttachment: false,
      importance: 'normal',
      category: 'tool',
    },
    {
      id: 'ms-mail-4',
      subject: 'AW: IG-Gründung — Gründungsgesellschafter',
      senderName: 'Frank Mathick',
      senderEmail: 'f.mathick@kemaris.de',
      preview: 'Hallo, anbei wie gewünscht. Wir werden dann 14:00 Uhr bei Ihnen vor Ort erscheinen. Sollten Sie noch etwas benötigen, melden Sie sich gerne. Vielen Dank. Frank',
      receivedAt: '2026-07-28T07:20:05.000Z',
      isRead: true,
      hasAttachment: true,
      importance: 'normal',
      category: 'intern',
    },
    {
      id: 'ms-mail-5',
      subject: 'Abgesagt: Investoren-Fitness Frank (NIO House)',
      senderName: 'Jan Kronenberger',
      senderEmail: 'j.kronenberger@kemaris.de',
      preview: 'Dieser Termin wurde abgesagt: Weekly: Kommunikations-Coachings & Investoren-Fitness Frank (in person), NIO House Berlin.',
      receivedAt: '2026-07-29T12:17:11.000Z',
      isRead: false,
      hasAttachment: false,
      importance: 'normal',
      category: 'intern',
    },
    {
      id: 'ms-mail-6',
      subject: 'Neuer Lead: SfB Event-Registrierung — Valeria Hermann',
      senderName: 'HubSpot',
      senderEmail: 'noreply@notifications.hubspot.com',
      preview: 'Neue Formular-Übermittlung „SfB_Event-Registrierungsformular". Kontakt: Valeria Hermann. Weitere Felder in HubSpot.',
      receivedAt: '2026-07-22T16:44:47.000Z',
      isRead: true,
      hasAttachment: false,
      importance: 'normal',
      category: 'tool',
    },
    {
      id: 'ms-mail-7',
      subject: 'Beleg / Receipt #2273-3410-1889',
      senderName: 'Anthropic',
      senderEmail: 'invoice+statements@mail.anthropic.com',
      preview: 'Your receipt from Anthropic, PBC #2273-3410-1889. Betrag/Details im angehängten PDF. Für die Buchhaltung an Lisa.',
      receivedAt: '2026-07-22T20:53:57.000Z',
      isRead: true,
      hasAttachment: true,
      importance: 'normal',
      category: 'tool',
    },
    {
      id: 'ms-mail-8',
      subject: 'Nicht vergessen: Deine Elemente sind bald fällig',
      senderName: 'Miro',
      senderEmail: 'product@miro.com',
      preview: 'Miro-Benachrichtigung zu fälligen Board-Elementen. Niedrige Priorität, wahrscheinlich archivierbar.',
      receivedAt: '2026-07-30T06:05:27.000Z',
      isRead: false,
      hasAttachment: false,
      importance: 'normal',
      category: 'tool',
    },
    {
      id: 'ms-mail-9',
      subject: 'Share the meeting highlights!',
      senderName: 'Fireflies',
      senderEmail: 'fred@fireflies.ai',
      preview: 'There is a faster way to share the best moments from the meeting — turn a highlight into a clip anyone can watch in seconds.',
      receivedAt: '2026-07-29T11:35:03.000Z',
      isRead: false,
      hasAttachment: false,
      importance: 'normal',
      category: 'tool',
    },
    {
      id: 'ms-mail-10',
      subject: 'Verifizierungscode / Account bestätigen',
      senderName: 'Vibe Prospecting',
      senderEmail: 'no-reply@mail.vibeprospecting.ai',
      preview: 'Here is your one-time verification code: 22hf3u (expires in 10 minutes). Nur relevant, wenn du den Account wirklich willst.',
      receivedAt: '2026-07-29T11:57:24.000Z',
      isRead: true,
      hasAttachment: false,
      importance: 'normal',
      category: 'tool',
    },
  ],

  calendar: [
    {
      id: 'ms-cal-1',
      title: 'All-In Kevin + Anna',
      start: '2026-06-23T06:00:00.000Z',
      end: '2026-06-23T07:30:00.000Z',
      isAllDay: false,
      location: 'Zoom',
      attendees: ['Anna Schmidt'],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-2',
      title: 'Reflektion',
      start: '2026-06-23T07:30:00.000Z',
      end: '2026-06-23T08:30:00.000Z',
      isAllDay: false,
      location: null,
      attendees: [],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-3',
      title: 'Finanzen',
      start: '2026-06-23T08:30:00.000Z',
      end: '2026-06-23T09:00:00.000Z',
      isAllDay: false,
      location: null,
      attendees: [],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-4',
      title: 'Informationsaustausch',
      start: '2026-06-23T10:00:00.000Z',
      end: '2026-06-23T11:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Jan Kronenberger'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-5',
      title: 'Task Management & Aktueller Stand',
      start: '2026-06-23T11:00:00.000Z',
      end: '2026-06-23T12:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-6',
      title: 'JFK Meeting Gaffelhaus',
      start: '2026-06-23T14:00:00.000Z',
      end: '2026-06-23T20:00:00.000Z',
      isAllDay: false,
      location: 'Gaffelhaus',
      attendees: ['Frank Mathick', 'Jan Kronenberger'],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-7',
      title: 'KEMARIS | HR-Kennzahlen',
      start: '2026-06-24T07:00:00.000Z',
      end: '2026-06-24T14:00:00.000Z',
      isAllDay: false,
      location: 'ILD Office, Westfälische Str. 42, Berlin',
      attendees: ['Arndt Kempen', 'Frank Mathick'],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-8',
      title: 'Strategie DFK',
      start: '2026-06-25T06:00:00.000Z',
      end: '2026-06-25T07:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Danilo Schmidt', 'Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-9',
      title: 'Frank × Kevin',
      start: '2026-06-25T07:00:00.000Z',
      end: '2026-06-25T08:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-10',
      title: 'Check In KEMARIS',
      start: '2026-06-25T08:00:00.000Z',
      end: '2026-06-25T09:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick', 'Jan Kronenberger'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-11',
      title: 'Gerald × Kevin Sales',
      start: '2026-06-25T10:00:00.000Z',
      end: '2026-06-25T11:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: [],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-12',
      title: 'MAKE.Business',
      start: '2026-06-26T06:00:00.000Z',
      end: '2026-06-26T09:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Malin Würriehausen'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-13',
      title: 'Rackerzeit',
      start: '2026-06-27T00:00:00.000Z',
      end: '2026-06-28T00:00:00.000Z',
      isAllDay: true,
      location: null,
      attendees: [],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-14',
      title: 'Rackerzeit',
      start: '2026-06-28T00:00:00.000Z',
      end: '2026-06-29T00:00:00.000Z',
      isAllDay: true,
      location: null,
      attendees: [],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-15',
      title: 'Check In KEMARIS',
      start: '2026-06-29T08:00:00.000Z',
      end: '2026-06-29T08:45:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick', 'Jan Kronenberger', 'Katharina Heinschke'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-16',
      title: 'Strategie, Gründung & Finanzen',
      start: '2026-06-29T09:00:00.000Z',
      end: '2026-06-29T09:45:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Björn Frentrup', 'Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-17',
      title: 'Kick Off Sales',
      start: '2026-06-29T10:30:00.000Z',
      end: '2026-06-29T12:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Kerstin Wilke', 'Arndt Kempen'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-18',
      title: 'Big Picture Abstimmung',
      start: '2026-06-29T13:00:00.000Z',
      end: '2026-06-29T14:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick', 'Jan Kronenberger', 'Walter (Akasha)', 'Katharina Heinschke', 'Michael (Akasha)'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-19',
      title: 'Strategie DFK',
      start: '2026-07-02T06:00:00.000Z',
      end: '2026-07-02T07:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Danilo Schmidt', 'Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-20',
      title: 'Frank × Kevin',
      start: '2026-07-02T07:00:00.000Z',
      end: '2026-07-02T08:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-21',
      title: 'Check In KEMARIS',
      start: '2026-07-02T08:00:00.000Z',
      end: '2026-07-02T09:00:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick', 'Jan Kronenberger'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-22',
      title: 'Sady',
      start: '2026-07-04T07:00:00.000Z',
      end: '2026-07-04T11:00:00.000Z',
      isAllDay: false,
      location: null,
      attendees: [],
      hasMsTeams: false,
    },
    {
      id: 'ms-cal-23',
      title: 'Check In KEMARIS',
      start: '2026-07-06T08:00:00.000Z',
      end: '2026-07-06T08:45:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Frank Mathick', 'Jan Kronenberger', 'Katharina Heinschke'],
      hasMsTeams: true,
    },
    {
      id: 'ms-cal-24',
      title: 'Strategie, Gründung & Finanzen',
      start: '2026-07-06T09:00:00.000Z',
      end: '2026-07-06T09:45:00.000Z',
      isAllDay: false,
      location: 'Microsoft Teams',
      attendees: ['Björn Frentrup', 'Frank Mathick'],
      hasMsTeams: true,
    },
  ],

  teams: [
    {
      id: 'ms-teams-1',
      from: 'Frank Mathick',
      preview: 'Check In KEMARIS — Strategie & operative Entscheidungen (Frank × Kevin bilateral)',
      sentAt: '2026-06-17T09:52:06.917Z',
      chatType: 'meeting',
    },
    {
      id: 'ms-teams-2',
      from: 'Kevin Dieckmann',
      preview: 'k.dieckmann@kemaris.de — Teams-Meeting-Nachricht gesendet',
      sentAt: '2026-06-17T08:35:33.140Z',
      chatType: 'meeting',
    },
  ],

  documents: [
    {
      id: 'ms-doc-1',
      name: 'Partner Strategie',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%204/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/0.%20Aktuelle%20Arbeit/Partner%20Strategie_.docx',
      modifiedAt: '2026-06-11T18:40:01.000Z',
      folder: 'Mission Control / Aktuelle Arbeit',
      preview: 'KEMARIS Connect & Mastermind — biokybernetisches Ökosystem, kein bloßes Vertriebsinstrument.',
    },
    {
      id: 'ms-doc-2',
      name: 'KEMARIS BRAND DNA BIBLE V1',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%204/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/0.%20Aktuelle%20Arbeit/KEMARIS%20BRAND%20DNA%20BIBLE%20V1.0%20Das%20Zentrale%20Nervens.._.docx',
      modifiedAt: '2026-06-11T18:40:02.000Z',
      folder: 'Mission Control / Aktuelle Arbeit',
      preview: 'Das Autonome Nervensystem für KEMARIS — Strategischer Imperativ: DACH-Markt analysiert.',
    },
    {
      id: 'ms-doc-3',
      name: 'V1 Pitchdeck',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%204/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/03.%20Pitchdeck%20%26%20Businessplan/Pitchdeck/V1_Pitchdeck.docx',
      modifiedAt: '2026-06-11T18:42:11.000Z',
      folder: 'Mission Control / Pitchdeck',
      preview: 'KEMARIS – THE CAPITAL & GROWTH ENGINE · KI-gestützte SaaS-Plattform.',
    },
    {
      id: 'ms-doc-4',
      name: 'KSI Score',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%204/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/02.%20Produkte/Dashboard%20-%20KPI_s/KSI%20SCORE_.docx',
      modifiedAt: '2026-06-11T18:42:11.000Z',
      folder: 'Mission Control / Produkte / KPIs',
      preview: 'KEMARIS SOVEREIGNTY INDEX — Zahl 0–100, gesamtheitliche Unternehmens-Handlungsfähigkeit.',
    },
    {
      id: 'ms-doc-5',
      name: 'Term Sheet V1',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%202/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/08.%20Gr%C3%BCndung/05.%20Investorsachen/Term-Sheet_V1.docx',
      modifiedAt: '2026-06-11T17:57:17.000Z',
      folder: 'Mission Control / Gründung / Investor',
      preview: 'Pre-Seed · Pre-Money: €3.000.000 · Investment: bis €1.000.000 · Anteil: ca. 20 %.',
    },
    {
      id: 'ms-doc-6',
      name: 'Vertrieb & Marketing Strategie',
      webUrl: 'https://kemaris-my.sharepoint.com/personal/f_mathick_kemaris_de/Documents/Kemaris%20%C3%96kosystem/KEMARIS_%C3%96kosystem%203/1.0%20Firmen%20%26%20Produkte/1.3%20Mission%20Control/09.%20Sales%20%26%20Marketing/20.02.2026_Vertrieb%20und%20Marketing%20Strategie_.docx',
      modifiedAt: '2026-06-11T18:11:49.000Z',
      folder: 'Mission Control / Sales & Marketing',
      preview: 'Hybrides Vertriebsmodell, erfolgsbasiert — kein Kaltakquise, sondern systemisches Vertrauen.',
    },
  ],
};

/** Ab wann ein Postfach-Stand nicht mehr als Wahrheit durchgeht. */
const MAX_TAGE = 7;

export async function GET() {
  // Mails aus dem Bestand — der ist aktualisierbar. Nur wenn er (noch) nicht
  // existiert, greift der alte, einprogrammierte Stand.
  const store = await loadJson<PostfachStore>('m365-postfach');
  const mails = Array.isArray(store?.mails) && store.mails.length ? store.mails : (DATA.emails as unknown as M365Mail[]);
  const stand = store?.stand ?? DATA.lastUpdated;

  const alterTage = Math.floor((Date.now() - Date.parse(stand)) / 86_400_000);
  const veraltet = !Number.isFinite(alterTage) || alterTage > MAX_TAGE;

  // Write-through: das M365-Postfach gehört ins Brain. ABER ein zu alter
  // Stand darf nicht mehr hinein — sonst setzt der Netzwerk-Abgleich daraus
  // dauerhaft falsche „zuletzt gesprochen"-Daten in die Kontakte.
  if (!veraltet) {
    try { await saveJson('microsoft-inbox', { emails: mails, at: stand }); } catch { /* Anzeige geht vor */ }
  }

  return NextResponse.json(
    {
      ...DATA,
      emails: mails,
      lastUpdated: stand,
      alterTage: Number.isFinite(alterTage) ? alterTage : null,
      veraltet,
      ...(veraltet ? { hinweis: `Postfach-Stand ist ${alterTage} Tage alt — „KEMARIS-Postfach aktualisieren" zu Claude sagen.` } : {}),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Frischen Posteingang ablegen. Aufrufer ist Claude (per Microsoft-Anbindung)
 * oder später der Graph-Abruf selbst. Ersetzt den ganzen Bestand — das
 * Postfach ist ein Spiegel, kein Archiv; gelöschte Mails sollen verschwinden.
 */
export async function PUT(req: Request) {
  let body: { mails?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein JSON.' }, { status: 400 }); }
  if (!Array.isArray(body.mails)) return NextResponse.json({ ok: false, error: 'Feld "mails" (Liste) fehlt.' }, { status: 400 });

  const mails: M365Mail[] = (body.mails as Record<string, unknown>[])
    .filter(m => m && typeof m === 'object' && m.id && m.subject)
    .map(m => ({
      id: String(m.id).slice(0, 300),
      subject: String(m.subject).slice(0, 300),
      senderName: m.senderName ? String(m.senderName).slice(0, 120) : undefined,
      senderEmail: m.senderEmail ? String(m.senderEmail).slice(0, 160) : undefined,
      preview: m.preview ? String(m.preview).slice(0, 400) : undefined,
      receivedAt: String(m.receivedAt ?? new Date().toISOString()).slice(0, 30),
      isRead: m.isRead === true,
      hasAttachment: m.hasAttachment === true,
      importance: m.importance ? String(m.importance).slice(0, 12) : undefined,
      webLink: m.webLink ? String(m.webLink).slice(0, 600) : undefined,
    }))
    .slice(0, 200);

  if (!mails.length) return NextResponse.json({ ok: false, error: 'Keine gültigen Mails in der Liste.' }, { status: 400 });

  const stand = new Date().toISOString();
  await saveJson('m365-postfach', { stand, mails } satisfies PostfachStore);
  return NextResponse.json({ ok: true, anzahl: mails.length, stand });
}
