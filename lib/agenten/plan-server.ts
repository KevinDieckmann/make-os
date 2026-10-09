// ─── Agenten-Bereich: geplante und wiederkehrende Hintergrundaufgaben je Person (09.10., Paket 3; AGENTEN_KONZEPT.md C11 Entscheidung 2) ─
// Entscheidung 08.10. (Antworten 6/8): „+ Hintergrundaufgabe (jetzt/geplant/wiederkehrend)“ · „Kostengrenze je Aufgabe“. „Jetzt“ legt direkt
// einen Thread an (POST /api/agenten/faden, Paket 1); „geplant“ und „wiederkehrend“ stehen hier im Bestand `agenten-plan--<person>` —
// der Takt reiht sie zur Zeit ein (lib/agenten/zeitplan.ts, dieselbe Regel wie „Als Nächstes“).
//   • Nur die Person selbst (Bestand je Person; Route `eigenePerson`), nur Agenten, die sie sehen darf (Head sichtbar, Mitarbeiter des Heads).
//   • Einzeländerungen mit Stand (409), Grenzen 413 (`GRENZEN.planAufgabenJePerson`, `auftragZeichen`), Änderungsprotokoll ohne Werte.
//   • Kostenschätzung vor großen Aufträgen: über `GROSS_AB_CENT` je Lauf nur mit `kostenBestaetigt` (409 mit Schätzung, Antwort 16).
// Offen (Fragerunde 8 „geplante Läufe in einem gemeinsamen Raum“): Business-Pläne für den ganzen Haushalt sichtbar — heute je Person
// (Vertrag Paket 0); das Teilen wäre eine Vertragsänderung.

import { headDef } from './katalog';
import { GRENZEN, planBestand, werkstattBestandFuer, type AgentRef, type Hintergrundaufgabe, type ModelTier, type PlanBestand } from './typen';
import { zeitplanPruefen, zeitplanText, regelVon } from './zeitplan';
import { mitarbeiterListe, standVon, textFeld, WERKSTATT_GRENZEN } from './skills';
import { headSichtbar, umfangFuer, werkstattLaden, type Ergebnis, type Fehler } from './skills-server';
import { kostenSchaetzen, gemesseneKosten, GROSS_AB_CENT, type KostenSchaetzung } from './leistung';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { protokolliere } from '@/lib/store/aenderungsprotokoll';
import { wandzeit } from '@/lib/kalender/zeit';

const fehler = (status: Fehler['status'], text: string, extra: Record<string, unknown> = {}): Fehler => ({ ok: false, status, fehler: text, ...extra });
const leer = (): PlanBestand => ({ v: 1, aufgaben: [] });

/** Den Plan der Person lesen (mit Stand je Aufgabe). */
export async function planLesen(person: string): Promise<{ aufgaben: Hintergrundaufgabe[]; staende: Record<string, string> }> {
  const p = await loadJson<PlanBestand>(planBestand(person));
  const aufgaben = (Array.isArray(p?.aufgaben) ? p!.aufgaben : []).filter(a => a.besitzer === person);
  return { aufgaben, staende: Object.fromEntries(aufgaben.map(a => [a.id, standVon(a)])) };
}

/**
 * Grund, warum eine Hintergrundaufgabe nicht bei ZOE liegen kann (Feinschliff 09.10.): ein ZOE-Thread läuft nicht im Hintergrund — ZOE antwortet im
 * Gespräch und beauftragt dort einen Head (`an_head`). Vorher ließ sich so eine Aufgabe planen und lief dann nie (der Lauf lehnte mit 409 ab).
 */
export const ZOE_NICHT_GEPLANT = 'Eine Hintergrundaufgabe läuft bei einem Head oder einem seiner Mitarbeiter — ZOE arbeitet im Gespräch (dort kann sie die Aufgabe an einen Head geben). Bitte einen Head wählen.';

/** Der Agent einer Aufgabe: ein sichtbarer Head oder ein Mitarbeiter dieses Heads — mit der Modellstufe für die Schätzung. ZOE → 400. */
async function agentPruefen(person: string, roh: unknown): Promise<Ergebnis<{ agent: AgentRef; stufe: ModelTier; headId: string | null }>> {
  if (!roh || typeof roh !== 'object') return fehler(400, 'Wer soll es tun? Ein Head oder ein Mitarbeiter.');
  const a = roh as Record<string, unknown>;
  if (a.art === 'zoe') return fehler(400, ZOE_NICHT_GEPLANT);
  if ((a.art !== 'head' && a.art !== 'mitarbeiter') || typeof a.headId !== 'string') return fehler(400, 'Wer soll es tun? Ein Head oder ein Mitarbeiter.');
  const head = headDef(a.headId);
  if (!head) return fehler(404, 'Diesen Head gibt es nicht.');
  if (!(await headSichtbar(person, head.id))) return fehler(403, 'Diesen Head siehst du nicht.');
  if (a.art === 'head') return { ok: true, agent: { art: 'head', headId: head.id }, stufe: head.stufe, headId: head.id };
  if (typeof a.mitarbeiterId !== 'string') return fehler(400, 'Mitarbeiter fehlt.');
  const name = werkstattBestandFuer(head.ebene, await umfangFuer(person));
  const ma = mitarbeiterListe(head.id, name ? (await werkstattLaden(name)).mitarbeiter : []).find(m => m.id === a.mitarbeiterId);
  if (!ma) return fehler(404, 'Diesen Mitarbeiter hat der Head nicht.');
  if (!ma.aktiv) return fehler(409, 'Dieser Mitarbeiter ist aus.');
  return { ok: true, agent: { art: 'mitarbeiter', headId: head.id, mitarbeiterId: ma.id }, stufe: ma.stufe, headId: head.id };
}

type Inhalt = Pick<Hintergrundaufgabe, 'agent' | 'titel' | 'auftrag' | 'zeitplan' | 'aktiv'> & { kostenGrenzeCent?: number };

/** Inhalt prüfen (Agent, Titel, Auftrag, Zeitplan, Kostengrenze). */
async function inhaltPruefen(person: string, roh: Record<string, unknown>, jetztWand: string): Promise<Ergebnis<{ inhalt: Inhalt; stufe: ModelTier; headId: string | null }>> {
  const ag = await agentPruefen(person, roh.agent);
  if (!ag.ok) return ag;
  const titel = textFeld(roh.titel, 120, 'Titel'); if (!titel.ok) return fehler(titel.status, titel.fehler);
  if (titel.wert.includes('\n')) return fehler(400, 'Titel in einer Zeile.');
  const auftrag = textFeld(roh.auftrag, GRENZEN.auftragZeichen, 'Auftrag (Ziel, Format, Grenzen, Quellen)'); if (!auftrag.ok) return fehler(auftrag.status, auftrag.fehler);
  const z = zeitplanPruefen(roh.zeitplan, jetztWand); if (!z.ok) return fehler(z.status, z.fehler);
  let kostenGrenzeCent: number | undefined;
  if (roh.kostenGrenzeCent !== undefined && roh.kostenGrenzeCent !== null) {
    if (!Number.isInteger(roh.kostenGrenzeCent) || (roh.kostenGrenzeCent as number) < 1) return fehler(400, 'Kostengrenze je Lauf in ganzen Cent.');
    if ((roh.kostenGrenzeCent as number) > WERKSTATT_GRENZEN.kostenGrenzeMaxCent) return fehler(413, `Kostengrenze je Lauf höchstens ${WERKSTATT_GRENZEN.kostenGrenzeMaxCent / 100} €.`);
    kostenGrenzeCent = roh.kostenGrenzeCent as number;
  }
  if (roh.aktiv !== undefined && typeof roh.aktiv !== 'boolean') return fehler(400, 'Aktiv: ja oder nein.');
  return { ok: true, stufe: ag.stufe, headId: ag.headId, inhalt: { agent: ag.agent, titel: titel.wert, auftrag: auftrag.wert, zeitplan: z.wert, aktiv: roh.aktiv !== false, ...(kostenGrenzeCent ? { kostenGrenzeCent } : {}) } };
}

/** Schätzung je Lauf + ob sie bestätigt werden muss (409) und ob die Grenze darunter liegt (Hinweis). */
async function schaetzungPruefen(person: string, stufe: ModelTier, headId: string | null, kostenGrenzeCent: number | undefined, bestaetigt: boolean): Promise<{ schaetzung: KostenSchaetzung; fehler?: Fehler; hinweis?: string }> {
  const schaetzung = kostenSchaetzen({ stufe, art: 'lauf', gemessenCent: headId ? await gemesseneKosten(person, headId) : [] });
  const hinweis = kostenGrenzeCent && kostenGrenzeCent < schaetzung.cent ? `Die Kostengrenze liegt unter der Schätzung — der Lauf hält dann vorher an.` : undefined;
  if (schaetzung.cent > GROSS_AB_CENT && !bestaetigt) return { schaetzung, fehler: fehler(409, `Jeder Lauf kostet ${schaetzung.text} — bitte bestätigen.`, { kostenBestaetigen: true, schaetzung, ...(hinweis ? { hinweis } : {}) }) };
  return { schaetzung, ...(hinweis ? { hinweis } : {}) };
}

class Abbruch { constructor(readonly raus: unknown) {} }
async function imPlan<T>(person: string, fn: (p: PlanBestand, halt: (raus: T) => never) => { neu: PlanBestand; raus: T }): Promise<T> {
  let raus!: T;
  try {
    await updateJson<PlanBestand>(planBestand(person), cur => {
      const p: PlanBestand = { v: 1, aufgaben: Array.isArray(cur?.aufgaben) ? cur!.aufgaben : [] };
      const r = fn(p, x => { throw new Abbruch(x); });
      raus = r.raus;
      return r.neu;
    });
  } catch (e) { if (e instanceof Abbruch) return e.raus as T; throw e; }
  return raus;
}

export type PlanErgebnis = Ergebnis<{ aufgabe: Hintergrundaufgabe; stand: string; schaetzung: KostenSchaetzung; zeitplan: string; hinweis?: string }>;

/** „+ Hintergrundaufgabe“ geplant/wiederkehrend anlegen. */
export async function planen(person: string, roh: unknown, opt: { kostenBestaetigt?: boolean } = {}): Promise<PlanErgebnis> {
  if (!roh || typeof roh !== 'object') return fehler(400, 'Aufgabe fehlt.');
  const p = await inhaltPruefen(person, roh as Record<string, unknown>, wandzeit(new Date()));
  if (!p.ok) return p;
  const k = await schaetzungPruefen(person, p.stufe, p.headId, p.inhalt.kostenGrenzeCent, !!opt.kostenBestaetigt);
  if (k.fehler) return k.fehler;
  const aufgabe: Hintergrundaufgabe = { id: neueKennung('hg'), besitzer: person, ...p.inhalt, erstellt: new Date().toISOString() };
  const raus = await imPlan<PlanErgebnis>(person, (plan, halt) => {
    if (plan.aufgaben.length >= GRENZEN.planAufgabenJePerson) halt(fehler(413, `Höchstens ${GRENZEN.planAufgabenJePerson} geplante Aufgaben je Person — bitte erst alte löschen.`));
    return { neu: { ...plan, aufgaben: [...plan.aufgaben, aufgabe] }, raus: { ok: true, aufgabe, stand: standVon(aufgabe), schaetzung: k.schaetzung, zeitplan: zeitplanText(regelVon(aufgabe.zeitplan)!), ...(k.hinweis ? { hinweis: k.hinweis } : {}) } };
  });
  if (raus.ok) await protokolliere(planBestand(person), [{ liste: 'aufgaben', op: 'neu', id: aufgabe.id }], { art: 'person', person }).catch(() => {});
  return raus;
}

const FELDER = ['agent', 'titel', 'auftrag', 'zeitplan', 'kostenGrenzeCent', 'aktiv'] as const;

/** Ändern (mit Stand). */
export async function planAendern(person: string, id: unknown, teil: unknown, stand: unknown, opt: { kostenBestaetigt?: boolean } = {}): Promise<PlanErgebnis> {
  if (typeof id !== 'string' || !id) return fehler(400, 'Kennung fehlt.');
  if (!teil || typeof teil !== 'object') return fehler(400, 'Änderung fehlt.');
  const alt = (await planLesen(person)).aufgaben.find(a => a.id === id);
  if (!alt) return fehler(404, 'Aufgabe nicht gefunden.');
  const roh: Record<string, unknown> = { agent: alt.agent, titel: alt.titel, auftrag: alt.auftrag, zeitplan: alt.zeitplan, kostenGrenzeCent: alt.kostenGrenzeCent, aktiv: alt.aktiv };
  for (const f of FELDER) if (f in (teil as Record<string, unknown>)) roh[f] = (teil as Record<string, unknown>)[f];
  // Ein einmaliger Zeitpunkt, der nicht geändert wird, darf inzwischen vergangen sein (z. B. nur „aus“ schalten).
  const zeitNeu = 'zeitplan' in (teil as Record<string, unknown>);
  const p = await inhaltPruefen(person, roh, zeitNeu ? wandzeit(new Date()) : '0000-01-01T00:00:00');
  if (!p.ok) return p;
  const geaendert = FELDER.filter(f => JSON.stringify((p.inhalt as Record<string, unknown>)[f] ?? null) !== JSON.stringify((alt as unknown as Record<string, unknown>)[f] ?? null));
  const k = await schaetzungPruefen(person, p.stufe, p.headId, p.inhalt.kostenGrenzeCent, !!opt.kostenBestaetigt || !geaendert.some(f => f === 'agent' || f === 'kostenGrenzeCent'));
  if (k.fehler) return k.fehler;
  const raus = await imPlan<PlanErgebnis>(person, (plan, halt) => {
    const cur = plan.aufgaben.find(a => a.id === id);
    if (!cur) halt(fehler(404, 'Aufgabe nicht gefunden.'));
    if (stand !== standVon(cur)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, aufgabe: cur, stand: standVon(cur) }));
    const neu: Hintergrundaufgabe = { ...cur!, ...p.inhalt };
    if (!p.inhalt.kostenGrenzeCent) delete neu.kostenGrenzeCent;
    if (!geaendert.length) halt({ ok: true, aufgabe: cur!, stand: standVon(cur), schaetzung: k.schaetzung, zeitplan: zeitplanText(regelVon(cur!.zeitplan)!) });
    return { neu: { ...plan, aufgaben: plan.aufgaben.map(a => (a.id === id ? neu : a)) }, raus: { ok: true, aufgabe: neu, stand: standVon(neu), schaetzung: k.schaetzung, zeitplan: zeitplanText(regelVon(neu.zeitplan)!), ...(k.hinweis ? { hinweis: k.hinweis } : {}) } };
  });
  if (raus.ok && geaendert.length) await protokolliere(planBestand(person), [{ liste: 'aufgaben', op: 'geaendert', id, felder: [...geaendert] }], { art: 'person', person }).catch(() => {});
  return raus;
}

/** Löschen (mit Stand). */
export async function planLoeschen(person: string, id: unknown, stand: unknown): Promise<Ergebnis<{ id: string }>> {
  if (typeof id !== 'string' || !id) return fehler(400, 'Kennung fehlt.');
  if ((await loadJson<PlanBestand>(planBestand(person))) === null) return { ok: true, id };
  const raus = await imPlan<Ergebnis<{ id: string }>>(person, (plan, halt) => {
    const cur = plan.aufgaben.find(a => a.id === id);
    if (!cur) halt({ ok: true, id });
    if (stand !== standVon(cur)) halt(fehler(409, 'Inzwischen geändert — bitte neu laden.', { konflikt: true, aufgabe: cur, stand: standVon(cur) }));
    return { neu: { ...plan, aufgaben: plan.aufgaben.filter(a => a.id !== id) }, raus: { ok: true, id } };
  });
  if (raus.ok) await protokolliere(planBestand(person), [{ liste: 'aufgaben', op: 'geloescht', id }], { art: 'person', person }).catch(() => {});
  return raus;
}

/**
 * Schnittstelle für Paket 1 (Lauf-Route): den Start eines Plan-Laufs vermerken (`letzterLauf`); eine EINMALIGE Aufgabe ist danach aus
 * (sie lief). Idempotent; ohne Aufgabe nichts.
 */
export async function planLaufVermerken(person: string, planId: string, zeit: string = new Date().toISOString()): Promise<boolean> {
  if ((await loadJson<PlanBestand>(planBestand(person))) === null) return false;
  return imPlan<boolean>(person, (plan, halt) => {
    const cur = plan.aufgaben.find(a => a.id === planId);
    if (!cur) halt(false);
    const neu: Hintergrundaufgabe = { ...cur!, letzterLauf: zeit, ...(cur!.zeitplan.art === 'einmalig' ? { aktiv: false } : {}) };
    if (JSON.stringify(neu) === JSON.stringify(cur)) halt(true);
    return { neu: { ...plan, aufgaben: plan.aufgaben.map(a => (a.id === planId ? neu : a)) }, raus: true };
  });
}

/** Für den leeren Erststart (Tests, Demo-Saat). */
export const leererPlan = leer;
