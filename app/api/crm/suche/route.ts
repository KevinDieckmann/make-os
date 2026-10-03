// ─── Schnellsuche (⌘K) — Kontakte, Firmen, Chancen, Mandate, Kampagnen ─────
// Kevin, 24.09.: „mit den Kontakten oder Firmen suchen ist sehr wertvoll …
// dann kann man auch immer wieder reingehen.“ Eine Suche von überall, die
// direkt in die Karteikarte springt. Gesperrte Personen bleiben auffindbar
// (sonst könnte man die Sperre nicht sehen), sind aber markiert.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { WEG, eventLink } from '@/lib/wege';
import { istNetzwerkenEvent } from '@/lib/crm/marke';
import { anmeldungVon, anmeldungLabel, fuerFirmaId } from '@/lib/crm/besuche-form';
import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { suchNorm, suchWoerter } from '@/lib/text/such-norm';
import { anzeigename, type Kontakt } from '@/lib/make-one/crm';
import { ladeCrm } from '@/lib/crm/speicher';
import { alleAdressen } from '@/lib/crm/emails';
import { labelsVon } from '@/lib/crm/mehrfach';
import { firmaVonMandat } from '@/lib/crm/firmen-bezug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Eine Such-Normalisierung für alles (K2 #105, lib/text/such-norm.ts): „mueller“ findet „Müller“ (NFC und NFD), „strasse“ „Straße“.
const norm = suchNorm;

// Beim Tippen kommen viele Anfragen kurz hintereinander — 15 Sekunden reichen als Frische, aber nur, solange sich
// Kartei und CRM nicht geändert haben (K2 #106): der Zwischenstand hängt am Speicherstand.
let zwischen: { t: number; stand: string; kontakte: Kontakt[]; crm: Awaited<ReturnType<typeof ladeCrm>> } | null = null;
async function bestand() {
  const stand = await speicherStand(['kontakte', 'crm']);
  if (zwischen && zwischen.stand === stand && Date.now() - zwischen.t < 15_000) return zwischen;
  const [k, crm] = await Promise.all([loadJson<{ kontakte: Kontakt[] }>('kontakte'), ladeCrm()]);
  zwischen = { t: Date.now(), stand, kontakte: k?.kontakte ?? [], crm };
  return zwischen;
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const q = norm(new URL(req.url).searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ ok: true, treffer: [] });
  const w = suchWoerter(q);
  const passt = (felder: (string | undefined)[]) => { const t = norm(felder.filter(Boolean).join(' ')); return w.every(x => t.includes(x)); };
  const punkte = (name: string) => (norm(name).startsWith(q) ? 3 : norm(name).includes(q) ? 2 : 1);
  const { kontakte, crm } = await bestand();
  const firmen = new Map(crm.firmen.map(f => [f.id, f]));
  /** Firmen mit aktivem Mandat — in der Suche als „Mandant“ markiert. */
  const mandanten = new Set(crm.mandate.filter(m => m.status === 'aktiv').map(m => firmaVonMandat(m, crm.firmen)?.id).filter((x): x is string => !!x));
  // Alle E-Mail-Adressen und Labels zählen (28.09.).
  const personen = kontakte.filter(k => passt([anzeigename(k), k.firma, ...alleAdressen(k), k.position, k.firmaStadt, k.telefon, ...labelsVon(k)]))
    .map(k => ({ art: 'kontakt', id: k.id, titel: anzeigename(k), unter: [k.position ?? k.jobtitel, (k.firmaId && firmen.get(k.firmaId)?.name) ?? k.firma, k.werbesperre ? 'Werbesperre' : '', k.eingeschraenkt ? 'Eingeschränkt (Art. 18)' : ''].filter(Boolean).join(' · '), href: `/os/markttraktion?s=kontakte&k=${k.id}`, p: punkte(anzeigename(k)) + (k.lebensphase === 'kunde' ? 1 : 0) }))
    .sort((a, b) => b.p - a.p).slice(0, 8);
  const fs = crm.firmen.filter(f => passt([f.name, f.domain, f.branche, f.stadt]))
    .map(f => ({ art: 'firma', id: f.id, titel: f.name, unter: [f.branche, f.stadt, f.rolle === 'kunde' ? 'Kunde' : '', mandanten.has(f.id) ? 'Mandant' : ''].filter(Boolean).join(' · '), href: WEG.firma(f.id), p: punkte(f.name) + (f.rolle === 'kunde' || mandanten.has(f.id) ? 1 : 0) }))
    .sort((a, b) => b.p - a.p).slice(0, 6);
  const ch = crm.chancen.filter(c => passt([c.titel, c.firma])).slice(0, 4).map(c => ({ art: 'chance', id: c.id, titel: c.titel, unter: `Deal · ${c.stufe === 'qualifiziert' ? 'SQL' : c.stufe}`, href: WEG.deal(c.id), p: 1 }));
  // Mandanten klickbar (28.09.): Mandat mit dem Namen der CRM-Firma (Kennung gewinnt), Links über WEG.
  const md = crm.mandate.map(m => ({ m, kunde: firmaVonMandat(m, crm.firmen)?.name ?? m.kunde })).filter(({ m, kunde }) => passt([kunde, m.kunde, m.titel])).slice(0, 4)
    .map(({ m, kunde }) => ({ art: 'mandat', id: m.id, titel: `${kunde} · ${m.titel}`.slice(0, 90), unter: `Mandat · ${m.status}`, href: WEG.mandat(m.id), p: 1 }));
  const kp = crm.kampagnen.filter(k => passt([k.name])).slice(0, 3).map(k => ({ art: 'kampagne', id: k.id, titel: k.name, unter: `Kampagne · ${k.status}`, href: `/os/markttraktion?s=marketing&a=kampagnen&k=${k.id}`, p: 1 }));
  // Events (M4): besuchte Veranstaltungen (Reiter „Events“) und unsere Make.One-Abende — getrennt gekennzeichnet, der Link führt in den richtigen Reiter.
  const ev = crm.events.filter(e => passt([e.titel, e.ort])).sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 4).map(e => {
    const besuch = istNetzwerkenEvent(e);
    const kunde = besuch ? fuerFirmaId(e) : null;
    return { art: besuch ? 'besuch' : 'event', id: e.id, titel: e.titel, p: 1, href: eventLink(e),
      unter: [besuch ? `Event · ${anmeldungLabel(anmeldungVon(e))}` : `Make.One · ${e.status}`, `${e.datum.slice(8, 10)}.${e.datum.slice(5, 7)}.${e.datum.slice(0, 4)}`, e.ort, kunde ? `für ${firmen.get(kunde)?.name ?? 'Kunde'}` : ''].filter(Boolean).join(' · ') };
  });
  return NextResponse.json({ ok: true, treffer: [...personen, ...fs, ...ch, ...md, ...kp, ...ev] });
}
