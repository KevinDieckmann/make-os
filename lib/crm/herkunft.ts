// ─── Woher kommt dieser Lead? (rein, getestet, 03.10.) ───────────────────────
// Kevin (Qualifizierung): „An jeder Karte: woher der Lead kommt — besuchtes Event (und für welchen Kunden), Make.One,
// Kampagne, Empfehlung —, Foto der Visitenkarte als Vorschau, Sprachnotiz, letzte Aktivität.“ Alles aus vorhandenen
// Daten: Teilnahmen mit ihren Events, Kampagnen, `Kontakt.herkunft`/`quelle`, die Aktivitäten, dazu die Einträge der
// Dateiablage (Visitenkarte, Sprachnotiz) — die Dateien selbst lädt die Oberfläche nur über die geschützte Datei-Route.
// Kein neues Feld, nichts wird gespeichert.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event } from './typen';
import { istNetzwerkenEvent, eventName } from './marke';
import { kanalVon, kanalLabel, type KanalId } from './score';
import { HERKUNFT } from '@/lib/make-one/crm';
import { markttraktion } from './adresse';

export type HerkunftArt = 'event' | 'makeone' | 'kampagne' | 'empfehlung' | 'quelle' | 'visitenkarte' | 'sprache' | 'anfrage';
export interface HerkunftTeil {
  art: HerkunftArt;
  /** Ein Satz für die Karte, z. B. „Besuchtes Event · Maschinenbau-Messe · 12.09. · für Kunde Beispiel GmbH“. */
  text: string;
  /** Wohin ein Klick führt (Event-Akte, Kampagne) — nur interne Adressen. */
  href?: string;
  /** Eine Datei der Dateiablage (Visitenkarte, Sprachnotiz) — geladen wird sie über `/api/crm/dateien?id=…`. */
  dateiId?: string;
  datum?: string;
  kontaktId?: string;
}
export interface Herkunft {
  kanal: KanalId; kanalText: string;
  teile: HerkunftTeil[];
  /** Die jüngste echte Aktivität (nicht „system“) über alle Personen. */
  letzte?: { am: string; art: string; text?: string; kontaktId: string };
}

/** Ein Eintrag der Dateiablage, soweit die Herkunft ihn braucht. */
export interface AblageHinweis { id: string; kontaktId?: string; titel?: string; art?: string; datei?: { typ: string; name: string } }

const tagDE = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const kurzDatum = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

/** Besuchtes Event als Text: Name, Tag, und wenn es für einen Kunden lief, dessen Name. */
function eventText(e: Event, besucht: boolean, firmaName: (id: string) => string | undefined): string {
  const f = e.fuer && e.fuer.art === 'kunde' ? firmaName(e.fuer.firmaId) ?? 'einen Kunden' : undefined;
  return `${besucht ? `Besuchtes Event · ${e.titel}` : eventName(e)} · ${kurzDatum(e.datum)}${f ? ` · für Kunde ${f}` : ''}`;
}

export function herkunftVon(
  personen: readonly Kontakt[],
  crm: Pick<CrmBestand, 'events' | 'teilnahmen' | 'kampagnen' | 'firmen'>,
  ablage: readonly AblageHinweis[] = [],
): Herkunft {
  const ids = new Set(personen.map(p => p.id));
  const haupt = [...personen].sort((a, b) => (b.letzterKontakt ?? '').localeCompare(a.letzterKontakt ?? ''))[0];
  const kanal = kanalVon(haupt ?? ({} as Kontakt));
  const firmaName = (id: string) => crm.firmen.find(f => f.id === id)?.name;
  const events = new Map((crm.events ?? []).map(e => [e.id, e]));
  const teile: HerkunftTeil[] = [];

  // Events: wo wir die Person getroffen haben — besuchte Events (fremde Veranstaltung) und unsere eigenen Make.One-Abende.
  const jeEvent = new Map<string, { e: Event; kontaktId: string; status: string }>();
  for (const t of crm.teilnahmen ?? []) {
    if (!ids.has(t.kontaktId)) continue;
    const e = events.get(t.eventId);
    if (!e || t.status === 'abgesagt' || t.status === 'no_show') continue;
    jeEvent.set(e.id, { e, kontaktId: t.kontaktId, status: t.status });
  }
  for (const { e, kontaktId } of Array.from(jeEvent.values()).sort((a, b) => b.e.datum.localeCompare(a.e.datum))) {
    const besucht = istNetzwerkenEvent(e);
    teile.push({ art: besucht ? 'event' : 'makeone', text: eventText(e, besucht, firmaName), href: markttraktion(besucht ? 'besuche' : 'event', undefined, e.id), datum: e.datum, kontaktId });
  }
  // „Kennengelernt für Kunde“ (netz-recht, 03.10.): auf einem Event für einen Kunden getroffen — auch wenn die Teilnahme selbst fehlt.
  for (const p of personen) for (const kf of p.kennengelerntFuer ?? []) {
    if (jeEvent.has(kf.eventId)) continue;
    const e = events.get(kf.eventId);
    teile.push({ art: 'event', text: `Kennengelernt für Kunde ${firmaName(kf.firmaId) ?? 'einen Kunden'}${e ? ` · ${e.titel}` : ''} · ${kurzDatum(kf.am)}`, ...(e ? { href: markttraktion('besuche', undefined, e.id) } : {}), datum: kf.am, kontaktId: p.id });
  }
  for (const k of (crm.kampagnen ?? []).filter(x => x.kontaktIds.some(id => ids.has(id)))) {
    const erg = k.ergebnisse.filter(r => ids.has(r.kontaktId)).sort((a, b) => b.am.localeCompare(a.am))[0];
    teile.push({ art: 'kampagne', text: `Kampagne · ${k.name}${erg ? ` · ${tagDE(erg.am.slice(0, 10))}` : ''}`, href: markttraktion('marketing', 'kampagnen'), ...(erg ? { datum: erg.am.slice(0, 10) } : {}) });
  }
  // Herkunft der Person: Empfehlung, Anfrage, sonst die Quelle aus der Liste — nur, was nicht schon ein Event erklärt.
  for (const p of personen) {
    if (p.herkunft === 'empfehlung') teile.push({ art: 'empfehlung', text: `Empfehlung${p.quelle ? ` · ${p.quelle}` : ''}`, kontaktId: p.id });
    else if (p.herkunft === 'selbst') teile.push({ art: 'anfrage', text: 'Hat selbst angefragt', kontaktId: p.id });
    else if (p.herkunft !== 'veranstaltung' && (p.quelle || p.herkunft)) teile.push({ art: 'quelle', text: `${HERKUNFT.find(h => h.id === p.herkunft)?.label ?? 'Quelle'}${p.quelle ? ` · ${p.quelle}` : ''}`, kontaktId: p.id });
  }
  // Dateien der Ablage: Foto der Visitenkarte, Sprachnotiz — neueste zuerst, je Person höchstens drei Karten.
  for (const a of ablage) {
    if (!a.kontaktId || !ids.has(a.kontaktId) || !a.datei) continue;
    const bild = a.datei.typ.startsWith('image/') && /^Visitenkarte/i.test(a.titel ?? '');
    const sprache = a.datei.typ.startsWith('audio/');
    if (bild) teile.push({ art: 'visitenkarte', text: a.titel ?? 'Visitenkarte', dateiId: a.id, kontaktId: a.kontaktId });
    else if (sprache) teile.push({ art: 'sprache', text: a.titel ?? 'Sprachnotiz', dateiId: a.id, kontaktId: a.kontaktId });
  }
  const aktiv = personen.flatMap(p => (p.aktivitaeten ?? []).filter(a => a.art !== 'system' && a.von !== 'system' && a.art !== 'uebergabe').map(a => ({ am: a.am, art: a.art, ...(a.text ? { text: a.text } : {}), kontaktId: p.id }))).sort((a, b) => b.am.localeCompare(a.am))[0];
  return { kanal, kanalText: kanalLabel(kanal), teile, ...(aktiv ? { letzte: aktiv } : {}) };
}

/** „zuletzt vor 3 Tagen“ — für die Karte; ohne Aktivität „noch keine Aktivität“. */
export function letzteAktivitaetText(h: Pick<Herkunft, 'letzte'>, heute: string, personName?: (id: string) => string): string {
  if (!h.letzte) return 'Noch keine Aktivität';
  const t = Math.max(0, Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${h.letzte.am.slice(0, 10)}T12:00:00Z`)) / 864e5));
  const wann = t === 0 ? 'heute' : t === 1 ? 'gestern' : `vor ${t} Tagen`;
  const art = ({ mail: 'Mail', linkedin: 'LinkedIn', anruf: 'Anruf', antwort: 'Antwort', termin: 'Termin', notiz: 'Notiz', gespraech: 'Gespräch', event: 'Event', stufe: 'Stufe' } as Record<string, string>)[h.letzte.art] ?? 'Aktivität';
  return `Letzte Aktivität: ${art} ${wann}${personName ? ` (${personName(h.letzte.kontaktId)})` : ''}`;
}
