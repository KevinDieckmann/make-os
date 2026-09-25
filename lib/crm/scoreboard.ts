// ─── Markttraktion — Rhythmus & Push (rein, getestet) ──────────────────────
// Ohne Rhythmus lebt das System davon, dass man es öffnet. Drei Dinge drehen
// das um (25.09.):
//
//   Verlauf      einmal je Tag ein Schnappschuss des Traction-Scores (Speicher
//                „traktion-verlauf“, höchstens 400 Tage, der letzte Stand des
//                Tages gilt) — damit sichtbar wird, ob es besser wird, und
//                nicht nur, wie es heute steht.
//   Scoreboard   der EOS-Gedanke: wenige Kennzahlen, Woche für Woche, mit
//                Ziel. RÜCKWIRKEND aus den echten Daten gerechnet (Power
//                Hours, Verlauf, Chancen, Redaktionsplan, Events) — keine
//                eigene Buchführung, die mit der Wirklichkeit auseinander-
//                laufen könnte. Kalenderwochen Mo–So, die laufende als letzte.
//   Push         werktags ab 7:30 die Morgen-Nachricht je Person, freitags ab
//                15 Uhr das Wochen-Scoreboard — per Telegram an Kevin und
//                Malin selbst, nie an Kunden. Ohne Modell, ohne Beträge, ohne
//                Namen von Kontakten: nur Zahlen und wohin es geht.
//
// Grau heißt „noch nichts gemessen“ (Wochen vor der ersten Power Hour, dem
// ersten Beitrag, dem ersten Event …) — nie eine erfundene Null. Die laufende
// Woche wird erst am Sonntag bewertet: vorher ist sie grün, wenn das Ziel
// schon steht, sonst „offen“ — ein Montagmorgen ist nicht rot.

import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand, Event } from './typen';
import type { KpiAmpel } from './kennzahlen';
import type { Traktion, Welt } from './traktion';
import { followUpBis } from './events';
import { werIstDran } from './heute';
import { fuerDich, nameVon, TEAM } from './team';
import { localDay } from '@/lib/zeit';

const tagPlus = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const tag = (v?: string) => (v ?? '').slice(0, 10);
const TAG_MUSTER = /^\d{4}-\d{2}-\d{2}$/;
/** Frühestes Datum einer Liste — null, wenn nichts da ist. */
const fruehestes = (liste: string[]) => liste.filter(d => TAG_MUSTER.test(d)).sort()[0] ?? null;

// ── Verlauf des Traction-Scores ────────────────────────────────────────────

export const VERLAUF_SPEICHER = 'traktion-verlauf';
export const VERLAUF_MAX = 400;

export interface PersonWoche { powerHours: number; gespraeche: number }
export interface VerlaufTag {
  tag: string;
  score: number | null;
  welten: Record<Welt, number | null>;
  /** Je Team-Mitglied: Power Hours und echte Gespräche der letzten sieben Tage. */
  jePerson?: Record<string, PersonWoche>;
}
export interface TraktionVerlauf { tage: VerlaufTag[] }

/** Der Schnappschuss eines Tages aus dem gerechneten Traction-Score. */
export function verlaufEintrag(t: Traktion, heute: string, jePerson?: Record<string, PersonWoche>): VerlaufTag {
  const welt = (id: Welt) => t.welten.find(w => w.id === id)?.score ?? null;
  return { tag: heute, score: t.score, welten: { sales: welt('sales'), marketing: welt('marketing'), event: welt('event') }, ...(jePerson ? { jePerson } : {}) };
}

/**
 * Den Verlauf um einen Tag fortschreiben: derselbe Tag wird ersetzt (der
 * letzte Stand des Tages gilt), die Liste bleibt nach Tag sortiert und hält
 * höchstens `max` Tage — die neuesten. Kaputte Einträge fallen heraus; ein
 * fehlender oder beschädigter Speicher beginnt einfach neu.
 */
export function verlaufFortschreiben(stand: unknown, eintrag: VerlaufTag, max = VERLAUF_MAX): TraktionVerlauf {
  const roh = (stand as TraktionVerlauf | null)?.tage;
  const alt = Array.isArray(roh) ? roh.filter(t => t && typeof t.tag === 'string' && TAG_MUSTER.test(t.tag) && t.tag !== eintrag.tag) : [];
  const tage = [...alt, eintrag].sort((a, b) => a.tag.localeCompare(b.tag));
  return { tage: tage.slice(-Math.max(1, Math.floor(max))) };
}

/** Hat sich gegenüber dem gespeicherten Tagesstand etwas geändert? Sonst muss nicht geschrieben werden. */
export function gleicherStand(a: VerlaufTag | undefined, b: VerlaufTag): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

/** Die letzten `tage` Tage bis heute (Standard 90). */
export function verlaufSeit(stand: TraktionVerlauf | null | undefined, heute: string, tage = 90): VerlaufTag[] {
  const ab = tagPlus(heute, -(tage - 1));
  return (Array.isArray(stand?.tage) ? stand!.tage : []).filter(t => t.tag >= ab && t.tag <= heute);
}

// ── Gemeinsame Zählregeln ──────────────────────────────────────────────────

/** Echtes Gespräch: Art Gespräch/Termin oder Ergebnis Gespräch/Termin — wie die Kennzahl „Echte Gespräche“ (kennzahlen.ts), ohne System-Einträge. */
const istGespraech = (a: { art: string; ergebnis?: string; von?: string }) =>
  a.von !== 'system' && a.art !== 'system' && (a.ergebnis === 'gespraech' || a.ergebnis === 'termin' || a.art === 'gespraech' || a.art === 'termin');
const stattgefunden = (e: Event, heute: string) => e.status !== 'abgesagt' && (e.status === 'durchgefuehrt' || e.datum < heute);

/** Power Hours und echte Gespräche je Team-Mitglied in den letzten sieben Tagen (für den Tages-Schnappschuss). */
export function jePersonSieben(kontakte: Kontakt[], crm: CrmBestand, heute: string): Record<string, PersonWoche> {
  const ab = tagPlus(heute, -6);
  const drin = (d: string) => d >= ab && d <= heute;
  const gespraeche = kontakte.flatMap(k => (k.aktivitaeten ?? []).filter(istGespraech).map(a => ({ von: a.von, tag: tag(a.am) })));
  return Object.fromEntries(TEAM.map(t => [t.id, {
    powerHours: (crm.sitzungen ?? []).filter(s => s.person === t.id && drin(s.datum)).length,
    gespraeche: gespraeche.filter(g => g.von === t.id && drin(g.tag)).length,
  }]));
}

// ── Wochen-Scoreboard ──────────────────────────────────────────────────────

/** Ziele je Woche (Team). Startwerte aus den Kennzahlen des Konzepts — nach acht Wochen zu kalibrieren. */
export const SCORE_ZIELE = { power_hours: 4, gespraeche: 8, neue_chancen: 1, beitraege: 2, nachfassen_48h: 90 } as const;

/** Montag der Kalenderwoche, in der `d` liegt. */
export function montagVon(d: string): string {
  const x = new Date(`${d}T12:00:00Z`);
  return tagPlus(d, -((x.getUTCDay() + 6) % 7));
}

/** Kalenderwoche nach ISO 8601: die Woche gehört dem Jahr ihres Donnerstags. */
export function kalenderwoche(d: string): { kw: number; jahr: number } {
  const donnerstag = new Date(`${tagPlus(montagVon(d), 3)}T12:00:00Z`);
  const jahr = donnerstag.getUTCFullYear();
  const tageSeitNeujahr = Math.round((donnerstag.getTime() - Date.UTC(jahr, 0, 1, 12)) / 864e5);
  return { kw: 1 + Math.floor(tageSeitNeujahr / 7), jahr };
}

export interface ScoreWoche { von: string; bis: string; kw: number; label: string; laufend: boolean }

/** Die letzten `n` Kalenderwochen, älteste zuerst, die laufende als letzte. */
export function wochenBis(heute: string, n: number): ScoreWoche[] {
  const mo = montagVon(heute);
  return Array.from({ length: n }, (_, i) => {
    const von = tagPlus(mo, -7 * (n - 1 - i));
    const { kw } = kalenderwoche(von);
    return { von, bis: tagPlus(von, 6), kw, label: `KW ${kw}`, laufend: i === n - 1 };
  });
}

/** Ampel einer Zelle — „offen“: gemessen, aber (noch) nicht zu bewerten. */
export type ScoreAmpel = KpiAmpel | 'offen';
export interface ScoreZeile {
  id: string;
  welt: Welt;
  label: string;
  /** Gesetzt bei den Zeilen je Person (Power Hours, Gespräche). */
  person?: string;
  ziel: number | null;
  zielText: string;
  einheit?: '%';
  werte: (number | null)[];
  ampeln: ScoreAmpel[];
  quelle: string;
}
export interface Scoreboard { heute: string; wochen: ScoreWoche[]; zeilen: ScoreZeile[] }

export function bewerte(wert: number | null, ziel: number | null, gelbAb: number | null, laufend: boolean, quote = false): ScoreAmpel {
  if (wert === null) return 'grau';
  if (ziel === null) return 'offen';
  if (wert >= ziel) return 'gruen';
  // Eine Anzahl wächst bis Sonntag — erst dann ist „zu wenig“ ein Befund. Eine Quote steht schon.
  if (laufend && !quote) return 'offen';
  return gelbAb !== null && wert >= gelbAb ? 'gelb' : 'rot';
}

interface Spez {
  id: string; welt: Welt; label: string; person?: string;
  ziel: number | null; gelbAb: number | null; quote?: boolean; quelle: string;
  /** Ab wann gemessen wird — davor grau. null = gar nicht. */
  ab: string | null;
  zaehle: (w: ScoreWoche) => number | null;
}

/**
 * Das Scoreboard: Zeilen je Kennzahl, Spalten je Kalenderwoche. Sales mit
 * Power Hours und Gesprächen zusätzlich je Person (Anteil am Teamziel =
 * Teamziel geteilt durch die Zahl der Team-Mitglieder, aufgerundet).
 */
export function wochenScoreboard(kontakte: Kontakt[], crm: CrmBestand, heute: string, wochen = 8): Scoreboard {
  const W = wochenBis(heute, Math.max(1, Math.min(52, Math.round(wochen) || 8)));
  const drin = (d: string, w: ScoreWoche) => d >= w.von && d <= w.bis && d <= heute;

  const sitzungen = crm.sitzungen ?? [];
  const aktivitaeten = kontakte.flatMap(k => (k.aktivitaeten ?? []).filter(a => a.von !== 'system' && a.art !== 'system'));
  const gespraeche = aktivitaeten.filter(istGespraech).map(a => ({ von: a.von, tag: tag(a.am) }));
  const chancen = crm.chancen ?? [];
  const beitraege = crm.beitraege ?? [];
  const veroeffentlicht = beitraege.filter(b => b.status === 'veroeffentlicht' && b.datum);
  const wirkung = beitraege.flatMap(b => (b.wirkung ?? []).filter(x => x.art === 'gespraech' || x.art === 'anfrage').map(x => ({ schluessel: `${b.id}|${x.kontaktId}`, tag: tag(x.am) })));
  const events = crm.events ?? [];
  const nachEvent = new Map(events.map(e => [e.id, e]));
  // Nachfassen zählt nur bei Gästen, deren Frist vorbei ist oder die schon nachgefasst sind (wie die Kennzahl).
  const gaeste = (crm.teilnahmen ?? []).filter(t => t.status === 'da' && nachEvent.has(t.eventId))
    .map(t => ({ t, e: nachEvent.get(t.eventId)! })).filter(({ t, e }) => !!t.followUpAm || followUpBis(e) < heute);

  const abSitzung = fruehestes(sitzungen.map(s => s.datum));
  const abVerlauf = fruehestes(aktivitaeten.map(a => tag(a.am)));
  const abChance = fruehestes(chancen.map(c => tag(c.angelegt)));
  const abBeitrag = fruehestes(beitraege.flatMap(b => [tag(b.datum), tag(b.geaendert)]));
  const abContent = veroeffentlicht.length || wirkung.length ? fruehestes([...veroeffentlicht.map(b => tag(b.datum)), ...wirkung.map(x => x.tag)]) : null;
  const abEvent = fruehestes(events.flatMap(e => [e.datum, tag(e.geaendert)]));

  const anzahl = <T,>(liste: T[], datum: (x: T) => string) => (w: ScoreWoche) => liste.filter(x => drin(datum(x), w)).length;
  const anteil = (z: number) => Math.ceil(z / Math.max(1, TEAM.length));

  const personen = (id: 'power_hours' | 'gespraeche'): Spez[] => TEAM.map(t => id === 'power_hours'
    ? { id: `power_hours:${t.id}`, welt: 'sales', label: 'Power Hours', person: t.id, ziel: anteil(SCORE_ZIELE.power_hours), gelbAb: Math.ceil(anteil(SCORE_ZIELE.power_hours) / 2), quelle: `Power Hours von ${t.name}`, ab: abSitzung, zaehle: anzahl(sitzungen.filter(s => s.person === t.id), s => s.datum) }
    : { id: `gespraeche:${t.id}`, welt: 'sales', label: 'Echte Gespräche', person: t.id, ziel: anteil(SCORE_ZIELE.gespraeche), gelbAb: Math.ceil(anteil(SCORE_ZIELE.gespraeche) / 2), quelle: `Gespräche und Termine, festgehalten von ${t.name}`, ab: abVerlauf, zaehle: anzahl(gespraeche.filter(g => g.von === t.id), g => g.tag) });

  const spez: Spez[] = [
    { id: 'power_hours', welt: 'sales', label: 'Power Hours', ziel: SCORE_ZIELE.power_hours, gelbAb: SCORE_ZIELE.power_hours / 2, quelle: 'Power-Hour-Sitzungen', ab: abSitzung, zaehle: anzahl(sitzungen, s => s.datum) },
    ...personen('power_hours'),
    { id: 'gespraeche', welt: 'sales', label: 'Echte Gespräche', ziel: SCORE_ZIELE.gespraeche, gelbAb: SCORE_ZIELE.gespraeche / 2, quelle: 'Gespräche und Termine im Verlauf (ohne System)', ab: abVerlauf, zaehle: anzahl(gespraeche, g => g.tag) },
    ...personen('gespraeche'),
    { id: 'neue_chancen', welt: 'sales', label: 'Neue SQL → Deals', ziel: SCORE_ZIELE.neue_chancen, gelbAb: null, quelle: 'Leads, die SQL wurden (Deals angelegt)', ab: abChance, zaehle: anzahl(chancen, c => tag(c.angelegt)) },
    { id: 'gewonnen', welt: 'sales', label: 'Gewonnene Deals', ziel: null, gelbAb: null, quelle: 'Stufe „gewonnen“ in der Historie', ab: abChance,
      zaehle: w => chancen.filter(c => (c.historie ?? []).some(h => h.stufe === 'gewonnen' && drin(tag(h.am), w))).length },
    { id: 'beitraege', welt: 'marketing', label: 'Veröffentlichte Beiträge', ziel: SCORE_ZIELE.beitraege, gelbAb: SCORE_ZIELE.beitraege / 2, quelle: 'Redaktionsplan, Status veröffentlicht', ab: abBeitrag, zaehle: anzahl(veroeffentlicht, b => tag(b.datum)) },
    { id: 'content_gespraeche', welt: 'marketing', label: 'Gespräche aus Content', ziel: null, gelbAb: null, quelle: 'Wirkung „Gespräch“ oder „Anfrage“ an Beiträgen, je Person und Beitrag einmal', ab: abContent,
      zaehle: w => new Set(wirkung.filter(x => drin(x.tag, w)).map(x => x.schluessel)).size },
    { id: 'events', welt: 'event', label: 'Durchgeführte Events', ziel: null, gelbAb: null, quelle: 'Events, die stattgefunden haben', ab: abEvent, zaehle: anzahl(events.filter(e => stattgefunden(e, heute)), e => e.datum) },
    { id: 'nachfassen_48h', welt: 'event', label: 'Nachgefasst binnen 48 h', ziel: SCORE_ZIELE.nachfassen_48h, gelbAb: 60, quote: true, quelle: 'Gäste der Events dieser Woche, deren Frist vorbei ist', ab: abEvent,
      zaehle: w => {
        const g = gaeste.filter(x => drin(x.e.datum, w));
        if (!g.length) return null;
        return Math.round((g.filter(x => x.t.followUpAm && tag(x.t.followUpAm) <= followUpBis(x.e)).length / g.length) * 100);
      } },
  ];

  const zeilen: ScoreZeile[] = spez.map(s => {
    const werte = W.map(w => (s.ab === null || w.bis < s.ab ? null : s.zaehle(w)));
    return {
      id: s.id, welt: s.welt, label: s.label, ...(s.person ? { person: s.person } : {}),
      ziel: s.ziel, zielText: s.ziel === null ? '—' : `≥ ${s.ziel}${s.quote ? ' %' : ''}`, ...(s.quote ? { einheit: '%' as const } : {}),
      werte, ampeln: werte.map((v, i) => bewerte(v, s.ziel, s.gelbAb, W[i].laufend, s.quote)), quelle: s.quelle,
    };
  });
  return { heute, wochen: W, zeilen };
}

// ── Texte für Telegram ─────────────────────────────────────────────────────

export const MARKTTRAKTION_PFAD = '/os/markttraktion';
export interface TextOptionen { /** Adresse, unter der MAKE OS geöffnet wird (MAKE_OS_ADRESSE) — damit der Link im Handy klickbar ist. */ adresse?: string | null }

const mz = (n: number, eins: string, mehr: string) => `${n} ${n === 1 ? eins : mehr}`;
const link = (o: TextOptionen) => `→ ${(o.adresse ?? '').trim().replace(/\/+$/, '')}${MARKTTRAKTION_PFAD}`;
const kurzDatum = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const zeitraum = (w: ScoreWoche) => (w.von.slice(5, 7) === w.bis.slice(5, 7) ? `${w.von.slice(8, 10)}.–${kurzDatum(w.bis)}` : `${kurzDatum(w.von)}–${kurzDatum(w.bis)}`);

/** „Für dich“ in Kurzform. Unbekannte Punkte (neue Regeln in team.ts) kommen mit Titel und Zahl. */
const FUER_DICH_KURZ: Record<string, (n: number) => string> = {
  'chancen-ohne-schritt': n => `${mz(n, 'Chance', 'Chancen')} ohne nächsten Schritt`,
  reviews: n => `${mz(n, 'Kundenreview', 'Kundenreviews')} in 7 Tagen`,
  freigaben: n => `${mz(n, 'Freigabe wartet', 'Freigaben warten')} auf dich`,
  aenderungen: n => `${mz(n, 'Änderungswunsch', 'Änderungswünsche')} zu deinen Texten`,
  beitraege: n => `${mz(n, 'Beitrag', 'Beiträge')} in den nächsten 7 Tagen`,
  checkliste: n => `${mz(n, 'Event-Punkt', 'Event-Punkte')} fällig`,
  nachfassen: n => `${mz(n, 'Gast', 'Gäste')} nachfassen`,
  kampagnen: n => `${mz(n, 'Person', 'Personen')} aus deinen Kampagnen noch offen`,
};
/** Steckt schon in der Power Hour (Kategorie „Versprechen“) — nicht doppelt nennen. */
const SCHON_IN_DER_POWER_HOUR = new Set(['zusagen']);

/**
 * Die Morgen-Nachricht einer Person — kurz, ohne Floskeln, nur Zahlen:
 * was in ihrer Power Hour liegt, was sonst bei ihr wartet, wo ihre Woche
 * steht, und der Weg dorthin. Keine Beträge, keine Namen von Kontakten.
 */
export function morgenText(person: string, kontakte: Kontakt[], crm: CrmBestand, heute: string, o: TextOptionen = {}): string {
  const teile: string[] = [];
  const ph = werIstDran(kontakte, crm, heute, person).karten;
  if (ph.length) {
    const zusagen = ph.filter(k => k.kategorie === 'versprechen').length;
    const warten = ph.filter(k => k.kategorie === 'signale').length;
    const klammer = [zusagen ? mz(zusagen, 'Zusage', 'Zusagen') : '', warten ? `${warten} ${warten === 1 ? 'wartet' : 'warten'} auf Antwort` : ''].filter(Boolean);
    teile.push(`${ph.length} in deiner Power Hour${klammer.length ? ` (${klammer.join(', ')})` : ''}`);
  }
  for (const f of fuerDich(person, kontakte, crm, heute)) {
    if (SCHON_IN_DER_POWER_HOUR.has(f.id) || !f.anzahl) continue;
    teile.push(FUER_DICH_KURZ[f.id]?.(f.anzahl) ?? `${f.titel} (${f.anzahl})`);
  }
  const z: string[] = [`Guten Morgen, ${nameVon(person)}.`];
  z.push(teile.length ? `Markttraktion heute: ${teile.join(', ')}.` : 'Markttraktion heute: nichts Fälliges bei dir.');

  // Wo die eigene Woche steht — Anteil am Teamziel, aus dem Scoreboard.
  const sb = wochenScoreboard(kontakte, crm, heute, 1);
  const eigen = (id: string) => sb.zeilen.find(r => r.id === `${id}:${person}`);
  const phZ = eigen('power_hours'), gZ = eigen('gespraeche');
  const montag = montagVon(heute) === heute;
  const woche = [
    phZ && phZ.werte[0] !== null ? (montag ? mz(phZ.ziel ?? 0, 'Power Hour', 'Power Hours') : `${phZ.werte[0]} von ${phZ.ziel} Power Hours`) : '',
    gZ && gZ.werte[0] !== null ? (montag ? mz(gZ.ziel ?? 0, 'Gespräch', 'Gespräche') : `${gZ.werte[0]} von ${gZ.ziel} Gesprächen`) : '',
  ].filter(Boolean);
  if (woche.length) z.push(montag ? `Neue Woche — dein Anteil: ${woche.join(', ')}.` : `Deine Woche bisher: ${woche.join(', ')}.`);
  z.push(link(o));
  return z.join('\n');
}

/**
 * Das Wochen-Scoreboard für Freitagnachmittag: jede gemessene Kennzahl der
 * laufenden Woche gegen ihr Ziel, Power Hours und Gespräche je Person, und
 * zum Schluss die eigene Zeile der Person, die es bekommt.
 */
export function wochenText(person: string, kontakte: Kontakt[], crm: CrmBestand, heute: string, o: TextOptionen = {}): string {
  const sb = wochenScoreboard(kontakte, crm, heute, 1);
  const w = sb.wochen[0];
  const zeigen = (r: ScoreZeile) => `${r.werte[0]}${r.einheit ? ' %' : ''}`;
  const gegen = (r: ScoreZeile) => (r.ziel === null ? zeigen(r) : r.einheit ? `${zeigen(r)} (Ziel ${r.ziel} %)` : `${r.werte[0]} von ${r.ziel}`) + (r.ampeln[0] === 'gruen' ? ' ✓' : '');
  const z: string[] = [`Wochen-Scoreboard ${w.label} · ${zeitraum(w)}`];
  const WELTEN_TEXT: [Welt, string][] = [['sales', 'Sales'], ['marketing', 'Marketing'], ['event', 'Event']];
  for (const [welt, label] of WELTEN_TEXT) {
    const zeilen = sb.zeilen.filter(r => r.welt === welt && !r.person && r.werte[0] !== null);
    if (!zeilen.length) continue;
    z.push('', label);
    for (const r of zeilen) {
      const je = sb.zeilen.filter(p => p.person && p.id.startsWith(`${r.id}:`) && p.werte[0] !== null);
      z.push(`• ${r.label}: ${gegen(r)}${je.length ? ` (${je.map(p => `${nameVon(p.person)} ${p.werte[0]}`).join(', ')})` : ''}`);
    }
  }
  if (z.length === 1) z.push('', 'Noch nichts gemessen — das Scoreboard füllt sich mit den ersten Power Hours, Beiträgen und Events.');
  const eigen = sb.zeilen.filter(r => r.person === person && r.werte[0] !== null);
  if (eigen.length) z.push('', `Du: ${eigen.map(r => `${r.werte[0]} von ${r.ziel} ${r.id.startsWith('power_hours') ? 'Power Hours' : 'Gesprächen'}${r.ampeln[0] === 'gruen' ? ' ✓' : ''}`).join(', ')}.`);
  z.push('', `Bis Sonntag zählt noch mit. ${link(o)}`);
  return z.join('\n');
}

// ── Der Takt: wann wer welche Nachricht bekommt ────────────────────────────

export const RHYTHMUS_SPEICHER = 'markttraktion-takt';
export type RhythmusSlot = 'morgen' | 'woche';
export const RHYTHMUS_SLOTS: readonly RhythmusSlot[] = ['morgen', 'woche'];
/**
 * Fenster in Minuten ab Mitternacht (lokale Zeit). Verpasst = ausgelassen,
 * nicht nachgeholt: eine Morgen-Nachricht am Nachmittag wäre nur Rauschen.
 * morgen: werktags 7:30–12:00 · woche: freitags 15:00–22:00.
 */
export const RHYTHMUS_FENSTER: Record<RhythmusSlot, { ab: number; bis: number }> = {
  morgen: { ab: 7 * 60 + 30, bis: 12 * 60 },
  woche: { ab: 15 * 60, bis: 22 * 60 },
};
/** So oft wird ein Slot am Tag versucht, wenn Telegram ihn nicht zustellt. */
export const RHYTHMUS_VERSUCHE = 3;

/** Riegel je Person: an welchem Tag welcher Slot zugestellt wurde, dazu die Fehlversuche des Tages. */
export interface RhythmusPerson { morgen?: string; woche?: string; versuche?: Record<string, number> }
export type RhythmusStand = Record<string, RhythmusPerson>;

/** Speicherinhalt säubern — ein kaputter Eintrag darf den Takt nicht anhalten. */
export function rhythmusStand(roh: unknown): RhythmusStand {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {};
  const s: RhythmusStand = {};
  for (const [p, v] of Object.entries(roh as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const x = v as RhythmusPerson;
    s[p] = {
      ...(typeof x.morgen === 'string' ? { morgen: x.morgen } : {}),
      ...(typeof x.woche === 'string' ? { woche: x.woche } : {}),
      ...(x.versuche && typeof x.versuche === 'object' ? { versuche: { ...x.versuche } } : {}),
    };
  }
  return s;
}

/** Was ist jetzt fällig — je Person (nur, wer ein Konto hat und gekoppelt ist; das filtert der Aufrufer)? */
export function faelligeRhythmen(stand: RhythmusStand, personen: string[], jetzt: Date): { person: string; slot: RhythmusSlot }[] {
  const heute = localDay(jetzt);
  const min = jetzt.getHours() * 60 + jetzt.getMinutes();
  const wtag = jetzt.getDay();
  const raus: { person: string; slot: RhythmusSlot }[] = [];
  for (const person of personen) {
    const s = stand[person] ?? {};
    for (const slot of RHYTHMUS_SLOTS) {
      if (slot === 'morgen' && (wtag === 0 || wtag === 6)) continue;
      if (slot === 'woche' && wtag !== 5) continue;
      const f = RHYTHMUS_FENSTER[slot];
      if (min < f.ab || min >= f.bis) continue;
      if (s[slot] === heute) continue;
      if ((s.versuche?.[`${slot}:${heute}`] ?? 0) >= RHYTHMUS_VERSUCHE) continue;
      raus.push({ person, slot });
    }
  }
  return raus;
}

/** Zustellung vermerken: zugestellt → Riegel für heute; nicht zugestellt → ein Fehlversuch mehr. Alte Fehlversuche fallen weg. */
export function markiereRhythmus(stand: RhythmusStand, person: string, slot: RhythmusSlot, heute: string, zugestellt: boolean): RhythmusStand {
  const alt = stand[person] ?? {};
  const versuche = Object.fromEntries(Object.entries(alt.versuche ?? {}).filter(([k]) => k.endsWith(`:${heute}`)));
  if (zugestellt) delete versuche[`${slot}:${heute}`];
  else versuche[`${slot}:${heute}`] = (versuche[`${slot}:${heute}`] ?? 0) + 1;
  const neu: RhythmusPerson = { ...alt, ...(zugestellt ? { [slot]: heute } : {}) };
  if (Object.keys(versuche).length) neu.versuche = versuche; else delete neu.versuche;
  return { ...stand, [person]: neu };
}
