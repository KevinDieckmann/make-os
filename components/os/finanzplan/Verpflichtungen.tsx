'use client';

// ─── Finanzplanung jetzt — Verpflichtungen ───────────────────────────────────
// Schulden (Tilgungsplan, schuldenfrei-Datum, Sondertilgung als Probe, Zinsen),
// Zu erledigen (Konto · Forderung · Rechnung · Beleg · Aufgabe mit fällig/wer,
// abhaken) und Kalender & Verträge (Zahlungskalender 8 Wochen, Verträge mit
// Kündigungsfrist und Ø IST).

import { useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Spalten, Spalte, Haken, LEUCHT } from '../ui';
import type { Darlehen, DarlehenOrt, Einheit, Posten, Schuld } from '@/lib/finanzen/rechenkern';
import { tilgungsplan, zahlungskalender, istSchnitt, sollBudget, darlehenListe, darlehenOffen, DARLEHEN_ALT } from '@/lib/finanzen/rechenkern';
import { DARLEHEN_ORTE, DARLEHEN_BUSINESS, darlehenOrtName, darlehenBusinessAenderbar, darlehenFuerBusiness, neuesDarlehen } from '@/lib/finanzen/darlehen';
import { nurBusinessTermine } from '@/lib/finanzen/plan/sicht';
import { EINHEIT_LABEL, KAL, monatLabel, tagKurz, plusTage, letzterVoller, neueKennung, postenOffen, personKennung } from '@/lib/finanzen/plan/hilfen';
import { usePlan } from './daten';
import { UG_NAME } from '@/lib/einheiten';
import { ZeileDialog } from './ZeileDialog';
import { Geld, Kachel, Kacheln, Etikett, Tabelle, TH, THr, TD, TDr, TDleise, ZahlFeld, TextFeld, Auswahl, MonatWahl, KnopfKlein, Hinweis, Nichts, eingabeStil, KUPFER, Pillen } from './teile';
import { Linie } from './diagramme';

const EINHEITEN = (Object.keys(EINHEIT_LABEL) as Einheit[]).map(e => ({ id: e, label: EINHEIT_LABEL[e] }));
/** Business-Sicht (04.10.; seit 05.10. ohne die Selbstständigkeit — sie gehört zu Privat): nur die Gesellschaften; neue Einträge starten bei der MAKE Innovation GmbH. */
const einheitenFuer = (business: boolean) => (business ? EINHEITEN.filter(e => e.id === 'ug' || e.id === 'kdv') : EINHEITEN);
const WER = [{ id: 'kevin', label: 'Kevin' }, { id: 'malin', label: 'Malin' }, { id: 'beide', label: 'Beide' }];

// ── Schulden ────────────────────────────────────────────────────────────────
export function Schulden() {
  const { d, ug, sz, aendere, sicht } = usePlan();
  const business = sicht === 'business';
  const [sonder, setSonder] = useState<Record<string, number>>({});
  const N = d.monate.length;
  const plaene = d.schulden.map(s => ({ s, t: tilgungsplan(s, sonder[s.id] ?? 0, N), t0: tilgungsplan(s, 0, N) }));
  const summe = d.monate.map((_, i) => plaene.reduce((a, x) => a + (x.s.status === 'getilgt' ? 0 : x.t.monate[i]), 0) + ug[i].bjoernRest);
  const heute = plaene.reduce((a, x) => a + (x.s.status === 'getilgt' ? 0 : x.s.rest), 0) + d.annahmen.bjoernBetrag;
  const privat = plaene.filter(x => x.s.einheit === 'privat' && x.s.status !== 'getilgt');
  const freiPrivat = privat.some(x => x.t.frei === null) ? null : Math.max(0, ...privat.map(x => x.t.frei ?? 0));
  const unklar = d.schulden.filter(s => s.status === 'unklar');
  const darlehenFrei = (() => { const i = ug.findIndex(u => u.bjoernRest <= 0.5); return i >= 0 ? monatLabel(d, i + 1) : '—'; })();
  const setze = (s: Schuld, feld: keyof Schuld, alt: unknown, neu: unknown, label: string) => void aendere([{ pfad: `/schulden/id=${s.id}/${feld}`, alt, neu }], `Schuld ${s.name} · ${label}`);
  return (
    <>
      <Kacheln min={170}>
        <Kachel label="Schulden heute" wert={<><Geld v={heute} /> €</>} unter={<>inkl. Partnerdarlehen <Geld v={d.annahmen.bjoernBetrag} farbe={C.inkDim} /> €</>} />
        {!business && <Kachel label="Privat schuldenfrei" wert={freiPrivat === null ? '—' : freiPrivat === 0 ? 'jetzt' : monatLabel(d, freiPrivat)} unter={freiPrivat === null ? 'ohne Rate kein Datum' : 'bei den eingetragenen Raten'} />}
        <Kachel label="Partnerdarlehen getilgt" wert={darlehenFrei} unter={`über die ${UG_NAME} · Szenario ${sz.name}`} />
        <Kachel label="Ungeklärt" wert={String(unklar.length)} punkt={unklar.length ? LEUCHT.achtung : LEUCHT.gut} unter={<><Geld v={unklar.reduce((a, s) => a + s.rest, 0)} farbe={C.inkDim} /> € ohne Plan</>} />
      </Kacheln>
      <Karte i={0}>
        <Ueberschrift>Schuldenstand gesamt — {sz.name}</Ueberschrift>
        <Linie labels={d.monate} hoehe={200} serien={[{ name: 'Schulden gesamt', farbe: LEUCHT.kritisch, werte: summe }, { name: 'Partnerdarlehen', farbe: KUPFER, werte: ug.map(u => u.bjoernRest), breite: 1.3 }]} />
      </Karte>
      <Karte i={1}>
        <Ueberschrift rechts={<KnopfKlein onClick={() => void aendere([{ pfad: '/schulden/-', neu: { id: neueKennung('s'), name: 'Neue Schuld', einheit: business ? 'ug' : 'privat', rest: 0, rate: 0, zins: 0, start: 1, status: 'läuft' } }], 'Schuld angelegt')}>+ Schuld</KnopfKlein>}>Einzeln</Ueberschrift>
        <Tabelle klein>
          <thead><tr><th style={TH}>Name</th><th style={TH}>Einheit</th><th style={TH}>Status</th><th style={THr}>Rest</th><th style={THr}>Rate</th><th style={THr}>Zins %</th><th style={TH}>erste Rate</th><th style={TH}>Sondertilgung / Monat (Probe)</th><th style={TH}>schuldenfrei</th><th style={THr}>Zinsen</th><th style={TH}></th></tr></thead>
          <tbody>
            <tr>
              <td style={TD}>Partnerdarlehen</td><td style={TD}><Etikett einheit="kdv" /></td><td style={TD}>läuft</td>
              <td style={TDr}><Geld v={d.annahmen.bjoernBetrag} /></td><td style={TDr}><Geld v={d.annahmen.bjoernRate} /></td><td style={TDr}>—</td>
              <td style={TD}>{d.annahmen.bjoernRateVon ? monatLabel(d, d.annahmen.bjoernRateVon) : '—'}</td><td style={TDleise}>Planen › Szenarien</td><td style={TD}>{darlehenFrei}</td><td style={TDr}><Geld v={d.annahmen.bjoernZinsDeckel} farbe={C.inkLeise} /></td><td style={TD}></td>
            </tr>
            {plaene.map(({ s, t, t0 }) => (
              <tr key={s.id}>
                <td style={TD}><TextFeld wert={s.name} onFertig={v => setze(s, 'name', s.name, v, 'Name')} breite={160} titel="Name" />{s.notiz && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 3, maxWidth: 240 }}>{s.notiz}</div>}</td>
                <td style={TD}><Auswahl wert={s.einheit} onWahl={v => setze(s, 'einheit', s.einheit, v, 'Einheit')} optionen={einheitenFuer(business)} titel="Einheit" /></td>
                <td style={TD}><Auswahl wert={s.status} onWahl={v => setze(s, 'status', s.status, v, 'Status')} optionen={[{ id: 'läuft', label: 'läuft' }, { id: 'unklar', label: 'unklar' }, { id: 'getilgt', label: 'getilgt' }]} titel="Status" /></td>
                <td style={TDr}><ZahlFeld wert={s.rest} onFertig={v => setze(s, 'rest', s.rest, v ?? 0, 'Rest')} breite={100} titel="Rest" /></td>
                <td style={TDr}><ZahlFeld wert={s.rate} onFertig={v => setze(s, 'rate', s.rate, v ?? 0, 'Rate')} breite={84} titel="Rate" /></td>
                <td style={TDr}><ZahlFeld wert={s.zins} onFertig={v => setze(s, 'zins', s.zins, v ?? 0, 'Zins')} breite={64} titel="Zins in Prozent" /></td>
                <td style={TD}><MonatWahl wert={s.start} onWahl={m => setze(s, 'start', s.start, m, 'erste Rate')} monate={d.monate} /></td>
                <td style={TD}><span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><input type="range" min={0} max={500} step={10} value={sonder[s.id] ?? 0} aria-label="Sondertilgung je Monat" onChange={e => setSonder({ ...sonder, [s.id]: Number(e.target.value) })} style={{ width: 90, accentColor: C.aktiv }} /><Geld v={sonder[s.id] ?? 0} farbe={C.inkDim} /></span></td>
                <td style={TD}>{t.frei === null ? <span style={{ color: C.inkLeise }}>—</span> : t.frei === 0 ? 'jetzt' : monatLabel(d, t.frei)}{(sonder[s.id] ?? 0) > 0 && t0.frei !== t.frei && t0.frei && t.frei ? <span style={{ color: LEUCHT.gut, fontSize: TYP.bedien }}> {t0.frei - t.frei} M früher</span> : null}</td>
                <td style={TDr}><Geld v={t.zinsen} farbe={C.inkLeise} /></td>
                <td style={TD}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/schulden/id=${s.id}`, alt: s.name }], `Schuld entfernt: ${s.name}`)} titel="Schuld entfernen">−</KnopfKlein></td>
              </tr>
            ))}
          </tbody>
        </Tabelle>
        <Hinweis>Ungeklärte Schulden stehen hier, damit sie nicht vergessen werden. Rate eintragen, dann rechnet die Seite das Datum. Die Sondertilgung ist eine Probe (nicht gespeichert). Privat-Raten gehören zusätzlich als Zeile ins Privat-Blatt.</Hinweis>
      </Karte>
      <DarlehenKarte />
    </>
  );
}

// ── Darlehen zwischen den Einheiten (05.10.) ─────────────────────────────────
/**
 * Kevin 05.10.: „Es gibt kein Gesellschafterdarlehen, außer ungefähr 1.500 € privat in der KD Ventures.“ Jedes Darlehen hat Geber und Nehmer;
 * die Auszahlung geht beim Geber hinaus und beim Nehmer hinein, die Rückzahlung umgekehrt — nur Kasse, kein Ergebnis, keine Steuer.
 * Business-Sicht: nur Darlehen mit einer Gesellschaft; eine private Seite heißt „außerhalb des Plans“ und ist dort nicht änderbar (Server: 403).
 */
function DarlehenKarte() {
  const { d, aw, aendere, sicht } = usePlan();
  const business = sicht === 'business';
  // Business-Sicht: die private Seite (auch die Selbstständigkeit beim Altdarlehen) heißt „außerhalb des Plans“.
  const liste = business ? darlehenListe(d).map(l => darlehenFuerBusiness(l)).filter((l): l is NonNullable<typeof l> => !!l) : darlehenListe(d);
  const orte = (business ? DARLEHEN_ORTE.filter(o => DARLEHEN_BUSINESS.includes(o) || o === 'extern') : DARLEHEN_ORTE).map(o => ({ id: o, label: darlehenOrtName(o) }));
  const setze = (l: Darlehen, feld: keyof Darlehen, alt: unknown, neu: unknown, label: string) => void aendere([{ pfad: `/darlehen/id=${l.id}/${feld}`, alt, neu }], `Darlehen ${l.name} · ${label}`);
  const offenJetzt = liste.reduce((s, l) => s + darlehenOffen(l, aw.m0), 0);
  const neu = () => void aendere([{ pfad: '/darlehen/-', neu: neuesDarlehen(neueKennung('dl'), business ? { geber: 'extern', nehmer: 'kdv' } : {}) }], 'Darlehen angelegt');
  return (
    <Karte i={2}>
      <Ueberschrift rechts={<KnopfKlein onClick={neu}>+ Darlehen</KnopfKlein>}>Darlehen zwischen {business ? 'den Gesellschaften' : 'Privat, Selbstständigkeit und den Gesellschaften'} · offen jetzt <Geld v={offenJetzt} /> €</Ueberschrift>
      <Tabelle klein>
        <thead><tr><th style={TH}>Name</th><th style={TH}>Geber</th><th style={TH}>Nehmer</th><th style={THr}>Betrag</th><th style={TH}>ausgezahlt</th><th style={TH}>zurück</th><th style={THr}>offen jetzt</th><th style={TH}></th></tr></thead>
        <tbody>
          {liste.map(l => {
            const alt = l.id === DARLEHEN_ALT;
            const fest = alt || (business && !darlehenBusinessAenderbar(l));
            const ort = (o: DarlehenOrt, feld: 'geber' | 'nehmer') => (fest ? darlehenOrtName(o) : <Auswahl wert={o} onWahl={v => setze(l, feld, o, v, feld === 'geber' ? 'Geber' : 'Nehmer')} optionen={orte.filter(x => x.id !== (feld === 'geber' ? l.nehmer : l.geber))} titel={feld === 'geber' ? 'Geber' : 'Nehmer'} />);
            return (
              <tr key={l.id}>
                <td style={TD}>{fest ? l.name : <TextFeld wert={l.name} onFertig={v => setze(l, 'name', l.name, v, 'Name')} breite={160} titel="Name" />}{alt && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 3, maxWidth: 260 }}>aus den Annahmen (Gesellschafterdarlehen) — dort auf 0 setzen, wenn es keins gibt</div>}</td>
                <td style={TD}>{ort(l.geber, 'geber')}</td>
                <td style={TD}>{ort(l.nehmer, 'nehmer')}</td>
                <td style={TDr}>{fest ? <Geld v={l.betrag} /> : <ZahlFeld wert={l.betrag} onFertig={v => setze(l, 'betrag', l.betrag, v ?? 0, 'Betrag')} breite={100} titel="Betrag" />}</td>
                <td style={TD}>{fest ? (l.aus ? monatLabel(d, l.aus) : 'vor Planbeginn') : <MonatWahl wert={l.aus} leer="vor Planbeginn" onWahl={m => setze(l, 'aus', l.aus, m, 'ausgezahlt')} monate={d.monate} />}</td>
                <td style={TD}>{fest ? (l.zurueck ? monatLabel(d, l.zurueck) : 'offen') : <MonatWahl wert={l.zurueck} leer="offen" onWahl={m => setze(l, 'zurueck', l.zurueck, m, 'zurück')} monate={d.monate} />}</td>
                <td style={TDr}><Geld v={darlehenOffen(l, aw.m0)} /></td>
                <td style={TD}>{fest ? null : <KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/darlehen/id=${l.id}`, alt: l.name }], `Darlehen entfernt: ${l.name}`)} titel="Darlehen entfernen">−</KnopfKlein>}</td>
              </tr>
            );
          })}
          {!liste.length && <tr><td colSpan={8} style={TDleise}>Keine Darlehen.</td></tr>}
        </tbody>
      </Tabelle>
      <Hinweis>Auszahlung „vor Planbeginn“ = das Geld ist schon geflossen und steckt in den Kontoständen; im Plan zählt dann nur die Rückzahlung (beim Nehmer hinaus, beim Geber zurück). Darlehen sind nur Kasse — kein Ergebnis, keine Steuer, kein Zins.{business ? ' Darlehen mit privater Seite ändern Sie in der Privat-Sicht.' : ''}</Hinweis>
    </Karte>
  );
}

// ── Zu erledigen ────────────────────────────────────────────────────────────
const ARTEN: { id: Posten['art']; label: string }[] = [{ id: 'rechnung', label: 'Zu zahlen' }, { id: 'forderung', label: 'Forderungen' }, { id: 'beleg', label: 'Fehlende Belege' }, { id: 'konto', label: 'Kontostände' }, { id: 'aufgabe', label: 'Buchhaltung' }];
const statusFuer = (art: Posten['art']) => (art === 'konto' ? ['eintragen', 'prüfen', 'aktuell'] : art === 'forderung' ? ['offen', 'unklar', 'erledigt'] : ['offen', 'unklar', 'bezahlt', 'erledigt']).map(s => ({ id: s, label: s }));

export function ZuErledigen() {
  const { d, aendere, person, sicht } = usePlan();
  const business = sicht === 'business';
  const heute = d.einstellungen.heute, in7 = plusTage(heute, 7);
  const [filter, setFilter] = useState<'offen' | 'alle'>('offen');
  const [wer, setWer] = useState('alle');
  const summe = (art: Posten['art']) => d.posten.filter(p => p.art === art && p.betrag != null && postenOffen(p)).reduce((s, p) => s + (p.betrag ?? 0), 0);
  const setze = (p: Posten, feld: keyof Posten, alt: unknown, neu: unknown, label: string) => void aendere([{ pfad: `/posten/id=${p.id}/${feld}`, alt, neu }], `${p.name} · ${label}`);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Pillen liste={[{ id: 'offen' as const, label: 'Offen' }, { id: 'alle' as const, label: 'Alle' }]} aktiv={filter} onWahl={setFilter} />
        <Auswahl wert={wer} onWahl={setWer} optionen={[{ id: 'alle', label: 'Kevin & Malin' }, ...WER]} titel="Wer" />
      </div>
      <Kacheln min={150}>
        {ARTEN.map(a => <Kachel key={a.id} label={a.label} wert={a.id === 'konto' ? String(d.posten.filter(p => p.art === 'konto' && p.betrag == null).length) : <><Geld v={summe(a.id)} /> €</>} unter={a.id === 'konto' ? 'fehlen noch' : `${d.posten.filter(p => p.art === a.id && postenOffen(p)).length} offen`} />)}
      </Kacheln>
      {ARTEN.map((a, ai) => {
        const l = d.posten.filter(p => p.art === a.id && (filter === 'alle' || postenOffen(p)) && (wer === 'alle' || personKennung(p.wer || 'beide') === wer)).sort((x, y) => (x.faellig || '9') < (y.faellig || '9') ? -1 : 1);
        return (
          <Karte key={a.id} i={ai}>
            <Ueberschrift rechts={<KnopfKlein onClick={() => void aendere([{ pfad: '/posten/-', neu: { id: neueKennung('x'), art: a.id, einheit: business ? 'ug' : 'privat', name: 'Neu', betrag: null, status: a.id === 'konto' ? 'eintragen' : 'offen', wer: person || 'beide', faellig: '' } }], `${a.label}: Posten angelegt`)}>+</KnopfKlein>}>{a.label}</Ueberschrift>
            <Tabelle klein>
              <thead><tr><th style={TH}></th><th style={TH}>Name</th><th style={TH}>Einheit</th><th style={TH}>wer</th><th style={TH}>fällig</th><th style={TH}>Status</th><th style={THr}>Betrag</th><th style={TH}>Notiz</th><th style={TH}></th></tr></thead>
              <tbody>
                {l.map(p => {
                  const offen = postenOffen(p); const ueber = !!p.faellig && offen && p.faellig < heute; const bald = !!p.faellig && offen && !ueber && p.faellig <= in7;
                  return (
                    <tr key={p.id}>
                      <td style={TD}>{a.id !== 'konto' && <Haken an={!offen} onChange={() => setze(p, 'status', p.status, offen ? (p.art === 'rechnung' ? 'bezahlt' : 'erledigt') : 'offen', offen ? 'erledigt' : 'wieder offen')} />}</td>
                      <td style={TD}><TextFeld wert={p.name} onFertig={v => setze(p, 'name', p.name, v, 'Name')} breite={170} titel="Name" /></td>
                      <td style={TD}><Auswahl wert={p.einheit} onWahl={v => setze(p, 'einheit', p.einheit, v, 'Einheit')} optionen={einheitenFuer(business)} titel="Einheit" /></td>
                      <td style={TD}><Auswahl wert={personKennung(p.wer || 'beide')} onWahl={v => setze(p, 'wer', p.wer, v, 'wer')} optionen={WER} titel="Wer" /></td>
                      <td style={TD}><input type="date" value={p.faellig ?? ''} aria-label="fällig" onChange={e => setze(p, 'faellig', p.faellig, e.target.value, 'fällig')} style={{ ...eingabeStil, width: 140, borderColor: ueber ? LEUCHT.kritisch : bald ? LEUCHT.achtung : undefined, color: ueber ? LEUCHT.kritisch : C.ink }} /></td>
                      <td style={TD}><Auswahl wert={p.status} onWahl={v => setze(p, 'status', p.status, v, 'Status')} optionen={statusFuer(a.id)} titel="Status" /></td>
                      <td style={TDr}><ZahlFeld wert={p.betrag} leer onFertig={v => setze(p, 'betrag', p.betrag, v, 'Betrag')} platzhalter="eintragen" breite={110} titel="Betrag" /></td>
                      <td style={TD}><TextFeld wert={p.notiz ?? ''} onFertig={v => setze(p, 'notiz', p.notiz, v, 'Notiz')} breite={180} titel="Notiz" /></td>
                      <td style={TD}><KnopfKlein farbe={C.inkDim} onClick={() => void aendere([{ pfad: `/posten/id=${p.id}`, alt: p.name }], `Posten entfernt: ${p.name}`)} titel="Posten entfernen">−</KnopfKlein></td>
                    </tr>
                  );
                })}
                {!l.length && <tr><td colSpan={9} style={TDleise}>Nichts offen.</td></tr>}
              </tbody>
            </Tabelle>
          </Karte>
        );
      })}
    </>
  );
}

// ── Kalender & Verträge ─────────────────────────────────────────────────────
export function Kalender() {
  const { d, ug, kdc, pr, h, sz, sicht } = usePlan();
  const [zeile, setZeile] = useState<string | null>(null);
  const L = letzterVoller(d);
  // Business-Sicht: keine privaten Termine (Gehälter netto, Ausschüttung netto, private Raten).
  const alleTermine = zahlungskalender(d, ug, pr, 62, kdc);
  const termine = sicht === 'business' ? nurBusinessTermine(alleTermine) : alleTermine;
  const wochen = new Map<string, typeof termine>();
  for (const t of termine) { const dt = new Date(`${t.datum}T00:00:00Z`); const mo = new Date(dt); mo.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); const k = mo.toISOString().slice(0, 10); wochen.set(k, [...(wochen.get(k) ?? []), t]); }
  const vertraege = [...d.privatBudget.filter(z => z.typ === 'fix' || z.typ === 'jahr'), ...d.privatSchulden, ...d.sachkosten];
  return (
    <>
      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Karte i={0}>
            <Ueberschrift>Zahlungen der nächsten 8 Wochen — {sz.name}</Ueberschrift>
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              {Array.from(wochen.entries()).map(([k, xs]) => {
                const s = xs.reduce((a, b) => a + b.betrag, 0);
                return (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.inkLeise, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, padding: '8px 0 4px', borderBottom: '1px solid rgba(255,255,255,.06)' }}><span>Woche ab {tagKurz(k)}</span><Geld v={s} farbe={s < 0 ? undefined : LEUCHT.gut} /></div>
                    {xs.map((x, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '5px 0', fontSize: TYP.bedien }}>
                        <span style={{ color: C.inkLeise, width: 44, fontVariantNumeric: 'tabular-nums' }}>{tagKurz(x.datum)}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.text}</span>
                        <Etikett einheit={x.einheit} />
                        <Geld v={x.betrag} farbe={x.betrag > 0 ? LEUCHT.gut : undefined} stil={{ width: 86, textAlign: 'right' }} />
                      </div>
                    ))}
                  </div>
                );
              })}
              {!termine.length && <Nichts>In den nächsten acht Wochen steht nichts an — oder es fehlen Tage an den Zeilen.</Nichts>}
            </div>
          </Karte>
        </Spalte>
        <Spalte>
          <Karte i={1}>
            <Ueberschrift>Verträge &amp; feste Posten</Ueberschrift>
            <div style={{ maxHeight: 640, overflowY: 'auto' }}>
              <Tabelle klein>
                <thead><tr><th style={TH}>Name</th><th style={TH}></th><th style={THr}>Monat</th><th style={THr}>Jahr</th><th style={THr}>Ø IST</th><th style={TH}>Tag</th><th style={TH}>Kündigung</th></tr></thead>
                <tbody>
                  {vertraege.map(z => {
                    const ist = h.zeilen[z.id] ? istSchnitt(h.zeilen[z.id], 3, L) : null; const mo = sollBudget(z, 1, d.plan) || z.soll;
                    const faellig = z.typ === 'jahr' && z.faellig?.length ? `fällig ${z.faellig.map(f => KAL[f - 1]).join(', ')}` : '';
                    return (
                      <tr key={z.id}>
                        <td style={TD}><button type="button" onClick={() => setZeile(z.id)} style={{ background: 'none', border: 'none', padding: 0, color: C.ink, font: 'inherit', cursor: 'pointer', borderBottom: `1px dotted ${C.inkLeise}`, textAlign: 'left' }}>{z.name}</button>{faellig && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{faellig}</div>}</td>
                        <td style={TD}><Etikett einheit={z.einheit} /></td>
                        <td style={TDr}><Geld v={mo} /></td>
                        <td style={TDr}><Geld v={mo * 12} farbe={C.inkLeise} /></td>
                        <td style={TDr}>{ist != null ? <Geld v={ist} farbe={ist > mo * 1.1 ? LEUCHT.achtung : C.inkLeise} /> : ''}</td>
                        <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{z.tag ?? '—'}</td>
                        <td style={TDleise}>{z.kuendigung ?? ''}</td>
                      </tr>
                    );
                  })}
                  {!vertraege.length && <tr><td colSpan={7} style={TDleise}>Noch keine festen Posten.</td></tr>}
                </tbody>
              </Tabelle>
            </div>
            <Hinweis>Gelb: IST der letzten drei Monate liegt über dem Plan — Sparpotenzial oder Plan anpassen. Klick auf einen Namen: Tag, Kündigung, Betrag ändern.</Hinweis>
          </Karte>
        </Spalte>
      </Spalten>
      {zeile && <ZeileDialog id={zeile} onZu={() => setZeile(null)} />}
    </>
  );
}
