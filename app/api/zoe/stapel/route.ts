// ─── MAKE OS — Der Freigabe-Stapel (Route) ──────────────────────────────────
// GET  liefert die offenen Vorschläge (und auf Wunsch die entschiedenen).
// POST entscheidet: freigeben · ändern und freigeben · ablehnen.
//
// Die Ausführung läuft über fuehreAus mit erzwingen:true — das ist der einzige
// Ort, an dem ein freigabepflichtiges Werkzeug wirklich wirkt, und auch er
// schreibt ins Protokoll. Ausnahme (28.09., C4): Vorschläge mit `bezug` gehören
// einer Art (lib/zoe/stapel-arten.ts) — deren Freigabe-Funktion übernimmt und
// entscheidet selbst; nach dem Ablehnen macht die Art ihren Folgeschritt.
//
// 29.09. (B1): Jede Entscheidung trägt die Person (`von`) und steht dauerhaft in `zoe-entscheidungen` (lib/zoe/stapel.ts
// `entscheide`). Freigeben beansprucht den Vorschlag zuerst in der Sperre (`beanspruche`) — ein Doppelklick, ein zweites
// Fenster oder „alle freigeben“ führt nichts doppelt aus. Nichts wird mehr still gekürzt: ein Grund über GRUND_MAX
// oder eine zu große geänderte Eingabe → 413 mit Grund.
// 29.09. (#94/#97, Kevin): Sammelfreigabe („alle“) nur für risikoarme Vorschläge — ZOE-Aufgaben-Vorschläge, die nur einen
// Notiz-Entwurf und/oder Unteraufgaben ergänzen. Nie für CRM, Deals, Löschen, Versand oder andere Werkzeuge: die brauchen
// je einen Blick (Antwort `einzeln`). Jede Sammelfreigabe bekommt eine Charge (`sammel`, „Charge rückgängig“).
// S1 (29.09.): Tor `imHaushaltDesInhabers` für GET und POST (403 sonst) — Vorschläge des Systems (ohne Person) sieht und
// entscheidet nur der Haushalt des Inhabers; ausgeführt wird immer als die ausdrücklich benannte Person (`personStreng`),
// nie mehr über den Rückfall `personAus` → „kevin“. Schreibaufrufe aus dem Browser prüfen die Bau-Kennung (`bauPruefen`).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { lies, hole, entscheide, beanspruche, loslassen, vorschlagSichtbar, type Vorschlag } from '@/lib/zoe/stapel';
import { fuehreAus } from '@/lib/zoe/ausfuehren';
import { stapelArtVon, UNBEKANNTE_ART } from '@/lib/zoe/stapel-arten';
import { innenAdresse } from '@/lib/innen';
import { imHaushaltDesInhabers, KARTEI_GESPERRT } from '@/lib/zugang/haushalt-inhaber';
import { bauPruefen } from '@/lib/bau/pruefen';
import { risikoarm, vorschlagSauber, ZOE_AUFGABE_WERKZEUG } from '@/lib/aufgaben/zoe';
import { neueKennung } from '@/lib/kennung';

/** Darf in eine Sammelfreigabe? Nur ZOE-Aufgaben-Vorschläge, die nichts überschreiben (Notiz/Unteraufgaben). */
const sammelTauglich = (v: Vorschlag) => v.werkzeug === ZOE_AUFGABE_WERKZEUG && v.bezug?.art === 'aufgabe' && risikoarm(vorschlagSauber(v.eingabe, v.bezug.id));

/** Längster Ablehnungs-Grund (Zeichen) — länger → 413, nie gekürzt. */
const GRUND_MAX = 400;
/** Grenzen für „Ändern & freigeben“ — darüber 413 mit Grund, nie gekürzt. */
const EINGABE_GRENZEN = { felder: 40, text: 4000, liste: 100, listenText: 1000 } as const;
type Sauber = { ok: true; wert: Record<string, unknown> | null } | { ok: false; status: 400 | 413; fehler: string };

/**
 * „Ändern & freigeben“: nur einfache Werte — den Rest prüft das Werkzeug selbst (26.09.). Seit 29.09. nie still:
 * zu lang/zu viele → 413, unbekannte Feldnamen oder verschachtelte Werte → 400 (ein verschachtelter Wert, der
 * unverändert aus dem Vorschlag kommt, bleibt stehen).
 */
function eingabeSauber(v: unknown, vorher: Record<string, unknown>): Sauber {
  if (v === undefined || v === null) return { ok: true, wert: null };
  if (typeof v !== 'object' || Array.isArray(v)) return { ok: false, status: 400, fehler: 'Die geänderte Eingabe ist kein Objekt.' };
  const eintraege = Object.entries(v as Record<string, unknown>);
  if (eintraege.length > EINGABE_GRENZEN.felder) return { ok: false, status: 413, fehler: `Abgelehnt: höchstens ${EINGABE_GRENZEN.felder} Felder.` };
  const raus: Record<string, unknown> = {};
  for (const [k, w] of eintraege) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,40}$/.test(k)) return { ok: false, status: 400, fehler: `Unzulässiger Feldname „${k.slice(0, 40)}“.` };
    if (w === null || typeof w === 'boolean' || (typeof w === 'number' && Number.isFinite(w))) raus[k] = w;
    else if (typeof w === 'string') {
      if (w.length > EINGABE_GRENZEN.text) return { ok: false, status: 413, fehler: `Abgelehnt: „${k}“ ist länger als ${EINGABE_GRENZEN.text} Zeichen.` };
      raus[k] = w;
    } else if (Array.isArray(w) && w.every(x => ['string', 'number', 'boolean'].includes(typeof x))) {
      if (w.length > EINGABE_GRENZEN.liste) return { ok: false, status: 413, fehler: `Abgelehnt: „${k}“ hat mehr als ${EINGABE_GRENZEN.liste} Einträge.` };
      if (w.some(x => typeof x === 'string' && x.length > EINGABE_GRENZEN.listenText)) return { ok: false, status: 413, fehler: `Abgelehnt: ein Eintrag in „${k}“ ist länger als ${EINGABE_GRENZEN.listenText} Zeichen.` };
      raus[k] = w;
    } else if (JSON.stringify(w) === JSON.stringify(vorher[k])) raus[k] = vorher[k];
    else return { ok: false, status: 400, fehler: `„${k}“ lässt sich hier nicht ändern (verschachtelter Wert).` };
  }
  return { ok: true, wert: raus };
}
/** Sehen und entscheiden: eigene Vorschläge und die des Systems — nur im Haushalt des Inhabers (`vorschlagSichtbar`, eine Regel mit Heute). */
const meiner = (v: { person?: string; gruppe: string }, person: string) => vorschlagSichtbar(v, person, true);
const GESPERRT = () => NextResponse.json({ ...KARTEI_GESPERRT, error: KARTEI_GESPERRT.fehler }, { status: 403 });

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  const alle = new URL(req.url).searchParams.get('alle') === '1';
  const person = zugang.person;
  const liste = (await lies(alle ? undefined : 'offen')).filter(v => meiner(v, person));
  return NextResponse.json({ ok: true, vorschlaege: liste, offen: liste.filter(v => v.status === 'offen').length });
}

interface Eingang {
  id?: string;
  entscheidung?: 'freigeben' | 'ablehnen';
  /** Geänderte Eingabe — „ändern und freigeben". */
  eingabe?: Record<string, unknown>;
  grund?: string;
  /** Alles auf einmal freigeben; optional auf eine Gruppe beschränkt. */
  alle?: boolean;
  gruppe?: string;
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return GESPERRT();
  const alterBau = bauPruefen(req); if (alterBau) return alterBau;
  let body: Eingang;
  try { body = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, error: 'Kein gültiges JSON.' }, { status: 400 }); }
  const origin = innenAdresse(req);
  // Die ausdrücklich benannte Person (Sitzung oder Dienstweg mit Person) — sie entscheidet und in ihrem Namen läuft es.
  const wer = zugang.person;
  const darf = (v: Vorschlag) => (meiner(v, wer) ? null : { status: 404 as const, fehler: 'Vorschlag nicht gefunden.' });

  /** Ein gewöhnlicher Werkzeug-Vorschlag: beanspruchen (in der Sperre), ausführen, entscheiden. */
  const werkzeugFreigeben = async (id: string, eingabeNeu: Record<string, unknown> | null) => {
    const a = await beanspruche(id, wer, darf);
    if (!a.ok) return { ok: false as const, status: a.status, text: a.fehler, vorschlag: null };
    const eingabe = eingabeNeu ?? a.v.eingabe;
    let lauf: { ok: boolean; text: string };
    try { lauf = await fuehreAus(a.v.werkzeug, eingabe, origin, { erzwingen: true, person: wer, freigegebenVon: wer }); }
    catch (e) { await loslassen(id); throw e; }
    const raus = await entscheide(id, lauf.ok ? 'freigegeben' : 'fehlgeschlagen', { ergebnis: lauf.text, ...(eingabeNeu ? { eingabe } : {}), von: wer, ausArbeit: true });
    return { ok: lauf.ok, status: 200 as const, text: lauf.text, vorschlag: raus };
  };

  // ── Sammel-Freigabe: „durcharbeiten" ──
  if (body.alle) {
    const alleOffen = (await lies('offen')).filter(v => (!body.gruppe || v.gruppe === body.gruppe) && meiner(v, wer));
    const offen = alleOffen.filter(sammelTauglich);
    const einzeln = alleOffen.length - offen.length;
    if (!offen.length) return NextResponse.json({ ok: true, erledigt: 0, ergebnisse: [], einzeln });
    const sammel = neueKennung('ch');
    // Nacheinander, nicht parallel: mehrere Vorschläge fassen oft denselben
    // Bestand an (zwei Rechnungen desselben Kunden). Parallel würde der eine
    // den anderen überschreiben. Jeder wird einzeln beansprucht — was ein anderes Fenster gerade übernimmt, bleibt liegen.
    const ergebnisse: { id: string; ok: boolean; text: string }[] = [];
    for (const v of offen) {
      // Vorschlag einer Art (z. B. „aufgabe“): deren Freigabe (beansprucht selbst) — nie fuehreAus, auch wenn die Art unbekannt ist.
      if (v.bezug) {
        const art = await stapelArtVon(v);
        const r = art ? await art.freigeben(v, wer, { sammel }) : UNBEKANNTE_ART;
        ergebnisse.push({ id: v.id, ok: r.ok, text: r.ok ? r.text : r.fehler });
      }
    }
    return NextResponse.json({ ok: true, erledigt: ergebnisse.filter(e => e.ok).length, ergebnisse, einzeln, sammel });
  }

  const id = String(body.id ?? '');
  const v = id ? await hole(id) : null;
  if (!v) return NextResponse.json({ ok: false, error: 'Vorschlag nicht gefunden.' }, { status: 404 });
  if (!meiner(v, wer)) return NextResponse.json({ ok: false, error: 'Vorschlag nicht gefunden.' }, { status: 404 });
  if (v.status === 'in_arbeit') return NextResponse.json({ ok: false, error: 'Wird gerade übernommen.' }, { status: 409 });
  if (v.status !== 'offen') return NextResponse.json({ ok: false, error: `Schon entschieden (${v.status}).` }, { status: 409 });

  if (body.entscheidung === 'ablehnen') {
    const grund = typeof body.grund === 'string' ? body.grund.replace(/\u0000/g, '').trim() : '';
    if (grund.length > GRUND_MAX) return NextResponse.json({ ok: false, error: `Abgelehnt: der Grund ist länger als ${GRUND_MAX} Zeichen.` }, { status: 413 });
    const raus = await entscheide(id, 'abgelehnt', { grund, von: wer });
    if (!raus) return NextResponse.json({ ok: false, error: 'Schon entschieden oder gerade in Arbeit.' }, { status: 409 });
    // Folgeschritt der Art (z. B. Aufgabe → „abgelehnt“); ein Fehler dort macht das Ablehnen nicht rückgängig.
    if (v.bezug) { try { await (await stapelArtVon(v))?.nachAblehnen?.(v, wer); } catch { /* Ablehnen bleibt stehen */ } }
    return NextResponse.json({ ok: true, vorschlag: raus });
  }

  const sauber = eingabeSauber(body.eingabe, v.eingabe);
  if (!sauber.ok) return NextResponse.json({ ok: false, error: sauber.fehler }, { status: sauber.status });
  if (v.bezug) {
    // Nichts übernommen (z. B. inzwischen geändert) → der Vorschlag bleibt offen.
    const art = await stapelArtVon(v);
    const r = art ? await art.freigeben(v, wer, { eingabe: sauber.wert }) : UNBEKANNTE_ART;
    if (!r.ok) return NextResponse.json({ ok: false, error: r.fehler }, { status: r.status });
    return NextResponse.json({ ok: true, ergebnis: r.text, vorschlag: await hole(v.id) });
  }
  const r = await werkzeugFreigeben(id, sauber.wert);
  if (r.status !== 200) return NextResponse.json({ ok: false, error: r.text }, { status: r.status });
  return NextResponse.json({ ok: r.ok, ergebnis: r.text, vorschlag: r.vorschlag });
}
