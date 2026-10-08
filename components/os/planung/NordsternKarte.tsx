'use client';

// ─── MAKE OS — Nordstern des Haushalts (Planung › Jahr) — 08.10. abends, Fragebogen Teil 3 ─────────────────────────────
// Kevin: „Nordstern als gemeinsames Ziel von uns beiden pflegbar (Planung › Jahr).“ Die Karte liest und schreibt NUR über
// /api/planung/nordstern (Haushalt aus dem Konto, Stand/409, Business-Konten nur lesen — entschieden auf dem Server).
// Leer: Leerzustand mit Weg; Bearbeiten: Textfeld, Speichern mit dem gesehenen Stand. Bei 409 bleibt die eigene Eingabe im Feld
// und die neue Fassung steht darüber — nichts geht still verloren. Kein Konto mit Haushalt → die Karte zeigt sich nicht.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { NORDSTERN_MAX, type NordsternAntwort } from '@/lib/planung/nordstern';
import { Karte, Ueberschrift, Knopf, Hinweis, Leer, eingabe, LEUCHT } from '../ui';

type Laden = { art: 'laedt' } | { art: 'aus' } | { art: 'da'; d: NordsternAntwort };
type Meldung = { art: 'achtung' | 'kritisch'; text: string } | null;

export function NordsternKarte({ i = 0, rechts }: { i?: number; rechts?: ReactNode }) {
  const [z, setZ] = useState<Laden>({ art: 'laedt' });
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<Meldung>(null);

  const laden = useCallback(async () => {
    try {
      const r = await fetch('/api/planung/nordstern', { cache: 'no-store' });
      if (!r.ok) { setZ({ art: 'aus' }); return; }
      setZ({ art: 'da', d: (await r.json()) as NordsternAntwort });
    } catch { setZ({ art: 'aus' }); }
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  if (z.art !== 'da') return null;
  const d = z.d;

  async function speichern() {
    if (entwurf === null || z.art !== 'da') return;
    setMeldung(null);
    try {
      const r = await fetch('/api/planung/nordstern', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: entwurf, stand: d.stand }) });
      const j = (await r.json().catch(() => ({}))) as Partial<NordsternAntwort> & { error?: string; konflikt?: boolean };
      if (r.status === 409 && j.konflikt && typeof j.stand === 'string') {
        // Die neue Fassung übernehmen, die eigene Eingabe bleibt im Feld — ein zweiter Klick speichert sie auf den neuen Stand.
        setZ({ art: 'da', d: { ok: true, text: j.text ?? '', geaendertAm: j.geaendertAm ?? null, stand: j.stand, darfSchreiben: true } });
        setMeldung({ art: 'achtung', text: j.error ?? 'Inzwischen geändert — bitte prüfen und erneut speichern.' });
        return;
      }
      if (!r.ok) { setMeldung({ art: 'kritisch', text: j.error ?? `Nicht gespeichert (${r.status}).` }); return; }
      setZ({ art: 'da', d: j as NordsternAntwort });
      setEntwurf(null);
    } catch {
      setMeldung({ art: 'kritisch', text: 'Keine Verbindung — nicht gespeichert. Deine Eingabe bleibt im Feld.' });
    }
  }

  const bearbeiten = entwurf !== null;
  const zuLang = (entwurf?.length ?? 0) > NORDSTERN_MAX;

  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={rechts}>Nordstern</Ueberschrift>
      {meldung && <div style={{ marginBottom: 10 }}><Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'}>{meldung.text}</Hinweis></div>}
      {bearbeiten ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {meldung?.art === 'achtung' && d.text && (
            <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>Jetzt gespeichert: {d.text}</p>
          )}
          <textarea autoFocus value={entwurf ?? ''} onChange={e => setEntwurf(e.target.value)} rows={4} aria-label="Nordstern des Haushalts"
            placeholder="Woran richtet ihr euch über Jahre aus? Ein, zwei Sätze."
            style={{ ...eingabe, resize: 'vertical', minHeight: 110, lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Knopf haupt aus={zuLang} onClick={speichern}>Speichern</Knopf>
            <Knopf leise onClick={() => { setEntwurf(null); setMeldung(null); }}>Abbrechen</Knopf>
            <span style={{ fontSize: TYP.bedien, color: zuLang ? LEUCHT.kritisch : C.inkLeise, marginLeft: 'auto' }}>{entwurf?.length ?? 0} / {NORDSTERN_MAX}</span>
          </div>
        </div>
      ) : d.text ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{d.text}</p>
          {d.darfSchreiben && <div><Knopf leise onClick={() => setEntwurf(d.text)}>Bearbeiten</Knopf></div>}
        </div>
      ) : (
        <Leer symbol="✦" aktion={d.darfSchreiben ? <Knopf onClick={() => setEntwurf('')}>Nordstern festlegen</Knopf> : undefined}>
          Noch kein Nordstern hinterlegt — das gemeinsame Ziel, an dem sich Jahre, Ziele und ZOE ausrichten.
        </Leer>
      )}
    </Karte>
  );
}
