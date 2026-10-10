// ─── MAKE OS — Gesundheit im Alltag: Schlaf-Hilfe, Tages-Check, Essen & Trinken (09.10.2026) ────────────────────────────
// NUR die Person selbst (Sitzung bzw. ausdrücklich benannt), kein `?fuer=`, kein Dienstweg (403) — wie das Körper-Profil: auch wer
// seine Gesundheit teilt, teilt diese Einstellungen und Rechnungen nicht. Bestand je Person über lib/gesundheit/alltag-server.ts.
// GET   → { ok, ich, einwilligung, einstellung, stand, sicht | null } — `sicht` (Schlaf-Lage, Tages-Check, Essen) NUR mit
//        Einwilligung (a); ohne sie nur die Einstellungen und der Hinweis (Art. 9). Lese-Protokoll (Bereich gesundheit).
// PATCH { stand, ops } → Einstellungen (lib/gesundheit/alltag.ts) in EINER Sperre; Einwilligung (a) zuerst — ausgenommen NUR
//        „ausschalten“ (Erinnerung, Handy, Orientierung, alle Fragen ab: verarbeitet nichts); veralteter Stand → 409 mit dem
//        aktuellen Stand, über einer Grenze → 413 (nie gekürzt), ungültig → 400 (nichts gespeichert).
// Die Antworten des Tages-Checks schreibt das Journal (PATCH /api/state/journal, Feld `check`), das Abhaken der Ergänzungen das
// Gesundheits-Log (PATCH /api/state/health) — hier wird nur eingestellt und gerechnet.

import { NextResponse } from 'next/server';
import { istDienst, personStreng, ohnePerson } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { gesundheitSchreibSperre, gesundheitVerarbeitungErlaubt } from '@/lib/datenschutz/gesundheit-einwilligung';
import { alltagLaden, alltagAendern, alltagSicht } from '@/lib/gesundheit/alltag-server';
import { alltagEinstellungen, nurAusschalten, ALLTAG_GRENZEN } from '@/lib/gesundheit/alltag';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 32_000;
/** 403 für den Dienstweg (ZOE, Takt, Skripte): nur die Person selbst. */
const NUR_SELBST = () => NextResponse.json({ ok: false, error: 'Schlaf-Hilfe, Tages-Check und Essens-Orientierung sieht und ändert nur die Person selbst — angemeldet, nie über den Dienstweg.' }, { status: 403 });

export async function GET(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  leseZugriff(req, 'gesundheit', { betroffen: person }); // Lese-Protokoll (Art. 9)
  const [{ alltag, stand }, einwilligung] = await Promise.all([alltagLaden(person), gesundheitVerarbeitungErlaubt(person)]);
  const sicht = einwilligung ? await alltagSicht(person, alltag) : null;
  return NextResponse.json({ ok: true, ich: person, einwilligung, einstellung: alltagEinstellungen(alltag), stand, sicht, grenzen: ALLTAG_GRENZEN }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: Request) {
  if (istDienst(req)) return NUR_SELBST();
  const person = personStreng(req);
  if (!person) return ohnePerson();
  { const alt = bauPruefen(req); if (alt) return alt; }
  if (zuGross(req, MAX_BYTES)) return ZU_GROSS(MAX_BYTES);
  let body: { stand?: unknown; ops?: unknown };
  try { body = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Art. 9: eingestellt und gerechnet wird nur mit Einwilligung (a). Ausschalten geht immer — es verarbeitet nichts, es hört auf.
  if (!nurAusschalten(body?.ops)) { const sperre = await gesundheitSchreibSperre(person); if (sperre) return sperre; }
  const r = await alltagAendern(person, body?.stand, body?.ops);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler, ...(r.status === 409 ? { konflikt: true, einstellung: r.alltag ? alltagEinstellungen(r.alltag) : null, stand: r.stand } : {}) }, { status: r.status });
  return NextResponse.json({ ok: true, einstellung: alltagEinstellungen(r.alltag), stand: r.stand });
}
