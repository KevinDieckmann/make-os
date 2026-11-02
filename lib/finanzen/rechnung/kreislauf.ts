// ─── Kreislauf Geld — Folgen im Rechnungswesen (29.10., Pakete 1 + 2; nur Server) ─────────────────────────────────────────────────────────
// Vorher blieb liegen, was der Mensch nicht selbst anstieß: eine bezahlte oder stornierte Rechnung behielt ihre offenen Mahnaufgaben, kein Ereignis meldete
// ein Storno oder eine überfällige Rechnung, und eine fällige Rate bzw. Monatsrechnung eines Mandats wartete, bis jemand in der Mandatsakte klickte.
//
//   nachRechnungBezahlt / nachRechnungStorniert   Mahnaufgaben `mahn-<rechnung>-<stufe>` schließen (bezahlt → erledigt, storniert → abgebrochen) über den
//                                                 EINEN Server-Schreibweg (`systemAufgabenAendern`); beim Storno das Ereignis „Rechnung storniert“. Wirft nie.
//   ueberfaelligNachziehen                        Morgenlauf neben den Mahnaufgaben: Ereignis „Rechnung überfällig“ je frisch fälliger Mahnstufe (einmal).
//   rechnungenVorbereiten                         Morgenlauf „Rechnungen vorbereiten“ (Kevin 29.10.): je aktivem Mandat höchstens EIN Entwurf für den fälligen
//                                                 Monat bzw. die fällige Rate (`entwurfNeu`, quelle mandat — derselbe Weg wie der Knopf) + Aufgabe
//                                                 `rv-<mandat>-<monat>` „Rechnung prüfen & stellen“. Gestellt wird nie — das bleibt ein Klick im Editor.
//                                                 Altbestand: wirkt erst ab dem Monat NACH dem ersten Lauf (`kreislauf.vorbereiten.ab`), je Mandat und Monat
//                                                 genau einmal (Merker — auch ein gelöschter Entwurf kommt nicht wieder). Stellschraube `an` (Vorgabe an).
//                                                 31.10. (Kreislauf-Rest): auch Quartal (EIN Entwurf je Quartal im Rhythmus des Mandats), einmaliges
//                                                 Honorar ohne Zahlplan (EIN Entwurf zum Beginn), Tagessatz (am Monatsersten aus der erfassten Zeit des
//                                                 Vormonats; ohne Zeit nur die Aufgabe mit Hinweis) und die Einmalposten eines gemischten Angebots (je
//                                                 Zahlung laut Zahlungsweise ein Entwurf `nur: 'einmalig'` + `rate`, Aufgabe `rve-…`).
// Merker und Stellschraube liegen im Bestand `rechnungswesen` (Feld `kreislauf`, optional — nur Kennungen, keine Personen).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { bereichVon, finanzFirmaFuer, istGesellschaft, NUR_GRUNDDATEN } from '@/lib/einheiten';
import { WEG } from '@/lib/wege';
import { sauberFile, type FinanzplanFile, type Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { abgerechneteMonate, monatsName } from './regeln';
import {
  einmalAufgabeId, einmalSchluessel, einmalZahlungen, einmalZahlungText, istMahnAufgabeVon, quartalMonate, rateNummer, rechnungFuerMandat, rechnungFuerMonat, STUNDEN_JE_TAG_VORGABE,
  pauseUeberspringen, tageAusZeit, ueberfaelligFrisch, vorbereitenAbMonat, vorbereitenAufgabeId, vorbereitenFaellig, vorbereitenSchluessel, type EinmalZahlung, type VorbereitenFaellig,
} from './kreislauf-regeln';

/** Der Teil des Bestands `rechnungswesen`, den der Kreislauf führt (additiv — alte Stände kennen ihn nicht). */
export interface KreislaufStand {
  vorbereiten?: {
    /** Stellschraube „Rechnungen vorbereiten“ — fehlt = an. */
    an?: boolean;
    /** Tag des ersten Laufs (JJJJ-MM-TT): Monate davor bekommen nie einen Entwurf. */
    ab?: string;
    /** Je `<mandat>|<monat>` (Einmalposten: `<mandat>|e:<angebot>:<nr>`): `r:<tag>` reserviert (Entwurf/Aufgabe noch nicht sicher da), `f:<tag>` fertig — dann nie wieder. */
    erledigt?: Record<string, string>;
    /** Tagessatz (31.10.): so viele erfasste Stunden sind ein Tag (fehlt = 8). */
    stundenJeTag?: number;
    /**
     * Gescheiterte Läufe je Mandat hintereinander (02.11., Prüfung C) — `n` zählt höchstens einmal je Tag (`tag`), ein gelungener Entwurf setzt zurück.
     * Ab `VORBEREITEN_FEHL_GRENZE` entsteht EINE feste Aufgabe zum Mandat (`rvf-<mandat>`). Nur Kennungen und Zahlen.
     */
    fehlschlaege?: Record<string, { n: number; tag: string }>;
  };
  /**
   * Mandate, die „Angebot angenommen“ AUTOMATISCH angelegt hat (Kevin 29.10.) — je Mandat das Angebot, der Tag und die Liquiplan-Posten. Nur so weiß
   * „Rückgängig“, dass es kein von Hand angelegtes Mandat entfernt. `zurueckAm`: zurückgenommen (der Eintrag bleibt als Nachweis).
   */
  mandatAuto?: Record<string, { angebotId: string; am: string; posten: string[]; zurueckAm?: string }>;
}
interface RW { kreislauf?: KreislaufStand; [k: string]: unknown }
const RECHNUNGSWESEN = 'rechnungswesen';

export async function kreislaufLaden(): Promise<KreislaufStand> {
  return (await loadJson<RW>(RECHNUNGSWESEN))?.kreislauf ?? {};
}
/** Ist „Rechnungen vorbereiten“ an? (Vorgabe an.) */
export const vorbereitenAn = (k: KreislaufStand) => k.vorbereiten?.an !== false;

/** Den Kreislauf-Teil des Bestands ändern (eine Sperre; die übrigen Felder — Nummernkreise, Mahnstufen — bleiben). */
export async function kreislaufAendern(f: (k: KreislaufStand) => KreislaufStand): Promise<void> {
  await updateJson<RW>(RECHNUNGSWESEN, cur => ({ ...(cur ?? {}), kreislauf: f(cur?.kreislauf ?? {}) }));
}

/** Stellschraube setzen (nur ein volles Haushaltsmitglied — prüft die Route). */
export async function vorbereitenSetzen(an: boolean): Promise<boolean> {
  await updateJson<RW>(RECHNUNGSWESEN, cur => ({ ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...(cur?.kreislauf?.vorbereiten ?? {}), an } } }));
  return an;
}

const planLaden = async () => sauberFile(await loadJson<FinanzplanFile>('finanzplan'));

// ── Mahnaufgaben schließen ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Die offenen Mahnaufgaben einer Rechnung schließen (29.10., B6): bezahlt → „erledigt“, storniert → „abgebrochen“ — nur offene (nicht erledigt/abgebrochen,
 * nicht im Papierkorb), über `systemAufgabenAendern` (Verlauf „System“). Nichts offen → nichts geschrieben. Wirft nie.
 */
export async function mahnAufgabenSchliessen(rechnungId: string, art: 'bezahlt' | 'storniert'): Promise<number> {
  try {
    const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
    let n = 0;
    await systemAufgabenAendern(stand => {
      const offen = stand.tasks.filter(t => istMahnAufgabeVon(t.id, rechnungId) && !t.geloeschtAm && t.status !== 'done' && t.status !== 'cancelled');
      n = offen.length;
      return { teile: offen.map(t => ({ id: t.id, felder: { status: art === 'bezahlt' ? 'done' : 'cancelled' } })) };
    });
    return n;
  } catch (e) {
    console.warn('[rechnung] Mahnaufgaben nicht geschlossen:', e instanceof Error ? e.message.slice(0, 120) : e);
    return 0;
  }
}

/** Nach „bezahlt“ (lib/finanzen/rechnung/bezahlt-server.ts) — Mahnaufgaben erledigen. Das Ereignis „Zahlungseingang“ meldet der Bezahlt-Weg selbst. Wirft nie. */
export async function nachRechnungBezahlt(r: Pick<Rechnung, 'id'>): Promise<void> {
  await mahnAufgabenSchliessen(r.id, 'bezahlt');
}

/** Nach einem Storno (jeder der drei Wege): Ereignis „Rechnung storniert“ + Mahnaufgaben abbrechen. Wirft nie. */
export async function nachRechnungStorniert(r: Pick<Rechnung, 'id' | 'firmaId' | 'mandatId'> & Partial<Pick<Rechnung, 'kundeFirmaId' | 'kontaktId'>>): Promise<void> {
  await import('@/lib/ereignisse/quellen').then(q => q.rechnungStorniertEreignis(r)).catch(() => 0);
  await mahnAufgabenSchliessen(r.id, 'storniert');
}

// ── Rechnung überfällig (Ereignis) ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Morgenlauf: Ereignis „Rechnung überfällig“ je frisch fälliger Mahnstufe (Kennung je Rechnung und Stufe — einmal). Wirft nie. */
export async function ueberfaelligNachziehen(heute = localDay()): Promise<number> {
  try {
    const { mahnTageLaden } = await import('./server');
    const l = ueberfaelligFrisch((await planLaden()).rechnungen, heute, await mahnTageLaden());
    if (!l.length) return 0;
    const q = await import('@/lib/ereignisse/quellen');
    return q.rechnungUeberfaelligEreignisse(l.map(({ r, stufe }) => ({ r, stufe })));
  } catch { return 0; }
}

// ── Rechnungen vorbereiten (Morgenlauf) ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * `gruende` (02.11., Prüfung C): je übersprungenem Mandat der Grund (nur Kennung + Satz, nie Namen/Beträge) — vorher stand nur eine Zahl da, und Mandate
 * ohne gewählte Gesellschaft zählten gar nicht. `hinweisAufgaben`: feste Aufgaben, die der Lauf dazu angelegt hat (Gesellschaft wählen, wiederholt gescheitert).
 */
export interface VorbereitenErgebnis { aus?: true; entwuerfe: number; aufgaben: number; uebersprungen: number; ab?: string; gruende?: { mandatId: string; grund: string }[]; hinweisAufgaben?: number }
/** Ab so vielen gescheiterten Läufen hintereinander entsteht eine Aufgabe zum Mandat. */
export const VORBEREITEN_FEHL_GRENZE = 3;
/** Feste Kennungen der Hinweis-Aufgaben (je Mandat einmal — erledigt oder gelöscht kommt sie nicht wieder). */
export const gesellschaftAufgabeId = (mandatId: string) => `rvg-${mandatId.slice(0, 60)}`;
export const fehlAufgabeId = (mandatId: string) => `rvf-${mandatId.slice(0, 60)}`;
export const GESELLSCHAFT_OFFEN_GRUND = 'Am Mandat ist keine Gesellschaft gewählt — ohne sie entsteht kein Rechnungsentwurf.';

/**
 * Morgenlauf „Rechnungen vorbereiten“ — siehe Kopf. `haushalt` = Haushalt des Inhabers (Absender/Gesellschaften liegen je Haushalt). Gestellt wird nie.
 * Fehler je Mandat (z. B. Gesellschaft noch offen, außerhalb der Laufzeit) überspringen dieses Mandat — ohne Merker, der nächste Lauf versucht es wieder.
 */
export async function rechnungenVorbereiten(haushalt: string, heute = localDay(), jetzt = new Date()): Promise<VorbereitenErgebnis> {
  const k0 = await kreislaufLaden();
  if (!vorbereitenAn(k0)) return { aus: true, entwuerfe: 0, aufgaben: 0, uebersprungen: 0 };
  // Einführung: der erste Lauf merkt sich seinen Tag — wirksam nur ab diesem Monat (nie rückwirkend für den Altbestand).
  let ab = k0.vorbereiten?.ab;
  if (!ab) {
    await updateJson<RW>(RECHNUNGSWESEN, cur => {
      const v = cur?.kreislauf?.vorbereiten ?? {};
      if (v.ab) { ab = v.ab; return cur ?? {}; }
      ab = heute;
      return { ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...v, ab: heute } } };
    });
  }
  // Kevin 29.10.: erst ab dem FOLGEmonat der Einführung (Einführung im Oktober → erster Entwurf für November).
  const abMonat = vorbereitenAbMonat(ab!);
  const [{ ladeCrm }, { mandatGesellschaftOffen }, { entwurfNeu }] = await Promise.all([
    import('@/lib/crm/speicher'), import('@/lib/crm/kunden'), import('./server'),
  ]);
  const crm = await ladeCrm();
  let plan = await planLaden();
  const erg: VorbereitenErgebnis = { entwuerfe: 0, aufgaben: 0, uebersprungen: 0, ab, gruende: [], hinweisAufgaben: 0 };
  const ueberspringen = (mandatId: string, grund: string) => { erg.uebersprungen++; erg.gruende!.push({ mandatId, grund: grund.slice(0, 200) }); };
  // Gescheitert (Fehler beim Entwurf, Zeit nicht lesbar): zählen; ab der Grenze EINE feste Aufgabe zum Mandat. Gelungen: Zähler weg.
  const fehlschlag = async (m: import('@/lib/crm/typen').Mandat, grund: string) => {
    ueberspringen(m.id, grund);
    let n = 0;
    await updateJson<RW>(RECHNUNGSWESEN, cur => {
      const v = cur?.kreislauf?.vorbereiten ?? {};
      const alt = v.fehlschlaege?.[m.id];
      n = alt?.tag === heute ? alt.n : (alt?.n ?? 0) + 1;
      if (alt?.tag === heute) return cur ?? {};
      return { ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...v, fehlschlaege: { ...(v.fehlschlaege ?? {}), [m.id]: { n, tag: heute } } } } };
    });
    if (n >= VORBEREITEN_FEHL_GRENZE) erg.hinweisAufgaben! += await aufgabeAnlegen(m, fehlAufgabeId(m.id), 'Rechnung vorbereiten scheitert wiederholt — Mandat prüfen',
      `Der Morgenlauf konnte für dieses Mandat ${n}-mal hintereinander keinen Rechnungsentwurf anlegen. Letzter Grund: ${grund.slice(0, 200)} Bitte das Mandat prüfen (Gesellschaft, Laufzeit, Honorar) und die Rechnung von Hand schreiben.`,
      `[Mandat](${WEG.mandat(m.id)})`, heute);
  };
  const gelungen = async (mandatId: string) => {
    if (!(await kreislaufLaden()).vorbereiten?.fehlschlaege?.[mandatId]) return;
    await updateJson<RW>(RECHNUNGSWESEN, cur => {
      const v = cur?.kreislauf?.vorbereiten ?? {};
      if (!v.fehlschlaege?.[mandatId]) return cur ?? {};
      const { [mandatId]: _weg, ...rest } = v.fehlschlaege;
      return { ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...v, fehlschlaege: rest } } };
    });
  };
  const merken = async (schluessel: string, wert: string) => {
    await updateJson<RW>(RECHNUNGSWESEN, cur => {
      const v = cur?.kreislauf?.vorbereiten ?? {};
      return { ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...v, erledigt: { ...(v.erledigt ?? {}), [schluessel]: wert } } } };
    });
  };
  // Tagessatz (31.10.): die erfasste Zeit je Mandat und Monat — EINMAL je Monat gelesen (Haushalt des Inhabers, Arbeit inkl. Selbstständigkeit).
  const zeitJeMonat = new Map<string, Promise<Map<string, number> | null>>();
  const zeitFuer = (monat: string) => {
    if (!zeitJeMonat.has(monat)) zeitJeMonat.set(monat, (async () => {
      const { inhaberSpeicher } = await import('@/lib/zugang/haushalt-inhaber');
      const wer = await inhaberSpeicher();
      if (!wer) return null;
      const { zeitJeMandatFuer } = await import('@/lib/zeitmessung/mandate-server');
      const z = await zeitJeMandatFuer(wer, 'monat', `${monat}-15`);
      return new Map(z.gesamt.zeilen.filter(x => x.art === 'mandat').map(x => [x.id, x.sek]));
    })().catch(() => null));
    return zeitJeMonat.get(monat)!;
  };
  const sjt = k0.vorbereiten?.stundenJeTag;
  const stundenJeTag = typeof sjt === 'number' && sjt > 0 && sjt <= 24 ? sjt : STUNDEN_JE_TAG_VORGABE;
  const { mandatZumAngebot, einmalRechnungId, einmalRateRechnungId } = await import('./server');
  const { angebotEinmalRest } = await import('@/lib/crm/angebote');
  const { zahlplanMonate } = await import('@/lib/crm/mandat-zusatz');
  for (const m of crm.mandate) {
    const g = m.gesellschaft;
    // Rechnungsfähig wie der Knopf in der Mandatsakte: Gesellschaft gewählt und im Finanzplan geführt (Register-Gesellschaften: nur Grunddaten).
    // 02.11. (Prüfung C): ein AKTIVES Mandat, das daran scheitert, zählt als übersprungen (mit Grund) und bekommt EINE feste Aufgabe — vorher fiel es still heraus.
    if (mandatGesellschaftOffen(g) || !finanzFirmaFuer(g)) {
      // Beendet (02.11., Runde 3): nur, solange bis zum Ende noch etwas fällig ist.
      if (!m.geloeschtAm && (m.status === 'aktiv' || (m.status === 'beendet' && vorbereitenFaellig(m, heute, abgerechneteMonate(m.id, plan.rechnungen), abMonat).length))) {
        const offen = mandatGesellschaftOffen(g);
        ueberspringen(m.id, offen ? GESELLSCHAFT_OFFEN_GRUND : NUR_GRUNDDATEN);
        erg.hinweisAufgaben! += await aufgabeAnlegen(m, gesellschaftAufgabeId(m.id), offen ? 'Gesellschaft am Mandat wählen' : 'Rechnungen zum Mandat von Hand schreiben',
          offen ? `${GESELLSCHAFT_OFFEN_GRUND} In der Mandatsakte die Gesellschaft wählen — danach bereitet der Morgenlauf die Rechnungen wieder vor.`
            : `${NUR_GRUNDDATEN} Der Morgenlauf bereitet für dieses Mandat darum keine Rechnung vor — bitte von Hand schreiben oder eine der festen Gesellschaften wählen.`,
          `[Mandat](${WEG.mandat(m.id)})`, heute);
      }
      continue;
    }
    // ── Altbestand-Pause (02.11., Runde 3): pausiert ohne festgehaltene Pause → diesen Monat (bzw. dieses Quartal) als übersprungen merken ──
    const pause = pauseUeberspringen(m, heute);
    if (pause.length) {
      const erledigt = (await kreislaufLaden()).vorbereiten?.erledigt ?? {};
      for (const mo of pause) if (mo >= abMonat && !erledigt[vorbereitenSchluessel(m.id, mo)]) await merken(vorbereitenSchluessel(m.id, mo), `p:${heute}`);
    }
    // ── A: das Honorar (Monat, Rate/Zahlplan, Quartal, einmalig, Tagessatz) ──
    const faellig = vorbereitenFaellig(m, heute, abgerechneteMonate(m.id, plan.rechnungen), abMonat);
    if (faellig.length) {
      const erledigt = (await kreislaufLaden()).vorbereiten?.erledigt ?? {};
      for (const f of faellig) {
        const monat = f.monat;
        const schl = vorbereitenSchluessel(m.id, monat);
        const stand = erledigt[schl];
        // f: fertig · p: in einer Pause übersprungen (Altbestand, `pauseUeberspringen`) — beides nie nachholen.
        if (stand?.startsWith('f:') || stand?.startsWith('p:')) continue;
        // Von Hand schon angelegt (Entwurf oder Rechnung) — nichts vorbereiten, nur merken. Quartal: irgendein Monat des Quartals; einmalig: irgendeine Rechnung.
        const schon = f.art === 'quartal' ? quartalMonate(monat).some(mo => rechnungFuerMonat(plan.rechnungen, m.id, mo))
          : f.art === 'einmalig' ? rechnungFuerMandat(plan.rechnungen, m.id) : rechnungFuerMonat(plan.rechnungen, m.id, monat);
        if (!stand && schon) { await merken(schl, `f:${heute}`); continue; }
        // Tagessatz: die Tage aus der erfassten Zeit des Monats; ohne Zeit KEIN Entwurf — nur die Aufgabe mit Hinweis (dann fertig).
        let tage = 0;
        let stunden = 0;
        if (f.art === 'tag') {
          const zeit = await zeitFuer(monat);
          if (!zeit) { await fehlschlag(m, 'Die erfasste Zeit war nicht lesbar.'); break; } // Zeit nicht lesbar → ohne Merker, der nächste Lauf versucht es wieder
          stunden = Math.round(((zeit.get(m.id) ?? 0) / 3600) * 10) / 10;
          tage = tageAusZeit(zeit.get(m.id) ?? 0, stundenJeTag);
          if (!tage) {
            if (!stand) await merken(schl, `r:${heute}`);
            erg.aufgaben += await vorbereitenAufgabe(m, f, null, heute);
            await merken(schl, `f:${heute}`);
            break;
          }
        }
        // Reservieren VOR dem Schreiben: bricht der Lauf ab, holt der nächste Entwurf (idempotent) und Aufgabe (feste Kennung) nach.
        if (!stand) await merken(schl, `r:${heute}`);
        let id: string;
        try {
          const e = await entwurfNeu({
            quelle: 'mandat', mandatId: m.id, monat, person: 'system', haushalt, sicht: 'privat', wer: { art: 'system' }, jetzt,
            ...(f.art === 'quartal' ? { quartal: true } : {}),
            ...(tage ? { tage, tageHinweis: `Tage aus der erfassten Zeit (${String(stunden).replace('.', ',')} h, ${stundenJeTag} h = 1 Tag) — bitte prüfen.` } : {}),
          });
          id = e.rechnung.id;
          if (!e.vorhanden) erg.entwuerfe++;
        } catch (e) {
          await fehlschlag(m, e instanceof Error ? e.message : 'Fehler beim Entwurf.');
          console.warn(`[rechnung] vorbereiten übersprungen (${m.id} ${monat}):`, e instanceof Error ? e.message.slice(0, 120) : e);
          break;
        }
        erg.aufgaben += await vorbereitenAufgabe(m, f, id, heute, tage || undefined);
        await merken(schl, `f:${heute}`);
        await gelungen(m.id);
        plan = await planLaden();
        break; // höchstens EIN Entwurf je Mandat und Lauf
      }
    }
    // ── B: die Einmalposten eines gemischten Angebots (31.10.) — je Zahlung (Rate, Anzahlung/Rest bzw. ganz) EIN Entwurf im fälligen Monat ──
    // Nur, wenn das Mandat den Einmalbetrag NICHT selbst abrechnet (einmaliges Honorar bzw. Raten/Zahlplan am Mandat — dann wie bisher dort).
    // Beendet (02.11., Runde 3): die Zahlungen der Einmalposten laufen nach dem Beenden weiter (wie Raten am Mandat); pausiert nie.
    if ((m.status !== 'aktiv' && m.status !== 'beendet') || m.geloeschtAm || m.honorar?.basis === 'einmalig' || zahlplanMonate(m)) continue;
    const angebote = (crm.angebote ?? []).filter(a => a.status === 'angenommen' && !a.geloeschtAm && mandatZumAngebot(crm.mandate, a)?.id === m.id && angebotEinmalRest(a, crm.leistungen).length);
    einmal: for (const a of angebote) {
      const zahlungen = einmalZahlungen(a, m).filter(z => z.monat >= abMonat && z.monat <= heute.slice(0, 7));
      if (!zahlungen.length) continue;
      const erledigt = (await kreislaufLaden()).vorbereiten?.erledigt ?? {};
      const fest = einmalRechnungId(a.id);
      for (const z of zahlungen) {
        const schl = einmalSchluessel(m.id, a.id, z.nr);
        const stand = erledigt[schl];
        if (stand?.startsWith('f:')) continue;
        const teil = z.von > 1 ? einmalRateRechnungId(a.id, z.nr) : fest;
        // Von Hand schon da (die Rechnung über alle Einmalposten bzw. genau diese Zahlung) — nichts vorbereiten, nur merken.
        const schon = plan.rechnungen.some(r => (r.id === fest || r.id === teil) && r.status !== 'storniert');
        if (!stand && schon) { await merken(schl, `f:${heute}`); continue; }
        if (!stand) await merken(schl, `r:${heute}`);
        let id: string;
        try {
          const e = await entwurfNeu({ quelle: 'angebot', angebotId: a.id, nur: 'einmalig', ...(z.von > 1 ? { rate: z.nr } : {}), person: 'system', haushalt, sicht: 'privat', wer: { art: 'system' }, jetzt });
          id = e.rechnung.id;
          if (!e.vorhanden) erg.entwuerfe++;
        } catch (e) {
          await fehlschlag(m, e instanceof Error ? e.message : 'Fehler beim Entwurf der Einmalposten.');
          console.warn(`[rechnung] Einmalposten übersprungen (${m.id} ${z.nr}):`, e instanceof Error ? e.message.slice(0, 120) : e);
          break einmal;
        }
        erg.aufgaben += await einmalAufgabe(m, a.id, z, id, heute);
        await merken(schl, `f:${heute}`);
        plan = await planLaden();
        break einmal; // höchstens EIN Entwurf der Einmalposten je Mandat und Lauf
      }
    }
  }
  return erg;
}

/** Was die Aufgabe nennt (ohne Betrag/Namen): Zahlung bzw. Zeitraum. */
function aufgabeWas(m: import('@/lib/crm/typen').Mandat, f: VorbereitenFaellig): { kurz: string; lang: string } {
  if (f.art === 'rate') {
    const rate = rateNummer(m, f.monat);
    if (rate) return { kurz: `Rate ${rate.nr} von ${rate.von}`, lang: `Rate ${rate.nr} von ${rate.von}, ${monatsName(f.monat)}` };
  }
  if (f.art === 'quartal') { const q = quartalMonate(f.monat); return { kurz: `${monatsName(q[0])} bis ${monatsName(q[2])}`, lang: `Quartal ${monatsName(q[0])} bis ${monatsName(q[2])}` }; }
  if (f.art === 'einmalig') return { kurz: 'einmaliges Honorar', lang: `einmaliges Honorar, Beginn ${monatsName(f.monat)}` };
  if (f.art === 'tag') return { kurz: `${monatsName(f.monat)} (Tage)`, lang: `Tage im ${monatsName(f.monat)}` };
  return { kurz: monatsName(f.monat), lang: `Leistungsmonat ${monatsName(f.monat)}` };
}

/** Eine Aufgabe „Rechnung prüfen & stellen“ über den EINEN Server-Schreibweg (feste Kennung — gibt es sie schon, auch erledigt/im Papierkorb, passiert nichts). */
async function aufgabeAnlegen(m: import('@/lib/crm/typen').Mandat, tid: string, titel: string, beschreibung: string, notiz: string, heute: string): Promise<number> {
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const { BEIDE } = await import('@/lib/crm/team');
  const bereich = bereichVon(m.gesellschaft);
  const jetzt = new Date().toISOString();
  let neu = 0;
  await systemAufgabenAendern(stand => {
    if (stand.tasks.some(t => t.id === tid)) return {};
    neu = 1;
    return {
      neu: [{
        id: tid, title: titel, description: beschreibung, notiz,
        status: 'todo', priority: 'medium', assignee: m.zustaendig && m.zustaendig !== BEIDE ? m.zustaendig : 'both', dueDate: heute,
        tags: ['rechnung'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
        space: bereich, ...(istGesellschaft(m.gesellschaft) ? { spaceId: m.gesellschaft } : {}),
      }],
    };
  }, { jetzt });
  return neu;
}

const entwurfLink = (m: import('@/lib/crm/typen').Mandat, rechnungId: string) => `[Entwurf öffnen](${WEG.rechnungSchreiben(rechnungId, WEG.mandat(m.id), bereichVon(m.gesellschaft) === 'privat' ? 'privat' : 'business')}) · [Mandat](${WEG.mandat(m.id)})`;

/** Die Aufgabe „Rechnung prüfen & stellen“ zum Honorar (feste Kennung `rv-<mandat>-<monat>`, idempotent). Ohne Entwurf (Tagessatz ohne Zeit): nur der Hinweis. */
async function vorbereitenAufgabe(m: import('@/lib/crm/typen').Mandat, f: VorbereitenFaellig, rechnungId: string | null, heute: string, tage?: number): Promise<number> {
  const was = aufgabeWas(m, f);
  if (!rechnungId) {
    return aufgabeAnlegen(m, vorbereitenAufgabeId(m.id, f.monat), `Rechnung prüfen & stellen — ${was.kurz}`,
      `Für ${monatsName(f.monat)} ist am Mandat keine Zeit erfasst — darum liegt kein Entwurf bereit. Die Tage in der Mandatsakte eintragen und die Rechnung dort schreiben (bzw. Zeit nachtragen). MAKE OS stellt nichts selbst.`,
      `[Mandat](${WEG.mandat(m.id)})`, heute);
  }
  const zusatz = tage ? ` ${String(tage).replace('.', ',')} Tage aus der erfassten Zeit — Menge bitte prüfen.` : '';
  return aufgabeAnlegen(m, vorbereitenAufgabeId(m.id, f.monat), `Rechnung prüfen & stellen — ${was.kurz}`,
    `Der Entwurf aus dem Mandat liegt bereit (${was.lang}).${zusatz} Prüfen und per Klick stellen — MAKE OS stellt nichts selbst.`, entwurfLink(m, rechnungId), heute);
}

/** Die Aufgabe zu einer Zahlung der Einmalposten (feste Kennung `rve-…`, idempotent). */
async function einmalAufgabe(m: import('@/lib/crm/typen').Mandat, angebotId: string, z: EinmalZahlung, rechnungId: string, heute: string): Promise<number> {
  const was = z.von > 1 ? `Einmalposten, ${einmalZahlungText(z)}` : 'Einmalposten';
  return aufgabeAnlegen(m, einmalAufgabeId(m.id, angebotId, z.nr), `Rechnung prüfen & stellen — ${was}`,
    `Der Entwurf über die Einmalposten des angenommenen Angebots liegt bereit (${was}, ${monatsName(z.monat)}). Die laufende Leistung rechnet das Mandat monatlich ab. Prüfen und per Klick stellen — MAKE OS stellt nichts selbst.`,
    entwurfLink(m, rechnungId), heute);
}

// ── Laufzeit abgelaufen (Morgenlauf, 02.11., Prüfung C) ──────────────────────────────────────────────────────────────────────────────

/**
 * Morgenlauf: je AKTIVEM Mandat, dessen Laufzeit vorbei ist, ohne dass jemand verlängert oder beendet hat (`laufzeitAbgelaufen`), EINE Aufgabe
 * „Laufzeit abgelaufen — verlängern oder beenden“ (feste Kennung je Mandat und Ende, `laufzeitAufgabeId`; gibt es sie schon — auch erledigt oder im
 * Papierkorb —, passiert nichts). Steht an/Glocke leiten dasselbe ohne Speichern ab (lib/heute/anstehend.ts `laufzeitAnstehend`). Wirft nie.
 */
export async function laufzeitAufgabenNachziehen(heute = localDay()): Promise<{ neu: number; fehler?: string }> {
  try {
    const [{ ladeCrm }, { laufzeitAbgelaufen, laufzeitAufgabeId, mandatFristen, LAUFZEIT_ABGELAUFEN }] = await Promise.all([import('@/lib/crm/speicher'), import('@/lib/crm/kunden')]);
    let neu = 0;
    for (const m of (await ladeCrm()).mandate.filter(x => laufzeitAbgelaufen(x, heute))) {
      const ende = mandatFristen(m, heute).endeAm!;
      neu += await aufgabeAnlegen(m, laufzeitAufgabeId(m.id, ende), `Mandat: ${LAUFZEIT_ABGELAUFEN}`,
        `Die Laufzeit endete am ${ende.slice(8, 10)}.${ende.slice(5, 7)}.${ende.slice(0, 4)} — das Mandat ist noch aktiv, entschieden ist nichts. In der Mandatsakte verlängern (neues Ende bzw. automatisch) oder beenden.`,
        `[Mandat](${WEG.mandat(m.id)})`, heute);
    }
    return { neu };
  } catch (e) {
    console.error('[rechnung] Laufzeit-Aufgaben nicht angelegt:', e instanceof Error ? e.message : e);
    return { neu: 0, fehler: 'Laufzeit-Aufgaben nicht angelegt.' };
  }
}
