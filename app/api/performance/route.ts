// ─── MAKE OS — Performance-Index ────────────────────────────────────────────
// GET            → aktueller Index (aus echten Daten) + Verlauf
// POST {}        → Tages-Schnappschuss festhalten (einmal pro Tag genug)
// POST {analyse} → zusätzlich: MAKE ordnet die Lage ein und benennt den Hebel

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { askJson, hasAnthropicKey } from '@/lib/anthropic';
import { logRun } from '@/lib/agent-log';
import { computeIndex } from '@/lib/performance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PerfSnapshot {
  date: string;
  index: number | null;
  saeulen: Record<string, number | null>;
  abdeckung: number;
}
interface PerfFile { snapshots: PerfSnapshot[] }

const MAX = 180; // gut ein halbes Jahr Verlauf

async function history(): Promise<PerfSnapshot[]> {
  const f = await loadJson<PerfFile>('performance');
  return Array.isArray(f?.snapshots) ? f.snapshots : [];
}

export async function GET() {
  const [aktuell, verlauf] = await Promise.all([computeIndex(), history()]);
  // Der Verlauf wächst von selbst: der ERSTE Aufruf des Tages hält den Punkt
  // fest (idempotent — spätere GETs schreiben nicht; POST/Analyse erneuert).
  if (aktuell.index != null && !verlauf.some(s => s.date === aktuell.stand)) {
    const snap: PerfSnapshot = {
      date: aktuell.stand,
      index: aktuell.index,
      saeulen: Object.fromEntries(aktuell.saeulen.map(s => [s.key, s.score])),
      abdeckung: aktuell.abdeckung,
    };
    const file = await updateJson<PerfFile>('performance', current => {
      const list = Array.isArray(current?.snapshots) ? current.snapshots : [];
      if (list.some(s => s.date === snap.date)) return { snapshots: list };
      return { snapshots: [...list, snap].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX) };
    });
    return NextResponse.json({ aktuell, verlauf: file.snapshots });
  }
  return NextResponse.json({ aktuell, verlauf });
}

export async function POST(req: Request) {
  let body: { analyse?: boolean } = {};
  try { body = await req.json(); } catch { /* ohne Body ist ok */ }

  const aktuell = await computeIndex();

  // Schnappschuss für heute — ein Eintrag pro Tag, spätere überschreiben.
  const snap: PerfSnapshot = {
    date: aktuell.stand,
    index: aktuell.index,
    saeulen: Object.fromEntries(aktuell.saeulen.map(s => [s.key, s.score])),
    abdeckung: aktuell.abdeckung,
  };
  const file = await updateJson<PerfFile>('performance', current => {
    const list = Array.isArray(current?.snapshots) ? current.snapshots : [];
    const ohneHeute = list.filter(s => s.date !== snap.date);
    return { snapshots: [...ohneHeute, snap].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX) };
  });

  if (!body.analyse) return NextResponse.json({ aktuell, verlauf: file.snapshots });
  if (!hasAnthropicKey()) return NextResponse.json({ aktuell, verlauf: file.snapshots, error: 'Kein Anthropic-Key.' });

  // ── Einordnung: nur interpretieren, nicht rechnen ──
  const vorher = file.snapshots.filter(s => s.date < snap.date).slice(-1)[0];
  const saeulenText = aktuell.saeulen.map(s => {
    const faktoren = s.faktoren.map(f => `    · ${f.label}: ${f.echt ? `${f.wert} (${f.quelle})` : `KEINE DATEN (${f.quelle})`}`).join('\n');
    return `- ${s.label} (Gewicht ${Math.round(s.gewicht * 100)}%): ${s.score ?? 'keine Daten'}${s.score != null ? `, Datenbasis ${Math.round(s.abdeckung * 100)}%` : ''}\n${faktoren}`;
  }).join('\n');

  const system = [
    'Du bist JARVIS, Kevins zentrale Intelligenz und Chief of Staff. Du ordnest seinen Performance-Index ein.',
    'Nordstern: 1 Mio € Umsatz KD Ventures → min. 300k € Gewinn. Persönliches Ziel: mehr Ruhe, Rücken in Reha.',
    'Du bekommst FERTIG GERECHNETE Werte — rechne nichts nach, erfinde nichts.',
    'WICHTIG: Faktoren ohne Daten sind KEINE schlechten Werte, sondern eine Messlücke. Behandle sie als „wissen wir nicht" und sag, was Kevin eintragen müsste, damit die Zahl echt wird.',
    'Sei nüchtern und konkret. Kein Startup-Sprech. Gesundheitsdaten sind privat.',
    'Antworte NUR als JSON: {"lage":"<2-3 Sätze: wo steht er wirklich, wie belastbar ist die Zahl>","hebel":{"saeule":"<Name>","warum":"<1-2 Sätze>","schritt":"<EINE konkrete Handlung diese Woche>"},"staerke":"<1 Satz: was trägt>","messluecke":"<1 Satz: was fehlt, damit der Index ehrlich misst — leer wenn nichts fehlt>"}',
  ].join('\n');

  const user = [
    `Stand ${aktuell.stand}. Index: ${aktuell.index ?? 'nicht berechenbar'} (${aktuell.label}).`,
    `Datenbasis insgesamt: ${Math.round(aktuell.abdeckung * 100)}% — so viel des Index steht auf echten Daten.`,
    vorher ? `Vorheriger Stand (${vorher.date}): ${vorher.index}.` : 'Kein früherer Stand zum Vergleich.',
    '',
    'SÄULEN:',
    saeulenText,
  ].join('\n');

  const r = await askJson<Record<string, unknown>>({ system, user, maxTokens: 3000 });
  if (!r.ok || !r.data) return NextResponse.json({ aktuell, verlauf: file.snapshots, error: r.error ?? 'Analyse fehlgeschlagen.' });

  await logRun('performance', `Index ${aktuell.index ?? '—'} (${aktuell.stand})`, { index: aktuell.index, ...r.data });
  return NextResponse.json({ aktuell, verlauf: file.snapshots, ...r.data });
}
