// ─── Steuern — Laden, Einstellungen, Abhaken, Aufgaben (Server) ─────────────
// Liest nur eure eigenen Speicher: Rechnungen (Finanzplan, ohne Privates),
// die Grundlage (Vorsteuer), die Ist-Monate des Business-Index, die Belege der
// Selbständigkeit/UG aus den Haushaltsfinanzen des Inhabers. Schreibt die
// Einstellungen, das Abhaken und — N Tage vor jeder Frist — eine Aufgabe.

import { loadJson, updateJson } from '@/lib/store/local-db';
import { systemAufgabenAendern } from '@/lib/aufgaben/system-schreiben';
import { ohnePrivatPosten, type Rechnung } from '@/lib/make-one/liquiditaet';
import { lesen, type MalinExport } from '@/lib/make-one/grundlage';
import { ladeHaushalt, patchen } from '@/lib/finanzen/haushalt/speicher';
import { istEchterHaushalt, belegAufgabenAbgleichen } from '@/lib/finanzen/haushalt/aufgaben';
import { EINSTELLUNG_NAME, type ChefEinstellung } from '@/lib/finanzen/chef/stand';
import { haushaltDesInhabers } from '@/lib/zugang/haushalt-inhaber';
import { ladeRoh, bestandFuer } from '@/lib/business/speicher';
import { istMonate } from '@/lib/business/messen';
import { localDay } from '@/lib/zeit';
import { bereichVon, bereichVonFirma, einheitAusGesellschaft, finanzOrtAus, finanzOrtName, istBusinessGesellschaft, istGesellschaft } from '@/lib/einheiten';
import { ladeFinanzplan } from '@/lib/finanzen/plan/speicher';
import { estGemeinsamFuer } from '@/lib/finanzen/est-gemeinsam';
import {
  STANDARD_STEUERN, STEUER_FIRMEN, fristen, zeitraumVon, ustZeitraum, prognose, jahresgewinn, belegPunkte, uebergabeMonat, uebergabeJahr, HINWEIS,
  mitFinanzplanung, steuernNurBusiness,
  type SteuerEinstellungen, type SteuerFirma, type FirmaSteuer, type Frist, type Grundlagenteil,
} from './rechnen';

export const STEUERN = 'steuern';
interface Datei { einstellungen?: Partial<SteuerEinstellungen>; abgehakt?: Record<string, { am: string; von: string }> }

/** Einstellungen — beim ersten Mal aus dem Head of Finance (Rhythmus, Rechtsform), der Grundlage (Hebesatz) und dem Haushalt (Steuerquote). */
export async function ladeSteuerEinstellungen(): Promise<SteuerEinstellungen> {
  const d = await loadJson<Datei>(STEUERN);
  const s = d?.einstellungen;
  if (s) return { ...STANDARD_STEUERN, ...s, kdc: { ...STANDARD_STEUERN.kdc, ...(s.kdc ?? {}) }, kdv: { ...STANDARD_STEUERN.kdv, ...(s.kdv ?? {}) }, privat: { ...STANDARD_STEUERN.privat, ...(s.privat ?? {}) }, vorauszahlung: { ...(s.vorauszahlung ?? {}) }, ruecklageIst: { ...(s.ruecklageIst ?? {}) } };
  const [chef, grund, hh] = await Promise.all([
    loadJson<Partial<ChefEinstellung>>(EINSTELLUNG_NAME).catch(() => null),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
    haushaltDesInhabers().then(h => (h ? ladeHaushalt(h) : null)).catch(() => null),
  ]);
  const rf = (t: string | null | undefined): FirmaSteuer['rechtsform'] | null => (!t ? null : /gmbh/i.test(t) ? 'gmbh' : /ug/i.test(t) ? 'ug' : /frei/i.test(t) ? 'freiberuf' : /einzel|gewerb/i.test(t) ? 'einzel' : null);
  const kdcForm = rf(chef?.rechtsform?.kdc) ?? STANDARD_STEUERN.kdc.rechtsform;
  const kdvForm = rf(chef?.rechtsform?.kdv) ?? STANDARD_STEUERN.kdv.rechtsform;
  const hebesatz = grund?.roh ? lesen(grund.roh, grund.stand).konfiguration.gewerbesteuerHebesatz : STANDARD_STEUERN.hebesatz;
  return {
    ...STANDARD_STEUERN,
    kdc: { ...STANDARD_STEUERN.kdc, rechtsform: kdcForm, ust: chef?.steuer?.ust ?? 'quartal', dauerfrist: !!chef?.steuer?.dauerfrist, gewerbe: kdcForm === 'einzel' || !!chef?.steuer?.gewstVorauszahlung },
    kdv: { ...STANDARD_STEUERN.kdv, rechtsform: kdvForm },
    privat: { estVorauszahlung: chef?.steuer?.estVorauszahlung ?? true },
    hebesatz: hebesatz > 0 ? hebesatz : STANDARD_STEUERN.hebesatz,
    steuerquote: hh?.meta.steuerquote ?? chef?.ruecklageQuote ?? null,
  };
}

/**
 * Einstellungen MIT der Finanzplanung (05.10., EINE Quelle): Rechtsform und Gewerbesteuer der Selbstständigkeit aus deren Steuerprofil —
 * für alle, die Fristen rechnen (Kalender, Lichtfäden), damit die Gewerbesteuer-Fristen der Selbstständigkeit überall gleich erscheinen.
 */
export async function ladeSteuerEinstellungenMitPlan(heute = localDay()): Promise<SteuerEinstellungen> {
  const [e, hh] = await Promise.all([ladeSteuerEinstellungen(), haushaltDesInhabers().catch(() => null)]);
  try {
    const plan = hh ? await ladeFinanzplan(hh) : null;
    return mitFinanzplanung(e, estGemeinsamFuer(plan, Number(heute.slice(0, 4))));
  } catch { return e; }
}

const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);

/** Einstellungen ändern (nur bekannte Felder, geprüft) oder einen Punkt abhaken. */
export async function speichereSteuern(roh: Record<string, unknown>, von: string): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const alt = await ladeSteuerEinstellungen();
  let fehler: string | null = null;
  const neu: SteuerEinstellungen = JSON.parse(JSON.stringify(alt));
  const e = (roh.einstellungen ?? null) as Record<string, unknown> | null;
  if (e) {
    if (typeof e.mitBerater === 'boolean') neu.mitBerater = e.mitBerater;
    for (const f of STEUER_FIRMEN) {
      const x = e[f] as Partial<FirmaSteuer> | undefined;
      if (!x) continue;
      if (x.rechtsform && ['freiberuf', 'einzel', 'ug', 'gmbh'].includes(x.rechtsform)) neu[f].rechtsform = x.rechtsform;
      if (x.ust && ['monatlich', 'quartal', 'keine'].includes(x.ust)) neu[f].ust = x.ust;
      for (const k of ['dauerfrist', 'istVersteuerung', 'gewerbe'] as const) if (typeof x[k] === 'boolean') neu[f][k] = x[k] as boolean;
      if (neu[f].rechtsform === 'ug' || neu[f].rechtsform === 'gmbh') neu[f].gewerbe = true;
      if (neu[f].rechtsform === 'freiberuf') neu[f].gewerbe = false;
    }
    const p = e.privat as { estVorauszahlung?: unknown } | undefined;
    if (p && typeof p.estVorauszahlung === 'boolean') neu.privat.estVorauszahlung = p.estVorauszahlung;
    const betrag = (quelle: unknown, ziel: Record<string, number | undefined>, schluessel: string[]) => {
      const r = (quelle ?? {}) as Record<string, unknown>;
      for (const k of schluessel) if (k in r) {
        if (r[k] === null || r[k] === '') { delete ziel[k]; continue; }
        const n = zahl(r[k]);
        if (!Number.isFinite(n) || n < 0 || n > 1e8) { fehler = 'Beträge bitte als Zahl in Euro.'; continue; }
        ziel[k] = Math.round(n * 100) / 100;
      }
    };
    if (e.vorauszahlung) betrag(e.vorauszahlung, neu.vorauszahlung as Record<string, number | undefined>, ['est', 'kst', 'gewstKdc', 'gewstKdv']);
    if (e.ruecklageIst) betrag(e.ruecklageIst, neu.ruecklageIst as Record<string, number | undefined>, ['kdc', 'kdv', 'ug', 'privat']);
    if ('steuerquote' in e) {
      if (e.steuerquote === null || e.steuerquote === '') neu.steuerquote = null;
      else { const n = zahl(e.steuerquote); if (!Number.isFinite(n) || n < 0 || n > 60) fehler = 'Steuerquote bitte zwischen 0 und 60 %.'; else neu.steuerquote = Math.round(n * 10) / 10; }
    }
    if ('hebesatz' in e) { const n = zahl(e.hebesatz); if (!Number.isFinite(n) || n < 200 || n > 1000) fehler = 'Hebesatz bitte zwischen 200 und 1000 %.'; else neu.hebesatz = Math.round(n); }
    if ('vorlaufTage' in e) { const n = zahl(e.vorlaufTage); if (!Number.isFinite(n) || n < 1 || n > 60) fehler = 'Vorlauf bitte 1 bis 60 Tage.'; else neu.vorlaufTage = Math.round(n); }
  }
  if (fehler) return { ok: false, fehler };
  // Beleg der Selbständigkeit/UG erledigt (nachgereicht bzw. bezahlt) — direkt von der Steuer-Seite.
  const be = roh.belegErledigt as { id?: unknown; stand?: unknown } | undefined;
  if (be) {
    const hh = await haushaltDesInhabers();
    if (!hh) return { ok: false, fehler: 'Kein Haushalt des Inhabers.' };
    const b = (await ladeHaushalt(hh)).belege.find(x => x.id === be.id && x.einheit !== 'privat');
    if (!b) return { ok: false, fehler: 'Beleg nicht gefunden.' };
    if (typeof be.stand === 'number' && be.stand !== b.stand) return { ok: false, fehler: 'Der Beleg wurde inzwischen geändert — bitte neu laden.' };
    const r = await patchen(hh, 'belege', [{ op: 'upsert', stand: b.stand, eintrag: { ...b, erledigt: true, ...(b.art === 'rechnung' && !b.bezahlt_am ? { bezahlt_am: localDay() } : {}) } as unknown as Record<string, unknown> }]);
    if (!r.ok) return { ok: false, fehler: r.fehler };
    await belegAufgabenAbgleichen(hh).catch(() => null);
    return { ok: true };
  }
  const ab = roh.abhaken as { key?: unknown; an?: unknown } | undefined;
  if (ab && (typeof ab.key !== 'string' || !/^(m:\d{4}-\d{2}|j:\d{4}|f:[a-z0-9-]+):?[a-z0-9-]*$/.test(ab.key))) return { ok: false, fehler: 'Unbekannter Punkt.' };
  await updateJson<Datei>(STEUERN, d => {
    const x: Datei = { ...(d ?? {}) };
    if (e) x.einstellungen = neu;
    if (ab) {
      const h = { ...(x.abgehakt ?? {}) };
      if (ab.an === false) delete h[ab.key as string]; else h[ab.key as string] = { am: new Date().toISOString(), von };
      x.abgehakt = h;
    }
    return x;
  });
  return { ok: true };
}

/**
 * Alles für die Steuer-Seite. `bereich` (05.10.): „privat“ = alles (Privat, Selbstständigkeit und die Gesellschaften — Privat sieht
 * Business), „business“ = nur die Business-Gesellschaften (Rechnungen, Belege und Übergabe schon an der Quelle gefiltert, der Rest über
 * `steuernNurBusiness`). `alleFristen` sind immer ALLE Fristen — nur für den Aufgaben-Abgleich, nie für die Antwort.
 * Einkommensteuer und Gewerbesteuer der Selbstständigkeit kommen aus der Finanzplanung (`estGemeinsamFuer`, EINE Rechenquelle).
 */
export async function steuernStand(heute = localDay(), bereich: 'privat' | 'business' = 'privat') {
  const [e0, d, fp, grund, roh, hhId, buch] = await Promise.all([
    ladeSteuerEinstellungen(),
    loadJson<Datei>(STEUERN),
    loadJson<{ rechnungen?: (Rechnung & { firmaId?: string })[] }>('finanzplan'),
    loadJson<{ roh: MalinExport; stand: string }>('grundlage'),
    ladeRoh(heute),
    haushaltDesInhabers(),
    loadJson<{ buchungen?: { datum: string; ort?: string }[] }>('buchungen'),
  ]);
  const jahr = Number(heute.slice(0, 4));
  // Die Finanzplanung des Haushalts (dieselbe Rechnung wie Finanzen › Privat › Finanzplanung) — Fehler dort kippen die Steuer-Seite nie.
  const plan = hhId ? await ladeFinanzplan(hhId).catch(() => null) : null;
  let est: ReturnType<typeof estGemeinsamFuer> = null;
  try { est = estGemeinsamFuer(plan, jahr); } catch (err) { console.error('[steuern] Finanzplanung nicht rechenbar:', err); }
  const e = mitFinanzplanung(e0, est);
  const abgehakt = d?.abgehakt ?? {};
  const nurBiz = bereich === 'business';
  // Steuern rechnen alle Firmen-Rechnungen (auch die der Selbstständigkeit, die seit 05.10. zu Privat gehört) — nur ausdrücklich Privates
  // nicht; die Business-Sicht nur die Rechnungen der Business-Gesellschaften (ohne Firma: Business, wie in der Liquidität).
  const alleRechnungen = ohnePrivatPosten(fp?.rechnungen ?? []);
  const rechnungen = nurBiz ? alleRechnungen.filter(r => bereichVonFirma(r.firmaId) === 'business') : alleRechnungen;
  const g = grund?.roh ? lesen(grund.roh, grund.stand) : null;
  const gt: Grundlagenteil | null = g ? { stand: grund!.stand.slice(0, 10), kosten: g.kosten, ugRechnungen: g.ugRechnungen } : null;
  const hh = hhId ? await ladeHaushalt(hhId).catch(() => null) : null;
  const belege = (hh?.belege ?? []).filter(b => b.einheit !== 'privat' && (!nurBiz || bereichVonFirma(finanzOrtAus(b.einheit) ?? b.einheit) === 'business'));

  const alleFristen = fristen(e, heute, abgehakt);
  // Umsatzsteuer: der laufende Zeitraum und der letzte, solange er noch nicht angemeldet ist.
  const ust = STEUER_FIRMEN.flatMap(firma => {
    const fs = e[firma];
    const jetzt = zeitraumVon(heute, fs.ust);
    if (!jetzt) return [];
    const davor = zeitraumVon(new Date(Date.parse(`${jetzt.von}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10), fs.ust)!;
    const faelligFuer = (label: string) => alleFristen.find(x => x.einheit === firma && x.art === 'ust' && x.titel.endsWith(label))?.datum ?? null;
    const alt = ustZeitraum(firma, fs, davor, alleRechnungen, gt, faelligFuer(davor.label));
    const aktuell = ustZeitraum(firma, fs, jetzt, alleRechnungen, gt, faelligFuer(jetzt.label));
    const altOffen = alt.faellig && alt.faellig >= heute && !alleFristen.find(x => x.einheit === firma && x.art === 'ust' && x.datum === alt.faellig)?.erledigt;
    return altOffen ? [alt, aktuell] : [aktuell];
  });
  // Ist-Gewinne aus dem Business-Index — seit 05.10. nur für Business-Gesellschaften (die Selbstständigkeit rechnet über die Finanzplanung).
  const gewinn = { kdc: null, kdv: istBusinessGesellschaft('kdv') ? jahresgewinn(istMonate(bestandFuer(roh, 'kdv')), jahr) : null };
  const ustOffen: Partial<Record<SteuerFirma, number>> = {};
  for (const u of ust) ustOffen[u.firma] = (ustOffen[u.firma] ?? 0) + (u.zahllast ?? 0);
  const p = prognose(e, heute, gewinn, ustOffen, { rechnungen: alleRechnungen.filter(r => r.firmaId === 'ug' && (r.status === 'gestellt' || r.status === 'bezahlt')).length }, est);
  const letzterMonat = (() => { const x = new Date(`${heute.slice(0, 7)}-01T12:00:00Z`); x.setUTCMonth(x.getUTCMonth() - 1); return x.toISOString().slice(0, 7); })();
  const buchungsMonate = Array.from(new Set((buch?.buchungen ?? []).filter(b => (nurBiz ? istBusinessGesellschaft(b.ort) : istGesellschaft(b.ort))).map(b => b.datum.slice(0, 7))));
  const voll = {
    hinweis: HINWEIS, heute, bereich, einstellungen: e, fristen: alleFristen, ust, prognose: p, gewinn,
    belege: belegPunkte(rechnungen, belege, heute),
    uebergabe: {
      monat: letzterMonat, punkte: uebergabeMonat(letzterMonat, { rechnungen, belege, abschluesse: roh.abschluesse, buchungsMonate, abgehakt }),
      jahr: jahr - 1, jahresPunkte: uebergabeJahr(jahr - 1, abgehakt),
    },
    haushalt: hhId,
    /** Gemeinsame Einkommensteuer aus der Finanzplanung (null = kein Plan für das Jahr) — nur in der Privat-Sicht. */
    estGemeinsam: est,
  };
  const st = nurBiz ? { ...steuernNurBusiness(voll), estGemeinsam: null } : voll;
  return { ...st, alleFristen };
}

/** Business-Einheit einer Steuer-Aufgabe aus ihrer Kennung `steuer-<kdc|kdv|privat>-…` (27.09.) — privat hat keine. */
export const steuerEinheit = (aufgabeId: string): string | undefined => einheitAusGesellschaft(aufgabeId.replace(/^steuer-/, '').split('-')[0]);

/**
 * Eine Aufgabe je Frist, sobald ihr Vorlauf beginnt (Standard 7 Tage) — ohne
 * Betrag im Titel. Erledigt, wenn ihr die Frist abhakt. Private Fristen tragen
 * „haushalt“, damit Agenten, die an Dritte berichten, sie auslassen.
 */
export async function steuerAufgabenAbgleichen(f: Frist[], heute = localDay()): Promise<{ neu: number; erledigt: number }> {
  const hh = await haushaltDesInhabers();
  if (!hh || !istEchterHaushalt(hh)) return { neu: 0, erledigt: 0 };
  const dran = new Map(f.filter(x => !x.erledigt && x.aufgabeAb <= heute && x.tage >= -30).map(x => [`steuer-${x.id}`, x]));
  const erledigtIds = new Set(f.filter(x => x.erledigt).map(x => `steuer-${x.id}`));
  const jetzt = new Date().toISOString();
  let neu = 0, erledigt = 0;
  // Über den Schreibweg (29.09., Paket T1 #12): `completedAt`, Verlauf „durch System“, Serien, Protokoll — in EINER Sperre.
  await systemAufgabenAendern(stand => {
    neu = 0; erledigt = 0;
    const offen = new Map(dran);
    const teile: { id: string; felder: Record<string, unknown> }[] = [];
    for (const a of stand.tasks) {
      if (!a.id.startsWith('steuer-')) continue;
      // Ältere Steuer-Aufgaben einer Gesellschaft, die im Privat-Space gelandet sind, kommen in ihren Space.
      const g = a.id.replace(/^steuer-/, '').split('-')[0];
      const felder: Record<string, unknown> = {};
      if (istGesellschaft(g) && a.spaceId === 'privat') felder.spaceId = g;
      if (erledigtIds.has(a.id) && a.status !== 'done' && a.status !== 'cancelled') { erledigt++; felder.status = 'done'; }
      if (Object.keys(felder).length) teile.push({ id: a.id, felder });
      offen.delete(a.id);
    }
    const neue = Array.from(offen.entries()).map(([id, x]) => {
      neu++;
      return {
        id, title: `${finanzOrtName(x.einheit)}: ${x.titel}`.slice(0, 200),
        description: `Steuerfrist ${x.datum.slice(8, 10)}.${x.datum.slice(5, 7)}.${x.datum.slice(0, 4)} — ${x.hinweis}. Abhaken unter Zahlen → Steuern. ${HINWEIS}`,
        status: 'todo', priority: x.tage <= 3 ? 'high' : 'medium', assignee: 'kevin',
        tags: ['steuern', ...(x.einheit === 'privat' ? ['haushalt'] : [])], subTasks: [], dependencies: [], sortOrder: 0, createdAt: jetzt, updatedAt: jetzt, dueDate: x.datum,
        // Space der Gesellschaft (05.10.: die Selbstständigkeit steht unter Privat — `bereichVon`), Einheit bleibt.
        ...(steuerEinheit(id) ? { space: bereichVon(x.einheit), spaceId: x.einheit, einheit: steuerEinheit(id) } : {}),
      };
    });
    return { neu: neue, teile };
  }, { jetzt });
  return { neu, erledigt };
}
