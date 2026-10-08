// ─── Familie & Partnerschaft — Schnittstelle ────────────────────────────────
// GET   → Bestand (gefiltert: fremde private Einträge nie), Pflege-Rhythmus,
//         nächstes Paar-Gespräch, wichtige Tage, fällige Kontakte, Frage der Woche
// PATCH → { ops: Einzeländerungen je Liste, felder: einstellungen|profil|vision|ritual }
//         Vision (08.10.): Einträge ändert/löscht nur ihre Anlegerin, sonst 403 (lib/familie/vision.ts).
// Nur Haushaltsmitglieder (haushaltVon, streng). Kein Business-Agent liest das.
// S1 (29.09.): mehr als OPS_MAX Einzeländerungen → 413 (vorher still auf 200 gekürzt); PATCH prüft die Bau-Kennung.

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { merken } from '@/lib/store/memo';
import { updateJson } from '@/lib/store/local-db';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { familieName, ladeFamilie, wendeFamilieAn, setzeFelder, startBestand } from '@/lib/familie/speicher';
import { pflegeRhythmus, naechstesGespraech, wichtigeTage, kontaktFaellig, sichtFuer, agendaVorbereiten } from '@/lib/familie/logik';
import { LOVEMAP_FRAGEN } from '@/lib/familie/katalog';
import { LISTEN, type Familie } from '@/lib/familie/typen';
import { VisionVerboten } from '@/lib/familie/vision';
import type { ListenOp } from '@/lib/sync';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { familieSpiegelNachziehen, spiegelHinweiseMelden } from '@/lib/kalender/spiegel-server';

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

/** Wer gehört zum Haushalt — für Namen und die Wahl „wer plant, wer trägt“. */
async function mitglieder(haushalt: string) {
  const k = await ladeKonten();
  return k.konten.filter(x => x.haushalt === haushalt).map(x => ({ person: x.speicher, name: x.name.split(' ')[0] || x.speicher }));
}

/**
 * Die Antwort für `person`. Der Sicht-Filter läuft EINMAL hier am Anfang (Praxis-Fund 04.10.: `wichtigeTage` und die Agenda
 * bekamen den ROHEN Bestand → „nur ich“-Einträge der Partnerin standen im Klartext in der Antwort). Jede Ableitung bekommt
 * nur noch den gefilterten Bestand `s` — den rohen `f` sieht hier nichts mehr.
 */
async function antwort(f: Familie, person: string, haushalt: string) {
  const s = sicht(f, person);
  // Archiv (04.10., components/os/familie/ablage.tsx): Erinnerungen, fällige Menschen und Agenda rechnen ohne Archiviertes —
  // der Bestand selbst (`familie`) trägt es weiter, damit die Listen es unter „Archiv“ zeigen.
  const ohneArchiv = <T extends { archiviertAm?: string }>(l: T[]) => l.filter(x => !x.archiviertAm);
  const a = { ...s, tage: ohneArchiv(s.tage), menschen: ohneArchiv(s.menschen), themen: ohneArchiv(s.themen), wuensche: ohneArchiv(s.wuensche), rituale: ohneArchiv(s.rituale), ideen: ohneArchiv(s.ideen) };
  const heute = heuteBerlin();
  const woche = Math.floor(Date.parse(`${heute}T12:00:00Z`) / (7 * 864e5));
  return {
    ok: true, person, familie: s,
    rhythmus: pflegeRhythmus(s, heute),
    gespraech: naechstesGespraech(s.einstellungen, heute, s.gespraeche),
    tage: wichtigeTage(a.tage, heute, 60, s.menschen),
    kontakte: kontaktFaellig(a.menschen, heute),
    frage: LOVEMAP_FRAGEN[woche % LOVEMAP_FRAGEN.length],
    agenda: agendaVorbereiten(a, heute, person),
    mitglieder: await mitglieder(haushalt),
    heute,
  };
}

async function spiegelNachziehen(haushalt: string, person: string): Promise<void> {
  try {
    if (haushalt !== await haushaltDesInhabers()) return;
    // F1 #5: Einträge, die nicht gingen, melden (Server-Protokoll + Glocke der Person) — nie mehr still.
    await spiegelHinweiseMelden(await familieSpiegelNachziehen(haushalt, { art: 'person', person }), person);
  } catch (e) {
    // Die Änderung in der Familie steht — der Spiegel wird beim nächsten Mal nachgezogen. Protokoll ohne Inhalte.
    console.warn(`[spiegel] Familie nicht nachgezogen: ${e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler'}`);
  }
}

/** Größte Zahl Einzeländerungen je PATCH — darüber 413, nie still gekürzt. */
const OPS_MAX = 200;

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  return NextResponse.json(await merken(`familie:${z.haushalt}:${z.person}`, 30_000, async () => antwort(await ladeFamilie(z.haushalt), z.person, z.haushalt)));
}

export async function PATCH(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN, { status: 403 });
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  let b: { ops?: ListenOp[]; felder?: Record<string, unknown> };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (Array.isArray(b.ops) && b.ops.length > OPS_MAX) return NextResponse.json({ ok: false, fehler: `Höchstens ${OPS_MAX} Änderungen auf einmal.` }, { status: 413 });
  const jetzt = new Date().toISOString();
  let abgelehnt = 0, angewandt = 0;
  let f: Familie;
  try {
    f = await updateJson<Familie>(familieName(z.haushalt), cur => {
      let x = { ...startBestand(jetzt), ...(cur ?? {}) };
      const ops = Array.isArray(b.ops) ? b.ops : [];
      if (ops.length) { const r = wendeFamilieAn(x, ops, z.person, jetzt); x = r.familie; abgelehnt = r.abgelehnt; angewandt = r.angewandt; }
      if (b.felder) x = setzeFelder(x, b.felder, z.person, jetzt);
      return x;
    });
  } catch (e) {
    // Vision (08.10., Kevin): fremde Einträge ändert/löscht nur ihre Anlegerin — abgelehnt, NICHTS gespeichert (auch nicht die Ops).
    if (e instanceof VisionVerboten) return NextResponse.json({ ok: false, fehler: e.message }, { status: 403 });
    throw e;
  }
  // Spiegel im Kalender nachziehen (29.09., K5): Date verschoben/abgesagt, Gespräch ausgefallen, Uhrzeit/Wochentag
  // geändert → der iCloud-Termin folgt (lib/kalender/spiegel-server.ts). Im Hintergrund; nur die Familie des Inhabers.
  if ((Array.isArray(b.ops) && b.ops.some(o => o?.liste === 'dates' || o?.liste === 'gespraeche')) || (b.felder && 'einstellungen' in b.felder)) void spiegelNachziehen(z.haushalt, z.person);
  return NextResponse.json({ ...(await antwort(f, z.person, z.haushalt)), angewandt, abgelehnt });
}
