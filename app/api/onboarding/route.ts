// ─── MAKE OS — Onboarding (Zustand und Häkchen) ─────────────────────────────
// Der Plan prüft sich selbst (lib/onboarding-status.ts — eine Quelle mit Startfläche und Heute-Karte). Häkchen seit 08.10. spät
// (Paket B0/B2, ONBOARDING_PLAN.md): persönliche je Person (`onboarding--<speicher>`), gemeinsame im Bestand `onboarding`
// (lib/onboarding-haken.ts). Schreiben nur die angemeldete Person selbst — Dienstweg 403, ohne Person 401, unbekannte Kennung 400
// (nie gekürzt), Inhaber-Schritte nur ein Inhaber (403; seit 09.10. jeder Inhaber), Privat-Schritte nur mit Zugang zu den Privat-Finanzen (403), Build-Kennung (409
// neu laden). Gespeichert wird der Speichername, nie ein Vorname. Alte Häkchen (vor dem 08.10.) zählen nie — nur `frueher` („bitte
// bestätigen“). GET liest nur (auch WHOOP roh, lib/onboarding-status.ts) — Lesen schreibt nie.
// Update 2 (16.10.): GET liefert zusätzlich `gruen` (B10: welche eigenen Schritte schon einmal grün waren — nur die der Person der Sitzung,
// geschrieben im Morgenlauf). Befunde über private Finanzen und Familie filtert lib/onboarding-status.ts nach Recht (B11).

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, personStreng, ohnePerson, istDienst } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { pruefeAlles, kontextFuer } from '@/lib/onboarding-status';
import { hakenLesen, hakenSetzen, type Haken, type HakenSicht } from '@/lib/onboarding-haken';
import { schrittMitId, sichtbarFuer } from '@/lib/make-one/onboarding-data';
import { ladeKonten } from '@/lib/zugang/konten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Körper höchstens 2 KB: `{ id, an }`. */
const GRENZE = 2048;
const KENNUNG = /^[a-z0-9-]{1,60}$/;

/** `von` für die Anzeige: „dir“ für die eigene Person, sonst der Vorname aus dem Konto (Altbestand: wie gespeichert). */
async function mitAnzeige(h: HakenSicht, ich: string): Promise<{ erledigt: Record<string, Haken>; frueher: string[]; gruen: Record<string, string> }> {
  const namen = new Map((await ladeKonten().catch(() => ({ konten: [] as { speicher: string; name: string }[] }))).konten.map(k => [k.speicher, (k.name ?? '').split(' ')[0] || k.speicher]));
  return { erledigt: Object.fromEntries(Object.entries(h.erledigt).map(([id, x]) => [id, { at: x.at, von: x.von === ich ? 'dir' : namen.get(x.von) ?? x.von }])), frueher: h.frueher, gruen: h.gruen };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const person = personStreng(req);
  const [haken, befunde, kontext] = await Promise.all([
    hakenLesen(person),
    // Persönliche Befunde nur für die Person der Sitzung (08.10.) — nie für eine andere; Inhaber-Befunde nur für den Inhaber.
    pruefeAlles(person),
    kontextFuer(person),
  ]);
  // `neustart` nur, wenn die Instanz die Marke trägt (09.10.) — dann gilt in der Oberfläche der Neustart-Ablauf.
  const ich = kontext ? { inhaber: kontext.inhaber, haupt: kontext.haupt, eingeladen: kontext.eingeladen, personen: kontext.personen, privatFinanzen: kontext.privatFinanzen, altbestand: kontext.altbestand, ...(kontext.neustart ? { neustart: true } : {}) } : null;
  return NextResponse.json({ ...(await mitAnzeige(haken, z.person)), befunde, ich });
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
  if (!sichtbarFuer(s, kontext)) return NextResponse.json({ ok: false, error: 'Diesen Schritt gibt es für dein Konto nicht (z. B. Privat-Finanzen ohne Zugang).' }, { status: 403 });
  const haken = await hakenSetzen(person, id, body.an !== false);
  return NextResponse.json({ ok: true, ...(await mitAnzeige(haken, person)) });
}
