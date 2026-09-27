'use client';

// ─── Finanzplanung jetzt — Überblick: Lage und Wochen-Check ──────────────────
// Malins Leitfrage als erste Karte: Wo stehen wir, wo sollten wir stehen, was
// entscheiden wir diese Woche? Die Entscheidung wird gespeichert. Der
// Wochen-Check ist der Montagabend-Rhythmus: fünf Punkte abhaken, Notiz,
// beide bestätigen.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP, MIKRO } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Raster, Spalten, Spalte, Haken, Knopf, LEUCHT, feld, Leer } from '../schlank';
import { zielStaende, zahlungskalender, istSchnitt, sollBudget } from '@/lib/finanzen/rechenkern';
import type { ZielStand } from '@/lib/finanzen/rechenkern';
import { eur, prozent, tagKurz, datumLang, plusTage, offeneBuchungen, heuteIndex, letzterVoller, tageIm, achse, monatLabel, neueKennung, postenOffen } from '@/lib/finanzen/plan/hilfen';
import { heuteBerlin } from '@/lib/finanzen/haushalt/monat';
import { entscheidungen } from '@/lib/finanzen/szenarien';
import { usePlan } from './daten';
import { Geld, Kachel, Kacheln, Etikett, StatusPille, PersonMarke, AnteilBalken, KnopfKlein, Auswahl, ampel, personName, KUPFER, LILA, Nichts, Hinweis, Legende } from './teile';
import { Linie } from './diagramme';

export function ZielKurz({ s, bjoernStart }: { s: ZielStand; bjoernStart: number }) {
  const { d } = usePlan();
  const runter = s.ziel.quelle === 'kdv.bjoern'; const start = runter ? bjoernStart : 0;
  const bis = s.verlauf[Math.min(s.verlauf.length, Math.max(1, s.bisMonat)) - 1] ?? 0;
  const p = runter ? (start - s.ziel.ziel > 0 ? 1 - (bis - s.ziel.ziel) / (start - s.ziel.ziel) : 1) : s.ziel.ziel > 0 ? bis / s.ziel.ziel : 1;
  const farbe = s.status === 'verfehlt' ? LEUCHT.kritisch : s.status === 'knapp' ? LEUCHT.achtung : LEUCHT.gut;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 5 }}><span style={{ fontSize: TYP.bedien, fontWeight: 600 }}>{s.ziel.name}</span><StatusPille status={s.status} /></div>
      <AnteilBalken anteil={Math.max(0, Math.min(1, p))} farbe={farbe} hoehe={6} />
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 4 }}>Ziel <Geld v={s.ziel.ziel} farbe={C.inkDim} /> € bis {s.ziel.bis.slice(5)}/{s.ziel.bis.slice(2, 4)} · {s.erreichtMonat ? `erreicht ${monatLabel(d, s.erreichtMonat)}` : 'im Planzeitraum nicht erreicht'}</div>
    </div>
  );
}

/** Einstieg (Kevin 27.09.): drei Zahlen — frei verfügbar diesen Monat, Runway, Ziele im Plan — und „Was jetzt zu entscheiden ist“ mit Sprung. */
function LageKopf() {
  const { d, ug, pr, aw, ps, sz, geh } = usePlan();
  const punkte = entscheidungen(d, { ug, pr, ps }, aw);
  const rw = (r: number | null, h: number) => (r == null ? `> ${h} M` : r === 0 ? 'jetzt' : `${r} M`);
  const rwFarbe = (r: number | null) => (r == null || r >= 12 ? LEUCHT.gut : r >= 6 ? LEUCHT.achtung : LEUCHT.kritisch);
  const stufeFarbe = { kritisch: LEUCHT.kritisch, achtung: LEUCHT.achtung, info: LEUCHT.puls } as const;
  return (
    <>
      <Kacheln min={230}>
        <Kachel label="Frei verfügbar diesen Monat" punkt={aw.frei.gesamt >= 5000 ? LEUCHT.gut : aw.frei.gesamt >= 0 ? LEUCHT.achtung : LEUCHT.kritisch} wert={<><Geld v={aw.frei.gesamt} /> €</>}
          unter={<>UG frei <Geld v={aw.frei.ug} farbe={C.inkDim} /> · KDV <Geld v={aw.frei.kdv} farbe={C.inkDim} /> · Privat <Geld v={aw.frei.privat} farbe={C.inkDim} />{aw.frei.kontenFehlen ? <span style={{ color: LEUCHT.achtung }}> · {aw.frei.kontenFehlen} Konten fehlen</span> : null}</>} />
        <Kachel label="Runway" punkt={rwFarbe(Math.min(aw.runway.ug ?? 99, aw.runway.privat ?? 99))} wert={<>UG {rw(aw.runway.ug, aw.runway.horizont)} · Privat {rw(aw.runway.privat, aw.runway.horizont)}</>} unter="Monate ab jetzt, bis frei verfügbar unter null fällt" />
        <Kachel label="Ziele im Plan" punkt={aw.ziele.gekippt ? LEUCHT.achtung : LEUCHT.gut} wert={`${aw.ziele.imPlan} / ${aw.ziele.gesamt}`} unter={aw.ziele.gesamt ? `${aw.ziele.gekippt} gekippt · ${aw.ziele.knapp} knapp` : 'noch keine Ziele'} />
      </Kacheln>
      <Karte i={0} akzent={C.aktiv}>
        <Ueberschrift rechts={<Knopf onClick={() => geh('planen')}>Planungsrunde öffnen ›</Knopf>}>Was jetzt zu entscheiden ist</Ueberschrift>
        {punkte.length ? punkte.map(p => (
          <div key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien, lineHeight: 1.45 }}>
            <span className={p.stufe === 'kritisch' ? 'zeit-puls' : undefined} style={{ width: 9, height: 9, borderRadius: '50%', background: stufeFarbe[p.stufe], flex: '0 0 auto', marginTop: 5, boxShadow: `0 0 8px ${stufeFarbe[p.stufe]}55` }} />
            <span style={{ flex: 1 }}>{p.text}{p.hinweis && <div style={{ fontSize: 12.5, color: C.inkLeise, marginTop: 2 }}>{p.hinweis}</div>}</span>
            <KnopfKlein onClick={() => geh(p.ziel.u, p.ziel.params)}>Öffnen ›</KnopfKlein>
          </div>
        )) : <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: LEUCHT.gut }} />Nichts drängt — die Zahlen tragen den Plan.</div>}
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 10 }}>Rechnet mit {ps ? <>dem Arbeitsplan <b style={{ color: C.inkDim }}>{ps.name}</b> auf Treiber {sz.name}</> : <>dem Treiber <b style={{ color: C.inkDim }}>{sz.name}</b> ohne Bausteine</>} · Stichtag {datumLang(d.einstellungen.heute)}.</div>
      </Karte>
    </>
  );
}

export function Lage() {
  const { d, ug, pr, kz, h, sz, aendere, geh, person } = usePlan();
  const zs = zielStaende(d, ug, pr);
  const ng = zs.find(z => z.ziel.id === 'g.notgroschen') ?? zs.find(z => z.ziel.quelle === 'privat.angespart');
  const offen = offeneBuchungen(d);
  const konten = d.posten.filter(p => p.art === 'konto'); const kontenBekannt = konten.filter(p => p.betrag != null);
  const forderungen = d.posten.filter(p => p.art === 'forderung' && ['offen', 'unklar'].includes(p.status));
  const zuZahlen = d.posten.filter(p => p.art === 'rechnung' && postenOffen(p));
  const schulden = d.schulden.filter(x => x.status !== 'getilgt').reduce((a, x) => a + x.rest, 0) + d.annahmen.bjoernBetrag;
  const L = letzterVoller(d), ji = heuteIndex(d), tag = Number(d.einstellungen.heute.slice(8)), tim = tageIm(ji);
  const flexZ = d.privatBudget.filter(z => z.typ === 'flex');
  const flexIst = flexZ.reduce((a, z) => a + (h.zeilen[z.id]?.[ji] ?? 0), 0), flexPlan = flexZ.reduce((a, z) => a + sollBudget(z, 1, d.plan), 0);
  const flexUeber = flexZ.map(z => ({ z, ist: istSchnitt(h.zeilen[z.id], 3, L) })).filter(x => x.ist > x.z.soll * 1.1);
  const warn: [string, string][] = [];
  const minus = ug.filter(u => u.frei < 0); if (minus.length) warn.push([LEUCHT.kritisch, `UG ${minus.length} Monate unter null frei — erster: ${monatLabel(d, minus[0].m)}`]);
  const eng = pr.filter(p => p.luft < 0);
  if (eng.length) warn.push([LEUCHT.kritisch, `Privat in ${eng.length} Monaten im Minus — erster: ${monatLabel(d, eng[0].m)}`]);
  else if (pr.some(p => p.luft < 100)) warn.push([LEUCHT.achtung, `Privat auf Kante: ${pr.filter(p => p.luft < 100).length} Monate unter 100 € Luft`]);
  if (flexUeber.length) warn.push([LEUCHT.achtung, `Flexibel über Plan (Ø 3 Monate): ${flexUeber.map(x => x.z.name).join(' · ')}`]);
  if (kz.obAnteilJun27 >= 0.3) warn.push([LEUCHT.achtung, `One Banking Juni 27 bei ${prozent(kz.obAnteilJun27)} des Umsatzes — Ziel unter 30 %`]);
  if (offen) warn.push([LEUCHT.achtung, `${offen} Buchungen ohne Zuordnung — IST ist dort unscharf`]);
  if (konten.length - kontenBekannt.length) warn.push([LEUCHT.achtung, `${konten.length - kontenBekannt.length} Kontostände fehlen`]);
  const termine = zahlungskalender(d, ug, pr, 14);
  const hi = d.historie.length, lab = achse(d);
  const leerVor = Array<number | null>(hi).fill(null);
  const heuteEcht = heuteBerlin();
  const [neu, setNeu] = useState({ text: '', wer: person || 'beide', bis: '' });
  const letzterCheck = d.check.eintraege[d.check.eintraege.length - 1];

  const zeile = (l: string, wert: React.ReactNode) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}><span style={{ color: C.inkDim }}>{l}</span><span>{wert}</span></div>;

  return (
    <>
      {d.einstellungen.heute !== heuteEcht && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5, color: C.inkDim, marginBottom: 12 }}>
          Stichtag der Rechnung: <b style={{ color: C.ink }}>{datumLang(d.einstellungen.heute)}</b>
          <KnopfKlein onClick={() => void aendere([{ pfad: '/einstellungen/heute', alt: d.einstellungen.heute, neu: heuteEcht }], 'Stichtag auf heute gesetzt')}>auf heute setzen ({datumLang(heuteEcht)})</KnopfKlein>
        </div>
      )}
      <LageKopf />
      <Karte i={1}>
        <Raster min={260}>
          <div>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Wo stehen wir heute?</div>
            {zeile('Auf den Konten', <><Geld v={kontenBekannt.reduce((a, p) => a + (p.betrag ?? 0), 0)} /> €{konten.length - kontenBekannt.length ? <span style={{ color: LEUCHT.achtung, fontSize: 12 }}> · {konten.length - kontenBekannt.length} fehlen</span> : null}</>)}
            {zeile('Uns geschuldet', <><Geld v={forderungen.reduce((a, p) => a + (p.betrag ?? 0), 0)} /> €</>)}
            {zeile('Zu zahlen', <><Geld v={zuZahlen.reduce((a, p) => a + (p.betrag ?? 0), 0)} /> €</>)}
            {zeile('Schulden', <><Geld v={schulden} /> €</>)}
          </div>
          <div>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Wo sollten wir stehen?</div>
            {zeile(`Flexibel ${lab[ji] ?? ''} bis Tag ${tag}`, <><Geld v={flexIst} farbe={flexIst > (flexPlan * tag) / tim * 1.05 ? LEUCHT.achtung : LEUCHT.gut} /> / <Geld v={(flexPlan * tag) / tim} farbe={C.inkDim} /> €</>)}
            {zeile('Privat Luft ab Okt', <><Geld v={pr[0]?.luft} /> €</>)}
            {zeile('UG frei Dez 26', <><Geld v={ug[2]?.frei} /> €</>)}
            {ng && zeile('Notgroschen Dez 27', <><Geld v={pr[14]?.angespart} farbe={ng.status === 'verfehlt' ? LEUCHT.achtung : LEUCHT.gut} /> / <Geld v={ng.ziel.ziel} farbe={C.inkDim} /> €</>)}
          </div>
          <div>
            <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Die wichtigste Entscheidung diese Woche</div>
            <EntscheidungFeld />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <KnopfKlein onClick={() => geh('check')}>Wochen-Check öffnen</KnopfKlein>
              <KnopfKlein farbe={C.inkDim} onClick={() => geh('planen')}>Planungsrunde</KnopfKlein>
              <span style={{ fontSize: 12, color: C.inkLeise }}>{letzterCheck ? `letzter Check ${datumLang(letzterCheck.datum)}` : 'noch kein Check'}</span>
            </div>
          </div>
        </Raster>
      </Karte>
      <Kacheln min={170}>
        <Kachel label="Tiefpunkt UG frei" punkt={ampel(kz.minFrei >= 1000, kz.minFrei >= 0)} wert={<><Geld v={kz.minFrei} /> €</>} unter={monatLabel(d, kz.minMonat)} />
        <Kachel label="UG frei Dez 27" punkt={ampel(kz.freiDez27 >= 20000, kz.freiDez27 >= 0)} wert={<><Geld v={kz.freiDez27} /> €</>} unter="nach Steuern und USt" />
        <Kachel label="Privat Luft" punkt={ampel(kz.privatLuftMin >= 250, kz.privatLuftMin >= 0)} wert={<><Geld v={kz.privatLuftMin} /> €</>} unter="schlechtester Monat" />
        {ng && <Kachel label="Notgroschen" punkt={ng.status === 'verfehlt' ? LEUCHT.achtung : LEUCHT.gut} wert={<><Geld v={pr[14]?.angespart} /> €</>} unter={<>Dez 27 · Ziel <Geld v={ng.ziel.ziel} farbe={C.inkDim} /> €{ng.erreichtMonat ? ` · erreicht ${monatLabel(d, ng.erreichtMonat)}` : ''}</>} />}
        <Kachel label="One Banking Jun 27" punkt={ampel(kz.obAnteilJun27 < 0.3, kz.obAnteilJun27 < 0.4)} wert={prozent(kz.obAnteilJun27)} unter="vom Umsatz · Ziel unter 30 %" />
        <Kachel label="Retainer" punkt={ampel(kz.retainerDez26 >= 4, kz.retainerDez26 >= 2)} wert={`${kz.retainerDez26} → ${kz.retainerJun27}`} unter="Dez 26 → Jun 27" />
      </Kacheln>
      <Spalten verhaeltnis="3:2">
        <Spalte>
          <Karte i={1}>
            <Ueberschrift rechts={<Legende eintraege={[{ farbe: KUPFER, text: 'UG frei' }, { farbe: LILA, text: 'Privat angespart' }, { farbe: LEUCHT.puls, text: 'KD Ventures' }, { farbe: C.ink, text: 'Gruppe' }]} />}>Geld der Familie — {sz.name}</Ueberschrift>
            <Linie labels={lab} heute={hi - 1} tick={4} serien={[
              { name: 'UG frei', farbe: KUPFER, werte: [...leerVor, ...ug.map(u => u.frei)], breite: 2.4 },
              { name: 'Privat angespart', farbe: LILA, werte: [...leerVor, ...pr.map(p => p.angespart)] },
              { name: 'KD Ventures', farbe: LEUCHT.puls, werte: [...leerVor, ...ug.map(u => u.kdvKonto)], breite: 1.4 },
              { name: 'Gruppe', farbe: C.ink, werte: [...leerVor, ...ug.map((u, i) => u.frei + u.kdvKonto + pr[i].angespart)], gestrichelt: true, breite: 1.4 },
            ]} />
          </Karte>
          <Karte i={3}>
            <Ueberschrift>Nächste 14 Tage</Ueberschrift>
            {termine.length ? termine.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}>
                <span style={{ color: C.inkLeise, width: 44, fontVariantNumeric: 'tabular-nums' }}>{tagKurz(t.datum)}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                <Etikett einheit={t.einheit} />
                <Geld v={t.betrag} farbe={t.betrag > 0 ? LEUCHT.gut : undefined} stil={{ width: 84, textAlign: 'right' }} />
              </div>
            )) : <Nichts>Nichts fällig.</Nichts>}
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={2}>
            <Ueberschrift>Worauf wir achten</Ueberschrift>
            {warn.length ? warn.map(([f, t], i) => <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', fontSize: TYP.bedien, lineHeight: 1.45 }}><span className={f === LEUCHT.kritisch ? 'zeit-puls' : undefined} style={{ width: 9, height: 9, borderRadius: '50%', background: f, flex: '0 0 auto', marginTop: 5, boxShadow: `0 0 8px ${f}55` }} /><span>{t}</span></div>)
              : <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: TYP.bedien }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: LEUCHT.gut }} />Alles im Rahmen.</div>}
          </Karte>
          <Karte i={4}>
            <Ueberschrift>Ziele</Ueberschrift>
            {zs.length ? zs.map(s => <ZielKurz key={s.ziel.id} s={s} bjoernStart={d.annahmen.bjoernBetrag} />) : <Nichts>Noch keine Ziele — unter Planen › Ziele anlegen.</Nichts>}
          </Karte>
          <Karte i={5}>
            <Ueberschrift>Nächste Schritte</Ueberschrift>
            {d.fokus.schritte.filter(s => !s.erledigt).slice(0, 8).map(s => (
              <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: TYP.bedien }}>
                <Haken an={false} onChange={() => void aendere([{ pfad: `/fokus/schritte/id=${s.id}/erledigt`, alt: false, neu: true }], `Schritt erledigt: ${s.text}`)} />
                <span style={{ flex: 1 }}>{s.text}</span>
                <PersonMarke wer={s.wer} />
                <span style={{ fontSize: 12, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{tagKurz(s.bis)}</span>
              </div>
            ))}
            {!d.fokus.schritte.some(s => !s.erledigt) && <Nichts>Keine offenen Schritte.</Nichts>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 6, marginTop: 10, alignItems: 'center' }}>
              <input value={neu.text} placeholder="Neuer Schritt" aria-label="Neuer Schritt" onChange={e => setNeu({ ...neu, text: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', borderRadius: 10 }} />
              <Auswahl wert={neu.wer} onWahl={w => setNeu({ ...neu, wer: w })} optionen={[{ id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Beide' }]} titel="Wer" />
              <input type="date" value={neu.bis} aria-label="bis wann" onChange={e => setNeu({ ...neu, bis: e.target.value })} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', borderRadius: 10, width: 'auto' }} />
              <Knopf aus={!neu.text.trim()} onClick={async () => { const t = neu.text.trim(); if (!t) return; if (await aendere([{ pfad: '/fokus/schritte/-', neu: { id: neueKennung('st'), text: t, wer: neu.wer, bis: neu.bis || d.einstellungen.heute, erledigt: false } }], `Schritt angelegt: ${t}`)) setNeu({ ...neu, text: '' }); }}>+</Knopf>
            </div>
            {d.fokus.regeln.length > 0 && <>
              <div style={{ ...MIKRO, marginTop: 16, marginBottom: 6 }}>Finanzregeln</div>
              {d.fokus.regeln.map((r, i) => <div key={i} style={{ fontSize: 12.5, color: C.inkDim, padding: '3px 0', lineHeight: 1.45 }}>{r}</div>)}
            </>}
          </Karte>
        </Spalte>
      </Spalten>
      <Hinweis>Steuern und Netto sind Näherungen aus den Annahmen — Hinweis, keine Steuerberatung.</Hinweis>
    </>
  );
}

function EntscheidungFeld() {
  const { d, aendere } = usePlan();
  const [t, setT] = useState(d.fokus.entscheidung ?? '');
  const [fokus, setFokus] = useState(false);
  const gespeichert = d.fokus.entscheidung ?? '';
  // Ohne Fokus zeigt das Feld immer den gespeicherten Stand — so erscheint auch Malins Änderung von selbst.
  return (
    <textarea rows={3} value={fokus ? t : gespeichert} placeholder="Was entscheiden wir diese Woche?" aria-label="Entscheidung der Woche"
      onFocus={() => { setT(gespeichert); setFokus(true); }} onChange={e => setT(e.target.value)}
      onBlur={() => { setFokus(false); if (t !== gespeichert) void aendere([{ pfad: '/fokus/entscheidung', alt: gespeichert, neu: t }], 'Entscheidung der Woche'); }}
      style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5 }} />
  );
}

export function Check() {
  const { d, ug, pr, h, aendere, person } = usePlan();
  const heute = d.einstellungen.heute;
  const idx = d.check.eintraege.findIndex(x => x.datum === heute);
  const e = idx >= 0 ? d.check.eintraege[idx] : { datum: heute, wer: [] as string[], erledigt: [] as number[], notiz: '' };
  const L = letzterVoller(d);
  const termine = zahlungskalender(d, ug, pr, 14); const aus14 = termine.filter(t => t.betrag < 0 && t.einheit === 'privat').reduce((s, t) => s + t.betrag, 0);
  const flexUeber = d.privatBudget.filter(z => z.typ === 'flex').filter(z => istSchnitt(h.zeilen[z.id], 1, L) > z.soll * 1.1);
  const ford = d.posten.filter(p => p.art === 'forderung' && ['offen', 'unklar'].includes(p.status));
  const fakten = [`${offeneBuchungen(d)} Buchungen ohne Zuordnung`, flexUeber.length ? `Über Plan im letzten Monat: ${flexUeber.map(z => z.name).join(', ')}` : 'Flexible Ausgaben im Plan',
    `${ford.length} offene Forderungen · ${eur(ford.reduce((s, p) => s + (p.betrag ?? 0), 0))} €`, `Privat nächste 14 Tage: ${eur(aus14)} €`, `${d.fokus.schritte.filter(s => !s.erledigt).length} offene Schritte`];
  const [notiz, setNotiz] = useState(e.notiz);
  const [notizFokus, setNotizFokus] = useState(false);
  const ich = person || 'kevin';

  /** Eintrag von heute ändern — anlegen, wenn es ihn noch nicht gibt. */
  const setzeEintrag = (teil: Partial<typeof e>, feld: string) => {
    if (idx < 0) return aendere([{ pfad: '/check/eintraege/-', neu: { ...e, ...teil } }], feld);
    const ops = Object.entries(teil).map(([k, v]) => ({ pfad: `/check/eintraege/${idx}/${k}`, alt: (e as Record<string, unknown>)[k], neu: v }));
    return aendere(ops, feld);
  };
  const bestaetigen = () => {
    const wer = e.wer.includes(ich) ? e.wer : [...e.wer, ich];
    const teil: Partial<typeof e> = { wer, notiz };
    void (async () => {
      await setzeEintrag(teil, `Wochen-Check ${datumLang(heute)} bestätigt`);
      const erste = notiz.trim().split('\n')[0];
      if (erste && erste !== d.fokus.entscheidung) await aendere([{ pfad: '/fokus/entscheidung', alt: d.fokus.entscheidung, neu: erste }], 'Entscheidung der Woche');
    })();
  };

  return (
    <Spalten verhaeltnis="1:1">
      <Spalte>
        <Karte i={0}>
          <Ueberschrift>Finanz-Check {datumLang(heute)} — 20 Minuten, zu zweit</Ueberschrift>
          {d.check.punkte.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
              <Haken an={e.erledigt.includes(i)} onChange={() => void setzeEintrag({ erledigt: e.erledigt.includes(i) ? e.erledigt.filter(x => x !== i) : [...e.erledigt, i] }, `Check: ${p}`)} />
              <span style={{ flex: 1, fontSize: TYP.bedien }}>{p}</span>
              <span style={{ fontSize: 12, color: C.inkLeise, textAlign: 'right' }}>{fakten[i] ?? ''}</span>
            </div>
          ))}
          {!d.check.punkte.length && <Leer>Noch keine Check-Punkte hinterlegt.</Leer>}
          <div style={{ ...MIKRO, marginTop: 14, marginBottom: 6 }}>Entscheidungen &amp; Notizen</div>
          <textarea rows={4} value={notizFokus ? notiz : (e.notiz || notiz)} aria-label="Notizen zum Check" onFocus={() => { setNotiz(e.notiz || notiz); setNotizFokus(true); }} onChange={ev => setNotiz(ev.target.value)}
            onBlur={() => { setNotizFokus(false); if (notiz !== e.notiz) void setzeEintrag({ notiz }, 'Check-Notiz'); }} style={{ ...feld, resize: 'vertical', fontSize: TYP.bedien, lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: C.inkDim }}>Bestätigt:</span>
            {['kevin', 'malin'].map(w => <span key={w} style={{ opacity: e.wer.map(x => x.toLowerCase()).includes(w) ? 1 : 0.35 }}><PersonMarke wer={w} mitName /></span>)}
            <span style={{ flex: 1 }} />
            <Knopf onClick={bestaetigen}>Als {personName(ich)} bestätigen</Knopf>
          </div>
        </Karte>
      </Spalte>
      <Spalte>
        <Karte i={1}>
          <Ueberschrift>Frühere Checks</Ueberschrift>
          {d.check.eintraege.length ? d.check.eintraege.slice().reverse().map(x => (
            <div key={x.datum} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: TYP.bedien }}>
              <span style={{ color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{datumLang(x.datum)}</span>
              <span style={{ flex: 1, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.notiz || '—'}</span>
              <span style={{ color: C.inkLeise }}>{x.erledigt.length}/{d.check.punkte.length}</span>
              {x.wer.map(w => <PersonMarke key={w} wer={w} />)}
            </div>
          )) : <Nichts>Noch keiner. Vorschlag: jeden Montagabend beim MAKE-Abgleich.</Nichts>}
          <Hinweis>Der Rhythmus: Buchungen zuordnen → Monat prüfen → Zu erledigen abhaken → eine Entscheidung festhalten → beide bestätigen. Nächster Vorschlag: {datumLang(plusTage(heute, 7))}.</Hinweis>
        </Karte>
      </Spalte>
    </Spalten>
  );
}
