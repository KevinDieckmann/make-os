// ─── Erklärungen · Gesundheit, Fokus, Planung, Kapazität (10.10.) ──────────────────────────────────────────────────────────
// Neutral: keine Angaben einer echten Person — die Beispiele erzählen erfundene Fälle („du“). Gesundheit ist Information und Struktur,
// keine medizinische oder Trainingsberatung (steht auch auf den Karten).

import type { EinstellungsText } from './typen';

export const EINSTELLUNGEN_PRIVAT = {
  // ── Gesundheit ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  'gesundheit.module': {
    was: 'Eigene Tagebücher, die nur du ein- oder ausschaltest. Aus: Es wird nichts angezeigt oder abgefragt, es entsteht keine Index-Kennzahl, und andere sehen nichts. Bereits gespeicherte Einträge bleiben.',
    beispiel: 'Du willst einen Wert über ein paar Wochen beobachten. Du schaltest das Symptom-Tagebuch ein: Jeden Abend fragt MAKE OS nach einer Zahl von 0 bis 10, und der Verlauf zeigt die Entwicklung.',
  },
  'gesundheit.modul.haut': {
    was: 'Ein eigener Regler von 0 bis 10 je Tag mit Schub und Auslöser — du gibst ihm einen eigenen Namen. Er erscheint auf „Heute“, wird abends abgefragt und geht in Index und Verlauf ein.',
    beispiel: 'Du nennst den Regler „Rücken“. Abends trägst du eine 3 ein. Nach zwei Wochen siehst du im Verlauf, an welchen Tagen er höher war.',
    an: 'Die Karte erscheint auf „Heute“, die Abendfrage kommt, der Index zählt den Verlauf mit.',
    aus: 'Nichts wird abgefragt oder angezeigt. Alte Einträge bleiben gespeichert.',
    daten: 'Nur du siehst die Einträge. An die KI gehen sie nur mit deiner Einwilligung (b).',
  },
  'gesundheit.modul.serie': {
    was: 'Ein Zähler für „Tage seit …“ mit Verlangen von 0 bis 10. Er erscheint auf „Heute“ und im Journal, wird abends abgefragt und geht in den Index ein.',
    beispiel: 'Du zählst die Tage seit einem Datum, das für dich zählt. Heute steht dort „21 Tage“; trägst du einen Rückfall ein, beginnt der Zähler neu — dein Verlauf bleibt.',
    an: 'Die Karte erscheint, die Abendfrage kommt, der Index zählt mit.',
    aus: 'Kein Zähler, keine Frage. Alte Einträge bleiben gespeichert.',
    daten: 'Nur du siehst ihn. An die KI nur mit deiner Einwilligung (b).',
  },
  'gesundheit.schlaf.erinnerung': {
    was: 'Eine Erinnerung zur Schlafenszeit in der Glocke — ein neutraler Satz, keine Werte.',
    beispiel: 'Dein Schlafziel steht auf 23 Uhr, der Vorlauf auf 30 Minuten. Um 22:30 erscheint in der Glocke „Zeit, den Tag ausklingen zu lassen“.',
    an: 'Du bekommst die Erinnerung zur gewählten Zeit.',
    aus: 'Keine Erinnerung; dein Schlafziel gilt weiter für die Auswertung.',
  },
  'gesundheit.schlaf.handy': {
    was: 'Sendet die Abend-Erinnerung zusätzlich auf dein Handy — über deinen ZOE-Kanal (WhatsApp oder Telegram). Es steht nur „Zeit, den Tag ausklingen zu lassen“ mit Link darin.',
    beispiel: 'Du legst das Laptop früher weg. Um 22:30 meldet sich dein Handy mit dem neutralen Satz und einem Link zur Schlaf-Seite.',
    an: 'Die Erinnerung kommt auch aufs Handy — ohne Werte.',
    aus: 'Nur die Glocke in MAKE OS.',
    daten: 'Der Satz läuft über Telegram bzw. WhatsApp; er enthält keine Gesundheitswerte.',
  },
  'gesundheit.ernaehrung.orientierung': {
    was: 'Ein Satz am Tag zur Orientierung beim Essen: heute eher mehr, wie sonst oder eher leichter — mit den Gründen (Trainingsplan, Belastung gestern, Alltagsbewegung). Keine Mengenempfehlung, keine Ernährungsberatung, kein Zählen.',
    beispiel: 'Gestern war ein harter Trainingstag und heute steht Laufen im Plan: Dort steht „eher mehr“ mit den beiden Gründen. An einem Ruhetag steht „wie sonst“.',
    an: 'Der Satz erscheint in der Ernährungskarte auf „Heute“.',
    aus: 'Keine Orientierung; Plan und Einkauf laufen ganz normal weiter.',
    daten: 'Gerechnet auf dem Server aus deinen eigenen Werten, ohne KI.',
  },
  'gesundheit.erholung.erledigt': {
    was: 'Hakt das Erholungs-Programm für heute ab. So zählt die Einheit für Serie und Verlauf; du kannst den Haken wieder wegnehmen.',
    beispiel: 'Heute steht „Dehnen, 10 Minuten“ im Programm. Nach der Einheit hakst du ab — die Serie zählt einen Tag weiter, und „Heute“ zeigt die Einheit als erledigt.',
    an: 'Die Einheit gilt als gemacht und geht in Serie und Verlauf ein.',
    aus: 'Die Einheit ist offen und erscheint weiter in der Tagesliste.',
  },
  'gesundheit.erholung.terminErledigt': {
    was: 'Hakt einen Behandlungstermin ab, wenn du ihn wahrgenommen hast. Termine ohne Haken bleiben als offen sichtbar.',
    beispiel: 'Du hattest Montag einen Termin zur Behandlung. Nach dem Termin hakst du ihn ab; in der Übersicht steht dann „3 von 6 Terminen erledigt“.',
    an: 'Der Termin zählt als wahrgenommen.',
    aus: 'Der Termin bleibt offen.',
  },
  'gesundheit.erholung.vorschlag': {
    was: 'Zeigt in der Erholung einen Vorschlag für den Tag, gerechnet aus deinen Körperwerten: Recovery, Belastung, HRV-Trend und Schlafschuld.',
    beispiel: 'Die Recovery liegt drei Tage unter deinem Durchschnitt und dein Schlaf ist kurz. Der Vorschlag lautet „heute eher Dehnen und Spaziergang statt hartem Training“ — du entscheidest.',
    an: 'Der Vorschlag steht als Zeile in der Erholung.',
    aus: 'Keine Vorschläge; deine Werte bleiben sichtbar.',
  },
  'gesundheit.erholung.pausen': {
    was: 'Erinnert dich im Arbeitstag an Pausen, im gewählten Abstand und Zeitfenster.',
    beispiel: 'Alle 90 Minuten zwischen 9 und 17 Uhr: Um 10:30 meldet sich MAKE OS — „Zeit für eine kurze Pause“.',
    an: 'Du bekommst zur gewählten Zeit die Erinnerung; die nächste Pause steht in der Zeile.',
    aus: 'Keine Pausen-Erinnerungen.',
  },
  'sport.einstellungen': {
    was: 'Wie dein Cockpit rechnet und was es vorschlägt: welche Karte zuerst steht, wann eine Entlastung vorgeschlagen wird, wie groß eine Deload- oder Taper-Woche ist. Alles Vorschläge — keine Trainings- oder ärztliche Beratung.',
    beispiel: 'Bei Deload 70 % plant MAKE OS in der Entlastungswoche rund 70 % deines üblichen Umfangs. Bei Taper 50 % vor einem Wettkampf nur die Hälfte.',
  },
  'sport.entlastung': {
    was: 'Schlägt eine ruhigere Woche vor, wenn dein HRV-Trend mehrere Tage unter deinem eigenen Bezug lag oder der Ruhepuls darüber. Der Bezug ist dein Durchschnitt der 14 Tage davor.',
    beispiel: 'Von 4 Tagen waren 3 auffällig (HRV unter 90 % deines Bezugs). MAKE OS schlägt vor, die nächste Woche als Entlastung zu planen. Du kannst ablehnen.',
    an: 'Du bekommst den Vorschlag im Cockpit.',
    aus: 'Kein Entlastungsvorschlag; deine Werte bleiben sichtbar.',
  },

  // ── Fokus ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  'fokus.prioritaeten': {
    was: 'Die Themen deines Bereichs in der Reihenfolge, wie wichtig sie sind. Oben zählt zuerst. Der Regler sagt, wie viel Energie hineingeht — ab 65 hat ein Thema Vorfahrt in Tagesplan und Wochenplanung.',
    beispiel: 'Du stellst „Kunden gewinnen“ auf Platz 1 mit Gewicht 80 und „Weiterbildung“ auf Platz 4 mit 30. Der Tagesplan legt tiefe Arbeit zuerst auf das erste Thema.',
  },
  'fokus.zeitQuelle': {
    was: 'Aus welchen Seiten und Fokus-Blöcken die Ist-Zeit eines Themas kommt. Das Thema einer Einheit zählt ihre Fokus-Blöcke automatisch.',
    beispiel: 'Du setzt bei „Kunden gewinnen“ die Quellen Markttraktion und Mandate. Zeit, die du dort verbringst oder dort als Fokus-Block buchst, zählt in dieses Thema.',
  },
  'fokus.zeit': {
    was: 'Soll gegen Ist je Thema: dein Soll (Stunden je Woche) gegen die gemessene Zeit der letzten 7 Tage. Die Ampel sagt, ob Fokus und Zeit zusammenpassen: unter 50 % des Solls bei hoher Priorität „passt nicht“, unter 80 % „knapp“, sonst „passt“.',
    beispiel: 'Soll 10 Stunden, gemessen 4: Das sind 40 % — bei hoher Priorität steht dort „Hohe Priorität, aber nur 4 h von 10 h“, die Ampel ist rot.',
    daten: 'Gemessen wird deine Zeit in den Seiten und bewusste Fokus-Blöcke. Das Soll siehst nur du.',
  },
  'fokus.tagesform': {
    was: 'Deine Recovery von heute. Grün: tiefe Arbeit zuerst. Gelb: eine tiefe Einheit, dann Routine. Rot: nur das Nötige, Termine schieben. Auf Wunsch richtet ZOE den Tag danach aus.',
    beispiel: 'Recovery 38 (Rot): ZOE schlägt vor, zwei Termine zu verschieben und eine Erholungs-Einheit einzuplanen — eingetragen wird erst mit deinem Klick.',
    daten: '„Tag mit ZOE ausrichten“ nutzt die KI und braucht deine Einwilligung (b).',
  },
  'fokus.wirkung': {
    was: 'Der Score deines Bereichs aus mehreren Säulen. Jede Säule besteht aus Faktoren, die entweder echt gemessen sind oder noch fehlen. „% echt gemessen“ sagt, wie belastbar die Zahl ist.',
    beispiel: 'Wirkung 72 bei 55 % gemessen heißt: Die Zahl ist ein guter Hinweis, aber fast die Hälfte der Faktoren hat noch keine Messung.',
    daten: 'Ein Klick auf eine Säule zeigt ihre Faktoren — jeder führt zu der Stelle, an der du ihn verbessern kannst.',
  },
  'fokus.arbeiten': {
    was: 'Die „Lage“ beschreibt, in welchem Zustand das System gerade für euch läuft. Sie stellt Regler wie Tageslast, Strenge des Postfachs, Leine der Agenten und Schutz ein und wirkt in Aufgaben, Tagesplan, Heute und Postfach. Einzelne Regler könnt ihr abweichend setzen.',
    beispiel: 'Ihr wechselt von „Aufbau“ auf „Schutz“ (Gesundheit und Beziehung zuerst, das Geschäft auf Sparflamme): Die Tageslast sinkt von 9 auf 5 Stunden, das Postfach filtert strenger, die Schutzzeit wächst. Nach der Woche stellt ihr zurück.',
  },
  'fokus.teilen': {
    was: '„Unser Fokus“ gehört beiden, „Mein Fokus“ nur dir — es sei denn, du teilst ihn. Ist er geteilt, sieht die andere Person ihn; bearbeiten kann sie ihn nicht.',
    beispiel: 'Dein Fokus für diese Woche lautet „Angebote fertigstellen“. Du teilst ihn: Dein Partner sieht ihn und plant Termine rücksichtsvoller.',
    an: 'Die andere Person liest deinen Fokus.',
    aus: 'Nur du siehst ihn („nur ich“).',
  },
  'ziele.teilen': {
    was: 'Ein eigenes Ziel kannst du mit der anderen Person teilen. Geteilte Ziele erscheinen bei ihr in der Planung; ohne Teilen sieht sie es nicht.',
    beispiel: 'Du teilst das Ziel „Zweimal im Jahr gemeinsam wandern“: Es erscheint bei deiner Partnerin mit den Meilensteinen, die du angelegt hast.',
    an: 'Das Ziel und seine Meilensteine sind für die andere Person sichtbar.',
    aus: 'Nur du siehst es.',
  },
  'routinen.planer': {
    was: 'Routinen sind wiederkehrende Aufgaben mit Tageszeit, Rhythmus und Zuständigem. Pausiert eine Routine, erscheint sie nicht mehr in der Tagesliste, bleibt aber gespeichert.',
    beispiel: 'Die Routine „Wochenplan prüfen“ läuft montags. In einer Urlaubswoche pausierst du sie — am Tag nach dem Urlaub aktivierst du sie wieder.',
  },

  // ── Kapazität und Planung ──────────────────────────────────────────────────────────────────────────────────────────────
  'kapazitaet.grundwert': {
    was: 'Wie viele Stunden pro Woche diese Person arbeitet. Leer heißt: Es gilt die Wochenvorlage, sonst eine Annahme von 40 Stunden.',
    beispiel: 'Mira arbeitet 30 Stunden. Du trägst 30 ein; die Kapazität rechnet mit 6 Stunden je Arbeitstag statt mit 8.',
  },
  'kapazitaet.ausnahmen': {
    was: 'Urlaub nimmt der Person Tage weg, ein fester Block nimmt Stunden je Woche weg (zum Beispiel für eine Weiterbildung oder eine andere Aufgabe). Abwesenheiten und Feiertage aus dem Kalender zählen von selbst.',
    beispiel: 'Urlaub vom 3. bis 14. November: In diesen zwei Wochen zählt Mira nicht als verfügbar. Ein Block von 4 Stunden pro Woche ab Januar senkt ihre verfügbare Zeit dauerhaft um diese Stunden.',
  },
  'kapazitaet.zuweisungen': {
    was: 'Wie viele Stunden pro Woche eine Person fest für ein Mandat oder einen Kunden arbeitet. Diese Stunden sind gebunden und zählen nicht mehr als frei.',
    beispiel: 'Mira arbeitet 12 Stunden pro Woche für die Beispiel GmbH. Von ihren 30 Stunden bleiben 18 für alles andere.',
  },
  'kapazitaet.erholung': {
    was: 'Mit deiner Einwilligung fließt deine Erholung als gemeinsamer Team-Faktor in die belastbare Zeit der nächsten 14 Tage ein. Den Wert siehst nur du; das Team sieht nur den Faktor — und nur, wenn du deine Gesundheit mit allen im Haushalt teilst.',
    beispiel: 'Das Team rechnet mit dem Faktor aller, die teilen: Grün 100 %, Gelb 90 %, Rot 75 % der belastbaren Zeit. Ohne deine Einwilligung rechnet es mit 100 %.',
  },
  'kapazitaet.rechnung': {
    was: 'Verfügbar = Grundwert (sonst Wochenvorlage, sonst eine Annahme von 40 Stunden) minus Urlaub, Feiertage und ganztägige Abwesenheit, minus Termine im Arbeitsfenster, minus 15 Minuten Umschalten je Termin, minus feste Blöcke.',
    beispiel: 'Grundwert 30 Stunden, ein Urlaubstag (6 h), vier Termine (je 1 h plus 15 min Umschalten): Es bleiben rund 18,75 Stunden verfügbar.',
    daten: 'Gesundheitswerte fließen nur mit deiner Einwilligung ein, und nur als Team-Faktor.',
  },
  'kapazitaet.machbarkeit': {
    was: 'Pro Meilenstein und Ziel: Reicht die freie Zeit bis zum Termin für den Rest des Aufwands? Bis 70 % der freien Zeit gilt es als machbar, bis 90 % als eng, darüber als nicht machbar. Ohne Aufwand oder Termin gibt es keine Aussage.',
    beispiel: 'Meilenstein „Angebot fertig“: Aufwand 20 Stunden, 50 % erledigt, in den nächsten zwei Wochen sind 16 Stunden frei. Rest 10 Stunden gegen 16: Das sind 63 % — machbar.',
  },
} as const satisfies Record<string, EinstellungsText>;
