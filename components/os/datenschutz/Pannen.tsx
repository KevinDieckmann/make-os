'use client';

// ─── System › Datenschutz · Pannen-Register (Art. 33 Abs. 5, 05.10.) ────────
// Nur der Inhaber (Route 403 sonst). Jede Panne wird dokumentiert — auch die, die nicht gemeldet werden muss. Ablauf, Risiko-Matrix
// und Vorlagen: datenschutz/DATENPANNEN.md. Betroffene nur als Kategorien/Anzahl, nie mit Namen.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Liste, Zeile, Punkt, Feldzeile, feld, auswahl, LEUCHT, ZeileAktionen, useRueckfrage } from '../ui';
import { PANNEN_ARTEN, PANNEN_RISIKO, type Panne, type PannenRisiko } from '@/lib/datenschutz/pannen';

type Offen = Record<string, { text: string; dringend: boolean }[]>;
type Entwurf = Partial<Panne> & { arten: Panne['arten']; behoerde: Panne['behoerde']; benachrichtigt: Panne['benachrichtigt'] };
/** ISO-Zeit → Wert für <input type="datetime-local"> in der Ortszeit des Geräts (sonst verschöbe jedes Speichern die Zeit). */
const lokal = (iso: string) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
const LEER = (): Entwurf => ({ kenntnisAm: lokal(new Date().toISOString()), beschreibung: '', arten: [], betroffene: '', daten: '', risiko: 'risiko', begruendung: '', behoerde: { gemeldet: false }, benachrichtigt: { ja: false }, massnahmen: '' });

export function PannenKarte({ i = 4 }: { i?: number }) {
  const [d, setD] = useState<{ pannen: Panne[]; offen: Offen } | null>(null);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [meldung, setMeldung] = useState('');
  const { bestaetigen, dialog } = useRueckfrage();
  const laden = useCallback(async () => {
    const r = await fetch('/api/datenschutz/pannen', { cache: 'no-store' }).then(x => x.json()).catch(() => null);
    if (r?.ok) setD({ pannen: r.pannen, offen: r.offen });
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const senden = async (body: unknown) => {
    const r = await fetch('/api/datenschutz/pannen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD({ pannen: r.pannen, offen: r.offen }); setMeldung('Gespeichert.'); } else setMeldung(r.fehler ?? 'Nicht gespeichert.');
    return !!r.ok;
  };
  if (!d) return null; // kein Inhaber (403) → die Karte erscheint nicht
  const dringend = d.pannen.filter(p => (d.offen[p.id] ?? []).some(x => x.dringend)).length;
  return (
    <Karte i={i} id="pannen" akzent={dringend ? LEUCHT.kritisch : undefined}>
      <Ueberschrift rechts={<Knopf leise onClick={() => setEntwurf(LEER())}>+ Panne</Knopf>}>Pannen-Register (Art. 33 Abs. 5)</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginBottom: 8, lineHeight: 1.5 }}>Jede Datenpanne gehört hierher — auch ohne Meldepflicht. Bei Risiko: Meldung an die Aufsichtsbehörde binnen 72 Stunden ab Kenntnis; bei hohem Risiko zusätzlich die Betroffenen benachrichtigen. Ablauf und Vorlagen: datenschutz/DATENPANNEN.md. Nur der Inhaber sieht dieses Register.</div>
      {entwurf && <Formular e={entwurf} onAbbrechen={() => setEntwurf(null)} onSpeichern={async x => { if (await senden({ aktion: 'panne', panne: { ...x, kenntnisAm: x.kenntnisAm ? new Date(x.kenntnisAm).toISOString() : '' } })) setEntwurf(null); }} />}
      {!d.pannen.length && !entwurf && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Keine Panne eingetragen.</div>}
      <Liste>
        {d.pannen.map(p => {
          const o = d.offen[p.id] ?? [];
          const farbe = o.some(x => x.dringend) ? LEUCHT.kritisch : p.abgeschlossenAm ? LEUCHT.gut : LEUCHT.achtung;
          return (
            <ZeileAktionen key={p.id} titel={p.beschreibung.slice(0, 40)} onLoeschen={async () => { if (await bestaetigen({ titel: 'Eintrag löschen?', text: 'Das Register ist ein Nachweis (Art. 33 Abs. 5). Normal: abschließen — die Löschfrist räumt nach 36 Monaten auf.', ja: 'Trotzdem löschen', gefahr: true })) await senden({ aktion: 'panne-weg', id: p.id }); }}>
              <Zeile onClick={() => setEntwurf({ ...p, kenntnisAm: lokal(p.kenntnisAm) })} links={<Punkt farbe={farbe} />} umbrechen
                titel={`${p.kenntnisAm.slice(0, 10)} · ${p.beschreibung.slice(0, 80)}`}
                unter={o.length ? o.map(x => x.text).join(' · ') : `abgeschlossen am ${p.abgeschlossenAm}`}
                rechts={<Chip farbe={farbe}>{PANNEN_RISIKO.find(r => r.id === p.risiko)?.label}</Chip>} />
            </ZeileAktionen>
          );
        })}
      </Liste>
      {meldung && <div role="status" style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 8 }}>{meldung}</div>}
      {dialog}
    </Karte>
  );
}

function Formular({ e, onSpeichern, onAbbrechen }: { e: Entwurf; onSpeichern: (e: Entwurf) => void | Promise<void>; onAbbrechen: () => void }) {
  const [x, setX] = useState<Entwurf>(e);
  const s = <K extends keyof Entwurf>(k: K, v: Entwurf[K]) => setX(a => ({ ...a, [k]: v }));
  const ta = (k: 'beschreibung' | 'begruendung' | 'massnahmen', label: string) => <Feldzeile label={label}><textarea rows={3} value={String(x[k] ?? '')} onChange={ev => s(k, ev.target.value)} style={{ ...feld, resize: 'vertical', lineHeight: 1.5 }} /></Feldzeile>;
  const ein = (k: 'betroffene' | 'daten', label: string, platz?: string) => <Feldzeile label={label}><input value={String(x[k] ?? '')} placeholder={platz} onChange={ev => s(k, ev.target.value)} style={feld} /></Feldzeile>;
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', padding: '6px 0 16px' }}>
      <Feldzeile label="Kenntnis am (ab hier 72 Stunden)"><input type="datetime-local" value={x.kenntnisAm ?? ''} onChange={ev => s('kenntnisAm', ev.target.value)} style={feld} /></Feldzeile>
      <Feldzeile label="Risiko für die Betroffenen"><select value={x.risiko} onChange={ev => s('risiko', ev.target.value as PannenRisiko)} style={auswahl}>{PANNEN_RISIKO.map(r => <option key={r.id} value={r.id}>{r.label} — {r.pflicht}</option>)}</select></Feldzeile>
      {ta('beschreibung', 'Was ist passiert, Ursache')}
      <Feldzeile label="Art">
        <div style={{ display: 'grid', gap: 4 }}>{PANNEN_ARTEN.map(a => <label key={a.id} style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, color: C.inkDim }}><input type="checkbox" checked={x.arten.includes(a.id)} onChange={ev => s('arten', ev.target.checked ? [...x.arten, a.id] : x.arten.filter(y => y !== a.id))} /> {a.label}</label>)}</div>
      </Feldzeile>
      {ein('betroffene', 'Betroffene (Kategorien — keine Namen)', 'z. B. Geschäftskontakte')}
      <Feldzeile label="Anzahl (geschätzt)"><input type="number" min={0} value={x.anzahl ?? ''} onChange={ev => s('anzahl', ev.target.value === '' ? undefined : Number(ev.target.value))} style={feld} /></Feldzeile>
      {ein('daten', 'Datenkategorien', 'z. B. Name, E-Mail, Notizen')}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}><input type="checkbox" checked={!!x.verschluesselt} onChange={ev => s('verschluesselt', ev.target.checked)} /> Daten waren verschlüsselt (Schlüssel nicht betroffen)</label>
      {ta('begruendung', 'Begründung der Einstufung')}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}><input type="checkbox" checked={x.behoerde.gemeldet} onChange={ev => s('behoerde', { ...x.behoerde, gemeldet: ev.target.checked })} /> an die Aufsichtsbehörde gemeldet</label>
      {x.behoerde.gemeldet
        ? <><Feldzeile label="Gemeldet am"><input type="date" value={x.behoerde.am ?? ''} onChange={ev => s('behoerde', { ...x.behoerde, am: ev.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Aktenzeichen"><input value={x.behoerde.zeichen ?? ''} onChange={ev => s('behoerde', { ...x.behoerde, zeichen: ev.target.value })} style={feld} /></Feldzeile></>
        : <Feldzeile label="Grund der Nichtmeldung"><input value={x.behoerde.grund ?? ''} onChange={ev => s('behoerde', { ...x.behoerde, grund: ev.target.value })} style={feld} /></Feldzeile>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}><input type="checkbox" checked={x.benachrichtigt.ja} onChange={ev => s('benachrichtigt', { ...x.benachrichtigt, ja: ev.target.checked })} /> Betroffene benachrichtigt (Art. 34)</label>
      {x.benachrichtigt.ja
        ? <><Feldzeile label="Benachrichtigt am"><input type="date" value={x.benachrichtigt.am ?? ''} onChange={ev => s('benachrichtigt', { ...x.benachrichtigt, am: ev.target.value })} style={feld} /></Feldzeile>
            <Feldzeile label="Weg"><input value={x.benachrichtigt.weg ?? ''} onChange={ev => s('benachrichtigt', { ...x.benachrichtigt, weg: ev.target.value })} style={feld} /></Feldzeile></>
        : <Feldzeile label="Grund (falls keine Benachrichtigung)"><input value={x.benachrichtigt.grund ?? ''} onChange={ev => s('benachrichtigt', { ...x.benachrichtigt, grund: ev.target.value })} style={feld} /></Feldzeile>}
      {ta('massnahmen', 'Maßnahmen (sofort / dauerhaft)')}
      <Feldzeile label="Kunde informiert am (Kunden-Instanz)"><input type="date" value={x.kundeInformiertAm ?? ''} onChange={ev => s('kundeInformiertAm', ev.target.value)} style={feld} /></Feldzeile>
      <Feldzeile label="Abgeschlossen am"><input type="date" value={x.abgeschlossenAm ?? ''} onChange={ev => s('abgeschlossenAm', ev.target.value)} style={feld} /></Feldzeile>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Knopf onClick={() => onSpeichern(x)}>Speichern</Knopf>
        <Knopf leise onClick={onAbbrechen}>Abbrechen</Knopf>
      </div>
    </div>
  );
}
