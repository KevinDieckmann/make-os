'use client';

// ─── Markttraktion · Planung (10.10. als Schnellknopf, seit 22.10. Hub-Punkt unter „Steuerung“) ──────────────────
// Kevin: „Umsatzziele auf einzelne Aktivitäten runterplanen — Sales, Marketing, was auch immer — mit Kapa und allem, was dazugehört. Das
// Wochen-Scoreboard ist mega, aber nur, wenn ich weiß, was das Ziel war. Dann wöchentliche Challenges …“ — und: „Die Pipeline in einem
// Bereich sehen, wo wir die Conversions sehen und anpassen können — planen pro Leadkanal.“
// Vier Ansichten (Adresse `a`, lib/crm/adresse.ts `PLANUNG_ANSICHTEN`): Kreislauf (Start) · Ziele & Aktivitäten · Leadkanäle · Challenges;
// `kanal` filtert auf einen Leadkanal. Alles kommt aus EINEM Abruf (components/os/crm/planung/daten.ts), gerechnet auf dem Server.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Hinweis, Pillen, Knopf } from '../../ui';
import { WELT_FARBE } from '../Ueberblick';
import type { PlanungAnsicht } from '@/lib/crm/adresse';
import { usePlanung } from './daten';
import { Kreislauf } from './Kreislauf';
import { Kanaele } from './Kanaele';
import { Ziele } from './Ziele';
import { Challenges } from './Challenges';
import { FehlerHinweis } from '../FehlerHinweis';
import { Wahl } from '../Wahl';

/** Kennung von „Alle Kanäle“ im Auswahl-Chip (kein Leadkanal heißt so — die Kanäle tragen erzeugte Kennungen). */
const ALLE = '__alle';

const ANSICHTEN: { id: PlanungAnsicht; label: string }[] = [
  { id: 'kreislauf', label: 'Kreislauf' }, { id: 'ziele', label: 'Ziele & Aktivitäten' }, { id: 'kanaele', label: 'Leadkanäle' }, { id: 'challenges', label: 'Challenges' },
];

/** `onOrt` wechselt Ansicht und Kanal-Filter in EINEM Schritt (ein Eintrag im Verlauf). */
export function MtPlanung({ ansicht, kanal, onOrt }: { ansicht: PlanungAnsicht; kanal: string | null; onOrt: (a: PlanungAnsicht, kanal: string | null) => void }) {
  const api = usePlanung(kanal);
  const onAnsicht = (a: PlanungAnsicht) => onOrt(a, kanal);
  const lage = api.lage;
  // 11.10.: der Kanal-Filter ist ein Auswahl-Chip im Kopf des Kreislaufs (vorher eine dritte Pillenreihe über allem) — „Alle Kanäle“ = kein Filter.
  const kanalListe = [{ id: ALLE, label: 'Alle Kanäle' }, ...(lage?.datei.kanaele ?? []).filter(k => k.aktiv).map(k => ({ id: k.id, label: k.name })), { id: 'ohne', label: 'Ohne Kanal' }];
  const kanalWahl = lage && lage.datei.kanaele.some(k => k.aktiv)
    ? <Wahl<string> label="Leadkanal" liste={kanalListe} wert={kanal ?? ALLE} onWahl={id => onOrt(ansicht, id === ALLE ? null : id)} />
    : undefined;
  return (
    <>
      <div><Pillen einzeilig farbe={WELT_FARBE.sales} liste={ANSICHTEN} aktiv={ansicht} onWahl={onAnsicht} /></div>
      <FehlerHinweis text={api.hinweis} onZu={() => api.setHinweis(null)} />
      {api.fehler && <Hinweis art="kritisch" aktion={<Knopf leise onClick={api.neuLaden}>Noch einmal</Knopf>}>{api.fehler}</Hinweis>}
      {!lage && !api.fehler && <Karte i={0}><div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Lädt die Planung …</div></Karte>}
      {lage && ansicht === 'kreislauf' && <Kreislauf api={api} lage={lage} zuKanaele={() => onAnsicht('kanaele')} kanalWahl={kanalWahl} />}
      {lage && ansicht === 'ziele' && <Ziele api={api} lage={lage} zuKanaele={() => onAnsicht('kanaele')} />}
      {lage && ansicht === 'kanaele' && <Kanaele api={api} lage={lage} kanal={kanal} onKanal={k => onOrt(k ? 'kreislauf' : ansicht, k)} />}
      {lage && ansicht === 'challenges' && <Challenges api={api} lage={lage} />}
    </>
  );
}
