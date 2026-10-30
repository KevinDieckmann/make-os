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
    id: 'u-2026-10-31-7',
    datum: '2026-10-31',
    titel: 'Mehr Seiten selbst anpassen',
    kurz: 'Auf weiteren Seiten ordnest du die Karten jetzt selbst: oben rechts „✎ Anpassen“ oder eine Karte länger gedrückt halten — verschieben, Breite wählen, ausblenden. Das Anpassen geht schneller und merkt sich alles.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Sport: alle Reiter — Ziele & Plan, Training, Hyrox, Running, Gym und Erholung — sind anpassbar.', bereich: 'privat', weg: WEG.sport() },
        { text: 'Finanzen › Privat › Überblick: Privat-Index, Für dich, Dieser Monat, Wichtig diese Woche und Größte Ausgaben als Karten zum Anordnen.', bereich: 'privat', weg: WEG.privat() },
        { text: 'Finanzen › Business › Controlling & Ziele: die Karten lassen sich anordnen und ausblenden.', bereich: 'business', weg: WEG.controlling() },
        { text: 'Aufgaben › Überblick: Für dich, die Zahlen und die Bereiche Privat, Firmen und Mandanten — je Sicht (alles, Privat, Business) eigens gemerkt.', bereich: 'alle', weg: WEG.aufgaben() },
        { text: 'Planung › Tag, Monat, Quartal und Jahr: Fokus, Strahl, Forecast, Ziele & Meilensteine und Fälliges als Karten zum Anordnen.', bereich: 'alle', weg: WEG.jahr() },
      ] },
      { art: 'besser', punkte: [
        { text: 'Anpassen geht flüssiger: beim Ziehen und Breite-Wählen zeichnen sich nur die betroffenen Karten neu, große Karten springen nicht mehr hin und her, und beim Zurückkommen steht deine Anordnung sofort da.', bereich: 'alle' },
        { text: 'Karten, die nur manchmal erscheinen, behalten ihren Platz und bleiben ausgeblendet, auch wenn du in der Zwischenzeit etwas anderes verschoben hast.', bereich: 'alle' },
        { text: 'Gesundheit: Schlaf, Körperwerte und die Karten der eigenen Ansicht verlieren beim Anpassen ihren Platz nicht mehr — auch nicht, wenn du zwischendurch die geteilte Ansicht der anderen Person angepasst hast.', bereich: 'privat', weg: WEG.gesundheit() },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-5',
    datum: '2026-10-31',
    titel: 'Akten öffnen groß',
    kurz: 'Ein Klick auf einen Kontakt, eine Firma, ein Mandat oder einen Deal öffnet jetzt die ganze Akte auf einer eigenen, breiten Seite. „‹ Zurück“ bringt dich genau dorthin in der Liste, wo du warst.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Firmenakte: jede Firma auf einer eigenen Seite — Rolle, BEAN, Mutter und Töchter, Lead, Personen, Deals und Mandate, Umsatz und Rechnungen, Dateien, Termine, Aufgaben, Verlauf und ZOE-Vorschläge, alles bearbeitbar.', bereich: 'business', weg: WEG.firma() },
        { text: 'Mandatsakte: das Mandat breit in zwei Spalten — mit Kreislauf, Zuständig, Fulfillment, Status, Zusatzmodulen, Zeit, Terminen und Rechnungen.', bereich: 'business', weg: WEG.mandat() },
      ] },
      { art: 'besser', punkte: [
        { text: 'Kontakte: ein Klick (oder Enter) öffnet direkt „Kontakt öffnen“ statt der schmalen Karte rechts — die Liste nutzt die ganze Breite.', bereich: 'business', weg: WEG.kontakt() },
        { text: 'Deals › Liste: ein Klick öffnet die Deal-Akte; rechts bleibt die Prognose.', bereich: 'business', weg: WEG.deals() },
        { text: 'Alte Links auf eine Person, Firma oder ein Mandat (aus Meldungen, Aufgaben, Brain) öffnen dieselbe Akte.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-3',
    datum: '2026-10-31',
    titel: 'Neue Farben für Privat und Business',
    kurz: 'Business trägt jetzt ein Lila, Privat ein warmes Terrakotta. So siehst du auf einen Blick, in welchem Bereich du gerade bist.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Business ist jetzt Lila: Schalter oben, linke Leiste, Symbole und Kennzeichen der Firmen-Bereiche.', bereich: 'business' },
        { text: 'Privat ist jetzt warmes Terrakotta statt des leisen Golds.', bereich: 'privat' },
        { text: 'Du siehst immer, wo du bist: Der gewählte Reiter, Filter oder Menüpunkt trägt einen deutlichen Ring in der Farbe des Bereichs.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-4',
    datum: '2026-10-31',
    titel: 'Rechnungen hängen immer an einem Kunden der Markttraktion',
    kurz: 'Eine Rechnung geht nur noch raus, wenn sie einer Firma, Person oder einem Mandat aus der Markttraktion zugeordnet ist. Im Editor suchst du den Kunden direkt oben — oder legst ihn dort neu an.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Rechnung schreiben: Oben im Empfänger steht die Suche nach dem Kunden (Firmen und Personen, mit Ort). „Rechnung stellen“ geht erst, wenn er zugeordnet ist — frei getippte Felder reichen nicht.', bereich: 'alle' },
        { text: 'Unbekannter Kunde: „Neu in der Markttraktion anlegen“ direkt im Editor — die Rechnung ist danach gleich zugeordnet.', bereich: 'alle' },
        { text: 'Rechnungsliste: je Zeile der zugeordnete Kunde, die Suche findet auch Firma und Person, neuer Filter „Ohne Zuordnung“.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Ältere Rechnungen ohne Kunden: einmal zuordnen (die Rechnung selbst bleibt unverändert), dann lassen sie sich versenden und mahnen. Stornieren geht wie bisher.', bereich: 'alle' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Kontakt › Umsatz: Rechnungen erscheinen jetzt über ihren zugeordneten Kunden — auch die Rechnungen der Einheiten unter Privat, gekennzeichnet mit „Privat“. Konten „nur Business“ sehen sie nie.', bereich: 'privat' },
        { text: 'Kontakt › Umsatz: Konten „nur Business“ sehen dort jetzt die Rechnungen der Business-Gesellschaften.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31',
    datum: '2026-10-31',
    titel: 'Firmen, Deals, Angebote und Mandate: klarer aufgeteilt',
    kurz: 'Firmen, die Liste der Deals, Angebote und Mandate sind aufgebaut wie Inbox und Kontakte: oben eine Zeile mit Titel und Aktion, darunter Suche und Filter in einer Reihe, dann Liste und Detail nebeneinander — jede Seite scrollt für sich.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Firmen: Die Firmenliste ist die ganze Seite, die Firmenkarte steht rechts daneben. Rollen, Archiv und Papierkorb findest du hinter „Filter“, die Zielliste hinter „⋯“.', bereich: 'business', weg: WEG.firma() },
        { text: 'Deals › Liste: Die Stufen sind Abschnitte einer Liste. Rechts steht der gewählte Deal, ohne Auswahl die Prognose. Neu: eine Suche über Deal, Firma und Person.', bereich: 'business', weg: '/os/markttraktion?s=deals&a=liste' },
        { text: 'Angebote: Status und Gesellschaft stehen hinter „Filter“ statt in zwei Reihen. „+ Neuer Kunde“ findest du hinter „⋯“ neben „+ Neues Angebot“.', bereich: 'business', weg: WEG.angebot() },
        { text: 'Mandate: Die Mandate stehen nach Status gruppiert, rechts das gewählte Mandat bzw. der Überblick. Gesellschaft und „Beendete zeigen“ hinter „Filter“, der Excel-Import und der Papierkorb hinter „⋯“.', bereich: 'business', weg: WEG.mandat() },
        { text: 'Linke Leiste: Die Oberthemen eines Bereichs (z. B. in der Markttraktion CRM, Vertrieb, Marketing, Steuerung) lassen sich per Klick zuklappen. Die Gruppe, in der du gerade bist, bleibt offen; dein Browser merkt sich, was zu ist.', bereich: 'business' },
        { text: 'Linke Leiste: Jedes Symbol steht jetzt in einer kleinen Kachel in der Farbe des Bereichs, wie das Symbol des Bereichs oben. Der Punkt, auf dem du bist, leuchtet kräftiger.', bereich: 'business' },
        { text: 'Rechnung schreiben unter Business: Einheiten, die zu Privat gehören, stehen dort nicht als Absender. Ein Hinweis mit Link führt jetzt direkt zu Privat › Konten & Buchungen, wo du ihre Rechnungen schreibst.', bereich: 'business', weg: WEG.buchungen({ privat: true }) },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-2',
    datum: '2026-10-31',
    titel: 'Weitere Kalender gegen Doppelbuchungen',
    kurz: 'Wer auch für andere Firmen arbeitet, verbindet dort seinen Google-Kalender zusätzlich. MAKE OS liest ihn nur mit — belegte Zeiten zählen dann hier als belegt.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Kalender › Einstellungen › Weitere Kalender: bis zu fünf weitere Google-Konten verbinden, Kalender wählen, eine eigene Bezeichnung geben. MAKE OS schreibt dort nie etwas hinein.', bereich: 'business', weg: '/os/kalender?einstellungen=1' },
        { text: 'Termine dieser Kalender zählen als belegt: freie Zeiten, Buchungsseiten und die Planung rechnen damit. Andere sehen davon nur „Belegt“.', bereich: 'business' },
        { text: 'Beim Anlegen eines Termins kommt ein Hinweis, wenn er sich mit einem Termin dort überschneidet — speichern könnt ihr trotzdem.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-30-3',
    datum: '2026-10-30',
    titel: 'Social: Beiträge planen, schneiden und veröffentlichen',
    kurz: 'Unter Markttraktion › Marketing gibt es jetzt Social: Kanäle und Beiträge im Kalender planen, Reels aus eigenen Clips schneiden, Freigegebenes zum Termin veröffentlichen und Kommentare mit Vorschlägen beantworten.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Social unter Marketing: Kanäle mit Zielen, Beiträge mit Text, Beschriftung und Fotos oder Videos aus der Medien-Ablage. Vor jedem Beitrag sagt eine Prüfung, ob er raus darf.', bereich: 'business', weg: WEG.marketing('social') },
        { text: 'Kalender für Woche und Monat: Beiträge mit ihrem Zustand, freie Plätze des Redaktionsplans, Umplanen per Ziehen und „Ohne Termin“ zum Einplanen.', bereich: 'business' },
        { text: 'Automatik: Ein Redaktions-Agent bereitet Beiträge für die freien Termine vor. Was freigegeben ist, geht zum Termin raus. Der Not-Aus im Kanal hält alles an.', bereich: 'business' },
        { text: 'Reel-Werkstatt: Clips und Fotos schneiden, Untertitel erzeugen und korrigieren, Einblendungen setzen. Auf Wunsch werden neue Videos eines Albums von selbst zu Reel-Entwürfen. Raus geht ein Reel erst nach Freigabe.', bereich: 'business' },
        { text: 'Kommentare und Nachrichten: ZOE schlägt Antworten vor, ihr antwortet per Klick. Auf Wunsch antwortet ZOE auf einfache Fragen selbst, mit Tageslimit und KI-Hinweis.', bereich: 'business' },
        { text: 'Zahlen aus den Plattformen übernehmen und auswerten: welche Beiträge wirken und welche Tage und Uhrzeiten am besten laufen.', bereich: 'business' },
        { text: 'Veröffentlichen braucht eine Verbindung zum Konto: unter Automatik „Mit LinkedIn verbinden“ bzw. „Mit Instagram verbinden“, sobald die Einrichtung dafür gemacht ist.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-30-2',
    datum: '2026-10-30',
    titel: 'Angebot, Mandat, Rechnung, Lieferung: ein Kreislauf',
    kurz: 'Ein angenommenes Angebot legt das Mandat samt Liquiditätsposten selbst an, fällige Raten und Monatsrechnungen liegen morgens als Entwurf zum Prüfen bereit, und ein beendetes Mandat schließt seinen Fall. Die Mandatsakte zeigt den ganzen Weg auf einer Linie.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Angebot angenommen: Mandat und Posten in der Liquidität entstehen automatisch — mit „Rückgängig“, solange es noch keine Rechnung und keinen Fall gibt. Den Fall startest du weiter selbst (Vorschlag).', bereich: 'business' },
        { text: 'Fällige Raten und Monatsrechnungen: der Morgenlauf legt den Rechnungsentwurf an und eine Aufgabe „Rechnung prüfen & stellen“. Stellen bleibt dein Klick. Startet ab dem nächsten Monat, nie für alte Monate.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Mandat beendet: der Fall wird abgeschlossen, offene Schritte enden — Nachsorge und Verlängerung laufen weiter.', bereich: 'business' },
        { text: 'Mandatsakte: eine Zeitleiste von Angebot über Mandat und Raten bis bezahlt, mit der aktuellen Phase und dem nächsten Schritt in einem Satz.', bereich: 'business' },
        { text: 'Bei Produkte & Mandate, Finanzen und Markttraktion zeigt eine Karte, was heute von selbst erledigt wurde; die Prozess-Landkarte zeigt auch für eigene Prozesse offene und fertige Fälle.', bereich: 'business' },
        { text: 'Kontoauszug: nach dem Übernehmen schlägt MAKE OS passende Rechnungen vor — „Als bezahlt vermerken“ mit einem Klick.', bereich: 'business' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Bezahlt oder storniert schließt die Mahnaufgabe der Rechnung von selbst.', bereich: 'business' },
        { text: 'Ein Fall startet immer mit dem Ablauf des Produkts — egal ob aus dem Vorschlag, dem Morgenlauf oder einem Prozess.', bereich: 'business' },
        { text: 'Werkstatt: ein Warte-Schritt kann auf eines von mehreren Ereignissen warten; Prozesse können Rechnungen entwerfen und stellen sowie Angebote stellen (immer erst nach Freigabe).', bereich: 'business' },
        { text: 'Liquidität zeigt, welche Mandate noch nicht im Liquiplan stehen; Raten nach dem Mandatsende fehlen dort nicht mehr.', bereich: 'business' },
      ] },
      { art: 'behoben', punkte: [
        { text: 'Zu einem Angebot mit Mandat entsteht keine zweite Rechnung über alle Positionen mehr.', bereich: 'business' },
        { text: 'Vorlage „Gewonnen → Kickoff“: der Ablauf endet nicht mehr vor „Fall starten“. Wer die Vorlage schon übernommen hat, übernimmt sie einmal neu.', bereich: 'business' },
        { text: '„Angebot nachfassen“ endet, sobald das Angebot entschieden ist — keine Erinnerung an ein schon angenommenes Angebot.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-30',
    datum: '2026-10-30',
    titel: 'Inbox und Kontakte: klarer aufgeteilt',
    kurz: 'Inbox und Kontakte nutzen den Bildschirm jetzt ganz: oben eine Zeile mit Titel und Aktion, darunter Suche und Filter in einer Reihe, dann Liste und Detail nebeneinander — jede Seite scrollt für sich, die Seite selbst nicht mehr.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Inbox: Liste und Gespräch füllen die Höhe, die Fächer sind Abschnitte einer Liste. Ohne offenes Gespräch steht rechts das Lagebild.', bereich: 'alle', weg: '/os/inbox' },
        { text: 'Inbox: Der Mailtext steht voll im Gespräch, ohne kleinen Scrollkasten. Die Spalte mit Kontakt und Deal erscheint nur, wenn genug Platz ist — sonst unten zum Aufklappen.', bereich: 'alle' },
        { text: 'Inbox: Postfächer und „Jetzt abgleichen“ stehen hinter „⋯“ oben rechts; weitere Filter hinter „Filter“.', bereich: 'alle' },
        { text: 'Kontakte: Die Kartei ist die ganze Seite. Suche, „Wer“ und ein Knopf „Filter“ stehen in einer Zeile; aktive Filter siehst du als Chips und entfernst sie mit ✕.', bereich: 'business' },
        { text: 'Kontakte: Runden, „+ Aktivität“ und „+ Angebot“ stehen hinter „⋯“ neben „+ Person“.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-29',
    datum: '2026-10-29',
    titel: 'Innovations-Check für die Website',
    kurz: 'Besucher der Website können einen Innovations-Check machen: Fragen beantworten, Stufe sofort sehen, Termin buchen. Der Check kommt ausgeschaltet — einschalten unter Markttraktion › Marketing › Innovations-Check.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Innovations-Check: eine öffentliche Fragenstrecke mit Ergebnis und Stufe. Wer seine Kontaktdaten angibt, steht danach als Lead in der Kartei.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Ein- und ausschalten, Buchungsseite für das Gespräch wählen und den Namen festlegen, der im Check steht — alles an einer Stelle unter Marketing.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Antworten mit Belegen bewertest du nach einer festen Rubrik; die Stufe rechnet danach neu.', bereich: 'business' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Check und Terminbuchung sind auch über die Adresse der Website erreichbar, ohne dass Besucher die Software sehen.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-27',
    datum: '2026-10-27',
    titel: 'Rechnungen: der ganze Kreislauf an einer Stelle',
    kurz: 'Alle Rechnungen stehen in einer Übersicht mit Filter, Suche und Summen. Den Zahlungseingang vermerkst du direkt in der Rechnung, eine stornierte Rechnung kopierst du als korrigierte — und freie Rechnungen holen Kunden aus der Kartei und Positionen aus Produkten.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Eine Übersicht aller Rechnungen: offen, überfällig, bezahlt im Jahr und Entwürfe als Zahlen oben, darunter Filter, Suche und die ganze Liste.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Zahlungseingang direkt in der Rechnung vermerken — die Buchung entsteht dabei mit.', bereich: 'business' },
        { text: 'Freie Rechnung: Kunde aus der Kartei wählen (Anschrift und Zahlungsziel kommen mit) und Positionen aus einem Produkt einfügen — oder alles frei schreiben.', bereich: 'business' },
        { text: 'Rechnung kopieren: als Vorlage für den nächsten Zeitraum oder nach einem Storno als korrigierte Rechnung.', bereich: 'business' },
        { text: 'Die Rechnungen der Selbstständigkeit stehen jetzt unter Privat › Konten & Buchungen bei der Selbstständigkeit — nicht mehr in der Business-Liste.', bereich: 'privat' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Nach dem Stellen direkt über das eigene Postfach senden, mit dem PDF als Anhang.', bereich: 'business' },
        { text: 'Die Rechnung zeigt, woher sie kommt: Angebot, Mandat, Firma oder Kontakt. Die Angebotsnummer steht im PDF.', bereich: 'business' },
        { text: 'Ein geleertes Zahlungsziel nimmt die Vorgabe der Gesellschaft statt 0 Tagen.', bereich: 'business' },
      ] },
      { art: 'behoben', punkte: [
        { text: 'Aus einem Angebot entsteht nach dem Stellen keine zweite volle Rechnung mehr.', bereich: 'business' },
        { text: 'Ein Entwurf kann nicht mehr als bezahlt markiert werden, ohne gestellt zu sein; das Datum des Eingangs liegt nie in der Zukunft.', bereich: 'business' },
        { text: 'Eine Position ohne Bezeichnung geht beim Speichern nicht mehr verloren, und ein Entwurf ohne Positionen zählt nicht mehr mit dem alten Betrag.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-26-3',
    datum: '2026-10-26',
    titel: 'Lieferzeit ab Formular und echte Korrekturschleifen',
    kurz: 'Die Lieferzeit startet, sobald das Formular vollständig ist — das Lieferdatum steht im Fall und in der Mail. Korrekturschleifen laufen als echte Runden, und ein Ablauf kann an einer Stelle enden oder über Phasen springen.',
    abschnitte: [
      { art: 'neu', punkte: [
        { bereich: 'business', text: 'Ein Schritt im Ablauf kann „Lieferzeit startet hier“ tragen (Werktage). Ist er erledigt, steht oben im Fall „Lieferung bis …“ — kommt das Formular später, verschiebt sich das Datum von selbst.' },
        { bereich: 'business', text: 'Mails im Ablauf kennen {{fall.lieferdatum}} und {{fall.lieferzeit}}: „Geplante Lieferung: Montag, 9. November 2026“ statt „[von Hand: Datum]“, „Lieferzeit (10 Werktage)“.' },
        { bereich: 'business', text: 'Korrekturschleife: bei „Korrekturen abgeschlossen? — nein“ laufen „Korrekturen sammeln“ und „umsetzen“ noch einmal, mit eigener Aufgabe je Runde („Runde 2“). Sind alle inklusiven Schleifen genutzt, wird die Entscheidung rot.' },
        { bereich: 'business', text: 'Im Paket: „Danach — Ablauf endet hier“ bzw. „weiter bei …“ (auch in eine spätere Phase); an einer Entscheidung „Wenn nein, noch einmal ab …“.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'business', text: 'Mit einer Laufzeit von 6 Monaten (Folgeangebot statt Verlängerung) liefen die Schritte der Verlängerung nicht mehr unnötig an — der Ablauf endet nach dem Folgeangebot (mit der neuen Ablauf-Datei).' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-26-2',
    datum: '2026-10-26',
    titel: 'Rechnungen nach Raten und Anzahlung',
    kurz: 'Steht im Angebot eine Ratenzahlung oder Anzahlung, übernimmt das Mandat sie: die Rechnungen heißen „Rate 1 von 6“ bzw. Anzahlung und Rest, die Liquidität plant dieselben Beträge.',
    abschnitte: [
      { art: 'neu', punkte: [
        { bereich: 'business', text: 'Mandat aus einem angenommenen Angebot mit Raten: am Mandat steht „6 Raten (monatlich)“, der Knopf heißt „Rate 1 von 6 schreiben“ — jede Rate eine eigene Rechnung, gleich große Beträge auf den Cent.' },
        { bereich: 'business', text: 'Anzahlung aus dem Angebot (z. B. 30 %): erste Rechnung die Anzahlung, die zweite den Rest — dazwischen entsteht keine leere Rechnung mehr.' },
        { bereich: 'business', text: 'Ein eigener Satz zur Zahlung im Angebot steht am Mandat als offener Punkt, damit ihr die Rechnungen danach schreibt.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'business', text: 'Zahlung anpassen im Angebot: die Anzahl der Raten lässt sich frei eintippen (2 bis 12) — das Feld springt nicht mehr. Was nicht passt, wird nicht gespeichert, und das Angebot lässt sich dann nicht stellen.' },
        { bereich: 'business', text: 'Raten und Anzahlung stehen im Angebot netto (zzgl. USt) — genau wie auf den Rechnungen.' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-26',
    datum: '2026-10-26',
    titel: 'Angebote: Raten, Standardtext, PDF und Gmail-Entwurf',
    kurz: 'Angebote schreiben geht jetzt runder: Zahlung in Raten oder mit Anzahlung, ein Standardtext, das Angebot vorher als PDF ansehen und die Mail mit PDF als Entwurf in eurem Gmail.',
    abschnitte: [
      { art: 'neu', punkte: [
        { bereich: 'business', text: 'Zahlung anpassen: unter den Positionen „Zahlung anpassen“ — in Raten, mit Anzahlung und Rest oder als eigener Satz. Die Beträge rechnet das Angebot auf den Cent, der Satz steht im PDF.', weg: WEG.angebot() },
        { bereich: 'business', text: 'Standardtext: unter „Rahmen“ wählt ihr zwischen dem Text des Produkts und einem neutralen Satz („Vielen Dank für Ihr Interesse … unverbindliches Angebot“).' },
        { bereich: 'business', text: '„Angebot ansehen & herunterladen“: erst als Entwurf-PDF ansehen (ohne Nummer, nichts wird festgeschrieben), dann stellen — die Mail mit dem PDF liegt danach als Entwurf in eurem Gmail und geht von dort raus.' },
        { bereich: 'business', text: '„+ Neuer Kunde“ neben „+ Neues Angebot“: jemand ist noch nicht im System? Direkt anlegen und das Angebot für ihn schreiben.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'business', text: 'Der Firmenname aus dem Produkttext steht jetzt richtig im Titel und in den Positionen — kein „{{firma.name}}“ mehr im PDF. Steht noch „[von Hand: …]“ im Text, weist das Angebot vor dem Stellen darauf hin.' },
        { bereich: 'alle', text: 'Kontakt anlegen: was der Browser selbst ausfüllt (Name, E-Mail), wird jetzt sicher übernommen.' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-25',
    datum: '2026-10-25',
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
        { bereich: 'business', text: 'Auch Power Hour, Event-Nachfassen und Übergabe lassen sich überführen. Neu ist der Auslöser „je Person ab Uhrzeit“: einmal am Tag je Person, Business-frei kommt er danach. Was der alte Weg nicht tat — Follow-ups nach dem Event, Mandat-Vorschlag und Übergabe-Aufgabe nach „Deal gewonnen“ —, steht im Band als „Neu gegenüber dem alten Weg“ und zählt im Schatten nur mit.', weg: WEG.prozesse() },
        { bereich: 'business', text: 'Stellschrauben mit Masken: im Steckbrief ändert ihr MQL-/SQL-Schwelle und Temperatur des Scorings, je Buchungsseite An/aus, Dauer, Vorlauf, Termine je Tag und Puffer und — als Inhaber — An/aus, Modell, Budget und Autonomie der Heads. Playbooks und Event-Vorlagen lassen sich bearbeiten, kopieren und auf Standard zurücksetzen; Rechtshinweise bleiben fest.', weg: WEG.vorlagenBearbeiten('playbook') },
        { bereich: 'alle', text: 'Oben auf „Heute“ steht der Score eures Bereichs: unter Privat der Privat-Score (je Person), unter Business der Business-Score. Antippen öffnet Säulen, Kennzahlen und den größten Hebel.' },
        { bereich: 'business', text: 'Die Leistungstreppe ist jetzt euer Katalog: Stufen von links nach rechts, Alternativen übereinander, je Produkt Preis, Kunden und freie Plätze.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Produkte geführt anlegen: Name, Art, Preis, Gesellschaft und ein Satz — danach öffnet sich die Karte mit allen Einzelheiten.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Preise kombinierbar: einmalig, monatlich, jährlich, je Event, Tages- oder Stundensatz, Erfolgsanteil — mit Anzahlung, Kontingent oder Deckel.' },
        { bereich: 'business', text: 'Vertrag und Regeln am Produkt: Mindestlaufzeit, Kündigung, Anrechnung auf ein anderes Produkt, höchstens N Kunden gleichzeitig, inklusive Leistungen.' },
        { bereich: 'business', text: 'Mandat aus dem Produkt: Honorar, Laufzeit, Gesellschaft und Leistungen kommen mit — dazu Zusatzmodule, die Rechnung, Liquidität und Fall mitrechnen.', weg: WEG.mandat() },
        { bereich: 'business', text: 'Produkte importieren: aus einer Tabelle oder Datei, mit Vorschau „neu · ändert · gleich“ — erst „Übernehmen“ schreibt.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Kombinierte Preise bis ins Mandat: der laufende Preis wird das Honorar, jeder weitere Teil — etwa Festpreis oder Tagessatz — ein Zusatzmodul. Rechnung, Liquidität und Planung rechnen alle Teile.', weg: WEG.produkt() },
        { bereich: 'business', text: 'Angebot je Preis-Teil: jeder Teil eine eigene Position, Tagessätze „je Tag“ mit der geplanten Menge; der Deal trennt laufend und einmalig.' },
        { bereich: 'business', text: '„Mandat anlegen“ öffnet erst ein Fenster: Honorar, Zusatzmodule und Laufzeit zum Prüfen, Start wählbar — Vorgabe ist der Erste des nächsten Monats. Überall gleich: am Deal, am Angebot, im Fulfillment, über ZOE und bei „+ Mandat“.', weg: WEG.mandat() },
        { bereich: 'business', text: 'Die erste Rechnung kennt Anzahlung und Tagessatz; „Rechnung stellen“ fragt vorher, und die Fälligkeit ist der Zahltag im Liquiplan.' },
        { bereich: 'business', text: 'Formular „Angebot anfordern“ unter Markttraktion › Formulare: Kunde suchen oder neu anlegen, Produkte wählen — Kunde, Deal und Angebot entstehen in einem Schritt. Stimmen Listenpreis, Adresse und Datenschutz, geht das Angebot mit PDF aus eurem Postfach raus, sonst liegt es zur Freigabe.', weg: WEG.formulare() },
        { bereich: 'business', text: 'Externe Vertriebler bekommen einen eigenen Link zum Formular — ohne Einblick in eure Kartei, jederzeit widerrufbar.', weg: WEG.formulare() },
        { bereich: 'alle', text: 'Angebote und Rechnungen „Über <Postfach> senden (mit PDF)“: die Mail öffnet sich in der Inbox mit dem PDF im Anhang, ihr klickt nur noch „Senden“; danach steht am Beleg, wann und worüber er raus ist.' },
        { bereich: 'business', text: 'Artikelnummern an Preis-Teilen, Angebot und Rechnung, eine Kundennummer je Firma, das Rechnungsnummer-Format je Gesellschaft und — wenn gewünscht — ein Annahmeblock und der AGB-Link im Angebot.' },
        { bereich: 'business', text: 'Je Produkt eigene Einleitung, Begleit-Mail und Willkommensmail; die Laufzeit (z. B. 6 oder 12 Monate) wählt ihr im Angebot und am Mandat.', weg: WEG.produkt() },
        { bereich: 'privat', text: 'Auch Mandate der Selbstständigkeit bekommen Fulfillment: Fall, Ablauf, Onboarding und Kunden-Link — die Finanzen bleiben unter Privat.' },
        { bereich: 'business', text: 'Ein Fall nutzt den Ablauf seines Produkts aus der Werkstatt: „Fall starten“ belegt ihn vor, die Reise zeigt seine Phasen, und „Fall anlegen“ startet die Abläufe gleich mit.', weg: WEG.fulfillment() },
        { bereich: 'business', text: 'Werkstatt: Entscheidungen mit mehreren Ausgängen, einen Teilprozess direkt an Ort und Stelle anlegen, und „Schritt testen“ zeigt, was er finden würde.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Markttraktion ist ein eigenes Werkzeug wie HubSpot: die Leiste links klappt auf ihr Menü um — Kontakte und Firmen, Vertrieb, Marketing samt Netzwerken, Steuerung mit „Automationen & Head“, unten die Stammdaten. Neu „Auswertung“: der Weg vom Kontakt zum gewonnenen Deal als Lichtfaden, dazu Traktions-Index, Scoreboard, Kanäle und Pipeline. „+ Angebot“ steht in Kontakt-, Firmen- und Deal-Akte.', weg: WEG.auswertung() },
        { bereich: 'alle', text: 'Auch Produkte & Mandate, Unternehmen, Finanzen und Planung sind jetzt Werkzeuge: beim Öffnen klappt die Leiste links auf ihr Menü um (am Handy oben im „Menü“), die Reiterzeilen auf den Seiten sind weg. Je Bereich gibt es „Automationen & Head“ — die Abläufe des Bereichs und sein Head; unter Privat nur, wo es einen Head gibt. Planung › „Woche planen“ öffnet den Kalender.', weg: WEG.jahr() },
        { bereich: 'alle', text: 'Ebenso Kalender, Inbox, Aufgaben, ZOE und die übrigen Bereiche eurer Sicht: die Leiste links klappt auf ihr Menü um (am Handy oben im „Menü“), doppelte Reiterzeilen sind weg. Der Kalender trägt seine Spalte unter dem Menü, die Inbox zeigt ihre Bereiche, die Aufgaben ihre Spaces. „Automationen & Head“ gibt es, wo es Prozesse oder einen Head gibt.', weg: WEG.aufgaben() },
      ] },
      { art: 'besser', punkte: [
        { bereich: 'alle', text: 'Der gemischte Wachstums-Score ist weg — Finanzen zeigt nur noch die Finanzen der Sicht, Privat zeigt Privat und Business zeigt Business.' },
        { bereich: 'business', text: 'Die Säule „Fulfillment“ im Business-Score heißt jetzt „Prozesse“.' },
        { bereich: 'business', text: 'Werkstatt: bei Warten-Schritten stehen „Höchstens (Stunden)“ und „Arbeitszeit zählen“ jetzt im Panel, bei Entscheidungen „Entscheiden binnen (Tagen)“ — so lässt sich an übernommenen Vorlagen jeder Wert ändern.' },
        { bereich: 'business', text: 'Werkstatt: „+“ hängt genau an diesen Ausgang und ändert nie, wohin ein anderer Faden führt; im Panel ist jeder Ausgang wählbar (auch „weiter“), ⌘V fügt lose an der Maus ein, und am Start heißt es jetzt „Auslöser ändern“.', weg: WEG.prozesse({ ansicht: 'werkstatt' }) },
        { bereich: 'business', text: 'Event-Nachfassen „48 Stunden“ heißt überall zwei Werktage; „keine Entscheidung“ ist ein eigener Verlustgrund.' },
        { bereich: 'business', text: 'Anrechnung (z. B. eines Workshops auf das Mandat): angerechnet wird alles inklusive gewählter Optionen; was in den ersten Monat nicht passt, wandert auf die nächsten Rechnungen — Liquidität rechnet genauso.' },
        { bereich: 'business', text: 'Tages- und Stundensätze planen mit einer Menge je Monat; abgerechnet werden die echten Stunden bzw. Tage.' },
        { bereich: 'business', text: '„Höchstens N gleichzeitig“: beim nächsten Mandat warnt MAKE OS „alle Plätze belegt“ — anlegen geht trotzdem.' },
        { bereich: 'business', text: 'Nach einem neuen Mandat mit Ablauf fragt MAKE OS „Kundenonboarding jetzt starten?“.' },
        { bereich: 'business', text: 'Das Angebot übernimmt alle Preise eines Produkts als Positionen, Optionen hakt ihr an; es heißt nach Firma und Produkt, und der Deal folgt dem angenommenen Angebot.' },
        { bereich: 'business', text: 'Die Rechnungsanschrift wird an der Firma gespeichert.' },
        { bereich: 'business', text: 'Planung und Export kennen alle Teile: die Ist-Basis aus Mandaten und Deals bringt Zusatzmodule und Einmalbeträge mit, der Export der Deals den Einmal-Anteil, der der Mandate die Zusatzmodule.' },
        { bereich: 'alle', text: 'Abgeleitete Ziele (Quartal, Monat, Woche) ziehen ihren Fortschritt wieder mit dem Jahresziel mit.' },
      ] },
      { art: 'behoben', punkte: [
        { bereich: 'business', text: 'Ein neuer Fall zeigt keine Phase mehr fälschlich als „erledigt“; was nebenher läuft, heißt „läuft“.' },
        { bereich: 'business', text: 'Der Kopf eines Falls nennt die Firma nur noch einmal — intern wie im Kunden-Link.' },
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
