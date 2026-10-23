// ─── Prozesse · Überführung — Weiche, Vergleich, Überführen, Umschalten (Server; 22.10., Paket Ü) ──────────────────────────────────────────────────────
// Regeln rein in ./ueberfuehrung.ts; hier wird gelesen und geschrieben:
//   · `wegFuer(sp)` — die Ablöse-Weiche für den ALTEN Einstiegspunkt (genau einmal je Aufruf). Liest den Werkstatt-Bestand und den Lauf-Bestand; ist einer nicht lesbar,
//     läuft der alte Weg (nie keiner). Schreibt nie.
//   · `vergleichMeldenServer` — ein Weg meldet sein Wirkungsbild (alt: der Einstiegspunkt im Schatten; neu: der feste Schritt im Schatten des Motors). Schreibt NUR
//     `ueberfuehrung.vergleich` des ersetzenden Prozesses (Zähler, Kennungen) — als System, ohne Werte im Protokoll. Wirft nie.
//   · `ueberfuehren` / `umschalten` / `zurueckInDenSchattenServer` — nur volle Mitglieder per Sitzung (die Route prüft: Dienstweg 403, ZOE und Takt schalten nie um).
//     Umschalten = erst „scharf schalten“ im Motor (Status aktiv, Budget 0, nur neue Fälle — vorhandener Weg), DANN die Phase: dazwischen arbeitet der alte Weg
//     (die Weiche verlangt beides), so gibt es keinen Moment mit beiden bzw. keinem.

import { localDay } from '@/lib/zeit';
import { loadJson } from '@/lib/store/local-db';
import type { Wer } from '@/lib/store/aenderungsprotokoll';
import type { ProzessEintrag } from './definition';
import { laeufeAus } from './lauf-regeln';
import { laeufeBestand } from './lauf-typen';
import type { ProzessRechte } from './rollen';
import type { ProzessDef } from './typen';
import {
  UMSCHALT_VORGABE, UEBERFUEHRBAR, ersetzerVon, standVonUeberfuehrung, ueberfuehrbarVon, umschaltenPruefen, vergleichAbschliessen, vergleichMelden, wegEntscheiden,
  zurueckInDenSchatten, type UeberfuehrungAnsicht, type UmschaltRegel, type WegEntscheidung, type Wirkungsbild,
} from './ueberfuehrung';
export type { UeberfuehrungAnsicht } from './ueberfuehrung';

async function haushalt(h?: string): Promise<string> {
  return h ?? (await import('./werkstatt-server')).prozesseHaushalt();
}
/** Steht der Prozess im Lauf-Bestand „scharf geschaltet“? (Budget, Rückfrage — `scharfSchalten`.) */
async function motorScharfLesen(h: string): Promise<(id: string) => boolean> {
  const d = laeufeAus(await loadJson<unknown>(laeufeBestand(h)));
  return id => !!d.prozesse[id]?.einstellung.scharf;
}

/**
 * Die Ablöse-Weiche für einen alten Einstiegspunkt: welcher Weg arbeitet für `sp`? Nicht lesbar (Werkstatt- oder Lauf-Bestand beschädigt) → der alte Weg
 * (nie keiner) und kein Vergleich. Schreibt nie.
 */
export async function wegFuer(sp: string, h?: string): Promise<WegEntscheidung> {
  try {
    const haus = await haushalt(h);
    const { prozesseLesen } = await import('./werkstatt-server');
    const d = await prozesseLesen(haus);
    if (!ersetzerVon(d.prozesse, sp)) return { weg: 'alt', schatten: false };
    return wegEntscheiden(d.prozesse, sp, await motorScharfLesen(haus));
  } catch (e) {
    console.error(`[prozesse/ueberfuehrung] Weiche ${sp} nicht lesbar — der alte Weg arbeitet:`, e instanceof Error ? e.message.slice(0, 120) : e);
    return { weg: 'alt', schatten: false };
  }
}

/** Ein Weg meldet sein Wirkungsbild für einen Tag (nur in Phase „Schatten“ des ersetzenden Prozesses). Wirft nie. */
export async function vergleichMeldenServer(sp: string, seite: 'alt' | 'neu', tag: string, bild: readonly Wirkungsbild[], h?: string): Promise<void> {
  try {
    const { prozesseAendern } = await import('./werkstatt-server');
    await prozesseAendern<object>(d => {
      const e = ersetzerVon(d.prozesse, sp);
      if (!e?.ueberfuehrung || e.ueberfuehrung.phase !== 'schatten') return { ok: false };
      const vergleich = vergleichMelden(e.ueberfuehrung.vergleich, seite, tag, bild);
      return { ok: true, datei: { ...d, prozesse: d.prozesse.map(x => (x.id === e.id ? { ...x, ueberfuehrung: { ...e.ueberfuehrung!, vergleich } } : x)) } };
    }, { art: 'system' }, await haushalt(h));
  } catch (e) {
    console.error(`[prozesse/ueberfuehrung] Vergleich ${sp} (${seite}) nicht gespeichert:`, e instanceof Error ? e.message.slice(0, 120) : e);
  }
}

/** Die Regel fürs Umschalten aus den Stellschrauben (`ueberfuehrung.laeufe` / `ueberfuehrung.tage`) — nicht lesbar = Vorgabe. */
export async function umschaltRegelLesen(h?: string): Promise<UmschaltRegel> {
  try {
    const [{ stellschraubenWerte }, { umschaltRegel }] = await Promise.all([import('./stellschrauben-werte-server'), import('./stellschrauben-werte')]);
    return umschaltRegel(await stellschraubenWerte(h));
  } catch { return UMSCHALT_VORGABE; }
}

// ══ Ansicht (Werkstatt, Landkarte) ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Die Ansicht der Überführung eines Werkstatt-Prozesses (Werkstatt-Band) — nur Zahlen, Kennungen, Sätze. */
export async function ueberfuehrungAnsicht(e: ProzessEintrag, h?: string, jetzt = new Date()): Promise<UeberfuehrungAnsicht | null> {
  const u = ueberfuehrbarVon(e.ersetzt);
  if (!u || !e.ueberfuehrung) return null;
  const haus = await haushalt(h);
  const heute = localDay(jetzt);
  const [scharf, regel, { SYSTEM_PROZESSE }] = await Promise.all([motorScharfLesen(haus).catch(() => () => false), umschaltRegelLesen(haus), import('./register')]);
  const v = vergleichAbschliessen(e.ueberfuehrung.vergleich, heute);
  const { offen, ...vergleich } = v;
  const stand = standVonUeberfuehrung(e, scharf(e.id));
  return {
    sp: u.sp, spTitel: SYSTEM_PROZESSE.find(p => p.id === u.sp)?.titel ?? u.sp, teil: u.teil, satz: u.satz, kennung: u.kennung, bleibt: u.bleibt,
    phase: e.ueberfuehrung.phase, stand, seit: e.ueberfuehrung.seit,
    ...(e.ueberfuehrung.umgeschaltetAm ? { umgeschaltetAm: e.ueberfuehrung.umgeschaltetAm } : {}), ...(e.ueberfuehrung.umgeschaltetVon ? { umgeschaltetVon: e.ueberfuehrung.umgeschaltetVon } : {}),
    vergleich, ...(offen?.tag === heute ? { heute: { alt: !!offen.alt, neu: !!offen.neu } } : {}),
    umschalten: umschaltenPruefen(e.ueberfuehrung, regel, heute), arbeitet: stand === 'scharf' ? 'neu' : 'alt',
  };
}

/**
 * Die Landkarte (lib/prozesse/server.ts): System-Prozesse der festen Liste bekommen `ueberfuehrung` (Stand, ersetzender Prozess), Werkstatt-Prozesse mit `ersetzt`
 * ebenso (Rolle „neu“) — für Kachel-Marke und Steckbrief. Nicht lesbar → die Landkarte bleibt, wie sie war.
 */
export async function mitUeberfuehrung(prozesse: readonly ProzessDef[], eintraege: readonly ProzessEintrag[], h?: string): Promise<ProzessDef[]> {
  const scharf = await motorScharfLesen(await haushalt(h)).catch(() => () => false);
  return prozesse.map(p => {
    if (p.quelle === 'system') {
      const u = ueberfuehrbarVon(p.id);
      if (!u) return p;
      const e = ersetzerVon(eintraege, p.id);
      return { ...p, ueberfuehrung: { rolle: 'alt' as const, teil: u.teil, satz: u.satz, stand: standVonUeberfuehrung(e, e ? scharf(e.id) : false), ...(e ? { prozessId: e.id, titel: e.entwurf.titel } : {}) } };
    }
    if (p.quelle === 'werkstatt') {
      const e = eintraege.find(x => x.id === p.id);
      const u = ueberfuehrbarVon(e?.ersetzt);
      if (!e || !u) return p;
      return { ...p, ueberfuehrung: { rolle: 'neu' as const, teil: u.teil, satz: u.satz, stand: standVonUeberfuehrung(e, scharf(e.id)), prozessId: u.sp } };
    }
    return p;
  });
}

// ══ Schreiben (nur volle Mitglieder per Sitzung — die Route prüft Tor und Dienstweg) ═══════════════════════════════════════════════════════════════

type Antwort = { status: number; body: Record<string, unknown> };

/** „In die Werkstatt überführen“: der neue Prozess aus der Vorlage, Phase Schatten (lib/prozesse/ueberfuehrung-anlegen.ts). EINE Sperre, alles oder nichts. */
export async function ueberfuehren(a: { sp: unknown; person: string; rechte: ProzessRechte; h: string; wer: Wer }): Promise<Antwort> {
  const [{ prozesseAendern, pruefKontextFuer }, { ueberfuehrungAnlegen }, { neueKennung }] = await Promise.all([import('./werkstatt-server'), import('./ueberfuehrung-anlegen'), import('@/lib/kennung')]);
  const kx = await pruefKontextFuer(a.h, a.person);
  // Eigner = die Person, die überführt (ihre Kennung im Team) — sonst offen (umgeschaltet wird erst mit Eigner).
  const eigner = kx.team?.find(t => t.aktiv && t.speicher === a.person)?.id;
  type Ok = Extract<ReturnType<typeof ueberfuehrungAnlegen>, { ok: true }>;
  const r = await prozesseAendern<Omit<Ok, 'ok' | 'datei'>>(
    d => ueberfuehrungAnlegen(d, a.sp, { person: a.person, jetzt: new Date().toISOString(), rechte: a.rechte, neueKennung: p => neueKennung(p), ...(eigner ? { eigner } : {}), pruef: kx }) as never,
    a.wer, a.h,
  ) as ReturnType<typeof ueberfuehrungAnlegen>;
  if (!r.ok) return { status: r.status, body: { ok: false, fehler: r.fehler, ...(r.prozessId ? { prozessId: r.prozessId } : {}), ...(r.befunde ? { befunde: r.befunde } : {}) } };
  return { status: 200, body: { ok: true, prozessId: r.eintrag.id, probelauf: r.probelauf, hinweise: r.hinweise } };
}

/** Enthält die jüngste Version den festen Schritt des Teils (eingeschaltet)? Ohne ihn täte nach dem Umschalten niemand die Arbeit. */
function festerSchrittDa(e: ProzessEintrag): boolean {
  const u = ueberfuehrbarVon(e.ersetzt);
  const v = [...e.versionen].sort((a, b) => b.nr - a.nr)[0];
  return !!u && !!v && v.definition.knoten.some(k => k.katalog?.id === 'system.fest' && k.katalog.werte?.schritt === u.schritt && !k.deaktiviert);
}

/**
 * Umschalten (ein Klick, nie automatisch): erst ab N gleichen Läufen und M Tagen ohne Abweichung (409 mit Grund), nur mit dem festen Schritt in der jüngsten Version.
 * Dann über den vorhandenen Weg „scharf schalten“ (Status aktiv, Budget 0, nur neue Fälle) und erst danach die Phase „scharf“.
 */
export async function umschalten(a: { prozessId: unknown; stand: unknown; person: string; rechte: ProzessRechte; h: string; wer: Wer }): Promise<Antwort> {
  if (!a.rechte.status) return { status: 403, body: { ok: false, fehler: 'Umschalten dürfen volle Mitglieder des Haushalts.' } };
  const { prozesseLesen, prozesseAendern, standVon } = await import('./werkstatt-server');
  const e = (await prozesseLesen(a.h)).prozesse.find(x => x.id === a.prozessId);
  if (!e?.ersetzt || !e.ueberfuehrung) return { status: 404, body: { ok: false, fehler: 'Dieser Prozess ersetzt keinen System-Ablauf.' } };
  if (typeof a.stand !== 'string' || a.stand !== standVon(e)) return { status: 409, body: { ok: false, fehler: 'Inzwischen geändert — bitte neu laden. Nichts umgeschaltet.' } };
  if (e.status === 'archiviert') return { status: 409, body: { ok: false, fehler: 'Ein archivierter Prozess wird nicht umgeschaltet.' } };
  const p = umschaltenPruefen(e.ueberfuehrung, await umschaltRegelLesen(a.h), localDay());
  if (!p.erlaubt) return { status: 409, body: { ok: false, fehler: p.grund, umschalten: p } };
  if (!festerSchrittDa(e)) return { status: 409, body: { ok: false, fehler: 'Die jüngste Version enthält den festen Schritt nicht (mehr) — erst wieder einbauen und veröffentlichen.' } };
  const { scharfSchalten } = await import('./lauf-server');
  const s = await scharfSchalten({ prozessId: e.id, person: a.person, rechte: a.rechte, stand: a.stand, budgetCent: 0, bestehende: 'nur-neue' });
  if (!s.ok) return { status: s.status, body: { ok: false, fehler: s.fehler, ...(s.befunde ? { befunde: s.befunde } : {}) } };
  const jetzt = new Date().toISOString();
  await prozesseAendern<object>(d => {
    const x = d.prozesse.find(y => y.id === e.id);
    if (!x?.ueberfuehrung) return { ok: false };
    return { ok: true, datei: { ...d, prozesse: d.prozesse.map(y => (y.id === e.id ? { ...y, ueberfuehrung: { ...x.ueberfuehrung!, phase: 'scharf' as const, umgeschaltetAm: jetzt, umgeschaltetVon: a.person } } : y)) } };
  }, a.wer, a.h);
  return { status: 200, body: { ok: true } };
}

/** „Zurück in den Schatten“: der alte Weg arbeitet wieder, der Vergleich beginnt neu zu zählen. (Anhalten = der Status „pausiert“ der Werkstatt — derselbe Effekt.) */
export async function zurueckInDenSchattenServer(a: { prozessId: unknown; stand: unknown; person: string; rechte: ProzessRechte; h: string; wer: Wer }): Promise<Antwort> {
  if (!a.rechte.status) return { status: 403, body: { ok: false, fehler: 'Zurückschalten dürfen volle Mitglieder des Haushalts.' } };
  const { prozesseAendern, standVon } = await import('./werkstatt-server');
  let fehler: Antwort | null = null;
  await prozesseAendern<object>(d => {
    const e = d.prozesse.find(x => x.id === a.prozessId);
    if (!e?.ersetzt || !e.ueberfuehrung) { fehler = { status: 404, body: { ok: false, fehler: 'Dieser Prozess ersetzt keinen System-Ablauf.' } }; return { ok: false }; }
    if (typeof a.stand !== 'string' || a.stand !== standVon(e)) { fehler = { status: 409, body: { ok: false, fehler: 'Inzwischen geändert — bitte neu laden. Nichts geändert.' } }; return { ok: false }; }
    return { ok: true, datei: { ...d, prozesse: d.prozesse.map(x => (x.id === e.id ? { ...x, ueberfuehrung: zurueckInDenSchatten(e.ueberfuehrung!) } : x)) } };
  }, a.wer, a.h);
  const f = fehler as Antwort | null; // in der Sperre gesetzt (TS verfolgt das nicht)
  return f ?? { status: 200, body: { ok: true } };
}

/** Für Prüfungen und die Landkarte: welche System-Prozesse sich überführen lassen. */
export const UEBERFUEHRBARE_SP: readonly string[] = UEBERFUEHRBAR.map(u => u.sp);
