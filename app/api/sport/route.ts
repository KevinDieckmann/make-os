// ─── MAKE OS — Sport (Hyrox · Running · Gym · Erholung), je Person ──────────
// GET  → der eigene Stand + Vitalwerte der letzten 14 Tage (zum Vorbelegen der
//        Erholung) + Bibliothek (Übungen, Vorlagen). ETag aus dem Speicherstand.
// PUT  { ops } → kleine Schritte (lib/sport/modell.ts wendeAn) in EINER Sperre —
//        zu zweit am Handy überschreibt so niemand den anderen.
// Zugang: nur die angemeldete Person (Sitzung → x-make-user; Dienstweg nennt die
// Person). Kein ?fuer= — Sport ist persönlich, jede Person sieht nur Eigenes.

import { NextResponse } from 'next/server';
import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { speicherFuer } from '@/lib/zoe/raum';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { localDay } from '@/lib/zeit';
import { saeubere, wendeAn, type Op, type SportStand } from '@/lib/sport/modell';
import { UEBUNGEN, VORLAGEN } from '@/lib/sport/gym';
import { tagPlus } from '@/lib/sport/pace';
import type { VitalsLog } from '@/lib/vitals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEINE_PERSON = NextResponse.json({ ok: false, error: 'Bitte anmelden — Sport ist persönlich.' }, { status: 401 });
const MAX_OPS = 100;

export interface VitalTag { schlafH?: number; hrv?: number; ruhepuls?: number; recovery?: number }

/** Die Vitalwerte der Person (Whoop-Export oder Morgen-Check) der letzten 14 Tage — nur die, die es gibt. */
async function vitalsFuer(person: string, heute: string): Promise<Record<string, VitalTag>> {
  const log = (await loadJson<VitalsLog>(speicherFuer('vitals', person))) ?? {};
  const ab = tagPlus(heute, -14);
  const r: Record<string, VitalTag> = {};
  for (const [tag, v] of Object.entries(log)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || tag < ab || tag > heute || !v) continue;
    const t: VitalTag = {};
    if (typeof v.sleep === 'number' && v.sleep > 0) t.schlafH = Math.round(v.sleep * 10) / 10;
    if (typeof v.hrv === 'number' && v.hrv > 0) t.hrv = Math.round(v.hrv);
    if (typeof v.rhr === 'number' && v.rhr > 0) t.ruhepuls = Math.round(v.rhr);
    if (typeof v.rec === 'number' && v.rec > 0) t.recovery = Math.round(v.rec);
    if (Object.keys(t).length) r[tag] = t;
  }
  return r;
}

export async function GET(req: Request) {
  const person = personStreng(req);
  if (!person) return KEINE_PERSON;
  const heute = localDay();
  const namen = [speicherFuer('sport', person), speicherFuer('vitals', person)];
  const etag = etagAus('sport', await speicherStand(namen), heute, person);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  const stand = saeubere(await loadJson<unknown>(namen[0]));
  return jsonAntwort(req, { ok: true, ich: person, heute, stand, vitals: await vitalsFuer(person, heute), bibliothek: { uebungen: UEBUNGEN, vorlagen: VORLAGEN } }, etag);
}

export async function PUT(req: Request) {
  const person = personStreng(req);
  if (!person) return KEINE_PERSON;
  if (zuGross(req, 1_000_000)) return ZU_GROSS(1_000_000);
  let body: { ops?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = Array.isArray(body.ops) ? (body.ops as Op[]).slice(0, MAX_OPS) : [];
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine Änderungen.' }, { status: 400 });
  let fehler: string | null = null;
  const stand = await updateJson<SportStand>(speicherFuer('sport', person), aktuell => {
    let s = saeubere(aktuell);
    try { for (const op of ops) s = wendeAn(s, op); }
    catch (e) { fehler = e instanceof Error ? e.message : 'Schritt nicht möglich.'; return saeubere(aktuell); }
    return s;
  });
  if (fehler) return NextResponse.json({ ok: false, error: fehler }, { status: 400 });
  return NextResponse.json({ ok: true, stand });
}
