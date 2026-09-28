// ─── MAKE OS — Team aus den Daten (28.09., U4) ──────────────────────────────
// GET   → { ok, team: TeamPerson[] (mit `stand` je gespeichertem Eintrag), ausDaten } · ETag
// PATCH { ops: [{ op: 'upsert', eintrag, stand? } | { op: 'teil', id, felder, stand? }] }
//       → 409 mit `konflikte` und dem aktuellen Team, wenn inzwischen jemand geändert hat.
// Nur im Haushalt des Inhabers und nur mit Person (kein Systemlauf). Löschen gibt es nicht —
// Personen werden deaktiviert (alte Delegiert-Marker zeigen weiter auf ihr Kurzwort).
// Kevin und Malin sind feste Einträge aus den Konten (`konto-<speicher>`): Name aus dem Konto,
// Kurzwort/Rolle/Bereich/Farbe hier pflegbar.

import { NextResponse } from 'next/server';
import { speicherStand } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler, type ListenOp } from '@/lib/store/patch-liste';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { karteiZugang, haushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { etagAus, unveraendert, jsonAntwort } from '@/lib/http/json-antwort';
import { teamSpeicherName, teamStand, kontenDesHaushalts, saeubereTeamEintrag, type TeamDatei } from '@/lib/make-one/team-speicher';
import { kurzAus, KONTO_PRAEFIX, type TeamEintrag } from '@/lib/make-one/team-typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRENZE = 50;

/** Person im Haushalt des Inhabers + dessen Haushalt — oder die fertige 403-Antwort. */
async function zugang(req: Request): Promise<{ person: string; haushalt: string } | Response> {
  const w = await karteiZugang(req);
  if (!w) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  if (!w.person) return NextResponse.json({ ok: false, fehler: 'Das Team braucht eine angemeldete Person (kein Systemlauf).' }, { status: 403 });
  const haushalt = await haushaltDesInhabers();
  if (!haushalt) return NextResponse.json({ ok: false, fehler: 'Am Inhaber-Konto ist kein Haushalt eingetragen (System → Konto).' }, { status: 403 });
  return { person: w.person, haushalt };
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (z instanceof Response) return z;
  const name = teamSpeicherName(z.haushalt);
  const etag = etagAus('team1', await speicherStand([name, 'konten']), z.haushalt);
  const nichts = unveraendert(req, etag);
  if (nichts) return nichts;
  const s = await teamStand(z.haushalt);
  return jsonAntwort(req, { ok: true, ...s }, etag);
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (z instanceof Response) return z;
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (Array.isArray(body.ops) && body.ops.some(o => (o as { op?: unknown })?.op === 'delete')) {
    return NextResponse.json({ ok: false, fehler: 'Personen werden nicht gelöscht, sondern deaktiviert (aktiv: false).' }, { status: 400 });
  }
  const ops = opsLesen<TeamEintrag>(body.ops, saeubereTeamEintrag, GRENZE);
  if (!ops) return NextResponse.json({ ok: false, fehler: opsFehler(body.ops, GRENZE) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine gültigen Änderungen (Name und ein Kurzwort aus einem Wort nötig).' }, { status: 400 });

  // Konten-Einträge nur für Konten dieses Haushalts.
  const konten = await kontenDesHaushalts(z.haushalt);
  const kontoIds = new Set(konten.map(k => `${KONTO_PRAEFIX}${k.speicher}`));
  const opId = (o: ListenOp<TeamEintrag>) => (o.op === 'upsert' ? o.eintrag!.id : o.id!);
  const fremd = ops.map(opId).find(id => id.startsWith(KONTO_PRAEFIX) && !kontoIds.has(id));
  if (fremd) return NextResponse.json({ ok: false, fehler: `Unbekanntes Konto: ${fremd}` }, { status: 400 });

  const r = await listePatchen<TeamEintrag, TeamDatei & Record<string, unknown>>(teamSpeicherName(z.haushalt), 'team', ops, 10, undefined, {
    wer: werAus(req),
    // Teiländerung: Felder auflegen und neu prüfen — die Kennung bleibt.
    teil: (alt, felder) => saeubereTeamEintrag({ ...alt, ...felder, id: alt.id }),
    // Kurzwörter sind eindeutig (ohne Groß/Klein) — über Konten und alle Einträge, auch deaktivierte:
    // alte Delegiert-Marker zeigen sonst auf die falsche Person.
    pruefen: (liste, o) => {
      const nach = new Map(liste.map(e => [e.id, e]));
      for (const x of o) {
        if (x.op === 'upsert') nach.set(x.eintrag!.id, x.eintrag!);
        else if (x.op === 'teil') { const alt = nach.get(x.id!); const neu = alt ? saeubereTeamEintrag({ ...alt, ...(x.felder ?? {}), id: alt.id }) : null; if (neu) nach.set(neu.id, neu); }
      }
      const kurz = [
        ...konten.map(k => nach.get(`${KONTO_PRAEFIX}${k.speicher}`)?.kurz ?? kurzAus(k.name, k.speicher)),
        ...Array.from(nach.values()).filter(e => !e.id.startsWith(KONTO_PRAEFIX)).map(e => e.kurz),
      ].map(k => k.toLocaleLowerCase('de'));
      const doppelt = kurz.find((k, i) => kurz.indexOf(k) !== i);
      return doppelt ? `Kurzwort „${doppelt}“ ist schon vergeben — jedes Kurzwort nur einmal.` : null;
    },
  });
  if (!r.ok) {
    const s = await teamStand(z.haushalt);
    const status = r.konflikte?.length ? 409 : r.fehler?.startsWith('Kurzwort') ? 400 : 409;
    return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}), ...s }, { status });
  }
  return NextResponse.json({ ok: true, angewandt: r.angewandt, ...(await teamStand(z.haushalt)) });
}
