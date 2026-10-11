// ─── Fulfillment · Analyse — der Personenteil lesen und ändern (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.5, Abschnitt 9) — nur Server ───────────────
// Was die Route `/api/fulfillment/personen` tut (Tor `personenteilZugang`: Inhaber oder Mitglied OHNE „nur Business“, sonst 403; Lese-Protokoll
// „personenrecherche“ in der Route): Karten eines Mandats mit Art.-14-Uhr und fertigem Hinweistext (Verantwortlicher aus der Einrichtung, Herkunft aus
// den Quellen-Domains), Mängeln vor „geprüft“ und — bei verknüpftem CRM-Kontakt — dessen Art.-14-Stand (der Hinweis läuft dann über den CRM-Weg).
// Schritte: pruefen · art14 (gegeben am · wie) · verknuepfen (Kontakt) · angabe-entfernen · loeschen. Nichts geht hinaus: der Hinweis wird von Hand gegeben.

import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { PersonenKarte } from '../typen';
import { fulfillmentAendern, fulfillmentLesen, eintragStand } from '../speicher';
import { MANDAT_ID } from '../grenzen';
import { mandatsEnde } from '../regeln';
import { localDay } from '@/lib/zeit';
import { personenAnwenden, karteMaengel, type PersonenOp } from './personen-anwenden';
import { art14Stand, art14Text, herkunftVon, loeschAmFuer, RECHT_HINWEIS } from './dsgvo';
import { mandatFuer, personenTage } from './lauf';

export type Antwort = { status: number; body: Record<string, unknown> };
const nein = (status: number, fehler: string): Antwort => ({ status, body: { ok: false, fehler } });

/**
 * Karten mit dem Art.-14-Stand eines verknüpften CRM-Kontakts: ist die Person dort informiert (`art14InformiertAm`, CRM-Weg art14-entwurf/art14-raus),
 * gilt der Hinweis hier als gegeben — nur gelesen, nie gespeichert (eine Wahrheit: die Kontaktakte).
 */
export async function mitKontaktArt14(karten: PersonenKarte[]): Promise<PersonenKarte[]> {
  if (!karten.some(k => k.kontaktId && !k.art14.gegebenAm)) return karten;
  const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
  const kontakte = new Map((await kontakteFuerVerarbeitung({ mitEingeschraenkten: true })).map(k => [k.id, k]));
  return karten.map(k => {
    const am = k.kontaktId && !k.art14.gegebenAm ? kontakte.get(k.kontaktId)?.art14InformiertAm : undefined;
    return am ? { ...k, art14: { ...k.art14, gegebenAm: am.slice(0, 10), wie: 'mail' as const } } : k;
  });
}

async function kartenAntwort(mandatId: string): Promise<{ karten: Record<string, unknown>[]; ids: string[] }> {
  const heute = localDay();
  const [{ verantwortlicherLaden }, { kontakteFuerVerarbeitung }, { art14Frist }, tage] = await Promise.all([
    import('@/lib/datenschutz/einrichtung-server'), import('@/lib/crm/verarbeitung'), import('@/lib/datenschutz/art14'), personenTage(),
  ]);
  const v = await verantwortlicherLaden();
  const verantwortlicher = v.v ? [v.v.name, v.v.anschrift.replace(/\n+/g, ', '), v.v.mail].filter(Boolean).join(' · ') : null;
  const roh = (await fulfillmentLesen('personen')).karten.filter(k => k.mandatId === mandatId);
  // Stand aus der GESPEICHERTEN Karte (sonst 409 beim nächsten Schritt); angezeigt wird der Art.-14-Stand samt verknüpftem Kontakt.
  const staende = new Map(roh.map(k => [k.id, eintragStand(k)]));
  const karten = await mitKontaktArt14(roh);
  const kontakte = karten.some(k => k.kontaktId) ? await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }) : [];
  return {
    ids: karten.map(k => k.id),
    karten: karten.map(k => {
      const kontakt = k.kontaktId ? kontakte.find(x => x.id === k.kontaktId) : undefined;
      return {
        ...k, stand: staende.get(k.id)!, art14Stand: art14Stand(k, heute), maengel: karteMaengel(k),
        art14Text: art14Text({ verantwortlicher, herkunft: herkunftVon(k), funktion: k.funktion, frist: `${tage} Tage nach Ende des Mandats` }),
        ...(k.kontaktId ? { kontakt: kontakt ? { vorhanden: true, art14: art14Frist(kontakt, heute) } : { vorhanden: false } } : {}),
      };
    }),
  };
}

/** GET: Karten eines Mandats (nur für Personen mit Zugang zum Personenteil — das Tor sitzt in der Route). */
export async function personenLage(mandatId: string): Promise<Antwort & { ids?: string[] }> {
  if (!MANDAT_ID.test(mandatId)) return nein(400, 'Mandat fehlt (?m=).');
  const mandat = await mandatFuer(mandatId);
  if (!mandat.ok) return nein(mandat.status, mandat.fehler);
  const d = (await fulfillmentLesen('dossiers')).dossiers[mandatId];
  const r = await kartenAntwort(mandatId);
  return { status: 200, ids: r.ids, body: { ok: true, karten: r.karten, f1: d?.f1 ?? null, lia: !!d?.interessenabwaegung, rechtHinweis: RECHT_HINWEIS, loeschRegelTage: await personenTage() } };
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** POST: ein Schritt an einer Karte (immer mit Stand der Karte → 409). */
export async function personenAktion(b: Record<string, unknown>, person: string, wer: Wer): Promise<Antwort> {
  const mandatId = text(b.mandatId);
  if (!MANDAT_ID.test(mandatId)) return nein(400, 'Mandat fehlt.');
  const mandat = await mandatFuer(mandatId);
  if (!mandat.ok) return nein(mandat.status, mandat.fehler);
  const id = text(b.id), stand = text(b.stand);
  const karte = (await fulfillmentLesen('personen')).karten.find(k => k.id === id);
  if (!karte || karte.mandatId !== mandatId) return nein(404, 'Diese Personenkarte gibt es nicht (mehr).');
  let op: PersonenOp;
  switch (text(b.aktion)) {
    case 'pruefen': {
      const m = mandat.mandat;
      const ende = mandatsEnde(m) ?? (m.ende ? m.ende.slice(0, 10) : null);
      op = { op: 'pruefen', id, stand, loeschAm: loeschAmFuer(ende, await personenTage()) };
      break;
    }
    case 'art14': op = { op: 'art14', id, stand, gegebenAm: text(b.gegebenAm), wie: (['kickoff', 'mail', 'erster-kontakt'].includes(text(b.wie)) ? text(b.wie) : 'mail') as 'kickoff' | 'mail' | 'erster-kontakt' }; break;
    case 'verknuepfen': {
      const kontaktId = b.kontaktId === null ? null : text(b.kontaktId);
      if (kontaktId) {
        const { kontakteFuerVerarbeitung } = await import('@/lib/crm/verarbeitung');
        // Nur verarbeitbare Kontakte (Art. 18: eingeschränkte fehlen) — eine eingeschränkte Person wird nicht neu verknüpft.
        if (!(await kontakteFuerVerarbeitung()).some(k => k.id === kontaktId)) return nein(404, 'Diesen Kontakt gibt es nicht (oder er ist eingeschränkt).');
      }
      op = { op: 'verknuepfen', id, stand, kontaktId };
      break;
    }
    case 'angabe-entfernen': op = { op: 'angabe-entfernen', id, stand, angabeId: text(b.angabeId) }; break;
    case 'loeschen': op = { op: 'loeschen', id, stand }; break;
    default: return nein(400, 'Unbekannte Aktion.');
  }
  const heute = localDay();
  const r = await fulfillmentAendern('personen', p => personenAnwenden(p, op, { person, heute, standVon: (k: PersonenKarte) => eintragStand(k) }), wer);
  if (!r.ok) {
    if (r.status === 409 && r.konflikte) return { status: 409, body: { ok: false, fehler: r.fehler, konflikt: true, ...(await kartenAntwort(mandatId)) } };
    return nein(r.status, r.fehler);
  }
  return { status: 200, body: { ok: true, ...(await kartenAntwort(mandatId)) } };
}
