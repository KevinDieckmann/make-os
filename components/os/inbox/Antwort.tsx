'use client';

// ─── Inbox 2 — Antworten (und neue Mail) schreiben, per Einzelklick senden (06.10.2026; vorher GmailAntwort) ─────────
// Formuliert wird hier (optional mit dem ZOE-Entwurf aus dem Brain); GESENDET wird nur mit dem Klick auf „Senden“ — nie von selbst,
// nie über ZOE oder den Takt. Absender: immer das Postfach des Gesprächs (Gmail: eigene Adresse oder verifizierter Alias); die
// Signatur des Postfachs steht sichtbar und änderbar unten im Text. § 7 UWG: klingt der Text werblich und fehlt für eine Person die
// Grundlage, fragt der Server zurück (409) — die Person entscheidet. Der Entwurf bleibt im Sitzungsspeicher, bis er gesendet oder
// verworfen ist. Am Handy bedienbar (Ziele ≥ 44 px, Eingaben 16 px).
// Übergabe (08.10., Lücke 6): `uebergabe` + `postfaecher` = Antwort der Empfängerin auf eine übergebene Mail — nur aus einem eigenen
// Postfach desselben Raums (der Server prüft das noch einmal), Betreff „Re: …“ und Bezug baut der Server aus der Kopie.

import { useEffect, useRef, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, eingabe, Feldzeile, auswahl, useRueckfrage } from '../ui';
import { KiMarke } from '../KiMarke';
import { senden } from './daten';
import type { Adr } from '@/lib/gmail/typen';

export interface AntwortVorgabe {
  /** Gespräch (Antwort) — oder `neu` mit Postfach-Wahl. */
  gespraech?: string;
  /** Antwort auf eine übergebene Mail (Kennung `ub-…`) — mit Postfach-Wahl (`postfaecher`), Betreff steht fest. */
  uebergabe?: string;
  betreff: string;
  empfaenger?: { antworten: { an: Adr[]; cc: Adr[] }; allen: { an: Adr[]; cc: Adr[] } };
  von: { email: string; name?: string }[];
  signatur?: string;
  hinweis?: string;
  postfach?: string;
  bereichName?: string;
  /** Neue Mail: wählbare Postfächer. */
  postfaecher?: { id: string; name: string }[];
  start?: { an?: string; text?: string; betreff?: string; zoeHinweis?: string };
}

const KEY = (id: string) => `make-inbox-entwurf-${id}`;
const lese = (id: string): string => { try { return window.sessionStorage.getItem(KEY(id)) ?? ''; } catch { return ''; } };
const schreibe = (id: string, t: string) => { try { if (t) window.sessionStorage.setItem(KEY(id), t); else window.sessionStorage.removeItem(KEY(id)); } catch { /* voll/privat */ } };
const zuListe = (t: string): Adr[] => t.split(/[,;\s]+/).map(x => x.trim().replace(/^<|>$/g, '')).filter(Boolean).map(email => ({ email }));
const zuText = (l: readonly Adr[] | undefined) => (l ?? []).map(a => a.email).join(', ');
const neueId = () => `inbox-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-')}`;

type UwgDaten = { woerter: string[]; empfaenger: { name: string; grund: string }[] };

export function Antwort({ v, allen, onGesendet, onZu, meldung }: { v: AntwortVorgabe; allen: boolean; onGesendet: () => void; onZu: () => void; meldung: (t: string) => void }) {
  const schluessel = v.gespraech ?? v.uebergabe ?? 'neu';
  const ziel = allen ? v.empfaenger?.allen : v.empfaenger?.antworten;
  const [an, setAn] = useState(v.start?.an ?? zuText(ziel?.an));
  const [cc, setCc] = useState(zuText(ziel?.cc));
  const [betreff, setBetreff] = useState(v.start?.betreff ?? v.betreff);
  const [von, setVon] = useState(v.von[0]?.email ?? '');
  const [postfach, setPostfach] = useState(v.postfaecher?.[0]?.id ?? '');
  const [text, setText] = useState(() => lese(schluessel) || v.start?.text || (v.signatur ? `\n\n-- \n${v.signatur}` : ''));
  const [hinweis, setHinweis] = useState(v.start?.zoeHinweis ?? '');
  const [schreibt, setSchreibt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const [vonKi, setVonKi] = useState(false);
  const anfrageId = useRef(neueId());
  const feld = useRef<HTMLTextAreaElement>(null);
  const { bestaetigen, dialog } = useRueckfrage();
  useEffect(() => { feld.current?.focus(); feld.current?.setSelectionRange(0, 0); }, []);
  useEffect(() => { schreibe(schluessel, text); }, [schluessel, text]);

  const entwurf = async () => {
    if (!v.gespraech) return;
    const eigenerText = text.replace(v.signatur ? `-- \n${v.signatur}` : '\u0000', '').trim();
    if (eigenerText && !(await bestaetigen({ titel: 'Text durch ZOE-Entwurf ersetzen?', text: 'Der Text im Feld wird durch den Entwurf von ZOE ersetzt.', ja: 'Ersetzen' }))) return;
    setSchreibt(true); setFehler('');
    const r = await senden<{ draft?: string; quellen?: string[] }>('/api/inbox/entwurf', { gespraech: v.gespraech, ...(hinweis.trim() ? { hinweis: hinweis.trim() } : {}) });
    setSchreibt(false);
    if (r.d.ok && r.d.draft) {
      setText(`${r.d.draft}${v.signatur ? `\n\n-- \n${v.signatur}` : ''}`); setVonKi(true);
      meldung(`ZOE-Entwurf eingefügt${r.d.quellen?.length ? ` (Brain: ${r.d.quellen.join(', ')})` : ''} — bitte lesen und anpassen; gesendet wird erst mit „Senden“.`);
    } else setFehler(r.d.fehler ?? 'ZOE konnte keinen Entwurf schreiben.');
  };

  const los = async (uwg = false): Promise<void> => {
    setLaeuft(true); setFehler('');
    const body = v.gespraech
      ? { gespraech: v.gespraech, an: zuListe(an), cc: zuListe(cc), text, ...(v.von.length > 1 ? { von } : {}), uwgBestaetigt: uwg, anfrageId: anfrageId.current }
      : v.uebergabe
        ? { uebergabe: v.uebergabe, postfach, an: zuListe(an), cc: zuListe(cc), text, uwgBestaetigt: uwg, anfrageId: anfrageId.current }
        : { neu: { postfach, betreff }, an: zuListe(an), cc: zuListe(cc), text, uwgBestaetigt: uwg, anfrageId: anfrageId.current };
    const r = await senden<{ an?: string[]; uwg?: UwgDaten }>('/api/inbox/senden', body);
    setLaeuft(false);
    if (r.d.ok) { schreibe(schluessel, ''); meldung(`Gesendet an ${(r.d.an ?? []).join(', ')}.`); onGesendet(); return; }
    if (r.status === 409 && r.d.code === 'uwg' && r.d.uwg) {
      const wer = r.d.uwg.empfaenger.map(e => `${e.name} (${e.grund})`).join('\n');
      if (await bestaetigen({ titel: 'Trotzdem senden?', text: `Der Text enthält werbliche Wörter (${r.d.uwg.woerter.join(', ')}), und für diese Person fehlt die Grundlage für Werbung (§ 7 UWG):\n\n${wer}\n\nNur senden, wenn es eine persönliche 1:1-Antwort bleibt.`, ja: 'Trotzdem senden', gefahr: true })) { anfrageId.current = neueId(); await los(true); }
      return;
    }
    setFehler(r.d.fehler ?? 'Nicht gesendet.');
  };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${C.linie}`, paddingTop: 14, display: 'grid', gap: 10 }} data-inbox="antwort">
      <div style={{ fontWeight: 700, fontSize: TYP.body }}>{v.gespraech ? (allen ? 'Allen antworten' : 'Antworten') : v.uebergabe ? `Antworten · ${v.betreff}` : 'Neue Mail'}{v.postfach ? <span style={{ color: C.inkLeise, fontWeight: 500 }}> · aus {v.postfach}{v.bereichName ? ` (${v.bereichName})` : ''}</span> : null}</div>
      {fehler && <Hinweis art="kritisch" rolle="alert" aktion={<Knopf leise onClick={() => los(false)} aus={laeuft}>Noch einmal senden</Knopf>}>{fehler}</Hinweis>}
      {v.postfaecher && (
        <Feldzeile label={v.uebergabe ? 'Aus deinem Postfach' : 'Aus Postfach'}>
          <select value={postfach} onChange={e => setPostfach(e.target.value)} style={auswahl} aria-label="Postfach">
            {v.postfaecher.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Feldzeile>
      )}
      {v.von.length > 1 && (
        <Feldzeile label="Von">
          <select value={von} onChange={e => setVon(e.target.value)} style={auswahl} aria-label="Absender">
            {v.von.map(a => <option key={a.email} value={a.email}>{a.name ? `${a.name} <${a.email}>` : a.email}</option>)}
          </select>
        </Feldzeile>
      )}
      {v.von.length === 1 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Von: <span style={{ color: C.inkDim }}>{v.von[0].name ? `${v.von[0].name} <${v.von[0].email}>` : v.von[0].email}</span></div>}
      <Feldzeile label="An"><input value={an} onChange={e => setAn(e.target.value)} style={eingabe} aria-label="An" inputMode="email" autoComplete="off" /></Feldzeile>
      {(cc || allen) && <Feldzeile label="Cc"><input value={cc} onChange={e => setCc(e.target.value)} style={eingabe} aria-label="Cc" inputMode="email" autoComplete="off" /></Feldzeile>}
      {!v.gespraech && !v.uebergabe && <Feldzeile label="Betreff"><input value={betreff} onChange={e => setBetreff(e.target.value)} style={eingabe} aria-label="Betreff" /></Feldzeile>}
      {vonKi && text.trim() && <KiMarke />}
      <textarea ref={feld} value={text} onChange={e => { setText(e.target.value); if (!e.target.value.trim()) setVonKi(false); }} rows={10} placeholder="Deine Antwort …" aria-label="Text" style={{ ...eingabe, minHeight: 200, resize: 'vertical', lineHeight: 1.55, paddingTop: 12 }} />
      {v.gespraech && (
        <details style={{ fontSize: TYP.bedien, color: C.inkLeise }} open={!!v.start?.zoeHinweis}>
          <summary style={{ cursor: 'pointer', minHeight: 32 }}>Hinweis für ZOE (optional)</summary>
          <input value={hinweis} onChange={e => setHinweis(e.target.value)} placeholder="z. B. Termin vorschlagen, höflich absagen, freundlich nachfassen" style={{ ...eingabe, marginTop: 6 }} aria-label="Hinweis für ZOE" />
        </details>
      )}
      {v.hinweis && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{v.hinweis}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Knopf haupt onClick={() => los(false)} aus={laeuft || !text.trim() || !an.trim() || (!v.gespraech && !postfach) || (!v.gespraech && !v.uebergabe && !betreff.trim())}>{laeuft ? 'sendet …' : 'Senden'}</Knopf>
        {v.gespraech && <Knopf leise onClick={entwurf} aus={schreibt || laeuft}>{schreibt ? 'ZOE schreibt …' : 'ZOE-Entwurf'}</Knopf>}
        <Knopf leise onClick={async () => { const t = text.replace(v.signatur ? `-- \n${v.signatur}` : '\u0000', '').trim(); if (!t || (await bestaetigen({ titel: 'Entwurf verwerfen?', text: 'Der geschriebene Text geht verloren.', ja: 'Verwerfen', gefahr: true }))) { schreibe(schluessel, ''); onZu(); } }} aus={laeuft}>Verwerfen</Knopf>
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Gesendet wird nur mit dem Klick auf „Senden“.</div>
      {dialog}
    </div>
  );
}
