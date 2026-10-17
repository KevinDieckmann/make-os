// ─── Fulfillment · Ausführung der Abläufe — Schritt → Aufgabe, Nachricht → Entwurf, Entscheidung fragt, Erinnerung von selbst (17.10. abends) ─────────
// Rückmeldung 17.10.: „Abläufe wirklich ausführen: jeder Schritt wird zur Aufgabe mit Verantwortlichem und Frist, Nachrichten als Entwurf auf Klick, Erinnerungen
// von selbst, Entscheidungen fragen nach — man sieht live, wo jeder Kunde hängt.“ EINE reine Stelle (client-sicher, deterministisch) für:
//   · Welche Knoten ausgeführt werden: Schritte des Flusses MIT gesetzter Form (Prozess-Editor/Import „pakete“) — nie abgeleitete Onboarding-Schritte, nie
//     Abstimmungspunkte. Ein Fall ohne solche Knoten (Altbestand, Muster) läuft genau wie bisher (`ablaufAktiv` = false → nichts entsteht).
//   · Wo der Fall gerade steht (`aktiveKnoten`): die erste Phase, die nicht fertig ist — eine fertige Phase mit offenem Abstimmungspunkt hält an (erst
//     bestätigt geht es weiter). In der Phase laufen die Schritte nacheinander; zwei oder mehr benannte Teilprozesse nebeneinander laufen parallel (wie der Fluss
//     sie zeichnet). An einer Entscheidung mit „nein“ läuft ihr Nein-Zweig (`aktiverNeinZweig`, lib/fulfillment/regeln.ts).
//   · Was nach einer Erledigung bzw. Antwort passiert (`nachErledigung`, `antwortAnwenden` — der Schreibweg des Falls ruft nur diese): Frist des nächsten
//     Schritts, Ja-/Nein-Zweig, Übersprungenes entfällt, die Schleife Erinnerung → wieder fragen (höchstens `versuche` Runden, danach „eskaliert“).
//   · Was die Ausführung jetzt braucht (`ausfuehrungSoll`): Fall-Änderungen (Fälligkeit ab Ankunft, „wartet auf Kunde“), Aufgaben (Kennung fest aus Fall +
//     Knoten + Runde), Nachrichten-Vorschläge, Glocken — jedes nur einmal (Marke im Fall). Gesendet wird nie etwas; der Server (ausfuehrung-server.ts) setzt um.
// Tests: tests/fulfillment-ablauf-rein.test.ts.

import type { Fall, FallKnoten, KnotenStatus } from '../typen';
import { aktiverNeinZweig, kinderVon, phaseFertig, teilbaum } from '../regeln';
import { neinZiele, phasenAbschnitte, phasenDer, phaseVonKnoten } from './fluss-struktur';
import { obSchluessel } from './onboarding';
import { fnv } from './pruefen';
import { titelOhneZusatz } from './darstellung';
import { tagPlus } from '@/lib/kalender/zeit';

/** Höchstzahl der Runden auf dem Nein-Pfad, wenn der Ablauf nichts sagt (Vorgabe aus der Rückmeldung: „5 Kontaktversuche“). */
export const VERSUCHE_VORGABE = 5;
/** Präfix der Aufgaben, die die Ausführung anlegt — die Kennung ist fest aus Fall + Knoten + Runde (idempotent). */
export const ABLAUF_AUFGABE_PRAEFIX = 'ff-ab-';
/** Werkzeug der Vorschläge „Nachricht bereit“ im Freigabe-Stapel (Präfix `p:nachricht:` — lib/fulfillment/prozesse/server.ts `PROZESSE_STAPEL`). */
export const ABLAUF_WERKZEUG_NACHRICHT = 'fulfillment_nachricht';

const FERTIG: ReadonlySet<KnotenStatus> = new Set(['erledigt', 'entfaellt']);
const fertig = (k: Pick<FallKnoten, 'status'>) => FERTIG.has(k.status);

/** Die Kennung der Aufgabe zu einem Knoten (Runde 0 = Schritt, ab 1 = Runde einer Erinnerung). */
export const ablaufAufgabeId = (mandatId: string, knotenId: string, runde = 0): string => `${ABLAUF_AUFGABE_PRAEFIX}${fnv(`${mandatId}|${knotenId}|${runde}`)}`;

export type AusfuehrungsArt = 'aufgabe' | 'nachricht' | 'entscheidung' | 'erinnerung';
/** Was die Ausführung mit einem Knoten tut — null: nichts (ohne Form, Abstimmungspunkt, abgeleiteter Onboarding-Schritt, Baustein). */
export function ausfuehrungsArt(k: Pick<FallKnoten, 'id' | 'form' | 'freigabe' | 'bausteinId'>): AusfuehrungsArt | null {
  if (!k.form || k.freigabe || obSchluessel(k.id) || k.form === 'abstimmung') return null;
  if (k.form === 'schritt' || k.form === 'termin') return 'aufgabe';
  return k.form;
}
/** Läuft in diesem Fall eine Ausführung? Nur, wenn mindestens ein Knoten eine ausführbare Form trägt — sonst bleibt alles wie bisher. */
export const ablaufAktiv = (f: Pick<Fall, 'knoten'>): boolean => f.knoten.some(k => ausfuehrungsArt(k) !== null);

/** Die Grenze der Runden an einer Entscheidung: `versuche` ihres Nein-Zweigs (bzw. ihr eigener), sonst die Vorgabe. */
export function versucheFuer(kn: readonly FallKnoten[], e: Pick<FallKnoten, 'zweige' | 'versuche'>): number {
  const r = e.zweige?.nein ? kn.find(x => x.id === e.zweige!.nein) : undefined;
  return r?.versuche ?? e.versuche ?? VERSUCHE_VORGABE;
}

/** Ist ein Schritt fertig — sein Status, oder alle Bausteine darunter sind fertig (dieselbe Regel wie die Zeile im Ablauf)? */
function schrittFertig(s: FallKnoten, kn: readonly FallKnoten[]): boolean {
  if (fertig(s)) return true;
  const b = kinderVon(s.id, kn);
  return b.length > 0 && b.every(fertig);
}
/** Der Tag, an dem ein Schritt fertig wurde (Erledigung, sonst Statuswechsel, sonst der späteste seiner Bausteine). */
function fertigTag(s: FallKnoten, kn: readonly FallKnoten[]): string | undefined {
  const eigen = s.erledigtAm ?? (fertig(s) ? s.seit : undefined);
  if (eigen) return eigen.slice(0, 10);
  return kinderVon(s.id, kn).map(b => b.erledigtAm ?? b.seit).filter((x): x is string => !!x).map(x => x.slice(0, 10)).sort().at(-1);
}

/**
 * Die Bahnen einer Phase: Blöcke nacheinander; ein Block hat eine Bahn (Schritte nacheinander) oder — bei zwei oder mehr benannten Teilprozessen
 * nebeneinander — je Teilprozess eine Bahn (parallel). Nein-Zweige stehen in keiner Bahn (sie laufen neben ihrer Entscheidung).
 */
export function phasenBloecke(kn: readonly FallKnoten[], phaseId: string, nz: ReadonlyMap<string, string> = neinZiele(kn)): FallKnoten[][][] {
  const ab = phasenAbschnitte(kn, phaseId);
  const parallel = ab.filter(a => a.art === 'gruppe').length >= 2;
  const raus: { parallel: boolean; bahnen: FallKnoten[][] }[] = [];
  for (const a of ab) {
    const bahn = a.schritte.filter(s => !nz.has(s.id));
    if (!bahn.length) continue;
    const letzter = raus.at(-1);
    if (parallel && a.art === 'gruppe') {
      if (letzter?.parallel) letzter.bahnen.push(bahn); else raus.push({ parallel: true, bahnen: [bahn] });
    } else if (letzter && !letzter.parallel) letzter.bahnen[0].push(...bahn);
    else raus.push({ parallel: false, bahnen: [bahn] });
  }
  return raus.map(b => b.bahnen);
}

const fallStart = (f: Pick<Fall, 'startAm' | 'gestartetAm'>): string => f.startAm ?? f.gestartetAm.slice(0, 10);

/** Die Phase, in der die Ausführung gerade arbeitet — null, wenn alles fertig ist oder ein Abstimmungspunkt am Ende einer fertigen Phase fehlt. */
export function ausfuehrungsPhase(f: Pick<Fall, 'knoten' | 'freigaben'>): FallKnoten | null {
  for (const p of phasenDer(f.knoten)) {
    if (p.status === 'entfaellt') continue;
    if (!phaseFertig(p, f.knoten)) return p;
    if (p.freigabe && !f.freigaben[p.freigabe]) return null;
  }
  return null;
}

/** Womit eine Phase begann: der Abstimmungspunkt der Phase davor, sonst der letzte erledigte Schritt darin, sonst der Start des Falls. */
function phasenStart(f: Pick<Fall, 'knoten' | 'freigaben' | 'startAm' | 'gestartetAm'>, phaseId: string): string {
  const phasen = phasenDer(f.knoten).filter(p => p.status !== 'entfaellt');
  const i = phasen.findIndex(p => p.id === phaseId);
  if (i <= 0) return fallStart(f);
  const v = phasen[i - 1];
  const fg = v.freigabe ? f.freigaben[v.freigabe] : undefined;
  if (fg) return fg.am.slice(0, 10);
  const nach = new Map(f.knoten.map(k => [k.id, k]));
  const tage = teilbaum(v.id, f.knoten).map(id => nach.get(id)!).filter(k => k && fertig(k)).map(k => (k.erledigtAm ?? k.seit)?.slice(0, 10)).filter((x): x is string => !!x).sort();
  return tage.at(-1) ?? fallStart(f);
}

export interface AktiverKnoten {
  knoten: FallKnoten; art: AusfuehrungsArt | null; phaseId: string;
  /** 0 = Schritt; Entscheidung: so oft kam bisher „nein“; Erinnerung: die laufende Runde (ab 1). */
  runde: number;
  /** Bei einer Erinnerung auf dem Nein-Pfad: ihre Entscheidung. */
  entscheidungId?: string;
  /** Der Tag, an dem der Fall hier ankam (Schritt davor erledigt bzw. Start der Phase bzw. Tag der Antwort „nein“). */
  ankunft?: string;
  /** Wirksame Fälligkeit: gespeichert, sonst Ankunft + Frist. */
  faellig?: string;
}

/**
 * Wo die Ausführung gerade steht — je laufender Bahn der Phase ein Knoten (meist genau einer). Ein Knoten ohne ausführbare Form (Altbestand, Abstimmung)
 * steht auch hier (`art: null`): er hält die Bahn an, bis ihn jemand von Hand abhakt. Abgeschlossene oder pausierte Fälle: keiner.
 */
export function aktiveKnoten(f: Pick<Fall, 'knoten' | 'freigaben' | 'status' | 'startAm' | 'gestartetAm'>): AktiverKnoten[] {
  if (f.status === 'abgeschlossen' || f.status === 'pausiert') return [];
  const p = ausfuehrungsPhase(f);
  if (!p) return [];
  const kn = f.knoten;
  const nz = neinZiele(kn);
  const raus: AktiverKnoten[] = [];
  let vorherEnde: string | undefined = phasenStart(f, p.id);
  for (const block of phasenBloecke(kn, p.id, nz)) {
    const start = vorherEnde;
    const imBlock: AktiverKnoten[] = [];
    const enden: string[] = [];
    for (const bahn of block) {
      const i = bahn.findIndex(s => !schrittFertig(s, kn));
      if (i < 0) { const t = fertigTag(bahn[bahn.length - 1], kn); if (t) enden.push(t); continue; }
      const s = bahn[i];
      const ankunft = i > 0 ? fertigTag(bahn[i - 1], kn) ?? start : start;
      const r = s.form === 'entscheidung' ? aktiverNeinZweig(kn, s) : null;
      if (r) {
        const runde = s.runden ?? 1;
        imBlock.push({ knoten: r, art: ausfuehrungsArt(r), phaseId: p.id, runde, entscheidungId: s.id, ...(s.antwortAm ? { ankunft: s.antwortAm } : {}), ...(r.faelligAm ? { faellig: r.faelligAm } : {}) });
        continue;
      }
      const art = ausfuehrungsArt(s);
      const faellig = s.faelligAm ?? (s.frist !== undefined && ankunft ? tagPlus(ankunft, s.frist) : undefined);
      imBlock.push({ knoten: s, art, phaseId: p.id, runde: art === 'erinnerung' ? 1 : art === 'entscheidung' ? s.runden ?? 0 : 0, ...(ankunft ? { ankunft } : {}), ...(faellig ? { faellig } : {}) });
    }
    if (imBlock.length) { raus.push(...imBlock); break; }
    vorherEnde = enden.sort().at(-1) ?? vorherEnde;
  }
  return raus;
}

// ── Nach einer Erledigung bzw. Antwort (der Schreibweg des Falls ruft nur diese) ─────────────────────────────────────────────────────

const entfallen = (k: FallKnoten, am: string, grund: string): FallKnoten => {
  const { erledigtAm: _a, erledigtVon: _b, ...r } = k;
  return { ...r, status: 'entfaellt', seit: am, grund };
};

/** Die Bahn eines Knotens in seiner Phase (und seine Stelle darin) — null, wenn er in keiner steht. */
function bahnVon(kn: readonly FallKnoten[], id: string): { bahn: FallKnoten[]; i: number } | null {
  const ph = phaseVonKnoten(kn, id);
  if (!ph) return null;
  for (const block of phasenBloecke(kn, ph)) for (const bahn of block) { const i = bahn.findIndex(s => s.id === id); if (i >= 0) return { bahn, i }; }
  return null;
}
/** Die Schritte der Phase in Lese-Reihenfolge ohne Nein-Zweige (für das Überspringen bei einem Ja-Zweig nach vorn). */
function hauptDerPhase(kn: readonly FallKnoten[], id: string): FallKnoten[] {
  const ph = phaseVonKnoten(kn, id);
  return ph ? phasenBloecke(kn, ph).flat(2) : [];
}

/**
 * Was nach der Erledigung eines Knotens passiert (rein) — `kn` enthält den Knoten schon als „erledigt“. Liefert die neue Liste:
 *   · Entscheidung („ja“): ihr offener Nein-Zweig entfällt; weiter am Ja-Zweig (fehlt: der nächste Schritt) — was dazwischen steht, entfällt.
 *   · Nein-Zweig, der zurück zur Entscheidung führt: die Runde zählt, die Erinnerung bleibt offen (nächste Runde), die Entscheidung fragt wieder (Frist ab
 *     heute); sind die Runden ausgeschöpft, ist sie „eskaliert“.
 *   · Nein-Zweig ohne Rückweg: die Entscheidung ist entschieden („nein“); weiter am Ja-Zweig der Erinnerung bzw. nach der Entscheidung.
 *   · sonst: der nächste Schritt der Bahn (bzw. der Ja-Zweig einer Erinnerung) bekommt seine Fälligkeit (Frist ab heute), Übersprungenes entfällt.
 * Ein Knoten in keiner Bahn: der nächste Geschwister-Knoten (wie bisher).
 */
export function nachErledigung(kn0: readonly FallKnoten[], id: string, am: string, person: string): FallKnoten[] {
  let kn = [...kn0];
  const hol = (x: string) => kn.find(k => k.id === x);
  const setze = (k: FallKnoten) => { kn = kn.map(x => (x.id === k.id ? k : x)); };
  const n = hol(id);
  if (!n || n.status !== 'erledigt') return kn;
  const nz = neinZiele(kn);
  const fristAb = (t: FallKnoten | undefined) => {
    const x = t ? hol(t.id) : undefined;
    if (x && x.frist !== undefined && !x.faelligAm && x.status === 'offen') setze({ ...x, faelligAm: tagPlus(am, x.frist) });
  };
  /** Weiter von `quelle` zu `ziel` (Ja-Zweig) bzw. zum nächsten der Bahn; was im Strang dazwischen steht, entfällt. */
  const weiter = (quelle: string, ziel?: string) => {
    if (ziel) {
      const haupt = hauptDerPhase(kn, quelle);
      const qi = haupt.findIndex(s => s.id === quelle), zi = haupt.findIndex(s => s.id === ziel);
      if (qi >= 0 && zi > qi) {
        for (const s of haupt.slice(qi + 1, zi)) { const x = hol(s.id)!; if (!fertig(x)) setze(entfallen(x, am, 'übersprungen (Zweig im Ablauf)')); }
        fristAb(haupt[zi]);
        return;
      }
    }
    const b = bahnVon(kn, quelle);
    if (b) { fristAb(b.bahn[b.i + 1]); return; }
    const q = hol(quelle)!;
    const g = kinderVon(q.elternId, kn).filter(x => !nz.has(x.id) && !x.bausteinId);
    fristAb(g[g.findIndex(x => x.id === quelle) + 1]);
  };

  // Entscheidung „ja“
  if (n.form === 'entscheidung' && !n.freigabe) {
    const r = n.zweige?.nein ? hol(n.zweige.nein) : undefined;
    if (r && !fertig(r)) setze(entfallen(r, am, 'Entscheidung: ja'));
    setze({ ...hol(id)!, antwort: 'ja', antwortAm: am });
    weiter(id, n.zweige?.ja);
    return kn;
  }
  // Nein-Zweig einer Entscheidung
  const eId = nz.get(id);
  const e = eId ? hol(eId) : undefined;
  if (e && n.form === 'erinnerung') {
    const runden = (n.runden ?? 0) + 1;
    if (n.zweige?.ja === e.id && !fertig(e)) {
      // Schleife: die Runde ist erledigt — die Erinnerung bleibt für die nächste Runde, die Entscheidung fragt wieder.
      const { erledigtAm: _a, erledigtVon: _b, faelligAm: _f, ...r } = n;
      setze({ ...r, status: 'offen', seit: am, runden });
      const { antwort: _x, faelligAm: _y, ...er } = e;
      const neuE: FallKnoten = { ...er, ...(e.frist !== undefined ? { faelligAm: tagPlus(am, e.frist) } : {}) };
      if (runden >= versucheFuer(kn, e) && !e.eskaliertAm) neuE.eskaliertAm = am;
      setze(neuE);
      return kn;
    }
    setze({ ...n, runden });
    if (!fertig(e)) { const { grund: _g, ...er } = e; setze({ ...er, status: 'erledigt', seit: am, erledigtAm: am, erledigtVon: person, antwort: 'nein', antwortAm: e.antwortAm ?? am }); }
    weiter(e.id, n.zweige?.ja);
    return kn;
  }
  weiter(id, n.form === 'erinnerung' ? n.zweige?.ja : undefined);
  return kn;
}

/**
 * Die Antwort auf eine Entscheidung (rein): „ja“ = erledigt (→ `nachErledigung`); „nein“ = ihr Nein-Zweig läuft (Erinnerung fällig nach ihrer Frist), ohne
 * Nein-Zweig fragt sie nach ihrer Frist (mindestens einem Tag) noch einmal. Mehr Runden als erlaubt → keine neue Runde, sie ist „eskaliert“.
 * Wirft nie — eine unpassende Antwort liefert `fehler` (der Schreibweg lehnt dann ab).
 */
export function antwortAnwenden(kn0: readonly FallKnoten[], id: string, antwort: 'ja' | 'nein', am: string, person: string): { knoten: FallKnoten[] } | { fehler: string; status: 400 | 404 | 409 } {
  const e = kn0.find(k => k.id === id);
  if (!e) return { fehler: 'Diesen Schritt gibt es im Fall nicht (mehr).', status: 404 };
  if (e.form !== 'entscheidung' || e.freigabe) return { fehler: 'Mit ja oder nein antwortet man nur auf eine Entscheidung.', status: 400 };
  if (fertig(e)) return { fehler: 'Diese Entscheidung ist schon entschieden — bei Bedarf erst wieder öffnen.', status: 409 };
  if (antwort === 'ja') {
    const { grund: _g, ...r } = e;
    const kn = kn0.map(k => (k.id === id ? { ...r, status: 'erledigt' as const, seit: am, erledigtAm: am, erledigtVon: person } : k));
    return { knoten: nachErledigung(kn, id, am, person) };
  }
  const runden = (e.runden ?? 0) + 1;
  const grenze = versucheFuer(kn0, e);
  const r = e.zweige?.nein ? kn0.find(k => k.id === e.zweige!.nein) : undefined;
  if (runden > grenze) {
    // Ausgeschöpft: keine neue Runde — die Entscheidung bleibt offen und hängt rot, bis jemand entscheidet.
    return { knoten: kn0.map(k => (k.id === id ? { ...k, antwortAm: am, eskaliertAm: k.eskaliertAm ?? am } : k)) };
  }
  if (r && !fertig(r)) {
    const { faelligAm: _f, ...er } = e;
    return { knoten: kn0.map(k => {
      if (k.id === id) return { ...er, antwort: 'nein' as const, antwortAm: am, runden };
      if (k.id === r.id) return { ...k, seit: am, faelligAm: tagPlus(am, r.frist ?? 0) };
      return k;
    }) };
  }
  // Ohne Nein-Zweig: noch einmal fragen.
  const { antwort: _a, ...er } = e;
  return { knoten: kn0.map(k => (k.id === id ? { ...er, antwortAm: am, runden, faelligAm: tagPlus(am, Math.max(1, e.frist ?? 1)) } : k)) };
}

// ── Was die Ausführung jetzt braucht ────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Marken im Fall — jede Wirkung entsteht genau einmal. */
export const ABLAUF_MARKE = {
  aufgabe: (k: string, r: number) => `ablauf-aufgabe:${k}:${r}`,
  nachricht: (k: string, r: number) => `ablauf-nachricht:${k}:${r}`,
  frage: (k: string, r: number) => `ablauf-frage:${k}:${r}`,
  eskaliert: (k: string) => `ablauf-eskaliert:${k}`,
} as const;
/** Kennung des Vorschlags im Stapel für eine Nachricht (Präfix `p:` = Prozesse). */
export const nachrichtBezugId = (mandatId: string, knotenId: string, runde: number) => `p:nachricht:${mandatId}:${knotenId}:${runde}`;

export interface SollAufgabe { id: string; knotenId: string; runde: number; titel: string; faellig?: string; kunde: boolean; art: 'schritt' | 'termin' | 'erinnerung'; versuche?: number; marke: string }
export interface SollNachricht { bezugId: string; knotenId: string; runde: number; titel: string; marke: string }
export interface SollGlocke { art: 'frage' | 'eskaliert'; knotenId: string; titel: string; marke: string }
export interface AusfuehrungSoll {
  /** Fall-Änderungen (Ops des Fall-Schreibwegs): Fälligkeit ab Ankunft, „wartet auf Kunde“ an Schritten, die der Kunde macht. */
  ops: Record<string, unknown>[];
  aufgaben: SollAufgabe[]; nachrichten: SollNachricht[]; glocken: SollGlocke[];
  /** Aufgaben, die zu schließen sind, weil ihr Schritt bzw. ihre Runde fertig ist (nur, wenn sie noch offen sind). */
  abschluss: { id: string; status: 'done' | 'cancelled' }[];
}

/**
 * Was die Ausführung für einen (wirksamen) Fall jetzt braucht. Nur für Fälle mit Ausführung (`ablaufAktiv`); was schon eine Marke hat, fehlt.
 *   · Schritt/Termin, der dran ist → eine Aufgabe (fällig: wirksame Fälligkeit); macht ihn der Kunde → zusätzlich „wartet auf Kunde“.
 *   · Nachricht, die dran ist → ein Vorschlag (Entwurf auf Klick, gesendet wird nur dort).
 *   · Entscheidung, deren Frist vorbei ist → eine Glocke je Runde; ausgeschöpft → eine Glocke „eskaliert“.
 *   · Erinnerung, deren Frist erreicht ist → eine Aufgabe je Runde (mit Nachricht, wenn ein Mail-Baustein dranhängt — `mitMail`).
 */
export function ausfuehrungSoll(f: Pick<Fall, 'mandatId' | 'knoten' | 'freigaben' | 'status' | 'startAm' | 'gestartetAm' | 'marken'>, heute: string, mitMail: (k: FallKnoten) => boolean = () => false): AusfuehrungSoll {
  const soll: AusfuehrungSoll = { ops: [], aufgaben: [], nachrichten: [], glocken: [], abschluss: ablaufAbschluesse(f) };
  if (!ablaufAktiv(f)) return soll;
  const neu = (m: string) => !f.marken[m];
  for (const a of aktiveKnoten(f)) {
    const k = a.knoten;
    const titel = titelOhneZusatz(k.titel);
    const op: Record<string, unknown> = {};
    if (!k.faelligAm && a.faellig && a.art !== 'erinnerung') op.faelligAm = a.faellig;
    const kunde = k.zustaendig === 'kunde';
    if (kunde && k.status === 'offen' && (a.art === 'aufgabe' || a.art === 'entscheidung')) { op.status = 'wartet_kunde'; op.am = a.ankunft && a.ankunft <= heute ? a.ankunft : heute; }
    if (Object.keys(op).length) soll.ops.push({ op: 'knoten-status', id: k.id, ...op });
    if (a.art === 'aufgabe') {
      const marke = ABLAUF_MARKE.aufgabe(k.id, 0);
      if (neu(marke)) soll.aufgaben.push({ id: ablaufAufgabeId(f.mandatId, k.id, 0), knotenId: k.id, runde: 0, titel: kunde ? `Beim Kunden: ${titel}` : titel, ...(a.faellig ? { faellig: a.faellig } : {}), kunde, art: k.form === 'termin' ? 'termin' : 'schritt', marke });
    } else if (a.art === 'nachricht') {
      const marke = ABLAUF_MARKE.nachricht(k.id, 0);
      if (neu(marke)) soll.nachrichten.push({ bezugId: nachrichtBezugId(f.mandatId, k.id, 0), knotenId: k.id, runde: 0, titel, marke });
    } else if (a.art === 'entscheidung') {
      if (k.eskaliertAm) { const m = ABLAUF_MARKE.eskaliert(k.id); if (neu(m)) soll.glocken.push({ art: 'eskaliert', knotenId: k.id, titel, marke: m }); }
      else if (a.faellig && a.faellig < heute) { const m = ABLAUF_MARKE.frage(k.id, a.runde); if (neu(m)) soll.glocken.push({ art: 'frage', knotenId: k.id, titel, marke: m }); }
    } else if (a.art === 'erinnerung' && a.faellig && a.faellig <= heute) {
      const marke = ABLAUF_MARKE.aufgabe(k.id, a.runde);
      const e = a.entscheidungId ? f.knoten.find(x => x.id === a.entscheidungId) : undefined;
      const versuche = e ? versucheFuer(f.knoten, e) : undefined;
      if (neu(marke)) soll.aufgaben.push({ id: ablaufAufgabeId(f.mandatId, k.id, a.runde), knotenId: k.id, runde: a.runde, titel: versuche && versuche > 1 ? `${titel} (Versuch ${a.runde} von ${versuche})` : titel, faellig: a.faellig, kunde: false, art: 'erinnerung', ...(versuche ? { versuche } : {}), marke });
      const nm = ABLAUF_MARKE.nachricht(k.id, a.runde);
      if (mitMail(k) && neu(nm)) soll.nachrichten.push({ bezugId: nachrichtBezugId(f.mandatId, k.id, a.runde), knotenId: k.id, runde: a.runde, titel, marke: nm });
    }
  }
  return soll;
}

/**
 * Die Aufgaben der Ausführung, deren Schritt bzw. Runde fertig ist — Aufgabe des Schritts: erledigt → „erledigt“, entfällt → „abgebrochen“; Erinnerung
 * auf dem Nein-Pfad: jede erledigte Runde → „erledigt“, die laufende Runde einer schon entschiedenen Entscheidung → „abgebrochen“. Der Server schließt nur
 * offene Aufgaben (idempotent).
 */
export function ablaufAbschluesse(f: Pick<Fall, 'mandatId' | 'knoten'>): { id: string; status: 'done' | 'cancelled' }[] {
  const raus: { id: string; status: 'done' | 'cancelled' }[] = [];
  const kn = f.knoten;
  const nz = neinZiele(kn);
  for (const k of kn) {
    const art = ausfuehrungsArt(k);
    // Nachrichten haben keine Aufgabe (ihr Entwurf liegt im Stapel), Entscheidungen auch nicht (sie fragen über die Glocke).
    if (!art || art === 'entscheidung' || art === 'nachricht') continue;
    const eId = nz.get(k.id);
    const e = eId ? kn.find(x => x.id === eId) : undefined;
    if (art === 'erinnerung' && e) {
      const erledigt = k.runden ?? 0;
      for (let r = 1; r <= erledigt; r++) raus.push({ id: ablaufAufgabeId(f.mandatId, k.id, r), status: 'done' });
      const laufend = e.runden ?? 0;
      if (laufend > erledigt && (fertig(k) || fertig(e) || e.antwort !== 'nein')) raus.push({ id: ablaufAufgabeId(f.mandatId, k.id, laufend), status: k.status === 'erledigt' ? 'done' : 'cancelled' });
      continue;
    }
    const runde = art === 'erinnerung' ? 1 : 0;
    if (schrittFertig(k, kn)) raus.push({ id: ablaufAufgabeId(f.mandatId, k.id, runde), status: k.status === 'entfaellt' ? 'cancelled' : 'done' });
  }
  return raus;
}

/**
 * Zu welchem Knoten (und welcher Runde) gehört eine Aufgabe der Ausführung? Rechnet die festen Kennungen nach — null, wenn sie zu keinem Knoten dieses Falls
 * gehört.
 */
export function aufgabeZuKnoten(f: Pick<Fall, 'mandatId' | 'knoten'>, aufgabeId: string): { knotenId: string; runde: number } | null {
  if (!aufgabeId.startsWith(ABLAUF_AUFGABE_PRAEFIX)) return null;
  for (const k of f.knoten) {
    const art = ausfuehrungsArt(k);
    if (art === 'aufgabe' && ablaufAufgabeId(f.mandatId, k.id, 0) === aufgabeId) return { knotenId: k.id, runde: 0 };
    if (art === 'erinnerung') {
      const bis = Math.max(VERSUCHE_VORGABE, k.versuche ?? 0, k.runden ?? 0) + 2;
      for (let r = 1; r <= bis; r++) if (ablaufAufgabeId(f.mandatId, k.id, r) === aufgabeId) return { knotenId: k.id, runde: r };
    }
  }
  return null;
}

/**
 * Eine Aufgabe der Ausführung wurde erledigt — was im Fall daraus folgt (rein): die Op „erledigt“ für ihren Knoten, wenn er gerade dran ist (eine Erinnerung
 * nur in ihrer laufenden Runde). Sonst null (schon erledigt, Runde vorbei — nichts doppelt).
 */
export function opNachAufgabe(f: Pick<Fall, 'knoten' | 'freigaben' | 'status' | 'startAm' | 'gestartetAm'>, knotenId: string, runde: number): Record<string, unknown> | null {
  const k = f.knoten.find(x => x.id === knotenId);
  if (!k || fertig(k)) return null;
  if (ausfuehrungsArt(k) === 'erinnerung' && runde > 0) {
    const a = aktiveKnoten(f).find(x => x.knoten.id === knotenId);
    if (!a || a.runde !== runde) return null;
  }
  return { op: 'knoten-status', id: k.id, status: 'erledigt' };
}

// ── Für die Anzeige: Stand je Knoten ────────────────────────────────────────────────────────────────────────────────────────────────

export interface AblaufKnotenStand {
  art: AusfuehrungsArt; aktiv: boolean; runde: number; versuche?: number; faellig?: string; ueberfaellig: boolean;
  eskaliert?: string; antwort?: 'ja' | 'nein';
  /** Entscheidung: ihr Nein-Zweig (Kennung) und ob er gerade läuft. Erinnerung: ihre Entscheidung. */
  nein?: string; neinLaeuft?: boolean; entscheidung?: string;
  /** Kennung der Aufgabe zur laufenden Runde (bzw. zum Schritt) — ob es sie gibt, sagt der Server. */
  aufgabe?: string;
}
/** Der Stand der Ausführung je Knoten (für Fall-Detail und Route). Ohne Ausführung: `aktiv: false`, keine Knoten. */
export function ablaufStand(f: Pick<Fall, 'mandatId' | 'knoten' | 'freigaben' | 'status' | 'startAm' | 'gestartetAm'>, heute: string): { aktiv: boolean; knoten: Record<string, AblaufKnotenStand> } {
  if (!ablaufAktiv(f)) return { aktiv: false, knoten: {} };
  const kn = f.knoten;
  const nz = neinZiele(kn);
  const laufend = new Map(aktiveKnoten(f).map(a => [a.knoten.id, a]));
  const raus: Record<string, AblaufKnotenStand> = {};
  for (const k of kn) {
    const art = ausfuehrungsArt(k);
    if (!art) continue;
    const a = laufend.get(k.id);
    const faellig = a?.faellig ?? (fertig(k) ? undefined : k.faelligAm);
    const eId = nz.get(k.id);
    const e = eId ? kn.find(x => x.id === eId) : undefined;
    const runde = a?.runde ?? (art === 'entscheidung' ? k.runden ?? 0 : art === 'erinnerung' ? (e ? (e.runden ?? 0) : 1) : 0);
    const nein = art === 'entscheidung' && k.zweige?.nein ? k.zweige.nein : undefined;
    raus[k.id] = {
      art, aktiv: !!a, runde, ueberfaellig: !!a && !!faellig && faellig < heute,
      ...(faellig ? { faellig } : {}), ...(k.eskaliertAm ? { eskaliert: k.eskaliertAm } : {}), ...(k.antwort ? { antwort: k.antwort } : {}),
      ...(art === 'entscheidung' || e ? { versuche: versucheFuer(kn, e ?? k) } : {}),
      ...(nein ? { nein, neinLaeuft: laufend.has(nein) } : {}), ...(e ? { entscheidung: e.id } : {}),
      ...(art === 'aufgabe' ? { aufgabe: ablaufAufgabeId(f.mandatId, k.id, 0) } : art === 'erinnerung' && runde > 0 ? { aufgabe: ablaufAufgabeId(f.mandatId, k.id, runde) } : {}),
    };
  }
  return { aktiv: true, knoten: raus };
}

// ── Nachricht: Entwurf aus dem Mail-Baustein ───────────────────────────────────────────────────────────────────────────────────────

export interface NachrichtWerte {
  anrede: 'Du' | 'Sie'; vorname?: string; nachname?: string; kunde?: string; termin?: string; absender?: string;
}
/** Die Grußzeile — dieselbe Regel wie die Willkommensmail: „Hallo Vorname“ bzw. „Guten Tag Vorname Nachname“. */
export function grussZeile(w: Pick<NachrichtWerte, 'anrede' | 'vorname' | 'nachname'>): string {
  const name = [w.vorname, w.nachname].filter(Boolean).join(' ').trim();
  return w.anrede === 'Du' ? (w.vorname ? `Hallo ${w.vorname}` : 'Hallo') : name ? `Guten Tag ${name}` : 'Guten Tag';
}
/**
 * Eine Mail aus einem Mail-Baustein (rein): Betreff aus der ersten Zeile „Betreff: …“ (sonst `betreffVorgabe`), Platzhalter gefüllt — {{anrede}} (Grußzeile),
 * {{vorname}}, {{nachname}}, {{ansprechpartner}}, {{kunde}}/{{firma}}, {{termin}} (ohne Termin: „(Termin folgt)“), {{absender}}. Unbekannte Platzhalter bleiben
 * stehen, damit man sie sieht. Ohne Text: nur Grußzeile und Gruß.
 */
export function nachrichtEntwurf(vorlage: string | undefined, w: NachrichtWerte, betreffVorgabe: string): { betreff: string; text: string } {
  const gruss = grussZeile(w);
  const ap = [w.vorname, w.nachname].filter(Boolean).join(' ').trim();
  if (!vorlage?.trim()) {
    return { betreff: betreffVorgabe.slice(0, 200), text: [`${gruss},`, '', '', '', w.anrede === 'Du' ? 'Viele Grüße' : 'Freundliche Grüße', ...(w.absender ? [w.absender] : [])].join('\n') };
  }
  const zeilen = vorlage.replace(/\r\n/g, '\n').split('\n');
  let betreff = betreffVorgabe;
  if (/^betreff:/i.test(zeilen[0] ?? '')) { betreff = zeilen.shift()!.replace(/^betreff:\s*/i, '').trim() || betreff; while (zeilen[0] === '') zeilen.shift(); }
  const ersetze = (t: string) => t
    .replace(/\{\{\s*anrede\s*\}\}/g, gruss).replace(/\{\{\s*vorname\s*\}\}/g, w.vorname ?? '').replace(/\{\{\s*nachname\s*\}\}/g, w.nachname ?? '')
    .replace(/\{\{\s*ansprechpartner\s*\}\}/g, ap).replace(/\{\{\s*(kunde|firma)\s*\}\}/g, w.kunde ?? '')
    .replace(/\{\{\s*termin\s*\}\}/g, w.termin ?? '(Termin folgt)').replace(/\{\{\s*absender\s*\}\}/g, w.absender ?? '');
  return { betreff: ersetze(betreff).slice(0, 200), text: ersetze(zeilen.join('\n')).replace(/\n{3,}/g, '\n\n').trim() };
}
