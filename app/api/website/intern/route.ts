// ─── Website — intern (31.10., Markttraktion › Website) ─────────────────────────────────────────────────────────────────────────────
// Nur der Haushalt des Inhabers mit Person (Dienstweg ohne Person 403):
// GET ?teil=inhalt (Vorgabe) → { inhalt (jeder Eintrag mit `stand`), einstellungenStand, bereiche, hilfen: { produkte, bausteine (Datei + wirksam), events
//                                (eigene), medien (für die Website freigegebene Bilder), buchungsseiten, unterlagen }, istInhaber, startwerte (Datei da?) }
// GET ?teil=ueberblick → { wege (Zustand je Weg), zahlen (Website-Zahlen 30 Tage) }
// GET ?teil=eingaenge  → { eingaenge } (aus den vorhandenen Beständen, Adressen der Newsletter maskiert)
// PATCH { ops } → nur eine Person per Sitzung (Dienstweg 403), Bau-Kennung; Stand je Eintrag (409 + aktueller Bestand), Grenzen 413, Unsinn 400.
// POST { aktion: 'startwerte', vorschau? } → nur ein Inhaber per Sitzung: Startwerte aus website/startwerte-inhalt.json — Vorschau zuerst, übernimmt nur
//                                fehlende Einträge (nie überschreiben).

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, istDienst, nurHaushalt } from '@/lib/zugang/tor';
import { darfSteuern, NUR_STEUERN } from '@/lib/zugang/steuern';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { WebFehler, bereicheVon, euroInCent, mitStand, opsAus, startwerteOps, type ProduktKurz } from '@/lib/website/regeln';
import { WebKonfliktFehler, eventQuellen, ladeWebsiteInhalt, startwerteLesen, websiteAendern, websiteMedien } from '@/lib/website/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fehler = (text: string, status: number) => NextResponse.json({ ok: false, fehler: text }, { status, headers: { 'Cache-Control': 'no-store' } });
const OHNE = { headers: { 'Cache-Control': 'no-store' } };

async function hilfen() {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const { katalogDatei, katalogLaden } = await import('@/lib/bausteine/server');
  const { katalogLaden: unterlagenLaden } = await import('@/lib/unterlagen/server');
  const { ladeBuchungBestand } = await import('@/lib/kalender/buchung-speicher');
  const [crm, datei, wirksam, events, medien, buchung, unterlagen] = await Promise.all([
    ladeCrm(), katalogDatei().catch(() => []), katalogLaden().catch(() => []), eventQuellen().catch(() => []), websiteMedien(),
    ladeBuchungBestand().catch(() => ({ seiten: [] as { slug: string; titel: string; aktiv: boolean }[] })), unterlagenLaden().catch(() => []),
  ]);
  const produkte: ProduktKurz[] = (crm.leistungen ?? []).filter(l => !l.geloeschtAm).map(l => ({ id: l.id, name: l.name, preisNetto: euroInCent(l.preis?.betrag), status: l.status }));
  return {
    produkte,
    bausteine: datei.map(b => {
      const w = wirksam.find(x => x.id === b.id);
      return { id: b.id, bereich: b.bereich, seite: b.seite, paket: !!b.paket, datei: { titel: b.titel, preisNetto: b.preis }, wirksam: { titel: w?.titel ?? b.titel, preisNetto: w?.preis ?? b.preis, ausgeblendet: !!w?.ausgeblendet } };
    }),
    events: events.filter(e => !e.besucht).map(e => ({ id: e.id, titel: e.titel, datum: e.datum, ...(e.uhrzeit ? { uhrzeit: e.uhrzeit } : {}), ...(e.ort ? { ort: e.ort } : {}), status: e.status })),
    medien: [...medien.entries()].map(([id, m]) => ({ id, ...m })),
    buchungsseiten: buchung.seiten.filter(s => s.aktiv).map(s => ({ slug: s.slug, titel: s.titel })),
    unterlagen: unterlagen.map(u => ({ id: u.id, titel: u.titel, seite: u.seite, arten: u.dateien.map(d => d.art) })),
  };
}

export async function GET(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  const teil = new URL(req.url).searchParams.get('teil') ?? 'inhalt';
  if (teil === 'ueberblick') {
    const { wegeLage, websiteZahlen } = await import('@/lib/website/lage-server');
    const [wege, zahlen] = await Promise.all([wegeLage(), websiteZahlen()]);
    return NextResponse.json({ ok: true, wege, zahlen }, OHNE);
  }
  if (teil === 'eingaenge') {
    const { websiteEingaenge } = await import('@/lib/website/lage-server');
    const { leseZugriff } = await import('@/lib/store/leseprotokoll');
    const eingaenge = await websiteEingaenge();
    leseZugriff(req, 'kontakte', { anzahl: eingaenge.length });
    return NextResponse.json({ ok: true, eingaenge }, OHNE);
  }
  if (teil !== 'inhalt') return fehler('teil: inhalt, ueberblick oder eingaenge.', 400);
  const [inhalt, h, inhaber, startwerte] = await Promise.all([ladeWebsiteInhalt(), hilfen(), darfSteuern(z.person), startwerteLesen().then(x => x !== null).catch(() => false)]);
  return NextResponse.json({ ok: true, inhalt: mitStand(inhalt), bereiche: bereicheVon(inhalt), hilfen: h, istInhaber: inhaber, startwerte }, OHNE);
}

async function schreiben(req: Request, ops: unknown, person: string) {
  try {
    const inhalt = await websiteAendern(opsAus(ops), person, werAus(req));
    return NextResponse.json({ ok: true, inhalt: mitStand(inhalt), bereiche: bereicheVon(inhalt) }, OHNE);
  } catch (x) {
    if (x instanceof WebKonfliktFehler) return NextResponse.json({ ok: false, fehler: 'Inzwischen anders gespeichert — bitte neu laden und noch einmal.', konflikte: x.konflikte, inhalt: mitStand(x.inhalt) }, { status: 409, headers: OHNE.headers });
    if (x instanceof WebFehler) return fehler(x.message, x.status);
    throw x;
  }
}

export async function PATCH(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 512 * 1024); } catch (x) { return jsonZuGross(x) ?? fehler('Kein JSON.', 400); }
  return schreiben(req, b.ops, z.person);
}

export async function POST(req: Request) {
  const z = await imHaushaltDesInhabers(req);
  if (!z) return nurHaushalt();
  if (istDienst(req)) return fehler('Nur per Klick einer Person — nicht über den Dienstweg.', 403);
  // Marketing steuern (02.11., Prüfung D): Inhaber ODER volles Mitglied des Haushalts (lib/zugang/steuern.ts).
  if (!(await darfSteuern(z.person))) return fehler(NUR_STEUERN, 403);
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 8 * 1024); } catch (x) { return jsonZuGross(x) ?? fehler('Kein JSON.', 400); }
  if (b.aktion !== 'startwerte') return fehler('aktion: startwerte.', 400);
  let roh: unknown;
  try { roh = await startwerteLesen(); } catch (x) { if (x instanceof WebFehler) return fehler(x.message, x.status); throw x; }
  if (roh === null) return fehler('Keine Startwerte vorhanden.', 404);
  const { katalogDatei } = await import('@/lib/bausteine/server');
  const { ops, zaehler, fehler: f } = startwerteOps(await ladeWebsiteInhalt(), roh, await katalogDatei().catch(() => []));
  if (b.vorschau !== false) return NextResponse.json({ ok: true, vorschau: true, zaehler, fehler: f, anzahl: ops.length }, OHNE);
  if (!ops.length) return NextResponse.json({ ok: true, zaehler, fehler: f, anzahl: 0, inhalt: mitStand(await ladeWebsiteInhalt()) }, OHNE);
  const r = await schreiben(req, ops, z.person);
  if (!r.ok) return r;
  const j = await r.json() as Record<string, unknown>;
  return NextResponse.json({ ...j, zaehler, fehler: f, anzahl: ops.length }, OHNE);
}
