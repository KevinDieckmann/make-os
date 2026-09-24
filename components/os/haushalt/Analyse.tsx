'use client';

// Analyse — die anderen Reiter beantworten „was war“, dieser „wie entwickelt
// es sich“. Einzelne Monate schwanken zu stark; erst über sechs oder zwölf
// volle Monate zeigt sich, was der Fall ist. Verglichen wird mit dem gleich
// langen Zeitraum davor. Der laufende Monat bleibt draußen.

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import type { KatName } from '@/lib/finanzen/haushalt/einordnung';
import { kennzahlen, schuldenbild, bewertungSparquote } from '@/lib/finanzen/haushalt/kennzahlen';
import { vollMonate, monatKurz, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Leer, Segmente, Spalten, Spalte, LEUCHT } from '../schlank';
import { Hinweis, Kachel, Kacheln, Leiste, type HaushaltDaten } from './gemeinsam';

type Zeitraum = '1' | '6' | '12';
const ZEITRAEUME: { id: Zeitraum; label: string }[] = [{ id: '1', label: 'Letzter Monat' }, { id: '6', label: '6 Monate' }, { id: '12', label: '12 Monate' }];

function pfeil(jetzt: number, vorher: number, hochIstGut: boolean) {
  if (!vorher) return <span style={{ color: C.inkLeise }}>kein Vergleich</span>;
  const d = (jetzt - vorher) / Math.abs(vorher) * 100;
  if (Math.abs(d) < 1) return <span style={{ color: C.inkLeise }}>unverändert</span>;
  const gut = hochIstGut ? d > 0 : d < 0;
  return <span style={{ color: gut ? LEUCHT.gut : LEUCHT.kritisch }}>{d > 0 ? '+' : ''}{d.toFixed(0)} % zum Zeitraum davor</span>;
}

export function Analyse({ h, katName }: { h: HaushaltDaten; katName: KatName }) {
  const [z, setZ] = useState<Zeitraum>('6');
  const heute = heuteBerlin();
  const n = Number(z);
  const monate = useMemo(() => vollMonate(n, 0, heute), [n, heute]);
  const vorher = useMemo(() => vollMonate(n, n, heute), [n, heute]);
  const privat = useMemo(() => h.buchungen.filter(b => b.einheit === 'privat'), [h.buchungen]);
  const schulden = h.schulden.filter(s => s.einheit === 'privat');
  const k = useMemo(() => kennzahlen(privat, monate, katName), [privat, monate, katName]);
  const v = useMemo(() => kennzahlen(privat, vorher, katName), [privat, vorher, katName]);
  const s = useMemo(() => schuldenbild(privat, schulden, monate, katName), [privat, schulden, monate, katName]);
  const verlauf = useMemo(() => monate.slice().reverse().map(m => ({ m, ...kennzahlen(privat, [m], katName) })), [privat, monate, katName]);
  const maxV = Math.max(1, ...verlauf.map(r => Math.max(r.ein, r.aus)));
  const bew = bewertungSparquote(k.sparquote);
  const fixAnteil = k.aus > 0 ? k.ausFix / k.aus * 100 : 0;
  const aufbau = k.saldo + s.getilgt;

  return (
    <>
      <Karte i={1}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Ueberschrift farbe={LEUCHT.puls}>Analyse · {monatKurz(monate[monate.length - 1])} bis {monatKurz(monate[0])}</Ueberschrift>
          <Segmente liste={ZEITRAEUME} aktiv={z} onWahl={setZ} />
        </div>
        <Hinweis>Gerechnet über volle Monate. Der laufende Monat bleibt draußen — er ist noch nicht zu Ende und würde jeden Durchschnitt verfälschen. Verglichen wird mit dem gleich langen Zeitraum davor.</Hinweis>
      </Karte>
      {k.anzahl === 0 ? <Karte i={2}><Leer>Für diesen Zeitraum liegen keine Buchungen vor. Lies Kontoauszüge ein oder wähle einen längeren Zeitraum.</Leer></Karte> : (
        <>
          <Karte i={2} akzent={bew.stufe === 'rot' ? LEUCHT.kritisch : LEUCHT.gut}>
            <Kacheln>
              <Kachel titel="Einnahmen Ø/Monat" wert={eur(k.einProMonat)} farbe={LEUCHT.gut} zusatz={pfeil(k.einProMonat, v.einProMonat, true)} />
              <Kachel titel="Ausgaben Ø/Monat" wert={eur(k.ausProMonat)} farbe={LEUCHT.achtung} zusatz={pfeil(k.ausProMonat, v.ausProMonat, false)} />
              <Kachel titel="Überschuss Ø/Monat" wert={eur(k.saldoProMonat)} farbe={k.saldoProMonat >= 0 ? LEUCHT.gut : LEUCHT.kritisch} zusatz={k.saldoProMonat >= 0 ? 'bleibt übrig' : 'fehlt jeden Monat'} />
              <Kachel titel="Sparquote" wert={`${k.sparquote.toFixed(0)} %`} farbe={bew.stufe === 'rot' ? LEUCHT.kritisch : bew.stufe === 'gelb' ? LEUCHT.achtung : LEUCHT.gut} zusatz={bew.text} />
            </Kacheln>
            <Hinweis>Die Einordnung der Sparquote folgt Faustregeln aus der Haushaltsplanung (unter 10 % wenig Puffer, ab 20 % sehr gut) — keine Wahrheit. Einkommen heißt hier: ohne Kredite, ohne zurückgeflossenes Geld, ohne Umbuchungen.</Hinweis>
          </Karte>
          <Spalten verhaeltnis="1:1">
            <Spalte>
              <Karte i={3}>
                <Ueberschrift>Feste und bewegliche Kosten</Ueberschrift>
                {[{ n: 'Fixkosten', w: k.fixProMonat, a: fixAnteil, vw: v.fixProMonat, f: LEUCHT.kritisch }, { n: 'Variable Kosten', w: k.varProMonat, a: 100 - fixAnteil, vw: v.varProMonat, f: LEUCHT.puls }].map(r => (
                  <div key={r.n} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 12 }}>
                    <div><strong style={{ fontSize: TYP.body }}>{r.n}</strong> <span style={{ color: C.inkLeise, fontSize: 12 }}>{r.a.toFixed(0)} %</span><Leiste anteil={r.a} farbe={r.f} /></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{eur(r.w)}</div><div style={{ fontSize: 12, color: C.inkLeise }}>davor {eur(r.vw)}</div></div>
                  </div>
                ))}
                <Hinweis>Fixkosten sind der Teil, den ihr kurzfristig nicht ändern könnt. Je höher ihr Anteil, desto weniger Spielraum, wenn etwas dazwischenkommt. Aktuell binden sie <strong style={{ color: C.ink }}>{k.fixquote.toFixed(0)} %</strong> eurer Einnahmen.</Hinweis>
              </Karte>
              <Karte i={5}>
                <Ueberschrift farbe={LEUCHT.kritisch}>Schulden</Ueberschrift>
                {!schulden.length ? <Leer>Keine Verbindlichkeiten erfasst.</Leer> : (
                  <>
                    <Kacheln>
                      <Kachel titel="Restschuld heute" wert={eur(s.rest)} zusatz={s.start ? `${s.abgebaut.toFixed(0)} % bereits abgebaut` : undefined} />
                      <Kachel titel="Getilgt im Zeitraum" wert={eur(s.getilgt)} zusatz={`${eur(s.proMonat)} pro Monat`} />
                      <Kachel titel="Vereinbarte Rate" wert={eur(s.rate)} zusatz="pro Monat" />
                    </Kacheln>
                    <div style={{ marginTop: 12, fontSize: TYP.body }}>
                      {s.restMonate ? <>Bei diesem Tempo seid ihr in <strong>{s.restMonate} Monaten</strong> schuldenfrei{s.restMonate > 12 ? ` — das sind gut ${Math.round(s.restMonate / 12)} Jahre.` : '.'}</> : <span style={{ color: LEUCHT.achtung }}>In diesem Zeitraum wurde nichts getilgt, deshalb gibt es keine Prognose.</span>}
                    </div>
                    {s.proMonat > 0 && k.saldoProMonat > s.proMonat && <Hinweis>Euer Überschuss liegt bei {eur(k.saldoProMonat)} im Monat, getilgt werden {eur(s.proMonat)}. Mehr Tilgung wäre rechnerisch möglich — ob sinnvoll, hängt vom Zinssatz ab und davon, ob ein Notgroschen steht.</Hinweis>}
                  </>
                )}
              </Karte>
            </Spalte>
            <Spalte>
              <Karte i={4}>
                <Ueberschrift>Monat für Monat</Ueberschrift>
                <div style={{ display: 'grid', gap: 10 }}>
                  {verlauf.map(r => (
                    <div key={r.m} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 96px', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: C.inkDim }}>{monatKurz(r.m)}</span>
                      <div>
                        <div title={`Einnahmen ${eur(r.ein)}`} style={{ height: 6, borderRadius: 3, width: `${r.ein / maxV * 100}%`, background: LEUCHT.gut, marginBottom: 3 }} />
                        <div title={`Ausgaben ${eur(r.aus)}`} style={{ height: 6, borderRadius: 3, width: `${r.aus / maxV * 100}%`, background: LEUCHT.achtung }} />
                      </div>
                      <span style={{ textAlign: 'right', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13.5, fontVariantNumeric: 'tabular-nums', color: r.saldo >= 0 ? LEUCHT.gut : LEUCHT.kritisch }}>{r.saldo >= 0 ? '+' : ''}{eur(r.saldo)}</span>
                    </div>
                  ))}
                </div>
                <Hinweis>Grün ist rein, gelb ist raus, rechts der Saldo. Ein einzelner Monat im Minus ist normal — auffällig wird es, wenn mehrere hintereinander im Minus stehen.</Hinweis>
              </Karte>
              <Karte i={6}>
                <Ueberschrift farbe={LEUCHT.geld}>Vermögensaufbau</Ueberschrift>
                <Kacheln>
                  <Kachel titel="Nicht ausgegeben" wert={eur(k.saldo)} zusatz="Einnahmen minus Ausgaben" />
                  <Kachel titel="Schulden getilgt" wert={eur(s.getilgt)} zusatz="zählt genauso" />
                  <Kachel titel="Zusammen" wert={eur(aufbau)} farbe={aufbau >= 0 ? LEUCHT.gut : LEUCHT.kritisch} zusatz={aufbau >= 0 ? `in ${k.monate} Monat${k.monate === 1 ? '' : 'en'}` : 'Vermögen abgebaut'} />
                </Kacheln>
                <Hinweis>Jeder getilgte Euro macht genauso reicher wie ein gesparter — nur dass ihr obendrein Zinsen spart. <strong style={{ color: C.inkDim }}>Nicht enthalten sind Kontostände, Depotwerte und alles außerhalb dieser Konten</strong> — gemessen wird nur, was sich durch eure Buchungen verändert hat. Das ist nicht euer Gesamtvermögen.</Hinweis>
              </Karte>
            </Spalte>
          </Spalten>
        </>
      )}
    </>
  );
}
