// ─── MAKE OS — An/Aus-Modus (lokal) ─────────────────────────────────────────
// Kevins Arbeits-Schalter: morgens AN, abends AUS. Misst ehrlich, wie viel
// aktiv gearbeitet wird — und ob abends wirklich ausgeloggt wurde.
// Log: { "YYYY-MM-DD": { sessions: [{ von: "HH:MM", bis: "HH:MM"|null }] } }

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Session { von: string; bis: string | null }
type ModusLog = Record<string, { sessions: Session[] }>;

const jetztHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const min = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

function tagesStand(log: ModusLog, tag: string) {
  const sessions = log[tag]?.sessions ?? [];
  const offen = sessions.find(s => s.bis === null) ?? null;
  const nun = min(jetztHM());
  const aktivMin = sessions.reduce((s, x) => {
    const ende = x.bis === null ? nun : min(x.bis);
    return s + Math.max(0, ende - min(x.von));
  }, 0);
  return { date: tag, an: !!offen, seit: offen?.von ?? null, aktivMin, sessions };
}

// Zwei Zähler, ein Muster: Arbeitszeit ('arbeitsmodus') und Gesundheits-Zeit
// ('gesundheitszeit' — Reha, Bewegung, Erholung; Kevins zweiter Schalter oben).
const STORE_VON: Record<string, string> = { arbeit: 'arbeitsmodus', gesundheit: 'gesundheitszeit' };

export async function GET() {
  const [aLog, gLog] = await Promise.all([
    loadJson<ModusLog>('arbeitsmodus'),
    loadJson<ModusLog>('gesundheitszeit'),
  ]);
  const heute = localDay();
  return NextResponse.json({ heute: tagesStand(aLog ?? {}, heute), gesundheit: tagesStand(gLog ?? {}, heute) });
}

/** POST { aktion: 'an' | 'aus', was?: 'arbeit' | 'gesundheit' } — schaltet den jeweiligen Zähler. */
export async function POST(req: Request) {
  let body: { aktion?: string; was?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.aktion !== 'an' && body.aktion !== 'aus') {
    return NextResponse.json({ ok: false, error: 'aktion an|aus nötig.' }, { status: 400 });
  }
  const store = STORE_VON[body.was ?? 'arbeit'] ?? 'arbeitsmodus';
  const heute = localDay();
  const next = await updateJson<ModusLog>(store, current => {
    const log: ModusLog = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    // Vergessene offene Sessions vergangener Tage ehrlich um 23:59 schließen.
    for (const tag of Object.keys(log)) {
      if (tag !== heute) for (const s of log[tag].sessions) if (s.bis === null) s.bis = '23:59';
    }
    const tag = log[heute] ?? (log[heute] = { sessions: [] });
    const offen = tag.sessions.find(s => s.bis === null);
    if (body.aktion === 'an' && !offen) tag.sessions.push({ von: jetztHM(), bis: null });
    if (body.aktion === 'aus' && offen) offen.bis = jetztHM();
    // Nur die letzten 60 Tage behalten.
    const keys = Object.keys(log).sort().slice(-60);
    const behalten: ModusLog = {};
    for (const k of keys) behalten[k] = log[k];
    return behalten;
  });
  return NextResponse.json({ ok: true, heute: tagesStand(next, heute) });
}
