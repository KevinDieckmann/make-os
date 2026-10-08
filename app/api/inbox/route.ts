// ─── Inbox 2 — der eine Strom aller eigenen Postfächer (06.10.2026) ─────────────────────────────────────────────
// GET  ?bereich=<id> | ?space=privat|business   → { ok, postfaecher, gespraeche, lage, zoe, bereiche, google, heute }
//      Gespräche statt Einzelmails (Gmail + IMAP; WhatsApp vorbereitet), serverseitig nach Bereich gefiltert (lib/inbox/strom-server.ts
//      `imBereich`) — ein Business-Bereich sieht nie Privates; ohne Filter alle EIGENEN Postfächer. ETag (304 beim 60-s-Abgleich).
// POST { aktion, id, bis?, kontaktId? }          → erledigt · gelesen · ungelesen · spaeter · zurueck · zuordnen · loesen · zulassen · blocken · offen
//      { aktion: 'kuemmert', id, wer|null, stand } → „wer kümmert sich“ (Team-Postfach, WhatsApp; 08.10.) — veralteter Stand → 409 + aktueller
//      { aktion: 'alle-erledigen', ids }         → am Stück (Info & Rundschreiben), höchstens 200 (sonst 413)
//      { aktion: 'abgleichen' }                  → jetzt mit allen eigenen Postfächern abgleichen
// NUR die eigene Person aus der Sitzung (`eigenePerson`): der Dienstweg (ZOE, Takt, Skripte) bekommt 403, ein anderes Konto sieht nie
// fremde Postfächer (es gibt keinen Personen-Parameter). Nichts wird automatisch zugeordnet, abgelegt oder beantwortet.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { speicherStand } from '@/lib/store/local-db';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { stromFuer, type StromFilter } from '@/lib/inbox/strom-server';
import { aktionAusfuehren, alleErledigen, istAktion, AktionsFehler, kuemmertSetzen } from '@/lib/inbox/aktionen';
import { teilenStandNamen } from '@/lib/inbox/uebergaben-speicher';
import { TeamKonflikt } from '@/lib/inbox/teilen-server';
import { TeilenFehler } from '@/lib/inbox/teilen';
import { istGespraechId } from '@/lib/inbox/strom';
import { zustandName } from '@/lib/inbox/zustand';
import { registerName, imapStandName } from '@/lib/postfach/typen';
import { gmailStandName } from '@/lib/gmail/typen';
import { WA_SPIEGEL, WA_ZUSTAND } from '@/lib/whatsapp/spiegel'; // WhatsApp (07.10.): neue Nachrichten ändern den ETag sofort
import { ladePostfaecher } from '@/lib/postfach/register';
import { imapAbgleichen } from '@/lib/postfach/abgleich';
import { gmailAbgleichen, gmailBereit } from '@/lib/gmail/abgleich';
import { PostfachFehler } from '@/lib/postfach/transport';
import { gmailFehlerAntwort } from '@/lib/gmail/antwort';
import { ZustandFehler } from '@/lib/inbox/zustand';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BEREICH = /^(privat|kdc|kdv|ug|g-[a-z0-9][a-z0-9-]{3,62})$/;

function filterAus(req: Request): StromFilter | null {
  const q = new URL(req.url).searchParams;
  const bereich = q.get('bereich');
  const space = q.get('space');
  if (bereich && !BEREICH.test(bereich)) return null;
  if (space && space !== 'privat' && space !== 'business') return null;
  return { ...(bereich ? { bereich } : {}), ...(space ? { space: space as 'privat' | 'business' } : {}) };
}

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const f = filterAus(req);
  if (!f) return NextResponse.json({ ok: false, fehler: 'bereich bzw. space ist ungültig.' }, { status: 400 });
  const p = z.person;
  const etag = etagAus('inbox2', p, f.bereich ?? '', f.space ?? '', await speicherStand([registerName(p), imapStandName(p), gmailStandName(p), zustandName(p), 'kontakte', 'crm', `google-verbindung--${p}`, WA_SPIEGEL, WA_ZUSTAND, 'konten', ...(await teilenStandNamen(p))]), localDay(), String(Math.floor(Date.now() / 60_000)));
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const s = await stromFuer(p, f);
  // Nachrichten-Kennungen bleiben auf dem Server — der Browser arbeitet nur mit Gesprächs-Kennungen.
  return jsonAntwort(req, { ok: true, ...s, gespraeche: s.gespraeche.map(({ nachrichten: _n, ...g }) => g) }, etag);
}

function fehlerAntwort(e: unknown): NextResponse {
  if (e instanceof TeamKonflikt) return NextResponse.json({ ok: false, konflikt: true, fehler: e.message, ...e.aktuell }, { status: 409 });
  if (e instanceof AktionsFehler || e instanceof ZustandFehler || e instanceof TeilenFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
  if (e instanceof PostfachFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.code === 'anmeldung' ? 409 : e.status });
  return gmailFehlerAntwort(e);
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: unknown; id?: unknown; ids?: unknown; bis?: unknown; kontaktId?: unknown; wer?: unknown; stand?: unknown };
  try { b = await jsonBegrenzt(req, 64 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    if (b.aktion === 'abgleichen') {
      const liste = await ladePostfaecher(z.person);
      const laeufe: Promise<unknown>[] = liste.filter(p => p.quelle === 'imap').map(p => imapAbgleichen(z.person, p.id, { erzwingen: true }));
      if (await gmailBereit(z.person).catch(() => false)) laeufe.push(gmailAbgleichen(z.person));
      const r = await Promise.allSettled(laeufe);
      const fehler = r.filter(x => x.status === 'rejected').length;
      return NextResponse.json({ ok: true, postfaecher: r.length, fehler });
    }
    if (b.aktion === 'alle-erledigen') {
      if (!Array.isArray(b.ids) || !b.ids.every(istGespraechId)) return NextResponse.json({ ok: false, fehler: 'ids (Gespräche) fehlen.' }, { status: 400 });
      if (b.ids.length > 200) return NextResponse.json({ ok: false, fehler: 'Höchstens 200 Gespräche auf einmal.' }, { status: 413 });
      const r = await alleErledigen(z.person, b.ids as string[]);
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.aktion === 'kuemmert') {
      if (!istGespraechId(b.id)) return NextResponse.json({ ok: false, fehler: 'id (Gespräch) fehlt.' }, { status: 400 });
      if (typeof b.stand !== 'string' || !/^[0-9a-f]{1,32}$/.test(b.stand)) return NextResponse.json({ ok: false, fehler: 'stand fehlt — bitte neu laden.' }, { status: 400 });
      if (b.wer !== null && (typeof b.wer !== 'string' || !/^[a-z0-9-]{1,40}$/.test(b.wer))) return NextResponse.json({ ok: false, fehler: 'wer ist ungültig.' }, { status: 400 });
      const r = await kuemmertSetzen(z.person, b.id, b.wer as string | null, b.stand);
      await protokolliere('inbox', [{ op: 'geaendert', id: b.id, felder: ['kuemmert'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, ...r });
    }
    if (!istAktion(b.aktion) || !istGespraechId(b.id)) return NextResponse.json({ ok: false, fehler: 'aktion und id (Gespräch) fehlen.' }, { status: 400 });
    const r = await aktionAusfuehren(z.person, b.id, b.aktion, {
      ...(typeof b.bis === 'string' ? { bis: b.bis } : {}), ...(typeof b.kontaktId === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(b.kontaktId) ? { kontaktId: b.kontaktId } : {}),
    });
    if (b.aktion === 'zuordnen' || b.aktion === 'loesen') await protokolliere('inbox', [{ op: 'geaendert', id: b.id, felder: [b.aktion] }], werAus(req)).catch(() => { /* nur Protokoll */ });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return fehlerAntwort(e); }
}
