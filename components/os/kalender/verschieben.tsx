'use client';

// ─── Kalender — Verschieben mit „Rückgängig“ (R-K2 #92, 29.09.) ─────────────
// Ziehen im Raster (Termine UND Blöcke im Modus „Planen“ — dasselbe Zeitraster) ändert den Termin sofort in iCloud.
// Danach steht 8 Sekunden ein Hinweis „… verschoben · Rückgängig“ unten. Rückgängig schreibt die alte Zeit über
// DENSELBEN Weg zurück (PATCH /api/kalender/termin mit `stand` = ETag nach dem Verschieben): hat sich der Termin
// inzwischen woanders geändert, antwortet der Server 409 — dann bleibt er, wie er ist, und die Meldung sagt es.
// Termine mit Gästen sind ohnehin nicht ziehbar (die Änderung ginge an die Gäste), Serien und fremde Kalender auch nicht.
// Mehrtägige Termine mit Uhrzeit (J-Zusatz) kommen hier schon als Start-Tag + Minuten über Mitternacht hinaus an
// (`wandAus` rollt in die Folgetage) — Start und Ende bleiben so beide richtig.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { LEUCHT, SymbolKnopf } from '../ui';
import { tagPlus, wandAus } from '@/lib/kalender/zeit';
import { objektSchluessel } from '@/lib/kalender/bezug';
import type { KalenderStand, KTermin } from './teile';

/** So lange steht „Rückgängig“ (ms). */
export const RUECKGAENGIG_MS = 8000;

/** `id` = Termin.id (Kalender + UID, R-K1) zum Wiederfinden, `schluessel` = `objektSchluessel` für den PATCH. */
interface Zuletzt { id: string; schluessel: string; titel: string; alt: { start: string; ende: string }; neu: { start: string; ende: string } }
type Antwort = { ok: boolean; fehler?: string; konflikt?: unknown };

const patch = (schluessel: string, start: string, ende: string, stand?: string): Promise<Antwort> =>
  fetch('/api/kalender/termin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: schluessel, start, ende, ...(stand ? { stand } : {}) }) })
    .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

/** Der Termin, wie iCloud ihn jetzt hat (mit frischem `stand`) — für das Zurückschreiben. */
async function frisch(id: string, neu: Zuletzt['neu']): Promise<KTermin | null> {
  try {
    const d = await fetch(`/api/kalender?von=${neu.start.slice(0, 10)}&bis=${tagPlus(neu.ende.slice(0, 10), 1)}`, { cache: 'no-store' }).then(r => r.json()) as KalenderStand;
    return d?.ok ? d.termine.find(t => t.id === id) ?? null : null;
  } catch { return null; }
}

export function useVerschieben({ setDaten, laden, melden }: { setDaten: Dispatch<SetStateAction<KalenderStand | null>>; laden: () => Promise<void> | void; melden: (t: string | null) => void }) {
  const [zuletzt, setZuletzt] = useState<Zuletzt | null>(null);
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weg = useCallback(() => { if (uhr.current) clearTimeout(uhr.current); uhr.current = null; setZuletzt(null); }, []);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); }, []);
  const setzen = (id: string, start: string, ende: string) => setDaten(d => (d ? { ...d, termine: d.termine.map(x => (x.id === id ? { ...x, start, ende } : x)) } : d));

  /** Verschieben/Dauer ändern (Zeitraster). `endeMin` darf über 24 h hinausgehen (mehrtägig) — `wandAus` rollt weiter. */
  const verschieben = async (t: KTermin, tag: string, startMin: number, endeMin: number) => {
    const start = wandAus(tag, startMin), ende = wandAus(tag, endeMin);
    if (start === t.start && ende === t.ende) return;
    weg();
    setzen(t.id, start, ende);
    // Mit Stand (ETag): woanders geändert → 409 statt still überschreiben; der Termin springt beim Neuladen zurück.
    const r = await patch(objektSchluessel(t), start, ende, t.stand);
    if (!r.ok) melden(r.fehler ?? 'Nicht verschoben.');
    else {
      melden(null);
      setZuletzt({ id: t.id, schluessel: objektSchluessel(t), titel: t.titel, alt: { start: t.start, ende: t.ende }, neu: { start, ende } });
      uhr.current = setTimeout(() => setZuletzt(null), RUECKGAENGIG_MS);
    }
    void laden();
  };

  const rueckgaengig = async () => {
    const z = zuletzt; if (!z) return;
    weg();
    const jetzt = await frisch(z.id, z.neu);
    if (!jetzt) { melden('Rückgängig nicht möglich — der Termin ist nicht mehr da.'); return; }
    if (jetzt.start !== z.neu.start || jetzt.ende !== z.neu.ende) { melden('Rückgängig nicht möglich — der Termin wurde inzwischen woanders geändert.'); void laden(); return; }
    setzen(z.id, z.alt.start, z.alt.ende);
    const r = await patch(z.schluessel, z.alt.start, z.alt.ende, jetzt.stand);
    if (!r.ok) melden(r.konflikt ? 'Rückgängig nicht möglich — der Termin wurde inzwischen woanders geändert.' : r.fehler ?? 'Nicht zurückgesetzt.');
    void laden();
  };

  const hinweis = zuletzt ? (
    <div role="status" aria-live="polite" style={{ position: 'fixed', left: '50%', bottom: 'max(18px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 80, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)', padding: '10px 12px 10px 16px', borderRadius: 12, background: C.flaecheHoch, border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.8)', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.ink }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>„{zuletzt.titel}“ verschoben</span>
      <button type="button" onClick={() => void rueckgaengig()} style={{ flex: '0 0 auto', minHeight: 32, padding: '4px 10px', borderRadius: 8, border: `1px solid ${LEUCHT.puls}80`, background: `${LEUCHT.puls}1f`, color: LEUCHT.puls, fontWeight: 700, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien }}>Rückgängig</button>
      <SymbolKnopf onClick={weg} ariaLabel="Hinweis schließen">✕</SymbolKnopf>
    </div>
  ) : null;

  return { verschieben, hinweis };
}
