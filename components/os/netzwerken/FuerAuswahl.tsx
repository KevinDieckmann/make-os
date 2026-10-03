'use client';

// ─── Netzwerken — „Für wen“ am Handy (03.10.) ────────────────────────────────
// Ein besuchtes Event läuft für MAKE selbst oder für einen Kunden (Firma der Kartei). Zwei große Chips, bei „Kunde“ eine Suche
// mit großen Treffern — kein Menü am Rand, alles mit dem Daumen. Gilt für „Neues Event“ in „Heute bei“ und zum Ändern am
// gewählten Event; die Regeln (Säuberung, Firma vorhanden) prüft der Server. Kontakte für Kunden: eigener Verantwortlicher, Übergabe = Übermittlung (netz-recht).

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, LEUCHT } from '@/lib/make-one/design';
import type { EventFuer, Firma } from '@/lib/crm/typen';
import { Wahl, Hinweis, eingabe, ZIEL } from './bausteine';

export function FuerAuswahl({ firmen, wert, onWahl }: { firmen: readonly Firma[]; wert: EventFuer; onWahl: (f: EventFuer) => void }) {
  const [suche, setSuche] = useState('');
  const kunde = wert.art === 'kunde' ? firmen.find(f => f.id === wert.firmaId) : undefined;
  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (q.length < 2) return [];
    return [...firmen].filter(f => f.name.toLowerCase().includes(q)).sort((a, b) => Number(b.rolle === 'kunde') - Number(a.rolle === 'kunde') || a.name.localeCompare(b.name, 'de')).slice(0, 6);
  }, [firmen, suche]);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Wahl an={wert.art === 'make'} onClick={() => { onWahl({ art: 'make' }); setSuche(''); }}>MAKE selbst</Wahl>
        <Wahl an={wert.art === 'kunde'} farbe={LEUCHT.business} onClick={() => { if (wert.art !== 'kunde') onWahl({ art: 'kunde', firmaId: '' }); }}>Für einen Kunden</Wahl>
      </div>
      {wert.art === 'kunde' && (
        <>
          {kunde && <Hinweis farbe={LEUCHT.business} rolle="status">Für <b>{kunde.name}</b></Hinweis>}
          <input value={suche} onChange={x => setSuche(x.target.value)} placeholder={kunde ? 'Anderen Kunden suchen …' : 'Kunde suchen (Firma aus der Kartei) …'} aria-label="Kunde suchen" style={eingabe} />
          {treffer.map(f => (
            <button key={f.id} type="button" onClick={() => { onWahl({ art: 'kunde', firmaId: f.id }); setSuche(''); }} className="fassbar"
              style={{ minHeight: ZIEL, textAlign: 'left', padding: '10px 14px', borderRadius: 14, cursor: 'pointer', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}>
              {f.name}{f.rolle === 'kunde' && <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontWeight: 500 }}> · Kunde</span>}
            </button>
          ))}
          {suche.trim().length >= 2 && !treffer.length && <div style={{ fontSize: 14, color: C.inkLeise }}>Keine Firma gefunden — sie muss zuerst in der Kartei stehen.</div>}
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.45 }}>Kontakte für Kunden gehören auch uns. Die Person erfährt in der Danke-Mail, dass die Daten an den Kunden gehen. Herkunft und „keine Werbe-Einwilligung“ bleiben vermerkt.</div>
        </>
      )}
    </div>
  );
}

/** Die gültige Wahl: „Kunde“ ohne Firma zählt nicht (die Oberfläche fragt dann nach dem Kunden). */
export const fuerGueltig = (f: EventFuer): boolean => f.art === 'make' || !!f.firmaId;
