// ─── MAKE OS — Gesellschafts-Register (/os/unternehmen, 04.10.) ─────────────────────────────────────────────────
// GET                                   → { gesellschaften (mit stand, luecken, verweise), personen, namen, geloescht }
//                                         `geloescht` (DSGVO-Nachtrag 04.10.): Vermerke endgültig gelöschter Gesellschaften/Verträge —
//                                         Kennung, Name, Tag, Datei-Kennungen — damit Bezüge als „(gelöscht)“ lesbar bleiben
// GET  ?papierkorb=1                    → dazu die Gesellschaften im Papierkorb
// GET  ?wahl=1                          → nur { id, name, status } je Gesellschaft (Auswahl in Deals/Mandaten/Produkten/Planung)
// GET  ?suche=kontakte|firmen&q=…       → höchstens 20 Treffer { id, name } aus dem CRM (Gesellschafter, Parteien, Beteiligungen)
// GET  ?suche=register&q=…               → höchstens 8 Treffer der Schnellsuche (Gesellschaften, Verträge, Beschlüsse) mit Weg
// POST { felder, anfrageId }            → neue Gesellschaft `g-…` (Name Pflicht)
// PATCH { id, stand, felder }                          → Steckbrief
// PATCH { id, stand, liste, eintrag, eintragId? }      → Gesellschafter / Beteiligung / Vertrag anlegen bzw. ändern
// PATCH { id, stand, liste, eintragId, aktion }        → archivieren · zurueckholen · loeschen · wiederherstellen · endgueltig
// PATCH { id, stand, aktion, ziel? }                   → dieselben Aktionen für die Gesellschaft (ziel: ruhend | aufgeloest)
// Zugang (Plattform-Regel „Trennung serverseitig“): NUR der Haushalt des Inhabers und nur eine Person mit Haushalt am
// Konto — alles andere (Testkunde, Partner/Teammitglied eines anderen Haushalts, Dienstweg ohne Person) 403, beim Lesen
// wie beim Schreiben. Cap-Table und Verträge sind sensibel: die Antwort enthält nie etwas aus einem anderen Haushalt.
// Speicher und Schreibstelle: lib/gesellschaften/server.ts (dieselbe wie /api/crm/gesellschaften).

import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ladeKonten } from '@/lib/zugang/konten';
import { kontakteFuerVerarbeitung } from '@/lib/crm/verarbeitung';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { gesellschaftFuerAnzeige } from '@/lib/crm/gesellschaften';
import { istGesellschaftId } from '@/lib/einheiten';
import { imPapierkorb } from '@/lib/eintraege/sicher';
import { suchPasst } from '@/lib/text/such-norm';
import { WEG } from '@/lib/wege';
import {
  alleGesellschaften, anzeigeName, registerTreffer, registerLuecken, gesellschaftVerweise, aktiveEintraege, REGISTER_LISTEN, EINTRAG_AKTIONEN,
  type RegisterGesellschaft, type RegisterListe, type EintragAktion, type CrmVerweisTeil, type Bezug,
} from '@/lib/gesellschaften/modell';
import {
  ladeRegister, standVon, registerAendern, registerAnlegen, crmVerweisTeil, steckbrief, eintragSchreiben, eintragHandeln, gesellschaftHandeln,
  vertragsErinnerungen, type Ergebnis,
} from '@/lib/gesellschaften/server';
import type { Kontakt } from '@/lib/make-one/crm';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Das Gesellschafts-Register gehört zum Haushalt des Inhabers — für dieses Konto nicht freigegeben.' };
const fehler = (text: string, status: number, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler: text, ...extra }, { status });
const MAX_BODY = 64 * 1024;

async function zugang(req: Request): Promise<{ person: string; haushalt: string } | null> {
  if (!(await imHaushaltDesInhabers(req))) return null;
  const h = await haushaltVon(req);
  return h ? { person: h.person, haushalt: h.haushalt } : null;
}

/** Für den Browser: IBAN maskiert, Stand, Lücken, Verweise (für die Rückfrage vor dem Löschen). */
function zurAnzeige(g: RegisterGesellschaft, alle: RegisterGesellschaft[], crm: CrmVerweisTeil) {
  return { ...gesellschaftFuerAnzeige(g), name: anzeigeName(g), stand: standVon(g), luecken: registerLuecken(g), verweise: gesellschaftVerweise(g.id, alle, crm) };
}

const kontaktName = (k: Pick<Kontakt, 'vorname' | 'nachname'>) => `${k.vorname ?? ''} ${k.nachname ?? ''}`.replace(/\s+/g, ' ').trim() || 'Kontakt ohne Namen';

/** Namen der verwendeten Bezüge (Personen des Haushalts, CRM-Kontakte, CRM-Firmen) — nur die, die vorkommen. */
async function namenFuer(alle: RegisterGesellschaft[], personen: { id: string; name: string }[]): Promise<Record<string, string>> {
  const bezuege: Bezug[] = alle.flatMap(g => [
    ...aktiveEintraege(g.gesellschafter).map(x => x.wer), ...aktiveEintraege(g.vertraege).flatMap(v => v.parteien), ...aktiveEintraege(g.organe).map(o => o.wer),
    ...aktiveEintraege(g.beteiligungen).map(b => ({ art: 'firma' as const, id: b.firmaId })),
  ]);
  const namen: Record<string, string> = {};
  for (const p of personen) namen[`person:${p.id}`] = p.name;
  for (const g of alle) namen[`gesellschaft:${g.id}`] = anzeigeName(g);
  const kontakte = new Set(bezuege.filter(b => b.art === 'kontakt').map(b => b.id));
  const firmen = new Set(bezuege.filter(b => b.art === 'firma').map(b => b.id));
  // Nur Anzeige eines schon gespeicherten Bezugs (auch eingeschränkte, Art. 18 — der Name wird nicht weiterverarbeitet).
  if (kontakte.size) for (const k of await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })) if (kontakte.has(k.id)) namen[`kontakt:${k.id}`] = kontaktName(k);
  if (firmen.size) {
    const { ladeCrm } = await import('@/lib/crm/speicher');
    for (const f of (await ladeCrm()).firmen) if (firmen.has(f.id)) namen[`firma:${f.id}`] = f.name;
  }
  return namen;
}

async function personenImHaushalt(haushalt: string) {
  const { konten } = await ladeKonten();
  return konten.filter(k => k.haushalt === haushalt).map(k => ({ id: k.speicher, name: k.name }));
}

export async function GET(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  leseZugriff(req, 'gesellschaften'); // Lese-Protokoll (05.10.)
  const q = new URL(req.url).searchParams;
  const d = await ladeRegister(z.haushalt);
  const kopf = { headers: { 'Cache-Control': 'no-store' } };

  if (q.get('wahl') === '1') {
    return NextResponse.json({ ok: true, gesellschaften: alleGesellschaften(d).map(g => ({ id: g.id, name: anzeigeName(g), ...(g.status ? { status: g.status } : {}) })) }, kopf);
  }
  const suche = q.get('suche');
  if (suche === 'register') {
    const frage = (q.get('q') ?? '').trim().slice(0, 80);
    if (frage.length < 2) return NextResponse.json({ ok: true, treffer: [] }, kopf);
    const treffer = registerTreffer(alleGesellschaften(d), t => suchPasst([...t], frage)).map(t => ({
      art: t.art, id: t.id, titel: t.titel, unter: t.unter, space: 'business' as const,
      href: WEG.unternehmen(t.gesellschaftId, t.art === 'vertrag' ? 'vertraege' : t.art === 'beschluss' ? 'organe' : undefined),
    }));
    return NextResponse.json({ ok: true, treffer }, kopf);
  }
  if (suche === 'kontakte' || suche === 'firmen') {
    const frage = (q.get('q') ?? '').toLocaleLowerCase('de-DE').trim().slice(0, 80);
    if (frage.length < 2) return NextResponse.json({ ok: true, treffer: [] }, kopf);
    let treffer: { id: string; name: string }[] = [];
    if (suche === 'kontakte') {
      const l = await kontakteFuerVerarbeitung(); // Art. 18: eingeschränkte Kontakte sind nicht neu wählbar
      treffer = l.map(k => ({ id: k.id, name: kontaktName(k) })).filter(k => k.name.toLocaleLowerCase('de-DE').includes(frage));
    } else {
      const { ladeCrm } = await import('@/lib/crm/speicher');
      treffer = (await ladeCrm()).firmen.map(f => ({ id: f.id, name: f.name })).filter(f => f.name.toLocaleLowerCase('de-DE').includes(frage));
    }
    return NextResponse.json({ ok: true, treffer: treffer.sort((a, b) => a.name.localeCompare(b.name, 'de')).slice(0, 20) }, kopf);
  }

  const mitKorb = q.get('papierkorb') === '1';
  const alle = alleGesellschaften(d, { mitPapierkorb: true });
  const [crm, personen] = await Promise.all([crmVerweisTeil(), personenImHaushalt(z.haushalt)]);
  const sichtbar = mitKorb ? alle : alle.filter(g => !imPapierkorb(g));
  return NextResponse.json({
    ok: true, gesellschaften: sichtbar.map(g => zurAnzeige(g, alle, crm)), personen, namen: await namenFuer(alle, personen),
    geloescht: Array.isArray(d?.geloescht) ? d!.geloescht : [],
  }, kopf);
}

async function lesenJson(req: Request): Promise<Record<string, unknown> | null> {
  const n = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(n) && n > MAX_BODY) return null;
  try { const b = await req.json(); return b && typeof b === 'object' && !Array.isArray(b) ? b as Record<string, unknown> : null; } catch { return null; }
}

async function antwort(r: Ergebnis, haushalt: string) {
  if (r.konflikt) {
    const alle = alleGesellschaften(await ladeRegister(haushalt), { mitPapierkorb: true });
    return fehler('Wurde inzwischen geändert — neu geladen, bitte noch einmal.', 409, { aktuell: zurAnzeige(r.konflikt, alle, await crmVerweisTeil()) });
  }
  if (r.fehler?.length) return fehler(r.fehler.map(f => f.text).join(' · '), r.status ?? 400, { felder: r.fehler });
  if (r.weg) return NextResponse.json({ ok: true, weg: true });
  const alle = alleGesellschaften(await ladeRegister(haushalt), { mitPapierkorb: true });
  return NextResponse.json({ ok: true, gesellschaft: zurAnzeige(r.g!, alle, await crmVerweisTeil()) });
}

export async function POST(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const b = await lesenJson(req);
  if (!b) return fehler('Kein gültiges JSON (höchstens 64 KB).', 400);
  const felder = b.felder && typeof b.felder === 'object' && !Array.isArray(b.felder) ? b.felder as Record<string, unknown> : {};
  const wer = werAus(req);
  const lauf = async () => {
    const r = await registerAnlegen(z.haushalt, z.person, felder, wer);
    const a = await antwort(r, z.haushalt);
    return { status: a.status, body: await a.json() };
  };
  const e = b.anfrageId !== undefined ? await einmalig('gesellschaft-anlegen', b.anfrageId, lauf) : await lauf();
  return NextResponse.json(e.body, { status: e.status });
}

export async function PATCH(req: Request) {
  const z = await zugang(req);
  if (!z) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  const b = await lesenJson(req);
  if (!b) return fehler('Kein gültiges JSON (höchstens 64 KB).', 400);
  if (!istGesellschaftId(b.id)) return fehler('id: kdc, kdv, ug oder g-….', 400);
  const wer = werAus(req);
  const aktion = b.aktion as EintragAktion | 'endgueltig' | undefined;
  const aktionOk = aktion === undefined || aktion === 'endgueltig' || EINTRAG_AKTIONEN.includes(aktion);
  if (!aktionOk) return fehler('aktion: archivieren, zurueckholen, loeschen, wiederherstellen oder endgueltig.', 400);

  if (b.liste !== undefined) {
    if (!REGISTER_LISTEN.includes(b.liste as RegisterListe)) return fehler('liste: gesellschafter, beteiligungen oder vertraege.', 400);
    const liste = b.liste as RegisterListe;
    const eintragId = typeof b.eintragId === 'string' ? b.eintragId : undefined;
    if (aktion) {
      if (!eintragId) return fehler('eintragId fehlt.', 400);
      return antwort(await registerAendern(z.haushalt, z.person, b.id, b.stand, wer, eintragHandeln(liste, eintragId, aktion)), z.haushalt);
    }
    if (!b.eintrag || typeof b.eintrag !== 'object') return fehler('eintrag fehlt.', 400);
    const r = await registerAendern(z.haushalt, z.person, b.id, b.stand, wer, eintragSchreiben(liste, b.eintrag, eintragId));
    // Erinnerung vor „kündigen bis“: liegt der Stichtag schon im Vorlauf, sofort (sonst im Morgenlauf).
    if (r.g && liste === 'vertraege') await vertragsErinnerungen(z.haushalt);
    return antwort(r, z.haushalt);
  }
  if (aktion) {
    const ziel = b.ziel === 'aufgeloest' ? 'aufgeloest' : 'ruhend';
    const crm = aktion === 'endgueltig' ? await crmVerweisTeil() : {};
    return antwort(await registerAendern(z.haushalt, z.person, b.id, b.stand, wer, gesellschaftHandeln(aktion, crm, ziel)), z.haushalt);
  }
  if (!b.felder || typeof b.felder !== 'object' || Array.isArray(b.felder)) return fehler('felder fehlen.', 400);
  return antwort(await registerAendern(z.haushalt, z.person, b.id, b.stand, wer, steckbrief(b.felder as Record<string, unknown>)), z.haushalt);
}
