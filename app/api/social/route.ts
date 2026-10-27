// ─── MAKE OS — Markttraktion · Social (26.10.2026) ──────────────────────────────────────────────────────────────────────────────────
// Kevin 26.10.: Ein Agent baut die Social-Kanäle auf und verwaltet sie (SOCIAL_PLAN.md). Grundlage: Kanäle mit Markenprofil und Leitplanken,
// Serienformate, Folgen (Skript, Hooks, Quellen), Messungen und die Lernschleife.
// GET   → Bestand (jeder Eintrag mit `stand`), je Folge Prüfung + Leitplanken-Entscheidung, je Kanal Analyse + Woche
//         `?space=privat` → 400: Social gehört zu Business, der Privat-Bereich bekommt hier nichts
// PATCH { ops }  → Einzel-Schritte (lib/social/daten.ts `SocialOp`): Ändern/Entfernen nur mit Stand (409), über den Grenzen 413, Unsinn 400
// POST  { aktion: 'import-vorschau' | 'import', kanalId, plattform, text, stand?, zuordnung? } → Kennzahlen aus einem Plattform-Export (CSV):
//         erst Vorschau (schreibt nichts), dann übernehmen (nur Zeilen mit eindeutiger Folge bzw. ausdrücklicher Zuordnung)
// Sicht (27.10.): ein Kanal mit „nur die Person der Marke“ fehlt für alle anderen ganz — in GET, PATCH (404) und Import (404), eine Regel
// `kanalSichtbar`/`socialFuerPerson` (lib/social/daten.ts). Personenmarke: Formate freigeben und Stufe 2 nur die Person selbst (403).
// Zugang: Haushalt des Inhabers (Modul Markttraktion), auch ein Konto mit `finanzRecht: 'business'`. Schreiben nur eine angemeldete Person
// (Dienstweg 403) — der Agent schreibt später nur über den Freigabe-Stapel bzw. die Leitplanken-Entscheidung, nie direkt.
// POST { aktion: 'entwuerfe', kanalId } → Redaktions-Agent für diesen Kanal (als die Person, `modellSchranke`) · 'linkedin-start' → Anmelde-Adresse
//         (Personenmarke nur die Person selbst) · 'probe-verbinden' (nur Demo/Tests) · 'trennen' { verbindungId }.
// Veröffentlicht wird von hier aus nichts — das macht allein der Takt (lib/social/veroeffentlichen-server.ts) nach den Leitplanken.

import { NextResponse } from 'next/server';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { localDay, istKalendertag } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { NUR_BUSINESS, SOCIAL_PLATTFORMEN, SOCIAL_GRENZEN, type SocialPlattform } from '@/lib/social/typen';
import { importVorschau } from '@/lib/social/csv';
import { ladeSocial, socialLage, socialSchreiben } from '@/lib/social/server';
import { socialFuerPerson, NUR_PERSON_SELBST } from '@/lib/social/daten';
import { modellSchranke } from '@/lib/zugang/umfang';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { socialRedaktionLauf } from '@/lib/social/agent-server';
import { ladeVerbindungen, verbindungSetzen, verbindungTrennen } from '@/lib/social/verbindungen';
import { linkedinEingerichtet, linkedinStart } from '@/lib/social/anbieter/linkedin';
import { probeErlaubt } from '@/lib/social/anbieter/probe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 512_000;
const MAX_IMPORT_BYTES = 4_000_000;
const NUR_SITZUNG = () => NextResponse.json({ ok: false, fehler: 'Social ändert nur eine angemeldete Person — nicht ZOE, nicht der Takt.' }, { status: 403 });
const fehlerAntwort = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (new URL(req.url).searchParams.get('space') === 'privat') return fehlerAntwort(400, NUR_BUSINESS);
  return jsonAntwort(req, { ok: true, ...(await socialLage(zugang.person)) });
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return NUR_SITZUNG();
  const bau = bauPruefen(req); if (bau) return bau;
  let b: { ops?: unknown };
  try { b = await jsonBegrenzt(req, MAX_BYTES); } catch (e) { return jsonZuGross(e) ?? fehlerAntwort(400, 'Kein JSON.'); }
  const r = await socialSchreiben(b.ops, zugang.person, werAus(req));
  if (r.ok) return NextResponse.json({ ok: true, geaendert: r.geaendert, ...(await socialLage(zugang.person)) });
  if (r.status === 409) return fehlerAntwort(409, 'Inzwischen hat jemand anderes geändert — neu geladen, bitte noch einmal.', { konflikt: true, konflikte: r.konflikte, ...(await socialLage(zugang.person)) });
  return fehlerAntwort(r.status, r.fehler);
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  if (zugang.dienst) return NUR_SITZUNG();
  const bau = bauPruefen(req); if (bau) return bau;
  let b: { aktion?: unknown; kanalId?: unknown; plattform?: unknown; text?: unknown; stand?: unknown; zuordnung?: unknown; verbindungId?: unknown };
  try { b = await jsonBegrenzt(req, MAX_IMPORT_BYTES); } catch (e) { return jsonZuGross(e) ?? fehlerAntwort(400, 'Kein JSON.'); }
  if (typeof b.aktion === 'string' && AUTOMATIK_AKTIONEN.includes(b.aktion)) return automatik(req, zugang.person, b);
  if (b.aktion !== 'import-vorschau' && b.aktion !== 'import') return fehlerAntwort(400, `aktion: import-vorschau, import, ${AUTOMATIK_AKTIONEN.join(', ')}.`);
  if (!(SOCIAL_PLATTFORMEN as readonly unknown[]).includes(b.plattform)) return fehlerAntwort(400, `plattform: ${SOCIAL_PLATTFORMEN.join(', ')}.`);
  if (typeof b.text !== 'string' || !b.text.trim()) return fehlerAntwort(400, 'Die Datei ist leer.');
  // Stand der Zahlen = Tag des Exports (Vorgabe heute); nie in der Zukunft, höchstens ein Jahr zurück.
  const heute = localDay();
  const stand = b.stand === undefined || b.stand === '' ? heute : b.stand;
  if (!istKalendertag(stand) || stand > heute || stand < tagPlus(heute, -366)) return fehlerAntwort(400, 'Stand der Zahlen: ein Tag bis heute (höchstens ein Jahr zurück).');
  // Nur Kanäle, die diese Person sehen darf — ein fremder „nur ich“-Kanal ist hier „nicht gefunden“.
  const datei = socialFuerPerson(await ladeSocial(), zugang.person);
  const kanal = datei.kanaele.find(k => k.id === b.kanalId);
  if (!kanal) return fehlerAntwort(404, 'Kanal nicht gefunden.');
  const folgen = datei.folgen.filter(f => f.kanalId === kanal.id);
  const vorschau = importVorschau(b.text, b.plattform as SocialPlattform, folgen, stand);
  if (b.aktion === 'import-vorschau') return NextResponse.json({ ok: true, vorschau });
  // Ausdrückliche Zuordnung (Zeile → Folge bzw. '' = nicht übernehmen) gewinnt; nur Folgen DIESES Kanals.
  const z = (b.zuordnung && typeof b.zuordnung === 'object' ? b.zuordnung : {}) as Record<string, unknown>;
  const ops = vorschau.zeilen.flatMap(row => {
    const wahl = z[String(row.zeile)];
    if (wahl === '') return []; // ausdrücklich „nicht übernehmen“
    const folgeId = typeof wahl === 'string' && folgen.some(f => f.id === wahl) ? wahl : row.folgeId;
    return folgeId ? [{ op: 'messung' as const, folgeId, messung: row.messung }] : [];
  });
  if (!ops.length) return fehlerAntwort(400, 'Keine Zeile passt eindeutig zu einer Folge — nichts übernommen.', { vorschau });
  // In Paketen der erlaubten Größe schreiben — jedes Paket alles oder nichts.
  let letzte: Awaited<ReturnType<typeof socialSchreiben>> | null = null;
  for (let i = 0; i < ops.length; i += SOCIAL_GRENZEN.ops) {
    letzte = await socialSchreiben(ops.slice(i, i + SOCIAL_GRENZEN.ops), zugang.person, werAus(req));
    if (!letzte.ok) return fehlerAntwort(letzte.status, `${letzte.fehler} (ab Zeile ${i + 1} nicht übernommen)`, { uebernommen: i });
  }
  return NextResponse.json({ ok: true, uebernommen: ops.length, uebersprungen: vorschau.zeilen.length - ops.length, ...(await socialLage(zugang.person)) });
}

// ── Automatik (27.10.): Entwürfe auf Knopfdruck, Verbindungen ─────────────────────────────────────────────────────────────────────
const AUTOMATIK_AKTIONEN = ['entwuerfe', 'linkedin-start', 'probe-verbinden', 'trennen'];

async function automatik(req: Request, person: string, b: { aktion?: unknown; kanalId?: unknown; plattform?: unknown; verbindungId?: unknown }) {
  const datei = socialFuerPerson(await ladeSocial(), person);
  if (b.aktion === 'trennen') {
    const v = (await ladeVerbindungen()).find(x => x.id === b.verbindungId && datei.kanaele.some(k => k.id === x.kanalId));
    if (!v) return fehlerAntwort(404, 'Verbindung nicht gefunden.');
    await verbindungTrennen(v.id, 'von Hand getrennt');
    await protokolliere('social', [{ liste: 'verbindungen', op: 'geaendert', id: v.id, felder: ['zustand'] }], werAus(req)).catch(() => {});
    return NextResponse.json({ ok: true, ...(await socialLage(person)) });
  }
  const kanal = datei.kanaele.find(k => k.id === b.kanalId);
  if (!kanal) return fehlerAntwort(404, 'Kanal nicht gefunden.');
  if (b.aktion === 'entwuerfe') {
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const r = await socialRedaktionLauf({ person, kanalId: kanal.id, max: 3 });
    return NextResponse.json({ ok: true, lauf: r, ...(await socialLage(person)) });
  }
  // Verbinden: bei einer Personenmarke nur die Person selbst (sie meldet sich mit IHREM Konto an).
  if (kanal.art === 'person' && kanal.person && kanal.person !== person) return fehlerAntwort(403, `Eine Personenmarke verbindet nur die Person selbst. ${NUR_PERSON_SELBST}`);
  if (b.aktion === 'linkedin-start') {
    if (!kanal.plattformen.includes('linkedin')) return fehlerAntwort(400, 'Der Kanal ist nicht auf LinkedIn.');
    if (!linkedinEingerichtet()) return fehlerAntwort(409, 'LinkedIn ist in dieser Instanz noch nicht eingerichtet (Server-Umgebung, siehe UPDATES.md).');
    return NextResponse.json({ ok: true, url: await linkedinStart(person, kanal.id) });
  }
  // probe-verbinden: nur in einer Demo-Instanz bzw. in Tests — nichts verlässt MAKE OS.
  if (!probeErlaubt()) return fehlerAntwort(404, 'Probe-Verbindungen gibt es nur in einer Demo-Instanz.');
  if (!(SOCIAL_PLATTFORMEN as readonly unknown[]).includes(b.plattform) || !kanal.plattformen.includes(b.plattform as SocialPlattform)) return fehlerAntwort(400, 'Diese Plattform gehört nicht zum Kanal.');
  await verbindungSetzen({ kanalId: kanal.id, plattform: b.plattform as SocialPlattform, anbieter: 'probe', konto: 'Probe', verbundenVon: person, geheim: { accessToken: 'probe' } });
  return NextResponse.json({ ok: true, ...(await socialLage(person)) });
}
