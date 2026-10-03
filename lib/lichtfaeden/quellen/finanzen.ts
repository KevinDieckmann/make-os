// ─── Lichtfäden-Quelle: Finanzen & Fristen — rein ───────────────────────────
// Eingang (vom Server normalisiert, nie Beträge im Titel):
//   · Finanzplan (Business): offene Zahlungen (`faellig`), Rechnungen — gestellt bis `faellig` (Eingang prüfen), geplant
//     am `datum` (stellen).
//   · Finanzplanung jetzt (Haushalt): offene Posten mit `faellig` (Rechnung, Forderung, Beleg, Aufgabe — kein Konto).
//   · Haushaltsfinanzen: offene Rechnungen/Belege mit `faellig_am`.
//   · Steuerfristen (lib/steuern, −30 … +365 Tage): offen und abgehakt (leise).
// Space aus der Einheit: „privat“ → Privat › Finanzen, jede Gesellschaft → Business › Finanzen. Eine Rechnung mit Mandat
// läuft in das Ziel mit demselben Mandat (ZielBezuege). Finanzen gehören dem Haushalt (BEIDE), außer ein Posten nennt `wer`.
// Nicht hier: Liquiditäts-Planposten (wiederkehrende Prognose, keine Handlung — sie würden jeden Monat gleich leuchten).

import type { SpaceId } from '@/lib/make-one/space-regeln';
import { WEG } from '@/lib/wege';
import { BEIDE, gewichtVon, statusVon, tagAus, themaPfad, type Strang } from '../modell';
import { KEINE_BEZUEGE, type ZielBezuege } from './planung';

export interface FinZahlung { id: string; titel: string; faellig?: string; status: string; firmaId?: string }
export interface FinRechnung { id: string; titel: string; faellig?: string; datum?: string; status: string; firmaId?: string; mandatId?: string }
export interface FinPosten { id: string; name: string; art: string; einheit: string; status: string; faellig?: string; wer?: string }
export interface FinBeleg { id: string; bezeichnung: string; faellig_am: string | null; einheit: string; erledigt: boolean }
export interface FinSteuerFrist { id: string; datum: string; einheit: string; titel: string; erledigt: boolean; href: string }
export interface FinanzDaten {
  zahlungen?: FinZahlung[]; rechnungen?: FinRechnung[]; posten?: FinPosten[]; belege?: FinBeleg[]; steuer?: FinSteuerFrist[];
  heute: string; bezuege?: ZielBezuege;
}

const spaceVon = (einheit: string | undefined): SpaceId => (einheit === 'privat' ? 'privat' : 'business');
const OFFEN_POSTEN = (s: string) => s !== 'erledigt' && s !== 'bezahlt';

export function finanzStraenge(d: FinanzDaten): Strang[] {
  const bez = d.bezuege ?? KEINE_BEZUEGE;
  const aus: Strang[] = [];
  const pfad = (einheit?: string) => themaPfad(spaceVon(einheit), 'finanzen');
  for (const z of d.zahlungen ?? []) {
    const tag = tagAus(z.faellig);
    if (!tag || z.status !== 'offen') continue;
    aus.push({ id: `zahlung:${z.id}`, quelle: 'zahlung', titel: z.titel, pfad: pfad(z.firmaId ?? 'kdc'), person: BEIDE, zeit: { tag }, gewicht: gewichtVon('zahlung'), status: statusVon(false, tag, d.heute), link: WEG.zahlung(z.id) });
  }
  for (const r of d.rechnungen ?? []) {
    const gestellt = r.status === 'gestellt';
    const tag = tagAus(gestellt ? r.faellig : r.status === 'geplant' ? r.datum : undefined);
    if (!tag) continue;
    aus.push({
      id: `rechnung:${r.id}`, quelle: 'rechnung', titel: gestellt ? `Zahlungseingang: ${r.titel}` : `Rechnung stellen: ${r.titel}`,
      pfad: (r.mandatId && bez.mandat.get(r.mandatId)) || pfad(r.firmaId ?? 'kdc'), person: BEIDE, zeit: { tag }, gewicht: gewichtVon('rechnung'), status: statusVon(false, tag, d.heute), link: WEG.rechnung(r.id),
    });
  }
  for (const p of d.posten ?? []) {
    const tag = tagAus(p.faellig);
    if (!tag || p.art === 'konto' || !OFFEN_POSTEN(p.status)) continue;
    aus.push({ id: `posten:${p.id}`, quelle: 'zahlung', titel: p.name, pfad: pfad(p.einheit === 'selbststaendigkeit' ? 'kdc' : p.einheit), person: p.wer || BEIDE, zeit: { tag }, gewicht: gewichtVon('zahlung'), status: statusVon(false, tag, d.heute), link: WEG.zahlen() });
  }
  for (const b of d.belege ?? []) {
    const tag = tagAus(b.faellig_am);
    if (!tag || b.erledigt) continue;
    aus.push({ id: `beleg:${b.id}`, quelle: 'zahlung', titel: b.bezeichnung, pfad: pfad(b.einheit), person: BEIDE, zeit: { tag }, gewicht: gewichtVon('zahlung'), status: statusVon(false, tag, d.heute), link: WEG.privat() });
  }
  for (const f of d.steuer ?? []) {
    const tag = tagAus(f.datum);
    if (!tag) continue;
    aus.push({ id: `frist:${f.id}`, quelle: 'frist', titel: f.titel, pfad: pfad(f.einheit), person: BEIDE, zeit: { tag }, gewicht: gewichtVon('frist', { erledigt: f.erledigt }), status: statusVon(f.erledigt, tag, d.heute), link: f.href });
  }
  return aus;
}
