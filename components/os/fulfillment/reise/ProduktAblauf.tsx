'use client';

// ─── Fulfillment › Fall — der Ablauf des Produkts aus der Werkstatt (24.10., Bau-Test Kern; Regeln: lib/prozesse/produkt-ablauf.ts) ────────────────────
// Hat das Produkt des Mandats einen Prozess der Werkstatt, ist ER der Ablauf des Falls: die Reise zeigt seine Phasen (Spalten aus `ablaufSpalten`), ein Tipp auf
// eine Phase zeigt ihre Schritte mit dem Stand des Laufs. Läuft der Prozess nicht scharf, sagt der Fall es klar — mit dem Weg in die Werkstatt (dort „Scharf
// schalten“). Rechnet nichts selbst, schreibt nichts (Schritte führt der Lauf-Motor aus; Aufgaben stehen unter Aufgaben).

import Link from 'next/link';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Hinweis, Knopf, Liste, Zeile, Chip, Punkt, LEUCHT } from '../../ui';
import { WEG } from '@/lib/wege';
import { LAGE_SATZ, LAGE_WORT, ablaufSpalten, ablaufPhasenKennung, type AblaufSchrittZustand, type ProduktAblaufAnsicht } from '@/lib/prozesse/produkt-ablauf';
import { ReiseBild } from '../../ui/reise/ReiseBild';
import { klein } from '../prozesse/teile';

const ZUSTAND: Readonly<Record<AblaufSchrittZustand, { text: string; farbe: string }>> = {
  erledigt: { text: 'erledigt', farbe: LEUCHT.gut }, hier: { text: 'dran', farbe: LEUCHT.planung }, offen: { text: 'offen', farbe: C.inkDim }, entfaellt: { text: 'nicht erreicht', farbe: C.inkLeise },
};
/** Was man tun kann, damit der Ablauf läuft — je Lage ein Satz (die Lage selbst sagt `LAGE_SATZ`). */
const WEG_SATZ: Readonly<Record<Exclude<ProduktAblaufAnsicht['lage'], 'scharf'>, string>> = {
  schatten: 'Im Schatten rechnet der Lauf mit und schreibt nichts. Scharf schaltet ihr in der Werkstatt („Scharf schalten“ — mit Budget und Rückfrage).',
  entwurf: 'In der Werkstatt veröffentlichen, danach scharf schalten.',
  angehalten: 'In der Werkstatt wieder einschalten.',
};

const werkstattLink = (a: Pick<ProduktAblaufAnsicht, 'id'>, ph?: string) => WEG.prozesse({ p: a.id, ...(ph ? { ph } : {}), ansicht: 'werkstatt' });

/** Der Hinweis zur Lage — nur, wenn der Ablauf nicht scharf läuft (dann entstehen noch keine Aufgaben). */
export function AblaufLageHinweis({ ablauf }: { ablauf: ProduktAblaufAnsicht }) {
  if (ablauf.lage === 'scharf') return null;
  return (
    <Hinweis art="info" titel={LAGE_SATZ[ablauf.lage]} aktion={<Knopf leise href={werkstattLink(ablauf)}>{ablauf.lage === 'schatten' ? 'In der Werkstatt scharf schalten ›' : 'In der Werkstatt öffnen ›'}</Knopf>}>
      {WEG_SATZ[ablauf.lage]}
    </Hinweis>
  );
}

/** Ohne Fall (Seite „Noch kein Fall“): der Ablauf des Produkts als Reise-Zeile zum Ansehen — dieselbe Zeichnung, nur lesen. */
export function ProduktAblaufKarte({ ablauf }: { ablauf: ProduktAblaufAnsicht }) {
  return (
    <Karte i={2} flach>
      <Ueberschrift rechts={<Chip farbe={ablauf.lage === 'scharf' ? LEUCHT.gut : C.inkDim}>{LAGE_WORT[ablauf.lage]}</Chip>}>Ablauf des Produkts · {ablauf.titel}</Ueberschrift>
      {ablauf.phasen.length
        ? <ReiseBild spalten={ablaufSpalten(ablauf, 1, false)} band={false} flow="still" label={`Ablauf „${ablauf.titel}“`} />
        : <div style={klein}>Der Ablauf hat noch keine Phasen — in der Werkstatt anlegen.</div>}
      <AblaufLageHinweis ablauf={ablauf} />
    </Karte>
  );
}

/** Eine Phase des Ablaufs (gewählt in der Reise des Falls): ihre Schritte mit dem Stand des Laufs, Weg in die Werkstatt. */
export function AblaufPhaseKarte({ ablauf, phase, gewaehlt, nr }: { ablauf: ProduktAblaufAnsicht; phase: string; gewaehlt: string | null; nr: number }) {
  const p = ablauf.phasen.find(x => ablaufPhasenKennung(x.id) === phase);
  if (!p) return null;
  return (
    <Karte i={1} id="ff-fluss">
      <Ueberschrift rechts={<Link href={werkstattLink(ablauf, p.id)} style={{ color: C.aktiv, fontSize: TYP.bedien, textDecoration: 'none' }}>In der Werkstatt ›</Link>}>Phase {nr} · {p.titel}</Ueberschrift>
      <div style={klein}>Aus dem Ablauf „{ablauf.titel}“ ({LAGE_WORT[ablauf.lage]}){ablauf.lauf?.modus === 'scharf' ? ' — Aufgaben stehen unter Aufgaben, Abhaken treibt den Lauf weiter.' : '.'}</div>
      {p.schritte.length ? (
        <Liste>
          {p.schritte.map(s => (
            <Zeile key={s.id} aktiv={s.id === gewaehlt} links={<Punkt farbe={ZUSTAND[s.zustand].farbe} />} titel={s.titel} umbrechen
              unter={`${ZUSTAND[s.zustand].text}${s.kunde ? ' · der Kunde sieht es' : ''}`} />
          ))}
        </Liste>
      ) : <div style={klein}>Diese Phase hat noch keine Schritte.</div>}
      <AblaufLageHinweis ablauf={ablauf} />
    </Karte>
  );
}
