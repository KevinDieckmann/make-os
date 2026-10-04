// ─── MAKE OS — Lichtfäden v2: GET /api/lichtfaeden (03.10.2026) ─────────────
// Liefert den Ausschnitt des Strang-Baums für eine Ebene, einen Zeitraum und eine Person — samt Engstellen.
//   GET ?wurzel=gesamt|space:…|thema:…|ziel:<id>|ms:<id> &person=ich|alle|<speicher> &von=YYYY-MM-DD &bis=YYYY-MM-DD
//   `ziel:<id>` eines abgeleiteten Ziels (Kaskade, auch „angepasst“) wird auf sein Jahresziel umgerechnet (`wurzelAufloesen`).
//   → { ok, ansicht, engstellen, text, personen: [{ id, name, ich }], sicht }
// Zugang: angemeldete Person im Haushalt des Inhabers (`imHaushaltDesInhabers`, streng, Regel 5). Der Dienstweg ist hier
// GESPERRT (403): kein Hintergrundlauf braucht die Sicht heute — ZOE liest die Quellen selbst über ihre eigenen Werkzeuge.
// Wird sie später gebraucht, dann nur lesend mit `x-make-person` (die Privat-Regel hängt am Betrachter).
// Privat-Regel: Private Stränge der ANDEREN Person (Kalender privat/Gesundheit, „nur ich“-Aufgaben samt ALLER Unteraufgaben
// darunter — `nurIchBesitzer`, dieselbe Regel wie `darfSehen` —, Gesundheit) kommen nur als anonymes „belegt“-Gewicht an —
// ohne Titel, Link, Thema, Ziel (lib/lichtfaeden/modell.ts). „nur ich“ ohne bestimmbare Anlegerin sieht niemand; Familie
// „nur ich“ der anderen Person kommt gar nicht erst an. Prüfung: tests/lichtfaeden-datenschutz.test.ts.
// Schnell: Sammeln gemerkt (60 s, ungültig bei jeder Schreibung), die Ansicht selbst ist reine Rechnung; gzip ab 16 KB.
// Ausschlag des Strahls NUR aus Abweichungen (lib/lichtfaeden/abweichung.ts, angedockt: abweichung-quellen-server.ts).
// Keine Personendaten in Logs.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { jsonAntwort } from '@/lib/http/json-antwort';
import { localDay } from '@/lib/zeit';
import { anfrageAus } from '@/lib/lichtfaeden/anfrage';
import { ansichtText, baueBaum, personenSicht, rechneAnsicht } from '@/lib/lichtfaeden/baum';
import { engstellen } from '@/lib/lichtfaeden/fokus';
import { wurzelAufloesen } from '@/lib/lichtfaeden/modell';
import { straengeGemerkt } from '@/lib/lichtfaeden/sammeln-server';
import { abweichungenSammeln } from '@/lib/lichtfaeden/abweichung';
import { abweichungsQuellen } from '@/lib/lichtfaeden/abweichung-quellen-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = { ok: false, fehler: 'Lichtfäden nur für eine angemeldete Person im Haushalt des Inhabers.' } as const;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang || zugang.dienst) return NextResponse.json(GESPERRT, { status: 403 });
  const ich = zugang.person;
  const heute = localDay();
  const a = anfrageAus(new URL(req.url).searchParams, heute);
  if (!a.ok) return NextResponse.json({ ok: false, fehler: a.fehler }, { status: 400 });
  const { von, bis } = a.anfrage;

  const sammlung = await straengeGemerkt(ich, von, bis, heute);
  // Ein abgeleitetes Ziel (Kaskade, auch angepasst) zeigt die Fäden seines Jahresziels — aufgelöst NUR hier.
  const wurzel = wurzelAufloesen(a.anfrage.wurzel, sammlung.zielWurzel);
  const personen = sammlung.personen.map(p => ({ ...p, ich: p.id === ich }));
  // „ich“ = die Person der Sitzung; eine genannte Person muss im Haushalt sein; „alle“ = alle Stränge.
  const sicht = a.anfrage.person === 'ich' ? ich : a.anfrage.person;
  if (sicht !== 'alle' && !personen.some(p => p.id === sicht)) return NextResponse.json({ ok: false, fehler: 'Diese Person gehört nicht zum Haushalt.' }, { status: 400 });

  const baum = baueBaum(sammlung.knoten, sammlung.straenge);
  // Abweichungen (der Grund jedes Ausschlags): aus den Strängen (schon nach der Privat-Regel) + angedockte Quellen, je mit Privat-Regel.
  const abweichungen = abweichungenSammeln({ heute, von, bis, straenge: baum.straenge }, ich, await abweichungsQuellen(ich, heute));
  const e = rechneAnsicht(baum, { wurzel, von, bis, heute, person: personenSicht(sicht === 'alle' ? null : sicht), abweichungen });
  if (!e) return NextResponse.json({ ok: false, fehler: 'Diese Ebene gibt es nicht (mehr).' }, { status: 404 });
  return jsonAntwort(req, {
    ok: true, heute, sicht, personen, ansicht: e.ansicht,
    engstellen: engstellen(e.ansicht, e.straenge, e.buendelVon, heute),
    text: ansichtText(e.ansicht),
  });
}
