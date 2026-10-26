'use client';

// ─── Angebots-Tool · „Zahlung anpassen“ (26.10.) ─────────────────────────────
// Kevin 26.10.: „ein Button, wo wir die Zahlungsmodalität anpassen können, z. B. in Raten — direkt unter dem Betrag.“
// Steht unter den Positionen (2 · Was): ganze Summe (wie bisher) · Raten · Anzahlung + Rest · eigener Satz. Der Satz im PDF kommt aus
// `zahlweiseText` (lib/crm/angebote.ts) — dieselbe Regel für die Zeile hier, die Vorschau und das PDF. Gilt für den einmaligen Betrag.
// Eingabe (26.10. abends, Kevin: „ich muss sauber 1–12 eintippen können … wenn es nicht passt, nicht abschicken, aber keinen Fehler einbauen“):
// die Felder halten den GETIPPTEN Text (nie während des Tippens umgerechnet oder gekappt). Gespeichert wird nur, was `zahlweisePruefen` und
// `zahlweiseProblem` durchlässt; sonst steht der Satz am Feld, und `onFehler` meldet ihn dem Editor — dann lässt sich das Angebot nicht stellen.

import { useEffect, useRef, useState } from 'react';
import type { AngebotPosition, AngebotZahlweise } from '@/lib/crm/typen';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Segmente, feld } from '../../ui';
import { zahlweisePruefen, zahlweiseProblem, zahlweiseSaeubern, zahlweiseText, ZAHLWEISE_GRENZEN as G, ANZAHLUNG_REST_VORGABE } from '@/lib/crm/angebote';

type Art = 'einmal' | AngebotZahlweise['art'];
const ARTEN: { id: Art; label: string }[] = [
  { id: 'einmal', label: 'Ganze Summe' }, { id: 'raten', label: 'Raten' }, { id: 'anzahlung', label: 'Anzahlung + Rest' }, { id: 'frei', label: 'Eigener Text' },
];

/** Was in den Feldern steht — Text, wie getippt. */
interface Eingabe { art: Art; anzahl: string; abstand: string; prozent: string; rest: string; text: string }
const LEER: Eingabe = { art: 'einmal', anzahl: '3', abstand: '1', prozent: '50', rest: '', text: '' };
const ausWert = (z: AngebotZahlweise | undefined, alt: Eingabe = LEER): Eingabe =>
  !z ? { ...alt, art: 'einmal' }
    : z.art === 'raten' ? { ...alt, art: 'raten', anzahl: String(z.anzahl), abstand: String(z.abstandMonate) }
      : z.art === 'anzahlung' ? { ...alt, art: 'anzahlung', prozent: String(z.prozent), rest: z.rest === ANZAHLUNG_REST_VORGABE ? alt.rest : z.rest }
        : { ...alt, art: 'frei', text: z.text };
/** Die Eingabe als Zahlungsweise (roh, noch ungeprüft) — `null` = ganze Summe. */
const roh = (e: Eingabe): Record<string, unknown> | null =>
  e.art === 'einmal' ? null
    : e.art === 'raten' ? { art: 'raten', anzahl: e.anzahl.trim(), abstandMonate: e.abstand.trim() }
      : e.art === 'anzahlung' ? { art: 'anzahlung', prozent: e.prozent.trim(), rest: e.rest }
        : { art: 'frei', text: e.text };
const gleich = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function ZahlweiseWahl({ wert, positionen, ku, onAendern, onFehler }: {
  wert: AngebotZahlweise | undefined; positionen: AngebotPosition[]; ku: boolean;
  onAendern: (z: AngebotZahlweise | null) => void;
  /** Der Satz, solange die Eingabe nicht passt (null = passt) — der Editor sperrt damit das Stellen. */
  onFehler: (satz: string | null) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [e, setE] = useState<Eingabe>(() => ausWert(wert));
  const gesendet = useRef<AngebotZahlweise | undefined>(wert);
  // Kommt von außen ein anderer Stand (Neu laden, 409), folgt die Eingabe ihm — eigene, gerade gespeicherte Werte lösen das nicht aus.
  useEffect(() => { if (!gleich(wert, gesendet.current)) { gesendet.current = wert; setE(alt => ausWert(wert, alt)); } }, [wert]);

  const r = roh(e);
  const fehler = zahlweisePruefen(r) ?? (r ? zahlweiseProblem({ positionen, zahlweise: zahlweiseSaeubern(r) }) : null);
  const fehlerRef = useRef<string | null>(null);
  useEffect(() => { if (fehlerRef.current !== fehler) { fehlerRef.current = fehler; onFehler(fehler); } }, [fehler, onFehler]);
  useEffect(() => () => onFehler(null), [onFehler]);

  function setze(teil: Partial<Eingabe>) {
    const n = { ...e, ...teil };
    setE(n);
    const z = roh(n);
    if (zahlweisePruefen(z)) return; // passt (noch) nicht — nichts speichern, der Satz steht am Feld
    const sauber = z ? zahlweiseSaeubern(z) : undefined;
    if (!gleich(sauber, gesendet.current)) { gesendet.current = sauber; onAendern(sauber ?? null); }
  }

  const satz = !fehler ? zahlweiseText({ positionen, zahlweise: r ? zahlweiseSaeubern(r) : undefined }, { kleinunternehmer: ku }) : null;
  const zeile = fehler ?? satz ?? 'ganze Summe mit Zahlungsziel';
  const f = { ...feld, fontSize: 16, padding: '7px 10px' } as const;
  const label = { display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, flexWrap: 'wrap' } as const;
  const zahlFeld = (wertText: string, name: string, aria: string, breite: number) => (
    <input inputMode="numeric" pattern="[0-9]*" value={wertText} onChange={ev => setze({ [name]: ev.target.value.replace(/[^\d]/g, '').slice(0, 2) } as Partial<Eingabe>)}
      aria-label={aria} aria-invalid={!!fehler} style={{ ...f, width: breite, textAlign: 'right' }} />
  );

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.linie}` }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: TYP.bedien }}>
        <span style={{ color: C.inkLeise }}>Zahlung:</span>
        <span role={fehler ? 'alert' : undefined} style={{ color: fehler ? LEUCHT.achtung : r ? C.ink : C.inkDim, flex: '1 1 220px', minWidth: 0 }}>{zeile}</span>
        <button type="button" onClick={() => setOffen(o => !o)} aria-expanded={offen} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: 0 }}>{offen ? 'fertig' : 'Zahlung anpassen'}</button>
      </div>
      {offen && (
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <Segmente<Art> umbrechen liste={ARTEN} aktiv={e.art} onWahl={a => setze({ art: a })} />
          {e.art === 'raten' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={label}>Anzahl Raten {zahlFeld(e.anzahl, 'anzahl', `Anzahl Raten (${G.raten.min} bis ${G.raten.max})`, 64)} <span style={{ color: C.inkLeise }}>({G.raten.min}–{G.raten.max})</span></label>
              <label style={label}>alle {zahlFeld(e.abstand, 'abstand', `Abstand in Monaten (${G.abstand.min} bis ${G.abstand.max})`, 56)} Monat(e), erste Rate bei Auftrag</label>
            </div>
          )}
          {e.art === 'anzahlung' && (
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <label style={label}>Anzahlung {zahlFeld(e.prozent, 'prozent', `Anzahlung in Prozent (${G.prozent.min} bis ${G.prozent.max})`, 64)} % bei Auftrag</label>
              <label style={{ ...label, flex: '1 1 240px' }}>Rest
                <input value={e.rest} maxLength={G.rest} onChange={ev => setze({ rest: ev.target.value })} placeholder={ANZAHLUNG_REST_VORGABE} aria-label="Wann der Rest fällig ist" style={{ ...f, flex: 1, minWidth: 140 }} /></label>
            </div>
          )}
          {e.art === 'frei' && (
            <textarea value={e.text} maxLength={G.text} onChange={ev => setze({ text: ev.target.value })} rows={2} placeholder="z. B. 50 % bei Auftrag, 50 % nach Go-live, jeweils 14 Tage Zahlungsziel" aria-label="Eigene Zahlungsvereinbarung" style={{ ...f, lineHeight: 1.5, resize: 'vertical' }} />
          )}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{fehler ? 'Solange hier etwas nicht passt, wird es nicht gespeichert und das Angebot lässt sich nicht stellen.' : 'So steht es im Angebot unter den Summen; das Zahlungsziel bleibt darunter.'}</div>
        </div>
      )}
    </div>
  );
}
