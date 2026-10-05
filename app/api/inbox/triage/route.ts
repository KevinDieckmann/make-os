// ─── MAKE OS — Inbox-Triage (ZOE sortiert vor) ───────────────────────────
// POST { nachrichten: [{ fp, sender, subject, account, preview? }] }
// ZOE stuft jede Mail ein (wichtig | normal | rauschen) und fasst sie in
// einer Zeile zusammen — Kevin entscheidet nur noch. Ergebnisse werden je
// Mail-Fingerabdruck gecacht (.data/inbox-triage.json): jede Mail wird genau
// EINMAL eingestuft, egal wie oft die Inbox lädt.
// Basis: Absender + Betreff (+ Vorschau wenn da) — keine Mail-Bodies im Prompt.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt, imHaushaltOderSystemlauf } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey, fremd, FREMD_REGEL } from '@/lib/anthropic';
import { resolveAgent, disabledResponse } from '@/lib/agent-config';
import { logRun } from '@/lib/agent-log';
import { modellSchranke } from '@/lib/zugang/umfang';
import { teamFuerAnfrage } from '@/lib/make-one/team-speicher';
import { delegierbar } from '@/lib/make-one/team-typen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Stufe = 'wichtig' | 'normal' | 'rauschen';
interface Eintrag { stufe: Stufe; zeile: string; grund: string; at: string }
type TriageFile = Record<string, Eintrag>;
interface NachrichtIn { fp: string; sender: string; subject: string; account?: string; preview?: string }

const STUFEN: Stufe[] = ['wichtig', 'normal', 'rauschen'];

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return nurHaushalt();
  const f = (await loadJson<TriageFile>('inbox-triage')) ?? {};
  return NextResponse.json({ triage: f });
}

export async function POST(req: Request) {
  if (!(await imHaushaltOderSystemlauf(req))) return nurHaushalt();
  const schranke = modellSchranke(req); if (schranke) return schranke;
  let body: { nachrichten?: NachrichtIn[] };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const rein = (Array.isArray(body.nachrichten) ? body.nachrichten : [])
    .filter(n => n && typeof n.fp === 'string' && n.fp.length > 3)
    .slice(0, 60);
  if (!rein.length) return NextResponse.json({ ok: false, error: 'nachrichten nötig.' }, { status: 400 });

  const cache = (await loadJson<TriageFile>('inbox-triage')) ?? {};
  const neu = rein.filter(n => !cache[n.fp]);
  if (!neu.length) return NextResponse.json({ ok: true, triage: cache, neu: 0 });

  if (!hasAnthropicKey()) return NextResponse.json({ ok: false, error: 'Kein Anthropic-Key.', triage: cache }, { status: 200 });
  const agent = await resolveAgent('inbox');
  if (!agent.enabled) return NextResponse.json({ ...disabledResponse(agent), triage: cache });

  // Team zur Laufzeit aus den Daten (28.09., U4) — Namen nie im Code; leerer Speicher → Rollen-Platzhalter.
  const team = delegierbar(await teamFuerAnfrage(req)).map(t => (t.name !== t.kurz && t.quelle !== 'platzhalter' ? `${t.name} (${t.kurz})` : t.kurz)).join(', ');
  const system = [
    'Du bist ZOE und sortierst Kevins Post vor. Kevin ist Gründer (KEMARIS/POINCAP, KD Ventures, Kevin Dieckmann Consulting).',
    'Stufe jede Nachricht ein:',
    `- "wichtig": Kunden und Mandanten, Team (${team}), Geld/Verträge/Rechnungen, Steuerberater, Notariat, Rechtsanwalt, Inkasso, Banken, Behörden, Fristen.`,
    '- "rauschen": Newsletter, Marketing, Produkt-Updates, Social-Media-Benachrichtigungen, Werbung.',
    '- "normal": alles andere.',
    'Je Nachricht EINE Zeile (max. 12 Wörter, deutsch): was steckt drin bzw. was ist zu tun. Dazu ein Grund in 2–4 Wörtern.',
    'Antworte NUR als JSON: {"einstufungen":[{"fp":"…","stufe":"wichtig|normal|rauschen","zeile":"…","grund":"…"}]} — exakt die übergebenen fp-Werte.',
    FREMD_REGEL,
  ].join('\n');

  const user = neu.map(n =>
    `fp: ${n.fp}\n${fremd('mail', `Von: ${String(n.sender).slice(0, 120)} (${String(n.account ?? '').slice(0, 60)})\nBetreff: ${String(n.subject).slice(0, 160)}${n.preview ? `\nVorschau: ${String(n.preview).slice(0, 200)}` : ''}`)}`
  ).join('\n\n');

  const r = await askJson<{ einstufungen?: { fp?: string; stufe?: string; zeile?: string; grund?: string }[] }>({ zweck: 'inbox-triage',
    system, user, maxTokens: 5000, model: agent.model, timeoutMs: 120_000,
  });
  if (!r.ok || !r.data?.einstufungen) {
    return NextResponse.json({ ok: false, error: r.error ?? 'Keine Einstufung erhalten.', triage: cache }, { status: 200 });
  }

  const jetzt = new Date().toISOString();
  const gueltigeFp = new Set(neu.map(n => n.fp));
  const frisch: TriageFile = {};
  for (const e of r.data.einstufungen) {
    if (!e.fp || !gueltigeFp.has(e.fp)) continue;
    frisch[e.fp] = {
      stufe: STUFEN.includes(e.stufe as Stufe) ? e.stufe as Stufe : 'normal',
      zeile: String(e.zeile ?? '').slice(0, 160),
      grund: String(e.grund ?? '').slice(0, 60),
      at: jetzt,
    };
  }

  const next = await updateJson<TriageFile>('inbox-triage', current => {
    const f = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    const merged = { ...f, ...frisch };
    // Nur die letzten 500 Einträge behalten (älteste raus).
    const keys = Object.keys(merged).sort((a, b) => (merged[a].at ?? '').localeCompare(merged[b].at ?? ''));
    for (const k of keys.slice(0, Math.max(0, keys.length - 500))) delete merged[k];
    return merged;
  });

  await logRun('inbox', `Triage: ${Object.keys(frisch).length} Mails eingestuft`, {
    neu: Object.keys(frisch).length,
    wichtig: Object.values(frisch).filter(e => e.stufe === 'wichtig').length,
    rauschen: Object.values(frisch).filter(e => e.stufe === 'rauschen').length,
  });

  return NextResponse.json({ ok: true, triage: next, neu: Object.keys(frisch).length });
}
