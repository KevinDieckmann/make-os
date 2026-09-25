// ─── Wege — wohin ein Klick führt (rein, client-sicher) ─────────────────────
// Kevin (25.09.): „Hinter jeder Kachel müssen Verbindungen sein, die nicht
// enden.“ Jede Kennzahl, jeder Punkt dahinter und jede Steuerfrist verlinkt
// über diese eine Liste — so zeigt ein Link nie ins Leere, und wer eine
// Adresse ändert, ändert sie hier.
//
//   Zahlen      /os/finanzen?s=privat|business|steuern|gesamt|chef
//     Privat    &t=uebersicht|buchungen|einnahmen|analyse|fixkosten|plan|schulden (+ monat, kat, q bei Buchungen)
//               &k=<Kennzahl des Privat-Index>  #index · #ruecklage
//     Steuern   #fristen · #ruecklage · #ust · #uebergabe
//     Business  &f=kdc|kdv (Sicht) &k=<Kennzahl>  #abschluss · #einstellungen · #modell
//   Rechnung    /os/finanzen/planung?r=<id>        (springt hin und hebt hervor)
//   Planposten  /os/finanzen/liquiditaet?p=<id>    (öffnet den Posten) · #kontostaende
//   Woche       /os/planung/woche?tag=YYYY-MM-DD

import { mandateLink, markttraktion } from '@/lib/crm/adresse';

const q = (basis: string, p: Record<string, string | undefined | null>, hash?: string) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const t = s.toString();
  return `${basis}${t ? `?${t}` : ''}${hash ? `#${hash}` : ''}`;
};

export type ZahlenReiter = 'privat' | 'business' | 'steuern' | 'gesamt' | 'chef';

export const WEG = {
  zahlen: (s?: ZahlenReiter) => q('/os/finanzen', { s }),
  /** Business-Cockpit: Sicht (gesamt weglassen), Kennzahl, Abschnitt. */
  business: (o: { f?: string; k?: string; abschnitt?: 'abschluss' | 'einstellungen' | 'modell' | 'verlauf' } = {}) =>
    q('/os/finanzen', { s: 'business', f: o.f && o.f !== 'gesamt' ? o.f : undefined, k: o.k }, o.abschnitt),
  abschluss: (f?: string) => q('/os/finanzen', { s: 'business', f: f && f !== 'gesamt' ? f : undefined }, 'abschluss'),
  einstellungen: () => q('/os/finanzen', { s: 'business' }, 'einstellungen'),
  /** Privat: ein Reiter, bei Buchungen optional Monat, Kategorie (Id oder __offen) und Suche. */
  privat: (t?: string, filter: { monat?: string; kat?: string; q?: string; k?: string } = {}) =>
    q('/os/finanzen', { s: 'privat', t: t && t !== 'uebersicht' ? t : undefined, ...filter }),
  /** Privat-Übersicht mit dem Privat-Index (#index) bzw. der Rücklage (#ruecklage). */
  privatIndex: (abschnitt: 'index' | 'ruecklage' = 'index', k?: string) => q('/os/finanzen', { s: 'privat', k }, abschnitt),
  steuern: (abschnitt?: 'fristen' | 'ruecklage' | 'ust' | 'uebergabe') => q('/os/finanzen', { s: 'steuern' }, abschnitt),
  gesamt: () => q('/os/finanzen', { s: 'gesamt' }),
  chef: () => q('/os/finanzen', { s: 'chef' }),

  rechnung: (id?: string) => q('/os/finanzen/planung', { r: id }),
  rechnungen: () => '/os/finanzen/planung',
  zahlung: (id?: string) => q('/os/finanzen/planung', { z: id }),
  planposten: (id?: string) => q('/os/finanzen/liquiditaet', { p: id }),
  kontostaende: () => '/os/finanzen/liquiditaet#kontostaende',
  liquiditaet: () => '/os/finanzen/liquiditaet',
  controlling: () => '/os/controlling',
  grundlage: () => '/os/finanzen/grundlage',

  mandat: (id?: string) => mandateLink('mandate', id),
  produkt: (id?: string) => mandateLink('produkte', id),
  deal: (id?: string) => markttraktion('sales', 'pipeline', id),
  deals: () => markttraktion('sales', 'pipeline'),
  markttraktion: () => markttraktion(),

  woche: (tag?: string) => q('/os/planung/woche', { tag }),
  jahr: () => '/os/planung/jahr',
  agenten: () => '/os/agenten',
  aufgabe: (id: string) => q('/os/aufgaben', { offen: id }),
} as const;
