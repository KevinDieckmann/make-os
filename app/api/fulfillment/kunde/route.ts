// ─── Fulfillment — Kunden-Link intern (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4, 5.5, 9) ─────────────────────────────────────────────────────────────
// Tor `fulfillmentZugang` (Haushalt des Inhabers, Sicht Privat 403; schreiben nur per Sitzung + Bau-Kennung; der Instanz-Schalter nur der Inhaber).
// GET  ?m=<mandat>  → Stand: Schalter (Umgebung + Instanz), aktiver Link (NIE Token oder Hash), Verlauf, Formulare mit Antworten, Puls, Unterlagen-
//                     Metadaten, Kurzform — Lese-Protokoll „fulfillment“. ?m=&export=csv|pdf → die Antworten als Anhang (Playbook gehört dem Kunden).
//      ohne m      → nur die Schalter (für Karten, die wissen wollen, ob es den Link gibt).
// POST { aktion }:
//   schalter { an }                       Instanz-Schalter (NUR Inhaber)            · puls-schwelle { wert }
//   link-anlegen { mandatId, rechte? }     → Token GENAU EINMAL in der Antwort (`token`, `pfad` = /kunde/<id>#t=…)
//   widerrufen | verlaengern { linkId, tage? } | rechte { linkId, rechte }
//   puls-anfrage { mandatId }              → Puls-Token GENAU EINMAL (`pfad` = /kunde/<id>#p=…), schließt eine offene Anfrage
//   puls-hand { mandatId, wert, satz? }   · puls-uebernehmen { mandatId, pulsId } (→ Mandat.health.stimmung über den CRM-Schreibweg)
//   unterlage-status { id, status?, zweck?, beleg? } · formular-intern { mandatId, bausteinId, antworten, stand?, abschnitt?, fertig? }
// Nichts davon verschickt etwas — Links gehen nur per Klick in der Inbox hinaus.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import {
  kundeStand, kundenLinkSchalter, schalterSetzen, pulsSchwelleSetzen, linkAnlegen, linkAendern, pulsAnfrageAnlegen, pulsHandEintragen, pulsUebernehmen,
  unterlageAendern, formularIntern, antwortenExport,
} from '@/lib/fulfillment/kunde/server';
import { dateinameAscii } from '@/lib/dateien/regeln';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status });
const KEIN_SPEICHER = { 'Cache-Control': 'no-store, private' };

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const q = new URL(req.url).searchParams;
  const m = q.get('m');
  if (!m) return NextResponse.json({ ok: true, schalter: await kundenLinkSchalter(z.haushalt) }, { headers: KEIN_SPEICHER });
  if (!MANDAT_ID.test(m)) return fehler('Unzulässige Mandat-Kennung.', 400);
  const exp = q.get('export');
  if (exp === 'csv' || exp === 'pdf') {
    const r = await antwortenExport(m, exp);
    if ('status' in r) return NextResponse.json(r.body, { status: r.status });
    leseZugriff(req, 'fulfillment', { ids: [m], anzahl: 1 });
    return new Response(new Uint8Array(r.bytes), { headers: {
      'Content-Type': r.typ, 'Content-Length': String(r.bytes.length), 'Content-Disposition': `attachment; filename="${dateinameAscii(r.name)}"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", ...KEIN_SPEICHER,
    } });
  }
  const stand = await kundeStand(m);
  if (!stand) return fehler('Dieses Mandat gibt es nicht (mehr) — oder es gehört nicht zum Business.', 404);
  leseZugriff(req, 'fulfillment', { ids: [m] });
  return NextResponse.json({ ok: true, ...stand }, { headers: KEIN_SPEICHER });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 256 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein gültiges JSON.', 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return fehler('Kein gültiges JSON.', 400);
  const aktion = String(b.aktion ?? '');
  // Der Instanz-Schalter nur für den Inhaber (Konzept 5.4) — alles andere für jede Person im Haushalt per Sitzung.
  if (aktion === 'schalter') { const i = await fulfillmentZugang(req, { schreiben: true, inhaber: true }); if (i instanceof Response) return i; }
  const p = z.person;
  const mandatId = String(b.mandatId ?? '');
  const r = await (async () => {
    switch (aktion) {
      case 'schalter': return typeof b.an === 'boolean' ? schalterSetzen(b.an, p) : { status: 400, body: { ok: false, fehler: 'an: true oder false.' } };
      case 'puls-schwelle': return pulsSchwelleSetzen(b.wert, p);
      case 'link-anlegen': return linkAnlegen(mandatId, b.rechte, p);
      case 'widerrufen': case 'verlaengern': case 'rechte': return linkAendern(aktion, b, p);
      case 'puls-anfrage': return pulsAnfrageAnlegen(mandatId, p);
      case 'puls-hand': return pulsHandEintragen(mandatId, b.wert, b.satz, p);
      case 'puls-uebernehmen': return pulsUebernehmen(mandatId, b.pulsId, p);
      case 'unterlage-status': return unterlageAendern(b, p);
      case 'formular-intern': return formularIntern(b, p);
      default: return { status: 400, body: { ok: false, fehler: 'Unbekannte Aktion (schalter, puls-schwelle, link-anlegen, widerrufen, verlaengern, rechte, puls-anfrage, puls-hand, puls-uebernehmen, unterlage-status, formular-intern).' } };
    }
  })();
  // Token und Puls-Token stehen nur in DIESER Antwort — nie zwischengespeichert.
  return NextResponse.json(r.body, { status: r.status, headers: KEIN_SPEICHER });
}
