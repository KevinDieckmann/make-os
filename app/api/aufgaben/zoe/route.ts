// ─── MAKE OS — ZOE an Aufgaben (Paket C4, 28.09. spät) ──────────────────────
// Kevin: „ZOE soll ihre eigenen Aufgaben und Stapel bekommen, die sie abarbeiten kann und wir freigeben.“
//
// GET  ?id=<Aufgabe>  → { ok, ki, auftraggeberin, darfEntscheiden, vorschlag|null } — den Vorschlag sieht nur die
//                       Auftraggeberin (Regel 5: der Stapel gehört ihr); ohne id nur { ok, ki }.
// POST { aktion, … }:
//   geben     { id, stand?, hinweis? }          — „An ZOE geben“ (Hinweis → Kommentar „Hinweis an ZOE: …“)
//   zurueck   { id, stand? }                    — von ZOE zurückholen (nur die Auftraggeberin)
//   arbeiten  { max?, id? }                     — „ZOE jetzt arbeiten lassen“: nur eigene Aufträge; Systemlauf
//                                                 (Dienstweg ohne Person) = alle. modellSchranke zuerst.
//   freigeben { id, stapelId?, stand? }         — Vorschläge übernehmen (Stand/409)
//   ablehnen  { id, stapelId?, grund?, nochmal?, hinweis? } — „nochmal“ = gleich wieder an ZOE
//   freigeben … eingabe?, trotzdem?          — Häkchen (#94: abgewählte Felder leer), 409 mit `diff`, wenn Status/Deadline
//                                                 seit dem Vorschlag geändert wurden (#95); `trotzdem` überschreibt bewusst
//   charge-zurueck { charge }                  — „Charge rückgängig“ (#97, lib/zoe/aufgaben-charge.ts)
// GET ?chargen=1 → die Chargen der Person (freigegebene ZOE-Vorschläge je Lauf/Sammelfreigabe).
// Zugang: Haushalt des Inhabers (Sitzung oder Dienstweg mit Person dieses Haushalts), sonst 403.
// ZOE versendet über diese Route nichts und löscht nichts.

import { jsonBegrenzt } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { bauPruefen } from '@/lib/bau/pruefen';
import { hasAnthropicKey, guthabenLeer } from '@/lib/anthropic';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { modellSchranke, zuGross } from '@/lib/zugang/umfang';
import { ladeAufgabenSicht } from '@/lib/aufgaben/speicher';
import { auftraggeberinVon, vorschlagSauber, zoeStandLesen } from '@/lib/aufgaben/zoe';
import { chargenFuer, chargeZurueck, CHARGE_ID } from '@/lib/zoe/aufgaben-charge';
import { hole } from '@/lib/zoe/stapel';
import { anZoeGeben, vonZoeZurueck, vorschlagFreigeben, vorschlagAblehnen } from '@/lib/zoe/aufgaben-werkzeuge';
import { zoeAufgabenLauf, LAUF_STANDARD } from '@/lib/zoe/aufgaben-lauf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });
const MAX_BYTES = 20_000;
const kiDa = () => hasAnthropicKey() && !guthabenLeer();
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  const q = new URL(req.url).searchParams;
  if (q.get('chargen') === '1') return NextResponse.json({ ok: true, chargen: await chargenFuer(zugang.person) });
  const id = q.get('id') ?? '';
  if (!id) return NextResponse.json({ ok: true, ki: kiDa() });
  if (!ID.test(id)) return NextResponse.json({ ok: false, error: 'Ungültige Kennung.' }, { status: 400 });
  const t = (await ladeAufgabenSicht(zugang.person)).tasks.find(x => x.id === id);
  if (!t) return NextResponse.json({ ok: false, error: 'Aufgabe nicht gefunden.' }, { status: 404 });
  const auftraggeberin = auftraggeberinVon(t);
  const darfEntscheiden = !!auftraggeberin && auftraggeberin === zugang.person;
  const v = darfEntscheiden && t.zoe?.stapelId ? await hole(t.zoe.stapelId) : null;
  const passt = v && v.bezug?.art === 'aufgabe' && v.bezug.id === t.id && v.person === zugang.person;
  return NextResponse.json({
    ok: true, ki: kiDa(), auftraggeberin, darfEntscheiden,
    vorschlag: passt ? {
      id: v!.id, zeit: v!.zeit, status: v!.status, titel: v!.titel, nachher: v!.nachher, anlass: v!.anlass ?? null,
      ...(v!.grund ? { grund: v!.grund } : {}), inhalt: vorschlagSauber(v!.eingabe, t.id),
      // Stand beim Vorschlag (#95) — damit die Ansicht vor dem Klick zeigt, was sich inzwischen geändert hat.
      stand: zoeStandLesen(v!.eingabe._stand), charge: typeof v!.eingabe._charge === 'string' ? v!.eingabe._charge : null,
    } : null,
  });
}

interface Eingang { aktion?: string; id?: unknown; stapelId?: unknown; stand?: unknown; hinweis?: unknown; grund?: unknown; nochmal?: unknown; max?: unknown; eingabe?: unknown; trotzdem?: unknown; charge?: unknown }

/** Häkchen (#94): nur die vier Felder, als einfache Werte — alles andere fällt weg (die Säuberung prüft danach). */
function haekchenLesen(e: unknown): Record<string, unknown> | null {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const o = e as Record<string, unknown>;
  const raus: Record<string, unknown> = {};
  for (const k of ['entwurf', 'status', 'deadline'] as const) if (typeof o[k] === 'string') raus[k] = o[k];
  if (Array.isArray(o.unteraufgaben)) raus.unteraufgaben = o.unteraufgaben.filter(x => typeof x === 'string').slice(0, 20);
  return raus;
}

export async function POST(req: Request) {
  const alterBau = bauPruefen(req); // alter Tab nach dem Hochladen (29.09., A2) — Dienstweg (Takt) ist ausgenommen
  if (alterBau) return alterBau;
  if (zuGross(req, MAX_BYTES)) return NextResponse.json({ ok: false, error: 'Abgelehnt: zu groß.' }, { status: 413 });
  let b: Eingang;
  try { b = (await jsonBegrenzt(req, MAX_BYTES)) as Eingang; } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (!b || typeof b !== 'object') return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 });
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : undefined);

  if (b.aktion === 'arbeiten') {
    // Systemlauf (Takt, Dienstweg ohne Person) oder eine Person des Haushalts — sie arbeitet dann nur deren Aufträge ab.
    const zugang = await imHaushaltOderSystemlauf(req);
    if (!zugang) return GESPERRT();
    const schranke = modellSchranke(req); if (schranke) return schranke;
    const nur = str(b.id, 80);
    const r = await zoeAufgabenLauf({ person: zugang.person, max: typeof b.max === 'number' ? b.max : LAUF_STANDARD, ...(nur && ID.test(nur) ? { nur } : {}) });
    return NextResponse.json({ ...r }, { status: r.ok ? 200 : 500 });
  }

  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  if (b.aktion === 'charge-zurueck') {
    const charge = str(b.charge, 80) ?? '';
    if (!CHARGE_ID.test(charge)) return NextResponse.json({ ok: false, error: 'Charge fehlt.' }, { status: 400 });
    return NextResponse.json({ ok: true, bericht: await chargeZurueck(charge, zugang.person) });
  }
  const id = str(b.id, 80) ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, error: 'Aufgabe fehlt.' }, { status: 400 });
  const stand = str(b.stand, 40) || undefined;
  const antwort = async (r: { ok: true } | { ok: false; status: number; fehler: string; konflikt?: boolean }, extra: Record<string, unknown> = {}) => {
    if (r.ok) return NextResponse.json({ ok: true, ...extra });
    const diff = 'diff' in r ? (r as { diff?: unknown }).diff : undefined;
    return NextResponse.json({ ok: false, error: r.fehler, ...(r.konflikt ? { konflikt: true } : {}), ...(diff ? { diff } : {}) }, { status: r.status });
  };

  switch (b.aktion) {
    case 'geben': {
      const hinweis = typeof b.hinweis === 'string' ? b.hinweis : undefined;
      return antwort(await anZoeGeben(id, zugang.person, { hinweis, stand }));
    }
    case 'zurueck':
      return antwort(await vonZoeZurueck(id, zugang.person, { stand }));
    case 'freigeben':
    case 'ablehnen': {
      const t = (await ladeAufgabenSicht(zugang.person)).tasks.find(x => x.id === id);
      const stapelId = str(b.stapelId, 80) || t?.zoe?.stapelId;
      if (!t || !stapelId) return NextResponse.json({ ok: false, error: 'Kein Vorschlag an dieser Aufgabe.' }, { status: 404 });
      if (b.aktion === 'freigeben') {
        const eingabe = haekchenLesen(b.eingabe);
        const r = await vorschlagFreigeben(stapelId, zugang.person, { stand, aufgabeId: id, ...(eingabe ? { eingabe } : {}), trotzdem: b.trotzdem === true });
        return r.ok ? NextResponse.json({ ok: true, ergebnis: r.wert.text }) : antwort(r);
      }
      const hinweis = typeof b.hinweis === 'string' ? b.hinweis : undefined;
      return antwort(await vorschlagAblehnen(stapelId, zugang.person, { grund: typeof b.grund === 'string' ? b.grund : undefined, nochmal: b.nochmal === true, hinweis, aufgabeId: id }));
    }
    default:
      return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  }
}
