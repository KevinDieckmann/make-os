// ─── Kalender (25.09.) — alles an einem Ort ─────────────────────────────────
// GET ?von=YYYY-MM-DD&bis=YYYY-MM-DD (bis exklusiv, höchstens 120 Tage)
//   → Termine (iCloud direkt, sonst der zugelieferte Mac-Stand), Fristen aus
//     dem System, Apple-Erinnerungen (vom Mac), die Kalender und der Stand.
// POST { aktion: 'abgleichen' } → sofort mit iCloud abgleichen.
// Nur für den Haushalt (Kevin & Malin) und den Dienstweg.
// Seit 29.09. (K1): Termine tragen Art, Farbe, frei/beschäftigt, Sichtbarkeit, Zone, Stand (ETag) und ihren Bezug
// (`kalender-bezug`, lib/kalender/bezug.ts); private Termine der ANDEREN Person kommen nur als „Belegt“ (`maskieren`).
// Fristen tragen `bereich` (privat/business) — die Oberfläche filtert nach Sicht und Bereich.
// Seit R-K1 (#51): `abgleich` = { letzter, vorMin, veraltet (ab 30 Min.), fehler?, anmeldung?, hinweise? } — „letzter
// Abgleich vor X Min.“; übersprungene Kalender (403, gekürzte Antwort) stehen in `hinweise`.
// S1 #20 (29.09.): Apple-Erinnerungen (Mac des Inhabers) nur für den Inhaber, private Fristen nur für Personen mit
// Haushalt — serverseitig (`fuerPersonFiltern`, lib/kalender/eintraege.ts), nicht erst im Browser.
// iCloud je Person (06.10., lib/kalender/icloud-person.ts): die Kalender aus der eigenen Verbindung einer Person kommen bei ihr
// mit Namen, bei allen anderen nur als EIN neutraler Eintrag „iCloud · <Vorname>“ (nur lesen); ihre Termine sind dort „Belegt“
// (`maskieren`). `icloudEigen` = Stand der eigenen Verbindung (maskierte Apple-ID, letzter Abgleich, Anmeldung abgelehnt?).

import { jsonBegrenzt, jsonZuGross, JSON_GROSS } from '@/lib/zugang/json-grenze';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { kalenderZugang, KEIN_KALENDER } from '@/lib/kalender/zugang';
import { verbunden, abgleichen, termineImZeitraum, kontoAnzeige, CACHE, ladeStand, naechsterVersuchFaellig, abgleichAlter } from '@/lib/kalender/icloud';
import { googleKalenderNamen } from '@/lib/kalender/google/namen';
import { ladeGoogleStand } from '@/lib/kalender/google/stand';
import { googleAbgleichen, googleAbgleichFaellig, googleAlter } from '@/lib/kalender/google/abgleich';
import { erinnerungen, fuerPersonFiltern } from '@/lib/kalender/eintraege';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { fristenLesen } from '@/lib/kalender/fristen-server';
import { macTermine, type MacEv } from '@/lib/kalender/termine-lesen';
import { ladeEinstellungen, wemGehoert } from '@/lib/kalender/einstellungen';
import { wandzeit, tagPlus } from '@/lib/kalender/zeit';
import { SPEICHER as MAC, type Gemerkt } from '@/lib/mac';
import { localDay } from '@/lib/zeit';
import type { Termin } from '@/lib/kalender/ics';
import { ladeBezuege } from '@/lib/kalender/bezug-server';
import { mitBezug, maskieren, type BezugBestand } from '@/lib/kalender/bezug';
import { hauptZugangAuffrischen, ladePersonStand, ladeVerbindung, personAbgleichen, personAbgleichLaeuft, personenMitIcloud } from '@/lib/kalender/icloud-person';
import { einstellungenFuerPerson } from '@/lib/kalender/einstellungen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  const q = new URL(req.url).searchParams;
  const heute = localDay();
  const von = TAG.test(q.get('von') ?? '') ? q.get('von')! : tagPlus(heute, -1);
  let bis = TAG.test(q.get('bis') ?? '') ? q.get('bis')! : tagPlus(von, 14);
  if (bis <= von) bis = tagPlus(von, 1);
  if (bis > tagPlus(von, 120)) bis = tagPlus(von, 120);

  // Der Zugang des Haushalts-Kalenders kann aus der Oberfläche kommen (06.10.) — vor `verbunden()` frisch laden.
  await hauptZugangAuffrischen();
  const einst = await ladeEinstellungen();
  let termine: Termin[] = [];
  let stand: string | null = null;
  let fehler: string | undefined;
  let quelle: 'icloud' | 'mac' | 'leer' = 'leer';
  let kalender: { name: string; farbe?: string; schreibbar: boolean; wer: string; quelle?: 'google' | 'icloud' }[] = [];
  let abgleich: ReturnType<typeof abgleichAlter> | undefined;

  // Google (03.10.): die verbundenen Google-Kalender (Business/MAKE je Person) liegen im selben Stand wie iCloud (`ladeStand`
  // legt sie darüber) — Termine, Kalenderliste und „letzter Abgleich“ je Quelle. Nicht warten: fälligen Abgleich im Hintergrund anstoßen.
  const googleNamen = await googleKalenderNamen();
  const googlePersonen = Object.keys(googleNamen);
  const googleAbgleiche: { person: string; kalender: string; abgleich: ReturnType<typeof abgleichAlter> }[] = [];
  for (const p of googlePersonen) {
    const g = await ladeGoogleStand(p);
    if (g && googleAbgleichFaellig(g, Date.now(), 2 * 60_000)) void googleAbgleichen(p).catch(() => { /* Fehler steht im Stand */ });
    const a = googleAlter(g);
    if (g && a) googleAbgleiche.push({ person: p, kalender: g.kalenderName, abgleich: a });
  }

  // iCloud je Person (06.10.): die EIGENE Verbindung der ansehenden Person — fälligen Abgleich im Hintergrund anstoßen.
  const eigenIcloud = await ladeVerbindung(zugang.person).catch(() => null);
  const eigenStand = eigenIcloud ? await ladePersonStand(zugang.person).catch(() => null) : null;
  if (eigenIcloud && !personAbgleichLaeuft(zugang.person) && (!eigenStand?.at || Date.now() - Date.parse(eigenStand.at) > 2 * 60_000) && (!eigenStand || naechsterVersuchFaellig(eigenStand))) {
    void personAbgleichen(zugang.person).catch(() => { /* Fehler steht im Stand */ });
  }

  const persoenlichDa = !!eigenIcloud || (await personenMitIcloud().catch(() => [] as string[])).length > 0;
  if (verbunden() || googlePersonen.length || persoenlichDa) {
    // Tempo (27.09.): nicht auf iCloud warten — Stand ausliefern, fälligen Abgleich im Hintergrund anstoßen (der Takt hält ihn alle 5 Min. frisch).
    const s0 = await ladeStand();
    let s = s0;
    if (verbunden() && naechsterVersuchFaellig(s0)) { const lauf = abgleichen().catch(() => ladeStand()); if (!s0.at) s = await lauf; else void lauf; }
    termine = termineImZeitraum(s, von, bis);
    stand = s.at ?? [...googleAbgleiche.map(g => g.abgleich.letzter), eigenStand?.at].filter((x): x is string => !!x).sort().pop() ?? null;
    fehler = verbunden() && s.fehler && (!s.at || (s.fehlerAt ?? '') > s.at) ? s.fehler : undefined;
    quelle = stand ? 'icloud' : 'leer';
    abgleich = verbunden() ? abgleichAlter(s) : undefined;
    // Kalender je Person (06.10.): eigene mit Namen, die der anderen nur als EIN neutraler Eintrag je Person (nur lesen).
    const neutral = new Map<string, { name: string; schreibbar: false; wer: string; quelle: 'icloud' }>();
    kalender = s.kalender.flatMap(k => {
      if (k.quelle === 'icloud' && k.person && k.person !== zugang.person) {
        const n = k.neutral ?? 'Belegt';
        if (!neutral.has(n)) neutral.set(n, { name: n, schreibbar: false, wer: wemGehoert(einst, n), quelle: 'icloud' });
        return [];
      }
      return [{ name: k.name, ...(k.farbe ? { farbe: k.farbe } : {}), schreibbar: k.schreibbar, wer: wemGehoert(einst, k.name), ...(k.quelle ? { quelle: k.quelle } : {}) }];
    });
    kalender.push(...neutral.values());
  } else {
    // Ohne iCloud: der zuletzt vom Mac gelieferte Stand — nur lesen, EINE Abbildung (`macTermine`, K6a).
    const c = await loadJson<{ events?: MacEv[]; at?: string }>(CACHE);
    stand = c?.at ?? null;
    quelle = c?.at ? 'mac' : 'leer';
    termine = macTermine(c?.events, von, bis);
    kalender = Array.from(new Set(termine.map(t => t.kalender))).map(name => ({ name, schreibbar: false, wer: wemGehoert(einst, name) }));
  }

  const bezuege: BezugBestand | null = await ladeBezuege().catch(() => null);
  // Fristen: die Quellen lädt EINE Stelle (lib/kalender/fristen-server.ts, K6a) — dieselbe wie Glocke/Heute.
  const [fristenAlle, rem, inhaber, eigenerHaushalt] = await Promise.all([
    fristenLesen(von, bis, heute, zugang.person).catch(() => []),
    loadJson<Gemerkt>(MAC.erinnerungen).catch(() => null),
    istInhaber(zugang.person).catch(() => false),
    haushaltFuer(zugang.person).catch(() => null),
  ]);
  const sicht = fuerPersonFiltern({ fristen: fristenAlle, erinnerungen: erinnerungen(rem?.daten, von, bis, wandzeit) }, { inhaber, privat: !!eigenerHaushalt });

  return NextResponse.json({
    ok: true, von, bis, quelle, stand, ...(fehler ? { fehler } : {}), ...(abgleich ? { abgleich } : {}),
    icloud: verbunden(), konto: kontoAnzeige(),
    ...(eigenIcloud ? { icloudEigen: { abgleich: abgleichAlter(eigenStand ?? {}) } } : {}),
    // Google (03.10.): je verbundenem Google-Kalender „letzter Abgleich vor X Min.“ (Name + Alter, nie Tokens/Adressen).
    ...(googleAbgleiche.length ? { google: googleAbgleiche } : {}),
    kalender, einstellungen: einstellungenFuerPerson(einst, zugang.person),
    // Bezug + Sicherung anwenden, dann für die ansehende Person maskieren (privat der anderen → „Belegt“).
    termine: termine.map(t => maskieren({ ...mitBezug(t, bezuege), wer: wemGehoert(einst, t.kalender) }, zugang.person)),
    fristen: sicht.fristen,
    erinnerungen: sicht.erinnerungen,
    erinnerungenStand: inhaber ? rem?.at ?? null : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const zugang = await kalenderZugang(req);
  if (!zugang) return NextResponse.json(KEIN_KALENDER, { status: 403 });
  let b: { aktion?: string };
  try { b = await jsonBegrenzt(req, JSON_GROSS); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion !== 'abgleichen') return NextResponse.json({ ok: false, fehler: 'Unbekannte Aktion.' }, { status: 400 });
  // Google (03.10.): der eigene Google-Kalender der Person (falls verbunden) wird mit abgeglichen — nie der einer anderen Person.
  const googleEigen = zugang.person && (await googleKalenderNamen())[zugang.person] ? zugang.person : null;
  // iCloud je Person (06.10.): ebenso die EIGENE iCloud-Verbindung — nie die einer anderen Person.
  await hauptZugangAuffrischen();
  const icloudEigen = zugang.person && await ladeVerbindung(zugang.person).catch(() => null) ? zugang.person : null;
  if (!verbunden() && !googleEigen && !icloudEigen) return NextResponse.json({ ok: false, fehler: 'Weder iCloud noch Google ist verbunden.' }, { status: 409 });
  try {
    const google = googleEigen ? await googleAbgleichen(googleEigen).catch(e => { throw Object.assign(new Error(e instanceof Error ? e.message : 'Google nicht erreichbar.'), { quelle: 'Google' }); }) : null;
    const eigen = icloudEigen ? await personAbgleichen(icloudEigen, { erzwingen: true }).catch(e => { throw Object.assign(new Error(e instanceof Error ? e.message : 'iCloud nicht erreichbar.'), { quelle: 'iCloud' }); }) : null;
    if (!verbunden()) return NextResponse.json({ ok: true, stand: new Date().toISOString(), kalender: (eigen?.kalender.length ?? 0) + (google ? 1 : 0), google });
    const s = await abgleichen({ erzwingen: true });
    return NextResponse.json({ ok: true, stand: s.at, kalender: s.kalender.length, ...(s.hinweise?.length ? { hinweise: s.hinweise } : {}), ...(google ? { google } : {}) });
  } catch (e) {
    const quelle = (e as { quelle?: string } | null)?.quelle ?? 'iCloud';
    return NextResponse.json({ ok: false, fehler: e instanceof Error ? e.message : `${quelle} nicht erreichbar.` }, { status: 502 });
  }
}
