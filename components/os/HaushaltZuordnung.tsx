'use client';

// ─── Wer gehört zu welchem Haushalt? (Konto-Seite, nur Inhaber) ─────────────
// Private Finanzen sieht nur, wer einem Haushalt zugeordnet ist — dem Haushalt der Inhaber (kommt vom Server, nie ein Name im Code;
// 09.10.). Alle anderen: kein Haushalt — auch keine Summen. Solange es mehrere Inhaber gibt, bleibt ihr Haushalt (Server 409).
// Generalprobe Neustart (09.10. abends): hat der Inhaber noch KEINEN Haushalt (erstes Konto einer neuen Instanz), wird der Name eingetippt —
// vorbelegt mit dem Namen, unter dem schon Bestände liegen (`vorschlaege` vom Server, z. B. nach dem Neustart-Umzug). Vorher setzte
// „Freischalten“ fest „haushalt“, und die übernommenen CRM-/Aufgaben-Dateien und die Sperrliste waren nicht zu finden.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Knopf, LEUCHT, Feldzeile, feld } from './ui';

/** Ohne Haushalt der Inhaber (Erstkonto noch ohne Zuordnung) ein neutraler Name. */
const ERSATZ = 'haushalt';
interface K { speicher: string; name: string; rolle: string; haushalt: string | null }

export function HaushaltZuordnung() {
  const [konten, setKonten] = useState<K[] | null>(null);
  const [standard, setStandard] = useState(ERSATZ);
  // Noch kein Haushalt der Inhaber: der Name wird eingetippt (vorbelegt mit dem ersten Vorschlag des Servers).
  const [offen, setOffen] = useState(false);
  const [vorschlaege, setVorschlaege] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [meldung, setMeldung] = useState('');
  const laden = () => fetch('/api/konto/haushalt').then(r => r.json()).then(d => {
    setKonten(d.ok ? d.konten : null);
    setStandard(d.haushalt ?? ERSATZ);
    setOffen(d.ok && !d.haushalt);
    const v: string[] = Array.isArray(d.vorschlaege) ? d.vorschlaege : [];
    setVorschlaege(v);
    setName(n => n || v[0] || ERSATZ);
  }).catch(() => setKonten(null));
  useEffect(() => { void laden(); }, []);
  if (!konten) return null;
  const nameSauber = name.trim().toLowerCase();
  const nameOk = /^[a-z0-9][a-z0-9-]{0,39}$/.test(nameSauber);
  async function setze(speicher: string, haushalt: string | null) {
    const r = await fetch('/api/konto/haushalt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speicher, haushalt }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setMeldung(r.ok ? (haushalt ? 'Freigeschaltet.' : 'Zugang entzogen.') : r.fehler);
    void laden();
  }
  return (
    <Karte i={5} akzent={LEUCHT.geld}>
      <Ueberschrift farbe={LEUCHT.geld}>Haushaltsfinanzen</Ueberschrift>
      <div style={{ fontSize: 13, color: C.inkDim, marginBottom: 6 }}>Wer eure privaten Finanzen unter „Finanzen › Privat“ sieht und pflegt. Alle anderen Konten sehen davon nichts, auch keine Summen.</div>
      {offen && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
          <Feldzeile label="Name des Haushalts" fehler={name && !nameOk ? 'Nur Kleinbuchstaben, Ziffern und Bindestrich (höchstens 40 Zeichen).' : undefined}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="z. B. familie-muster" aria-label="Name des Haushalts" autoComplete="off" spellCheck={false} style={feld} />
          </Feldzeile>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>
            {vorschlaege.length
              ? <>Hier liegen schon Daten unter {vorschlaege.map((v, i) => <span key={v}>{i ? ', ' : ''}<button type="button" onClick={() => setName(v)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>„{v}“</button></span>)} — nach einem Neustart genau diesen Namen nehmen (er steht auch im Bericht des Umzugs).</>
              : 'Ein kurzer Name ohne Leerzeichen. Er gilt für alle Konten dieses Haushalts und lässt sich später nicht einfach ändern.'}
          </div>
        </div>
      )}
      <Liste>
        {konten.map(k => (
          <Zeile key={k.speicher} titel={k.name} unter={k.haushalt ? `Haushalt „${k.haushalt}“` : 'kein Zugang'}
            rechts={k.haushalt ? <Knopf leise onClick={() => void setze(k.speicher, null)}>Entziehen</Knopf>
              : <Knopf farbe={LEUCHT.geld} aus={offen && !nameOk} onClick={() => void setze(k.speicher, offen ? nameSauber : standard)}>{offen ? `Haushalt „${nameOk ? nameSauber : '…'}“` : 'Freischalten'}</Knopf>} />
        ))}
      </Liste>
      {meldung && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
    </Karte>
  );
}
