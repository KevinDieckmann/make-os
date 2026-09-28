// ─── CRM — Bestand (Chancen, Mandate, Leistungen, Events, Sitzungen) ────────
// GET   → Bestand + was der Code daraus rechnet (Prognose, MRR, Konzentration,
//         Lage je Mandat, Ampel je Chance, Zahlen je Event)
// PATCH → { ops: [{ liste, op: 'upsert'|'delete'|'teil', eintrag|id|felder, stand? }] } — Einzeländerungen,
//         damit Kevin und Malin gleichzeitig arbeiten können.
// IBAN (28.09., H4): Firmen gehen nur mit maskierter IBAN (+ ibanGesetzt) hinaus.
// Stand (28.09., K4): jeder Eintrag geht mit `stand` hinaus (lib/crm/crm-stand.ts). Veralteter Stand → 409 mit
//         `konflikte` (aktueller Eintrag); ohne Stand nur `teil`/`delete`. Löschen einer Firma/eines Mandats mit
//         Verweisen → 409 mit `sperren` (nur Anzahlen). Über der Grenze der Deal-Historie → 413. Nichts geschrieben.

import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { personAus } from '@/lib/zoe/raum';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';
import { ladeCrm, aendereCrm, wendeCrmAn, type CrmAnwendung } from '@/lib/crm/speicher';
import { prognose, gesundheit, winRate, STUFEN, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { mandatLage, mrr, konzentration, zahlungAusRechnungen, type RechnungKurz } from '@/lib/crm/kunden';
import { eventZahlen } from '@/lib/crm/events';
import type { CrmBestand, Firma } from '@/lib/crm/typen';
import { crmMitStand, type CrmKonflikt, type VerweisKontext } from '@/lib/crm/crm-stand';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { opsFehler } from '@/lib/store/patch-liste';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ablaufNachziehen } from '@/lib/crm/angebot-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** IBAN der Firmen nur maskiert — der `stand` bleibt der des gespeicherten Eintrags. */
function ohneIban(b: CrmBestand): CrmBestand {
  return { ...b, firmen: b.firmen.map(f => (f.zahlung?.iban ? { ...f, zahlung: zahlungMaskiert(f.zahlung) } : f)) };
}
const konfliktOhneIban = (k: CrmKonflikt): CrmKonflikt => {
  const z = (k.aktuell as Partial<Firma> | undefined)?.zahlung;
  return k.liste === 'firmen' && k.aktuell && z?.iban ? { ...k, aktuell: { ...k.aktuell, zahlung: zahlungMaskiert(z) } } : k;
};

async function antwort(b: CrmBestand, ich: string) {
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const rechnungen = (await loadJson<{ rechnungen?: RechnungKurz[] }>('finanzplan'))?.rechnungen ?? [];
  return {
    // IBAN der Firmen nur maskiert (28.09., H4) — Speichern: maskiert/leer = unverändert (lib/crm/speicher.ts `ibanSchuetzen`).
    // Stand je Eintrag (28.09., K4) aus dem GESPEICHERTEN Eintrag — erst danach maskieren, sonst passt er nie.
    ok: true, ich, heute, stand: ohneIban(crmMitStand(b)),
    stufen: STUFEN.map(s => ({ ...s, p: wahrscheinlichkeit(s.id, b.wahrscheinlichkeiten) })),
    prognose: prognose(b.chancen, heute, b.wahrscheinlichkeiten),
    gewinnquote: winRate(b.chancen, localDay()),
    ampel: Object.fromEntries(b.chancen.map(c => [c.id, gesundheit(c, heute)])),
    mandate: Object.fromEntries(b.mandate.map(m => [m.id, mandatLage(m, heute, rechnungen)])),
    zahlung: Object.fromEntries(b.mandate.map(m => [m.id, zahlungAusRechnungen(m, rechnungen, heute)])),
    mrr: mrr(b.mandate), konzentration: konzentration(b.mandate),
    events: Object.fromEntries(b.events.map(e => [e.id, eventZahlen(e, b.teilnahmen, kontakte, b.chancen)])),
    termine: ((await loadJson<{ kommend?: Record<string, { titel: string; start: string }> }>('crm-signale'))?.kommend) ?? {},
  };
}

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const person = personAus(req);
  // Alles, woraus die Antwort entsteht: die vier Speicher, der Tag (Ampeln, Prognose) und wer fragt.
  // Angebote (28.09.): gestellte nach „gültig bis“ → abgelaufen, bevor der Stand gerechnet wird (schreibt nur bei Bedarf).
  await ablaufNachziehen();
  const etag = etagAus('b3', await speicherStand(['crm', 'kontakte', 'finanzplan', 'crm-signale']), localDay(), person);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  return jsonAntwort(req, await antwort(await ladeCrm(), person), etag);
}

export async function PATCH(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let body: { ops?: ListenOp[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  // Mehr als 200 auf einmal: ablehnen, nie still kürzen (28.09., K1) — vorher fielen alle ab der 201. weg.
  const ueber = opsFehler(body.ops, 200);
  if (ueber && Array.isArray(body.ops)) return NextResponse.json({ ok: false, fehler: ueber }, { status: 413 });
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  const person = personAus(req);
  // Löschsperre (28.09., K4): Personen und Rechnungen liegen außerhalb des CRM-Bestands — nur laden, wenn gelöscht wird.
  const loescht = ops.some(o => o?.op === 'delete' && (o.liste === 'firmen' || o.liste === 'mandate'));
  const kontext: VerweisKontext = loescht
    ? { kontakte: (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [], rechnungen: (await loadJson<{ rechnungen?: VerweisKontext['rechnungen'] }>('finanzplan'))?.rechnungen ?? [] }
    : {};
  const halter: { r?: CrmAnwendung } = {};
  const b = await aendereCrm(cur => { halter.r = wendeCrmAn(cur, ops, new Date().toISOString(), person, kontext); return halter.r.bestand; }, werAus(req));
  const e = halter.r!;
  if (e.konflikte.length) return NextResponse.json({ ok: false, fehler: 'Wurde inzwischen geändert — neu geladen, bitte noch einmal.', konflikte: e.konflikte.map(konfliktOhneIban) }, { status: 409 });
  if (e.sperren.length) return NextResponse.json({ ok: false, fehler: e.sperren.map(s => s.text).join(' · '), sperren: e.sperren }, { status: 409 });
  if (e.grenze.length) return NextResponse.json({ ok: false, fehler: e.grenze.join(' · ') }, { status: 413 });
  // Regeln (28.09.): Angebote nur übers Tool, Produkt ohne Leistungstext nicht „aktiv“ — ganze Änderung abgelehnt.
  if (e.abgelehnt?.length) return NextResponse.json({ ok: false, fehler: e.abgelehnt.join(' · '), abgelehnt: e.abgelehnt }, { status: 409 });
  // Abgelehnte Stufenwechsel (Regeln, 27.09.) kommen als `fehler` mit — der Stand ist trotzdem der aktuelle.
  return jsonAntwort(req, { ...(await antwort(b, person)), angewandt: e.angewandt, fehler: e.fehler });
}
