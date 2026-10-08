// ─── Mac-Zulieferer abschalten — Server (08.10., Lücke 10 der Roadmap, Kevin R6) ──────────────────────────────────────────
// Kevin 08.10.: „alles nur auf dem Server führen; wir brauchen nachher im Mac nur noch die API zur Mail, den Rest haben wir ja in
// MAKE OS.“ Hier liegt alles, was der Server dafür tut:
//   · `zuliefererLage()` — an oder aus (EINE Regel: lib/zulieferer/schalter.ts), Altbestand, Übernahme. Gelesen von der Zulieferung
//     (410), dem Kalender (keine Apple-Erinnerungen mehr), den Apple-Routen (kein Spiegel-Leser), dem Head of IT, dem Verzeichnis
//     (Art. 30) und Art. 17 (eingefrorene Spiegel werden dann wirklich bereinigt).
//   · Übernahme der Apple-Erinnerungen als Aufgaben: Vorschau → Bestätigen. Zwei Bestände nacheinander (Aufgaben, dann der
//     Übernahme-Stand) → Absichtsprotokoll (Art `erinnerungen-uebernahme`, lib/store/absichten.ts), jeder Schritt idempotent.
//   · Schalter (Instanz-Einstellung des Inhabers in konten.json) und „Cache löschen“ (bestandEntfernen samt Tageskopien).
// Nur der Inhaber per Sitzung ruft das auf (app/api/zulieferer/route.ts); nichts hier liest Inhalte für andere Personen.

import { loadJson, updateJson, speicherStand, bestandEntfernen } from '@/lib/store/local-db';
import { SPEICHER, type Gemerkt } from '@/lib/mac';
import { ladeKonten, aendereKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { zuliefererUmgebung } from '@/lib/zugang/intern';
import { altSchluesselZuletzt } from '@/lib/zugang/zulieferer';
import { wandzeit } from '@/lib/kalender/zeit';
import { absichtAbschliessen, absichtBeginnen, fluechtigeAbsicht, mitVorgang, type Absicht } from '@/lib/store/absichten';
import { protokolliere, type Wer } from '@/lib/store/aenderungsprotokoll';
import { zuliefererWirksam, schalterAus, type ZuliefererSchalter, type ZuliefererWirkung } from './schalter';
import {
  erinnerungenLesen, schonUebernommen, vorschauBauen, zuUebernehmen, aufgabenBauen, NotizZuLang, WAHL_VORGABE,
  type Erinnerung, type UebernahmeWahl, type Vorschau,
} from './erinnerungen';

/** Stand der Übernahme — nur Zeitpunkte und Zahlen, keine Titel, keine Namen (Register: kein Personenbezug). */
export const ZULIEFERER_STAND = 'zulieferer-uebernahme';
export interface UebernahmeLauf { am: string; neu: number; schon: number; erledigte: boolean }
export interface UebernahmeStand {
  bestaetigtAm?: string;
  laeufe: UebernahmeLauf[];
  /** Wann der Inhaber den Spiegel vom Mac gelöscht hat. */
  cacheGeloescht?: { erinnerungen?: string; kontakte?: string };
}
const LEER: UebernahmeStand = { laeufe: [] };

export type SpiegelArt = 'erinnerungen' | 'kontakte';
export const SPIEGEL_ARTEN: readonly SpiegelArt[] = ['erinnerungen', 'kontakte'];

export interface ZuliefererLage extends ZuliefererWirkung {
  umgebung: ZuliefererSchalter | null;
  einstellung: ZuliefererSchalter | null;
  uebernahmeAm: string | null;
  /** Spiegel vom Mac vorhanden bzw. je ein Übergangs-Aufruf — die Instanz HAT einen Zulieferer gehabt. */
  altbestand: boolean;
  spiegel: Record<SpiegelArt, boolean>;
}

async function bestandDa(name: string): Promise<boolean> {
  try { return (await speicherStand([name])) !== '0'; } catch { return false; }
}

export async function ladeUebernahmeStand(): Promise<UebernahmeStand> {
  const s = await loadJson<UebernahmeStand>(ZULIEFERER_STAND);
  return s && typeof s === 'object' ? { ...s, laeufe: Array.isArray(s.laeufe) ? s.laeufe : [] } : { ...LEER };
}

/** An oder aus — und warum. Wirft nie (ein unlesbarer Bestand zählt als „nicht gesetzt“). */
export async function zuliefererLage(): Promise<ZuliefererLage> {
  const [konten, stand, erinnerungen, kontakte, alt] = await Promise.all([
    ladeKonten().catch(() => null),
    ladeUebernahmeStand().catch(() => ({ ...LEER })),
    bestandDa(SPEICHER.erinnerungen),
    bestandDa(SPEICHER.kontakte),
    altSchluesselZuletzt().catch(() => null),
  ]);
  const eingang = {
    umgebung: zuliefererUmgebung(),
    einstellung: schalterAus(konten?.einstellungen?.zulieferer),
    uebernahmeAm: stand.bestaetigtAm ?? null,
    altbestand: erinnerungen || kontakte || !!alt,
  };
  return { ...eingang, ...zuliefererWirksam(eingang), spiegel: { erinnerungen, kontakte } };
}

export async function zuliefererAktiv(): Promise<boolean> {
  return (await zuliefererLage()).aktiv;
}

// ── Erinnerungen: Spiegel lesen, Vorschau ────────────────────────────────────

export async function erinnerungenSpiegel(): Promise<{ liste: Erinnerung[]; at: string | null }> {
  const g = await loadJson<Gemerkt>(SPEICHER.erinnerungen);
  return { liste: erinnerungenLesen(g?.daten, wandzeit), at: g?.at ?? null };
}

/** Kennungen aller Aufgaben — auch Papierkorb und Archiv (eine dort liegende Übernahme gilt als „schon übernommen“). */
async function vorhandeneKennungen(): Promise<{ ids: Set<string>; spaces: { id: string; label: string; bereich: string }[] }> {
  const { ladeAufgaben, spacesFuer } = await import('@/lib/aufgaben/speicher');
  const state = await ladeAufgaben();
  const spaces = (await spacesFuer(state)).filter(s => !s.archiv).map(s => ({ id: s.id, label: s.label, bereich: s.bereich }));
  return { ids: new Set(state.tasks.map(t => t.id)), spaces };
}

export interface UebernahmeVorschau { vorschau: Vorschau; spaces: { id: string; label: string; bereich: string }[]; at: string | null }

export async function uebernahmeVorschau(): Promise<UebernahmeVorschau> {
  const [{ liste, at }, { ids, spaces }] = await Promise.all([erinnerungenSpiegel(), vorhandeneKennungen()]);
  return { vorschau: vorschauBauen(liste, ids), spaces, at };
}

/** Die Space-Kennungen, die eine Auswahl nennen darf (aktive Spaces). */
export async function erlaubteSpaces(): Promise<string[]> {
  return (await vorhandeneKennungen()).spaces.map(s => s.id);
}

// ── Übernahme: Aufgaben anlegen (Absichtsprotokoll) ──────────────────────────

export interface UebernahmeErgebnis { ok: boolean; status: 200 | 400 | 409 | 413; neu: number; schon: number; fehler?: string; fortgesetzt?: boolean }

/** Der Schreibweg der Aufgaben lehnte ab (400/413 …) — kein Grund, es im Takt erneut zu versuchen. */
class UebernahmeAbgelehnt extends Error { constructor(readonly status: 400 | 409 | 413, text: string) { super(text); } }

const SCHRITTE = ['aufgaben', 'abschluss'] as const;
const SCHLUESSEL = 'apple-erinnerungen';

/**
 * Bestätigen: legt die ausgewählten Erinnerungen als Aufgaben an (feste Kennungen — zweimal bestätigen legt nichts doppelt an)
 * und hält die Übernahme fest. `person` = der Inhaber (er wird verantwortlich und Anleger; „nur ich“ nur mit ihm).
 */
export async function erinnerungenUebernehmen(o: { person: string; wahl: UebernahmeWahl }): Promise<UebernahmeErgebnis> {
  const haushalt = await haushaltDesInhabers();
  const neu = { art: 'erinnerungen-uebernahme' as const, schluessel: SCHLUESSEL, schritte: SCHRITTE, daten: { wahl: o.wahl }, person: o.person };
  if (!haushalt) return lauf(null, fluechtigeAbsicht(neu));
  const b = await absichtBeginnen(haushalt, neu);
  const r = await lauf(haushalt, b.absicht);
  return b.neu ? r : { ...r, fortgesetzt: true };
}

/** Wiederaufnahme (lib/store/absichten-fortsetzen.ts): ab dem ersten nicht abgehakten Schritt — mit der gespeicherten Auswahl. */
export async function erinnerungenUebernahmeFortsetzen(h: string, a: Absicht): Promise<void> {
  const r = await lauf(h, a);
  if (!r.ok && r.status >= 500) throw new Error(r.fehler ?? 'Übernahme nicht fertig.');
}

async function lauf(h: string | null, absicht: Absicht): Promise<UebernahmeErgebnis> {
  const person = absicht.person;
  if (!person) { if (h) await absichtAbschliessen(h, absicht.id, 'verworfen'); return { ok: false, status: 400, neu: 0, schon: 0, fehler: 'Ohne Person keine Übernahme.' }; }
  const wer: Wer = { art: 'import', person };
  try {
    return await mitVorgang(h ?? 'ohne-haushalt', absicht, async v => {
      const wahl = v.daten<UebernahmeWahl>('wahl') ?? WAHL_VORGABE;
      await v.schritt('aufgaben', async () => {
        const { liste } = await erinnerungenSpiegel();
        const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
        const jetzt = new Date().toISOString();
        let neu = 0, schon = 0;
        const r = await systemAufgabenAendern(stand => {
          const vorhanden = new Set(stand.tasks.map(t => t.id));
          const auswahl = zuUebernehmen(liste, vorhanden, wahl);
          schon = liste.filter(e => schonUebernommen(e, vorhanden)).length;
          neu = auswahl.length;
          return { neu: aufgabenBauen(auswahl, wahl, { inhaber: person, jetzt }) };
        }, { person, wer, jetzt });
        if (!r.ok) throw new UebernahmeAbgelehnt(r.status === 413 ? 413 : r.status === 409 ? 409 : 400, r.fehler ?? 'Der Aufgaben-Schreibweg lehnte ab. Nichts übernommen.');
        return { neu, schon };
      }, r => ({ neu: r.neu, schon: r.schon }));
      await v.schritt('abschluss', async () => {
        const am = new Date().toISOString();
        await updateJson<UebernahmeStand>(ZULIEFERER_STAND, cur => {
          const s = cur && typeof cur === 'object' ? cur : { ...LEER };
          return { ...s, bestaetigtAm: s.bestaetigtAm ?? am, laeufe: [...(Array.isArray(s.laeufe) ? s.laeufe : []), { am, neu: Number(v.daten('neu') ?? 0), schon: Number(v.daten('schon') ?? 0), erledigte: wahl.erledigte }] };
        });
      });
      if (h) await absichtAbschliessen(h, absicht.id, 'fertig', ['neu', 'schon']);
      return { ok: true, status: 200 as const, neu: Number(v.daten('neu') ?? 0), schon: Number(v.daten('schon') ?? 0) };
    }, { speichern: !!h });
  } catch (e) {
    // Fachlich abgelehnt (Notiz zu lang, Schreibweg 400/413): nichts geschrieben — die Absicht ist gegenstandslos, kein Wiederholen.
    if (e instanceof UebernahmeAbgelehnt || e instanceof NotizZuLang) {
      if (h) await absichtAbschliessen(h, absicht.id, 'verworfen').catch(() => {});
      return { ok: false, status: e instanceof NotizZuLang ? 413 : e.status, neu: 0, schon: 0, fehler: e.message };
    }
    throw e;
  }
}

// ── Schalter und Spiegel löschen ─────────────────────────────────────────────

export type SchaltErgebnis = { ok: true; lage: ZuliefererLage } | { ok: false; status: 409; fehler: string; offen?: number };

/**
 * Instanz-Einstellung setzen (nur der Inhaber per Sitzung — die Route prüft). Ausschalten vor der Übernahme nur ausdrücklich
 * (`ohneUebernahme`), solange offene, noch nicht übernommene Erinnerungen im Spiegel liegen. Gegen die Umgebung geht nichts.
 */
export async function zuliefererSchalten(an: boolean, o: { ohneUebernahme?: boolean } = {}): Promise<SchaltErgebnis> {
  const lage = await zuliefererLage();
  if (lage.umgebung) return { ok: false, status: 409, fehler: `Auf dem Server festgelegt (MAKE_OS_ZULIEFERER=${lage.umgebung}) — dort ändern.` };
  if (!an && !lage.uebernahmeAm && !o.ohneUebernahme) {
    const [{ liste }, { ids }] = await Promise.all([erinnerungenSpiegel(), vorhandeneKennungen()]);
    const offen = liste.filter(e => !e.erledigt && !schonUebernommen(e, ids)).length;
    if (offen) return { ok: false, status: 409, offen, fehler: `${offen} offene Erinnerung${offen === 1 ? '' : 'en'} sind noch nicht als Aufgaben übernommen — erst übernehmen oder ausdrücklich ohne Übernahme ausschalten.` };
  }
  const jetzt = new Date().toISOString();
  await aendereKonten(s => ({ ...s, einstellungen: { ...s.einstellungen, zulieferer: an ? 'an' : 'aus', zuliefererSeit: jetzt } }));
  return { ok: true, lage: await zuliefererLage() };
}

/**
 * Einen Spiegel vom Mac ganz entfernen (samt Tageskopien) — nur, wenn der Zulieferer aus ist (sonst lieferte der Mac ihn neu).
 * Im Änderungsprotokoll nur Bestandsname und Person.
 */
export async function spiegelLoeschen(art: SpiegelArt, person: string): Promise<{ ok: true; war: boolean } | { ok: false; status: 409; fehler: string }> {
  if (await zuliefererAktiv()) return { ok: false, status: 409, fehler: 'Erst den Zulieferer ausschalten — sonst liefert der Mac den Spiegel neu.' };
  const name = SPEICHER[art];
  const war = await bestandEntfernen(name, { tageskopien: true });
  const am = new Date().toISOString();
  await updateJson<UebernahmeStand>(ZULIEFERER_STAND, cur => {
    const s = cur && typeof cur === 'object' ? cur : { ...LEER };
    return { ...s, laeufe: Array.isArray(s.laeufe) ? s.laeufe : [], cacheGeloescht: { ...s.cacheGeloescht, [art]: am } };
  });
  if (war) await protokolliere(name, [{ op: 'geloescht', id: name }], { art: 'person', person });
  return { ok: true, war };
}

/** Wann der jeweilige Spiegel zuletzt vom Mac kam (nur Zeitpunkt und Anzahl, nie Inhalte) — für die Karte des Inhabers. */
export async function spiegelStand(): Promise<Record<SpiegelArt, { da: boolean; at: string | null; anzahl: number }>> {
  const raus = {} as Record<SpiegelArt, { da: boolean; at: string | null; anzahl: number }>;
  for (const art of SPIEGEL_ARTEN) {
    const g = await loadJson<Gemerkt>(SPEICHER[art]).catch(() => null);
    const d = g?.daten as unknown;
    const anzahl = Array.isArray(d) ? d.length : d && typeof d === 'object' && Array.isArray((d as { kontakte?: unknown[] }).kontakte) ? (d as { kontakte: unknown[] }).kontakte.length : 0;
    raus[art] = { da: !!g, at: g?.at ?? null, anzahl };
  }
  return raus;
}
