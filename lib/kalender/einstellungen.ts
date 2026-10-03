// ─── Kalender-Einstellungen (eine Wahrheit) ─────────────────────────────────
// Welcher Apple-Kalender gehört wem, wie lange dauern die Arten, wann ist
// Arbeitszeit. Vorher nur in der Route — jetzt brauchen sie auch der
// iCloud-Kalender (wohin schreibt „Kevin“/„Malin“/„gemeinsam“?) und die
// Planer-Ansichten.

import { loadJson } from '@/lib/store/local-db';
import { freieTageSauber, FREIE_TAGE_STANDARD, type FreierTag } from './freie-tage';
import { zuordnung } from './belegt';

export type Wer = 'kevin' | 'malin' | 'beide';
export interface KalenderEinstellungen {
  /** Welcher Apple-Kalender gehört wem. Namen wie in der Kalender-App. */
  kalender: Record<Wer, string>;
  /** Standarddauer je Art in Minuten. */
  dauer: { termin: number; fokus: number; routine: number; aufgabe: number; reha: number };
  /** Arbeitsfenster — außerhalb schlägt das System nichts vor. */
  vonStunde: number;
  bisStunde: number;
  /** Welche Sicht beim Öffnen steht. */
  standardSicht: 'alle' | Wer;
  /** Welcher Kalender zu welchem Space gehört (26.09.): Name → privat|business. Ohne Eintrag: KEMARIS/Arbeit = Business, sonst Privat. */
  space: Record<string, 'privat' | 'business'>;
  /**
   * „Zählt als belegt“ je Kalender (R-K2 #69, 29.09.): Name → an/aus. Ohne Eintrag zählen die ZUGEORDNETEN Kalender
   * (Kevin, Malin, Gemeinsam — auch über den Namen erkannt), ein nicht zugeordneter Kalender blockiert niemanden.
   * Wirkt auf die Verfügbarkeit (freie Zeit, Buchungsseite) — angezeigt wird jeder Kalender weiter.
   */
  belegt: Record<string, boolean>;
  /** „Frei, aber nicht gesetzlich“ (R-K2 #72): „MM-TT“ + Name, Standard 24.12. und 31.12. — lib/kalender/freie-tage.ts. */
  freieTage: FreierTag[];
  /**
   * Steuertermine als Fristen-Vorlage im Kalender (K6a, Zusatzthema #11) — Standard AUS. Nur der Schalter: WELCHE Termine
   * (USt-Rhythmus, Vorauszahlungen, Erklärungen) stellt ihr im Steuer-Modul ein (lib/steuern — eine Quelle, Werktag nach
   * § 108 AO); der Kalender zeigt sie nur, nie Beträge. Hinweis, keine Steuerberatung.
   */
  steuerVorlage: SteuerVorlage;
  /** Glocke: Kündigungsfristen so viele Tage vorher melden (K6a). */
  kuendigungVorlaufTage: number;
  /**
   * Google (03.10.): Kalendername → Person, für die verbundenen Google-Kalender („MAKE Kevin (Google)“ → kevin). NIE gespeichert —
   * `ladeEinstellungen` und der GET der Einstellungen-Route legen es beim Lesen dazu (lib/kalender/google/namen.ts); `einstellungenSauber`
   * lässt es fallen. Wirkt auf die Zuordnung (`zuordnung`) und den Space (Business).
   */
  google?: Record<string, string>;
}

export interface SteuerVorlage { an: boolean }
export const STEUER_VORLAGE_AUS: SteuerVorlage = { an: false };

export const EINSTELLUNGEN_LEER: KalenderEinstellungen = {
  kalender: { kevin: 'Privat Kevin', malin: 'Privat Malin', beide: 'Gemeinsam' },
  dauer: { termin: 60, fokus: 90, routine: 30, aufgabe: 45, reha: 30 },
  vonStunde: 7,
  bisStunde: 20,
  standardSicht: 'alle',
  space: {},
  belegt: {},
  freieTage: [...FREIE_TAGE_STANDARD],
  steuerVorlage: STEUER_VORLAGE_AUS,
  kuendigungVorlaufTage: 14,
};

/** Steuer-Vorlage säubern — alles Unbekannte fällt auf „aus“ zurück (nie still eingeschaltet). */
export function steuerVorlageSauber(v: unknown): SteuerVorlage {
  return { an: !!v && typeof v === 'object' && (v as { an?: unknown }).an === true };
}

const zahl = (v: unknown, min: number, max: number, sonst: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst;
};
const text = (v: unknown, sonst: string) => String(v ?? '').trim().slice(0, 60) || sonst;

/**
 * Teil-Änderung (F1 #8, PUT { teil }) auf den aktuellen Stand legen — rein: oberste Ebene ersetzt, einfache Objekte
 * (kalender, dauer, space, belegt, steuerVorlage) je Schlüssel gemischt. Das Ergebnis geht danach durch `einstellungenSauber`.
 */
export function einstellungenTeilMischen(aktuell: KalenderEinstellungen, teil: Record<string, unknown>): Partial<KalenderEinstellungen> {
  const objekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const raus: Record<string, unknown> = { ...aktuell };
  for (const [k, v] of Object.entries(teil)) {
    const alt = (aktuell as unknown as Record<string, unknown>)[k];
    raus[k] = objekt(alt) && objekt(v) ? { ...alt, ...v } : v;
  }
  return raus as Partial<KalenderEinstellungen>;
}

export function einstellungenSauber(d: Partial<KalenderEinstellungen> | null): KalenderEinstellungen {
  const L = EINSTELLUNGEN_LEER;
  const sicht = ['alle', 'kevin', 'malin', 'beide'].includes(String(d?.standardSicht)) ? d!.standardSicht! : L.standardSicht;
  return {
    kalender: { kevin: text(d?.kalender?.kevin, L.kalender.kevin), malin: text(d?.kalender?.malin, L.kalender.malin), beide: text(d?.kalender?.beide, L.kalender.beide) },
    dauer: {
      termin: zahl(d?.dauer?.termin, 5, 600, L.dauer.termin), fokus: zahl(d?.dauer?.fokus, 5, 600, L.dauer.fokus),
      routine: zahl(d?.dauer?.routine, 5, 600, L.dauer.routine), aufgabe: zahl(d?.dauer?.aufgabe, 5, 600, L.dauer.aufgabe), reha: zahl(d?.dauer?.reha, 5, 600, L.dauer.reha),
    },
    vonStunde: zahl(d?.vonStunde, 0, 23, L.vonStunde),
    bisStunde: zahl(d?.bisStunde, 1, 24, L.bisStunde),
    standardSicht: sicht,
    space: Object.fromEntries(Object.entries((d?.space && typeof d.space === 'object' ? d.space : {}) as Record<string, unknown>).slice(0, 40).map(([k, v]) => [String(k).trim().slice(0, 60), v]).filter(([k, v]) => k && (v === 'privat' || v === 'business'))) as Record<string, 'privat' | 'business'>,
    belegt: Object.fromEntries(Object.entries((d?.belegt && typeof d.belegt === 'object' ? d.belegt : {}) as Record<string, unknown>).slice(0, 60).map(([k, v]) => [String(k).trim().slice(0, 60), v]).filter(([k, v]) => k && typeof v === 'boolean')) as Record<string, boolean>,
    freieTage: freieTageSauber(d?.freieTage),
    steuerVorlage: steuerVorlageSauber(d?.steuerVorlage),
    kuendigungVorlaufTage: zahl(d?.kuendigungVorlaufTage, 0, 90, L.kuendigungVorlaufTage),
  };
}

export { spaceVonKalender } from './space';

export async function ladeEinstellungen(): Promise<KalenderEinstellungen> {
  return mitGoogleNamen(einstellungenSauber(await loadJson<KalenderEinstellungen>('kalender-einstellungen')));
}

/** Die Google-Kalender (Name → Person) zur Laufzeit dazulegen — gespeichert wird das nie. */
export async function mitGoogleNamen(e: KalenderEinstellungen): Promise<KalenderEinstellungen> {
  const { googleNamenZuPerson } = await import('./google/namen');
  const g = await googleNamenZuPerson();
  return Object.keys(g).length ? { ...e, google: g } : e;
}

/**
 * Wem gehört ein Kalender (nach Name)? Zuerst die Einstellungen, dann der
 * Name selbst („Kevin Dieckmann“ ist Kevins Arbeitskalender) — sonst gemeinsam.
 */
export function wemGehoert(e: KalenderEinstellungen, kalenderName: string): Wer {
  return zuordnung(e, kalenderName) ?? 'beide';
}

// „Zählt als belegt“ (R-K2 #69) rechnet client-sicher in lib/kalender/belegt.ts.
export { zuordnung, zaehltAlsBelegt, werFuerBelegung } from './belegt';
