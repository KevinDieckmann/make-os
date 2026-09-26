'use client';

// ─── Markttraktion · Marketing — Deal aus Kampagne oder Anfrage (27.09.) ────────────
// Der kleine Bruder von DealAnlegen.tsx für den Fall, dass Quelle und Bezug schon
// feststehen: aus einer Kampagne („Interesse → Lead“ steht) oder aus einer Anfrage.
// Person, Quelle und Bezug sind vorbelegt; Pflicht bleibt der nächste Schritt mit
// Datum. Geschrieben wird über POST /api/crm/deal — der EINE Weg (lib/crm/deal-anlegen.ts):
// Firma per Kennung, Kernfragen vom Lead, Lead wird SQL. Gibt es an der Firma schon
// einen offenen Deal, sagt der Server das — zum Deal springen oder bewusst einen zweiten.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { Knopf, LEUCHT, feld } from '../../schlank';
import { type CrmApi, plusTage } from '../daten';
import { Pillen, Feldzeile } from '../teile';
import type { ChancenArt, Quelle, WertBasis } from '@/lib/crm/typen';

const ARTEN: { id: ChancenArt; label: string }[] = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }];
const QUELLE_LABEL: Record<Quelle, string> = { empfehlung: 'Empfehlung', event: 'Event', content: 'Content', outreach: 'Ansprache', bestand: 'Bestand', inbound: 'Anfrage', kampagne: 'Kampagne' };

export function DealAusQuelle({ api, kontaktId, quelle, quelleBezug, bezugTitel, onFertig, onAbbruch, zuDeal }: {
  api: CrmApi; kontaktId: string;
  quelle: Quelle;
  /** Kennung des Bezugs — Kampagne oder Beitrag. */
  quelleBezug?: string; bezugTitel?: string;
  onFertig: (chanceId: string) => void; onAbbruch: () => void; zuDeal?: (id: string) => void;
}) {
  const heute = api.crm?.heute ?? new Date().toISOString().slice(0, 10);
  const k = (api.kontakte ?? []).find(x => x.id === kontaktId);
  const firma = k?.firmaId ? api.crm?.stand.firmen.find(f => f.id === k.firmaId) : undefined;
  const [titel, setTitel] = useState('');
  const [art, setArt] = useState<ChancenArt>('retainer');
  const [betrag, setBetrag] = useState('');
  const [basis, setBasis] = useState<WertBasis>('monat');
  const [schritt, setSchritt] = useState({ text: '', datum: plusTage(heute, 3) });
  const [fehler, setFehler] = useState<{ text: string; offen?: { id: string; titel: string } } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const bereit = !!k && schritt.text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(schritt.datum);

  const anlegen = async (trotzdem = false) => {
    if (!bereit || laeuft) return;
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/crm/deal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      aktion: 'anlegen', titel: titel.trim() || undefined, kontaktIds: [kontaktId], ...(firma ? { firmaId: firma.id } : {}), art, wert: { betrag: Number(betrag) || 0, basis },
      schritt: { text: schritt.text.trim(), datum: schritt.datum }, quelle, ...(quelleBezug ? { quelleBezug } : {}), trotzdem,
    }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (!r.ok) { setFehler({ text: r.fehler ?? 'Nicht angelegt.', offen: r.offen }); return; }
    void api.laden();
    onFertig(r.chance.id);
  };

  return (
    <div style={{ display: 'grid', gap: 8, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: `1px solid ${LEUCHT.business}33` }}>
      <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Deal aus {QUELLE_LABEL[quelle]}{bezugTitel ? ` „${bezugTitel}“` : ''}</div>
      <div style={{ fontSize: 12.5, color: C.inkDim }}>{k ? anzeigename(k) : 'Person nicht gefunden'}{firma ? ` · ${firma.name}` : k?.firma ? ` · ${k.firma}` : ''} — Quelle „{QUELLE_LABEL[quelle]}“ steht am Deal, der Lead wird SQL.</div>
      <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} placeholder={firma ? `${firma.name} · ${ARTEN.find(a => a.id === art)?.label}` : 'z. B. Acme · Retainer'} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></Feldzeile>
      <Feldzeile label="Art"><Pillen liste={ARTEN} aktiv={art} onWahl={setArt} /></Feldzeile>
      <Feldzeile label="Wert">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder="Betrag €" aria-label="Betrag" style={{ ...feld, width: 120, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <Pillen liste={[{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }]} aktiv={basis} onWahl={setBasis} />
        </div>
      </Feldzeile>
      <Feldzeile label="Nächster Schritt *">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={schritt.text} onChange={e => setSchritt({ ...schritt, text: e.target.value })} placeholder="Was passiert als Nächstes — mit wem?" aria-label="Nächster Schritt" autoFocus style={{ ...feld, flex: 1, minWidth: 200, fontSize: TYP.bedien, padding: '8px 11px' }} />
          <input type="date" value={schritt.datum} onChange={e => setSchritt({ ...schritt, datum: e.target.value })} aria-label="Datum" style={{ ...feld, width: 150, fontSize: TYP.bedien, padding: '8px 11px' }} />
        </div>
      </Feldzeile>
      {fehler && (
        <div style={{ fontSize: 12.5, color: LEUCHT.achtung, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>{fehler.text}</span>
          {fehler.offen && zuDeal && <Knopf leise onClick={() => zuDeal(fehler.offen!.id)}>Zum offenen Deal</Knopf>}
          {fehler.offen && <Knopf leise onClick={() => void anlegen(true)}>Bewusst zweiten anlegen</Knopf>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Knopf farbe={LEUCHT.business} aus={!bereit || laeuft} onClick={() => void anlegen()}>{laeuft ? '…' : 'Deal anlegen'}</Knopf>
        <Knopf leise onClick={onAbbruch}>Abbrechen</Knopf>
      </div>
    </div>
  );
}
