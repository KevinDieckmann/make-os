// ─── MAKE OS — Was ist neu (18.10., Kevin: „jedes Mal, wenn ein Update gemacht wird, sagt ihr uns, dass ein Update war und zeigt, was neu
// ist — damit Malin auch immer Bescheid weiß“) ─────────────────────────────────────────────────────────────────────────────────────────────
// EINE Liste der Updates (neueste zuerst). Nach jedem Update sieht jede Person beim nächsten Öffnen EINMAL den Hinweis (UpdateHinweis.tsx),
// dauerhaft steht alles unter Einstellungen › Was ist neu (/os/neuigkeiten). Gelesen merkt sich der Server je Person (lib/neuigkeiten/server.ts).
//
// REGEL (CLAUDE.md › Was ist neu): JEDES Update, das nach `main` geht, bekommt hier oben einen Eintrag — in einfachen Sätzen für die Menschen,
// die damit arbeiten (kein Code, keine Branch-Namen). Die Texte sind Teil der Software und gehen an JEDE Instanz: keine Namen von Personen,
// keine Firmen, keine Beträge, keine privaten Inhalte (Wächter tests/neuigkeiten.test.ts). Jeder Punkt trägt seinen Bereich — ein Konto
// „nur Business“ bekommt Privat-Punkte nie (serverseitig, `neuigkeitenFuer`). `weg` nur über WEG bzw. eine Adresse unter /os.
//
// Rein (Server und Browser).

import { WEG } from '@/lib/wege';

export type NeuBereich = 'privat' | 'business' | 'alle';
export type NeuArt = 'neu' | 'besser' | 'behoben';
export interface NeuPunkt { text: string; bereich: NeuBereich; weg?: string }
export interface NeuAbschnitt { art: NeuArt; punkte: NeuPunkt[] }
export interface Neuigkeit {
  /** Feste Kennung (`u-JJJJ-MM-TT`, bei zwei Updates an einem Tag `…-2`) — nie ändern, sonst erscheint der Hinweis noch einmal. */
  id: string;
  /** Tag des Updates (JJJJ-MM-TT). */
  datum: string;
  titel: string;
  /** Ein, zwei Sätze für den Hinweis. */
  kurz: string;
  /** Fassung für ein Konto „nur Business“ (ohne Privat-Themen) — fehlt sie, gilt `kurz`. */
  kurzBusiness?: string;
  abschnitte: NeuAbschnitt[];
}

export const NEU_ART_NAME: Record<NeuArt, string> = { neu: 'Neu', besser: 'Besser geworden', behoben: 'Behoben' };

export const NEUIGKEITEN: readonly Neuigkeit[] = [
  {
    id: 'u-2026-10-21',
    datum: '2026-10-21',
    titel: 'Prozesse, zwei Scores, Produkte & Mandate',
    kurz: 'Neu unter Business: „Prozesse“ — alle Abläufe von Marketing bis Fulfillment als Landkarte, in der Werkstatt selbst bauen und intern laufen lassen. Oben auf „Heute“ stehen nur noch zwei Scores, und ein Produkt ist jetzt eine Karte.',
    kurzBusiness: 'Neu: „Prozesse“ — alle Abläufe von Marketing bis Fulfillment als Landkarte, in der Werkstatt selbst bauen und intern laufen lassen. Oben auf „Heute“ steht der Business-Score, und ein Produkt ist jetzt eine Karte.',
    abschnitte: [
      { art: 'neu', punkte: [
        { bereich: 'business', text: 'Prozesse: eine Landkarte der ganzen Firma als Fliege — links Kunden gewinnen, in der Mitte die Übergabe, rechts liefern und ausbauen. Antippen fährt bis zum einzelnen Schritt, auf Wunsch im Vollbild oder als Präsentation.', weg: WEG.prozesse() },
        { bereich: 'business', text: 'Prozesse ist jetzt ein eigenes Werkzeug: beim Öffnen klappt die Leiste links auf Landkarte · Liste · Werkstatt · Vorlagen um, „← MAKE OS“ führt zurück. Der Pfeil oben rechts in jeder Fläche öffnet den ganzen Bildschirm wie in Miro — Werkzeuge schweben am Rand, Zoom unten rechts, das Seitenfeld klappt ein, Esc beendet.', weg: WEG.prozesse() },
        { bereich: 'business', text: 'Werkstatt: Prozesse selbst bauen — Bausteine mit „+“ anhängen, jede Verbindung ein Lichtfaden, eine Maske je Baustein. Dazu Auslöser (Mail, WhatsApp, Lead, Deal, Termin, Zahlung, Zeitplan, Webhook von außen) und Agenten mit Modell, Gedächtnis und Werkzeugen.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Werkstatt: bauen wie in n8n — „+“ mitten auf jedem Faden fügt dazwischen ein, Fäden über Phasen und Kantenenden lassen sich umhängen, Doppelklick benennt direkt auf der Fläche, Enter öffnet das große Fenster mit Eingabe · Einstellungen · Ausgabe. Platzhalter klickt oder zieht ihr an den Cursor und seht sofort die Vorschau.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Werkstatt testen: „Nur diesen Schritt“ bzw. „Bis hier“ zeigt „würde senden … an …“ als Tabelle, ohne etwas zu senden — mit eigenen Testdaten (nur erfunden) und „Weg annehmen“ je Raute. Dazu „Als Testdaten in Bauen“ aus einem Lauf, eine Karte, Schritte ausschalten, Kopieren zwischen Prozessen, die Mehrfach-Entscheidung und „Modell wirklich fragen“ nur auf euren Klick.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: '18 fertige Vorlagen für die Kundengewinnung, vom nächtlichen Prospecting bis zur Gästeliste — und „Head fragen“: der Head schlägt einen ganzen Prozess oder fehlende Bausteine vor, übernommen wird erst mit eurem Klick.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Auslöser „Datum am Fall“ startet selbst: n Tage oder Werktage vor bzw. nach Kündigungsfrist, Review, Mandatsende, Event oder Wiedervorlage — je Fall und Stichtag einmal, beim ersten Mal wird nur gemerkt. So laufen auch Event-Nachfassen, geparkte Leads, Empfehlung, Verlängerung und Gästeliste von selbst an.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Laufen intern: Schritte werden Aufgaben, alles nach außen liegt als Vorschlag in den Freigaben — gebt ihr eine Mail oder WhatsApp frei, geht sie direkt raus. Jeder Prozess startet im Probelauf, scharf erst mit eurem Klick und einem Budget.' },
        { bereich: 'business', text: 'Reiter „Läufe“ und „Tests“: jeder Lauf auf demselben Bild mit Haken je Schritt, Ablauf und Kosten — ein Lauf lässt sich als Testfall übernehmen.' },
        { bereich: 'business', text: 'Fulfillment im Prozess: auf der Produktkarte unter „Ablauf“ einen Werkstatt-Prozess wählen oder direkt anlegen — ein neues Mandat (auch ein Zusatzmodul) startet ihn, Schritte mit „Dem Kunden zeigen“ erscheinen im Kunden-Link.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Recherche im Prozess nur mit öffentlichen Angaben (Firmenname, Website, Branche) — die gefundenen Felder bestätigt ihr im Stapel, einzeln oder alle auf einmal.' },
        { bereich: 'business', text: 'Landkarte anpassen (Stift auf der Landkarte): Bereiche umbenennen und einfärben, eigene Bereiche anlegen, Kacheln verschieben, umsortieren, kürzer beschriften oder ausblenden — „Auf Vorgabe zurück“ holt alles wieder.', weg: WEG.prozesse() },
        { bereich: 'business', text: 'Jeder Prozess bleibt bearbeitbar: alte Versionen ansehen und als neuen Entwurf zurückholen, „Kopie anlegen“ und „Als Vorlage speichern“ — eure Vorlagen stehen in „Aus Vorlage anlegen“ unter „Eigene Vorlagen“, ohne Personen und Fall-Daten.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Stellschrauben der festen Abläufe: öffnet ihr einen System-Prozess, steht unter dem Steckbrief, welche Einstellungen er liest — Kadenz, Mahnstufen, Löschfristen, Nachsorge, Uhrzeiten der Heads, Nachfassfrist, Report-Abstand und mehr —, mit Wert, Vorgabe und „Speichern“. Gespeichert wird dort, wo der Wert ohnehin liegt; Gesetzliches bleibt fest. Kacheln mit Regler-Zeichen sind einstellbar.', weg: WEG.prozesse() },
        { bereich: 'business', text: 'Feste Abläufe ziehen in die Werkstatt: Mahnaufgaben, Fortschritts-Report und Onboarding-Vorschlag lassen sich im Steckbrief „In die Werkstatt überführen“. Zuerst rechnet der neue Prozess im Schatten mit, der alte arbeitet weiter; „Umschalten“ geht erst, wenn beide einige Tage dasselbe tun. Hältst du ihn an, arbeitet wieder der alte Weg — dieselben Kennungen, nichts doppelt.', weg: WEG.prozesse() },
        { bereich: 'alle', text: 'Oben auf „Heute“ steht der Score eures Bereichs: unter Privat der Privat-Score (je Person), unter Business der Business-Score. Antippen öffnet Säulen, Kennzahlen und den größten Hebel.' },
        { bereich: 'business', text: 'Die Leistungstreppe ist jetzt euer Katalog: Stufen von links nach rechts, Alternativen übereinander, je Produkt Preis, Kunden und freie Plätze.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Produkte geführt anlegen: Name, Art, Preis, Gesellschaft und ein Satz — danach öffnet sich die Karte mit allen Einzelheiten.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Preise kombinierbar: einmalig, monatlich, jährlich, je Event, Tages- oder Stundensatz, Erfolgsanteil — mit Anzahlung, Kontingent oder Deckel.' },
        { bereich: 'business', text: 'Vertrag und Regeln am Produkt: Mindestlaufzeit, Kündigung, Anrechnung auf ein anderes Produkt, höchstens N Kunden gleichzeitig, inklusive Leistungen.' },
        { bereich: 'business', text: 'Mandat aus dem Produkt: Honorar, Laufzeit, Gesellschaft und Leistungen kommen mit — dazu Zusatzmodule, die Rechnung, Liquidität und Fall mitrechnen.', weg: WEG.mandat() },
        { bereich: 'business', text: 'Produkte importieren: aus einer Tabelle oder Datei, mit Vorschau „neu · ändert · gleich“ — erst „Übernehmen“ schreibt.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Markttraktion ist ein eigenes Werkzeug wie HubSpot: die Leiste links klappt auf ihr Menü um — Kontakte und Firmen, Vertrieb, Marketing samt Netzwerken, Steuerung mit „Automationen & Head“, unten die Stammdaten. Neu „Auswertung“: der Weg vom Kontakt zum gewonnenen Deal als Lichtfaden, dazu Traktions-Index, Scoreboard, Kanäle und Pipeline. „+ Angebot“ steht in Kontakt-, Firmen- und Deal-Akte.', weg: WEG.auswertung() },
        { bereich: 'alle', text: 'Auch Produkte & Mandate, Unternehmen, Finanzen und Planung sind jetzt Werkzeuge: beim Öffnen klappt die Leiste links auf ihr Menü um (am Handy oben im „Menü“), die Reiterzeilen auf den Seiten sind weg. Je Bereich gibt es „Automationen & Head“ — die Abläufe des Bereichs und sein Head; unter Privat nur, wo es einen Head gibt. Planung › „Woche planen“ öffnet den Kalender.', weg: WEG.jahr() },
        { bereich: 'alle', text: 'Ebenso Kalender, Inbox, Aufgaben, ZOE und die übrigen Bereiche eurer Sicht: die Leiste links klappt auf ihr Menü um (am Handy oben im „Menü“), doppelte Reiterzeilen sind weg. Der Kalender trägt seine Spalte unter dem Menü, die Inbox zeigt ihre Bereiche, die Aufgaben ihre Spaces. „Automationen & Head“ gibt es, wo es Prozesse oder einen Head gibt.', weg: WEG.aufgaben() },
      ] },
      { art: 'besser', punkte: [
        { bereich: 'alle', text: 'Der gemischte Wachstums-Score ist weg — Finanzen zeigt nur noch die Finanzen der Sicht, Privat zeigt Privat und Business zeigt Business.' },
        { bereich: 'business', text: 'Die Säule „Fulfillment“ im Business-Score heißt jetzt „Prozesse“.' },
        { bereich: 'business', text: 'Werkstatt: bei Warten-Schritten stehen „Höchstens (Stunden)“ und „Arbeitszeit zählen“ jetzt im Panel, bei Entscheidungen „Entscheiden binnen (Tagen)“ — so lässt sich an übernommenen Vorlagen jeder Wert ändern.' },
        { bereich: 'business', text: 'Event-Nachfassen „48 Stunden“ heißt überall zwei Werktage; „keine Entscheidung“ ist ein eigener Verlustgrund.' },
        { bereich: 'business', text: 'Anrechnung (z. B. eines Workshops auf das Mandat): angerechnet wird alles inklusive gewählter Optionen; was in den ersten Monat nicht passt, wandert auf die nächsten Rechnungen — Liquidität rechnet genauso.' },
        { bereich: 'business', text: 'Tages- und Stundensätze planen mit einer Menge je Monat; abgerechnet werden die echten Stunden bzw. Tage.' },
        { bereich: 'business', text: '„Höchstens N gleichzeitig“: beim nächsten Mandat warnt MAKE OS „alle Plätze belegt“ — anlegen geht trotzdem.' },
        { bereich: 'business', text: 'Nach einem neuen Mandat mit Ablauf fragt MAKE OS „Kundenonboarding jetzt starten?“.' },
        { bereich: 'business', text: 'Das Angebot übernimmt alle Preise eines Produkts als Positionen, Optionen hakt ihr an; es heißt nach Firma und Produkt, und der Deal folgt dem angenommenen Angebot.' },
        { bereich: 'business', text: 'Die Rechnungsanschrift wird an der Firma gespeichert.' },
        { bereich: 'alle', text: 'Abgeleitete Ziele (Quartal, Monat, Woche) ziehen ihren Fortschritt wieder mit dem Jahresziel mit.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'business', text: 'Ein neuer Fall zeigt keine Phase mehr fälschlich als „erledigt“; was nebenher läuft, heißt „läuft“.' },
        { bereich: 'business', text: 'Ein Konto „nur Business“ sieht den Produktkatalog in der Planung.' },
        { bereich: 'business', text: 'Der Lieferumfang verdoppelt sich nicht mehr, und ein getippter Punkt geht beim Schließen nicht verloren.' },
        { bereich: 'business', text: 'Liquidität: Ein Monat mit gestellter Rechnung zählt nicht mehr doppelt (Rechnung und Planposten).' },
      ] },
    ],
  },
  {
    // Kennung/Datum vorläufig: das nächste Update (Datum beim Hochladen eintragen, danach nie mehr ändern).
    id: 'u-2026-10-18-2',
    datum: '2026-10-18',
    titel: 'Kleine Verbesserungen',
    kurz: 'Die ZOE-Kugel ist wieder immer sichtbar, und die Suche nach freier Zeit kennt auch Termine aus der eigenen iCloud-Verbindung.',
    abschnitte: [
      { art: 'besser', punkte: [
        { bereich: 'alle', text: 'Die ZOE-Kugel ist wieder immer sichtbar und verdeckt trotzdem keine Knöpfe.' },
        { bereich: 'alle', text: 'Bei der Suche nach freier Zeit zählen auch Termine aus der eigenen iCloud-Verbindung.' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-18',
    datum: '2026-10-18',
    titel: 'Das große Herbst-Update',
    kurz: 'Fulfillment für eure Kunden, ein neuer Kalender, Routinen 2.0, mehr Gesundheit und viele Verbesserungen — und ab jetzt nach jedem Update diese Übersicht.',
    kurzBusiness: 'Fulfillment für eure Kunden, ein neuer Kalender, Rechnungen aus dem Mandat und viele Verbesserungen — und ab jetzt nach jedem Update diese Übersicht.',
    abschnitte: [
      { art: 'neu', punkte: [
        { bereich: 'alle', text: 'Was ist neu: Nach jedem Update zeigt MAKE OS einmal, was dazugekommen ist. Alles steht dauerhaft unter Einstellungen › Was ist neu.', weg: '/os/neuigkeiten' },
        { bereich: 'business', text: 'Fulfillment unter Produkte & Mandate: Abläufe selbst bauen wie auf einem Whiteboard (Schritt, Nachricht, Entscheidung, Erinnerung, Termin, Bestätigung). Jeder neue Kunde bekommt seinen Fall mit „Sie sind hier“.', weg: WEG.fulfillment() },
        { bereich: 'business', text: 'Onboarding je Kunde: Willkommensmail in 24 Stunden, Kick-off, Ansprechpartner, Ziele mit Ausgangslage — danach legt der Ablauf die Aufgaben mit Fristen selbst an.', weg: WEG.fulfillment('onboarding') },
        { bereich: 'business', text: 'Kunden-Seite und Report alle zwei Wochen: was erledigt ist, was als Nächstes kommt und worauf wir beim Kunden warten.' },
        { bereich: 'business', text: 'Leistungstreppe: Fortschritt, Ampel und nächster Schritt je Kunde auf einen Blick.', weg: '/os/mandate' },
        { bereich: 'business', text: 'Monatsrechnung direkt aus dem Mandat — angefangene Monate werden anteilig berechnet, die Liquidität rechnet genauso.', weg: WEG.rechnungen() },
        { bereich: 'business', text: 'Markttraktion › Planung: vom Umsatzziel rückwärts zu den Aktivitäten je Woche, mit Wochen-Scoreboard.', weg: '/os/markttraktion?s=planung' },
        { bereich: 'business', text: 'Unternehmen: Beschluss-Buch, Satzungsstand, Pflichten-Kalender und ein wöchentlicher Recht-Check.', weg: WEG.unternehmen() },
        { bereich: 'alle', text: 'Heute: die Top 3 des Tages und ein kurzes Tages-Briefing.', weg: WEG.heute() },
        { bereich: 'alle', text: 'Kalender wie Google: volle Höhe, Sprung auf „jetzt“, mehrtägige Aufgaben als ein Balken, am Handy Tag und drei Tage.', weg: WEG.kalender() },
        { bereich: 'privat', text: 'Routinen 2.0: x-mal pro Woche, alle paar Tage, mehrmals täglich — mit Zähler („5 von 8“) und Pause, ohne dass die Serie verloren geht.', weg: WEG.routinen() },
        { bereich: 'privat', text: 'Gesundheit: Erholung (Programme und Behandlungen), Schlaf-Hilfe, Tages-Check und euer Training auf einen Blick.', weg: WEG.gesundheit() },
        { bereich: 'privat', text: 'Ziele: „Unsere“, „Meine“ und eigene Meilensteine an den eigenen Zielen.', weg: '/os/planung' },
        { bereich: 'alle', text: 'Inbox: Suche, Übergeben an die andere Person und Aufgaben-Vorschläge aus Mails.', weg: WEG.inbox() },
        { bereich: 'alle', text: 'Erklärungen an allen Einstellungen — einfach die Zeile antippen.', weg: '/os/system' },
      ] },
      { art: 'besser', punkte: [
        { bereich: 'alle', text: 'Zweiter Faktor: „Gerät merken“ — der Code wird auf einem Gerät nur noch alle 90 Tage abgefragt.', weg: WEG.konto() },
        { bereich: 'alle', text: 'Brain-Kugel: zoomen, drehen und verschieben.', weg: WEG.wissen() },
        { bereich: 'alle', text: 'Die Zahlen passen überall zusammen — Index, Cockpit, Liquidität und Planung rechnen mit denselben Werten.' },
        { bereich: 'business', text: '„Mandat beenden“ fragt nach dem Enddatum, warnt bei Mindestlaufzeit und beendet die Zahlungen in der Liquidität im selben Schritt.' },
        { bereich: 'alle', text: 'Die ZOE-Kugel weicht beim Lesen aus, damit sie keine Knöpfe mehr verdeckt.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'alle', text: 'Ein Konto „nur Business“ sieht nirgends private Termine, Aufgaben oder Ziele — auch nicht über Heute, die Glocke oder ZOE.' },
        { bereich: 'business', text: 'Ein beendetes Mandat zählt in der Liquidität nicht mehr mit, und Beträge werden auf den Cent gerechnet.', weg: WEG.liquiditaet() },
        { bereich: 'alle', text: 'Viele kleine Texte, Zahlen und Darstellungen am Handy.' },
      ] },
    ],
  },
];

const ZEICHEN_MAX = 400;
/** Nur Adressen innerhalb der App (keine fremden Ziele aus Daten). */
export const wegGueltig = (w: unknown): w is string => typeof w === 'string' && w.length <= 300 && /^\/os(\/|\?|#|$)/.test(w);

/**
 * Die Updates für ein Konto (rein): ein Konto „nur Business“ bekommt keine Privat-Punkte und die Business-Fassung des Kurztexts; leere
 * Abschnitte fallen weg, Updates ohne Punkt ebenso. `null` (unbekannt) = wie „nur Business“ (lieber ein Punkt zu wenig).
 */
export function neuigkeitenFuer(liste: readonly Neuigkeit[], k: { nurBusiness: boolean | null }): Neuigkeit[] {
  const nurBusiness = k.nurBusiness !== false;
  return liste.map(n => {
    const abschnitte = n.abschnitte
      .map(a => ({ art: a.art, punkte: a.punkte.filter(p => !(nurBusiness && p.bereich === 'privat')).map(p => ({ text: p.text.slice(0, ZEICHEN_MAX), bereich: p.bereich, ...(wegGueltig(p.weg) ? { weg: p.weg } : {}) })) }))
      .filter(a => a.punkte.length);
    const { kurzBusiness, ...rest } = n;
    return { ...rest, kurz: nurBusiness && kurzBusiness ? kurzBusiness : n.kurz, abschnitte };
  }).filter(n => n.abschnitte.length);
}

/**
 * Welche Updates hat die Person noch nicht gesehen? (rein) — alle, die NACH dem zuletzt gesehenen kommen (Reihenfolge der Liste). Hat sie noch
 * nie eins gesehen, nur Updates nach dem Tag, an dem ihr Konto angelegt wurde (wer neu dazukommt, bekommt den Willkommensgruß, nicht die
 * Geschichte von vorher). Ohne bekanntes Anlagedatum: alle.
 */
export function ungelesene(liste: readonly Neuigkeit[], gesehen: string | null, angelegtTag?: string | null): Neuigkeit[] {
  if (gesehen) {
    const i = liste.findIndex(n => n.id === gesehen);
    if (i >= 0) return liste.slice(0, i);
  }
  return angelegtTag ? liste.filter(n => n.datum > angelegtTag) : [...liste];
}

/** Ist das eine Kennung aus der Liste? */
export const istNeuigkeit = (id: unknown): id is string => typeof id === 'string' && NEUIGKEITEN.some(n => n.id === id);
