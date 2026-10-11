'use client';

// ─── Fulfillment › Fall › Wert-Konto (Paket C1, 10.10.; FULFILLMENT_KONZEPT.md 7.5) ──────────────────────────────────────────────────
// Das gemeinsame Zielbild des Kunden: je Ziel des Mandats (`Mandat.ziele` bleibt die Wahrheit für „was ist das Ziel“) Ausgang, Zielwert,
// Einheit und Datum — im Kick-off „festlegen“. Messwerte trägt nur MAKE ein (Entscheidung 10.10.); jede Messung schreibt im selben Klick den Ist-Wert am
// Mandat, damit der heutige Report richtig bleibt. Ein neues Ziel legt zuerst die Zeile am Mandat an. Keine Garantie, kein Erfolgshonorar.
// 11.10. (Design): je Ziel zuerst das Bild — „vorher → jetzt → Ziel“ als Balken mit Prozent des Wegs und Verlauf —, darunter die häufige Handlung
// (Messung eintragen). Die Zielwerte selbst stehen offen, solange das Ziel nicht festgelegt ist; danach klappen sie hinter „Zielwerte ändern“.

import { useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Hinweis, Chip, Feldzeile, Pillen, LEUCHT } from '../../ui';
import { zielErreichung, wertReihe } from '@/lib/fulfillment/prozesse/wert';
import { localDay } from '@/lib/zeit';
import type { WertKontoEintrag } from '@/lib/fulfillment/typen';
import { useFall, fallOps, fehlerText, tagKurz, type FallAntwort } from './daten';
import { klein, feld, Leiste, Meldung } from './teile';
import { WertBalken } from '../reise/bilder';

export function FallWert({ mandatId }: { mandatId: string }) {
  const { daten, fehler } = useFall(mandatId);
  const [meldung, setMeldung] = useState<{ text: string; art: 'gut' | 'kritisch' | 'achtung' } | null>(null);
  const [neu, setNeu] = useState('');
  if (!daten) return fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : <div style={klein}>Lädt …</div>;
  if (!daten.fall) return <Hinweis art="info">Für dieses Mandat läuft noch kein Fall — unter „Überblick“ das Onboarding starten.</Hinweis>;
  const ops = async (o: Record<string, unknown>[], gut?: string) => {
    const a = await fallOps(mandatId, o);
    if (!a.ok) setMeldung({ text: fehlerText(a), art: 'kritisch' });
    else if (a.j.nachzug?.fehler) setMeldung({ text: `Gespeichert, aber nicht am Mandat nachgezogen: ${a.j.nachzug.fehler}`, art: 'achtung' });
    else setMeldung(gut ? { text: gut, art: 'gut' } : null);
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <Meldung text={meldung?.text ?? null} art={meldung?.art} />
      <Hinweis art="info" titel="Gemeinsames Zielbild">Im Kick-off mit dem Kunden festlegen: Ausgangslage, Zielwert, Datum. Jeder Report zeigt vorher → jetzt → Ziel. Keine Garantie, kein Erfolgshonorar.</Hinweis>
      {!daten.mandat.ziele.length && <div style={klein}>Am Mandat stehen noch keine Ziele — unten das erste anlegen.</div>}
      {daten.mandat.ziele.map((z, i) => <ZielKarte key={z.id} i={i + 1} daten={daten} zielId={z.id} ops={ops} />)}
      <Karte i={9}>
        <Ueberschrift erklaerung="fulfillment.wertKonto">Neues Ziel</Ueberschrift>
        <form onSubmit={e => { e.preventDefault(); if (neu.trim()) void ops([{ op: 'ziel-neu', text: neu.trim() }], 'Ziel am Mandat angelegt.').then(() => setNeu('')); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="z. B. Qualifizierte Termine je Monat" aria-label="Neues Ziel" style={{ ...feld, flex: '1 1 260px', minWidth: 0 }} />
          <Knopf typ="submit" aus={!neu.trim()}>Ziel anlegen</Knopf>
        </form>
      </Karte>
    </div>
  );
}

const RICHTUNG = [{ id: 'hoch' as const, label: 'mehr ist besser' }, { id: 'runter' as const, label: 'weniger ist besser' }];

function ZielKarte({ i, daten, zielId, ops }: { i: number; daten: FallAntwort; zielId: string; ops: (o: Record<string, unknown>[], gut?: string) => Promise<void> }) {
  const z = daten.mandat.ziele.find(x => x.id === zielId)!;
  const e: WertKontoEintrag = daten.fall!.wertKonto[zielId] ?? { messungen: [] };
  const zeile = daten.wertKonto?.find(x => x.zielId === zielId);
  const stand = daten.staende?.wertKonto[zielId];
  const [w, setW] = useState({ ausgang: e.ausgang ?? '', ausgangZahl: e.ausgangZahl?.toString() ?? '', zielZahl: e.zielZahl?.toString() ?? '', einheit: e.einheit ?? '', zielBis: e.zielBis ?? '', richtung: e.richtung ?? null as 'hoch' | 'runter' | null });
  const [messung, setMessung] = useState('');
  const [am, setAm] = useState(localDay());
  const zahl = (t: string) => (t.trim() ? Number(t.replace(/\./g, '').replace(',', '.')) : null);
  const felder = () => ({ ausgang: w.ausgang || null, ausgangZahl: zahl(w.ausgangZahl), zielZahl: zahl(w.zielZahl), einheit: w.einheit || null, zielBis: w.zielBis || null, ...(w.richtung ? { richtung: w.richtung } : {}) });
  const erreicht = zielErreichung(e);
  const reihe = wertReihe(e);
  const [bearbeiten, setBearbeiten] = useState(false);
  const leer = !zeile || [zeile.vorher, zeile.jetzt, zeile.ziel].every(x => x === '—');
  const messen = (
    <>
      <form onSubmit={x => { x.preventDefault(); const n = zahl(messung); if (n !== null && Number.isFinite(n)) void ops([{ op: 'wert-messung', zielId, wert: n, am }], 'Messung gespeichert — der Ist-Wert am Mandat ist mitgezogen.').then(() => setMessung('')); }} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
        <Feldzeile label={`Neue Messung${e.einheit ? ` (${e.einheit})` : ''}`}><input inputMode="decimal" value={messung} onChange={x => setMessung(x.target.value)} style={{ ...feld, width: 140 }} /></Feldzeile>
        <Feldzeile label="am"><input type="date" value={am} max={localDay()} onChange={x => setAm(x.target.value)} style={{ ...feld, width: 170 }} /></Feldzeile>
        <Knopf typ="submit" aus={!messung.trim()}>Messung eintragen</Knopf>
      </form>
      {e.messungen.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...e.messungen].reverse().slice(0, 12).map(m => (
            <span key={m.am} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: TYP.bedien, color: C.inkDim }}>
              {tagKurz(m.am)}: {m.wert.toLocaleString('de-DE')}{e.einheit ? ` ${e.einheit}` : ''}
              <Knopf leise ariaLabel={`Messung vom ${tagKurz(m.am)} entfernen`} onClick={() => ops([{ op: 'wert-messung', zielId, am: m.am, weg: true }])}>×</Knopf>
            </span>
          ))}
        </div>
      )}
    </>
  );
  const festlegen = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <Feldzeile label="Ausgang (Zahl)"><input inputMode="decimal" value={w.ausgangZahl} onChange={x => setW({ ...w, ausgangZahl: x.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Zielwert"><input inputMode="decimal" value={w.zielZahl} onChange={x => setW({ ...w, zielZahl: x.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Einheit"><input value={w.einheit} maxLength={20} onChange={x => setW({ ...w, einheit: x.target.value })} style={feld} /></Feldzeile>
        <Feldzeile label="Ziel bis"><input type="date" value={w.zielBis} onChange={x => setW({ ...w, zielBis: x.target.value })} style={feld} /></Feldzeile>
      </div>
      <Feldzeile label="Ausgangslage (Text, wenn keine Zahl)"><input value={w.ausgang} onChange={x => setW({ ...w, ausgang: x.target.value })} style={feld} /></Feldzeile>
      <Pillen liste={RICHTUNG} aktiv={w.richtung} onWahl={richtung => setW({ ...w, richtung })} />
      <Leiste>
        <Knopf leise onClick={() => ops([{ op: 'wert-ziel', zielId, felder: felder(), ...(stand ? { stand } : {}) }], 'Gespeichert.')}>Speichern</Knopf>
        {!e.festgelegtAm ? <Knopf onClick={() => ops([{ op: 'wert-ziel', zielId, felder: { ...felder(), festlegen: true }, ...(stand ? { stand } : {}) }], 'Wert-Konto festgelegt.')}>Im Kick-off festlegen</Knopf>
          : <Knopf leise onClick={() => ops([{ op: 'wert-ziel', zielId, felder: { festlegen: false }, ...(stand ? { stand } : {}) }])}>Festlegung lösen</Knopf>}
      </Leiste>
    </>
  );
  return (
    <Karte i={i}>
      <Ueberschrift erklaerung="fulfillment.wertKonto" rechts={e.festgelegtAm ? <Chip farbe={LEUCHT.gut}>festgelegt {tagKurz(e.festgelegtAm)}</Chip> : <Chip farbe={LEUCHT.achtung}>noch nicht festgelegt</Chip>}>{z.text}</Ueberschrift>
      {zeile && !leer && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'baseline' }}>
          {[['vorher', zeile.vorher], ['jetzt', zeile.jetzt], ['Ziel', `${zeile.ziel}${zeile.bis ? ` bis ${tagKurz(zeile.bis)}` : ''}`]].map(([k, v]) => (
            <span key={k} style={{ display: 'grid', gap: 2 }}><span style={MIKRO}>{k}</span><span style={{ fontSize: TYP.body, color: C.ink }}>{v}</span></span>
          ))}
        </div>
      )}
      {erreicht != null && <div style={{ maxWidth: 520 }}><WertBalken wert={erreicht} /></div>}
      {reihe.punkte.length > 1 && (
        <svg viewBox="0 0 300 70" width="100%" style={{ maxWidth: 420, display: 'block' }} role="img" aria-label="Verlauf der Messungen">
          {reihe.zielY != null && <line x1={0} x2={300} y1={64 - reihe.zielY * 56} y2={64 - reihe.zielY * 56} stroke={LEUCHT.gut} strokeDasharray="4 4" strokeOpacity={0.6} />}
          <polyline fill="none" stroke={LEUCHT.business} strokeWidth={2} points={reihe.punkte.map(p => `${8 + p.x * 284},${64 - p.y * 56}`).join(' ')} />
          {reihe.punkte.map((p, n) => <circle key={n} cx={8 + p.x * 284} cy={64 - p.y * 56} r={3} fill={LEUCHT.business} />)}
        </svg>
      )}
      {e.festgelegtAm ? (
        <>
          {messen}
          <div><Knopf leise onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? 'Zielwerte schließen' : 'Zielwerte ändern'}</Knopf></div>
          {bearbeiten && festlegen}
        </>
      ) : (
        <>
          <div style={klein}>Zuerst mit dem Kunden festlegen: Ausgang, Zielwert, Einheit, Datum — danach wird gemessen.</div>
          {festlegen}
          {(e.messungen.length > 0 || e.ausgangZahl !== undefined) && messen}
        </>
      )}
    </Karte>
  );
}
