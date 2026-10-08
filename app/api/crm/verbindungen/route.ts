// ─── Markttraktion · Verbindungsprüfung (28.09.) ────────────────────────────
// GET                          → { ampel, befunde, geprueft, reparierbar } — alle Verbindungen
//                                im Hintergrund geprüft (lib/crm/verbindungen.ts). ETag über den
//                                Stand aller beteiligten Speicher + Tag → 304, wenn nichts neu ist.
// POST { ids, vorschau: true } → { aenderungen } — was „Reparieren“ täte; schreibt NICHTS.
// POST { ids }                 → schreibt je Speicher in EINER Sperre (crm über aendereCrm,
//                                kontakte / import-konflikte / Dateiablage / tasks über updateJson) und
//                                rechnet dabei auf dem frischen Stand neu. Nur sichere Fälle
//                                (tote Verweise entfernen, Follow-ups ohne Ziel absagen, veraltete
//                                Konflikte abräumen, fehlende Dateien markieren) — nie werden
//                                ganze Datensätze gelöscht.
//                                Seit 28.09. (Mandat an Zielen und Zeit) auch Ziele (gemeinsam + je Person),
//                                Meilensteine und Fokus-Blöcke: tote Mandats-/Firmen-Bezüge entfernen.
//                                Seit 29.09. (Kalender K1): `kalender-bezug` (Einträge zu gelöschten Terminen, tote
//                                Kennungen) und Fokus-Blöcke aus gelöschten Fokuszeiten (`terminUid`).
//
// Zugang: Haushalt des Inhabers UND eine benannte Person (Sitzung oder Dienstweg mit
// x-make-person) — Default-Deny, kein Rückfall auf ein Erstkonto. Befunde tragen nur Kennungen; seit F3 (29.09.)
// kommt für die Anzeige `namen` mit (Kennung → Name/Titel, lib/crm/verbindungen-namen.ts) — nur Auflösbares aus den
// geladenen Beständen, Termin-Titel nur, wenn der Termin für die fragende Person nicht maskiert ist.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { updateJson, speicherStand } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from '@/lib/crm/speicher';
import { KONFLIKT_SPEICHER, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { ablageName } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { verbindungenPruefen, verbindungenReparieren, verbindungsAmpel, istReparierbar, PRUEFUNG_IDS, REPARIERBAR, type VerbindungsBestaende } from '@/lib/crm/verbindungen';
import { ladeVerbindungsBestaende, verbindungsStand, aufgabenBezugZurueckschreiben } from '@/lib/crm/verbindungen-laden';
import { familieTageBereinigen } from '@/lib/crm/verbindungen-familie';
import { zieleDateiBereinigen, meilensteinDateiBereinigen, zeitDateiBereinigen } from '@/lib/crm/verbindungen-planung';
import { zeitAendern } from '@/lib/zeitmessung/speicher';
import { toteTermine, toteKennungen, zeitDateiTermineBereinigen } from '@/lib/crm/verbindungen-kalender';
import { ladeKalenderPruefung } from '@/lib/crm/verbindungen-laden';
import { bezuegeBereinigen, bezuegeUmhaengen } from '@/lib/kalender/bezug-server';
import { waisenPaare, verwaisteEventTermine } from '@/lib/crm/verbindungen-termine';
import { maskieren, type BezugFeld } from '@/lib/kalender/bezug';
import { beispielNamen, type NamenTermin } from '@/lib/crm/verbindungen-namen';
import { termineLesen } from '@/lib/kalender/termine-lesen';
import { ladeEinstellungen } from '@/lib/kalender/einstellungen';
import { tagPlus } from '@/lib/kalender/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Nur im Haushalt des Inhabers und mit benannter Person.' };

async function zugang(req: Request): Promise<string | null> {
  const w = await imHaushaltDesInhabers(req);
  const person = personStreng(req);
  return w && person ? person : null;
}

/** Termine für die Namen — gelesen ohne Abgleich, maskiert für die fragende Person (wie GET /api/kalender/bezug). */
async function termineFuerNamen(person: string, heute: string): Promise<NamenTermin[]> {
  const g = await termineLesen(await ladeEinstellungen(), tagPlus(heute, -400), tagPlus(heute, 401)).catch(() => null);
  return (g?.termine ?? []).map(t => maskieren(t, person)).map(t => ({ id: t.id, titel: t.titel, start: t.start, ...(t.maskiert ? { maskiert: true as const } : {}) }));
}

export async function GET(req: Request) {
  const person = await zugang(req);
  if (!person) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const heute = localDay();
  // Die Namen hängen an der Person (maskierte Termine) — sie gehört ins ETag.
  const etag = etagAus('verbindungen-2', await verbindungsStand(), await speicherStand(['calendar-cache', 'kalender-einstellungen']), heute, person);
  const nichtsNeu = unveraendert(req, etag);
  if (nichtsNeu) return nichtsNeu;
  const bestaende = await ladeVerbindungsBestaende(heute, person);
  const befunde = verbindungenPruefen(bestaende);
  // Termine nur lesen, wenn eine Kennung offen bleibt (sonst reicht der Bestand).
  const ohneTermine = beispielNamen(bestaende, befunde);
  const offen = befunde.some(b => b.beispiele.some(id => !ohneTermine[id]));
  const namen = offen ? beispielNamen(bestaende, befunde, await termineFuerNamen(person, heute)) : ohneTermine;
  return jsonAntwort(req, { ok: true, heute, ampel: verbindungsAmpel(befunde), befunde, namen, geprueft: PRUEFUNG_IDS.length, pruefungen: PRUEFUNG_IDS, reparierbar: REPARIERBAR }, etag);
}

export async function POST(req: Request) {
  const person = await zugang(req);
  if (!person) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zuGross(req, 20_000)) return ZU_GROSS(20_000);
  let body: { ids?: unknown; vorschau?: unknown };
  try { body = await jsonBegrenzt(req, 20_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ids) ? body.ids.slice(0, 60) : [];
  const ids = Array.from(new Set(roh.filter(istReparierbar)));
  if (!ids.length || ids.length !== new Set(roh).size) return NextResponse.json({ ok: false, fehler: `ids: nur reparierbare Befunde (${REPARIERBAR.join(', ')}).` }, { status: 400 });

  const heute = localDay();
  const jetzt = new Date().toISOString();
  const alt = await ladeVerbindungsBestaende(heute, person);
  const vorschau = verbindungenReparieren(alt, ids, jetzt, person);
  if (body.vorschau === true) return NextResponse.json({ ok: true, vorschau: true, aenderungen: vorschau.aenderungen });
  // S1 #19: Reparieren schreibt — nur aus dem aktuellen Bau (Dienstweg ausgenommen); die Vorschau oben liest nur.
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;

  // Schreiben: je Speicher EINE Sperre, darin auf dem frischen Stand neu gerechnet — was
  // inzwischen jemand anderes geändert hat, geht nicht verloren.
  const speicher = new Set(vorschau.aenderungen.map(a => a.speicher));
  let stand: VerbindungsBestaende = alt;
  if (speicher.has('crm')) {
    const crm = await aendereCrm(cur => verbindungenReparieren({ ...stand, crm: cur }, ids, jetzt, person).bestaende.crm);
    stand = { ...stand, crm };
  }
  if (speicher.has('kontakte')) {
    const f = await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const d = cur ?? { kontakte: [] };
      return { ...d, kontakte: verbindungenReparieren({ ...stand, kontakte: d.kontakte ?? [] }, ids, jetzt, person).bestaende.kontakte };
    }, werAus(req));
    stand = { ...stand, kontakte: f.kontakte };
  }
  if (speicher.has('import-konflikte')) {
    await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => (cur ? verbindungenReparieren({ ...stand, konflikte: cur }, ids, jetzt, person).bestaende.konflikte ?? cur : cur) as KonfliktStand);
  }
  if (speicher.has('dateien') && alt.haushalt && alt.dateien) {
    const platte = alt.dateien.aufPlatte;
    await updateJson<{ eintraege: DateiEintrag[] }>(ablageName(alt.haushalt), cur => {
      if (!cur) return cur as unknown as { eintraege: DateiEintrag[] };
      const r = verbindungenReparieren({ ...stand, dateien: { eintraege: cur.eintraege ?? [], aufPlatte: platte } }, ids, jetzt, person).bestaende.dateien;
      return { ...cur, eintraege: r?.eintraege ?? cur.eintraege };
    });
  }
  // Mandat an Zielen und Zeit (28.09.): tote Bezüge gegen den frischen CRM-Stand — je Speicher eine Sperre.
  if (speicher.has('ziele') || speicher.has('meilensteine') || speicher.has('zeit')) {
    // Ziele für den Ziel-Bezug der Meilensteine (01.10.): alle Bestände, alle Horizonte.
    const lebend = { mandate: new Set(stand.crm.mandate.map(x => x.id)), firmen: new Set(stand.crm.firmen.map(x => x.id)), ziele: new Set([...(alt.planung?.ziele ?? []).flatMap(s => s.ziele.map(z => z.id)), ...(alt.planung?.weitereZiele ?? [])]) };
    if (speicher.has('ziele')) {
      // Nur der gemeinsame Bestand und die EIGENEN Ziele der fragenden Person (08.10.: `ladePlanung` mit Betrachter) — nie fremde.
      for (const s of alt.planung?.ziele ?? []) {
        await updateJson<Record<string, unknown>>(s.speicher, cur => (cur ? zieleDateiBereinigen(cur, lebend).datei : cur as unknown as Record<string, unknown>));
      }
    }
    if (speicher.has('meilensteine')) {
      // Verborgene Meilensteine (08.10.: an einem nicht geteilten eigenen Ziel einer anderen Person) bleiben unberührt.
      const ausnehmen = new Set(alt.planung?.weitereMeilensteine ?? []);
      await updateJson<{ meilensteine?: unknown }>('meilensteine', cur => (cur ? meilensteinDateiBereinigen(cur, lebend, new Set(ids), ausnehmen).datei : cur as unknown as { meilensteine?: unknown }));
    }
    if (speicher.has('zeit') && ids.includes('zeit-mandat-tot')) {
      for (const p of alt.fokus ?? []) await zeitAendern(p.person, d => zeitDateiBereinigen(d, lebend).datei);
    }
  }
  // K6a (29.09.): Waisen neu zuordnen (Bezug umhängen — die Meetings hat der Kartei-Schritt oben schon umgehängt) und
  // Termine gelöschter Events in iCloud entfernen (auf dem frischen Stand; mit Gästen nie — Teilnehmer-Sperre).
  let terminHinweis = '';
  if (ids.includes('termin-waise-neu') || ids.includes('event-termin-verwaist')) {
    const frisch = await ladeVerbindungsBestaende(heute, person);
    if (ids.includes('termin-waise-neu')) {
      const tasksKurz = frisch.aufgaben?.liste ?? [];
      // Die Kartei ist schon umgehängt — die Paare kommen aus dem Stand VOR dem Schreiben (`alt`), geprüft gegen den frischen Bezug.
      await bezuegeUmhaengen(waisenPaare(frisch.kalender, frisch.termine, alt.kontakte, tasksKurz));
    }
    if (ids.includes('event-termin-verwaist')) {
      const r = await verwaisteTermineEntfernen(verwaisteEventTermine(frisch.kalender, new Set(frisch.crm.events.map(x => x.id))), person);
      terminHinweis = r.mitGaesten ? ` · ${r.mitGaesten} ${r.mitGaesten === 1 ? 'Termin hat' : 'Termine haben'} Gäste — bitte in Apple absagen` : '';
      if (r.fehler) terminHinweis += ` · ${r.fehler} nicht entfernt (iCloud)`;
    }
  }
  // Kalender (29.09., K1): auf dem frischen Stand (iCloud-UIDs, Bezüge, CRM, Aufgaben) neu gerechnet — je Speicher eine Sperre.
  if (speicher.has('kalender-bezug') || (speicher.has('zeit') && ids.includes('zeit-termin-tot'))) {
    const kal = await ladeKalenderPruefung();
    const tot = toteTermine(kal, alt.fokus);
    if (speicher.has('kalender-bezug')) {
      const lebend: Partial<Record<BezugFeld, ReadonlySet<string>>> = {
        kontaktId: new Set(stand.kontakte.map(x => x.id)), firmaId: new Set(stand.crm.firmen.map(x => x.id)), mandatId: new Set(stand.crm.mandate.map(x => x.id)),
        dealId: new Set(stand.crm.chancen.map(x => x.id)), eventId: new Set(stand.crm.events.map(x => x.id)),
        ...(alt.aufgaben ? { aufgabeId: new Set(alt.aufgaben.liste.map(t => t.id)) } : {}),
      };
      const totJeFeld: Partial<Record<BezugFeld, Set<string>>> = {};
      if (ids.includes('kalender-bezug-kennung-tot')) {
        for (const x of kal.bezuege) for (const f of toteKennungen(x.kennungen, lebend)) (totJeFeld[f] ??= new Set()).add(x.kennungen[f]!);
      }
      await bezuegeBereinigen(ids.includes('termin-uid-tot') ? tot.bezuege : [], totJeFeld);
    }
    if (speicher.has('zeit') && ids.includes('zeit-termin-tot') && tot.bloecke.length) {
      const weg = new Set(tot.bloecke);
      for (const p of alt.fokus ?? []) await zeitAendern(p.person, d => zeitDateiTermineBereinigen(d, weg).datei);
    }
  }
  // F2 N4: Wichtige Tage ohne Menschen — in der Sperre auf dem frischen Familien-Stand des Inhabers.
  if (speicher.has('familie') && alt.haushalt) {
    await updateJson<{ menschen?: { id: string }[]; tage?: { id: string; menschId?: string; datum?: string }[] }>(`familie--${alt.haushalt}`, cur => (cur ? familieTageBereinigen(cur).datei : cur as unknown as { tage?: [] }));
  }
  // Aufgaben (28.09. spät): nur `bezug` der betroffenen Aufgaben, auf dem aktuellen Stand in der Sperre.
  if (speicher.has('tasks')) await aufgabenBezugZurueckschreiben(stand, werAus(req));
  const befunde = verbindungenPruefen(await ladeVerbindungsBestaende(heute, person));
  return NextResponse.json({ ok: true, aenderungen: vorschau.aenderungen.map(a => (a.befundId === 'event-termin-verwaist' && terminHinweis ? { ...a, text: `${a.text}${terminHinweis}` } : a)), ampel: verbindungsAmpel(befunde), befunde });
}

/** Termine gelöschter Events in iCloud löschen (K6a) — über den Server-Schreibweg (Änderungsprotokoll, Bezug weg). */
async function verwaisteTermineEntfernen(schluessel: readonly string[], person: string): Promise<{ weg: number; mitGaesten: number; fehler: number }> {
  const { terminLoeschenServer } = await import('@/lib/kalender/termin-server');
  const { EinladungNoetig } = await import('@/lib/kalender/icloud');
  let weg = 0, mitGaesten = 0, fehler = 0;
  for (const s of schluessel) {
    // Nur ganze Termine (kein einzelnes Vorkommen einer Serie) — Serien bleiben in Apple.
    if (s.includes('::')) { fehler++; continue; }
    try { await terminLoeschenServer(s, { art: 'person', person }); weg++; }
    catch (e) { if (e instanceof EinladungNoetig) mitGaesten++; else fehler++; }
  }
  return { weg, mitGaesten, fehler };
}
