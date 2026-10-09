'use client';

// ─── Standard · EinfuegeTabelle — aus Excel/BWA-CSV einfügen (09.10., ONBOARDING_PLAN.md › B9 a–c) ──────────────────────────────────
// EIN Baustein für jeden Daten-Assistenten (Monatsabschluss, offene Posten des 0-Punkts, Mandate): Einfügen (Zwischenablage, Tab-getrennt) oder
// CSV-Datei → Spalten bzw. Positionen zuordnen (Vorschlag aus bekannten Namen, jederzeit änderbar) → Vorschau vom Server (neu · geändert ·
// gleich · Fehler je Zeile, einzelne Zeilen abwählbar) → Übernehmen → Rückgängig. Gelesen wird mit lib/tabelle/einfuegen.ts (derselbe Leser wie
// der Kontoauszug); geprüft und gerechnet wird NUR auf dem Server — der Baustein schickt Rohtexte je Feld. Am Handy: alles untereinander,
// Tippziele ≥ 44 px, Eingaben 16 px (kein Zoom), die Vorschau als Liste (keine breite Tabelle).

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, TYP, BEDEUTUNG_FARBE } from '@/lib/make-one/design';
import { Knopf, HakenZiel, Chip } from './knoepfe';
import { Hinweis } from './rueckmeldung';
import { eingabe, auswahl as auswahlStil } from './felder';
import {
  datensaetzeBauen, tabelleLesen, vorschauZahlen, wirkt, zeilenAufbereiten, zuordnungPruefen,
  type Aufbereitet, type CsvZeile, type Datensatz, type FeldDef, type VorschauAntwort, type VorschauStatus, type VorschauZeile,
} from '@/lib/tabelle/einfuegen';

export type { Datensatz, VorschauAntwort } from '@/lib/tabelle/einfuegen';

/** Antwort beim Übernehmen: Text für die Meldung, optional ein Rückweg (Lauf zurücknehmen bzw. Fassung zurücknehmen). 409 bringt die neue Vorschau. */
export interface EinfuegeErgebnis {
  ok: boolean;
  fehler?: string;
  text?: string;
  hinweise?: string[];
  vorschau?: VorschauAntwort;
  rueckgaengig?: () => Promise<{ ok: boolean; text?: string; fehler?: string }>;
}
type Fehlschlag = { ok: false; fehler?: string };

export interface EinfuegeTabelleProps {
  felder: readonly FeldDef[];
  /** Eigene Aufbereitung (BWA: Datensatz = Monat, Quelle = Position). Vorgabe: Datensatz = Zeile, Quelle = Spalte. */
  aufbereiten?: (zeilen: CsvZeile[]) => Aufbereitet;
  /** Wie eine Quelle heißt („Spalte“, „Position“). */
  quelleWort?: string;
  /** Wie ein Datensatz heißt (für Knöpfe und Zahlen). */
  einheit?: { eins: string; viele: string };
  /** Einstellungen über der Zuordnung (Gesellschaft, Art, Modus) — ändert sich `kontext`, ist eine Vorschau veraltet. */
  oben?: ReactNode;
  kontext?: string;
  /** Platzhalter im Einfügefeld (ein kurzes, erfundenes Beispiel). */
  beispiel?: string;
  vorschau: (datensaetze: Datensatz[]) => Promise<VorschauAntwort | Fehlschlag>;
  uebernehmen: (datensaetze: Datensatz[], basis: string, auswahl: string[] | null) => Promise<EinfuegeErgebnis>;
  /** Nach Übernehmen bzw. Rückgängig (Liste neu laden). */
  onGeaendert?: () => void;
  /** Grund, warum gerade nichts geht (z. B. „erst den 0-Punkt setzen“) — dann nur dieser Hinweis. */
  aus?: string;
  farbe?: string;
}

const STATUS: Record<VorschauStatus, { name: string; farbe: string }> = {
  neu: { name: 'neu', farbe: BEDEUTUNG_FARBE.gut },
  geaendert: { name: 'geändert', farbe: BEDEUTUNG_FARBE.info },
  gleich: { name: 'gleich', farbe: BEDEUTUNG_FARBE.neutral },
  entfaellt: { name: 'entfällt', farbe: BEDEUTUNG_FARBE.achtung },
  uebersprungen: { name: 'übersprungen', farbe: BEDEUTUNG_FARBE.neutral },
  fehler: { name: 'Fehler', farbe: BEDEUTUNG_FARBE.kritisch },
};

export function EinfuegeTabelle(p: EinfuegeTabelleProps) {
  const { felder, quelleWort = 'Spalte', einheit = { eins: 'Zeile', viele: 'Zeilen' } } = p;
  const [text, setText] = useState('');
  const [dateiName, setDateiName] = useState<string | null>(null);
  const [aufbereitet, setAufbereitet] = useState<Aufbereitet | null>(null);
  const [zuordnung, setZuordnung] = useState<(string | null)[]>([]);
  const [vorschau, setVorschau] = useState<VorschauAntwort | null>(null);
  const [abgewaehlt, setAbgewaehlt] = useState<Set<string>>(new Set());
  const [meldung, setMeldung] = useState<{ art: 'gut' | 'kritisch' | 'achtung' | 'info'; text: string } | null>(null);
  const [rueck, setRueck] = useState<EinfuegeErgebnis['rueckgaengig'] | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Gesellschaft, Art oder Modus geändert: die Vorschau gilt nicht mehr (der Server rechnet sie neu).
  useEffect(() => { setVorschau(null); }, [p.kontext]);

  const lesen = (eingabeRoh: string | Uint8Array) => {
    setMeldung(null); setVorschau(null); setRueck(null); setAbgewaehlt(new Set());
    const g = tabelleLesen(eingabeRoh);
    if (!g.ok) { setAufbereitet(null); setMeldung({ art: 'kritisch', text: g.fehler }); return; }
    const a = (p.aufbereiten ?? (z => zeilenAufbereiten(z, felder)))(g.zeilen);
    setAufbereitet(a);
    setZuordnung(a.vorschlag);
    if (!a.datensaetze.length) setMeldung({ art: 'achtung', text: a.hinweise[0] ?? `Keine ${einheit.viele} erkannt.` });
  };
  const dateiGewaehlt = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setMeldung({ art: 'kritisch', text: 'Die Datei ist größer als 5 MB — bitte in Teilen. Nichts gelesen.' }); return; }
    setDateiName(f.name); setText('');
    lesen(new Uint8Array(await f.arrayBuffer()));
  };

  const datensaetze = useMemo(() => (aufbereitet ? datensaetzeBauen(aufbereitet, zuordnung) : []), [aufbereitet, zuordnung]);
  const zuordnungFehler = aufbereitet ? zuordnungPruefen(zuordnung, felder, aufbereitet.quellen) : null;
  const zahlen = vorschau ? vorschauZahlen(vorschau.zeilen) : null;
  const gewaehlt = vorschau ? vorschau.zeilen.filter(z => wirkt(z.status) && !abgewaehlt.has(z.schluessel)) : [];

  const vorschauHolen = async () => {
    if (!datensaetze.length) { setMeldung({ art: 'achtung', text: `Keine ${einheit.viele} mit Werten — passt die Zuordnung?` }); return; }
    setLaeuft(true); setMeldung(null); setRueck(null);
    const r = await p.vorschau(datensaetze).catch(() => ({ ok: false as const, fehler: 'Keine Verbindung — nichts geprüft.' }));
    setLaeuft(false);
    if (!r.ok) { setVorschau(null); setMeldung({ art: 'kritisch', text: r.fehler ?? 'Vorschau nicht möglich.' }); return; }
    setVorschau(r); setAbgewaehlt(new Set());
  };
  const uebernehmen = async () => {
    if (!vorschau) return;
    setLaeuft(true); setMeldung(null);
    const auswahl = abgewaehlt.size ? vorschau.zeilen.filter(z => wirkt(z.status) && !abgewaehlt.has(z.schluessel)).map(z => z.schluessel) : null;
    const r = await p.uebernehmen(datensaetze, vorschau.basis, auswahl).catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts übernommen.' } as EinfuegeErgebnis));
    setLaeuft(false);
    if (!r.ok) {
      // 409: inzwischen geändert — die neue Vorschau steht da, die Auswahl beginnt neu.
      if (r.vorschau) { setVorschau(r.vorschau); setAbgewaehlt(new Set()); }
      setMeldung({ art: r.vorschau ? 'achtung' : 'kritisch', text: r.fehler ?? 'Nicht übernommen.' });
      return;
    }
    setMeldung({ art: 'gut', text: [r.text ?? 'Übernommen.', ...(r.hinweise ?? [])].join(' ') });
    setRueck(() => r.rueckgaengig ?? null);
    setVorschau(null); setAufbereitet(null); setText(''); setDateiName(null);
    p.onGeaendert?.();
  };
  const zurueck = async () => {
    if (!rueck) return;
    setLaeuft(true);
    const r: { ok: boolean; text?: string; fehler?: string } = await rueck().catch(() => ({ ok: false, fehler: 'Keine Verbindung — nichts zurückgenommen.' }));
    setLaeuft(false);
    setMeldung({ art: r.ok ? 'gut' : 'kritisch', text: r.ok ? r.text ?? 'Zurückgenommen.' : r.fehler ?? 'Nicht zurückgenommen.' });
    if (r.ok) { setRueck(null); p.onGeaendert?.(); }
  };

  if (p.aus) return <Hinweis art="info">{p.aus}</Hinweis>;

  return (
    <div className="ui-einfuegen" style={{ display: 'grid', gap: 12, minWidth: 0 }}>
      {p.oben}
      <div style={{ display: 'grid', gap: 8 }}>
        <textarea value={text} rows={4} aria-label="Tabelle einfügen"
          placeholder={p.beispiel ?? 'Zellen in Excel markieren, kopieren und hier einfügen (⌘V) — oder unten eine CSV-Datei wählen.'}
          onChange={e => { setText(e.target.value); setDateiName(null); }}
          onPaste={e => { const t = e.clipboardData.getData('text/plain'); if (t) { e.preventDefault(); setText(t); setDateiName(null); lesen(t); } }}
          style={{ ...eingabe, minHeight: 96, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, lineHeight: 1.4 }} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf leise aus={!text.trim() || laeuft} onClick={() => lesen(text)}>Lesen</Knopf>
          <label className="ui-knopf fassbar" style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,.14)', color: C.ink, position: 'relative' }}>
            {dateiName ? `Andere Datei (${dateiName.slice(0, 30)})` : 'CSV-Datei wählen'}
            <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values" aria-label="CSV-Datei wählen"
              onChange={e => { void dateiGewaehlt(e.target.files?.[0]); e.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden' }} />
          </label>
        </div>
      </div>

      {aufbereitet && aufbereitet.quellen.length > 0 && (
        <section aria-label="Zuordnung" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            {aufbereitet.datensaetze.length} {aufbereitet.datensaetze.length === 1 ? einheit.eins : einheit.viele} erkannt. Je {quelleWort} das Feld wählen — mehrere {quelleWort === 'Position' ? 'Positionen' : 'Spalten'} auf ein Zahlenfeld werden addiert. Leere Zellen ändern nichts.
          </div>
          {aufbereitet.hinweise.map((h, i) => <Hinweis key={i} art="info">{h}</Hinweis>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 8 }}>
            {aufbereitet.quellen.map((q, i) => (
              <label key={i} style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600, overflowWrap: 'anywhere' }}>{q.label}
                  {q.beispiel && <span style={{ fontWeight: 400, color: C.inkLeise }}> · z. B. {q.beispiel.slice(0, 32)}</span>}</span>
                <select value={zuordnung[i] ?? ''} onChange={e => setZuordnung(zuordnung.map((z, j) => (j === i ? e.target.value || null : z)))}
                  style={{ ...auswahlStil, width: '100%', fontSize: 16, minHeight: 44 }} aria-label={`${quelleWort} „${q.label}“ zuordnen`}>
                  <option value="">— nicht übernehmen</option>
                  {felder.map(f => <option key={f.id} value={f.id}>{f.label}{f.pflicht ? ' *' : ''}</option>)}
                </select>
              </label>
            ))}
          </div>
          {zuordnungFehler && <Hinweis art="achtung">{zuordnungFehler}</Hinweis>}
          <div><Knopf farbe={p.farbe} aus={!!zuordnungFehler || laeuft || !datensaetze.length} onClick={vorschauHolen}>Vorschau</Knopf></div>
        </section>
      )}

      {meldung && (
        <Hinweis art={meldung.art} rolle={meldung.art === 'kritisch' ? 'alert' : 'status'}
          aktion={rueck && meldung.art === 'gut' ? <Knopf leise aus={laeuft} onClick={zurueck}>Rückgängig</Knopf> : undefined}>{meldung.text}</Hinweis>
      )}
      {laeuft && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Einen Moment …</div>}

      {vorschau && zahlen && (
        <section aria-label="Vorschau" style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(STATUS) as VorschauStatus[]).filter(s => zahlen[s]).map(s => <Chip key={s} farbe={STATUS[s].farbe}>{zahlen[s]} {STATUS[s].name}</Chip>)}
          </div>
          {vorschau.hinweise.map((h, i) => <Hinweis key={i} art="info">{h}</Hinweis>)}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {vorschau.zeilen.map(z => <VorschauZeileAnsicht key={z.schluessel} z={z} an={!abgewaehlt.has(z.schluessel)}
              umschalten={() => setAbgewaehlt(a => { const n = new Set(a); if (n.has(z.schluessel)) n.delete(z.schluessel); else n.add(z.schluessel); return n; })} />)}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Knopf haupt farbe={p.farbe} aus={!gewaehlt.length || laeuft} onClick={uebernehmen}>
              {gewaehlt.length ? `${gewaehlt.length} ${gewaehlt.length === 1 ? einheit.eins : einheit.viele} übernehmen` : 'Nichts zu übernehmen'}
            </Knopf>
            <Knopf leise onClick={() => setVorschau(null)}>Zurück zur Zuordnung</Knopf>
          </div>
          {zahlen.fehler > 0 && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{zahlen.fehler} {zahlen.fehler === 1 ? einheit.eins : einheit.viele} mit Fehler {zahlen.fehler === 1 ? 'bleibt' : 'bleiben'} weg — in der Tabelle korrigieren und neu einfügen.</div>}
        </section>
      )}
    </div>
  );
}

/** Eine Zeile der Vorschau: Haken (nur, was wirkt), Titel, Status, Herkunft, Änderungen alt → neu. */
function VorschauZeileAnsicht({ z, an, umschalten }: { z: VorschauZeile; an: boolean; umschalten: () => void }) {
  const s = STATUS[z.status];
  return (
    <li style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8, alignItems: 'start', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,.06)', opacity: wirkt(z.status) && !an ? 0.5 : 1 }}>
      {wirkt(z.status) ? <HakenZiel an={an} onChange={umschalten} label={`${z.titel} übernehmen`} /> : <span aria-hidden style={{ width: 40 }} />}
      <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontSize: TYP.bedien, color: C.ink, fontWeight: 600, overflowWrap: 'anywhere' }}>{z.titel}</span>
          <Chip farbe={s.farbe}>{s.name}</Chip>
        </div>
        <span style={{ fontSize: TYP.bedien, color: z.status === 'fehler' ? BEDEUTUNG_FARBE.kritisch : C.inkLeise, lineHeight: 1.45 }}>
          {z.quelle !== z.titel ? z.quelle : ''}{z.quelle !== z.titel && z.text ? ' · ' : ''}{z.text ?? ''}
        </span>
        {!!z.aenderungen?.length && (
          <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
            {z.aenderungen.map((a, i) => <span key={i}>{i ? ' · ' : ''}{a.feld}: {a.alt !== undefined ? <><s style={{ color: C.inkLeise }}>{a.alt}</s> → </> : ''}{a.neu ?? '—'}</span>)}
          </span>
        )}
      </div>
    </li>
  );
}
