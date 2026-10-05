'use client';

// ─── Business-Index — Monatsabschluss in 5 Minuten + Köpfe, Kapazität, Ziele ─
// Die Zahlen, die kein anderes System liefert (BWA/Bilanz): je Firma und Monat
// Umsatz, Kosten, Personal, Marketing & Vertrieb, Abschreibungen, Eigenkapital,
// Bilanzsumme, kurzfristige Verbindlichkeiten, Bankschulden. Alles optional —
// jede Zahl schließt eine Messlücke. Später: DATEV-BWA-Import.
// 05.10. abends: dieselbe Karte unter Privat › Finanzplanung › Selbstständigkeit (`firmen` = Privat-Einheiten, `adresse` =
// /api/privat/abschluss) — ein Baustein, zwei Bereiche; getrennt wird serverseitig über den Bereich der Firma.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, feld, LEUCHT, useRueckfrage } from '../ui';
import { Pillen } from '../crm/teile';
import type { Monatsabschluss } from '@/lib/business/messen';
import { KERN_EINHEITEN, istBusinessGesellschaft, type Gesellschaftskennung } from '@/lib/einheiten';

// Die eine Einheitenliste (28.09.), seit 05.10. nur der Business-Bereich (`bereichVon`, unsere Instanz: KD Ventures · MAKE Innovation
// GmbH) — die Selbstständigkeit gehört zu Privat; ihre gespeicherten Abschlüsse bleiben im Speicher, der Server liefert sie hier nicht aus.
type Firma = Gesellschaftskennung;
const FIRMA_LISTE: { id: Firma; label: string }[] = KERN_EINHEITEN.filter(e => istBusinessGesellschaft(e.id)).map(e => ({ id: e.id, label: e.label }));
const leer = (): Record<Firma, string> => ({ kdc: '', kdv: '', ug: '' });
const jeFirma = (f: (id: Firma) => string): Record<Firma, string> => ({ kdc: f('kdc'), kdv: f('kdv'), ug: f('ug') });
const FELDER: { id: keyof Monatsabschluss; label: string; hilfe: string; tage?: boolean }[] = [
  { id: 'umsatz', label: 'Umsatz (netto)', hilfe: 'BWA: Umsatzerlöse' },
  { id: 'kosten', label: 'Kosten gesamt (netto)', hilfe: 'BWA: Gesamtkosten' },
  { id: 'personal', label: 'davon Personal', hilfe: 'Löhne, Gehälter, Sozialabgaben' },
  { id: 'marketingVertrieb', label: 'davon Marketing & Vertrieb', hilfe: 'Werbung, Events, Vertriebskosten' },
  { id: 'afa', label: 'Abschreibungen', hilfe: 'BWA: AfA' },
  { id: 'fakturierteTage', label: 'Fakturierte Beratertage', hilfe: 'abgerechnete Tage — für Auslastung und Tagessatz', tage: true },
  { id: 'eigenkapital', label: 'Eigenkapital', hilfe: 'Bilanz / BWA-Vermögensteil' },
  { id: 'bilanzsumme', label: 'Bilanzsumme', hilfe: 'Summe Aktiva' },
  { id: 'kurzfrVerbindlichkeiten', label: 'Kurzfr. Verbindlichkeiten', hilfe: 'fällig innerhalb 12 Monaten' },
  { id: 'bankschulden', label: 'Bankschulden', hilfe: 'Darlehen, Kontokorrent' },
];
const letzterMonat = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const euro = (n?: number) => (n == null ? '—' : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(n));

async function senden(body: Record<string, unknown>, adresse = '/api/business') {
  return fetch(adresse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
}

export function MonatsabschlussKarte({ eintraege, onGespeichert, firmen = FIRMA_LISTE, adresse = '/api/business', hinweis, i = 5, stichtage }: {
  eintraege: Monatsabschluss[]; onGespeichert: () => void;
  /** 0-Punkt je Gesellschaft (05.10.): Abschlüsse vor dem Stichtag-Monat sind archiviert — sie stehen hier weiter, zählen aber nicht. */
  stichtage?: Partial<Record<Firma, string>>;
  /** Firmen der Karte (Vorgabe: die Business-Gesellschaften; unter Privat: die Privat-Einheiten). */
  firmen?: { id: Firma; label: string }[];
  /** Schreibweg (Vorgabe: /api/business; unter Privat: /api/privat/abschluss). */
  adresse?: string;
  /** Satz unter der Überschrift (z. B. was der Abschluss im jeweiligen Bereich speist). */
  hinweis?: string;
  i?: number;
}) {
  const liste = firmen;
  const [firma, setFirma] = useState<Firma>(firmen[0]?.id ?? 'kdv');
  const { bestaetigen, dialog } = useRueckfrage();
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
    const r = await senden({ aktion: 'abschluss', firma, monat, ...zahlen, notiz }, adresse);
    setLaeuft(false);
    if (r.ok) { setMeldung({ ok: true, text: `Gespeichert — ${liste.find(f => f.id === firma)?.label} ${monat}.` }); onGespeichert(); }
    else setMeldung({ ok: false, text: r.fehler ?? 'Nicht gespeichert.' });
  };
  const loeschen = async (e: Monatsabschluss) => {
    if (!(await bestaetigen({ titel: `Abschluss ${liste.find(f => f.id === e.firma)?.label} ${e.monat} löschen?`, text: 'Die eingetragenen Monatswerte dieser Firma fallen weg.', ja: 'Löschen', gefahr: true }))) return;
    const r = await senden({ aktion: 'abschluss_weg', firma: e.firma, monat: e.monat }, adresse);
    if (r.ok) onGespeichert();
  };

  return (
    <Karte i={i}>
      <div id="abschluss" style={{ scrollMarginTop: 90 }} />
      <Ueberschrift farbe={LEUCHT.geld} rechts={<span>alles optional — jede Zahl schließt eine Messlücke</span>}>Monatsabschluss</Ueberschrift>
      {hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.45 }}>{hinweis}</div>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <Pillen liste={liste} aktiv={firma} onWahl={setFirma} farbe={LEUCHT.geld} />
        <input type="month" value={monat} max={letzterMonat()} onChange={e => setMonat(e.target.value)} aria-label="Monat" style={{ ...feld, width: 'auto', fontSize: TYP.bedien, padding: '7px 11px', colorScheme: 'dark' }} />
        {vorhanden && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>schon eingetragen — Änderungen überschreiben</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        {FELDER.map(f => (
          <label key={f.id} style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>{f.label}</span>
            <input inputMode="decimal" value={werte[f.id] ?? ''} onChange={e => setWerte({ ...werte, [f.id]: e.target.value })} placeholder={f.tage ? 'Tage' : '€'} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} />
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{f.hilfe}</span>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>
            <thead><tr style={{ color: C.inkLeise, textAlign: 'right' }}>
              <th style={{ textAlign: 'left', padding: '4px 8px' }}>Monat</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Firma</th>
              <th style={{ padding: '4px 8px' }}>Umsatz</th><th style={{ padding: '4px 8px' }}>Kosten</th><th style={{ padding: '4px 8px' }}>Personal</th><th style={{ padding: '4px 8px' }}>Tage</th><th style={{ padding: '4px 8px' }}>EK</th><th />
            </tr></thead>
            <tbody>
              {eintraege.map(e => (
                <tr key={`${e.firma}-${e.monat}`} style={{ borderTop: '1px solid rgba(255,255,255,.06)', textAlign: 'right', color: C.ink }}>
                  <td style={{ textAlign: 'left', padding: '6px 8px' }}><button onClick={() => { setFirma(e.firma); setMonat(e.monat); }} style={{ background: 'none', border: 'none', color: LEUCHT.puls, cursor: 'pointer', padding: 0, fontSize: TYP.bedien }}>{e.monat}</button>
                    {stichtage?.[e.firma] && e.monat < stichtage[e.firma]!.slice(0, 7) && <span title="vor dem 0-Punkt — zählt nicht mehr" style={{ marginLeft: 6, color: C.inkLeise }}>archiviert</span>}</td>
                  <td style={{ textAlign: 'left', padding: '6px 8px', color: C.inkDim }}>{liste.find(f => f.id === e.firma)?.label}</td>
                  <td style={{ padding: '6px 8px' }}>{euro(e.umsatz)}</td><td style={{ padding: '6px 8px' }}>{euro(e.kosten)}</td><td style={{ padding: '6px 8px' }}>{euro(e.personal)}</td><td style={{ padding: '6px 8px' }}>{e.fakturierteTage != null ? String(e.fakturierteTage).replace('.', ',') : '—'}</td><td style={{ padding: '6px 8px' }}>{euro(e.eigenkapital)}</td>
                  <td style={{ padding: '6px 8px' }}><button onClick={() => void loeschen(e)} aria-label="löschen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 13 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog}
    </Karte>
  );
}

export function EinstellungenKarte({ einstellungen, onGespeichert }: { einstellungen: { fte: Partial<Record<Firma, number>>; ziele?: Partial<Record<Firma, number>>; kapazitaet?: Partial<Record<Firma, number>> }; onGespeichert: () => void }) {
  const text = (n?: number) => (n != null ? String(n).replace('.', ',') : '');
  const [fte, setFte] = useState<Record<Firma, string>>(leer);
  const [ziele, setZiele] = useState<Record<Firma, string>>(leer);
  const [kap, setKap] = useState<Record<Firma, string>>(leer);
  const [meldung, setMeldung] = useState<string | null>(null);
  useEffect(() => {
    setFte(jeFirma(f => text(einstellungen.fte[f])));
    setZiele(jeFirma(f => text(einstellungen.ziele?.[f])));
    setKap(jeFirma(f => text(einstellungen.kapazitaet?.[f])));
  }, [einstellungen.fte.kdc, einstellungen.fte.kdv, einstellungen.fte.ug, einstellungen.ziele?.kdc, einstellungen.ziele?.kdv, einstellungen.ziele?.ug, einstellungen.kapazitaet?.kdc, einstellungen.kapazitaet?.kdv, einstellungen.kapazitaet?.ug]);
  const zahl = (t: string, tausender: boolean) => (t.trim() ? Number((tausender ? t.replace(/\./g, '') : t).replace(',', '.')) : null);
  const speichern = async () => {
    const je = (w: Record<Firma, string>, tausender: boolean) => Object.fromEntries(FIRMA_LISTE.map(f => [f.id, zahl(w[f.id], tausender)]));
    const r = await senden({ aktion: 'einstellungen', fte: je(fte, false), ziele: je(ziele, true), kapazitaet: je(kap, false) });
    setMeldung(r.ok ? 'Gespeichert.' : r.fehler ?? 'Nicht gespeichert.');
    if (r.ok) onGespeichert();
  };
  return (
    <Karte i={6}>
      <div id="einstellungen" style={{ scrollMarginTop: 90 }} />
      <Ueberschrift farbe={LEUCHT.schlaf}>Köpfe, Kapazität und Jahresziele</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
        {FIRMA_LISTE.map(f => (
          <div key={f.id} style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 700 }}>{f.label}</span>
            <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Köpfe (FTE)</span>
              <input inputMode="decimal" value={fte[f.id]} onChange={e => setFte({ ...fte, [f.id]: e.target.value })} placeholder="z. B. 1,5" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px' }} /></label>
            <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Jahresumsatzziel (€)</span>
              <input inputMode="decimal" value={ziele[f.id]} onChange={e => setZiele({ ...ziele, [f.id]: e.target.value })} placeholder="z. B. 250.000" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} /></label>
            {<label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Kapazität (Beratertage/Monat)</span>
              <input inputMode="decimal" value={kap[f.id]} onChange={e => setKap({ ...kap, [f.id]: e.target.value })} placeholder="z. B. 15" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} /></label>}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <Knopf leise onClick={() => void speichern()}>Speichern</Knopf>
        {meldung && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{meldung}</span>}
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Köpfe: Vollzeit-Köpfe im Geschäft (Kevin 1,0 · Teilzeit anteilig) — für „Umsatz je Kopf“. Kapazität: Tage, die ihr im Monat verkaufen könnt (ohne Vertrieb, Verwaltung, Urlaub) — für die Auslastung. Jahresziele je Firma: für Umsatz-Kurs und Pipeline-Deckung der Firma; das Gesamtziel kommt aus dem Controlling.</div>
    </Karte>
  );
}
