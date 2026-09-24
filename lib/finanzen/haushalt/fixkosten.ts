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

export interface Sockelposten { name: string; turnus: Turnus; mittel: number; proMonat: number; anzahl: number }

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
  const tilgungFix = posten(alleFix.filter(istTilgung)).reduce((s, p) => s + p.proMonat, 0);
  const liste = posten(fix);
  const ausBuchungen = liste.reduce((s, p) => s + p.proMonat, 0);
  const ratenSchulden = schulden.reduce((s, x) => s + (Number(x.rate) || 0), 0);
  const raten = Math.max(ratenSchulden, tilgungFix);
  return { ausBuchungen, raten, ratenSchulden, ratenBuchungen: tilgungFix, gesamt: ausBuchungen + raten, monate, anzahl: fix.length, posten: liste };
}

/** Fixkosten-Buchungen je Empfänger zu Posten mit Monatswert. */
function posten(fix: Buchung[]): Sockelposten[] {
  const grp = new Map<string, { name: string; betraege: number[]; turnus: Turnus }>();
  for (const b of fix) {
    const k = normal(b.empfaenger || b.beschreibung);
    const g = grp.get(k) ?? { name: b.empfaenger || b.beschreibung, betraege: [], turnus: 'monatlich' as Turnus };
    g.betraege.push(Math.abs(b.betrag));
    if (b.turnus) g.turnus = b.turnus;
    grp.set(k, g);
  }
  return Array.from(grp.values()).map(g => {
    const mittel = g.betraege.reduce((a, c) => a + c, 0) / g.betraege.length;
    return { name: g.name, turnus: g.turnus, mittel, proMonat: proMonat(mittel, g.turnus), anzahl: g.betraege.length };
  }).sort((a, c) => c.proMonat - a.proMonat);
}

/** Rhythmus aus den Abständen: ≤ 1,4 → monatlich, 2,4–4,2 → quartal, ≥ 10 → jahr, sonst unregelmäßig. */
export function rhythmus(monate: string[]): Turnus | null {
  if (monate.length < 2) return null;
  const s = monate.slice().sort();
  const luecken: number[] = [];
  for (let i = 1; i < s.length; i++) luecken.push(monatsAbstand(s[i - 1], s[i]));
  const schnitt = luecken.reduce((a, c) => a + c, 0) / luecken.length;
  if (schnitt <= 1.4) return 'monatlich';
  if (schnitt >= 2.4 && schnitt <= 4.2) return 'quartal';
  if (schnitt >= 10) return 'jahr';
  return null;
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
      if (monatsListe.length === 1 && mittel >= 10_000) vorschlag = 'jahr';
      else continue;
    }
    const gesetzt = z.find(b => b.ist_fixkosten)?.turnus;
    const turnus: Turnus = gesetzt ?? vorschlag ?? 'monatlich';
    raus.push({
      name: g.name, monate: monatsListe.length, mittel, schwankung, turnus, vorschlag, unsicher: !rhy,
      proMonat: proMonat(mittel, vorschlag ?? 'monatlich'), kategorie: katName(z[0].kategorie_id),
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
