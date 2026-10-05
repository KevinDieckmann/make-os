// ─── Datenschutz-Einrichtung der Instanz (05.10.) ───────────────────────────
// GET                → { verantwortlicher (gespeichert), wirksam { v, quelle, luecken }, darf (Inhaber?) }
//                      nur im Haushalt des Inhabers (sonst 403 — ein Testkunde sieht nie die Einrichtung).
// GET ?nur=angaben   → { mail, seite, verantwortlich } für den Datenschutzhinweis in der Danke-Mail (Netzwerken).
// POST { aktion: 'verantwortlicher', verantwortlicher: { name, anschrift, mail, telefon?, vertretung?, dsb? } }
// POST { aktion: 'verantwortlicher-leeren' }      → zurück auf Umgebung bzw. „fehlt“
// Schreiben: NUR der Inhaber (Rolle), NUR von Hand (Dienstweg/ZOE → 403), nur aus dem aktuellen Bau (bauPruefen);
// Protokoll nur mit Feldnamen (nie Werte). Lib: lib/datenschutz/einrichtung.ts (rein) + einrichtung-server.ts.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { istDienst } from '@/lib/zugang/dienst';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { bauPruefen } from '@/lib/bau/pruefen';
import { zuGross } from '@/lib/zugang/umfang';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { EINRICHTUNG_SPEICHER, verantwortlicherPruefen, verantwortlicherWirksam } from '@/lib/datenschutz/einrichtung';
import { einrichtungAendern, ladeEinrichtung } from '@/lib/datenschutz/einrichtung-server';
import { datenschutzAngabenAus } from '@/lib/crm/netzwerken-recht';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (fehler: string, status: number) => NextResponse.json({ ok: false, fehler }, { status });

export async function GET(req: Request) {
  const w = await imHaushaltDesInhabers(req);
  if (!w) return nein('Nur im Haushalt des Inhabers.', 403);
  const e = await ladeEinrichtung();
  const wirksam = verantwortlicherWirksam(e);
  if (new URL(req.url).searchParams.get('nur') === 'angaben') return NextResponse.json({ ok: true, ...datenschutzAngabenAus(wirksam.v) }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ ok: true, verantwortlicher: e.verantwortlicher ?? null, wirksam, darf: !w.dienst && (await istInhaber(w.person)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  if (istDienst(req)) return nein('Nur von Hand — nie über ZOE oder Skripte.', 403);
  const w = await imHaushaltDesInhabers(req);
  if (!w) return nein('Nur im Haushalt des Inhabers.', 403);
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  const person = personStreng(req);
  if (!person || !(await istInhaber(person))) return nein('Nur der Inhaber ändert die Datenschutz-Einrichtung.', 403);
  if (zuGross(req, 64_000)) return nein('Anfrage zu groß.', 413);
  let b: { aktion?: string; verantwortlicher?: unknown };
  try { b = await req.json(); } catch { return nein('Kein JSON.', 400); }
  const jetzt = new Date().toISOString();

  if (b.aktion === 'verantwortlicher') {
    const r = verantwortlicherPruefen(b.verantwortlicher);
    if (!r.ok) return nein(r.fehler, 400);
    const neu = await einrichtungAendern(e => ({ ...e, verantwortlicher: { ...r.v, geaendert: jetzt, von: person } }));
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geaendert', id: 'verantwortlicher', felder: Object.keys(r.v) }], werAus(req));
    return NextResponse.json({ ok: true, verantwortlicher: neu.verantwortlicher ?? null, wirksam: verantwortlicherWirksam(neu) });
  }
  if (b.aktion === 'verantwortlicher-leeren') {
    const neu = await einrichtungAendern(e => { const { verantwortlicher: _weg, ...rest } = e; return rest; });
    await protokolliere(EINRICHTUNG_SPEICHER, [{ op: 'geloescht', id: 'verantwortlicher' }], werAus(req));
    return NextResponse.json({ ok: true, verantwortlicher: null, wirksam: verantwortlicherWirksam(neu) });
  }
  return nein('aktion unbekannt.', 400);
}
