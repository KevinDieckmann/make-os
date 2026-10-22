'use client';

// ─── Prozesse · Werkstatt — „Mehrfach-Entscheidung“ als Bau-Hilfe (22.10., „Werkstatt bau-fertig“ Punkt 15; Vorbild der Switch in n8n) ─────────────────────────
// Mehrere Fälle mit Bedingungen und je einem Ziel, dazu „sonst“. Gebaut wird daraus SOFORT eine Kaskade aus Rauten nach Regel (lib/prozesse/werkstatt-aktionen.ts
// `mehrfachEntscheidung`) — das Modell bleibt „Strang je Phase + Abzweige“, die Rauten lassen sich danach wie jede andere bearbeiten.

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, RAND } from '@/lib/make-one/design';
import { Knopf, Hinweis, Feldzeile, Pillen, SymbolKnopf, feld, auswahl as auswahlStil } from '../ui';
import type { Bedingung, ProzessDefinition } from '@/lib/prozesse/definition';
import { alleSchritte } from '@/lib/prozesse/fluss';
import { rautenFelder } from '@/lib/prozesse/definition-pruefen';
import { feldTitelVon } from '@/lib/prozesse/ausloeser';
import { MEHRFACH_MAX, type MehrfachFall } from '@/lib/prozesse/werkstatt-aktionen';
import { Fenster } from '../Fenster';
import { MaskenEingabe } from './WerkstattMaske';

export function MehrfachFenster({ d, nach, onAnlegen, onZu }: { d: ProzessDefinition; nach: string; onAnlegen: (faelle: MehrfachFall[], sonst: 'ende' | 'aufgabe') => string | null; onZu: () => void }) {
  const leer = (n: number): MehrfachFall => ({ titel: `Fall ${n}`, bedingungen: [], ziel: null });
  const [faelle, setFaelle] = useState<MehrfachFall[]>([leer(1), leer(2)]);
  const [sonst, setSonst] = useState<'ende' | 'aufgabe'>('aufgabe');
  const [fehler, setFehler] = useState<string | null>(null);
  const felder = useMemo(() => rautenFelder(d).map(id => ({ id, label: feldTitelVon(id) })), [d]);
  const phase = alleSchritte(d).find(x => x.schritt.id === nach)?.phase.id;
  const ziele = alleSchritte(d).filter(x => x.phase.id === phase && x.schritt.id !== nach && x.schritt.form !== 'ausloeser' && !x.schritt.schloss).map(x => x.schritt);
  const setze = (i: number, t: Partial<MehrfachFall>) => setFaelle(l => l.map((x, j) => (j === i ? { ...x, ...t } : x)));
  return (
    <Fenster titel="Mehrfach-Entscheidung" onZu={onZu} breit={760}>
      <p style={{ margin: 0, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>Mehrere Fälle, der erste passende gewinnt. Gebaut wird daraus eine Reihe von Rauten nach Regel (je Fall eine) — du kannst sie danach wie jede Raute bearbeiten.</p>
      {faelle.map((x, i) => (
        <section key={i} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 14, border: `1px solid ${RAND.haar}` }} aria-label={`Fall ${i + 1}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ ...MIKRO }}>{`Fall ${i + 1}`}</span>
            {faelle.length > 2 && <SymbolKnopf ariaLabel={`Fall ${i + 1} entfernen`} onClick={() => setFaelle(l => l.filter((_, j) => j !== i))}><X size={16} /></SymbolKnopf>}
          </div>
          <Feldzeile label="Name"><input aria-label={`Name von Fall ${i + 1}`} value={x.titel} maxLength={120} onChange={e => setze(i, { titel: e.target.value })} style={feld} /></Feldzeile>
          <MaskenEingabe f={{ id: 'bedingungen', label: 'Wenn …', typ: 'bedingungen', pflicht: true }} wert={x.bedingungen as never} felder={felder} optionen={[]} onWert={v => setze(i, { bedingungen: v as unknown as Bedingung[] })} />
          <Feldzeile label="Verknüpfung">
            <select aria-label="Verknüpfung" value={x.verknuepfung ?? 'und'} onChange={e => setze(i, { verknuepfung: e.target.value as 'und' | 'oder' })} style={{ ...auswahlStil, width: '100%' }}>
              <option value="und">alle Bedingungen</option><option value="oder">mindestens eine</option>
            </select>
          </Feldzeile>
          <Feldzeile label="Dann weiter bei">
            <select aria-label={`Ziel von Fall ${i + 1}`} value={x.ziel ?? ''} onChange={e => setze(i, { ziel: e.target.value || null })} style={{ ...auswahlStil, width: '100%' }}>
              <option value="">— weiter im Ablauf —</option>
              {ziele.map(z => <option key={z.id} value={z.id}>{z.titel}</option>)}
            </select>
          </Feldzeile>
        </section>
      ))}
      {faelle.length < MEHRFACH_MAX && <Knopf leise onClick={() => setFaelle(l => [...l, leer(l.length + 1)])}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Fall</span></Knopf>}
      <Feldzeile label="Sonst (kein Fall passt)">
        <Pillen liste={[{ id: 'aufgabe' as const, label: 'Aufgabe „von Hand prüfen“' }, { id: 'ende' as const, label: 'Lauf endet' }]} aktiv={sonst} onWahl={v => setSonst(v)} />
      </Feldzeile>
      {fehler && <Hinweis art="kritisch">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf onClick={() => { const f = onAnlegen(faelle, sonst); if (f) setFehler(f); }}>Anlegen</Knopf>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
      </div>
    </Fenster>
  );
}
