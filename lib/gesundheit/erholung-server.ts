// ─── Erholung je Person — Server (10.10.) ────────────────────────────────────────────────────────────────────────────────────────
// Lesen und Schreiben des Bestands `erholung--<person>` (immer mit Suffix) und die Sicht für den Reiter „Erholung“ unter Gesundheit.
// Wer welche Person anfragen darf, entscheidet allein die Route (/api/gesundheit/erholung): schreiben nur die Person selbst, lesen
// eine andere Person nur bei geteilter Gesundheit — hier gibt es keinen Personen-Parameter von außen.
// Stand = Fingerabdruck des gespeicherten Bestands; ein veralteter Stand → 409 mit dem aktuellen Bestand (zwei Geräte).
//
// Die Sicht sammelt die Quellen der Erholung eines Tages (lib/gesundheit/erholung-lage.ts):
//   · Einheiten aus dem eigenen Bestand
//   · erledigte Aufgaben mit Marke „Erholung“ (nur Privat, verantwortlich die Person, nur was der BETRACHTER sehen darf — `ladeAufgabenSicht`)
//   · erledigte Routinen der Kategorie „Erholung“ (eigene und gemeinsame, im Umfang des Betrachters)
//   · bewusst gemessene Erholungs-Zeit (Fokus-Zähler, Schlüssel `privat:erholung`)
//   · geplante Erholungs-Blöcke im Kalender (Unterart erholung bzw. Altbestand reha)
// Dazu der Vorschlag aus den eigenen Körperwerten und — mit eingeschaltetem Symptom-Tagebuch — der Verlauf samt Zusammenhang.
// Jede Quelle in `sicher()`: eine kaputte Quelle lässt die Sicht stehen (nur ohne diese Zahl).

import { createHash } from 'crypto';
import { loadJson, updateJson } from '@/lib/store/local-db';
import { speicherFuer } from '@/lib/zoe/raum';
import { tagVon } from '@/lib/zeit';
import { tagPlus } from '@/lib/zeit/kalender-kern';
import { erholungAnwenden, erholungSaeubern, erholungName, ErholungFehler, type ErholungStand } from './erholung';
import {
  erholteTage, erholungStreak, erholungVorschlag, erholungZusammenhang, heuteFaellig, tagesErholung, wochenFortschritt, zielFortschritt, behandlungLage, wocheVon,
  type ErholungQuellen, type ErholungVorschlag, type FaelligEintrag, type ProgrammWoche, type TagesErholung, type ZielFortschritt, type BehandlungLage, type Zusammenhang,
} from './erholung-lage';

const sicher = async <T,>(f: () => Promise<T>, ersatz: T): Promise<T> => { try { return await f(); } catch { return ersatz; } };

/** Stand des Bestands (Fingerabdruck); ohne Bestand `leer`. */
export function erholungFingerabdruck(s: ErholungStand | null): string {
  return s ? createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 20) : 'leer';
}

/** Der Bestand der Person — oder null, wenn sie noch nichts eingetragen hat. Liest nur, schreibt nie. */
export async function erholungLaden(person: string): Promise<{ erholung: ErholungStand | null; stand: string }> {
  const erholung = erholungSaeubern(await loadJson<unknown>(erholungName(person)));
  return { erholung, stand: erholungFingerabdruck(erholung) };
}

export type ErholungAenderung =
  | { ok: true; erholung: ErholungStand; stand: string }
  | { ok: false; status: 400 | 404 | 409 | 413; fehler: string; erholung?: ErholungStand | null; stand?: string };

class StandVeraltet extends Error { constructor(readonly erholung: ErholungStand | null, readonly stand: string) { super('Stand veraltet'); } }

/** Schritte auf den eigenen Bestand anwenden — in EINER Sperre, nur wenn `basisStand` passt. Wirft ein Schritt, wird nichts geschrieben. */
export async function erholungAendern(person: string, basisStand: unknown, ops: unknown, jetzt = new Date().toISOString()): Promise<ErholungAenderung> {
  try {
    const roh = await updateJson<unknown>(erholungName(person), cur => {
      const alt = erholungSaeubern(cur);
      const stand = erholungFingerabdruck(alt);
      if (basisStand !== stand) throw new StandVeraltet(alt, stand);
      return { ...erholungAnwenden(alt, ops, jetzt), geaendert: jetzt };
    });
    const erholung = erholungSaeubern(roh)!;
    return { ok: true, erholung, stand: erholungFingerabdruck(erholung) };
  } catch (e) {
    if (e instanceof StandVeraltet) return { ok: false, status: 409, fehler: 'Die Erholung wurde inzwischen geändert (anderes Gerät?) — neu geladen, bitte noch einmal.', erholung: e.erholung, stand: e.stand };
    if (e instanceof ErholungFehler) return { ok: false, status: e.status, fehler: e.message };
    throw e;
  }
}

// ── Quellen ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Erledigte Aufgaben mit Marke „Erholung“ je Tag — nur Privat, verantwortlich `person`, nur was `betrachter` sehen darf. */
async function aufgabenJeTag(person: string, betrachter: string, ab: string): Promise<Record<string, number>> {
  const [{ ladeAufgabenSicht }, { spaceVonAufgabe }] = await Promise.all([import('@/lib/aufgaben/sicht'), import('@/lib/make-one/space-regeln')]);
  const { tasks } = await ladeAufgabenSicht(betrachter);
  const aus: Record<string, number> = {};
  for (const t of tasks) {
    if (t.erholung !== true || t.status !== 'done' || !t.completedAt || t.assignee !== person) continue;
    if (spaceVonAufgabe(t) !== 'privat') continue;
    const tag = tagVon(t.completedAt);
    if (tag < ab) continue;
    aus[tag] = (aus[tag] ?? 0) + 1;
  }
  return aus;
}

/** Erledigte Routinen der Kategorie „Erholung“ je Tag (Häkchen im eigenen Routinen-Protokoll der Person). */
async function routinenJeTag(person: string, betrachter: string, ab: string): Promise<{ jeTag: Record<string, number>; ids: string[] }> {
  const [{ routinenSichtbarFuer, routinenImUmfang }] = await Promise.all([import('@/lib/planung/bereich-sicht-server')]);
  const f = await loadJson<{ routinen?: { id: string; label: string; aktiv: boolean; kategorie?: string; owner?: string; space?: string; einheit?: string }[] }>('routinen');
  const eigene = await routinenImUmfang(await routinenSichtbarFuer((f?.routinen ?? []).filter(r => r.kategorie === 'erholung'), person), betrachter);
  const ids = new Set(eigene.map(r => r.id));
  const log = (await loadJson<Record<string, string[]>>(speicherFuer('health-log', person))) ?? {};
  const jeTag: Record<string, number> = {};
  for (const [tag, liste] of Object.entries(log)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || tag < ab || !Array.isArray(liste)) continue;
    const n = liste.filter(id => ids.has(id)).length;
    if (n) jeTag[tag] = n;
  }
  return { jeTag, ids: [...ids] };
}

/** Bewusst gemessene Erholungs-Zeit je Tag (Sekunden) — Fokus-Zähler mit Bereich „Erholung“. */
async function zeitJeTag(person: string, ab: string): Promise<Record<string, number>> {
  const { ladeZeit } = await import('@/lib/zeitmessung/speicher');
  const { ERHOLUNG_ZEIT_SCHLUESSEL } = await import('@/lib/zeitmessung/erholung');
  const d = await ladeZeit(person);
  const aus: Record<string, number> = {};
  for (const [tag, t] of Object.entries(d.tage ?? {})) {
    if (tag < ab) continue;
    const sek = t?.bewusst?.[ERHOLUNG_ZEIT_SCHLUESSEL] ?? 0;
    if (sek > 0) aus[tag] = sek;
  }
  return aus;
}

/** Geplante Erholungs-Blöcke der Person (Minuten je Tag) in [von, bis). */
async function geplantJeTag(person: string, von: string, bis: string): Promise<Record<string, number>> {
  const [{ planBloeckeLesen }, { istErholungsArt }] = await Promise.all([import('@/lib/planung/bloecke-server'), import('@/lib/kalender/arten')]);
  const bloecke = await planBloeckeLesen({ person, von, bis, archiv: false });
  const aus: Record<string, number> = {};
  for (const b of bloecke) if (istErholungsArt(b.art)) aus[b.date] = (aus[b.date] ?? 0) + b.dauerMin;
  return aus;
}

/** Werte für den Vorschlag: Recovery heute, Strain/Recovery gestern, HRV-/Ruhepuls-Trend, Schlafschuld — alles eigene Werte. */
async function vorschlagEingabe(person: string, heute: string): Promise<Parameters<typeof erholungVorschlag>[0]> {
  const log = (await loadJson<Record<string, { rec?: number; hrv?: number; rhr?: number; strain?: number } | undefined>>(speicherFuer('vitals', person))) ?? {};
  const zahl = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);
  const gestern = tagPlus(heute, -1);
  const [{ entlastungPruefen }, { saeubere }] = await Promise.all([import('@/lib/sport/entlastung'), import('@/lib/sport/modell')]);
  const sport = saeubere(await loadJson<unknown>(speicherFuer('sport', person)));
  const vit = Object.fromEntries(Object.entries(log).map(([d, v]) => [d, { hrv: v?.hrv, ruhepuls: v?.rhr }]));
  const en = entlastungPruefen(vit, heute, sport.einstellungen?.entlastung);
  const schuld = await sicher(async () => {
    const [{ alltagLaden, schlafLageFuer }] = await Promise.all([import('./alltag-server')]);
    const { alltag } = await alltagLaden(person);
    return (await schlafLageFuer(person, alltag, heute, log as never)).schuld?.stunden;
  }, undefined);
  return {
    rec: zahl(log[heute]?.rec), strainGestern: zahl(log[gestern]?.strain), recGestern: zahl(log[gestern]?.rec),
    entlastung: en ? { vorschlag: en.vorschlag, text: en.text } : null,
    ...(typeof schuld === 'number' ? { schlafSchuldH: schuld } : {}),
  };
}

// ── Die Sicht für den Reiter ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ErholungSicht {
  heute: string;
  faellig: FaelligEintrag[];
  woche: ProgrammWoche[];
  tag: TagesErholung;
  /** Die sieben Tage dieser Woche (Mo–So). */
  wocheTage: TagesErholung[];
  streak: { tage: number; heuteDabei: boolean };
  ziele: ZielFortschritt[];
  behandlungen: BehandlungLage[];
  /** null = ausgeschaltet oder keine Werte. */
  vorschlag: ErholungVorschlag | null;
  /** Symptom-Tagebuch (Modul an): Name (eigene Ansicht: eigener, sonst allgemein), 30 Tage, Auslöser, Zusammenhang. */
  beschwerde: { name: string; tage: { tag: string; wert: number | null }[]; ausloeser: { was: string; mal: number }[]; zusammenhang: Zusammenhang | null } | null;
  /** Kennungen der Erholungs-Routinen (Kategorie „Erholung“), die die Person sieht. */
  routinen: string[];
}

/**
 * Die Sicht auf die Erholung von `person` für `betrachter` (die Person selbst oder jemand, mit dem sie ihre Gesundheit teilt — das hat
 * die Route geprüft). `eigene` = Betrachter ist die Person: dann mit dem eigenen Namen des Symptom-Reglers.
 */
export async function erholungSicht(person: string, betrachter: string, s: ErholungStand, heute: string): Promise<ErholungSicht> {
  const ab = tagPlus(heute, -90);
  const woche = wocheVon(heute);
  const [aufgaben, routinen, zeit, geplant, eingabe, modulStand] = await Promise.all([
    sicher(() => aufgabenJeTag(person, betrachter, ab), {} as Record<string, number>),
    sicher(() => routinenJeTag(person, betrachter, ab), { jeTag: {}, ids: [] as string[] }),
    sicher(() => zeitJeTag(person, ab), {} as Record<string, number>),
    sicher(() => geplantJeTag(person, woche[0], tagPlus(woche[6], 1)), {} as Record<string, number>),
    s.einstellungen.vorschlag === false ? Promise.resolve(null) : sicher(() => vorschlagEingabe(person, heute), null),
    sicher(async () => (await import('./module-server')).moduleUndKoerper(person), null),
  ]);
  const q: ErholungQuellen = { aufgabenJeTag: aufgaben, routinenJeTag: routinen.jeTag, zeitJeTag: zeit, geplantJeTag: geplant };
  const tage = erholteTage(s, q, heute, 90);
  let beschwerde: ErholungSicht['beschwerde'] = null;
  if (modulStand?.module.haut) {
    const { hautTrend } = await import('./eintraege');
    const { symptomAnzeige, MODUL_INFO } = await import('./module');
    const log = (await sicher(() => loadJson<Record<string, { juckreiz?: number; schub?: boolean; ausloeser?: string } | undefined>>(speicherFuer('haut', person)), null)) ?? {};
    const name = (person === betrachter ? symptomAnzeige(modulStand.koerper, true) : null) ?? MODUL_INFO.haut.name;
    const t30 = Array.from({ length: 30 }, (_, i) => tagPlus(heute, i - 29));
    beschwerde = {
      name,
      tage: t30.map(t => ({ tag: t, wert: typeof log[t]?.juckreiz === 'number' ? log[t]!.juckreiz! : null })),
      ausloeser: hautTrend(log as never, heute).ausloeser,
      zusammenhang: erholungZusammenhang(tage, log, heute, 60, name),
    };
  }
  return {
    heute,
    faellig: heuteFaellig(s, heute),
    woche: wochenFortschritt(s, heute),
    tag: tagesErholung(s, q, heute),
    wocheTage: woche.map(t => tagesErholung(s, q, t)),
    streak: erholungStreak(tage, heute),
    ziele: s.ziele.map(z => zielFortschritt(z, s, q, heute)),
    behandlungen: s.behandlungen.filter(b => b.status !== 'abgeschlossen').map(b => behandlungLage(b, heute)),
    vorschlag: eingabe ? erholungVorschlag(eingabe) : null,
    beschwerde,
    routinen: routinen.ids,
  };
}

/** Kurz für Heute-Widget und ZOE: fällig, Tag, Streak, Vorschlag — ohne Verlauf und Beschwerde. */
export async function erholungKurz(person: string, heute: string): Promise<{ s: ErholungStand; sicht: Pick<ErholungSicht, 'faellig' | 'tag' | 'streak' | 'ziele' | 'vorschlag'> } | null> {
  const { erholung } = await erholungLaden(person);
  if (!erholung) return null;
  const v = erholung.einstellungen.vorschlag === false ? null : await sicher(() => vorschlagEingabe(person, heute), null);
  return { s: erholung, sicht: { faellig: heuteFaellig(erholung, heute), tag: tagesErholung(erholung, {}, heute), streak: erholungStreak(erholteTage(erholung, {}, heute, 90), heute), ziele: erholung.ziele.map(z => zielFortschritt(z, erholung, {}, heute)), vorschlag: v ? erholungVorschlag(v) : null } };
}
