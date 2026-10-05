// ─── Verzeichnis (Art. 30): Verarbeitung „KI-Funktionen (ZOE, automatische Läufe)“ (05.10.) ───────────────────────────
// Eigener, abgegrenzter Eintrag des DSGVO-Pakets „KI, Gesundheit, Telegram“ — bewusst NICHT in lib/crm/datenschutz.ts
// (dort baut ein paralleles Paket Verantwortlichen/VVT/AVV); angeschlossen in app/api/crm/stammdaten/route.ts wie die
// übrigen Nachträge (idempotent; vorhandene, auch von Hand geänderte Einträge bleiben). Rein.

import type { Verarbeitung } from '@/lib/crm/typen';
import { UG_NAME } from '@/lib/einheiten';
import { KI_EMPFAENGER, KI_PROTOKOLL_MONATE } from './ki-protokoll';

export const VV_KI = 'vv-ki';

export function verarbeitungKi(jetzt: string): Verarbeitung {
  return {
    id: VV_KI, name: 'KI-Funktionen (ZOE im Gespräch, Entwürfe, automatische Läufe)',
    zweck: 'Assistenz im Alltag und Geschäft: Fragen beantworten, Entwürfe (Mails, Ansprachen, Texte) vorbereiten, Lagebilder und Vorschläge — nichts verlässt das System ohne Freigabe eines Menschen',
    personen: 'Personen des Haushalts (Konten); Kontakte der Markttraktion, Absender im Postfach, Teilnehmende von Terminen',
    daten: 'je Bereich, soweit für ZOE erlaubt (System › Datenschutz): Aufgaben, Termine, Kontakte/Deals, Finanzzahlen, Notizen im Brain; Gesundheitswerte NUR mit ausdrücklicher Einwilligung „An die KI geben“ (Art. 9) — an die ZOE des Partners nur zusätzlich mit „Mit dem Partner teilen“; in automatischen Läufen Namen und Adressen von Kontakten durch Platzhalter ersetzt (Pseudonymisierung)',
    rechtsgrundlage: 'Art. 6 Abs. 1 lit. b/f DSGVO (eigene Arbeitsmittel, berechtigtes Interesse an effizienter Bearbeitung); Gesundheit: Art. 9 Abs. 2 lit. a (Einwilligung je Zweck, widerrufbar)',
    empfaenger: `${KI_EMPFAENGER} als Auftragsverarbeiter; Web-Suche nur, wenn eingeschaltet`,
    drittland: 'USA — EU-US Data Privacy Framework bzw. Standardvertragsklauseln (Anthropic); Telegram nur für neutrale Hinweise (Inhalte nur mit ausdrücklicher Ausnahme der Person)',
    loeschfrist: `Beim Anbieter nach dessen Aufbewahrungsregeln für API-Daten (prüfen/AVV); KI-Protokoll (nur Metadaten) ${KI_PROTOKOLL_MONATE} Monate`,
    toms: 'EINE Stelle für alle Modell-Aufrufe (KI-Tor): Schalter je Instanz und Person (Hintergrund-KI, Web-Suche, Bereiche), Einwilligungsprüfung Art. 9, Pseudonymisierung in Hintergrund-Läufen, KI-Protokoll ohne Inhalte, Fremdtext gekapselt, schreibende Werkzeuge nur als Vorschlag, KI-Kennzeichnung (KI-VO Art. 50)',
    verantwortlich: UG_NAME, stand: jetzt.slice(0, 10),
  };
}

/** Den Eintrag ergänzen, wenn er fehlt (idempotent; ein vorhandener — auch geänderter — bleibt). */
export function verarbeitungKiNachtragen(vorhanden: readonly Verarbeitung[], jetzt: string): Verarbeitung[] {
  return vorhanden.some(v => v.id === VV_KI) ? [...vorhanden] : [...vorhanden, verarbeitungKi(jetzt)];
}
