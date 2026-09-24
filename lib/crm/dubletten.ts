// ─── CRM — Dubletten finden und zusammenführen (rein, getestet) ─────────────
// Die Masterdatei enthält Menschen doppelt (zwei Mailadressen, HubSpot und
// Apple). Erkannt wird über gleichen Namen UND ein zweites Merkmal (Firma,
// Domain, LinkedIn, Telefon) — Namensgleichheit allein ist kein Beweis.
// Zusammenführen ist eine bewusste Handlung: der behaltene Eintrag bekommt
// alles, was ihm fehlt, den ganzen Verlauf beider, alle Einwilligungen; eine
// Werbesperre des anderen gilt weiter (Sperre gewinnt immer).

import { anzeigename, STUFEN, type Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';

const n = (t?: string) => (t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
const domain = (k: Kontakt) => n((k.email ?? '').split('@')[1] ?? k.firmaDomain ?? '');
const tel = (t?: string) => (t ?? '').replace(/[^0-9]/g, '').replace(/^49/, '0').replace(/^00/, '0');

export function dubletten(kontakte: Kontakt[]): [Kontakt, Kontakt][] {
  const je = new Map<string, Kontakt[]>();
  for (const k of kontakte) { const key = n(`${k.vorname}${k.nachname}`); if (key.length >= 5) je.set(key, [...(je.get(key) ?? []), k]); }
  const paare: [Kontakt, Kontakt][] = [];
  for (const l of Array.from(je.values())) {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j];
      const zweites = (n(a.firma) && n(a.firma) === n(b.firma)) || (domain(a) && domain(a) === domain(b)) || (n(a.linkedin) && n(a.linkedin) === n(b.linkedin)) || (tel(a.telefon) && tel(a.telefon) === tel(b.telefon));
      if (zweites) paare.push([a, b]);
    }
  }
  return paare;
}

/** b in a zusammenführen. Liefert den neuen Eintrag für a; b wird danach gelöscht. */
export function zusammenfuehren(a: Kontakt, b: Kontakt, von: string, jetzt: string): Kontakt {
  const out: Kontakt = { ...a };
  for (const f of Object.keys(b) as (keyof Kontakt)[]) {
    if (['id', 'aktivitaeten', 'einwilligungen', 'werbesperre', 'stufe', 'importiertAm', 'geaendertAm'].includes(f)) continue;
    const v = b[f];
    if (v !== undefined && v !== '' && (out[f] === undefined || out[f] === '')) (out as unknown as Record<string, unknown>)[f] = v;
  }
  // Zweite Mailadresse nicht verlieren.
  if (b.email && a.email && b.email !== a.email) out.notiz = [a.notiz, `Weitere Mail: ${b.email}`].filter(Boolean).join(' · ').slice(0, 2000);
  out.aktivitaeten = [...(a.aktivitaeten ?? []), ...(b.aktivitaeten ?? []), { am: jetzt, art: 'system' as const, text: `Zusammengeführt mit ${anzeigename(b)} (${b.email ?? b.id})`, von }].sort((x, y) => x.am.localeCompare(y.am));
  out.einwilligungen = [...(a.einwilligungen ?? []), ...(b.einwilligungen ?? [])];
  if (!out.einwilligungen.length) delete out.einwilligungen;
  if (b.werbesperre && !a.werbesperre) out.werbesperre = b.werbesperre;
  // Die weiter fortgeschrittene Stufe gewinnt; letzter Kontakt der jüngere.
  if (STUFEN.indexOf(b.stufe) > STUFEN.indexOf(a.stufe) && !['verloren', 'ruht'].includes(b.stufe)) out.stufe = b.stufe;
  if ((b.letzterKontakt ?? '') > (a.letzterKontakt ?? '')) out.letzterKontakt = b.letzterKontakt;
  out.geaendertAm = jetzt.slice(0, 10);
  return out;
}

/** Verweise im CRM von b auf a umbiegen (Chancen, Mandate, Gäste). */
export function verweiseUmbiegen(crm: CrmBestand, altId: string, neuId: string): CrmBestand {
  const um = (ids: string[]) => Array.from(new Set(ids.map(x => (x === altId ? neuId : x))));
  return {
    ...crm,
    chancen: crm.chancen.map(c => (c.kontaktIds.includes(altId) ? { ...c, kontaktIds: um(c.kontaktIds) } : c)),
    mandate: crm.mandate.map(m => (m.kontaktIds.includes(altId) ? { ...m, kontaktIds: um(m.kontaktIds) } : m)),
    teilnahmen: crm.teilnahmen.map(t => (t.kontaktId === altId ? { ...t, kontaktId: neuId } : t)),
  };
}
