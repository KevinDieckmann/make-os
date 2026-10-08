// ─── Wege — wohin ein Klick führt (rein, client-sicher) ─────────────────────
// Kevin (25.09.): „Hinter jeder Kachel müssen Verbindungen sein, die nicht
// enden.“ Jede Kennzahl, jeder Punkt dahinter und jede Steuerfrist verlinkt
// über diese eine Liste — so zeigt ein Link nie ins Leere, und wer eine
// Adresse ändert, ändert sie hier.
//
//   Heute       /os[?space=privat|business]   (die eine Startseite, 08.10.)
//   Finanzen    /os/finanzen?space=privat|business&s=<Reiter>   (bis 08.10. „Zahlen“; WEG.zahlen bleibt der Name der Funktion)
//               Höchstens zwei Ebenen (08.10., Aufräumen Etappe 2) — Aufbau und Regeln: lib/finanzen/navigation.ts
//     Privat    s=privat (Überblick, #index · #ruecklage · #gesamt) · s=privat&t=buchungen|einnahmen|analyse|fixkosten|plan|schulden
//               (Konten & Buchungen; + monat, kat, q) · s=buchungen&space=privat (Buchungen der Selbstständigkeit) · s=finanzplanung · s=steuern
//     Business  s=business (Überblick: &f=kdc|kdv &k=<Kennzahl> #abschluss · #einstellungen · #modell · #eroeffnung) · s=controlling
//               · s=rechnungen (&r=<Rechnung> &z=<Zahlung>) · s=liquiditaet (&p=<Posten>, #kontostaende) · s=buchungen (&monat &kat &q &ort)
//               · s=finanzplanung (&u=<Blatt>) · s=steuern (#fristen · #ruecklage · #ust · #uebergabe) · s=chef (Head of Finance, Knopf)
//   Alte Adressen /os/finanzen/{planung,liquiditaet,buchungen,grundlage,dashboard}, /os/controlling, /os/finanzplan, /os/business
//               leiten in next.config.mjs mit allen Parametern weiter.
//   Woche       /os/kalender?modus=planen&tag=YYYY-MM-DD   (K5: der Wochenplaner ist der Modus „Planen“ im Kalender;
//               /os/planung/woche leitet dorthin weiter)
//   Kalender    /os/kalender[?tag=YYYY-MM-DD]
//   Gesundheit  /os/gesundheit?fuer=<person>#morgen|routinen|haut|streak|index
//   Markttraktion über lib/crm/adresse.ts (s · a · k)

import { mandateLink, markttraktion, dealAkte, angebotLink, type AngebotAdresse } from '@/lib/crm/adresse';
import { aufgabenLink, type AufgabenAdresse } from '@/lib/aufgaben/adresse';
import { istNetzwerkenEvent } from '@/lib/crm/marke';

const q = (basis: string, p: Record<string, string | undefined | null>, hash?: string) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) s.set(k, v);
  const t = s.toString();
  return `${basis}${t ? `?${t}` : ''}${hash ? `#${hash}` : ''}`;
};

export type ZahlenReiter = 'privat' | 'business' | 'steuern' | 'gesamt' | 'chef';

/** ZOE › Freigaben (08.10., Phase 0): „Offen“ (Standard, ohne Parameter) und „Protokoll“ (`?t=protokoll`, bis 08.10. /os/stapel/voll). */
export type FreigabenReiter = 'offen' | 'protokoll';
/** Der Reiter aus der Adresse — alles Unbekannte ist „Offen“. */
export const freigabenReiterAus = (t: string | null | undefined): FreigabenReiter => (t === 'protokoll' ? 'protokoll' : 'offen');

export const WEG = {
  /**
   * Heute (08.10., Aufräumen Etappe 1): EINE Startseite unter /os — ohne Space Privat und Business zusammen, mit `space` nur
   * dieser Space. Die alten Adressen /os/heute und /os/uebersicht?space= leiten hierher (next.config.mjs). · Kontakte privat.
   */
  heute: (space?: 'privat' | 'business') => q('/os', { space }),
  menschen: () => '/os/menschen',
  /** Konto (Kachel „Team“: Konten und Team-Personen des Haushalts pflegen). */
  konto: () => '/os/konto',
  /** System › Datenschutz (05.10.): Verantwortlicher, Empfänger/AVV, Selbstprüfung, Verzeichnis-Export — `#abschnitt` springt hin. */
  datenschutz: (abschnitt?: 'verantwortlicher' | 'empfaenger' | 'pruefung' | 'verzeichnis' | 'pannen' | 'dokumente' | 'nachweise' | 'gesundheit' | 'ki' | 'telegram' | 'protokoll') => q('/os/datenschutz', {}, abschnitt),
  /** Familie & Partnerschaft (Privat) · Inbox (eigenes Postfach). */
  familie: () => '/os/familie',
  inbox: () => '/os/inbox',
  /** Netzwerken (02.10.): die Seite für unterwegs (Erfassen, Abendbericht — `bericht` = Event; `event` = „Heute bei“ mit diesem Event vorwählen, 03.10.) · `netzwerkenKarte` = „Meine Visitenkarte“ (QR, vCard). */
  netzwerken: (o: { bericht?: string; event?: string } = {}) => q('/os/netzwerken', { bericht: o.bericht, event: o.event }),
  netzwerkenKarte: () => '/os/netzwerken/karte',
  zahlen: (s?: ZahlenReiter) => q('/os/finanzen', { s }),
  /** Business-Cockpit: Sicht (gesamt weglassen), Kennzahl, Abschnitt. */
  business: (o: { f?: string; k?: string; abschnitt?: 'abschluss' | 'einstellungen' | 'modell' | 'verlauf' } = {}) =>
    q('/os/finanzen', { s: 'business', f: o.f && o.f !== 'gesamt' ? o.f : undefined, k: o.k }, o.abschnitt),
  abschluss: (f?: string) => q('/os/finanzen', { s: 'business', f: f && f !== 'gesamt' ? f : undefined }, 'abschluss'),
  einstellungen: () => q('/os/finanzen', { s: 'business' }, 'einstellungen'),
  /** 0-Punkt (Eröffnung, 05.10.) unter Zahlen › Business — Karte mit Stichtag, Anfangsbestand, offenen Posten und dem Archiv davor. */
  eroeffnung: () => q('/os/finanzen', { s: 'business' }, 'eroeffnung'),
  /** Privat: ein Reiter, bei Buchungen optional Monat, Kategorie (Id oder __offen) und Suche. */
  privat: (t?: string, filter: { monat?: string; kat?: string; q?: string; k?: string } = {}) =>
    q('/os/finanzen', { s: 'privat', t: t && t !== 'uebersicht' ? t : undefined, ...filter }),
  /** Privat-Übersicht mit dem Privat-Index (#index) bzw. der Rücklage (#ruecklage). */
  privatIndex: (abschnitt: 'index' | 'ruecklage' = 'index', k?: string) => q('/os/finanzen', { s: 'privat', k }, abschnitt),
  /** Steuern (05.10.: auch unter Privat — `space=privat` zeigt Privat und die Selbstständigkeit, ohne bzw. `business` nur die Gesellschaften). */
  steuern: (abschnitt?: 'fristen' | 'ruecklage' | 'ust' | 'uebergabe', space?: 'privat' | 'business') => q('/os/finanzen', { s: 'steuern', space: space === 'privat' ? 'privat' : undefined }, abschnitt),
  /** Gesamt (die Brücke Privat → Business) steht seit 08.10. EINMAL: unten auf Finanzen › Privat › Überblick. */
  gesamt: () => q('/os/finanzen', { s: 'privat' }, 'gesamt'),
  /** Head of Finance — ein Knopf neben den Reitern, kein eigener Reiter (08.10.). */
  chef: () => q('/os/finanzen', { s: 'chef' }),
  /** Finanzplanung (04.10.): Reiter „Planung“ unter Finanzen › Privat (alles) bzw. › Business (nur Gesellschaften); `u` = Blatt. Weitere Parameter: `finanzplanAdresse`. */
  finanzplanung: (sicht: 'privat' | 'business', u?: string) => q('/os/finanzen', { s: 'finanzplanung', space: sicht, u }),

  // Offene Posten der Eröffnung (Kennung `er-…`, lib/business/eroeffnung.ts) stehen nicht in der Rechnungsliste — sie führen zum 0-Punkt.
  // 08.10. (Aufräumen Etappe 2): Rechnungen & Zahlungen, Liquidität, Buchungen, Controlling sind Reiter unter Finanzen › Business.
  rechnung: (id?: string): string => (id?.startsWith('er-') ? q('/os/finanzen', { s: 'business' }, 'eroeffnung') : q('/os/finanzen', { s: 'rechnungen', space: 'business', r: id })),
  rechnungen: () => q('/os/finanzen', { s: 'rechnungen', space: 'business' }),
  zahlung: (id?: string): string => (id?.startsWith('er-') ? q('/os/finanzen', { s: 'business' }, 'eroeffnung') : q('/os/finanzen', { s: 'rechnungen', space: 'business', z: id })),
  planposten: (id?: string) => q('/os/finanzen', { s: 'liquiditaet', space: 'business', p: id }),
  kontostaende: () => q('/os/finanzen', { s: 'liquiditaet', space: 'business' }, 'kontostaende'),
  liquiditaet: () => q('/os/finanzen', { s: 'liquiditaet', space: 'business' }),
  controlling: () => q('/os/finanzen', { s: 'controlling', space: 'business' }),
  /** Buchungen der Gesellschaften (Business) bzw. — mit `ort` einer Privat-Einheit, z. B. der Selbstständigkeit — unter Privat. */
  buchungen: (f: { monat?: string; kat?: string; q?: string; ort?: string; privat?: boolean } = {}) =>
    q('/os/finanzen', { s: 'buchungen', space: f.privat ? 'privat' : 'business', monat: f.monat, kat: f.kat, q: f.q, ort: f.ort }),
  /** Altbestand der Selbstständigkeit (seit 08.10. unter Privat › Planung › Selbstständigkeit): das Kassenbuch (Grundlage).
   *  Das erste Cockpit (V1, `alt=v1`) ist seit 08.10. spät entfernt — `altbestand()` führt nur noch zum Abschnitt. */
  grundlage: () => q('/os/finanzen', { s: 'finanzplanung', space: 'privat', u: 'selbst', alt: 'grundlage' }, 'altbestand'),
  altbestand: () => q('/os/finanzen', { s: 'finanzplanung', space: 'privat', u: 'selbst' }, 'altbestand'),

  /** Gesellschafts-Register (04.10.): Liste bzw. eine Gesellschaft mit Reiter. */
  unternehmen: (id?: string, reiter?: 'steckbrief' | 'gesellschafter' | 'organe' | 'beteiligungen' | 'vertraege' | 'unterlagen' | 'absender') => q('/os/unternehmen', { g: id, r: id && reiter && reiter !== 'steckbrief' ? reiter : undefined }),
  /**
   * Unterlagen einer Gesellschaft in der Ablage — optional nur die eines Vertrags (DSGVO-Nachtrag 04.10.): funktioniert auch,
   * wenn Gesellschaft bzw. Vertrag endgültig gelöscht sind (die Unterlagen bleiben, § 257 HGB).
   */
  unterlagen: (gesellschaftId: string, vertragId?: string) => q('/os/unternehmen', { ablage: gesellschaftId, v: vertragId }),
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
  wachstum: () => '/os/wachstum',

  // Markttraktion — die Kartei darunter heißt technisch weiter „crm“.
  akte: (id: string) => markttraktion('kontakte', 'akte', id),
  kontakt: (id?: string) => markttraktion('kontakte', undefined, id),
  firma: (id?: string) => markttraktion('firmen', undefined, id),
  powerHour: () => markttraktion('followup', 'powerhour'),
  // Aufräumen Etappe 3 (08.10.): Leads stehen unter dem Schnellknopf Qualifizierung, „Kunden“ in Deals › Auswertung, Kampagnen nur unter Marketing.
  leads: (id?: string) => markttraktion('qualifizierung', 'leads', id),
  kunden: () => markttraktion('deals', 'auswertung'),
  kampagne: (id?: string) => markttraktion('marketing', 'kampagnen', id),
  marketing: (a?: 'anfragen' | 'segmente' | 'kampagnen' | 'redaktion' | 'newsletter' | 'positionierung', k?: string) => markttraktion('marketing', a, k),
  event: (id?: string, r?: 'gaeste' | 'ablauf' | 'checkliste' | 'budget' | 'abend' | 'nachfassen') => `${markttraktion('event', undefined, id)}${r ? `${id ? '&' : '?'}r=${r}` : ''}`,
  /** Events (03.10.): die Veranstaltungen, die wir BESUCHEN — `id` öffnet die Event-Akte, `a` die Ansicht (Kalender ist der Start). Make.One (unsere eigenen Abende) bleibt `WEG.event`. */
  besuch: (id?: string, a?: 'kalender' | 'wirkung' | 'kunden') => markttraktion('besuche', a, id),
  stammdaten: (tab?: string) => markttraktion('stammdaten', tab),
  jahr: () => '/os/planung/jahr',
  /** Kapazität (04.10.): je Person und Woche — verfügbar, verplant, Engpässe, Machbarkeit; `person` springt zur Person. */
  kapazitaet: (person?: string) => q('/os/planung/kapazitaet', { person }),
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
  /** ZOE › Freigaben (08.10.): ohne Angabe „Offen“; `protokoll` = was ZOE getan hat (Rückgängig), Gedächtnis, Wissen. */
  freigaben: (t?: FreigabenReiter) => q('/os/stapel', { t: t === 'protokoll' ? t : undefined }),
  /** Brain (05.10.): die Seite bzw. eine Notiz im Lesefenster (`?n=` — Kennung relativ zum Vault, wie /api/zoe/wissen sie liefert). */
  wissen: () => '/os/wissen',
  notiz: (id: string) => q('/os/wissen', { n: id }),
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

/**
 * Wohin ein Event führt (M10): ein BESUCHTES Event (Reiter „Events“, `marke: Netzwerken`) in seine Akte, unser eigenes Make.One-Event in
 * den Make.One-Reiter. Überall, wo ein Event verlinkt wird und die Art nicht feststeht, nur über diese Funktion — nie `WEG.event` für ein besuchtes.
 */
export const eventLink = (e: { id: string; marke?: string }, r?: Parameters<typeof WEG.event>[1]): string => (istNetzwerkenEvent(e) ? WEG.besuch(e.id) : WEG.event(e.id, r));
