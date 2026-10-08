// ─── Folgeänderungen im CRM-Bestand — in DERSELBEN Sperre (28.09. spät) ─────
// Zwei Prüfbefunde, an einer Stelle gelöst — rein, getestet; angewandt in `wendeCrmAn` und
// (für jeden Schreibweg) in `aendereCrm` (lib/crm/speicher.ts). Beide Regeln sind idempotent:
// ein zweiter Lauf über das Ergebnis ändert nichts mehr.
//
// 1 · Deal gelöscht (erlaubt nur als Fehlanlage, `dealRegeln`): der Lead, der per `chanceId` auf den Deal
//     zeigte, war sonst weiter „SQL“ mit `sqlAm` — die Firma zählte in „Neue SQL · 30 Tage“ und im
//     Trichter, obwohl es keinen Deal mehr gibt. Jetzt: Status `sql` → `qualifizierung`, `chanceId` und
//     `sqlAm` weg. Ein Lead in einem anderen Status (z. B. `kunde`) verliert nur den toten Verweis.
//     Firmen-Leads liegen im CRM-Bestand, Personen-Leads (Person ohne Firma) in der Kartei — die schreibt
//     `aendereCrm` in derselben Sperre mit (`updateJsonAsync` außen, `updateJson('kontakte')` innen).
// 2 · Firma umbenannt: `Mandat.kunde` und `Chance.firma` sind Anzeigenamen (die Verbindung läuft über
//     `firmaId`). Standen sie auf dem ALTEN Namen, ziehen sie mit; ein bewusst anderer Name bleibt.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Firma, Lead } from './typen';

/** Kennungen der Deals, die zwischen `vorher` und `nachher` verschwunden sind. */
export function geloeschteDeals(vorher: Pick<CrmBestand, 'chancen'>, nachher: Pick<CrmBestand, 'chancen'>): Set<string> {
  const bleibt = new Set((nachher.chancen ?? []).map(c => c.id));
  return new Set((vorher.chancen ?? []).map(c => c.id).filter(id => !bleibt.has(id)));
}

/**
 * Der Lead ohne den gelöschten Deal — oder `undefined`, wenn er nicht darauf zeigt (nichts zu schreiben).
 * `geaendert`/`geaendertVon` wie jede Lead-Änderung; ohne gültige Person bleibt `geaendertVon` weg.
 */
export function leadOhneDeal(lead: Lead | undefined, geloescht: ReadonlySet<string>, jetzt: string, person?: string): Lead | undefined {
  if (!lead?.chanceId || !geloescht.has(lead.chanceId)) return undefined;
  // Der Vermerk „direkt angelegt“ (08.10., 2.3) gehört zum gelöschten Deal — er fällt mit dem Verweis.
  const { chanceId: _c, sqlAm, geaendertVon: _v, direktAm: _d, direktOffen: _o, ...rest } = lead;
  const warSql = lead.status === 'sql';
  return {
    ...rest,
    ...(warSql ? { status: 'qualifizierung' as const } : {}),
    // Nur ein SQL verliert sein Datum — ein Lead in einem späteren Status (kunde) behält die Geschichte.
    ...(!warSql && sqlAm ? { sqlAm } : {}),
    geaendert: jetzt,
    ...(person && /^[a-z0-9-]{1,40}$/.test(person) ? { geaendertVon: person } : {}),
  };
}

/** Firmen-Leads, die auf einen gelöschten Deal zeigten, zurücksetzen. Gleiche Liste zurück, wenn nichts zu tun ist. */
export function firmenLeadsOhneDeals(firmen: Firma[], geloescht: ReadonlySet<string>, jetzt: string, person?: string): Firma[] {
  if (!geloescht.size) return firmen;
  let geaendert = false;
  const neu = firmen.map(f => {
    const lead = leadOhneDeal(f.lead, geloescht, jetzt, person);
    if (!lead) return f;
    geaendert = true;
    return { ...f, lead, geaendert: jetzt, ...(person ? { geaendertVon: person } : {}) };
  });
  return geaendert ? neu : firmen;
}

/** Personen-Leads (Kartei) zurücksetzen. `heute` = Tag für `geaendertAm`. Liefert die geänderten Kennungen mit. */
export function kontaktLeadsOhneDeals(kontakte: Kontakt[], geloescht: ReadonlySet<string>, jetzt: string, heute: string, person?: string): { kontakte: Kontakt[]; geaendert: string[] } {
  const ids: string[] = [];
  if (!geloescht.size) return { kontakte, geaendert: ids };
  const neu = kontakte.map(k => {
    const lead = leadOhneDeal(k.lead, geloescht, jetzt, person);
    if (!lead) return k;
    ids.push(k.id);
    return { ...k, lead, geaendertAm: heute };
  });
  return { kontakte: ids.length ? neu : kontakte, geaendert: ids };
}

/** Braucht die Kartei eine Nachführung? (Vorprüfung, damit die Kartei nur bei Bedarf gesperrt wird.) */
export const karteiBetroffen = (kontakte: Pick<Kontakt, 'lead'>[], geloescht: ReadonlySet<string>): boolean =>
  geloescht.size > 0 && kontakte.some(k => !!k.lead?.chanceId && geloescht.has(k.lead.chanceId));

/**
 * Umbenannte Firmen: Mandate und Deals mit dieser `firmaId`, deren Anzeigename noch der ALTE Name war, bekommen
 * den neuen. Liefert den Bestand (unverändert dieselben Listen, wenn nichts zu tun ist).
 */
export function firmenNamenNachziehen(vorher: Pick<CrmBestand, 'firmen'>, nachher: CrmBestand, jetzt: string, person?: string): CrmBestand {
  const alt = new Map((vorher.firmen ?? []).map(f => [f.id, f.name]));
  const umbenannt = new Map<string, { alt: string; neu: string }>();
  for (const f of nachher.firmen ?? []) {
    const a = alt.get(f.id);
    if (a !== undefined && a !== f.name) umbenannt.set(f.id, { alt: a, neu: f.name });
  }
  if (!umbenannt.size) return nachher;
  const von = person ? { geaendertVon: person } : {};
  let mandate = nachher.mandate, chancen = nachher.chancen;
  if ((nachher.mandate ?? []).some(m => m.firmaId && umbenannt.get(m.firmaId)?.alt === m.kunde)) {
    mandate = nachher.mandate.map(m => { const u = m.firmaId ? umbenannt.get(m.firmaId) : undefined; return u && u.alt === m.kunde ? { ...m, kunde: u.neu, geaendert: jetzt, ...von } : m; });
  }
  if ((nachher.chancen ?? []).some(c => c.firmaId && umbenannt.get(c.firmaId)?.alt === c.firma)) {
    chancen = nachher.chancen.map(c => { const u = c.firmaId ? umbenannt.get(c.firmaId) : undefined; return u && u.alt === c.firma ? { ...c, firma: u.neu, geaendert: jetzt, ...von } : c; });
  }
  return mandate === nachher.mandate && chancen === nachher.chancen ? nachher : { ...nachher, mandate, chancen };
}

/** Beide Regeln für den CRM-Bestand selbst (die Kartei führt `aendereCrm` nach). */
export function crmFolgen(vorher: CrmBestand, nachher: CrmBestand, jetzt: string, person?: string): CrmBestand {
  const weg = geloeschteDeals(vorher, nachher);
  const firmen = firmenLeadsOhneDeals(nachher.firmen ?? [], weg, jetzt, person);
  const mitLeads = firmen === nachher.firmen ? nachher : { ...nachher, firmen };
  return firmenNamenNachziehen(vorher, mitLeads, jetzt, person);
}
