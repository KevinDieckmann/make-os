// ─── MAKE OS — Der Takt (Route) ─────────────────────────────────────────────
// GET  zeigt, was gerade fällig wäre — ohne etwas zu tun.
// POST reiht das Fällige in die Warteschlange ein.
//
// Der Arbeiter fragt jede Minute, der Browser alle paar Minuten als Rückfall.
// Beides zusammen erzeugt nichts doppelt: die Fälligkeit kommt aus dem echten
// Zustand, und die Warteschlange lässt denselben Auftrag nur einmal offen.
// S1 #16 (29.09.): nur der Dienstweg (Arbeiter) oder eine Sitzung im Haushalt des Inhabers — vorher konnte jedes
// angemeldete Konto (auch ohne Haushalt) den Takt anstoßen und damit Abgleich, Sicherung und Aufträge auslösen.

import { herzschlag } from '@/lib/hoi/innen';
import { NextResponse } from 'next/server';
import { faellig } from '@/lib/zoe/takt';
import { reihe } from '@/lib/zoe/auftraege';
import { alleSichten } from '@/lib/business/speicher';
import { kalenderJobsImTakt } from '@/lib/kalender/takt-jobs';
import { crmSignaleImTakt } from '@/lib/crm/signale-server';
import { gmailJobsImTakt } from '@/lib/gmail/takt';
import { postfachJobsImTakt } from '@/lib/postfach/takt';
import { whatsappJobsImTakt } from '@/lib/whatsapp/takt';
import { whoopJobsImTakt } from '@/lib/whoop/takt';
import { zoeWhatsappJobsImTakt } from '@/lib/zoe-whatsapp/takt';
import { localDay } from '@/lib/zeit';
import { istDienst } from '@/lib/zugang/dienst';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';

/** Darf diese Anfrage den Takt sehen/anstoßen? Dienstweg (mit oder ohne Person) oder Haushalt des Inhabers. */
async function taktErlaubt(req: Request): Promise<boolean> {
  return istDienst(req) || !!(await imHaushaltDesInhabers(req));
}
const TAKT_GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });

/** Business-Index: einmal am Tag festhalten (Verlauf, Trend, Ampel-Wechsel, MRR für die NRR) — auch ohne offene Seite. */
let businessTag = '';
async function businessTagesstand() {
  const heute = localDay();
  if (businessTag === heute) return;
  businessTag = heute;
  await alleSichten(heute).catch(() => { businessTag = ''; });
}


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await taktErlaubt(req))) return TAKT_GESPERRT();
  // ?in=<Minuten> schaut voraus, ohne etwas zu tun — so lässt sich prüfen, ob
  // der Takt später wirklich anspringt, statt darauf zu warten.
  const vor = Number(new URL(req.url).searchParams.get('in')) || 0;
  const jetzt = new Date(Date.now() + Math.max(0, Math.min(24 * 60, vor)) * 60_000);
  const dran = await faellig(jetzt);
  return NextResponse.json({
    ok: true,
    zeitpunkt: jetzt.toISOString(),
    faellig: dran.map(f => ({ id: f.id, grund: f.grund, name: f.auftrag.name, auftrag: f.auftrag.auftrag })),
  });
}

export async function POST(req: Request) {
  if (!(await taktErlaubt(req))) return TAKT_GESPERRT();
  // Herzschlag nur vom Arbeiter (Dienstweg) — der Browser stößt den Takt als Rückfall auch an; sein Anstoß hielt das Lagebild „Arbeiter“ grün
  // und Agenten-Läufe warteten unsichtbar, obwohl niemand die Warteschlange abholt (Durchstich 09.10.).
  if (istDienst(req)) void herzschlag();
  // Brain-Index alle 30 Minuten leise mit dem Vault abgleichen (27.09.; erst 10, seit der Tempo-Prüfung 30 — der Lauf
  // liest alle Notizen und rechnet synchron in SQLite) — nie blockierend.
  void import('@/lib/brain/index').then(ix => ix.indexFrischHalten(30)).catch(() => {});
  // Kalender (U1 M4): höchstens EIN iCloud-Job je Takt, gestaffelt — Abgleich (alle 5 Min., seit 27.09.: ZOE, Morgenlauf
  // und Heute lesen den Stand auch ohne offene Seite), sonst die Tagessicherung (R-K1 #K5, 03:00–05:00, frühestens 30 Min.
  // nach dem Start), sonst der Event-Spiegel (K6a, alle 30 Min.; U1 B3: nur eigene, künftige Termine, Absagen → Glocke).
  // Nie blockierend; Fehler als eine Zeile `[kalender-sicherung] …` / `[spiegel] …` (lib/kalender/takt-jobs.ts).
  const kalenderJob = await kalenderJobsImTakt().catch(() => 'wartet' as const);
  // CRM-Signale (09.10., Takt robust): vergangene Termine → Verlauf und „letzter Kontakt“ — vorher nur, wenn jemand die Markttraktion
  // öffnete. Gestaffelt wie die Kalender-Jobs: nur, wenn dieser Takt keinen iCloud-Job hat und iCloud nicht pausiert; alle 10 Min.
  // Systemlauf ohne KI, nie blockierend (lib/crm/signale-server.ts).
  void crmSignaleImTakt(kalenderJob).catch(() => {});
  // Gmail (03.10.): Abgleich je verbundener Person (alle 2 Min., mit Push alle 15) — nie blockierend, Fehler als eine Zeile `[gmail] …`.
  void gmailJobsImTakt().catch(() => {});
  // Inbox 2 (06.10.): IMAP-Postfächer je Person (alle 2 Min., mit IDLE alle 15 + sofort bei neuer Post) — nie blockierend, `[postfach] …`.
  void postfachJobsImTakt().catch(() => {});
  // WhatsApp (07.10.): Medien nachladen, die der Webhook nicht laden konnte, und Dateien ohne Nachricht entfernen — ohne Einrichtung nichts.
  void whatsappJobsImTakt().catch(() => {});
  // WHOOP je Person (08.10.): Abgleich stündlich (mit Webhooks alle 6 h) — nie blockierend, Fehler als eine Zeile `[whoop] …`.
  void whoopJobsImTakt().catch(() => {});
  // ZOE auf WhatsApp (08.10.): liegen gebliebene Nachrichten an ZOE verarbeiten, Sprachnachrichten nach 30 Tagen löschen — ohne Einrichtung nichts.
  void zoeWhatsappJobsImTakt().catch(() => {});
  void businessTagesstand();
  // Agenten (Härtetest 09.10.): verwaiste Läufe („läuft“ ohne Prozess nach einem Neustart, „wartet“ auf einen aufgegebenen Auftrag) enden
  // sichtbar mit „fehler“ und einer Glocke — nie „läuft“ für immer. Nie blockierend.
  void import('@/lib/agenten/delegation').then(m => m.verwaisteLaeufeAufraeumen()).catch(() => {});
  // Ereignisse (09.10., E1): Cursor je Konsument nachziehen, BEVOR eingereiht wird — erledigt ist ein Ereignis erst, wenn sein Auftrag in der
  // Warteschlange steht (GET schaut nur voraus und schreibt nie). Wirft nie.
  await import('@/lib/ereignisse/takt').then(m => m.ereignisCursorNachziehen()).catch(() => {});
  const dran = await faellig();
  if (!dran.length) return NextResponse.json({ ok: true, eingereiht: 0 });
  const { angelegt, schonDa, abgelehnt } = await reihe(dran.map(f => f.auftrag));
  return NextResponse.json({
    ok: true,
    eingereiht: angelegt.length,
    schonDa,
    // Warteschlange voll (09.10.): abgelehnt statt gekürzt — der Head of IT zeigt es rot.
    ...(abgelehnt ? { abgelehnt } : {}),
    was: dran.map(f => `${f.id} (${f.grund})`),
  });
}
