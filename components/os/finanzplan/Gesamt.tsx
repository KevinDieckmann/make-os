'use client';

// ─── Finanzplanung jetzt — Gesamt: Privat · MAKE · KD Ventures · Selbstständigkeit ──
// Kevin 27.09.: „Privat + Business getrennt, oben Gesamt“ — mit den Übergängen
// (Gehalt MAKE → Privat netto, Ausschüttung), dem Mindestumsatz der MAKE Innovation GmbH
// (Kennung ug, Name aus lib/einheiten.ts) und der
// Steuerrücklage (Hinweis, keine Steuerberatung). Alle Zahlen aus dem Kern
// über den Arbeitsplan; das Blatt zeigt je Monat, wie die vier Einheiten
// zusammenhängen.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../schlank';
import { rechneSelbst } from '@/lib/finanzen/rechenkern';
import { monatLabel } from '@/lib/finanzen/plan/hilfen';
import { UG_NAME, UG_KURZ } from '@/lib/einheiten';
import { STEUER_HINWEIS } from '@/lib/finanzen/szenarien';
import { usePlan } from './daten';
import { Geld, Kachel, Kacheln, Etikett, Hinweis, Legende, KUPFER, LILA } from './teile';
import { Blatt, type BlattZeile } from './Blatt';
import { Linie } from './diagramme';

export function Gesamt() {
  const { d, ug, pr, aw, ps, sz } = usePlan();
  const U = (m: number) => ug[m - 1], P = (m: number) => pr[m - 1];
  const selbst = rechneSelbst(d);
  const m0 = aw.m0;
  const kosten = (m: number) => U(m).kevin + U(m).malin + U(m).unterstuetzung + U(m).stellen + U(m).sach + U(m).holding;
  const zeilen: BlattZeile[] = [
    { grp: 'Privat' },
    { name: `Gehälter netto (aus der ${UG_NAME})`, get: m => P(m).kevinNetto + P(m).malinNetto, ind: true },
    { name: `Ausschüttung aus der ${UG_NAME} (netto)`, get: m => P(m).ausschuettung, ind: true },
    { name: 'Weitere Einnahmen & Bausteine', get: m => P(m).einnahmenWeitere + P(m).bausteineEin, ind: true },
    { name: 'Bedarf, Schulden, Ereignisse', get: m => -(P(m).bedarf + P(m).schulden + P(m).ereignisse + P(m).bausteineAus), ind: true },
    { name: 'Luft je Monat', sum: true, get: m => P(m).luft },
    { name: 'Angespart', stock: true, key: true, get: m => P(m).angespart },
    { grp: `Übergänge ${UG_KURZ} → Privat` },
    { name: 'Gehälter brutto', get: m => U(m).kevinBrutto + U(m).malinBrutto, ind: true },
    { name: 'davon Arbeitgeberanteil', get: m => U(m).kevin + U(m).malin - U(m).kevinBrutto - U(m).malinBrutto, ind: true },
    { name: 'Ausschüttung brutto', get: m => U(m).ausschuettung, ind: true },
    { name: 'davon Steuer, pauschal (Näherung)', get: m => -P(m).ausschuettungSteuer, ind: true },
    { name: 'Ausschüttung netto an Privat', get: m => P(m).ausschuettung, ind: true },
    { grp: UG_NAME },
    { name: 'Umsatz netto', get: m => U(m).umsatz, ind: true },
    { name: 'Mindestumsatz (laufende Kosten)', get: m => kosten(m), ind: true },
    { name: 'Gewinn', sum: true, get: m => U(m).gewinn },
    { name: 'Steuerrücklage', stock: true, get: m => -U(m).steuerRuecklage, ind: true },
    { name: 'USt offen', stock: true, get: m => -U(m).ustOffen, ind: true },
    { name: 'Kontostand', stock: true, get: m => U(m).konto },
    { name: 'Frei verfügbar', stock: true, key: true, get: m => U(m).frei },
    { grp: 'KD Ventures' },
    { name: 'Kontostand KD Ventures', stock: true, key: true, get: m => U(m).kdvKonto },
    { name: 'Partnerdarlehen offen', stock: true, get: m => -U(m).bjoernRest, ind: true },
    { grp: 'Gesamt' },
    { name: `Frei ${UG_KURZ} + KD Ventures + Privat angespart`, stock: true, sum: true, key: true, get: m => U(m).frei + U(m).kdvKonto + P(m).angespart },
  ];
  const deckung = aw.mindestumsatz.schnitt12 > 0 ? aw.mindestumsatz.umsatzSchnitt12 / aw.mindestumsatz.schnitt12 : 1;
  return (
    <>
      <Kacheln min={170}>
        <Kachel label="Frei verfügbar jetzt" wert={<><Geld v={aw.frei.gesamt} /> €</>} unter={<>{UG_KURZ} <Geld v={aw.frei.ug} farbe={C.inkDim} /> · KDV <Geld v={aw.frei.kdv} farbe={C.inkDim} /> · Privat <Geld v={aw.frei.privat} farbe={C.inkDim} /></>} />
        <Kachel label={`Mindestumsatz ${UG_KURZ} je Monat`} punkt={deckung >= 1 ? LEUCHT.gut : deckung >= 0.8 ? LEUCHT.achtung : LEUCHT.kritisch} wert={<><Geld v={aw.mindestumsatz.schnitt12} /> €</>} unter={<>Ø 12 Monate · Umsatz Ø <Geld v={aw.mindestumsatz.umsatzSchnitt12} farbe={C.inkDim} /> € · Deckung {Math.round(deckung * 100)} %</>} />
        <Kachel label={`Steuerrücklage ${UG_KURZ} jetzt`} punkt={LEUCHT.achtung} wert={<><Geld v={aw.steuer.ruecklage} /> €</>} unter={<>{aw.steuer.naechsteZahlung ? <>nächste Zahlung {monatLabel(d, aw.steuer.naechsteZahlung.monat)}: <Geld v={aw.steuer.naechsteZahlung.betrag} farbe={C.inkDim} /> €</> : 'keine Zahlung im Planzeitraum'}{aw.steuer.ausschuettung ? <> · Steuer auf Ausschüttung <Geld v={aw.steuer.ausschuettung} farbe={C.inkDim} /> €/M</> : null}</>} />
        <Kachel label="USt offen" wert={<><Geld v={aw.steuer.ust} /> €</>} unter="geht im Folgemonat ans Finanzamt" />
        <Kachel label={`Gehälter ${UG_KURZ} → Privat`} wert={<><Geld v={aw.uebergaenge.gehaelterNetto} /> €</>} unter={<>netto je Monat · brutto <Geld v={aw.uebergaenge.gehaelterBrutto} farbe={C.inkDim} /> €</>} />
        <Kachel label={`Ausschüttung ${UG_KURZ} → Privat`} wert={<><Geld v={aw.uebergaenge.ausschuettungNetto} /> €</>} unter={aw.uebergaenge.ausschuettung ? <>netto je Monat · brutto <Geld v={aw.uebergaenge.ausschuettung} farbe={C.inkDim} /> € · Steuer pauschal <Geld v={aw.uebergaenge.ausschuettungSteuer} farbe={C.inkDim} /> €</> : 'keine im Szenario'} />
        <Kachel label="Selbstständigkeit 2026" wert={<><Geld v={selbst.frei} /> €</>} unter={<>frei nach Abschluss · Steuer <Geld v={selbst.est} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <Karte i={0}>
        <Ueberschrift rechts={<Legende eintraege={[{ farbe: KUPFER, text: `${UG_KURZ} frei` }, { farbe: LEUCHT.puls, text: 'KD Ventures' }, { farbe: LILA, text: 'Privat angespart' }, { farbe: C.ink, text: 'Gesamt' }]} />}>Gesamt — {ps ? `Arbeitsplan „${ps.name}“` : `Treiber „${sz.name}“`}</Ueberschrift>
        <Linie labels={d.monate} tick={3} hoehe={240} heute={m0 - 1} serien={[
          { name: `${UG_KURZ} frei`, farbe: KUPFER, werte: ug.map(u => u.frei), breite: 2.2 },
          { name: 'KD Ventures', farbe: LEUCHT.puls, werte: ug.map(u => u.kdvKonto), breite: 1.4 },
          { name: 'Privat angespart', farbe: LILA, werte: pr.map(p => p.angespart), breite: 1.8 },
          { name: 'Gesamt', farbe: C.ink, werte: ug.map((u, i) => u.frei + u.kdvKonto + pr[i].angespart), gestrichelt: true, breite: 1.4 },
        ]} />
      </Karte>
      <Karte i={1}>
        <Blatt zeilen={zeilen} titel="Gesamt je Monat" werkzeuge={<span style={{ display: 'inline-flex', gap: 6 }}><Etikett einheit="privat" /><Etikett einheit="ug" /><Etikett einheit="kdv" /></span>} />
        <Hinweis>Privat und Business bleiben getrennt gerechnet; die Übergänge (Gehalt brutto → netto, Ausschüttung) sind die einzigen Brücken. Mindestumsatz = Personal inkl. Stellen + Sachkosten + Holding je Monat. {STEUER_HINWEIS}</Hinweis>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Selbstständigkeit 2026 hat keine Monatsachse — ihr Abschluss steht unter Business › Selbstständigkeit.</div>
      </Karte>
    </>
  );
}
