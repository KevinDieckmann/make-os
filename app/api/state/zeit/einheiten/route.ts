// ─── MAKE OS — Zeit & Fokus: Zeit je Business-Einheit (27.09. spät) ─────────
// GET ?zeitraum=woche|monat&stichtag=YYYY-MM-DD → Stunden je Selbstständigkeit ·
// KD Ventures · MAKE OS UG · eigene · ohne Einheit, je Person des Haushalts und
// gesamt, dazu die Top-Aufgaben je Einheit. Nur bewusste Business-Blöcke.
// Rechnung rein in lib/zeitmessung/einheiten.ts. Ohne Haushalt nur die eigene Zeit.
// Tempo: einmal je Haushalt/Zeitraum rechnen und merken (`merken`); der Schlüssel
// trägt den Stand der Blöcke, weil `zeit` Memo-Rauschen ist.

import { NextResponse } from 'next/server';
import { nameVon } from '@/lib/zoe/raum';
import { ladeKonten } from '@/lib/zugang/konten';
import { HAUSHALT_OK, personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { merken } from '@/lib/store/memo';
import { ladeZeit, aufgabenKurz, zeitBloeckeStand } from '@/lib/zeitmessung/speicher';
import { zeitJeEinheit, berlinTag, type Zeitraum } from '@/lib/zeitmessung/einheiten';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Die Personen, deren Zeit zusammen ausgewertet wird: der Haushalt der anfragenden Person, sonst nur sie selbst. */
async function personenVon(person: string): Promise<{ schluessel: string; personen: { person: string; name: string }[] }> {
  const konten = (await ladeKonten()).konten;
  const ich = konten.find(k => k.speicher === person);
  const name = (k?: { name: string }, p = person) => k?.name?.split(/\s+/)[0] || nameVon(p);
  const h = ich?.haushalt && HAUSHALT_OK.test(ich.haushalt) ? ich.haushalt : null;
  if (!h) return { schluessel: `p:${person}`, personen: [{ person, name: name(ich) }] };
  const mit = konten.filter(k => k.haushalt === h).map(k => ({ person: k.speicher, name: name(k, k.speicher) }));
  return { schluessel: `h:${h}`, personen: mit.length ? mit : [{ person, name: name(ich) }] };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const zeitraum: Zeitraum = url.searchParams.get('zeitraum') === 'monat' ? 'monat' : 'woche';
  const s = url.searchParams.get('stichtag');
  const stichtag = s && TAG.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`)) ? s : berlinTag(new Date().toISOString());
  // Nur für eine ausdrücklich benannte Person (Regel 5) — kein Rückfall auf „kevin“.
  const person = personStreng(req);
  if (!person) return NextResponse.json({ ok: false, error: 'Ohne angemeldete Person keine Zeitauswertung.' }, { status: 401 });
  const { schluessel, personen } = await personenVon(person);
  const daten = await merken(`zeit-einheiten:${schluessel}:${zeitraum}:${stichtag}:${zeitBloeckeStand()}`, 60_000, async () => {
    const [aufgaben, dateien] = await Promise.all([aufgabenKurz(), Promise.all(personen.map(p => ladeZeit(p.person)))]);
    return zeitJeEinheit(personen.map((p, i) => ({ ...p, datei: dateien[i] })), aufgaben, zeitraum, stichtag);
  });
  return NextResponse.json({ ok: true, ich: person, ...daten }, { headers: { 'Cache-Control': 'no-store' } });
}
