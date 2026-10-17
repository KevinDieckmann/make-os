// ─── Fulfillment — Kontakt-Kennungen umbiegen (Dubletten zusammenführen, 18.10., Gesamtprüfung L3 A2) ──────────────────────────────
// Werden zwei Kontakte zusammengeführt, zeigen Stakeholder (`fulfillment-faelle--<h>`) und Personenkarten (`fulfillment-personen--<h>`)
// danach auf die behaltene Kennung — wie `kalender-bezug`. Sonst stünde im Fall eine Kennung ohne Person, und Art. 15/17 für die behaltene
// Person fänden Rolle, Haltung und Notiz nicht. Rein; geschrieben wird über `fulfillmentAendern` (lib/crm/person-bestaende.ts).
//
// Steht die behaltene Person im selben Fall schon auf der Karte, bleibt EIN Eintrag (der der behaltenen Person, ihre Angaben gewinnen,
// leere Felder füllt der alte) — zwei Einträge mit derselben Kennung sperrten jede weitere Änderung des Falls (409, fall.ts).

import type { FaelleDatei, PersonenDatei, Stakeholder } from './typen';

export function faelleUmbiegen(d: FaelleDatei, paare: ReadonlyMap<string, string>): { datei: FaelleDatei; n: number } {
  let n = 0;
  const faelle: FaelleDatei['faelle'] = {};
  for (const [mandatId, fall] of Object.entries(d.faelle)) {
    if (!fall.stakeholder.some(s => paare.has(s.kontaktId))) { faelle[mandatId] = fall; continue; }
    let liste: Stakeholder[] = fall.stakeholder;
    for (const [alt, neu] of paare) {
      const weg = liste.find(s => s.kontaktId === alt);
      if (!weg) continue;
      n++;
      const bleibt = liste.find(s => s.kontaktId === neu);
      liste = bleibt
        ? liste.filter(s => s.id !== weg.id).map(s => (s.id === bleibt.id ? { ...weg, ...bleibt, id: bleibt.id, kontaktId: neu } : s))
        : liste.map(s => (s.id === weg.id ? { ...s, kontaktId: neu } : s));
    }
    faelle[mandatId] = { ...fall, stakeholder: liste };
  }
  return { datei: n ? { ...d, faelle } : d, n };
}

export function personenUmbiegen(d: PersonenDatei, paare: ReadonlyMap<string, string>): { datei: PersonenDatei; n: number } {
  let n = 0;
  const karten = d.karten.map(k => {
    const neu = k.kontaktId ? paare.get(k.kontaktId) : undefined;
    if (!neu) return k;
    n++;
    return { ...k, kontaktId: neu };
  });
  return { datei: n ? { ...d, karten } : d, n };
}
