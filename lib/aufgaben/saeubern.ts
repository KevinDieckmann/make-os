// ─── MAKE OS — Aufgaben: Säuberung im Schreibweg (rein, 28.09. abends) ──────
// Eine Aufgabe von außen (Browser, ZOE, alte Fenster): nur bekannte Felder, Texte begrenzt. Listen werden NIE
// still gekürzt (CLAUDE.md „Nie abschneiden, ablehnen“) — wer über eine Grenze will, bekommt einen Fehlertext,
// die Route antwortet 413. Genutzt von /api/state/tasks und /api/tasks/create. Tests: tests/aufgaben-struktur.test.ts.

import type {
  Task, TaskStatus, AufgabeBezug, AufgabeKommentar, AufgabenListe, AufgabenStatus, Project, ProjectCategory, AufgabenGruppe, AufgabenVorlage,
  EigenesFeld, FeldTyp, FeldWert, Wiederholung, WiederholungRegel, ZoeAuftrag, ZoeStatus, ProjektStatus, VorlageAufgabe, VorlageInhalt,
} from '@/types/tasks';
import type { Owner, Priority } from '@/types/common';
import { istSpaceId, istSonstigeProjekt, TASK_STATUS } from './struktur';

/** Grenzen je Aufgabe/Bestand — darüber 413 mit Text. */
export const AUFGABEN_GRENZEN = {
  aufgaben: 20000,
  ops: 200,
  tags: 50,
  subTasks: 200,
  dependencies: 200,
  kommentare: 500,
  erwaehnt: 20,
  projekte: 1000,
  listen: 5000,
  status: 200,
  // Vertiefung (28.09. spät)
  gruppen: 2000,
  vorlagen: 500,
  /** Zeichen je Notiz (Projekt/Aufgabe). */
  notiz: 50_000,
  /** Zeichen der Projekt-Beschreibung. */
  beschreibung: 4000,
  mitglieder: 20,
  /** Eigene Felder je Projekt bzw. Werte je Aufgabe. */
  felder: 50,
  optionen: 50,
  /** Zeichen je Feldwert (Text, Link). */
  feldText: 2000,
  abhaengigVon: 200,
  /** Zeichen des Hinweises an ZOE (= ZOE_VORSCHLAG_GRENZEN.hinweis in lib/aufgaben/zoe.ts). */
  zoeHinweis: 1000,
  /** Zeichen des Vorlagen-Inhalts (JSON). */
  vorlageZeichen: 200_000,
  vorlageAufgaben: 1000,
} as const;

const PRIO: readonly Priority[] = ['low', 'medium', 'high', 'critical'];
const KENNUNG = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/;
const PERSON = /^[a-z0-9-]{1,40}$/;
const TAG = /^\d{4}-\d{2}-\d{2}$/;
const FARBE = /^#[0-9a-fA-F]{6}$/;
const S = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').slice(0, n) : undefined);
const kennung = (v: unknown): string | undefined => (typeof v === 'string' && KENNUNG.test(v) ? v : undefined);

/** Fehler der Säuberung — die Route macht daraus 413. */
export class ZuGross extends Error {}
const zuViel = (liste: unknown, max: number, was: string) => {
  if (Array.isArray(liste) && liste.length > max) throw new ZuGross(`Abgelehnt: ${liste.length} ${was} an einer Aufgabe — höchstens ${max}. Nichts gespeichert.`);
};

/** CRM-Bezug: nur gültige Kennungen, leer → undefined. */
export function bezugSauber(v: unknown): AufgabeBezug | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const b: AufgabeBezug = {};
  const k = kennung(o.kontaktId); if (k && /^c-/.test(k)) b.kontaktId = k;
  const f = kennung(o.firmaId); if (f && /^f-/.test(f)) b.firmaId = f;
  const m = kennung(o.mandatId); if (m) b.mandatId = m;
  const d = kennung(o.dealId); if (d) b.dealId = d;
  return Object.keys(b).length ? b : undefined;
}

/** Kommentare: Kennung, Person, Text (≤ 4000), Zeitpunkt, Erwähnte. Mehr als die Grenze → ZuGross. */
export function kommentareSauber(v: unknown): AufgabeKommentar[] | undefined {
  if (!Array.isArray(v)) return undefined;
  zuViel(v, AUFGABEN_GRENZEN.kommentare, 'Kommentare');
  const raus: AufgabeKommentar[] = [];
  for (const x of v as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') continue;
    const id = kennung(x.id), von = typeof x.von === 'string' && PERSON.test(x.von) ? x.von : undefined;
    const text = S(x.text, 4000)?.trim();
    if (!id || !von || !text) continue;
    zuViel(x.erwaehnt, AUFGABEN_GRENZEN.erwaehnt, 'Erwähnungen');
    const erwaehnt = Array.isArray(x.erwaehnt) ? Array.from(new Set(x.erwaehnt.filter((p): p is string => typeof p === 'string' && PERSON.test(p)))) : [];
    raus.push({ id, von, text, am: S(x.am, 40) ?? new Date().toISOString(), ...(erwaehnt.length ? { erwaehnt } : {}) });
  }
  return raus.length ? raus : undefined;
}

/**
 * Eine Aufgabe von außen säubern — null, wenn Kennung oder Titel fehlen; wirft `ZuGross` bei zu langen Listen.
 * `space`/`einheit` werden danach aus `spaceId` abgeleitet (lib/aufgaben/struktur.ts `uebernehmen`).
 */
export function taskSauber(o: unknown): Task | null {
  if (!o || typeof o !== 'object') return null;
  const t = o as Record<string, unknown>;
  const id = S(t.id, 80), title = S(t.title, 300)?.trim();
  if (!id || !title) return null;
  zuViel(t.tags, AUFGABEN_GRENZEN.tags, 'Schlagworte');
  zuViel(t.subTasks, AUFGABEN_GRENZEN.subTasks, 'Unteraufgaben (alt)');
  zuViel(t.dependencies, AUFGABEN_GRENZEN.dependencies, 'Abhängigkeiten');
  const jetzt = new Date().toISOString();
  const raus: Task = {
    id, title, projectId: S(t.projectId, 80) ?? '', description: S(t.description, 4000),
    status: TASK_STATUS.includes(t.status as TaskStatus) ? (t.status as TaskStatus) : 'todo',
    priority: PRIO.includes(t.priority as Priority) ? (t.priority as Priority) : 'medium',
    assignee: (S(t.assignee, 40) ?? 'kevin') as Owner,
    tags: Array.isArray(t.tags) ? (t.tags.map(x => String(x).slice(0, 40)) as unknown as Task['tags']) : [],
    dueDate: S(t.dueDate, 40), completedAt: S(t.completedAt, 40),
    // Space (26.09.): Abweichung vom Ort — nur privat|business, sonst weg (wird aus spaceId abgeleitet, wenn gesetzt).
    space: t.space === 'privat' || t.space === 'business' ? t.space : undefined,
    subTasks: Array.isArray(t.subTasks) ? (t.subTasks as Record<string, unknown>[]).filter(x => x && typeof x === 'object').map(x => ({ id: String(x.id ?? '').slice(0, 80), taskId: id, title: String(x.title ?? '').slice(0, 300), completed: x.completed === true, sortOrder: Number(x.sortOrder) || 0, createdAt: S(x.createdAt, 40) ?? jetzt, updatedAt: S(x.updatedAt, 40) ?? jetzt })) : [],
    dependencies: Array.isArray(t.dependencies) ? (t.dependencies as Record<string, unknown>[]).filter(x => x && typeof x === 'object' && typeof x.blockedByTaskId === 'string').map(x => ({ blockedByTaskId: String(x.blockedByTaskId).slice(0, 80), ...(typeof x.resolvedAt === 'string' ? { resolvedAt: x.resolvedAt.slice(0, 40) } : {}) })) : [],
    sortOrder: Number(t.sortOrder) || 0,
    createdAt: S(t.createdAt, 40) ?? jetzt, updatedAt: S(t.updatedAt, 40) ?? jetzt,
    einheit: S(t.einheit, 40),
    spaceId: istSpaceId(t.spaceId) ? t.spaceId : undefined,
    listeId: kennung(t.listeId),
    parentId: kennung(t.parentId),
    statusId: kennung(t.statusId),
    bezug: bezugSauber(t.bezug),
    kommentare: kommentareSauber(t.kommentare),
    startDate: typeof t.startDate === 'string' && TAG.test(t.startDate) ? t.startDate : undefined,
    // Vertiefung (28.09. spät). `verlauf` schreibt nur der Server — was der Browser mitschickt, fällt hier weg.
    notiz: notizSauber(t.notiz, 'Notiz'),
    felder: feldWerteSauber(t.felder),
    abhaengigVon: abhaengigSauber(t.abhaengigVon, id),
    wiederholung: wiederholungSauber(t.wiederholung),
    vorlageId: kennung(t.vorlageId),
    serieId: kennung(t.serieId),
    zoe: zoeSauber(t.zoe),
  };
  if (raus.parentId === id) delete raus.parentId;
  for (const k of Object.keys(raus) as (keyof Task)[]) if (raus[k] === undefined) delete raus[k];
  return raus;
}

const KATEGORIEN: readonly ProjectCategory[] = ['personal-malin', 'personal-kevin', 'joint', 'business'];
/** Ein Projekt von außen. Kennung, Titel und Space sind Pflicht (der Space entscheidet Privat/Business). */
export function projektSauber(o: unknown): Project | null {
  if (!o || typeof o !== 'object') return null;
  const p = o as Record<string, unknown>;
  const id = kennung(p.id), title = S(p.title, 120)?.trim();
  if (!id || !title || istSonstigeProjekt(id)) return null;
  const spaceId = istSpaceId(p.spaceId) ? p.spaceId : undefined;
  const jetzt = new Date().toISOString();
  const category = KATEGORIEN.includes(p.category as ProjectCategory) ? (p.category as ProjectCategory) : spaceId === 'privat' ? 'joint' : 'business';
  const raus: Project = {
    id, title, description: S(p.description, 2000), category, owner: (p.owner === 'malin' || p.owner === 'kevin' ? p.owner : 'both') as Owner,
    color: typeof p.color === 'string' && FARBE.test(p.color) ? p.color : '#58D9CD',
    tags: Array.isArray(p.tags) ? (p.tags.slice(0, AUFGABEN_GRENZEN.tags) as Project['tags']) : [],
    archived: p.archived === true, dueDate: typeof p.dueDate === 'string' && TAG.test(p.dueDate) ? p.dueDate : undefined,
    createdAt: S(p.createdAt, 40) ?? jetzt, updatedAt: S(p.updatedAt, 40) ?? jetzt, spaceId,
    // Projektseite (28.09. spät)
    notiz: notizSauber(p.notiz, 'Projekt-Notiz'),
    beschreibung: textOderAblehnen(p.beschreibung, AUFGABEN_GRENZEN.beschreibung, 'Beschreibung'),
    status: PROJEKT_STATUS.includes(p.status as ProjektStatus) ? (p.status as ProjektStatus) : undefined,
    start: typeof p.start === 'string' && TAG.test(p.start) ? p.start : undefined,
    ende: typeof p.ende === 'string' && TAG.test(p.ende) ? p.ende : undefined,
    mitglieder: personenSauber(p.mitglieder),
    felder: felderDefSauber(p.felder),
    vorlageId: kennung(p.vorlageId),
  };
  if (raus.start && raus.ende && raus.ende < raus.start) delete raus.ende;
  for (const k of Object.keys(raus) as (keyof Project)[]) if (raus[k] === undefined) delete raus[k];
  return raus;
}

/** Eine Liste im Projekt (Januar, Februar …). */
export function listeSauber(o: unknown): AufgabenListe | null {
  if (!o || typeof o !== 'object') return null;
  const l = o as Record<string, unknown>;
  const id = kennung(l.id), projektId = kennung(l.projektId), titel = S(l.titel, 80)?.trim();
  if (!id || !projektId || !titel) return null;
  const gruppeId = kennung(l.gruppeId), wiederholung = wiederholungSauber(l.wiederholung), vorlageId = kennung(l.vorlageId);
  const titelMuster = S(l.titelMuster, 80)?.trim();
  return {
    id, projektId, titel, sortOrder: Number(l.sortOrder) || 0, ...(l.archiviert === true ? { archiviert: true } : {}),
    ...(gruppeId ? { gruppeId } : {}), ...(wiederholung ? { wiederholung } : {}), ...(vorlageId ? { vorlageId } : {}), ...(titelMuster ? { titelMuster } : {}),
  };
}

// ── Vertiefung (28.09. spät): Gruppen, Notizen, eigene Felder, Abhängigkeiten, Wiederholung, ZOE, Vorlagen ──

const PROJEKT_STATUS: readonly ProjektStatus[] = ['aktiv', 'pausiert', 'abgeschlossen'];
const FELD_TYPEN: readonly FeldTyp[] = ['text', 'zahl', 'betrag', 'datum', 'auswahl', 'link', 'person'];
const REGELN: readonly WiederholungRegel[] = ['taeglich', 'woechentlich', 'monatlich', 'jaehrlich', 'werktage'];
const ZOE_STATUS: readonly ZoeStatus[] = ['offen', 'in_arbeit', 'wartet_freigabe', 'freigegeben', 'abgelehnt'];
const OWNER = ['kevin', 'malin', 'both'] as const;

/** Text mit Grenze: länger → ZuGross (413), nie still gekürzt. Leer → undefined. */
function textOderAblehnen(v: unknown, max: number, was: string): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\u0000/g, '');
  if (t.length > max) throw new ZuGross(`Abgelehnt: ${was} hat ${t.length} Zeichen — höchstens ${max}. Nichts gespeichert.`);
  return t.trim() ? t : undefined;
}

/** Notiz (Markdown-Teilmenge, als Text gespeichert — gerendert wird ohne HTML, lib/aufgaben/notiz.ts). */
export const notizSauber = (v: unknown, was = 'Notiz'): string | undefined => textOderAblehnen(v, AUFGABEN_GRENZEN.notiz, was);

/** Personen (Speichernamen), ohne Doppelte. Zu viele → ZuGross. */
export function personenSauber(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  zuViel(v, AUFGABEN_GRENZEN.mitglieder, 'Mitglieder');
  const raus = Array.from(new Set(v.filter((p): p is string => typeof p === 'string' && PERSON.test(p))));
  return raus.length ? raus : undefined;
}

/** Definitionen eigener Felder: Kennung, Name (≤ 60), Typ, Optionen (nur Auswahl). */
export function felderDefSauber(v: unknown): EigenesFeld[] | undefined {
  if (!Array.isArray(v)) return undefined;
  if (v.length > AUFGABEN_GRENZEN.felder) throw new ZuGross(`Abgelehnt: ${v.length} eigene Felder — höchstens ${AUFGABEN_GRENZEN.felder}. Nichts gespeichert.`);
  const raus: EigenesFeld[] = [];
  for (const f of v as Record<string, unknown>[]) {
    if (!f || typeof f !== 'object') continue;
    const id = kennung(f.id), name = S(f.name, 60)?.trim();
    if (!id || !name || raus.some(x => x.id === id)) continue;
    const typ = FELD_TYPEN.includes(f.typ as FeldTyp) ? (f.typ as FeldTyp) : 'text';
    const e: EigenesFeld = { id, name, typ };
    if (typ === 'auswahl' && Array.isArray(f.optionen)) {
      if (f.optionen.length > AUFGABEN_GRENZEN.optionen) throw new ZuGross(`Abgelehnt: ${f.optionen.length} Auswahl-Werte — höchstens ${AUFGABEN_GRENZEN.optionen}.`);
      const o = Array.from(new Set(f.optionen.map(x => S(x, 60)?.trim()).filter((x): x is string => !!x)));
      if (o.length) e.optionen = o;
    }
    raus.push(e);
  }
  return raus.length ? raus : undefined;
}

/** Werte eigener Felder (ohne Definition): Text ≤ 2000 oder endliche Zahl. Die typgerechte Prüfung macht `feldWerteTypisieren`. */
export function feldWerteSauber(v: unknown): Record<string, FeldWert> | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const ein = Object.entries(v as Record<string, unknown>);
  if (ein.length > AUFGABEN_GRENZEN.felder) throw new ZuGross(`Abgelehnt: ${ein.length} Feldwerte an einer Aufgabe — höchstens ${AUFGABEN_GRENZEN.felder}.`);
  const raus: Record<string, FeldWert> = {};
  for (const [k, w] of ein) {
    if (!KENNUNG.test(k)) continue;
    if (typeof w === 'number' && Number.isFinite(w)) raus[k] = w;
    else if (typeof w === 'string') {
      const t = textOderAblehnen(w, AUFGABEN_GRENZEN.feldText, 'Feldwert');
      if (t !== undefined) raus[k] = t.trim();
    }
  }
  return Object.keys(raus).length ? raus : undefined;
}

const LINK = /^(https?:\/\/[^\s<>"']+|\/os\/[^\s<>"']*)$/i;
/**
 * Feldwerte typgerecht gegen die Definitionen des Projekts: Zahl endlich, Betrag ganze Cent (Zahl = Cent, Text = Euro), Datum YYYY-MM-DD,
 * Auswahl nur aus den Optionen, Link http(s) oder /os/…, Person Speichername. Werte zu Feldern, die das Projekt
 * (noch) nicht kennt, bleiben stehen — zieht die Aufgabe zurück oder kommt das Feld wieder, sind sie da.
 */
export function feldWerteTypisieren(werte: Record<string, FeldWert> | undefined, defs: readonly EigenesFeld[] | undefined): Record<string, FeldWert> | undefined {
  if (!werte) return undefined;
  const raus: Record<string, FeldWert> = {};
  for (const [k, w] of Object.entries(werte)) {
    const d = defs?.find(f => f.id === k);
    if (!d) { raus[k] = w; continue; }
    const text = typeof w === 'string' ? w.trim() : String(w);
    const zahl = typeof w === 'number' ? w : Number(text.replace(/\s/g, '').replace(',', '.'));
    switch (d.typ) {
      case 'zahl': if (Number.isFinite(zahl) && text !== '') raus[k] = zahl; break;
      // Zahl = schon Cent (so schickt die Oberfläche); Text = Euro in deutscher Schreibweise („1.500,40“) → Cent.
      case 'betrag': {
        const cent = typeof w === 'number' ? w : /,/.test(text) ? Number(text.replace(/[€\s.]/g, '').replace(',', '.')) * 100 : Number(text.replace(/[€\s]/g, '')) * 100;
        if (Number.isFinite(cent) && text !== '' && Math.abs(cent) <= 1e13) raus[k] = Math.round(cent);
        break;
      }
      case 'datum': if (TAG.test(text)) raus[k] = text; break;
      case 'auswahl': if (d.optionen?.includes(text)) raus[k] = text; break;
      case 'link': if (LINK.test(text)) raus[k] = text; break;
      case 'person': if (PERSON.test(text)) raus[k] = text; break;
      default: if (text) raus[k] = text;
    }
  }
  return Object.keys(raus).length ? raus : undefined;
}

/** „Wartet auf“: gültige Kennungen ohne Doppelte, nie die Aufgabe selbst. */
export function abhaengigSauber(v: unknown, selbst: string): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  zuViel(v, AUFGABEN_GRENZEN.abhaengigVon, 'Abhängigkeiten');
  const raus = Array.from(new Set(v.map(kennung).filter((x): x is string => !!x && x !== selbst)));
  return raus.length ? raus : undefined;
}

/** Wiederholung: Regel Pflicht, Intervall 1–365, Wochentage 0–6, Monatstag 1–31, Tage YYYY-MM-DD. */
export function wiederholungSauber(v: unknown): Wiederholung | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const w = v as Record<string, unknown>;
  if (!REGELN.includes(w.regel as WiederholungRegel)) return undefined;
  const raus: Wiederholung = { regel: w.regel as WiederholungRegel };
  const n = Number(w.intervall);
  if (Number.isInteger(n) && n >= 1 && n <= 365) raus.intervall = n;
  if (Array.isArray(w.wochentage)) {
    const t = Array.from(new Set(w.wochentage.map(Number).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))).sort();
    if (t.length) raus.wochentage = t;
  }
  const m = Number(w.monatstag);
  if (Number.isInteger(m) && m >= 1 && m <= 31) raus.monatstag = m;
  if (typeof w.bis === 'string' && TAG.test(w.bis)) raus.bis = w.bis;
  if (typeof w.naechste === 'string' && TAG.test(w.naechste)) raus.naechste = w.naechste;
  return raus;
}

/** ZOE an einer Aufgabe: Status Pflicht, Stapel-Kennung, Auftraggeberin (Speichername), Hinweis (≤ 1.000, sonst 413). */
export function zoeSauber(v: unknown): ZoeAuftrag | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const z = v as Record<string, unknown>;
  if (!ZOE_STATUS.includes(z.status as ZoeStatus)) return undefined;
  const stapelId = kennung(z.stapelId);
  const von = typeof z.von === 'string' && PERSON.test(z.von) ? z.von : undefined;
  const hinweis = textOderAblehnen(z.hinweis, AUFGABEN_GRENZEN.zoeHinweis, 'Der Hinweis an ZOE')?.trim();
  return { status: z.status as ZoeStatus, ...(stapelId ? { stapelId } : {}), ...(von ? { von } : {}), ...(hinweis ? { hinweis } : {}) };
}

/** Eine Gruppe im Projekt (Marketing, Sales …). */
export function gruppeSauber(o: unknown): AufgabenGruppe | null {
  if (!o || typeof o !== 'object') return null;
  const g = o as Record<string, unknown>;
  const id = kennung(g.id), projektId = kennung(g.projektId), titel = S(g.titel, 60)?.trim();
  if (!id || !projektId || !titel) return null;
  return { id, projektId, titel, farbe: typeof g.farbe === 'string' && FARBE.test(g.farbe) ? g.farbe : '#6E7A7D', sortOrder: Number(g.sortOrder) || 0, ...(g.eingeklappt === true ? { eingeklappt: true } : {}) };
}

function vorlageAufgabeSauber(o: unknown, tiefe: number, zaehler: { n: number }): VorlageAufgabe | null {
  if (!o || typeof o !== 'object') return null;
  const a = o as Record<string, unknown>;
  const titel = S(a.titel, 300)?.trim();
  if (!titel) return null;
  if (++zaehler.n > AUFGABEN_GRENZEN.vorlageAufgaben) throw new ZuGross(`Abgelehnt: mehr als ${AUFGABEN_GRENZEN.vorlageAufgaben} Aufgaben in einer Vorlage.`);
  const r: VorlageAufgabe = { titel };
  const b = textOderAblehnen(a.beschreibung, 4000, 'Beschreibung'); if (b) r.beschreibung = b;
  if (PRIO.includes(a.prioritaet as Priority)) r.prioritaet = a.prioritaet as Priority;
  if ((OWNER as readonly string[]).includes(a.zustaendig as string)) r.zustaendig = a.zustaendig as Owner;
  const v = Number(a.versatzTage); if (Number.isInteger(v) && Math.abs(v) <= 3650) r.versatzTage = v;
  const n = notizSauber(a.notiz, 'Notiz in der Vorlage'); if (n) r.notiz = n;
  const f = feldWerteSauber(a.felder); if (f) r.felder = f;
  if (tiefe === 0 && Array.isArray(a.unter)) {
    const u = a.unter.map(x => vorlageAufgabeSauber(x, 1, zaehler)).filter((x): x is VorlageAufgabe => !!x);
    if (u.length) r.unter = u;
  }
  return r;
}

/** Eine Vorlage (Projekt oder Liste). Inhalt über der Grenze → ZuGross. */
export function vorlageSauber(o: unknown): AufgabenVorlage | null {
  if (!o || typeof o !== 'object') return null;
  const v = o as Record<string, unknown>;
  const id = kennung(v.id), titel = S(v.titel, 120)?.trim();
  if (!id || !titel || (v.art !== 'projekt' && v.art !== 'liste')) return null;
  const roh = (v.inhalt && typeof v.inhalt === 'object' ? v.inhalt : {}) as Record<string, unknown>;
  const zeichen = JSON.stringify(roh).length;
  if (zeichen > AUFGABEN_GRENZEN.vorlageZeichen) throw new ZuGross(`Abgelehnt: Vorlage mit ${zeichen} Zeichen — höchstens ${AUFGABEN_GRENZEN.vorlageZeichen}.`);
  const z = { n: 0 };
  const aufgaben = (l: unknown) => (Array.isArray(l) ? l.map(x => vorlageAufgabeSauber(x, 0, z)).filter((x): x is VorlageAufgabe => !!x) : []);
  const inhalt: VorlageInhalt = {};
  if (Array.isArray(roh.gruppen)) {
    const g = roh.gruppen.map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {})).map(x => ({ titel: S(x.titel, 60)?.trim() ?? '', ...(typeof x.farbe === 'string' && FARBE.test(x.farbe) ? { farbe: x.farbe } : {}) })).filter(x => x.titel);
    if (g.length) inhalt.gruppen = g;
  }
  if (Array.isArray(roh.listen)) {
    const l = roh.listen.map(x => (x && typeof x === 'object' ? x as Record<string, unknown> : {})).map(x => ({ titel: S(x.titel, 80)?.trim() ?? '', ...(S(x.gruppe, 60)?.trim() ? { gruppe: S(x.gruppe, 60)!.trim() } : {}), aufgaben: aufgaben(x.aufgaben) })).filter(x => x.titel);
    if (l.length) inhalt.listen = l;
  }
  const a = aufgaben(roh.aufgaben); if (a.length) inhalt.aufgaben = a;
  const f = felderDefSauber(roh.felder); if (f) inhalt.felder = f;
  const n = notizSauber(roh.notiz, 'Vorlagen-Notiz'); if (n) inhalt.notiz = n;
  const spaceId = istSpaceId(v.spaceId) ? v.spaceId : undefined;
  return { id, art: v.art, titel, inhalt, ...(spaceId ? { spaceId } : {}), ...(typeof v.angelegt === 'string' ? { angelegt: v.angelegt.slice(0, 40) } : {}) };
}

/** Ein eigener Status je Space: Name, Farbe, Grundstatus (Bedeutung). */
export function statusSauber(o: unknown): AufgabenStatus | null {
  if (!o || typeof o !== 'object') return null;
  const s = o as Record<string, unknown>;
  const id = kennung(s.id), label = S(s.label, 30)?.trim();
  if (!id || !label || !istSpaceId(s.spaceId) || TASK_STATUS.includes(id as TaskStatus)) return null;
  const basis = TASK_STATUS.includes(s.basis as TaskStatus) ? (s.basis as TaskStatus) : 'todo';
  return { id, spaceId: s.spaceId, label, farbe: typeof s.farbe === 'string' && FARBE.test(s.farbe) ? s.farbe : '#6E7A7D', basis, sortOrder: Number(s.sortOrder) || 0 };
}

/**
 * Kommentare zusammenführen (Server): Vorhandene bleiben so, wie sie gespeichert sind (niemand ändert fremde
 * Kommentare); neue tragen die schreibende Person und den Zeitpunkt des Servers; löschen darf man nur eigene.
 * Liefert auch die neu hinzugekommenen (für die Meldungen).
 */
export function kommentareVereinen(alt: readonly AufgabeKommentar[] | undefined, neu: readonly AufgabeKommentar[] | undefined, person: string | null, jetzt = new Date().toISOString()): { kommentare: AufgabeKommentar[] | undefined; neue: AufgabeKommentar[] } {
  const vorher = new Map((alt ?? []).map(k => [k.id, k]));
  const kommen = new Map((neu ?? []).map(k => [k.id, k]));
  const raus: AufgabeKommentar[] = [];
  const neue: AufgabeKommentar[] = [];
  for (const k of alt ?? []) {
    if (kommen.has(k.id) || !person || k.von !== person) raus.push(k); // bleibt (unverändert) — fremde nie löschen
  }
  for (const k of neu ?? []) {
    if (vorher.has(k.id) || !person) continue;
    const n: AufgabeKommentar = { ...k, von: person, am: jetzt };
    raus.push(n); neue.push(n);
  }
  raus.sort((a, b) => a.am.localeCompare(b.am));
  return { kommentare: raus.length ? raus : undefined, neue };
}
