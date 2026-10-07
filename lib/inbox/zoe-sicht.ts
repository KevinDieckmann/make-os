// ─── Inbox 2 — was ZOE, Tageslauf und Briefing von der Inbox sehen (Server, 06.10.2026) ────────────────────────────
// Statt des alten Apple-Mail-Zwischenspeichers lesen Briefing/Tageslauf (app/api/tageslauf), das ZOE-Werkzeug `lies_postfach`
// (lib/zoe/werkzeuge.ts) und der Inbox-Agent (lib/zoe/agenten.ts) den EINEN Strom — immer nur die Postfächer DER Person, für die
// der Lauf läuft (nie ein Systemlauf ohne Person, nie die Post einer anderen Person).
// KI-Grundsatz (INBOX_KONZEPT.md Abschnitt 10): die KI sieht nur Kopf + Ausschnitt (Volltext nur beim Entwurf auf Klick).

import { FACH_LABEL } from './faecher';
import { stromFuer } from './strom-server';
import type { Gespraech, LageZeile } from './strom';

export interface InboxLage { lage: LageZeile[]; zoe: string; antworten: number; nachfassen: number; postfaecher: number; bereichNamen: Record<string, string> }

/** Lage der Inbox einer Person (Zähler je Bereich + ZOE-Satz). */
export async function inboxLage(person: string): Promise<InboxLage> {
  const s = await stromFuer(person);
  const namen = Object.fromEntries(s.bereiche.map(b => [b.id, b.name]));
  return {
    lage: s.lage, zoe: s.zoe.text, postfaecher: s.postfaecher.length, bereichNamen: namen,
    antworten: s.lage.reduce((n, z) => n + z.antworten, 0), nachfassen: s.lage.reduce((n, z) => n + z.nachfassen, 0),
  };
}

/** Eine Zeile je Bereich als Text (rein). */
export function lageText(l: LageZeile, name: string): string {
  const t: string[] = [];
  if (l.antworten) t.push(`${l.antworten} ${l.antworten === 1 ? 'braucht' : 'brauchen'} Antwort`);
  if (l.warten) t.push(`${l.warten} ${l.warten === 1 ? 'wartet' : 'warten'} auf andere${l.nachfassen ? ` (${l.nachfassen} nachfassen)` : ''}`);
  if (l.termine) t.push(`${l.termine} Termin${l.termine === 1 ? '' : 'e'}`);
  if (l.geld) t.push(`${l.geld} Geld & Papier`);
  if (l.neu) t.push(`${l.neu} neue Absender`);
  return `${name}: ${t.length ? t.join(' · ') : 'nichts offen'}`;
}

const zeile = (g: Gespraech) => `• [${FACH_LABEL[g.fach as keyof typeof FACH_LABEL] ?? g.fach}] ${(g.zuordnung?.name ?? g.gegenueber.name ?? g.gegenueber.email).slice(0, 40)} — ${g.betreff.slice(0, 90)}${g.ausschnitt ? ` · ${g.ausschnitt.slice(0, 160)}` : ''}`;

/** Für ZOE: offene Gespräche (ohne Suchwort) bzw. Treffer zu einem Suchwort — nur Kopf + Ausschnitt. */
export async function postfachFuerZoe(person: string, suche: string, anzahl = 20): Promise<{ text: string; treffer: number }> {
  const s = await stromFuer(person);
  if (!s.postfaecher.length) return { text: 'Für diese Person ist noch kein Postfach verbunden (Inbox › Postfach verbinden).', treffer: 0 };
  const q = suche.trim().toLowerCase();
  const liste = s.gespraeche
    .filter(g => g.fach !== 'geblockt' && (q ? `${g.betreff} ${g.ausschnitt} ${g.gegenueber.email} ${g.gegenueber.name ?? ''} ${g.zuordnung?.name ?? ''}`.toLowerCase().includes(q) : g.inArbeit && g.fach !== 'info'))
    .sort((a, b) => b.am.localeCompare(a.am)).slice(0, Math.max(1, Math.min(40, anzahl)));
  if (!liste.length) return { text: q ? `Kein Gespräch zu „${suche}“.` : 'Nichts offen in der Inbox.', treffer: 0 };
  const namen = Object.fromEntries(s.bereiche.map(b => [b.id, b.name]));
  const kopf = s.lage.map(l => lageText(l, l.bereich ? namen[l.bereich] ?? l.bereich : 'Ohne Bereich')).join('\n');
  return { text: `${q ? `GESPRÄCHE zu „${suche}“` : 'OFFEN IN DER INBOX'} (${liste.length}; nur Kopf und Ausschnitt):\n${liste.map(zeile).join('\n')}${q ? '' : `\n\nLAGE:\n${kopf}\nZOE: ${s.zoe.text}`}`, treffer: liste.length };
}
