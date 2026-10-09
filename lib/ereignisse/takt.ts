// ─── Ereignisse im Takt — Konsumenten laden, auswerten, einreihen (09.10., E1 „Ereignisstelle“; nur Server) ──────────────────
// Wo der Takt fällige Zeitpläne einreiht (lib/zoe/takt.ts `faelligOhnePause`), steht EINE Zeile: `ereignisseFaellig(jetzt)`. Sie liest
// den Bestand `ereignisse--<haushalt>` mit dem Cursor je Konsument und liefert Aufträge für die EINE Warteschlange — kein zweiter
// Hintergrund-Mechanismus:
//   · Skill mit Auslöser „Ereignis“ → Auftrag `faden` mit `{ art: 'skill', ausloeser: 'ereignis', ereignisId, eingaben }` (Kennungen des
//     Bezugs als Eingaben — der Agent holt Inhalte über seine Werkzeuge, nie aus dem Ereignis).
//   · „An ZOE geben“ → Auftrag `zoe-aufgaben` mit der Auftraggeberin (sofort statt am nächsten Morgen).
// Dieselben Sperren wie Zeitpläne (lib/agenten/zeitplan.ts): Nachtruhe 7–22 Uhr, Business-frei (Business-Heads bzw. Business-Aufgaben),
// Hintergrund-KI der Instanz und der Person, Tageshöchstzahl je Head, Instanz-Budget, Not-Aus (für alle bzw. des Heads), Head aus — dazu
// fail-closed: Sperre nicht lesbar = warten. Danach filtert der Takt wie jeden Lauf (`sperrenFiltern`: KI-Läufe, Head-Budget, Fehlerpause).
// Entprellen: höchstens ein Lauf je Konsument und Bezug und Stunde (das jüngste Ereignis trägt die älteren mit). Sichtregel: Mail nur für die
// Person des Postfachs, Privat nur volle Mitglieder (lib/ereignisse/typen.ts `ereignisSichtbar`).
// Lesen schreibt nie: den Cursor setzt `ereignisCursorNachziehen` (POST des Takts, vor dem Einreihen) — ein Ereignis gilt erst als erledigt,
// wenn sein Auftrag in der Warteschlange steht (Riegel), also nie verloren, wenn GET nur vorausschaut.

import { headDef } from '@/lib/agenten/katalog';
import type { AgentenEinstellung, LaufAuftrag, Skill, WerkstattBestand } from '@/lib/agenten/typen';
import { einstellungBestand, skillsHaushaltBestand, skillsPersonBestand, LAUF_AGENT } from '@/lib/agenten/typen';
import { AUTO_LAEUFE_JE_TAG, autoLaeufeHeute, laufPersonFuerSkill, taktOffen, ZOE_SCHLUESSEL } from '@/lib/agenten/zeitplan';
import type { Spanne } from '@/lib/arbeitsrahmen/regel';
import { tagPlus, tagVon, wandzeit } from '@/lib/kalender/zeit';
import type { Faellig } from '@/lib/zoe/takt';
import { EREIGNIS_NAME, SKILL_EREIGNISSE } from './arten';
import { auswerten, type AuswertungsLage, type Auswertung, type EreignisBestand, type FaelligesEreignis, type Konsument, type BezugFeld } from './typen';
import { betrachterFuer, cursorSchreiben, ereignisHaushalt, ereignisseLaden } from './server';

const PERSON = /^[a-z0-9-]{1,40}$/;
export const ZOE_KONSUMENT = 'zoe-aufgaben';
export const EREIGNIS_ANLASS = 'Takt: Agenten-Ereignis';
export const ZOE_ANLASS = 'Takt: An ZOE gegeben';

/** Eingaben eines Skill-Laufs aus dem Ereignis (nur Kennungen; Schlüssel wie Eingabe-Felder, höchstens 12 — die Lauf-Route prüft). Rein. */
const EINGABE_FELD: Readonly<Record<BezugFeld, string>> = {
  kontaktId: 'kontakt', firmaId: 'firma', dealId: 'deal', mandatId: 'mandat', rechnungId: 'rechnung', buchungId: 'buchung', kontoId: 'konto',
  aufgabeId: 'aufgabe', terminUid: 'termin', gespraech: 'gespraech', followupId: 'followup',
};
export function laufEingaben(f: Pick<FaelligesEreignis, 'ereignis' | 'konsument'>): Record<string, string> {
  const e = f.ereignis;
  const raus: [string, string][] = [['ereignis', EREIGNIS_NAME[e.art]], ['kennung', e.id]];
  for (const [feld, name] of Object.entries(EINGABE_FELD) as [BezugFeld, string][]) if (e.bezug[feld]) raus.push([name, e.bezug[feld]!]);
  if (e.stufe) raus.push(['stufe', e.stufe]);
  if (f.konsument.filter) raus.push(['bedingung', f.konsument.filter.slice(0, 2_000)]);
  // Höchstens 12 Eingaben (Lauf-Route): die Bedingung zuletzt, davor die Kennungen in der Reihenfolge oben.
  return Object.fromEntries(raus.length > 12 ? [...raus.slice(0, 11), raus[raus.length - 1]] : raus);
}

/** Aus fälligen Ereignissen Takt-Aufträge machen (rein). Titel/Inhalte nie im Grund — die Takt-Vorschau sieht der Haushalt. */
export function alsAuftraege(faellig: readonly FaelligesEreignis[]): Faellig[] {
  return faellig.map(f => {
    const k = f.konsument, e = f.ereignis;
    if (k.art === 'zoe-aufgaben') {
      return {
        id: `ereignis-zoe-${e.nr}`, grund: `ZOE: ${EREIGNIS_NAME[e.art]} — Vorschläge vorbereiten`,
        auftrag: { art: 'agent' as const, name: 'zoe-aufgaben', eingabe: { ereignisId: e.id, bezugSchluessel: f.bezugSchluessel }, person: f.person, anlass: ZOE_ANLASS },
      };
    }
    const lauf: LaufAuftrag = { art: 'skill', skillId: k.skillId!, headId: k.headId, ausloeser: 'ereignis', ereignisId: e.id, eingaben: laufEingaben(f) };
    const eingabe = { ...lauf, bezugSchluessel: f.bezugSchluessel, ...(k.stufe === 'stark' ? { batch: true as const } : {}) };
    return {
      id: `ereignis-skill-${k.skillId}-${e.nr}`, grund: `Agenten: Skill bei Ereignis (${EREIGNIS_NAME[e.art]})`,
      auftrag: { art: 'agent' as const, name: LAUF_AGENT, auftrag: JSON.stringify(eingabe), eingabe: eingabe as unknown as Record<string, unknown>, person: f.person, anlass: EREIGNIS_ANLASS },
    };
  });
}

// ── Konsumenten laden ────────────────────────────────────────────────────────────────────────────────────────────────────

interface Geladen {
  haushalt: string;
  bestand: EreignisBestand;
  konsumenten: Konsument[];
  /** Instanz-Zustand aus Not-Aus/Budget/Hintergrund-KI/Lesbarkeit. */
  instanz: AuswertungsLage['instanz'];
  personen: string[];
}

/** Ein Skill mit Auslöser „Ereignis“ → Konsument (auch ein ausgeschalteter: dann ruht er, und seine Ereignisse verfallen). */
async function skillKonsument(s: Skill, person: string | null, einst: AgentenEinstellung | null, ebene: 'haushalt' | 'person'): Promise<Konsument | null> {
  if (s.ausloeser.art !== 'ereignis') return null;
  const h = headDef(s.headId);
  if (!h || h.ebene !== ebene) return null;
  const arten = SKILL_EREIGNISSE.includes(s.ausloeser.ereignis) ? [s.ausloeser.ereignis] : [];
  const basis = { schluessel: `skill:${s.id}`, art: 'skill' as const, arten, headId: h.id, headBereich: h.bereich, person, skillId: s.id, ...(s.geaendertAm ? { seit: s.geaendertAm } : {}), stufe: s.stufe };
  // Aus bzw. ohne Lauf-Person: ruht (ohne die Sicht zu laden — der Takt fragt jede Minute).
  if (!s.aktiv || !person) return { ...basis, betrachter: null, ruht: true };
  const { headEinstellungVon } = await import('@/lib/agenten/einstellung');
  const e = einst ? headEinstellungVon(einst, h, person) : null;
  // Fail-closed: ist die Sicht nicht prüfbar, wirft es — die ganze Auswertung entfällt (nichts eingereiht, kein Cursor), nichts verfällt.
  const { headSichtbar } = await import('@/lib/agenten/skills-server');
  const sichtbar = await headSichtbar(person, h.id);
  const ruht = !sichtbar || e?.aktiv === false || !!e?.notAus;
  return {
    ...basis, betrachter: await betrachterFuer(person, { streng: true }),
    ...(ruht ? { ruht: true } : {}), ...(s.ausloeser.filter ? { filter: s.ausloeser.filter } : {}),
  };
}

/** Alle Konsumenten der Instanz (Werkstatt des Haushalts, je Person) + der ZOE-Aufgaben-Lauf. Wie `kandidatenLaden` (lib/agenten/zeitplan.ts). */
async function laden(): Promise<Geladen | null> {
  const { loadJson } = await import('@/lib/store/local-db');
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const { haushaltDerInhaber, kontenImHaushaltDerInhaber } = await import('@/lib/zugang/inhaber');
  const st = await ladeKonten();
  const inhaberHaushalt = haushaltDerInhaber(st);
  const personen = kontenImHaushaltDerInhaber(st).map(k => k.speicher).filter(p => PERSON.test(p));
  const personSet = new Set(personen);
  const haushalt = await ereignisHaushalt();
  const bestand = await ereignisseLaden(haushalt);
  // Nichts im Bestand → nichts zu laden (der Takt fragt jede Minute).
  if (!bestand.eintraege.length) return null;
  // Instanz: Lesbarkeit zuerst (fail-closed), dann Not-Aus für alle, Instanz-Budget, Hintergrund-KI der Instanz.
  let instanz: AuswertungsLage['instanz'] = 'frei';
  let einst: AgentenEinstellung | null = null;
  const { agentenEinstellungLesbar } = await import('@/lib/agenten/einstellung');
  if (!(await agentenEinstellungLesbar().catch(() => false))) instanz = 'unlesbar';
  else if (inhaberHaushalt) {
    try { const roh = await loadJson<AgentenEinstellung>(einstellungBestand(inhaberHaushalt)); einst = roh ? { ...roh, heads: roh.heads ?? {} } : null; }
    catch { instanz = 'unlesbar'; }
  }
  if (instanz === 'frei' && einst?.notAus) instanz = 'aus';
  if (instanz === 'frei' && await import('@/lib/ki/tor').then(m => m.budgetSperre())) instanz = 'aus';
  if (instanz === 'frei' && !(await import('@/lib/datenschutz/ki-einstellungen').then(m => m.kiSchalterFuer(null))).hintergrund) instanz = 'aus';

  // Fail-closed (wie der Takt): ein nicht lesbarer Bestand wirft — die Auswertung entfällt, der Cursor bleibt, kein Ereignis verfällt deshalb.
  const konsumenten: Konsument[] = [];
  if (inhaberHaushalt) {
    const w = await loadJson<WerkstattBestand>(skillsHaushaltBestand(inhaberHaushalt));
    for (const s of w?.skills ?? []) { const k = await skillKonsument(s, laufPersonFuerSkill(s, personSet), einst, 'haushalt'); if (k) konsumenten.push(k); }
  }
  for (const p of personen) {
    const w = await loadJson<WerkstattBestand>(skillsPersonBestand(p));
    for (const s of w?.skills ?? []) { const k = await skillKonsument(s, p, einst, 'person'); if (k) konsumenten.push(k); }
  }
  konsumenten.push({ schluessel: ZOE_KONSUMENT, art: 'zoe-aufgaben', arten: ['aufgabe-zoe'], headId: ZOE_SCHLUESSEL, headBereich: null, person: null, betrachter: null });
  return { haushalt, bestand, konsumenten, instanz, personen };
}

/** Die Lage für die Auswertung: Warteschlange, Business-frei, Hintergrund-KI je Person, offene ZOE-Aufgaben (nur bei Bedarf geladen). */
async function lageLaden(g: Geladen, jetzt: Date): Promise<AuswertungsLage> {
  const { lies } = await import('@/lib/zoe/auftraege');
  const { kiSchalterFuer } = await import('@/lib/datenschutz/ki-einstellungen');
  const { businessFreiFensterFuer } = await import('@/lib/arbeitsrahmen/server');
  const jetztWand = wandzeit(jetzt), heute = tagVon(jetztWand);
  // Fail-closed: Warteschlange (der Riegel), Business-frei und KI-Schalter je Person nicht lesbar → wirft (nichts eingereiht, kein Cursor).
  const auftraege = await lies();
  const frei = new Map<string, readonly Spanne[]>();
  const kiJe = new Map<string, boolean>();
  for (const p of g.personen) {
    frei.set(p, await businessFreiFensterFuer(p, tagPlus(heute, -1), tagPlus(heute, 1)));
    kiJe.set(p, !!(await kiSchalterFuer(p)).hintergrund);
  }
  // Offene ZOE-Aufgaben nur laden, wenn ein „An ZOE gegeben“ nach dem Cursor liegt.
  const ab = g.bestand.cursor[ZOE_KONSUMENT]?.nr ?? 0;
  let zoeOffen = new Map<string, { business: boolean }>();
  if (g.bestand.eintraege.some(e => e.art === 'aufgabe-zoe' && e.nr > ab)) {
    const [{ ladeAufgabenUngefiltert }, { zoeZuBearbeiten }, { spaceVonAufgabe }] = await Promise.all([import('@/lib/aufgaben/speicher'), import('@/lib/aufgaben/zoe'), import('@/lib/make-one/space-regeln')]);
    const st = await ladeAufgabenUngefiltert();
    zoeOffen = new Map(zoeZuBearbeiten(st.tasks, { person: null, jetzt: jetzt.toISOString() }).map(t => [t.id, { business: spaceVonAufgabe(t) === 'business' }]));
  }
  return {
    jetzt, jetztWand, heute, auftraege, instanz: g.instanz,
    kiPerson: p => kiJe.get(p) ?? false,
    frei: p => frei.get(p) ?? [],
    taktOffen, hoechstzahl: AUTO_LAEUFE_JE_TAG,
    autoLaeufeHeute: h => (h === ZOE_SCHLUESSEL
      ? auftraege.filter(a => a.name === 'zoe-aufgaben' && a.tag === heute && !!a.eingabe?.ereignisId).length
      : autoLaeufeHeute(h, heute, auftraege)),
    zoeAufgabe: id => zoeOffen.get(id) ?? null,
  };
}

/** Laden + auswerten (eine Stelle für Takt, „sofort“ und Cursor). null = nichts zu tun bzw. nicht lesbar. */
async function auswertung(jetzt: Date): Promise<{ g: Geladen; a: Auswertung } | null> {
  const g = await laden();
  if (!g) return null;
  const lage = await lageLaden(g, jetzt);
  return { g, a: auswerten(g.bestand, g.konsumenten, lage) };
}

/**
 * Die EINE Zeile im Takt (lib/zoe/takt.ts): fällige Ereignis-Läufe als Aufträge. Liest nur. Fehler → nichts (der Takt läuft weiter).
 */
export async function ereignisseFaellig(jetzt: Date = new Date()): Promise<Faellig[]> {
  try {
    const r = await auswertung(jetzt);
    return r ? alsAuftraege(r.a.faellig) : [];
  } catch (err) {
    console.error('[ereignisse] Takt übersprungen:', err instanceof Error ? err.message.slice(0, 200) : err);
    return [];
  }
}

/**
 * Cursor nachziehen (POST des Takts, vor dem Einreihen): je Konsument bis vor das erste Ereignis, das noch wartet oder fällig ist —
 * eingereihte zählen erst als erledigt, wenn ihr Auftrag in der Warteschlange steht. Dazu das Lagebild (nur Zahlen). Wirft nie.
 */
export async function ereignisCursorNachziehen(jetzt: Date = new Date()): Promise<void> {
  try {
    const r = await auswertung(jetzt);
    if (!r) return;
    await cursorSchreiben(r.g.haushalt, r.a.cursor, new Set(r.g.konsumenten.map(k => k.schluessel)), { am: jetzt.toISOString(), wartend: r.a.wartend, gestaut: r.a.gestaut, faellig: r.a.faellig.length });
  } catch (err) {
    console.error('[ereignisse] Cursor nicht nachgezogen:', err instanceof Error ? err.message.slice(0, 200) : err);
  }
}

/**
 * Sofort (nicht erst zum nächsten Takt): fällige Ereignis-Läufe durch DIESELBEN Filter wie jeder Takt-Lauf (`sperrenFiltern`) und einreihen.
 * Für „An ZOE geben“ — der Arbeiter holt den Auftrag binnen Sekunden. Wirft nie; liefert die Zahl der neu eingereihten.
 */
export async function ereignisseAnstossen(jetzt: Date = new Date()): Promise<number> {
  try {
    const roh = await ereignisseFaellig(jetzt);
    if (!roh.length) return 0;
    const [{ sperrenFiltern }, { reihe }] = await Promise.all([import('@/lib/zoe/takt'), import('@/lib/zoe/auftraege')]);
    const dran = await sperrenFiltern(roh, jetzt);
    if (!dran.length) return 0;
    return (await reihe(dran.map(f => f.auftrag), jetzt)).angelegt.length;
  } catch (err) {
    console.error('[ereignisse] Anstoß fehlgeschlagen:', err instanceof Error ? err.message.slice(0, 200) : err);
    return 0;
  }
}
