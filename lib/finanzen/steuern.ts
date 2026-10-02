// ─── Finanzplanung jetzt — Welche Steuern gelten? (rein, getestet) ───────────
// Kevin 02.10.: „Unten stehen so viele Steuern, die wir nicht brauchen.“ Jede
// Gesellschaft bekommt ein Steuerprofil: die Rechtsform bestimmt, welche
// Steuerzeilen überhaupt vorkommen (GmbH: Körperschaftsteuer + Soli, Gewerbesteuer
// mit Hebesatz, USt nur als Durchlauf · Einzelunternehmen: Einkommensteuer-
// Vorauszahlung · Privat: Netto-Tabelle) — alles Weitere erscheint nicht.
//
// Der Rechenkern v3 (lib/finanzen/rechenkern.ts) bleibt, wie er ist: er kennt EINE
// Ertragsteuer-Quote der MAKE Innovation GmbH (`annahmen.steuerUG`, auf den Gewinn des Vorjahres),
// einen USt-Satz (`annahmen.ust`), die Steuer auf den Ausstieg (`annahmen.exitSteuer`) und
// die Netto-Tabelle. Das Profil legt NUR zwei Dinge darüber:
//   1. Sichtbarkeit — ob eine Steuerzeile in den Blättern erscheint (Anzeige, ändert keine Zahl).
//   2. Aufschlüsselung — wer die Ertragsteuer nach Steuerarten einstellen will (KSt, Soli,
//      Gewerbesteuer mit Hebesatz), bekommt die Summe als `annahmen.steuerUG` geschrieben.
//      Beim Einschalten wird die Aufteilung aus dem heutigen Gesamtsatz abgeleitet (Hebesatz
//      als Rest) — der Gesamtsatz, und damit jede Zahl, bleibt beim Einschalten genau gleich.
// Ein Dokument ohne `steuern` verhält sich exakt wie vorher (Test „Regression“).
// Steuern sind Näherungen — Hinweis, keine Steuerberatung.

import { UG_KURZ, finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import type { Annahmen, FinanzDaten } from './rechenkern';
import type { Operation } from './plan/operationen';

export type Rechtsform = 'kapital' | 'einzel';
export type SteuerArt = 'kst' | 'soli' | 'gewst' | 'est' | 'ust' | 'exit' | 'netto' | 'ausschuettung';

export interface SteuerZeileEin { an?: boolean; satz?: number; hebesatz?: number }
export interface Steuerprofil {
  rechtsform?: Rechtsform;
  /** Ertragsteuer nach Steuerarten aufgeschlüsselt (sonst ein Gesamtsatz). */
  einzeln?: boolean;
  zeilen?: Partial<Record<SteuerArt, SteuerZeileEin>>;
}
/** Im Dokument als `steuern` gespeichert — je Ort höchstens ein Profil, alles optional. */
export type Steuern = Partial<Record<FinanzOrt, Steuerprofil>>;

export const RECHTSFORM_LABEL: Record<Rechtsform, string> = { kapital: 'GmbH / UG (Kapitalgesellschaft)', einzel: 'Einzelunternehmen / Freiberuf' };

/** Standard-Sätze (Hinweis, keine Steuerberatung): KSt 15 %, Soli 5,5 % auf die KSt, Gewerbesteuer-Messzahl 3,5 %. */
export const STEUER_STANDARD = { kst: 0.15, soli: 0.055, messzahl: 0.035 } as const;

export interface SteuerArtInfo {
  id: SteuerArt; label: string; kurz: string;
  /** Was die Zeile in der Rechnung bewirkt — ehrlich, auch wenn sie nur anzeigt. */
  wirkung: string;
  /** Satz-Eingabe: Prozent (Anteil, gespeichert als 0,15) oder keine. */
  eingabe: 'satz' | 'gewerbe' | 'keine';
}
export const STEUER_ARTEN: Record<SteuerArt, SteuerArtInfo> = {
  kst: { id: 'kst', label: 'Körperschaftsteuer', kurz: 'KSt', eingabe: 'satz', wirkung: 'Teil der Ertragsteuer-Quote auf den Gewinn des Vorjahres' },
  soli: { id: 'soli', label: 'Solidaritätszuschlag auf die KSt', kurz: 'Soli', eingabe: 'satz', wirkung: 'Zuschlag auf die Körperschaftsteuer' },
  gewst: { id: 'gewst', label: 'Gewerbesteuer', kurz: 'GewSt', eingabe: 'gewerbe', wirkung: 'Messzahl × Hebesatz — Teil der Ertragsteuer-Quote' },
  est: { id: 'est', label: 'Einkommensteuer-Vorauszahlung', kurz: 'ESt', eingabe: 'keine', wirkung: 'Näherung nach Grundtarif auf den Gewinn' },
  ust: { id: 'ust', label: 'Umsatzsteuer (Durchlauf)', kurz: 'USt', eingabe: 'satz', wirkung: 'vereinnahmt und im Folgemonat ans Finanzamt — verändert den Gewinn nicht' },
  exit: { id: 'exit', label: 'Steuer auf den Ausstieg', kurz: 'Ausstieg', eingabe: 'satz', wirkung: 'pauschaler Satz auf die Tranchen des Ausstiegs' },
  netto: { id: 'netto', label: 'Lohnsteuer und Sozialabgaben', kurz: 'Netto', eingabe: 'keine', wirkung: 'Brutto → Netto aus der Netto-Tabelle' },
  ausschuettung: { id: 'ausschuettung', label: 'Steuer auf die Ausschüttung', kurz: 'Ausschüttung', eingabe: 'satz', wirkung: 'pauschal je Szenario (Kapitalertragsteuer + Soli), privat kommt brutto minus Steuer an' },
};

// ── Standard je Ort ─────────────────────────────────────────────────────────
/** Standard-Rechtsform: die MAKE Innovation GmbH und KD Ventures sind Kapitalgesellschaften, die Selbstständigkeit ein Einzelunternehmen. */
export const rechtsformStandard = (ort: FinanzOrt): Rechtsform | null => (ort === 'privat' ? null : ort === 'kdc' ? 'einzel' : 'kapital');

export const profilVon = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt): Steuerprofil => d.steuern?.[ort] ?? {};
export const rechtsformVon = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt): Rechtsform | null => (ort === 'privat' ? null : profilVon(d, ort).rechtsform ?? rechtsformStandard(ort));

/**
 * Welche Steuerarten zu diesem Ort passen — nur das, was der Plan auch rechnen oder zeigen kann.
 * Die Ertragsteuer-Quote des Kerns hängt an der MAKE Innovation GmbH (`ug`): Kapitalgesellschaft → KSt + Soli + Gewerbesteuer,
 * sonst eine pauschale Einkommensteuer-Vorauszahlung. KD Ventures kennt im Kern nur die Steuer auf den Ausstieg,
 * die Selbstständigkeit die Einkommensteuer (Abschluss 2026; ihre Bausteine rechnet der Kern über die Kanäle der MAKE Innovation GmbH, dort steht die USt), Privat die Netto-Tabelle und die Ausschüttung.
 */
export function steuerArtenFuer(ort: FinanzOrt, rf: Rechtsform | null): SteuerArt[] {
  if (ort === 'privat') return ['netto', 'ausschuettung'];
  if (ort === 'kdv') return ['exit'];
  if (ort === 'kdc') return ['est'];
  return rf === 'einzel' ? ['est', 'ust', 'ausschuettung'] : ['kst', 'soli', 'gewst', 'ust', 'ausschuettung'];
}

const eingeschaltet = (p: Steuerprofil, art: SteuerArt): boolean => p.zeilen?.[art]?.an !== false;
/** Gilt die Steuerart (angeschaltet im Profil)? Standard: ja. */
export const steuerAn = (d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt, art: SteuerArt): boolean => eingeschaltet(profilVon(d, ort), art);

/** Zeigt ein Blatt diese Steuerart? Nur passende Arten, die nicht abgeschaltet sind. */
export function zeigeSteuer(d: Pick<FinanzDaten, 'steuern'>, ort: FinanzOrt, art: SteuerArt): boolean {
  return steuerArtenFuer(ort, rechtsformVon(d, ort)).includes(art) && steuerAn(d, ort, art);
}

// ── Gesamtsatz der Ertragsteuer ─────────────────────────────────────────────
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Bestandteile (Anteile am Gewinn) der aufgeschlüsselten Ertragsteuer — nur geltende Zeilen, Sätze mit Standard. */
export function ertragsteuerTeile(p: Steuerprofil): { kst: number; soli: number; gewst: number } {
  const z = p.zeilen ?? {};
  const kstAn = eingeschaltet(p, 'kst'), soliAn = eingeschaltet(p, 'soli'), gewAn = eingeschaltet(p, 'gewst');
  const kstSatz = num(z.kst?.satz) ?? STEUER_STANDARD.kst;
  const soliSatz = num(z.soli?.satz) ?? STEUER_STANDARD.soli;
  const kst = kstAn ? kstSatz : 0;
  const soli = kstAn && soliAn ? kstSatz * soliSatz : 0;
  const gewst = gewAn ? (num(z.gewst?.satz) ?? STEUER_STANDARD.messzahl) * ((num(z.gewst?.hebesatz) ?? 0) / 100) : 0;
  return { kst, soli, gewst };
}
/** Summe der Ertragsteuer-Bestandteile — das schreibt das Profil als `annahmen.steuerUG`. */
export function gesamtsatzAus(p: Steuerprofil): number {
  const t = ertragsteuerTeile(p);
  return t.kst + t.soli + t.gewst;
}
/** Anteile von KSt, Soli, Gewerbesteuer an einer Steuerzahlung (Summe 1; ohne Satz alles 0). */
export function steuerAnteile(p: Steuerprofil): { kst: number; soli: number; gewst: number } {
  const t = ertragsteuerTeile(p), s = t.kst + t.soli + t.gewst;
  return s > 0 ? { kst: t.kst / s, soli: t.soli / s, gewst: t.gewst / s } : { kst: 0, soli: 0, gewst: 0 };
}

/**
 * Aufteilung eines vorhandenen Gesamtsatzes in KSt + Soli + Gewerbesteuer — der Hebesatz ist der Rest.
 * Reicht der Gesamtsatz nicht für KSt + Soli, schrumpft die KSt (Gewerbesteuer aus). Die Summe ergibt immer genau den Gesamtsatz.
 */
export function aufteilen(gesamt: number): Steuerprofil {
  const g = Math.max(0, Number.isFinite(gesamt) ? gesamt : 0);
  const { kst, soli, messzahl } = STEUER_STANDARD;
  const grund = kst * (1 + soli);
  if (g >= grund) return { einzeln: true, zeilen: { kst: { satz: kst }, soli: { satz: soli }, gewst: { satz: messzahl, hebesatz: ((g - grund) / messzahl) * 100 } } };
  return { einzeln: true, zeilen: { kst: { satz: g / (1 + soli) }, soli: { satz: soli }, gewst: { satz: messzahl, hebesatz: 0, an: false } } };
}

// ── Zeilen für die Karte „Welche Steuern gelten?“ ───────────────────────────
export interface SteuerZeile {
  art: SteuerArt; info: SteuerArtInfo; an: boolean;
  /** Schalter bedienbar? Bei Einzel-Sätzen ja, sonst ist die Zeile Teil des Gesamtsatzes. */
  schaltbar: boolean;
  /** Anteil (0,15) oder Messzahl; leer, wenn die Zeile keinen Satz hat. */
  satz?: number;
  hebesatz?: number;
  /** Woher der Satz kommt: das Profil, die Annahmen des Plans, das Szenario oder fest im Kern. */
  quelle: 'profil' | 'annahmen' | 'szenario' | 'kern';
  hinweis?: string;
}

/** Die Zeilen eines Ortes — in der Reihenfolge, wie sie die Karte zeigt. `ausschuettungSatz` kommt aus dem Arbeitsplan (sonst die Vorgabe). */
export function steuerZeilen(d: Pick<FinanzDaten, 'steuern' | 'annahmen'>, ort: FinanzOrt, ausschuettungSatz: number): SteuerZeile[] {
  const rf = rechtsformVon(d, ort), p = profilVon(d, ort), a = d.annahmen;
  const einzeln = !!p.einzeln && rf === 'kapital' && ort === 'ug';
  return steuerArtenFuer(ort, rf).map((art): SteuerZeile => {
    const info = STEUER_ARTEN[art], an = eingeschaltet(p, art);
    switch (art) {
      case 'kst': case 'soli': case 'gewst': {
        if (!einzeln) return { art, info, an: true, schaltbar: false, quelle: 'annahmen', hinweis: 'steckt im Gesamtsatz — „Nach Steuerarten einstellen“ trennt sie auf' };
        const z = p.zeilen?.[art];
        return { art, info, an, schaltbar: true, quelle: 'profil',
          satz: num(z?.satz) ?? (art === 'kst' ? STEUER_STANDARD.kst : art === 'soli' ? STEUER_STANDARD.soli : STEUER_STANDARD.messzahl),
          ...(art === 'gewst' ? { hebesatz: num(z?.hebesatz) ?? 0 } : {}) };
      }
      case 'est': return ort === 'kdc'
        ? { art, info, an, schaltbar: true, quelle: 'kern', hinweis: 'Grundtarif § 32a EStG im Plan fest, Schalter nur für die Anzeige im Blatt — Vorsorge und Sonderausgaben stehen im Abschluss 2026' }
        : { art, info: { ...info, label: 'Ertragsteuer pauschal (Einkommensteuer-Vorauszahlung)' }, an, schaltbar: true, satz: a.steuerUG, quelle: 'annahmen', hinweis: 'Aus = Satz 0; der alte Satz bleibt gemerkt' };
      case 'ust': return { art, info, an, schaltbar: true, satz: a.ust, quelle: 'annahmen', hinweis: 'Schalter nur für die Anzeige — Durchlauf, ändert den Gewinn nicht. Kleinunternehmer: Satz 0' };
      case 'exit': return { art, info, an, schaltbar: true, satz: a.exitSteuer, quelle: 'annahmen', hinweis: 'Aus = Satz 0; der alte Satz bleibt gemerkt' };
      case 'ausschuettung': return { art, info, an: true, schaltbar: false, satz: ausschuettungSatz, quelle: 'szenario', hinweis: 'gilt je Szenario (Planen › Szenarien bauen); ohne Ausschüttung steht die Zeile nicht im Blatt' };
      case 'netto': return { art, info, an: true, schaltbar: false, quelle: 'annahmen', hinweis: 'Netto-Tabelle unten' };
    }
  });
}

// ── Änderungen als Operationen ──────────────────────────────────────────────
const pfad = (ort: FinanzOrt, rest: string) => `/steuern/${ort}${rest}`;

/** Profil nach einer Änderung (rein) — für Gesamtsatz und Test. */
export function profilMit(p: Steuerprofil, art: SteuerArt, teil: SteuerZeileEin): Steuerprofil {
  return { ...p, zeilen: { ...(p.zeilen ?? {}), [art]: { ...(p.zeilen?.[art] ?? {}), ...teil } } };
}

export type SteuerAenderung =
  | { art: 'rechtsform'; wert: Rechtsform }
  | { art: 'einzeln'; wert: boolean }
  | { art: 'an'; steuer: SteuerArt; wert: boolean }
  | { art: 'satz'; steuer: SteuerArt; wert: number }
  | { art: 'hebesatz'; wert: number };

/**
 * Operationen für eine Änderung am Steuerprofil. Ändert sich ein Bestandteil der aufgeschlüsselten Ertragsteuer,
 * schreibt dieselbe Änderung die Summe in `annahmen.steuerUG` (der Rechenkern liest nur sie). Einschalten der Aufschlüsselung
 * verteilt den heutigen Gesamtsatz und schreibt `steuerUG` NICHT — es ändert sich keine Zahl.
 */
export function steuerOps(d: Pick<FinanzDaten, 'steuern' | 'annahmen'>, ort: FinanzOrt, a: SteuerAenderung): Operation[] {
  const p = profilVon(d, ort);
  const ops: Operation[] = [];
  const gesamtOps = (neu: Steuerprofil): Operation[] => {
    const g = gesamtsatzAus(neu);
    return Math.abs(g - d.annahmen.steuerUG) > 1e-12 ? [{ pfad: '/annahmen/steuerUG', alt: d.annahmen.steuerUG, neu: g, feld: `Ertragsteuer-Gesamtsatz ${UG_KURZ}` }] : [];
  };
  switch (a.art) {
    case 'rechtsform':
      ops.push({ pfad: pfad(ort, '/rechtsform'), alt: p.rechtsform, neu: a.wert, feld: `Rechtsform ${finanzOrtName(ort)}` });
      // Wechsel zu Einzelunternehmen: die Aufschlüsselung entfällt, der Gesamtsatz bleibt stehen.
      if (a.wert === 'einzel' && p.einzeln) ops.push({ pfad: pfad(ort, '/einzeln'), alt: true, neu: false, feld: 'Ertragsteuer als Gesamtsatz' });
      return ops;
    case 'einzeln': {
      if (!a.wert) return [{ pfad: pfad(ort, '/einzeln'), alt: true, neu: false, feld: 'Ertragsteuer als Gesamtsatz' }];
      const t = aufteilen(d.annahmen.steuerUG);
      return [{ pfad: pfad(ort, ''), alt: d.steuern?.[ort], neu: { ...p, einzeln: true, zeilen: { ...(p.zeilen ?? {}), ...t.zeilen } }, feld: 'Ertragsteuer nach Steuerarten' }];
    }
    case 'an': {
      ops.push({ pfad: pfad(ort, `/zeilen/${a.steuer}/an`), alt: p.zeilen?.[a.steuer]?.an, neu: a.wert, feld: `${STEUER_ARTEN[a.steuer].label} ${a.wert ? 'gilt' : 'gilt nicht'}` });
      if (p.einzeln && (a.steuer === 'kst' || a.steuer === 'soli' || a.steuer === 'gewst')) ops.push(...gesamtOps(profilMit(p, a.steuer, { an: a.wert })));
      // Pauschale Sätze (Ertragsteuer der Einzel-Rechtsform, Steuer auf den Ausstieg): aus = Satz 0, der bisherige Satz bleibt im Profil gemerkt.
      const kernFeld = a.steuer === 'est' && ort === 'ug' ? 'steuerUG' : a.steuer === 'exit' ? 'exitSteuer' : null;
      if (kernFeld) {
        const jetzt = d.annahmen[kernFeld];
        if (!a.wert) {
          if (jetzt > 0) ops.push({ pfad: pfad(ort, `/zeilen/${a.steuer}/satz`), alt: p.zeilen?.[a.steuer]?.satz, neu: jetzt }, { pfad: `/annahmen/${kernFeld}`, alt: jetzt, neu: 0 });
        } else {
          const gemerkt = p.zeilen?.[a.steuer]?.satz;
          if (gemerkt !== undefined && jetzt === 0) ops.push({ pfad: `/annahmen/${kernFeld}`, alt: jetzt, neu: gemerkt });
        }
      }
      return ops;
    }
    case 'satz': {
      ops.push({ pfad: pfad(ort, `/zeilen/${a.steuer}/satz`), alt: p.zeilen?.[a.steuer]?.satz, neu: a.wert, feld: `${STEUER_ARTEN[a.steuer].label} Satz` });
      if ((a.steuer === 'est' && ort === 'ug') || a.steuer === 'exit') ops.push({ pfad: `/annahmen/${a.steuer === 'exit' ? 'exitSteuer' : 'steuerUG'}`, alt: a.steuer === 'exit' ? d.annahmen.exitSteuer : d.annahmen.steuerUG, neu: a.wert });
      if (p.einzeln && (a.steuer === 'kst' || a.steuer === 'soli' || a.steuer === 'gewst')) ops.push(...gesamtOps(profilMit(p, a.steuer, { satz: a.wert })));
      return ops;
    }
    case 'hebesatz':
      ops.push({ pfad: pfad(ort, '/zeilen/gewst/hebesatz'), alt: p.zeilen?.gewst?.hebesatz, neu: a.wert, feld: 'Gewerbesteuer Hebesatz' });
      if (p.einzeln) ops.push(...gesamtOps(profilMit(p, 'gewst', { hebesatz: a.wert })));
      return ops;
  }
}

// ── Prüfen (Säuberer) ───────────────────────────────────────────────────────
const ARTEN = Object.keys(STEUER_ARTEN) as SteuerArt[];
const ORTE: FinanzOrt[] = ['privat', 'kdc', 'kdv', 'ug'];
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** `steuern` aus rohen Daten bereinigen — unbekannte Schlüssel fallen weg, Sätze werden begrenzt; leer → undefined. */
export function pruefeSteuern(roh: unknown): Steuern | undefined {
  if (!istObjekt(roh)) return undefined;
  const out: Steuern = {};
  for (const ort of ORTE) {
    const r = roh[ort]; if (!istObjekt(r)) continue;
    const p: Steuerprofil = {};
    if (r.rechtsform === 'kapital' || r.rechtsform === 'einzel') p.rechtsform = r.rechtsform;
    if (typeof r.einzeln === 'boolean') p.einzeln = r.einzeln;
    if (istObjekt(r.zeilen)) {
      const zeilen: NonNullable<Steuerprofil['zeilen']> = {};
      for (const art of ARTEN) {
        const z = r.zeilen[art]; if (!istObjekt(z)) continue;
        const e: SteuerZeileEin = {};
        if (typeof z.an === 'boolean') e.an = z.an;
        const s = num(z.satz); if (s !== undefined) e.satz = Math.max(0, Math.min(1, s));
        const h = num(z.hebesatz); if (h !== undefined) e.hebesatz = Math.max(0, Math.min(2000, h));
        if (Object.keys(e).length) zeilen[art] = e;
      }
      if (Object.keys(zeilen).length) p.zeilen = zeilen;
    }
    if (Object.keys(p).length) out[ort] = p;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Hilfsfunktion für Tests und Anzeige: Annahmen-Satz, den der Kern tatsächlich liest. */
export const kernSteuerSatz = (a: Pick<Annahmen, 'steuerUG'>): number => a.steuerUG;
