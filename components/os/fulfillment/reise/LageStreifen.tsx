'use client';

// ─── Fulfillment — die Lage als EINE schlanke Zeile (11.10. drei Antwort-Kacheln; seit 17.10. eine Zeile — Miro-Standard) ────────────────────
// Rückmeldung 17.10.: „Es dupliziert sich — lieber wenig und klar.“ Die Lage-Kacheln oben und die Kunden-Karten der Landkarte zeigten dasselbe. Jetzt steht über
// der Unternavigation nur noch EINE Zeile mit ZAHLEN (Feinschliff 17.10.): wie viele Kunden in Lieferung (mit Ampel) und wie viele Punkte hängen (dringende
// eigens) — „was hängt“ und „als Nächstes“ im Einzelnen stehen nur in der Kundenkarte. Ein Tipp springt zu den Karten. Liest das Mandats-Cockpit
// (GET /api/fulfillment/cockpit, nur lesen); Ampel aus lib/fulfillment/prozesse/darstellung.ts.

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { FARBE as C, TYP, MIKRO, SCHRIFT } from '@/lib/make-one/design';
import { Punkt, Erklaert, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { anzahl } from '@/lib/text/zahlwort';
import { kundenAmpel } from '@/lib/fulfillment/prozesse/darstellung';
import { useCockpit } from '../prozesse/daten';
import { AMPEL_FARBE } from './bilder';

function Teil({ titel, farbe, text, onClick }: { titel: string; farbe?: string; text: ReactNode; onClick?: () => void }) {
  const inhalt = (
    <>
      <span style={{ ...MIKRO }}>{titel}</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, color: C.ink, minWidth: 0, overflowWrap: 'break-word' }}>{farbe && <Punkt farbe={farbe} groesse={8} />}{text}{onClick ? ' ›' : ''}</span>
    </>
  );
  const stil = { display: 'grid', gap: 1, textAlign: 'left' as const, minHeight: 44, padding: '2px 0', minWidth: 0, flex: '1 1 220px', fontFamily: SCHRIFT.text };
  return onClick
    ? <button type="button" className="fassbar" onClick={onClick} style={{ ...stil, background: 'none', border: 'none', cursor: 'pointer', color: C.ink }}>{inhalt}</button>
    : <span style={stil}>{inhalt}</span>;
}

export function LageStreifen() {
  const router = useRouter();
  const { daten } = useCockpit();
  if (!daten) return null;
  const zeilen = daten.zeilen;
  const rot = daten.haengt.filter(h => h.schwere === 'rot');
  const n = daten.haengt.length;
  const ampel = zeilen.length ? AMPEL_FARBE[zeilen.some(z => kundenAmpel(z) === 'rot') ? 'rot' : zeilen.some(z => kundenAmpel(z) === 'gelb') ? 'gelb' : 'gruen'] : undefined;
  const zuDenKarten = () => router.push(`${WEG.fulfillment()}#ff-kunden`);
  return (
    <div className="ff-lage" role="group" aria-label="Lage" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 22px', alignItems: 'center', padding: '4px 2px', borderBottom: `1px solid ${C.linie}` }}>
      <Erklaert erklaerung="fulfillment.lage" name="Lage"><span style={{ ...MIKRO, color: C.inkDim }}>Lage</span></Erklaert>
      <Teil titel="Kunden in Lieferung" farbe={ampel} text={zeilen.length ? anzahl(zeilen.length, 'Kunde', 'Kunden') : 'Noch keiner — ein Fall startet mit dem Onboarding'}
        onClick={zeilen.length ? zuDenKarten : () => router.push(WEG.fulfillment('onboarding'))} />
      <Teil titel="Was hängt?" farbe={rot.length ? LEUCHT.kritisch : n ? LEUCHT.achtung : LEUCHT.gut}
        text={n ? `${anzahl(n, 'Punkt hängt', 'Punkte hängen')}${rot.length ? ` · ${rot.length} dringend` : ''}` : 'Nichts — alle Fälle sind im Takt'}
        {...(n ? { onClick: zuDenKarten } : {})} />
    </div>
  );
}
