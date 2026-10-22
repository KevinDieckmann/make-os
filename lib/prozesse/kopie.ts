// ─── Prozesse — kopieren und als eigene Vorlage speichern (22.10.; nach dem Demo-Rundgang: „alles muss anpassbar sein und immer wieder zu bearbeiten“) ──
// Drei Wege, alle rein und alles oder nichts (die Route schreibt in EINER Sperre, einmalig über `anfrageId`):
//   · `prozessKopieren` — ein Prozess als neuer Prozess: der Entwurf (das, was die Werkstatt zeigt) mit NEUEN Kennungen (`pz-<uuid>`, `fk-<uuid>`, Schlösser nach
//     der EINEN Regel `schlossKennung`); Verweise innen (Zweige, Schlösser, „erneut ab“, `abfrage:<Knoten>`, Werte der Masken, die auf einen Schritt zeigen)
//     zeigen auf die neuen, Verweise auf ANDERE Prozesse (Teilprozess, Schleife, Übergabe) bleiben. Herkunft „hand“ mit der Kennung des Originals.
//   · `alsEigeneVorlage` — Struktur und Texte als Vorlage des Haushalts (Bestand `prozess-vorlagen--<h>`) — OHNE Personen- und Fall-Daten wie die Vorlagen der
//     Kundengewinnung: kein Eigner, kein „läuft als“, Personen in Masken → Rolle „Zuständig im Fall“, Konten (Telegram) leer, eigenes Postfach → Postfach des
//     Laufs, Zettel ohne Verfasser, keine Versionen, keine Läufe, keine Testfälle, kein Webhook.
//   · `ausEigenerVorlage` — eine eigene Vorlage übernehmen (Galerie „Eigene Vorlagen“): neue Kennungen, Eigner aus dem Fenster, Herkunft „muster“ mit der
//     Kennung der Vorlage (Galerie: „schon übernommen“).
// Kopie und Übernahme landen wie „Aus Vorlage“: ohne offene Punkte und mit dem Recht dazu als Version 1 im Probelauf (schreibt nie), sonst als Entwurf — nie
// scharf. Rein und client-sicher; Tests: tests/prozesse-versionen-kopie.test.ts.

import {
  BEREICH_IDS, FALL_ART_IDS, PROZESS_GRENZEN, PROZESS_TEXT,
  type Befund, type FallArt, type MaskenWert, type ProzessBereich, type ProzessDefinition, type ProzessEintrag, type ProzessForm, type ProzessKnoten, type ProzesseDatei,
} from './definition';
import { definitionAus } from './bestand';
import { definitionPruefen, laufFremd, sperrtSpeichern, sperrtVeroeffentlichen, type PruefKontext } from './definition-pruefen';
import { schlossKennung, schlossSetzen } from './schloss';
import { veroeffentlichen } from './versionen';
import { katalogEintrag, POSTFACH_WERTE, POSTFACH_DES_LAUFS, ROLLE_ZUSTAENDIG } from './baustein-katalog';
import { alleSchritte } from './fluss';
import type { ProzessRechte } from './rollen';

type K = ProzessKnoten<ProzessForm>;
type O = Record<string, unknown>;
const obj = (v: unknown): O | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : null);

/** Eigene Vorlage `ev-<uuid>`. */
export const EIGENE_VORLAGE = /^ev-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Grenzen der eigenen Vorlagen (darüber 413 — nie gekürzt). */
export const EIGENE_VORLAGEN_GRENZE = 50;

/** Eine eigene Vorlage des Haushalts. */
export interface EigeneVorlage {
  id: string; titel: string; beschreibung?: string; bereich: ProzessBereich; fallArt: FallArt;
  /** Struktur und Texte (Kennung = die der Vorlage) — ohne Personen, ohne Fall-Daten. */
  definition: ProzessDefinition;
  angelegtAm: string; angelegtVon: string;
  /** Aus welchem Prozess (nur Kennung). */
  quelle?: string;
}
export interface EigeneVorlagenDatei { v: 1; vorlagen: EigeneVorlage[] }
export const leereEigeneVorlagen = (): EigeneVorlagenDatei => ({ v: 1, vorlagen: [] });

/** Den Bestand `prozess-vorlagen--<h>` säubern (rein, schreibt nie; Unlesbares fällt weg, doppelte Kennungen: die erste gilt, nie gekürzt). */
export function eigeneVorlagenAus(roh: unknown): EigeneVorlagenDatei {
  const o = obj(roh);
  if (!o || !Array.isArray(o.vorlagen)) return leereEigeneVorlagen();
  const l: EigeneVorlage[] = [];
  for (const x of o.vorlagen) {
    const v = obj(x);
    const id = typeof v?.id === 'string' && EIGENE_VORLAGE.test(v.id) ? v.id : undefined;
    const d = obj(v?.definition) ? definitionAus(v!.definition as O) : null;
    if (!v || !id || !d || d.id !== id || typeof v.titel !== 'string' || !v.titel.trim() || l.some(y => y.id === id)) continue;
    const bereich = (BEREICH_IDS as readonly string[]).includes(String(v.bereich)) ? v.bereich as ProzessBereich : d.bereich ?? 'fulfillment';
    const fallArt = (FALL_ART_IDS as readonly string[]).includes(String(v.fallArt)) ? v.fallArt as FallArt : d.fallArt ?? 'mandat';
    l.push({
      id, titel: v.titel.trim(), ...(typeof v.beschreibung === 'string' && v.beschreibung.trim() ? { beschreibung: v.beschreibung.trim() } : {}), bereich, fallArt, definition: d,
      angelegtAm: typeof v.angelegtAm === 'string' ? v.angelegtAm : '', angelegtVon: typeof v.angelegtVon === 'string' ? v.angelegtVon : '',
      ...(typeof v.quelle === 'string' && /^pz-[0-9a-f-]{36}$/.test(v.quelle) ? { quelle: v.quelle } : {}),
    });
  }
  return { v: 1, vorlagen: l };
}

// ── Neue Kennungen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Eine Definition mit neuen Kennungen (rein): jeder Knoten `neu()` (Schlösser nach der Regel aus ihrem neuen Knoten), Zettel neu; Verweise innen folgen, Verweise auf
 * andere Prozesse bleiben. `karte` = alte → neue Kennung (für Tests und Hinweise).
 */
export function mitNeuenKnoten(d: ProzessDefinition, a: { id: string; neu: () => string }): { definition: ProzessDefinition; karte: Map<string, string> } {
  const karte = new Map<string, string>();
  for (const k of d.knoten) if (!k.schloss) karte.set(k.id, a.neu());
  for (const k of d.knoten) if (k.schloss) karte.set(k.id, schlossKennung(karte.get(k.schloss.fuer) ?? k.schloss.fuer));
  const m = (x: string | undefined): string | undefined => (x ? karte.get(x) ?? x : x);
  const wert = (w: MaskenWert): MaskenWert => {
    if (typeof w !== 'string') return w;
    if (karte.has(w)) return karte.get(w)!;
    if (w.startsWith('abfrage:') && karte.has(w.slice(8))) return `abfrage:${karte.get(w.slice(8))}`;
    return w;
  };
  const knoten: K[] = d.knoten.map(k => {
    const n: K = { ...k, id: m(k.id)! };
    if (k.elternId) n.elternId = m(k.elternId);
    if (k.phaseId && karte.has(k.phaseId)) n.phaseId = karte.get(k.phaseId);
    if (k.zweige) n.zweige = Object.fromEntries(Object.entries(k.zweige).map(([z, v]) => [z, m(v)])) as K['zweige'];
    if (k.schloss) n.schloss = { ...k.schloss, fuer: m(k.schloss.fuer)! };
    if (k.erneut) n.erneut = { ...k.erneut, ab: m(k.erneut.ab)! };
    if (k.schleife) n.schleife = { ...k.schleife, liste: k.schleife.liste.startsWith('abfrage:') ? `abfrage:${m(k.schleife.liste.slice(8))}` : k.schleife.liste };
    if (k.katalog?.werte) n.katalog = { ...k.katalog, werte: Object.fromEntries(Object.entries(k.katalog.werte).map(([f, w]) => [f, wert(w)])) };
    return n;
  });
  const zettel = d.zettel?.map(z => ({ ...z, id: a.neu() }));
  return { definition: { ...d, id: a.id, knoten, ...(zettel ? { zettel } : {}) }, karte };
}

// ── Ohne Personen- und Fall-Daten ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Struktur und Texte ohne Personen (rein): Eigner, „läuft als“, Verfasser der Zettel, Zeitstempel und Herkunft fallen weg; in den Masken wird eine Person des Teams
 * zur Rolle „Zuständig im Fall“, ein Konto (Telegram) leer, ein eigenes Postfach das „Postfach des Laufs“. `hinweise` sagt, was ersetzt wurde.
 */
export function ohnePersonen(d: ProzessDefinition): { definition: ProzessDefinition; hinweise: string[] } {
  const hinweise = new Set<string>();
  const knoten: K[] = d.knoten.map(k => {
    const e = katalogEintrag(k.katalog?.id);
    if (!e || !k.katalog?.werte) return k;
    const werte: Record<string, MaskenWert> = {};
    for (const [f, w] of Object.entries(k.katalog.werte)) {
      const feld = e.maske.find(x => x.id === f);
      if (feld?.quelle === 'team-person' && typeof w === 'string' && !w.startsWith('rolle:')) { werte[f] = ROLLE_ZUSTAENDIG; hinweise.add('Personen in Schritten stehen als „Zuständig im Fall“.'); continue; }
      if (feld?.quelle === 'konto-person') { hinweise.add('Empfänger von Telegram-Hinweisen sind leer — beim Übernehmen wählen.'); continue; }
      if (feld?.quelle === 'postfach' && typeof w === 'string' && !POSTFACH_WERTE.some(p => p.id === w)) { werte[f] = POSTFACH_DES_LAUFS; hinweise.add('Postfächer stehen als „Business-Postfach der Person des Laufs“.'); continue; }
      werte[f] = w;
    }
    return { ...k, katalog: Object.keys(werte).length ? { ...k.katalog, werte } : { id: k.katalog.id } };
  });
  const { eigner: _e, laeuftAls: _l, herkunft: _h, ...rest } = d;
  const zettel = d.zettel?.map(({ von: _v, am: _a, ...z }) => z);
  return { definition: { ...rest, knoten, ...(zettel ? { zettel } : {}), geaendert: '', geaendertVon: '', fassung: 1 }, hinweise: [...hinweise] };
}

// ── Anlegen (Kopie, eigene Vorlage übernehmen) ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KopieKontext {
  person: string; jetzt: string; rechte: ProzessRechte;
  /** Neue Kennung (`pz-<uuid>`, `fk-<uuid>`, `ev-<uuid>`). */
  neueKennung: (praefix: 'pz' | 'fk' | 'ev') => string;
  pruef?: PruefKontext;
}
export type AnlegenErgebnis =
  | { ok: true; datei: ProzesseDatei; eintrag: ProzessEintrag; befunde: Befund[]; probelauf: boolean; hinweise: string[] }
  | { ok: false; status: 400 | 403 | 404 | 413; fehler: string; befunde?: Befund[] };

/** Einen neuen Eintrag anlegen (rein): prüfen (Fehler → 400), ohne Offenes und mit dem Recht dazu Version 1 + Probelauf, sonst Entwurf. */
function anlegenAus(datei: ProzesseDatei, d: ProzessDefinition, kx: KopieKontext, version: { name: string; notiz: string }): AnlegenErgebnis {
  if (datei.prozesse.length >= PROZESS_GRENZEN.prozesse) return { ok: false, status: 413, fehler: `Höchstens ${PROZESS_GRENZEN.prozesse} Prozesse — nichts angelegt.` };
  const mitSchloss = schlossSetzen(d, { ...(kx.pruef ?? {}), laufFremd: laufFremd(d) }).definition;
  const befunde = definitionPruefen(mitSchloss, kx.pruef ?? {});
  if (sperrtSpeichern(befunde)) return { ok: false, status: 400, fehler: befunde.find(b => b.stufe === 'fehler')?.text ?? 'Nicht speicherbar.', befunde };
  const e: ProzessEintrag = { id: d.id, entwurf: mitSchloss, versionen: [], status: 'entwurf', angelegtAm: kx.jetzt, angelegtVon: kx.person, entwurfAm: kx.jetzt, entwurfVon: kx.person };
  const hinweise: string[] = [];
  let eintrag = e;
  let probelauf = false;
  if (kx.rechte.veroeffentlichen && kx.rechte.status && !sperrtVeroeffentlichen(befunde)) {
    const v = veroeffentlichen(e, { name: version.name, notiz: version.notiz, von: kx.person, jetzt: kx.jetzt });
    if (v.ok) { eintrag = { ...v.eintrag, status: 'probelauf', statusAm: kx.jetzt, statusVon: kx.person }; probelauf = true; }
  }
  if (!kx.rechte.veroeffentlichen) hinweise.push('Veröffentlichen und Probelauf gibt es nur für volle Mitglieder — der Prozess steht als Entwurf bereit.');
  else if (!probelauf) hinweise.push('Noch offen — erst diese Punkte erledigen, dann veröffentlichen und den Probelauf starten.');
  return { ok: true, datei: { ...datei, prozesse: [...datei.prozesse, eintrag] }, eintrag, befunde, probelauf, hinweise };
}

/** Den Titel einer Kopie (rein): „<Titel> (Kopie)“, solange er passt — sonst der Titel selbst (nie gekürzt). */
export const kopieTitel = (t: string): string => (`${t} (Kopie)`.length <= PROZESS_TEXT.titel ? `${t} (Kopie)` : t);

/** Einen Prozess kopieren (rein; siehe Kopf). Unbekannt → 404, ohne Recht → 403, Grenze → 413. */
export function prozessKopieren(datei: ProzesseDatei, quelleId: unknown, kx: KopieKontext): AnlegenErgebnis {
  if (!kx.rechte.entwurf) return { ok: false, status: 403, fehler: 'Prozesse bauen nur Personen im Haushalt.' };
  const q = datei.prozesse.find(p => p.id === quelleId);
  if (!q) return { ok: false, status: 404, fehler: 'Diesen Prozess gibt es nicht (mehr).' };
  const id = kx.neueKennung('pz');
  const { definition } = mitNeuenKnoten(q.entwurf, { id, neu: () => kx.neueKennung('fk') });
  const titel = kopieTitel(q.entwurf.titel);
  const knoten = definition.knoten.map(k => (k.elternId ? k : { ...k, titel }));
  const zettel = definition.zettel?.map(z => ({ ...z, von: kx.person, am: kx.jetzt }));
  const d: ProzessDefinition = {
    ...definition, titel, knoten, ...(zettel ? { zettel } : {}), fassung: 1, geaendert: kx.jetzt, geaendertVon: kx.person,
    herkunft: { art: 'hand', quelleIds: [q.id], am: kx.jetzt },
  };
  return anlegenAus(datei, d, kx, { name: 'Kopie', notiz: `Kopie von „${q.entwurf.titel}“.` });
}

/** Wie eine eigene Vorlage in der Galerie steht (Kurzform, ohne Definition). */
export interface EigeneVorlageKurz { id: string; titel: string; beschreibung?: string; bereich: ProzessBereich; fallArt: FallArt; schritte: number; angelegtAm: string }
export const eigeneVorlageKurz = (v: EigeneVorlage): EigeneVorlageKurz => ({
  id: v.id, titel: v.titel, ...(v.beschreibung ? { beschreibung: v.beschreibung } : {}), bereich: v.bereich, fallArt: v.fallArt, angelegtAm: v.angelegtAm,
  schritte: alleSchritte(v.definition).filter(x => x.schritt.form !== 'ausloeser' && x.schritt.form !== 'ende' && x.schritt.form !== 'freigabe').length,
});

/** Einen Prozess als eigene Vorlage speichern (rein; siehe Kopf). Titel Pflicht, Grenzen → 413. */
export function alsEigeneVorlage(vorlagen: EigeneVorlagenDatei, prozesse: ProzesseDatei, a: { id: unknown; titel?: unknown; beschreibung?: unknown }, kx: KopieKontext):
  { ok: true; datei: EigeneVorlagenDatei; vorlage: EigeneVorlage; hinweise: string[] } | { ok: false; status: 400 | 403 | 404 | 413; fehler: string } {
  if (!kx.rechte.entwurf) return { ok: false, status: 403, fehler: 'Prozesse bauen nur Personen im Haushalt.' };
  const q = prozesse.prozesse.find(p => p.id === a.id);
  if (!q) return { ok: false, status: 404, fehler: 'Diesen Prozess gibt es nicht (mehr).' };
  const titel = typeof a.titel === 'string' && a.titel.trim() ? a.titel.trim() : q.entwurf.titel.trim();
  if (!titel) return { ok: false, status: 400, fehler: 'Die Vorlage braucht einen Namen.' };
  if (titel.length > PROZESS_TEXT.titel) return { ok: false, status: 413, fehler: `Name höchstens ${PROZESS_TEXT.titel} Zeichen — nichts gespeichert.` };
  const beschreibung = typeof a.beschreibung === 'string' && a.beschreibung.trim() ? a.beschreibung.trim() : q.entwurf.beschreibung;
  if (beschreibung && beschreibung.length > PROZESS_TEXT.beschreibung) return { ok: false, status: 413, fehler: `Beschreibung höchstens ${PROZESS_TEXT.beschreibung} Zeichen — nichts gespeichert.` };
  if (vorlagen.vorlagen.length >= EIGENE_VORLAGEN_GRENZE) return { ok: false, status: 413, fehler: `Höchstens ${EIGENE_VORLAGEN_GRENZE} eigene Vorlagen — erst eine löschen. Nichts gespeichert.` };
  const id = kx.neueKennung('ev');
  const neu = mitNeuenKnoten(q.entwurf, { id, neu: () => kx.neueKennung('fk') });
  const ohne = ohnePersonen(neu.definition);
  const knoten = ohne.definition.knoten.map(k => (k.elternId ? k : { ...k, titel }));
  const d: ProzessDefinition = { ...ohne.definition, titel, knoten, ...(beschreibung ? { beschreibung } : {}) };
  const vorlage: EigeneVorlage = {
    id, titel, ...(beschreibung ? { beschreibung } : {}), bereich: d.bereich ?? 'fulfillment', fallArt: d.fallArt ?? 'mandat', definition: d,
    angelegtAm: kx.jetzt, angelegtVon: kx.person, quelle: q.id,
  };
  return { ok: true, datei: { ...vorlagen, vorlagen: [...vorlagen.vorlagen, vorlage] }, vorlage, hinweise: ohne.hinweise };
}

/** Eine eigene Vorlage übernehmen (rein; siehe Kopf). Eigner = eine Person des Teams (vorher geprüft) oder offen. */
export function ausEigenerVorlage(prozesse: ProzesseDatei, v: EigeneVorlage | null, kx: KopieKontext & { eigner?: string }): AnlegenErgebnis {
  if (!kx.rechte.entwurf) return { ok: false, status: 403, fehler: 'Prozesse bauen nur Personen im Haushalt.' };
  if (!v) return { ok: false, status: 404, fehler: 'Diese Vorlage gibt es nicht (mehr).' };
  const id = kx.neueKennung('pz');
  const { definition } = mitNeuenKnoten(v.definition, { id, neu: () => kx.neueKennung('fk') });
  const zettel = definition.zettel?.map(z => ({ ...z, von: kx.person, am: kx.jetzt }));
  const d: ProzessDefinition = {
    ...definition, ...(zettel ? { zettel } : {}), fassung: 1, geaendert: kx.jetzt, geaendertVon: kx.person, ...(kx.eigner ? { eigner: kx.eigner } : {}),
    herkunft: { art: 'muster', quelleIds: [v.id], am: kx.jetzt },
  };
  const r = anlegenAus(prozesse, d, kx, { name: 'Aus Vorlage', notiz: `Übernommen aus der eigenen Vorlage „${v.titel}“.` });
  if (r.ok && !kx.eigner) r.hinweise.unshift('Noch ohne Eigner — im Steckbrief eine Person aus dem Team wählen (ohne Eigner wird kein Prozess aktiv).');
  return r;
}

/** Eine eigene Vorlage löschen (rein). */
export function eigeneVorlageLoeschen(vorlagen: EigeneVorlagenDatei, id: unknown, rechte: ProzessRechte): { ok: true; datei: EigeneVorlagenDatei } | { ok: false; status: 403 | 404; fehler: string } {
  if (!rechte.veroeffentlichen) return { ok: false, status: 403, fehler: 'Eigene Vorlagen löschen nur volle Mitglieder.' };
  if (!vorlagen.vorlagen.some(v => v.id === id)) return { ok: false, status: 404, fehler: 'Diese Vorlage gibt es nicht (mehr).' };
  return { ok: true, datei: { ...vorlagen, vorlagen: vorlagen.vorlagen.filter(v => v.id !== id) } };
}
