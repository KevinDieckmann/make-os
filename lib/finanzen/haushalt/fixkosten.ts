// ─── Fixkosten, Sockel, Rhythmus (aus Malins ansicht-fixkosten.js) ──────────
// Zwei Fragen, bewusst getrennt: FIXKOSTEN — was kostet unser Leben jeden
// Monat, egal was passiert? BUDGET — was wollen wir bei beeinflussbaren
// Ausgaben ausgeben? Quartals- und Jahreszahlungen werden über den Turnus auf
// den Monat gerechnet, nicht über einen Drei-Monats-Schnitt.

import type { Buchung, Schuld, Turnus } from './typen';
import { normal, proMonat } from './regeln';
import { inMonaten, kennzahlen } from './kennzahlen';
import { monatVon, monatsAbstand, vollMonate, heuteBerlin } from './monat';
import { TILGUNG, type KatName } from './einordnung';

export interface Sockelposten {
  name: string; turnus: Turnus; mittel: number; proMonat: number; anzahl: number;
  /** Seit 27.09. (Fixkosten bearbeiten): die Buchungen dahinter, Kategorie/Konto der jüngsten, Rhythmus aus den Abständen. */
  ids: string[]; kategorie_id: string | null; konto_id: string | null; monate: number;
  vorschlag: Turnus; unsicher: boolean; geklaert: boolean;
}

/**
 * Sockel = Σ Monatswert je Fixkosten-Empfänger (12 volle Monate) + Kreditraten. Cent.
 *
 * 24.09., gefunden beim Umzug: Bei Malin zählte eine Kreditrate doppelt, wenn
 * die Zahlung als Fixkosten markiert war — einmal als Fixkosten-Posten, einmal
 * als Rate aus den Schulden. Jetzt laufen Tilgungs-Zahlungen (Kategorie
 * „Tilgung“ / „Kredit & Raten“) nicht in die Fixkosten-Posten; für die Raten
 * zählt der höhere Wert aus Schulden-Liste und markierten Tilgungs-Zahlungen —
 * so fehlt eine Rate auch dann nicht, wenn die Schuld nicht erfasst ist.
 */
export function sockel(buchungen: Buchung[], schulden: Schuld[], heute: string = heuteBerlin(), katName: KatName = () => '') {
  const monate = vollMonate(12, 0, heute);
  const alleFix = inMonaten(buchungen, monate).filter(b => !b.ist_umbuchung && b.ist_fixkosten && b.betrag < 0);
  const istTilgung = (b: Buchung) => !!b.kategorie_id && TILGUNG.includes(katName(b.kategorie_id));
  const fix = alleFix.filter(b => !istTilgung(b));
  const tilgungFix = posten(alleFix.filter(istTilgung), monate.length).reduce((s, p) => s + p.proMonat, 0);
  const liste = posten(fix, monate.length);
  const ausBuchungen = liste.reduce((s, p) => s + p.proMonat, 0);
  const ratenSchulden = schulden.reduce((s, x) => s + (Number(x.rate) || 0), 0);
  const raten = Math.max(ratenSchulden, tilgungFix);
  return { ausBuchungen, raten, ratenSchulden, ratenBuchungen: tilgungFix, gesamt: ausBuchungen + raten, monate, anzahl: fix.length, posten: liste };
}

/** Monatswert eines Postens: Turnus-Faktor auf das Mittel — „unregelmäßig“ rechnet ehrlich mit Σ aller Zahlungen im Fenster / Fenstermonate. */
export function postenProMonat(betraege: number[], turnus: Turnus, fensterMonate: number): number {
  if (!betraege.length) return 0;
  const summe = betraege.reduce((a, c) => a + Math.abs(c), 0);
  if (turnus === 'unregelmaessig') return summe / Math.max(1, fensterMonate);
  return proMonat(summe / betraege.length, turnus);
}

/** Fixkosten-Buchungen je Empfänger zu Posten mit Monatswert. Jüngste Buchung zuerst → deren Kategorie/Konto gilt für die Anzeige. */
export function posten(fix: Buchung[], fensterMonate = 12): Sockelposten[] {
  const grp = new Map<string, { name: string; zeilen: Buchung[] }>();
  for (const b of fix.slice().sort((a, c) => c.datum.localeCompare(a.datum))) {
    const k = normal(b.empfaenger || b.beschreibung);
    const g = grp.get(k) ?? { name: b.empfaenger || b.beschreibung, zeilen: [] };
    g.zeilen.push(b);
    grp.set(k, g);
  }
  return Array.from(grp.values()).map(g => {
    const z = g.zeilen;
    const betraege = z.map(b => Math.abs(b.betrag));
    const mittel = betraege.reduce((a, c) => a + c, 0) / betraege.length;
    const monateListe = Array.from(new Set(z.map(b => monatVon(b.datum))));
    const geklaert = z.some(b => b.turnus_geklaert === true);
    // Der Turnus, den jemand gesetzt hat (bestätigt zuerst, sonst der der jüngsten Buchung).
    const turnus: Turnus = z.find(b => b.turnus_geklaert === true)?.turnus ?? z[0].turnus ?? 'monatlich';
    const v = rhythmusVorschlag(monateListe);
    return {
      name: g.name, turnus, mittel, proMonat: postenProMonat(betraege, turnus, fensterMonate), anzahl: z.length,
      ids: z.map(b => b.id), kategorie_id: z[0].kategorie_id ?? null, konto_id: z[0].konto_id ?? null, monate: monateListe.length,
      vorschlag: v.turnus, unsicher: !geklaert && !v.sicher && z.length > 1, geklaert,
    };
  }).sort((a, c) => c.proMonat - a.proMonat);
}

/**
 * Rhythmus aus den Abständen: ≤ 1,4 → monatlich, 2,4–4,2 → quartal, 5–7 → halbjahr, ≥ 10 → jahr, sonst null (unklar).
 * 27.09.: Abstände, die um mehr als zwei Monate auseinanderliegen (z. B. 1 · 5 · 1 · 6), sind kein Rhythmus —
 * vorher galt so etwas über den Schnitt als „quartal“. Jetzt heißt es „unklar“, und Malin klärt es per Klick.
 */
export function rhythmus(monate: string[]): Turnus | null {
  if (monate.length < 2) return null;
  const s = Array.from(new Set(monate)).sort();
  if (s.length < 2) return null;
  const luecken: number[] = [];
  for (let i = 1; i < s.length; i++) luecken.push(monatsAbstand(s[i - 1], s[i]));
  if (Math.max(...luecken) - Math.min(...luecken) > 2) return null;
  const schnitt = luecken.reduce((a, c) => a + c, 0) / luecken.length;
  if (schnitt <= 1.4) return 'monatlich';
  if (schnitt >= 2.4 && schnitt <= 4.2) return 'quartal';
  if (schnitt >= 5 && schnitt <= 7) return 'halbjahr';
  if (schnitt >= 10) return 'jahr';
  return null;
}

export interface RhythmusVorschlag { turnus: Turnus; sicher: boolean; abstand: number | null; text: string }

/**
 * Vorschlag für die Wahl „Rhythmus klären“ (27.09.): immer eine der fünf Antworten.
 * Aus den Monaten, in denen gezahlt wurde — nie aus Beträgen. Weniger als zwei Monate
 * oder Abstände ohne Muster → „unregelmäßig“, dann ist der Vorschlag unsicher.
 */
export function rhythmusVorschlag(monate: string[]): RhythmusVorschlag {
  const s = Array.from(new Set(monate)).sort();
  if (s.length < 2) return { turnus: 'unregelmaessig', sicher: false, abstand: null, text: s.length ? 'nur eine Zahlung — kein Abstand messbar' : 'keine Zahlung im Zeitraum' };
  const luecken: number[] = [];
  for (let i = 1; i < s.length; i++) luecken.push(monatsAbstand(s[i - 1], s[i]));
  const schnitt = luecken.reduce((a, c) => a + c, 0) / luecken.length;
  const abstand = Math.round(schnitt * 10) / 10;
  const r = rhythmus(s);
  const text = `${s.length} Zahlungen, im Schnitt alle ${abstand.toLocaleString('de-DE')} Monate`;
  return r ? { turnus: r, sicher: true, abstand, text } : { turnus: 'unregelmaessig', sicher: false, abstand, text: `${text} — kein klares Muster` };
}

export interface Wiederkehrend {
  name: string; monate: number; mittel: number; schwankung: number;
  turnus: Turnus; vorschlag: Turnus | null; unsicher: boolean; proMonat: number;
  kategorie: string; bereitsMarkiert: boolean; teilweiseMarkiert: boolean; ids: string[];
}

/**
 * Empfänger, die regelmäßig mit fast gleichem Betrag abbuchen (12 volle Monate).
 * Schwankung ≤ 20 %, Mittel ≥ 3 €. Monatlich braucht drei Treffer; eine einzelne
 * Zahlung beweist keinen Rhythmus und kommt nur ab 100 € als „Rhythmus unklar“ hinein.
 */
export function wiederkehrend(buchungen: Buchung[], katName: KatName, heute: string = heuteBerlin()): Wiederkehrend[] {
  const monate = vollMonate(12, 0, heute);
  const nach = new Map<string, { name: string; zeilen: Buchung[] }>();
  for (const b of inMonaten(buchungen, monate)) {
    if (b.ist_umbuchung || b.betrag >= 0 || !b.empfaenger) continue;
    const k = normal(b.empfaenger);
    const g = nach.get(k) ?? { name: b.empfaenger, zeilen: [] };
    g.zeilen.push(b); nach.set(k, g);
  }
  const raus: Wiederkehrend[] = [];
  for (const g of Array.from(nach.values())) {
    const z = g.zeilen;
    const monatsListe = Array.from(new Set(z.map(b => monatVon(b.datum))));
    const betraege = z.map(b => Math.abs(b.betrag));
    const mittel = betraege.reduce((a, c) => a + c, 0) / betraege.length;
    if (mittel < 300) continue;
    const abw = Math.sqrt(betraege.reduce((a, c) => a + (c - mittel) ** 2, 0) / betraege.length);
    const schwankung = abw / mittel;
    if (schwankung > 0.2) continue;
    const rhy = rhythmus(monatsListe);
    let vorschlag: Turnus | null = rhy;
    if (rhy === 'monatlich' && monatsListe.length < 3) continue;
    if (!rhy) {
      // Eine einzelne große Zahlung: vermutlich jährlich. Mehrere gleiche Beträge ohne Muster (27.09.): bleiben als
      // „Rhythmus unklar“ in der Liste, wenn es mindestens drei sind oder es um ≥ 100 € geht — sonst wäre es Rauschen.
      if (monatsListe.length === 1 && mittel >= 10_000) vorschlag = 'jahr';
      else if (monatsListe.length >= 3 || (monatsListe.length === 2 && mittel >= 10_000)) vorschlag = null;
      else continue;
    }
    // Von Hand bestätigt (27.09.) schlägt alles; sonst der Turnus der Fixkosten-Markierung, sonst der Vorschlag.
    const geklaert = z.find(b => b.turnus_geklaert === true)?.turnus;
    const gesetzt = geklaert ?? z.find(b => b.ist_fixkosten)?.turnus;
    // Ohne Muster und ohne Ansage rechnet die Zeile ehrlich mit Σ/12 („unregelmäßig“) statt so zu tun, als käme das monatlich.
    const turnus: Turnus = gesetzt ?? vorschlag ?? 'unregelmaessig';
    raus.push({
      name: g.name, monate: monatsListe.length, mittel, schwankung, turnus, vorschlag, unsicher: !rhy && !geklaert,
      proMonat: postenProMonat(betraege, turnus, monate.length), kategorie: katName(z[0].kategorie_id),
      bereitsMarkiert: z.every(b => b.ist_fixkosten), teilweiseMarkiert: z.some(b => b.ist_fixkosten), ids: z.map(b => b.id),
    });
  }
  return raus.sort((a, c) => c.proMonat - a.proMonat);
}

/**
 * Luft pro Monat: echtes Einkommen (ohne Kredit, ohne Durchlauf) im Schnitt der
 * letzten drei vollen Monate minus Sockel. Bei Malin zählten hier Kredite und
 * Rückzahlungen mit — dann sah die Luft nach einem Kredit größer aus, als sie ist.
 */
export function luft(buchungen: Buchung[], schulden: Schuld[], katName: KatName, heute: string = heuteBerlin()) {
  const s = sockel(buchungen, schulden, heute, katName);
  const k = kennzahlen(buchungen, vollMonate(3, 0, heute), katName);
  return { sockel: s, einnahmenSchnitt: k.einProMonat, luft: k.einProMonat - s.gesamt };
}
