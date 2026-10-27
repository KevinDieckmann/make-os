// ─── Zahlungseingang einer Rechnung vermerken (nur Server, 27.10.) ─────────────
// Die EINE Stelle für „bezahlt“: Status + `bezahltAm` UND die Buchung `bu-re-<id>` in EINER Sperre über dem Finanzplan (die Buchung zuerst,
// idempotent; steht der Eingang schon aus dem Kontoauszug da, wird er verknüpft). Vorher lag der Weg nur in PATCH /api/state/finanzplan
// (privater Finanzzugang) — Konten „nur Business“ konnten keinen Zahlungseingang vermerken, und im Rechnungs-Editor gab es ihn nicht.
// Aufrufer: /api/state/finanzplan (`aktion: 'bezahlt'`, volle Sicht) und /api/rechnung (`aktion: 'bezahlt'`, Sicht des Kontos).

import { loadJson, updateJsonAsync } from '@/lib/store/local-db';
import { localDay } from '@/lib/zeit';
import { bezahltAnwenden, fassung, sauberFile, type BezahltErgebnis, type FinanzplanFile, type Rechnung } from '@/lib/finanzen/finanzplan-bestand';
import { buchungAnlegen } from '@/lib/finanzen/finanzplan-buchung';
import { protokolliereBestand, type Wer } from '@/lib/store/aenderungsprotokoll';
import { istBusinessGesellschaft } from '@/lib/einheiten';

/** Nichts schreiben: bricht updateJsonAsync ab, ohne dass der Bestand angefasst wird. */
class KeinSchreiben extends Error {}

export type BezahltAntwort =
  | { ok: true; rechnung: Rechnung; schonBezahlt: boolean; buchung: { id: string; gebucht: 'neu' | 'vorhanden' | 'verknuepft' | null } | null }
  | { ok: false; status: number; fehler: string; aktuell?: Rechnung & { fassung: string } };

/**
 * Rechnung `id` als bezahlt vermerken. `sicht: 'business'` (Konto „nur Business“) darf nur Rechnungen der Business-Gesellschaften —
 * sonst 404 wie eine unbekannte Rechnung (nichts verraten). `am` = Tag des Eingangs (JJJJ-MM-TT, Vorgabe heute; nicht in der Zukunft,
 * nicht vor dem Rechnungsdatum).
 */
export async function rechnungBezahltVermerken(p: { id: string; am?: unknown; stand?: unknown; sicht?: 'privat' | 'business'; wer?: Wer; heute?: string }): Promise<BezahltAntwort> {
  const heute = p.heute ?? localDay();
  const am = typeof p.am === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.am) ? p.am : heute;
  const stand = typeof p.stand === 'string' && p.stand ? p.stand : undefined;
  let erg: BezahltErgebnis | null = null;
  let gebucht: 'neu' | 'vorhanden' | 'verknuepft' | null = null;
  let vorher: Rechnung | undefined;
  try {
    await updateJsonAsync<FinanzplanFile>('finanzplan', async current => {
      if (!current) { erg = { ok: false, status: 404, fehler: 'Noch kein Finanzplan angelegt.' }; throw new KeinSchreiben(); }
      const f = sauberFile(current);
      vorher = f.rechnungen.find(r => r.id === p.id);
      if (vorher && p.sicht === 'business' && !istBusinessGesellschaft(vorher.firmaId)) { erg = { ok: false, status: 404, fehler: 'Rechnung nicht gefunden.' }; throw new KeinSchreiben(); }
      if (vorher?.art === 'storno') { erg = { ok: false, status: 409, fehler: 'Eine Stornorechnung wird nicht bezahlt.', aktuell: vorher }; throw new KeinSchreiben(); }
      const e = bezahltAnwenden(f, p.id, am, stand, heute);
      erg = e;
      if (!e.ok) throw new KeinSchreiben();
      if (e.buchung) gebucht = await buchungAnlegen(e.buchung, { ...(e.rechnung.nummer ? { nummer: e.rechnung.nummer } : {}) });
      return e.schonBezahlt ? current : e.datei;
    });
  } catch (err) {
    if (!(err instanceof KeinSchreiben)) {
      console.error('[rechnung] bezahlt fehlgeschlagen', (err as Error)?.message);
      return { ok: false, status: 500, fehler: 'Nicht gespeichert — Rechnung und Buchung sind unverändert. Bitte noch einmal.' };
    }
  }
  const e = erg as BezahltErgebnis | null;
  if (!e) return { ok: false, status: 500, fehler: 'Nicht gespeichert.' };
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler, ...(e.aktuell ? { aktuell: { ...e.aktuell, fassung: fassung(e.aktuell) } } : {}) };
  // Änderungsprotokoll: nur Kennung + Feldnamen (status, bezahltAm) — die Buchung protokolliert ihr eigener Schreibweg.
  if (!e.schonBezahlt) await protokolliereBestand('finanzplan', { rechnungen: [vorher ?? e.rechnung] }, { rechnungen: [e.rechnung] }, p.wer);
  // Ereignis (09.10., E1): Zahlungseingang → Agenten (nur Kennungen, nie Beträge) — nach dem Speichern, wirft nie.
  if (!e.schonBezahlt) await import('@/lib/ereignisse/quellen').then(q => q.rechnungBezahltEreignis(e.rechnung)).catch(() => 0);
  return { ok: true, rechnung: e.rechnung, schonBezahlt: e.schonBezahlt, buchung: e.buchung ? { id: e.buchung.id, gebucht } : null };
}

/** Für Leser, die nach dem Vermerken den ganzen Stand brauchen. */
export const finanzplanLesen = async () => sauberFile(await loadJson<FinanzplanFile>('finanzplan'));

/**
 * Eine gestellte Rechnung OHNE PDF aus MAKE OS stornieren (Altbestand, außerhalb gestellt — 27.10.: vorher nur in der früheren Rechnungs-Pipeline unter
 * Finanzen, die jetzt in der EINEN Übersicht aufgeht): Status „storniert“ mit Datum + Grund, der Eintrag bleibt; gibt es den Zahlungseingang, kommt die
 * Gegenbuchung `bu-st-<id>` dazu (idempotent) — derselbe Weg wie PATCH /api/state/finanzplan `storno`. Rechnungen mit PDF storniert `rechnungStornieren`.
 */
export async function stornoOhnePdf(p: { id: string; grund: unknown; stand?: unknown; sicht?: 'privat' | 'business'; wer?: Wer; heute?: string }): Promise<
  | { ok: true; rechnung: Rechnung; schonStorniert: boolean; gegenbuchung: 'neu' | 'vorhanden' | 'keine' }
  | { ok: false; status: number; fehler: string; aktuell?: Rechnung & { fassung: string } }> {
  const { stornoAnwenden } = await import('@/lib/finanzen/finanzplan-bestand');
  const { gegenbuchungAnlegen } = await import('@/lib/finanzen/finanzplan-buchung');
  const am = p.heute ?? localDay();
  const grund = String(p.grund ?? '').replace(/\s+/g, ' ').trim();
  if (grund.length < 3) return { ok: false, status: 400, fehler: 'Bitte einen Grund für das Storno angeben.' };
  if (grund.length > 300) return { ok: false, status: 413, fehler: 'Grund ist länger als 300 Zeichen — nichts gekürzt, bitte kürzen.' };
  const stand = typeof p.stand === 'string' && p.stand ? p.stand : undefined;
  let erg: ReturnType<typeof stornoAnwenden> | null = null;
  let gegen: 'neu' | 'vorhanden' | 'keine' = 'keine';
  let vorher: Rechnung | undefined;
  try {
    await updateJsonAsync<FinanzplanFile>('finanzplan', async current => {
      if (!current) { erg = { ok: false, status: 404, fehler: 'Noch kein Finanzplan angelegt.' }; throw new KeinSchreiben(); }
      const f = sauberFile(current);
      vorher = f.rechnungen.find(r => r.id === p.id);
      if (vorher && p.sicht === 'business' && !istBusinessGesellschaft(vorher.firmaId)) { erg = { ok: false, status: 404, fehler: 'Rechnung nicht gefunden.' }; throw new KeinSchreiben(); }
      if (vorher?.pdfDateiId) { erg = { ok: false, status: 409, fehler: 'Diese Rechnung hat ein PDF — sie wird mit einer Stornorechnung storniert.' }; throw new KeinSchreiben(); }
      const e = stornoAnwenden(f, p.id, am, grund, stand);
      erg = e;
      if (!e.ok) throw new KeinSchreiben();
      gegen = await gegenbuchungAnlegen(e.rechnung, e.rechnung.storniertAm ?? am);
      return e.schonStorniert ? current : e.datei;
    });
  } catch (err) {
    if (!(err instanceof KeinSchreiben)) {
      console.error('[rechnung] storno ohne PDF fehlgeschlagen', (err as Error)?.message);
      return { ok: false, status: 500, fehler: 'Nicht gespeichert — Rechnung und Buchungen sind unverändert. Bitte noch einmal.' };
    }
  }
  const e = erg as ReturnType<typeof stornoAnwenden> | null;
  if (!e) return { ok: false, status: 500, fehler: 'Nicht gespeichert.' };
  if (!e.ok) return { ok: false, status: e.status, fehler: e.fehler, ...(e.aktuell ? { aktuell: { ...e.aktuell, fassung: fassung(e.aktuell) } } : {}) };
  if (!e.schonStorniert) await protokolliereBestand('finanzplan', { rechnungen: [vorher ?? e.rechnung] }, { rechnungen: [e.rechnung] }, p.wer);
  return { ok: true, rechnung: e.rechnung, schonStorniert: e.schonStorniert, gegenbuchung: gegen };
}
