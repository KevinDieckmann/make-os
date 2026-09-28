'use client';

// ─── Angebots-Tool · „Mail versenden“: Vorschau (28.09.) ─────────────────────
// Kevin: „Mail-Entwurf klein und Angebot groß gleichzeitig — beides ansehen oder
// zurück; ‚Senden‘ versendet.“ Links klein die Mail (An, Betreff, Text — editierbar),
// rechts groß das Angebot im Layout des PDFs. Senden (noch kein Server-Versand):
// Angebot wird gestellt (Nummer, festgeschrieben), PDF entsteht auf dem Server und
// liegt verschlüsselt in der Ablage, der Browser lädt es herunter und öffnet das
// Mail-Programm — „PDF anhängen und abschicken“. Vorher die Kanal-Ampel: rot durch
// Werbesperre/Einschränkung sperrt mit Grund, gelb ist ein Hinweis.

import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Knopf, feld, useBreit } from '../../schlank';
import { Blatt } from './Blatt';
import type { AngebotDokument } from '@/lib/crm/angebot-dokument';

export const NUMMER_PLATZHALTER = '{Nummer}';

export interface MailEntwurf { an: string; betreff: string; text: string }

export function Vorschau({ dok, logoUrl, mail, setMail, ampel, luecken, nachfassen, setNachfassen, onZurueck, onSenden, meldung }: {
  dok: AngebotDokument; logoUrl?: string | null; mail: MailEntwurf; setMail: (m: MailEntwurf) => void;
  ampel: { sperre?: string; hinweise: string[] }; luecken: string[]; nachfassen: string; setNachfassen: (t: string) => void;
  onZurueck: () => void; onSenden: () => Promise<void>; meldung?: string | null;
}) {
  const breit = useBreit();
  const absenderFehlt = luecken.includes('Firmierung') || luecken.includes('Anschrift');
  const gesperrt = !!ampel.sperre || absenderFehlt;
  const f = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' } as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: breit ? 'minmax(300px, 380px) minmax(0, 1fr)' : '1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 12, position: breit ? 'sticky' : undefined, top: 12 }}>
        <Karte i={0}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, marginBottom: 10 }}>Mail-Entwurf</div>
          <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span style={{ fontSize: 12, color: C.inkLeise }}>An</span>
            <input value={mail.an} onChange={e => setMail({ ...mail, an: e.target.value })} placeholder="E-Mail-Adresse" aria-label="An" style={f} /></label>
          <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span style={{ fontSize: 12, color: C.inkLeise }}>Betreff</span>
            <input value={mail.betreff} onChange={e => setMail({ ...mail, betreff: e.target.value })} aria-label="Betreff" style={f} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12, color: C.inkLeise }}>Text</span>
            <textarea value={mail.text} onChange={e => setMail({ ...mail, text: e.target.value })} rows={11} aria-label="Mailtext" style={{ ...f, lineHeight: 1.5, resize: 'vertical' }} /></label>
          <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>{NUMMER_PLATZHALTER} wird beim Senden durch die Angebotsnummer ersetzt. Das Mail-Programm öffnet sich — <b style={{ color: C.inkDim }}>PDF anhängen und abschicken</b>.</div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: TYP.bedien, color: C.inkDim, flexWrap: 'wrap' }}>
            Nachfassen am <input type="date" value={nachfassen} onChange={e => setNachfassen(e.target.value)} aria-label="Nachfassen am" style={{ ...f, width: 160 }} />
          </label>
        </Karte>
        {(ampel.sperre || ampel.hinweise.length > 0 || luecken.length > 0) && (
          <Karte i={1} akzent={gesperrt ? LEUCHT.kritisch : LEUCHT.achtung}>
            <div style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, lineHeight: 1.5 }}>
              {ampel.sperre && <div style={{ color: LEUCHT.kritisch, fontWeight: 700 }}>Gesperrt: {ampel.sperre} — an diese Person geht kein Angebot hinaus.</div>}
              {absenderFehlt && <div style={{ color: LEUCHT.kritisch }}>Absender unvollständig: {luecken.filter(x => x === 'Firmierung' || x === 'Anschrift').join(', ')} — Stammdaten › Gesellschaften.</div>}
              {ampel.hinweise.map((h, i) => <div key={i} style={{ color: LEUCHT.achtung }}>{h}</div>)}
              {luecken.filter(x => x !== 'Firmierung' && x !== 'Anschrift').length > 0 && <div style={{ color: C.inkDim }}>Absender: es fehlt {luecken.filter(x => x !== 'Firmierung' && x !== 'Anschrift').join(', ')}.</div>}
            </div>
          </Karte>
        )}
        {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZurueck}>‹ Zurück</Knopf>
          <Knopf farbe={LEUCHT.gut} aus={gesperrt} onClick={onSenden}>Senden</Knopf>
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>Senden stellt das Angebot: es bekommt seine Nummer und ist danach festgeschrieben (Änderungen nur als neue Version). Deal, Follow-up und Verlauf ziehen mit.</div>
      </div>
      <Blatt d={dok} logoUrl={logoUrl} />
    </div>
  );
}
