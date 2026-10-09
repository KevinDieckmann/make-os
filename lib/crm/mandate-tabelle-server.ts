// ─── Mandate als Tabelle einfügen — Server: Vorschau, Übernehmen, Rückgängig (09.10.) ─────────────────────────────────────────────
// Regeln: lib/crm/mandate-tabelle.ts (rein). Schreibwege (nie daneben):
//   • neue Firmen → `firmaSichern` (der EINE Weg „Firma zu einem Namen“, lib/crm/person-anlegen-server.ts; Papierkorb → zurück),
//   • Mandate     → `aendereCrm` + `wendeCrmAn` (Säuberer, Stand-Prüfung, Regeln, Personen-Schranke, Änderungsprotokoll) — wie PATCH /api/crm/bestand.
// Das Lauf-Protokoll `mandate-tabelle-laeufe` hält NUR Kennungen, Fingerabdrücke und die alten Werte geänderter Zahlenfelder (keine Namen) —
// es wird VOR dem ersten Schreiben angelegt. „Rückgängig“ nimmt nur, was seitdem unverändert ist (Stand gleich, keine Rechnungen/Dateien/
// offenen Follow-ups daran) — Mandate zuerst, danach die vom Lauf angelegten Firmen, wenn nichts mehr an ihnen hängt.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { neueKennung } from '@/lib/kennung';
import { localDay } from '@/lib/zeit';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { kurzHash } from '@/lib/finanzen/kontoauszug/text';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeRegister } from '@/lib/gesellschaften/server';
import { ablageName } from '@/lib/dateien/ablage';
import type { DateiEintrag } from '@/lib/dateien/regeln';
import { kontakteFuerVerarbeitung } from './verarbeitung';
import type { ListenOp } from '@/lib/sync';
import { auswahlAus, datensaetzePruefen, type VorschauAntwort } from '@/lib/tabelle/einfuegen';
import { aendereCrm, ladeCrmMitPapierkorb, wendeCrmAn, type CrmAnwendung } from './speicher';
import { loeschSperren, standVon, type VerweisKontext } from './crm-stand';
import { firmaSichern } from './person-anlegen-server';
import type { CrmBestand } from './typen';
import {
  MANDAT_FELDER, altWerte, mandatEingaben, mandatPlan, mandatTeil, mandatVorschauZeilen, neuesMandat,
  type GesellschaftKurz, type MandatLauf, type MandatPlanZeile,
} from './mandate-tabelle';

export const MANDAT_LAEUFE = 'mandate-tabelle-laeufe';
/**
 * Inhalt eines Eintrags ohne die Zeitmarken (`geaendert`, `geaendertVon` setzt jeder Schreibvorgang) — „unverändert“ heißt für Rückgängig:
 * derselbe Inhalt. So nimmt Rückgängig von Lauf 1 auch zurück, nachdem Lauf 2 schon zurückgenommen ist (Werte gleich, Zeitstempel neu).
 */
const inhaltVon = (e: object): string => { const { geaendert: _g, geaendertVon: _v, ...rest } = e as Record<string, unknown>; return standVon(rest); };
export const LAUF_HALTEN_TAGE = 400;
interface LaeufeDatei { v: 1; laeufe: MandatLauf[] }
const laeufeAus = (d: Partial<LaeufeDatei> | null) => (Array.isArray(d?.laeufe) ? d!.laeufe : []);

async function laeufeAendern(f: (l: MandatLauf[]) => MandatLauf[], jetzt = new Date()): Promise<void> {
  const grenze = jetzt.getTime() - LAUF_HALTEN_TAGE * 864e5;
  await updateJson<LaeufeDatei>(MANDAT_LAEUFE, cur => ({ v: 1, laeufe: f(laeufeAus(cur).map(l => ({ ...l }))).filter(l => l.status === 'laeuft' || Date.parse(l.am) >= grenze) }));
}

/** Die letzten Einfügungen (Kurzform: Kennung, Zeitpunkt, Status, Anzahlen — keine Namen). */
export async function mandatLaeufe(): Promise<{ id: string; am: string; status: MandatLauf['status']; mandate: number; firmen: number }[]> {
  return laeufeAus(await loadJson<LaeufeDatei>(MANDAT_LAEUFE)).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 20)
    .map(l => ({ id: l.id, am: l.am, status: l.status, mandate: l.mandate.length, firmen: l.firmen.length }));
}

export type Fehler = { ok: false; status: 400 | 404 | 409 | 413; fehler: string; vorschau?: VorschauAntwort };

async function registerKurz(): Promise<GesellschaftKurz[]> {
  const h = await haushaltDesInhabers();
  if (!h) return [];
  return ((await ladeRegister(h))?.gesellschaften ?? []).filter(g => !(g as { geloeschtAm?: string }).geloeschtAm).map(g => ({ id: g.id, ...(g.name ? { name: g.name } : {}), ...(g.status ? { status: g.status } : {}) }));
}

interface Vorbereitet { ok: true; crm: CrmBestand; plan: MandatPlanZeile[]; vorschau: VorschauAntwort }

async function vorbereiten(roh: Record<string, unknown>, jetzt: Date): Promise<Vorbereitet | Fehler> {
  const d = datensaetzePruefen(roh.zeilen, MANDAT_FELDER.map(f => f.id));
  if (!d.ok) return { ok: false, status: d.zuGross ? 413 : 400, fehler: d.fehler };
  const [crm, register] = await Promise.all([ladeCrmMitPapierkorb(), registerKurz()]);
  const vorgabe = typeof roh.gesellschaft === 'string' && roh.gesellschaft !== 'offen' ? roh.gesellschaft : null;
  const { eingaben, fehler, hinweise } = mandatEingaben(d.datensaetze, { leistungen: crm.leistungen ?? [], register, vorgabe });
  const { zeilen: plan, doppelt } = mandatPlan(eingaben, crm, localDay(jetzt), jetzt.toISOString());
  // Basis = jede Zeile mit ihrem Ziel (Kennung, Status, Firma) und dem Stand des vorhandenen Mandats — ändert sich etwas davon: 409.
  const basis = `mt-${kurzHash(JSON.stringify(plan.map(z => {
    const da = crm.mandate.find(m => m.id === z.id);
    return [z.id, z.status, z.firma.art, z.firma.firma.id, da ? standVon(da) : ''];
  })))}`;
  return { ok: true, crm, plan, vorschau: { ok: true, zeilen: mandatVorschauZeilen(plan, [...fehler, ...doppelt]), basis, hinweise } };
}

/** Vorschau — schreibt nichts. */
export async function mandateTabelleVorschau(roh: Record<string, unknown>, jetzt = new Date()): Promise<VorschauAntwort | Fehler> {
  const v = await vorbereiten(roh, jetzt);
  return v.ok ? v.vorschau : v;
}

export type Uebernahme = { ok: true; laufId: string | null; neu: number; geaendert: number; firmenNeu: number; text: string; hinweise: string[] } | Fehler;

const anwendungsFehler = (r: CrmAnwendung): string | null =>
  r.konflikte.length ? 'Ein Mandat wurde inzwischen geändert — nichts übernommen, bitte die Vorschau neu laden.'
    : r.abgelehnt?.length ? r.abgelehnt.join(' · ')
    : r.grenze.length ? r.grenze.join(' · ')
    : r.sperren.length ? r.sperren.map(s => s.text).join(' · ')
    : null;

/**
 * Übernehmen — nur mit der `basis` der gesehenen Vorschau (sonst 409 mit der neuen). `auswahl`: nur diese Zeilen (Schlüssel der Vorschau).
 * Erst die Firmen (je Firma ein Mal), dann alle Mandate in EINER Änderung (alles oder nichts).
 */
export async function mandateTabelleUebernehmen(roh: Record<string, unknown>, person: string, wer: Wer, jetzt = new Date()): Promise<Uebernahme> {
  const v = await vorbereiten(roh, jetzt);
  if (!v.ok) return v;
  if (v.vorschau.basis !== roh.basis) return { ok: false, status: 409, fehler: 'Inzwischen hat sich etwas geändert — die Vorschau ist neu geladen, bitte noch einmal prüfen.', vorschau: v.vorschau };
  const auswahl = auswahlAus(roh.auswahl);
  const plan = v.plan.filter(z => (z.status === 'neu' || z.status === 'geaendert') && (!auswahl || auswahl.has(z.schluessel)));
  if (!plan.length) return { ok: true, laufId: null, neu: 0, geaendert: 0, firmenNeu: 0, text: 'Nichts zu übernehmen — alles steht schon so.', hinweise: [] };

  const lauf: MandatLauf = {
    id: neueKennung('mt'), am: jetzt.toISOString(), status: 'laeuft', firmen: [],
    mandate: plan.map(z => ({ id: z.id, neu: z.status === 'neu', ...(z.status === 'geaendert' ? { alt: altWerte(v.crm.mandate.find(m => m.id === z.id)!, z.eingabe) } : {}) })),
  };
  await laeufeAendern(l => [...l, lauf], jetzt);
  const hinweise: string[] = [];

  // 1 · Firmen — je Name einmal über den EINEN Weg (vorhanden → verknüpfen, neu → anlegen, Papierkorb → zurück).
  const firmaFuer = new Map<string, { id: string; name: string }>();
  for (const z of plan.filter(x => x.status === 'neu')) {
    const key = z.firma.firma.id;
    if (firmaFuer.has(key)) continue;
    if (z.firma.art === 'vorhanden') { firmaFuer.set(key, { id: z.firma.firma.id, name: z.firma.firma.name }); continue; }
    const f = await firmaSichern(z.eingabe.kunde, {}, wer);
    if (!f) continue;
    firmaFuer.set(key, { id: f.firma.id, name: f.firma.name });
    if (f.art === 'neu') lauf.firmen.push({ id: f.firma.id });
    if (f.art === 'zurueck') hinweise.push(`Die Firma „${f.firma.name}“ lag im Papierkorb — sie ist zurückgeholt.`);
  }
  await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, firmen: lauf.firmen } : x)), jetzt);

  // 2 · Mandate — eine Änderung über den CRM-Schreibweg. Geänderte nur mit dem Stand der Vorschau (sonst 409, nichts geschrieben).
  const quelle = `Aus Tabelle eingefügt am ${localDay(jetzt).split('-').reverse().join('.')}`;
  const ops: ListenOp[] = plan.map(z => {
    if (z.status === 'neu') return { liste: 'mandate', op: 'upsert', eintrag: neuesMandat(z.id, z.eingabe, firmaFuer.get(z.firma.firma.id) ?? { id: z.firma.firma.id, name: z.firma.firma.name }, quelle) };
    const da = v.crm.mandate.find(m => m.id === z.id)!;
    return { liste: 'mandate', op: 'teil', id: z.id, felder: mandatTeil(z.eingabe) as Record<string, unknown>, stand: standVon(da) };
  });
  const halter: { r?: CrmAnwendung } = {};
  const fertig = await aendereCrm(cur => { halter.r = wendeCrmAn(cur, ops, jetzt.toISOString(), person); return halter.r.bestand; }, wer);
  const grund = anwendungsFehler(halter.r!);
  if (grund) {
    await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status: 'fehlgeschlagen' as const, mandate: [] } : x)), jetzt);
    return { ok: false, status: 409, fehler: `${grund}${lauf.firmen.length ? ` (${lauf.firmen.length} neu angelegte Firma${lauf.firmen.length === 1 ? '' : 'en'} — „Rückgängig“ nimmt sie wieder weg)` : ''}` };
  }
  // Stände danach (Fingerabdruck des gespeicherten Eintrags) — „Rückgängig“ nimmt nur, was seitdem genau so steht.
  const stand = (liste: 'mandate' | 'firmen', id: string) => { const e = (fertig[liste] as unknown as { id: string }[]).find(x => x.id === id); return e ? inhaltVon(e) : undefined; };
  const mandate = lauf.mandate.map(m => ({ ...m, stand: stand('mandate', m.id) }));
  const firmen = lauf.firmen.map(f => ({ ...f, stand: stand('firmen', f.id) }));
  await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status: 'uebernommen' as const, mandate, firmen } : x)), jetzt);
  const neu = plan.filter(z => z.status === 'neu').length, geaendert = plan.length - neu;
  const teile = [neu && `${neu} Mandat${neu === 1 ? '' : 'e'} angelegt`, geaendert && `${geaendert} geändert`, firmen.length && `${firmen.length} Firma${firmen.length === 1 ? '' : 'en'} neu`].filter(Boolean);
  return { ok: true, laufId: lauf.id, neu, geaendert, firmenNeu: firmen.length, text: `${teile.join(' · ')}.`, hinweise: [...(halter.r!.hinweise ?? []), ...hinweise] };
}

async function verweisKontext(): Promise<VerweisKontext> {
  const h = await haushaltDesInhabers();
  return {
    // Löschsperre zählt JEDE Person an der Firma (auch eingeschränkte, Art. 18) — gelesen wird nur gezählt, nie verarbeitet.
    kontakte: await kontakteFuerVerarbeitung({ mitEingeschraenkten: true }),
    rechnungen: (await loadJson<{ rechnungen?: VerweisKontext['rechnungen'] }>('finanzplan'))?.rechnungen ?? [],
    dateien: h ? ((await loadJson<{ eintraege?: DateiEintrag[] }>(ablageName(h)))?.eintraege ?? []) : [],
  };
}

export type Zurueck = { ok: true; mandate: number; firmen: number; konflikte: number; text: string } | Fehler;

/**
 * Eine Änderung über den CRM-Schreibweg (wie PATCH /api/crm/bestand). Fehler (Stand, Regeln, Sperren) → Satz, nichts geschrieben.
 */
async function crmAnwenden(ops: ListenOp[], jetzt: Date, person: string, wer: Wer, kontext: VerweisKontext): Promise<{ bestand: CrmBestand; angewandt: number } | { fehler: string }> {
  const halter: { r?: CrmAnwendung } = {};
  const bestand = await aendereCrm(cur => { halter.r = wendeCrmAn(cur, ops, jetzt.toISOString(), person, kontext); return halter.r.bestand; }, wer);
  const grund = anwendungsFehler(halter.r!);
  return grund ? { fehler: grund } : { bestand, angewandt: halter.r!.angewandt };
}

/**
 * Was der Lauf NEU angelegt hat, ganz entfernen — über den vorgesehenen Weg „sicher statt endgültig“: erst in den Papierkorb (Stand + Sperren
 * wie beim Löschen von Hand), dann endgültig von dort (es war vorher nicht da). Scheitert der zweite Schritt, liegt es im Papierkorb (30 Tage).
 */
async function ganzEntfernen(liste: 'mandate' | 'firmen', eintraege: { id: string; stand: string }[], jetzt: Date, person: string, wer: Wer, kontext: VerweisKontext): Promise<number | { fehler: string }> {
  if (!eintraege.length) return 0;
  const korb = await crmAnwenden(eintraege.map(e => ({ liste, op: 'teil', id: e.id, felder: { geloeschtAm: jetzt.toISOString() }, stand: e.stand })), jetzt, person, wer, kontext);
  if ('fehler' in korb) return korb;
  const weg = await crmAnwenden(eintraege.map(e => ({ liste, op: 'delete', id: e.id })), jetzt, person, wer, kontext);
  return 'fehler' in weg ? eintraege.length : weg.angewandt;
}

/**
 * Rückgängig — nur Unverändertes (gleicher Inhalt) ohne Verweise (Rechnungen, Dateien, offene Follow-ups …): geänderte Mandate bekommen ihre alten
 * Werte, neu angelegte gehen ganz weg; danach die vom Lauf angelegten Firmen, wenn nichts mehr an ihnen hängt. Konflikte bleiben stehen (gezählt).
 */
export async function mandateTabelleZurueck(laufId: unknown, person: string, wer: Wer, jetzt = new Date()): Promise<Zurueck> {
  const lauf = typeof laufId === 'string' ? laeufeAus(await loadJson<LaeufeDatei>(MANDAT_LAEUFE)).find(l => l.id === laufId) : undefined;
  if (!lauf) return { ok: false, status: 404, fehler: 'Diese Einfügung gibt es nicht (mehr).' };
  if (lauf.status === 'zurueckgenommen') return { ok: false, status: 409, fehler: 'Diese Einfügung ist schon zurückgenommen.' };
  if (lauf.status === 'laeuft') return { ok: false, status: 409, fehler: 'Die Übernahme läuft noch — gleich noch einmal versuchen.' };
  const kontext = await verweisKontext();
  let konflikte = 0;

  // 1 · Mandate: geänderte zurück auf die alten Werte, neue ganz weg.
  let crm = await ladeCrmMitPapierkorb();
  const zuruecksetzen: ListenOp[] = [];
  const entfernen: { id: string; stand: string }[] = [];
  for (const m of lauf.mandate) {
    const cur = crm.mandate.find(x => x.id === m.id);
    if (!cur) continue; // schon weg
    if (!m.stand || inhaltVon(cur) !== m.stand || cur.geloeschtAm) { konflikte++; continue; }
    // Der Stand am Op ist der gelesene — ändert jemand zwischen Lesen und Schreiben, lehnt `wendeCrmAn` die Änderung ab (409).
    if (m.neu) {
      if (loeschSperren(crm, [{ liste: 'mandate', op: 'delete', id: m.id }], kontext).length) { konflikte++; continue; }
      entfernen.push({ id: m.id, stand: standVon(cur) });
    } else if (m.alt) zuruecksetzen.push({ liste: 'mandate', op: 'teil', id: m.id, felder: m.alt, stand: standVon(cur) });
  }
  let mandate = 0;
  if (zuruecksetzen.length) {
    const r = await crmAnwenden(zuruecksetzen, jetzt, person, wer, kontext);
    if ('fehler' in r) return { ok: false, status: 409, fehler: `${r.fehler} Nichts zurückgenommen.` };
    mandate += r.angewandt;
  }
  const weg = await ganzEntfernen('mandate', entfernen, jetzt, person, wer, kontext);
  if (typeof weg !== 'number') return { ok: false, status: 409, fehler: `${weg.fehler}${mandate ? ` (${mandate} geänderte Mandate sind schon zurück.)` : ' Nichts zurückgenommen.'}` };
  mandate += weg;

  // 2 · Firmen, die der Lauf angelegt hat — nur unverändert und ohne Verweise (Personen, Deals, Mandate, Rechnungen …).
  crm = await ladeCrmMitPapierkorb();
  const firmenWeg: { id: string; stand: string }[] = [];
  for (const f of lauf.firmen) {
    const cur = crm.firmen.find(x => x.id === f.id);
    if (!cur) continue;
    if (!f.stand || inhaltVon(cur) !== f.stand || cur.geloeschtAm || loeschSperren(crm, [{ liste: 'firmen', op: 'delete', id: f.id }], kontext).length) { konflikte++; continue; }
    firmenWeg.push({ id: f.id, stand: standVon(cur) });
  }
  const fw = await ganzEntfernen('firmen', firmenWeg, jetzt, person, wer, kontext);
  const firmen = typeof fw === 'number' ? fw : 0;
  if (typeof fw !== 'number') konflikte += firmenWeg.length;

  const status: MandatLauf['status'] = konflikte ? 'teilweise' : 'zurueckgenommen';
  await laeufeAendern(l => l.map(x => (x.id === lauf.id ? { ...x, status, zurueck: { am: jetzt.toISOString(), mandate: (x.zurueck?.mandate ?? 0) + mandate, firmen: (x.zurueck?.firmen ?? 0) + firmen, konflikte } } : x)), jetzt);
  const teile = [`${mandate} Mandat${mandate === 1 ? '' : 'e'} zurückgenommen`, firmen ? `${firmen} Firma${firmen === 1 ? '' : 'en'} entfernt` : '', konflikte ? `${konflikte} seitdem geändert oder in Gebrauch — stehen gelassen` : ''].filter(Boolean);
  return { ok: true, mandate, firmen, konflikte, text: `${teile.join(' · ')}.` };
}
