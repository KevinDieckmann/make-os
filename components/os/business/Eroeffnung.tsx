'use client';

// ─── 0-Punkt (Eröffnung) je Business-Gesellschaft — Karte unter Zahlen › Business (05.10.) ───────────────────────────────────────
// Kevin 05.10.: „Bring in Business einen 0-Punkt rein. Ich lade alles hoch an Zahlen.“ Je Gesellschaft: Stichtag (Vorgabe heute),
// Anfangsbestand des Kontos, offene Forderungen und Verbindlichkeiten als Zeilen. Speichern fragt nach („Ab <Stichtag> rechnet <Gesellschaft>
// neu …“), danach steht, was jetzt ausgeblendet ist. Alles davor bleibt sichtbar unter „Vor dem 0-Punkt (archiviert)“. Rückgängig nimmt die
// jüngste Eröffnung zurück (die vorige gilt wieder). Regeln: lib/business/eroeffnung.ts · Route /api/business/eroeffnung (Rechte serverseitig).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { localDay } from '@/lib/zeit';
import { Karte, Ueberschrift, Knopf, Pillen, Hinweis, ZeileAktionen, Zeile, Liste, feld, LEUCHT, useRueckfrage } from '../ui';
import type { Eroeffnung, Geltende, OffenerPosten, ArchivZahl } from '@/lib/business/eroeffnung';
import type { ArchivAnsicht } from '@/lib/business/eroeffnung-server';
import type { Gesellschaftskennung } from '@/lib/einheiten';

interface Antwort { ok: true; eintraege: Eroeffnung[]; geltend: Geltende; firmen: { id: Gesellschaftskennung; label: string }[]; archiv: ArchivAnsicht; darf: boolean }

/** Die Eröffnungen laden (Haushalt des Inhabers; ohne Zugang `null`). `stand` zählt jede Änderung — Ansichten rechnen damit neu. */
export function useEroeffnung(nurGeltend = false): { daten: Antwort | null; laden: () => Promise<void> } {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/business/eroeffnung${nurGeltend ? '?nur=geltend' : ''}`, { cache: 'no-store' });
      const d = await r.json();
      setDaten(r.ok && d?.ok ? d as Antwort : null);
    } catch { setDaten(null); }
  }, [nurGeltend]);
  useEffect(() => {
    void laden();
    // Andere Karten auf derselben Seite (Zahlen, Liquidität) rechnen nach dem Speichern neu.
    const neu = () => void laden();
    window.addEventListener(EROEFFNUNG_GEAENDERT, neu);
    return () => window.removeEventListener(EROEFFNUNG_GEAENDERT, neu);
  }, [laden]);
  return { daten, laden };
}
/** Nur die geltenden Eröffnungen (für Ansichten, die Konten/Posten summieren und `abEroeffnung` anwenden). Ohne Zugang: keine. */
export function useGeltendeEroeffnung(): Geltende {
  const { daten } = useEroeffnung(true);
  return useMemo(() => daten?.geltend ?? {}, [daten]);
}
const EROEFFNUNG_GEAENDERT = 'make-eroeffnung-geaendert';

const tagLang = (t?: string) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : '—');
const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
const alsText = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','));
const zahl = (t: string): number | null => {
  const s = t.trim().replace(/\s|€/g, '');
  if (!s) return null;
  const n = Number(/,/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
};

interface ZeileEingabe { name: string; betrag: string; faellig: string }
const zuEingabe = (l?: OffenerPosten[]): ZeileEingabe[] => (l ?? []).map(p => ({ name: p.name, betrag: alsText(p.betrag), faellig: p.faellig ?? '' }));
const LEER: ZeileEingabe = { name: '', betrag: '', faellig: '' };

function archivSatz(z: ArchivZahl | undefined): string {
  if (!z || !z.gesamt) return 'Vor dem Stichtag lag nichts — es ist nichts ausgeblendet.';
  const teile = [
    z.rechnungen && `${z.rechnungen} Rechnung${z.rechnungen === 1 ? '' : 'en'}`, z.zahlungen && `${z.zahlungen} Zahlung${z.zahlungen === 1 ? '' : 'en'}`,
    z.planposten && `${z.planposten} Planposten`, z.abschluesse && `${z.abschluesse} Monatsabschl${z.abschluesse === 1 ? 'uss' : 'üsse'}`,
    z.buchungen && `${z.buchungen} Buchung${z.buchungen === 1 ? '' : 'en'}`,
  ].filter(Boolean).join(', ');
  return `Jetzt ausgeblendet (archiviert, nicht gelöscht): ${teile}.`;
}

/** Offene Posten als Zeilen: hinzufügen, bearbeiten (direkt in der Zeile), löschen (Wischen/Überfahren). */
function PostenZeilen({ titel, zeilen, setZeilen, darf, platzhalter }: { titel: string; zeilen: ZeileEingabe[]; setZeilen: (z: ZeileEingabe[]) => void; darf: boolean; platzhalter: string }) {
  const setze = (i: number, teil: Partial<ZeileEingabe>) => setZeilen(zeilen.map((z, j) => (j === i ? { ...z, ...teil } : z)));
  const summe = zeilen.reduce((s, z) => s + (zahl(z.betrag) ?? 0), 0);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>{titel}{zeilen.length ? ` · ${euro(summe)}` : ''}</span>
        {darf && <Knopf leise onClick={() => setZeilen([...zeilen, { ...LEER }])}>+ Zeile</Knopf>}
      </div>
      {!zeilen.length && <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Keine.</span>}
      {zeilen.map((z, i) => (
        <ZeileAktionen key={i} titel={z.name || `${titel} ${i + 1}`} darf={darf} onLoeschen={() => setZeilen(zeilen.filter((_, j) => j !== i))}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(90px, 1fr) minmax(120px, 1fr)', gap: 6, padding: '2px 0' }}>
            <input value={z.name} disabled={!darf} onChange={e => setze(i, { name: e.target.value })} placeholder={platzhalter} aria-label={`${titel}: Name`} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px' }} />
            <input value={z.betrag} disabled={!darf} inputMode="decimal" onChange={e => setze(i, { betrag: e.target.value })} placeholder="€" aria-label={`${titel}: Betrag`} style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }} />
            <input type="date" value={z.faellig} disabled={!darf} onChange={e => setze(i, { faellig: e.target.value })} aria-label={`${titel}: fällig am`} title="fällig am (optional)" style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', colorScheme: 'dark' }} />
          </div>
        </ZeileAktionen>
      ))}
    </div>
  );
}

export function EroeffnungKarte({ i = 4, onGeaendert }: { i?: number; onGeaendert?: () => void }) {
  const { daten, laden } = useEroeffnung();
  const { bestaetigen, dialog } = useRueckfrage();
  const firmen = daten?.firmen ?? [];
  const [firma, setFirma] = useState<Gesellschaftskennung | null>(null);
  const aktiv = firma ?? firmen[0]?.id ?? null;
  const geltend = aktiv ? daten?.geltend[aktiv] : undefined;
  const label = firmen.find(f => f.id === aktiv)?.label ?? '';
  const darf = !!daten?.darf;

  const [stichtag, setStichtag] = useState(localDay());
  const [kontostand, setKontostand] = useState('');
  const [ford, setFord] = useState<ZeileEingabe[]>([]);
  const [verb, setVerb] = useState<ZeileEingabe[]>([]);
  const [notiz, setNotiz] = useState('');
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [zeigeArchiv, setZeigeArchiv] = useState(false);
  const [zeigeHistorie, setZeigeHistorie] = useState(false);

  // Beim Wechsel der Gesellschaft bzw. nach dem Laden: die geltende Eröffnung ins Formular (ohne: Stichtag heute, leer).
  useEffect(() => {
    setStichtag(geltend?.stichtag ?? localDay());
    setKontostand(geltend ? alsText(geltend.kontostand) : '');
    setFord(zuEingabe(geltend?.forderungen)); setVerb(zuEingabe(geltend?.verbindlichkeiten));
    setNotiz(geltend?.notiz ?? '');
  }, [aktiv, geltend?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!daten || !aktiv) return null;
  const archiv = daten.archiv.posten[aktiv];
  const historie = daten.eintraege.filter(e => e.firma === aktiv);

  const senden = async (body: Record<string, unknown>) => {
    setLaeuft(true); setMeldung(null);
    const r = await fetch('/api/business/eroeffnung', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    return r as { ok: boolean; fehler?: string; archiv?: Partial<Record<Gesellschaftskennung, ArchivZahl>> };
  };
  const fertig = async () => { await laden(); window.dispatchEvent(new CustomEvent(EROEFFNUNG_GEAENDERT)); onGeaendert?.(); };

  const speichern = async () => {
    const k = zahl(kontostand);
    if (k == null) { setMeldung({ ok: false, text: 'Kontostand am Stichtag eintragen (auch 0 oder negativ).' }); return; }
    const zeilen = (l: ZeileEingabe[]) => l.filter(z => z.name.trim() || z.betrag.trim()).map(z => ({ name: z.name.trim(), betrag: zahl(z.betrag), ...(z.faellig ? { faellig: z.faellig } : {}) }));
    if (!(await bestaetigen({ titel: `0-Punkt für ${label} setzen?`, text: `Ab ${tagLang(stichtag)} rechnet ${label} neu. Ältere Zahlen bleiben archiviert.\nKontostand am Stichtag: ${euro(k)}. Nichts wird gelöscht — „Rückgängig“ stellt den vorigen Stand wieder her.`, ja: 'Setzen' }))) return;
    const r = await senden({ aktion: 'setzen', firma: aktiv, stichtag, kontostand: k, forderungen: zeilen(ford), verbindlichkeiten: zeilen(verb), notiz, basis: geltend?.id ?? null });
    if (r.ok) { setMeldung({ ok: true, text: `Gespeichert — ${label} rechnet ab ${tagLang(stichtag)} neu. ${archivSatz(r.archiv?.[aktiv])}` }); await fertig(); }
    else { setMeldung({ ok: false, text: r.fehler ?? 'Nicht gespeichert.' }); await laden(); }
  };
  const zuruecknehmen = async () => {
    if (!geltend) return;
    const vorige = historie.find(e => e.id !== geltend.id && !e.zurueckgenommenAm);
    if (!(await bestaetigen({ titel: `0-Punkt von ${label} zurücknehmen?`, text: vorige ? `Dann gilt wieder die Eröffnung zum ${tagLang(vorige.stichtag)}.` : `Dann rechnet ${label} wieder wie vor dem 0-Punkt — alle Zahlen zählen wieder. Der Eintrag bleibt in der Historie.`, ja: 'Zurücknehmen', gefahr: true }))) return;
    const r = await senden({ aktion: 'zuruecknehmen', firma: aktiv, basis: geltend.id });
    setMeldung(r.ok ? { ok: true, text: vorige ? `Zurückgenommen — es gilt wieder der 0-Punkt zum ${tagLang(vorige.stichtag)}.` : 'Zurückgenommen — keine Eröffnung mehr, alles zählt wie vorher.' } : { ok: false, text: r.fehler ?? 'Nicht zurückgenommen.' });
    await fertig();
  };

  const zahlArchiv = daten.archiv.zahlen[aktiv];
  return (
    <Karte i={i}>
      <div id="eroeffnung" style={{ scrollMarginTop: 90 }} />
      <Ueberschrift farbe={LEUCHT.geld} rechts={geltend ? <span>gilt seit {tagLang(geltend.stichtag)}</span> : <span>noch nicht gesetzt</span>}>0-Punkt (Eröffnung)</Ueberschrift>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
        Stichtag und Anfangsbestand je Gesellschaft. Ab dem Stichtag rechnen Kontostand, Liquidität, Business-Index und Finanzplanung neu; Rechnungen,
        Zahlungen, Planposten und Monatsabschlüsse davor bleiben gespeichert und sichtbar, zählen aber nicht mehr. Offene Rechnungen von vor dem Stichtag
        hier als offene Forderung eintragen.
      </div>
      <div style={{ marginBottom: 12 }}><Pillen liste={firmen} aktiv={aktiv} onWahl={f => { setFirma(f); setMeldung(null); }} farbe={LEUCHT.geld} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Stichtag</span>
          <input type="date" value={stichtag} disabled={!darf} onChange={e => setStichtag(e.target.value)} style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', colorScheme: 'dark' }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>ab hier rechnet {label} neu</span>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontWeight: 600 }}>Kontostand am Stichtag</span>
          <input inputMode="decimal" value={kontostand} disabled={!darf} onChange={e => setKontostand(e.target.value)} placeholder="€, z. B. 12.500,00" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', fontVariantNumeric: 'tabular-nums' }} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Anfangsbestand des Geschäftskontos — ein später eingetragener Kontostand löst ihn ab</span>
        </label>
      </div>
      <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
        <PostenZeilen titel="Offene Forderungen" zeilen={ford} setZeilen={setFord} darf={darf} platzhalter="Kunde, Rechnung" />
        <PostenZeilen titel="Offene Verbindlichkeiten" zeilen={verb} setZeilen={setVerb} darf={darf} platzhalter="Gläubiger, Rechnung" />
      </div>
      {darf ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 14 }}>
          <input value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="Notiz (optional), z. B. „Saldenliste vom Steuerberater“" style={{ ...feld, fontSize: TYP.bedien, padding: '8px 11px', flex: '1 1 260px', width: 'auto' }} />
          <Knopf aus={laeuft} farbe={LEUCHT.geld} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : geltend ? 'Ändern' : '0-Punkt setzen'}</Knopf>
          {geltend && <Knopf leise aus={laeuft} onClick={() => void zuruecknehmen()}>Rückgängig</Knopf>}
        </div>
      ) : <div style={{ marginTop: 12 }}><Hinweis>Nur Personen mit Finanzrecht im Haushalt setzen den 0-Punkt.</Hinweis></div>}
      {meldung && <div role="status" style={{ marginTop: 8, fontSize: TYP.bedien, color: meldung.ok ? LEUCHT.gut : LEUCHT.kritisch, lineHeight: 1.5 }}>{meldung.text}</div>}
      {geltend && !meldung && <div style={{ marginTop: 8, fontSize: TYP.bedien, color: C.inkLeise }}>{archivSatz(zahlArchiv)}</div>}

      {geltend && archiv && (zahlArchiv?.gesamt ?? 0) > 0 && (
        <div style={{ marginTop: 14 }}>
          <Knopf leise onClick={() => setZeigeArchiv(!zeigeArchiv)}>{zeigeArchiv ? '▾' : '▸'} Vor dem 0-Punkt (archiviert) · {zahlArchiv?.gesamt}</Knopf>
          {zeigeArchiv && (
            <div style={{ opacity: 0.75, marginTop: 6 }}>
              <Liste>
                {archiv.rechnungen.map(r => <Zeile key={`r${r.id}`} titel={`${r.kunde} · ${r.titel}`} unter={`Rechnung · ${r.status} · ${tagLang(r.datum ?? r.faellig)}`} rechts={euro(r.betrag)} />)}
                {archiv.zahlungen.map(z => <Zeile key={`z${z.id}`} titel={`${z.an} · ${z.titel}`} unter={`Zahlung · ${z.status} · fällig ${tagLang(z.faellig)}`} rechts={euro(z.betrag)} />)}
                {archiv.planposten.map(p => <Zeile key={`p${p.id}`} titel={p.titel} unter={`Planposten · ${p.rhythmus} · ab ${tagLang(p.ab)}${p.bis ? ` bis ${tagLang(p.bis)}` : ''}`} rechts={euro(p.betrag)} />)}
                {archiv.abschluesse.map(a => <Zeile key={`a${a.monat}`} titel={`Monatsabschluss ${a.monat}`} unter={`Umsatz ${a.umsatz != null ? euro(a.umsatz) : '—'} · Kosten ${a.kosten != null ? euro(a.kosten) : '—'}`} />)}
              </Liste>
              {(zahlArchiv?.buchungen ?? 0) > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 6 }}>Dazu {zahlArchiv!.buchungen} Buchung{zahlArchiv!.buchungen === 1 ? '' : 'en'} — stehen weiter unter Buchungen.</div>}
            </div>
          )}
        </div>
      )}
      {historie.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <Knopf leise onClick={() => setZeigeHistorie(!zeigeHistorie)}>{zeigeHistorie ? '▾' : '▸'} Verlauf · {historie.length}</Knopf>
          {zeigeHistorie && (
            <Liste>
              {historie.map(e => <Zeile key={e.id} titel={`Stichtag ${tagLang(e.stichtag)} · ${euro(e.kontostand)}`}
                unter={`${e.gesetztVon} · ${new Date(e.gesetztAm).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}${e.zurueckgenommenAm ? ` · zurückgenommen ${new Date(e.zurueckgenommenAm).toLocaleDateString('de-DE')}` : e.id === geltend?.id ? ' · gilt' : ' · abgelöst'}`}
                rechts={`${(e.forderungen ?? []).length} F · ${(e.verbindlichkeiten ?? []).length} V`} />)}
            </Liste>
          )}
        </div>
      )}
      {dialog}
    </Karte>
  );
}
