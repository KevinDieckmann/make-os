// ─── Fulfillment — Orte: wo ein Prozess heute in MAKE OS wohnt (C0, 10.10.; FULFILLMENT_KONZEPT.md 2.2) ──────────────────────────────
// Ein Knoten der Landkarte trägt optional `ort` = eine Kennung aus `ORTE`. Gespeichert wird NIE eine rohe Adresse — die Kennung löst über
// `WEG` (lib/wege.ts) in eine vorhandene Seite auf; ändert sich eine Adresse, ändert sie sich in WEG. Neue Kennung = neue Zeile hier
// (Wächter tests/fulfillment-fundament.test.ts: jede Kennung löst in eine Seite unter app/os auf). Rein und client-sicher.

import { WEG } from '@/lib/wege';

export interface Ort { titel: string; href: () => string }

export const ORTE = {
  // Dach — Steuerung
  'planung.business': { titel: 'Ziele & Planung', href: () => WEG.jahr() },
  'produkte.positionierung': { titel: 'Positionierung', href: () => WEG.marketing('positionierung') },
  'fokus.business': { titel: 'Fokus & Führungsrhythmus', href: () => WEG.fokus() },
  'business.index': { titel: 'Business-Index (Kennzahlen)', href: () => WEG.business() },
  // Etagen — Kernprozesse entlang des Kreislaufs
  'markttraktion.marketing': { titel: 'Markttraktion › Marketing', href: () => WEG.marketing() },
  'markttraktion.qualifizierung': { titel: 'Markttraktion › Qualifizierung', href: () => WEG.qualifizierung() },
  'markttraktion.deals': { titel: 'Markttraktion › Deals', href: () => WEG.deals() },
  'markttraktion.followup': { titel: 'Markttraktion › Follow-up', href: () => WEG.followup() },
  'markttraktion.angebot': { titel: 'Markttraktion › Angebot', href: () => WEG.angebot() },
  'markttraktion.planung': { titel: 'Markttraktion › Planung (Kreislauf)', href: () => WEG.vertriebsplanung() },
  'markttraktion.events': { titel: 'Markttraktion › Events', href: () => WEG.besuch() },
  'netzwerken': { titel: 'Netzwerken', href: () => WEG.netzwerken() },
  'fulfillment.onboarding': { titel: 'Fulfillment › Onboarding', href: () => WEG.fulfillment('onboarding') },
  'fulfillment.prozesse': { titel: 'Fulfillment › Prozesse', href: () => WEG.fulfillment('prozesse') },
  'fulfillment.bausteine': { titel: 'Fulfillment › Bausteine', href: () => WEG.fulfillment('bausteine') },
  'fulfillment.analysen': { titel: 'Fulfillment › Analysen', href: () => WEG.fulfillment('analysen') },
  'fulfillment.kreislauf': { titel: 'Fulfillment › Kreislauf', href: () => WEG.fulfillment('kreislauf') },
  'mandate': { titel: 'Produkte & Mandate › Mandate', href: () => WEG.mandat() },
  'produkte': { titel: 'Produkte & Mandate › Produkte', href: () => WEG.produkt() },
  // Fundament — Unterstützung
  'markttraktion.kontakte': { titel: 'Markttraktion › Kontakte (CRM)', href: () => WEG.kontakt() },
  'einstellungen.team': { titel: 'Konto › Team', href: () => WEG.konto() },
  'datenschutz': { titel: 'Datenschutz', href: () => WEG.datenschutz() },
  'agenten': { titel: 'ZOE › Agenten', href: () => WEG.agenten() },
  'finanzen.business': { titel: 'Finanzen › Business', href: () => WEG.zahlen('business') },
  'unternehmen': { titel: 'Unternehmen', href: () => WEG.unternehmen() },
  'aufgaben': { titel: 'Aufgaben', href: () => WEG.aufgaben() },
  'kalender': { titel: 'Kalender', href: () => WEG.kalender() },
} as const satisfies Record<string, Ort>;

export type OrtId = keyof typeof ORTE;
export const ORT_IDS = Object.keys(ORTE) as OrtId[];
export const istOrt = (v: unknown): v is OrtId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(ORTE, v);
/** Die Adresse eines Orts — unbekannt: null (die Oberfläche zeigt dann keinen Sprung). */
export const ortHref = (v: unknown): string | null => (istOrt(v) ? ORTE[v].href() : null);
