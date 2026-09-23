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

/** Wie viele der 21 Mahlzeiten-Felder gefüllt sind. */
function gefuellt(f: ErnaehrungFile): number {
  return TAGE.reduce((n, t) => {
    const m = f.plan[t];
    return n + (m.fruehstueck ? 1 : 0) + (m.mittag ? 1 : 0) + (m.abend ? 1 : 0);
  }, 0);
}

export async function PUT(req: Request) {
  let body: Partial<ErnaehrungFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  // Schrumpf-Wächter: die Ansicht schreibt immer den kompletten Plan zurück.
  // Konnte sie ihren Stand nicht laden, würde sie damit die ganze Woche
  // leerräumen. Ein halbes Leerräumen auf einmal ist nie beabsichtigt.
  let verloren: string | null = null;
  const next = await updateJson<ErnaehrungFile>('ernaehrung', current => {
    const neu = sauber(body);
    if (!current) return neu;
    const alt = sauber(current);
    if (gefuellt(alt) >= 4 && gefuellt(neu) < gefuellt(alt) / 2) {
      verloren = `Essensplan (${gefuellt(alt)} → ${gefuellt(neu)} Mahlzeiten)`;
      return alt;
    }
    if (alt.einkauf.length >= 4 && neu.einkauf.length < alt.einkauf.length / 2) {
      verloren = `Einkaufsliste (${alt.einkauf.length} → ${neu.einkauf.length})`;
      return alt;
    }
    // Ein leeres Textfeld gegen ausgeschriebene Grundsätze ist kein Löschen,
    // das jemand so meint — das ist eine Ansicht ohne geladenen Stand.
    if (alt.grundsaetze.length > 100 && !neu.grundsaetze.trim()) {
      verloren = 'Grundsätze (leeres Feld gegen ausgeschriebenen Text)';
      return alt;
    }
    return neu;
  });

  if (verloren) {
    return NextResponse.json(
      { ok: false, error: `Verweigert: ${verloren} wäre stark geschrumpft. Der alte Stand bleibt stehen — Seite neu laden.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, ...next });
}
