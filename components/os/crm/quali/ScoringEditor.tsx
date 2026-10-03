'use client';

// ─── Scoring-Einstellungen: Marketing-Scoring und Sales-Scoring (03.10.) ───────────────────────
// Kevin: „Darunter ist dann Qualifizierung und die Scoring-Einstellungen von Marketing und auf Sales, also von MQL zu SQL.“
// Methode (nur das Verfahren, eigene Kriterien): Kriterien in Blöcken, je Kriterium Stufen mit Punkten (1 · 3 · 5, 0 = trifft nicht
// zu), die Summe geht gegen eine Mindestpunktzahl; die mögliche Höchstpunktzahl steht daneben. Marketing misst Signale aus den
// Daten (Event, Make.One, Newsletter mit Double-Opt-in, Antwort, Termin, Empfehlung, Anfrage …) — Sales stellt Fragen im Gespräch
// (Fit, Schmerz, Budget, Entscheider, Zeit, Champion, Prozess, Potenzial) mit Muss-Kriterien. Alles zum Spielen: umbenennen,
// Punkte und Gewicht ändern, Kriterien hinzufügen und entfernen; die Live-Vorschau zeigt, wie die vorhandenen Leads dann stünden.

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, feld, LEUCHT } from '../../schlank';
import { Fenster } from '../../Fenster';
import { localDay } from '@/lib/zeit';
import { MESSUNGEN, type MessungId, type ScoringEinstellungen, type ScoringKriterium, type ScoringMuss, type ScoringSeiteId } from '@/lib/crm/scoring';
import { frageNeu, freieMessungen, kriteriumAusMessung, kriteriumEntfernen, kriteriumHinzufuegen, maxPunkte, stufeNeu, teilEntfernen, teilHinzufuegen, kopie } from '@/lib/crm/scoring-bearbeiten';
import { scoringVorschau, type Vorschau } from '@/lib/crm/scoring-vorschau';
import { temperaturFarbe, temperaturLabel } from '@/lib/crm/score';
import type { Temperatur } from '@/lib/crm/typen';
import type { CrmApi } from '../daten';
import type { ScoringEntwurf, ScoringDaten } from './ScoringEntwurf';
import { punkteText, useScoringEinstellungen } from './hilfen';

const TEMPS: Temperatur[] = ['kalt', 'lau', 'warm', 'heiss'];
const klein = { fontSize: 12.5, color: C.inkDim, lineHeight: 1.55 } as const;
const label = { fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkLeise, fontWeight: 700 } as const;
const eingabe = { ...feld, fontSize: 16, padding: '8px 11px', minHeight: 44 } as const;

/** Zahlenfeld, das Tippen verträgt („1.“, „“): übernimmt gültige Zahlen sofort, formatiert beim Verlassen. */
function Zahlfeld({ wert, onWert, min = 0, max = 1000, schritt = 1, breite = 84, aria }: { wert: number; onWert: (n: number) => void; min?: number; max?: number; schritt?: number; breite?: number; aria: string }) {
  const [text, setText] = useState(String(wert).replace('.', ','));
  useEffect(() => { setText(String(wert).replace('.', ',')); }, [wert]);
  return (
    <input value={text} inputMode="decimal" aria-label={aria} step={schritt} style={{ ...eingabe, width: breite, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      onChange={e => { setText(e.target.value); const n = Number(e.target.value.replace(',', '.')); if (e.target.value.trim() !== '' && Number.isFinite(n)) onWert(Math.min(max, Math.max(min, n))); }}
      onBlur={() => setText(String(wert).replace('.', ','))} />
  );
}

// ── Die Wirkung auf die vorhandenen Leads ───────────────────────────────────────────────────
function pfeil(v: number, n: number) { return v === n ? <b>{n}</b> : <span><span style={{ color: C.inkLeise }}>{v}</span> → <b style={{ color: n > v ? LEUCHT.gut : LEUCHT.achtung }}>{n}</b></span>; }

export function VorschauKarte({ api, alt, neu, i = 0, titel = 'So würden deine aktuellen Leads eingestuft' }: { api: CrmApi; alt: ScoringEinstellungen | undefined; neu: ScoringEinstellungen; i?: number; titel?: string }) {
  const verzoegert = useDeferredValue(neu);
  const heute = api.crm?.heute ?? localDay();
  const v: Vorschau | null = useMemo(() => (api.crm && api.kontakte ? scoringVorschau(api.kontakte, api.crm.stand, heute, alt, verzoegert) : null), [api.crm, api.kontakte, heute, alt, verzoegert]);
  return (
    <Karte i={i}>
      <Ueberschrift>{titel}</Ueberschrift>
      {!v ? <div style={klein}>Rechnet …</div> : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: '8px 22px', flexWrap: 'wrap', alignItems: 'baseline', fontSize: TYP.body }}>
            <span><b>{v.anzahl}</b> <span style={klein}>Leads</span></span>
            <span><span style={klein}>MQL</span> {pfeil(v.mql[0], v.mql[1])}</span>
            <span><span style={klein}>SQL-bereit</span> {pfeil(v.sql[0], v.sql[1])}</span>
            <span style={klein}>{v.wechsler ? `${v.wechsler} ${v.wechsler === 1 ? 'Lead wechselt' : 'Leads wechseln'} Punkte, Temperatur oder Stufe` : 'Nichts ändert sich an den vorhandenen Leads.'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TEMPS.map(t => <span key={t} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 999, border: `1px solid ${temperaturFarbe(t)}44`, fontSize: 12.5 }}><span style={{ color: temperaturFarbe(t), fontWeight: 700 }}>{temperaturLabel(t)}</span>{pfeil(v.temperatur[t][0], v.temperatur[t][1])}</span>)}
          </div>
          {v.beispiele.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <div style={label}>Beispiele</div>
              {v.beispiele.map(b => (
                <div key={b.vorher.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, fontSize: 12.5, alignItems: 'center' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.vorher.name}</span>
                  <span style={{ color: C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{b.vorher.punkte} → <b style={{ color: C.ink }}>{b.nachher.punkte}</b> · {temperaturLabel(b.vorher.temperatur)}{b.vorher.temperatur !== b.nachher.temperatur ? ` → ${temperaturLabel(b.nachher.temperatur)}` : ''}{b.vorher.mql !== b.nachher.mql ? ` · MQL ${b.nachher.mql ? 'neu' : 'weg'}` : ''}{b.vorher.sql !== b.nachher.sql ? ` · SQL ${b.nachher.sql ? 'neu' : 'weg'}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Karte>
  );
}

// ── Ein Kriterium ───────────────────────────────────────────────────────────────────────────
function KriteriumZeile({ k, seite, onAender, onEntfernen, istMuss }: { k: ScoringKriterium; seite: ScoringSeiteId; onAender: (f: (k: ScoringKriterium) => ScoringKriterium) => void; onEntfernen: () => void; istMuss: boolean }) {
  const [auf, setAuf] = useState(false);
  const [sicher, setSicher] = useState(false);
  useEffect(() => { if (!sicher) return; const t = setTimeout(() => setSicher(false), 4000); return () => clearTimeout(t); }, [sicher]);
  const max = Math.max(...k.stufen.map(s => s.punkte)) * (k.gewicht ?? 1);
  const messung = k.messung ? MESSUNGEN[k.messung] : null;
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,.06)', opacity: k.aus ? 0.6 : 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', minHeight: 52 }}>
        <label title={k.aus ? 'Eingeschaltet zählt das Kriterium' : 'Ausgeschaltet zählt es weder Punkte noch Höchstpunktzahl'} style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, cursor: 'pointer' }}>
          <input type="checkbox" checked={!k.aus} onChange={e => onAender(x => ({ ...x, ...(e.target.checked ? { aus: undefined } : { aus: true }) }))} aria-label={`${k.name} zählt`} style={{ width: 22, height: 22 }} />
        </label>
        <button type="button" onClick={() => setAuf(!auf)} aria-expanded={auf} className="fassbar" style={{ textAlign: 'left', background: 'none', border: 'none', color: C.ink, cursor: 'pointer', fontFamily: SCHRIFT.text, padding: '4px 0', minHeight: 44 }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: TYP.bedien, fontWeight: 600 }}>{k.name}{istMuss && <span style={{ fontSize: 11, fontWeight: 700, color: LEUCHT.achtung, border: `1px solid ${LEUCHT.achtung}55`, borderRadius: 999, padding: '0 6px' }}>Muss</span>}</span>
          <span style={{ display: 'block', fontSize: 12, color: C.inkLeise }}>{messung ? `Aus den Daten: ${messung.label}` : 'Frage im Gespräch'}{k.alt ? ' · ersetzt das alte Feld' : ''}{k.gewicht && k.gewicht !== 1 ? ` · Gewicht ×${punkteText(k.gewicht)}` : ''}</span>
        </button>
        <span style={{ fontSize: 12.5, color: C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>max. {punkteText(max)}</span>
        <button type="button" onClick={() => setAuf(!auf)} aria-label={auf ? 'Zuklappen' : 'Aufklappen'} className="fassbar" style={{ width: 44, height: 44, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', transform: auf ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</button>
      </div>
      {auf && (
        <div style={{ display: 'grid', gap: 10, padding: '2px 0 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 4 }}><span style={label}>Name</span><input value={k.name} onChange={e => onAender(x => ({ ...x, name: e.target.value }))} maxLength={60} style={eingabe} /></label>
            <label style={{ display: 'grid', gap: 4 }}><span style={label}>Gewicht</span><Zahlfeld wert={k.gewicht ?? 1} onWert={n => onAender(x => ({ ...x, gewicht: n === 1 ? undefined : n }))} min={0.5} max={10} schritt={0.5} aria="Gewicht" /></label>
          </div>
          {seite === 'sales' ? (
            <label style={{ display: 'grid', gap: 4 }}><span style={label}>Die Frage im Gespräch</span><textarea value={k.hinweis ?? ''} onChange={e => onAender(x => ({ ...x, hinweis: e.target.value }))} rows={2} maxLength={400} placeholder="Was fragst du — so, wie du es am Telefon sagen würdest?" style={{ ...eingabe, resize: 'vertical', width: '100%' }} /></label>
          ) : messung && <div style={klein}>{messung.hinweis}</div>}
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={label}>Stufen — Punkte und Text</div>
            {k.stufen.map((s, i) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 8, alignItems: 'center' }}>
                <Zahlfeld wert={s.punkte} onWert={n => onAender(x => ({ ...x, stufen: x.stufen.map((y, j) => (j === i ? { ...y, punkte: n } : y)) }))} min={0} max={100} schritt={0.5} breite={72} aria={`Punkte für ${s.text}`} />
                <input value={s.text} onChange={e => onAender(x => ({ ...x, stufen: x.stufen.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) }))} maxLength={200} aria-label={`Text der Stufe ${i + 1}`} style={eingabe} />
                {k.quelle === 'frage' && k.stufen.length > 2
                  ? <button type="button" onClick={() => onAender(x => ({ ...x, stufen: x.stufen.filter((_, j) => j !== i), ...(x.ohneAntwort === s.id ? { ohneAntwort: undefined } : {}) }))} aria-label={`Stufe „${s.text}“ entfernen`} className="fassbar" style={{ width: 44, height: 44, background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 18 }}>×</button>
                  : <span style={{ width: 44 }} />}
              </div>
            ))}
            {k.quelle === 'frage' && k.stufen.length < 8 && <div><Knopf leise onClick={() => onAender(x => ({ ...x, stufen: [...x.stufen, stufeNeu(x)] }))}>+ Stufe</Knopf></div>}
            {s_deckel(k) && <div style={{ fontSize: 12, color: C.inkLeise }}>{s_deckel(k)}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => (sicher ? onEntfernen() : setSicher(true))} className="fassbar" style={{ minHeight: 44, padding: '8px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, color: LEUCHT.kritisch, border: `1px solid ${LEUCHT.kritisch}55`, background: sicher ? `${LEUCHT.kritisch}22` : 'transparent' }}>{sicher ? 'Wirklich entfernen?' : 'Kriterium entfernen'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
const s_deckel = (k: ScoringKriterium): string | null => { const d = k.stufen.find(s => s.deckel !== undefined); return d ? `Die Stufe „${d.text}“ deckelt den ganzen Block auf höchstens ${punkteText(d.deckel!)} Punkte.` : null; };

// ── Muss-Kriterien (Sales) ───────────────────────────────────────────────────────────────────
function MussEditor({ e, setE }: { e: ScoringEinstellungen; setE: (f: (e: ScoringEinstellungen) => ScoringEinstellungen) => void }) {
  const kriterien = e.sales.teile.flatMap(t => t.kriterien);
  const name = (id: string) => kriterien.find(k => k.id === id)?.name ?? id;
  const aender = (i: number, f: (m: ScoringMuss) => ScoringMuss) => setE(x => { const n = kopie(x); n.sales.muss[i] = f(n.sales.muss[i]); return n; });
  return (
    <Karte i={1}>
      <Ueberschrift>Muss-Kriterien — ohne sie hilft keine Punktzahl</Ueberschrift>
      <div style={{ ...klein, marginBottom: 10 }}>Ein Lead wird SQL, wenn er die Mindestpunktzahl erreicht UND jedes Muss-Kriterium erfüllt: mindestens so viele der gewählten Kriterien stehen auf einer Stufe mit der geforderten Punktzahl. Beispiel: „Budget oder Zeitpunkt“ = eins von beiden genügt.</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {e.sales.muss.map((m, i) => (
          <div key={i} style={{ display: 'grid', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,.04)' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {kriterien.filter(k => k.quelle === 'frage').map(k => { const an = m.kriterien.includes(k.id); return (
                <button key={k.id} type="button" aria-pressed={an} onClick={() => aender(i, x => { const ids = an ? x.kriterien.filter(y => y !== k.id) : [...x.kriterien, k.id]; return { ...x, kriterien: ids, mindestens: Math.max(1, Math.min(x.mindestens, ids.length || 1)) }; })} className="fassbar"
                  style={{ minHeight: 40, padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: 12.5, fontWeight: 600, color: C.ink, border: `1px solid ${an ? LEUCHT.achtung : 'rgba(255,255,255,.12)'}`, background: an ? `${LEUCHT.achtung}1F` : 'transparent' }}>{an ? '✓ ' : ''}{k.name}</button>
              ); })}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: TYP.bedien }}>
              <span>mindestens</span><Zahlfeld wert={m.mindestens} onWert={n => aender(i, x => ({ ...x, mindestens: Math.max(1, Math.min(Math.round(n), x.kriterien.length || 1)) }))} min={1} max={10} breite={64} aria="Mindestens so viele" />
              <span>davon auf einer Stufe mit mindestens</span><Zahlfeld wert={m.stufePunkte} onWert={n => aender(i, x => ({ ...x, stufePunkte: n }))} min={0} max={100} schritt={0.5} breite={72} aria="Mindestpunkte der Stufe" /><span>Punkten</span>
              <button type="button" onClick={() => setE(x => { const n = kopie(x); n.sales.muss = n.sales.muss.filter((_, j) => j !== i); return n; })} className="fassbar" style={{ marginLeft: 'auto', minHeight: 44, padding: '6px 12px', background: 'none', border: 'none', color: LEUCHT.kritisch, cursor: 'pointer', fontSize: TYP.bedien }}>Regel entfernen</button>
            </div>
            <div style={{ fontSize: 12, color: C.inkLeise }}>{m.kriterien.length ? (m.kriterien.length === 1 ? name(m.kriterien[0]) : m.mindestens === 1 ? m.kriterien.map(name).join(' oder ') : `mindestens ${m.mindestens} von ${m.kriterien.map(name).join(', ')}`) : 'Wähle mindestens ein Kriterium.'}</div>
          </div>
        ))}
        {!e.sales.muss.length && <div style={klein}>Keine Muss-Kriterien — dann entscheiden allein die Punkte.</div>}
        <div><Knopf leise onClick={() => setE(x => { const n = kopie(x); const erste = n.sales.teile.flatMap(t => t.kriterien).find(k => k.quelle === 'frage'); n.sales.muss.push({ kriterien: erste ? [erste.id] : [], mindestens: 1, stufePunkte: 3 }); return n; })}>+ Muss-Regel</Knopf></div>
      </div>
    </Karte>
  );
}

// ── Temperatur ───────────────────────────────────────────────────────────────────────────────
function TemperaturKarte({ e, setE, i }: { e: ScoringEinstellungen; setE: (f: (e: ScoringEinstellungen) => ScoringEinstellungen) => void; i: number }) {
  return (
    <Karte i={i}>
      <Ueberschrift>Gesamtwert und Temperatur</Ueberschrift>
      <div style={{ ...klein, marginBottom: 10 }}>Der Gesamtwert 0–100 ist der Anteil aller erreichten an allen möglichen Punkten (Marketing + Sales). Die Temperatur — kalt, lau, warm, heiß — ordnet ihn ein; kalte Leads warten im Marketing-Segment „Vernetzen“.</div>
      <div style={{ display: 'flex', gap: '10px 22px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: TYP.bedien }}><span style={{ color: temperaturFarbe('lau'), fontWeight: 700 }}>Lau</span> ab</span><Zahlfeld wert={e.temperaturAb.lau} onWert={n => setE(x => ({ ...x, temperaturAb: { ...x.temperaturAb, lau: Math.round(n) } }))} min={1} max={99} breite={64} aria="Lau ab" />
        <span style={{ fontSize: TYP.bedien }}><span style={{ color: temperaturFarbe('warm'), fontWeight: 700 }}>Warm</span> ab</span><Zahlfeld wert={e.temperaturAb.warm} onWert={n => setE(x => ({ ...x, temperaturAb: { ...x.temperaturAb, warm: Math.round(n) } }))} min={1} max={99} breite={64} aria="Warm ab" />
        <span style={{ fontSize: TYP.bedien }}><span style={{ color: temperaturFarbe('heiss'), fontWeight: 700 }}>Heiß</span> ab</span><Zahlfeld wert={e.temperaturAb.heiss} onWert={n => setE(x => ({ ...x, temperaturAb: { ...x.temperaturAb, heiss: Math.round(n) } }))} min={1} max={100} breite={64} aria="Heiß ab" />
      </div>
    </Karte>
  );
}

// ── Eine Seite (Marketing oder Sales) ────────────────────────────────────────────────────────
export function ScoringSeite({ api, seite, z, i = 0 }: { api: CrmApi; seite: ScoringSeiteId; z: ScoringEntwurf; i?: number }) {
  const { entwurf: e, daten, setEntwurf } = z;
  const [neuBlock, setNeuBlock] = useState('');
  const [neuFrage, setNeuFrage] = useState<Record<string, string>>({});
  const [messungWahl, setMessungWahl] = useState<Record<string, MessungId | ''>>({});
  const gespeichert = api.crm?.stand.scoring;
  if (!e || !daten) return <Karte i={i}><div style={klein}>{z.fehler || 'Lädt die Einstellungen …'}</div></Karte>;
  const s = e[seite];
  const max = maxPunkte(e, seite);
  const musse = new Set(e.sales.muss.flatMap(m => m.kriterien));
  const frei = freieMessungen(e);
  const mql = seite === 'marketing';
  return (
    <>
      <Karte i={i} akzent={mql ? LEUCHT.agenten : LEUCHT.business}>
        <Ueberschrift farbe={mql ? LEUCHT.agenten : LEUCHT.business}>{mql ? 'Marketing-Scoring · bis zum MQL' : 'Sales-Scoring · von MQL zu SQL'}</Ueberschrift>
        <div style={{ ...klein, marginBottom: 12 }}>{mql
          ? 'Signale und Interaktionen, die zeigen, dass jemand ansprechbar ist: Gespräche, Antworten, Events, Make.One, Newsletter mit Double-Opt-in, Empfehlung, Anfrage. Gemessen werden sie aus den Daten — du stellst ein, wie viele Punkte welche Stufe bringt und ab wann ein Lead als MQL (Marketing Qualified Lead) gilt.'
          : 'Die Qualifikation im Gespräch: Fit, Schmerz, Budget, Entscheider, Zeit, Fürsprecher, Prozess, Potenzial (angelehnt an MEDDICC und BANT). Du stellst ein, was gefragt wird, wie viele Punkte jede Stufe bringt, welche Antworten Pflicht sind (Muss) und ab wann ein Lead als SQL (Sales Qualified Lead) gilt.'}</div>
        <div style={{ display: 'flex', gap: '10px 22px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: TYP.body, fontWeight: 600 }}>Mindestpunktzahl {mql ? 'MQL' : 'SQL'}</span>
          <Zahlfeld wert={s.schwelle} onWert={n => setEntwurf(x => { const k = kopie(x); k[seite].schwelle = n; return k; })} min={0} max={1000} schritt={1} aria={`Mindestpunktzahl ${mql ? 'MQL' : 'SQL'}`} />
          <span style={klein}>von höchstens <b style={{ color: C.ink }}>{punkteText(max)}</b> möglichen Punkten{max > 0 ? ` (${Math.round((100 * s.schwelle) / max)} %)` : ''}</span>
          {s.schwelle > max && <Chip farbe={LEUCHT.kritisch}>Schwelle über der Höchstpunktzahl — niemand erreicht sie</Chip>}
        </div>
      </Karte>

      {!mql && <MussEditor e={e} setE={setEntwurf} />}

      {s.teile.map((t, ti) => (
        <Karte key={t.id} i={i + 2 + ti}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', marginBottom: 6 }}>
            <input value={t.name} onChange={ev => setEntwurf(x => { const k = kopie(x); k[seite].teile[ti].name = ev.target.value; return k; })} maxLength={60} aria-label="Name des Blocks" style={{ ...eingabe, fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 17, background: 'transparent', border: '1px solid transparent', padding: '6px 8px' }} />
            <span style={{ fontSize: 12.5, color: C.inkDim, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>Block max. {punkteText(maxPunkte({ ...e, [seite]: { ...s, teile: [t] } } as ScoringEinstellungen, seite))}</span>
          </div>
          {t.kriterien.map((k, ki) => (
            <KriteriumZeile key={k.id} k={k} seite={seite} istMuss={musse.has(k.id)}
              onAender={f => setEntwurf(x => { const n = kopie(x); n[seite].teile[ti].kriterien[ki] = f(n[seite].teile[ti].kriterien[ki]); return n; })}
              onEntfernen={() => setEntwurf(x => kriteriumEntfernen(x, seite, k.id))} />
          ))}
          {!t.kriterien.length && <div style={klein}>Dieser Block hat noch kein Kriterium.</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            {mql ? (
              frei.length > 0 && <>
                <select aria-label="Signal hinzufügen" value={messungWahl[t.id] ?? ''} onChange={ev => setMessungWahl(w => ({ ...w, [t.id]: ev.target.value as MessungId | '' }))} style={{ ...eingabe, width: 'auto', minWidth: 200 }}>
                  <option value="">Signal hinzufügen …</option>
                  {frei.map(m => <option key={m} value={m}>{MESSUNGEN[m].label}</option>)}
                </select>
                <Knopf leise aus={!messungWahl[t.id]} onClick={() => { const m = messungWahl[t.id]; if (m) { setEntwurf(x => kriteriumHinzufuegen(x, 'marketing', t.id, kriteriumAusMessung(x, m))); setMessungWahl(w => ({ ...w, [t.id]: '' })); } }}>+ Hinzufügen</Knopf>
              </>
            ) : (
              <>
                <input value={neuFrage[t.id] ?? ''} onChange={ev => setNeuFrage(w => ({ ...w, [t.id]: ev.target.value }))} placeholder="Neue Frage, z. B. „Referenzkunde“" aria-label="Name der neuen Frage" maxLength={60} style={{ ...eingabe, flex: '1 1 220px', minWidth: 0 }} />
                <Knopf leise aus={!(neuFrage[t.id] ?? '').trim()} onClick={() => { const n = (neuFrage[t.id] ?? '').trim(); if (n) { setEntwurf(x => kriteriumHinzufuegen(x, 'sales', t.id, frageNeu(x, n))); setNeuFrage(w => ({ ...w, [t.id]: '' })); } }}>+ Frage hinzufügen</Knopf>
              </>
            )}
            {s.teile.length > 1 && <button type="button" onClick={() => setEntwurf(x => teilEntfernen(x, seite, t.id))} className="fassbar" style={{ marginLeft: 'auto', minHeight: 44, padding: '6px 12px', background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12.5 }}>Block entfernen</button>}
          </div>
        </Karte>
      ))}

      <Karte i={i + 2 + s.teile.length}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={neuBlock} onChange={ev => setNeuBlock(ev.target.value)} placeholder="Neuer Block, z. B. „Potenzial“" aria-label="Name des neuen Blocks" maxLength={60} style={{ ...eingabe, flex: '1 1 220px', minWidth: 0 }} />
          <Knopf leise aus={!neuBlock.trim() || s.teile.length >= 6} onClick={() => { setEntwurf(x => teilHinzufuegen(x, seite, neuBlock).e); setNeuBlock(''); }}>+ Block hinzufügen</Knopf>
        </div>
      </Karte>

      <TemperaturKarte e={e} setE={setEntwurf} i={i + 3 + s.teile.length} />
      <VorschauKarte api={api} alt={gespeichert} neu={e} i={i + 4 + s.teile.length} />
    </>
  );
}

// ── Aktionsleiste: Speichern, Verwerfen, Vorschlag, Standard, Zurück ─────────────────────────
function Unterschiede({ a, b }: { a: ScoringEinstellungen; b: ScoringEinstellungen }): ReactNode {
  const n = (e: ScoringEinstellungen, s: ScoringSeiteId) => e[s].teile.reduce((x, t) => x + t.kriterien.filter(k => !k.aus).length, 0);
  const z = (t: string, v: number, w: number) => <li key={t}>{t}: <b>{punkteText(v)}</b> → <b>{punkteText(w)}</b></li>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: TYP.bedien, lineHeight: 1.5 }}>
      {z('Marketing: Signale', n(a, 'marketing'), n(b, 'marketing'))}{z('MQL-Schwelle', a.marketing.schwelle, b.marketing.schwelle)}
      {z('Sales: Fragen', n(a, 'sales'), n(b, 'sales'))}{z('SQL-Schwelle', a.sales.schwelle, b.sales.schwelle)}{z('Muss-Regeln', a.sales.muss.length, b.sales.muss.length)}
    </ul>
  );
}

function UebernehmenDialog({ api, art, daten, aktuell, onZu, onJa, laeuft }: { api: CrmApi; art: 'vorschlag' | 'standard'; daten: ScoringDaten; aktuell: ScoringEinstellungen; onZu: () => void; onJa: () => void; laeuft: boolean }) {
  const ziel = art === 'vorschlag' ? daten.vorschlag : daten.standard;
  return (
    <Fenster titel={art === 'vorschlag' ? 'Vorschlag übernehmen' : 'Auf Standard zurück'} onZu={onZu} breit={640}>
      {art === 'vorschlag' ? (
        <div style={klein}>Der Vorschlag schärft die Kriterien nach MEDDICC (Schmerz, Entscheider, Fürsprecher, Prozess, Kennzahl, Wettbewerb) und BANT (Budget, Entscheider, Bedarf, Zeit): je Kriterium vier Stufen mit 1 · 3 · 5 Punkten, Schmerz und Entscheider doppelt gewichtet und als Muss, dazu Fit, Potenzial und im Marketing die Signale Event, Make.One, Newsletter, Termin, Empfehlung, Anfrage. Der Grund steht in SCORING.md.</div>
      ) : (
        <div style={klein}>Der Standard ist die Rechnung von vor dem Umbau: Fit 30 · Wärme 30 · Qualifizierung 30 · Erreichbarkeit 10, SQL bei Schmerz + Entscheider + Budget oder Zeitpunkt.</div>
      )}
      <Unterschiede a={aktuell} b={ziel} />
      <VorschauKarte api={api} alt={api.crm?.stand.scoring} neu={ziel} titel="So würden deine aktuellen Leads dann eingestuft" />
      <div style={klein}>Es gilt sofort für Leads, Akte, Runde und ZOE. „Letzte Änderung zurücknehmen“ bringt die jetzige Fassung zurück.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}><Knopf leise onClick={onZu}>Abbrechen</Knopf><Knopf aus={laeuft} onClick={onJa}>{art === 'vorschlag' ? 'Vorschlag übernehmen' : 'Auf Standard zurück'}</Knopf></div>
    </Fenster>
  );
}

export function ScoringAktionen({ api, z }: { api: CrmApi; z: ScoringEntwurf }) {
  const [dialog, setDialog] = useState<'vorschlag' | 'standard' | null>(null);
  const aktuell = useScoringEinstellungen(api);
  const fehlerText = z.fehlerLive[0]?.text;
  const quelle = z.daten?.einstellungen.quelle;
  const von = z.daten?.verlauf[0];
  return (
    <Karte i={0} style={{ position: 'sticky', bottom: 12, zIndex: 20 }}>
      <div style={{ display: 'grid', gap: 10 }}>
        {z.wiederhergestellt && <div role="status" style={{ ...klein, color: LEUCHT.achtung }}>Dein Entwurf von vorhin ist wieder da — noch nicht gespeichert.</div>}
        {z.hinweis && <div role="status" style={{ fontSize: TYP.bedien, color: LEUCHT.gut }}>✓ {z.hinweis}</div>}
        {z.fehler && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, lineHeight: 1.5 }}>{z.fehler}</div>}
        {!z.fehler && z.geaendert && fehlerText && <div role="alert" style={{ fontSize: TYP.bedien, color: LEUCHT.kritisch, lineHeight: 1.5 }}>{fehlerText}{z.fehlerLive.length > 1 ? ` (+ ${z.fehlerLive.length - 1} weitere)` : ''}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Knopf aus={!z.geaendert || z.laeuft || z.fehlerLive.length > 0} onClick={() => z.speichern()}>{z.geaendert ? 'Speichern' : 'Gespeichert'}</Knopf>
          <Knopf leise aus={!z.geaendert} onClick={z.verwerfen}>Verwerfen</Knopf>
          <span style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,.1)' }} aria-hidden />
          <Knopf leise onClick={() => setDialog('vorschlag')}>Vorschlag übernehmen</Knopf>
          <Knopf leise onClick={() => setDialog('standard')}>Auf Standard zurück</Knopf>
          {z.daten?.zurueckMoeglich && <Knopf leise aus={z.laeuft} onClick={() => z.aktion('zurueck')}>Letzte Änderung zurücknehmen</Knopf>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: C.inkLeise }}>{z.geaendert ? 'Ungespeichert' : `${quelle === 'vorschlag' ? 'Vorschlag' : quelle === 'eigen' ? 'Eigene Fassung' : 'Standard'}${von ? ` · zuletzt ${von.von}, ${von.am.slice(8, 10)}.${von.am.slice(5, 7)}.` : ''}`}</span>
        </div>
      </div>
      {dialog && z.daten && <UebernehmenDialog api={api} art={dialog} daten={z.daten} aktuell={aktuell} laeuft={z.laeuft} onZu={() => setDialog(null)} onJa={async () => { await z.aktion(dialog); setDialog(null); }} />}
    </Karte>
  );
}
