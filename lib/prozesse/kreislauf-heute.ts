// ─── Kreislauf sehen — was der Kreislauf HEUTE von selbst getan hat (30.10., Kreislauf Geld & Lieferung Paket 5; rein, Server UND Browser) ─────────────
// Für „Automationen & Head“ (Produkte & Mandate, Finanzen, Markttraktion): nur Zähler mit Link — nie Namen, nie Beträge. Jede Zahl kommt aus einem
// VORHANDENEN Bestand, keine neue Speicherung:
//   Mandate aus angenommenen Angeboten   `rechnungswesen.kreislauf.mandatAuto` (Tag `am`, ohne `zurueckAm`) — nur Mandate einer Business-Gesellschaft
//   Rechnungsentwürfe vorbereitet        Aufgaben `rv-<mandat>-<monat>` (je Entwurf des Morgenlaufs genau eine), angelegt heute, Bereich Business
//   Mahnaufgaben angelegt                Aufgaben `mahn-<rechnung>-<stufe>`, angelegt heute, Bereich Business — ist der Teil überführt, „ersetzt durch <Prozess>“
//   Mahnaufgaben geschlossen             dieselben Aufgaben, heute vom System erledigt bzw. abgebrochen (Verlauf `durch: 'system'`) — bezahlt bzw. storniert
//   Fälle abgeschlossen (Mandatsende)    Ereignis `fall-abgeschlossen` Stufe `mandatsende`, heute, Bereich Business
//   Werkstatt-Läufe                      Läufe des Motors (`prozesse-laeufe`): scharf gestartet · scharf beendet · Probeläufe (Schatten) getrennt
// Was eine neue Speicherung bräuchte (z. B. „Fall-Vorschläge heute“ — die Marke trägt keinen Tag), steht hier nicht.

import { WEG } from '@/lib/wege';
import { tagVon, tagePlus } from '@/lib/zeit';

export type KreislaufHeuteArt = 'mandate' | 'entwuerfe' | 'mahn-neu' | 'mahn-zu' | 'faelle' | 'laeufe-gestartet' | 'laeufe-beendet' | 'probelaeufe';
export interface KreislaufHeuteZeile {
  art: KreislaufHeuteArt;
  wert: number;
  /** „3 Mandate aus angenommenen Angeboten“ — Zahl und Wort, nie Namen. */
  text: string;
  href: string;
  /** Der Teil läuft scharf über einen Werkstatt-Prozess (Überführung) — „ersetzt durch <Prozess>“. */
  ersetzt?: { prozessId: string; titel: string; href: string };
}

export interface KreislaufHeuteQuellen {
  heute: string;
  /** `rechnungswesen.kreislauf.mandatAuto`. */
  mandatAuto?: Readonly<Record<string, { am: string; zurueckAm?: string }>>;
  /** Mandat → gehört zu Business? (die Gesellschaft entscheidet, `bereichVon`). Unbekannte Mandate zählen nicht. */
  mandatBusiness: (mandatId: string) => boolean;
  tasks: readonly { id: string; space?: string; status?: string; createdAt?: string; verlauf?: readonly { am: string; was: string; durch?: string }[] }[];
  ereignisse: readonly { art: string; am: string; stufe?: string; bereich: string | null }[];
  laeufe: readonly { modus: string; start: string; ende?: string; fall: { art: string; id?: string } }[];
  /** Mandate, die diese Sicht nicht sehen darf (Privat-Arbeits-Einheit ohne Privat-Recht) — ihre Läufe zählen nicht. */
  verborgen?: ReadonlySet<string>;
  /** Je Art: der Werkstatt-Prozess, der den alten Weg scharf ersetzt. */
  ersetzt?: Partial<Record<KreislaufHeuteArt, { prozessId: string; titel: string }>>;
}

const mehr = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
const istHeute = (iso: string | undefined, heute: string) => !!iso && tagVon(iso) === heute;

/** Die Zeilen (siehe Kopf) — eine Null zeigt sich nie: Arten ohne Wirkung fehlen. Rein. */
export function kreislaufHeute(q: KreislaufHeuteQuellen): KreislaufHeuteZeile[] {
  const { heute } = q;
  const business = (t: { space?: string }) => t.space === 'business';
  const mandate = Object.entries(q.mandatAuto ?? {}).filter(([id, v]) => !v.zurueckAm && istHeute(v.am, heute) && q.mandatBusiness(id)).length;
  const entwuerfe = q.tasks.filter(t => t.id.startsWith('rv-') && business(t) && istHeute(t.createdAt, heute)).length;
  const mahn = q.tasks.filter(t => t.id.startsWith('mahn-') && business(t));
  const mahnNeu = mahn.filter(t => istHeute(t.createdAt, heute)).length;
  const mahnZu = mahn.filter(t => (t.status === 'done' || t.status === 'cancelled') && (t.verlauf ?? []).some(v => v.was === 'status' && v.durch === 'system' && istHeute(v.am, heute))).length;
  const faelle = q.ereignisse.filter(e => e.art === 'fall-abgeschlossen' && e.stufe === 'mandatsende' && e.bereich === 'business' && istHeute(e.am, heute)).length;
  const sichtbar = q.laeufe.filter(l => !(l.fall.art === 'mandat' && l.fall.id && q.verborgen?.has(l.fall.id)));
  const scharf = sichtbar.filter(l => l.modus === 'scharf');
  const gestartet = scharf.filter(l => istHeute(l.start, heute)).length;
  const beendet = scharf.filter(l => istHeute(l.ende, heute)).length;
  const probe = sichtbar.filter(l => l.modus === 'schatten' && istHeute(l.start, heute)).length;
  const laeufe = WEG.prozesse({ ansicht: 'werkstatt' });
  const zeilen: KreislaufHeuteZeile[] = [
    { art: 'mandate', wert: mandate, text: mehr(mandate, 'Mandat aus einem angenommenen Angebot', 'Mandate aus angenommenen Angeboten'), href: WEG.mandat() },
    { art: 'entwuerfe', wert: entwuerfe, text: mehr(entwuerfe, 'Rechnungsentwurf vorbereitet', 'Rechnungsentwürfe vorbereitet'), href: WEG.rechnungen() },
    { art: 'mahn-neu', wert: mahnNeu, text: mehr(mahnNeu, 'Mahnaufgabe angelegt', 'Mahnaufgaben angelegt'), href: WEG.rechnungen() },
    { art: 'mahn-zu', wert: mahnZu, text: mehr(mahnZu, 'Mahnaufgabe geschlossen (bezahlt bzw. storniert)', 'Mahnaufgaben geschlossen (bezahlt bzw. storniert)'), href: WEG.rechnungen() },
    { art: 'faelle', wert: faelle, text: mehr(faelle, 'Fall zum Mandatsende abgeschlossen', 'Fälle zum Mandatsende abgeschlossen'), href: WEG.fulfillment() },
    { art: 'laeufe-gestartet', wert: gestartet, text: mehr(gestartet, 'Werkstatt-Lauf gestartet', 'Werkstatt-Läufe gestartet'), href: laeufe },
    { art: 'laeufe-beendet', wert: beendet, text: mehr(beendet, 'Werkstatt-Lauf beendet', 'Werkstatt-Läufe beendet'), href: laeufe },
    { art: 'probelaeufe', wert: probe, text: mehr(probe, 'Probelauf (Schatten) gestartet', 'Probeläufe (Schatten) gestartet'), href: laeufe },
  ];
  return zeilen.filter(z => z.wert > 0).map(z => {
    const e = q.ersetzt?.[z.art];
    return e ? { ...z, ersetzt: { ...e, href: WEG.prozesse({ p: e.prozessId, ansicht: 'werkstatt' }) } } : z;
  });
}

// ── Landkarte: Fallzahlen der Werkstatt-Prozesse (Punkt 4) ───────────────────────────────────────────────────────────────────────────────

/** So weit zurück zählen fertige Läufe auf der Landkarte. */
export const FERTIG_TAGE = 30;

/**
 * Die Zahl einer Werkstatt-Kachel auf der Landkarte — dieselbe Form wie die Zahlen der System-Prozesse (`Zahl`): offen (davon wartend) und fertig der letzten
 * `FERTIG_TAGE` Tage. Nur scharfe Läufe (Probeläufe wirken nicht); Läufe zu verborgenen Mandaten zählen nicht. Ohne Lauf null (nie eine Null). Rein.
 */
export function werkstattFallZahl(laeufe: readonly { prozessId: string; modus: string; status: string; ende?: string; fall: { art: string; id?: string } }[], prozessId: string, heute: string, verborgen?: ReadonlySet<string>): { wert: number; wort: string; zweite?: { wert: number; wort: string }; href: string } | null {
  const l = laeufe.filter(x => x.prozessId === prozessId && x.modus === 'scharf' && !(x.fall.art === 'mandat' && x.fall.id && verborgen?.has(x.fall.id)));
  const offen = l.filter(x => x.status === 'laeuft' || x.status === 'wartet' || x.status === 'angehalten' || x.status === 'fehler');
  const wartet = offen.filter(x => x.status === 'wartet').length;
  const grenze = tagePlus(heute, -FERTIG_TAGE);
  const fertig = l.filter(x => x.status === 'fertig' && !!x.ende && tagVon(x.ende) >= grenze).length;
  const href = WEG.prozesse({ p: prozessId, ansicht: 'werkstatt' });
  const fertigWort = `fertig (${FERTIG_TAGE} Tage)`;
  if (offen.length) return { wert: offen.length, wort: wartet ? `offen · ${wartet} ${wartet === 1 ? 'wartet' : 'warten'}` : 'offen', ...(fertig ? { zweite: { wert: fertig, wort: fertigWort } } : {}), href };
  return fertig ? { wert: fertig, wort: fertigWort, href } : null;
}

/** Die Werkzeuge, deren „Automationen & Head“ die Tageszahlen zeigen — die Bereiche, durch die der Kreislauf läuft (Angebot, Mandat, Rechnung, Fall). */
export const KREISLAUF_WERKZEUGE: readonly string[] = ['produkte-mandate', 'finanzen', 'markttraktion'];
