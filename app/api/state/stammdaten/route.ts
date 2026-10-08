// ─── MAKE OS — Stammdaten ───────────────────────────────────────────────────
// Firmen, Konten, Personen, Ansprechpartner. Bleibt auf dem Rechner: kein
// Cloud-Dienst, keine offene Datenbank — das war der Grund, das hier zu bauen.
//
// 08.10. spät (Datenschutz vor dem Upload, L27 — Regeln rein in lib/stammdaten/regeln.ts):
//   GET    jeder Satz mit `stand`; Steuer-ID, SV-Nummer und IBAN nur für die Person, der der Satz gehört — alle anderen
//          bekommen sie nicht (IBAN maskiert), auch nicht der Systemlauf. Die Oberfläche verdeckt nicht mehr bloß.
//   PATCH  { liste, ops: [{ op: 'teil', id, felder, stand } | { op: 'upsert', eintrag } | { op: 'delete', id, stand }] } —
//          Einzeländerungen mit Stand (409 + Ansicht), geschützte Felder nur durch die Person selbst (403), über den
//          Grenzen 413 (nie gekürzt), Bau-Kennung (409 neu laden). Der frühere PUT (ganzer Bestand, ohne Stand) ist weg.
//          Gegen Massenlöschung schützt listePatchen (mehr als die halbe Liste → abgelehnt); protokolliert ohne Werte.

import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { karteiZugang, KARTEI_GESPERRT, inhaberSpeicher } from '@/lib/zugang/haushalt-inhaber';
import { ohnePerson } from '@/lib/zugang/tor';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { listePatchen, opsFehler, type ListenOp } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { bauPruefen } from '@/lib/bau/pruefen';
import { ladeKonten } from '@/lib/zugang/konten';
import {
  STAMM_LISTEN, LEER, GRENZEN, GESCHUETZT, VERBOTEN, ID_MUSTER, fuerBetrachter, felderPruefen, anwenden, aendertGeschuetztes, hatGeschuetztes,
  besitzer, besitzNach, besitzStempeln, type Ctx, type Satz, type StammListe, type Stammdaten,
} from '@/lib/stammdaten/regeln';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function kontext(): Promise<Ctx> {
  const { konten } = await ladeKonten();
  return { konten: konten.map(k => ({ speicher: k.speicher, name: k.name })), inhaber: await inhaberSpeicher() };
}

/** Die Ansicht einer Person: jeder Satz mit Stand (vom gespeicherten Satz), geschützte Felder fremder Sätze weg. */
function ansicht(d: Stammdaten | null, person: string | null, ctx: Ctx): Stammdaten {
  const voll = { ...LEER, ...(d ?? {}) } as Stammdaten;
  const mit = { ...voll } as Stammdaten;
  for (const l of STAMM_LISTEN) mit[l] = mitStand(Array.isArray(voll[l]) ? voll[l] : []) as Satz[];
  return fuerBetrachter(mit, person, ctx);
}

export async function GET(req: Request) {
  // Haushalt des Inhabers (28.09., K1 #66/#67).
  const z = await karteiZugang(req);
  if (!z) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  return NextResponse.json(ansicht(await loadJson<Stammdaten>('stammdaten'), z.person, await kontext()));
}

type RohOp = { op?: unknown; id?: unknown; felder?: unknown; eintrag?: unknown; stand?: unknown };

export async function PATCH(req: Request) {
  const z = await karteiZugang(req);
  if (!z) return NextResponse.json(KARTEI_GESPERRT, { status: 403 });
  // Schreiben nur mit Person (Sitzung bzw. Dienstweg MIT Person) — geschützte Felder gehören einer Person.
  if (!z.person) return ohnePerson();
  const ich = z.person;
  const bau = bauPruefen(req); if (bau) return bau;
  let body: { liste?: unknown; ops?: unknown };
  try { body = await jsonBegrenzt(req, 512_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein gültiges JSON.' }, { status: 400 }); }
  const liste = body.liste as StammListe;
  if (!STAMM_LISTEN.includes(liste)) return NextResponse.json({ ok: false, fehler: 'Unbekannte Liste.' }, { status: 400 });
  const opsF = opsFehler(body.ops, GRENZEN.ops);
  if (opsF) return NextResponse.json({ ok: false, fehler: opsF }, { status: Array.isArray(body.ops) ? 413 : 400 });

  // Rohe Änderungen prüfen — VOR der Sperre: Form, Grenzen (413), Kennungen.
  const ops: ListenOp<Satz>[] = [];
  for (const o of body.ops as RohOp[]) {
    const stand = typeof o?.stand === 'string' && o.stand ? { stand: o.stand } : {};
    const id = typeof o?.id === 'string' ? o.id : typeof (o?.eintrag as { id?: unknown })?.id === 'string' ? String((o.eintrag as { id: string }).id) : '';
    if (!ID_MUSTER.test(id)) return NextResponse.json({ ok: false, fehler: 'Kennung fehlt oder ist ungültig.' }, { status: 400 });
    if (o?.op === 'delete') { ops.push({ op: 'delete', id, ...stand }); continue; }
    const p = felderPruefen(o?.op === 'teil' ? o.felder : o?.eintrag);
    if (p.f) return NextResponse.json({ ok: false, fehler: p.f.fehler }, { status: p.f.status });
    if (o?.op === 'teil') ops.push({ op: 'teil', id, felder: p.felder!, ...stand });
    else if (o?.op === 'upsert') ops.push({ op: 'upsert', eintrag: { ...anwenden({ id } as Satz, p.felder!), id }, ...stand });
    else return NextResponse.json({ ok: false, fehler: 'Unbekannte Änderung (teil, upsert, delete).' }, { status: 400 });
  }

  const ctx = await kontext();
  const GRENZE_TEXT = `Abgelehnt: ${liste} hätte mehr als ${GRENZEN.saetze} Einträge. Nichts gespeichert.`;
  const STAND_FEHLT = 'Nicht gespeichert: Änderungen an bestehenden Einträgen brauchen ihren Stand — bitte neu laden.';
  /** Wer darf was: geschützte Felder ändern bzw. einen Satz mit geschützten Werten löschen nur die Person selbst. */
  const pruefen = (alle: Satz[], os: ListenOp<Satz>[]): string | null => {
    const nachId = new Map(alle.map(s => [s.id, s]));
    let neu = 0;
    for (const o of os) {
      const alt = nachId.get(o.op === 'upsert' ? o.eintrag!.id : o.id!);
      // Bestehende Sätze nur mit Stand (zu zweit gewinnt nie still der Letzte) — neu angelegte brauchen keinen.
      if (alt && !o.stand) return STAND_FEHLT;
      if (o.op === 'delete') { if (alt && hatGeschuetztes(liste, alt) && besitzer(liste, alt, ctx) !== ich) return VERBOTEN; continue; }
      if (o.op === 'teil' && !alt) continue; // unbekannt/gelöscht — listePatchen meldet den Konflikt (409)
      const felder = o.op === 'teil' ? (o.felder as Record<string, string | null>) : (o.eintrag as Record<string, string | null>);
      if (!alt) neu++;
      if (!aendertGeschuetztes(liste, alt, felder)) continue;
      if (besitzNach(liste, alt, (o.eintrag ?? {}) as Partial<Satz>, ich, ctx) !== ich) return VERBOTEN;
    }
    return alle.length + neu > GRENZEN.saetze ? GRENZE_TEXT : null;
  };

  const r = await listePatchen<Satz, Stammdaten & Record<string, unknown>>('stammdaten', liste, ops, 10, undefined, {
    pruefen,
    // `teil`: nur die geschickten Felder; geschützte Felder eines fremden Satzes bleiben (die Prüfung oben lehnt Änderungen ab).
    teil: (alt, felder) => besitzStempeln(liste, anwenden(alt, felder as Record<string, string | null>), alt, ich, ctx),
    // Läuft nach `teil` UND bei `upsert` über einen bestehenden Satz (listePatchen): geschützte Felder bleiben, wie sie waren,
    // wenn nicht die Person schreibt, der sie gehören (maskierte Ansicht im Browser) — die Prüfung oben hat Änderungen schon abgelehnt.
    vereinen: (neu, alt) => {
      const n = { ...neu } as Satz;
      if (besitzNach(liste, alt, n, ich, ctx) !== ich) for (const f of GESCHUETZT[liste]) { if (alt[f] !== undefined) n[f] = alt[f]; else delete n[f]; }
      return besitzStempeln(liste, n, alt, ich, ctx);
    },
    neu: e => besitzStempeln(liste, e, undefined, ich, ctx),
    danach: d => ({ ...d, stand: new Date().toISOString() }),
    wer: werAus(req),
  });
  const sicht = ansicht(await loadJson<Stammdaten>('stammdaten'), ich, ctx);
  if (r.fehler === VERBOTEN) return NextResponse.json({ ok: false, fehler: VERBOTEN, ansicht: sicht }, { status: 403 });
  if (r.fehler === GRENZE_TEXT) return NextResponse.json({ ok: false, fehler: GRENZE_TEXT, ansicht: sicht }, { status: 413 });
  if (r.fehler === STAND_FEHLT) return NextResponse.json({ ok: false, fehler: STAND_FEHLT, ansicht: sicht }, { status: 409 });
  if (r.konflikte?.length) {
    // Konflikte ohne den Rohsatz (der trüge geschützte Felder) — die gefilterte Ansicht reicht zum Abgleich.
    return NextResponse.json({ ok: false, fehler: r.fehler, konflikte: r.konflikte.map(k => ({ id: k.id, grund: k.grund })), ansicht: sicht }, { status: 409 });
  }
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler ?? 'Nicht gespeichert.', ansicht: sicht }, { status: 409 });
  return NextResponse.json({ ok: true, angewandt: r.angewandt, ansicht: sicht });
}
