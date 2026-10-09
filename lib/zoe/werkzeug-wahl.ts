// ─── ZOE: höchstens 20 Werkzeuge je Zug (09.10., Paket 4a; Entscheidung, Fragerunde Teil 1 Nr. 13: „ZOE ≤ 20 Werkzeuge, Rest zu den Heads“) ──
// Vorher gingen rund 66 Werkzeuge in JEDEN Prompt — ab 30–40 wählt ein Modell schlechter (AGENTEN_KONZEPT.md B3). Jetzt bekommt ZOE je Zug:
//   (1) den festen KERN — lesen (Arbeitssuche über Brain und App, Notiz), Aufgaben-Lage, freie Zeit, Gedächtnis, Aufgabe anlegen und die
//       Heads (`an_head`, `head_fragen`);
//   (2) die Werkzeuge des BEREICHS, auf den der Zug zielt — per Regelwerk aus Frage, letzten Fragen des Gesprächs und dem Bezug („ZOE
//       fragen“ aus der Markttraktion), NIE per Modell; mehrere Bereiche teilen sich die Plätze reihum.
// Alles andere erreicht ZOE über den zuständigen Head (Katalog lib/agenten/katalog.ts) — Fach-Werkzeuge laufen über die Heads.
// Rein und getestet (tests/agenten-p4a-werkzeuge.test.ts: kein Zug > 20; jedes bisherige Werkzeug über Kern, Bereich oder einen Head).
// Doku der Zuordnung: AGENTEN_KONZEPT.md › „Paket 4 — so verdrahtet“.

export const ZOE_GRENZE = 20;

/** Immer dabei (sofern die Person sie haben darf — KI-Schalter, Haushalt). Reihenfolge = Vorrang. */
export const ZOE_KERN = ['an_head', 'head_fragen', 'suche_arbeit', 'lies_notiz', 'create_task', 'meine_aufgaben', 'freie_zeit', 'fakt_merken', 'frag_gedaechtnis'] as const;

export interface ZoeBereich {
  id: string;
  /** Woran das Regelwerk den Bereich erkennt (Frage, letzte Fragen, Bezug). */
  muster: RegExp;
  /** Werkzeuge des Bereichs — Reihenfolge = Vorrang, wenn die Plätze knapp sind. */
  werkzeuge: readonly string[];
}

/**
 * Wortanfang (Buchstaben inkl. Umlaute — `\b` kennt nur ASCII, „übergeben“ fiele sonst durch). Endungen bleiben offen
 * („Rechnung“ trifft „Rechnungen“); kurze, mehrdeutige Wörter schließen mit `E` ab („Post“ ≠ „Postfach“, „Event“ ≠ „eventuell“).
 */
const W = (...alt: string[]) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${alt.join('|')})`, 'iu');
const E = '(?![\\p{L}\\p{N}])';

export const ZOE_BEREICHE: readonly ZoeBereich[] = [
  { id: 'vertrieb', muster: W(`leads?${E}`, `deals?${E}`, 'pipeline', 'angebot', 'power ?hour', 'kund', 'kontakt', 'firm', 'anruf', 'telefon', `crm${E}`, 'markttraktion', 'vertrieb', `sales${E}`, 'akquise', 'qualifizier', 'nachfass', 'follow[- ]?up', 'mandat', 'ansprache', 'übergeb', 'chance', `sql${E}`, `mql${E}`, 'win ?rate'),
    // Die ersten 11 passen neben den Kern — darunter alle, die es NUR bei ZOE gibt (notieren, Deal, übergeben, Kontakt suchen); was danach
    // kommt, haben auch die Heads (Sales, Kundenerfolg) und rückt nur nach, wenn Platz ist.
    werkzeuge: ['crm_lage', 'crm_suche', 'kontakt_akte', 'pipeline', 'notiere_kontakt', 'sales_lage', 'crm_vorschlag', 'chance_anlegen', 'uebergeben', 'suche_kontakt', 'firma_akte', 'entwurf_ansprache', 'angebote_lage', 'mandate_lage', 'setze_kunde', 'qualifizierung_lage'] },
  { id: 'marketing', muster: W('kampagne', 'newsletter', 'beitr(ag|äge)', 'linkedin', `posts?${E}`, 'posting', 'marketing', 'segment', 'content', 'sichtbarkeit', `social${E}`),
    werkzeuge: ['marketing_lage', 'kampagnen_lage', 'kennzahlen', 'crm_vorschlag', 'qualifizierung_lage', 'entwurf_ansprache'] },
  { id: 'event', muster: W(`events?${E}`, 'veranstaltung', 'gäste', 'gaeste', 'einladung', 'netzwerken', 'make\\.one'),
    werkzeuge: ['events_lage', 'besuche_lage', 'crm_vorschlag', 'kennzahlen'] },
  { id: 'crm-pflege', muster: W('dublette', 'datenqualit', 'stammdaten', 'import', 'verbindungsprüf', 'ablage', `pdf${E}`),
    werkzeuge: ['datenqualitaet', 'stammdaten_lage', 'crm_datei_lesen', 'crm_vorschlag'] },
  { id: 'finanzen', muster: W('rechnung', 'zahlung', 'kontostand', `konto${E}`, 'liquidit', 'umsatz', 'kosten', 'planposten', `abos?${E}`, 'miete', 'gehalt', 'monatsabschluss', `bwa${E}`, `cash${E}`, 'runway', 'finanz', 'business-index', `dso${E}`, 'gewinn', 'jahresziel', 'controlling'),
    werkzeuge: ['business_index', 'setze_kontostand', 'erfasse_rechnung', 'erfasse_zahlung', 'erfasse_planposten', 'monatsabschluss_erfassen', 'setze_ziele', 'gesellschaften_lesen'] },
  { id: 'haushalt', muster: W('haushalt', 'privat', 'buchung', 'ausgaben', 'sparquote', 'lebensmittel', 'lieferdienst', 'einkommen', 'fixkosten', 'budget'),
    werkzeuge: ['haushalt_stand', 'haushalt_buchungen', 'haushalt_zuordnen', 'haushalt_rechnung_bezahlt', 'haushalt_rechnung_erfassen'] },
  { id: 'gesundheit', muster: W('gesundheit', 'schlaf', 'geschlafen', 'recovery', `hrv${E}`, 'ruhepuls', `puls${E}`, 'training', `sport${E}`, 'routine', 'journal', `haut${E}`, 'juck', `schub${E}`, 'streak', 'sauber', 'rückfall', 'verlangen', 'vital', 'tagesform', 'dankbar', 'stimmung', 'energie', 'müde'),
    werkzeuge: ['gesundheits_index', 'setze_vitalwerte', 'hake_routine', 'journal_eintrag', 'haut_eintrag', 'streak_eintrag'] },
  { id: 'ernaehrung', muster: W('einkauf', `essen${E}`, 'ernährung', 'rezept', 'kochen', 'auf die liste', 'wir brauchen'),
    werkzeuge: ['einkauf_setzen'] },
  { id: 'kalender', muster: W('termin', 'kalender', `block${E}`, 'blöcke', 'einplan', `plane?n?${E}`, 'fokuszeit', 'zeitfenster', `uhr${E}`, 'übermorgen', 'nachmittag', 'vormittag'),
    werkzeuge: ['plan_block'] },
  { id: 'aufgaben', muster: W('aufgabe', 'todo', 'to-do', 'erledig', 'projekt', 'unterlage', 'datei', 'dokument'),
    werkzeuge: ['aufgabe_an_zoe', 'projekt_unterlagen', 'datei_lesen'] },
  { id: 'planung', muster: W('ziel', 'meilenstein', `fokus${E}`, `okr${E}`, 'quartal'),
    werkzeuge: ['setze_meilenstein', 'setze_fokus', 'setze_ziele'] },
  { id: 'wissen', muster: W('notiz', `brain${E}`, 'vault', 'obsidian', 'protokoll', 'wissen', 'offene frage', 'merk'),
    werkzeuge: ['suche_wissen', 'notiz_anlegen', 'notiz_ergaenzen'] },
  { id: 'inbox', muster: W('e-?mails?', `mails?${E}`, 'postfach', 'inbox', 'posteingang', 'nachricht', 'geschrieben'),
    werkzeuge: ['lies_postfach'] },
  { id: 'business', muster: W('gesellschaft', 'holding', 'gründung', 'wem gehört', 'beteiligung', 'business'),
    werkzeuge: ['business_index', 'gesellschaften_lesen'] },
  { id: 'bauplan', muster: W('bauplan', 'software', 'feature', 'funktion', 'fehler', `bug${E}`, 'kaputt', `idee${E}`, 'verbesser', 'nervt'),
    werkzeuge: ['bauplan_notieren'] },
  { id: 'agenten', muster: W('agent', `lauf${E}`, 'läufe', 'starte', 'recherch', `board${E}`, 'wochenlage', 'parallel', 'hintergrund', 'lage über alles', 'transkript', 'zielliste', 'prospect', 'outreach', 'öffne'),
    werkzeuge: ['run_agent', 'starte_auftraege', 'open_agent', 'heads_lage'] },
];

export interface WahlEingabe {
  /** Die Nachricht dieses Zugs. */
  text: string;
  /** Die letzten Fragen des Gesprächs (Folgefragen wie „und für Juli?“ zielen auf denselben Bereich). */
  frueher?: readonly string[];
  /** Bezug aus „ZOE fragen“ (Markttraktion) — der Vertrieb kommt dann zuerst, das passende Lese-Werkzeug vorneweg. */
  bezug?: { art: string } | null;
  /** Werkzeuge, die die Person überhaupt haben darf (KI-Schalter, Einwilligung, Haushalt) — nur daraus wird gewählt. */
  verfuegbar: ReadonlySet<string>;
  grenze?: number;
}

/** Bezug → das Werkzeug, mit dem ZOE zuerst nachsieht (wie crmBezugHinweis). */
const BEZUG_WERKZEUG: Readonly<Record<string, string>> = {
  kontakt: 'kontakt_akte', firma: 'firma_akte', deal: 'pipeline', angebot: 'angebote_lage', mandat: 'mandate_lage', event: 'events_lage',
  markttraktion: 'kennzahlen', sales: 'sales_lage', marketing: 'marketing_lage', 'event-welt': 'events_lage', qualifizierung: 'qualifizierung_lage', stammdaten: 'stammdaten_lage',
};

/** Welche Bereiche ein Zug trifft — in der Reihenfolge, in der sie im Text vorkommen (die aktuelle Frage vor den früheren). */
export function bereicheFuer(text: string, frueher: readonly string[] = [], bezug?: { art: string } | null): string[] {
  const raus: string[] = [];
  if (bezug) raus.push(bezug.art === 'marketing' ? 'marketing' : bezug.art === 'event' || bezug.art === 'event-welt' ? 'event' : bezug.art === 'stammdaten' ? 'crm-pflege' : 'vertrieb');
  for (const t of [text, ...frueher.slice(-2).reverse()]) {
    const treffer = ZOE_BEREICHE.map(b => ({ id: b.id, i: t.search(b.muster) })).filter(x => x.i >= 0).sort((a, b) => a.i - b.i);
    for (const x of treffer) if (!raus.includes(x.id)) raus.push(x.id);
  }
  return raus;
}

/** Die Werkzeuge dieses Zugs: Kern, dann die Bereiche reihum — höchstens `grenze` (20), nur Verfügbares, ohne Doppelte. */
export function zoeWerkzeugWahl(e: WahlEingabe): { namen: string[]; bereiche: string[] } {
  const grenze = Math.min(e.grenze ?? ZOE_GRENZE, ZOE_GRENZE);
  const namen: string[] = [];
  const nimm = (n: string) => { if (namen.length < grenze && e.verfuegbar.has(n) && !namen.includes(n)) namen.push(n); };
  for (const k of ZOE_KERN) nimm(k);
  const bereiche = bereicheFuer(e.text, e.frueher ?? [], e.bezug);
  const listen = bereiche.map(id => {
    const b = ZOE_BEREICHE.find(x => x.id === id)!;
    const vorne = id === 'vertrieb' && e.bezug ? BEZUG_WERKZEUG[e.bezug.art] : undefined;
    return [...(vorne ? [vorne] : []), ...b.werkzeuge].filter(n => e.verfuegbar.has(n) && !namen.includes(n));
  });
  // Reihum: jeder getroffene Bereich bekommt erst sein wichtigstes Werkzeug, dann das zweite … (so verdrängt kein Bereich die anderen).
  for (let i = 0; namen.length < grenze && listen.some(l => l.length > i); i++) for (const l of listen) if (l[i]) nimm(l[i]);
  return { namen, bereiche };
}

/** Alle Werkzeuge, die ZOE überhaupt direkt bekommen kann (Kern + alle Bereiche) — für den Wächter „über einen Head erreichbar“. */
export const ZOE_DIREKT: ReadonlySet<string> = new Set([...ZOE_KERN, ...ZOE_BEREICHE.flatMap(b => b.werkzeuge)]);
