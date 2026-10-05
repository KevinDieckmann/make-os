// ─── CRM — Stammdaten ───────────────────────────────────────────────────────
// GET  → Datenqualität (Vollständigkeit je Feld, Dubletten, Firmen ohne
//        Verknüpfung, Art. 14, Speicherbegrenzung, Werbesperren), Kennzahlen,
//        Wertelisten vollständig (Stufen mit Wahrscheinlichkeit, Verlustgründe
//        fest + eigene, Kadenz je Kreis, Gesprächsergebnisse, Ziele + Ist), letzter Import
//        + Selbstprüfung, Pflichtangaben-Vorschlag, Löschkonzept, Anträge,
//        Verarbeitungsverzeichnis (beim ersten Aufruf mit Startbestand), Befunde
// POST { aktion: 'firmen-abgleich' }                        → Firmen anlegen/verknüpfen
// POST { aktion: 'pflichtangaben' }                          → Vorschläge übernehmen (nur leere Felder)
// POST { aktion: 'wahrscheinlichkeit', stufe, p | null }     → von Hand setzen / zurücksetzen
// POST { aktion: 'wertelisten', wertelisten: Teil }          → Verlustgründe, Kadenz, Ergebnisse, Ziele
//                                                              (Teil-Update, lib/crm/wertelisten.ts prüft und säubert)

import { PROTOKOLL_ID } from '@/lib/crm/loeschprotokoll';
import { imHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { NextResponse } from 'next/server';
import { loadJson } from '@/lib/store/local-db';
import { aendereKontakte } from '@/lib/crm/kartei-schreiben';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { anzeigename } from '@/lib/make-one/crm';
import { pflichtangaben, selbstpruefung, verzeichnisVervollstaendigen, LOESCHREGELN } from '@/lib/crm/datenschutz';
import { verantwortlicherLaden } from '@/lib/datenschutz/einrichtung-server';
import { datenschutzUmfeld } from '@/lib/datenschutz/umfeld';
import { verantwortlicherText } from '@/lib/datenschutz/einrichtung';
import { googleKonfiguriert } from '@/lib/google/verbindung';
import { netzwerkenKontakteUeberFrist } from '@/lib/crm/netzwerken-loeschen';
import { befunde } from '@/lib/crm/befunde';
import { localDay, tagVon } from '@/lib/zeit';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from '@/lib/crm/speicher';
import { firmenAbgleichen } from '@/lib/crm/abgleich';
import { firmenDubletten } from '@/lib/crm/firmen';
import { dubletten } from '@/lib/crm/dubletten';
import { kennzahlen, vollstaendigkeit } from '@/lib/crm/kennzahlen';
import { LOESCHFRISTEN, LOESCHFRISTEN_SPEICHER, fristenWirksam, kontakteUeberFrist, type LoeschfristenBestand } from '@/lib/crm/loeschfristen';
import { nichtGeprueft, PRUEFEN_MONATE } from '@/lib/crm/geprueft';
import { nachweisOffen } from '@/lib/crm/einwilligung';
import { art14 } from '@/lib/crm/recht';
import { STUFEN, OFFENE_STUFEN, gesamtwert, wahrscheinlichkeit } from '@/lib/crm/pipeline';
import { gemesseneQuoten } from '@/lib/crm/deal-auswertung';
import { wertelistenVollstaendig, wertelistenPruefen, type Pruefung } from '@/lib/crm/wertelisten';
import type { ChancenStufe } from '@/lib/crm/typen';
import { ausgenommen } from '@/lib/crm/einschraenkung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  const heute = localDay();
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  let crm = await ladeCrm();
  // Löschfristen (U2 #52): wirksame Tabelle (Standard + Abweichungen), Personen über der Frist (nie automatisch gelöscht).
  const lf = (await loadJson<LoeschfristenBestand>(LOESCHFRISTEN_SPEICHER)) ?? {};
  const fristen = fristenWirksam(lf.fristen);
  // Verzeichnis (Art. 30) an EINER Stelle vervollständigen (05.10.): Startbestand, Netzwerken, Register/Kapazität, Google (wenn
  // eingerichtet), alte feste Verantwortliche → Platzhalter der Einrichtung. Idempotent, gerechnet in der Sperre des CRM.
  const vvJetzt = new Date().toISOString();
  if (verzeichnisVervollstaendigen(crm.verarbeitungen, vvJetzt, { google: googleKonfiguriert() }).geaendert) crm = await aendereCrm(c => { const r = verzeichnisVervollstaendigen(c.verarbeitungen, vvJetzt, { google: googleKonfiguriert() }); return r.geaendert ? { ...c, verarbeitungen: r.liste } : c; });
  const verantwortlicher = await verantwortlicherLaden();
  const konten = (await ladeKonten()).konten;
  const vorschlag = pflichtangaben(kontakte, crm);
  const zaehl = (f: (v: (typeof vorschlag)[number]) => string | undefined) => vorschlag.reduce((a, v) => { const x = f(v); if (x) a[x] = (a[x] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const nachId = new Map(kontakte.map(k => [k.id, k]));
  const log = (await loadJson<{ entries: { ts: string; agent: string; title?: string }[] }>('agent-log'))?.entries ?? [];
  const letzterImport = [...log].reverse().find(e => e.agent === 'crm' && (e.title ?? '').startsWith('Import'));
  const verlust: Record<string, number> = {};
  for (const c of crm.chancen.filter(c => c.stufe === 'verloren' && c.grund)) verlust[c.grund!] = (verlust[c.grund!] ?? 0) + 1;
  const kpis = kennzahlen(kontakte, crm, heute);
  const voll = wertelistenVollstaendig(crm.wertelisten);
  const gemessen = gemesseneQuoten(crm.chancen);
  // Ist zu den Zielen: Umsatz neu = Gesamtwert der in den letzten 30 Tagen gewonnenen Deals; SQL und Gespräche aus den Kennzahlen (null = noch nichts gemessen).
  const vor30 = new Date(`${heute}T12:00:00Z`); vor30.setUTCDate(vor30.getUTCDate() - 29);
  const ab = vor30.toISOString().slice(0, 10);
  const gewonnenAm = (c: (typeof crm.chancen)[number]) => tagVon(c.historie.filter(h => h.stufe === 'gewonnen').pop()?.am ?? c.geaendert);
  const umsatzNeu30 = crm.chancen.filter(c => c.stufe === 'gewonnen' && gewonnenAm(c) >= ab && gewonnenAm(c) <= heute).reduce((a, c) => a + gesamtwert(c), 0);
  return NextResponse.json({
    ok: true, heute,
    kennzahlen: kpis,
    qualitaet: {
      kontakte: kontakte.length, firmen: crm.firmen.length,
      vollstaendigkeit: vollstaendigkeit(kontakte),
      dublettenPersonen: dubletten(kontakte).length, dublettenFirmen: firmenDubletten(crm.firmen).length,
      ohneFirmenverweis: kontakte.filter(k => k.firma && !k.firmaId).length,
      art14: kontakte.filter(k => art14(k, heute)?.faellig).length,
      speicherbegrenzung: kontakteUeberFrist(kontakte, crm, heute, fristen.kontakte).length,
      // „Zuletzt geprüft“ (U2 #34): aktive Beziehungen und Leads, seit über 12 Monaten nicht geprüft (Kennungen + Namen).
      nichtGeprueft: nichtGeprueft(kontakte, crm, heute).map(x => ({ id: x.id, name: anzeigename(nachId.get(x.id)!), seit: x.seit, nie: x.nie })), pruefenMonate: PRUEFEN_MONATE,
      // Einwilligung ohne vollständigen Nachweis (U2-Nachtrag): Anzahl je Kanal + Liste — nur zum Ergänzen von Hand.
      nachweisOffen: (() => { const n = nachweisOffen(kontakte); return { jeKanal: n.jeKanal, liste: n.liste.map(x => ({ ...x, name: anzeigename(nachId.get(x.id)!) })) }; })(),
      werbesperren: kontakte.filter(k => k.werbesperre).map(k => ({ id: k.id, seit: k.werbesperre!.seit })),
    },
    wertelisten: {
      // gemessen (28.09., K4, #86): Gewinnquote der entschiedenen Deals, die die Stufe erreichten — ab MINDESTMENGE, sonst null.
      stufen: STUFEN.map(s => ({ id: s.id, label: s.label, standard: s.p, p: wahrscheinlichkeit(s.id, crm.wahrscheinlichkeiten), vonHand: typeof crm.wahrscheinlichkeiten?.[s.id] === 'number', weiterWenn: s.weiterWenn, offen: s.offen, gemessen: gemessen.find(g => g.stufe === s.id) ?? null })),
      verlustgruende: voll.verlustgruende.map(g => ({ grund: g.wert, fest: g.fest, anzahl: verlust[g.wert] ?? 0 })),
      kadenzTage: voll.kadenzTage, kadenzStandard: voll.kadenzStandard,
      branchen: voll.branchen, typen: voll.typen, kategorien: voll.kategorien, labels: voll.labels,
      kadenzPersonen: Object.fromEntries((['A', 'B', 'C', 'D'] as const).map(k => [k, kontakte.filter(x => x.kreis === k && !ausgenommen(x)).length])),
      ergebnisse: voll.ergebnisse,
      ziele: voll.ziele,
      ist: { umsatzNeu30: crm.chancen.some(c => c.stufe === 'gewonnen') ? umsatzNeu30 : null, sql30: kpis.find(k => k.id === 'sql_30')?.wert ?? null, gespraecheWoche: kpis.find(k => k.id === 'gespraeche')?.wert ?? null, dealsOffen: crm.chancen.filter(c => OFFENE_STUFEN.includes(c.stufe)).length },
    },
    letzterImport: letzterImport ? { zeit: letzterImport.ts, text: letzterImport.title ?? '' } : null,
    // 05.10.: echte Prüfung auch außerhalb des CRM (Verantwortlicher, AVV, zweiter Faktor, Sicherung, KI) — lib/datenschutz/umfeld.ts.
    selbstpruefung: selbstpruefung(kontakte, crm, heute, { konten: konten.length, mitPasswort: konten.filter(k => !!k.hash).length }, fristen.kontakte, await datenschutzUmfeld()),
    pflichtangaben: {
      anzahl: vorschlag.length, herkunft: zaehl(v => v.herkunft), rechtsgrundlage: zaehl(v => v.rechtsgrundlage), fremddaten: vorschlag.filter(v => v.fremddaten).length,
      beispiele: vorschlag.slice(0, 8).map(v => ({ name: anzeigename(nachId.get(v.id)!), herkunft: v.herkunft, rechtsgrundlage: v.rechtsgrundlage, fremddaten: !!v.fremddaten, grund: v.grund })),
    },
    loeschregeln: LOESCHREGELN,
    // Alle über der Frist (nie gekürzt) — mit „seit“ = letzte Spur (letzter Kontakt, Aktivität, Import, Prüfung).
    // Dazu (03.10., netz-recht): Personen aus Netzwerken ohne Interaktion seit 12 Monaten (kürzere Frist, `netzwerken: true`) — nie automatisch gelöscht.
    speicherbegrenzung: (() => {
      const ueber = kontakteUeberFrist(kontakte, crm, heute, fristen.kontakte);
      const nw = netzwerkenKontakteUeberFrist(kontakte, crm, heute, fristen['netzwerken-kontakte'], new Set(ueber.map(x => x.id)));
      return [...ueber.map(x => ({ id: x.id, name: anzeigename(nachId.get(x.id)!), seit: x.seit })), ...nw.map(x => ({ id: x.id, name: anzeigename(nachId.get(x.id)!), seit: x.seit, netzwerken: true }))];
    })(),
    loeschfristen: { tabelle: LOESCHFRISTEN, wirksam: fristen, gespeichert: lf.fristen ?? {}, lauf: lf.lauf ?? null },
    antraege: crm.antraege, verarbeitungen: crm.verarbeitungen,
    // Verantwortlicher aus der Einrichtung (05.10.) — eine Zeile, oder „fehlt — eintragen“; der Platzhalter im Verzeichnis zeigt darauf.
    verantwortlicher: { text: verantwortlicherText(verantwortlicher.v), fehlt: !verantwortlicher.v, quelle: verantwortlicher.quelle },
    befunde: befunde(kontakte, crm, heute, { loeschMonate: fristen.kontakte }),
    // Nie die Kontakt-Kennung zeigen (29.09., #30): Altbestand mit Klartext-Kennung erscheint als „lp-alt“, bis der Löschfristen-Lauf ihn umschreibt.
    loeschprotokoll: ((await loadJson<{ eintraege: { id: string; datum: string; grund: string; von: string }[] }>('crm-loeschprotokoll'))?.eintraege ?? []).slice(-20).reverse().map(e => (PROTOKOLL_ID.test(e.id) ? e : { ...e, id: 'lp-alt' })),
  });
}

export async function POST(req: Request) {
  if (!(await imHaushaltDesInhabers(req))) return NextResponse.json({ ok: false, fehler: 'Nur im Haushalt des Inhabers.' }, { status: 403 });
  let b: { aktion?: string; stufe?: string; p?: number | null; wertelisten?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (b.aktion === 'firmen-abgleich') return NextResponse.json({ ok: true, ...(await firmenAbgleichen()) });
  if (b.aktion === 'pflichtangaben') {
    const crm = await ladeCrm();
    let gesetzt = 0;
    await aendereKontakte<{ kontakte: Kontakt[] }>(cur => {
      const f = cur ?? { kontakte: [] };
      const v = new Map(pflichtangaben(f.kontakte, crm).map(x => [x.id, x]));
      return { ...f, kontakte: f.kontakte.map(k => {
        const x = v.get(k.id);
        if (!x) return k;
        gesetzt++;
        return { ...k, ...(x.herkunft && !k.herkunft ? { herkunft: x.herkunft } : {}), ...(x.rechtsgrundlage && !k.rechtsgrundlage ? { rechtsgrundlage: x.rechtsgrundlage } : {}), ...(x.fremddaten ? { fremddaten: true } : {}) };
      }) };
    }, werAus(req));
    return NextResponse.json({ ok: true, gesetzt });
  }
  if (b.aktion === 'wahrscheinlichkeit') {
    const s = STUFEN.find(x => x.id === b.stufe && x.offen);
    if (!s) return NextResponse.json({ ok: false, fehler: 'Nur offene Stufen.' }, { status: 400 });
    const p = b.p === null ? null : Math.max(0, Math.min(100, Math.round(Number(b.p))));
    if (p !== null && !Number.isFinite(p)) return NextResponse.json({ ok: false, fehler: 'p 0–100 oder null.' }, { status: 400 });
    await aendereCrm(cur => {
      const w = { ...(cur.wahrscheinlichkeiten ?? {}) } as Record<ChancenStufe, number>;
      if (p === null) delete w[s.id]; else w[s.id] = p;
      return { ...cur, wahrscheinlichkeiten: w };
    });
    return NextResponse.json({ ok: true });
  }
  if (b.aktion === 'wertelisten') {
    // Prüfen und schreiben in EINEM Schritt gegen den aktuellen Stand — kein Fenster, in dem Malins Änderung verloren ginge.
    const halter: { p?: Pruefung } = {};
    await aendereCrm(cur => { halter.p = wertelistenPruefen(b.wertelisten, cur.wertelisten); return halter.p.ok ? { ...cur, wertelisten: halter.p.wertelisten } : cur; });
    const p = halter.p!;
    if (!p.ok) return NextResponse.json({ ok: false, fehler: p.fehler.join(' · ') }, { status: 400 });
    return NextResponse.json({ ok: true, wertelisten: wertelistenVollstaendig(p.wertelisten) });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion unbekannt.' }, { status: 400 });
}
