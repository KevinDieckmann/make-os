'use client';

// ─── „Zu prüfen“ — der Prüfmodus der Buchhaltung (02.11.) ──────────────────────────────────────────────────────────────────────
// Gruppiert nach Gegenseite (lib/finanzen/buchhaltung/pruefung.ts `pruefGruppen`). Je Buchung: Vorschlag + „Passt“, „Ändern“ (öffnet das
// Bearbeiten), Frage mit Antwort-Chips, Bewirtung mit Anlass/Teilnehmer, Beleg-Hinweis. Oben „Alle ohne Frage bestätigen“ — nur, was keine offene
// Frage und keine fehlende Bewirtungs-Angabe hat. Bestätigt von/am stempelt der Server; nichts geht an ZOE.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/make-one/finance-data';
import { Karte, Ueberschrift, Knopf, Chip, Wahl, Leer, LEUCHT, feld } from '../ui';
import { ohneFrageBestaetigbar, pruefGruppen, pruefHinweise, bewirtungFehlt } from '@/lib/finanzen/buchhaltung/pruefung';
import type { BhBuchung } from '@/lib/finanzen/buchhaltung/arbeitsliste';
import type { TeilFelder } from '@/lib/finanzen/buchhaltung/teil';

const tagText = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(2, 4)}`;
const geld = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

export function Pruefen({ alle, onTeil, onAendern }: {
  alle: readonly BhBuchung[];
  /** Mehrere Änderungen (je Buchung mit Stand) — true = gespeichert. */
  onTeil: (ops: { b: BhBuchung; felder: TeilFelder }[]) => Promise<boolean>;
  onAendern: (b: BhBuchung) => void;
}) {
  const gruppen = pruefGruppen(alle);
  const bestaetigbar = gruppen.flatMap(g => g.buchungen).filter(ohneFrageBestaetigbar);
  const gesamt = gruppen.reduce((s, g) => s + g.buchungen.length, 0);

  if (!gesamt) return <Karte i={1}><Leer symbol="✓">Nichts zu prüfen — alle Buchungen sind bestätigt.</Leer></Karte>;
  return (
    <>
      <Karte i={1} ton={LEUCHT.achtung}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={`${gesamt} ${gesamt === 1 ? 'Buchung' : 'Buchungen'} · ${gruppen.length} Gegenseiten`}>Zu prüfen</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginBottom: 10 }}>
          Je Gegenseite: Vorschlag ansehen, „Passt“ oder „Ändern“. Fragen per Chip beantworten. Bewirtung braucht Anlass und Teilnehmer.
        </div>
        <Knopf aus={!bestaetigbar.length} onClick={() => onTeil(bestaetigbar.map(b => ({ b, felder: { bestaetigen: true } })))}>
          {`Alle ohne Frage bestätigen (${bestaetigbar.length})`}
        </Knopf>
      </Karte>
      {gruppen.map((g, i) => (
        <Karte key={g.schluessel} i={i + 2}>
          <Ueberschrift rechts={<span style={{ ...geld, color: g.summeCent > 0 ? LEUCHT.gut : C.inkDim }}>{eur(g.summeCent / 100)}</span>}>
            {`${g.gegenseite} · ${g.buchungen.length}`}
          </Ueberschrift>
          <div style={{ display: 'grid', gap: 12 }}>
            {g.buchungen.map(b => <PruefZeile key={b.id} b={b} onTeil={f => onTeil([{ b, felder: f }])} onAendern={() => onAendern(b)} />)}
          </div>
        </Karte>
      ))}
    </>
  );
}

function PruefZeile({ b, onTeil, onAendern }: { b: BhBuchung; onTeil: (f: TeilFelder) => Promise<boolean>; onAendern: () => void }) {
  const p = b.pruefung;
  const vorschlag = p?.status === 'offen' ? p.vorschlag ?? b.kategorie : b.kategorie;
  const hinweise = pruefHinweise(b);
  const [anlass, setAnlass] = useState(b.bewirtung?.anlass ?? '');
  const [teilnehmer, setTeilnehmer] = useState(b.bewirtung?.teilnehmer ?? '');
  const [eigen, setEigen] = useState('');
  const fragOffen = !!(p?.status === 'offen' && p.frage && !p.antwort);
  const bewirtung = bewirtungFehlt(b) || !!b.bewirtung;

  return (
    <div style={{ display: 'grid', gap: 8, paddingBottom: 10, borderBottom: `1px solid ${C.linie}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...geld, fontSize: 13, color: C.inkDim }}>{tagText(b.datum)}</span>
        <span style={{ ...geld, color: Number(b.betrag) > 0 ? LEUCHT.gut : C.ink }}>{eur(b.betrag)}</span>
        <Chip farbe={p?.status === 'offen' ? LEUCHT.achtung : LEUCHT.gut}>{vorschlag || 'ohne Kategorie'}</Chip>
        {hinweise.map(h => <Chip key={h} farbe={LEUCHT.achtung}>{h}</Chip>)}
      </div>
      {b.zweck && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflowWrap: 'anywhere' }}>{b.zweck}</div>}
      {p?.frage && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontSize: TYP.bedien, color: C.ink }}>{p.frage.text}</div>
          <div className="ui-pillen">
            {(p.frage.optionen ?? []).map(o => <Wahl key={o} klein an={p.antwort === o} onClick={() => { void onTeil({ antwort: o }); }}>{o}</Wahl>)}
          </div>
          <form onSubmit={e => { e.preventDefault(); if (eigen.trim()) void onTeil({ antwort: eigen.trim() }).then(ok => { if (ok) setEigen(''); }); }} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input value={eigen} onChange={e => setEigen(e.target.value)} placeholder={p.antwort ? `Antwort: ${p.antwort}` : 'eigene Antwort'} aria-label="Eigene Antwort" style={{ ...feld, flex: '1 1 200px' }} />
            <Knopf leise typ="submit" aus={!eigen.trim()}>Antworten</Knopf>
          </form>
        </div>
      )}
      {bewirtung && (
        <form onSubmit={e => { e.preventDefault(); void onTeil({ bewirtung: { anlass: anlass.trim(), teilnehmer: teilnehmer.trim() } }); }} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input value={anlass} onChange={e => setAnlass(e.target.value)} placeholder="Anlass" aria-label="Anlass der Bewirtung" style={{ ...feld, flex: '1 1 160px' }} />
          <input value={teilnehmer} onChange={e => setTeilnehmer(e.target.value)} placeholder="Teilnehmer" aria-label="Teilnehmer der Bewirtung" style={{ ...feld, flex: '1 1 200px' }} />
          <Knopf leise typ="submit" aus={!anlass.trim() || !teilnehmer.trim()}>Bewirtung speichern</Knopf>
        </form>
      )}
      {b.belegHinweis && (
        <div style={{ fontSize: TYP.bedien, color: b.belegHinweis.vorhanden ? C.inkDim : LEUCHT.achtung }}>
          {b.belegHinweis.vorhanden ? `Beleg vorhanden${b.belegHinweis.quelle ? ` · ${b.belegHinweis.quelle}` : ''}${b.belegHinweis.datei ? ` · ${b.belegHinweis.datei}` : ''}` : 'Kein Beleg — bitte ablegen oder vermerken.'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {p?.status === 'offen' && <Knopf aus={fragOffen || bewirtungFehlt(b)} onClick={() => onTeil({ bestaetigen: true })}>Passt</Knopf>}
        <Knopf leise onClick={onAendern}>Ändern</Knopf>
      </div>
    </div>
  );
}
