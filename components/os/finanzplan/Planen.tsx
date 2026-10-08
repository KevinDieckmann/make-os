'use client';

// ─── Finanzplanung jetzt — Planen ────────────────────────────────────────────
// Privat (Blatt mit IST-Historie) · MAKE Innovation GmbH (Kennung ug) · Töpfe MAKE (Profit First) ·
// KD Ventures · Selbstständigkeit 2026 · Szenarien (Vergleich S1–S5, Treiber
// und Annahmen bearbeitbar) · Ziele (mit „Was wäre wenn“). Alle Zahlen kommen
// aus dem Rechenkern; das Blatt schreibt nur Zellen-Überschreibungen.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster, Spalten, Spalte, Knopf, LEUCHT, feld, Haken } from '../ui';
import type { Szenario, Zeile } from '@/lib/finanzen/rechenkern';
import { wert, sollBudget, key, istSchnitt, toepfeUG, rechneSelbst, zielStaende, estJahre } from '@/lib/finanzen/rechenkern';
import { UG_NAME, UG_KURZ } from '@/lib/einheiten';
import { BUDGET_GRUPPEN, eur, prozent, letzterVoller, monatLabel, neueKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan, rechne } from './daten';
import { Blatt, type BlattZeile, type DatenZeile, type ZeilenListe } from './Blatt';
import { ZeileDialog, neueZeileOp } from './ZeileDialog';
import { Geld, Kachel, Kacheln, Etikett, StatusPille, Tabelle, TH, THr, TD, TDr, TDleise, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, AnteilBalken, Dialog, Feld, Formular, Legende, KUPFER, LILA, Nichts, Schalter, HandZahl, personName } from './teile';
import { Stapel, Linie, MiniLinie } from './diagramme';
import { Geschaeft } from './Geschaeft';
import { AnnahmenAlle, SchwellenKarte, EinstellungenKarte } from './Annahmen';
import { SteuerKarte } from './Steuern';
import { STEUER_HINWEIS } from '@/lib/finanzen/szenarien';
import { GESELLSCHAFTEN } from '@/lib/einheiten';
import { HAND_FELDER, zelleTeile } from '@/lib/finanzen/handwerte';
import { useRueckfrage } from '../ui/zeile-aktionen';
import { MonatsabschlussKarte } from '../business/Abschluss';
import type { Monatsabschluss } from '@/lib/business/messen';
import type { Gesellschaftskennung } from '@/lib/einheiten';

/** Blatt + Zeilen-Dialog + neue Zeile — für Privat und die MAKE Innovation GmbH (ug) gemeinsam. */
function useZeilenDialog() {
  const { aendere } = usePlan();
  const [offen, setOffen] = useState<string | null>(null);
  const neu = async (liste: ZeilenListe, gruppe?: string) => { const { op, id } = neueZeileOp(liste, gruppe); if (await aendere([op], 'Zeile angelegt')) setOffen(id); };
  const dialog = offen ? <ZeileDialog id={offen} onZu={() => setOffen(null)} /> : null;
  return { oeffne: setOffen, neu, dialog };
}

// ── Privat ──────────────────────────────────────────────────────────────────
export function Privat() {
  const { d, dd, pr, h, sz, geh, aw } = usePlan();
  const zd = useZeilenDialog();
  const L = letzterVoller(d);
  const P = (m: number) => pr[m - 1];
  const hz = (id: string) => (i: number) => (h.zeilen[id] ? Math.round(h.zeilen[id][i]) || null : null);
  const budgetZeile = (z: Zeile): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => sollBudget(z, m, dd.plan), hist: hz(z.id), drill: z.id, ind: true, aus: true, z });
  const andere = d.privatBudget.filter(z => !(BUDGET_GRUPPEN as readonly string[]).includes(z.gruppe));
  const zeilen: BlattZeile[] = [
    { grp: 'Einnahmen', add: 'privatEinnahmen' },
    ...d.privatEinnahmen.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, dd.plan), ind: true })),
    { name: `${personName('kevin')} netto`, edit: 'p.kevinNetto', get: m => P(m).kevinNetto, ind: true },
    { name: `${personName('malin')} netto`, edit: 'p.malinNetto', get: m => P(m).malinNetto, ind: true },
    { name: 'Ausschüttung netto', edit: 'p.ausschuettung', get: m => P(m).ausschuettung, ind: true, optional: true },
    { name: 'Entnahme aus der Selbstständigkeit', edit: 'p.entnahme', get: m => P(m).entnahme, ind: true, optional: true },
    { name: 'Einnahmen aus Bausteinen', edit: 'p.bausteineEin', get: m => P(m).bausteineEin, ind: true, optional: true },
    { name: 'Darlehen zurückerhalten oder erhalten', edit: 'p.darlehenEin', get: m => P(m).darlehenEin, ind: true, optional: true },
    { name: 'Verfügbar', edit: 'p.verfuegbar', sum: true, get: m => P(m).verfuegbar, hist: i => Math.round(h.einnahmen[i]) || null, drill: 'x.einnahme' },
    ...BUDGET_GRUPPEN.flatMap((g): BlattZeile[] => [{ grp: g, add: 'privatBudget', addG: g }, ...d.privatBudget.filter(z => z.gruppe === g).map(budgetZeile)]),
    ...(andere.length ? [{ grp: 'Weitere' } as BlattZeile, ...andere.map(budgetZeile)] : []),
    { name: 'Bedarf', edit: 'p.bedarf', sum: true, get: m => P(m).bedarf, hist: i => Math.round(h.ausgaben[i] - (h.zeilen['p.d.altlasten']?.[i] ?? 0)) || null, istGet: m => { let s = 0, n = 0; for (const z of d.privatBudget) { const k = key(z.id, m); if (k in d.ist) { s += d.ist[k]; n++; } } return n ? s : null; } },
    { grp: 'Schulden & Ereignisse', add: 'privatSchulden' },
    ...d.privatSchulden.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, dd.plan), hist: hz(z.id), drill: z.id, ind: true, aus: true })),
    { name: 'Schulden', edit: 'p.schulden', sum: true, aus: true, get: m => P(m).schulden },
    { name: 'Lebensereignisse', edit: 'p.ereignisse', get: m => P(m).ereignisse, ind: true },
    { name: 'Ausgaben aus Bausteinen', edit: 'p.bausteineAus', get: m => P(m).bausteineAus, ind: true, aus: true, optional: true },
    { name: 'Darlehen ausgezahlt oder zurückgezahlt', edit: 'p.darlehenAus', get: m => P(m).darlehenAus, ind: true, aus: true, optional: true },
    { grp: 'Ergebnis' },
    { name: 'Luft je Monat', edit: 'p.luft', sum: true, get: m => P(m).luft, hist: i => Math.round(h.einnahmen[i] - h.ausgaben[i]) || null },
    { name: 'Sparen + Luft', edit: 'p.sparen', get: m => P(m).sparen },
    { name: 'Angespart', edit: 'p.angespart', stock: true, key: true, get: m => P(m).angespart },
  ];
  const schnitt = (r: DatenZeile, k: number) => (r.z ? istSchnitt(h.zeilen[r.z.id], k, L) : r.drill === 'x.einnahme' ? istSchnitt(h.einnahmen, k, L) : null);
  const extra = [
    { h: 'Ø 3 M', t: 'IST der letzten drei vollen Monate', get: (r: DatenZeile) => { const v = schnitt(r, 3); return v == null ? '' : <span style={{ color: r.z && r.z.typ !== 'sparen' && v > r.z.soll * 1.1 ? LEUCHT.achtung : undefined }}>{eur(v)}</span>; } },
    { h: 'Ø 6 M', t: 'IST der letzten sechs vollen Monate', get: (r: DatenZeile) => { const v = schnitt(r, 6); return v == null ? '' : eur(v); } },
  ];
  // Formel-Prüfung 05.10.: die Kacheln zeigen den laufenden Monat (Stichtag) — vorher fest Okt 26, auch Monate später.
  const p1 = P(aw.m0), m0Label = monatLabel(d, aw.m0);
  const flexIst = d.privatBudget.filter(z => z.typ === 'flex').reduce((s, z) => s + istSchnitt(h.zeilen[z.id], 3, L), 0);
  const fixIst = d.privatBudget.filter(z => z.typ === 'fix').reduce((s, z) => s + istSchnitt(h.zeilen[z.id], 3, L), 0);
  const topfDez27 = d.privatBudget.filter(z => z.typ === 'jahr').reduce((s, z) => s + (pr[14]?.toepfe[z.id] ?? 0), 0);
  const roll = d.privatBudget.filter(z => z.typ === 'flex').reduce((s, z) => { for (let m = 1; m <= d.monate.length; m++) { const k = key(z.id, m); if (k in d.ist) s += sollBudget(z, m, d.plan) - d.ist[k]; } return s; }, 0);
  const topf = (t: string, soll: number, ist: number, unter: React.ReactNode, farbe: string) => (
    <Kachel label={t} wert={<><Geld v={soll} /> €</>} unter={<><AnteilBalken anteil={soll > 0 ? ist / soll : 0} farbe={ist > soll * 1.05 ? LEUCHT.kritisch : farbe} hoehe={5} /><div style={{ marginTop: 5 }}>{unter}</div></>} />
  );
  return (
    <>
      <Kacheln min={180}>
        {topf('Fixkosten je Monat', p1?.fix ?? 0, fixIst, <>Ø IST <Geld v={fixIst} farbe={C.inkDim} /> € · steht fest</>, LEUCHT.puls)}
        {topf('Flexibel je Monat', p1?.flex ?? 0, flexIst, <>Ø IST <Geld v={flexIst} farbe={C.inkDim} /> €{flexIst > (p1?.flex ?? 0) ? <span style={{ color: LEUCHT.kritisch }}> · {eur(flexIst - (p1?.flex ?? 0))} drüber</span> : null}{roll ? <> · Übertrag <Geld v={roll} farbe={C.inkDim} /> €</> : null}</>, C.aktiv)}
        {topf('Jahreskosten-Topf', p1?.jahr ?? 0, 0, <>Topf Dez 27: <Geld v={topfDez27} farbe={C.inkDim} /> €</>, KUPFER)}
        {topf('Sparen', p1?.sparenSoll ?? 0, 0, <>+ Luft <Geld v={p1?.luft} farbe={C.inkDim} /> € im {m0Label}</>, LILA)}
        <Kachel label={`Verfügbar ${m0Label}`} wert={<><Geld v={p1?.verfuegbar} /> €</>} unter={<>Luft <Geld v={p1?.luft} /> € · Ø IST Einnahmen <Geld v={istSchnitt(h.einnahmen, 3, L)} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <Karte i={1}>
        <Blatt zeilen={zeilen} titel={`Privat · ${sz.name}`} hist extra={extra} werkzeuge={<Etikett einheit="privat" text="Kevin & Malin" />} onZeile={zd.oeffne} onNeueZeile={zd.neu} onDrill={(i, z) => geh('buchungen', { monat: i, zeile: z })} />
        <Hinweis>Lila Spalten = IST aus den Buchungen (Klick öffnet die Buchungen dahinter). Der laufende Monat bleibt bei Durchschnitten draußen. Brutto kommt aus der {UG_NAME}; Netto ist eine Näherung aus der Tabelle in den Annahmen.</Hinweis>
      </Karte>
      {zd.dialog}
    </>
  );
}

// ── MAKE Innovation GmbH (Kennung ug; die Funktion heißt weiter UG) ──────────
// Seit 02.10. das Business-Blatt aus Geschaeft.tsx (Produkte, Kosten, Ergebnis vor/nach Steuern, Break-even, Steuern schaltbar).
export function UG() { return <Geschaeft ort="ug" />; }

// ── Töpfe MAKE (Kennung ug) ──────────────────────────────────────────────────
export function Toepfe() {
  const { d, dd, ug, aendere } = usePlan();
  const t = toepfeUG(ug, d.einstellungen.reserveMonate, dd.plan);
  const T = (m: number) => t[m - 1];
  const farben = [C.inkLeise, LEUCHT.achtung, LEUCHT.puls, KUPFER];
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Reserve <Auswahl wert={String(d.einstellungen.reserveMonate)} onWahl={v => void aendere([{ pfad: '/einstellungen/reserveMonate', alt: d.einstellungen.reserveMonate, neu: Number(v) }], `Reserve ${UG_KURZ}`)} optionen={[0, 1, 2, 3].map(n => ({ id: String(n), label: `${n} Monatskosten` }))} titel="Reserve in Monatskosten" /></span>}>Wem gehört das Geld auf dem {UG_KURZ}-Konto</Ueberschrift>
        <Legende eintraege={[{ farbe: farben[0], text: 'USt (Finanzamt)' }, { farbe: farben[1], text: 'Steuerrücklage' }, { farbe: farben[2], text: 'Reserve' }, { farbe: farben[3], text: 'frei' }]} />
        <div style={{ marginTop: 8 }}><Stapel stapel={t.map(x => [x.ust, x.steuer, x.reserve, x.frei])} labels={d.monate} farben={farben} namen={['USt', 'Steuer', 'Reserve', 'frei']} /></div>
        <Hinweis>Profit First, angepasst: Jeder Eingang wird gedanklich verteilt — erst Finanzamt, dann Steuer, dann Reserve, der Rest ist frei. Vorschlag: bei der Bank je Topf ein Unterkonto und einmal im Monat umbuchen.</Hinweis>
      </Karte>
      <Karte i={1}>
        {/* Seit 04.10. ein Blatt: jede Zahl der Töpfe ist bearbeitbar (Konto, USt, Steuer aus dem Kern; Reserve und frei als Handwerte der Töpfe). */}
        <Blatt titel={`Töpfe ${UG_KURZ}`} zeilen={[
          { grp: 'Konto' },
          { name: 'Kontostand', edit: 'ug.konto', stock: true, get: m => T(m).konto },
          { grp: 'Töpfe' },
          { name: 'USt (Finanzamt)', edit: 'ug.ustOffen', stock: true, get: m => T(m).ust, ind: true },
          { name: 'Steuerrücklage', edit: 'ug.steuerRuecklage', stock: true, get: m => T(m).steuer, ind: true },
          { name: 'Reserve-Ziel', edit: 'ug.reserveZiel', stock: true, get: m => T(m).reserveZiel, ind: true },
          { name: 'Reserve', edit: 'ug.reserve', stock: true, get: m => T(m).reserve, ind: true },
          { name: 'Frei', edit: 'ug.topfFrei', stock: true, sum: true, key: true, get: m => T(m).frei },
        ]} />
      </Karte>
    </>
  );
}

// ── KD Ventures ──────────────────────────────────────────────────────────────
export function KDV() { return <Geschaeft ort="kdv" />; }

// ── Selbstständigkeit (seit 05.10. unter Privat) ─────────────────────────────
export function Selbst() {
  return <><AlteHandwerte /><Geschaeft ort="kdc" /><EinkommensteuerGemeinsam /><SelbstAbschluss /><SelbstMonatsabschluss /></>;
}

/**
 * Monatsabschluss der Selbstständigkeit unter Privat (05.10. abends, Kevin: „Privat › Selbstständigkeit bekommt den Monatsabschluss“): derselbe
 * Baustein wie im Business-Cockpit, aber über /api/privat/abschluss (Privatzugang, nur Privat-Einheiten). Die vor dem 05.10. im Business-Cockpit
 * eingetragenen Abschlüsse der Selbstständigkeit stehen hier wieder und lassen sich bearbeiten. Ohne Privat-Einheit (Instanz-Einstellung) keine Karte.
 */
function SelbstMonatsabschluss() {
  const [d, setD] = useState<{ firmen: { id: Gesellschaftskennung; label: string }[]; abschluesse: Monatsabschluss[] } | null>(null);
  const laden = useCallback(() => {
    fetch('/api/privat/abschluss', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => setD(x?.ok ? x : null)).catch(() => setD(null));
  }, []);
  useEffect(() => { laden(); }, [laden]);
  if (!d?.firmen.length) return null;
  return (
    <MonatsabschlussKarte i={7} eintraege={d.abschluesse} firmen={d.firmen} adresse="/api/privat/abschluss" onGespeichert={laden}
      hinweis="Die Monatszahlen (BWA) der Selbstständigkeit — gespeichert im Privat-Bereich, nicht im Business-Index. Ältere Einträge aus dem Business-Cockpit stehen hier mit." />
  );
}

/** Handwert-Schlüssel als Text: Name der Größe, Monat (0 = ohne Monat), ggf. „nur in Szenario …“. */
function handText(d: ReturnType<typeof usePlan>['d'], k: string): string {
  const t = zelleTeile(k); if (!t) return k;
  const sz = t.szenario ? ` · nur in „${(d.planszenarien ?? []).find(p => p.id === t.szenario)?.name ?? t.szenario}“` : '';
  return `${HAND_FELDER[t.id]?.name ?? t.id}${t.m ? ` · ${monatLabel(d, t.m)}` : ' (Abschluss)'}${sz}`;
}

/**
 * Handwerte aus dem Stand vor finanzplan-5 (Gegenprüfung 05.10., Fund 5): ihre Bedeutung hat sich geändert (Abschluss und Einkommensteuer jetzt mit
 * dem Gehalt in EINER Progression, Steuer 2026 inkl. Jan–Sep) — der Server legt sie beim Lesen in `handAlt`, gerechnet wird ohne sie. Je Wert
 * ein Klick: „übernehmen“ (gilt ab jetzt mit der neuen Bedeutung) oder „verwerfen“ (die Formel gilt), jeweils mit Rückfrage.
 */
function AlteHandwerte() {
  const { d, aendere } = usePlan();
  const { bestaetigen, dialog } = useRueckfrage();
  const alt = Object.entries(d.handAlt ?? {});
  if (!alt.length) return null;
  const uebernehmen = async (k: string, v: number) => {
    if (!await bestaetigen({ titel: 'Alten Handwert übernehmen?', text: `${handText(d, k)}: ${eur(v)} €\nDer Wert wurde vor dem 05.10. eingetragen. Übernommen gilt er ab jetzt mit der NEUEN Bedeutung (gemeinsame Einkommensteuer mit dem Gehalt, Steuer 2026 inkl. Jan–Sep) und geht in Rücklage und Zahlung ein.`, ja: 'Übernehmen' })) return;
    void aendere([{ pfad: `/plan/${k}`, neu: v }], `Alter Handwert übernommen: ${handText(d, k)}`);
  };
  const verwerfen = async (k: string, v: number) => {
    if (!await bestaetigen({ titel: 'Alten Handwert verwerfen?', text: `${handText(d, k)}: ${eur(v)} €\nDanach gilt die Formel. Der alte Wert ist dann weg (im Protokoll steht er noch).`, ja: 'Verwerfen', gefahr: true })) return;
    void aendere([{ pfad: `/handAlt/${k}`, alt: v }], `Alter Handwert verworfen: ${handText(d, k)}`);
  };
  return (
    <Karte i={0}>
      <Ueberschrift>Achtung: {alt.length === 1 ? 'ein Handwert' : `${alt.length} Handwerte`} aus dem alten Stand — Bedeutung geändert, wird nicht gerechnet</Ueberschrift>
      <Tabelle klein>
        <thead><tr><th style={TH}>Wert</th><th style={THr}>alter Handwert</th><th style={TH}></th></tr></thead>
        <tbody>{alt.map(([k, v]) => (
          <tr key={k}>
            <td style={TD}>{handText(d, k)}</td>
            <td style={TDr}><Geld v={v} /> €</td>
            <td style={TD}><span style={{ display: 'inline-flex', gap: 6 }}><KnopfKlein onClick={() => void uebernehmen(k, v)}>übernehmen</KnopfKlein><KnopfKlein farbe={LEUCHT.kritisch} onClick={() => void verwerfen(k, v)}>verwerfen</KnopfKlein></span></td>
          </tr>
        ))}</tbody>
      </Tabelle>
      <Hinweis>Seit dem 05.10. rechnen der Abschluss und die Steuer der Selbstständigkeit mit dem Gehalt in EINER Einkommensteuer (und 2026 als ein Steuerjahr). Diese Werte wurden vorher von Hand eingetragen und meinten die alte Größe — bis Sie entscheiden, rechnet der Plan mit der Formel.</Hinweis>
      {dialog}
    </Karte>
  );
}

/**
 * Die gemeinsame Einkommensteuer je Jahr (05.10., Kevin: Selbstständigkeit und Privat „werden am Ende ja auch zusammen gerechnet und besteuert“):
 * Gewinn der Selbstständigkeit (2026 inkl. Jan–Sep) + Lohneinkünfte → zu versteuern → Steuer gesamt, davon auf den Lohn allein (steckt in der
 * Netto-Tabelle als Lohnsteuer), Mehrsteuer durch die Selbstständigkeit, Gewerbesteuer, Anrechnung, Soli. Nur Anzeige — gerechnet im Kern.
 */
function EinkommensteuerGemeinsam() {
  const { d, dd, kdc, ug, formel } = usePlan();
  // Gegenprüfung 05.10. (Fund 12): dieselbe Rechnung wie Rücklage und Zahlung (derselbe Steuerrechner, dieselben Handwerte).
  const jahre = estJahre(dd, kdc, ug);
  // Alle wirksamen Handwerte, die in die Einkommensteuer eingehen (Abschluss, Selbstständigkeit, Gehälter) — nicht nur kdc-Steuerwerte.
  const handwerte = Object.keys(formel).filter(k => /^(ab\.(ein|aus|gewinn|zve|est)|kdc\.(umsatz|eingang|kosten|gewinn|malin|est|gewst|soli|anrechnung|kst|verlustvortrag|steuer|steuerRuecklage)|ug\.(kevin|malin)):\d+$/.test(k));
  const z = (l: string, f: (j: (typeof jahre)[number]) => number, fett?: boolean, minus?: boolean) => (
    <tr><td style={{ ...TD, fontWeight: fett ? 700 : 500 }}>{l}</td>{jahre.map(j => <td key={j.jahr} style={{ ...TDr, fontWeight: fett ? 700 : 500 }}><Geld v={(minus ? -1 : 1) * f(j)} /></td>)}</tr>
  );
  return (
    <Karte i={6}>
      <Ueberschrift>Einkommensteuer gemeinsam — Selbstständigkeit und Gehalt</Ueberschrift>
      <Tabelle klein>
        <thead><tr><th style={TH}>je Kalenderjahr</th>{jahre.map(j => <th key={j.jahr} style={THr}>{j.jahr}</th>)}</tr></thead>
        <tbody>
          {z('Gewinn der Selbstständigkeit', j => j.gewinn)}
          {jahre.some(j => j.vorab) ? z('davon Jan–Sep (Abschluss)', j => j.vorab) : null}
          {z('Lohneinkünfte (Gehalt − Pauschbetrag)', j => j.lohn)}
          {z('zu versteuern (nach Vorsorge, Sonderausgaben, Verlustvortrag)', j => j.zve)}
          {z('Einkommensteuer gesamt', j => j.estGesamt)}
          {z('davon auf das Gehalt allein (Lohnsteuer, schon im Netto)', j => j.estLohn, false, true)}
          {z('Mehrsteuer durch die Selbstständigkeit', j => j.est, true)}
          {z('Gewerbesteuer', j => j.gewst)}
          {z('Anrechnung (§ 35 EStG)', j => j.anrechnung, false, true)}
          {z('Soli (Mehrbetrag)', j => j.soli)}
          {jahre.some(j => j.korr) ? z('davon von Hand (Abweichung der Handwerte)', j => j.korr) : null}
          {z('Steuer des Jahres (Rücklage)', j => j.summe, true)}
          {jahre.some(j => j.vorausgezahlt) ? z('schon vorausgezahlt', j => j.vorausgezahlt, false, true) : null}
          {z('Abschlusszahlung im Folgejahr (negativ = Erstattung)', j => j.zahlung, true)}
        </tbody>
      </Tabelle>
      <Hinweis>
        EINE Einkommensteuer je Jahr über Privat und Selbstständigkeit: Gewinn und Gehalt laufen durch denselben Tarif (Progression). Die Lohnsteuer
        auf das Gehalt steckt schon im Netto (Netto-Tabelle); der Plan zahlt aus dem Konto der Selbstständigkeit nur den Teil darüber — ein Verlust
        mindert so auch die Steuer auf das Gehalt (Erstattung im Folgejahr). Ausschüttungen bleiben pauschal versteuert (Abgeltungsteuer).
        Einstellbar unter „Welche Steuern gelten?“: Gehälter einbeziehen, Einzel- oder Zusammenveranlagung, Pauschbetrag.
        {handwerte.length ? ` Achtung: ${handwerte.length === 1 ? 'ein Handwert wirkt' : `${handwerte.length} Handwerte wirken`} auf diese Steuer (${handwerte.slice(0, 6).map(k => handText(d, k)).join(', ')}${handwerte.length > 6 ? ' …' : ''}) — die Zeilen darüber zeigen die Formel, „von Hand“ die Abweichung; Rücklage und Zahlung rechnen mit den Handwerten.` : ''} {STEUER_HINWEIS}
      </Hinweis>
    </Karte>
  );
}

/** Abschluss 2026 der Selbstständigkeit: Posten des laufenden Jahres, Einkommensteuer, frei nach Abschluss. */
function SelbstAbschluss() {
  const { d, dd, aendere, lohn } = usePlan();
  const formel: Record<string, number> = {};
  // Wie die Monatsachse: mit den Überlagerungen des gerechneten Szenarios (Steuerprofil, Szenario-Handwerte) und den Lohneinkünften.
  const r = rechneSelbst(dd, formel, lohn); const s = d.selbst;
  const hz = (k: string, v: number, name: string, extra?: { farbe?: string; minus?: boolean }) => <HandZahl kennung={k} wert={v} name={name} formel={formel[`${k}:0`]} {...extra} />;
  const STATUS = ['geplant', 'offen', 'bezahlt', 'unklar'].map(x => ({ id: x, label: x }));
  const zeile = (l: React.ReactNode, w: React.ReactNode, fett?: boolean) => <tr><td style={{ ...TD, fontWeight: fett ? 700 : 500 }}>{l}</td><td style={{ ...TDr, fontWeight: fett ? 700 : 500 }}>{w}</td></tr>;
  return (
    <Spalten verhaeltnis="3:2">
      <Spalte>
        <Karte i={0}>
          <Ueberschrift rechts={<KnopfKlein onClick={() => void aendere([{ pfad: '/selbst/posten/-', neu: { id: neueKennung('sp'), name: 'Neuer Posten', art: 'einnahme', betrag: 0, status: 'geplant' } }], 'Posten angelegt')}>+ Posten</KnopfKlein>}>Einnahmen &amp; Ausgaben 2026</Ueberschrift>
          <Tabelle klein>
            <thead><tr><th style={TH}>Posten</th><th style={TH}>Art</th><th style={TH}>Status</th><th style={THr}>Betrag</th><th style={TH}>zählt</th></tr></thead>
            <tbody>
              {s.posten.map(p => (
                <tr key={p.id}>
                  <td style={TD}><TextFeld wert={p.name} onFertig={t => void aendere([{ pfad: `/selbst/posten/id=${p.id}/name`, alt: p.name, neu: t }], `Selbstständigkeit ${p.name}`)} breite={180} titel="Name" /></td>
                  <td style={TD}><Auswahl wert={p.art} onWahl={v => void aendere([{ pfad: `/selbst/posten/id=${p.id}/art`, alt: p.art, neu: v }], `Selbstständigkeit ${p.name} · Art`)} optionen={[{ id: 'einnahme', label: 'Einnahme' }, { id: 'ausgabe', label: 'Ausgabe' }]} titel="Art" /></td>
                  <td style={TD}><Auswahl wert={p.status} onWahl={v => void aendere([{ pfad: `/selbst/posten/id=${p.id}/status`, alt: p.status, neu: v }], `Selbstständigkeit ${p.name} · Status`)} optionen={STATUS} titel="Status" /></td>
                  <td style={TDr}><ZahlFeld wert={p.betrag} onFertig={v => void aendere([{ pfad: `/selbst/posten/id=${p.id}/betrag`, alt: p.betrag, neu: v ?? 0 }], `Selbstständigkeit ${p.name}`)} titel="Betrag" /></td>
                  <td style={TD}><Haken an={!p.aus} onChange={() => void aendere([{ pfad: `/selbst/posten/id=${p.id}/aus`, alt: !!p.aus, neu: !p.aus }], `Selbstständigkeit ${p.name} zählt ${p.aus ? '' : 'nicht'}`)} /></td>
                </tr>
              ))}
              {!s.posten.length && <tr><td colSpan={5} style={TDleise}>Noch keine Posten.</td></tr>}
            </tbody>
          </Tabelle>
        </Karte>
      </Spalte>
      <Spalte>
        <Karte i={1}>
          <Ueberschrift>Abschluss &amp; Steuer</Ueberschrift>
          <Tabelle klein>
            <tbody>
              {zeile('Einnahmen', hz('ab.ein', r.ein, 'Einnahmen 2026'))}
              {zeile('Ausgaben', hz('ab.aus', r.aus, 'Ausgaben 2026', { minus: true }))}
              {zeile('Gewinn', hz('ab.gewinn', r.gewinn, 'Gewinn 2026'), true)}
              {zeile('Vorsorge', <ZahlFeld wert={s.vorsorge} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/vorsorge', alt: s.vorsorge, neu: v ?? 0 }], 'Selbstständigkeit Vorsorge')} titel="Vorsorge" />)}
              {zeile('Sonderausgaben', <ZahlFeld wert={s.sonderausgaben} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/sonderausgaben', alt: s.sonderausgaben, neu: v ?? 0 }], 'Selbstständigkeit Sonderausgaben')} titel="Sonderausgaben" />)}
              {zeile('Gehalt brutto Jan–Sep 2026 (zählt in die Einkommensteuer)', <ZahlFeld wert={s.lohnVorPlan ?? null} leer platzhalter="0" dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/lohnVorPlan', alt: s.lohnVorPlan, ...(v == null ? {} : { neu: v }) }], 'Selbstständigkeit Gehalt Jan–Sep')} titel="Gehalt brutto Jan–Sep 2026" />)}
              {zeile('Gehalt 2 brutto Jan–Sep 2026 (zählt bei Zusammenveranlagung)', <ZahlFeld wert={s.lohn2VorPlan ?? null} leer platzhalter="0" dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/lohn2VorPlan', alt: s.lohn2VorPlan, ...(v == null ? {} : { neu: v }) }], 'Selbstständigkeit Gehalt 2 Jan–Sep')} titel="Gehalt 2 brutto Jan–Sep 2026" />)}
              {zeile('Lohneinkünfte 2026 (ganzes Jahr)', <Geld v={r.lohn} />)}
              {zeile('zu versteuern 2026 (Jan–Sep + Gehalt)', hz('ab.zve', r.zve, 'zu versteuern 2026'))}
              {zeile('Einkommensteuer-Anteil Jan–Sep (Näherung)', hz('ab.est', r.est, 'Einkommensteuer 2026', { farbe: r.est > 0 ? LEUCHT.achtung : undefined }), true)}
              {zeile('Steuer auf Jan–Sep gesamt (mit Gewerbesteuer, Soli)', <Geld v={r.steuer} />)}
              {zeile('Vorauszahlungen 2026 schon bezahlt', <ZahlFeld wert={s.estVorausgezahlt ?? null} leer platzhalter="0" dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/estVorausgezahlt', alt: s.estVorausgezahlt, ...(v == null ? {} : { neu: v }) }], 'Selbstständigkeit Vorauszahlungen 2026')} titel="Vorauszahlungen 2026 schon bezahlt" />)}
              {zeile('Kontostand heute', <ZahlFeld wert={s.kontoStart} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/kontoStart', alt: s.kontoStart, neu: v ?? 0 }], 'Selbstständigkeit Kontostand')} titel="Kontostand" />)}
              {zeile('Darlehen, die noch hinausgehen', <Geld v={r.darlehen} />)}
              {zeile('Sicherheit Steuer', <ZahlFeld wert={s.sicherheit} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/sicherheit', alt: s.sicherheit, neu: v ?? 0 }], 'Selbstständigkeit Sicherheit')} titel="Sicherheit Steuer" />)}
              {zeile('Frei nach Abschluss', hz('ab.frei', r.frei, 'Frei nach Abschluss'), true)}
              {zeile('Ablösung', <ZahlFeld wert={s.consorsAbloesung} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/consorsAbloesung', alt: s.consorsAbloesung, neu: v ?? 0 }], 'Selbstständigkeit Ablösung')} titel="Ablösung" />)}
              {zeile('nach Ablösung', hz('ab.nachConsors', r.nachConsors, 'nach Ablösung'))}
            </tbody>
          </Tabelle>
          <Hinweis>Seit 05.10. EIN Steuerjahr: Jan–Sep (hier) und Okt–Dez (Blatt oben) werden zusammen versteuert, mit dem Gehalt in derselben Progression. Die Steuer 2026 steht ab Okt in der Rücklage der Selbstständigkeit und wird im Zahlmonat 2027 bezahlt (minus schon bezahlter Vorauszahlungen). Darlehen erfassen Sie unter Planung › Schulden › Darlehen. Grundtarif 2026 (§ 32a EStG) als Näherung — Hinweis, keine Steuerberatung.</Hinweis>
        </Karte>
      </Spalte>
    </Spalten>
  );
}

// ── Szenarien ────────────────────────────────────────────────────────────────
const FARBEN_SZ = [KUPFER, LEUCHT.achtung, LEUCHT.kritisch, LEUCHT.puls, LILA, C.inkDim, C.ink];

export function Szenarien() {
  const { d, sz, ps, aendere, ug: ugAktiv, sicht } = usePlan();
  const alle = useMemo(() => d.szenarien.map(s => ({ s, ...rechne(d, s) })), [d]);
  const business = sicht === 'business';
  const a = d.annahmen;
  const [name, setName] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState(false);
  const p = (pfad: string) => `/szenarien/id=${sz.id}/${pfad}`;
  const setze = (pfad: string, alt: unknown, neu: unknown, feld: string) => void aendere([{ pfad: p(pfad), alt, neu }], `Szenario ${sz.name} · ${feld}`);
  const num = (pfad: string, v: number, feld: string, breite = 100, dezimal = 0) => <ZahlFeld wert={v} dezimal={dezimal} breite={breite} onFertig={n => setze(pfad, v, n ?? 0, feld)} titel={feld} />;
  const mon = (pfad: string, v: number, feld: string) => <MonatWahl wert={v} aus onWahl={m => setze(pfad, v, m, feld)} monate={d.monate} />;
  const ereignisse = sz.ereignisse ?? [];
  const zeileStil = (an: boolean) => ({ cursor: 'pointer', background: an ? `${C.aktiv}14` : undefined });
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={ps ? <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>gerechnet mit den Bausteinen von „{ps.name}“</span> : undefined}>Treiber im Vergleich — Klick wählt den Treiber{ps ? ' für den Arbeitsplan' : ''}</Ueberschrift>
        <Tabelle klein>
          <thead><tr><th style={TH}>Szenario</th><th style={THr}>Tiefpunkt frei</th><th style={THr}>Monate im Minus</th><th style={THr}>frei Dez 26</th><th style={THr}>frei Dez 27</th><th style={THr}>frei Dez 28</th><th style={THr}>Umsatz 2027</th><th style={THr}>OB-Anteil Jun 27</th>{!business && <><th style={THr}>Privat angespart Dez 27</th><th style={THr}>Gruppe Dez 28</th></>}</tr></thead>
          <tbody>
            {alle.map(({ s: x, kz }) => (
              <tr key={x.id} onClick={() => { if (x.id === sz.id) return; void aendere([{ pfad: '/aktiv', alt: d.aktiv, neu: x.id }, ...(ps ? [{ pfad: `/planszenarien/id=${ps.id}/basis`, alt: ps.basis, neu: x.id }] : [])], `Treiber ${x.name} aktiv`); }} style={zeileStil(x.id === sz.id)}>
                <td style={{ ...TD, fontWeight: x.id === sz.id ? 700 : 500, color: x.id === sz.id ? C.aktiv : C.ink }}>{x.name}</td>
                <td style={TDr}><Geld v={kz.minFrei} /> <span style={{ color: C.inkLeise, fontSize: TYP.bedien }}>{monatLabel(d, kz.minMonat)}</span></td>
                <td style={{ ...TDr, color: kz.monateMinus ? LEUCHT.kritisch : C.ink }}>{kz.monateMinus}</td>
                <td style={TDr}><Geld v={kz.freiDez26} /></td><td style={TDr}><Geld v={kz.freiDez27} /></td><td style={TDr}><Geld v={kz.freiDez28} /></td>
                <td style={TDr}><Geld v={kz.umsatz2027} /></td><td style={TDr}>{prozent(kz.obAnteilJun27)}</td>
                {!business && <><td style={TDr}><Geld v={kz.privatAngespartDez27} /></td><td style={TDr}><Geld v={kz.gruppeDez28} gross={false} stil={{ fontWeight: 700 }} /></td></>}
              </tr>
            ))}
          </tbody>
        </Tabelle>
        <div style={{ marginTop: 12 }}>
          <Legende eintraege={alle.map(({ s: x }, i) => ({ farbe: FARBEN_SZ[i % FARBEN_SZ.length], text: `${x.name} — ${UG_KURZ} frei` }))} />
          <Linie labels={d.monate} tick={3} serien={alle.map(({ s: x, ug }, i) => ({ name: x.name, farbe: FARBEN_SZ[i % FARBEN_SZ.length], werte: ug.map(u => u.frei), breite: x.id === sz.id ? 2.6 : 1.3 }))} />
        </div>
      </Karte>
      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={1}>
            <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 6 }}>
              <KnopfKlein onClick={() => { const n: Szenario = JSON.parse(JSON.stringify(sz)); n.id = neueKennung('s'); n.name = `${sz.name} Kopie`; void aendere([{ pfad: '/szenarien/-', neu: n }, { pfad: '/aktiv', alt: d.aktiv, neu: n.id }], `Szenario ${n.name} angelegt`); }}>Duplizieren</KnopfKlein>
              <KnopfKlein onClick={() => setName(sz.name)}>Umbenennen</KnopfKlein>
              {d.szenarien.length > 1 && (loeschen ? <KnopfKlein farbe={LEUCHT.kritisch} onClick={() => { setLoeschen(false); void aendere([{ pfad: `/szenarien/id=${sz.id}`, alt: sz.name }], `Szenario ${sz.name} gelöscht`); }}>Wirklich löschen</KnopfKlein> : <KnopfKlein farbe={LEUCHT.kritisch} onClick={() => setLoeschen(true)}>Löschen</KnopfKlein>)}
            </span>}>Treiber „{sz.name}“</Ueberschrift>
            <Tabelle klein>
              <thead><tr><th style={TH}>Baustein</th><th style={TH}>Betrag</th><th style={TH}>ab</th><th style={TH}>Monate</th><th style={TH}></th></tr></thead>
              <tbody>
                <tr><td style={TD}>Ankermandat</td><td style={TD}>{num('ob/betrag', sz.ob.betrag, 'Ankermandat Betrag')}</td><td style={TD}>{mon('ob/start', sz.ob.start, 'Ankermandat ab')}</td><td style={TD}>{num('ob/laufzeit', sz.ob.laufzeit, 'Ankermandat Monate', 64)}</td><td style={TD}></td></tr>
                {sz.retainer.map((r, i) => (
                  <tr key={i}><td style={TD}>Retainer {i + 1}</td><td style={TD}>{num(`retainer/${i}/betrag`, r.betrag, `Retainer ${i + 1} Betrag`)}</td><td style={TD}>{mon(`retainer/${i}/start`, r.start, `Retainer ${i + 1} ab`)}</td><td style={TD}>{num(`retainer/${i}/laufzeit`, r.laufzeit, `Retainer ${i + 1} Monate`, 64)}</td><td style={TD}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: p(`retainer/${i}`), alt: r }], `Szenario ${sz.name} · Retainer ${i + 1} entfernt`)} titel="Retainer entfernen">−</KnopfKlein></td></tr>
                ))}
                <tr><td colSpan={5} style={TD}><KnopfKlein onClick={() => void aendere([{ pfad: p('retainer/-'), neu: { betrag: 0, start: 2, laufzeit: 12 } }], `Szenario ${sz.name} · Retainer hinzugefügt`)}>+ Retainer</KnopfKlein></td></tr>
                <tr><td style={TD}>ASTARNA Kunden/Monat</td><td style={TD}>{num('astarna/betrag', sz.astarna.betrag, 'ASTARNA Kunden')}</td><td style={TD}>{mon('astarna/ab', sz.astarna.ab, 'ASTARNA ab')}</td><td colSpan={2} style={TDleise}>× <Geld v={a.astarnaProvision} farbe={C.inkLeise} /> €</td></tr>
                <tr><td style={TD}>Events/Monat</td><td style={TD}>{num('events/betrag', sz.events.betrag, 'Events')}</td><td style={TD}>{mon('events/ab', sz.events.ab, 'Events ab')}</td><td colSpan={2} style={TD}></td></tr>
                <tr><td style={TD}>Gehaltserhöhung je Person</td><td style={TD}>{num('erhoehung/betrag', sz.erhoehung.betrag, 'Gehaltserhöhung')}</td><td style={TD}>{mon('erhoehung/ab', sz.erhoehung.ab, 'Gehaltserhöhung ab')}</td><td colSpan={2} style={TD}></td></tr>
                <tr><td style={TD}>Unterstützung brutto</td><td style={TD}>{num('unterstuetzung/betrag', sz.unterstuetzung.betrag, 'Unterstützung')}</td><td style={TD}>{mon('unterstuetzung/ab', sz.unterstuetzung.ab, 'Unterstützung ab')}</td><td colSpan={2} style={TD}></td></tr>
                <tr><td style={TD}>KEMARIS Tranche 1</td><td style={TD}>{num('exit1/betrag', sz.exit1.betrag, 'Tranche 1')}</td><td style={TD}>{mon('exit1/monat', sz.exit1.monat, 'Tranche 1 Monat')}</td><td colSpan={2} style={TD}><Schalter an={sz.bjoernAbloesen} onChange={v => setze('bjoernAbloesen', sz.bjoernAbloesen, v, 'Partnerdarlehen ablösen')}>Partnerdarlehen ablösen</Schalter></td></tr>
                <tr><td style={TD}>KEMARIS Tranche 2</td><td style={TD}>{num('exit2/betrag', sz.exit2.betrag, 'Tranche 2')}</td><td style={TD}>{mon('exit2/monat', sz.exit2.monat, 'Tranche 2 Monat')}</td><td colSpan={2} style={TD}></td></tr>
              </tbody>
            </Tabelle>
          </Karte>
          <Karte i={2}>
            <Ueberschrift rechts={<KnopfKlein onClick={() => void aendere([{ pfad: p('ereignisse/-'), neu: { id: neueKennung('e'), name: 'Neues Ereignis', einheit: business ? 'ug' : 'privat', betrag: 0, monat: 4 } }], `Szenario ${sz.name} · Ereignis angelegt`)}>+ Ereignis</KnopfKlein>}>{business ? 'Einmalige Ereignisse' : 'Lebensereignisse'} in „{sz.name}“</Ueberschrift>
            {ereignisse.length ? (
              <Tabelle klein>
                <thead><tr><th style={TH}>Was</th><th style={TH}>Wo</th><th style={THr}>Betrag</th><th style={TH}>Monat</th><th style={TH}></th></tr></thead>
                <tbody>{ereignisse.map(e => (
                  <tr key={e.id}>
                    <td style={TD}><TextFeld wert={e.name} onFertig={t => setze(`ereignisse/id=${e.id}/name`, e.name, t, `Ereignis ${e.name}`)} breite={150} titel="Was" /></td>
                    <td style={TD}><Auswahl wert={e.einheit} onWahl={v => setze(`ereignisse/id=${e.id}/einheit`, e.einheit, v, `Ereignis ${e.name} · Einheit`)} optionen={business ? [{ id: 'ug', label: `${UG_KURZ}` }] : [{ id: 'privat', label: 'Privat' }, { id: 'ug', label: `${UG_KURZ}` }]} titel="Einheit" /></td>
                    <td style={TDr}><ZahlFeld wert={e.betrag} dezimal={0} breite={96} onFertig={v => setze(`ereignisse/id=${e.id}/betrag`, e.betrag, v ?? 0, `Ereignis ${e.name}`)} titel="Betrag" /></td>
                    <td style={TD}><MonatWahl wert={e.monat} onWahl={m => setze(`ereignisse/id=${e.id}/monat`, e.monat, m, `Ereignis ${e.name} · Monat`)} monate={d.monate} /></td>
                    <td style={TD}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: p(`ereignisse/id=${e.id}`), alt: e.name }], `Ereignis ${e.name} entfernt`)} titel="Ereignis entfernen">−</KnopfKlein></td>
                  </tr>
                ))}</tbody>
              </Tabelle>
            ) : <Nichts>Einmalige Dinge — Umzug, Hochzeit, Auto, Laptop. Sie wirken nur in diesem Szenario.</Nichts>}
          </Karte>
        </Spalte>
        <Spalte>
          <AnnahmenAlle i={3} />
          <Karte i={4}>
            <Ueberschrift>Aktives Szenario</Ueberschrift>
            <Kacheln min={140}>
              <Kachel label={`Tiefpunkt ${UG_KURZ} frei`} wert={<><Geld v={Math.min(...ugAktiv.map(u => u.frei))} /> €</>} />
              <Kachel label="Retainer" wert={`${ugAktiv[2]?.retainerAnzahl ?? 0} → ${ugAktiv[8]?.retainerAnzahl ?? 0}`} unter="Dez 26 → Jun 27" />
              <Kachel label="Ereignisse" wert={String(ereignisse.length)} unter="in diesem Szenario" />
            </Kacheln>
          </Karte>
        </Spalte>
      </Spalten>
      <div style={{ ...MIKRO, margin: '18px 0 8px' }}>Steuern — welche gelten, wie hoch</div>
      {/* 05.10.: die Selbstständigkeit (Einkommensteuer gemeinsam mit Privat) gehört zu Privat — die Business-Sicht zeigt nur die Gesellschaften. */}
      {[...GESELLSCHAFTEN.filter(o => !business || o !== 'kdc'), ...(business ? [] : ['privat' as const])].map((o, k) => <SteuerKarte key={o} ort={o} i={5 + k} />)}
      <EinstellungenKarte i={9} />
      {!business && <SchwellenKarte i={10} />}
      {name !== null && (
        <Dialog titel="Szenario umbenennen" onZu={() => setName(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setName(null)}>Abbrechen</KnopfKlein><Knopf aus={!name.trim()} onClick={() => { const n = name.trim(); setName(null); if (n && n !== sz.name) void aendere([{ pfad: p('name'), alt: sz.name, neu: n }], `Szenario umbenannt: ${n}`); }}>Speichern</Knopf></>}>
          <input autoFocus value={name} aria-label="Name des Szenarios" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const n = name.trim(); setName(null); if (n && n !== sz.name) void aendere([{ pfad: p('name'), alt: sz.name, neu: n }], `Szenario umbenannt: ${n}`); } }} style={{ ...feld }} />
        </Dialog>
      )}
    </>
  );
}

// ── Ziele ────────────────────────────────────────────────────────────────────
const QUELLEN = [{ id: 'privat.angespart', label: 'Privat angespart' }, { id: 'ug.frei', label: `${UG_KURZ} frei verfügbar` }, { id: 'kdv.bjoern', label: 'Partnerdarlehen offen' }, { id: 'gruppe', label: 'Freies Geld Gruppe' }] as const;

export function Ziele() {
  const { d, dd, ug, kdc, pr, aendere, sicht } = usePlan();
  const business = sicht === 'business';
  // Business-Sicht: nur Messgrößen ohne Privat (MAKE frei, Partnerdarlehen).
  const quellen = business ? QUELLEN.filter(q => q.id === 'ug.frei' || q.id === 'kdv.bjoern') : QUELLEN;
  const zs = zielStaende(dd, ug, pr, kdc);
  const [plus, setPlus] = useState<Record<string, number>>({});
  const [neu, setNeu] = useState<string | null>(null);
  return (
    <>
      <Raster min={340}>
        {zs.map((s, i) => {
          const runter = s.ziel.quelle === 'kdv.bjoern'; const p = plus[s.ziel.id] ?? 0;
          let neuMonat: number | null = null;
          if (p && !runter) { const v = s.verlauf.map((x, j) => x + p * (j + 1)); const k = v.findIndex(x => x >= s.ziel.ziel); neuMonat = k >= 0 ? k + 1 : null; }
          return (
            <Karte key={s.ziel.id} i={i}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ flex: 1, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16 }}>{s.ziel.name}</span>
                <Etikett einheit={s.ziel.einheit} /><StatusPille status={s.status} />
              </div>
              <MiniLinie werte={s.verlauf} ziel={s.ziel.ziel} farbe={runter ? LEUCHT.puls : LILA} />
              <Formular>
                <Feld label="Ziel €"><ZahlFeld wert={s.ziel.ziel} dezimal={0} breite="100%" onFertig={v => void aendere([{ pfad: `/ziele/id=${s.ziel.id}/ziel`, alt: s.ziel.ziel, neu: v ?? 0 }], `Ziel ${s.ziel.name}`)} titel="Ziel" /></Feld>
                <Feld label="bis"><input type="month" value={s.ziel.bis} aria-label="bis" onChange={e => { if (e.target.value) void aendere([{ pfad: `/ziele/id=${s.ziel.id}/bis`, alt: s.ziel.bis, neu: e.target.value }], `Ziel ${s.ziel.name} · bis`); }} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', borderRadius: 10 }} /></Feld>
                <Feld label="Messgröße"><Auswahl wert={s.ziel.quelle} onWahl={v => void aendere([{ pfad: `/ziele/id=${s.ziel.id}/quelle`, alt: s.ziel.quelle, neu: v }], `Ziel ${s.ziel.name} · Messgröße`)} optionen={quellen} titel="Messgröße" /></Feld>
                <Feld label="erreicht"><div style={{ padding: '8px 0', fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{s.erreichtMonat ? monatLabel(d, s.erreichtMonat) : '—'}</div></Feld>
              </Formular>
              {!runter && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim }}>
                    <span style={{ flex: '0 0 auto' }}>Was wäre, wenn wir monatlich mehr zurücklegen</span>
                    <input type="range" min={0} max={1500} step={50} value={p} aria-label="Zusätzlich je Monat" onChange={e => setPlus({ ...plus, [s.ziel.id]: Number(e.target.value) })} style={{ flex: 1, accentColor: C.aktiv }} />
                    <span style={{ width: 64, textAlign: 'right' }}>+<Geld v={p} farbe={C.inkDim} /> €</span>
                  </div>
                  {p > 0 && <div style={{ fontSize: TYP.bedien, color: neuMonat ? LEUCHT.gut : C.inkLeise, marginTop: 4 }}>{neuMonat ? `→ erreicht ${monatLabel(d, neuMonat)}${s.erreichtMonat ? `, ${s.erreichtMonat - neuMonat} Monate früher` : ''}` : '→ im Planzeitraum weiter nicht erreicht'}</div>}
                </div>
              )}
              <div style={{ marginTop: 10, textAlign: 'right' }}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/ziele/id=${s.ziel.id}`, alt: s.ziel.name }], `Ziel entfernt: ${s.ziel.name}`)}>Ziel entfernen</KnopfKlein></div>
            </Karte>
          );
        })}
      </Raster>
      <div style={{ marginTop: 12 }}><Knopf onClick={() => setNeu('')}>+ Ziel</Knopf></div>
      {neu !== null && (
        <Dialog titel="Neues Ziel" onZu={() => setNeu(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setNeu(null)}>Abbrechen</KnopfKlein><Knopf aus={!neu.trim()} onClick={() => { const n = neu.trim(); setNeu(null); if (n) void aendere([{ pfad: '/ziele/-', neu: business ? { id: neueKennung('g'), name: n, quelle: 'ug.frei', ziel: 10000, bis: '2027-12', einheit: 'ug' } : { id: neueKennung('g'), name: n, quelle: 'privat.angespart', ziel: 10000, bis: '2027-12', einheit: 'privat' } }], `Ziel angelegt: ${n}`); }}>Anlegen</Knopf></>}>
          <input autoFocus value={neu} placeholder="Name des Ziels" aria-label="Name des Ziels" onChange={e => setNeu(e.target.value)} style={{ ...feld }} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Betrag, Datum und Messgröße stellst du danach auf der Karte ein.</div>
        </Dialog>
      )}
    </>
  );
}
