'use client';

// ─── Angebots-Tool · Vorschau: ansehen, PDF, stellen (28.09.; 26.10. umgebaut) ──
// Kevin: „Mail-Entwurf klein und Angebot groß gleichzeitig — beides ansehen oder
// zurück; ‚Senden‘ versendet.“ Links klein die Mail (An, Betreff, Text — editierbar),
// rechts groß das Angebot im Layout des PDFs. Senden (noch kein Server-Versand):
// Angebot wird gestellt (Nummer, festgeschrieben), PDF entsteht auf dem Server und
// liegt verschlüsselt in der Ablage, der Browser lädt es herunter und öffnet das
// Mail-Programm — „PDF anhängen und abschicken“. Vorher die Kanal-Ampel: rot durch
// Werbesperre/Einschränkung sperrt mit Grund, gelb ist ein Hinweis.
// 26.10. (Kevin: „anzeigen und runterladen“ · „E-Mail vorbereitet bei Google Mail“): „Entwurf als PDF“ lädt den Entwurf (ohne Nummer, nichts
// gespeichert); „Angebot stellen & PDF laden“ stellt — und legt, wenn angehakt, die Mail mit dem PDF als ENTWURF ins eigene Gmail. Das Mail-Programm
// öffnet sich nicht mehr von selbst; gesendet wird in Gmail.

import Link from 'next/link';
import { useState } from 'react';
import { FARBE as C, TYP, LEUCHT } from '@/lib/make-one/design';
import { Karte, Knopf, feld, useBreit } from '../../ui';
import { Blatt } from './Blatt';
import type { AngebotDokument } from '@/lib/crm/angebot-dokument';

export const NUMMER_PLATZHALTER = '{Nummer}';

export interface MailEntwurf { an: string; betreff: string; text: string }

/** Den gespeicherten Entwurf als PDF holen und herunterladen (POST /api/crm/angebot `entwurf-pdf`) — Fehler als Text. */
async function entwurfPdfLaden(id: string): Promise<string | null> {
  try {
    const r = await fetch('/api/crm/angebot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'entwurf-pdf', id }) });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('application/pdf')) { const d = await r.json().catch(() => null) as { fehler?: string } | null; return d?.fehler ?? `PDF nicht erstellt (${r.status}).`; }
    const name = decodeURIComponent((r.headers.get('content-disposition') ?? '').match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? 'Angebot-Entwurf.pdf');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return null;
  } catch { return 'Keine Verbindung — PDF nicht geladen.'; }
}

export function Vorschau({ dok, logoUrl, mail, setMail, ampel, luecken, absenderWeg, nachfassen, setNachfassen, onZurueck, onSenden, meldung, nurEntwurf, angebotId, gmailEntwurf, setGmailEntwurf, luecken2 = [] }: {
  dok: AngebotDokument; logoUrl?: string | null; mail: MailEntwurf; setMail: (m: MailEntwurf) => void;
  ampel: { sperre?: string; hinweise: string[] }; luecken: string[]; /** Unternehmen › Gesellschaft › Absender (08.10.) — dort werden die Lücken ergänzt. */ absenderWeg?: string | null; nachfassen: string; setNachfassen: (t: string) => void;
  onZurueck: () => void; onSenden: () => Promise<void>; meldung?: string | null;
  /** Rolle „nur Business“ (13.10.): statt „Senden“ dieser Hinweis — gestellt wird nur durch Inhaber oder volle Mitglieder (Server: 403). */
  nurEntwurf?: string | null;
  /** Kennung des gespeicherten Entwurfs — für „Entwurf als PDF“ (26.10.). */
  angebotId?: string;
  /** Mail mit PDF nach dem Stellen als Entwurf ins eigene Gmail (26.10.). */
  gmailEntwurf?: boolean; setGmailEntwurf?: (an: boolean) => void;
  /** Stellen mit „[von Hand: …]“ bzw. Platzhaltern im Text (26.10.) — nur Hinweis. */
  luecken2?: string[];
}) {
  const [pdfMeldung, setPdfMeldung] = useState<string | null>(null);
  const breit = useBreit();
  const absenderFehlt = luecken.includes('Firmierung') || luecken.includes('Anschrift');
  const gesperrt = !!ampel.sperre || absenderFehlt;
  const f = { ...feld, fontSize: TYP.bedien, padding: '8px 11px' } as const;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: breit ? 'minmax(300px, 380px) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 16, alignItems: 'start', minWidth: 0 }}>
      <div style={{ display: 'grid', gap: 12, position: breit ? 'sticky' : undefined, top: 12 }}>
        <Karte i={0}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkDim, marginBottom: 10 }}>Mail-Entwurf</div>
          <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>An</span>
            <input value={mail.an} onChange={e => setMail({ ...mail, an: e.target.value })} placeholder="E-Mail-Adresse" aria-label="An" style={f} /></label>
          <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Betreff</span>
            <input value={mail.betreff} onChange={e => setMail({ ...mail, betreff: e.target.value })} aria-label="Betreff" style={f} /></label>
          <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Text</span>
            <textarea value={mail.text} onChange={e => setMail({ ...mail, text: e.target.value })} rows={11} aria-label="Mailtext" style={{ ...f, lineHeight: 1.5, resize: 'vertical' }} /></label>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>{NUMMER_PLATZHALTER} wird beim Stellen durch die Angebotsnummer ersetzt.</div>
          {!nurEntwurf && setGmailEntwurf && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!gmailEntwurf} onChange={e => setGmailEntwurf(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
              <span>Mail mit PDF als <b style={{ color: C.ink }}>Entwurf in mein Gmail</b> legen — dort prüfen und senden.</span>
            </label>
          )}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: TYP.bedien, color: C.inkDim, flexWrap: 'wrap' }}>
            Nachfassen am <input type="date" value={nachfassen} onChange={e => setNachfassen(e.target.value)} aria-label="Nachfassen am" style={{ ...f, width: 160 }} />
          </label>
        </Karte>
        {(ampel.sperre || ampel.hinweise.length > 0 || luecken.length > 0 || luecken2.length > 0) && (
          <Karte i={1} akzent={gesperrt ? LEUCHT.kritisch : LEUCHT.achtung}>
            <div style={{ display: 'grid', gap: 6, fontSize: TYP.bedien, lineHeight: 1.5 }}>
              {ampel.sperre && <div style={{ color: LEUCHT.kritisch, fontWeight: 700 }}>Gesperrt: {ampel.sperre} — an diese Person geht kein Angebot hinaus.</div>}
              {absenderFehlt && <div style={{ color: LEUCHT.kritisch }}>Absender unvollständig: {luecken.filter(x => x === 'Firmierung' || x === 'Anschrift').join(', ')} — {absenderWeg ? <Link href={absenderWeg} style={{ color: LEUCHT.kritisch, fontWeight: 700 }}>unter Unternehmen › Absender ergänzen ›</Link> : 'unter Unternehmen › Absender ergänzen.'}</div>}
              {ampel.hinweise.map((h, i) => <div key={i} style={{ color: LEUCHT.achtung }}>{h}</div>)}
              {luecken2.length > 0 && <div style={{ color: LEUCHT.achtung }}>Noch Lücken im Text ({luecken2.join(', ')}): „[von Hand: …]“ bzw. ein Platzhalter steht noch drin — zurück und ausfüllen oder den Standardtext nehmen.</div>}
              {luecken.filter(x => x !== 'Firmierung' && x !== 'Anschrift').length > 0 && <div style={{ color: C.inkDim }}>Absender: es fehlt {luecken.filter(x => x !== 'Firmierung' && x !== 'Anschrift').join(', ')}.</div>}
            </div>
          </Karte>
        )}
        {meldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{meldung}</div>}
        {pdfMeldung && <div style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch }}>{pdfMeldung}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Knopf leise onClick={onZurueck}>‹ Zurück</Knopf>
          {angebotId && <Knopf leise onClick={async () => { setPdfMeldung(await entwurfPdfLaden(angebotId)); }}>Entwurf als PDF</Knopf>}
          {!nurEntwurf && <Knopf farbe={LEUCHT.gut} aus={gesperrt} onClick={onSenden}>Angebot stellen &amp; PDF laden</Knopf>}
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, lineHeight: 1.5 }}>{nurEntwurf ?? 'Die IBAN ist hier nur gekürzt zu sehen — im PDF steht sie vollständig. „Entwurf als PDF“ zum Ansehen — ohne Nummer, nichts wird gespeichert. „Angebot stellen“ vergibt die Nummer und schreibt das Angebot fest (Änderungen nur als neue Version); Deal, Follow-up und Verlauf ziehen mit.'}</div>
      </div>
      <Blatt d={dok} logoUrl={logoUrl} />
    </div>
  );
}
