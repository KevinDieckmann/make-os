'use client';

// ─── Einstellungen › Was ist neu (18.10.) ────────────────────────────────────────────────────────────────────────────────────────────
// Alle Updates, neueste zuerst — je Update Datum, Titel, ein Satz und die Punkte „Neu · Besser geworden · Behoben“. Die Liste kommt vom Server
// (GET /api/neuigkeiten, schon nach der Sicht des Kontos gefiltert). Wer die Seite öffnet, hat das neueste Update gesehen (POST, einmal).

import { useEffect, useState } from 'react';
import { Seite, Karte, Ueberschrift, Leerzustand, Hinweis, Chip } from '../ui';
import { FARBE as C, TYP, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { UpdateAbschnitte, datumDe } from './UpdateTeile';
import type { Neuigkeit } from '@/lib/neuigkeiten/eintraege';

interface Stand { eintraege: Neuigkeit[]; ungelesen: Neuigkeit[] }

export function NeuigkeitenView() {
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let weg = false;
    fetch('/api/neuigkeiten', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Stand) => {
        if (weg) return;
        setStand({ eintraege: d.eintraege ?? [], ungelesen: d.ungelesen ?? [] });
        const neuestes = d.ungelesen?.[0]?.id;
        if (neuestes) fetch('/api/neuigkeiten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gesehen: neuestes }) }).catch(() => {});
      })
      .catch(() => { if (!weg) setFehler(true); });
    return () => { weg = true; };
  }, []);

  const neu = new Set((stand?.ungelesen ?? []).map(n => n.id));
  return (
    <Seite titel="Was ist neu">
      {fehler && <Hinweis art="achtung">Die Übersicht ließ sich gerade nicht laden — bitte die Seite neu laden.</Hinweis>}
      {stand && !stand.eintraege.length && (
        <Leerzustand symbol="✦" titel="Noch keine Updates">Nach jedem Update steht hier, was dazugekommen ist.</Leerzustand>
      )}
      {stand?.eintraege.map((n, i) => (
        <Karte key={n.id} i={i} id={n.id}>
          <Ueberschrift rechts={neu.has(n.id) ? <Chip farbe={BEDEUTUNG_FARBE.info}>neu für dich</Chip> : undefined}>{n.titel}</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: -4 }}>Update vom {datumDe(n.datum)}</div>
          <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.6, margin: '10px 0 14px' }}>{n.kurz}</p>
          <UpdateAbschnitte n={n} />
        </Karte>
      ))}
    </Seite>
  );
}
