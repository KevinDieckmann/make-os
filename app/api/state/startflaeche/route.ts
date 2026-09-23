// ─── MAKE OS — Startfläche einrichten ───────────────────────────────────────
// Kevins Ansage: „Die Kacheln sollen sich bewegen lassen, wenn ich ein bisschen
// länger drauf bin. Und ich möchte auch andere Sachen selber vorne drauf
// nehmen." Also: Reihenfolge, Ausblenden und eigene Kacheln — im Bestand.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface EigeneKachel { id: string; titel: string; href: string; satz?: string }
interface Datei {
  /** Reihenfolge über Bereichs-Ids und eigene Kachel-Ids hinweg. */
  reihenfolge: string[];
  /** Was Kevin von der Startfläche genommen hat. */
  versteckt: string[];
  eigene: EigeneKachel[];
}

const LEER: Datei = { reihenfolge: [], versteckt: [], eigene: [] };
const text = (v: unknown, n = 80) => String(v ?? '').trim().slice(0, n);

function sauber(d: Partial<Datei> | null): Datei {
  const liste = (a: unknown, n = 40) =>
    Array.from(new Set((Array.isArray(a) ? a : []).map(x => text(x, 60)).filter(Boolean))).slice(0, n);
  return {
    reihenfolge: liste(d?.reihenfolge),
    versteckt: liste(d?.versteckt),
    eigene: (Array.isArray(d?.eigene) ? d!.eigene : []).slice(0, 20).map((k, i) => ({
      id: text(k?.id, 40) || `eigen-${i}`,
      titel: text(k?.titel, 60),
      // Nur eigene Seiten — keine fremden Adressen auf der Startfläche.
      href: /^\/os(\/|$)/.test(text(k?.href, 120)) ? text(k?.href, 120) : '',
      satz: k?.satz ? text(k.satz, 160) : undefined,
    })).filter(k => k.titel && k.href),
  };
}

export async function GET() {
  return NextResponse.json(sauber(await loadJson<Datei>('startflaeche')));
}

export async function PUT(req: Request) {
  let body: Partial<Datei>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  let verloren: string | null = null;
  const next = await updateJson<Datei>('startflaeche', current => {
    const basis = sauber(current ?? LEER);
    const neu = sauber(body);
    // Selbst angelegte Kacheln sind Handarbeit. Eine einzelne darf weg — die
    // Hälfte auf einmal ist immer ein Client, der seinen Stand nicht hatte.
    // (`body.eigene` allein reicht als Prüfung nicht: [] ist truthy.)
    if (body.eigene && basis.eigene.length >= 3 && neu.eigene.length < basis.eigene.length / 2) {
      verloren = `eigene Kacheln (${basis.eigene.length} → ${neu.eigene.length})`;
      return basis;
    }
    return {
      reihenfolge: body.reihenfolge ? neu.reihenfolge : basis.reihenfolge,
      versteckt: body.versteckt ? neu.versteckt : basis.versteckt,
      eigene: body.eigene ? neu.eigene : basis.eigene,
    };
  });

  if (verloren) {
    return NextResponse.json(
      { ok: false, error: `Verweigert: ${verloren} wären verschwunden. Der alte Stand bleibt stehen — Seite neu laden.` },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true, ...next });
}
