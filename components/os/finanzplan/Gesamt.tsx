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
import { monatLabel, prozent } from '@/lib/finanzen/plan/hilfen';
import { UG_NAME, UG_KURZ, finanzOrtName } from '@/lib/einheiten';
import { STEUER_HINWEIS, AUSSCHUETTUNG_STEUER_VORGABE } from '@/lib/finanzen/szenarien';
import { zeigeSteuer } from '@/lib/finanzen/steuern';
import { usePlan } from './daten';
import { useArbeitsplan } from './arbeitsplan';
import { Geld, Kachel, Kacheln, Etikett, Hinweis, Legende, ZahlFeld, MonatWahl, personName, KUPFER, LILA } from './teile';
import { Blatt, type BlattZeile, type DatenZeile } from './Blatt';
import { Linie } from './diagramme';
import { FeldK } from './Annahmen';
import { ProzentFeld } from './Steuern';
import { EntnahmeFelder } from './Entnahme';

/** Übergänge von der Gesellschaft nach Privat einstellen: Gehälter, Ausschüttung, Steuer darauf — an der Stelle, die gerade gilt (Arbeitsplan, sonst Plan). */
function UebergaengeKarte() {
  const { d, aw, aendere } = usePlan();
  const { ps, schreibe } = useArbeitsplan();
  const p1 = personName('kevin'), p2 = personName('malin');
  const gehalt = (k: 'kevinBrutto' | 'malinBrutto', name: string) => {
    const imPlan = ps?.annahmen[k] !== undefined;
    const v = ps?.annahmen[k] ?? d.annahmen[k];
    return (
      <FeldK label={`${name} brutto je Monat${imPlan ? ' (Arbeitsplan)' : ''}`} breit={170}>
        <ZahlFeld wert={v} dezimal={0} breite="100%" titel={`${name} brutto`} onFertig={x => {
          const neu = x ?? 0;
          if (imPlan && ps) void aendere([{ pfad: `/planszenarien/id=${ps.id}/annahmen/${k}`, alt: v, neu }], `${name} brutto (Arbeitsplan)`);
          else void aendere([{ pfad: `/annahmen/${k}`, alt: v, neu }], `${name} brutto`);
        }} />
      </FeldK>
    );
  };
  const au = ps?.annahmen.ausschuettung;
  const setzeAu = (neu: { betrag: number; ab: number } | undefined) => void schreibe(id => [{ pfad: `/planszenarien/id=${id}/annahmen/ausschuettung`, alt: au, ...(neu ? { neu } : {}) }], 'Ausschüttung');
  return (
    <Karte i={2}>
      <Ueberschrift>Übergänge einstellen — {UG_KURZ} → Privat</Ueberschrift>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {gehalt('kevinBrutto', p1)}{gehalt('malinBrutto', p2)}
        <FeldK label="Ausschüttung je Monat (brutto)" breit={170}><ZahlFeld wert={au?.betrag ?? null} leer platzhalter="keine" dezimal={0} breite="100%" titel="Ausschüttung je Monat" onFertig={v => setzeAu(v ? { betrag: v, ab: au?.ab ?? aw.m0 } : undefined)} /></FeldK>
        <FeldK label="Ausschüttung ab" breit={150}><MonatWahl wert={au?.ab ?? aw.m0} onWahl={m => setzeAu({ betrag: au?.betrag ?? 0, ab: m })} monate={d.monate} breite={150} /></FeldK>
        <FeldK label={`Steuer darauf, pauschal (Vorgabe ${prozent(AUSSCHUETTUNG_STEUER_VORGABE, 1)})`} breit={190}><ProzentFeld wert={ps?.annahmen.ausschuettungSteuer ?? null} leer platzhalter={String(Number((AUSSCHUETTUNG_STEUER_VORGABE * 100).toFixed(4))).replace('.', ',')} dezimal={3} breite="100%" titel="Steuer auf die Ausschüttung" onFertig={v => void schreibe(id => [{ pfad: `/planszenarien/id=${id}/annahmen/ausschuettungSteuer`, alt: ps?.annahmen.ausschuettungSteuer, ...(v == null ? {} : { neu: Math.max(0, Math.min(1, v)) }) }], 'Steuer auf die Ausschüttung')} /></FeldK>
      </div>
      <div style={{ marginTop: 14, fontSize: TYP.bedien, color: C.inkDim }}>Entnahme der Selbstständigkeit → Privat</div>
      <EntnahmeFelder />
      <Hinweis>Gehälter stehen im Plan; hat der Arbeitsplan eigene Werte, gelten und ändern sich diese. Ausschüttung, Entnahme und ihre Steuer gehören zum Arbeitsplan (ohne Arbeitsplan legt der erste Eintrag einen an). Die Entnahme ist schon versteuert, keine weitere Steuer. {STEUER_HINWEIS}</Hinweis>
    </Karte>
  );
}

export function Gesamt() {
  const { d, ug, kdc, pr, aw, ps, sz } = usePlan();
  const ertragAn = zeigeSteuer(d, 'ug', 'kst') || zeigeSteuer(d, 'ug', 'est');
  const ustAn = zeigeSteuer(d, 'ug', 'ust');
  const U = (m: number) => ug[m - 1], P = (m: number) => pr[m - 1], K = (m: number) => kdc[m - 1];
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
    { name: 'Ausschüttung brutto', get: m => U(m).ausschuettung, ind: true, optional: true },
    { name: 'davon Steuer, pauschal (Näherung)', get: m => -P(m).ausschuettungSteuer, ind: true, optional: true },
    { name: 'Ausschüttung netto an Privat', get: m => P(m).ausschuettung, ind: true, optional: true },
    { name: 'Entnahme aus der Selbstständigkeit (schon versteuert)', get: m => P(m).entnahme, ind: true, optional: true },
    { grp: UG_NAME },
    { name: 'Umsatz netto', get: m => U(m).umsatz, ind: true },
    { name: 'Mindestumsatz (laufende Kosten)', get: m => kosten(m), ind: true },
    { name: 'Gewinn', sum: true, get: m => U(m).gewinn },
    { name: 'Kontostand', stock: true, get: m => U(m).konto },
    { name: 'Frei verfügbar', stock: true, key: true, get: m => U(m).frei },
    ...(ertragAn || ustAn ? [
      { grp: 'Steuern (Näherung)', zu: true, leerName: ['weitere Steuerzeile', 'weitere Steuerzeilen'] } as BlattZeile,
      ...(ertragAn ? [{ name: 'Steuerrücklage', stock: true, sum: true, get: (m: number) => -U(m).steuerRuecklage } as DatenZeile] : []),
      ...(ertragAn ? [{ name: 'Ertragsteuer-Zahlung', get: (m: number) => -U(m).steuer, ind: true, optional: true } as DatenZeile] : []),
      ...(ertragAn ? [{ name: 'Verlustvortrag zu Jahresbeginn', stock: true, get: (m: number) => U(m).st.verlustvortrag, ind: true, optional: true } as DatenZeile] : []),
      ...(ustAn ? [{ name: 'USt offen (Durchlauf)', stock: true, get: (m: number) => -U(m).ustOffen, ind: true, optional: true } as DatenZeile] : []),
    ] : []),
    { grp: 'KD Ventures' },
    { name: 'Kontostand KD Ventures', stock: true, get: m => U(m).kdvKonto },
    { name: 'Ertragsteuer-Rücklage KD Ventures', stock: true, get: m => -U(m).kdvSt.ruecklage, ind: true, optional: true },
    { name: 'Frei verfügbar KD Ventures', stock: true, key: true, get: m => U(m).kdvFrei },
    { name: 'Partnerdarlehen offen', stock: true, get: m => -U(m).bjoernRest, ind: true },
    { grp: finanzOrtName('kdc') },
    { name: 'Umsatz netto Selbstständigkeit', get: m => K(m).umsatz, ind: true },
    { name: 'Kosten Selbstständigkeit', get: m => -K(m).kosten, ind: true },
    { name: 'Ergebnis vor Steuern Selbstständigkeit', sum: true, get: m => K(m).gewinn },
    { name: 'Einkommen- und Gewerbesteuer (Aufwand)', get: m => -K(m).st.summe, ind: true, optional: true },
    { name: 'Entnahme an Privat', get: m => -K(m).entnahme, ind: true, optional: true },
    { name: 'Kontostand Selbstständigkeit', stock: true, get: m => K(m).konto },
    { name: 'Frei verfügbar Selbstständigkeit', stock: true, key: true, get: m => K(m).frei },
    { grp: 'Gesamt' },
    { name: `Frei ${UG_KURZ} + KD Ventures + Selbstständigkeit + Privat angespart`, stock: true, sum: true, key: true, get: m => U(m).frei + U(m).kdvFrei + K(m).frei + P(m).angespart },
  ];
  const deckung = aw.mindestumsatz.schnitt12 > 0 ? aw.mindestumsatz.umsatzSchnitt12 / aw.mindestumsatz.schnitt12 : 1;
  return (
    <>
      <Kacheln min={170}>
        <Kachel label="Frei verfügbar jetzt" wert={<><Geld v={aw.frei.gesamt} /> €</>} unter={<>{UG_KURZ} <Geld v={aw.frei.ug} farbe={C.inkDim} /> · KDV <Geld v={aw.frei.kdv} farbe={C.inkDim} /> · Selbst. <Geld v={aw.frei.kdc} farbe={C.inkDim} /> · Privat <Geld v={aw.frei.privat} farbe={C.inkDim} /></>} />
        <Kachel label={`Mindestumsatz ${UG_KURZ} je Monat`} punkt={deckung >= 1 ? LEUCHT.gut : deckung >= 0.8 ? LEUCHT.achtung : LEUCHT.kritisch} wert={<><Geld v={aw.mindestumsatz.schnitt12} /> €</>} unter={<>Ø 12 Monate · Umsatz Ø <Geld v={aw.mindestumsatz.umsatzSchnitt12} farbe={C.inkDim} /> € · Deckung {Math.round(deckung * 100)} %</>} />
        {(ertragAn || ustAn) && <Kachel label="Steuerrücklage jetzt" punkt={LEUCHT.achtung} wert={<><Geld v={aw.steuer.ruecklageGesamt} /> €</>} unter={<><>{UG_KURZ} <Geld v={aw.steuer.ruecklage} farbe={C.inkDim} /> · KDV <Geld v={aw.steuer.ruecklageKdv} farbe={C.inkDim} /> · Selbst. <Geld v={aw.steuer.ruecklageKdc} farbe={C.inkDim} /> · </>{aw.steuer.naechsteZahlung ? <>nächste Zahlung {monatLabel(d, aw.steuer.naechsteZahlung.monat)}: <Geld v={aw.steuer.naechsteZahlung.betrag} farbe={C.inkDim} /> €</> : 'keine Zahlung im Planzeitraum'}{ustAn && aw.steuer.ust ? <> · USt im Durchlauf <Geld v={aw.steuer.ust} farbe={C.inkDim} /> €</> : null}</>} />}
        <Kachel label={`Gehälter ${UG_KURZ} → Privat`} wert={<><Geld v={aw.uebergaenge.gehaelterNetto} /> €</>} unter={<>netto je Monat · brutto <Geld v={aw.uebergaenge.gehaelterBrutto} farbe={C.inkDim} /> €</>} />
        <Kachel label={`Ausschüttung ${UG_KURZ} → Privat`} wert={<><Geld v={aw.uebergaenge.ausschuettungNetto} /> €</>} unter={aw.uebergaenge.ausschuettung ? <>netto je Monat · brutto <Geld v={aw.uebergaenge.ausschuettung} farbe={C.inkDim} /> € · Steuer pauschal <Geld v={aw.uebergaenge.ausschuettungSteuer} farbe={C.inkDim} /> €</> : 'keine im Szenario'} />
 {aw.uebergaenge.entnahme > 0 && <Kachel label="Entnahme Selbstständigkeit → Privat" wert={<><Geld v={aw.uebergaenge.entnahme} /> €</>} unter="je Monat, schon versteuert" />}
        <Kachel label="Selbstständigkeit 2026" wert={<><Geld v={selbst.frei} /> €</>} unter={<>frei nach Abschluss · Steuer <Geld v={selbst.est} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <Karte i={0}>
        <Ueberschrift rechts={<Legende eintraege={[{ farbe: KUPFER, text: `${UG_KURZ} frei` }, { farbe: LEUCHT.puls, text: 'KD Ventures' }, { farbe: LEUCHT.achtung, text: 'Selbstständigkeit' }, { farbe: LILA, text: 'Privat angespart' }, { farbe: C.ink, text: 'Gesamt' }]} />}>Gesamt — {ps ? `Arbeitsplan „${ps.name}“` : `Treiber „${sz.name}“`}</Ueberschrift>
        <Linie labels={d.monate} tick={3} hoehe={240} heute={m0 - 1} serien={[
          { name: `${UG_KURZ} frei`, farbe: KUPFER, werte: ug.map(u => u.frei), breite: 2.2 },
          { name: 'KD Ventures', farbe: LEUCHT.puls, werte: ug.map(u => u.kdvFrei), breite: 1.4 },
          { name: 'Selbstständigkeit', farbe: LEUCHT.achtung, werte: kdc.map(k => k.frei), breite: 1.4 },
          { name: 'Privat angespart', farbe: LILA, werte: pr.map(p => p.angespart), breite: 1.8 },
          { name: 'Gesamt', farbe: C.ink, werte: ug.map((u, i) => u.frei + u.kdvFrei + kdc[i].frei + pr[i].angespart), gestrichelt: true, breite: 1.4 },
        ]} />
      </Karte>
      <UebergaengeKarte />
      <Karte i={1}>
        <Blatt zeilen={zeilen} titel="Gesamt je Monat" werkzeuge={<span style={{ display: 'inline-flex', gap: 6 }}><Etikett einheit="privat" /><Etikett einheit="ug" /><Etikett einheit="kdv" /><Etikett einheit="selbststaendigkeit" /></span>} />
        <Hinweis>Privat und Business bleiben getrennt gerechnet; die Übergänge (Gehalt brutto → netto, Ausschüttung, Entnahme der Selbstständigkeit) sind die einzigen Brücken. Mindestumsatz = Personal inkl. Stellen + Sachkosten + Holding je Monat. {STEUER_HINWEIS}</Hinweis>
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Die Selbstständigkeit rechnet auf eigener Monatsachse; ihr Abschluss 2026 mit den Posten des laufenden Jahres steht unter Business › Selbstständigkeit.</div>
      </Karte>
    </>
  );
}
