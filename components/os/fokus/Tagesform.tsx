'use client';

// ─── Fokus › Tagesform (nur Privat, 10.10.) ─────────────────────────────────────────────────────────────────────────────────────
// Die echte Recovery von heute, auf Wunsch mit KI-Einordnung („Tag mit ZOE ausrichten“, /api/fokus). Gesundheit ist ein Privat-Thema —
// die Fokus-Seite rendert diesen Abschnitt nur in der Privat-Sicht (die Business-Sicht lädt ihn gar nicht erst).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WEG } from '@/lib/wege';
import { Rich } from '../Rich';
import { Karte, Ueberschrift, Ring, Chip, Knopf, zoneFarbe } from '../ui';

export function Tagesform({ i = 0 }: { i?: number }) {
  const [rec, setRec] = useState<number | null>(null);
  const [frisch, setFrisch] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/gesundheit/stand').then(r => r.json()).then(d => { if (d?.vitals) { setRec(typeof d.vitals.rec === 'number' ? d.vitals.rec : null); setFrisch(!!(d.vitals.heute || (d.vitals.alterTage <= 1 && !d.vitals.fallback))); } }).catch(() => {});
  }, []);
  const ausrichten = async () => {
    try { const d = await fetch('/api/fokus', { method: 'POST' }).then(r => r.json()); setPlan(d.reply ?? d.error ?? 'Keine Antwort.'); }
    catch { setPlan('Nicht erreichbar.'); }
  };
  const zone = rec == null ? null : rec >= 66 ? 'Grün' : rec >= 40 ? 'Gelb' : 'Rot';
  const zoneText = rec == null ? 'Noch keine Recovery von heute — der Tag wird nach Prioritäten geplant.'
    : rec >= 66 ? 'Grün: Tiefe Arbeit zuerst. Der schwerste Block gehört in den Vormittag.'
      : rec >= 40 ? 'Gelb: Eine tiefe Einheit, dann Routine. Keine neuen Großbaustellen.'
        : 'Rot: Nur das Nötige. Termine schieben, Erholung einplanen.';
  return (
    <Karte i={i} akzent={zone ? zoneFarbe(rec) : undefined}>
      <Ueberschrift farbe={zone ? zoneFarbe(rec) : undefined} rechts={<Link href={WEG.gesundheit()} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: TYP.bedien }}>Gesundheit ›</Link>}>Tagesform</Ueberschrift>
      <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,40px)', alignItems: 'center' }}>
        <Ring label="Recovery" wert={rec != null ? String(rec) : undefined} farbe={zoneFarbe(rec)} anteil={rec != null ? rec / 100 : undefined}
          unter={zone ? <Chip farbe={zoneFarbe(rec)}>{frisch ? `Zone ${zone}` : `${zone} · nicht von heute`}</Chip> : undefined} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{zoneText}</p>
          <div style={{ marginTop: 14 }}><Knopf onClick={ausrichten}>{plan ? '↻ Neu ausrichten' : 'Tag mit ZOE ausrichten'}</Knopf></div>
        </div>
      </div>
      {plan && <div style={{ marginTop: 16 }}><Rich text={plan} /></div>}
    </Karte>
  );
}
