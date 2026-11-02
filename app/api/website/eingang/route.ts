// ─── Website-Eingänge, die nicht ankamen — sichtbar und von Hand entscheiden (02.11., Gegenprüfung R2-4 Fund 3) ─────────────────────────
// Unterlage anfordern und Newsletter-Anmeldung halten VOR der Antwort eine Eingangszeile fest (lib/oeffentlich/eingang.ts); was der Takt nach allen
// Versuchen nicht schafft, stand bis heute nirgends und verfiel nach 30 Tagen still. Jetzt hier (Marketing › Anfragen):
// GET  → { ok, eingaenge: EingangOffen[] } — offene bzw. gescheiterte Zeilen (Vorname, Adresse, Firma, Art, Versuche, technischer Grund) — Business-Sicht im
//        Haushalt des Inhabers wie die übrigen Anfragen (Lese-Protokoll „kontakte“).
// POST { aktion: 'erneut' | 'uebernehmen' | 'verwerfen', id } — nur eine Person per Sitzung (Dienstweg/ZOE 403), Bau-Kennung.
//        erneut      = Versuche zurück, sofort noch einmal (Mail, CRM, Newsletter — abgehakte Schritte bleiben abgehakt)
//        uebernehmen = als Anfrage über den EINEN Anfrage-Weg (feste Kennungen, ohne automatische Mail), Zeile fertig
//        verwerfen   = Zeile fertig, Daten sofort geleert
// Konten „nur Business“ sehen und entscheiden mit (Business-Bestand), andere Haushalte und Testkunden nie.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { EingangUnbekannt, eingangErneut, eingangUebernehmen, eingangVerwerfen, websiteEingaengeOffen } from '@/lib/oeffentlich/eingang-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OHNE = { headers: { 'Cache-Control': 'no-store' } };
const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status, ...OHNE });
const ID = /^we-[a-z0-9-]{4,60}$/;

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const eingaenge = await websiteEingaengeOffen().catch(() => null);
  if (!eingaenge) return fehler('Die Website-Eingänge ließen sich nicht lesen.', 500);
  if (eingaenge.length) leseZugriff(req, 'kontakte', { anzahl: eingaenge.length });
  return NextResponse.json({ ok: true, eingaenge }, OHNE);
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: { aktion?: unknown; id?: unknown };
  try { b = await jsonBegrenzt(req, 4 * 1024); } catch (e) { return jsonZuGross(e) ?? fehler('Kein JSON.', 400); }
  const id = typeof b.id === 'string' && ID.test(b.id) ? b.id : '';
  if (!id) return fehler('id fehlt.', 400);
  try {
    if (b.aktion === 'erneut') {
      const status = await eingangErneut(id);
      return NextResponse.json({ ok: true, status, text: status === 'fertig' ? 'Hat geklappt — der Eingang ist jetzt im CRM bzw. verschickt.' : 'Noch einmal gescheitert — der Grund steht an der Zeile. Übernehmt ihn von Hand.' }, OHNE);
    }
    if (b.aktion === 'uebernehmen') {
      const r = await eingangUebernehmen(id, z.person, werAus(req));
      if (r.fehler) return fehler(r.fehler, 409);
      return NextResponse.json({ ok: true, ...(r.kontaktId ? { kontaktId: r.kontaktId } : {}), text: 'Als Anfrage übernommen — das Follow-up „Anfrage prüfen“ steht an. Es ging keine Mail hinaus.' }, OHNE);
    }
    if (b.aktion === 'verwerfen') { await eingangVerwerfen(id); return NextResponse.json({ ok: true, text: 'Verworfen — die Daten sind gelöscht.' }, OHNE); }
    return fehler('aktion: erneut, uebernehmen oder verwerfen.', 400);
  } catch (e) {
    if (e instanceof EingangUnbekannt) return fehler(e.message, 404);
    console.error('[website/eingang]', e instanceof Error ? e.message.slice(0, 160) : e);
    return fehler('Nicht gespeichert — interner Fehler.', 500);
  }
}
