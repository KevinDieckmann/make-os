// ─── MAKE OS — Ernährung & Einkauf (Haushalt des Inhabers) ───────────────────
// GET    → die ganze Datei + wer im Haushalt ist + Lebensmittel-Budget des Monats
// PATCH  { ops } → kleine Schritte (Posten, Vorrat, Rezept, Plan-Feld, Profil) —
//          zu zweit am Handy überschreibt so niemand den anderen
// PUT    → Altweg (ganzer Plan/Liste/Grundsätze), bleibt für ältere Ansichten
// Profile pflegt jede Person selbst (Konto), Gäste pflegt der Haushalt.
// 08.10. (Kevin): Einkauf, Plan und Gerichte bleiben gemeinsam; Konto-Profile sieht nur die Person selbst — außer die
// Inhaberin teilt ihre Gesundheit mit der anfragenden Person (`darfGesundheitSehen`). JEDE Antwort mit der Datei geht durch
// `ausliefern` (→ `profileFuerBetrachter`, lib/ernaehrung/modell.ts). Fremde Profile schreiben/löschen → 403, nichts gespeichert.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';
import { kontenImHaushaltDerInhaber } from '@/lib/zugang/inhaber';
import { ladeHaushalt } from '@/lib/finanzen/haushalt/speicher';
import { heuteBerlin, monatVon } from '@/lib/finanzen/haushalt/monat';
import { sauberDatei, wendeAn, gefuellt, profileFuerBetrachter, type ErnaehrungFile, type Op } from '@/lib/ernaehrung/modell';
import { darfGesundheitSehen } from '@/lib/zoe/raum';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = 'ernaehrung';
const KEIN = { ok: false, error: 'Ernährung und Einkauf gehören zum Haushalt des Inhabers (System → Konto).' };

// Startbestand: allgemeine Grundsätze (bearbeitbar) — Bedürfnisse je Person stehen seit 26.09. in den Profilen.
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
  return kontenImHaushaltDerInhaber(await ladeKonten()).map(k => ({ id: k.speicher, name: k.name.split(' ')[0] }));
}

/**
 * Die Datei für die anfragende Person: fremde Konto-Profile nur, wenn deren Inhaberin Gesundheit mit ihr teilt.
 * Lese-Protokoll (08.10., Kevin): wird das Profil einer ANDEREN Person tatsächlich ausgeliefert (geteilt), notiert jede Antwort
 * `leseZugriff(req, 'gesundheit', { betroffen })` — gedrosselt, ohne Inhalte. Eigene Profile und Gäste-Profile nie.
 */
async function ausliefern(req: Request, ich: string, f: ErnaehrungFile): Promise<ErnaehrungFile> {
  const fremde = [...new Set(f.profile.filter(p => p.konto && p.person !== ich).map(p => p.person))];
  const teilt = new Set<string>();
  for (const p of fremde) if (await darfGesundheitSehen(req, p).catch(() => false)) teilt.add(p);
  const profile = profileFuerBetrachter(f.profile, ich, teilt);
  for (const p of fremdeAusgeliefert(profile, ich)) leseZugriff(req, 'gesundheit', { betroffen: p });
  return { ...f, profile };
}

/** Wessen Konto-Profil (nicht das eigene) in einer Antwort steht — die Betroffenen fürs Lese-Protokoll. Rein. */
function fremdeAusgeliefert(profile: ErnaehrungFile['profile'], ich: string): string[] {
  return [...new Set(profile.filter(p => p.konto && p.person !== ich).map(p => p.person))];
}

const FREMD = { ok: false, error: 'Nicht erlaubt: das Profil einer anderen Person pflegt nur sie selbst. Nichts gespeichert.' };

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const [f, b, p] = await Promise.all([laden(), budget(), personen()]);
  return NextResponse.json({ ...(await ausliefern(req, z.person, f)), ich: z.person, personen: p, budget: b });
}

export async function PATCH(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  if (zuGross(req, 1_000_000)) return ZU_GROSS(1_000_000);
  let body: { ops?: Op[] };
  try { body = await jsonBegrenzt(req, 1_000_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const ops = (Array.isArray(body.ops) ? body.ops : []).slice(0, 200);
  if (!ops.length) return NextResponse.json({ ok: false, error: 'Keine Schritte übergeben.' }, { status: 400 });
  let abgelehnt: string[] = [];
  let fremd = false;
  const konten = (await personen()).map(p => p.id);
  const next = await updateJson<ErnaehrungFile>(STORE, current => {
    const f = sauberDatei(current);
    if (!f.grundsaetze) f.grundsaetze = SEED_GRUNDSAETZE;
    const r = wendeAn(f, ops, z.person, undefined, konten);
    // Ein Schritt auf ein fremdes Profil lehnt den ganzen Aufruf ab (08.10.) — nichts wird gespeichert.
    if (r.abgelehnt.includes('profile:fremd')) { fremd = true; return (current ?? f) as ErnaehrungFile; }
    abgelehnt = r.abgelehnt;
    return r.datei;
  });
  if (fremd) return NextResponse.json(FREMD, { status: 403 });
  return NextResponse.json({ ok: true, abgelehnt, ...(await ausliefern(req, z.person, sauberDatei(next))), ich: z.person });
}

export async function PUT(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  let body: Partial<ErnaehrungFile>;
  try { body = await jsonBegrenzt(req, 1_000_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  // Altweg: nur Plan, Liste und Grundsätze — Profile, Stammliste, Vorrat und Rezepte gehen über PATCH. Die Profile kommen IMMER
  // aus dem gespeicherten Stand (`alt`), nie aus dem Körper — ein Browser, der fremde Profile nicht sieht, kann sie so nicht löschen.
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
  return NextResponse.json({ ok: true, ...(await ausliefern(req, z.person, sauberDatei(next))), ich: z.person });
}
