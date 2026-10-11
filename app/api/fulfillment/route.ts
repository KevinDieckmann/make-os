// ─── Fulfillment — Vorlagen, Bibliothek, Rituale, Zuordnung, Einstellungen (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md Abschnitt 9) ─────
// GET  → Übersicht: Vorlagen (mit Stand je Kopf/Knoten), Bibliothek in Kurzform (lange Texte nur mit `?baustein=<id>`), Rituale, Zuordnung
//        Produkt → Vorlage, Einstellungen, Onboarding-Kandidaten, Fälle (Kurzform), „welcher Kunde steht wo“, Kennzahlen (1.4), Import-Läufe.
//        `?nur=kurz` → nur Kandidaten, Zuordnung, Vorlagen-Titel und Fälle (für die Einhänger in Produkte & Mandate). Lesen schreibt nie.
// PATCH { ops } → Einzel-Ops mit Stand (lib/fulfillment/prozesse/vorlagen-anwenden.ts), alles oder nichts: 400/403/404/409/413.
//        Kunden-Link-Schalter und Puls-Schwelle NICHT hier (400) — EIN Weg: POST /api/fulfillment/kunde (C2). Nur per Sitzung (Dienstweg 403), Bau-Kennung. `?space=privat` → 403 (Business only).
// Tor: `fulfillmentZugang` (Routen-Register, Modul fulfillment).

import { NextResponse } from 'next/server';
import { fulfillmentZugang } from '@/lib/fulfillment/zugang';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '@/lib/fulfillment/speicher';
import { kundenJeKnoten } from '@/lib/fulfillment/regeln';
import { vorlagenAnwenden, mitStaenden, vorlagenMitBaustein, MUSTER_WAHL, markeMuster } from '@/lib/fulfillment/prozesse/vorlagen-anwenden';
import { fallUmfeld, ableitungFuer } from '@/lib/fulfillment/prozesse/fall-server';
import { faelleKurz, kandidatenAnsicht } from '@/lib/fulfillment/prozesse/server';
import { fallWirksam } from '@/lib/fulfillment/prozesse/onboarding';
import { ffKennzahlenRechnen, kickoffTag } from '@/lib/fulfillment/prozesse/kennzahlen';
import { istKickoff } from '@/lib/fulfillment/prozesse/onboarding';
import { nurIntern, urheberGeprueft, rechtOffen, vorVerkaufOffen } from '@/lib/fulfillment/prozesse/bausteine';
import { mandatsEnde, unterschriftAm } from '@/lib/fulfillment/regeln';
import { MUSTER_LANDKARTE, MUSTER_P1, MUSTER_P2, MUSTER_P3 } from '@/lib/fulfillment/muster';
import { istInhaber } from '@/lib/zugang/haushalt-inhaber';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import { MANDAT_ID, KENNUNG } from '@/lib/fulfillment/grenzen';
import { istBusinessGesellschaft } from '@/lib/einheiten';
import { leseZugriff } from '@/lib/store/leseprotokoll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MUSTER_IDS: Record<string, string> = { landkarte: MUSTER_LANDKARTE.id, p1: MUSTER_P1.id, p2: MUSTER_P2.id, p3: MUSTER_P3.id };

export async function GET(req: Request) {
  const z = await fulfillmentZugang(req);
  if (z instanceof Response) return z;
  const url = new URL(req.url);
  const jetzt = new Date(), iso = jetzt.toISOString(), heute = localDay(jetzt);
  const bid = url.searchParams.get('baustein');
  if (bid) {
    if (!KENNUNG.baustein.test(bid)) return NextResponse.json({ ok: false, fehler: 'Unbekannter Baustein.' }, { status: 400 });
    const d = await fulfillmentLesen('vorlagen', z.haushalt);
    const b = d.bausteine.find(x => x.id === bid);
    if (!b) return NextResponse.json({ ok: false, fehler: 'Diesen Baustein gibt es nicht (mehr).' }, { status: 404 });
    return NextResponse.json({ ok: true, baustein: { ...b, stand: eintragStand(b) }, steckt: vorlagenMitBaustein(d, b.id), urheberGeprueft: urheberGeprueft(d, b.id) });
  }
  const { crm, vorlagen, faelle: faelleRoh, kunde } = await fallUmfeld();
  // Prüf-Fund 11.10.: nur Mandate von Business-Gesellschaften (die Selbstständigkeit gehört zu Privat) — auch Fälle, deren Mandat inzwischen privat
  // ist, fallen heraus. Ein Fall ohne Mandat im CRM bleibt als „Mandat (gelöscht)“ (ohne Namen).
  const mandatVon = new Map(crm.mandate.map(m => [m.id, m] as const));
  const imBusiness = (mandatId: string): boolean => { const m = mandatVon.get(mandatId); return !m || istBusinessGesellschaft(m.gesellschaft); };
  const faelle = { ...faelleRoh, faelle: Object.fromEntries(Object.entries(faelleRoh.faelle).filter(([id]) => imBusiness(id))) };
  const kurz = await faelleKurz(Object.keys(faelle.faelle));
  const mandate = Object.fromEntries(crm.mandate.filter(m => istBusinessGesellschaft(m.gesellschaft) && (faelle.faelle[m.id] || !m.geloeschtAm)).map(m => [m.id, { kunde: m.kunde, titel: m.titel, leistungId: m.leistungId ?? null, status: m.status }]));
  const faelleAnsicht = Object.fromEntries(Object.values(faelle.faelle).map(f => [f.mandatId, { ...kurz[f.mandatId], vorlageId: f.vorlageId, kunde: mandate[f.mandatId]?.kunde ?? 'Mandat (gelöscht)', titel: mandate[f.mandatId]?.titel ?? '' }]));
  const kandidaten = kandidatenAnsicht(crm, vorlagen, faelle.faelle, heute, iso);
  // Firmen-/Kundennamen gehen raus → Lese-Protokoll (Prüf-Fund 11.10.), nur die Anzahl.
  leseZugriff(req, 'fulfillment', { anzahl: Object.keys(mandate).length + kandidaten.length });
  if (url.searchParams.get('nur') === 'kurz') {
    return NextResponse.json({
      ok: true, kandidaten, zuordnung: vorlagen.zuordnung, faelle: faelleAnsicht,
      prozesse: vorlagen.prozesse.filter(p => p.art === 'paket').map(p => ({ id: p.id, titel: p.titel, art: p.art })),
    });
  }
  // Welcher Kunde steht wo (je Vorlage, wirksame Fälle).
  const wirksam = Object.values(faelle.faelle).map(f => fallWirksam(f, ableitungFuer(f, crm.mandate.find(m => m.id === f.mandatId), crm, vorlagen, kunde[f.mandatId], iso)));
  const zaehler = Object.fromEntries(vorlagen.prozesse.map(p => [p.id, kundenJeKnoten(p, wirksam)]));
  const kickoffIds = vorlagen.rituale.filter(istKickoff).map(r => r.id);
  const treppe = await import('@/lib/crm/treppe-server').then(t => t.ladeTreppe(heute)).catch(() => null);
  const dossiers = await import('@/lib/fulfillment/analyse/server').then(a => a.dossierKurzFuer(Object.keys(faelle.faelle))).catch(() => ({} as Record<string, never>));
  const kennzahlen = ffKennzahlenRechnen(wirksam.map(f => {
    const m = crm.mandate.find(x => x.id === f.mandatId);
    const r = treppe?.reports[f.mandatId];
    const u = m ? unterschriftAm(m, crm, f.gestartetAm) : null;
    const kt = kickoffTag(f, kickoffIds);
    return {
      fall: f, kunde: m?.kunde ?? '', ...(u ? { unterschrift: u.am } : {}), ...(kt ? { kickoffTag: kt } : {}),
      ...(r?.gesendetAm ? { reportLetzter: r.gesendetAm } : {}), ...(kunde[f.mandatId]?.letzterPuls ? { puls: kunde[f.mandatId].letzterPuls } : {}),
      ...(dossiers[f.mandatId] ? { dossier: dossiers[f.mandatId] } : {}), mandatsEnde: m ? mandatsEnde(m) : null,
    };
  }), { heute, jetzt: iso, willkommenStunden: vorlagen.einstellungen.willkommenStunden });
  const st = mitStaenden(vorlagen, eintragStand);
  return NextResponse.json({
    ok: true, inhaber: await istInhaber(z.person),
    prozesse: st.prozesse,
    // Bibliothek in Kurzform: ohne Langtext und Fragen (die holt `?baustein=`), mit Marken und „steckt in …“.
    bausteine: st.bausteine.map(({ text: _t, fragen, gliederung, ...b }) => ({
      ...b, gliederungAnzahl: gliederung.length, fragenAnzahl: fragen?.length ?? 0, nurIntern: nurIntern(b), rechtOffen: rechtOffen(b), vorVerkaufOffen: vorVerkaufOffen(b, vorlagen),
      steckt: vorlagenMitBaustein(vorlagen, b.id).length,
    })),
    rituale: st.rituale, zuordnung: vorlagen.zuordnung, einstellungen: vorlagen.einstellungen, agentZusatz: vorlagen.agentZusatz,
    importLaeufe: vorlagen.importLaeufe.map(l => ({ id: l.id, am: l.am, von: l.von, datei: l.datei, neu: l.neu.length, geaendert: l.geaendert.length })),
    musterOffen: MUSTER_WAHL.filter(w => { const id = vorlagen.marken[markeMuster(MUSTER_IDS[w.id])]; return !id || !vorlagen.prozesse.some(p => p.id === id); }).map(w => w.id),
    kandidaten, faelle: faelleAnsicht, zaehler, mandate, kennzahlen,
    leistungen: crm.leistungen.filter(l => !l.geloeschtAm).map(l => ({ id: l.id, name: l.name, status: l.status })),
  });
}

export async function PATCH(req: Request) {
  const z = await fulfillmentZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: { ops?: unknown };
  try { b = await jsonBegrenzt(req, 2 * 1024 * 1024); } catch (e) { return jsonZuGross(e) ?? NextResponse.json({ ok: false, fehler: 'Kein JSON.' }, { status: 400 }); }
  const jetzt = new Date();
  const crm = await import('@/lib/crm/speicher').then(c => c.ladeCrm());
  const ops = Array.isArray(b.ops) ? b.ops : [];
  // Zuordnung nur auf Produkte des Katalogs; „onboarding-aus“ nur für Mandate, die es gibt.
  for (const o of ops) if (o && typeof o === 'object' && (o as { op?: unknown }).op === 'onboarding-aus' && !(typeof (o as { mandatId?: unknown }).mandatId === 'string' && MANDAT_ID.test((o as { mandatId: string }).mandatId) && crm.mandate.some(m => m.id === (o as { mandatId: string }).mandatId))) {
    return NextResponse.json({ ok: false, fehler: 'Dieses Mandat gibt es nicht (mehr).' }, { status: 404 });
  }
  const r = await fulfillmentAendern('vorlagen', d => vorlagenAnwenden(d, b.ops, {
    person: z.person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), standVon: eintragStand, neueId: p => neueKennung(p),
    leistungen: crm.leistungen.filter(l => !l.geloeschtAm).map(l => l.id),
  }), werAus(req), z.haushalt);
  if (!r.ok) return NextResponse.json({ ok: false, fehler: r.fehler, ...(r.konflikte ? { konflikte: r.konflikte } : {}) }, { status: r.status });
  const st = mitStaenden(r.datei, eintragStand);
  return NextResponse.json({ ok: true, geaendert: r.geaendert, prozesse: st.prozesse, rituale: st.rituale, zuordnung: r.datei.zuordnung, einstellungen: r.datei.einstellungen });
}
