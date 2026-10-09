// ─── Konten-Register — Server (08.10.) ──────────────────────────────────────────────────────────────────────────────────────────────────
// EINE Schreibstelle für Konten und Kontostände: `registerAendern` (Formulare), `kontostandAusAltweg` (bisherige Schreibwege: Liquidität-Kontostand,
// ZOE `setze_kontostand`), `eroeffnungImRegister`/`eroeffnungZurueckgenommen` (0-Punkt), `uebernahme…` (einmalig per Klick) — später die Bank
// (`quelle: 'bank'`, `externeId`) über dieselbe Stelle. EINE Lesestelle: `kontostaendeFuer(haushalt, sicht)` (Route, Oberfläche) und
// `registerKasseLaden()` / `registerFuerPlan(haushalt)` (Server-Leser: 0-Punkt-Wirkung `mitEroeffnung`, Business-Index, Finanzplanung, Privat-Index).
// Regeln rein in ./register.ts, Befund und Bauplan in KONTEN_REGISTER.md.
//
// Rückweg zum alten Online-Stand: die bisherigen Stellen bleiben. Schreibt das Register einen Stand für eine Gesellschaft, die es regiert, zieht
// es den Kontostand der Firma im Finanzplan (`finanzplan.firmen[…].kontostand/stand`) nach — der alte Stand sieht so die neue Zahl. Nur neue
// Bestände und optionale Felder, kein `_v`.

import { loadJson, updateJson, speicherStand } from '@/lib/store/local-db';
import { fingerabdruck } from '@/lib/store/fingerabdruck';
import { protokolliere, type Aenderung } from '@/lib/store/aenderungsprotokoll';
import { ladeKonten } from '@/lib/zugang/konten';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { localDay } from '@/lib/zeit';
import { GESELLSCHAFTEN, finanzOrtName, istGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';
import type { Geltende } from '@/lib/business/eroeffnung';
import {
  kontenName, registerLesen, registerFuerSicht, registerAnwenden, kontoAnzeige, gesellschaftsKasse, privatKasse, ruecklageKasse,
  kontenIstAus, regiert, zielKontoFuer, standAnhaengen, herkunftZuruecknehmen, andereEroeffnungenZuruecknehmen, uebernahmePlan, uebernahmeAnwenden, ortImBusiness,
  type KontenRegister, type KontenSicht, type KontoOp, type KontoAnzeige, type GesellschaftsKasse, type Kasse, type KontenIst, type RegisterKonto,
  type StandHerkunft, type UebernahmePlan, type Quellen, type KontoOrt,
} from './register';

/** Fingerabdruck eines Kontos — der Browser schickt ihn beim Ändern zurück. */
export const kontoFassung = (k: RegisterKonto): string => fingerabdruck({ k } as Record<string, unknown>);

export async function ladeRegister(haushalt: string): Promise<KontenRegister> {
  return registerLesen(await loadJson<unknown>(kontenName(haushalt)));
}
/** Nichts zu schreiben — bricht `updateJson` ab, ohne den Bestand anzufassen (auch keine leere Datei anlegen). */
class Unveraendert extends Error {}
/**
 * Die EINE Schreibstelle des Bestands: in seiner Sperre lesen, ändern, schreiben. `f` bekommt den rohen Stand (null = noch keiner) und liefert den
 * neuen Stand — oder null, wenn nichts zu schreiben ist (dann bleibt die Datei, wie sie ist).
 */
async function imRegister(haushalt: string, f: (alt: KontenRegister | null) => KontenRegister | null): Promise<void> {
  try {
    await updateJson<KontenRegister>(kontenName(haushalt), alt => { const n = f(alt); if (!n) throw new Unveraendert(); return n; });
  } catch (e) { if (!(e instanceof Unveraendert)) throw e; }
}

/** Stand des Bestands (für ETags anderer Routen). */
export const registerStand = (haushalt: string) => speicherStand([kontenName(haushalt)]);

/** Der Haushalt, dem die Gesellschaften gehören (der des Inhabers) — ohne eingetragenen Haushalt keiner (dann gibt es kein Register). */
async function inhaberHaushalt(): Promise<string | null> {
  const h = await haushaltDesInhabers().catch(() => null);
  return h && /^[a-z0-9][a-z0-9-]{0,39}$/.test(h) ? h : null;
}
async function personenIm(haushalt: string): Promise<string[]> {
  return (await ladeKonten()).konten.filter(k => k.haushalt === haushalt).map(k => k.speicher);
}

// ── Lesen ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface KontenLage {
  haushalt: string;
  sicht: KontenSicht;
  konten: KontoAnzeige[];
  /** Kasse je Gesellschaft, die das Register regiert (in der Sicht). */
  gesellschaften: GesellschaftsKasse;
  /** Haushalt (privat + gemeinsam) — nur in der Privat-Sicht. */
  privat?: Kasse | null;
  /** Rücklage (Tagesgeld privat + gemeinsam) — nur in der Privat-Sicht. */
  ruecklage?: Kasse | null;
}

/** DIE Lesefunktion für Route und Oberfläche: das Register in der Sicht, IBAN maskiert, mit Kassen. */
export async function kontostaendeFuer(haushalt: string, sicht: KontenSicht): Promise<KontenLage> {
  const r = registerFuerSicht(await ladeRegister(haushalt), sicht);
  const nur = sicht === 'business' ? GESELLSCHAFTEN.filter(ortImBusiness) : GESELLSCHAFTEN;
  return {
    haushalt, sicht,
    konten: r.konten.map(k => kontoAnzeige(k, kontoFassung(k))),
    gesellschaften: gesellschaftsKasse(r.konten, nur),
    ...(sicht === 'privat' ? { privat: privatKasse(r.konten), ruecklage: ruecklageKasse(r.konten) } : {}),
  };
}

/**
 * Für die Server-Leser der Firmen-Konten (0-Punkt-Wirkung `mitEroeffnung`, Business-Index, Fluss): die Kasse je Gesellschaft aus dem Register
 * des Inhaber-Haushalts. Ohne Haushalt/Register oder bei einem Lesefehler: leer — dann gilt die bisherige Quelle (nie ein Ausfall).
 */
export async function registerKasseLaden(): Promise<GesellschaftsKasse> {
  const h = await inhaberHaushalt();
  if (!h) return {};
  try { return gesellschaftsKasse((await ladeRegister(h)).konten); }
  catch (e) { console.error('[konten] Register nicht lesbar — bisherige Quelle gilt:', e instanceof Error ? e.message : e); return {}; }
}

/** Für die Finanzplanung eines Haushalts: Gesellschafts-Kasse (Startwerte ug/kdv) und Ist der Privat-Konten/Selbstständigkeit. */
export async function registerFuerPlan(haushalt: string): Promise<{ kasse: GesellschaftsKasse; ist: KontenIst | undefined }> {
  try {
    const r = await ladeRegister(haushalt);
    // Die Gesellschaften gehören dem Inhaber-Haushalt — ein anderer Haushalt rechnet sie nur mit seinem eigenen Register.
    return { kasse: gesellschaftsKasse(r.konten), ist: kontenIstAus(r.konten) };
  } catch (e) {
    console.error('[konten] Register nicht lesbar — die Planung rechnet wie bisher:', e instanceof Error ? e.message : e);
    return { kasse: {}, ist: undefined };
  }
}

/** Rücklage des Haushalts aus dem Register (Tagesgeld privat + gemeinsam), in Cent — null = die eingetragene Rücklage gilt. */
export async function ruecklageAusRegister(haushalt: string): Promise<{ betrag: number; stand: string } | null> {
  try {
    const k = ruecklageKasse((await ladeRegister(haushalt)).konten);
    return k && k.konten ? { betrag: Math.round(k.betrag * 100), stand: k.aeltester } : null;
  } catch { return null; }
}

// ── Schreiben (Formular) ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type Aendern = { ok: true; lage: KontenLage; neu: string[] } | { ok: false; status: 400 | 403 | 404 | 409 | 413; fehler: string; lage?: KontenLage };

/** Einzelschritte in EINER Sperre, dann Protokoll (ohne Werte) und der Rückweg-Spiegel in den Finanzplan. */
export async function registerAendern(haushalt: string, ops: KontoOp[], person: string, sicht: KontenSicht, jetzt = new Date()): Promise<Aendern> {
  const personen = await personenIm(haushalt);
  let erg: ReturnType<typeof registerAnwenden> | null = null;
  await imRegister(haushalt, alt => {
    const r = registerLesen(alt);
    erg = registerAnwenden(r, ops, { person, jetzt: jetzt.toISOString(), heute: localDay(jetzt), sicht, personen, fassung: kontoFassung });
    return erg.ok ? erg.register : null;
  });
  const e = erg as ReturnType<typeof registerAnwenden> | null;
  if (!e) return { ok: false, status: 400, fehler: 'Nicht gespeichert.' };
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler, ...(e.status === 409 ? { lage: await kontostaendeFuer(haushalt, sicht) } : {}) };
  const aenderungen: Aenderung[] = [
    ...e.neu.map(id => ({ liste: 'konten', op: 'neu' as const, id })),
    ...e.geaendert.map(g => ({ liste: 'konten', op: 'geaendert' as const, id: g.id, felder: g.felder })),
  ];
  await protokolliere(kontenName(haushalt), aenderungen, { art: 'person', person }, jetzt);
  await finanzplanSpiegeln(haushalt, e.orte);
  return { ok: true, lage: await kontostaendeFuer(haushalt, sicht), neu: e.neu };
}

// ── Rückweg-Spiegel: Register → Kontostand der Firma im Finanzplan ───────────────────────────────────────────────────────────────

interface FinanzplanFirmen { firmen?: { id: string; name: string; bank?: string; kontostand: number | null; stand: string | null }[] }

/**
 * Für jede berührte Gesellschaft, die das Register regiert: Kontostand/Datum der Firma im Finanzplan (`finanzplan`) auf die Kasse setzen — nur im
 * Haushalt des Inhabers (dem gehört der Finanzplan der Firmen). Ändert nichts, wenn der Wert schon stimmt. Wirft nie (Rückweg ist Zusatz).
 */
export async function finanzplanSpiegeln(haushalt: string, orte: readonly KontoOrt[]): Promise<void> {
  const gs = Array.from(new Set(orte.filter((o): o is Gesellschaftskennung => istGesellschaft(o))));
  if (!gs.length || haushalt !== await inhaberHaushalt()) return;
  try {
    const r = await ladeRegister(haushalt);
    const kasse = gesellschaftsKasse(r.konten, gs);
    if (!Object.keys(kasse).length) return;
    await updateJson<FinanzplanFirmen>('finanzplan', cur => {
      if (!cur || !Array.isArray(cur.firmen) || !cur.firmen.length) return cur as FinanzplanFirmen;   // Plan noch nie angelegt: der Erststart (SEED) bleibt der Route
      let geaendert = false;
      const firmen = cur.firmen.map(f => {
        const k = istGesellschaft(f.id) ? kasse[f.id] : undefined;
        if (!k) return f;
        const kontostand = k.konten ? k.betrag : null, stand = k.stand || null;
        if (f.kontostand === kontostand && f.stand === stand) return f;
        geaendert = true;
        return { ...f, kontostand, stand };
      });
      for (const g of gs) {
        const k = kasse[g];
        if (k && !firmen.some(f => f.id === g)) { firmen.push({ id: g, name: finanzOrtName(g), bank: '', kontostand: k.konten ? k.betrag : null, stand: k.stand || null }); geaendert = true; }
      }
      return geaendert ? { ...cur, firmen } : cur;
    });
  } catch (e) { console.error('[konten] Spiegel in den Finanzplan:', e instanceof Error ? e.message : e); }
}

/** Der Kontostand der Gesellschaft im Finanzplan VOR einem Kontoauszug, der das Register erst zur Quelle gemacht hat (09.10., Nahtstellen). */
export interface FirmaVorher { kontostand: number | null; stand: string | null; /** Was der Rückweg-Spiegel danach eintrug (= der Saldo). */ gespiegelt: { betrag: number; datum: string } }

/**
 * Den Kontostand einer Gesellschaft festhalten, BEVOR ein Kontoauszug-Saldo das Register für sie zur Quelle macht — nur, wenn das Register sie
 * noch nicht führt (sonst gilt ohnehin das Register). null = nichts festzuhalten. Nur im Haushalt des Inhabers (dem gehört der Finanzplan der Firmen).
 */
export async function firmaVorAuszug(haushalt: string, kontoId: string, saldo: { betrag: number; datum: string }): Promise<FirmaVorher | null> {
  if (haushalt !== await inhaberHaushalt()) return null;
  const r = await ladeRegister(haushalt);
  const k = r.konten.find(x => x.id === kontoId);
  if (!k || !istGesellschaft(k.ort) || regiert(r.konten, o => o === k.ort)) return null;
  const f = (await loadJson<FinanzplanFirmen>('finanzplan'))?.firmen?.find(x => x.id === k.ort);
  return { kontostand: typeof f?.kontostand === 'number' && Number.isFinite(f.kontostand) ? f.kontostand : null, stand: f?.stand ?? null, gespiegelt: { betrag: Math.round(saldo.betrag * 100) / 100, datum: saldo.datum } };
}

/**
 * Nach „Rückgängig“ eines Kontoauszugs: führt das Register die Gesellschaft nicht mehr (nur der zurückgenommene Saldo hatte es zur Quelle gemacht),
 * kommt der Kontostand der Firma im Finanzplan auf den Stand von vorher — aber nur, wenn dort noch steht, was der Spiegel eingetragen hatte (sonst
 * hat inzwischen jemand gepflegt; das bleibt). Idempotent, wirft nie.
 */
export async function firmaVorherHerstellen(haushalt: string, ort: KontoOrt, vorher: FirmaVorher): Promise<boolean> {
  try {
    if (!istGesellschaft(ort) || haushalt !== await inhaberHaushalt()) return false;
    if (regiert((await ladeRegister(haushalt)).konten, o => o === ort)) return false;
    let hergestellt = false;
    await updateJson<FinanzplanFirmen>('finanzplan', cur => {
      if (!cur || !Array.isArray(cur.firmen)) return cur as FinanzplanFirmen;
      const firmen = cur.firmen.map(f => {
        if (f.id !== ort || f.kontostand !== vorher.gespiegelt.betrag || f.stand !== vorher.gespiegelt.datum) return f;
        hergestellt = true;
        return { ...f, kontostand: vorher.kontostand, stand: vorher.stand };
      });
      return hergestellt ? { ...cur, firmen } : cur;
    });
    return hergestellt;
  } catch (e) { console.error('[konten] Kontostand vor dem Kontoauszug:', e instanceof Error ? e.message : e); return false; }
}

// ── Bisherige Schreibwege und 0-Punkt → Register ─────────────────────────────────────────────────────────────────────────────────

/**
 * Ein bisheriger Schreibweg hat den Kontostand einer Gesellschaft gesetzt (Liquidität, ZOE `setze_kontostand`): regiert das Register diese
 * Gesellschaft schon, kommt derselbe Stand dort an (in das verknüpfte bzw. einzige Kassen-Konto; mehrdeutig → nichts, mit Log). Regiert es sie
 * nicht, bleibt die bisherige Quelle die Wahrheit — nichts wird still übernommen (die Übernahme ist ein Klick). Wirft nie.
 */
type AltwegErgebnis = 'geschrieben' | 'unveraendert' | 'nicht-regiert' | 'mehrdeutig';
export async function kontostandAusAltweg(a: { firma: string; betrag: number; datum: string; person: string; herkunft: StandHerkunft; herkunftId?: string; jetzt?: Date }): Promise<AltwegErgebnis> {
  try {
    if (!istGesellschaft(a.firma) || !Number.isFinite(a.betrag)) return 'nicht-regiert';
    const g = a.firma;
    const h = await inhaberHaushalt();
    if (!h) return 'nicht-regiert';
    const jetzt = a.jetzt ?? new Date();
    if (a.datum > localDay(jetzt)) return 'nicht-regiert';   // Kontostände liegen nie in der Zukunft (ein künftiger 0-Punkt wirkt weiter über abEroeffnung)
    let ergebnis: 'geschrieben' | 'unveraendert' | 'nicht-regiert' | 'mehrdeutig' = 'nicht-regiert';
    let kontoId = '';
    await imRegister(h, alt => {
      const r = registerLesen(alt);
      if (!regiert(r.konten, o => o === g)) { ergebnis = 'nicht-regiert'; return null; }
      const ziel = zielKontoFuer(r, g);
      if (!ziel) { ergebnis = 'mehrdeutig'; return null; }
      const n = standAnhaengen(r, ziel.id, {
        betrag: Math.round(a.betrag * 100) / 100, datum: a.datum, quelle: 'hand', erfasstVon: a.person, erfasstAm: jetzt.toISOString(),
        herkunft: { art: a.herkunft, ...(a.herkunftId ? { id: a.herkunftId } : {}) },
      });
      ergebnis = n.neu ? 'geschrieben' : 'unveraendert'; kontoId = ziel.id;
      return n.neu ? n.register : null;
    });
    const fertig = ergebnis as AltwegErgebnis;
    if (fertig === 'mehrdeutig') console.warn(`[konten] ${g}: mehrere Konten ohne Verknüpfung — Stand aus „${a.herkunft}“ nicht ins Register geschrieben (bitte im Register eintragen).`);
    if (fertig === 'geschrieben') await protokolliere(kontenName(h), [{ liste: 'konten', op: 'geaendert', id: kontoId, felder: ['staende'] }], { art: 'person', person: a.person }, jetzt);
    return fertig;
  } catch (e) {
    console.error('[konten] Stand aus bisherigem Schreibweg:', e instanceof Error ? e.message : e);
    return 'nicht-regiert';
  }
}

/**
 * 0-Punkt gesetzt: führt das Register die Gesellschaft, ist sein Anfangsbestand dort ein Stand am Stichtag (Herkunft = Eröffnung), und frühere
 * 0-Punkte derselben Gesellschaft zählen dort nicht mehr (es gilt der zuletzt gesetzte — wie `geltendeEroeffnungen`). Ein Stichtag in der Zukunft
 * kommt nicht ins Register (Kontostände liegen nie in der Zukunft) — er wirkt weiter über `abEroeffnung`. Führt das Register die Gesellschaft nicht,
 * bleibt der 0-Punkt die Quelle (nichts still übernehmen). Danach zieht der Rückweg-Spiegel den Finanzplan nach. Wirft nie.
 */
export async function eroeffnungImRegister(e: { id: string; firma: Gesellschaftskennung; stichtag: string; kontostand: number }, person: string, jetzt = new Date()): Promise<'geschrieben' | 'unveraendert' | 'nicht-regiert' | 'mehrdeutig'> {
  try {
    const h = await inhaberHaushalt();
    if (!h || !istGesellschaft(e.firma)) return 'nicht-regiert';
    let ergebnis: 'geschrieben' | 'unveraendert' | 'nicht-regiert' | 'mehrdeutig' = 'nicht-regiert';
    let kontoId = '';
    await imRegister(h, alt => {
      let r = registerLesen(alt);
      if (!regiert(r.konten, o => o === e.firma)) { ergebnis = 'nicht-regiert'; return null; }
      const z = andereEroeffnungenZuruecknehmen(r, e.firma, e.id, person, jetzt.toISOString());
      r = z.register;
      ergebnis = z.anzahl ? 'geschrieben' : 'unveraendert';
      if (e.stichtag > localDay(jetzt)) return z.anzahl ? r : null;
      const ziel = zielKontoFuer(r, e.firma);
      if (!ziel) { ergebnis = z.anzahl ? 'geschrieben' : 'mehrdeutig'; return z.anzahl ? r : null; }
      const n = standAnhaengen(r, ziel.id, {
        betrag: Math.round(e.kontostand * 100) / 100, datum: e.stichtag, quelle: 'hand', erfasstVon: person, erfasstAm: jetzt.toISOString(),
        herkunft: { art: 'eroeffnung', id: e.id },
      });
      if (n.neu) { ergebnis = 'geschrieben'; kontoId = ziel.id; }
      return n.neu || z.anzahl ? n.register : null;
    });
    const fertig = ergebnis as AltwegErgebnis;
    if (fertig === 'mehrdeutig') console.warn(`[konten] ${e.firma}: mehrere Konten ohne Verknüpfung — 0-Punkt nicht ins Register geschrieben (bitte im Register eintragen).`);
    if (fertig === 'geschrieben') {
      await protokolliere(kontenName(h), [{ liste: 'konten', op: 'geaendert', id: kontoId || `eroeffnung:${e.id}`, felder: ['staende'] }], { art: 'person', person }, jetzt);
      await finanzplanSpiegeln(h, [e.firma]);
    }
    return fertig;
  } catch (err) {
    console.error('[konten] 0-Punkt ins Register:', err instanceof Error ? err.message : err);
    return 'nicht-regiert';
  }
}

/**
 * 0-Punkt zurückgenommen: seine Stände im Register ebenso (bleiben in der Historie); gilt danach wieder ein früherer 0-Punkt (`vorige`), kommt
 * dessen Anfangsbestand als Stand zurück. Dann zieht der Rückweg-Spiegel nach. Wirft nie.
 */
export async function eroeffnungZurueckgenommen(id: string, firma: Gesellschaftskennung, person: string, jetzt = new Date(), vorige?: { id: string; firma: Gesellschaftskennung; stichtag: string; kontostand: number } | null): Promise<number> {
  try {
    const h = await inhaberHaushalt();
    if (!h) return 0;
    let anzahl = 0;
    await imRegister(h, alt => {
      const z = herkunftZuruecknehmen(registerLesen(alt), 'eroeffnung', id, person, jetzt.toISOString());
      anzahl = z.anzahl;
      return z.anzahl ? z.register : null;
    });
    if (anzahl) await protokolliere(kontenName(h), [{ liste: 'konten', op: 'geaendert', id: `eroeffnung:${id}`, felder: ['staende'] }], { art: 'person', person }, jetzt);
    if (vorige) await eroeffnungImRegister(vorige, person, jetzt);
    if (anzahl) await finanzplanSpiegeln(h, [firma]);
    return anzahl;
  } catch (e) { console.error('[konten] 0-Punkt zurücknehmen im Register:', e instanceof Error ? e.message : e); return 0; }
}

// ── Kontoauszug (09.10., lib/finanzen/kontoauszug) — Saldo als Stand, Verknüpfung zum Haushalts-Konto ───────────────────────────────

/**
 * Saldo eines eingelesenen Kontoauszugs als Stand (`quelle: 'bank'`, Herkunft `auszug` mit der Lauf-Kennung). Idempotent: liegt am Konto schon
 * ein nicht zurückgenommener Stand mit demselben Betrag und Datum (egal woher), geschieht nichts. Danach Protokoll + Rückweg-Spiegel.
 * Liefert die Kennung des (neuen oder schon vorhandenen) Stands dieses Laufs; null = nichts geschrieben.
 */
export async function standAusAuszug(haushalt: string, kontoId: string, s: { betrag: number; datum: string; laufId: string; externeId?: string; person: string; jetzt?: Date }): Promise<{ standId: string | null; neu: boolean }> {
  const jetzt = s.jetzt ?? new Date();
  let standId: string | null = null, neu = false, ort: KontoOrt | null = null;
  await imRegister(haushalt, alt => {
    const r = registerLesen(alt);
    const k = r.konten.find(x => x.id === kontoId);
    if (!k) return null;
    ort = k.ort;
    const betrag = Math.round(s.betrag * 100) / 100;
    const eigen = k.staende.find(x => x.herkunft?.art === 'auszug' && x.herkunft.id === s.laufId && !x.zurueckgenommenAm);
    if (eigen) { standId = eigen.id; return null; }
    if (k.staende.some(x => !x.zurueckgenommenAm && x.betrag === betrag && x.datum === s.datum)) return null;
    const n = standAnhaengen(r, kontoId, {
      betrag, datum: s.datum, quelle: 'bank', erfasstVon: s.person, erfasstAm: jetzt.toISOString(), herkunft: { art: 'auszug', id: s.laufId },
      ...(s.externeId ? { externeId: s.externeId.slice(0, 120) } : {}), notiz: 'aus dem Kontoauszug',
    });
    if (!n.neu) return null;
    neu = true;
    standId = n.register.konten.find(x => x.id === kontoId)!.staende.find(x => x.herkunft?.art === 'auszug' && x.herkunft.id === s.laufId)?.id ?? null;
    return n.register;
  });
  if (neu) {
    await protokolliere(kontenName(haushalt), [{ liste: 'konten', op: 'geaendert', id: kontoId, felder: ['staende'] }], { art: 'person', person: s.person }, jetzt);
    if (ort) await finanzplanSpiegeln(haushalt, [ort]);
  }
  return { standId, neu };
}

/** Den Saldo eines Kontoauszug-Laufs zurücknehmen (bleibt im Verlauf). Liefert die Zahl der zurückgenommenen Stände. Danach Rückweg-Spiegel. */
export async function auszugStandZuruecknehmen(haushalt: string, laufId: string, person: string, jetzt = new Date()): Promise<number> {
  let anzahl = 0;
  const orte: KontoOrt[] = [];
  await imRegister(haushalt, alt => {
    const r = registerLesen(alt);
    for (const k of r.konten) if (k.staende.some(s => s.herkunft?.art === 'auszug' && s.herkunft.id === laufId && !s.zurueckgenommenAm)) orte.push(k.ort);
    const z = herkunftZuruecknehmen(r, 'auszug', laufId, person, jetzt.toISOString());
    anzahl = z.anzahl;
    return z.anzahl ? z.register : null;
  });
  if (anzahl) {
    await protokolliere(kontenName(haushalt), [{ liste: 'konten', op: 'geaendert', id: `auszug:${laufId}`, felder: ['staende'] }], { art: 'person', person }, jetzt);
    await finanzplanSpiegeln(haushalt, orte);
  }
  return anzahl;
}

/**
 * Register-Konto mit seinem Haushalts-Konto verknüpfen (`alt.haushaltKonto`) — nur, wenn noch keins verknüpft ist bzw. die bisherige Verknüpfung
 * auf ein Haushalts-Konto zeigt, das es nicht mehr gibt (`ersetzt`). Idempotent.
 */
export async function haushaltKontoVerknuepfen(haushalt: string, kontoId: string, haushaltKonto: string, person: string, opt: { ersetzt?: string; jetzt?: Date } = {}): Promise<boolean> {
  const jetzt = opt.jetzt ?? new Date();
  let gesetzt = false;
  await imRegister(haushalt, alt => {
    const r = registerLesen(alt);
    const k = r.konten.find(x => x.id === kontoId);
    if (!k || k.alt?.haushaltKonto === haushaltKonto || (k.alt?.haushaltKonto && k.alt.haushaltKonto !== opt.ersetzt)) return null;
    gesetzt = true;
    return { ...r, konten: r.konten.map(x => (x.id === kontoId ? { ...x, alt: { ...(x.alt ?? {}), haushaltKonto }, geaendertAm: jetzt.toISOString() } : x)) };
  });
  if (gesetzt) await protokolliere(kontenName(haushalt), [{ liste: 'konten', op: 'geaendert', id: kontoId, felder: ['alt'] }], { art: 'person', person }, jetzt);
  return gesetzt;
}

// ── Übernahme der bisherigen Stände (Vorschau → Bestätigen, nie automatisch) ─────────────────────────────────────────────────────

const normName = (s: string) => s.normalize('NFC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();

async function quellenLaden(haushalt: string): Promise<Quellen> {
  const inhaber = haushalt === await inhaberHaushalt();
  const [fp, eroeffnungen, plan, stamm, { konten }] = await Promise.all([
    inhaber ? loadJson<FinanzplanFirmen>('finanzplan') : Promise.resolve(null),
    inhaber ? import('@/lib/business/eroeffnung-server').then(m => m.geltendeLaden()) : Promise.resolve({} as Geltende),
    loadJson<{ posten?: { id?: string; art?: string; einheit?: string; name?: string; betrag?: number | null }[] }>(`finanzen-plan--${haushalt}`),
    import('@/lib/finanzen/haushalt/speicher').then(m => m.ladeHaushalt(haushalt)).then(x => x.stamm.konten).catch(() => []),
    ladeKonten(),
  ]);
  const imHaushalt = konten.filter(k => k.haushalt === haushalt);
  return {
    firmen: (fp?.firmen ?? []).map(f => ({ id: f.id, name: f.name, bank: f.bank, kontostand: f.kontostand, stand: f.stand })),
    eroeffnungen: Object.values(eroeffnungen).filter((e): e is NonNullable<typeof e> => !!e).map(e => ({ id: e.id, firma: e.firma, stichtag: e.stichtag, kontostand: e.kontostand })),
    posten: (Array.isArray(plan?.posten) ? plan!.posten : []).filter(p => p && p.art === 'konto' && typeof p.id === 'string')
      .map(p => ({ id: p.id!, einheit: String(p.einheit ?? ''), name: String(p.name ?? 'Konto'), betrag: typeof p.betrag === 'number' && Number.isFinite(p.betrag) ? p.betrag : null })),
    haushaltKonten: stamm.map(k => ({ id: k.id, name: k.name, inhaber: k.inhaber, einheit: k.einheit, bank: k.bank, aktiv: k.aktiv !== false })),
    personNachName: (name: string) => {
      const n = normName(name);
      const voll = imHaushalt.filter(k => normName(k.name) === n);
      if (voll.length === 1) return voll[0].speicher;
      const vor = imHaushalt.filter(k => normName(k.name).split(' ')[0] === n.split(' ')[0]);
      return vor.length === 1 ? vor[0].speicher : null;
    },
  };
}

/** Fingerabdruck einer Vorschau — die Bestätigung muss genau diese Vorschau meinen (sonst 409). */
const planFassung = (p: UebernahmePlan) => fingerabdruck({ p: p.punkte.map(x => [x.schluessel, x.ort, x.kontoId ?? '', x.betrag ?? null, x.datum ?? '', x.person ?? '', x.alt]) } as Record<string, unknown>);

export async function uebernahmeVorschau(haushalt: string, sicht: KontenSicht, jetzt = new Date()): Promise<UebernahmePlan & { basis: string }> {
  const plan = uebernahmePlan(await ladeRegister(haushalt), await quellenLaden(haushalt), sicht, localDay(jetzt));
  return { ...plan, basis: planFassung(plan) };
}

export type Uebernahme = { ok: true; konten: number; staende: number; lage: KontenLage } | { ok: false; status: 409; fehler: string; vorschau: UebernahmePlan & { basis: string } };

/** Die Übernahme ausführen — nur wenn die Vorschau noch dieselbe ist (`basis`); in EINER Sperre neu geplant und angewendet. */
export async function uebernahmeAusfuehren(haushalt: string, sicht: KontenSicht, person: string, basis: unknown, jetzt = new Date()): Promise<Uebernahme> {
  const quellen = await quellenLaden(haushalt);
  let ergebnis: { konten: number; staende: number; orte: KontoOrt[] } | null = null;
  let abweichend: (UebernahmePlan & { basis: string }) | null = null;
  await imRegister(haushalt, alt => {
    const r = registerLesen(alt);
    const plan = uebernahmePlan(r, quellen, sicht, localDay(jetzt));
    if (planFassung(plan) !== basis) { abweichend = { ...plan, basis: planFassung(plan) }; return null; }
    if (!plan.punkte.length) { ergebnis = { konten: 0, staende: 0, orte: [] }; return null; }
    const a = uebernahmeAnwenden(r, plan, { person, jetzt: jetzt.toISOString() });
    ergebnis = { konten: a.konten, staende: a.staende, orte: plan.punkte.map(p => p.ort) };
    return a.register;
  });
  const vorschau = abweichend as (UebernahmePlan & { basis: string }) | null;
  if (vorschau) return { ok: false, status: 409, fehler: 'Inzwischen hat sich etwas geändert — die Vorschau ist neu geladen, bitte noch einmal prüfen.', vorschau };
  const e = ergebnis as { konten: number; staende: number; orte: KontoOrt[] } | null;
  if (e && (e.konten || e.staende)) {
    await protokolliere(kontenName(haushalt), [{ liste: 'konten', op: 'neu', id: 'uebernahme', felder: ['konten', 'staende'] }], { art: 'person', person }, jetzt);
    await finanzplanSpiegeln(haushalt, e.orte);
  }
  return { ok: true, konten: e?.konten ?? 0, staende: e?.staende ?? 0, lage: await kontostaendeFuer(haushalt, sicht) };
}

// ── Konto löschen (Art. 17) / Export (Art. 15) — Personen-Felder ─────────────────────────────────────────────────────────────────

/** Konten, die einer Person gehören (`person`) — für den Konto-Export, IBAN maskiert. */
export async function kontenDerPerson(haushalt: string, speicher: string): Promise<KontoAnzeige[]> {
  const r = await ladeRegister(haushalt);
  return r.konten.filter(k => k.person === speicher).map(k => kontoAnzeige(k, kontoFassung(k)));
}

/** Konto gelöscht: die Konten bleiben (Daten des Haushalts), nur die Personen-Kennung wird „[gelöscht]“ (Person, erfasst/angelegt/zurückgenommen von). */
export function registerOhnePerson(r: KontenRegister, speicher: string, geloescht: string): { register: KontenRegister; anzahl: number } {
  let anzahl = 0;
  const tilge = (v: string | undefined) => (v === speicher ? (anzahl++, geloescht) : v);
  const konten = r.konten.map(k => {
    const vorher = anzahl;
    const neu: RegisterKonto = {
      ...k,
      ...(k.person === speicher ? { person: tilge(k.person) } : {}),
      angelegtVon: tilge(k.angelegtVon)!,
      staende: k.staende.map(s => (s.erfasstVon === speicher || s.zurueckgenommenVon === speicher
        ? { ...s, erfasstVon: tilge(s.erfasstVon)!, ...(s.zurueckgenommenVon ? { zurueckgenommenVon: tilge(s.zurueckgenommenVon) } : {}) } : s)),
    };
    return anzahl === vorher ? k : neu;
  });
  const uebernahme = r.uebernahme?.map(u => (u.von === speicher ? (anzahl++, { ...u, von: geloescht }) : u));
  return { register: anzahl ? { ...r, konten, ...(uebernahme ? { uebernahme } : {}) } : r, anzahl };
}

export { kontenName };
