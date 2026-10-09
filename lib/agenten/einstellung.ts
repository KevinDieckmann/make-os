// ─── Agenten-Bereich: Einstellungen je Head, Not-Aus, Budget je Head (09.10., Paket 4b; AGENTEN_KONZEPT.md C11 Entscheidung 10) ─
// Antworten des Inhabers (ENTSCHEIDUNGEN_FRAGEBOGEN.md › Agenten-Bereich 12/14, Fragerunde Teil 1 Nr. 6/15/16): Modell und Aufwand je Head ·
// Budget je Head und Monat · Autonomie (nur verschärfen) · zuständige Person aus den Konten (nie ein Name im Code) · Not-Aus je Head und
// für alle · Business-frei gilt für alle Agenten.
//
// EINE Stelle für Lesen-mit-Person, Rechte, Prüfen und Schreiben des Bestands `agenten-einstellung--<haushalt>` (Paket 3 schreibt dort schon
// die Autonomie — dieselbe Stelle, kein zweiter Bestand). Die Privat-Heads der Ebene Person liegen je Person unter `personen[<speicher>]`
// und gehen NUR an diese Person (serverseitig — `mitPerson`). Rechte (Plattform-Regel „Trennung serverseitig“):
//   • Einstellungen eines Haushalts-Heads (Business, Familie) ändern nur volle Mitglieder, die den Head sehen;
//   • Einstellungen eines Privat-Heads (Ebene Person) nur die Person selbst — in ihrem eigenen Abschnitt;
//   • Not-Aus je Head darf jede Person, die den Head sieht (ein Business-Partner also nur Business-Heads) — eine Bremse;
//     Not-Aus für ALLE setzen und lösen nur volle Mitglieder;
//   • Dienstweg nie (die Route lehnt vorher ab).
// Wirkung des Not-Aus (Lauf UND Takt): der Takt reiht nichts ein (`taktFiltern` in lib/zoe/takt.ts), der Arbeiter führt nichts aus
// (`auftragGesperrt` in app/api/zoe/auftraege/lauf), die Thread-Routen lehnen Senden/Lauf ab (`laufSperre`), laufende Threads werden
// angehalten (`laeufeAnhalten`: Status „abgebrochen“, offene Aufträge raus). Budget je Head: ab 80 % eine Glocke, ab 100 % pausiert der
// Head (Chat, Lauf, Takt) bis zum Monatsende — eine Glocke je Stufe und Monat. Oben rein (Server UND Browser), unten der Server-Teil.

import { headDef, KATALOG } from './katalog';
import {
  EINSTELLUNG_FELDER, einstellungBestand, type AgentenEinstellung, type Aufwand, type AutonomieStufe, type EinstellungFeld, type Faden,
  type HeadDef, type HeadEinstellung, type HeadEinstellungSicht, type HeadGesperrt, type ModelTier,
} from './typen';
import type { KontoSicht } from './sicht';

export const GELOESCHT = '[gelöscht]';
const PERSON = /^[a-z0-9-]{1,40}$/;
const MEDIUM = /^md-[0-9a-f-]{36}$/;
const STUFEN: readonly ModelTier[] = ['schnell', 'ausgewogen', 'stark'];
const AUFWAENDE: readonly Aufwand[] = ['low', 'medium', 'high'];
/** Monatsbudget je Head höchstens 100.000 € (Euro-Cent) — darüber 400 (wie das Instanz-Budget). */
export const HEAD_BUDGET_MAX_CENT = 10_000_000;
/** Ab diesem Anteil des Head-Budgets meldet sich die Glocke (einmal je Monat), bei 100 % pausiert der Head. */
export const HEAD_BUDGET_WARNUNG = 0.8;

export type Fehler = { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; [k: string]: unknown };
const fehler = (status: Fehler['status'], text: string, extra: Record<string, unknown> = {}): Fehler => ({ ok: false, status, fehler: text, ...extra });

// ── Lesen mit Person (rein) ────────────────────────────────────────────────────────────────────────────────────────────

/** Eine Sicht aus `mitPerson`: `heads` enthält schon den Abschnitt dieser Person (Lese-Modell, nie gespeichert). */
type Gelesen = AgentenEinstellung & { fuerPerson?: string | null };

/**
 * Die Einstellung EINES Heads für eine Person: Ebene Person → ihr eigener Abschnitt, sonst die des Haushalts. Nimmt den rohen Bestand
 * (mit `personen`) ebenso wie eine Sicht aus `mitPerson` (dort steht der Abschnitt schon in `heads` — aber nur für DIESE Person).
 */
export function headEinstellungVon(e: AgentenEinstellung, head: Pick<HeadDef, 'id' | 'ebene'>, person: string | null): HeadEinstellung {
  if (head.ebene !== 'person') return e.heads[head.id] ?? {};
  const g = e as Gelesen;
  if (g.fuerPerson !== undefined) return person && g.fuerPerson === person ? e.heads[head.id] ?? {} : {};
  return (person && e.personen?.[person]?.heads?.[head.id]) || {};
}

/**
 * Die Sicht einer Person auf den Bestand (rein): `heads` enthält für Privat-Heads der Ebene Person NUR ihren eigenen Abschnitt (ein Eintrag
 * im Haushalts-Teil gilt dort nicht — Privat-Heads gehören einer Person), `personen` fällt immer weg. Ohne Person: nur der Haushalts-Teil
 * ohne Privat-Heads. So kann kein Leser die Einstellungen einer anderen Person sehen.
 */
export function mitPerson(e: AgentenEinstellung, person: string | null | undefined): AgentenEinstellung {
  const { personen, ...rest } = e;
  const heads: AgentenEinstellung['heads'] = {};
  for (const [id, h] of Object.entries(e.heads ?? {})) if (headDef(id)?.ebene !== 'person' && h) heads[id] = h;
  const p = person && PERSON.test(person) ? person : null;
  const eigen = p ? personen?.[p]?.heads ?? {} : {};
  for (const [id, h] of Object.entries(eigen)) if (headDef(id)?.ebene === 'person' && h) heads[id] = h;
  const { fuerPerson: _f, ...ohneMarke } = rest as Gelesen;
  return { ...ohneMarke, heads, fuerPerson: p } as Gelesen;
}

/** Stand je Head (409) — ohne den Vermerk der Budget-Glocke (den schreibt der Server nebenbei). */
export function einstellungStand(e: HeadEinstellung | undefined | null): string {
  const { budgetGemeldet: _b, ...rest } = (e ?? {}) as HeadEinstellung & { budgetGemeldet?: unknown };
  const s = JSON.stringify(Object.keys(rest).sort().map(k => [k, (rest as Record<string, unknown>)[k]]));
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193) >>> 0; b = Math.imul(b ^ c ^ (i & 0xff), 0x01000193) >>> 0; }
  return `es-${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

// ── Sperre eines Heads (rein) ──────────────────────────────────────────────────────────────────────────────────────────

export interface Sperre { grund: Extract<HeadGesperrt, 'aus' | 'not-aus' | 'budget'>; text: string }

/**
 * Warum ein Head gerade nicht arbeitet (Chat, Lauf, Takt) — oder null. Reihenfolge: Not-Aus für alle, Not-Aus des Heads, ausgeschaltet,
 * Monatsbudget des Heads erreicht. `kostenCent` = Kosten des Heads in diesem Monat (Euro-Cent) — ohne Angabe zählt das Budget nicht.
 */
export function headSperre(e: AgentenEinstellung, head: Pick<HeadDef, 'id' | 'ebene' | 'name'>, person: string | null, kostenCent?: number): Sperre | null {
  if (e.notAus) return { grund: 'not-aus', text: 'Not-Aus ist gesetzt — die Agenten halten an.' };
  const h = headEinstellungVon(e, head, person);
  if (h.notAus) return { grund: 'not-aus', text: `Not-Aus für ${head.name} ist gesetzt — dieser Head hält an.` };
  if (h.aktiv === false) return { grund: 'aus', text: `${head.name} ist ausgeschaltet.` };
  if (typeof h.budgetCentMonat === 'number' && typeof kostenCent === 'number' && kostenCent >= h.budgetCentMonat) {
    return { grund: 'budget', text: `Das Monatsbudget von ${head.name} ist erreicht — der Head pausiert bis zum Monatsende (oder das Budget anheben).` };
  }
  return null;
}

// ── Rechte (rein, über die EINE Sicht aus lib/agenten/sicht.ts) ─────────────────────────────────────────────────────────

/** Darf diese Sicht die Einstellungen des Heads ändern? Haushalts-Heads: volle Mitglieder; Privat-Heads (Ebene Person): die Person selbst. */
export function einstellungDarf(s: KontoSicht, head: Pick<HeadDef, 'id' | 'ebene'>, sichtbar: boolean): boolean {
  if (!s.imHaushalt || !sichtbar) return false;
  return head.ebene === 'person' ? true : s.vollesMitglied;
}

/** Not-Aus: je Head jede Person, die den Head sieht (Bremse); für ALLE nur volle Mitglieder. */
export function notAusDarf(s: KontoSicht, kopf: { headSichtbar: boolean } | null): boolean {
  if (!s.imHaushalt) return false;
  return kopf ? kopf.headSichtbar : s.vollesMitglied;
}

// ── Prüfen (rein) ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PruefKontext {
  /** Speichernamen, die zuständig sein dürfen (Konten im Haushalt des Inhabers; für Privat-Heads nur volle Mitglieder). */
  zustaendigErlaubt: ReadonlySet<string>;
  /** Mitarbeiter-Kennungen dieses Heads (für `mitarbeiterAus`). */
  mitarbeiter: ReadonlySet<string>;
  /** Autonomie prüfen (lib/agenten/leistung.ts `autonomieWunschPruefen` mit der Annahmequote) — null = gültig, sonst Fehler. */
  autonomie: (wunsch: AutonomieStufe | null) => { ok: true; stufe: AutonomieStufe } | { ok: false; status: 400 | 409; fehler: string };
  /** Ist das Foto erlaubt (Medium sichtbar, ein Bild, passender Bereich)? Server prüft; rein: Form. */
  foto?: (id: string) => boolean;
}

/**
 * Eine Änderung prüfen und anwenden (rein). Nur bekannte Felder (`EINSTELLUNG_FELDER`); `null` setzt ein Feld auf die Vorgabe zurück.
 * Fehlerhafte Werte → 400 mit Satz, nie still verworfen. Liefert die neue Einstellung und die geänderten Feldnamen (fürs Protokoll).
 */
export function teilAnwenden(alt: HeadEinstellung, teil: unknown, head: Pick<HeadDef, 'id' | 'ebene' | 'bereich'>, ctx: PruefKontext): { ok: true; neu: HeadEinstellung; felder: EinstellungFeld[] } | Fehler {
  if (!teil || typeof teil !== 'object' || Array.isArray(teil)) return fehler(400, 'Änderung fehlt.');
  const t = teil as Record<string, unknown>;
  const unbekannt = Object.keys(t).filter(k => !(EINSTELLUNG_FELDER as readonly string[]).includes(k));
  if (unbekannt.length) return fehler(400, `Unbekanntes Feld: ${unbekannt.slice(0, 3).join(', ')}.`);
  const neu: HeadEinstellung & Record<string, unknown> = { ...alt };
  const felder: EinstellungFeld[] = [];
  const setze = (k: EinstellungFeld, v: unknown) => { if (v === null) delete neu[k]; else neu[k] = v as never; felder.push(k); };
  for (const k of EINSTELLUNG_FELDER) {
    if (!(k in t)) continue;
    const v = t[k];
    switch (k) {
      case 'aktiv':
        if (v !== null && typeof v !== 'boolean') return fehler(400, 'An/aus: ja oder nein.');
        setze(k, v === true ? null : v); // an = Vorgabe (kein Eintrag)
        break;
      case 'stufe':
        if (v !== null && !STUFEN.includes(v as ModelTier)) return fehler(400, 'Modell: schnell, ausgewogen oder stark.');
        setze(k, v);
        break;
      case 'aufwand':
        if (v !== null && !AUFWAENDE.includes(v as Aufwand)) return fehler(400, 'Aufwand: gering, mittel oder hoch.');
        setze(k, v);
        break;
      case 'budgetCentMonat':
        if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0)) return fehler(400, 'Budget je Monat in ganzen Euro-Cent (oder null = nur messen).');
        if (typeof v === 'number' && v > HEAD_BUDGET_MAX_CENT) return fehler(400, `Budget je Head höchstens ${HEAD_BUDGET_MAX_CENT / 100} € im Monat.`);
        setze(k, v);
        if (v === null) delete (neu as Record<string, unknown>).budgetGemeldet;
        break;
      case 'autonomie': {
        if (v !== null && v !== 'vorschlag' && v !== 'intern') return fehler(400, 'Autonomie: „vorschlag“ oder „intern“.');
        const a = ctx.autonomie(v as AutonomieStufe | null);
        if (!a.ok) return fehler(a.status, a.fehler);
        setze(k, v === null ? null : a.stufe);
        break;
      }
      case 'zustaendig':
        if (v !== null && (typeof v !== 'string' || !PERSON.test(v))) return fehler(400, 'Zuständig: eine Person aus den Konten.');
        if (typeof v === 'string' && !ctx.zustaendigErlaubt.has(v)) return fehler(400, head.ebene === 'person' || head.bereich === 'privat' ? 'Zuständig für einen Privat-Head kann nur ein volles Mitglied des Haushalts sein.' : 'Zuständig kann nur eine Person aus dem Haushalt sein.');
        setze(k, v);
        break;
      case 'foto':
        if (v !== null && (typeof v !== 'string' || !MEDIUM.test(v))) return fehler(400, 'Foto: ein Bild aus „Fotos & Videos“ (Kennung md-…).');
        if (typeof v === 'string' && ctx.foto && !ctx.foto(v)) return fehler(400, head.ebene === 'person' ? 'Dieses Bild siehst du nicht (oder es ist kein Bild).' : 'Für einen Head des Haushalts nur ein Bild aus den Business-Medien, das alle sehen.');
        setze(k, v);
        break;
      case 'mitarbeiterAus': {
        if (v !== null && (!Array.isArray(v) || v.some(x => typeof x !== 'string'))) return fehler(400, 'Mitarbeiter aus: eine Liste von Kennungen.');
        const liste = v === null ? [] : Array.from(new Set(v as string[]));
        if (liste.length > ctx.mitarbeiter.size) return fehler(413, 'Mehr Mitarbeiter als der Head hat.');
        const fremd = liste.filter(x => !ctx.mitarbeiter.has(x));
        if (fremd.length) return fehler(400, 'Diese Mitarbeiter hat der Head nicht.');
        setze(k, liste.length ? liste.sort() : null);
        break;
      }
    }
  }
  return { ok: true, neu, felder };
}

// ── Anzeige (rein) ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** Was die Seite je Head erfährt — wirksame Werte, Vorgaben, Kosten, Rechte, Stand. */
export function einstellungSicht(head: Pick<HeadDef, 'stufe' | 'aufwand'>, e: HeadEinstellung, o: { boden: AutonomieStufe; wirksameAutonomie: AutonomieStufe; modelle: Record<ModelTier, string>; kostenCent: number; aendern: boolean; foto: string | null }): HeadEinstellungSicht {
  return {
    stufe: e.stufe ?? head.stufe, aufwand: e.aufwand ?? head.aufwand, autonomie: o.wirksameAutonomie,
    vorgabe: { stufe: head.stufe, aufwand: head.aufwand, autonomie: o.boden },
    modelle: o.modelle,
    budgetCentMonat: typeof e.budgetCentMonat === 'number' ? e.budgetCentMonat : null,
    kostenCentMonat: Math.round(o.kostenCent * 100) / 100,
    zustaendig: e.zustaendig ?? null,
    notAus: e.notAus ? { seit: e.notAus.seit } : null,
    foto: o.foto,
    aendern: o.aendern,
    stand: einstellungStand(e),
  };
}

// ── Kosten je Head aus der Kostenmessung (rein) ─────────────────────────────────────────────────────────────────────────

/**
 * Welcher Head hinter einem `zweck` der Kostenmessung steht (lib/zoe/verbrauch.ts): `agent-<head>[-…]` (Agenten-Bereich), `head-<sales|
 * marketing|event>-…` (Takt der Heads), `finanzchef…` (Head of Finance). Sonst null (ZOE, Systemläufe, Medien).
 */
export function headVonZweck(zweck: string): string | null {
  // `-bild` (Gegenprüfung 09.10.): Bilder, die ein Head bzw. sein Mitarbeiter erzeugt (lib/agenten/medien-werkzeuge.ts), zählen in SEIN Budget.
  const m = /^agent-([a-z0-9-]+?)(?:-skill-test|-bild)?$/.exec(zweck);
  if (m && headDef(m[1])) return m[1];
  const h = /^head-(sales|marketing|event)(?:-|$)/.exec(zweck);
  if (h) return h[1];
  if (/^finanzchef(?:-|$)/.test(zweck)) return 'finanzen';
  return null;
}

/** Kosten je Head im Monat (US-Cent aus der Kostenmessung → Euro-Cent mit dem Kurs). NUR für Heads der Ebene Haushalt sinnvoll. Rein. */
export function kostenJeHeadAusVerbrauch(tage: readonly { tag: string; posten: readonly { zweck: string; cent: number }[] }[], monat: string, kurs: number): Record<string, number> {
  const raus: Record<string, number> = {};
  for (const t of tage) {
    if (!t.tag.startsWith(monat)) continue;
    for (const p of t.posten) {
      const h = headVonZweck(p.zweck);
      if (h && Number.isFinite(p.cent)) raus[h] = (raus[h] ?? 0) + p.cent * kurs;
    }
  }
  return raus;
}

// ── Takt und Arbeiter (rein) ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * Läufe, die der Not-Aus für ALLE anhält: alle Agenten (Fach-Agenten, Heads, Agenten-Bereich, ZOEs KI-Läufe im Hintergrund). Ausgenommen
 * die Wartung des Systems, die keine Agenten sind: Morgenlauf-Vorbereitung, Gesundheits-/Markttraktion-Nachrichten (ohne KI), Lagebild,
 * Löschfristen, Durchsicht, Absichten, Abholen bezahlter Medien.
 */
export const NOT_AUS_AUSGENOMMEN: ReadonlySet<string> = new Set(['tagesstart', 'gesundheit', 'markttraktion', 'hoi', 'loeschfristen', 'durchsicht', 'absichten', 'ki-medien']);
export const notAusBetrifft = (name: string): boolean => !NOT_AUS_AUSGENOMMEN.has(name);

/** Welcher Head hinter einem Auftrag der Warteschlange steht (Takt, Arbeiter) — oder null. */
export function headVonAuftrag(a: { name: string; eingabe?: Record<string, unknown> }): string | null {
  const h = /^head-(sales|marketing|event)$/.exec(a.name);
  if (h) return h[1];
  if (a.name === 'finanzchef') return 'finanzen';
  if (a.name === 'faden' && typeof a.eingabe?.headId === 'string' && headDef(a.eingabe.headId)) return a.eingabe.headId;
  return null;
}

/** Kurze Antwort für den Arbeiter, wenn ein Auftrag nicht läuft (nie Inhalte). */
export const ANGEHALTEN = 'Angehalten (Not-Aus).';

/**
 * Was der Takt nicht einreiht (rein): mit Not-Aus für alle jeden Agenten-Lauf, sonst die Läufe gesperrter Heads (Not-Aus des Heads,
 * ausgeschaltet, Budget). `sperre(headId, person)` kommt vom Server (Kosten, Person). Die übrigen Läufe bleiben unverändert.
 */
export function taktFiltern<T extends { auftrag: { name: string; eingabe?: Record<string, unknown>; person?: string } }>(faellig: readonly T[], e: AgentenEinstellung, sperre: (headId: string, person: string | null) => Sperre | null): T[] {
  return faellig.filter(f => {
    if (e.notAus && notAusBetrifft(f.auftrag.name)) return false;
    const h = headVonAuftrag(f.auftrag);
    return !h || !sperre(h, f.auftrag.person ?? null);
  });
}

// ── Konto: Export und Löschen (rein) ───────────────────────────────────────────────────────────────────────────────────

/** Was die Person im Bestand selbst eingetragen hat bzw. was ihren Speichernamen trägt — für den Konto-Export (Art. 15/20). */
export function einstellungEintraegeVon(e: AgentenEinstellung, speicher: string): unknown[] {
  const raus: unknown[] = [];
  if (e.notAus?.von === speicher) raus.push({ art: 'not-aus', seit: e.notAus.seit });
  for (const [id, h] of Object.entries(e.heads ?? {})) {
    if (!h) continue;
    const mein = h.zustaendig === speicher || h.notAus?.von === speicher || h.geaendertVon === speicher || (h as { autonomieVon?: string }).autonomieVon === speicher;
    if (mein) raus.push({ art: 'head', head: id, ...(h.zustaendig === speicher ? { zustaendig: true } : {}), ...(h.notAus?.von === speicher ? { notAus: h.notAus.seit } : {}), ...(h.geaendertVon === speicher ? { geaendertAm: h.geaendertAm } : {}) });
  }
  const eigen = e.personen?.[speicher];
  if (eigen) raus.push({ art: 'privat-heads', heads: eigen.heads });
  return raus;
}

/** Konto löschen (rein): der eigene Abschnitt fällt weg, der Speichername wird überall „[gelöscht]“ bzw. die Zuständigkeit entfällt. */
export function einstellungOhnePerson(e: AgentenEinstellung, speicher: string): { neu: AgentenEinstellung; n: number } {
  let n = 0;
  const tilge = (h: HeadEinstellung): HeadEinstellung => {
    const x: HeadEinstellung & { autonomieVon?: string } = { ...h };
    if (x.zustaendig === speicher) { delete x.zustaendig; n++; }
    if (x.notAus?.von === speicher) { x.notAus = { ...x.notAus, von: GELOESCHT }; n++; }
    if (x.geaendertVon === speicher) { x.geaendertVon = GELOESCHT; n++; }
    if (x.autonomieVon === speicher) { x.autonomieVon = GELOESCHT; n++; }
    return x;
  };
  const heads: AgentenEinstellung['heads'] = {};
  for (const [id, h] of Object.entries(e.heads ?? {})) if (h) heads[id] = tilge(h);
  const personen: NonNullable<AgentenEinstellung['personen']> = {};
  for (const [p, v] of Object.entries(e.personen ?? {})) {
    if (!v) continue;
    if (p === speicher) { n++; continue; }
    personen[p] = { heads: Object.fromEntries(Object.entries(v.heads ?? {}).filter(([, h]) => !!h).map(([id, h]) => [id, tilge(h!)])) };
  }
  const neu: AgentenEinstellung = { ...e, heads, ...(Object.keys(personen).length ? { personen } : {}) };
  if (!Object.keys(personen).length) delete neu.personen;
  if (neu.notAus?.von === speicher) { neu.notAus = { ...neu.notAus, von: GELOESCHT }; n++; }
  if (neu.geaendertVon === speicher) { neu.geaendertVon = GELOESCHT; n++; }
  return { neu, n };
}

// ══ Server ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

const leer = (): AgentenEinstellung => ({ v: 1, heads: {} });
const iso = () => new Date().toISOString();

/** Der Haushalt der Einstellungen einer Person (ihr Konto, sonst der Haushalt des Inhabers) — wie die Werkstatt. */
async function haushaltFuerPerson(person: string): Promise<string | null> {
  const { umfangFuer } = await import('./skills-server');
  return (await umfangFuer(person)).haushalt;
}

/** Der ganze Bestand (Server, roh — nur für Schreibwege und den Takt). */
async function rohLesen(haushalt: string | null): Promise<AgentenEinstellung> {
  if (!haushalt) return leer();
  const { loadJson } = await import('@/lib/store/local-db');
  const e = await loadJson<AgentenEinstellung>(einstellungBestand(haushalt)).catch(() => null);
  if (!e || typeof e !== 'object') return leer();
  return { ...leer(), ...e, heads: e.heads && typeof e.heads === 'object' ? e.heads : {} };
}

/** Speichernamen im Haushalt des Inhabers und welche davon volle Mitglieder sind (ohne „nur Business“). */
export async function haushaltsPersonen(): Promise<{ alle: { id: string; name: string; voll: boolean }[]; haushalt: string | null }> {
  const [{ ladeKonten }, { haushaltDesInhabers }] = await Promise.all([import('@/lib/zugang/konten'), import('@/lib/zugang/haushalt-inhaber')]);
  const [{ konten }, h] = await Promise.all([ladeKonten(), haushaltDesInhabers()]);
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const alle = konten
    .filter(k => PERSON.test(k.speicher) && (k.speicher === inhaber?.speicher || (!!h && k.haushalt === h)))
    .sort((a, b) => (a.rolle === 'inhaber' ? -1 : b.rolle === 'inhaber' ? 1 : 0))
    .map(k => ({ id: k.speicher, name: (k.name || k.speicher).slice(0, 60), voll: !!k.haushalt && k.finanzRecht !== 'business' }));
  return { alle, haushalt: h };
}

/** Kosten des Heads in diesem Monat (Euro-Cent): Haushalts-Heads aus der Kostenmessung, Privat-Heads nur aus den eigenen Threads. */
export async function kostenHeadMonat(head: Pick<HeadDef, 'id' | 'ebene'>, person: string | null, jetzt = new Date()): Promise<number> {
  const { monatBerlin } = await import('@/lib/store/aenderungsprotokoll');
  const monat = monatBerlin(jetzt);
  if (head.ebene === 'person') {
    if (!person) return 0;
    const { loadJson } = await import('@/lib/store/local-db');
    const { fadenBestand } = await import('./typen');
    const { fadenZahlen } = await import('./leistung');
    const faeden = (await loadJson<{ faeden?: Faden[] }>(fadenBestand(person)).catch(() => null))?.faeden ?? [];
    const [j, m] = monat.split('-').map(Number);
    const von = new Date(Date.UTC(j, m - 1, 1)).toISOString(), bis = new Date(Date.UTC(m === 12 ? j + 1 : j, m === 12 ? 0 : m, 1)).toISOString();
    return fadenZahlen(faeden, head.id, von, bis).kostenCent;
  }
  return (await kostenJeHeadMonat(jetzt))[head.id] ?? 0;
}

/** Kosten aller Haushalts-Heads im Monat (Euro-Cent) — EIN Lesezugriff auf die Kostenmessung. */
export async function kostenJeHeadMonat(jetzt = new Date()): Promise<Record<string, number>> {
  const [{ loadJson }, { monatBerlin }, { usdEurKurs }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll'), import('@/lib/ki/kosten')]);
  const s = await loadJson<{ tage?: { tag: string; posten: { zweck: string; cent: number }[] }[] }>('ki-verbrauch').catch(() => null);
  return kostenJeHeadAusVerbrauch(s?.tage ?? [], monatBerlin(jetzt), usdEurKurs());
}

/** Die Sicht eines Kontos (lib/agenten/faeden-server.ts `sichtLaden` — die EINE Filterstelle). */
async function sichtFuer(person: string): Promise<KontoSicht> {
  const { sichtLaden } = await import('./faeden-server');
  return sichtLaden(person);
}

/**
 * Sperre eines Heads für eine Person JETZT (Server): Not-Aus, aus, Budget — mit den Kosten des Monats, wenn ein Budget gesetzt ist.
 * Meldet beim Überschreiten von 80 % bzw. 100 % des Head-Budgets einmal je Monat die Glocke. Für die Thread-Routen und den Arbeiter.
 */
export async function laufSperre(person: string | null, headId: string, jetzt = new Date()): Promise<Sperre | null> {
  const head = headDef(headId);
  if (!head) return null;
  const haushalt = person ? await haushaltFuerPerson(person) : (await (await import('@/lib/zugang/haushalt-inhaber')).haushaltDesInhabers());
  const e = await rohLesen(haushalt);
  const h = headEinstellungVon(e, head, person);
  const kosten = typeof h.budgetCentMonat === 'number' ? await kostenHeadMonat(head, person, jetzt).catch(() => undefined) : undefined;
  const s = headSperre(e, head, person, kosten);
  if (typeof kosten === 'number' && typeof h.budgetCentMonat === 'number' && haushalt) await budgetGlocke(haushalt, head, person, h.budgetCentMonat, kosten, jetzt).catch(() => {});
  return s;
}

/** Eine Glocke je Stufe (80 % / 100 %) und Monat für das Budget eines Heads — an die zuständige Person, sonst die Besitzerin bzw. den Inhaber. */
async function budgetGlocke(haushalt: string, head: HeadDef, person: string | null, budget: number, kosten: number, jetzt: Date): Promise<void> {
  const stufe = budget <= 0 || kosten >= budget ? 100 : kosten >= budget * HEAD_BUDGET_WARNUNG ? 80 : 0;
  if (!stufe) return;
  const [{ updateJson }, { monatBerlin }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll')]);
  const monat = monatBerlin(jetzt);
  let neu = false;
  let an: string | null = null;
  await updateJson<AgentenEinstellung>(einstellungBestand(haushalt), cur => {
    const e = cur ?? leer();
    const h = (head.ebene === 'person' ? (person ? e.personen?.[person]?.heads?.[head.id] : undefined) : e.heads[head.id]) as (HeadEinstellung & { budgetGemeldet?: { monat: string; stufen: number[] } }) | undefined;
    if (!h) return e;
    const g = h.budgetGemeldet?.monat === monat ? h.budgetGemeldet : { monat, stufen: [] };
    if (g.stufen.includes(stufe)) return e;
    neu = true;
    an = h.zustaendig ?? (head.ebene === 'person' ? person : null);
    const x = { ...h, budgetGemeldet: { monat, stufen: [...g.stufen, stufe] } };
    if (head.ebene === 'person' && person) return { ...e, personen: { ...(e.personen ?? {}), [person]: { heads: { ...(e.personen?.[person]?.heads ?? {}), [head.id]: x } } } };
    return { ...e, heads: { ...e.heads, [head.id]: x } };
  });
  if (!neu) return;
  const [{ melde }, { inhaberSpeicher }, { WEG }] = await Promise.all([import('@/lib/meldungen/melden'), import('@/lib/zugang/haushalt-inhaber'), import('@/lib/wege')]);
  const empfaenger = an ?? (await inhaberSpeicher());
  // Neutral, ohne Beträge (Telegram-Regel) — die Zahlen stehen in den Einstellungen des Heads.
  if (empfaenger) await melde({ an: empfaenger, art: 'agenten', titel: stufe === 100 ? `Das Monatsbudget von ${head.name} ist erreicht — der Head pausiert` : `${head.name} hat 80 % des Monatsbudgets verbraucht`, link: WEG.agenten({ h: head.id }) });
}

/** Für den Arbeiter (app/api/zoe/auftraege/lauf): darf dieser Auftrag laufen? Grund (nie Inhalte) oder null. */
export async function auftragGesperrt(a: { name: string; eingabe?: Record<string, unknown>; person?: string | null }): Promise<string | null> {
  if (!notAusBetrifft(a.name)) return null;
  const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
  const e = await rohLesen(await haushaltDesInhabers());
  if (e.notAus) return ANGEHALTEN;
  const h = headVonAuftrag(a);
  if (!h) return null;
  const s = await laufSperre(a.person ?? null, h);
  return s ? (s.grund === 'not-aus' ? ANGEHALTEN : s.grund === 'budget' ? 'Pausiert (Budget des Heads erreicht).' : 'Der Head ist ausgeschaltet.') : null;
}

/** Für den Takt (lib/zoe/takt.ts): fällige Läufe ohne die gesperrten (Not-Aus, aus, Budget). Fehler → unverändert (der Takt läuft weiter). */
export async function taktSperreFiltern<T extends { auftrag: { name: string; eingabe?: Record<string, unknown>; person?: string } }>(faellig: T[], jetzt = new Date()): Promise<T[]> {
  if (!faellig.length) return faellig;
  try {
    const { haushaltDesInhabers } = await import('@/lib/zugang/haushalt-inhaber');
    const haushalt = await haushaltDesInhabers();
    const e = await rohLesen(haushalt);
    if (!e.notAus && !Object.keys(e.heads).length && !Object.keys(e.personen ?? {}).length) return faellig;
    const kosten = await kostenJeHeadMonat(jetzt).catch(() => ({} as Record<string, number>));
    return taktFiltern(faellig, e, (headId, person) => {
      const head = headDef(headId);
      if (!head) return null;
      return headSperre(e, head, person, head.ebene === 'person' ? undefined : kosten[headId] ?? 0);
    });
  } catch (err) {
    console.error('[agenten-einstellung] Takt-Sperre übersprungen:', err instanceof Error ? err.message.slice(0, 120) : err);
    return faellig;
  }
}

// ── Schreiben ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type EinstellungErgebnis = { ok: true; headId: string; einstellung: HeadEinstellung; stand: string; felder: string[] } | Fehler;

/** Ist dieses Medium als Foto erlaubt? Sichtbar für die Person, ein Bild; für Haushalts-Heads nur aus den Business-Medien (sehen alle). */
async function fotoErlaubt(person: string, head: HeadDef, id: string): Promise<boolean> {
  try {
    const { betrachterFuer, mediumFinden } = await import('@/lib/medien/server');
    const b = await betrachterFuer(person);
    const m = b ? await mediumFinden(b, id) : null;
    if (!m || m.medium.art !== 'bild') return false;
    return head.ebene === 'person' || m.quelle.art === 'business';
  } catch { return false; }
}

/**
 * Einstellungen eines Heads ändern (Person aus der Sitzung): Rechte über die Sicht, Stand → 409 (mit aktuellem Stand), Prüfung → 400/413,
 * Protokoll nur Kennung + Feldnamen. Privat-Heads schreiben in den Abschnitt der Person.
 */
export async function einstellungAendern(person: string, headId: unknown, teil: unknown, stand: unknown): Promise<EinstellungErgebnis> {
  const head = typeof headId === 'string' ? headDef(headId) : null;
  if (!head) return fehler(404, 'Diesen Head gibt es nicht.');
  const sicht = await sichtFuer(person);
  const { headSichtbar } = await import('./sicht');
  const sichtbar = headSichtbar(sicht, head.id);
  if (!sichtbar) return fehler(403, 'Diesen Head siehst du nicht.');
  if (!einstellungDarf(sicht, head, sichtbar)) return fehler(403, 'Die Einstellungen dieses Heads ändern nur volle Mitglieder des Haushalts.');
  if (typeof stand !== 'string') return fehler(400, 'Stand fehlt.');
  const haushalt = await haushaltFuerPerson(person);
  if (!haushalt) return fehler(409, 'Ohne Haushalt gibt es keine Einstellungen.');
  const [{ updateJson }, { protokolliere }, leistung, { mitarbeiterFuerHead }, personen] = await Promise.all([
    import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll'), import('./leistung'), import('./skills-lesen'), haushaltsPersonen(),
  ]);
  const t = teil && typeof teil === 'object' ? teil as Record<string, unknown> : {};
  const annahme = 'autonomie' in t ? await leistung.annahmeFuerHead(head, haushalt) : leistung.annahmeAus(0, 0);
  const ms = 'mitarbeiterAus' in t ? await mitarbeiterFuerHead(head.id, { person, haushalt }).catch(() => []) : [];
  const fotoOk = typeof t.foto === 'string' ? await fotoErlaubt(person, head, t.foto) : true;
  const privat = head.bereich === 'privat';
  const zustaendigErlaubt = new Set(personen.alle.filter(p => !privat || p.voll).map(p => p.id));
  const jetzt = iso();
  let raus: EinstellungErgebnis = fehler(409, 'Nicht gespeichert.');
  await updateJson<AgentenEinstellung>(einstellungBestand(haushalt), cur => {
    const e: AgentenEinstellung = cur ? { ...leer(), ...cur, heads: cur.heads ?? {} } : leer();
    const alt = headEinstellungVon(e, head, person);
    if (stand !== einstellungStand(alt)) { raus = fehler(409, 'Die Einstellungen haben sich inzwischen geändert — bitte neu laden.', { stand: einstellungStand(alt) }); return e; }
    const p = teilAnwenden(alt, t, head, {
      zustaendigErlaubt,
      mitarbeiter: new Set(ms.map(m => m.id)),
      autonomie: w => leistung.autonomieWunschPruefen(head, alt, w ?? leistung.autonomieBoden(head), annahme),
      foto: () => fotoOk,
    });
    if (!p.ok) { raus = p; return e; }
    if (!p.felder.length) { raus = { ok: true, headId: head.id, einstellung: alt, stand: einstellungStand(alt), felder: [] }; return e; }
    const neu: HeadEinstellung & { autonomieAm?: string; autonomieVon?: string; autonomieGrund?: string } = { ...p.neu, geaendertAm: jetzt, geaendertVon: person };
    if (p.felder.includes('autonomie')) Object.assign(neu, { autonomieAm: jetzt, autonomieVon: person, autonomieGrund: 'hand' });
    raus = { ok: true, headId: head.id, einstellung: neu, stand: einstellungStand(neu), felder: p.felder };
    if (head.ebene === 'person') return { ...e, personen: { ...(e.personen ?? {}), [person]: { heads: { ...(e.personen?.[person]?.heads ?? {}), [head.id]: neu } } } };
    return { ...e, heads: { ...e.heads, [head.id]: neu }, geaendertAm: jetzt, geaendertVon: person };
  });
  const ergebnis = raus as EinstellungErgebnis; // in der Sperre gesetzt (TS verfolgt das nicht)
  if (ergebnis.ok && ergebnis.felder.length) await protokolliere(einstellungBestand(haushalt), [{ liste: head.ebene === 'person' ? 'personen' : 'heads', op: 'geaendert', id: head.id, felder: [...ergebnis.felder] }], { art: 'person', person }).catch(() => {});
  return ergebnis;
}

export type NotAusErgebnis = { ok: true; an: boolean; headId?: string; angehalten: number } | Fehler;

/**
 * Not-Aus setzen bzw. lösen — für alle (nur volle Mitglieder) oder je Head (wer den Head sieht). Setzen hält sofort an: laufende und
 * wartende Threads der betroffenen Heads (alle Personen des Haushalts, bei Privat-Heads nur die eigenen) werden „abgebrochen“, offene
 * Aufträge in der Warteschlange entfernt. Lösen startet nichts neu (das macht die Person von Hand bzw. der nächste Zeitplan).
 */
export async function notAusSetzen(person: string, an: unknown, headId?: unknown): Promise<NotAusErgebnis> {
  if (typeof an !== 'boolean') return fehler(400, 'Not-Aus: an (true) oder aus (false).');
  const sicht = await sichtFuer(person);
  const head = headId === undefined || headId === null ? null : typeof headId === 'string' ? headDef(headId) : null;
  if (headId !== undefined && headId !== null && !head) return fehler(404, 'Diesen Head gibt es nicht.');
  const { headSichtbar } = await import('./sicht');
  if (!notAusDarf(sicht, head ? { headSichtbar: headSichtbar(sicht, head.id) } : null)) {
    return fehler(403, head ? 'Diesen Head siehst du nicht.' : 'Den Not-Aus für alle setzen und lösen nur volle Mitglieder des Haushalts — einzelne Heads kannst du anhalten.');
  }
  const haushalt = await haushaltFuerPerson(person);
  if (!haushalt) return fehler(409, 'Ohne Haushalt gibt es keinen Not-Aus.');
  const [{ updateJson }, { protokolliere }] = await Promise.all([import('@/lib/store/local-db'), import('@/lib/store/aenderungsprotokoll')]);
  const jetzt = iso();
  let geaendert = false;
  await updateJson<AgentenEinstellung>(einstellungBestand(haushalt), cur => {
    const e: AgentenEinstellung = cur ? { ...leer(), ...cur, heads: cur.heads ?? {} } : leer();
    if (!head) {
      if (!!e.notAus === an) return e;
      geaendert = true;
      const { notAus: _n, ...rest } = e;
      return an ? { ...e, notAus: { seit: jetzt, von: person }, geaendertAm: jetzt, geaendertVon: person } : { ...rest, geaendertAm: jetzt, geaendertVon: person };
    }
    const alt = headEinstellungVon(e, head, person);
    if (!!alt.notAus === an) return e;
    geaendert = true;
    const { notAus: _n, ...ohne } = alt;
    const neu: HeadEinstellung = an ? { ...alt, notAus: { seit: jetzt, von: person }, geaendertAm: jetzt, geaendertVon: person } : { ...ohne, geaendertAm: jetzt, geaendertVon: person };
    if (head.ebene === 'person') return { ...e, personen: { ...(e.personen ?? {}), [person]: { heads: { ...(e.personen?.[person]?.heads ?? {}), [head.id]: neu } } } };
    return { ...e, heads: { ...e.heads, [head.id]: neu } };
  });
  if (geaendert) await protokolliere(einstellungBestand(haushalt), [{ liste: head ? (head.ebene === 'person' ? 'personen' : 'heads') : 'instanz', op: 'geaendert', id: head?.id ?? 'not-aus', felder: ['notAus'] }], { art: 'person', person }).catch(() => {});
  let angehalten = 0;
  if (an) angehalten = await laeufeAnhalten(person, head).catch(e => { console.error('[agenten-einstellung] Anhalten:', e instanceof Error ? e.message.slice(0, 120) : e); return 0; });
  return { ok: true, an, ...(head ? { headId: head.id } : {}), angehalten };
}

/** Gehört der Thread zum Head (Head-Thread oder Mitarbeiter-Thread unter ihm)? Rein. */
export const fadenVonHead = (f: Pick<Faden, 'agent'>, headId: string): boolean => f.agent.art !== 'zoe' && f.agent.headId === headId;

/**
 * Laufende und wartende Threads anhalten (Status „abgebrochen“) und offene Aufträge entfernen — für alle Heads (Not-Aus für alle) bzw.
 * einen Head. Haushalts-Heads: Threads aller Personen im Haushalt; Privat-Heads (Ebene Person): nur die eigenen. Liefert die Zahl der
 * angehaltenen Threads (nie Inhalte).
 */
export async function laeufeAnhalten(von: string, head: HeadDef | null, jetzt = iso()): Promise<number> {
  const [{ bestandAendern }, { abbrechenWo }] = await Promise.all([import('./faeden-server'), import('@/lib/zoe/auftraege')]);
  const personen = head?.ebene === 'person' ? [von] : (await haushaltsPersonen()).alle.map(p => p.id);
  const passt = (f: Faden) => (head ? fadenVonHead(f, head.id) : true);
  const fadenIds = new Set<string>();
  let n = 0;
  for (const p of personen) {
    const r = await bestandAendern<number>(p, b => {
      let k = 0;
      const faeden = b.faeden.map(f => {
        if (!passt(f) || !f.lauf || (f.lauf.status !== 'wartet' && f.lauf.status !== 'laeuft')) return f;
        k++; fadenIds.add(f.id);
        return { ...f, status: 'abgebrochen' as const, lauf: { ...f.lauf, status: 'abgebrochen' as const, ende: jetzt, fehler: ANGEHALTEN, abgebrochenVon: von, wartetAuf: 'not-aus' as const } };
      });
      return { bestand: k ? { ...b, faeden } : b, e: k };
    }).catch(() => null);
    if (r?.ok) n += r.e;
  }
  await abbrechenWo(a => {
    if (a.status !== 'offen') return false;
    if (!head) return notAusBetrifft(a.name);
    if (a.name === 'faden') return (typeof a.eingabe?.fadenId === 'string' && fadenIds.has(a.eingabe.fadenId)) || a.eingabe?.headId === head.id;
    return headVonAuftrag(a) === head.id && (head.ebene !== 'person' || a.person === von);
  }, ANGEHALTEN).catch(() => []);
  return n;
}

/** Alle Heads des Katalogs mit ihrer Ebene (für Wächter und Oberfläche). */
export const HEADS_EBENE: readonly { id: string; ebene: HeadDef['ebene'] }[] = KATALOG.map(h => ({ id: h.id, ebene: h.ebene }));
