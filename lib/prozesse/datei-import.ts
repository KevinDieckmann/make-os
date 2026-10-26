// ─── Prozesse — Werkstatt-Prozesse als Datei: sichern und importieren (26.10., Bauplan „Import für Werkstatt-Prozesse“) ──────────────────────────────────
// Ein Prozess der Werkstatt (Auslöser, Agenten, Mails, Rauten …) kommt per Datei rein — Vorschau, dann als ENTWURF angelegt (nie veröffentlicht, nie scharf).
// Format `make-os/prozess`: `{ format, fassung: 1, prozesse: [ <Definition> ] }` — genau das, was „Als Datei sichern“ schreibt (`prozessAlsDatei`). Gelesen
// werden auch eine einzelne Definition (`{ titel, knoten, … }`), eine Liste davon und eine eigene Vorlage (`{ definition }`).
// Kennungen der Datei dürfen lesbar sein („s-kick-off“) — jeder Prozess bekommt NEUE Kennungen (`mitNeuenKnoten`: Zweige, „weiter bei“, „erneut ab“, Schlösser,
// Masken folgen). Personen- und Fall-Daten fallen weg wie bei den eigenen Vorlagen (`ohnePersonen`: Eigner, „läuft als“, Personen in Masken → „Zuständig im Fall“).
// Geprüft wie jeder Entwurf (`definitionPruefen` + Freigabe-Schlösser nach der EINEN Regel); ein Fehler, der das Speichern sperrt, blockiert die ganze Datei —
// alles oder nichts, nie still gekürzt (Grenzen → 413). Rein und client-sicher; die Route (app/api/prozesse/werkstatt) schreibt in EINER Sperre.

import {
  BEREICH_IDS, FALL_ART_IDS, PROZESS_BEREICHE, FALL_ARTEN, PROZESS_GRENZEN, PROZESS_TEXT,
  type Befund, type ProzessDefinition, type ProzessEintrag, type ProzesseDatei,
} from './definition';
import { definitionAus } from './bestand';
import { definitionPruefen, laufFremd, sperrtSpeichern, type PruefKontext } from './definition-pruefen';
import { schlossSetzen } from './schloss';
import { mitNeuenKnoten, ohnePersonen } from './kopie';
import { alleSchritte } from './fluss';
import type { ProzessRechte } from './rollen';

export const PROZESS_DATEI_FORMAT = 'make-os/prozess';
/** Höchstens so viele Prozesse je Datei bzw. Bytes — darüber wird abgelehnt (413), nie gekürzt. */
export const PROZESS_DATEI_GRENZEN = { prozesse: 10, bytes: 2 * 1024 * 1024 } as const;

type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);

/** Eine Datei, wie „Als Datei sichern“ sie schreibt. */
export interface ProzessDatei { format: typeof PROZESS_DATEI_FORMAT; fassung: 1; prozesse: ProzessDefinition[] }

/** Einen Prozess als Datei (rein): der Entwurf ohne Personen- und Fall-Daten — die Kennungen bleiben (beim Import gibt es ohnehin neue). */
export function prozessAlsDatei(e: Pick<ProzessEintrag, 'entwurf'>): { datei: ProzessDatei; hinweise: string[] } {
  const o = ohnePersonen(e.entwurf);
  const { herkunft: _h, ...d } = o.definition;
  return { datei: { format: PROZESS_DATEI_FORMAT, fassung: 1, prozesse: [d as ProzessDefinition] }, hinweise: o.hinweise };
}
/** Dateiname zum Sichern: aus dem Titel, nur Buchstaben, Ziffern und Bindestriche. */
export function prozessDateiName(titel: string): string {
  const s = titel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `prozess-${s || 'ohne-namen'}.json`;
}

/** Wie ein Prozess der Datei in der Vorschau steht. */
export interface ProzessDateiVorschau {
  nr: number; titel: string; bereich: string; fallArt: string;
  /** Schritte ohne Auslöser, Ende und Schlösser. */
  schritte: number; ausloeser: string[]; agenten: number;
  befunde: Befund[]; hinweise: string[];
  /** Ein Fehler sperrt das Speichern — dann blockiert die Datei. */
  sperrt: boolean;
}
export type ProzessDateiGelesen =
  | { ok: true; prozesse: { definition: ProzessDefinition; vorschau: ProzessDateiVorschau }[] }
  | { ok: false; status: 400 | 413; fehler: string };

/** Die Definitionen einer Datei in jeder erlaubten Form (rein). */
function definitionenAus(roh: unknown): unknown[] | null {
  if (Array.isArray(roh)) return roh;
  const o = obj(roh);
  if (!o) return null;
  if (Array.isArray(o.prozesse)) return o.prozesse;
  if (obj(o.definition)) return [o.definition];
  if (Array.isArray(o.knoten)) return [o];
  return null;
}

const AUSLOESER_NAME: Readonly<Record<string, string>> = { ereignis: 'Ereignis', zeitplan: 'Zeitplan', datum: 'Datum', hand: 'von Hand', webhook: 'Webhook', loop: 'Loop', person: 'Person' };

/**
 * Eine Datei lesen (rein): je Prozess neue Kennungen, ohne Personen, mit Schlössern, geprüft. Wirft nie. `neueKennung` liefert `pz-<uuid>` bzw. `fk-<uuid>`.
 */
export function prozessDateiLesen(roh: unknown, kx: { neueKennung: (p: 'pz' | 'fk') => string; pruef?: PruefKontext }): ProzessDateiGelesen {
  const liste = definitionenAus(roh);
  if (!liste) return { ok: false, status: 400, fehler: 'Keine Prozess-Datei: erwartet { format: "make-os/prozess", prozesse: [ … ] } oder einen Prozess mit „knoten“.' };
  const o = obj(roh);
  if (o?.format !== undefined && o.format !== PROZESS_DATEI_FORMAT) return { ok: false, status: 400, fehler: `Unbekanntes Format „${String(o.format)}“ — die Werkstatt liest „${PROZESS_DATEI_FORMAT}“. (Pakete des Fulfillments importiert ihr unter Fulfillment › Import.)` };
  if (!liste.length) return { ok: false, status: 400, fehler: 'Die Datei enthält keinen Prozess.' };
  if (liste.length > PROZESS_DATEI_GRENZEN.prozesse) return { ok: false, status: 413, fehler: `${liste.length} Prozesse — höchstens ${PROZESS_DATEI_GRENZEN.prozesse} je Datei. Nichts übernommen.` };
  const raus: { definition: ProzessDefinition; vorschau: ProzessDateiVorschau }[] = [];
  for (const [i, x] of liste.entries()) {
    const r = obj(x);
    if (!r) return { ok: false, status: 400, fehler: `Prozess ${i + 1} ist kein Objekt.` };
    const knoten = Array.isArray(r.knoten) ? r.knoten : null;
    if (!knoten?.length) return { ok: false, status: 400, fehler: `Prozess ${i + 1}: „knoten“ fehlt oder ist leer.` };
    const wurzel = knoten.map(obj).find(k => k && !k.elternId);
    const titel = (typeof r.titel === 'string' && r.titel.trim()) || (typeof wurzel?.titel === 'string' ? wurzel.titel.trim() : '');
    // Der Säuberer der Werkstatt braucht eine Kennung — die echte entsteht gleich neu.
    const d0 = definitionAus({ ...r, id: 'pz-datei', titel, art: 'paket' });
    if (!d0) return { ok: false, status: 400, fehler: `Prozess ${i + 1}: unlesbar (Titel fehlt).` };
    const verloren = knoten.length - d0.knoten.length;
    if (verloren > 0) return { ok: false, status: 400, fehler: `„${titel || `Prozess ${i + 1}`}“: ${verloren} Knoten ohne Kennung oder Titel — so nicht übernehmbar. Nichts übernommen.` };
    const neu = mitNeuenKnoten(d0, { id: kx.neueKennung('pz'), neu: () => kx.neueKennung('fk') }).definition;
    const ohne = ohnePersonen(neu);
    const { herkunft: _h, ...ohneHerkunft } = ohne.definition;
    const mitSchloss = schlossSetzen(ohneHerkunft as ProzessDefinition, { ...(kx.pruef ?? {}), laufFremd: laufFremd(ohneHerkunft) }).definition;
    const befunde = definitionPruefen(mitSchloss, kx.pruef ?? {});
    const schritte = alleSchritte(mitSchloss).map(s => s.schritt);
    raus.push({
      definition: mitSchloss,
      vorschau: {
        nr: i + 1, titel: mitSchloss.titel || '(ohne Namen)',
        bereich: PROZESS_BEREICHE.find(b => b.id === mitSchloss.bereich)?.titel ?? (BEREICH_IDS.includes(mitSchloss.bereich as never) ? String(mitSchloss.bereich) : 'Fulfillment'),
        fallArt: FALL_ARTEN.find(f => f.id === mitSchloss.fallArt)?.titel ?? (FALL_ART_IDS.includes(mitSchloss.fallArt as never) ? String(mitSchloss.fallArt) : 'Mandat'),
        schritte: schritte.filter(s => s.form !== 'ausloeser' && s.form !== 'ende' && s.form !== 'freigabe').length,
        ausloeser: schritte.filter(s => s.form === 'ausloeser').map(s => AUSLOESER_NAME[s.ausloeser?.art ?? ''] ?? 'Auslöser'),
        agenten: schritte.filter(s => s.form === 'agent').length,
        befunde, hinweise: ohne.hinweise, sperrt: sperrtSpeichern(befunde),
      },
    });
  }
  return { ok: true, prozesse: raus };
}

export type ProzessDateiErgebnis =
  | { ok: true; datei: ProzesseDatei; angelegt: { id: string; titel: string }[]; hinweise: string[] }
  | { ok: false; status: 400 | 403 | 413; fehler: string; vorschau?: ProzessDateiVorschau[] };

/**
 * Eine Datei übernehmen (rein): jeder Prozess als Entwurf (Herkunft „import“ mit dem Dateinamen). Alles oder nichts: sperrt einer, wird nichts angelegt.
 */
export function prozessDateiAnwenden(
  datei: ProzesseDatei, roh: unknown,
  kx: { person: string; jetzt: string; rechte: ProzessRechte; dateiName?: string; neueKennung: (p: 'pz' | 'fk') => string; pruef?: PruefKontext },
): ProzessDateiErgebnis {
  if (!kx.rechte.entwurf) return { ok: false, status: 403, fehler: 'Prozesse bauen nur Personen im Haushalt.' };
  const g = prozessDateiLesen(roh, kx);
  if (!g.ok) return g;
  const sperrt = g.prozesse.filter(p => p.vorschau.sperrt);
  if (sperrt.length) {
    const b = sperrt[0].vorschau;
    return { ok: false, status: 400, fehler: `„${b.titel}“: ${b.befunde.find(x => x.stufe === 'fehler')?.text ?? 'nicht speicherbar'} — nichts übernommen.`, vorschau: g.prozesse.map(p => p.vorschau) };
  }
  if (datei.prozesse.length + g.prozesse.length > PROZESS_GRENZEN.prozesse) return { ok: false, status: 413, fehler: `Höchstens ${PROZESS_GRENZEN.prozesse} Prozesse — nichts übernommen.` };
  const name = kx.dateiName && /^[\w .()-]{1,120}$/.test(kx.dateiName) ? kx.dateiName : undefined;
  // Gibt es den Namen schon (z. B. die eigene Datei wieder eingespielt), heißt der neue „<Name> (Import)“ — zwei gleiche Namen in der Liste verwechselt man.
  const namen = new Set(datei.prozesse.map(p => p.entwurf.titel.trim().toLowerCase()));
  const neu: ProzessEintrag[] = g.prozesse.map(({ definition }) => {
    const doppelt = namen.has(definition.titel.trim().toLowerCase()) && `${definition.titel} (Import)`.length <= PROZESS_TEXT.titel;
    const titel = doppelt ? `${definition.titel} (Import)` : definition.titel;
    namen.add(titel.trim().toLowerCase());
    const knoten = doppelt ? definition.knoten.map(k => (k.elternId ? k : { ...k, titel })) : definition.knoten;
    const d: ProzessDefinition = { ...definition, titel, knoten, fassung: 1, geaendert: kx.jetzt, geaendertVon: kx.person, herkunft: { art: 'import', ...(name ? { datei: name } : {}), am: kx.jetzt } };
    return { id: d.id, entwurf: d, versionen: [], status: 'entwurf', angelegtAm: kx.jetzt, angelegtVon: kx.person, entwurfAm: kx.jetzt, entwurfVon: kx.person };
  });
  const hinweise = Array.from(new Set(g.prozesse.flatMap(p => p.vorschau.hinweise)));
  hinweise.push('Die Prozesse stehen als Entwurf bereit — ohne Eigner. Im Steckbrief eine Person wählen, offene Punkte erledigen, dann veröffentlichen und den Probelauf starten.');
  return { ok: true, datei: { ...datei, prozesse: [...datei.prozesse, ...neu] }, angelegt: neu.map(e => ({ id: e.id, titel: e.entwurf.titel })), hinweise };
}
