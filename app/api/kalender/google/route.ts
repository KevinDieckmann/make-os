// ─── Kalender — Google: Status, Abgleich, Kalender wählen (03.10.2026) ───────
// GET [?liste=1]                       → Status der EIGENEN Verbindung + des Kalenders: verbunden als k***@…, letzter
//                                        Abgleich (vor X Min., veraltet ab 30), Push (aktiv/aus), Kalendername;
//                                        mit `liste=1` zusätzlich die wählbaren Google-Kalender des Kontos
// POST { aktion: 'abgleichen' }        → jetzt abgleichen (inkrementell)
//      { aktion: 'voll' }              → syncToken verwerfen, alles neu lesen
//      { aktion: 'kalender', kalenderId } → anderen Google-Kalender wählen (Bestand wird neu aufgesetzt)
// Nur die eigene Person (Sitzung) — Dienstweg und andere Konten 403 (lib/google/zugang.ts). Nie Tokens in Antworten.
import { NextResponse } from 'next/server';
import { googleStatus, GoogleVerbindungsFehler } from '@/lib/google/verbindung';
import { GoogleApiFehler } from '@/lib/google/http';
import { eigenePerson } from '@/lib/google/zugang';
import { ladeGoogleStand } from '@/lib/kalender/google/stand';
import { googleAbgleichen, googleKalenderListe, googleKalenderWaehlen, googleAlter } from '@/lib/kalender/google/abgleich';
import { webhookAdresse } from '@/lib/kalender/google/kanal';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fehlerAntwort(e: unknown) {
  if (e instanceof GoogleVerbindungsFehler) return NextResponse.json({ ok: false, code: e.code, fehler: e.message }, { status: e.status });
  if (e instanceof GoogleApiFehler) return NextResponse.json({ ok: false, fehler: e.message }, { status: e.status >= 500 ? 502 : e.status === 429 ? 429 : 409 });
  return NextResponse.json({ ok: false, fehler: 'Google ist gerade nicht erreichbar.' }, { status: 502 });
}

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const status = await googleStatus(z.person);
  const stand = status.verbunden ? await ladeGoogleStand(z.person) : null;
  let liste: { id: string; name: string; primary: boolean; schreibbar: boolean; gewaehlt: boolean }[] | undefined;
  let listeFehler: string | undefined;
  if (status.verbunden && new URL(req.url).searchParams.get('liste') === '1') {
    try { liste = (await googleKalenderListe(z.person)).map(k => ({ id: k.id, name: k.name, primary: k.primary, schreibbar: k.schreibbar, gewaehlt: stand?.kalenderId === k.id })); }
    catch (e) { listeFehler = e instanceof Error ? e.message.slice(0, 160) : 'Kalenderliste nicht lesbar.'; }
  }
  return NextResponse.json({
    ok: true, ...status, erlaubteDomain: !!status.erlaubteDomain,
    kalender: stand ? { name: stand.kalenderName, schreibbar: stand.schreibbar } : null,
    abgleich: googleAlter(stand) ?? undefined,
    push: webhookAdresse() ? (stand?.kanal && stand.kanal.ablauf > Date.now() ? 'aktiv' : 'wartet') : 'aus',
    ...(stand?.aussen ? { vonAussen: stand.aussen } : {}),
    ...(liste ? { liste } : {}), ...(listeFehler ? { listeFehler } : {}),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: string; kalenderId?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    if (b.aktion === 'abgleichen' || b.aktion === 'voll') {
      const r = await googleAbgleichen(z.person, { voll: b.aktion === 'voll' });
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.aktion === 'kalender') {
      const id = typeof b.kalenderId === 'string' && b.kalenderId.length <= 300 ? b.kalenderId : '';
      if (!id) return NextResponse.json({ ok: false, fehler: 'kalenderId fehlt.' }, { status: 400 });
      await googleKalenderWaehlen(z.person, id);
      await protokolliere('kalender', [{ liste: 'google', op: 'geaendert', id: 'kalender', felder: ['gewaehlt'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
      const r = await googleAbgleichen(z.person, { voll: true });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ ok: false, fehler: 'aktion = abgleichen | voll | kalender' }, { status: 400 });
  } catch (e) { return fehlerAntwort(e); }
}
