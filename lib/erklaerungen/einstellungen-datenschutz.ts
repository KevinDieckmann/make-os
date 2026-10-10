// ─── Erklärungen · System › Datenschutz & KI (10.10.) ──────────────────────────────────────────────────────────────────────
// Gesundheit (a/b/c), KI-Schalter der Person und der Instanz, Telegram, KI-Protokoll und die Karten der Datenschutz-Seite. Das sind
// Erklärungen in einfachen Worten NEBEN dem rechtlichen Wortlaut der Einwilligungen (der bleibt unverändert und ist der Nachweis).
// Beispiele sind erfunden und neutral. Hinweis, keine Rechtsberatung.

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_DATENSCHUTZ = {
  // ── Gesundheit (Art. 9): drei getrennte Einwilligungen ─────────────────────────────────────────────────────────────────
  'gesundheit.art9': {
    was: 'Gesundheitswerte (Schlaf, Erholung, Sport, Ernährung, Tagebücher) sind besonders geschützt. Darum gibt es drei getrennte Einwilligungen: (a) speichern und auswerten, (b) an die KI geben, (c) mit der Partnerin oder dem Partner teilen. Jede gilt nur für dich, jede lässt sich jederzeit widerrufen.',
    beispiel: 'Du willigst nur in (a) ein: Deine Werte erscheinen in deinem Verlauf, ZOE kennt sie nicht. Erst mit (b) nutzt ZOE sie, um den Tag zu planen.',
    daten: 'Jede Erklärung wird mit Zeitpunkt und Fassung als Nachweis gespeichert, der sich nicht mehr ändern lässt.',
  },
  'gesundheit.verarbeiten': {
    was: 'Erlaubt MAKE OS, deine Gesundheitswerte zu speichern und für deine eigenen Auswertungen zu verwenden. Ohne dieses Ja wird nichts davon erfasst.',
    beispiel: 'Dein Armband meldet den Schlaf der Nacht. Mit (a) an steht er in deinem Gesundheits-Index und im Verlauf. Ohne (a) bleibt die Seite leer, auch der Morgen-Check speichert nichts.',
    an: 'Gesundheitswerte werden gespeichert und ausgewertet — sichtbar nur für dich, solange du sie nicht teilst.',
    aus: 'Es wird nichts Neues erfasst; (b) und (c) enden mit. Schon Gespeichertes bleibt, bis du es selbst löschst.',
    daten: 'Die Werte bleiben in dieser Instanz. An die KI gehen sie nur mit (b).',
  },
  'gesundheit.ki': {
    was: 'Erlaubt ZOE und den automatischen Läufen, deine Gesundheitswerte zu lesen. Dafür gehen Auszüge an die KI.',
    beispiel: 'Du fragst ZOE: „Wie plane ich die Woche?“ Mit (b) an legt sie nach einer schlechten Nacht leichtere Tage nahe. Mit (b) aus plant sie, ohne deine Werte zu kennen.',
    an: 'ZOE und der Gesundheits-Agent dürfen deine Werte lesen und in Antworten und Vorschlägen verwenden.',
    aus: 'Kein Gesundheitswert geht an die KI. ZOE antwortet dann ohne diese Angaben.',
    daten: 'Anbieter des Modells ist Anthropic PBC in den USA (Drittland). Jeder Aufruf steht als Eintrag ohne Inhalt im KI-Protokoll. Setzt (a) voraus.',
  },
  'gesundheit.partner': {
    was: 'Erlaubt den Personen, mit denen du deine Gesundheit teilst (Konto › Gesundheit teilen), deine Werte über ihre ZOE abzufragen. Dabei gehen die Werte an die KI.',
    beispiel: 'Jemand aus deinem Haushalt fragt seine ZOE, wie es um deine Erholung steht. Mit (c) an antwortet sie mit deinen Werten, mit (c) aus sagt sie nur, dass sie dazu nichts sagen darf.',
    an: 'Die von dir freigegebenen Personen können deine Werte über ihre ZOE abfragen.',
    aus: 'Deine Werte bleiben bei dir — auch wenn du sie im Konto mit jemandem teilst, fragt deren ZOE sie nicht ab.',
    daten: 'Setzt (a) und (b) voraus, weil die Antwort über die KI läuft (Anthropic PBC, USA).',
  },

  // ── KI-Schalter der Person ─────────────────────────────────────────────────────────────────────────────────────────────
  'ki.schalter': {
    was: 'Hier bestimmst du, was an die KI gehen darf. Deine Schalter schränken nur ein: Was der Inhaber der Instanz ausgeschaltet hat, kannst du nicht einschalten. Erzwungen wird das auf dem Server, an der einen Stelle, an der Daten das Haus verlassen.',
    beispiel: 'Der Inhaber lässt Kalender und Aufgaben zu. Du schaltest für dich „Finanzen“ aus: ZOE antwortet dir dann nie mit Zahlen aus den Finanzen, die anderen im Haushalt sind davon nicht betroffen.',
  },
  'ki.hintergrund': {
    was: 'Automatische Läufe ohne aktuelle Frage: Morgen- und Abendlauf, die Heads, der Head of Finance, ZOE-Aufgaben. Namen von Kontakten werden dabei durch Platzhalter ersetzt.',
    beispiel: 'Morgens um 7 schaut ZOE in Kalender und Aufgaben und schlägt dir drei Dinge für den Tag vor.',
    an: 'Das passiert von selbst, auch wenn du MAKE OS nicht öffnest.',
    aus: 'ZOE arbeitet nur, wenn du ihr schreibst.',
    daten: 'Jeder Lauf ist ein Aufruf bei Anthropic (USA) und kostet Guthaben. Auszüge gehen als Text hinaus, Kontaktnamen als Platzhalter.',
  },
  'ki.websuche': {
    was: 'Erlaubt Recherchen mit Internet-Suche. Die Suchbegriffe gehen dabei an einen Suchdienst.',
    beispiel: 'Der Research-Mitarbeiter soll drei Anbieter einer Branche vergleichen. Mit Web-Suche liest er aktuelle Seiten und nennt die Quelle; ohne arbeitet er nur mit euren Notizen.',
    an: 'Recherche und Lage dürfen das Internet durchsuchen; jede Antwort nennt ihre Quelle.',
    aus: 'Es geht kein Suchbegriff hinaus. Recherchen stützen sich nur auf das, was in MAKE OS steht.',
    daten: 'Die Suchbegriffe gehen an einen Suchdienst — schreibe darum keine Namen von Privatpersonen in Suchaufträge.',
  },
  'ki.bereich.crm': {
    was: 'Darf ZOE Kontakte, Firmen, Deals und Mandate lesen und Auszüge daraus an die KI geben? Eingeschränkte Kontakte (Art. 18) fehlen immer.',
    beispiel: 'Du fragst: „Wen rufe ich diese Woche an?“ Mit „an“ nennt ZOE drei Namen aus der Power-Hour-Liste. Mit „aus“ weiß sie von eurem CRM nichts.',
    an: 'ZOE und die Vertriebs-, Marketing- und Event-Agenten arbeiten mit der Kartei (ohne private Notizen und ohne volle IBAN).',
    aus: 'Diese Agenten sehen keine Kontakte; die Markttraktion läuft ohne KI-Hilfe weiter.',
    daten: 'Auszüge gehen an Anthropic (USA); in Hintergrundläufen stehen Kontaktnamen nur als Platzhalter.',
  },
  'ki.bereich.kalender': {
    was: 'Darf ZOE deine Termine lesen und Auszüge an die KI geben? Private Termine anderer Personen erscheinen nur als „Belegt“.',
    beispiel: 'Du fragst: „Finde Zeit für ein 45-Minuten-Gespräch diese Woche.“ Mit „an“ schlägt ZOE zwei freie Fenster vor, mit „aus“ kann sie das nicht.',
    an: 'ZOE sieht Zeiten und Titel und kann freie Fenster und Blöcke vorschlagen — eingetragen wird erst mit deinem Klick.',
    aus: 'Der Kalender bleibt für die KI unsichtbar; Terminvorschläge entfallen.',
    daten: 'Terminauszüge gehen an Anthropic (USA).',
  },
  'ki.bereich.aufgaben': {
    was: 'Darf ZOE Aufgaben, Projekte, Ziele und Meilensteine lesen und Auszüge an die KI geben? Aufgaben, die nur eine andere Person sehen darf, bleiben unsichtbar.',
    beispiel: 'Du fragst: „Was ist diese Woche wirklich kritisch?“ Mit „an“ sortiert ZOE die offenen Aufgaben nach Frist und Wirkung, mit „aus“ weiß sie davon nichts.',
    an: 'ZOE kann Aufgaben lesen, Unteraufgaben vorschlagen und Fristen im Blick behalten.',
    aus: 'Aufgaben und Ziele bleiben für die KI unsichtbar.',
    daten: 'Auszüge (Titel, Status, Fristen) gehen an Anthropic (USA).',
  },
  'ki.bereich.finanzen': {
    was: 'Darf ZOE Zahlen, Rechnungen, Liquidität und den Finanzplan lesen und Auszüge an die KI geben? Private Finanzen sieht sie nur bei Personen mit privatem Finanzzugang.',
    beispiel: 'Du fragst: „Wie lange reicht die Liquidität?“ Mit „an“ rechnet der Head of Finance aus den echten Zahlen, mit „aus“ kann er nur allgemein antworten.',
    an: 'Der Head of Finance und ZOE lesen Zahlen und schlagen Aufgaben vor. Geld bewegen sie nie.',
    aus: 'Keine Finanzzahl geht an die KI; der Finanz-Agent bleibt stumm.',
    daten: 'Zahlen gehen als Auszug an Anthropic (USA). Kontostände und Rechnungen bleiben dabei ohne Zugangsdaten.',
  },
  'ki.bereich.brain': {
    was: 'Darf ZOE die Notizen im Brain (Vault) lesen und Auszüge an die KI geben? Private Notizen gehen nie an Agenten.',
    beispiel: 'Du fragst: „Was haben wir zur Preisgestaltung beschlossen?“ Mit „an“ findet ZOE die Notiz und nennt sie als Quelle.',
    an: 'ZOE und die Agenten durchsuchen das Brain und zitieren mit Quelle.',
    aus: 'Das Brain bleibt für die KI zu; „Fragen“ im Brain und Wissens-Agenten antworten nicht.',
    daten: 'Notiz-Auszüge gehen an Anthropic (USA).',
  },
  'ki.bereich.familie': {
    was: 'Darf ZOE Dates, wichtige Tage, Urlaube und Gesprächsthemen aus „Familie & Partnerschaft“ lesen? Einträge „nur ich“ bleiben immer privat.',
    beispiel: 'Du fragst: „Welcher Jahrestag steht an?“ Mit „an“ erinnert ZOE an den Termin und schlägt ein Zeitfenster vor.',
    an: 'Der Familien-Agent und ZOE arbeiten mit den gemeinsamen Einträgen.',
    aus: 'Familie bleibt für die KI unsichtbar.',
    daten: 'Auszüge gehen an einen Anbieter in der EU, sobald ein solcher Weg eingerichtet ist; sonst bleibt der Familienkontext aus dem Prompt.',
  },
  'ki.bilder': {
    was: 'Erlaubt, Fotos aus „Fotos & Videos“ zum Bearbeiten an einen Bild-Anbieter zu geben. Nur Business-Fotos, nur wenn sie einem Agenten gegeben wurden. Personen auf Fotos nur mit ihrer Einwilligung „KI“ — Minderjährige nie.',
    beispiel: 'Der Marketing-Mitarbeiter soll ein Produktfoto freistellen. Mit „an“ geht das Bild an den Bild-Anbieter und kommt als Vorschlag zurück; mit „aus“ bleibt jedes Foto im Haus.',
    an: 'Der Bild-Mitarbeiter darf Bilder bearbeiten lassen — jeder Vorschlag trägt eine KI-Kennzeichnung.',
    aus: 'Kein Bild verlässt MAKE OS Richtung KI. Das ist die Vorgabe.',
    daten: 'Die Pixel gehen an den eingerichteten Bild-Anbieter (Drittland möglich). Je Bearbeitung entstehen Kosten.',
  },

  // ── KI-Schalter der Instanz (nur Inhaber) ──────────────────────────────────────────────────────────────────────────────
  'ki.instanz': {
    was: 'Die Schalter der ganzen Instanz — nur der Inhaber stellt sie. Sie sind die Obergrenze: Was hier aus ist, kann keine Person für sich einschalten. Neue Instanzen starten „sparsam“ (Hintergrund-KI und Web-Suche aus), ältere „kompatibel“ (alles an).',
    beispiel: 'Der Inhaber schaltet „Finanzen“ für die Instanz aus: Niemand im Haus fragt ZOE mehr nach Zahlen, auch wenn die eigene Person-Einstellung „an“ zeigt (sie ist dann grau).',
  },
  'ki.instanz.hintergrund': {
    was: 'Erlaubt oder verbietet automatische KI-Läufe für alle Personen dieser Instanz.',
    beispiel: 'Ein Kunde möchte, dass nachts nichts bei der KI landet. Der Inhaber schaltet aus; der Takt reiht dann gar keine KI-Läufe mehr ein.',
    an: 'Die Läufe (Morgen/Abend, Heads, Finanz-Check) dürfen laufen, jede Person kann sie für sich zusätzlich ausschalten.',
    aus: 'Kein automatischer Lauf geht an die KI. Gespräche, die jemand selbst beginnt, sind davon nicht betroffen.',
    daten: 'Spart Guthaben: jeder Lauf ist ein bezahlter Aufruf.',
  },
  'ki.instanz.websuche': {
    was: 'Erlaubt oder verbietet die Web-Suche für alle Personen dieser Instanz.',
    beispiel: 'Der Inhaber will nicht, dass Suchbegriffe die Instanz verlassen. Er schaltet aus; Research arbeitet nur noch mit euren Notizen.',
    an: 'Recherchen dürfen das Internet durchsuchen.',
    aus: 'Kein Suchbegriff geht hinaus — für niemanden.',
    daten: 'Suchbegriffe gehen an einen Suchdienst.',
  },

  // ── Telegram ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  'telegram.hinweise': {
    was: 'Telegram dient nur als Klingel: Du bekommst neutrale Hinweise wie „Neue Nachricht in MAKE OS“ mit einem Link — keine Gesundheitswerte, keine Kontakt- oder Vertragsinhalte, keine ZOE-Antworten.',
    beispiel: 'Eine Freigabe wartet. Aufs Handy kommt nur „Neue Freigabe in MAKE OS“ mit Link; den Inhalt siehst du erst nach dem Öffnen in der App.',
  },
  'telegram.voll': {
    was: 'Eine Ausnahme für dich: ZOE schickt ihre Antworten vollständig über Telegram, nicht nur den neutralen Hinweis.',
    beispiel: 'Du bist unterwegs und fragst ZOE per Telegram nach den Terminen des Tages. Mit der Ausnahme steht die Antwort direkt im Chat, ohne sie steht dort nur ein Link zur App.',
    an: 'Antworten erscheinen im Telegram-Chat — bequem, aber nicht Ende-zu-Ende-verschlüsselt.',
    aus: 'Nur neutrale Hinweise mit Link. Das ist die Vorgabe.',
    daten: 'Telegram läuft über einen Anbieter im Ausland; was dort ankommt, liegt dort. Die Einwilligung wird mit Zeitpunkt und Fassung festgehalten.',
  },

  // ── Protokolle und Karten der Datenschutz-Seite ────────────────────────────────────────────────────────────────────────
  'ki.protokoll': {
    was: 'Zu jedem Aufruf der KI steht hier ein Eintrag: wann, wofür, welche Datenarten, wie viele Datensätze, ob Namen ersetzt wurden. Nie der Inhalt. Aufbewahrt 12 Monate.',
    beispiel: 'Die Zeile „Aufruf · Gespräch · Aufgaben, Kalender · 14 Datensätze“ sagt: Du hast ZOE etwas gefragt, und 14 Aufgaben- und Termin-Einträge gingen als Auszug hinaus.',
    daten: '„Auskunft als Datei“ liefert dir daraus den Nachweis nach Art. 15.',
  },
  'datenschutz.verantwortlicher': {
    was: 'Die Stelle, die nach der DSGVO für die Daten verantwortlich ist (Name, Anschrift, Kontakt für Datenschutz). Sie steht in Auskünften, Hinweisen und im Verzeichnis. Nur der Inhaber trägt sie ein.',
    beispiel: 'Die Beispiel GmbH trägt Namen, Anschrift und eine Datenschutz-Adresse ein. Danach nennen Buchungsseiten und Auskünfte sie automatisch — im Code steht kein fester Name.',
  },
  'datenschutz.empfaenger': {
    was: 'Die Liste aller Dienste, an die Daten gehen (KI, Mail, Kalender, Messenger …) — mit Rolle, Zweck, Datenarten, Drittland und dem Stand des Auftragsverarbeitungsvertrags (AVV).',
    beispiel: 'Ein neuer Mail-Dienst kommt dazu: Du trägst Zweck, Daten und das Datum des AVV ein. In einer Auskunft nach Art. 15 erscheint er als Empfänger, sobald er Daten der Person bekommt.',
  },
  'datenschutz.pruefung': {
    was: 'Eine Checkliste: Was ist datenschutzrechtlich erledigt, was ist offen? Jeder offene Punkt hat einen Weg, ihn zu beheben.',
    beispiel: '„Zweiter Faktor: offen“ — ein Klick führt ins Konto, dort richtest du ihn ein, und die Zeile wird grün.',
  },
  'datenschutz.verzeichnis': {
    was: 'Das Verzeichnis der Verarbeitungstätigkeiten (Art. 30): Wofür werden welche Daten verarbeitet, an wen gehen sie, wann werden sie gelöscht. Es wächst mit den Funktionen der App mit.',
    beispiel: 'Wird die Gmail-Anbindung eingerichtet, erscheint „E-Mail (Google Workspace)“ mit Zweck, Daten und Frist. Bei einer Prüfung exportierst du das Verzeichnis als Datei.',
  },
  'datenschutz.pannen': {
    was: 'Das Register für Datenschutzvorfälle (Art. 33 Abs. 5). Es hält nur Kategorien und Anzahlen fest, keine Namen Betroffener. Nur der Inhaber sieht es.',
    beispiel: 'Eine Mail mit einer Kundenliste ging an die falsche Adresse: Du trägst Datum, Art, Anzahl der Betroffenen und die Maßnahmen ein. Die Meldung an die Aufsicht muss in der Regel binnen 72 Stunden erfolgen — Hinweis, keine Rechtsberatung.',
  },
  'datenschutz.dokumente': {
    was: 'Die mitgelieferten Datenschutz-Dokumente: technische Maßnahmen, Löschkonzept, Datenpannen-Prozess, Datenschutz-Folgenabschätzung, AVV-Vorlage. Entwürfe, anwaltlich zu prüfen.',
    beispiel: 'Ein Kunde fragt nach euren technischen Maßnahmen. Du öffnest die Datei zu den technischen Maßnahmen und schickst den Abschnitt „Zugangskontrolle“.',
  },
  'datenschutz.art14': {
    was: 'Wenn ihr Daten über eine Person habt, die sie euch nicht selbst gegeben hat, müsst ihr sie innerhalb eines Monats informieren (Art. 14). Die Vorlage ist euer Text dafür; mitgeliefert ist ein Standardtext mit Platzhaltern.',
    beispiel: 'Du übernimmst Kontakte aus einer Messeliste. MAKE OS zählt ab dem ersten Tag mit und warnt ab Tag 25; der Entwurf nennt den Verantwortlichen und die Herkunft „Messeliste“. Versendet wird nichts automatisch.',
  },
  'datenschutz.instanzende': {
    was: 'Am Vertragsende exportiert der Inhaber die Daten der Instanz und löst die Löschung aus. Der Export verlangt Passwort und zweiten Faktor; die Löschung läuft bewusst nur über ein Skript auf dem Server, nie aus der App.',
    beispiel: 'Ein Testkunde beendet den Vertrag: Du lädst den Export herunter, gibst ihn weiter und führst anschließend das Lösch-Skript mit dem Code des Tages aus.',
  },
  'datenschutz.nachweise.kette': {
    was: 'Änderungs-, Lese- und Anmeldeprotokoll hängen wie eine Kette zusammen. „Jetzt prüfen“ zeigt, ob jemand an den Protokollen etwas verändert oder entfernt hat.',
    beispiel: 'Die Prüfung meldet „Kette ok, 3 Einträge getilgt“: Drei Namen wurden rechtmäßig nach einer Löschung ersetzt — alles andere ist unverändert.',
  },
  'datenschutz.nachweise.lese': {
    was: 'Das Lese-Protokoll hält fest, wer wann auf sensible Bereiche zugegriffen hat (Gesundheit, Finanzen, Kontakte, Gesellschaften) — ohne die Inhalte selbst. 12 Monate, nur für den Inhaber.',
    beispiel: '„Kontakte · 14 Einträge · 09.10. 08:12“ sagt: Jemand hat Kontakte geöffnet. Wer, das steht daneben; was drinstand, nicht.',
  },
  'datenschutz.nachweise.verschluesselung': {
    was: 'Zeigt, ob die Daten auf dem Server verschlüsselt liegen und ob alle Bestände und Bilder schon im aktuellen Format sind.',
    beispiel: '„14 von 14 Beständen verschlüsselt“ heißt: Auf der Platte liegt nur unlesbarer Inhalt; ohne Schlüssel kann niemand die Dateien öffnen.',
  },
  'datenschutz.nachweise.v2': {
    was: 'Prüft, ob die Instanz bereit ist, auf das neue Schreibformat (v2) umzustellen. Die Umstellung macht der Inhaber bewusst von Hand, danach ist der Rückweg zum alten Stand nur noch per Sicherung möglich.',
    beispiel: '„Bereit: ja“ — dann kannst du in Ruhe umstellen. „Bereit: nein, 2 Bestände offen“ — dann zuerst die genannten Punkte erledigen.',
  },
} as const satisfies Record<string, EinstellungsText>;
