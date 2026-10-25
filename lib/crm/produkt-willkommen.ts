// ─── Willkommensmail je Produkt bzw. Paket (rein, client-sicher, 25.10., kleine Bauten) ──────────────────────────────────────────
// Kevin 25.10.: jedes Produkt bringt seine eigene Willkommensmail mit (Fulfillment-Onboarding). EINE Regel, welche Vorlage beim Vorbereiten gilt:
//   1. die des Produkts am Mandat (`Leistung.willkommen`, Text gesetzt) — Platzhalter der Werkstatt hier gefüllt (`willkommenWerte`),
//   2. sonst eine Willkommens-Vorlage (Baustein Mail mit Schlagwort „willkommen“), die im PAKET dieses Falls steckt (Ebene 5, `bausteinId`),
//   3. sonst die der Instanz wie bisher (`willkommenVorlage` — Bibliothek, nach Du/Sie).
// Die Platzhalter des Onboardings ({{kickoff_vorschlaege}}, {{playbook_link}}, {{gruss}} …) bleiben stehen — die füllt `willkommenMail` beim Senden.
// Ohne Produkt-Text und ohne Paket-Vorlage: genau dieselbe Vorlage wie bisher (bit-gleich).

import type { Leistung, Mandat } from './typen';
import type { Baustein } from '@/lib/fulfillment/typen';
import type { ProzessVorlage } from '@/lib/prozesse/definition';
import { TAG_WILLKOMMEN, willkommenVorlage } from '@/lib/fulfillment/prozesse/onboarding';
import { platzhalterFuellen, willkommenWerte } from './vorlage-platzhalter';

export interface WillkommenQuelle { id: string; titel: string; text: string; quelle: 'produkt' | 'paket' | 'instanz' }

export function willkommenQuelle(p: {
  bausteine: readonly Baustein[]; prozesse: readonly Pick<ProzessVorlage, 'id' | 'knoten'>[]; vorlageId?: string;
  produkt?: Pick<Leistung, 'id' | 'name' | 'willkommen'> | null; mandat: Pick<Mandat, 'titel'> & Partial<Pick<Mandat, 'start'>>;
  anrede: 'Du' | 'Sie'; kontakt?: { vorname?: string; nachname?: string } | null; firma?: string; heute: string;
}): WillkommenQuelle | null {
  const w = p.produkt?.willkommen;
  if (w?.text?.trim()) {
    const werte = willkommenWerte({ anrede: p.anrede, vorname: p.kontakt?.vorname, nachname: p.kontakt?.nachname, firma: p.firma, mandatTitel: p.mandat.titel, start: p.mandat.start, produkt: p.produkt?.name, heute: p.heute });
    const betreff = platzhalterFuellen(w.betreff?.trim() || 'Willkommen', werte).replace(/[\r\n]+/g, ' ').trim();
    return { id: `produkt:${p.produkt!.id}`, titel: `Willkommensmail · ${p.produkt!.name}`, text: `Betreff: ${betreff}\n\n${platzhalterFuellen(w.text.trim(), werte)}`, quelle: 'produkt' };
  }
  const paket = p.vorlageId ? p.prozesse.find(x => x.id === p.vorlageId) : undefined;
  const ids = new Set((paket?.knoten ?? []).map(k => k.bausteinId).filter((x): x is string => !!x));
  if (ids.size) {
    const imPaket = willkommenVorlage(p.bausteine.filter(b => ids.has(b.id) && b.art === 'mail' && b.tags.includes(TAG_WILLKOMMEN)), p.anrede);
    if (imPaket) return { id: imPaket.id, titel: imPaket.titel, text: imPaket.text ?? '', quelle: 'paket' };
  }
  const v = willkommenVorlage(p.bausteine, p.anrede);
  return v ? { id: v.id, titel: v.titel, text: v.text ?? '', quelle: 'instanz' } : null;
}
