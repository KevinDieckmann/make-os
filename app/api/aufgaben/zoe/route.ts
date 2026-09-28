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
// Zugang: Haushalt des Inhabers (Sitzung oder Dienstweg mit Person dieses Haushalts), sonst 403.
// ZOE versendet über diese Route nichts und löscht nichts.

import { NextResponse } from 'next/server';
import { hasAnthropicKey, guthabenLeer } from '@/lib/anthropic';
import { imHaushaltDesInhabers, imHaushaltOderSystemlauf, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { modellSchranke, zuGross } from '@/lib/zugang/umfang';
import { ladeAufgaben } from '@/lib/aufgaben/speicher';
import { auftraggeberinVon, vorschlagSauber } from '@/lib/aufgaben/zoe';
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
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!id) return NextResponse.json({ ok: true, ki: kiDa() });
  if (!ID.test(id)) return NextResponse.json({ ok: false, error: 'Ungültige Kennung.' }, { status: 400 });
  const t = (await ladeAufgaben()).tasks.find(x => x.id === id);
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
    } : null,
  });
}

interface Eingang { aktion?: string; id?: unknown; stapelId?: unknown; stand?: unknown; hinweis?: unknown; grund?: unknown; nochmal?: unknown; max?: unknown }

export async function POST(req: Request) {
  if (zuGross(req, MAX_BYTES)) return NextResponse.json({ ok: false, error: 'Abgelehnt: zu groß.' }, { status: 413 });
  let b: Eingang;
  try { b = (await req.json()) as Eingang; } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
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
  const id = str(b.id, 80) ?? '';
  if (!ID.test(id)) return NextResponse.json({ ok: false, error: 'Aufgabe fehlt.' }, { status: 400 });
  const stand = str(b.stand, 40) || undefined;
  const antwort = async (r: { ok: true } | { ok: false; status: number; fehler: string; konflikt?: boolean }, extra: Record<string, unknown> = {}) => {
    if (r.ok) return NextResponse.json({ ok: true, ...extra });
    return NextResponse.json({ ok: false, error: r.fehler, ...(r.konflikt ? { konflikt: true } : {}) }, { status: r.status });
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
      const t = (await ladeAufgaben()).tasks.find(x => x.id === id);
      const stapelId = str(b.stapelId, 80) || t?.zoe?.stapelId;
      if (!t || !stapelId) return NextResponse.json({ ok: false, error: 'Kein Vorschlag an dieser Aufgabe.' }, { status: 404 });
      if (b.aktion === 'freigeben') {
        const r = await vorschlagFreigeben(stapelId, zugang.person, { stand, aufgabeId: id });
        return r.ok ? NextResponse.json({ ok: true, ergebnis: r.wert.text }) : antwort(r);
      }
      const hinweis = typeof b.hinweis === 'string' ? b.hinweis : undefined;
      return antwort(await vorschlagAblehnen(stapelId, zugang.person, { grund: str(b.grund, 400), nochmal: b.nochmal === true, hinweis, aufgabeId: id }));
    }
    default:
      return NextResponse.json({ ok: false, error: 'Unbekannte Aktion.' }, { status: 400 });
  }
}
