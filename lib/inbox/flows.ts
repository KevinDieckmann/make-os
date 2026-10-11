// ─── Inbox — Flows aus einem Gespräch: Antworten · Ablegen · Aufgabe (rein, client- und server-sicher, 09.10.2026) ────────
// Kevin 09.10.: „Entweder antworten, Dokumente wegsortieren in unsere Ablage oder Aufgabe erstellen — da müssen saubere Flows rein.
// Und die Aufgaben müssen dann wieder sauber zugeordnet werden zur Firma und dann am besten Projekt, vielleicht auch Kundenprojekte.“
//
// Hier steht NUR der Vorschlag (wohin, mit welchem Bezug) — angelegt wird immer per Klick über die vorhandenen Schreibwege:
//   · Aufgabe → `aufgabeAnlegen` (TasksContext, Server prüft Ort/Liste/Bezug in `aufgabenAendern`)
//   · Ablage  → POST /api/inbox/ablegen → `ablegen` (CRM-Ablage) bzw. `aufgabenDateiAblegen` (Projekt-Dateien), Typprüfung am Inhalt
//   · Beleg   → der vorhandene Beleg-Weg (BelegAusMail → /api/beleg → /api/beleg/uebernehmen)
//
// Zuordnungs-Regel (EINE Stelle, getestet in tests/inbox-flows.test.ts):
//   1. Gab es aus DIESEM Gespräch schon eine Aufgabe → derselbe Ort (Space/Projekt/Liste).
//   2. Space: Privat-Postfach → Privat (bzw. die Privat-Einheit des Postfachs); Business-Postfach → Mandanten-Space `m-<firmaId>`, wenn die
//      Firma der Person ein AKTIVES Mandat hat, sonst die Gesellschaft des Postfachs, sonst die Business-Vorgabe der Instanz.
//   3. Projekt/Liste: dort, wo schon die meisten Aufgaben zu dieser Person/Firma liegen (Kundenprojekt); im Mandanten-Space mit genau einem
//      laufenden Projekt dieses; sonst „Sonstige“.
//   4. Bezug: Kontakt (nicht bei Art. 18), Firma, Deal, Mandat (nur das aktive Mandat der Firma) — nur Kennungen.
// Bereiche bleiben getrennt: vorgeschlagen wird nur im Bereich des Postfachs; ein Wechsel geht nur bewusst (Häkchen + Hinweis; der Server
// verlangt `bereichWechsel: true` für die Ablage).

import type { AufgabeBezug, AufgabenListe, Project, Task } from '@/types/tasks';
import type { Zuordnung } from '@/lib/gmail/typen';
import { BUSINESS_VORGABE_SPACE, istFinanzOrt } from '@/lib/einheiten';
import { postfachRaum } from '@/lib/postfach/bereich';
import { bereichVonSpace, istSonstigeProjekt, mandantSpaceId, sonstigeProjektId } from '@/lib/aufgaben/struktur';
import type { DateiArt } from '@/lib/dateien/regeln';
import { WEG } from '@/lib/wege';
import { tagVon } from '@/lib/zeit';
import { gespraechPfad } from './strom';

export type Raum = 'privat' | 'business';

/** Bereich des Postfachs — die EINE Regel `postfachRaum` (lib/postfach/bereich.ts): ohne Bereich Privat (Prüf-Fund 11.10.). */
export const raumVonPostfach = (bereich: string | null | undefined): Raum => postfachRaum(bereich);

/** Was die Zuordnung braucht (Browser: TasksContext + /api/aufgaben/crm; Tests: reine Daten). */
export interface ZielEingabe {
  gespraechId: string;
  bereich: string | null;
  zuordnung?: Pick<Zuordnung, 'kontaktId' | 'firmaId' | 'dealId' | 'sperre'> | null;
  /** Mandate aus dem CRM (Kennung, Firma, Status). */
  mandate: readonly { id: string; firmaId?: string; status: string }[];
  /** Spaces vom Server (fest + Mandanten). Leer = nur die festen (Mandanten-Space dann nicht vorgeschlagen). */
  spaces: readonly { id: string; archiv?: boolean }[];
  tasks: readonly Pick<Task, 'id' | 'spaceId' | 'projectId' | 'listeId' | 'bezug' | 'description' | 'createdAt' | 'parentId' | 'status'>[];
  projects: readonly Pick<Project, 'id' | 'spaceId' | 'archived' | 'status' | 'title'>[];
  listen?: readonly Pick<AufgabenListe, 'id' | 'projektId' | 'archiviert' | 'archiviertAm'>[];
}

export interface ZielVorschlag {
  spaceId: string;
  projectId: string;
  listeId?: string;
  bezug?: AufgabeBezug;
  /** Kurz, warum dieser Ort (für die Anzeige). */
  grund: string;
}

/** Aufgaben, die aus diesem Gespräch angelegt wurden (Link im Text — dieselbe Erkennung wie bisher „Aufgabe gab es schon“). Neueste zuerst. */
export function aufgabenAusGespraech<T extends Pick<Task, 'description' | 'createdAt'>>(tasks: readonly T[], gespraechId: string): T[] {
  const link = gespraechPfad(gespraechId);
  // Genau dieser Link (danach Zeilenende oder Textende) — `…offen=gm~1` darf `…offen=gm~12` nicht treffen.
  const passt = (d: string) => d.split(/\s+/).some(w => w === link || w.endsWith(link));
  return tasks.filter(t => passt(t.description ?? '')).sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

/** Das aktive Mandat einer Firma (das zuletzt in der Liste stehende, wenn es mehrere gibt). */
export function aktivesMandat(mandate: ZielEingabe['mandate'], firmaId: string | undefined): { id: string; firmaId: string } | undefined {
  if (!firmaId) return undefined;
  const m = [...mandate].reverse().find(x => x.status === 'aktiv' && x.firmaId === firmaId);
  return m ? { id: m.id, firmaId } : undefined;
}

/** Der Bezug einer Aufgabe aus der Zuordnung — Art. 18 (eingeschränkt): ohne die Person, nur Firma/Deal. */
export function bezugFuer(e: Pick<ZielEingabe, 'zuordnung' | 'mandate'>): AufgabeBezug | undefined {
  const z = e.zuordnung;
  if (!z) return undefined;
  const m = aktivesMandat(e.mandate, z.firmaId);
  const b: AufgabeBezug = {
    ...(z.sperre !== 'eingeschraenkt' ? { kontaktId: z.kontaktId } : {}),
    ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(m ? { mandatId: m.id } : {}), ...(z.dealId ? { dealId: z.dealId } : {}),
  };
  return Object.keys(b).length ? b : undefined;
}

const spaceDa = (e: ZielEingabe, id: string) => e.spaces.some(s => s.id === id && !s.archiv);
const projektLaeuft = (e: ZielEingabe, id: string | undefined) => !!id && e.projects.some(p => p.id === id && !p.archived && p.status !== 'abgeschlossen');
const listeDa = (e: ZielEingabe, projektId: string, id: string | undefined) => !!id && (e.listen ?? []).some(l => l.id === id && l.projektId === projektId && !l.archiviert && !l.archiviertAm);

/** Der Space für eine Aufgabe aus diesem Gespräch (Regel 2) — immer im Bereich des Postfachs. */
export function spaceFuer(e: ZielEingabe): { spaceId: string; grund: string } {
  const raum = raumVonPostfach(e.bereich);
  if (raum === 'privat') {
    // Ein Privat-Postfach einer Privat-Einheit (z. B. der Selbstständigkeit) → deren Space; sonst Privat.
    const s = e.bereich && istFinanzOrt(e.bereich) ? e.bereich : 'privat';
    return { spaceId: s, grund: 'Privat-Postfach' };
  }
  const m = aktivesMandat(e.mandate, e.zuordnung?.firmaId);
  if (m && spaceDa(e, mandantSpaceId(m.firmaId))) return { spaceId: mandantSpaceId(m.firmaId), grund: 'aktives Mandat der Firma' };
  if (e.bereich && istFinanzOrt(e.bereich) && bereichVonSpace(e.bereich) === 'business') return { spaceId: e.bereich, grund: 'Gesellschaft des Postfachs' };
  return { spaceId: BUSINESS_VORGABE_SPACE, grund: 'Business-Vorgabe' };
}

/**
 * Projekt + Liste im Space (Regel 3): wo schon Aufgaben zu dieser Person bzw. Firma liegen (meiste zuerst, bei Gleichstand die jüngste),
 * im Mandanten-Space mit genau einem laufenden Projekt dieses — sonst „Sonstige“ ohne Liste.
 */
export function projektFuer(e: ZielEingabe, spaceId: string): { projectId: string; listeId?: string; grund?: string } {
  const z = e.zuordnung;
  const passt = (t: ZielEingabe['tasks'][number]) => !!z && ((!!t.bezug?.kontaktId && t.bezug.kontaktId === z.kontaktId) || (!!z.firmaId && t.bezug?.firmaId === z.firmaId));
  const nahe = e.tasks.filter(t => t.spaceId === spaceId && passt(t) && projektLaeuft(e, t.projectId));
  if (nahe.length) {
    const je = new Map<string, { n: number; juengst: string }>();
    for (const t of nahe) { const x = je.get(t.projectId) ?? { n: 0, juengst: '' }; je.set(t.projectId, { n: x.n + 1, juengst: String(t.createdAt ?? '') > x.juengst ? String(t.createdAt ?? '') : x.juengst }); }
    const [projectId] = [...je.entries()].sort((a, b) => b[1].n - a[1].n || b[1].juengst.localeCompare(a[1].juengst) || a[0].localeCompare(b[0]))[0];
    const listen = new Map<string, number>();
    for (const t of nahe) if (t.projectId === projectId && listeDa(e, projectId, t.listeId)) listen.set(t.listeId!, (listen.get(t.listeId!) ?? 0) + 1);
    const liste = [...listen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    return { projectId, ...(liste ? { listeId: liste } : {}), grund: 'dort liegen schon Aufgaben zu ihr/ihm' };
  }
  if (spaceId.startsWith('m-')) {
    const laufend = e.projects.filter(p => p.spaceId === spaceId && !p.archived && p.status !== 'abgeschlossen');
    if (laufend.length === 1) return { projectId: laufend[0].id, grund: 'das Kundenprojekt' };
  }
  return { projectId: sonstigeProjektId(spaceId) };
}

/** Der ganze Vorschlag für „Aufgabe erstellen“ (Regeln 1–4). */
export function aufgabenZiel(e: ZielEingabe): ZielVorschlag {
  const bezug = bezugFuer(e);
  const raum = raumVonPostfach(e.bereich);
  // 1. Gab es schon eine Aufgabe aus diesem Gespräch (im selben Bereich, Ort noch da)? Dann dorthin.
  const frueher = aufgabenAusGespraech(e.tasks.filter(t => !t.parentId), e.gespraechId)
    .find(t => t.spaceId && bereichVonSpace(t.spaceId) === raum && (spaceDa(e, t.spaceId) || !t.spaceId.startsWith('m-')) && (projektLaeuft(e, t.projectId) || istSonstigeProjekt(t.projectId)));
  if (frueher?.spaceId) {
    return {
      spaceId: frueher.spaceId, projectId: frueher.projectId, ...(listeDa(e, frueher.projectId, frueher.listeId) ? { listeId: frueher.listeId } : {}),
      ...(bezug ? { bezug } : {}), grund: 'wie die letzte Aufgabe aus diesem Gespräch',
    };
  }
  const s = spaceFuer(e);
  const p = projektFuer(e, s.spaceId);
  return { spaceId: s.spaceId, projectId: p.projectId, ...(p.listeId ? { listeId: p.listeId } : {}), ...(bezug ? { bezug } : {}), grund: p.grund ? `${s.grund} · ${p.grund}` : s.grund };
}

// ── Ablage ───────────────────────────────────────────────────────────────────

export type AblageArt = 'crm' | 'projekt' | 'beleg';

/** Endungen, die die CRM-Ablage annimmt (der Server prüft den INHALT, das hier ist nur der Hinweis vorab). */
const CRM_ENDUNGEN = /\.(pdf|png|jpe?g|docx)$/i;
export const crmTypPasst = (name: string): boolean => CRM_ENDUNGEN.test(name.trim());
/** PDF oder Foto — nur das liest der Beleg-Weg. */
export const belegTypPasst = (a: { name: string; typ: string }): boolean => /pdf|image\/(png|jpe?g|webp|heic)/i.test(a.typ) || /\.(pdf|png|jpe?g)$/i.test(a.name);

/** Art des Dokuments in der CRM-Ablage aus dem Dateinamen (Vorschlag, änderbar). */
export function dateiArtAusName(name: string): DateiArt {
  const n = name.toLowerCase();
  if (/rechnung|invoice|faktura|gutschrift/.test(n)) return 'rechnung';
  if (/angebot|offer|quote|kostenvoranschlag/.test(n)) return 'angebot';
  if (/vertrag|contract|vereinbarung|nda|avv|agreement/.test(n)) return 'vertrag';
  return 'sonstig';
}

/**
 * Darf aus diesem Gespräch in die CRM-Ablage (Firma/Kontakt) abgelegt werden — und mit welchen Bezügen?
 * Art. 18 (eingeschränkt): gar nicht. Werbesperre: nicht an der Person, nur an der Firma bzw. dem Deal.
 */
export function crmAblageBezug(z: Pick<Zuordnung, 'kontaktId' | 'firmaId' | 'dealId' | 'sperre'> | null | undefined): { ok: true; bezug: { kontaktId?: string; firmaId?: string; dealId?: string } } | { ok: false; grund: string } {
  if (!z) return { ok: false, grund: 'Erst eine Person zuordnen oder anlegen — die Ablage hängt an Kontakt oder Firma.' };
  if (z.sperre === 'eingeschraenkt') return { ok: false, grund: 'Die Verarbeitung dieser Person ist eingeschränkt (Art. 18) — nichts ablegen.' };
  const bezug = { ...(z.sperre !== 'werbesperre' ? { kontaktId: z.kontaktId } : {}), ...(z.firmaId ? { firmaId: z.firmaId } : {}), ...(z.dealId ? { dealId: z.dealId } : {}) };
  if (!Object.keys(bezug).length) return { ok: false, grund: 'Werbesperre — an der Person wird nichts abgelegt, und es gibt keine Firma.' };
  return { ok: true, bezug };
}

/** Wohin ablegen (Vorschlag): Beleg bei Geld & Papier in einer Business-Gesellschaft, an der Aufgabe aus dem Gespräch, an Firma/Kontakt, sonst Projekt. */
export function ablageVorschlag(e: { fach: string; bereich: string | null; zuordnung?: Pick<Zuordnung, 'kontaktId' | 'firmaId' | 'dealId' | 'sperre'> | null; anhang?: { name: string; typ: string }; ausGespraech: number }): AblageArt {
  const raum = raumVonPostfach(e.bereich);
  if (e.fach === 'geld' && e.anhang && belegTypPasst(e.anhang) && raum === 'business' && !!e.bereich && istFinanzOrt(e.bereich)) return 'beleg';
  if (e.ausGespraech > 0) return 'projekt';
  if (raum === 'business' && crmAblageBezug(e.zuordnung).ok && (!e.anhang || crmTypPasst(e.anhang.name))) return 'crm';
  return 'projekt';
}

/** Muss der Bereich bewusst gewechselt werden (Privat-Mail in Business-Ablage oder umgekehrt)? */
export const bereichWechsel = (postfach: string | null | undefined, ziel: Raum): boolean => raumVonPostfach(postfach) !== ziel;
export const WECHSEL_TEXT = (von: Raum, nach: Raum) => `Die Mail kommt aus einem ${von === 'privat' ? 'Privat' : 'Business'}-Postfach — das Ziel liegt im Bereich ${nach === 'privat' ? 'Privat' : 'Business'}. Nur bewusst ablegen.`;

/** Notiz am abgelegten Eintrag: woher er kommt (Link zurück ins Gespräch, nie Mailtext). */
export const ablageNotiz = (gespraechId: string, quelle: string): string => `${quelle === 'whatsapp' ? 'Aus WhatsApp' : 'Aus der Inbox'} · ${gespraechPfad(gespraechId)}`;

/** Steuerzeichen außer Tab/Zeilenumbruch raus — die Projekt-Ablage nimmt nur echten Text (`istText`). */
const ohneSteuerzeichen = (t: string) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

/** Die Mail selbst als Textdatei (nur für die Projekt-Ablage — die CRM-Ablage nimmt keine Textdateien). Server baut sie aus dem eigenen Spiegel. */
export function mailAlsText(n: { von: { email: string; name?: string }; an: readonly { email: string; name?: string }[]; cc: readonly { email: string; name?: string }[]; am: string; betreff: string; text: string }): { name: string; text: string } {
  const adr = (a: { email: string; name?: string }) => (a.name ? `${a.name} <${a.email}>` : a.email);
  const tag = /^\d{4}-\d{2}-\d{2}/.test(n.am) ? tagVon(n.am) : '';
  const kopf = [`Von: ${adr(n.von)}`, n.an.length ? `An: ${n.an.map(adr).join(', ')}` : '', n.cc.length ? `Cc: ${n.cc.map(adr).join(', ')}` : '', `Datum: ${n.am}`, `Betreff: ${n.betreff.replace(/\s+/g, ' ').trim()}`].filter(Boolean);
  const betreff = n.betreff.replace(/[^\p{L}\p{N} _-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { name: `Mail ${tag}${betreff ? ` ${betreff}` : ''}.txt`.replace(/\s+/g, ' '), text: ohneSteuerzeichen(`${kopf.join('\n')}\n\n${n.text}`) };
}

/** Wohin der Link nach dem Ablegen führt: Kontakt-Akte, sonst Firma, sonst Deal; Projekt-Dateien: Aufgabe bzw. Reiter „Dateien“ des Projekts. */
export function ablageLink(z: { art: 'crm'; kontaktId?: string; firmaId?: string; dealId?: string } | { art: 'projekt'; spaceId: string; projektId: string; aufgabeId?: string }): string {
  if (z.art === 'crm') return z.kontaktId ? WEG.akte(z.kontaktId) : z.firmaId ? WEG.firma(z.firmaId) : z.dealId ? WEG.deal(z.dealId) : WEG.markttraktion();
  if (z.aufgabeId) return WEG.aufgabe(z.aufgabeId);
  return istSonstigeProjekt(z.projektId) ? WEG.aufgaben({ s: z.spaceId }) : WEG.aufgaben({ s: z.spaceId, p: z.projektId, t: 'dateien' });
}

// ── Nach der Aktion ──────────────────────────────────────────────────────────

/** Merker „danach erledigen“ (je Browser). */
export const DANACH_ERLEDIGEN = 'make-inbox-danach-erledigen';
