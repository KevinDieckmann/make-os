// ─── MAKE OS — Änderungsprotokoll ───────────────────────────────────────────
// Kevin und Malin arbeiten in einer Instanz. Wenn etwas anders aussieht als
// gestern, muss man sehen können, wer es geändert hat — sonst wird geraten.
//
// Bewusst schmal: Zeitpunkt, Person, welcher Bestand, von welcher Seite aus.
// KEINE Inhalte. Das Protokoll soll Fragen beantworten („wer hat die Zahlungen
// angefasst?"), nicht die Daten ein zweites Mal speichern.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Eintrag {
  at: string;
  person: string;
  /** Welcher Bestand — z. B. „finanzplan". */
  bestand: string;
  /** Von welcher Seite aus ausgelöst. */
  seite?: string;
  /** PUT, POST oder DELETE. */
  art: string;
}
interface Datei { eintraege: Eintrag[] }

const GRENZE = 400;

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const nur = p.get('bestand');
  const f = await loadJson<Datei>('aenderungen');
  let eintraege = (Array.isArray(f?.eintraege) ? f.eintraege : []).slice().reverse();
  if (nur) eintraege = eintraege.filter(e => e.bestand === nur);
  return NextResponse.json({ eintraege: eintraege.slice(0, 120), anzahl: eintraege.length });
}

export async function POST(req: Request) {
  let body: Partial<Eintrag>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const bestand = String(body.bestand ?? '').slice(0, 60);
  if (!bestand) return NextResponse.json({ ok: true, ignoriert: true });

  await updateJson<Datei>('aenderungen', current => {
    const f = current ?? { eintraege: [] };
    f.eintraege = Array.isArray(f.eintraege) ? f.eintraege : [];
    const neu: Eintrag = {
      at: new Date().toISOString(),
      person: body.person === 'malin' ? 'Malin' : 'Kevin',
      bestand,
      seite: body.seite ? String(body.seite).slice(0, 80) : undefined,
      art: String(body.art ?? 'PUT').slice(0, 8),
    };
    // Ein Speichervorgang je Sekunde und Bestand reicht — sonst füllt das
    // getippte Feld mit Auto-Speichern das Protokoll mit Rauschen.
    const letzter = f.eintraege[f.eintraege.length - 1];
    if (letzter && letzter.bestand === neu.bestand && letzter.person === neu.person
      && Date.now() - new Date(letzter.at).getTime() < 60_000) {
      f.eintraege[f.eintraege.length - 1] = neu;
    } else {
      f.eintraege.push(neu);
    }
    if (f.eintraege.length > GRENZE) f.eintraege = f.eintraege.slice(-GRENZE);
    return f;
  });
  return NextResponse.json({ ok: true });
}
