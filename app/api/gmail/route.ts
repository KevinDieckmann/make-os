// ─── Gmail in der Inbox — Liste, Stand, Markieren, Abgleich (03.10.2026) ─────
// GET                       → { ok, konfiguriert, verbunden, bereit, konto (maskiert), abgleich, push, aliase, nachrichten[] }
//                             die Nachrichten des EIGENEN Spiegels (schlank: Kopf, Ausschnitt, Labels, Zuordnung) — der Text kommt über
//                             /api/gmail/nachricht. Ohne Gmail: `bereit: false` und eine leere Liste.
// POST { aktion: 'abgleichen' | 'voll' }                     → jetzt abgleichen
//      { aktion: 'markieren', id, was: 'gelesen' | 'ungelesen' | 'archivieren' | 'posteingang' } → an Gmail zurück, Spiegel zieht nach
//      { aktion: 'ausschalten' }                             → nur Gmail aus (Kalender bleibt): Spiegel weg, Überwachung beendet
// NUR die eigene Person (Sitzung) — Dienstweg und andere Konten 403 (lib/google/zugang.ts): kein Mail-Inhalt für ZOE, Takt oder
// das andere Konto. Nie Tokens in Antworten.
import { NextResponse } from 'next/server';
import { googleStatus } from '@/lib/google/verbindung';
import { eigenePerson } from '@/lib/google/zugang';
import { gmailAusschalten } from '@/lib/google/trennen';
import { gmailAbgleichen, gmailAlter, gmailBereit } from '@/lib/gmail/abgleich';
import { gmailWebhookAdresse, pushKonfig } from '@/lib/gmail/meldung';
import { gmailMarkieren, istMarkierAktion } from '@/lib/gmail/aktion';
import { gmailFehlerAntwort } from '@/lib/gmail/antwort';
import { ladeGmailStand, istUngelesen, imPosteingang, istGesendet } from '@/lib/gmail/stand';
import { zuordnungenFuer } from '@/lib/gmail/zuordnung';
import { speicherStand } from '@/lib/store/local-db';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { gmailStandName } from '@/lib/gmail/typen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const z = await eigenePerson(req);
  if (z instanceof NextResponse) return z;
  const status = await googleStatus(z.person);
  const bereit = status.verbunden && await gmailBereit(z.person);
  const basis = { ok: true, konfiguriert: status.konfiguriert, verbunden: status.verbunden, bereit, konto: status.konto, getrennt: status.getrennt };
  if (!bereit) return NextResponse.json({ ...basis, nachrichten: [], aliase: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const stand = await ladeGmailStand(z.person);
  if (!stand) return NextResponse.json({ ...basis, nachrichten: [], aliase: [], einrichten: true }, { headers: { 'Cache-Control': 'no-store' } });
  const etag = etagAus('gm', z.person, await speicherStand([gmailStandName(z.person), 'kontakte', 'crm']), stand.at ?? '', String(Math.floor(Date.now() / 60_000)));
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const liste = Object.values(stand.koepfe).sort((a, b) => b.am.localeCompare(a.am));
  const zuordnung = await zuordnungenFuer(liste, stand);
  return jsonAntwort(req, {
    ...basis,
    abgleich: gmailAlter(stand) ?? undefined,
    push: pushKonfig() && gmailWebhookAdresse() ? (stand.watch && stand.watch.ablauf > Date.now() ? 'aktiv' : 'wartet') : 'aus',
    aliase: (stand.aliase ?? []).filter(a => a.verifiziert),
    eigene: stand.email,
    zuletzt: stand.zuletzt,
    nachrichten: liste.map(k => ({
      id: k.id, threadId: k.threadId, am: k.am, von: k.von, an: k.an.slice(0, 3), betreff: k.betreff, ausschnitt: k.ausschnitt, labels: k.labels,
      ungelesen: istUngelesen(k), posteingang: imPosteingang(k), gesendet: istGesendet(k), anhaenge: k.anhaenge.filter(a => !a.eingebettet).length, ...(k.liste ? { liste: true } : {}),
      ...(zuordnung[k.id] ? { zuordnung: zuordnung[k.id] } : {}),
    })),
  }, etag);
}

export async function POST(req: Request) {
  const z = await eigenePerson(req, true);
  if (z instanceof NextResponse) return z;
  let b: { aktion?: string; id?: unknown; was?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  try {
    if (b.aktion === 'abgleichen' || b.aktion === 'voll') {
      const r = await gmailAbgleichen(z.person, { voll: b.aktion === 'voll' });
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.aktion === 'markieren') {
      const id = typeof b.id === 'string' && /^[A-Za-z0-9]{6,40}$/.test(b.id) ? b.id : '';
      if (!id || !istMarkierAktion(b.was)) return NextResponse.json({ ok: false, fehler: 'id und was (gelesen | ungelesen | archivieren | posteingang) fehlen.' }, { status: 400 });
      const r = await gmailMarkieren(z.person, id, b.was);
      return NextResponse.json({ ok: true, ...r });
    }
    if (b.aktion === 'ausschalten') {
      const war = await gmailAusschalten(z.person);
      if (war) await protokolliere('gmail', [{ op: 'geloescht', id: 'spiegel', felder: ['ausgeschaltet'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
      return NextResponse.json({ ok: true, war });
    }
    return NextResponse.json({ ok: false, fehler: 'aktion = abgleichen | voll | markieren | ausschalten' }, { status: 400 });
  } catch (e) { return gmailFehlerAntwort(e); }
}
