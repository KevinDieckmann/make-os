// ─── MAKE OS — Onboarding (Zustand) ─────────────────────────────────────────
// Der Plan prüft sich selbst. Die Regeln dafür liegen in lib/onboarding-status,
// weil auch die Startfläche den Fortschritt zeigt — eine Quelle für beide.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { pruefeAlles, type Handisch } from '@/lib/onboarding-status';
import { personAus } from '@/lib/zoe/raum';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const [handisch, befunde] = await Promise.all([
    loadJson<Handisch>('onboarding'),
    // Persönliche Befunde nur für die Person der Sitzung (08.10.) — nie für eine andere.
    pruefeAlles(personStreng(req)),
  ]);
  return NextResponse.json({ erledigt: handisch?.erledigt ?? {}, befunde });
}

/** Einen Schritt von Hand abhaken oder das Häkchen wieder entfernen. */
export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  let body: { id?: string; an?: boolean; von?: string };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(body.id ?? '').slice(0, 60);
  if (!id) return NextResponse.json({ ok: false, error: 'id fehlt.' }, { status: 400 });
  const p = personAus(req); const von = p.charAt(0).toUpperCase() + p.slice(1);

  const next = await updateJson<Handisch>('onboarding', current => {
    const f = current ?? { erledigt: {} };
    f.erledigt = f.erledigt ?? {};
    if (body.an === false) delete f.erledigt[id];
    else f.erledigt[id] = { at: new Date().toISOString(), von };
    return f;
  });
  return NextResponse.json({ ok: true, erledigt: next.erledigt });
}
