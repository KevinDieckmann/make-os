'use client';

// ─── Finanzplanung jetzt — Planen › Szenarien bauen (der Baukasten) ──────────
// Kevin 27.09.: „Szenarien selbst bauen können — mit Kunden, Produkten und
// Preisen dahinter.“ Ein Szenario = Basis (Zeilen, Fixkosten, Treiber) +
// Umsatzbausteine (Produkt × Kunde × Preis × Menge × Start × Laufzeit) +
// Kostenbausteine (Stelle · Software · Miete · Rate) + eigene Annahmen
// (Gehälter, Steuerquote, Zahlungsziel, Ausschüttung). Jede Änderung wird
// sofort gerechnet (rechne() → Rechenkern) und als Operation gespeichert;
// Regler zeigen ihre Wirkung beim Ziehen und speichern beim Loslassen.
// Produkte kommen aus dem CRM-Katalog (nur lesen, /os/mandate?s=produkte);
// ohne Produkt bleibt ein Baustein möglich — er heißt dann „ohne Produkt“.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Spalten, Spalte, Knopf, LEUCHT, feld } from '../schlank';
import { WEG } from '@/lib/wege';
import { eur, prozent, monatLabel, neueKennung } from '@/lib/finanzen/plan/hilfen';
import { UG_KURZ } from '@/lib/einheiten';
import type { Operation } from '@/lib/finanzen/plan/operationen';
import {
  planszenarienVon, neuesPlanszenario, neuerBaustein, betragImMonat, vergleich, STEUER_HINWEIS, AUSSCHUETTUNG_STEUER_VORGABE,
  RHYTHMUS_LABEL, KOSTENART_LABEL, BAUSTEIN_EINHEIT_LABEL, kernKanal,
  type Planszenario, type Baustein, type Rhythmus, type KostenArt, type BausteinEinheit, type Regler,
} from '@/lib/finanzen/szenarien';
import { bausteinAusProdukt, einheitAusGesellschaft, RHYTHMUS_AUS_BASIS, type ProduktVorschlag, type IstBasisVorschlag } from '@/lib/finanzen/produkte';
import { usePlan, rechne, type Gerechnet } from './daten';
import { Geld, Kachel, Kacheln, Tabelle, TH, THr, TD, TDr, TDleise, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, Dialog, Feld, Formular, Schalter, StatusPille, Legende, Pillen, Nichts, Etikett, KUPFER, LILA } from './teile';
import { Linie } from './diagramme';

const RHYTHMEN = (Object.keys(RHYTHMUS_LABEL) as Rhythmus[]).map(id => ({ id, label: RHYTHMUS_LABEL[id] }));
const KOSTENARTEN = (Object.keys(KOSTENART_LABEL) as KostenArt[]).map(id => ({ id, label: KOSTENART_LABEL[id] }));
const EINHEITEN = (Object.keys(BAUSTEIN_EINHEIT_LABEL) as BausteinEinheit[]).map(id => ({ id, label: BAUSTEIN_EINHEIT_LABEL[id] }));
const ZIELE = [0, 1, 2, 3].map(n => ({ id: String(n), label: n ? `${n} Monat${n > 1 ? 'e' : ''}` : 'sofort' }));

interface Vorschlaege { produkte: ProduktVorschlag[]; istBasis: IstBasisVorschlag[] }
/** Vorschläge aus dem CRM — einmal laden; ohne CRM bleiben die Listen leer und die Planung läuft trotzdem. */
function useVorschlaege(): Vorschlaege {
  const [v, setV] = useState<Vorschlaege>({ produkte: [], istBasis: [] });
  useEffect(() => {
    let weg = false;
    fetch('/api/finanzplan/vorschlaege', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then((a: (Partial<Vorschlaege> & { ok?: boolean }) | null) => { if (!weg && a?.ok) setV({ produkte: a.produkte ?? [], istBasis: a.istBasis ?? [] }); }).catch(() => { /* ohne CRM */ });
    return () => { weg = true; };
  }, []);
  return v;
}

type LiveSchluessel = 'kevinBrutto' | 'malinBrutto' | 'steuerUG' | `regler:${Regler}`;
const REGLER_NAME: Record<Regler, string> = { umsatz: `Umsatz ${UG_KURZ} (Regler)`, miete: 'Fixkosten privat ± (Regler)', rate: 'Neue Rate privat (Regler)' };

/** Regler-Werte beim Ziehen ins Szenario legen — ohne zu speichern. */
function mitLive(ps: Planszenario, live: Partial<Record<LiveSchluessel, number>>, m0: number): Planszenario {
  const schluessel = Object.keys(live) as LiveSchluessel[];
  if (!schluessel.length) return ps;
  const n: Planszenario = { ...ps, annahmen: { ...ps.annahmen }, bausteine: [...ps.bausteine] };
  for (const k of schluessel) {
    const v = live[k]!;
    if (k === 'kevinBrutto' || k === 'malinBrutto' || k === 'steuerUG') { n.annahmen[k] = v; continue; }
    const art = k.slice(7) as Regler;
    const i = n.bausteine.findIndex(b => b.regler === art);
    if (i >= 0) n.bausteine[i] = { ...n.bausteine[i], preis: v, an: true };
    else n.bausteine.push(reglerBaustein(art, v, m0));
  }
  return n;
}
function reglerBaustein(art: Regler, preis: number, m0: number): Baustein {
  return neuerBaustein(neueKennung('rb'), art === 'umsatz'
    ? { art: 'umsatz', einheit: 'ug', name: REGLER_NAME.umsatz, preis, menge: 1, rhythmus: 'monatlich', start: m0, regler: art }
    : { art: 'kosten', einheit: 'privat', kostenArt: art, name: REGLER_NAME[art], preis, menge: 1, rhythmus: 'monatlich', start: m0, regler: art });
}

export function Baukasten() {
  const { d, ps: arbeitsplan, sz: treiber, aendere, geh, params, aw: awPlan } = usePlan();
  const liste = planszenarienVon(d);
  const szParam = params.get('sz');
  const [gewaehlt, setGewaehlt] = useState<string | null>(szParam ?? arbeitsplan?.id ?? liste[0]?.id ?? null);
  useEffect(() => { if (szParam && liste.some(p => p.id === szParam)) setGewaehlt(szParam); }, [szParam, liste]);
  const ps = liste.find(p => p.id === gewaehlt) ?? liste.find(p => p.id === arbeitsplan?.id) ?? liste[0] ?? null;
  const [live, setLive] = useState<Partial<Record<LiveSchluessel, number>>>({});
  const m0 = awPlan.m0;
  const basis = useMemo(() => rechne(d, undefined, null), [d]);
  const psLive = useMemo(() => (ps ? mitLive(ps, live, m0) : null), [ps, live, m0]);
  const g = useMemo(() => (psLive ? rechne(d, undefined, psLive) : basis), [d, psLive, basis]);
  const vorschlaege = useVorschlaege();
  const [neu, setNeu] = useState<{ name: string; basis: string } | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState(false);
  const [vergleichIds, setVergleichIds] = useState<(string | null)[]>([null]);
  const feldParam = params.get('feld');

  const P = useCallback((pfad: string) => `/planszenarien/id=${ps?.id}${pfad}`, [ps?.id]);
  const setze = useCallback((pfad: string, alt: unknown, neu: unknown, feld: string) => aendere([{ pfad: P(pfad), alt, neu }], `${ps?.name ?? 'Szenario'} · ${feld}`), [aendere, P, ps?.name]);
  const bausteinDazu = useCallback((b: Baustein, feld: string) => aendere([{ pfad: P('/bausteine/-'), neu: b }], `${ps?.name ?? 'Szenario'} · ${feld}`), [aendere, P, ps?.name]);

  const anlegen = async (n: string, basisId: string, bausteine: Baustein[] = []) => {
    const id = neueKennung('ps');
    const s = { ...neuesPlanszenario(id, n, basisId, new Date().toISOString()), bausteine };
    const ops: Operation[] = [{ pfad: '/planszenarien/-', neu: s }];
    if (!liste.length) ops.push({ pfad: '/arbeitsplan', alt: d.arbeitsplan ?? null, neu: id });
    if (await aendere(ops, `Szenario „${n}“ angelegt${!liste.length ? ' und als Arbeitsplan gesetzt' : ''}`)) { setGewaehlt(id); geh('planen', { sz: id }); }
  };
  const alsArbeitsplan = (id: string | null) => void aendere([{ pfad: '/arbeitsplan', alt: d.arbeitsplan ?? null, neu: id }], id ? `Arbeitsplan: ${liste.find(p => p.id === id)?.name ?? id}` : 'Arbeitsplan aufgehoben');

  // Regler: Wirkung beim Ziehen, speichern beim Loslassen.
  const reglerWert = (k: LiveSchluessel): number => {
    if (!ps) return 0;
    if (k in live) return live[k]!;
    if (k === 'kevinBrutto' || k === 'malinBrutto') return ps.annahmen[k] ?? d.annahmen[k];
    if (k === 'steuerUG') return ps.annahmen.steuerUG ?? d.annahmen.steuerUG;
    const b = ps.bausteine.find(x => x.regler === k.slice(7));
    return b && b.an ? b.preis : 0;
  };
  const reglerFest = (k: LiveSchluessel) => {
    if (!ps || !(k in live)) return;
    const v = live[k]!;
    setLive(l => { const n = { ...l }; delete n[k]; return n; });
    if (k === 'kevinBrutto' || k === 'malinBrutto' || k === 'steuerUG') {
      const alt = ps.annahmen[k]; const dok = d.annahmen[k];
      if (v === (alt ?? dok)) return;
      void setze(`/annahmen/${k}`, alt, v === dok ? undefined : v, k === 'steuerUG' ? `Steuerquote ${UG_KURZ}` : k === 'kevinBrutto' ? 'Kevin brutto' : 'Malin brutto');
      return;
    }
    const art = k.slice(7) as Regler;
    const b = ps.bausteine.find(x => x.regler === art);
    if (b) { if (b.preis !== v || !b.an) void aendere([{ pfad: P(`/bausteine/id=${b.id}/preis`), alt: b.preis, neu: v }, ...(b.an ? [] : [{ pfad: P(`/bausteine/id=${b.id}/an`), alt: false, neu: true }])], `${ps.name} · ${REGLER_NAME[art]}`); }
    else if (v !== 0) void bausteinDazu(reglerBaustein(art, v, m0), REGLER_NAME[art]);
  };

  if (!liste.length || !ps) {
    return (
      <>
        <Karte i={0} akzent={C.aktiv}>
          <Ueberschrift>Noch kein eigenes Szenario</Ueberschrift>
          <div style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.6, maxWidth: 720 }}>
            Ein Szenario ist die Basis (Fixkosten, Zeilen und das Treiber-Szenario <b style={{ color: C.ink }}>{treiber.name}</b>) plus Bausteine: Umsatz aus Produkt × Kunde × Preis × Menge, Kosten wie eine neue Stelle, Software, Miete oder eine Rate, dazu eigene Annahmen. Das Ergebnis siehst du sofort: Kontostände je Gesellschaft, Runway, Ziele im Plan oder gekippt. Mehrere Szenarien lassen sich nebeneinander vergleichen; eines gilt als Arbeitsplan.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
            <Knopf onClick={() => setNeu({ name: 'Arbeitsplan', basis: treiber.id })}>Erstes Szenario anlegen</Knopf>
            {vorschlaege.istBasis.length > 0 && <Knopf leise onClick={() => void anlegen('Ist-Basis aus Mandaten', treiber.id, vorschlaege.istBasis.map(v => istBaustein(v)))}>Aus Mandaten und gewonnenen Deals anlegen ({vorschlaege.istBasis.length})</Knopf>}
          </div>
        </Karte>
        {neu && <NeuDialog neu={neu} setNeu={setNeu} treiber={d.szenarien} onOk={() => { const n = neu.name.trim(); setNeu(null); if (n) void anlegen(n, neu.basis); }} />}
      </>
    );
  }

  const istArbeitsplan = d.arbeitsplan === ps.id;
  const umsatz = ps.bausteine.filter(b => b.art === 'umsatz' && !b.regler);
  const kosten = ps.bausteine.filter(b => b.art === 'kosten' && !b.regler);
  const N = d.monate.length;
  const summe = (b: Baustein) => { let s = 0; for (let m = 1; m <= N; m++) s += betragImMonat(b, m); return s; };
  const delta = (a: number, b: number, gut = true) => { const dlt = a - b; if (Math.abs(dlt) < 0.5) return <span style={{ color: C.inkLeise }}>wie Basis</span>; const f = (dlt > 0) === gut ? LEUCHT.gut : LEUCHT.kritisch; return <span style={{ color: f }}>{dlt > 0 ? '+' : '−'}{eur(Math.abs(dlt))} € gegen Basis</span>; };
  const runwayText = (r: number | null, h: number) => (r == null ? `über ${h} Monate` : r === 0 ? 'jetzt unter null' : `${r} Monat${r === 1 ? '' : 'e'}`);
  const vg = vergleich(d, [...vergleichIds.map(id => (id ? liste.find(p => p.id === id) ?? null : null))].filter((x, i, a) => a.indexOf(x) === i), 3);
  const vgPillen = [{ id: '__basis', label: 'Basis' }, ...liste.map(p => ({ id: p.id, label: p.name }))];
  const vgAn = (id: string) => (id === '__basis' ? vergleichIds.includes(null) : vergleichIds.includes(id));
  const vgWahl = (id: string) => { const k = id === '__basis' ? null : id; setVergleichIds(v => (v.includes(k) ? v.filter(x => x !== k) : [...v, k].slice(-3))); };

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pillen liste={liste.map(p => ({ id: p.id, label: p.id === d.arbeitsplan ? `★ ${p.name}` : p.name }))} aktiv={ps.id} onWahl={id => { setLive({}); setGewaehlt(id); geh('planen', { sz: id }); }} />
        <KnopfKlein onClick={() => setNeu({ name: '', basis: ps.basis })}>+ Szenario</KnopfKlein>
        <span style={{ flex: 1 }} />
        {istArbeitsplan ? <KnopfKlein farbe={C.inkDim} onClick={() => alsArbeitsplan(null)} titel="Dann gilt wieder der reine Treiber">Arbeitsplan aufheben</KnopfKlein> : <KnopfKlein onClick={() => alsArbeitsplan(ps.id)} titel="Alle Seiten rechnen dann mit diesem Szenario">★ Als Arbeitsplan</KnopfKlein>}
        <KnopfKlein farbe={C.inkDim} onClick={() => { const n: Planszenario = JSON.parse(JSON.stringify(ps)); n.id = neueKennung('ps'); n.name = `${ps.name} Kopie`; n.angelegt = new Date().toISOString(); void aendere([{ pfad: '/planszenarien/-', neu: n }], `Szenario „${n.name}“ angelegt`).then(ok => { if (ok) { setGewaehlt(n.id); geh('planen', { sz: n.id }); } }); }}>Duplizieren</KnopfKlein>
        <KnopfKlein farbe={C.inkDim} onClick={() => setName(ps.name)}>Umbenennen</KnopfKlein>
        {loeschen ? <KnopfKlein farbe={LEUCHT.kritisch} onClick={() => { setLoeschen(false); void aendere([{ pfad: `/planszenarien/id=${ps.id}`, alt: ps.name }], `Szenario „${ps.name}“ gelöscht`); setGewaehlt(null); }}>Wirklich löschen</KnopfKlein> : <KnopfKlein farbe={LEUCHT.kritisch} onClick={() => setLoeschen(true)}>Löschen</KnopfKlein>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim, marginBottom: 14 }}>
        <span>Basis: Fixkosten und Zeilen des Plans + Treiber</span>
        <Auswahl wert={ps.basis} onWahl={v => void setze('/basis', ps.basis, v, 'Treiber')} optionen={d.szenarien.map(s => ({ id: s.id, label: s.name }))} titel="Treiber-Szenario" />
        <span style={{ color: C.inkLeise }}>Treiber und gemeinsame Annahmen: <button type="button" onClick={() => geh('szenarien')} style={{ background: 'none', border: 'none', padding: 0, color: C.aktiv, cursor: 'pointer', font: 'inherit' }}>Treiber &amp; Annahmen ›</button></span>
        {istArbeitsplan && <Etikett text="Arbeitsplan" />}
      </div>

      <Spalten verhaeltnis="3:2">
        <Spalte>
          <Karte i={0} akzent={feldParam === 'umsatz' ? C.aktiv : undefined}>
            <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}><KnopfKlein onClick={() => void bausteinDazu(neuerBaustein(neueKennung('b'), { art: 'umsatz', einheit: 'ug', name: 'Umsatz ohne Produkt', start: m0, laufzeit: 12 }), 'Umsatz angelegt')}>+ Umsatz</KnopfKlein></span>}>Umsatzbausteine — Kunde × Produkt × Preis × Menge</Ueberschrift>
            {umsatz.length ? (
              <Tabelle klein>
                <thead><tr><th style={TH}></th><th style={TH}>Produkt</th><th style={TH}>Kunde / Segment</th><th style={TH}>Wo</th><th style={THr}>Preis netto</th><th style={THr}>Menge</th><th style={TH}>Rhythmus</th><th style={TH}>ab</th><th style={THr}>Monate</th><th style={TH}>Zahlungsziel</th><th style={THr}>Summe im Plan</th><th style={TH}></th></tr></thead>
                <tbody>
                  {umsatz.map(b => <UmsatzZeile key={b.id} b={b} ps={ps} produkte={vorschlaege.produkte} setze={setze} summe={summe(b)} monate={d.monate} entfernen={() => void aendere([{ pfad: P(`/bausteine/id=${b.id}`), alt: b.name }], `${ps.name} · Baustein entfernt: ${b.name}`)} />)}
                </tbody>
              </Tabelle>
            ) : <Nichts>Noch kein Umsatz im Szenario. Ein Produkt unten anklicken oder „+ Umsatz“ für einen freien Baustein.</Nichts>}
            <div style={{ marginTop: 12 }}>
              <div style={{ ...MIKRO, marginBottom: 6 }}>Aus dem Produktkatalog</div>
              {vorschlaege.produkte.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {vorschlaege.produkte.map(p => (
                    <button key={p.id} type="button" title={p.fehlt.length ? `Für die Planung fehlt: ${p.fehlt.join(', ')} — auf der Produktseite ergänzen` : `${p.einheit}${p.laufzeit ? ` · ${p.laufzeit} Monate` : ''}`}
                      onClick={() => void bausteinDazu(bausteinAusProdukt(neueKennung('b'), p, { start: m0 }), `Umsatz aus Produkt ${p.name}`)}
                      style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, border: `1px solid ${p.fehlt.length ? `${LEUCHT.achtung}66` : 'rgba(255,255,255,.12)'}`, background: 'transparent', color: p.fehlt.length ? LEUCHT.achtung : C.ink }}>
                      + {p.name}{p.preis ? ` · ${eur(p.preis)} € ${p.basis ? RHYTHMUS_LABEL[RHYTHMUS_AUS_BASIS[p.basis]] : ''}` : ' · Preis offen'}{p.status === 'entwurf' ? ' · Entwurf' : ''}
                    </button>
                  ))}
                </div>
              ) : <div style={{ fontSize: 12.5, color: C.inkLeise }}>Keine Produkte im Katalog — Bausteine gehen auch frei.</div>}
              <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8 }}>Produkte sind die eine Quelle: Preis, Basis und Laufzeit pflegst du auf der <Link href={WEG.produkt()} style={{ color: C.aktiv }}>Produktseite ›</Link>. Gelb = dort fehlt etwas für die Planung.</div>
              {vorschlaege.istBasis.length > 0 && (
                <>
                  <div style={{ ...MIKRO, marginTop: 12, marginBottom: 6 }}>Ist-Basis: aktive Mandate und gewonnene Deals</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {vorschlaege.istBasis.map(v => (
                      <button key={`${v.quelle}-${v.quelleId}`} type="button" title={`${v.quelle === 'mandat' ? 'Mandat' : 'Gewonnener Deal'} · ${v.titel}${v.produkt ? ` · ${v.produkt}` : ' · ohne Produkt'}`}
                        onClick={() => void bausteinDazu(istBaustein(v), `Umsatz aus ${v.quelle === 'mandat' ? 'Mandat' : 'Deal'} ${v.kunde}`)}
                        style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, border: `1px solid ${LEUCHT.geld}55`, background: 'transparent', color: C.ink }}>
                        + {v.kunde} · {eur(v.betrag)} € {RHYTHMUS_LABEL[v.rhythmus]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Karte>

          <Karte i={1} akzent={feldParam === 'privat' ? C.aktiv : undefined}>
            <Ueberschrift rechts={<span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
              {(['stelle', 'tool', 'miete', 'rate'] as KostenArt[]).map(k => <KnopfKlein key={k} farbe={C.inkDim} onClick={() => void bausteinDazu(neuerBaustein(neueKennung('b'), { art: 'kosten', kostenArt: k, einheit: k === 'stelle' || k === 'tool' ? 'ug' : 'privat', name: KOSTENART_LABEL[k], start: m0, ...(k === 'rate' ? { laufzeit: 24 } : {}) }), `${KOSTENART_LABEL[k]} angelegt`)}>+ {KOSTENART_LABEL[k]}</KnopfKlein>)}
            </span>}>Kostenbausteine — Stelle, Software, Miete, Rate</Ueberschrift>
            {kosten.length ? (
              <Tabelle klein>
                <thead><tr><th style={TH}></th><th style={TH}>Art</th><th style={TH}>Name</th><th style={TH}>Wo</th><th style={THr}>Betrag</th><th style={THr}>Menge</th><th style={TH}>Rhythmus</th><th style={TH}>ab</th><th style={THr}>Monate</th><th style={THr}>Summe im Plan</th><th style={TH}></th></tr></thead>
                <tbody>
                  {kosten.map(b => <KostenZeile key={b.id} b={b} setze={setze} summe={summe(b)} monate={d.monate} entfernen={() => void aendere([{ pfad: P(`/bausteine/id=${b.id}`), alt: b.name }], `${ps.name} · Baustein entfernt: ${b.name}`)} />)}
                </tbody>
              </Tabelle>
            ) : <Nichts>Keine zusätzlichen Kosten. Stellen rechnen mit Arbeitgeberanteil, Software zählt zu den Sachkosten, Miete und Rate wirken privat.</Nichts>}
          </Karte>

          <Karte i={2}>
            <Ueberschrift>Annahmen dieses Szenarios</Ueberschrift>
            <Formular>
              <Feld label={`Kevin brutto (Plan: ${eur(d.annahmen.kevinBrutto)} €)`}><ZahlFeld wert={ps.annahmen.kevinBrutto ?? null} leer platzhalter="wie Plan" dezimal={0} breite="100%" onFertig={v => void setze('/annahmen/kevinBrutto', ps.annahmen.kevinBrutto, v ?? undefined, 'Kevin brutto')} titel="Kevin brutto" /></Feld>
              <Feld label={`Malin brutto (Plan: ${eur(d.annahmen.malinBrutto)} €)`}><ZahlFeld wert={ps.annahmen.malinBrutto ?? null} leer platzhalter="wie Plan" dezimal={0} breite="100%" onFertig={v => void setze('/annahmen/malinBrutto', ps.annahmen.malinBrutto, v ?? undefined, 'Malin brutto')} titel="Malin brutto" /></Feld>
              <Feld label={`Steuerquote ${UG_KURZ} (Plan: ${prozent(d.annahmen.steuerUG)})`}><ZahlFeld wert={ps.annahmen.steuerUG ?? null} leer platzhalter="wie Plan" dezimal={2} breite="100%" onFertig={v => void setze('/annahmen/steuerUG', ps.annahmen.steuerUG, v ?? undefined, `Steuerquote ${UG_KURZ}`)} titel={`Steuerquote ${UG_KURZ} als Dezimalzahl`} /></Feld>
              <Feld label={`Zahlungsziel Umsatz ${UG_KURZ}`}><Auswahl wert={String(ps.annahmen.zahlungsziel ?? 0)} onWahl={v => void setze('/annahmen/zahlungsziel', ps.annahmen.zahlungsziel, Number(v) || undefined, 'Zahlungsziel')} optionen={ZIELE} titel="Zahlungsziel" /></Feld>
              <Feld label={`Ausschüttung ${UG_KURZ} → Privat je Monat`}><ZahlFeld wert={ps.annahmen.ausschuettung?.betrag ?? null} leer platzhalter="keine" dezimal={0} breite="100%" onFertig={v => void setze('/annahmen/ausschuettung', ps.annahmen.ausschuettung, v ? { betrag: v, ab: ps.annahmen.ausschuettung?.ab ?? m0 } : undefined, 'Ausschüttung')} titel="Ausschüttung je Monat" /></Feld>
              <Feld label="Ausschüttung ab"><MonatWahl wert={ps.annahmen.ausschuettung?.ab ?? m0} onWahl={m => void setze('/annahmen/ausschuettung', ps.annahmen.ausschuettung, { betrag: ps.annahmen.ausschuettung?.betrag ?? 0, ab: m }, 'Ausschüttung ab')} monate={d.monate} /></Feld>
              <Feld label={`Steuer auf Ausschüttung, pauschal (Vorgabe ${prozent(AUSSCHUETTUNG_STEUER_VORGABE, 1)})`}><ZahlFeld wert={ps.annahmen.ausschuettungSteuer ?? null} leer platzhalter={String(AUSSCHUETTUNG_STEUER_VORGABE).replace('.', ',')} dezimal={3} breite="100%" onFertig={v => void setze('/annahmen/ausschuettungSteuer', ps.annahmen.ausschuettungSteuer, v == null ? undefined : Math.max(0, Math.min(1, v)), 'Steuer auf Ausschüttung')} titel="Steuerquote auf die Ausschüttung als Dezimalzahl (0,264 = 26,4 %)" /></Feld>
            </Formular>
            <Hinweis>Leer heißt: wie im Plan (Treiber &amp; Annahmen). Ausschüttung nimmt Geld brutto aus der {UG_KURZ}-Kasse; privat kommt brutto minus pauschale Steuer an (Vorgabe Kapitalertragsteuer + Soli {prozent(AUSSCHUETTUNG_STEUER_VORGABE, 1)}), der Abzug steht unter Gesamt bei den Übergängen. {STEUER_HINWEIS}</Hinweis>
          </Karte>

          <Karte i={3}>
            <Ueberschrift rechts={Object.keys(live).length ? <span style={{ color: LEUCHT.achtung, fontSize: 12 }}>Loslassen speichert</span> : undefined}>Was wäre, wenn — Regler</Ueberschrift>
            <ReglerZeile label={`Umsatz ${UG_KURZ} je Monat zusätzlich`} wert={reglerWert('regler:umsatz')} min={0} max={20000} schritt={250} einheit="€" onLive={v => setLive(l => ({ ...l, 'regler:umsatz': v }))} onFest={() => reglerFest('regler:umsatz')} />
            <ReglerZeile label="Kevin brutto" wert={reglerWert('kevinBrutto')} min={0} max={10000} schritt={100} einheit="€" onLive={v => setLive(l => ({ ...l, kevinBrutto: v }))} onFest={() => reglerFest('kevinBrutto')} />
            <ReglerZeile label="Malin brutto" wert={reglerWert('malinBrutto')} min={0} max={10000} schritt={100} einheit="€" onLive={v => setLive(l => ({ ...l, malinBrutto: v }))} onFest={() => reglerFest('malinBrutto')} />
            <ReglerZeile label="Fixkosten privat ± (z. B. Miete)" wert={reglerWert('regler:miete')} min={-1000} max={2000} schritt={50} einheit="€" onLive={v => setLive(l => ({ ...l, 'regler:miete': v }))} onFest={() => reglerFest('regler:miete')} />
            <ReglerZeile label="Neue Rate privat je Monat" wert={reglerWert('regler:rate')} min={0} max={2000} schritt={25} einheit="€" onLive={v => setLive(l => ({ ...l, 'regler:rate': v }))} onFest={() => reglerFest('regler:rate')} />
            <ReglerZeile label={`Steuerquote ${UG_KURZ}`} wert={reglerWert('steuerUG')} min={0} max={0.5} schritt={0.01} einheit="%" prozent onLive={v => setLive(l => ({ ...l, steuerUG: v }))} onFest={() => reglerFest('steuerUG')} />
            <Hinweis>Regler sind gewöhnliche Bausteine bzw. Annahmen dieses Szenarios — sie stehen oben in den Listen und lassen sich dort feiner einstellen. Wirkung rechts sofort, gespeichert beim Loslassen.</Hinweis>
          </Karte>
        </Spalte>

        <Spalte>
          <Karte i={1} akzent={KUPFER}>
            <Ueberschrift>Wirkung — „{ps.name}“ gegen Basis</Ueberschrift>
            <Kacheln min={150}>
              <Kachel label="Frei verfügbar jetzt" wert={<><Geld v={g.aw.frei.gesamt} /> €</>} unter={delta(g.aw.frei.gesamt, basis.aw.frei.gesamt)} />
              <Kachel label={`Tiefpunkt ${UG_KURZ} frei`} punkt={g.kz.minFrei >= 1000 ? LEUCHT.gut : g.kz.minFrei >= 0 ? LEUCHT.achtung : LEUCHT.kritisch} wert={<><Geld v={g.kz.minFrei} /> €</>} unter={<>{monatLabel(d, g.kz.minMonat)} · {delta(g.kz.minFrei, basis.kz.minFrei)}</>} />
              <Kachel label={`Runway ${UG_KURZ}`} punkt={g.aw.runway.ug == null || g.aw.runway.ug >= 12 ? LEUCHT.gut : g.aw.runway.ug >= 6 ? LEUCHT.achtung : LEUCHT.kritisch} wert={runwayText(g.aw.runway.ug, g.aw.runway.horizont)} unter={`Basis: ${runwayText(basis.aw.runway.ug, basis.aw.runway.horizont)}`} />
              <Kachel label="Privat Luft, schlechtester Monat" punkt={g.kz.privatLuftMin >= 250 ? LEUCHT.gut : g.kz.privatLuftMin >= 0 ? LEUCHT.achtung : LEUCHT.kritisch} wert={<><Geld v={g.kz.privatLuftMin} /> €</>} unter={delta(g.kz.privatLuftMin, basis.kz.privatLuftMin)} />
              <Kachel label="Runway Privat" punkt={g.aw.runway.privat == null || g.aw.runway.privat >= 12 ? LEUCHT.gut : g.aw.runway.privat >= 6 ? LEUCHT.achtung : LEUCHT.kritisch} wert={runwayText(g.aw.runway.privat, g.aw.runway.horizont)} unter={g.aw.frei.kontenFehlen ? `${g.aw.frei.kontenFehlen} Kontostände fehlen` : `Basis: ${runwayText(basis.aw.runway.privat, basis.aw.runway.horizont)}`} />
              <Kachel label="Ziele im Plan" punkt={g.aw.ziele.gekippt ? LEUCHT.achtung : LEUCHT.gut} wert={`${g.aw.ziele.imPlan} / ${g.aw.ziele.gesamt}`} unter={g.aw.ziele.gekippt ? `${g.aw.ziele.gekippt} gekippt` : g.aw.ziele.knapp ? `${g.aw.ziele.knapp} knapp` : 'alle im Plan'} />
              <Kachel label="Gruppe Dez 28" wert={<><Geld v={g.kz.gruppeDez28} /> €</>} unter={delta(g.kz.gruppeDez28, basis.kz.gruppeDez28)} />
              <Kachel label="Steuerrücklage jetzt" wert={<><Geld v={g.aw.steuer.ruecklage} /> €</>} unter="Näherung, keine Steuerberatung" />
            </Kacheln>
            <Legende eintraege={[{ farbe: KUPFER, text: `${UG_KURZ} frei` }, { farbe: LILA, text: 'Privat angespart' }, { farbe: C.inkLeise, text: 'gestrichelt: Basis' }]} />
            <Linie labels={d.monate} tick={3} hoehe={220} serien={[
              { name: `${UG_KURZ} frei`, farbe: KUPFER, werte: g.ug.map(u => u.frei), breite: 2.4 },
              { name: `${UG_KURZ} frei Basis`, farbe: KUPFER, werte: basis.ug.map(u => u.frei), gestrichelt: true, breite: 1.2 },
              { name: 'Privat angespart', farbe: LILA, werte: g.pr.map(p => p.angespart), breite: 2 },
              { name: 'Privat Basis', farbe: LILA, werte: basis.pr.map(p => p.angespart), gestrichelt: true, breite: 1.2 },
            ]} />
          </Karte>
          <Karte i={2}>
            <Ueberschrift>Ziele und Töpfe in diesem Szenario</Ueberschrift>
            {g.aw.ziele.staende.length ? g.aw.ziele.staende.map(s => (
              <div key={s.ziel.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}>
                <span style={{ flex: 1 }}>{s.ziel.name}</span>
                <span style={{ color: C.inkLeise, fontSize: 12 }}>{s.erreichtMonat ? monatLabel(d, s.erreichtMonat) : '—'}</span>
                <StatusPille status={s.status === 'verfehlt' ? 'gekippt' : s.status} />
              </div>
            )) : <Nichts>Keine Ziele — unter Ziele &amp; Töpfe anlegen.</Nichts>}
            <div style={{ marginTop: 10, display: 'flex', gap: 10, fontSize: 12.5, color: C.inkDim, flexWrap: 'wrap' }}>
              <span>Mindestumsatz {UG_KURZ} Ø 12 M: <Geld v={g.aw.mindestumsatz.schnitt12} /> €</span>
              <span>· Umsatz Ø 12 M: <Geld v={g.aw.mindestumsatz.umsatzSchnitt12} farbe={g.aw.mindestumsatz.umsatzSchnitt12 < g.aw.mindestumsatz.schnitt12 ? LEUCHT.achtung : LEUCHT.gut} /> €</span>
            </div>
          </Karte>
        </Spalte>
      </Spalten>

      <Karte i={4}>
        <Ueberschrift rechts={<span style={{ color: C.inkLeise, fontSize: 12 }}>Klick wählt ab oder an</span>}>Nebeneinander — bis zu drei Szenarien</Ueberschrift>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{vgPillen.map(p => <span key={p.id} style={{ fontSize: 12, padding: '3px 9px', borderRadius: 999, border: `1px solid ${vgAn(p.id) ? C.aktiv : 'rgba(255,255,255,.08)'}`, color: vgAn(p.id) ? C.aktiv : C.inkLeise, cursor: 'pointer' }} onClick={() => vgWahl(p.id)}>{vgAn(p.id) ? '✓ ' : ''}{p.label}</span>)}</div>
        <VergleichTabelle spalten={vg} d={d} alsArbeitsplan={alsArbeitsplan} />
      </Karte>

      {neu && <NeuDialog neu={neu} setNeu={setNeu} treiber={d.szenarien} onOk={() => { const n = neu.name.trim(); setNeu(null); if (n) void anlegen(n, neu.basis); }} />}
      {name !== null && (
        <Dialog titel="Szenario umbenennen" onZu={() => setName(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setName(null)}>Abbrechen</KnopfKlein><Knopf aus={!name.trim()} onClick={() => { const n = name.trim(); setName(null); if (n && n !== ps.name) void setze('/name', ps.name, n, `umbenannt: ${n}`); }}>Speichern</Knopf></>}>
          <input autoFocus value={name} aria-label="Name des Szenarios" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const n = name.trim(); setName(null); if (n && n !== ps.name) void setze('/name', ps.name, n, `umbenannt: ${n}`); } }} style={{ ...feld }} />
        </Dialog>
      )}
    </>
  );
}

/** Umsatzbaustein aus einem Mandat oder gewonnenen Deal. */
function istBaustein(v: IstBasisVorschlag): Baustein {
  return neuerBaustein(neueKennung('b'), { art: 'umsatz', einheit: einheitAusGesellschaft(v.gesellschaft), name: v.produkt ?? v.titel, kunde: v.kunde, produkt: v.produkt, produktId: v.produktId, preis: v.betrag, menge: 1, rhythmus: v.rhythmus, start: v.start, ...(v.laufzeit && v.rhythmus !== 'einmalig' ? { laufzeit: v.laufzeit } : {}), notiz: `${v.quelle === 'mandat' ? 'Mandat' : 'Deal'} ${v.quelleId}` });
}

function NeuDialog({ neu, setNeu, treiber, onOk }: { neu: { name: string; basis: string }; setNeu: (v: { name: string; basis: string } | null) => void; treiber: { id: string; name: string }[]; onOk: () => void }) {
  return (
    <Dialog titel="Neues Szenario" onZu={() => setNeu(null)} aktionen={<><KnopfKlein farbe={C.inkDim} onClick={() => setNeu(null)}>Abbrechen</KnopfKlein><Knopf aus={!neu.name.trim()} onClick={onOk}>Anlegen</Knopf></>}>
      <input autoFocus value={neu.name} placeholder="Name, z. B. „Zwei neue Retainer ab Januar“" aria-label="Name des Szenarios" onChange={e => setNeu({ ...neu, name: e.target.value })} onKeyDown={e => { if (e.key === 'Enter' && neu.name.trim()) onOk(); }} style={{ ...feld }} />
      <Feld label="Treiber-Szenario als Basis"><Auswahl wert={neu.basis} onWahl={v => setNeu({ ...neu, basis: v })} optionen={treiber.map(s => ({ id: s.id, label: s.name }))} titel="Treiber" /></Feld>
      <div style={{ fontSize: 12.5, color: C.inkLeise }}>Bausteine und Annahmen kommen danach — alles live gerechnet, alles rückgängig.</div>
    </Dialog>
  );
}

type Setze = (pfad: string, alt: unknown, neu: unknown, feld: string) => Promise<boolean>;

function UmsatzZeile({ b, ps, produkte, setze, summe, monate, entfernen }: { b: Baustein; ps: Planszenario; produkte: ProduktVorschlag[]; setze: Setze; summe: number; monate: string[]; entfernen: () => void }) {
  const p = (f: string) => `/bausteine/id=${b.id}/${f}`;
  const n = `Baustein ${b.kunde ? `${b.kunde} · ` : ''}${b.produkt ?? b.name}`;
  const produkt = b.produktId ? produkte.find(x => x.id === b.produktId) : undefined;
  const produktWahl = (id: string) => {
    if (id === '__frei') { void setze(p('produktId'), b.produktId, undefined, `${n} · ohne Produkt`); return; }
    const pv = produkte.find(x => x.id === id); if (!pv) return;
    const basis = pv.basis ?? 'monat';
    const neu: Baustein = { ...b, produktId: pv.id, produkt: pv.name, name: pv.name, preis: pv.preis || b.preis, rhythmus: RHYTHMUS_AUS_BASIS[basis], einheit: pv.planEinheit };
    if (basis !== 'einmalig' && pv.laufzeit) neu.laufzeit = pv.laufzeit;
    void setze(`/bausteine/id=${b.id}`, b.produkt ?? 'ohne Produkt', neu, `${n} · Produkt ${pv.name}`);
  };
  const ziel = b.zahlungsziel ?? ps.annahmen.zahlungsziel ?? 0;
  return (
    <tr style={{ opacity: b.an ? 1 : 0.5 }}>
      <td style={TD}><Schalter an={b.an} onChange={v => void setze(p('an'), b.an, v, `${n} ${v ? 'an' : 'aus'}`)} /></td>
      <td style={TD}>
        <select value={b.produktId && produkte.some(x => x.id === b.produktId) ? b.produktId : '__frei'} aria-label="Produkt" onChange={e => produktWahl(e.target.value)} style={{ ...feld, fontSize: 12.5, padding: '6px 8px', borderRadius: 10, width: 170, appearance: 'auto' }} title={produkt?.fehlt.length ? `Für die Planung fehlt: ${produkt.fehlt.join(', ')}` : undefined}>
          <option value="__frei">{b.produktId && !produkte.some(x => x.id === b.produktId) ? `${b.produkt ?? 'Produkt'} (nicht im Katalog)` : 'ohne Produkt'}</option>
          {produkte.map(x => <option key={x.id} value={x.id}>{x.name}{x.status === 'entwurf' ? ' (Entwurf)' : ''}</option>)}
        </select>
        {!b.produktId && <TextFeld wert={b.name} onFertig={t => void setze(p('name'), b.name, t, `${n} · Name`)} breite={170} titel="Name" platzhalter="Was wird verkauft?" />}
        {produkt?.fehlt.length ? <div style={{ fontSize: 11, color: LEUCHT.achtung, marginTop: 2 }}>fehlt im Produkt: {produkt.fehlt.join(', ')}</div> : null}
      </td>
      <td style={TD}><TextFeld wert={b.kunde ?? ''} onFertig={t => void setze(p('kunde'), b.kunde, t || undefined, `${n} · Kunde`)} breite={150} titel="Kunde oder Segment" platzhalter="Kunde / Segment" /></td>
      <td style={TD}><Auswahl wert={b.einheit} onWahl={v => void setze(p('einheit'), b.einheit, v, `${n} · Wo`)} optionen={EINHEITEN} titel="Wo" /></td>
      <td style={TDr}><ZahlFeld wert={b.preis} dezimal={0} breite={96} onFertig={v => void setze(p('preis'), b.preis, v ?? 0, `${n} · Preis`)} titel="Preis netto" /></td>
      <td style={TDr}><ZahlFeld wert={b.menge} dezimal={0} breite={60} onFertig={v => void setze(p('menge'), b.menge, v ?? 1, `${n} · Menge`)} titel="Menge" /></td>
      <td style={TD}><Auswahl wert={b.rhythmus} onWahl={v => void setze(p('rhythmus'), b.rhythmus, v, `${n} · Rhythmus`)} optionen={RHYTHMEN} titel="Rhythmus" /></td>
      <td style={TD}><MonatWahl wert={b.start} onWahl={m => void setze(p('start'), b.start, m, `${n} · ab`)} monate={monate} /></td>
      <td style={TDr}>{b.rhythmus === 'einmalig' ? <span style={{ color: C.inkLeise }}>—</span> : <ZahlFeld wert={b.laufzeit ?? null} leer platzhalter="offen" dezimal={0} breite={64} onFertig={v => void setze(p('laufzeit'), b.laufzeit, v && v > 0 ? Math.round(v) : undefined, `${n} · Laufzeit`)} titel="Laufzeit in Monaten" />}</td>
      <td style={TD}>{kernKanal(b.einheit) === 'ug' ? <Auswahl wert={String(ziel)} onWahl={v => void setze(p('zahlungsziel'), b.zahlungsziel, Number(v), `${n} · Zahlungsziel`)} optionen={ZIELE} titel="Zahlungsziel" /> : <span style={{ color: C.inkLeise }}>—</span>}</td>
      <td style={TDr}><Geld v={summe} farbe={C.inkDim} /></td>
      <td style={TD}><KnopfKlein farbe={C.inkDim} onClick={entfernen} titel="Baustein entfernen">−</KnopfKlein></td>
    </tr>
  );
}

function KostenZeile({ b, setze, summe, monate, entfernen }: { b: Baustein; setze: Setze; summe: number; monate: string[]; entfernen: () => void }) {
  const p = (f: string) => `/bausteine/id=${b.id}/${f}`;
  const n = `Baustein ${b.name}`;
  return (
    <tr style={{ opacity: b.an ? 1 : 0.5 }}>
      <td style={TD}><Schalter an={b.an} onChange={v => void setze(p('an'), b.an, v, `${n} ${v ? 'an' : 'aus'}`)} /></td>
      <td style={TD}><Auswahl wert={b.kostenArt ?? 'sonstiges'} onWahl={v => void setze(p('kostenArt'), b.kostenArt, v, `${n} · Art`)} optionen={KOSTENARTEN} titel="Art" /></td>
      <td style={TD}><TextFeld wert={b.name} onFertig={t => void setze(p('name'), b.name, t, `${n} · Name`)} breite={160} titel="Name" /></td>
      <td style={TD}><Auswahl wert={b.einheit} onWahl={v => void setze(p('einheit'), b.einheit, v, `${n} · Wo`)} optionen={EINHEITEN} titel="Wo" /></td>
      <td style={TDr}><ZahlFeld wert={b.preis} dezimal={0} breite={96} onFertig={v => void setze(p('preis'), b.preis, v ?? 0, `${n} · Betrag`)} titel={b.kostenArt === 'stelle' ? 'Brutto je Monat (Arbeitgeberanteil kommt dazu)' : 'Betrag'} /></td>
      <td style={TDr}><ZahlFeld wert={b.menge} dezimal={0} breite={60} onFertig={v => void setze(p('menge'), b.menge, v ?? 1, `${n} · Menge`)} titel="Menge" /></td>
      <td style={TD}><Auswahl wert={b.rhythmus} onWahl={v => void setze(p('rhythmus'), b.rhythmus, v, `${n} · Rhythmus`)} optionen={RHYTHMEN} titel="Rhythmus" /></td>
      <td style={TD}><MonatWahl wert={b.start} onWahl={m => void setze(p('start'), b.start, m, `${n} · ab`)} monate={monate} /></td>
      <td style={TDr}>{b.rhythmus === 'einmalig' ? <span style={{ color: C.inkLeise }}>—</span> : <ZahlFeld wert={b.laufzeit ?? null} leer platzhalter="offen" dezimal={0} breite={64} onFertig={v => void setze(p('laufzeit'), b.laufzeit, v && v > 0 ? Math.round(v) : undefined, `${n} · Laufzeit`)} titel="Laufzeit in Monaten" />}</td>
      <td style={TDr}><Geld v={-summe} farbe={C.inkDim} /></td>
      <td style={TD}><KnopfKlein farbe={C.inkDim} onClick={entfernen} titel="Baustein entfernen">−</KnopfKlein></td>
    </tr>
  );
}

function ReglerZeile({ label, wert, min, max, schritt, einheit, prozent: pz, onLive, onFest }: { label: string; wert: number; min: number; max: number; schritt: number; einheit: string; prozent?: boolean; onLive: (v: number) => void; onFest: () => void }) {
  const { verbergen } = usePlan();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(120px, 2fr) 90px', gap: 10, alignItems: 'center', padding: '6px 0', fontSize: 12.5, color: C.inkDim }}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={schritt} value={wert} aria-label={label} onChange={e => onLive(Number(e.target.value))} onPointerUp={onFest} onKeyUp={onFest} onBlur={onFest} onTouchEnd={onFest} style={{ width: '100%', accentColor: C.aktiv }} />
      <span style={{ textAlign: 'right', fontFamily: SCHRIFT.display, fontVariantNumeric: 'tabular-nums', color: C.ink, ...(verbergen ? { filter: 'blur(6px)' } : {}) }}>{pz ? prozent(wert) : `${wert > 0 && min < 0 ? '+' : ''}${eur(wert)} ${einheit}`}</span>
    </div>
  );
}

function VergleichTabelle({ spalten, d, alsArbeitsplan }: { spalten: ReturnType<typeof vergleich>; d: Gerechnet['dd']; alsArbeitsplan: (id: string | null) => void }) {
  if (!spalten.length) return <Nichts>Oben Szenarien anhaken — bis zu drei nebeneinander.</Nichts>;
  const runway = (r: number | null, h: number) => (r == null ? `> ${h} M` : `${r} M`);
  const zeilen: { l: string; w: (s: ReturnType<typeof vergleich>[number]) => ReactNode }[] = [
    { l: 'Treiber', w: s => <span style={{ color: C.inkDim }}>{s.treiber}</span> },
    { l: 'Bausteine', w: s => <span style={{ color: C.inkDim }}>{s.ps ? `${s.ps.bausteine.filter(b => b.an).length} an` : '—'}</span> },
    { l: 'Frei verfügbar jetzt', w: s => <><Geld v={s.aw.frei.gesamt} /> €</> },
    { l: `Tiefpunkt ${UG_KURZ} frei`, w: s => <><Geld v={s.g.kz.minFrei} /> € <span style={{ color: C.inkLeise, fontSize: 11 }}>{monatLabel(d, s.g.kz.minMonat)}</span></> },
    { l: `Monate ${UG_KURZ} im Minus`, w: s => <span style={{ color: s.g.kz.monateMinus ? LEUCHT.kritisch : C.ink }}>{s.g.kz.monateMinus}</span> },
    { l: `Runway ${UG_KURZ}`, w: s => runway(s.aw.runway.ug, s.aw.runway.horizont) },
    { l: `${UG_KURZ} frei Dez 27`, w: s => <><Geld v={s.g.kz.freiDez27} /> €</> },
    { l: 'Umsatz 2027', w: s => <><Geld v={s.g.kz.umsatz2027} /> €</> },
    { l: 'Mindestumsatz Ø 12 M', w: s => <><Geld v={s.aw.mindestumsatz.schnitt12} farbe={C.inkDim} /> €</> },
    { l: 'Privat Luft, schlechtester Monat', w: s => <><Geld v={s.g.kz.privatLuftMin} /> €</> },
    { l: 'Runway Privat', w: s => runway(s.aw.runway.privat, s.aw.runway.horizont) },
    { l: 'Privat angespart Dez 27', w: s => <><Geld v={s.g.kz.privatAngespartDez27} /> €</> },
    { l: 'KD Ventures Dez 28', w: s => <><Geld v={s.g.kz.kdvDez28} /> €</> },
    { l: 'Gruppe Dez 28', w: s => <b><Geld v={s.g.kz.gruppeDez28} /> €</b> },
    { l: 'Ziele im Plan', w: s => <span style={{ color: s.aw.ziele.gekippt ? LEUCHT.achtung : LEUCHT.gut }}>{s.aw.ziele.imPlan} / {s.aw.ziele.gesamt}{s.aw.ziele.gekippt ? ` · ${s.aw.ziele.gekippt} gekippt` : ''}</span> },
    { l: 'Steuerrücklage jetzt', w: s => <><Geld v={s.aw.steuer.ruecklage} farbe={C.inkDim} /> €</> },
  ];
  return (
    <Tabelle klein>
      <thead><tr><th style={TH}></th>{spalten.map(s => <th key={s.id ?? '__basis'} style={{ ...THr, color: s.id && s.id === d.arbeitsplan ? C.aktiv : undefined }}>{s.id && s.id === d.arbeitsplan ? '★ ' : ''}{s.name}</th>)}</tr></thead>
      <tbody>
        {zeilen.map(z => <tr key={z.l}><td style={TDleise}>{z.l}</td>{spalten.map(s => <td key={s.id ?? '__basis'} style={TDr}>{z.w(s)}</td>)}</tr>)}
        <tr><td style={TDleise}></td>{spalten.map(s => <td key={s.id ?? '__basis'} style={TDr}>{s.id ? (s.id === d.arbeitsplan ? <Etikett text="Arbeitsplan" /> : <KnopfKlein onClick={() => alsArbeitsplan(s.id)}>★ Arbeitsplan</KnopfKlein>) : (!d.arbeitsplan ? <Etikett text="gilt" /> : <KnopfKlein farbe={C.inkDim} onClick={() => alsArbeitsplan(null)}>nur Treiber</KnopfKlein>)}</td>)}</tr>
      </tbody>
    </Tabelle>
  );
}

