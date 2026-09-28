// ─── Dateien an Projekten und Aufgaben · verschlüsselt je Haushalt (Server, 28.09. C2) ───
// Dieselbe Ablage wie die CRM-Dateien (lib/dateien/ablage.ts) — nur ein eigener Metadaten-Bestand:
//
//   Inhalt:     <daten>/dateien/<haushalt>/<id>.bin   (gleicher Ordner, gleiche Hülle MKOSDAT1, gleiche Kennungen d-…)
//   Metadaten:  Bestand `aufgaben-dateien--<haushalt>` (local-db, wie jeder Bestand verschlüsselt)
//
// Warum ein eigener Bestand: ZOE darf diese Dateien lesen (Kevins Wahl, 28.09.), die CRM-Ablage nie. Getrennte
// Bestände machen die Grenze zur Bauform — kein Filter, den man vergessen kann: das ZOE-Werkzeug kennt nur diesen
// Bestand, die CRM-Route nur ihren. `scripts/daten-verschluesselung.mjs` stellt beide mit um (alle *.json, alle
// dateien/<haushalt>/d-*.bin), die Verbindungsprüfung kennt beide (keine „Datei ohne Eintrag“).
//
// Bezug: jeder Eintrag hängt an einem Projekt (Pflicht) und optional an einer Aufgabe dieses Projekts; beide
// müssen im Aufgaben-Bestand stehen (oder das Projekt ist „Sonstige“ eines Space). Der Bereich (privat/business)
// kommt aus dem Space — der Browser nennt ihn mit, weicht er ab: 409. Änderungsprotokoll ohne Inhalte, dazu bei
// Dateien an einer Aufgabe ein Eintrag im Verlauf der Aufgabe („Datei hinzugefügt/entfernt“, lib/aufgaben/verlauf.ts).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { protokolliere, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { HAUSHALT_OK } from '@/lib/finanzen/haushalt/zugriff';
import type { Kontakt } from '@/lib/make-one/crm';
import { ladeAufgaben, AUFGABEN_SPEICHER } from '@/lib/aufgaben/speicher';
import { verlaufAnhaengen } from '@/lib/aufgaben/verlauf';
import type { TasksState } from '@/types/tasks';
import { bereichVonSpace, istSonstigeProjekt, SONSTIGE_PRAEFIX } from '@/lib/aufgaben/struktur';
import { einwilligungenMitBeleg, belegGesperrtText } from './einwilligung-beleg';
import { AblageFehler, inhaltAblegen, inhaltEntfernen, inhaltLaden, neueDateiId } from './ablage';
import { DATEI_ID, dateinameSaeubern, endung, type DateiEintrag } from './regeln';
import { AUFGABEN_DATEI_PRAEFIX, MAX_AUFGABEN_EINTRAEGE, aufgabenMetaSaeubern, type AufgabenDateiTyp, type Bereich } from './aufgaben-regeln';

export const aufgabenAblageName = (haushalt: string) => {
  if (!HAUSHALT_OK.test(haushalt)) throw new AblageFehler('Unzulässiger Haushalt.', 400);
  return `${AUFGABEN_DATEI_PRAEFIX}${haushalt}`;
};

/** Ein Eintrag der Aufgaben-Ablage: immer mit Projekt, Bereich und Datei. */
export type AufgabenDatei = DateiEintrag & { projektId: string; bereich: Bereich; datei: NonNullable<DateiEintrag['datei']> };
interface AblageDatei { eintraege: AufgabenDatei[] }

/** Alle Einträge des Haushalts (nur Metadaten). */
export async function aufgabenDateienListe(haushalt: string): Promise<AufgabenDatei[]> {
  return (await loadJson<AblageDatei>(aufgabenAblageName(haushalt)))?.eintraege ?? [];
}

export interface AufgabenBezug { projektId: string; aufgabeId?: string; bereich: Bereich; projektTitel?: string; aufgabeTitel?: string }

/**
 * Projekt/Aufgabe im Aufgaben-Bestand nachsehen und den Bereich aus dem Space ableiten. Aufgabe gegeben → sie muss
 * es geben, und ein genanntes Projekt muss ihres sein. Sonst Projekt Pflicht: vorhanden oder „Sonstige“ eines Space.
 */
export async function bezugAufloesen(projektId: string | undefined, aufgabeId: string | undefined): Promise<AufgabenBezug> {
  const state = await ladeAufgaben();
  if (aufgabeId) {
    const t = state.tasks.find(x => x.id === aufgabeId);
    if (!t) throw new AblageFehler('Diese Aufgabe gibt es nicht (mehr).', 404);
    if (projektId && projektId !== t.projectId) throw new AblageFehler('Die Aufgabe gehört zu einem anderen Projekt.', 400);
    const p = state.projects.find(x => x.id === t.projectId);
    return { projektId: t.projectId, aufgabeId, bereich: bereichVonSpace(t.spaceId ?? p?.spaceId), ...(p ? { projektTitel: p.title } : {}), aufgabeTitel: t.title };
  }
  if (!projektId) throw new AblageFehler('Bezug fehlt (Projekt oder Aufgabe).', 400);
  const p = state.projects.find(x => x.id === projektId);
  if (p) return { projektId, bereich: bereichVonSpace(p.spaceId), projektTitel: p.title };
  if (istSonstigeProjekt(projektId)) return { projektId, bereich: bereichVonSpace(projektId.slice(SONSTIGE_PRAEFIX.length)), projektTitel: 'Sonstige' };
  throw new AblageFehler('Dieses Projekt gibt es nicht (mehr).', 404);
}

const NICHTS = Symbol('nichts-zu-schreiben');

/**
 * Änderungsprotokoll (nur Kennung + Feldnamen, nie Dateinamen oder Inhalte) und — bei Dateien an einer Aufgabe —
 * ein Eintrag im Verlauf der Aufgabe (`was: 'datei'`, `feld: 'neu' | 'entfernt'`; lib/aufgaben/verlauf.ts). Der
 * Verlauf ändert den Stand der Aufgabe: die Oberfläche lädt danach neu (ProjektDateien → `rehydrate`).
 * Ein Fehler hier bricht das Ablegen/Löschen nicht (es ist schon geschehen).
 */
async function verlauf(haushalt: string, a: Aenderung, bezug: { aufgabeId?: string }, person: string, jetzt: string) {
  await protokolliere(aufgabenAblageName(haushalt), [{ ...a, liste: 'dateien' }], { art: 'person', person });
  if (!bezug.aufgabeId || a.op === 'geaendert') return;
  const feld = a.op === 'neu' ? 'neu' : 'entfernt';
  try {
    await updateJson<TasksState>(AUFGABEN_SPEICHER, cur => {
      const i = Array.isArray(cur?.tasks) ? cur!.tasks.findIndex(t => t.id === bezug.aufgabeId) : -1;
      if (!cur || i < 0) throw NICHTS;
      const t = cur.tasks[i];
      const tasks = cur.tasks.slice();
      tasks[i] = { ...t, verlauf: verlaufAnhaengen(t.verlauf, [{ am: jetzt, von: person, was: 'datei', feld }]) };
      return { ...cur, tasks };
    });
  } catch (e) {
    if (e !== NICHTS) console.error('[aufgaben/dateien] Verlauf nicht geschrieben —', e instanceof Error ? e.message : e);
  }
}

export interface NeueAufgabenDatei { bytes: Buffer; name: string; typ: AufgabenDateiTyp }

/**
 * Ablegen: Bezug prüfen, Bereich ableiten (abweichende Angabe → 409), erst den Inhalt (verschlüsselt), dann den
 * Eintrag. Scheitert der Eintrag, wird der Inhalt wieder entfernt — keine verwaisten Dateien.
 */
export async function aufgabenDateiAblegen(haushalt: string, person: string, metaRoh: unknown, datei: NeueAufgabenDatei, jetzt = new Date().toISOString()): Promise<AufgabenDatei> {
  const meta = aufgabenMetaSaeubern(metaRoh);
  const bezug = await bezugAufloesen(meta.projektId, meta.aufgabeId);
  if (meta.bereich && meta.bereich !== bezug.bereich) throw new AblageFehler(`Das Projekt liegt im Bereich ${bezug.bereich === 'privat' ? 'Privat' : 'Business'} — Privat und Business bleiben getrennt.`, 409);
  const id = neueDateiId();
  const verschluesselt = await inhaltAblegen(haushalt, id, datei.bytes);
  const eintrag: AufgabenDatei = {
    id, art: 'sonstig', projektId: bezug.projektId, ...(bezug.aufgabeId ? { aufgabeId: bezug.aufgabeId } : {}), bereich: bezug.bereich,
    datei: { name: datei.name, typ: datei.typ, groesse: datei.bytes.length, verschluesselt },
    ...(meta.notiz ? { notiz: meta.notiz } : {}), hochgeladenAm: jetzt, hochgeladenVon: person,
  };
  try {
    await updateJson<AblageDatei>(aufgabenAblageName(haushalt), cur => {
      const l = cur?.eintraege ?? [];
      if (l.length >= MAX_AUFGABEN_EINTRAEGE) throw new AblageFehler(`Ablage voll (${MAX_AUFGABEN_EINTRAEGE} Einträge).`, 409);
      return { eintraege: [...l, eintrag] };
    });
  } catch (e) {
    await inhaltEntfernen(haushalt, id);
    throw e;
  }
  await verlauf(haushalt, { op: 'neu', id }, eintrag, person, jetzt);
  return eintrag;
}

/** Umbenennen (Endung bleibt — sie bestimmt der Inhalt) und Beschreibung. Bezug, Bereich, Datei und Herkunft bleiben. */
export async function aufgabenDateiAendern(haushalt: string, person: string, id: string, felder: unknown, jetzt = new Date().toISOString()): Promise<AufgabenDatei | null> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const f = (felder && typeof felder === 'object' ? felder : {}) as Record<string, unknown>;
  let vorher: AufgabenDatei | null = null;
  let nachher: AufgabenDatei | null = null;
  const geaendert: string[] = [];
  await updateJson<AblageDatei>(aufgabenAblageName(haushalt), cur => ({
    eintraege: (cur?.eintraege ?? []).map(e => {
      if (e.id !== id) return e;
      vorher = e;
      geaendert.length = 0;
      const n: AufgabenDatei = { ...e, datei: { ...e.datei } };
      if (typeof f.name === 'string' && f.name.trim()) {
        const e0 = endung(e.datei.name) || 'pdf';
        const roh = f.name.trim();
        const stamm = roh.toLowerCase().endsWith(`.${e0}`) ? roh.slice(0, -(e0.length + 1)) : roh;
        const name = dateinameSaeubern(`${stamm}.${e0}`, e0);
        if (name !== e.datei.name) { n.datei.name = name; geaendert.push('name'); }
      }
      if ('notiz' in f || 'beschreibung' in f) {
        const notiz = aufgabenMetaSaeubern({ notiz: f.notiz ?? f.beschreibung }).notiz;
        if (notiz !== e.notiz) { if (notiz) n.notiz = notiz; else delete n.notiz; geaendert.push('notiz'); }
      }
      if (!geaendert.length) return e;
      nachher = { ...n, geaendert: jetzt, geaendertVon: person };
      return nachher;
    }),
  }));
  const neu = nachher as AufgabenDatei | null;
  if (neu) await verlauf(haushalt, { op: 'geaendert', id, felder: [...geaendert] }, neu, person, jetzt);
  return neu ?? vorher;
}

/** Eintrag + entschlüsselter Inhalt — null, wenn es ihn nicht gibt oder die Datei fehlt. */
export async function aufgabenDateiLesen(haushalt: string, id: string): Promise<{ eintrag: AufgabenDatei; bytes: Buffer } | null> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const eintrag = (await aufgabenDateienListe(haushalt)).find(e => e.id === id);
  if (!eintrag) return null;
  const bytes = await inhaltLaden(haushalt, id);
  return bytes ? { eintrag, bytes } : null;
}

/**
 * Eintrag und Datei entfernen. true, wenn es ihn gab. Wie die CRM-Ablage: ist die Kennung irgendwo als Beleg einer
 * Einwilligung eingetragen (Art. 7 Abs. 1 DSGVO), bleibt sie (409).
 */
export async function aufgabenDateiEntfernen(haushalt: string, person: string, id: string, jetzt = new Date().toISOString()): Promise<boolean> {
  if (!DATEI_ID.test(id)) throw new AblageFehler('Unzulässige Kennung.', 400);
  const einwilligungen = einwilligungenMitBeleg((await loadJson<{ kontakte?: Kontakt[] }>('kontakte'))?.kontakte ?? [], id);
  if (einwilligungen.anzahl) throw new AblageFehler(belegGesperrtText(einwilligungen.anzahl), 409);
  let weg: AufgabenDatei | null = null;
  await updateJson<AblageDatei>(aufgabenAblageName(haushalt), cur => {
    const l = cur?.eintraege ?? [];
    weg = l.find(x => x.id === id) ?? null;
    return weg ? { eintraege: l.filter(x => x.id !== id) } : (cur ?? { eintraege: l });
  });
  const e = weg as AufgabenDatei | null;
  if (!e) return false;
  await inhaltEntfernen(haushalt, id);
  await verlauf(haushalt, { op: 'geloescht', id }, e, person, jetzt);
  return true;
}
