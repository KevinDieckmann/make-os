'use client';

// ─── Kalender: Termin anlegen (27.09.) ──────────────────────────────────────
// Oben eine Zeile wie in Google Kalender („Mo 10 Uhr Kaffee mit Frank 45min“),
// darunter die Felder, die daraus entstehen — korrigierbar. Serie, Erinnerung,
// Ort, Notiz, für wen (welcher Apple-Kalender). Versendet wird nie etwas.

import { useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Segmente, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { schnellLesen } from '@/lib/kalender/schnell';
import { WER_FARBE, WER_LABEL, type Wer } from './teile';

export interface Vorgabe { tag: string; von?: string; bis?: string; ganztags?: boolean; wer?: Wer; titel?: string }
type Wieder = 'keine' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
const WIEDER: { id: Wieder; label: string }[] = [{ id: 'keine', label: 'einmalig' }, { id: 'DAILY', label: 'täglich' }, { id: 'WEEKLY', label: 'wöchentlich' }, { id: 'MONTHLY', label: 'monatlich' }, { id: 'YEARLY', label: 'jährlich' }];
const ERINNERUNG: { id: string; label: string }[] = [{ id: '-1', label: 'keine' }, { id: '0', label: 'pünktlich' }, { id: '10', label: '10 Min' }, { id: '30', label: '30 Min' }, { id: '60', label: '1 Std' }, { id: '1440', label: '1 Tag' }];
const plusMin = (hhmm: string, min: number) => { const [h, m] = hhmm.split(':').map(Number); const g = Math.min(24 * 60, h * 60 + m + min); return `${String(Math.floor(g / 60)).padStart(2, '0')}:${String(g % 60).padStart(2, '0')}`; };

export function NeuerTermin({ vorgabe, heute, standardDauer, kalender, onZu, onAngelegt }: {
  vorgabe: Vorgabe; heute: string; standardDauer: number; kalender: { name: string; wer: Wer; schreibbar: boolean }[]; onZu: () => void; onAngelegt: () => void;
}) {
  const [schnell, setSchnell] = useState(vorgabe.titel ?? '');
  const [f, setF] = useState({ titel: vorgabe.titel ?? '', tag: vorgabe.tag, von: vorgabe.von ?? '09:00', bis: vorgabe.bis ?? plusMin(vorgabe.von ?? '09:00', standardDauer), ganztags: !!vorgabe.ganztags, wer: vorgabe.wer ?? 'kevin' as Wer, kalender: '', ort: '', notiz: '', wieder: 'keine' as Wieder, bisDatum: '', erinnerung: '-1' });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ausSchnell, setAusSchnell] = useState<string[]>([]);
  const schreibbar = useMemo(() => kalender.filter(k => k.schreibbar), [kalender]);

  // Die Schnellzeile füllt die Felder — jede Änderung der Zeile überschreibt nur, was sie erkennt.
  useEffect(() => {
    if (!schnell.trim()) { setAusSchnell([]); return; }
    const s = schnellLesen(schnell, heute, standardDauer);
    setAusSchnell(s.erkannt);
    setF(alt => ({ ...alt, titel: s.titel || alt.titel, tag: s.erkannt.some(e => /^(am |heute|morgen|übermorgen|Mo|Di|Mi|Do|Fr|Sa|So)/.test(e)) ? s.tag : alt.tag,
      ganztags: s.ganztags, ...(s.von ? { von: s.von } : {}), ...(s.bis ? { bis: s.bis } : {}), ...(s.wer ? { wer: s.wer } : {}), ...(s.ort ? { ort: s.ort } : {}), ...(s.wiederholung ? { wieder: s.wiederholung } : {}) }));
  }, [schnell, heute, standardDauer]);

  const speichern = async () => {
    if (!f.titel.trim()) { setFehler('Ein Titel fehlt.'); return; }
    if (!f.ganztags && f.bis <= f.von) { setFehler('Das Ende liegt vor dem Anfang.'); return; }
    setLaeuft(true); setFehler(null);
    const body: Record<string, unknown> = {
      titel: f.titel.trim(), ganztags: f.ganztags,
      start: f.ganztags ? f.tag : `${f.tag}T${f.von}`, ende: f.ganztags ? plusTag(f.tag) : `${f.tag}T${f.bis}`,
      ...(f.kalender ? { kalender: f.kalender } : { wer: f.wer }), ...(f.ort.trim() ? { ort: f.ort.trim() } : {}), ...(f.notiz.trim() ? { notiz: f.notiz.trim() } : {}),
      ...(f.wieder !== 'keine' ? { wiederholung: { freq: f.wieder, ...(f.bisDatum ? { bis: f.bisDatum } : {}) } } : {}),
      ...(Number(f.erinnerung) >= 0 ? { erinnerungMin: Number(f.erinnerung) } : {}),
    };
    const r = await fetch('/api/kalender/termin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (r.ok) { onAngelegt(); onZu(); } else setFehler(r.fehler ?? 'Nicht angelegt.');
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px', colorScheme: 'dark' as const };
  const beschr = { fontSize: 12.5, color: C.inkLeise };
  return (
    <Fenster breit={600} onZu={onZu} titel="Neuer Termin">
      <input autoFocus value={schnell} onChange={e => setSchnell(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void speichern(); }} placeholder="Schnell: „Mo 10 Uhr Kaffee mit Frank 45min“ · „morgen 14-16 Steuerberater @kevin“ · „3.10. Geburtstag ganztags“" aria-label="Schnelleingabe" style={{ ...eingabe, fontSize: 15, padding: '12px 14px' }} />
      {ausSchnell.length > 0 && <div style={{ fontSize: 12, color: LEUCHT.gut }}>verstanden: {ausSchnell.join(' · ')}</div>}
      <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Titel</span><input value={f.titel} onChange={e => setF({ ...f, titel: e.target.value })} style={eingabe} /></label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 4, flex: '1 1 150px' }}><span style={beschr}>Tag</span><input type="date" value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} style={eingabe} /></label>
        {!f.ganztags && <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={beschr}>Von</span><input type="time" step={300} value={f.von} onChange={e => setF({ ...f, von: e.target.value, bis: f.bis <= e.target.value ? plusMin(e.target.value, standardDauer) : f.bis })} style={eingabe} /></label>}
        {!f.ganztags && <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={beschr}>Bis</span><input type="time" step={300} value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} style={eingabe} /></label>}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, color: C.inkDim, paddingBottom: 10 }}><input type="checkbox" checked={f.ganztags} onChange={e => setF({ ...f, ganztags: e.target.checked })} /> ganztägig</label>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={beschr}>Für wen · Kalender</span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmente liste={(['kevin', 'malin', 'beide'] as Wer[]).map(w => ({ id: w, label: WER_LABEL[w] }))} aktiv={f.wer} onWahl={w => setF({ ...f, wer: w, kalender: '' })} />
          {schreibbar.length > 0 && (
            <select value={f.kalender} onChange={e => setF({ ...f, kalender: e.target.value })} aria-label="Kalender" style={{ ...eingabe, width: 'auto' }}>
              <option value="">Standard für {WER_LABEL[f.wer]}</option>
              {schreibbar.map(k => <option key={k.name} value={k.name}>{k.name}</option>)}
            </select>
          )}
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: WER_FARBE[f.wer] }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Wiederholung</span><Segmente liste={WIEDER} aktiv={f.wieder} onWahl={w => setF({ ...f, wieder: w })} /></div>
        {f.wieder !== 'keine' && <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>bis (optional)</span><input type="date" value={f.bisDatum} onChange={e => setF({ ...f, bisDatum: e.target.value })} style={eingabe} /></label>}
      </div>
      <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Erinnerung (auf iPhone und Mac)</span><Segmente liste={ERINNERUNG} aktiv={f.erinnerung} onWahl={e => setF({ ...f, erinnerung: e })} /></div>
      <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Ort</span><input value={f.ort} onChange={e => setF({ ...f, ort: e.target.value })} placeholder="optional" style={eingabe} /></label>
      <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Notiz</span><textarea value={f.notiz} rows={2} onChange={e => setF({ ...f, notiz: e.target.value })} placeholder="optional" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} /></label>
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: C.inkLeise }}>Landet in iCloud — auf iPhone und Mac sichtbar. Keine Einladungen, kein Versand.</span>
        <div style={{ display: 'flex', gap: 8 }}><Knopf leise onClick={onZu}>Abbrechen</Knopf><Knopf farbe={LEUCHT.puls} aus={laeuft || !f.titel.trim()} onClick={() => void speichern()}>{laeuft ? 'legt an …' : 'Anlegen'}</Knopf></div>
      </div>
    </Fenster>
  );
}

function plusTag(tag: string): string { const d = new Date(`${tag}T12:00:00`); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
