// ─── Kreislauf sehen — die Zeitleiste je Kunde (30.10., Kreislauf Geld & Lieferung Paket 5 „Sehen, was läuft“; rein, Server UND Browser) ─────────────
// Der Inhaber will den Weg eines Kunden auf EINEN Blick sehen: Angebot (gestellt/angenommen) → Mandat → Raten bzw. Monatsrechnungen (Soll laut Zahlplan,
// Entwurf, gestellt, bezahlt, überfällig) → Phase des Fulfillment-Falls — und oben in einem Satz, wo es steht und was als Nächstes kommt
// („Rate 2 fällig (November 2026) — der Entwurf liegt bereit, prüfen & stellen“).
// Nichts wird neu gezählt: die Monate der Raten kommen aus `zahlplanMonate` (dieselbe Regel wie der Knopf in der Mandatsakte und der Morgenlauf), die
// Leistungsmonate aus `mandatLaeuftIm`, der Zustand einer Rechnung aus `rechnungsZustand` (lib/finanzen/rechnung/uebersicht.ts — auch „überfällig“, das nie
// gespeichert wird), die Phase aus dem Fall (Leistungstreppe/Cockpit). Die Daten liefern die vorhandenen Lesewege (CRM-Bestand, GET /api/rechnung — dort
// serverseitig nach der Sicht des Kontos gefiltert); hier wird nur geordnet und beschriftet. Links nur über WEG. Keine Namen, keine Beträge im Satz.

import type { Angebot, Mandat } from './typen';
import type { Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { zahlplanMonate } from './mandat-zusatz';
import { mandatLaeuftIm, monatsName } from './mandat-laufzeit';
import { rechnungsZustand } from '@/lib/finanzen/rechnung/uebersicht';
import { WEG } from '@/lib/wege';

/** Der Stand eines Punkts: erledigt (hinter uns) · jetzt (hier steht es) · offen (kommt noch) · achtung (fällig, es fehlt etwas) · kritisch (überfällig). */
export type ZeitleistenStand = 'erledigt' | 'jetzt' | 'offen' | 'achtung' | 'kritisch';
export type ZeitleistenArt = 'angebot' | 'mandat' | 'rechnung' | 'fall';

export interface ZeitleistenPunkt {
  id: string;
  art: ZeitleistenArt;
  titel: string;
  /** Zweite Zeile (Zustand, Datum) — ohne Beträge und Namen. */
  text: string;
  stand: ZeitleistenStand;
  href?: string;
}
export interface Zeitleiste {
  punkte: ZeitleistenPunkt[];
  /** Aktuelle Phase und nächster Schritt in einem Satz. */
  satz: string;
  /** Index des Punkts „hier steht es“ (für den Lichtfaden: davor hell, dahinter gedämpft). -1 = keiner. */
  hier: number;
}

type ZlMandat = Pick<Mandat, 'id' | 'status' | 'honorar'> & Partial<Pick<Mandat, 'start' | 'ende' | 'chanceId' | 'rechnungsrhythmus' | 'raten' | 'zahlplan' | 'mindestlaufzeitMonate' | 'geloeschtAm'>>;
type ZlAngebot = Pick<Angebot, 'id' | 'status'> & Partial<Pick<Angebot, 'nummer' | 'gestelltAm' | 'angenommenAm' | 'abgelehntAm' | 'abgelaufenAm' | 'mandatId' | 'dealId' | 'geloeschtAm' | 'angelegt'>>;
type ZlRechnung = Pick<Rechnung, 'id' | 'status'> & Partial<Pick<Rechnung, 'faellig' | 'bezahltAm' | 'leistungVon' | 'art' | 'angebotId' | 'mandatId' | 'positionen'>>;
/** Was die Zeitleiste vom Fall braucht (Leistungstreppe: `fall` je Mandat — nur Phase). */
export interface ZlFall { phase?: string; phaseNr?: number; phasenAnzahl?: number }

const tag = (iso: string | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined);
const datum = (t: string | undefined) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '');
const naechsterMonat = (mo: string) => { const [j, m] = mo.split('-').map(Number); return m === 12 ? `${j + 1}-01` : `${j}-${String(m + 1).padStart(2, '0')}`; };
const vorMonaten = (mo: string, n: number) => { let [j, m] = mo.split('-').map(Number); m -= n; while (m < 1) { m += 12; j--; } return `${j}-${String(m).padStart(2, '0')}`; };

/** Die Angebote eines Mandats: am Mandat bzw. am Deal des Mandats — ohne Papierkorb, Entwürfe und ersetzte Fassungen. Jüngstes zuerst. Rein. */
export function angeboteDesMandats(m: Pick<Mandat, 'id'> & Partial<Pick<Mandat, 'chanceId'>>, angebote: readonly ZlAngebot[]): ZlAngebot[] {
  return angebote
    .filter(a => !a.geloeschtAm && a.status !== 'entwurf' && a.status !== 'ersetzt' && (a.mandatId === m.id || (!!m.chanceId && a.dealId === m.chanceId)))
    .sort((a, b) => (b.gestelltAm ?? b.angelegt ?? '').localeCompare(a.gestelltAm ?? a.angelegt ?? ''));
}

/** Welche Rechnung gehört zu einem Leistungs- bzw. Ratenmonat (ohne Storno, ohne Rechnungen aus einem Angebot)? Die jüngste zählt. Rein. */
function rechnungImMonat(l: readonly ZlRechnung[], monat: string): ZlRechnung | undefined {
  return l.filter(r => r.art !== 'storno' && r.status !== 'storniert' && !r.angebotId && typeof r.leistungVon === 'string' && r.leistungVon.slice(0, 7) === monat).pop();
}

/** Der Punkt einer Rechnung (bzw. eines Monats ohne Rechnung) — Zustand über `rechnungsZustand`. */
function rechnungsPunkt(id: string, titel: string, r: ZlRechnung | undefined, monat: string | null, heute: string, mandatId: string): ZeitleistenPunkt {
  if (!r) {
    const faellig = !!monat && monat <= heute.slice(0, 7);
    return { id, art: 'rechnung', titel, text: faellig ? `fällig — noch kein Entwurf` : `geplant${monat ? ` für ${monatsName(monat)}` : ''}`, stand: faellig ? 'achtung' : 'offen', href: WEG.mandat(mandatId) };
  }
  const z = rechnungsZustand({ status: r.status, ...(r.art ? { art: r.art } : {}), ...(r.positionen ? { positionen: r.positionen as Rechnung['positionen'] } : {}), ...(r.faellig ? { faellig: r.faellig } : {}) }, heute);
  const href = z === 'entwurf' ? WEG.rechnungSchreiben(r.id, WEG.mandat(mandatId)) : WEG.rechnung(r.id);
  if (z === 'bezahlt') return { id, art: 'rechnung', titel, text: `bezahlt${r.bezahltAm ? ` am ${datum(tag(r.bezahltAm))}` : ''}`, stand: 'erledigt', href };
  if (z === 'ueberfaellig') return { id, art: 'rechnung', titel, text: `überfällig seit ${datum(r.faellig)}`, stand: 'kritisch', href };
  if (z === 'offen') return { id, art: 'rechnung', titel, text: `gestellt${r.faellig ? ` · fällig am ${datum(r.faellig)}` : ''}`, stand: 'jetzt', href };
  if (z === 'entwurf') return { id, art: 'rechnung', titel, text: 'Entwurf liegt bereit — prüfen & stellen', stand: 'achtung', href };
  return { id, art: 'rechnung', titel, text: 'geplant', stand: 'offen', href };
}

/**
 * Die Zeitleiste eines Mandats (siehe Kopf). `rechnungen` = die Rechnungen DIESES Mandats (die Mandatsakte filtert sie schon); `fall` = die Phase des
 * laufenden Falls (fehlt = kein Fall). Rein.
 */
export function kundenZeitleiste(a: { mandat: ZlMandat; angebote?: readonly ZlAngebot[]; rechnungen?: readonly ZlRechnung[]; fall?: ZlFall | null; heute: string }): Zeitleiste {
  const { mandat: m, heute } = a;
  const punkte: ZeitleistenPunkt[] = [];
  const jetztMonat = heute.slice(0, 7);
  // 1 · Angebot
  const ang = angeboteDesMandats(m, a.angebote ?? []);
  const angenommen = ang.find(x => x.status === 'angenommen');
  const angebot = angenommen ?? ang[0];
  if (angebot) {
    const nr = angebot.nummer ? ` ${angebot.nummer}` : '';
    const text = angebot.status === 'angenommen' ? `angenommen${angebot.angenommenAm ? ` am ${datum(tag(angebot.angenommenAm))}` : ''}`
      : angebot.status === 'gestellt' ? `gestellt${angebot.gestelltAm ? ` am ${datum(tag(angebot.gestelltAm))}` : ''} — wartet auf Antwort`
        : angebot.status === 'abgelehnt' ? 'abgelehnt' : 'abgelaufen';
    punkte.push({ id: `angebot-${angebot.id}`, art: 'angebot', titel: `Angebot${nr}`, text, stand: angebot.status === 'gestellt' ? 'jetzt' : angebot.status === 'angenommen' ? 'erledigt' : 'achtung', href: WEG.angebot({ angebotId: angebot.id }) });
  }
  // 2 · Mandat
  const mandatText = m.status === 'aktiv' ? `aktiv${m.start ? ` seit ${datum(m.start)}` : ''}` : m.status === 'beendet' ? `beendet${m.ende ? ` am ${datum(m.ende)}` : ''}`
    : m.status === 'pausiert' ? 'pausiert' : m.status === 'verhandlung' ? 'in Verhandlung' : 'Angebotsphase';
  punkte.push({ id: `mandat-${m.id}`, art: 'mandat', titel: 'Mandat', text: mandatText, stand: m.status === 'aktiv' || m.status === 'beendet' ? 'erledigt' : 'jetzt', href: WEG.mandat(m.id) });
  // 3 · Rechnungen: Raten bzw. Zahlplan · Monatsrechnungen · sonst die vorhandenen
  const eigene = (a.rechnungen ?? []).filter(r => !r.mandatId || r.mandatId === m.id);
  const zp = m.honorar ? zahlplanMonate(m as Parameters<typeof zahlplanMonate>[0]) : null;
  const rechnungsPunkte: ZeitleistenPunkt[] = [];
  const benutzt = new Set<string>();
  const imMonat = (mo: string) => { const r = rechnungImMonat(eigene, mo); if (r) benutzt.add(r.id); return r; };
  if (zp) {
    zp.forEach((mo, i) => rechnungsPunkte.push(rechnungsPunkt(`rate-${mo}-${i}`, m.raten ? `Rate ${i + 1} von ${m.raten.anzahl}` : zp.length > 1 ? (i === 0 ? 'Anzahlung' : 'Restzahlung') : 'Rechnung', imMonat(mo), mo, heute, m.id)));
  } else if (m.honorar?.basis === 'monat' && m.rechnungsrhythmus === 'monatlich' && m.start) {
    // Die letzten fünf Leistungsmonate bis zum nächsten — das Gespräch dreht sich um das, was gerade fällig ist, nicht um die ganze Laufzeit. Ein älterer
    // Monat ohne Rechnung (vor dem Vormonat) bleibt weg: der Altbestand wurde oft außerhalb abgerechnet — gemeldet wird nur, was gerade fällig ist.
    const vormonat = vorMonaten(jetztMonat, 1);
    const ab = m.start.slice(0, 7) > vorMonaten(jetztMonat, 4) ? m.start.slice(0, 7) : vorMonaten(jetztMonat, 4);
    const bis = naechsterMonat(jetztMonat);
    for (let mo = ab, n = 0; mo <= bis && n < 12; mo = naechsterMonat(mo), n++) {
      if (!mandatLaeuftIm(m, mo)) continue;
      const r = imMonat(mo);
      if (!r && mo < vormonat) continue;
      rechnungsPunkte.push(rechnungsPunkt(`monat-${mo}`, monatsName(mo), r, mo, heute, m.id));
    }
  }
  // Rechnungen, die keinem Monat zugeordnet sind (Tagessatz, Quartal, einmalig ohne Zahlplan, aus dem Angebot) — die jüngsten fünf.
  const uebrige = eigene.filter(r => r.art !== 'storno' && r.status !== 'storniert' && !benutzt.has(r.id))
    .sort((x, y) => (x.faellig ?? x.leistungVon ?? '').localeCompare(y.faellig ?? y.leistungVon ?? '')).slice(-5);
  for (const r of uebrige) rechnungsPunkte.push(rechnungsPunkt(`rechnung-${r.id}`, r.leistungVon ? monatsName(r.leistungVon.slice(0, 7)) : 'Rechnung', r, null, heute, m.id));
  punkte.push(...rechnungsPunkte);
  // 4 · Fall
  if (a.fall?.phase) {
    const nr = a.fall.phaseNr && a.fall.phasenAnzahl ? `Phase ${a.fall.phaseNr} von ${a.fall.phasenAnzahl} · ` : '';
    punkte.push({ id: `fall-${m.id}`, art: 'fall', titel: 'Fulfillment', text: `${nr}${a.fall.phase}`, stand: m.status === 'beendet' ? 'erledigt' : 'jetzt', href: WEG.fall(m.id) });
  } else if (m.status === 'aktiv') {
    punkte.push({ id: `fall-${m.id}`, art: 'fall', titel: 'Fulfillment', text: 'noch kein Fall', stand: 'offen', href: WEG.fall(m.id) });
  }
  return { punkte, satz: zeitleistenSatz(m, angebot, rechnungsPunkte, a.fall ?? null), hier: hierIndex(punkte) };
}

/** Wo steht es? Der erste kritische bzw. fehlende Punkt, sonst der letzte erledigte bzw. jetzige. Rein. */
function hierIndex(p: readonly ZeitleistenPunkt[]): number {
  const dringend = p.findIndex(x => x.stand === 'kritisch' || x.stand === 'achtung');
  if (dringend >= 0) return dringend;
  for (let i = p.length - 1; i >= 0; i--) if (p[i].stand === 'jetzt' || p[i].stand === 'erledigt') return i;
  return p.length ? 0 : -1;
}

/** Der Satz oben: Phase + nächster Schritt (Reihenfolge: überfällig · Entwurf bereit · fällig ohne Entwurf · gestellt · nächste geplante). Rein. */
export function zeitleistenSatz(m: Pick<Mandat, 'status'>, angebot: ZlAngebot | undefined, rechnungen: readonly ZeitleistenPunkt[], fall: ZlFall | null): string {
  const phase = m.status === 'beendet' ? 'Mandat beendet' : m.status === 'pausiert' ? 'Mandat pausiert'
    : m.status === 'aktiv' ? (fall?.phase ? `Fulfillment: ${fall.phase}` : 'Mandat aktiv') : angebot?.status === 'gestellt' ? 'Angebot gestellt' : 'Vor dem Mandat';
  const erster = (s: ZeitleistenStand, wort?: RegExp) => rechnungen.find(r => r.stand === s && (!wort || wort.test(r.text)));
  const ueber = erster('kritisch');
  if (ueber) return `${phase} · ${ueber.titel} ${ueber.text} — Mahnung prüfen.`;
  const entwurf = erster('achtung', /liegt bereit/);
  if (entwurf) return `${phase} · ${entwurf.titel} fällig — der Entwurf liegt bereit, prüfen & stellen.`;
  const fehlt = erster('achtung');
  if (fehlt) return `${phase} · ${fehlt.titel} fällig — noch kein Entwurf (der Morgenlauf legt ihn an bzw. in der Mandatsakte schreiben).`;
  const gestellt = erster('jetzt');
  if (gestellt) return `${phase} · ${gestellt.titel} ${gestellt.text}.`;
  const naechste = erster('offen');
  if (naechste) return `${phase} · als Nächstes ${naechste.titel}${/für /.test(naechste.text) ? ` (${naechste.text.replace(/^geplant für /, '')})` : ''}.`;
  if (m.status === 'aktiv' && rechnungen.length && rechnungen.every(r => r.stand === 'erledigt')) return `${phase} · alle Rechnungen bezahlt.`;
  if (angebot?.status === 'gestellt') return `${phase} · wartet auf die Antwort des Kunden.`;
  return `${phase}.`;
}
