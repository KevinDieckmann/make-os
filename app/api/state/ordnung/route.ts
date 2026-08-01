// ─── MAKE OS — Die Ordnung (Store) ──────────────────────────────────────────
// Was zählt zuerst: die Reihenfolge der Themen (Kevin & Malin legen sie fest),
// die Aufgaben, die von Hand einem anderen Thema zugeordnet wurden, und die
// von Hand gesetzten Stichworte.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrdnungFile {
  reihenfolge: string[];
  zuordnung: Record<string, string>;
  stichworte: Record<string, string[]>;
  /** Aufgabe → Organisation (kdv|kdc|kemaris|privat), von Hand gesetzt. */
  orgs: Record<string, string>;
}

const STANDARD = ['recht', 'umsatz', 'produkt', 'leben'];
const ERLAUBT = new Set(STANDARD);
const ORG_IDS = new Set(['kdv', 'kdc', 'kemaris', 'privat']);

export async function GET() {
  const f = await loadJson<OrdnungFile>('ordnung');
  return NextResponse.json({
    reihenfolge: Array.isArray(f?.reihenfolge) && f.reihenfolge.length ? f.reihenfolge.filter(x => ERLAUBT.has(x)) : STANDARD,
    zuordnung: f?.zuordnung && typeof f.zuordnung === 'object' ? f.zuordnung : {},
    stichworte: f?.stichworte && typeof f.stichworte === 'object' ? f.stichworte : {},
    orgs: f?.orgs && typeof f.orgs === 'object' ? f.orgs : {},
  });
}

export async function PUT(req: Request) {
  let body: Partial<OrdnungFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const next = await updateJson<OrdnungFile>('ordnung', current => {
    const reihenfolge = Array.isArray(body.reihenfolge)
      ? body.reihenfolge.filter(x => typeof x === 'string' && ERLAUBT.has(x))
      : (current?.reihenfolge ?? STANDARD);
    // Fehlende Themen hinten anhängen — es darf nie eins verschwinden.
    for (const id of STANDARD) if (!reihenfolge.includes(id)) reihenfolge.push(id);

    const zuordnung = { ...(current?.zuordnung ?? {}) };
    if (body.zuordnung && typeof body.zuordnung === 'object') {
      for (const [taskId, thema] of Object.entries(body.zuordnung).slice(0, 500)) {
        if (typeof thema === 'string' && ERLAUBT.has(thema)) zuordnung[String(taskId).slice(0, 60)] = thema;
        else delete zuordnung[String(taskId).slice(0, 60)];
      }
    }

    // Stichworte je Aufgabe: leere Liste löscht den Eintrag wieder.
    const stichworte = { ...(current?.stichworte ?? {}) };
    if (body.stichworte && typeof body.stichworte === 'object') {
      for (const [taskId, liste] of Object.entries(body.stichworte).slice(0, 500)) {
        const key = String(taskId).slice(0, 60);
        if (Array.isArray(liste) && liste.length) {
          stichworte[key] = liste.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, 12);
        } else delete stichworte[key];
      }
    }

    const orgs = { ...(current?.orgs ?? {}) };
    if (body.orgs && typeof body.orgs === 'object') {
      for (const [taskId, org] of Object.entries(body.orgs).slice(0, 500)) {
        if (typeof org === 'string' && ORG_IDS.has(org)) orgs[String(taskId).slice(0, 60)] = org;
        else delete orgs[String(taskId).slice(0, 60)];
      }
    }

    return { reihenfolge, zuordnung, stichworte, orgs };
  });

  return NextResponse.json({ ok: true, ...next });
}
