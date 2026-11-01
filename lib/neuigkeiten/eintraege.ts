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
    id: 'u-2026-11-02-12',
    datum: '2026-11-02',
    titel: 'Kampagnen-Versand ohne Zufall',
    kurz: 'Antworten, Abmeldungen und Sperren stoppen jetzt jede schon freigegebene Mail. Hakt die Postfach-Verbindung, wartet die Mail und kommt später — statt verloren zu gehen.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Kommt eine Antwort, gibt es eine Abmeldung oder wird ein Ziel aus der Kampagne genommen, geht keine weitere Mail mehr an dieses Ziel — auch keine, die schon freigegeben war. Eine Abmeldung gilt in jeder Kampagne.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Sagt ein Betrieb Nein (Werbesperre), fallen seine Anrufe, LinkedIn-Schritte und Besuche aus allen Listen.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Hakt die Verbindung zum Postfach, bleibt die Mail freigegeben und wird später noch einmal versucht. Die freigebende Person bekommt dazu höchstens eine Glocke am Tag.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Die Kanal-Ampel zählt beim Freigeben, wie sie jetzt steht. Mails verteilen sich über den Tag statt in den ersten Minuten.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Antworten auf Kampagnen-Mails stehen in der Akte und zählen im Lead. Eine Antwort beendet das Ziel auch in anderen Kampagnen, und wer gerade angeschrieben wurde, bekommt 30 Tage keine zweite Erstansprache.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Antworten auf Willkommens-Mails werden ein Follow-up für Marketing. Die Karte der Willkommens-Mails sagt, warum sie gerade nichts senden, und zeigt gescheiterte Mails.', bereich: 'business', weg: WEG.website('formulare') },
        { text: 'Briefe mit Fehler stehen in der Druckliste und lassen sich bearbeiten.', bereich: 'business', weg: WEG.marketing('kampagnen') },
      ] },
      { art: 'behoben', punkte: [
        { text: '„Als Lead übernehmen“ zählt bei einem Doppelklick nur einmal und schließt das Follow-up „Antwort bearbeiten“.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Der Trichter je Schritt zählt jetzt auch Betriebe ohne Person.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Eine Mail mit unklarem Versand wird „gesendet“, sobald sie im Postfach unter „Gesendet“ auftaucht. „Erneut vorbereiten“ fragt vorher nach.', bereich: 'business', weg: WEG.marketing('kampagnen') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-9',
    datum: '2026-11-02',
    titel: 'Marketing-Zahlen stimmen',
    kurz: 'Social-Beiträge, Kampagnen-Mails und Antworten zählen jetzt im Traktions-Score. Nichts wird doppelt gezählt, und aus einem Instagram-Kommentar wird mit einem Klick eine Anfrage.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Veröffentlichte Social-Beiträge zählen bei „Veröffentlichungen“ mit. Ein Beitrag, der im Redaktionsplan und unter Social steht, zählt einmal.', bereich: 'business', weg: WEG.marketing('social') },
        { text: 'Zwei neue Zahlen im Traktions-Score: gesendete Kampagnen-Mails und wie viele darauf antworten. Sie erscheinen, sobald der Mail-Stapel etwas gesendet hat.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Aus einem Instagram-Kommentar oder einer Nachricht: „Als Anfrage übernehmen“. Die Person steht dann in der Kartei, mit Follow-up. Gesendet wird nichts.', bereich: 'business', weg: WEG.marketing('social') },
        { text: 'Abmeldungen über den Abmeldelink zählt MAKE OS je Newsletter-Ausgabe selbst.', bereich: 'business', weg: WEG.marketing('newsletter') },
        { text: 'Angenommene Instagram-Entwürfe des Head of Marketing stehen zusätzlich als Entwurf im Instagram-Kanal und warten dort auf eure Freigabe.', bereich: 'business', weg: WEG.marketing('social') },
      ] },
      { art: 'besser', punkte: [
        { text: '„Deals aus Marketing“ zählt überall gleich: Content, Anfrage oder eine Marketing-Kampagne.', bereich: 'business', weg: WEG.marketing() },
        { text: 'Läuft die Website, zählen ihre Anfragen nur noch in der Website-Zahl, nicht zusätzlich bei „Anfragen“. Ein Newsletter-Beitrag zählt als die Ausgabe.', bereich: 'business', weg: WEG.marketing('anfragen') },
        { text: 'Gelöschte Beiträge und Kampagnen zählen nicht mehr bei den Kosten.', bereich: 'business', weg: WEG.marketing() },
        { text: 'Am Reiter Social steht, wie viele Beiträge auf eure Freigabe warten.', bereich: 'business', weg: WEG.marketing('social') },
        { text: 'Firmen- und Personenkanäle nehmen leere Felder ihres Markenprofils aus der Positionierung.', bereich: 'business', weg: WEG.marketing('positionierung') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-8',
    datum: '2026-11-02',
    titel: 'Head of Marketing kennt alles',
    kurz: 'Der Head of Marketing plant jetzt mit Social, Website, Homepage-Funden und dem Mail-Stapel. Nimmst du einen Beitrag an, steht er als Entwurf im Redaktionsplan.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Beitrags- und Newsletter-Vorschläge werden beim Annehmen ein echter Entwurf bzw. eine Idee im Redaktionsplan, mit Säule und Quelle. Es entsteht keine Aufgabe mehr, und veröffentlicht wird nichts.', bereich: 'business', weg: WEG.marketing('redaktion') },
        { text: 'Der Head sieht freie Plätze im Social-Plan, offene Kommentare und Nachrichten, wartende Mails im Stapel, offene Antworten auf Kampagnen-Mails und vorbereitete Homepage-Funde. Daraus macht er Vorschläge mit Link zur Liste.', bereich: 'business', weg: WEG.marketing() },
        { text: 'Den Head of Marketing gibt es jetzt auch im Reiter Social. Seine Kosten zählen die Social-Läufe mit.', bereich: 'business', weg: WEG.marketing('social') },
      ] },
      { art: 'besser', punkte: [
        { text: 'Kampagnen-Vorschläge zählen auch Betriebe ohne Person. Läuft schon eine Kampagne mit demselben Vorgehen, wird sie weiterverwendet. Sales und Marketing schlagen dieselbe Kampagne nicht doppelt vor.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Vorschläge des Head of Marketing gehen an die Person, die Marketing verantwortet. Wer eine Beziehung ausdrücklich hält, bekommt sie weiter selbst. Art. 14 wird immer eine Aufgabe.', bereich: 'business', weg: WEG.marketing() },
        { text: 'Kundenstimmen, die schon als Idee im Plan stehen, schlägt der Head nicht noch einmal vor.', bereich: 'business', weg: WEG.marketing('redaktion') },
        { text: 'Social-Läufe für Firmenkanäle arbeiten im Namen der Person, die Marketing verantwortet.', bereich: 'business', weg: WEG.marketing('social') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-7',
    datum: '2026-11-02',
    titel: 'Kampagnen: Betriebe und Versand',
    kurz: 'Kampagnen nehmen jetzt auch Betriebe ohne Person mit. Jede Kampagne zeigt alle Ziele mit ihrem Stand. Alle Kampagnen-Mails gehen über denselben Mail-Stapel.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Eine Kampagne aus einem Segment nimmt auch die Betriebe ohne Person mit. Betriebe mit roter Ampel kommen nicht hinein.', bereich: 'business', weg: WEG.marketing('segmente') },
        { text: 'Im Kampagnen-Detail steht die Liste „Ziele“: Personen und Betriebe, mit Schritt, Fälligkeit und Grund. Dort kannst du ein Ziel stoppen und Betriebe hinzufügen oder herausnehmen.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Antwortet jemand auf eine Kampagnen-Mail, steht im Follow-up „Antwort bearbeiten“ der Knopf „Als Lead übernehmen“.', bereich: 'business', weg: WEG.followup() },
        { text: 'Die Willkommens-Mails haben eine eigene Karte unter Website › Formulare & Termine. Dort stehen der Schalter, die Texte und wer welche Mail bekam.', bereich: 'business', weg: WEG.website('formulare') },
      ] },
      { art: 'besser', punkte: [
        { text: 'Die Mail eines Homepage-Funds geht jetzt über den Mail-Stapel der Kampagne. Sie wird gedrosselt gesendet, mit Abmeldelink und Absenderzeile. Eine Antwort sagt den Anruf ab.', bereich: 'business', weg: WEG.kampagne() },
        { text: '„Jetzt vorbereiten“ sagt, was passiert ist und warum etwas nicht vorbereitet wurde.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Mails mit gelber Ampel gibst du einzeln frei, nicht in der Sammelfreigabe.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Die Zahlen einer Kampagne zählen Betriebe mit. Wer einmal reagiert hat, bleibt bei „reagiert“.', bereich: 'business', weg: WEG.kampagne() },
      ] },
      { art: 'behoben', punkte: [
        { text: 'Wer schon eine Mail bekam, bekommt beim Start der Sequenz keine zweite Erstansprache.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Ändert ihr eine Sequenz, bleiben laufende Ziele an ihrem Schritt.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Ein Anruf mit Gespräch zählt jetzt im Trichter je Schritt.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Ohne Absenderzeile oder Abmeldelink verbraucht eine Mail kein Tageskontingent mehr.', bereich: 'business', weg: WEG.kampagne() },
        { text: 'Sendefehler lassen sich wieder „erneut vorbereiten“.', bereich: 'business', weg: WEG.kampagne() },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-6',
    datum: '2026-11-02',
    titel: 'Verträge aus Vorlagen',
    kurz: 'Unter Vertrieb › Angebote gibt es jetzt den Reiter „Verträge“. Verträge entstehen aus euren Vorlagen, bekommen eine Nummer und ein PDF.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Vorlagen pflegt ihr unter Unternehmen › Verträge › Vorlagen. Ihr könnt einen eigenen Vertrag als Word, PDF oder Text einlesen und Werte als Felder markieren.', bereich: 'business', weg: WEG.vertragVorlagen() },
        { text: 'Vertrag erstellen geht auch direkt aus einem angenommenen Angebot, einem Deal oder einem Mandat. Partner, Gesellschaft und Vergütung sind dann schon eingetragen.', bereich: 'business', weg: WEG.vertrag() },
        { text: 'Beim Fertigstellen bekommt der Vertrag seine Nummer und ein festes PDF. Ändern geht danach nur als neue Version.', bereich: 'business', weg: WEG.vertrag() },
        { text: 'Lädst du das unterschriebene PDF hoch, steht der Vertrag im Register der Gesellschaft. Die Kündigungsfrist kommt in den Kalender, mit Erinnerung.', bereich: 'business', weg: WEG.vertrag() },
      ] },
      { art: 'besser', punkte: [
        { text: 'Jede Vorlage zeigt, ob sie anwaltlich geprüft ist. Ungeprüfte oder geänderte Vorlagen fragen vor dem Fertigstellen nach. Das ist eine Vorlage, keine Rechtsberatung.', bereich: 'business', weg: WEG.vertragVorlagen() },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-5',
    datum: '2026-11-02',
    titel: 'Kalender: Firmen bündeln, Belegt bei Google',
    kurz: 'Weitere Kalender-Konten lassen sich zu einer Firma zusammenfassen und stehen dann als eine Ebene im Kalender. Ihre Termine erscheinen auf Wunsch als neutrale Blöcke „Belegt“ im eigenen Google-Kalender.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Weitere Kalender: je Konto eine Firma oder Gruppe eintragen. Konten mit derselben Gruppe stehen im Kalender als eine Ebene mit eigener Farbe. Andere sehen davon nur „Belegt“.', bereich: 'business', weg: `${WEG.kalender()}?einstellungen=1` },
        { text: 'Die Termine der weiteren Konten stehen als „Belegt“ in deinem eigenen Google-Kalender, ohne Titel und ohne Gäste. Verschiebt sich ein Termin, zieht der Block nach. Je Konto abschaltbar.', bereich: 'business', weg: `${WEG.kalender()}?einstellungen=1` },
      ] },
      { art: 'besser', punkte: [
        { text: 'Termin im Business für „Gemeinsam“: er landet in deinem Google-Kalender, die anderen werden eingeladen — erst nach deiner Bestätigung.', bereich: 'business', weg: `${WEG.kalender()}?space=business` },
      ] },
      { art: 'behoben', punkte: [
        { text: 'Fehlt ein eingestellter Kalender in iCloud, fragt der Termin-Dialog einmal, welcher Kalender es sein soll, statt einen Fehler zu zeigen.', bereich: 'alle', weg: WEG.kalender() },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-4',
    datum: '2026-11-02',
    titel: 'Checks in eigenen Worten, neue Zielgruppen',
    kurz: 'In den Checks können Teilnehmende zu jeder Frage etwas in eigenen Worten ergänzen, am Ende stehen ein bis zwei Fragen nur in eigenen Worten. Für die Kampagnen gibt es drei neue Zielgruppen: Start-ups, innovative Unternehmer und Scale-ups.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Checks: unter jeder Auswahlfrage „Eigene Antwort ergänzen“ (freiwillig, zählt nicht in die Punkte) und am Ende Fragen in eigenen Worten. Die Antworten stehen unter Markttraktion › Website › Checks und an der Anfrage in der Kontaktakte.', bereich: 'business', weg: WEG.marketing('anfragen') },
        { text: 'Kampagnen: drei neue Zielgruppen mit eigenem Segment und eigener Kampagne beim ersten Import — Start-ups, innovative Unternehmer und Scale-ups. Der Steckbrief eines Betriebs zeigt Branche, eingesetzte Werkzeuge und offene Stellen.', bereich: 'business', weg: WEG.marketing('kampagnen') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-3',
    datum: '2026-11-02',
    titel: 'Website: alles an einem Ort',
    kurz: 'In der Markttraktion gibt es unter Marketing den neuen Punkt „Website“. Dort steht alles, was die Website braucht — und Preise, Texte und Termine pflegt ihr jetzt selbst.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Überblick: für jeden Weg der Website (Checks, Kontaktformular, Newsletter, Bausteine, Vorlagen, Erstgespräch) seht ihr, ob er an ist und was noch fehlt — mit einem Klick zum Beheben.', bereich: 'business', weg: WEG.website() },
        { text: 'Eingänge: alle Anfragen, Checks, Bestellungen, Termine und Newsletter-Anmeldungen der Website in einer Liste, mit Sprung in die Akte.', bereich: 'business', weg: WEG.website('eingaenge') },
        { text: 'Angebote und Preise selbst pflegen: weicht ein Preis vom Produktkatalog ab, steht er rot da und lässt sich in beide Richtungen übernehmen.', bereich: 'business', weg: WEG.website('angebote') },
        { text: 'Bausteine: Titel, Preis und Kurztext lassen sich hier anpassen; ohne Anpassung gilt der Katalog der Website.', bereich: 'business', weg: WEG.website('bausteine') },
        { text: 'Eigene Events, häufige Fragen, Fakten und Texte für die Website pflegen — die Website liest sie von selbst.', bereich: 'business', weg: WEG.website('inhalte') },
        { text: 'Bilder aus den Medien, die für die Website freigegeben sind, mit Alt-Text auf die Website bringen.', bereich: 'business', weg: WEG.website('bilder') },
        { text: 'Ein fester Link fürs Erstgespräch: er führt immer auf die gewählte Buchungsseite, nie ins Leere.', bereich: 'business', weg: WEG.website('formulare') },
      ] },
      { art: 'besser', punkte: [
        { text: 'Der Innovations-Check ist von Marketing unter „Website“ umgezogen; alte Links führen dorthin.', bereich: 'business', weg: WEG.website('checks') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02-2',
    datum: '2026-11-02',
    titel: 'Kampagnen laufen jetzt von selbst ab',
    kurz: 'Jede Kampagne kann eine Abfolge bekommen — zum Beispiel Mail am ersten Tag, Anruf drei Tage später. Mails liegen als Stapel bereit und gehen mit einem Klick raus, gedrosselt und immer mit Abmeldelink.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Abfolge je Kampagne: Schritte mit Abstand in Tagen und Kanal (Mail, Anruf, LinkedIn, Brief, Besuch). Jede Person und jede Firma läuft ihre Schritte selbst ab.', bereich: 'business', weg: WEG.marketing('kampagnen') },
        { text: 'Mail-Stapel: für jeden fälligen Mail-Schritt liegt ein Entwurf bereit — mit Namen und Firma aus der Vorlage. Häkchen setzen, prüfen, ein Klick gibt den ganzen Stapel frei.', bereich: 'business' },
        { text: 'Gesendet wird werktags zwischen 8 und 18 Uhr aus dem eigenen Postfach, höchstens 30 Mails je Tag und Postfach (einstellbar bis 50).', bereich: 'business' },
        { text: 'Jede Kampagnen-Mail trägt Absender, Impressum und einen Abmeldelink; Mail-Programme zeigen dafür einen eigenen Abmelde-Knopf.', bereich: 'business' },
        { text: 'Antwortet jemand, stoppt die Abfolge und „Antwort bearbeiten“ steht an. Kommt eine Mail zurück oder meldet sich jemand ab, endet die Abfolge ebenfalls von selbst.', bereich: 'business' },
        { text: 'Anrufe aus der Abfolge stehen mit Leitfaden in der Power Hour; wie viele neue Ziele je Tag starten, stellt man je Kampagne ein.', bereich: 'business' },
        { text: 'Briefe kommen auf eine Druckliste, Besuche als Erinnerung. Auf Wunsch schreibt ZOE einen Entwurf noch einmal klarer — gesendet wird trotzdem erst nach der Freigabe.', bereich: 'business' },
        { text: 'Willkommens-Mails nach einer Einwilligung (Newsletter, Mail): auf Wunsch automatisch, nur mit festen Texten aus den Einstellungen und mit Abmeldelink. Vorgabe: aus.', bereich: 'business' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Personen mit Werbesperre, Einschränkung oder auf der Sperrliste kommen nie in einen Stapel. Ohne Grundlage für Werbung bleibt die Mail draußen.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-11-02',
    datum: '2026-11-02',
    titel: 'Kampagne „Homepage“ und Betriebe als Ziele',
    kurz: 'Neu unter Markttraktion › Marketing › Homepage-Funde: jeden Abend sucht ein Agent Betriebe ohne oder mit schwacher Website, prüft sie und bereitet eine Vorschau der neuen Seite, eine Mail und einen Anruf-Leitfaden vor. Nichts geht raus, bevor jemand im ZOE-Stapel freigibt.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Homepage-Funde: Gebiete und Branchen wählen, der Agent sucht ab 20 Uhr (oder „Jetzt suchen“) und bewertet jede Website ohne KI — fehlend, unsicher, nicht fürs Handy, langsam, veraltet.', bereich: 'business', weg: '/os/markttraktion?s=marketing&a=funde' },
        { text: 'Je Betrieb eine Vorschau „So könnte Ihre neue Seite aussehen“ — nur mit öffentlichen Angaben, ohne fremde Bilder oder Texte. Öffentlich erst nach der Freigabe, über einen eigenen Link.', bereich: 'business' },
        { text: 'Freigeben im ZOE-Stapel übernimmt den Betrieb in die Markttraktion: als Firma mit Lead, Kampagne und Segment „Homepage-Funnel“, dazu eine Erinnerung zum Anruf nach drei Tagen. Eine Person entsteht nur, wenn der Inhaber im Impressum steht.', bereich: 'business' },
        { text: 'Mail und Anruf ohne Einwilligung sind rechtlich riskant (§ 7 UWG) — sie gehen nur raus, wenn ein Inhaber „auf eigenes Risiko“ einschaltet. Der Hinweis bleibt sichtbar.', bereich: 'business' },
        { text: 'Betriebe, die man selbst sieht (zum Beispiel auf Google Maps), lassen sich von Hand als Fund eintragen — oder als Datei aus einer Recherche importieren.', bereich: 'business' },
        { text: 'Zielgruppe einstellbar: zum Beispiel nur Restaurants & Cafés und nur Betriebe mit veröffentlichter Telefonnummer oder Mail-Adresse.', bereich: 'business' },
        { text: 'Wer zuerst angerufen wird: Funde mit Handynummer stehen oben, dann Festnetz — Nummern direkt antippbar, mit Anruf-Leitfaden.', bereich: 'business' },
        { text: 'Firmen als Ziele: Ein Betrieb ohne Ansprechpartner ist jetzt ein vollwertiges Ziel — mit Anschrift, Bezirk, Handy, Öffnungszeiten, Website-Bedarf, Quellen und Recht (Herkunft, Art.-14-Uhr, Werbesperre, „geprüft“) direkt an der Firma.', bereich: 'business', weg: WEG.firma() },
        { text: 'Gleicher Name, andere Adresse: zwei Betriebe bleiben zwei Firmen. Dubletten erkennt MAKE OS über OpenStreetMap-Kennung, Domain oder Name mit Adresse.', bereich: 'business' },
        { text: 'Sagt ein Betrieb „Nein“ (Werbesperre oder Abmeldelink), kommt er auf die Sperrliste — der Abendlauf und der Import legen ihn nie wieder an.', bereich: 'business' },
        { text: 'Segmente zählen jetzt auch Betriebe ohne Person — mit neuen Filtern: Bezirk, PLZ, Website-Bedarf, mit oder ohne Website, erreichbar per Handy, Festnetz oder Mail, Kampagne und Quelle. Der CSV-Export enthält Personen und Betriebe.', bereich: 'business', weg: '/os/markttraktion?s=marketing&a=segmente' },
        { text: 'Firmenakte: neue Karte „Betrieb“ mit der Kanal-Ampel der Firma. Mail und Anruf ohne Einwilligung bleiben rot; Brief und Besuch sind die zulässigen Wege.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01-6',
    datum: '2026-11-01',
    titel: 'Bausteine über die Website bestellen (vorbereitet)',
    kurz: 'Vorbereitet: Unternehmen können Bausteine der Website auf Rechnung bestellen — eingeschaltet wird das erst, wenn die rechnende Gesellschaft eingetragen ist. Die Rechnung ist dann sofort vorbereitet — mit einem Klick auf „Freigeben und senden“ gehen Rechnung und Download-Links raus. Ohne Klick geht nichts raus.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Markttraktion › Marketing › Anfragen: Karte „Bausteine“ — Gesellschaft für die Rechnung und Zahlungsziel wählen und einschalten, sobald die Gesellschaft eingetragen ist. Bis dahin bleibt sie aus; auf der Website steht dann der Weg per E-Mail.', bereich: 'business', weg: WEG.marketing('anfragen') },
        { text: 'Jede Bestellung steht dort mit Firma, Betrag und Eingang. Die Person bekommt sofort eine Eingangsbestätigung; die Anfrage steht in der Kartei, der Rechnungsentwurf unter Rechnungen.', bereich: 'business', weg: WEG.marketing('anfragen') },
        { text: '„Freigeben und senden“ stellt die Rechnung (mit E-Rechnung) und schickt sie mit den Download-Links (30 Tage gültig) an die Person. „Ablehnen“ löscht den Entwurf — eine Absage geht nur, wenn du sie ankreuzt.', bereich: 'business', weg: WEG.marketing('anfragen') },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01-3',
    datum: '2026-11-01',
    titel: 'Rechnungen vorbereiten für alle Honorare',
    kurz: 'Der Morgenlauf legt jetzt auch für Quartals-, Einmal- und Tageshonorare den Rechnungsentwurf an — und bei Angeboten mit einmaligen und laufenden Posten auch für die Einmalposten, je Rate. Gestellt wird weiter nur per Klick.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Angebot mit einmaligen und laufenden Posten: für die Einmalposten entsteht ein Entwurf — mit Raten bzw. Anzahlung je Zahlung im fälligen Monat, sonst einer zum Beginn des Mandats. Die laufende Leistung rechnet das Mandat weiter monatlich ab.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Rechnung je Quartal: ein Entwurf über die drei Monate im ersten Monat des Quartals. Einmaliges Honorar: ein Entwurf zum Beginn.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Tagessatz: am Monatsersten ein Entwurf mit den Tagen aus der erfassten Zeit des Vormonats (8 Stunden = 1 Tag, bitte prüfen). Ohne erfasste Zeit gibt es nur die Aufgabe mit Hinweis.', bereich: 'alle' },
        { text: 'Angenommenes Angebot der Selbstständigkeit: Mandat und Liquiditätsposten entstehen jetzt genauso von selbst — sie zählen in der Liquidität der Selbstständigkeit, nie im Business.', bereich: 'privat' },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01-5',
    datum: '2026-11-01',
    titel: 'Woche mit ZOE planen',
    kurz: 'ZOE schlägt dir für die Woche Fokus-Blöcke für das Wichtigste vor — nur in freie Zeit, um alle Termine herum, mit Top 3 und dem Hinweis, wenn es zeitlich nicht machbar ist. Du übernimmst per Klick.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Kalender › Planen und Fokus: „Woche mit ZOE planen“ — Fokus-Blöcke für die wichtigsten Aufgaben und Meilensteine in deiner freien Zeit (nie über Termine, Abwesenheit oder Business-frei, mit Puffer), dazu die Top 3 der Woche und je Block ein Satz, warum er dort steht.', bereich: 'alle', weg: WEG.woche() },
        { text: '„Alles übernehmen“, einzeln abwählen oder verschieben — erst dein Klick legt die Blöcke im Kalender an. Ein zweiter Klick legt nichts doppelt an.', bereich: 'alle', weg: WEG.woche() },
        { text: 'Montags liegt der Vorschlag für die Woche schon bereit, die Glocke sagt Bescheid. Reicht die freie Zeit nicht, steht dort „nicht machbar“ mit den Stunden.', bereich: 'alle', weg: WEG.woche() },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01-2',
    datum: '2026-11-01',
    titel: 'E-Rechnung',
    kurz: 'Gestellte Rechnungen sind jetzt E-Rechnungen: die PDF trägt die strukturierten Rechnungsdaten (ZUGFeRD, EN 16931). Für Behörden gibt es die XRechnung zum Herunterladen, und eingehende E-Rechnungen liest MAKE OS beim Beleg-Hochladen direkt aus der Datei.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Jede gestellte Rechnung und Stornorechnung trägt die E-Rechnung (ZUGFeRD, EN 16931) in der PDF — dieselben Zahlen wie auf dem Papier. Vor dem Stellen sagt MAKE OS, was dafür noch fehlt.', bereich: 'alle' },
        { text: 'An gestellten Rechnungen: „Als XRechnung (XML)“ für Kunden aus der Verwaltung. Die Leitweg-ID tragt ihr an der Kundenfirma unter Zahlungsdaten oder im Rechnungsentwurf ein.', bereich: 'alle' },
        { text: 'Beleg hochladen (auch aus der Inbox): eine E-Rechnung als PDF oder XML wird direkt aus der Datei gelesen — Lieferant, Nummer, Datum, Beträge und Fälligkeit, ohne Texterkennung.', bereich: 'alle' },
        { text: 'Je Gesellschaft lässt sich die E-Rechnung ausschalten, wenn ein Empfänger sie nicht möchte. Hinweis, keine Steuerberatung.', bereich: 'alle' },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01',
    datum: '2026-11-01',
    titel: 'Website: Kontaktformular, Zoe-Begleiterin, Website-Zahlen',
    kurz: 'Die Website bekommt ein Kontaktformular — Nachrichten landen als Anfrage mit Follow-up in der Markttraktion. Auf Check und Formular begleitet Zoe mit festen Hinweisen, und der Traktions-Index zeigt die Website-Zahlen.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Kontaktformular der Website: kommt ausgeschaltet; einschalten unter Marketing › Anfragen. Eine Nachricht wird zur Anfrage „über Website“ mit Follow-up „Anfrage beantworten“ — ohne Werbe-Einwilligung, ohne automatische Mail. Steht die Adresse schon in der Kartei, hängt sie dort nur als „Adresse unbestätigt“.', bereich: 'business', weg: WEG.marketing('anfragen') },
        { text: 'Zoe-Begleiterin auf Check und Kontaktformular: ein ruhiger Ring unten rechts mit festen Hinweisen je Schritt und dem Weg zum Erstgespräch — keine KI-Antworten, nichts geht nach außen.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Traktions-Index › Marketing: Anfragen über die Website, abgeschlossene Checks und Termine aus der Website (je 30 Tage) — aus den eigenen Daten, ohne Tracker.', bereich: 'business', weg: WEG.markttraktion() },
      ] },
      { art: 'besser', punkte: [
        { text: 'Prozesse: eine Anfrage von der Website trägt jetzt eine eigene Stufe — ein Auslöser „neuer Lead, Stufe beginnt mit webseite“ startet nur für Check und Kontaktformular.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-11-01-4',
    datum: '2026-11-01',
    titel: 'Haushalt speist die Finanzplanung',
    kurz: 'Die Finanzplanung liest jetzt aus dem Haushalt: Buchungen als Ist, Fixkosten als Monatsplan, Kredite mit Rate und die Kontostände. Was du in der Planung von Hand eingetragen hast, bleibt.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Finanzen › Privat › Planung: Buchungen, Fixkosten und Kredite aus dem Haushalt fließen in die Planung — nicht mehr doppelt pflegen. Ein Haus-Zeichen an der Zeile führt in den Haushalt.', bereich: 'privat', weg: WEG.finanzplanung('privat') },
        { text: 'Beim ersten Öffnen siehst du, was sich ändern würde (vorher und nachher) — erst „Übernehmen“ legt die Werte dazu. Ausschalten geht jederzeit.', bereich: 'privat', weg: WEG.finanzplanung('privat') },
        { text: 'Von Hand gewinnt: Eine eigene Zeile gleichen Namens bleibt, ein einzelner Monatswert von Hand ebenso, und Monate mit eigenen Buchungen der Planung bleiben, wie sie sind.', bereich: 'privat', weg: WEG.privat('fixkosten') },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-9',
    datum: '2026-10-31',
    titel: 'Rechnungen & Zahlungen aufgeräumt',
    kurz: 'Rechnungen & Zahlungen ist jetzt eine Arbeitsfläche wie Inbox und Kontakte: links die Liste, rechts die gewählte Rechnung. Finanzmeeting und Jahresziel stehen im Cockpit, Planposten und Merkposten unter Liquidität.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Finanzen › Business › Rechnungen & Zahlungen: Suche und „Filter ▾“ (Status, Gesellschaft, ohne Zuordnung) in einer Zeile, die Rechnungen nach Zustand gruppiert — ein Klick öffnet die Rechnung rechts daneben statt in einem Fenster. Ohne Auswahl stehen dort die Summen.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Zahlungen (was zuerst bezahlt wird) erreichst du über den Umschalter „Rechnungen · Zahlungen“ oben in der Liste.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Finanzmeeting, Jahresziel und Produkt-Entwürfe stehen jetzt im Cockpit.', bereich: 'business', weg: WEG.business() },
        { text: 'Planposten, ältere Rechnungen ohne Positionen und Merkposten stehen unter Liquidität — bei den Konten und Planposten, die dort schon waren. Doppelte Konto-Karten sind weg.', bereich: 'business', weg: WEG.liquiditaet() },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-8',
    datum: '2026-10-31',
    titel: 'Anfragen von außen sicherer, Dubletten sauberer',
    kurz: 'Kommt eine Anfrage über den Check oder einen Angebots-Link mit der Adresse einer Person, die schon in der Kartei steht, löst sie nichts mehr aus, bevor ihr sie geprüft habt. Und beim Zusammenführen doppelter Personen wandern laufende Prozesse mit.',
    abschnitte: [
      { art: 'besser', punkte: [
        { text: 'Innovations-Check und Angebots-Link: trifft die Mail eine vorhandene Person, hängt die Anfrage dort nur als „Adresse unbestätigt“ — ohne Einwilligung, ohne neue Stufe, ohne automatische Mail. Das Follow-up heißt „Anfrage prüfen — Adresse unbestätigt“; ist sie echt, übernimmst du sie mit „Anfrage übernehmen“ bzw. mit „Senden“ in der Freigabe.', bereich: 'business', weg: WEG.followup() },
        { text: 'Dubletten zusammenführen: laufende Prozesse der entfernten Person gehen auf die behaltene über. Lief derselbe Prozess doppelt, läuft der weiter fortgeschrittene weiter, der andere endet mit dem Vermerk „zusammengeführt“.', bereich: 'business' },
        { text: 'Einrichtung schlanker: „Datenschutz der Instanz“, die Notfallmappe und die Vertriebs-Übungen (Angebotsvorlage, Kadenz, Power Hour) stehen jetzt unter „Danach“ — der Kern ist schneller fertig.', bereich: 'business', weg: '/os/onboarding' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-31-6',
    datum: '2026-10-31',
    titel: 'Feinschliff an Akten und Listen',
    kurz: 'Kleine Dinge, die beim Arbeiten auffallen: das Deal-Board öffnet die Akte, an der Firma kannst du Unterlagen ablegen, und Privat und Business tragen überall ihre Farbe.',
    kurzBusiness: 'Kleine Dinge, die beim Arbeiten auffallen: das Deal-Board öffnet die Akte, an der Firma kannst du Unterlagen ablegen, und der Bereich trägt überall seine Farbe.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Firmenakte › Dateien: Verträge, Angebote und andere Unterlagen direkt an der Firma ablegen — mit „+ Datei ablegen“.', bereich: 'business', weg: WEG.firma() },
      ] },
      { art: 'besser', punkte: [
        { text: 'Deals › Board: ein Klick auf eine Karte öffnet die Deal-Akte; Ziehen zwischen den Spalten wechselt weiter die Stufe.', bereich: 'business', weg: WEG.deals() },
        { text: 'Schnellsuche: Treffer für Personen und Kampagnen führen direkt in die große Akte bzw. die Kampagne.', bereich: 'business' },
        { text: 'Rechnungen: das Suchfeld zeigt seinen Hinweis vollständig, und die Filter liegen am Handy in einer wischbaren Zeile.', bereich: 'business', weg: WEG.rechnungen() },
        { text: 'Meilensteine, Ziele, der Fokus und Medien zeigen den Bereich in seiner Farbe — Privat warm, Business lila.', bereich: 'alle' },
      ] },
    ],
  },
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
        { text: 'Kalender › Einstellungen › Weitere Kalender: bis zu fünf weitere Google-Konten verbinden, Kalender wählen, eine eigene Bezeichnung geben. MAKE OS schreibt dort nie etwas hinein.', bereich: 'business', weg: `${WEG.kalender()}?einstellungen=1` },
        { text: 'Termine dieser Kalender zählen als belegt: freie Zeiten, Buchungsseiten und die Planung rechnen damit. Andere sehen davon nur „Belegt“.', bereich: 'business' },
        { text: 'Beim Anlegen eines Termins kommt ein Hinweis, wenn er sich mit einem Termin dort überschneidet — speichern könnt ihr trotzdem.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-30-5',
    datum: '2026-10-30',
    titel: 'Newsletter-Anmeldung über die Website',
    kurz: 'Besucher können sich auf der Website für den Newsletter anmelden. Sie sind erst dabei, wenn sie den Link in der Bestätigungsmail anklicken. Bestätigte Anmeldungen stehen mit Nachweis der Einwilligung in der Kartei.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Anmeldung mit Bestätigung per E-Mail (Double-Opt-in). Unter Marketing › Newsletter wählt ihr das Absender-Postfach, tragt die Adresse der Website ein und schaltet die Anmeldung ein.', bereich: 'business', weg: WEG.marketing('newsletter') },
        { text: 'Bestätigte Anmeldungen kommen mit Wortlaut, Fassung und Zeitpunkten der Einwilligung in die Kartei. Unbestätigte löschen sich nach 30 Tagen von selbst.', bereich: 'business', weg: WEG.marketing('newsletter') },
        { text: 'Das Newsletter-Häkchen in den Checks führt in dieselbe Anmeldung und erscheint nur, wenn sie eingeschaltet ist.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Große Vorlagen der Website gibt es per E-Mail: Besucher tragen Vorname und Adresse ein und bekommen die Datei als Link, der 7 Tage gilt. Die Anfrage steht im CRM. Absender ist das Postfach, das ihr unter Marketing › Newsletter gewählt habt — ohne Absender bleibt das Anfordern aus.', bereich: 'business', weg: WEG.marketing('newsletter') },
        { text: 'Jeder Check schickt den Bericht jetzt wirklich per E-Mail, sobald Ergebnis und Adresse da sind (einmal je Teilnahme). Der ausführliche Innovations-Check zeigt ohne Adresse nur die Stufe, den ganzen Bericht gibt es mit Adresse.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Auf der Website gibt es den Bereich „Kostenlos“: drei Checks, ein Leitfaden zum Aufbau eines Vertriebsteams mit Arbeitsheft, Ratgeber, Zahlen mit Quelle, neun Vorlagen mit Anleitung und Beispiel (fünf auch als Tabelle für Excel), eine Übersicht nach Phase und die Newsletter-Anmeldung.', bereich: 'business' },
        { text: 'Website neu ausgerichtet: neue Headline zu Sichtbarkeit und Vertrieb, neues Angebot PR und Kommunikation, Events mit verschiedenen Formaten, Innovation mit „erst Struktur und Daten, dann KI“, Sichtbarkeit im Menü nach Positionierung, Homepages, Videos und PR.', bereich: 'business' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Der Innovations-Check vergleicht nach Unternehmensgröße jetzt mit den Destatis-Zahlen von 2025.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Die drei Checks im dunklen Design der App: Karten mit Tiefe und Lichtkante, ein Leuchtfaden führt durch das Gespräch, Kopf mit Logo, das zur Website führt. Logo (für dunklen Grund) und Website-Adresse stellt ihr unter Marketing › Innovations-Check ein.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Website: neuer Film auf der Startseite mit Raum-Schein und pulsierendem Fokus-Punkt, überall ab-Preise, geprüfte Zahlen zu Unternehmen aus 2026, Über uns mit dem Team dahinter, eigene Seiten hinter „In den Markt“ und „Ins Unternehmen“, Grafiken zum Problem auf fünf Seiten und Plätze für Erklärvideos.', bereich: 'business' },
        { text: 'Website überarbeitet: Startseite kürzer, Film mit Knöpfen im letzten Bild, passender Check als zweiter Knopf auf jeder Seite, Preise als Karten mit markiertem Einstieg, Arbeitsprobe mit Bildern, Absicherung für Homepages, Videos und Tagesworkshop (Freigabe vor dem Bau, Ausstieg), Erstgespräch 30 Minuten, Menü per Tastatur bedienbar.', bereich: 'business' },
      ] },
    ],
  },
  {
    id: 'u-2026-10-30-4',
    datum: '2026-10-30',
    titel: 'Checks für die Website: Innovation, Vertrieb, Sichtbarkeit',
    kurz: 'Drei Checks für die Website: der Innovations-Check (kurz oder ausführlich), ein Vertriebs-Check und ein Sichtbarkeits-Check. Jedes Ergebnis nennt nächste Schritte mit euren Angeboten und die nächsten freien Termine fürs Erstgespräch.',
    abschnitte: [
      { art: 'neu', punkte: [
        { text: 'Zwei kleine Checks mit je zwölf Fragen: Vertriebs-Check (Organisation, Zahlen, Neukunden) und Sichtbarkeits-Check (Botschaft, Website, Reichweite). Eingegangene Checks stehen gemeinsam unter Marketing › Innovations-Check.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Der Innovations-Check misst nur Innovation. Besucher wählen am Anfang: kurz mit 19 Fragen (rund 10 Minuten) oder ausführlich mit rund 50 Fragen in Etappen (rund 25 Minuten). Auswerten geht jederzeit.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Für die zwei größten Lücken (Innovations-Check) bzw. die zwei schwächsten Bereiche (kleine Checks) nennt das Ergebnis je einen nächsten Schritt. Darunter steht euer passendes Angebot: Titel, Satz und Link stellt ihr unter Marketing › Innovations-Check ein.', bereich: 'business', weg: WEG.marketing('check') },
        { text: 'Die nächsten freien Termine fürs Erstgespräch stehen direkt im Ergebnis. Ein angetippter Termin ist auf der Buchungsseite schon gewählt.', bereich: 'business' },
        { text: 'Ein Leitsatz unter dem Namen im Kopf des Checks und, falls die Website einer anderen Gesellschaft gehört, ein eigener Verantwortlicher für den Datenschutzhinweis, beides unter Marketing › Innovations-Check.', bereich: 'business' },
      ] },
      { art: 'besser', punkte: [
        { text: 'Ruhigere Ansicht: Zoes Text steht ohne Kasten, oben eine Karte mit den Bereichen des Checks und den weiteren Checks.', bereich: 'business' },
        { text: 'Ist der Check aus oder ein Buchungslink veraltet, sehen Besucher eine neutrale Seite.', bereich: 'business' },
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
