// ─── Erklärungen · Onboarding-Schritte (10.10.) ────────────────────────────────────────────────────────────────────────────
// Zu „Warum“ und „Wie“ jedes Schritts (lib/make-one/onboarding-data.ts) kommt ein Fallbeispiel: ein erfundener, kurzer Fall, wie der Schritt
// im Alltag aussieht. Kennungen wie im Plan (`schrittMitId`); lib/make-one/onboarding-data.ts hängt den Text als `Schritt.beispiel` an
// (EINE Zuordnung am Ende von SCHRITTE). Neuer Schritt = hier ein Eintrag (Wächter tests/erklaerungen.test.ts). Keine echten Namen, Firmen,
// Beträge oder Gesundheitsangaben — „Beispiel GmbH“ und „Mira“ sind erfunden.

export const SCHRITT_BEISPIELE: Readonly<Record<string, string>> = {
  // ── Etappe 0 · Server (Inhaber) ────────────────────────────────────────────────────────────────────────────────────────
  update: 'Am Abend sicherst du den Server, führst „entwicklung“ nach „main“ zusammen und siehst fünf Minuten später in der Aktions-Liste „grün“. Der Head of IT zeigt die neue Bau-Kennung.',
  pepper: 'Du erzeugst am Mac einen langen Zufallswert, legst ihn in zwei Passwort-Manager und trägst ihn am Server ein. Löscht jemand später eine Person, bleibt ihr Fingerabdruck nicht erratbar.',
  altbestand: 'Die Instanz trägt noch ein Profil im Code. Nach dem Schritt liegt es als normaler Eintrag in den Daten der Person — und ist aus dem Code verschwunden.',
  sicherung: 'Nachts um 3:15 packt der Server alle Daten verschlüsselt in ein Archiv. Fällt der Server aus, spielt ihr die letzte Nachtsicherung zurück und verliert höchstens einen Tag.',
  'sicherung-mac': 'Montags holt der Mac die neueste Sicherung ab. Einmal im Quartal spielt ihr eine Sicherung in einen Testordner zurück, um zu sehen, dass sie wirklich funktioniert.',
  vault: 'Eure Notizen liegen bisher auf einem Laptop. Nach dem Umzug liegen sie auf dem Server; ZOE findet sie dort und legt ihre Vorschläge im Eingangsordner ab.',
  adresse: 'Ihr tragt die Adresse eurer Instanz ein. Einladungslinks, Buchungsseiten und Mails zeigen danach auf diese Adresse statt auf eine Test-Adresse.',
  'whoop-app': 'Ihr legt bei WHOOP einmal eine Anwendung für die Instanz an. Danach verbindet jede Person ihr eigenes WHOOP-Konto mit einem Klick.',
  'google-app': 'In der Google-Konsole erlaubt ihr den Zugriff auf Kalender und Mail für eure Domain. Danach kann jede Person ihr Google-Konto verbinden.',
  notfallmappe: 'Auf Papier und im Passwort-Manager liegen: Zugang zum Server, Wiederherstellungscodes und wer im Ernstfall anzurufen ist. Jede Person kann von dort aus handeln.',
  medienspeicher: 'Eure Fotos und Videos sind größer als der freie Platz auf dem Server. Der Objektspeicher nimmt sie verschlüsselt und getrennt von den anderen Daten auf.',

  // ── Etappe 1 · Zugang und Sicherheit ───────────────────────────────────────────────────────────────────────────────────
  'zweite-einladung': 'Du bekommst einen Link, trägst Namen und Passwort ein und bist drin — mit einem eigenen Konto, getrennt von allen anderen.',
  'ich-zwei-faktor': 'Du scannst in deiner Authenticator-App einen Code und tippst beim nächsten Anmelden die sechs Ziffern ein. Ein gestohlenes Passwort allein reicht dann nicht mehr.',
  einladen: 'Du lädst eine Kollegin ein. Sie bekommt einen Link, der einmal gilt, und richtet ihr Konto selbst ein.',
  haushalt: 'Zwei Konten bilden einen Haushalt und sehen die Haushaltsfinanzen gemeinsam. Ein Konto nur fürs Business sieht sie nicht.',
  'zwei-faktor-pflicht': 'Ihr schaltet die Pflicht ein. Ab dem nächsten Anmelden kommt jede Person zuerst zur Einrichtung des zweiten Faktors.',
  datenschutz: 'Ihr tragt die Beispiel GmbH als Verantwortliche ein und prüft die Dienste, an die Daten gehen. Auskünfte und Buchungsseiten nennen den Verantwortlichen danach automatisch.',
  'ki-instanz': 'Ihr entscheidet, ob automatische Läufe und Web-Suche an sind und welche Bereiche die KI lesen darf. Jede Person kann das für sich weiter einschränken.',
  'ich-sicht': 'Du teilst deine Erholung mit deinem Partner, deine eigenen Ziele aber nicht. Er sieht die Erholungszahl, deine Ziele bleiben unsichtbar.',
  'ich-gesundheit': 'Du willigst in (a) ein und lässt (b) und (c) aus. Deine Werte erscheinen in der App, die KI und die anderen sehen sie nicht.',
  'ich-ki': 'Du schaltest für dich die Web-Suche aus: Recherchen laufen dann ohne Internet. Die anderen sind davon nicht betroffen.',
  'ich-handy': 'Du legst MAKE OS auf den Home-Bildschirm und koppelst Telegram. Morgens kommt eine kurze Nachricht mit Link.',
  'weitere-inhaber': 'Die zweite Person wird Inhaberin und kann Konten, Datenschutz und Agenten verwalten — gleichwertig, nur der Haupt-Inhaber behält Altbestand und Systemläufe.',
  'ssh-zweiter-schluessel': 'Die zweite Inhaberin erzeugt auf ihrem Laptop einen Schlüssel; ihr tragt den öffentlichen Teil am Server ein. Sie kann dann selbst Updates einspielen, ohne ein Passwort zu teilen.',

  // ── Etappe 2 · Verbindungen ────────────────────────────────────────────────────────────────────────────────────────────
  'ich-icloud': 'Du erzeugst bei Apple ein App-Passwort und trägst es ein. Danach siehst du deine privaten Termine in MAKE OS; andere sehen sie nur als „Belegt“.',
  'ich-google': 'Du verbindest deinen Google-Kalender. Ein Termin, den ein Kunde dir schickt, erscheint in MAKE OS; legst du einen Business-Termin an, steht er in Google.',
  'ich-gmail': 'Du verbindest Gmail. Neue Mails erscheinen in der Inbox, du ordnest sie einer Kontaktakte zu und antwortest direkt.',
  'ich-postfaecher': 'Du verbindest ein zweites Postfach und ordnest es dem Bereich „Business“ zu. Mails daraus erscheinen nur in der Business-Sicht.',
  'kalender-zuordnen': 'Du ordnest den Kalender „Familie“ dem Bereich Privat zu und den Kalender „Kunden“ dem Business. Die Kalenderseite zeigt je Sicht die richtigen Termine.',
  'ich-woanders': 'Dienstags und donnerstags bist du beim Kunden vor Ort. Du trägst die Zeit als „woanders belegt“ ein; die Kapazität rechnet sie ab.',
  'ich-whoop': 'Du verbindest WHOOP. Am Morgen stehen Schlaf und Recovery ohne Handeintrag in deinem Gesundheits-Index.',
  'mail-umzug': 'Ihr zieht die Mails eurer Domain von einem alten Anbieter zu Google um — in einem eigenen Termin, nicht nebenbei. Danach laufen alle Postfächer an einem Ort.',
  whatsapp: 'Ihr richtet eine Business-Nummer bei Meta ein. Kunden schreiben dorthin; die Nachrichten erscheinen in der Inbox, und ZOE schlägt Antworten vor — gesendet wird erst mit Klick.',

  // ── Etappe 3 · Zahlen und Gesellschaften ───────────────────────────────────────────────────────────────────────────────
  stichtag: 'Ihr legt einen Monatsersten fest, ab dem die Zahlen neu zählen. Alles davor bleibt gespeichert und sichtbar, zählt aber nicht mehr mit.',
  steckbrief: 'Du trägst für die Beispiel GmbH Rechtsform, Sitz, Register und Geschäftsjahr ein. Spätere Seiten lesen die Angaben von dort.',
  register: 'Du hältst fest, wer Gesellschafter ist, wer Geschäftsführer, welche Beschlüsse gefasst wurden und bis wann ein Vertrag kündbar ist. Die Kündigungsfrist erscheint als Erinnerung.',
  absender: 'Du wählst, mit welchem Briefkopf Angebote rausgehen: Name, Anschrift und Bankverbindung der richtigen Gesellschaft.',
  eroeffnung: 'Zum Stichtag stehen auf dem Konto 25.000 €, und zwei Rechnungen sind offen. Du trägst das als Anfangsbestand ein; ab dem Stichtag rechnet die Gesellschaft neu.',
  monatsabschluss: 'Anfang jedes Monats trägst du Umsatz und Kosten des Vormonats ein. Der Business-Index vergleicht sie danach mit dem Plan.',
  kontostaende: 'Am Monatsersten trägst du den Kontostand ab. Die Liquiditätsvorschau startet damit und bleibt aktuell.',
  'offene-posten': 'Zwei Kunden haben noch nicht bezahlt. Du trägst Betrag und Fälligkeit ein; die Vorschau rechnet den Geldeingang für diesen Tag ein.',
  'business-grundlagen': 'Du trägst Jahresziel, Zahl der Mitarbeitenden und Zielsätze ein. Der Business-Index kann damit Kennzahlen messen, die sonst grau blieben.',
  'ich-privatkonten': 'Du lädst einen Kontoauszug als Datei hoch. MAKE OS ordnet die Buchungen vor; du bestätigst oder änderst die Zuordnung.',
  'privat-fixkosten': 'Miete, Versicherungen und Abos stehen als Fixkosten. Das Budget zeigt, was im Monat frei bleibt; Schulden und Rücklage fließen in die Runway ein.',

  // ── Etappe 4 · Markttraktion ───────────────────────────────────────────────────────────────────────────────────────────
  team: 'Du legst Mira als Vertrieb mit 30 Stunden an. Sie erscheint bei Zuständigkeiten und in der Kapazität.',
  kartei: 'Du lädst eine Excel-Liste mit Kontakten hoch. MAKE OS erkennt Dubletten, legt Firmen an und zeigt dir die Konflikte zum Entscheiden.',
  produkte: 'Du legst „Beratung Paket M“ mit Preis, Laufzeit und Leistungstext an. Angebote und der Finanzplan lesen es von dort.',
  mandate: 'Für die Beispiel GmbH läuft ein Mandat über 6 Monate zu 3.000 € im Monat. Es erscheint in der Kapazität und im Umsatz.',
  deals: 'Ein offener Deal „Beispiel AG, Paket L“ steht in der Stufe „Angebot“ mit dem nächsten Schritt „Anruf Donnerstag“. Die Pipeline rechnet ihn gewichtet mit.',
  vertrieb: 'Du legst fest, wie oft Kontakte nachgefasst werden und welche Fragen einen Lead zum SQL machen. Power Hour und Scoring richten sich danach.',
  'ich-visitenkarte': 'Du pflegst Name, Titel und Logo. Auf dem Event zeigst du den QR-Code, und der Kontakt landet bei deinem Gegenüber.',
  'ich-buchungsseite': 'Du richtest eine Seite „30 Minuten Kennenlernen“ ein. Interessenten buchen freie Zeiten selbst; die Buchung erscheint als Anfrage zur Freigabe.',

  // ── Etappe 5 · Ziele, Planung, Finanzplan ──────────────────────────────────────────────────────────────────────────────
  jahresziele: 'Der Nordstern lautet „Wir wachsen ruhig und profitabel“. Darunter stehen zwei Jahresziele mit Zahl und Termin.',
  zahlenziele: 'Das Jahresziel „10 Neukunden“ wird auf Quartale und Monate heruntergerechnet. So seht ihr jeden Monat, ob ihr im Plan seid.',
  'meilensteine-fokus': 'Zum Ziel „10 Neukunden“ legst du den Meilenstein „Angebotsvorlage fertig“ mit einem Termin in sechs Wochen an; der Fokus der Woche zeigt ihn.',
  finanzplan: 'Du lädst deinen Plan als Tabelle hoch. Die Zahlen erscheinen im Blatt; jede Zelle lässt sich von Hand überschreiben, ohne die Formeln zu zerstören.',
  steuerprofil: 'Du wählst Rechtsform und Hebesatz. Die Steuerzeilen im Plan rechnen danach mit euren Sätzen — als Näherung, nicht als Steuerberatung.',
  selbststaendigkeit: 'Du trägst Umsatz und Kosten der ersten neun Monate des Jahres ein. Das ist die Grundlage für die Steuerlage des Jahres.',
  'finanzplan-business': 'Du legst für die Beispiel GmbH Bausteine an: ein Produkt mit Preis und Menge, eine Stelle mit Kosten. Der Plan zeigt Liquidität und Ergebnis.',
  'ich-arbeitsrahmen': 'Du trägst ein, dass du 32 Stunden arbeitest, dienstags nachmittags frei bist und im Büro bist. Kapazität und Planung rechnen damit.',
  'mandate-kapazitaet': 'Mira arbeitet 12 Stunden pro Woche für die Beispiel GmbH. Diese Stunden zählen in ihrer Kapazität nicht mehr als frei.',
  'ich-routinen': 'Du legst „Wochenplan prüfen“ montags um 8 Uhr an. Die Routine erscheint in deiner Tagesliste.',
  rhythmen: 'Ihr legt ein gemeinsames Wochengespräch am Wochenende fest. Es erscheint für beide im Kalender und in der Planung.',
  kompass: 'Ihr stellt die Lage auf „Aufbau“ und passt die Tageslast an. Aufgaben, Tagesplan und Postfach richten sich danach.',
  projekte: 'Im Space „Business“ legst du das Projekt „Website“ mit den Listen „Texte“ und „Technik“ an. Aufgaben landen danach an der richtigen Stelle.',
  'ich-aufgaben': 'Du gehst deine offenen Aufgaben durch, löschst Veraltetes und gibst den wichtigen eine Frist. Danach ist „Heute“ ehrlich.',

  // ── Etappe 6 · Gesundheit und Familie ──────────────────────────────────────────────────────────────────────────────────
  'ich-gesundheit-profil': 'Du legst fest, welche Kennzahlen dir wichtig sind, und schaltest ein Tagebuch ein. Der Gesundheits-Index zählt nur, was du misst.',
  'ich-kopf-energie': 'Du erlaubst, dass deine Erholung als Faktor in die Teamkapazität eingeht. Das Team sieht nur den Faktor, nie deine Zahl.',
  'ich-gesundheit-agent': 'Du schreibst dem Agenten, was du willst („Mehr Ausdauer bis Juni“), und lädst einen Trainingsplan hoch. Seine Vorschläge berücksichtigen beides.',
  'familie-rahmen': 'Ihr legt fest, an welchen Abenden ihr frei halten wollt. Die Planung vermeidet dort Business-Termine.',
  'familie-menschen': 'Du trägst den Geburtstag deiner Schwester ein. Am Vortag bekommst du eine Erinnerung und einen Vorschlag für ein Geschenk.',

  // ── Etappe 7 · Agenten, ZOE, Brain ─────────────────────────────────────────────────────────────────────────────────────
  agenten: 'Ihr stellt den Head of Sales auf „Nur Vorschlag“ und den Head of Operations auf „Risikoarm selbst“. Der erste fragt immer, der zweite füllt leere nächste Schritte selbst.',
  'ich-zoe': 'Du fragst ZOE: „Was ist heute wichtig?“ Sie antwortet mit drei Dingen und schlägt vor, einen Termin zu verschieben — du klickst, oder nicht.',
  brain: 'Ihr schreibt eine Regel „Kunden werden geduzt“ und gebt sie frei. Von da an halten sich ZOE und die Agenten daran.',
  'uebergabe-probe': 'Du übergibst einen Testkontakt an die zweite Person. Sie sieht den nächsten Schritt und die Aufgabe — der Probelauf zeigt, dass die Übergabe klappt.',

  // ── Etappe 8 · Abschluss ───────────────────────────────────────────────────────────────────────────────────────────────
  'ich-rundgang': 'Du klickst dich einmal durch Heute, Kalender, Aufgaben und Finanzen und siehst, wo was liegt — ohne etwas zu ändern.',
  'ich-bauplan': 'Dir fehlt ein Knopf. Du meldest ihn mit einem Bildschirmfoto als „Wunsch“; er erscheint als Karte im Bauplan.',
  datenstand: 'Die Datenbasis zeigt: Kontostände sind 2 Tage alt, die Kartei hat 40 Kontakte ohne Firma. Du weißt, wo noch gepflegt werden muss.',
  'hoi-gruen': 'Der Head of IT zeigt eine rote Ampel „Sicherung zu alt“. Du löst den Befund, und die Ampel wird grün.',
  regeln: 'Ihr einigt euch, wer an welchem Bereich arbeitet und dass Updates erst nach Absprache hochgeladen werden.',

  // ── Neustart-Ablauf (nurNeustart bzw. eigene Schritte) ─────────────────────────────────────────────────────────────────
  neustart: 'Du siehst, was aus dem alten Stand mitkam und was neu ist, und prüfst gezielt, ob etwas fehlt.',
  'ich-ziele': 'Du legst ein persönliches Jahresziel an („Zweimal im Jahr wandern“). Es erscheint in der Planung; die andere Person sieht es nur, wenn du es teilst.',
  'ich-koerper': 'Du legst fest, worauf du achtest und welche Hebel dir helfen. Das Profil siehst nur du; die KI nur mit deiner Einwilligung (b).',
  'ich-ernaehrung': 'Du trägst Bedarf und Ziel ein und was du nicht verträgst. Der Wochenplan berücksichtigt das, ohne dich zu nennen.',
  'ich-sport': 'Du wählst als Ziel einen Halbmarathon und trägst deine Läufe ein. Der Plan schlägt Wochen mit Entlastung vor.',
  'ich-gesundheit-routinen': 'Du legst „10 Minuten Mobility“ als tägliche Routine an. Du hakst sie ab, und die Serie zählt mit.',
  'business-online': 'Ihr legt einen Plan „Business online“ mit zwei Gesellschaften an. Danach laufen Rechnungen, Konten und Angebote über denselben Faden.',
  'konten-business': 'Du hinterlegst die Bankkonten der Beispiel GmbH. Kontoauszüge und Zahlungen lassen sich dem richtigen Konto zuordnen.',
  'angebot-entwurf': 'Du legst ein Angebot für die Beispiel AG als Entwurf an: Positionen, Preise, Gültigkeit. Gestellt wird erst mit deinem Klick, danach ist es festgeschrieben.',
  'kampagne-start': 'Du stellst die Nachfass-Kadenz auf 5 Tage und planst eine erste Kampagne an das Segment „Kunden“. Die Rechts-Ampel zeigt, welche Kanäle zulässig sind.',
  powerhour: 'Dienstags um 10 Uhr stellt MAKE OS dir eine Liste von 5 Personen für Anrufe zusammen — mit Anlass und Leitfaden. Die Stunde ist im Kalender geblockt.',
};
