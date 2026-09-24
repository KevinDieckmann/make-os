// ─── Familie & Partnerschaft — Schnittstelle ────────────────────────────────
// GET   → Bestand (gefiltert: fremde private Einträge nie), Pflege-Rhythmus,
//         nächstes Paar-Gespräch, wichtige Tage, fällige Kontakte, Frage der Woche
// PATCH → { ops: Einzeländerungen je Liste, felder: einstellungen|profil|vision|ritual }
// Nur Haushaltsmitglieder (haushaltVon, streng). Kein Business-Agent liest das.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { familieName, ladeFamilie, wendeFamilieAn, setzeFelder, startBestand } from '@/lib/familie/speicher';
import { pflegeRhythmus, naechstesGespraech, wichtigeTage, kontaktFaellig, sichtFuer, agendaVorbereiten } from '@/lib/familie/logik';
import { LOVEMAP_FRAGEN } from '@/lib/familie/katalog';
import { LISTEN, type Familie } from '@/lib/familie/typen';
import type { ListenOp } from '@/lib/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN = { ok: false, fehler: 'Familie & Partnerschaft gibt es nur für Konten mit Haushalt. Der Inhaber schaltet das unter System → Konto frei.' };

function sicht(f: Familie, person: string): Familie {
  const s = { ...f } as Familie & Record<string, unknown>;
  for (const l of LISTEN) (s as Record<string, unknown>)[l] = sichtFuer(f[l] as unknown as { von: string; sichtbarkeit?: string }[], person);
  // Reparatur: fremde Reflexionen erst, wenn sie geteilt sind.
  s.reparaturen = s.reparaturen.map(r => ({ ...r, reflexionen: r.reflexionen.filter(x => x.person === person || x.geteilt) }));
  return s;
}

function antwort(f: Familie, person: string) {
  const heute = heuteBerlin();
  const woche = Math.floor(Date.parse(`${heute}T12:00:00Z`) / (7 * 864e5));
  return {
    ok: true, person, familie: sicht(f, person),
    rhythmus: pflegeRhythmus(f, heute),
    gespraech: naechstesGespraech(f.einstellungen, heute, f.gespraeche),
    tage: wichtigeTage(f.tage, heute, 60),
    kontakte: kontaktFaellig(f.menschen, heute),
    frage: LOVEMAP_FRAGEN[woche % LOVEMAP_FRAGEN.length],
    agenda: agendaVorbereiten(f, heute, person),
    heute,
  };
}

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  return NextResponse.json(antwort(await ladeFamilie(z.haushalt), z.person));
}

export async function PATCH(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  let b: { ops?: ListenOp[]; felder?: Record<string, unknown> };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const jetzt = new Date().toISOString();
  let abgelehnt = 0, angewandt = 0;
  const f = await updateJson<Familie>(familieName(z.haushalt), cur => {
    let x = { ...startBestand(jetzt), ...(cur ?? {}) };
    const ops = (Array.isArray(b.ops) ? b.ops : []).slice(0, 200);
    if (ops.length) { const r = wendeFamilieAn(x, ops, z.person, jetzt); x = r.familie; abgelehnt = r.abgelehnt; angewandt = r.angewandt; }
    if (b.felder) x = setzeFelder(x, b.felder, z.person, jetzt);
    return x;
  });
  return NextResponse.json({ ...antwort(f, z.person), angewandt, abgelehnt });
}
