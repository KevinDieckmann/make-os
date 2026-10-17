// ─── Fulfillment · Prozesse — der Prozess-Editor im Miro-Stil: Modell und Schreibregeln (17.10.) ─────────────────────────────────────────
// Rückmeldung 17.10.: „Jeder baut seine Abläufe selbst in der App: Schritte, Nachrichten, Entscheidungen und Erinnerungen per Ziehen anlegen. Damit wird das
// Fulfillment zum Werkzeug, das Kunden für ihre eigenen Prozesse nutzen.“ Gezeichnet wird wie die Reise (Phasen als Zeile, Abstimmungspunkte als Raute
// dazwischen) und der Fluss einer Phase (oben → unten, feste Formen) — DESIGN_STANDARD.md › Prozess-Visualisierung › Editor.
//
// EINE reine Stelle für (Server UND Browser):
//   · `editorModell(vorlage, bausteine)` — was der Editor zeigt: Phasen (Ebene 2) mit Abstimmungspunkt, je Phase die Abschnitte ihres Flusses (Stränge und
//     benannte Teilprozesse als Gruppen — dieselbe Regel wie die Ansicht, ./fluss-struktur.ts), je Schritt Form, Frist, Verantwortung, Sichtbarkeit,
//     Bausteine, Zweige; dazu der Papierkorb der Vorlage.
//   · `editorAnwenden(datei, { vorlageId, stand, ops }, kontext)` — alles oder nichts, gegen den Stand der GANZEN Vorlage (Fingerabdruck; veraltet → 409 mit
//     Konflikt — die Route schickt die aktuelle Fassung mit). Unsinn 400, unbekannt 404, Regel/Kreis 409, Grenze 413 — nie gekürzt.
//   · `neuerAblauf(datei, { titel }, kontext)` — eine leere Paket-Vorlage mit Start (Gesamtprozess) und EINER Phase.
//   · `positionVon(knoten, id)` — wo ein Schritt steht (für „Rückgängig“ des Verschiebens, ./editor-geschichte.ts).
//
// Regeln der Struktur (Ebenen wie bisher, lib/fulfillment/prozesse/vorlagen-anwenden.ts `vorlageStrukturPruefen`): Phasen sind Ebene 2; ein Schritt direkt in
// der Phase ist Ebene 3, in einem Teilprozess Ebene 4; Bausteine hängen als Ebene 5 an einem Schritt der Ebene 4. Braucht ein Schritt Ebene 4 (er bekommt
// einen Baustein) und steht direkt in der Phase, legt der Editor einen Sammel-Teilprozess an (heißt wie die Phase — die Ansicht zeigt seine Schritte ohne
// Überschrift, `istSammelTeil`); ein leer gewordener Sammel-Teilprozess fällt weg. Nichts sonst wird umgebaut.
// Neue Knoten bringen ihre Kennung aus dem Browser mit (`fk-<uuid>` — so sind Rückgängig/Wiederholen in der Sitzung eindeutig); Löschen legt den Teil in den
// Papierkorb der Vorlage (30 Tage, „Zurückholen“), Zweige, die hineinzeigten, werden gelöst und beim Zurückholen wieder gesetzt. Jede Änderung im Editor
// hält die Reihenfolge der Phasen fest (`phasenVonHand`), damit sie beim Lesen nicht nach der Regel neu sortiert werden.
// Tests: tests/fulfillment-editor-modell.test.ts.

import type { AnwendenErgebnis, Baustein, Freigabepunkt, KnotenForm, ProzessKnoten, ProzessVorlage, VorlagenDatei, VorlagenPapierkorb, Zustaendig, Zweige } from '../typen';
import { GRENZEN } from '../grenzen';
import { KNOTEN_FORMEN } from '../lesen';
import { kinderVon, teilbaum, wurzelVon } from '../regeln';
import { istSammelTeil } from './reise';
import { knotenForm } from './reise-bild';
import { abstimmungsNummern } from './darstellung';
import { phasenAbschnitte, phasenDer, phasenSchritte, phaseVonKnoten, neinZiele, zweigeOhne, zweigePruefen } from './fluss-struktur';
import { vorlageStrukturPruefen } from './vorlagen-anwenden';
import { ausfuehren, istObj, nein, optBool, optText, optWahl, optZahl, pflichtText, standPruefen } from './pruefen';
import { PAPIERKORB_TAGE, papierkorbBis } from '@/lib/eintraege/sicher';

/** Kennung eines neuen Knotens aus dem Editor: `fk-<uuid>` (wie `neueKennung('fk')`). */
export const EDITOR_KENNUNG = /^fk-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Kennungen der Abstimmungspunkte, die der Editor anlegt (A1, A2 …) — die Muster-Punkte F0–F7 tragen Bedeutung (Onboarding, Analyse) und werden nie neu vergeben. */
export const EDITOR_ABSTIMMUNG = /^A\d{1,3}$/;
/** Höchstens so viele Tage Frist an einem Schritt. */
export const FRIST_MAX = 365;
/** Name der Formen (Palette, Seitenfeld, Vorleser). */
export const FORM_TITEL: Readonly<Record<KnotenForm, string>> = { schritt: 'Schritt', nachricht: 'Nachricht', entscheidung: 'Entscheidung', erinnerung: 'Erinnerung', termin: 'Termin', abstimmung: 'Abstimmung' };
/** Vorgabe-Titel eines neuen Knotens je Form (kurz, ohne Inhalte — der Mensch benennt ihn um). */
export const FORM_VORGABE: Readonly<Record<KnotenForm, string>> = { schritt: 'Neuer Schritt', nachricht: 'Nachricht senden', entscheidung: 'Passt es?', erinnerung: 'Erinnern', termin: 'Termin', abstimmung: 'Abstimmen' };
const ZUST = ['intern', 'kunde', 'beide'] as const;

// ── Modell: was der Editor zeigt ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface EditorBaustein { knotenId: string; bausteinId: string; titel: string; art?: string }
export interface EditorKnoten {
  id: string; titel: string;
  /** Wirksame Form (gesetzt oder abgeleitet). */
  form: KnotenForm;
  /** Form im Editor gesetzt (sonst abgeleitet — Baustein, Abstimmungspunkt). */
  gesetzt: boolean;
  frist?: number; zustaendig?: Zustaendig; kundeSichtbar?: boolean; freigabe?: string;
  bausteine: EditorBaustein[];
  zweige?: Zweige;
  /** Nein-Zweig dieser Entscheidung — steht im Bild neben ihr, nicht im Strang. */
  neinVon?: string;
}
export interface EditorAbschnitt { schluessel: string; art: 'strang' | 'gruppe'; gruppeId?: string; titel?: string; knoten: EditorKnoten[] }
export interface EditorPhase {
  id: string; nr: number; titel: string; kundeSichtbar: boolean;
  abstimmung?: { id: string; nr?: number; titel: string; wer: Zustaendig };
  abschnitte: EditorAbschnitt[];
  /** Zahl der Schritte (ohne Bausteine). */
  schritte: number;
}
export interface EditorPapierkorbZeile { id: string; art: VorlagenPapierkorb['art']; titel: string; am: string; bis: string; wo?: string }
export interface EditorModell { vorlageId: string; titel: string; fassung: number; phasen: EditorPhase[]; papierkorb: EditorPapierkorbZeile[] }

/** Die wirksame Form eines Knotens der Vorlage — gesetzt oder abgeleitet (Abstimmungspunkt → Abstimmung, Mail-Baustein → Nachricht, Ritual → Termin). */
export function wirksameForm(k: ProzessKnoten, kn: readonly ProzessKnoten[], art?: (id: string) => string | undefined): KnotenForm {
  if (k.form) return k.form;
  const f = knotenForm(k, kinderVon(k.id, kn).filter(c => c.bausteinId), art);
  return f === 'entscheidung' ? 'abstimmung' : f;
}

export function editorModell(v: ProzessVorlage, bausteine: readonly Pick<Baustein, 'id' | 'titel' | 'art'>[] = []): EditorModell {
  const kn = v.knoten;
  const art = (id: string) => bausteine.find(b => b.id === id)?.art;
  const nummern = abstimmungsNummern(kn);
  const nz = neinZiele(kn);
  const schritt = (k: ProzessKnoten): EditorKnoten => ({
    id: k.id, titel: k.titel, form: wirksameForm(k, kn, art), gesetzt: !!k.form,
    ...(k.frist !== undefined ? { frist: k.frist } : {}), ...(k.zustaendig ? { zustaendig: k.zustaendig } : {}),
    ...(k.kundeSichtbar !== undefined ? { kundeSichtbar: k.kundeSichtbar } : {}), ...(k.freigabe ? { freigabe: k.freigabe } : {}),
    bausteine: kinderVon(k.id, kn).filter(c => c.bausteinId).map(c => {
      const b = bausteine.find(x => x.id === c.bausteinId);
      return { knotenId: c.id, bausteinId: c.bausteinId!, titel: c.titel || b?.titel || 'Baustein', ...(b ? { art: b.art } : {}) };
    }),
    ...(k.zweige ? { zweige: k.zweige } : {}), ...(nz.has(k.id) ? { neinVon: nz.get(k.id)! } : {}),
  });
  const phasen = phasenDer(kn).map((p, i): EditorPhase => {
    const fg = p.freigabe ? v.freigaben.find(f => f.id === p.freigabe) : undefined;
    const abschnitte = phasenAbschnitte(kn, p.id).map((a, j): EditorAbschnitt => ({
      schluessel: a.gruppe ? a.gruppe.id : `${p.id}:${j}`, art: a.art, ...(a.gruppe ? { gruppeId: a.gruppe.id, titel: a.gruppe.titel } : {}), knoten: a.schritte.map(schritt),
    }));
    return {
      id: p.id, nr: i + 1, titel: p.titel, kundeSichtbar: p.kundeSichtbar === true,
      ...(p.freigabe ? { abstimmung: { id: p.freigabe, ...(nummern.get(p.freigabe) ? { nr: nummern.get(p.freigabe)! } : {}), titel: fg?.titel ?? '', wer: fg?.wer ?? 'beide' } } : {}),
      abschnitte, schritte: abschnitte.reduce((n, a) => n + a.knoten.length, 0),
    };
  });
  const titelVon = new Map(kn.map(k => [k.id, k.titel]));
  const papierkorb = (v.papierkorb ?? []).filter(e => !e.still).map((e): EditorPapierkorbZeile => ({
    id: e.id, art: e.art, titel: e.knoten.find(x => x.id === e.id)?.titel ?? e.knoten[0].titel, am: e.am, bis: papierkorbBis(e.am),
    ...(e.phaseId && e.art !== 'phase' && titelVon.has(e.phaseId) ? { wo: titelVon.get(e.phaseId)! } : {}),
  }));
  return { vorlageId: v.id, titel: v.titel, fassung: v.fassung, phasen, papierkorb };
}

// ── Positionen ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Ein Platz im Fluss einer Phase. Genau eine Angabe (oder keine = ans Ende der Phase): `nach`/`vor` = neben diesem Schritt (in seinem Strang bzw. seiner
 * Gruppe), `inGruppe` = ans Ende dieser Gruppe, `nachGruppe` = direkt hinter dieser Gruppe (in der Phase), `anfang` = an den Anfang der Phase.
 */
export interface EditorZiel { phaseId: string; nach?: string; vor?: string; inGruppe?: string; nachGruppe?: string; anfang?: boolean }

/** Wo ein Schritt steht — als Platz, an den er zurückgesetzt werden kann (Rückgängig). Null, wenn er kein Schritt ist. */
export function positionVon(kn: readonly ProzessKnoten[], id: string): EditorZiel | null {
  const P = phaseVonKnoten(kn, id);
  if (!P || P === id) return null;
  const abs = phasenAbschnitte(kn, P);
  for (let ai = 0; ai < abs.length; ai++) {
    const a = abs[ai];
    const i = a.schritte.findIndex(s => s.id === id);
    if (i < 0) continue;
    if (i > 0) return { phaseId: P, nach: a.schritte[i - 1].id };
    if (a.schritte.length > 1) return { phaseId: P, vor: a.schritte[1].id };
    if (a.art === 'gruppe') return { phaseId: P, inGruppe: a.gruppe!.id };
    const vorher = abs[ai - 1];
    return vorher?.art === 'gruppe' ? { phaseId: P, nachGruppe: vorher.gruppe!.id } : { phaseId: P, anfang: true };
  }
  return null;
}

function zielAus(v: unknown): EditorZiel {
  if (!istObj(v) || typeof v.phaseId !== 'string') return nein('ziel: { phaseId, nach | vor | inGruppe | nachGruppe | anfang }.');
  const z: EditorZiel = { phaseId: v.phaseId };
  let n = 0;
  for (const f of ['nach', 'vor', 'inGruppe', 'nachGruppe'] as const) {
    if (v[f] === undefined || v[f] === null) continue;
    if (typeof v[f] !== 'string') nein(`ziel.${f}: Kennung erwartet.`);
    z[f] = v[f] as string; n++;
  }
  if (v.anfang === true) { z.anfang = true; n++; }
  if (n > 1) nein('ziel: höchstens eine Angabe (nach, vor, inGruppe, nachGruppe oder anfang).');
  return z;
}

// ── Schreiben ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface EditorKontext {
  person: string; jetzt: string;
  /** Fingerabdruck (Server: lib/fulfillment/speicher.ts `eintragStand`) — der Stand der ganzen Vorlage. */
  standVon: (x: object) => string;
  /** Kennungen, die der Server vergibt (Sammel-Teilprozesse, neue Vorlagen). */
  neueId: (praefix: 'fk' | 'fp') => string;
}
export type EditorOp = { op: string } & Record<string, unknown>;

/** Felder eines Schritts aus der Eingabe (null = entfernen). */
function schrittFelder(o: Record<string, unknown>): Record<string, unknown> {
  const t: Record<string, unknown> = {};
  if (o.titel !== undefined) t.titel = pflichtText(o.titel, 'titel', 'Titel');
  const form = optWahl(o.form, KNOTEN_FORMEN, 'Form'); if (form !== undefined) t.form = form;
  const f = optZahl(o.frist, 0, FRIST_MAX, 'Frist (Tage)');
  if (f !== undefined) { if (f !== null && !Number.isInteger(f)) nein(`Frist: ganze Tage von 0 bis ${FRIST_MAX}.`); t.frist = f; }
  const z = optWahl(o.zustaendig, ZUST, 'Verantwortung'); if (z !== undefined) t.zustaendig = z;
  const ks = optBool(o.kundeSichtbar, 'Für den Kunden sichtbar'); if (ks !== undefined) t.kundeSichtbar = ks;
  return t;
}
const setzeFelder = (k: ProzessKnoten, t: Record<string, unknown>): ProzessKnoten => {
  const raus: Record<string, unknown> = { ...k };
  for (const [f, w] of Object.entries(t)) { if (w === null) delete raus[f]; else if (w !== undefined) raus[f] = w; }
  return raus as unknown as ProzessKnoten;
};

/**
 * Die Änderungen des Editors an EINER Paket-Vorlage — alles oder nichts. Ops (je `{ op, … }`):
 *   titel { titel } · phase-neu { id, titel, nach?: Phase|null } · phase { id, titel?, kundeSichtbar? } · phase-schieben { id, nach: Phase|null }
 *   abstimmung { phaseId, an, titel?, wer? } · schritt-neu { id, ziel, form, titel, frist?, zustaendig?, kundeSichtbar? }
 *   schritt { id, titel?, form?, frist?, zustaendig?, kundeSichtbar? } · schritt-schieben { id, ziel } · zweig { id, ja?: id|null, nein?: id|null }
 *   nein-erinnerung { id, entscheidungId, titel? } · baustein-dazu { id, schrittId, bausteinId, titel? } · gruppe { id, titel }
 *   weg { id, still? } · zurueck { id } · papierkorb-leeren { id? }
 */
export function editorAnwenden(datei: VorlagenDatei, eingabe: unknown, k: EditorKontext): AnwendenErgebnis<VorlagenDatei> {
  return ausfuehren(() => {
    if (!istObj(eingabe)) return nein('Eingabe fehlt.');
    const ops = eingabe.ops;
    if (!Array.isArray(ops) || !ops.length) return nein('ops: mindestens eine Änderung.');
    if (ops.length > GRENZEN.opsJeAnfrage) return nein(`Höchstens ${GRENZEN.opsJeAnfrage} Änderungen je Anfrage. Nichts gespeichert.`, 413);
    const d: VorlagenDatei = JSON.parse(JSON.stringify(datei));
    const alt = d.prozesse.find(p => p.id === eingabe.vorlageId) ?? nein('Diese Vorlage gibt es nicht (mehr).', 404);
    if (alt.art !== 'paket') nein('Der Editor bearbeitet Paket-Vorlagen — Landkarte und Abläufe bleiben im Baum.');
    if (typeof eingabe.stand !== 'string' || !eingabe.stand) nein('Stand der Vorlage fehlt — bitte neu laden.');
    standPruefen(eingabe.stand, k.standVon(alt), alt.id);
    const wurzel = wurzelVon(alt.knoten) ?? nein('Die Vorlage hat keinen obersten Knoten.');
    let v: ProzessVorlage = { ...alt };
    let kn: ProzessKnoten[] = [...alt.knoten];
    const grenzeAb = Date.parse(k.jetzt) - PAPIERKORB_TAGE * 86_400_000;
    let pk: VorlagenPapierkorb[] = (alt.papierkorb ?? []).filter(e => !(Date.parse(e.am) < grenzeAb));

    // ── Werkzeug über dem Arbeitsstand ──
    const knoten = (id: unknown): ProzessKnoten => kn.find(x => x.id === id) ?? nein('Diesen Knoten gibt es nicht (mehr).', 404);
    const phase = (id: unknown): ProzessKnoten => { const p = kn.find(x => x.id === id && x.elternId === wurzel.id); return p ?? nein('Diese Phase gibt es nicht (mehr).', 404); };
    const istSchritt = (x: ProzessKnoten): boolean => { const P = phaseVonKnoten(kn, x.id); return !!P && P !== x.id && phasenSchritte(kn, P).some(s => s.id === x.id); };
    const schritt = (id: unknown): ProzessKnoten => { const x = knoten(id); if (!istSchritt(x)) nein(`„${x.titel}“ ist kein Schritt im Fluss.`); return x; };
    const neueKennung = (id: unknown): string => {
      if (typeof id !== 'string' || !EDITOR_KENNUNG.test(id)) return nein('Kennung des neuen Knotens fehlt (fk-<uuid>).');
      if (kn.some(x => x.id === id) || pk.some(e => e.knoten.some(x => x.id === id))) nein('Diese Kennung gibt es schon — bitte neu laden.', 409);
      return id;
    };
    const lueckenlos = (eltern: string | undefined) => {
      if (!eltern) return;
      const rang = new Map(kinderVon(eltern, kn).map((x, i) => [x.id, i + 1]));
      kn = kn.map(x => (rang.has(x.id) && x.rang !== rang.get(x.id) ? { ...x, rang: rang.get(x.id)! } : x));
    };
    /** `id` unter `eltern` an die Stelle `index` (unter den übrigen Kindern — ohne `auch`, der gleich woanders hingeht); der frühere Eltern-Knoten wird lückenlos. */
    const setzeReihe = (eltern: string, id: string, index: number, auch?: string) => {
      const ich = kn.find(x => x.id === id)!;
      const vorher = ich.elternId;
      const g = kinderVon(eltern, kn.filter(x => x.id !== id && x.id !== auch));
      g.splice(Math.max(0, Math.min(index, g.length)), 0, ich);
      const rang = new Map(g.map((x, i) => [x.id, i + 1]));
      kn = kn.map(x => (x.id === id ? { ...x, elternId: eltern, rang: rang.get(id)! } : rang.has(x.id) ? { ...x, rang: rang.get(x.id)! } : x));
      if (vorher && vorher !== eltern) lueckenlos(vorher);
    };
    const istSammel = (x: ProzessKnoten | undefined, P: ProzessKnoten, ohne?: string): x is ProzessKnoten =>
      !!x && x.elternId === P.id && istSammelTeil(x, P) && kinderVon(x.id, kn).some(c => c.id !== ohne);
    /** Ein leer gewordener Sammel-Teilprozess fällt weg (er war nur ein Behälter). */
    const aufraeumen = (eltern: string | undefined) => {
      if (!eltern) return;
      const s = kn.find(x => x.id === eltern);
      const P = s?.elternId ? kn.find(x => x.id === s.elternId) : undefined;
      if (!s || !P || P.elternId !== wurzel.id || kinderVon(s.id, kn).length || !istSammelTeil(s, P)) return;
      kn = kn.filter(x => x.id !== s.id);
      lueckenlos(P.id);
    };
    /** Platz eines Ziels (ohne den Knoten `ohne`, der dorthin soll). */
    const platz = (z: EditorZiel, ohne: string): { P: ProzessKnoten; eltern: string; index: number } => {
      const P = phase(z.phaseId);
      const rest = kn.filter(x => x.id !== ohne);
      const ref = z.nach ?? z.vor;
      if (ref !== undefined) {
        if (ref === ohne) nein('Ein Schritt steht nie neben sich selbst.');
        const x = knoten(ref);
        if (!phasenSchritte(kn, P.id).some(s => s.id === x.id)) nein(`„${x.titel}“ liegt nicht in dieser Phase.`);
        const g = kinderVon(x.elternId, rest);
        const i = g.findIndex(y => y.id === x.id);
        return { P, eltern: x.elternId!, index: z.nach !== undefined ? i + 1 : i };
      }
      const gruppe = (id: string) => {
        const g = knoten(id);
        if (g.elternId !== P.id || !kinderVon(g.id, kn).length) nein(`„${g.titel}“ ist keine Gruppe dieser Phase.`);
        return g;
      };
      if (z.inGruppe !== undefined) { const g = gruppe(z.inGruppe); return { P, eltern: g.id, index: kinderVon(g.id, rest).length }; }
      if (z.nachGruppe !== undefined) { const g = gruppe(z.nachGruppe); return { P, eltern: P.id, index: kinderVon(P.id, rest).findIndex(y => y.id === g.id) + 1 }; }
      return { P, eltern: P.id, index: z.anfang ? 0 : kinderVon(P.id, rest).length };
    };
    /** Einen Schritt an seinen Platz setzen; braucht er Ebene 4 (Bausteine) und der Platz ist direkt in der Phase, kommt er in einen Sammel-Teilprozess. */
    const einsetzen = (id: string, p: { P: ProzessKnoten; eltern: string; index: number }, braucht4: boolean) => {
      let { eltern, index } = p;
      if (eltern === p.P.id && braucht4) {
        const g = kinderVon(p.P.id, kn.filter(x => x.id !== id));
        const davor = g[index - 1], danach = g[index];
        if (istSammel(davor, p.P, id)) { eltern = davor.id; index = kinderVon(davor.id, kn.filter(x => x.id !== id)).length; }
        else if (istSammel(danach, p.P, id)) { eltern = danach.id; index = 0; }
        else {
          const sid = k.neueId('fk');
          kn.push({ id: sid, elternId: p.P.id, titel: p.P.titel, rang: 0 });
          setzeReihe(p.P.id, sid, index, id);
          eltern = sid; index = 0;
        }
      }
      setzeReihe(eltern, id, index);
    };
    const brauchtEbene4 = (id: string) => kinderVon(id, kn).some(c => c.bausteinId);

    for (const roh of ops) {
      if (!istObj(roh) || typeof roh.op !== 'string') nein('Jede Änderung braucht „op“.');
      const o = roh as EditorOp;
      switch (o.op) {
        case 'titel': {
          const t = pflichtText(o.titel, 'titel', 'Titel des Ablaufs');
          v = { ...v, titel: t };
          kn = kn.map(x => (x.id === wurzel.id ? { ...x, titel: t } : x));
          break;
        }
        case 'phase-neu': {
          const id = neueKennung(o.id);
          const titel = pflichtText(o.titel, 'titel', 'Titel der Phase');
          const phasen = kinderVon(wurzel.id, kn);
          const index = o.nach === undefined ? phasen.length : o.nach === null ? 0 : phasen.findIndex(p => p.id === phase(o.nach).id) + 1;
          kn.push({ id, elternId: wurzel.id, titel, rang: 0, kundeSichtbar: true });
          setzeReihe(wurzel.id, id, index);
          break;
        }
        case 'phase': {
          const P = phase(o.id);
          const t: Record<string, unknown> = {};
          if (o.titel !== undefined) t.titel = pflichtText(o.titel, 'titel', 'Titel der Phase');
          const ks = optBool(o.kundeSichtbar, 'Für den Kunden sichtbar'); if (ks !== undefined) t.kundeSichtbar = ks;
          // Ein Sammel-Teilprozess heißt wie seine Phase — benennt man die Phase um, zieht er mit (sonst stünde er plötzlich als Gruppe da).
          const sammel = typeof t.titel === 'string' ? kinderVon(P.id, kn).filter(x => kinderVon(x.id, kn).length && istSammelTeil(x, P) && x.titel === P.titel).map(x => x.id) : [];
          kn = kn.map(x => (x.id === P.id ? setzeFelder(x, t) : sammel.includes(x.id) ? { ...x, titel: t.titel as string } : x));
          break;
        }
        case 'phase-schieben': {
          const P = phase(o.id);
          const rest = kinderVon(wurzel.id, kn.filter(x => x.id !== P.id));
          if (o.nach === undefined) nein('nach: Kennung der Phase davor oder null (= an den Anfang).');
          if (o.nach === P.id) nein('Eine Phase steht nie hinter sich selbst.');
          const index = o.nach === null ? 0 : rest.findIndex(p => p.id === phase(o.nach).id) + 1;
          setzeReihe(wurzel.id, P.id, index);
          break;
        }
        case 'abstimmung': {
          const P = phase(o.phaseId);
          if (o.an === false) { kn = kn.map(x => { if (x.id !== P.id || !x.freigabe) return x; const { freigabe: _f, ...r } = x; return r; }); break; }
          if (o.an !== true) nein('an: ja oder nein.');
          const genutzt = new Set(kn.map(x => x.freigabe).filter(Boolean));
          let fid = P.freigabe;
          let liste: Freigabepunkt[] = [...v.freigaben];
          // Ausdrücklich ein vorhandener Punkt (Rückgängig: derselbe wie vorher, auch ein Muster-Punkt).
          if (!fid && o.id !== undefined) fid = liste.find(f => f.id === o.id)?.id ?? nein('Diesen Abstimmungspunkt kennt die Vorlage nicht.', 404);
          if (!fid) {
            // Einen freien eigenen Punkt wiederverwenden (aus- und wieder einschalten gibt denselben zurück), sonst einen neuen anlegen.
            fid = liste.find(f => EDITOR_ABSTIMMUNG.test(f.id) && !genutzt.has(f.id))?.id;
            if (!fid) {
              const n = liste.reduce((m, f) => (EDITOR_ABSTIMMUNG.test(f.id) ? Math.max(m, Number(f.id.slice(1))) : m), 0) + 1;
              fid = `A${n}`;
              liste.push({ id: fid, titel: `${P.titel} abgestimmt`.slice(0, 120), wer: 'beide' });
            }
          }
          const titel = o.titel !== undefined ? pflichtText(o.titel, 'titel', 'Titel des Abstimmungspunkts') : undefined;
          const wer = optWahl(o.wer, ZUST, 'Wer stimmt ab') ?? undefined;
          liste = liste.map(f => (f.id === fid ? { ...f, ...(titel ? { titel } : {}), ...(wer ? { wer } : {}) } : f));
          if (liste.length > 30) nein('Abstimmungspunkte: höchstens 30 je Vorlage. Nichts gespeichert.', 413);
          v = { ...v, freigaben: liste };
          kn = kn.map(x => (x.id === P.id ? { ...x, freigabe: fid } : x));
          break;
        }
        case 'schritt-neu': {
          const id = neueKennung(o.id);
          const z = zielAus(o.ziel);
          const t = schrittFelder({ ...o, form: o.form ?? 'schritt' });
          if (!t.titel) nein('Titel fehlt.');
          // Vorläufig direkt unter der Phase (nie ohne Eltern — sonst zählte er als zweiter oberster Knoten), dann an seinen Platz.
          kn.push(setzeFelder({ id, elternId: phase(z.phaseId).id, titel: '', rang: 0 }, t));
          einsetzen(id, platz(z, id), false);
          break;
        }
        case 'schritt': {
          const x = schritt(o.id);
          const t = schrittFelder(o);
          let neu = setzeFelder(x, t);
          // Eine andere Form nimmt Zweige mit, die sie nicht haben kann (statt eines Fehlers): Nein nur an Entscheidungen, Ja auch an Erinnerungen.
          if (neu.zweige) {
            const z = { ...neu.zweige };
            if (neu.form !== 'entscheidung') delete z.nein;
            if (neu.form !== 'entscheidung' && neu.form !== 'erinnerung') delete z.ja;
            if (z.ja || z.nein) neu = { ...neu, zweige: z }; else { const { zweige: _z, ...r } = neu; neu = r; }
          }
          kn = kn.map(y => (y.id === x.id ? neu : y));
          // Ist er keine Entscheidung mehr, läuft auch keine Erinnerung mehr „zurück“ zu ihm (die Schleife gäbe es nicht mehr — sie wäre ein Kreis).
          if (x.form === 'entscheidung' && neu.form !== 'entscheidung') {
            kn = kn.map(y => { if (y.zweige?.ja !== x.id) return y; const z = { ...y.zweige }; delete z.ja; const { zweige: _z, ...r } = y; return z.nein ? { ...r, zweige: z } : r; });
          }
          break;
        }
        case 'schritt-schieben': {
          const x = schritt(o.id);
          if (kinderVon(x.id, kn).some(c => !c.bausteinId)) nein('Ganze Teilprozesse verschiebt man im Baum, nicht hier.');
          const vorher = x.elternId;
          einsetzen(x.id, platz(zielAus(o.ziel), x.id), brauchtEbene4(x.id));
          aufraeumen(vorher);
          break;
        }
        case 'zweig': {
          const x = schritt(o.id);
          const z: Zweige = { ...(x.zweige ?? {}) };
          for (const art of ['ja', 'nein'] as const) {
            const w = o[art];
            if (w === undefined) continue;
            if (w === null || w === '') delete z[art];
            else if (typeof w === 'string') { schritt(w); z[art] = w; } else nein(`${art}: Kennung erwartet.`);
          }
          kn = kn.map(y => { if (y.id !== x.id) return y; const { zweige: _z, ...r } = y; return z.ja || z.nein ? { ...r, zweige: z } : r; });
          break;
        }
        case 'nein-erinnerung': {
          const e = schritt(o.entscheidungId);
          if (e.form !== 'entscheidung') nein(`„${e.titel}“ ist keine Entscheidung — den Nein-Zweig gibt es nur dort.`);
          if (e.zweige?.nein) nein(`„${e.titel}“ hat schon einen Nein-Zweig.`, 409);
          const id = neueKennung(o.id);
          const titel = o.titel === undefined ? FORM_VORGABE.erinnerung : pflichtText(o.titel, 'titel', 'Titel');
          kn.push({ id, elternId: e.elternId, titel, rang: 0, form: 'erinnerung', zweige: { ja: e.id } });
          setzeReihe(e.elternId!, id, kinderVon(e.elternId, kn.filter(y => y.id !== id)).findIndex(y => y.id === e.id) + 1);
          kn = kn.map(y => (y.id === e.id ? { ...y, zweige: { ...(y.zweige ?? {}), nein: id } } : y));
          break;
        }
        case 'baustein-dazu': {
          const s = schritt(o.schrittId);
          const b = d.bausteine.find(x => x.id === o.bausteinId) ?? nein('Diesen Baustein gibt es nicht (mehr).', 404);
          if (kinderVon(s.id, kn).some(c => c.bausteinId === b.id)) nein(`„${b.titel}“ hängt schon an „${s.titel}“.`, 409);
          const id = neueKennung(o.id);
          const titel = o.titel === undefined ? b.titel : pflichtText(o.titel, 'titel', 'Titel');
          const P = phase(phaseVonKnoten(kn, s.id));
          if (s.elternId === P.id) einsetzen(s.id, { P, eltern: P.id, index: kinderVon(P.id, kn).findIndex(y => y.id === s.id) }, true);
          kn.push({ id, elternId: s.id, titel: titel.slice(0, 120), rang: 0, bausteinId: b.id });
          setzeReihe(s.id, id, kinderVon(s.id, kn.filter(y => y.id !== id)).length);
          break;
        }
        case 'gruppe': {
          const g = knoten(o.id);
          const P = g.elternId ? kn.find(x => x.id === g.elternId) : undefined;
          if (!P || P.elternId !== wurzel.id || !kinderVon(g.id, kn).length || istSammelTeil(g, P)) nein(`„${g.titel}“ ist keine Gruppe.`);
          const t = pflichtText(o.titel, 'titel', 'Titel der Gruppe');
          kn = kn.map(x => (x.id === g.id ? { ...x, titel: t } : x));
          break;
        }
        case 'weg': {
          const x = knoten(o.id);
          if (x.id === wurzel.id) nein('Den Start (Gesamtprozess) löscht man über „Vorlage löschen“.');
          const P = phaseVonKnoten(kn, x.id);
          const art: VorlagenPapierkorb['art'] = x.elternId === wurzel.id ? 'phase' : x.bausteinId ? 'baustein' : istSchritt(x) ? 'schritt' : 'gruppe';
          const g = kinderVon(x.elternId, kn);
          const i = g.findIndex(y => y.id === x.id);
          const pos = art === 'schritt' ? positionVon(kn, x.id) : null;
          const ids = teilbaum(x.id, kn);
          const weg = new Set(ids);
          const { knoten: rest, verweise } = zweigeOhne(kn, weg);
          const ziele = verweise.map(r => ({ ...r, ziel: kn.find(y => y.id === r.knotenId)!.zweige![r.zweig]! }));
          const eintrag: VorlagenPapierkorb = {
            id: x.id, am: k.jetzt, von: k.person, art,
            ...(P && art !== 'phase' ? { phaseId: P } : {}), ...(x.elternId ? { elternId: x.elternId } : {}),
            ...(g[i - 1] ? { nachId: g[i - 1].id } : {}), ...(g[i + 1] ? { vorId: g[i + 1].id } : {}),
            ...(pos ? { platz: (({ phaseId: _p, ...r }) => r)(pos) as VorlagenPapierkorb['platz'] } : {}),
            knoten: ids.map(id => kn.find(y => y.id === id)!), ...(ziele.length ? { verweise: ziele } : {}), ...(o.still === true ? { still: true as const } : {}),
          };
          kn = rest.filter(y => !weg.has(y.id));
          lueckenlos(x.elternId);
          if (art === 'schritt') aufraeumen(x.elternId);
          pk = [eintrag, ...pk.filter(e => e.id !== x.id)];
          break;
        }
        case 'zurueck': {
          const e = pk.find(x => x.id === o.id) ?? nein('Das liegt nicht (mehr) im Papierkorb.', 404);
          if (e.knoten.some(x => kn.some(y => y.id === x.id))) nein('Ein Teil davon steht schon wieder in der Vorlage — bitte neu laden.', 409);
          const kindVon = (eltern: string, id?: string) => !!id && kn.some(y => y.id === id && y.elternId === eltern);
          // Erst prüfen, wohin er gehört (ohne die zurückgeholten Knoten) — dann einfügen, die Wurzel des Teils vorläufig unter einem vorhandenen Eltern-Knoten.
          const s = e.art === 'baustein' ? (e.elternId ? kn.find(y => y.id === e.elternId && !y.bausteinId) : undefined) : undefined;
          if (e.art === 'baustein' && (!s || !istSchritt(s))) nein('Der Schritt dazu fehlt — erst ihn zurückholen.', 409);
          const P = e.art === 'phase' ? undefined : e.art === 'baustein' ? phase(phaseVonKnoten(kn, s!.id)) : e.phaseId ? kn.find(y => y.id === e.phaseId && y.elternId === wurzel.id) : undefined;
          if (e.art !== 'phase' && !P) nein('Die Phase dazu gibt es nicht mehr — erst die Phase zurückholen.', 409);
          const vorlaeufig = e.art === 'phase' ? wurzel.id : e.art === 'baustein' ? s!.id : P!.id;
          kn.push(...e.knoten.map(x => (x.id === e.id ? { ...x, elternId: vorlaeufig, rang: 0 } : x)));
          if (e.art === 'phase') {
            const phasen = kinderVon(wurzel.id, kn.filter(y => y.id !== e.id));
            const i = e.nachId ? phasen.findIndex(p => p.id === e.nachId) : -1;
            setzeReihe(wurzel.id, e.id, i + 1);
          } else if (e.art === 'baustein') {
            if (s!.elternId === P!.id) einsetzen(s!.id, { P: P!, eltern: P!.id, index: kinderVon(P!.id, kn).findIndex(y => y.id === s!.id) }, true);
            setzeReihe(s!.id, e.id, kinderVon(s!.id, kn.filter(y => y.id !== e.id)).length);
          } else {
            if (e.art === 'gruppe') {
              const rest = kinderVon(P!.id, kn.filter(y => y.id !== e.id));
              setzeReihe(P!.id, e.id, kindVon(P!.id, e.nachId) ? rest.findIndex(y => y.id === e.nachId) + 1 : 0);
            } else {
              // Der gemerkte Platz im Fluss — gelten seine Bezüge nicht mehr (gelöscht, andere Phase), an den Anfang der Phase.
              const pl = e.platz ?? {};
              const schritte = phasenSchritte(kn, P!.id).filter(y => y.id !== e.id).map(y => y.id);
              const gruppen = kinderVon(P!.id, kn).filter(y => y.id !== e.id && kinderVon(y.id, kn).length).map(y => y.id);
              const gilt = (pl.nach && schritte.includes(pl.nach)) || (pl.vor && schritte.includes(pl.vor)) || (pl.inGruppe && gruppen.includes(pl.inGruppe)) || (pl.nachGruppe && gruppen.includes(pl.nachGruppe));
              const z: EditorZiel = gilt ? { phaseId: P!.id, ...pl } : { phaseId: P!.id, anfang: true };
              einsetzen(e.id, platz(z, e.id), brauchtEbene4(e.id));
            }
          }
          for (const r of e.verweise ?? []) {
            kn = kn.map(y => (y.id === r.knotenId && !y.zweige?.[r.zweig] && kn.some(q => q.id === r.ziel) ? { ...y, zweige: { ...(y.zweige ?? {}), [r.zweig]: r.ziel } } : y));
          }
          pk = pk.filter(x => x.id !== e.id);
          break;
        }
        case 'papierkorb-leeren': {
          if (o.id === undefined || o.id === null) { pk = []; break; }
          if (!pk.some(x => x.id === o.id)) nein('Das liegt nicht (mehr) im Papierkorb.', 404);
          pk = pk.filter(x => x.id !== o.id);
          break;
        }
        default: nein(`Unbekannte Änderung „${o.op}“.`);
      }
    }
    v = { ...v, knoten: kn, phasenVonHand: true };
    if (pk.length) v.papierkorb = pk; else delete v.papierkorb;
    if (pk.length > GRENZEN.papierkorbJeVorlage) nein(`Papierkorb von „${v.titel}“: höchstens ${GRENZEN.papierkorbJeVorlage} Einträge — bitte erst leeren. Nichts gespeichert.`, 413);
    vorlageStrukturPruefen(v, d);
    zweigePruefen(v.knoten);
    if (JSON.stringify(v) === JSON.stringify(alt)) return { datei: datei, geaendert: [] };
    v = { ...v, fassung: alt.fassung + 1, geaendert: k.jetzt, geaendertVon: k.person };
    d.prozesse = d.prozesse.map(p => (p.id === v.id ? v : p));
    return { datei: d, geaendert: [v.id] };
  });
}

/** „Neuer Ablauf“: eine leere Paket-Vorlage mit dem Start (Gesamtprozess, Ebene 1) und EINER Phase — die Reihenfolge gehört von Anfang an der Hand. */
export function neuerAblauf(datei: VorlagenDatei, eingabe: unknown, k: EditorKontext): AnwendenErgebnis<VorlagenDatei> {
  return ausfuehren(() => {
    const e = istObj(eingabe) ? eingabe : {};
    const titel = pflichtText(e.titel, 'titel', 'Titel des Ablaufs');
    const phase = optText(e.phase, 'titel', 'Erste Phase') ?? 'Phase 1';
    if (datei.prozesse.length >= GRENZEN.vorlagen) nein(`Prozess-Vorlagen: höchstens ${GRENZEN.vorlagen}. Nichts gespeichert.`, 413);
    const id = k.neueId('fp'), wurzel = k.neueId('fk'), p1 = k.neueId('fk');
    const v: ProzessVorlage = {
      id, art: 'paket', titel,
      knoten: [{ id: wurzel, titel, rang: 1 }, { id: p1, elternId: wurzel, titel: phase, rang: 1, kundeSichtbar: true }],
      uebergaenge: [], freigaben: [], rollen: [], fassung: 1, herkunft: { art: 'hand', am: k.jetzt }, geaendert: k.jetzt, geaendertVon: k.person, phasenVonHand: true,
    };
    return { datei: { ...datei, prozesse: [...datei.prozesse, v] }, geaendert: [id] };
  });
}
