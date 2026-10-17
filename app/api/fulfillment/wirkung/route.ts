// ─── Fulfillment — Wirkungsbericht (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 5.3) ──────────────────────────────────────────────────────
// GET  ?m=<mandat>            → das PDF als Anhang (aus dem verschlüsselten Ordner `fulfillment-unterlagen`), nie inline.
//      ?m=<mandat>&vorschau=1 → der Inhalt als JSON (Vorschau: Wert-Konto vorher/nachher, Quick Wins, Geliefert, Befähigung, Zitat).
// POST { aktion: 'erstellen', mandatId, zitat?: { text, einwilligungAm, wie } } → PDF erzeugen, verschlüsselt ablegen, am Fall vermerken.
//        Ein Kundenzitat NUR mit vermerkter Einwilligung (Tag, wie). Bausteine „nur intern“ erscheinen nie.
//      { aktion: 'fuer-mail', mandatId } → eine Kopie in die Dateiablage am Mandat (damit die Inbox sie anhängen kann) + Empfänger/Du-Sie —
//        gesendet wird erst per Klick über /api/inbox/senden.
//      { aktion: 'fallstudie', mandatId, mitNamen? } → ein Baustein-Entwurf „Fallstudie“ in der Bibliothek (anonym, außer mit Einwilligung).
// Nur per Sitzung (Dienstweg schreibt nie), Bau-Kennung.

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { fulfillmentAendern, eintragStand, UNTERLAGEN_ORDNER } from '@/lib/fulfillment/speicher';
import { fallUmfeld, ableitungFuer, wirkungVermerken } from '@/lib/fulfillment/prozesse/fall-server';
import { fallWirksam } from '@/lib/fulfillment/prozesse/onboarding';
import { wirkungsDokument, wirkungDateiname, wirkungAnzeigename, fallstudieEntwurf } from '@/lib/fulfillment/prozesse/wirkung';
import { vorlagenAnwenden } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { MANDAT_ID } from '@/lib/fulfillment/grenzen';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TAG = /^\d{4}-\d{2}-\d{2}$/;

/** Das PDF aus der verschlüsselten Ablage — null, wenn es fehlt oder der Name nicht (mehr) zulässig ist (Fassung vor dem 11.10. hieß `….pdf`). */
async function berichtLesen(name: string): Promise<Buffer | null> {
  const { bildOeffnen } = await import('@/lib/store/bild-ablage');
  try { return await bildOeffnen(UNTERLAGEN_ORDNER, name); } catch { return null; }
}

async function grundlage(mandatId: string, zitat?: { text: string; einwilligungAm: string; wie: string }) {
  const jetzt = new Date(), iso = jetzt.toISOString(), heute = localDay(jetzt);
  const { h, crm, vorlagen, faelle, kunde, termine } = await fallUmfeld([mandatId]);
  const { istBusinessGesellschaft } = await import('@/lib/einheiten');
  const m = crm.mandate.find(x => x.id === mandatId && !x.geloeschtAm && istBusinessGesellschaft(x.gesellschaft));
  const f = faelle.faelle[mandatId];
  if (!m || !f) return null;
  const w = fallWirksam(f, ableitungFuer(f, m, crm, vorlagen, kunde[mandatId], iso, termine[mandatId]));
  const absender = await (async () => {
    try { const { ladeRegister } = await import('@/lib/gesellschaften/server'); const reg = await ladeRegister(h); const x = (reg?.gesellschaften ?? []).find(e => e.id === m.gesellschaft) as { firmierung?: string; name?: string } | undefined; return x?.firmierung || x?.name; } catch { return undefined; }
  })();
  const z = zitat ?? f.wirkung?.zitat;
  // Seit 12.10. (Fulfillment extern): „Wie es weitergehen kann“ = die nächste Stufe der Leistungstreppe (Name + Ergebnis, nie ein Preis) — fehlt sie, kein Hinweis.
  const naechsteStufe = await (async () => {
    try {
      const [{ ladeTreppe }, { kundenZeilen, naechsteStufen }] = await Promise.all([import('@/lib/crm/treppe-server'), import('@/lib/crm/treppe')]);
      const datei = await ladeTreppe(heute);
      const zeile = kundenZeilen({ datei, crm: { ...crm, mandate: [{ ...m, status: m.status === 'beendet' ? 'aktiv' : m.status }] }, heute })[0];
      const stufe = zeile?.stufe ? datei.stufen.find(s => s.id === zeile.stufe!.id) : undefined;
      const n = stufe ? naechsteStufen(stufe, datei.stufen)[0] : undefined;
      return n ? { name: n.name, ...(n.ergebnis ? { text: n.ergebnis } : {}) } : undefined;
    } catch { return undefined; }
  })();
  const v = vorlagen.prozesse.find(p => p.id === f.vorlageId);
  const dok = wirkungsDokument({
    fall: w, mandat: m, paket: v?.titel, ...(absender ? { absender } : {}), heute, bausteine: vorlagen.bausteine, marken: vorlagen.marken, ...(z ? { zitat: z } : {}),
    ...(v ? { freigaben: v.freigaben } : {}), ...(naechsteStufe ? { naechsteStufe } : {}),
  });
  return { h, m, f, dok, heute, jetzt, vorlagen };
}

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const url = new URL(req.url);
  const m = url.searchParams.get('m') ?? '';
  if (!MANDAT_ID.test(m)) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt (?m=).' }, { status: 400 });
  const g = await grundlage(m);
  if (!g) return NextResponse.json({ ok: false, fehler: 'Für dieses Mandat gibt es keinen Fall.' }, { status: 404 });
  // Der Bericht nennt den Kunden (Firma) — Lese-Protokoll (Prüf-Fund 11.10.).
  leseZugriff(req, 'fulfillment', { ids: [m], anzahl: 1 });
  if (url.searchParams.get('vorschau') === '1') return NextResponse.json({ ok: true, dokument: g.dok, erstellt: g.f.wirkung ?? null });
  const name = g.f.wirkung?.dateiName;
  if (!name) return NextResponse.json({ ok: false, fehler: 'Noch kein Wirkungsbericht erstellt.' }, { status: 404 });
  const bytes = await berichtLesen(name);
  if (!bytes) return NextResponse.json({ ok: false, fehler: 'Die Datei des Berichts fehlt — bitte neu erstellen.' }, { status: 404 });
  const tag = /^\d{4}-\d{2}-\d{2}/.test(g.f.wirkung?.erstelltAm ?? '') ? g.f.wirkung!.erstelltAm.slice(0, 10) : g.heute;
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${wirkungAnzeigename(tag)}"`, 'x-content-type-options': 'nosniff', 'content-security-policy': 'sandbox', 'cache-control': 'no-store' },
  });
}

export async function POST(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const mid = typeof b.mandatId === 'string' && MANDAT_ID.test(b.mandatId) ? b.mandatId : '';
  if (!mid) return NextResponse.json({ ok: false, fehler: 'Mandat fehlt.' }, { status: 400 });
  let zitat: { text: string; einwilligungAm: string; wie: string } | undefined;
  if (b.zitat !== undefined && b.zitat !== null) {
    const x = b.zitat as Record<string, unknown>;
    const text = typeof x.text === 'string' ? x.text.trim() : '', am = typeof x.einwilligungAm === 'string' ? x.einwilligungAm : '', wie = typeof x.wie === 'string' ? x.wie.trim() : '';
    if (!text || !TAG.test(am) || !wie) return NextResponse.json({ ok: false, fehler: 'Ein Kundenzitat nur mit vermerkter Einwilligung: Text, Tag der Einwilligung und wie (z. B. „per Mail“).' }, { status: 400 });
    if (text.length > 1000 || wie.length > 300) return NextResponse.json({ ok: false, fehler: 'Zitat höchstens 1.000 Zeichen.' }, { status: 413 });
    zitat = { text, einwilligungAm: am, wie };
  }
  const g = await grundlage(mid, zitat);
  if (!g) return NextResponse.json({ ok: false, fehler: 'Für dieses Mandat gibt es keinen Fall.' }, { status: 404 });
  if (b.aktion === 'erstellen') {
    const { wirkungPdf } = await import('@/lib/fulfillment/prozesse/wirkung-pdf');
    const bytes = Buffer.from(await wirkungPdf(g.dok, { erstellt: g.jetzt }));
    const name = wirkungDateiname(mid, g.heute);
    const { bildAblegen } = await import('@/lib/store/bild-ablage');
    await bildAblegen(UNTERLAGEN_ORDNER, name, bytes);
    await wirkungVermerken(mid, { erstelltAm: g.jetzt.toISOString(), dateiName: name, ...(zitat ?? g.f.wirkung?.zitat ? { zitat: zitat ?? g.f.wirkung!.zitat! } : {}) }, z.person);
    return NextResponse.json({ ok: true, dateiName: name, dokument: g.dok });
  }
  if (b.aktion === 'fuer-mail') {
    const name = g.f.wirkung?.dateiName;
    if (!name) return NextResponse.json({ ok: false, fehler: 'Erst den Wirkungsbericht erstellen.' }, { status: 409 });
    const bytes = await berichtLesen(name);
    if (!bytes) return NextResponse.json({ ok: false, fehler: 'Die Datei des Berichts fehlt — bitte neu erstellen.' }, { status: 404 });
    // Prüf-Fund 11.10.: jede Kopie in der Ablage ist ein Beleg (nicht löschbar) — dieselbe Fassung des Berichts nur EINMAL ablegen, die Kennung
    // der Kopie merkt sich der Fall (Marke `wirkung-mail:<erstelltAm>` — je erstellter Fassung); fehlt die Kopie inzwischen, wird neu abgelegt.
    const { ablegen, ablageListe } = await import('@/lib/dateien/ablage');
    const marke = `wirkung-mail:${g.f.wirkung?.erstelltAm ?? name}`;
    const vorhanden = g.f.marken?.[marke];
    const da = vorhanden ? (await ablageListe(g.h)).some(x => x.id === vorhanden) : false;
    const e = da ? { id: vorhanden! } : await ablegen(g.h, z.person, { art: 'sonstig', titel: `Wirkungsbericht ${g.m.kunde} ${g.heute}`.slice(0, 160), mandatId: g.m.id, ...(g.m.firmaId ? { firmaId: g.m.firmaId } : {}) }, { bytes, name: wirkungAnzeigename(g.heute), typ: 'application/pdf' }, g.jetzt.toISOString());
    if (!da) {
      await fulfillmentAendern('faelle', d => {
        const f = d.faelle[mid];
        if (!f) return { ok: true, datei: d, geaendert: [] };
        return { ok: true, datei: { ...d, faelle: { ...d.faelle, [mid]: { ...f, marken: { ...f.marken, [marke]: e.id } } } }, geaendert: [mid] };
      }, werAus(req), g.h);
    }
    leseZugriff(req, 'fulfillment', { ids: [mid], anzahl: 1 });
    const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
    const kontakte = await kontakteFuerVerarbeitung();
    const k = g.m.kontaktIds.map(id => kontakte.find(x => x.id === id)).find(x => !!x?.email);
    return NextResponse.json({
      ok: true, datei: { id: e.id, name: wirkungAnzeigename(g.heute) }, anrede: k?.anrede === 'Du' ? 'Du' : 'Sie', gesellschaft: g.m.gesellschaft,
      an: k?.email ? { email: k.email, kontaktId: k.id, ...(k.vorname || k.nachname ? { name: `${k.vorname ?? ''} ${k.nachname ?? ''}`.trim() } : {}) } : null,
      ...(k?.vorname ? { vorname: k.vorname } : {}),
    });
  }
  if (b.aktion === 'fallstudie') {
    const mitNamen = b.mitNamen === true && !!g.f.wirkung?.zitat?.einwilligungAm;
    const e = fallstudieEntwurf(g.dok, mitNamen);
    const r = await fulfillmentAendern('vorlagen', d => vorlagenAnwenden(d, [{ op: 'baustein', eintrag: { art: 'dokument', titel: e.titel, text: e.text, gliederung: e.gliederung, tags: ['fallstudie', 'entwurf'], kundeSichtbar: false } }], {
      person: z.person, jetzt: g.jetzt.toISOString(), heute: g.heute, standVon: eintragStand, neueId: p => neueKennung(p),
    }), werAus(req), g.h);
    if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler }, { status: r.status });
    return NextResponse.json({ ok: true, bausteinId: r.geaendert[0], text: mitNamen ? 'Fallstudie als Entwurf in der Bibliothek (mit Namen — Einwilligung vermerkt).' : 'Fallstudie als anonymer Entwurf in der Bibliothek.' });
  }
  return NextResponse.json({ ok: false, fehler: 'aktion: erstellen, fuer-mail oder fallstudie.' }, { status: 400 });
}
