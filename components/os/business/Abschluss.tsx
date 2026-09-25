'use client';

// ─── Business-Index — Monatsabschluss in 5 Minuten + Köpfe ──────────────────
// Die Zahlen, die kein anderes System liefert (BWA/Bilanz): je Firma und Monat
// Umsatz, Kosten, Personal, Marketing & Vertrieb, Abschreibungen, Eigenkapital,
// Bilanzsumme, kurzfristige Verbindlichkeiten, Bankschulden. Alles optional —
// jede Zahl schließt eine Messlücke. Später: DATEV-BWA-Import.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, feld, LEUCHT } from '../schlank';
import { Pillen } from '../crm/teile';
import type { Monatsabschluss } from '@/lib/business/messen';

type Firma = 'kdc' | 'kdv';
const FIRMA_LISTE: { id: Firma; label: string }[] = [{ id: 'kdc', label: 'Consulting' }, { id: 'kdv', label: 'KD Ventures' }];
const FELDER: { id: keyof Monatsabschluss; label: string; hilfe: string }[] = [
  { id: 'umsatz', label: 'Umsatz (netto)', hilfe: 'BWA: Umsatzerlöse' },
  { id: 'kosten', label: 'Kosten gesamt (netto)', hilfe: 'BWA: Gesamtkosten' },
  { id: 'personal', label: 'davon Personal', hilfe: 'Löhne, Gehälter, Sozialabgaben' },
  { id: 'marketingVertrieb', label: 'davon Marketing & Vertrieb', hilfe: 'Werbung, Events, Vertriebskosten' },
  { id: 'afa', label: 'Abschreibungen', hilfe: 'BWA: AfA' },
  { id: 'eigenkapital', label: 'Eigenkapital', hilfe: 'Bilanz / BWA-Vermögensteil' },
  { id: 'bilanzsumme', label: 'Bilanzsumme', hilfe: 'Summe Aktiva' },
  { id: 'kurzfrVerbindlichkeiten', label: 'Kurzfr. Verbindlichkeiten', hilfe: 'fällig innerhalb 12 Monaten' },
  { id: 'bankschulden', label: 'Bankschulden', hilfe: 'Darlehen, Kontokorrent' },
];
const letzterMonat = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const euro = (n?: number) => (n == null ? '—' : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n));

async function senden(body: Record<string, unknown>) {
  return fetch('/api/business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
}

export function MonatsabschlussKarte({ eintraege, onGespeichert }: { eintraege: Monatsabschluss[]; onGespeichert: () => void }) {
  const [firma, setFirma] = useState<Firma>('kdc');
  const [monat, setMonat] = useState(letzterMonat());
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [notiz, setNotiz] = useState('');
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const vorhanden = eintraege.find(e => e.firma === firma && e.monat === monat);
  // Beim Wechsel von Firma/Monat: den gespeicherten Stand ins Formular.
  useEffect(() => {
    setWerte(Object.fromEntries(FELDER.map(f => [f.id, vorhanden && typeof vorhanden[f.id] === 'number' ? String(vorhanden[f.id]).replace('.', ',') : ''])));
    setNotiz(vorhanden?.notiz ?? '');
    setMeldung(null);
  }, [firma, monat, vorhanden?.am]); // eslint-disable-line react-hooks/exhaustive-deps

  const speichern = async () => {
    setLaeuft(true); setMeldung(null);
    const zahlen = Object.fromEntries(FELDER.map(f => [f.id, werte[f.id]?.trim() ? Number(werte[f.id].replace(/\./g, '').replace(',', '.')) : null]));
    if (Object.values(zahlen).some(v => v != null && !Number.isFinite(v))) { setLaeuft(false); setMeldung({ ok: false, text: 'Bitte nur Zahlen eintragen (z. B. 12.500 oder 12500,50).' }); return; }
    const r = await senden({ aktion: 'abschluss', firma, monat, ...zahlen, notiz });
    setLaeuft(false);
    if (r.ok) { setMeldung({ ok: true, text: `Gespeichert — ${FIRMA_LISTE.find(f => f.id === firma)?.label} ${monat}.` }); onGespeichert(); }
    else setMeldung({ ok: false, text: r.fehler ?? 'Nicht gespeichert.' });
  };
  const loeschen = async (e: Monatsabschluss) => {
    if (!window.confirm(`Abschluss ${FIRMA_LISTE.find(f => f.id === e.firma)?.label} ${e.monat} löschen?`)) return;
    const r = await senden({ aktion: 'abschluss_weg', firma: e.firma, monat: e.monat });
    if (r.ok) onGespeichert();
  };

  return (
    <Karte i={5}>
      <div id="abschluss" style={{ scrollMarginTop: 90 }} />
      <Ueberschrift farbe={LEUCHT.geld} rechts={<span>alles optional — jede Zahl schließt eine Messlücke</span>}>Monatsabschluss</Ueberschrift>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Pillen liste={FIRMA_LISTE} aktiv={firma} onWahl={setFirma} farbe={LEUCHT.geld} />
        <input type="month" value={monat} max={letzterMonat()} onChange={e => setMonat(e.target.value)} aria-label="Monat" style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '7px 11px', colorScheme: 'dark' }} />
        {vorhanden && <span style={{ fontSize: 12.5, color: C.inkLeise }}>schon eingetragen — Änderungen überschreiben</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        {FELDER.map(f => (
          <label key={f.id} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12.5, color: C.inkDim, fontWeight: 600 }}>{f.label}</span>
            <input inputMode="decimal" value={werte[f.id] ?? ''} onChange={e => setWerte({ ...werte, [f.id]: e.target.value })} placeholder="€" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ fontSize: 11.5, color: C.inkLeise }}>{f.hilfe}</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
        <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional), z. B. „vorläufige BWA“" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', flex: '1 1 260px', width: 'auto' }} />
        <Knopf aus={laeuft} farbe={LEUCHT.geld} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
      </div>
      {meldung && <div style={{ marginTop: 8, fontSize: TYP.bedien, color: meldung.ok ? LEUCHT.gut : LEUCHT.kritisch }}>{meldung.text}</div>}
      {eintraege.length > 0 && (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ color: C.inkLeise, textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Monat</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Firma</th>
              <th style={{ padding: '4px 8px' }}>Umsatz</th><th style={{ padding: '4px 8px' }}>Kosten</th><th style={{ padding: '4px 8px' }}>Personal</th><th style={{ padding: '4px 8px' }}>EK</th><th />
            </tr></thead>
            <tbody>
              {eintraege.map(e => (
                <tr key={`${e.firma}-${e.monat}`} style={{ borderTop: '1px solid rgba(255,255,255,.06)', textAlign: 'right', color: C.ink }}>
                  <td style={{ textAlign: 'left', padding: '6px 8px' }}><button onClick={() => { setFirma(e.firma); setMonat(e.monat); }} style={{ background: 'none', border: 'none', color: LEUCHT.puls, cursor: 'pointer', padding: 0, fontSize: 12.5 }}>{e.monat}</button></td>
                  <td style={{ textAlign: 'left', padding: '6px 8px', color: C.inkDim }}>{FIRMA_LISTE.find(f => f.id === e.firma)?.label}</td>
                  <td style={{ padding: '6px 8px' }}>{euro(e.umsatz)}</td><td style={{ padding: '6px 8px' }}>{euro(e.kosten)}</td><td style={{ padding: '6px 8px' }}>{euro(e.personal)}</td><td style={{ padding: '6px 8px' }}>{euro(e.eigenkapital)}</td>
                  <td style={{ padding: '6px 8px' }}><button onClick={() => void loeschen(e)} aria-label="löschen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 13 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Karte>
  );
}

export function EinstellungenKarte({ einstellungen, onGespeichert }: { einstellungen: { fte: Partial<Record<Firma, number>>; ziele?: Partial<Record<Firma, number>> }; onGespeichert: () => void }) {
  const text = (n?: number) => (n != null ? String(n).replace('.', ',') : '');
  const [fte, setFte] = useState<Record<Firma, string>>({ kdc: '', kdv: '' });
  const [ziele, setZiele] = useState<Record<Firma, string>>({ kdc: '', kdv: '' });
  const [meldung, setMeldung] = useState<string | null>(null);
  useEffect(() => {
    setFte({ kdc: text(einstellungen.fte.kdc), kdv: text(einstellungen.fte.kdv) });
    setZiele({ kdc: text(einstellungen.ziele?.kdc), kdv: text(einstellungen.ziele?.kdv) });
  }, [einstellungen.fte.kdc, einstellungen.fte.kdv, einstellungen.ziele?.kdc, einstellungen.ziele?.kdv]);
  const zahl = (t: string, tausender: boolean) => (t.trim() ? Number((tausender ? t.replace(/\./g, '') : t).replace(',', '.')) : null);
  const speichern = async () => {
    const r = await senden({ aktion: 'einstellungen', fte: { kdc: zahl(fte.kdc, false), kdv: zahl(fte.kdv, false) }, ziele: { kdc: zahl(ziele.kdc, true), kdv: zahl(ziele.kdv, true) } });
    setMeldung(r.ok ? 'Gespeichert.' : r.fehler ?? 'Nicht gespeichert.');
    if (r.ok) onGespeichert();
  };
  return (
    <Karte i={6}>
      <div id="einstellungen" style={{ scrollMarginTop: 90 }} />
      <Ueberschrift farbe={LEUCHT.schlaf}>Köpfe und Jahresziele</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
        {FIRMA_LISTE.map(f => (
          <div key={f.id} style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 700 }}>{f.label}</span>
            <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkDim }}>Köpfe (FTE)</span>
              <input inputMode="decimal" value={fte[f.id]} onChange={e => setFte({ ...fte, [f.id]: e.target.value })} placeholder="z. B. 1,5" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkDim }}>Jahresumsatzziel (€)</span>
              <input inputMode="decimal" value={ziele[f.id]} onChange={e => setZiele({ ...ziele, [f.id]: e.target.value })} placeholder="z. B. 250.000" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} /></label>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => void speichern()}>Speichern</Knopf>
        {meldung && <span style={{ fontSize: 12.5, color: C.inkLeise }}>{meldung}</span>}
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Köpfe: Vollzeit-Köpfe im Geschäft (Kevin 1,0 · Teilzeit anteilig) — für „Umsatz je Kopf“. Jahresziele je Firma: für Umsatz-Kurs und Pipeline-Deckung der Firma; das Gesamtziel kommt aus dem Controlling.</div>
    </Karte>
  );
}
