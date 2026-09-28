// ─── ZOE liest Projekt- und Aufgaben-Unterlagen (28.09., Paket C2 — Kevins Wahl) ───
// Zwei Werkzeuge, beide nur lesend:
//   projekt_unterlagen — Dateien (Metadaten) und Notizen eines Projekts bzw. einer Aufgabe
//   datei_lesen        — Textinhalt EINER Datei (PDF/Word/Excel/PowerPoint/CSV/TXT/MD; Bilder nur Metadaten)
//
// Grenzen (Bauform, nicht Prompt):
//   · Nur der Bestand `aufgaben-dateien--<haushalt>` (lib/dateien/aufgaben-ablage.ts). Die CRM-Ablage (Angebote,
//     Rechnungen, Einwilligungsbelege, Mandatsunterlagen) kennt dieses Modul nicht — eine d-Kennung von dort ist
//     hier „nicht gefunden“.
//   · Nur im Gespräch mit einer benannten Person im Haushalt des Inhabers (kein Hintergrund, kein Systemlauf —
//     lib/zoe/ausfuehren.ts nimmt Hintergrundläufen die Person).
//   · Alles, was Nutzer oder Dritte geschrieben haben (Titel, Dateinamen, Beschreibungen, Notizen, Dateiinhalt),
//     steht in `fremd()` — davor nur eine eigene Kopfzeile mit Kennungen und Zahlen (sie allein geht ins
//     ZOE-Protokoll). lib/zoe/fremd.ts führt beide als selbst gekapselt: das Gespräch gilt danach als „fremd gelesen“.
//   · Höchstens `ZOE_ZEICHEN` (30.000) Zeichen je Aufruf; darüber Hinweis + `teil` wählen — nie still gekürzt.
// Das Werkzeug ruft selbst kein Modell; die Kosten trägt das laufende Gespräch (Werkzeug-Budget + modellSchranke
// der Route /api/kimmi).

import { fremd } from '@/lib/anthropic';
import { personImHaushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { haushaltFuer } from '@/lib/finanzen/haushalt/zugriff';
import { ladeAufgabenSicht } from '@/lib/aufgaben/speicher';
import { bereichVonSpace } from '@/lib/aufgaben/struktur';
import { aufgabenDateienListe, aufgabenDateiLesen, type AufgabenDatei } from '@/lib/dateien/aufgaben-ablage';
import { textAuslesen, NichtLesbar } from '@/lib/dateien/text-auslesen';
import { AblageFehler } from '@/lib/dateien/ablage';
import { DATEI_ID, groesseText } from '@/lib/dateien/regeln';
import { TYP_LABEL, abschnittWaehlen, aufgabenDateienFuer, typGruppe } from '@/lib/dateien/aufgaben-regeln';
import type { Project, Task } from '@/types/tasks';

/** Die beiden Werkzeuge — für Angebot (kimmi), Kapselung (fremd.ts) und Protokoll (ausfuehren.ts). */
export const AUFGABEN_DATEI_WERKZEUGE = ['projekt_unterlagen', 'datei_lesen'] as const;
export const UNTERLAGEN_QUELLE = 'projekt-unterlagen';

const NICHT_IM_HINTERGRUND = 'Nicht ausgeführt: Projekt- und Aufgaben-Dateien liest ZOE nur im Gespräch mit Kevin oder Malin — nicht im Hintergrund und nicht für andere Konten.';

async function haushalt(person: string | undefined): Promise<string | null> {
  if (!person || !(await personImHaushaltDesInhabers(person))) return null;
  return (await haushaltFuer(person))?.haushalt ?? null;
}

const klein = (s: string) => s.trim().toLocaleLowerCase('de-DE');
/** Eindeutig finden: Kennung genau, sonst Titel (genau, dann enthalten). */
function finde<T extends { id: string }>(liste: readonly T[], suche: string, titel: (x: T) => string): T | T[] | null {
  const s = suche.trim();
  if (!s) return null;
  const genau = liste.find(x => x.id === s);
  if (genau) return genau;
  const gleich = liste.filter(x => klein(titel(x)) === klein(s));
  if (gleich.length === 1) return gleich[0];
  const teil = liste.filter(x => klein(titel(x)).includes(klein(s)));
  if (teil.length === 1) return teil[0];
  return teil.length ? teil.slice(0, 8) : null;
}

/**
 * Notizen eines Projekts/einer Aufgabe als Text (Datenmodell C1, types/tasks.ts): Kurzbeschreibung (`beschreibung`,
 * nur Projekt), Beschreibung (`description`) und Notiz (`notiz`, sichere Markdown-Teilmenge) — nur lesen.
 */
export function notizenText(x: Project | Task): string {
  const teile: string[] = [];
  const kurz = 'beschreibung' in x ? x.beschreibung?.trim() : undefined;
  if (kurz) teile.push(`Kurzbeschreibung:\n${kurz}`);
  if (x.description?.trim() && x.description.trim() !== kurz) teile.push(`Beschreibung:\n${x.description.trim()}`);
  if (x.notiz?.trim()) teile.push(`Notiz:\n${x.notiz.trim()}`);
  return teile.join('\n\n');
}

const datum = (iso: string) => iso.slice(0, 10);
function dateiZeile(d: AufgabenDatei, aufgaben: Map<string, string>): string {
  const g = typGruppe(d.datei.typ);
  return `- ${d.id} · ${d.datei.name} · ${TYP_LABEL[g]} · ${groesseText(d.datei.groesse)} · von ${d.hochgeladenVon} am ${datum(d.hochgeladenAm)}`
    + (d.aufgabeId ? ` · an Aufgabe „${aufgaben.get(d.aufgabeId) ?? d.aufgabeId}“` : '')
    + (d.notiz ? ` · Beschreibung: ${d.notiz}` : '')
    + (g === 'bild' ? ' · (Bild — kein Text lesbar)' : '');
}

/** Kopfzeile (eigene Worte, nur Kennungen/Zahlen) + Hinweis zu Teilen + gekapselter Inhalt. */
function antwort(kopf: string, koerper: string, teil: unknown, weiter: (t: number) => string): string {
  const a = abschnittWaehlen(koerper, Number(teil ?? 1) || 1);
  const mehr = a.teile > 1
    ? ` · Teil ${a.teil} von ${a.teile} (Zeichen ${a.von + 1}–${a.bis} von ${a.gesamt})${a.teil < a.teile ? ` — für mehr: ${weiter(a.teil + 1)}` : ''}`
    : '';
  return `${kopf}${mehr}\n${fremd(UNTERLAGEN_QUELLE, a.text)}`;
}

async function unterlagen(input: Record<string, unknown>, person?: string): Promise<string> {
  const h = await haushalt(person);
  if (!h) return NICHT_IM_HINTERGRUND;
  const state = await ladeAufgabenSicht();
  const aufgabeSuche = String(input.aufgabe ?? '').trim();
  const projektSuche = String(input.projekt ?? '').trim();
  if (!aufgabeSuche && !projektSuche) return 'Fehlgeschlagen: projekt oder aufgabe angeben (Kennung oder Titel).';
  let projekt: Project | undefined;
  let aufgabe: Task | undefined;
  if (projektSuche) {
    const p = finde(state.projects, projektSuche, x => x.title);
    if (!p) return `Fehlgeschlagen: kein Projekt zu dieser Angabe gefunden.`;
    if (Array.isArray(p)) return `Nicht eindeutig — mehrere Projekte passen:\n${fremd(UNTERLAGEN_QUELLE, p.map(x => `- ${x.id} · ${x.title}`).join('\n'))}`;
    projekt = p;
  }
  if (aufgabeSuche) {
    const kandidaten = projekt ? state.tasks.filter(t => t.projectId === projekt!.id) : state.tasks;
    const t = finde(kandidaten, aufgabeSuche, x => x.title);
    if (!t) return 'Fehlgeschlagen: keine Aufgabe zu dieser Angabe gefunden.';
    if (Array.isArray(t)) return `Nicht eindeutig — mehrere Aufgaben passen:\n${fremd(UNTERLAGEN_QUELLE, t.map(x => `- ${x.id} · ${x.title}`).join('\n'))}`;
    aufgabe = t;
    projekt = projekt ?? state.projects.find(p => p.id === t.projectId);
  }
  const alle = await aufgabenDateienListe(h);
  const dateien = aufgabenDateienFuer(alle, aufgabe ? { aufgabeId: aufgabe.id } : { projektId: projekt!.id });
  const titelJe = new Map(state.tasks.map(t => [t.id, t.title]));
  const ziel = aufgabe ?? projekt!;
  const bereich = bereichVonSpace(aufgabe?.spaceId ?? projekt?.spaceId);
  const notizen = notizenText(ziel);
  const koerper = [
    aufgabe ? `Aufgabe: ${aufgabe.title}${projekt ? ` (Projekt: ${projekt.title})` : ''}` : `Projekt: ${projekt!.title}`,
    `Bereich: ${bereich === 'privat' ? 'Privat' : 'Business'}`,
    notizen || 'Keine Beschreibung und keine Notizen.',
    dateien.length ? `Dateien:\n${dateien.map(d => dateiZeile(d, titelJe)).join('\n')}` : 'Keine Dateien.',
  ].join('\n\n');
  const kopf = `UNTERLAGEN ${aufgabe ? `Aufgabe ${aufgabe.id}` : `Projekt ${projekt!.id}`} · ${dateien.length} Datei${dateien.length === 1 ? '' : 'en'} · Notizen: ${notizen ? 'ja' : 'nein'} · Inhalt einer Datei: datei_lesen mit der Kennung (d-…)`;
  return antwort(kopf, koerper, input.teil, t => `projekt_unterlagen mit teil: ${t}`);
}

async function lesen(input: Record<string, unknown>, person?: string): Promise<string> {
  const h = await haushalt(person);
  if (!h) return NICHT_IM_HINTERGRUND;
  const id = String(input.datei ?? '').trim();
  if (!DATEI_ID.test(id)) return 'Fehlgeschlagen: datei braucht die Kennung (d-…) aus projekt_unterlagen.';
  const d = await aufgabenDateiLesen(h, id);
  if (!d) return 'Fehlgeschlagen: Diese Kennung ist keine Projekt- oder Aufgaben-Datei (die CRM-Ablage liest ZOE nicht) — oder die Datei fehlt.';
  const g = typGruppe(d.eintrag.datei.typ);
  const meta = [`Datei: ${d.eintrag.datei.name}`, `Typ: ${TYP_LABEL[g]} · ${groesseText(d.eintrag.datei.groesse)} · von ${d.eintrag.hochgeladenVon} am ${datum(d.eintrag.hochgeladenAm)}`, d.eintrag.notiz ? `Beschreibung: ${d.eintrag.notiz}` : ''].filter(Boolean).join('\n');
  let inhalt: Awaited<ReturnType<typeof textAuslesen>>;
  try { inhalt = await textAuslesen(d.bytes, d.eintrag.datei.typ); }
  catch (e) {
    if (e instanceof NichtLesbar) return `DATEI ${id} · Text nicht lesbar: ${e.message}\n${fremd(UNTERLAGEN_QUELLE, meta)}`;
    throw e;
  }
  if (!inhalt) return `DATEI ${id} · Bild — kein Text lesbar, nur die Angaben\n${fremd(UNTERLAGEN_QUELLE, meta)}`;
  const kopf = `DATEI ${id} · ${inhalt.umfang ?? TYP_LABEL[g]} · ${inhalt.text.length} Zeichen${inhalt.hinweis ? ` · Hinweis: ${inhalt.hinweis}` : ''}`;
  return antwort(kopf, `${meta}\n\n${inhalt.text || '(kein Text)'}`, input.teil, t => `datei_lesen mit datei: ${id}, teil: ${t}`);
}


/** Ablage/Bestand nicht lesbar (z. B. Schlüssel fehlt) → ein Satz statt eines abgebrochenen Gesprächs. */
const sicher = (f: (i: Record<string, unknown>, p?: string) => Promise<string>) => async (input: Record<string, unknown>, _o: string, person?: string): Promise<string> => {
  try { return await f(input, person); }
  catch (e) {
    console.error('[zoe/unterlagen]', e instanceof Error ? e.message : e);
    return `Fehlgeschlagen: ${e instanceof AblageFehler ? e.message : 'Unterlagen gerade nicht lesbar.'}`;
  }
};

/** projekt_unterlagen: { projekt?: Kennung oder Titel, aufgabe?: Kennung oder Titel, teil?: Zahl } */
export const projektUnterlagen = sicher(unterlagen);
/** datei_lesen: { datei: d-…, teil?: Zahl } — nur Aufgaben-Dateien. */
export const dateiLesen = sicher(lesen);
