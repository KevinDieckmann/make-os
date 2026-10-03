'use client';

// ─── Gmail — Text einer Mail anzeigen (03.10.2026) ───────────────────────────
// Der Text ist REINER TEXT (aus HTML gewonnen, lib/gmail/html.ts) — er wird nie als HTML gerendert. Hier werden nur Web-Adressen
// anklickbar: ausschließlich http(s), immer mit `rel="noopener noreferrer nofollow"` und in neuem Tab (Zielseite bekommt weder den
// Verweis noch Zugriff auf MAKE OS). Die sichtbare Adresse IST die Adresse — kein Linktext, der etwas anderes verspricht.
// Bilder aus der Mail werden nie geladen (Tracking-Pixel); ein Hinweis nennt, wie viele es waren.

import { Fragment, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';

const URL_MUSTER = /(https?:\/\/[^\s<>"')\]]{3,500})/g;

/** Text in Stücke: Klartext und Web-Adressen (rein). */
export function stuecke(text: string): { text: string; url?: string }[] {
  const raus: { text: string; url?: string }[] = [];
  text.split(URL_MUSTER).forEach((t, i) => {
    if (!t) return;
    if (i % 2 === 1) {
      // Satzzeichen am Ende gehören nicht zur Adresse.
      const m = /^(.*?)([.,;:!?]*)$/.exec(t)!;
      try { const u = new URL(m[1]); if (u.protocol === 'http:' || u.protocol === 'https:') { raus.push({ text: m[1], url: u.toString() }); if (m[2]) raus.push({ text: m[2] }); return; } } catch { /* Klartext */ }
    }
    raus.push({ text: t });
  });
  return raus;
}

export function GmailText({ text, bilder, gekuerzt, stil }: { text: string; bilder?: number; gekuerzt?: boolean; stil?: CSSProperties }) {
  return (
    <div>
      <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, ...stil }}>
        {stuecke(text).map((s, i) => (s.url
          ? <a key={i} href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv, textDecoration: 'underline', textUnderlineOffset: 3 }}>{s.text}</a>
          : <Fragment key={i}>{s.text}</Fragment>))}
      </div>
      {(bilder || gekuerzt) ? (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8 }}>
          {bilder ? `${bilder} ${bilder === 1 ? 'Bild' : 'Bilder'} aus der Mail ${bilder === 1 ? 'wurde' : 'wurden'} nicht geladen (Schutz vor Tracking). ` : ''}
          {gekuerzt ? 'Der Text ist sehr lang und hier gekürzt — den Rest gibt es in Gmail.' : ''}
        </div>
      ) : null}
    </div>
  );
}
