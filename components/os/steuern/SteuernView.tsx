'use client';

// ─── Zahlen → Steuern (25.09.) ──────────────────────────────────────────────
// Kevin: „eine Steuer-Seite im Finanzbereich“. Vier Teile, jeder mit Weg
// dorthin, wo man handelt:
//   Fristen            je Firma und privat, Countdown, Aufgabe davor, abhaken
//   Rücklage & Prognose was zurückgelegt sein sollte und was da ist
//   Umsatzsteuer & Belege je Voranmeldungszeitraum, fehlende Angaben, Belege
//   Übergabe            Monats- und Jahres-Checkliste für den Steuerberater
// Hinweis, keine Steuerberatung.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Haken, Knopf, Segmente, Fortschritt, feld, Spalten, Spalte, LEUCHT } from '../schlank';
import { useZuZiel } from '../ziel';
import { EINHEIT_LABEL, type Einheit, type Frist, type SteuerEinstellungen, type UstZeitraum, type Prognose, type BelegPunkt, type UebergabePunkt, type Jahresgewinn } from '@/lib/steuern/rechnen';

interface Antwort {
  ok: boolean; fehler?: string; hinweis: string; heute: string;
  einstellungen: SteuerEinstellungen; fristen: Frist[]; ust: UstZeitraum[]; prognose: Prognose;
  gewinn: { kdc: Jahresgewinn | null; kdv: Jahresgewinn | null };
  belege: BelegPunkt[];
  uebergabe: { monat: string; punkte: UebergabePunkt[]; jahr: number; jahresPunkte: UebergabePunkt[] };
  aufgaben: { neu: number; erledigt: number };
}

const EINHEIT_FARBE: Record<Einheit, string> = { kdc: LEUCHT.business, kdv: LEUCHT.schlaf, privat: LEUCHT.geld };
const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
const deutsch = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}`;
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const monatName = (m: string) => `${MONATE[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

async function senden(body: Record<string, unknown>): Promise<{ ok: boolean; fehler?: string }> {
  return fetch('/api/steuern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
}

function Countdown({ f }: { f: Frist }) {
  const farbe = f.erledigt ? LEUCHT.gut : f.tage < 0 ? LEUCHT.kritisch : f.tage <= 7 ? LEUCHT.achtung : f.tage <= 30 ? LEUCHT.puls : C.inkLeise;
  const text = f.erledigt ? 'erledigt' : f.tage < 0 ? `${-f.tage} T. drüber` : f.tage === 0 ? 'heute' : f.tage === 1 ? 'morgen' : `in ${f.tage} T.`;
  return <span style={{ minWidth: 78, textAlign: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: farbe, background: `${farbe}1c`, border: `1px solid ${farbe}44`, borderRadius: 999, padding: '4px 8px', flex: '0 0 auto' }}>{text}</span>;
}

function Abschnitt({ id, i, akzent, titel, rechts, children }: { id: string; i: number; akzent?: string; titel: ReactNode; rechts?: ReactNode; children: ReactNode }) {
  return <Karte i={i} id={id} akzent={akzent} style={{ scrollMarginTop: 90 }}><Ueberschrift farbe={akzent} rechts={rechts}>{titel}</Ueberschrift>{children}</Karte>;
}

export function SteuernView() {
  const [d, setD] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<'alle' | Einheit>('alle');
  const [alleFristen, setAlleFristen] = useState(false);
  const [alleBelege, setAlleBelege] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await fetch('/api/steuern', { cache: 'no-store' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (r.ok) { setD(r); setFehler(null); } else setFehler(r.fehler ?? 'Nicht geladen.');
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useZuZiel(null, !!d);
  const tun = async (body: Record<string, unknown>) => {
    const r = await senden(body);
    setMeldung(r.ok ? null : r.fehler ?? 'Nicht gespeichert.');
    if (r.ok) await laden();
  };

  const fristen = useMemo(() => (d?.fristen ?? []).filter(f => filter === 'alle' || f.einheit === filter), [d, filter]);
  if (fehler) return <Karte i={0}><Leer>{fehler}</Leer></Karte>;
  if (!d) return <Karte i={0}><Leer>Lade Fristen, Umsatzsteuer und Rücklage …</Leer></Karte>;

  const offenVorbei = fristen.filter(f => f.tage < 0 && !f.erledigt);
  const kommend = fristen.filter(f => f.tage >= 0);
  const naechste = kommend.find(f => !f.erledigt);
  const sichtbar = [...offenVorbei, ...(alleFristen ? kommend : kommend.filter(f => f.tage <= 90))];
  const summeSoll = (['kdc', 'kdv', 'privat'] as Einheit[]).reduce((s, x) => s + d.prognose.je[x].soll, 0);
  const summeIst = (['kdc', 'kdv', 'privat'] as Einheit[]).reduce((s, x) => s + (d.prognose.je[x].ist ?? 0), 0);

  return (
    <>
      <div className="os-auf" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: C.inkLeise }}>
        <Chip farbe={LEUCHT.achtung}>Hinweis, keine Steuerberatung</Chip>
        <span>Termine gerechnet (§ 108 AO: Wochenende/Feiertag → nächster Werktag), Beträge geschätzt aus euren Zahlen. Verbindlich sind Bescheid und Steuerberater.</span>
        {d.aufgaben.neu > 0 && <Chip farbe={LEUCHT.puls}>{d.aufgaben.neu} neue Aufgabe{d.aufgaben.neu === 1 ? '' : 'n'} vor Fristen</Chip>}
      </div>
      {meldung && <div style={{ color: LEUCHT.kritisch, fontSize: TYP.bedien }}>{meldung}</div>}

      {/* Kopf: die nächste Frist und die Rücklage in einem Blick */}
      <Karte i={0} akzent={naechste && naechste.tage <= 7 ? LEUCHT.achtung : LEUCHT.geld}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 18 }}>
          <Link href="#fristen" style={{ textDecoration: 'none', color: C.ink, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Nächste Frist</span>
            <span style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: naechste && naechste.tage <= 7 ? LEUCHT.achtung : C.ink }}>{naechste ? (naechste.tage === 0 ? 'heute' : `in ${naechste.tage} Tagen`) : '—'}</span>
            <span style={{ fontSize: 12.5, color: C.inkDim }}>{naechste ? `${deutsch(naechste.datum)} · ${EINHEIT_LABEL[naechste.einheit]} · ${naechste.titel}` : 'keine offene Frist'}</span>
          </Link>
          <Link href="#ruecklage" style={{ textDecoration: 'none', color: C.ink, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Rücklage</span>
            <span style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', color: summeSoll > summeIst ? LEUCHT.achtung : LEUCHT.gut }}>{euro(summeIst)} <span style={{ fontSize: 15, color: C.inkLeise }}>von {euro(summeSoll)}</span></span>
            <span style={{ fontSize: 12.5, color: C.inkDim }}>{summeSoll > summeIst ? `${euro(summeSoll - summeIst)} fehlen` : 'gedeckt'} · Schätzung {d.prognose.jahr}</span>
          </Link>
          <Link href="#uebergabe" style={{ textDecoration: 'none', color: C.ink, display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Übergabe {monatName(d.uebergabe.monat)}</span>
            <span style={{ fontFamily: SCHRIFT.display, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}>{d.uebergabe.punkte.filter(p => p.status === 'ok').length} / {d.uebergabe.punkte.length}</span>
            <span style={{ fontSize: 12.5, color: C.inkDim }}>{d.belege.length} offene Punkte bei Belegen und Rechnungen</span>
          </Link>
        </div>
      </Karte>

      <Abschnitt id="fristen" i={1} akzent={LEUCHT.achtung} titel="Steuerkalender & Fristen" rechts={<span>{kommend.filter(f => !f.erledigt && f.tage <= 30).length} in den nächsten 30 Tagen</span>}>
        {/* Filter in eigener Zeile, am Handy seitlich scrollbar — sonst ragt er über die Karte. */}
        <div style={{ overflowX: 'auto', maxWidth: '100%', marginBottom: 6 }}>
          <Segmente liste={[{ id: 'alle' as const, label: 'Alle' }, { id: 'kdc' as const, label: 'Consulting' }, { id: 'kdv' as const, label: 'KD Ventures' }, { id: 'privat' as const, label: 'Privat' }]} aktiv={filter} onWahl={setFilter} />
        </div>
        <Liste>
          {sichtbar.map(f => (
            <Zeile key={f.id}
              links={<><Haken an={f.erledigt} onChange={() => void tun({ abhaken: { key: `f:${f.id}`, an: !f.erledigt } })} farbe={EINHEIT_FARBE[f.einheit]} /><Countdown f={f} /></>}
              titel={<span style={{ opacity: f.erledigt ? 0.55 : 1 }}><span style={{ color: EINHEIT_FARBE[f.einheit], fontWeight: 700 }}>{EINHEIT_LABEL[f.einheit]}</span> · {f.titel}</span>}
              unter={`${deutsch(f.datum)} · ${f.hinweis}${!f.erledigt && f.tage >= 0 ? ` · Aufgabe ab ${deutsch(f.aufgabeAb)}` : ''}`}
              rechts={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!f.erledigt && f.aufgabeAb <= d.heute && f.tage >= -30 && <Link href={`/os/aufgaben?offen=${encodeURIComponent(`steuer-${f.id}`)}`} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 12 }}>Aufgabe ›</Link>}
                {f.betrag != null && <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{euro(f.betrag)}</span>}
                <Link href={f.href} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 15 }} aria-label="dazu">›</Link>
              </span>} />
          ))}
          {!sichtbar.length && <Leer>Keine Frist in den nächsten 90 Tagen.</Leer>}
        </Liste>
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 12.5, color: C.inkLeise }}>
          <button onClick={() => setAlleFristen(!alleFristen)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', padding: 0, fontSize: 12.5 }}>{alleFristen ? 'nur 90 Tage' : `alle ${kommend.length} der nächsten 12 Monate`}</button>
          <span>Vor jeder Frist steht {d.einstellungen.vorlaufTage} Tage vorher eine Aufgabe in <Link href="/os/aufgaben" style={{ color: C.inkDim }}>Aufgaben</Link>; abhaken hier schließt sie.</span>
        </div>
      </Abschnitt>

      <Spalten verhaeltnis="1:1">
        <Spalte>
          <Abschnitt id="ruecklage" i={2} akzent={LEUCHT.geld} titel="Rücklage & Prognose" rechts={<span>Schätzung {d.prognose.jahr}</span>}>
            <div style={{ display: 'grid', gap: 14 }}>
              {(['kdc', 'kdv', 'privat'] as Einheit[]).map(x => {
                const j = d.prognose.je[x];
                const zeilen = d.prognose.zeilen.filter(z => z.einheit === x);
                return (
                  <div key={x} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(80px, 1.2fr) auto', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: EINHEIT_FARBE[x], fontSize: TYP.bedien }}>{EINHEIT_LABEL[x]}</span>
                      <Fortschritt anteil={j.deckung == null ? 0 : Math.min(1, j.deckung)} farbe={j.deckung == null ? C.inkLeise : j.deckung >= 1 ? LEUCHT.gut : j.deckung >= 0.7 ? LEUCHT.achtung : LEUCHT.kritisch} />
                      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{j.ist != null ? euro(j.ist) : '—'} / {euro(j.soll)}</span>
                    </div>
                    {zeilen.map(z => (
                      <Link key={z.id} href={z.href} className="fassbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, padding: '6px 8px', borderRadius: 9, background: 'rgba(255,255,255,.025)', textDecoration: 'none', color: C.ink }}>
                        <span style={{ minWidth: 0, display: 'grid' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{z.titel}</span>
                          <span style={{ fontSize: 11.5, color: z.luecke ? LEUCHT.achtung : C.inkLeise }}>{z.luecke ?? z.formel}</span>
                        </span>
                        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: z.betrag == null ? C.inkLeise : C.ink }}>{z.betrag == null ? 'fehlt' : euro(z.betrag)}</span>
                      </Link>
                    ))}
                  </div>
                );
              })}
            </div>
            <RuecklageEingabe e={d.einstellungen} onSpeichern={x => tun({ einstellungen: { ruecklageIst: x } })} />
          </Abschnitt>
        </Spalte>
        <Spalte>
          <Abschnitt id="ust" i={3} akzent={LEUCHT.business} titel="Umsatzsteuer & Belege">
            <div style={{ display: 'grid', gap: 14 }}>
              {d.ust.map(u => (
                <div key={`${u.firma}-${u.label}`} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: TYP.bedien }}><span style={{ color: EINHEIT_FARBE[u.firma] }}>{EINHEIT_LABEL[u.firma]}</span> · {u.label}</span>
                    <span style={{ fontSize: 12, color: C.inkLeise }}>{u.faellig ? `anmelden bis ${deutsch(u.faellig)}` : 'Zeitraum läuft'}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                    {[{ l: 'USt', w: u.ust }, { l: 'Vorsteuer', w: u.vorsteuer }, { l: 'Zahllast', w: u.zahllast }].map(x => (
                      <div key={x.l} style={{ display: 'grid', gap: 2, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,.03)' }}>
                        <span style={{ fontSize: 11.5, color: C.inkLeise }}>{x.l}</span>
                        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: x.w == null ? C.inkLeise : C.ink }}>{x.w == null ? '—' : euro(x.w)}</span>
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11.5, color: C.inkLeise }}>{u.rechnungen.length} Rechnung{u.rechnungen.length === 1 ? '' : 'en'} ({d.einstellungen[u.firma].istVersteuerung ? 'Ist-Versteuerung: nach Zahlungseingang' : 'Soll-Versteuerung: nach Rechnungsdatum'}) · Vorsteuer: {u.vorsteuerQuelle}</span>
                  {u.rechnungen.slice(0, 4).map(r => (
                    <Link key={r.id} href={`/os/finanzen/planung?r=${r.id}`} className="fassbar" style={{ display: 'flex', gap: 10, justifyContent: 'space-between', padding: '5px 8px', borderRadius: 9, textDecoration: 'none', color: C.ink, fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.kunde}{r.nummer ? ` · ${r.nummer}` : ''}{r.angenommen && <span style={{ color: LEUCHT.achtung }}> · 19 % angenommen</span>}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: C.inkDim, whiteSpace: 'nowrap' }}>{euro(r.ust)} USt ›</span>
                    </Link>
                  ))}
                </div>
              ))}
              {!d.ust.length && <Leer>Keine Umsatzsteuer-Voranmeldung eingestellt (Kleinunternehmer?) — unten in den Einstellungen änderbar.</Leer>}
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Belege und Rechnungsangaben · {d.belege.length}</span>
                {d.belege.slice(0, alleBelege ? 200 : 8).map(b => (
                  <div key={b.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8px', borderRadius: 9, background: 'rgba(255,255,255,.025)' }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto', background: b.faellig && b.faellig < d.heute ? LEUCHT.kritisch : b.art === 'pflichtangabe' ? LEUCHT.achtung : LEUCHT.puls }} />
                    <span style={{ minWidth: 0, flex: 1, display: 'grid' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.titel}</span>
                      <span style={{ fontSize: 11.5, color: C.inkLeise }}>{b.unter}</span>
                    </span>
                    {b.wert && <span style={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: C.inkDim }}>{b.wert}</span>}
                    {b.belegId ? <Knopf leise onClick={() => void tun({ belegErledigt: { id: b.belegId, stand: b.stand } })}>{b.art === 'beleg' ? 'nachgereicht' : 'bezahlt'}</Knopf>
                      : <Link href={b.href} style={{ color: LEUCHT.puls, textDecoration: 'none', fontSize: 12.5, fontWeight: 600 }}>ergänzen ›</Link>}
                  </div>
                ))}
                {d.belege.length > 8 && <button onClick={() => setAlleBelege(!alleBelege)} style={{ background: 'none', border: 'none', color: C.inkDim, cursor: 'pointer', padding: '4px 0', fontSize: 12.5, textAlign: 'left' }}>{alleBelege ? 'weniger' : `alle ${d.belege.length} zeigen`}</button>}
                {!d.belege.length && <Leer>Alle Rechnungen mit Pflichtangaben, kein Beleg offen.</Leer>}
              </div>
            </div>
          </Abschnitt>
        </Spalte>
      </Spalten>

      <Abschnitt id="uebergabe" i={4} akzent={LEUCHT.schlaf} titel="Übergabe an den Steuerberater">
        {/* Eigenes Raster mit minmax(0, …): lange Zeilen kürzen sich, statt in die Nachbarspalte zu laufen. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '12px 28px' }}>
          <div style={{ minWidth: 0 }}><Checkliste titel={`Monat · ${monatName(d.uebergabe.monat)}`} punkte={d.uebergabe.punkte} tun={tun} /></div>
          <div style={{ minWidth: 0 }}><Checkliste titel={`Jahr · ${d.uebergabe.jahr}`} punkte={d.uebergabe.jahresPunkte} tun={tun} /></div>
        </div>
      </Abschnitt>

      <EinstellungenKarte e={d.einstellungen} gewinn={d.gewinn} tun={tun} />
    </>
  );
}

function Checkliste({ titel, punkte, tun }: { titel: string; punkte: UebergabePunkt[]; tun: (b: Record<string, unknown>) => Promise<void> }) {
  return (
    // minmax(0, 1fr): sonst misst das Raster die Zeilen an ihrem ungekürzten Text und schiebt sie in die Nachbarspalte.
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>{titel} · {punkte.filter(p => p.status === 'ok').length}/{punkte.length}</span>
      <Liste>
        {punkte.map(p => (
          <Zeile key={p.key}
            links={<Haken an={p.status === 'ok'} farbe={p.status === 'offen' ? LEUCHT.achtung : undefined} onChange={() => void tun({ abhaken: { key: p.key, an: !p.abgehakt } })} />}
            titel={<span style={{ opacity: p.status === 'ok' ? 0.6 : 1 }}>{p.titel}</span>}
            unter={`${p.unter}${p.abgehakt ? ` · abgehakt ${p.abgehakt.am.slice(8, 10)}.${p.abgehakt.am.slice(5, 7)}. von ${p.abgehakt.von}` : p.status === 'ok' ? ' · erkannt' : ''}`}
            rechts={p.href ? <Link href={p.href} style={{ color: C.inkLeise, textDecoration: 'none', fontSize: 15 }} aria-label="dazu">›</Link> : undefined} />
        ))}
      </Liste>
    </div>
  );
}

function RuecklageEingabe({ e, onSpeichern }: { e: SteuerEinstellungen; onSpeichern: (x: Record<string, string>) => Promise<void> }) {
  const [w, setW] = useState<Record<Einheit, string>>({ kdc: '', kdv: '', privat: '' });
  useEffect(() => { setW({ kdc: e.ruecklageIst.kdc != null ? String(e.ruecklageIst.kdc) : '', kdv: e.ruecklageIst.kdv != null ? String(e.ruecklageIst.kdv) : '', privat: e.ruecklageIst.privat != null ? String(e.ruecklageIst.privat) : '' }); }, [e.ruecklageIst.kdc, e.ruecklageIst.kdv, e.ruecklageIst.privat]);
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
      <span style={{ fontSize: 12, color: C.inkDim }}>Was auf den Steuerrücklage-Konten liegt (Euro):</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {(['kdc', 'kdv', 'privat'] as Einheit[]).map(x => (
          <label key={x} style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 11.5, color: EINHEIT_FARBE[x], fontWeight: 600 }}>{EINHEIT_LABEL[x]}</span>
            <input inputMode="decimal" value={w[x]} onChange={ev => setW({ ...w, [x]: ev.target.value })} placeholder="€" style={{ ...feld, width: 120, fontSize: TYP.bedien, padding: '7px 10px', fontVariantNumeric: 'tabular-nums' }} /></label>
        ))}
        <Knopf leise onClick={() => void onSpeichern(w)}>Speichern</Knopf>
      </div>
    </div>
  );
}

function EinstellungenKarte({ e, gewinn, tun }: { e: SteuerEinstellungen; gewinn: Antwort['gewinn']; tun: (b: Record<string, unknown>) => Promise<void> }) {
  const [offen, setOffen] = useState(false);
  const [vz, setVz] = useState({ est: '', kst: '', gewstKdc: '', gewstKdv: '' });
  const [quote, setQuote] = useState(''); const [hebe, setHebe] = useState(''); const [vorlauf, setVorlauf] = useState('');
  useEffect(() => {
    const t = (n?: number | null) => (n != null ? String(n).replace('.', ',') : '');
    setVz({ est: t(e.vorauszahlung.est), kst: t(e.vorauszahlung.kst), gewstKdc: t(e.vorauszahlung.gewstKdc), gewstKdv: t(e.vorauszahlung.gewstKdv) });
    setQuote(t(e.steuerquote)); setHebe(String(e.hebesatz)); setVorlauf(String(e.vorlaufTage));
  }, [e]);
  const eingabe = { ...feld, width: 110, fontSize: TYP.bedien, padding: '7px 10px' };
  const wahl = { ...feld, width: 'auto', fontSize: TYP.bedien, padding: '7px 10px' };
  const firma = (f: 'kdc' | 'kdv') => {
    const x = e[f];
    const setze = (p: Record<string, unknown>) => void tun({ einstellungen: { [f]: p } });
    return (
      <div key={f} style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontWeight: 700, color: EINHEIT_FARBE[f] }}>{EINHEIT_LABEL[f]}</span>
        <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>Rechtsform</span>
          <select value={x.rechtsform} onChange={ev => setze({ rechtsform: ev.target.value })} style={wahl}>
            <option value="freiberuf">Freiberufler</option><option value="einzel">Einzelunternehmen (Gewerbe)</option><option value="ug">UG (haftungsbeschränkt)</option><option value="gmbh">GmbH</option>
          </select></label>
        <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>Umsatzsteuer-Voranmeldung</span>
          <select value={x.ust} onChange={ev => setze({ ust: ev.target.value })} style={wahl}>
            <option value="monatlich">monatlich</option><option value="quartal">vierteljährlich</option><option value="keine">keine</option>
          </select></label>
        {([['dauerfrist', 'Dauerfristverlängerung'], ['istVersteuerung', 'Ist-Versteuerung'], ['gewerbe', 'gewerbesteuerpflichtig']] as const).map(([k, l]) => (
          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}>
            <Haken an={x[k]} onChange={() => setze({ [k]: !x[k] })} />{l}
          </label>
        ))}
        <span style={{ fontSize: 11.5, color: C.inkLeise }}>{gewinn[f] ? `Gewinn ${new Date().getFullYear()}: ${euro(gewinn[f]!.gewinn)} in ${gewinn[f]!.monate} Monaten → hochgerechnet ${euro(gewinn[f]!.hochgerechnet)}` : 'noch keine Ist-Monate in diesem Jahr'}</span>
      </div>
    );
  };
  return (
    <Karte i={5} id="einstellungen">
      <Ueberschrift rechts={<Knopf leise onClick={() => setOffen(!offen)}>{offen ? 'schließen' : 'öffnen'}</Knopf>}>Steuer-Einstellungen</Ueberschrift>
      {!offen ? (
        <div style={{ fontSize: 12.5, color: C.inkLeise }}>{EINHEIT_LABEL.kdc}: {e.kdc.rechtsform === 'freiberuf' ? 'Freiberufler' : e.kdc.rechtsform}, USt {e.kdc.ust} · {EINHEIT_LABEL.kdv}: {e.kdv.rechtsform.toUpperCase()}, USt {e.kdv.ust} · {e.mitBerater ? 'mit Steuerberater' : 'ohne Steuerberater'} · Steuerquote {e.steuerquote != null ? `${e.steuerquote} %` : 'fehlt'} · Hebesatz {e.hebesatz} %</div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 18 }}>
            {firma('kdc')}{firma('kdv')}
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ fontWeight: 700, color: EINHEIT_FARBE.privat }}>Privat & allgemein</span>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}><Haken an={e.mitBerater} onChange={() => void tun({ einstellungen: { mitBerater: !e.mitBerater } })} />mit Steuerberater (längere Fristen)</label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: C.inkDim }}><Haken an={e.privat.estVorauszahlung} onChange={() => void tun({ einstellungen: { privat: { estVorauszahlung: !e.privat.estVorauszahlung } } })} />ESt-Vorauszahlungen</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {([['est', 'ESt je Quartal'], ['kst', 'KSt je Quartal'], ['gewstKdc', 'GewSt Consulting'], ['gewstKdv', 'GewSt KD Ventures']] as const).map(([k, l]) => (
              <label key={k} style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>{l} (€)</span><input inputMode="decimal" value={vz[k]} onChange={ev => setVz({ ...vz, [k]: ev.target.value })} placeholder="laut Bescheid" style={eingabe} /></label>
            ))}
            <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>Steuerquote (%)</span><input inputMode="decimal" value={quote} onChange={ev => setQuote(ev.target.value)} placeholder="z. B. 30" style={eingabe} /></label>
            <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>Hebesatz (%)</span><input inputMode="numeric" value={hebe} onChange={ev => setHebe(ev.target.value)} style={eingabe} /></label>
            <label style={{ display: 'grid', gap: 3 }}><span style={{ fontSize: 12, color: C.inkDim }}>Aufgabe Tage vorher</span><input inputMode="numeric" value={vorlauf} onChange={ev => setVorlauf(ev.target.value)} style={eingabe} /></label>
            <Knopf onClick={() => void tun({ einstellungen: { vorauszahlung: vz, steuerquote: quote, hebesatz: hebe, vorlaufTage: vorlauf } })}>Speichern</Knopf>
          </div>
          <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>Steuerquote: euer durchschnittlicher Einkommensteuersatz auf den Gewinn aus Consulting — eine Annahme, die ihr mit dem Steuerberater abstimmt. KD Ventures rechnet mit 15,825 % (KSt + Soli) und 3,5 % × Hebesatz Gewerbesteuer.</div>
        </div>
      )}
    </Karte>
  );
}
