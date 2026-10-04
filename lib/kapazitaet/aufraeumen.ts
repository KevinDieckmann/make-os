// ─── MAKE OS — Kapazität: Löschfrist deaktivierter Team-Personen + Auskunft (DSGVO-Nachtrag 04.10.) ────────────
// Kevin 04.10. (UMBAU_ABEND_0410.md › 12): „Team-Personen: Kapazitätsdaten 30 Tage nach Deaktivieren automatisch löschen
// + Art.-15-Export.“
//
//   Löschen    Morgenlauf-Schritt `kapaDeaktivierteAufraeumen` (app/api/tagesstart, wie die Papierkorb-Schritte): je
//              Team-Person ohne Konto, die seit ≥ 30 Tagen deaktiviert ist (`TeamEintrag.deaktiviertAm`, setzt nur der
//              Server), fallen Grundwert, Ausnahmen (Urlaub/Blöcke), Zuweisungen und die Einwilligung `erholungAm` aus
//              `kapazitaet--<haushalt>`. Idempotent: nichts fällig → nichts geschrieben. Reaktiviert man vorher, nimmt die
//              Team-Route den Zeitpunkt weg — es bleibt alles. Alte deaktivierte Einträge ohne Zeitpunkt (Kompatibilität)
//              stempelt der erste Lauf mit „jetzt“; die Frist beginnt dann.
//              Beide Schritte in EINER Sperre auf dem Team-Bestand — ein gleichzeitiges Reaktivieren wartet und sieht danach
//              den Stand (nie: reaktiviert, aber trotzdem gelöscht).
//   Auskunft   `kapaAuskunft` (rein) — Kopie der gespeicherten Kapazitätsdaten einer Person (Art. 15 Abs. 3), auch deaktivierter.
//              Ausgeliefert über GET /api/kapazitaet?auskunft=<person> (Rechte dort) und in der Kontakt-Auskunft
//              (lib/crm/person-bestaende.ts `personAufzaehlen.kapazitaet`, Zuordnung über die E-Mail der Team-Person).
// Konten werden nie deaktiviert (immer aktiv) — ihre Daten löscht nur die Person selbst bzw. das Entfernen des Kontos.

import { tagPlus } from '@/lib/zeit/kalender-kern';
import { KONTO_PRAEFIX, type TeamEintrag } from '@/lib/make-one/team-typen';
import { sauberKapaDatei } from './aendern';
import type { KapaDatei, Ausnahme, Zuweisung } from './typen';

/** Nach so vielen Tagen Deaktivierung gehen die Kapazitätsdaten einer Team-Person (Kevin 04.10.). */
export const KAPA_LOESCHEN_NACH_TAGEN = 30;

const istZeit = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));

/** Tag (JJJJ-MM-TT, Berlin), ab dem die Daten gelöscht werden — oder null (aktiv, Konto, ohne Zeitpunkt). */
export function kapaLoeschTag(e: Pick<TeamEintrag, 'id' | 'aktiv' | 'deaktiviertAm'>): string | null {
  if (e.aktiv || e.id.startsWith(KONTO_PRAEFIX) || !istZeit(e.deaktiviertAm)) return null;
  const tag = new Date(e.deaktiviertAm).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  return tagPlus(tag, KAPA_LOESCHEN_NACH_TAGEN);
}

/** Ist die Frist abgelaufen? Genau 30 × 24 h nach dem Deaktivieren — nicht vorher. */
export function kapaLoeschFaellig(e: Pick<TeamEintrag, 'id' | 'aktiv' | 'deaktiviertAm'>, jetzt: string): boolean {
  if (e.aktiv || e.id.startsWith(KONTO_PRAEFIX) || !istZeit(e.deaktiviertAm)) return false;
  return Date.parse(jetzt) - Date.parse(e.deaktiviertAm) >= KAPA_LOESCHEN_NACH_TAGEN * 86_400_000;
}

/** Was der Morgenlauf tun muss: alte Einträge ohne Zeitpunkt stempeln, abgelaufene Personen löschen. */
export function kapaLoeschPlan(team: readonly TeamEintrag[], jetzt: string): { stempeln: string[]; faellig: string[] } {
  const daten = team.filter(e => !e.id.startsWith(KONTO_PRAEFIX) && !e.aktiv);
  return {
    stempeln: daten.filter(e => !istZeit(e.deaktiviertAm)).map(e => e.id),
    faellig: daten.filter(e => kapaLoeschFaellig(e, jetzt)).map(e => e.id),
  };
}

/** Die Kapazitätsdaten dieser Personen entfernen — `teile` = wie viele Einträge (Person, Zuweisungen) wegfielen (0 = unverändert). */
export function kapaOhnePersonen(roh: KapaDatei | null | undefined, ids: ReadonlySet<string>): { datei: KapaDatei; personen: string[]; teile: number } {
  const d = sauberKapaDatei(roh);
  const personen = Object.keys(d.personen).filter(id => ids.has(id));
  const zuweisungen = d.zuweisungen.filter(z => !ids.has(z.person));
  const weg = d.zuweisungen.filter(z => ids.has(z.person)).map(z => z.person);
  const teile = personen.length + (d.zuweisungen.length - zuweisungen.length);
  if (!teile) return { datei: d, personen: [], teile: 0 };
  const rest = Object.fromEntries(Object.entries(d.personen).filter(([id]) => !ids.has(id)));
  return { datei: { personen: rest, zuweisungen }, personen: Array.from(new Set([...personen, ...weg])), teile };
}

// ── Auskunft (Art. 15) ───────────────────────────────────────────────────────────────────────────────────────

export interface KapaAuskunft {
  erstellt: string;
  art: string;
  person: { id: string; name: string; kurz: string; rolle: string; konto: boolean; aktiv: boolean; deaktiviertAm?: string; kapazitaetLoeschungAb?: string };
  /** Grundwert (verfügbare Stunden je Woche) — fehlt = keiner gespeichert. */
  grundwertStundenWoche: number | null;
  /** Urlaub und feste Blöcke — mit Titel (die Person bekommt ihre eigenen Angaben vollständig). */
  ausnahmen: Ausnahme[];
  /** Zuweisungen Person × Mandat/Kunde mit Anzeigename (aus dem CRM, sonst die Kennung). */
  zuweisungen: (Zuweisung & { bezug: string })[];
  /** Einwilligung „Erholung zählt“ (Art. 9) — Zeitpunkt oder null. Ein Gesundheitswert wird nie gespeichert. */
  erholungEinwilligungAm: string | null;
  /** Meilensteine/Ziele, an denen die Person laut Planung mitarbeitet (nur Verweis: Art, Kennung, Titel). */
  arbeitetAn: { art: 'meilenstein' | 'ziel'; id: string; titel: string }[];
  hinweise: string[];
}

/** Eine Kopie der Kapazitätsdaten einer Person (rein). `posten` = Meilensteine/Ziele mit `personen`. */
export function kapaAuskunft(o: {
  eintrag: Pick<TeamEintrag, 'id' | 'name' | 'kurz' | 'rolle' | 'aktiv' | 'deaktiviertAm'>;
  datei: KapaDatei | null | undefined;
  posten?: readonly { art: 'meilenstein' | 'ziel'; id: string; titel: string; personen?: readonly string[] }[];
  bezugNamen?: Readonly<Record<string, string>>;
  jetzt: string;
}): KapaAuskunft {
  const d = sauberKapaDatei(o.datei);
  const e = o.eintrag;
  const konto = e.id.startsWith(KONTO_PRAEFIX);
  const einst = d.personen[e.id];
  const loeschAb = kapaLoeschTag(e);
  return {
    erstellt: o.jetzt,
    art: 'Auskunft nach Art. 15 DSGVO — Kapazitätsplanung (MAKE OS)',
    person: {
      id: e.id, name: e.name, kurz: e.kurz, rolle: e.rolle, konto, aktiv: e.aktiv,
      ...(e.deaktiviertAm ? { deaktiviertAm: e.deaktiviertAm } : {}), ...(loeschAb ? { kapazitaetLoeschungAb: loeschAb } : {}),
    },
    grundwertStundenWoche: einst?.stundenWoche ?? null,
    ausnahmen: einst?.ausnahmen ?? [],
    zuweisungen: d.zuweisungen.filter(z => z.person === e.id).map(z => ({ ...z, bezug: o.bezugNamen?.[z.bezugId] ?? z.bezugId })),
    erholungEinwilligungAm: einst?.erholungAm ?? null,
    arbeitetAn: (o.posten ?? []).filter(p => p.personen?.includes(e.id)).map(p => ({ art: p.art, id: p.id, titel: p.titel })),
    hinweise: [
      'Gespeichert im Bestand der Kapazitätsplanung des Haushalts (verschlüsselt, Server in Deutschland).',
      'Ein Gesundheitswert wird nie gespeichert; die Erholung zählt nur mit eigener Einwilligung als gemeinsamer Team-Faktor.',
      ...(loeschAb ? [`Die Person ist deaktiviert — ihre Kapazitätsdaten werden ab ${loeschAb} automatisch gelöscht (Reaktivieren davor erhält sie).`] : []),
      'Termine und gemessene Fokus-Zeit werden nur beim Rechnen gelesen (Kalender, Zeit & Fokus) und hier nicht gespeichert.',
    ],
  };
}
