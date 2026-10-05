// ─── MAKE OS — Kalender-Einstellungen ───────────────────────────────────────
// Kevins Ansage: „Man soll sich jeweils die andere Sicht angucken können, also
// Malin oder Kevin. Und man soll selber Termine einstellen können — mit
// Routine und Fokus und Termin und Aufgabe. Bau auch sofort die Einstellungen
// dahinter."
//
// Hier steht, welcher Apple-Kalender zu wem gehört und wie lange die Arten
// standardmäßig dauern. Ohne diese Zuordnung landet jeder Termin im selben
// Kalender — dann sieht niemand, wem er gehört.
//
// F1 (Prüfer 1 #8, 29.09.): nur der Haushalt des Inhabers (`kalenderZugang`, wie der Kalender selbst — die Zuordnung
// entscheidet, wessen Termine „privat“ sind), Schreiben mit Build-Kennung (`bauPruefen`, 409 `neuLaden`).
// PUT { teil: {…} } ändert NUR die genannten Felder — auf dem frischen Stand in der Sperre, verschachtelte Felder
// (kalender, dauer, space, belegt, steuerVorlage) je Schlüssel gemischt. So überschreibt ein Fenster mit altem Stand
// nie, was ein anderes Fenster (oder Malin) inzwischen geändert hat (Client: F2 N7, Kalender.tsx `einstSetzen`). Der alte
// Weg (ganzer Stand im Körper, oberste Ebene ersetzt) geht weiter (z. B. SteuernView).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { bauPruefen } from '@/lib/bau/pruefen';
import { EINSTELLUNGEN_LEER, einstellungenSauber, einstellungenTeilMischen, mitGoogleNamen, type KalenderEinstellungen } from '@/lib/kalender/einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Datei = KalenderEinstellungen;
const LEER = EINSTELLUNGEN_LEER;
const sauber = einstellungenSauber;

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export async function GET(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  return NextResponse.json(await mitGoogleNamen(sauber(await loadJson<Datei>('kalender-einstellungen'))));
}

export async function PUT(req: Request) {
  if (!(await kalenderZugang(req))) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const alt = bauPruefen(req); if (alt) return alt;
  let body: Partial<Datei> & { teil?: unknown };
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!istObjekt(body)) return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 });
  if (body.teil !== undefined && !istObjekt(body.teil)) return NextResponse.json({ ok: false, error: '`teil` muss ein Objekt sein.' }, { status: 400 });
  const teil = body.teil as Record<string, unknown> | undefined;
  const next = await updateJson<Datei>('kalender-einstellungen', current => {
    const jetzt = sauber(current ?? LEER);
    return sauber(teil ? einstellungenTeilMischen(jetzt, teil) : { ...jetzt, ...body });
  });
  return NextResponse.json({ ok: true, ...next });
}
