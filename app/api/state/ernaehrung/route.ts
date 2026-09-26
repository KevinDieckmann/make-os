// ─── MAKE OS — Ernährung & Einkauf (Haushalt des Inhabers) ───────────────────
// GET    → die ganze Datei + wer im Haushalt ist + Lebensmittel-Budget des Monats
// PATCH  { ops } → kleine Schritte (Posten, Vorrat, Rezept, Plan-Feld, Profil) —
//          zu zweit am Handy überschreibt so niemand den anderen
// PUT    → Altweg (ganzer Plan/Liste/Grundsätze), bleibt für ältere Ansichten
// Profile pflegt jede Person selbst (Konto), Gäste pflegt der Haushalt.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { heuteBerlin, monatVon } from '@/lib/finanzen/haushalt/monat';
import { sauberDatei, wendeAn, gefuellt, type ErnaehrungFile, type Op } from '@/lib/ernaehrung/modell';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = 'ernaehrung';
const KEIN = { ok: false, error: 'Ernährung und Einkauf gehören zum Haushalt des Inhabers (System → Konto).' };

// Startbestand aus Kevins Profil (Ernährung = Hebel gegen die Psoriasis) — nur die Grundsätze;
// Bedürfnisse je Person stehen seit 26.09. in den Profilen.
const SEED_GRUNDSAETZE = [
  'Anti-entzündlich (mediterran): viel Gemüse, Olivenöl, Fisch/Omega-3, Nüsse.',
  'Regelmäßig: 3 Mahlzeiten, nicht ausfallen lassen.',
  'Wenig: Zucker, Weißmehl, Alkohol, stark Verarbeitetes, viel rotes Fleisch/Wurst.',
  'Einfach & wiederholbar: 20-Minuten-Rezepte, Meal-Prep-tauglich — sonst hält es nicht.',
  'Abends leicht — zahlt auf den Schlaf ein.',
].join('\n');

async function laden(): Promise<ErnaehrungFile> {
  const f = sauberDatei(await loadJson<ErnaehrungFile>(STORE));
  if (!f.grundsaetze) f.grundsaetze = SEED_GRUNDSAETZE;
  return f;
}

/** Lebensmittel-Ausgaben des Monats aus dem Haushalt (Cent) — verbindet Einkauf und Zahlen. */
async function budget(): Promise<{ monat: string; ausgegeben: number; budget: number | null } | null> {
  try {
    const h = await haushaltDesInhabers();
    if (!h) return null;
    const hh = await ladeHaushalt(h);
    const kat = hh.stamm.kategorien.find(k => /lebensmittel/i.test(k.name));
    if (!kat) return null;
    const monat = monatVon(heuteBerlin());
    const ausgegeben = hh.buchungen.filter(b => b.kategorie_id === kat.id && monatVon(b.datum) === monat && b.betrag < 0).reduce((s, b) => s - b.betrag, 0);
    return { monat, ausgegeben, budget: kat.monatsbudget ?? null };
  } catch { return null; }
}

async function personen(): Promise<{ id: string; name: string }[]> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  return konten.filter(k => k.speicher === inhaber?.speicher || (!!inhaber?.haushalt && k.haushalt === inhaber.haushalt)).map(k => ({ id: k.speicher, name: k.name.split(' ')[0] }));
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const [f, b, p] = await Promise.all([laden(), budget(), personen()]);
  return NextResponse.json({ ...f, ich: z.person, personen: p, budget: b });
}

export async function PATCH(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  if (zuGross(req, 1_000_000)) return ZU_GROSS(1_000_000);
  let body: { ops?: Op[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = (Array.isArray(body.ops) ? body.ops : []).slice(0, 200);
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine Schritte übergeben.' }, { status: 400 });
  let abgelehnt: string[] = [];
  const next = await updateJson<ErnaehrungFile>(STORE, current => {
    const f = sauberDatei(current);
    if (!f.grundsaetze) f.grundsaetze = SEED_GRUNDSAETZE;
    const r = wendeAn(f, ops, z.person);
    abgelehnt = r.abgelehnt;
    return r.datei;
  });
  return NextResponse.json({ ok: true, abgelehnt, ...next, ich: z.person });
}

export async function PUT(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  let body: Partial<ErnaehrungFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Altweg: nur Plan, Liste und Grundsätze — Profile, Stammliste, Vorrat und Rezepte gehen über PATCH.
  let verloren: string | null = null;
  const next = await updateJson<ErnaehrungFile>(STORE, current => {
    const alt = sauberDatei(current);
    const neu = sauberDatei({ ...alt, grundsaetze: body.grundsaetze ?? alt.grundsaetze, plan: body.plan ?? alt.plan, planGerichte: body.planGerichte ?? alt.planGerichte, einkauf: body.einkauf ?? alt.einkauf });
    if (gefuellt(alt) >= 4 && gefuellt(neu) < gefuellt(alt) / 2) { verloren = `Essensplan (${gefuellt(alt)} → ${gefuellt(neu)} Mahlzeiten)`; return alt; }
    if (alt.einkauf.length >= 4 && neu.einkauf.length < alt.einkauf.length / 2) { verloren = `Einkaufsliste (${alt.einkauf.length} → ${neu.einkauf.length})`; return alt; }
    if (alt.grundsaetze.length > 100 && !neu.grundsaetze.trim()) { verloren = 'Grundsätze'; return alt; }
    return neu;
  });
  if (verloren) return NextResponse.json({ ok: false, error: `Verweigert: ${verloren} wäre stark geschrumpft. Der alte Stand bleibt stehen — Seite neu laden.` }, { status: 409 });
  return NextResponse.json({ ok: true, ...next, ich: z.person });
}
