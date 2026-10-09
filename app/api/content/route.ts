// ─── MAKE OS — Content-/Brand-Agent ─────────────────────────────────────────
// Entwürfe in der Stimme der auslösenden Person. Autonomie: Entwurf — Publizieren bleibt dein Klick (Human-in-the-Loop).
// Plattform neutral (09.10.): keine CI, Marke, Zielgruppe oder Produkt fest im Code — Sprachregeln und Begriffe der Instanz
// kommen aus den Brain-Regeln (`regelnFuerPrompt`, nur freigegebene), Absender und Produkte aus Konto und Katalog
// (lib/crm/absender.ts).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, imHaushaltOderSystemlauf } from '@/lib/zugang/tor';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { NextResponse } from 'next/server';
import { askText, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { modellSchranke } from '@/lib/zugang/umfang';
import { neueKennung } from '@/lib/kennung';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { kiKennzeichen } from '@/lib/datenschutz/ki-kennzeichnung';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { absenderLaden, absenderZeilen } from '@/lib/crm/absender';
import { regelnFuerPrompt } from '@/lib/brain/regeln';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Allgemeine Haltung — alles Weitere (Begriffe, verbotene Wörter, Zielgruppe) pflegt die Instanz als Brain-Regel. */
const HALTUNG = 'HALTUNG: ruhig, souverän, konkret. Kein Hype, keine Ausrufezeichen-Ketten, keine Buzzword-Girlanden. Klartext, der Kompetenz zeigt.';

const FORMATS: Record<string, { label: string; guide: string }> = {
  linkedin: { label: 'LinkedIn-Post', guide: 'Ein LinkedIn-Post (max ~1200 Zeichen). Starker erster Satz (Hook), 3-5 kurze Absätze/Zeilen, konkrete Beobachtung statt Werbung, am Ende eine ruhige Einladung zum Gespräch. Sparsame Zeilenumbrüche, keine Hashtag-Flut (max 3).' },
  artikel: { label: 'Fachartikel', guide: 'Ein Fachartikel (~600-900 Wörter) mit Titel, kurzer Einleitung, 3-4 Zwischenüberschriften und einem klaren Fazit. Substanz und Einordnung, kein Werbetext.' },
  landing: { label: 'Landingpage', guide: 'Landingpage-Copy: Hero-Headline + Subline, 3 Nutzen-Blöcke (je Überschrift + 1-2 Sätze), ein Abschnitt „Für wen", ein ruhiger Call-to-Action. Als Struktur mit Überschriften.' },
  email: { label: 'Kalt-E-Mail', guide: 'Eine kurze Erstansprache-E-Mail (max ~120 Wörter) an die Zielgruppe aus den Regeln bzw. dem Thema. Betreff + Text. Persönlich, ein konkreter Aufhänger, eine niedrigschwellige Frage. Kein Verkaufsdruck.' },
};

interface ContentEntwurf { id: string; zeit: string; format: string; thema: string; text: string; quelle: 'zoe' }
const ENTWUERFE = 'content-entwuerfe';

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let payload: { format?: string; thema?: string; notizen?: string; ablegen?: boolean };
  try { payload = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const fmt = FORMATS[payload.format ?? ''] ?? FORMATS.linkedin;
  const thema = (payload.thema ?? '').trim();
  const notizen = (payload.notizen ?? '').trim();
  if (!thema) return NextResponse.json({ reply: 'Gib mir ein Thema, dann schreibe ich den Entwurf.' });

  if (!hasAnthropicKey()) return NextResponse.json({ reply: 'Kein Anthropic-Key (.env.local) — mit Key schreibe ich dir den Entwurf in CI.', needsKey: true });
  const agent = await resolveAgent('content');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), reply: '' });

  const person = personStreng(req);
  const [absender, regeln] = await Promise.all([absenderLaden(person), person ? regelnFuerPrompt(person).catch(() => '') : Promise.resolve('')]);
  const system = [
    'Du bist der Content-/Brand-Agent in MAKE OS und schreibst Entwürfe in der Stimme der Person, die sie anstößt.',
    ...absenderZeilen(absender),
    HALTUNG,
    regeln ? `SPRACHREGELN UND BEGRIFFE DER INSTANZ (Brain-Regeln, freigegeben):\n${regeln}` : 'Keine eigenen Sprachregeln hinterlegt — schreib schlicht und konkret.',
    `FORMAT: ${fmt.guide}`,
    'Schreib auf Deutsch. Gib NUR den fertigen Entwurf zurück (Markdown), keine Meta-Kommentare, keine „hier ist dein Text"-Einleitung.',
    'Es ist ein ENTWURF — die Person liest gegen und veröffentlicht selbst.',
  ].join('\n');

  const user = [`Thema: ${thema}`, notizen ? `Zusätzliche Notizen/Fakten (nutze sie, erfinde nichts dazu):\n${notizen}` : ''].filter(Boolean).join('\n\n');

  const r = await askText({ zweck: 'content', ki: kiAus(req, ['allgemein', 'brain', 'crm', 'konto']), system, user, maxTokens: 4000, model: agent.model });
  if (!r.ok || !r.text) return NextResponse.json({ reply: r.error ?? 'Konnte gerade keinen Entwurf erzeugen — nochmal versuchen.' });

  await logRun('content', `${fmt.label}: ${thema.slice(0, 80)}`, { format: fmt.label, thema, entwurf: r.text.slice(0, 2000) }, { person });
  // Ein Platz für den Entwurf (27.09.): läuft der Agent im Hintergrund (ZOE, Takt), legt er den Text hier ab —
  // sonst stünde er nur in der Warteschlange. Höchstens 30 Entwürfe, älteste fallen raus.
  let abgelegt = false;
  if (payload.ablegen) {
    try {
      await updateJson<{ entwuerfe: ContentEntwurf[] }>(ENTWUERFE, cur => ({ entwuerfe: [{ id: neueKennung('ce'), zeit: new Date().toISOString(), format: fmt.label, thema: thema.slice(0, 160), text: r.text.slice(0, 12000), quelle: 'zoe' as const }, ...(cur?.entwuerfe ?? [])].slice(0, 30) }));
      abgelegt = true;
    } catch { abgelegt = false; }
  }
  return NextResponse.json({ reply: r.text, format: fmt.label, abgelegt, ki: kiKennzeichen({ anbieter: r.anbieter, modell: agent.model }) }); // KI-VO Art. 50 (05.10.; Anbieter seit 09.10.)
}

/** Die abgelegten Entwürfe (Content › Entwürfe von ZOE). */
export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const s = await loadJson<{ entwuerfe: ContentEntwurf[] }>(ENTWUERFE);
  return NextResponse.json({ ok: true, entwuerfe: s?.entwuerfe ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function DELETE(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^ce-[a-z0-9-]{1,60}$/.test(id)) return NextResponse.json({ ok: false, error: 'id fehlt.' }, { status: 400 });
  await updateJson<{ entwuerfe: ContentEntwurf[] }>(ENTWUERFE, cur => ({ entwuerfe: (cur?.entwuerfe ?? []).filter(e => e.id !== id) }));
  return NextResponse.json({ ok: true });
}
