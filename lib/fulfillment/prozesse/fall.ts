// ─── Fulfillment · Prozesse — der Fall: Start (Kopie), Änderungen, Vorlagen-Diff (C1, 10.10.; FULFILLMENT_KONZEPT.md 7.2–7.5) ────────
// Ein Fall ist die Ausführung EINER Paket-Vorlage an EINEM Mandat. Beim Start kopiert er die STRUKTUR der Vorlage (Knoten mit Titel, Ziel,
// Ergebnis, Kennzahl, Zuständig, Freigabe, Sichtbarkeit, Phase, Baustein, Rang) und merkt sich Kennung + Fassung — so ändert sich der Plan,
// den der Kunde sieht, nie still, wenn jemand die Vorlage für künftige Kunden verbessert. Lange Texte (Gliederung, Skript, Fragen) liest der
// Fall LIVE aus der Bibliothek über `bausteinId`. Neue Fassung der Vorlage → `vorlagenDiff` zeigt neue/geänderte/entfernte Knoten,
// „Übernehmen“ fügt hinzu und ändert — erledigte oder entfallene Knoten werden nie entfernt.
// Onboarding: unter dem Teilprozess „Onboarding“ (Ebene 3; fehlt er, legt der Start ihn an — als `fk-obt` unter einer Phase „Onboarding“
// bzw. unter der neuen Phase `fk-ob`) stehen die acht Schritte als Einzelschritte (Ebene 4) `fk-ob-*` (`extra`, zählen im Fortschritt mit); ihr
// Stand wird abgeleitet (lib/fulfillment/prozesse/onboarding.ts) — nie von Hand „erledigt“. Unter „Kunden-Playbook“ hängt (Ebene 5) das
// Playbook-Formular der Bibliothek (`fk-obf-playbook`, `bausteinId`) — das füllt der Kunde über seinen Link bzw. wir gemeinsam im Kick-off
// (Paket C2 liest Formulare NUR aus Knoten mit `bausteinId`; zusammengeführt 11.10.).
// Alle Änderungen über `fallAnwenden(fall, ops, kontext)` (rein, alles oder nichts); geschrieben wird in lib/fulfillment/prozesse/fall-server.ts.

import type { AnwendenErgebnis, Fall, FallKnoten, FallZusatz, Freigabepunkt, KnotenStatus, ProzessKnoten, ProzessVorlage, Stakeholder, Entscheidung, Mitschrift, WertKontoEintrag, Vereinbarung } from '../typen';
import { GRENZEN } from '../grenzen';
import { ebeneVon, inReihenfolge, kinderVon, teilbaum, wurzelVon, zusatzJeKnoten, EBENEN_MAX } from '../regeln';
import { MUSTER_BEFAEHIGUNG, MUSTER_ONBOARDING } from '../muster';
import { OB_PRAEFIX, obKnotenId, obSchluessel } from './onboarding';
import { ausfuehren, istObj, mischen, nein, optBool, optTag, optText, optWahl, optZahl, pflichtText, standPruefen, titelForm } from './pruefen';
import { tagPlus } from '@/lib/kalender/zeit';
import { tagVon } from '@/lib/zeit';
import { phasenDer, phasenSchritte } from './fluss-struktur';
import { antwortAnwenden, nachErledigung } from './ausfuehrung';

/** Felder, die beim Start aus der Vorlage kopiert werden (7.2). */
export const STRUKTUR_FELDER = ['elternId', 'titel', 'rang', 'ziel', 'ergebnis', 'kennzahl', 'zustaendig', 'freigabe', 'kundeSichtbar', 'phaseId', 'bausteinId', 'dauerTage', 'form', 'frist', 'zweige', 'versuche'] as const;
/** Felder, die ein Diff vergleicht (ohne Rang — die Reihenfolge darf der Fall behalten). */
const DIFF_FELDER = STRUKTUR_FELDER.filter(f => f !== 'rang');

/** Der Starttag eines Falls: der gewählte (`startAm`), sonst der Tag des Anlegens. EINE Stelle für Anzeige, Quick-Win-Frist und Kennzahl. */
export const fallStartTag = (f: Pick<Fall, 'startAm' | 'gestartetAm'>): string => f.startAm ?? f.gestartetAm.slice(0, 10);

const kopie = (k: ProzessKnoten): FallKnoten => {
  const x: Record<string, unknown> = { id: k.id, status: 'offen' };
  for (const f of STRUKTUR_FELDER) if (k[f] !== undefined) x[f] = k[f];
  return x as unknown as FallKnoten;
};

export interface StartEingabe {
  mandatId: string; vorlage: ProzessVorlage; person: string; jetzt: string;
  /** Starttag (YYYY-MM-DD) — Fälligkeiten der Phasen zählen ab hier (`dauerTage` hintereinander). */
  start: string;
  /** Bis wann die Willkommensmail raus sein soll (Unterschrift + 24 h, Tag) — Fälligkeit des ersten Schritts. */
  willkommenBis?: string;
  /** Kennung des Kunden-Playbooks in der Bibliothek (`playbookBaustein`) — hängt als Formular unter dem Schritt „Kunden-Playbook“. */
  playbookId?: string;
  neueId: (p: string) => string;
}
/** Teilprozess, den der Start anlegt, wenn die Vorlage keinen „Onboarding“-Knoten auf Ebene 3 hat (die Schritte stehen immer auf Ebene 4). */
export const OB_TEIL_ID = 'fk-obt';
/** Der Formular-Knoten (Ebene 5) unter „Kunden-Playbook“. */
export const OB_PLAYBOOK_FORMULAR_ID = 'fk-obf-playbook';

/** Den Fall anlegen: Struktur-Kopie + Onboarding-Schritte + Befähigungs-Kriterien (Vorgabe, je Fall änderbar). */
export function fallStarten(e: StartEingabe): Fall {
  const v = e.vorlage;
  let knoten = inReihenfolge(v.knoten).map(kopie);
  // Fälligkeiten der Phasen (Ebene 2) hintereinander ab Start.
  let tag = e.start;
  for (const p of kinderVon(knoten.find(k => !k.elternId)?.id, knoten)) {
    if (!p.dauerTage) continue;
    tag = tagPlus(tag, p.dauerTage);
    knoten = knoten.map(k => (k.id === p.id ? { ...k, faelligAm: tag } : k));
  }
  // Frist (Prozess-Editor, 17.10.): der erste Schritt des Ablaufs (vor den Onboarding-Schritten) ist ab dem Start fällig; die übrigen ab dem Schritt davor
  // (`fallAnwenden`, knoten-status).
  const ersterSchritt = phasenDer(knoten).flatMap(p => phasenSchritte(knoten, p.id))[0];
  if (ersterSchritt?.frist !== undefined && !ersterSchritt.faelligAm) knoten = knoten.map(k => (k.id === ersterSchritt.id ? { ...k, faelligAm: tagPlus(e.start, ersterSchritt.frist!) } : k));
  // Ein Zusatzmodul (17.10. spät) startet ohne Onboarding: keine vorangestellte Phase, keine acht Schritte — der Fall läuft sofort.
  if (v.zusatz) {
    return {
      mandatId: e.mandatId, vorlageId: v.id, vorlageFassung: v.fassung, gestartetAm: e.jetzt, gestartetVon: e.person, status: 'laeuft',
      ...(e.start && e.start !== tagVon(e.jetzt) ? { startAm: e.start } : {}),
      knoten, freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {},
      befaehigung: MUSTER_BEFAEHIGUNG.map((text, i) => ({ id: `bf-${i + 1}`, text, erfuellt: false })),
      marken: {}, geaendert: e.jetzt, geaendertVon: e.person, ohneOnboarding: true,
      ...(v.phasenVonHand ? { phasenVonHand: true as const } : {}),
    };
  }
  // Onboarding: ein Knoten (Ebene 2 oder 3), der „Onboarding“ heißt — bevorzugt einer ohne eigene Schritte (bei „Vorlauf / Onboarding“ mit dem
  // Unterschritt „Onboarding“ also der Unterschritt) —, sonst eine neue Phase ganz vorn. Die acht Schritte kommen hinter vorhandene.
  const wurzel = knoten.find(k => !k.elternId);
  const passend = knoten.filter(k => { const eb = ebeneVon(k, knoten); return (eb === 2 || eb === 3) && titelForm(k.titel).split(' ').includes('onboarding'); });
  let container = passend.find(k => kinderVon(k.id, knoten).length === 0) ?? passend[0];
  if (!container && wurzel) {
    container = { id: 'fk-ob', elternId: wurzel.id, titel: 'Onboarding', rang: 0, status: 'offen', extra: true, kundeSichtbar: true };
    knoten = [...knoten, container].map(k => (k.elternId === wurzel.id ? { ...k, rang: k.id === 'fk-ob' ? 1 : k.rang + 1 } : k));
  }
  // Die Schritte stehen auf Ebene 4 (Einzelschritt) — liegt der Container auf Ebene 2, kommt ein Teilprozess dazwischen. Nur so kann das
  // Playbook-Formular (ein Baustein, Ebene 5) unter „Kunden-Playbook“ hängen.
  if (container && ebeneVon(container, knoten) === 2 && !knoten.some(k => k.id.startsWith(OB_PRAEFIX) && k.elternId)) {
    const teil: FallKnoten = { id: OB_TEIL_ID, elternId: container.id, titel: 'Onboarding-Schritte', rang: kinderVon(container.id, knoten).length + 1, status: 'offen', extra: true, kundeSichtbar: true };
    knoten = [...knoten, teil];
    container = teil;
  }
  if (container && ebeneVon(container, knoten) < EBENEN_MAX - 1 && !knoten.some(k => k.id.startsWith(OB_PRAEFIX) && k.elternId)) {
    const c = container;
    const vorhanden = kinderVon(c.id, knoten).length;
    MUSTER_ONBOARDING.forEach((s, i) => {
      knoten.push({
        id: obKnotenId(s.schluessel), elternId: c.id, titel: s.titel, rang: vorhanden + i + 1, status: 'offen', extra: true, zustaendig: s.zustaendig,
        ...(s.freigabe ? { freigabe: s.freigabe } : {}), ...(s.schluessel === 'willkommen' && e.willkommenBis ? { faelligAm: e.willkommenBis } : {}),
        ...(s.schluessel === 'playbook' ? { kundeSichtbar: true } : {}),
      });
    });
    const pb = knoten.find(k => k.id === obKnotenId('playbook'));
    if (e.playbookId && pb && ebeneVon(pb, knoten) === EBENEN_MAX - 1) {
      // Nicht „für Kunden sichtbar“ als Schritt — der Kunde sieht das Formular selbst (C2), im Zeitstrahl steht der Schritt „Kunden-Playbook“.
      knoten.push({ id: OB_PLAYBOOK_FORMULAR_ID, elternId: pb.id, titel: 'Kunden-Playbook (Formular)', rang: 1, status: 'offen', extra: true, bausteinId: e.playbookId });
    }
  }
  return {
    mandatId: e.mandatId, vorlageId: v.id, vorlageFassung: v.fassung, gestartetAm: e.jetzt, gestartetVon: e.person, status: 'onboarding',
    ...(e.start && e.start !== tagVon(e.jetzt) ? { startAm: e.start } : {}),
    knoten, freigaben: {}, onboarding: {}, stakeholder: [], entscheidungen: [], rituale: [], mitschriften: [], quickWins: [], kickoffFragen: [], wertKonto: {},
    befaehigung: MUSTER_BEFAEHIGUNG.map((text, i) => ({ id: `bf-${i + 1}`, text, erfuellt: false })),
    marken: {}, geaendert: e.jetzt, geaendertVon: e.person,
    // Phasen der Vorlage von Hand geordnet (12.10.) → der Fall behält diese Reihenfolge (sonst ordnet der Säuberer nach ./phasen.ts).
    ...(v.phasenVonHand ? { phasenVonHand: true as const } : {}),
  };
}

// ── Vorlagen-Diff (7.2) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface VorlagenDiff {
  von: number; nach: number; neu: { id: string; titel: string }[]; geaendert: { id: string; titel: string; felder: string[] }[]; entfernt: { id: string; titel: string }[];
  /** Eltern-Knoten (Phasen, Teilprozesse, Wurzel), deren Schritte in der Vorlage anders geordnet sind (Prozess-Editor, 17.10.). */
  reihenfolge: { id: string; titel: string }[];
}

/** Die Felder eines Diffs in Worten (Vorschau „was sich ändert“ im Fall). */
export const DIFF_FELD_NAME: Readonly<Record<string, string>> = {
  elternId: 'Platz', titel: 'Titel', ziel: 'Ziel', ergebnis: 'Ergebnis', kennzahl: 'Kennzahl', zustaendig: 'Verantwortung', freigabe: 'Abstimmungspunkt',
  kundeSichtbar: 'Sichtbarkeit', phaseId: 'Phase', bausteinId: 'Baustein', dauerTage: 'Dauer', form: 'Form', frist: 'Frist', zweige: 'Zweige', versuche: 'Versuche',
};

/** Die Vorschau „was sich ändert“ eines Diffs in Worten — Abschnitte mit Zeilen (leere fallen weg). Eine Stelle für Fall-Hinweis und Tests. */
export function diffVorschau(d: VorlagenDiff): { titel: string; zeilen: string[] }[] {
  return [
    { titel: 'Neu', zeilen: d.neu.map(x => x.titel) },
    { titel: 'Geändert', zeilen: d.geaendert.map(x => `${x.titel} (${x.felder.map(f => DIFF_FELD_NAME[f] ?? f).join(', ')})`) },
    { titel: 'Neue Reihenfolge', zeilen: (d.reihenfolge ?? []).map(x => x.titel) },
    { titel: 'In der Vorlage entfernt — bleiben im Fall', zeilen: d.entfernt.map(x => x.titel) },
  ].filter(a => a.zeilen.length);
}

/** Die Kinder eines Knotens, die in Vorlage UND Fall darunter stehen — in der Reihenfolge der Vorlage bzw. des Falls. */
function gemeinsameKinder(id: string, fallKn: readonly FallKnoten[], v: ProzessVorlage): { soll: string[]; ist: string[] } {
  const imFall = new Set(kinderVon(id, fallKn).map(k => k.id));
  const soll = kinderVon(id, v.knoten).map(k => k.id).filter(x => imFall.has(x));
  const inSoll = new Set(soll);
  return { soll, ist: kinderVon(id, fallKn).map(k => k.id).filter(x => inSoll.has(x)) };
}

/** Was sich an der Vorlage seit dem Start (bzw. der letzten Übernahme) geändert hat — null, wenn nichts. */
export function vorlagenDiff(fall: Pick<Fall, 'knoten' | 'vorlageFassung'>, v: ProzessVorlage): VorlagenDiff | null {
  if (v.fassung <= fall.vorlageFassung) return null;
  const imFall = new Map(fall.knoten.map(k => [k.id, k]));
  const inVorlage = new Set(v.knoten.map(k => k.id));
  const neu = inReihenfolge(v.knoten).filter(k => !imFall.has(k.id)).map(k => ({ id: k.id, titel: k.titel }));
  const geaendert = v.knoten.filter(k => imFall.has(k.id)).map(k => {
    const f = imFall.get(k.id)!;
    const felder = DIFF_FELDER.filter(x => JSON.stringify(k[x] ?? null) !== JSON.stringify((f as unknown as Record<string, unknown>)[x] ?? null));
    return { id: k.id, titel: k.titel, felder };
  }).filter(x => x.felder.length);
  // Knoten eines angehängten Zusatzmoduls gehören nicht zu dieser Vorlage (17.10. spät) — sie sind nie „in der Vorlage entfernt“.
  const zusatz = zusatzJeKnoten(fall.knoten);
  const entfernt = fall.knoten.filter(k => !k.extra && !inVorlage.has(k.id) && (!zusatz.has(k.id) || zusatz.get(k.id) === v.id)).map(k => ({ id: k.id, titel: k.titel }));
  const reihenfolge = inReihenfolge(v.knoten).filter(k => imFall.has(k.id)).filter(k => {
    const { soll, ist } = gemeinsameKinder(k.id, fall.knoten, v);
    return soll.length > 1 && soll.join('|') !== ist.join('|');
  }).map(k => ({ id: k.id, titel: k.titel }));
  return { von: fall.vorlageFassung, nach: v.fassung, neu, geaendert, entfernt, reihenfolge };
}

/**
 * Die Reihenfolge der Vorlage in den Fall übernehmen: je Eltern-Knoten stehen die Kinder aus der Vorlage in ihrer Reihenfolge; eigene Zusatz-Schritte des
 * Falls (und Kinder, die der Fall woanders behält) bleiben hinter dem Knoten, hinter dem sie standen. Ränge danach lückenlos. Nichts fällt weg.
 */
function reihenfolgeUebernehmen(kn: FallKnoten[], v: ProzessVorlage): FallKnoten[] {
  let liste = kn;
  for (const p of inReihenfolge(kn)) {
    const kinder = kinderVon(p.id, liste);
    if (kinder.length < 2) continue;
    const ids = new Set(kinder.map(c => c.id));
    const reihe = kinderVon(p.id, v.knoten).map(c => c.id).filter(x => ids.has(x));
    if (!reihe.length) continue;
    for (const [i, c] of kinder.entries()) {
      if (reihe.includes(c.id)) continue;
      const davor = kinder.slice(0, i).reverse().find(x => reihe.includes(x.id));
      reihe.splice(davor ? reihe.indexOf(davor.id) + 1 : 0, 0, c.id);
    }
    const rang = new Map(reihe.map((x, i) => [x, i + 1]));
    if (kinder.every(c => c.rang === rang.get(c.id))) continue;
    liste = liste.map(x => (rang.has(x.id) ? { ...x, rang: rang.get(x.id)! } : x));
  }
  return liste;
}

/**
 * Knoten einer (Vorlagen-)Struktur in den Fall übernehmen — die EINE Übernahme-Mechanik für „neue Fassung übernehmen“ und das Anhängen eines Zusatzmoduls:
 * neue Knoten dazu (nur unter vorhandenen Eltern), Felder geänderter Knoten übernehmen, nichts entfernen. Eigene Felder des Falls (Status, Fälligkeit, Antwort,
 * `zusatz` …) bleiben. Rein.
 */
function knotenUebernehmen(fallKn: readonly FallKnoten[], quelle: readonly ProzessKnoten[]): FallKnoten[] {
  let knoten = [...fallKn];
  for (const k of inReihenfolge(quelle)) {
    const da = knoten.find(x => x.id === k.id);
    if (!da) {
      if (k.elternId && !knoten.some(x => x.id === k.elternId)) continue;
      knoten.push(kopie(k));
      continue;
    }
    const neu: Record<string, unknown> = { ...da };
    for (const f of DIFF_FELDER) {
      if (f === 'elternId' && (!k.elternId || !knoten.some(x => x.id === k.elternId) || teilbaum(da.id, knoten).includes(k.elternId))) continue;
      if (k[f] === undefined) delete neu[f]; else neu[f] = k[f];
    }
    knoten = knoten.map(x => (x.id === da.id ? neu as unknown as FallKnoten : x));
  }
  return knoten;
}

/** Die neue Fassung übernehmen: neue Knoten dazu (nur unter vorhandenen Eltern), Felder geänderter Knoten übernehmen, nichts entfernen. */
export function vorlageUebernehmen(fall: Fall, v: ProzessVorlage, jetzt: string, person: string): Fall {
  let knoten = knotenUebernehmen(fall.knoten, v.knoten);
  if (knoten.some(k => ebeneVon(k, knoten) > EBENEN_MAX)) knoten = fall.knoten; // nie eine kaputte Struktur übernehmen
  else knoten = abschnitteOrdnen(reihenfolgeUebernehmen(knoten, v), fall.zusaetze);
  // Hat die Vorlage ihre Phasen von Hand geordnet (Editor), behält der Fall diese Reihenfolge (sonst ordnete der Säuberer nach der Regel).
  return { ...fall, knoten, vorlageFassung: v.fassung, geaendert: jetzt, geaendertVon: person, ...(v.phasenVonHand ? { phasenVonHand: true as const } : {}) };
}

// ── Zusatzmodule (17.10. spät; Rückmeldung: „Das Fulfillment soll maximal einfach für uns sein.“) ────────────────────────────────────────
// Ein Paket mit `zusatz: true` (z. B. Telefonie) bekommt an einem Mandat mit laufendem Fall KEINEN zweiten Fall und keine zweite Onboarding-Phase: seine Phasen
// hängen als eigener Abschnitt hinter denen des Pakets (`FallKnoten.zusatz` an den Phasen, `Fall.zusaetze`), über dieselbe Übernahme-Mechanik wie eine neue
// Fassung (`knotenUebernehmen` — nichts wird entfernt). Die Ausführung läuft dort parallel ab dem Starttag des Abschnitts (./ausfuehrung.ts), die Reise markiert
// ihn (`ReisePhase.modul`). Neue Fassungen des Zusatzmoduls übernimmt der Fall wie beim Paket erst per Klick (`zusatzDiff`, `zusatzUebernehmen`).

/**
 * Die Phasen eines Falls nach Abschnitten: erst das Paket, dann die Zusatzmodule in der Reihenfolge von `zusaetze` (bzw. ihrer ersten Phase) — innerhalb eines
 * Abschnitts bleibt die Reihenfolge. Ränge lückenlos. Ohne Zusatzmodul kommt dieselbe Liste zurück (Byte für Byte).
 */
export function abschnitteOrdnen(kn: FallKnoten[], zusaetze?: readonly Pick<FallZusatz, 'vorlageId'>[]): FallKnoten[] {
  const w = wurzelVon(kn);
  if (!w) return kn;
  const phasen = kinderVon(w.id, kn);
  if (!phasen.some(p => p.zusatz)) return kn;
  const reihe = [...(zusaetze ?? []).map(z => z.vorlageId)];
  for (const p of phasen) if (p.zusatz && !reihe.includes(p.zusatz)) reihe.push(p.zusatz);
  const platz = (p: FallKnoten) => (p.zusatz ? 1 + reihe.indexOf(p.zusatz) : 0);
  const sortiert = phasen.map((p, i) => ({ p, a: platz(p), i })).sort((x, y) => x.a - y.a || x.i - y.i).map(x => x.p);
  const rang = new Map(sortiert.map((p, i) => [p.id, i + 1]));
  if (sortiert.every(p => p.rang === rang.get(p.id))) return kn;
  return kn.map(k => (rang.has(k.id) && k.rang !== rang.get(k.id) ? { ...k, rang: rang.get(k.id)! } : k));
}

/**
 * Die Struktur eines Zusatzmoduls, wie sie im Fall steht (rein): ohne seinen obersten Knoten — an dessen Stelle der oberste Knoten des Falls (mit den Werten des
 * Falls, damit er nie als „geändert“ zählt); seine Phasen hängen darunter, hinter den Phasen, die nicht zu diesem Abschnitt gehören.
 */
function zusatzAbbild(fall: Pick<Fall, 'knoten'>, v: Pick<ProzessVorlage, 'id' | 'knoten'>): ProzessKnoten[] {
  const fw = wurzelVon(fall.knoten) ?? nein('Der Fall hat keinen obersten Knoten.');
  const vw = wurzelVon(v.knoten) ?? nein('Das Zusatzmodul hat keinen obersten Knoten.');
  const basis = kinderVon(fw.id, fall.knoten).filter(p => p.zusatz !== v.id).reduce((m, p) => Math.max(m, p.rang), 0);
  const wurzel: Record<string, unknown> = { id: fw.id, titel: fw.titel, rang: fw.rang };
  for (const f of STRUKTUR_FELDER) if (fw[f] !== undefined) wurzel[f] = fw[f];
  return [
    wurzel as unknown as ProzessKnoten,
    ...v.knoten.filter(k => k.id !== vw.id).map(k => (k.elternId === vw.id ? { ...k, elternId: fw.id, rang: basis + k.rang } : k)),
  ];
}

/** Die Phasen eines Zusatzmoduls im Fall markieren (`zusatz` = Kennung der Vorlage) — nur Phasen, die aus seiner Struktur stammen. */
function zusatzMarkieren(kn: FallKnoten[], fallWurzel: string, abbild: readonly ProzessKnoten[], vorlageId: string): FallKnoten[] {
  const phasen = new Set(abbild.filter(k => k.elternId === fallWurzel).map(k => k.id));
  return kn.map(k => (phasen.has(k.id) && k.elternId === fallWurzel && k.zusatz !== vorlageId ? { ...k, zusatz: vorlageId } : k));
}

export interface ZusatzEingabe { vorlage: ProzessVorlage; person: string; jetzt: string; start: string }

/**
 * Ein Zusatzmodul an einen laufenden Fall hängen (rein, alles oder nichts): seine Phasen als eigener Abschnitt hinter denen des Pakets, Fälligkeiten der Phasen
 * (`dauerTage` hintereinander) und des ersten Schritts (`frist`) ab dem Starttag. Abgelehnt: kein Zusatzmodul (400), dasselbe Paket bzw. schon angehängt, Fall
 * abgeschlossen, Kennung oder Abstimmungspunkt doppelt (409), Grenze (413).
 */
export function zusatzAnhaengen(fall0: Fall, e: ZusatzEingabe): AnwendenErgebnis<Fall> {
  return ausfuehren(() => {
    const v = e.vorlage;
    if (v.art !== 'paket' || !v.zusatz) nein('Nur ein Zusatzmodul (Paket-Vorlage mit „Zusatzmodul“) hängt an einen laufenden Fall.');
    if (fall0.status === 'abgeschlossen') nein('Der Fall dieses Mandats ist abgeschlossen — bitte erst wieder öffnen (Status des Falls), dann das Zusatzmodul anhängen.', 409);
    if (fall0.vorlageId === v.id) nein(`Der Fall läuft schon mit „${v.titel}“.`, 409);
    if (fall0.zusaetze?.some(z => z.vorlageId === v.id)) nein(`„${v.titel}“ hängt schon an diesem Fall.`, 409);
    if ((fall0.zusaetze?.length ?? 0) >= GRENZEN.zusaetzeJeFall) nein(`Höchstens ${GRENZEN.zusaetzeJeFall} Zusatzmodule je Fall. Nichts gespeichert.`, 413);
    const fw = wurzelVon(fall0.knoten) ?? nein('Der Fall hat keinen obersten Knoten.');
    const vw = wurzelVon(v.knoten) ?? nein('Das Zusatzmodul hat keinen obersten Knoten.');
    const da = new Set(fall0.knoten.map(k => k.id));
    const doppelt = v.knoten.find(k => k.id !== vw.id && da.has(k.id));
    if (doppelt) nein(`„${doppelt.titel}“ steht schon im Fall — das Zusatzmodul passt so nicht dazu.`, 409);
    const belegt = new Set([...fall0.knoten.map(k => k.freigabe).filter((x): x is string => !!x), ...Object.keys(fall0.freigaben)]);
    const fg = v.knoten.map(k => k.freigabe).find(x => !!x && belegt.has(x));
    if (fg) nein(`Den Abstimmungspunkt „${fg}“ gibt es im Fall schon — im Zusatzmodul bitte eine andere Kennung wählen.`, 409);
    const abbild = zusatzAbbild(fall0, v);
    let knoten = zusatzMarkieren(knotenUebernehmen(fall0.knoten, abbild), fw.id, abbild, v.id);
    if (knoten.some(k => ebeneVon(k, knoten) > EBENEN_MAX)) nein('Das Zusatzmodul hat zu viele Ebenen für den Fall.');
    if (knoten.length > GRENZEN.knotenJeFall) nein(`Knoten im Fall: höchstens ${GRENZEN.knotenJeFall} (mit dem Zusatzmodul wären es ${knoten.length}). Nichts gespeichert.`, 413);
    // Fälligkeiten wie beim Start eines Falls — ab dem Starttag des Abschnitts.
    let tag = e.start;
    for (const p of kinderVon(fw.id, knoten).filter(x => x.zusatz === v.id)) {
      if (!p.dauerTage) continue;
      tag = tagPlus(tag, p.dauerTage);
      const t = tag;
      knoten = knoten.map(k => (k.id === p.id ? { ...k, faelligAm: t } : k));
    }
    const erster = phasenDer(knoten).filter(p => p.zusatz === v.id).flatMap(p => phasenSchritte(knoten, p.id))[0];
    if (erster?.frist !== undefined && !erster.faelligAm) knoten = knoten.map(k => (k.id === erster.id ? { ...k, faelligAm: tagPlus(e.start, erster.frist!) } : k));
    const zusaetze: FallZusatz[] = [...(fall0.zusaetze ?? []), { vorlageId: v.id, vorlageFassung: v.fassung, wurzelId: vw.id, titel: v.titel, startAm: e.start, angehaengtAm: e.jetzt, angehaengtVon: e.person }];
    knoten = abschnitteOrdnen(knoten, zusaetze);
    return { datei: { ...fall0, knoten, zusaetze, geaendert: e.jetzt, geaendertVon: e.person }, geaendert: [fall0.mandatId] };
  });
}

/** Was sich an einem angehängten Zusatzmodul seit dem Anhängen (bzw. der letzten Übernahme) geändert hat — null, wenn nichts (oder es nicht anhängt). */
export function zusatzDiff(fall: Pick<Fall, 'knoten' | 'zusaetze'>, v: ProzessVorlage): VorlagenDiff | null {
  const z = fall.zusaetze?.find(x => x.vorlageId === v.id);
  const fw = wurzelVon(fall.knoten);
  if (!z || !fw || !wurzelVon(v.knoten)) return null;
  const imAbschnitt = zusatzJeKnoten(fall.knoten);
  const sicht = fall.knoten.filter(k => k.id === fw.id || imAbschnitt.get(k.id) === v.id);
  return vorlagenDiff({ knoten: sicht, vorlageFassung: z.vorlageFassung }, { ...v, knoten: zusatzAbbild(fall, v) });
}

/** Die neue Fassung eines angehängten Zusatzmoduls übernehmen — dieselbe Mechanik wie beim Paket (nur hinzufügen/ändern, nie entfernen). */
export function zusatzUebernehmen(fall: Fall, v: ProzessVorlage, jetzt: string, person: string): Fall {
  const z = fall.zusaetze?.find(x => x.vorlageId === v.id);
  const fw = wurzelVon(fall.knoten);
  if (!z || !fw) return fall;
  const abbild = zusatzAbbild(fall, v);
  let knoten = zusatzMarkieren(knotenUebernehmen(fall.knoten, abbild), fw.id, abbild, v.id);
  if (knoten.some(k => ebeneVon(k, knoten) > EBENEN_MAX)) knoten = fall.knoten; // nie eine kaputte Struktur übernehmen
  else knoten = abschnitteOrdnen(reihenfolgeUebernehmen(knoten, { ...v, knoten: abbild }), fall.zusaetze);
  return { ...fall, knoten, zusaetze: fall.zusaetze!.map(x => (x.vorlageId === v.id ? { ...x, vorlageFassung: v.fassung } : x)), geaendert: jetzt, geaendertVon: person };
}

/**
 * Die Abstimmungspunkte eines Falls: die seines Pakets und die seiner angehängten Zusatzmodule (Kennungen sind im Fall eindeutig — `zusatzAnhaengen` lehnt
 * doppelte ab; bei Gleichstand gewinnt das Paket). EINE Stelle für Fall, Reise, Cockpit, Kunden-Seite und Report.
 */
export function fallFreigaben(f: Pick<Fall, 'vorlageId' | 'zusaetze'>, prozesse: readonly Pick<ProzessVorlage, 'id' | 'freigaben'>[]): Freigabepunkt[] {
  const raus = [...(prozesse.find(p => p.id === f.vorlageId)?.freigaben ?? [])];
  for (const z of f.zusaetze ?? []) for (const fg of prozesse.find(p => p.id === z.vorlageId)?.freigaben ?? []) if (!raus.some(x => x.id === fg.id)) raus.push(fg);
  return raus;
}


// ── Änderungen am Fall ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FallKontext {
  person: string; jetzt: string; heute: string;
  standVon: (x: object) => string;
  neueId: (praefix: 'fs' | 'fe' | 'fn' | 'fq' | 'fx' | 'fk' | 'bf') => string;
  /** Ziele des Mandats (Mandat.ziele) — das Wert-Konto nur für diese. */
  ziele: readonly { id: string; ziel?: string }[];
  /** Darf dieser Kontakt als Stakeholder eingetragen werden? (Kartei, Art. 18 eingeschränkte fehlen.) */
  kontaktErlaubt: (id: string) => boolean;
  /** Ritual-Vorlagen der Bibliothek (Kennungen). */
  ritualIds: readonly string[];
  /** Freigabepunkte der Vorlage (Kennungen) — dazu jede Freigabe, die ein Knoten des Falls trägt. */
  freigaben: readonly string[];
}

const KNOTEN_STATUS: readonly KnotenStatus[] = ['offen', 'in_arbeit', 'wartet_kunde', 'erledigt', 'entfaellt'];
const ROLLEN = ['entscheider', 'unterstuetzer', 'skeptiker', 'nutzer', 'einkauf', 'sponsor'] as const;
const WIE = ['kickoff', 'mail', 'link', 'termin'] as const;
const AN = ['gruender', 'entscheider', 'vertrieb'] as const;
const VEREINBARUNG = ['rollen', 'reaktionszeiten', 'wirBrauchen', 'eskalation', 'scopeDrin', 'scopeDraussen', 'entscheidungsrechte'] as const;

export type FallOp = { op: string } & Record<string, unknown>;

/**
 * Änderungen an EINEM Fall — alles oder nichts. Ops: knoten-status · knoten-extra · freigabe · vereinbarung · stakeholder · entscheidung ·
 * ritual-merken · mitschrift · quickwins-setzen · quickwin · kickoff-fragen · kickoff-frage · wert-ziel · wert-messung · befaehigung ·
 * willkommen-gesendet · fall-status · antwort (17.10. abends: Entscheidung ja/nein) (Formen im Kopf von app/api/fulfillment/fall/route.ts und in CLAUDE.md › Fulfillment).
 */
export function fallAnwenden(fall0: Fall, opsRoh: unknown, k: FallKontext): AnwendenErgebnis<Fall> {
  return ausfuehren(() => {
    if (!Array.isArray(opsRoh) || !opsRoh.length) return nein('ops: mindestens eine Änderung.');
    if (opsRoh.length > GRENZEN.opsJeAnfrage) return nein(`Höchstens ${GRENZEN.opsJeAnfrage} Änderungen je Anfrage. Nichts gespeichert.`, 413);
    const f: Fall = JSON.parse(JSON.stringify(fall0));
    const geaendert: string[] = [];
    const knoten = (id: unknown): FallKnoten => f.knoten.find(x => x.id === id) ?? nein('Diesen Schritt gibt es im Fall nicht (mehr).', 404);
    const setzeKnoten = (n: FallKnoten) => { f.knoten = f.knoten.map(x => (x.id === n.id ? n : x)); geaendert.push(n.id); };
    /** Eine ganze neue Knoten-Liste übernehmen (aus den reinen Regeln der Ausführung) — geändert ist, was anders ist. */
    const listeUebernehmen = (neu: readonly FallKnoten[]) => {
      const alt = new Map(f.knoten.map(x => [x.id, JSON.stringify(x)]));
      for (const x of neu) if (alt.get(x.id) !== JSON.stringify(x)) geaendert.push(x.id);
      f.knoten = [...neu];
    };
    const freigabenErlaubt = new Set([...k.freigaben, ...f.knoten.map(x => x.freigabe).filter((x): x is string => !!x)]);
    const erledigen = (n: FallKnoten, am = k.heute): FallKnoten => ({ ...n, status: 'erledigt', seit: am, erledigtAm: am, erledigtVon: k.person });
    // Nachtragen (12.10.): optional `am` — was schon passiert ist (Kick-off vor zwei Wochen), steht mit seinem Tag da; nie in der Zukunft.
    const nachtrag = (x: unknown, name: string): string | undefined => {
      const t = optTag(x, name);
      if (t === undefined || t === null) return undefined;
      if (t > k.heute) nein(`${name}: nie in der Zukunft.`);
      return t;
    };

    for (const roh of opsRoh) {
      if (!istObj(roh) || typeof roh.op !== 'string') nein('Jede Änderung braucht „op“.');
      const o = roh as FallOp;
      switch (o.op) {
        case 'knoten-status': {
          const n = knoten(o.id);
          standPruefen(o.stand, k.standVon(n), n.id);
          let neu: FallKnoten = { ...n };
          const status = optWahl(o.status, KNOTEN_STATUS, 'Status');
          const am = nachtrag(o.am, 'Am') ?? k.heute;
          if (status && status !== n.status) {
            if (status === 'erledigt' && obSchluessel(n.id)) nein('Dieser Onboarding-Schritt wird abgeleitet — er wird erledigt, sobald das Dazugehörige da ist.');
            if (status === 'erledigt' && n.freigabe) nein(`Dieser Schritt endet mit der Freigabe ${n.freigabe} — bitte „Freigabe vermerken“.`);
            if (status === 'entfaellt' && !(typeof o.grund === 'string' && o.grund.trim())) nein('„Entfällt“ braucht einen Grund.');
            const { erledigtAm: _a, erledigtVon: _b, grund: _g, ...rest } = n;
            neu = status === 'erledigt' ? erledigen(n, am) : { ...rest, status, seit: am };
            if (status === 'entfaellt') neu.grund = pflichtText(o.grund, 'notiz', 'Grund');
            // Eine Entscheidung wieder öffnen: ihre Antwort gilt nicht mehr (17.10. abends, Ausführung).
            if (n.status === 'erledigt' && status !== 'erledigt') { delete neu.antwort; delete neu.antwortAm; }
          }
          const fa = optTag(o.faelligAm, 'Fällig am');
          if (fa !== undefined) { if (fa === null) delete neu.faelligAm; else neu.faelligAm = fa; }
          if (JSON.stringify(neu) !== JSON.stringify(n)) setzeKnoten(neu);
          // Entfällt eine Entscheidung, entfällt ihr offener Nein-Zweig mit (sonst wartete er für immer).
          if (neu.status === 'entfaellt' && n.status !== 'entfaellt' && n.form === 'entscheidung' && n.zweige?.nein) {
            const r = f.knoten.find(x => x.id === n.zweige!.nein);
            if (r && r.status !== 'erledigt' && r.status !== 'entfaellt') { const { erledigtAm: _a, erledigtVon: _b, ...rr } = r; setzeKnoten({ ...rr, status: 'entfaellt', seit: am, grund: 'Entscheidung entfällt' }); }
          }
          if (neu.status === 'erledigt' && n.status !== 'erledigt') {
            // Ausführung (17.10. abends; vorher hier: Entscheidung erledigt = „ja“ → Nein-Zweig entfällt, Frist des nächsten Schritts): EINE Stelle
            // (lib/fulfillment/prozesse/ausfuehrung.ts `nachErledigung`) — Ja-/Nein-Zweig, Übersprungenes, die Schleife Erinnerung → wieder fragen, Fälligkeit.
            listeUebernehmen(nachErledigung(f.knoten, n.id, neu.erledigtAm ?? k.heute, k.person));
            // Takt ab einem Ereignis (Prüf-Fund 11.10., Messe-Nachfasstakt Tag 1/3/7/14/30): wird ein Knoten erledigt, bekommen die offenen
            // Einzelschritte des NÄCHSTEN Geschwisters mit `dauerTage` und ohne Fälligkeit `faelligAm` = Tag der Erledigung + dauerTage
            // („Während der Messe“ erledigt → „Nach der Messe“: Nachfassen am Tag 1, 3, 7, 14, 30). Gesetzte Fälligkeiten bleiben.
            // (Nicht, wenn die Erledigung eine Runde der Schleife war — dann ist der Knoten wieder offen.)
            if (f.knoten.find(x => x.id === n.id)?.status === 'erledigt') {
              // Nur im selben Abschnitt (17.10. spät): die erste Phase eines angehängten Zusatzmoduls ist nie „das Nächste“ nach einer Phase des Pakets.
              const geschwister = kinderVon(n.elternId, f.knoten).filter(x => (x.zusatz ?? null) === (n.zusatz ?? null));
              const naechstes = geschwister[geschwister.findIndex(x => x.id === n.id) + 1];
              if (naechstes) for (const s of kinderVon(naechstes.id, f.knoten)) {
                if (s.dauerTage && !s.faelligAm && s.status === 'offen') setzeKnoten({ ...s, faelligAm: tagPlus(neu.erledigtAm ?? k.heute, s.dauerTage) });
              }
            }
          }
          break;
        }
        case 'antwort': {
          // Ausführung (17.10. abends): Entscheidung „ja“ / „nein“ — EIN Klick. „nein“ startet ihren Nein-Zweig (die Erinnerung, fällig nach ihrer Frist).
          const n = knoten(o.id);
          standPruefen(o.stand, k.standVon(n), n.id);
          const antwort = optWahl(o.antwort, ['ja', 'nein'] as const, 'Antwort') ?? nein('Antwort: ja oder nein.');
          const am = nachtrag(o.am, 'Am') ?? k.heute;
          const r = antwortAnwenden(f.knoten, n.id, antwort, am, k.person);
          if ('fehler' in r) nein(r.fehler, r.status);
          else listeUebernehmen(r.knoten);
          break;
        }
        case 'knoten-extra': {
          if (o.weg === true) {
            const n = knoten(o.id);
            if (!n.extra || obSchluessel(n.id) || n.id === 'fk-ob' || n.id === OB_TEIL_ID || n.id === OB_PLAYBOOK_FORMULAR_ID) nein('Nur eigene Zusatz-Schritte lassen sich entfernen — Schritte der Vorlage entfallen mit Grund.');
            const weg = new Set(teilbaum(n.id, f.knoten));
            f.knoten = f.knoten.filter(x => !weg.has(x.id)); geaendert.push(n.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.knoten.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Schritt gibt es im Fall nicht (mehr).', 404);
          if (alt) {
            standPruefen(o.stand, k.standVon(alt), alt.id);
            if (!alt.extra || obSchluessel(alt.id)) nein('Schritte der Vorlage ändert man in der Vorlage (danach „Vorlage übernehmen“).');
          }
          const teil: Record<string, unknown> = {};
          if (e.titel !== undefined || !alt) teil.titel = pflichtText(e.titel, 'titel', 'Titel');
          for (const [x, feld] of [['ziel', 'ziel'], ['ergebnis', 'ergebnis'], ['kennzahl', 'kurz']] as const) { const t = optText(e[x], feld, x); if (t !== undefined) teil[x] = t; }
          const z = optWahl(e.zustaendig, ['intern', 'kunde', 'beide'] as const, 'Zuständig'); if (z !== undefined) teil.zustaendig = z;
          const ks = optBool(e.kundeSichtbar, 'Für Kunden sichtbar'); if (ks !== undefined) teil.kundeSichtbar = ks;
          const fa = optTag(e.faelligAm, 'Fällig am'); if (fa !== undefined) teil.faelligAm = fa;
          if (alt) { setzeKnoten(mischen(alt, teil)); break; }
          const eltern = typeof e.elternId === 'string' ? f.knoten.find(x => x.id === e.elternId) : undefined;
          if (!eltern) nein('Ein Zusatz-Schritt hängt unter einem vorhandenen Schritt.');
          if (ebeneVon(eltern!, f.knoten) >= EBENEN_MAX - 1) nein('Zusatz-Schritte gehen bis Ebene 4 (Einzelschritt).');
          const id = k.neueId('fk');
          const n = mischen<FallKnoten>({ id, elternId: eltern!.id, titel: '', rang: kinderVon(eltern!.id, f.knoten).length + 1, status: 'offen', extra: true }, teil);
          f.knoten.push(n); geaendert.push(id);
          break;
        }
        case 'freigabe': {
          const id = typeof o.id === 'string' && freigabenErlaubt.has(o.id) ? o.id : nein('Diese Freigabe kennt der Fall nicht.');
          if (o.zuruecknehmen === true) {
            delete f.freigaben[id];
            for (const n of f.knoten.filter(x => x.freigabe === id && x.status === 'erledigt')) { const { erledigtAm: _a, erledigtVon: _b, ...r } = n; setzeKnoten({ ...r, status: 'offen', seit: k.heute }); }
            geaendert.push(`freigabe:${id}`);
            break;
          }
          const kunde = o.kunde === undefined || o.kunde === null ? undefined : istObj(o.kunde)
            ? { wie: optWahl(o.kunde.wie, WIE, 'Freigabe: wie') ?? nein('Freigabe: wie bestätigt (Kick-off, Mail, Link, Termin)?'), am: optTag(o.kunde.am, 'Freigabe: am') ?? k.heute }
            : nein('kunde: { wie, am }.');
          const notiz = optText(o.notiz, 'notiz', 'Notiz');
          const am = nachtrag(o.am, 'Vermerkt am') ?? k.heute;
          f.freigaben[id] = { am, von: k.person, ...(kunde ? { kunde } : {}), ...(notiz ? { notiz } : {}) };
          for (const n of f.knoten.filter(x => x.freigabe === id && x.status !== 'erledigt' && x.status !== 'entfaellt')) setzeKnoten(erledigen(n, am));
          geaendert.push(`freigabe:${id}`);
          break;
        }
        case 'vereinbarung': {
          const alt = f.vereinbarung ?? {};
          standPruefen(o.stand, k.standVon(alt), 'vereinbarung');
          const fe = istObj(o.felder) ? o.felder : nein('felder fehlen.');
          const teil: Record<string, unknown> = {};
          for (const x of VEREINBARUNG) { const t = optText(fe[x], 'ergebnis', x); if (t !== undefined) teil[x] = t; }
          const am = optTag(fe.bestaetigtAm, 'Bestätigt am'); if (am !== undefined) teil.bestaetigtAm = am;
          const wie = optWahl(fe.bestaetigtWie, ['kickoff', 'mail', 'termin'] as const, 'Bestätigt wie'); if (wie !== undefined) teil.bestaetigtWie = wie;
          const neu = mischen<Vereinbarung>(alt, teil);
          if (neu.bestaetigtAm && !neu.bestaetigtWie) nein('Wie wurde die Vereinbarung bestätigt (Kick-off, Mail, Termin)?');
          f.vereinbarung = neu; geaendert.push('vereinbarung');
          break;
        }
        case 'stakeholder': {
          if (o.weg === true) {
            const s = f.stakeholder.find(x => x.id === o.id) ?? nein('Diesen Eintrag gibt es nicht (mehr).', 404);
            standPruefen(o.stand, k.standVon(s), s.id);
            f.stakeholder = f.stakeholder.filter(x => x.id !== s.id); geaendert.push(s.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.stakeholder.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Eintrag gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const kontaktId = e.kontaktId === undefined && alt ? alt.kontaktId : typeof e.kontaktId === 'string' && k.kontaktErlaubt(e.kontaktId) ? e.kontaktId : nein('Stakeholder sind Kontakte der Kartei — diese Person gibt es nicht oder sie ist eingeschränkt (Art. 18).');
          if (f.stakeholder.some(x => x.kontaktId === kontaktId && x.id !== alt?.id)) nein('Diese Person steht schon auf der Stakeholder-Karte.', 409);
          const rolle = optWahl(e.rolle, ROLLEN, 'Rolle') ?? alt?.rolle ?? nein('Rolle fehlt.');
          const einfluss = e.einfluss === undefined ? alt?.einfluss ?? 2 : e.einfluss === 1 || e.einfluss === 2 || e.einfluss === 3 ? e.einfluss : nein('Einfluss: 1, 2 oder 3.');
          const teil: Record<string, unknown> = { kontaktId, rolle, einfluss };
          const h = optWahl(e.haltung, ['positiv', 'neutral', 'kritisch'] as const, 'Haltung'); if (h !== undefined) teil.haltung = h;
          const n = optText(e.notiz, 'notiz', 'Notiz'); if (n !== undefined) teil.notiz = n;
          const neu = mischen<Stakeholder>(alt ?? { id: k.neueId('fs'), kontaktId, rolle, einfluss }, teil);
          f.stakeholder = alt ? f.stakeholder.map(x => (x.id === neu.id ? neu : x)) : [...f.stakeholder, neu];
          geaendert.push(neu.id);
          break;
        }
        case 'entscheidung': {
          if (o.weg === true) {
            const x = f.entscheidungen.find(y => y.id === o.id) ?? nein('Diesen Eintrag gibt es nicht (mehr).', 404);
            f.entscheidungen = f.entscheidungen.filter(y => y.id !== x.id); geaendert.push(x.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const alt = typeof e.id === 'string' ? f.entscheidungen.find(x => x.id === e.id) : undefined;
          if (typeof e.id === 'string' && !alt) nein('Diesen Eintrag gibt es nicht (mehr).', 404);
          if (alt) standPruefen(o.stand, k.standVon(alt), alt.id);
          const teil: Record<string, unknown> = {};
          if (e.titel !== undefined || !alt) teil.titel = pflichtText(e.titel, 'titel', 'Titel');
          const inhalt = optText(e.inhalt, 'ergebnis', 'Inhalt'); if (inhalt !== undefined) teil.inhalt = inhalt;
          const st = optWahl(e.status, ['offen', 'entschieden', 'verworfen'] as const, 'Status'); if (st) teil.status = st;
          const wer = optWahl(e.wer, ['intern', 'kunde', 'beide'] as const, 'Wer entscheidet'); if (wer) teil.wer = wer;
          const fr = optTag(e.frist, 'Frist'); if (fr !== undefined) teil.frist = fr;
          const ge = optBool(e.geteilt, 'Mit dem Kunden geteilt'); if (ge !== undefined && ge !== null) teil.geteilt = ge;
          const neu = mischen<Entscheidung>(alt ?? { id: k.neueId('fe'), am: nachtrag(e.am, 'Am') ?? k.heute, titel: '', status: 'offen', wer: 'intern', geteilt: false, von: k.person }, teil);
          f.entscheidungen = alt ? f.entscheidungen.map(x => (x.id === neu.id ? neu : x)) : [...f.entscheidungen, neu];
          geaendert.push(neu.id);
          break;
        }
        case 'ritual-merken': {
          const ritualId = typeof o.ritualId === 'string' && k.ritualIds.includes(o.ritualId) ? o.ritualId : nein('Dieses Ritual gibt es in der Bibliothek nicht (mehr).', 404);
          const uid = typeof o.terminUid === 'string' && /^[^\u0000-\u001f\u007f]{1,300}$/.test(o.terminUid) ? o.terminUid : nein('Kennung des Termins fehlt.');
          const da = f.rituale.find(r => r.ritualId === ritualId);
          if (da?.terminUids.includes(uid)) break;
          f.rituale = da ? f.rituale.map(r => (r.ritualId === ritualId ? { ...r, terminUids: [...r.terminUids, uid].slice(-50) } : r)) : [...f.rituale, { ritualId, terminUids: [uid], angelegtAm: k.heute }];
          geaendert.push(`ritual:${ritualId}`);
          break;
        }
        case 'mitschrift': {
          if (o.weg === true) {
            const x = f.mitschriften.find(y => y.id === o.id) ?? nein('Diese Mitschrift gibt es nicht (mehr).', 404);
            f.mitschriften = f.mitschriften.filter(y => y.id !== x.id); geaendert.push(x.id);
            break;
          }
          const e = istObj(o.eintrag) ? o.eintrag : nein('eintrag fehlt.');
          const ritualId = e.ritualId === undefined || e.ritualId === null || e.ritualId === '' ? undefined : typeof e.ritualId === 'string' && k.ritualIds.includes(e.ritualId) ? e.ritualId : nein('Ritual unbekannt.');
          const m: Mitschrift = {
            id: k.neueId('fn'), am: optTag(e.am, 'Am') ?? k.heute,
            anlass: pflichtText(e.anlass, 'notiz', 'Anlass'), ergebnis: pflichtText(e.ergebnis, 'notiz', 'Ergebnis'), naechster: pflichtText(e.naechster, 'notiz', 'Nächster Schritt'),
            von: k.person, ...(ritualId ? { ritualId } : {}),
          };
          const fr = optTag(e.frist, 'Frist'); if (fr) m.frist = fr;
          f.mitschriften.push(m); geaendert.push(m.id);
          break;
        }
        case 'quickwins-setzen': {
          const l = Array.isArray(o.quickWins) ? o.quickWins : nein('quickWins: Liste erwartet.');
          if (l.length > 20) nein('Höchstens 20 Quick Wins auf einmal.', 413);
          for (const [i, x] of l.entries()) {
            if (!istObj(x)) nein(`Quick Win ${i + 1}: Objekt erwartet.`);
            const text = pflichtText(x.text, 'kurz', `Quick Win ${i + 1}`);
            if (f.quickWins.some(q => q.text.toLowerCase() === text.toLowerCase())) continue;
            const bis = optTag(x.bis, `Quick Win ${i + 1}: bis`) ?? tagPlus([fallStartTag(f), k.heute].sort().at(-1)!, 30);
            f.quickWins.push({ id: k.neueId('fq'), text, bis, quelle: x.quelle === 'analyse' ? 'analyse' : 'hand' });
          }
          geaendert.push('quickwins');
          break;
        }
        case 'quickwin': {
          const q = f.quickWins.find(x => x.id === o.id) ?? nein('Diesen Quick Win gibt es nicht (mehr).', 404);
          if (o.weg === true) f.quickWins = f.quickWins.filter(x => x.id !== q.id);
          else {
            const er = optBool(o.erledigt, 'Erledigt');
            const bis = optTag(o.bis, 'Bis');
            const am = nachtrag(o.am, 'Erledigt am');
            f.quickWins = f.quickWins.map(x => {
              if (x.id !== q.id) return x;
              const { erledigtAm: _e, ...r } = x;
              return { ...(er === true ? { ...r, erledigtAm: am ?? x.erledigtAm ?? k.heute } : er === false ? r : x), ...(bis ? { bis } : {}) };
            });
          }
          geaendert.push(q.id);
          break;
        }
        case 'kickoff-fragen': {
          const l = Array.isArray(o.fragen) ? o.fragen : nein('fragen: Liste erwartet.');
          if (l.length > 40) nein('Höchstens 40 Fragen auf einmal.', 413);
          for (const [i, x] of l.entries()) {
            if (!istObj(x)) nein(`Frage ${i + 1}: Objekt erwartet.`);
            const frage = pflichtText(x.frage, 'frage', `Frage ${i + 1}`);
            if (f.kickoffFragen.some(q => q.frage.toLowerCase() === frage.toLowerCase())) continue;
            const warum = optText(x.warum, 'kurz', `Frage ${i + 1}: warum`);
            f.kickoffFragen.push({ id: k.neueId('fx'), frage, an: optWahl(x.an, AN, `Frage ${i + 1}: an`) ?? 'entscheider', quelle: x.quelle === 'analyse' ? 'analyse' : 'hand', ...(warum ? { warum } : {}) });
          }
          if (f.kickoffFragen.length > 200) nein('Höchstens 200 Kick-off-Fragen je Fall.', 413);
          geaendert.push('kickoff-fragen');
          break;
        }
        case 'kickoff-frage': {
          const q = f.kickoffFragen.find(x => x.id === o.id) ?? nein('Diese Frage gibt es nicht (mehr).', 404);
          if (o.weg === true) f.kickoffFragen = f.kickoffFragen.filter(x => x.id !== q.id);
          else f.kickoffFragen = f.kickoffFragen.map(x => { if (x.id !== q.id) return x; const { erledigt: _e, ...r } = x; return o.erledigt === true ? { ...r, erledigt: true as const } : r; });
          geaendert.push(q.id);
          break;
        }
        case 'wert-ziel': {
          const z = k.ziele.find(x => x.id === o.zielId) ?? nein('Dieses Ziel steht nicht (mehr) am Mandat.', 404);
          const alt = f.wertKonto[z.id] ?? { messungen: [] };
          standPruefen(o.stand, k.standVon(alt), z.id);
          const fe = istObj(o.felder) ? o.felder : nein('felder fehlen.');
          const teil: Record<string, unknown> = {};
          const ag = optText(fe.ausgang, 'kurz', 'Ausgang'); if (ag !== undefined) teil.ausgang = ag;
          for (const [x, name] of [['ausgangZahl', 'Ausgangswert'], ['zielZahl', 'Zielwert']] as const) { const n = optZahl(fe[x], -1e12, 1e12, name); if (n !== undefined) teil[x] = n; }
          const eh = optText(fe.einheit, 'titel', 'Einheit'); if (eh !== undefined) teil.einheit = eh && eh.length > 20 ? nein('Einheit: höchstens 20 Zeichen.', 413) : eh;
          const ri = optWahl(fe.richtung, ['hoch', 'runter'] as const, 'Richtung'); if (ri !== undefined) teil.richtung = ri;
          const bis = optTag(fe.zielBis, 'Ziel bis'); if (bis !== undefined) teil.zielBis = bis;
          let neu = mischen<WertKontoEintrag>(alt, teil);
          if (fe.festlegen === true) {
            const fehlt = [!(neu.ausgangZahl !== undefined || neu.ausgang) && 'Ausgangslage', !(neu.zielZahl !== undefined || z.ziel) && 'Zielwert', !neu.zielBis && 'Datum'].filter(Boolean);
            if (fehlt.length) nein(`Zum Festlegen fehlt noch: ${fehlt.join(', ')}.`);
            // Nachtragen (15.10., Abnahme B6): festgelegt im Kick-off vor zwei Wochen steht mit seinem Tag da — nie in der Zukunft.
            const am = nachtrag(fe.festgelegtAm, 'Festgelegt am');
            neu = { ...neu, festgelegtAm: am ?? neu.festgelegtAm ?? k.heute };
          } else if (fe.festlegen === false) { const { festgelegtAm: _f, ...r } = neu; neu = r as WertKontoEintrag; }
          if (neu.ausgangZahl !== undefined && neu.zielZahl !== undefined && neu.zielZahl !== neu.ausgangZahl && !neu.richtung) neu.richtung = neu.zielZahl > neu.ausgangZahl ? 'hoch' : 'runter';
          f.wertKonto[z.id] = neu; geaendert.push(`wert:${z.id}`);
          break;
        }
        case 'wert-messung': {
          const z = k.ziele.find(x => x.id === o.zielId) ?? nein('Dieses Ziel steht nicht (mehr) am Mandat.', 404);
          const alt = f.wertKonto[z.id] ?? { messungen: [] };
          const am = optTag(o.am, 'Am') ?? k.heute;
          if (am > k.heute) nein('Eine Messung liegt nie in der Zukunft.');
          if (o.weg === true) { f.wertKonto[z.id] = { ...alt, messungen: alt.messungen.filter(m => m.am !== am) }; geaendert.push(`wert:${z.id}`); break; }
          const wert = optZahl(o.wert, -1e12, 1e12, 'Messwert');
          if (wert == null) nein('Messwert fehlt.');
          // Messwerte trägt nur MAKE ein (Entscheidung 10.10.) — es gibt keinen Kunden-Eingabeweg; Quelle immer „hand“.
          const messungen = [...alt.messungen.filter(m => m.am !== am), { am, wert: wert as number, quelle: 'hand' as const }].sort((a, b) => (a.am < b.am ? -1 : 1));
          f.wertKonto[z.id] = { ...alt, messungen }; geaendert.push(`wert:${z.id}`);
          break;
        }
        case 'befaehigung': {
          if (o.weg === true) { const x = f.befaehigung.find(y => y.id === o.id) ?? nein('Dieses Kriterium gibt es nicht (mehr).', 404); f.befaehigung = f.befaehigung.filter(y => y.id !== x.id); geaendert.push(x.id); break; }
          const alt = typeof o.id === 'string' ? f.befaehigung.find(y => y.id === o.id) : undefined;
          if (typeof o.id === 'string' && !alt) nein('Dieses Kriterium gibt es nicht (mehr).', 404);
          const text = o.text !== undefined || !alt ? pflichtText(o.text, 'kurz', 'Kriterium') : alt.text;
          const er = optBool(o.erfuellt, 'Erfüllt');
          const erfuellt = er === undefined || er === null ? alt?.erfuellt ?? false : er;
          const amNeu = nachtrag(o.am, 'Erfüllt am');
          const x = { id: alt?.id ?? k.neueId('bf'), text, erfuellt, ...(erfuellt ? { am: amNeu ?? (alt?.erfuellt ? alt.am ?? k.heute : k.heute) } : {}) };
          f.befaehigung = alt ? f.befaehigung.map(y => (y.id === x.id ? x : y)) : [...f.befaehigung, x];
          if (f.befaehigung.length > 30) nein('Höchstens 30 Befähigungs-Kriterien.', 413);
          geaendert.push(x.id);
          break;
        }
        case 'willkommen-gesendet': {
          if (o.zuruecknehmen === true) { f.onboarding = {}; geaendert.push('willkommen'); break; }
          if (f.onboarding.willkommenGesendetAm) break;
          // Nachtragen (14.10., wie bei Schritten und Abstimmungspunkten): mit `am` (Tag, nie in der Zukunft) gilt dieser Tag — sonst jetzt.
          const am = nachtrag(o.am, 'Gesendet am');
          f.onboarding = { willkommenGesendetAm: am && am < k.heute ? am : k.jetzt, willkommenVon: k.person };
          geaendert.push('willkommen');
          break;
        }
        case 'fall-status': {
          const st = optWahl(o.status, ['laeuft', 'pausiert', 'abgeschlossen'] as const, 'Status') ?? nein('Status fehlt.');
          f.status = st; geaendert.push('status');
          break;
        }
        default: nein(`Unbekannte Änderung „${o.op}“.`);
      }
    }
    if (!geaendert.length) return { datei: fall0, geaendert: [] };
    return { datei: { ...f, geaendert: k.jetzt, geaendertVon: k.person }, geaendert: Array.from(new Set(geaendert)) };
  });
}
