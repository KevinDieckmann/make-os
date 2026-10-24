'use client';

// ─── Prozesse · Werkstatt — „Mehrfach-Entscheidung“ als Bau-Hilfe (22.10., „Werkstatt bau-fertig“ Punkt 15; Vorbild der Switch in n8n) ─────────────────────────
// Mehrere Fälle mit Bedingungen und je einem Ziel, dazu „sonst“. Gebaut wird daraus SOFORT eine Kaskade aus Rauten nach Regel (lib/prozesse/werkstatt-aktionen.ts
// `mehrfachEntscheidung`) — das Modell bleibt „Strang je Phase + Abzweige“, die Rauten lassen sich danach wie jede andere bearbeiten. Bau-Test 24.10.: ein Klick
// daneben bzw. Esc mit Eingaben fragt erst „Verwerfen?“ (vorher waren die Eingaben weg); „Anlegen“ zählt genau einmal.
// Bau-Test 2 (24.10.): Felder mit Kennungs-Werten (Produkt, Stufe, Status …) bekommen DIESELBE Wertauswahl wie im Panel (lib/prozesse/feld-werte.ts `feldWerte`,
// Quelle `auswahl` vom Server — Name sichtbar, Kennung gespeichert); Freitext nur für echte Textfelder. Fehlt etwas, sagt die Meldung je Fall genau, was
// (`mehrfachMeldung`: Name, Bedingung, Wert).

import { useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, RAND } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, Pillen, SymbolKnopf, feld, auswahl as auswahlStil, useRueckfrage } from '../ui';
import type { Bedingung, ProzessDefinition } from '@/lib/prozesse/definition';
import { rautenFelder } from '@/lib/prozesse/definition-pruefen';
import { feldTitelVon } from '@/lib/prozesse/ausloeser';
import { feldWerte } from '@/lib/prozesse/feld-werte';
import { MEHRFACH_MAX, mehrfachZiele, type MehrfachFall } from '@/lib/prozesse/werkstatt-aktionen';
import type { Auswahl } from './werkstatt-daten';
import { Fenster } from '../Fenster';
import { MaskenEingabe } from './WerkstattMaske';

export function MehrfachFenster({ d, nach, auswahl, onAnlegen, onZu }: {
  d: ProzessDefinition; nach: string;
  /** Die Auswahllisten des Haushalts (GET /api/prozesse/katalog?auswahl=1) — dieselbe Quelle wie im Panel. */ auswahl: Auswahl;
  onAnlegen: (faelle: MehrfachFall[], sonst: 'ende' | 'aufgabe') => string | null; onZu: () => void;
}) {
  const leer = (n: number): MehrfachFall => ({ titel: `Fall ${n}`, bedingungen: [], ziel: null });
  const [faelle, setFaelle] = useState<MehrfachFall[]>([leer(1), leer(2)]);
  const [sonst, setSonst] = useState<'ende' | 'aufgabe'>('aufgabe');
  const [fehler, setFehler] = useState<string | null>(null);
  const felder = useMemo(() => rautenFelder(d).map(id => ({ id, label: feldTitelVon(id) })), [d]);
  // Wie im Panel: Felder mit Werteliste bekommen eine Auswahl (Name sichtbar, Kennung gespeichert).
  const werteVon = (feldId: string) => feldWerte(feldId, auswahl, d);
  // Runde 3: „weiter im Ablauf“ nennt sein aufgelöstes Ziel („folgt im Ablauf“), gleiche Namen werden unterschieden — dieselbe Regel wie im Panel.
  const ziele = useMemo(() => mehrfachZiele(d, nach), [d, nach]);
  const setze = (i: number, t: Partial<MehrfachFall>) => setFaelle(l => l.map((x, j) => (j === i ? { ...x, ...t } : x)));
  const { bestaetigen, dialog } = useRueckfrage();
  // Etwas eingegeben? Dann fragt Schließen erst (Klick daneben, Esc, ×, Abbrechen).
  const anfang = useRef(JSON.stringify({ f: [leer(1), leer(2)], s: 'aufgabe' }));
  const geaendert = JSON.stringify({ f: faelle, s: sonst }) !== anfang.current;
  const zu = async () => {
    if (geaendert && !(await bestaetigen({ titel: 'Eingaben verwerfen?', text: 'Die Fälle der Mehrfach-Entscheidung sind noch nicht angelegt — beim Schließen gehen sie verloren.', ja: 'Verwerfen', gefahr: true }))) return;
    onZu();
  };
  // „Anlegen“ zählt genau einmal (ein Doppelklick baut nie zwei Kaskaden).
  const angelegt = useRef(false);
  const anlegen = () => {
    if (angelegt.current) return;
    const f = onAnlegen(faelle, sonst);
    if (f) setFehler(f); else angelegt.current = true;
  };
  return (
    <Fenster titel="Mehrfach-Entscheidung" onZu={() => void zu()} breit={760}>
      <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>Mehrere Fälle, der erste passende gewinnt. Gebaut wird daraus eine Reihe von Rauten nach Regel (je Fall eine) — du kannst sie danach wie jede Raute bearbeiten.</p>
      {faelle.map((x, i) => (
        <section key={i} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${RAND.haar}` }} aria-label={`Fall ${i + 1}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ ...MIKRO }}>{`Fall ${i + 1}`}</span>
            {faelle.length > 2 && <SymbolKnopf ariaLabel={`Fall ${i + 1} entfernen`} onClick={() => setFaelle(l => l.filter((_, j) => j !== i))}><X size={16} /></SymbolKnopf>}
          </div>
          <Feldzeile label="Name"><input aria-label={`Name von Fall ${i + 1}`} value={x.titel} maxLength={120} onChange={e => setze(i, { titel: e.target.value })} style={feld} /></Feldzeile>
          <MaskenEingabe f={{ id: 'bedingungen', label: 'Wenn …', typ: 'bedingungen', pflicht: true }} wert={x.bedingungen as never} felder={felder} optionen={[]} werteVon={werteVon} onWert={v => setze(i, { bedingungen: v as unknown as Bedingung[] })} />
          <Feldzeile label="Verknüpfung">
            <select aria-label="Verknüpfung" value={x.verknuepfung ?? 'und'} onChange={e => setze(i, { verknuepfung: e.target.value as 'und' | 'oder' })} style={{ ...auswahlStil, width: '100%' }}>
              <option value="und">alle Bedingungen</option><option value="oder">mindestens eine</option>
            </select>
          </Feldzeile>
          <Feldzeile label="Dann weiter bei">
            <select aria-label={`Ziel von Fall ${i + 1}`} value={x.ziel ?? ''} onChange={e => setze(i, { ziel: e.target.value || null })} style={{ ...auswahlStil, width: '100%' }}>
              {ziele.map(z => <option key={z.wert} value={z.wert}>{z.label}</option>)}
            </select>
          </Feldzeile>
        </section>
      ))}
      {faelle.length < MEHRFACH_MAX && <Knopf leise onClick={() => setFaelle(l => [...l, leer(l.length + 1)])}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Fall</span></Knopf>}
      <Feldzeile gruppe label="Sonst (kein Fall passt)">
        <Pillen liste={[{ id: 'aufgabe' as const, label: 'Aufgabe „von Hand prüfen“' }, { id: 'ende' as const, label: 'Lauf endet' }]} aktiv={sonst} onWahl={v => setSonst(v)} />
      </Feldzeile>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={anlegen}>Anlegen</Knopf>
        <Knopf leise onClick={() => void zu()}>Abbrechen</Knopf>
      </div>
      {dialog}
    </Fenster>
  );
}
