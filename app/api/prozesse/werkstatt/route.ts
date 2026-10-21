// ─── Prozesse — die Werkstatt: Prozesse aller Business-Bereiche als Entwurf bauen, veröffentlichen, aktiv schalten (Etappe B1, 21.10.) ─────────────────
// GET              Liste aller Prozesse (Werkstatt + Paket-Vorlagen des Fulfillments, die nur lesend) mit den Rechten der Person.
// GET ?id=         ein Prozess: Entwurf mit Stand, Versionen (kurz), Befunde (alle — die Werkstatt zeigt sie am Knoten), Kanten des Flusses, Webhook (ohne
//                  Schlüssel). `&version=<nr>` eine Version ganz; `&vergleich=<a>,<b>` (Nummer oder „entwurf“) der Vergleich (nur Feldnamen, nie Werte).
// POST { aktion }  anlegen (anfrageId) · steckbrief · entwurf · veroeffentlichen · version-uebernehmen · status (lib/prozesse/bestand.ts `werkstattAnwenden`)
//                  · webhook-schluessel · webhook-scharf · webhook-entfernen (lib/prozesse/webhook-server.ts). Stand je Prozess → 409 mit der aktuellen Fassung.
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
  const kx = await pruefKontextFuer(z.haushalt, z.person, d);
  const w = (await webhooksLesen(z.haushalt)).webhooks.find(x => x.prozessId === e.id);
  return NextResponse.json({
    ok: true, rechte: z.rechte, ...ansicht(e), befunde: definitionPruefen(e.entwurf, kx), kanten: kantenVon(e.entwurf),
    webhook: w ? webhookKurz(w) : null,
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
  const a = aktion === 'anlegen'
    ? await einmalig<Record<string, unknown>>('prozess-anlegen', b.anfrageId, ausfuehren, undefined, { wer: z.person })
    : await ausfuehren();
  return NextResponse.json(a.body, { status: a.status });
}
