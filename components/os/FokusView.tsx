'use client';

// ─── MAKE OS — Fokus (Recovery × Prioritäten) ───────────────────────────────
// MAKE verrechnet die Whoop-Recovery mit den Aufgaben und nennt die Tagesform.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Ring/Knopf).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { WHOOP } from '@/lib/make-one/health-data';
import { Rich } from './Rich';
import { Seite, Karte, Ueberschrift, Ring, Chip, Knopf, Leer, LEUCHT } from './schlank';

const rec = WHOOP.rec;
const zone = rec >= 66 ? 'grün' : rec >= 40 ? 'gelb' : 'rot';
const zoneColor = zone === 'grün' ? LEUCHT.gut : zone === 'gelb' ? LEUCHT.achtung : LEUCHT.kritisch;
const zoneText = zone === 'grün' ? 'Volle Kapazität — heute geht harter Deep-Work.' : zone === 'gelb' ? 'Fokussiert, aber mit Puffer — nicht überziehen.' : 'Nur das Essentielle + Regeneration. Nicht durchpowern.';

export function FokusView() {
  const [plan, setPlan] = useState('');
  const [busy, setBusy] = useState(false);

  async function align() {
    setBusy(true); setPlan('');
    try {
      const r = await fetch('/api/fokus', { method: 'POST' });
      const d = await r.json();
      setPlan(d.reply ?? 'Kein Plan erhalten.');
    } catch { setPlan('Ich konnte den Tag gerade nicht ausrichten — versuch es nochmal.'); }
    finally { setBusy(false); }
  }

  return (
    <Seite titel="Dein Tag, ausgerichtet." unter="Fokus · Recovery × Prioritäten — MAKE verrechnet deine Whoop-Recovery mit deinen Aufgaben und sagt dir die Tagesform. Firma und Gesundheit in einer Empfehlung.">
      <Karte i={0} akzent={zoneColor}>
        <Ueberschrift farbe={zoneColor} rechts={`RHR ${WHOOP.rhr} · HRV ${WHOOP.hrv} · Schlaf ${WHOOP.sleepLast} h`}>Readiness</Ueberschrift>
        <div className="heute-kopf" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'clamp(18px,4vw,40px)', alignItems: 'center' }}>
          <Ring label="Recovery" wert={rec ? String(rec) : undefined} farbe={zoneColor} anteil={rec ? rec / 100 : undefined}
            unter={<Chip farbe={zoneColor}>Zone {zone}</Chip>} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: TYP.body, color: C.ink, lineHeight: 1.5, margin: 0 }}>{zoneText}</p>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
              <Knopf onClick={align} aus={busy}>{busy ? 'richtet aus …' : plan ? '↻ Neu ausrichten' : 'Tag ausrichten →'}</Knopf>
              {!plan && !busy && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>MAKE nimmt deine Recovery + Aufgaben und baut dir die Tagesform.</span>}
            </div>
          </div>
        </div>
      </Karte>

      {plan && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.agenten}>Tagesform</Ueberschrift>
          <Rich text={plan} />
        </Karte>
      )}
      {busy && !plan && (
        <Karte i={1}><Leer>MAKE richtet den Tag aus …</Leer></Karte>
      )}
    </Seite>
  );
}
