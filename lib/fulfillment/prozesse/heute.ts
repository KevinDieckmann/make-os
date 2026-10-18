// ─── Fulfillment — „Heute im Fulfillment“: EINE Liste über alle Fälle (17.10. spät, Branch `ff-einfach`) ───────────────────────────────────
// Rückmeldung 17.10.: „Ich will, dass das Fulfillment wirklich maximal einfach für uns ist, sodass wir das gut verkloppen können.“ Bis dahin hieß „Was muss ich heute
// tun?“: Leiste › Produkte & Mandate › Fulfillment › je Kunde eine Karte lesen › den Fall öffnen › dort den Punkt suchen. Jetzt steht alles, was zu tun ist, in
// EINER Liste — auf Heute (Business) und oben auf dem Fulfillment-Start —, je Zeile mit dem Handgriff direkt daneben (abhaken, ja/nein, Entwurf öffnen, Fall starten).
//
// Rechnet NICHTS neu: je Fall der nächste Punkt aus DERSELBEN Rechnung wie Fall-Kopf, Reise „hier“ und Kunden-Karte (`naechsterPunkt` → `CockpitZeile.naechster`)
// und jeder Hänger aus DERSELBEN Regel wie das Cockpit (`wasHaengt`); ist ein Hänger derselbe Punkt wie „als Nächstes“, steht er nicht doppelt da (er macht die
// Zeile dringend). Dazu die Mandate, die auf ihren Start warten (Kandidaten des Onboardings). Wächter: tests/fulfillment-heute.test.ts.
// Was man direkt tun kann, entscheidet `knotenAktion` — dieselben Regeln wie die Karte im Fall (AblaufKarte, `statusOps`): Entscheidung → ja/nein, Nachricht bzw.
// Erinnerung mit Mail-Baustein → Entwurf, sonst abhaken (der Schritt und seine offenen Bausteine); abgeleitete Onboarding-Schritte und Bestätigungen öffnen die Stelle.
// Rein und client-sicher.

import type { Fall, FallKnoten } from '../typen';
import type { CockpitZeile, Haenger, HaengerArt } from './cockpit';
import { kinderVon } from '../regeln';
import { tagVon } from '@/lib/zeit';
import { obSchluessel } from './onboarding';
import { ausfuehrungsArt } from './ausfuehrung';
import type { WartetAuf } from './reise';

/** Was man an einem Punkt direkt in der Zeile tun kann. */
export type HeuteAktion =
  /** Entscheidung: „Ja“ / „Nein“ (Fall-Op `antwort`). */
  | { art: 'ja-nein'; knotenId: string }
  /** Nachricht bzw. Erinnerung mit Mail-Baustein: den Entwurf öffnen (GET `/api/fulfillment/fall?nachricht=`), gesendet nur per Klick. */
  | { art: 'entwurf'; knotenId: string }
  /** Schritt abhaken — `ids` = der Schritt und seine offenen Bausteine (wie `statusOps`); `kunde` = der Kunde liefert („ist da“). */
  | { art: 'abhaken'; knotenId: string; ids: string[]; kunde?: true }
  /** Ein Mandat wartet auf seinen Start: „Fall starten“ (der vorhandene Start-Dialog). */
  | { art: 'starten' }
  /** Ein gewonnener Deal ohne Mandat: „Mandat anlegen & Fall starten“ (vorhandener Weg POST /api/crm/lead `mandat`, dann der Start-Dialog). */
  | { art: 'mandat-starten'; chanceId: string; leistungId?: string }
  /** Alles andere: die Stelle im Fall öffnen (`HeuteEintrag.href`) — mit diesem Wortlaut. */
  | { art: 'oeffnen'; text: string };

export interface HeuteEintrag {
  /** Stabil: Mandat + Quelle + Punkt. */
  id: string;
  mandatId: string; kunde: string;
  /** Was zu tun ist (Titel des Schritts bzw. Satz des Hängers). */
  titel: string;
  /** Wo es steht: Phase und worauf gewartet wird — ohne Datum (das zeigt die Oberfläche aus `faelligAm`/`seit`). */
  unter?: string;
  faelligAm?: string; seit?: string;
  ueberfaellig: boolean;
  /** Rot: ein dringender Hänger (Willkommensmail, Bestätigung überfällig, eskaliert, Kunden-Puls …). */
  dringend: boolean;
  /** Der Punkt hängt (ein Hänger aus `wasHaengt` — eigener oder in „als Nächstes“ aufgegangen). */
  haengt?: string;
  /** Jetzt dran (dringend, hängt, überfällig, heute fällig, ohne Datum, Entscheidung/Entwurf bereit, Start, Willkommensmail) — sonst „demnächst“. */
  jetzt: boolean;
  /** Wer das Mandat betreut (aus der Cockpit-Zeile; fehlt = niemand eingetragen). */
  zustaendig?: string;
  /** Der Punkt ist die Willkommensmail eines neuen Kunden (24-Stunden-Uhr) — immer „jetzt“, auch wenn die Frist erst morgen endet. */
  willkommen?: true;
  quelle: 'naechster' | 'haengt' | 'start' | 'deal';
  /** Die Kennung des Knotens, wenn die Zeile an einem hängt. */
  knotenId?: string;
  aktion: HeuteAktion;
  /** Sprung in den Fall an die Stelle (bzw. zum Fall). */
  href: string;
}

const FERTIG = new Set(['erledigt', 'entfaellt']);
const fertig = (k: Pick<FallKnoten, 'status'>) => FERTIG.has(k.status);

/**
 * Was man an EINEM Knoten direkt tun kann — dieselben Regeln wie die Karte im Fall (AblaufKarte) und das Abhaken dort (`statusOps`). `null` = nichts direkt
 * (abgeleiteter Onboarding-Schritt, offene Bestätigung, Unbekanntes) — dann öffnet die Zeile die Stelle.
 */
export function knotenAktion(f: Pick<Fall, 'knoten' | 'freigaben'>, id: string, mitMail: (k: FallKnoten) => boolean = () => false): HeuteAktion | null {
  const k = f.knoten.find(x => x.id === id);
  if (!k || fertig(k) || obSchluessel(k.id)) return null;
  if (k.freigabe && !f.freigaben[k.freigabe]) return null;
  const art = ausfuehrungsArt(k);
  if (art === 'entscheidung') return { art: 'ja-nein', knotenId: k.id };
  if (art === 'nachricht' || (art === 'erinnerung' && mitMail(k))) return { art: 'entwurf', knotenId: k.id };
  const ids = [k, ...kinderVon(k.id, f.knoten)].filter(x => !fertig(x) && !obSchluessel(x.id) && !x.freigabe).map(x => x.id);
  if (!ids.length) return null;
  return { art: 'abhaken', knotenId: k.id, ids, ...(k.status === 'wartet_kunde' || k.zustaendig === 'kunde' ? { kunde: true as const } : {}) };
}

/** Wortlaut des Knopfs, wenn eine Zeile nur die Stelle öffnet — je Art des Hängers. */
export const OEFFNEN_TEXT: Readonly<Record<HaengerArt, string>> = {
  willkommen: 'Willkommensmail vorbereiten', freigabe: 'Bestätigung vermerken', faellig: 'Ansehen', wartet: 'Nachfassen', puls: 'Gespräch anbieten',
  report: 'Report senden', art14: 'Hinweis ansehen',
};

const WARTET_UNTER: Readonly<Record<WartetAuf, string>> = { intern: 'bei uns', kunde: 'wartet auf den Kunden', entscheidung: 'Entscheidung offen', abstimmung: 'Bestätigung offen' };

/** Kandidaten, die auf ihren Start warten (Onboarding) — nur, was die Liste braucht. */
export interface HeuteKandidat { mandatId: string; kunde: string; titel: string; bestand?: true; uhr?: { faellig?: string; ueberfaellig: boolean } }
/** Ein gewonnener Deal (Business), zu dem es noch kein Mandat gibt — nur, was die Liste braucht. */
export interface HeuteDeal { chanceId: string; kunde: string; titel: string; gewonnenAm?: string; leistungId?: string }

/** Wie lange ein gewonnener Deal ohne Mandat in „Heute im Fulfillment“ steht (danach war es wohl Absicht — der Deal bleibt, wie er ist). */
export const DEAL_OHNE_MANDAT_TAGE = 30;
/**
 * Gewonnene Deals einer Business-Gesellschaft ohne (nicht gelöschtes) Mandat, gewonnen in den letzten `DEAL_OHNE_MANDAT_TAGE` Tagen — jüngste zuerst. `business`
 * entscheidet die Gesellschaft (Server: `istBusinessMandat`), `tageSeit` rechnet Kalendertage. Rein.
 */
export function gewonneneOhneMandat(
  crm: { chancen: readonly { id: string; stufe: string; titel: string; firma?: string; gesellschaft?: string; leistungId?: string; historie?: readonly { stufe: string; am: string }[] }[]; mandate: readonly { chanceId?: string; geloeschtAm?: string }[] },
  heute: string, business: (g: unknown) => boolean, tageSeit: (tag: string, heute: string) => number | undefined,
): HeuteDeal[] {
  const mitMandat = new Set(crm.mandate.filter(m => m.chanceId && !m.geloeschtAm).map(m => m.chanceId!));
  return crm.chancen
    .filter(c => c.stufe === 'gewonnen' && business(c.gesellschaft) && !mitMandat.has(c.id))
    .map(c => {
      const gew = [...(c.historie ?? [])].reverse().find(h => h.stufe === 'gewonnen')?.am;
      // Berliner Tag (17.10., Gesamtprüfung L2 B7) — nie der UTC-Tag eines Zeitstempels.
      const am = gew ? (gew.length > 10 ? tagVon(gew) : gew) : undefined;
      return { c, am };
    })
    .filter(({ am }) => { const t = am ? tageSeit(am, heute) : undefined; return t !== undefined && t <= DEAL_OHNE_MANDAT_TAGE; })
    .sort((a, b) => (b.am ?? '').localeCompare(a.am ?? ''))
    .map(({ c, am }) => ({ chanceId: c.id, kunde: c.firma ?? c.titel, titel: c.titel, ...(am ? { gewonnenAm: am } : {}), ...(c.leistungId ? { leistungId: c.leistungId } : {}) }));
}

/**
 * Die Liste „Heute im Fulfillment“: je laufendem Fall der nächste Punkt (`CockpitZeile.naechster`) und jeder Hänger (`CockpitZeile.haengt`), dazu die Mandate,
 * die auf ihren Start warten, und gewonnene Deals ohne Mandat (`gewonneneOhneMandat`). Pausierte Fälle fehlen (dort tut man gerade nichts), Bestandsmandate ohne Uhr auch (die stehen ruhig unter Onboarding). Sortiert:
 * dringend → jetzt dran → nach Datum (älteste zuerst) → Kunde.
 */
export function heuteImFulfillment(zeilen: readonly CockpitZeile[], kandidaten: readonly HeuteKandidat[], heute: string, deals: readonly HeuteDeal[] = []): HeuteEintrag[] {
  const raus: HeuteEintrag[] = [];
  for (const z of zeilen) {
    if (z.status === 'pausiert' || z.status === 'abgeschlossen') continue;
    const n = z.naechster;
    let haupt: HeuteEintrag | null = null;
    if (n && z.schritt) {
      const lage = z.schrittLage;
      haupt = {
        id: `${z.mandatId}|n|${n.id}`, mandatId: z.mandatId, kunde: z.kunde, titel: z.schritt,
        unter: [z.phase, lage ? WARTET_UNTER[lage.wartetAuf] : undefined].filter(Boolean).join(' · ') || undefined,
        ...(lage?.faelligAm ? { faelligAm: lage.faelligAm } : {}),
        ueberfaellig: !!lage?.ueberfaellig, dringend: false, jetzt: false, quelle: 'naechster', knotenId: n.id, aktion: n.aktion, href: n.href,
        ...(n.willkommen ? { willkommen: true as const } : {}),
      };
      raus.push(haupt);
    }
    // Je Zusatzmodul sein nächster Punkt (17.10., Gesamtprüfung L2 B1) — eine eigene Zeile, „Zusatzmodul · Phase“ darunter.
    const neben: HeuteEintrag[] = [];
    for (const zu of z.zusaetze ?? []) {
      const e: HeuteEintrag = {
        id: `${z.mandatId}|n|${zu.naechster.id}`, mandatId: z.mandatId, kunde: z.kunde, titel: zu.schritt,
        unter: [zu.titel, zu.phase, WARTET_UNTER[zu.schrittLage.wartetAuf]].filter(Boolean).join(' · ') || undefined,
        ...(zu.schrittLage.faelligAm ? { faelligAm: zu.schrittLage.faelligAm } : {}),
        ueberfaellig: zu.schrittLage.ueberfaellig, dringend: false, jetzt: false, quelle: 'naechster', knotenId: zu.naechster.id, aktion: zu.naechster.aktion, href: zu.naechster.href,
      };
      neben.push(e); raus.push(e);
    }
    for (const h of z.haengt) {
      // Derselbe Punkt wie der eines Zusatzmoduls steht nicht doppelt da — er macht dessen Zeile dringend.
      const zuGleich = h.knotenId !== undefined ? neben.find(e => e.knotenId === h.knotenId) : undefined;
      if (zuGleich) { zuGleich.dringend = zuGleich.dringend || h.schwere === 'rot'; zuGleich.haengt = h.text; if (h.seit) zuGleich.seit = h.seit; continue; }
      // Derselbe Punkt wie „als Nächstes“ steht nicht doppelt da — er macht die Zeile dringend (Willkommensmail = der Onboarding-Schritt „willkommen“).
      const gleich = !!haupt && !!n && ((h.knotenId !== undefined && h.knotenId === n.id) || (h.art === 'willkommen' && n.willkommen === true));
      if (gleich && haupt) {
        haupt.dringend = haupt.dringend || h.schwere === 'rot';
        haupt.haengt = h.text;
        if (h.seit) haupt.seit = h.seit;
        continue;
      }
      raus.push({
        id: `${z.mandatId}|h|${h.art}|${h.knotenId ?? h.text}`, mandatId: z.mandatId, kunde: z.kunde, titel: h.text, ...(z.phase ? { unter: z.phase } : {}),
        ...(h.seit ? { seit: h.seit } : {}), ueberfaellig: true, dringend: h.schwere === 'rot', haengt: h.text, jetzt: true, quelle: 'haengt',
        ...(h.knotenId ? { knotenId: h.knotenId } : {}), aktion: h.aktion ?? { art: 'oeffnen', text: OEFFNEN_TEXT[h.art] }, href: h.href,
      });
    }
  }
  for (const k of kandidaten) {
    if (k.bestand) continue;
    raus.push({
      id: `${k.mandatId}|start`, mandatId: k.mandatId, kunde: k.kunde, titel: k.titel, unter: 'Mandat da — der Fall wartet auf den Start',
      ...(k.uhr?.faellig ? { faelligAm: tagVon(k.uhr.faellig) } : {}), ueberfaellig: !!k.uhr?.ueberfaellig, dringend: !!k.uhr?.ueberfaellig, jetzt: true,
      quelle: 'start', aktion: { art: 'starten' }, href: '',
    });
  }
  // Gewonnene Deals ohne Mandat (17.10. spät): EIN Knopf „Mandat anlegen & Fall starten“ — der Start beginnt hier, nicht im CRM.
  for (const d of deals) {
    raus.push({
      id: `${d.chanceId}|deal`, mandatId: '', kunde: d.kunde, titel: d.titel, unter: 'Deal gewonnen — noch ohne Mandat und Fall',
      ...(d.gewonnenAm ? { seit: d.gewonnenAm } : {}), ueberfaellig: false, dringend: false, jetzt: true, quelle: 'deal',
      aktion: { art: 'mandat-starten', chanceId: d.chanceId, ...(d.leistungId ? { leistungId: d.leistungId } : {}) }, href: '',
    });
  }
  // Wer zuständig ist, steht an jeder Zeile des Falls (17.10., Gesamtprüfung L1 B15).
  const wer = new Map(zeilen.filter(z => z.zustaendig).map(z => [z.mandatId, z.zustaendig!] as const));
  for (const e of raus) { const w = wer.get(e.mandatId); if (w) e.zustaendig = w; }
  for (const e of raus) {
    if (e.quelle !== 'naechster') continue;
    const bereit = e.aktion.art === 'ja-nein' || e.aktion.art === 'entwurf';
    e.jetzt = e.dringend || !!e.haengt || e.ueberfaellig || !e.faelligAm || e.faelligAm <= heute || bereit || !!e.willkommen;
  }
  const datum = (e: HeuteEintrag) => e.seit ?? e.faelligAm ?? '9999-99-99';
  return raus.sort((a, b) => Number(b.dringend) - Number(a.dringend) || Number(b.jetzt) - Number(a.jetzt) || datum(a).localeCompare(datum(b)) || a.kunde.localeCompare(b.kunde, 'de') || a.id.localeCompare(b.id));
}

/** Die Zahl für Kopf und Glocke: wie viele Punkte jetzt dran sind (und wie viele davon dringend). */
/** „Meine“: Zeilen, die die Person betreut (bzw. „beide“) — Zeilen ohne Zuständige gehören allen. */
export const meineHeute = (l: readonly HeuteEintrag[], ich: string): HeuteEintrag[] => l.filter(e => !e.zustaendig || e.zustaendig === ich || e.zustaendig === 'beide');

export function heuteZahlen(l: readonly HeuteEintrag[]): { jetzt: number; dringend: number; demnaechst: number } {
  const jetzt = l.filter(e => e.jetzt);
  return { jetzt: jetzt.length, dringend: jetzt.filter(e => e.dringend).length, demnaechst: l.length - jetzt.length };
}

export type { Haenger };
