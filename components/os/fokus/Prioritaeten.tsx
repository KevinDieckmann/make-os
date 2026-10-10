'use client';

// ─── Fokus › Prioritäten (10.10., früher „Kompass“: Regler und Reihenfolge) ─────────────────────────────────────────────────────
// Je Bereich EINE eigene Themenliste (Privat: Familie, Gesundheit, Erholung … · Business: Sales, Marketing, Produkt … und je Gesellschaft) —
// die Reihenfolge ist der Rang (▲▼), der Regler das Gewicht (wie viel Energie hineingeht), dazu die Zeit-Quellen, aus denen die Ist-Zeit
// kommt. Umbenennen, ergänzen, entfernen, auf die Vorgabe zurück. Die Liste kommt NUR für den gewählten Bereich vom Server
// (lib/fokus/steuerung-server.ts) — hier wird nichts ausgeblendet. Schreiben über useSteuerung (Stand/409).

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Settings2, X } from 'lucide-react';
import { FARBE as C, TYP, SCHRIFT, LEUCHT } from '@/lib/make-one/design';
import { neueKennung } from '@/lib/kennung';
import { HOCH_AB, LABEL_MAX, type SteuerThema } from '@/lib/fokus/steuerung';
import { Karte, Ueberschrift, Hinweis, Knopf, Leerzustand, MehrfachPillen, Segmentbalken, SymbolKnopf, feld, useRueckfrage } from '../ui';
import type { SteuerungSicht } from './useSteuerung';

/** Farbe eines Themas nach Rang — nur Anzeige (keine Farbe im Bestand). */
const FARBEN = [LEUCHT.planung, LEUCHT.gut, LEUCHT.schlaf, LEUCHT.beziehung, LEUCHT.business, LEUCHT.geld, LEUCHT.agenten, LEUCHT.puls];
export const themaFarbe = (rang: number) => FARBEN[rang % FARBEN.length];

export function Prioritaeten({ s, themenSetzen, vorgabe, i = 0 }: {
  s: SteuerungSicht;
  themenSetzen: (t: SteuerThema[]) => Promise<{ ok: boolean; meldung?: string }>;
  vorgabe: () => Promise<{ ok: boolean; meldung?: string }>;
  i?: number;
}) {
  const [liste, setListe] = useState<SteuerThema[]>(() => s.themen.map(({ id, label, gewicht, zeit, einheit }) => ({ id, label, gewicht, zeit, ...(einheit ? { einheit } : {}) })));
  const [meldung, setMeldung] = useState<string | null>(null);
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const { bestaetigen, dialog } = useRueckfrage();
  useEffect(() => { setListe(s.themen.map(({ id, label, gewicht, zeit, einheit }) => ({ id, label, gewicht, zeit, ...(einheit ? { einheit } : {}) }))); }, [s.themen]);
  const lesend = !s.darfThemen;

  /** Ganze Liste schreiben (nacheinander — der Stand kommt aus der letzten Antwort). */
  const schreiben = async (n: SteuerThema[]) => {
    if (lesend || laeuft) return;
    setListe(n); setLaeuft(true);
    const r = await themenSetzen(n);
    setLaeuft(false);
    setMeldung(r.ok ? null : r.meldung ?? 'Nicht gespeichert.');
  };
  const schieben = (idx: number, d: -1 | 1) => {
    const j = idx + d;
    if (j < 0 || j >= liste.length) return;
    const n = [...liste]; [n[idx], n[j]] = [n[j], n[idx]];
    void schreiben(n);
  };
  const aendern = (id: string, teil: Partial<SteuerThema>) => liste.map(t => (t.id === id ? { ...t, ...teil } : t));
  const anlegen = () => {
    const label = neu.trim();
    if (!label) return;
    setNeu('');
    void schreiben([...liste, { id: neueKennung('t'), label: label.slice(0, LABEL_MAX), gewicht: 50, zeit: [] }]);
  };
  const entfernen = async (t: SteuerThema) => {
    if (!(await bestaetigen({ titel: `„${t.label}“ entfernen?`, text: 'Das Thema verschwindet aus den Prioritäten. Die gemessene Zeit bleibt in der Zeitmessung.', ja: 'Entfernen', gefahr: true }))) return;
    void schreiben(liste.filter(x => x.id !== t.id));
  };
  const zuruecksetzen = async () => {
    if (!(await bestaetigen({ titel: 'Auf die Vorgabe zurücksetzen?', text: 'Die Themen dieses Bereichs werden durch die Vorgabe ersetzt (eigene Namen, Gewichte und Reihenfolge gehen verloren). Dein Soll bleibt.', ja: 'Zurücksetzen', gefahr: true }))) return;
    setLaeuft(true);
    const r = await vorgabe();
    setLaeuft(false);
    setMeldung(r.ok ? null : r.meldung ?? 'Nicht gespeichert.');
  };

  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.planung} rechts={s.quelle === 'alt' ? 'übernommen aus Kompass' : undefined}>Prioritäten</Ueberschrift>
      <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '0 0 12px' }}>Oben zählt zuerst. Der Regler sagt, wie viel Energie hineingeht — ab {HOCH_AB} hat ein Thema Vorfahrt in Tagesplan und Wochenplanung.</p>
      {lesend && <Hinweis art="info">Nur lesen — die Themen pflegen die Mitglieder des Haushalts. Dein eigenes Soll stellst du unten unter Zeit ein.</Hinweis>}
      {meldung && <Hinweis art="achtung" rolle="status">{meldung}</Hinweis>}
      {!liste.length ? (
        <Leerzustand symbol={<Plus size={18} />} titel="Noch keine Themen">Lege unten das erste Thema an — oder setze auf die Vorgabe zurück.</Leerzustand>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }} aria-label="Prioritäten">
          {liste.map((t, idx) => {
            const farbe = themaFarbe(idx);
            const auf = offen === t.id;
            return (
              <li key={t.id} className="fokus-prio-zeile" style={{ padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span aria-hidden style={{ fontFamily: SCHRIFT.display, fontSize: TYP.zahl, fontWeight: 700, color: farbe, width: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                  <input value={t.label} readOnly={lesend} aria-label={`Name von Thema ${idx + 1}`} maxLength={LABEL_MAX}
                    onChange={e => setListe(aendern(t.id, { label: e.target.value }))}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== s.themen.find(x => x.id === t.id)?.label) void schreiben(aendern(t.id, { label: v })); }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    style={{ ...feld, flex: '1 1 180px', minWidth: 0, fontWeight: 600 }} />
                  {!lesend && (
                    <span style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
                      <SymbolKnopf ariaLabel={`„${t.label}“ nach oben`} aus={idx === 0 || laeuft} onClick={() => schieben(idx, -1)}><ChevronUp size={16} /></SymbolKnopf>
                      <SymbolKnopf ariaLabel={`„${t.label}“ nach unten`} aus={idx === liste.length - 1 || laeuft} onClick={() => schieben(idx, 1)}><ChevronDown size={16} /></SymbolKnopf>
                      <SymbolKnopf ariaLabel={`„${t.label}“ einstellen`} gedrueckt={auf} offen={auf} steuert={`prio-${t.id}`} onClick={() => setOffen(auf ? null : t.id)}><Settings2 size={16} /></SymbolKnopf>
                      <SymbolKnopf ariaLabel={`„${t.label}“ entfernen`} gefahr aus={laeuft} onClick={() => entfernen(t)}><X size={16} /></SymbolKnopf>
                    </span>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 44px', gap: 12, alignItems: 'center', marginTop: 8, paddingLeft: 38 }}>
                  {lesend ? (
                    <Segmentbalken anteil={t.gewicht / 100} label={`${t.label}: Gewicht ${t.gewicht} von 100`} farbe={farbe} segmente={20} hoehe={12} />
                  ) : (
                    <Gewicht thema={t} farbe={farbe} aus={laeuft} onFertig={g => { if (g !== s.themen.find(x => x.id === t.id)?.gewicht) void schreiben(aendern(t.id, { gewicht: g })); }} />
                  )}
                  <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: t.gewicht >= HOCH_AB ? farbe : C.inkDim, textAlign: 'right' }}>{t.gewicht}</span>
                </div>
                {auf && !lesend && (
                  <div id={`prio-${t.id}`} style={{ marginTop: 10, paddingLeft: 38, display: 'grid', gap: 8 }}>
                    {t.einheit ? (
                      <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Zeit kommt aus den Fokus-Blöcken dieser Einheit.</span>
                    ) : (
                      <>
                        <span style={{ fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Zeit zählt aus</span>
                        <MehrfachPillen liste={s.quellen.map(q => ({ id: q.id, label: q.label }))} aktiv={t.zeit} farbe={farbe}
                          onWahl={ids => void schreiben(aendern(t.id, { zeit: ids.slice(0, 8) }))} />
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!lesend && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
          <form onSubmit={e => { e.preventDefault(); anlegen(); }} style={{ display: 'flex', gap: 8, flex: '1 1 260px', minWidth: 0 }}>
            <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="Neues Thema, z. B. Weiterbildung" aria-label="Neues Thema" maxLength={LABEL_MAX} style={{ ...feld, flex: 1, minWidth: 0 }} />
            <Knopf typ="submit" aus={!neu.trim() || laeuft}>+ Thema</Knopf>
          </form>
          <Knopf leise onClick={zuruecksetzen} aus={laeuft}>Vorgabe</Knopf>
        </div>
      )}
      {dialog}
    </Karte>
  );
}

/** Der Regler: lokal ziehen, beim Loslassen (Maus, Finger, Tastatur, Verlassen) speichern. */
function Gewicht({ thema, farbe, aus, onFertig }: { thema: SteuerThema; farbe: string; aus?: boolean; onFertig: (g: number) => void }) {
  const [wert, setWert] = useState(thema.gewicht);
  useEffect(() => { setWert(thema.gewicht); }, [thema.gewicht]);
  const fertig = () => onFertig(wert);
  return (
    <input type="range" min={0} max={100} step={5} value={wert} disabled={aus} aria-label={`Gewicht von „${thema.label}“`}
      onChange={e => setWert(Number(e.target.value))} onPointerUp={fertig} onKeyUp={fertig} onBlur={fertig}
      style={{ width: '100%', minWidth: 0, minHeight: 44, accentColor: farbe, cursor: aus ? 'default' : 'pointer' }} />
  );
}
