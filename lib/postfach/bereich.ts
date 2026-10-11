// ─── Postfächer — der Bereich eines Postfachs: Privat · Gesellschaft · Kunde (rein, client-sicher, 09.10.2026) ──────────────
// Kevin 09.10.: „Es wäre geil, wenn wir ein zweites Google-Konto auch verbinden könnten … Wir haben da auch von den Kunden Postfächer.“
// — „Man muss da auf das Postfach klicken, z. B. MAKE Innovation oder KD Ventures oder …“ (dazu ein Kunde mit eigenem Namen). Ein
// Kundenpostfach (eine Adresse von uns in der Domain eines Kunden) bekommt den Bereich DES KUNDEN — dieselbe
// Kennung wie der Mandanten-Space der Aufgaben (lib/aufgaben/struktur.ts): `m-<firmaId>` = CRM-Firma mit aktivem Mandat.
//
// Die Form des Bereichs (EINE Stelle — Ansicht, Strom, Register und Postfächer-Seite lesen nur hierüber):
//   `privat`                Privat
//   `kdc` · `kdv` · `ug`    die festen Gesellschaften (lib/einheiten.ts; die Selbstständigkeit liegt je Instanz unter Privat)
//   `g-<uuid>`              weitere eigene Gesellschaften (Gesellschafts-Register des Haushalts)
//   `m-<firmaId>`           ein Kunde/Mandant (CRM-Firma mit aktivem Mandat) — Raum immer Business (`bereichVon` → business)
//   `null`                  noch keinem Bereich zugeordnet (nur ein verbundenes Gmail ohne Eintrag) — zeigt sich nur unter „Alle“
// Namen kommen NIE aus dem Code: Gesellschaften aus lib/einheiten.ts bzw. dem Register, Kunden aus dem CRM (Firmenname). Der Aufrufer
// reicht die Namen (`namen`, vom Server: `bereichNamen()` in lib/postfach/register.ts bzw. `bereiche` der Antworten).

import { bereichVon, istGesellschaft, istRegisterKennung } from '@/lib/einheiten';
import { EINHEIT_FARBE, EINHEIT_GRAU } from '@/lib/aufgaben/einheit';
import { istMandantSpace, mandantSpaceId, firmaVonSpace, mandantenSpaces, MANDANT_FARBE, PRIVAT_FARBE } from '@/lib/aufgaben/struktur';

export type BereichArt = 'privat' | 'gesellschaft' | 'kunde' | 'ohne';

// Die Form als Filter-Parameter (`?bereich=`) prüft die Inbox generisch (`istBereichKennung`, lib/inbox/ansicht.ts, Paket „Ansicht“ 09.10.):
// klein, ohne Sonderzeichen — `m-<firmaId>` passt hinein, deshalb keine zweite Regel hier.

/** Ist das ein Kunden-Bereich (`m-<firmaId>`)? Dieselbe Regel wie der Mandanten-Space der Aufgaben. */
export const istKundenBereich = (v: unknown): v is string => istMandantSpace(v);
/** Bereich eines Kunden aus der CRM-Firmenkennung. */
export const kundenBereich = (firmaId: string): string => mandantSpaceId(firmaId);
/** CRM-Firma hinter einem Kunden-Bereich (sonst undefined). */
export const firmaVonBereich = (bereich: string | null | undefined): string | undefined => firmaVonSpace(bereich);

/** Art eines Bereichs (rein). Unbekanntes zählt als Gesellschaft (Business) — nie „aus Versehen Privat“ in der Business-Sicht. */
export function bereichArt(bereich: string | null | undefined): BereichArt {
  if (!bereich) return 'ohne';
  if (bereich === 'privat') return 'privat';
  if (istKundenBereich(bereich)) return 'kunde';
  return 'gesellschaft';
}

/** Ein wählbarer bzw. bekannter Bereich (Antworten der Postfächer-Route, Ansicht). `archiv` = Kunde ohne aktives Mandat (nicht mehr wählbar). */
export interface BereichEintrag { id: string; name: string; art: Exclude<BereichArt, 'ohne'>; archiv?: boolean }

/**
 * Privat oder Business für einen Postfach-Bereich — DIE Regel (Prüf-Fund 11.10.: vorher drei verschiedene — Strom/Teilen „Privat“, Flows und
 * „aus Gespräch“ „Business“). Ohne Bereich (Gmail ohne Register-Eintrag) gilt STRENG Privat — nie „aus Versehen Business“: Aufgaben,
 * Ablage und „Kontakt anlegen“ landen dann im Privat-Bereich bzw. brauchen den bewussten Bereichswechsel (Rückfrage, `bereichWechsel`).
 * Rein, client-sicher.
 */
export const postfachRaum = (bereich: string | null | undefined): 'privat' | 'business' => (bereich ? bereichVon(bereich) : 'privat');

export interface BereichAnzeige {
  name: string;
  /** Farbe des Bereichs-Labels: Privat wie der Privat-Space, Gesellschaften in ihrer Einheiten-Farbe, Kunden in der Mandanten-Farbe. */
  farbe: string;
  art: BereichArt;
  /** Privat oder Business — dieselbe Regel wie die Filterstelle des Stroms (`imBereich`). Ohne Bereich streng Privat. */
  raum: 'privat' | 'business';
  /** Kunde ohne aktives Mandat mehr (das Postfach bleibt lesbar, der Name bekommt keinen Zusatz). */
  archiv?: boolean;
}

/**
 * Name, Farbe, Art und Raum für einen Bereich — DIE Funktion für jede Anzeige eines Postfach-Bereichs (Postfach-Leiste, Labels,
 * Postfächer-Seite). `namen` = Kennung → Name (Server: `bereichNamen()`); `archiv` = Kennungen der Kunden ohne aktives Mandat. Rein.
 */
export function bereichAnzeige(bereich: string | null | undefined, namen: Readonly<Record<string, string>> = {}, archiv: ReadonlySet<string> = new Set()): BereichAnzeige {
  const art = bereichArt(bereich);
  if (!bereich || art === 'ohne') return { name: 'Ohne Bereich', farbe: EINHEIT_GRAU, art, raum: postfachRaum(bereich) };
  if (art === 'privat') return { name: 'Privat', farbe: PRIVAT_FARBE, art, raum: 'privat' };
  const raum = bereichVon(bereich);
  if (art === 'kunde') return { name: namen[bereich] ?? 'Kunde (nicht mehr im CRM)', farbe: MANDANT_FARBE, art, raum, ...(archiv.has(bereich) ? { archiv: true } : {}) };
  const farbe = istGesellschaft(bereich) ? EINHEIT_FARBE[bereich] : EINHEIT_GRAU;
  return { name: namen[bereich] ?? (istRegisterKennung(bereich) ? 'Gesellschaft (nicht mehr im Register)' : bereich), farbe, art, raum };
}

interface CrmFuerKunden {
  firmen?: readonly { id: string; name: string }[];
  mandate?: readonly { id: string; firmaId?: string; kunde?: string; status?: string; titel?: string }[];
}

/**
 * Kunden-Bereiche aus dem CRM (rein): jede Firma mit aktivem Mandat (wählbar), dazu Firmen, die nur noch ein beendetes/pausiertes
 * Mandat haben oder in `genutzt` stehen (`archiv: true` — nur für Namen vorhandener Postfächer, nie neu wählbar). Dieselbe Rechnung
 * wie die Mandanten-Spaces der Aufgaben (`mandantenSpaces`) — kein zweiter Weg.
 */
export function kundenBereiche(crm: CrmFuerKunden | null | undefined, genutzt: readonly (string | null | undefined)[] = []): BereichEintrag[] {
  return mandantenSpaces(crm, genutzt.filter((b): b is string => !!b)).map(s => ({ id: s.id, name: s.label, art: 'kunde' as const, ...(s.archiv ? { archiv: true } : {}) }));
}

/** Sortierte Auswahl für das Formular: Privat · Gesellschaften (in der gereichten Reihenfolge) · Kunden (nur aktive). Rein. */
export function bereichAuswahl(gesellschaften: readonly { id: string; name: string }[], kunden: readonly BereichEintrag[]): BereichEintrag[] {
  return [
    { id: 'privat', name: 'Privat', art: 'privat' },
    ...gesellschaften.filter(g => g.id !== 'privat').map(g => ({ id: g.id, name: g.name, art: 'gesellschaft' as const })),
    ...kunden.filter(k => !k.archiv),
  ];
}

/** Gruppen-Überschrift im Formular. */
export const BEREICH_GRUPPE: Readonly<Record<Exclude<BereichArt, 'ohne'>, string>> = { privat: 'Privat', gesellschaft: 'Gesellschaften', kunde: 'Kunden (aktive Mandate)' };
