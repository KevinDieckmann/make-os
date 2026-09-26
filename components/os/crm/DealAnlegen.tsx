'use client';

// ─── Deal anlegen — der eine Dialog (27.09.) ────────────────────────────────
// Von der Pipeline, aus der Karteikarte, aus den Leads: immer dieselben Felder,
// immer über /api/crm/deal. Pflicht ist der nächste Schritt mit Datum. Gibt es
// an der Firma schon einen offenen Deal, sagt der Server das — und man kann
// dorthin springen oder bewusst einen zweiten anlegen.

import { localDay } from '@/lib/zeit';
import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { Knopf, LEUCHT, feld } from '../schlank';
import { type CrmApi, plusTage } from './daten';
import { Pillen, Feldzeile } from './teile';
import { ZustaendigWahl } from './team';
import type { ChancenArt, Quelle, WertBasis } from '@/lib/crm/typen';

const ARTEN: { id: ChancenArt; label: string }[] = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }];
const QUELLEN: { id: Quelle; label: string }[] = [{ id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'outreach', label: 'Ansprache' }, { id: 'bestand', label: 'Bestand' }, { id: 'inbound', label: 'Inbound' }];

export function DealAnlegen({ api, kontaktId, firmaId, quelle: vorgabeQuelle, quelleBezug, onFertig, onAbbruch, zuDeal }: { api: CrmApi; kontaktId?: string; firmaId?: string; quelle?: Quelle; quelleBezug?: string; onFertig: (chanceId: string) => void; onAbbruch: () => void; zuDeal?: (id: string) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const kontakte = api.kontakte ?? [];
  const firmen = api.crm?.stand.firmen ?? [];
  const [suche, setSuche] = useState('');
  const [personen, setPersonen] = useState<string[]>(kontaktId ? [kontaktId] : []);
  const [firma, setFirma] = useState<string | undefined>(firmaId ?? (kontaktId ? kontakte.find(k => k.id === kontaktId)?.firmaId : undefined));
  const [titel, setTitel] = useState('');
  const [art, setArt] = useState<ChancenArt>('retainer');
  const [betrag, setBetrag] = useState('');
  const [basis, setBasis] = useState<WertBasis>('monat');
  const [laufzeit, setLaufzeit] = useState('');
  const [schritt, setSchritt] = useState({ text: '', datum: plusTage(heute, 3) });
  const [quelle, setQuelle] = useState<Quelle | undefined>(vorgabeQuelle);
  const [besitzer, setBesitzer] = useState<string | undefined>(undefined);
  const [erwartetAm, setErwartetAm] = useState('');
  const [fehler, setFehler] = useState<{ text: string; offen?: { id: string; titel: string } } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const treffer = suche.trim().length >= 2 ? kontakte.filter(k => !personen.includes(k.id) && `${anzeigename(k)} ${k.firma ?? ''}`.toLowerCase().includes(suche.toLowerCase())).slice(0, 6) : [];
  const firmenTreffer = suche.trim().length >= 2 && !firma ? firmen.filter(f => f.name.toLowerCase().includes(suche.toLowerCase())).slice(0, 4) : [];
  const f = firma ? firmen.find(x => x.id === firma) : undefined;
  const bereit = (personen.length || firma) && schritt.text.trim() && schritt.datum;

  const anlegen = async (trotzdem = false) => {
    if (!bereit || laeuft) return;
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/crm/deal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      aktion: 'anlegen', titel: titel.trim() || undefined, kontaktIds: personen, firmaId: firma, art, wert: { betrag: Number(betrag) || 0, basis, laufzeitMonate: Number(laufzeit) || undefined },
      schritt, quelle, ...(quelle && quelle === vorgabeQuelle && quelleBezug ? { quelleBezug } : {}), besitzer, erwartetAm: erwartetAm || undefined, trotzdem,
    }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (!r.ok) { setFehler({ text: r.fehler ?? 'Nicht angelegt.', offen: r.offen }); return; }
    void api.laden();
    onFertig(r.chance.id);
  };

  return (
    <div style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: `1px solid ${LEUCHT.business}33` }}>
      <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Neuer Deal</div>
      <Feldzeile label="Firma">
        {f ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>{f.name}</span><button onClick={() => setFirma(undefined)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>
          : <span style={{ fontSize: 12.5, color: C.inkLeise }}>aus der ersten Person, oder unten suchen</span>}
      </Feldzeile>
      <Feldzeile label="Personen">
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personen.map(id => { const k = kontakte.find(x => x.id === id); return k ? <span key={id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: '3px 10px', fontSize: 12.5 }}>{anzeigename(k)}<button onClick={() => setPersonen(personen.filter(x => x !== id))} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', padding: 0 }}>✕</button></span> : null; })}
          </div>
          <input value={suche} onChange={e => setSuche(e.target.value)} placeholder="Person oder Firma suchen …" style={{ ...feld }} autoFocus={!kontaktId} />
          {(treffer.length > 0 || firmenTreffer.length > 0) && (
            <div style={{ display: 'grid', gap: 3 }}>
              {firmenTreffer.map(x => <button key={x.id} onClick={() => { setFirma(x.id); setSuche(''); }} style={{ textAlign: 'left', background: 'rgba(255,255,255,.04)', border: 'none', borderRadius: 8, padding: '6px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>🏢 {x.name}</button>)}
              {treffer.map(k => <button key={k.id} onClick={() => { setPersonen([...personen, k.id]); if (!firma && k.firmaId) setFirma(k.firmaId); setSuche(''); }} style={{ textAlign: 'left', background: 'rgba(255,255,255,.04)', border: 'none', borderRadius: 8, padding: '6px 10px', color: C.ink, cursor: 'pointer', fontSize: TYP.bedien }}>{anzeigename(k)}{k.firma ? <span style={{ color: C.inkLeise }}> · {k.firma}</span> : null}</button>)}
            </div>
          )}
        </div>
      </Feldzeile>
      <Feldzeile label="Titel"><input value={titel} onChange={e => setTitel(e.target.value)} placeholder={f ? `${f.name} · ${ARTEN.find(a => a.id === art)?.label}` : 'z. B. Acme · Retainer'} style={{ ...feld }} /></Feldzeile>
      <Feldzeile label="Art"><Pillen liste={ARTEN} aktiv={art} onWahl={setArt} /></Feldzeile>
      <Feldzeile label="Wert">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder="Betrag €" style={{ ...feld, width: 120 }} />
          <Pillen liste={[{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }]} aktiv={basis} onWahl={setBasis} />
          {basis !== 'einmalig' && <input type="number" value={laufzeit} onChange={e => setLaufzeit(e.target.value)} placeholder="Monate" style={{ ...feld, width: 100 }} />}
        </div>
      </Feldzeile>
      <Feldzeile label="Nächster Schritt *">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={schritt.text} onChange={e => setSchritt({ ...schritt, text: e.target.value })} placeholder="Was passiert als Nächstes — mit wem?" style={{ ...feld, flex: 1, minWidth: 220 }} />
          <input type="date" value={schritt.datum} onChange={e => setSchritt({ ...schritt, datum: e.target.value })} style={{ ...feld, width: 150 }} aria-label="Datum" />
        </div>
      </Feldzeile>
      <Feldzeile label="Entscheidung bis"><input type="date" value={erwartetAm} onChange={e => setErwartetAm(e.target.value)} style={{ ...feld, width: 150 }} aria-label="Entscheidung bis" /></Feldzeile>
      <Feldzeile label="Quelle"><Pillen liste={QUELLEN} aktiv={quelle} onWahl={setQuelle} /></Feldzeile>
      <Feldzeile label="Führt"><ZustaendigWahl wert={besitzer} welt="sales" onWahl={setBesitzer} beide={false} /></Feldzeile>
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
