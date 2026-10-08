// ─── Verzeichnis der Verarbeitungstätigkeiten — Export (05.10.) ─────────────
// GET ?format=html (Standard) → druckbares Dokument (Browser › Drucken › PDF)
// GET ?format=json            → dieselben Angaben als Datei
// Nur im Haushalt des Inhabers. Vervollständigt das Verzeichnis vorher (wie Stammdaten: idempotent, in der Sperre des CRM).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { loadJson } from '@/lib/store/local-db';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { verzeichnisVervollstaendigen } from '@/lib/crm/datenschutz';
import { googleKonfiguriert } from '@/lib/google/verbindung';
import { icloudInGebrauch } from '@/lib/kalender/icloud-person';
import { whatsappEingerichtet } from '@/lib/whatsapp/konfig';
import { whoopKonfiguriert } from '@/lib/whoop/konfig';
import { LOESCHFRISTEN_SPEICHER, fristenWirksam, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { empfaengerWirksam, verantwortlicherWirksam } from '@/lib/datenschutz/einrichtung';
import { ladeEinrichtung } from '@/lib/datenschutz/einrichtung-server';
import { verzeichnisDokument, verzeichnisHtml } from '@/lib/datenschutz/verzeichnis-export';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const jetzt = new Date().toISOString();
  let crm = await ladeCrm();
  const vvOpt = { google: googleKonfiguriert(), icloud: await icloudInGebrauch(), whatsapp: whatsappEingerichtet(), whoop: whoopKonfiguriert() };
  if (verzeichnisVervollstaendigen(crm.verarbeitungen, jetzt, vvOpt).geaendert) crm = await aendereCrm(c => { const r = verzeichnisVervollstaendigen(c.verarbeitungen, jetzt, vvOpt); return r.geaendert ? { ...c, verarbeitungen: r.liste } : c; });
  const e = await ladeEinrichtung();
  const fristen = fristenWirksam(((await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {}).fristen);
  const d = verzeichnisDokument({ verarbeitungen: crm.verarbeitungen, verantwortlicher: verantwortlicherWirksam(e).v, empfaenger: empfaengerWirksam(e), fristen, jetzt });
  const kopf = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (new URL(req.url).searchParams.get('format') === 'json') {
    return new Response(JSON.stringify(d, null, 2), { headers: { ...kopf, 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="Verzeichnis-Art30-${localDay()}.json"` } });
  }
  return new Response(verzeichnisHtml(d), { headers: { ...kopf, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } });
}
