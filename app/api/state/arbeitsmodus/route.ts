// ─── MAKE OS — An/Aus-Modus (lokal) ─────────────────────────────────────────
// Der Arbeits-Schalter: morgens AN, abends AUS. Misst ehrlich, wie viel
// aktiv gearbeitet wird — und ob abends wirklich ausgeloggt wurde.
// Log: { "YYYY-MM-DD": { sessions: [{ von: "HH:MM", bis: "HH:MM"|null }] } }
// 08.10. spät (Datenschutz vor dem Upload): beide Zähler JE PERSON (`arbeitsmodus--<person>`, `gesundheitszeit--<person>`,
// Gesundheitszeit = Art. 9) — vorher ein Bestand für alle Konten. Der Altbestand ohne Suffix gehört nur dem Inhaber
// (`eigenerSpeicher`); jede Person liest und schaltet nur ihre eigenen Zähler.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { eigenerSpeicher } from '@/lib/zoe/raum';
import { inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';

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
// ('gesundheitszeit' — Bewegung, Erholung; der zweite Schalter oben).
const STORE_VON: Record<string, string> = { arbeit: 'arbeitsmodus', gesundheit: 'gesundheitszeit' };
/** Bestand der Person (je Person, Altbestand ohne Suffix nur beim Inhaber). */
const bestand = async (basis: string, person: string) => eigenerSpeicher(basis, person, await inhaberSpeicher());

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const [aLog, gLog] = await Promise.all([
    loadJson<ModusLog>(await bestand('arbeitsmodus', z.person)),
    loadJson<ModusLog>(await bestand('gesundheitszeit', z.person)),
  ]);
  const heute = localDay();
  return NextResponse.json({ heute: tagesStand(aLog ?? {}, heute), gesundheit: tagesStand(gLog ?? {}, heute) });
}

/** POST { aktion: 'an' | 'aus', was?: 'arbeit' | 'gesundheit' } — schaltet den jeweiligen Zähler. */
export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  let body: { aktion?: string; was?: string };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.aktion !== 'an' && body.aktion !== 'aus') {
    return NextResponse.json({ ok: false, error: 'aktion an|aus nötig.' }, { status: 400 });
  }
  const store = await bestand(STORE_VON[body.was ?? 'arbeit'] ?? 'arbeitsmodus', z.person);
  const heute = localDay();
  const next = await updateJson<ModusLog>(store, current => {
    const log: ModusLog = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
    // Vergessene offene Sessions vergangener Tage ehrlich um 23:59 schließen.
    for (const tagKey of Object.keys(log)) {
      // Ein Tages-Eintrag ohne sessions (Altformat, von Hand editiert) darf
      // die Route nicht abstürzen lassen — der Schalter wäre sonst dauerhaft
      // kaputt, weil jeder Aufruf über diese Zeile läuft.
      const eintrag = log[tagKey];
      if (!eintrag || !Array.isArray(eintrag.sessions)) { log[tagKey] = { sessions: [] }; continue; }
      if (tagKey !== heute) for (const s of eintrag.sessions) if (s.bis === null) s.bis = '23:59';
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
