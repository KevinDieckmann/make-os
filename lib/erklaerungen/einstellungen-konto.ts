// ─── Erklärungen · Konto, Bedienung, Verbindungen, Postfach, Kalender, Medien (10.10.) ─────────────────────────────────────────
// Texte in einfachen Worten, Beispiele erfunden und neutral (keine echten Namen, Firmen, Beträge). Wo etwas Daten nach außen gibt oder
// Guthaben kostet, steht es unter „Kosten und Datenweg“.

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_KONTO = {
  // ── Konto & Sicherheit ─────────────────────────────────────────────────────────────────────────────────────────────────
  'konto.passwort': {
    was: 'Das Passwort schützt dein Konto. Zum Ändern brauchst du das alte Passwort; das neue hat mindestens 10 Zeichen.',
    beispiel: 'Du hast dein Passwort in einer Mail gefunden, die du weitergeleitet hattest. Du setzt ein neues — alle Geräte bleiben angemeldet, bis du sie über „Andere Geräte abmelden“ trennst.',
    daten: 'Das Passwort liegt nur als Hash auf dem Server — niemand kann es nachlesen, auch der Inhaber nicht.',
  },
  'konto.adressen': {
    was: 'Mit welchen E-Mail-Adressen du dich anmelden kannst. Die Hauptadresse steht überall als dein Name; bis zu drei weitere melden dich ebenfalls an.',
    beispiel: 'Du wechselst die Firmenadresse. Du fügst die neue als weitere Adresse hinzu, machst sie zur Hauptadresse und entfernst die alte — ohne neues Konto.',
    daten: 'Jede Änderung braucht dein Passwort und steht im Anmeldeprotokoll; im Protokoll steht die Adresse nur gekürzt.',
  },
  'konto.zweiFaktor': {
    was: 'Beim Anmelden gibst du zusätzlich zum Passwort einen sechsstelligen Code aus einer Authenticator-App ein. Wer dein Passwort kennt, kommt damit allein nicht hinein.',
    beispiel: 'Jemand rät dein Passwort. Er sieht den Anmeldebildschirm — und scheitert am Code, den nur dein Handy kennt.',
    an: 'Anmelden braucht Passwort und Code. Acht Wiederherstellungscodes (je einmal gültig) kommen in deinen Passwort-Manager.',
    aus: 'Das Passwort allein genügt. Für ein Login im offenen Netz ist das der schwächere Schutz.',
  },
  'konto.zweiFaktorPflicht': {
    was: 'Der Inhaber kann den zweiten Faktor für alle Konten der Instanz zur Pflicht machen. Wer noch keinen hat, richtet ihn beim nächsten Anmelden ein und kommt vorher nirgends hin.',
    beispiel: 'Ein neues Teammitglied tritt bei. Mit der Pflicht an kann es erst arbeiten, wenn es den Authenticator eingerichtet hat.',
    an: 'Jedes Konto braucht einen zweiten Faktor; Sitzungen ohne ihn dürfen nur den Faktor einrichten, sich abmelden oder das eigene Konto ansehen.',
    aus: 'Jede Person entscheidet selbst, ob sie ihn einrichtet. Für Kundendaten ist „an“ empfohlen.',
  },
  'konto.leerlauf': {
    was: 'Nach so vielen Stunden ohne Aktivität meldet MAKE OS dich ab. Spätestens nach 14 Tagen endet jede Sitzung ohnehin. Eine kürzere Zeit ist sicherer, eine längere bequemer.',
    beispiel: 'Bei 12 Stunden bleibst du über den Arbeitstag angemeldet; liegt das Laptop über Nacht offen, ist die Sitzung am Morgen beendet.',
  },
  'konto.zugangInstanz': {
    was: 'Regeln für alle Konten der Instanz: ob ein zweiter Faktor Pflicht ist und nach wie vielen Stunden ohne Aktivität die Sitzung endet. Nur der Inhaber ändert sie.',
    beispiel: 'Vor dem ersten Kunden-Konto schaltest du die Pflicht ein und setzt den Leerlauf auf 8 Stunden.',
  },
  'konto.abmeldenAlle': {
    was: 'Meldet alle anderen Geräte ab — das Gerät, an dem du gerade sitzt, bleibt angemeldet.',
    beispiel: 'Du hast dich an einem fremden Rechner angemeldet und vergessen, dich abzumelden. Ein Klick, und die Sitzung dort ist beendet.',
  },
  'konto.einladen': {
    was: 'Der Inhaber erzeugt einen Einladungslink. Die Person trägt Vorname, E-Mail und Passwort ein — fertig. Der Link gilt begrenzte Zeit und genau einmal.',
    beispiel: 'Du lädst die neue Mitarbeiterin ein, trägst ihre Adresse mit ein und gibst ihr den Link persönlich. Nach dem Einlösen ist der Link tot.',
  },
  'konto.haushalt': {
    was: 'Welche Konten zu einem Haushalt gehören und damit die privaten Finanzen des Haushalts sehen. Nur der Inhaber ordnet zu.',
    beispiel: 'Zwei Personen führen den Haushalt gemeinsam. Beide stehen im selben Haushalt und sehen dieselben Haushaltsbuchungen; ein Konto mit Business-Recht sieht sie nicht.',
  },
  'konto.inhaber': {
    was: 'Wer Inhaber der Instanz ist: Einladen, Zugang der Instanz, Datenschutz-Einstellungen und Verträge liegen bei dieser Rolle. Es kann mehrere Inhaber geben, einen Haupt-Inhaber.',
    beispiel: 'Der Haupt-Inhaber ernennt eine zweite Person zur Inhaberin, damit im Urlaub jemand den Zugang verwalten kann.',
  },
  'konto.gesundheitTeilen': {
    was: 'Wer deine Recovery, dein Journal und deine Tagebücher sehen darf. Du entscheidest je Person mit einem Haken; ohne Haken sieht niemand etwas.',
    beispiel: 'Du setzt den Haken bei deinem Partner: Er sieht deine Erholungszahl auf seiner Seite. Seine ZOE darf sie nur abfragen, wenn du zusätzlich Einwilligung (c) erteilt hast.',
    daten: 'Die Einwilligungen (a), (b), (c) stehen unter System › Datenschutz.',
  },
  'konto.zieleTeilen': {
    was: 'Wer deine eigenen Ziele lesen darf — nicht die gemeinsamen. Vorgabe: niemand. Du entscheidest je Person.',
    beispiel: 'Du hältst ein persönliches Ziel fest („Dieses Jahr zweimal den Berg besteigen“) und teilst es mit deiner Partnerin: Sie sieht es in der Planung, kann es aber nicht ändern.',
  },
  'konto.telegram': {
    was: 'Koppelt dein Telegram mit MAKE OS. ZOE schreibt dir dann morgens, mittags und abends aufs Handy, und du antwortest mit einem Satz. Es kommen nur neutrale Hinweise mit Link, wenn du die Ausnahme nicht einschaltest.',
    beispiel: 'Du sendest dem Bot den Code „/start 123456“. Danach kommt jeden Morgen „Dein Tag in MAKE OS“ mit einem Link.',
    daten: 'Telegram läuft über einen Anbieter im Ausland. Was inhaltlich hinausgehen darf, regelt System › Datenschutz › Telegram.',
  },
  'konto.meineDaten': {
    was: 'Deine Rechte nach der DSGVO an einer Stelle: Auskunft (was ist über mich gespeichert), Herunterladen, Konto löschen. Folgenschwere Schritte verlangen noch einmal dein Passwort und, falls an, den zweiten Faktor.',
    beispiel: 'Du verlässt das Team. Du lädst deine Daten herunter und löschst dein Konto; Einträge, die andere betreffen, bleiben ohne deinen Namen bestehen.',
  },
  'konto.team': {
    was: 'Wer im Team welche Rolle trägt — zum Beispiel für Zuständigkeiten in der Markttraktion, Kapazität und Aufgaben. Das Team steht in den Daten der Instanz, nicht im Code.',
    beispiel: 'Du legst „Mira — Vertrieb, 30 Stunden“ an. In der Kapazität zählt sie ab sofort mit, und beim Zuständig-Feld kann man sie wählen.',
  },

  // ── Bedienung (je Gerät) ───────────────────────────────────────────────────────────────────────────────────────────────
  'bedienung.wischen': {
    was: 'Am Handy löst Wischen einer Listenzeile nach links oder rechts eine Aktion aus (Archivieren, Löschen, „⋯“-Menü). Du wählst, was in welche Richtung passiert. Gilt nur für dieses Gerät.',
    beispiel: 'Du wischst eine Aufgabe nach links: Ist „Archivieren“ gewählt, verschwindet sie ins Archiv und unten steht zehn Sekunden „Rückgängig“.',
  },
  'bedienung.loeschen': {
    was: 'Legt fest, ob vor dem Löschen eine Rückfrage kommt. Aus: Es wird gleich gelöscht (in den Papierkorb, wo es einen gibt), und unten steht zehn Sekunden „Rückgängig“.',
    beispiel: 'Du räumst die Aufgabenliste auf. Ohne Rückfrage löschst du zehn Einträge in einer Minute; ein Fehlgriff lässt sich mit „Rückgängig“ sofort zurücknehmen.',
    an: 'Jede Löschung fragt vorher nach — sicherer, aber langsamer.',
    aus: 'Es wird sofort gelöscht, mit zehn Sekunden Rückgängig. Listen, bei denen etwas daran hängt, fragen trotzdem immer.',
  },
  'bedienung.mehr': {
    was: 'Das Menü „⋯“ einer Zeile steht am Rechner sonst nur beim Überfahren der Zeile oder mit der Tab-Taste. Am Handy steht es immer.',
    beispiel: 'Du arbeitest am Rechner mit der Maus und willst auf einen Blick sehen, welche Zeilen ein Menü haben: „Immer sichtbar“ zeigt den Punkt an jeder Zeile.',
    an: '„⋯“ steht an jeder Zeile sichtbar.',
    aus: 'Es erscheint erst, wenn du die Zeile überfährst — die Liste wirkt ruhiger.',
  },
  'bedienung.dichte': {
    was: 'Wie viel Luft Listenzeilen haben. Kompakt zeigt mehr Zeilen auf einmal; jede Zeile bleibt mindestens 44 Pixel hoch und damit gut zu treffen.',
    beispiel: 'Auf einem kleinen Laptop passen in der Aufgabenliste mit „Kompakt“ zwei bis drei Zeilen mehr auf den Bildschirm.',
  },
  'bedienung.haptik': {
    was: 'Ein kurzes Vibrieren am Handy, sobald das Wischen auslösen wird, und wenn es auslöst. Das geht nicht in jedem Browser (nicht im iPhone-Safari).',
    beispiel: 'Du wischst eine Zeile langsam nach links: Bei etwa einem Drittel vibriert das Handy kurz — jetzt löst das Loslassen die Aktion aus.',
    an: 'Du spürst, wann ein Wisch zählt, ohne hinzusehen.',
    aus: 'Kein Vibrieren — leiser, spart Akku.',
  },

  // ── Verbindungen, Postfächer, ZOE auf WhatsApp ─────────────────────────────────────────────────────────────────────────
  'postfach.teilen': {
    was: 'Ein Business-Postfach mit dem Team teilen: Alle im Haushalt mit Zugang zu diesem Bereich sehen die Gespräche, antworten als dieses Postfach und tragen ein, wer sich kümmert. Dein Passwort, der Abgleich und das Senden bleiben bei dir.',
    beispiel: 'Das Postfach „Anfragen“ ist geteilt: Eine Kollegin sieht eine neue Anfrage, trägt sich als zuständig ein und antwortet — das Passwort hat nur die Person, die das Postfach verbunden hat.',
    an: 'Das Team liest und beantwortet die Gespräche dieses Postfachs.',
    aus: 'Nur du siehst das Postfach. Private Postfächer bleiben immer privat.',
    daten: 'Die Nachrichten liegen als Kopie in MAKE OS; mit dem Teilen sehen sie auch die anderen Personen mit Zugang zum Bereich.',
  },
  'postfach.aufgabenVorschlaege': {
    was: 'MAKE OS liest die jüngste Nachricht deiner Gespräche (eigene Postfächer und Team-Gespräche, um die du dich kümmerst) und erkennt ohne KI, ob darin eine Frist, eine Bitte, eine Frage an dich oder eine Rechnung/ein Vertrag steckt. Daraus wird ein Vorschlag in DEINEN Freigaben — die Aufgabe entsteht erst mit deinem Klick, mit Link zurück ins Gespräch.',
    beispiel: 'Eine Kundin schreibt „Können Sie mir das Angebot bis Freitag schicken?“. In deinen Freigaben liegt „Aufgabe aus der Inbox — Frist Fr.“; ein Klick legt „Angebot …“ mit Fälligkeit Freitag an.',
    an: 'Alle 15 Minuten prüft MAKE OS neue Nachrichten und legt Vorschläge ab (jede Nachricht nur einmal, höchstens fünf je Durchgang).',
    aus: 'Vorschläge nur, wenn du in der Inbox auf „Vorschläge holen“ klickst.',
    daten: 'Ohne KI und ohne Versand: der Text bleibt in MAKE OS, ins Protokoll gehen nur Kennungen. Andere Personen sehen deine Vorschläge nie.',
  },
  'zoe.whatsapp': {
    was: 'Dein persönlicher Draht zu ZOE auf WhatsApp. ZOE hat eine eigene Business-Nummer; du verbindest deine Handynummer mit einem einmaligen Code. Danach bekommst du Hinweise und kannst ihr dort Fragen schicken.',
    beispiel: 'Du schreibst ZOE morgens „Was steht heute an?“ Ohne die Ausnahme „Inhalte senden“ antwortet sie mit einem neutralen Hinweis und einem Link zur App — den Inhalt siehst du erst nach dem Öffnen.',
    daten: 'Nur du verbindest deine Nummer; jede Person hat ihren eigenen Kanal. Trennen jederzeit hier oder mit „STOP“ an die Nummer.',
  },
  'zoe.whatsapp.einwilligung': {
    was: 'Du erlaubst ZOE, dir über ihre WhatsApp-Nummer Hinweise zu schicken (Morgenbriefing, Erinnerungen) und deine Nachrichten an diese Nummer zu verarbeiten. „Aufgabe: …“ und „Notiz: …“ legt sie als Vorschlag in deine Freigaben.',
    beispiel: 'Du schreibst ZOE: „Aufgabe: Angebot an Beispiel GmbH nachfassen“. Sie legt einen Vorschlag in deine Freigaben; angelegt wird erst, wenn du zustimmst.',
    an: 'ZOE erreicht dich auf WhatsApp. Es kommen neutrale Hinweise mit Link, solange du die Ausnahme „Inhalte senden“ nicht einschaltest.',
    aus: 'ZOE schreibt dir nicht auf WhatsApp; ohne Einwilligung gibt es den Code gar nicht.',
    daten: 'Meta (WhatsApp Ireland) verarbeitet deine Nummer und die Nachrichten als Auftragsverarbeiter; Verarbeitung auch außerhalb der EU möglich, gespeichert höchstens 30 Tage. Widerruf jederzeit: „STOP“ an die Nummer oder hier „Trennen“.',
  },
  'zoe.whatsapp.inhalte': {
    was: 'Eine Ausnahme: ZOE schickt Antworten, Briefings und Erinnerungen im Wortlaut über WhatsApp statt nur eines Hinweises mit Link.',
    beispiel: 'Du fragst unterwegs „Was steht heute an?“. Mit der Ausnahme steht die Liste direkt im Chat; ohne sie kommt nur „Antwort in MAKE OS“ mit Link.',
    an: 'Der Wortlaut liegt bei Meta (höchstens 30 Tage) und auf deinem Handy — auch wenn er Gesundheits-, Kontakt-, Finanz- oder Vertragsangaben enthält.',
    aus: 'Nur neutrale Hinweise mit Link. Das ist die Vorgabe.',
    daten: 'Nicht Ende-zu-Ende-verschlüsselt gegenüber Meta; die Einwilligung wird mit Zeitpunkt und Fassung festgehalten.',
  },
  'dienste.zulieferer': {
    was: 'Der Mac-Zulieferer holt Apple-Erinnerungen vom Mac und liefert sie an den Server. Kalender und Mail holt der Server selbst. Du übernimmst die Erinnerungen als Aufgaben.',
    beispiel: 'Du hast auf dem Mac die Liste „Einkauf“. Du wählst sie dem Space Privat zu und setzt „nur ich“: Die Einträge erscheinen als private Aufgaben, die nur du siehst.',
  },
  'zulieferer.nurIch': {
    was: 'Übernommene Erinnerungen im Space Privat sind dann nur für dich sichtbar, nicht für den Rest des Haushalts.',
    beispiel: 'Die Erinnerungsliste „Geschenke“ soll eine Überraschung bleiben: Mit „nur ich“ sieht niemand sonst die Aufgaben.',
    an: 'Die übernommenen Privat-Aufgaben sind nur für dich sichtbar.',
    aus: 'Sie sind für den Haushalt sichtbar, wie andere private Aufgaben auch.',
  },
  'zulieferer.erledigte': {
    was: 'Nimmt auch schon erledigte Erinnerungen mit.',
    beispiel: 'Du willst die Historie der letzten Monate behalten: Mit „an“ erscheinen auch abgehakte Erinnerungen als erledigte Aufgaben.',
    an: 'Erledigtes wird mit übernommen — nützlich, wenn du die Historie willst.',
    aus: 'Nur offene Erinnerungen kommen herüber. Die Aufgabenliste bleibt aufgeräumt.',
  },

  // ── Kalender ───────────────────────────────────────────────────────────────────────────────────────────────────────────
  'kalender.icloud': {
    was: 'Verbindet deine iCloud-Kalender mit MAKE OS. Dafür brauchst du ein app-spezifisches Passwort von Apple (nie dein normales Apple-Passwort). MAKE OS prüft die Anmeldung bei Apple, bevor etwas gespeichert wird.',
    beispiel: 'Du erzeugst auf appleid.apple.com ein App-Passwort „MAKE OS“ und trägst es ein. Danach erscheinen deine Termine im Kalender — andere sehen sie nur als „Belegt“.',
    daten: 'Das Passwort liegt verschlüsselt auf dem Server und geht nur an iCloud.',
  },
  'kalender.einstellungen': {
    was: 'Hier verbindest du Kalender, ordnest sie Personen und Bereichen zu und legst fest, welche als „belegt“ zählen. Alles hier wirkt auf Kalender, Heute, Planung, Buchungsseiten und die Suche nach freier Zeit.',
    beispiel: 'Du verbindest deinen Google-Kalender und ordnest ihn dem Bereich Business zu: Kundentermine erscheinen in der Business-Sicht und blockieren die Buchungsseite.',
  },
  'kalender.zuordnung': {
    was: 'Wie der Kalender einer Person (oder „Beide“, also Gemeinsam) in deiner Kalender-App heißt. MAKE OS legt Termine dieser Person in den Kalender mit genau diesem Namen. Die Namen müssen genau so heißen wie in der Kalender-App.',
    beispiel: 'Der Kalender der ersten Person heißt in Apple „Mira“. Trägst du „Mira“ ein, landet ihr Plan-Block in diesem Kalender.',
  },
  'kalender.dauer': {
    was: 'Wie lang ein neuer Termin ist, wenn du nichts anderes angibst. Ziehst du im Raster eine Spanne auf, gilt die gezogene Dauer.',
    beispiel: 'Bei 60 Minuten legt ein Klick auf 10:00 einen Termin von 10:00 bis 11:00 an.',
  },
  'kalender.space': {
    was: 'Ordnet jeden Kalender einem Bereich zu: Privat oder Business. Danach zeigt die Kalenderseite je Sicht (Alles · Privat · Business) nur die passenden Termine.',
    beispiel: '„Familie“ ist Privat, „Kunden“ ist Business. In der Business-Sicht erscheinen nur die Kundentermine.',
  },
  'kalender.zeigen': {
    was: 'Welche deiner iCloud-Kalender in MAKE OS erscheinen. Aus: Der Kalender wird nicht angezeigt und nicht abgeglichen.',
    beispiel: 'Du hast einen Kalender „Geburtstage Freunde“, den du hier nicht brauchst. Schaltest du ihn aus, taucht er nicht im Raster auf.',
    an: 'Die Termine erscheinen in Kalender, Heute und Planung; andere sehen sie nur als „Belegt“.',
    aus: 'MAKE OS kennt diesen Kalender nicht — Termine daraus zählen auch nicht für freie Zeit.',
  },
  'kalender.blockkalender': {
    was: 'In welchen deiner Kalender die Blöcke aus Planen und von ZOE geschrieben werden (Fokuszeit, Routinen, Aufgaben-Blöcke).',
    beispiel: 'Du wählst „Arbeit“. Ein Fokus-Block am Dienstag um 9 Uhr erscheint dort — auch auf deinem iPhone. Andere im Haushalt sehen ihn nur als „Belegt“.',
  },
  'kalender.belegt': {
    was: 'Welche Kalender als „belegt“ zählen, wenn MAKE OS freie Zeit sucht oder die Buchungsseite Plätze anbietet. Ein Kalender ohne Zuordnung blockiert niemanden, bis du ihn einschaltest.',
    beispiel: 'Dein Kalender „Sport“ zeigt nur Hobbys. Du schaltest ihn aus: Auf der Buchungsseite bleiben die Stunden frei, obwohl dort etwas steht.',
  },
  'kalender.freieTage': {
    was: 'Tage, die kein gesetzlicher Feiertag sind, an denen ihr aber nicht arbeitet (zum Beispiel 24.12. und 31.12.). Sie sperren Buchungsseite und die Suche nach freier Zeit wie ein Feiertag.',
    beispiel: 'Du trägst „27.12. Betriebsruhe“ ein. Die Buchungsseite bietet an diesem Tag keine Plätze mehr an.',
  },
  'kalender.zeilenhoehe': {
    was: 'Wie hoch eine Stunde im Raster von Tag, 4 Tagen und Woche ist. Kompakt zeigt mehr Stunden auf einen Blick, Groß macht kurze Termine besser lesbar. Gilt nur für dieses Gerät; feiner geht es mit Strg/⌘ + Mausrad oder zwei Fingern im Raster.',
    beispiel: 'Am Laptop wählst du Kompakt und siehst 7 bis 20 Uhr ohne Rollen. Am großen Monitor stellst du Groß ein, damit auch 15-Minuten-Termine ihren Titel zeigen.',
  },
  'kalender.aufgabenOhneZeit': {
    was: 'Aufgaben ohne Uhrzeit stehen in der Ganztags-Zeile über dem Raster und im Monat, Aufgaben mit Start als Balken bis zur Deadline. Aufgaben mit Uhrzeit bleiben immer als Block im Raster. Gilt nur für dieses Gerät.',
    beispiel: 'In einer vollen Woche liegen zwölf Aufgaben ohne Uhrzeit oben. Du schaltest sie aus und siehst nur noch Termine und eingeplante Aufgaben; abhaken kannst du weiter im Aufgaben-Modus.',
    an: 'Aufgaben ohne Uhrzeit erscheinen in der Ganztags-Zeile und im Monat.',
    aus: 'Die Ganztags-Zeile zeigt nur Termine, Feiertage, Geburtstage und Fristen — die Aufgaben selbst ändern sich nicht.',
  },
  'kalender.hilfe': {
    was: 'Eine Zeile unter dem Raster erklärt die Bedienung: Klick in eine Lücke legt an, aufziehen wählt die Zeit, anfassen verschiebt, wischen blättert. Gilt nur für dieses Gerät; das Fragezeichen oben links im Raster schaltet sie ebenso.',
    beispiel: 'Eine neue Person im Haushalt lernt den Kalender kennen und lässt die Hilfe an. Wer die Griffe kennt, schaltet sie aus und gewinnt eine Zeile für das Raster.',
    an: 'Die Bedienungshilfe steht unter dem Raster.',
    aus: 'Das Raster bekommt die Zeile; die Hilfe kommt über das Fragezeichen oben links zurück.',
  },
  'kalender.google': {
    was: 'Verbindet deinen Google Kalender (Workspace) für Business-Termine, in beide Richtungen. Privat, Familie und Gemeinsam bleiben in MAKE OS und iCloud.',
    beispiel: 'Ein Kunde lädt dich per Google-Kalender ein. Der Termin erscheint in MAKE OS; legst du hier einen Business-Termin an, steht er in deinem Google Kalender.',
    daten: 'Die Anmeldung läuft über Google (OAuth); MAKE OS bekommt nur Kalenderrechte. Trennen widerruft sie bei Google.',
  },

  // ── Glocke ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  'glocke.telegram': {
    was: 'Die Glocke soll dich zusätzlich per Telegram anstupsen. Heute ist das nur vorbereitet: Es wird noch nichts gesendet, die Einstellung merkt sich deinen Wunsch. Telegram selbst koppelst du im Konto.',
    beispiel: 'Du setzt den Haken. Sobald der Versand läuft, kommt „Neue Freigabe in MAKE OS“ mit Link aufs Handy — heute passiert noch nichts.',
    an: 'Dein Wunsch ist gespeichert; zugestellt wird, sobald der Versand freigeschaltet ist.',
    aus: 'Die Glocke bleibt in MAKE OS.',
    daten: 'Telegram bekäme nur neutrale Hinweise mit Link (System › Datenschutz › Telegram), keine Inhalte.',
  },

  // ── Medien (Fotos & Videos) ────────────────────────────────────────────────────────────────────────────────────────────
  'medien.minderjaehrig': {
    was: 'Zeigt das Foto oder Video eine minderjährige Person, willigen die Sorgeberechtigten ein. Ohne ihre Einwilligung wird nie freigegeben.',
    beispiel: 'Bei einer Veranstaltung entsteht ein Foto vom Nachwuchs-Team. Du hakst „Minderjährige Person“ an und trägst die sorgeberechtigte Person ein; erst mit ihrer Zustimmung ist das Bild nutzbar.',
    an: 'Der Name der sorgeberechtigten Person ist Pflicht; die Einwilligung gilt für sie.',
    aus: 'Die abgebildete Person willigt selbst ein.',
    daten: 'Minderjährige gehen nie an eine Bild-KI.',
  },
  'medien.ton': {
    was: 'Behält bei Videos den Ton. Ohne Ton wird nur das Bild gespeichert.',
    beispiel: 'Ein Kurzvideo vom Messestand: Mit Ton hört man die Gespräche im Hintergrund — überlege, ob alle dem zugestimmt haben.',
    an: 'Der Ton bleibt erhalten; es können Stimmen Dritter zu hören sein.',
    aus: 'Nur das Bild bleibt — datensparsamer.',
  },
  'medien.original': {
    was: 'Erlaubt Videos in Originalauflösung (4K). Sie sind sehr groß; empfohlen ist in der Kamera 1080p/30 (HEVC).',
    beispiel: 'Ein 4K-Video einer Minute kann so viel Platz brauchen wie 50 Fotos. Für Social Media reicht fast immer 1080p.',
    an: '4K wird angenommen — mehr Speicher, längere Übertragung.',
    aus: 'Videos werden auf ein praxistaugliches Format verkleinert.',
  },
  'medien.extern': {
    was: 'Das Foto stammt von einer fremden Fotografin oder einem fremden Fotografen. Dann ist vor jeder Freigabe der Lizenz-Nachweis als Datei Pflicht.',
    beispiel: 'Ein Messefotograf liefert Bilder. Du lädst sie mit der Lizenz-PDF hoch; ohne die Lizenz bleibt jedes Bild gesperrt.',
    an: 'Der Nachweis (Lizenz) muss hochgeladen sein, bevor ein Bild freigegeben wird.',
    aus: 'Das Bild gilt als eigenes Material.',
  },

  // ── Chat ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
  'chat.vorlesen': {
    was: 'Liest Antworten laut vor (Sprachausgabe deines Geräts). Das Mikrofon für Sprechen ist davon getrennt.',
    beispiel: 'Du kochst und fragst per Sprache nach dem Tag. Mit „Vorlesen“ hörst du die Antwort, statt aufs Display zu sehen.',
    an: 'Neue Antworten werden vorgelesen.',
    aus: 'Antworten erscheinen nur als Text.',
    daten: 'Die Sprachausgabe läuft auf deinem Gerät — es geht nichts an einen weiteren Dienst.',
  },
} as const satisfies Record<string, EinstellungsText>;
