'use client';

// ─── Inbox 2 × WhatsApp — was ein WhatsApp-Gespräch anders zeigt als eine Mail (07.10.2026 abends) ──────────────────────
// Bausteine aus components/os/whatsapp (FensterUhr, WhatsappAntwort, WaMedium, WaSymbol), eingehängt in der EINEN Inbox:
//   WaEtikett      ruhiges Etikett „WhatsApp“ (Liste, Gespräch)
//   WaKopf         Profilname + Nummer der Gegenseite und die Uhr des 24-h-Fensters (Kopf des Gesprächs)
//   WaZustell      Zustellstand einer gesendeten Nachricht (unterwegs · zugestellt · gelesen · nicht zugestellt + Grund)
//   WaAntwortInbox statt des Mail-Editors: frei schreiben nur bei offenem Fenster, sonst Vorlage mit Vorschau — Senden ist IMMER der
//                  Einzelklick in WhatsappAntwort/VorlagenWaehler; „ZOE-Entwurf“ legt nur einen Vorschlag ins Feld (KI-gekennzeichnet).
// Keine Lesebestätigung an die Person, keine Medien ohne Klick, keine Nummer in Adressen/Links.

import { useState } from 'react';
import { FARBE as C, KUGEL, TYP } from '@/lib/make-one/design';
import { nummerAnzeige, WA_STATUS_WORT, type Fenster, type WaKopfInfo } from '@/lib/whatsapp/typen';
import { Chip, Knopf, Hinweis, LEUCHT } from '../ui';
import { KiMarke } from '../KiMarke';
import { FensterUhr, WhatsappAntwort, WaSymbol, fensterJetzt } from '../whatsapp';
import { senden } from './daten';

export function WaEtikett() {
  return <Chip farbe={KUGEL.smaragd}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><WaSymbol groesse={13} />WhatsApp</span></Chip>;
}

/** Profilname (selbst gewählt, aus WhatsApp) + Nummer der Gegenseite und die Fenster-Uhr. */
export function WaKopf({ nummer, profilname, akte, fenster }: { nummer: string; profilname?: string; akte?: string; fenster: Fenster }) {
  return (
    <div data-whatsapp="kopf" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflowWrap: 'anywhere', minWidth: 0 }}>
        {profilname ? <>{profilname}{akte && akte !== profilname ? <span style={{ color: C.inkLeise }}> (Profilname)</span> : null} · </> : null}
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{nummerAnzeige(nummer)}</span>
      </span>
      <FensterUhr fenster={fenster} />
    </div>
  );
}

/** Zustellstand einer gesendeten Nachricht (nur ausgehend). */
export function WaZustell({ wa }: { wa?: WaKopfInfo }) {
  if (!wa?.status) return null;
  const kaputt = wa.status === 'fehlgeschlagen';
  return (
    <span data-whatsapp="status" style={{ color: kaputt ? LEUCHT.achtung : wa.status === 'gelesen' ? KUGEL.smaragd : C.inkLeise }}>
      {' '}· {WA_STATUS_WORT[wa.status]}{kaputt && wa.fehler ? `: ${wa.fehler}` : ''}
    </span>
  );
}

/** Antworten in einem WhatsApp-Gespräch — statt des Mail-Editors. */
export function WaAntwortInbox({ gespraech, fenster, hinweis, onGesendet, onZu, meldung }: {
  gespraech: string; fenster: Fenster; hinweis?: string; onGesendet: () => void; onZu: () => void; meldung: (t: string) => void;
}) {
  const [entwurf, setEntwurf] = useState<string | undefined>(undefined);
  const [schreibt, setSchreibt] = useState(false);
  const [fehler, setFehler] = useState('');
  const offen = fensterJetzt(fenster, Date.now()).offen;
  const zoe = async () => {
    setSchreibt(true); setFehler('');
    const r = await senden<{ draft?: string }>('/api/inbox/entwurf', { gespraech, ...(hinweis ? { hinweis } : {}) });
    setSchreibt(false);
    if (r.d.ok && r.d.draft) { setEntwurf(r.d.draft); meldung('ZOE-Entwurf im Feld — bitte lesen und anpassen; gesendet wird erst mit „Senden“.'); }
    else setFehler(String(r.d.fehler ?? 'ZOE konnte keinen Entwurf schreiben.'));
  };
  return (
    <div data-inbox="antwort" data-whatsapp="inbox-antwort" style={{ marginTop: 14, borderTop: `1px solid ${C.linie}`, paddingTop: 14, display: 'grid', gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: TYP.body, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <WaSymbol groesse={16} farbe={KUGEL.smaragd} />Antworten<span style={{ color: C.inkLeise, fontWeight: 500 }}> · über die Business-Nummer</span>
      </div>
      {entwurf && <KiMarke />}
      <WhatsappAntwort gespraech={gespraech} fenster={fenster} entwurf={entwurf} onGesendet={t => { meldung(t); onGesendet(); }} />
      {fehler && <Hinweis art="kritisch" rolle="alert">{fehler}</Hinweis>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {offen && <Knopf leise onClick={zoe} aus={schreibt}>{schreibt ? 'ZOE schreibt …' : 'ZOE-Entwurf'}</Knopf>}
        <Knopf leise onClick={onZu}>Schließen</Knopf>
      </div>
    </div>
  );
}
