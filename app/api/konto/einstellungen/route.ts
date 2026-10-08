// ─── Zugang der Instanz einstellen (05.10., nur Inhaber) ─────────────────────
// GET → { zweiFaktorPflicht, leerlaufStunden, ohneZweitenFaktor } · PUT { zweiFaktorPflicht?, leerlaufStunden? }.
// 2FA-Pflicht: Konten ohne zweiten Faktor werden beim nächsten Anmelden zur Einrichtung geführt und kommen bis dahin
// nirgends hin (middleware.ts). Einschalten nur, wenn der Inhaber selbst schon einen zweiten Faktor hat — sonst sperrte
// er sich beim nächsten Anmelden selbst in die Einrichtung. Vorgabe: neue Instanzen an (einrichten), laufende aus.
// Jede Änderung landet (nur Feldnamen) im Änderungsprotokoll (lib/zugang/konten.ts › aendereKonten).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { personDerSitzung } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { ladeKonten, aendereKonten, leerlaufStunden } from '@/lib/zugang/konten';
import { istWirksamerInhaber } from '@/lib/zugang/inhaber';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Nur mit Sitzung (x-make-user) — nie über den Dienstweg (ZOE, Skripte), auch nicht „im Auftrag“. */
async function inhaber(req: Request) {
  const p = personDerSitzung(req);
  const st = await ladeKonten();
  // Jeder Inhaber (09.10., R9 — mehrere Inhaber), nie ein Inhaber-Konto außerhalb des Haushalts der Inhaber.
  const ich = p && /^[a-z0-9-]{1,40}$/.test(p) && istWirksamerInhaber(st, p) ? st.konten.find(k => k.speicher === p) : undefined;
  return ich ? { ich, st } : null;
}

const bild = (st: Awaited<ReturnType<typeof ladeKonten>>) => ({
  ok: true,
  zweiFaktorPflicht: !!st.einstellungen?.zweiFaktorPflicht,
  leerlaufStunden: leerlaufStunden(st.einstellungen),
  ohneZweitenFaktor: st.konten.filter(k => !k.zweiterFaktor).length,
});

export async function GET(req: Request) {
  const i = await inhaber(req);
  if (!i) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  return NextResponse.json(bild(i.st));
}

export async function PUT(req: Request) {
  const i = await inhaber(req);
  if (!i) return NextResponse.json({ ok: false, fehler: 'Nur der Inhaber.' }, { status: 403 });
  let b: { zweiFaktorPflicht?: unknown; leerlaufStunden?: unknown };
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.zweiFaktorPflicht !== undefined && typeof b.zweiFaktorPflicht !== 'boolean') return NextResponse.json({ ok: false, fehler: 'zweiFaktorPflicht: true oder false.' }, { status: 400 });
  const h = b.leerlaufStunden === undefined ? undefined : Number(b.leerlaufStunden);
  if (h !== undefined && !(Number.isInteger(h) && h >= 1 && h <= 336)) return NextResponse.json({ ok: false, fehler: 'Leerlauf: ganze Stunden von 1 bis 336.' }, { status: 400 });
  if (b.zweiFaktorPflicht === true && !i.ich.zweiterFaktor) return NextResponse.json({ ok: false, fehler: 'Erst selbst den zweiten Faktor einrichten — dann die Pflicht für alle einschalten.' }, { status: 409 });
  const jetzt = new Date().toISOString();
  const st = await aendereKonten(s => {
    const e = { ...s.einstellungen };
    if (b.zweiFaktorPflicht === true && !e.zweiFaktorPflicht) { e.zweiFaktorPflicht = true; e.zweiFaktorPflichtSeit = jetzt; }
    if (b.zweiFaktorPflicht === false) { delete e.zweiFaktorPflicht; delete e.zweiFaktorPflichtSeit; }
    if (h !== undefined) e.leerlaufStunden = h;
    return { ...s, einstellungen: e };
  });
  return NextResponse.json(bild(st));
}
