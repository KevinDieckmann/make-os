'use client';

// ─── Finanzplanung jetzt — Gesamt: Privat · MAKE · KD Ventures · Selbstständigkeit ──
// Kevin 27.09.: „Privat + Business getrennt, oben Gesamt“ — mit den Übergängen
// (Gehalt MAKE → Privat netto, Ausschüttung), dem Mindestumsatz der MAKE Innovation GmbH
// (Kennung ug, Name aus lib/einheiten.ts) und der
// Steuerrücklage (Hinweis, keine Steuerberatung). Alle Zahlen aus dem Kern
// über den Arbeitsplan; das Blatt zeigt je Monat, wie die vier Einheiten
// zusammenhängen.

import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, LEUCHT } from '../ui';
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
  const { d, ug, kdc, pr, aw, ps, sz, gruppe } = usePlan();
  const ertragAn = zeigeSteuer(d, 'ug', 'kst') || zeigeSteuer(d, 'ug', 'est');
  const ustAn = zeigeSteuer(d, 'ug', 'ust');
  const U = (m: number) => ug[m - 1], P = (m: number) => pr[m - 1], K = (m: number) => kdc[m - 1];
  const selbst = rechneSelbst(d);
  const m0 = aw.m0;
  // Jede Zeile ist ein Wert des Kerns mit eigener Kennung (Handwert, lib/finanzen/handwerte.ts) — keine Summen nur für die Anzeige.
  // Je Blatt kommt jede Kennung höchstens einmal vor; die Empfängerseite hat eigene Kennungen (Privat: p.*), die der Formel folgen.
  const zeilen: BlattZeile[] = [
    { grp: 'Privat' },
    { name: `${personName('kevin')} netto (aus der ${UG_NAME})`, edit: 'p.kevinNetto', get: m => P(m).kevinNetto, ind: true },
    { name: `${personName('malin')} netto`, edit: 'p.malinNetto', get: m => P(m).malinNetto, ind: true },
    { name: 'Weitere Einnahmen', edit: 'p.weitere', get: m => P(m).einnahmenWeitere, ind: true, optional: true },
    { name: 'Einnahmen aus Bausteinen', edit: 'p.bausteineEin', get: m => P(m).bausteineEin, ind: true, optional: true },
    { name: 'Bedarf', edit: 'p.bedarf', minus: true, get: m => -P(m).bedarf, ind: true },
    { name: 'Schulden', edit: 'p.schulden', minus: true, get: m => -P(m).schulden, ind: true, optional: true },
    { name: 'Lebensereignisse', edit: 'p.ereignisse', minus: true, get: m => -P(m).ereignisse, ind: true, optional: true },
    { name: 'Ausgaben aus Bausteinen', edit: 'p.bausteineAus', minus: true, get: m => -P(m).bausteineAus, ind: true, optional: true },
    { name: 'Luft je Monat', edit: 'p.luft', sum: true, get: m => P(m).luft },
    { name: 'Angespart', edit: 'p.angespart', stock: true, key: true, get: m => P(m).angespart },
    { grp: `Übergänge ${UG_KURZ} → Privat` },
    { name: `${personName('kevin')} brutto`, edit: 'ug.kevin', get: m => U(m).kevinBrutto, ind: true },
    { name: `${personName('malin')} brutto`, edit: 'ug.malin', get: m => U(m).malinBrutto, ind: true },
    { name: 'Personal inkl. Arbeitgeber', edit: 'ug.personal', get: m => U(m).personal, ind: true },
    { name: 'Ausschüttung brutto', edit: 'ug.ausschuettung', get: m => U(m).ausschuettung, ind: true, optional: true },
    { name: 'davon Steuer, pauschal (Näherung)', edit: 'p.ausschuettungSteuer', minus: true, get: m => -P(m).ausschuettungSteuer, ind: true, optional: true },
    { name: 'Ausschüttung netto an Privat', edit: 'p.ausschuettung', get: m => P(m).ausschuettung, ind: true, optional: true },
    { name: 'Entnahme aus der Selbstständigkeit (schon versteuert)', edit: 'p.entnahme', get: m => P(m).entnahme, ind: true, optional: true },
    { grp: UG_NAME },
    { name: 'Umsatz netto', edit: 'ug.umsatz', get: m => U(m).umsatz, ind: true },
    { name: 'Mindestumsatz (laufende Kosten)', edit: 'ug.laufend', get: m => U(m).laufend, ind: true },
    { name: 'Gewinn', edit: 'ug.gewinn', sum: true, get: m => U(m).gewinn },
    { name: 'Kontostand', edit: 'ug.konto', stock: true, get: m => U(m).konto },
    { name: 'Frei verfügbar', edit: 'ug.frei', stock: true, key: true, get: m => U(m).frei },
    ...(ertragAn || ustAn ? [
      { grp: 'Steuern (Näherung)', zu: true, leerName: ['weitere Steuerzeile', 'weitere Steuerzeilen'] } as BlattZeile,
      ...(ertragAn ? [{ name: 'Steuerrücklage', edit: 'ug.steuerRuecklage', minus: true, stock: true, sum: true, get: (m: number) => -U(m).steuerRuecklage } as DatenZeile] : []),
      ...(ertragAn ? [{ name: 'Ertragsteuer-Zahlung', edit: 'ug.steuer', minus: true, get: (m: number) => -U(m).steuer, ind: true, optional: true } as DatenZeile] : []),
      ...(ertragAn ? [{ name: 'Verlustvortrag zu Jahresbeginn', edit: 'ug.verlustvortrag', stock: true, get: (m: number) => U(m).st.verlustvortrag, ind: true, optional: true } as DatenZeile] : []),
      ...(ustAn ? [{ name: 'USt offen (Durchlauf)', edit: 'ug.ustOffen', minus: true, stock: true, get: (m: number) => -U(m).ustOffen, ind: true, optional: true } as DatenZeile] : []),
    ] : []),
    { grp: 'KD Ventures' },
    { name: 'Kontostand KD Ventures', edit: 'kdv.konto', stock: true, get: m => U(m).kdvKonto },
    { name: 'Ertragsteuer-Rücklage KD Ventures', edit: 'kdv.steuerRuecklage', minus: true, stock: true, get: m => -U(m).kdvSt.ruecklage, ind: true, optional: true },
    { name: 'Frei verfügbar KD Ventures', edit: 'kdv.frei', stock: true, key: true, get: m => U(m).kdvFrei },
    { name: 'Partnerdarlehen offen', edit: 'kdv.darlehenOffen', minus: true, stock: true, get: m => -U(m).bjoernRest, ind: true },
    { grp: finanzOrtName('kdc') },
    { name: 'Umsatz netto Selbstständigkeit', edit: 'kdc.umsatz', get: m => K(m).umsatz, ind: true },
    { name: 'Kosten Selbstständigkeit', edit: 'kdc.kosten', minus: true, get: m => -K(m).kosten, ind: true },
    { name: 'Ergebnis vor Steuern Selbstständigkeit', edit: 'kdc.gewinn', sum: true, get: m => K(m).gewinn },
    { name: 'Ergebnis nach Steuern Selbstständigkeit', edit: 'kdc.ergebnisNach', get: m => K(m).ergebnisNach, ind: true, optional: true },
    { name: 'Entnahme an Privat', edit: 'kdc.entnahme', minus: true, get: m => -K(m).entnahme, ind: true, optional: true },
    { name: 'Kontostand Selbstständigkeit', edit: 'kdc.konto', stock: true, get: m => K(m).konto },
    { name: 'Frei verfügbar Selbstständigkeit', edit: 'kdc.frei', stock: true, key: true, get: m => K(m).frei },
    { grp: 'Gesamt' },
    { name: `Frei ${UG_KURZ} + KD Ventures + Selbstständigkeit + Privat angespart`, edit: 'g.frei', stock: true, sum: true, key: true, get: m => gruppe[m - 1] },
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
          { name: 'Gesamt', farbe: C.ink, werte: gruppe, gestrichelt: true, breite: 1.4 },
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
