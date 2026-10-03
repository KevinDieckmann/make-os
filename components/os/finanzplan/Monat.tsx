'use client';

// ─── Finanzplanung jetzt — Monat: Budget und Buchungen ──────────────────────
// Budget (YNAB/Copilot): jeder Topf als Balken, der Strich ist heute, dazu
// Prognose zum Monatsende und Rest je Tag; Monat abschließen mit Übertrag der
// flexiblen Töpfe. Buchungen: Planzeile wählen, „merken“ = Regel für den
// Empfänger (rückwirkend), „+ Buchung“ für Bargeld und Fehlendes.

import { useMemo, useState } from 'react';
import { FARBE as C, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Spalten, Spalte, Knopf, LEUCHT, Chip } from '../ui';
import { sollBudget, tempo, histIndex } from '@/lib/finanzen/rechenkern';
import type { Buchung } from '@/lib/finanzen/rechenkern';
import { achse, heuteIndex, tageIm, planMonatAus, eur, prozent, tagKurz, zeileName, alleZeilen, offeneBuchungen, SONDER_ZEILEN, BUDGET_GRUPPEN, neueKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { Geld, Kachel, Kacheln, Tabelle, TH, THr, TD, TDr, TDleise, Gruppenzeile, AnteilBalken, KnopfKlein, Auswahl, Hinweis, Dialog, Feld, Formular, TextFeld, Etikett, Schalter, StatusPille, PersonMarke, auswahlStil, eingabeStil, Nichts, LILA } from './teile';

const KONTEN = [{ id: 'gemeinsam', label: 'Gemeinsam' }, { id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'bar', label: 'Bar' }];

/** Auswahl aller Planzeilen für eine Buchung — Budget · Schulden · Einnahmen & Sonstiges. */
function ZeilenAuswahl({ wert, onWahl, offen, breite = 220 }: { wert: string; onWahl: (z: string) => void; offen?: boolean; breite?: number | string }) {
  const { d } = usePlan();
  return (
    <select value={wert} aria-label="Planzeile" onChange={e => onWahl(e.target.value)} style={{ ...auswahlStil, width: breite, maxWidth: '100%', borderColor: offen ? `${LEUCHT.achtung}99` : undefined }}>
      <optgroup label="Budget">{d.privatBudget.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>
      <optgroup label="Schulden">{d.privatSchulden.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>
      <optgroup label="Einnahmen & Sonstiges">{Object.entries(SONDER_ZEILEN).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</optgroup>
      {!alleZeilen(d).some(z => z.id === wert) && !(wert in SONDER_ZEILEN) && <option value={wert}>{wert}</option>}
    </select>
  );
}

// ── Budget ──────────────────────────────────────────────────────────────────
export function Budget() {
  const { d, pr, h, aendere, geh, params, person } = usePlan();
  const lab = achse(d); const heuteIdx = heuteIndex(d);
  const [idx, setIdx] = useState(() => { const p = Number(params.get('monat')); return Number.isInteger(p) && p >= 0 && p < lab.length ? p : heuteIdx; });
  const m = planMonatAus(idx, d);
  const laufend = idx === heuteIdx, zukunft = idx > heuteIdx, tim = tageIm(idx);
  const tag = laufend ? Number(d.einstellungen.heute.slice(8)) : zukunft ? 0 : tim;
  const vorPlan = idx < d.historie.length;
  const p = pr[m - 1];
  const abg = d.abschluesse.find(a => a.idx === idx);
  const [frage, setFrage] = useState(false);
  const istAus = h.ausgaben[idx] - (h.zeilen['p.d.altlasten']?.[idx] ?? 0), planAus = p?.bedarf ?? 0;
  const flex = d.privatBudget.filter(z => z.typ === 'flex');
  const uebertrag = flex.reduce((s, z) => s + sollBudget(z, m, d.plan) - (h.zeilen[z.id]?.[idx] ?? 0), 0);
  const offenAnzahl = d.buchungen.filter(b => histIndex(b.d) === idx && b.z === 'x.offen').length;

  const zeile = (z: { id: string; name: string; typ?: string }) => {
    const plan = sollBudget(z as Parameters<typeof sollBudget>[0], m, d.plan), ist = h.zeilen[z.id]?.[idx] ?? 0;
    const t = tempo(ist, plan, tag, tim); const ueber = ist > plan + 0.5;
    const warn = z.typ === 'flex' && !zukunft && t.prognose > plan * 1.05;
    const farbe = ueber ? LEUCHT.kritisch : warn ? LEUCHT.achtung : z.typ === 'sparen' ? LILA : C.aktiv;
    return (
      <tr key={z.id} onClick={() => geh('buchungen', { monat: idx, zeile: z.id })} style={{ cursor: 'pointer' }} title="Buchungen dieses Topfs öffnen">
        <td style={TD}>{z.name}</td>
        <td style={{ ...TD, width: '32%', minWidth: 120 }}><AnteilBalken anteil={plan ? ist / plan : ist ? 1 : 0} farbe={farbe} marke={laufend && z.typ === 'flex' ? t.anteilZeit : undefined} /></td>
        <td style={TDr}><Geld v={ist} /></td>
        <td style={TDr}><Geld v={plan} farbe={C.inkLeise} /></td>
        <td style={TDr}><Geld v={plan - ist} /></td>
        <td style={TDr}>{laufend && z.typ === 'flex' ? <Geld v={t.prognose} farbe={warn ? LEUCHT.achtung : C.inkLeise} /> : ''}</td>
        <td style={TDr}>{laufend && z.typ === 'flex' && plan > ist ? <Geld v={t.restProTag} farbe={C.inkLeise} /> : ''}</td>
      </tr>
    );
  };
  const abschliessen = () => {
    setFrage(false);
    void aendere([{ pfad: '/abschluesse/-', neu: { idx, wer: person || 'kevin', wann: new Date().toISOString(), uebertrag } }], `Monat abgeschlossen ${lab[idx]} · Übertrag Flexibel ${eur(uebertrag)} €`);
  };
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <KnopfKlein farbe={C.inkDim} onClick={() => setIdx(Math.max(0, idx - 1))} aus={idx === 0} titel="Vormonat">‹</KnopfKlein>
        <Auswahl wert={String(idx)} onWahl={v => setIdx(Number(v))} optionen={lab.map((l, j) => ({ id: String(j), label: `${l}${j === heuteIdx ? ' · jetzt' : ''}` }))} titel="Monat" />
        <KnopfKlein farbe={C.inkDim} onClick={() => setIdx(Math.min(lab.length - 1, idx + 1))} aus={idx === lab.length - 1} titel="Folgemonat">›</KnopfKlein>
        {abg && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><StatusPille status="abgeschlossen" /><PersonMarke wer={abg.wer} mitName /></span>}
        <span style={{ flex: 1 }} />
        {!zukunft && !laufend && !abg && <Knopf onClick={() => (h.offen[idx] ? setFrage(true) : abschliessen())}>Monat abschließen</Knopf>}
      </div>
      <Kacheln min={160}>
        <Kachel label="Einnahmen" wert={<><Geld v={h.einnahmen[idx]} farbe={LEUCHT.gut} /> €</>} unter={<>Plan <Geld v={p?.verfuegbar} farbe={C.inkDim} /> €{h.einmalig[idx] ? <> · davon einmalig <Geld v={h.einmalig[idx]} farbe={C.inkDim} /></> : null}</>} />
        <Kachel label="Ausgegeben" wert={<><Geld v={istAus} /> €</>} unter={<>Plan <Geld v={planAus} farbe={C.inkDim} /> € · {laufend ? `Tag ${tag} von ${tim}` : zukunft ? 'noch nicht begonnen' : 'Monat vorbei'}</>} />
        <Kachel label="Übrig" wert={<><Geld v={h.einnahmen[idx] - h.ausgaben[idx]} /> €</>} unter={<>Plan-Luft <Geld v={p?.luft} farbe={C.inkDim} /> €</>} />
        <Kachel label="Zuordnung" wert={<><Geld v={h.offen[idx]} farbe={h.offen[idx] ? LEUCHT.achtung : undefined} /> €</>} unter={`${offenAnzahl} Buchungen offen · ${h.anzahl[idx]} gesamt`} />
      </Kacheln>
      <Karte i={1}>
        <Tabelle klein>
          <thead><tr><th style={TH}>Topf</th><th style={TH}></th><th style={THr}>IST</th><th style={THr}>Plan</th><th style={THr}>Rest</th><th style={THr}>Prognose</th><th style={THr}>je Tag</th></tr></thead>
          <tbody>
            {BUDGET_GRUPPEN.map(g => { const zs = d.privatBudget.filter(z => z.gruppe === g); return zs.length ? [<Gruppenzeile key={`g-${g}`} text={g} spalten={7} />, ...zs.map(zeile)] : null; })}
            {d.privatSchulden.length > 0 && <Gruppenzeile text="Schulden" spalten={7} />}
            {d.privatSchulden.map(zeile)}
            {!d.privatBudget.length && <tr><td colSpan={7} style={TDleise}>Noch keine Budget-Zeilen — unter Planen › Privat anlegen.</td></tr>}
          </tbody>
        </Tabelle>
        <Hinweis>{vorPlan ? 'Vor Oktober gab es keinen Plan — Maßstab ist das Budget ab Okt 26. ' : ''}{laufend ? 'Der Strich im Balken ist der heutige Tag: liegt der Balken davor, seid ihr im Tempo. ' : ''}Klick auf einen Topf öffnet die Buchungen.</Hinweis>
      </Karte>
      {frage && (
        <Dialog titel="Monat abschließen?" onZu={() => setFrage(false)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setFrage(false)}>Erst zuordnen</KnopfKlein><Knopf onClick={abschliessen}>Trotzdem abschließen</Knopf></>}>
          <div><Geld v={h.offen[idx]} farbe={LEUCHT.achtung} /> € in {offenAnzahl} Buchungen sind noch nicht zugeordnet. Der Übertrag der flexiblen Töpfe wäre <Geld v={uebertrag} /> €.</div>
        </Dialog>
      )}
    </>
  );
}

// ── Buchungen ───────────────────────────────────────────────────────────────
export function Buchungen() {
  const { d, h, aendere, params } = usePlan();
  const lab = achse(d);
  const [monat, setMonat] = useState(() => { const p = Number(params.get('monat')); return Number.isInteger(p) && p >= 0 && p < lab.length ? p : Math.max(0, heuteIndex(d) - 1); });
  const [konto, setKonto] = useState('alle');
  const [zeile, setZeile] = useState(params.get('zeile') ?? 'alle');
  const [suche, setSuche] = useState('');
  const [nurOffen, setNurOffen] = useState(false);
  const [mehr, setMehr] = useState(0);
  const [merken, setMerken] = useState<Record<string, boolean>>({});
  const [neu, setNeu] = useState<null | { d: string; b: string; n: string; k: string; z: string; notiz: string }>(null);
  const monatAlle = useMemo(() => d.buchungen.filter(b => histIndex(b.d) === monat), [d.buchungen, monat]);
  const liste = useMemo(() => {
    let l = monatAlle;
    if (konto !== 'alle') l = l.filter(b => b.k === konto);
    if (zeile !== 'alle') l = l.filter(b => b.z === zeile);
    if (nurOffen) l = l.filter(b => b.z === 'x.offen');
    if (suche.trim()) { const q = suche.trim().toLowerCase(); l = l.filter(b => b.n.toLowerCase().includes(q) || (b.notiz ?? '').toLowerCase().includes(q)); }
    return [...l].sort((a, b) => b.d.localeCompare(a.d));
  }, [monatAlle, konto, zeile, nurOffen, suche]);
  const aus: Record<string, number> = {};
  for (const b of monatAlle) if (b.b < 0 && !b.z.startsWith('x.')) aus[b.z] = (aus[b.z] ?? 0) - b.b;
  const gesamt = Object.values(aus).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(aus).sort((a, b) => b[1] - a[1]);
  const grenze = 200 + mehr;
  const konten = Array.from(new Set(d.buchungen.map(b => b.k)));

  const zuordnen = (b: Buchung, z: string) => {
    const merk = merken[b.id] ?? true;
    if (merk) void aendere([{ pfad: `/regeln/${b.n.toLowerCase()}`, alt: zeileName(d, b.z), neu: z, feld: `Regel ${b.n}` }], `Buchung ${b.n} → ${zeileName(d, z)} (Regel gemerkt)`);
    else void aendere([{ pfad: `/buchungen/id=${b.id}/z`, alt: b.z, neu: z }], `Buchung ${b.n} ${tagKurz(b.d)} → ${zeileName(d, z)}`);
  };
  const speichernNeu = async () => {
    if (!neu) return;
    const betrag = Number(String(neu.b).replace(/\./g, '').replace(',', '.'));
    if (!neu.n.trim() || !Number.isFinite(betrag) || !neu.d) return;
    const b: Buchung = { id: neueKennung('h'), d: neu.d, b: betrag, n: neu.n.trim(), k: neu.k, z: neu.z, hand: true, ...(neu.notiz.trim() ? { notiz: neu.notiz.trim() } : {}) };
    if (await aendere([{ pfad: '/buchungen/-', neu: b }], `Buchung erfasst: ${b.n} ${eur(b.b, 2)} €`)) { setNeu(null); setMonat(Math.max(0, Math.min(lab.length - 1, histIndex(neu.d)))); }
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Auswahl wert={String(monat)} onWahl={v => { setMonat(Number(v)); setMehr(0); }} optionen={lab.map((l, j) => ({ id: String(j), label: `${l}${h.anzahl[j] ? ` · ${h.anzahl[j]}` : ''}` })).filter((_, j) => j <= heuteIndex(d) + 3 || h.anzahl[j])} titel="Monat" />
        <Auswahl wert={konto} onWahl={setKonto} optionen={[{ id: 'alle', label: 'Alle Konten' }, ...konten.map(k => ({ id: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))]} titel="Konto" />
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <select value={zeile} aria-label="Planzeile filtern" onChange={e => setZeile(e.target.value)} style={{ ...auswahlStil, maxWidth: 220 }}>
            <option value="alle">Alle Zeilen</option>
            <optgroup label="Budget">{d.privatBudget.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>
            <optgroup label="Schulden">{d.privatSchulden.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</optgroup>
            <optgroup label="Einnahmen & Sonstiges">{Object.entries(SONDER_ZEILEN).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</optgroup>
          </select>
        </span>
        <input value={suche} placeholder="Empfänger suchen" aria-label="Empfänger suchen" onChange={e => setSuche(e.target.value)} style={{ ...eingabeStil, width: 190 }} />
        <Schalter an={nurOffen} onChange={setNurOffen}>nur ohne Zuordnung ({offeneBuchungen(d)})</Schalter>
        <span style={{ flex: 1 }} />
        <Knopf onClick={() => setNeu({ d: d.einstellungen.heute, b: '', n: '', k: 'gemeinsam', z: 'x.offen', notiz: '' })}>+ Buchung</Knopf>
      </div>
      <Spalten verhaeltnis="1:2">
        <Spalte>
          <Karte i={0}>
            <Ueberschrift>Wofür ging das Geld — {lab[monat]}</Ueberschrift>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien, padding: '4px 0' }}><span style={{ color: C.inkDim }}>Einnahmen</span><Geld v={h.einnahmen[monat]} farbe={LEUCHT.gut} einheit=" €" /></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYP.bedien, padding: '4px 0 10px' }}><span style={{ color: C.inkDim }}>Ausgaben</span><Geld v={h.ausgaben[monat]} einheit=" €" /></div>
            {top.map(([z, v]) => {
              const zl = alleZeilen(d).find(x => x.id === z); const soll = zl ? sollBudget(zl, 1, {}) : 0;
              return (
                <div key={z} onClick={() => setZeile(zeile === z ? 'alle' : z)} style={{ marginBottom: 9, cursor: 'pointer', opacity: zeile !== 'alle' && zeile !== z ? 0.5 : 1 }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: TYP.bedien, alignItems: 'baseline' }}><span style={{ flex: 1 }}>{zeileName(d, z)}</span><Geld v={v} /><span style={{ color: C.inkLeise, fontSize: TYP.bedien, width: 42, textAlign: 'right' }}>{prozent(v / gesamt)}</span></div>
                  <AnteilBalken anteil={v / gesamt} farbe={soll && v > soll ? LEUCHT.achtung : C.aktiv} hoehe={5} />
                  {soll > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 2 }}>Plan ab Okt: <Geld v={soll} farbe={C.inkLeise} /> €</div>}
                </div>
              );
            })}
            {!top.length && <Nichts>Keine Ausgaben in diesem Monat.</Nichts>}
            <Hinweis>Umbuchungen und Kredite zählen nicht. Klick filtert die Liste.</Hinweis>
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={1}>
            <Ueberschrift rechts={<span>Zuordnung ändern gilt mit „merken“ für alle Buchungen dieses Empfängers</span>}>{liste.length} Buchungen</Ueberschrift>
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              <Tabelle klein>
                <thead><tr><th style={TH}>Datum</th><th style={TH}>Empfänger</th><th style={TH}>Konto</th><th style={THr}>Betrag</th><th style={TH}>Planzeile</th><th style={TH}>merken</th></tr></thead>
                <tbody>
                  {liste.slice(0, grenze).map(b => (
                    <tr key={b.id}>
                      <td style={{ ...TDleise, fontVariantNumeric: 'tabular-nums' }}>{tagKurz(b.d)}</td>
                      <td style={TD}><span title={b.notiz}>{b.n}</span>{b.hand && <span style={{ ...MIKRO, marginLeft: 6, fontSize: 11 }}>Hand</span>}</td>
                      <td style={TD}><Etikett text={b.k} /></td>
                      <td style={TDr}><Geld v={b.b} dezimal={2} farbe={b.b > 0 ? LEUCHT.gut : undefined} /></td>
                      <td style={TD}><ZeilenAuswahl wert={b.z} onWahl={z => zuordnen(b, z)} offen={b.z === 'x.offen'} /></td>
                      <td style={TD}><Schalter an={merken[b.id] ?? true} onChange={v => setMerken({ ...merken, [b.id]: v })} ariaLabel={`Zuordnung für ${b.n} merken`} /></td>
                    </tr>
                  ))}
                  {!liste.length && <tr><td colSpan={6} style={TDleise}>Keine Buchungen für diese Auswahl.</td></tr>}
                </tbody>
              </Tabelle>
              {liste.length > grenze && <div style={{ marginTop: 8 }}><KnopfKlein farbe={C.inkDim} onClick={() => setMehr(mehr + 200)}>{liste.length - grenze} weitere</KnopfKlein></div>}
            </div>
            {offeneBuchungen(d) > 0 && <div style={{ marginTop: 10 }}><Chip farbe={LEUCHT.achtung}>{offeneBuchungen(d)} nicht zugeordnet</Chip></div>}
          </Karte>
        </Spalte>
      </Spalten>
      {neu && (
        <Dialog titel="Buchung erfassen" onZu={() => setNeu(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setNeu(null)}>Abbrechen</KnopfKlein><Knopf aus={!neu.n.trim() || !neu.b.trim()} onClick={() => void speichernNeu()}>Speichern</Knopf></>}>
          <Formular>
            <Feld label="Datum"><input type="date" value={neu.d} aria-label="Datum" onChange={e => setNeu({ ...neu, d: e.target.value })} style={{ ...eingabeStil }} /></Feld>
            <Feld label="Betrag (− Ausgabe)"><input value={neu.b} inputMode="decimal" placeholder="-25,90" aria-label="Betrag" onChange={e => setNeu({ ...neu, b: e.target.value })} style={{ ...eingabeStil, textAlign: 'right' }} /></Feld>
            <Feld label="Empfänger" breit><TextFeld wert={neu.n} onFertig={t => { const r = d.regeln[t.trim().toLowerCase()]; setNeu(n => (n ? { ...n, n: t, z: r ?? n.z } : n)); }} platzhalter="Empfänger" titel="Empfänger" /></Feld>
            <Feld label="Konto"><Auswahl wert={neu.k} onWahl={k => setNeu({ ...neu, k })} optionen={KONTEN} titel="Konto" /></Feld>
            <Feld label="Planzeile"><ZeilenAuswahl wert={neu.z} onWahl={z => setNeu({ ...neu, z })} breite="100%" /></Feld>
            <Feld label="Notiz" breit><TextFeld wert={neu.notiz} onFertig={t => setNeu({ ...neu, notiz: t })} titel="Notiz" /></Feld>
          </Formular>
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Von Hand für Bargeld und alles, was noch fehlt. Später kommt das aus dem Kontoauszug-Import.</div>
        </Dialog>
      )}
    </>
  );
}
