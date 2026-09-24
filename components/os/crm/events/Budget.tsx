'use client';

// ─── Event · Budget — Positionen, Summe, Kosten je Folgegespräch, Rendite ───
// Gesamtkosten inklusive eigener Zeit (Stunden × Satz). Die Rendite ist die
// beeinflusste Pipeline geteilt durch die Kosten — Ziel ≥ 5, aussagekräftig
// erst nach 90 Tagen. Ohne Positionen zählt die Pauschale.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Ueberschrift, Knopf, Zahl, Raster, Leer, feld, LEUCHT } from '../../schlank';
import { budgetSumme, VORLAGEN } from '@/lib/crm/eventplanung';
import type { Event } from '@/lib/crm/typen';
import { neueId, euro, plusTage } from '../daten';
import { Feld, Feldzeile } from '../teile';
import { eventSetzen, type ReiterProps } from './gemeinsam';

type Posten = NonNullable<Event['budget']>[number];
/** „1.234,50“, „1500“, „12,5“ oder „12.50“ → Zahl; Punkt als Tausender nur in der Form 1.500. */
const betragAus = (v: string) => {
  const t = v.trim().replace(/\s|€/g, '');
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export function Budget({ e, api }: ReiterProps) {
  const crm = api.crm!;
  const heute = crm.heute;
  const z = crm.events[e.id];
  const [posten, setPosten] = useState('');
  const [betrag, setBetrag] = useState('');
  const liste = e.budget ?? [];
  const summePositionen = liste.reduce((a, b) => a + b.betrag, 0);
  const kosten = budgetSumme(e);
  const speichern = (neu: Posten[]) => eventSetzen(api, e, { budget: neu });
  const aendern = (id: string, teil: Partial<Posten>) => speichern(liste.map(b => (b.id === id ? { ...b, ...teil } : b)));
  const dazu = () => {
    const b = betragAus(betrag || '0');
    if (!posten.trim() || b === null) return;
    void speichern([...liste, { id: neueId('b'), posten: posten.trim(), betrag: b }]);
    setPosten(''); setBetrag('');
  };
  const vorlage = VORLAGEN.find(v => v.format === e.format);
  const rendite = z && kosten ? z.beeinflusst / kosten : null;
  const reif = plusTage(e.datum, 90) <= heute;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Raster min={130}>
        <Zahl wert={kosten ? euro(kosten) : undefined} label={summePositionen > 0 ? 'Gesamtkosten' : e.kostenEuro ? 'Pauschale' : 'noch keine Kosten'} />
        {z && z.da > 0 && kosten > 0 && <Zahl wert={euro(kosten / z.da)} label="je Gast, der da war" />}
        {z?.kostenJeFolgegespraech != null && <Zahl wert={euro(z.kostenJeFolgegespraech)} label="je Folgegespräch" />}
        {rendite !== null && z!.beeinflusst > 0 && <Zahl wert={`${rendite.toLocaleString('de-DE', { maximumFractionDigits: 1 })}×`} label={reif ? 'Rendite (Ziel ≥ 5)' : 'Rendite — reif nach 90 Tagen'} farbe={rendite >= 5 ? LEUCHT.gut : reif ? LEUCHT.achtung : undefined} />}
      </Raster>

      <div>
        <Ueberschrift rechts={summePositionen > 0 ? euro(summePositionen) : undefined}>Positionen</Ueberschrift>
        {liste.map(b => (
          <div key={b.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0' }}>
            <div style={{ flex: 1, minWidth: 0 }}><Feld wert={b.posten} platzhalter="Posten" onFertig={p => (p.trim() ? aendern(b.id, { posten: p.trim() }) : speichern(liste.filter(x => x.id !== b.id)))} /></div>
            <Feld typ="text" wert={b.betrag ? String(b.betrag).replace('.', ',') : ''} breite={120} platzhalter="€" onFertig={v => { const n = betragAus(v || '0'); if (n !== null) void aendern(b.id, { betrag: n }); }} />
            <button onClick={() => speichern(liste.filter(x => x.id !== b.id))} aria-label="Posten entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: TYP.body }}>×</button>
          </div>
        ))}
        {!liste.length && (
          <Leer>
            Noch keine Positionen. Eigene Zeit gehört dazu (Stunden × Satz) — sonst wirkt jedes Event billiger, als es ist.
            {vorlage && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => speichern(vorlage.budget.map(b => ({ ...b, betrag: 0 })))}>Posten „{vorlage.label}“ übernehmen</Knopf></div>}
          </Leer>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
          <input value={posten} onChange={x => setPosten(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') dazu(); }} placeholder="Neuer Posten, z. B. Getränke" aria-label="Neuer Posten"
            style={{ ...feld, flex: 1, minWidth: 180, width: 'auto', fontSize: TYP.bedien, padding: '8px 11px' }} />
          <input value={betrag} onChange={x => setBetrag(x.target.value)} onKeyDown={x => { if (x.key === 'Enter') dazu(); }} placeholder="€" aria-label="Betrag" inputMode="decimal"
            style={{ ...feld, width: 120, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <Knopf leise aus={!posten.trim()} onClick={dazu}>+ Posten</Knopf>
        </div>
      </div>

      {summePositionen === 0 && (
        <Feldzeile label="Pauschal">
          <Feld typ="number" wert={e.kostenEuro ? String(e.kostenEuro) : ''} breite={140} platzhalter="Kosten €" onFertig={k => eventSetzen(api, e, { kostenEuro: Number(k) || undefined })} />
        </Feldzeile>
      )}
      <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>Sobald Positionen einen Betrag haben, ersetzt ihre Summe die Pauschale. Kosten je Folgegespräch: Gespräche mit Gästen innerhalb von 30 Tagen nach dem Event.</div>
    </div>
  );
}
