// ─── Fulfillment · Darstellung — reine Lese-Helfer für die Bilder der Oberfläche (11.10., Design-Überarbeitung) ──────────────────────────
// Rückmeldung 11.10.: „Es muss einfach zu verstehen sein — über Visualisierungen.“ Hier wird gerechnet, was die Bilder brauchen (Ampel je Etage
// der Landkarte, Steckbrief einer Paket-Vorlage, wo ein Baustein steckt, Reihenfolge „braucht Aufmerksamkeit“ im Cockpit, Wellen-Bild der
// Analyse, gemeinsame Sperrgründe) — die Komponenten zeichnen nur. Nur lesen: kein Bestand, keine Route, kein Schreibweg. Rein, client-sicher.

import type { AnalyseAgentId, ProzessKnoten, ProzessVorlage } from '../typen';
import { ebeneVon, kinderVon, wurzelVon } from '../regeln';
import type { CockpitZeile } from './cockpit';

// ── Landkarte: Ampel je Kasten ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type Ampel = 'gruen' | 'gelb' | 'rot';
type AmpelQuelle = Pick<CockpitZeile, 'mandatId' | 'health' | 'haengt'>;

/** Die Ampel eines Kunden: rot bei einem roten Hänger oder roter Health, gelb bei einem gelben, sonst grün. */
export function kundenAmpel(z: Pick<CockpitZeile, 'health' | 'haengt'>): Ampel {
  if (z.health === 'rot' || z.haengt.some(h => h.schwere === 'rot')) return 'rot';
  if (z.health === 'gelb' || z.haengt.length) return 'gelb';
  return 'gruen';
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

export interface PaketSteckbrief { phasen: { id: string; titel: string; freigabe?: string }[]; schritte: number; bausteine: number; freigaben: number }

/** Was eine Paket-Vorlage enthält: Phasen (Ebene 2, mit Freigabe-Punkt), Zahl der Schritte (ohne Wurzel), Zahl der Bausteine (Ebene 5). */
export function paketSteckbrief(v: Pick<ProzessVorlage, 'knoten' | 'freigaben'>): PaketSteckbrief {
  const w = wurzelVon(v.knoten);
  const phasen = w ? kinderVon(w.id, v.knoten) : [];
  const bausteine = new Set(v.knoten.filter(k => k.bausteinId).map(k => k.bausteinId!));
  return {
    phasen: phasen.map(p => ({ id: p.id, titel: p.titel, ...(p.freigabe ? { freigabe: p.freigabe } : {}) })),
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
