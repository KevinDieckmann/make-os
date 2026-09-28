// ─── MAKE OS — „Neu anfangen“ für Ziele und Aufgaben (29.09., Kevin) ─────────
// GET            → Vorschau: wie viele Ziele, Meilensteine, Projekte, Aufgaben archiviert würden; Serien, die ruhen;
//                  Fristen-Aufgaben der Module, die bleiben.
// GET ?archiv=1  → die Läufe mit ihren Einträgen (Ansicht Aufgaben › Archiv), neueste zuerst.
// POST { aktion: 'neu-anfangen', laufId: 'na-…', bestaetigung: 'NEU ANFANGEN' } → archivieren (idempotent je laufId).
// POST { aktion: 'zurueck', laufId, auswahl: { art: 'alles' } | { art: 'projekt'|'aufgabe'|'meilenstein', id }
//        | { art: 'ziel', speicher, horizont, id } } → zurückholen (ganz oder einzeln, idempotent).
// Nur Personen im Haushalt des Inhabers mit eigener Sitzung — kein Dienstweg (ZOE und Takt fangen nie neu an).
// Logik: lib/aufgaben/neustart-server.ts (Server), lib/aufgaben/neustart.ts + lib/planung/neustart.ts (rein).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { zuGross } from '@/lib/zugang/umfang';
import { istZielHorizont } from '@/lib/planung/typen';
import { LAUF_ID, NEUSTART_BESTAETIGUNG } from '@/lib/aufgaben/neustart';
import { neuAnfangen, neustartArchiv, neustartVorschau, neustartZurueck, NeustartFehler, type NeustartAuswahl } from '@/lib/aufgaben/neustart-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BESTAETIGUNG = NEUSTART_BESTAETIGUNG;
const GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: 'Neu anfangen dürfen nur Kevin und Malin selbst (Haushalt des Inhabers).' }, { status: 403 });
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,120}$/;
const SPEICHER = /^[a-z0-9][a-z0-9-]{0,80}$/;

async function zugang(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  return z && !z.dienst ? z : null;
}

export async function GET(req: Request) {
  if (!(await zugang(req))) return GESPERRT();
  if (new URL(req.url).searchParams.get('archiv') === '1') return NextResponse.json({ laeufe: await neustartArchiv() });
  return NextResponse.json({ vorschau: await neustartVorschau(), bestaetigung: BESTAETIGUNG });
}

function auswahlLesen(a: unknown): NeustartAuswahl | null {
  if (!a || typeof a !== 'object') return null;
  const x = a as Record<string, unknown>;
  if (x.art === 'alles') return { art: 'alles' };
  const id = typeof x.id === 'string' && KENNUNG.test(x.id) ? x.id : null;
  if (!id) return null;
  if (x.art === 'projekt' || x.art === 'aufgabe' || x.art === 'meilenstein') return { art: x.art, id };
  if (x.art === 'ziel' && typeof x.speicher === 'string' && SPEICHER.test(x.speicher) && istZielHorizont(x.horizont)) return { art: 'ziel', speicher: x.speicher, horizont: x.horizont, id };
  return null;
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return GESPERRT();
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  if (zuGross(req, 64 * 1024)) return NextResponse.json({ ok: false, error: 'Abgelehnt: zu groß.' }, { status: 413 });
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const laufId = typeof b?.laufId === 'string' && LAUF_ID.test(b.laufId) ? b.laufId : null;
  if (!laufId) return NextResponse.json({ ok: false, error: 'laufId (na-…) fehlt.' }, { status: 400 });
  try {
    if (b.aktion === 'neu-anfangen') {
      if (b.bestaetigung !== BESTAETIGUNG) return NextResponse.json({ ok: false, error: `Zum Bestätigen „${BESTAETIGUNG}“ tippen.` }, { status: 400 });
      const r = await neuAnfangen({ laufId, person: z.person, wer: werAus(req) });
      const l = r.lauf;
      return NextResponse.json({
        ok: true, schon: r.schon, laufId: l.id,
        bericht: {
          projekte: l.aufgaben.projekte.length, listen: l.aufgaben.listen.length, gruppen: l.aufgaben.gruppen.length, aufgaben: l.aufgaben.aufgaben.length,
          ziele: l.ziele.length, meilensteine: l.meilensteine.length, fokus: l.fokus.length, meldungenGelesen: l.meldungenGelesen,
          serien: l.aufgaben.pausiert.map(s => ({ art: s.art, titel: s.titel, regel: s.wiederholung.regel })),
        },
      });
    }
    if (b.aktion === 'zurueck') {
      const auswahl = auswahlLesen(b.auswahl);
      if (!auswahl) return NextResponse.json({ ok: false, error: 'Auswahl ungültig.' }, { status: 400 });
      return NextResponse.json({ ok: true, bericht: await neustartZurueck({ laufId, auswahl, person: z.person, wer: werAus(req) }) });
    }
    return NextResponse.json({ ok: false, error: 'aktion: neu-anfangen | zurueck' }, { status: 400 });
  } catch (e) {
    if (e instanceof NeustartFehler) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    throw e;
  }
}
