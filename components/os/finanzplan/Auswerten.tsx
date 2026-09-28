'use client';

// ─── Finanzplanung jetzt — Auswerten ─────────────────────────────────────────
// Entwicklung (IST-Verlauf und Plan, Sparquote, Fixkostenquote, was sich am
// stärksten bewegt), Geldfluss (Einnahmen → Haushalt/Umsatz → Töpfe, einfacher
// SVG-Fluss) und Protokoll (wer hat was geändert).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Spalten, Spalte, LEUCHT } from '../schlank';
import { istSchnitt, sollBudget, wert } from '@/lib/finanzen/rechenkern';
import { achse, letzterVoller, prozent } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { Geld, Kachel, Kacheln, Tabelle, TH, THr, TD, TDr, TDleise, Auswahl, Hinweis, Legende, PersonMarke, KUPFER, LILA, Nichts, Pillen } from './teile';
import { Linie, Fluss, type FlussKante } from './diagramme';
import { Blatt } from './Blatt';

// ── Entwicklung ─────────────────────────────────────────────────────────────
export function Entwicklung() {
  const { d, pr, h } = usePlan();
  const [k, setK] = useState<1 | 3 | 6>(3);
  const hi = d.historie.length, L = letzterVoller(d);
  const lab = achse(d).slice(0, hi + 15);
  const ein = [...h.einnahmen.slice(0, hi - 1), null, ...pr.slice(0, 15).map(p => p.verfuegbar)];
  const aus = [...h.ausgaben.slice(0, hi - 1), null, ...pr.slice(0, 15).map(p => p.bedarf + p.schulden + p.ereignisse)];
  const sch = (a: number[] | undefined) => istSchnitt(a, k, L), vor = (a: number[] | undefined) => istSchnitt(a, k, L - k);
  const fixIst = d.privatBudget.filter(z => z.typ === 'fix').reduce((s, z) => s + sch(h.zeilen[z.id]), 0);
  const e0 = sch(h.einnahmen), a0 = sch(h.ausgaben), e1 = vor(h.einnahmen), a1 = vor(h.ausgaben);
  const pfeil = (v: number, w: number, gut: boolean) => { if (!w) return null; const dlt = (v - w) / Math.abs(w); const f = Math.abs(dlt) < 0.03 ? C.inkLeise : (dlt > 0) === gut ? LEUCHT.gut : LEUCHT.kritisch; return <span style={{ color: f, fontSize: 12 }}>{dlt > 0 ? '▲' : '▼'} {prozent(Math.abs(dlt))} gegenüber davor</span>; };
  const bewegung = [...d.privatBudget, ...d.privatSchulden].map(z => ({ z, jetzt: sch(h.zeilen[z.id]), vorher: vor(h.zeilen[z.id]) })).filter(x => x.jetzt || x.vorher).sort((a, b) => Math.abs(b.jetzt - b.vorher) - Math.abs(a.jetzt - a.vorher)).slice(0, 8);
  const planLuft = (pr[0]?.luft ?? 0) + (pr[0]?.sparenSoll ?? 0);
  const p3 = pr[3];
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pillen liste={[{ id: '1' as const, label: 'Letzter Monat' }, { id: '3' as const, label: '3 Monate' }, { id: '6' as const, label: '6 Monate' }]} aktiv={String(k) as '1' | '3' | '6'} onWahl={v => setK(Number(v) as 1 | 3 | 6)} />
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>Durchschnitt je Monat, verglichen mit dem Zeitraum davor · laufender Monat bleibt draußen</span>
      </div>
      <Kacheln min={160}>
        <Kachel label="Einnahmen" wert={<><Geld v={e0} /> €</>} unter={pfeil(e0, e1, true) ?? 'kein Vergleich'} />
        <Kachel label="Ausgaben" wert={<><Geld v={a0} /> €</>} unter={pfeil(a0, a1, false) ?? 'kein Vergleich'} />
        <Kachel label="Überschuss" wert={<><Geld v={e0 - a0} /> €</>} unter={<>Plan ab Okt <Geld v={planLuft} farbe={C.inkDim} /> €</>} />
        <Kachel label="Sparquote" wert={e0 ? prozent((e0 - a0) / e0) : '—'} unter={p3 && p3.verfuegbar ? `Plan ${prozent((p3.luft + p3.sparenSoll) / p3.verfuegbar)}` : ''} />
        <Kachel label="Fixkostenquote" wert={e0 ? prozent(fixIst / e0) : '—'} unter="je höher, desto weniger Spielraum" />
        <Kachel label="Schuldendienst" wert={<><Geld v={sch(h.zeilen['p.d.altlasten'])} /> €</>} unter="Ø je Monat" />
      </Kacheln>
      <Spalten verhaeltnis="3:2">
        <Spalte>
          <Karte i={0}>
            <Ueberschrift rechts={<Legende eintraege={[{ farbe: C.inkDim, text: 'Einnahmen' }, { farbe: KUPFER, text: 'Ausgaben' }]} />}>Einnahmen und Ausgaben — IST bis zum letzten vollen Monat, danach Plan</Ueberschrift>
            <Linie labels={lab} heute={hi - 1} tick={3} hoehe={250} serien={[{ name: 'Einnahmen', farbe: C.inkDim, werte: ein }, { name: 'Ausgaben', farbe: KUPFER, werte: aus }]} />
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={1}>
            <Ueberschrift>Was sich am stärksten bewegt</Ueberschrift>
            <Tabelle klein>
              <thead><tr><th style={TH}>Topf</th><th style={THr}>jetzt</th><th style={THr}>davor</th><th style={THr}>Plan</th></tr></thead>
              <tbody>
                {bewegung.map(x => { const soll = sollBudget(x.z, 1, d.plan); return <tr key={x.z.id}><td style={TD}>{x.z.name}</td><td style={TDr}><Geld v={x.jetzt} /></td><td style={TDr}><Geld v={x.vorher} farbe={C.inkLeise} /></td><td style={TDr}><Geld v={soll} farbe={x.jetzt > soll * 1.1 ? LEUCHT.achtung : C.inkLeise} /></td></tr>; })}
                {!bewegung.length && <tr><td colSpan={4} style={TDleise}>Noch keine Bewegung — es fehlen zugeordnete Buchungen.</td></tr>}
              </tbody>
            </Tabelle>
          </Karte>
        </Spalte>
      </Spalten>
    </>
  );
}

// ── Geldfluss ───────────────────────────────────────────────────────────────
const GF: Record<string, string> = { Fixkosten: LEUCHT.puls, 'Jahreskosten & Puffer': KUPFER, Flexibel: C.aktiv, Sparen: LILA, Schulden: LEUCHT.kritisch, Luft: C.ink, Ereignisse: LEUCHT.achtung, Fehlbetrag: LEUCHT.kritisch, 'Nicht zugeordnet': C.inkLeise };

export function Geldfluss() {
  const { d, ug, pr, h, sz } = usePlan();
  const [art, setArt] = useState<'privat' | 'ug'>('privat');
  const [m, setM] = useState(1);
  const optionen = [...(art === 'privat' ? d.historie.map((l, j) => ({ id: String(-(j + 1)), label: `${l} IST` })) : []), ...d.monate.map((l, j) => ({ id: String(j + 1), label: l }))];
  const kanten: FlussKante[] = [];
  if (art === 'privat') {
    if (m > 0) {
      const p = pr[m - 1];
      const quellen: [string, number][] = [['Kevin netto', p.kevinNetto], ['Malin netto', p.malinNetto], ...d.privatEinnahmen.map((z): [string, number] => [z.name, wert(z, m, d.plan)])];
      quellen.filter(x => x[1] > 0).forEach(([n, v]) => kanten.push({ von: n, nach: 'Haushalt', wert: v, farbe: C.inkDim, sv: 0, sn: 1 }));
      if (p.luft < 0) kanten.push({ von: 'Fehlbetrag', nach: 'Haushalt', wert: -p.luft, farbe: LEUCHT.kritisch, sv: 0, sn: 1 });
      const ziele: [string, number][] = [['Fixkosten', p.fix], ['Jahreskosten & Puffer', p.jahr], ['Flexibel', p.flex], ['Sparen', p.sparenSoll], ['Schulden', p.schulden], ['Ereignisse', p.ereignisse], ['Luft', Math.max(0, p.luft)]];
      ziele.filter(x => x[1] > 0).forEach(([n, v]) => kanten.push({ von: 'Haushalt', nach: n, wert: v, farbe: GF[n] ?? C.inkLeise, sv: 1, sn: 2 }));
    } else {
      const i = -m - 1;
      if (h.einnahmen[i] > 0) kanten.push({ von: 'Einnahmen', nach: 'Haushalt', wert: h.einnahmen[i], farbe: C.inkDim, sv: 0, sn: 1 });
      const nachGruppe: Record<string, number> = {};
      for (const z of d.privatBudget) { const v = h.zeilen[z.id]?.[i] ?? 0; if (v > 0) nachGruppe[z.gruppe] = (nachGruppe[z.gruppe] ?? 0) + v; }
      const schulden = d.privatSchulden.reduce((s, z) => s + (h.zeilen[z.id]?.[i] ?? 0), 0); if (schulden > 0) nachGruppe.Schulden = schulden;
      if (h.offen[i] > 0) nachGruppe['Nicht zugeordnet'] = h.offen[i];
      const sumA = Object.values(nachGruppe).reduce((a, b) => a + Math.max(0, b), 0); const diff = h.einnahmen[i] - sumA;
      if (diff < 0) kanten.push({ von: 'Fehlbetrag', nach: 'Haushalt', wert: -diff, farbe: LEUCHT.kritisch, sv: 0, sn: 1 }); else if (diff > 0) nachGruppe.Luft = diff;
      Object.entries(nachGruppe).filter(x => x[1] > 0).forEach(([n, v]) => kanten.push({ von: 'Haushalt', nach: n, wert: v, farbe: GF[n] ?? C.inkLeise, sv: 1, sn: 2 }));
    }
  } else {
    const mm = Math.max(1, m); const u = ug[mm - 1]; const steuer = Math.max(0, u.gewinn) * d.annahmen.steuerUG;
    ([['Ankermandat', u.ob], ['Retainer', u.retainer], ['ASTARNA', u.astarna], ['Events', u.events]] as [string, number][]).filter(x => x[1] > 0).forEach(([n, v]) => kanten.push({ von: n, nach: 'Umsatz', wert: v, farbe: C.inkDim, sv: 0, sn: 1 }));
    if (u.gewinn < 0) kanten.push({ von: 'Verlust', nach: 'Umsatz', wert: -u.gewinn, farbe: LEUCHT.kritisch, sv: 0, sn: 1 });
    ([['Kevin', u.kevin], ['Malin', u.malin], ['Unterstützung', u.unterstuetzung], ['Sachkosten', u.sach + u.gruendung], ['Holding', u.holding], ['Steuerrücklage', steuer], ['Gewinn nach Steuer', Math.max(0, u.gewinn - steuer)]] as [string, number][]).filter(x => x[1] > 0)
      .forEach(([n, v]) => kanten.push({ von: 'Umsatz', nach: n, wert: v, farbe: n === 'Gewinn nach Steuer' ? C.aktiv : n === 'Steuerrücklage' ? LEUCHT.achtung : n === 'Sachkosten' ? LEUCHT.puls : KUPFER, sv: 1, sn: 2 }));
  }
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pillen liste={[{ id: 'privat' as const, label: 'Privat' }, { id: 'ug' as const, label: 'MAKE OS UG' }]} aktiv={art} onWahl={a => { setArt(a); if (a === 'ug' && m < 1) setM(3); }} />
        <Auswahl wert={String(m)} onWahl={v => setM(Number(v))} optionen={optionen} titel="Monat" />
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>{sz.name}</span>
      </div>
      <Karte i={0}>
        <Ueberschrift>Wohin das Geld fließt</Ueberschrift>
        <Fluss kanten={kanten} />
        <Hinweis>{art === 'privat' ? 'Links die Einnahmen, in der Mitte der Haushalt, rechts die Töpfe. IST-Monate zeigen die Buchungen, Plan-Monate den Plan.' : 'Links die Umsatzquellen, rechts, wohin der Umsatz geht — Steuerrücklage als Näherung.'}</Hinweis>
      </Karte>
      <Karte i={1}>
        <Ueberschrift>Gruppe je Monat</Ueberschrift>
        <Blatt titel="Gruppe" zeilen={[
          { grp: 'Stand' },
          { name: 'MAKE OS UG frei', stock: true, get: mm => ug[mm - 1].frei, ind: true },
          { name: 'KD Ventures', stock: true, get: mm => ug[mm - 1].kdvKonto, ind: true },
          { name: 'Privat angespart', stock: true, get: mm => pr[mm - 1].angespart, ind: true },
          { name: 'Partnerdarlehen offen', stock: true, get: mm => -ug[mm - 1].bjoernRest, ind: true },
          { name: 'Freies Geld Gruppe', stock: true, sum: true, key: true, get: mm => ug[mm - 1].frei + ug[mm - 1].kdvKonto + pr[mm - 1].angespart },
        ]} />
      </Karte>
    </>
  );
}

// ── Protokoll ───────────────────────────────────────────────────────────────
export function Protokoll() {
  const { d } = usePlan();
  const [mehr, setMehr] = useState(100);
  const wann = (iso: string) => { const t = new Date(iso); return Number.isNaN(t.getTime()) ? iso : t.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); };
  return (
    <Karte i={0}>
      <Ueberschrift rechts={<span>{d.protokoll.length} Einträge · die letzten 500 bleiben</span>}>Wer hat was geändert</Ueberschrift>
      {d.protokoll.length ? (
        <Tabelle klein>
          <thead><tr><th style={TH}>Wann</th><th style={TH}>Wer</th><th style={TH}>Was</th><th style={TH}>vorher</th><th style={TH}>nachher</th></tr></thead>
          <tbody>
            {d.protokoll.slice(0, mehr).map((p, i) => (
              <tr key={i}>
                <td style={{ ...TDleise, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{wann(p.wann)}</td>
                <td style={TD}><PersonMarke wer={p.wer} mitName /></td>
                <td style={{ ...TD, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.feld}>{p.feld}</td>
                <td style={{ ...TDleise, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.alt}>{p.alt}</td>
                <td style={{ ...TD, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.neu}>{p.neu}</td>
              </tr>
            ))}
          </tbody>
        </Tabelle>
      ) : <Nichts>Noch keine Änderungen.</Nichts>}
      {d.protokoll.length > mehr && <div style={{ marginTop: 10, fontSize: TYP.bedien }}><button type="button" onClick={() => setMehr(mehr + 200)} style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>{d.protokoll.length - mehr} weitere</button></div>}
      <Hinweis>Jede Änderung — auch Rückgängig — steht hier mit Person und Zeit.</Hinweis>
    </Karte>
  );
}
