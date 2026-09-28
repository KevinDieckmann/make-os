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
//   crm                            lib/crm/person-verweise.ts                 dito
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
//   tasks                          nur EINDEUTIG zugeordnete Aufgaben         Link k=<alt> → k=<neu>
//                                  (Head-Aufgabe hd-<Vorschlag der Person>
//                                  oder Link k=<id>): voller Name → „[gelöscht]“,
//                                  Link raus; Aufgabe bleibt (eure Arbeit).
//                                  Nur-Namens-Treffer werden gemeldet, nie geändert.
//   crm-import-laeufe--<haushalt>  Vorher-Stand/Kennung/Fingerabdruck der      bewusst NICHT (Vorher-Stände sind Geschichte;
//     (K2, „Import rückgängig“)    Person aus jedem Lauf raus                  „rückgängig“ meldet den Zusammengeführten als Konflikt)
//   crm-sperrliste--<haushalt>     Person KOMMT HINZU (Grund „loeschung“, nur  —
//     (K2, nur SHA-256)            Hashes): ein erneuter Import legt sie nicht
//                                  wieder an (#60). Keine Klartexte.
//
// Jede Funktion ist idempotent (zweimal laufen ändert nichts mehr) und nimmt je
// Speicher genau EINE Schreibsperre (updateJson). Reine Teile sind exportiert und getestet.

import { promises as fs } from 'fs';
import { datenOrdner, loadJson, updateJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import { aendereCrm, ladeCrm } from './speicher';
import { personEntfernen as crmOhne, personUmbiegen as crmUm, personVerweise } from './person-verweise';
import { KONFLIKT_SPEICHER, leererKonfliktStand, type KonfliktStand } from './import-konflikte';
import { ablageName, dateiPfad } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { HEADS, type HeadId } from '@/lib/heads/prompt';
import { leererStand, standName, type HeadStand, type HeadBericht } from '@/lib/heads/stand';
import type { ReplayStand } from '@/lib/heads/lauf';
import { laufHaushalte, laufName, laufOhne, type LaufBestand } from './import-lauf';
import { sperren } from './sperrliste';

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

// ── Dateiablage ──

/** Hat der Eintrag außer der Person noch einen geschäftlichen Bezug? */
const andererBezug = (e: DateiEintrag) => !!(e.firmaId || e.mandatId || e.dealId || e.rechnungId);

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

interface Aufgabe { id: string; title?: string; description?: string; status?: string; dueDate?: string; [k: string]: unknown }
const linkMuster = (id: string) => new RegExp(`[?&]k=${esc(id)}(?![A-Za-z0-9_-])`);
const linkWeg = (id: string) => new RegExp(`\\S*[?&]k=${esc(id)}(?![A-Za-z0-9_-])\\S*`, 'g');

/**
 * Welche Aufgaben gehören zur Person? Aufgaben haben kein Kontaktfeld. EINDEUTIG ist eine Aufgabe nur,
 * wenn sie aus einem Head-Vorschlag an genau diese Person stammt (`hd-<Vorschlag>`) oder einen Link auf
 * sie trägt (`k=<id>`). Ein Name im Titel allein ist KEIN Beweis (Namensgleichheit, „Müller“ kann die
 * Firma sein) — solche Aufgaben werden nur gemeldet.
 */
export function aufgabenZuordnen(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { eindeutig: Aufgabe[]; nurName: Aufgabe[] } {
  const hd = new Set(headAufgaben);
  const eindeutig: Aufgabe[] = [], nurName: Aufgabe[] = [];
  for (const t of tasks) {
    if (hd.has(t.id) || linkMuster(id).test(t.description ?? '')) eindeutig.push(t);
    else if (name && nameMuster(name).test(`${t.title ?? ''}\n${t.description ?? ''}`)) nurName.push(t);
  }
  return { eindeutig, nurName };
}
/** Eindeutige Aufgaben entpersonalisieren: voller Name → „[gelöscht]“, Link auf die Person raus. Die Aufgabe bleibt. */
export function aufgabenAnonymisieren(tasks: Aufgabe[], id: string, headAufgaben: string[], name: string | null): { tasks: Aufgabe[]; n: number; pruefen: string[] } {
  const z = aufgabenZuordnen(tasks, id, headAufgaben, name);
  const ids = new Set(z.eindeutig.map(t => t.id));
  let n = 0;
  const neu = tasks.map(t => {
    if (!ids.has(t.id)) return t;
    const weg = (s?: string) => { let x = (s ?? '').replace(linkWeg(id), '').replace(/[ \t]+\n/g, '\n').trimEnd(); if (name) x = x.replace(nameMuster(name, 'gi'), '[gelöscht]'); return x; };
    const title = weg(t.title) || 'Aufgabe (Person gelöscht)';
    const description = t.description !== undefined ? weg(t.description) : undefined;
    if (title === t.title && description === t.description) return t;
    n++;
    return { ...t, title, ...(description !== undefined ? { description } : {}), updatedAt: new Date().toISOString() };
  });
  return { tasks: n ? neu : tasks, n, pruefen: z.nurName.map(t => t.id) };
}
export function aufgabenUm(tasks: Aufgabe[], alt: string, neu: string): { tasks: Aufgabe[]; n: number } {
  let n = 0;
  const r = new RegExp(`([?&]k=)${esc(alt)}(?![A-Za-z0-9_-])`, 'g');
  const l = tasks.map(t => (t.description && r.test(t.description) ? (n++, { ...t, description: t.description.replace(r, `$1${neu}`) }) : t));
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
  await updateJson<{ kontakte: Kontakt[] }>('kontakte', cur => {
    const f = cur ?? { kontakte: [] };
    kontakt = f.kontakte.find(k => k.id === id);
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

  const vorher = await ladeCrm();
  if (enthaeltKennung(vorher, id)) { await aendereCrm(c => crmOhne(c, id)); zaehle(b, 'crm', 1); }

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
 * (nie Inhalte), Head-Vorschläge nur mit Titel/Status, Aufgaben nur eindeutig zugeordnete (s. `aufgabenZuordnen`).
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
  const aufgaben = aufgabenZuordnen(tasks, id, headAufgaben, null).eindeutig.map(t => ({ id: t.id, titel: t.title, status: t.status, ...(t.dueDate ? { faellig: t.dueDate } : {}) }));
  // Import-Läufe (K2): in wie vielen Läufen ein Vorher-Stand der Person liegt (Inhalt = frühere Fassung derselben Stammdaten).
  let importLaeufe = 0;
  for (const h of await laufHaushalte()) importLaeufe += ((await loadJson<LaufBestand>(laufName(h)))?.laeufe ?? []).filter(l => laufOhne(l, id).n > 0).length;
  return { ...personVerweise(crm, id), dateien, importKonflikte, headVorschlaege, headReplayFaelle, kommenderTermin, aufgaben, importLaeufe };
}
