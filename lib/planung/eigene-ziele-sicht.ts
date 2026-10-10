// ─── MAKE OS — Eigene Ziele nur geteilt lesbar (08.10., Kevin, Phase 0) — rein ──────────────────────────────────────────
// Kevin 08.10.: Persönliche Ziele (`ziele-eigen--<person>`, samt Fokus-Sätzen) darf eine andere Person des Haushalts NUR lesen,
// wenn die Eigentümerin sie ausdrücklich teilt. Einstellung je Person am Konto (`teilt.ziele`: Speichernamen, wem sie ihre eigenen
// Ziele zeigt — wie `teilt.gesundheit`), Vorgabe „nicht geteilt“ (Feld fehlt = niemand), schalten nur sie selbst
// (`PUT /api/konto/teilen`). Nicht geteilt ⇒ NICHTS davon kommt an: kein Titel, keine Kennung, kein „Belegt“, keine Meilensteine,
// die noch auf ein solches Ziel zeigen (Altbestand; seit 07.10. kann kein neuer Meilenstein auf ein eigenes Ziel zeigen).
// Geteilt ⇒ lesen (GET /api/state/ziele?fuer=<person>), nie schreiben. Die Sammel-Ansichten (Lichtfäden, Fluss, Brain-Kugel, Seil)
// bleiben dabei so streng wie vorher (fremde eigene Ziele dort höchstens als „Belegt“).
// EINE Regel für alle Leser — hier (rein) und in eigene-ziele-sicht-server.ts (Konten laden). Neue Leser fremder eigener Ziele
// gehen IMMER darüber (`zieleFuerBetrachter` / `verborgeneZielIds` / `meilensteineFuerBetrachter`).
// Gegenprüfung 08.10.: JEDER Leser des Bestands `meilensteine`, der an eine Person (oder als Systemlauf an alle) ausliefert, filtert über
// `meilensteineSichtbarFuer`/`verborgeneMeilensteineFuer` (Server) — Detail-Route, Kalender-Fristen/Glocke/Heute, ZOE-Kontext und
// -Werkzeuge, Business-Index (nur ohne Titel), Kapazität (ganz ohne den Posten), Verbindungsprüfung, Gesundheit, Schilde, Loops; die
// Aufgaben-Liste `lm-…` trägt für sie nur `LISTE_NICHT_GETEILT`. Ohne Person (Systemlauf) gilt: kein Meilenstein an einem eigenen Ziel.

// Seit 09.10. (Kevin: „im privaten Bereich … einen Bereich, wo wir zusammen unsere Ziele eintragen können — und jeder für sich. Das ist
// unfassbar wichtig“) zusätzlich JE ZIEL: ein eigenes Ziel mit `geteilt: true` sehen die anderen VOLLEN Mitglieder des Haushalts (nicht
// ein Konto „nur Business“) — und nur dieses Ziel, nur lesend. Dazu je Fokus-Satz `fokusGeteilt` (Schlüssel, die die Person teilt).
// Drei Stufen je Paar (`eigeneZieleSicht`): alles (eigene bzw. ganz geteilt über `teilt.ziele`) · geteilte (einzeln) · nichts. Die
// Route GET /api/state/ziele?fuer=<person> liefert bei „geteilte“ NUR `nurGeteilte(datei)` — ein ungeteiltes Ziel kommt nie an (auch kein
// Titel, keine Kennung, kein Zähler). Die Sammel-Ansichten (Lichtfäden, Seil, Brain-Kugel, Fluss) bleiben bewusst bei der strengen Regel
// oben (`lesbareEigentuemer`/`verborgeneZielIds`: nur ganz geteilt) — einzeln Geteiltes steht nur in den Ziele-Spalten der Planung und auf Heute.

/** Gemeinsamer Bestand (`ziele`) — gehört allen im Haushalt (wie `BEIDE` in lib/lichtfaeden/modell.ts). */
export const GEMEINSAM = 'beide';

/** Was die Regel vom Konto braucht. `finanzRecht: 'business'` = Konto „nur Business“ (sieht nie Privates, auch nichts einzeln Geteiltes). */
export interface KontoZieleTeilen { speicher: string; haushalt?: string; finanzRecht?: string; teilt?: { ziele?: readonly string[] } }

/**
 * Darf `betrachter` die eigenen Ziele von `eigentuemer` lesen? Die eigenen immer; fremde nur, wenn die Eigentümerin sie mit genau
 * dieser Person teilt UND beide im selben Haushalt sind. Ohne Person (Systemlauf) nie.
 */
export function eigeneZieleLesbar(konten: readonly KontoZieleTeilen[], eigentuemer: string, betrachter: string | null | undefined): boolean {
  if (!betrachter) return false;
  if (eigentuemer === betrachter) return true;
  const e = konten.find(k => k.speicher === eigentuemer), b = konten.find(k => k.speicher === betrachter);
  if (!e || !b || !e.haushalt || e.haushalt !== b.haushalt) return false;
  return Array.isArray(e.teilt?.ziele) && e.teilt!.ziele!.includes(betrachter);
}

/** Wessen eigene Ziele `betrachter` lesen darf (immer inklusive der eigenen). Ohne Person: niemand. */
export function lesbareEigentuemer(konten: readonly KontoZieleTeilen[], betrachter: string | null | undefined): Set<string> {
  if (!betrachter) return new Set();
  return new Set([betrachter, ...konten.filter(k => eigeneZieleLesbar(konten, k.speicher, betrachter)).map(k => k.speicher)]);
}

/** Ein Ziel mit Herkunft: `person` = GEMEINSAM (Bestand `ziele`) oder der Speichername der Eigentümerin. */
interface MitPerson { person: string }

/** Nur die Ziele, die der Betrachter lesen darf: gemeinsame + eigene + geteilte. */
export function zieleFuerBetrachter<T extends MitPerson>(ziele: readonly T[], lesbar: ReadonlySet<string>): T[] {
  return ziele.filter(z => z.person === GEMEINSAM || lesbar.has(z.person));
}

/** Kennungen aller Ziele, die der Betrachter NICHT lesen darf (eigene Ziele anderer, nicht geteilt — alle Horizonte). */
export function verborgeneZielIds(ziele: readonly (MitPerson & { id: string })[], lesbar: ReadonlySet<string>): Set<string> {
  return new Set(ziele.filter(z => z.person !== GEMEINSAM && !lesbar.has(z.person)).map(z => z.id));
}

/** Das Ziel eines Meilensteins (wie lib/planung/meilenstein-aufgaben.ts `zielVonMeilenstein`, hier ohne Abhängigkeit). */
const zielVon = (m: { zielId?: string; abgeleitetVon?: string }): string | undefined => m.zielId || m.abgeleitetVon || undefined;

/** Ist der Meilenstein an ein verborgenes Ziel gebunden (Altbestand: Meilenstein eines fremden eigenen Ziels)? */
export const meilensteinVerborgen = (m: { zielId?: string; abgeleitetVon?: string }, verborgen: ReadonlySet<string>): boolean => {
  const z = zielVon(m);
  return !!z && verborgen.has(z);
};

/** Meilensteine ohne die, die an einem verborgenen Ziel hängen. */
export function meilensteineFuerBetrachter<M extends { zielId?: string; abgeleitetVon?: string }>(ms: readonly M[], verborgen: ReadonlySet<string>): M[] {
  return verborgen.size ? ms.filter(m => !meilensteinVerborgen(m, verborgen)) : [...ms];
}

/** Kennungen der Meilensteine, die an einem verborgenen Ziel hängen (Altbestand). */
export function verborgeneMeilensteinIds(ms: readonly { id: string; zielId?: string; abgeleitetVon?: string }[], verborgen: ReadonlySet<string>): Set<string> {
  return verborgen.size ? new Set(ms.filter(m => meilensteinVerborgen(m, verborgen)).map(m => m.id)) : new Set();
}

/**
 * Neutraler Name der Aufgaben-Liste eines verborgenen Meilensteins (Gegenprüfung 08.10.): die Liste `lm-…` im geteilten Aufgaben-Bestand
 * trägt sonst den Titel des Meilensteins. Die Aufgaben darin bleiben (sie haben ihre eigene Sichtbarkeit „nur ich“) — nur der Name nicht.
 */
export const LISTE_NICHT_GETEILT = 'Meilenstein-Liste';

/** Der Aufgaben-Stand mit neutralem Namen für die Listen verborgener Meilensteine. Rein; ohne Treffer derselbe Stand. */
export function listenFuerBetrachter<S extends { listen?: { id: string; titel: string }[] }>(state: S, verborgeneListen: ReadonlySet<string>): S {
  if (!verborgeneListen.size || !state.listen?.some(l => verborgeneListen.has(l.id))) return state;
  return { ...state, listen: state.listen.map(l => (verborgeneListen.has(l.id) ? { ...l, titel: LISTE_NICHT_GETEILT } : l)) } as S;
}

// ── Einzeln geteilt (09.10.) ──────────────────────────────────────────────────────────────────────────────────────────────

/** Wie viel `betrachter` aus dem eigenen Bestand von `eigentuemer` sieht. */
export type EigeneZieleSicht = 'alles' | 'geteilte' | 'nichts';

/** Volles Mitglied: Haushalt am Konto eingetragen, nicht „nur Business“. */
const vollesMitglied = (k: KontoZieleTeilen | undefined): k is KontoZieleTeilen & { haushalt: string } => !!k && !!k.haushalt && k.finanzRecht !== 'business';

/**
 * Alles: die eigenen bzw. ganz geteilt (`eigeneZieleLesbar`). Geteilte: beide volle Mitglieder desselben Haushalts — dann nur, was die
 * Eigentümerin einzeln geteilt hat. Sonst (Systemlauf, fremder Haushalt, Konto „nur Business“, Person ohne Konto): nichts.
 */
export function eigeneZieleSicht(konten: readonly KontoZieleTeilen[], eigentuemer: string, betrachter: string | null | undefined): EigeneZieleSicht {
  if (!betrachter) return 'nichts';
  if (eigeneZieleLesbar(konten, eigentuemer, betrachter)) return 'alles';
  const e = konten.find(k => k.speicher === eigentuemer), b = konten.find(k => k.speicher === betrachter);
  return vollesMitglied(e) && vollesMitglied(b) && e.haushalt === b.haushalt ? 'geteilte' : 'nichts';
}

/** Die Partner einer Person: die anderen vollen Mitglieder ihres Haushalts (für die Spalten „<Name>“). Ohne Haushalt/„nur Business“: niemand. */
export function partnerVon(konten: readonly KontoZieleTeilen[], person: string | null | undefined): string[] {
  const ich = konten.find(k => k.speicher === person);
  if (!vollesMitglied(ich)) return [];
  return konten.filter(k => k.speicher !== ich.speicher && vollesMitglied(k) && k.haushalt === ich.haushalt).map(k => k.speicher);
}

/** Die Form eines eigenen Bestands, wie die Regel sie braucht (alle Horizonte + Fokus + geteilte Fokus-Schlüssel). */
export interface EigeneDatei { tag?: unknown; woche?: unknown; monat?: unknown; quartal?: unknown; jahr?: unknown; fokus?: Record<string, string>; fokusGeteilt?: unknown }
const HORIZONTE = ['tag', 'woche', 'monat', 'quartal', 'jahr'] as const;

/** Die einzeln geteilten Fokus-Schlüssel (nur Texte, ohne Doppel). */
export function fokusGeteiltListe(d: Pick<EigeneDatei, 'fokusGeteilt'> | null | undefined): string[] {
  const l = d?.fokusGeteilt;
  return Array.isArray(l) ? [...new Set(l.filter((x): x is string => typeof x === 'string' && !!x))] : [];
}

/**
 * NUR das einzeln Geteilte (rein, Server): je Horizont die Ziele mit `geteilt === true`, der Fokus nur unter den geteilten Schlüsseln,
 * `fokusGeteilt` selbst geht nicht mit (die Liste verrät, was es gibt). Alles andere Feld der Datei fällt weg.
 */
export function nurGeteilte<D extends EigeneDatei>(d: D | null | undefined): D {
  const aus: Record<string, unknown> = {};
  for (const h of HORIZONTE) aus[h] = (Array.isArray(d?.[h]) ? (d![h] as { geteilt?: unknown }[]) : []).filter(z => z && z.geteilt === true);
  const teile = new Set(fokusGeteiltListe(d));
  aus.fokus = Object.fromEntries(Object.entries(d?.fokus ?? {}).filter(([k, v]) => teile.has(k) && typeof v === 'string'));
  return aus as D;
}

/** Hat die Datei überhaupt etwas einzeln Geteiltes (ein Ziel oder einen nicht leeren Fokus-Satz)? */
export function hatGeteiltes(d: EigeneDatei | null | undefined): boolean {
  const g = nurGeteilte(d);
  return HORIZONTE.some(h => (g[h] as unknown[]).length > 0) || Object.values(g.fokus ?? {}).some(v => !!v.trim());
}
