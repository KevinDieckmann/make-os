// ─── MAKE OS — Ernährung (lokal, privat) ────────────────────────────────────
// Kevins aktiver Hebel gegen die Psoriasis: regelmäßig + anti-entzündlich.
// Wochen-Essensplan (7 Tage × 3 Mahlzeiten) + Einkaufsliste + Grundsätze.
// Gesundheitsdaten: bleiben aus Business-Kontexten draußen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { TAGE, type ErnaehrungFile, type Mahlzeiten, type Tag } from '@/lib/make-one/ernaehrung-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Startbestand aus Kevins echtem Profil (Ernährung = crit-Hebel, Psoriasis).
const SEED_GRUNDSAETZE = [
  'Anti-entzündlich (mediterran) — der Hebel gegen die Psoriasis: viel Gemüse, Olivenöl, Fisch/Omega-3, Nüsse.',
  'Regelmäßig: 3 Mahlzeiten, nicht ausfallen lassen — Unregelmäßigkeit ist aktuell das Kernproblem.',
  'Wenig: Zucker, Weißmehl, Alkohol, stark Verarbeitetes, viel rotes Fleisch/Wurst.',
  'Einfach & wiederholbar: 20-Minuten-Rezepte, Meal-Prep-tauglich — sonst hält es nicht.',
  'Abends leicht — zahlt auf den Schlaf ein.',
].join('\n');

function sauber(f: Partial<ErnaehrungFile> | null): ErnaehrungFile {
  const plan = {} as Record<Tag, Mahlzeiten>;
  for (const t of TAGE) {
    const m = f?.plan?.[t];
    plan[t] = {
      fruehstueck: String(m?.fruehstueck ?? '').slice(0, 200),
      mittag: String(m?.mittag ?? '').slice(0, 200),
      abend: String(m?.abend ?? '').slice(0, 200),
    };
  }
  return {
    grundsaetze: String(f?.grundsaetze ?? SEED_GRUNDSAETZE).slice(0, 2000),
    plan,
    einkauf: (Array.isArray(f?.einkauf) ? f!.einkauf : []).slice(0, 120).map(p => ({
      id: String(p.id ?? '').slice(0, 40) || `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      text: String(p.text ?? '').slice(0, 120),
      erledigt: p.erledigt === true,
    })).filter(p => p.text),
  };
}

export async function GET() {
  const f = await loadJson<ErnaehrungFile>('ernaehrung');
  if (!f) {
    const next = await updateJson<ErnaehrungFile>('ernaehrung', () => sauber(null));
    return NextResponse.json(next);
  }
  return NextResponse.json(sauber(f));
}

export async function PUT(req: Request) {
  let body: Partial<ErnaehrungFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const next = await updateJson<ErnaehrungFile>('ernaehrung', () => sauber(body));
  return NextResponse.json({ ok: true, ...next });
}
