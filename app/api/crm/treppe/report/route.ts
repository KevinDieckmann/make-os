// ─── Produkte & Mandate · Fortschritts-Report an den Kunden (10.10.) ─────────────────────────────────────────────────
// Entscheidung 10.10.: PDF (erreicht, nächste Schritte, Kennzahlen) + vorformulierte Mail (Du/Sie nach Akte), PDF angehängt, Versand NUR per
// Klick über den Senden-Weg der Inbox (POST /api/inbox/senden mit `anhaenge: [{ datei }]` — dort Art. 18, § 7 UWG, Absender = Postfach).
// POST { aktion: 'erstellen', mandatId, anfrageId? } → Report-PDF erzeugen, verschlüsselt am Mandat ablegen (Dateiablage), am Fortschritt
//        vermerken → { datei, betreff, text, an, anrede, gesellschaft } — verschickt NICHTS
//      { aktion: 'entwurf', mandatId, ki? }         → Mail-Vorlage (ohne KI) bzw. mit `ki: true` ein KI-Entwurf des Head of Sales (gekennzeichnet,
//        `ki: kiKennzeichen`) — nur aus dem Report, kein Versand
// GET  ?datei=d-…                                    → das Report-PDF (nur Dateien, die als Report vermerkt sind), als Download
// Nur eine angemeldete Person im Haushalt des Inhabers (Dienstweg 403) — auch ein Konto „nur Business“.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { modellSchranke } from '@/lib/zugang/umfang';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { dateinameAscii, DATEI_ID } from '@/lib/dateien/regeln';
import { MANDAT_KENNUNG } from '@/lib/crm/treppe-daten';
import { reportErstellen, reportLesen, mailGrundlage, TreppeFehler } from '@/lib/crm/treppe-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
const ausFehler = (e: unknown) => {
  if (e instanceof TreppeFehler) return fehler(e.message, e.status);
  if (e && typeof e === 'object' && 'status' in e && typeof (e as { status: unknown }).status === 'number' && e instanceof Error) return fehler(e.message, (e as unknown as { status: number }).status);
  throw e;
};

/** Name der sendenden Person (aus dem Konto) — für den Gruß der Mail; nie ein fester Name. */
async function absenderName(person: string): Promise<string | undefined> {
  try { const { kontoFuerSpeicher } = await import('@/lib/zugang/konten'); return (await kontoFuerSpeicher(person))?.name?.trim() || undefined; } catch { return undefined; }
}

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const id = new URL(req.url).searchParams.get('datei') ?? '';
  if (!DATEI_ID.test(id)) return fehler('Unzulässige Kennung.', 400);
  const d = await reportLesen(id);
  if (!d) return fehler('Diesen Report gibt es nicht (mehr).', 404);
  leseZugriff(req, 'firmen', { ids: [id] });
  return new Response(new Uint8Array(d.bytes), {
    headers: {
      'Content-Type': 'application/pdf', 'Content-Length': String(d.bytes.length),
      'Content-Disposition': `attachment; filename="${dateinameAscii(d.name)}"; filename*=UTF-8''${encodeURIComponent(d.name)}`,
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store, private',
    },
  });
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return fehler('Reports erstellt nur eine angemeldete Person — der Takt legt nur einen Vorschlag in den Stapel.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: unknown; mandatId?: unknown; ki?: unknown; anfrageId?: unknown };
  try { b = await jsonBegrenzt(req, 16_000); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const mandatId = typeof b.mandatId === 'string' && MANDAT_KENNUNG.test(b.mandatId) ? b.mandatId : null;
  if (!mandatId) return fehler('mandatId fehlt.', 400);
  const absender = await absenderName(zugang.person);
  try {
    if (b.aktion === 'erstellen') {
      const r = await einmalig<Record<string, unknown>>('treppe-report', b.anfrageId, async () => {
        const e = await reportErstellen(mandatId, zugang.person);
        await protokolliere('crm-dateien', [{ op: 'neu', id: e.datei.id, felder: ['fortschritts-report', 'mandatId'] }], werAus(req)).catch(() => { /* nur Protokoll */ });
        const m = await mailGrundlage(mandatId, absender);
        return { status: 200, body: { ok: true, datei: e.datei, betreff: m.betreff, text: m.text, an: m.an, ...(m.ohneEmpfaenger ? { ohneEmpfaenger: m.ohneEmpfaenger } : {}), anrede: m.anrede, gesellschaft: m.gesellschaft } };
      }, undefined, { wer: zugang.person });
      return NextResponse.json(r.body, { status: r.status });
    }
    if (b.aktion === 'entwurf') {
      const m = await mailGrundlage(mandatId, absender);
      const basis = { ok: true, betreff: m.betreff, text: m.text, an: m.an, ...(m.ohneEmpfaenger ? { ohneEmpfaenger: m.ohneEmpfaenger } : {}), anrede: m.anrede, gesellschaft: m.gesellschaft, ...(m.datei ? { datei: m.datei } : {}) };
      if (b.ki !== true) return NextResponse.json(basis);
      const schranke = modellSchranke(req); if (schranke) return schranke;
      const { mailEntwurfKi } = await import('@/lib/crm/treppe-ki');
      const name = m.an?.name?.split(' ') ?? [];
      const r = await mailEntwurfKi({ doc: m.dok, anrede: m.anrede, ...(name[0] ? { vorname: name[0] } : {}), ...(name.length > 1 ? { nachname: name.slice(1).join(' ') } : {}), ...(absender ? { absender } : {}), vorlage: { betreff: m.betreff, text: m.text } }, kiAus(req, ['crm'], { anzahl: 1, person: zugang.person }));
      if (!r.ok) return NextResponse.json({ ...basis, kiHinweis: r.text });
      return NextResponse.json({ ...basis, betreff: r.wert.betreff, text: r.wert.text, ki: kiKennzeichen({ anbieter: r.anbieter }) });
    }
    return fehler('Unbekannte Aktion (erstellen, entwurf).', 400);
  } catch (e) { return ausFehler(e); }
}
