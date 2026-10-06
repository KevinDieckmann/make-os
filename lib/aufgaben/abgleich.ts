// ─── MAKE OS — Aufgaben: Abgleich Browser ↔ Server (rein, 29.09., A1/A4/A5) ─
// Die Regeln hinter `context/TasksContext.tsx`, ohne React und ohne Netz — getestet in tests/aufgaben-abgleich.test.ts.
//
// Grundsatz (Kevin 29.09.: „Alle Infos müssen immer sauber gespeichert werden — extrem wichtig“):
//   · Der Server ist die Wahrheit. Der Browser merkt sich den zuletzt BESTÄTIGTEN Serverstand (`server`); was die Sicht
//     davon unterscheidet, sind die ausstehenden Änderungen. Sie bleiben, bis der Server sie bestätigt — nie wird etwas
//     als „gesendet“ abgehakt, bevor die Antwort da ist (vorher ging bei 502/Netz/413 alles still verloren).
//   · Ein Abgleich (45 s, Fokus) übernimmt den neuen Serverstand und legt die ausstehenden Änderungen WIEDER DARAUF
//     (`aufOps`) — mit dem ALTEN Stand je Zeile, damit eine gleichzeitige fremde Änderung als Konflikt auffällt statt
//     still überschrieben zu werden.
//   · 409 mit Konflikten: nur die betroffenen Zeilen nehmen die Fassung des Servers an; die eigene bleibt als „Deine
//     Fassung“ erhalten (übernehmen/kopieren). Konfliktfreie Änderungen gehen sofort erneut raus.
//   · 400/413: das Paket wird in Einzeländerungen zerlegt; nur die abgelehnte Zeile bleibt mit Grund stehen (sichtbar),
//     die Eingabe bleibt in der Sicht.

import type { TasksState } from '@/types/tasks';

// Seit 06.10. (Umbau v3, Malins Bauplan-Karte) ohne „gruppen“: der Browser schickt nie eine Gruppen-Änderung (der Server lehnt sie ab).
export type ListenArt = 'tasks' | 'projects' | 'listen' | 'statusEigen' | 'vorlagen';
export const LISTEN: readonly ListenArt[] = ['tasks', 'projects', 'listen', 'statusEigen', 'vorlagen'];
export const STRUKTUR: readonly Exclude<ListenArt, 'tasks'>[] = ['projects', 'listen', 'statusEigen', 'vorlagen'];
export type Staende = Map<string, string>;
export type Zeile = { id: string } & Record<string, unknown>;
export const schluessel = (art: ListenArt, id: string) => `${art}:${id}`;
export const ausSchluessel = (k: string): { liste: ListenArt; id: string } => { const i = k.indexOf(':'); return { liste: k.slice(0, i) as ListenArt, id: k.slice(i + 1) }; };

export type Op = { op: 'upsert'; eintrag: Zeile; stand?: string } | { op: 'delete'; id: string; stand?: string };
export type OpsJe = Record<ListenArt, Op[]>;
export const leereOps = (): OpsJe => ({ tasks: [], projects: [], listen: [], statusEigen: [], vorlagen: [] });
export const leererStand = (): TasksState => ({ projects: [], tasks: [], listen: [], statusEigen: [], vorlagen: [] });
const zeilenVon = (s: TasksState, art: ListenArt) => ((s[art] ?? []) as unknown as Zeile[]);
export const opId = (o: Op): string => (o.op === 'delete' ? o.id : o.eintrag.id);
export const anzahl = (ops: OpsJe): number => LISTEN.reduce((n, a) => n + ops[a].length, 0);

/** Server-Antwort in Sicht + Stände teilen: `stand` gehört nie in den Zustand (sonst schickte man einen alten zurück). */
export function ohneStand(roh: TasksState, staende: Staende): TasksState {
  const raus = leererStand() as unknown as Record<ListenArt, Zeile[]>;
  for (const art of LISTEN) {
    for (const z of zeilenVon(roh, art)) {
      const { stand, ...rest } = z;
      if (typeof stand === 'string' && stand) staende.set(schluessel(art, z.id), stand);
      raus[art].push(rest as Zeile);
    }
  }
  return raus as unknown as TasksState;
}

/** Unterschied zweier Stände je Liste: geänderte/neue Einträge + gelöschte Kennungen, jeweils mit dem bekannten Serverstand. */
export function unterschied(alt: TasksState, neu: TasksState, staende: Staende): OpsJe {
  const raus = leereOps();
  for (const art of LISTEN) {
    const a = new Map(zeilenVon(alt, art).map(x => [x.id, JSON.stringify(x)]));
    const n = zeilenVon(neu, art);
    for (const x of n) if (a.get(x.id) !== JSON.stringify(x)) { const s = staende.get(schluessel(art, x.id)); raus[art].push({ op: 'upsert', eintrag: x, ...(s && a.has(x.id) ? { stand: s } : {}) }); }
    const ids = new Set(n.map(x => x.id));
    for (const id of a.keys()) if (!ids.has(id)) { const s = staende.get(schluessel(art, id)); raus[art].push({ op: 'delete', id, ...(s ? { stand: s } : {}) }); }
  }
  return raus;
}

/** Kennungen (`liste:id`) aller Änderungen. */
export function schluesselVon(ops: OpsJe): Set<string> {
  const s = new Set<string>();
  for (const art of LISTEN) for (const o of ops[art]) s.add(schluessel(art, opId(o)));
  return s;
}

/** Nur die Änderungen, deren Kennung (nicht) in `keys` liegt. */
export function filtern(ops: OpsJe, behalten: (k: string, o: Op) => boolean): OpsJe {
  const raus = leereOps();
  for (const art of LISTEN) raus[art] = ops[art].filter(o => behalten(schluessel(art, opId(o)), o));
  return raus;
}

/** Änderungen auf einen Stand legen (Upsert ersetzt/ergänzt die Zeile, Delete nimmt sie heraus). */
export function aufOps(basis: TasksState, ops: OpsJe): TasksState {
  const raus: Record<string, unknown> = { ...basis };
  for (const art of LISTEN) {
    if (!ops[art].length) { raus[art] = [...zeilenVon(basis, art)]; continue; }
    const m = new Map(zeilenVon(basis, art).map(x => [x.id, x]));
    for (const o of ops[art]) { if (o.op === 'delete') m.delete(o.id); else m.set(o.eintrag.id, o.eintrag); }
    raus[art] = Array.from(m.values());
  }
  return raus as unknown as TasksState;
}

/**
 * Neue/umgehängte Eltern vor ihren Kindern (06.10., Umwandeln „Liste → Aufgabe“ mit vielen Aufgaben): zeigt eine Aufgabe per
 * `parentId` auf eine andere Aufgabe DIESER Änderungen, reist die andere zuerst — sonst käme das Kind bei mehr als einem Paket
 * vor seinem Elternteil an (400 „Elternteil fehlt“). Sonst bleibt die Reihenfolge (stabil).
 */
export function elternZuerst(tasks: readonly Op[]): Op[] {
  const nach = new Map(tasks.filter(o => o.op === 'upsert').map(o => [opId(o), o]));
  const tiefe = (o: Op): number => {
    let n = 0;
    let x: Op | undefined = o;
    const gesehen = new Set<string>();
    while (x && x.op === 'upsert' && typeof x.eintrag.parentId === 'string' && !gesehen.has(x.eintrag.parentId) && n < 64) {
      gesehen.add(x.eintrag.parentId);
      x = nach.get(x.eintrag.parentId);
      if (x) n++;
    }
    return n;
  };
  return tasks.map((o, i) => ({ o, i, t: tiefe(o) })).sort((a, b) => a.t - b.t || a.i - b.i).map(x => x.o);
}

/** Pakete an den Server: Aufgaben zu höchstens `groesse` (Server-Grenze 200), die Struktur reist im ersten. */
export function pakete(ops: OpsJe, groesse = 150): OpsJe[] {
  const n = Math.max(1, Math.ceil(ops.tasks.length / groesse));
  const raus: OpsJe[] = [];
  const aufgaben = elternZuerst(ops.tasks);
  for (let i = 0; i < n; i++) {
    const p = leereOps();
    p.tasks = aufgaben.slice(i * groesse, i * groesse + groesse);
    if (i === 0) for (const a of STRUKTUR) p[a] = ops[a].slice(0, 190);
    if (anzahl(p)) raus.push(p);
  }
  // Mehr als 190 Struktur-Änderungen einer Art (selten): der Rest in eigenen Paketen.
  for (const a of STRUKTUR) for (let i = 190; i < ops[a].length; i += 190) { const p = leereOps(); p[a] = ops[a].slice(i, i + 190); raus.push(p); }
  return raus;
}

/** Ein Paket in Einzeländerungen zerlegen (nach 400/413 — so bleibt nur die schuldige Zeile liegen). */
export function einzeln(ops: OpsJe): OpsJe[] {
  const raus: OpsJe[] = [];
  // Struktur zuerst (06.10.): eine neue Liste muss vor den Aufgaben ankommen, die in sie umziehen (Umwandeln „Aufgabe → Liste“).
  for (const a of [...STRUKTUR, 'tasks'] as const) for (const o of (a === 'tasks' ? elternZuerst(ops.tasks) : ops[a])) { const p = leereOps(); p[a] = [o]; raus.push(p); }
  return raus;
}

/** Der Körper des PATCH an /api/state/tasks. */
export function koerper(p: OpsJe): Record<string, unknown> {
  const k: Record<string, unknown> = { ops: p.tasks };
  if (STRUKTUR.some(a => p[a].length)) k.struktur = { projekte: p.projects, listen: p.listen, status: p.statusEigen, vorlagen: p.vorlagen };
  return k;
}

/** Wartezeit bis zum nächsten Versuch (Netz weg, 5xx, Neustart beim Hochladen): 2 s, 4 s, 8 s … höchstens 60 s. */
export const wartezeit = (versuch: number): number => Math.min(60_000, 2_000 * 2 ** Math.max(0, Math.min(versuch, 10)));

/** Nur vorübergehend (erneut versuchen): kein Netz, 5xx, 429, 401 (Sitzung abgelaufen — nach dem Anmelden klappt es). */
export const voruebergehend = (status: number): boolean => status === 0 || status >= 500 || status === 429 || status === 401 || status === 408;

/** Zwei Fassungen einer Zeile gleich — ohne Zeitstempel und Verlauf (die setzt der Server)? */
export function gleichOhneZeit(a: unknown, b: unknown): boolean {
  if (!a || !b) return a === b;
  const ohne = (x: unknown) => { const { updatedAt: _u, verlauf: _v, stand: _s, ...r } = x as Record<string, unknown>; return JSON.stringify(r, Object.keys(r).sort()); };
  return ohne(a) === ohne(b);
}

/** Lesbare Fassung einer Zeile zum Kopieren („Deine Fassung“): Titel, Beschreibung, Notiz — ohne Technik. */
export function fassungText(z: Zeile | null | undefined): string {
  if (!z) return '(gelöscht)';
  const t = [z.title ?? z.titel ?? z.label, z.description, z.beschreibung, z.notiz].filter((x): x is string => typeof x === 'string' && !!x.trim());
  return t.length ? t.join('\n\n') : JSON.stringify(z, null, 2);
}

/** Anzeige-Titel einer Zeile. */
export const zeilenTitel = (z: Zeile | null | undefined, rueck = 'Eintrag'): string => {
  const t = z && (z.title ?? z.titel ?? z.label);
  return typeof t === 'string' && t.trim() ? t.trim() : rueck;
};

/** Sitzungsspeicher-Form der ausstehenden Änderungen (überlebt „bitte neu laden“ und Abstürze im selben Tab). */
export interface AusstehendGemerkt { am: string; person: string; zeilen: { liste: ListenArt; id: string; eintrag: Zeile | null; stand?: string }[] }

export function merkenAus(ops: OpsJe, person: string, am: string): AusstehendGemerkt {
  const zeilen: AusstehendGemerkt['zeilen'] = [];
  for (const art of LISTEN) for (const o of ops[art]) zeilen.push({ liste: art, id: opId(o), eintrag: o.op === 'upsert' ? o.eintrag : null, ...(o.stand ? { stand: o.stand } : {}) });
  return { am, person, zeilen };
}

/** Gemerkte Zeilen wieder als Änderungen (nur gültige Form; älter als `maxTage` → nichts). */
export function gemerktAlsOps(g: unknown, person: string, jetztMs: number, maxTage = 7): { ops: OpsJe; staende: [string, string][] } | null {
  if (!g || typeof g !== 'object') return null;
  const x = g as Partial<AusstehendGemerkt>;
  if (x.person !== person || typeof x.am !== 'string' || !Array.isArray(x.zeilen)) return null;
  const am = Date.parse(x.am);
  if (!Number.isFinite(am) || jetztMs - am > maxTage * 86_400_000) return null;
  const ops = leereOps();
  const staende: [string, string][] = [];
  for (const z of x.zeilen) {
    if (!z || !LISTEN.includes(z.liste) || typeof z.id !== 'string' || !z.id) continue;
    if (z.eintrag && (typeof z.eintrag !== 'object' || z.eintrag.id !== z.id)) continue;
    ops[z.liste].push(z.eintrag ? { op: 'upsert', eintrag: z.eintrag } : { op: 'delete', id: z.id });
    if (typeof z.stand === 'string' && z.stand) staende.push([schluessel(z.liste, z.id), z.stand]);
  }
  return anzahl(ops) ? { ops, staende } : null;
}
