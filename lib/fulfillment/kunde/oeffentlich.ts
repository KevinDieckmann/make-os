// ─── Fulfillment · Kunde — der öffentliche Weg: Link + Token prüfen, drosseln, dieselbe 404 (nur Server; C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4/9) ──────
// Die vier offenen Routen (`/api/kunde/kl-…{,/formular,/upload,/puls}`, Middleware `KUNDE_OFFEN`) rufen ZUERST `kundeZugriff` — vor jedem Lesen des
// Körpers. Die Wege handeln für niemanden (die Middleware löscht die Personen-Köpfe), suchen den Link nur im Bestand des Inhaber-Haushalts.
// Reihenfolge: Drossel je Netz (`kunde:<netz>` zählt jeden Fehlgriff) → Kennung → beide Schalter → Link aktiv (Ablauf, Mandatsende + 30 Tage) →
// Mandat einer Business-Gesellschaft → Token (`x-kunde-token` = alles, `x-kunde-puls` = NUR der Puls) → Recht des Wegs. Jede Fehlerart ergibt
// DIESELBE Antwort: 404 „Dieser Link ist nicht (mehr) gültig.“ — nie verrät eine Antwort, was gefehlt hat.

import { NextResponse } from 'next/server';
import { pruefe, fehlschlag, adresseNetz } from '@/lib/zugang/drossel';
import { localDay } from '@/lib/zeit';
import { KENNUNG } from '../grenzen';
import { mandatsEnde } from '../regeln';
import { fulfillmentHaushalt, fulfillmentLesen } from '../speicher';
import { linkStatus, schalterStand, NICHT_GUELTIG } from './link';
import { tokenPasst } from './token';
import { umgebungAn, fulfillmentMandat, type Zugriff } from './server';

/** Köpfe jeder Antwort der öffentlichen Wege (dazu die strengen Köpfe aus next.config.mjs und Caddy). */
export const KOPF_OEFFENTLICH = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' } as const;
export const antwortOeffentlich = (body: Record<string, unknown>, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...KOPF_OEFFENTLICH, ...extra } });
/** So viele Aufrufe (GET) je Netz und Viertelstunde frei, danach wächst die Wartezeit (wie die Buchung). */
export const LESEN_FREI = 60;

function gedrosselt(schluessel: string) {
  const p = pruefe(schluessel);
  return p.erlaubt ? null : antwortOeffentlich({ ok: false, fehler: `Zu viele Versuche — bitte in ${Math.ceil(p.warteSek / 60)} Min. noch einmal.` }, 429, { 'Retry-After': String(p.warteSek) });
}

export type Weg = 'lesen' | 'formular' | 'upload' | 'puls';

/** Link und Token prüfen. Ergebnis: der Zugriff — oder eine fertige Antwort (429 bzw. die eine 404). */
export async function kundeZugriff(req: Request, linkRoh: string | undefined, weg: Weg): Promise<Zugriff | NextResponse> {
  const netz = adresseNetz(req);
  const fehlgriff = `kunde:${netz}`;
  const zu = gedrosselt(fehlgriff) ?? (weg === 'lesen' ? gedrosselt(`kunde-lesen:${netz}`) : null);
  if (zu) return zu;
  if (weg === 'lesen') fehlschlag(`kunde-lesen:${netz}`, Date.now(), LESEN_FREI);
  const nicht = () => { fehlschlag(fehlgriff); return antwortOeffentlich({ ok: false, fehler: NICHT_GUELTIG }, 404); };
  if (typeof linkRoh !== 'string' || !KENNUNG.kundenLink.test(linkRoh)) return nicht();
  if (!umgebungAn()) return nicht();
  const h = await fulfillmentHaushalt();
  const vorlagen = await fulfillmentLesen('vorlagen', h);
  if (!schalterStand(vorlagen.einstellungen, true).an) return nicht();
  const kunde = await fulfillmentLesen('kunde', h);
  const link = kunde.links.find(l => l.id === linkRoh);
  if (!link) return nicht();
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const crm = await ladeCrm();
  const mandat = fulfillmentMandat(crm, link.mandatId);
  const heute = localDay();
  if (!mandat || linkStatus(link, heute, mandatsEnde(mandat)) !== 'aktiv') return nicht();
  const tVoll = req.headers.get('x-kunde-token');
  if (tVoll && tokenPasst(tVoll, link.tokenHash, 'link')) {
    const recht = weg === 'lesen' || link.rechte[weg];
    return recht ? { art: 'voll', link, mandat, kunde, vorlagen, crm, heute } : nicht();
  }
  const tPuls = req.headers.get('x-kunde-puls');
  if (tPuls && link.rechte.puls && (weg === 'lesen' || weg === 'puls')) {
    const anfrage = kunde.pulsAnfragen.find(a => a.mandatId === mandat.id && tokenPasst(tPuls, a.tokenHash, 'puls'));
    // Beantwortet: die Seite darf noch „Danke“ zeigen; abgelaufen ohne Antwort: wie unbekannt.
    if (anfrage && (anfrage.beantwortetAm || anfrage.offenBis >= heute)) return { art: 'puls', link, mandat, kunde, vorlagen, crm, heute, anfrage };
  }
  return nicht();
}
