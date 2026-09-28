// ─── MAKE OS — „Neu anfangen“ (Server, 29.09.) ─────────────────────────────
// Kevin 29.09.: „Morgen alle Ziele und Aufgaben rausnehmen und neu planen.“ Ein Lauf archiviert — nie löschen:
//   1. Sicherheitskopie der betroffenen Bestände (roh) über `archivSchreiben` (verschlüsselt wie alles).
//   2. Lauf-Protokoll `planung-neustart--<haushalt>` anlegen (Kennung `na-…` kommt aus dem Browser: wer nach einem
//      Netzfehler erneut drückt, setzt DENSELBEN Lauf fort — idempotent).
//   3. Aufgaben: in EINER Sperre auf „tasks“ markieren (lib/aufgaben/neustart.ts), Serien ruhen. Ziele (geteilt +
//      persönlich je Person des Haushalts) und Meilensteine: in der Sperre ihres Bestands herausnehmen — das Protokoll
//      wird INNEN (vor dem Schreiben des Bestands) fortgeschrieben, damit nie etwas nur im Kopf des Servers liegt.
//   4. Meldungen zu archivierten Aufgaben als gelesen (Glocke), Änderungsprotokoll ohne Werte, Lauf „fertig“.
// Zurückholen (ganz oder einzeln) läuft denselben Weg rückwärts; Sperr-Reihenfolge immer Bestand außen → Protokoll innen.
// CRM (Follow-ups, Deals), Routinen, Blöcke, Vorlagen, eigene Status und der Papierkorb bleiben unberührt.

import { loadJson, updateJson, updateJsonAsync } from '@/lib/store/local-db';
import { archivSchreiben, archivZeit } from '@/lib/store/archiv';
import { protokolliere, type Aenderung, type Wer } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { speicherFuer } from '@/lib/zoe/raum';
import { karteiHaushalt } from '@/lib/crm/sperrliste';
import { meldungenSicht, meldungenGelesen } from '@/lib/meldungen/speicher';
import type { TasksState } from '@/types/tasks';
import { uebernehmen } from './struktur';
import { alsStand, orgZuordnung } from './sicht';
import { aufgabenSchreiben, AUFGABEN_BESTAND } from './umbau';
import {
  aufgabenArchivieren, aufgabenZurueck, aufgabenVorschau, imArchiv, leerErfasst, LAUF_ID,
  type AufgabenAuswahl, type AufgabenErfasst, type AufgabenVorschau,
} from './neustart';
import {
  zieleHerausnehmen, zieleZurueck, zieleZahl, zieleDatei, meilensteineHerausnehmen, meilensteineZurueck, meilensteineDatei,
  type ArchivFokus, type ArchivMeilenstein, type ArchivZiel,
} from '@/lib/planung/neustart';
import { ZIEL_HORIZONTE, type ZielHorizont } from '@/lib/planung/typen';

export const MEILENSTEINE_BESTAND = 'meilensteine';
export const ZIELE_BESTAND = 'ziele';
export const neustartSpeicher = (haushalt: string) => `planung-neustart--${haushalt}`;

export interface NeustartZurueck { art: 'alles' | 'projekt' | 'aufgabe' | 'ziel' | 'meilenstein'; id: string; am: string; von: string }
export interface NeustartLauf {
  id: string;
  am: string;
  von: string;
  status: 'begonnen' | 'fertig';
  /** Name der Sicherheitskopie im Archiv (vorher, roh). */
  kopie?: string;
  aufgaben: AufgabenErfasst;
  ziele: ArchivZiel[];
  fokus: ArchivFokus[];
  meilensteine: ArchivMeilenstein[];
  meldungenGelesen: number;
  zurueck: NeustartZurueck[];
}
interface NeustartBestand { laeufe: NeustartLauf[] }

const bestand = (roh: NeustartBestand | null | undefined): NeustartBestand => ({ laeufe: Array.isArray(roh?.laeufe) ? roh!.laeufe : [] });

/** Die Personen des Haushalts (Speichernamen) — je Person gibt es einen persönlichen Ziele-Bestand. */
async function haushaltsPersonen(): Promise<string[]> {
  const { konten } = await ladeKonten();
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  if (!inhaber) return [];
  return konten.filter(k => k.speicher === inhaber.speicher || (!!inhaber.haushalt && k.haushalt === inhaber.haushalt)).map(k => k.speicher);
}

/** Alle Ziele-Bestände des Haushalts: der geteilte + je Person der eigene. */
export async function zieleBestaende(): Promise<string[]> {
  return Array.from(new Set([ZIELE_BESTAND, ...(await haushaltsPersonen()).map(p => speicherFuer('ziele-eigen', p))]));
}

// ── Vorschau ──────────────────────────────────────────────────────────────

export interface NeustartVorschau extends AufgabenVorschau {
  ziele: number;
  /** Ziele je Horizont (über alle Bestände). */
  zieleJe: Record<ZielHorizont, number>;
  meilensteine: number;
  fokus: number;
}

export async function neustartVorschau(): Promise<NeustartVorschau> {
  const orgs = await orgZuordnung();
  const tasks = uebernehmen(alsStand(await loadJson<TasksState>(AUFGABEN_BESTAND)), orgs).state;
  const zieleJe = Object.fromEntries(ZIEL_HORIZONTE.map(h => [h, 0])) as Record<ZielHorizont, number>;
  let ziele = 0, fokus = 0;
  for (const s of await zieleBestaende()) {
    const d = zieleDatei(await loadJson<unknown>(s));
    ziele += zieleZahl(d);
    for (const h of ZIEL_HORIZONTE) zieleJe[h] += d[h].length;
    fokus += Object.values(d.fokus ?? {}).filter(v => typeof v === 'string' && v.trim()).length;
  }
  const meilensteine = meilensteineDatei(await loadJson<unknown>(MEILENSTEINE_BESTAND)).meilensteine.length;
  return { ...aufgabenVorschau(tasks), ziele, zieleJe, meilensteine, fokus };
}

// ── Neu anfangen ──────────────────────────────────────────────────────────

export class NeustartFehler extends Error { constructor(msg: string, readonly status = 400) { super(msg); } }

const vereint = (a: readonly string[], b: readonly string[]) => Array.from(new Set([...a, ...b]));
function erfasstVereinen(a: AufgabenErfasst, b: AufgabenErfasst): AufgabenErfasst {
  const schon = new Set(a.pausiert.map(p => `${p.art}:${p.id}`));
  return {
    projekte: vereint(a.projekte, b.projekte), gruppen: vereint(a.gruppen, b.gruppen), listen: vereint(a.listen, b.listen), aufgaben: vereint(a.aufgaben, b.aufgaben),
    pausiert: [...a.pausiert, ...b.pausiert.filter(p => !schon.has(`${p.art}:${p.id}`))],
  };
}
const zielSchluessel = (z: Pick<ArchivZiel, 'speicher' | 'horizont'> & { ziel: { id: string } }) => `${z.speicher}|${z.horizont}|${z.ziel.id}`;

export interface NeustartErgebnis { lauf: NeustartLauf; schon: boolean }

/**
 * Den Neustart ausführen (oder einen abgebrochenen Lauf mit derselben Kennung fortsetzen). Wirft `NeustartFehler`.
 * `person` = wer gedrückt hat (Haushalt des Inhabers, von der Route geprüft).
 */
export async function neuAnfangen(o: { laufId: string; person: string; wer?: Wer; jetzt?: Date }): Promise<NeustartErgebnis> {
  if (!LAUF_ID.test(o.laufId)) throw new NeustartFehler('Ungültige Lauf-Kennung.');
  const jetzt = (o.jetzt ?? new Date()).toISOString();
  const name = neustartSpeicher(await karteiHaushalt());
  const vorhanden = bestand(await loadJson<NeustartBestand>(name)).laeufe.find(l => l.id === o.laufId);
  if (vorhanden?.status === 'fertig') return { lauf: vorhanden, schon: true };
  const zielSpeicher = await zieleBestaende();

  // 1 + 2: Sicherheitskopie (vorher, roh) und Lauf anlegen — nur beim ersten Anlauf dieser Kennung.
  if (!vorhanden) {
    const kopie = {
      tasks: await loadJson<unknown>(AUFGABEN_BESTAND),
      meilensteine: await loadJson<unknown>(MEILENSTEINE_BESTAND),
      ziele: Object.fromEntries(await Promise.all(zielSpeicher.map(async s => [s, await loadJson<unknown>(s)] as const))),
    };
    const datei = await archivSchreiben(`neustart-${o.laufId}-${archivZeit(jetzt)}.json`, kopie);
    await updateJson<NeustartBestand>(name, cur => {
      const b = bestand(cur);
      if (b.laeufe.some(l => l.id === o.laufId)) return b;
      const lauf: NeustartLauf = { id: o.laufId, am: jetzt, von: o.person, status: 'begonnen', kopie: datei, aufgaben: leerErfasst(), ziele: [], fokus: [], meilensteine: [], meldungenGelesen: 0, zurueck: [] };
      return { laeufe: [...b.laeufe, lauf] };
    });
  }
  const laufAendern = (f: (l: NeustartLauf) => NeustartLauf) => updateJson<NeustartBestand>(name, cur => {
    const b = bestand(cur);
    return { laeufe: b.laeufe.map(l => (l.id === o.laufId ? f(l) : l)) };
  });

  // 3a: Aufgaben — eine Sperre auf „tasks“, das Protokoll des Laufs innen.
  const orgs = await orgZuordnung();
  let erfasst = leerErfasst();
  await aufgabenSchreiben(async roh => {
    if (!roh) return roh;
    const basis = uebernehmen(alsStand(roh), orgs).state;
    const r = aufgabenArchivieren(basis, o.laufId, jetzt);
    erfasst = r.erfasst;
    if (r.state === basis) return roh;
    await laufAendern(l => ({ ...l, aufgaben: erfasstVereinen(l.aufgaben, r.erfasst) }));
    return r.state;
  }, jetzt);

  // 3b: Ziele (geteilt + persönlich) und Fokus.
  const zieleProtokoll: { speicher: string; ids: string[] }[] = [];
  for (const s of zielSpeicher) {
    if ((await loadJson<unknown>(s)) === null) continue;
    await updateJsonAsync<Record<string, unknown>>(s, async cur => {
      const r = zieleHerausnehmen(cur, s);
      if (!r.ziele.length && !r.fokus) return cur as Record<string, unknown>;
      await laufAendern(l => {
        const schon = new Set(l.ziele.map(zielSchluessel));
        return { ...l, ziele: [...l.ziele, ...r.ziele.filter(z => !schon.has(zielSchluessel(z)))], fokus: r.fokus ? [...l.fokus, r.fokus] : l.fokus };
      });
      zieleProtokoll.push({ speicher: s, ids: r.ziele.map(z => z.ziel.id) });
      return r.rest;
    });
  }

  // 3c: Meilensteine.
  let msIds: string[] = [];
  if ((await loadJson<unknown>(MEILENSTEINE_BESTAND)) !== null) {
    await updateJsonAsync<Record<string, unknown>>(MEILENSTEINE_BESTAND, async cur => {
      const r = meilensteineHerausnehmen(cur);
      if (!r.raus.length) return cur as Record<string, unknown>;
      await laufAendern(l => {
        const schon = new Set(l.meilensteine.map(m => m.meilenstein.id));
        return { ...l, meilensteine: [...l.meilensteine, ...r.raus.filter(m => !schon.has(m.meilenstein.id))] };
      });
      msIds = r.raus.map(m => m.meilenstein.id);
      return r.rest;
    });
  }

  // 4: Meldungen zu archivierten Aufgaben gelesen, Änderungsprotokoll, fertig.
  const endLauf = bestand(await loadJson<NeustartBestand>(name)).laeufe.find(l => l.id === o.laufId);
  const gelesen = await meldungenLesen(new Set(endLauf?.aufgaben.aufgaben ?? erfasst.aufgaben));
  await protokollAufgaben(erfasst, ['archiviertAm', 'archivId'], o.wer);
  for (const z of zieleProtokoll) await protokolliere(z.speicher, z.ids.map(id => ({ op: 'geloescht' as const, id, felder: ['neustart'] })), o.wer);
  if (msIds.length) await protokolliere(MEILENSTEINE_BESTAND, msIds.map(id => ({ op: 'geloescht' as const, id, felder: ['neustart'] })), o.wer);
  const fertig = await laufAendern(l => ({ ...l, status: 'fertig', meldungenGelesen: l.meldungenGelesen + gelesen }));
  return { lauf: fertig.laeufe.find(l => l.id === o.laufId)!, schon: false };
}

/** Ungelesene Meldungen (Glocke) zu diesen Aufgaben für jede Person des Haushalts als gelesen markieren. Wirft nie. */
async function meldungenLesen(aufgaben: ReadonlySet<string>): Promise<number> {
  if (!aufgaben.size) return 0;
  let n = 0;
  for (const p of await haushaltsPersonen()) {
    try {
      const sicht = await meldungenSicht(p);
      const ids = sicht.meldungen.filter(m => !m.gelesen && !m.virtuell && m.bezug?.art === 'aufgabe' && aufgaben.has(m.bezug.id)).map(m => m.id);
      if (ids.length) { await meldungenGelesen(p, { ids }); n += ids.length; }
    } catch { /* Glocke ist Beiwerk — der Neustart hängt nicht an ihr */ }
  }
  return n;
}

async function protokollAufgaben(e: Pick<AufgabenErfasst, 'projekte' | 'gruppen' | 'listen' | 'aufgaben'>, felder: string[], wer?: Wer): Promise<void> {
  const a: Aenderung[] = [
    ...e.projekte.map(id => ({ liste: 'projects', op: 'geaendert' as const, id, felder })),
    ...e.gruppen.map(id => ({ liste: 'gruppen', op: 'geaendert' as const, id, felder })),
    ...e.listen.map(id => ({ liste: 'listen', op: 'geaendert' as const, id, felder })),
    ...e.aufgaben.map(id => ({ liste: 'tasks', op: 'geaendert' as const, id, felder })),
  ];
  await protokolliere(AUFGABEN_BESTAND, a, wer);
}

// ── Archiv lesen ──────────────────────────────────────────────────────────

export interface ArchivAufgabe { id: string; titel: string; spaceId?: string; projektId: string; erledigt: boolean; unter: number; zurueck: boolean }
export interface ArchivProjekt { id: string; titel: string; spaceId?: string; farbe?: string; aufgaben: number; zurueck: boolean }
export interface ArchivLaufSicht {
  id: string; am: string; von: string; status: NeustartLauf['status'];
  projekte: ArchivProjekt[];
  /** Hauptaufgaben ohne archiviertes Projekt (Sonstige oder ein Projekt, das stehen blieb). */
  aufgaben: ArchivAufgabe[];
  ziele: { speicher: string; horizont: ZielHorizont; id: string; titel: string; erledigt: boolean; zurueck: boolean }[];
  meilensteine: { id: string; titel: string; faellig?: string; erledigt: boolean; zurueck: boolean }[];
  serien: { art: 'aufgabe' | 'liste'; titel: string; regel: string; zurueck: boolean }[];
  /** Noch im Archiv (für „Alles zurückholen“). */
  offen: number;
}

/** Die Läufe des Haushalts für die Ansicht „Archiv“, neueste zuerst — Titel aus dem aktuellen Bestand. */
export async function neustartArchiv(): Promise<ArchivLaufSicht[]> {
  const name = neustartSpeicher(await karteiHaushalt());
  const laeufe = bestand(await loadJson<NeustartBestand>(name)).laeufe;
  if (!laeufe.length) return [];
  const tasks = uebernehmen(alsStand(await loadJson<TasksState>(AUFGABEN_BESTAND)), await orgZuordnung()).state;
  const projektNach = new Map(tasks.projects.map(p => [p.id, p]));
  return laeufe.slice().reverse().map(l => {
    const vomLauf = (x: { archiviertAm?: string; archivId?: string } | undefined) => !!x && imArchiv(x) && x.archivId === l.id;
    const archivierteProjekte = new Set(l.aufgaben.projekte);
    const projekte: ArchivProjekt[] = l.aufgaben.projekte.map(id => projektNach.get(id)).filter((p): p is NonNullable<typeof p> => !!p).map(p => ({
      id: p.id, titel: p.title, ...(p.spaceId ? { spaceId: p.spaceId } : {}), farbe: p.color,
      aufgaben: tasks.tasks.filter(t => t.projectId === p.id && !t.parentId && vomLauf(t)).length, zurueck: !vomLauf(p),
    }));
    const inLauf = new Set(l.aufgaben.aufgaben);
    const aufgaben: ArchivAufgabe[] = tasks.tasks
      .filter(t => inLauf.has(t.id) && !t.parentId && (!archivierteProjekte.has(t.projectId) || !vomLauf(projektNach.get(t.projectId))))
      .map(t => ({ id: t.id, titel: t.title, ...(t.spaceId ? { spaceId: t.spaceId } : {}), projektId: t.projectId, erledigt: t.status === 'done' || t.status === 'cancelled', unter: tasks.tasks.filter(u => u.parentId === t.id && inLauf.has(u.id)).length, zurueck: !vomLauf(t) }));
    const ziele = l.ziele.map(z => ({ speicher: z.speicher, horizont: z.horizont, id: z.ziel.id, titel: z.ziel.titel, erledigt: !!z.ziel.erledigt, zurueck: !!z.zurueckAm }));
    const meilensteine = l.meilensteine.map(m => ({ id: m.meilenstein.id, titel: m.meilenstein.titel, ...(m.meilenstein.faellig ? { faellig: m.meilenstein.faellig } : {}), erledigt: !!m.meilenstein.erledigt, zurueck: !!m.zurueckAm }));
    const nachId = new Map(tasks.tasks.map(t => [t.id, t]));
    const listeNach = new Map((tasks.listen ?? []).map(x => [x.id, x]));
    const serien = l.aufgaben.pausiert.map(s => ({ art: s.art, titel: s.titel, regel: s.wiederholung.regel, zurueck: s.art === 'liste' ? !vomLauf(listeNach.get(s.id)) : !vomLauf(nachId.get(s.id)) }));
    const offen = tasks.tasks.filter(vomLauf).length + tasks.projects.filter(vomLauf).length + ziele.filter(z => !z.zurueck).length + meilensteine.filter(m => !m.zurueck).length;
    return { id: l.id, am: l.am, von: l.von, status: l.status, projekte, aufgaben, ziele, meilensteine, serien, offen };
  });
}

// ── Zurückholen ───────────────────────────────────────────────────────────

export type NeustartAuswahl = AufgabenAuswahl | { art: 'ziel'; speicher: string; horizont: ZielHorizont; id: string } | { art: 'meilenstein'; id: string };
export interface ZurueckBericht { aufgaben: number; projekte: number; ziele: number; meilensteine: number; schon: number }

/** Ganz oder einzeln zurückholen. Idempotent: schon Zurückgeholtes zählt als `schon`/0. */
export async function neustartZurueck(o: { laufId: string; auswahl: NeustartAuswahl; person: string; wer?: Wer; jetzt?: Date }): Promise<ZurueckBericht> {
  if (!LAUF_ID.test(o.laufId)) throw new NeustartFehler('Ungültige Lauf-Kennung.');
  const jetzt = (o.jetzt ?? new Date()).toISOString();
  const name = neustartSpeicher(await karteiHaushalt());
  const lauf = bestand(await loadJson<NeustartBestand>(name)).laeufe.find(l => l.id === o.laufId);
  if (!lauf) throw new NeustartFehler('Diesen Neustart gibt es nicht (mehr).', 404);
  const a = o.auswahl;
  const bericht: ZurueckBericht = { aufgaben: 0, projekte: 0, ziele: 0, meilensteine: 0, schon: 0 };
  const merke = (art: NeustartZurueck['art'], id: string) => ({ art, id, am: jetzt, von: o.person });
  const laufAendern = (f: (l: NeustartLauf) => NeustartLauf) => updateJson<NeustartBestand>(name, cur => {
    const b = bestand(cur);
    return { laeufe: b.laeufe.map(l => (l.id === o.laufId ? f(l) : l)) };
  });

  // Aufgaben (alles | projekt | aufgabe)
  if (a.art === 'alles' || a.art === 'projekt' || a.art === 'aufgabe') {
    const orgs = await orgZuordnung();
    let erg: { projekte: string[]; gruppen: string[]; listen: string[]; aufgaben: string[] } = { projekte: [], gruppen: [], listen: [], aufgaben: [] };
    await aufgabenSchreiben(async roh => {
      if (!roh) return roh;
      const basis = uebernehmen(alsStand(roh), orgs).state;
      const r = aufgabenZurueck(basis, o.laufId, a, lauf.aufgaben.pausiert);
      erg = r;
      if (r.state === basis) return roh;
      await laufAendern(l => ({ ...l, zurueck: [...l.zurueck, merke(a.art, a.art === 'alles' ? '*' : a.id)] }));
      return r.state;
    }, jetzt);
    bericht.aufgaben = erg.aufgaben.length; bericht.projekte = erg.projekte.length;
    if (erg.aufgaben.length || erg.projekte.length || erg.listen.length || erg.gruppen.length) await protokollAufgaben(erg, ['archiviertAm', 'archivId'], o.wer);
  }

  // Ziele (alles | ziel)
  if (a.art === 'alles' || a.art === 'ziel') {
    const gewaehlt = lauf.ziele.filter(z => !z.zurueckAm && (a.art === 'alles' || (z.speicher === a.speicher && z.horizont === a.horizont && z.ziel.id === a.id)));
    const speicherListe = Array.from(new Set([...gewaehlt.map(z => z.speicher), ...(a.art === 'alles' ? lauf.fokus.filter(f => !f.zurueckAm).map(f => f.speicher) : [])]));
    for (const s of speicherListe) {
      const eintraege = gewaehlt.filter(z => z.speicher === s);
      const fokus = a.art === 'alles' ? lauf.fokus.find(f => f.speicher === s && !f.zurueckAm) ?? null : null;
      await updateJsonAsync<Record<string, unknown>>(s, async cur => {
        const r = zieleZurueck(cur, eintraege, fokus);
        bericht.ziele += r.zurueck.length; bericht.schon += r.schon.length;
        const erledigt = new Set([...r.zurueck, ...r.schon]);
        await laufAendern(l => ({
          ...l,
          ziele: l.ziele.map(z => (z.speicher === s && !z.zurueckAm && erledigt.has(z.ziel.id) && eintraege.some(e => e.horizont === z.horizont && e.ziel.id === z.ziel.id) ? { ...z, zurueckAm: jetzt } : z)),
          fokus: fokus ? l.fokus.map(f => (f.speicher === s && !f.zurueckAm ? { ...f, zurueckAm: jetzt } : f)) : l.fokus,
          zurueck: r.zurueck.length ? [...l.zurueck, ...(a.art === 'ziel' ? [merke('ziel', a.id)] : [])] : l.zurueck,
        }));
        if (r.zurueck.length) await protokolliere(s, r.zurueck.map(id => ({ op: 'neu' as const, id, felder: ['neustart-zurueck'] })), o.wer);
        return r.datei;
      });
    }
  }

  // Meilensteine (alles | meilenstein)
  if (a.art === 'alles' || a.art === 'meilenstein') {
    const gewaehlt = lauf.meilensteine.filter(m => !m.zurueckAm && (a.art === 'alles' || m.meilenstein.id === a.id));
    if (gewaehlt.length) {
      await updateJsonAsync<Record<string, unknown>>(MEILENSTEINE_BESTAND, async cur => {
        const r = meilensteineZurueck(cur, gewaehlt);
        bericht.meilensteine += r.zurueck.length; bericht.schon += r.schon.length;
        const erledigt = new Set([...r.zurueck, ...r.schon]);
        await laufAendern(l => ({
          ...l,
          meilensteine: l.meilensteine.map(m => (!m.zurueckAm && erledigt.has(m.meilenstein.id) ? { ...m, zurueckAm: jetzt } : m)),
          zurueck: r.zurueck.length && a.art === 'meilenstein' ? [...l.zurueck, merke('meilenstein', a.id)] : l.zurueck,
        }));
        if (r.zurueck.length) await protokolliere(MEILENSTEINE_BESTAND, r.zurueck.map(id => ({ op: 'neu' as const, id, felder: ['neustart-zurueck'] })), o.wer);
        return r.datei;
      });
    }
  }
  return bericht;
}
