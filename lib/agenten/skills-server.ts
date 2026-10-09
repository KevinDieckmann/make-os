// ─── Agenten-Bereich: die Werkstatt auf dem Server — Skills, eigene Mitarbeiter, Gedächtnis (09.10., Paket 3; AGENTEN_KONZEPT.md C11) ─
// EINE Schreibstelle für die Bestände `agenten-skills--<haushalt>` (Heads der Ebene Haushalt: alle Business-Heads, Familie) und
// `agenten-skills-privat--<person>` (Privat-Heads je Person) — Regeln rein in lib/agenten/skills.ts.
//   • Wer: nur die Person der Sitzung (Route `eigenePerson`), nur für Heads, die sie sehen darf (`headSichtbar` — Schnittstelle zu
//     Paket 1, lib/agenten/sicht.ts; bis zum Zusammenführen die vorläufige Regel unten). Business-Skills gehören dem Haushalt
//     (`angelegtVon` vermerkt), Privat-Skills der Person (eigener Bestand).
//   • Einzeländerungen mit Stand (409 + aktueller Eintrag), Grenzen 413, Änderungsprotokoll nur Kennung + Feldnamen.
//   • Vorschläge von Agenten (Skill, Mitarbeiter, Merksatz) kommen NUR über den Stapel (`vorschlagSkillLegen` …, Arten in
//     lib/zoe/stapel-arten.ts) — der Klick der Person übernimmt; ein Skill ist danach ein Entwurf, aktiv erst nach Testlauf + Klick.
//   • Testlauf: ohne Wirkung. Seit Paket 4a läuft er durch die echte Schleife im Trockenlauf (lib/agenten/probelauf.ts); Tests tauschen
//     ihn über `probelaeuferVerdrahten` aus. Sicht: die EINE Filterstelle lib/agenten/sicht.ts (`headSichtbarKern`).

import { headDef, KATALOG } from './katalog';
import {
  GRENZEN, agentSchluessel, fadenBestand, werkstattBestandFuer,
  type AgentRef, type FadenBestand, type HeadDef, type Merksatz, type Mitarbeiter, type Skill, type SkillKurz, type SkillTest, type Umfang,
  type WerkstattBestand,
} from './typen';
import {
  aktivierenFehlt, ausVorlage, eingebauteSkills, entwurfAusFaden, istEingebautId, merksatzHinzu, mitarbeiterAendern, mitarbeiterListe,
  mitarbeiterPruefen, skillAendern, skillKurz, skillMdLesen, skillNeu, skillPruefen, standVon, testlaufAus, textFeld, werkstattLesen,
  type GespeicherterSkill, type ProbeErgebnis, type SkillInhalt, type SkillKontext,
} from './skills';
import { kostenSchaetzen, GROSS_AB_CENT, type KostenSchaetzung } from './leistung';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { protokolliere, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { kontoFuerSpeicher } from '@/lib/zugang/konten';
import { kontoSicht } from '@/lib/zugang/konto-sicht-server';
import { haushaltDesInhabers, personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { HAUSHALT_OK, haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { gesundheitStandFuer } from '@/lib/datenschutz/gesundheit-einwilligung';
import { beanspruche, entscheide, lege, loslassen, type Vorschlag } from '@/lib/zoe/stapel';
import type { StapelArtFreigabe, ArtErgebnis } from '@/lib/zoe/stapel-arten';

const PERSON = /^[a-z0-9-]{1,40}$/;

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413 | 429; fehler: string; [k: string]: unknown };
export type Ergebnis<T extends object> = ({ ok: true } & T) | Fehler;
const fehler = (status: Fehler['status'], text: string, extra: Record<string, unknown> = {}): Fehler => ({ ok: false, status, fehler: text, ...extra });

// ── Sicht (Schnittstelle zu Paket 1) ─────────────────────────────────────────────────────────────────────────────────────

/** Darf diese Person den Head sehen? — Paket 1 (lib/agenten/sicht.ts `headSichtbar`) ist die EINE Filterstelle; beim Zusammenführen hier verdrahtet. */
export type HeadSichtbar = (person: string, headId: string) => Promise<boolean>;

/**
 * Vorläufige Regel bis zum Zusammenführen (dieselbe Tabelle wie AGENTEN_KONZEPT.md C5): nur Personen im Haushalt des Inhabers;
 * Business-Heads für alle davon; Privat-Heads nie für Konten mit `finanzRecht: 'business'`; Familie (Ebene Haushalt) nur für volle
 * Mitglieder; Gesundheit nur mit Einwilligung (a)+(b); Finanzen privat nur mit Haushaltszugang im Haushalt des Inhabers.
 */
export async function vorlaeufigHeadSichtbar(person: string, headId: string): Promise<boolean> {
  const h = headDef(headId);
  if (!h || !PERSON.test(person) || !(await personImHaushaltDesInhabers(person))) return false;
  if (h.bereich === 'privat') {
    // EINE Konto-Sicht (09.10., E4, lib/zugang/konto-sicht.ts): Privat nie für „nur Business“, Haushalts-Ebene nur volle Mitglieder.
    const k = await kontoSicht(person);
    if (!k || k.nurBusiness) return false;
    if (h.ebene === 'haushalt' && !k.vollesMitglied) return false;
  }
  if (h.voraussetzung === 'gesundheit-ki') {
    const s = await gesundheitStandFuer(person);
    if (!s.verarbeitungErlaubt || !s.ki.an) return false;
  }
  if (h.voraussetzung === 'privat-finanzen') {
    const z = await haushaltFuer(person);
    if (!z || z.haushalt !== (await haushaltDesInhabers())) return false;
  }
  return true;
}

/**
 * Die EINE Filterstelle (lib/agenten/sicht.ts `headSichtbar` über die Sicht des Kontos, faeden-server.ts `sichtLaden`) — seit Paket 4a
 * (09.10.) verdrahtet; die vorläufige Regel oben bleibt nur als Vergleich in den Tests. Geladen erst beim Aufruf (kein Import-Kreis).
 */
export const headSichtbarKern: HeadSichtbar = async (person, headId) => {
  const [{ sichtLaden }, sicht] = await Promise.all([import('./faeden-server'), import('./sicht')]);
  return sicht.headSichtbar(await sichtLaden(person), headId);
};
let sichtImpl: HeadSichtbar = headSichtbarKern;
/** Austausch der Filterstelle — nur noch für Tests (der Betrieb nimmt `headSichtbarKern`). */
export function sichtVerdrahten(f: HeadSichtbar): void { sichtImpl = f; }
export const headSichtbar: HeadSichtbar = (person, headId) => sichtImpl(person, headId);
/** Alle Heads, die die Person sieht (Katalog-Reihenfolge). */
export async function sichtbareHeads(person: string): Promise<HeadDef[]> {
  const raus: HeadDef[] = [];
  for (const h of KATALOG) if (await headSichtbar(person, h.id).catch(() => false)) raus.push(h);
  return raus;
}

/** Wessen Daten ein Aufruf betrifft: die Person aus der Sitzung, der Haushalt aus ihrem Konto (sonst der des Inhabers). */
export async function umfangFuer(person: string): Promise<Umfang> {
  const k = await kontoFuerSpeicher(person);
  const h = k?.haushalt && HAUSHALT_OK.test(k.haushalt) ? k.haushalt : await haushaltDesInhabers();
  return { person, haushalt: h ?? null };
}

// ── Bestand lesen und schreiben ──────────────────────────────────────────────────────────────────────────────────────────

type Werkstatt = Omit<WerkstattBestand, 'skills'> & { skills: GespeicherterSkill[] };

export async function werkstattLaden(name: string): Promise<Werkstatt> {
  return werkstattLesen(await loadJson<WerkstattBestand>(name));
}

/** Abbruch in der Sperre — der Bestand wird dann nicht geschrieben (updateJson schreibt nicht, wenn `mutate` wirft). */
class Abbruch { constructor(readonly raus: unknown) {} }

/** In EINER Sperre lesen, prüfen, schreiben. `fn` liefert den neuen Bestand oder wirft über `halt(raus)` ab. */
async function inWerkstatt<T>(name: string, fn: (w: Werkstatt, halt: (raus: T) => never) => { neu: WerkstattBestand; raus: T }): Promise<T> {
  let raus!: T;
  try {
    await updateJson<WerkstattBestand>(name, cur => {
      const r = fn(werkstattLesen(cur), x => { throw new Abbruch(x); });
      raus = r.raus;
      return r.neu;
    });
  } catch (e) {
    if (e instanceof Abbruch) return e.raus as T;
    throw e;
  }
  return raus;
}

const protokoll = (name: string, a: Aenderung[], person: string) => protokolliere(name, a, { art: 'person', person }).catch(() => {});

/** Kontext eines Heads (Mitarbeiter aus dem Bestand) und der Name seines Werkstatt-Bestands — oder ein Fehler. */
async function headKontext(person: string, headId: unknown): Promise<Ergebnis<{ head: HeadDef; name: string; umfang: Umfang }>> {
  if (typeof headId !== 'string' || !headId) return fehler(400, 'Head fehlt.');
  const head = headDef(headId);
  if (!head) return fehler(404, 'Diesen Head gibt es nicht.');
  if (!(await headSichtbar(person, head.id))) return fehler(403, 'Diesen Head siehst du nicht.');
  const umfang = await umfangFuer(person);
  const name = werkstattBestandFuer(head.ebene, umfang);
  if (!name) return fehler(409, 'Für Business-Heads braucht die Instanz einen Haushalt (System › Konto).');
  return { ok: true, head, name, umfang };
}

const kontext = (head: HeadDef, w: Werkstatt): SkillKontext => ({ head, mitarbeiter: mitarbeiterListe(head.id, w.mitarbeiter) });

/** Einen Skill über alle Bestände finden, die die Person sehen darf (Haushalt + eigener). */
async function skillFinden(person: string, id: unknown): Promise<Ergebnis<{ skill: GespeicherterSkill; head: HeadDef; name: string; w: Werkstatt }>> {
  if (typeof id !== 'string' || !/^sk-[a-z0-9-]{1,60}$/.test(id)) return fehler(istEingebautId(String(id)) ? 409 : 400, istEingebautId(String(id)) ? 'Eingebaute Skills sind sichtbar, aber nicht änderbar.' : 'Skill-Kennung fehlt.');
  const umfang = await umfangFuer(person);
  for (const ebene of ['haushalt', 'person'] as const) {
    const name = werkstattBestandFuer(ebene, umfang);
    if (!name) continue;
    const w = await werkstattLaden(name);
    const skill = w.skills.find(s => s.id === id);
    if (!skill) continue;
    const head = headDef(skill.headId);
    if (!head || head.ebene !== ebene || !(await headSichtbar(person, head.id))) return fehler(404, 'Skill nicht gefunden.');
    return { ok: true, skill, head, name, w };
  }
  return fehler(404, 'Skill nicht gefunden.');
}

// ── Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface WerkstattSicht {
  skills: SkillKurz[];
  mitarbeiter: Mitarbeiter[];
  gedaechtnis?: Merksatz[];
  /** Stand je eigenem Skill und gespeichertem Mitarbeiter (für Einzeländerungen mit 409). */
  staende: Record<string, string>;
}

/** Skills (eingebaute + eigene) und Mitarbeiter eines bzw. aller sichtbaren Heads; mit Head auch das Gedächtnis. */
export async function werkstattSicht(person: string, headId?: string | null): Promise<Ergebnis<WerkstattSicht>> {
  const heads = headId ? [headDef(headId)].filter((h): h is HeadDef => !!h) : await sichtbareHeads(person);
  if (headId && !heads.length) return fehler(404, 'Diesen Head gibt es nicht.');
  if (headId && !(await headSichtbar(person, headId))) return fehler(403, 'Diesen Head siehst du nicht.');
  const umfang = await umfangFuer(person);
  const cache = new Map<string, Werkstatt>();
  const laden = async (name: string) => { if (!cache.has(name)) cache.set(name, await werkstattLaden(name)); return cache.get(name)!; };
  const raus: WerkstattSicht = { skills: [], mitarbeiter: [], staende: {} };
  for (const h of heads) {
    const name = werkstattBestandFuer(h.ebene, umfang);
    const w = name ? await laden(name) : werkstattLesen(null);
    raus.skills.push(...eingebauteSkills(h), ...w.skills.filter(s => s.headId === h.id).map(skillKurz));
    for (const s of w.skills.filter(s => s.headId === h.id)) raus.staende[s.id] = standVon(s);
    const ma = headId ? mitarbeiterListe(h.id, w.mitarbeiter) : mitarbeiterListe(h.id, w.mitarbeiter).filter(m => m.headId === h.id);
    for (const m of ma) if (!raus.mitarbeiter.some(x => x.id === m.id)) raus.mitarbeiter.push(m);
    for (const m of w.mitarbeiter.filter(m => m.headId === h.id)) raus.staende[m.id] = standVon(m);
    if (headId) raus.gedaechtnis = w.gedaechtnis[h.id] ?? [];
  }
  return { ok: true, ...raus };
}

/** Alle eigenen Skills (gespeichert, nicht eingebaut) der übergebenen — sichtbaren — Heads. */
export async function sichtbareSkills(person: string, heads: readonly HeadDef[], umfang?: Umfang): Promise<GespeicherterSkill[]> {
  const u = umfang ?? await umfangFuer(person);
  const ids = new Set(heads.map(h => h.id));
  const raus: GespeicherterSkill[] = [];
  for (const ebene of ['haushalt', 'person'] as const) {
    const name = werkstattBestandFuer(ebene, u);
    if (!name) continue;
    for (const s of (await werkstattLaden(name)).skills) if (ids.has(s.headId) && headDef(s.headId)?.ebene === ebene) raus.push(s);
  }
  return raus;
}

/** Ein eigener Skill mit Anleitung und Stand (Editor). */
export async function skillMitStand(person: string, id: string): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string; aktivierenFehlt: string[] }>> {
  const f = await skillFinden(person, id);
  if (!f.ok) return f;
  return { ok: true, skill: f.skill, stand: standVon(f.skill), aktivierenFehlt: aktivierenFehlt(f.skill, kontext(f.head, f.w)) };
}

// ── Skills schreiben ─────────────────────────────────────────────────────────────────────────────────────────────────────

const skillsDesHeads = (w: Werkstatt, headId: string) => w.skills.filter(s => s.headId === headId);
const nameFrei = (w: Werkstatt, headId: string, name: string, ausser?: string) => !skillsDesHeads(w, headId).some(s => s.name === name && s.id !== ausser);

/**
 * Ist dieser Thread (der Person) „fremd gelesen“? Für „Als Skill speichern“ (Nahtstellen-Prüfung 09.10., Punkt 8): die Oberfläche gibt den Thread
 * mit (`ausFaden`), der Server entscheidet. Eine Kennung, die es (nicht mehr) gibt, gilt vorsichtshalber als fremd.
 */
async function fadenFremd(person: string, fadenId: unknown): Promise<boolean> {
  if (typeof fadenId !== 'string' || !fadenId) return false;
  const f = (await loadJson<FadenBestand>(fadenBestand(person)))?.faeden?.find(x => x.id === fadenId);
  return !f || !!f.fremdGelesen;
}

/**
 * Einen Skill anlegen (Entwurf, nie aktiv). `quelle`: hand · gespraech · import · vorschlag (nur über den Stapel). `ausFremdemText` (Punkt 8):
 * der Inhalt kam aus fremd gelesenem Text — gesetzt vom Stapel (Vorschlag aus so einem Thread) bzw. hier aus `ausFaden` („Als Skill speichern“).
 */
export async function skillAnlegen(person: string, roh: unknown, quelle: Skill['quelle'] = 'hand', opt: { ausFremdemText?: boolean } = {}): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string }>> {
  const r = (roh && typeof roh === 'object' ? roh : {}) as Record<string, unknown>;
  const hk = await headKontext(person, r.headId);
  if (!hk.ok) return hk;
  const ausFremd = !!opt.ausFremdemText || (r.ausFaden !== undefined && (await fadenFremd(person, r.ausFaden)));
  const am = new Date().toISOString();
  const raus = await inWerkstatt<Ergebnis<{ skill: GespeicherterSkill; stand: string }>>(hk.name, (w, halt) => {
    const p = skillPruefen(r, kontext(hk.head, w));
    if (!p.ok) halt(p);
    const inhalt = (p as { wert: SkillInhalt }).wert;
    if (skillsDesHeads(w, hk.head.id).length >= GRENZEN.skillsJeHead) halt(fehler(413, `Höchstens ${GRENZEN.skillsJeHead} Skills je Head.`));
    if (!nameFrei(w, hk.head.id, inhalt.name)) halt(fehler(409, `Einen Skill „${inhalt.name}“ hat dieser Head schon.`));
    const skill: GespeicherterSkill = { ...skillNeu(inhalt, { id: neueKennung('sk'), headId: hk.head.id, quelle, von: person, am }), ...(ausFremd ? { ausFremdemText: true as const } : {}) };
    return { neu: { ...w, skills: [...w.skills, skill] }, raus: { ok: true, skill, stand: standVon(skill) } };
  });
  if (raus.ok) await protokoll(hk.name, [{ liste: 'skills', op: 'neu', id: raus.skill.id }], person);
  return raus;
}

/** Inhalt ändern (mit Stand) — neue Version, wieder aus. */
export async function skillAendernAktion(person: string, id: unknown, teil: unknown, stand: unknown): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string }>> {
  const f = await skillFinden(person, id);
  if (!f.ok) return f;
  let felder: string[] = [];
  const raus = await inWerkstatt<Ergebnis<{ skill: GespeicherterSkill; stand: string }>>(f.name, (w, halt) => {
    const alt = w.skills.find(s => s.id === f.skill.id);
    if (!alt) halt(fehler(404, 'Skill nicht gefunden.'));
    if (stand !== standVon(alt)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, skill: alt, stand: standVon(alt) }));
    const p = skillAendern(alt!, teil, kontext(f.head, w), { von: person, am: new Date().toISOString() });
    if (!p.ok) halt(p);
    const { skill, geaendert } = (p as { wert: { skill: GespeicherterSkill; geaendert: string[] } }).wert;
    if (!nameFrei(w, f.head.id, skill.name, skill.id)) halt(fehler(409, `Einen Skill „${skill.name}“ hat dieser Head schon.`));
    felder = geaendert;
    if (!geaendert.length) halt({ ok: true, skill: alt!, stand: standVon(alt) });
    return { neu: { ...w, skills: w.skills.map(s => (s.id === skill.id ? skill : s)) }, raus: { ok: true, skill, stand: standVon(skill) } };
  });
  if (raus.ok && felder.length) await protokoll(f.name, [{ liste: 'skills', op: 'geaendert', id: raus.skill.id, felder }], person);
  return raus;
}

/** Aktivieren (nur per Klick der Person, erst nach gelungenem Testlauf der aktuellen Fassung) bzw. ausschalten. */
export async function skillAktivAktion(person: string, id: unknown, an: boolean, stand: unknown): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string }>> {
  const f = await skillFinden(person, id);
  if (!f.ok) return f;
  const raus = await inWerkstatt<Ergebnis<{ skill: GespeicherterSkill; stand: string }>>(f.name, (w, halt) => {
    const alt = w.skills.find(s => s.id === f.skill.id);
    if (!alt) halt(fehler(404, 'Skill nicht gefunden.'));
    if (stand !== standVon(alt)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, skill: alt, stand: standVon(alt) }));
    if (alt!.aktiv === an) halt({ ok: true, skill: alt!, stand: standVon(alt) });
    if (an) {
      const fehlt = aktivierenFehlt(alt!, kontext(f.head, w));
      if (fehlt.length) halt(fehler(409, `Noch nicht einschaltbar: ${fehlt.join(' ')}`, { fehlt }));
    }
    const neu: GespeicherterSkill = an ? { ...alt!, aktiv: true, freigegebenVon: person } : { ...alt!, aktiv: false };
    return { neu: { ...w, skills: w.skills.map(s => (s.id === neu.id ? neu : s)) }, raus: { ok: true, skill: neu, stand: standVon(neu) } };
  });
  if (raus.ok) await protokoll(f.name, [{ liste: 'skills', op: 'geaendert', id: raus.skill.id, felder: an ? ['aktiv', 'freigegebenVon'] : ['aktiv'] }], person);
  return raus;
}

/** Löschen (mit Stand). */
export async function skillLoeschenAktion(person: string, id: unknown, stand: unknown): Promise<Ergebnis<{ id: string }>> {
  const f = await skillFinden(person, id);
  if (!f.ok) return f;
  const raus = await inWerkstatt<Ergebnis<{ id: string }>>(f.name, (w, halt) => {
    const alt = w.skills.find(s => s.id === f.skill.id);
    if (!alt) halt({ ok: true, id: f.skill.id });
    if (stand !== standVon(alt)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, skill: alt, stand: standVon(alt) }));
    return { neu: { ...w, skills: w.skills.filter(s => s.id !== f.skill.id) }, raus: { ok: true, id: f.skill.id } };
  });
  if (raus.ok) await protokoll(f.name, [{ liste: 'skills', op: 'geloescht', id: f.skill.id }], person);
  return raus;
}

/** SKILL.md importieren — nur Name, Beschreibung, Anleitung; ein Entwurf ohne Werkzeuge, nie aktiv. */
export async function skillImportAktion(person: string, headId: unknown, skillMd: unknown): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string; ignoriert: string[] }>> {
  const p = skillMdLesen(skillMd);
  if (!p.ok) return fehler(p.status, p.fehler);
  const r = await skillAnlegen(person, { headId, name: p.wert.name, beschreibung: p.wert.beschreibung, anleitung: p.wert.anleitung, werkzeuge: [] }, 'import');
  return r.ok ? { ...r, ignoriert: p.wert.ignoriert } : r;
}

/** „Das als Skill speichern“ aus einem eigenen Thread (nur lesend aus `agenten-faeden--<person>`). Entwurf, nie aktiv. */
export async function skillAusFadenAktion(person: string, fadenId: unknown, headIdWahl?: unknown): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string }>> {
  if (typeof fadenId !== 'string' || !/^fd-[a-z0-9-]{1,60}$/.test(fadenId)) return fehler(400, 'Thread-Kennung fehlt.');
  const f = (await loadJson<FadenBestand>(fadenBestand(person)))?.faeden?.find(x => x.id === fadenId);
  if (!f || f.besitzer !== person) return fehler(404, 'Thread nicht gefunden.');
  const headId = f.agent.art === 'zoe' ? headIdWahl : f.agent.headId;
  const hk = await headKontext(person, headId);
  if (!hk.ok) return hk;
  const w = await werkstattLaden(hk.name);
  const entwurf = entwurfAusFaden(f, kontext(hk.head, w), f.agent.art === 'mitarbeiter' ? f.agent.mitarbeiterId : undefined);
  let name = entwurf.name;
  for (let i = 2; !nameFrei(w, hk.head.id, name) && i < 100; i++) name = `${entwurf.name.slice(0, GRENZEN.skillName - 4)}-${i}`;
  return skillAnlegen(person, { ...entwurf, name, headId: hk.head.id }, 'gespraech');
}

// ── Testlauf (ohne Wirkung) ──────────────────────────────────────────────────────────────────────────────────────────────

export interface ProbelaufAuftrag { skill: Skill; head: HeadDef; test: SkillTest; nr: number; person: string }
/** Führt EINEN Testfall ohne Wirkung aus. Paket 1 verdrahtet die echte Schleife (alle Werkzeuge im Trockenlauf). */
export type Probelaeufer = (a: ProbelaufAuftrag) => Promise<ProbeErgebnis>;

/**
 * Vorläufiger Probeläufer: EIN Modell-Aufruf ohne Werkzeuge (es kann nichts wirken) — die Anleitung als System-Text, der Testfall als
 * Eingabe; das Modell beschreibt, was es täte (Werkzeug-Namen) und prüft die Erwartungen. Daten aus Beständen gehen NICHT mit.
 */
export const kiProbelauf: Probelaeufer = async a => {
  const { askJson } = await import('@/lib/anthropic');
  const { MODEL_BY_TIER } = await import('@/lib/agent-config');
  const system = [
    `Du bist ${a.head.name} und machst einen PROBELAUF eines Skills — ohne Wirkung: Werkzeuge stehen nicht zur Verfügung, nichts wird gespeichert oder gesendet.`,
    `Skill „${a.skill.name}“: ${a.skill.beschreibung}`,
    `<anleitung>\n${a.skill.anleitung}\n</anleitung>`,
    `Erlaubte Werkzeuge (nur nennen, nie ausführen): ${a.skill.werkzeuge.join(', ') || 'keine'}.`,
    'Antworte NUR mit JSON: {"ergebnis": string (≤ 600 Zeichen), "werkzeuge": string[] (Namen, die du aufrufen würdest), "erfuellt": boolean[] (je Erwartung), "notiz": string (≤ 200 Zeichen)}.',
  ].join('\n\n');
  const user = `<testfall>\n${a.test.eingabe}\n</testfall>\n<erwartungen>\n${a.test.erwartet.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n</erwartungen>`;
  const r = await askJson<{ ergebnis?: string; werkzeuge?: unknown; erfuellt?: unknown; notiz?: string }>({
    system, user, zweck: `agent-${a.head.id}-skill-test`, model: MODEL_BY_TIER[a.skill.stufe], maxTokens: 1500,
    ki: { lauf: 'aufruf', person: a.person, kategorien: [...a.head.kategorien] },
  });
  if (!r.ok || !r.data) return { ok: false, notiz: r.error?.startsWith('ki-gesperrt') ? 'KI gesperrt (System › Datenschutz)' : 'kein auswertbares Ergebnis' };
  const erfuellt = Array.isArray(r.data.erfuellt) ? r.data.erfuellt : [];
  const werkzeuge = Array.isArray(r.data.werkzeuge) ? r.data.werkzeuge.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  const ok = erfuellt.length >= a.test.erwartet.length && erfuellt.slice(0, a.test.erwartet.length).every(x => x === true);
  return { ok, werkzeuge, ...(typeof r.data.notiz === 'string' && r.data.notiz ? { notiz: r.data.notiz.slice(0, 200) } : {}) };
};

/**
 * Der echte Probeläufer (Paket 4a): die EINE Gesprächsschleife des Heads mit dem Skill im TROCKENLAUF — lesende Werkzeuge lesen,
 * alles andere zeigt nur, was es täte (Vorschau), nichts wird angelegt oder gestapelt (lib/agenten/probelauf.ts). Geladen beim Aufruf.
 */
export const schleifenProbelauf: Probelaeufer = async a => (await import('./probelauf')).probelauf(a);
let probelaeuferImpl: Probelaeufer = schleifenProbelauf;
/** Austausch des Probeläufers — in Tests ein Fake; `kiProbelauf` (ein Aufruf ohne Werkzeuge) bleibt als einfacher Weg. */
export function probelaeuferVerdrahten(p: Probelaeufer): void { probelaeuferImpl = p; }

/**
 * Testlauf: ≥ `GRENZEN.skillTestsMin` Fälle, jeder ohne Wirkung. Vorher die Kostenschätzung — über `GROSS_AB_CENT` nur mit
 * `kostenBestaetigt` (409 mit Schätzung). `nachts`: nur vormerken (Batch über das Anbieter-Tor, das Feld genügt).
 */
export async function skillTestlaufAktion(person: string, id: unknown, opt: { kostenBestaetigt?: boolean; nachts?: boolean } = {}): Promise<Ergebnis<{ skill: GespeicherterSkill; stand: string; schaetzung: KostenSchaetzung; vorgemerkt?: true }>> {
  const f = await skillFinden(person, id);
  if (!f.ok) return f;
  const s = f.skill;
  if (s.tests.length < GRENZEN.skillTestsMin) return fehler(409, `Für den Testlauf braucht der Skill mindestens ${GRENZEN.skillTestsMin} Testfälle (bisher ${s.tests.length}).`);
  const schaetzung = kostenSchaetzen({ stufe: s.stufe, art: 'probelauf', anzahl: s.tests.length });
  const am = new Date().toISOString();
  if (opt.nachts) {
    const raus = await inWerkstatt<Ergebnis<{ skill: GespeicherterSkill; stand: string; schaetzung: KostenSchaetzung; vorgemerkt: true }>>(f.name, (w, halt) => {
      const alt = w.skills.find(x => x.id === s.id);
      if (!alt) halt(fehler(404, 'Skill nicht gefunden.'));
      const neu: GespeicherterSkill = { ...alt!, probelaufNachts: { am, von: person, batch: true } };
      return { neu: { ...w, skills: w.skills.map(x => (x.id === neu.id ? neu : x)) }, raus: { ok: true, skill: neu, stand: standVon(neu), schaetzung, vorgemerkt: true } };
    });
    return raus;
  }
  if (schaetzung.cent > GROSS_AB_CENT && !opt.kostenBestaetigt) return fehler(409, `Der Testlauf kostet ${schaetzung.text} — bitte bestätigen.`, { kostenBestaetigen: true, schaetzung });
  // Gegenprüfung 09.10.: Not-Aus, „aus“ und Monatsbudget des Heads gelten auch für den Testlauf (bis zu 20 Fälle mit Modell) — wie beim
  // Probelauf eines Mitarbeiters. Vorgemerkt („nachts“) wird weiter; geprüft wird, wenn er läuft.
  const sperre = await (await import('./einstellung')).laufSperre(person, f.head.id);
  if (sperre) return fehler(409, sperre.text, { gesperrt: sperre.grund });
  const ergebnisse: ProbeErgebnis[] = [];
  for (let i = 0; i < s.tests.length; i++) {
    try { ergebnisse.push(await probelaeuferImpl({ skill: s, head: f.head, test: s.tests[i], nr: i, person })); }
    catch (e) { ergebnisse.push({ ok: false, notiz: e instanceof Error ? e.message.slice(0, 120) : 'Fehler' }); }
  }
  const testlauf = testlaufAus(s, ergebnisse, person, am);
  const raus = await inWerkstatt<Ergebnis<{ skill: GespeicherterSkill; stand: string; schaetzung: KostenSchaetzung }>>(f.name, (w, halt) => {
    const alt = w.skills.find(x => x.id === s.id);
    if (!alt) halt(fehler(404, 'Skill nicht gefunden.'));
    // Wurde der Skill währenddessen geändert, gilt der Testlauf der alten Fassung nicht (er wird trotzdem vermerkt — `testlaufAktuell` prüft die Zeit).
    const { probelaufNachts: _p, ...ohne } = alt!;
    const neu: GespeicherterSkill = { ...ohne, testlauf: alt!.version === s.version ? testlauf : { ...testlauf, ok: false } };
    return { neu: { ...w, skills: w.skills.map(x => (x.id === neu.id ? neu : x)) }, raus: { ok: true, skill: neu, stand: standVon(neu), schaetzung } };
  });
  if (raus.ok) await protokoll(f.name, [{ liste: 'skills', op: 'geaendert', id: s.id, felder: ['testlauf'] }], person);
  return raus;
}

// ── Probelauf eines Mitarbeiters (Paket 4b; Fragerunde Teil 1 Nr. 7 „Probelauf ohne Wirkung“) ────────────────────────────

export interface MitarbeiterProbeAuftrag { head: HeadDef; mitarbeiter: Pick<Mitarbeiter, 'name' | 'rolle' | 'anleitung' | 'werkzeuge' | 'stufe'>; eingabe: string; person: string }
export interface MitarbeiterProbeErgebnis { ok: boolean; text: string; werkzeuge?: string[]; kostenCent?: number }
/** Führt EINEN Lauf mit Testeingabe ohne Wirkung aus. Paket 4a verdrahtet die echte Schleife im Trockenlauf; in Tests ein Fake. */
export type MitarbeiterProbelaeufer = (a: MitarbeiterProbeAuftrag) => Promise<MitarbeiterProbeErgebnis>;

/**
 * Vorläufiger Probeläufer: EIN Modell-Aufruf OHNE Werkzeuge (es kann nichts wirken) — Rolle und Anleitung als System-Text, die
 * Testeingabe als Eingabe; das Modell antwortet so, wie der Mitarbeiter antworten würde, und nennt die Werkzeuge, die es aufriefe.
 * Daten aus Beständen gehen NICHT mit (die Testeingabe ist alles).
 */
export const kiMitarbeiterProbelauf: MitarbeiterProbelaeufer = async a => {
  const { askJson } = await import('@/lib/anthropic');
  const { MODEL_BY_TIER } = await import('@/lib/agent-config');
  const system = [
    `Du bist „${a.mitarbeiter.name}“, Mitarbeiter von ${a.head.name}. Rolle: ${a.mitarbeiter.rolle}`,
    'Das ist ein PROBELAUF ohne Wirkung: Werkzeuge stehen nicht zur Verfügung, nichts wird gespeichert oder gesendet. Antworte so, wie du im echten Lauf antworten würdest.',
    a.mitarbeiter.anleitung ? `<anleitung>\n${a.mitarbeiter.anleitung}\n</anleitung>` : '',
    `Erlaubte Werkzeuge (nur nennen, nie ausführen): ${a.mitarbeiter.werkzeuge.join(', ') || 'keine'}.`,
    'Antworte NUR mit JSON: {"ergebnis": string (≤ 3000 Zeichen), "werkzeuge": string[] (Namen, die du aufrufen würdest)}.',
  ].filter(Boolean).join('\n\n');
  const r = await askJson<{ ergebnis?: string; werkzeuge?: unknown }>({
    system, user: `<testeingabe>\n${a.eingabe}\n</testeingabe>`, zweck: `agent-${a.head.id}`, model: MODEL_BY_TIER[a.mitarbeiter.stufe], maxTokens: 2500,
    ki: { lauf: 'aufruf', person: a.person, kategorien: [...a.head.kategorien] },
  });
  if (!r.ok || !r.data) return { ok: false, text: r.error?.startsWith('ki-gesperrt') ? 'Probelauf gesperrt (System › Datenschutz).' : 'Kein auswertbares Ergebnis.' };
  const werkzeuge = Array.isArray(r.data.werkzeuge) ? r.data.werkzeuge.filter((x): x is string => typeof x === 'string').slice(0, 30) : [];
  return { ok: true, text: String(r.data.ergebnis ?? '').slice(0, 3_000) || '(leer)', werkzeuge };
};

let mitarbeiterProbeImpl: MitarbeiterProbelaeufer = kiMitarbeiterProbelauf;
/** Paket 4a: die Gesprächsschleife im Trockenlauf hier einhängen; Tests: ein Fake. */
export function mitarbeiterProbelaeuferVerdrahten(p: MitarbeiterProbelaeufer): void { mitarbeiterProbeImpl = p; }

/**
 * Probelauf eines Mitarbeiters (vorhanden über `id` oder ein Entwurf aus dem Dialog): Kostenschätzung (über `GROSS_AB_CENT` nur mit
 * `kostenBestaetigt`), Sperre des Heads (Not-Aus, aus, Budget), dann EIN Lauf ohne Wirkung — das Ergebnis steht nur in einem eigenen
 * Thread der Person („Probelauf: …“), Werkzeuge werden nur genannt. Nichts an der Werkstatt ändert sich.
 */
export async function mitarbeiterProbelaufAktion(person: string, headId: unknown, roh: { id?: unknown; entwurf?: unknown; eingabe?: unknown; kostenBestaetigt?: unknown }): Promise<Ergebnis<{ fadenId: string; schaetzung: KostenSchaetzung }>> {
  const hk = await headKontext(person, headId);
  if (!hk.ok) return hk;
  const w = await werkstattLaden(hk.name);
  let ma: Pick<Mitarbeiter, 'name' | 'rolle' | 'anleitung' | 'werkzeuge' | 'stufe'> & { id?: string };
  if (typeof roh.id === 'string' && roh.id) {
    const m = mitarbeiterListe(hk.head.id, w.mitarbeiter).find(x => x.id === roh.id);
    if (!m) return fehler(404, 'Diesen Mitarbeiter hat der Head nicht.');
    ma = m;
  } else {
    const p = mitarbeiterPruefen(roh.entwurf, hk.head);
    if (!p.ok) return fehler(p.status, p.fehler);
    ma = p.wert;
  }
  const eingabe = textFeld(roh.eingabe, GRENZEN.auftragZeichen, 'Testeingabe');
  if (!eingabe.ok) return fehler(eingabe.status, eingabe.fehler);
  const schaetzung = kostenSchaetzen({ stufe: ma.stufe, art: 'probelauf' });
  if (schaetzung.cent > GROSS_AB_CENT && roh.kostenBestaetigt !== true) return fehler(409, `Der Probelauf kostet ${schaetzung.text} — bitte bestätigen.`, { kostenBestaetigen: true, schaetzung });
  const { laufSperre } = await import('./einstellung');
  const sperre = await laufSperre(person, hk.head.id);
  if (sperre) return fehler(409, sperre.text, { gesperrt: sperre.grund });
  let e: MitarbeiterProbeErgebnis;
  try { e = await mitarbeiterProbeImpl({ head: hk.head, mitarbeiter: ma, eingabe: eingabe.wert, person }); }
  catch (x) { e = { ok: false, text: x instanceof Error ? x.message.slice(0, 160) : 'Fehler' }; }
  const { bestandAendern } = await import('./faeden-server');
  const { neuerFaden, anhaengen, fadenHinzu } = await import('./faeden');
  const jetzt = new Date().toISOString();
  const agent: AgentRef = ma.id ? { art: 'mitarbeiter', headId: hk.head.id, mitarbeiterId: ma.id } : { art: 'head', headId: hk.head.id };
  const f = neuerFaden({ id: neueKennung('fd'), besitzer: person, agent, bereich: hk.head.bereich, titel: `Probelauf: ${ma.name}`, jetzt, kette: [agentSchluessel(agent)] });
  const n = anhaengen(f, [
    { id: neueKennung('nr'), rolle: 'person', von: person, text: eingabe.wert, zeit: jetzt },
    { id: neueKennung('nr'), rolle: e.ok ? 'agent' : 'system', von: e.ok ? agentSchluessel(agent) : 'system', text: e.text, zeit: jetzt, ...(e.ok ? { ki: true as const } : {}), ...(e.werkzeuge?.length ? { werkzeuge: e.werkzeuge.map(name => ({ name, ok: true })) } : {}), ...(typeof e.kostenCent === 'number' ? { kosten: { cent: e.kostenCent } } : {}) },
    { id: neueKennung('nr'), rolle: 'system', von: 'system', text: 'Probelauf ohne Wirkung — Werkzeuge wurden nur genannt, nichts gespeichert oder gesendet.', zeit: jetzt },
  ], jetzt);
  if (!n.ok) return fehler(n.status === 413 ? 413 : 409, n.fehler);
  const fertig = { ...n.faden, status: (e.ok ? 'fertig' : 'fehler') as 'fertig' | 'fehler' };
  const r = await bestandAendern<string>(person, b => { const x = fadenHinzu(b, fertig); return x.ok ? { bestand: x.bestand, e: fertig.id } : x; });
  if (!r.ok) return fehler(r.status === 400 ? 400 : r.status === 413 ? 413 : 409, r.fehler);
  return { ok: true, fadenId: r.e, schaetzung };
}

// ── Erfolgsquote (Paket 1 meldet Läufe und Entscheidungen) ─────────────────────────────────────────────────────────────

/** Zählt einen Lauf bzw. eine Entscheidung zu einem Skill (Antwort 7 „Erfolgsquote“). Schnittstelle für Paket 1 (Lauf-Route). */
export async function skillErfolgZaehlen(umfang: Umfang, skillId: string, was: 'lauf' | 'angenommen' | 'abgelehnt' | 'fehler', jetzt = new Date()): Promise<boolean> {
  for (const ebene of ['haushalt', 'person'] as const) {
    const name = werkstattBestandFuer(ebene, umfang);
    if (!name) continue;
    const ok = await inWerkstatt<boolean>(name, (w, halt) => {
      const s = w.skills.find(x => x.id === skillId);
      if (!s) halt(false);
      const e = { ...s!.erfolg };
      if (was === 'lauf') e.laeufe += 1; else e[was] += 1;
      e.zuletzt = jetzt.toISOString();
      return { neu: { ...w, skills: w.skills.map(x => (x.id === skillId ? { ...x, erfolg: e } : x)) }, raus: true };
    });
    if (ok) return true;
  }
  return false;
}

/**
 * Die Stapel-Entscheidung zu einem Vorschlag, den ein Skill-Lauf erzeugt hat, in der Erfolgsquote dieses Skills zählen (09.10.,
 * Agenten-Datenschicht D7). Vorher zählte nur der Lauf (und der Fehler) — „angenommen“/„abgelehnt“ nie, die Quote stand damit bei jedem
 * gescheiterten Lauf auf 0 %. Gefunden wird der Skill über den Thread der Person, dessen Nachricht den Vorschlag trägt (`werkzeuge[].vorschlagId`),
 * und dessen Vorfahren (ein Skill-Lauf kann an Mitarbeiter delegieren). Nur die Threads der Person, für die vorgeschlagen wurde — nie fremde.
 * `zurueck` an ZOE zählt wie abgelehnt (wie die Annahmequote der Heads). Liefert die Skill-Kennung oder null (kein Skill-Vorschlag). Wirft nie.
 */
export async function skillEntscheidungZaehlen(v: { id: string; person?: string }, entscheidung: 'angenommen' | 'abgelehnt', jetzt = new Date()): Promise<string | null> {
  try {
    if (!v.person || !/^[a-z0-9-]{1,40}$/.test(v.person)) return null;
    const faeden = (await loadJson<FadenBestand>(fadenBestand(v.person)))?.faeden ?? [];
    const quelle = faeden.find(f => (f.nachrichten ?? []).some(n => (n.werkzeuge ?? []).some(w => w.vorschlagId === v.id)));
    if (!quelle) return null;
    const nachId = new Map(faeden.map(f => [f.id, f]));
    const gesehen = new Set<string>();
    let f: typeof quelle | undefined = quelle;
    while (f && !f.skillId && f.elternId && !gesehen.has(f.id)) { gesehen.add(f.id); f = nachId.get(f.elternId); }
    if (!f?.skillId) return null;
    return (await skillErfolgZaehlen(await umfangFuer(v.person), f.skillId, entscheidung, jetzt)) ? f.skillId : null;
  } catch (e) {
    console.error('[agenten-skills] Entscheidung nicht gezählt:', e instanceof Error ? e.message.slice(0, 120) : e);
    return null;
  }
}

// ── Mitarbeiter ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Eigenen Mitarbeiter anlegen (Antwort 4: „selbst anlegen“). `quelle` vorschlag nur über den Stapel. */
export async function mitarbeiterAnlegen(person: string, headId: unknown, roh: unknown, quelle: 'hand' | 'vorschlag' = 'hand', opt: { ausFremdemText?: boolean } = {}): Promise<Ergebnis<{ mitarbeiter: Mitarbeiter; stand: string }>> {
  const hk = await headKontext(person, headId);
  if (!hk.ok) return hk;
  const raus = await inWerkstatt<Ergebnis<{ mitarbeiter: Mitarbeiter; stand: string }>>(hk.name, (w, halt) => {
    const p = mitarbeiterPruefen(roh, hk.head);
    if (!p.ok) halt(p);
    const inhalt = (p as { wert: ReturnType<typeof mitarbeiterPruefen> extends infer X ? X extends { ok: true; wert: infer W } ? W : never : never }).wert;
    const alle = mitarbeiterListe(hk.head.id, w.mitarbeiter).filter(m => m.headId === hk.head.id);
    if (alle.length >= GRENZEN.mitarbeiterJeHead) halt(fehler(413, `Höchstens ${GRENZEN.mitarbeiterJeHead} Mitarbeiter je Head.`));
    if (alle.some(m => m.name.toLowerCase() === inhalt.name.toLowerCase())) halt(fehler(409, `Einen Mitarbeiter „${inhalt.name}“ hat dieser Head schon.`));
    const m: Mitarbeiter = { id: neueKennung('ma'), headId: hk.head.id, ...inhalt, gedaechtnis: [], quelle, angelegtVon: person, ...(quelle === 'vorschlag' ? { freigegebenVon: person } : {}), ...(opt.ausFremdemText ? { ausFremdemText: true as const } : {}) };
    return { neu: { ...w, mitarbeiter: [...w.mitarbeiter, m] }, raus: { ok: true, mitarbeiter: m, stand: standVon(m) } };
  });
  if (raus.ok) await protokoll(hk.name, [{ liste: 'mitarbeiter', op: 'neu', id: raus.mitarbeiter.id }], person);
  return raus;
}

/** Mitarbeiter ändern (Vorlage → gespeicherte Überschreibung; eigener → Einzeländerung). Stand: der gespeicherte bzw. der der Vorlage. */
export async function mitarbeiterAendernAktion(person: string, headId: unknown, id: unknown, teil: unknown, stand: unknown): Promise<Ergebnis<{ mitarbeiter: Mitarbeiter; stand: string }>> {
  const hk = await headKontext(person, headId);
  if (!hk.ok) return hk;
  if (typeof id !== 'string' || !id) return fehler(400, 'Mitarbeiter-Kennung fehlt.');
  let felder: string[] = [];
  const raus = await inWerkstatt<Ergebnis<{ mitarbeiter: Mitarbeiter; stand: string }>>(hk.name, (w, halt) => {
    const gespeichert = w.mitarbeiter.find(m => m.id === id);
    const alt = gespeichert ?? ausVorlage(id);
    if (!alt || alt.headId !== hk.head.id) halt(fehler(404, 'Diesen Mitarbeiter hat der Head nicht (Aushilfen ändert ihr Heimat-Head).'));
    if (stand !== standVon(alt)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, mitarbeiter: alt, stand: standVon(alt) }));
    const p = mitarbeiterAendern(alt!, teil, hk.head);
    if (!p.ok) halt(p);
    const { mitarbeiter, geaendert } = (p as { wert: { mitarbeiter: Mitarbeiter; geaendert: string[] } }).wert;
    if (mitarbeiterListe(hk.head.id, w.mitarbeiter).some(m => m.id !== mitarbeiter.id && m.headId === hk.head.id && m.name.toLowerCase() === mitarbeiter.name.toLowerCase())) halt(fehler(409, `Einen Mitarbeiter „${mitarbeiter.name}“ hat dieser Head schon.`));
    felder = geaendert;
    if (!geaendert.length) halt({ ok: true, mitarbeiter: alt!, stand: standVon(alt) });
    const liste = gespeichert ? w.mitarbeiter.map(m => (m.id === id ? mitarbeiter : m)) : [...w.mitarbeiter, mitarbeiter];
    return { neu: { ...w, mitarbeiter: liste }, raus: { ok: true, mitarbeiter, stand: standVon(mitarbeiter) } };
  });
  if (raus.ok && felder.length) await protokoll(hk.name, [{ liste: 'mitarbeiter', op: 'geaendert', id: raus.mitarbeiter.id, felder }], person);
  return raus;
}

// ── Gedächtnis (Merksätze) ───────────────────────────────────────────────────────────────────────────────────────────────

function agentPruefen(a: unknown): AgentRef | null {
  if (!a || typeof a !== 'object') return null;
  const x = a as Record<string, unknown>;
  if (x.art === 'head' && typeof x.headId === 'string') return { art: 'head', headId: x.headId };
  if (x.art === 'mitarbeiter' && typeof x.headId === 'string' && typeof x.mitarbeiterId === 'string') return { art: 'mitarbeiter', headId: x.headId, mitarbeiterId: x.mitarbeiterId };
  return null;
}

/**
 * Merksatz anhängen — von Hand (`quelle: 'hand'`, von = Person) oder aus einem freigegebenen Vorschlag (`vorschlag`, von = Agent,
 * `freigegebenVon` = Person). Das Gedächtnis eines Mitarbeiters steht am Mitarbeiter (eine Vorlage wird dafür gespeichert).
 */
export async function merksatzAktion(person: string, agentRoh: unknown, text: unknown, herkunft?: { von: string; freigegebenVon: string }): Promise<Ergebnis<{ merksatz: Merksatz; neu: boolean }>> {
  const agent = agentPruefen(agentRoh);
  if (!agent || agent.art === 'zoe') return fehler(400, 'Merksätze gehören einem Head oder Mitarbeiter.');
  const hk = await headKontext(person, agent.headId);
  if (!hk.ok) return hk;
  const am = new Date().toISOString();
  const basis = herkunft ? { id: neueKennung('ms'), am, von: herkunft.von, quelle: 'vorschlag' as const, freigegebenVon: herkunft.freigegebenVon } : { id: neueKennung('ms'), am, von: person, quelle: 'hand' as const };
  let neuId = '';
  const raus = await inWerkstatt<Ergebnis<{ merksatz: Merksatz; neu: boolean }>>(hk.name, (w, halt) => {
    if (agent.art === 'head') {
      const p = merksatzHinzu(w.gedaechtnis[hk.head.id] ?? [], { ...basis, text });
      if (!p.ok) halt(p);
      const { liste, neu } = (p as { wert: { liste: Merksatz[]; neu: boolean } }).wert;
      const m = neu ? liste[liste.length - 1] : liste.find(x => x.text.toLowerCase().replace(/\s+/g, ' ').trim() === String(text).toLowerCase().replace(/\s+/g, ' ').trim())!;
      if (!neu) halt({ ok: true, merksatz: m, neu: false });
      neuId = m.id;
      return { neu: { ...w, gedaechtnis: { ...w.gedaechtnis, [hk.head.id]: liste } }, raus: { ok: true, merksatz: m, neu: true } };
    }
    const gespeichert = w.mitarbeiter.find(m => m.id === agent.mitarbeiterId);
    const ma = gespeichert ?? ausVorlage(agent.mitarbeiterId);
    if (!ma || ma.headId !== hk.head.id) halt(fehler(404, 'Diesen Mitarbeiter hat der Head nicht.'));
    const p = merksatzHinzu(ma!.gedaechtnis, { ...basis, text });
    if (!p.ok) halt(p);
    const { liste, neu } = (p as { wert: { liste: Merksatz[]; neu: boolean } }).wert;
    if (!neu) halt({ ok: true, merksatz: ma!.gedaechtnis.find(x => x.text.toLowerCase().replace(/\s+/g, ' ').trim() === String(text).toLowerCase().replace(/\s+/g, ' ').trim())!, neu: false });
    const m = liste[liste.length - 1];
    neuId = m.id;
    const neuMa = { ...ma!, gedaechtnis: liste };
    return { neu: { ...w, mitarbeiter: gespeichert ? w.mitarbeiter.map(x => (x.id === neuMa.id ? neuMa : x)) : [...w.mitarbeiter, neuMa] }, raus: { ok: true, merksatz: m, neu: true } };
  });
  if (raus.ok && neuId) await protokoll(hk.name, [{ liste: agent.art === 'head' ? 'gedaechtnis' : 'mitarbeiter', op: agent.art === 'head' ? 'neu' : 'geaendert', id: agent.art === 'head' ? neuId : agent.mitarbeiterId, ...(agent.art === 'head' ? {} : { felder: ['gedaechtnis'] }) }], person);
  return raus;
}

/** Merksatz entfernen (Gedächtnis „sichtbar und löschbar“, Fragerunde 12). */
export async function merksatzWegAktion(person: string, agentRoh: unknown, id: unknown): Promise<Ergebnis<{ id: string }>> {
  const agent = agentPruefen(agentRoh);
  if (!agent || agent.art === 'zoe') return fehler(400, 'Merksätze gehören einem Head oder Mitarbeiter.');
  if (typeof id !== 'string' || !id) return fehler(400, 'Kennung fehlt.');
  const hk = await headKontext(person, agent.headId);
  if (!hk.ok) return hk;
  const raus = await inWerkstatt<Ergebnis<{ id: string }>>(hk.name, (w, halt) => {
    if (agent.art === 'head') {
      const liste = w.gedaechtnis[hk.head.id] ?? [];
      if (!liste.some(m => m.id === id)) halt({ ok: true, id });
      return { neu: { ...w, gedaechtnis: { ...w.gedaechtnis, [hk.head.id]: liste.filter(m => m.id !== id) } }, raus: { ok: true, id } };
    }
    const ma = w.mitarbeiter.find(m => m.id === agent.mitarbeiterId);
    if (!ma || !ma.gedaechtnis.some(m => m.id === id)) halt({ ok: true, id });
    return { neu: { ...w, mitarbeiter: w.mitarbeiter.map(m => (m.id === ma!.id ? { ...m, gedaechtnis: m.gedaechtnis.filter(x => x.id !== id) } : m)) }, raus: { ok: true, id } };
  });
  if (raus.ok) await protokoll(hk.name, [{ liste: 'gedaechtnis', op: 'geloescht', id }], person);
  return raus;
}

// ── Vorschläge von Agenten → Stapel (Arten `skill` · `mitarbeiter` · `merksatz`) ────────────────────────────────────────────
// Paket 1 (Head-Chat, Werkzeuge `skill_vorschlagen` / `mitarbeiter_vorschlagen` / `merksatz_vorschlagen`) ruft NUR diese Funktionen —
// sie prüfen den Inhalt (ein ungültiger Vorschlag erreicht den Stapel nie) und setzen `bezug` (das tut sonst niemand).

export const AGENTEN_GRUPPE = 'agenten';
const kurzT = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export interface VorschlagHerkunft { person: string; agent: AgentRef; anlass?: string; quelle?: Vorschlag['quelle'];
  /** Der vorschlagende Lauf hatte fremden Text gelesen (Punkt 8) — der Vorschlag trägt die Marke, der übernommene Skill/Mitarbeiter auch. */
  fremd?: boolean }
const AUS_FREMD_TITEL = ' (aus fremdem Text — wird gekapselt)';

async function vorschlagBasis(h: VorschlagHerkunft, headId: string): Promise<Ergebnis<{ head: HeadDef; w: Werkstatt; name: string }>> {
  const hk = await headKontext(h.person, headId);
  if (!hk.ok) return hk;
  return { ok: true, head: hk.head, name: hk.name, w: await werkstattLaden(hk.name) };
}

/** Ein Agent schlägt einen Skill vor → Stapel (Art `skill`). Übernommen wird er per Klick — als Entwurf, aktiv erst nach Testlauf + Klick. */
export async function vorschlagSkillLegen(h: VorschlagHerkunft, headId: string, entwurf: unknown): Promise<Ergebnis<{ vorschlag: Vorschlag }>> {
  const b = await vorschlagBasis(h, headId);
  if (!b.ok) return b;
  const p = skillPruefen(entwurf, kontext(b.head, b.w));
  if (!p.ok) return fehler(p.status, p.fehler);
  const vorschlag = await lege({
    werkzeug: 'skill_vorschlagen', gruppe: AGENTEN_GRUPPE, titel: `Neuer Skill „${p.wert.name}“ für ${b.head.name}${h.fremd ? AUS_FREMD_TITEL : ''}`,
    nachher: kurzT(p.wert.beschreibung, 300), eingabe: { headId: b.head.id, entwurf: p.wert, von: agentSchluessel(h.agent), ...(h.fremd ? { ausFremdemText: true } : {}) },
    ...(h.anlass ? { anlass: kurzT(h.anlass, 400) } : {}), person: h.person, quelle: h.quelle ?? 'gespraech', bezug: { art: 'skill', id: b.head.id },
  });
  return { ok: true, vorschlag };
}

/** Ein Agent schlägt einen Mitarbeiter vor → Stapel (Art `mitarbeiter`). */
export async function vorschlagMitarbeiterLegen(h: VorschlagHerkunft, headId: string, entwurf: unknown): Promise<Ergebnis<{ vorschlag: Vorschlag }>> {
  const b = await vorschlagBasis(h, headId);
  if (!b.ok) return b;
  const p = mitarbeiterPruefen(entwurf, b.head);
  if (!p.ok) return fehler(p.status, p.fehler);
  const vorschlag = await lege({
    werkzeug: 'mitarbeiter_vorschlagen', gruppe: AGENTEN_GRUPPE, titel: `Neuer Mitarbeiter „${p.wert.name}“ für ${b.head.name}${h.fremd ? AUS_FREMD_TITEL : ''}`,
    nachher: kurzT(p.wert.rolle, 300), eingabe: { headId: b.head.id, entwurf: p.wert, von: agentSchluessel(h.agent), ...(h.fremd ? { ausFremdemText: true } : {}) },
    ...(h.anlass ? { anlass: kurzT(h.anlass, 400) } : {}), person: h.person, quelle: h.quelle ?? 'gespraech', bezug: { art: 'mitarbeiter', id: b.head.id },
  });
  return { ok: true, vorschlag };
}

/** Ein Agent schlägt sich (oder seinem Mitarbeiter) einen Merksatz vor → Stapel (Art `merksatz`). Nie Fremdtext ungeprüft ins Gedächtnis (R12). */
export async function vorschlagMerksatzLegen(h: VorschlagHerkunft, ziel: AgentRef, text: unknown): Promise<Ergebnis<{ vorschlag: Vorschlag }>> {
  if (ziel.art === 'zoe') return fehler(400, 'Merksätze gehören einem Head oder Mitarbeiter.');
  const b = await vorschlagBasis(h, ziel.headId);
  if (!b.ok) return b;
  const p = merksatzHinzu([], { id: 'pruefen', am: '', von: '', quelle: 'vorschlag', text });
  if (!p.ok) return fehler(p.status, p.fehler);
  const satz = p.wert.liste[0].text;
  const vorschlag = await lege({
    werkzeug: 'merksatz_vorschlagen', gruppe: AGENTEN_GRUPPE, titel: `Merksatz für ${b.head.name}${ziel.art === 'mitarbeiter' ? ' (Mitarbeiter)' : ''}`,
    nachher: satz, eingabe: { agent: ziel, text: satz, von: agentSchluessel(h.agent) },
    ...(h.anlass ? { anlass: kurzT(h.anlass, 400) } : {}), person: h.person, quelle: h.quelle ?? 'gespraech', bezug: { art: 'merksatz', id: b.head.id },
  });
  return { ok: true, vorschlag };
}

const NUR_DIE_PERSON = { status: 403 as const, fehler: 'Nur die Person, für die der Agent ihn vorbereitet hat, gibt ihn frei.' };

/** Gemeinsamer Ablauf der drei Arten: beanspruchen (in der Sperre), übernehmen, entscheiden — sonst loslassen. */
async function freigabeAblauf(v: Vorschlag, person: string, art: 'skill' | 'mitarbeiter' | 'merksatz', werkzeug: string, uebernehmen: (v: Vorschlag) => Promise<ArtErgebnis>): Promise<ArtErgebnis> {
  if (!person || !(await personImHaushaltDesInhabers(person))) return { ok: false, status: 403, fehler: 'Nur im Haushalt des Inhabers.' };
  const a = await beanspruche(v.id, person, x => {
    if (x.bezug?.art !== art || x.werkzeug !== werkzeug) return { status: 404, fehler: 'Vorschlag nicht gefunden.' };
    if (!x.person || x.person !== person) return NUR_DIE_PERSON;
    return null;
  });
  if (!a.ok) return { ok: false, status: a.status, fehler: a.fehler };
  try {
    const r = await uebernehmen(a.v);
    if (!r.ok) { await loslassen(a.v.id); return r; }
    const e = await entscheide(a.v.id, 'freigegeben', { ergebnis: r.text, von: person, ausArbeit: true });
    return e ? r : { ok: false, status: 409, fehler: 'Schon entschieden.' };
  } catch (e) {
    await loslassen(a.v.id);
    throw e;
  }
}

const ergebnisAus = (r: { ok: boolean; status?: number; fehler?: string }, text: string): ArtErgebnis =>
  r.ok ? { ok: true, text } : { ok: false, status: (r.status === 400 || r.status === 403 || r.status === 404 || r.status === 413 ? r.status : 409) as 400 | 403 | 404 | 409 | 413, fehler: String(r.fehler ?? 'Abgelehnt.') };

/** „Ändern & freigeben“: eine bearbeitete Fassung (nur `entwurf` bzw. `text`) ersetzt den Vorschlag — geprüft wie jede Eingabe. */
const entwurfAus = (v: Vorschlag, eingabe?: Record<string, unknown> | null): unknown => (eingabe && 'entwurf' in eingabe ? eingabe.entwurf : v.eingabe.entwurf);

export const SKILL_STAPEL_ART: StapelArtFreigabe = {
  freigeben: (v, person, opt) => freigabeAblauf(v, person, 'skill', 'skill_vorschlagen', async x => {
    const entwurf = entwurfAus(x, opt.eingabe);
    // Die Marke „aus fremdem Text“ steht am Vorschlag (vom Server gesetzt) — eine bearbeitete Fassung behält sie (Punkt 8).
    const r = await skillAnlegen(person, { ...(entwurf as object), headId: x.eingabe.headId, ausFaden: undefined }, 'vorschlag', { ausFremdemText: x.eingabe.ausFremdemText === true });
    return ergebnisAus(r, r.ok ? `Skill-Entwurf „${r.skill.name}“ angelegt — aktiv erst nach Testlauf und Klick.` : '');
  }),
};

export const MITARBEITER_STAPEL_ART: StapelArtFreigabe = {
  freigeben: (v, person, opt) => freigabeAblauf(v, person, 'mitarbeiter', 'mitarbeiter_vorschlagen', async x => {
    const r = await mitarbeiterAnlegen(person, x.eingabe.headId, entwurfAus(x, opt.eingabe), 'vorschlag', { ausFremdemText: x.eingabe.ausFremdemText === true });
    return ergebnisAus(r, r.ok ? `Mitarbeiter „${r.mitarbeiter.name}“ angelegt.` : '');
  }),
};

export const MERKSATZ_STAPEL_ART: StapelArtFreigabe = {
  freigeben: (v, person, opt) => freigabeAblauf(v, person, 'merksatz', 'merksatz_vorschlagen', async x => {
    const text = opt.eingabe && typeof opt.eingabe.text === 'string' ? opt.eingabe.text : x.eingabe.text;
    const von = typeof x.eingabe.von === 'string' && /^(head|mitarbeiter):[a-z0-9:-]{1,80}$/.test(x.eingabe.von) ? x.eingabe.von : 'agent';
    const r = await merksatzAktion(person, x.eingabe.agent, text, { von, freigegebenVon: person });
    return ergebnisAus(r, r.ok ? (r.neu ? 'Merksatz übernommen.' : 'Den Merksatz gab es schon.') : '');
  }),
};

// ── Konto: Export und Löschen (lib/datenschutz/konto-daten.ts) ────────────────────────────────────────────────────────────

const GELOESCHT = '[gelöscht]';

/** Eigene Einträge der Person in der Werkstatt des Haushalts (angelegt/freigegeben) — für den Konto-Export (Art. 15/20). Rein. */
export function werkstattEintraegeVon(w: WerkstattBestand, speicher: string): unknown[] {
  const raus: unknown[] = [];
  for (const s of w.skills) if (s.angelegtVon === speicher || s.freigegebenVon === speicher) raus.push({ art: 'skill', id: s.id, headId: s.headId, name: s.name, beschreibung: s.beschreibung, anleitung: s.anleitung, aktiv: s.aktiv, version: s.version, angelegt: s.angelegtVon === speicher, freigegeben: s.freigegebenVon === speicher });
  for (const m of w.mitarbeiter) if (m.angelegtVon === speicher || m.freigegebenVon === speicher) raus.push({ art: 'mitarbeiter', id: m.id, headId: m.headId, name: m.name, rolle: m.rolle, ...(m.anleitung ? { anleitung: m.anleitung } : {}) });
  const saetze = [...Object.entries(w.gedaechtnis).flatMap(([h, l]) => (l ?? []).map(x => ({ h, x }))), ...w.mitarbeiter.flatMap(m => m.gedaechtnis.map(x => ({ h: m.headId, x })))];
  for (const { h, x } of saetze) if (x.von === speicher || x.freigegebenVon === speicher) raus.push({ art: 'merksatz', headId: h, text: x.text, am: x.am });
  return raus;
}

/**
 * Konto löschen (Fragerunde 8): Business-Skills und eigene Mitarbeiter gehen an den Inhaber (`angelegtVon` → Inhaber, ohne den alten
 * Namen); wer freigegeben hat und Merksätze „von“/„freigegeben von“ der Person werden „[gelöscht]“. Ohne anderen Inhaber: „[gelöscht]“.
 * Rein — liefert den neuen Bestand und die Zahl der Änderungen.
 */
export function werkstattOhnePerson(w: WerkstattBestand, speicher: string, inhaber: string | null, am: string): { werkstatt: WerkstattBestand; anzahl: number } {
  let n = 0;
  const neuerBesitzer = inhaber && inhaber !== speicher ? inhaber : GELOESCHT;
  const satz = (x: Merksatz): Merksatz => {
    if (x.von !== speicher && x.freigegebenVon !== speicher) return x;
    n++;
    return { ...x, ...(x.von === speicher ? { von: GELOESCHT } : {}), ...(x.freigegebenVon === speicher ? { freigegebenVon: GELOESCHT } : {}) };
  };
  const skills = (w.skills as GespeicherterSkill[]).map(s => {
    let t: GespeicherterSkill = s;
    if (t.angelegtVon === speicher) { t = { ...t, angelegtVon: neuerBesitzer, uebergeben: { am } }; n++; }
    if (t.freigegebenVon === speicher) { t = { ...t, freigegebenVon: GELOESCHT }; n++; }
    if (t.testlauf?.von === speicher) { t = { ...t, testlauf: { ...t.testlauf, von: GELOESCHT } }; n++; }
    if (t.probelaufNachts?.von === speicher) { t = { ...t, probelaufNachts: { ...t.probelaufNachts, von: GELOESCHT } }; n++; }
    if (t.frueher?.some(f => f.von === speicher)) { t = { ...t, frueher: t.frueher.map(f => (f.von === speicher ? { ...f, von: GELOESCHT } : f)) }; n++; }
    return t;
  });
  const mitarbeiter = w.mitarbeiter.map(m => {
    let t = m;
    if (t.angelegtVon === speicher) { t = { ...t, angelegtVon: neuerBesitzer }; n++; }
    if (t.freigegebenVon === speicher) { t = { ...t, freigegebenVon: GELOESCHT }; n++; }
    const g = t.gedaechtnis.map(satz);
    return g.some((x, i) => x !== t.gedaechtnis[i]) ? { ...t, gedaechtnis: g } : t;
  });
  const gedaechtnis = Object.fromEntries(Object.entries(w.gedaechtnis).map(([h, l]) => [h, (l ?? []).map(satz)]));
  return { werkstatt: { ...w, skills, mitarbeiter, gedaechtnis }, anzahl: n };
}

/** Konto löschen: Werkstatt des Haushalts umschreiben (in der Sperre), Änderungsprotokoll ohne Werte. Liefert die Zahl. */
export async function werkstattKontoLoeschen(haushalt: string, speicher: string, inhaber: string | null): Promise<number> {
  const name = werkstattBestandFuer('haushalt', { person: speicher, haushalt });
  if (!name || (await loadJson<WerkstattBestand>(name)) === null) return 0;
  const am = new Date().toISOString();
  const n = await inWerkstatt<number>(name, (w, halt) => {
    const r = werkstattOhnePerson(w, speicher, inhaber, am);
    if (!r.anzahl) halt(0);
    return { neu: r.werkstatt, raus: r.anzahl };
  });
  if (n) await protokolliere(name, [{ liste: 'skills', op: 'geaendert', id: 'personen', felder: ['angelegtVon', 'freigegebenVon', 'von'] }], { art: 'system' }).catch(() => {});
  return n;
}
