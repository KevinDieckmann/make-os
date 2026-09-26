// ─── MAKE OS — Ein Rezept zu einem Gericht (26.09.) ─────────────────────────
// POST { name, tag?, mahlzeit? } → Jarvis schreibt Zutaten, Zubereitung, Dauer,
// Portionen für die Profile des Haushalts; das Rezept wird gespeichert und —
// wenn Tag/Mahlzeit dabei sind — dem Plan-Feld zugeordnet.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { modellSchranke } from '@/lib/zugang/umfang';
import { sauberDatei, wendeAn, neueId, TAGE, MAHLZEITEN, type ErnaehrungFile, type Gericht, type Tag, type Mahlzeit, type Op } from '@/lib/ernaehrung/modell';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return NextResponse.json({ error: 'Nur für den Haushalt des Inhabers.' }, { status: 403 });
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { name?: string; tag?: string; mahlzeit?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const name = String(body.name ?? '').trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: 'Gericht fehlt.' }, { status: 400 });
  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key.' }, { status: 200 });
  const agent = await resolveAgent('health');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const f = sauberDatei(await loadJson<ErnaehrungFile>('ernaehrung'));
  const profile = f.profile.filter(p => p.konto);
  const system = [
    `Du schreibst EIN Rezept für den Haushalt (${profile.map(p => p.name || p.person).join(' und ') || 'zwei Personen'}) — Alltagsküche, durchhaltbar.`,
    'GRUNDSÄTZE:', f.grundsaetze || 'anti-entzündlich, regelmäßig, einfach',
    profile.length ? 'PROFILE (Unverträgliches und „Nie“ sind absolut):\n' + profile.map(p => `• ${p.name || p.person}: ${[p.bedarf, p.unvertraeglich.length ? `verträgt nicht ${p.unvertraeglich.join(', ')}` : '', p.nie.length ? `nie ${p.nie.join(', ')}` : '', p.gern.length ? `gern ${p.gern.join(', ')}` : ''].filter(Boolean).join('; ')}`).join('\n') : '',
    f.lebensmittel.filter(l => l.bevorzugt).length ? `BEVORZUGT: ${f.lebensmittel.filter(l => l.bevorzugt).map(l => (l.hinweis ? `${l.name} (${l.hinweis})` : l.name)).join('; ')}` : '',
    'Antworte NUR als JSON: {"name":"…","zutaten":[{"name":"…","menge":"…"}],"zubereitung":["Schritt 1","…"],"dauerMin":25,"portionen":2,"fuer":["…"],"tags":["…"]} — Zutaten mit Mengen für alle zusammen, 3–8 Schritte, kein Vorwort.',
  ].filter(Boolean).join('\n');

  const r = await askJson<Partial<Gericht>>({ zweck: 'ernaehrung-rezept', system, user: `Gericht: ${name}`, maxTokens: 2500, model: agent.model, timeoutMs: 120_000 });
  if (!r.ok || !r.data?.zutaten) return NextResponse.json({ error: r.error ?? 'Kein Rezept erhalten.' }, { status: 200 });

  const jetzt = new Date().toISOString();
  const gericht = sauberDatei({ gerichte: [{ ...r.data, name: r.data.name || name, id: neueId('g'), quelle: 'jarvis', angelegt: jetzt } as Gericht] }, jetzt).gerichte[0];
  if (!gericht) return NextResponse.json({ error: 'Rezept unbrauchbar.' }, { status: 200 });

  const ops: Op[] = [{ liste: 'gerichte', op: 'upsert', eintrag: gericht as unknown as Record<string, unknown> }];
  const tag = TAGE.includes(body.tag as Tag) ? (body.tag as Tag) : null;
  const mahlzeit = MAHLZEITEN.some(m => m.k === body.mahlzeit) ? (body.mahlzeit as Mahlzeit) : null;
  if (tag && mahlzeit) ops.push({ feld: 'plan', tag, mahlzeit, wert: f.plan[tag][mahlzeit] || gericht.name, gerichtId: gericht.id });
  const next = await updateJson<ErnaehrungFile>('ernaehrung', current => wendeAn(sauberDatei(current), ops, z.person, jetzt).datei);
  return NextResponse.json({ ok: true, gericht, planGerichte: next.planGerichte });
}
