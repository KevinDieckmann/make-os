// ─── MAKE OS — Das Selbstbild in den Vault schreiben ────────────────────────
// GET zeigt, was geschrieben würde, ohne es zu tun. POST schreibt.
//
// Die Blätter werden aus den echten Quellen gerechnet, nicht von Hand gepflegt:
// eine geschriebene Beschreibung wäre nach zwei Tagen falsch, und eine falsche
// Beschreibung im Gehirn ist schlimmer als keine — ZOE antwortet daraus.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt, nurInhaber, nurDerInhaber } from '@/lib/zugang/tor';
import { blaetter } from '@/lib/zoe/selbstbild';
import { dokuWurzelEingerichtet, schreibeEigene } from '@/lib/zoe/vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const liste = await blaetter();
  return NextResponse.json({
    ok: true,
    blaetter: liste.map(b => ({ name: b.name, zeichen: b.text.length, anfang: b.text.slice(0, 220) })),
  });
}

export async function POST(req: Request) {
  if (!(await nurInhaber(req))) return nurDerInhaber();
  // Ohne Doku-Wurzel (Server, Demo-Instanz) gibt es keinen Ort fürs Selbstbild — das ist kein Fehler (Rundgang 09.10. „Agenten live“: vorher lief
  // der Takt-Auftrag „selbstbild“ jeden Tag mehrfach in „Fehler“ und füllte Agenten › Fehler und die Fehlerquote des Head of IT).
  if (!dokuWurzelEingerichtet()) return NextResponse.json({ ok: true, geschrieben: 0, von: 0, uebersprungen: 'keine Doku-Wurzel eingerichtet (MAKE_OS_DOKU_WURZEL)' });
  const liste = await blaetter();
  const ergebnisse = [];
  for (const b of liste) {
    const r = await schreibeEigene(b.name, b.text);
    ergebnisse.push({ name: b.name, ok: r.ok, pfad: r.pfad, fehler: r.fehler });
  }
  const geschrieben = ergebnisse.filter(e => e.ok).length;
  return NextResponse.json({ ok: geschrieben > 0, geschrieben, von: liste.length, ergebnisse });
}
