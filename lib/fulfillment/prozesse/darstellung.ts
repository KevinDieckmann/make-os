// ─── Fulfillment · Darstellung — reine Lese-Helfer für die Bilder der Oberfläche (11.10., Design-Überarbeitung) ──────────────────────────
// Rückmeldung 11.10.: „Es muss einfach zu verstehen sein — über Visualisierungen.“ Hier wird gerechnet, was die Bilder brauchen (Ampel je Etage
// der Landkarte, Steckbrief einer Paket-Vorlage, wo ein Baustein steckt, Reihenfolge „braucht Aufmerksamkeit“ im Cockpit, Wellen-Bild der
// Analyse, gemeinsame Sperrgründe) — die Komponenten zeichnen nur. Nur lesen: kein Bestand, keine Route, kein Schreibweg. Rein, client-sicher.

import type { AnalyseAgentId, ProzessKnoten, ProzessVorlage } from '../typen';
import { ebeneVon, inReihenfolge, kinderVon, wurzelVon } from '../regeln';
import type { CockpitZeile } from './cockpit';

// ── Titel und Abstimmungspunkte in der Anzeige (14.10., Abnahme B19/B20) ─────────────────────────────────────────────────────────────
// Die Daten bleiben, wie sie sind (Kennungen F0–F7, gespeicherte Titel) — nur die ANZEIGE ist einheitlich: interne Klammer-Zusätze („(nur Prozess)“)
// stehen nie im Titel, sondern als Erklärung daneben; Freigabe-Punkte heißen im Fulfillment „Abstimmungspunkt n“ (lückenlos in der Reihenfolge des
// Ablaufs — „Freigabe“ meint in MAKE OS die Vorschläge von ZOE). Rein, client-sicher.

/** Interne Zusätze in Klammern: „(nur Prozess)“, „(intern)“, „(nur intern …)“. */
const INTERN_ZUSATZ = /\s*\((?:nur\b[^)]*|intern[^)]*)\)/gi;
/** Ein Titel ohne internen Klammer-Zusatz (Leerraum geglättet) — so steht er in jeder Ansicht. */
export const titelOhneZusatz = (t: string): string => String(t ?? '').replace(INTERN_ZUSATZ, '').replace(/\s+/g, ' ').trim() || String(t ?? '').trim();
/** Der interne Zusatz eines Titels als Erklärung („nur Prozess“) — sonst undefined. */
export function titelZusatz(t: string): string | undefined {
  const m = /\((nur\b[^)]*|intern[^)]*)\)/i.exec(String(t ?? ''));
  return m ? m[1].trim() : undefined;
}

type MitFreigabe = { id: string; elternId?: string; rang: number; freigabe?: string };
/**
 * Die Nummer jedes Abstimmungspunkts (Freigabe-Kennung → 1, 2, 3 …) in der Reihenfolge, in der er im Ablauf zum ersten Mal vorkommt — lückenlos,
 * auch wenn ein Punkt der Vorlage (z. B. F1 „Analyse-Umfang“, der in der Analyse geführt wird) an keiner Phase hängt. Nur Anzeige.
 */
export function abstimmungsNummern(knoten: readonly MitFreigabe[]): Map<string, number> {
  const raus = new Map<string, number>();
  for (const k of inReihenfolge(knoten)) if (k.freigabe && !raus.has(k.freigabe)) raus.set(k.freigabe, raus.size + 1);
  return raus;
}
/** „Abstimmungspunkt 3 · Diagnose-Abnahme“ (ohne Titel: „Abstimmungspunkt 3“; unbekannt: „Abstimmungspunkt“). */
export function abstimmungName(id: string, nummern: ReadonlyMap<string, number>, titel?: string): string {
  const n = nummern.get(id);
  return `Abstimmungspunkt${n ? ` ${n}` : ''}${titel ? ` · ${titelOhneZusatz(titel)}` : ''}`;
}
/** Ein Titel mit Freigabe-Kürzel („F0 bestätigt“) in der Anzeige: „Abstimmungspunkt 1 bestätigt“, Zusätze weg. */
export function anzeigeTitel(titel: string, nummern?: ReadonlyMap<string, number>): string {
  return titelOhneZusatz(titel).replace(/\bF(\d{1,2})\b/g, (_x, d: string) => { const n = nummern?.get(`F${d}`); return `Abstimmungspunkt${n ? ` ${n}` : ''}`; });
}

/**
 * Freigabe-Kürzel in einem beliebigen Text (Gründe der Analyse, Hinweise …) in der Anzeige (15.10., Abnahme B5: „F0 noch nicht vermerkt“, „Nicht im Umfang
 * von F1“, „Übergabe (F7)“): „Abstimmungspunkt n („Titel“)“ mit derselben Nummer wie Ablauf und Kunden-Seite; hängt der Punkt an keiner Phase (z. B. der
 * Analyse-Umfang), „Abstimmungspunkt „Titel““. Die Daten behalten ihre Kennungen. Rein.
 */
export function ohneKuerzel(text: string, nummern: ReadonlyMap<string, number>, freigaben: readonly { id: string; titel: string }[] = []): string {
  return String(text ?? '').replace(/\bF(\d{1,2})\b/g, (_x, d: string) => {
    const id = `F${d}`, n = nummern.get(id), t = freigaben.find(x => x.id === id)?.titel;
    const titel = t ? titelOhneZusatz(t) : undefined;
    return n ? `Abstimmungspunkt ${n}${titel ? ` („${titel}“)` : ''}` : titel ? `Abstimmungspunkt „${titel}“` : 'Abstimmungspunkt';
  });
}

/**
 * Wie verteilen sich die laufenden Fälle (Lage „Kunden in Lieferung“)? Aus derselben Rechnung wie Fall-Kopf und Landkarte (`fallStelle` → Cockpit-Zeile):
 * Fälle im Onboarding als „im Onboarding“, sonst nach ihrer Phase („in Diagnose“). Häufigste zuerst, höchstens drei Gruppen.
 */
export function lageVerteilung(zeilen: readonly Pick<CockpitZeile, 'status' | 'phase'>[]): string {
  const n = new Map<string, number>();
  for (const z of zeilen) { const k = z.status === 'onboarding' ? 'im Onboarding' : z.phase ? `in ${z.phase}` : z.status === 'pausiert' ? 'pausiert' : 'ohne Phase'; n.set(k, (n.get(k) ?? 0) + 1); }
  const l = [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] === 'im Onboarding' ? -1 : b[0] === 'im Onboarding' ? 1 : a[0].localeCompare(b[0], 'de')));
  const teile = l.slice(0, 3).map(([k, v]) => `${v} ${k}`);
  const rest = l.slice(3).reduce((s, [, v]) => s + v, 0);
  return [...teile, ...(rest ? [`${rest} weitere`] : [])].join(' · ');
}

// ── Landkarte: Ampel je Kasten ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type Ampel = 'gruen' | 'gelb' | 'rot';
type AmpelQuelle = Pick<CockpitZeile, 'mandatId' | 'health' | 'haengt'>;

/** Die Ampel eines Kunden: rot bei einem roten Hänger oder roter Health, gelb bei einem gelben, sonst grün. */
export function kundenAmpel(z: Pick<CockpitZeile, 'health' | 'haengt'>): Ampel {
  if (z.health === 'rot' || z.haengt.some(h => h.schwere === 'rot')) return 'rot';
  if (z.health === 'gelb' || z.haengt.length) return 'gelb';
  return 'gruen';
}

// ── Lage: EINE Rechnung für intern UND Kunde (15.10., Abnahme B1) ─────────────────────────────────────────────────────────────────────
// Vorher rechnete die Kunden-Seite mit eigenen Schwellen (wartet ≥ 7 Tage gelb, Verzug ≥ 14 Tage rot) — Fall „braucht einen Blick“, Kunde „im Plan“.
// Jetzt gibt es nur die Hänger des Cockpits (`wasHaengt`) und die Health; der Kunde bekommt dieselbe Rechnung ÜBERSETZT, mit zwei festen Regeln (Entscheidung 15.10.):
//   · Health zählt beim Kunden nicht (unsere Einschätzung der Beziehung).
//   · Punkte ohne Kundenbezug (Willkommensmail, Report, überfälliger interner Schritt …) heißen beim Kunden „Wir sind dran“ (gelb) — nie rot.
// Kundenbezug hat nur „wartet auf den Kunden“, und nur, wenn der Kunde den wartenden Punkt selbst sieht (`kundeSieht`, geteilte Entscheidung bzw.
// Knoten an einem freigegebenen Baustein — dieselbe Regel wie seine Liste „Das brauchen wir von Ihnen“). Intern steht an der Ampel „Der Kunde sieht: …“.

/** Was der Kunde als Lage liest — die Art; die Wörter (Du/Sie) stehen in `KUNDEN_LAGE_TEXT`. */
export type KundenLageArt = 'plan' | 'fertig' | 'dran' | 'warten' | 'nurMitEuch';
type LageHaenger = { art: string; schwere: 'rot' | 'gelb'; kundeSieht?: boolean };

/** Hängt der Punkt beim Kunden (und sieht er ihn)? Nur dann hat er Kundenbezug. */
export const haengtBeimKunden = (h: LageHaenger): boolean => h.art === 'wartet' && h.kundeSieht !== false;

/** Die Kunden-Lage aus den Hängern (ohne Health): wartet beim Kunden rot → rot, gelb → gelb; nur interne Punkte → „Wir sind dran“ (gelb); sonst grün. */
export function kundenLageAus(haengt: readonly LageHaenger[], fertig = false): { ampel: Ampel; art: KundenLageArt } {
  const beimKunden = haengt.filter(haengtBeimKunden);
  if (beimKunden.some(h => h.schwere === 'rot')) return { ampel: 'rot', art: 'nurMitEuch' };
  if (beimKunden.length) return { ampel: 'gelb', art: 'warten' };
  if (haengt.length) return { ampel: 'gelb', art: 'dran' };
  return { ampel: 'gruen', art: fertig ? 'fertig' : 'plan' };
}

/** Die Wörter der Kunden-Lage je Anrede — EINE Tabelle für Kunden-Seite, Report, Präsentation und den Hinweis intern. */
export const KUNDEN_LAGE_TEXT: Record<KundenLageArt, { du: string; sie: string }> = {
  plan: { du: 'Wir liegen im Plan', sie: 'Wir liegen im Plan' },
  fertig: { du: 'Alles abgeschlossen', sie: 'Alles abgeschlossen' },
  dran: { du: 'Wir sind dran', sie: 'Wir sind dran' },
  warten: { du: 'Wir warten auf euren Input', sie: 'Wir warten auf Ihren Input' },
  nurMitEuch: { du: 'Wir kommen gerade nur mit euch weiter', sie: 'Wir kommen gerade nur mit Ihnen weiter' },
};

/**
 * Intern an der Ampel: was der Kunde sieht und — wenn es abweicht — warum (Health zählt beim Kunden nicht; interne Punkte heißen „Wir sind dran“).
 * Dieselbe Rechnung wie die Kunden-Seite (`kundenLageAus`), die Wörter in Sie-Form.
 */
export function kundeSiehtLage(z: Pick<CockpitZeile, 'health' | 'haengt'>, fertig = false): { ampel: Ampel; art: KundenLageArt; titel: string; grund?: string } {
  const k = kundenLageAus(z.haengt, fertig);
  const intern = kundenAmpel(z);
  const titel = KUNDEN_LAGE_TEXT[k.art].sie;
  if (intern === k.ampel) return { ...k, titel };
  const rang: Record<Ampel, number> = { gruen: 0, gelb: 1, rot: 2 };
  const ausHaengern: Ampel = z.haengt.some(h => h.schwere === 'rot') ? 'rot' : z.haengt.length ? 'gelb' : 'gruen';
  const gruende = [
    ...(z.health && rang[z.health] > rang[ausHaengern] ? ['Health zählt beim Kunden nicht'] : []),
    ...(z.haengt.some(h => !haengtBeimKunden(h) && (h.schwere === 'rot' || k.art === 'dran')) ? ['interne Punkte zeigt die Kunden-Seite als „Wir sind dran“'] : []),
  ];
  const grund = gruende.join(' · ') || undefined;
  return { ...k, titel, ...(grund ? { grund } : {}) };
}

/**
 * Ampel je Kasten der Landkarte: der schlechteste Stand der Kunden, die gerade dort stehen (`zaehler` = `kundenJeKnoten`). Ohne Kunden kein
 * Eintrag (der Kasten bleibt ohne Ampel); Kunden ohne Cockpit-Zeile (z. B. abgeschlossen) zählen nicht.
 */
export function knotenAmpel(zaehler: Record<string, readonly string[]>, zeilen: readonly AmpelQuelle[]): Record<string, Ampel> {
  const je = new Map(zeilen.map(z => [z.mandatId, kundenAmpel(z)]));
  const rang: Record<Ampel, number> = { gruen: 0, gelb: 1, rot: 2 };
  const raus: Record<string, Ampel> = {};
  for (const [id, mandate] of Object.entries(zaehler)) {
    const a = mandate.map(m => je.get(m)).filter((x): x is Ampel => !!x);
    if (a.length) raus[id] = a.reduce((x, y) => (rang[y] > rang[x] ? y : x));
  }
  return raus;
}

/** Die Ebenen in Worten (Brotkrumen und Leiter im Drill-down). */
export const EBENEN_NAME = ['Gesamt', 'Prozess', 'Teilprozess', 'Schritt', 'Baustein'] as const;

// ── Paket-Vorlagen als Karten ────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PaketSteckbrief { phasen: { id: string; titel: string; zusatz?: string; freigabe?: string; nr?: number }[]; schritte: number; bausteine: number; freigaben: number }

/**
 * Was eine Paket-Vorlage enthält: Phasen (Ebene 2, mit Abstimmungspunkt und dessen Nummer), Zahl der Schritte (ohne Wurzel), Zahl der Bausteine (Ebene 5).
 * Titel ohne internen Zusatz (14.10.: „Recruiting (nur Prozess)“ stand so auf der Karte) — der Zusatz steht als Erklärung daneben.
 */
export function paketSteckbrief(v: Pick<ProzessVorlage, 'knoten' | 'freigaben'>): PaketSteckbrief {
  const w = wurzelVon(v.knoten);
  const phasen = w ? kinderVon(w.id, v.knoten) : [];
  const bausteine = new Set(v.knoten.filter(k => k.bausteinId).map(k => k.bausteinId!));
  const nr = abstimmungsNummern(v.knoten);
  return {
    phasen: phasen.map(p => { const z = titelZusatz(p.titel); return { id: p.id, titel: titelOhneZusatz(p.titel), ...(z ? { zusatz: z } : {}), ...(p.freigabe ? { freigabe: p.freigabe, ...(nr.get(p.freigabe) ? { nr: nr.get(p.freigabe)! } : {}) } : {}) }; }),
    schritte: v.knoten.filter(k => k.elternId).length,
    bausteine: bausteine.size,
    freigaben: new Set(v.knoten.map(k => k.freigabe).filter(Boolean)).size,
  };
}

// ── Bausteine: in welchem Paket und welcher Phase sie stecken ───────────────────────────────────────────────────────────────────────

export interface BausteinOrt { pakete: string[]; phasen: string[] }

/** Je Baustein: die Paket-Vorlagen (Titel) und deren Phasen (Ebene 2), in denen er als Ebene-5-Knoten steckt — für die Filter der Bibliothek. */
export function bausteinOrte(prozesse: readonly Pick<ProzessVorlage, 'art' | 'titel' | 'knoten'>[]): Record<string, BausteinOrt> {
  const raus: Record<string, BausteinOrt> = {};
  for (const v of prozesse) {
    if (v.art !== 'paket') continue;
    const nach = new Map(v.knoten.map(k => [k.id, k]));
    const phaseVon = (k: ProzessKnoten): string | undefined => {
      let x: ProzessKnoten | undefined = k;
      const gesehen = new Set<string>();
      while (x && !gesehen.has(x.id)) {
        gesehen.add(x.id);
        if (ebeneVon(x, v.knoten) === 2) return x.titel;
        x = x.elternId ? nach.get(x.elternId) : undefined;
      }
      return undefined;
    };
    for (const k of v.knoten) {
      if (!k.bausteinId) continue;
      const o = (raus[k.bausteinId] ??= { pakete: [], phasen: [] });
      if (!o.pakete.includes(v.titel)) o.pakete.push(v.titel);
      const p = phaseVon(k);
      if (p && !o.phasen.includes(p)) o.phasen.push(p);
    }
  }
  return raus;
}

// ── Cockpit: wer braucht zuerst Aufmerksamkeit ──────────────────────────────────────────────────────────────────────────────────────

/** Punkte „braucht Aufmerksamkeit“ — rote Hänger zuerst, dann Health, Puls, gelbe Hänger, lange Wartezeiten, Onboarding. Höher = zuerst. */
export function aufmerksamkeit(z: Pick<CockpitZeile, 'health' | 'haengt' | 'pulsKritisch' | 'wartetAeltesterTage' | 'status' | 'onboarding'>): number {
  const rot = z.haengt.filter(h => h.schwere === 'rot').length, gelb = z.haengt.length - rot;
  return rot * 100 + (z.health === 'rot' ? 60 : z.health === 'gelb' ? 20 : 0) + (z.pulsKritisch ? 50 : 0) + gelb * 10
    + ((z.wartetAeltesterTage ?? 0) > 7 ? 10 : 0) + (z.status === 'onboarding' && !z.onboarding.fertig ? 5 : 0);
}
/** Die Kunden nach „braucht Aufmerksamkeit“ — bei Gleichstand weniger Fortschritt zuerst, dann nach Name. */
export function nachAufmerksamkeit<T extends Parameters<typeof aufmerksamkeit>[0] & Pick<CockpitZeile, 'fortschritt' | 'kunde'>>(zeilen: readonly T[]): T[] {
  return [...zeilen].sort((a, b) => aufmerksamkeit(b) - aufmerksamkeit(a) || a.fortschritt - b.fortschritt || a.kunde.localeCompare(b.kunde, 'de'));
}

// ── Analyse: Wellen-Bild ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type WellenStufe = 'uebernommen' | 'entwurf' | 'laeuft' | 'fehler' | 'bereit' | 'gesperrt';
export const WELLEN_TITEL = ['Start', 'Unternehmen', 'Vertiefung', 'Synthese und Prüfung'] as const;
export interface WellenAgent { id: AnalyseAgentId; name?: string; stufe: WellenStufe }
export interface Welle { nr: number; titel: string; agenten: WellenAgent[] }

/** Stufe eines Agenten im Bild: letzter Lauf zuerst (übernommen · Entwurf · läuft · Fehler), sonst bereit/gesperrt. */
export function wellenStufe(zustand: 'bereit' | 'gesperrt' | 'laeuft' | undefined, letzter?: string): WellenStufe {
  if (zustand === 'laeuft' || letzter === 'laeuft') return 'laeuft';
  if (letzter === 'uebernommen') return 'uebernommen';
  if (letzter === 'fertig') return 'entwurf';
  if (letzter === 'fehler') return 'fehler';
  return zustand === 'bereit' ? 'bereit' : 'gesperrt';
}

/** Die vier Wellen (0–3) mit ihren Agenten und deren Stufe — für die Lage eines Dossiers (Fall › Analyse) und die Übersicht (Analysen). */
export function wellenBild(agenten: readonly { id: AnalyseAgentId; welle: number; name?: string; zustand?: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string }[]): Welle[] {
  return WELLEN_TITEL.map((titel, nr) => ({
    nr, titel,
    agenten: agenten.filter(a => a.welle === nr).map(a => ({ id: a.id, ...(a.name ? { name: a.name } : {}), stufe: wellenStufe(a.zustand, a.letzter) })),
  }));
}

/**
 * Der nächste sinnvolle Lauf (die Hauptaktion der Analyse): der erste Agent des Minimalsets, der bereit ist und noch kein Ergebnis hat —
 * sonst irgendein bereiter ohne Ergebnis. Der Tiefenbericht startet woanders und zählt nicht.
 */
export function naechsterLauf<T extends { id: AnalyseAgentId; zustand: 'bereit' | 'gesperrt' | 'laeuft'; letzter?: string; grundNoetig: boolean }>(agenten: readonly T[], minimalset: readonly AnalyseAgentId[]): T | null {
  const offen = (a: T) => a.id !== 'tb' && a.zustand === 'bereit' && !a.grundNoetig && a.letzter !== 'uebernommen' && a.letzter !== 'fertig';
  for (const id of minimalset) { const a = agenten.find(x => x.id === id); if (a && offen(a)) return a; }
  return agenten.find(offen) ?? null;
}

/** Sätze, die bei vielen Agenten gleich stehen (KI aus, Web-Suche aus …) — einmal oben statt in jeder Zeile. Ab drei Agenten. */
export function gemeinsameSaetze(agenten: readonly { gruende: readonly string[]; hinweise: readonly string[] }[], ab = 3): string[] {
  const n = new Map<string, number>();
  for (const a of agenten) for (const s of new Set([...a.gruende, ...a.hinweise])) for (const t of saetze(s)) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.entries()].filter(([, z]) => z >= ab).map(([s]) => s);
}
/** Einen Grund-Text in Sätze teilen (Punkt + Leerzeichen + Großbuchstabe), damit gemeinsame Sätze aus längeren Gründen herausfallen. */
export function saetze(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/).map(x => x.trim()).filter(Boolean);
}
/** Ein Grund ohne die gemeinsamen Sätze (leer, wenn nichts Eigenes bleibt). */
export const ohneGemeinsame = (text: string, gemeinsam: ReadonlySet<string>): string => saetze(text).filter(s => !gemeinsam.has(s)).join(' ');
