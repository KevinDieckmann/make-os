'use client';

// ─── Finanzplanung jetzt — Entnahme der Selbstständigkeit → Privat ───────────
// Kern-Umbau 02.10.: Die Selbstständigkeit hat ein eigenes Konto; was Kevin daraus nach Privat entnimmt, steht im Arbeitsplan
// (`annahmen.entnahme`): ein fester Betrag je Monat ab einem Monat und/oder ein Anteil am positiven Ergebnis nach Steuern.
// Beides ist schon versteuert, keine weitere Steuer. Leer = keine Entnahme (das Geld bleibt im Konto der Selbstständigkeit).

import { prozent } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { ZahlFeld, MonatWahl } from './teile';
import { FeldK } from './Annahmen';
import { ProzentFeld } from './Steuern';
import { TYP } from '@/lib/make-one/design';

export function EntnahmeFelder() {
  const { d, aw } = usePlan();
  const { ps, schreibe } = useArbeitsplan();
  const en = ps?.annahmen.entnahme;
  const setze = (neu: { betrag?: number; anteil?: number; ab: number }) => {
    const leer = !(neu.betrag && neu.betrag > 0) && !(neu.anteil && neu.anteil > 0);
    void schreibe(id => [{ pfad: `/planszenarien/id=${id}/annahmen/entnahme`, alt: en, ...(leer ? {} : { neu }) }], 'Entnahme der Selbstständigkeit');
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <FeldK label="Entnahme je Monat (fest)" breit={170}><ZahlFeld wert={en?.betrag ?? null} leer platzhalter="keine" dezimal={0} breite="100%" titel="Entnahme der Selbstständigkeit je Monat" onFertig={v => setze({ betrag: v ?? undefined, anteil: en?.anteil, ab: en?.ab ?? aw.m0 })} /></FeldK>
      <FeldK label="Anteil am Ergebnis nach Steuern" breit={190}><ProzentFeld wert={en?.anteil ?? null} leer platzhalter="keiner" dezimal={1} breite="100%" titel="Anteil am Ergebnis nach Steuern als Entnahme" onFertig={v => setze({ betrag: en?.betrag, anteil: v == null ? undefined : Math.max(0, Math.min(1, v)), ab: en?.ab ?? aw.m0 })} /></FeldK>
      <FeldK label="Entnahme ab" breit={150}><MonatWahl wert={en?.ab ?? aw.m0} onWahl={m => setze({ betrag: en?.betrag, anteil: en?.anteil, ab: m })} monate={d.monate} breite={150} /></FeldK>
      {en && <span style={{ alignSelf: 'flex-end', fontSize: TYP.bedien, color: '#8d8d93', paddingBottom: 9 }}>{[en.betrag ? `${Math.round(en.betrag)} € fest` : null, en.anteil ? `${prozent(en.anteil, 1)} vom Ergebnis` : null].filter(Boolean).join(' + ')}</span>}
    </div>
  );
}
