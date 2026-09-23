// ─── MAKE OS — Eine Aktivität am Kontakt ────────────────────────────────────
// „Ich habe X angeschrieben" — ein Aufruf, und der Kontakt weiß es: Aktivität
// protokolliert, letzter Kontakt gesetzt, Stufe vorwärts (nie zurück),
// Wiedervorlage angelegt. Wer es war, kommt aus dem Raum (Kevin oder Malin),
// nicht aus dem Body — sonst könnte ein Fenster im falschen Namen schreiben.

import { NextResponse } from 'next/server';
import { updateJson } from '@/lib/store/local-db';
import { personAus } from '@/lib/jarvis/raum';
import { wendeAktivitaetAn, STUFEN, type Kontakt, type AktivitaetArt, type Stufe } from '@/lib/make-one/crm';
import { localDay, tagePlus } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ARTEN: AktivitaetArt[] = ['mail', 'linkedin', 'anruf', 'antwort', 'termin', 'notiz', 'stufe'];

export async function POST(req: Request) {
  let b: { id?: string; art?: string; text?: string; stufe?: string; wiedervorlage?: string; von?: 'jarvis' };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const id = String(b.id ?? '').trim();
  const art = String(b.art ?? '') as AktivitaetArt;
  if (!id || !ARTEN.includes(art)) return NextResponse.json({ error: 'id und art (mail|linkedin|anruf|antwort|termin|notiz|stufe) nötig.' }, { status: 400 });
  const text = String(b.text ?? '').trim().slice(0, 1200);
  const wunschStufe = b.stufe && STUFEN.includes(b.stufe as Stufe) ? (b.stufe as Stufe) : undefined;
  const wunschWv = b.wiedervorlage && /^\d{4}-\d{2}-\d{2}$/.test(b.wiedervorlage) ? b.wiedervorlage : undefined;
  const von = b.von === 'jarvis' ? 'jarvis' : personAus(req);
  const heute = localDay();

  let ergebnis: Kontakt | null = null;
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', current => {
    const f = current ?? { kontakte: [] };
    const i = f.kontakte.findIndex(x => x.id === id);
    if (i < 0) return f;
    ergebnis = wendeAktivitaetAn(f.kontakte[i], { art, text: text || undefined, von, stufe: wunschStufe, wiedervorlage: wunschWv }, heute, new Date().toISOString(), tagePlus);
    f.kontakte[i] = ergebnis;
    return f;
  });
  if (!ergebnis) return NextResponse.json({ error: `Kein Kontakt mit id ${id}.` }, { status: 404 });
  return NextResponse.json({ ok: true, kontakt: ergebnis });
}
