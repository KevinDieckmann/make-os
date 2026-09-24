'use client';

// ─── CRM · Marketing › Positionierung — Kevins eigene Worte ────────────────
// Positionierung, Zielgruppe (ICP), Ton und Themensäulen. Der Head of
// Marketing liest diesen Text als Grundlage für Themen und Entwürfe; die
// Säulen ordnen im Redaktionsplan jeden Beitrag ein. Gespeichert wird über
// POST /api/crm/marketing {aktion:'einstellung'} — der Server begrenzt
// Längen und Anzahl (lib/crm/marketing.ts, saeubereEinstellung).

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Leer, feld, LEUCHT } from '../../schlank';
import type { MarketingEinstellung } from '@/lib/crm/typen';
import { EINSTELLUNG_GRENZEN as G, einstellungAus } from '@/lib/crm/marketing';
import { type CrmApi, neueId } from '../daten';

const Zaehler = ({ n, max }: { n: number; max: number }) => <span style={{ fontSize: 11, color: n > max * 0.9 ? LEUCHT.achtung : C.inkLeise }}>{n}/{max}</span>;

export function Positionierung({ api }: { api: CrmApi }) {
  const crm = api.crm;
  const gespeichert = useMemo(() => einstellungAus(crm?.stand ?? {}), [crm]);
  const schluessel = JSON.stringify(gespeichert);
  const [e, setE] = useState<MarketingEinstellung>(gespeichert);
  const [basis, setBasis] = useState(schluessel);
  const [meldung, setMeldung] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const geaendert = JSON.stringify(e) !== basis;
  // Neuer Stand vom Server (z. B. Malin hat gespeichert) — übernehmen, solange hier nichts offen ist.
  useEffect(() => {
    if (schluessel === basis) return;
    if (!geaendert) setE(JSON.parse(schluessel) as MarketingEinstellung);
    setBasis(schluessel);
  }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
  const nutzung = useMemo(() => { const m = new Map<string, number>(); for (const b of crm?.stand.beitraege ?? []) if (b.saeule) m.set(b.saeule, (m.get(b.saeule) ?? 0) + 1); return m; }, [crm]);
  if (!crm) return <Karte i={0}><Leer>Lädt …</Leer></Karte>;

  const speichern = async () => {
    setLaeuft(true); setMeldung('');
    const r = await fetch('/api/crm/marketing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'einstellung', einstellung: e }) }).then(x => x.json()).catch(() => ({ ok: false }));
    setLaeuft(false);
    if (r.ok) { setE(r.einstellung); setBasis(JSON.stringify(r.einstellung)); setMeldung('Gespeichert.'); void api.laden(); }
    else setMeldung(r.fehler ?? 'Nicht gespeichert — keine Verbindung.');
  };
  const saeule = (i: number, x: Partial<MarketingEinstellung['saeulen'][number]>) => setE({ ...e, saeulen: e.saeulen.map((s, j) => (j === i ? { ...s, ...x } : s)) });
  const bereich = (f: 'positionierung' | 'icp', platzhalter: string) => (
    <textarea value={e[f]} rows={5} maxLength={G[f]} placeholder={platzhalter} aria-label={platzhalter} onChange={x => setE({ ...e, [f]: x.target.value })} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '9px 12px', lineHeight: 1.5 }} />
  );
  const knopf = <Knopf aus={!geaendert || laeuft} onClick={() => void speichern()}>{laeuft ? 'speichert …' : geaendert ? 'Speichern' : 'Gespeichert'}</Knopf>;

  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={knopf}>Positionierung</Ueberschrift>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkDim }}><span>Wofür wir stehen — in einem Absatz</span><Zaehler n={e.positionierung.length} max={G.positionierung} /></div>
            {bereich('positionierung', 'Für wen lösen wir welches Problem, und warum gerade wir?')}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkDim }}><span>Zielgruppe (ICP)</span><Zaehler n={e.icp.length} max={G.icp} /></div>
            {bereich('icp', 'Branche, Größe, Rolle, Auslöser — wer ist ein idealer Kunde, wer nicht?')}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.inkDim }}><span>Ton</span><Zaehler n={e.ton.length} max={G.ton} /></div>
            <input value={e.ton} maxLength={G.ton} placeholder="z. B. klar, direkt, keine Floskeln; Sie auf LinkedIn, Du im Newsletter" aria-label="Ton" onChange={x => setE({ ...e, ton: x.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '9px 12px' }} />
          </div>
        </div>
        {meldung && <div style={{ fontSize: TYP.bedien, color: meldung === 'Gespeichert.' ? LEUCHT.gut : LEUCHT.kritisch, marginTop: 10 }}>{meldung}</div>}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>Der Head of Marketing liest diesen Text als deine eigenen Worte — für Themen, Ton und Zielgruppe seiner Vorschläge.</div>
      </Karte>

      <Karte i={1}>
        <Ueberschrift rechts={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Knopf leise aus={e.saeulen.length >= G.saeulen} onClick={() => setE({ ...e, saeulen: [...e.saeulen, { id: neueId('s'), name: '', beschreibung: '' }] })}>+ Säule</Knopf>{knopf}
        </span>}>Themensäulen · {e.saeulen.length}/{G.saeulen}</Ueberschrift>
        {e.saeulen.length ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {e.saeulen.map((s, i) => (
              <div key={s.id} style={{ display: 'grid', gap: 6, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.03)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={s.name} maxLength={G.name} placeholder="Name der Säule*" aria-label="Name der Säule" onChange={x => saeule(i, { name: x.target.value })} style={{ ...feld, flex: 1, fontSize: TYP.bedien, padding: '8px 11px', fontWeight: 600 }} />
                  {(nutzung.get(s.id) ?? 0) > 0 && <span style={{ fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' }}>{nutzung.get(s.id)} Beiträge</span>}
                  <button onClick={() => { if ((nutzung.get(s.id) ?? 0) && !window.confirm(`„${s.name}“ ist ${nutzung.get(s.id)} Beiträgen zugeordnet. Trotzdem entfernen?`)) return; setE({ ...e, saeulen: e.saeulen.filter((_, j) => j !== i) }); }}
                    aria-label="Säule entfernen" title="Säule entfernen" style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 15, padding: '0 4px' }}>×</button>
                </div>
                <textarea value={s.beschreibung} rows={2} maxLength={G.beschreibung} placeholder="Worum geht es, welche Frage beantwortet sie?" aria-label="Beschreibung der Säule" onChange={x => saeule(i, { beschreibung: x.target.value })} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, padding: '8px 11px', lineHeight: 1.5 }} />
              </div>
            ))}
          </div>
        ) : <Leer>Drei bis fünf Säulen reichen: wiederkehrende Themen, zu denen du eine eigene Einsicht hast. Jeder Beitrag im Redaktionsplan bekommt eine davon.</Leer>}
        {e.saeulen.some(s => !s.name.trim()) && <div style={{ fontSize: 12, color: LEUCHT.achtung, marginTop: 8 }}>Säulen ohne Namen werden beim Speichern verworfen.</div>}
      </Karte>
    </>
  );
}
