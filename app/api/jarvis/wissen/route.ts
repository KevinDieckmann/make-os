// ─── MAKE OS — Wissen (Route) ───────────────────────────────────────────────
// Kevin, 24.09.: „Obsidian soll Nr. 1 Wissensbank sein." Diese Route ist die
// Leseseite dafür — dieselben Funktionen, die Jarvis benutzt, mit derselben
// Sicht: gezeigt wird nur, was die angemeldete Person sehen darf
// (Vertraulichkeitsregeln im Vault, umgesetzt in lib/jarvis/vault.ts).
//
//   GET ?frage=…[&bereich=…]         Suche
//   GET ?notiz=<Kennung|Wikilink>    eine Notiz ganz
//   GET ?neueste=1[&bereich=…]       die zuletzt geänderten
//   GET (ohne)                       Stand: Zahlen je Quelle und Bereich
//
// Geschrieben wird hier nichts. Kevin pflegt sein Brain in Obsidian.

import { NextResponse } from 'next/server';
import { bestand, darfSehen, neueste, notiz, suche, WURZELN } from '@/lib/jarvis/vault';
import { personAus } from '@/lib/jarvis/raum';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zahl = (v: string | null, std: number, max: number) => Math.max(1, Math.min(max, Number(v) || std));

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const sicht = { person: personAus(req) };
  const bereich = p.get('bereich')?.trim() || undefined;

  const frage = p.get('frage')?.trim();
  if (frage) {
    const d = await suche(frage.slice(0, 300), zahl(p.get('anzahl'), 12, 30), sicht, bereich);
    return NextResponse.json({ ok: true, ...d });
  }

  const id = p.get('notiz')?.trim();
  if (id) {
    const d = await notiz(id, 60_000, sicht);
    return NextResponse.json(d, { status: d.ok ? 200 : 404 });
  }

  if (p.get('neueste')) {
    const liste = await neueste(sicht, zahl(p.get('anzahl'), 30, 80), bereich);
    return NextResponse.json({ ok: true, notizen: liste });
  }

  const b = await bestand(p.get('frisch') === '1');
  const sichtbar = b.notizen.filter(n => darfSehen(n, sicht));
  const zaehle = (liste: typeof sichtbar, schluessel: (n: (typeof sichtbar)[number]) => string) => {
    const z: Record<string, number> = {};
    for (const n of liste) z[schluessel(n)] = (z[schluessel(n)] ?? 0) + 1;
    return z;
  };
  return NextResponse.json({
    ok: true,
    person: sicht.person,
    notizen: sichtbar.length,
    gesamt: b.notizen.length,
    privat: sichtbar.filter(n => n.scope === 'privat').length,
    jeWurzel: zaehle(sichtbar, n => n.wurzel),
    jeBereich: zaehle(sichtbar, n => n.bereich),
    wurzeln: WURZELN.map(w => ({ id: w.id, name: w.name, obsidian: `obsidian://open?vault=${encodeURIComponent(w.obsidian)}` })),
    dubletten: b.dubletten,
    privatUebersprungen: b.privatUebersprungen,
    dauerMs: b.dauerMs,
  });
}
