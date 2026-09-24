'use client';

// ─── Wer gehört zu welchem Haushalt? (Konto-Seite, nur Inhaber) ─────────────
// Private Finanzen sieht nur, wer einem Haushalt zugeordnet ist. Kevin und
// Malin: „kevin-malin“. Alle anderen: kein Haushalt — auch keine Summen.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, LEUCHT } from './schlank';

const STANDARD = 'kevin-malin';
interface K { speicher: string; name: string; rolle: string; haushalt: string | null }

export function HaushaltZuordnung() {
  const [konten, setKonten] = useState<K[] | null>(null);
  const [meldung, setMeldung] = useState('');
  const laden = () => fetch('/api/konto/haushalt').then(r => r.json()).then(d => setKonten(d.ok ? d.konten : null)).catch(() => setKonten(null));
  useEffect(() => { void laden(); }, []);
  if (!konten) return null;
  async function setze(speicher: string, haushalt: string | null) {
    const r = await fetch('/api/konto/haushalt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speicher, haushalt }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setMeldung(r.ok ? (haushalt ? 'Freigeschaltet.' : 'Zugang entzogen.') : r.fehler);
    void laden();
  }
  return (
    <Karte i={5} akzent={LEUCHT.geld}>
      <Ueberschrift farbe={LEUCHT.geld}>Haushaltsfinanzen</Ueberschrift>
      <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 6 }}>Wer eure privaten Finanzen unter „Zahlen → Privat“ sieht und pflegt. Alle anderen Konten sehen davon nichts, auch keine Summen.</div>
      <Liste>
        {konten.map(k => (
          <Zeile key={k.speicher} titel={k.name} unter={k.haushalt ? `Haushalt „${k.haushalt}“` : 'kein Zugang'}
            rechts={k.haushalt ? <Knopf leise onClick={() => void setze(k.speicher, null)}>Entziehen</Knopf> : <Knopf farbe={LEUCHT.geld} onClick={() => void setze(k.speicher, STANDARD)}>Freischalten</Knopf>} />
        ))}
      </Liste>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
    </Karte>
  );
}
