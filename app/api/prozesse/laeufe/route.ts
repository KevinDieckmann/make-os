// ─── Prozesse — Läufe (Etappe C1 „Laufen intern“, 21.10.; ANALYSE_100.md Punkte 29, 35–37, 40, 44, 47, 50, 59, 69) ───────────────────────────────────────
// GET  ?prozess=pz-…        Läufe eines Prozesses (Status, Dauer, Version, Kosten, wo er steht — nur Kennungen und Zahlen), zurückgehaltene, Einstellungen,
//                           Verlauf des Prozesses, Kennzahlen (Ziel-Quote, Reaktionszeit, „in der Uhr“)
//      ?lauf=pl-…           ein Lauf: je Knoten Status, Zeitpunkte, Runden, Kosten, Kennungen der Wirkungen; dazu die Schritte in Reihenfolge (Log-Baum)
//      ?lauf=pl-…&inhalte=1 die Inhalte LIVE mit den Rechten der Person (22.10.): Fall (Art. 18 ausgeblendet), Aufgaben (Sicht der Person), Vorschläge (nur die
//                           eigenen — Agenten-Texte bleiben im Stapel, hier nur Titel und Link), Teil-Läufe (Status) — Lese-Protokoll „firmen“
//      ?fall=<art>:<id>     die Läufe zu EINEM Fall (22.10., B3 — Karte „Begleitung läuft“ in der Akte des Fulfillment-Falls): offene + letzte 30 Tage, Titel des Prozesses
//      ?heute=1             „Prozesse heute: n gelaufen, m warten“ (Punkt 69)
//      (ohne)               je Prozess die Zahlen (offen, wartend, Fehler, zurückgehalten)
// POST { aktion }           starten (Auslöser „von Hand“, `anfrageId`, optional `fall`, `erneut` + `grund`) · abbrechen (`lauf`, `grund`) · erneut (`lauf`, „erneut ab
//                           hier“) · zurueckgehalten (`prozess`, `wie`: starten | verwerfen, optional `ids`) · scharf-vorschau (`prozess`) · scharf (`prozess`, `stand`,
//                           `budgetCent`, `bestehende`: nur-neue | alle) · einstellung (`prozess`, `felder`) · umzug (`prozess`, `nach`, `zuordnung`, `vorschau`)
//                           · testfall (22.10.: `prozess`, `wie`: anlegen mit `aus` = Lauf bzw. `fall` | loeschen mit `id`) · tests-pruefen (`prozess`, `quelle`,
//                           optional `ids` — Probelauf je Testfall, schreibt nichts). Testfälle bauen alle, die Entwürfe bauen.
// Tor: `werkstattZugang` (Haushalt des Inhabers, Sicht Privat 403); POST nur per Sitzung (Dienstweg 403) mit Bau-Kennung. Starten: wer Entwürfe baut (volle
// Mitglieder und „nur Business“); alles, was einen Prozess steuert (abbrechen, erneut, zurückgehalten, scharf, Einstellungen, Umzug): nur volle Mitglieder.
// Lesen schreibt nie; Antworten tragen keine Daten Dritter (Kennungen, Zahlen, Status, Gründe als Code).

import { modellSchranke } from '@/lib/zugang/umfang';
import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { PROZESS_KENNUNG, FALL_ART_IDS, type FallArt } from '@/lib/prozesse/definition';
import { FALL_KENNUNG, LAUF_KENNUNG, TESTFALL_KENNUNG, ZURUECK_KENNUNG } from '@/lib/prozesse/lauf-typen';
import { leseZugriff } from '@/lib/store/leseprotokoll';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { einmalig } from '@/lib/store/anfragen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });
const text = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max + 1) : null);

export async function GET(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  const q = new URL(req.url).searchParams;
  const S = await import('@/lib/prozesse/lauf-server');
  const prozess = q.get('prozess'), lauf = q.get('lauf');
  if (lauf) {
    if (!LAUF_KENNUNG.test(lauf)) return nein(400, 'Welcher Lauf? (?lauf=pl-…)');
    if (q.get('inhalte') === '1') {
      // Dienstweg ohne Sitzung bekommt keine Inhalte (sie hängen an den Rechten einer Person).
      if (z.dienst) return nein(403, 'Inhalte eines Laufs nur für eine angemeldete Person.');
      const r = await S.laufInhalte(lauf, z.person);
      if (!r) return nein(404, 'Diesen Lauf gibt es nicht.');
      if (r.fall?.sichtbar) leseZugriff(req, 'firmen', { ids: [r.fall.id], anzahl: 1 }); // Lese-Protokoll: der Fall eines Laufs (Name, Link)
      return NextResponse.json({ ok: true, ...r });
    }
    const r = await S.laufLesen(lauf);
    return r ? NextResponse.json({ ok: true, ...r }) : nein(404, 'Diesen Lauf gibt es nicht.');
  }
  const fall = q.get('fall');
  if (fall) {
    const i = fall.indexOf(':');
    const art = i > 0 ? fall.slice(0, i) : '', id = i > 0 ? fall.slice(i + 1) : '';
    if (!(FALL_ART_IDS as readonly string[]).includes(art) || art === 'keiner' || !FALL_KENNUNG.test(id)) return nein(400, 'Welcher Fall? (?fall=mandat:<id>)');
    return NextResponse.json({ ok: true, ...(await S.laeufeDesFalls({ art, id }, z.haushalt)) });
  }
  if (prozess) {
    if (!PROZESS_KENNUNG.test(prozess)) return nein(400, 'Welcher Prozess? (?prozess=pz-…)');
    const d = await S.laeufeLesen(z.haushalt);
    const r = await S.laeufeDesProzesses(prozess);
    const eingaenge = await S.webhookEingaengeKurz(prozess, z.haushalt);
    return NextResponse.json({ ok: true, ...r, tests: r.stand?.tests ?? [], webhookEingaenge: eingaenge, zurueck: d.zurueckgehalten.filter(x => x.prozessId === prozess).map(x => ({ id: x.id, fall: x.fall, am: x.am, ausloeser: x.ausloeser.art })) });
  }
  const d = await S.laeufeLesen(z.haushalt);
  if (q.get('heute') === '1') {
    const { heuteZeile } = await import('@/lib/prozesse/lauf-regeln');
    return NextResponse.json({ ok: true, heute: heuteZeile(d, z.person, new Date().toISOString()) });
  }
  const zahlen: Record<string, { offen: number; wartend: number; fehler: number; zurueckgehalten: number; scharf: boolean; pause?: string }> = {};
  for (const l of d.laeufe) {
    const x = zahlen[l.prozessId] ??= { offen: 0, wartend: 0, fehler: 0, zurueckgehalten: 0, scharf: !!d.prozesse[l.prozessId]?.einstellung.scharf };
    if (l.status === 'laeuft' || l.status === 'wartet' || l.status === 'angehalten' || l.status === 'fehler') x.offen++;
    if (l.status === 'wartet') x.wartend++;
    if (l.status === 'fehler') x.fehler++;
  }
  for (const zr of d.zurueckgehalten) (zahlen[zr.prozessId] ??= { offen: 0, wartend: 0, fehler: 0, zurueckgehalten: 0, scharf: !!d.prozesse[zr.prozessId]?.einstellung.scharf }).zurueckgehalten++;
  for (const [id, st] of Object.entries(d.prozesse)) { const x = zahlen[id] ??= { offen: 0, wartend: 0, fehler: 0, zurueckgehalten: 0, scharf: !!st.einstellung.scharf }; if (st.pause) x.pause = st.pause.grund; }
  return NextResponse.json({ ok: true, prozesse: zahlen });
}

export async function POST(req: Request) {
  const z = await werkstattZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, 64 * 1024); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const S = await import('@/lib/prozesse/lauf-server');
  const prozess = typeof b.prozess === 'string' && PROZESS_KENNUNG.test(b.prozess) ? b.prozess : null;
  const lauf = typeof b.lauf === 'string' && LAUF_KENNUNG.test(b.lauf) ? b.lauf : null;
  const steuern = () => (z.rechte.status ? null : nein(403, 'Prozesse steuern (abbrechen, erneut, scharf schalten, Einstellungen) nur volle Mitglieder.'));
  switch (b.aktion) {
    case 'starten': {
      if (!z.rechte.entwurf) return nein(403, 'Prozesse starten nur Personen im Haushalt.');
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      // Ein Lauf von Hand kann gleich einen Agenten-Schritt ausführen (Modell über das KI-Tor) — die Schranke je Person zuerst.
      { const m = modellSchranke(req); if (m) return m; }
      let fall: { art: FallArt; id?: string } | undefined;
      if (b.fall && typeof b.fall === 'object') {
        const f = b.fall as { art?: unknown; id?: unknown };
        if (typeof f.art !== 'string' || !(FALL_ART_IDS as readonly string[]).includes(f.art) || (f.id !== undefined && (typeof f.id !== 'string' || !FALL_KENNUNG.test(f.id)))) return nein(400, 'fall: { art, id }.');
        fall = { art: f.art as FallArt, ...(typeof f.id === 'string' ? { id: f.id } : {}) };
      }
      const grund = text(b.grund, 300);
      if (grund && grund.length > 300) return nein(413, 'Der Grund ist länger als 300 Zeichen — nichts gestartet.');
      const anfrage = typeof b.anfrageId === 'string' ? b.anfrageId : '';
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/.test(anfrage)) return nein(400, 'anfrageId fehlt (8–80 Zeichen).');
      const r = await einmalig<{ ok: boolean; lauf?: string; status?: string; fehler?: string }>('prozess-starten', anfrage, async () => {
        const x = await S.laufVonHand({ prozessId: prozess, person: z.person, ...(fall ? { fall } : {}), ...(b.erneut === true ? { erneut: true } : {}), ...(grund ? { grund } : {}), anfrage });
        return x.ok ? { status: 200, body: { ok: true, lauf: x.lauf.id, status: x.lauf.status } } : { status: x.status, body: { ok: false, fehler: x.fehler, ...(x.lauf ? { lauf: x.lauf.id } : {}) } };
      }, undefined, { wer: z.person });
      return NextResponse.json(r.body, { status: r.status });
    }
    case 'abbrechen': {
      const s = steuern(); if (s) return s;
      if (!lauf) return nein(400, 'Welcher Lauf? (lauf pl-…)');
      const grund = text(b.grund, 300);
      if (!grund) return nein(400, 'Abbrechen nur mit Grund.');
      if (grund.length > 300) return nein(413, 'Der Grund ist länger als 300 Zeichen — nichts abgebrochen.');
      const r = await S.laufAbbrechen(lauf, z.person, grund);
      return r.ok ? NextResponse.json({ ok: true, lauf: r.lauf.id, status: r.lauf.status }) : nein(r.status, r.fehler);
    }
    case 'erneut': {
      const s = steuern(); if (s) return s;
      if (!lauf) return nein(400, 'Welcher Lauf? (lauf pl-…)');
      { const m = modellSchranke(req); if (m) return m; }
      const r = await S.laufErneut(lauf);
      return r.ok ? NextResponse.json({ ok: true, lauf: r.lauf.id, status: r.lauf.status }) : nein(r.status, r.fehler);
    }
    case 'zurueckgehalten': {
      const s = steuern(); if (s) return s;
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      if (b.wie !== 'starten' && b.wie !== 'verwerfen') return nein(400, 'wie: starten oder verwerfen.');
      if (b.wie === 'starten') { const m = modellSchranke(req); if (m) return m; }
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string' && ZURUECK_KENNUNG.test(x)) : undefined;
      if (Array.isArray(b.ids) && ids!.length !== b.ids.length) return nein(400, 'ids: Kennungen zh-….');
      const r = await S.zurueckgehaltenEntscheiden(prozess, b.wie, z.person, ids);
      return NextResponse.json({ ok: true, n: r.n });
    }
    case 'scharf-vorschau': {
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      const v = await S.scharfVorschau(prozess);
      return v ? NextResponse.json({ ok: true, vorschau: v, frage: v.bestehende ? `Gilt das für ${v.bestehende} bestehende ${v.bestehende === 1 ? 'Fall' : 'Fälle'}?` : null }) : nein(404, 'Diesen Prozess gibt es nicht bzw. er ist nicht veröffentlicht.');
    }
    case 'scharf': {
      const s = steuern(); if (s) return s;
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      if (typeof b.stand !== 'string' || !b.stand) return nein(400, 'Stand fehlt — bitte neu laden.');
      const bestehende = b.bestehende === 'alle' ? 'alle' : b.bestehende === 'nur-neue' || b.bestehende === undefined ? 'nur-neue' : null;
      if (!bestehende) return nein(400, 'bestehende: nur-neue oder alle.');
      const budget = typeof b.budgetCent === 'number' ? b.budgetCent : 0;
      const r = await S.scharfSchalten({ prozessId: prozess, person: z.person, rechte: z.rechte, stand: b.stand, budgetCent: budget, bestehende });
      return r.ok ? NextResponse.json({ ok: true, gestartet: r.gestartet, zurueckgehalten: r.zurueckgehalten }) : nein(r.status, r.fehler, r.befunde ? { befunde: r.befunde } : {});
    }
    case 'einstellung': {
      const s = steuern(); if (s) return s;
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      const f = b.felder && typeof b.felder === 'object' ? b.felder as Record<string, unknown> : null;
      if (!f) return nein(400, 'felder fehlt.');
      const zahl = (k: string) => (f[k] === undefined ? undefined : f[k] === null ? null : f[k]) as number | null | undefined;
      const r = await S.einstellungSetzen(prozess, z.person, { flutJeStunde: zahl('flutJeStunde'), notbremseJeStunde: zahl('notbremseJeStunde'), erneutNachTagen: zahl('erneutNachTagen'), budgetCent: zahl('budgetCent'), rechercheFrischeTage: zahl('rechercheFrischeTage'), rechercheSuchen: zahl('rechercheSuchen'), ...(f.ziel !== undefined ? { ziel: f.ziel } : {}), ...(f.abbruch !== undefined ? { abbruch: f.abbruch } : {}) });
      return r.ok ? NextResponse.json({ ok: true }) : nein(r.status, r.fehler);
    }
    case 'umzug': {
      const s = steuern(); if (s) return s;
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      if (typeof b.nach !== 'number' || !Number.isInteger(b.nach)) return nein(400, 'nach: Nummer der Version.');
      const zu = b.zuordnung && typeof b.zuordnung === 'object' ? Object.fromEntries(Object.entries(b.zuordnung as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string' && e[0].length <= 80 && e[1].length <= 80)) : {};
      const ids = Array.isArray(b.laeufe) ? b.laeufe.filter((x): x is string => typeof x === 'string' && LAUF_KENNUNG.test(x)) : undefined;
      const r = await S.umzug({ prozessId: prozess, nach: b.nach, zuordnung: zu, vorschau: b.vorschau !== false, person: z.person, ...(ids ? { laufIds: ids } : {}) });
      return r.ok ? NextResponse.json({ ok: true, zeilen: r.zeilen, umgezogen: r.umgezogen }) : nein(r.status, r.fehler);
    }
    case 'testfall': {
      if (!z.rechte.entwurf) return nein(403, 'Testfälle bauen nur Personen im Haushalt.');
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      if (b.wie === 'loeschen') {
        if (typeof b.id !== 'string' || !TESTFALL_KENNUNG.test(b.id)) return nein(400, 'Welcher Testfall? (id tf-…)');
        return (await S.testfallLoeschen(prozess, b.id)) ? NextResponse.json({ ok: true }) : nein(404, 'Diesen Testfall gibt es nicht.');
      }
      if (b.wie !== 'anlegen') return nein(400, 'wie: anlegen oder loeschen.');
      const aus = typeof b.aus === 'string' && LAUF_KENNUNG.test(b.aus) ? b.aus : undefined;
      if (b.aus !== undefined && !aus) return nein(400, 'aus: Kennung eines Laufs (pl-…).');
      let fall: { art: string; id: string } | 'beispiel' | undefined;
      if (b.fall === 'beispiel' || b.fall === undefined) fall = 'beispiel';
      else if (b.fall && typeof b.fall === 'object') {
        const f = b.fall as { art?: unknown; id?: unknown };
        if (typeof f.art !== 'string' || !(FALL_ART_IDS as readonly string[]).includes(f.art) || typeof f.id !== 'string' || !FALL_KENNUNG.test(f.id)) return nein(400, 'fall: { art, id } oder „beispiel“.');
        fall = { art: f.art, id: f.id };
      } else return nein(400, 'fall: { art, id } oder „beispiel“.');
      const r = await S.testfallAnlegen({ prozessId: prozess, person: z.person, ...(aus ? { aus } : { fall }) });
      return r.ok ? NextResponse.json({ ok: true, test: r.test }) : nein(r.status, r.fehler);
    }
    case 'tests-pruefen': {
      if (!z.rechte.entwurf) return nein(403, 'Testfälle prüfen nur Personen im Haushalt.');
      if (!prozess) return nein(400, 'Welcher Prozess? (prozess pz-…)');
      const quelle = b.quelle === 'version' ? 'version' : b.quelle === 'entwurf' || b.quelle === undefined ? 'entwurf' : null;
      if (!quelle) return nein(400, 'quelle: entwurf oder version.');
      const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string' && TESTFALL_KENNUNG.test(x)) : undefined;
      const r = await S.testsPruefen({ prozessId: prozess, person: z.person, quelle, ...(ids ? { ids } : {}) });
      return r.ok ? NextResponse.json({ ok: true, ergebnisse: r.ergebnisse }) : nein(r.status, r.fehler);
    }
    default: return nein(400, 'Unbekannte Aktion.');
  }
}
