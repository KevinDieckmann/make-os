// ─── MAKE OS — Bezüge zurücksetzen nach „Rückgängig“ (07.10., Seil — LICHTFAEDEN.md) ──────────────────────────────────
// POST { art: 'zurueck', geloest: { zielId, ziele[], meilensteine[], aufgaben[], projekte[] } }
// Ein gelöschtes Ziel löst am Server die Bezüge darauf (PATCH /api/state/ziele → `bezuegeGeloest`). „Rückgängig“ legt das Ziel
// wieder an und ruft danach diesen Weg: er setzt `oberzielId` (Unterziele), `zielId` (Meilensteine, Aufgaben, Projekte) zurück —
// NUR, wenn das Ziel wieder im geteilten Bestand steht und das Feld noch leer ist (lib/planung/bezuege.ts `bezuegeZurueck`).
// Jeder Schreibweg ist der vorhandene (Ziele/Meilensteine in ihrer Sperre, Aufgaben über `aufgabenAendern`), mit denselben Prüfungen
// (Bereich, Kreis). Zugang: angemeldete Person im Haushalt des Inhabers; der Dienstweg ist gesperrt (kein Hintergrundlauf braucht ihn).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { ZIEL_HORIZONTE, type Meilenstein, type ZieleDatei } from '@/lib/planung/typen';
import { bezuegeZurueck, istBezugKennung, kennungenSaeubern, oberzielPruefen, type BezuegeGeloest } from '@/lib/planung/bezuege';
import { ladeAufgaben } from '@/lib/aufgaben/speicher';
import { zielBezuegeInAufgabenSetzen } from '@/lib/aufgaben/ziel-bezug-server';
import { zieleNachziehen } from '@/lib/planung/meilenstein-aufgaben-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRENZE_BYTES = 64 * 1024;

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return nurHaushalt();
  let body: { art?: unknown; geloest?: Record<string, unknown> };
  try { body = await jsonBegrenzt(req, GRENZE_BYTES); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (body.art !== 'zurueck' || !body.geloest || !istBezugKennung(body.geloest.zielId)) {
    return NextResponse.json({ ok: false, fehler: 'art „zurueck“ und geloest.zielId nötig.' }, { status: 400 });
  }
  const g: BezuegeGeloest = {
    zielId: body.geloest.zielId,
    ziele: kennungenSaeubern(body.geloest.ziele), meilensteine: kennungenSaeubern(body.geloest.meilensteine),
    aufgaben: kennungenSaeubern(body.geloest.aufgaben), projekte: kennungenSaeubern(body.geloest.projekte),
  };

  // Lebt das Ziel wieder (im geteilten Bestand, nicht archiviert)?
  const zd = await loadJson<ZieleDatei>('ziele');
  const alle = ZIEL_HORIZONTE.flatMap(h => (Array.isArray(zd?.[h]) ? zd![h] : []));
  const lebt = alle.some(z => z.id === g.zielId && !z.archiviertAm);
  if (!lebt) return NextResponse.json({ ok: false, fehler: 'Das Ziel steht (noch) nicht wieder im Bestand — erst das Ziel zurückholen.' }, { status: 409 });

  const ms = await loadJson<{ meilensteine?: Meilenstein[] }>('meilensteine');
  const aufgaben = await ladeAufgaben();
  const wer = bezuegeZurueck(g, {
    zielLebt: lebt, ziele: alle, meilensteine: ms?.meilensteine ?? [], aufgaben: aufgaben.tasks, projekte: aufgaben.projects,
  });
  const gesetzt = { ziele: 0, meilensteine: 0, aufgaben: 0, projekte: 0 };

  // Unterziele: `oberzielId` zurück — in der Sperre, mit derselben Prüfung wie der Schreibweg (sonst bleibt der Bezug weg).
  if (wer.ziele.length) {
    const ids = new Set(wer.ziele);
    let geaendert: string[] = [];
    await updateJson<ZieleDatei>('ziele', cur => {
      const basis = { ...(cur ?? {}) } as ZieleDatei;
      geaendert = [];
      const neu = { ...basis } as ZieleDatei;
      for (const h of ZIEL_HORIZONTE) {
        const l = Array.isArray(basis[h]) ? basis[h] : [];
        neu[h] = l.map(z => (ids.has(z.id) && !z.oberzielId ? (geaendert.push(z.id), { ...z, oberzielId: g.zielId }) : z));
      }
      const vorher = new Map(ZIEL_HORIZONTE.flatMap(h => (Array.isArray(basis[h]) ? basis[h] : [])).map(z => [z.id, z.oberzielId]));
      if (!geaendert.length || oberzielPruefen(ZIEL_HORIZONTE.flatMap(h => neu[h]), geaendert, vorher)) { geaendert = []; return basis; }
      return neu;
    });
    gesetzt.ziele = geaendert.length;
    if (geaendert.length) await protokolliere('ziele', geaendert.map(id => ({ op: 'geaendert' as const, id, felder: ['oberzielId'] })), werAus(req));
  }
  // Meilensteine: `zielId` zurück (wo leer), danach ziehen die Ziele ihren Fortschritt nach.
  if (wer.meilensteine.length) {
    const ids = new Set(wer.meilensteine);
    let geaendert: string[] = [];
    await updateJson<{ meilensteine?: Meilenstein[] } & Record<string, unknown>>('meilensteine', cur => {
      const l = Array.isArray(cur?.meilensteine) ? cur!.meilensteine : [];
      geaendert = [];
      const neu = l.map(m => (ids.has(m.id) && !m.zielId ? (geaendert.push(m.id), { ...m, zielId: g.zielId }) : m));
      return geaendert.length ? { ...(cur ?? {}), meilensteine: neu } : (cur ?? { meilensteine: l });
    });
    gesetzt.meilensteine = geaendert.length;
    if (geaendert.length) {
      await protokolliere('meilensteine', geaendert.map(id => ({ op: 'geaendert' as const, id, felder: ['zielId'] })), werAus(req));
      await zieleNachziehen();
    }
  }
  // Aufgaben und Projekte über den EINEN Schreibweg (prüft Bereich und Ziel noch einmal).
  const a = await zielBezuegeInAufgabenSetzen(g.zielId, wer.aufgaben, wer.projekte, zugang.person);
  gesetzt.aufgaben = a.aufgaben;
  gesetzt.projekte = a.projekte;
  return NextResponse.json({ ok: true, gesetzt });
}
