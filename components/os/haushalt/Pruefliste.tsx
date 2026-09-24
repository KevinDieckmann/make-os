'use client';

// Prüfliste — private Einträge, die noch in den Business-Speichern stehen.
// Je Eintrag ein Vorschlag, ihr entscheidet. Vor dem Anwenden wird archiviert.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import { AKTION_TEXT, type Aktion, type Pruefposten, type Quelle } from '@/lib/finanzen/haushalt/entflechtung';
import { Knopf, LEUCHT } from '../schlank';
import { Dialog, auswahl } from './gemeinsam';

const QUELLE: Record<Quelle, string> = { firma: 'Konto im Firmen-Finanzplan', zahlung: 'Zahlungen', merkposten: 'Kredite & Merkposten', rechnung: 'Forderungen', buchung: 'Buchungen', planposten: 'Liquiditäts-Planposten' };

export function PrueflisteDialog({ onZu, laden, melde }: { onZu: () => void; laden: () => Promise<void>; melde: (art: 'ok' | 'fehler' | 'info', titel: string, text?: string) => void }) {
  const [posten, setPosten] = useState<Pruefposten[] | null>(null);
  const [leer, setLeer] = useState(false);
  const [wahl, setWahl] = useState<Record<string, Aktion>>({});
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    fetch('/api/haushalt/pruefliste').then(r => r.json()).then(d => {
      if (!d.ok) return;
      setPosten(d.posten); setLeer(d.haushaltLeer);
      setWahl(Object.fromEntries((d.posten as Pruefposten[]).map(p => [`${p.quelle}|${p.id}`, p.vorschlag])));
    }).catch(() => setPosten([]));
  }, []);
  const aenderungen = Object.values(wahl).filter(a => a !== 'behalten').length;

  async function anwenden() {
    setLaeuft(true);
    const entscheidungen = Object.entries(wahl).map(([k, aktion]) => { const [quelle, id] = k.split('|'); return { quelle, id, aktion }; });
    const d = await fetch('/api/haushalt/pruefliste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entscheidungen }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'nicht erreichbar' }));
    setLaeuft(false);
    if (!d.ok) { melde('fehler', 'Nicht angewandt', d.fehler); return; }
    melde('ok', 'Aufgeräumt', `${d.angewandt} Einträge verschoben, entfernt oder zugeordnet. Der alte Stand liegt im Archiv.`);
    await laden(); onZu();
  }

  const gruppen = Array.from(new Set((posten ?? []).map(p => p.quelle)));
  return (
    <Dialog titel="Privates aus den Business-Zahlen aufräumen" onZu={onZu} aktionen={<Knopf farbe={LEUCHT.geld} aus={laeuft || !aenderungen} onClick={() => void anwenden()}>{aenderungen ? `${aenderungen} Entscheidungen anwenden` : 'Nichts zu tun'}</Knopf>}>
      <div style={{ color: C.inkDim }}>Diese Einträge stehen noch in den Speichern der Firmen, sind aber privat. Die Business-Zahlen rechnen sie schon nicht mehr mit — hier räumt ihr sie weg. Vorgeschlagen ist, was der Abgleich mit euren Haushaltsdaten ergibt. Vor dem Anwenden wird der alte Stand archiviert.</div>
      {leer && <div style={{ color: LEUCHT.achtung }}>Euer Haushalt ist noch leer. Erst den Umzug aus Malins Cockpit machen — dann erkennt die Liste Doppelte.</div>}
      {posten === null && <div style={{ color: C.inkLeise }}>Lese …</div>}
      {posten?.length === 0 && <div style={{ color: LEUCHT.gut }}>Nichts Privates mehr in den Business-Speichern.</div>}
      {gruppen.map(q => (
        <div key={q}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', margin: '6px 0' }}>{QUELLE[q]}</div>
          {posten!.filter(p => p.quelle === q).map(p => {
            const k = `${p.quelle}|${p.id}`;
            return (
              <div key={k} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong style={{ fontSize: TYP.bedien }}>{p.titel}</strong>
                  {p.betrag !== null && <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{eur(p.betrag)}</span>}
                </div>
                <div style={{ fontSize: 12, color: C.inkLeise }}>{p.unter}</div>
                {p.treffer && <div style={{ fontSize: 12, color: LEUCHT.gut }}>passt zu: {p.treffer}</div>}
                <div style={{ fontSize: 12, color: C.inkDim }}>{p.grund}</div>
                <select aria-label="Entscheidung" value={wahl[k]} onChange={e => setWahl(w => ({ ...w, [k]: e.target.value as Aktion }))} style={{ ...auswahl, padding: '5px 8px', fontSize: 12.5 }}>
                  {p.aktionen.map(a => <option key={a} value={a}>{AKTION_TEXT[a]}{a === p.vorschlag ? ' (Vorschlag)' : ''}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      ))}
    </Dialog>
  );
}
