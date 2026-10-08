// ─── Lese-Protokoll (05.10., Paket „Protokolle nachweisfest“, Art. 5 Abs. 2 / Art. 32 DSGVO) ───────────────────────
// Kevin: „alle Standards der DSGVO, damit wir Kundendaten aufnehmen können.“ Das Änderungsprotokoll zeigt, wer etwas
// GEÄNDERT hat — für besonders schutzwürdige Daten muss sich auch belegen lassen, wer sie GELESEN hat:
//   gesundheit · erholung (Art. 9) · finanzplan · haushalt · rechnungen · kontakte · firmen · gesellschaften · export (05.10.)
//   · inbox (08.10., Lücke 6: Suche, Übergaben, Team-Postfächer — nur Bereich, Anzahl und wessen Post; nie der Suchbegriff)
// Eintrag: Zeit, wer (Person · ZOE im Auftrag · System), Bereich, wessen Daten (`betroffen`, Konto-Speicher — nur bei
// personenbezogenen Bereichen wie Gesundheit), Umfang (`anzahl`) und Kennungen nur als Fingerabdruck (Kontakte `c2#…`,
// sonst `k2#…`, Gesellschafts-/Vertrags-Kennungen bleiben lesbar), dazu der Weg (Pfad OHNE Abfrage — Suchbegriffe können
// Namen tragen). NIE Inhalte, nie Werte.
// Speicher: `leseprotokoll--<haushalt>--<JJJJ-MM>` (Berliner Monat), nur anhängend, mit Hash-Kette (protokoll-kette.ts).
// Aufbewahrung 12 Monate (`LESE_AUFBEWAHRUNG_MONATE`): ältere Monate leert die nächtliche Durchsicht (Vermerk bleibt).
// Gleicher Zugriff derselben Person (Bereich, Betroffene, Weg) wird höchstens alle 10 Minuten notiert — die Seiten fragen
// alle 20–60 s nach; der Nachweis „hat gelesen, ab wann“ bleibt vollständig, das Protokoll wächst nicht ins Unendliche.
// Eingehängt in die GET-Routen über `leseZugriff(req, bereich, …)` — eine Zeile nach der Zugangsprüfung, wirft nie,
// hält die Antwort nicht auf. Ansicht: System › Nachweise (nur der Inhaber, /api/datenschutz/nachweise).

import { promises as fs } from 'fs';
import { loadJson, updateJson, datenOrdner } from './local-db';
import { anhaengenVerkettet, type KettenDatei } from './protokoll-kette';
import { werAus, monatBerlin, protokollKennung, type WerArt } from './aenderungsprotokoll';
import { hmacHex, shaHex } from '@/lib/datenschutz/pepper';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeKonten } from '@/lib/zugang/konten';

export type LeseBereich = 'gesundheit' | 'erholung' | 'finanzplan' | 'haushalt' | 'rechnungen' | 'kontakte' | 'firmen' | 'gesellschaften' | 'export' | 'inbox';
export const LESE_BEREICHE: Record<LeseBereich, { label: string; art9?: true }> = {
  gesundheit: { label: 'Gesundheit', art9: true },
  erholung: { label: 'Erholung', art9: true },
  finanzplan: { label: 'Finanzplan' },
  haushalt: { label: 'Haushalt' },
  rechnungen: { label: 'Rechnungen' },
  kontakte: { label: 'Kontakte' },
  firmen: { label: 'Firmen & CRM' },
  gesellschaften: { label: 'Gesellschafts-Register' },
  // 05.10. (Betroffenenrechte v2): eigene Daten heruntergeladen (`betroffen` = die Person selbst) bzw. die ganze Instanz exportiert (Inhaber).
  export: { label: 'Export (eigene Daten / ganze Instanz)' },
  // 08.10. (Inbox teilen): Suche über die eigene Post, Lesen einer Übergabe bzw. eines Team-Postfachs (`betroffen` = wessen Postfach).
  inbox: { label: 'Inbox (Suche, Übergaben, Team-Postfächer)' },
};
export const istLeseBereich = (b: unknown): b is LeseBereich => typeof b === 'string' && b in LESE_BEREICHE;

export interface LeseEintrag {
  at: string; wer: WerArt; person?: string; bereich: LeseBereich;
  /** Wessen Daten (Konto-Speicher) — nur bei personenbezogenen Bereichen (Gesundheit, Erholung; Inbox: wessen Postfach). */
  betroffen?: string;
  /** Kennungen als Fingerabdruck (höchstens 20). */
  ids?: string[];
  /** Umfang (Zahl der Datensätze), wenn eine ganze Liste gelesen wurde. */
  anzahl?: number;
  /** Pfad der Route ohne Abfrage. */
  weg?: string;
}

export const LESEPROTOKOLL_PRAEFIX = 'leseprotokoll';
export const LESE_AUFBEWAHRUNG_MONATE = 12;
const DROSSEL_MS = 10 * 60_000;
const IDS_MAX = 20;
const PERSON = /^[a-z0-9-]{1,40}$/;
const LESBAR = /^(kdc|kdv|ug|g-[a-z0-9-]{1,60}|vt-[a-z0-9-]{1,62})$/;

export function leseprotokollName(haushalt: string, monat: string): string {
  const h = haushalt.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+/, '') || 'ohne-haushalt';
  if (!/^\d{4}-\d{2}$/.test(monat)) throw new Error(`[leseprotokoll] Monat ungültig: ${monat}`);
  return `${LESEPROTOKOLL_PRAEFIX}--${h}--${monat}`;
}

/** Kennung → Fingerabdruck: Kontakte wie im Änderungsprotokoll (`c2#…`), Gesellschaften lesbar, sonst `k2#…` (HMAC). */
export function leseKennung(id: string): string {
  if (/^c-/.test(id)) return protokollKennung(id);
  if (LESBAR.test(id)) return id;
  const v2 = hmacHex('make-os-leseprotokoll', id);
  return v2 ? `k2#${v2.slice(0, 16)}` : `k#${shaHex(id).slice(0, 12)}`;
}

// ── Drossel und offene Schreibungen (je Prozess) ──────────────────────────────
const zuletzt = new Map<string, number>();
const offen = new Set<Promise<void>>();

/** Nur für Tests: Drossel leeren. */
export function leseDrosselLeeren(): void { zuletzt.clear(); }
/** Auf alle noch laufenden Protokoll-Schreibungen warten (Tests, Abschaltung). */
export async function leseprotokollWarten(): Promise<void> { while (offen.size) await Promise.allSettled(Array.from(offen)); }

export interface LeseOpt { betroffen?: string | null; ids?: readonly string[]; anzahl?: number; jetzt?: Date }

/** Einen Lesezugriff notieren (gedrosselt). Wirft nie. */
export async function protokolliereLesen(req: Request, bereich: LeseBereich, opt: LeseOpt = {}): Promise<void> {
  try {
    const wer = werAus(req);
    const jetzt = opt.jetzt ?? new Date();
    let weg: string | undefined;
    try { weg = new URL(req.url).pathname.slice(0, 80); } catch { weg = undefined; }
    const betroffen = opt.betroffen && PERSON.test(opt.betroffen) ? opt.betroffen : undefined;
    const ids = (opt.ids ?? []).filter(x => typeof x === 'string' && x).slice(0, IDS_MAX).map(leseKennung);
    const schluessel = [wer.art, wer.person ?? '', bereich, betroffen ?? '', weg ?? '', ids.join(',')].join('|');
    const t = jetzt.getTime();
    const vorher = zuletzt.get(schluessel);
    if (vorher !== undefined && t - vorher < DROSSEL_MS) return;
    zuletzt.set(schluessel, t);
    if (zuletzt.size > 5000) for (const [k, z] of zuletzt) if (t - z >= DROSSEL_MS) zuletzt.delete(k);
    const eintrag: LeseEintrag = {
      at: jetzt.toISOString(), wer: wer.art, ...(wer.person ? { person: wer.person } : {}), bereich,
      ...(betroffen ? { betroffen } : {}), ...(ids.length ? { ids } : {}),
      ...(typeof opt.anzahl === 'number' && Number.isFinite(opt.anzahl) ? { anzahl: Math.max(0, Math.round(opt.anzahl)) } : {}),
      ...(weg ? { weg } : {}),
    };
    // In den Haushalt der lesenden Person; ohne Person (Systemlauf) in den des Inhabers.
    const eigener = wer.person ? (await ladeKonten()).konten.find(k => k.speicher === wer.person)?.haushalt : undefined;
    const haushalt = eigener ?? (await haushaltDesInhabers()) ?? 'ohne-haushalt';
    await anhaengenVerkettet(leseprotokollName(haushalt, monatBerlin(jetzt)), [eintrag as unknown as Record<string, unknown>], { jetzt });
  } catch (e) {
    console.error(`[leseprotokoll] ${bereich}: nicht notiert —`, e instanceof Error ? e.message : e);
  }
}

/** Für die Routen: notieren, ohne die Antwort aufzuhalten (eine Zeile nach der Zugangsprüfung). */
export function leseZugriff(req: Request, bereich: LeseBereich, opt: LeseOpt = {}): void {
  const p = protokolliereLesen(req, bereich, opt);
  offen.add(p);
  void p.finally(() => offen.delete(p));
}

/** Die Einträge eines Monats (älteste zuerst). */
export async function leseprotokollMonat(haushalt: string, monat: string): Promise<LeseEintrag[]> {
  const f = await loadJson<KettenDatei>(leseprotokollName(haushalt, monat));
  return (Array.isArray(f?.eintraege) ? f.eintraege : []) as unknown as LeseEintrag[];
}

/** Monat (JJJJ-MM) minus n Monate. */
export function monatMinus(monat: string, n: number): string {
  const [j, m] = monat.split('-').map(Number);
  const z = j * 12 + (m - 1) - n;
  return `${Math.floor(z / 12)}-${String((z % 12) + 1).padStart(2, '0')}`;
}

/**
 * Aufbewahrung: Monate, die vollständig älter als 12 Monate sind, werden geleert (Vermerk `bereinigt` mit Anzahl bleibt,
 * damit Kette und Siegel die Lücke als Löschfrist erkennen). Läuft in der nächtlichen Durchsicht. Liefert die geleerten Namen.
 */
export async function leseprotokollAufraeumen(jetzt = new Date()): Promise<string[]> {
  const grenze = monatMinus(monatBerlin(jetzt), LESE_AUFBEWAHRUNG_MONATE); // dieser Monat und älter → leeren
  const muster = new RegExp(`^${LESEPROTOKOLL_PRAEFIX}--([a-z0-9-]+)--(\\d{4}-\\d{2})\\.json$`);
  const raus: string[] = [];
  for (const d of await fs.readdir(datenOrdner()).catch(() => [] as string[])) {
    const m = muster.exec(d);
    if (!m || m[2] > grenze) continue;
    const name = d.slice(0, -5);
    let n = 0;
    await updateJson<KettenDatei>(name, cur => {
      n = cur?.eintraege?.length ?? 0;
      return n ? { eintraege: [], bereinigt: { am: jetzt.toISOString(), eintraege: n + (cur?.kette?.verworfen ?? 0), grund: `Aufbewahrung ${LESE_AUFBEWAHRUNG_MONATE} Monate (System)` } } : (cur ?? { eintraege: [] });
    });
    if (n) raus.push(name);
  }
  return raus;
}
