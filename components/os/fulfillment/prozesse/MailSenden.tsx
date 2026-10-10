'use client';

// ─── Fulfillment · Prozesse — eine Mail per Klick senden (Willkommen, Wirkungsbericht) (Paket C1, 10.10.) ─────────────────────────────
// Derselbe Weg wie der Fortschritts-Report: Postfach des Business-Bereichs wählen, Empfänger/Betreff/Text prüfen und ändern, optional ein
// Anhang aus der Dateiablage am Mandat — gesendet wird NUR mit „Senden“ über POST /api/inbox/senden (Art. 18 und § 7 UWG mit Rückfrage wie
// dort, `anfrageId` gegen Doppelsenden). MAKE OS verschickt nie etwas ohne diesen Klick.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT } from '@/lib/make-one/design';
import { Knopf, Hinweis, feld, useRueckfrage } from '../../ui';
import { Fenster } from '../../Fenster';
import { Wahl } from '../../crm/Wahl';
import { WEG } from '@/lib/wege';
import { neueAnfrageId } from './daten';
import { beschriftung, klein } from './teile';

interface Postfach { id: string; anzeigename?: string; adresse?: string; bereich?: string | null; bereichName?: string }
export interface MailEntwurf { betreff: string; text: string; an: { email: string; name?: string } | null; gesellschaft: string; anhang?: { id: string; name: string } }

export function MailSenden({ titel, entwurf, hinweis, onZu, onGesendet }: { titel: string; entwurf: MailEntwurf; hinweis?: string; onZu: () => void; onGesendet: () => Promise<void> | void }) {
  const { bestaetigen, dialog } = useRueckfrage();
  const [postfaecher, setPostfaecher] = useState<Postfach[] | null>(null);
  const [postfach, setPostfach] = useState<string | null>(null);
  const [an, setAn] = useState(entwurf.an?.email ?? '');
  const [betreff, setBetreff] = useState(entwurf.betreff);
  const [text, setText] = useState(entwurf.text);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  const anfrageId = useRef(neueAnfrageId());
  useEffect(() => {
    fetch('/api/inbox/postfaecher?space=business', { cache: 'no-store' }).then(r => r.json()).then((j: { postfaecher?: Postfach[] }) => {
      const l = Array.isArray(j.postfaecher) ? j.postfaecher : [];
      setPostfaecher(l);
      const p = l.find(x => x.bereich === entwurf.gesellschaft) ?? l[0];
      if (p) setPostfach(p.id);
    }).catch(() => setPostfaecher([]));
  }, [entwurf.gesellschaft]);
  const los = async (uwg = false): Promise<void> => {
    if (!postfach) { setFehler('Bitte ein Postfach des Business-Bereichs wählen (Inbox › Postfächer).'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(an.trim())) { setFehler('Bitte eine gültige Empfänger-Adresse.'); return; }
    const r = await fetch('/api/inbox/senden', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      neu: { postfach, betreff }, an: [{ email: an.trim(), ...(entwurf.an?.email === an.trim() && entwurf.an.name ? { name: entwurf.an.name } : {}) }], text,
      ...(entwurf.anhang ? { anhaenge: [{ datei: entwurf.anhang.id }] } : {}), uwgBestaetigt: uwg, anfrageId: anfrageId.current,
    }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.status === 409 && j.code === 'uwg' && j.uwg) {
      const wer = (j.uwg.empfaenger as { name: string; grund: string }[]).map(x => `${x.name} (${x.grund})`).join('\n');
      if (await bestaetigen({ titel: 'Trotzdem senden?', text: `Der Text enthält werbliche Wörter (${(j.uwg.woerter as string[]).join(', ')}), und für diese Person fehlt die Grundlage für Werbung (§ 7 UWG):\n\n${wer}\n\nNur senden, wenn es eine persönliche 1:1-Mail bleibt.`, ja: 'Trotzdem senden', gefahr: true })) { anfrageId.current = neueAnfrageId(); await los(true); }
      return;
    }
    if (!r || !r.ok || j.ok === false) { setFehler(String(j.fehler ?? j.error ?? 'Nicht gesendet.')); anfrageId.current = neueAnfrageId(); return; }
    setFertig(true);
    await onGesendet();
  };
  return (
    <Fenster titel={titel} onZu={onZu} breit={680}>
      {fertig ? <Hinweis art="gut">Gesendet — die Mail steht in der Inbox unter „Gesendet“.</Hinweis> : (
        <form onSubmit={e => { e.preventDefault(); void los(false); }} style={{ display: 'grid', gap: 10 }}>
          {fehler && <Hinweis art="achtung">{fehler}</Hinweis>}
          {hinweis && <Hinweis art="info">{hinweis}</Hinweis>}
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Von (Postfach)</span>
            {postfaecher && !postfaecher.length ? <span style={klein}>Kein Postfach im Business-Bereich — unter <Link href={WEG.inbox()} style={{ color: C.aktiv }}>Inbox</Link> ein Postfach verbinden und dem Business zuordnen.</span>
              : <Wahl label="Postfach" liste={(postfaecher ?? []).map(p => ({ id: p.id, label: `${p.anzeigename ?? p.adresse ?? p.id}${p.bereichName ? ` · ${p.bereichName}` : ''}` }))} wert={postfach} onWahl={setPostfach} />}
          </label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>An</span><input value={an} type="email" onChange={x => setAn(x.target.value)} style={{ ...feld, fontSize: 16 }} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Betreff</span><input value={betreff} onChange={x => setBetreff(x.target.value)} style={{ ...feld, fontSize: 16 }} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={beschriftung}>Text</span><textarea value={text} rows={12} onChange={x => setText(x.target.value)} style={{ ...feld, fontSize: 16, fontFamily: SCHRIFT.text }} /></label>
          {entwurf.anhang && <div style={klein}>Anhang: {entwurf.anhang.name}</div>}
          <div style={klein}>Gesendet wird erst mit „Senden“ — aus dem gewählten Postfach, wie jede Mail der Inbox.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
            <Knopf haupt typ="submit" aus={!postfach || !an.trim() || !betreff.trim() || !text.trim()}>Senden</Knopf>
          </div>
        </form>
      )}
      {dialog}
    </Fenster>
  );
}
