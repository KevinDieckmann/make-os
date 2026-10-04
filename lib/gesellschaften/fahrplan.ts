// ─── MAKE OS — Gründungsfahrplan als Vorlage (rein, client-sicher, 04.10., UMBAU_ABEND_0410.md › 8, Paket 4) ────
// Kevin 04.10.: „Kriegen wir dort jetzt alles sauber geplant?“ (Gründung bzw. Umfirmierung der eigenen GmbH) Eine mitgelieferte Vorlage
// „GmbH-Gründung / Umfirmierung“: EIN Jahresziel (Business, Einheit = die Gesellschaft) + neun Meilensteine mit Kette
// (`wartetAuf`, lib/planung/meilenstein-kette.ts) + je Meilenstein ein paar Aufgaben. Ohne echte Daten: Namen kommen aus dem
// Register (zur Laufzeit), Termine sind Vorschläge relativ zu heute (Wochen) und frei änderbar. Keine Rechtsberatung.
// Angelegt wird über die bestehenden Schreibwege (Ziele-PATCH, Meilensteine-PATCH, /api/tasks/create mit meilensteinId) —
// alles mit festen Kennungen aus der Gesellschaft, darum wiederholbar ohne Doppelte (Aufgaben: gleicher Titel in derselben
// Meilenstein-Liste wird erkannt). Die Stammkapital-Einzahlung ist nur ein Hinweis mit Weg in den Finanzplan.

import type { Ziel, Meilenstein } from '@/lib/planung/typen';
import { tagePlus } from '@/lib/zeit';

export type FahrplanArt = 'gruendung' | 'umfirmierung';

interface Schritt { key: string; titel: (x: FahrplanKontext) => string; wochen: number; wartetAuf: string[]; messlatte: string; aufgaben: string[] }
export interface FahrplanKontext { name: string; vorgaenger?: string; art: FahrplanArt }

/** Die neun Schritte — Reihenfolge = Kette. Texte allgemein, Hinweise keine Rechtsberatung. */
export const FAHRPLAN_SCHRITTE: readonly Schritt[] = [
  { key: 'vertrag', wochen: 2, wartetAuf: [], titel: x => (x.art === 'umfirmierung' ? 'Satzungsänderung final' : 'Gesellschaftsvertrag final'), messlatte: 'Fassung von allen Gesellschaftern freigegeben',
    aufgaben: ['Entwurf mit Beratung abstimmen', 'Firmierung, Sitz und Gegenstand festlegen', 'Fassung an den Notar schicken'] },
  { key: 'notar', wochen: 4, wartetAuf: ['vertrag'], titel: () => 'Notartermin und Beurkundung', messlatte: 'Urkunde unterschrieben',
    aufgaben: ['Termin beim Notar vereinbaren', 'Ausweise und Unterlagen der Beteiligten bereitlegen', 'Urkunde in die Unterlagen der Gesellschaft legen'] },
  { key: 'konto', wochen: 5, wartetAuf: ['notar'], titel: x => (x.art === 'umfirmierung' ? 'Konto auf neue Firmierung umstellen' : 'Geschäftskonto und Stammkapital-Nachweis'), messlatte: 'Konto läuft, Einzahlung belegt',
    aufgaben: ['Geschäftskonto eröffnen bzw. Firmierung bei der Bank ändern', 'Stammkapital einzahlen und im Finanzplan vormerken', 'Einzahlungsbeleg für die Anmeldung ablegen'] },
  { key: 'register', wochen: 8, wartetAuf: ['notar', 'konto'], titel: x => (x.art === 'umfirmierung' && x.vorgaenger ? `Handelsregister: Umfirmierung ${x.vorgaenger} → ${x.name}` : 'Handelsregister: Anmeldung und Eintragung'), messlatte: 'Eintragung bekanntgemacht, HRB im Register',
    aufgaben: ['Anmeldung über den Notar einreichen', 'Eintragung prüfen und HRB im Steckbrief eintragen'] },
  { key: 'transparenz', wochen: 9, wartetAuf: ['register'], titel: () => 'Transparenzregister', messlatte: 'Wirtschaftlich Berechtigte gemeldet',
    aufgaben: ['Wirtschaftlich Berechtigte melden', 'Bestätigung ablegen'] },
  { key: 'finanzamt', wochen: 10, wartetAuf: ['register'], titel: x => (x.art === 'umfirmierung' ? 'Gewerbe und Finanzamt: Änderung melden' : 'Gewerbe anmelden und steuerlich erfassen'), messlatte: 'Gewerbe gemeldet, Steuernummer da',
    aufgaben: ['Gewerbe an- bzw. ummelden', 'Fragebogen zur steuerlichen Erfassung bzw. Änderung abgeben', 'Steuernummer im Steckbrief und bei den Absendern eintragen'] },
  { key: 'ihk', wochen: 11, wartetAuf: ['register'], titel: () => 'IHK', messlatte: 'Mitgliedschaft bestätigt',
    aufgaben: ['Schreiben der IHK prüfen und ablegen'] },
  { key: 'buchhaltung', wochen: 12, wartetAuf: ['register'], titel: () => 'Buchhaltung und Versicherungen umstellen', messlatte: 'Steuerberatung, Buchhaltung und Versicherungen laufen auf die Gesellschaft',
    aufgaben: ['Steuerberatung und Buchhaltung beauftragen bzw. umstellen', 'Versicherungen prüfen und umschreiben', 'Verträge mit Dienstleistern auf die Gesellschaft umstellen'] },
  { key: 'website', wochen: 12, wartetAuf: ['register'], titel: () => 'Website-Firmierung umstellen (erst nach Eintragung)', messlatte: 'Impressum, Datenschutz und Briefbögen tragen die neue Firmierung',
    aufgaben: ['Impressum und Datenschutzhinweis anpassen', 'Briefbogen, Signaturen und Angebots-Absender anpassen'] },
];

/** Kurzform der Gesellschafts-Kennung für feste Kennungen (Planung erlaubt [A-Za-z0-9_~:.-], ≤ 80). */
const kurz = (gid: string) => gid.replace(/^g-/, '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 36);
/** Kennungs-Anfang der Fahrplan-Ziele — daran erkennt das Ziel-Detail seine Gesellschaft (Weg zurück ins Register). */
export const FAHRPLAN_ZIEL_PRAEFIX = 'z-fahrplan-';
export const fahrplanZielId = (gid: string) => `${FAHRPLAN_ZIEL_PRAEFIX}${kurz(gid)}`;
export const fahrplanMeilensteinId = (gid: string, key: string) => `ms-fahrplan-${key}-${kurz(gid)}`;

export interface Fahrplan { ziel: Ziel; meilensteine: Meilenstein[]; aufgaben: { meilensteinId: string; titel: string }[] }

/**
 * Der Fahrplan für eine Gesellschaft. `einheit` = der Planungs-Name der Gesellschaft (Einheit der Ziele), `heute` = Berliner Tag.
 * Umfirmierung, wenn ein Vorgänger genannt ist (die Namen kommen aus dem Register, nie aus dem Code).
 */
export function fahrplanFuer(gid: string, x: FahrplanKontext, einheit: string, heute: string): Fahrplan {
  const zielId = fahrplanZielId(gid);
  const jahr = Number(heute.slice(0, 4));
  const ende = tagePlus(heute, Math.max(...FAHRPLAN_SCHRITTE.map(s => s.wochen)) * 7);
  const ziel: Ziel = {
    id: zielId, titel: x.art === 'umfirmierung' && x.vorgaenger ? `Umfirmierung ${x.vorgaenger} → ${x.name}` : `Gründung ${x.name}`,
    fortschritt: 0, space: 'business', einheit, jahr,
    messlatte: 'Eingetragen und alle Folgeschritte erledigt (Transparenzregister, Finanzamt, IHK, Buchhaltung, Website)',
    notiz: `Vorlage „GmbH-Gründung / Umfirmierung“ — Termine sind Vorschläge bis ${ende}, bitte anpassen. Hinweis, keine Rechtsberatung.`,
  };
  const meilensteine: Meilenstein[] = FAHRPLAN_SCHRITTE.map((s, i) => ({
    id: fahrplanMeilensteinId(gid, s.key), titel: s.titel(x), space: 'business', einheit, faellig: tagePlus(heute, s.wochen * 7),
    messlatte: s.messlatte, fortschritt: 0, erledigt: false, rang: i + 1, zielId,
    ...(s.wartetAuf.length ? { wartetAuf: s.wartetAuf.map(k => fahrplanMeilensteinId(gid, k)) } : {}),
  }));
  const aufgaben = FAHRPLAN_SCHRITTE.flatMap(s => s.aufgaben.map(titel => ({ meilensteinId: fahrplanMeilensteinId(gid, s.key), titel })));
  return { ziel, meilensteine, aufgaben };
}
