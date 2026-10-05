// ─── Finanzplanung — Schreiben aus der Business-Sicht (rein, getestet) ─────────────────────────────────────────────────
// Kevin 05.10.: „Bei Business kann ich niemals auf Privat gehen … Privat kann Business sehen, aufrufen und bearbeiten, aber nicht umgekehrt.“
// Gegenprüfung 05.10. (Fund 4): Die Pfad-Regeln (`businessPfadErlaubt` in ./sicht.ts) lehnen Schritte auf private Teile und das Ersetzen ganzer
// gemischter Objekte ab. ZUSÄTZLICH — als Netz für jeden Pfad, an den niemand gedacht hat — vergleicht der Schreibweg den privaten Teil des
// Dokuments vor und nach dem Anwenden (`privatTeil`): ändert sich dort irgendetwas (auch über Nebenwirkungen wie ein gelöschtes Planszenario, das
// der Privat-Bereich rechnet), antwortet er 403 und schreibt nichts. Für jeden, auch den Inhaber.

import type { FinanzDaten } from '@/lib/finanzen/rechenkern';
import { zelleTeile } from '@/lib/finanzen/handwerte';
import { darlehenBusinessAenderbar } from '@/lib/finanzen/darlehen';
import { OperationZuGross, wendeOperationenAn, type Angewandt, type Operation } from './operationen';
import { BUSINESS_BAUSTEIN, ZIEL_QUELLEN_BUSINESS, businessPfadErlaubt, istBusinessEinheit, kennungIstBusiness } from './sicht';

const nichtBusiness = <T>(o: Record<string, T> | undefined, zeilen: Pick<FinanzDaten, 'sachkosten'>): Record<string, T> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => { const t = zelleTeile(k); return !t || !kennungIstBusiness(t.id, zeilen); }));

/**
 * Alles Private eines Dokuments — das Gegenstück zu `businessSicht` (was die Business-Sicht NICHT zeigt oder nur verfremdet zeigt). Reine
 * Business-Einträge fehlen hier, damit Anlegen/Löschen im Business den Vergleich nicht stört. `vergleich`: das andere Dokument des Vergleichs —
 * Plan-/IST-/Notiz-Schlüssel einer Business-Zeile bleiben Business, auch wenn die Zeile im selben Schritt gelöscht oder angelegt wird.
 */
export function privatTeil(d: FinanzDaten, vergleich?: FinanzDaten): unknown {
  const zeilen = { sachkosten: [...d.sachkosten, ...(vergleich?.sachkosten ?? [])].filter(z => istBusinessEinheit(z.einheit)) };
  const st = d.steuern as Record<string, unknown> | undefined;
  return {
    privatEinnahmen: d.privatEinnahmen, privatBudget: d.privatBudget, privatSchulden: d.privatSchulden, check: d.check, fokus: d.fokus,
    abschluesse: d.abschluesse, regeln: d.regeln, schwellen: d.schwellen ?? null, selbst: d.selbst, handAlt: d.handAlt ?? null,
    nettoTabelle: d.annahmen?.nettoTabelle ?? null,
    plan: nichtBusiness(d.plan, zeilen), ist: nichtBusiness(d.ist, zeilen), notizen: nichtBusiness(d.notizen, zeilen),
    sachkosten: d.sachkosten.filter(z => !istBusinessEinheit(z.einheit)),
    schulden: d.schulden.filter(x => !istBusinessEinheit(x.einheit)),
    posten: d.posten.filter(x => !istBusinessEinheit(x.einheit)),
    buchungen: d.buchungen.filter(x => !istBusinessEinheit(x.e)),
    ziele: d.ziele.filter(z => !(ZIEL_QUELLEN_BUSINESS.includes(z.quelle) && z.einheit !== 'privat')),
    szenarien: d.szenarien.map(s => ({ id: s.id, e: (s.ereignisse ?? []).filter(e => e.einheit === 'privat') })).filter(x => x.e.length),
    planszenarien: (d.planszenarien ?? []).map(ps => {
      const a = ps.annahmen as unknown as Record<string, unknown> | undefined, sst = (a?.steuern ?? {}) as Record<string, unknown>;
      const p = { ausschuettungSteuer: a?.ausschuettungSteuer ?? null, entnahme: a?.entnahme ?? null, privat: sst.privat ?? null, kdc: sst.kdc ?? null };
      return { id: ps.id, b: ps.bausteine.filter(b => b.einheit !== undefined && !BUSINESS_BAUSTEIN(b.einheit)), p };
    }).filter(x => x.b.length || Object.values(x.p).some(v => v !== null)),
    steuern: { privat: st?.privat ?? null, kdc: st?.kdc ?? null },
    darlehen: (d.darlehen ?? []).filter(l => !darlehenBusinessAenderbar(l)),
    bereichPrivat: d.bereiche?.privat ?? null,
  };
}

export type BusinessSchreiben =
  | { ok: true; r: Angewandt }
  | { ok: false; status: 400 | 403 | 413; fehler: string; grund: 'pfad' | 'privat' | 'ungueltig' };

/**
 * Schritte aus der Business-Sicht anwenden: erst jede Pfad-Regel (gegen das gespeicherte Dokument und den neuen Wert), dann anwenden, dann der
 * Vergleich des privaten Teils. Wirft nie — Ungültiges kommt als 400/413 zurück (wie im Schreibweg).
 */
export function schreibeAlsBusiness(d: FinanzDaten, ops: Operation[], person: string, jetzt: string): BusinessSchreiben {
  for (const op of Array.isArray(ops) ? ops : []) {
    const grund = businessPfadErlaubt(String(op?.pfad ?? ''), d, op?.neu);
    if (grund) return { ok: false, status: 403, fehler: `In der Business-Sicht nicht änderbar: ${grund}`, grund: 'pfad' };
  }
  let r: Angewandt;
  try { r = wendeOperationenAn(d, ops, person, jetzt); }
  catch (err) {
    return { ok: false, status: err instanceof OperationZuGross ? 413 : 400, fehler: err instanceof Error ? err.message : 'Änderung nicht verwertbar.', grund: 'ungueltig' };
  }
  if (JSON.stringify(privatTeil(d, r.dokument)) !== JSON.stringify(privatTeil(r.dokument, d)))
    return { ok: false, status: 403, fehler: 'In der Business-Sicht nicht änderbar: diese Änderung würde Privates verändern.', grund: 'privat' };
  return { ok: true, r };
}
