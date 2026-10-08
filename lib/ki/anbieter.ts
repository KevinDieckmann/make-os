// ─── KI-Anbieter: Katalog, Datenschutzstufen, Routing, Auswahl (09.10.2026, Paket 6a „Anbieter-Tor“) — rein ──────────────
// Kevin 08.10. spät (ENTSCHEIDUNGEN_FRAGEBOGEN.md › Agenten-Bereich Teil 1, Antworten 19–25): „keine Vermittler-Plattform · Google
// über Vertex mit Dienstkonto · eigene Verträge je Kunde · EIN Anbieter-Tor, Rückfall nie in schwächeren Datenschutz“ · „Vertex EU
// für Gesundheit, Privat-Finanzen, Familie · Gesundheit an die KI nur EU mit ZDR“. Grundlage: research/agenten/MODELLE.md (Teil 3/4).
//
// Diese Datei ist DATEN + reine Regeln, ohne Umgebung und ohne Netz (Server UND Browser):
//   · `DatenschutzStufe` mit fester Rangfolge (lokal > eu-zdr > eu > dpf > scc > keine) — R3 der Recherche
//   · `KI_ANBIETER` — je Zugang Name, Empfänger im Register, erlaubte Hosts, Namen der Umgebungsvariablen (nie Werte), Stufe, Region,
//     Fähigkeiten, Kennzeichnung der Ausgabe, erlaubte Datenkategorien
//   · `MINDESTSTUFE` je KI-Kategorie (Gesundheit → eu-zdr; Familie, Privat-Finanzen → eu)
//   · `ROUTEN` je Fähigkeit (erste Wahl zuerst) und `anbieterWaehlen` — die EINE Auswahlregel
// Wer einen neuen Anbieter anschließt: Eintrag hier + Empfänger in EMPFAENGER_START (lib/datenschutz/einrichtung.ts) + Adapter in
// lib/ki/adapter/ + Preise in lib/ki/modelle.ts (Wächter tests/ki-anbieter.test.ts). Keine Personennamen, keine festen Firmen.
// Hinweis, keine Rechtsberatung — Stufen und Garantien einmal anwaltlich gegenlesen.

import type { KiKategorie } from '@/lib/datenschutz/ki-einstellungen';

/** Datenschutzstufe eines Zugangs — je höher, desto strenger. */
export type DatenschutzStufe = 'keine' | 'scc' | 'dpf' | 'eu' | 'eu-zdr' | 'lokal';
/** Aufsteigend: Index = Rang. */
export const STUFEN_REIHE: readonly DatenschutzStufe[] = ['keine', 'scc', 'dpf', 'eu', 'eu-zdr', 'lokal'];
export const STUFE_TEXT: Record<DatenschutzStufe, string> = {
  keine: 'ohne Garantie',
  scc: 'Drittland mit Standardvertragsklauseln',
  dpf: 'Drittland mit Data Privacy Framework',
  eu: 'Verarbeitung in der EU',
  'eu-zdr': 'Verarbeitung in der EU ohne Speicherung beim Anbieter (Zero Data Retention)',
  lokal: 'nur auf dem eigenen Server',
};
export const stufeRang = (s: DatenschutzStufe): number => STUFEN_REIHE.indexOf(s);
/** Erfüllt `s` mindestens `min`? */
export const mindestens = (s: DatenschutzStufe, min: DatenschutzStufe): boolean => stufeRang(s) >= stufeRang(min);

/** Was ein Anbieter-Aufruf tut. Text = Claude (askText); der Rest sind die neuen Medien-/Recherche-Wege. */
export type Faehigkeit = 'text' | 'tiefenbericht' | 'bild' | 'video' | 'transkript';
export const FAEHIGKEITEN: readonly Faehigkeit[] = ['text', 'tiefenbericht', 'bild', 'video', 'transkript'];
export const FAEHIGKEIT_TEXT: Record<Faehigkeit, string> = {
  text: 'Text (ZOE, Heads, Entwürfe)', tiefenbericht: 'Tiefenbericht zum Lesen', bild: 'Bilder', video: 'Video', transkript: 'Transkription',
};

export type AnbieterId = 'anthropic' | 'anthropic-vertex-eu' | 'google-vertex' | 'mistral';
export type Kennzeichnung = 'synthid' | 'c2pa';

export interface KiAnbieter {
  id: AnbieterId;
  /** Anzeigename (Oberfläche, Kennzeichnung, Auskunft). */
  name: string;
  /** Eintrag im Empfänger-Register (EMPFAENGER_START) — Pflicht; das Tor prüft dort Archiv und AVV. */
  empfaengerId: string;
  /** Anfragen dieses Zugangs gehen NUR an diese Hosts (Wächter im Adapter, `hostErlaubt`). */
  hosts: readonly RegExp[];
  /** Namen der Umgebungsvariablen (nie Werte) — gesetzt nur über deploy/ki-anbieter-verbinden.sh. */
  umgebung: readonly string[];
  /** Stufe ohne Zusatz; mit bestätigter Zero Data Retention (`zdrUmgebung` = „bestaetigt“) gilt `stufeMitZdr`. */
  stufe: DatenschutzStufe;
  stufeMitZdr?: DatenschutzStufe;
  zdrUmgebung?: string;
  /** Wo verarbeitet wird (Anzeige, Protokoll). */
  region: string;
  faehigkeiten: readonly Faehigkeit[];
  /** Was der Anbieter in erzeugte Medien einbettet — nie entfernen (KI-VO Art. 50 Abs. 2). */
  kennzeichnung: readonly Kennzeichnung[];
  /** Datenkategorien, die an diesen Zugang dürfen ('alle' = jede, die Mindeststufe entscheidet). */
  kategorien: readonly KiKategorie[] | 'alle';
  /** true = schon vor dem Anbieter-Tor in Gebrauch (Anthropic direkt) — nur im Modus „streng“ muss der AVV bestätigt sein. */
  bestand?: boolean;
  /** Beleg der Angaben (Recherche, Quelle). */
  quelle: string;
}

/**
 * Der Katalog. Stand 08.10.2026, research/agenten/MODELLE.md (Teil 2.1, 2.3, 2.4, 2.5, 4.3) — Quellen dort (A1–A10, G5–G7, I4, V3, M3).
 * Der Markt dreht sich monatlich: Modell-IDs und Preise stehen in lib/ki/modelle.ts mit Stand und Quelle, nie verstreut im Code.
 */
export const KI_ANBIETER: readonly KiAnbieter[] = [
  {
    id: 'anthropic', name: 'Anthropic (Claude, direkt)', empfaengerId: 'anthropic',
    hosts: [/^api\.anthropic\.com$/], umgebung: ['ANTHROPIC_API_KEY'],
    // Die Anthropic-API verarbeitet nur `global`/`us`; Anthropic steht NICHT auf der DPF-Liste (abgefragt 08.10.) → SCC (DPA mit SCC Modul 2/3).
    stufe: 'scc', region: 'USA/global', faehigkeiten: ['text'], kennzeichnung: [], kategorien: 'alle', bestand: true,
    quelle: 'MODELLE.md 2.1 (A3–A7, DPF-Liste 08.10.)',
  },
  {
    id: 'anthropic-vertex-eu', name: 'Claude über Google Vertex (EU)', empfaengerId: 'google-vertex',
    // Multi-Region „eu“ bzw. eine Region „europe-…“ (lib/ki/konfig.ts prüft, dass es eine EU-Region ist).
    hosts: [/^aiplatform\.eu\.rep\.googleapis\.com$/, /^europe-[a-z0-9]+-aiplatform\.googleapis\.com$/, /^oauth2\.googleapis\.com$/],
    umgebung: ['GOOGLE_VERTEX_PROJEKT', 'GOOGLE_VERTEX_DIENSTKONTO', 'GOOGLE_VERTEX_CLAUDE_REGION', 'GOOGLE_VERTEX_ZDR'],
    stufe: 'eu', stufeMitZdr: 'eu-zdr', zdrUmgebung: 'GOOGLE_VERTEX_ZDR', region: 'EU (Google Vertex, Region eu)',
    faehigkeiten: ['text'], kennzeichnung: [], kategorien: 'alle',
    quelle: 'MODELLE.md 2.1/2.7 (A9, G5, G6, W29); Vertex kennt Structured Outputs, Effort, Caching, nur die einfache Web-Suche, kein Web-Fetch, keine Batches',
  },
  {
    id: 'google-vertex', name: 'Google Vertex (Gemini: Bilder, Video, Tiefenbericht)', empfaengerId: 'google-vertex',
    hosts: [/^aiplatform\.googleapis\.com$/, /^us-central1-aiplatform\.googleapis\.com$/, /^oauth2\.googleapis\.com$/],
    umgebung: ['GOOGLE_VERTEX_PROJEKT', 'GOOGLE_VERTEX_DIENSTKONTO'],
    // Medienmodelle laufen `global` bzw. `us-central1` (Veo) — Google LLC ist DPF-zertifiziert (abgefragt 08.10.).
    stufe: 'dpf', region: 'global / us-central1 (Google)', faehigkeiten: ['bild', 'video', 'tiefenbericht'], kennzeichnung: ['synthid', 'c2pa'],
    // Nur Aufträge ohne Personenbezug: Motiv, Marke, Thema. Fotos realer Personen als Eingabe gibt es in Version 1 nicht.
    kategorien: ['allgemein', 'web'],
    quelle: 'MODELLE.md 2.2–2.4 (I1–I5, V1–V4, R5); Google-Bedingungen für Grounding/Deep Research beachten (lib/ki/tiefenbericht.ts)',
  },
  {
    id: 'mistral', name: 'Mistral (Voxtral, EU)', empfaengerId: 'mistral',
    hosts: [/^api\.eu\.mistral\.ai$/], umgebung: ['MISTRAL_API_KEY', 'MISTRAL_ZDR'],
    stufe: 'eu', stufeMitZdr: 'eu-zdr', zdrUmgebung: 'MISTRAL_ZDR', region: 'EU (Mistral, Paris)',
    faehigkeiten: ['transkript'], kennzeichnung: [], kategorien: 'alle',
    quelle: 'MODELLE.md 2.1/2.5 (M3, M6, M8, S1–S3); Training-Opt-out im Admin-Panel ist Pflicht vor dem ersten Aufruf',
  },
];

export const anbieterVon = (id: AnbieterId): KiAnbieter => {
  const a = KI_ANBIETER.find(x => x.id === id);
  if (!a) throw new Error(`[ki] unbekannter Anbieter: ${id}`);
  return a;
};
export const istAnbieterId = (x: unknown): x is AnbieterId => typeof x === 'string' && KI_ANBIETER.some(a => a.id === x);

/** Darf eine Anfrage dieses Zugangs an `host`? (Adapter rufen das vor jedem fetch.) */
export function hostErlaubt(id: AnbieterId, url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  return anbieterVon(id).hosts.some(h => h.test(u.hostname));
}

/** Mindeststufe je Kategorie (Kevin 08.10.): Gesundheit nur EU mit ZDR; Familie und Privat-Finanzen in der EU. */
export const MINDESTSTUFE: Partial<Record<KiKategorie, DatenschutzStufe>> = {
  gesundheit: 'eu-zdr',
  familie: 'eu',
  'finanzen-privat': 'eu',
};
/** Die strengste Mindeststufe der Kategorien eines Aufrufs (ohne besondere Kategorie: keine). */
export function mindestStufeFuer(kategorien: readonly KiKategorie[]): DatenschutzStufe {
  let min: DatenschutzStufe = 'keine';
  for (const k of kategorien) { const s = MINDESTSTUFE[k]; if (s && stufeRang(s) > stufeRang(min)) min = s; }
  return min;
}

/** Erste Wahl zuerst. Text: Claude direkt, für strengere Kategorien Claude über Vertex EU (die Auswahl filtert nach Mindeststufe). */
export const ROUTEN: Record<Faehigkeit, readonly AnbieterId[]> = {
  text: ['anthropic', 'anthropic-vertex-eu'],
  tiefenbericht: ['google-vertex'],
  bild: ['google-vertex'],
  video: ['google-vertex'],
  transkript: ['mistral'],
};

/** Zustand eines Zugangs in DIESER Instanz (aus lib/ki/konfig.ts + Register) — nur ja/nein, nie Werte. */
export interface AnbieterZustand {
  eingerichtet: boolean;
  zdr: boolean;
  /** Eintrag im Empfänger-Register: fehlt, archiviert (nicht in Gebrauch) oder AVV bestätigt? */
  register: 'fehlt' | 'archiviert' | 'avv-offen' | 'bestaetigt';
}
export const wirksameStufe = (a: KiAnbieter, z: Pick<AnbieterZustand, 'zdr'>): DatenschutzStufe => (z.zdr && a.stufeMitZdr ? a.stufeMitZdr : a.stufe);

export type AuswahlGrund =
  | 'anbieter-stufe' // keine Route erreicht die Mindeststufe der Kategorien
  | 'kategorie-nicht-erlaubt' // die Kategorie darf an keinen Zugang dieser Fähigkeit
  | 'anbieter-nicht-eingerichtet'
  | 'avv-offen' // Empfänger archiviert, fehlt oder AVV nicht bestätigt
  | 'anbieter-ausgefallen';

export type Auswahl =
  | { ok: true; anbieter: AnbieterId; stufe: DatenschutzStufe; mindestStufe: DatenschutzStufe; rueckfall: boolean }
  | { ok: false; grund: AuswahlGrund; mindestStufe: DatenschutzStufe };

/**
 * DIE Auswahlregel (rein): Routen der Fähigkeit in Reihenfolge; ein Zugang kommt nur in Frage, wenn er
 *   1. die Mindeststufe aller Kategorien erreicht (sonst lieber gesperrt als umgeleitet — nie Rückfall in die USA),
 *   2. alle Kategorien annimmt,
 *   3. NICHT schwächer ist als die erste Wahl, die die Mindeststufe erreicht (Rückfall nie in eine schwächere Stufe, Kevin 08.10.),
 *   4. eingerichtet ist und nicht gerade ausgefallen,
 *   5. im Register steht, nicht archiviert ist und — für neue Anbieter immer, für den Bestand (Anthropic direkt) im Modus „streng“ —
 *      einen bestätigten AVV hat.
 */
export function anbieterWaehlen(e: {
  faehigkeit: Faehigkeit;
  kategorien: readonly KiKategorie[];
  zustand: Partial<Record<AnbieterId, AnbieterZustand>>;
  streng?: boolean;
  /** Abweichende Reihenfolge der Instanz (z. B. alles über Vertex EU) — nur Zugänge, die die Fähigkeit können. */
  route?: readonly AnbieterId[];
  /** In diesem Lauf schon gescheitert — nimmt die nächste erlaubte Wahl (nie schwächer). */
  ausgefallen?: readonly AnbieterId[];
}): Auswahl {
  const min = mindestStufeFuer(e.kategorien);
  const route = (e.route?.length ? e.route : ROUTEN[e.faehigkeit]).filter(id => istAnbieterId(id) && anbieterVon(id).faehigkeiten.includes(e.faehigkeit));
  const stufeVon = (id: AnbieterId) => wirksameStufe(anbieterVon(id), { zdr: !!e.zustand[id]?.zdr });
  const stark = route.filter(id => mindestens(stufeVon(id), min));
  if (!stark.length) return { ok: false, grund: 'anbieter-stufe', mindestStufe: min };
  const passend = stark.filter(id => { const k = anbieterVon(id).kategorien; return k === 'alle' || e.kategorien.every(x => k.includes(x)); });
  if (!passend.length) return { ok: false, grund: 'kategorie-nicht-erlaubt', mindestStufe: min };
  const boden = stufeVon(passend[0]);
  let grund: AuswahlGrund = 'anbieter-nicht-eingerichtet';
  for (const [i, id] of passend.entries()) {
    if (!mindestens(stufeVon(id), boden)) continue; // Rückfall nie schwächer als die erste Wahl
    const z = e.zustand[id];
    if (!z?.eingerichtet) continue;
    if (e.ausgefallen?.includes(id)) { grund = 'anbieter-ausgefallen'; continue; }
    const avvPflicht = !anbieterVon(id).bestand || !!e.streng;
    if (z.register === 'fehlt' || z.register === 'archiviert' || (avvPflicht && z.register !== 'bestaetigt')) { grund = 'avv-offen'; continue; }
    return { ok: true, anbieter: id, stufe: stufeVon(id), mindestStufe: min, rueckfall: i > 0 };
  }
  return { ok: false, grund, mindestStufe: min };
}
