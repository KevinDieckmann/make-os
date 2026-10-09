// ─── Agenten-Bereich: Skills, eigene Mitarbeiter, Gedächtnis — die Regeln (09.10., Paket 3; AGENTEN_KONZEPT.md C1/C4/C5/C11) ───
// Entscheidung 08.10. (Antwort 7): „Anleitung mit Beispielen · ‚Das als Skill speichern‘ aus dem Chat · erlaubte Werkzeuge · Zeitplan ·
// Auslöser durch Ereignis · Eingabe-Felder · Freigabe-Pflicht je Skill · Testlauf vor dem Einschalten · Erfolgsquote · Import SKILL.md.“
// Fragerunde 8: „Skills gehören dem Haushalt (Anleger vermerkt) · beim Konto-Löschen gehen Business-Skills an den Inhaber.“
//
// Rein (Server UND Browser), keine Speicherzugriffe — geschrieben wird nur in lib/agenten/skills-server.ts. Regeln:
//   • Skills sind ANWEISUNGEN: Text nur von Menschen (Editor, Import, „aus dem Chat“) oder als Vorschlag eines Agenten, den erst ein
//     Klick im Stapel übernimmt. Aktiv wird ein Skill NUR per Klick einer Person nach einem gelungenen Testlauf der aktuellen Fassung
//     (≥ `GRENZEN.skillTestsMin` Testfälle). Jede inhaltliche Änderung = neue Version, der Skill ist wieder aus.
//   • Werkzeuge ⊆ Werkzeuge des Heads bzw. Mitarbeiters (sonst 400). Die Stufe (frei/freigabe) kommt IMMER aus dem Register — ein
//     Skill lockert nie; `freigabePflicht` verschärft nur.
//   • Nie still kürzen: über einer Grenze 413 mit Satz. Nur Text: Steuerzeichen und NUL → 400.
//   • Eingebaute Skills = die vorhandenen Modi der Heads bzw. des Finanzchefs — sichtbar, nicht änderbar (der Takt der Heads plant sie,
//     lib/heads/takt.ts bzw. lib/finanzen/chef/plan.ts; die Auslöser hier sind nur die Anzeige).

import { headDef, KATALOG, vorlageVon } from './katalog';
import {
  GRENZEN, HEAD_WERKZEUGE, MITARBEITER_WERKZEUGE,
  type Aufwand, type Faden, type HeadDef, type Merksatz, type Mitarbeiter, type ModelTier, type Skill, type SkillAusloeser,
  type SkillBeispiel, type SkillEingabeFeld, type SkillEreignis, type SkillKurz, type SkillTest, type SkillTestlauf, type WerkstattBestand,
} from './typen';
import { wiederkehrendPruefen, type Pruefung } from './zeitplan';
import { SKILL_EREIGNISSE, EREIGNIS_NAME } from '@/lib/ereignisse/arten';

export type { Pruefung };

/** Name wie in SKILL.md: Kleinbuchstaben, Ziffern, Bindestriche. */
export const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/**
 * Ereignisse, die als Auslöser gewählt werden dürfen (Antwort 7): genau die, die eine Quelle speist (09.10., E1 Ereignisstelle — EINE Liste in
 * lib/ereignisse/arten.ts; der Takt reiht sie über lib/ereignisse/takt.ts ein). Namen ebenda.
 */
export { SKILL_EREIGNISSE, EREIGNIS_NAME } from '@/lib/ereignisse/arten';
export const MODELL_STUFEN: readonly ModelTier[] = ['schnell', 'ausgewogen', 'stark'];
export const AUFWAENDE: readonly Aufwand[] = ['low', 'medium', 'high'];
const FELD_ARTEN: readonly SkillEingabeFeld['art'][] = ['text', 'zahl', 'datum', 'auswahl', 'kontakt', 'firma'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Feinere Grenzen der Werkstatt (zusätzlich zu `GRENZEN` aus typen.ts). */
export const WERKSTATT_GRENZEN = {
  beispiele: 10,
  beispielZeichen: 2_000,
  testEingabe: 2_000,
  erwartetJeTest: 10,
  erwartetZeichen: 300,
  feldLabel: 80,
  optionen: 30,
  optionZeichen: 80,
  filterZeichen: 300,
  /** Kostengrenze je Lauf höchstens 100 € (in Cent). */
  kostenGrenzeMaxCent: 10_000,
  /** So viele frühere Fassungen bleiben mit Inhalt; ältere werden gezählt („+n ältere Fassungen“, wie der Aufgaben-Verlauf). */
  versionenMerken: 20,
  mitarbeiterName: 80,
  mitarbeiterRolle: 300,
  /** Ganze SKILL.md-Datei (Kopf + Anleitung). */
  skillMd: 24_000,
} as const;

// ── Text ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const STEUER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Ein Textfeld: nur Text (keine Steuerzeichen/NUL), getrimmt, Pflicht/Grenze — über der Grenze 413, nie gekürzt. */
export function textFeld(v: unknown, max: number, feld: string, pflicht = true): Pruefung<string> {
  if (v === undefined || v === null || v === '') return pflicht ? { ok: false, status: 400, fehler: `${feld} fehlt.` } : { ok: true, wert: '' };
  if (typeof v !== 'string') return { ok: false, status: 400, fehler: `${feld}: nur Text.` };
  const t = v.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  if (STEUER.test(t)) return { ok: false, status: 400, fehler: `${feld}: nur Text — keine Steuerzeichen.` };
  const s = t.trim();
  if (!s && pflicht) return { ok: false, status: 400, fehler: `${feld} fehlt.` };
  if (s.length > max) return { ok: false, status: 413, fehler: `${feld} ist zu lang (${s.length.toLocaleString('de-DE')} Zeichen, höchstens ${max.toLocaleString('de-DE')}) — bitte kürzen; gespeichert wird nichts.` };
  return { ok: true, wert: s };
}

// ── Fingerabdruck für „Stand“ (409) ──────────────────────────────────────────────────────────────────────────────────────

/** Fingerabdruck eines Eintrags (zwei FNV-1a-Runden, 64 Bit hex) — für Einzeländerungen mit Stand. Rein. */
export function standVon(x: unknown): string {
  const s = JSON.stringify(x) ?? '';
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

// ── Werkzeuge ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Werkzeuge, die ein Skill nutzen darf: die des Heads (plus Agenten-Werkzeuge) bzw. die des Mitarbeiters (ohne Delegation). */
export function erlaubteWerkzeuge(head: HeadDef, mitarbeiter?: Pick<Mitarbeiter, 'werkzeuge'> | null): string[] {
  if (mitarbeiter) return Array.from(new Set([...mitarbeiter.werkzeuge.filter(w => head.werkzeuge.includes(w)), ...MITARBEITER_WERKZEUGE]));
  return Array.from(new Set([...head.werkzeuge, ...HEAD_WERKZEUGE]));
}

function werkzeugePruefen(v: unknown, erlaubt: readonly string[], wer: string): Pruefung<string[]> {
  if (v === undefined || v === null) return { ok: true, wert: [] };
  if (!Array.isArray(v) || !v.every(x => typeof x === 'string')) return { ok: false, status: 400, fehler: 'Werkzeuge als Liste von Namen.' };
  const liste = Array.from(new Set(v as string[]));
  if (liste.length > GRENZEN.werkzeugeJeHead) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.werkzeugeJeHead} Werkzeuge.` };
  const fremd = liste.filter(w => !erlaubt.includes(w));
  if (fremd.length) return { ok: false, status: 400, fehler: `Diese Werkzeuge hat ${wer} nicht: ${fremd.join(', ')} — ein Skill kann nur Werkzeuge nutzen, die ${wer} schon hat.` };
  return { ok: true, wert: liste };
}

// ── Auslöser, Eingabe-Felder, Beispiele, Tests ────────────────────────────────────────────────────────────────────────────

export function ausloeserPruefen(v: unknown): Pruefung<SkillAusloeser> {
  if (v === undefined || v === null) return { ok: true, wert: { art: 'hand' } };
  if (typeof v !== 'object') return { ok: false, status: 400, fehler: 'Auslöser: von Hand, Zeitplan oder Ereignis.' };
  const a = v as Record<string, unknown>;
  if (a.art === 'hand') return { ok: true, wert: { art: 'hand' } };
  if (a.art === 'zeitplan') {
    const w = wiederkehrendPruefen(a);
    return w.ok ? { ok: true, wert: { art: 'zeitplan', ...w.wert } } : w;
  }
  if (a.art === 'ereignis') {
    if (!SKILL_EREIGNISSE.includes(a.ereignis as SkillEreignis)) return { ok: false, status: 400, fehler: `Ereignis: ${SKILL_EREIGNISSE.map(e => EREIGNIS_NAME[e]).join(', ')}.` };
    const f = textFeld(a.filter, WERKSTATT_GRENZEN.filterZeichen, 'Bedingung', false);
    if (!f.ok) return f;
    return { ok: true, wert: { art: 'ereignis', ereignis: a.ereignis as SkillEreignis, ...(f.wert ? { filter: f.wert } : {}) } };
  }
  return { ok: false, status: 400, fehler: 'Auslöser: von Hand, Zeitplan oder Ereignis.' };
}

function felderPruefen(v: unknown): Pruefung<SkillEingabeFeld[]> {
  if (v === undefined || v === null) return { ok: true, wert: [] };
  if (!Array.isArray(v)) return { ok: false, status: 400, fehler: 'Eingabe-Felder als Liste.' };
  if (v.length > GRENZEN.skillEingabeFelder) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.skillEingabeFelder} Eingabe-Felder.` };
  const raus: SkillEingabeFeld[] = [];
  for (const roh of v) {
    const f = (roh ?? {}) as Record<string, unknown>;
    if (typeof f.id !== 'string' || !KEBAB.test(f.id) || f.id.length > 40) return { ok: false, status: 400, fehler: 'Eingabe-Feld: Kennung aus a–z, 0–9 und Bindestrichen.' };
    if (raus.some(x => x.id === f.id)) return { ok: false, status: 400, fehler: `Eingabe-Feld „${f.id}“ doppelt.` };
    const label = textFeld(f.label, WERKSTATT_GRENZEN.feldLabel, 'Beschriftung');
    if (!label.ok) return label;
    if (!FELD_ARTEN.includes(f.art as SkillEingabeFeld['art'])) return { ok: false, status: 400, fehler: `Eingabe-Feld „${f.id}“: Art ${FELD_ARTEN.join(', ')}.` };
    let optionen: string[] | undefined;
    if (f.art === 'auswahl') {
      if (!Array.isArray(f.optionen) || !f.optionen.length) return { ok: false, status: 400, fehler: `Eingabe-Feld „${f.id}“: Auswahl braucht Optionen.` };
      if (f.optionen.length > WERKSTATT_GRENZEN.optionen) return { ok: false, status: 413, fehler: `Höchstens ${WERKSTATT_GRENZEN.optionen} Optionen.` };
      optionen = [];
      for (const o of f.optionen) { const t = textFeld(o, WERKSTATT_GRENZEN.optionZeichen, 'Option'); if (!t.ok) return t; optionen.push(t.wert); }
    }
    raus.push({ id: f.id, label: label.wert, art: f.art as SkillEingabeFeld['art'], ...(f.pflicht === true ? { pflicht: true } : {}), ...(optionen ? { optionen } : {}) });
  }
  return { ok: true, wert: raus };
}

function beispielePruefen(v: unknown): Pruefung<SkillBeispiel[]> {
  if (v === undefined || v === null) return { ok: true, wert: [] };
  if (!Array.isArray(v)) return { ok: false, status: 400, fehler: 'Beispiele als Liste.' };
  if (v.length > WERKSTATT_GRENZEN.beispiele) return { ok: false, status: 413, fehler: `Höchstens ${WERKSTATT_GRENZEN.beispiele} Beispiele.` };
  const raus: SkillBeispiel[] = [];
  for (const roh of v) {
    const b = (roh ?? {}) as Record<string, unknown>;
    const e = textFeld(b.eingabe, WERKSTATT_GRENZEN.beispielZeichen, 'Beispiel (Eingabe)'); if (!e.ok) return e;
    const r = textFeld(b.ergebnis, WERKSTATT_GRENZEN.beispielZeichen, 'Beispiel (Ergebnis)'); if (!r.ok) return r;
    raus.push({ eingabe: e.wert, ergebnis: r.wert });
  }
  return { ok: true, wert: raus };
}

function testsPruefen(v: unknown): Pruefung<SkillTest[]> {
  if (v === undefined || v === null) return { ok: true, wert: [] };
  if (!Array.isArray(v)) return { ok: false, status: 400, fehler: 'Testfälle als Liste.' };
  if (v.length > GRENZEN.skillTestsMax) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.skillTestsMax} Testfälle.` };
  const raus: SkillTest[] = [];
  for (const roh of v) {
    const t = (roh ?? {}) as Record<string, unknown>;
    const e = textFeld(t.eingabe, WERKSTATT_GRENZEN.testEingabe, 'Testfall (Eingabe)'); if (!e.ok) return e;
    if (!Array.isArray(t.erwartet) || !t.erwartet.length) return { ok: false, status: 400, fehler: 'Testfall: mindestens eine Erwartung („was soll herauskommen“).' };
    if (t.erwartet.length > WERKSTATT_GRENZEN.erwartetJeTest) return { ok: false, status: 413, fehler: `Höchstens ${WERKSTATT_GRENZEN.erwartetJeTest} Erwartungen je Testfall.` };
    const erwartet: string[] = [];
    for (const x of t.erwartet) { const s = textFeld(x, WERKSTATT_GRENZEN.erwartetZeichen, 'Erwartung'); if (!s.ok) return s; erwartet.push(s.wert); }
    raus.push({ eingabe: e.wert, erwartet });
  }
  return { ok: true, wert: raus };
}

// ── Der Inhalt eines Skills (was Menschen schreiben) ──────────────────────────────────────────────────────────────────────

/** Die Felder, die eine Person (bzw. ein freigegebener Vorschlag) setzt — alles andere führt der Server. */
export type SkillInhalt = Pick<Skill, 'name' | 'beschreibung' | 'anleitung' | 'werkzeuge' | 'ausloeser' | 'eingabeFelder' | 'freigabePflicht' | 'ergebnis' | 'stufe' | 'tests'>
  & Partial<Pick<Skill, 'mitarbeiterId' | 'beispiele' | 'aufwand' | 'kostenGrenzeCent'>>;
const INHALT_FELDER = ['name', 'beschreibung', 'anleitung', 'beispiele', 'werkzeuge', 'ausloeser', 'eingabeFelder', 'freigabePflicht', 'ergebnis', 'stufe', 'aufwand', 'kostenGrenzeCent', 'tests', 'mitarbeiterId'] as const;

export interface SkillKontext {
  head: HeadDef;
  /** Mitarbeiter, die dem Head zur Verfügung stehen (für `mitarbeiterId`). */
  mitarbeiter: readonly Pick<Mitarbeiter, 'id' | 'werkzeuge' | 'name'>[];
}

/** Einen Skill-Inhalt prüfen und säubern (rein). Werkzeuge ⊆ Head bzw. Mitarbeiter (400), Grenzen 413, nur Text. */
export function skillPruefen(roh: unknown, k: SkillKontext): Pruefung<SkillInhalt> {
  if (!roh || typeof roh !== 'object') return { ok: false, status: 400, fehler: 'Skill fehlt.' };
  const r = roh as Record<string, unknown>;
  if (typeof r.name !== 'string' || !r.name) return { ok: false, status: 400, fehler: 'Name fehlt.' };
  if (r.name.length > GRENZEN.skillName) return { ok: false, status: 413, fehler: `Name höchstens ${GRENZEN.skillName} Zeichen.` };
  if (!SKILL_NAME.test(r.name)) return { ok: false, status: 400, fehler: 'Name nur aus a–z, 0–9 und Bindestrichen (wie SKILL.md), z. B. „angebot-nachfassen“.' };
  const beschreibung = textFeld(r.beschreibung, GRENZEN.skillBeschreibung, 'Beschreibung (was + wann)'); if (!beschreibung.ok) return beschreibung;
  const anleitung = textFeld(r.anleitung, GRENZEN.skillAnleitung, 'Anleitung'); if (!anleitung.ok) return anleitung;
  let mitarbeiter: SkillKontext['mitarbeiter'][number] | null = null;
  if (r.mitarbeiterId !== undefined && r.mitarbeiterId !== null && r.mitarbeiterId !== '') {
    mitarbeiter = k.mitarbeiter.find(m => m.id === r.mitarbeiterId) ?? null;
    if (!mitarbeiter) return { ok: false, status: 400, fehler: 'Diesen Mitarbeiter hat der Head nicht.' };
  }
  const werkzeuge = werkzeugePruefen(r.werkzeuge, erlaubteWerkzeuge(k.head, mitarbeiter), mitarbeiter ? `„${mitarbeiter.name}“` : k.head.name); if (!werkzeuge.ok) return werkzeuge;
  const ausloeser = ausloeserPruefen(r.ausloeser); if (!ausloeser.ok) return ausloeser;
  const eingabeFelder = felderPruefen(r.eingabeFelder); if (!eingabeFelder.ok) return eingabeFelder;
  const beispiele = beispielePruefen(r.beispiele); if (!beispiele.ok) return beispiele;
  const tests = testsPruefen(r.tests); if (!tests.ok) return tests;
  if (r.freigabePflicht !== undefined && typeof r.freigabePflicht !== 'boolean') return { ok: false, status: 400, fehler: 'Freigabe-Pflicht: ja oder nein.' };
  if (r.ergebnis !== undefined && r.ergebnis !== 'faden' && r.ergebnis !== 'stapel') return { ok: false, status: 400, fehler: 'Ergebnis: als Thread oder in den Stapel.' };
  if (r.stufe !== undefined && !MODELL_STUFEN.includes(r.stufe as ModelTier)) return { ok: false, status: 400, fehler: 'Modellstufe: schnell, ausgewogen oder stark.' };
  if (r.aufwand !== undefined && r.aufwand !== null && !AUFWAENDE.includes(r.aufwand as Aufwand)) return { ok: false, status: 400, fehler: 'Aufwand: low, medium oder high.' };
  let kostenGrenzeCent: number | undefined;
  if (r.kostenGrenzeCent !== undefined && r.kostenGrenzeCent !== null) {
    if (!Number.isInteger(r.kostenGrenzeCent) || (r.kostenGrenzeCent as number) < 1) return { ok: false, status: 400, fehler: 'Kostengrenze je Lauf in ganzen Cent.' };
    if ((r.kostenGrenzeCent as number) > WERKSTATT_GRENZEN.kostenGrenzeMaxCent) return { ok: false, status: 413, fehler: `Kostengrenze je Lauf höchstens ${WERKSTATT_GRENZEN.kostenGrenzeMaxCent / 100} €.` };
    kostenGrenzeCent = r.kostenGrenzeCent as number;
  }
  return {
    ok: true,
    wert: {
      name: r.name, beschreibung: beschreibung.wert, anleitung: anleitung.wert,
      ...(mitarbeiter ? { mitarbeiterId: mitarbeiter.id } : {}),
      ...(beispiele.wert.length ? { beispiele: beispiele.wert } : {}),
      werkzeuge: werkzeuge.wert, ausloeser: ausloeser.wert, eingabeFelder: eingabeFelder.wert,
      freigabePflicht: r.freigabePflicht === true, ergebnis: r.ergebnis === 'stapel' ? 'stapel' : 'faden',
      stufe: (r.stufe as ModelTier | undefined) ?? k.head.stufe,
      ...(r.aufwand ? { aufwand: r.aufwand as Aufwand } : {}),
      ...(kostenGrenzeCent ? { kostenGrenzeCent } : {}),
      tests: tests.wert,
    },
  };
}

/** Der gespeicherte Skill trägt dazu frühere Fassungen und eine Nacht-Vormerkung — additive Felder, nur in diesem Bestand. */
export interface SkillFassung { version: number; am: string; von: string; inhalt: SkillInhalt }
export interface GespeicherterSkill extends Skill {
  /** Frühere Fassungen (neueste zuerst, höchstens `WERKSTATT_GRENZEN.versionenMerken`). */
  frueher?: SkillFassung[];
  /** So viele noch ältere Fassungen sind nur gezählt („+n ältere Fassungen“). */
  frueherWeg?: number;
  /** Testlauf nachts als Batch vorgemerkt (Fragerunde 14) — das Feld genügt; den Batch-Weg baut das Anbieter-Tor. */
  probelaufNachts?: { am: string; von: string; batch: true };
  /** Wer angelegt hat, bevor der Skill beim Konto-Löschen an den Inhaber ging (nur „[gelöscht]“ — nie der alte Name). */
  uebergeben?: { am: string };
}

export const inhaltVon = (s: Skill): SkillInhalt => {
  const o: Record<string, unknown> = {};
  for (const f of INHALT_FELDER) if ((s as unknown as Record<string, unknown>)[f] !== undefined) o[f] = (s as unknown as Record<string, unknown>)[f];
  return o as SkillInhalt;
};

const ERFOLG_NULL = { laeufe: 0, angenommen: 0, abgelehnt: 0, fehler: 0 };

/** Einen neuen Skill bauen (rein) — nie aktiv; Kennung und Zeit gibt der Aufrufer. */
export function skillNeu(inhalt: SkillInhalt, o: { id: string; headId: string; quelle: Skill['quelle']; von: string; am: string }): GespeicherterSkill {
  return { id: o.id, headId: o.headId, ...inhalt, erfolg: { ...ERFOLG_NULL }, aktiv: false, version: 1, quelle: o.quelle, angelegtVon: o.von, geaendertAm: o.am };
}

/**
 * Teil-Änderung (rein): nur Inhaltsfelder zählen, Server-Felder (aktiv, version, erfolg, angelegtVon, freigegebenVon, testlauf …) werden
 * ignoriert; `headId` wechselt nie (400). Inhalt geändert → neue Version, wieder aus, die alte Fassung kommt in `frueher`.
 */
export function skillAendern(alt: GespeicherterSkill, teil: unknown, k: SkillKontext, o: { von: string; am: string }): Pruefung<{ skill: GespeicherterSkill; geaendert: string[] }> {
  if (!teil || typeof teil !== 'object') return { ok: false, status: 400, fehler: 'Änderung fehlt.' };
  const t = teil as Record<string, unknown>;
  if (t.headId !== undefined && t.headId !== alt.headId) return { ok: false, status: 400, fehler: 'Ein Skill gehört genau einem Head — zum Umziehen einen neuen anlegen.' };
  const vorher = inhaltVon(alt);
  const roh: Record<string, unknown> = { ...vorher };
  for (const f of INHALT_FELDER) if (f in t) roh[f] = t[f] === null ? undefined : t[f];
  const p = skillPruefen(roh, k);
  if (!p.ok) return p;
  const geaendert = INHALT_FELDER.filter(f => JSON.stringify((p.wert as Record<string, unknown>)[f]) !== JSON.stringify((vorher as Record<string, unknown>)[f]));
  if (!geaendert.length) return { ok: true, wert: { skill: alt, geaendert: [] } };
  const fassung: SkillFassung = { version: alt.version, am: alt.geaendertAm ?? o.am, von: alt.freigegebenVon ?? alt.angelegtVon, inhalt: vorher };
  const frueher = [fassung, ...(alt.frueher ?? [])];
  const ueber = Math.max(0, frueher.length - WERKSTATT_GRENZEN.versionenMerken);
  const { aktiv: _a, freigegebenVon: _f, testlauf: _t, probelaufNachts: _p, frueher: _fr, frueherWeg: _fw, ...basis } = alt;
  const neu: GespeicherterSkill = {
    ...basis, ...p.wert,
    ...(p.wert.mitarbeiterId ? {} : { mitarbeiterId: undefined }),
    aktiv: false, version: alt.version + 1, geaendertAm: o.am,
    frueher: frueher.slice(0, WERKSTATT_GRENZEN.versionenMerken),
    ...((alt.frueherWeg ?? 0) + ueber ? { frueherWeg: (alt.frueherWeg ?? 0) + ueber } : {}),
  };
  if (!neu.mitarbeiterId) delete neu.mitarbeiterId;
  if (!p.wert.beispiele) delete neu.beispiele;
  if (!p.wert.aufwand) delete neu.aufwand;
  if (!p.wert.kostenGrenzeCent) delete neu.kostenGrenzeCent;
  return { ok: true, wert: { skill: neu, geaendert: [...geaendert] } };
}

// ── Testlauf und Aktivieren ──────────────────────────────────────────────────────────────────────────────────────────────

/** Ist der letzte Testlauf für die AKTUELLE Fassung gelungen? */
export const testlaufAktuell = (s: Pick<Skill, 'testlauf' | 'geaendertAm'>): boolean =>
  !!s.testlauf?.ok && (!s.geaendertAm || s.testlauf.am >= s.geaendertAm);

/** Was dem Einschalten fehlt (Sätze) — leer = darf per Klick aktiv werden. Rein. */
export function aktivierenFehlt(s: Skill, k: SkillKontext): string[] {
  const raus: string[] = [];
  if (s.tests.length < GRENZEN.skillTestsMin) raus.push(`Mindestens ${GRENZEN.skillTestsMin} Testfälle (bisher ${s.tests.length}).`);
  if (!s.testlauf) raus.push('Erst einen Testlauf machen (ohne Wirkung).');
  else if (!testlaufAktuell(s)) raus.push(s.testlauf.ok ? 'Der Skill wurde nach dem Testlauf geändert — bitte neu testen.' : 'Der letzte Testlauf ist nicht gelungen.');
  const p = skillPruefen(inhaltVon(s), k);
  if (!p.ok) raus.push(p.fehler);
  return raus;
}

/** Ergebnis eines Probelaufs je Testfall (vom Probeläufer). */
export interface ProbeErgebnis { ok: boolean; notiz?: string; /** Werkzeuge, die der Lauf aufgerufen hätte (nur im Trockenlauf). */ werkzeuge?: string[] }

/** Testlauf auswerten (rein): alle Fälle ok UND kein Werkzeug außerhalb des Skills. */
export function testlaufAus(s: Pick<Skill, 'tests' | 'werkzeuge'>, ergebnisse: readonly ProbeErgebnis[], von: string, am: string): SkillTestlauf {
  const liste = s.tests.map((_, i) => {
    const e = ergebnisse[i];
    if (!e) return { test: i, ok: false, notiz: 'kein Ergebnis' };
    const fremd = (e.werkzeuge ?? []).filter(w => !s.werkzeuge.includes(w) && !(MITARBEITER_WERKZEUGE as readonly string[]).includes(w));
    const ok = e.ok && !fremd.length;
    const notiz = [e.notiz, fremd.length ? `Werkzeug außerhalb des Skills: ${fremd.join(', ')}` : ''].filter(Boolean).join(' · ').slice(0, 300);
    return { test: i, ok, ...(notiz ? { notiz } : {}) };
  });
  return { am, von, ok: liste.length >= GRENZEN.skillTestsMin && liste.every(x => x.ok), ergebnisse: liste };
}

// ── SKILL.md importieren (Antwort 7) — nur Name, Beschreibung, Anleitung; Werkzeuge wählt die Person ─────────────────────────

function kopfWert(roh: string): string {
  const v = roh.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1).replace(/\\"/g, '"').replace(/''/g, "'");
  return v;
}

/**
 * SKILL.md lesen (rein): Kopf `---` mit `name` und `description` (eine Zeile, in Anführungszeichen oder als Block `>`/`|`), danach
 * die Anleitung. Andere Kopf-Felder (z. B. `allowed-tools`) werden NICHT übernommen — die Werkzeuge wählt die Person. Nur Text;
 * Skripte oder Dateien gibt es nicht (nichts Ausführbares, AGENTEN_KONZEPT.md C9.4).
 */
export function skillMdLesen(text: unknown): Pruefung<{ name: string; beschreibung: string; anleitung: string; ignoriert: string[] }> {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, status: 400, fehler: 'SKILL.md ist leer.' };
  if (text.length > WERKSTATT_GRENZEN.skillMd) return { ok: false, status: 413, fehler: `SKILL.md ist zu groß (höchstens ${WERKSTATT_GRENZEN.skillMd.toLocaleString('de-DE')} Zeichen).` };
  const t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (STEUER.test(t)) return { ok: false, status: 400, fehler: 'SKILL.md: nur Text — keine Steuerzeichen oder Binärdaten.' };
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/.exec(t);
  if (!m) return { ok: false, status: 400, fehler: 'SKILL.md braucht einen Kopf zwischen „---“ mit name und description.' };
  const kopf: Record<string, string> = {};
  const ignoriert: string[] = [];
  const zeilen = m[1].split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    const z = /^([A-Za-z][A-Za-z0-9_-]*):(.*)$/.exec(zeilen[i]);
    if (!z) continue;
    const key = z[1].toLowerCase();
    let wert = z[2].trim();
    if (wert === '>' || wert === '|' || wert === '>-' || wert === '|-') {
      const block: string[] = [];
      while (i + 1 < zeilen.length && (/^\s+\S/.test(zeilen[i + 1]) || zeilen[i + 1] === '')) block.push(zeilen[++i].trim());
      wert = wert.startsWith('>') ? block.filter(Boolean).join(' ') : block.join('\n').trim();
    } else wert = kopfWert(wert);
    if (key === 'name' || key === 'description') kopf[key] = wert;
    else ignoriert.push(key);
  }
  if (!kopf.name) return { ok: false, status: 400, fehler: 'SKILL.md: „name“ fehlt im Kopf.' };
  if (kopf.name.length > GRENZEN.skillName) return { ok: false, status: 413, fehler: `SKILL.md: name höchstens ${GRENZEN.skillName} Zeichen.` };
  if (!SKILL_NAME.test(kopf.name)) return { ok: false, status: 400, fehler: 'SKILL.md: name nur aus a–z, 0–9 und Bindestrichen.' };
  const beschreibung = textFeld(kopf.description, GRENZEN.skillBeschreibung, 'SKILL.md: description'); if (!beschreibung.ok) return beschreibung;
  const anleitung = textFeld(m[2], GRENZEN.skillAnleitung, 'SKILL.md: Anleitung'); if (!anleitung.ok) return anleitung;
  return { ok: true, wert: { name: kopf.name, beschreibung: beschreibung.wert, anleitung: anleitung.wert, ignoriert } };
}

/** Ein Skill als SKILL.md (Export, Teilen) — nur Name, Beschreibung, Anleitung. Rein. */
export function skillMdText(s: Pick<Skill, 'name' | 'beschreibung' | 'anleitung'>): string {
  return `---\nname: ${s.name}\ndescription: ${JSON.stringify(s.beschreibung)}\n---\n\n${s.anleitung}\n`;
}

// ── „Das als Skill speichern“ aus einem Thread (Antwort 7) ────────────────────────────────────────────────────────────────

const kurzText = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

/** Name aus einem Titel (kebab, Umlaute ausgeschrieben). Rein. */
export function nameAus(titel: string): string {
  const s = titel.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const k = s.slice(0, GRENZEN.skillName).replace(/-+$/g, '');
  return k && SKILL_NAME.test(k) ? k : 'skill-aus-thread';
}

/**
 * Ein Skill-Entwurf aus einem Thread (rein). Der Entwurf ist NIE aktiv; Testfälle trägt die Person nach. Hat der Thread fremden Text
 * gelesen (`fremdGelesen`), kommen nur die eigenen Nachrichten der Person in die Anleitung — kein Agententext, der eine eingeschleuste
 * Anweisung tragen könnte (Regel 6: fremder Text ist Daten).
 */
export function entwurfAusFaden(f: Pick<Faden, 'titel' | 'nachrichten' | 'fremdGelesen'>, k: SkillKontext, mitarbeiterId?: string): SkillInhalt {
  const eigene = f.nachrichten.filter(n => n.rolle === 'person' && n.text.trim());
  const agent = f.fremdGelesen ? [] : f.nachrichten.filter(n => n.rolle === 'agent' && n.text.trim());
  const ziel = eigene[0]?.text.trim() ?? f.titel;
  const teile: string[] = [`Ziel:\n${kurzText(ziel, 2_000)}`];
  const weitere = eigene.slice(1);
  if (weitere.length) {
    const schritte: string[] = [];
    let laenge = teile[0].length;
    for (const n of weitere) {
      const z = `- ${kurzText(n.text.trim().replace(/\n+/g, ' '), 600)}`;
      if (laenge + z.length > GRENZEN.skillAnleitung - 3_000) { schritte.push('- … (weitere Schritte im Thread)'); break; }
      schritte.push(z); laenge += z.length + 1;
    }
    teile.push(`So lief es im Thread (bitte zu einer festen Anleitung umschreiben):\n${schritte.join('\n')}`);
  }
  const letzte = agent[agent.length - 1]?.text.trim();
  if (letzte) teile.push(`Ergebnis im Thread (Beispiel):\n${kurzText(letzte, 2_000)}`);
  teile.push('Grenzen: nur Vorschläge — nichts nach außen ohne Klick.');
  const genutzt = Array.from(new Set(f.nachrichten.flatMap(n => (n.werkzeuge ?? []).filter(w => w.ok).map(w => w.name))));
  const ma = mitarbeiterId ? k.mitarbeiter.find(m => m.id === mitarbeiterId) ?? null : null;
  const erlaubt = erlaubteWerkzeuge(k.head, ma);
  return {
    name: nameAus(f.titel),
    beschreibung: kurzText(`Wiederholt den Ablauf aus dem Thread „${kurzText(f.titel, 120)}“. Wird genutzt, wenn dieselbe Aufgabe wieder ansteht — bitte „was“ und „wann“ genauer fassen.`, GRENZEN.skillBeschreibung),
    anleitung: teile.join('\n\n'),
    ...(ma ? { mitarbeiterId: ma.id } : {}),
    ...(letzte && eigene[0] ? { beispiele: [{ eingabe: kurzText(ziel, WERKSTATT_GRENZEN.beispielZeichen), ergebnis: kurzText(letzte, WERKSTATT_GRENZEN.beispielZeichen) }] } : {}),
    werkzeuge: genutzt.filter(w => erlaubt.includes(w)),
    ausloeser: { art: 'hand' }, eingabeFelder: [], freigabePflicht: true, ergebnis: 'faden', stufe: ma ? 'schnell' : k.head.stufe, tests: [],
  };
}

// ── Eingebaute Skills = die vorhandenen Modi (sichtbar, nicht änderbar) ───────────────────────────────────────────────────

const zp = (rhythmus: 'taeglich' | 'werktags' | 'woechentlich' | 'monatlich', uhrzeit: string, tage?: number[]): SkillAusloeser => ({ art: 'zeitplan', rhythmus, uhrzeit, ...(tage ? { tage } : {}) });
/** Neutrale Beschreibungen der Modi (keine Namen, keine Firmen). Der Auslöser ist nur die Anzeige — geplant wird im Takt der Heads. */
const EINGEBAUT: Readonly<Record<string, { beschreibung: string; ausloeser: SkillAusloeser }>> = {
  'heads:power_hour': { beschreibung: 'Bereitet die Power Hour vor: wer heute dran ist, mit Grund, Aufhänger und Kanal.', ausloeser: zp('werktags', '07:00') },
  'heads:lead_review': { beschreibung: 'Geht zum Wochenstart die Leads durch und schlägt vor, wen man qualifiziert, parkt oder ausscheidet.', ausloeser: zp('woechentlich', '09:00', [1]) },
  'heads:deal_review': { beschreibung: 'Prüft offene Deals: hängt etwas, fehlt ein nächster Schritt, stimmt die Prognose.', ausloeser: { art: 'hand' } },
  'heads:kundenreview': { beschreibung: 'Schaut am ersten Werktag des Monats auf laufende Mandate: Verlängerung, Ausbau, Risiken.', ausloeser: zp('monatlich', '09:00', [1]) },
  'heads:kampagne': { beschreibung: 'Plant eine Kampagne nach den Playbooks: Segment, Kanal mit Rechts-Ampel, Texte, Nachfassen.', ausloeser: { art: 'hand' } },
  'heads:wochenreview': { beschreibung: 'Fasst freitags die Vertriebswoche zusammen: was lief, was hängt, was nächste Woche zählt.', ausloeser: zp('woechentlich', '14:00', [5]) },
  'heads:wochenplan': { beschreibung: 'Plant montags die Marketing-Woche: Beiträge, Newsletter, Kampagnen-Schritte.', ausloeser: zp('woechentlich', '08:00', [1]) },
  'heads:netzwerk': { beschreibung: 'Plant werktags die Vernetzen-Runde — nur Regelwerk, ohne Modell.', ausloeser: zp('werktags', '08:00') },
  'heads:monatsreview': { beschreibung: 'Wertet am ersten Werktag des Monats Reichweite, Gespräche und Kampagnen aus.', ausloeser: zp('monatlich', '10:00', [1]) },
  'heads:planung': { beschreibung: 'Countdown in den sieben Tagen vor einem eigenen Event: Gäste, Ablauf, offene Punkte.', ausloeser: { art: 'hand' } },
  'heads:einladung': { beschreibung: 'Stellt eine Gästeliste mit guter Mischung zusammen — nur zulässige Kanäle.', ausloeser: { art: 'hand' } },
  'heads:nachfassen': { beschreibung: 'Bereitet am Tag nach einem Event das Nachfassen vor (binnen 48 Stunden).', ausloeser: { art: 'hand' } },
  'heads:wirkung': { beschreibung: 'Misst nach einem Event die Wirkung: Folgegespräche, Leads, Deals.', ausloeser: { art: 'hand' } },
  'finanzchef:tagescheck': { beschreibung: 'Schaut einmal am Tag auf Liquidität, Fälligkeiten und Auffälligkeiten — ohne Modell, wenn nichts neu ist.', ausloeser: zp('taeglich', '08:00') },
  'finanzchef:wochenreview': { beschreibung: 'Wochenblick zum Wochenstart: Plan/Ist, die nächsten zwölf Wochen, Entscheidungen.', ausloeser: zp('woechentlich', '08:00', [1]) },
  'finanzchef:monatsabschluss': { beschreibung: 'Begleitet den Monatsabschluss des Vormonats (vom dritten Werktag bis zum 20.).', ausloeser: zp('monatlich', '08:00', [3]) },
  'finanzchef:steuercheck': { beschreibung: 'Prüft vor einem Steuertermin die Rücklage und die Fristen — Hinweis, keine Steuerberatung.', ausloeser: { art: 'hand' } },
};

export const eingebautId = (quelle: 'heads' | 'finanzchef', modus: string) => `eingebaut:${quelle}:${modus}`;
export const istEingebautId = (id: string): boolean => id.startsWith('eingebaut:');

/** Die eingebauten Skills eines Heads (rein). Unbekannte Modi bekommen eine neutrale Beschreibung. */
export function eingebauteSkills(head: HeadDef): SkillKurz[] {
  if (!head.eingebaut) return [];
  const q = head.eingebaut.quelle;
  return head.eingebaut.modi.map(m => {
    const d = EINGEBAUT[`${q}:${m}`];
    return {
      id: eingebautId(q, m), headId: head.id, name: m.replace(/_/g, '-'),
      beschreibung: d?.beschreibung ?? 'Eingebauter Ablauf dieses Heads.', ausloeser: d?.ausloeser ?? { art: 'hand' }, aktiv: true, eingebaut: true as const,
    };
  });
}

export const skillKurz = (s: Skill): SkillKurz => ({
  id: s.id, headId: s.headId, ...(s.mitarbeiterId ? { mitarbeiterId: s.mitarbeiterId } : {}), name: s.name, beschreibung: s.beschreibung,
  ausloeser: s.ausloeser, aktiv: s.aktiv, erfolg: s.erfolg, ...(s.ausFremdemText ? { ausFremdemText: true as const } : {}),
});

/** Erfolgsquote eines Skills (Antwort 7): angenommen ÷ (angenommen + abgelehnt + Fehler) — oder null ohne Entscheidung. Rein. */
export function erfolgsquote(e: Skill['erfolg'] | undefined): number | null {
  if (!e) return null;
  const n = e.angenommen + e.abgelehnt + e.fehler;
  return n ? e.angenommen / n : null;
}

// ── Mitarbeiter (Antwort 4: Vorlagen, selbst anlegen, geteilt über Heads, eigenes Gedächtnis) ─────────────────────────────

export type MitarbeiterInhalt = Pick<Mitarbeiter, 'name' | 'rolle' | 'werkzeuge' | 'auchFuer' | 'stufe' | 'aktiv'> & Partial<Pick<Mitarbeiter, 'anleitung' | 'aufwand'>>;
const MA_FELDER = ['name', 'rolle', 'anleitung', 'werkzeuge', 'auchFuer', 'stufe', 'aufwand', 'aktiv'] as const;

/** Mitarbeiter-Inhalt prüfen (rein): Werkzeuge ⊆ Head (400), Aushilfe nur bei Heads desselben Bereichs, Grenzen 413. */
export function mitarbeiterPruefen(roh: unknown, head: HeadDef): Pruefung<MitarbeiterInhalt> {
  if (!roh || typeof roh !== 'object') return { ok: false, status: 400, fehler: 'Mitarbeiter fehlt.' };
  const r = roh as Record<string, unknown>;
  const name = textFeld(r.name, WERKSTATT_GRENZEN.mitarbeiterName, 'Name'); if (!name.ok) return name;
  if (name.wert.includes('\n')) return { ok: false, status: 400, fehler: 'Name in einer Zeile.' };
  const rolle = textFeld(r.rolle, WERKSTATT_GRENZEN.mitarbeiterRolle, 'Rolle'); if (!rolle.ok) return rolle;
  const anleitung = textFeld(r.anleitung, GRENZEN.mitarbeiterAnleitung, 'Anleitung', false); if (!anleitung.ok) return anleitung;
  const w = werkzeugePruefen(r.werkzeuge, head.werkzeuge, head.name); if (!w.ok) return w;
  if (w.wert.length + MITARBEITER_WERKZEUGE.length > GRENZEN.werkzeugeJeHead) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.werkzeugeJeHead - MITARBEITER_WERKZEUGE.length} Werkzeuge je Mitarbeiter.` };
  let auchFuer: string[] = [];
  if (r.auchFuer !== undefined && r.auchFuer !== null) {
    if (!Array.isArray(r.auchFuer) || !r.auchFuer.every(x => typeof x === 'string')) return { ok: false, status: 400, fehler: 'Hilft auch: Liste von Heads.' };
    auchFuer = Array.from(new Set(r.auchFuer as string[]));
    for (const h of auchFuer) {
      const z = headDef(h);
      if (!z || h === head.id) return { ok: false, status: 400, fehler: `Hilft auch: „${h}“ ist kein anderer Head.` };
      if (z.bereich !== head.bereich) return { ok: false, status: 400, fehler: `Hilft auch: ${z.name} gehört zu einem anderen Bereich — Business und Privat bleiben getrennt.` };
    }
  }
  if (r.stufe !== undefined && !MODELL_STUFEN.includes(r.stufe as ModelTier)) return { ok: false, status: 400, fehler: 'Modellstufe: schnell, ausgewogen oder stark.' };
  if (r.aufwand !== undefined && r.aufwand !== null && !AUFWAENDE.includes(r.aufwand as Aufwand)) return { ok: false, status: 400, fehler: 'Aufwand: low, medium oder high.' };
  if (r.aktiv !== undefined && typeof r.aktiv !== 'boolean') return { ok: false, status: 400, fehler: 'Aktiv: ja oder nein.' };
  return {
    ok: true,
    wert: {
      name: name.wert, rolle: rolle.wert, ...(anleitung.wert ? { anleitung: anleitung.wert } : {}), werkzeuge: w.wert, auchFuer,
      stufe: (r.stufe as ModelTier | undefined) ?? 'schnell', ...(r.aufwand ? { aufwand: r.aufwand as Aufwand } : {}), aktiv: r.aktiv !== false,
    },
  };
}

/** Teil-Änderung eines Mitarbeiters (rein) auf den bisherigen Stand (Vorlage oder eigener). */
export function mitarbeiterAendern(alt: Mitarbeiter, teil: unknown, head: HeadDef): Pruefung<{ mitarbeiter: Mitarbeiter; geaendert: string[] }> {
  if (!teil || typeof teil !== 'object') return { ok: false, status: 400, fehler: 'Änderung fehlt.' };
  const t = teil as Record<string, unknown>;
  const roh: Record<string, unknown> = { name: alt.name, rolle: alt.rolle, anleitung: alt.anleitung, werkzeuge: alt.werkzeuge, auchFuer: alt.auchFuer, stufe: alt.stufe, aufwand: alt.aufwand, aktiv: alt.aktiv };
  for (const f of MA_FELDER) if (f in t) roh[f] = t[f] === null ? undefined : t[f];
  const p = mitarbeiterPruefen(roh, head);
  if (!p.ok) return p;
  const geaendert = MA_FELDER.filter(f => JSON.stringify((p.wert as Record<string, unknown>)[f] ?? null) !== JSON.stringify((alt as unknown as Record<string, unknown>)[f] ?? null));
  const neu: Mitarbeiter = { ...alt, ...p.wert };
  if (!p.wert.anleitung) delete neu.anleitung;
  if (!p.wert.aufwand) delete neu.aufwand;
  return { ok: true, wert: { mitarbeiter: neu, geaendert: [...geaendert] } };
}

/** Laufzeit-Mitarbeiter aus einer Vorlage (rein) — dieselbe Form wie in skills-lesen. */
export function ausVorlage(id: string): Mitarbeiter | null {
  const v = vorlageVon(id);
  if (!v) return null;
  const m = v.vorlage;
  return {
    id: m.id, headId: v.head.id, vorlageId: m.id, name: m.name, rolle: m.rolle, werkzeuge: [...m.werkzeuge], auchFuer: [...(m.auchFuer ?? [])],
    ...(m.agentId ? { agentId: m.agentId } : {}), stufe: m.stufe, ...(m.anbieter ? { anbieter: m.anbieter } : {}), aktiv: true, gedaechtnis: [], quelle: 'vorlage',
  };
}

/**
 * Die Mitarbeiter eines Heads (rein): Vorlagen (mit gespeicherten Überschreibungen) und eigene — dazu Aushilfen anderer Heads
 * desselben Bereichs (`auchFuer`), die `headId` der Heimat behalten. Reihenfolge: eigene Vorlagen, eigene Angelegte, Aushilfen.
 */
export function mitarbeiterListe(headId: string, gespeichert: readonly Mitarbeiter[]): Mitarbeiter[] {
  const head = headDef(headId);
  if (!head) return [];
  const je = new Map(gespeichert.map(m => [m.id, m]));
  const heimat = (h: HeadDef): Mitarbeiter[] => [
    ...h.mitarbeiter.map(v => je.get(v.id) ?? ausVorlage(v.id)!).filter(Boolean),
    ...gespeichert.filter(m => m.headId === h.id && !m.vorlageId),
  ];
  const eigene = heimat(head);
  const aushilfen = KATALOG.filter(h => h.id !== head.id && h.bereich === head.bereich).flatMap(heimat).filter(m => m.auchFuer.includes(head.id));
  return [...eigene, ...aushilfen];
}

// ── Gedächtnis (Merksätze) ───────────────────────────────────────────────────────────────────────────────────────────────

const normal = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** Einen Merksatz anhängen (rein): ≤ 300 Zeichen (413), höchstens 100 je Agent (413), derselbe Satz nur einmal. */
export function merksatzHinzu(liste: readonly Merksatz[], m: Omit<Merksatz, 'text'> & { text: unknown }): Pruefung<{ liste: Merksatz[]; neu: boolean }> {
  const t = textFeld(m.text, GRENZEN.merksatzZeichen, 'Merksatz'); if (!t.ok) return t;
  if (t.wert.includes('\n')) return { ok: false, status: 400, fehler: 'Ein Merksatz ist ein Satz in einer Zeile.' };
  if (liste.some(x => normal(x.text) === normal(t.wert))) return { ok: true, wert: { liste: [...liste], neu: false } };
  if (liste.length >= GRENZEN.merksaetzeJeAgent) return { ok: false, status: 413, fehler: `Höchstens ${GRENZEN.merksaetzeJeAgent} Merksätze je Agent — bitte erst ältere entfernen.` };
  return { ok: true, wert: { liste: [...liste, { ...m, text: t.wert } as Merksatz], neu: true } };
}

// ── Bestand ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const leereWerkstatt = (): WerkstattBestand => ({ v: 1, skills: [], mitarbeiter: [], gedaechtnis: {} });

/** Einen gelesenen Bestand tolerant aufbereiten (nie werfen, nie kürzen). */
export function werkstattLesen(roh: unknown): Omit<WerkstattBestand, 'skills'> & { skills: GespeicherterSkill[] } {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Partial<WerkstattBestand>;
  return {
    v: 1,
    skills: Array.isArray(r.skills) ? (r.skills as GespeicherterSkill[]) : [],
    mitarbeiter: Array.isArray(r.mitarbeiter) ? r.mitarbeiter : [],
    gedaechtnis: r.gedaechtnis && typeof r.gedaechtnis === 'object' && !Array.isArray(r.gedaechtnis) ? r.gedaechtnis : {},
  };
}
