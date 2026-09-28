'use client';

// ─── Finanzplanung jetzt — Planen ────────────────────────────────────────────
// Privat (Blatt mit IST-Historie) · MAKE OS UG · Töpfe UG (Profit First) ·
// KD Ventures · Selbstständigkeit 2026 · Szenarien (Vergleich S1–S5, Treiber
// und Annahmen bearbeitbar) · Ziele (mit „Was wäre wenn“). Alle Zahlen kommen
// aus dem Rechenkern; das Blatt schreibt nur Zellen-Überschreibungen.

import { useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster, Spalten, Spalte, Knopf, LEUCHT, feld, Haken } from '../schlank';
import type { Szenario, Zeile } from '@/lib/finanzen/rechenkern';
import { wert, sollBudget, key, istSchnitt, toepfeUG, rechneSelbst, zielStaende } from '@/lib/finanzen/rechenkern';
import { BUDGET_GRUPPEN, eur, prozent, letzterVoller, monatLabel, neueKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan, rechne } from './daten';
import { Blatt, type BlattZeile, type DatenZeile, type ZeilenListe } from './Blatt';
import { ZeileDialog, neueZeileOp } from './ZeileDialog';
import { Geld, Kachel, Kacheln, Etikett, StatusPille, Tabelle, TH, THr, TD, TDr, TDleise, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, AnteilBalken, Dialog, Feld, Formular, Legende, KUPFER, LILA, Nichts, Schalter } from './teile';
import { Stapel, Linie, MiniLinie } from './diagramme';

/** Blatt + Zeilen-Dialog + neue Zeile — für Privat und UG gemeinsam. */
function useZeilenDialog() {
  const { aendere } = usePlan();
  const [offen, setOffen] = useState<string | null>(null);
  const neu = async (liste: ZeilenListe, gruppe?: string) => { const { op, id } = neueZeileOp(liste, gruppe); if (await aendere([op], 'Zeile angelegt')) setOffen(id); };
  const dialog = offen ? <ZeileDialog id={offen} onZu={() => setOffen(null)} /> : null;
  return { oeffne: setOffen, neu, dialog };
}

// ── Privat ──────────────────────────────────────────────────────────────────
export function Privat() {
  const { d, pr, h, sz, geh } = usePlan();
  const zd = useZeilenDialog();
  const L = letzterVoller(d);
  const P = (m: number) => pr[m - 1];
  const hz = (id: string) => (i: number) => (h.zeilen[id] ? Math.round(h.zeilen[id][i]) || null : null);
  const budgetZeile = (z: Zeile): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => sollBudget(z, m, d.plan), hist: hz(z.id), drill: z.id, ind: true, aus: true, z });
  const andere = d.privatBudget.filter(z => !(BUDGET_GRUPPEN as readonly string[]).includes(z.gruppe));
  const zeilen: BlattZeile[] = [
    { grp: 'Einnahmen', add: 'privatEinnahmen' },
    ...d.privatEinnahmen.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, d.plan), ind: true })),
    { name: 'Kevin netto', edit: 'p.kevinNetto', get: m => P(m).kevinNetto, ind: true },
    { name: 'Malin netto', edit: 'p.malinNetto', get: m => P(m).malinNetto, ind: true },
    { name: 'Verfügbar', sum: true, get: m => P(m).verfuegbar, hist: i => Math.round(h.einnahmen[i]) || null, drill: 'x.einnahme' },
    ...BUDGET_GRUPPEN.flatMap((g): BlattZeile[] => [{ grp: g, add: 'privatBudget', addG: g }, ...d.privatBudget.filter(z => z.gruppe === g).map(budgetZeile)]),
    ...(andere.length ? [{ grp: 'Weitere' } as BlattZeile, ...andere.map(budgetZeile)] : []),
    { name: 'Bedarf', sum: true, get: m => P(m).bedarf, hist: i => Math.round(h.ausgaben[i] - (h.zeilen['p.d.altlasten']?.[i] ?? 0)) || null, istGet: m => { let s = 0, n = 0; for (const z of d.privatBudget) { const k = key(z.id, m); if (k in d.ist) { s += d.ist[k]; n++; } } return n ? s : null; } },
    { grp: 'Schulden & Ereignisse', add: 'privatSchulden' },
    ...d.privatSchulden.map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, d.plan), hist: hz(z.id), drill: z.id, ind: true, aus: true })),
    { name: 'Lebensereignisse', get: m => P(m).ereignisse, ind: true },
    { grp: 'Ergebnis' },
    { name: 'Luft je Monat', get: m => P(m).luft, hist: i => Math.round(h.einnahmen[i] - h.ausgaben[i]) || null },
    { name: 'Sparen + Luft', sum: true, get: m => P(m).sparen },
    { name: 'Angespart', stock: true, key: true, get: m => P(m).angespart },
  ];
  const schnitt = (r: DatenZeile, k: number) => (r.z ? istSchnitt(h.zeilen[r.z.id], k, L) : r.drill === 'x.einnahme' ? istSchnitt(h.einnahmen, k, L) : null);
  const extra = [
    { h: 'Ø 3 M', t: 'IST der letzten drei vollen Monate', get: (r: DatenZeile) => { const v = schnitt(r, 3); return v == null ? '' : <span style={{ color: r.z && r.z.typ !== 'sparen' && v > r.z.soll * 1.1 ? LEUCHT.achtung : undefined }}>{eur(v)}</span>; } },
    { h: 'Ø 6 M', t: 'IST der letzten sechs vollen Monate', get: (r: DatenZeile) => { const v = schnitt(r, 6); return v == null ? '' : eur(v); } },
  ];
  const p1 = P(1);
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
        {topf('Sparen', p1?.sparenSoll ?? 0, 0, <>+ Luft <Geld v={p1?.luft} farbe={C.inkDim} /> € im Okt</>, LILA)}
        <Kachel label="Verfügbar Okt 26" wert={<><Geld v={p1?.verfuegbar} /> €</>} unter={<>Luft <Geld v={p1?.luft} /> € · Ø IST Einnahmen <Geld v={istSchnitt(h.einnahmen, 3, L)} farbe={C.inkDim} /> €</>} />
      </Kacheln>
      <Karte i={1}>
        <Blatt zeilen={zeilen} titel={`Privat · ${sz.name}`} hist extra={extra} werkzeuge={<Etikett einheit="privat" text="Kevin & Malin" />} onZeile={zd.oeffne} onNeueZeile={zd.neu} onDrill={(i, z) => geh('buchungen', { monat: i, zeile: z })} />
        <Hinweis>Lila Spalten = IST aus den Buchungen (Klick öffnet die Buchungen dahinter). Der laufende Monat bleibt bei Durchschnitten draußen. Brutto kommt aus der UG; Netto ist eine Näherung aus der Tabelle in den Annahmen.</Hinweis>
      </Karte>
      {zd.dialog}
    </>
  );
}

// ── MAKE OS UG ───────────────────────────────────────────────────────────────
export function UG() {
  const { d, ug, sz } = usePlan();
  const zd = useZeilenDialog();
  const U = (m: number) => ug[m - 1];
  const gruppen = Array.from(new Set(d.sachkosten.map(z => z.gruppe)));
  const zeilen: BlattZeile[] = [
    { grp: 'Umsatz netto' },
    { name: 'Ankermandat', edit: 'ug.ob', get: m => U(m).ob, ind: true }, { name: 'Retainer', edit: 'ug.retainer', get: m => U(m).retainer, ind: true },
    { name: 'ASTARNA', edit: 'ug.astarna', get: m => U(m).astarna, ind: true }, { name: 'Events', edit: 'ug.events', get: m => U(m).events, ind: true },
    { name: 'Umsatz', sum: true, get: m => U(m).umsatz },
    { grp: 'Personal' },
    { name: 'Kevin brutto', edit: 'ug.kevin', get: m => U(m).kevinBrutto, ind: true, aus: true }, { name: 'Malin brutto', edit: 'ug.malin', get: m => U(m).malinBrutto, ind: true, aus: true },
    { name: 'Unterstützung', edit: 'ug.unterstuetzung', get: m => U(m).unterstuetzung, ind: true, aus: true },
    { name: 'Personal inkl. Arbeitgeber', sum: true, get: m => U(m).kevin + U(m).malin + U(m).unterstuetzung },
    { grp: 'Sachkosten', add: 'sachkosten' },
    ...gruppen.flatMap(g => d.sachkosten.filter(z => z.gruppe === g).map((z): DatenZeile => ({ name: z.name, zeile: z.id, edit: z.id, get: m => wert(z, m, d.plan), ind: true, aus: true }))),
    { name: 'Sachkosten inkl. Ereignisse', sum: true, get: m => U(m).sach },
    { grp: 'Zahlungsfluss' },
    { name: 'Retainer-Eingang', get: m => U(m).retainerEingang, ind: true }, { name: 'USt vereinnahmt', get: m => U(m).ustEin, ind: true },
    { name: 'Stammkapital & Darlehen Kevin', get: m => U(m).kapital, ind: true }, { name: 'Einzahlungen', sum: true, get: m => U(m).einzahlungen },
    { name: 'Gründung', get: m => -U(m).gruendung, ind: true }, { name: 'Holding-Umlage', get: m => -U(m).holding, ind: true },
    { name: 'USt an Finanzamt', get: m => -U(m).ustZahlung, ind: true }, { name: 'Ertragsteuer', get: m => -U(m).steuer, ind: true },
    { name: 'Partnerdarlehen-Rate', get: m => -U(m).bjoern, ind: true }, { name: 'Darlehen an Kevin zurück', get: m => -U(m).darlehen, ind: true },
    { name: 'Auszahlungen', sum: true, get: m => -U(m).auszahlungen },
    { grp: 'Ergebnis' },
    { name: 'Gewinn', get: m => U(m).gewinn }, { name: 'Kontostand', stock: true, get: m => U(m).konto },
    { name: 'Steuerrücklage', stock: true, get: m => -U(m).steuerRuecklage }, { name: 'USt offen', stock: true, get: m => -U(m).ustOffen },
    { name: 'Frei verfügbar', stock: true, sum: true, key: true, get: m => U(m).frei },
  ];
  return (
    <Karte i={0}>
      <Blatt zeilen={zeilen} titel={`MAKE OS UG · ${sz.name}`} werkzeuge={<Etikett einheit="ug" />} onZeile={zd.oeffne} onNeueZeile={zd.neu} />
      <Hinweis>Umsatzzeilen und Gehälter kommen aus dem Szenario (Planen › Szenarien); eine überschriebene Zelle gewinnt. Ertragsteuer als Näherung — Hinweis, keine Steuerberatung.</Hinweis>
      {zd.dialog}
    </Karte>
  );
}

// ── Töpfe UG ─────────────────────────────────────────────────────────────────
export function Toepfe() {
  const { d, ug, aendere } = usePlan();
  const t = toepfeUG(ug, d.einstellungen.reserveMonate);
  const farben = [C.inkLeise, LEUCHT.achtung, LEUCHT.puls, KUPFER];
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>Reserve <Auswahl wert={String(d.einstellungen.reserveMonate)} onWahl={v => void aendere([{ pfad: '/einstellungen/reserveMonate', alt: d.einstellungen.reserveMonate, neu: Number(v) }], 'Reserve UG')} optionen={[0, 1, 2, 3].map(n => ({ id: String(n), label: `${n} Monatskosten` }))} titel="Reserve in Monatskosten" /></span>}>Wem gehört das Geld auf dem UG-Konto</Ueberschrift>
        <Legende eintraege={[{ farbe: farben[0], text: 'USt (Finanzamt)' }, { farbe: farben[1], text: 'Steuerrücklage' }, { farbe: farben[2], text: 'Reserve' }, { farbe: farben[3], text: 'frei' }]} />
        <div style={{ marginTop: 8 }}><Stapel stapel={t.map(x => [x.ust, x.steuer, x.reserve, x.frei])} labels={d.monate} farben={farben} namen={['USt', 'Steuer', 'Reserve', 'frei']} /></div>
        <Hinweis>Profit First, angepasst: Jeder Eingang wird gedanklich verteilt — erst Finanzamt, dann Steuer, dann Reserve, der Rest ist frei. Vorschlag: bei der Bank je Topf ein Unterkonto und einmal im Monat umbuchen.</Hinweis>
      </Karte>
      <Karte i={1}>
        <Tabelle klein>
          <thead><tr><th style={TH}>Monat</th><th style={THr}>Konto</th><th style={THr}>USt</th><th style={THr}>Steuer</th><th style={THr}>Reserve</th><th style={THr}>Reserve-Ziel</th><th style={THr}>frei</th></tr></thead>
          <tbody>{t.map(x => <tr key={x.m}><td style={TD}>{monatLabel(d, x.m)}</td><td style={TDr}><Geld v={x.konto} /></td><td style={TDr}><Geld v={x.ust} farbe={C.inkDim} /></td><td style={TDr}><Geld v={x.steuer} farbe={C.inkDim} /></td><td style={TDr}><Geld v={x.reserve} farbe={x.reserve < x.reserveZiel - 1 ? LEUCHT.achtung : undefined} /></td><td style={TDr}><Geld v={x.reserveZiel} farbe={C.inkLeise} /></td><td style={TDr}><Geld v={x.frei} /></td></tr>)}</tbody>
        </Tabelle>
      </Karte>
    </>
  );
}

// ── KD Ventures ──────────────────────────────────────────────────────────────
export function KDV() {
  const { ug, sz } = usePlan();
  const U = (m: number) => ug[m - 1];
  const zeilen: BlattZeile[] = [
    { grp: 'Einnahmen' }, { name: 'Umlage aus MAKE OS UG', get: m => U(m).kdvUmlage, ind: true }, { name: 'Partnerdarlehen-Rate von der UG', get: m => U(m).kdvBjoernEin, ind: true }, { name: 'KEMARIS Ausstieg', get: m => U(m).kdvExit, ind: true },
    { grp: 'Ausgaben' }, { name: 'Holdingkosten', get: m => -U(m).kdvHolding, ind: true }, { name: 'Partnerdarlehen-Tilgung', get: m => -U(m).kdvBjoern, ind: true }, { name: 'Partnerdarlehen-Ablösung', get: m => -U(m).kdvAbloesung, ind: true }, { name: 'Steuer auf Ausstieg', get: m => -U(m).kdvExitSteuer, ind: true },
    { grp: 'Stand' }, { name: 'Kontostand KD Ventures', stock: true, sum: true, key: true, get: m => U(m).kdvKonto }, { name: 'Partnerdarlehen offen', stock: true, get: m => U(m).bjoernRest },
  ];
  return (
    <Karte i={0}>
      <Blatt zeilen={zeilen} titel={`KD Ventures · ${sz.name}`} werkzeuge={<Etikett einheit="kdv" />} />
      <Hinweis>KD Ventures rechnet aus der UG (Umlage, Partnerdarlehen-Rate) und dem Szenario (Ausstieg, Ablösung). Treiber unter Planen › Szenarien, Beträge unter „Annahmen für alle“.</Hinweis>
    </Karte>
  );
}

// ── Selbstständigkeit 2026 ───────────────────────────────────────────────────
export function Selbst() {
  const { d, aendere } = usePlan();
  const r = rechneSelbst(d); const s = d.selbst;
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
              {zeile('Einnahmen', <><Geld v={r.ein} dezimal={2} /> €</>)}
              {zeile('Ausgaben', <>−<Geld v={r.aus} dezimal={2} /> €</>)}
              {zeile('Gewinn', <><Geld v={r.gewinn} dezimal={2} /> €</>, true)}
              {zeile('Vorsorge', <ZahlFeld wert={s.vorsorge} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/vorsorge', alt: s.vorsorge, neu: v ?? 0 }], 'Selbstständigkeit Vorsorge')} titel="Vorsorge" />)}
              {zeile('Sonderausgaben', <ZahlFeld wert={s.sonderausgaben} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/sonderausgaben', alt: s.sonderausgaben, neu: v ?? 0 }], 'Selbstständigkeit Sonderausgaben')} titel="Sonderausgaben" />)}
              {zeile('zu versteuern', <><Geld v={r.zve} /> €</>)}
              {zeile('Einkommensteuer 2026 (Näherung)', <><Geld v={r.est} farbe={r.est > 0 ? LEUCHT.achtung : undefined} /> €</>, true)}
              {zeile('Kontostand heute', <ZahlFeld wert={s.kontoStart} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/kontoStart', alt: s.kontoStart, neu: v ?? 0 }], 'Selbstständigkeit Kontostand')} titel="Kontostand" />)}
              {zeile('Darlehen an die UG', <ZahlFeld wert={s.darlehenAnUG} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/darlehenAnUG', alt: s.darlehenAnUG, neu: v ?? 0 }], 'Selbstständigkeit Darlehen an UG')} titel="Darlehen an die UG" />)}
              {zeile('Sicherheit Steuer', <ZahlFeld wert={s.sicherheit} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/sicherheit', alt: s.sicherheit, neu: v ?? 0 }], 'Selbstständigkeit Sicherheit')} titel="Sicherheit Steuer" />)}
              {zeile('Frei nach Abschluss', <><Geld v={r.frei} /> €</>, true)}
              {zeile('Ablösung', <ZahlFeld wert={s.consorsAbloesung} dezimal={0} onFertig={v => void aendere([{ pfad: '/selbst/consorsAbloesung', alt: s.consorsAbloesung, neu: v ?? 0 }], 'Selbstständigkeit Ablösung')} titel="Ablösung" />)}
              {zeile('nach Ablösung', <><Geld v={r.nachConsors} /> €</>)}
            </tbody>
          </Tabelle>
          <Hinweis>Grundtarif 2026 (§ 32a EStG) als Näherung, Gewerbesteuer unter Freibetrag angenommen, Gründungszuschuss steuerfrei — Hinweis, keine Steuerberatung.</Hinweis>
        </Karte>
      </Spalte>
    </Spalten>
  );
}

// ── Szenarien ────────────────────────────────────────────────────────────────
const ANNAHMEN: [string, string, number][] = [['kevinBrutto', 'Kevin brutto', 0], ['kevinAb', 'Kevin ab Monat', 0], ['malinBrutto', 'Malin brutto', 0], ['malinAb', 'Malin ab Monat', 0], ['agAnteil', 'Arbeitgeberanteil', 4], ['stammkapital', 'Stammkapital', 0], ['gruendungskosten', 'Gründungskosten', 0], ['darlehenKevin', 'Darlehen Kevin an UG', 0], ['darlehenRueckMonat', 'Rückzahlung in Monat', 0], ['retainerVerzug', 'Retainer-Zahlungsverzug (Monate)', 0], ['astarnaProvision', 'ASTARNA Provision', 0], ['steuerUG', 'Ertragsteuer UG', 4], ['ust', 'Umsatzsteuer', 4], ['steuerMonat', 'Steuer gezahlt im Kalendermonat', 0], ['holdingKosten', 'Holdingkosten', 0], ['holdingAb', 'Holding ab Monat', 0], ['kdvStart', 'KD Ventures Start', 0], ['bjoernBetrag', 'Partnerdarlehen', 0], ['bjoernRate', 'Partnerdarlehen Rate', 0], ['bjoernRateVon', 'Partnerdarlehen Rate ab Monat', 0], ['bjoernRateBis', 'Partnerdarlehen Rate bis Monat', 0], ['bjoernSchluss', 'Partnerdarlehen Schlussrate', 0], ['bjoernSchlussMonat', 'Schlussrate in Monat', 0], ['bjoernZinsMonat', 'Partnerdarlehen Zins je Monat', 0], ['bjoernZinsDeckel', 'Partnerdarlehen Zins-Deckel', 0], ['exitSteuer', 'Steuer auf Ausstieg', 4], ['gehaltTag', 'Gehaltstag', 0]];
const FARBEN_SZ = [KUPFER, LEUCHT.achtung, LEUCHT.kritisch, LEUCHT.puls, LILA, C.inkDim, C.ink];

export function Szenarien() {
  const { d, sz, ps, aendere, ug: ugAktiv } = usePlan();
  const alle = useMemo(() => d.szenarien.map(s => ({ s, ...rechne(d, s) })), [d]);
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
        <Ueberschrift rechts={ps ? <span style={{ color: C.inkLeise, fontSize: 12 }}>gerechnet mit den Bausteinen von „{ps.name}“</span> : undefined}>Treiber im Vergleich — Klick wählt den Treiber{ps ? ' für den Arbeitsplan' : ''}</Ueberschrift>
        <Tabelle klein>
          <thead><tr><th style={TH}>Szenario</th><th style={THr}>Tiefpunkt frei</th><th style={THr}>Monate im Minus</th><th style={THr}>frei Dez 26</th><th style={THr}>frei Dez 27</th><th style={THr}>frei Dez 28</th><th style={THr}>Umsatz 2027</th><th style={THr}>OB-Anteil Jun 27</th><th style={THr}>Privat angespart Dez 27</th><th style={THr}>Gruppe Dez 28</th></tr></thead>
          <tbody>
            {alle.map(({ s: x, kz }) => (
              <tr key={x.id} onClick={() => { if (x.id === sz.id) return; void aendere([{ pfad: '/aktiv', alt: d.aktiv, neu: x.id }, ...(ps ? [{ pfad: `/planszenarien/id=${ps.id}/basis`, alt: ps.basis, neu: x.id }] : [])], `Treiber ${x.name} aktiv`); }} style={zeileStil(x.id === sz.id)}>
                <td style={{ ...TD, fontWeight: x.id === sz.id ? 700 : 500, color: x.id === sz.id ? C.aktiv : C.ink }}>{x.name}</td>
                <td style={TDr}><Geld v={kz.minFrei} /> <span style={{ color: C.inkLeise, fontSize: 11.5 }}>{monatLabel(d, kz.minMonat)}</span></td>
                <td style={{ ...TDr, color: kz.monateMinus ? LEUCHT.kritisch : C.ink }}>{kz.monateMinus}</td>
                <td style={TDr}><Geld v={kz.freiDez26} /></td><td style={TDr}><Geld v={kz.freiDez27} /></td><td style={TDr}><Geld v={kz.freiDez28} /></td>
                <td style={TDr}><Geld v={kz.umsatz2027} /></td><td style={TDr}>{prozent(kz.obAnteilJun27)}</td><td style={TDr}><Geld v={kz.privatAngespartDez27} /></td>
                <td style={TDr}><Geld v={kz.gruppeDez28} gross={false} stil={{ fontWeight: 700 }} /></td>
              </tr>
            ))}
          </tbody>
        </Tabelle>
        <div style={{ marginTop: 12 }}>
          <Legende eintraege={alle.map(({ s: x }, i) => ({ farbe: FARBEN_SZ[i % FARBEN_SZ.length], text: `${x.name} — UG frei` }))} />
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
            <Ueberschrift rechts={<KnopfKlein onClick={() => void aendere([{ pfad: p('ereignisse/-'), neu: { id: neueKennung('e'), name: 'Neues Ereignis', einheit: 'privat', betrag: 0, monat: 4 } }], `Szenario ${sz.name} · Ereignis angelegt`)}>+ Ereignis</KnopfKlein>}>Lebensereignisse in „{sz.name}“</Ueberschrift>
            {ereignisse.length ? (
              <Tabelle klein>
                <thead><tr><th style={TH}>Was</th><th style={TH}>Wo</th><th style={THr}>Betrag</th><th style={TH}>Monat</th><th style={TH}></th></tr></thead>
                <tbody>{ereignisse.map(e => (
                  <tr key={e.id}>
                    <td style={TD}><TextFeld wert={e.name} onFertig={t => setze(`ereignisse/id=${e.id}/name`, e.name, t, `Ereignis ${e.name}`)} breite={150} titel="Was" /></td>
                    <td style={TD}><Auswahl wert={e.einheit} onWahl={v => setze(`ereignisse/id=${e.id}/einheit`, e.einheit, v, `Ereignis ${e.name} · Einheit`)} optionen={[{ id: 'privat', label: 'Privat' }, { id: 'ug', label: 'UG' }]} titel="Einheit" /></td>
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
          <Karte i={3}>
            <Ueberschrift>Annahmen für alle Szenarien</Ueberschrift>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {ANNAHMEN.map(([k, n, dez]) => { const v = (a as unknown as Record<string, number | undefined>)[k] ?? 0; return <Feld key={k} label={n}><ZahlFeld wert={v} dezimal={dez} breite="100%" onFertig={x => void aendere([{ pfad: `/annahmen/${k}`, alt: v, neu: x ?? 0 }], `Annahme ${n}`)} titel={n} /></Feld>; })}
            </div>
            <Hinweis>Anteile als Dezimalzahl (0,19 = 19 %). Monate zählen ab Okt 26 = 1. Die Netto-Tabelle (Brutto → Netto) steht in den Annahmen des Dokuments und ist eine Näherung — Hinweis, keine Steuerberatung.</Hinweis>
          </Karte>
          <Karte i={4}>
            <Ueberschrift>Aktives Szenario</Ueberschrift>
            <Kacheln min={140}>
              <Kachel label="Tiefpunkt UG frei" wert={<><Geld v={Math.min(...ugAktiv.map(u => u.frei))} /> €</>} />
              <Kachel label="Retainer" wert={`${ugAktiv[2]?.retainerAnzahl ?? 0} → ${ugAktiv[8]?.retainerAnzahl ?? 0}`} unter="Dez 26 → Jun 27" />
              <Kachel label="Ereignisse" wert={String(ereignisse.length)} unter="in diesem Szenario" />
            </Kacheln>
          </Karte>
        </Spalte>
      </Spalten>
      {name !== null && (
        <Dialog titel="Szenario umbenennen" onZu={() => setName(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setName(null)}>Abbrechen</KnopfKlein><Knopf aus={!name.trim()} onClick={() => { const n = name.trim(); setName(null); if (n && n !== sz.name) void aendere([{ pfad: p('name'), alt: sz.name, neu: n }], `Szenario umbenannt: ${n}`); }}>Speichern</Knopf></>}>
          <input autoFocus value={name} aria-label="Name des Szenarios" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const n = name.trim(); setName(null); if (n && n !== sz.name) void aendere([{ pfad: p('name'), alt: sz.name, neu: n }], `Szenario umbenannt: ${n}`); } }} style={{ ...feld }} />
        </Dialog>
      )}
    </>
  );
}

// ── Ziele ────────────────────────────────────────────────────────────────────
const QUELLEN = [{ id: 'privat.angespart', label: 'Privat angespart' }, { id: 'ug.frei', label: 'UG frei verfügbar' }, { id: 'kdv.bjoern', label: 'Partnerdarlehen offen' }, { id: 'gruppe', label: 'Freies Geld Gruppe' }] as const;

export function Ziele() {
  const { d, ug, pr, aendere } = usePlan();
  const zs = zielStaende(d, ug, pr);
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
                <Feld label="Messgröße"><Auswahl wert={s.ziel.quelle} onWahl={v => void aendere([{ pfad: `/ziele/id=${s.ziel.id}/quelle`, alt: s.ziel.quelle, neu: v }], `Ziel ${s.ziel.name} · Messgröße`)} optionen={QUELLEN} titel="Messgröße" /></Feld>
                <Feld label="erreicht"><div style={{ padding: '8px 0', fontSize: TYP.bedien, fontVariantNumeric: 'tabular-nums' }}>{s.erreichtMonat ? monatLabel(d, s.erreichtMonat) : '—'}</div></Feld>
              </Formular>
              {!runter && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
                    <span style={{ flex: '0 0 auto' }}>Was wäre, wenn wir monatlich mehr zurücklegen</span>
                    <input type="range" min={0} max={1500} step={50} value={p} aria-label="Zusätzlich je Monat" onChange={e => setPlus({ ...plus, [s.ziel.id]: Number(e.target.value) })} style={{ flex: 1, accentColor: C.aktiv }} />
                    <span style={{ width: 64, textAlign: 'right' }}>+<Geld v={p} farbe={C.inkDim} /> €</span>
                  </div>
                  {p > 0 && <div style={{ fontSize: 12.5, color: neuMonat ? LEUCHT.gut : C.inkLeise, marginTop: 4 }}>{neuMonat ? `→ erreicht ${monatLabel(d, neuMonat)}${s.erreichtMonat ? `, ${s.erreichtMonat - neuMonat} Monate früher` : ''}` : '→ im Planzeitraum weiter nicht erreicht'}</div>}
                </div>
              )}
              <div style={{ marginTop: 10, textAlign: 'right' }}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/ziele/id=${s.ziel.id}`, alt: s.ziel.name }], `Ziel entfernt: ${s.ziel.name}`)}>Ziel entfernen</KnopfKlein></div>
            </Karte>
          );
        })}
      </Raster>
      <div style={{ marginTop: 12 }}><Knopf onClick={() => setNeu('')}>+ Ziel</Knopf></div>
      {neu !== null && (
        <Dialog titel="Neues Ziel" onZu={() => setNeu(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setNeu(null)}>Abbrechen</KnopfKlein><Knopf aus={!neu.trim()} onClick={() => { const n = neu.trim(); setNeu(null); if (n) void aendere([{ pfad: '/ziele/-', neu: { id: neueKennung('g'), name: n, quelle: 'privat.angespart', ziel: 10000, bis: '2027-12', einheit: 'privat' } }], `Ziel angelegt: ${n}`); }}>Anlegen</Knopf></>}>
          <input autoFocus value={neu} placeholder="Name des Ziels" aria-label="Name des Ziels" onChange={e => setNeu(e.target.value)} style={{ ...feld }} />
          <div style={{ fontSize: 12.5, color: C.inkLeise }}>Betrag, Datum und Messgröße stellst du danach auf der Karte ein.</div>
        </Dialog>
      )}
    </>
  );
}
