'use client';

// ─── WhatsApp — die Uhr für das 24-h-Kundenservice-Fenster (07.10.2026) ────────────────────────────────────────────────
// Zum Einhängen am Gespräch in der Inbox: `<FensterUhr fenster={gespraech.whatsapp.fenster} />`. Rechnet aus `fenster.bis` jede Minute
// selbst nach (dieselbe Regel wie der Server: lib/whatsapp/typen.ts `fensterBerechnen`) — offen = Smaragd, unter 2 Std. = gelb,
// zu = leise mit „nur Vorlagen“. Ruhig: kein Blinken, keine Animation.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP, KUGEL } from '@/lib/make-one/design';
import { LEUCHT } from '../ui';
import { fensterBerechnen, fensterKnapp, fensterText, FENSTER_MS, type Fenster } from '@/lib/whatsapp/typen';

/** Das Fenster jetzt (aus dem Ende, das der Server geliefert hat). Rein. */
export function fensterJetzt(f: Fenster, jetzt: number): Fenster {
  return f.bis ? fensterBerechnen(new Date(Date.parse(f.bis) - FENSTER_MS).toISOString(), jetzt) : f;
}

export function FensterUhr({ fenster, kompakt }: { fenster: Fenster; kompakt?: boolean }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 60_000); return () => clearInterval(t); }, []);
  const f = fensterJetzt(fenster, jetzt);
  const farbe = !f.offen ? C.inkLeise : fensterKnapp(f) ? LEUCHT.achtung : KUGEL.smaragd;
  const text = fensterText(f);
  return (
    <span role="status" data-whatsapp="fenster" data-offen={f.offen ? '1' : '0'} title="WhatsApp: frei schreiben geht 24 Stunden nach der letzten Nachricht der Person — danach nur mit genehmigter Vorlage."
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 32, padding: '4px 12px', borderRadius: 999, border: `1px solid ${farbe}55`, background: `${farbe}14`, color: f.offen ? C.ink : C.inkDim, fontSize: TYP.bedien, lineHeight: 1.3, maxWidth: '100%' }}>
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={farbe} strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: kompakt ? 'nowrap' : 'normal' }}>{kompakt && f.offen ? text.replace('Fenster offen · ', '') : text}</span>
    </span>
  );
}
