// ─── Kalender-Einstellungen (eine Wahrheit) ─────────────────────────────────
// Welcher Apple-Kalender gehört wem, wie lange dauern die Arten, wann ist
// Arbeitszeit. Vorher nur in der Route — jetzt brauchen sie auch der
// iCloud-Kalender (wohin schreibt „Kevin“/„Malin“/„gemeinsam“?) und die
// Planer-Ansichten.

import { loadJson } from '@/lib/store/local-db';
import { freieTageSauber, FREIE_TAGE_STANDARD, type FreierTag } from './freie-tage';
import { zuordnung } from './belegt';
import { FACH_ERSATZ, fachPersonen, vorname } from '@/lib/make-one/fach-namen';

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
  /**
   * iCloud je Person (06.10.): Kalendername → Person für die Kalender aus den eigenen iCloud-Verbindungen (lib/kalender/icloud-person.ts),
   * dazu der neutrale Name „iCloud · <Vorname>“. NIE gespeichert — wie `google` beim Lesen dazugelegt; die Kalender-Route gibt jeder
   * Person nur ihre eigenen Namen heraus (die anderen verrieten Kalendernamen).
   */
  persoenlich?: Record<string, string>;
  /** Vornamen hinter den Fächern (14.10., aus den Konten) — NIE gespeichert, wie `google` beim Lesen dazugelegt (lib/kalender/belegt.ts). */
  vornamen?: Partial<Record<Exclude<Wer, 'beide'>, string>>;
}

export interface SteuerVorlage { an: boolean }
export const STEUER_VORLAGE_AUS: SteuerVorlage = { an: false };

/**
 * Vorgabe der Kalendernamen (14.10., Kevins Entscheidung „feste Vorgaben aus den Konten ableiten“): „Privat <Vorname>“ je Personen-Fach
 * (Fächer `kevin`/`malin` = Kennungen aus dem Altbestand, lib/make-one/fach-namen.ts) und „Gemeinsam“ — der Vorname kommt aus den Konten
 * (`kalenderNamenVorgabe` auf dem Server), ohne Konten ein Platzhalter. Nur die VORGABE: ein gespeicherter Name gewinnt immer und geht nie
 * verloren. Für Kevins Instanz ergibt das dieselben Namen wie bisher. Rein.
 */
export function kalenderNamen(vornamen: Partial<Record<Exclude<Wer, 'beide'>, string>> = {}): Record<Wer, string> {
  return { kevin: `Privat ${vornamen.kevin || FACH_ERSATZ.kevin}`, malin: `Privat ${vornamen.malin || FACH_ERSATZ.malin}`, beide: 'Gemeinsam' };
}

export const EINSTELLUNGEN_LEER: KalenderEinstellungen = {
  kalender: kalenderNamen(),
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

/** `vorgabe`: die Kalendernamen, die gelten, wo nichts gespeichert ist (Server: `kalenderNamenVorgabe()` aus den Konten). */
export function einstellungenSauber(d: Partial<KalenderEinstellungen> | null, vorgabe: Record<Wer, string> = EINSTELLUNGEN_LEER.kalender): KalenderEinstellungen {
  const L = EINSTELLUNGEN_LEER;
  const sicht = ['alle', 'kevin', 'malin', 'beide'].includes(String(d?.standardSicht)) ? d!.standardSicht! : L.standardSicht;
  return {
    kalender: { kevin: text(d?.kalender?.kevin, vorgabe.kevin), malin: text(d?.kalender?.malin, vorgabe.malin), beide: text(d?.kalender?.beide, vorgabe.beide) },
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
  return mitGoogleNamen(einstellungenSauber(await loadJson<KalenderEinstellungen>('kalender-einstellungen'), await kalenderNamenVorgabe()));
}

/**
 * Die Vorgabe der Kalendernamen aus den Konten (14.10.): Personen im Haushalt der Inhaberin/des Inhabers, Inhaber zuerst — wer hinter
 * welchem Fach steht, sagt `fachPersonen` (gleicher Speichername gewinnt). Konten nicht lesbar → Platzhalter (nie ein fester Name).
 */
export async function kalenderNamenVorgabe(): Promise<Record<Wer, string>> {
  try {
    return kalenderNamen(vornamenAus(await fachKonten()));
  } catch { return EINSTELLUNGEN_LEER.kalender; }
}

/**
 * Wer steht hinter den Fächern — mit VOLLEM Namen aus dem Konto (14.10.): Personen im Haushalt der Inhaberin/des Inhabers, Inhaber zuerst,
 * `fachPersonen` (gleicher Speichername gewinnt). Wirft, wenn die Konten nicht lesbar sind (Aufrufer entscheiden über den Rückfall).
 */
export async function fachKonten(): Promise<Partial<Record<Exclude<Wer, 'beide'>, { id: string; name: string }>>> {
  const { ladeKonten } = await import('@/lib/zugang/konten');
  const konten = (await ladeKonten()).konten;
  const inhaber = konten.find(k => k.rolle === 'inhaber');
  const haus = konten
    .filter(k => k === inhaber || (k.finanzRecht !== 'business' && (inhaber?.haushalt ? k.haushalt === inhaber.haushalt : !k.haushalt)))
    .sort((a, b) => Number(b === inhaber) - Number(a === inhaber) || String(a.angelegt ?? '').localeCompare(String(b.angelegt ?? '')));
  return fachPersonen(haus.map(k => ({ id: k.speicher, name: String(k.name ?? '').trim() })));
}

/** Nur die Vornamen der Fach-Personen (leere fallen weg). Rein. */
export function vornamenAus(p: Partial<Record<Exclude<Wer, 'beide'>, { name: string }>>): Partial<Record<Exclude<Wer, 'beide'>, string>> {
  const eins = vorname(p.kevin?.name), zwei = vorname(p.malin?.name);
  return { ...(eins ? { kevin: eins } : {}), ...(zwei ? { malin: zwei } : {}) };
}

/** Die Vornamen hinter den Fächern aus den Konten — Konten nicht lesbar: keine (dann erkennt `zuordnung` nichts am Namen). */
export async function fachVornamen(): Promise<Partial<Record<Exclude<Wer, 'beide'>, string>>> {
  try { return vornamenAus(await fachKonten()); } catch { return {}; }
}

/**
 * Die Google-Kalender und die Kalender je Person aus iCloud (Name → Person) zur Laufzeit dazulegen — gespeichert wird das nie. Seit 14.10.
 * auch die Vornamen hinter den Fächern (`vornamen`, aus den Konten): `zuordnung` erkennt einen Kalender daran (vorher fest im Code).
 */
export async function mitGoogleNamen(e: KalenderEinstellungen): Promise<KalenderEinstellungen> {
  const { googleNamenZuPerson } = await import('./google/namen');
  const g = await googleNamenZuPerson();
  const p = await import('./icloud-person').then(m => m.persoenlicheNamen()).catch(() => ({} as Record<string, string>));
  const v = await fachVornamen();
  return { ...e, ...(Object.keys(g).length ? { google: g } : {}), ...(Object.keys(p).length ? { persoenlich: p } : {}), ...(Object.keys(v).length ? { vornamen: v } : {}) };
}

/** Vorsatz des neutralen Namens, unter dem andere Personen die Kalender je Person sehen („iCloud · <Vorname>“). */
export const NEUTRAL_VORSATZ = 'iCloud · ';

/**
 * Die Einstellungen, wie EINE Person sie bekommt (06.10., Plattform-Regel „Trennung serverseitig“): aus `persoenlich` nur
 * ihre eigenen Kalendernamen und die neutralen Namen der anderen — echte Kalendernamen anderer Personen nie. Rein.
 */
export function einstellungenFuerPerson(e: KalenderEinstellungen, person: string | null | undefined): KalenderEinstellungen {
  if (!e.persoenlich) return e;
  const p = Object.fromEntries(Object.entries(e.persoenlich).filter(([name, wer]) => wer === person || name.startsWith(NEUTRAL_VORSATZ)));
  const { persoenlich: _p, ...rest } = e;
  return Object.keys(p).length ? { ...rest, persoenlich: p } : rest;
}

/**
 * Datenschutz-Prüfung N6 (11.10.): mit `?space=` nur die Kalendernamen dieses Bereichs — die Namen der anderen Kalender (z. B. „Familie“,
 * private iCloud-Kalender) verraten Privates. Gekürzt werden alle Felder mit Kalendernamen (Zuordnung Wer → Name: fremde leer; Space,
 * „zählt als belegt“, Google, persönlich: nur Namen des Bereichs). Rein; `imBereich` = die Regel der Route (`spaceVonKalender`).
 */
export function einstellungenFuerBereich(e: KalenderEinstellungen, imBereich: (name: string) => boolean): KalenderEinstellungen {
  const nur = <T>(m: Record<string, T> | undefined) => (m ? Object.fromEntries(Object.entries(m).filter(([name]) => imBereich(name))) : m);
  const kalender = Object.fromEntries(Object.entries(e.kalender).map(([w, name]) => [w, name && imBereich(name) ? name : ''])) as Record<Wer, string>;
  return {
    ...e, kalender, space: nur(e.space) ?? {}, belegt: nur(e.belegt) ?? {},
    ...(e.google ? { google: nur(e.google) } : {}), ...(e.persoenlich ? { persoenlich: nur(e.persoenlich) } : {}),
  };
}

/**
 * Wem gehört ein Kalender (nach Name)? Zuerst die Einstellungen, dann der
 * Name selbst („Kevin Dieckmann“ ist Kevins Arbeitskalender) — sonst gemeinsam.
 */
export function wemGehoert(e: KalenderEinstellungen, kalenderName: string): Wer {
  return zuordnung(e, kalenderName) ?? 'beide';
}

// „Zählt als belegt“ (R-K2 #69) rechnet client-sicher in lib/kalender/belegt.ts.
export { zuordnung, zaehltAlsBelegt, werFuerBelegung, werFuerTermin } from './belegt';
