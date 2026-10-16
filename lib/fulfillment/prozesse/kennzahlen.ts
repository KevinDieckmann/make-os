// ─── Fulfillment · Prozesse — Kennzahlen (C1, 10.10.; FULFILLMENT_KONZEPT.md 1.4 + Entscheidung 23:25 „sofort in den Business-Index“) ─────────
// Zwei Teile, beide rein:
//   1. Die Erfolgsmaße aus 1.4 (`ff_willkommen_24h` … `ff_analyse_kosten`) — gezeigt unter Fulfillment › Visualisierung, je mit Erklärung.
//   2. Die Säule „Fulfillment“ im Business-Index (`FF_SAEULE`, `FF_KENNZAHLEN`, `ffMessung`): Health, Takt, Kunden-Puls, Wert-Konto der
//      laufenden Fälle. Die Säule trägt `nurMitMessung` — ohne Fall (bzw. ohne Messung) fällt sie ganz heraus, und weil die übrigen Säulen nur
//      skaliert werden (×0,9), ist der Index dann EXAKT der bisherige (Test tests/fulfillment-c1-index.test.ts). Gemessen je Sicht: Gesamt =
//      alle Fälle von Business-Gesellschaften, eine Gesellschaft = ihre Fälle.
// Gerechnet nur aus Summen je Fall (keine Personen); die Zeilen liefert lib/fulfillment/prozesse/server.ts `ffKennzahlenFuerIndex`.

import type { KennzahlDefBasis, Messung, Detail, Ampel } from '@/lib/kennzahlen/kern';
import type { DossierKurz, Fall } from '../typen';
import { tageZwischen, wartetAufEuch } from '../regeln';
import { wertDurchschnitt } from './wert';
import { fallStartTag } from './fall';
import { reportAchse } from './ansichten';
import { WEG } from '@/lib/wege';
import { anzahl, wort } from '@/lib/text/zahlwort';

// ── 1. Erfolgsmaße (1.4) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface FfFallDaten {
  fall: Fall;
  kunde: string;
  unterschrift?: string;
  kickoffTag?: string;
  reportLetzter?: string;
  /** Die erstellten Fortschritts-Reports (Tag) — dieselbe Liste wie die Report-Zeitachse im Fall (Kunde & Reports). */
  reports?: readonly { am: string }[];
  puls?: { wert: number; am: string };
  dossier?: DossierKurz;
  mandatsEnde?: string | null;
}
export interface FfKennzahl { id: string; label: string; wert: number | null; anzeige: string; n: number; luecke?: string; erklaerung: string }

const pz = (n: number) => `${Math.round(n)} %`;
const median = (l: number[]) => { if (!l.length) return null; const s = [...l].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Tag des Kick-offs: Mitschrift eines Kick-off-Rituals, sonst die Bestätigung der Vereinbarung bzw. von F0 „im Kick-off“. */
export function kickoffTag(f: Fall, kickoffRitualIds: readonly string[]): string | undefined {
  const l = [
    ...f.mitschriften.filter(m => m.ritualId && kickoffRitualIds.includes(m.ritualId)).map(m => m.am),
    ...(f.vereinbarung?.bestaetigtWie === 'kickoff' && f.vereinbarung.bestaetigtAm ? [f.vereinbarung.bestaetigtAm] : []),
    ...(f.freigaben.F0?.kunde?.wie === 'kickoff' ? [f.freigaben.F0.kunde.am] : []),
  ].sort();
  return l[0];
}

export function ffKennzahlenRechnen(faelle: readonly FfFallDaten[], e: { heute: string; jetzt: string; willkommenStunden: number }): FfKennzahl[] {
  const aktiv = faelle.filter(x => x.fall.status !== 'abgeschlossen');
  const raus: FfKennzahl[] = [];
  const k = (id: string, label: string, erklaerung: string, wert: number | null, anzeige: (w: number) => string, n: number, luecke: string) =>
    raus.push({ id, label, erklaerung, wert, anzeige: wert == null ? '—' : anzeige(wert), n, ...(wert == null ? { luecke } : {}) });

  // Willkommensmail ≤ 24 h nach der Unterschrift (nur Fälle, bei denen die Frist schon abgelaufen oder die Mail raus ist).
  const w = faelle.filter(x => x.unterschrift).map(x => {
    const u = Date.parse(x.unterschrift!.length === 10 ? `${x.unterschrift}T00:00:00Z` : x.unterschrift!);
    const frist = u + e.willkommenStunden * 3_600_000;
    const gesendet = x.fall.onboarding.willkommenGesendetAm ? Date.parse(x.fall.onboarding.willkommenGesendetAm) : null;
    if (gesendet == null && Date.parse(e.jetzt) < frist) return null;
    return gesendet != null && gesendet <= frist;
  }).filter((x): x is boolean => x !== null);
  k('ff_willkommen_24h', 'Willkommen in 24 Stunden', 'fulfillment.kennzahl.willkommen', w.length ? (w.filter(Boolean).length / w.length) * 100 : null, pz, w.length, 'Noch kein Fall mit abgelaufener 24-Stunden-Frist');
  const ko = faelle.map(x => (x.unterschrift && x.kickoffTag ? tageZwischen(x.unterschrift, x.kickoffTag) : undefined)).filter((x): x is number => x !== undefined);
  const m = median(ko);
  k('ff_kickoff_tage', 'Tage bis zum Kick-off', 'fulfillment.kennzahl.kickoff', m, x => anzahl(x, 'Tag', 'Tage'), ko.length, 'Noch kein Kick-off vermerkt (Mitschrift oder Bestätigung im Kick-off)');
  const wk = faelle.filter(x => x.kickoffTag && tageZwischen(x.kickoffTag, e.heute)! >= 7).map(x => {
    const fest = Object.values(x.fall.wertKonto).map(v => v.festgelegtAm).filter((t): t is string => !!t);
    return fest.length > 0 && fest.every(t => tageZwischen(x.kickoffTag!, t) !== undefined && t <= addTage(x.kickoffTag!, 7));
  });
  k('ff_wertkonto', 'Wert-Konto bis Kick-off + 7', 'fulfillment.kennzahl.wertkonto', wk.length ? (wk.filter(Boolean).length / wk.length) * 100 : null, pz, wk.length, 'Noch kein Kick-off, das sieben Tage zurückliegt');
  const qw = faelle.filter(x => tageZwischen(fallStartTag(x.fall), e.heute)! >= 30).map(x => x.fall.quickWins.some(q => q.erledigtAm && q.erledigtAm <= addTage(fallStartTag(x.fall), 30)));
  k('ff_quickwin_30', 'Quick Win in 30 Tagen', 'fulfillment.kennzahl.quickwin', qw.length ? (qw.filter(Boolean).length / qw.length) * 100 : null, pz, qw.length, 'Noch kein Fall, der 30 Tage läuft');
  // 14.10. (Abnahme B6): aus DERSELBEN Rechnung wie die Report-Zeitachse im Fall (`reportAchse`) — Anteil der Soll-Termine (alle 14 Tage ab Start, bis heute),
  // vor denen ein Report entstand. Vorher zählte nur „letzter Report ≤ 14 Tage“: 100 %, während die Zeitachse einen verpassten Termin rot zeigte.
  const soll = aktiv.flatMap(x => reportAchse({ start: fallStartTag(x.fall), heute: e.heute, reports: x.reports ?? (x.reportLetzter ? [{ am: x.reportLetzter }] : []) }).takt.filter(t => t.tag <= e.heute));
  k('ff_report_takt', 'Report-Takt eingehalten', 'fulfillment.kennzahl.reporttakt', soll.length ? (soll.filter(t => t.erfuellt).length / soll.length) * 100 : null, pz, soll.length, 'Noch kein Report-Termin fällig (alle 14 Tage ab Start)');
  const alt = aktiv.flatMap(x => wartetAufEuch(x.fall, e.heute).map(p => p.tage ?? 0));
  k('ff_wartet_alt', 'Ältester Punkt „wartet auf euch“', 'fulfillment.kennzahl.wartet', alt.length ? Math.max(...alt) : aktiv.length ? 0 : null, x => anzahl(x, 'Tag', 'Tage'), alt.length, 'Kein laufender Fall');
  const p = faelle.map(x => x.puls).filter((x): x is { wert: number; am: string } => !!x && (tageZwischen(x.am, e.heute) ?? 999) <= 90);
  k('ff_puls', 'Kunden-Puls (Ø 90 Tage)', 'fulfillment.kennzahl.puls', p.length ? p.reduce((a, x) => a + x.wert, 0) / p.length : null, x => `${x.toLocaleString('de-DE', { maximumFractionDigits: 1 })} von 10`, p.length, 'Noch kein Puls in den letzten 90 Tagen');
  const bf = faelle.filter(x => x.fall.status === 'abgeschlossen' || !!x.mandatsEnde).flatMap(x => x.fall.befaehigung);
  k('ff_befaehigung', 'Befähigung am Mandatsende', 'fulfillment.kennzahl.befaehigung', bf.length ? (bf.filter(b => b.erfuellt).length / bf.length) * 100 : null, pz, bf.length, 'Noch kein abgeschlossener Fall');
  // Belegquote des Dossiers liefert die Kurzform der Analyse (C3) nicht — ehrlich als Lücke.
  k('ff_dossier_belegt', 'Dossier-Aussagen mit Quelle', 'fulfillment.kennzahl.dossier', null, pz, 0, 'Kommt aus der Analyse (Fall › Analyse › Prüfung)');
  const ds = faelle.map(x => x.dossier).filter((x): x is DossierKurz => !!x?.vorhanden);
  k('ff_analyse_kosten', 'Analyse-Kosten je Dossier', 'fulfillment.kennzahl.kosten', ds.length ? ds.reduce((a, x) => a + x.kostenCent, 0) / ds.length / 100 : null, x => `${x.toLocaleString('de-DE', { maximumFractionDigits: 2 })} €`, ds.length, 'Noch kein Dossier');
  return raus;
}
function addTage(t: string, n: number): string { const d = new Date(`${t.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ── 2. Säule „Fulfillment“ im Business-Index ──────────────────────────────────────────────────────────────────────────────────────────

export const FF_ID = 'ff';
export const FF_GEWICHT = 0.1;
export const FF_SAEULE = { id: FF_ID, label: 'Fulfillment', gewicht: FF_GEWICHT, satz: 'Wie gut wir liefern — Kunden-Gesundheit, Takt, Kunden-Puls und Wert-Konto der laufenden Fälle', nurMitMessung: true };

/** Eine Zeile je laufendem Fall (nur Summen, keine Personen). */
export interface FfIndexZeile {
  mandatId: string; gesellschaft: string; kunde: string;
  health: 'gruen' | 'gelb' | 'rot' | null;
  haengt: string[];
  puls?: { wert: number; am: string };
  /** Ø Zielerreichung im Wert-Konto (0–100) — null ohne messbares Ziel. */
  wert: number | null;
}
export interface FfIndexDaten { heute: string; zeilen: FfIndexZeile[] }

const PFLEGEN = { text: 'Fulfillment öffnen', href: WEG.fulfillment('visualisierung') };
export const FF_KENNZAHLEN: KennzahlDefBasis[] = [
  { id: 'ff_health', label: 'Gesundheit der Fälle', saeule: FF_ID, gruppe: 'Lieferung', gewicht: 1.5, einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'Ø Gesundheits-Ampel der laufenden Fälle (grün zählt 100, gelb 50, rot 0) — die vorhandene Ampel aus Terminen, Lieferungen, Zahlungen, Zufriedenheit',
    quelle: 'Fälle (Fulfillment) + Fortschritt im Paket (Leistungstreppe)', luecke: 'Noch kein laufender Fall', pflegen: PFLEGEN },
  { id: 'ff_takt', label: 'Fälle im Takt', saeule: FF_ID, gruppe: 'Lieferung', gewicht: 1.5, einheit: 'prozent', richtung: 'hoch', gruen: 80, rot: 50,
    formel: 'Anteil der laufenden Fälle, an denen nichts hängt (keine überfällige Willkommensmail, Freigabe oder Schritt, nichts wartet länger als 7 Tage, Report höchstens 14 Tage alt)',
    quelle: 'Fälle (Fulfillment) — „Was hängt“ im Cockpit', luecke: 'Noch kein laufender Fall', pflegen: { text: 'Cockpit öffnen', href: WEG.fulfillment('visualisierung') } },
  { id: 'ff_puls', label: 'Kunden-Puls', saeule: FF_ID, gruppe: 'Kunde', einheit: 'anzahl', richtung: 'hoch', gruen: 8, rot: 6,
    formel: 'Ø letzter Kunden-Puls (0–10) je Fall in den letzten 90 Tagen',
    quelle: 'Puls-Antworten über den Kunden-Link bzw. von Hand (Fulfillment › Fall › Kunde & Reports)', luecke: 'Noch kein Puls in den letzten 90 Tagen', pflegen: PFLEGEN },
  { id: 'ff_wert', label: 'Wert-Konto erreicht', saeule: FF_ID, gruppe: 'Kunde', einheit: 'prozent', richtung: 'hoch', gruen: 70, rot: 30,
    formel: 'Ø Zielerreichung im Wert-Konto (letzte Messung zwischen Ausgang und Ziel) über die messbaren Ziele der laufenden Fälle',
    quelle: 'Wert-Konto der Fälle (Ausgang, Ziel, Messungen — trägt nur MAKE ein)', luecke: 'Noch kein Ziel mit Ausgang, Zielwert und Messung', pflegen: PFLEGEN },
];

const AMPEL_PUNKTE = { gruen: 100, gelb: 50, rot: 0 } as const;
const z1 = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

/** Die Zeilen einer Sicht: Gesamt = alle, sonst nur die Fälle dieser Gesellschaft. */
export const ffZeilenFuer = (d: FfIndexDaten | null | undefined, scope: string): FfIndexZeile[] =>
  (d?.zeilen ?? []).filter(z => scope === 'gesamt' || z.gesellschaft === scope);

/** Eine Messung der Säule — jede gemessene Kennzahl hat zwei bis drei Punkte dahinter (Sprung in den Fall). */
export function ffMessung(id: string, d: FfIndexDaten | null | undefined, scope: string): Messung {
  const zeilen = ffZeilenFuer(d, scope);
  const zuFulfillment: Detail[] = [{ titel: 'Fulfillment öffnen', href: WEG.fulfillment('visualisierung') }];
  if (!zeilen.length) return { luecke: 'Noch kein laufender Fall', details: zuFulfillment };
  const fall = (z: FfIndexZeile, r?: Parameters<typeof WEG.fall>[1]) => WEG.fall(z.mandatId, r);
  switch (id) {
    case 'ff_health': {
      const m = zeilen.filter(z => z.health);
      if (!m.length) return { luecke: 'Noch keine Gesundheits-Ampel (Fortschritt im Paket)', details: zuFulfillment };
      const w = m.reduce((a, z) => a + AMPEL_PUNKTE[z.health!], 0) / m.length;
      return { wert: w, anzeige: `${Math.round(w)} %`, quelle: `${m.filter(z => z.health === 'gruen').length} grün · ${m.filter(z => z.health === 'gelb').length} gelb · ${m.filter(z => z.health === 'rot').length} rot`,
        details: [...m].sort((a, b) => AMPEL_PUNKTE[a.health!] - AMPEL_PUNKTE[b.health!]).slice(0, 3).map(z => ({ titel: z.kunde, wert: z.health === 'gruen' ? 'grün' : z.health === 'gelb' ? 'gelb' : 'rot', href: fall(z), ampel: z.health as Ampel })) };
    }
    case 'ff_takt': {
      const ok = zeilen.filter(z => !z.haengt.length).length;
      const w = (ok / zeilen.length) * 100;
      const h = zeilen.filter(z => z.haengt.length);
      return { wert: w, anzeige: `${Math.round(w)} %`, quelle: `${ok} von ${zeilen.length} ${wort(zeilen.length, 'Fall', 'Fällen')} ohne Hänger`,
        details: (h.length ? h : zeilen).slice(0, 3).map(z => ({ titel: z.kunde, wert: z.haengt.length ? `${z.haengt.length} ${wort(z.haengt.length, 'hängt', 'hängen')}` : 'im Takt', ...(z.haengt[0] ? { unter: z.haengt[0] } : {}), href: fall(z), ampel: (z.haengt.length ? 'gelb' : 'gruen') as Ampel })) };
    }
    case 'ff_puls': {
      const m = zeilen.filter(z => z.puls && (tageZwischen(z.puls.am, d!.heute) ?? 999) <= 90);
      if (!m.length) return { luecke: 'Noch kein Puls in den letzten 90 Tagen', details: zuFulfillment };
      const w = m.reduce((a, z) => a + z.puls!.wert, 0) / m.length;
      return { wert: w, anzeige: `${z1(w)} von 10`, quelle: `Ø aus ${m.length} Fäll${m.length === 1 ? '' : 'en'} (letzter Puls je Fall)`,
        details: [...m].sort((a, b) => a.puls!.wert - b.puls!.wert).slice(0, 3).map(z => ({ titel: z.kunde, wert: `${z.puls!.wert} / 10`, unter: `am ${z.puls!.am.slice(8, 10)}.${z.puls!.am.slice(5, 7)}.`, href: fall(z, 'kunde') })) };
    }
    case 'ff_wert': {
      const m = zeilen.filter(z => z.wert != null);
      if (!m.length) return { luecke: 'Noch kein Ziel mit Ausgang, Zielwert und Messung', details: zeilen.slice(0, 2).map(z => ({ titel: `${z.kunde}: Wert-Konto festlegen`, href: fall(z, 'wert') })) };
      const w = m.reduce((a, z) => a + (z.wert as number), 0) / m.length;
      return { wert: w, anzeige: `${Math.round(w)} %`, quelle: `Ø Zielerreichung aus ${m.length} Fäll${m.length === 1 ? '' : 'en'}`,
        details: [...m].sort((a, b) => (a.wert as number) - (b.wert as number)).slice(0, 3).map(z => ({ titel: z.kunde, wert: `${z.wert} %`, href: fall(z, 'wert') })) };
    }
    default: return { luecke: 'Keine Messung hinterlegt' };
  }
}

/** Messfunktionen für ein Modell: `ffMessen(b => b.fulfillment, b => b.scope)`. */
export function ffMessen<B>(von: (b: B) => FfIndexDaten | null | undefined, scope: (b: B) => string): Record<string, (b: B) => Messung> {
  return Object.fromEntries(FF_KENNZAHLEN.map(k => [k.id, (b: B) => ffMessung(k.id, von(b), scope(b))]));
}

/** Eine Index-Zeile aus den Teilen eines Falls (Server baut sie in `ffKennzahlenFuerIndex`). */
export function ffIndexZeile(e: { fall: Fall; gesellschaft: string; kunde: string; health: FfIndexZeile['health']; haengt: string[]; puls?: { wert: number; am: string } }): FfIndexZeile {
  return {
    mandatId: e.fall.mandatId, gesellschaft: e.gesellschaft, kunde: e.kunde, health: e.health, haengt: e.haengt,
    ...(e.puls ? { puls: e.puls } : {}), wert: wertDurchschnitt(e.fall.wertKonto)?.wert ?? null,
  };
}
