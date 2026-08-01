// ─── MAKE OS — Eigene Filter & Labels ───────────────────────────────────────
// Alles, was Kevin & Malin selbst einstellen: gespeicherte Filter (eine
// Auswahl, die man wieder aufrufen kann) und eigene Stichworte, die die fest
// eingebauten ergänzen.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface EigenerFilter {
  id: string;
  name: string;
  /** Wo der Filter gilt. */
  wo: 'aufgaben' | 'inbox';
  themen?: string[];
  orgs?: string[];
  prios?: string[];
  stichworte?: string[];
  wege?: string[];
  besitzer?: string;
  faecher?: string[];
  /** Freitext, der in Titel/Beschreibung vorkommen muss. */
  suche?: string;
}

export interface EigenesStichwort {
  id: string;
  label: string;
  thema: string;
  /** Wörter, an denen es erkannt wird (ODER-verknüpft). */
  woerter: string[];
  kpi?: boolean;
}

interface FilterFile {
  filter: EigenerFilter[];
  stichworte: EigenesStichwort[];
}

const sauberListe = (v: unknown, max = 20): string[] =>
  Array.isArray(v) ? v.filter(x => typeof x === 'string').map(x => x.slice(0, 40)).slice(0, max) : [];

function sauberFilter(f: Partial<EigenerFilter>, i: number): EigenerFilter | null {
  const name = String(f.name ?? '').trim().slice(0, 60);
  if (!name) return null;
  return {
    id: String(f.id ?? '').slice(0, 40) || `f-${Date.now().toString(36)}-${i}`,
    name,
    wo: f.wo === 'inbox' ? 'inbox' : 'aufgaben',
    themen: sauberListe(f.themen),
    orgs: sauberListe(f.orgs),
    prios: sauberListe(f.prios),
    stichworte: sauberListe(f.stichworte, 40),
    wege: sauberListe(f.wege),
    faecher: sauberListe(f.faecher),
    besitzer: f.besitzer ? String(f.besitzer).slice(0, 20) : undefined,
    suche: f.suche ? String(f.suche).slice(0, 80) : undefined,
  };
}

function sauberStichwort(s: Partial<EigenesStichwort>, i: number): EigenesStichwort | null {
  const label = String(s.label ?? '').trim().slice(0, 40);
  if (!label) return null;
  const woerter = sauberListe(s.woerter, 12).map(w => w.trim()).filter(Boolean);
  return {
    id: String(s.id ?? '').slice(0, 40) || `eig-${Date.now().toString(36)}-${i}`,
    label,
    thema: ['recht', 'umsatz', 'produkt', 'leben'].includes(String(s.thema)) ? String(s.thema) : 'umsatz',
    // Ohne eigene Wörter dient das Label selbst als Suchwort.
    woerter: woerter.length ? woerter : [label],
    kpi: s.kpi === true,
  };
}

export async function GET() {
  const f = await loadJson<FilterFile>('filter');
  return NextResponse.json({
    filter: Array.isArray(f?.filter) ? f.filter : [],
    stichworte: Array.isArray(f?.stichworte) ? f.stichworte : [],
  });
}

export async function PUT(req: Request) {
  let body: Partial<FilterFile>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }

  const next = await updateJson<FilterFile>('filter', current => ({
    filter: Array.isArray(body.filter)
      ? body.filter.slice(0, 40).map(sauberFilter).filter((x): x is EigenerFilter => !!x)
      : (current?.filter ?? []),
    stichworte: Array.isArray(body.stichworte)
      ? body.stichworte.slice(0, 100).map(sauberStichwort).filter((x): x is EigenesStichwort => !!x)
      : (current?.stichworte ?? []),
  }));

  return NextResponse.json({ ok: true, ...next });
}
