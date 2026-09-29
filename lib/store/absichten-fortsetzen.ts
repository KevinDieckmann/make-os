// ─── Offene Absichten fertigstellen (29.09., Paket D-C #17) ──────────────────
// Wer ruft: beim Start (instrumentation.ts → lib/store/betrieb.ts, wenige Sekunden nach dem Hochfahren), im Takt
// (lib/zoe/takt.ts, sobald eine offene Absicht älter als `MINDEST_ALTER_MS` ist → Agent „absichten“) und in der
// nächtlichen Durchsicht (lib/store/durchsicht.ts). Je Absicht läuft ihre Art ab dem ersten nicht abgehakten Schritt
// weiter (die Schritte sind idempotent). Scheitert eine Wiederaufnahme, zählt `fehlschlagVermerken`; nach
// `GRENZE_VERSUCHE` steht sie auf „gescheitert“ — der Head of IT zeigt sie rot (lib/hoi/lage.ts `absichtenBefunde`).
// Absichten, die DIESER Prozess gerade ausführt, bleiben unberührt (laeuftGerade); im Takt nur ältere (ein
// laufender Vorgang in einem zweiten Prozess — lokal Dev-Server + Prüfbau — wird so nicht doppelt angefasst).

import { absichtenHaushalte, absichtenLaden, fehlschlagVermerken, istOffen, laeuftGerade, type Absicht, type AbsichtArt } from './absichten';

/** Im Takt: nur Absichten, die mindestens so alt sind (ein laufender Vorgang ist in Sekunden durch). */
export const MINDEST_ALTER_MS = 10 * 60_000;
/** Nach einem Fehlversuch: so lange je bisherigem Versuch warten (30 min, 60 min …), bevor der Takt es erneut versucht. */
export const RUECKZUG_MS = 30 * 60_000;

/** Ist die Absicht zur Wiederaufnahme dran? (offen, alt genug, nicht im Rückzug nach einem Fehlversuch) Rein. */
export function faelligZurWiederaufnahme(a: Absicht, jetztMs: number, mindestAlterMs = 0): boolean {
  if (!istOffen(a)) return false;
  if (mindestAlterMs && jetztMs - Date.parse(a.angelegt) < mindestAlterMs) return false;
  if (mindestAlterMs && a.letzterVersuch && jetztMs - Date.parse(a.letzterVersuch) < RUECKZUG_MS * Math.max(1, a.versuche)) return false;
  return true;
}

type Fortsetzer = (haushalt: string, a: Absicht) => Promise<unknown>;
/** Je Art der Weg, der sie fortsetzt — dynamisch geladen (die Datenschicht hängt nicht an den CRM-Modulen). */
const FORTSETZER: Record<AbsichtArt, () => Promise<Fortsetzer>> = {
  'art17': async () => (await import('@/lib/crm/person-bestaende')).art17Fortsetzen,
  'zusammenfuehren': async () => (await import('@/lib/crm/absichten-crm')).zusammenfuehrenFortsetzen,
  'import': async () => (await import('@/lib/crm/absichten-crm')).importFortsetzen,
  'kennungen-umzug': async () => (await import('@/lib/crm/kennungen-umzug')).umzugFortsetzen,
  'kennungen-rueckweg': async () => (await import('@/lib/crm/kennungen-umzug')).umzugFortsetzen,
  'crm-folgen': async () => (await import('@/lib/crm/speicher')).crmFolgenFortsetzen,
  'angebot-stellen': async () => (await import('@/lib/crm/angebot-server')).angebotFortsetzen,
  'buchung': async () => (await import('@/lib/kalender/buchung-ablauf')).buchungFortsetzen,
};

export interface FortsetzenErgebnis { gefunden: number; fertig: number; weiterOffen: number; gescheitert: number; fehler: string[] }

/** Offene Absichten aller Haushalte fertigstellen. Wirft nie (Fehler je Absicht landen im Ergebnis und in der Absicht). */
export async function offeneFertigstellen(opt: { mindestAlterMs?: number; jetzt?: Date } = {}): Promise<FortsetzenErgebnis> {
  const r: FortsetzenErgebnis = { gefunden: 0, fertig: 0, weiterOffen: 0, gescheitert: 0, fehler: [] };
  const jetzt = (opt.jetzt ?? new Date()).getTime();
  let haushalte: string[] = [];
  try { haushalte = await absichtenHaushalte(); } catch (e) { r.fehler.push(`Haushalte: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`); return r; }
  for (const h of haushalte) {
    let liste: Absicht[] = [];
    try { liste = await absichtenLaden(h); } catch (e) { r.fehler.push(`absichten--${h}: ${e instanceof Error ? e.message.slice(0, 80) : String(e)}`); continue; }
    // Reihenfolge: älteste zuerst (ein Art.-17-Lauf vor einem späteren Import derselben Person).
    for (const a of liste.filter(istOffen).sort((x, y) => x.angelegt.localeCompare(y.angelegt))) {
      if (laeuftGerade(a.id) || !faelligZurWiederaufnahme(a, jetzt, opt.mindestAlterMs ?? 0)) continue;
      r.gefunden++;
      try {
        const f = await FORTSETZER[a.art]();
        await f(h, a);
        const danach = (await absichtenLaden(h)).find(x => x.id === a.id);
        if (danach && istOffen(danach)) {
          // Lief durch, ist aber nicht vollständig (z. B. Art. 17: ein Bestand scheiterte erneut) — zählt als Fehlversuch.
          const f2 = await fehlschlagVermerken(h, a.id, new Error(`unvollständig: ${danach.schritte.filter(s => !s.erledigt).map(s => s.name).join(', ')}`));
          if (f2?.status === 'gescheitert') r.gescheitert++; else r.weiterOffen++;
        } else r.fertig++;
      } catch (e) {
        const f2 = await fehlschlagVermerken(h, a.id, e).catch(() => null);
        if (f2?.status === 'gescheitert') r.gescheitert++; else r.weiterOffen++;
        r.fehler.push(`${a.art} (${a.id}): ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
      }
    }
  }
  return r;
}

/** Für Takt und Head of IT: wie viele Absichten sind offen, zur Wiederaufnahme fällig bzw. gescheitert? Wirft nie. */
export async function absichtenLage(jetzt = new Date(), mindestAlterMs = 0): Promise<{ offen: number; faellig: number; gescheitert: number; arten: string[]; aeltesteMinuten: number | null }> {
  const raus = { offen: 0, faellig: 0, gescheitert: 0, arten: [] as string[], aeltesteMinuten: null as number | null };
  try {
    for (const h of await absichtenHaushalte()) {
      for (const a of await absichtenLaden(h)) {
        if (a.status === 'gescheitert') { raus.gescheitert++; raus.arten.push(a.art); continue; }
        if (!istOffen(a)) continue;
        raus.offen++;
        const alter = jetzt.getTime() - Date.parse(a.angelegt);
        if (faelligZurWiederaufnahme(a, jetzt.getTime(), mindestAlterMs) && !laeuftGerade(a.id)) raus.faellig++;
        const min = Math.round(alter / 60_000);
        raus.aeltesteMinuten = Math.max(raus.aeltesteMinuten ?? 0, min);
      }
    }
  } catch { /* Lage ist Anzeige — nie werfen */ }
  raus.arten = Array.from(new Set(raus.arten));
  return raus;
}
