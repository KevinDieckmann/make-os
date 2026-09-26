import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { istDienst } from '@/lib/zugang/dienst';
import { nurInhaber } from '@/lib/zugang/haushalt-inhaber';

// Im schnellen Modus (next start) würde Next eine GET-Route ohne Anfragebezug beim Bauen einfrieren — hier soll immer der aktuelle Stand kommen.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Microsoft 365 (KEMARIS) — Postfach als Bestand ─────────────────────────
// Die Mails leben seit 03.08. in .data/m365-postfach.json und werden über PUT
// aktualisiert — Kevin sagt Claude „KEMARIS-Postfach aktualisieren", Claude
// zieht den Eingang über die Microsoft-Anbindung und schreibt ihn hierher.
// Bis 26.09. war ein echter Stand vom 30.07. IM CODE eingefroren (Mails,
// Kalender, Teams, Dokumente mit Namen Dritter) — das war personenbezogene
// Daten im Repo (Sicherheitsfund M3). Jetzt: kein Bestand → leer, mit Hinweis.
// Kalender kommt aus iCloud, Teams/Dokumente sind nicht angebunden (leer).
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

/** Ab wann ein Postfach-Stand nicht mehr als Wahrheit durchgeht. */
const MAX_TAGE = 7;

export async function GET() {
  const store = await loadJson<PostfachStore>('m365-postfach');
  const mails = Array.isArray(store?.mails) ? store.mails : [];
  const stand = store?.stand ?? null;

  const alterTage = stand ? Math.floor((Date.now() - Date.parse(stand)) / 86_400_000) : NaN;
  const veraltet = !Number.isFinite(alterTage) || alterTage > MAX_TAGE;

  // Write-through: das M365-Postfach gehört ins Brain. ABER ein zu alter
  // Stand darf nicht mehr hinein — sonst setzt der Netzwerk-Abgleich daraus
  // dauerhaft falsche „zuletzt gesprochen"-Daten in die Kontakte.
  if (!veraltet && mails.length) {
    try { await saveJson('microsoft-inbox', { emails: mails, at: stand }); } catch { /* Anzeige geht vor */ }
  }

  return NextResponse.json(
    {
      emails: mails,
      calendar: [] as unknown[],
      teams: [] as unknown[],
      documents: [] as unknown[],
      lastUpdated: stand,
      alterTage: Number.isFinite(alterTage) ? alterTage : null,
      veraltet,
      ...(stand ? (veraltet ? { hinweis: `Postfach-Stand ist ${alterTage} Tage alt — „KEMARIS-Postfach aktualisieren" zu Claude sagen.` } : {})
        : { hinweis: 'Noch kein Postfach-Stand — „KEMARIS-Postfach aktualisieren" zu Claude sagen.' }),
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
  // Der Spiegel fließt in Kontaktverläufe und Jarvis — nur der Zulieferer (Dienst) oder der Inhaber schreibt ihn (26.09.).
  if (!istDienst(req) && !(await nurInhaber(req))) return NextResponse.json({ ok: false, error: 'Nur für den Inhaber.' }, { status: 403 });
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
