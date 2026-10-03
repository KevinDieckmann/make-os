// ─── Netzwerken — Löschfristen der Erfassungs-Daten (03.10., Paket „netz-recht“) ───
// Was beim Kennenlernen entsteht, soll nicht länger liegen als nötig (Art. 5 Abs. 1 lit. c, e DSGVO):
//   · Kartenfoto            6 Monate nach der Erfassung — die Felder stehen in der Kartei, das Foto war nur die Vorlage (FristArt `netzwerken-karten`)
//   · Sprachnotiz           90 Tage — Gesprächsnotiz mit Stimme eines Menschen; eine Abschrift ersetzt sie (FristArt `netzwerken-sprachnotizen`)
//   · Gesprächs-Info        12 Monate nach dem Event: `Teilnahme.netzwerken.info` (und die Kopie in `Teilnahme.notiz`), Zielpersonen (Personen)
//                           der besuchten Events (FristArt `netzwerken-info`); Firmen auf der Zielliste sind keine Personen und bleiben
//   · Kontakte ohne Zug     12 Monate ohne jede weitere Interaktion → PRÜF-AUFGABE (nie automatisch löschen; FristArt `netzwerken-kontakte`,
//                           dasselbe Muster wie „Kontakte über der Löschfrist“ in lib/crm/loeschfristen-lauf.ts)
//   · Übergabe-Protokolle   36 Monate (FristArt `uebergabe-protokolle`, Event + Journal)
// Medien, Info und Protokolle werden automatisch bereinigt (technische Bestände, wie Signal-Texte); Personen nie.
// Reine Funktionen hier, Wirkung auf die Platte in `netzwerkenMedienAufraeumen` / dem Löschfristen-Lauf.

import { promises as fs } from 'fs';
import { datenOrdner, loadJson } from '@/lib/store/local-db';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import type { Kontakt } from '@/lib/make-one/crm';
import type { CrmBestand } from './typen';
import { kontakteUeberFrist, type UeberFrist } from './loeschfristen';
import { LABEL_NETZWERKEN, NETZWERKEN_QUELLE } from './netzwerken';
import { istNetzwerkenPerson } from './netzwerken-recht';

/** Ein von „Netzwerken“ abgelegtes Kartenfoto? (Titel `Visitenkarte n/m · <Erfassung>`, Notiz „Netzwerken bei …“, am Kontakt, nie ein Beleg.) */
export const istKartenfoto = (e: Pick<DateiEintrag, 'titel' | 'notiz' | 'kontaktId'>): boolean => !!e.kontaktId && /^Visitenkarte \d+\/\d+ · [0-9a-f]{8}$/.test(e.titel ?? '') && (e.notiz ?? '').startsWith('Netzwerken bei');
/** Eine von „Netzwerken“ abgelegte Sprachnotiz? */
export const istSprachnotiz = (e: Pick<DateiEintrag, 'titel' | 'notiz' | 'kontaktId'>): boolean => !!e.kontaktId && /^Sprachnotiz · [0-9a-f]{8}$/.test(e.titel ?? '') && (e.notiz ?? '').startsWith('Sprachnotiz bei');

const ABLAGE = /^crm-dateien--([a-z0-9][a-z0-9-]{0,39})\.json$/;
const tagVonIso = (v?: string) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

/**
 * Abgelaufene Kartenfotos und Sprachnotizen aller Haushalte entfernen (Eintrag + verschlüsselte Datei, über die Ablage — die prüft Belege).
 * `grenzeKarten`/`grenzeSprache`: Tage (YYYY-MM-DD); Einträge, die VOR der Grenze hochgeladen wurden, fallen weg. Liefert die Zahlen.
 * Ein Fehler bei einer Datei hält die übrigen nicht auf (Log).
 */
export async function netzwerkenMedienAufraeumen(grenzeKarten: string, grenzeSprache: string): Promise<{ karten: number; sprachnotizen: number }> {
  const { entfernen } = await import('@/lib/dateien/ablage');
  const namen = await fs.readdir(datenOrdner()).catch(() => [] as string[]);
  let karten = 0, sprachnotizen = 0;
  for (const h of namen.map(n => ABLAGE.exec(n)?.[1]).filter((x): x is string => !!x).sort()) {
    const l = (await loadJson<{ eintraege?: DateiEintrag[] }>(`crm-dateien--${h}`))?.eintraege ?? [];
    const weg = l.filter(e => { const t = tagVonIso(e.hochgeladenAm); return !!t && ((istKartenfoto(e) && t < grenzeKarten) || (istSprachnotiz(e) && t < grenzeSprache)); });
    for (const e of weg) {
      try { if (await entfernen(h, e.id)) { if (istKartenfoto(e)) karten++; else sprachnotizen++; } }
      catch (err) { console.error('[loeschfristen] Netzwerken-Medium nicht entfernt:', err instanceof Error ? err.message : err); }
    }
  }
  return { karten, sprachnotizen };
}

/**
 * Gesprächs-Info und Zielpersonen alter Events bereinigen (rein): Events, deren Datum VOR `grenze` liegt.
 * `Teilnahme.netzwerken.info` fällt weg, ebenso die Kopie in `Teilnahme.notiz` (nur, wenn sie genau die Info ist — eine selbst geschriebene Notiz bleibt),
 * von den Zielpersonen gehen die PERSONEN weg (Firmen bleiben). Liefert denselben Bestand (===), wenn nichts zu tun war.
 */
export function infoBereinigen(crm: CrmBestand, grenze: string): { crm: CrmBestand; info: number; ziele: number } {
  const alt = new Set((crm.events ?? []).filter(e => e.datum < grenze).map(e => e.id));
  let info = 0, ziele = 0;
  const teilnahmen = (crm.teilnahmen ?? []).map(t => {
    if (!alt.has(t.eventId) || !t.netzwerken?.info) return t;
    info++;
    const { info: i, ...nw } = t.netzwerken;
    const { notiz, ...ohneNotiz } = t;
    return { ...(notiz && notiz !== i.slice(0, 1500) ? t : ohneNotiz), netzwerken: nw };
  });
  const events = (crm.events ?? []).map(e => {
    if (!alt.has(e.id) || !e.zielpersonen?.some(z => z.kontaktId)) return e;
    const rest = e.zielpersonen.filter(z => !z.kontaktId);
    ziele += e.zielpersonen.length - rest.length;
    const { zielpersonen: _weg, ...ohne } = e;
    return rest.length ? { ...e, zielpersonen: rest } : ohne;
  });
  if (!info && !ziele) return { crm, info: 0, ziele: 0 };
  return { crm: { ...crm, teilnahmen: info ? teilnahmen : crm.teilnahmen, events: ziele ? events : crm.events }, info, ziele };
}

/** Übergabe-Protokolle (Event.uebergaben) älter als die Grenze entfernen (rein; ===, wenn nichts zu tun war). */
export function protokolleBereinigen(crm: CrmBestand, grenze: string): { crm: CrmBestand; n: number } {
  let n = 0;
  const events = (crm.events ?? []).map(e => {
    if (!e.uebergaben?.some(u => u.am.slice(0, 10) < grenze)) return e;
    const rest = e.uebergaben.filter(u => u.am.slice(0, 10) >= grenze);
    n += e.uebergaben.length - rest.length;
    const { uebergaben: _weg, ...ohne } = e;
    return rest.length ? { ...e, uebergaben: rest } : ohne;
  });
  return n ? { crm: { ...crm, events }, n } : { crm, n: 0 };
}

/** Eine Person aus „Netzwerken“ (Label oder Quelle) — auch Altbestand vor dem Verweis auf die Interessenabwägung. */
export const istAusNetzwerken = (k: Pick<Kontakt, 'labels' | 'quelle' | 'rechtsgrundlageNotiz'>): boolean => istNetzwerkenPerson(k) || (k.labels ?? []).includes(LABEL_NETZWERKEN) || k.quelle === NETZWERKEN_QUELLE;

/**
 * Netzwerken-Personen ohne jede weitere Interaktion seit `monate` (12): dieselbe Regel wie „Kontakte über der Löschfrist“ (keine Beziehung,
 * kein Mandat/Deal, nicht eingeschränkt, keine Fristverlängerung; die letzte Spur zählt) — nur auf die Personen aus „Netzwerken“ und
 * mit der kürzeren Frist. Wer schon in der 24-Monats-Liste steht (`schon`), zählt nicht doppelt.
 */
export function netzwerkenKontakteUeberFrist(kontakte: Kontakt[], crm: Pick<CrmBestand, 'mandate' | 'chancen'> | null | undefined, heute: string, monate: number, schon: ReadonlySet<string> = new Set()): UeberFrist[] {
  return kontakteUeberFrist(kontakte.filter(istAusNetzwerken), crm, heute, monate).filter(x => !schon.has(x.id));
}
