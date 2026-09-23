// ─── MAKE OS — Journal (lokal, dein Datenweg) ───────────────────────────────
// Ein Eintrag pro Tag: Text + Tages-Check (Stimmung/Energie/Stress/Symptome).
// So entstehen über Zeit echte Daten, um den Weg immer wieder anzupassen.

import { NextResponse } from 'next/server';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { personAus, ansichtPerson, darfGesundheitSehen, speicherFuer } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface JournalEntry {
  text?: string;
  /** Die drei Abendfragen (seit 23.09.): was lief gut, wofür dankbar, wo hart zu dir. */
  gut?: string;
  dankbar?: string;
  hart?: string;
  mood?: number;   // 1–5
  energy?: number; // 1–5
  stress?: number; // 1–5
  haut?: string;   // 'ruhig' | 'schub'
  ruecken?: string;// 'ok' | 'schmerz'
  flags?: string[];// z.B. antiinflamm, bewegt, cannabis, gutgeschlafen
  at?: string;
}
export type Journal = Record<string, JournalEntry>;

export async function GET(req: Request) {
  // Das Journal ist der persönlichste Bestand überhaupt — je Person getrennt.
  // Lesen dürfen sich beide gegenseitig (?fuer=, Kevins Entscheidung 23.09.).
  const person = ansichtPerson(req);
  if (!(await darfGesundheitSehen(req, person))) return NextResponse.json({ error: 'Diese Person teilt ihre Gesundheitsdaten nicht mit dir.' }, { status: 403 });
  const journal = (await loadJson<Journal>(speicherFuer('journal', person))) ?? {};
  return NextResponse.json({ journal });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const j = body as Journal;
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    return NextResponse.json({ ok: false, error: 'Ungültiges Journal.' }, { status: 400 });
  }
  // Schrumpf-Wächter: verliert der neue Bestand mehr als die Hälfte der Tage,
  // ist das fast immer ein Client-Fehler — nicht still überschreiben.
  const speicher = speicherFuer('journal', personAus(req));
  const bisher = (await loadJson<Record<string, unknown>>(speicher)) ?? {};
  const alt = Object.keys(bisher).length;
  const neu = Object.keys(j).length;
  if (alt >= 6 && neu < alt / 2) {
    return NextResponse.json({ ok: false, error: `Verweigert: der neue Stand hätte ${neu} statt ${alt} Tagen — sieht nach Datenverlust aus. Sicherung liegt unter .data/backup/.` }, { status: 409 });
  }
  await saveJson(speicher, j);
  return NextResponse.json({ ok: true });
}

/** PATCH { datum?, eintrag } → einen Tag zusammenführen. Für die drei Fragen
 *  auf der Gesundheitsseite: ein Feld, ein Aufruf — der Schrumpf-Wächter des
 *  PUT ist hier überflüssig, weil nie ein ganzer Bestand geschickt wird. */
export async function PATCH(req: Request) {
  let b: { datum?: string; eintrag?: Partial<JournalEntry> };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const datum = b.datum && /^\d{4}-\d{2}-\d{2}$/.test(b.datum) ? b.datum : new Date().toISOString().slice(0, 10);
  const e = b.eintrag ?? {};
  const t = (v: unknown, n: number) => { const s = String(v ?? '').trim().slice(0, n); return s || undefined; };
  const z = (v: unknown) => { const n = Number(v); return isFinite(n) && n >= 1 && n <= 5 ? Math.round(n) : undefined; };
  const neu: Partial<JournalEntry> = {
    ...(t(e.gut, 800) ? { gut: t(e.gut, 800) } : {}), ...(t(e.dankbar, 800) ? { dankbar: t(e.dankbar, 800) } : {}),
    ...(t(e.hart, 800) ? { hart: t(e.hart, 800) } : {}), ...(t(e.text, 2000) ? { text: t(e.text, 2000) } : {}),
    ...(z(e.mood) ? { mood: z(e.mood) } : {}), ...(z(e.energy) ? { energy: z(e.energy) } : {}), ...(z(e.stress) ? { stress: z(e.stress) } : {}),
  };
  if (!Object.keys(neu).length) return NextResponse.json({ ok: false, error: 'Nichts zum Eintragen.' }, { status: 400 });
  const { updateJson } = await import('@/lib/store/local-db');
  const log = await updateJson<Journal>(speicherFuer('journal', personAus(req)), current => {
    const j = current ?? {};
    return { ...j, [datum]: { ...(j[datum] ?? {}), ...neu, at: new Date().toISOString() } };
  });
  return NextResponse.json({ ok: true, datum, eintrag: log[datum] });
}
