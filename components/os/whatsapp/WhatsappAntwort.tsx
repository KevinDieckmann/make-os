'use client';

// ─── WhatsApp — Antworten in einem Gespräch (07.10.2026) ────────────────────────────────────────────────────────────────
// Zum Einhängen in der Inbox statt des Mail-Editors, wenn `gespraech.quelle === 'whatsapp'`:
//   <WhatsappAntwort gespraech={g.id} fenster={g.whatsapp!.fenster} entwurf={zoeText} onGesendet={() => neuLaden()} />
// Fenster offen → Textfeld + „Senden“ (Einzelklick; die Vorlage bleibt als Wahl). Fenster zu → nur der Vorlagen-Wähler.
// Ein ZOE-Entwurf (`entwurf`) steht nur VORGESCHLAGEN im Feld — gesendet wird erst, wenn die Person klickt. Text bleibt bei Fehler stehen.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Knopf, Hinweis, Segmente, eingabe } from '../ui';
import { WA_GRENZEN, type Fenster } from '@/lib/whatsapp/typen';
import { FensterUhr, fensterJetzt } from './FensterUhr';
import { VorlagenWaehler } from './VorlagenWaehler';

const neueId = () => `wa-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function WhatsappAntwort({ gespraech, fenster, entwurf, onGesendet }: { gespraech: string; fenster: Fenster; entwurf?: string; onGesendet?: (text: string) => void }) {
  const offen = fensterJetzt(fenster, Date.now()).offen;
  const [art, setArt] = useState<'frei' | 'vorlage'>(offen ? 'frei' : 'vorlage');
  const [text, setText] = useState(entwurf ?? '');
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);
  const [id, setId] = useState(neueId);
  useEffect(() => { if (entwurf) setText(entwurf); }, [entwurf]);
  useEffect(() => { if (!offen) setArt('vorlage'); }, [offen]);

  const senden = async () => {
    if (!text.trim() || laeuft) return;
    setLaeuft(true); setMeldung(null);
    const r = await fetch('/api/whatsapp/senden', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gespraech, art: 'frei', text, anfrageId: id }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) as { ok?: boolean; text?: string; fehler?: string; art?: string } : { fehler: 'Keine Verbindung zu MAKE OS — nichts gesendet.' };
    setLaeuft(false);
    if (d.ok) { setText(''); setId(neueId()); setMeldung({ art: 'gut', text: d.text ?? 'Gesendet.' }); onGesendet?.(d.text ?? 'Gesendet.'); return; }
    if (d.art === 'fenster') setArt('vorlage');
    setMeldung({ art: 'kritisch', text: d.fehler ?? 'Nicht gesendet — der Text bleibt stehen.' });
  };

  return (
    <div data-whatsapp="antwort" style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <FensterUhr fenster={fenster} />
        {offen && <Segmente liste={[{ id: 'frei', label: 'Nachricht' }, { id: 'vorlage', label: 'Vorlage' }]} aktiv={art} onWahl={setArt} />}
      </div>
      {art === 'frei' && offen ? (
        <>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={WA_GRENZEN.text} aria-label="WhatsApp-Nachricht" placeholder="Antwort schreiben …" style={{ ...eingabe, minHeight: 110, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knopf onClick={senden} aus={!text.trim() || laeuft} ton="gut">{laeuft ? 'Sendet …' : 'Senden'}</Knopf>
            <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{text.length}/{WA_GRENZEN.text} · geht über die Business-Nummer, nur auf Klick</span>
          </div>
        </>
      ) : (
        <VorlagenWaehler gespraech={gespraech} onGesendet={t => { setMeldung({ art: 'gut', text: t }); onGesendet?.(t); }} {...(offen ? { onAbbrechen: () => setArt('frei') } : {})} />
      )}
      {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'}>{meldung.text}</Hinweis>}
    </div>
  );
}
