'use client';

// ─── Kalender — Verschieben mit „Rückgängig“ (R-K2 #92, 29.09.) ─────────────
// Ziehen im Raster (Termine UND Blöcke im Modus „Planen“ — dasselbe Zeitraster) ändert den Termin sofort in iCloud.
// Danach steht der Standard-Hinweis „… verschoben · Rückgängig“ unten (`useRueckgaengig`, RUECKGAENGIG_MS). Rückgängig schreibt die alte Zeit über
// DENSELBEN Weg zurück (PATCH /api/kalender/termin mit `stand` = ETag nach dem Verschieben): hat sich der Termin
// inzwischen woanders geändert, antwortet der Server 409 — dann bleibt er, wie er ist, und die Meldung sagt es.
// Termine mit Gästen sind ohnehin nicht ziehbar (die Änderung ginge an die Gäste), Serien und fremde Kalender auch nicht.
// Mehrtägige Termine mit Uhrzeit (J-Zusatz) kommen hier schon als Start-Tag + Minuten über Mitternacht hinaus an
// (`wandAus` rollt in die Folgetage) — Start und Ende bleiben so beide richtig.

import type { Dispatch, SetStateAction } from 'react';
import { useRueckgaengig } from '../ui';
import { tagPlus, wandAus } from '@/lib/kalender/zeit';
import { objektSchluessel } from '@/lib/kalender/bezug';
import type { KalenderStand, KTermin } from './teile';

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
  // Der „Rückgängig“-Hinweis ist der Standard aller Listen (`useRueckgaengig`, components/os/ui) — Aussehen und Dauer an EINER Stelle.
  const { melden: hinweisZeigen, hinweis } = useRueckgaengig();
  const setzen = (id: string, start: string, ende: string) => setDaten(d => (d ? { ...d, termine: d.termine.map(x => (x.id === id ? { ...x, start, ende } : x)) } : d));

  /** Die alte Zeit zurückschreiben — nur, wenn der Termin seit dem Verschieben unverändert ist (sonst 409/Meldung). */
  const rueckgaengig = async (z: Zuletzt) => {
    const jetzt = await frisch(z.id, z.neu);
    if (!jetzt) { melden('Rückgängig nicht möglich — der Termin ist nicht mehr da.'); return; }
    if (jetzt.start !== z.neu.start || jetzt.ende !== z.neu.ende) { melden('Rückgängig nicht möglich — der Termin wurde inzwischen woanders geändert.'); void laden(); return; }
    setzen(z.id, z.alt.start, z.alt.ende);
    const r = await patch(z.schluessel, z.alt.start, z.alt.ende, jetzt.stand);
    if (!r.ok) melden(r.konflikt ? 'Rückgängig nicht möglich — der Termin wurde inzwischen woanders geändert.' : r.fehler ?? 'Nicht zurückgesetzt.');
    void laden();
  };

  /** Verschieben/Dauer ändern (Zeitraster). `endeMin` darf über 24 h hinausgehen (mehrtägig) — `wandAus` rollt weiter. */
  const verschieben = async (t: KTermin, tag: string, startMin: number, endeMin: number) => {
    const start = wandAus(tag, startMin), ende = wandAus(tag, endeMin);
    if (start === t.start && ende === t.ende) return;
    setzen(t.id, start, ende);
    // Mit Stand (ETag): woanders geändert → 409 statt still überschreiben; der Termin springt beim Neuladen zurück.
    const r = await patch(objektSchluessel(t), start, ende, t.stand);
    if (!r.ok) melden(r.fehler ?? 'Nicht verschoben.');
    else {
      melden(null);
      const z: Zuletzt = { id: t.id, schluessel: objektSchluessel(t), titel: t.titel, alt: { start: t.start, ende: t.ende }, neu: { start, ende } };
      hinweisZeigen(`„${t.titel}“ verschoben`, () => { void rueckgaengig(z); });
    }
    void laden();
  };

  return { verschieben, hinweis };
}
