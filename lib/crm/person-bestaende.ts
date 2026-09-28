// ─── Eine Person über ALLE Speicher: aufzählen, entfernen, umbiegen (28.09., F2) ─
// Prüfbericht 28.09.: Art. 17 (Löschen) und Art. 15 (Auskunft) kannten nur die
// Kartei (`kontakte`) und den CRM-Bestand (`crm`). Eine Person steht aber auch in
// der Dateiablage, in den Import-Konflikten, in den Freigabe-Listen und Replay-
// Fällen der Heads, bei den kommenden Terminen (`crm-signale`) und in Aufgaben.
// Ab jetzt kennt GENAU DIESE Datei alle Speicher mit Personenbezug — jeder neue
// Speicher, der eine Kontakt-Kennung hält, gehört hier hinein (CLAUDE.md).
//
//   Speicher                       entfernen (Art. 17)                        umbiegen (Dubletten)
//   kontakte                       Eintrag raus                               (macht die Dubletten-Route)
//   crm                            lib/crm/person-verweise.ts + voller Name   dito
//                                  in Deal-Titeln/Kundennamen → „[gelöscht]“
//                                  (`crmNamenTilgen`, 28.09.)
//   crm-dateien--<haushalt>        nur Personen-Bezug: Eintrag + Datei weg;   kontaktId → neu
//     + dateien/<haushalt>/*.bin   mit Firma/Mandat/Deal/Rechnung: nur der
//                                  Personen-Bezug fällt (Geschäftsunterlage,
//                                  Aufbewahrung § 257 HGB / § 147 AO)
//   crm-import-konflikte           Konflikte + mögliche Dubletten der Person  kontaktId/mitId → neu (ohne Doppelte)
//   head-<head>                    Vorschläge mit kontakt_id raus, Person aus kontakt_id/kontakt_ids → neu
//                                  Kampagnen-Listen; Berichte, die sie danach
//                                  noch nennen (Kennung oder voller Name), raus
//   heads-replay-<head>            Fälle, die die Person enthalten, raus      Kennung im Fall → neu
//   crm-signale                    kommender Termin der Person raus           Schlüssel → neu (früherer Termin gewinnt)
//   tasks                          nur EINDEUTIG zugeordnete Aufgaben         Link k=<alt> → k=<neu> (Beschreibung +
//                                  (Head-Aufgabe hd-<Vorschlag der Person>,   Kommentare), bezug.kontaktId → neu
//                                  Link k=<id> oder bezug.kontaktId, 28.09.
//                                  abends): voller Name → „[gelöscht]“ (auch
//                                  in Kommentaren), Link raus, bezug.kontaktId
//                                  raus; Aufgabe bleibt (eure Arbeit).
//                                  Nur-Namens-Treffer werden gemeldet, nie geändert.
//   crm-import-laeufe--<haushalt>  Vorher-Stand/Kennung/Fingerabdruck der      bewusst NICHT (Vorher-Stände sind Geschichte;
//     (K2, „Import rückgängig“)    Person aus jedem Lauf raus                  „rückgängig“ meldet den Zusammengeführten als Konflikt)
//   crm-sperrliste--<haushalt>     Person KOMMT HINZU (Grund „loeschung“, nur  —
//     (K2, nur SHA-256)            Hashes): ein erneuter Import legt sie nicht
//                                  wieder an (#60). Keine Klartexte.
//
// U2 (28.09., Datenschutz vollständig): Einwilligungs-Nachweise, Einschränkung (Art. 18), „geprüft“, Hinweis bei
// Erhebung und Fristverlängerung liegen AM KONTAKT (kein neuer Speicher mit Personenbezug) — Art. 17 nimmt sie mit
// dem Eintrag, die Auskunft (app/api/crm/datenschutz) listet sie eigens (`nachweisAuskunft`), die Dubletten-
// Zusammenführung hat eigene Regeln (lib/crm/dubletten.ts). Eine eingeschränkte Person wird nicht gelöscht und
// nicht zusammengeführt (die Routen lehnen mit 409 ab). `crm-loeschfristen` hält nur Fristen und die Tagesmarke —
// keine Kennungen; die Löschfrist-Aufgabe (`loeschfrist-kontakte`) nennt weder Kennung noch Namen.
//
// Jede Funktion ist idempotent (zweimal laufen ändert nichts mehr) und nimmt je
// Speicher genau EINE Schreibsperre (updateJson). Reine Teile sind exportiert und getestet.

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { aendereCrm, ladeCrm } from './speicher';
import { personEntfernen as crmOhne, personUmbiegen as crmUm, personVerweise } from './person-verweise';
import { KONFLIKT_SPEICHER, leererKonfliktStand, type KonfliktStand } from './import-konflikte';
import { ablageName, dateiPfad } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { HEADS, type HeadId } from '@/lib/heads/prompt';
import { leererStand, standName, type HeadStand, type HeadBericht } from '@/lib/heads/stand';
import type { ReplayStand } from '@/lib/heads/lauf';
import { laufHaushalte, laufName, laufOhne, type LaufBestand } from './import-lauf';
import type { Schnappschuss } from './import-lauf';
import { crmSchnappschuesse, schnappschuesse, schnappschussKonflikte, schnappschuesseAnwenden, nachSpeicher } from './zusammenfuehren-lauf';
import { CRM_LISTEN } from './typen';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { sperren } from './sperrliste';
import type { AufgabeBezug, AufgabeKommentar } from '@/types/tasks';

// ── Reine Helfer ─────────────────────────────────────────────────────────────

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Die Kennung als ganzes Wort (nicht als Teil einer längeren Kennung). */
const kennungMuster = (id: string, flags = '') => new RegExp(`(?<![A-Za-z0-9_-])${esc(id)}(?![A-Za-z0-9_-])`, flags);

/** Kommt die Kennung irgendwo (Schlüssel oder Text) in diesem Wert vor? */
export function enthaeltKennung(wert: unknown, id: string): boolean {
  if (!id) return false;
  return kennungMuster(id).test(JSON.stringify(wert ?? null));
}

/** Kennung überall (Schlüssel und Texte) von alt auf neu umschreiben. */
export function kennungErsetzen<T>(wert: T, alt: string, neu: string): T {
  if (!alt || alt === neu || !enthaeltKennung(wert, alt)) return wert;
  return JSON.parse(JSON.stringify(wert).replace(kennungMuster(alt, 'g'), neu)) as T;
}

/** Voller Name (Vor- und Nachname), wenn er eindeutig genug zum Suchen ist — sonst null. */
export function vollerName(k: Pick<Kontakt, 'vorname' | 'nachname'> | undefined): string | null {
  const v = (k?.vorname ?? '').trim(), n = (k?.nachname ?? '').trim();
  return v && n.length >= 3 ? `${v} ${n}` : null;
}
const nameMuster = (name: string, flags = 'i') => new RegExp(`(?<![\\p{L}\\p{N}])${esc(name).replace(/\s+/g, '\\s+')}(?![\\p{L}\\p{N}])`, `u${flags}`);
const nenntNamen = (wert: unknown, name: string | null) => !!name && nameMuster(name).test(JSON.stringify(wert ?? null));

// ── CRM-Freitexte (28.09., Integritätsprüfung K2) ──
// `person-verweise.ts` nimmt die KENNUNG aus dem CRM-Bestand. Der Name stand aber weiter in Deal-Titeln
// („Beratung Anna Beispiel“) und im Kundennamen eines Mandats (Privatkunde) — Art. 17 verlangt, dass er geht.
// Ersetzt wird nur der volle Name (`vollerName`) als ganzes Wort, durch „[gelöscht]“. Trägt eine ANDERE Person
// der Kartei denselben vollen Namen, nur dort, wo die gelöschte Person verknüpft war (`crmVerknuepft`).

export interface CrmNamenBezug { chancen: Set<string>; mandate: Set<string> }
/** Welche Deals und Mandate die Person nennen (vor dem Entfernen der Kennung zu bestimmen). */
export const crmVerknuepft = (crm: Pick<CrmBestand, 'chancen' | 'mandate'>, id: string): CrmNamenBezug => ({
  chancen: new Set((crm.chancen ?? []).filter(c => (c.kontaktIds ?? []).includes(id)).map(c => c.id)),
  mandate: new Set((crm.mandate ?? []).filter(m => (m.kontaktIds ?? []).includes(id)).map(m => m.id)),
});

/** Nennt ein Deal-Titel oder Kundenname den vollen Namen? */
export function crmNenntNamen(crm: Pick<CrmBestand, 'chancen' | 'mandate'>, name: string | null, nur?: CrmNamenBezug): boolean {
  if (!name) return false;
  const m = nameMuster(name);
  return (crm.chancen ?? []).some(c => (!nur || nur.chancen.has(c.id)) && m.test(c.titel ?? ''))
    || (crm.mandate ?? []).some(x => (!nur || nur.mandate.has(x.id)) && m.test(x.kunde ?? ''));
}

/** Voller Name → „[gelöscht]“ in `chancen[].titel` und `mandate[].kunde`. Idempotent; unverändert → derselbe Bestand. */
export function crmNamenTilgen<T extends Pick<CrmBestand, 'chancen' | 'mandate'>>(crm: T, name: string | null, nur?: CrmNamenBezug): T {
  if (!crmNenntNamen(crm, name, nur)) return crm;
  const weg = (t: string) => t.replace(nameMuster(name!, 'gi'), '[gelöscht]');
  return {
    ...crm,
    chancen: (crm.chancen ?? []).map(c => ((!nur || nur.chancen.has(c.id)) && nameMuster(name!).test(c.titel ?? '') ? { ...c, titel: weg(c.titel) } : c)),
    mandate: (crm.mandate ?? []).map(x => ((!nur || nur.mandate.has(x.id)) && nameMuster(name!).test(x.kunde ?? '') ? { ...x, kunde: weg(x.kunde) } : x)),
  };
}

// ── Dateiablage ──

/** Hat der Eintrag außer der Person noch einen geschäftlichen Bezug? */
const andererBezug = (e: DateiEintrag) => !!(e.firmaId || e.mandatId || e.dealId || e.rechnungId || e.angebotId); // Angebots-PDF (28.09.) = Geschäftsunterlage

/**
 * Art. 17 in der Ablage: Einträge NUR mit Personenbezug fallen weg (samt Datei); Einträge, die zugleich an
 * Firma/Mandat/Deal/Rechnung hängen, verlieren nur den Personenbezug (Geschäftsunterlage mit Aufbewahrungspflicht).
 */
export function ablageOhne(eintraege: DateiEintrag[], id: string): { eintraege: DateiEintrag[]; weg: DateiEintrag[]; geloest: number } {
  const weg: DateiEintrag[] = [];
  let geloest = 0;
  const bleiben: DateiEintrag[] = [];
  for (const e of eintraege) {
    if (e.kontaktId !== id) { bleiben.push(e); continue; }
    if (andererBezug(e)) { const { kontaktId: _k, ...rest } = e; bleiben.push(rest); geloest++; } else weg.push(e);
  }
  return { eintraege: bleiben, weg, geloest };
}
export function ablageUm(eintraege: DateiEintrag[], alt: string, neu: string): { eintraege: DateiEintrag[]; n: number } {
  let n = 0;
  return { eintraege: eintraege.map(e => (e.kontaktId === alt ? (n++, { ...e, kontaktId: neu }) : e)), n };
}
/** Für die Auskunft: nur Metadaten, nie Dateiinhalte. */
export const ablageAuskunft = (eintraege: DateiEintrag[], id: string) => eintraege.filter(e => e.kontaktId === id).map(e => ({
  id: e.id, art: e.art, ...(e.titel ? { titel: e.titel } : {}), ...(e.datei ? { datei: { name: e.datei.name, typ: e.datei.typ, groesse: e.datei.groesse } } : {}),
  ...(e.vertrag ? { vertrag: e.vertrag } : {}), ...(e.angebot ? { angebot: e.angebot } : {}), ...(e.notiz ? { notiz: e.notiz } : {}),
  hochgeladenAm: e.hochgeladenAm, ...(e.firmaId ? { firmaId: e.firmaId } : {}), ...(e.mandatId ? { mandatId: e.mandatId } : {}), ...(e.dealId ? { dealId: e.dealId } : {}), ...(e.rechnungId ? { rechnungId: e.rechnungId } : {}),
}));

// ── Import-Konflikte ──

export function konflikteOhne(st: KonfliktStand, id: string): { stand: KonfliktStand; n: number } {
  const konflikte = st.konflikte.filter(k => k.kontaktId !== id);
  const moeglicheDubletten = st.moeglicheDubletten.filter(d => d.kontaktId !== id && d.mitId !== id);
  const n = st.konflikte.length - konflikte.length + st.moeglicheDubletten.length - moeglicheDubletten.length;
  return { stand: n ? { ...st, konflikte, moeglicheDubletten } : st, n };
}
export function konflikteUm(st: KonfliktStand, alt: string, neu: string): { stand: KonfliktStand; n: number } {
  let n = 0;
  const gesehen = new Set(st.konflikte.filter(k => k.kontaktId === neu).map(k => k.feld));
  const konflikte = st.konflikte.flatMap(k => {
    if (k.kontaktId !== alt) return [k];
    n++;
    if (gesehen.has(k.feld)) return []; // Die behaltene Person hat für das Feld schon einen offenen Konflikt.
    gesehen.add(k.feld);
    return [{ ...k, kontaktId: neu }];
  });
  const paar = new Set<string>();
  const moeglicheDubletten = st.moeglicheDubletten.flatMap(d => {
    const um = d.kontaktId === alt || d.mitId === alt;
    const x = um ? { ...d, kontaktId: d.kontaktId === alt ? neu : d.kontaktId, ...(d.mitId ? { mitId: d.mitId === alt ? neu : d.mitId } : {}) } : d;
    if (um) n++;
    if (x.mitId && x.mitId === x.kontaktId) return []; // das eben zusammengeführte Paar
    const s = `${x.kontaktId}|${x.mitId ?? ''}|${x.grund}`;
    if (paar.has(s)) return [];
    paar.add(s);
    return [x];
  });
  return { stand: n ? { ...st, konflikte, moeglicheDubletten } : st, n };
}
/** Für die Auskunft: nur die Feldnamen und die beiden Werte der Person. */
export const konflikteAuskunft = (st: KonfliktStand, id: string) => ({
  konflikte: st.konflikte.filter(k => k.kontaktId === id).map(k => ({ feld: k.feld, online: k.online, liste: k.liste })),
  moeglicheDubletten: st.moeglicheDubletten.filter(d => d.kontaktId === id || d.mitId === id).length,
});

// ── Heads ──

type Kampagne = { kontakt_ids: string[] } | null | undefined;
const kampagneOhne = <V extends { kampagne?: Kampagne }>(v: V, id: string): V => (v.kampagne?.kontakt_ids.includes(id) ? { ...v, kampagne: { ...v.kampagne, kontakt_ids: v.kampagne.kontakt_ids.filter(x => x !== id) } } : v);

/** Freigabe-Liste und Berichte eines Heads ohne die Person. `aufgaben` = Kennungen der Aufgaben, die zu entfernten Vorschlägen gehören. */
export function headStandOhne(st: HeadStand, id: string, name: string | null): { stand: HeadStand; n: number; aufgaben: string[] } {
  const aufgaben: string[] = [];
  let n = 0;
  const vorschlaege = st.vorschlaege.filter(v => {
    if (v.kontakt_id !== id) return true;
    n++;
    aufgaben.push(v.auto?.rueckgaengig?.aufgabeId ?? `hd-${v.id}`);
    return false;
  }).map(v => { const x = kampagneOhne(v, id); if (x !== v) n++; return x; });
  const berichte = st.berichte.flatMap((b): HeadBericht[] => {
    const antwort = {
      ...b.antwort,
      vorschlaege: b.antwort.vorschlaege.filter(v => v.kontakt_id !== id).map(v => kampagneOhne(v, id)),
      befunde: b.antwort.befunde.filter(f => !enthaeltKennung(f, id) && !nenntNamen(f, name)),
    };
    const neu = { ...b, antwort };
    if (enthaeltKennung(neu, id) || nenntNamen(neu, name)) { n++; return []; } // nennt die Person noch im Freitext: ganzer Bericht raus
    if (antwort.vorschlaege.length !== b.antwort.vorschlaege.length || antwort.befunde.length !== b.antwort.befunde.length || JSON.stringify(antwort.vorschlaege) !== JSON.stringify(b.antwort.vorschlaege)) n++;
    return [neu];
  });
  return { stand: n ? { ...st, vorschlaege, berichte } : st, n, aufgaben };
}
export function headStandUm(st: HeadStand, alt: string, neu: string): { stand: HeadStand; n: number } {
  if (!enthaeltKennung({ v: st.vorschlaege, b: st.berichte }, alt)) return { stand: st, n: 0 };
  return { stand: { ...st, vorschlaege: kennungErsetzen(st.vorschlaege, alt, neu), berichte: kennungErsetzen(st.berichte, alt, neu) }, n: 1 };
}
export function replayOhne(st: ReplayStand, id: string, name: string | null): { stand: ReplayStand; n: number } {
  const faelle = st.faelle.filter(f => !enthaeltKennung(f, id) && !nenntNamen(f, name));
  return { stand: faelle.length === st.faelle.length ? st : { ...st, faelle }, n: st.faelle.length - faelle.length };
}
export function replayUm(st: ReplayStand, alt: string, neu: string): { stand: ReplayStand; n: number } {
  const n = st.faelle.filter(f => enthaeltKennung(f, alt)).length;
  return { stand: n ? { ...st, faelle: kennungErsetzen(st.faelle, alt, neu) } : st, n };
}

// ── Signale (kommende Termine je Person) ──

export interface SignalStand { letzter?: string; kommend?: Record<string, { titel: string; start: string }>; neu?: number }
export function signaleOhne(st: SignalStand, id: string): { stand: SignalStand; n: number } {
  if (!st.kommend?.[id]) return { stand: st, n: 0 };
  const { [id]: _weg, ...rest } = st.kommend;
  return { stand: { ...st, kommend: rest }, n: 1 };
}
export function signaleUm(st: SignalStand, alt: string, neu: string): { stand: SignalStand; n: number } {
  const a = st.kommend?.[alt];
  if (!a) return { stand: st, n: 0 };
  const { [alt]: _weg, ...rest } = st.kommend!;
  const b = rest[neu];
  return { stand: { ...st, kommend: { ...rest, [neu]: b && b.start <= a.start ? b : a } }, n: 1 };
}

// ── Aufgaben ──

interface Aufgabe { id: string; title?: string; description?: string; status?: string; dueDate?: string; bezug?: AufgabeBezug; kommentare?: AufgabeKommentar[]; [k: string]: unknown }
const linkMuster = (id: string) => new RegExp(`[?&]k=${esc(id)}(?![A-Za-z0-9_-])`);
const linkWeg = (id: string) => new RegExp(`\\S*[?&]k=${esc(id)}(?![A-Za-z0-9_-])\\S*`, 'g');
/** Der CRM-Bezug einer Aufgabe ohne den Kontakt — leer → undefined (das Feld fällt dann weg). */
const bezugOhneKontakt = (b: AufgabeBezug): AufgabeBezug | undefined => { const { kontaktId: _k, ...rest } = b; return Object.keys(rest).length ? rest : undefined; };

/**
 * Welche Aufgaben gehören zur Person? EINDEUTIG ist eine Aufgabe, wenn sie mit ihr im CRM verknüpft ist
 * (`bezug.kontaktId`, 28.09. abends), aus einem Head-Vorschlag an genau diese Person stammt (`hd-<Vorschlag>`)
 * oder einen Link auf sie trägt (`k=<id>`). Ein Name im Titel, in der Beschreibung oder in einem Kommentar
 * allein ist KEIN Beweis (Namensgleichheit, „Müller“ kann die Firma sein) — solche Aufgaben werden nur gemeldet.
 */
export function aufgabenZuordnen(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { eindeutig: Aufgabe[]; nurName: Aufgabe[] } {
  const hd = new Set(headAufgaben);
  const eindeutig: Aufgabe[] = [], nurName: Aufgabe[] = [];
  for (const t of tasks) {
    if (t.bezug?.kontaktId === id || hd.has(t.id) || linkMuster(id).test(t.description ?? '')) eindeutig.push(t);
    else if (name && nameMuster(name).test([t.title ?? '', t.description ?? '', ...(t.kommentare ?? []).map(k => k.text ?? '')].join('\n'))) nurName.push(t);
  }
  return { eindeutig, nurName };
}
/**
 * Eindeutige Aufgaben entpersonalisieren: voller Name → „[gelöscht]“ (Titel, Beschreibung, Kommentare), Link auf
 * die Person raus, `bezug.kontaktId` raus (Firma/Mandat/Deal bleiben; leerer Bezug → Feld weg). Die Aufgabe bleibt.
 */
export function aufgabenAnonymisieren(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { tasks: Aufgabe[]; n: number; pruefen: string[] } {
  const z = aufgabenZuordnen(tasks, id, headAufgaben, name);
  const ids = new Set(z.eindeutig.map(t => t.id));
  let n = 0;
  const neu = tasks.map(t => {
    if (!ids.has(t.id)) return t;
    const weg = (s?: string) => { let x = (s ?? '').replace(linkWeg(id), '').replace(/[ \t]+\n/g, '\n').trimEnd(); if (name) x = x.replace(nameMuster(name, 'gi'), '[gelöscht]'); return x; };
    const title = weg(t.title) || 'Aufgabe (Person gelöscht)';
    const description = t.description !== undefined ? weg(t.description) : undefined;
    let kommentareGeaendert = false;
    const kommentare = t.kommentare?.map(k => {
      const text = weg(k.text) || '[gelöscht]';
      if (text === k.text) return k;
      kommentareGeaendert = true;
      return { ...k, text };
    });
    const bezugWeg = t.bezug?.kontaktId === id;
    if (title === t.title && description === t.description && !kommentareGeaendert && !bezugWeg) return t;
    n++;
    const { bezug: _b, ...ohneBezug } = t;
    const bezug = t.bezug ? (bezugWeg ? bezugOhneKontakt(t.bezug) : t.bezug) : undefined;
    return {
      ...ohneBezug, title, ...(description !== undefined ? { description } : {}), ...(bezug ? { bezug } : {}),
      ...(kommentareGeaendert ? { kommentare } : {}), updatedAt: new Date().toISOString(),
    };
  });
  return { tasks: n ? neu : tasks, n, pruefen: z.nurName.map(t => t.id) };
}
/** Dubletten: Link `k=<alt>` (Beschreibung, Kommentare) und `bezug.kontaktId` → `neu`. Je geänderter Aufgabe zählt 1. */
export function aufgabenUm(tasks: Aufgabe[], alt: string, neu: string): { tasks: Aufgabe[]; n: number } {
  let n = 0;
  const r = () => new RegExp(`([?&]k=)${esc(alt)}(?![A-Za-z0-9_-])`, 'g');
  const um = (s: string) => s.replace(r(), `$1${neu}`);
  const l = tasks.map(t => {
    const link = !!t.description && r().test(t.description);
    const bezug = t.bezug?.kontaktId === alt;
    const komm = (t.kommentare ?? []).some(k => r().test(k.text ?? ''));
    if (!link && !bezug && !komm) return t;
    n++;
    return {
      ...t,
      ...(link ? { description: um(t.description!) } : {}),
      ...(bezug ? { bezug: { ...t.bezug, kontaktId: neu } } : {}),
      ...(komm ? { kommentare: t.kommentare!.map(k => (r().test(k.text ?? '') ? { ...k, text: um(k.text) } : k)) } : {}),
    };
  });
  return { tasks: n ? l : tasks, n };
}

// ── Speicher ─────────────────────────────────────────────────────────────────

const ABLAGE_DATEI = /^crm-dateien--([a-z0-9][a-z0-9-]{0,39})\.json$/;
/** Alle Haushalte mit Dateiablage (aus den Dateinamen, ohne Inhalte zu lesen). */
async function ablageHaushalte(): Promise<string[]> {
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  return namen.map(n => ABLAGE_DATEI.exec(n)?.[1]).filter((h): h is string => !!h).sort();
}
const replayName = (h: HeadId) => `heads-replay-${h}`;
/** Nur Speicher anfassen, die es gibt — nie einen leeren anlegen. */
const da = async (name: string) => (await loadJson<unknown>(name)) !== null;
type Tasks = { tasks?: Aufgabe[] } & Record<string, unknown>;

/** Was je Speicher geändert wurde (nur Zahlen und Kennungen — nie Personendaten). */
export interface PersonBericht {
  speicher: Record<string, number>;
  /** Aufgaben, die die Person nur beim Namen nennen — von Hand prüfen (nicht geändert). */
  aufgabenPruefen: string[];
}
const zaehle = (b: PersonBericht, name: string, n: number) => { if (n) b.speicher[name] = (b.speicher[name] ?? 0) + n; };

/**
 * Art. 17: die Person aus ALLEN Speichern entfernen (auch aus der Kartei). Idempotent. Liefert, was wo geändert wurde.
 * Der Löschprotokoll-Eintrag bleibt Sache der Route.
 */
export async function personEntfernen(id: string, bekannt?: Pick<Kontakt, 'vorname' | 'nachname'> & Partial<Pick<Kontakt, 'email' | 'emails' | 'hubspotId' | 'firma'>>): Promise<PersonBericht> {
  const b: PersonBericht = { speicher: {}, aufgabenPruefen: [] };
  if (!id) return b;
  let kontakt: Kontakt | undefined;
  let andereNamen: string[] = [];
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    kontakt = f.kontakte.find(k => k.id === id);
    andereNamen = f.kontakte.filter(k => k.id !== id).map(k => (vollerName(k) ?? '').toLowerCase()).filter(Boolean);
    if (!kontakt) return f;
    zaehle(b, 'kontakte', 1);
    return { ...f, kontakte: f.kontakte.filter(k => k.id !== id) };
  });
  // Name für die Freitext-Suche (Heads, Aufgaben) — gibt es den Kontakt nicht mehr (zweiter Lauf), bleibt es bei der Kennung.
  // `bekannt`: der Aufrufer hat die Kartei schon selbst geleert (PATCH /api/state/kontakte, op 'delete') und reicht den Namen nach.
  const name = vollerName(kontakt ?? bekannt);

  // Sperrliste (K2 #60): nur Hashes der Merkmale — ein erneuter Import der Liste legt die Person nicht wieder an.
  const person = kontakt ?? bekannt;
  if (person && await sperren([person], 'loeschung', new Date().toISOString())) zaehle(b, 'crm-sperrliste', 1);

  // Import-Läufe (K2 #25): der Vorher-Stand der Person verschwindet aus jedem Lauf.
  for (const h of await laufHaushalte()) {
    await updateJson<LaufBestand>(laufName(h), cur => {
      let n = 0;
      const laeufe = (cur?.laeufe ?? []).map(l => { const r = laufOhne(l, id); n += r.n; return r.lauf; });
      zaehle(b, laufName(h), n);
      return n ? { laeufe } : (cur ?? { laeufe: [] });
    });
  }

  // CRM: Kennung raus (person-verweise.ts) UND der volle Name aus Deal-Titeln und Kundennamen (K2, 28.09.) — in EINER Sperre.
  // Gibt es eine andere Person mit demselben vollen Namen, nur dort, wo die gelöschte verknüpft war.
  const namensgleich = !!name && andereNamen.includes(name.toLowerCase());
  const vorher = await ladeCrm();
  if (enthaeltKennung(vorher, id) || crmNenntNamen(vorher, name, namensgleich ? crmVerknuepft(vorher, id) : undefined)) {
    await aendereCrm(c => { const nur = namensgleich ? crmVerknuepft(c, id) : undefined; return crmNamenTilgen(crmOhne(c, id), name, nur); });
    zaehle(b, 'crm', 1);
  }

  for (const h of await ablageHaushalte()) {
    let weg: DateiEintrag[] = [];
    await updateJson<{ eintraege: DateiEintrag[] }>(ablageName(h), cur => {
      const r = ablageOhne(cur?.eintraege ?? [], id);
      weg = r.weg;
      zaehle(b, `crm-dateien--${h}`, r.weg.length + r.geloest);
      return r.weg.length || r.geloest ? { ...(cur ?? {}), eintraege: r.eintraege } : (cur ?? { eintraege: [] });
    });
    // Dateien physisch entfernen (erst NACH dem Eintrag — ein Fehler hier hinterlässt höchstens eine verwaiste, verschlüsselte Datei).
    for (const e of weg) if (e.datei) await fs.unlink(dateiPfad(h, e.id)).catch(() => {});
  }

  if (await da(KONFLIKT_SPEICHER)) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => { const r = konflikteOhne(cur ?? leererKonfliktStand(), id); zaehle(b, KONFLIKT_SPEICHER, r.n); return r.stand; });

  const headAufgaben: string[] = [];
  for (const h of HEADS) {
    if (await da(standName(h))) await updateJson<HeadStand>(standName(h), cur => { const r = headStandOhne({ ...leererStand(), ...(cur ?? {}) }, id, name); headAufgaben.push(...r.aufgaben); zaehle(b, standName(h), r.n); return r.n ? r.stand : (cur as HeadStand); });
    if (await da(replayName(h))) await updateJson<ReplayStand>(replayName(h), cur => { const r = replayOhne(cur ?? { faelle: [] }, id, name); zaehle(b, replayName(h), r.n); return r.stand; });
  }

  if (await da('crm-signale')) await updateJson<SignalStand>('crm-signale', cur => { const r = signaleOhne(cur ?? {}, id); zaehle(b, 'crm-signale', r.n); return r.stand; });

  if (await da('tasks')) {
    await updateJson<Tasks>('tasks', cur => {
      const f = cur ?? { tasks: [] };
      const r = aufgabenAnonymisieren(f.tasks ?? [], id, headAufgaben, name);
      zaehle(b, 'tasks', r.n);
      b.aufgabenPruefen = r.pruefen;
      return r.n ? { ...f, tasks: r.tasks } : f;
    });
  }
  return b;
}

/**
 * Dubletten: alle Verweise von `alt` auf `neu` umbiegen — außer in der Kartei selbst (dort führt die
 * Dubletten-Route beide Einträge zusammen und löscht `alt`). Idempotent.
 */
export async function personUmbiegen(alt: string, neu: string): Promise<PersonBericht> {
  const b: PersonBericht = { speicher: {}, aufgabenPruefen: [] };
  if (!alt || !neu || alt === neu) return b;
  if (enthaeltKennung(await ladeCrm(), alt)) { await aendereCrm(c => crmUm(c, alt, neu)); zaehle(b, 'crm', 1); }
  for (const h of await ablageHaushalte()) {
    await updateJson<{ eintraege: DateiEintrag[] }>(ablageName(h), cur => { const r = ablageUm(cur?.eintraege ?? [], alt, neu); zaehle(b, `crm-dateien--${h}`, r.n); return r.n ? { ...(cur ?? {}), eintraege: r.eintraege } : (cur ?? { eintraege: [] }); });
  }
  if (await da(KONFLIKT_SPEICHER)) await updateJson<KonfliktStand>(KONFLIKT_SPEICHER, cur => { const r = konflikteUm(cur ?? leererKonfliktStand(), alt, neu); zaehle(b, KONFLIKT_SPEICHER, r.n); return r.stand; });
  for (const h of HEADS) {
    if (await da(standName(h))) await updateJson<HeadStand>(standName(h), cur => { const r = headStandUm({ ...leererStand(), ...(cur ?? {}) }, alt, neu); zaehle(b, standName(h), r.n); return r.n ? r.stand : (cur as HeadStand); });
    if (await da(replayName(h))) await updateJson<ReplayStand>(replayName(h), cur => { const r = replayUm(cur ?? { faelle: [] }, alt, neu); zaehle(b, replayName(h), r.n); return r.stand; });
  }
  if (await da('crm-signale')) await updateJson<SignalStand>('crm-signale', cur => { const r = signaleUm(cur ?? {}, alt, neu); zaehle(b, 'crm-signale', r.n); return r.stand; });
  if (await da('tasks')) await updateJson<Tasks>('tasks', cur => { const f = cur ?? { tasks: [] }; const r = aufgabenUm(f.tasks ?? [], alt, neu); zaehle(b, 'tasks', r.n); return r.n ? { ...f, tasks: r.tasks } : f; });
  return b;
}

/**
 * Art. 15: was die Speicher AUSSER Kartei und Firma über die Person halten. Dateiablage nur als Metadaten
 * (nie Inhalte), Head-Vorschläge nur mit Titel/Status, Aufgaben nur eindeutig zugeordnete (s. `aufgabenZuordnen`,
 * auch über `bezug.kontaktId`).
 */
export async function personAufzaehlen(id: string) {
  const crm = await ladeCrm();
  const dateien: ReturnType<typeof ablageAuskunft> = [];
  for (const h of await ablageHaushalte()) dateien.push(...ablageAuskunft((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? [], id));
  const importKonflikte = konflikteAuskunft((await loadJson<KonfliktStand>(KONFLIKT_SPEICHER)) ?? leererKonfliktStand(), id);
  const headVorschlaege: { head: HeadId; titel: string; art: string; status: string; erstellt: string }[] = [];
  const headAufgaben: string[] = [];
  for (const h of HEADS) {
    for (const v of (await loadJson<HeadStand>(standName(h)))?.vorschlaege ?? []) {
      if (v.kontakt_id !== id) continue;
      headVorschlaege.push({ head: h, titel: v.titel, art: v.art, status: v.status, erstellt: v.erstellt });
      headAufgaben.push(v.auto?.rueckgaengig?.aufgabeId ?? `hd-${v.id}`);
    }
  }
  // Replay-Fälle der Heads (Datenpakete für Evals): nur die Zahl — der Inhalt ist derselbe Bestand wie oben.
  let headReplayFaelle = 0;
  for (const h of HEADS) headReplayFaelle += ((await loadJson<ReplayStand>(replayName(h)))?.faelle ?? []).filter(f => enthaeltKennung(f, id)).length;
  const kommenderTermin = (await loadJson<SignalStand>('crm-signale'))?.kommend?.[id] ?? null;
  const tasks = (await loadJson<Tasks>('tasks'))?.tasks ?? [];
  const aufgaben = aufgabenZuordnen(tasks, id, headAufgaben, null).eindeutig.map(t => ({ id: t.id, titel: t.title, status: t.status, ...(t.dueDate ? { faellig: t.dueDate } : {}), ...(t.bezug?.kontaktId === id ? { verknuepft: true } : {}) }));
  // Import-Läufe (K2): in wie vielen Läufen ein Vorher-Stand der Person liegt (Inhalt = frühere Fassung derselben Stammdaten).
  let importLaeufe = 0;
  for (const h of await laufHaushalte()) importLaeufe += ((await loadJson<LaufBestand>(laufName(h)))?.laeufe ?? []).filter(l => laufOhne(l, id).n > 0).length;
  return { ...personVerweise(crm, id), dateien, importKonflikte, headVorschlaege, headReplayFaelle, kommenderTermin, aufgaben, importLaeufe };
}

/**
 * Wo eine Kennung „verknüpft“ sein kann — außer in der Kartei selbst und den Import-Konflikten (Ablaufprüfung 28.09., c):
 * CRM-Bestand, Dateiablage (alle Haushalte), Head-Vorschläge, Termin-Signale, Aufgaben. „Import rückgängig“ fragt damit,
 * ob ein neu angelegter Kontakt (bzw. eine neue Firma) inzwischen irgendwo hängt: `enthaeltKennung(teil, id)` je Teil.
 * Einmal laden, dann für viele Kennungen prüfen.
 */
export interface VerknuepfungsBestaende { crm: import('./typen').CrmBestand; ablage: DateiEintrag[]; heads: HeadStand['vorschlaege']; signale: SignalStand; tasks: Aufgabe[] }
export async function verknuepfungsBestaende(): Promise<VerknuepfungsBestaende> {
  const ablage: DateiEintrag[] = [];
  for (const h of await ablageHaushalte()) ablage.push(...((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? []));
  const heads: HeadStand['vorschlaege'] = [];
  for (const h of HEADS) heads.push(...((await loadJson<HeadStand>(standName(h)))?.vorschlaege ?? []));
  return { crm: await ladeCrm(), ablage, heads, signale: (await loadJson<SignalStand>('crm-signale')) ?? {}, tasks: (await loadJson<Tasks>('tasks'))?.tasks ?? [] };
}
/** Hängt die Kennung irgendwo (ohne den Eintrag `ohne` im CRM, z. B. die Firma selbst)? Liefert den ersten Bestand oder null. */
export function verknuepftIn(b: VerknuepfungsBestaende, id: string, ohne?: { liste: 'firmen'; id: string }): string | null {
  const crm = ohne ? { ...b.crm, firmen: b.crm.firmen.filter(f => f.id !== ohne.id) } : b.crm;
  if (enthaeltKennung(crm, id)) return 'crm';
  if (b.ablage.some(e => enthaeltKennung(e, id))) return 'dateien';
  if (b.heads.some(v => enthaeltKennung(v, id))) return 'heads';
  if (enthaeltKennung(b.signale, id)) return 'signale';
  if (b.tasks.some(t => enthaeltKennung(t, id))) return 'aufgaben';
  return null;
}

// ── Zusammenführen mit „Rückgängig“ (28.09., Ablaufprüfung W4) ──────────────
// Diese Datei kennt die Speicher — also rechnet sie auch, was `personUmbiegen` in CRM, Dateiablage und Aufgaben
// ändern WIRD (Schnappschüsse für den Zusammenführungs-Lauf), und schreibt die Vorher-Stände beim Rückgängig zurück.

type MitId = { id: string } & Record<string, unknown>;

/** Was `personUmbiegen(alt, neu)` in CRM, Dateiablage und Aufgaben ändern wird — rein auf dem aktuellen Stand gerechnet. */
export async function umbiegenSchnappschuesse(alt: string, neu: string): Promise<Schnappschuss[]> {
  if (!alt || !neu || alt === neu) return [];
  const raus: Schnappschuss[] = [];
  const crm = await ladeCrm();
  if (enthaeltKennung(crm, alt)) raus.push(...crmSchnappschuesse(crm, crmUm(crm, alt, neu)));
  for (const h of await ablageHaushalte()) {
    const e = (await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? [];
    const r = ablageUm(e, alt, neu);
    if (r.n) raus.push(...schnappschuesse(`dateien:${h}`, e as unknown as MitId[], r.eintraege as unknown as MitId[]));
  }
  const tasks = (await loadJson<Tasks>('tasks'))?.tasks ?? [];
  const t = aufgabenUm(tasks, alt, neu);
  if (t.n) raus.push(...schnappschuesse('tasks', tasks as MitId[], t.tasks as MitId[]));
  return raus;
}

const DATEIEN_SPEICHER = /^dateien:([a-z0-9][a-z0-9-]{0,39})$/;
/** Aktueller Stand eines Schnappschuss-Speichers (`crm:<liste>`, `dateien:<haushalt>`, `tasks`) — null, wenn unbekannt. */
export async function schnappschussListe(speicher: string, crm?: CrmBestandT): Promise<MitId[] | null> {
  if (speicher.startsWith('crm:')) {
    const l = speicher.slice(4) as (typeof CRM_LISTEN)[number];
    if (!(CRM_LISTEN as readonly string[]).includes(l)) return null;
    return ((crm ?? await ladeCrm())[l] ?? []) as unknown as MitId[];
  }
  const d = DATEIEN_SPEICHER.exec(speicher);
  if (d) return ((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(d[1])))?.eintraege ?? []) as unknown as MitId[];
  if (speicher === 'tasks') return ((await loadJson<Tasks>('tasks'))?.tasks ?? []) as MitId[];
  return null;
}
type CrmBestandT = Awaited<ReturnType<typeof ladeCrm>>;

/**
 * Vorher-Stände zurückschreiben — je Speicher EINE Sperre mit erneuter Prüfung (hat inzwischen jemand geschrieben,
 * bleibt dieser Speicher unangetastet und steht in `konflikte`). Das CRM zuerst und als Ganzes (alle Listen in einer Sperre).
 */
export async function schnappschuesseZurueck(s: readonly Schnappschuss[], wer?: Wer): Promise<{ zurueck: number; konflikte: string[] }> {
  let zurueck = 0;
  const konflikte: string[] = [];
  const gruppen = nachSpeicher(s);
  const crmTeile = Array.from(gruppen).filter(([k]) => k.startsWith('crm:'));
  if (crmTeile.length) {
    let passt = true;
    await aendereCrm(c => {
      for (const [k, x] of crmTeile) if (schnappschussKonflikte(x, (c[k.slice(4) as (typeof CRM_LISTEN)[number]] ?? []) as unknown as MitId[]).length) passt = false;
      if (!passt) return c;
      const neu = { ...c } as Record<string, unknown>;
      for (const [k, x] of crmTeile) { neu[k.slice(4)] = schnappschuesseAnwenden((c[k.slice(4) as (typeof CRM_LISTEN)[number]] ?? []) as unknown as MitId[], x); zurueck += x.length; }
      return neu as unknown as CrmBestandT;
    }, wer);
    if (!passt) konflikte.push('crm');
  }
  for (const [k, x] of Array.from(gruppen)) {
    if (k.startsWith('crm:')) continue;
    const d = DATEIEN_SPEICHER.exec(k);
    const name = d ? ablageName(d[1]) : k === 'tasks' ? 'tasks' : null;
    if (!name) { konflikte.push(k); continue; }
    const feld = d ? 'eintraege' : 'tasks';
    let passt = true;
    await updateJson<Record<string, unknown>>(name, cur => {
      const f = cur ?? {};
      const liste = (Array.isArray(f[feld]) ? f[feld] : []) as MitId[];
      if (schnappschussKonflikte(x, liste).length) { passt = false; return f; }
      zurueck += x.length;
      return { ...f, [feld]: schnappschuesseAnwenden(liste, x) };
    });
    if (!passt) konflikte.push(k);
  }
  return { zurueck, konflikte };
}

/** Kurz gerechnet, damit die Oberfläche vor dem Zusammenführen zeigen kann, was wandert: Dateien der Person (alle Haushalte). */
export async function dateienDerPerson(id: string): Promise<number> {
  let n = 0;
  for (const h of await ablageHaushalte()) n += ((await loadJson<{ eintraege: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? []).filter(e => e.kontaktId === id).length;
  return n;
}
