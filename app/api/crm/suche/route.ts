// ─── Schnellsuche (⌘K) — Kontakte, Firmen, Chancen, Mandate, Kampagnen ─────
// Kevin, 24.09.: „mit den Kontakten oder Firmen suchen ist sehr wertvoll …
// dann kann man auch immer wieder reingehen.“ Eine Suche von überall, die
// direkt in die Karteikarte springt. Gesperrte Personen bleiben auffindbar
// (sonst könnte man die Sperre nicht sehen), sind aber markiert.

import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const norm = (t?: string) => (t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

// Beim Tippen kommen viele Anfragen kurz hintereinander — 15 Sekunden reichen als Frische.
let zwischen: { t: number; kontakte: Kontakt[]; crm: Awaited<ReturnType<typeof ladeCrm>> } | null = null;
async function bestand() {
  if (zwischen && Date.now() - zwischen.t < 15_000) return zwischen;
  const [k, crm] = await Promise.all([loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm()]);
  zwischen = { t: Date.now(), kontakte: k?.kontakte ?? [], crm };
  return zwischen;
}

export async function GET(req: Request) {
  const q = norm(new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ ok: true, treffer: [] });
  const w = q.split(/\s+/).filter(Boolean);
  const passt = (felder: (string | undefined)[]) => { const t = norm(felder.filter(Boolean).join(' ')); return w.every(x => t.includes(x)); };
  const punkte = (name: string) => (norm(name).startsWith(q) ? 3 : norm(name).includes(q) ? 2 : 1);
  const { kontakte, crm } = await bestand();
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  const personen = kontakte.filter(k => passt([anzeigename(k), k.firma, k.email, k.position, k.firmaStadt, k.telefon]))
    .map(k => ({ art: 'kontakt', id: k.id, titel: anzeigename(k), unter: [k.position ?? k.jobtitel, (k.firmaId && firmen.get(k.firmaId)?.name) ?? k.firma, k.werbesperre ? 'Werbesperre' : ''].filter(Boolean).join(' · '), href: `/os/markttraktion?s=kontakte&k=${k.id}`, p: punkte(anzeigename(k)) + (k.lebensphase === 'kunde' ? 1 : 0) }))
    .sort((a, b) => b.p - a.p).slice(0, 8);
  const fs = crm.firmen.filter(f => passt([f.name, f.domain, f.branche, f.stadt]))
    .map(f => ({ art: 'firma', id: f.id, titel: f.name, unter: [f.branche, f.stadt, f.rolle === 'kunde' ? 'Kunde' : ''].filter(Boolean).join(' · '), href: `/os/markttraktion?s=firmen&k=${f.id}`, p: punkte(f.name) + (f.rolle === 'kunde' ? 1 : 0) }))
    .sort((a, b) => b.p - a.p).slice(0, 6);
  const ch = crm.chancen.filter(c => passt([c.titel, c.firma])).slice(0, 4).map(c => ({ art: 'chance', id: c.id, titel: c.titel, unter: `Chance · ${c.stufe}`, href: '/os/markttraktion?s=sales&a=pipeline', p: 1 }));
  const md = crm.mandate.filter(m => passt([m.kunde, m.titel])).slice(0, 4).map(m => ({ art: 'mandat', id: m.id, titel: `${m.kunde} · ${m.titel}`.slice(0, 90), unter: `Mandat · ${m.status}`, href: '/os/markttraktion?s=sales&a=kunden', p: 1 }));
  const kp = crm.kampagnen.filter(k => passt([k.name])).slice(0, 3).map(k => ({ art: 'kampagne', id: k.id, titel: k.name, unter: `Kampagne · ${k.status}`, href: '/os/markttraktion?s=marketing&a=kampagnen', p: 1 }));
  return NextResponse.json({ ok: true, treffer: [...personen, ...fs, ...ch, ...md, ...kp] });
}
