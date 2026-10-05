// ─── Gmail — Antworten / Senden NUR auf den Einzelklick der Person (03.10.2026) ──
// POST { ausNachricht?, an?, cc?, betreff?, text, von?, uwgBestaetigt?, anfrageId? }
//   → { ok, id, threadId, von, an }                       gesendet (Antwort im Thread: In-Reply-To/References/Re:)
//   → 409 { ok:false, code:'uwg', uwg:{ woerter, empfaenger } }   Rückfrage nach § 7 UWG — noch nichts gesendet
//   → 409 { code:'eingeschraenkt' }                       Art. 18: an eingeschränkte Personen nie
// NUR die eigene Person aus der Sitzung: der Dienstweg (ZOE, Takt, Arbeiter, Skripte) bekommt IMMER 403 — jede Mail erst Entwurf,
// dann Einzelklick (Versand-Regel). `anfrageId` macht einen Netz-Retry wirkungslos (einmalig, 24 h).
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson } from '@/lib/google/zugang';
import { gmailSenden, SendenFehler } from '@/lib/gmail/senden';
import { gmailFehlerAntwort } from '@/lib/gmail/antwort';
import { einmalig } from '@/lib/store/anfragen';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import type { Adr } from '@/lib/gmail/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const adressen = (v: unknown): Adr[] | undefined => Array.isArray(v) ? v.slice(0, 40).map(x => ({ email: String((x as Adr)?.email ?? ''), ...((x as Adr)?.name ? { name: String((x as Adr).name) } : {}) })) : undefined;

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  if (zuGross(req, 512 * 1024)) return ZU_GROSS(512 * 1024);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  try {
    const r = await einmalig<Record<string, unknown>>('gmail-senden', b.anfrageId, async () => {
      try {
        const x = await gmailSenden({
          person: z.person, text: String(b.text ?? ''),
          ...(typeof b.ausNachricht === 'string' && /^[A-Za-z0-9]{6,40}$/.test(b.ausNachricht) ? { ausNachricht: b.ausNachricht } : {}),
          ...(adressen(b.an) ? { an: adressen(b.an) } : {}), ...(adressen(b.cc) ? { cc: adressen(b.cc) } : {}),
          ...(typeof b.betreff === 'string' ? { betreff: b.betreff } : {}), ...(typeof b.von === 'string' ? { von: b.von } : {}),
          uwgBestaetigt: b.uwgBestaetigt === true,
        });
        await protokolliere('gmail', [{ op: 'neu', id: x.id, felder: ['gesendet'] }], wer).catch(() => { /* nur Protokoll */ });
        return { status: 200, body: { ok: true, ...x } };
      } catch (e) {
        if (e instanceof SendenFehler) return { status: e.status, body: { ok: false, code: e.code, fehler: e.message, ...(e.extra ?? {}) } };
        throw e;
      }
    });
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) { return gmailFehlerAntwort(e); }
}
