// ─── Inbox teilen — Übergaben (08.10.2026, Lücke 6 „Business Couple“) ───────────────────────────────────────────────
// GET  ?bereich=<id> | ?space=privat|business     → { ok, uebergaben }  die Übergaben an bzw. von der Person (ohne Texte), Bereichsfilter
//                                                    wie der Strom (`imBereich`)
//      ?id=ub-…                                    → { ok, uebergabe (Kopie mit Texten), zeile, neuer, postfaecher } — nur sichtbare
//                                                    (`uebergabeSichtbar`), sonst 404; Anhänge nur als Liste (laden kann sie nur die
//                                                    übergebende Person aus IHREM Spiegel). Lesen der Empfängerin → Lese-Protokoll.
// POST { aktion: 'uebergeben', gespraech, an, notiz? }                     Kopie eines EIGENEN Gesprächs an eine Person des Haushalts mit
//                                                                          Zugang zum Bereich (Privat nur an volle Mitglieder) → Glocke
//      { aktion: 'zurueck' | 'erledigt' | 'wieder' | 'kuemmert' | 'aktualisieren', id, notiz?, wer?, stand? }
//                                                                          Stand veraltet → 409; fremde Übergabe → 404; nicht erlaubt → 403
// NUR die eigene Person aus der Sitzung (`eigenePerson`; Dienstweg 403). Protokoll nur Kennung + Feldnamen, nie Text oder Notiz.
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { eigenePerson, NUR_EIGENE_POST } from '@/lib/google/zugang';
import { istGespraechId } from '@/lib/inbox/strom';
import { imBereich } from '@/lib/inbox/strom-server';
import { TeilenFehler, uebergabeZeile } from '@/lib/inbox/teilen';
import { teamPersonen } from '@/lib/inbox/teilen-server';
import { uebergabeZeilenFuer } from '@/lib/inbox/uebergaben-speicher';
import { antwortPostfaecher, neuerAlsKopie, uebergabeAktion, uebergabeFinden, uebergeben, UEBERGABE_BEFEHLE, type UebergabeBefehl } from '@/lib/inbox/uebergaben-server';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BEREICH = /^(privat|kdc|kdv|ug|g-[a-z0-9][a-z0-9-]{3,62})$/;
const UB_ID = /^ub-[0-9a-f-]{36}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;

export async function GET(req: Request) {
  const z = await eigenePerson(req, false, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  if (id !== null) {
    if (!UB_ID.test(id)) return NextResponse.json({ ok: false, fehler: 'id fehlt.' }, { status: 400 });
    const u = await uebergabeFinden(z.person, id);
    if (!u) return NextResponse.json({ ok: false, fehler: 'Diese Übergabe gibt es nicht (mehr).' }, { status: 404 });
    // Die Empfängerin liest Post aus dem Postfach einer anderen Person — nachweisbar (nur wessen Post, nie Inhalt).
    if (u.an === z.person) leseZugriff(req, 'inbox', { betroffen: u.von, anzahl: u.nachrichten.length });
    const namen = Object.fromEntries((await teamPersonen()).map(t => [t.speicher, t.name]));
    const [neuer, postfaecher] = await Promise.all([neuerAlsKopie(z.person, u), u.an === z.person ? antwortPostfaecher(z.person, u) : Promise.resolve([])]);
    return NextResponse.json({ ok: true, uebergabe: u, zeile: uebergabeZeile(u, z.person, namen), neuer, postfaecher }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const bereich = q.get('bereich');
  const space = q.get('space');
  if ((bereich && !BEREICH.test(bereich)) || (space && space !== 'privat' && space !== 'business')) return NextResponse.json({ ok: false, fehler: 'bereich bzw. space ist ungültig.' }, { status: 400 });
  const f = { ...(bereich ? { bereich } : {}), ...(space ? { space: space as 'privat' | 'business' } : {}) };
  const zeilen = (await uebergabeZeilenFuer(z.person)).filter(u => imBereich(u.bereich, f));
  return NextResponse.json({ ok: true, uebergaben: zeilen }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true, NUR_EIGENE_POST);
  if (z instanceof NextResponse) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 16 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const wer = werAus(req);
  try {
    if (b.aktion === 'uebergeben') {
      if (!istGespraechId(b.gespraech) || typeof b.an !== 'string' || !PERSON.test(b.an)) return NextResponse.json({ ok: false, fehler: 'gespraech und an fehlen.' }, { status: 400 });
      const u = await uebergeben(z.person, b.gespraech, b.an, b.notiz);
      await protokolliere('inbox-uebergaben', [{ op: 'neu', id: u.id, felder: ['uebergeben', ...(u.notiz ? ['notiz'] : [])] }], wer).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, id: u.id, text: 'Übergeben — die Kopie liegt jetzt in der Inbox der anderen Person.' });
    }
    if (!UEBERGABE_BEFEHLE.includes(b.aktion as UebergabeBefehl) || typeof b.id !== 'string' || !UB_ID.test(b.id)) {
      return NextResponse.json({ ok: false, fehler: `aktion = uebergeben | ${UEBERGABE_BEFEHLE.join(' | ')} und id fehlen.` }, { status: 400 });
    }
    if (b.stand !== undefined && (typeof b.stand !== 'string' || !/^[0-9a-f]{1,32}$/.test(b.stand))) return NextResponse.json({ ok: false, fehler: 'stand ist ungültig.' }, { status: 400 });
    const befehl = b.aktion as UebergabeBefehl;
    const u = await uebergabeAktion(z.person, b.id, befehl, { ...(b.notiz !== undefined ? { notiz: b.notiz } : {}), ...(typeof b.wer === 'string' ? { wer: b.wer } : {}), ...(typeof b.stand === 'string' ? { stand: b.stand } : {}) });
    await protokolliere('inbox-uebergaben', [{ op: 'geaendert', id: u.id, felder: [befehl] }], wer).catch(() => { /* nur Protokoll */ });
    const text = befehl === 'zurueck' ? 'Zurückgegeben.' : befehl === 'erledigt' ? 'Erledigt — für euch beide.' : befehl === 'wieder' ? 'Wieder übergeben.' : befehl === 'aktualisieren' ? 'Kopie aktualisiert.' : 'Gespeichert.';
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    if (e instanceof TeilenFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status });
    throw e;
  }
}
