// ─── MAKE OS — Plan „Business online“ als Vorlage (rein, client-sicher, 09.10.) ───────────────────────────────────────────────────────
// Kevin 09.10. (Neustart): „… dann auch eine Strecke, wie man Business online bringt und alles, was da zu tun hat.“ Die Einrichtung führt
// durch die Strecke (Etappen „Business online“); diese Vorlage legt sie zusätzlich als PLAN an — EIN Jahresziel (Business, Einheit = die
// gewählte Gesellschaft) + Meilensteine mit Kette (`wartetAuf`, lib/planung/meilenstein-kette.ts) + je Meilenstein ein paar Aufgaben. So steht
// sie in Planung, Kapazität und Zeitstrahl. Vorbild: der Gründungsfahrplan (lib/gesellschaften/fahrplan.ts) — dieselbe Form `Fahrplan`.
// Ohne echte Daten: der Name der Gesellschaft kommt zur Laufzeit (lib/einheiten.ts), Termine sind Vorschläge relativ zu heute (Wochen).
// Angelegt wird nur über die bestehenden Schreibwege (lib/planung/vorlage-anlegen.ts: Ziele-PATCH, Meilensteine-PATCH, /api/tasks/create) —
// mit festen Kennungen aus der Gesellschaft, darum wiederholbar ohne Doppelte.

import type { Ziel, Meilenstein } from '@/lib/planung/typen';
import type { Fahrplan } from '@/lib/gesellschaften/fahrplan';
import { tagePlus } from '@/lib/zeit';

interface VorlagenSchritt { key: string; titel: string; wochen: number; wartetAuf: string[]; messlatte: string; aufgaben: string[] }

/** Die Meilensteine — Reihenfolge = Kette; die Texte folgen den Schritten der Einrichtung, ohne Namen und ohne Zahlen. */
export const BUSINESS_ONLINE_SCHRITTE: readonly VorlagenSchritt[] = [
  { key: 'gesellschaft', wochen: 1, wartetAuf: [], titel: 'Gesellschaft steht: Steckbrief und Absender', messlatte: 'Steckbrief und Absender vollständig, Gesellschafter und Verträge eingetragen',
    aufgaben: ['Steckbrief ausfüllen (Rechtsform, Rolle, Sitz, Geschäftsjahr)', 'Absender mit Pflichtangaben, Bank und Logo', 'Gesellschafter, Organe und laufende Verträge eintragen'] },
  { key: 'konten', wochen: 2, wartetAuf: ['gesellschaft'], titel: 'Konten und 0-Punkt', messlatte: 'Konten im Register, 0-Punkt gesetzt, offene Posten und Kontostände aktuell',
    aufgaben: ['Bankkonten im Konten-Register anlegen', 'Stichtag wählen und 0-Punkt setzen', 'Offene Posten zum Stichtag eintragen oder einfügen', 'Kontostände eintragen oder Kontoauszug einlesen'] },
  { key: 'kosten', wochen: 3, wartetAuf: ['konten'], titel: 'Kosten und Finanzplan', messlatte: 'Laufende Kosten als Bausteine, Steuerprofil gesetzt, Termin für den ersten Monatsabschluss',
    aufgaben: ['Laufende Kosten als Bausteine in der Finanzplanung', 'Steuerprofil setzen', 'Termin für den ersten Monatsabschluss festlegen'] },
  { key: 'angebot', wochen: 3, wartetAuf: ['gesellschaft'], titel: 'Angebot steht: Produkte und Vorlage', messlatte: 'Aktive Produkte mit Preis und Leistungstext, ein Angebot als Entwurf geprüft',
    aufgaben: ['Produkte mit Preis und Leistungstext', 'Ein Angebot als Entwurf anlegen und die Vorschau prüfen', 'Positionierung schärfen'] },
  { key: 'kartei', wochen: 3, wartetAuf: [], titel: 'Kartei sauber', messlatte: 'Verbindungsprüfung ohne Fehler, Kreis und Zuständig bei den wichtigsten Menschen',
    aufgaben: ['Verbindungsprüfung laufen lassen, Dubletten zusammenführen', 'Kreis A/B und Zuständig bei den wichtigsten Menschen', 'Herkunft und Rechtsgrundlage prüfen'] },
  { key: 'pipeline', wochen: 4, wartetAuf: ['kartei', 'angebot'], titel: 'Pipeline läuft', messlatte: 'Jeder offene Deal mit nächstem Schritt und Datum, laufende Mandate vollständig',
    aufgaben: ['Offene Deals mit nächstem Schritt und Datum', 'Laufende Mandate prüfen', 'Follow-up-Kadenz je Kreis festlegen'] },
  { key: 'rhythmus', wochen: 5, wartetAuf: ['pipeline'], titel: 'Vertrieb im Rhythmus: Power Hour und erste Kampagne', messlatte: 'Power Hour als fester Block, Wochenziele gesetzt, erste Kampagne geplant',
    aufgaben: ['Festen Block „Power Hour“ in der Wochenvorlage anlegen', 'Wochenziele im Scoreboard setzen', 'Erste Kampagne planen'] },
  { key: 'schnittstellen', wochen: 6, wartetAuf: ['kosten', 'rhythmus'], titel: 'Schnittstellen verbunden', messlatte: 'Kalender, Postfächer und — wenn gewünscht — WhatsApp verbunden und gesund',
    aufgaben: ['Google-Kalender und Gmail verbinden', 'Weitere Postfächer mit Bereich verbinden', 'WhatsApp Business anstoßen (die Verifizierung dauert Tage)'] },
  { key: 'agenten', wochen: 7, wartetAuf: ['schnittstellen'], titel: 'Agenten eingestellt', messlatte: 'Autonomie je Head bewusst gesetzt, erster Auftrag erledigt',
    aufgaben: ['Autonomie je Head setzen', 'Ersten Auftrag an einen Head geben'] },
];

/** Kennungs-Anfang der Plan-Ziele — daran erkennt die Einrichtung den Plan (Prüfung `business-vorlage`). */
export const BUSINESS_ONLINE_PRAEFIX = 'z-business-online-';
/** Kurzform der Gesellschafts-Kennung (Planung erlaubt [A-Za-z0-9_~:.-], ≤ 80). */
const kurz = (g: string) => g.replace(/^g-/, '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 36);
export const businessOnlineZielId = (g: string) => `${BUSINESS_ONLINE_PRAEFIX}${kurz(g)}`;
export const businessOnlineMeilensteinId = (g: string, key: string) => `ms-business-online-${key}-${kurz(g)}`;

/**
 * Der Plan für eine Gesellschaft. `name` = Anzeigename (lib/einheiten.ts), `einheit` = Planungs-Name der Gesellschaft, `heute` = Berliner Tag.
 * Rein — dieselben Eingaben ergeben denselben Plan (feste Kennungen).
 */
export function businessOnlineFuer(g: string, name: string, einheit: string, heute: string): Fahrplan {
  const zielId = businessOnlineZielId(g);
  const ende = tagePlus(heute, Math.max(...BUSINESS_ONLINE_SCHRITTE.map(s => s.wochen)) * 7);
  const ziel: Ziel = {
    id: zielId, titel: `Business online: ${name}`, fortschritt: 0, space: 'business', einheit, jahr: Number(heute.slice(0, 4)),
    messlatte: 'Gesellschaft, Konten, Kosten, Angebot und Vertrieb stehen; Schnittstellen verbunden; Agenten eingestellt',
    notiz: `Vorlage „Business online“ aus der Einrichtung — Termine sind Vorschläge bis ${ende}, bitte anpassen.`,
  };
  const meilensteine: Meilenstein[] = BUSINESS_ONLINE_SCHRITTE.map((s, i) => ({
    id: businessOnlineMeilensteinId(g, s.key), titel: s.titel, space: 'business', einheit, faellig: tagePlus(heute, s.wochen * 7),
    messlatte: s.messlatte, fortschritt: 0, erledigt: false, rang: i + 1, zielId,
    ...(s.wartetAuf.length ? { wartetAuf: s.wartetAuf.map(k => businessOnlineMeilensteinId(g, k)) } : {}),
  }));
  const aufgaben = BUSINESS_ONLINE_SCHRITTE.flatMap(s => s.aufgaben.map(titel => ({ meilensteinId: businessOnlineMeilensteinId(g, s.key), titel })));
  return { ziel, meilensteine, aufgaben };
}
