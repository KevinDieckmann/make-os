// ─── Inbox — Ansicht & Ordnung (rein, client-sicher, 09.10.2026) ─────────────────────────────────────────────────
// Kevin 09.10.: „Ich muss mir die Inbox und die Nachrichten, die da gekommen sind, auch ansehen können — sortiert … die Labels zu den
// einzelnen Bereichen — das soll sauberst weg-organisiert werden.“ — „Man muss da auf das Postfach klicken, z. B. MAKE Innovation oder
// KD Ventures … und wenn ich dann darauf klicke, kann ich die Mails einsortieren.“
// Hier steht nur, WIE die Inbox ordnet — nie, WAS eine Sicht sehen darf (das entscheidet der Server, lib/inbox/strom-server.ts `imBereich`):
//   · Bereichs-Leiste: je Bereich mit Postfächern der Person ein Eintrag (Name, Farbe, Ungelesen, offen, Postfächer) — `leisteBauen`
//   · Farben der Bereiche NUR aus den vorhandenen Quellen (Privat/Kern-Einheiten/Mandanten wie in den Aufgaben-Spaces) — `bereichFarbe`
//   · Tag-Gruppen „Heute · Gestern · Diese Woche · Älter“ (Berliner Tag), darin ungelesen zuerst, dann neueste — `nachTagen`
//   · Bereichs-Kennungen generisch: `privat` · Gesellschaft (kdc/kdv/ug) · Register `g-…` · alles Weitere (z. B. ein Kunden-Bereich), das
//     die Postfächer tragen — die Form wird nur geprüft (keine Pfadzeichen), nicht aufgezählt.
// Keine Server-Importe, keine festen Namen.

import { istGesellschaft } from '@/lib/einheiten';
import { tagePlus, tagVon } from '@/lib/zeit';
import { EINHEIT_FARBE, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { istMandantSpace, MANDANT_FARBE, PRIVAT_FARBE } from '@/lib/aufgaben/struktur';

/** Eine Bereichs-Kennung in Adresse/Abfrage: klein, ohne Pfad- oder Steuerzeichen (privat · kdv · g-… · weitere Formen). */
export const BEREICH_KENNUNG = /^[a-z0-9][a-z0-9-]{0,79}$/;
export const istBereichKennung = (v: unknown): v is string => typeof v === 'string' && BEREICH_KENNUNG.test(v);

/** Liste von Bereichen in einer Abfrage (`ohne=a,b` — unter „Alle“ ausgeblendet, Merker je Browser); höchstens 30, sonst ungültig (`null`). */
export const BEREICHE_MAX = 30;
export function bereicheAus(roh: string | null | undefined): string[] | null {
  if (roh === null || roh === undefined) return null;
  const l = roh.split(',').map(s => s.trim()).filter(Boolean);
  if (l.length > BEREICHE_MAX || !l.every(istBereichKennung)) return null;
  return Array.from(new Set(l));
}

/** Farbe eines Bereichs: Privat, die Kern-Einheiten und Mandanten wie in den Aufgaben-Spaces; alles andere (Register, ohne Bereich) ruhig grau. */
export function bereichFarbe(bereich: string | null | undefined): string {
  if (bereich === 'privat') return PRIVAT_FARBE;
  if (istGesellschaft(bereich)) return EINHEIT_FARBE[bereich];
  if (istMandantSpace(bereich)) return MANDANT_FARBE;
  return EINHEIT_GRAU;
}

// ── Bereichs-Leiste ─────────────────────────────────────────────────────────

export interface LeistePostfach { id: string; name: string; quelle: string }
export interface LeisteEintrag {
  /** Bereich (`null` = Postfach noch keinem Bereich zugeordnet — nur in „Alle“). */
  id: string | null;
  name: string;
  farbe: string;
  /** Ungelesene Gespräche in Arbeit (ohne Rundschreiben). */
  ungelesen: number;
  /** Gespräche in Arbeit (ohne Rundschreiben). */
  offen: number;
  postfaecher: LeistePostfach[];
}

type LeisteGespraech = { postfachId: string; bereich: string | null; ungelesen: boolean; inArbeit: boolean; fach: string };

/** Zählt ein Gespräch in der Leiste? In Arbeit, nicht geblockt, kein Rundschreiben (das räumt man am Stück weg). */
export const zaehltInLeiste = (g: Pick<LeisteGespraech, 'inArbeit' | 'fach'>): boolean => g.inArbeit && g.fach !== 'info' && g.fach !== 'geblockt';

/**
 * Die Leiste aus den Postfächern DER SICHT (der Server reicht nur die, die die Sicht sehen darf) und deren Gesprächen (rein).
 * Reihenfolge: Business-Bereiche nach Name, dann Privat, ohne Bereich zuletzt — wie das Lagebild.
 */
export function leisteBauen(
  postfaecher: readonly { id: string; bereich: string | null; anzeigename: string; quelle: string }[],
  gespraeche: readonly LeisteGespraech[],
  name: (bereich: string | null) => string,
): LeisteEintrag[] {
  const je = new Map<string | null, LeisteEintrag>();
  for (const p of postfaecher) {
    const e = je.get(p.bereich) ?? je.set(p.bereich, { id: p.bereich, name: name(p.bereich), farbe: bereichFarbe(p.bereich), ungelesen: 0, offen: 0, postfaecher: [] }).get(p.bereich)!;
    e.postfaecher.push({ id: p.id, name: p.anzeigename, quelle: p.quelle });
  }
  for (const g of gespraeche) {
    const e = je.get(g.bereich);
    if (!e || !zaehltInLeiste(g)) continue;
    e.offen++;
    if (g.ungelesen) e.ungelesen++;
  }
  const rang = (b: string | null) => (b === null ? 2 : b === 'privat' ? 1 : 0);
  return Array.from(je.values()).sort((a, b) => rang(a.id) - rang(b.id) || a.name.localeCompare(b.name, 'de'));
}

// ── Tag-Gruppen ─────────────────────────────────────────────────────────────

export const TAG_GRUPPEN = [
  { id: 'heute', titel: 'Heute' },
  { id: 'gestern', titel: 'Gestern' },
  { id: 'woche', titel: 'Diese Woche' },
  { id: 'aelter', titel: 'Älter' },
] as const;
export type TagGruppe = typeof TAG_GRUPPEN[number]['id'];

/** Montag der Woche eines Tages (YYYY-MM-DD, rein). */
const montagVon = (tag: string): string => tagePlus(tag, -((new Date(`${tag}T12:00:00Z`).getUTCDay() + 6) % 7));

/** In welche Tag-Gruppe gehört ein Zeitpunkt (Berliner Tag)? Zukunft (Uhren daneben) zählt als heute. */
export function tagGruppe(am: string, heute: string): TagGruppe {
  const tag = tagVon(am);
  if (tag >= heute) return 'heute';
  if (tag === tagePlus(heute, -1)) return 'gestern';
  if (tag >= montagVon(heute)) return 'woche';
  return 'aelter';
}

type ChronoGespraech = { id: string; am: string; ungelesen: boolean };

/** Gespräche nach Tagen gruppiert; in jeder Gruppe ungelesen zuerst, dann neueste zuerst (rein). Leere Gruppen fallen weg. */
export function nachTagen<T extends ChronoGespraech>(liste: readonly T[], heute: string): { id: TagGruppe; titel: string; liste: T[] }[] {
  const je = new Map<TagGruppe, T[]>();
  for (const g of liste) { const t = tagGruppe(g.am, heute); (je.get(t) ?? je.set(t, []).get(t)!).push(g); }
  return TAG_GRUPPEN.map(t => ({ id: t.id, titel: t.titel, liste: [...(je.get(t.id) ?? [])].sort((a, b) => Number(b.ungelesen) - Number(a.ungelesen) || b.am.localeCompare(a.am) || a.id.localeCompare(b.id)) }))
    .filter(g => g.liste.length > 0);
}

// ── Ansicht „Neueste zuerst“: was zeigen ────────────────────────────────────

export const ZEIGEN = [
  { id: 'offen', label: 'Offen' },
  { id: 'ungelesen', label: 'Ungelesen' },
  { id: 'alle', label: 'Auch Erledigtes' },
] as const;
export type Zeigen = typeof ZEIGEN[number]['id'];
export const istZeigen = (v: unknown): v is Zeigen => ZEIGEN.some(z => z.id === v);

/** Filter der chronologischen Ansicht (rein): `offen` = in Arbeit · `ungelesen` = in Arbeit und ungelesen · `alle` = auch Erledigtes/Ruhendes. Geblockte nie. */
export function fuerZeigen<T extends { inArbeit: boolean; ungelesen: boolean; fach: string }>(liste: readonly T[], z: Zeigen): T[] {
  return liste.filter(g => g.fach !== 'geblockt' && (z === 'alle' || (g.inArbeit && (z === 'offen' || g.ungelesen))));
}

/** Warum steht ein Gespräch nicht (mehr) in der Arbeitsliste? Für die gedimmte Zeile in „Auch Erledigtes“ (rein). */
export function ruheText(g: { inArbeit: boolean; wiedervorlage?: string; verjaehrt?: boolean }): string | null {
  if (g.inArbeit) return null;
  if (g.wiedervorlage && g.wiedervorlage !== 'faellig') return `ruht bis ${g.wiedervorlage.slice(8, 10)}.${g.wiedervorlage.slice(5, 7)}.`;
  if (g.verjaehrt) return 'keine Antwort mehr erwartet';
  return 'erledigt';
}
