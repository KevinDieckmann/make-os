'use client';

// ─── Prozesse — die Landkarte anpassen (22.10.; nach dem Demo-Rundgang: „alles muss anpassbar sein und immer wieder zu bearbeiten“) ──────────────────
// Der Stift auf der Landkarte öffnet rechts dieses Feld (sonst bleibt die Ansicht ruhig): je Bereich Name, Satz (Bänder), Ton aus der festen Palette, eigene
// Bereiche (oben/unten) anlegen und entfernen; je Kachel Reihenfolge (▲▼, Alt + ↑/↓, Ziehen — auch in einen anderen Bereich), Bereich, Beschriftung,
// aus-/einblenden; „Auf Vorgabe zurück“. Jede Änderung wirkt sofort im Bild (rein: lib/prozesse/landkarte-anpassung.ts) und geht als Schritt über den EINEN
// Schreibweg (POST /api/prozesse/landkarte, Stand/409, nacheinander — ./daten.ts `landkarteAnpassen`). Gespeichert werden nur Abweichungen von der Vorgabe.
// Rechnet nichts selbst; keine Farb-Literale (Töne nur aus `LANDKARTE_TOENE`), Farbe nie allein (jeder Ton trägt seinen Namen).

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Pencil, Plus, RotateCcw, Trash2, X, Check, Loader2 } from 'lucide-react';
import { FARBE as C, TYP, MIKRO, TIEF } from '@/lib/make-one/design';
import { Knopf, SymbolKnopf, Hinweis, Feldzeile, Pillen, Ueberschrift, auswahl as auswahlStil } from '../ui';
import { neueKennung } from '@/lib/kennung';
import { LANDKARTE_TOENE } from '@/lib/prozesse/farben';
import {
  LANDKARTE_GRENZEN, anpassungAendern, landkarteAnsicht, leereAnpassung, reiheVerschieben, reiheVor, bereichVorgabe,
  type LandkarteAnpassung, type LandkarteAnsicht, type LandkarteBereich, type LandkarteOp,
} from '@/lib/prozesse/landkarte-anpassung';
import type { ProzessBereich } from '@/lib/prozesse/definition';
import type { LandkarteDaten, ProzessDef } from '@/lib/prozesse/typen';
import { TextFeld } from './WerkstattMaske';
import { landkarteAnpassen } from './daten';

const klein = { fontSize: TYP.bedien, color: C.inkDim, margin: 0, lineHeight: 1.45 } as const;
const ZIEH_TYP = 'application/x-make-landkarte-kachel';
const LEER: LandkarteAnpassung = leereAnpassung();
const KEINE: readonly ProzessDef[] = [];

export type AnpassenSpeicher = { art: 'ruhe' | 'speichert' | 'fehler' | 'konflikt'; text?: string };

/**
 * Der Zustand „Landkarte anpassen“ für die Seite: die wirksame Anpassung (Server, darüber die eigenen ausstehenden Schritte), die Ansicht daraus und `aendern`
 * (Schritte sofort im Bild, dann nacheinander zum Server; 409 → die aktuelle Fassung des Servers, Fehler → zurück auf den Server).
 */
export function useLandkarteAnpassung(daten: LandkarteDaten | null): { ansicht: LandkarteAnsicht; anpassung: LandkarteAnpassung; speicher: AnpassenSpeicher; aendern: (ops: LandkarteOp[]) => Promise<void> } {
  const [lokal, setLokal] = useState<LandkarteAnpassung | null>(null);
  const [speicher, setSpeicher] = useState<AnpassenSpeicher>({ art: 'ruhe' });
  const offen = useRef(0);
  const stand = useRef('');
  const aktuell = useRef<LandkarteAnpassung>(LEER);
  // Die Fassung des Servers übernehmen, solange nichts aussteht (sonst bliebe ein eigener Schritt kurz unsichtbar).
  useEffect(() => {
    if (!daten || offen.current) return;
    stand.current = daten.anpassungStand ?? '';
    setLokal(null);
  }, [daten]);
  const anpassung = lokal ?? daten?.anpassung ?? LEER;
  aktuell.current = anpassung;
  const prozesse = daten?.prozesse;
  // Die Ansicht einmal je Anpassung bzw. Bestand (nicht je Mausbewegung).
  const ansicht = useMemo(() => landkarteAnsicht(prozesse ?? KEINE, anpassung), [prozesse, anpassung]);
  const aendern = useCallback(async (ops: LandkarteOp[]) => {
    if (!prozesse) return;
    const r0 = anpassungAendern(aktuell.current, ops, { prozesse, jetzt: new Date().toISOString(), person: '' });
    if (!r0.ok) { setSpeicher({ art: 'fehler', text: r0.fehler }); return; }
    if (!r0.geaendert) return;
    const zurueck = aktuell.current;
    aktuell.current = r0.anpassung;
    setLokal(r0.anpassung);
    offen.current++;
    setSpeicher({ art: 'speichert' });
    const r = await landkarteAnpassen(() => ({ stand: stand.current, ops }));
    offen.current--;
    const j = r.j;
    if (r.status === 200 && j?.ok && j.anpassung && typeof j.anpassungStand === 'string') {
      stand.current = j.anpassungStand;
      if (!offen.current) { aktuell.current = j.anpassung; setLokal(j.anpassung); setSpeicher({ art: 'ruhe' }); }
      return;
    }
    if (r.status === 409 && j?.anpassung && typeof j.anpassungStand === 'string') {
      stand.current = j.anpassungStand;
      aktuell.current = j.anpassung; setLokal(j.anpassung);
      setSpeicher({ art: 'konflikt', text: String(j.fehler ?? 'Inzwischen hat jemand anders die Landkarte angepasst.') });
      return;
    }
    // Nicht gespeichert: zurück auf die Fassung vor diesem Schritt — der Satz sagt, warum.
    aktuell.current = zurueck; setLokal(zurueck);
    setSpeicher({ art: 'fehler', text: String(j?.fehler ?? (r.status === 0 ? 'Keine Verbindung — die Änderung ist nicht gespeichert.' : 'Nicht gespeichert.')) });
  }, [prozesse]);
  return { ansicht, anpassung, speicher, aendern };
}

/** Ein Ton als Farbfeld mit Namen (Farbe nie allein). */
function TonWahl({ wert, onWahl, name }: { wert: string; onWahl: (id: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Ton von „${name}“`} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {LANDKARTE_TOENE.map(t => (
        <button key={t.id} type="button" role="radio" aria-checked={wert === t.id} className="fassbar" title={t.titel} onClick={() => onWahl(t.id)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 10px', borderRadius: 12, cursor: 'pointer', fontSize: TYP.bedien,
            border: `1px solid ${wert === t.id ? C.ink : TIEF.rand(t.ton)}`, background: TIEF.flaeche(t.ton), color: C.ink }}>
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: 6, background: t.ton }} />{t.titel}
        </button>
      ))}
    </div>
  );
}

/** Das Feld „Landkarte anpassen“ (siehe Kopf). */
export function LandkarteAnpassen({ ansicht, anpassung, speicher, aendern, onZu }: {
  ansicht: LandkarteAnsicht; anpassung: LandkarteAnpassung; speicher: AnpassenSpeicher; aendern: (ops: LandkarteOp[]) => Promise<void>; onZu: () => void;
}) {
  const [frageZurueck, setFrageZurueck] = useState(false);
  const [neuName, setNeuName] = useState('');
  const [neuLage, setNeuLage] = useState<'oben' | 'unten'>('unten');
  const [offen, setOffen] = useState<string | null>(null);
  const [kachelOffen, setKachelOffen] = useState<string | null>(null);
  const [ansage, setAnsage] = useState('');
  const ziehen = useRef<{ id: string; von: string } | null>(null);
  const leer = !anpassung.bereiche && !anpassung.eigene && !anpassung.kacheln && !anpassung.reihe;
  const eigene = (anpassung.eigene ?? []).length;
  // Reihenfolge der Abschnitte wie im Bild: oben (Führung, eigene oben), die Stufen, unten (Unterstützung, eigene unten).
  const reihe = [
    ...ansicht.bereiche.filter(b => b.lage === 'oben' && b.art !== 'eigen'), ...ansicht.bereiche.filter(b => b.lage === 'oben' && b.art === 'eigen'),
    ...ansicht.bereiche.filter(b => b.art === 'stufe'),
    ...ansicht.bereiche.filter(b => b.lage === 'unten' && b.art !== 'eigen'), ...ansicht.bereiche.filter(b => b.lage === 'unten' && b.art === 'eigen'),
  ];
  const ids = (b: string) => (ansicht.jeBereich[b] ?? []).map(p => p.id);
  const verschieben = (b: LandkarteBereich, id: string, r: -1 | 1) => {
    const neu = reiheVerschieben(ids(b.id), id, r);
    if (!neu) { setAnsage(r < 0 ? 'Steht schon vorn.' : 'Steht schon hinten.'); return; }
    void aendern([{ art: 'reihe', bereich: b.id, ids: neu }]);
    setAnsage(r < 0 ? 'Eins nach vorn.' : 'Eins nach hinten.');
  };
  const ablegen = (ziel: LandkarteBereich, vor: string | null) => {
    const z = ziehen.current;
    ziehen.current = null;
    if (!z || z.id === vor) return;
    const neu = reiheVor(ids(ziel.id), z.id, vor);
    void aendern(z.von === ziel.id ? [{ art: 'reihe', bereich: ziel.id, ids: neu }] : [{ art: 'kachel', id: z.id, bereich: ziel.id }, { art: 'reihe', bereich: ziel.id, ids: neu }]);
    setAnsage(z.von === ziel.id ? 'Verschoben.' : `In „${ziel.titel}“ verschoben.`);
  };
  const zieh = (b: LandkarteBereich, vor: string | null) => ({
    onDragOver: (e: DragEvent) => { if (ziehen.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } },
    onDrop: (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); ablegen(b, vor); },
  });
  const SP = speicher.art === 'speichert' ? Loader2 : Check;
  return (
    <div style={{ display: 'grid', gap: 12 }} aria-label="Landkarte anpassen">
      <Ueberschrift rechts={<SymbolKnopf ariaLabel="Anpassen beenden" onClick={onZu}><X size={16} /></SymbolKnopf>}>Landkarte anpassen</Ueberschrift>
      <p style={klein}>Namen, Töne, eigene Bereiche, Reihenfolge und welche Kacheln zu sehen sind — für alle im Haushalt. Gespeichert wird nur, was von der Vorgabe abweicht.</p>
      <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, color: speicher.art === 'ruhe' ? C.inkLeise : C.inkDim }}>
        <SP size={14} aria-hidden />{speicher.art === 'speichert' ? 'speichert …' : 'gespeichert'}
      </span>
      {(speicher.art === 'fehler' || speicher.art === 'konflikt') && speicher.text && <Hinweis art={speicher.art === 'fehler' ? 'kritisch' : 'achtung'}>{speicher.text}</Hinweis>}
      {reihe.map(b => {
        const kacheln = ansicht.jeBereich[b.id] ?? [];
        const vorgabe = b.art === 'eigen' ? null : bereichVorgabe(b.id as ProzessBereich);
        return (
          <section key={b.id} aria-label={`Bereich ${b.titel}`} {...zieh(b, null)} style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 14, border: `1px solid ${TIEF.rand(b.ton)}`, background: TIEF.flaeche(b.ton) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span aria-hidden style={{ width: 10, height: 10, borderRadius: 5, background: b.ton, flex: '0 0 auto' }} />
              <span style={{ ...MIKRO, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{b.titel}{b.art === 'eigen' ? ' · eigener Bereich' : ''}</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{kacheln.length}</span>
              <SymbolKnopf ariaLabel={`„${b.titel}“ bearbeiten`} gedrueckt={offen === b.id} onClick={() => setOffen(o => (o === b.id ? null : b.id))}><Pencil size={15} /></SymbolKnopf>
            </div>
            {offen === b.id && (
              <div style={{ display: 'grid', gap: 10 }}>
                <Feldzeile label={vorgabe ? `Name (Vorgabe „${vorgabe.titel}“)` : 'Name'}>
                  <TextFeld label={`Name von „${b.titel}“`} wert={b.titel} platz={vorgabe?.titel} onWert={v => void aendern([{ art: 'bereich', bereich: b.id, titel: v.trim() ? v : null }])} />
                </Feldzeile>
                {b.art !== 'stufe' && (
                  <Feldzeile label={vorgabe?.satz ? `Satz (Vorgabe „${vorgabe.satz}“)` : 'Satz (optional)'}>
                    <TextFeld label={`Satz von „${b.titel}“`} wert={b.satz ?? ''} platz={vorgabe?.satz} onWert={v => void aendern([{ art: 'bereich', bereich: b.id, satz: v.trim() ? v : null }])} />
                  </Feldzeile>
                )}
                <Feldzeile label={vorgabe ? `Ton (Vorgabe ${LANDKARTE_TOENE.find(t => t.id === vorgabe.ton)?.titel ?? ''})` : 'Ton'}>
                  <TonWahl name={b.titel} wert={b.tonId} onWahl={t => void aendern([{ art: 'bereich', bereich: b.id, ton: vorgabe && t === vorgabe.ton ? null : t }])} />
                </Feldzeile>
                {b.art === 'eigen' && (
                  <>
                    <Feldzeile label="Wo auf der Landkarte">
                      <Pillen liste={[{ id: 'oben', label: 'oben (unter Führung)' }, { id: 'unten', label: 'unten (unter Unterstützung)' }]} aktiv={b.lage ?? 'unten'} onWahl={l => void aendern([{ art: 'bereich', bereich: b.id, lage: l as 'oben' | 'unten' }])} />
                    </Feldzeile>
                    <div><Knopf leise onClick={async () => { await aendern([{ art: 'bereich-weg', bereich: b.id }]); setOffen(null); }} titel="Die Kacheln stehen danach wieder in ihrem Bereich der Vorgabe">
                      <span className="pz-knopf-inhalt"><Trash2 size={14} aria-hidden />Bereich entfernen</span>
                    </Knopf></div>
                  </>
                )}
              </div>
            )}
            {!kacheln.length && <p style={klein}>Noch keine Kachel — hierher ziehen oder bei einer Kachel diesen Bereich wählen.</p>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
              {kacheln.map((p, i) => {
                const name = p.beschriftung ?? p.titel;
                const taste = (e: KeyboardEvent) => {
                  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.target !== e.currentTarget) return;
                  e.preventDefault();
                  verschieben(b, p.id, e.key === 'ArrowUp' ? -1 : 1);
                };
                return (
                  <li key={p.id} tabIndex={0} draggable aria-label={`${name}${p.aus ? ' (ausgeblendet)' : ''} — Alt + Pfeil verschiebt`} onKeyDown={taste}
                    onDragStart={e => { ziehen.current = { id: p.id, von: b.id }; e.dataTransfer.setData(ZIEH_TYP, p.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { ziehen.current = null; }} {...zieh(b, p.id)}
                    style={{ display: 'grid', gap: 6, padding: '4px 6px', borderRadius: 10, background: C.flaecheHoch, opacity: p.aus ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <GripVertical size={14} aria-hidden color={C.inkLeise} style={{ flex: '0 0 auto', cursor: 'grab' }} />
                      <span style={{ flex: 1, minWidth: 0, fontSize: TYP.bedien, color: C.ink, overflowWrap: 'anywhere', textDecoration: p.aus ? 'line-through' : 'none' }}>{name}</span>
                      <SymbolKnopf ariaLabel={`„${name}“ nach vorn`} aus={i === 0} onClick={() => verschieben(b, p.id, -1)}><ArrowUp size={15} /></SymbolKnopf>
                      <SymbolKnopf ariaLabel={`„${name}“ nach hinten`} aus={i === kacheln.length - 1} onClick={() => verschieben(b, p.id, 1)}><ArrowDown size={15} /></SymbolKnopf>
                      <SymbolKnopf ariaLabel={p.aus ? `„${name}“ einblenden` : `„${name}“ ausblenden`} gedrueckt={!p.aus} onClick={() => void aendern([{ art: 'kachel', id: p.id, aus: !p.aus }])}>{p.aus ? <EyeOff size={15} /> : <Eye size={15} />}</SymbolKnopf>
                      <SymbolKnopf ariaLabel={`„${name}“ bearbeiten`} gedrueckt={kachelOffen === p.id} onClick={() => setKachelOffen(o => (o === p.id ? null : p.id))}><Pencil size={15} /></SymbolKnopf>
                    </div>
                    {kachelOffen === p.id && (
                      <div style={{ display: 'grid', gap: 8, padding: '0 4px 6px' }}>
                        <Feldzeile label={`Beschriftung (leer = „${p.titel}“)`}>
                          <TextFeld label={`Beschriftung von „${p.titel}“`} wert={p.beschriftung ?? ''} platz={p.titel} onWert={v => void aendern([{ art: 'kachel', id: p.id, beschriftung: v.trim() ? v : null }])} />
                        </Feldzeile>
                        <Feldzeile label="Bereich">
                          <select aria-label={`Bereich von „${name}“`} value={b.id} onChange={e => { void aendern([{ art: 'kachel', id: p.id, bereich: e.target.value }]); setAnsage(`„${name}“ steht jetzt in „${ansicht.bereiche.find(x => x.id === e.target.value)?.titel ?? ''}“.`); }} style={{ ...auswahlStil, width: '100%' }}>
                            {reihe.map(x => <option key={x.id} value={x.id}>{x.titel}</option>)}
                          </select>
                        </Feldzeile>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <section aria-label="Eigenen Bereich anlegen" style={{ display: 'grid', gap: 8 }}>
        <div style={{ ...MIKRO }}>Eigener Bereich</div>
        {eigene >= LANDKARTE_GRENZEN.eigeneBereiche ? <p style={klein}>{`Höchstens ${LANDKARTE_GRENZEN.eigeneBereiche} eigene Bereiche — erst einen entfernen.`}</p> : (
          <form onSubmit={async e => { e.preventDefault(); const t = neuName.trim(); if (!t) return; await aendern([{ art: 'bereich-neu', id: neueKennung('lb'), titel: t, lage: neuLage }]); setNeuName(''); setAnsage(`Bereich „${t}“ angelegt.`); }} style={{ display: 'grid', gap: 8 }}>
            <Feldzeile label="Name"><input aria-label="Name des neuen Bereichs" value={neuName} maxLength={LANDKARTE_GRENZEN.titel} onChange={e => setNeuName(e.target.value)} placeholder="z. B. Recruiting" style={{ ...auswahlStil, width: '100%', minHeight: 44, appearance: 'none', cursor: 'text' }} /></Feldzeile>
            <Pillen liste={[{ id: 'oben', label: 'oben' }, { id: 'unten', label: 'unten' }]} aktiv={neuLage} onWahl={l => setNeuLage(l as 'oben' | 'unten')} />
            <div><Knopf leise typ="submit" aus={!neuName.trim()}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Bereich anlegen</span></Knopf></div>
          </form>
        )}
      </section>
      {!leer && (frageZurueck ? (
        <Hinweis art="achtung" titel="Ganze Landkarte auf die Vorgabe zurücksetzen?"
          aktion={<span style={{ display: 'inline-flex', gap: 8 }}><Knopf onClick={async () => { await aendern([{ art: 'zuruecksetzen' }]); setFrageZurueck(false); setAnsage('Die Landkarte steht wieder wie vorgegeben.'); }}>Zurücksetzen</Knopf><Knopf leise onClick={() => setFrageZurueck(false)}>Abbrechen</Knopf></span>}>
          Namen, Töne, eigene Bereiche, Zuordnungen, Beschriftungen, Reihenfolge und ausgeblendete Kacheln gehen zurück auf die Vorgabe — für alle im Haushalt.
        </Hinweis>
      ) : <div><Knopf leise onClick={() => setFrageZurueck(true)}><span className="pz-knopf-inhalt"><RotateCcw size={14} aria-hidden />Auf Vorgabe zurück</span></Knopf></div>)}
      <div aria-live="polite" className="pz-nur-vorlesen">{ansage}</div>
    </div>
  );
}
