// ─── Mac-Zulieferer abschalten — Inhaber-Weg (08.10., Lücke 10 der Roadmap, Kevin R6) ─────────────────────────────────────
// GET  → { lage, spiegel, uebernahme: { vorschau, spaces, at, stand } } — an/aus und warum, Stand der Spiegel vom Mac (Zeitpunkt,
//        Anzahl), Vorschau der Apple-Erinnerungen (Titel, Fälligkeit, Liste, „schon übernommen“) und die wählbaren Spaces.
// POST { aktion: 'uebernehmen', wahl } → Aufgaben anlegen (idempotent, feste Kennungen `ar-…`), Übernahme festhalten.
// POST { aktion: 'schalten', an, ohneUebernahme? } → Instanz-Einstellung (konten.json); Ausschalten vor der Übernahme nur ausdrücklich.
// POST { aktion: 'spiegel-loeschen', art: 'erinnerungen' | 'kontakte' } → Spiegel samt Tageskopien entfernen (nur wenn aus).
// NUR der Inhaber per Sitzung — der Dienstweg (ZOE, Takt, Skripte) bekommt 403, auch „im Auftrag“. Schreibende Aufrufe tragen
// die Build-Kennung (Aufgaben sind ein geteilter Bestand). Logik: lib/zulieferer/server.ts (rein: erinnerungen.ts, schalter.ts).

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { istDienst, istInhaber, personDerSitzung, ohnePerson, nurDerInhaber } from '@/lib/zugang/tor';
import { istDerHauptInhaber } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { wahlSauber } from '@/lib/zulieferer/erinnerungen';
import { QUELLE_TEXT } from '@/lib/zulieferer/schalter';
import {
  zuliefererLage, uebernahmeVorschau, erlaubteSpaces, erinnerungenUebernehmen, zuliefererSchalten, spiegelLoeschen, spiegelStand,
  ladeUebernahmeStand, SPIEGEL_ARTEN, type SpiegelArt,
} from '@/lib/zulieferer/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Nur der Inhaber per Sitzung: Dienstweg → 403, ohne Sitzung → 401, andere Konten → 403. Seit 09.10. (mehrere Inhaber) nur der
 * Haupt-Inhaber: der Mac-Zulieferer liefert SEIN Gerät (Erinnerungen, Adressbuch — auch Privates), und die Übernahme legt die
 * Erinnerungen als seine Aufgaben an. Ein weiterer Inhaber sieht hier nichts (Inhaber heißt Verwaltung, nicht Einsicht).
 */
async function tor(req: Request): Promise<{ person: string } | NextResponse> {
  if (istDienst(req)) return nurDerInhaber();
  const person = personDerSitzung(req);
  if (!person) return ohnePerson();
  if (!(await istInhaber(person)) || !(await istDerHauptInhaber(person))) return nurDerInhaber();
  return { person };
}

async function lageBild() {
  const lage = await zuliefererLage();
  return { ...lage, quelleText: QUELLE_TEXT[lage.quelle] };
}

export async function GET(req: Request) {
  const t = await tor(req);
  if (t instanceof NextResponse) return t;
  const [lage, spiegel, vorschau, stand] = await Promise.all([lageBild(), spiegelStand(), uebernahmeVorschau(), ladeUebernahmeStand()]);
  return NextResponse.json({ ok: true, lage, spiegel, uebernahme: { ...vorschau, stand } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const t = await tor(req);
  if (t instanceof NextResponse) return t;
  const bau = bauPruefen(req);
  if (bau) return bau;
  let b: { aktion?: unknown; wahl?: unknown; an?: unknown; ohneUebernahme?: unknown; art?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (b.aktion === 'uebernehmen') {
    const w = wahlSauber(b.wahl, await erlaubteSpaces());
    if (!w.ok) return NextResponse.json({ ok: false, fehler: w.fehler }, { status: w.status });
    const r = await erinnerungenUebernehmen({ person: t.person, wahl: w.wahl });
    return NextResponse.json({ ...r, lage: await lageBild() }, { status: r.ok ? 200 : r.status });
  }
  if (b.aktion === 'schalten') {
    if (typeof b.an !== 'boolean') return NextResponse.json({ ok: false, fehler: '„an“ ist ja oder nein.' }, { status: 400 });
    const r = await zuliefererSchalten(b.an, { ohneUebernahme: b.ohneUebernahme === true });
    if (!r.ok) return NextResponse.json(r, { status: r.status });
    return NextResponse.json({ ok: true, lage: await lageBild() });
  }
  if (b.aktion === 'spiegel-loeschen') {
    if (!SPIEGEL_ARTEN.includes(b.art as SpiegelArt)) return NextResponse.json({ ok: false, fehler: 'art: erinnerungen oder kontakte.' }, { status: 400 });
    const r = await spiegelLoeschen(b.art as SpiegelArt, t.person);
    if (!r.ok) return NextResponse.json(r, { status: r.status });
    return NextResponse.json({ ok: true, war: r.war, lage: await lageBild() });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
}
