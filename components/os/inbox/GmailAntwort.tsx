'use client';

// ─── Gmail — Antwort schreiben und per Einzelklick senden (03.10.2026) ───────
// Formuliert wird hier (optional mit dem Entwurf von ZOE aus dem Brain); GESENDET wird nur mit dem Klick auf „Senden“ — nie von
// selbst, nie über ZOE oder den Takt. Die Antwort steht im Thread (Server: In-Reply-To/References/Re:). Absender: die eigene
// Adresse oder ein „Senden als“-Alias aus Gmail. § 7 UWG: klingt der Text werblich und fehlt für eine Person die Grundlage, fragt
// der Server vor dem Senden zurück (409) — die Person entscheidet. Der Entwurf bleibt im Sitzungsspeicher, bis er gesendet oder
// verworfen ist (nur dieser Tab; kein Text auf der Platte des Browsers).
// Am Handy bedienbar: Tasten ≥ 44 px, Eingaben 16 px.

import { useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, LEUCHT } from '../schlank';
import type { Adr, GmailAlias } from '@/lib/gmail/typen';

export interface AntwortDaten {
  antwortAuf: string;
  betreff: string;
  empfaenger: { antworten: { an: Adr[]; cc: Adr[] }; allen: { an: Adr[]; cc: Adr[] } };
  aliase: GmailAlias[];
  eigene: string;
}

const KEY = (id: string) => `make-gmail-entwurf-${id}`;
const lese = (id: string): string => { try { return window.sessionStorage.getItem(KEY(id)) ?? ''; } catch { return ''; } };
const schreibe = (id: string, t: string) => { try { if (t) window.sessionStorage.setItem(KEY(id), t); else window.sessionStorage.removeItem(KEY(id)); } catch { /* voll/privat */ } };
const zuListe = (t: string): Adr[] => t.split(/[,;\s]+/).map(x => x.trim().replace(/^<|>$/g, '')).filter(Boolean).map(email => ({ email }));
const zuText = (l: readonly Adr[]) => l.map(a => a.email).join(', ');
const neueId = () => `gmail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const eingabe = { width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 12px', color: C.ink, fontFamily: SCHRIFT.text, fontSize: 16, minHeight: 44 } as const;

export function GmailAntwort({ d, allen, onGesendet, onZu, meldung }: { d: AntwortDaten; allen: boolean; onGesendet: () => void; onZu: () => void; meldung: (t: string) => void }) {
  const ziel = allen ? d.empfaenger.allen : d.empfaenger.antworten;
  const [an, setAn] = useState(zuText(ziel.an));
  const [cc, setCc] = useState(zuText(ziel.cc));
  const [von, setVon] = useState(() => d.aliase.find(a => a.standard)?.email ?? d.eigene);
  const [text, setText] = useState(() => lese(d.antwortAuf));
  const [hinweis, setHinweis] = useState('');
  const [schreibt, setSchreibt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const anfrageId = useRef(neueId());
  const feld = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { feld.current?.focus(); }, []);
  useEffect(() => { schreibe(d.antwortAuf, text); }, [d.antwortAuf, text]);
  const absender = useMemo(() => { const l = d.aliase.length ? d.aliase : [{ email: d.eigene, verifiziert: true } as GmailAlias]; return l.some(a => a.email === d.eigene) ? l : [{ email: d.eigene, verifiziert: true } as GmailAlias, ...l]; }, [d.aliase, d.eigene]);

  const entwurf = async () => {
    if (text.trim() && !window.confirm('Den Text im Feld durch den Entwurf von ZOE ersetzen?')) return;
    setSchreibt(true); setFehler('');
    const r = await fetch('/api/gmail/entwurf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.antwortAuf, ...(hinweis.trim() ? { hinweis: hinweis.trim() } : {}) }) })
      .then(async x => ({ status: x.status, d: await x.json().catch(() => ({})) as { ok?: boolean; draft?: string; fehler?: string; quellen?: string[] } })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung.' } as { ok?: boolean; draft?: string; fehler?: string; quellen?: string[] } }));
    setSchreibt(false);
    if (r.d.ok && r.d.draft) { setText(r.d.draft); meldung(`ZOE-Entwurf eingefügt${r.d.quellen?.length ? ` (Brain: ${r.d.quellen.join(', ')})` : ''} — bitte lesen und anpassen; gesendet wird erst mit „Senden“.`); }
    else setFehler(r.d.fehler ?? 'ZOE konnte keinen Entwurf schreiben.');
  };

  const senden = async (uwg = false): Promise<void> => {
    setLaeuft(true); setFehler('');
    const r = await fetch('/api/gmail/senden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ausNachricht: d.antwortAuf, an: zuListe(an), cc: zuListe(cc), text, von, uwgBestaetigt: uwg, anfrageId: anfrageId.current }) })
      .then(async x => ({ status: x.status, d: await x.json().catch(() => ({})) as { ok?: boolean; code?: string; fehler?: string; an?: string[]; uwg?: { woerter: string[]; empfaenger: { name: string; grund: string }[] } } })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung — nichts gesendet.' } as { ok?: boolean; code?: string; fehler?: string; an?: string[]; uwg?: { woerter: string[]; empfaenger: { name: string; grund: string }[] } } }));
    setLaeuft(false);
    if (r.d.ok) { schreibe(d.antwortAuf, ''); meldung(`Gesendet an ${(r.d.an ?? []).join(', ')}.`); onGesendet(); return; }
    if (r.status === 409 && r.d.code === 'uwg' && r.d.uwg) {
      const wer = r.d.uwg.empfaenger.map(e => `${e.name} (${e.grund})`).join('\n');
      if (window.confirm(`Der Text enthält werbliche Wörter (${r.d.uwg.woerter.join(', ')}), und für diese Person fehlt die Grundlage für Werbung (§ 7 UWG):\n\n${wer}\n\nNur senden, wenn es eine persönliche 1:1-Antwort bleibt. Trotzdem senden?`)) { await senden(true); return; }
      return;
    }
    setFehler(r.d.fehler ?? 'Nicht gesendet.');
  };

  const label = { fontSize: 12, color: C.inkLeise, marginBottom: 4, display: 'block' } as const;
  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.linie}`, paddingTop: 12, display: 'grid', gap: 10 }} data-gmail="antwort">
      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{allen ? 'Allen antworten' : 'Antworten'} · <span style={{ color: C.inkLeise, fontWeight: 500 }}>{d.betreff}</span></div>
      {fehler && <div role="alert" style={{ fontSize: 13, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 9, padding: '8px 10px' }}>{fehler}</div>}
      <label><span style={label}>Von</span>
        <select value={von} onChange={e => setVon(e.target.value)} style={{ ...eingabe, appearance: 'auto' }} aria-label="Absender">
          {absender.map(a => <option key={a.email} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
        </select>
      </label>
      <label><span style={label}>An</span><input value={an} onChange={e => setAn(e.target.value)} style={eingabe} aria-label="An" inputMode="email" autoComplete="off" /></label>
      {(cc || allen) && <label><span style={label}>Cc</span><input value={cc} onChange={e => setCc(e.target.value)} style={eingabe} aria-label="Cc" inputMode="email" autoComplete="off" /></label>}
      <textarea ref={feld} value={text} onChange={e => setText(e.target.value)} rows={9} placeholder="Deine Antwort …" aria-label="Antwort" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.55 }} />
      <details style={{ fontSize: 13, color: C.inkLeise }}>
        <summary style={{ cursor: 'pointer', minHeight: 32 }}>Hinweis für ZOE (optional)</summary>
        <input value={hinweis} onChange={e => setHinweis(e.target.value)} placeholder="z. B. Termin vorschlagen, höflich absagen, Preis nicht nennen" style={{ ...eingabe, marginTop: 6 }} aria-label="Hinweis für ZOE" />
      </details>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf onClick={() => senden(false)} aus={laeuft || !text.trim() || !an.trim()}>{laeuft ? 'sendet …' : 'Senden'}</Knopf>
        <Knopf leise onClick={entwurf} aus={schreibt || laeuft}>{schreibt ? 'ZOE schreibt …' : 'ZOE-Entwurf'}</Knopf>
        <Knopf leise onClick={() => { if (!text.trim() || window.confirm('Entwurf verwerfen?')) { schreibe(d.antwortAuf, ''); onZu(); } }} aus={laeuft}>Verwerfen</Knopf>
        <span style={{ fontSize: 12, color: C.inkLeise }}>Gesendet wird nur mit dem Klick auf „Senden“.</span>
      </div>
    </div>
  );
}
