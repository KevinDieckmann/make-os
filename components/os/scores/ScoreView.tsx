'use client';

// ─── /os/score — die zwei Scores im Ganzen (21.10.) ──────────────────────────────────────────────────────────────────────────────────
// Kevin 21.10.: „antippen öffnet alles“ — Säulen, Kennzahlen, größter Hebel. Die Seite folgt dem Kopf-Schalter (`?space=` gewinnt):
//   · Privat   → der Privat-Score der Person (IndexAnsicht — dieselbe Ansicht wie jeder Index; Daten nur aus GET /api/scores?sicht=privat&voll=1)
//   · Business → der Business-Score = Business-Index mit allen Säulen und Sichten (BusinessCockpit teil="index", Daten aus GET /api/business)
// Ein Konto „nur Business“ sieht immer Business (useSpace); den Privat-Score liefert der Server ihm nie (403).

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FARBE as C, TYP, FADEN_TOENE } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { useSpace } from '@/hooks/useSpace';
import { Seite, Hinweis, LEUCHT } from '../ui';
import { IndexAnsicht, type IndexDaten } from '../kennzahlen/IndexAnsicht';
import { BusinessCockpit } from '../business/BusinessCockpit';

/** Farben der Säulen des Privat-Scores (Gesundheit · Finanzen privat · Planung · Familie) — Finanzen im Verlauf in Kupfer (nie die drei Teals zusammen als Serien). */
export const PRIVAT_SCORE_FARBE: Record<string, string> = { ge: LEUCHT.gut, fi: FADEN_TOENE.finanzen, pl: LEUCHT.planung, fa: LEUCHT.beziehung };

interface PrivatAntwort extends IndexDaten { ok: boolean; gewichte?: string; fehler?: string }

const schwelleSenden = (schwelle: Record<string, unknown>) =>
  fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schwelle }) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));

function PrivatScoreAnsicht() {
  const [d, setD] = useState<PrivatAntwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch('/api/scores?sicht=privat&voll=1', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  if (fehler) return <Hinweis art="kritisch">{fehler}</Hinweis>;
  return (
    <IndexAnsicht d={d} name="Privat" chip="Privat-Score" farben={PRIVAT_SCORE_FARBE} scope="privat-score" kopfId="index" fadenLinie
      schwelleSenden={schwelleSenden} onGespeichert={() => void laden()}
      hinweis={<>Säulen und Gewichte: {d?.gewichte ?? '…'}. Gesundheit zählt nur mit deiner Einwilligung und nur für dich — auch geteilt sieht niemand sonst deinen Privat-Score. Die Säulen tragen dieselbe Zahl wie ihr Index: <Link href={WEG.gesundheit('index')} style={{ color: C.inkDim }}>Gesundheit</Link> · <Link href={WEG.privatIndex()} style={{ color: C.inkDim }}>Finanzen privat</Link> · <Link href={WEG.familie()} style={{ color: C.inkDim }}>Familie</Link>.</>} />
  );
}

export function ScoreView() {
  const { wahl } = useSpace();
  return (
    <Seite titel={wahl === 'business' ? 'Business-Score' : 'Privat-Score'} breit={1440}
      unter={wahl === 'business'
        ? 'Alles aus dem Business in einer Zahl — jede Säule, jede Kennzahl mit Formel und Quelle. Privates zählt nie.'
        : 'Alles aus dem Privaten in einer Zahl — nur deine, nur für dich. Business zählt nie.'}>
      {wahl === 'business' ? <BusinessCockpit key="business" eingebettet teil="index" /> : <PrivatScoreAnsicht key="privat" />}
      <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Der Score steht auch oben auf <Link href={WEG.heute(wahl)} style={{ color: C.inkDim }}>Heute</Link>.</div>
    </Seite>
  );
}
