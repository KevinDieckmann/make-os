'use client';

// ─── MAKE OS — Familie & Partnerschaft (24.09.) ─────────────────────────────
// Kevin: „Man muss eine Familie darüber managen. Wichtig ist mir, dass ein
// klarer Fokus auf den Ehepartner gelegt wird, ansonsten geht das Fundament
// kaputt.“ Deshalb zuerst „Wir zwei“, dann „Familie“, dann der „Rahmen“.
// Konzept: docs/konzepte/familie-und-partnerschaft.md

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Seite, Karte, Ueberschrift, Segmente, Leer, Knopf, LEUCHT } from '../schlank';
import { useFamilie, WOCHENTAGE, type FamilieApi } from './daten';
import { WirZwei } from './WirZwei';
import { Gespraech } from './Gespraech';
import { FamilieOrga } from './FamilieOrga';
import { Auswahl, Klein, Reihe, Wahl } from './teile';

type Bereich = 'wir' | 'familie' | 'rahmen';

export function FamilieView() {
  const api = useFamilie();
  const [bereich, setBereich] = useState<Bereich>('wir');
  const [gespraech, setGespraech] = useState(false);
  const d = api.d;

  return (
    <Seite titel="Familie & Partnerschaft" unter="Erst wir zwei, dann die Familie. Gemessen wird, was ihr gemeinsam tut — nie eine Person."
      rechts={d ? <Segmente liste={[{ id: 'wir', label: 'Wir zwei' }, { id: 'familie', label: 'Familie' }, { id: 'rahmen', label: 'Rahmen' }]} aktiv={bereich} onWahl={b => { setBereich(b); setGespraech(false); }} /> : undefined}>
      {!d ? (
        <Karte i={0}><Leer>{api.fehler ?? 'Lädt …'}</Leer></Karte>
      ) : gespraech ? (
        <Gespraech api={api} onZu={() => setGespraech(false)} />
      ) : bereich === 'wir' ? (
        <WirZwei api={api} onGespraech={() => setGespraech(true)} />
      ) : bereich === 'familie' ? (
        <FamilieOrga api={api} />
      ) : (
        <Rahmen api={api} />
      )}
      {d && api.fehler && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{api.fehler}</div>}
    </Seite>
  );
}

function Rahmen({ api }: { api: FamilieApi }) {
  const d = api.d!;
  const e = d.familie.einstellungen;
  const setze = (teil: Partial<typeof e>) => api.felder({ einstellungen: { ...e, ...teil } });
  const [ausnahme, setAusnahme] = useState(e.ausnahmeBis ?? '');
  const zeit = (v: string, onW: (x: string) => void, label: string) => <input type="time" value={v} aria-label={label} onChange={x => onW(x.target.value)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 10px', color: C.ink }} />;
  return (
    <>
      <Karte i={0} akzent={LEUCHT.beziehung}>
        <Ueberschrift farbe={LEUCHT.beziehung}>Unser Paar-Gespräch</Ueberschrift>
        <Klein>Ein fester Termin pro Woche, 30 bis 45 Minuten, immer mit derselben Agenda. Er ist wichtiger als jedes Business-Meeting — und wird genauso geschützt.</Klein>
        <div style={{ marginTop: 12 }}>
          <Reihe>
            <Auswahl label="Wochentag" wert={e.gespraech.wochentag} liste={WOCHENTAGE.map((w, i) => ({ id: i, label: w }))} onWahl={wochentag => setze({ gespraech: { ...e.gespraech, wochentag } })} />
            {zeit(e.gespraech.uhrzeit, uhrzeit => setze({ gespraech: { ...e.gespraech, uhrzeit } }), 'Uhrzeit')}
            <Auswahl label="Dauer" wert={e.gespraech.dauerMin} liste={[30, 45, 60].map(n => ({ id: n, label: `${n} Minuten` }))} onWahl={dauerMin => setze({ gespraech: { ...e.gespraech, dauerMin } })} />
          </Reihe>
        </div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift farbe={LEUCHT.beziehung}>Business-freie Zeiten</Ueberschrift>
        <Klein>Ehe ist kein Business. In diesen Zeiten gibt es keine Business-Themen — MAKE OS erinnert euch im Paar-Gespräch daran, ob es geklappt hat.</Klein>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {e.businessFrei.map((b, i) => (
            <Reihe key={i}>
              <div style={{ display: 'flex', gap: 4 }}>
                {WOCHENTAGE.map((w, t) => {
                  const an = b.tage.includes(t);
                  return <button key={w} onClick={() => setze({ businessFrei: e.businessFrei.map((x, j) => (j === i ? { ...x, tage: an ? x.tage.filter(y => y !== t) : [...x.tage, t].sort() } : x)) })}
                    aria-pressed={an} style={{ width: 34, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, border: `1px solid ${an ? LEUCHT.beziehung : 'rgba(255,255,255,.1)'}`, background: an ? `${LEUCHT.beziehung}22` : 'transparent', color: an ? LEUCHT.beziehung : C.inkDim }}>{w.slice(0, 2)}</button>;
                })}
              </div>
              {zeit(b.von, von => setze({ businessFrei: e.businessFrei.map((x, j) => (j === i ? { ...x, von } : x)) }), 'von')}
              {zeit(b.bis, bis => setze({ businessFrei: e.businessFrei.map((x, j) => (j === i ? { ...x, bis } : x)) }), 'bis')}
              <Knopf leise onClick={() => setze({ businessFrei: e.businessFrei.filter((_, j) => j !== i) })}>Entfernen</Knopf>
            </Reihe>
          ))}
          <div><Knopf leise onClick={() => setze({ businessFrei: [...e.businessFrei, { tage: [6], von: '18:00', bis: '23:59' }] })}>+ Zeitfenster</Knopf></div>
        </div>
      </Karte>

      <Karte i={2}>
        <Ueberschrift>Ausnahmezeit</Ueberschrift>
        <Klein>Urlaub, Krankheit, Geburt, Umzug: Der Rhythmus pausiert, statt euch zu bewerten.</Klein>
        <Reihe>
          <input type="date" value={ausnahme} aria-label="Pausiert bis" onChange={x => setAusnahme(x.target.value)} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: '8px 10px', color: C.ink, marginTop: 10 }} />
          <Knopf leise onClick={() => setze({ ausnahmeBis: ausnahme || null })}>Pausieren bis dahin</Knopf>
          {e.ausnahmeBis && <Knopf leise onClick={() => { setAusnahme(''); setze({ ausnahmeBis: null }); }}>Pause beenden</Knopf>}
        </Reihe>
      </Karte>

      <Karte i={3}>
        <Ueberschrift>Kinder</Ueberschrift>
        <Reihe>
          <Wahl liste={[{ id: 'nein', label: 'Keine Kinder' }, { id: 'ja', label: 'Mit Kindern' }]} aktiv={e.kinder ? 'ja' : 'nein'} onWahl={x => setze({ kinder: x === 'ja' })} farbe={LEUCHT.beziehung} />
          <Klein>Mit Kindern kommen eigene Aufgabenkarten dazu (Kita, Bringen, Kinderarzt, Einzelzeit).</Klein>
        </Reihe>
      </Karte>
    </>
  );
}
