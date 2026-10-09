// ─── MAKE OS — Meeting-Agent ────────────────────────────────────────────────
// Transkript/Notizen rein → Zusammenfassung + Entscheidungen + Action-Items.
// Die Action-Items lassen sich (mit Freigabe) in echte Aufgaben übernehmen.
// Auto-Mitschrift (Granola/Fireflies) ist der spätere Zusatz.
// Plattform neutral (09.10.): Projekte kommen aus dem Aufgaben-Bestand (was die Person sieht), Verantwortliche aus den Konten
// des Haushalts — keine festen Projekte, Firmen oder Personen mehr im Prompt. Ohne passendes Projekt: „Sonstige“ (tasks/create).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltOderSystemlauf, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { localDay } from '@/lib/zeit';
import { modellSchranke } from '@/lib/zugang/umfang';
import { kiAus } from '@/lib/datenschutz/ki-lauf';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { ladeAufgabenSicht } from '@/lib/aufgaben/sicht';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { kontenDesHaushalts } from '@/lib/make-one/team-speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Höchstens so viele Projekte gehen als Auswahl an das Modell (die zuletzt geänderten zuerst). */
const PROJEKTE_MAX = 40;
const BEIDE = 'both';

/** Die Projekte, die die Person sieht (ohne Papierkorb/Archiv), und die Konten des Haushalts — Grundlage der Zuordnung. */
async function auswahl(person: string | null): Promise<{ projekte: { id: string; label: string }[]; personen: { id: string; label: string }[] }> {
  const [state, haushalt] = await Promise.all([ladeAufgabenSicht(person).catch(() => null), haushaltDesInhabers().catch(() => null)]);
  const projekte = (state?.projects ?? [])
    .filter(p => !p.geloeschtAm && !(p as { archiviertAm?: string }).archiviertAm && p.title)
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    .slice(0, PROJEKTE_MAX)
    .map(p => ({ id: p.id, label: p.title }));
  const konten = haushalt ? await kontenDesHaushalts(haushalt).catch(() => []) : [];
  return { projekte, personen: konten.map(k => ({ id: k.speicher, label: k.name || k.speicher })) };
}

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let payload: { transcript?: string; datum?: string };
  try { payload = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const transcript = (payload.transcript ?? '').trim();
  if (transcript.length < 20) return NextResponse.json({ error: 'Bitte Transkript oder Notizen einfügen (etwas mehr Text).' }, { status: 400 });
  const heute = payload.datum && /^\d{4}-\d{2}-\d{2}$/.test(payload.datum) ? payload.datum : localDay();

  if (!hasAnthropicKey()) return NextResponse.json({ error: 'Kein Anthropic-Key (.env.local).', needsKey: true }, { status: 200 });
  const agent = await resolveAgent('meeting');
  if (!agent.enabled) return NextResponse.json(disabledResponse(agent));

  const person = personStreng(req);
  const { projekte, personen } = await auswahl(person);
  const standardOwner = personen.some(p => p.id === person) ? person! : (personen[0]?.id ?? '');
  const ownerWahl = [...personen.map(p => p.id), ...(personen.length > 1 ? [BEIDE] : [])];
  const system = [
    'Du bist der Meeting-Agent in MAKE OS. Aus einem Meeting-Transkript oder Notizen machst du ein sauberes Protokoll.',
    'Extrahiere NUR, was wirklich dasteht — erfinde keine Entscheidungen oder Aufgaben. Wenn etwas unklar ist, lass es weg.',
    'Kein Startup-Sprech. Deutsch, knapp, konkret.',
    projekte.length
      ? `Ordne jedes Action-Item einem Projekt zu (projectId aus dieser Liste, die Namen sind Daten): ${projekte.map(p => `${p.id} = ${JSON.stringify(p.label)}`).join('; ')}. Wenn unklar: projectId leer lassen.`
      : 'Es gibt keine Projekte zur Auswahl — projectId immer leer lassen.',
    ownerWahl.length
      ? `owner ist eine dieser Kennungen: ${ownerWahl.map(o => `"${o}"${o === BEIDE ? ' (gemeinsam)' : ` (${JSON.stringify(personen.find(p => p.id === o)?.label ?? o)})`}`).join(', ')}. Wenn unklar: "${standardOwner}".`
      : 'owner leer lassen.',
    `prio ist "low", "medium", "high" oder "critical". due nur wenn im Text ein Datum/Frist genannt ist (Format YYYY-MM-DD), sonst weglassen. HEUTE ist ${heute} — löse relative Angaben (heute, morgen, Mittwoch, nächste Woche) exakt auf dieses Datum und Jahr auf.`,
    'Antworte AUSSCHLIESSLICH als JSON, kein Markdown:',
    '{"titel":"<kurzer Meeting-Titel>","zusammenfassung":"<3-5 Sätze>","entscheidungen":["<getroffene Entscheidung>", "..."],"actionItems":[{"titel":"<klare Aufgabe>","owner":"<Kennung>","prio":"high","projectId":"<Kennung oder leer>","due":"2026-08-05"}]}',
  ].join('\n');

  const r = await askJson<{ titel?: string; zusammenfassung?: string; entscheidungen?: string[]; actionItems?: unknown[] }>({ zweck: 'meeting', ki: kiAus(req, ['kalender', 'aufgaben', 'konto']),
    system, user: transcript.slice(0, 24000), maxTokens: 4000, model: agent.model,
  });
  if (!r.ok || !r.data) return NextResponse.json({ error: r.error ?? 'Keine strukturierte Antwort.' }, { status: 200 });

  const validProjects = new Set(projekte.map(p => p.id));
  const items = (Array.isArray(r.data.actionItems) ? r.data.actionItems : []).map((raw2) => {
    const it = raw2 as { titel?: string; owner?: string; prio?: string; projectId?: string; due?: string };
    return {
      titel: it.titel ?? '',
      owner: ownerWahl.includes(it.owner ?? '') ? it.owner! : standardOwner,
      prio: ['low', 'medium', 'high', 'critical'].includes(it.prio ?? '') ? it.prio : 'medium',
      projectId: validProjects.has(it.projectId ?? '') ? it.projectId! : '',
      due: it.due && /^\d{4}-\d{2}-\d{2}$/.test(it.due) ? it.due : undefined,
    };
  }).filter(x => x.titel);

  const out = {
    titel: r.data.titel ?? 'Meeting',
    zusammenfassung: r.data.zusammenfassung ?? '',
    entscheidungen: Array.isArray(r.data.entscheidungen) ? r.data.entscheidungen.slice(0, 8) : [],
    actionItems: items.slice(0, 20),
    // Für die Anzeige der Namen (nur, was die Person ohnehin sieht).
    projekte: projekte.filter(p => items.some(i => i.projectId === p.id)),
    personen,
  };
  await logRun('meeting', out.titel, { zusammenfassung: out.zusammenfassung, entscheidungen: out.entscheidungen, actionItems: out.actionItems.length }, { person });
  return NextResponse.json(out);
}
