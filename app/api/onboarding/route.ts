// ─── MAKE OS — Onboarding (Zustand und Häkchen) ─────────────────────────────
// Der Plan prüft sich selbst (lib/onboarding-status.ts — eine Quelle mit Startfläche und Heute-Karte). Häkchen seit 08.10. spät
// (Paket B0/B2, ONBOARDING_PLAN.md): persönliche je Person (`onboarding--<speicher>`), gemeinsame im Bestand `onboarding`
// (lib/onboarding-haken.ts). Schreiben nur die angemeldete Person selbst — Dienstweg 403, ohne Person 401, unbekannte Kennung 400
// (nie gekürzt), Inhaber-Schritte nur der Inhaber (403), Build-Kennung (409 neu laden). Gespeichert wird der Speichername, nie ein Vorname.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, personStreng, ohnePerson, istDienst } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { pruefeAlles, kontextFuer } from '@/lib/onboarding-status';
import { hakenLesen, hakenSetzen, type Haken } from '@/lib/onboarding-haken';
import { schrittMitId } from '@/lib/make-one/onboarding-data';
import { ladeKonten } from '@/lib/zugang/konten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Körper höchstens 2 KB: `{ id, an }`. */
const GRENZE = 2048;
const KENNUNG = /^[a-z0-9-]{1,60}$/;

/** `von` für die Anzeige: „dir“ für die eigene Person, sonst der Vorname aus dem Konto (Altbestand: wie gespeichert). */
async function mitAnzeige(erledigt: Record<string, Haken>, ich: string): Promise<Record<string, Haken>> {
  const namen = new Map((await ladeKonten().catch(() => ({ konten: [] as { speicher: string; name: string }[] }))).konten.map(k => [k.speicher, (k.name ?? '').split(' ')[0] || k.speicher]));
  return Object.fromEntries(Object.entries(erledigt).map(([id, h]) => [id, { at: h.at, von: h.von === ich ? 'dir' : namen.get(h.von) ?? h.von }]));
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const person = personStreng(req);
  const [erledigt, befunde, kontext] = await Promise.all([
    hakenLesen(person),
    // Persönliche Befunde nur für die Person der Sitzung (08.10.) — nie für eine andere.
    pruefeAlles(person),
    kontextFuer(person),
  ]);
  return NextResponse.json({ erledigt: await mitAnzeige(erledigt, z.person), befunde, ich: kontext });
}

/** Einen Schritt von Hand abhaken (`an: true`) oder das Häkchen wieder entfernen (`an: false`). */
export async function POST(req: Request) {
  if (istDienst(req)) return NextResponse.json({ ok: false, error: 'Abhaken nur angemeldet, nie über den Dienstweg.' }, { status: 403 });
  const person = personStreng(req);
  if (!person) return ohnePerson();
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const alt = bauPruefen(req); if (alt) return alt;
  let body: { id?: unknown; an?: unknown };
  try { body = await jsonBegrenzt(req, GRENZE); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = typeof body?.id === 'string' ? body.id : '';
  const s = KENNUNG.test(id) ? schrittMitId(id) : null;
  if (!s) return NextResponse.json({ ok: false, error: 'Diesen Schritt gibt es nicht — nichts gespeichert.' }, { status: 400 });
  if (body.an !== undefined && typeof body.an !== 'boolean') return NextResponse.json({ ok: false, error: '„an“ muss ja oder nein sein — nichts gespeichert.' }, { status: 400 });
  const kontext = await kontextFuer(person);
  if (s.nurInhaber && !kontext?.inhaber) return NextResponse.json({ ok: false, error: 'Diesen Schritt hakt nur der Inhaber ab.' }, { status: 403 });
  const erledigt = await hakenSetzen(person, id, body.an !== false);
  return NextResponse.json({ ok: true, erledigt: await mitAnzeige(erledigt, person) });
}
