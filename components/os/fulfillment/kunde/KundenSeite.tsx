'use client';

// ─── Kunden-Link — die öffentliche Seite im Browser (C2, 10.10.; FULFILLMENT_KONZEPT.md 5.4/5.5) ──────────────────────────────────────────────────
// Liest das Token NUR aus dem Fragment (`#t=…` = alles, was der Link darf; `#p=…` = nur der Puls) — es erreicht den Server nie über die Adresse,
// sondern als Kopf `x-kunde-token` bzw. `x-kunde-puls`. Lädt `/api/kunde/<kl-…>`, zeigt `KundenAnsicht` (dieselbe wie die interne Vorschau) und
// schickt Formular-Abschnitte, Uploads und den Puls mit dem signierten Stempel und dem Honigtopf. Kein Tracking, keine Speicherung im Browser.

import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Hinweis } from '../../ui';
import { KundenAnsicht, Honigtopf, type KundenAktionen, type SpeicherErgebnis } from './KundenAnsicht';
import type { KundenSicht } from '@/lib/fulfillment/kunde/sicht';

const NICHT_GUELTIG = 'Dieser Link ist nicht (mehr) gültig.';
type Zustand = { art: 'laedt' } | { art: 'ungueltig' } | { art: 'fehler'; text: string } | { art: 'da'; sicht: KundenSicht; stempel: string };

function tokenAusFragment(): { kopf: 'x-kunde-token' | 'x-kunde-puls'; token: string } | null {
  const f = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.replace(/^#/, ''));
  const t = f.get('t'), p = f.get('p');
  if (t && /^[A-Za-z0-9_-]{43}$/.test(t)) return { kopf: 'x-kunde-token', token: t };
  if (p && /^[A-Za-z0-9_-]{43}$/.test(p)) return { kopf: 'x-kunde-puls', token: p };
  return null;
}

export function KundenSeite({ linkId }: { linkId: string }) {
  const [z, setZ] = useState<Zustand>({ art: 'laedt' });
  const [falle, setFalle] = useState('');
  const basis = `/api/kunde/${linkId}`;
  const laden = useCallback(async () => {
    const t = tokenAusFragment();
    if (!t) { setZ({ art: 'ungueltig' }); return; }
    const r = await fetch(basis, { headers: { [t.kopf]: t.token }, cache: 'no-store', referrerPolicy: 'no-referrer' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.status === 404) { setZ({ art: 'ungueltig' }); return; }
    if (!r || !r.ok || !j.ok) { setZ({ art: 'fehler', text: String(j.fehler ?? 'Die Seite ließ sich gerade nicht laden — bitte später noch einmal.') }); return; }
    setZ({ art: 'da', sicht: j.sicht as KundenSicht, stempel: String(j.stempel ?? '') });
  }, [basis]);
  useEffect(() => { void laden(); }, [laden]);

  const senden = async (weg: 'formular' | 'upload' | 'puls', body: BodyInit, json: boolean): Promise<{ r: Response | null; j: Record<string, unknown> }> => {
    const t = tokenAusFragment();
    if (!t) return { r: null, j: { fehler: NICHT_GUELTIG } };
    const r = await fetch(`${basis}/${weg}`, { method: 'POST', body, referrerPolicy: 'no-referrer', headers: { [t.kopf]: t.token, ...(json ? { 'content-type': 'application/json' } : {}) } }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) as Record<string, unknown> : { fehler: 'Keine Verbindung — bitte noch einmal.' };
    if (r?.status === 404 && j.fehler === NICHT_GUELTIG) setZ({ art: 'ungueltig' });
    return { r, j };
  };
  const ergebnis = (r: Response | null, j: Record<string, unknown>): SpeicherErgebnis => (r?.ok && j.ok ? { ok: true } : { ok: false, fehler: String(j.fehler ?? 'Nicht gespeichert.'), ...(j.neuLaden ? { neuLaden: true } : {}) });

  if (z.art !== 'da') {
    return (
      <Karte>
        {z.art === 'laedt' && <div style={{ fontSize: TYP.body, color: C.inkDim }}>Wird geladen …</div>}
        {z.art === 'ungueltig' && (<>
          <h1 style={{ fontFamily: SCHRIFT.display, fontSize: 24, margin: 0, color: C.ink }}>{NICHT_GUELTIG}</h1>
          <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55, marginBottom: 0 }}>Bitte wendet euch an eure Ansprechperson — sie schickt euch bei Bedarf einen neuen Link.</p>
        </>)}
        {z.art === 'fehler' && <Hinweis art="achtung">{z.text}</Hinweis>}
      </Karte>
    );
  }
  const { stempel } = z;
  const aktionen: KundenAktionen = {
    formular: async (f, antworten, abschnitt) => {
      const { r, j } = await senden('formular', JSON.stringify({ formular: f.schluessel, antworten, stand: f.stand, ...(abschnitt ? { abschnitt: abschnitt.schluessel, fertig: abschnitt.fertig } : {}), stempel, webseite: falle }), true);
      const e = ergebnis(r, j);
      if (e.ok) {
        setZ(x => x.art !== 'da' ? x : { ...x, sicht: { ...x.sicht, formulare: x.sicht.formulare.map(g => g.schluessel !== f.schluessel ? g : {
          ...g, stand: String(j.stand ?? g.stand), prozent: typeof j.prozent === 'number' ? j.prozent : g.prozent,
          abschnitte: g.abschnitte.map(a => (abschnitt && a.schluessel === abschnitt.schluessel ? { ...a, fertig: abschnitt.fertig } : a)),
        }) } });
      }
      return e;
    },
    upload: async (datei, zweck) => {
      const fd = new FormData();
      fd.append('datei', datei); fd.append('zweck', zweck); fd.append('stempel', stempel); fd.append('webseite', falle);
      const { r, j } = await senden('upload', fd, false);
      const e = ergebnis(r, j);
      if (e.ok) setZ(x => x.art !== 'da' || !x.sicht.upload ? x : { ...x, sicht: { ...x.sicht, upload: { eingegangen: x.sicht.upload.eingegangen + 1, frei: Number(j.frei ?? 0), erlaubt: Number(j.frei ?? 0) > 0 } } });
      return e;
    },
    puls: async (wert, satz) => {
      const { r, j } = await senden('puls', JSON.stringify({ wert, satz, stempel, webseite: falle }), true);
      return ergebnis(r, j);
    },
  };
  return (
    <>
      <Honigtopf wert={falle} setWert={setFalle} />
      <KundenAnsicht sicht={z.sicht} aktionen={aktionen} />
    </>
  );
}
