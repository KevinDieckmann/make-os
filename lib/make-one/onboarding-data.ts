// ─── MAKE OS — Onboarding ───────────────────────────────────────────────────
// Kevins Ansage: „Alles, was wir fürs Onboarding brauchen, damit die Software
// reibungslos läuft für mich und Malin — Schritt für Schritt, jeweils eigene
// Spur, weil wir unterschiedliche Daten brauchen."
//
// Der Plan prüft sich selbst: Wo das System nachsehen kann, ob ein Schritt
// getan ist (Kalender verbunden? Grundlage geladen? Kontakte drin?), zählt der
// echte Zustand — nicht ein Häkchen. Nur was sich nicht messen lässt, hakt man
// von Hand ab.

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
  /** Wer es macht, wenn es nicht der Spur-Eigentümer ist. */
  wer?: 'Kevin' | 'Malin' | 'beide';
  wo?: { href: string; label: string };
  befehl?: string;
  /** Schlüssel, unter dem die API den echten Zustand prüft. */
  pruefung?: string;
}

export const SPUREN: { id: Spur; titel: string; satz: string; href: string }[] = [
  { id: 'fundament', titel: 'Fundament', satz: 'Einmal aufsetzen — danach läuft es für uns beide.', href: '/os/onboarding' },
  { id: 'kevin', titel: 'Kevin', satz: 'Kalender, Postfach, Kontakte, Kompass, Gesundheit, Agenten.', href: '/os/onboarding/kevin' },
  { id: 'malin', titel: 'Malin', satz: 'Zugang, Finanzen, offene Posten, ihre Aufgaben.', href: '/os/onboarding/malin' },
];

export const SCHRITTE: Schritt[] = [
  // ── FUNDAMENT ─────────────────────────────────────────────────────────────
  {
    id: 'ordner', spur: 'fundament', wer: 'Kevin', minuten: 10,
    titel: 'MAKE OS in den gemeinsamen iCloud-Ordner legen',
    warum: 'Malin braucht den Code und die Dokumente von ihrer Seite. Der Ordner „Make Privat ❤️" ist bereits geteilt — dort liegt MAKE OS als eigener Unterordner.',
    wie: [
      'Ordner „MAKE OS/software" im geteilten iCloud-Ordner anlegen.',
      'Den Projektordner hineinkopieren — OHNE node_modules und OHNE .next (die baut jeder Rechner selbst).',
      'WICHTIG: .data NICHT dauerhaft mitsynchronisieren. Zwei Rechner, die gleichzeitig in dieselbe JSON schreiben, zerlegen sie. Wer die Daten führt, steht unter Zusammenarbeit.',
      '.env.local kommt NICHT in die Cloud — die Schlüssel gibst du Malin separat.',
    ],
    befehl: 'rsync -av --exclude node_modules --exclude .next --exclude .data --exclude .env.local ~/Claude/Projects/MakeOS/ "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Make Privat ❤️/MAKE OS/software/"',
  },
  {
    id: 'schluessel', spur: 'fundament', wer: 'beide', minuten: 5,
    titel: 'Schlüssel setzen (.env.local)',
    warum: 'Ohne MAKE_OS_KEY kommt niemand rein, ohne ANTHROPIC_API_KEY denkt Jarvis nicht mit. Jeder Rechner hat seine eigene Datei — nur der KI-Schlüssel ist derselbe.',
    wie: [
      'Datei .env.local im Projektordner anlegen.',
      'MAKE_OS_KEY=… — nur für DIESEN Rechner. Beim Start über start.sh wird er automatisch erzeugt; er muss nicht Kevins Wert sein. Kevins Schlüssel brauchst du nur, wenn du über das Netzwerk auf SEINE laufende Instanz gehst.',
      'ANTHROPIC_API_KEY=… — für Jarvis und alle Agenten.',
      'Die Datei gehört nie in die Cloud und nie in ein Repository.',
    ],
    pruefung: 'schluessel',
  },
  {
    id: 'start', spur: 'fundament', wer: 'beide', minuten: 10,
    titel: 'Node installieren und die Software starten',
    warum: 'MAKE OS läuft lokal auf dem eigenen Rechner — kein fremder Server sieht eure Daten.',
    wie: [
      'Node 22 muss vorhanden sein.',
      'Einmal npm install im Projektordner.',
      'Danach immer ./start.sh — die Software läuft auf Port 3001.',
    ],
    befehl: './start.sh',
  },
  {
    id: 'anmelden', spur: 'fundament', wer: 'beide', minuten: 2,
    titel: 'Einmal anmelden',
    warum: 'Jede Person hat ein eigenes Konto. Der Vorname wird der Name der Daten (Kevin → kevin, Malin → malin) — die gewachsenen Bestände hängen damit ohne Umzug am richtigen Konto.',
    wie: [
      'http://localhost:3001/anmelden öffnen.',
      'Beim allerersten Mal „Erstes Konto einrichten": Vorname, E-Mail, Passwort (mindestens 10 Zeichen) und einmal der Schlüssel aus .env.local.',
      'Danach genügt E-Mail + Passwort — die Sitzung hält 30 Tage. Lesezeichen auf http://localhost:3001/os.',
    ],
  },
  {
    id: 'zugang-malin', spur: 'fundament', wer: 'beide', minuten: 15,
    titel: 'Entscheiden, wie Malin zugreift',
    warum: 'Das ist die wichtigste Weiche des ganzen Onboardings. Davon hängt ab, ob ihr eine Wahrheit habt oder zwei auseinanderlaufende Stände.',
    wie: [
      'EMPFOHLEN — eine Instanz: Kevins Rechner läuft. Kevin erzeugt unter Konto → Einladen einen Link, Malin öffnet ihn im selben WLAN (http://<Kevins-IP>:3001/anmelden?code=…) und legt ihr Konto an. Eine Datenbasis, keine Konflikte.',
      'Kevins IP findest du mit: ipconfig getifaddr en0',
      'FALLBACK — eigene Kopie: Malin startet ihre eigene Instanz aus dem iCloud-Ordner. Dann sind ihre Einträge NUR auf ihrem Rechner. Das ist für Ansehen und Ausprobieren in Ordnung, nicht für gemeinsames Pflegen.',
      'DAUERHAFT: der Hetzner-Server. Dann greift ihr beide von überall auf dieselbe Instanz zu, ohne dass ein Rechner laufen muss. Steht als nächster Schritt im Bauplan.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },
  {
    id: 'regeln', spur: 'fundament', wer: 'beide', minuten: 10,
    titel: 'Programmierfreie Zonen verstehen',
    warum: 'Kevin baut weiter an der Software, während Malin damit arbeitet. Ohne Absprache gehen dabei Eingaben verloren oder eine Seite ist kurz kaputt.',
    wie: [
      'Die drei Zonen (grün/gelb/rot) einmal gemeinsam durchgehen.',
      'Abmachung: Kevin sagt kurz Bescheid, wenn er baut — solange nichts Wichtiges eintragen.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },
  {
    id: 'grundlage', spur: 'fundament', wer: 'Malin', minuten: 10,
    titel: 'Finanz-Grundlage aus Malins Dashboard laden',
    warum: 'Malins Dashboard ist die einzige gepflegte Finanzquelle. Ohne diesen Schritt rechnet MAKE OS mit nichts.',
    wie: [
      'Im Finanz-Dashboard den Export ziehen (die Schlüssel fd_p, fd_s, fd_u).',
      'Als { roh, stand } an /api/state/grundlage schicken.',
      'Danach steht der Stand oben auf der Finanzen-Seite.',
    ],
    wo: { href: '/os/finanzen/grundlage', label: 'Grundlage ansehen' },
    pruefung: 'grundlage',
  },
  {
    id: 'sicherung', spur: 'fundament', wer: 'Kevin', minuten: 5,
    titel: 'Sicherung prüfen',
    warum: 'Alles liegt als Dateien in .data. Die Software legt täglich eine Sicherung an und hält 14 Stände — einmal nachsehen, dass das greift.',
    wie: [
      'In .data/backup nachsehen, ob Stände von heute liegen.',
      'Zusätzlich: den ganzen .data-Ordner ab und zu in den iCloud-Ordner kopieren (als Archiv, nicht als laufende Synchronisation).',
    ],
    pruefung: 'sicherung',
  },

  // ── KEVIN ─────────────────────────────────────────────────────────────────
  {
    id: 'kevin-kalender', spur: 'kevin', minuten: 5,
    titel: 'Apple-Kalender verbinden',
    warum: 'Ohne Termine kann der Tagesplan keine Blöcke legen und Jarvis plant über feste Termine hinweg.',
    wie: ['Unter Verbindungen den Kalender einmal ziehen.', 'Prüfen, dass die Termine dieser Woche auftauchen.'],
    wo: { href: '/os/verbindungen', label: 'Verbindungen' },
    pruefung: 'kalender',
  },
  {
    id: 'kevin-postfach', spur: 'kevin', minuten: 10,
    titel: 'Postfach verbinden',
    warum: 'Die Inbox ist dein täglicher Einstieg — Türsteher, Fächer und die Zuordnung zu Aufgaben hängen daran.',
    wie: ['KEMARIS-Postfach (Microsoft 365) verbinden.', 'Apple Mail als zweite Quelle prüfen.', 'Einmal durch die Fächer gehen und den Türsteher einstellen.'],
    wo: { href: '/os/inbox', label: 'Inbox' },
    pruefung: 'postfach',
  },
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
    warum: 'Die Reihenfolge des ganzen Systems hängt an eurer Ordnung: rechtssicher → Umsatz → Produkt → Gesundheit. Was falsch einsortiert ist, wird falsch priorisiert.',
    wie: ['Alle offenen Aufgaben einmal durchgehen.', 'Kritische bestätigen oder herunterstufen.', 'Zuweisung Kevin/Malin/beide setzen — das füllt Malins Spur.', 'Überfällige entweder neu datieren oder schließen.'],
    wo: { href: '/os/aufgaben', label: 'Taskmanagement' },
    pruefung: 'aufgaben',
  },
  {
    id: 'kevin-kompass', spur: 'kevin', minuten: 15,
    titel: 'Kompass stellen',
    warum: 'Die 20 Regler steuern, wie das System dich behandelt — wie hart es schützt, wie viel es zumutet, wann es Alarm schlägt.',
    wie: ['Lage wählen (Aufbau / Ernte / Schutz / Feuer).', 'Die 20 Regler durchgehen, Wirkung live mitlesen.', 'Abweichungen unten anschauen — dort steht, wo dein Alltag dem Kompass widerspricht.'],
    wo: { href: '/os/kompass', label: 'Kompass' },
    pruefung: 'kompass',
  },
  {
    id: 'kevin-fokus', spur: 'kevin', minuten: 15,
    titel: 'Fokus je Horizont setzen',
    warum: 'Jahr, Quartal, Monat und Woche brauchen je einen Satz. Ohne den kann weder Jarvis noch der Tagesplan entscheiden, was gerade wichtiger ist.',
    wie: ['Jahresfokus setzen.', 'Quartal und Monat daraus ableiten.', 'Wochenfokus für diese Woche setzen.'],
    wo: { href: '/os/planung/fokus', label: 'Fokus-Regler' },
    pruefung: 'fokus',
  },
  {
    id: 'kevin-ziele', spur: 'kevin', minuten: 10,
    titel: 'Ziele und Startmonat bestätigen',
    warum: 'Controlling und Run-Rate rechnen ab dem Startmonat. Steht der falsch, sieht jede Auswertung schlechter aus, als sie ist.',
    wie: ['Jahresziel Umsatz und Gewinn prüfen.', 'Startmonat steht auf Juni 2026 — bestätigen.', 'Runway-Schwelle prüfen.'],
    wo: { href: '/os/controlling', label: 'Controlling' },
    pruefung: 'ziele',
  },
  {
    id: 'kevin-gesundheit', spur: 'kevin', minuten: 15,
    titel: 'Gesundheit füllen — die größte Lücke',
    warum: 'Der MAKE Score steht bei 50 % Abdeckung, weil Gesundheit fast leer ist. Und der Tagesplan schont deinen Rücken nur, wenn er weiß, wie es dir geht.',
    wie: ['Whoop-Werte eintragen (Recovery, Schlaf, HRV).', 'Reha-Block täglich 30 Minuten einplanen — Bandscheibe.', 'Ernährung und Journal einmal starten, damit die Reihe anläuft.'],
    wo: { href: '/os/gesundheit', label: 'Gesundheit' },
    pruefung: 'gesundheit',
  },
  {
    id: 'kevin-agenten', spur: 'kevin', minuten: 10,
    titel: 'Agenten und ihre Autonomie festlegen',
    warum: 'Zwölf Agenten laufen. Jeder braucht eine Stufe: nur vorschlagen, nach Freigabe, oder selbstständig. Ohne das schreibt dir irgendwann etwas ungefragt in den Kalender.',
    wie: ['Jeden Agenten durchgehen und die Stufe setzen.', 'Alles, was nach außen geht, bleibt auf Freigabe.', 'Abschalten, was du gerade nicht brauchst.'],
    wo: { href: '/os/agenten', label: 'Agentensystem' },
    pruefung: 'agenten',
  },
  {
    id: 'kevin-jarvis', spur: 'kevin', minuten: 10,
    titel: 'Jarvis einrichten',
    warum: 'Jarvis kennt jetzt euren Gesprächsverlauf und kann sprechen. Beides einmal ausprobieren, damit es im Alltag sitzt.',
    wie: ['Ein Gespräch führen — der Verlauf bleibt gespeichert.', 'Stimme einschalten und Freihand testen.', 'Einmal etwas per Zuruf erfassen lassen („trag Adobe-Abo mit 59 € monatlich ein").'],
    pruefung: 'jarvis',
  },
  // ── MALIN ─────────────────────────────────────────────────────────────────
  {
    id: 'malin-zugang', spur: 'malin', minuten: 10,
    titel: 'Zugang einrichten',
    warum: 'Erster Schritt: reinkommen. Alles andere baut darauf auf.',
    wie: [
      'Kevin schickt dir den Einladungslink (Konto → Einladen). Öffnen, Vorname „Malin", E-Mail, Passwort — fertig. Deine bisherigen Bestände hängen dann an deinem Konto.',
      'Lesezeichen auf http://<Kevins-IP>:3001/anmelden anlegen.',
      'Falls eigene Kopie: Ordner aus iCloud holen, npm install, ./start.sh — dann aber wissen, dass Einträge nur lokal liegen.',
    ],
  },
  {
    id: 'malin-rundgang', spur: 'malin', minuten: 20,
    titel: 'Rundgang durch die Software',
    warum: 'MAKE OS hat sieben Bereiche. Wer weiß, wo was liegt, findet sich in fünf Minuten zurecht statt in zwei Wochen.',
    wie: [
      'Startfläche öffnen — jeder Bereich ist eine eigene Anwendung.',
      'Reihenfolge: Finanzen → Aufgaben → Netzwerk. Das sind deine drei.',
      '⌘K öffnet die Schnellnavigation über alle Seiten.',
      'Du darfst alles sehen — auch Gesundheit und Privates. Nichts ist vor dir versteckt.',
    ],
    wo: { href: '/os/start', label: 'Startfläche' },
  },
  {
    id: 'malin-grundlage', spur: 'malin', minuten: 15,
    titel: 'Dein Dashboard bleibt die Quelle',
    warum: 'Du pflegst weiter dort, wo du es gewohnt bist. MAKE OS liest und rechnet — es schreibt dir nichts hinein.',
    wie: [
      'Weiter im Finanz-Dashboard buchen wie bisher.',
      'Rhythmus vereinbaren: wie oft der Export nach MAKE OS geht (Vorschlag: montags).',
      'Nach jedem Export einmal auf Finanzen → Grundlage schauen, ob der Stand stimmt.',
    ],
    wo: { href: '/os/finanzen/grundlage', label: 'Grundlage' },
    pruefung: 'grundlage',
  },
  {
    id: 'malin-luecken', spur: 'malin', minuten: 20,
    titel: 'Die drei Lücken schließen',
    warum: 'Ohne diese drei Zahlen ist jede Liquiditätsrechnung zu optimistisch — sie zeigt Geld, das längst weg ist.',
    wie: [
      'Kevins KV + PV als Selbstständiger eintragen (steht auf 0 €/Monat).',
      'Dein Bruttogehalt eintragen, sobald die Anstellung steht (steht auf 0 €).',
      'Sonstige Betriebs-Fixkosten erfassen (steht auf 0 € — außer Office Club ist nichts drin).',
      'Alles drei im Finanz-Dashboard unter „Betrieb konfigurieren", dann neu exportieren.',
    ],
    wo: { href: '/os/finanzen/grundlage', label: 'Lücken ansehen' },
    pruefung: 'luecken',
  },
  {
    id: 'malin-konten', spur: 'malin', minuten: 10,
    titel: 'Kontostände eintragen',
    warum: 'Die Liquiditäts-Vorschau startet beim heutigen Kontostand. Ist der alt, ist die ganze Kurve falsch.',
    wie: ['Für jede Firma den aktuellen Stand eintragen: KD Ventures, Kevin Dieckmann Consulting, Privat.', 'Datum dazu, damit man sieht, wie frisch der Wert ist.'],
    wo: { href: '/os/finanzen/planung', label: 'Rechnungen & Zahlungen' },
    pruefung: 'konten',
  },
  {
    id: 'malin-posten', spur: 'malin', minuten: 25,
    titel: 'Offene Rechnungen und Zahlungen pflegen',
    warum: 'Das ist die Prioritätenliste: was zuerst raus muss, was noch reinkommt. Neun offene Posten stehen drin — die wollen geprüft sein.',
    wie: [
      'Offene Ausgangsrechnungen prüfen — die One-Finance-Rechnung steht auf „gestellt", in deinem Kassenbuch ist sie am 02.07. eingegangen.',
      'Offene Zahlungen durchgehen und Fälligkeiten setzen.',
      'Culpra Inkasso: 243,09 €, Aktenzeichen 112341373, bis 06.08.',
      'Klären: „Björn peters" mit 1.905 € — ist das Björn Frentrup oder Jörn Peters?',
    ],
    wo: { href: '/os/finanzen/planung', label: 'Rechnungen & Zahlungen' },
    pruefung: 'posten',
  },
  {
    id: 'malin-aufgaben', spur: 'malin', minuten: 15,
    titel: 'Deine Aufgaben sichten',
    warum: 'Was auf dich zugewiesen ist, soll nicht in Kevins Liste untergehen.',
    wie: ['Im Taskmanagement auf „Malin" filtern.', 'Fälligkeiten setzen oder zurückgeben.', 'Neue Aufgaben mit @malin zuweisen — das versteht auch Jarvis.'],
    wo: { href: '/os/aufgaben', label: 'Taskmanagement' },
    pruefung: 'malin-aufgaben',
  },
  {
    id: 'malin-jarvis', spur: 'malin', minuten: 10,
    titel: 'Jarvis kennenlernen',
    warum: 'Fragen statt suchen. Jarvis kennt alle Zahlen und kann auch für dich schreiben.',
    wie: [
      'Unten rechts der Kreis öffnet ihn — auf jeder Seite.',
      'Ausprobieren: „Was muss diese Woche bezahlt werden?"',
      'Er kann auch eintragen: „Rechnung Frank Mathick ist bezahlt."',
      'Der Verlauf bleibt gespeichert — ihr könnt ihn beide nachlesen.',
    ],
    pruefung: 'jarvis',
  },
  {
    id: 'malin-grenzen', spur: 'malin', minuten: 5,
    titel: 'Was du nicht anfassen musst',
    warum: 'Damit klar ist, wo Arbeiten sicher ist und wo Kevin gerade baut.',
    wie: [
      'Der Code geht dich nichts an — du arbeitest nur in der Oberfläche.',
      'Wenn oben „Bauzeit" steht: nichts Wichtiges eintragen, Kevin baut gerade.',
      'Wenn etwas kaputt aussieht: Bildschirmfoto an Kevin, nicht selbst reparieren.',
    ],
    wo: { href: '/os/onboarding/zusammenarbeit', label: 'Zusammenarbeit' },
  },
];

export const schritteVon = (spur: Spur) => SCHRITTE.filter(s => s.spur === spur);

/** Die drei Zonen — die Abmachung, damit sich beide nicht in die Quere kommen. */
export const ZONEN = [
  {
    farbe: 'gruen', titel: 'Grün — immer sicher',
    satz: 'Daten in der Oberfläche eintragen. Das übersteht jedes Update, weil es in .data liegt und nicht im Code.',
    beispiele: ['Aufgaben anlegen und abhaken', 'Rechnungen und Zahlungen pflegen', 'Kontostände, Journal, Ernährung', 'Mit Jarvis reden', 'Kompass-Regler stellen'],
  },
  {
    farbe: 'gelb', titel: 'Gelb — nur wenn keine Bauzeit läuft',
    satz: 'Alles, was größere Mengen schreibt oder ersetzt. Läuft parallel ein Umbau, kann das kollidieren.',
    beispiele: ['Finanz-Grundlage neu laden', 'Kontakte importieren', 'Postfach oder Kalender neu ziehen', 'Agenten-Autonomie ändern'],
  },
  {
    farbe: 'rot', titel: 'Rot — nur Kevin, nie parallel',
    satz: 'Alles am Code und an den Grunddateien. Während dessen ist die Software kurz nicht verlässlich.',
    beispiele: ['Dateien im Projektordner ändern', '.env.local anfassen', 'Direkt in .data/*.json schreiben', 'npm install oder Server neu starten', 'Den Ordner in die Cloud kopieren'],
  },
] as const;
