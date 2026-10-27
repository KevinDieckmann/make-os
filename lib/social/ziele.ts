// ─── MAKE OS — Social: Ziele je Kanal (rein, Server UND Browser) — 27.10.2026 ───────────────────────────────────────────────────────
// Kevin 27.10.: „Vervollständige weiter die Ziele.“ Ein Ziel misst NUR eingetragene Zahlen (Kontostände, Messungen, Veröffentlichungen) — ohne
// Zahlen heißt es „ohne Daten“, nie geschätzt. Zwei Arten (typen.ts `ZielMetrik`):
//   mit Linie  — follower (letzter Kontostand je Plattform, summiert), aufrufe (Summe der Folgen, die ab `von` veröffentlicht wurden):
//                Soll heute = gerade Linie von `startwert` (Tag `von`) bis `zielwert` (Tag `bis`). Auf Kurs ab 100 % des Solls, knapp ab 80 %.
//   laufend    — posts-woche (Ø der letzten 4 Wochen, frühestens ab `von`), halte3s und shares-je-tsd (Median der letzten 10 Folgen mit Wert):
//                erreicht ab dem Zielwert, knapp ab 80 %.
// Die Schwellen 100 %/80 % sind Startannahmen wie in analyse.ts — keine Plattform-Angabe.

import { folgeZahlen, median } from './analyse';
import { ZIEL_MIT_LINIE, ZIEL_METRIK_NAME, type KanalZiel, type SocialFolge, type SocialKanal, type SocialPlattform, type ZielMetrik } from './typen';

export const ZIEL_KNAPP = 0.8;
const LETZTE_FOLGEN = 10;
const TAKT_TAGE = 28;

const tagMs = (t: string) => Date.UTC(Number(t.slice(0, 4)), Number(t.slice(5, 7)) - 1, Number(t.slice(8, 10)));
/** Ganze Kalendertage von `a` bis `b` (b − a). */
export const tageZwischen = (a: string, b: string) => Math.round((tagMs(b) - tagMs(a)) / 86_400_000);
const tagMinus = (t: string, n: number) => new Date(tagMs(t) - n * 86_400_000).toISOString().slice(0, 10);
const zahlText = (n: number) => (Math.round(n * 10) / 10).toLocaleString('de-DE');

const plattformenVon = (k: SocialKanal, z: Pick<KanalZiel, 'plattform'>): SocialPlattform[] => (z.plattform ? [z.plattform] : k.plattformen);

/** Follower am Tag `am`: je Plattform der jüngste Kontostand bis zu diesem Tag, summiert. Ohne Stand → undefined. */
export function followerAm(k: SocialKanal, plattformen: SocialPlattform[], am: string): number | undefined {
  let summe = 0, gefunden = false;
  for (const p of plattformen) {
    const st = k.staende.filter(s => s.plattform === p && s.am <= am).sort((a, b) => a.am.localeCompare(b.am)).at(-1);
    if (st) { summe += st.follower; gefunden = true; }
  }
  return gefunden ? summe : undefined;
}

/** Erste Veröffentlichung einer Folge (auf einer der Plattformen). */
const ersteVeroeffentlichung = (f: SocialFolge, pl: SocialPlattform[]) => f.veroeffentlicht.filter(v => pl.includes(v.plattform)).map(v => v.am).sort()[0];

/** Eine Folge nur mit den Messungen der gewählten Plattformen (für Plattform-Ziele). */
const nurPlattformen = (f: SocialFolge, pl: SocialPlattform[]): SocialFolge => ({ ...f, messungen: f.messungen.filter(m => pl.includes(m.plattform)) });

/** Der heutige Wert eines Ziels aus den Zahlen — undefined, wenn es keine gibt. */
export function zielIst(z: Pick<KanalZiel, 'metrik' | 'plattform' | 'von'>, k: SocialKanal, folgenAlle: SocialFolge[], heute: string): number | undefined {
  const pl = plattformenVon(k, z);
  const folgen = folgenAlle.filter(f => f.kanalId === k.id && f.status !== 'verworfen');
  switch (z.metrik) {
    case 'follower': return followerAm(k, pl, heute);
    case 'aufrufe': {
      const drin = folgen.filter(f => { const v = ersteVeroeffentlichung(f, pl); return v !== undefined && v >= z.von && v <= heute; });
      const zahlen = drin.map(f => folgeZahlen(nurPlattformen(f, pl))).filter(x => x !== null);
      return zahlen.length ? zahlen.reduce((s, x) => s + x!.views, 0) : undefined;
    }
    case 'posts-woche': {
      const ab = [tagMinus(heute, TAKT_TAGE - 1), z.von].sort().at(-1)!;
      const tage = Math.max(7, tageZwischen(ab, heute) + 1);
      const n = folgen.filter(f => { const v = ersteVeroeffentlichung(f, pl); return v !== undefined && v >= ab && v <= heute; }).length;
      return Math.round((n / (tage / 7)) * 10) / 10;
    }
    case 'halte3s': case 'shares-je-tsd': {
      const werte = folgen.map(f => ({ am: ersteVeroeffentlichung(f, pl), z: folgeZahlen(nurPlattformen(f, pl)) }))
        .filter(x => x.am && x.z && (z.metrik === 'halte3s' ? x.z.halte3s !== undefined : x.z.views > 0))
        .sort((a, b) => b.am!.localeCompare(a.am!)).slice(0, LETZTE_FOLGEN)
        .map(x => (z.metrik === 'halte3s' ? x.z!.halte3s! : x.z!.sharesJeTsd));
      return werte.length ? Math.round(median(werte) * 10) / 10 : undefined;
    }
  }
}

/** Startwert beim Anlegen: Follower am Tag `von`; Aufrufe zählen ab `von` → 0; laufende Ziele haben keine Linie → heutiger Wert (nur Anzeige). */
export function zielStartwert(z: Pick<KanalZiel, 'metrik' | 'plattform' | 'von'>, k: SocialKanal, folgen: SocialFolge[], heute: string): number {
  if (z.metrik === 'follower') return followerAm(k, plattformenVon(k, z), z.von) ?? 0;
  if (z.metrik === 'aufrufe') return 0;
  return zielIst(z, k, folgen, heute) ?? 0;
}

export type ZielAmpel = 'erreicht' | 'auf-kurs' | 'knapp' | 'hinter' | 'verfehlt' | 'ohne-daten';
export const ZIEL_AMPEL_NAME: Record<ZielAmpel, string> = {
  erreicht: 'erreicht', 'auf-kurs': 'auf Kurs', knapp: 'knapp', hinter: 'dahinter', verfehlt: 'Termin vorbei', 'ohne-daten': 'ohne Daten',
};

export interface ZielStand {
  id: string;
  metrik: ZielMetrik;
  ist?: number;
  /** Soll heute (nur Ziele mit Linie). */
  soll?: number;
  /** Anteil des Wegs von Start bis Ziel (0–1, nur Ziele mit Linie) bzw. Ist ÷ Ziel (laufend). */
  anteil: number;
  ampel: ZielAmpel;
  /** Bräuchte ab heute so viel je Woche (nur Ziele mit Linie, solange offen). */
  jeWoche?: number;
  satz: string;
}

export function zielStand(z: KanalZiel, k: SocialKanal, folgen: SocialFolge[], heute: string): ZielStand {
  const ist = zielIst(z, k, folgen, heute);
  const name = ZIEL_METRIK_NAME[z.metrik];
  const basis = { id: z.id, metrik: z.metrik };
  if (ist === undefined) return { ...basis, anteil: 0, ampel: 'ohne-daten', satz: z.metrik === 'follower' ? 'Noch kein Kontostand — Follower aus den Insights eintragen.' : 'Noch keine Zahlen für dieses Ziel.' };
  if (!(ZIEL_MIT_LINIE as readonly ZielMetrik[]).includes(z.metrik) || !z.bis) {
    const anteil = z.zielwert > 0 ? Math.min(1, ist / z.zielwert) : 1;
    const ampel: ZielAmpel = ist >= z.zielwert ? 'erreicht' : ist >= z.zielwert * ZIEL_KNAPP ? 'knapp' : 'hinter';
    return { ...basis, ist, anteil, ampel, satz: `${name}: ${zahlText(ist)} — Ziel ${zahlText(z.zielwert)}.` };
  }
  const weg = z.zielwert - z.startwert;
  const anteil = weg > 0 ? Math.max(0, Math.min(1, (ist - z.startwert) / weg)) : 1;
  if (ist >= z.zielwert) return { ...basis, ist, anteil: 1, ampel: 'erreicht', satz: `${zahlText(ist)} ${name} — Ziel ${zahlText(z.zielwert)} erreicht.` };
  if (heute > z.bis) return { ...basis, ist, anteil, ampel: 'verfehlt', satz: `Termin vorbei: ${zahlText(ist)} von ${zahlText(z.zielwert)} ${name}.` };
  const dauer = Math.max(1, tageZwischen(z.von, z.bis));
  const vergangen = Math.max(0, Math.min(dauer, tageZwischen(z.von, heute)));
  const soll = z.startwert + weg * (vergangen / dauer);
  const wochenRest = Math.max(1 / 7, (tageZwischen(heute, z.bis) + 1) / 7);
  const jeWoche = Math.ceil((z.zielwert - ist) / wochenRest);
  const vorSoll = soll - z.startwert;
  const quote = vorSoll > 0 ? (ist - z.startwert) / vorSoll : 1;
  const ampel: ZielAmpel = quote >= 1 ? 'auf-kurs' : quote >= ZIEL_KNAPP ? 'knapp' : 'hinter';
  return {
    ...basis, ist, soll: Math.round(soll), anteil, ampel, jeWoche,
    satz: `${zahlText(ist)} von ${zahlText(z.zielwert)} ${name} — heute wären ${zahlText(Math.round(soll))} auf der Linie; ab jetzt ${zahlText(jeWoche)} je Woche.`,
  };
}

export const kanalZiele = (k: SocialKanal, folgen: SocialFolge[], heute: string): ZielStand[] => k.ziele.map(z => zielStand(z, k, folgen, heute));
