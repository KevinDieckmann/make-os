// ─── MAKE OS — Meeting-Verlauf ──────────────────────────────────────────────
// Kevins Ansage: „Ich würde gerne einen kleinen Skriptverlauf haben, dass jedes
// einzelne Skript, wo wir drin waren, dahintergelegt ist — abgeglichen mit dem
// Kalender und den Terminen."
//
// Bisher war jedes Protokoll nach der Sitzung weg. Jetzt bleibt es liegen, mit
// dem Termin verknüpft, aus dem es stammt. Gepflegt wird der Termin weiter im
// Apple-Kalender — MAKE OS liest ihn nur und hängt das Protokoll daran.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Punkt { text: string; wer?: string; frist?: string }
export interface Meeting {
  id: string;
  /** YYYY-MM-DD */
  datum: string;
  titel: string;
  /** Der Termin aus dem Kalender, zu dem das Protokoll gehört. */
  terminId?: string;
  terminTitel?: string;
  /** Das Skript, aus dem gelesen wurde — gekürzt, aber nachlesbar. */
  transcript?: string;
  zusammenfassung?: string;
  entscheidungen?: string[];
  aufgaben?: Punkt[];
  angelegt: string;
}
interface Datei { meetings: Meeting[] }

const GRENZE = 200;
const text = (v: unknown, n = 200) => String(v ?? '').trim().slice(0, n);
const tag = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date().toISOString().slice(0, 10));

function sauber(m: Partial<Meeting>, i: number): Meeting | null {
  const titel = text(m.titel, 160);
  const zus = text(m.zusammenfassung, 2000);
  if (!titel && !zus) return null;
  return {
    id: text(m.id, 40) || `mt-${Date.now().toString(36)}-${i}`,
    datum: tag(m.datum),
    titel: titel || 'Meeting',
    terminId: m.terminId ? text(m.terminId, 120) : undefined,
    terminTitel: m.terminTitel ? text(m.terminTitel, 160) : undefined,
    transcript: m.transcript ? text(m.transcript, 20000) : undefined,
    zusammenfassung: zus || undefined,
    entscheidungen: (Array.isArray(m.entscheidungen) ? m.entscheidungen : []).slice(0, 30).map(x => text(x, 400)).filter(Boolean),
    aufgaben: (Array.isArray(m.aufgaben) ? m.aufgaben : []).slice(0, 40).map(p => ({
      text: text(p?.text, 300),
      wer: p?.wer ? text(p.wer, 60) : undefined,
      frist: p?.frist ? text(p.frist, 40) : undefined,
    })).filter(p => p.text),
    angelegt: typeof m.angelegt === 'string' ? m.angelegt : new Date().toISOString(),
  };
}

export async function GET() {
  const f = await loadJson<Datei>('meetings');
  const meetings = (Array.isArray(f?.meetings) ? f.meetings : [])
    .slice().sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''));
  return NextResponse.json({ meetings, anzahl: meetings.length });
}

/** Ein Protokoll anhängen oder aktualisieren — die übrigen bleiben unberührt. */
export async function POST(req: Request) {
  let body: Partial<Meeting>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const m = sauber(body, 0);
  if (!m) return NextResponse.json({ ok: false, error: 'Weder Titel noch Zusammenfassung.' }, { status: 400 });

  const next = await updateJson<Datei>('meetings', current => {
    const f = current ?? { meetings: [] };
    f.meetings = Array.isArray(f.meetings) ? f.meetings : [];
    const i = f.meetings.findIndex(x => x.id === m.id);
    if (i >= 0) f.meetings[i] = { ...f.meetings[i], ...m };
    else f.meetings.push(m);
    f.meetings.sort((a, b) => (b.datum ?? '').localeCompare(a.datum ?? ''));
    f.meetings = f.meetings.slice(0, GRENZE);
    return f;
  });
  return NextResponse.json({ ok: true, id: m.id, anzahl: next.meetings.length });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id fehlt.' }, { status: 400 });
  const next = await updateJson<Datei>('meetings', current => {
    const f = current ?? { meetings: [] };
    f.meetings = (f.meetings ?? []).filter(m => m.id !== id);
    return f;
  });
  return NextResponse.json({ ok: true, anzahl: next.meetings.length });
}
