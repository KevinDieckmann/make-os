// ─── Erklärungen · Prozesse — Läufe, Tests, Scharfschalten, Webhook (22.10.) ───────────────────────────────────────────────────────────────────────
// Je neuem Schalter bzw. jeder neuen Einstellung der Werkstatt ein Text (Wächter tests/erklaerungen.test.ts): Zustand des Prozesses, Scharf schalten mit
// Budget je Prozess und der Rückfrage „bestehende Fälle“, die Einstellungen der Läufe (Flutschutz, Notbremse, Wiedereintritt, Ziel/Abbruch), der Webhook
// (Schalter „nimmt an“), Testfälle und die Läufe-Ansicht. Beispiele sind erfunden und neutral (Beispiel GmbH, Funktionen statt Namen).
// Eingehängt in lib/erklaerungen/index.ts.

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_PROZESSE_LAEUFE = {
  'prozesse.zustand': {
    was: 'Ein Prozess ist Entwurf (läuft nie), Probelauf (Läufe rechnen im Schatten mit echten Fällen und schreiben nichts), scharf (Läufe legen echte Aufgaben und Vorschläge an — nach außen geht nur, was ihr freigebt) oder pausiert (offene Läufe halten an und gehen danach genau dort weiter).',
    beispiel: 'Der Prozess „Lead nachfassen“ läuft eine Woche als Probelauf. Im Reiter Läufe seht ihr, welche Leads er erfasst hätte; danach schaltet ihr ihn scharf.',
  },
  'prozesse.kundeSichtbar': {
    was: 'Ein Schritt, eine Nachricht oder ein Termin eines Prozesses am Mandat kann im Kunden-Link als Etappe erscheinen — nur, wenn er hier eingeschaltet ist, und nur aus scharfen Läufen (nie aus dem Probelauf). Der Kunde sieht den Titel der Phase, wie weit sie ist, was erledigt ist und was als Nächstes kommt; Agenten, Entscheidungen, Freigaben und Warten bleiben immer intern. Hat das Mandat einen Ablauf des Fulfillments, zeigt der Kunden-Link wie bisher nur diesen.',
    beispiel: 'Im Prozess „Diagnose liefern“ ist „Kick-off-Termin“ eingeschaltet, „Angebot intern prüfen“ nicht. Der Kunde der Beispiel GmbH sieht „Kick-off-Termin“ als erledigt und „Ergebnis-Workshop“ als nächsten Schritt — die interne Prüfung sieht er nie.',
    an: 'Der Schritt erscheint im Kunden-Link (Titel und Stand), sobald ein scharfer Lauf ihn erreicht hat bzw. er als Nächstes kommt.',
    aus: 'Der Schritt bleibt intern.',
  },
  'prozesse.budget': {
    was: 'Das Budget gilt je Prozess und Monat (kein Gesamtbudget): nur Agenten-Schritte kosten Geld. Bei 80 Prozent kommt ein Hinweis in die Glocke, an der Grenze pausiert sich nur dieser Prozess — die anderen laufen weiter.',
    beispiel: 'Geschätzt sind drei Euro im Monat, ihr legt fünf Euro fest. Im dritten Monat kommen mehr Leads, bei vier Euro meldet die Glocke 80 Prozent, bei fünf Euro pausiert der Prozess.',
    daten: 'Nur Agenten-Schritte gehen über das KI-Tor an ein Modell (eure KI-Einstellungen gelten); die Kosten zählen zusätzlich ins KI-Budget der Instanz.',
  },
  'prozesse.bestehende': {
    was: 'Beim Scharfschalten fragt die Werkstatt, ob der Prozess auch für Fälle gilt, die es schon gibt (z. B. alle Deals, die gerade in der passenden Stufe stehen). Vorgabe sind nur neue Fälle; die Antwort steht im Verlauf des Prozesses.',
    beispiel: 'Es gibt vier Deals in der Stufe „Angebot“. „Nur neue Fälle“ startet nichts; „auch die 4 bestehenden“ startet vier Läufe — über den Flutschutz, also nie mehr als eingestellt in einer Stunde.',
  },
  'prozesse.flutschutz': {
    was: 'Der Flutschutz begrenzt, wie viele Läufe dieser Prozess in einer Stunde automatisch startet. Was darüber hinausgeht, wird zurückgehalten — ihr startet oder verwerft es per Klick, nie still.',
    beispiel: 'Ein Import legt 60 neue Leads auf einmal an. Mit 20 je Stunde starten 20 Läufe, 40 warten unter „Zurückgehalten“, bis ihr entscheidet.',
  },
  'prozesse.notbremse': {
    was: 'Die Notbremse zählt die Wirkungen (Aufgaben, Vorschläge, Glocken) dieses Prozesses je Stunde. Wird die Zahl überschritten, pausiert sich nur dieser Prozess und die Glocke sagt Bescheid — gegen Schleifen und Fehler im Aufbau.',
    beispiel: 'Ein falsch gebauter Zweig legt in Minuten 150 Aufgaben an. Bei 120 je Stunde stoppt der Prozess, ihr prüft den Aufbau und setzt ihn danach fort.',
  },
  'prozesse.wiedereintritt': {
    was: 'Ein Fall läuft höchstens einmal gleichzeitig durch einen Prozess. Ist ein Lauf beendet, darf derselbe Fall erst nach so vielen Tagen erneut automatisch starten; leer heißt nie automatisch — dann nur von Hand mit Grund.',
    beispiel: 'Bei 90 Tagen kann eine Firma, die im Frühjahr nachgefasst wurde, im Sommer wieder in den Prozess „Lead nachfassen“ kommen — vorher nicht.',
  },
  'prozesse.recherche-frische': {
    was: 'Ein Recherche-Schritt (Web) fragt dieselbe Firma bzw. denselben Lead höchstens alle so viele Tage — über alle Prozesse. Ist die letzte Recherche jünger, wird der Schritt ohne Modellaufruf und ohne Kosten übersprungen und der Lauf geht weiter.',
    beispiel: 'Bei 90 Tagen recherchiert der nächtliche Prospecting-Lauf die Beispiel GmbH im Januar; im Februar findet er sie wieder als ruhend, überspringt die Recherche aber und bewertet nur.',
    daten: 'Gezählt wird nur, dass recherchiert wurde (Zeitpunkt am Lauf) — nie, was gefunden wurde. Das Ergebnis steht nur im Vorschlag.',
  },
  'prozesse.recherche-suchen': {
    was: 'So viele Web-Suchen darf ein Recherche-Schritt je Lead höchstens machen (1 bis 5). Jede Suche kostet zusätzlich zu den Tokens und zählt ins Budget des Prozesses.',
    beispiel: 'Mit 3 Suchen findet der Research-Agent Webseite, Branche und eine Meldung zur neuen Vertriebsleitung der Beispiel GmbH — mehr sucht er nicht.',
    daten: 'Die Web-Suche läuft nur, wenn sie in den KI-Einstellungen erlaubt ist; Webseiten sind fremder Text und gehen nur als Vorschlag mit Häkchen je Feld in die Akte.',
  },
  'prozesse.ziel-abbruch': {
    was: 'Ziel und Abbruch sind Bedingungen über Felder des Falls, die vor jedem Schritt geprüft werden: trifft das Ziel zu, endet der Lauf mit Erfolg; trifft der Abbruch zu, endet er ohne Ziel. Einschränkung nach Art. 18 und Werbesperre beenden immer.',
    beispiel: 'Ziel: Deal-Stufe ist „gewonnen“. Gewinnt ihr den Deal, während der Lauf noch auf eine Erinnerung wartet, endet er sofort als erreicht — keine überflüssige Erinnerung mehr.',
  },
  'prozesse.webhook-scharf': {
    was: 'Erst wenn der Webhook scharf ist, nimmt seine Adresse etwas an — und nur die Felder des Schemas, mit dem richtigen Schlüssel. Alles, was hereinkommt, ist fremder Text; Läufe daraus legen nur Vorschläge an.',
    beispiel: 'Das Kontaktformular der Beispiel GmbH schickt Name und Thema an die Adresse. Ist der Webhook scharf, startet ein Lauf; vorher antwortet die Adresse nur „nicht gefunden“.',
    an: 'Die Adresse nimmt Aufrufe mit dem Schlüssel an; jeder Eingang zählt unter „Letzte Eingänge“ (nur Zeit und Status).',
    aus: 'Die Adresse antwortet immer „nicht gefunden“ — auch mit richtigem Schlüssel. Schlüssel und Schema bleiben erhalten.',
  },
  'prozesse.testfaelle': {
    was: 'Ein Testfall hält einen Fall (bzw. den erfundenen Beispiel-Fall) und den Weg fest, den der Prozess damit ging. „Alle prüfen“ spielt jeden Testfall als Probelauf auf dem Entwurf ab — es wird nichts geschrieben — und zeigt, was sich geändert hat.',
    beispiel: 'Ihr übernehmt einen gelungenen Lauf als Testfall und ändert danach eine Raute. „Alle prüfen“ zeigt: „Angebot senden“ wird jetzt übersprungen — gut, dass das vor dem Veröffentlichen auffällt.',
  },
  'prozesse.lauf-ansicht': {
    was: 'Ein Lauf öffnet denselben Plan, auf dem der Prozess gebaut ist: grün gelaufen, gelb wartet, rot Fehler, grau nicht erreicht; der Lichtfaden leuchtet den Weg, den der Lauf wirklich nahm. Gespeichert sind nur Kennungen — die Inhalte holt die Ansicht beim Öffnen mit deinen Rechten.',
    beispiel: 'Der Lauf zum Beispiel-Deal steht gelb an „Angebot freigeben“ und pulsiert: er wartet auf dich, bis morgen 14 Uhr. Ein Klick auf den Knoten zeigt den Vorschlag und führt in den Stapel.',
  },
} as const satisfies Record<string, EinstellungsText>;
