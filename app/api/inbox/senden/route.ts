// ─── Inbox 2 — Antworten / neue Mail senden, NUR auf den Einzelklick der Person (06.10.2026; vorher /api/gmail/senden) ──
// POST { gespraech, an?, cc?, text, von?, uwgBestaetigt?, anfrageId? }        Antwort im Gespräch über die RICHTIGE Quelle:
//        Gmail → Gmail-API (Absender: eigene Adresse oder verifizierter Alias) · IMAP → SMTP des Postfachs (Absender = das Postfach)
//      { neu: { postfach, betreff }, an, cc?, text, uwgBestaetigt?, anfrageId? }   neue Mail aus einem eigenen Postfach
//      … anhaenge?: [{ datei: 'd-…' }]   (10.10.) Dateien der CRM-Ablage mit Bezug (z. B. Fortschritts-Report am Mandat) — nur Kennungen, höchstens
//      drei, zusammen 4 MB (lib/inbox/anhaenge-server.ts); nie Bytes aus dem Browser
//   → { ok, an, von }  ·  409 { code: 'uwg', uwg }  (§ 7 UWG-Rückfrage, noch nichts gesendet)  ·  409 { code: 'eingeschraenkt' } (Art. 18)
// NUR die eigene Person aus der Sitzung: der Dienstweg (ZOE, Takt, Arbeiter, Skripte) bekommt IMMER 403 — jede Mail erst Entwurf,
// dann Einzelklick (Versand-Regel 28.09.). `anfrageId` macht einen Netz-Retry wirkungslos (einmalig, 24 h). Kein Text im Protokoll.
// Team (08.10., Lücke 6):
//      Gespräch eines Team-Postfachs → gesendet ALS dieses Postfach über den Zugang des Besitzers; im Änderungsprotokoll steht die
//      sendende Person (Sitzung) mit dem Feld „team-postfach“.
//      { uebergabe, postfach, an?, cc?, text, uwgBestaetigt?, anfrageId? }   Antwort der Empfängerin auf eine übergebene Mail — NUR aus
//      einem eigenen Postfach (oder einem Team-Postfach, das sie sieht) desselben Raums (Privat ↔ Privat, Business ↔ Business);
//      „Re:“ + In-Reply-To/References aus der Kopie, danach der Vermerk „geantwortet“ an der Übergabe.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { gmailFehlerAntwort } from '@/lib/gmail/antwort';
import { POSTFACH_ID } from '@/lib/postfach/typen';
import { istGespraechId } from '@/lib/inbox/strom';
import { einmalig } from '@/lib/store/anfragen';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { inboxSenden } from '@/lib/inbox/senden-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (zuGross(req, 512 * 1024)) return ZU_GROSS(512 * 1024);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  const neu = b.neu && typeof b.neu === 'object' ? b.neu as { postfach?: unknown; betreff?: unknown } : null;
  const uebergabe = typeof b.uebergabe === 'string' && /^ub-[0-9a-f-]{36}$/.test(b.uebergabe) ? b.uebergabe : null;
  if (!neu && !uebergabe && !istGespraechId(b.gespraech)) return NextResponse.json({ ok: false, fehler: 'gespraech, uebergabe bzw. neu fehlt.' }, { status: 400 });
  if (neu && (typeof neu.postfach !== 'string' || !POSTFACH_ID.test(neu.postfach))) return NextResponse.json({ ok: false, fehler: 'Bitte ein Postfach wählen.' }, { status: 400 });
  if (uebergabe && (typeof b.postfach !== 'string' || !POSTFACH_ID.test(b.postfach))) return NextResponse.json({ ok: false, fehler: 'Bitte ein eigenes Postfach wählen.' }, { status: 400 });
  try {
    // 21.10.: der Versand selbst steht in lib/inbox/senden-server.ts (auch für die Freigabe eines Prozess-Vorschlags, N12) — Verhalten unverändert.
    const r = await einmalig<Record<string, unknown>>('inbox-senden', b.anfrageId, () => inboxSenden(z.person, b, wer), undefined, { wer: z.person }); // Nachschliff 09.10.: die gemerkte Antwort nur für die Person selbst (lib/store/anfragen.ts `wer`)
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) { return gmailFehlerAntwort(e); }
}
