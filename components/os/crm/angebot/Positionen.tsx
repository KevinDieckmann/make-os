'use client';

// ─── Angebots-Tool · Schritt 2 „Was“: Katalog + Positionen (28.09.) ─────────
// Kevin: „Im Call muss es extrem schnell gehen.“ Aktive Produkte der Gesellschaft als
// große Karten — ein Klick = eine Position (Menge 1, Preis und Text aus dem Produkt).
// In der Zeile direkt Menge, Preis, Rabatt ändern; Enter springt ins nächste Feld,
// Tab wie gewohnt; Text aufklappbar. „Text fehlt“ markiert Produkte ohne Leistungstext.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { AngebotBasis, AngebotPosition, Leistung } from '@/lib/crm/typen';
import type { Gesellschaftskennung } from '@/lib/einheiten';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { feld } from '../../schlank';
import { katalog, positionAusProdukt, positionNettoCent, euroCent, centAusEingabe, eingabeAusCent, mengeAusEingabe, mengeText, BASIS_LABEL, UST_SAETZE } from '@/lib/crm/angebote';
import { neueId } from '../daten';

const klein = { fontSize: 12, color: C.inkLeise } as const;
const zelle = { ...feld, fontSize: TYP.bedien, padding: '7px 9px', borderRadius: 9 } as const;

/** Enter → nächstes Eingabefeld der Positionsliste (Tab bleibt Tab). */
function weiter(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Enter' || e.shiftKey || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
  e.preventDefault();
  const alle = Array.from(document.querySelectorAll<HTMLElement>('[data-ang-feld]'));
  const i = alle.indexOf(e.target as HTMLElement);
  (alle[i + 1] ?? (e.target as HTMLElement)).focus();
  if (alle[i + 1] instanceof HTMLInputElement) (alle[i + 1] as HTMLInputElement).select();
}

/** Zahlfeld, das lokal tippt und beim Verlassen/Enter übernimmt (ungültig → alter Wert). */
function ZahlFeld({ wert, onWert, breite, label, rechts }: { wert: string; onWert: (t: string) => boolean; breite: number; label: string; rechts?: boolean }) {
  const [t, setT] = useState(wert);
  const fokus = useRef(false);
  useEffect(() => { if (!fokus.current) setT(wert); }, [wert]);
  const fertig = () => { fokus.current = false; if (t !== wert && !onWert(t)) setT(wert); };
  return <input data-ang-feld inputMode="decimal" value={t} aria-label={label} title={label} onFocus={e => { fokus.current = true; e.target.select(); }} onChange={e => setT(e.target.value)} onBlur={fertig}
    onKeyDown={e => { if (e.key === 'Enter') fertig(); weiter(e); if (e.key === 'Escape') { setT(wert); (e.target as HTMLInputElement).blur(); } }}
    style={{ ...zelle, width: breite, textAlign: rechts ? 'right' : 'left', fontVariantNumeric: 'tabular-nums' }} />;
}

export function Katalog({ leistungen, gesellschaft, kleinunternehmer, onDazu, aus }: { leistungen: Leistung[]; gesellschaft: Gesellschaftskennung; kleinunternehmer: (g: Gesellschaftskennung) => boolean; onDazu: (p: AngebotPosition, von: Gesellschaftskennung | null) => void; aus?: boolean }) {
  const l = katalog(leistungen, gesellschaft);
  // Hat die gewählte Gesellschaft kein eigenes Produkt, gleich alle zeigen — im Call zählt jeder Klick.
  const [alle, setAlle] = useState(() => !l.some(x => !x.andere));
  const sichtbar = alle ? l : l.filter(x => !x.andere);
  if (!l.length) return <div style={klein}>Noch kein aktives Produkt — unter Produkte & Mandate › Produkte anlegen (mit Leistungstext), oder hier eine freie Position.</div>;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {sichtbar.map(({ l: p, textFehlt, andere }) => (
          <button key={p.id} disabled={aus} onClick={() => { const von = p.gesellschaft !== 'offen' ? p.gesellschaft as Gesellschaftskennung : null; onDazu(positionAusProdukt(p, neueId('p'), { kleinunternehmer: kleinunternehmer(von ?? gesellschaft) }), von); }} className="fassbar"
            style={{ textAlign: 'left', cursor: aus ? 'default' : 'pointer', padding: '12px 13px', borderRadius: 12, border: `1px solid ${andere ? 'rgba(255,255,255,.08)' : `${LEUCHT.gut}55`}`, background: andere ? 'rgba(255,255,255,.03)' : `${LEUCHT.gut}12`, color: C.ink, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: TYP.bedien, fontWeight: 700, lineHeight: 1.3 }}>+ {p.angebot?.titel?.trim() || p.name}</span>
            <span style={{ fontSize: 12.5, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{p.preis.betrag ? `${euroCent(Math.round(p.preis.betrag * 100))} ${p.preis.einheit}` : 'Preis offen'}</span>
            <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {textFehlt && <span style={{ fontSize: 11, color: LEUCHT.achtung, fontWeight: 700 }}>Text fehlt</span>}
              {andere && <span style={{ fontSize: 11, color: C.inkLeise }}>andere Gesellschaft</span>}
            </span>
          </button>
        ))}
      </div>
      {l.some(x => x.andere) && <button onClick={() => setAlle(!alle)} style={{ marginTop: 8, background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>{alle ? 'nur Produkte dieser Gesellschaft' : `+ ${l.filter(x => x.andere).length} Produkte anderer Gesellschaften`}</button>}
    </div>
  );
}

export function PositionZeile({ p, nr, onAendern, onWeg, onHoch, kleinunternehmer, textFehlt, aus }: {
  p: AngebotPosition; nr: number; onAendern: (teil: Partial<AngebotPosition>) => void; onWeg: () => void; onHoch?: () => void; kleinunternehmer: boolean; textFehlt?: boolean; aus?: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const basen: AngebotBasis[] = ['einmalig', 'monat', 'jahr'];
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ width: 20, color: C.inkLeise, fontSize: 12, textAlign: 'right' }}>{nr}</span>
        <input data-ang-feld value={p.titel} disabled={aus} aria-label="Titel der Position" onChange={e => onAendern({ titel: e.target.value })} onKeyDown={weiter} style={{ ...zelle, flex: '1 1 200px', minWidth: 160, fontWeight: 600 }} />
        <ZahlFeld label="Menge" breite={64} rechts wert={mengeText(p.menge)} onWert={t => { const m = mengeAusEingabe(t); if (m === null) return false; onAendern({ menge: m }); return true; }} />
        <input data-ang-feld value={p.einheit} disabled={aus} aria-label="Einheit" onChange={e => onAendern({ einheit: e.target.value })} onKeyDown={weiter} style={{ ...zelle, width: 78 }} />
        <ZahlFeld label="Einzelpreis € netto" breite={104} rechts wert={eingabeAusCent(p.einzelpreisCent)} onWert={t => { const c = centAusEingabe(t); if (c === null) return false; onAendern({ einzelpreisCent: c }); return true; }} />
        <ZahlFeld label="Rabatt %" breite={58} rechts wert={p.rabattProzent ? String(p.rabattProzent).replace('.', ',') : ''} onWert={t => { const n = t.trim() ? Number(t.replace(',', '.')) : 0; if (!Number.isFinite(n) || n < 0 || n > 100) return false; onAendern({ rabattProzent: n || undefined }); return true; }} />
        <span style={{ minWidth: 96, textAlign: 'right', fontWeight: 700, fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{euroCent(positionNettoCent(p))}</span>
        <button onClick={onWeg} disabled={aus} aria-label={`Position ${nr} entfernen`} title="Entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', paddingLeft: 26 }}>
        <select data-ang-feld value={p.basis} disabled={aus} aria-label="Basis" onChange={e => onAendern({ basis: e.target.value as AngebotBasis, ...(e.target.value === 'einmalig' ? { laufzeitMonate: undefined } : {}) })} onKeyDown={weiter} style={{ ...zelle, width: 118, padding: '6px 8px' }}>
          {basen.map(b => <option key={b} value={b}>{BASIS_LABEL[b]}</option>)}
        </select>
        {p.basis !== 'einmalig' && <ZahlFeld label="Laufzeit Monate" breite={70} rechts wert={p.laufzeitMonate ? String(p.laufzeitMonate) : ''} onWert={t => { const n = t.trim() ? Math.round(Number(t)) : 0; if (!Number.isFinite(n) || n < 0 || n > 600) return false; onAendern({ laufzeitMonate: n || undefined }); return true; }} />}
        {p.basis !== 'einmalig' && <span style={klein}>{p.laufzeitMonate ? 'Monate' : 'Monate (leer = 12 im Gesamtwert)'}</span>}
        {!kleinunternehmer && (
          <select data-ang-feld value={p.ustSatz} disabled={aus} aria-label="Umsatzsteuer" onChange={e => onAendern({ ustSatz: Number(e.target.value) })} onKeyDown={weiter} style={{ ...zelle, width: 92, padding: '6px 8px' }}>
            {UST_SAETZE.map(s => <option key={s} value={s}>{s} % USt</option>)}
          </select>
        )}
        <button onClick={() => setOffen(!offen)} aria-expanded={offen} style={{ background: 'none', border: 'none', color: textFehlt && !p.text.trim() ? LEUCHT.achtung : C.aktiv, cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
          {offen ? 'Text zuklappen' : p.text.trim() ? `Text (${p.text.trim().split(/\s+/).length} Wörter)` : 'Text ergänzen'}{textFehlt ? ' · Produkt ohne Leistungstext' : ''}
        </button>
        {onHoch && <button onClick={onHoch} disabled={aus} aria-label="Nach oben" title="Nach oben" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 13, padding: '0 4px' }}>↑</button>}
      </div>
      {offen && <textarea value={p.text} disabled={aus} rows={Math.min(12, Math.max(3, p.text.split('\n').length + 1))} aria-label="Leistungstext der Position" onChange={e => onAendern({ text: e.target.value })}
        style={{ ...feld, fontSize: TYP.bedien, lineHeight: 1.5, padding: '8px 11px', marginLeft: 26, width: 'calc(100% - 26px)', resize: 'vertical' }} />}
    </div>
  );
}

/** Eine freie Position (ohne Produkt). */
export const freiePosition = (kleinunternehmer: boolean): AngebotPosition => ({ id: neueId('p'), titel: 'Freie Position', text: '', menge: 1, einheit: 'pauschal', einzelpreisCent: 0, ustSatz: kleinunternehmer ? 0 : 19, basis: 'einmalig' });
