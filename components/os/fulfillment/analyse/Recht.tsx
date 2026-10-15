'use client';

// ─── Fulfillment · Analyse — Recht & Freigaben (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.4/4.5) ──────────────────────────────────────────────────
// Interessenabwägung (Muster, je Dossier bearbeitbar; Pflicht vor F1) → F1 (Umfang und Personenfunktionen, vom Kunden bestätigt am · wie) → Prüfung
// (deterministisch + Befunde des Prüfers) → Überstimmen (nur Qualität, mit Grund — Datenschutz nie) → F2. Hinweis, keine Rechtsberatung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import type { AnalyseAgentId } from '@/lib/fulfillment/typen';
import { AGENTEN, AGENT_IDS, MINIMALSET } from '@/lib/fulfillment/analyse/agenten';
import { LIA_FELDER, type LiaFeld } from '@/lib/fulfillment/analyse/dsgvo';
import { Karte, Ueberschrift, Knopf, Chip, Hinweis, Liste, Feldzeile, MehrfachPillen, Pillen, eingabe, LEUCHT, useRueckfrage } from '../../ui';
import { useOhneKuerzel } from '../prozesse/daten';
import { senden, fehlerVon, type AnalyseApi } from './daten';

type Rueck = ReturnType<typeof useRueckfrage>;
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;
const LIA_LABEL: Record<LiaFeld, string> = { zweck: 'Zweck', erforderlichkeit: 'Erforderlichkeit', abwaegung: 'Abwägung', schutz: 'Schutzmaßnahmen' };
const ART_FARBE = { dsgvo: LEUCHT.kritisch, quelle: LEUCHT.achtung, qualitaet: LEUCHT.planung } as const;
const ART_LABEL = { dsgvo: 'Datenschutz', quelle: 'Quelle', qualitaet: 'Qualität' } as const;

export function Recht({ mandatId, api, rueck }: { mandatId: string; api: AnalyseApi; rueck: Rueck }) {
  const lage = api.dossier!;
  const d = lage.dossier!;
  const [meldung, setMeldung] = useState<string | null>(null);
  const [lia, setLia] = useState<Record<LiaFeld, string>>(() => ({ ...lage.liaMuster, ...(d.interessenabwaegung ? { zweck: d.interessenabwaegung.zweck, erforderlichkeit: d.interessenabwaegung.erforderlichkeit, abwaegung: d.interessenabwaegung.abwaegung, schutz: d.interessenabwaegung.schutz } : {}) }));
  const [umfang, setUmfang] = useState<string[]>(d.f1?.umfang ?? [...MINIMALSET]);
  const [funktionen, setFunktionen] = useState((d.f1?.funktionen ?? []).join('\n'));
  const [bestaetigtAm, setBestaetigtAm] = useState(d.f1?.kundeBestaetigtAm ?? '');
  const [wie, setWie] = useState<'kickoff' | 'mail'>(d.f1?.wie ?? 'kickoff');
  const [grund, setGrund] = useState<Record<number, string>>({});
  // 15.10. (Abnahme B5): Befunde nennen nie „F1“/„F2“ — der Abstimmungspunkt heißt wie im Ablauf des Falls.
  const kuerzel = useOhneKuerzel(mandatId);
  const schritt = async (body: Record<string, unknown>) => {
    const r = await senden('/api/fulfillment/dossier', { mandatId, stand: lage.stand, ...body });
    setMeldung(fehlerVon(r));
    await api.laden();
  };
  const p = d.pruefung;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Hinweis art="info">{lage.rechtHinweis}</Hinweis>
      {meldung && <Hinweis art="achtung">{meldung}</Hinweis>}
      <Karte>
        <Ueberschrift rechts={d.interessenabwaegung ? <Chip farbe={LEUCHT.gut}>festgehalten {d.interessenabwaegung.am.slice(0, 10)}</Chip> : <Chip farbe={LEUCHT.achtung}>fehlt</Chip>}>Interessenabwägung (Art. 6 Abs. 1 lit. f)</Ueberschrift>
        <form onSubmit={e => { e.preventDefault(); void schritt({ aktion: 'lia', ...lia }); }} style={{ display: 'grid', gap: 8 }}>
          {LIA_FELDER.map(f => (
            <Feldzeile key={f} label={LIA_LABEL[f]}><textarea style={{ ...eingabe, minHeight: 72 }} maxLength={2000} value={lia[f]} onChange={e => setLia(x => ({ ...x, [f]: e.target.value }))} required /></Feldzeile>
          ))}
          <div><Knopf typ="submit">Interessenabwägung speichern</Knopf></div>
        </form>
      </Karte>
      <Karte>
        <Ueberschrift erklaerung="fulfillment.f1" rechts={d.f1 ? <Chip farbe={LEUCHT.gut}>bestätigt {d.f1.am.slice(0, 10)}</Chip> : <Chip farbe={LEUCHT.achtung}>offen</Chip>}>Umfang und Personenfunktionen</Ueberschrift>
        <form onSubmit={e => { e.preventDefault(); void schritt({ aktion: 'f1', umfang, funktionen: funktionen.split('\n').map(x => x.trim()).filter(Boolean), ...(bestaetigtAm ? { kundeBestaetigtAm: bestaetigtAm, wie } : {}) }); }} style={{ display: 'grid', gap: 8 }}>
          <div style={klein}>Welche Analysen laufen dürfen:</div>
          <MehrfachPillen liste={AGENT_IDS.filter(a => a !== 'a0').map(a => ({ id: a, label: `${a.toUpperCase()} ${AGENTEN[a].name}` }))} aktiv={umfang} onWahl={x => setUmfang(x as AnalyseAgentId[])} />
          <Feldzeile label="Funktionen für die berufliche Personenrecherche — je Zeile eine, keine Namen"><textarea style={{ ...eingabe, minHeight: 72 }} value={funktionen} onChange={e => setFunktionen(e.target.value)} placeholder={'Geschäftsführung\nVertriebsleitung'} /></Feldzeile>
          <Feldzeile label="Vom Kunden bestätigt am"><input type="date" style={eingabe} value={bestaetigtAm} onChange={e => setBestaetigtAm(e.target.value)} /></Feldzeile>
          <Pillen liste={[{ id: 'kickoff', label: 'im Kick-off' }, { id: 'mail', label: 'per Mail' }]} aktiv={wie} onWahl={x => setWie(x as 'kickoff' | 'mail')} />
          <div><Knopf typ="submit" aus={!d.interessenabwaegung}>Umfang festhalten</Knopf></div>
          {!d.interessenabwaegung && <div style={klein}>Erst die Interessenabwägung speichern.</div>}
        </form>
      </Karte>
      <Karte>
        <Ueberschrift rechts={p ? <Chip farbe={p.bestanden ? LEUCHT.gut : LEUCHT.kritisch}>{p.bestanden ? 'bestanden' : 'nicht bestanden'}</Chip> : undefined}>Prüfung</Ueberschrift>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf onClick={() => schritt({ aktion: 'pruefen' })}>Jetzt prüfen</Knopf>
        </div>
        {p && !p.befunde.length && <div style={klein}>Keine Befunde (geprüft {p.am.slice(0, 16).replace('T', ' ')}).</div>}
        <Liste>
          {(p?.befunde ?? []).map((b, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, padding: '6px 0' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip farbe={ART_FARBE[b.art]}>{ART_LABEL[b.art]}</Chip>
                {b.ueberstimmt && <Chip farbe={C.inkLeise}>überstimmt: {b.ueberstimmt.grund}</Chip>}
              </div>
              <div style={{ fontSize: TYP.body, color: C.ink }}>{kuerzel(b.text)}</div>
              {b.art === 'qualitaet' && !b.ueberstimmt && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input style={{ ...eingabe, flex: '1 1 220px' }} maxLength={300} placeholder="Grund (mindestens 10 Zeichen)" value={grund[i] ?? ''} onChange={e => setGrund(g => ({ ...g, [i]: e.target.value }))} aria-label="Grund für das Überstimmen" />
                  <Knopf leise aus={(grund[i] ?? '').trim().length < 10} onClick={() => schritt({ aktion: 'ueberstimmen', index: i, grund: grund[i] })}>Überstimmen</Knopf>
                </div>
              )}
            </div>
          ))}
        </Liste>
      </Karte>
      <Karte>
        <Ueberschrift erklaerung="fulfillment.f2" rechts={d.f2 ? <Chip farbe={LEUCHT.gut}>vermerkt {d.f2.am.slice(0, 10)}</Chip> : undefined}>Dossier geprüft</Ueberschrift>
        <Knopf haupt aus={!p?.bestanden || !!d.f2} onClick={async () => { if (await rueck.bestaetigen({ titel: 'Dossier als geprüft vermerken?', text: 'Das Dossier gilt dann als geprüft. Danach können Quick Wins, Kick-off-Fragen und Steckbrief-Felder per Klick weitergegeben werden.', ja: 'Als geprüft vermerken' })) await schritt({ aktion: 'f2' }); }}>Als geprüft vermerken</Knopf>
        {!p?.bestanden && <div style={klein}>„Dossier geprüft“ geht nur mit bestandener Prüfung.</div>}
      </Karte>
    </div>
  );
}
