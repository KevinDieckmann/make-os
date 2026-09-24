'use client';

// Übersicht — Malins Leitfrage: Wo stehen wir, wo sollten wir stehen, und was
// ist die wichtigste Entscheidung diese Woche? Kennzahlen des jüngsten Monats
// MIT Daten (nicht des laufenden — sonst stehen bei Rückstand überall Nullen).

import { useMemo } from 'react';
import { FARBE as C } from '@/lib/make-one/design';
import { eur } from '@/lib/finanzen/haushalt/typen';
import { summen, einordnen, istAusgabe, type KatName } from '@/lib/finanzen/haushalt/einordnung';
import { letzterMonatMitDaten, wichtig, offeneBelege } from '@/lib/finanzen/haushalt/kennzahlen';
import { monatVon, monatPlus, monatName, datumDe, heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Punkt, Spalten, Spalte, LEUCHT } from '../schlank';
import { Betrag, Kachel, Kacheln, Hinweis, type HaushaltDaten } from './gemeinsam';

function vergleich(jetzt: number, vorher: number, mehrIstGut: boolean) {
  if (!vorher) return <span style={{ color: C.inkLeise }}>kein Vormonat zum Vergleich</span>;
  const pct = Math.round((jetzt - vorher) / Math.abs(vorher) * 100);
  const gut = mehrIstGut ? jetzt >= vorher : jetzt <= vorher;
  return <span style={{ color: gut ? LEUCHT.gut : LEUCHT.kritisch }}>{pct >= 0 ? '+' : ''}{pct} % zum Vormonat</span>;
}

export function Uebersicht({ h, katName }: { h: HaushaltDaten; katName: KatName }) {
  const heute = heuteBerlin();
  const m = letzterMonatMitDaten(h.buchungen, heute);
  const vm = monatPlus(m, -1);
  const d = useMemo(() => summen(h.buchungen.filter(b => monatVon(b.datum) === m), katName), [h.buchungen, m, katName]);
  const v = useMemo(() => summen(h.buchungen.filter(b => monatVon(b.datum) === vm), katName), [h.buchungen, vm, katName]);
  const rechnungen = offeneBelege(h.belege, 'rechnung', 'privat');
  const nochZuZahlen = rechnungen.reduce((s, b) => s + (b.betrag ?? 0), 0);
  const rest = h.schulden.filter(s => s.einheit === 'privat').reduce((s, x) => s + x.restbetrag, 0);
  const rate = h.schulden.filter(s => s.einheit === 'privat').reduce((s, x) => s + (x.rate ?? 0), 0);
  const punkte = useMemo(() => wichtig({ buchungen: h.buchungen, schulden: h.schulden.filter(s => s.einheit === 'privat'), belege: h.belege.filter(b => b.einheit === 'privat') }, katName, heute, c => eur(c)), [h, katName, heute]);
  const top = useMemo(() => h.buchungen.filter(b => monatVon(b.datum) === m && istAusgabe(einordnen(b, katName))).sort((a, b) => a.betrag - b.betrag).slice(0, 8), [h.buchungen, m, katName]);
  const konto = (id: string) => h.stamm.konten.find(k => k.id === id)?.name.replace(/^Privatkonto /, '') ?? '–';

  return (
    <>
      <Karte i={1} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld} rechts={m !== monatVon(heute) ? `jüngster Monat mit Buchungen` : 'laufender Monat'}>{monatName(m)}</Ueberschrift>
        <Kacheln>
          <Kachel titel="Einnahmen" wert={eur(d.ein)} farbe={LEUCHT.gut} zusatz={vergleich(d.ein, v.ein, true)} />
          <Kachel titel="Ausgaben" wert={eur(d.aus)} farbe={LEUCHT.achtung} zusatz={vergleich(d.aus, v.aus, false)} />
          <Kachel titel="Saldo" wert={eur(d.saldo)} farbe={d.saldo >= 0 ? LEUCHT.gut : LEUCHT.kritisch} zusatz={d.saldo >= 0 ? 'im Plus' : 'im Minus'} />
          <Kachel titel="Noch zu zahlen" wert={eur(nochZuZahlen)} zusatz={`${rechnungen.length} offene Rechnung${rechnungen.length === 1 ? '' : 'en'}`} />
          <Kachel titel="Restschuld" wert={eur(rest)} zusatz={`${eur(rate)} pro Monat`} />
        </Kacheln>
        {(d.geliehen > 0 || d.durchlauf > 0) && (
          <Hinweis>
            {d.geliehen > 0 && <>Nicht als Einnahme gezählt: <strong>{eur(d.geliehen)}</strong> geliehen (steht unter Schulden). </>}
            {d.durchlauf > 0 && <><strong>{eur(d.durchlauf)}</strong> durchlaufend — ausgelegt und zurückgekommen, kein Einkommen.</>}
          </Hinweis>
        )}
      </Karte>
      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={2} akzent={punkte.some(p => p.dringend) ? LEUCHT.kritisch : undefined}>
            <Ueberschrift farbe={LEUCHT.achtung}>Wichtig diese Woche</Ueberschrift>
            <Liste>
              {!punkte.length && <Leer>Nichts Dringendes. Alles läuft.</Leer>}
              {punkte.slice(0, 8).map((p, i) => <Zeile key={i} links={<Punkt farbe={p.dringend ? LEUCHT.kritisch : LEUCHT.achtung} />} titel={<span style={{ whiteSpace: 'normal' }}>{p.text}</span>} />)}
            </Liste>
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={3}>
            <Ueberschrift farbe={LEUCHT.puls}>Größte Ausgaben im {monatName(m, false)}</Ueberschrift>
            <Liste>
              {!top.length && <Leer>Für diesen Monat liegen noch keine Ausgaben vor.</Leer>}
              {top.map(b => <Zeile key={b.id} titel={b.empfaenger || b.beschreibung} unter={`${datumDe(b.datum)} · ${konto(b.konto_id)} · ${katName(b.kategorie_id) || 'offen'}`} rechts={<Betrag cent={b.betrag} />} />)}
            </Liste>
          </Karte>
        </Spalte>
      </Spalten>
    </>
  );
}
