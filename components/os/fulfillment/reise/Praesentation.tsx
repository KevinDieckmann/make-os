'use client';

// ─── Fulfillment — „Dem Kunden zeigen“: die Kunden-Seite im Vollbild (12.10., „kundenreif“) ───────────────────────────────────────────────────
// Rückmeldung 12.10.: „Kann ich das einem Kunden zeigen?“ Ein Knopf am Fall (und auf der Landkarte) öffnet die Seite des Kunden im Vollbild — für den Termin
// am Bildschirm. Inhalt NUR aus `GET /api/fulfillment/kunde/vorschau?m=` (serverseitig gebaut, Positivliste `SICHT_SCHLUESSEL` in
// lib/fulfillment/kunde/sicht.ts — dieselbe, die der Kunde über seinen Link bekommt) und NUR gezeichnet mit `KundenAnsicht` (dieselbe Komponente wie
// die öffentliche Seite, Variante `praesentation`: Vollbild ohne Eingaben, Formulare und Datenschutz-Kasten — Paket Extern). Keine zweite Filterlogik,
// kein eigenes Layout: was intern ist (Marken, Notizen, Kosten, Stakeholder, Personenteil, ungeprüfte Bausteine), kommt gar nicht erst im Browser an. Wächter: tests/fulfillment-kundenreif.test.ts.
// Bedienung: Esc oder „Schließen“ zurück in den Fall (Fokus zurück auf den Knopf), „Drucken“ druckt nur die Kunden-Seite, „PDF“ erstellt den
// Fortschritts-Report (der vorhandene Weg, am Mandat abgelegt) und lädt ihn. Zugang: nur interne Personen mit Fulfillment-Zugang (Route).

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, FileDown } from 'lucide-react';
import { FARBE as C, TYP, ECKE, RAND, SCHRIFT } from '@/lib/make-one/design';
import { Hinweis, Leer, Knopf, Erklaert } from '../../ui';
import { KundenAnsicht } from '../kunde/KundenAnsicht';
import { Wahl } from '../../crm/Wahl';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';

/** Die Quelle der Präsentation — EINE Route, dieselbe wie „So sieht der Kunde es“. */
export const PRAESENTATION_QUELLE = '/api/fulfillment/kunde/vorschau';
/** Höchstbreite des Vollbilds — Platz für die zwei Spalten des Präsentations-Rasters (`.kunde-praesentation .kunde-raster`, je ≥ 520 px). */
const PRAESENTATION_BREITE = 1240;

/** Der Inhalt: nur die Kunden-Sicht, gezeichnet von `KundenAnsicht praesentation` (nichts zum Ausfüllen, ab ~1.100 px zweispaltig). */
export function PraesentationInhalt({ sicht }: { sicht: KundenSicht }) {
  return <div className="ff-praesentation-inhalt" style={{ maxWidth: PRAESENTATION_BREITE, margin: '0 auto' }}><KundenAnsicht sicht={sicht} praesentation /></div>;
}

const neueId = () => `report-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;

/** Die Vollbild-Ansicht. `onZu` schließt (Esc, „Schließen“); der Fokus geht an `zurueck` (den Knopf, der geöffnet hat). */
export function Praesentation({ mandatId, onZu, zurueck }: { mandatId: string; onZu: () => void; zurueck?: HTMLElement | null }) {
  const [sicht, setSicht] = useState<KundenSicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pdf, setPdf] = useState<{ laeuft: boolean; text?: string; datei?: string }>({ laeuft: false });
  const schliessen = useRef<HTMLButtonElement>(null);
  const zu = useRef(onZu);
  zu.current = onZu;
  useEffect(() => {
    let aus = false;
    void (async () => {
      const r = await fetch(`${PRAESENTATION_QUELLE}?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (aus) return;
      if (!r || !r.ok || !j.ok) setFehler(String(j.fehler ?? 'Die Kunden-Seite ließ sich nicht laden.')); else setSicht(j.sicht as KundenSicht);
    })();
    return () => { aus = true; };
  }, [mandatId]);
  useEffect(() => {
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    schliessen.current?.focus();
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); zu.current(); } };
    window.addEventListener('keydown', taste);
    return () => { document.body.style.overflow = vorher; window.removeEventListener('keydown', taste); zurueck?.focus(); };
  }, [zurueck]);
  const alsPdf = async () => {
    setPdf({ laeuft: true });
    const r = await fetch('/api/crm/treppe/report', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aktion: 'erstellen', mandatId, anfrageId: neueId() }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    const id = (j.datei as { id?: string } | undefined)?.id;
    if (!r || !r.ok || !j.ok || !id) { setPdf({ laeuft: false, text: String(j.fehler ?? 'Das PDF wurde nicht erstellt.') }); return; }
    setPdf({ laeuft: false, datei: id, text: 'Fortschritts-Report erstellt und am Mandat abgelegt.' });
  };
  if (typeof document === 'undefined') return null;
  const knopf = { minHeight: 44, minWidth: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 12px', borderRadius: ECKE.knopf, border: `1px solid ${RAND.stark}`, background: 'rgba(255,255,255,.04)', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien } as const;
  return createPortal(
    <div className="ff-praesentation" role="dialog" aria-modal="true" aria-label={sicht ? `Kunden-Seite: ${sicht.firma}` : 'Kunden-Seite'}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: C.grund, overflowY: 'auto', padding: '16px clamp(16px, 4vw, 48px) 48px' }}>
      <style>{'@media print { body > *:not(.ff-praesentation) { display: none !important; } .ff-praesentation { position: static !important; overflow: visible !important; } .ff-praesentation-leiste { display: none !important; } }'}</style>
      <div className="ff-praesentation-leiste" style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, maxWidth: PRAESENTATION_BREITE, margin: '0 auto 16px' }}>
        <Erklaert erklaerung="fulfillment.praesentation" name="Dem Kunden zeigen">
          <button type="button" className="fassbar" onClick={() => window.print()} style={knopf}><Printer size={16} aria-hidden />Drucken</button>
        </Erklaert>
        <button type="button" className="fassbar" onClick={alsPdf} disabled={pdf.laeuft} style={knopf}><FileDown size={16} aria-hidden />{pdf.laeuft ? 'PDF entsteht …' : 'PDF (Fortschritts-Report)'}</button>
        <button ref={schliessen} type="button" className="fassbar" onClick={onZu} aria-label="Schließen (Esc)" style={knopf}><X size={16} aria-hidden />Schließen</button>
      </div>
      {pdf.text && (
        <div className="ff-praesentation-leiste" style={{ maxWidth: PRAESENTATION_BREITE, margin: '0 auto 12px' }}>
          <Hinweis art={pdf.datei ? 'gut' : 'kritisch'} aktion={pdf.datei ? <a href={`/api/crm/treppe/report?datei=${encodeURIComponent(pdf.datei)}`} download style={{ color: C.aktiv, fontSize: TYP.bedien, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>↓ PDF laden</a> : undefined}>{pdf.text}</Hinweis>
        </div>
      )}
      {fehler ? <Hinweis art="kritisch">{fehler}</Hinweis> : !sicht ? <Leer>Die Kunden-Seite lädt …</Leer> : <PraesentationInhalt sicht={sicht} />}
    </div>,
    document.body,
  );
}

/** Der Knopf „Dem Kunden zeigen“ — öffnet die Präsentation; der Fokus kommt beim Schließen hierher zurück. */
export function DemKundenZeigen({ mandatId, leise }: { mandatId: string; leise?: boolean }) {
  const [auf, setAuf] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <>
      <span ref={ref} style={{ display: 'inline-flex' }}>
        <Erklaert erklaerung="fulfillment.praesentation" name="Dem Kunden zeigen">
          <Knopf leise={leise} onClick={() => setAuf(true)}>Dem Kunden zeigen</Knopf>
        </Erklaert>
      </span>
      {auf && <Praesentation mandatId={mandatId} onZu={() => setAuf(false)} zurueck={ref.current?.querySelector('button') ?? null} />}
    </>
  );
}

/**
 * „Dem Kunden zeigen“ auf der Landkarte: erst den Kunden wählen (nur laufende Fälle), dann seine Seite im Vollbild. Die Landkarte selbst (mit den
 * Zählern aller Kunden) wird nie gezeigt — jeder Kunde sieht nur sich.
 */
export function PraesentationWahl({ faelle }: { faelle: readonly { mandatId: string; kunde: string; titel: string; status: string }[] }) {
  const [m, setM] = useState<string | null>(null);
  // 15.10. (Abnahme C15): nur der Kunde — mit dem Mandat-Titel daneben lief das Menü rechts an den Fensterrand („Strategie-Begl…“).
  const liste = faelle.filter(f => f.status !== 'abgeschlossen').map(f => ({ id: f.mandatId, label: f.kunde }));
  if (!liste.length) return null;
  return (
    <>
      <Erklaert erklaerung="fulfillment.praesentation" name="Dem Kunden zeigen">
        <Wahl label="Dem Kunden zeigen" leer="Dem Kunden zeigen" liste={liste} wert={null} onWahl={setM} />
      </Erklaert>
      {m && <Praesentation mandatId={m} onZu={() => setM(null)} />}
    </>
  );
}
