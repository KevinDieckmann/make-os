'use client';

// ─── MAKE OS — Buchungen ────────────────────────────────────────────────────
// Was auf den Konten wirklich passiert ist. Filtern nach Monat und Kategorie,
// damit man Fragen beantworten kann wie „wofür ging im Juli das Geld drauf".
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Listen).

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Fortschritt, feld, LEUCHT } from './schlank';

interface Buchung { id: string; datum: string; wer: string; betrag: number; kategorie: string; zweck?: string; konto?: string; ort?: string; rechnungId?: string }

const geld: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 88 };
const tag: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, width: 48, flex: '0 0 auto' };

/**
 * Kevins Ansage: „Privat bleibt immer privat, die beiden Firmen kann man auch
 * mal zusammenfassen." Deshalb gibt es beides — die Firmen einzeln UND als eine
 * Auswahl „Geschäftlich".
 */
const ORTE: { id: string; label: string; trifft: (o?: string) => boolean }[] = [
  { id: 'alle', label: 'Alles', trifft: () => true },
  { id: 'privat', label: 'Privat', trifft: o => o === 'privat' },
  { id: 'geschaeft', label: 'Geschäftlich', trifft: o => o === 'kdv' || o === 'kdc' },
  { id: 'kdv', label: 'KD Ventures', trifft: o => o === 'kdv' },
  { id: 'kdc', label: 'Selbständigkeit', trifft: o => o === 'kdc' },
];

export function BuchungenView() {
  const [alle, setAlle] = useState<Buchung[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [monat, setMonat] = useState<string>('alle');
  const [kategorie, setKategorie] = useState<string>('alle');
  const [suche, setSuche] = useState('');
  const [ort, setOrt] = useState('alle');

  useEffect(() => {
    // Filter aus dem Link (?monat=YYYY-MM&kat=…&q=…&ort=kdc) — z. B. von einer Rechnung oder Kachel (26.09.).
    const u = new URLSearchParams(window.location.search);
    if (u.get('monat')) setMonat(u.get('monat')!);
    if (u.get('kat')) setKategorie(u.get('kat')!);
    if (u.get('q')) setSuche(u.get('q')!);
    if (u.get('ort')) setOrt(u.get('ort')!);
    fetch('/api/state/buchungen').then(r => r.json()).then(d => {
      setAlle(Array.isArray(d.buchungen) ? d.buchungen : []);
      setGeladen(true);
    }).catch(() => setGeladen(true));
  }, []);

  const monate = useMemo(() => Array.from(new Set(alle.map(b => b.datum.slice(0, 7)))).sort().reverse(), [alle]);
  const kategorien = useMemo(() => {
    const m = new Map<string, number>();
    alle.forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [alle]);

  const sichtbar = useMemo(() => {
    const n = suche.trim().toLowerCase();
    const ortFilter = ORTE.find(o => o.id === ort) ?? ORTE[0];
    return alle.filter(b => {
      if (!ortFilter.trifft(b.ort)) return false;
      if (monat !== 'alle' && b.datum.slice(0, 7) !== monat) return false;
      if (kategorie !== 'alle' && b.kategorie !== kategorie) return false;
      if (n && !`${b.wer} ${b.zweck ?? ''} ${b.kategorie}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [alle, monat, kategorie, suche, ort]);

  const ein = sichtbar.filter(b => b.betrag > 0).reduce((s, b) => s + b.betrag, 0);
  const aus = Math.abs(sichtbar.filter(b => b.betrag < 0).reduce((s, b) => s + b.betrag, 0));
  const saldo = ein - aus;

  const nachKategorie = useMemo(() => {
    const m = new Map<string, number>();
    sichtbar.filter(b => b.betrag < 0).forEach(b => m.set(b.kategorie, (m.get(b.kategorie) ?? 0) + Math.abs(b.betrag)));
    return Array.from(m.entries()).map(([k, s]) => ({ k, s })).sort((a, b) => b.s - a.s);
  }, [sichtbar]);

  const monatLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  const hat = sichtbar.length > 0;

  return (
    <Seite titel="Buchungen" unter={geladen ? `${sichtbar.length} ${sichtbar.length === 1 ? 'Buchung' : 'Buchungen'}${kategorien.length ? ` · ${kategorien.length} Kategorien` : ''}` : undefined}
      rechts={<input value={suche} onChange={e => setSuche(e.target.value)} placeholder="suchen …" aria-label="Buchungen durchsuchen" style={{ ...feld, width: 'min(100%, 200px)', padding: '9px 14px' }} />}>
      <Karte i={0} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld}>Saldo der Auswahl</Ueberschrift>
        <Zahl gross wert={hat ? `${saldo >= 0 ? '+' : ''}${eur(saldo)}` : undefined} farbe={saldo >= 0 ? LEUCHT.gut : LEUCHT.kritisch} label={hat ? `aus ${sichtbar.length} ${sichtbar.length === 1 ? 'Buchung' : 'Buchungen'}` : 'keine Buchung in dieser Auswahl'} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 14 }}>
          <Zahl wert={hat ? `+${eur(ein)}` : undefined} farbe={LEUCHT.gut} label="reingekommen" />
          <Zahl wert={hat ? `−${eur(aus)}` : undefined} farbe={LEUCHT.achtung} label="rausgegangen" />
        </div>

        {/* Wo die Buchung hingehört — Privat getrennt, Firmen einzeln oder zusammen */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
          {ORTE.map(o => {
            const n = alle.filter(b => o.trifft(b.ort)).length;
            const an = ort === o.id;
            return (
              <Knopf key={o.id} leise={!an} aus={!n && o.id !== 'alle'} onClick={() => setOrt(o.id)}>
                {o.label} <span style={{ opacity: .6, fontWeight: 600 }}>{n}</span>
              </Knopf>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <Knopf leise={monat !== 'alle'} onClick={() => setMonat('alle')}>alle Monate</Knopf>
          {monate.map(m => (
            <Knopf key={m} leise={monat !== m} onClick={() => setMonat(m)}>{monatLabel(m)}</Knopf>
          ))}
        </div>
      </Karte>

      {/* Wohin es ging */}
      {!!nachKategorie.length && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts={kategorie !== 'alle' ? <Knopf leise onClick={() => setKategorie('alle')}>✕ Filter lösen</Knopf> : 'Klick filtert die Liste'}>Wohin es ging</Ueberschrift>
          <div style={{ display: 'grid', gap: 9 }}>
            {(() => {
              const max = Math.max(...nachKategorie.map(x => x.s), 1);
              return nachKategorie.slice(0, 12).map(x => {
                const an = kategorie === x.k;
                return (
                  <div key={x.k} onClick={() => setKategorie(an ? 'alle' : x.k)} className="fassbar"
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(90px,165px) 1fr 84px', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: kategorie === 'alle' || an ? 1 : 0.4 }}>
                    <span style={{ fontSize: TYP.bedien, color: an ? C.ink : C.inkDim, fontWeight: an ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.k}</span>
                    <Fortschritt anteil={x.s / max} farbe={an ? LEUCHT.geld : LEUCHT.achtung} />
                    <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, textAlign: 'right' }}>{eur(x.s)}</span>
                  </div>
                );
              });
            })()}
          </div>
        </Karte>
      )}

      {/* Die Liste */}
      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.puls} rechts={sichtbar.length > 300 ? `${Math.min(300, sichtbar.length)} von ${sichtbar.length}` : undefined}>Buchungen</Ueberschrift>
        <Liste>
          {!geladen && <Leer>lädt …</Leer>}
          {geladen && !sichtbar.length && <Leer>{alle.length ? 'Kein Treffer in dieser Auswahl.' : 'Noch keine Buchungen übernommen.'}</Leer>}
          {sichtbar.slice(0, 300).map(b => (
            <Zeile key={b.id} links={<span style={tag}>{b.datum.slice(8)}.{b.datum.slice(5, 7)}.</span>} titel={b.wer} unter={b.zweck}
              rechts={<>
                {b.rechnungId && <Link href={`/os/finanzen/planung?r=${encodeURIComponent(b.rechnungId)}`} style={{ textDecoration: 'none' }}><Chip farbe={LEUCHT.gut}>Rechnung ›</Chip></Link>}
                <Chip farbe={C.inkDim}>{b.kategorie}</Chip>
                <span style={{ ...geld, color: b.betrag > 0 ? LEUCHT.gut : C.ink }}>{b.betrag > 0 ? '+' : '−'}{eur(Math.abs(b.betrag))}</span>
              </>} />
          ))}
          {sichtbar.length > 300 && <Leer>+{sichtbar.length - 300} weitere — Monat oder Kategorie wählen</Leer>}
        </Liste>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 14, lineHeight: 1.6 }}>
          Buchungen kommen aus dem Beleg-Werkzeug (Jarvis), aus bezahlten <Link href="/os/finanzen/planung" style={{ color: C.inkDim }}>Rechnungen</Link> und aus dem Altbestand des Finanz-Dashboards.
        </div>
      </Karte>
    </Seite>
  );
}
