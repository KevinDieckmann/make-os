'use client';

// ─── Prozesse · Werkstatt am Handy — Liste der Schritte mit „Bearbeiten“ und die kleine Maske (22.10., E6, Entscheidung „Am Handy Texte & Fristen ändern“) ────────
// Am Handy (schmale Ansicht) steht unter der Fläche die Liste der Phasen und Schritte; „Bearbeiten“ öffnet die Maske mit genau den Feldern, die am Handy änderbar
// sind (lib/prozesse/mobil-felder.ts — Texte, Fristen/Dauer, Zuständige). Bauen bleibt am Rechner. Eingaben 16 px (`eingabe`, iOS zoomt sonst), Tippziele ≥ 44 px
// (DESIGN_STANDARD.md). Rechnet nichts und speichert nichts selbst — `onSpeichern` geht über den Entwurf der Werkstatt (Stand/409, veröffentlichen wie am Rechner).

import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, ZIEL } from '@/lib/make-one/design';
import { Feldzeile, Knopf, eingabe } from '../ui';
import { Fenster } from '../Fenster';
import type { MobilFeld, MobilWerte } from '@/lib/prozesse/mobil-felder';
import { VorlageEingabe } from './WerkstattMaske';

export interface MobilPhase { id: string; titel: string; bearbeitbar?: boolean; schritte: { id: string; titel: string; unter?: string; bearbeitbar?: boolean }[] }

/** Die Liste am Handy: je Phase ihre Schritte, je Eintrag „Bearbeiten“ (nur mit Recht). */
export function MobilSchrittListe({ phasen, darf, onBearbeiten }: { phasen: readonly MobilPhase[]; darf: boolean; onBearbeiten: (id: string) => void }) {
  const knopf = (id: string, titel: string) => (
    <button type="button" className="pz-mobil-bearbeiten" onClick={() => onBearbeiten(id)} aria-label={`„${titel}“ bearbeiten`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap', minHeight: ZIEL.handy, minWidth: ZIEL.handy, padding: '0 12px', borderRadius: 10, border: `1px solid ${C.linie}`, background: 'transparent', color: C.aktiv, fontSize: TYP.bedien, cursor: 'pointer' }}>
      <Pencil size={14} aria-hidden />Bearbeiten
    </button>
  );
  return (
    <section className="pz-mobil-liste" aria-label="Schritte" style={{ display: 'grid', gap: 14 }}>
      {phasen.map(p => (
        <div key={p.id} style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ ...MIKRO }}>{p.titel}</span>
            {darf && p.bearbeitbar && knopf(p.id, p.titel)}
          </div>
          {p.schritte.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: ZIEL.handy, padding: '4px 0', borderBottom: `1px solid ${C.linie}` }}>
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: TYP.body, color: C.ink, overflowWrap: 'anywhere' }}>{s.titel}</span>
                {s.unter && <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{s.unter}</span>}
              </span>
              {darf && s.bearbeitbar !== false && knopf(s.id, s.titel)}
            </div>
          ))}
        </div>
      ))}
      {!darf && <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: 0 }}>Nur ansehen — Texte und Fristen ändern Personen mit dem Recht für Entwürfe.</p>}
    </section>
  );
}

/**
 * Die Maske am Handy: nur die übergebenen Felder; „Speichern“ übergibt die Werte (der Aufrufer schreibt den Entwurf und bestätigt). Texte mit Platzhaltern (Mail)
 * bekommen dieselben Bausteine wie das große Fenster (Platzhalter-Knöpfe an den Cursor, Vorschau mit den Testwerten — Feinschliff 24.10.).
 */
export function MobilMaske({ titel, felder, onSpeichern, onZu, platzhalter }: { titel: string; felder: readonly MobilFeld[]; onSpeichern: (w: MobilWerte) => void; onZu: () => void; platzhalter?: readonly string[] }) {
  const [w, setW] = useState<Record<string, string>>(() => Object.fromEntries(felder.map(f => [f.id, f.wert === null || f.wert === undefined ? '' : String(f.wert)])));
  const setze = (id: string, v: string) => setW(x => ({ ...x, [id]: v }));
  const speichern = (e: FormEvent) => {
    e.preventDefault();
    const raus: Record<string, string | number | null> = {};
    for (const f of felder) {
      const v = w[f.id] ?? '';
      const alt = f.wert === null || f.wert === undefined ? '' : String(f.wert);
      if (v === alt) continue;
      raus[f.id] = f.art === 'zahl' ? (v.trim() === '' ? null : Number(v)) : v === '' ? null : v;
    }
    onSpeichern(raus);
  };
  return (
    <Fenster titel={titel} onZu={onZu} breit={520}>
      <form onSubmit={speichern} style={{ display: 'grid', gap: 12 }}>
        {felder.map(f => (
          <Feldzeile key={f.id} label={f.label}>
            {f.art === 'vorlage'
              ? <VorlageEingabe id={f.id} label={f.label} text={w[f.id] ?? ''} onText={v => setze(f.id, v)} platzhalter={platzhalter} gross />
              : f.art === 'textlang'
              ? <textarea aria-label={f.label} value={w[f.id] ?? ''} rows={4} onChange={e => setze(f.id, e.target.value)} style={{ ...eingabe, resize: 'vertical' }} />
              : f.art === 'wahl'
                ? (
                  <select aria-label={f.label} value={w[f.id] ?? ''} onChange={e => setze(f.id, e.target.value)} style={{ ...eingabe, appearance: 'auto', WebkitAppearance: 'menulist', colorScheme: 'dark' }}>
                    <option value="">— offen —</option>
                    {(f.optionen ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                )
                : <input aria-label={f.label} value={w[f.id] ?? ''} inputMode={f.art === 'zahl' ? 'numeric' : undefined} type={f.art === 'zahl' ? 'number' : 'text'}
                    {...(f.art === 'zahl' ? { min: f.min, max: f.max } : {})} onChange={e => setze(f.id, e.target.value)} style={eingabe} />}
          </Feldzeile>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf haupt typ="submit">Speichern</Knopf>
          <Knopf leise onClick={onZu}>Abbrechen</Knopf>
        </div>
        <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: 0 }}>Gespeichert wird als Entwurf — veröffentlicht wie am Rechner. Schritte anlegen, verschieben und verbinden geht am Rechner.</p>
      </form>
    </Fenster>
  );
}
