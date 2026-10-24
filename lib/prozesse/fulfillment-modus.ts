// ─── Prozesse × Fulfillment — der Fulfillment-Modus der Werkstatt (22.10., Entscheidung: Weg A; research/prozesse/FULFILLMENT_WERKSTATT_PLAN.md) ──────
// Entscheidung 22.10.: Die Werkstatt wird DER Editor für die Pakete des Fulfillments; ausgeführt wird weiter im Fall (fall-server, `ausfuehrungSoll` …). EINE Wahrheit
// bleibt der Bestand `fulfillment--<h>` — kein zweiter Speicher, keine Kopie in `prozesse--<h>`. Diese Datei ist die reine Stelle (Server UND Browser) für:
//   · was ein Paket tragen darf       `FULFILLMENT_FORMEN` (die sechs Formen des Fall-Ausführers) und `fulfillmentModusBefunde` — jede Werkstatt-Art, die der
//                                     Fall nicht ausführen kann (Agent, Auslöser, Warten, Raute nach Regel/Score, Webhook, Schloss, Zettel, Steckbrief …), ist
//                                     ein FEHLER (nie gespeichert, nie still verworfen).
//   · der Rundweg                     `paketAlsDefinition` (das Paket, wie es ist — KnotenForm ⊂ ProzessForm) und `paketAusDefinition` (zurück über den Säuberer
//                                     des Fulfillments `vorlageAus`, mit Verlust-Wächter `feldVerluste`: geht unterwegs etwas verloren, wird abgelehnt).
//   · die Ansicht auf der Fläche      `paketAnsicht` — dieselbe Lage-Rechnung wie jeder Werkstatt-Prozess, aber aus dem Modell des Fulfillment-Editors
//                                     (`editorModell`: Phasen, Stränge und Gruppen, wirksame Formen, Abstimmungspunkte): Bahnen Kunde/Team aus `zustaendig`, der
//                                     Abstimmungspunkt als Raute am Ende seiner Phase, Lage automatisch (die freie Lage `pos` des Fulfillment-Editors meint etwas
//                                     anderes — sie bleibt im Paket unberührt). Nur gerechnet, nie gespeichert.
//   · Unterzeile und Seitenfeld       `paketUnterzeile`, `paketKnotenInfo` — Frist, Zuständig, „Kunde sieht es“, Bausteine mit der EINEN Kunden-Regel
//                                     (`fuerKundenFrei` rechnet der Server; hier kommt nur ihr Ergebnis an).
// Etappe 1 liest nur (GET /api/prozesse/werkstatt?paket=); geschrieben wird erst ab Etappe 2 — über die Schreibstelle des Fulfillments.

import type { Befund, KnotenForm, ProzessDefinition, ProzessForm, ProzessKnoten, ProzessVorlage, Zustaendig } from './definition';
import { BEREICH_VORGABE, FALL_ART_VORGABE } from './definition';
import { KNOTEN_FORMEN, vorlageAus } from '@/lib/fulfillment/lesen';
import { editorModell, FORM_TITEL, type EditorKnoten } from '@/lib/fulfillment/prozesse/editor';
import { bestaetigungTitel } from '@/lib/fulfillment/prozesse/darstellung';

type K = ProzessKnoten<ProzessForm>;

// ══ Was ein Paket tragen darf ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Die Formen, die der Fall-Ausführer kennt (lib/fulfillment/prozesse/ausfuehrung.ts) — die Palette der Werkstatt im Fulfillment-Modus. */
export const FULFILLMENT_FORMEN: readonly KnotenForm[] = KNOTEN_FORMEN;
export const istFulfillmentForm = (f: unknown): f is KnotenForm => typeof f === 'string' && (FULFILLMENT_FORMEN as readonly string[]).includes(f);

/** Felder eines Knotens, die nur die Werkstatt (der Lauf-Motor) ausführt — im Paket nie. */
export const NUR_WERKSTATT_KNOTEN = ['katalog', 'ausloeser', 'agent', 'raute', 'warten', 'schleife', 'abfrage', 'erneut', 'teilprozess', 'ende', 'schloss', 'bahn', 'deaktiviert', 'danach'] as const satisfies readonly (keyof K)[];
/** Felder einer Definition, die nur Prozesse der Werkstatt tragen. */
export const NUR_WERKSTATT_DEFINITION = ['eigner', 'laeuftAls', 'startKriterium', 'endKriterium', 'schnittstelle', 'zettel'] as const satisfies readonly (keyof ProzessDefinition)[];
const FELD_NAME: Readonly<Record<string, string>> = {
  katalog: 'Baustein aus dem Katalog', ausloeser: 'Auslöser', agent: 'Agent', raute: 'Entscheidung nach Regel bzw. Score', warten: 'Warten', schleife: 'Schleife',
  abfrage: 'CRM-Abfrage', erneut: '„Erneut ab Schritt …“', teilprozess: 'Teilprozess', ende: 'Ende', schloss: 'Freigabe-Schloss', bahn: 'Bahn einer Person', deaktiviert: 'Ausgeschalteter Schritt', danach: 'Festgelegter Ausgang („weiter bei …“ bzw. „Lauf endet“)',
  eigner: 'Eigner', laeuftAls: '„Läuft als“', startKriterium: 'Start-Kriterium', endKriterium: 'End-Kriterium', schnittstelle: 'Ein- und Ausgaben', zettel: 'Notiz-Zettel',
};
const NICHT_IM_FALL = 'gibt es im Fulfillment nicht — der Fall kann das nicht ausführen. Als Begleit-Prozess daneben bauen.';

/**
 * Darf diese Definition als Paket des Fulfillments gespeichert werden? (rein) — Befunde statt Abbruch. FEHLER: jede Form außerhalb der sechs, jedes Feld der Werkstatt
 * (Knoten und Definition), Zweige „Fehler“/„abgelaufen“, ein anderer Bereich bzw. Fall als Fulfillment/Mandat. Die Struktur (Ebenen, Bausteine, Abstimmungspunkte)
 * prüft der Server zusätzlich mit der Regel des Fulfillments (`vorlageStrukturPruefen`).
 */
export function fulfillmentModusBefunde(d: Pick<ProzessDefinition, 'knoten'> & Partial<ProzessDefinition>): Befund[] {
  const raus: Befund[] = [];
  const f = (text: string, knotenId?: string, feld?: string): void => { raus.push({ stufe: 'fehler', text, ...(knotenId ? { knotenId } : {}), ...(feld ? { feld } : {}) }); };
  if (d.bereich !== undefined && d.bereich !== BEREICH_VORGABE) f('Ein Paket des Fulfillments gehört immer zum Bereich Fulfillment.', undefined, 'bereich');
  if (d.fallArt !== undefined && d.fallArt !== FALL_ART_VORGABE) f('Ein Paket des Fulfillments läuft immer an einem Mandat.', undefined, 'fallArt');
  for (const feld of NUR_WERKSTATT_DEFINITION) {
    const w = d[feld];
    if (w !== undefined && !(Array.isArray(w) && !w.length)) f(`${FELD_NAME[feld]} ${NICHT_IM_FALL}`, undefined, feld);
  }
  for (const k of d.knoten) {
    const titel = `„${k.titel}“`;
    if (k.form !== undefined && !istFulfillmentForm(k.form)) f(`${titel}: die Form „${k.form}“ ${NICHT_IM_FALL}`, k.id, 'form');
    for (const feld of NUR_WERKSTATT_KNOTEN) if (k[feld] !== undefined) f(`${titel}: ${FELD_NAME[feld]} ${NICHT_IM_FALL}`, k.id, feld);
    if (k.zweige?.fehler || k.zweige?.abgelaufen) f(`${titel}: Fehler- bzw. Ablauf-Kanten ${NICHT_IM_FALL}`, k.id, 'zweige');
    if (k.pfeilText?.fehler || k.pfeilText?.abgelaufen) f(`${titel}: Beschriftung einer Fehler- bzw. Ablauf-Kante ${NICHT_IM_FALL}`, k.id, 'pfeilText');
  }
  return raus;
}

// ══ Der Rundweg ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Ein Paket als Definition der Werkstatt — genau so, wie es ist (die sechs Formen sind Formen der Werkstatt). Keine Kopie mit Zusätzen. */
export const paketAlsDefinition = (v: ProzessVorlage): ProzessDefinition => v;

/**
 * Was beim Weg `vorher` → `nachher` verloren ging oder sich änderte (rein): Pfade wie `knoten[fk-1].zone`. Listen aus Einträgen mit Kennung werden über die Kennung
 * verglichen (die Reihenfolge darf sich ändern), andere Listen und Werte genau. Ein Bereich „Fulfillment“ bzw. Fall „Mandat“ darf fehlen (Fehlen heißt dasselbe).
 */
export function feldVerluste(vorher: unknown, nachher: unknown, pfad = ''): string[] {
  if (vorher === undefined) return [];
  if (Array.isArray(vorher)) {
    if (!Array.isArray(nachher)) return [pfad || '(Liste)'];
    const mitId = vorher.every(x => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string');
    if (!mitId) return JSON.stringify(vorher) === JSON.stringify(nachher) ? [] : [pfad || '(Liste)'];
    const b = new Map((nachher as { id?: unknown }[]).filter(x => x && typeof x === 'object').map(x => [x.id, x] as const));
    return vorher.flatMap(x => { const id = (x as { id: string }).id; return b.has(id) ? feldVerluste(x, b.get(id), `${pfad}[${id}]`) : [`${pfad}[${id}]`]; });
  }
  if (vorher && typeof vorher === 'object') {
    if (!nachher || typeof nachher !== 'object' || Array.isArray(nachher)) return [pfad || '(Objekt)'];
    const n = nachher as Record<string, unknown>;
    return Object.entries(vorher as Record<string, unknown>).flatMap(([k, w]) => {
      if (w === undefined) return [];
      if (!pfad && ((k === 'bereich' && w === BEREICH_VORGABE) || (k === 'fallArt' && w === FALL_ART_VORGABE)) && n[k] === undefined) return [];
      return feldVerluste(w, n[k], pfad ? `${pfad}.${k}` : k);
    });
  }
  return Object.is(vorher, nachher) ? [] : [pfad || '(Wert)'];
}

export type PaketAusErgebnis = { ok: true; vorlage: ProzessVorlage } | { ok: false; befunde: Befund[] };
/**
 * Eine Definition der Werkstatt zurück als Paket (rein): erst der Fulfillment-Modus (Fehler → abgelehnt), dann der Säuberer des Fulfillments (`vorlageAus` — dieselbe
 * Regel wie beim Lesen des Bestands), dann der Verlust-Wächter: geht dabei irgendein Wert verloren, wird abgelehnt — mit dem Pfad, nie still.
 */
export function paketAusDefinition(d: ProzessDefinition): PaketAusErgebnis {
  const fehler = fulfillmentModusBefunde(d).filter(b => b.stufe === 'fehler');
  if (fehler.length) return { ok: false, befunde: fehler };
  const roh = JSON.parse(JSON.stringify({ ...d, art: 'paket' })) as Record<string, unknown>;
  const v = vorlageAus(roh);
  if (!v) return { ok: false, befunde: [{ stufe: 'fehler', text: 'Das Paket ist unlesbar (Kennung oder Titel fehlt).' }] };
  const weg = feldVerluste(roh, JSON.parse(JSON.stringify(v)));
  if (weg.length) return { ok: false, befunde: weg.slice(0, 20).map(p => ({ stufe: 'fehler' as const, text: `Das Fulfillment kann „${p}“ so nicht speichern — nichts gespeichert.`, feld: p })) };
  return { ok: true, vorlage: v };
}

// ══ Die Ansicht auf der Fläche ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Ein Baustein der Bibliothek in Kürze — `kundeFrei`/`grund` aus der EINEN Kunden-Regel (`fuerKundenFrei`, gerechnet auf dem Server). */
export interface BibliothekKurz { id: string; titel: string; art: string; kundeFrei: boolean; grund?: string }
/** Was das Seitenfeld zu einem Knoten der Ansicht zeigt (nur Anzeige). */
export interface PaketKnotenInfo {
  id: string; titel: string; art: 'schritt' | 'abstimmung';
  form: KnotenForm; formTitel: string; formGesetzt: boolean;
  phase: string; gruppe?: string;
  frist?: number; versuche?: number; zustaendig?: Zustaendig; kundeSichtbar?: boolean;
  /** Bausteine (Ebene 5) am Schritt — `knotenId` = ihr Knoten im Paket (Entfernen), `bausteinId` = der Baustein der Bibliothek. */
  bausteine: { knotenId: string; bausteinId: string; titel: string; art?: string; kundeFrei?: boolean; grund?: string }[];
  /** Zweige in Worten („ja → …“, „nein → …“). */
  zweige: string[];
  /** Am Abstimmungspunkt: wer bestätigt. */
  wer?: Zustaendig;
}
export interface PaketAnsicht {
  /** Nur zum Zeichnen (Werkstatt-Lage) — nie gespeichert. */
  definition: ProzessDefinition;
  info: Record<string, PaketKnotenInfo>;
  /** Phasen mit Abstimmungspunkt (Kennung der Raute → Freigabe-Kennung F0 …). */
  abstimmungen: Record<string, string>;
}
/** Kennung der Raute eines Abstimmungspunkts in der Ansicht (nie gespeichert). */
export const abstimmungsKnoten = (phaseId: string): string => `ab~${phaseId}`;
const WER_TEXT: Readonly<Record<Zustaendig, string>> = { intern: 'ihr bestätigt intern', kunde: 'der Kunde bestätigt', beide: 'Kunde und ihr gemeinsam' };
export const werText = (w: Zustaendig): string => WER_TEXT[w];
/** Bahn eines Schritts im Paket: Kunde, wenn der Kunde zuständig ist — sonst das Team (die zuständige Person des Mandats). */
const bahnAus = (z: Zustaendig | undefined): 'kunde' | 'mensch' => (z === 'kunde' ? 'kunde' : 'mensch');

/**
 * Das Paket als Bild der Werkstatt (rein, deterministisch): Wurzel, Phasen (Rahmen), Gruppen (benannte Teilprozesse) und Schritte aus dem Modell des Fulfillment-
 * Editors (`editorModell` — dieselben Abschnitte, Formen und Zweige wie Editor und Fall), je Phase der Abstimmungspunkt als Raute am Ende. Bausteine (Ebene 5)
 * stehen nicht als Knoten da, sondern im Seitenfeld und in der Unterzeile.
 */
export function paketAnsicht(v: ProzessVorlage, bibliothek: readonly BibliothekKurz[] = []): PaketAnsicht {
  const m = editorModell(v, bibliothek);
  const wurzel = v.knoten.find(k => !k.elternId);
  const kn: K[] = [{ id: wurzel?.id ?? v.id, titel: wurzel?.titel ?? v.titel, rang: 1 }];
  const info: Record<string, PaketKnotenInfo> = {};
  const abstimmungen: Record<string, string> = {};
  const titelVon = new Map(v.knoten.map(k => [k.id, k.titel]));
  const zweigText = (e: EditorKnoten): string[] => [
    ...(e.zweige?.ja ? [`${e.form === 'entscheidung' ? 'ja' : 'danach'} → ${titelVon.get(e.zweige.ja) ?? '…'}`] : []),
    ...(e.zweige?.nein ? [`nein → ${titelVon.get(e.zweige.nein) ?? '…'}`] : []),
  ];
  const schritt = (e: EditorKnoten, elternId: string, rang: number, phase: string, gruppe?: string): K => {
    info[e.id] = {
      id: e.id, titel: e.titel, art: 'schritt', form: e.form, formTitel: FORM_TITEL[e.form], formGesetzt: e.gesetzt, phase, ...(gruppe ? { gruppe } : {}),
      ...(e.frist !== undefined ? { frist: e.frist } : {}), ...(e.versuche !== undefined ? { versuche: e.versuche } : {}),
      ...(e.zustaendig ? { zustaendig: e.zustaendig } : {}), ...(e.kundeSichtbar !== undefined ? { kundeSichtbar: e.kundeSichtbar } : {}),
      bausteine: e.bausteine.map(b => { const x = bibliothek.find(y => y.id === b.bausteinId); return { knotenId: b.knotenId, bausteinId: b.bausteinId, titel: b.titel, ...(b.art ? { art: b.art } : {}), ...(x ? { kundeFrei: x.kundeFrei, ...(x.grund ? { grund: x.grund } : {}) } : {}) }; }),
      zweige: zweigText(e),
    };
    return {
      id: e.id, elternId, titel: e.titel, rang, form: e.form, bahn: bahnAus(e.zustaendig),
      ...(e.zweige?.ja || e.zweige?.nein ? { zweige: { ...(e.zweige.ja ? { ja: e.zweige.ja } : {}), ...(e.zweige.nein ? { nein: e.zweige.nein } : {}) } } : {}),
    };
  };
  for (const p of m.phasen) {
    kn.push({ id: p.id, elternId: kn[0].id, titel: p.titel, rang: p.nr });
    let rang = 0;
    for (const a of p.abschnitte) {
      if (!a.knoten.length) continue; // eine leere Gruppe wäre auf der Fläche ein Schritt — sie zeigt nichts
      if (a.art === 'gruppe' && a.gruppeId) {
        kn.push({ id: a.gruppeId, elternId: p.id, titel: a.titel ?? '', rang: ++rang });
        a.knoten.forEach((e, i) => kn.push(schritt(e, a.gruppeId!, i + 1, p.titel, a.titel)));
      } else for (const e of a.knoten) kn.push(schritt(e, p.id, ++rang, p.titel));
    }
    if (p.abstimmung) {
      const id = abstimmungsKnoten(p.id);
      const titel = bestaetigungTitel(p.abstimmung.nr, p.abstimmung.titel || undefined);
      abstimmungen[id] = p.abstimmung.id;
      kn.push({ id, elternId: p.id, titel, rang: ++rang, form: 'abstimmung', bahn: p.abstimmung.wer === 'intern' ? 'mensch' : 'kunde' });
      info[id] = { id, titel, art: 'abstimmung', form: 'abstimmung', formTitel: FORM_TITEL.abstimmung, formGesetzt: true, phase: p.titel, bausteine: [], zweige: [], wer: p.abstimmung.wer };
    }
  }
  const definition: ProzessDefinition = { id: v.id, art: 'paket', titel: v.titel, knoten: kn, uebergaenge: [], freigaben: [], rollen: [], fassung: v.fassung, geaendert: v.geaendert, geaendertVon: v.geaendertVon };
  return { definition, info, abstimmungen };
}

/** Die Zeile unter einem Knoten der Ansicht: „Frist 5 T. · Kunde sieht es · 2 Bausteine“ (jede Angabe nur, wenn es sie gibt). */
export function paketUnterzeile(i: PaketKnotenInfo | undefined): string {
  if (!i) return '';
  if (i.art === 'abstimmung') return i.wer ? werText(i.wer) : '';
  const teile = [
    i.frist !== undefined ? `Frist ${i.frist} T.` : '',
    i.zustaendig === 'kunde' ? 'der Kunde ist dran' : i.zustaendig === 'beide' ? 'gemeinsam' : '',
    i.kundeSichtbar ? 'Kunde sieht es' : '',
    i.bausteine.length ? (i.bausteine.length === 1 ? '1 Baustein' : `${i.bausteine.length} Bausteine`) : '',
  ];
  return teile.filter(Boolean).join(' · ');
}

/** Die Zeilen des Seitenfelds (Beschriftung → Wert) — nur, was es gibt. */
export function paketKnotenZeilen(i: PaketKnotenInfo): { name: string; wert: string }[] {
  const z: { name: string; wert: string }[] = [{ name: 'Form', wert: i.formGesetzt ? i.formTitel : `${i.formTitel} (abgeleitet)` }, { name: 'Phase', wert: i.gruppe ? `${i.phase} › ${i.gruppe}` : i.phase }];
  if (i.art === 'abstimmung') { if (i.wer) z.push({ name: 'Wer bestätigt', wert: werText(i.wer) }); return z; }
  if (i.frist !== undefined) z.push({ name: 'Frist', wert: `${i.frist} Tage ab Ankunft` });
  if (i.versuche !== undefined) z.push({ name: 'Versuche', wert: String(i.versuche) });
  z.push({ name: 'Zuständig', wert: i.zustaendig === 'kunde' ? 'Kunde' : i.zustaendig === 'beide' ? 'Kunde und Team' : 'Team' });
  z.push({ name: 'Kunde sieht es', wert: i.kundeSichtbar ? 'ja' : 'nein' });
  for (const t of i.zweige) z.push({ name: 'Weg', wert: t });
  return z;
}
