'use client';

// ─── Prozesse · Werkstatt — die Felder einer Einstellungs-Maske (Etappe B2, 21.10.; Kevins Bild: „Panel aus dem Masken-Schema des Katalogs“) ─────────────────
// Je Feldtyp des Katalogs (lib/prozesse/baustein-katalog.ts `MaskenTyp`) EIN Eingabe-Baustein aus dem Standard (components/os/ui): Text, Langtext, Textvorlage
// (mit den erlaubten Platzhaltern), Zahl, ja/nein (Schalter), Auswahl, Mehrfach, Uhrzeit, Tage, Bedingungen („nur wenn …“), Webhook-Felder, Vertrag (Ein- und
// Ausgabe des Agenten — nur Kennungen, Zahlen, Tage, ja/nein, Auswahl). Texte und Zahlen werden beim Tippen übernommen — entprellt (lib/prozesse/eingabe-puffer.ts,
// Feinschliff 24.10.: „nie Eingaben verlieren“) — und sofort beim Verlassen, Schließen und `pagehide`; solange ein Feld Getipptes hält, meldet es das der Werkstatt
// (`EingabeKontext`: Kopf „wird übernommen …“, vor dem Speichern wird alles übernommen). Die Werte prüft die Regel (`maskeSaeubern`, `definitionPruefen`); hier steht
// nur, wie man sie eingibt.

import { createContext, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { FARBE as C, TYP, LEUCHT, RAND } from '@/lib/make-one/design';
import { feld, auswahl as auswahlStil, Feldzeile, MehrfachPillen, Schalter, SymbolKnopf, Knopf } from '../ui';
import { BEDINGUNG_OPS, KENNUNG_ARTEN, WEBHOOK_FELD_ARTEN, type Bedingung, type MaskenWert, type VertragFeld, type WebhookFeld } from '@/lib/prozesse/definition';
import { BEDINGUNG_NAME } from '@/lib/prozesse/bedingung';
import { textvorlageFuellen, textvorlagePruefen, type MaskenFeld } from '@/lib/prozesse/baustein-katalog';
import type { TestWert } from '@/lib/prozesse/testdaten';
import { eingabePuffer, type Puffer } from '@/lib/prozesse/eingabe-puffer';

export interface Option { id: string; label: string; hinweis?: string }

// ── Beim Tippen übernehmen (Feinschliff 24.10.) ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** Wer noch Getipptes hält: `melde(id, jetzt)` (jetzt = sofort übernehmen) bzw. `melde(id, null)`, sobald übernommen. Die Werkstatt zählt und übernimmt alles. */
export interface EingabeRegister { melde: (id: symbol, jetzt: (() => void) | null) => void }
export const EingabeKontext = createContext<EingabeRegister | null>(null);

/**
 * EIN Feld beim Tippen übernehmen (lib/prozesse/eingabe-puffer.ts): `tippe` bei jedem Tastendruck, `fertig` beim Verlassen/Enter; beim Verschwinden des Felds
 * (Fenster zu, anderer Knoten) wird Offenes übernommen. Ein Wert von außen ersetzt den Text nur, wenn nichts Getipptes offen ist (und nie, wenn er sich nur um
 * Leerzeichen am Rand unterscheidet — der Server kürzt manche Texte).
 */
export function useTippen(wert: string, uebernehmen: (v: string) => void, o: { gueltig?: (v: string) => boolean; nurBeimVerlassen?: boolean } = {}) {
  const reg = useContext(EingabeKontext);
  const regRef = useRef(reg); regRef.current = reg;
  const ueRef = useRef(uebernehmen); ueRef.current = uebernehmen;
  const gRef = useRef(o.gueltig); gRef.current = o.gueltig;
  const id = useRef(Symbol('eingabe'));
  const [t, setT] = useState(wert);
  const puffer = useRef<Puffer | null>(null);
  if (!puffer.current) {
    puffer.current = eingabePuffer({
      anfang: wert, uebernehmen: v => ueRef.current(v), gueltig: v => (gRef.current ? gRef.current(v) : true), ohneUhr: o.nurBeimVerlassen,
      onOffen: offen => regRef.current?.melde(id.current, offen ? () => { puffer.current?.jetzt(); } : null),
    });
  }
  useEffect(() => {
    const p = puffer.current!;
    if (wert.trim() === p.text().trim() && !p.offen()) return;
    setT(p.vonAussen(wert));
  }, [wert]);
  useEffect(() => () => { const p = puffer.current; if (p) { p.jetzt(); p.stopp(); } regRef.current?.melde(id.current, null); }, []);
  return {
    t,
    tippe: (v: string) => { setT(v); puffer.current!.tippe(v); },
    /** Sofort übernehmen — liefert, ob etwas übernommen wurde. */
    fertig: () => puffer.current!.jetzt(),
    /** Zurück auf den gespeicherten Wert (z. B. leerer Name beim Verlassen). */
    zuruecksetzen: () => { setT(wert); puffer.current!.tippe(wert); },
  };
}

// ── Platzhalter an den Cursor (Werkstatt bau-fertig, 22.10., Punkt 8) ──────────────────────────────────────────────────────────────────────────────
/** Das Textvorlagen-Feld, das zuletzt den Fokus hatte — ein Klick auf einen Platzhalter (auch in der linken Spalte des großen Fensters) setzt ihn dort ein. */
export interface VorlageZiel { einsetzen: (text: string) => void; feld: string }
/** Was die Felder für Vorschau und Prüfung beim Tippen wissen: die Testwerte (Beispiel bzw. eigene Testdaten) und das Ziel für Platzhalter. */
export interface VorlageUmfeld { werte?: Readonly<Record<string, TestWert>>; ziel: MutableRefObject<VorlageZiel | null> }
export const VorlageKontext = createContext<VorlageUmfeld | null>(null);
/** Ein Platzhalter als Knopf: Klick setzt ihn an den Cursor des zuletzt gewählten Textfelds, Ziehen legt ihn an die Stelle, wo er losgelassen wird. */
export function PlatzhalterChip({ id, wert, onEinsetzen }: { id: string; wert?: TestWert; onEinsetzen?: (t: string) => void }) {
  const u = useContext(VorlageKontext);
  const text = `{{${id}}}`;
  return (
    <button type="button" className="fassbar pw-platzhalter" draggable title={`${text}${wert !== undefined && wert !== '' ? ` — Testwert: ${String(wert)}` : ''} · klicken setzt ihn an den Cursor, ziehen legt ihn ab`}
      onMouseDown={e => e.preventDefault()} onDragStart={e => { e.dataTransfer.setData('text/plain', text); e.dataTransfer.effectAllowed = 'copy'; }}
      onClick={() => (onEinsetzen ?? u?.ziel.current?.einsetzen)?.(text)}>
      <span>{text}</span>{wert !== undefined && wert !== '' && <span style={{ color: C.inkLeise }}>{` · ${String(wert)}`}</span>}
    </button>
  );
}

/**
 * Eine Textvorlage (Punkt 8): Platzhalter per Klick bzw. Ziehen an den Cursor, Prüfung beim Tippen (`textvorlagePruefen`), Live-Vorschau mit den Testwerten
 * (`textvorlageFuellen`). Übernommen wird beim Tippen (entprellt) und beim Verlassen (Feinschliff 24.10. — wie jedes Textfeld der Maske).
 */
function VorlageFeld({ id, label, wert, onWert, aus, platzhalter }: { id: string; label: string; wert: string; onWert: (v: string) => void; aus?: boolean; platzhalter?: readonly string[] }) {
  const u = useContext(VorlageKontext);
  const e = useTippen(wert, onWert);
  const t = e.t;
  const el = useRef<HTMLTextAreaElement | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const fertig = () => { e.fertig(); };
  const einsetzen = (x: string) => {
    if (aus) return;
    const a = el.current;
    const von = a?.selectionStart ?? tRef.current.length, bis = a?.selectionEnd ?? von;
    const neu = `${tRef.current.slice(0, von)}${x}${tRef.current.slice(bis)}`;
    e.tippe(neu); tRef.current = neu;
    requestAnimationFrame(() => { a?.focus(); a?.setSelectionRange(von + x.length, von + x.length); });
  };
  const ziel: VorlageZiel = { einsetzen, feld: id };
  const fehler = textvorlagePruefen(t, platzhalter);
  const vorschau = u?.werte && t ? textvorlageFuellen(t, u.werte) : null;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <textarea ref={el} aria-label={label} value={t} disabled={aus} rows={4} onChange={ev => e.tippe(ev.target.value)}
        onFocus={() => { if (u) u.ziel.current = ziel; }} onBlur={fertig}
        style={{ ...feld, resize: 'vertical', minHeight: 96, ...(fehler.length ? { borderColor: LEUCHT.achtung } : {}) }} />
      {fehler.map(f => <span key={f} role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, lineHeight: 1.4 }}>{f.charAt(0).toUpperCase() + f.slice(1)}</span>)}
      {platzhalter?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} aria-label="Platzhalter (klicken setzt an den Cursor)">
          {platzhalter.map(x => <PlatzhalterChip key={x} id={x} wert={u?.werte?.[x]} onEinsetzen={aus ? undefined : einsetzen} />)}
        </div>
      ) : null}
      {vorschau && (
        <div className="pw-vorschau" aria-live="polite">
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Vorschau mit den Testwerten:</span>
          <span style={{ whiteSpace: 'pre-wrap', color: C.ink, fontSize: TYP.bedien }}>{vorschau.text || '—'}</span>
          {vorschau.fehlend.length ? <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{`ohne Testwert: ${vorschau.fehlend.map(x => `{{${x}}}`).join(', ')}`}</span> : null}
        </div>
      )}
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise, borderTop: `1px solid ${RAND.haar}`, paddingTop: 4 }}>Feste Formatierer mit „|“, z. B. {'{{heute | datum}}'}.</span>
    </div>
  );
}

const klein = { fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.45 } as const;
const zeile = { display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center' } as const;

/**
 * Ein Textfeld, das beim Tippen (entprellt) und beim Verlassen übernimmt (Enter auch, außer im Langtext). `pflicht`: leer wird nie übernommen — beim Verlassen
 * steht wieder der gespeicherte Text da. `gueltig`: nur passende Texte übernehmen (z. B. keine halbe Liste „a,“).
 */
export function TextFeld({ wert, onWert, mehrzeilig, aus, platz, label, pflicht, gueltig, nurBeimVerlassen }: { wert: string; onWert: (v: string) => void; mehrzeilig?: boolean; aus?: boolean; platz?: string; label: string; pflicht?: boolean; gueltig?: (v: string) => boolean;
  /** Nur beim Verlassen/Enter übernehmen (Felder außerhalb der Werkstatt, deren Übernahme z. B. eine Vorgabe zurückbringt). */ nurBeimVerlassen?: boolean }) {
  const e = useTippen(wert, onWert, { gueltig: v => (!pflicht || !!v.trim()) && (!gueltig || gueltig(v)), nurBeimVerlassen });
  const fertig = () => { if (!e.fertig() && pflicht && !e.t.trim()) e.zuruecksetzen(); };
  return mehrzeilig
    ? <textarea aria-label={label} value={e.t} disabled={aus} placeholder={platz} onChange={ev => e.tippe(ev.target.value)} onBlur={fertig} rows={4} style={{ ...feld, resize: 'vertical', minHeight: 96 }} />
    : <input aria-label={label} value={e.t} disabled={aus} placeholder={platz} onChange={ev => e.tippe(ev.target.value)} onBlur={fertig} onKeyDown={ev => { if (ev.key === 'Enter') fertig(); }} style={feld} />;
}
/** Eine Zahl als Text: übernommen wird, sobald sie lesbar ist (leer = keine Zahl); beim Verlassen springt Unlesbares auf den gespeicherten Wert zurück. */
const zahlAus = (t: string): number | null | undefined => { if (!t.trim()) return null; const n = Number(t.replace(',', '.')); return Number.isFinite(n) ? Math.round(n) : undefined; };
export function ZahlFeld({ wert, onWert, aus, min, max, label }: { wert: number | null; onWert: (v: number | null) => void; aus?: boolean; min?: number; max?: number; label: string }) {
  const e = useTippen(wert === null ? '' : String(wert), t => { const n = zahlAus(t); if (n !== undefined && n !== wert) onWert(n); }, { gueltig: t => zahlAus(t) !== undefined });
  const fertig = () => { if (!e.fertig() && zahlAus(e.t) === undefined) e.zuruecksetzen(); };
  return <input aria-label={label} inputMode="numeric" value={e.t} disabled={aus} min={min} max={max} onChange={ev => e.tippe(ev.target.value)} onBlur={fertig} onKeyDown={ev => { if (ev.key === 'Enter') fertig(); }} style={{ ...feld, maxWidth: 180 }} />;
}

/** Eine Bedingung je Zeile: Feld · Vergleich · Wert. */
function BedingungenFeld({ wert, onWert, felder, aus }: { wert: readonly Bedingung[]; onWert: (v: Bedingung[]) => void; felder: readonly Option[]; aus?: boolean }) {
  const l = [...wert];
  const setze = (i: number, b: Partial<Bedingung>) => onWert(l.map((x, j) => (j === i ? { ...x, ...b } : x)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {l.map((b, i) => (
        <div key={i} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) auto', alignItems: 'center' }}>
          <select aria-label="Feld" value={b.feld} disabled={aus} onChange={e => setze(i, { feld: e.target.value })} style={{ ...auswahlStil, width: '100%' }}>
            {!felder.some(f => f.id === b.feld) && <option value={b.feld}>{b.feld}</option>}
            {felder.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <select aria-label="Vergleich" value={b.op} disabled={aus} onChange={e => setze(i, { op: e.target.value as Bedingung['op'] })} style={{ ...auswahlStil, width: '100%' }}>
            {BEDINGUNG_OPS.map(o => <option key={o} value={o}>{BEDINGUNG_NAME[o]}</option>)}
          </select>
          {b.op === 'gesetzt' || b.op === 'leer'
            ? <span style={klein}>—</span>
            : <TextFeld label="Wert" wert={Array.isArray(b.wert) ? b.wert.join(', ') : String(b.wert ?? '')} aus={aus} gueltig={b.op === 'einer-von' ? v => !/,\s*$/.test(v) : undefined}
                onWert={v => setze(i, { wert: b.op === 'einer-von' ? v.split(',').map(x => x.trim()).filter(Boolean) : v })} />}
          <SymbolKnopf ariaLabel="Bedingung entfernen" aus={aus} onClick={() => onWert(l.filter((_, j) => j !== i))}><X size={16} /></SymbolKnopf>
        </div>
      ))}
      {!aus && <Knopf leise onClick={() => onWert([...l, { feld: felder[0]?.id ?? 'lead.status', op: 'gleich', wert: '' }])}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Bedingung</span></Knopf>}
      {!felder.length && <p style={klein}>Für diesen Auslöser gibt es keine Felder zum Vergleichen.</p>}
    </div>
  );
}

/** Felder eines Webhooks (Schema): nur diese werden angenommen. */
function WebhookFelderFeld({ wert, onWert, aus }: { wert: readonly WebhookFeld[]; onWert: (v: WebhookFeld[]) => void; aus?: boolean }) {
  const l = [...wert];
  const setze = (i: number, f: Partial<WebhookFeld>) => onWert(l.map((x, j) => (j === i ? { ...x, ...f } : x)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {l.map((f, i) => (
        <div key={i} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto auto', alignItems: 'center' }}>
          <TextFeld label="Kennung des Felds" wert={f.id} aus={aus} platz="z. B. firma" onWert={v => setze(i, { id: v.trim().toLowerCase() })} />
          <select aria-label="Art" value={f.art} disabled={aus} onChange={e => setze(i, { art: e.target.value as WebhookFeld['art'] })} style={{ ...auswahlStil, width: '100%' }}>
            {WEBHOOK_FELD_ARTEN.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <Schalter an={!!f.pflicht} onChange={v => setze(i, { pflicht: v || undefined })} aus={aus} ariaLabel="Pflicht" erklaerungOhne="Schaltet ein Feld des Webhooks auf Pflicht um." />
          <SymbolKnopf ariaLabel="Feld entfernen" aus={aus} onClick={() => onWert(l.filter((_, j) => j !== i))}><X size={16} /></SymbolKnopf>
        </div>
      ))}
      {!aus && <Knopf leise onClick={() => onWert([...l, { id: `feld${l.length + 1}`, art: 'text' }])}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Feld</span></Knopf>}
    </div>
  );
}

/** Ein Vertrag (Ein- bzw. Ausgabe eines Agenten-Schritts): nur Kennungen, Zahlen, Tage, ja/nein, Auswahl — nie Freitext (Punkt 54). */
function VertragFeldEditor({ wert, onWert, aus }: { wert: readonly VertragFeld[]; onWert: (v: VertragFeld[]) => void; aus?: boolean }) {
  const l = [...wert];
  const setze = (i: number, f: Partial<VertragFeld>) => onWert(l.map((x, j) => (j === i ? { ...x, ...f } : x)));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {l.map((f, i) => (
        <div key={i} style={{ display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) auto', alignItems: 'center' }}>
          <TextFeld label="Kennung" wert={f.id} aus={aus} platz="z. B. kontakt" onWert={v => setze(i, { id: v.trim().toLowerCase() })} />
          <select aria-label="Art" value={f.art} disabled={aus} onChange={e => setze(i, { art: e.target.value as VertragFeld['art'] })} style={{ ...auswahlStil, width: '100%' }}>
            {(['kennung', 'zahl', 'datum', 'ja-nein', 'auswahl'] as const).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {f.art === 'kennung'
            ? <select aria-label="Worauf" value={f.kennung ?? ''} disabled={aus} onChange={e => setze(i, { kennung: (e.target.value || undefined) as VertragFeld['kennung'] })} style={{ ...auswahlStil, width: '100%' }}>
              <option value="">— worauf —</option>{KENNUNG_ARTEN.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            : <span />}
          <SymbolKnopf ariaLabel="Feld entfernen" aus={aus} onClick={() => onWert(l.filter((_, j) => j !== i))}><X size={16} /></SymbolKnopf>
        </div>
      ))}
      {!aus && <Knopf leise onClick={() => onWert([...l, { id: `feld${l.length + 1}`, art: 'kennung', kennung: 'kontakt' }])}><span className="pz-knopf-inhalt"><Plus size={14} aria-hidden />Feld</span></Knopf>}
    </div>
  );
}

const TAGE_31 = Array.from({ length: 31 }, (_, i) => ({ id: String(i + 1), label: String(i + 1) }));

/** Ein Feld der Maske — nach seinem Typ. `optionen` = feste bzw. aus der Instanz aufgelöste Werte, `felder` = Felder für Bedingungen. */
export function MaskenEingabe({ f, wert, onWert, optionen, felder, platzhalter, fehler, aus }: {
  f: MaskenFeld; wert: MaskenWert | undefined; onWert: (v: MaskenWert) => void; optionen: readonly Option[]; felder?: readonly Option[]; platzhalter?: readonly string[]; fehler?: string; aus?: boolean;
}) {
  const label = `${f.label}${f.pflicht ? ' *' : ''}`;
  let eingabe: ReactNode;
  switch (f.typ) {
    case 'text': eingabe = <TextFeld label={f.label} wert={typeof wert === 'string' ? wert : ''} aus={aus} onWert={onWert} />; break;
    case 'langtext': eingabe = <TextFeld label={f.label} mehrzeilig wert={typeof wert === 'string' ? wert : ''} aus={aus} onWert={onWert} />; break;
    case 'textvorlage': eingabe = <VorlageFeld id={f.id} label={f.label} wert={typeof wert === 'string' ? wert : ''} aus={aus} onWert={onWert} platzhalter={platzhalter} />; break;
    case 'zahl': eingabe = <ZahlFeld label={f.label} wert={typeof wert === 'number' ? wert : null} aus={aus} min={f.min} max={f.max} onWert={onWert} />; break;
    case 'ja-nein': eingabe = <Schalter an={wert === true} onChange={v => onWert(v)} aus={aus} erklaerung={[{ kopf: f.label, text: f.hilfe ?? `${f.label}: ja oder nein für diesen Baustein.` }]}>{wert === true ? 'ja' : 'nein'}</Schalter>; break;
    case 'uhrzeit': eingabe = <input aria-label={f.label} type="time" value={typeof wert === 'string' ? wert : ''} disabled={aus} onChange={e => onWert(e.target.value || null)} style={{ ...feld, maxWidth: 160, colorScheme: 'dark' }} />; break;
    case 'auswahl':
      eingabe = (
        <select aria-label={f.label} value={typeof wert === 'string' ? wert : ''} disabled={aus} onChange={e => onWert(e.target.value || null)} style={{ ...auswahlStil, width: '100%' }}>
          <option value="">— wählen —</option>
          {typeof wert === 'string' && wert && !optionen.some(o => o.id === wert) && <option value={wert}>{`${wert} (nicht mehr da)`}</option>}
          {optionen.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      );
      break;
    case 'mehrfach': {
      const an = Array.isArray(wert) ? (wert as readonly unknown[]).filter((x): x is string => typeof x === 'string') : [];
      eingabe = optionen.length <= 16
        ? <MehrfachPillen liste={optionen.map(o => ({ id: o.id, label: o.label }))} aktiv={an} onWahl={v => onWert(v)} />
        : <MehrfachListe optionen={optionen} an={an} onWert={onWert} aus={aus} />;
      break;
    }
    case 'tage': {
      const an = Array.isArray(wert) ? (wert as readonly unknown[]).filter((x): x is number => typeof x === 'number').map(String) : [];
      eingabe = <MehrfachPillen liste={TAGE_31} aktiv={an} onWahl={v => onWert(v.map(Number).sort((a, b) => a - b))} />;
      break;
    }
    case 'bedingungen': eingabe = <BedingungenFeld wert={Array.isArray(wert) ? wert as Bedingung[] : []} onWert={v => onWert(v as unknown as MaskenWert)} felder={felder ?? []} aus={aus} />; break;
    case 'webhook-felder': eingabe = <WebhookFelderFeld wert={Array.isArray(wert) ? wert as WebhookFeld[] : []} onWert={v => onWert(v as unknown as MaskenWert)} aus={aus} />; break;
    case 'vertrag': eingabe = <VertragFeldEditor wert={Array.isArray(wert) ? wert as VertragFeld[] : []} onWert={v => onWert(v as unknown as MaskenWert)} aus={aus} />; break;
  }
  // data-ws-feld (Punkt 6): ein Klick auf den Befund am Knoten springt genau in dieses Feld.
  return (
    <div data-ws-feld={f.id} style={{ display: 'grid', minWidth: 0 }}>
      <Feldzeile label={label} fehler={fehler}>
        {eingabe}
        {f.hilfe && f.typ !== 'ja-nein' && <span style={klein}>{f.hilfe}</span>}
      </Feldzeile>
    </div>
  );
}

/** Viele Werte (z. B. Werkzeuge): Liste mit Suche, je Wert ein Haken — gesperrte Werte (Schloss) mit Hinweis. */
function MehrfachListe({ optionen, an, onWert, aus }: { optionen: readonly Option[]; an: readonly string[]; onWert: (v: string[]) => void; aus?: boolean }) {
  const [q, setQ] = useState('');
  const l = optionen.filter(o => !q || `${o.label} ${o.id}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <input aria-label="Suchen" placeholder="Suchen …" value={q} onChange={e => setQ(e.target.value)} style={feld} />
      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 2 }}>
        {l.map(o => (
          <label key={o.id} style={{ ...zeile, minHeight: 36, cursor: aus ? 'default' : 'pointer', fontSize: TYP.bedien, color: C.ink }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{o.label}{o.hinweis && <span style={{ color: C.inkLeise }}>{` · ${o.hinweis}`}</span>}</span>
            <input type="checkbox" disabled={aus} checked={an.includes(o.id)} onChange={e => onWert(e.target.checked ? [...an, o.id] : an.filter(x => x !== o.id))} style={{ width: 20, height: 20 }} />
          </label>
        ))}
      </div>
    </div>
  );
}
