'use client';

// ─── Deal anlegen — der eine Dialog (27.09.) ────────────────────────────────
// Von der Pipeline, aus der Karteikarte, aus den Leads: immer dieselben Felder,
// immer über /api/crm/deal. Pflicht ist der nächste Schritt mit Datum. Gibt es
// an der Firma schon einen offenen Deal, sagt der Server das — und man kann
// dorthin springen oder bewusst einen zweiten anlegen.
// Woche 1 (08.10.): die Quelle bleibt ohne Wahl leer — der Server leitet sie aus der Herkunft des Leads ab (2.5); wer „führt“, kann
// der Aufrufer vorbelegen (2.9, „+ Deal für <Person>“); ist der Lead nicht SQL-bereit, wird der Deal „direkt angelegt“ (2.3, Antworttext).

import { localDay } from '@/lib/zeit';
import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { anzeigename } from '@/lib/make-one/crm';
import { Knopf, LEUCHT, feld } from '../ui';
import { type CrmApi, plusTage } from './daten';
import { Feldzeile } from './teile';
import { Wahl } from './Wahl';
import { ZustaendigWahl } from './team';
import type { ChancenArt, Gesellschaft, Quelle, WertBasis } from '@/lib/crm/typen';
import { dealWertAusProdukt, mandatArtVon } from '@/lib/crm/produkt-karte';

const ARTEN: { id: ChancenArt; label: string }[] = [{ id: 'retainer', label: 'Retainer' }, { id: 'projekt', label: 'Projekt' }, { id: 'workshop', label: 'Workshop' }, { id: 'vermittlung', label: 'Vermittlung' }, { id: 'software', label: 'Software' }];
const BASEN: { id: WertBasis; label: string }[] = [{ id: 'monat', label: 'je Monat' }, { id: 'jahr', label: 'je Jahr' }, { id: 'einmalig', label: 'einmalig' }];
const QUELLEN: { id: Quelle; label: string }[] = [{ id: 'empfehlung', label: 'Empfehlung' }, { id: 'event', label: 'Event' }, { id: 'content', label: 'Content' }, { id: 'kampagne', label: 'Kampagne' }, { id: 'outreach', label: 'Ansprache' }, { id: 'bestand', label: 'Bestand' }, { id: 'inbound', label: 'Inbound' }];

export function DealAnlegen({ api, kontaktId, firmaId, quelle: vorgabeQuelle, quelleBezug, art: vorgabeArt, besitzer: vorgabeBesitzer, onFertig, onAbbruch, zuDeal }: { api: CrmApi; kontaktId?: string; firmaId?: string; quelle?: Quelle; quelleBezug?: string; /** Vorbelegte Art (z. B. „Vermittlung“ aus der Schnellleiste am Handy). */ art?: ChancenArt; /** Wer den Deal führt — vorbelegt (2.9), sonst entscheidet der Server (Lead, sonst die Person). */ besitzer?: string; onFertig: (chanceId: string, text?: string) => void; onAbbruch: () => void; zuDeal?: (id: string) => void }) {
  const heute = api.crm?.heute ?? localDay();
  const kontakte = api.kontakte ?? [];
  const firmen = api.crm?.stand.firmen ?? [];
  const [suche, setSuche] = useState('');
  const [personen, setPersonen] = useState<string[]>(kontaktId ? [kontaktId] : []);
  const [firma, setFirma] = useState<string | undefined>(firmaId ?? (kontaktId ? kontakte.find(k => k.id === kontaktId)?.firmaId : undefined));
  const [titel, setTitel] = useState('');
  const [art, setArt] = useState<ChancenArt>(vorgabeArt ?? 'retainer');
  const [betrag, setBetrag] = useState('');
  const [basis, setBasis] = useState<WertBasis>('monat');
  const [laufzeit, setLaufzeit] = useState('');
  // 24.10. (Bau-Test): Produkt am Deal — belegt Wert (laufend + einmalig getrennt), Art und Gesellschaft vor; nur aktive Produkte.
  const [leistungId, setLeistungId] = useState<string | undefined>(undefined);
  const [einmal, setEinmal] = useState('');
  // 25.10.: geplante Tages-/Stundensätze aus dem Produkt — gehen mit, solange der Monatswert der Vorgabe des Produkts entspricht.
  const [produktWert, setProduktWert] = useState<ReturnType<typeof dealWertAusProdukt>>(null);
  const [gesellschaft, setGesellschaft] = useState<Gesellschaft | undefined>(undefined);
  const produkte = (api.crm?.stand.leistungen ?? []).filter(l => l.status === 'aktiv' && !l.geloeschtAm);
  const produktWahl = (id: string) => {
    const l = produkte.find(x => x.id === id);
    if (!l) return;
    setLeistungId(l.id);
    setArt(mandatArtVon(l));
    if (l.gesellschaft && l.gesellschaft !== 'offen') setGesellschaft(l.gesellschaft);
    const w = dealWertAusProdukt(l);
    if (w && !betrag) { setBetrag(String(w.betrag)); setBasis(w.basis); setLaufzeit(w.laufzeitMonate ? String(w.laufzeitMonate) : ''); setEinmal(w.einmalBetrag ? String(w.einmalBetrag) : ''); setProduktWert(w); }
  };
  const [schritt, setSchritt] = useState({ text: '', datum: plusTage(heute, 3) });
  const [quelle, setQuelle] = useState<Quelle | undefined>(vorgabeQuelle);
  const [besitzer, setBesitzer] = useState<string | undefined>(vorgabeBesitzer && vorgabeBesitzer !== 'beide' ? vorgabeBesitzer : undefined);
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
      aktion: 'anlegen', titel: titel.trim() || undefined, kontaktIds: personen, firmaId: firma, art, wert: { betrag: Number(betrag) || 0, basis, laufzeitMonate: Number(laufzeit) || undefined, ...(basis !== 'einmalig' && Number(einmal) > 0 ? { einmalBetrag: Number(einmal) } : {}), ...(produktWert?.geplantBetrag && basis === 'monat' && Number(betrag) === produktWert.betrag ? { geplantBetrag: produktWert.geplantBetrag, ...(produktWert.geplantSatz ? { geplantSatz: produktWert.geplantSatz } : {}) } : {}) },
      ...(leistungId ? { leistungId } : {}), ...(gesellschaft ? { gesellschaft } : {}),
      schritt, quelle, ...(quelle && quelle === vorgabeQuelle && quelleBezug ? { quelleBezug } : {}), besitzer, erwartetAm: erwartetAm || undefined, trotzdem,
    }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (!r.ok) { setFehler({ text: r.fehler ?? 'Nicht angelegt.', offen: r.offen }); return; }
    void api.laden();
    onFertig(r.chance.id, typeof r.text === 'string' ? r.text : undefined);
  };

  return (
    <div className="deal-anlegen" style={{ display: 'grid', gap: 10, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,.03)', border: `1px solid ${LEUCHT.business}33` }}>
      <div style={{ fontSize: TYP.body, fontWeight: 700 }}>Neuer Deal</div>
      <Feldzeile label="Firma">
        {f ? <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span>{f.name}</span><button onClick={() => setFirma(undefined)} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer' }}>✕</button></div>
          : <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>aus der ersten Person, oder unten suchen</span>}
      </Feldzeile>
      <Feldzeile label="Personen">
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {personen.map(id => { const k = kontakte.find(x => x.id === id); return k ? <span key={id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: 'rgba(255,255,255,.06)', borderRadius: 999, padding: '3px 10px', fontSize: TYP.bedien }}>{anzeigename(k)}<button onClick={() => setPersonen(personen.filter(x => x !== id))} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', padding: 0 }}>✕</button></span> : null; })}
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
      <Feldzeile label="Produkt">
        <Wahl label="Produkt" liste={produkte.map(l => ({ id: l.id, label: l.name }))} wert={leistungId} leer="+ Produkt wählen" onWahl={produktWahl} onLeeren={() => setLeistungId(undefined)} />
      </Feldzeile>
      <Feldzeile label="Art"><Wahl label="Art" liste={ARTEN} wert={art} onWahl={setArt} /></Feldzeile>
      <Feldzeile label="Wert">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="number" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder="Betrag €" aria-label="Betrag" style={{ ...feld, width: 120 }} />
          <Wahl label="Wert-Basis" liste={BASEN} wert={basis} onWahl={setBasis} />
          {basis !== 'einmalig' && <input type="number" value={laufzeit} onChange={e => setLaufzeit(e.target.value)} placeholder="Monate" aria-label="Laufzeit in Monaten" style={{ ...feld, width: 100 }} />}
          {basis !== 'einmalig' && <input type="number" value={einmal} onChange={e => setEinmal(e.target.value)} placeholder="+ einmalig €" aria-label="Einmaliger Anteil" style={{ ...feld, width: 130 }} />}
        </div>
      </Feldzeile>
      <Feldzeile label="Nächster Schritt *">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={schritt.text} onChange={e => setSchritt({ ...schritt, text: e.target.value })} placeholder="Was passiert als Nächstes — mit wem?" style={{ ...feld, flex: 1, minWidth: 220 }} />
          <input type="date" value={schritt.datum} onChange={e => setSchritt({ ...schritt, datum: e.target.value })} style={{ ...feld, width: 150 }} aria-label="Datum" />
        </div>
      </Feldzeile>
      <Feldzeile label="Entscheidung bis"><input type="date" value={erwartetAm} onChange={e => setErwartetAm(e.target.value)} style={{ ...feld, width: 150 }} aria-label="Entscheidung bis" /></Feldzeile>
      <Feldzeile label="Quelle"><Wahl label="Quelle" liste={QUELLEN} wert={quelle} leer="aus der Herkunft ▾" onWahl={setQuelle} onLeeren={() => setQuelle(undefined)} leerenLabel="aus der Herkunft" /></Feldzeile>
      <Feldzeile label="Führt"><ZustaendigWahl wert={besitzer} welt="sales" onWahl={setBesitzer} beide={false} /></Feldzeile>
      {fehler && (
        <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
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
