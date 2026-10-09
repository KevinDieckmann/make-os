'use client';

// ─── Sport — Einstellungen der Person: Entlastungs-Regel, Deload/Taper-Umfang, was im Cockpit zuerst steht (09.10.2026) ────
// Jede Zahl der Regeln ist einstellbar (Plattform-Regel: nie Persönliches im Code) — leer = Vorgabe (lib/sport/entlastung.ts,
// lib/sport/plan-bau.ts). Geschrieben über den Schritt `einstellungen` (null = zurück auf die Vorgabe).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Pillen as UiPillen, Schalter } from '../ui';
import { Feld, Hinweis } from './teile';
import { ZUERST, ZUERST_LABEL, type Op, type SportStand, type Zuerst } from '@/lib/sport/modell';
import { ENTLASTUNG_VORGABE } from '@/lib/sport/entlastung';
import { PHASE_VORGABE } from '@/lib/sport/plan-bau';

export function EinstellungenKarte({ stand, schicke }: { stand: SportStand; schicke: (ops: Op[], erfolg?: string) => Promise<boolean> }) {
  const [offen, setOffen] = useState(false);
  const e = stand.einstellungen ?? {};
  const en = e.entlastung ?? {};
  const setze = (werte: Record<string, unknown>) => schicke([{ op: 'einstellungen', werte }], 'Gespeichert.');
  const zahlWahl = (label: string, werte: number[], aktiv: number, vorgabe: number, onWahl: (n: number | null) => void, form = (n: number) => String(n)) => (
    <Feld label={label}>
      <UiPillen liste={werte.map(n => ({ id: String(n), label: `${form(n)}${n === vorgabe ? ' (Vorgabe)' : ''}` }))} aktiv={String(aktiv)} onWahl={x => onWahl(Number(x) === vorgabe ? null : Number(x))} />
    </Feld>
  );
  return (
    <Karte i={7}>
      <Ueberschrift rechts={<button type="button" onClick={() => setOffen(o => !o)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{offen ? 'Schließen' : 'Ändern'}</button>}>Einstellungen</Ueberschrift>
      {!offen ? (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
          Cockpit zuerst: {ZUERST_LABEL[e.zuerst ?? 'tagesform']} · Entlastung {en.aus ? 'aus' : `ab ${en.mindestTage ?? ENTLASTUNG_VORGABE.mindestTage} von ${en.fensterTage ?? ENTLASTUNG_VORGABE.fensterTage} Tagen`} · Deload {e.deloadProzent ?? PHASE_VORGABE.deloadProzent} % · Taper {e.taperProzent ?? PHASE_VORGABE.taperProzent} %
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <Feld label="Im Gesundheits-Cockpit zuerst"><UiPillen liste={ZUERST.map(z => ({ id: z, label: ZUERST_LABEL[z] }))} aktiv={e.zuerst ?? 'tagesform'} onWahl={(z: Zuerst) => void setze({ zuerst: z === 'tagesform' ? null : z })} /></Feld>
          <div>
            <Schalter an={!en.aus} onChange={an => void setze({ entlastung: { aus: an ? null : true } })}>Entlastung nach HRV-Trend vorschlagen</Schalter>
          </div>
          {!en.aus && (
            <>
              {zahlWahl('Tage, die betrachtet werden', [2, 3, 4, 5], en.fensterTage ?? ENTLASTUNG_VORGABE.fensterTage, ENTLASTUNG_VORGABE.fensterTage, n => void setze({ entlastung: { fensterTage: n } }))}
              {zahlWahl('Davon auffällig, bis vorgeschlagen wird', [1, 2, 3, 4], en.mindestTage ?? ENTLASTUNG_VORGABE.mindestTage, ENTLASTUNG_VORGABE.mindestTage, n => void setze({ entlastung: { mindestTage: n } }))}
              {zahlWahl('HRV auffällig unter … des eigenen Bezugs', [0.85, 0.88, 0.9, 0.93, 0.95], en.hrvAnteil ?? ENTLASTUNG_VORGABE.hrvAnteil, ENTLASTUNG_VORGABE.hrvAnteil, n => void setze({ entlastung: { hrvAnteil: n } }), n => `${Math.round(n * 100)} %`)}
              {zahlWahl('Ruhepuls auffällig über Bezug + …', [2, 3, 4, 5, 6], en.pulsPlus ?? ENTLASTUNG_VORGABE.pulsPlus, ENTLASTUNG_VORGABE.pulsPlus, n => void setze({ entlastung: { pulsPlus: n } }), n => `${n} Schläge`)}
            </>
          )}
          {zahlWahl('Umfang einer Deload-Woche', [50, 60, 70, 80], e.deloadProzent ?? PHASE_VORGABE.deloadProzent, PHASE_VORGABE.deloadProzent, n => void setze({ deloadProzent: n }), n => `${n} %`)}
          {zahlWahl('Umfang einer Taper-Woche', [40, 50, 60, 70], e.taperProzent ?? PHASE_VORGABE.taperProzent, PHASE_VORGABE.taperProzent, n => void setze({ taperProzent: n }), n => `${n} %`)}
          <div><Knopf leise onClick={() => void setze({ zuerst: null, entlastung: null, deloadProzent: null, taperProzent: null })}>Alles auf Vorgabe</Knopf></div>
          <Hinweis>Der Bezug ist dein eigener Durchschnitt der 14 Tage vor dem betrachteten Fenster. Die Regeln sind Vorschläge, keine Trainings- oder ärztliche Beratung.</Hinweis>
        </div>
      )}
    </Karte>
  );
}
