// ─── CRM — Bestand (Chancen, Mandate, Leistungen, Events, Sitzungen) ────────
// GET   → Bestand + was der Code daraus rechnet (Prognose, MRR, Konzentration,
//         Lage je Mandat, Ampel je Chance, Zahlen je Event)
// PATCH → { ops: [{ liste, op: 'upsert'|'delete'|'teil', eintrag|id|felder, stand? }] } — Einzeländerungen,
//         damit Kevin und Malin gleichzeitig arbeiten können.
// IBAN (28.09., H4): Firmen gehen nur mit maskierter IBAN (+ ibanGesetzt) hinaus.
// Stand (28.09., K4): jeder Eintrag geht mit `stand` hinaus (lib/crm/crm-stand.ts). Veralteter Stand → 409 mit
//         `konflikte` (aktueller Eintrag); ohne Stand nur `teil`/`delete`. Löschen einer Firma/eines Mandats mit
//         Verweisen → 409 mit `sperren` (nur Anzahlen). Über der Grenze der Deal-Historie → 413. Nichts geschrieben.

import { reihenDerInstanz } from '@/lib/crm/reihen-server';
import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { loadJson, speicherStand } from '@/lib/store/local-db';
import { jsonAntwort, unveraendert, etagAus } from '@/lib/http/json-antwort';
import { ablageName } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { localDay } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import type { ListenOp } from '@/lib/sync';
import { ladeCrmMitPapierkorb, aendereCrm, wendeCrmAn, type CrmAnwendung } from '@/lib/crm/speicher';
import { crmSicht, crmPapierkorb } from '@/lib/crm/ablage';
import { papierkorbMarke } from '@/lib/eintraege/sicher';
import { prognose, gesundheit, winRate, STUFEN, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { mandatLage, mrr, konzentration, zahlungAusRechnungen, type RechnungKurz } from '@/lib/crm/kunden';
import { eventZahlen } from '@/lib/crm/events';
import type { CrmBestand, Firma } from '@/lib/crm/typen';
import { crmMitStand, type CrmKonflikt, type VerweisKontext } from '@/lib/crm/crm-stand';
import { zahlungMaskiert } from '@/lib/crm/zahlung';
import { opsFehler } from '@/lib/store/patch-liste';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ablaufNachziehen } from '@/lib/crm/angebot-server';
import { eventSpiegelNachziehen, spiegelHinweiseMelden } from '@/lib/kalender/spiegel-server';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { privatAusgeblendetFuer } from '@/lib/zugang/konto-sicht-server';
import { crmFuerNurBusiness, crmOpsNurBusiness } from '@/lib/crm/nur-business';

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

async function antwort(voll0: CrmBestand, ich: string) {
  const heute = localDay();
  // Rolle „nur Business“ (02.11., R2-3 Fund 4): Produkte, Mandate, Deals, Angebote der Privat-Einheit (und Follow-ups daran) kommen gar nicht erst an —
  // EINE Filterstelle (lib/crm/nur-business.ts `crmFuerNurBusiness`), vor allem, was daraus gerechnet wird (MRR, Lage, Zahlung, Papierkorb).
  const voll = (await privatAusgeblendetFuer(ich)) ? crmFuerNurBusiness(voll0) : voll0;
  // Archiv & Papierkorb (04.10., lib/crm/ablage.ts): der Stand ohne Papierkorb — er kommt getrennt als `papierkorb` (nur
  // Kennung, Titel, Tag) für die Papierkorb-Ansichten der Listen. Alle Zahlen rechnen ohne ihn.
  const b = crmSicht(voll);
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const rechnungen = (await loadJson<{ rechnungen?: RechnungKurz[] }>('finanzplan'))?.rechnungen ?? [];
  return {
    // IBAN der Firmen nur maskiert (28.09., H4) — Speichern: maskiert/leer = unverändert (lib/crm/speicher.ts `ibanSchuetzen`).
    // Stand je Eintrag (28.09., K4) aus dem GESPEICHERTEN Eintrag — erst danach maskieren, sonst passt er nie.
    ok: true, ich, heute, stand: ohneIban(crmMitStand(b)), papierkorb: crmPapierkorb(voll),
    // Reihen dieser Instanz (14.10.: Instanz-Daten, Startwert ohne Server-Schritt) — der Browser setzt daraus seine Laufzeit-Liste.
    reihen: await reihenDerInstanz(voll),
    stufen: STUFEN.map(s => ({ ...s, p: wahrscheinlichkeit(s.id, b.wahrscheinlichkeiten) })),
    prognose: prognose(b.chancen, heute, b.wahrscheinlichkeiten),
    gewinnquote: winRate(b.chancen, localDay()),
    ampel: Object.fromEntries(b.chancen.map(c => [c.id, gesundheit(c, heute, b.wertelisten)])),
    mandate: Object.fromEntries(b.mandate.map(m => [m.id, mandatLage(m, heute, rechnungen)])),
    zahlung: Object.fromEntries(b.mandate.map(m => [m.id, zahlungAusRechnungen(m, rechnungen, heute)])),
    mrr: mrr(b.mandate), konzentration: konzentration(b.mandate),
    events: Object.fromEntries(b.events.map(e => [e.id, eventZahlen(e, b.teilnahmen, kontakte, b.chancen)])),
    // Der nächste Termin je Person kommt seit F3 (29.09.) aus dem Kalender-Leser der Akte (GET /api/kalender/bezug) —
    // eine Quelle für Kopf, Zusammenfassung und Termine; `crm-signale.kommend` ist abgelöst.
  };
}

export async function GET(req: Request) {
  // Person aus dem Zugang (28.09. abends, Regel 5): Sitzung oder Dienstweg MIT Person im Haushalt — kein Rückfall auf „kevin“.
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  leseZugriff(req, 'firmen'); // Lese-Protokoll (05.10.) — Firmen, Deals, Mandate, Angebote
  const person = zugang.person;
  // Alles, woraus die Antwort entsteht: die drei Speicher, der Tag (Ampeln, Prognose) und wer fragt.
  // Angebote (28.09.): gestellte nach „gültig bis“ → abgelaufen, bevor der Stand gerechnet wird (schreibt nur bei Bedarf).
  await ablaufNachziehen();
  const etag = etagAus('b5', await speicherStand(['crm', 'kontakte', 'finanzplan', 'crm-scoring']), localDay(), person);
  const gleich = unveraendert(req, etag);
  if (gleich) return gleich;
  return jsonAntwort(req, await antwort(await ladeCrmMitPapierkorb(), person), etag);
}

export async function PATCH(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  // Alter Tab nach dem Hochladen (29.09., A2): fremde Build-Kennung → 409 „bitte neu laden“ statt alter Regeln.
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let body: { ops?: ListenOp[] };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  // Mehr als 200 auf einmal: ablehnen, nie still kürzen (28.09., K1) — vorher fielen alle ab der 201. weg.
  const ueber = opsFehler(body.ops, 200);
  if (ueber && Array.isArray(body.ops)) return NextResponse.json({ ok: false, fehler: ueber }, { status: 413 });
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length) return NextResponse.json({ ok: false, fehler: 'Keine Änderungen.' }, { status: 400 });
  const person = zugang.person;
  // Rolle „nur Business“ (02.11., R2-3 Fund 4): Schreiben auf Deals, Mandate, Angebote, Produkte einer Privat-Einheit (bzw. Follow-ups daran) → 403, nichts gespeichert.
  if (await privatAusgeblendetFuer(person)) {
    const nein = crmOpsNurBusiness(await ladeCrmMitPapierkorb(), ops as Parameters<typeof crmOpsNurBusiness>[1]);
    if (nein) return NextResponse.json({ ok: false, fehler: nein }, { status: 403 });
  }
  // Löschsperre (28.09., K4): Personen, Rechnungen und (seit 28.09. abends, W6) die Einträge der Dateiablage liegen
  // außerhalb des CRM-Bestands — nur laden, wenn Firmen oder Mandate gelöscht werden.
  // Seit 04.10. auch, wenn eine Firma/ein Mandat in den Papierkorb soll (lib/crm/ablage.ts `neuImPapierkorb`: nur ohne Verweise); seit 02.11. auch Produkte
  // (Rechnungspositionen mit dem Produkt sperren das endgültige Löschen — R2-3 Fund 2).
  const loescht = ops.some(o => (o?.liste === 'firmen' || o?.liste === 'mandate' || o?.liste === 'leistungen') && (o.op === 'delete' || !!papierkorbMarke(((o.op === 'teil' ? o.felder : o.eintrag) ?? {}).geloeschtAm)));
  const haushalt = loescht ? await haushaltDesInhabers() : null;
  const kontext: VerweisKontext = loescht
    ? {
      kontakte: (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [],
      rechnungen: (await loadJson<{ rechnungen?: VerweisKontext['rechnungen'] }>('finanzplan'))?.rechnungen ?? [],
      dateien: haushalt ? ((await loadJson<{ eintraege?: DateiEintrag[] }>(ablageName(haushalt)))?.eintraege ?? []) : [],
    }
    : {};
  const halter: { r?: CrmAnwendung } = {};
  const b = await aendereCrm(cur => { halter.r = wendeCrmAn(cur, ops, new Date().toISOString(), person, kontext); return halter.r.bestand; }, werAus(req));
  const e = halter.r!;
  if (e.konflikte.length) return NextResponse.json({ ok: false, fehler: 'Wurde inzwischen geändert — neu geladen, bitte noch einmal.', konflikte: e.konflikte.map(konfliktOhneIban) }, { status: 409 });
  if (e.sperren.length) return NextResponse.json({ ok: false, fehler: e.sperren.map(s => s.text).join(' · '), sperren: e.sperren }, { status: 409 });
  if (e.grenze.length) return NextResponse.json({ ok: false, fehler: e.grenze.join(' · ') }, { status: 413 });
  // Produkt-Karte (19.10.): Unsinn in Preis-Teilen, Vertrag, Regeln … — ganze Änderung abgelehnt, nichts gespeichert.
  if (e.ungueltig?.length) return NextResponse.json({ ok: false, fehler: e.ungueltig.join(' · '), ungueltig: e.ungueltig }, { status: 400 });
  // Regeln (28.09.): Angebote nur übers Tool, Produkt ohne Leistungstext nicht „aktiv“ — ganze Änderung abgelehnt.
  if (e.abgelehnt?.length) return NextResponse.json({ ok: false, fehler: e.abgelehnt.join(' · '), abgelehnt: e.abgelehnt }, { status: 409 });
  // Event-Termine nachziehen (29.09., K5): Datum, Uhrzeit, Titel, Ort, Absage → der iCloud-Spiegel folgt
  // (lib/kalender/spiegel-server.ts). Im Hintergrund — die Änderung am Event steht schon. F1 #5: nie mehr still —
  // Hinweise (Kennung + Grund, nie Titel) ins Server-Protokoll und in die Glocke der Person, die geändert hat.
  const eventIds = ops.filter(o => o?.liste === 'events' && o.op !== 'delete').map(o => String(o.op === 'teil' ? o.id : o.eintrag?.id ?? '')).filter(Boolean);
  if (eventIds.length) {
    void eventSpiegelNachziehen(eventIds, werAus(req))
      .then(r => spiegelHinweiseMelden(r.hinweise, person))
      .catch(e => console.warn(`[spiegel] Events nicht nachgezogen: ${e instanceof Error ? `${e.name}: ${e.message.slice(0, 160)}` : 'Fehler'}`));
  }
  // Produkt archiviert bzw. in den Papierkorb (02.11., R2-3 Fund 7): steckt es in Vertriebler-Links, sagt der Hinweis es — dort erscheint es nicht mehr.
  const hinweise = [...(e.hinweise ?? []), ...(await linkHinweise(ops))];
  // Abgelehnte Stufenwechsel (Regeln, 27.09.) kommen als `fehler` mit — der Stand ist trotzdem der aktuelle.
  return jsonAntwort(req, { ...(await antwort(b, person)), angewandt: e.angewandt, fehler: e.fehler, ...(hinweise.length ? { hinweise } : {}) });
}

/** Hinweise „steckt in n Links“ für Produkte, die dieser Satz archiviert oder in den Papierkorb legt — wirft nie. */
async function linkHinweise(ops: ListenOp[]): Promise<string[]> {
  const ids = ops.filter(o => o?.liste === 'leistungen' && o.op !== 'delete').filter(o => { const f = ((o.op === 'teil' ? o.felder : o.eintrag) ?? {}) as Record<string, unknown>; return f.status === 'eingestellt' || !!papierkorbMarke(f.geloeschtAm); })
    .map(o => String(o.op === 'teil' ? o.id : o.eintrag?.id ?? '')).filter(Boolean);
  if (!ids.length) return [];
  try {
    const [{ ladeFormular }, { linksMitProdukt, linkHinweisBeimArchivieren }] = await Promise.all([import('@/lib/crm/formulare-speicher'), import('@/lib/crm/formulare')]);
    const links = (await ladeFormular()).links;
    return ids.map(id => linkHinweisBeimArchivieren(linksMitProdukt(links, id, localDay()))).filter(Boolean);
  } catch { return []; }
}
