// ─── Fulfillment · Prozesse — Fall schreiben (Server, C1, 10.10.; FULFILLMENT_KONZEPT.md 3.1, 7.2, 7.4, 7.5) ──────────────────────────
// EINE Schreibstelle für Fälle: `fallStartenServer` (Kopie der Paket-Vorlage, idempotent über die Route mit `einmalig`) und `fallSchreiben`
// (Ops über `fallAnwenden` in der Sperre des Bestands `fulfillment-faelle--<h>`). Danach — im selben Klick, idempotent — der Nachzug ins
// Vorhandene (7.4):
//   1. Wechselt die aktuelle Phase und trägt sie `phaseId`: `Mandat.phase` über den CRM-Weg (Teil-Änderung), nur wenn die neue Phase im Ablauf
//      des Produkts SPÄTER liegt.
//   2. Ein erledigter Baustein mit `lieferobjekt` hakt das Lieferobjekt der Leistungstreppe ab (`treppeSchreiben`, idempotent).
//   3. Wert-Konto (7.5): eine neue Messung schreibt `Mandat.ziele[i].ist`; ein neues Ziel legt zuerst die Zeile in `Mandat.ziele` an.
// Schlägt der Nachzug fehl, bleibt der Fall gespeichert und meldet „nicht nachgezogen — erneut“ (`nachziehen`); es bleibt nichts halb.
// Fälle gibt es nur für Mandate von Business-Gesellschaften (sonst 400 „gehört zu Privat“). Mandate ohne Fall bleiben genau wie heute.

import type { Fall, ProzessVorlage, VorlagenDatei, AnwendenErgebnis, KundeKurz } from '../typen';
import type { CrmBestand, Mandat } from '@/lib/crm/typen';
import { fulfillmentAendern, fulfillmentLesen, fulfillmentHaushalt, eintragStand } from '../speicher';
import { aktuellerKnoten, unterschriftAm, istBestand, MARKE_FULFILLMENT_SEIT } from '../regeln';
import { istBusinessGesellschaft, istGesellschaft, GEHOERT_ZU_PRIVAT } from '@/lib/einheiten';
import { neueKennung } from '@/lib/kennung';
import { localDay, tagVon } from '@/lib/zeit';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import { fallAnwenden, fallFreigaben, fallStarten, vorlageUebernehmen, zusatzAnhaengen, zusatzUebernehmen } from './fall';
import { ablaufAktiv } from './ausfuehrung';
import { fallWirksam, istKickoff, onboardingStand, playbookBaustein, willkommenUhr, type OnboardingAbleitung } from './onboarding';
import { letzteMessung, istText, zielText } from './wert';
import { mandatZieleLesen } from '@/lib/crm/mandat-ziele';
import { fallTermine } from './termine-server';
import type { FallTermin } from './termine';

export class FallFehler extends Error { constructor(msg: string, readonly status: 400 | 403 | 404 | 409 | 413) { super(msg); } }

export interface Nachzug {
  phase?: 'gesetzt' | 'fehler'; lieferobjekte?: number; ziele?: number; fehler?: string;
  /** Ausführung der Abläufe (17.10. abends): neu angelegte bzw. geschlossene Aufgaben, Nachrichten im Stapel, Glocken. */
  ablauf?: { aufgaben: number; geschlossen: number; nachrichten: number; glocken: number };
}

/** Die Ausführung des Falls nachziehen (Aufgaben, Nachrichten, Glocken — ./ausfuehrung-server.ts) — wirft nie. */
async function ablaufNachzug(fall: Fall, mandatId: string, person: string, wer: Wer | undefined, jetzt: Date, nachzug?: Nachzug): Promise<void> {
  // Nur Fälle mit Ausführung (ein Knoten trägt eine Form) — sonst bleibt alles wie bisher, ohne einen zusätzlichen Lesevorgang.
  if (!ablaufAktiv(fall)) return;
  try {
    const { ablaufNachziehen } = await import('./ausfuehrung-server');
    const a = await ablaufNachziehen({ mandatId, person, ...(wer ? { wer } : {}), jetzt });
    if (nachzug && (a.aufgaben || a.geschlossen || a.nachrichten || a.glocken)) nachzug.ablauf = { aufgaben: a.aufgaben, geschlossen: a.geschlossen, nachrichten: a.nachrichten, glocken: a.glocken };
    if (nachzug && a.fehler) nachzug.fehler = a.fehler;
  } catch (e) { if (nachzug) nachzug.fehler = e instanceof Error ? e.message.slice(0, 200) : 'Ablauf nicht nachgezogen'; }
}

/** Alles, was ein Fall zum Rechnen braucht (CRM, Vorlagen, Kunden-Kurzform aus C2). */
export async function fallUmfeld(mandatIds?: readonly string[], o: { termine?: boolean } = {}) {
  const { ladeCrm } = await import('@/lib/crm/speicher');
  const h = await fulfillmentHaushalt();
  const [crm, vorlagen, faelle] = await Promise.all([ladeCrm(), fulfillmentLesen('vorlagen', h), fulfillmentLesen('faelle', h)]);
  const ids = mandatIds ?? Object.keys(faelle.faelle);
  const kunde: Record<string, KundeKurz> = await (async () => {
    try { return await (await import('../kunde/server')).kundeKurzFuer(ids); } catch { return {}; }
  })();
  // Die Termine des Kunden (15.10., Abnahme B3) — nur für Mandate mit Fall (sonst leer, z. B. beim Starten).
  const mitFall = ids.filter(id => faelle.faelle[id]).map(id => crm.mandate.find(m => m.id === id)).filter((m): m is Mandat => !!m);
  // `termine: false` (17.10., Tempo B2): die Kurzform der Übersicht braucht keine Termine.
  const termine: Record<string, FallTermin[]> = mitFall.length && o.termine !== false ? await fallTermine(mitFall.map(m => ({ id: m.id, firmaId: m.firmaId ?? null }))).catch(() => ({})) : {};
  return { h, crm, vorlagen, faelle, kunde, termine };
}

/**
 * Die Ableitung des Onboardings für einen Fall (Ziele, Playbook, Kick-off-Rituale, Unterschrift, 24-h-Uhr). `termine` = die Termine des Kunden
 * (`fallTermine`) — der erste ab dem Start macht „Kick-off terminiert“ wahr (15.10., Abnahme B3).
 */
export function ableitungFuer(fall: Fall, m: Mandat | undefined, crm: Pick<CrmBestand, 'angebote' | 'chancen'>, vorlagen: VorlagenDatei, kunde: KundeKurz | undefined, jetzt: string, termine?: readonly Pick<FallTermin, 'tag'>[]): OnboardingAbleitung {
  const u = m ? unterschriftAm(m, crm, fall.gestartetAm) : null;
  // Bestandsmandat (vor der Einrichtung unterschrieben, beim Start älter als 14 Tage): die 24-h-Uhr beginnt mit dem Start des Falls (Prüf-Fund 11.10.).
  const uhrAb = u && istBestand(u.am, vorlagen.marken[MARKE_FULFILLMENT_SEIT], fall.gestartetAm) ? fall.gestartetAm : u?.am;
  return {
    ziele: mandatZieleLesen(m?.ziele).map(z => ({ id: z.id, text: z.text, ...(z.ziel ? { ziel: z.ziel } : {}) })),
    // Der Schritt „Kunden-Playbook“ misst nur das Playbook (`playbookProzent`); ältere Kurzformen ohne das Feld: wie bisher.
    formularProzent: kunde ? (kunde.playbookProzent !== undefined ? kunde.playbookProzent : kunde.formularProzent) : null,
    kickoffRitualIds: vorlagen.rituale.filter(istKickoff).map(r => r.id),
    ...(uhrAb ? { unterschrift: uhrAb } : {}),
    willkommenStunden: vorlagen.einstellungen.willkommenStunden,
    jetzt,
    ...(termine?.length ? { kundenTermine: termine.map(t => t.tag) } : {}),
  };
}

const MANDAT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
export const NUR_BUSINESS_MANDAT = 'Fulfillment gibt es nur für Mandate einer Business-Gesellschaft — bitte am Mandat die Gesellschaft wählen.';
function mandatPruefen(crm: Pick<CrmBestand, 'mandate'>, mandatId: unknown): Mandat {
  if (typeof mandatId !== 'string' || !MANDAT.test(mandatId)) throw new FallFehler('Mandat fehlt.', 400);
  const m = crm.mandate.find(x => x.id === mandatId && !x.geloeschtAm);
  if (!m) throw new FallFehler('Dieses Mandat gibt es nicht (mehr).', 404);
  if (!istBusinessGesellschaft(m.gesellschaft)) throw new FallFehler(istGesellschaft(m.gesellschaft) ? GEHOERT_ZU_PRIVAT(m.gesellschaft) : NUR_BUSINESS_MANDAT, 400);
  return m;
}

/** Den Fall eines Mandats anlegen (Kopie der Paket-Vorlage). 409, wenn es schon einen gibt — außer bei einem Zusatzmodul, das dann anhängt. */
export async function fallStartenServer(e: { mandatId: unknown; vorlageId: unknown; start?: unknown; person: string; wer?: Wer; jetzt?: Date }): Promise<Fall> {
  return (await fallStartenOderAnhaengen(e)).fall;
}

/**
 * Starten — die EINE Stelle für „Kundenonboarding starten“ (Fall-Seite, Onboarding, Freigabe-Stapel). Ein Zusatzmodul (17.10. spät, `ProzessVorlage.zusatz`)
 * legt an einem Mandat mit laufendem Fall KEINEN zweiten Fall an: es hängt dort als eigener Abschnitt an (`zusatzAnhaengen`, `art: 'angehaengt'`); ohne Fall
 * startet es als normaler Fall ohne Onboarding (`art: 'neu'`).
 */
export async function fallStartenOderAnhaengen(e: { mandatId: unknown; vorlageId: unknown; start?: unknown; person: string; wer?: Wer; jetzt?: Date }): Promise<{ fall: Fall; art: 'neu' | 'angehaengt' }> {
  const jetzt = e.jetzt ?? new Date();
  const iso = jetzt.toISOString(), heute = localDay(jetzt);
  const { h, crm, vorlagen } = await fallUmfeld([]);
  const m = mandatPruefen(crm, e.mandatId);
  const v: ProzessVorlage | undefined = vorlagen.prozesse.find(p => p.id === e.vorlageId && p.art === 'paket');
  if (!v) throw new FallFehler('Bitte einen Ablauf wählen (Fulfillment › Übersicht › Abläufe; dem Produkt zuordnen geht unter Produkte).', 400);
  const start = typeof e.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.start) ? e.start : heute;
  const u = unterschriftAm(m, crm, iso);
  // Frist der Willkommensmail = DIESELBE Uhr (`willkommenUhr`, seit 17.10. ab dem Ende des Tages, wenn nur der Tag bekannt ist), als Berliner Tag.
  const uhr = u ? willkommenUhr(u.am, vorlagen.einstellungen.willkommenStunden, undefined, iso) : null;
  const bis = uhr?.faellig ? tagVon(uhr.faellig) : undefined;
  let neu: Fall | null = null;
  let art: 'neu' | 'angehaengt' = 'neu';
  const r = await fulfillmentAendern('faelle', d => {
    const da = d.faelle[m.id];
    if (da && v.zusatz) {
      const x = zusatzAnhaengen(da, { vorlage: v, person: e.person, jetzt: iso, start });
      if (!x.ok) return x as AnwendenErgebnis<typeof d>;
      neu = x.datei; art = 'angehaengt';
      return { ok: true, datei: { ...d, faelle: { ...d.faelle, [m.id]: x.datei } }, geaendert: [m.id] };
    }
    if (da) return { ok: false, status: 409, fehler: 'Für dieses Mandat läuft schon ein Fall.' };
    const pb = playbookBaustein(vorlagen);
    neu = fallStarten({ mandatId: m.id, vorlage: v, person: e.person, jetzt: iso, start, ...(bis ? { willkommenBis: bis } : {}), ...(pb ? { playbookId: pb.id } : {}), neueId: p => neueKennung(p) });
    return { ok: true, datei: { ...d, faelle: { ...d.faelle, [m.id]: neu } }, geaendert: [m.id] };
  }, e.wer ?? { art: 'person', person: e.person }, h);
  if (!r.ok) throw new FallFehler(r.fehler, r.status === 403 ? 403 : r.status);
  // Ausführung (17.10. abends): ist der Fall gleich an einem Schritt mit Form, entsteht seine Aufgabe sofort.
  await ablaufNachzug(neu!, m.id, e.person, e.wer, jetzt);
  return { fall: neu!, art };
}

/** Die Phase des Mandats nachziehen — nur vorwärts im Ablauf des Produkts. Liefert, ob gesetzt wurde. */
async function phaseNachziehen(m: Mandat, phaseId: string, crm: CrmBestand, person: string, iso: string): Promise<boolean> {
  const l = m.leistungId ? crm.leistungen.find(x => x.id === m.leistungId) : undefined;
  const reihe = (l?.phasen ?? []).map(p => p.id);
  const neu = reihe.indexOf(phaseId);
  if (neu < 0) return false;
  const alt = m.phase ? reihe.indexOf(m.phase) : -1;
  if (neu <= alt) return false;
  const { aendereCrm, wendeCrmAn } = await import('@/lib/crm/speicher');
  let gesetzt = false;
  await aendereCrm(b => {
    const r = wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: m.id, felder: { phase: phaseId } }], iso, person);
    gesetzt = r.angewandt > 0 && !r.konflikte.length && !r.sperren.length && !r.grenze.length && !r.abgelehnt?.length;
    return gesetzt ? r.bestand : b;
  }, { art: 'person', person });
  return gesetzt;
}

/** `Mandat.ziele` ändern (ein Ziel dazu bzw. `ist`/`ziel` setzen) — über den CRM-Weg mit dem Stand in der Sperre. */
async function zieleAendern(mandatId: string, f: (z: Mandat['ziele']) => Mandat['ziele'], person: string, iso: string): Promise<boolean> {
  const { aendereCrm, wendeCrmAn } = await import('@/lib/crm/speicher');
  let ok = false;
  await aendereCrm(b => {
    const m = b.mandate.find(x => x.id === mandatId);
    if (!m) return b;
    // Roh kann noch die alte Text-Form stehen — gelesen über die EINE Stelle, der Säuberer erhält sie beim Schreiben (nie verworfen).
    const neu = f(mandatZieleLesen(m.ziele));
    if (JSON.stringify(neu) === JSON.stringify(m.ziele ?? [])) { ok = true; return b; }
    const r = wendeCrmAn(b, [{ liste: 'mandate', op: 'teil', id: mandatId, felder: { ziele: neu } }], iso, person);
    ok = r.angewandt > 0 && !r.konflikte.length && !r.grenze.length && !r.abgelehnt?.length;
    return ok ? r.bestand : b;
  }, { art: 'person', person });
  return ok;
}

export interface FallSchreibErgebnis { fall: Fall; geaendert: string[]; nachzug: Nachzug }

/**
 * Ops an einem Fall anwenden und nachziehen. Zusätzlich zu den Ops von `fallAnwenden`:
 *   ziel-neu { text, ziel?, felder? } — legt zuerst das Ziel am Mandat an (CRM), dann den Wert-Konto-Eintrag (→ `wert-ziel`).
 */
export async function fallSchreiben(mandatId: unknown, opsRoh: unknown, person: string, wer?: Wer, jetzt = new Date()): Promise<FallSchreibErgebnis> {
  const iso = jetzt.toISOString(), heute = localDay(jetzt);
  const { h, crm, vorlagen, faelle, kunde, termine } = await fallUmfeld(typeof mandatId === 'string' ? [mandatId] : []);
  const m = mandatPruefen(crm, mandatId);
  const alt = faelle.faelle[m.id];
  if (!alt) throw new FallFehler('Für dieses Mandat gibt es noch keinen Fall — erst „Fall starten“.', 404);
  if (!Array.isArray(opsRoh)) throw new FallFehler('ops: Liste erwartet.', 400);
  const nachzug: Nachzug = {};
  // Neue Ziele: erst am Mandat (eine Wahrheit für „was ist das Ziel“), dann im Wert-Konto.
  let ziele: Mandat['ziele'] = mandatZieleLesen(m.ziele);
  const ops: unknown[] = [];
  // Neue Ziele erst sammeln und die übrigen Änderungen probeweise prüfen, DANN ans Mandat schreiben (17.10., Gesamtprüfung L2b B1): vorher stand das Ziel
  // schon im CRM, wenn eine spätere Änderung abgelehnt wurde (409/400/413) — und ein wiederholtes Senden legte es doppelt an. Dasselbe Ziel (gleicher Text)
  // wird nie zweimal angelegt.
  const kontakte = new Set((await (await import('@/lib/crm/verarbeitung')).kontakteFuerVerarbeitung()).map(k => k.id));
  const neueZiele: Mandat['ziele'] = [];
  const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  for (const o of opsRoh) {
    if (o && typeof o === 'object' && (o as { op?: unknown }).op === 'ziel-neu') {
      const x = o as { text?: unknown; ziel?: unknown; felder?: unknown };
      const text = typeof x.text === 'string' ? x.text.trim() : '';
      if (!text) throw new FallFehler('Das neue Ziel braucht einen Text.', 400);
      if (text.length > 300) throw new FallFehler('Ziel: höchstens 300 Zeichen.', 413);
      const zielWert = typeof x.ziel === 'string' && x.ziel.trim() ? x.ziel.trim().slice(0, 80) : undefined;
      const da = [...ziele, ...neueZiele].find(z => gleich(z.text, text));
      const id = da?.id ?? neueKennung('z');
      if (!da) neueZiele.push({ id, text, ...(zielWert ? { ziel: zielWert } : {}) });
      if (x.felder && typeof x.felder === 'object') ops.push({ op: 'wert-ziel', zielId: id, felder: x.felder });
    } else ops.push(o);
  }
  if (neueZiele.length) {
    if (ops.length) {
      const probe = fallAnwenden(alt, ops, {
        person, jetzt: iso, heute, standVon: eintragStand, neueId: p => neueKennung(p),
        ziele: [...ziele, ...neueZiele].map(z => ({ id: z.id, ...(z.ziel ? { ziel: z.ziel } : {}) })),
        kontaktErlaubt: id => kontakte.has(id), ritualIds: vorlagen.rituale.map(x => x.id), freigaben: vorlagen.prozesse.some(p => p.id === alt.vorlageId) ? fallFreigaben(alt, vorlagen.prozesse).map(x => x.id) : [],
      });
      if (!probe.ok) throw Object.assign(new FallFehler(probe.fehler, probe.status === 403 ? 403 : probe.status), { konflikte: probe.konflikte });
    }
    const ids = new Set(neueZiele.map(z => z.id));
    if (!(await zieleAendern(m.id, z => [...z.filter(x => !ids.has(x.id)), ...neueZiele], person, iso))) throw new FallFehler('Das Ziel ließ sich am Mandat nicht anlegen — bitte neu laden.', 409);
    ziele = [...ziele, ...neueZiele];
    nachzug.ziele = neueZiele.length;
  }
  if (!ops.length) return { fall: fallWirksam(alt, ableitungFuer(alt, { ...m, ziele }, crm, vorlagen, kunde[m.id], iso, termine[m.id])), geaendert: [], nachzug };
  const vorlage = vorlagen.prozesse.find(p => p.id === alt.vorlageId);
  let ergebnis: AnwendenErgebnis<Fall> = { ok: false, status: 400, fehler: 'Nichts geändert.' };
  const r = await fulfillmentAendern('faelle', d => {
    const f = d.faelle[m.id];
    if (!f) return { ok: false, status: 404, fehler: 'Diesen Fall gibt es nicht (mehr).' };
    ergebnis = fallAnwenden(f, ops, {
      person, jetzt: iso, heute, standVon: eintragStand, neueId: p => neueKennung(p),
      ziele: ziele.map(z => ({ id: z.id, ...(z.ziel ? { ziel: z.ziel } : {}) })),
      kontaktErlaubt: id => kontakte.has(id), ritualIds: vorlagen.rituale.map(x => x.id), freigaben: vorlage ? fallFreigaben(f, vorlagen.prozesse).map(x => x.id) : [],
    });
    if (!ergebnis.ok) return ergebnis as AnwendenErgebnis<typeof d>;
    // Onboarding fertig → „läuft“ (gespeichert, damit der Status nicht nur abgeleitet ist).
    let neu = ergebnis.datei;
    const st = onboardingStand(neu, ableitungFuer(neu, { ...m, ziele }, crm, vorlagen, kunde[m.id], iso, termine[m.id]));
    if (neu.status === 'onboarding' && st.fertig) neu = { ...neu, status: 'laeuft' };
    return { ok: true, datei: { ...d, faelle: { ...d.faelle, [m.id]: neu } }, geaendert: ergebnis.geaendert };
  }, wer ?? { art: 'person', person }, h);
  if (!r.ok) throw Object.assign(new FallFehler(r.fehler, r.status === 403 ? 403 : r.status), { konflikte: r.konflikte });
  const fall = r.datei.faelle[m.id];
  // ── Nachzug (7.4/7.5) — jeder Schritt in eigener Hülle ──
  const abl = ableitungFuer(fall, { ...m, ziele }, crm, vorlagen, kunde[m.id], iso, termine[m.id]);
  try {
    const vorher = aktuellerKnoten(fallWirksam(alt, abl)).phase, nachher = aktuellerKnoten(fallWirksam(fall, abl)).phase;
    if (nachher?.phaseId && nachher.id !== vorher?.id && await phaseNachziehen(m, nachher.phaseId, crm, person, iso)) nachzug.phase = 'gesetzt';
  } catch (e) { nachzug.phase = 'fehler'; nachzug.fehler = e instanceof Error ? e.message.slice(0, 200) : 'Phase nicht nachgezogen'; }
  try {
    const neuErledigt = fall.knoten.filter(k => k.status === 'erledigt' && k.bausteinId && alt.knoten.find(a => a.id === k.id)?.status !== 'erledigt');
    // Mit dem Tag, an dem der Schritt erledigt wurde (15.10., Abnahme B6) — nicht der Tag des Nachzugs.
    const was = neuErledigt.map(k => ({ was: vorlagen.bausteine.find(b => b.id === k.bausteinId)?.lieferobjekt, am: k.erledigtAm?.slice(0, 10) })).filter((x): x is { was: string; am: string | undefined } => !!x.was);
    if (was.length) {
      const { treppeSchreiben } = await import('@/lib/crm/treppe-server');
      const t = await treppeSchreiben(was.map(w => ({ op: 'lieferobjekt', mandatId: m.id, was: w.was, erledigt: true, ...(w.am ? { am: w.am } : {}) })), person, wer);
      if (t.ok) nachzug.lieferobjekte = was.length; else { nachzug.fehler = 'Lieferobjekte nicht nachgezogen'; }
    }
  } catch (e) { nachzug.fehler = e instanceof Error ? e.message.slice(0, 200) : 'Lieferobjekte nicht nachgezogen'; }
  try {
    const gemessen = new Set(ops.filter((o): o is { op: string; zielId: string } => !!o && typeof o === 'object' && ((o as { op?: unknown }).op === 'wert-messung' || (o as { op?: unknown }).op === 'wert-ziel')).map(o => o.zielId));
    if (gemessen.size) {
      const ok = await zieleAendern(m.id, zl => zl.map(z => {
        if (!gemessen.has(z.id)) return z;
        const e = fall.wertKonto[z.id];
        const l = letzteMessung(e);
        const neu = { ...z };
        if (l) neu.ist = istText(l.wert, e?.einheit, l.am);
        else {
          // Letzte Messung gelöscht (Prüf-Fund 11.10.): den Ist-Wert, den WIR aus ihr gesetzt hatten, wieder leeren — einen anderen (von Hand) nie.
          const ea = alt.wertKonto[z.id], la = letzteMessung(ea);
          if (la && z.ist === istText(la.wert, ea?.einheit, la.am)) delete neu.ist;
        }
        if (!z.ziel && e?.zielZahl !== undefined) neu.ziel = zielText(e.zielZahl, e.einheit, e.zielBis);
        return neu;
      }), person, iso);
      if (ok) nachzug.ziele = (nachzug.ziele ?? 0) + gemessen.size; else nachzug.fehler = 'Ist-Wert am Mandat nicht nachgezogen';
    }
  } catch (e) { nachzug.fehler = e instanceof Error ? e.message.slice(0, 200) : 'Ziele nicht nachgezogen'; }
  // Ausführung (17.10. abends): nächster Schritt → Aufgabe, Nachricht → Vorschlag, erledigte Schritte schließen ihre Aufgabe — idempotent.
  await ablaufNachzug(fall, m.id, person, wer, jetzt, nachzug);
  return { fall: fallWirksam(fall, abl), geaendert: r.geaendert, nachzug };
}

/** „Erneut nachziehen“: Phase (vorwärts) und alle erledigten Lieferobjekte noch einmal — idempotent. */
export async function fallNachziehen(mandatId: unknown, person: string, wer?: Wer, jetzt = new Date()): Promise<Nachzug> {
  const iso = jetzt.toISOString();
  const { crm, vorlagen, faelle, kunde, termine } = await fallUmfeld(typeof mandatId === 'string' ? [mandatId] : []);
  const m = mandatPruefen(crm, mandatId);
  const f = faelle.faelle[m.id];
  if (!f) throw new FallFehler('Für dieses Mandat gibt es keinen Fall.', 404);
  const w = fallWirksam(f, ableitungFuer(f, m, crm, vorlagen, kunde[m.id], iso, termine[m.id]));
  const nz: Nachzug = {};
  const ph = aktuellerKnoten(w).phase;
  if (ph?.phaseId && await phaseNachziehen(m, ph.phaseId, crm, person, iso)) nz.phase = 'gesetzt';
  const was = w.knoten.filter(k => k.status === 'erledigt' && k.bausteinId).map(k => vorlagen.bausteine.find(b => b.id === k.bausteinId)?.lieferobjekt).filter((x): x is string => !!x);
  if (was.length) {
    const { treppeSchreiben } = await import('@/lib/crm/treppe-server');
    const t = await treppeSchreiben(was.map(x => ({ op: 'lieferobjekt', mandatId: m.id, was: x, erledigt: true })), person, wer);
    if (t.ok) nz.lieferobjekte = was.length; else nz.fehler = 'Lieferobjekte nicht nachgezogen';
  }
  return nz;
}

/**
 * Die neue Fassung der Vorlage übernehmen (nur hinzufügen/ändern, nie entfernen). Mit `vorlageId` eines angehängten Zusatzmoduls (17.10. spät) dessen neue
 * Fassung — dieselbe Mechanik.
 */
export async function fallVorlageUebernehmen(mandatId: unknown, person: string, wer?: Wer, jetzt = new Date(), vorlageId?: unknown): Promise<Fall> {
  const iso = jetzt.toISOString();
  const { h, crm, vorlagen } = await fallUmfeld([]);
  const m = mandatPruefen(crm, mandatId);
  let neu: Fall | null = null;
  const r = await fulfillmentAendern('faelle', d => {
    const f = d.faelle[m.id];
    if (!f) return { ok: false, status: 404, fehler: 'Diesen Fall gibt es nicht (mehr).' };
    if (typeof vorlageId === 'string' && vorlageId && vorlageId !== f.vorlageId) {
      const z = f.zusaetze?.find(x => x.vorlageId === vorlageId);
      if (!z) return { ok: false, status: 404, fehler: 'Dieses Zusatzmodul hängt nicht an diesem Fall.' };
      const zv = vorlagen.prozesse.find(p => p.id === vorlageId);
      if (!zv) return { ok: false, status: 404, fehler: 'Die Vorlage dieses Zusatzmoduls gibt es nicht mehr — der Fall läuft mit seiner Kopie weiter.' };
      if (zv.fassung <= z.vorlageFassung) return { ok: false, status: 409, fehler: 'Das Zusatzmodul hat schon die aktuelle Fassung.' };
      neu = zusatzUebernehmen(f, zv, iso, person);
      return { ok: true, datei: { ...d, faelle: { ...d.faelle, [m.id]: neu } }, geaendert: [m.id] };
    }
    const v = vorlagen.prozesse.find(p => p.id === f.vorlageId);
    if (!v) return { ok: false, status: 404, fehler: 'Die Vorlage dieses Falls gibt es nicht mehr — der Fall läuft mit seiner Kopie weiter.' };
    if (v.fassung <= f.vorlageFassung) return { ok: false, status: 409, fehler: 'Der Fall hat schon die aktuelle Fassung.' };
    neu = vorlageUebernehmen(f, v, iso, person);
    return { ok: true, datei: { ...d, faelle: { ...d.faelle, [m.id]: neu } }, geaendert: [m.id] };
  }, wer ?? { art: 'person', person }, h);
  if (!r.ok) throw new FallFehler(r.fehler, r.status === 403 ? 403 : r.status);
  // Erst nach der Übernahme per Klick arbeitet die Ausführung mit der neuen Fassung (17.10. abends).
  await ablaufNachzug(neu!, m.id, person, wer, jetzt);
  return neu!;
}

/** Den Wirkungsbericht am Fall vermerken (Datei + optional Zitat mit Einwilligung). */
export async function wirkungVermerken(mandatId: string, w: NonNullable<Fall['wirkung']>, person: string): Promise<void> {
  const h = await fulfillmentHaushalt();
  const r = await fulfillmentAendern('faelle', d => {
    const f = d.faelle[mandatId];
    if (!f) return { ok: false, status: 404, fehler: 'Diesen Fall gibt es nicht (mehr).' };
    return { ok: true, datei: { ...d, faelle: { ...d.faelle, [mandatId]: { ...f, wirkung: w, geaendert: new Date().toISOString(), geaendertVon: person } } }, geaendert: [mandatId] };
  }, { art: 'person', person }, h);
  if (!r.ok) throw new FallFehler(r.fehler, r.status === 403 ? 403 : r.status);
}
