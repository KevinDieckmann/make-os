'use client';

// ─── Konten-Register — Karte „Konten“ (08.10.) ──────────────────────────────────────────────────────────────────────────────────────────
// Kevin 08.10.: „Kontostände an fünf Stellen → EIN Konten-Register … Stand mit Datum.“ Unter Finanzen › Privat › Konten & Buchungen (Sicht privat:
// alles) und unter Business › Liquidität (Sicht business: nur Konten der Business-Gesellschaften — der Server liefert gar nichts anderes).
// Je Konto: „Stand eintragen“ (Betrag + Datum), Verlauf (zurücknehmen statt löschen), Stammdaten; dazu „+ Konto“ und die einmalige Übernahme der
// bisherigen Stände (Vorschau → Bestätigen). Regeln: lib/finanzen/konten/register.ts · Route /api/finanzen/konten.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { Karte, Ueberschrift, Knopf, Hinweis, Liste, Zeile, Leerzustand, Feldzeile, feld, auswahl, LEUCHT, useRueckfrage } from '../ui';
import {
  KONTO_ARTEN, KONTO_ART_NAME, ZUR_KASSE, ortName, orteFuerSicht,
  type KontoAnzeige, type KontoArt, type KontoOrt, type KontenSicht, type Kasse, type GesellschaftsKasse, type UebernahmePlan,
} from '@/lib/finanzen/konten/register';
import { KontoauszugEinlesen } from './KontoauszugEinlesen';

/** Ereignis nach jeder Änderung — Ansichten, die mit dem Register rechnen (Liquidität, Zahlen, Controlling), laden neu. */
export const KONTEN_GEAENDERT = 'make-konten-geaendert';

interface Antwort {
  ok: true; sicht: KontenSicht; konten: KontoAnzeige[]; gesellschaften: GesellschaftsKasse; privat?: Kasse | null; ruecklage?: Kasse | null;
  personen?: { speicher: string; name: string }[];
}
type Vorschau = UebernahmePlan & { basis: string };

/** Nur die Kassen je Gesellschaft (für Ansichten, die Firmen-Konten summieren: `mitRegister` vor `abEroeffnung`). Ohne Zugang/vor dem Laden: leer. */
export function useKontenKasse(sicht: KontenSicht = 'business'): GesellschaftsKasse {
  const [kasse, setKasse] = useState<GesellschaftsKasse>({});
  useEffect(() => {
    let lebt = true;
    const laden = () => fetch(`/api/finanzen/konten?sicht=${sicht}&nur=kasse`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
      .then(d => { if (lebt) setKasse(d?.ok ? d.gesellschaften ?? {} : {}); }).catch(() => {});
    void laden();
    const neu = () => void laden();
    window.addEventListener(KONTEN_GEAENDERT, neu);
    return () => { lebt = false; window.removeEventListener(KONTEN_GEAENDERT, neu); };
  }, [sicht]);
  return kasse;
}

const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const tag = (t?: string | null) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '—');
const QUELLE: Record<string, string> = { konten: 'von Hand', liquiditaet: 'aus Liquidität', eroeffnung: 'aus dem 0-Punkt', finanzplanung: 'aus der Planung', zoe: 'über ZOE', uebernahme: 'übernommen', bank: 'von der Bank', auszug: 'aus dem Kontoauszug' };
const UEBERNAHME_QUELLE: Record<UebernahmePlan['punkte'][number]['quelle'], string> = { liquiditaet: 'Liquidität', eroeffnung: '0-Punkt', finanzplanung: 'Finanzplanung', haushalt: 'Haushalt' };

type Rueckmeldung = { ok: boolean; fehler?: string } & Partial<Omit<Antwort, 'ok'>>;
async function senden(sicht: KontenSicht, body: unknown): Promise<Rueckmeldung> {
  try {
    const r = await fetch(`/api/finanzen/konten?sicht=${sicht}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return { ok: false, fehler: 'Keine Verbindung — nichts gespeichert.' }; }
}

/** Eine Kasse in einem Satz: Summe, Stand, fehlende. */
const kasseSatz = (k: Kasse | null | undefined) => (!k ? null : `${euro(k.betrag)}${k.stand ? ` · Stand ${tag(k.stand)}` : ''}${k.fehlen ? ` · ${k.fehlen} ohne Stand` : ''}`);

export function KontenKarte({ bereich, i = 2, id = 'konten' }: { bereich: KontenSicht; i?: number; id?: string }) {
  const [d, setD] = useState<Antwort | null>(null);
  const [kein, setKein] = useState(false);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [zeigeVorschau, setZeigeVorschau] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);
  const [neuAuf, setNeuAuf] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const { bestaetigen, dialog } = useRueckfrage();

  const laden = useCallback(async () => {
    try {
      const [r, v] = await Promise.all([
        fetch(`/api/finanzen/konten?sicht=${bereich}`, { cache: 'no-store' }),
        fetch(`/api/finanzen/konten?sicht=${bereich}&uebernahme=1`, { cache: 'no-store' }),
      ]);
      if (!r.ok) { setKein(true); return; }
      setD(await r.json());
      const vv = v.ok ? await v.json() : null;
      setVorschau(vv?.ok ? vv : null);
    } catch { setKein(true); }
  }, [bereich]);
  useEffect(() => { void laden(); }, [laden]);

  const nachSchreiben = async (r: Rueckmeldung, gut: string): Promise<boolean> => {
    setMeldung(r.ok ? { ok: true, text: gut } : { ok: false, text: r.fehler ?? 'Nicht gespeichert.' });
    await laden();
    if (r.ok) window.dispatchEvent(new CustomEvent(KONTEN_GEAENDERT));
    return r.ok;
  };
  /** Nach einem eingelesenen (oder zurückgenommenen) Kontoauszug: neu laden, Ansichten mit Register-Kasse auch. */
  const neuLaden = async () => { await laden(); window.dispatchEvent(new CustomEvent(KONTEN_GEAENDERT)); };

  const orte = useMemo(() => orteFuerSicht(bereich), [bereich]);
  const aktive = (d?.konten ?? []).filter(k => !k.archiviertAm);
  const archiviert = (d?.konten ?? []).filter(k => k.archiviertAm);
  const gruppen = orte.map(o => ({ ort: o, konten: aktive.filter(k => k.ort === o) })).filter(g => g.konten.length);

  if (kein) return null;
  if (!d) return <Karte i={i} id={id}><Ueberschrift farbe={LEUCHT.geld}>Konten</Ueberschrift><div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Lade die Konten …</div></Karte>;

  const summe = bereich === 'privat' ? kasseSatz(d.privat) : null;
  const uebernehmen = async () => {
    if (!vorschau) return;
    const n = vorschau.punkte.length;
    if (!(await bestaetigen({ titel: 'Bisherige Stände übernehmen?', text: `${n} ${n === 1 ? 'Eintrag kommt' : 'Einträge kommen'} ins Konten-Register. Ab dann zählt für diese Konten nur noch das Register — die bisherigen Stellen bleiben gespeichert. Nichts wird gelöscht.`, ja: 'Übernehmen' }))) return;
    const r = await senden(bereich, { aktion: 'uebernahme', basis: vorschau.basis });
    if (await nachSchreiben(r, 'Übernommen — das Register führt diese Konten jetzt.')) setZeigeVorschau(false);
  };

  return (
    <Karte i={i} id={id} style={{ scrollMarginTop: 90 }}>
      <Ueberschrift farbe={LEUCHT.geld} rechts={summe ? <span>{bereich === 'privat' ? 'Haushalt' : ''} {summe}</span> : undefined}>Konten</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
        {bereich === 'privat'
          ? 'Eure Konten mit Stand und Datum — die Finanzplanung, der Privat-Index (Tagesgeld = Rücklage) und die Gesellschaften rechnen damit.'
          : 'Die Konten der Gesellschaften mit Stand und Datum — Liquidität, Business-Index, Head of Finance und die Finanzplanung rechnen damit.'}
      </div>

      {vorschau && vorschau.punkte.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Hinweis art="info" titel="Bisherige Stände noch nicht im Register"
            aktion={<Knopf leise onClick={() => setZeigeVorschau(!zeigeVorschau)}>{zeigeVorschau ? 'Vorschau schließen' : `Übernahme ansehen (${vorschau.punkte.length})`}</Knopf>}>
            Für diese Konten gilt noch die bisherige Stelle. Mit dem ersten eigenen Stand führt das Register ein Konto allein — vorher übernehmen, dann geht nichts verloren.
          </Hinweis>
          {zeigeVorschau && (
            <div style={{ marginTop: 8 }}>
              <Liste>
                {vorschau.punkte.map(p => (
                  <Zeile key={p.schluessel} umbrechen titel={`${p.name} · ${ortName(p.ort)}`}
                    unter={`${UEBERNAHME_QUELLE[p.quelle]}${p.datum ? ` · Stand ${tag(p.datum)}${p.datumUnbekannt ? ' (Datum unbekannt, heute angenommen)' : ''}` : ' · Konto ohne Stand'}`}
                    rechts={typeof p.betrag === 'number' ? euro(p.betrag) : undefined} />
                ))}
              </Liste>
              {vorschau.nicht.length > 0 && (
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>
                  Nicht übernommen: {vorschau.nicht.map(x => `${x.name} (${x.quelle}: ${x.grund})`).join(' · ')}
                </div>
              )}
              <div style={{ marginTop: 10 }}><Knopf farbe={LEUCHT.geld} onClick={uebernehmen}>Übernehmen</Knopf></div>
            </div>
          )}
        </div>
      )}

      {!aktive.length && !neuAuf && (
        <Leerzustand symbol="€" titel="Noch kein Konto im Register" ton={LEUCHT.geld}
          aktion={<Knopf haupt voll farbe={LEUCHT.geld} onClick={() => setNeuAuf(true)}>+ Konto anlegen</Knopf>}>
          {bereich === 'privat' ? 'Legt eure Konten an und tragt den Stand mit Datum ein.' : 'Legt die Konten der Gesellschaften an und tragt den Stand mit Datum ein.'}
        </Leerzustand>
      )}

      {gruppen.map(g => {
        const k = g.ort !== 'privat' && g.ort !== 'gemeinsam' ? d.gesellschaften[g.ort] : null;
        return (
          <div key={g.ort} style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600, margin: '6px 0' }}>
              <span>{ortName(g.ort)}</span>{k && <span style={{ fontWeight: 400 }}>{kasseSatz(k)}</span>}
            </div>
            <Liste>
              {g.konten.map(konto => (
                <KontoZeile key={konto.id} konto={konto} offen={offen === konto.id} onOffen={() => setOffen(offen === konto.id ? null : konto.id)}
                  bereich={bereich} personen={d.personen ?? []} bestaetigen={bestaetigen} nachSchreiben={nachSchreiben} neuLaden={neuLaden} />
              ))}
            </Liste>
          </div>
        );
      })}

      {aktive.length > 0 && !neuAuf && <div style={{ marginTop: 12 }}><Knopf leise onClick={() => setNeuAuf(true)}>+ Konto</Knopf></div>}
      {neuAuf && <NeuesKonto bereich={bereich} orte={orte} personen={d.personen ?? []} onFertig={async r => { if (await nachSchreiben(r, 'Konto angelegt.')) setNeuAuf(false); }} onAbbrechen={() => setNeuAuf(false)} />}

      {meldung && <div style={{ marginTop: 10 }}><Hinweis art={meldung.ok ? 'gut' : 'kritisch'} rolle="status">{meldung.text}</Hinweis></div>}
      {archiviert.length > 0 && (
        <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 10 }}>Archiviert: {archiviert.map(k => k.name).join(' · ')}</div>
      )}
      {dialog}
    </Karte>
  );
}

function KontoZeile({ konto, offen, onOffen, bereich, personen, bestaetigen, nachSchreiben, neuLaden }: {
  konto: KontoAnzeige; offen: boolean; onOffen: () => void; bereich: KontenSicht; personen: { speicher: string; name: string }[];
  bestaetigen: ReturnType<typeof useRueckfrage>['bestaetigen'];
  nachSchreiben: (r: { ok: boolean; fehler?: string }, gut: string) => Promise<boolean>;
  neuLaden: () => Promise<void>;
}) {
  const [betrag, setBetrag] = useState('');
  const [datum, setDatum] = useState(localDay());
  const [notiz, setNotiz] = useState('');
  const [bearbeiten, setBearbeiten] = useState(false);
  const g = konto.geltend;
  const wem = konto.person ? personen.find(p => p.speicher === konto.person)?.name ?? '' : '';
  const unter = [KONTO_ART_NAME[konto.art], wem, konto.bank, konto.ibanMaskiert, g ? `Stand ${tag(g.datum)}` : 'noch kein Stand', !ZUR_KASSE[konto.art] ? 'zählt nicht zur Kasse' : '']
    .filter(Boolean).join(' · ');

  const standEintragen = async () => {
    const r = await senden(bereich, { ops: [{ op: 'stand-neu', id: konto.id, stand: konto.fassung, betrag, datum, ...(notiz.trim() ? { notiz } : {}) }] });
    if (await nachSchreiben(r, `Stand für „${konto.name}“ gespeichert.`)) { setBetrag(''); setNotiz(''); }
  };
  const zuruecknehmen = async (standId: string, text: string) => {
    if (!(await bestaetigen({ titel: 'Stand zurücknehmen?', text: `${text} zählt dann nicht mehr. Er bleibt im Verlauf sichtbar — gelöscht wird nichts.`, ja: 'Zurücknehmen', gefahr: true }))) return;
    await nachSchreiben(await senden(bereich, { ops: [{ op: 'stand-zuruecknehmen', id: konto.id, standId, stand: konto.fassung }] }), 'Zurückgenommen.');
  };
  const archivieren = async () => {
    if (!(await bestaetigen({ titel: `„${konto.name}“ archivieren?`, text: 'Das Konto zählt dann nicht mehr zur Kasse. Stände und Verlauf bleiben.', ja: 'Archivieren' }))) return;
    await nachSchreiben(await senden(bereich, { ops: [{ op: 'archivieren', id: konto.id, stand: konto.fassung }] }), 'Archiviert.');
  };

  return (
    <div>
      <Zeile onClick={onOffen} aktiv={offen} titel={konto.name} unter={unter}
        rechts={<span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: g ? (g.betrag < 0 ? LEUCHT.kritisch : C.ink) : C.inkLeise }}>{g ? euro(g.betrag) : '—'}</span>} />
      {offen && (
        <div style={{ padding: '10px 2px 14px', display: 'grid', gap: 12 }}>
          <form onSubmit={e => { e.preventDefault(); void standEintragen(); }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 170px), 1fr))', gap: 10, alignItems: 'end' }}>
            <Feldzeile label="Stand (€)"><input inputMode="decimal" value={betrag} onChange={e => setBetrag(e.target.value)} placeholder="z. B. 12.500,00" aria-label={`Stand ${konto.name}`} style={{ ...feld, fontVariantNumeric: 'tabular-nums' }} /></Feldzeile>
            <Feldzeile label="Datum"><input type="date" value={datum} max={localDay()} onChange={e => setDatum(e.target.value)} aria-label="Datum des Stands" style={{ ...feld, colorScheme: 'dark' }} /></Feldzeile>
            <Feldzeile label="Notiz (optional)"><input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="z. B. laut Auszug" style={feld} /></Feldzeile>
            <Knopf farbe={LEUCHT.geld} typ="submit" aus={!betrag.trim()}>Stand eintragen</Knopf>
          </form>
          {konto.staende.length > 0 && (
            <div>
              <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600, marginBottom: 4 }}>Verlauf</div>
              <Liste>
                {konto.staende.map(s => (
                  <Zeile key={s.id} umbrechen titel={`${tag(s.datum)} · ${euro(s.betrag)}`}
                    unter={`${QUELLE[s.herkunft?.art ?? 'konten'] ?? 'von Hand'} · ${s.erfasstVon}${s.notiz ? ` · ${s.notiz}` : ''}${s.zurueckgenommenAm ? ` · zurückgenommen ${tag(s.zurueckgenommenAm.slice(0, 10))}` : s.id === konto.geltend?.id ? ' · gilt' : ''}`}
                    rechts={!s.zurueckgenommenAm ? <Knopf leise onClick={() => zuruecknehmen(s.id, `Der Stand vom ${tag(s.datum)} (${euro(s.betrag)})`)}>Zurücknehmen</Knopf> : undefined} />
                ))}
              </Liste>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf leise onClick={() => setBearbeiten(!bearbeiten)}>{bearbeiten ? 'Bearbeiten schließen' : 'Name, Art, Bank, IBAN'}</Knopf>
            <Knopf leise onClick={archivieren}>Archivieren</Knopf>
          </div>
          {bearbeiten && <KontoBearbeiten konto={konto} bereich={bereich} personen={personen} onFertig={async r => { if (await nachSchreiben(r, 'Gespeichert.')) setBearbeiten(false); }} />}
          {/* Bank-Übergang bis zur finAPI-Anbindung (09.10., B9 d): CAMT.053/CSV → Saldo als Stand, Umsätze als Buchungen. */}
          <KontoauszugEinlesen konto={konto} bereich={bereich} onGeaendert={neuLaden} />
        </div>
      )}
    </div>
  );
}

/** Stammfelder eines Kontos (neu oder bearbeiten) — eine Eingabemaske. */
function KontoFelder({ werte, setze, orte, personen, neu }: {
  werte: Record<string, string>; setze: (k: string, v: string) => void; orte: KontoOrt[]; personen: { speicher: string; name: string }[]; neu: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
      <Feldzeile label="Name"><input value={werte.name ?? ''} onChange={e => setze('name', e.target.value)} placeholder="z. B. Geschäftskonto" style={feld} /></Feldzeile>
      <Feldzeile label="Art">
        <select value={werte.art ?? 'giro'} onChange={e => setze('art', e.target.value)} style={auswahl}>
          {KONTO_ARTEN.map(a => <option key={a} value={a}>{KONTO_ART_NAME[a as KontoArt]}</option>)}
        </select>
      </Feldzeile>
      <Feldzeile label="Zuordnung">
        <select value={werte.ort ?? orte[0]} onChange={e => setze('ort', e.target.value)} style={auswahl}>
          {orte.map(o => <option key={o} value={o}>{ortName(o)}</option>)}
        </select>
      </Feldzeile>
      {(werte.ort ?? orte[0]) === 'privat' && personen.length > 0 && (
        <Feldzeile label="Wessen Konto (optional)">
          <select value={werte.person ?? ''} onChange={e => setze('person', e.target.value)} style={auswahl}>
            <option value="">— offen</option>
            {personen.map(p => <option key={p.speicher} value={p.speicher}>{p.name}</option>)}
          </select>
        </Feldzeile>
      )}
      <Feldzeile label="Bank (optional)"><input value={werte.bank ?? ''} onChange={e => setze('bank', e.target.value)} style={feld} /></Feldzeile>
      <Feldzeile label={neu ? 'IBAN (optional)' : 'IBAN (neu eintragen ersetzt)'}><input value={werte.iban ?? ''} onChange={e => setze('iban', e.target.value)} placeholder={neu ? 'DE…' : 'leer = bleibt'} autoComplete="off" style={feld} /></Feldzeile>
    </div>
  );
}

function NeuesKonto({ bereich, orte, personen, onFertig, onAbbrechen }: {
  bereich: KontenSicht; orte: KontoOrt[]; personen: { speicher: string; name: string }[];
  onFertig: (r: { ok: boolean; fehler?: string }) => Promise<void>; onAbbrechen: () => void;
}) {
  const [w, setW] = useState<Record<string, string>>({ art: 'giro', ort: orte[0] });
  const [betrag, setBetrag] = useState('');
  const [datum, setDatum] = useState(localDay());
  const setze = (k: string, v: string) => setW(x => ({ ...x, [k]: v }));
  const anlegen = async () => {
    const konto = { name: w.name ?? '', art: w.art, ort: w.ort, ...(w.person ? { person: w.person } : {}), ...(w.bank ? { bank: w.bank } : {}), ...(w.iban ? { iban: w.iban } : {}) };
    await onFertig(await senden(bereich, { ops: [{ op: 'konto-neu', konto, ...(betrag.trim() ? { stand0: { betrag, datum } } : {}) }] }));
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void anlegen(); }} style={{ marginTop: 12, display: 'grid', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Neues Konto</div>
      <KontoFelder werte={w} setze={setze} orte={orte} personen={personen} neu />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        <Feldzeile label="Erster Stand (€, optional)"><input inputMode="decimal" value={betrag} onChange={e => setBetrag(e.target.value)} style={{ ...feld, fontVariantNumeric: 'tabular-nums' }} /></Feldzeile>
        <Feldzeile label="Datum"><input type="date" value={datum} max={localDay()} onChange={e => setDatum(e.target.value)} style={{ ...feld, colorScheme: 'dark' }} /></Feldzeile>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf farbe={LEUCHT.geld} typ="submit" aus={!(w.name ?? '').trim()}>Konto anlegen</Knopf>
        <Knopf leise onClick={onAbbrechen}>Abbrechen</Knopf>
      </div>
    </form>
  );
}

function KontoBearbeiten({ konto, bereich, personen, onFertig }: {
  konto: KontoAnzeige; bereich: KontenSicht; personen: { speicher: string; name: string }[]; onFertig: (r: { ok: boolean; fehler?: string }) => Promise<void>;
}) {
  const [w, setW] = useState<Record<string, string>>({ name: konto.name, art: konto.art, ort: konto.ort, person: konto.person ?? '', bank: konto.bank ?? '', iban: '' });
  const setze = (k: string, v: string) => setW(x => ({ ...x, [k]: v }));
  const speichern = async () => {
    const felder: Record<string, unknown> = { name: w.name, art: w.art, ort: w.ort, bank: w.bank, person: w.ort === 'privat' ? (w.person || null) : null };
    if (w.iban.trim()) felder.iban = w.iban;
    await onFertig(await senden(bereich, { ops: [{ op: 'konto-aendern', id: konto.id, stand: konto.fassung, felder }] }));
  };
  const entfernen = async () => onFertig(await senden(bereich, { ops: [{ op: 'konto-aendern', id: konto.id, stand: konto.fassung, felder: { ibanEntfernen: true } }] }));
  return (
    <form onSubmit={e => { e.preventDefault(); void speichern(); }} style={{ display: 'grid', gap: 10 }}>
      <KontoFelder werte={w} setze={setze} orte={orteFuerSicht(bereich)} personen={personen} neu={false} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Knopf farbe={LEUCHT.geld} typ="submit">Speichern</Knopf>
        {konto.ibanGesetzt && <Knopf leise onClick={entfernen}>IBAN entfernen</Knopf>}
      </div>
    </form>
  );
}
