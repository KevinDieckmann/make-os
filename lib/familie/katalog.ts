// ─── Startkatalog Familie & Partnerschaft — eigene Formulierungen ──────────
// Inspiriert von Gottman (Love Maps, Rituale, Reparatur), Aron (Nähe durch
// Fragen und Neues), Fair Play (volle Verantwortung je Karte). Alles frei
// formuliert, erweiterbar, nichts davon ist Pflicht.

import type { DateIdee, Karte, Ritual } from './typen';

export const AGENDA = [
  { id: 'wertschaetzung', titel: 'Wertschätzung', minuten: 5, hilfe: 'Jeder nennt drei bis fünf konkrete Dinge: „… — das zeigt mir, dass du …“' },
  { id: 'gut', titel: 'Was lief gut', minuten: 5, hilfe: 'Als Paar, als Team, als Familie.' },
  { id: 'orga', titel: 'Organisation', minuten: 10, hilfe: 'Die Woche im Kalender, fällige Karten, Übergaben. Höchstens zehn Minuten — Business gehört nicht hierher.' },
  { id: 'zeit', titel: 'Schöne Zeit planen', minuten: 5, hilfe: 'Das nächste Date festmachen, Eigenzeit für jeden vereinbaren.' },
  { id: 'themen', titel: 'Ein bis zwei Themen', minuten: 15, hilfe: 'Einer spricht, einer hört zu und gibt wieder, bis sich der andere verstanden fühlt. Erst dann nach einer Lösung suchen.' },
  { id: 'ausblick', titel: 'Ausblick', minuten: 5, hilfe: '„Was brauche ich nächste Woche, um mich geliebt zu fühlen?“' },
] as const;

export const TAGES_RITUALE: Omit<Ritual, 'von' | 'am'>[] = [
  { id: 'rit-abschied', titel: 'Beim Abschied: eine Frage zum Tag des anderen', ebene: 'paar', rhythmus: 'taeglich' },
  { id: 'rit-wiedersehen', titel: 'Beim Wiedersehen: Kuss und 20 Minuten Stress abladen', ebene: 'paar', rhythmus: 'taeglich' },
  { id: 'rit-gutenacht', titel: 'Gute-Nacht-Ritual ohne Handy', ebene: 'paar', rhythmus: 'taeglich' },
];

export const DATE_IDEEN: Omit<DateIdee, 'von' | 'am'>[] = [
  { id: 'di-kochkurs', titel: 'Kochkurs für eine Küche, die ihr beide nicht kennt', tags: ['neu', 'genuss'], aufwand: 2, kosten: 2, dauer: 'abend', neu: true },
  { id: 'di-sonnenaufgang', titel: 'Sonnenaufgang an einem Ort, an dem ihr noch nie wart', tags: ['neu', 'draußen'], aufwand: 2, kosten: 0, dauer: 'halbtag', neu: true },
  { id: 'di-tanzen', titel: 'Tanzstunde (Salsa, Swing, Tango)', tags: ['neu', 'bewegung'], aufwand: 2, kosten: 1, dauer: 'abend', neu: true },
  { id: 'di-klettern', titel: 'Bouldern oder Klettern zusammen', tags: ['neu', 'bewegung'], aufwand: 2, kosten: 1, dauer: 'halbtag', neu: true },
  { id: 'di-paddeln', titel: 'Paddeln oder SUP auf einem See', tags: ['draußen', 'bewegung'], aufwand: 2, kosten: 1, dauer: 'halbtag', neu: false },
  { id: 'di-escape', titel: 'Escape Room zu zweit', tags: ['neu', 'team'], aufwand: 1, kosten: 2, dauer: 'abend', neu: true },
  { id: 'di-museum', titel: 'Museum oder Ausstellung, die keiner von euch ausgesucht hätte', tags: ['neu', 'kultur'], aufwand: 1, kosten: 1, dauer: 'halbtag', neu: true },
  { id: 'di-picknick', titel: 'Picknick im Park mit Lieblingsessen', tags: ['draußen', 'ruhig'], aufwand: 1, kosten: 1, dauer: 'halbtag', neu: false },
  { id: 'di-erstesdate', titel: 'Das erste Date nachstellen', tags: ['erinnerung'], aufwand: 2, kosten: 2, dauer: 'abend', neu: false },
  { id: 'di-restaurant', titel: 'Restaurant, das ihr schon lange ausprobieren wolltet', tags: ['genuss'], aufwand: 1, kosten: 2, dauer: 'abend', neu: true },
  { id: 'di-sauna', titel: 'Therme oder Sauna, Handys im Spind', tags: ['ruhig', 'erholung'], aufwand: 1, kosten: 2, dauer: 'halbtag', neu: false },
  { id: 'di-konzert', titel: 'Konzert oder Kleinkunst in einem kleinen Club', tags: ['kultur', 'neu'], aufwand: 1, kosten: 2, dauer: 'abend', neu: true },
  { id: 'di-wandern', titel: 'Tageswanderung mit Einkehr', tags: ['draußen', 'bewegung'], aufwand: 2, kosten: 1, dauer: 'tag', neu: false },
  { id: 'di-kurztrip', titel: 'Wochenende in einer Stadt, in der ihr beide noch nie wart', tags: ['neu', 'reise'], aufwand: 3, kosten: 3, dauer: 'wochenende', neu: true },
  { id: 'di-sterne', titel: 'Sterne schauen abseits der Stadt, Decke und Tee', tags: ['draußen', 'ruhig'], aufwand: 1, kosten: 0, dauer: 'abend', neu: true },
  { id: 'di-fragenabend', titel: 'Fragenabend: 36 Fragen mit Kerzen, ohne Handy', tags: ['nähe', 'ruhig'], aufwand: 1, kosten: 0, dauer: 'abend', neu: true },
  { id: 'di-markt', titel: 'Wochenmarkt am Morgen, danach zusammen kochen', tags: ['genuss', 'ruhig'], aufwand: 1, kosten: 1, dauer: 'halbtag', neu: false },
  { id: 'di-fahrrad', titel: 'Fahrradtour ohne Ziel', tags: ['draußen', 'bewegung'], aufwand: 1, kosten: 0, dauer: 'halbtag', neu: false },
  { id: 'di-workshop', titel: 'Töpfern, Malen oder Glasbläserei — etwas mit den Händen', tags: ['neu', 'kreativ'], aufwand: 2, kosten: 2, dauer: 'halbtag', neu: true },
  { id: 'di-traumabend', titel: 'Traumabend: jeder erzählt drei Träume für die nächsten fünf Jahre', tags: ['nähe', 'vision'], aufwand: 1, kosten: 0, dauer: 'abend', neu: false },
];

export const LOVEMAP_FRAGEN: { id: string; text: string; tiefe: 1 | 2 | 3 }[] = [
  { id: 'lm-01', text: 'Was hat dich diese Woche am meisten gestresst?', tiefe: 1 },
  { id: 'lm-02', text: 'Worauf freust du dich gerade am meisten?', tiefe: 1 },
  { id: 'lm-03', text: 'Wer ist im Moment dein wichtigster Mensch außerhalb von uns — und warum?', tiefe: 1 },
  { id: 'lm-04', text: 'Was wäre für dich ein perfekter freier Tag?', tiefe: 1 },
  { id: 'lm-05', text: 'Welches Essen tröstet dich, wenn es dir schlecht geht?', tiefe: 1 },
  { id: 'lm-06', text: 'Welches Lied erinnert dich an uns?', tiefe: 1 },
  { id: 'lm-07', text: 'Was würdest du gern lernen, wenn Zeit keine Rolle spielte?', tiefe: 1 },
  { id: 'lm-08', text: 'Wofür bist du in deinem Leben gerade am dankbarsten?', tiefe: 2 },
  { id: 'lm-09', text: 'Was ist ein Traum, den du noch nie laut ausgesprochen hast?', tiefe: 2 },
  { id: 'lm-10', text: 'Wann hast du dich in letzter Zeit von mir besonders gesehen gefühlt?', tiefe: 2 },
  { id: 'lm-11', text: 'Was gibt dir das Gefühl, geliebt zu werden — ganz konkret im Alltag?', tiefe: 2 },
  { id: 'lm-12', text: 'Welche Sorge trägst du gerade mit dir herum, über die wir noch nicht gesprochen haben?', tiefe: 2 },
  { id: 'lm-13', text: 'Was an deiner Kindheit möchtest du in unsere Familie mitnehmen — und was nicht?', tiefe: 2 },
  { id: 'lm-14', text: 'Worauf bist du an dir selbst stolz, und sagst es nie?', tiefe: 2 },
  { id: 'lm-15', text: 'Was brauchst du von mir, wenn du einen schlechten Tag hast?', tiefe: 2 },
  { id: 'lm-16', text: 'Welcher Moment in unserer Beziehung war für dich ein Wendepunkt?', tiefe: 3 },
  { id: 'lm-17', text: 'Wovor hast du in unserem gemeinsamen Leben am meisten Angst?', tiefe: 3 },
  { id: 'lm-18', text: 'Wie soll unser Leben in zehn Jahren aussehen — ein normaler Dienstag?', tiefe: 3 },
  { id: 'lm-19', text: 'Was hast du mir nie ganz verziehen, und was bräuchte es dafür?', tiefe: 3 },
  { id: 'lm-20', text: 'Wenn wir nur noch ein Jahr hätten — was würdest du mit uns ändern?', tiefe: 3 },
  { id: 'lm-21', text: 'Wann fühlst du dich in unserer Beziehung am freiesten?', tiefe: 3 },
  { id: 'lm-22', text: 'Welche Rolle soll das Business in unserem Leben in fünf Jahren spielen?', tiefe: 3 },
];

type KarteVorlage = Omit<Karte, 'von' | 'am' | 'inhaber' | 'geprueft' | 'aktiv'>;
export const KARTEN: KarteVorlage[] = [
  // Zuhause
  { id: 'k-einkauf', titel: 'Wocheneinkauf', bereich: 'zuhause', mindeststandard: 'Kühlschrank hat bis Sonntag, was der Essensplan braucht.', rhythmus: 'wöchentlich', aufwandMinWoche: 90 },
  { id: 'k-essensplan', titel: 'Essensplan', bereich: 'zuhause', mindeststandard: 'Plan für die Woche steht bis Sonntagabend.', rhythmus: 'wöchentlich', aufwandMinWoche: 30 },
  { id: 'k-kochen', titel: 'Kochen unter der Woche', bereich: 'zuhause', mindeststandard: 'Warmes Essen an den geplanten Tagen.', rhythmus: 'täglich', aufwandMinWoche: 300 },
  { id: 'k-waesche', titel: 'Wäsche', bereich: 'zuhause', mindeststandard: 'Nichts Wichtiges fehlt im Schrank.', rhythmus: 'wöchentlich', aufwandMinWoche: 120 },
  { id: 'k-putzen', titel: 'Putzen und Ordnung', bereich: 'zuhause', mindeststandard: 'Bad und Küche einmal pro Woche gründlich.', rhythmus: 'wöchentlich', aufwandMinWoche: 150 },
  { id: 'k-muell', titel: 'Müll und Pfand', bereich: 'zuhause', mindeststandard: 'Kein Überlauf, Abholtage im Blick.', rhythmus: 'wöchentlich', aufwandMinWoche: 20 },
  { id: 'k-reparaturen', titel: 'Reparaturen und Handwerker', bereich: 'zuhause', mindeststandard: 'Kaputtes ist innerhalb von zwei Wochen erledigt oder beauftragt.', rhythmus: 'bei Bedarf', aufwandMinWoche: 20 },
  { id: 'k-post', titel: 'Post, Papiere, Ablage', bereich: 'zuhause', mindeststandard: 'Post in 3 Tagen gesichtet, Fristen im Kalender.', rhythmus: 'wöchentlich', aufwandMinWoche: 30 },
  { id: 'k-vertraege', titel: 'Verträge, Versicherungen, Abos', bereich: 'zuhause', mindeststandard: 'Einmal im Jahr geprüft, Kündigungsfristen im Kalender.', rhythmus: 'jährlich', aufwandMinWoche: 5 },
  // Unterwegs
  { id: 'k-auto', titel: 'Auto und Mobilität', bereich: 'unterwegs', mindeststandard: 'TÜV, Reifen, Tank — keine Überraschungen.', rhythmus: 'bei Bedarf', aufwandMinWoche: 15 },
  { id: 'k-reisen', titel: 'Reisen und Urlaub planen', bereich: 'unterwegs', mindeststandard: 'Urlaub steht drei Monate vorher, inklusive Buchung.', rhythmus: 'quartalsweise', aufwandMinWoche: 20 },
  // Fürsorge
  { id: 'k-arzt', titel: 'Arzttermine und Vorsorge', bereich: 'fuersorge', mindeststandard: 'Vorsorge je Person im Jahr erledigt, Termine im Kalender.', rhythmus: 'jährlich', aufwandMinWoche: 10 },
  { id: 'k-eltern', titel: 'Kontakt zu den Eltern', bereich: 'fuersorge', mindeststandard: 'Jeder Elternteil hört mindestens einmal pro Woche von euch.', rhythmus: 'wöchentlich', aufwandMinWoche: 45 },
  { id: 'k-haustiere', titel: 'Haustiere', bereich: 'fuersorge', mindeststandard: 'Futter, Tierarzt, Betreuung bei Abwesenheit geklärt.', rhythmus: 'täglich', aufwandMinWoche: 120 },
  { id: 'k-freunde', titel: 'Freundschaften pflegen', bereich: 'fuersorge', mindeststandard: 'Einmal im Monat jemanden zu euch einladen.', rhythmus: 'monatlich', aufwandMinWoche: 30 },
  // Magie
  { id: 'k-geschenke', titel: 'Geschenke und Karten', bereich: 'magie', mindeststandard: 'Nichts in letzter Minute — Vorlauf aus „Wichtige Tage“.', rhythmus: 'bei Bedarf', aufwandMinWoche: 20 },
  { id: 'k-feste', titel: 'Feste und Feiertage', bereich: 'magie', mindeststandard: 'Plan für Geburtstage, Weihnachten, Jahrestag steht rechtzeitig.', rhythmus: 'jährlich', aufwandMinWoche: 15 },
  { id: 'k-dateplanung', titel: 'Date-Planung', bereich: 'magie', mindeststandard: 'Wer dran ist, plant komplett — inklusive Reservierung und Betreuung.', rhythmus: 'wöchentlich', aufwandMinWoche: 30 },
  { id: 'k-traditionen', titel: 'Familientraditionen', bereich: 'magie', mindeststandard: 'Die eigenen Rituale finden statt, auch in vollen Wochen.', rhythmus: 'wöchentlich', aufwandMinWoche: 30 },
  // Wild
  { id: 'k-krankheit', titel: 'Krankheit im Haushalt', bereich: 'wild', mindeststandard: 'Wer gesund ist, übernimmt; Absprachen für Termine stehen.', rhythmus: 'bei Bedarf', aufwandMinWoche: null },
  { id: 'k-umzug', titel: 'Umzug oder große Veränderung', bereich: 'wild', mindeststandard: 'Eigener Plan mit Verantwortlichen je Teil.', rhythmus: 'bei Bedarf', aufwandMinWoche: null },
];

export const KINDER_KARTEN: KarteVorlage[] = [
  { id: 'k-kita', titel: 'Kita/Schule: Kommunikation und Termine', bereich: 'fuersorge', mindeststandard: 'Elternbriefe gelesen, Termine im Kalender, Fristen erledigt.', rhythmus: 'wöchentlich', aufwandMinWoche: 45 },
  { id: 'k-bringen', titel: 'Bringen und Abholen', bereich: 'unterwegs', mindeststandard: 'Jeden Tag geklärt, wer bringt und wer holt.', rhythmus: 'täglich', aufwandMinWoche: 300 },
  { id: 'k-kinderarzt', titel: 'Kinderarzt und U-Untersuchungen', bereich: 'fuersorge', mindeststandard: 'U-Termine und Impfungen rechtzeitig.', rhythmus: 'bei Bedarf', aufwandMinWoche: 15 },
  { id: 'k-einzelzeit', titel: 'Einzelzeit mit jedem Kind', bereich: 'magie', mindeststandard: 'Jedes Kind hat pro Woche eine Stunde mit jedem Elternteil allein.', rhythmus: 'wöchentlich', aufwandMinWoche: 120 },
];

export const REPARATUR_SAETZE = [
  'Ich glaube, ich habe gerade überreagiert.',
  'Kannst du das nochmal anders sagen? Ich will es verstehen.',
  'Du hast recht, das war mein Anteil.',
  'Ich brauche eine Pause — in 20 Minuten bin ich wieder da.',
  'Was brauchst du gerade von mir?',
  'Wir sind ein Team. Lass uns das zusammen anschauen.',
  'Ich liebe dich, auch wenn wir gerade streiten.',
  'Das ist mir wichtig, weil …',
];

/** Die vier gefährlichen Muster und ihr Gegenmittel (Gottman). */
export const MUSTER = [
  { muster: 'Kritik', gegenmittel: 'Sanfter Einstieg: „Ich fühle …, weil …, ich wünsche mir …“' },
  { muster: 'Verachtung', gegenmittel: 'Wertschätzung pflegen — jeden Tag etwas Konkretes sehen und sagen.' },
  { muster: 'Rechtfertigung', gegenmittel: 'Verantwortung für den eigenen Anteil übernehmen, auch für einen kleinen.' },
  { muster: 'Mauern', gegenmittel: 'Pause von mindestens 20 Minuten, beruhigen, dann zurückkommen.' },
];

export const HILFE = 'Wenn es eng wird: EFL-Beratungsstellen und pro familia bieten Paarberatung. Bei Gewalt: Hilfetelefon 116 016. Telefonseelsorge: 0800 111 0 111.';
