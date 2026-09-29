// ─── MAKE OS — Zeit & Fokus ─────────────────────────────────────────────────
// GET  → das Bild der Person: heute und die letzten 7 Tage je Space und Bereich,
//        bewusste Fokus-Zeit, Fokus-Tage, die letzten Blöcke.
// POST { aktion: 'fokus', von, bis, schluessel, label, aufgabeId?, einheit?, mandatId?, firmaId?, terminUid? } → ein bewusster Block ist zu Ende.
// POST { aktion: 'zuordnen', von, aufgabeId?, einheit?, mandatId?, firmaId? } → einen eigenen Block nachträglich einer Aufgabe/Einheit/einem Mandat
//        zuordnen (leer = Zuordnung entfernen). Säuberung: lib/zeitmessung/einheiten.ts `zuordnungSaeubern`.
// POST { aktion: 'umbuchen', von, space: 'privat'|'business' } → einen eigenen Block in den anderen Space umbuchen
//        (nach Privat fallen Aufgabe/Einheit weg). Alle POST nur mit ausdrücklicher Person (401), nur im eigenen Bestand.
// Mandat (28.09., „Mandat an Zielen und Zeit“): nur im Business, Kennung nur in der Form geprüft; ist das Mandat
// bekannt, kommen Firma und Einheit aus dem Mandat (lib/planung/mandat.ts). Tote Verweise meldet die Verbindungsprüfung.
// Zeit je Einheit (Woche/Monat, je Person und gesamt): /api/state/zeit/einheiten; Zeit je Mandat: /api/state/zeit/mandate.
// Die laufende Messung kommt über die Anwesenheit (/api/state/anwesenheit).

import { NextResponse } from 'next/server';
import { personAus } from '@/lib/zoe/raum';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { fokusAbschliessen, fokusZuordnen, fokusUmbuchen, aufgabenKurz, zeitBildFuer } from '@/lib/zeitmessung/speicher';
import { zuordnungSaeubern, AUFGABE_ID_MAX, type AufgabeKurz } from '@/lib/zeitmessung/einheiten';
import { bild } from '@/lib/zeitmessung/modell';
import { localDay } from '@/lib/zeit';
import { mandateFuerBezug } from '@/lib/planung/mandat-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const person = personAus(req);
  return NextResponse.json({ ok: true, bild: await zeitBildFuer(person) }, { headers: { 'Cache-Control': 'no-store' } });
}

const SCHLUESSEL = /^(privat|business|gemeinsam):[a-z0-9-]{1,40}$/;
const iso = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null);

/** Die Aufgabe hinter einer Zuordnung — nur gelesen, wenn eine Kennung kommt. `undefined` = keine gewünscht, `null` = nicht gefunden. */
async function aufgabeZu(id: unknown): Promise<AufgabeKurz | null | undefined> {
  if (id == null || id === '') return undefined;
  if (typeof id !== 'string' || !id.trim() || id.length > AUFGABE_ID_MAX) return null;
  return (await aufgabenKurz()).find(a => a.id === id.trim()) ?? null;
}

export async function POST(req: Request) {
  // Schreiben nur mit ausdrücklicher Person (Sitzung oder Dienstweg mit Person) — nie der Rückfall auf „kevin“.
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, error: 'Keine Person.' }, { status: 401 });
  let b: { aktion?: string; von?: unknown; bis?: unknown; schluessel?: unknown; label?: unknown; aufgabeId?: unknown; einheit?: unknown; mandatId?: unknown; firmaId?: unknown; space?: unknown; terminUid?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.aktion === 'umbuchen') {
    const von = iso(b.von);
    const ziel = b.space === 'privat' || b.space === 'business' ? b.space : null;
    if (!von || !ziel) return NextResponse.json({ ok: false, error: 'von und space (privat|business) nötig.' }, { status: 400 });
    const d = await fokusUmbuchen(person, von, ziel);
    if (!d) return NextResponse.json({ ok: false, error: 'Block nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true, bild: bild(d, localDay()) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (b.aktion === 'zuordnen') {
    const von = iso(b.von);
    if (!von) return NextResponse.json({ ok: false, error: 'von nötig.' }, { status: 400 });
    const aufgabe = await aufgabeZu(b.aufgabeId);
    if (aufgabe === null) return NextResponse.json({ ok: false, error: 'Aufgabe nicht gefunden.' }, { status: 404 });
    // Das Mandat der Aufgabe (28.09. abends) zählt mit — dann wird das CRM gelesen, auch wenn der Block keins nennt.
    const mandate = await mandateFuerBezug({ ...b, mandatId: aufgabe?.mandatId ?? b.mandatId });
    const d = await fokusZuordnen(person, von, schluessel => zuordnungSaeubern(schluessel, b, aufgabe, mandate));
    if (!d) return NextResponse.json({ ok: false, error: 'Block nicht gefunden.' }, { status: 404 });
    return NextResponse.json({ ok: true, bild: bild(d, localDay()) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  if (b.aktion !== 'fokus') return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  const von = iso(b.von), bis = iso(b.bis) ?? new Date().toISOString();
  const schluessel = typeof b.schluessel === 'string' && SCHLUESSEL.test(b.schluessel) ? b.schluessel : null;
  if (!von || !schluessel) return NextResponse.json({ ok: false, error: 'von und schluessel nötig.' }, { status: 400 });
  if (Date.parse(bis) <= Date.parse(von)) return NextResponse.json({ ok: false, error: 'Ende liegt vor dem Anfang.' }, { status: 400 });
  // Eine verschwundene Aufgabe kostet nicht den Block: dann eben ohne Aufgabe (die Einheit bleibt, wenn gewählt).
  const aufgabe = await aufgabeZu(b.aufgabeId);
  const zuordnung = zuordnungSaeubern(schluessel, b, aufgabe ?? undefined, await mandateFuerBezug({ ...b, mandatId: aufgabe?.mandatId ?? b.mandatId }));
  // Aus einer Fokuszeit im Kalender (29.09., K1): die Termin-UID bleibt am Block (Verbindungsprüfung `zeit-termin-tot`).
  const terminUid = typeof b.terminUid === 'string' && /^[^\u0000-\u001f\u007f]{1,300}$/.test(b.terminUid) ? b.terminUid : undefined;
  const d = await fokusAbschliessen(person, { von, bis, schluessel, label: typeof b.label === 'string' ? b.label : '', ...zuordnung, ...(terminUid ? { terminUid } : {}) });
  return NextResponse.json({ ok: true, bild: bild(d, localDay()) }, { headers: { 'Cache-Control': 'no-store' } });
}
