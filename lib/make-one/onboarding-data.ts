// ─── MAKE OS — Onboarding ───────────────────────────────────────────────────
// Kevins Ansage: „Alles, was wir fürs Onboarding brauchen, damit die Software
// reibungslos läuft für mich und Malin — Schritt für Schritt, jeweils eigene
// Spur, weil wir unterschiedliche Daten brauchen."
//
// Der Plan prüft sich selbst: Wo das System nachsehen kann, ob ein Schritt
// getan ist (zweiter Faktor an? Postfach verbunden? Sicherung gelaufen?), zählt
// der echte Zustand — nicht ein Häkchen. Nur was sich nicht messen lässt, hakt
// man von Hand ab.
//
// 08.10. (Kevin: „Onboarding auf den echten Stand“): MAKE OS läuft seit 25.09. auf
// dem Server — kein Mac, kein iCloud-Ordner, keine .env.local, kein Tailscale mehr.
// Persönliche Schritte (`persoenlich`) prüft der Server IMMER für die Person der
// Sitzung, nie für eine andere (lib/onboarding-status.ts). Wächter:
// tests/onboarding-stand.test.ts.

export type Spur = 'fundament' | string;

export interface Schritt {
  id: string;
  spur: Spur;
  titel: string;
  /** Warum das gebraucht wird — ohne das ist es eine Aufgabenliste ohne Sinn. */
  warum: string;
  /** Konkret, was zu tun ist. */
  wie: string[];
  minuten: number;
  /** Wer es macht, wenn es nicht der Spur-Eigentümer ist (z. B. „Inhaber“, „jede Person“). */
  wer?: string;
  wo?: { href: string; label: string };
  befehl?: string;
  /** Schlüssel, unter dem die API den echten Zustand prüft (bekannt in lib/onboarding-status.ts). */
  pruefung?: string;
  /**
   * Die Prüfung gilt der Person, die gerade angemeldet ist („bei dir“) — jede Person sieht nur ihren eigenen Stand.
   * Wer die Spur einer anderen Person ansieht, sieht hier also seinen eigenen Stand, nie den der anderen.
   */
  persoenlich?: true;
}

// Die Spur-Kennungen `kevin`/`malin` bleiben (Häkchen und Links hängen daran) — Plattform-Schuld: eine neue Instanz
// bräuchte Spuren aus den Konten statt fester Namen.
export const SPUREN: { id: Spur; titel: string; satz: string; href: string }[] = [
  { id: 'fundament', titel: 'Fundament', satz: 'Server, Sicherung, Updates, Einladung — einmal aufsetzen, dann läuft es für alle.', href: '/os/onboarding' },
  { id: 'kevin', titel: 'Kevin', satz: 'Inhaber: Zugang, Kalender, Postfach, Kontakte, Kompass, Agenten.', href: '/os/onboarding/kevin' },
  { id: 'malin', titel: 'Malin', satz: 'Zweite Person: Einladung, zweiter Faktor, Einwilligung, Kalender, Postfach, Finanzen.', href: '/os/onboarding/malin' },
];

// ── Bausteine, die in mehreren Spuren gleich gelten ─────────────────────────

const zweiterFaktor = (spur: Spur, id: string): Schritt => ({
  id, spur, minuten: 5, persoenlich: true, pruefung: 'zwei-faktor',
  titel: 'Zweiten Faktor einrichten',
  warum: 'Passwort allein reicht für einen Server im Netz nicht. Mit dem zweiten Faktor kommt nur rein, wer zusätzlich das eigene Handy hat. Nach dem nächsten Update ist er für alle Pflicht — ohne ihn öffnet sich nur noch die Konto-Seite.',
  wie: [
    'Konto › „Zweiter Faktor · Authenticator“ › Einrichten.',
    'Den QR-Code mit einer Authenticator-App scannen (z. B. die Passwörter-App des iPhones oder eine andere App für Einmal-Codes) und den 6-stelligen Code bestätigen.',
    'Die Wiederherstellungs-Codes sicher ablegen (Passwort-Manager) — sie sind der Weg zurück, wenn das Handy weg ist.',
  ],
  wo: { href: '/os/konto', label: 'Konto' },
});

const gesundheitEinwilligung = (spur: Spur, id: string): Schritt => ({
  id, spur, minuten: 5, persoenlich: true, pruefung: 'gesundheit-einwilligung',
  titel: 'Gesundheit: Einwilligung erklären',
  warum: 'Gesundheitsdaten sind besonders geschützt (Art. 9 DSGVO). MAKE OS erfasst sie erst, wenn du selbst einwilligst — jede Person für sich, niemand für eine andere.',
  wie: [
    '(a) Verarbeiten: MAKE OS speichert deine Gesundheitsdaten (Erholung, Schlaf, Sport, Ernährung, Journal …) für deine eigenen Auswertungen. Ohne (a) wird nichts erfasst.',
    '(b) An die KI: ZOE und automatische Läufe dürfen deine Gesundheitswerte nutzen (Modell-Anbieter in den USA). Setzt (a) voraus.',
    '(c) Partner: Personen, mit denen du deine Gesundheit teilst, dürfen sie auch über ihre ZOE abfragen. Setzt (a) und (b) voraus.',
    'Ob jemand deine Gesundheit überhaupt sieht, entscheidest du getrennt davon: Konto › „Gesundheit teilen“, je Person. Standard: niemand.',
    'Jede Erklärung lässt sich jederzeit widerrufen — an derselben Stelle.',
  ],
  wo: { href: '/os/datenschutz#gesundheit', label: 'System › Datenschutz' },
});

const postfach = (spur: Spur, id: string): Schritt => ({
  id, spur, minuten: 10, persoenlich: true, pruefung: 'postfach',
  titel: 'Eigenes Postfach verbinden',
  warum: 'Die Inbox ist der tägliche Einstieg — Fächer, neue Absender, Aufgaben und Termine aus Mails hängen daran. Jedes Postfach gehört genau einer Person; niemand sonst liest es.',
  wie: [
    'Inbox › Postfächer › verbinden: Anbieter wählen (iCloud mit app-spezifischem Passwort, IONOS, eigener Server) oder Gmail über die Google-Verbindung.',
    'Einen Bereich wählen (Privat oder eine Gesellschaft) — danach zeigt die Inbox das Postfach im passenden Bereich.',
    'Einmal durch die Fächer gehen und neue Absender zulassen oder blocken.',
  ],
  wo: { href: '/os/inbox?postfaecher=1', label: 'Inbox › Postfächer' },
});

const kalenderEigen = (spur: Spur, id: string): Schritt => ({
  id, spur, minuten: 10, persoenlich: true, pruefung: 'icloud',
  titel: 'Eigenen iCloud-Kalender verbinden',
  warum: 'Damit deine Termine in MAKE OS stehen, Planen um sie herum plant und Blöcke aus Planen und ZOE auf deinem eigenen iPhone landen.',
  wie: [
    'Auf appleid.apple.com › Anmelden und Sicherheit › App-spezifische Passwörter ein neues Passwort anlegen (z. B. „MAKE OS“). Nicht das normale Apple-Passwort.',
    'Kalender › Bereich Privat › Karte „iCloud Kalender“ (oder Kalender › Einstellungen): Apple-ID und das App-Passwort eintragen.',
    'Wählen, welche Kalender gezeigt werden und wohin Blöcke geschrieben werden.',
    'Die anderen im Haushalt sehen deine Termine nur als „Belegt“ — ohne Titel, Ort oder Notiz.',
    'Wechselst du später dein Apple-Passwort, wird das App-Passwort ungültig — dann „Verbindung erneuern“.',
  ],
  wo: { href: '/os/kalender?space=privat', label: 'Kalender' },
});

const zoeVorschlaege = (spur: Spur, id: string): Schritt => ({
  id, spur, minuten: 10, persoenlich: true, pruefung: 'zoe',
  titel: 'ZOE kennenlernen',
  warum: 'Fragen statt suchen. ZOE kennt die Zahlen, Aufgaben und Termine, die du sehen darfst — und bereitet Arbeit vor. Entscheiden tust du.',
  wie: [
    'ZOE öffnen und fragen, z. B. „Was ist diese Woche fällig?“',
    'ZOE macht nur Vorschläge: alles, was etwas ändert oder nach außen geht, landet im Stapel und wird erst mit deinem Klick „Freigeben“ ausgeführt.',
    'Dein Gesprächsverlauf gehört dir; Gesundheitswerte bekommt ZOE nur mit deiner Einwilligung (b).',
  ],
  wo: { href: '/os/stapel', label: 'Stapel' },
});

export const SCHRITTE: Schritt[] = [
  // ── FUNDAMENT ─────────────────────────────────────────────────────────────
  {
    id: 'server', spur: 'fundament', wer: 'Inhaber', minuten: 2,
    titel: 'MAKE OS läuft auf dem Server',
    warum: 'Eine Instanz, eine Wahrheit: MAKE OS läuft auf einem eigenen Server in Deutschland. Kein Rechner muss an sein, alle arbeiten auf demselben Stand — vom Laptop und vom Handy, von überall.',
    wie: [
      'Die Adresse ist die, unter der du diese Seite gerade siehst — als Lesezeichen anlegen.',
      'Am iPhone: in Safari Teilen › „Zum Home-Bildschirm“ — dann liegt MAKE OS wie eine App da.',
      'Die Daten liegen nur auf dem Server, verschlüsselt. Keine Kopie auf einem Rechner, kein geteilter Cloud-Ordner.',
      'Ob alles läuft, zeigt der Head of IT (Ampeln für Server, Sicherung, Verbindungen).',
    ],
    wo: { href: '/os/hoi', label: 'Head of IT' },
  },
  {
    id: 'sicherung', spur: 'fundament', wer: 'Inhaber', minuten: 2,
    titel: 'Nachtsicherung auf dem Server',
    warum: 'Jede Nacht sichert der Server alles verschlüsselt; dazu hält der Anbieter sieben tägliche Abbilder außerhalb des Servers. Einmal nachsehen, dass das greift.',
    wie: [
      'Die Sicherung läuft nachts von selbst — es ist nichts zu tun.',
      'Im Head of IT steht, wann die letzte Sicherung lief.',
    ],
    wo: { href: '/os/hoi', label: 'Head of IT' },
    pruefung: 'sicherung',
  },
  {
    id: 'sicherung-mac', spur: 'fundament', wer: 'Inhaber', minuten: 45,
    titel: 'Zweite Kopie am Mac — und einmal zurückspielen',
    warum: 'Eine Sicherung, die nie zurückgespielt wurde, ist ein Versprechen. Der zweite Ort außerhalb des Servers holt jede Nacht das neueste Archiv auf den Mac; die Probe beweist, dass es sich wiederherstellen lässt.',
    wie: [
      'Anleitung RESTORE_TEST.md im Projekt: age einrichten, die Abholung vom Server einmal einrichten (nur lesender Zugang).',
      'Danach steht im Head of IT „Sicherung am Mac“ auf Grün.',
      'Einmal die Probe machen (RESTORE_TEST.md, Abschnitt „Die Probe“) — ohne den Server anzufassen.',
    ],
    wo: { href: '/os/hoi', label: 'Head of IT' },
  },
  {
    id: 'updates', spur: 'fundament', wer: 'alle', minuten: 5,
    titel: 'Updates: gebaut wird lokal, online geht nur auf das Wort des Inhabers',
    warum: 'Am Code wird laufend weitergebaut — aber nicht am laufenden System. Was online ist, ändert sich nur, wenn der Inhaber ausdrücklich ein Update freigibt.',
    wie: [
      'Gebaut wird lokal auf dem Stand „entwicklung“ — davon merkt die Instanz nichts.',
      'Online ist der Stand „main“. Updates werden gesammelt und auf ausdrückliches Wort des Inhabers ausgerollt; das dauert etwa fünf Minuten, die alte Version läuft solange weiter.',
      'Neues steht vorher im Bauplan unter „Zum Testen“ — dort abnehmen oder mit Kommentar zurückgeben.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },
  {
    id: 'einladen', spur: 'fundament', wer: 'Inhaber', minuten: 5,
    titel: 'Zweite Person einladen',
    warum: 'Jede Person hat ein eigenes Konto. Eine Einladung ist der einzige Weg hinein — es gibt keine offene Registrierung.',
    wie: [
      'Konto › Einladen: Vorname eintragen (optional die E-Mail-Adresse). Soll das Konto an schon vorhandene Daten anschließen, den Speichernamen binden, den die Bestände tragen.',
      'Den Link schicken — er gilt 48 Stunden und nur einmal.',
      'Konto › Haushalt: die Person dem Haushalt zuordnen. Ohne Haushalt sieht sie keine privaten Finanzen; mit „nur Business“ nur die Business-Sicht.',
    ],
    wo: { href: '/os/konto', label: 'Konto' },
  },
  {
    id: 'zwei-faktor-pflicht', spur: 'fundament', wer: 'Inhaber', minuten: 2,
    titel: 'Zweiten Faktor für alle zur Pflicht machen',
    warum: 'Damit kein Konto mit Passwort allein hereinkommt. Wer noch keinen zweiten Faktor hat, wird beim nächsten Anmelden zur Einrichtung geführt.',
    wie: [
      'Zuerst den eigenen zweiten Faktor einrichten (Konto › Zweiter Faktor).',
      'Dann Konto › „Zugang der Instanz“ › 2FA-Pflicht einschalten.',
    ],
    wo: { href: '/os/konto', label: 'Konto' },
    pruefung: 'zwei-faktor-pflicht',
  },
  {
    id: 'regeln', spur: 'fundament', wer: 'alle', minuten: 5,
    titel: 'Wer sieht was — die Regel',
    warum: 'Gemeinsam heißt nicht: alles für alle. Die Trennung macht der Server, nicht die Oberfläche — was du nicht sehen darfst, kommt gar nicht erst bei dir an.',
    wie: [
      'Gemeinsame Bereiche sieht der ganze Haushalt: gemeinsame Aufgaben und Projekte, Kontakte und Markttraktion, Finanzen (je nach Finanzrecht), Ziele, gemeinsame Kalender.',
      'Nur die Person selbst sieht: private Notizen, „nur ich“-Aufgaben, private Termine (die anderen sehen „Belegt“), eigene Routinen und Ernährungsprofile, eigene Postfächer — und Gesundheit, solange sie sie nicht ausdrücklich teilt.',
      'Wer was geändert hat, steht unter Zusammenarbeit — nur wer, was, wann; nie Inhalte.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },

  // ── KEVIN (Inhaber) ───────────────────────────────────────────────────────
  zweiterFaktor('kevin', 'kevin-zwei-faktor'),
  {
    id: 'kevin-kalender', spur: 'kevin', minuten: 5,
    titel: 'Kalender des Haushalts verbinden',
    warum: 'Ohne Termine kann Planen keine Blöcke legen und ZOE plant über feste Termine hinweg. Die Verbindung des Inhabers speist den gemeinsamen Kalender.',
    wie: [
      'Kalender › Bereich Privat › Karte „iCloud Kalender“: Apple-ID und app-spezifisches Passwort eintragen.',
      'Business-Termine: Kalender › Bereich Business › die Firma mit Google Workspace verbinden.',
      'Prüfen, dass die Termine dieser Woche auftauchen.',
    ],
    wo: { href: '/os/kalender?space=privat', label: 'Kalender' },
    pruefung: 'kalender',
  },
  postfach('kevin', 'kevin-postfach'),
  {
    id: 'kevin-kontakte', spur: 'kevin', minuten: 5,
    titel: 'Kartei prüfen und sortieren',
    warum: 'Power Hour und Pipeline rechnen mit der Kartei. Kreis, Lebensphase und Herkunft müssen stimmen, sonst schlägt das System die Falschen vor.',
    wie: ['In der Markttraktion › Stammdaten die Pflichtangaben (Herkunft, Rechtsgrundlage) übernehmen.', 'Bei den wichtigsten 20 Menschen den Kreis A oder B setzen.', 'Die restlichen Dubletten zusammenführen.'],
    wo: { href: '/os/markttraktion?s=kontakte', label: 'Markttraktion › Kontakte' },
    pruefung: 'kontakte',
  },
  {
    id: 'kevin-aufgaben', spur: 'kevin', minuten: 25,
    titel: 'Aufgaben sichten und ordnen',
    warum: 'Die Reihenfolge des ganzen Systems hängt an eurer Ordnung. Was falsch einsortiert ist, wird falsch priorisiert.',
    wie: ['Alle offenen Aufgaben einmal durchgehen.', 'Kritische bestätigen oder herunterstufen.', 'Je Aufgabe eine verantwortliche Person setzen, weitere als Beteiligte.', 'Überfällige entweder neu datieren oder schließen.'],
    wo: { href: '/os/aufgaben', label: 'Aufgaben' },
    pruefung: 'aufgaben',
  },
  {
    id: 'kevin-kompass', spur: 'kevin', minuten: 15,
    titel: 'Kompass stellen',
    warum: 'Die Regler steuern, wie das System dich behandelt — wie hart es schützt, wie viel es zumutet, wann es Alarm schlägt.',
    wie: ['Lage wählen (Aufbau / Ernte / Schutz / Feuer).', 'Die Regler durchgehen, Wirkung live mitlesen.', 'Abweichungen unten anschauen — dort steht, wo der Alltag dem Kompass widerspricht.'],
    wo: { href: '/os/kompass', label: 'Kompass' },
    pruefung: 'kompass',
  },
  {
    id: 'kevin-fokus', spur: 'kevin', minuten: 15,
    titel: 'Fokus je Horizont setzen',
    warum: 'Jahr, Quartal, Monat und Woche brauchen je einen Satz. Ohne den kann weder ZOE noch Planen entscheiden, was gerade wichtiger ist.',
    wie: ['Jahresfokus setzen.', 'Quartal und Monat daraus ableiten.', 'Wochenfokus für diese Woche setzen.'],
    wo: { href: '/os/fokus', label: 'Fokus' },
    pruefung: 'fokus',
  },
  {
    id: 'kevin-ziele', spur: 'kevin', minuten: 10,
    titel: 'Ziele und Startmonat bestätigen',
    warum: 'Controlling und Run-Rate rechnen ab dem Startmonat. Steht der falsch, sieht jede Auswertung schlechter aus, als sie ist.',
    wie: ['Jahresziel Umsatz und Gewinn prüfen.', 'Startmonat bestätigen.', 'Runway-Schwelle prüfen.'],
    wo: { href: '/os/controlling', label: 'Controlling' },
    pruefung: 'ziele',
  },
  gesundheitEinwilligung('kevin', 'kevin-gesundheit'),
  {
    id: 'kevin-agenten', spur: 'kevin', minuten: 10,
    titel: 'Agenten und ihre Autonomie festlegen',
    warum: 'Jeder Agent braucht eine Stufe: nur vorschlagen, nach Freigabe, oder selbstständig. Alles, was nach außen geht, bleibt auf Freigabe.',
    wie: ['Jeden Agenten durchgehen und die Stufe setzen.', 'Alles, was nach außen geht, bleibt auf Freigabe.', 'Abschalten, was gerade nicht gebraucht wird.'],
    wo: { href: '/os/agenten', label: 'Agentensystem' },
    pruefung: 'agenten',
  },
  zoeVorschlaege('kevin', 'kevin-zoe'),

  // ── MALIN (zweite Person) ─────────────────────────────────────────────────
  {
    id: 'malin-einladung', spur: 'malin', minuten: 5,
    titel: 'Einladung annehmen',
    warum: 'Erster Schritt: reinkommen. Alles andere baut darauf auf.',
    wie: [
      'Den Einladungslink vom Inhaber öffnen (gilt 48 Stunden, nur einmal).',
      'Vorname, E-Mail-Adresse und ein Passwort mit mindestens 10 Zeichen — fertig. War die Einladung an vorhandene Daten gebunden, hängen sie jetzt an deinem Konto.',
      'Lesezeichen anlegen; am iPhone Safari › Teilen › „Zum Home-Bildschirm“.',
    ],
  },
  zweiterFaktor('malin', 'malin-zwei-faktor'),
  {
    id: 'malin-sicht', spur: 'malin', minuten: 5,
    titel: 'Wer sieht was',
    warum: 'Damit klar ist, was geteilt ist und was nur dir gehört — getrennt wird auf dem Server, nicht bloß in der Oberfläche.',
    wie: [
      'Gemeinsam: Aufgaben und Projekte (außer „nur ich“), Kontakte und Markttraktion, Ziele, gemeinsame Kalender, die Finanzen des Haushalts.',
      'Nur du: deine privaten Notizen, „nur ich“-Aufgaben, private Termine (die anderen sehen „Belegt“), deine Routinen und dein Ernährungsprofil, deine Postfächer.',
      'Gesundheit: sieht nur, wem du sie unter Konto › „Gesundheit teilen“ ausdrücklich freigibst — umgekehrt genauso.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },
  gesundheitEinwilligung('malin', 'malin-gesundheit'),
  kalenderEigen('malin', 'malin-kalender'),
  postfach('malin', 'malin-postfach'),
  {
    id: 'malin-telegram', spur: 'malin', minuten: 5, persoenlich: true, pruefung: 'telegram',
    titel: 'Hinweise aufs Handy (optional)',
    warum: 'Wer möchte, bekommt kurze Hinweise über Telegram — ohne Inhalte, Beträge oder Namen, nur „In MAKE OS wartet etwas“ mit Link.',
    wie: ['Konto › „Der Bote · Telegram“ › koppeln und den Code an den Bot schicken.', 'Lässt sich jederzeit wieder trennen.'],
    wo: { href: '/os/konto', label: 'Konto' },
  },
  {
    id: 'malin-whoop', spur: 'malin', minuten: 1,
    titel: 'WHOOP verbinden (optional)',
    warum: 'Mit WHOOP kommen Erholung, Schlaf und Training von selbst in deine Gesundheit und in Sport — ohne Abtippen. Jede Person verbindet nur ihr eigenes Konto; andere sehen deine Werte nur, wenn du Gesundheit mit ihnen teilst.',
    wie: [
      'Vorher die Gesundheits-Einwilligung (a) erklären — ohne sie holt MAKE OS nichts ab.',
      'Gesundheit öffnen, Karte „WHOOP“ → „Verbinden“ → bei WHOOP anmelden und zustimmen.',
      'Beim ersten Mal kommen die letzten 90 Tage; danach meldet WHOOP neue Werte von selbst. Eigene Einträge im Morgen-Check überschreibt WHOOP nie.',
    ],
    wo: { href: '/os/gesundheit', label: 'Gesundheit' },
  },
  {
    id: 'malin-rundgang', spur: 'malin', minuten: 20,
    titel: 'Rundgang durch die Software',
    warum: 'Wer weiß, wo was liegt, findet sich in fünf Minuten zurecht statt in zwei Wochen.',
    wie: [
      'Links die Leiste mit den Bereichen, oben der Wechsel Privat / Business, Inbox und Kalender.',
      'Heute zeigt den Tag, Aufgaben die Arbeit, Finanzen die Zahlen.',
      '⌘K (am Handy die Suche) springt zu jeder Seite.',
    ],
    wo: { href: '/os', label: 'Dashboard' },
  },
  {
    id: 'malin-konten', spur: 'malin', minuten: 10,
    titel: 'Kontostände eintragen',
    warum: 'Die Liquiditäts-Vorschau startet beim heutigen Kontostand. Ist der alt, ist die ganze Kurve falsch.',
    wie: ['Unter Liquidität für jede Gesellschaft den aktuellen Kontostand eintragen.', 'Datum dazu, damit man sieht, wie frisch der Wert ist.'],
    wo: { href: '/os/finanzen/liquiditaet#kontostaende', label: 'Kontostände' },
    pruefung: 'konten',
  },
  {
    id: 'malin-posten', spur: 'malin', minuten: 25,
    titel: 'Offene Rechnungen und Zahlungen pflegen',
    warum: 'Das ist die Prioritätenliste: was zuerst raus muss, was noch reinkommt.',
    wie: [
      'Offene Ausgangsrechnungen prüfen — was schon eingegangen ist, auf „bezahlt“ setzen.',
      'Offene Zahlungen durchgehen und Fälligkeiten setzen.',
      'Posten mit unklarem Empfänger klären, bevor sie in die Planung gehen.',
    ],
    wo: { href: '/os/finanzen/planung', label: 'Rechnungen & Zahlungen' },
    pruefung: 'posten',
  },
  {
    id: 'malin-aufgaben', spur: 'malin', minuten: 15, persoenlich: true, pruefung: 'aufgaben-ich',
    titel: 'Deine Aufgaben sichten',
    warum: 'Was auf dich zugewiesen ist, soll nicht in einer langen Liste untergehen.',
    wie: ['In Aufgaben den Filter „Meine“ wählen.', 'Fälligkeiten setzen oder mit Kommentar zurückgeben.', 'Mit @Name in einem Kommentar holst du jemanden dazu.'],
    wo: { href: '/os/aufgaben', label: 'Aufgaben' },
  },
  {
    id: 'malin-bauplan', spur: 'malin', minuten: 5,
    titel: 'Mitbauen: Problem oder Idee melden',
    warum: 'Mitbauen braucht keinen Code. Was hakt oder fehlt, kommt als Karte auf das Bauplan-Board — mit der Seite, auf der du gerade warst.',
    wie: [
      'Unten links in der Leiste „Problem oder Idee melden“ (am Handy im Menü bzw. unter System): Fehler, Idee oder Wunsch, gern mit Bildschirmfoto.',
      'Das Board: Ideen → Bereit → In Arbeit → Zum Testen → Fertig.',
      'Was unter „Zum Testen“ steht, probierst du aus: „Passt“ oder „Passt noch nicht“ mit Kommentar.',
    ],
    wo: { href: '/os/bauplan', label: 'Bauplan' },
  },
  zoeVorschlaege('malin', 'malin-zoe'),
];

export const schritteVon = (spur: Spur) => SCHRITTE.filter(s => s.spur === spur);

/** Die drei Zonen — die Abmachung, damit Weiterbauen und Arbeiten sich nicht in die Quere kommen. */
export const ZONEN = [
  {
    farbe: 'gruen', titel: 'Grün — immer sicher',
    satz: 'Daten in der Oberfläche eintragen. Sie liegen auf dem Server und überstehen jedes Update — auch während eines Updates läuft die alte Version weiter.',
    beispiele: ['Aufgaben anlegen und abhaken', 'Rechnungen und Zahlungen pflegen', 'Kontostände, Journal, Ernährung', 'Mit ZOE reden', 'Problem oder Idee melden'],
  },
  {
    farbe: 'gelb', titel: 'Gelb — nicht während „Update läuft“',
    satz: 'Alles, was größere Mengen auf einmal schreibt. Zeigt Zusammenarbeit „Update läuft“, kurz warten — das Ausrollen dauert etwa fünf Minuten.',
    beispiele: ['Kontakte importieren', 'Finanzplanung hochladen oder ersetzen', '„Neu anfangen“ in Aufgaben/Planung', 'Agenten-Autonomie ändern'],
  },
  {
    farbe: 'rot', titel: 'Rot — nur der Inhaber',
    satz: 'Code und Server. Gebaut wird lokal auf „entwicklung“; online geht nur „main“, und nur auf ausdrückliches Wort des Inhabers.',
    beispiele: ['Code ändern (lokal, Stand „entwicklung“)', 'Update ausrollen (Stand „main“)', 'Schlüssel und Einstellungen am Server', 'Sicherung zurückspielen'],
  },
] as const;
