'use client';

// ─── Angebots-Tool · „Zahlung anpassen“ (26.10.) ─────────────────────────────
// Kevin 26.10.: „ein Button, wo wir die Zahlungsmodalität anpassen können, z. B. in Raten — direkt unter dem Betrag.“
// Steht unter den Positionen (2 · Was): ganze Summe (wie bisher) · Raten · Anzahlung + Rest · eigener Satz. Der Satz im PDF kommt aus
// `zahlweiseText` (lib/crm/angebote.ts) — dieselbe Regel für die Zeile hier, die Vorschau und das PDF. Gilt für den einmaligen Betrag.

import { useState } from 'react';
import type { AngebotPosition, AngebotZahlweise } from '@/lib/crm/typen';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Segmente, feld } from '../../ui';
import { angebotSummen, zahlweiseText, ZAHLWEISE_GRENZEN as G } from '@/lib/crm/angebote';

type Art = 'einmal' | AngebotZahlweise['art'];
const ARTEN: { id: Art; label: string }[] = [
  { id: 'einmal', label: 'Ganze Summe' }, { id: 'raten', label: 'Raten' }, { id: 'anzahlung', label: 'Anzahlung + Rest' }, { id: 'frei', label: 'Eigener Text' },
];
const VORGABE: Record<AngebotZahlweise['art'], AngebotZahlweise> = {
  raten: { art: 'raten', anzahl: 3, abstandMonate: 1 },
  anzahlung: { art: 'anzahlung', prozent: 50, rest: 'bei Abnahme' },
  frei: { art: 'frei', text: '' },
};

export function ZahlweiseWahl({ wert, positionen, ku, onAendern }: {
  wert: AngebotZahlweise | undefined; positionen: AngebotPosition[]; ku: boolean; onAendern: (z: AngebotZahlweise | null) => void;
}) {
  const [offen, setOffen] = useState(false);
  const einmalig = angebotSummen({ positionen }, { kleinunternehmer: ku }).einmalig.netto > 0;
  const satz = zahlweiseText({ positionen, zahlweise: wert }, { kleinunternehmer: ku });
  const art: Art = wert?.art ?? 'einmal';
  const zahl = (v: string, min: number, max: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const f = { ...feld, fontSize: TYP.bedien, padding: '7px 10px' } as const;
  const label = { display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, flexWrap: 'wrap' } as const;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.linie}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
        <span style={{ color: C.inkLeise }}>Zahlung:</span>
        <span style={{ color: wert ? C.ink : C.inkDim, flex: '1 1 220px', minWidth: 0 }}>{satz ?? (wert && !einmalig ? 'gilt nur für einmalige Beträge — hier gibt es keinen.' : 'ganze Summe mit Zahlungsziel')}</span>
        <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{offen ? 'fertig' : 'Zahlung anpassen'}</button>
      </div>
      {offen && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <Segmente<Art> umbrechen liste={ARTEN} aktiv={art} onWahl={a => onAendern(a === 'einmal' ? null : a === art ? wert! : VORGABE[a])} />
          {wert?.art === 'raten' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={label}>Anzahl Raten
                <input inputMode="numeric" value={String(wert.anzahl)} onChange={e => onAendern({ ...wert, anzahl: zahl(e.target.value, G.raten.min, G.raten.max) })} aria-label="Anzahl Raten" style={{ ...f, width: 64, textAlign: 'right' }} /></label>
              <label style={label}>alle
                <input inputMode="numeric" value={String(wert.abstandMonate)} onChange={e => onAendern({ ...wert, abstandMonate: zahl(e.target.value, G.abstand.min, G.abstand.max) })} aria-label="Abstand in Monaten" style={{ ...f, width: 56, textAlign: 'right' }} /> Monat(e), erste Rate bei Auftrag</label>
            </div>
          )}
          {wert?.art === 'anzahlung' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={label}>Anzahlung
                <input inputMode="numeric" value={String(wert.prozent)} onChange={e => onAendern({ ...wert, prozent: zahl(e.target.value, G.prozent.min, G.prozent.max) })} aria-label="Anzahlung in Prozent" style={{ ...f, width: 56, textAlign: 'right' }} /> % bei Auftrag</label>
              <label style={{ ...label, flex: '1 1 240px' }}>Rest
                <input value={wert.rest} maxLength={G.rest} onChange={e => onAendern({ ...wert, rest: e.target.value })} placeholder="bei Abnahme" aria-label="Wann der Rest fällig ist" style={{ ...f, flex: 1, minWidth: 140 }} /></label>
            </div>
          )}
          {wert?.art === 'frei' && (
            <textarea value={wert.text} maxLength={G.text} onChange={e => onAendern({ ...wert, text: e.target.value })} rows={2} placeholder="z. B. 50 % bei Auftrag, 50 % nach Go-live, jeweils 14 Tage Zahlungsziel" aria-label="Eigene Zahlungsvereinbarung" style={{ ...f, lineHeight: 1.5, resize: 'vertical' }} />
          )}
          {wert && wert.art !== 'frei' && !einmalig && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung }}>Raten und Anzahlung gelten für den einmaligen Betrag — dieses Angebot hat keinen. Laufende Positionen werden je Monat bzw. Jahr bezahlt.</div>}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>So steht es im Angebot unter den Summen; das Zahlungsziel bleibt darunter.</div>
        </div>
      )}
    </div>
  );
}
