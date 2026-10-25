// ─── Produkte & Mandate · Produkt-Import (P4, 19.10.; PRODUKTE_KONZEPT.md › Import) ─────────────────────────────────────────────
// POST { produkte: ProduktImport[], vorschau? } bzw. { csv: string, vorschau? } — die Regel steht rein in lib/crm/produkt-import.ts.
//   · Vorschau (Vorgabe, nur `vorschau: false` schreibt): je Produkt neu · ändert (Feld alt → neu) · gleich · Fehler · übersprungen — schreibt NIE.
//   · Übernehmen: in EINER CRM-Sperre neu planen (gegen den Bestand IN der Sperre) und über den CRM-Schreibweg anwenden (`wendeCrmAn`: Stand,
//     Prüfen 400/413, Regeln 409; neu = upsert, ändert = teil mit NUR den gelieferten Feldern), Protokoll `{ art: 'import', person }`.
//     Ein einziger Fehler in der Lieferung → 400 (zu groß → 413), nichts gespeichert. Danach die Abläufe über den Fulfillment-Weg (`zuordnung`),
//     nur wo es genau eine Paket-Vorlage mit dem Namen gibt — sonst Hinweis. Zuletzt gleichnamige Treppen-Stufen ohne Produkt über den Treppen-Schreibweg
//     (`treppeSchreiben`, Op `stufe` mit dem Stand aus der Vorschau-Lesung): nur `leistungIds` ändert sich, die Kennung der Stufe (Kundenfortschritt)
//     bleibt. Zweimal derselbe Import = beim zweiten Mal alles „gleich“.
// Zugang: Haushalt des Inhabers (Klasse `haushalt`); ein Konto „nur Business“ darf (Business), Produkte einer Privat-Einheit nicht. Dienstweg nur
// MIT einer Person des Haushalts (so importiert Claude auf dem Server im Namen einer Person) — ohne Person bzw. fremde Person 403. Bau-Kennung.
// Grenzen: höchstens 100 Produkte, 1 MB je Anfrage → 413.

import { NextResponse } from 'next/server';
import { imHaushaltDesInhabers, haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { nurHaushalt } from '@/lib/zugang/tor';
import { bauPruefen } from '@/lib/bau/pruefen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { ladeCrm, ladeCrmMitPapierkorb, aendereCrm, wendeCrmAn, type CrmAnwendung } from '@/lib/crm/speicher';
import { importPlanen, importAusTabelle, IMPORT_GRENZEN, type ImportKontext, type ImportPlan, type TabellenErgebnis } from '@/lib/crm/produkt-import';
import type { CrmBestand } from '@/lib/crm/typen';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';

export const runtime = 'nodejs';

/** Was an den Browser geht: der Plan ohne die Ops (die bleiben im Server). */
const oeffentlich = (p: ImportPlan) => ({ zeilen: p.zeilen, zahlen: p.zahlen, fehler: p.fehler, hinweise: p.hinweise, status: p.status });

/** Der Kontext des Plans: Register-Gesellschaften, Abläufe (Paket-Vorlagen + Zuordnung), Treppen-Stufen ohne Produkt — jedes Stück für sich sicher. */
async function kontextLaden(nurBusiness: boolean): Promise<ImportKontext> {
  const k: ImportKontext = { neueId: () => neueKennung('l'), nurBusiness };
  const haushalt = await haushaltDesInhabers();
  if (haushalt) {
    try {
      const { ladeRegister } = await import('@/lib/gesellschaften/server');
      const { alleGesellschaften, anzeigeName } = await import('@/lib/gesellschaften/modell');
      k.register = alleGesellschaften(await ladeRegister(haushalt)).filter(g => g.id.startsWith('g-')).map(g => ({ id: g.id, name: anzeigeName(g), ...(g.status ? { status: g.status } : {}) }));
    } catch { k.register = []; }
  }
  try {
    // Die gespeicherten Treppen-Stufen mit dem Stand des Eintrags — mit diesem Stand wird verknüpft (inzwischen geändert → 409, nur Hinweis).
    const { ladeTreppe, eintragStand } = await import('@/lib/crm/treppe-server');
    k.stufen = (await ladeTreppe()).stufen.map(s => ({ id: s.id, name: s.name, leistungIds: s.leistungIds, stand: eintragStand(s) }));
  } catch { k.stufen = []; }
  try {
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    const v = await fulfillmentLesen('vorlagen');
    k.vorlagen = v.prozesse.filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel }));
    k.zuordnung = v.zuordnung;
  } catch { k.vorlagen = []; }
  try {
    // Prozesse der Werkstatt (25.10.): nur die, die ein Produkt tragen darf (Fall-Art Mandat, `fuerProduktWaehlbar`) — für `prozess` (Titel oder Kennung).
    const { prozesseLesen } = await import('@/lib/prozesse/werkstatt-server');
    const { kurzAusEintrag } = await import('@/lib/prozesse/fulfillment-bruecke');
    const { fuerProduktWaehlbar } = await import('@/lib/prozesse/produkt-bindung');
    k.prozesse = (await prozesseLesen(haushalt ?? undefined)).prozesse.map(e => kurzAusEintrag(e)).filter(fuerProduktWaehlbar).map(p => ({ id: p.id, titel: p.titel }));
  } catch { k.prozesse = []; }
  return k;
}

/** Plan + Fehler/Hinweise der Tabelle (eine Stelle für Vorschau und Übernehmen). */
function planFuer(crm: CrmBestand, produkte: unknown, tabelle: TabellenErgebnis | null, k: ImportKontext): ImportPlan {
  const p = importPlanen(crm, produkte, k);
  if (tabelle) {
    p.hinweise.unshift(...tabelle.hinweise);
    if (tabelle.fehler.length) { p.fehler.unshift(...tabelle.fehler); if (p.status === 200) p.status = 400; p.ops = []; p.zuordnungen = []; p.stufen = []; }
  }
  return p;
}

export async function POST(req: Request) {
  const zugang = await imHaushaltDesInhabers(req);
  if (!zugang) return nurHaushalt();
  const alterBau = bauPruefen(req);
  if (alterBau) return alterBau;
  let body: { produkte?: unknown; csv?: unknown; vorschau?: unknown };
  try { body = await jsonBegrenzt(req, IMPORT_GRENZEN.bytes); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 });
  const hatCsv = body.csv !== undefined, hatProdukte = body.produkte !== undefined;
  if (hatCsv === hatProdukte) return NextResponse.json({ ok: false, fehler: 'Entweder „produkte“ (Liste der Produkt-Karten) oder „csv“ (Tabelle als Text) mitschicken.' }, { status: 400 });
  if (hatCsv && typeof body.csv !== 'string') return NextResponse.json({ ok: false, fehler: '„csv“: die Tabelle als Text.' }, { status: 400 });
  const tabelle = hatCsv ? importAusTabelle(body.csv as string) : null;
  const produkte = tabelle ? tabelle.produkte : body.produkte;
  // Nur ein ausdrückliches `vorschau: false` schreibt — alles andere ist Vorschau (nie aus Versehen geschrieben).
  const vorschau = body.vorschau !== false;
  const person = zugang.person;
  const { privatAusgeblendetFuer } = await import('@/lib/zugang/konto-sicht-server');
  const k = await kontextLaden(await privatAusgeblendetFuer(person));

  if (vorschau) {
    const p = planFuer(await ladeCrmMitPapierkorb(), produkte, tabelle, k);
    // Die Vorschau zeigt Fehler im Plan (200) — nur eine zu große Lieferung als Ganzes ist 413.
    return NextResponse.json({ ok: true, vorschau: true, plan: oeffentlich(p) }, { status: p.status === 413 && !p.zeilen.length ? 413 : 200 });
  }

  // Übernehmen: in EINER Sperre neu planen und anwenden — gegen den Bestand IN der Sperre.
  const jetzt = new Date();
  const wer: Wer = { art: 'import', person };
  const halter: { plan?: ImportPlan; r?: CrmAnwendung } = {};
  await aendereCrm(cur => {
    const p = planFuer(cur, produkte, tabelle, k);
    halter.plan = p;
    if (p.status !== 200 || !p.ops.length) return cur;
    halter.r = wendeCrmAn(cur, p.ops, jetzt.toISOString(), person);
    return halter.r.bestand;
  }, wer);
  const plan = halter.plan!;
  if (plan.status !== 200) return NextResponse.json({ ok: false, vorschau: false, fehler: plan.status === 413 ? 'Zu groß — nichts gespeichert.' : 'Die Lieferung hat Fehler — nichts gespeichert.', plan: oeffentlich(plan) }, { status: plan.status });
  const r = halter.r;
  if (r) {
    const ablehnung = r.konflikte.length ? { status: 409, text: 'Wurde inzwischen geändert — bitte die Vorschau neu holen.' }
      : r.grenze.length ? { status: 413, text: r.grenze.join(' · ') }
      : r.ungueltig?.length ? { status: 400, text: r.ungueltig.join(' · ') }
      : r.abgelehnt?.length ? { status: 409, text: r.abgelehnt.join(' · ') }
      : r.sperren.length ? { status: 409, text: r.sperren.map(s => s.text).join(' · ') } : null;
    if (ablehnung) return NextResponse.json({ ok: false, vorschau: false, fehler: `${ablehnung.text} Nichts gespeichert.`, plan: oeffentlich(plan) }, { status: ablehnung.status });
  }

  // Abläufe zuordnen — über den Fulfillment-Weg (dieselbe Op wie dort `zuordnung`). Scheitert es, steht der Katalog trotzdem; Hinweis.
  const ablauf = { zugeordnet: 0, hinweise: [] as string[] };
  if (plan.zuordnungen.length) {
    try {
      const { fulfillmentAendern, eintragStand } = await import('@/lib/fulfillment/speicher');
      const { vorlagenAnwenden } = await import('@/lib/fulfillment/prozesse/vorlagen-anwenden');
      const leistungen = (await ladeCrm()).leistungen.map(l => l.id);
      const ops = plan.zuordnungen.map(z => ({ op: 'zuordnung', leistungId: z.leistungId, vorlageId: z.vorlageId }));
      const e = await fulfillmentAendern('vorlagen', d => vorlagenAnwenden(d, ops, {
        person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), standVon: eintragStand, neueId: pf => neueKennung(pf), leistungen,
      }), wer);
      if (e.ok) ablauf.zugeordnet = plan.zuordnungen.length;
      else ablauf.hinweise.push(`Abläufe nicht zugeordnet: ${e.fehler} — bitte im Fulfillment zuordnen.`);
    } catch {
      ablauf.hinweise.push('Abläufe nicht zugeordnet (Fulfillment nicht lesbar) — bitte im Fulfillment zuordnen.');
    }
  }
  // Gleichnamige Treppen-Stufen ohne Produkt verknüpfen — über den Treppen-Schreibweg (Einzel-Op mit Stand, alles oder nichts).
  const treppe = { verknuepft: 0, hinweise: [] as string[] };
  if (plan.stufen.length) {
    try {
      const { treppeSchreiben } = await import('@/lib/crm/treppe-server');
      const t = await treppeSchreiben(plan.stufen.map(x => ({ op: 'stufe', eintrag: { id: x.stufeId, leistungIds: x.leistungIds }, stand: x.stand })), person, wer, jetzt);
      if (t.ok) treppe.verknuepft = plan.stufen.length;
      else treppe.hinweise.push(t.status === 409 ? 'Die Leistungstreppe wurde inzwischen geändert — Stufen nicht verknüpft. Bitte die Vorschau neu holen und noch einmal übernehmen.' : `Stufen nicht verknüpft: ${t.fehler} — bitte in der Treppe verknüpfen.`);
    } catch {
      treppe.hinweise.push('Stufen nicht verknüpft (Leistungstreppe nicht lesbar) — bitte in der Treppe verknüpfen.');
    }
  }
  return NextResponse.json({
    ok: true, vorschau: false, plan: oeffentlich(plan),
    angelegt: plan.zahlen.neu, geaendert: plan.zahlen.aendert, gleich: plan.zahlen.gleich, uebersprungen: plan.zahlen.uebersprungen, ablauf, treppe,
  });
}
