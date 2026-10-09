// ─── Ereignisse — die EINE Schreibstelle und die Lesewege (09.10., E1 „Ereignisstelle“; nur Server) ────────────────────────────
// Speisen NUR über `ereignis(e)`: wirft nie (wie `melde()`), prüft und säubert (nur Kennungen), Dedup über die Kennung IN der Sperre,
// rollend (Frist „ereignisse“ aus der EINEN Fristen-Tabelle), über `EREIGNIS_GRENZEN.bestand` werden neue abgelehnt und gezählt.
// Aufrufer rufen es NACH dem Speichern der Quelle — die Sperre `ereignisse--<haushalt>` ist ein Blatt (darin wird nichts anderes gesperrt).
// Der Haushalt ist der des Inhabers (`karteiHaushalt`): die Quellen (Kartei, CRM, Finanzplan, Aufgaben) gehören ihm.
// Lesen: `ereignisseLaden` (Takt), `geradeGeschrieben` (Power Hour), `seitLetztemLauf` (Heads-Paket), Cursor/Lagebild (`cursorSchreiben`).

import { loadJson, updateJson } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { istEreignisArt } from './arten';
import { EREIGNIS_GRENZEN, LEER, eingabeSauber, ereignisBestand, ereignisseFuer, geradeGeschriebenAus, type Betrachter, type Ereignis, type EreignisBestand, type EreignisEingabe, type KonsumentStand } from './typen';

const HAUSHALT = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Der Haushalt der Ereignisse (des Inhabers). */
export async function ereignisHaushalt(): Promise<string> {
  const { karteiHaushalt } = await import('@/lib/crm/sperrliste');
  const h = await karteiHaushalt();
  return HAUSHALT.test(h) ? h : 'haupt';
}

/** Stichtag der Frist „ereignisse“ (ISO) — ältere Einträge fallen weg. */
async function fristAb(jetzt: Date): Promise<string> {
  const { LOESCHFRISTEN_SPEICHER, fristenWirksam, stichtag } = await import('@/lib/crm/loeschfristen');
  const b = await loadJson<{ fristen?: Record<string, number> }>(LOESCHFRISTEN_SPEICHER).catch(() => null);
  const f = fristenWirksam(b?.fristen ?? null);
  return `${stichtag('ereignisse', f.ereignisse, localDay(jetzt))}T00:00:00.000Z`;
}

const sauber = (b: EreignisBestand | null): EreignisBestand => ({
  v: 1, nr: typeof b?.nr === 'number' ? b.nr : 0, eintraege: Array.isArray(b?.eintraege) ? b!.eintraege : [], cursor: b?.cursor && typeof b.cursor === 'object' ? b.cursor : {},
  ...(b?.lage ? { lage: b.lage } : {}), ...(b?.abgelehnt ? { abgelehnt: b.abgelehnt } : {}),
});

/** Ergebnis von `ereignis()` — nur Zahlen. */
export interface EreignisErgebnis { neu: number; schonDa: number; abgelehnt: number; ungueltig: number }

/**
 * Ereignisse ablegen. Wirft nie. Nach dem Speichern der Quelle aufrufen. Dedup über die Kennung (schon im Bestand → `schonDa`).
 * `opt.haushalt` nur für Tests/Skripte — sonst der Haushalt des Inhabers.
 */
export async function ereignis(e: EreignisEingabe | readonly EreignisEingabe[], opt: { jetzt?: Date; haushalt?: string } = {}): Promise<EreignisErgebnis> {
  const erg: EreignisErgebnis = { neu: 0, schonDa: 0, abgelehnt: 0, ungueltig: 0 };
  try {
    const liste = (Array.isArray(e) ? e : [e]) as readonly EreignisEingabe[];
    if (!liste.length) return erg;
    const jetzt = opt.jetzt ?? new Date();
    const am = jetzt.toISOString();
    const saubere: EreignisEingabe[] = [];
    for (const x of liste) { const s = eingabeSauber(x, istEreignisArt); if (s) saubere.push(s); else erg.ungueltig++; }
    if (erg.ungueltig) console.warn(`[ereignisse] ${erg.ungueltig} ungültige Eingabe(n) verworfen`);
    if (!saubere.length) return erg;
    const haushalt = opt.haushalt && HAUSHALT.test(opt.haushalt) ? opt.haushalt : await ereignisHaushalt();
    const ab = await fristAb(jetzt);
    const heute = localDay(jetzt);
    await updateJson<EreignisBestand>(ereignisBestand(haushalt), cur => {
      erg.neu = 0; erg.schonDa = 0; erg.abgelehnt = 0;
      const b = sauber(cur);
      // Rollend: was vor der Frist liegt, fällt weg (auch ohne Löschfristen-Lauf). Der Cursor bleibt (Nummern laufen weiter).
      const bleibt = b.eintraege.filter(x => x.am >= ab);
      const da = new Set(bleibt.map(x => x.id));
      let nr = b.nr;
      const neu: Ereignis[] = [];
      for (const [i, x] of saubere.entries()) {
        if (da.has(x.id)) { erg.schonDa++; continue; }
        if (i >= EREIGNIS_GRENZEN.jeAufruf || bleibt.length + neu.length >= EREIGNIS_GRENZEN.bestand) { erg.abgelehnt++; continue; }
        da.add(x.id);
        neu.push({ ...x, nr: ++nr, am: x.am && x.am <= am ? x.am : am });
      }
      erg.neu = neu.length;
      if (!neu.length && !erg.abgelehnt && bleibt.length === b.eintraege.length) return cur ?? b;
      const vorher = b.abgelehnt?.tag === heute ? b.abgelehnt.anzahl : 0;
      return { ...b, nr, eintraege: [...bleibt, ...neu], ...(erg.abgelehnt || vorher ? { abgelehnt: { tag: heute, anzahl: vorher + erg.abgelehnt } } : {}) };
    });
    if (erg.abgelehnt) console.error(`[ereignisse] ${erg.abgelehnt} neue Ereignisse abgelehnt (Grenze je Aufruf ${EREIGNIS_GRENZEN.jeAufruf} bzw. Bestand ${EREIGNIS_GRENZEN.bestand}) — nichts gekürzt.`);
  } catch (err) {
    console.warn(`[ereignisse] nicht abgelegt: ${err instanceof Error ? err.message.slice(0, 160) : 'Fehler'}`);
  }
  return erg;
}

/** Den Bestand lesen (leer, wenn es ihn nicht gibt). Wirft bei einem beschädigten Bestand (der Takt wartet dann). */
export async function ereignisseLaden(haushalt?: string): Promise<EreignisBestand> {
  return sauber(await loadJson<EreignisBestand>(ereignisBestand(haushalt ?? await ereignisHaushalt())));
}

/** Cursor und Lagebild nach einer Auswertung festschreiben — nur Konsumenten in `gueltig` behalten (entfernte Skills fallen weg). */
export async function cursorSchreiben(haushalt: string, cursor: Record<string, KonsumentStand>, gueltig: ReadonlySet<string>, lage: NonNullable<EreignisBestand['lage']>): Promise<void> {
  if ((await loadJson<EreignisBestand>(ereignisBestand(haushalt))) === null) return; // nie einen leeren Bestand anlegen
  await updateJson<EreignisBestand>(ereignisBestand(haushalt), cur => {
    const b = sauber(cur);
    const neu: Record<string, KonsumentStand> = {};
    for (const k of gueltig) { const c = cursor[k] ?? b.cursor[k]; if (c) neu[k] = (b.cursor[k]?.nr ?? 0) > c.nr ? b.cursor[k] : c; }
    const gleich = JSON.stringify(neu) === JSON.stringify(b.cursor) && b.lage?.wartend === lage.wartend && b.lage?.gestaut === lage.gestaut && b.lage?.faellig === lage.faellig;
    return gleich ? (cur ?? b) : { ...b, cursor: neu, lage };
  });
}

/** Der Betrachter einer Person (Sichtregel) — aus der EINEN Konto-Sicht des Agenten-Bereichs. null = nicht im Haushalt. */
export async function betrachterFuer(person: string | null | undefined): Promise<Betrachter | null> {
  if (!person) return null;
  const { sichtLaden } = await import('@/lib/agenten/faeden-server');
  const s = await sichtLaden(person).catch(() => null);
  return s?.imHaushalt ? { person, vollesMitglied: s.vollesMitglied, privatFinanzen: s.privatFinanzen } : null;
}

/**
 * Power Hour / „Wer heute dran ist“: Kontakte, die der Person gerade geschrieben haben (eigene Postfächer, geteilte WhatsApp-Nummer —
 * nie fremde Postfächer). Fehler → leer (die Power Hour läuft dann wie bisher).
 */
export async function geradeGeschrieben(person: string | null | undefined, jetzt = new Date()): Promise<Set<string>> {
  try {
    const b = await betrachterFuer(person);
    if (!b) return new Set();
    return geradeGeschriebenAus((await ereignisseLaden()).eintraege, b, jetzt);
  } catch { return new Set(); }
}

/**
 * Heads-Paket „seit dem letzten Lauf passiert“ (nur Kennungen aus dem Bestand → aufgelöst über die Kartei/das CRM des Pakets): sichtbar für
 * die Person des Laufs (Systemlauf ohne Person: nur Ereignisse ohne Personen-Bindung), nur Business. Fehler → leer.
 */
export async function ereignisseSeit(person: string | null, seit: string, jetzt = new Date()): Promise<Ereignis[]> {
  try {
    const eintraege = (await ereignisseLaden()).eintraege;
    const ab = seit || new Date(jetzt.getTime() - EREIGNIS_GRENZEN.hoechstalterStunden * 3_600_000).toISOString();
    if (!person) return eintraege.filter(e => !e.person && !e.personen && e.bereich === 'business' && e.am > ab && e.art !== 'aufgabe-zoe').sort((a, x) => a.nr - x.nr);
    const b = await betrachterFuer(person);
    return b ? ereignisseFuer(eintraege, b, { seit: ab, bereich: 'business' }).filter(e => e.art !== 'aufgabe-zoe') : [];
  } catch { return []; }
}

/** Löschfristen-Lauf: Einträge vor der Frist entfernen (je Haushalt-Bestand). Liefert die Zahl der entfernten. */
export async function ereignisseFristAnwenden(name: string, jetzt = new Date()): Promise<number> {
  if ((await loadJson<EreignisBestand>(name)) === null) return 0;
  const ab = await fristAb(jetzt);
  let n = 0;
  await updateJson<EreignisBestand>(name, cur => {
    const b = sauber(cur);
    const bleibt = b.eintraege.filter(x => x.am >= ab);
    n = b.eintraege.length - bleibt.length;
    return n ? { ...b, eintraege: bleibt } : (cur ?? b);
  });
  return n;
}

/** Konto löschen: Ereignisse NUR dieser Person fallen weg, aus `personen` wird sie gestrichen (rein). */
export function ereignisseOhnePerson(b: EreignisBestand, speicher: string): { neu: EreignisBestand; n: number } {
  let n = 0;
  const eintraege: Ereignis[] = [];
  for (const e of b.eintraege) {
    if (e.person === speicher) { n++; continue; }
    if (e.personen?.includes(speicher)) {
      n++;
      const rest = e.personen.filter(p => p !== speicher);
      if (!rest.length) continue; // war nur für sie sichtbar
      eintraege.push({ ...e, personen: rest });
      continue;
    }
    eintraege.push(e);
  }
  return { neu: n ? { ...b, eintraege } : b, n };
}

/** Lagebild für den Head of IT (nur Zahlen): Ereignisse der letzten 24 h, wartend/gestaut (aus dem letzten Takt), heute abgelehnt. */
export interface EreignisLage { letzte24h: number; wartend: number; gestaut: number; abgelehntHeute: number; stand?: string }
export async function ereignisLage(jetzt = new Date()): Promise<EreignisLage | null> {
  const b = await ereignisseLaden().catch(() => null);
  if (!b || (!b.eintraege.length && !b.nr)) return null;
  const ab = new Date(jetzt.getTime() - 24 * 3_600_000).toISOString();
  return {
    letzte24h: b.eintraege.filter(e => e.am >= ab).length,
    wartend: b.lage?.wartend ?? 0, gestaut: b.lage?.gestaut ?? 0,
    abgelehntHeute: b.abgelehnt?.tag === localDay(jetzt) ? b.abgelehnt.anzahl : 0,
    ...(b.lage?.am ? { stand: b.lage.am } : {}),
  };
}

export { LEER };
