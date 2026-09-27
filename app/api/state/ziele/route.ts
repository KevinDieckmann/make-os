// ─── MAKE OS — Ziele je Planungs-Horizont (lokal) ───────────────────────────
// { tag, woche, monat, quartal, jahr: Ziel[] } — die Zielebene über dem
// Taskmanagement. Aufgaben beantworten „was tue ich", Ziele beantworten
// „woran messe ich den Tag/die Woche/den Monat/das Quartal/das Jahr".
// Seit 27.09. (Malins Rückmeldung, Kevins Entscheidung): Rang per Pfeil,
// Business-Einheit, Zahlenziel + Termin am Jahresziel — und nach jedem
// Schreiben läuft die Kaskade (lib/planung/kaskade.ts): Quartal/Monat/Woche/Tag
// werden aus den Jahreszielen nachgezogen, Termin-Ziele werden Meilensteine.

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { personAus, speicherFuer } from '@/lib/zoe/raum';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ZIEL_HORIZONTE, istZielHorizont, type Ziel, type ZielHorizont, type ZieleDatei, type Meilenstein } from '@/lib/planung/typen';
import { kaskadeAnwenden, meilensteineAbleiten } from '@/lib/planung/kaskade';
import { sauberZiel } from '@/lib/planung/ziele';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { Ziel, ZielHorizont as Horizont };
/** Fokus gibt es je Horizont (Kevins Umschalter). */
export type FokusHorizont = ZielHorizont;

const LEER: ZieleDatei = { tag: [], woche: [], monat: [], quartal: [], jahr: [], fokus: {} };
/** Fokus-Schlüssel: Horizont oder Priorität, optional je Space („privat:jahr“, „business:prio:umsatz“) — 26.09. */
const FOKUS_SCHLUESSEL = /^(?:(?:privat|business):)?(?:tag|woche|monat|quartal|jahr|prio:[a-z0-9-]{1,40})$/;
const JE_HORIZONT = 40;

/**
 * Wessen Ziele/Fokus (26.09., Kevin: „Malin hat ihre eigenen Ziele, wir haben gemeinsame“):
 * `wir` (Standard, der geteilte Bestand) · `ich` (der eigene) · <speicher> einer Person im
 * Haushalt (nur lesen). Rückgabe: Speichername + ob geschrieben werden darf.
 */
async function speicherFuerAnfrage(req: Request, fuer: string | null): Promise<{ name: string; darfSchreiben: boolean; fuer: string } | null> {
  const ich = personAus(req);
  if (!fuer || fuer === 'wir') return { name: 'ziele', darfSchreiben: true, fuer: 'wir' };
  if (fuer === 'ich' || fuer === ich) return { name: speicherFuer('ziele-eigen', ich), darfSchreiben: true, fuer: ich };
  if (!/^[a-z0-9-]{1,40}$/.test(fuer)) return null;
  const z = await haushaltVon(req);
  if (!z) return null;
  return { name: speicherFuer('ziele-eigen', fuer), darfSchreiben: false, fuer };
}

function datei(roh: ZieleDatei | null | undefined): ZieleDatei {
  const aus: ZieleDatei = { ...LEER, fokus: roh?.fokus && typeof roh.fokus === 'object' ? roh.fokus : {} };
  for (const h of ZIEL_HORIZONTE) aus[h] = Array.isArray(roh?.[h]) ? roh![h] : [];
  return aus;
}

export async function GET(req: Request) {
  const sp = await speicherFuerAnfrage(req, new URL(req.url).searchParams.get('fuer'));
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  const f = datei(await loadJson<ZieleDatei>(sp.name));
  return NextResponse.json({ fuer: sp.fuer, darfSchreiben: sp.darfSchreiben, ...f });
}

/** Einen Horizont komplett setzen (die Seite verwaltet ihre Liste) — danach die Kaskade. */
export async function PUT(req: Request) {
  let body: { horizont?: string; ziele?: unknown; fokus?: string; fuer?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sp = await speicherFuerAnfrage(req, body.fuer ?? null);
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  if (!sp.darfSchreiben) return NextResponse.json({ ok: false, error: 'Den Fokus einer anderen Person kannst du nur lesen.' }, { status: 403 });
  const h = body.horizont;
  const zieleOk = Array.isArray(body.ziele) && istZielHorizont(h);
  const fokusOk = typeof body.fokus === 'string' && !!h && FOKUS_SCHLUESSEL.test(h);
  if (!h || (!zieleOk && !fokusOk)) {
    return NextResponse.json({ ok: false, error: 'horizont + ziele (tag|woche|monat|quartal|jahr) oder fokus (tag|woche|monat|quartal|jahr|prio:<thema>) nötig.' }, { status: 400 });
  }
  const sauber = (body.ziele as unknown[] ?? []).slice(0, JE_HORIZONT).map(sauberZiel).filter((z): z is Ziel => !!z);
  const jahr = Number(localDay().slice(0, 4));

  const next = await updateJson<ZieleDatei>(sp.name, current => {
    const basis = datei(current);
    if (zieleOk) basis[h as ZielHorizont] = sauber;
    if (fokusOk) basis.fokus = { ...basis.fokus, [h]: (body.fokus as string).slice(0, 300) };
    return zieleOk ? kaskadeAnwenden(basis, jahr) : basis;
  });

  // Termin-Ziele des geteilten Bestands werden Meilensteine (der Meilenstein-Bestand ist gemeinsam).
  if (zieleOk && sp.fuer === 'wir') {
    await updateJson<{ meilensteine: Meilenstein[] }>('meilensteine', cur => ({ ...(cur ?? {}), meilensteine: meilensteineAbleiten(next.jahr, Array.isArray(cur?.meilensteine) ? cur!.meilensteine : []) }));
  }
  return NextResponse.json({ ok: true, fuer: sp.fuer, ...next });
}
