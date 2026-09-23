// ─── MAKE OS — Eigene Bezeichnungen ─────────────────────────────────────────
// Kevins Kernsatz: „Wir bauen aus diesem System selber ein System — aber das
// geht nicht, wenn du das immer selber einprogrammierst. Wir müssen Label
// hinzufügen und wegnehmen können."
//
// Also ein Bestand für alles, was bisher fest im Code stand und trotzdem
// Kevins und Malins Sprache ist: wie die Prioritäten heißen, welche Kategorien
// es bei Buchungen und Zahlungen gibt, wie die Orte heißen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Datei {
  /** Umbenennungen: { recht: "Recht & Fundament" } — leer heißt Standard. */
  themen: Record<string, string>;
  orte: Record<string, string>;
  /** Zusätzliche Kategorien für Buchungen und Zahlungen. */
  kategorien: string[];
  /** Kategorien, die nicht mehr angeboten werden sollen. */
  versteckt: string[];
}

const LEER: Datei = { themen: {}, orte: {}, kategorien: [], versteckt: [] };

const text = (v: unknown, n = 60) => String(v ?? '').trim().slice(0, n);

function sauber(d: Partial<Datei> | null): Datei {
  const karte = (o: unknown) => {
    const raus: Record<string, string> = {};
    if (o && typeof o === 'object') {
      for (const [k, v] of Object.entries(o as Record<string, unknown>).slice(0, 40)) {
        const label = text(v);
        if (label) raus[text(k, 40)] = label;
      }
    }
    return raus;
  };
  const liste = (a: unknown) =>
    Array.from(new Set((Array.isArray(a) ? a : []).map(x => text(x)).filter(Boolean))).slice(0, 80);
  return {
    themen: karte(d?.themen),
    orte: karte(d?.orte),
    kategorien: liste(d?.kategorien),
    versteckt: liste(d?.versteckt),
  };
}

export async function GET() {
  const d = await loadJson<Datei>('labels');
  return NextResponse.json(sauber(d));
}

/** Teilweise setzen: nur die mitgeschickten Felder ändern sich. */
export async function PUT(req: Request) {
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  /**
   * Zusammenführen mit Löschregel: ein leer geschickter Name bedeutet „zurück
   * auf den Standard" — sonst käme man nie wieder von einer Umbenennung weg.
   */
  const misch = (alt: Record<string, string>, rein: unknown) => {
    if (!rein || typeof rein !== 'object') return alt;
    const raus = { ...alt };
    for (const [k, v] of Object.entries(rein as Record<string, unknown>).slice(0, 40)) {
      const id = text(k, 40);
      const label = text(v);
      if (label) raus[id] = label;
      else delete raus[id];
    }
    return raus;
  };

  const next = await updateJson<Datei>('labels', current => {
    const basis = sauber(current ?? LEER);
    const neu = sauber(body);
    return {
      themen: misch(basis.themen, body.themen),
      orte: misch(basis.orte, body.orte),
      kategorien: body.kategorien ? neu.kategorien : basis.kategorien,
      versteckt: body.versteckt ? neu.versteckt : basis.versteckt,
    };
  });
  return NextResponse.json({ ok: true, ...next });
}
