// ─── Lead heben nach einem echten Gespräch (Server, 27.09.) ─────────────────
// Ein Gespräch oder Termin mit einer Person hebt den Lead ihrer Firma (ohne
// Firma: der Person) mindestens auf „Im Gespräch“ — die Regel steht in
// lib/crm/event-bruecke.ts (leadNachGespraech). Hier der eine Schreibweg dafür,
// den Events-Nachfassen UND das Erledigen eines Follow-ups nutzen — vorher lag
// er nur in der Events-Route, und ein erledigtes Event-Follow-up ließ den Lead
// stehen (Prüfbericht 27.09., Punkt 7).

import { loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeCrm, aendereCrm } from './speicher';
import { leadSaeubern } from './lead-form';
import { OFFENE_STUFEN } from './pipeline';
import { leadNachGespraech, leadZiel } from './event-bruecke';
import { dealZuFirma } from './firmen-bezug';

import { tagVon } from '@/lib/zeit';
import { personenDerFirma } from './stationen';
export interface LeadMeldung { ziel: { art: 'firma' | 'person'; id: string; name: string }; von: string; nach: string; geaendert: boolean; grund?: string }

/** Lead der Firma (sonst der Person) nach einem Gespräch heben und schreiben. null, wenn die Person unbekannt ist. */
export async function leadHebenNachGespraech(kontaktId: string, jetzt: string, person: string, heute = tagVon(jetzt)): Promise<LeadMeldung | null> {
  const kontakte = (await loadJson<{ kontakte: Kontakt[] }>('kontakte'))?.kontakte ?? [];
  const k = kontakte.find(x => x.id === kontaktId);
  if (!k) return null;
  const crm = await ladeCrm();
  const ziel = leadZiel(k);
  const firma = ziel.art === 'firma' ? crm.firmen.find(f => f.id === ziel.id) : undefined;
  // Wie in lib/crm/leads.ts: Gesperrte zählen für den abgeleiteten Stand nicht mit.
  const personen = ziel.art === 'firma' ? personenDerFirma(kontakte, ziel.id).filter(x => !x.werbesperre) : [k];
  const ids = new Set(personen.map(p => p.id));
  const offen = crm.chancen.some(c => OFFENE_STUFEN.includes(c.stufe) && (c.kontaktIds.some(id => ids.has(id)) || (!!firma && dealZuFirma(c, firma))));
  const r = leadNachGespraech(firma ? firma.lead : k.lead, personen, offen, jetzt, person);
  if (r.geaendert && r.lead) {
    const neu = leadSaeubern(r.lead);
    if (neu) {
      if (ziel.art === 'firma') await aendereCrm(c => ({ ...c, firmen: c.firmen.map(f => (f.id === ziel.id ? { ...f, lead: neu, geaendert: jetzt, geaendertVon: person } : f)) }));
      else await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => ({ ...(cur ?? { kontakte: [] }), kontakte: (cur?.kontakte ?? []).map(x => (x.id === ziel.id ? { ...x, lead: neu, geaendertAm: heute } : x)) }));
    }
  }
  return { ziel: { ...ziel, name: firma?.name ?? k.firma ?? `${k.vorname} ${k.nachname}`.trim() }, von: r.von, nach: r.nach, geaendert: r.geaendert, ...(r.grund ? { grund: r.grund } : {}) };
}
