// ─── Prozesse — die Werkstatt: Prozesse aller Business-Bereiche als Entwurf bauen, veröffentlichen, aktiv schalten (Etappe B1, 21.10.) ─────────────────
// GET              Liste aller Prozesse (Werkstatt + Paket-Vorlagen des Fulfillments, die nur lesend) mit den Rechten der Person.
// GET ?vorlagen=1  die Galerie der Vorlagen (Kundengewinnung, 22.10.) — Kurzform + welche schon übernommen sind; `?vorlage=<id>` eine mit Vorschau.
// GET ?id=         ein Prozess: Entwurf mit Stand, Versionen (kurz), Befunde (alle — die Werkstatt zeigt sie am Knoten), Kanten des Flusses, Webhook (ohne
//                  Schlüssel), Produkte, die auf ihn zeigen (22.10., nur Kennung + Name). `&version=<nr>` eine Version ganz; `&vergleich=<a>,<b>` (Nummer oder „entwurf“) der Vergleich (nur Feldnamen, nie Werte).
//                  `&datum=<Knoten>` (22.10.) die nächsten Starts eines Datums-Auslösers (nur Tage + Anzahlen).
// POST { aktion }  anlegen (anfrageId) · steckbrief · entwurf · veroeffentlichen · version-uebernehmen · status (lib/prozesse/bestand.ts `werkstattAnwenden`)
//                  · aus-vorlage { vorlageId, eigner?, anfrageId } (22.10.) · webhook-schluessel · webhook-scharf · webhook-entfernen (lib/prozesse/webhook-server.ts). Stand je Prozess → 409 mit der aktuellen Fassung.
//                  · Kopieren und eigene Vorlagen (22.10., lib/prozesse/kopie.ts): kopieren { id, anfrageId } · als-vorlage { id, titel?, beschreibung?, anfrageId }
//                    · vorlage-loeschen { vorlageId } · aus-vorlage mit `ev-…` (eigene Vorlage) — Bestand `prozess-vorlagen--<h>`, ohne Personen und Fall-Daten.
// Tor: `werkstattZugang` — Haushalt des Inhabers, Sicht Privat 403; schreiben nur per Sitzung (Dienstweg 403) mit Bau-Kennung; veröffentlichen, Status und
// Webhook nur volle Mitglieder (Konto „nur Business“ baut Entwürfe). Keine Personendaten Dritter (Lese-Protokoll nicht nötig); Lesen schreibt nie.

import { NextResponse } from 'next/server';
import { werkstattZugang } from '@/lib/prozesse/werkstatt-zugang';
import { prozesseAendern, prozesseLesen, pruefKontextFuer, standVon, webhooksLesen } from '@/lib/prozesse/werkstatt-server';
import { werkstattAnwenden, type WerkstattErgebnis } from '@/lib/prozesse/bestand';
import { definitionPruefen } from '@/lib/prozesse/definition-pruefen';
import { kantenVon } from '@/lib/prozesse/fluss';
import { entwurfGeaendert, versionKurz, versionenVergleichen } from '@/lib/prozesse/versionen';
import { webhookKurz } from '@/lib/prozesse/webhook';
import { webhookVerwalten } from '@/lib/prozesse/webhook-server';
import { fulfillmentProzesse, kurzAusEintrag, kurzAusFulfillment } from '@/lib/prozesse/fulfillment-bruecke';
import { PROZESS_GRENZEN, PROZESS_KENNUNG, type ProzessDefinition, type ProzessEintrag } from '@/lib/prozesse/definition';
import { jsonBegrenzt, jsonZuGross } from '@/lib/zugang/json-grenze';
import { werAus } from '@/lib/store/aenderungsprotokoll';
import { einmalig } from '@/lib/store/anfragen';
import { neueKennung } from '@/lib/kennung';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Ein Entwurf mit allen Kanten ist groß (bis 400 Knoten) — 2 MB Körper. */
const KOERPER_MAX = 2 * 1024 * 1024;
const nein = (status: number, fehler: string, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, fehler, ...extra }, { status });
const ansicht = (e: ProzessEintrag) => ({ eintrag: { ...e, versionen: e.versionen.map(versionKurz) }, stand: standVon(e), entwurfGeaendert: entwurfGeaendert(e) });

export async function GET(req: Request) {
  const z = await werkstattZugang(req);
  if (z instanceof Response) return z;
  const q = new URL(req.url).searchParams;
  const id = q.get('id');
  const d = await prozesseLesen(z.haushalt);
  // Vorlagen der Kundengewinnung (22.10.): die Galerie (Kurzform + „schon übernommen“) bzw. eine Vorlage mit Vorschau — reine Daten, nichts Persönliches.
  if (q.get('vorlagen') === '1') {
    const [{ KUNDENGEWINNUNG_VORLAGEN, vorlageKurz }, { uebernommene }] = await Promise.all([import('@/lib/prozesse/kundengewinnung/bibliothek'), import('@/lib/prozesse/kundengewinnung/uebernehmen')]);
    // Eigene Vorlagen des Haushalts (22.10.) — nur Kurzform (Name, Bereich, Zahl der Schritte).
    const [{ eigeneVorlagenLesen }, { eigeneVorlageKurz }] = await Promise.all([import('@/lib/prozesse/eigene-vorlagen-server'), import('@/lib/prozesse/kopie')]);
    const eigene = (await eigeneVorlagenLesen(z.haushalt)).vorlagen.map(eigeneVorlageKurz);
    return NextResponse.json({ ok: true, rechte: z.rechte, vorlagen: KUNDENGEWINNUNG_VORLAGEN.map(vorlageKurz), eigene, uebernommen: uebernommene(d) });
  }
  const vid = q.get('vorlage');
  if (vid?.startsWith('ev-')) {
    const [{ eigeneVorlagenLesen }, { eigeneVorlageKurz }, { vorlageVorschau }] = await Promise.all([import('@/lib/prozesse/eigene-vorlagen-server'), import('@/lib/prozesse/kopie'), import('@/lib/prozesse/kundengewinnung/bibliothek')]);
    const v = (await eigeneVorlagenLesen(z.haushalt)).vorlagen.find(x => x.id === vid);
    if (!v) return nein(404, 'Diese Vorlage gibt es nicht (mehr).');
    return NextResponse.json({ ok: true, vorlage: { ...eigeneVorlageKurz(v), eigen: true, vorschau: vorlageVorschau(v.definition) } });
  }
  if (vid) {
    const { vorlageVon, vorlageKurz, vorlageVorschau } = await import('@/lib/prozesse/kundengewinnung/bibliothek');
    const v = vorlageVon(vid);
    if (!v) return nein(404, 'Diese Vorlage gibt es nicht.');
    return NextResponse.json({
      ok: true, vorlage: { ...vorlageKurz(v), recht: v.recht, kennzahlen: v.kennzahlen, einstellbar: v.einstellbar, demo: v.demo, vorschau: vorlageVorschau(v.definition),
        teileVorschau: v.teile.map(t => ({ titel: t.titel, vorschau: vorlageVorschau(t.definition) })) },
    });
  }
  if (!id) {
    const { fulfillmentLesen } = await import('@/lib/fulfillment/speicher');
    const ff = await fulfillmentLesen('vorlagen', z.haushalt).catch(() => null);
    return NextResponse.json({
      ok: true, rechte: z.rechte, grenzen: PROZESS_GRENZEN,
      prozesse: [...d.prozesse.map(e => kurzAusEintrag(e, !z.rechte.entwurf)), ...(ff ? fulfillmentProzesse(ff.prozesse).map(kurzAusFulfillment) : [])],
    });
  }
  if (!PROZESS_KENNUNG.test(id)) return nein(400, 'Welcher Prozess? (?id=pz-…)');
  const e = d.prozesse.find(x => x.id === id);
  if (!e) return nein(404, 'Diesen Prozess gibt es nicht (mehr).');
  const nr = q.get('version');
  if (nr) {
    const v = e.versionen.find(x => String(x.nr) === nr);
    return v ? NextResponse.json({ ok: true, version: v }) : nein(404, 'Diese Version gibt es nicht.');
  }
  const vg = q.get('vergleich');
  if (vg) {
    const seite = (s: string): ProzessDefinition | null => (s === 'entwurf' ? e.entwurf : e.versionen.find(x => String(x.nr) === s)?.definition ?? null);
    const [a, b] = vg.split(',').map(s => seite(s.trim()));
    return a && b ? NextResponse.json({ ok: true, vergleich: versionenVergleichen(a, b) }) : nein(400, 'Vergleich: zwei Versionen (Nummer oder „entwurf“).');
  }
  // Datums-Start (22.10.): Vorschau der nächsten Starts eines Datums-Auslösers im (gespeicherten) Entwurf — nur Tage und Anzahlen, nie Namen; liest nur.
  const datumKnoten = q.get('datum');
  if (datumKnoten) {
    if (!/^[a-z0-9-]{1,80}$/.test(datumKnoten)) return nein(400, 'Welcher Auslöser? (?datum=<Knoten>)');
    const { datumVorschau } = await import('@/lib/prozesse/lauf-server');
    const v = await datumVorschau(e.id, datumKnoten, z.haushalt).catch(() => null);
    return v ? NextResponse.json({ ok: true, datumVorschau: v }) : nein(404, 'Dieser Knoten ist (noch) kein gespeicherter Datums-Auslöser.');
  }
  const kx = await pruefKontextFuer(z.haushalt, z.person, d);
  const w = (await webhooksLesen(z.haushalt)).webhooks.find(x => x.prozessId === e.id);
  // Prozesse × Fulfillment (22.10.): die Produkte, die auf diesen Prozess zeigen (`Leistung.prozessId`) — nur Kennung und Name, für „gehört zu Produkt …“.
  const produkte = await (async () => {
    try { const [{ ladeCrm }, { produkteVonProzess }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/prozesse/produkt-bindung')]); return produkteVonProzess((await ladeCrm()).leistungen, e.id); } catch { return []; }
  })();
  return NextResponse.json({
    ok: true, rechte: z.rechte, ...ansicht(e), befunde: definitionPruefen(e.entwurf, kx), kanten: kantenVon(e.entwurf),
    webhook: w ? webhookKurz(w) : null, produkte,
  });
}

export async function POST(req: Request) {
  const z = await werkstattZugang(req, { schreiben: true });
  if (z instanceof Response) return z;
  let b: Record<string, unknown>;
  try { b = await jsonBegrenzt(req, KOERPER_MAX); } catch (e) { return jsonZuGross(e) ?? nein(400, 'Kein JSON.'); }
  const aktion = typeof b.aktion === 'string' ? b.aktion : '';
  if (aktion.startsWith('webhook-')) {
    const r = await webhookVerwalten(z.person, z.rechte, b, z.haushalt);
    if (!r.ok) return nein(r.status, r.fehler);
    // Der Schlüssel steht genau EINMAL in dieser Antwort — gespeichert ist nur sein Fingerabdruck.
    return NextResponse.json({ ok: true, webhook: r.eintrag ? webhookKurz(r.eintrag) : null, ...(r.geheim ? { geheim: r.geheim } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const wer = werAus(req);
  const ausfuehren = async (): Promise<{ status: number; body: Record<string, unknown> }> => {
    const kx = await pruefKontextFuer(z.haushalt, z.person);
    const r = await prozesseAendern<Extract<WerkstattErgebnis, { ok: true }>>(
      dd => werkstattAnwenden(dd, b, { person: z.person, jetzt: new Date().toISOString(), rechte: z.rechte, standVon, neueKennung: p => neueKennung(p), pruef: kx }) as never,
      wer, z.haushalt,
    ) as WerkstattErgebnis;
    if (!r.ok) {
      const aktuell = r.konflikt ? (await prozesseLesen(z.haushalt)).prozesse.find(x => x.id === r.konflikt!.id) : undefined;
      return { status: r.status, body: { ok: false, fehler: r.fehler, ...(r.befunde ? { befunde: r.befunde } : {}), ...(r.konflikt ? { konflikt: r.konflikt } : {}), ...(aktuell ? ansicht(aktuell) : {}) } };
    }
    return { status: 200, body: { ok: true, geaendert: r.geaendert, ...ansicht(r.eintrag), befunde: r.befunde, ...(r.version ? { version: versionKurz(r.version) } : {}) } };
  };
  // „Aus Vorlage anlegen“ (22.10., Kundengewinnung): Teile + Hauptprozess mit neuen Kennungen, Eigner aus dem Team, Version 1 und Probelauf, wenn nichts
  // offen ist (lib/prozesse/kundengewinnung/uebernehmen.ts) — EINE Sperre, alles oder nichts, einmalig über `anfrageId`.
  const ausVorlage = async (): Promise<{ status: number; body: Record<string, unknown> }> => {
    const kx = await pruefKontextFuer(z.haushalt, z.person);
    const eigner = typeof b.eigner === 'string' && b.eigner ? b.eigner : undefined;
    if (eigner && kx.team && !kx.team.some(t => t.id === eigner && t.aktiv)) return { status: 400, body: { ok: false, fehler: 'Eigner: eine aktive Person aus dem Team.' } };
    const { ausVorlageAnwenden } = await import('@/lib/prozesse/kundengewinnung/uebernehmen');
    type Ok = Extract<ReturnType<typeof ausVorlageAnwenden>, { ok: true }>;
    const r = await prozesseAendern<Omit<Ok, 'ok' | 'datei'>>(
      dd => ausVorlageAnwenden(dd, b.vorlageId, { person: z.person, jetzt: new Date().toISOString(), rechte: z.rechte, neueKennung: p => neueKennung(p), ...(eigner ? { eigner } : {}), pruef: kx }) as never,
      wer, z.haushalt,
    ) as ReturnType<typeof ausVorlageAnwenden>;
    if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler, ...(r.befunde ? { befunde: r.befunde } : {}) } };
    return { status: 200, body: { ok: true, ...ansicht(r.haupt), teile: r.teile.map(t => ({ id: t.id, titel: t.entwurf.titel, status: t.status })), befunde: r.befunde, hinweise: r.hinweise, probelauf: r.probelauf } };
  };
  // Kopieren, als eigene Vorlage speichern, eigene Vorlage übernehmen bzw. löschen (22.10., lib/prozesse/kopie.ts) — eigene Stelle, derselbe Rahmen.
  if (aktion === 'kopieren' || aktion === 'als-vorlage' || aktion === 'vorlage-loeschen' || (aktion === 'aus-vorlage' && typeof b.vorlageId === 'string' && b.vorlageId.startsWith('ev-'))) {
    const { kopieAktion } = await import('@/lib/prozesse/kopie-server');
    const ausfuehrenKopie = () => kopieAktion(aktion, b, { person: z.person, rechte: z.rechte, haushalt: z.haushalt, wer });
    const k = aktion === 'vorlage-loeschen' ? await ausfuehrenKopie() : await einmalig<Record<string, unknown>>(`prozess-${aktion}`, b.anfrageId, ausfuehrenKopie, undefined, { wer: z.person });
    return NextResponse.json(k.body, { status: k.status });
  }
  const a = aktion === 'anlegen'
    ? await einmalig<Record<string, unknown>>('prozess-anlegen', b.anfrageId, ausfuehren, undefined, { wer: z.person })
    : aktion === 'aus-vorlage'
      ? await einmalig<Record<string, unknown>>('prozess-aus-vorlage', b.anfrageId, ausVorlage, undefined, { wer: z.person })
      : await ausfuehren();
  return NextResponse.json(a.body, { status: a.status });
}
