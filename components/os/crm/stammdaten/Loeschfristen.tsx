'use client';

// ─── Stammdaten › Datenschutz · Löschfristen je Datenart (28.09., U2 #52) ────
// Die Tabelle aus lib/crm/loeschfristen.ts: Standard (Vorschlag), wirksamer Wert,
// anpassbar im Rahmen — gespeichert wird nur die Abweichung (POST /api/crm/datenschutz
// { aktion: 'fristen' }). Darunter die Personen über der Frist: NIE automatisch
// gelöscht — „Zur Person“ (dort Art. 17) oder „Frist verlängern mit Grund“.
// Hinweis, keine Rechtsberatung.

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, Leer, LEUCHT, feld } from '../../schlank';
import { fristText, monateZurueck, type FristArt } from '@/lib/crm/loeschfristen';
import { useNachfrage } from '../Nachfrage';
import { datum } from '../daten';
import type { StammdatenDaten } from './typen';

async function senden(body: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string }> {
  return fetch('/api/crm/datenschutz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'keine Verbindung' }));
}

export function Loeschfristen({ d, i, laden, zuKontakt }: { d: StammdatenDaten; i: number; laden: () => void; zuKontakt: (id: string) => void }) {
  const lf = d.loeschfristen;
  const [wert, setWert] = useState<Partial<Record<FristArt, string>>>({});
  const [meldung, setMeldung] = useState('');
  const { frage, dialog } = useNachfrage();
  const speichern = async (id: FristArt, v: number | null) => {
    const r = await senden({ aktion: 'fristen', fristen: { [id]: v } });
    setMeldung(r.ok ? 'Frist gespeichert.' : `Nicht gespeichert: ${r.fehler ?? ''}`);
    setWert(w => { const { [id]: _weg, ...rest } = w; return rest; });
    laden();
  };
  const verlaengern = async (id: string, name: string) => {
    const grund = await frage(`Frist verlängern — ${name}`, { hinweis: 'Grund (Pflicht), z. B. „laufende Gespräche über Empfehlung“ — steht im Verlauf der Person.' });
    if (!grund?.trim()) return;
    const bis = await frage('Verlängern bis (JJJJ-MM-TT)', { vorgabe: monateZurueck(d.heute, -12), hinweis: 'Höchstens 36 Monate ab heute.' });
    if (!bis?.trim()) return;
    const r = await senden({ aktion: 'frist-verlaengern', id, grund: grund.trim(), bis: bis.trim() });
    setMeldung(r.ok ? `Frist für ${name} verlängert.` : `Nicht verlängert: ${r.fehler ?? ''}`);
    laden();
  };
  const liste = d.speicherbegrenzung;
  return (
    <Karte i={i} akzent={liste.length ? LEUCHT.achtung : undefined}>
      <Ueberschrift rechts={lf.lauf ? <span style={{ fontSize: 12, color: C.inkLeise }}>Takt-Lauf {datum(lf.lauf.tag, d.heute)}</span> : undefined}>Löschfristen je Datenart</Ueberschrift>
      <div style={{ fontSize: 12, color: C.inkLeise, marginBottom: 8 }}>Werte sind Vorschläge — anpassbar im Rahmen, gespeichert wird nur die Abweichung. Personen werden nie automatisch gelöscht; technische Bestände bereinigt der tägliche Lauf (Protokoll „System“). Hinweis, keine Rechtsberatung.</div>
      <Liste>
        {lf.tabelle.map(f => {
          const w = lf.wirksam[f.id];
          const abweichend = lf.gespeichert[f.id] !== undefined;
          const einheit = f.einheit === 'monate' ? 'Monate' : 'Tage';
          return (
            <Zeile key={f.id} titel={f.titel} unter={`${f.hinweis} · ${f.norm}`}
              rechts={f.wirkung === 'fest'
                ? <Chip farbe={C.inkDim}>{fristText(f.id, w)}</Chip>
                : <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                    <input type="number" min={f.min} max={f.max} value={wert[f.id] ?? String(w)} aria-label={`${f.titel} in ${einheit}`}
                      onChange={e => setWert(x => ({ ...x, [f.id]: e.target.value }))}
                      onBlur={() => { const v = Number(wert[f.id]); if (wert[f.id] !== undefined && Number.isInteger(v) && v !== w) void speichern(f.id, v); }}
                      style={{ ...feld, width: 76, fontSize: TYP.bedien, padding: '6px 8px' }} />
                    <span style={{ fontSize: 12, color: C.inkLeise }}>{einheit}</span>
                    {abweichend ? <button onClick={() => void speichern(f.id, null)} title={`Standard: ${fristText(f.id, f.standard)}`} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12 }}>Standard</button>
                      : <Chip farbe={f.wirkung === 'automatisch' ? LEUCHT.agenten : LEUCHT.achtung}>{f.wirkung === 'automatisch' ? 'automatisch' : 'Aufgabe'}</Chip>}
                  </span>} />
          );
        })}
      </Liste>
      {meldung && <div role="status" style={{ fontSize: 12.5, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
      <div style={{ marginTop: 14, fontSize: TYP.bedien, color: liste.length ? LEUCHT.achtung : C.inkLeise }}>
        {liste.length ? `${liste.length} ${liste.length === 1 ? 'Kontakt' : 'Kontakte'} über der Frist (${fristText('kontakte', lf.wirksam.kontakte)} ohne Beziehung und Aktivität) — prüfen: löschen (in der Kontaktseite, Art. 17) oder Frist mit Grund verlängern.` : 'Heute ist niemand über der Frist.'}
      </div>
      {liste.length > 0 && (
        <div style={{ display: 'grid', gap: 2, marginTop: 6 }}>
          {liste.map(k => (
            <div key={k.id} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
              <span style={{ fontSize: 12.5, color: C.ink, flex: '1 1 200px' }}>{k.name} <span style={{ color: C.inkLeise }}>· {k.id} · letzte Spur {datum(k.seit)}</span></span>
              <Knopf leise onClick={() => zuKontakt(k.id)}>Zur Person</Knopf>
              <Knopf leise onClick={() => void verlaengern(k.id, k.name)}>Frist verlängern mit Grund</Knopf>
            </div>
          ))}
        </div>
      )}
      {!liste.length && !lf.lauf && <Leer>Der tägliche Lauf war noch nicht — er startet mit dem Takt ab 7 Uhr.</Leer>}
      {dialog}
    </Karte>
  );
}
