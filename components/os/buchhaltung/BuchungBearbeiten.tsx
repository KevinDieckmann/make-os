'use client';

// ─── Eine Buchung bearbeiten (02.11., Buchhaltung) ──────────────────────────────────────────────────────────────────────────────
// Kategorie, Notiz, Rechnung/Mandat (nur derselben Gesellschaft), Gesellschaft — gespeichert als EIN `teil` mit dem Stand der Zeile (409 → die
// aktuelle Fassung erscheint). „Regel lernen“ schlägt die Gegenseite als Muster vor; rückwirkend wirkt sie erst nach der Vorschau per Klick.
// Der Verwendungszweck ist fremder Text — er wird nur angezeigt, nie weitergegeben.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Knopf, Chip, LEUCHT, feld, auswahl } from '../ui';
import { finanzOrtName, type FinanzOrt } from '@/lib/einheiten';
import { offenGruende, OFFEN_TEXT, ZUORDNEN_TEXT, type BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import { NOTIZ_MAX, type TeilFelder } from '@/lib/finanzen/buchhaltung/teil';
import type { MandatWahl, RechnungZeile } from './daten';

export interface BearbeitenProps {
  b: BhBuchung;
  kategorien: readonly string[];
  /** Wählbare Gesellschaften (Kennungen) dieses Bereichs. */
  orte: readonly string[];
  rechnungen: readonly RechnungZeile[];
  mandate: readonly MandatWahl[];
  gegen: ReadonlySet<string>;
  onSpeichern: (felder: TeilFelder) => Promise<boolean>;
  onRegel: (b: BhBuchung) => Promise<void>;
  onZu: () => void;
}

const zeile = { display: 'grid', gridTemplateColumns: 'minmax(110px, 150px) 1fr', gap: '8px 12px', alignItems: 'center' } as const;
const beschr = { fontSize: TYP.bedien, color: C.inkLeise } as const;

export function BuchungBearbeiten({ b, kategorien, orte, rechnungen, mandate, gegen, onSpeichern, onRegel, onZu }: BearbeitenProps) {
  const [kategorie, setKategorie] = useState(b.kategorie);
  const [notiz, setNotiz] = useState(b.notiz ?? '');
  const [rechnungId, setRechnungId] = useState(b.rechnungId ?? '');
  const [mandatId, setMandatId] = useState(b.mandatId ?? '');
  const [ort, setOrt] = useState(b.ort ?? '');
  const zuLang = notiz.length > NOTIZ_MAX;
  const passendeRechnungen = rechnungen.filter(r => r.firmaId === ort);
  // Mandate derselben Gesellschaft (ohne Gesellschaft am Mandat: wählbar).
  const passendeMandate = mandate.filter(m => !m.einheit || m.einheit === ort);
  const gruende = offenGruende(b, gegen);
  const kats = kategorien.includes(b.kategorie) || !b.kategorie ? kategorien : [b.kategorie, ...kategorien];

  // Nur die geänderten Felder — `null` leert.
  const felder: TeilFelder = {
    ...(kategorie !== b.kategorie ? { kategorie } : {}),
    ...(notiz.trim() !== (b.notiz ?? '') ? { notiz: notiz.trim() || null } : {}),
    ...(rechnungId !== (b.rechnungId ?? '') ? { rechnungId: rechnungId || null } : {}),
    ...(mandatId !== (b.mandatId ?? '') ? { mandatId: mandatId || null } : {}),
    ...(ort && ort !== (b.ort ?? '') ? { ort } : {}),
  };
  const geaendert = Object.keys(felder).length > 0;

  return (
    <div style={{ padding: '12px 4px 6px', display: 'grid', gap: 10 }}>
      {b.zweck && <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{b.zweck}</div>}
      {(!!gruende.length || b.zuordnen) && (
        <div className="ui-pillen">
          {gruende.map(g => <Chip key={g} farbe={LEUCHT.achtung}>{OFFEN_TEXT[g]}</Chip>)}
          {b.zuordnen && <Chip farbe={LEUCHT.achtung}>{ZUORDNEN_TEXT[b.zuordnen]}</Chip>}
        </div>
      )}
      <div style={zeile}>
        <label style={beschr} htmlFor={`bh-k-${b.id}`}>Kategorie</label>
        <select id={`bh-k-${b.id}`} value={kategorie} onChange={e => setKategorie(e.target.value)} style={auswahl}>
          {kats.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <label style={beschr} htmlFor={`bh-o-${b.id}`}>Gesellschaft</label>
        <select id={`bh-o-${b.id}`} value={ort} onChange={e => { setOrt(e.target.value); setRechnungId(''); }} style={auswahl}>
          {!orte.includes(ort) && <option value={ort}>{ort ? finanzOrtName(ort as FinanzOrt) : '—'}</option>}
          {orte.map(o => <option key={o} value={o}>{finanzOrtName(o as FinanzOrt)}</option>)}
        </select>
        {Number(b.betrag) > 0 && <>
          <label style={beschr} htmlFor={`bh-r-${b.id}`}>Rechnung</label>
          <select id={`bh-r-${b.id}`} value={rechnungId} onChange={e => setRechnungId(e.target.value)} style={auswahl}>
            <option value="">keine</option>
            {rechnungId && !passendeRechnungen.some(r => r.id === rechnungId) && <option value={rechnungId}>{rechnungId}</option>}
            {passendeRechnungen.map(r => <option key={r.id} value={r.id}>{[r.nummer, r.kunde, eur(r.betrag)].filter(Boolean).join(' · ')}</option>)}
          </select>
        </>}
        {!!passendeMandate.length && <>
          <label style={beschr} htmlFor={`bh-m-${b.id}`}>Mandat</label>
          <select id={`bh-m-${b.id}`} value={mandatId} onChange={e => setMandatId(e.target.value)} style={auswahl}>
            <option value="">keins</option>
            {mandatId && !passendeMandate.some(m => m.id === mandatId) && <option value={mandatId}>{mandatId}</option>}
            {passendeMandate.map(m => <option key={m.id} value={m.id}>{`${m.firma} · ${m.titel}${m.aktiv ? '' : ' (beendet)'}`}</option>)}
          </select>
        </>}
        <label style={beschr} htmlFor={`bh-n-${b.id}`}>Notiz</label>
        <input id={`bh-n-${b.id}`} value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. wofür, mit wem" style={{ ...feld, width: '100%' }} />
      </div>
      {zuLang && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>Die Notiz ist länger als {NOTIZ_MAX} Zeichen — bitte kürzen, gekürzt wird nie.</div>}
      {b.regel && !b.kategorieHand && <div style={beschr}>Kategorie aus einer Regel — eine Änderung von Hand gewinnt danach immer.</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf aus={!geaendert || zuLang} onClick={async () => { if (await onSpeichern(felder)) onZu(); }}>Speichern</Knopf>
        <Knopf leise onClick={() => onRegel({ ...b, kategorie, ...(ort ? { ort } : {}) })}>Regel lernen</Knopf>
        <Knopf leise onClick={onZu}>Schließen</Knopf>
      </div>
    </div>
  );
}
