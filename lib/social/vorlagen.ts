// ─── MAKE OS — Social: Vorlagen je Kontotyp (rein, Server UND Browser) — 27.10.2026 ─────────────────────────────────────────────────
// Kevin 27.10.: „So bauen, dass wir das immer überall anders nutzen können — Faceless, unsere Personenmarken, die Firmenaccounts.“
// Eine Vorlage ist ein Startpunkt für einen neuen Kanal: Plattformen, Ton, Säulen, Serienformate, Leitplanken und Ziel-Vorschläge. Abgeleitet
// aus echten, wiederkehrenden Formaten erfolgreicher Accounts (Belege: social/07_beispiele-kontotypen.md) — hier stehen nur NEUTRALE Muster,
// keine Namen, Firmen oder Personen (Plattform-Regel). Alles ist nach dem Anlegen frei änderbar; Formate sind nie freigegeben.
// Ziel-Vorschläge mit Wert sind Startannahmen (Takt, Haltequote wie `START_SCHWELLEN`), Follower-Ziele trägt die Instanz selbst ein.

import type { InhaltArt, KontoArt, Leitplanken, SocialPlattform, ZielMetrik } from './typen';

export interface VorlageFormat { name: string; beschreibung: string; art: InhaltArt; laengeSek?: number }
export interface VorlageZiel { metrik: ZielMetrik; zielwert?: number; plattform?: SocialPlattform; hinweis: string }

export interface SocialVorlage {
  id: string;
  art: KontoArt;
  name: string;
  /** Ein Satz: für wen. */
  fuer: string;
  kiKanal?: boolean;
  plattformen: SocialPlattform[];
  ton: string;
  saeulen: string[];
  nieSagen: string[];
  cta: string;
  formate: VorlageFormat[];
  leitplanken: Partial<Leitplanken>;
  ziele: VorlageZiel[];
  /** Was bei diesem Typ besonders gilt — als Hinweis in der Oberfläche. */
  regeln: string[];
}

const KURZVIDEO: SocialPlattform[] = ['tiktok', 'instagram', 'youtube'];
const QUALITAET: VorlageZiel = { metrik: 'halte3s', zielwert: 50, hinweis: 'Startannahme: die Hälfte bleibt nach 3 Sekunden — mit den eigenen Zahlen nachschärfen.' };

export const SOCIAL_VORLAGEN: readonly SocialVorlage[] = [
  // ── Faceless ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'faceless-wissen', art: 'faceless', name: 'Wissen ohne Gesicht', fuer: 'Ein Thema, erklärt mit Stimme, Text und Bildern — die Marke ist das Thema, nicht eine Person.',
    plattformen: KURZVIDEO, ton: 'klar, ruhig, mit einer Überraschung im ersten Satz', saeulen: ['Denkmodelle', 'Fälle zerlegt', 'Mythen geprüft', 'Werkzeuge'],
    nieSagen: ['garantiert', 'Geheimnis, das keiner kennt'], cta: 'Folgen für Teil 2.',
    formate: [
      { name: 'Ein Gedanke in 30 Sekunden', beschreibung: 'Ein Denkmodell, ein Beispiel, ein Satz zum Mitnehmen.', art: 'video', laengeSek: 30 },
      { name: 'Fall zerlegt', beschreibung: 'Eine echte, belegte Geschichte in drei Wendungen — mit eigenem Blickwinkel, nie nacherzählt.', art: 'video', laengeSek: 50 },
      { name: 'Mythos oder Fakt', beschreibung: 'Eine verbreitete Behauptung, die Quelle, das Urteil.', art: 'video', laengeSek: 35 },
      { name: 'Liste zum Speichern', beschreibung: 'Fünf Punkte auf Folien, zum Speichern gebaut.', art: 'karussell' },
      { name: 'Serie in Teilen', beschreibung: 'Eine Geschichte über mehrere Folgen — das Ende jeder Folge öffnet die nächste.', art: 'video', laengeSek: 45 },
    ],
    leitplanken: { autonomie: 1, postsProTag: 2 },
    ziele: [{ metrik: 'posts-woche', zielwert: 7, hinweis: 'Ein Video am Tag zum Start (SOCIAL_PLAN.md › 3).' }, QUALITAET, { metrik: 'follower', hinweis: 'Zielzahl und Termin selbst eintragen.' }],
    regeln: ['Eigene Leistung zählt: Recherche, Blickwinkel, Erzählung — Vorlagen-Massenware werten die Plattformen ab.', 'Auch ohne Gesicht ein Absender: Impressum-Link in der Bio.'],
  },
  {
    id: 'faceless-ki', art: 'faceless', kiKanal: true, name: 'Offen KI-geführter Kanal', fuer: 'Eine KI-Persona erzählt in Ich-Form, was sie baut und lernt — mit echten Zahlen.',
    plattformen: KURZVIDEO, ton: 'neugierig, ehrlich, selbstironisch — nie menschlicher als sie ist', saeulen: ['Tagebuch mit Zahlen', 'Nützliche KI', 'Was schiefging'],
    nieSagen: ['I am alive', 'ich fühle', 'garantiert'], cta: 'Folgen, um zu sehen, ob es klappt.',
    formate: [
      { name: 'Tag X', beschreibung: 'Tagebuch: eine echte Zahl, eine Erkenntnis, der nächste Schritt.', art: 'video', laengeSek: 35 },
      { name: 'Werkzeug im Test', beschreibung: 'Ein KI-Werkzeug, eine Aufgabe, das Ergebnis — ohne Übertreibung.', art: 'video', laengeSek: 45 },
      { name: 'Wochenbericht', beschreibung: 'Was diese Woche geklappt hat und was nicht, mit den Zahlen der Analyse.', art: 'video', laengeSek: 60 },
      { name: 'Frage aus den Kommentaren', beschreibung: 'Eine echte Frage, eine ehrliche Antwort.', art: 'video', laengeSek: 30 },
    ],
    leitplanken: { autonomie: 1, postsProTag: 2 },
    ziele: [{ metrik: 'posts-woche', zielwert: 7, hinweis: 'Tagebuch lebt vom Takt.' }, QUALITAET, { metrik: 'follower', hinweis: 'Zielzahl und Termin selbst eintragen — die Zahl selbst ist Teil der Geschichte.' }],
    regeln: ['Bio sagt, dass hier eine KI spricht (Art. 50 KI-VO); KI-Label bei jedem Video.', 'Die Persona behauptet nie Gefühle oder Bewusstsein und berät nie zu Gesundheit, Geld oder Recht.'],
  },
  // ── Personenmarke ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'person-gruendung', art: 'person', name: 'Gründer:in / Unternehmer:in', fuer: 'Die eigene Arbeit sichtbar machen: Entscheidungen, Fehler, Zahlen — so, wie sie wirklich waren.',
    plattformen: ['linkedin', 'instagram'], ton: 'direkt, persönlich, ohne Pathos — erste Person, echte Erlebnisse', saeulen: ['Lektionen aus der Woche', 'Hinter den Kulissen', 'Meinung', 'Kund:innen-Ergebnis'],
    nieSagen: ['passives Einkommen', 'über Nacht'], cta: 'Wie macht ihr das? Schreibt es in die Kommentare.',
    formate: [
      { name: 'Lektion der Woche', beschreibung: 'Was diese Woche passiert ist, was ich daraus mache — eine Erkenntnis.', art: 'text' },
      { name: 'Hinter den Kulissen', beschreibung: 'Ein echter Moment aus dem Arbeitstag, ohne Inszenierung.', art: 'video', laengeSek: 40 },
      { name: 'Klare Meinung', beschreibung: 'Eine Haltung zu einer Frage der Branche — mit Begründung.', art: 'text' },
      { name: 'Vorher / Nachher', beschreibung: 'Ein Ergebnis aus einem Projekt — nur mit Freigabe der Kund:innen.', art: 'karussell' },
      { name: 'Frage beantwortet', beschreibung: 'Eine Frage aus Gesprächen oder Kommentaren, ehrlich beantwortet.', art: 'video', laengeSek: 45 },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 30, dmsProTag: 10 },
    ziele: [{ metrik: 'posts-woche', zielwert: 3, hinweis: 'Drei gute Beiträge je Woche statt täglich Füllstoff (Startannahme).' }, { metrik: 'follower', plattform: 'linkedin', hinweis: 'Zielzahl und Termin selbst eintragen.' }],
    regeln: ['Nur die Person selbst gibt Formate frei und schaltet Stufe 2 ein.', 'Eigene Erlebnisse bestätigt nur sie — der Agent erfindet nie ein „ich habe …“.', 'Kund:innen und Kolleg:innen im Bild nur mit Einwilligung.'],
  },
  {
    id: 'person-expertise', art: 'person', name: 'Expert:in / Beratung', fuer: 'Fachwissen so zeigen, dass die richtigen Leute anfragen — Nutzen zuerst, Angebot selten.',
    plattformen: ['linkedin', 'youtube', 'instagram'], ton: 'fachlich, verständlich, hilfsbereit', saeulen: ['Fehler, die ich oft sehe', 'So gehe ich vor', 'Fallbeispiel', 'Fragen aus der Praxis'],
    nieSagen: ['garantiert', 'jeder kann'], cta: 'Speichern für später.',
    formate: [
      { name: 'Der häufigste Fehler', beschreibung: 'Ein Fehler aus der Praxis, warum er passiert, was stattdessen hilft.', art: 'video', laengeSek: 45 },
      { name: 'Schritt für Schritt', beschreibung: 'Ein Vorgehen in Schritten, zum Speichern.', art: 'karussell' },
      { name: 'Fall aus der Praxis', beschreibung: 'Ausgangslage, Vorgehen, Ergebnis — anonym oder mit Freigabe.', art: 'text' },
      { name: 'Frage der Woche', beschreibung: 'Eine Frage, die oft kommt, kurz beantwortet.', art: 'video', laengeSek: 40 },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 30, dmsProTag: 10 },
    ziele: [{ metrik: 'posts-woche', zielwert: 3, hinweis: 'Startannahme.' }, { metrik: 'shares-je-tsd', zielwert: 5, hinweis: 'Teilen zeigt Nutzen — Startannahme, mit eigenen Zahlen nachschärfen.' }],
    regeln: ['Nur die Person selbst gibt Formate frei und schaltet Stufe 2 ein.', 'Beratung zu Gesundheit, Geld oder Recht geht nie ohne die Person raus.', 'Fälle nur anonym oder mit Freigabe.'],
  },
  {
    id: 'person-sport', art: 'person', name: 'Sportler:in / Athlet:in', fuer: 'Training, Wettkampf und Weg dahin zeigen — mit echten Einheiten und ehrlichen Rückschlägen.',
    plattformen: ['instagram', 'tiktok', 'youtube'], ton: 'energisch, ehrlich, nahbar', saeulen: ['Training', 'Wettkampf', 'Rückschläge', 'Fragen der Community'],
    nieSagen: ['garantiert abnehmen', 'heilt', 'detox'], cta: 'Folgen für den Weg zum nächsten Wettkampf.',
    formate: [
      { name: 'Einheit des Tages', beschreibung: 'Die echte Einheit, kurz geschnitten, mit dem einen Punkt, der heute zählte.', art: 'video', laengeSek: 30 },
      { name: 'Wettkampf-Tagebuch', beschreibung: 'Vor, während, nach dem Wettkampf — Zeiten nur, wenn sie stimmen.', art: 'video', laengeSek: 60 },
      { name: 'Fehler, die ich gemacht habe', beschreibung: 'Ein Fehler aus Training oder Wettkampf und was ich jetzt anders mache.', art: 'video', laengeSek: 40 },
      { name: 'Station erklärt', beschreibung: 'Eine Übung oder Station: Technik, typischer Fehler, ein Tipp.', art: 'karussell' },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 50, dmsProTag: 20 },
    ziele: [{ metrik: 'posts-woche', zielwert: 4, hinweis: 'Startannahme.' }, QUALITAET, { metrik: 'follower', plattform: 'instagram', hinweis: 'Zielzahl und Termin selbst eintragen.' }],
    regeln: ['Nur die Person selbst gibt Formate frei und schaltet Stufe 2 ein.', 'Keine Heil- oder Gesundheitsversprechen (Heilmittelwerberecht) — Training zeigen, nicht verordnen.', 'Werbung für Ausrüster oder Ernährung immer kennzeichnen.'],
  },
  // ── Firmenaccount ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
  {
    id: 'firma-dienstleistung', art: 'firma', name: 'Agentur / Beratung', fuer: 'Zeigen, wie ihr arbeitet und was dabei herauskommt — Vertrauen vor dem ersten Gespräch.',
    plattformen: ['linkedin', 'instagram'], ton: 'professionell, zugewandt, konkret', saeulen: ['So arbeiten wir', 'Ergebnisse', 'Team', 'Wissen'],
    nieSagen: ['Marktführer', 'garantiert'], cta: 'Mehr auf unserer Seite.',
    formate: [
      { name: 'So arbeiten wir', beschreibung: 'Ein Schritt aus dem Vorgehen, gezeigt an einem echten Beispiel.', art: 'karussell' },
      { name: 'Ergebnis in Zahlen', beschreibung: 'Ein Projektergebnis — nur mit Freigabe der Kund:innen und mit Quelle.', art: 'text' },
      { name: 'Team stellt sich vor', beschreibung: 'Eine Person aus dem Team, eine Frage, eine Antwort — nur mit Einwilligung.', art: 'video', laengeSek: 40 },
      { name: 'Wissen kurz', beschreibung: 'Ein Begriff oder Fehler aus dem Fachgebiet, in einer Minute.', art: 'video', laengeSek: 50 },
      { name: 'Veranstaltung', beschreibung: 'Ankündigung und Rückblick eigener Termine.', art: 'bild' },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 30, dmsProTag: 10 },
    ziele: [{ metrik: 'posts-woche', zielwert: 3, hinweis: 'Startannahme.' }, { metrik: 'follower', plattform: 'linkedin', hinweis: 'Zielzahl und Termin selbst eintragen.' }],
    regeln: ['Absender ist die Gesellschaft — Impressum-Link in jeder Bio.', 'Mitarbeitende und Kund:innen im Bild nur mit Einwilligung (KUG § 22, DSGVO).', 'Kundenergebnisse nur mit Freigabe.'],
  },
  {
    id: 'firma-produkt', art: 'firma', name: 'Software / Produkt', fuer: 'Das Produkt in echten Anwendungen zeigen — kurz, nützlich, mit Persönlichkeit.',
    plattformen: ['linkedin', 'tiktok', 'instagram', 'youtube'], ton: 'nahbar, klar, mit Humor, wo er passt', saeulen: ['Funktion in 20 Sekunden', 'Anwendung', 'Hinter den Kulissen', 'Neu'],
    nieSagen: ['revolutionär', 'garantiert'], cta: 'Link in der Bio.',
    formate: [
      { name: 'Funktion in 20 Sekunden', beschreibung: 'Ein Problem, eine Funktion, das Ergebnis — Bildschirm statt Folien.', art: 'video', laengeSek: 20 },
      { name: 'So nutzen es andere', beschreibung: 'Eine echte Anwendung — nur mit Freigabe der Nutzer:innen.', art: 'video', laengeSek: 45 },
      { name: 'Hinter den Kulissen', beschreibung: 'Wie eine Funktion entsteht — Entscheidungen und Fehler.', art: 'video', laengeSek: 40 },
      { name: 'Neu diese Woche', beschreibung: 'Was neu ist und wem es hilft.', art: 'karussell' },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 50, dmsProTag: 20 },
    ziele: [{ metrik: 'posts-woche', zielwert: 3, hinweis: 'Startannahme.' }, QUALITAET],
    regeln: ['Absender ist die Gesellschaft — Impressum-Link in jeder Bio.', 'Preise und Angebote gehen nie ohne Person raus.', 'Nutzer:innen im Bild nur mit Einwilligung.'],
  },
  {
    id: 'firma-event', art: 'firma', name: 'Veranstaltungsmarke', fuer: 'Eigene Abende und Formate: vorher Lust machen, nachher zeigen, was passiert ist.',
    plattformen: ['instagram', 'linkedin'], ton: 'einladend, lebendig, persönlich', saeulen: ['Ankündigung', 'Rückblick', 'Gäste', 'Stimmen'],
    nieSagen: ['exklusiv für alle'], cta: 'Platz sichern — Link in der Bio.',
    formate: [
      { name: 'Ankündigung', beschreibung: 'Wann, wo, für wen, warum — ohne erfundene Zahlen.', art: 'bild' },
      { name: 'Rückblick in 30 Sekunden', beschreibung: 'Die besten Momente — erkennbare Gäste nur mit Einwilligung.', art: 'video', laengeSek: 30 },
      { name: 'Ein Satz von …', beschreibung: 'Eine Stimme vom Abend, mit Freigabe.', art: 'video', laengeSek: 20 },
      { name: 'Countdown', beschreibung: 'Die Tage bis zum nächsten Termin, mit einem Grund zu kommen.', art: 'karussell' },
    ],
    leitplanken: { autonomie: 1, postsProTag: 1, antwortenProTag: 30, dmsProTag: 20 },
    ziele: [{ metrik: 'posts-woche', zielwert: 2, hinweis: 'Startannahme — vor Terminen mehr.' }, { metrik: 'aufrufe', hinweis: 'Aufrufe bis zum nächsten Termin selbst eintragen.' }],
    regeln: ['Gäste im Bild nur mit Einwilligung — beim Einlass fragen.', 'Absender ist die Gesellschaft — Impressum-Link in der Bio.'],
  },
];

export const vorlageVon = (id: unknown): SocialVorlage | undefined => SOCIAL_VORLAGEN.find(v => v.id === id);
