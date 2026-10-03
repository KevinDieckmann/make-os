// ─── Firma wechseln (Folgen) und Firmen zusammenführen — die Schreibschritte (Server, 03.10.) ──────────────────
// Die Rechnung steht rein in lib/crm/firma-umhaengen.ts. Hier laufen die Schritte über das Absichtsprotokoll (Art
// `firma-umhaengen`): zwei Bestände nacheinander (CRM und Kartei), jeder Schritt idempotent, abgehakt nach der Wirkung —
// ein Abbruch dazwischen holt die Wiederaufnahme nach (Start, Takt, Durchsicht; lib/store/absichten-fortsetzen.ts).
//
//   folgen    crm (Lead an die neue Firma, offene Deals mit) → kartei (der Lead, der jetzt an der Firma hängt, geht von der
//             Person weg). Die Station der Person selbst ändert die Kartei-Route (`firmaWechsel`) — vorher, mit Stand/409.
//   zusammen  kartei (Stationen weg → behalten) → crm (Verweise umbiegen, Lücken füllen, die andere Firma entfällt).
//             Reihenfolge: nach dem ersten Schritt stehen die Personen bei der behaltenen Firma, die Deals noch bei der
//             anderen — beides gültig; erst der letzte Schritt löscht die Firma.
//
// Nie anfassen, was nicht unser Bestand ist: Hängt an der weggeführten Firma noch etwas außerhalb von Kartei und CRM
// (Aufgaben, Ziele, Zeit, Finanzplan, Dateiablage …), lehnt das Zusammenführen mit Namen der Bestände ab (409).

import { promises as fs } from 'fs';
import { datenOrdner, loadJson } from '@/lib/store/local-db';
import type { Kontakt } from '@/lib/make-one/crm';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { absichtBeginnen, absichtAbschliessen, absichtenLaden, istOffen, mitVorgang, type Absicht, type Vorgang } from '@/lib/store/absichten';
import { aendereKontakte } from './kartei-schreiben';
import { aendereCrm, ladeCrm } from './speicher';
import { karteiHaushalt } from './sperrliste';
import { EINGESCHRAENKT_FEHLER } from './einschraenkung';
import { tagVon } from '@/lib/zeit';
import { firmaFolgenPlan, firmaFolgenCrm, firmaFolgenKartei, firmaZusammenPruefen, firmaZusammenVorschau, firmaZusammenKartei, firmaZusammenCrm, type FolgenEingabe, type FolgenPlan, type ZusammenVorschau } from './firma-umhaengen';

export const FOLGEN_SCHRITTE = ['crm', 'kartei'] as const;
export const FIRMEN_ZUSAMMEN_SCHRITTE = ['kartei', 'crm'] as const;
export const ABSICHT_FIRMA = 'firma-umhaengen' as const;

type KarteiBestand = { kontakte: Kontakt[] };
const kontakteLesen = async () => (await loadJson<KarteiBestand>('kontakte'))?.kontakte ?? [];
const FIRMA_ID = /^f-[a-z0-9-]{2,63}$/;
const KONTAKT_ID = /^c-[a-z0-9-]{4,60}$/;

export type FolgenErgebnis = { ok: true; plan: FolgenPlan } | { ok: false; fehler: string; status: number };

/** Prüfen, ob die Folgen gelten dürfen — ohne zu schreiben. */
async function folgenPruefen(e: FolgenEingabe): Promise<{ fehler: string; status: number } | null> {
  if (!Array.isArray(e.personIds) || !e.personIds.length || e.personIds.some(i => !KONTAKT_ID.test(i))) return { fehler: 'personIds: gültige Kontakt-Kennungen nötig.', status: 400 };
  if (e.personIds.length > 50) return { fehler: 'Höchstens 50 Personen auf einmal.', status: 413 };
  if (!FIRMA_ID.test(e.nach) || (e.von !== undefined && !FIRMA_ID.test(e.von))) return { fehler: 'Firmen-Kennung ungültig.', status: 400 };
  const crm = await ladeCrm();
  if (!crm.firmen.some(f => f.id === e.nach)) return { fehler: 'Die neue Firma gibt es nicht.', status: 404 };
  const kontakte = await kontakteLesen();
  const personen = kontakte.filter(k => e.personIds.includes(k.id));
  if (personen.length !== new Set(e.personIds).size) return { fehler: 'Eine der Personen gibt es nicht.', status: 404 };
  // Art. 18: eine eingeschränkte Person wird nicht verarbeitet — auch ihr Lead nicht umgehängt.
  if (personen.some(k => k.eingeschraenkt)) return { fehler: EINGESCHRAENKT_FEHLER, status: 409 };
  return null;
}

/** Vorschau der Folgen (Dialog „Firma wechseln“) — nur Zahlen und Titel von Deals, nichts wird geschrieben. */
export async function folgenVorschau(e: FolgenEingabe): Promise<FolgenErgebnis> {
  const f = await folgenPruefen(e);
  if (f) return { ok: false, ...f };
  return { ok: true, plan: firmaFolgenPlan(await ladeCrm(), await kontakteLesen(), e) };
}

async function folgenAusfuehren(v: Vorgang, e: FolgenEingabe, person: string, jetzt: string, wer?: Wer): Promise<void> {
  await v.schritt('crm', async () => {
    // Die Kartei wird nur GELESEN (vor der CRM-Sperre, Reihenfolge crm → kontakte); geschrieben wird sie im eigenen Schritt danach.
    const kontakte = await kontakteLesen();
    await aendereCrm(c => firmaFolgenCrm(c, kontakte, e, jetzt, person), wer);
  });
  await v.schritt('kartei', async () => {
    const crm = await ladeCrm();
    await aendereKontakte<KarteiBestand>(cur => ({ ...(cur ?? { kontakte: [] }), kontakte: firmaFolgenKartei(crm, cur?.kontakte ?? [], e, jetzt) }), wer);
  });
}

/** Folgen eines Firmenwechsels anwenden: Lead und offene Deals der Person(en) ziehen zur neuen Firma. Idempotent. */
export async function folgenAnwenden(e: FolgenEingabe, person: string, wer?: Wer): Promise<FolgenErgebnis> {
  const f = await folgenPruefen(e);
  if (f) return { ok: false, ...f };
  const haushalt = await karteiHaushalt();
  const jetzt = new Date().toISOString();
  const kontakte = await kontakteLesen();
  const plan = firmaFolgenPlan(await ladeCrm(), kontakte, e);
  const schluessel = `f:${[...e.personIds].sort().join(',')}>${e.nach}`;
  const { absicht } = await absichtBeginnen(haushalt, { art: ABSICHT_FIRMA, schluessel, schritte: FOLGEN_SCHRITTE, daten: { aktion: 'folgen', eingabe: e, person, jetzt }, person });
  await mitVorgang(haushalt, absicht, v => folgenAusfuehren(v, e, person, jetzt, wer));
  await absichtAbschliessen(haushalt, absicht.id, 'fertig');
  return { ok: true, plan };
}

// ── Zusammenführen ───────────────────────────────────────────────────────────

/** Bestände außerhalb von Kartei und CRM, in denen die Firma noch vorkommt — Namen mit Anzahl. */
const NIE = /^(crm|kontakte|crm-scoring|absichten--.*|kennung-alias--.*|aenderungsprotokoll--.*|zoe-.*|heads?-.*|agent-log|client-fehler|meldungen--.*|crm-import-.*|crm-loeschprotokoll|crm-sperrliste--.*|brain.*|.*-cache|kalender-icloud|kalender-sicherung|hoi-.*|system)$/;
export async function fremdeFirmenVerweise(firmaId: string): Promise<Record<string, number>> {
  const namen = (await fs.readdir(datenOrdner()).catch(() => [] as string[])).filter(n => /^[a-z0-9][a-z0-9-]*\.json$/.test(n)).map(n => n.slice(0, -5)).filter(n => !NIE.test(n)).sort();
  const re = new RegExp(`(?<![A-Za-z0-9_-])${firmaId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`, 'g');
  const raus: Record<string, number> = {};
  for (const n of namen) {
    const cur = await loadJson<unknown>(n).catch(() => null);
    if (cur === null) continue;
    const z = (JSON.stringify(cur).match(re) ?? []).length;
    if (z) raus[n] = z;
  }
  return raus;
}

/** Sprechende Namen für die Bestände in der Ablehnung. */
const BESTAND_NAME: [RegExp, string][] = [[/^tasks/, 'Aufgaben'], [/^ziele|^meilensteine/, 'Ziele'], [/^zeit/, 'Zeit'], [/^finanzplan|^liquiplan/, 'Finanzplan'], [/^crm-dateien/, 'Dateiablage'], [/^kalender/, 'Kalender']];
const bestandText = (n: string) => BESTAND_NAME.find(([re]) => re.test(n))?.[1] ?? n;

export type ZusammenErgebnis = { ok: true; vorschau: ZusammenVorschau } | { ok: false; fehler: string; status: number; fremd?: Record<string, number> };

async function zusammenPruefen(behalten: string, weg: string): Promise<{ fehler: string; status: number; fremd?: Record<string, number> } | null> {
  if (!FIRMA_ID.test(behalten) || !FIRMA_ID.test(weg)) return { fehler: 'Firmen-Kennung ungültig.', status: 400 };
  const crm = await ladeCrm();
  const grund = firmaZusammenPruefen(crm.firmen, behalten, weg);
  if (grund) return { fehler: grund, status: grund.includes('gibt es nicht') ? 404 : 409 };
  const kontakte = await kontakteLesen();
  const betroffen = kontakte.filter(k => k.stationen?.some(s => s.firmaId === weg) || k.firmaId === weg);
  if (betroffen.some(k => k.eingeschraenkt)) return { fehler: `${EINGESCHRAENKT_FEHLER} (eine Person der Firma ist eingeschränkt).`, status: 409 };
  const fremd = await fremdeFirmenVerweise(weg);
  if (Object.keys(fremd).length) return { fehler: `An der zusammenzuführenden Firma hängt noch etwas außerhalb von Kontakten und Deals: ${Object.entries(fremd).map(([n, z]) => `${bestandText(n)} (${z})`).join(', ')}. Dort erst umhängen, dann zusammenführen.`, status: 409, fremd };
  return null;
}

export async function zusammenVorschau(behalten: string, weg: string): Promise<ZusammenErgebnis> {
  const f = await zusammenPruefen(behalten, weg);
  if (f) return { ok: false, ...f };
  const v = firmaZusammenVorschau(await ladeCrm(), await kontakteLesen(), behalten, weg);
  return v ? { ok: true, vorschau: v } : { ok: false, fehler: 'Eine der beiden Firmen gibt es nicht mehr.', status: 404 };
}

async function zusammenAusfuehren(v: Vorgang, behalten: string, weg: string, person: string, jetzt: string, wer?: Wer): Promise<void> {
  await v.schritt('kartei', async () => {
    const crm = await ladeCrm();
    const b = crm.firmen.find(f => f.id === behalten);
    if (!b) return; // schon zusammengeführt (der zweite Lauf) — nichts mehr zu tun
    await aendereKontakte<KarteiBestand>(cur => {
      const liste = cur?.kontakte ?? [];
      // Art. 18 auch IN der Sperre: wurde inzwischen jemand eingeschränkt, bricht der Schritt ab (die Absicht bleibt offen und meldet sich).
      if (liste.some(k => k.eingeschraenkt && (k.firmaId === weg || k.stationen?.some(s => s.firmaId === weg)))) throw new Error('Art. 18: eine Person der Firma ist inzwischen eingeschränkt');
      return { ...(cur ?? { kontakte: [] }), kontakte: firmaZusammenKartei(liste, b, weg, tagVon(jetzt)) };
    }, wer);
  });
  await v.schritt('crm', async () => { await aendereCrm(c => firmaZusammenCrm(c, behalten, weg, jetzt, person), wer); });
}

/** Firmen zusammenführen: Personen, Deals, Mandate, Angebote, Events, Follow-ups wandern zu `behalten`; `weg` entfällt. */
export async function zusammenfuehren(behalten: string, weg: string, person: string, wer?: Wer): Promise<ZusammenErgebnis> {
  const f = await zusammenPruefen(behalten, weg);
  if (f) return { ok: false, ...f };
  const crm = await ladeCrm();
  const vorschau = firmaZusammenVorschau(crm, await kontakteLesen(), behalten, weg);
  if (!vorschau) return { ok: false, fehler: 'Eine der beiden Firmen gibt es nicht mehr.', status: 404 };
  const haushalt = await karteiHaushalt();
  const jetzt = new Date().toISOString();
  const { absicht } = await absichtBeginnen(haushalt, { art: ABSICHT_FIRMA, schluessel: `z:${weg}>${behalten}`, schritte: FIRMEN_ZUSAMMEN_SCHRITTE, daten: { aktion: 'zusammen', behalten, weg, person, jetzt }, person });
  await mitVorgang(haushalt, absicht, v => zusammenAusfuehren(v, behalten, weg, person, jetzt, wer));
  await absichtAbschliessen(haushalt, absicht.id, 'fertig');
  return { ok: true, vorschau };
}

// ── Wiederaufnahme ───────────────────────────────────────────────────────────

/** Eine offene Absicht dieser Art fertigstellen — ab dem ersten nicht abgehakten Schritt (alle Schritte sind idempotent). */
export async function firmaUmhaengenFortsetzen(haushalt: string, a: Absicht): Promise<void> {
  const d = a.daten as { aktion?: string; eingabe?: FolgenEingabe; behalten?: string; weg?: string; person?: string; jetzt?: string };
  const person = d.person ?? 'system', jetzt = d.jetzt ?? new Date().toISOString();
  const wer: Wer = { art: 'system', person };
  if (d.aktion === 'folgen' && d.eingabe) {
    await mitVorgang(haushalt, a, v => folgenAusfuehren(v, d.eingabe!, person, jetzt, wer));
  } else if (d.aktion === 'zusammen' && d.behalten && d.weg) {
    await mitVorgang(haushalt, a, v => zusammenAusfuehren(v, d.behalten!, d.weg!, person, jetzt, wer));
  } else { await absichtAbschliessen(haushalt, a.id, 'verworfen'); return; }
  await absichtAbschliessen(haushalt, a.id, 'fertig');
}

/** Offene Absichten dieser Art (für Tests und Anzeige). */
export async function offeneFirmaAbsichten(): Promise<Absicht[]> {
  return (await absichtenLaden(await karteiHaushalt())).filter(a => a.art === ABSICHT_FIRMA && istOffen(a));
}
