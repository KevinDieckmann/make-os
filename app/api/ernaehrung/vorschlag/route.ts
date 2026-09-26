// ─── MAKE OS — Jarvis plant die Essens-Woche für den Haushalt ───────────────
// POST { hinweis?, gaeste?: string[] } → Vorschlag: 7 Tage × 3 Mahlzeiten, je
// Gericht ein Rezept (Zutaten, Zubereitung, Dauer, Portionen, für wen) und die
// Einkaufsliste mit Menge und Kategorie. Seit 26.09. für ALLE Profile des
// Haushalts (Kevin, Malin, gewählte Gäste): gemeinsame Gerichte, wo nötig eine
// Variante je Person. Bevorzugte Lebensmittel zuerst; was im Vorrat ist, wird
// verbraucht und steht nicht auf der Liste. NUR ein Vorschlag — übernommen
// wird per Klick. Kein Medizin-/Ernährungsrat.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey, fremd } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { modellSchranke } from '@/lib/zugang/umfang';
import { TAGE, MAHLZEITEN, KATEGORIEN, sauberDatei, neueId, kategorieRaten, gleichesLebensmittel, type ErnaehrungFile, type Tag, type Mahlzeiten, type Gericht, type EinkaufPosten, type PlanGerichte, type Kategorie } from '@/lib/ernaehrung/modell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CARE = 'Alltagsküche, kein Medizin- oder Ernährungsrat — Unverträglichkeiten und Krankheiten gehören zu Arzt/Ernährungsberatung.';

const profilText = (p: ErnaehrungFile['profile'][number]) => [
  `• ${p.name || p.person}${p.konto ? '' : ' (Gast)'}:`,
  p.bedarf ? `Bedürfnisse/Regeln: ${p.bedarf}` : '',
  p.unvertraeglich.length ? `Verträgt nicht: ${p.unvertraeglich.join(', ')}` : '',
  p.nie.length ? `Nie: ${p.nie.join(', ')}` : '',
  p.gern.length ? `Gern: ${p.gern.join(', ')}` : '',
  p.ziel ? `Ziel: ${p.ziel}` : '',
].filter(Boolean).join(' ');

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json({ error: 'Nur für den Haushalt des Inhabers.' }, { status: 403 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { hinweis?: string; gaeste?: string[] } = {};
  try { body = await req.json(); } catch { /* leer ok */ }
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('health');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const f = sauberDatei(await loadJson<ErnaehrungFile>('ernaehrung'));
  const gaeste = new Set(Array.isArray(body.gaeste) ? body.gaeste.map(String) : []);
  const profile = f.profile.filter(p => p.konto || gaeste.has(p.person));
  const namen = profile.map(p => p.name || p.person);
  const bevorzugt = f.lebensmittel.filter(l => l.bevorzugt).map(l => (l.hinweis ? `${l.name} (${l.hinweis})` : l.name));
  const vorrat = f.vorrat.map(v => (v.menge ? `${v.name} (${v.menge})` : v.name));

  const system = [
    `Du planst die Essens-Woche eines Haushalts — Alltagsküche für ${namen.length ? namen.join(' und ') : 'zwei Personen'}. Dein Job: eine Woche, die sie wirklich durchhalten.`,
    'GRUNDSÄTZE (verbindlich):', f.grundsaetze || 'anti-entzündlich, regelmäßig, einfach',
    profile.length ? 'PROFILE (verbindlich — Unverträgliches und „Nie“ sind absolut):\n' + profile.map(profilText).join('\n') : 'PROFILE: keine hinterlegt — plane ausgewogen.',
    bevorzugt.length ? `BEVORZUGTE LEBENSMITTEL (zuerst nehmen, so benennen): ${bevorzugt.join('; ')}` : '',
    vorrat.length ? `VORRAT ZUHAUSE (verbrauchen! kommt NICHT auf die Einkaufsliste): ${vorrat.join('; ')}` : '',
    'REGELN:',
    '- Je Mahlzeit EIN Gericht, Name max 8 Wörter. Gemeinsame Gerichte; braucht eine Person eine Variante, steht sie im Namen („… (für Malin ohne Feta)“).',
    '- Frühstück und Mittag alltagstauglich schnell; 2–3 Gerichte dürfen sich wiederholen (Meal-Prep), aber nicht alles. Abends leicht. Freitag/Samstag darf EIN Genuss-Gericht sein.',
    '- Zu JEDEM verschiedenen Gericht ein Rezept: Zutaten mit Menge (für alle Personen zusammen), Zubereitung in 3–7 kurzen Schritten, Dauer in Minuten, Portionen, für wen.',
    '- EINKAUFSLISTE: alle nötigen Zutaten der Woche, gebündelt und dedupliziert, abzüglich Vorrat, mit Menge und Kategorie aus: ' + KATEGORIEN.map(k => k.id).join(', ') + '. 15–35 Posten.',
    'Antworte NUR als JSON: {"begruendung":"1-2 Sätze","plan":{"mo":{"fruehstueck":"…","mittag":"…","abend":"…"},…,"so":{…}},"gerichte":[{"name":"…","zutaten":[{"name":"…","menge":"…"}],"zubereitung":["…"],"dauerMin":20,"portionen":2,"fuer":["Kevin","Malin"],"tags":["schnell"]}],"einkauf":[{"text":"…","menge":"…","kategorie":"obst-gemuese"}]}',
  ].filter(Boolean).join('\n');

  const user = body.hinweis ? fremd('hinweis', `Hinweis für diese Woche: ${String(body.hinweis).slice(0, 300)}`) : 'Plane eine normale Woche.';

  const r = await askJson<{ begruendung?: string; plan?: Partial<Record<Tag, Partial<Mahlzeiten>>>; gerichte?: unknown[]; einkauf?: unknown[] }>({
    zweck: 'ernaehrung-vorschlag', system, user, maxTokens: 12000, model: agent.model, timeoutMs: 240_000,
  });
  if (!r.ok || !r.data?.plan) return NextResponse.json({ error: r.error ?? 'Kein Vorschlag erhalten.' }, { status: 200 });

  const jetzt = new Date().toISOString();
  const plan = {} as Record<Tag, Mahlzeiten>;
  for (const t of TAGE) {
    const m = r.data.plan[t] ?? {};
    plan[t] = { fruehstueck: String(m.fruehstueck ?? '').slice(0, 200), mittag: String(m.mittag ?? '').slice(0, 200), abend: String(m.abend ?? '').slice(0, 200) };
  }
  // Rezepte säubern, Ids vergeben, dem Plan zuordnen (Name → Rezept).
  const gerichte: Gericht[] = sauberDatei({ gerichte: (Array.isArray(r.data.gerichte) ? r.data.gerichte : []).map(g => ({ ...(g as object), id: neueId('g'), quelle: 'jarvis', angelegt: jetzt })) as Gericht[] }, jetzt).gerichte;
  const planGerichte: PlanGerichte = {};
  for (const t of TAGE) for (const m of MAHLZEITEN) {
    const name = plan[t][m.k];
    if (!name) continue;
    const g = gerichte.find(x => x.name.toLowerCase() === name.toLowerCase()) ?? gerichte.find(x => gleichesLebensmittel(x.name, name));
    if (g) planGerichte[t] = { ...(planGerichte[t] ?? {}), [m.k]: g.id };
  }
  const einkauf: EinkaufPosten[] = (Array.isArray(r.data.einkauf) ? r.data.einkauf : []).map(x => {
    const o = (x && typeof x === 'object' ? x : { text: x }) as { text?: unknown; menge?: unknown; kategorie?: unknown };
    const text = String(o.text ?? '').slice(0, 120).trim();
    const kategorie = KATEGORIEN.some(k => k.id === o.kategorie) ? (o.kategorie as Kategorie) : kategorieRaten(text);
    return { id: neueId('e'), text, erledigt: false, ...(o.menge ? { menge: String(o.menge).slice(0, 30) } : {}), kategorie, quelle: 'plan' as const };
  }).filter(p => p.text && !f.vorrat.some(v => gleichesLebensmittel(v.name, p.text))).slice(0, 60);

  await logRun('health', 'Essens-Woche vorgeschlagen', { posten: einkauf.length, gerichte: gerichte.length, personen: namen.length });
  return NextResponse.json({ begruendung: String(r.data.begruendung ?? '').slice(0, 400), plan, planGerichte, gerichte, einkauf, hinweis: CARE });
}
