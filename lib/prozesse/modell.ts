// ─── Prozesse — Regeln über dem Modell (Etappe A, 21.10.; ANALYSE_100.md Punkte 5, 7, 12, 15, 24, 27, 30) ──────────────────────────────────────
// EINE Stelle (rein, Server UND Browser) für alles, was Bild und Liste gemeinsam brauchen — die Zeichnung rechnet nichts davon selbst:
//   · Ort im Modell: `prozessVon`/`phaseVon`/`schrittVon`, `pfadGueltig` (Unbekanntes fällt weg), `brotkrumen` (Landkarte › Prozess › Phase › Schritt).
//   · Zahl der Fälle (Punkt 27): `zahlSchluessel`, `zahlTexte` — nie eine Null, höchstens eine zweite Zahl (rot nur bei Frist).
//   · Steckbrief (Punkt 7): `steckbriefZeilen` — Auslöser, Eingang, Phasen, Ergebnis, Empfänger, Eigner.
//   · Suche (Punkt 15): `prozesseSuchen` — Prozesse, Phasen, Schritte; der Treffer nennt die Ebene, auf der er aufleuchtet.
//   · Liste (Punkt 30): `alsListe` (verschachtelt je Ebene, Rauten als „Wenn … weiter bei …“) und `alsText` — dieselben Daten wie das Bild.
//   · Fläche (Ebene 3): `alsVorlage` — ein Prozess als Paket-Vorlage für die Fläche des Fulfillment-Editors (lib/fulfillment/prozesse/flaeche.ts
//     `flaecheBild`): dieselbe Lage, dieselben Formen und Pfeile wie im Editor, ohne zweite Zeichnung.
//   · Wenig und klar (Punkt 24): `kachelTexte` — was eine Kachel je Zoomstufe zeigt; jede Information nur einmal je Ansicht.

import { suchPasst } from '@/lib/text/such-norm';
import { produktZeile } from './produkt-bindung';
import { einstellbar } from './stellschrauben';
import { STAND_MARKE } from './ueberfuehrung';
import type { ProzessKnoten, ProzessVorlage } from '@/lib/fulfillment/typen';
import { BAENDER, KERN_STUFEN, STECKBRIEF_FELDER, EBENE_NAME, type Band, type Ebene, type KernStufe, type ProzessDef, type ProzessPfad, type ProzessPhase, type ProzessSchritt, type Zahl } from './typen';

// ── Ort im Modell ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const prozessVon = (l: readonly ProzessDef[], id: string | undefined): ProzessDef | undefined => (id ? l.find(p => p.id === id) : undefined);
export const phaseVon = (p: ProzessDef | undefined, id: string | undefined): ProzessPhase | undefined => (p && id ? p.phasen.find(x => x.id === id) : undefined);
export const schrittVon = (ph: ProzessPhase | undefined, id: string | undefined): ProzessSchritt | undefined => (ph && id ? ph.schritte.find(x => x.id === id) : undefined);

/** Der gültige Teil eines Pfads: ein unbekannter Prozess führt auf die Landkarte, eine unbekannte Phase auf den Prozess usw. */
export function pfadGueltig(l: readonly ProzessDef[], pfad: ProzessPfad): ProzessPfad {
  const p = prozessVon(l, pfad.p);
  if (!p) return {};
  const ph = phaseVon(p, pfad.ph);
  if (!ph) return { p: p.id };
  const s = schrittVon(ph, pfad.s);
  return s ? { p: p.id, ph: ph.id, s: s.id } : { p: p.id, ph: ph.id };
}

export interface Krume { titel: string; pfad: ProzessPfad; ebene: Ebene }
/** Brotkrumen: „Landkarte › Prozess › Phase › Schritt“ — der Weg zurück bleibt immer sichtbar (Punkt 12). */
export function brotkrumen(l: readonly ProzessDef[], pfad: ProzessPfad): Krume[] {
  const g = pfadGueltig(l, pfad);
  const raus: Krume[] = [{ titel: EBENE_NAME[1], pfad: {}, ebene: 1 }];
  const p = prozessVon(l, g.p);
  if (!p) return raus;
  raus.push({ titel: p.titel, pfad: { p: p.id }, ebene: 2 });
  const ph = phaseVon(p, g.ph);
  if (!ph) return raus;
  raus.push({ titel: ph.titel, pfad: { p: p.id, ph: ph.id }, ebene: 3 });
  const s = schrittVon(ph, g.s);
  if (s) raus.push({ titel: s.titel, pfad: { p: p.id, ph: ph.id, s: s.id }, ebene: 4 });
  return raus;
}

/** Die Marke eines Prozesses (Liste, Kachel, Feld): „System“ (im Code, nur lesbar), „Vorlage“ (Fulfillment) oder „Werkstatt“ (selbst gebaut). */
export const markeVon = (p: Pick<ProzessDef, 'quelle'>): 'System' | 'Vorlage' | 'Werkstatt' => (p.quelle === 'system' ? 'System' : p.quelle === 'werkstatt' ? 'Werkstatt' : 'Vorlage');
/**
 * Die Marke eines System-Prozesses (Kachel nah, Feld, Aria): „System · nur lesbar“ — oder, sobald er Stellschrauben trägt, die sich ändern lassen (22.10.,
 * lib/prozesse/stellschrauben.ts), „System · einstellbar“. Der Ablauf selbst bleibt im Code; einstellbar sind seine Werte.
 */
export const systemMarke = (p: { stellschrauben?: ProzessDef['stellschrauben'] }): 'System · einstellbar' | 'System · nur lesbar' => (einstellbar(p) ? 'System · einstellbar' : 'System · nur lesbar');
/**
 * Überführung (22.10., Paket Ü): die Marke eines System-Prozesses, dessen Teil in die Werkstatt umzieht, bzw. des Werkstatt-Prozesses, der ihn ersetzt —
 * „System · im Schatten“ / „Werkstatt · überführt“ … Ohne Überführung (bzw. solange sie nur möglich ist) null — dann gilt die Marke wie bisher.
 */
export const ueberfuehrungMarke = (p: Pick<ProzessDef, 'quelle' | 'ueberfuehrung'>): string | null => {
  const m = p.ueberfuehrung ? STAND_MARKE[p.ueberfuehrung.stand] : null;
  return m ? `${p.quelle === 'system' ? 'System' : 'Werkstatt'} · ${m}` : null;
};

/** Wo eine Kachel auf der Landkarte steht: Band (und im Kern die Stufe der Fliege). */
export function ortVon(p: Pick<ProzessDef, 'band' | 'stufe'>): string {
  const b = BAENDER.find(x => x.id === p.band)?.titel ?? '';
  const s = p.band === 'kern' && p.stufe ? KERN_STUFEN.find(x => x.id === p.stufe)?.titel : null;
  return s ? `${b} · ${s}` : b;
}

// ── Zahl der Fälle ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Schlüssel einer Zahl: `p`, `p/phase`, `p/phase/schritt`. */
export const zahlSchluessel = (p: ProzessPfad): string => [p.p, p.ph, p.s].filter(Boolean).join('/');

const zahlWort = (n: number) => n.toLocaleString('de-DE');
/**
 * Was eine Zahl zeigt (Punkt 27): die Hauptzahl mit Wort, die zweite nur, wenn sie zählt (rot nur bei einer Frist). Keine Zahl ohne echten Wert —
 * nie eine Null (DESIGN_STANDARD.md).
 */
export function zahlTexte(z: Zahl | undefined): { haupt?: string; zweite?: { text: string; rot: boolean } } | null {
  if (!z) return null;
  const haupt = z.wert > 0 ? `${zahlWort(z.wert)} ${z.wort}` : undefined;
  const zweite = z.zweite && z.zweite.wert > 0 ? { text: `${zahlWort(z.zweite.wert)} ${z.zweite.wort}`, rot: !!z.zweite.rot } : undefined;
  if (!haupt && !zweite) return null;
  return { ...(haupt ? { haupt } : {}), ...(zweite ? { zweite } : {}) };
}

// ── Steckbrief ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die sechs Felder des Steckbriefs in fester Reihenfolge; Phasen aus dem Prozess selbst („A → B → C“). `phasenImBild`: das Bild daneben zeigt die Phasen
 * schon — dann nur ihre Zahl (Punkt 24: jede Information nur einmal je Ansicht).
 */
export function steckbriefZeilen(p: ProzessDef, o: { phasenImBild?: boolean } = {}): { id: string; titel: string; wert: string }[] {
  const phasen = () => (o.phasenImBild ? `${p.phasen.length} ${p.phasen.length === 1 ? 'Phase' : 'Phasen'}` : p.phasen.map(x => x.titel).join(' → ') || '—');
  return STECKBRIEF_FELDER.map(f => ({ id: f.id, titel: f.titel, wert: f.id === 'phasen' ? phasen() : p.steckbrief[f.id] }));
}

/** Der kurze Titel für die Ferne (Zoomstufe „fern“): ohne Klammerzusatz. */
export const kurztitel = (t: string): string => t.split(' (')[0].trim() || t;

// ── Schritte in Worten (Liste, Detail, Vorlesen) ───────────────────────────────────────────────────────────────────────────────────────

/** Die Entscheidung, deren Nein-Zweig dieser Schritt ist. */
export const neinVon = (ph: ProzessPhase, id: string): ProzessSchritt | undefined => ph.schritte.find(x => x.form === 'entscheidung' && x.nein === id);
const nameVon = (ph: ProzessPhase, id: string | undefined) => (id ? ph.schritte.find(x => x.id === id)?.titel : undefined);

/** Der Weg ab einem Schritt in Worten: Rauten als „Wenn ja … · wenn nein …“, Nein-Zweige mit „danach zurück zu …“ bzw. „Ende dieses Wegs“. */
export function schrittSatz(ph: ProzessPhase, s: ProzessSchritt): string | undefined {
  const haupt = ph.schritte.filter(x => !neinVon(ph, x.id));
  if (s.form === 'entscheidung') {
    const i = haupt.findIndex(x => x.id === s.id);
    const ja = nameVon(ph, s.ja) ?? haupt[i + 1]?.titel;
    const nein = nameVon(ph, s.nein);
    return `Wenn ja: ${ja ? `weiter bei „${ja}“` : 'weiter zur nächsten Phase'} · wenn nein: ${nein ? `weiter bei „${nein}“` : 'wie bei ja'}`;
  }
  const d = neinVon(ph, s.id);
  if (d) return s.zurueck ? `Danach zurück zu „${d.titel}“` : s.ende ? 'Ende dieses Wegs' : 'Danach weiter wie bei ja';
  return undefined;
}

// ── Suche ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SuchTreffer {
  id: string; art: 'prozess' | 'phase' | 'schritt'; titel: string;
  /** Wo er steht (Brotkrumen in Worten). */
  wo: string;
  /** Die Ebene, auf der er aufleuchtet, und was dort leuchtet. */
  ziel: ProzessPfad; leuchten: string;
}
/** Sucht Prozesse, Phasen und Schritte (Titel, Steckbrief, „was“) — Umlaute gefaltet wie überall (`suchPasst`). Höchstens `max` Treffer, Prozesse zuerst. */
export function prozesseSuchen(l: readonly ProzessDef[], frage: string, max = 12): SuchTreffer[] {
  if (!frage.trim()) return [];
  const raus: SuchTreffer[] = [];
  // Treffer im Titel vor Treffern nur im Steckbrief.
  const imTitel = l.filter(p => suchPasst([p.titel], frage));
  const imSteckbrief = l.filter(p => !imTitel.includes(p) && suchPasst(Object.values(p.steckbrief), frage));
  for (const p of [...imTitel, ...imSteckbrief]) raus.push({ id: p.id, art: 'prozess', titel: p.titel, wo: ortVon(p), ziel: {}, leuchten: p.id });
  for (const p of l) for (const ph of p.phasen) if (suchPasst([ph.titel], frage)) raus.push({ id: `${p.id}/${ph.id}`, art: 'phase', titel: ph.titel, wo: p.titel, ziel: { p: p.id }, leuchten: ph.id });
  for (const p of l) for (const ph of p.phasen) for (const s of ph.schritte) {
    if (suchPasst([s.titel, s.was], frage)) raus.push({ id: `${p.id}/${ph.id}/${s.id}`, art: 'schritt', titel: s.titel, wo: `${p.titel} › ${ph.titel}`, ziel: { p: p.id, ph: ph.id, s: s.id }, leuchten: s.id });
  }
  return raus.slice(0, max);
}

// ── Liste (Punkt 30) ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ListenKnoten { id: string; ebene: Exclude<Ebene, 1>; titel: string; text?: string; zahl?: string; marke?: 'System' | 'Vorlage' | 'Werkstatt'; pfad: ProzessPfad; kinder: ListenKnoten[] }
export interface ListenGruppe { id: string; titel: string | null; prozesse: ListenKnoten[] }
export interface ListenBand { id: Band | string; titel: string; satz: string; gruppen: ListenGruppe[] }

const zahlText = (z: Zahl | undefined): string | undefined => {
  const t = zahlTexte(z);
  return t ? [t.haupt, t.zweite?.text].filter(Boolean).join(' · ') : undefined;
};

/** Ein Prozess als Listenknoten mit Phasen und Schritten. */
export function prozessAlsListe(p: ProzessDef, zahlen: Readonly<Record<string, Zahl>> = {}): ListenKnoten {
  const zp = zahlText(zahlen[p.id]);
  return {
    id: p.id, ebene: 2, titel: p.titel, marke: markeVon(p), pfad: { p: p.id },
    text: `Auslöser: ${p.steckbrief.ausloeser} · Ergebnis: ${p.steckbrief.ergebnis} · Eigner: ${p.steckbrief.eigner}`,
    ...(zp ? { zahl: zp } : {}),
    kinder: p.phasen.map(ph => {
      const zph = zahlText(zahlen[zahlSchluessel({ p: p.id, ph: ph.id })]);
      return {
        id: `${p.id}/${ph.id}`, ebene: 3 as const, titel: ph.titel, pfad: { p: p.id, ph: ph.id }, ...(zph ? { zahl: zph } : {}),
        ...(ph.abstimmung ? { text: `Am Ende: ${ph.abstimmung}` } : {}),
        kinder: ph.schritte.map(s => {
          const satz = schrittSatz(ph, s);
          const zs = zahlText(zahlen[zahlSchluessel({ p: p.id, ph: ph.id, s: s.id })]);
          // Feinschliff 24.10.: Schritte der Werkstatt tragen ihre Kurzzeile (`was`, z. B. „montags 08:00“, „„Danke …“ · Stapel“) — vor dem Satz des Wegs.
          const text = [s.was, satz].filter(Boolean).join(' · ');
          return { id: `${p.id}/${ph.id}/${s.id}`, ebene: 4 as const, titel: s.titel, pfad: { p: p.id, ph: ph.id, s: s.id }, kinder: [], ...(text ? { text } : {}), ...(zs ? { zahl: zs } : {}) };
        }),
      };
    }),
  };
}

/**
 * Das ganze Modell als verschachtelte Liste: Bänder (Führung, Kern mit den Stufen der Fliege, Unterstützung) → Prozesse → Phasen → Schritte. `o.bereiche`
 * (Landkarte anpassen, lib/prozesse/landkarte-anpassung.ts): eigene Namen und eigene Bereiche (als Band oben bzw. unten) — ohne Angabe wie bisher.
 */
export function alsListe(l: readonly ProzessDef[], zahlen: Readonly<Record<string, Zahl>> = {}, o: { bereiche?: readonly { id: string; art: string; titel: string; satz?: string; lage?: 'oben' | 'unten' }[] } = {}): ListenBand[] {
  const anders = (id: string) => o.bereiche?.find(b => b.id === id);
  const eigene = (lage: 'oben' | 'unten'): ListenBand[] => (o.bereiche ?? []).filter(b => b.art === 'eigen' && (b.lage ?? 'unten') === lage)
    .map(b => ({ id: b.id, titel: b.titel, satz: b.satz ?? '', gruppen: [{ id: b.id, titel: null, prozesse: l.filter(p => p.bereichEigen === b.id).map(p => prozessAlsListe(p, zahlen)) }] }));
  const fest = BAENDER.map(b => {
    const imBand = l.filter(p => p.band === b.id && !p.bereichEigen);
    const gruppen: ListenGruppe[] = b.id === 'kern'
      ? KERN_STUFEN.map(s => ({ id: s.id, titel: anders(s.id)?.titel ?? s.titel, prozesse: imBand.filter(p => stufeVon(p) === s.id).map(p => prozessAlsListe(p, zahlen)) })).filter(g => g.prozesse.length)
      : [{ id: b.id, titel: null, prozesse: imBand.map(p => prozessAlsListe(p, zahlen)) }];
    return { id: b.id, titel: anders(b.id)?.titel ?? b.titel, satz: anders(b.id)?.satz ?? b.satz, gruppen } as ListenBand;
  });
  return [fest[0], ...eigene('oben'), fest[1], fest[2], ...eigene('unten')].filter(b => b.gruppen.some(g => g.prozesse.length));
}

/** Die Liste als Text (Kopieren, Vorlesen, später die Prozessbeschreibung für ZOE). */
export function alsText(baender: readonly ListenBand[]): string {
  const z: string[] = [];
  const knoten = (k: ListenKnoten, tiefe: number) => {
    z.push(`${'  '.repeat(tiefe)}- ${k.titel}${k.marke ? ` [${k.marke}]` : ''}${k.zahl ? ` (${k.zahl})` : ''}${k.text ? ` — ${k.text}` : ''}`);
    for (const c of k.kinder) knoten(c, tiefe + 1);
  };
  for (const b of baender) {
    z.push(`# ${b.titel} — ${b.satz}`);
    for (const g of b.gruppen) {
      if (g.titel) z.push(`## ${g.titel}`);
      for (const p of g.prozesse) knoten(p, 0);
    }
    z.push('');
  }
  return z.join('\n').trim();
}

// ── Die Fläche (Ebene 3): ein Prozess als Paket-Vorlage für `flaecheBild` ──────────────────────────────────────────────────────────

/** Die Kennung der Wurzel in der Vorlage (nie gleich einer Phase oder einem Schritt). */
export const wurzelKennung = (p: Pick<ProzessDef, 'id'>) => `w~${p.id}`;
/** Die Kennung des Abstimmungspunkts einer Phase in der Vorlage. */
export const abstimmungKennung = (phaseId: string) => `fg~${phaseId}`;

/**
 * Ein Prozess als Paket-Vorlage (rein): Wurzel → Phasen (Ebene 2) → Schritte (Ebene 3) mit Formen und Zweigen — die Fläche des Editors legt sie aus
 * (Rahmen je Phase links → rechts, Schritte oben → unten, Nein-Zweig rechts daneben). Nie gespeichert, nie bearbeitbar.
 */
export function alsVorlage(p: ProzessDef): ProzessVorlage {
  const w = wurzelKennung(p);
  const knoten: ProzessKnoten[] = [{ id: w, titel: p.titel, rang: 0 }];
  const freigaben: ProzessVorlage['freigaben'] = [];
  p.phasen.forEach((ph, i) => {
    knoten.push({ id: ph.id, elternId: w, titel: ph.titel, rang: i, ...(ph.abstimmung ? { freigabe: abstimmungKennung(ph.id) } : {}) });
    if (ph.abstimmung) freigaben.push({ id: abstimmungKennung(ph.id), titel: ph.abstimmung, wer: 'beide' });
    ph.schritte.forEach((s, j) => {
      const d = neinVon(ph, s.id);
      const zweige = s.form === 'entscheidung' ? { ...(s.ja ? { ja: s.ja } : {}), ...(s.nein ? { nein: s.nein } : {}) } : d && s.zurueck ? { ja: d.id } : s.ja ? { ja: s.ja } : null;
      knoten.push({ id: s.id, elternId: ph.id, titel: s.titel, rang: j, form: s.form, ...(zweige && Object.keys(zweige).length ? { zweige } : {}) });
    });
  });
  return { id: p.id, art: 'paket', titel: p.titel, knoten, uebergaenge: [], freigaben, rollen: [], fassung: 1, geaendert: '', geaendertVon: '' };
}

/** Schritte, an denen ein Weg endet — die Fläche zeichnet von dort keinen Pfeil weiter. */
export const endeSchritte = (p: ProzessDef): Set<string> => new Set(p.phasen.flatMap(ph => ph.schritte.filter(s => s.ende).map(s => s.id)));

// ── Wenig und klar (Punkt 24) ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Die Zoomstufen der Fläche — die Regel dazu steht neben der Kamera (components/os/ui/flaeche/stufe.ts). */
export type KachelStufe = 'fern' | 'mittel' | 'nah';
/**
 * Was eine Kachel der Landkarte zeigt — je Zoomstufe (Punkt 14) und nur einmal (Punkt 24): fern der kurze Titel und EINE Zahl (groß), mittel Titel + Zahl,
 * nah dazu Marke und Eigner. Der Steckbrief steht erst eine Ebene tiefer.
 */
export function kachelTexte(p: Pick<ProzessDef, 'titel' | 'quelle' | 'steckbrief'> & Partial<Pick<ProzessDef, 'produkte' | 'stellschrauben' | 'ueberfuehrung'>>, z: Zahl | undefined, stufe: KachelStufe): { titel?: string; marke?: string; eigner?: string; produkt?: string; zahl?: string; zweite?: string } {
  const t = zahlTexte(z);
  if (stufe === 'fern') return { titel: kurztitel(p.titel), ...(t?.haupt ? { zahl: t.haupt } : t?.zweite ? { zahl: t.zweite.text } : {}) };
  // Prozesse × Fulfillment (22.10.): „für <Produkt>“ — nur, wenn der Titel es nicht schon sagt (lib/prozesse/produkt-bindung.ts `produktZeile`).
  const produkt = p.produkte?.length ? produktZeile(p.titel, p.produkte) : null;
  return {
    titel: p.titel,
    ...(stufe === 'nah' ? { marke: ueberfuehrungMarke(p) ?? (p.quelle === 'system' ? systemMarke(p) : markeVon(p)), eigner: p.steckbrief.eigner } : {}),
    ...(produkt ? { produkt } : {}),
    ...(t?.haupt ? { zahl: t.haupt } : {}), ...(t?.zweite ? { zweite: t.zweite.text } : {}),
  };
}

/**
 * Die Stufe einer Kachel im Kern (Vorgabe Fulfillment) — damit eine Vorlage ohne Angabe nie verloren geht. Trägt ein Prozess einen Bereich (Etappe B:
 * gewählt je Vorlage), gilt er vor der abgeleiteten Stufe, sofern er eine Stufe der Fliege nennt — EINE Regel für Bild und Liste.
 */
export const stufeVon = (p: Pick<ProzessDef, 'stufe'> & { bereich?: unknown }): KernStufe => {
  const b = p.bereich;
  if (typeof b === 'string' && KERN_STUFEN.some(s => s.id === b)) return b as KernStufe;
  return p.stufe ?? 'fulfillment';
};
