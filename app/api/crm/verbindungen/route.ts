// ─── Markttraktion · Verbindungsprüfung (28.09.) ────────────────────────────
// GET                          → { ampel, befunde, geprueft, reparierbar } — alle Verbindungen
//                                im Hintergrund geprüft (lib/crm/verbindungen.ts). ETag über den
//                                Stand aller beteiligten Speicher + Tag → 304, wenn nichts neu ist.
// POST { ids, vorschau: true } → { aenderungen } — was „Reparieren“ täte; schreibt NICHTS.
// POST { ids }                 → schreibt je Speicher in EINER Sperre (crm über aendereCrm,
//                                kontakte / import-konflikte / Dateiablage über updateJson) und
//                                rechnet dabei auf dem frischen Stand neu. Nur sichere Fälle
//                                (tote Verweise entfernen, Follow-ups ohne Ziel absagen, veraltete
//                                Konflikte abräumen, fehlende Dateien markieren) — nie werden
//                                ganze Datensätze gelöscht.
//                                Seit 28.09. (Mandat an Zielen und Zeit) auch Ziele (gemeinsam + je Person),
//                                Meilensteine und Fokus-Blöcke: tote Mandats-/Firmen-Bezüge entfernen.
//
// Zugang: Haushalt des Inhabers UND eine benannte Person (Sitzung oder Dienstweg mit
// x-make-person) — Default-Deny, kein Rückfall auf ein Erstkonto. Antworten tragen nur
// Kennungen, nie Namen oder Inhalte.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { updateJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { etagAus, jsonAntwort, unveraendert } from '@/lib/http/json-antwort';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { aendereCrm } from '@/lib/crm/speicher';
import { KONFLIKT_SPEICHER, type KonfliktStand } from '@/lib/crm/import-konflikte';
import { ablageName } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { verbindungenPruefen, verbindungenReparieren, verbindungsAmpel, istReparierbar, PRUEFUNG_IDS, REPARIERBAR, type VerbindungsBestaende } from '@/lib/crm/verbindungen';
import { ladeVerbindungsBestaende, verbindungsStand } from '@/lib/crm/verbindungen-laden';
import { zieleDateiBereinigen, meilensteinDateiBereinigen, zeitDateiBereinigen } from '@/lib/crm/verbindungen-planung';
import { zeitAendern } from '@/lib/zeitmessung/speicher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEIN_ZUGANG = { ok: false, fehler: 'Nur im Haushalt des Inhabers und mit benannter Person.' };

async function zugang(req: Request): Promise<string | null> {
  const w = await imHaushaltDesInhabers(req);
  const person = personStreng(req);
  return w && person ? person : null;
}

export async function GET(req: Request) {
  if (!(await zugang(req))) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  const heute = localDay();
  const etag = etagAus('verbindungen', await verbindungsStand(), heute);
  const nichtsNeu = unveraendert(req, etag);
  if (nichtsNeu) return nichtsNeu;
  const befunde = verbindungenPruefen(await ladeVerbindungsBestaende(heute));
  return jsonAntwort(req, { ok: true, heute, ampel: verbindungsAmpel(befunde), befunde, geprueft: PRUEFUNG_IDS.length, pruefungen: PRUEFUNG_IDS, reparierbar: REPARIERBAR }, etag);
}

export async function POST(req: Request) {
  const person = await zugang(req);
  if (!person) return NextResponse.json(KEIN_ZUGANG, { status: 403 });
  if (zuGross(req, 20_000)) return ZU_GROSS(20_000);
  let body: { ids?: unknown; vorschau?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const roh = Array.isArray(body.ids) ? body.ids.slice(0, 60) : [];
  const ids = Array.from(new Set(roh.filter(istReparierbar)));
  if (!ids.length || ids.length !== new Set(roh).size) return NextResponse.json({ ok: false, fehler: `ids: nur reparierbare Befunde (${REPARIERBAR.join(', ')}).` }, { status: 400 });

  const heute = localDay();
  const jetzt = new Date().toISOString();
  const alt = await ladeVerbindungsBestaende(heute);
  const vorschau = verbindungenReparieren(alt, ids, jetzt, person);
  if (body.vorschau === true) return NextResponse.json({ ok: true, vorschau: true, aenderungen: vorschau.aenderungen });

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
    const lebend = { mandate: new Set(stand.crm.mandate.map(x => x.id)), firmen: new Set(stand.crm.firmen.map(x => x.id)) };
    if (speicher.has('ziele')) {
      for (const s of alt.planung?.ziele ?? []) {
        await updateJson<Record<string, unknown>>(s.speicher, cur => (cur ? zieleDateiBereinigen(cur, lebend).datei : cur as unknown as Record<string, unknown>));
      }
    }
    if (speicher.has('meilensteine')) {
      await updateJson<{ meilensteine?: unknown }>('meilensteine', cur => (cur ? meilensteinDateiBereinigen(cur, lebend).datei : cur as unknown as { meilensteine?: unknown }));
    }
    if (speicher.has('zeit')) {
      for (const p of alt.fokus ?? []) await zeitAendern(p.person, d => zeitDateiBereinigen(d, lebend).datei);
    }
  }
  const befunde = verbindungenPruefen(await ladeVerbindungsBestaende(heute));
  return NextResponse.json({ ok: true, aenderungen: vorschau.aenderungen, ampel: verbindungsAmpel(befunde), befunde });
}
