'use client';

// ─── Fulfillment · Analyse — Tiefenbericht „nur für dich“ (C3, 10.10.; FULFILLMENT_KONZEPT.md 4.7) ───────────────────────────────────────────
// Ein eigener Lauf mit eigener Schätzung, einzeln bestätigt. Das Ergebnis zeigt NUR der Person, die ihn ausgelöst hat — über die eigene Route
// (/api/fulfillment/dossier/leseteil), mit den Suchvorschlägen des Dienstes in einem abgeschotteten iframe (`sandbox=""`: keine Skripte, keine
// Formulare, kein Zugriff auf diese Seite) und den Quellen. Es fließt nie in das Dossier, an Agenten, Brain oder Suche. Ist der Dienst in der Instanz
// aus, steht das ehrlich da — eingeschaltet wird nichts.

import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { euroText } from '@/lib/ki/kosten';
import { Karte, Ueberschrift, Knopf, Hinweis, Leer, Feldzeile, eingabe, useRueckfrage } from '../../ui';
import { senden, fehlerVon, anfrageId, type AnalyseApi } from './daten';
import { useOhneKuerzel } from '../prozesse/daten';

type Rueck = ReturnType<typeof useRueckfrage>;
interface Leseteil { status: 'laeuft' | 'fertig' | 'fehler' | 'abgelaufen'; frage: string; gestartet: string; text?: string; suchvorschlaegeHtml?: string; quellen?: { url: string; titel?: string }[]; suchbegriffe?: string[]; fehler?: string; restTage?: number }
const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 } as const;

export function Tiefenbericht({ mandatId, api, rueck }: { mandatId: string; api: AnalyseApi; rueck: Rueck }) {
  const lage = api.lage;
  const d = api.dossier!.dossier!;
  const tb = lage?.agenten.find(a => a.id === 'tb');
  const [frage, setFrage] = useState(lage?.tiefenbericht.frage ?? api.dossier?.tiefenberichtFrage ?? '');
  const kuerzel = useOhneKuerzel(mandatId);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [leseteil, setLeseteil] = useState<Leseteil | null>(null);
  const eigen = !!d.leseteil?.eigen;
  useEffect(() => {
    if (!eigen) return;
    void fetch(`/api/fulfillment/dossier/leseteil?m=${encodeURIComponent(mandatId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.ok) setLeseteil(j.leseteil as Leseteil); }).catch(() => undefined);
  }, [eigen, mandatId]);
  const starten = async (cent: number) => {
    const ok = await rueck.bestaetigen({
      titel: 'Tiefenbericht starten?',
      text: `Kosten ${euroText(cent, true)} (geschätzt). Die Frage geht an Google Vertex; der Bericht ist eine Lesehilfe nur für dich, 30 Tage, und fließt nie in das Dossier oder an Agenten.`,
      ja: 'Starten',
    });
    if (!ok) return;
    const r = await senden('/api/fulfillment/analyse', { aktion: 'tiefenbericht', mandatId, frage, bestaetigtCent: cent, anfrageId: anfrageId() });
    if (r.status === 409 && r.j.kostenRueckfrage && r.j.schaetzung) return starten(Math.ceil((r.j.schaetzung as { euroCent: number }).euroCent));
    setMeldung(fehlerVon(r) ?? 'Gestartet — der Bericht braucht oft mehrere Minuten bis zu einer Stunde.');
    await api.laden();
  };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Karte>
        <Ueberschrift erklaerung="fulfillment.tiefenbericht">Tiefenbericht — nur für dich</Ueberschrift>
        {lage && !lage.ki.tiefenbericht && <Hinweis art="achtung" aktion={<Knopf leise href={WEG.datenschutz('ki')}>Zu den KI-Schaltern</Knopf>}>{lage.kiSaetze.tiefenbericht}</Hinweis>}
        {meldung && <Hinweis art="info">{meldung}</Hinweis>}
        {d.leseteil && !eigen && <Hinweis art="info">Es gibt einen Tiefenbericht (gestartet {d.leseteil.gestartetAm.slice(0, 10)}) — nur für die auslösende Person.</Hinweis>}
        <form onSubmit={e => { e.preventDefault(); if (tb) void starten(tb.schaetzung.cent); }} style={{ display: 'grid', gap: 8 }}>
          <Feldzeile label="Frage (höchstens 2.000 Zeichen)"><textarea style={{ ...eingabe, minHeight: 96 }} maxLength={2000} value={frage} onChange={e => setFrage(e.target.value)} required /></Feldzeile>
          <div style={klein}>{tb ? `${tb.schaetzung.text} je Bericht.` : ''} {tb?.gruende.length ? kuerzel(tb.gruende.join(' ')) : ''}</div>
          <div><Knopf typ="submit" aus={!tb || tb.zustand !== 'bereit'}>Tiefenbericht starten</Knopf></div>
        </form>
      </Karte>
      {eigen && (
        <Karte>
          <Ueberschrift>Dein Leseteil</Ueberschrift>
          {!leseteil && <Leer>Wird geladen …</Leer>}
          {leseteil?.status === 'laeuft' && <div style={klein}>Läuft noch — gestartet {leseteil.gestartet.slice(0, 16).replace('T', ' ')}.</div>}
          {leseteil?.status === 'fehler' && <Hinweis art="kritisch">{leseteil.fehler}</Hinweis>}
          {leseteil?.status === 'abgelaufen' && <div style={klein}>Abgelaufen — Tiefenberichte bleiben 30 Tage.</div>}
          {leseteil?.status === 'fertig' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{leseteil.text}</div>
              {leseteil.suchvorschlaegeHtml && <iframe title="Suchvorschläge" sandbox="" srcDoc={leseteil.suchvorschlaegeHtml} style={{ width: '100%', minHeight: 120, border: 0, borderRadius: 12, background: C.flaeche }} />}
              {(leseteil.quellen ?? []).length > 0 && (
                <div style={klein}>Quellen: {leseteil.quellen!.map((q, i) => <span key={q.url}>{i ? ' · ' : ''}<a href={q.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: C.aktiv }}>{q.titel ?? q.url}</a></span>)}</div>
              )}
              <div style={klein}>Noch {leseteil.restTage ?? 0} Tage sichtbar. Nur du siehst diesen Bericht.</div>
            </div>
          )}
        </Karte>
      )}
    </div>
  );
}
