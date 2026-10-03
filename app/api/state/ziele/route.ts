// ─── MAKE OS — Ziele je Planungs-Horizont (lokal) ───────────────────────────
// { tag, woche, monat, quartal, jahr: Ziel[] } — die Zielebene über dem
// Taskmanagement. Aufgaben beantworten „was tue ich", Ziele beantworten
// „woran messe ich den Tag/die Woche/den Monat/das Quartal/das Jahr".
// Seit 27.09. (Malins Rückmeldung, Kevins Entscheidung): Rang per Pfeil,
// Business-Einheit, Zahlenziel + Termin am Jahresziel — und nach jedem
// Schreiben läuft die Kaskade (lib/planung/kaskade.ts): Quartal/Monat/Woche/Tag
// werden aus den Jahreszielen nachgezogen, Termin-Ziele werden Meilensteine.
// Seit 28.09. („Mandat an Zielen und Zeit“): Business-Ziele tragen optional `mandatId`/`firmaId`;
// Firma und Einheit werden im Schreibweg aus dem Mandat abgeleitet (lib/planung/mandat.ts).

import { NextResponse } from 'next/server';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { listePatchen, opsLesen, opsFehler } from '@/lib/store/patch-liste';
import { mitStand } from '@/lib/store/fingerabdruck';
import { personAus, speicherFuer } from '@/lib/zoe/raum';
import { haushaltVon } from '@/lib/finanzen/haushalt/zugriff';
import { ZIEL_HORIZONTE, istZielHorizont, type Ziel, type ZielHorizont, type ZieleDatei, type Meilenstein } from '@/lib/planung/typen';
import { kaskadeAnwenden, meilensteineAbleiten } from '@/lib/planung/kaskade';
import { sauberZiel, jahrStempeln } from '@/lib/planung/ziele';
import { fokusFuerLaufendesJahr, fokusSchreibSchluessel, istJahrFokusSchluessel } from '@/lib/planung/jahr-fokus';
import { mitMandatBezug } from '@/lib/planung/mandat';
import { mandateFuerBezug } from '@/lib/planung/mandat-server';
import { localDay } from '@/lib/zeit';
import { meilensteinStrukturSichern, meilensteinListenArchivieren, zieleNachziehen } from '@/lib/planung/meilenstein-aufgaben-server';
import { personStreng } from '@/lib/finanzen/haushalt/zugriff';
import { ohneToteVerweise, zielVerweiseLoesen } from '@/lib/planung/meilenstein-kette';
import { protokolliere, werAus } from '@/lib/store/aenderungsprotokoll';
import { mitFarbe, zielFarbenDesHaushalts } from '@/lib/planung/ziel-farben-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type { Ziel, ZielHorizont as Horizont };
/** Fokus gibt es je Horizont (Kevins Umschalter). */
export type FokusHorizont = ZielHorizont;

const LEER: ZieleDatei = { tag: [], woche: [], monat: [], quartal: [], jahr: [], fokus: {} };
/**
 * Fokus-Schlüssel: Horizont oder Priorität, optional je Space („privat:jahr“, „business:prio:umsatz“) — 26.09.;
 * seit 30.09. das Jahr auch je Jahr („business:jahr:2027“, lib/planung/jahr-fokus.ts; ±10 Jahre).
 */
const FOKUS_SCHLUESSEL = /^(?:(?:privat|business):)?(?:tag|woche|monat|quartal|jahr(?::\d{4})?|prio:[a-z0-9-]{1,40})$/;
const laufendesJahr = () => Number(localDay().slice(0, 4));
/** Höchstzahl Ziele je Horizont — darüber wird abgelehnt, nie gekürzt (28.09.). */
const JE_HORIZONT = 100;

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
  return NextResponse.json({ fuer: sp.fuer, darfSchreiben: sp.darfSchreiben, ...await mitStaenden(f) });
}

/**
 * Jede Zeile trägt ihren Stand (Fingerabdruck — der Browser schickt ihn mit jeder Änderung zurück) und ihre Farbe (Review
 * 03.10.: EINE Stelle, lib/planung/ziel-farben-server.ts, über alle Ziele des Haushalts — dieselbe wie in den Lichtfäden;
 * Clients rechnen nie selbst). `farbe` zählt nicht zum Stand und wird nie gespeichert (`sauberZiel` kennt sie nicht).
 */
async function mitStaenden(f: ZieleDatei): Promise<ZieleDatei> {
  const farben = await zielFarbenDesHaushalts();
  // Fokus des laufenden Jahres unter dem Schlüssel ohne Jahr — der vorgeplante Satz gilt ab Januar (30.09.).
  const aus: ZieleDatei = { ...f, fokus: fokusFuerLaufendesJahr(f.fokus, laufendesJahr()) };
  for (const h of ZIEL_HORIZONTE) aus[h] = mitFarbe(mitStand(f[h] ?? []), farben);
  return aus;
}

/**
 * PUT: nur noch den Fokus-Satz setzen. Ziele gehen seit 28.09. als Einzeländerungen (PATCH) —
 * der alte Weg „ganzen Horizont ersetzen“ überschrieb still, was der andere inzwischen angelegt hatte.
 */
export async function PUT(req: Request) {
  let body: { horizont?: string; ziele?: unknown; fokus?: string; fuer?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sp = await speicherFuerAnfrage(req, body.fuer ?? null);
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  if (!sp.darfSchreiben) return NextResponse.json({ ok: false, error: 'Den Fokus einer anderen Person kannst du nur lesen.' }, { status: 403 });
  const h = body.horizont;
  if (Array.isArray(body.ziele)) {
    return NextResponse.json({ ok: false, error: 'Ziele bitte einzeln ändern (PATCH { horizont, ops }) — Seite neu laden.' }, { status: 409 });
  }
  if (typeof body.fokus !== 'string' || !h || !FOKUS_SCHLUESSEL.test(h) || (/(?:^|:)jahr:\d{4}$/.test(h) && !istJahrFokusSchluessel(h, laufendesJahr()))) {
    return NextResponse.json({ ok: false, error: 'horizont + fokus (tag|woche|monat|quartal|jahr|prio:<thema>) nötig.' }, { status: 400 });
  }
  const next = await updateJson<ZieleDatei>(sp.name, current => {
    const basis = datei(current);
    // Das laufende Jahr steht mit und ohne Jahr (alte Leser, alter Online-Stand), andere Jahre nur mit (30.09.).
    const text = (body.fokus as string).slice(0, 300);
    basis.fokus = { ...basis.fokus, ...Object.fromEntries(fokusSchreibSchluessel(h, laufendesJahr()).map(k => [k, text])) };
    return basis;
  });
  return NextResponse.json({ ok: true, fuer: sp.fuer, ...await mitStaenden(datei(next)) });
}

/**
 * Einzelne Ziele eines Horizonts ändern (28.09.): `PATCH { horizont, ops, fuer? }` —
 * `ops` wie überall (`upsert` mit Eintrag, `delete` mit id, je mit `stand`). Anlegen,
 * Ändern, Rang, Erledigt, Löschen sind je Ziel eine Änderung. Veralteter Stand → 409
 * mit dem aktuellen Horizont und `konflikte[]` (aktueller Eintrag), nichts überschrieben.
 * Die Kaskade läuft danach in DERSELBEN Sperre (lib/planung/kaskade.ts).
 */
export async function PATCH(req: Request) {
  let body: { horizont?: string; ops?: unknown; fuer?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const sp = await speicherFuerAnfrage(req, body.fuer ?? null);
  if (!sp) return NextResponse.json({ ok: false, error: 'Diese Person gehört nicht zu deinem Haushalt.' }, { status: 403 });
  if (!sp.darfSchreiben) return NextResponse.json({ ok: false, error: 'Die Ziele einer anderen Person kannst du nur lesen.' }, { status: 403 });
  const h = body.horizont;
  if (!istZielHorizont(h)) return NextResponse.json({ ok: false, error: 'horizont (tag|woche|monat|quartal|jahr) nötig.' }, { status: 400 });
  if (Array.isArray(body.ops) && body.ops.length > JE_HORIZONT * 2) {
    return NextResponse.json({ ok: false, error: `Abgelehnt: höchstens ${JE_HORIZONT * 2} Änderungen je Aufruf.` }, { status: 413 });
  }
  // Mandat an Zielen (28.09.): Firma und Einheit kommen aus dem Mandat — das CRM wird nur gelesen, wenn eins genannt ist.
  const mandate = await mandateFuerBezug(body.ops);
  const ops = opsLesen<Ziel>(body.ops, e => { const z = sauberZiel(e); return z && mitMandatBezug(z, mandate, z.space === 'business'); }, JE_HORIZONT * 2);
  if (!ops) return NextResponse.json({ ok: false, error: opsFehler(body.ops, JE_HORIZONT * 2) }, { status: Array.isArray(body.ops) ? 413 : 400 });
  const jahr = laufendesJahr();

  const r = await listePatchen<Ziel, ZieleDatei & Record<string, unknown>>(sp.name, h, ops, 6, undefined, {
    // Grenze je Horizont: ablehnen, nie kürzen.
    pruefen: (liste, o) => {
      const ids = new Set(liste.map(z => z.id));
      const neu = new Set(o.filter(x => x.op === 'upsert' && !ids.has(x.eintrag!.id)).map(x => x.eintrag!.id));
      return liste.length + neu.size > JE_HORIZONT && neu.size > 0 ? `Abgelehnt: höchstens ${JE_HORIZONT} Ziele je Horizont.` : null;
    },
    // Jahresziele ohne `jahr` bekommen es beim Schreiben (30.09., lib/planung/ziele.ts) — erst dann die Kaskade (nur das laufende Jahr).
    danach: f => { const d = datei(f); if (h === 'jahr') d.jahr = jahrStempeln(d.jahr, jahr); return kaskadeAnwenden(d, jahr) as ZieleDatei & Record<string, unknown>; },
  });
  if (!r.ok) {
    const aktuell = datei(await loadJson<ZieleDatei>(sp.name));
    const status = r.konflikte?.length ? 409 : r.fehler?.startsWith('Abgelehnt: höchstens') ? 413 : r.fehler?.startsWith('Abgelehnt') ? 409 : 400;
    return NextResponse.json({ ok: false, error: r.fehler, konflikte: r.konflikte ?? [], fuer: sp.fuer, horizont: h, ...await mitStaenden(aktuell) }, { status });
  }
  const next = datei(r.next);

  // Termin-Ziele des geteilten Bestands werden Meilensteine (der Meilenstein-Bestand ist gemeinsam).
  if (h === 'jahr' && sp.fuer === 'wir') {
    let vorher: string[] = [];
    // Fällt ein abgeleiteter Meilenstein mit seinem Ziel weg, verschwindet er auch aus „wartet auf“ der anderen (01.10.).
    const ms = await updateJson<{ meilensteine: Meilenstein[] }>('meilensteine', cur => { vorher = (cur?.meilensteine ?? []).map(m => m.id); return { ...(cur ?? {}), meilensteine: ohneToteVerweise(meilensteineAbleiten(next.jahr, Array.isArray(cur?.meilensteine) ? cur!.meilensteine : [])).liste }; });
    // Meilenstein ↔ Aufgaben (30.09.): abgeleitete Meilensteine bekommen ihre Aufgaben-Liste wie alle anderen; fällt einer
    // mit seinem Ziel weg, wird seine Liste archiviert (Aufgaben bleiben).
    const jetzt = new Set((ms.meilensteine ?? []).map(m => m.id));
    const abgeleitet = (ms.meilensteine ?? []).filter(m => m.abgeleitetVon).map(m => m.id);
    if (abgeleitet.length) await meilensteinStrukturSichern(abgeleitet, { person: personStreng(req) });
    const weg = vorher.filter(id => !jetzt.has(id));
    if (weg.length) await meilensteinListenArchivieren(weg, { person: personStreng(req) });
  }
  // Gelöschte Ziele (01.10., Ziel ↔ Meilenstein): ihre Meilensteine bleiben stehen und verlieren nur den Ziel-Bezug (`zielId`) —
  // nie mitlöschen. Rückgängig im Browser legt Ziel und Bezug wieder an. Nur der geteilte Bestand hat Meilensteine als Kinder.
  let zielBezugGeloest = 0;
  if (sp.fuer === 'wir') {
    const lebend = new Set(ZIEL_HORIZONTE.flatMap(x => next[x].map(z => z.id)));
    const tot = new Set(ops.filter(o => o.op === 'delete' && o.id && !lebend.has(o.id)).map(o => o.id!));
    if (tot.size) {
      let geloest: string[] = [];
      await updateJson<{ meilensteine?: Meilenstein[] } & Record<string, unknown>>('meilensteine', cur => {
        const l = Array.isArray(cur?.meilensteine) ? cur!.meilensteine : [];
        const r = zielVerweiseLoesen(l, tot);
        geloest = r.geloest;
        return geloest.length ? { ...(cur ?? {}), meilensteine: r.liste } : (cur ?? { meilensteine: l });
      });
      zielBezugGeloest = geloest.length;
      if (geloest.length) await protokolliere('meilensteine', geloest.map(id => ({ op: 'geaendert' as const, id, felder: ['zielId'] })), werAus(req));
    }
  }
  // Ziel-Fortschritt aus Meilensteinen (30.09.): hat ein Ziel Meilensteine, gilt ihr Mittelwert (auch nach einer Änderung von Hand).
  if (sp.fuer === 'wir' && await zieleNachziehen()) {
    const f = datei(await loadJson<ZieleDatei>(sp.name));
    return NextResponse.json({ ok: true, angewandt: r.angewandt, fuer: sp.fuer, horizont: h, zielBezugGeloest, ...await mitStaenden(f) });
  }
  return NextResponse.json({ ok: true, angewandt: r.angewandt, fuer: sp.fuer, horizont: h, zielBezugGeloest, ...await mitStaenden(next) });
}
