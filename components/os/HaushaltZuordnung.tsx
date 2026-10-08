'use client';

// ─── Wer gehört zu welchem Haushalt? (Konto-Seite, nur Inhaber) ─────────────
// Private Finanzen sieht nur, wer einem Haushalt zugeordnet ist — dem Haushalt der Inhaber (kommt vom Server, nie ein Name im Code;
// 09.10.). Alle anderen: kein Haushalt — auch keine Summen. Solange es mehrere Inhaber gibt, bleibt ihr Haushalt (Server 409).

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, LEUCHT } from './ui';

/** Ohne Haushalt der Inhaber (Erstkonto noch ohne Zuordnung) ein neutraler Name. */
const ERSATZ = 'haushalt';
interface K { speicher: string; name: string; rolle: string; haushalt: string | null }

export function HaushaltZuordnung() {
  const [konten, setKonten] = useState<K[] | null>(null);
  const [standard, setStandard] = useState(ERSATZ);
  const [meldung, setMeldung] = useState('');
  const laden = () => fetch('/api/konto/haushalt').then(r => r.json()).then(d => { setKonten(d.ok ? d.konten : null); setStandard(d.haushalt ?? ERSATZ); }).catch(() => setKonten(null));
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
      <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 6 }}>Wer eure privaten Finanzen unter „Finanzen › Privat“ sieht und pflegt. Alle anderen Konten sehen davon nichts, auch keine Summen.</div>
      <Liste>
        {konten.map(k => (
          <Zeile key={k.speicher} titel={k.name} unter={k.haushalt ? `Haushalt „${k.haushalt}“` : 'kein Zugang'}
            rechts={k.haushalt ? <Knopf leise onClick={() => void setze(k.speicher, null)}>Entziehen</Knopf> : <Knopf farbe={LEUCHT.geld} onClick={() => void setze(k.speicher, standard)}>Freischalten</Knopf>} />
        ))}
      </Liste>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
    </Karte>
  );
}
