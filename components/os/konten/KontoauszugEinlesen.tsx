'use client';

// ─── Kontoauszug einlesen — je Konto der Konten-Karte (09.10., ONBOARDING_PLAN.md › B9 d) ──────────────────────────────────────────────
// Bis die Bank-Anbindung läuft (Kevin 08.10.: „Bank-Anbindung vorziehen“, R3: bis dahin von Hand): Datei wählen (CAMT.053 oder CSV) → bei CSV die
// Spalten zuordnen (Vorschlag aus den Spaltennamen) → Vorschau (neu · schon da · übersprungen, Saldo, Saldo-Prüfung) → Übernehmen → Rückgängig.
// Die Datei liest der Browser für die Zuordnung selbst (lib/finanzen/kontoauszug, dieselben Leser wie der Server); zum Server geht sie nur für
// Vorschau und Übernahme — gespeichert wird sie nie. Regeln: lib/finanzen/kontoauszug · Route /api/finanzen/konten/auszug.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { zufallsUuid } from '@/lib/kennung';
import { tagVon } from '@/lib/zeit';
import { Knopf, Hinweis, Liste, Zeile, Feldzeile, Wahl, auswahl, LEUCHT, useRueckfrage } from '../ui';
import { auszugLesen, bytesZuBase64 } from '@/lib/finanzen/kontoauszug/lesen';
import { spaltenVollstaendig } from '@/lib/finanzen/kontoauszug/csv';
import { SPALTEN_NAME, type CsvInfo, type Spalten, type SpaltenFeld } from '@/lib/finanzen/kontoauszug/typen';
import type { KontoAnzeige, KontenSicht } from '@/lib/finanzen/konten/register';
import type { VorschauAntwort, AuszugLauf } from '@/lib/finanzen/kontoauszug/server';

const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const tag = (t?: string | null) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '—');
const STATUS_NAME = { neu: 'neu', vorhanden: 'schon da', uebersprungen: 'übersprungen' } as const;
const EINORDNUNG_NAME: Record<string, string> = {
  'ausgabe-variabel': 'Ausgaben', 'ausgabe-fix': 'Fixkosten', 'einnahme-planbar': 'planbare Einnahmen', 'einnahme-einmalig': 'einmalige Einnahmen',
  'einnahme-offen': 'Einnahmen ohne Art', umbuchung: 'Umbuchungen', durchlauf: 'Durchläufe', geliehen: 'Kredite', ohneKategorie: 'ohne Kategorie',
};
/** „5 Ausgaben · 2 Einnahmen ohne Art · 3 ohne Kategorie“ — wie der Haushalt die neuen Buchungen einordnen würde. */
const einordnungSatz = (e: Record<string, number | undefined>) => Object.entries(e).filter(([, n]) => n).map(([k, n]) => `${n} ${EINORDNUNG_NAME[k] ?? k}`).join(' · ');
const STATUS_FARBE = { neu: LEUCHT.gut, vorhanden: C.inkLeise, uebersprungen: LEUCHT.achtung } as const;
/** Felder der Zuordnung, in der Reihenfolge der Maske (Verwendungszweck eigens, mehrere Spalten). */
const FELDER: Exclude<SpaltenFeld, 'zweck'>[] = ['datum', 'betrag', 'soll', 'haben', 'kennzeichen', 'gegenpartei', 'saldo', 'valuta', 'waehrung', 'iban', 'kennung', 'status', 'kategorie', 'gebuehr', 'eigeneIban'];
const ERWEITERT: ReadonlySet<SpaltenFeld> = new Set(['valuta', 'waehrung', 'iban', 'kennung', 'status', 'kategorie', 'gebuehr', 'eigeneIban', 'kennzeichen']);

type Fehler = { ok: false; fehler?: string; csv?: Omit<CsvInfo, 'beispiel'>; anderesKonto?: { id: string; name: string }; vorschau?: VorschauAntwort; pruefung?: unknown };
type Uebernahme = { ok: true; lauf: AuszugLauf | null; angelegt: number; doppelt: number; saldo: 'neu' | 'vorhanden' | 'nicht' | null; nichtsNeu?: true; zugeordnet?: number };
type Zurueck = { ok: true; lauf: AuszugLauf; entfernt: number; konflikte: { datum: string; betrag: number; wer: string }[]; schonWeg: number; standZurueck: number; hinweis?: string };

async function post<T>(sicht: KontenSicht, body: unknown): Promise<T | Fehler> {
  try {
    const r = await fetch(`/api/finanzen/konten/auszug?sicht=${sicht}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { ok: false, fehler: 'Keine Verbindung — nichts übernommen.' }; }
}

export function KontoauszugEinlesen({ konto, bereich, onGeaendert }: { konto: KontoAnzeige; bereich: KontenSicht; onGeaendert: () => Promise<void> | void }) {
  const [auf, setAuf] = useState(false);
  const [datei, setDatei] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [csv, setCsv] = useState<CsvInfo | null>(null);
  const [spalten, setSpalten] = useState<Partial<Spalten>>({});
  const [vorschau, setVorschau] = useState<VorschauAntwort | null>(null);
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung' | 'info'; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [alle, setAlle] = useState(false);
  const [erweitert, setErweitert] = useState(false);
  const [trotz, setTrotz] = useState(false);
  const [anfrageId, setAnfrageId] = useState('');
  const [laeufe, setLaeufe] = useState<AuszugLauf[]>([]);
  const [konflikte, setKonflikte] = useState<Zurueck['konflikte']>([]);
  const { bestaetigen, dialog } = useRueckfrage();

  const laeufeLaden = useCallback(async () => {
    try {
      const r = await fetch(`/api/finanzen/konten/auszug?sicht=${bereich}&konto=${encodeURIComponent(konto.id)}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      setLaeufe(d?.ok ? d.laeufe : []);
    } catch { /* Verlauf ist Zusatz */ }
  }, [bereich, konto.id]);
  useEffect(() => { if (auf) void laeufeLaden(); }, [auf, laeufeLaden]);

  const zuruecksetzen = () => { setDatei(null); setCsv(null); setSpalten({}); setVorschau(null); setTrotz(false); setAlle(false); };

  const vorschauHolen = async (bytes: Uint8Array, s: Partial<Spalten> | null) => {
    setLaeuft(true);
    setMeldung(null);
    const r = await post<VorschauAntwort>(bereich, { aktion: 'vorschau', kontoId: konto.id, datei: { inhalt: bytesZuBase64(bytes) }, ...(s ? { spalten: s } : {}) });
    setLaeuft(false);
    if (r.ok) { setVorschau(r); setAnfrageId(`kaa-${zufallsUuid()}`); setTrotz(false); return; }
    setVorschau(null);
    setMeldung({ art: 'kritisch', text: r.fehler ?? 'Die Vorschau ging nicht.' });
  };

  const dateiGewaehlt = async (f: File | undefined) => {
    zuruecksetzen();
    setMeldung(null);
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setMeldung({ art: 'kritisch', text: 'Die Datei ist größer als 5 MB — bitte einen kürzeren Zeitraum herunterladen.' }); return; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    setDatei({ name: f.name, bytes });
    // Erst im Browser lesen: bei CSV die Spaltenzuordnung zeigen (Vorschlag), bei CAMT direkt zur Vorschau.
    const l = auszugLesen(bytes);
    const info = 'csv' in l && l.csv ? l.csv : null;
    if (info) { setCsv(info); setSpalten(info.spalten ?? info.vorschlag); }
    if (!l.ok) { setMeldung({ art: info ? 'achtung' : 'kritisch', text: l.fehler }); return; }
    await vorschauHolen(bytes, info ? (info.spalten ?? info.vorschlag) : null);
  };

  const uebernehmen = async () => {
    if (!vorschau || !datei) return;
    const n = vorschau.zahlen.neu;
    const saldoText = vorschau.saldo?.status === 'neu' ? ` und den Saldo vom ${tag(vorschau.saldo.datum)} (${euro(vorschau.saldo.betrag)})` : '';
    // 09.10.: Umsätze, die schon als Rechnung bezahlt, Beleg oder von Hand gebucht sind, werden nur zugeordnet (nicht doppelt angelegt).
    const zuText = vorschau.abgleiche ? ` ${vorschau.abgleiche} ${vorschau.abgleiche === 1 ? 'Umsatz ist' : 'Umsätze sind'} schon gebucht und ${vorschau.abgleiche === 1 ? 'wird' : 'werden'} nur zugeordnet.` : '';
    if (!(await bestaetigen({ titel: 'Kontoauszug übernehmen?', text: `${n} ${n === 1 ? 'Buchung' : 'Buchungen'}${saldoText} kommen zu „${konto.name}“.${zuText} Rückgängig geht danach hier, solange nichts daran geändert wurde.`, ja: 'Übernehmen' }))) return;
    setLaeuft(true);
    const r = await post<Uebernahme>(bereich, { aktion: 'uebernehmen', kontoId: konto.id, datei: { inhalt: bytesZuBase64(datei.bytes) }, ...(csv ? { spalten } : {}), basis: vorschau.basis, trotzAbweichung: trotz, anfrageId });
    setLaeuft(false);
    if (!r.ok) {
      if (r.vorschau) { setVorschau(r.vorschau); setAnfrageId(`kaa-${zufallsUuid()}`); }
      setMeldung({ art: 'kritisch', text: r.fehler ?? 'Nicht übernommen.' });
      return;
    }
    const teile = [r.nichtsNeu ? 'Nichts Neues — alles war schon da.' : `${r.angelegt} ${r.angelegt === 1 ? 'Buchung' : 'Buchungen'} übernommen.`];
    if (r.doppelt) teile.push(`${r.doppelt} inzwischen schon vorhanden — nicht doppelt angelegt.`);
    if (r.zugeordnet) teile.push(`${r.zugeordnet} schon gebucht (Rechnung bezahlt, Beleg oder von Hand) — zugeordnet, nicht doppelt.`);
    if (r.saldo === 'neu') teile.push('Saldo als Stand eingetragen.');
    setMeldung({ art: 'gut', text: teile.join(' ') });
    zuruecksetzen();
    await onGeaendert();
    await laeufeLaden();
  };

  const zuruecknehmen = async (l: AuszugLauf) => {
    if (!(await bestaetigen({ titel: 'Kontoauszug zurücknehmen?', text: `Die ${l.buchungen.length} übernommenen Buchungen vom ${tag(tagVon(l.am))} werden entfernt, soweit seitdem niemand sie geändert hat; der Saldo-Stand wird zurückgenommen (bleibt im Verlauf).`, ja: 'Zurücknehmen', gefahr: true }))) return;
    setLaeuft(true);
    const r = await post<Zurueck>(bereich, { aktion: 'zuruecknehmen', laufId: l.id });
    setLaeuft(false);
    if (!r.ok) { setMeldung({ art: 'kritisch', text: r.fehler ?? 'Nicht zurückgenommen.' }); return; }
    setKonflikte(r.konflikte);
    const teile = [`${r.entfernt} ${r.entfernt === 1 ? 'Buchung' : 'Buchungen'} entfernt.`];
    if (r.konflikte.length) teile.push(`${r.konflikte.length} seitdem geändert — bleiben stehen (Liste unten).`);
    if (r.schonWeg) teile.push(`${r.schonWeg} waren schon weg.`);
    if (r.standZurueck) teile.push('Saldo-Stand zurückgenommen.');
    if (r.hinweis) teile.push(r.hinweis);
    setMeldung({ art: r.konflikte.length ? 'achtung' : 'gut', text: teile.join(' ') });
    await onGeaendert();
    await laeufeLaden();
  };

  const optionen = useMemo(() => (csv ? csv.kopf.map((k, i) => {
    const bsp = (csv.beispiel[0]?.[i] ?? '').slice(0, 24);
    return { i, text: `${k || `Spalte ${i + 1}`}${bsp ? ` — „${bsp}“` : ''}` };
  }) : []), [csv]);
  const setze = (f: SpaltenFeld, wert: string) => setSpalten(s => {
    const n = { ...s };
    if (wert === '') delete (n as Record<string, unknown>)[f]; else (n as Record<string, number>)[f] = Number(wert);
    return n;
  });
  const zweck = new Set(spalten.zweck ?? []);
  const zweckUmschalten = (i: number) => setSpalten(s => {
    const z = new Set(s.zweck ?? []);
    if (z.has(i)) z.delete(i); else z.add(i);
    return { ...s, zweck: Array.from(z).sort((a, b) => a - b) };
  });
  const sichtbareZeilen = vorschau ? (alle ? vorschau.zeilen : vorschau.zeilen.slice(0, 30)) : [];

  if (!auf) return <Knopf leise onClick={() => setAuf(true)}>Kontoauszug einlesen</Knopf>;

  return (
    <div style={{ display: 'grid', gap: 12, padding: '12px 0 4px', borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Kontoauszug einlesen</span>
        <Knopf leise onClick={() => { zuruecksetzen(); setMeldung(null); setAuf(false); }}>Schließen</Knopf>
      </div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
        CAMT.053 (XML) oder CSV aus dem Online-Banking, höchstens 5 MB. Erst kommt eine Vorschau — übernommen wird nur, was neu ist; die Datei wird nicht gespeichert.
      </div>
      <label className="ui-knopf fassbar" style={{ justifySelf: 'start', cursor: laeuft ? 'progress' : 'pointer', border: '1px solid rgba(255,255,255,.14)', color: C.ink }}>
        {datei ? `Andere Datei wählen (${datei.name.slice(0, 40)})` : 'Datei wählen'}
        <input type="file" accept=".xml,.csv,.txt,.camt,text/csv,text/xml,application/xml" onChange={e => { void dateiGewaehlt(e.target.files?.[0]); e.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} aria-label="Kontoauszug-Datei wählen" />
      </label>

      {csv && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
            CSV · Kopfzeile {csv.kopfZeile || 'keine'} · Trenner „{csv.trenner === '\t' ? 'Tab' : csv.trenner}“ · {csv.zeichensatz}{csv.bank ? ` · sieht aus wie ${csv.bank}` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
            {FELDER.filter(f => erweitert || !ERWEITERT.has(f) || spalten[f] !== undefined).map(f => (
              <Feldzeile key={f} label={SPALTEN_NAME[f]}>
                <select value={spalten[f] === undefined ? '' : String(spalten[f])} onChange={e => setze(f, e.target.value)} style={{ ...auswahl, width: '100%', fontSize: 16 }}>
                  <option value="">— keine</option>
                  {optionen.map(o => <option key={o.i} value={o.i}>{o.text}</option>)}
                </select>
              </Feldzeile>
            ))}
          </div>
          <div>
            <div style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.inkDim, marginBottom: 6 }}>{SPALTEN_NAME.zweck} (eine oder mehrere Spalten)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {optionen.map(o => <Wahl key={o.i} an={zweck.has(o.i)} onClick={() => zweckUmschalten(o.i)} klein>{csv.kopf[o.i] || `Spalte ${o.i + 1}`}</Wahl>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setErweitert(!erweitert)}>{erweitert ? 'Weniger Felder' : 'Weitere Felder (Valuta, Währung, Status …)'}</Knopf>
            <Knopf farbe={LEUCHT.geld} aus={!datei || !spaltenVollstaendig(spalten) || laeuft} onClick={async () => { if (datei) await vorschauHolen(datei.bytes, spalten); }}>Vorschau mit dieser Zuordnung</Knopf>
          </div>
        </div>
      )}

      {meldung && <Hinweis art={meldung.art} rolle="status">{meldung.text}</Hinweis>}
      {laeuft && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Einen Moment …</div>}

      {vorschau && (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gap: 4, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            <span>Ziel: <b style={{ color: C.ink }}>{vorschau.ziel.satz}</b></span>
            <span>{vorschau.format === 'camt' ? 'CAMT' : 'CSV'}{vorschau.ibanMaskiert ? ` · IBAN ${vorschau.ibanMaskiert}` : ''}{vorschau.zeitraum ? ` · ${tag(vorschau.zeitraum.von)} – ${tag(vorschau.zeitraum.bis)}` : ''}</span>
            <span>
              <b style={{ color: LEUCHT.gut }}>{vorschau.zahlen.neu} neu</b> · {vorschau.zahlen.vorhanden} schon da · {vorschau.zahlen.uebersprungen} übersprungen (von {vorschau.zahlen.gelesen})
            </span>
            {vorschau.einordnung && vorschau.zahlen.neu > 0 && <span>Einordnung: {einordnungSatz(vorschau.einordnung)}</span>}
            {vorschau.saldo && (
              <span>Saldo {tag(vorschau.saldo.datum)}: <b style={{ color: C.ink, fontFamily: SCHRIFT.display }}>{euro(vorschau.saldo.betrag)}</b> — {vorschau.saldo.status === 'neu' ? (vorschau.saldo.geltend ? 'wird der geltende Stand' : 'kommt in den Verlauf') : vorschau.saldo.status === 'vorhanden' ? 'schon eingetragen' : vorschau.saldo.grund ?? 'nicht übernommen'}</span>
            )}
          </div>
          {vorschau.pruefung && (vorschau.pruefung.stimmt
            ? <Hinweis art="gut">Saldo-Prüfung stimmt: Anfangssaldo + Umsätze = Endsaldo.</Hinweis>
            : <Hinweis art="kritisch" titel="Saldo-Prüfung geht nicht auf">
                Anfang {euro(vorschau.pruefung.anfang / 100)} + Umsätze {euro(vorschau.pruefung.summe / 100)} ≠ Ende {euro(vorschau.pruefung.ende / 100)} (Abweichung {euro(vorschau.pruefung.abweichung / 100)}). Fehlt ein Tag oder passt die Spaltenzuordnung nicht?
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, minHeight: 44, cursor: 'pointer' }}>
                  <input type="checkbox" checked={trotz} onChange={e => setTrotz(e.target.checked)} style={{ width: 22, height: 22 }} />
                  Geprüft — trotzdem übernehmen
                </label>
              </Hinweis>)}
          {vorschau.hinweise.map((h, i) => <Hinweis key={i} art="info">{h}</Hinweis>)}
          {vorschau.zeilen.length > 0 && (
            <Liste>
              {sichtbareZeilen.map((z, i) => (
                <Zeile key={`${z.nr}-${i}`} umbrechen titel={`${tag(z.datum)} · ${z.gegenpartei || z.zweck || 'Buchung'}`}
                  unter={`${z.zweck && z.gegenpartei ? `${z.zweck.slice(0, 120)} · ` : ''}${STATUS_NAME[z.status]}${z.grund ? ` (${z.grund})` : ''}${z.umbuchung ? ' · Umbuchung' : ''}`}
                  rechts={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: STATUS_FARBE[z.status] }}>{euro(z.cent / 100)}</span>} />
              ))}
            </Liste>
          )}
          {vorschau.zeilen.length > 30 && <Knopf leise onClick={() => setAlle(!alle)}>{alle ? 'Weniger zeigen' : `Alle ${vorschau.zeilen.length} zeigen`}</Knopf>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf haupt farbe={LEUCHT.geld} aus={laeuft || (vorschau.zahlen.neu === 0 && vorschau.saldo?.status !== 'neu' && !vorschau.abgleiche) || (!!vorschau.pruefung && !vorschau.pruefung.stimmt && !trotz)} onClick={uebernehmen}>
              {vorschau.zahlen.neu || vorschau.saldo?.status === 'neu' || vorschau.abgleiche ? `Übernehmen (${vorschau.zahlen.neu} neu${vorschau.abgleiche ? ` · ${vorschau.abgleiche} zugeordnet` : ''}${vorschau.saldo?.status === 'neu' ? ' + Saldo' : ''})` : 'Nichts Neues'}
            </Knopf>
            <Knopf leise onClick={() => { zuruecksetzen(); setMeldung(null); }}>Verwerfen</Knopf>
          </div>
        </div>
      )}

      {konflikte.length > 0 && (
        <div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600, marginBottom: 4 }}>Seitdem geändert — nicht entfernt</div>
          <Liste>
            {konflikte.map((k, i) => <Zeile key={i} umbrechen titel={`${tag(k.datum)} · ${k.wer}`} rechts={<span style={{ fontVariantNumeric: 'tabular-nums' }}>{euro(k.betrag)}</span>} />)}
          </Liste>
        </div>
      )}

      {laeufe.length > 0 && (
        <div>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600, marginBottom: 4 }}>Eingelesen</div>
          <Liste>
            {laeufe.map(l => (
              <Zeile key={l.id} umbrechen titel={`${tag(tagVon(l.am))} · ${l.format === 'camt' ? 'CAMT' : 'CSV'}${l.zeitraum ? ` · ${tag(l.zeitraum.von)} – ${tag(l.zeitraum.bis)}` : ''}`}
                unter={`${l.zahlen.neu} übernommen · ${l.zahlen.vorhanden} schon da${l.standId ? ' · Saldo' : ''}${l.status === 'zurueckgenommen' ? ' · zurückgenommen' : l.status === 'teilweise' ? ` · teilweise zurückgenommen (${l.buchungen.length} geändert)` : l.status === 'laeuft' ? ' · läuft' : ''}`}
                rechts={l.status === 'uebernommen' || l.status === 'teilweise' ? <Knopf leise aus={laeuft} onClick={() => zuruecknehmen(l)}>Rückgängig</Knopf> : undefined} />
            ))}
          </Liste>
        </div>
      )}
      {dialog}
    </div>
  );
}
