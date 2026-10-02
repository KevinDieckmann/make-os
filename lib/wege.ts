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
//   Woche       /os/kalender?modus=planen&tag=YYYY-MM-DD   (K5: der Wochenplaner ist der Modus „Planen“ im Kalender;
//               /os/planung/woche leitet dorthin weiter)
//   Kalender    /os/kalender[?tag=YYYY-MM-DD]
//   Gesundheit  /os/gesundheit?fuer=<person>#morgen|routinen|haut|streak|index
//   Markttraktion über lib/crm/adresse.ts (s · a · k)

import { mandateLink, markttraktion, dealAkte, angebotLink, type AngebotAdresse } from '@/lib/crm/adresse';
import { aufgabenLink, type AufgabenAdresse } from '@/lib/aufgaben/adresse';

const q = (basis: string, p: Record<string, string | undefined | null>, hash?: string) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const t = s.toString();
  return `${basis}${t ? `?${t}` : ''}${hash ? `#${hash}` : ''}`;
};

export type ZahlenReiter = 'privat' | 'business' | 'steuern' | 'gesamt' | 'chef';

export const WEG = {
  /** Home (das eigene Dashboard) · Heute (die feste Tagesseite) · Übersicht je Space · Kontakte privat (26.09.). */
  home: () => '/os',
  heute: () => '/os/heute',
  uebersicht: (space: 'privat' | 'business') => `/os/uebersicht?space=${space}`,
  menschen: () => '/os/menschen',
  /** Netzwerken (02.10.): die Seite für unterwegs (Erfassen, Abendbericht — `bericht` = Event) · `netzwerkenKarte` = „Meine Visitenkarte“ (QR, vCard). */
  netzwerken: (o: { bericht?: string } = {}) => q('/os/netzwerken', { bericht: o.bericht }),
  netzwerkenKarte: () => '/os/netzwerken/karte',
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
  // Deal-Ebene (27.09.): eigener Reiter; ein Deal öffnet seine Akte.
  deal: (id?: string) => (id ? dealAkte(id) : markttraktion('deals')),
  deals: () => markttraktion('deals'),
  followup: (a?: 'woche' | 'powerhour' | 'kadenz') => markttraktion('followup', a),
  markttraktion: () => markttraktion(),
  // Schnellknöpfe der Markttraktion (28.09. abends): Qualifizierung und Angebot (vorbelegt mit Kontakt/Firma/Deal).
  qualifizierung: () => markttraktion('qualifizierung'),
  angebot: (x?: AngebotAdresse) => angebotLink(x),

  /** Ein Termin im Kalender (K3): Tag anspringen und das Termin-Fenster öffnen (Schlüssel `uid` bzw. `uid::RID`). */
  termin: (id: string, tag?: string) => q('/os/kalender', { tag, termin: id }),
  kalender: (tag?: string) => q('/os/kalender', { tag }),
  woche: (tag?: string) => q('/os/kalender', { modus: 'planen', tag }),
  tag: (tag?: string) => q('/os/planung', { tag }),
  routinen: () => '/os/planung/routinen',

  // Gesundheit — persönlich; `fuer` zeigt die andere Person, wenn sie teilt.
  gesundheit: (abschnitt?: 'morgen' | 'routinen' | 'haut' | 'streak' | 'index', fuer?: string) => q('/os/gesundheit', { fuer }, abschnitt),
  journal: () => '/os/journal',
  ernaehrung: () => '/os/gesundheit?s=ernaehrung',
  gericht: (id: string) => `/os/gesundheit?s=ernaehrung&g=${encodeURIComponent(id)}`,
  energie: () => '/os/gesundheit?s=koerper',
  // Sport (27.09.): persönlich je Person — Reiter plan (Standard) · hyrox · lauf · gym · erholung.
  sport: (reiter?: 'hyrox' | 'lauf' | 'gym' | 'erholung') => q('/os/sport', { s: reiter }),
  verbindungen: () => '/os/verbindungen',
  saeule: (key: 'health' | 'planning' | 'finance' | 'social' | 'agents') => `/os/saeule/${key}`,
  wachstum: () => '/os/wachstum',

  // Markttraktion — die Kartei darunter heißt technisch weiter „crm“.
  akte: (id: string) => markttraktion('kontakte', 'akte', id),
  kontakt: (id?: string) => markttraktion('kontakte', undefined, id),
  firma: (id?: string) => markttraktion('firmen', undefined, id),
  powerHour: () => markttraktion('followup', 'powerhour'),
  leads: () => markttraktion('firmen', 'leads'),
  kunden: () => markttraktion('deals', 'kunden'),
  kampagne: (id?: string, head: 'sales' | 'marketing' = 'marketing') => markttraktion(head, 'kampagnen', id),
  marketing: (a?: 'anfragen' | 'segmente' | 'kampagnen' | 'redaktion' | 'newsletter' | 'positionierung', k?: string) => markttraktion('marketing', a, k),
  event: (id?: string, r?: 'gaeste' | 'ablauf' | 'checkliste' | 'budget' | 'abend' | 'nachfassen') => `${markttraktion('event', undefined, id)}${r ? `${id ? '&' : '?'}r=${r}` : ''}`,
  stammdaten: (tab?: string) => markttraktion('stammdaten', tab),
  jahr: () => '/os/planung/jahr',
  /**
   * Ein Meilenstein im Detail (30.09.): Aufgaben (echte Aufgaben mit Unteraufgaben), Verlauf, Dateien & Links, Notizen.
   * `r` = Abschnitt, der geöffnet/angesprungen wird. Der Zeitstrahl und alle Listen verlinken nur hierüber.
   */
  meilenstein: (id: string, r?: 'aufgaben' | 'verlauf' | 'dateien' | 'notizen') => q(`/os/planung/meilenstein/${encodeURIComponent(id)}`, { r }),
  /**
   * Ein Ziel im Detail (01.10., Ziel ↔ Meilenstein): Kopf (Frist, Messlatte, Fortschritt aus den Meilensteinen), die
   * Meilensteine als geordnete Kette (mit Abhängigkeiten), „+ Meilenstein zu diesem Ziel“, Beschreibung. Alle Horizonte.
   */
  ziel: (id: string) => `/os/planung/ziel/${encodeURIComponent(id)}`,
  agenten: () => '/os/agenten',
  aufgabe: (id: string) => q('/os/aufgaben', { offen: id }),
  /**
   * Aufgaben-Seite (Navigation wie im CRM, 28.09. spät — lib/aufgaben/adresse.ts): ohne Angabe der Überblick;
   * `s` Space (privat · kdc · kdv · ug · m-<firmaId>), `p` Projekt (Projektseite, `t` Reiter), `g` Gruppe, `l` Liste,
   * `a` Aufgabe, `b: 'archiv'`. Alt (weiter gültig): `r` = Space, `space` = Seitenleiste.
   */
  aufgaben: (o: Partial<Omit<AufgabenAdresse, 'ansicht'>> & { r?: string; space?: 'privat' | 'business'; b?: 'ueberblick' | 'archiv' } = {}) => {
    const s = o.s ?? o.r;
    return aufgabenLink({ ...o, s, bereich: o.bereich ?? o.space, ansicht: o.b === 'archiv' ? 'archiv' : s && o.b !== 'ueberblick' ? 'space' : 'ueberblick' });
  },
} as const;
