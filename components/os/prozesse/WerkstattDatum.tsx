'use client';

// ─── Prozesse · Werkstatt — der Auslöser „Datum am Fall“ ehrlich gezeigt (22.10., Datums-Start; ANALYSE_100.md Punkt 34) ──────────────────────────────────────
// Am Auslöser: worauf er schaut und wann er startet (lib/prozesse/datum-start.ts `datumErklaerung` — derselbe Text, den der Motor rechnet), dazu die nächsten Starts
// des GESPEICHERTEN Entwurfs (GET /api/prozesse/werkstatt?id=…&datum=<Knoten> — nur Tage und Anzahlen, nie Namen). Rechnet nichts selbst.

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Hinweis } from '../ui';
import { datumErklaerung, type DatumAusloeser } from '@/lib/prozesse/datum-start';
import { WERKSTATT_QUELLE } from './werkstatt-daten';

export interface DatumVorschauDaten { naechste: { tag: string; n: number }[]; gesamt: number; tage: number; gekuerzt: boolean; lesbar: boolean }

const tagKurz = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const faelle = (n: number) => `${n} ${n === 1 ? 'Fall' : 'Fälle'}`;

/** Die Vorschau als Satz (rein): „Nächste Starts: 24.10. (2 Fälle) · …“ — ohne Daten der Satz, warum nicht. */
export function vorschauText(v: DatumVorschauDaten | null, gespeichert: boolean): string {
  if (!gespeichert) return 'Die Vorschau der nächsten Starts erscheint, sobald der Entwurf gespeichert ist.';
  if (!v) return 'Die Vorschau der nächsten Starts lädt …';
  if (!v.lesbar) return 'Die Vorschau ist gerade nicht lesbar (CRM bzw. Fristen nicht erreichbar).';
  if (!v.naechste.length) return `In den nächsten ${v.tage} Tagen startet kein Fall.`;
  const gezeigt = v.naechste.reduce((s, x) => s + x.n, 0);
  return `Nächste Starts: ${v.naechste.map(x => `${tagKurz(x.tag)} (${faelle(x.n)})`).join(' · ')}${v.gesamt > gezeigt ? ` — in ${v.tage} Tagen insgesamt ${faelle(v.gesamt)}` : ''}${v.gekuerzt ? ' (Vorschau gekürzt)' : ''}.`;
}

export function DatumAusloeserKarte({ prozessId, knotenId, ausloeser, gespeichert }: { prozessId: string; knotenId: string; ausloeser: DatumAusloeser; gespeichert: boolean }) {
  const [v, setV] = useState<DatumVorschauDaten | null>(null);
  const schluessel = JSON.stringify(ausloeser);
  useEffect(() => {
    setV(null);
    if (!gespeichert) return;
    let aus = false;
    void (async () => {
      const r = await fetch(`${WERKSTATT_QUELLE}&id=${encodeURIComponent(prozessId)}&datum=${encodeURIComponent(knotenId)}`, { cache: 'no-store' }).catch(() => null);
      const j = r?.ok ? await r.json().catch(() => null) as { ok?: boolean; datumVorschau?: DatumVorschauDaten } | null : null;
      if (!aus) setV(j?.ok && j.datumVorschau ? j.datumVorschau : { naechste: [], gesamt: 0, tage: 0, gekuerzt: false, lesbar: false });
    })();
    return () => { aus = true; };
  }, [prozessId, knotenId, schluessel, gespeichert]);
  return (
    <Hinweis art="info" titel={<span className="pz-knopf-inhalt"><CalendarDays size={14} aria-hidden />Datum am Fall</span>}>
      {datumErklaerung(ausloeser)} {vorschauText(v, gespeichert)}
    </Hinweis>
  );
}
