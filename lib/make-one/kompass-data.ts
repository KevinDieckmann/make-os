// ─── MAKE OS — Kompass: das Regelwerk ───────────────────────────────────────
//
// NEUES KONZEPT (01.08.2026)
// Der Kompass ist keine Einstellungsseite, sondern DER ZUSTAND, in dem das
// System gerade läuft — wie ein Fahrmodus im Auto oder eine Szene am
// Mischpult. Vier Ebenen, von grob nach fein:
//
//   1 LAGE     Ein Schalter stellt alles um (Aufbau · Ernte · Schutz · Feuer).
//   2 REGLER   Die Gewichte dahinter — je Bereich der Software eigene.
//   3 WIRKUNG  Neben jedem Regler steht in Echtzeit, was er gerade bewirkt.
//   4 REICHWEITE  Wo der Regler wirkt — als Link, damit man es nachsehen kann.
//
// Die zehn Bauprinzipien aus der Marktanalyse von Steuerungs-Oberflächen
// (Settings-UX, Filter-UX, Dashboard-Design, Mission-Control-Systeme):
//   1. Ein Zustand, nicht viele Schalter — Modi setzen alles gemeinsam.
//   2. Sofortiges Feedback: jede Änderung zeigt sofort ihre Folge in Zahlen.
//   3. Schrittweise Tiefe: grob oben, fein erst auf Wunsch.
//   4. Gruppierung nach dem Denken des Nutzers, nicht nach Code-Struktur.
//   5. Aktive Abweichungen prominent zeigen („Aufbau, angepasst").
//   6. Alles umkehrbar — ein Klick zurück auf den Modus.
//   7. Jeder Regler erklärt sich selbst in einem Satz Klartext.
//   8. Reichweite sichtbar: wo wirkt das, was ich hier ziehe.
//   9. Keine toten Regler — was hier steht, wirkt auch wirklich.
//  10. Alles an einem Ort, kein Kontextwechsel zum Einstellen.
//
// Client-safe: keine Server-Importe.

export type ReglerId =
  | 'fokus-health' | 'fokus-business' | 'fokus-planning' | 'fokus-finance' | 'fokus-social'
  | 'fokus-schwelle'
  | 'tageslast' | 'kritisch-grenze' | 'vorschau-tage' | 'wochenlast'
  | 'tuersteher' | 'triage-tiefe'
  | 'agenten-leine' | 'auto-takt' | 'nachtruhe-ab' | 'tagesstart-auto'
  | 'schutzzeit' | 'recovery-gruen' | 'runway-warnung' | 'koerper-an-agenten';

export interface Regler {
  id: ReglerId;
  label: string;
  bereich: string;
  /** Ein Satz Klartext: was der Regler tut. */
  erklaert: string;
  min: number;
  max: number;
  schritt: number;
  /** Einheit für die Anzeige („h", „%", leer = Punkte). */
  einheit?: string;
  /** Wo das wirkt — als Link zum Nachsehen. */
  wirktIn: { label: string; href: string }[];
  /** Beschreibt die Skala in Worten (unteres/oberes Ende). */
  skala?: [string, string];
  /** Ja/Nein statt Schieberegler (0 = aus, 100 = an). */
  schalter?: boolean;
}

export interface Bereich {
  id: string;
  label: string;
  satz: string;
  farbe: string;
}

export const BEREICHE: Bereich[] = [
  { id: 'fokus', label: 'Fokus', satz: 'Welche Säule gerade zieht.', farbe: '#58D9CD' },
  { id: 'zeit', label: 'Zeit & Last', satz: 'Wie viel ein Tag tragen darf.', farbe: '#DE9E63' },
  { id: 'postfach', label: 'Postfach', satz: 'Wie streng gefiltert wird.', farbe: '#4A6CF7' },
  { id: 'agenten', label: 'Agenten', satz: 'Wie lang die Leine ist.', farbe: '#8A7CE0' },
  { id: 'schutz', label: 'Schutz', satz: 'Was unantastbar bleibt.', farbe: '#58D9CD' },
];

export const REGLER: Regler[] = [
  // ── Fokus: die fünf Säulen ──
  { id: 'fokus-health', label: 'Gesundheit & Energie', bereich: 'fokus', erklaert: 'Wie stark Gesundheits-Aufgaben nach oben wandern.', min: 0, max: 100, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Tag', href: '/os/planung' }, { label: 'Dashboard', href: '/os' }], skala: ['läuft nebenher', 'hat Vorfahrt'] },
  { id: 'fokus-business', label: 'Business-Performance', bereich: 'fokus', erklaert: 'Wie stark Geschäftsaufgaben nach oben wandern.', min: 0, max: 100, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Dashboard', href: '/os' }], skala: ['läuft nebenher', 'hat Vorfahrt'] },
  { id: 'fokus-planning', label: 'Planung & Execution', bereich: 'fokus', erklaert: 'Wie stark Planungs- und Systemarbeit zieht.', min: 0, max: 100, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Bauplan', href: '/os/bauplan' }], skala: ['läuft nebenher', 'hat Vorfahrt'] },
  { id: 'fokus-finance', label: 'Finanzen', bereich: 'fokus', erklaert: 'Wie stark Geldthemen nach oben wandern.', min: 0, max: 100, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Finanzen', href: '/os/finanzen' }], skala: ['läuft nebenher', 'hat Vorfahrt'] },
  { id: 'fokus-social', label: 'Beziehung & Team', bereich: 'fokus', erklaert: 'Wie stark Menschen-Themen nach oben wandern.', min: 0, max: 100, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Familie & Partnerschaft', href: '/os/familie' }], skala: ['läuft nebenher', 'hat Vorfahrt'] },
  { id: 'fokus-schwelle', label: 'Ab wann „im Fokus“', bereich: 'fokus', erklaert: 'Ab welchem Reglerwert eine Säule wirklich Vorfahrt bekommt — sonst hätten alle Regler auf 60 gar keinen Fokus mehr.', min: 40, max: 90, schritt: 5,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Dashboard', href: '/os' }], skala: ['schnell im Fokus', 'nur klare Ansage'] },

  // ── Zeit & Last ──
  { id: 'tageslast', label: 'Tageslast', bereich: 'zeit', erklaert: 'Wie viele Stunden Arbeit ein Tag höchstens tragen soll — darüber warnt das System.', min: 2, max: 12, schritt: 1, einheit: 'h',
    wirktIn: [{ label: 'Tag', href: '/os/planung' }, { label: 'Wochenplaner', href: '/os/planung/woche' }, { label: 'Aufgaben', href: '/os/aufgaben' }], skala: ['ruhiger Tag', 'Vollgas'] },
  { id: 'kritisch-grenze', label: 'Kritisch-Grenze', bereich: 'zeit', erklaert: 'Ab wie vielen kritischen Aufgaben das System Alarm schlägt — mehr kann niemand gleichzeitig tragen.', min: 1, max: 15, schritt: 1,
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Dashboard', href: '/os' }], skala: ['sehr streng', 'lässt viel zu'] },
  { id: 'vorschau-tage', label: 'Vorausschau', bereich: 'zeit', erklaert: 'Wie weit der Zeitstrahl und die Fällig-Gruppen nach vorn schauen.', min: 7, max: 120, schritt: 7, einheit: 'Tage',
    wirktIn: [{ label: 'Aufgaben', href: '/os/aufgaben' }, { label: 'Monat', href: '/os/planung/monat' }], skala: ['kurzer Horizont', 'weiter Blick'] },
  { id: 'wochenlast', label: 'Wochenlast', bereich: 'zeit', erklaert: 'Ab wie vielen verplanten Stunden pro Woche der Wochenplaner warnt.', min: 20, max: 70, schritt: 5, einheit: 'h',
    wirktIn: [{ label: 'Wochenplaner', href: '/os/planung/woche' }], skala: ['ruhige Woche', 'Vollauslastung'] },

  // ── Postfach ──
  { id: 'tuersteher', label: 'Türsteher-Strenge', bereich: 'postfach', erklaert: 'Wie viel unbekannte Absender überhaupt ins Postfach dürfen, bevor du entschieden hast.', min: 0, max: 100, schritt: 25,
    wirktIn: [{ label: 'Postfach', href: '/os/inbox' }], skala: ['jeder darf rein', 'nur Bekannte'] },
  { id: 'triage-tiefe', label: 'Rauschen ausblenden', bereich: 'postfach', erklaert: 'Ab wann Jarvis Nachrichten als Rauschen wegsortiert statt sie zu zeigen.', min: 0, max: 100, schritt: 25,
    wirktIn: [{ label: 'Postfach', href: '/os/inbox' }], skala: ['alles zeigen', 'hart aussortieren'] },

  // ── Agenten ──
  { id: 'agenten-leine', label: 'Agenten-Leine', bereich: 'agenten', erklaert: 'Wie viel die Agenten allein tun dürfen, bevor sie fragen. Ausgehendes bleibt immer bei euch.', min: 0, max: 100, schritt: 25,
    wirktIn: [{ label: 'Agenten', href: '/os/agenten' }, { label: 'Postfach', href: '/os/inbox' }], skala: ['fragt bei allem', 'arbeitet selbständig'] },
  { id: 'auto-takt', label: 'Takt der Läufe', bereich: 'agenten', erklaert: 'Wie oft die Loops und Auswertungen von selbst laufen.', min: 0, max: 100, schritt: 25,
    wirktIn: [{ label: 'Agenten', href: '/os/agenten' }, { label: 'Loops', href: '/os/loop' }], skala: ['nur auf Zuruf', 'ständig im Takt'] },
  { id: 'nachtruhe-ab', label: 'Nachtruhe ab', bereich: 'agenten', erklaert: 'Ab welcher Uhrzeit abends nichts mehr von selbst läuft.', min: 18, max: 24, schritt: 1, einheit: 'Uhr',
    wirktIn: [{ label: 'Agenten', href: '/os/agenten' }], skala: ['früh Feierabend', 'spät bis Mitternacht'] },
  { id: 'tagesstart-auto', label: 'Tagesstart automatisch', bereich: 'agenten', schalter: true,
    erklaert: 'Ob der volle Tageslauf beim ersten Öffnen von selbst startet — er braucht bis zu vier Minuten und mehrere Anfragen.', min: 0, max: 100, schritt: 100,
    wirktIn: [{ label: 'Tagesstart', href: '/os/ritual' }], skala: ['erst auf Knopfdruck', 'startet von selbst'] },

  // ── Schutz ──
  { id: 'schutzzeit', label: 'Schutzzeit', bereich: 'schutz', erklaert: 'Wie hart geschützte Zeiten (Sport, Sunday Dinner, Feierabend) verteidigt werden.', min: 0, max: 100, schritt: 25,
    wirktIn: [{ label: 'Wochenplaner', href: '/os/planung/woche' }, { label: 'Energie', href: '/os/energie' }], skala: ['nachgiebig', 'unantastbar'] },
  { id: 'recovery-gruen', label: 'Grüne Tagesform ab', bereich: 'schutz', erklaert: 'Ab welchem Erholungswert ein Tag als grün gilt — steuert Tagesform, Fokus-Vorschlag und Wochenplanung.', min: 50, max: 85, schritt: 1, einheit: '%',
    wirktIn: [{ label: 'Gesundheit', href: '/os/gesundheit' }, { label: 'Tag', href: '/os/planung' }], skala: ['schnell grün', 'nur wirklich erholt'] },
  { id: 'runway-warnung', label: 'Runway-Warnung ab', bereich: 'schutz', erklaert: 'Ab wie wenigen Monaten Geldreichweite das System rot schlägt.', min: 1, max: 12, schritt: 1, einheit: 'Monate',
    wirktIn: [{ label: 'Finanzen', href: '/os/finanzen' }, { label: 'Controlling', href: '/os/controlling' }], skala: ['erst spät nervös', 'früh warnen'] },
  { id: 'koerper-an-agenten', label: 'Körperdaten an Agenten', bereich: 'schutz', schalter: true,
    erklaert: 'Ob Gesundheitswerte in die Arbeitsaufträge der Agenten fließen. Aus bedeutet: Business-Agenten sehen sie gar nicht erst.', min: 0, max: 100, schritt: 100,
    wirktIn: [{ label: 'Agenten', href: '/os/agenten' }, { label: 'Gesundheit', href: '/os/gesundheit' }], skala: ['bleiben privat', 'fließen mit ein'] },
];

export const REGLER_MAP = Object.fromEntries(REGLER.map(r => [r.id, r])) as Record<ReglerId, Regler>;

export interface Modus {
  id: string;
  label: string;
  satz: string;
  farbe: string;
  /** Vollständige Regler-Stellung dieses Modus. */
  werte: Record<ReglerId, number>;
  /** Reihenfolge der Themen in dieser Lage. */
  ordnung: string[];
}

/**
 * Die vier Lagen. Ein Klick stellt das ganze System um — danach kann man
 * einzeln nachjustieren, dann steht „<Lage>, angepasst".
 */
export const MODI: Modus[] = [
  {
    id: 'aufbau', label: 'Aufbau', farbe: '#58D9CD',
    satz: 'Wir bauen. Produkt und Umsatz ziehen, das System darf mitwachsen.',
    ordnung: ['recht', 'umsatz', 'produkt', 'leben'],
    werte: {
      'fokus-health': 50, 'fokus-business': 80, 'fokus-planning': 70, 'fokus-finance': 55, 'fokus-social': 45,
      tageslast: 9, 'kritisch-grenze': 6, 'vorschau-tage': 30,
      tuersteher: 50, 'triage-tiefe': 50,
      'agenten-leine': 75, 'auto-takt': 75,
      schutzzeit: 50,
      'fokus-schwelle': 65, 'wochenlast': 50, 'nachtruhe-ab': 22, 'tagesstart-auto': 100, 'recovery-gruen': 66, 'runway-warnung': 3, 'koerper-an-agenten': 100,
    },
  },
  {
    id: 'ernte', label: 'Ernte', farbe: '#DE9E63',
    satz: 'Jetzt wird geerntet: Rechnungen raus, Abschlüsse rein, Geld zählt.',
    ordnung: ['umsatz', 'recht', 'produkt', 'leben'],
    werte: {
      'fokus-health': 45, 'fokus-business': 85, 'fokus-planning': 40, 'fokus-finance': 90, 'fokus-social': 55,
      tageslast: 9, 'kritisch-grenze': 5, 'vorschau-tage': 21,
      tuersteher: 25, 'triage-tiefe': 25,
      'agenten-leine': 75, 'auto-takt': 100,
      schutzzeit: 50,
      'fokus-schwelle': 60, 'wochenlast': 55, 'nachtruhe-ab': 22, 'tagesstart-auto': 100, 'recovery-gruen': 66, 'runway-warnung': 4, 'koerper-an-agenten': 100,
    },
  },
  {
    id: 'schutz', label: 'Schutz', farbe: '#58D9CD',
    satz: 'Gesundheit und Beziehung zuerst. Das Geschäft läuft auf Sparflamme weiter.',
    ordnung: ['leben', 'recht', 'umsatz', 'produkt'],
    werte: {
      'fokus-health': 95, 'fokus-business': 35, 'fokus-planning': 30, 'fokus-finance': 40, 'fokus-social': 80,
      tageslast: 5, 'kritisch-grenze': 3, 'vorschau-tage': 14,
      tuersteher: 100, 'triage-tiefe': 75,
      'agenten-leine': 50, 'auto-takt': 50,
      schutzzeit: 100,
      'fokus-schwelle': 70, 'wochenlast': 35, 'nachtruhe-ab': 20, 'tagesstart-auto': 0, 'recovery-gruen': 70, 'runway-warnung': 6, 'koerper-an-agenten': 100,
    },
  },
  {
    id: 'feuer', label: 'Feuer', farbe: '#E4572E',
    satz: 'Nur was brennt. Alles andere wartet, bis es gelöscht ist.',
    ordnung: ['recht', 'umsatz', 'leben', 'produkt'],
    werte: {
      'fokus-health': 40, 'fokus-business': 70, 'fokus-planning': 20, 'fokus-finance': 70, 'fokus-social': 30,
      tageslast: 10, 'kritisch-grenze': 3, 'vorschau-tage': 7,
      tuersteher: 100, 'triage-tiefe': 100,
      'agenten-leine': 100, 'auto-takt': 100,
      schutzzeit: 25,
      'fokus-schwelle': 55, 'wochenlast': 60, 'nachtruhe-ab': 23, 'tagesstart-auto': 100, 'recovery-gruen': 60, 'runway-warnung': 6, 'koerper-an-agenten': 100,
    },
  },
];

export const MODUS = Object.fromEntries(MODI.map(m => [m.id, m])) as Record<string, Modus>;
export const STANDARD_MODUS = 'aufbau';

/** Stellung eines Reglers — eigener Wert schlägt den Modus. */
export function wertVon(id: ReglerId, modusId: string, eigene: Partial<Record<ReglerId, number>> = {}): number {
  const eigen = eigene[id];
  if (typeof eigen === 'number') return eigen;
  return (MODUS[modusId] ?? MODUS[STANDARD_MODUS]).werte[id];
}

/** Wie viele Regler von der Lage abweichen — für „Aufbau, angepasst". */
export function abweichungen(modusId: string, eigene: Partial<Record<ReglerId, number>> = {}): ReglerId[] {
  const m = MODUS[modusId] ?? MODUS[STANDARD_MODUS];
  return (Object.keys(eigene) as ReglerId[]).filter(k => typeof eigene[k] === 'number' && eigene[k] !== m.werte[k]);
}

/** Vierstufige Skalen in Worte fassen — 0/25/50/75/100. */
export function stufeText(v: number, skala?: [string, string]): string {
  if (!skala) return String(v);
  if (v <= 12) return skala[0];
  if (v >= 88) return skala[1];
  if (v < 38) return `eher ${skala[0]}`;
  if (v > 62) return `eher ${skala[1]}`;
  return 'ausgewogen';
}
