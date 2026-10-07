// ─── Inbox 2 — Antworten / neue Mail senden, NUR auf den Einzelklick der Person (06.10.2026; vorher /api/gmail/senden) ──
// POST { gespraech, an?, cc?, text, von?, uwgBestaetigt?, anfrageId? }        Antwort im Gespräch über die RICHTIGE Quelle:
//        Gmail → Gmail-API (Absender: eigene Adresse oder verifizierter Alias) · IMAP → SMTP des Postfachs (Absender = das Postfach)
//      { neu: { postfach, betreff }, an, cc?, text, uwgBestaetigt?, anfrageId? }   neue Mail aus einem eigenen Postfach
//   → { ok, an, von }  ·  409 { code: 'uwg', uwg }  (§ 7 UWG-Rückfrage, noch nichts gesendet)  ·  409 { code: 'eingeschraenkt' } (Art. 18)
// NUR die eigene Person aus der Sitzung: der Dienstweg (ZOE, Takt, Arbeiter, Skripte) bekommt IMMER 403 — jede Mail erst Entwurf,
// dann Einzelklick (Versand-Regel 28.09.). `anfrageId` macht einen Netz-Retry wirkungslos (einmalig, 24 h). Kein Text im Protokoll.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { gmailSenden, SendenFehler } from '@/lib/gmail/senden';
import { gmailFehlerAntwort } from '@/lib/gmail/antwort';
import { imapSenden } from '@/lib/postfach/senden';
import { ladePostfach } from '@/lib/postfach/register';
import { POSTFACH_ID, GMAIL_POSTFACH } from '@/lib/postfach/typen';
import { PostfachFehler } from '@/lib/postfach/transport';
import { gespraechTeile, istGespraechId } from '@/lib/inbox/strom';
import { nachrichtenVon } from '@/lib/inbox/verlauf';
import { gmailBereit } from '@/lib/gmail/abgleich';
import { einmalig } from '@/lib/store/anfragen';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import type { Adr } from '@/lib/gmail/typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const adressen = (v: unknown): Adr[] | undefined => Array.isArray(v) ? v.slice(0, 40).map(x => ({ email: String((x as Adr)?.email ?? ''), ...((x as Adr)?.name ? { name: String((x as Adr).name) } : {}) })) : undefined;

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  if (zuGross(req, 512 * 1024)) return ZU_GROSS(512 * 1024);
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  const neu = b.neu && typeof b.neu === 'object' ? b.neu as { postfach?: unknown; betreff?: unknown } : null;
  if (!neu && !istGespraechId(b.gespraech)) return NextResponse.json({ ok: false, fehler: 'gespraech bzw. neu fehlt.' }, { status: 400 });
  if (neu && (typeof neu.postfach !== 'string' || !POSTFACH_ID.test(neu.postfach))) return NextResponse.json({ ok: false, fehler: 'Bitte ein Postfach wählen.' }, { status: 400 });
  try {
    const r = await einmalig<Record<string, unknown>>('inbox-senden', b.anfrageId, async () => {
      try {
        const gemeinsam = { person: z.person, text: String(b.text ?? ''), ...(adressen(b.an) ? { an: adressen(b.an) } : {}), ...(adressen(b.cc) ? { cc: adressen(b.cc) } : {}), uwgBestaetigt: b.uwgBestaetigt === true };
        let postfach: string, ausNachricht: string | undefined;
        if (neu) postfach = neu.postfach as string;
        else {
          const t = gespraechTeile(b.gespraech as string)!;
          const n = await nachrichtenVon(z.person, b.gespraech as string);
          if (!n) return { status: 404, body: { ok: false, fehler: 'Dieses Gespräch gibt es nicht (mehr).' } };
          const vonUns = (k: (typeof n.koepfe)[number]) => k.labels.includes('SENT') || k.ordner === 'g' || n.eigene.includes(k.von.email);
          ausNachricht = ([...n.koepfe].reverse().find(k => !vonUns(k) && !k.automatisch) ?? n.koepfe[n.koepfe.length - 1]).id;
          postfach = t.postfach;
        }
        let x: { an: string[]; von: string; id?: string };
        if (postfach === GMAIL_POSTFACH) {
          if (!(await gmailBereit(z.person).catch(() => false))) return { status: 409, body: { ok: false, fehler: 'Gmail ist nicht verbunden.' } };
          const s = await gmailSenden({ ...gemeinsam, ...(ausNachricht ? { ausNachricht } : {}), ...(neu ? { betreff: String(neu.betreff ?? '') } : {}), ...(typeof b.von === 'string' ? { von: b.von } : {}) });
          x = { an: s.an, von: s.von, id: s.id };
        } else {
          const p = await ladePostfach(z.person, postfach);
          if (!p || p.quelle !== 'imap') return { status: 404, body: { ok: false, fehler: 'Dieses Postfach gibt es nicht.' } };
          // Absender = das Postfach. Wer eine andere Adresse verlangt, bekommt nichts gesendet (nie aus Versehen aus dem falschen Bereich).
          if (typeof b.von === 'string' && b.von.trim().toLowerCase() !== p.adresse) return { status: 400, body: { ok: false, code: 'absender', fehler: 'Aus diesem Gespräch wird über das eigene Postfach geantwortet — eine andere Absenderadresse geht hier nicht.' } };
          const s = await imapSenden({ ...gemeinsam, postfach, ...(ausNachricht ? { ausNachricht } : {}), ...(neu ? { betreff: String(neu.betreff ?? '') } : {}) });
          x = { an: s.an, von: s.von };
        }
        await protokolliere('inbox', [{ op: 'neu', id: x.id ?? (b.gespraech as string | undefined) ?? postfach, felder: ['gesendet'] }], wer).catch(() => { /* nur Protokoll */ });
        return { status: 200, body: { ok: true, ...x } };
      } catch (e) {
        if (e instanceof SendenFehler) return { status: e.status, body: { ok: false, code: e.code, fehler: e.message, ...(e.extra ?? {}) } };
        if (e instanceof PostfachFehler) return { status: e.code === 'anmeldung' ? 409 : e.status, body: { ok: false, code: e.code, fehler: e.message } };
        throw e;
      }
    });
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) { return gmailFehlerAntwort(e); }
}
