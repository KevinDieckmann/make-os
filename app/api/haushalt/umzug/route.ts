// ─── Umzug aus Malins Cockpit: Probelauf und Übernahme ──────────────────────
// POST { schritt: 'probe', email, passwort }
//   liest ALLES aus Supabase (blätternd, exakt gezählt), legt die Rohdaten
//   als Archiv ab (.data/archiv, nur für diesen Rechner lesbar) und schreibt
//   in einen PROBE-Haushalt — der echte bleibt unberührt. Antwort: Bericht.
// POST { schritt: 'uebernehmen' }
//   übernimmt genau das Geprüfte in den echten Haushalt. In MAKE OS schon
//   Bearbeitetes wird nicht überschrieben, nur in MAKE OS Angelegtes bleibt.
// GET → Stand: gibt es einen Probelauf, was sagt sein Bericht.
//
// Das Passwort geht nur an Supabase. Es wird weder gespeichert noch geloggt.

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { loadJson, saveJson } from '@/lib/store/local-db';
import { haushaltVon, KEIN_ZUGANG } from '@/lib/finanzen/haushalt/zugriff';
import { ladeHaushalt, setzeHaushalt, aendereMeta } from '@/lib/finanzen/haushalt/speicher';
import { verbindungAusUmgebung, ausSupabaseLesen, zusammenfuehren, type Umzugsbericht } from '@/lib/finanzen/haushalt/supabase-umzug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Stand { bericht: Umzugsbericht; zeit: string; wer: string; archiv: string; uebernommen?: { zeit: string; wer: string; ergebnis: Record<string, Record<string, number>> } }
const standName = (h: string) => `haushalt-umzug--${h}`;
const probe = (h: string) => `${h}-probe`;

export async function GET(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const s = await loadJson<Stand>(standName(z.haushalt));
  return NextResponse.json({ ok: true, verbunden: !!verbindungAusUmgebung(), stand: s });
}

export async function POST(req: Request) {
  const z = await haushaltVon(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  let b: { schritt?: unknown; email?: unknown; passwort?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }

  if (b.schritt === 'probe') {
    const v = verbindungAusUmgebung();
    if (!v) return NextResponse.json({ ok: false, fehler: 'Die Adresse von Malins Cockpit fehlt in .env.local (MAKE_ORGA_URL, MAKE_ORGA_KEY).' }, { status: 400 });
    const email = String(b.email ?? '').trim(), passwort = String(b.passwort ?? '');
    if (!email || !passwort) return NextResponse.json({ ok: false, fehler: 'E-Mail und Passwort für Malins Cockpit fehlen.' }, { status: 400 });
    try {
      const { roh, haushalt, bericht } = await ausSupabaseLesen(v, email, passwort);
      const zeit = new Date().toISOString();
      const ordner = path.join(process.cwd(), '.data', 'archiv');
      await fs.mkdir(ordner, { recursive: true, mode: 0o700 });
      const archiv = path.join(ordner, `make-orga-supabase-${zeit.replace(/[:.]/g, '-')}.json`);
      await fs.writeFile(archiv, JSON.stringify({ _quelle: 'Supabase MAKE.ORGA', _gelesen: zeit, _von: z.person, ...roh }, null, 1), { mode: 0o600 });
      await setzeHaushalt(probe(z.haushalt), haushalt);
      await saveJson<Stand>(standName(z.haushalt), { bericht, zeit, wer: z.person, archiv: path.basename(archiv) });
      return NextResponse.json({ ok: true, bericht });
    } catch (err) {
      return NextResponse.json({ ok: false, fehler: err instanceof Error ? err.message : 'Lesen aus Supabase fehlgeschlagen.' }, { status: 400 });
    }
  }

  if (b.schritt === 'uebernehmen') {
    const s = await loadJson<Stand>(standName(z.haushalt));
    if (!s) return NextResponse.json({ ok: false, fehler: 'Erst einen Probelauf machen.' }, { status: 400 });
    const p = await ladeHaushalt(probe(z.haushalt));
    const e = await ladeHaushalt(z.haushalt);
    const ergebnis: Record<string, Record<string, number>> = {};
    const zf = <T extends { id: string; stand: number }>(name: string, echt: T[], neu: T[]) => { const r = zusammenfuehren(echt, neu); ergebnis[name] = { neu: r.neu, ersetzt: r.ersetzt, behalten: r.behalten, nurMakeOs: r.nurMakeOs }; return r.liste; };
    await setzeHaushalt(z.haushalt, {
      stamm: { konten: zf('konten', e.stamm.konten, p.stamm.konten), kategorien: zf('kategorien', e.stamm.kategorien, p.stamm.kategorien), regeln: zf('regeln', e.stamm.regeln, p.stamm.regeln), aliase: e.stamm.aliase },
      buchungen: zf('buchungen', e.buchungen, p.buchungen), schulden: zf('schulden', e.schulden, p.schulden),
      belege: zf('belege', e.belege, p.belege), planwerte: zf('planwerte', e.planwerte, p.planwerte),
    });
    const zeit = new Date().toISOString();
    await aendereMeta(z.haushalt, m => ({ ...m, umzug: { zeit, wer: z.person, ziel: z.haushalt, zaehlung: Object.fromEntries(Object.entries(ergebnis).map(([k, v]) => [k, v.neu + v.ersetzt + v.behalten + v.nurMakeOs])), supabase: Object.fromEntries(Object.entries(s.bericht.zaehlung).map(([k, v]) => [k, v.supabase])) } }));
    await saveJson<Stand>(standName(z.haushalt), { ...s, uebernommen: { zeit, wer: z.person, ergebnis } });
    return NextResponse.json({ ok: true, ergebnis });
  }
  return NextResponse.json({ ok: false, fehler: 'Unbekannter Schritt.' }, { status: 400 });
}
