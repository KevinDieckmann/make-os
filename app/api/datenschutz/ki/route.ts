// ─── KI-Schalter je Instanz und je Person (05.10.) ──────────────────────────────────────────────────────────────────
// GET → Vorgabe der Instanz, Instanz-Schalter, eigene Schalter, wirksame Schalter, Telegram-Ausnahme (eigene)
// PUT { ebene: 'instanz', schalter }          → nur der Inhaber (Sitzung; Dienstweg 403)
// PUT { ebene: 'person', schalter }           → nur die Person selbst (Sitzung) — schränkt nur ein, öffnet nie über die Instanz
// PUT { ebene: 'person', telegramVoll, fassung } → Ausnahme „ZOE-Antworten vollständig über Telegram“ (nur selbst, mit Fassung)
// PUT { ebene: 'instanz', anbieter: { medien, budget, modellStufen } } → Anbieter-Tor (09.10., nur der Inhaber): neue KI-Fähigkeiten an/aus,
//   Budget (Euro-Cent; null = nur messen), Modellstufen „bisher“/„neu“. GET zeigt dazu die Zugänge (nur ja/nein, Stufe, Region — nie Schlüssel).
// Andere Personen sehen fremde Schalter nicht. Erzwungen wird im KI-Tor (lib/datenschutz/ki-tor.ts) und in fuehreAus.

import { NextResponse } from 'next/server';
import { personDerSitzung } from '@/lib/zugang/tor';
import { istDienst } from '@/lib/zugang/dienst';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { zuGross, ZU_GROSS } from '@/lib/zugang/umfang';
import {
  KI_BEREICHE, KI_BEREICH_LABEL, aendereKiEinstellungen, anbieterEinstellungSaeubern, instanzSchalter, ladeKiEinstellungen, schalterSaeubern, vorgabeSchalter, wirksameSchalter,
} from '@/lib/datenschutz/ki-einstellungen';
import { konfigUebersicht } from '@/lib/ki/konfig';
import { stufenModelle, stufenSatzWirksam, STUFEN_SAETZE } from '@/lib/ki/modelle';
import { budgetLage, budgetStand } from '@/lib/ki/tor';
import { euroText } from '@/lib/ki/kosten';
import { TELEGRAM_VOLL_FASSUNG, TELEGRAM_VOLL_HINWEIS } from '@/lib/datenschutz/telegram-text';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERSON = /^[a-z0-9-]{1,40}$/;
function selbst(req: Request): string | null {
  if (istDienst(req)) return null;
  const p = personDerSitzung(req);
  return p && PERSON.test(p) ? p : null;
}
const VERBOTEN = (t: string) => NextResponse.json({ ok: false, error: t }, { status: 403 });

async function antwort(person: string) {
  const d = await ladeKiEinstellungen();
  const eigen = d.personen?.[person] ?? {};
  return {
    ok: true,
    vorgabe: d.vorgabe, festgelegtAm: d.festgelegtAm,
    vorgabeSchalter: vorgabeSchalter(d.vorgabe),
    instanz: instanzSchalter(d),
    eigen: { hintergrund: eigen.hintergrund ?? null, websuche: eigen.websuche ?? null, bereiche: eigen.bereiche ?? {} },
    wirksam: wirksameSchalter(d, person),
    telegramVoll: eigen.telegramVoll ?? null,
    telegramHinweis: { text: TELEGRAM_VOLL_HINWEIS, fassung: TELEGRAM_VOLL_FASSUNG },
    bereiche: KI_BEREICHE.map(b => ({ id: b, label: KI_BEREICH_LABEL[b] })),
    inhaber: await istInhaber(person),
    // Anbieter-Tor (09.10.): Zugänge nur als ja/nein, Stufe, Region; Budget und Verbrauch des Monats in Euro (Budget-Balken).
    anbieter: await anbieterAntwort(d.instanz),
  };
}

async function anbieterAntwort(i: Awaited<ReturnType<typeof ladeKiEinstellungen>>['instanz']) {
  const b = await budgetStand().catch(() => null);
  const satz = stufenSatzWirksam(process.env, i?.modellStufen ?? null);
  return {
    ...konfigUebersicht(),
    medien: { bild: i?.medien?.bild === true, video: i?.medien?.video === true, tiefenbericht: i?.medien?.tiefenbericht === true, transkript: i?.medien?.transkript === true },
    // Budget-Balken: Instanz-Budget je Monat (null = nur messen), Grenze je Auftrag, Verbrauch, Prozent und Warnstufe (80/95/100).
    budget: b ? { ...budgetLage(b), auftragGrenzeCent: b.auftragGrenzeCent, quelle: b.quelle, auftragText: euroText(b.auftragGrenzeCent) } : null,
    stufen: { ...satz, modelle: stufenModelle(process.env, i?.modellStufen ?? null), saetze: STUFEN_SAETZE },
  };
}

export async function GET(req: Request) {
  const person = selbst(req);
  if (!person) return VERBOTEN('Nur mit Anmeldung.');
  return NextResponse.json(await antwort(person), { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: Request) {
  const person = selbst(req);
  if (!person) return VERBOTEN('Nur mit Anmeldung — der Dienstweg stellt keine Datenschutz-Schalter.');
  if (zuGross(req, 8_000)) return ZU_GROSS(8_000);
  let b: { ebene?: unknown; schalter?: unknown; telegramVoll?: unknown; fassung?: unknown; person?: unknown; anbieter?: unknown };
  try { b = await jsonBegrenzt(req, 8_000); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  if (b.person !== undefined && b.person !== person) return VERBOTEN('Schalter einer anderen Person stellt nur sie selbst.');
  const neu = schalterSaeubern(b.schalter);

  if (b.ebene === 'instanz') {
    if (!(await istInhaber(person))) return VERBOTEN('Die Schalter der Instanz stellt nur der Inhaber.');
    const an = anbieterEinstellungSaeubern(b.anbieter);
    if ('fehler' in an) return NextResponse.json({ ok: false, error: an.fehler }, { status: 400 });
    await aendereKiEinstellungen(d => {
      const alt = d.instanz ?? {};
      const instanz = { ...alt, ...neu, ...(neu.bereiche ? { bereiche: { ...(alt.bereiche ?? {}), ...neu.bereiche } } : {}),
        ...(an.medien ? { medien: { ...(alt.medien ?? {}), ...an.medien } } : {}) };
      if (an.budget) {
        const bud = { ...(alt.budget ?? {}) };
        for (const k of ['monatEuroCent', 'auftragEuroCent'] as const) { const v = an.budget[k]; if (v === null) delete bud[k]; else if (typeof v === 'number') bud[k] = v; }
        instanz.budget = bud;
      }
      if (an.modellStufen === null) delete instanz.modellStufen; else if (an.modellStufen) instanz.modellStufen = an.modellStufen;
      return { ...d, instanz };
    });
    return NextResponse.json(await antwort(person));
  }
  if (b.ebene !== 'person') return NextResponse.json({ ok: false, error: 'ebene: instanz oder person.' }, { status: 400 });

  if (typeof b.telegramVoll === 'boolean' && b.telegramVoll && b.fassung !== TELEGRAM_VOLL_FASSUNG) {
    return NextResponse.json({ ok: false, error: 'Der Hinweistext hat sich geändert — bitte neu laden und erneut bestätigen.' }, { status: 409 });
  }
  await aendereKiEinstellungen(d => {
    const alt = d.personen?.[person] ?? {};
    const p = {
      ...alt, ...neu,
      ...(neu.bereiche ? { bereiche: { ...(alt.bereiche ?? {}), ...neu.bereiche } } : {}),
      ...(typeof b.telegramVoll === 'boolean' ? { telegramVoll: b.telegramVoll ? { seit: new Date().toISOString(), fassung: TELEGRAM_VOLL_FASSUNG } : undefined } : {}),
    };
    if (!p.telegramVoll) delete p.telegramVoll;
    return { ...d, personen: { ...(d.personen ?? {}), [person]: p } };
  });
  return NextResponse.json(await antwort(person));
}
