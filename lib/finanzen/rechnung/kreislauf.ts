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
// Merker und Stellschraube liegen im Bestand `rechnungswesen` (Feld `kreislauf`, optional — nur Kennungen, keine Personen).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { bereichVon, finanzFirmaFuer, istGesellschaft } from '@/lib/einheiten';
import { WEG } from '@/lib/wege';
import { sauberFile, type FinanzplanFile, type Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { abgerechneteMonate, monatsName } from './regeln';
import { istMahnAufgabeVon, rateNummer, vorbereitenAbMonat, rechnungFuerMonat, ueberfaelligFrisch, vorbereitenAufgabeId, vorbereitenMonate, vorbereitenSchluessel } from './kreislauf-regeln';

/** Der Teil des Bestands `rechnungswesen`, den der Kreislauf führt (additiv — alte Stände kennen ihn nicht). */
export interface KreislaufStand {
  vorbereiten?: {
    /** Stellschraube „Rechnungen vorbereiten“ — fehlt = an. */
    an?: boolean;
    /** Tag des ersten Laufs (JJJJ-MM-TT): Monate davor bekommen nie einen Entwurf. */
    ab?: string;
    /** Je `<mandat>|<monat>`: `r:<tag>` reserviert (Entwurf/Aufgabe noch nicht sicher da), `f:<tag>` fertig — dann nie wieder. */
    erledigt?: Record<string, string>;
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

export interface VorbereitenErgebnis { aus?: true; entwuerfe: number; aufgaben: number; uebersprungen: number; ab?: string }

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
  const erg: VorbereitenErgebnis = { entwuerfe: 0, aufgaben: 0, uebersprungen: 0, ab };
  const merken = async (schluessel: string, wert: string) => {
    await updateJson<RW>(RECHNUNGSWESEN, cur => {
      const v = cur?.kreislauf?.vorbereiten ?? {};
      return { ...(cur ?? {}), kreislauf: { ...(cur?.kreislauf ?? {}), vorbereiten: { ...v, erledigt: { ...(v.erledigt ?? {}), [schluessel]: wert } } } };
    });
  };
  for (const m of crm.mandate) {
    const g = m.gesellschaft;
    // Rechnungsfähig wie der Knopf in der Mandatsakte: Gesellschaft gewählt und im Finanzplan geführt (Register-Gesellschaften: nur Grunddaten).
    if (mandatGesellschaftOffen(g) || !finanzFirmaFuer(g)) continue;
    const monate = vorbereitenMonate(m, heute, abgerechneteMonate(m.id, plan.rechnungen), abMonat);
    if (!monate.length) continue;
    const erledigt = (await kreislaufLaden()).vorbereiten?.erledigt ?? {};
    for (const monat of monate) {
      const schl = vorbereitenSchluessel(m.id, monat);
      const stand = erledigt[schl];
      if (stand?.startsWith('f:')) continue;
      // Von Hand schon angelegt (Entwurf oder Rechnung) — nichts vorbereiten, nur merken.
      if (!stand && rechnungFuerMonat(plan.rechnungen, m.id, monat)) { await merken(schl, `f:${heute}`); continue; }
      // Reservieren VOR dem Schreiben: bricht der Lauf ab, holt der nächste Entwurf (idempotent) und Aufgabe (feste Kennung) nach.
      if (!stand) await merken(schl, `r:${heute}`);
      let id: string;
      try {
        const e = await entwurfNeu({ quelle: 'mandat', mandatId: m.id, monat, person: 'system', haushalt, sicht: 'privat', wer: { art: 'system' }, jetzt });
        id = e.rechnung.id;
        if (!e.vorhanden) erg.entwuerfe++;
      } catch (e) {
        erg.uebersprungen++;
        console.warn(`[rechnung] vorbereiten übersprungen (${m.id} ${monat}):`, e instanceof Error ? e.message.slice(0, 120) : e);
        break;
      }
      erg.aufgaben += await vorbereitenAufgabe(m, monat, id, heute);
      await merken(schl, `f:${heute}`);
      plan = await planLaden();
      break; // höchstens EIN Entwurf je Mandat und Lauf
    }
  }
  return erg;
}

/** Die Aufgabe „Rechnung prüfen & stellen“ (feste Kennung, idempotent — gibt es sie schon, auch erledigt/im Papierkorb, passiert nichts). Titel ohne Betrag/Namen. */
async function vorbereitenAufgabe(m: import('@/lib/crm/typen').Mandat, monat: string, rechnungId: string, heute: string): Promise<number> {
  const { systemAufgabenAendern } = await import('@/lib/aufgaben/system-schreiben');
  const { BEIDE } = await import('@/lib/crm/team');
  const tid = vorbereitenAufgabeId(m.id, monat);
  const rate = rateNummer(m, monat);
  const bereich = bereichVon(m.gesellschaft);
  const jetzt = new Date().toISOString();
  let neu = 0;
  await systemAufgabenAendern(stand => {
    if (stand.tasks.some(t => t.id === tid)) return {};
    neu = 1;
    return {
      neu: [{
        id: tid, title: `Rechnung prüfen & stellen — ${rate ? `Rate ${rate.nr} von ${rate.von}` : monatsName(monat)}`,
        description: `Der Entwurf aus dem Mandat liegt bereit (${rate ? `Rate ${rate.nr} von ${rate.von}, ${monatsName(monat)}` : `Leistungsmonat ${monatsName(monat)}`}). Prüfen und per Klick stellen — MAKE OS stellt nichts selbst.`,
        notiz: `[Entwurf öffnen](${WEG.rechnungSchreiben(rechnungId, WEG.mandat(m.id), bereich === 'privat' ? 'privat' : 'business')}) · [Mandat](${WEG.mandat(m.id)})`,
        status: 'todo', priority: 'medium', assignee: m.zustaendig && m.zustaendig !== BEIDE ? m.zustaendig : 'both', dueDate: heute,
        tags: ['rechnung'], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt,
        space: bereich, ...(istGesellschaft(m.gesellschaft) ? { spaceId: m.gesellschaft } : {}),
      }],
    };
  }, { jetzt });
  return neu;
}
