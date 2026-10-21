'use client';

// ─── Prozesse · Werkstatt — die Felder einer Einstellungs-Maske (Etappe B2, 21.10.; Kevins Bild: „Panel aus dem Masken-Schema des Katalogs“) ─────────────────
// Je Feldtyp des Katalogs (lib/prozesse/baustein-katalog.ts `MaskenTyp`) EIN Eingabe-Baustein aus dem Standard (components/os/ui): Text, Langtext, Textvorlage
// (mit den erlaubten Platzhaltern), Zahl, ja/nein (Schalter), Auswahl, Mehrfach, Uhrzeit, Tage, Bedingungen („nur wenn …“), Webhook-Felder, Vertrag (Ein- und
// Ausgabe des Agenten — nur Kennungen, Zahlen, Tage, ja/nein, Auswahl). Texte werden beim Verlassen des Felds übernommen (nicht bei jedem Tastendruck — so bleibt
// die Geschichte für Rückgängig sauber). Die Werte prüft die Regel (`maskeSaeubern`, `definitionPruefen`); hier steht nur, wie man sie eingibt.

import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { feld, auswahl as auswahlStil, Feldzeile, MehrfachPillen, Schalter, SymbolKnopf, Knopf } from '../ui';
import { BEDINGUNG_OPS, KENNUNG_ARTEN, WEBHOOK_FELD_ARTEN, type Bedingung, type MaskenWert, type VertragFeld, type WebhookFeld } from '@/lib/prozesse/definition';
import { BEDINGUNG_NAME } from '@/lib/prozesse/bedingung';
import type { MaskenFeld } from '@/lib/prozesse/baustein-katalog';

export interface Option { id: string; label: string; hinweis?: string }

const klein = { fontSize: TYP.bedien, color: C.inkLeise, margin: 0, lineHeight: 1.45 } as const;
const zeile = { display: 'grid', gap: 6, gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center' } as const;

/** Ein Textfeld, das beim Verlassen übernimmt (Enter auch, außer im Langtext). */
export function TextFeld({ wert, onWert, mehrzeilig, aus, platz, label }: { wert: string; onWert: (v: string) => void; mehrzeilig?: boolean; aus?: boolean; platz?: string; label: string }) {
  const [t, setT] = useState(wert);
  useEffect(() => setT(wert), [wert]);
  const fertig = () => { if (t !== wert) onWert(t); };
  return mehrzeilig
    ? <textarea aria-label={label} value={t} disabled={aus} placeholder={platz} onChange={e => setT(e.target.value)} onBlur={fertig} rows={4} style={{ ...feld, resize: 'vertical', minHeight: 96 }} />
    : <input aria-label={label} value={t} disabled={aus} placeholder={platz} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={e => { if (e.key === 'Enter') fertig(); }} style={feld} />;
}
function ZahlFeld({ wert, onWert, aus, min, max, label }: { wert: number | null; onWert: (v: number | null) => void; aus?: boolean; min?: number; max?: number; label: string }) {
  const [t, setT] = useState(wert === null ? '' : String(wert));
  useEffect(() => setT(wert === null ? '' : String(wert)), [wert]);
  const fertig = () => { const n = t.trim() === '' ? null : Number(t.replace(',', '.')); if (n === null || Number.isFinite(n)) { if (n !== wert) onWert(n === null ? null : Math.round(n)); } else setT(wert === null ? '' : String(wert)); };
  return <input aria-label={label} inputMode="numeric" value={t} disabled={aus} min={min} max={max} onChange={e => setT(e.target.value)} onBlur={fertig} onKeyDown={e => { if (e.key === 'Enter') fertig(); }} style={{ ...feld, maxWidth: 180 }} />;
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
            : <TextFeld label="Wert" wert={Array.isArray(b.wert) ? b.wert.join(', ') : String(b.wert ?? '')} aus={aus} onWert={v => setze(i, { wert: b.op === 'einer-von' ? v.split(',').map(x => x.trim()).filter(Boolean) : v })} />}
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
          <Schalter an={!!f.pflicht} onChange={v => setze(i, { pflicht: v || undefined })} aus={aus} ariaLabel="Pflicht" erklaerungOhne="Pflichtfeld des Webhooks" />
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
    case 'langtext': case 'textvorlage':
      eingabe = (
        <>
          <TextFeld label={f.label} mehrzeilig wert={typeof wert === 'string' ? wert : ''} aus={aus} onWert={onWert} />
          {f.typ === 'textvorlage' && platzhalter?.length ? <p style={klein}>Platzhalter: {platzhalter.map(x => `{{${x}}}`).join(' · ')} — feste Formatierer mit „|“, z. B. {'{{heute | datum}}'}.</p> : null}
        </>
      );
      break;
    case 'zahl': eingabe = <ZahlFeld label={f.label} wert={typeof wert === 'number' ? wert : null} aus={aus} min={f.min} max={f.max} onWert={onWert} />; break;
    case 'ja-nein': eingabe = <Schalter an={wert === true} onChange={v => onWert(v)} aus={aus} erklaerungOhne={f.hilfe ?? f.label}>{wert === true ? 'ja' : 'nein'}</Schalter>; break;
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
  return (
    <Feldzeile label={label} fehler={fehler}>
      {eingabe}
      {f.hilfe && f.typ !== 'ja-nein' && <span style={klein}>{f.hilfe}</span>}
    </Feldzeile>
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
