'use client';

// ─── Sport — Training: alle Einheiten aller Quellen je Woche (09.10.2026) ────────────────────────────────────────────────
// Kevin 09.10.: „Die Trainingsdaten fehlen ihr.“ Hier steht jede Einheit — von Hand (Lauf, Gym, Hyrox, Training) und aus WHOOP (später
// Strava) — ohne Doppelte, je Woche mit Summe. Gelesen wird NUR über `alleEinheiten` (lib/sport/training.ts). An jeder importierten Einheit
// setzt die Person „zählt als“, Gefühl und Notiz; ein erneuter Abgleich lässt das stehen. Handy zuerst (Zeilen statt Tabelle).
// Erfassung und Struktur, keine Trainingsberatung.

import { useMemo, useState, type FormEvent } from 'react';
import { FARBE as C, TYP, SCHRIFT, RAND } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Knopf, Chip, Zahl, Balken, Leer, Pillen as UiPillen, auswahl, useRueckfrage } from '../ui';
import { Flaeche, Kachel } from '../flaeche/Flaeche';
import { Feld, Raster, Zahlfeld, Skala, Hinweis, klein, de, datumKurz, KLASSE_FARBE, ZONE_FARBE, ZonenBalken, quelleText } from './teile';
import { KLASSEN, KLASSE_LABEL, SPARTEN, WOCHENTAG_LABEL, neueId, zaehltAlsTraining, type Klasse, type Op, type Sparte, type SportStand, type Vorlage } from '@/lib/sport/modell';
import { alleEinheiten, inWoche, summe, wochenListe, sportartenUebersicht, klasseVonSport, type Einheit } from '@/lib/sport/training';
import { montagVon, tagPlus } from '@/lib/sport/pace';
import { wochentagVon } from '@/lib/sport/plan';

type Reiter = 'hyrox' | 'lauf' | 'gym';
const REITER_VON: Partial<Record<Einheit['herkunft'], Reiter>> = { lauf: 'lauf', gym: 'gym', hyrox: 'hyrox' };
const REITER_NAME: Record<Reiter, string> = { lauf: 'Running', gym: 'Gym', hyrox: 'Hyrox' };
const F = C.aktiv;
const stunden = (min: number) => `${de(min / 60)} h`;

export function TrainingTeil({ stand, heute, vorlagen, schicke, onReiter }: {
  stand: SportStand; heute: string; vorlagen: readonly Vorlage[];
  schicke: (ops: Op[], erfolg?: string) => Promise<boolean>; onReiter: (r: Reiter) => void;
}) {
  const namen = useMemo(() => Object.fromEntries([...vorlagen, ...stand.gym.vorlagen].map(v => [v.id, v.name])), [vorlagen, stand.gym.vorlagen]);
  const alle = useMemo(() => alleEinheiten(stand, namen), [stand, namen]);
  const gruppen = useMemo(() => wochenListe(alle, heute, 8), [alle, heute]);
  const verlauf = useMemo(() => Array.from({ length: 8 }, (_, i) => { const m = tagPlus(montagVon(heute), -7 * (7 - i)); return { montag: m, s: summe(inWoche(alle, m)) }; }), [alle, heute]);
  const diese = verlauf[verlauf.length - 1].s;
  const sportarten = useMemo(() => sportartenUebersicht(stand), [stand]);
  const [offen, setOffen] = useState<string | null>(null);
  const [neu, setNeu] = useState(false);
  const [alleWochen, setAlleWochen] = useState(false);
  const { bestaetigen, dialog } = useRueckfrage();

  return (
    <>
      <Flaeche seite="sport-training">
      <Kachel id="woche" titel="Diese Woche" breite={6}>
      <Karte i={0} ton={F}>
        <Ueberschrift farbe={F} rechts={`ab ${datumKurz(montagVon(heute))}`}>Diese Woche</Ueberschrift>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
          <Zahl wert={diese.einheiten ? String(diese.einheiten) : undefined} label="Einheiten" farbe={F} />
          <Zahl wert={diese.minuten ? stunden(diese.minuten) : undefined} label="Trainingszeit" />
          <Zahl wert={diese.strain !== undefined ? de(diese.strain) : undefined} label="Strain-Summe" />
          <Zahl wert={diese.kcal ? de(diese.kcal, 0) : undefined} label="kcal" />
        </div>
        {diese.einheiten > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {SPARTEN.filter(s => diese.je[s]).map(s => <Chip key={s} farbe={KLASSE_FARBE[s]}>{KLASSE_LABEL[s]} {diese.je[s]}</Chip>)}
          </div>
        )}
        {diese.zonenMin && <div style={{ marginTop: 12 }}><ZonenBalken zonen={diese.zonenMin} hoehe={10} /><ZonenText zonen={diese.zonenMin} /></div>}
        <div style={{ marginTop: 14 }}>
          <Balken werte={verlauf.map(w => (w.s.einheiten ? w.s.einheiten : null))} max={Math.max(1, ...verlauf.map(w => w.s.einheiten))} farbe={F} hoehe={48}
            titel={verlauf.map(w => `ab ${datumKurz(w.montag)} · ${w.s.einheiten} Einheiten · ${stunden(w.s.minuten)}${w.s.strain !== undefined ? ` · Strain ${de(w.s.strain)}` : ''}`)} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>Einheiten je Woche · 8 Wochen</div>
        </div>
      </Karte>
      </Kachel>

      <Kachel id="einheiten" titel="Einheiten" breite={6}>
      <Karte i={1}>
        <Ueberschrift rechts={<button type="button" onClick={() => setNeu(n => !n)} style={{ all: 'unset', cursor: 'pointer', color: C.aktiv, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, padding: '0 8px', boxSizing: 'border-box' }}>{neu ? 'Schließen' : '+ Training'}</button>}>Einheiten</Ueberschrift>
        {neu && <TrainingFormular heute={heute} onSpeichern={async e => { const ok = await schicke([{ op: 'training', eintrag: e }], 'Training gespeichert.'); if (ok) setNeu(false); return ok; }} />}
        {!gruppen.length && !neu && <Leer>Noch keine Einheiten in den letzten 8 Wochen. Mit WHOOP kommen sie von selbst; sonst „+ Training“ oder Läufe, Gym und Hyrox in ihren Reitern.</Leer>}
        {(alleWochen ? gruppen : gruppen.slice(0, 3)).map(g => (
          <section key={g.montag} aria-label={`Woche ab ${datumKurz(g.montag)}`} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '8px 0', borderBottom: `1px solid ${RAND.flaeche}` }}>
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body }}>{g.montag === montagVon(heute) ? 'Diese Woche' : `Woche ab ${datumKurz(g.montag)}`}</span>
              <span style={{ fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>{g.summe.einheiten} Einheit{g.summe.einheiten === 1 ? '' : 'en'} · {stunden(g.summe.minuten)}{g.summe.strain !== undefined ? ` · Strain ${de(g.summe.strain)}` : ''}</span>
            </div>
            {g.einheiten.map(e => (
              <EinheitZeile key={e.id} e={e} eigene={stand.sportArten} offen={offen === e.id} onOffen={() => setOffen(o => (o === e.id ? null : e.id))} schicke={schicke} onReiter={onReiter}
                onEntfernen={async () => { if (await bestaetigen({ titel: 'Training entfernen?', text: 'Die von Hand erfasste Einheit fällt weg.', ja: 'Entfernen', gefahr: true })) { void schicke([{ op: 'training-weg', id: e.id }], 'Entfernt.'); setOffen(null); } }} />
            ))}
          </section>
        ))}
        {gruppen.length > 3 && <div style={{ marginTop: 10 }}><Knopf leise onClick={() => setAlleWochen(a => !a)}>{alleWochen ? 'Weniger Wochen' : `Alle ${gruppen.length} Wochen zeigen`}</Knopf></div>}
        <Hinweis>Erfassung und Überblick — keine Trainingsberatung. Strain-Summe = Summe der Einheiten (WHOOP-Skala 0–21 je Einheit), nicht die Tagesbelastung.</Hinweis>
      </Karte>
      </Kachel>

      <Kachel id="sportarten" titel="Sportarten zuordnen" breite={6}>
      {sportarten.length > 0 && (
        <Karte i={2}>
          <Ueberschrift>Sportarten zuordnen</Ueberschrift>
          <p style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '0 0 8px', lineHeight: 1.5 }}>Als was zählt eine Sportart aus WHOOP? „Erholung“ und „Alltag“ stehen in der Liste, zählen aber nicht als Training. Eine einzelne Einheit stellst du direkt an der Einheit um.</p>
          {sportarten.map(s => (
            <div key={s.schluessel} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 0', borderBottom: `1px solid ${RAND.flaeche}` }}>
              <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                <div style={{ fontSize: TYP.body, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{s.anzahl ? `${s.anzahl} Einheit${s.anzahl === 1 ? '' : 'en'}` : 'gerade keine'}{s.eigen ? ` · Vorgabe ${KLASSE_LABEL[s.vorgabe]}` : ''}</div>
              </div>
              <select aria-label={`${s.name} zählt als`} value={s.klasse} style={auswahl}
                onChange={ev => { const k = ev.target.value as Klasse; void schicke([{ op: 'sportart', sport: s.schluessel, klasse: k === s.vorgabe ? null : k }], `${s.name}: ${KLASSE_LABEL[k]}.`); }}>
                {KLASSEN.map(k => <option key={k} value={k}>{KLASSE_LABEL[k]}{zaehltAlsTraining(k) ? '' : ' (zählt nicht)'}</option>)}
              </select>
            </div>
          ))}
        </Karte>
      )}
      </Kachel>
      </Flaeche>
      {dialog}
    </>
  );
}

function ZonenText({ zonen }: { zonen: readonly number[] }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6, fontSize: TYP.bedien, color: C.inkDim, fontVariantNumeric: 'tabular-nums' }}>
      {zonen.map((m, i) => (m > 0 ? <span key={i}><span aria-hidden style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: ZONE_FARBE[i], marginRight: 5 }} />Zone {i} · {de(m, 0)} min</span> : null))}
    </div>
  );
}

function EinheitZeile({ e, eigene, offen, onOffen, schicke, onReiter, onEntfernen }: {
  e: Einheit; eigene?: SportStand['sportArten']; offen: boolean; onOffen: () => void; schicke: (ops: Op[], erfolg?: string) => Promise<boolean>; onReiter: (r: Reiter) => void; onEntfernen: () => void;
}) {
  const farbe = KLASSE_FARBE[e.klasse];
  const meta = [
    e.dauerMin ? `${de(e.dauerMin, 0)} min` : null,
    e.distanzKm ? `${de(e.distanzKm, 2)} km` : null,
    e.strain !== undefined ? `Strain ${de(e.strain)}` : null,
    e.kcal ? `${de(e.kcal, 0)} kcal` : null,
    e.pulsSchnitt ? `Ø ${e.pulsSchnitt}${e.pulsMax ? ` / max ${e.pulsMax}` : ''} bpm` : null,
  ].filter(Boolean).join(' · ');
  const reiter = REITER_VON[e.herkunft];
  return (
    <div style={{ borderBottom: `1px solid ${RAND.flaeche}`, opacity: e.zaehlt ? 1 : 0.75 }}>
      <button type="button" onClick={onOffen} aria-expanded={offen} className="fassbar" style={{ all: 'unset', boxSizing: 'border-box', display: 'grid', gap: 4, width: '100%', minHeight: 56, padding: '10px 0', cursor: 'pointer' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise, fontVariantNumeric: 'tabular-nums' }}>{WOCHENTAG_LABEL[wochentagVon(e.datum)]} {datumKurz(e.datum)}{e.uhrzeit ? ` · ${e.uhrzeit}` : ''}</span>
          <Chip farbe={farbe}>{KLASSE_LABEL[e.klasse]}{e.zaehlt ? '' : ' · zählt nicht'}</Chip>
        </div>
        <div style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, overflowWrap: 'anywhere' }}>{e.titel}</div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.45 }}>{meta ? `${meta} · ` : ''}<span style={{ color: C.inkLeise }}>{quelleText(e.quelle, e.auch)}</span>{e.gefuehl ? ` · Gefühl ${e.gefuehl}/5` : ''}</div>
        {e.zonenMin && <ZonenBalken zonen={e.zonenMin} />}
        {e.notiz && !offen && <div style={{ fontSize: TYP.bedien, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.notiz}</div>}
      </button>
      {offen && (
        <div style={{ padding: '4px 0 14px', display: 'grid', gap: 12 }}>
          {e.zonenMin && <ZonenText zonen={e.zonenMin} />}
          {(e.hoeheM || e.pulsMax) && <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{[e.hoeheM ? `${de(e.hoeheM, 0)} Höhenmeter` : null, e.pulsMax ? `Puls max ${e.pulsMax}` : null].filter(Boolean).join(' · ')}</div>}
          {e.herkunft === 'training' ? (
            <>
              <Feld label="Zählt als">
                <UiPillen liste={KLASSEN.map(k => ({ id: k, label: KLASSE_LABEL[k] }))} aktiv={e.klasse} farbe={farbe}
                  onWahl={k => void schicke([{ op: 'training-anmerken', id: e.id, art: e.quelle !== 'hand' && e.sport && k === klasseVonSport(e.sport, eigene) ? null : k }], `Zählt als ${KLASSE_LABEL[k]}.`)} />
              </Feld>
              <Feld label="Gefühl (1 zäh … 5 stark)"><Skala wert={e.gefuehl} onWert={n => void schicke([{ op: 'training-anmerken', id: e.id, gefuehl: n }], 'Gespeichert.')} /></Feld>
              <NotizFeld notiz={e.notiz} onSpeichern={n => schicke([{ op: 'training-anmerken', id: e.id, notiz: n || null }], n ? 'Notiz gespeichert.' : 'Notiz entfernt.')} />
              {e.quelle === 'hand' && <div><Knopf leise onClick={onEntfernen}>Training entfernen</Knopf></div>}
            </>
          ) : reiter ? (
            <div><Knopf leise onClick={() => onReiter(reiter)}>Im Reiter {REITER_NAME[reiter]} bearbeiten ›</Knopf></div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function NotizFeld({ notiz, onSpeichern }: { notiz?: string; onSpeichern: (n: string) => Promise<boolean> }) {
  const [text, setText] = useState(notiz ?? '');
  const absenden = (ev: FormEvent) => { ev.preventDefault(); if (text.trim() !== (notiz ?? '')) void onSpeichern(text.trim()); };
  return (
    <form onSubmit={absenden} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 200px', minWidth: 0 }}><Feld label="Notiz"><input value={text} onChange={ev => setText(ev.target.value)} maxLength={600} placeholder="Was lief, was nicht" style={klein} /></Feld></div>
      <Knopf leise typ="submit" aus={text.trim() === (notiz ?? '')}>Speichern</Knopf>
    </form>
  );
}

interface Entwurf { id: string; datum: string; art: Sparte; sport: string; dauerMin?: number; gefuehl?: number; notiz?: string }
/** Hand-Sparten im Formular — Läufe, Gym mit Sätzen und Hyrox mit Stationen haben ihre eigenen Reiter (dort ist mehr zu erfassen). */
const HAND_SPARTEN: Sparte[] = ['rad', 'ausdauer', 'mobility', 'hyrox', 'gym', 'lauf', 'sonstiges'];

function TrainingFormular({ heute, onSpeichern }: { heute: string; onSpeichern: (e: Entwurf) => Promise<boolean> }) {
  const [e, setE] = useState<Entwurf>({ id: neueId('tr'), datum: heute, art: 'rad', sport: '' });
  const ok = !!e.datum && !!e.dauerMin;
  const absenden = (ev: FormEvent) => { ev.preventDefault(); if (ok) void onSpeichern({ ...e, sport: e.sport.trim() || KLASSE_LABEL[e.art] }); };
  return (
    <form onSubmit={absenden} style={{ padding: '4px 0 14px', borderBottom: `1px solid ${RAND.flaeche}`, marginBottom: 6 }}>
      <Raster min={150}>
        <Feld label="Datum"><input type="date" value={e.datum} max={heute} onChange={ev => setE(x => ({ ...x, datum: ev.target.value }))} style={{ ...klein, colorScheme: 'dark' }} /></Feld>
        <Feld label="Dauer"><Zahlfeld wert={e.dauerMin} onWert={n => setE(x => ({ ...x, dauerMin: n ? Math.round(n) : undefined }))} einheit="min" placeholder="z. B. 60" /></Feld>
        <Feld label="Zählt als" breit><UiPillen liste={HAND_SPARTEN.map(s => ({ id: s, label: KLASSE_LABEL[s] }))} aktiv={e.art} farbe={KLASSE_FARBE[e.art]} onWahl={art => setE(x => ({ ...x, art }))} /></Feld>
        <Feld label="Bezeichnung" breit><input value={e.sport} onChange={ev => setE(x => ({ ...x, sport: ev.target.value }))} maxLength={60} placeholder={`z. B. ${KLASSE_LABEL[e.art]}`} style={klein} /></Feld>
        <Feld label="Gefühl (1 zäh … 5 stark)" breit><Skala wert={e.gefuehl} onWert={n => setE(x => ({ ...x, gefuehl: n }))} /></Feld>
        <Feld label="Notiz" breit><input value={e.notiz ?? ''} onChange={ev => setE(x => ({ ...x, notiz: ev.target.value || undefined }))} maxLength={600} placeholder="Was lief, was nicht" style={klein} /></Feld>
      </Raster>
      <Hinweis>Läufe mit Distanz, Gym mit Sätzen und Hyrox mit Stationszeiten erfasst du in ihren Reitern — dort steht mehr drin.</Hinweis>
      <div style={{ marginTop: 10 }}><Knopf typ="submit" farbe={KLASSE_FARBE[e.art]} aus={!ok}>Training anlegen</Knopf></div>
    </form>
  );
}
