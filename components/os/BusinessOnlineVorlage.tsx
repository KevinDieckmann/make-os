'use client';

// ─── Einrichtung › Plan „Business online“ anlegen (09.10., Neustart) ────────────────────────────────────────────────────────────────
// Ein Klick: Jahresziel + Meilensteine mit Kette + Aufgaben für die gewählte Business-Gesellschaft — Vorlage rein in
// lib/planung/vorlage-business-online.ts, geschrieben nur über die bestehenden Wege (lib/planung/vorlage-anlegen.ts). Feste Kennungen: ein zweiter
// Klick ergänzt nur, was fehlt; steht der Plan, führt der Knopf hin. Gesellschaften nur aus lib/einheiten.ts (nie ein Name im Code).

import { useCallback, useEffect, useState } from 'react';
import { Knopf, Hinweis, Segmente } from './ui';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { localDay } from '@/lib/zeit';
import { BUSINESS_GESELLSCHAFTEN, einheitAusGesellschaft, finanzOrtName, type Gesellschaftskennung } from '@/lib/einheiten';
import { businessOnlineFuer, businessOnlineZielId, BUSINESS_ONLINE_SCHRITTE } from '@/lib/planung/vorlage-business-online';
import { planVorlageAnlegen } from '@/lib/planung/vorlage-anlegen';

const klein = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55 } as const;

export function BusinessOnlineVorlage({ onFertig }: { onFertig?: () => void }) {
  const [g, setG] = useState<Gesellschaftskennung | null>(BUSINESS_GESELLSCHAFTEN[0] ?? null);
  const [da, setDa] = useState<Set<string> | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch'; text: string } | null>(null);

  const pruefen = useCallback(async () => {
    const d = await fetch('/api/state/ziele', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    setDa(new Set(Array.isArray(d?.jahr) ? (d.jahr as { id: string }[]).map(z => z.id) : []));
  }, []);
  useEffect(() => { void pruefen(); }, [pruefen]);

  if (!g) return <Hinweis art="info">Keine Business-Gesellschaft auf dieser Instanz — der Plan „Business online“ entfällt.</Hinweis>;
  const zielId = businessOnlineZielId(g);
  const steht = !!da?.has(zielId);
  const name = finanzOrtName(g);

  const anlegen = async () => {
    setMeldung(null);
    try {
      const r = await planVorlageAnlegen(businessOnlineFuer(g, name, einheitAusGesellschaft(g) ?? name, localDay()), undefined, setLaeuft);
      const neu = (r.ziel ? 1 : 0) + r.meilensteine + r.aufgaben;
      setMeldung({ art: 'gut', text: neu ? `Angelegt: ${r.ziel ? 'Ziel, ' : ''}${r.meilensteine} Meilensteine, ${r.aufgaben} Aufgaben.` : 'Der Plan stand schon vollständig — nichts doppelt angelegt.' });
      await pruefen();
      onFertig?.();
    } catch (e) {
      setMeldung({ art: 'kritisch', text: `${e instanceof Error ? e.message : 'Nicht angelegt.'} Was schon steht, bleibt — ein zweiter Klick ergänzt nur, was fehlt.` });
    } finally { setLaeuft(null); }
  };

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {BUSINESS_GESELLSCHAFTEN.length > 1 && (
        <Segmente umbrechen liste={BUSINESS_GESELLSCHAFTEN.map(x => ({ id: x, label: finanzOrtName(x) }))} aktiv={g} onWahl={x => { setG(x); setMeldung(null); }} />
      )}
      <div style={klein}>Ein Ziel „Business online: {name}“ mit {BUSINESS_ONLINE_SCHRITTE.length} Meilensteinen in fester Reihenfolge und Aufgaben — Termine sind Vorschläge ab heute.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {steht && <Knopf href={WEG.ziel(zielId)}>Plan öffnen ›</Knopf>}
        <Knopf leise={steht} onClick={anlegen} aus={!!laeuft || da === null}>{steht ? 'Fehlendes ergänzen' : 'Plan anlegen'}</Knopf>
      </div>
      {laeuft && <div role="status" style={klein}>legt an: {laeuft}</div>}
      {meldung && <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'}>{meldung.text}</Hinweis>}
    </div>
  );
}
