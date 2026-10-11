'use client';

// ─── Routinen 2 (10.10.) — der Routine-Editor ─────────────────────────────────────────────────────────────────────────────────────
// Rückmeldung aus dem Onboarding (10.10.): „mehr Einstellungen bei den einzelnen Routinen — täglich, mehrmals täglich, 1× pro Woche und
// individuell einstellbar.“ EIN Fenster für Anlegen und Ändern: Name, Bereich/Wer/Kategorie, Rhythmus (mit Vorschau der nächsten Termine),
// Tageszeit und feste Uhrzeiten, wie oft am Tag (Zähler), Dauer, Erinnerung, Kalender-Block, Zeitraum, Pausen, Ziel. Jede Wahl mit „i“
// (Erklärung + Beispiel, lib/erklaerungen). Rechnen und Umrechnen NUR in lib/planung (routine-entwurf.ts, rhythmus.ts) — hier nur Darstellung.
// Am Handy (≤ 640 px) ganzflächig (Fenster), eine Spalte, Eingaben 16 px, Ziele ≥ 44 px.

import { KALENDER_UHRZEITEN_MAX } from '@/lib/planung/routinen-erinnerung';
import { kategoriePasst } from '@/lib/planung/routinen';
import { useMemo, useState, type ReactNode } from 'react';
import { Fenster } from '../Fenster';
import { Beschriftung, Feldzeile, Hinweis, Knopf, MehrfachPillen, Pillen, Schalter, Segmente, SymbolKnopf, eingabe, auswahl, LEUCHT } from '../ui';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACE_FARBE } from '@/lib/make-one/space-regeln';
import { OWNER_BEIDE, type IntervallEinheit, type RegelArt, type Routine, type RoutinePause, type SpaceId, type Wochentag } from '@/lib/planung/typen';
import { entwurfAus, entwurfFehler, regelAusEntwurf, routineAusEntwurf, type RoutineEntwurf } from '@/lib/planung/routine-entwurf';
import { regelText, termineIm, WT_KURZ, ROUTINE_GRENZEN } from '@/lib/planung/rhythmus';
import { tagePlus } from '@/lib/planung/zeitraum';
import { PRIVAT_EINHEITEN_NAMEN } from '@/lib/einheiten';
import { EinheitWahl } from '../aufgaben/Einheit';
import { useZieleUndMeilensteine } from '@/lib/planung/ziele-client';

export interface Kategorie { id: Routine['kategorie']; label: string; farbe: string }
interface Person { speicher: string; name: string }

const ARTEN: { id: RegelArt; label: string }[] = [
  { id: 'taeglich', label: 'Täglich' }, { id: 'werktage', label: 'Werktage' }, { id: 'wochentage', label: 'Feste Tage' },
  { id: 'pro-woche', label: 'x-mal pro Woche' }, { id: 'intervall', label: 'Alle x …' }, { id: 'monatlich', label: 'Monatlich' },
];
const WANN: { id: Routine['wann']; label: string }[] = [{ id: 'morgen', label: 'Morgens' }, { id: 'tag', label: 'Tagsüber' }, { id: 'abend', label: 'Abends' }];
const TAGE = ([1, 2, 3, 4, 5, 6, 7] as Wochentag[]).map(t => ({ id: String(t), label: WT_KURZ[t] }));
const GRUENDE: { id: NonNullable<RoutinePause['grund']>; label: string }[] = [{ id: 'urlaub', label: 'Urlaub' }, { id: 'krank', label: 'Krank' }, { id: 'sonst', label: 'Sonstiges' }];
const kurzDatum = (t: string) => `${t.slice(8, 10)}.${t.slice(5, 7)}.`;
const ganz = (v: string, min: number, max: number, sonst: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : sonst; };

/** Stepper − n + mit 44-px-Zielen. */
function Zahlwahl({ wert, min, max, setzen, label, einheit }: { wert: number; min: number; max: number; setzen: (n: number) => void; label: string; einheit?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <SymbolKnopf ariaLabel={`${label}: weniger`} aus={wert <= min} onClick={() => setzen(Math.max(min, wert - 1))}>−</SymbolKnopf>
      <span style={{ minWidth: 56, textAlign: 'center', fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, fontVariantNumeric: 'tabular-nums' }} aria-live="polite" aria-label={`${label}: ${wert}${einheit ? ` ${einheit}` : ''}`}>{wert}{einheit ? <span style={{ color: C.inkDim, fontWeight: 500 }}>{einheit.startsWith('.') ? '' : ' '}{einheit}</span> : null}</span>
      <SymbolKnopf ariaLabel={`${label}: mehr`} aus={wert >= max} onClick={() => setzen(Math.min(max, wert + 1))}>+</SymbolKnopf>
    </span>
  );
}

const Abschnitt = ({ children }: { children: ReactNode }) => <div style={{ display: 'grid', gap: 10, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>{children}</div>;
const Reihe = ({ children }: { children: ReactNode }) => <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
const Leise = ({ children }: { children: ReactNode }) => <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>{children}</span>;

export function RoutineEditor({ routine, vorgabe, heute, ich, personen, kategorien, einheiten, einheitAnlegen, onSpeichern, onZu }: {
  /** null = neue Routine. */
  routine: Routine | null;
  vorgabe?: Partial<RoutineEntwurf>;
  heute: string;
  ich: string;
  personen: readonly Person[];
  kategorien: readonly Kategorie[];
  einheiten: readonly string[];
  einheitAnlegen: (name: string) => Promise<string | null>;
  onSpeichern: (r: Routine) => void;
  onZu: () => void;
}) {
  const [e, setE] = useState<RoutineEntwurf>(() => entwurfAus(routine, vorgabe, heute));
  const [versucht, setVersucht] = useState(false);
  const [pause, setPause] = useState<RoutinePause>({ von: heute, bis: tagePlus(heute, 6), grund: 'urlaub' });
  const neu = !routine;
  const setze = (p: Partial<RoutineEntwurf>) => setE(x => ({ ...x, ...p }));
  const fehler = entwurfFehler(e);
  const ziele = useZieleUndMeilensteine();
  const zielListe = useMemo(() => (ziele?.ziele ?? []).filter(z => !z.erledigt && !z.archiviertAm && (z.horizont === 'jahr' || z.horizont === 'quartal') && (!z.space || z.space === e.space)), [ziele, e.space]);

  // Vorschau: der Rhythmus als Satz und die nächsten Termine (feste Tage) — gerechnet in lib/planung/rhythmus.ts.
  const vorschau = useMemo(() => {
    const g = regelAusEntwurf(e);
    if (e.art === 'wochentage' && !e.tage.length) return 'Bitte Tage wählen.';
    const naechste = g.art === 'werktage' || g.art === 'wochentage' || g.art === 'monatlich' ? termineIm(g, heute, tagePlus(heute, 400)).slice(0, 3) : [];
    // Die Daten enden selbst mit einem Punkt („19.10.“) — dann keiner mehr dahinter.
    return naechste.length ? `${regelText(g)} — nächste: ${naechste.map(kurzDatum).join(' · ')}` : `${regelText(g)}.`;
  }, [e, heute]);

  const speichern = () => {
    setVersucht(true);
    if (fehler.length) return;
    onSpeichern(routineAusEntwurf(e, routine ?? { id: '', aktiv: true, angelegtAm: heute }));
  };
  const mindestZiel = e.uhrzeiten.length >= 2 ? e.uhrzeiten.length : 1;

  return (
    <Fenster titel={neu ? 'Neue Routine' : 'Routine einstellen'} onZu={onZu} breit={640}>
      <Feldzeile label="Name">
        <input value={e.label} onChange={x => setze({ label: x.target.value })} maxLength={120} placeholder="z. B. Wasser trinken · Laufen · Wochenplan" style={eingabe} autoFocus={neu} />
      </Feldzeile>

      <Abschnitt>
        <Beschriftung>Bereich, Person, Kategorie</Beschriftung>
        <Segmente liste={[{ id: 'privat' as SpaceId, label: 'Privat' }, { id: 'business' as SpaceId, label: 'Business' }]} aktiv={e.space}
          onWahl={s => setze({ space: s, einheit: '', kategorie: s === 'business' ? 'business' : e.kategorie === 'business' ? 'leben' : e.kategorie })} farbe={SPACE_FARBE[e.space]} />
        {e.space === 'business' && <Reihe><EinheitWahl wert={e.einheit || undefined} setzen={x => setze({ einheit: x ?? '' })} einheiten={einheiten} anlegen={einheitAnlegen} titel="Einheit der Routine" /></Reihe>}
        {e.space === 'privat' && PRIVAT_EINHEITEN_NAMEN.length > 0 && (
          <select value={e.einheit} onChange={x => setze({ einheit: x.target.value })} aria-label="Einheit der Routine (Privat)" style={auswahl}>
            <option value="">ohne Einheit</option>
            {PRIVAT_EINHEITEN_NAMEN.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <Pillen liste={[{ id: OWNER_BEIDE, label: 'gemeinsam' }, ...personen.map(p => ({ id: p.speicher, label: p.speicher === ich ? `${p.name} (ich)` : p.name }))]} aktiv={e.owner}
          onWahl={o => setze({ owner: o, ...(o === OWNER_BEIDE ? { kalender: false } : {}) })} farbe={LEUCHT.puls} />
        {/* Prüf-Fund 11.10.: im Business nur die Kategorie „Business“ — Gesundheit/Erholung sind Privat (der Server verschiebt sie sonst nach Privat). */}
        <Pillen liste={kategorien.filter(k => kategoriePasst(e.space, k.id)).map(k => ({ id: k.id, label: k.label }))} aktiv={e.kategorie} onWahl={k => setze({ kategorie: k })}
          farbe={kategorien.find(k => k.id === e.kategorie)?.farbe} />
      </Abschnitt>

      <Abschnitt>
        <Beschriftung erklaerung="routinen.rhythmus">Rhythmus</Beschriftung>
        <Pillen liste={ARTEN} aktiv={e.art} onWahl={a => setze({ art: a })} />
        {e.art === 'wochentage' && (<>
          <MehrfachPillen liste={TAGE} aktiv={e.tage.map(String)} onWahl={ids => setze({ tage: ids.map(Number).sort((a, b) => a - b) as Wochentag[] })} />
          <Reihe><Leise>Nur jede</Leise><Zahlwahl label="Wochen-Abstand" wert={e.alleWochen} min={1} max={ROUTINE_GRENZEN.wochenAlle} setzen={n => setze({ alleWochen: n })} einheit={e.alleWochen === 1 ? 'Woche' : '. Woche'} /></Reihe>
          {e.alleWochen > 1 && <Feldzeile label="Gezählt ab"><input type="date" value={e.start} onChange={x => setze({ start: x.target.value })} style={{ ...eingabe, colorScheme: 'dark' }} /></Feldzeile>}
        </>)}
        {e.art === 'pro-woche' && <Reihe><Zahlwahl label="Mal pro Woche" wert={e.proWoche} min={1} max={ROUTINE_GRENZEN.proWoche} setzen={n => setze({ proWoche: n })} einheit="× pro Woche" /></Reihe>}
        {e.art === 'intervall' && (<>
          <Reihe>
            <Leise>Alle</Leise>
            <input type="number" inputMode="numeric" min={1} value={e.alle} onChange={x => setze({ alle: ganz(x.target.value, 1, e.einheitIntervall === 'tag' ? ROUTINE_GRENZEN.alleTage : e.einheitIntervall === 'woche' ? ROUTINE_GRENZEN.alleWochen : ROUTINE_GRENZEN.alleMonate, e.alle) })}
              aria-label="Abstand" style={{ ...eingabe, width: 96 }} />
            <Segmente liste={[{ id: 'tag' as IntervallEinheit, label: 'Tage' }, { id: 'woche' as IntervallEinheit, label: 'Wochen' }, { id: 'monat' as IntervallEinheit, label: 'Monate' }]} aktiv={e.einheitIntervall} onWahl={x => setze({ einheitIntervall: x })} />
          </Reihe>
          <Feldzeile label="Nächstes Mal am (leer: ab heute dran)"><input type="date" value={e.naechstesMal} onChange={x => setze({ naechstesMal: x.target.value })} style={{ ...eingabe, colorScheme: 'dark' }} /></Feldzeile>
        </>)}
        {e.art === 'monatlich' && (<>
          <Segmente liste={[{ id: 'tag' as const, label: 'Tag im Monat' }, { id: 'nter' as const, label: 'n-ter Wochentag' }]} aktiv={e.monatModus} onWahl={m => setze({ monatModus: m })} />
          {e.monatModus === 'tag'
            ? <Reihe><Leise>am</Leise><Zahlwahl label="Tag im Monat" wert={e.monatstag} min={1} max={31} setzen={n => setze({ monatstag: n })} einheit="." /></Reihe>
            : <Reihe>
              <select value={e.nterN} onChange={x => setze({ nterN: Number(x.target.value) as RoutineEntwurf['nterN'] })} aria-label="Welcher" style={auswahl}>
                {[1, 2, 3, 4, -1].map(n => <option key={n} value={n}>{n === -1 ? 'letzter' : `${n}.`}</option>)}
              </select>
              <select value={e.nterTag} onChange={x => setze({ nterTag: Number(x.target.value) as Wochentag })} aria-label="Wochentag" style={auswahl}>
                {TAGE.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Reihe>}
          <Reihe><Leise>alle</Leise><Zahlwahl label="Monats-Abstand" wert={e.alleMonate} min={1} max={ROUTINE_GRENZEN.monateAlle} setzen={n => setze({ alleMonate: n })} einheit={e.alleMonate === 1 ? 'Monat' : 'Monate'} /></Reihe>
          {e.alleMonate > 1 && <Feldzeile label="Gezählt ab"><input type="date" value={e.start} onChange={x => setze({ start: x.target.value })} style={{ ...eingabe, colorScheme: 'dark' }} /></Feldzeile>}
        </>)}
        <Leise>{vorschau}</Leise>
      </Abschnitt>

      <Abschnitt>
        <Beschriftung>Tageszeit</Beschriftung>
        <Pillen liste={WANN} aktiv={e.wann} onWahl={w => setze({ wann: w })} />
        <Feldzeile label="Feste Uhrzeiten (optional)" erklaerung="routinen.uhrzeiten">
          <div style={{ display: 'grid', gap: 8 }}>
            {e.uhrzeiten.map((u, i) => (
              <Reihe key={i}>
                <input type="time" value={u} onChange={x => setze({ uhrzeiten: e.uhrzeiten.map((y, j) => (j === i ? x.target.value : y)) })} aria-label={`Uhrzeit ${i + 1}`} style={{ ...eingabe, width: 140, colorScheme: 'dark' }} />
                <SymbolKnopf ariaLabel={`Uhrzeit ${i + 1} entfernen`} gefahr onClick={() => setze({ uhrzeiten: e.uhrzeiten.filter((_, j) => j !== i) })}>×</SymbolKnopf>
              </Reihe>
            ))}
            {e.uhrzeiten.length < ROUTINE_GRENZEN.uhrzeiten && <Reihe><Knopf leise onClick={() => setze({ uhrzeiten: [...e.uhrzeiten, e.uhrzeiten.length ? '20:00' : '08:00'] })}>+ Uhrzeit</Knopf></Reihe>}
          </div>
        </Feldzeile>
      </Abschnitt>

      <Abschnitt>
        <Feldzeile label="Wie oft am Tag" erklaerung="routinen.zaehler">
          <div style={{ display: 'grid', gap: 8 }}>
            <Reihe><Zahlwahl label="Tagesziel" wert={Math.max(e.tagesZiel, mindestZiel)} min={mindestZiel} max={ROUTINE_GRENZEN.tagesZiel} setzen={n => setze({ tagesZiel: n })} einheit={Math.max(e.tagesZiel, mindestZiel) === 1 ? 'mal' : '×'} /></Reihe>
            {Math.max(e.tagesZiel, mindestZiel) > 1 && <input value={e.zaehlWort} onChange={x => setze({ zaehlWort: x.target.value })} maxLength={ROUTINE_GRENZEN.zaehlWort} placeholder="Wort für den Zähler, z. B. Gläser" aria-label="Wort für den Zähler" style={eingabe} />}
          </div>
        </Feldzeile>
        <Reihe><Leise>Dauer</Leise><Zahlwahl label="Dauer" wert={e.dauerMin} min={5} max={120} setzen={n => setze({ dauerMin: Math.round(n / 5) * 5 || 5 })} einheit="min" /></Reihe>
      </Abschnitt>

      <Abschnitt>
        <Schalter erklaerung="routinen.erinnerung" an={e.erinnerung} onChange={v => setze({ erinnerung: v })}>Erinnern, wenn sie dran ist</Schalter>
        <Schalter erklaerung="routinen.kalender" an={e.kalender} aus={e.owner === OWNER_BEIDE} onChange={v => setze({ kalender: v })}>Als Block in meinen Kalender</Schalter>
        {e.owner === OWNER_BEIDE && <Leise>Kalender-Blöcke gibt es nur für die Routine einer Person.</Leise>}
        {e.kalender && e.owner !== OWNER_BEIDE && e.uhrzeiten.length > KALENDER_UHRZEITEN_MAX && (
          <Leise>Bei mehr als {KALENDER_UHRZEITEN_MAX} Uhrzeiten steht je Tag nur EIN Block im Kalender (zur ersten Uhrzeit) — sonst wäre er voll. Erinnern kann die Routine weiter zu jeder Uhrzeit.</Leise>
        )}
      </Abschnitt>

      <Abschnitt>
        <Feldzeile label="Zeitraum (von – bis, optional)" erklaerung="routinen.zeitraum">
          <Reihe>
            <input type="date" value={e.von} onChange={x => setze({ von: x.target.value })} aria-label="Gilt ab" style={{ ...eingabe, width: 'auto', flex: '1 1 140px', colorScheme: 'dark' }} />
            <input type="date" value={e.bis} onChange={x => setze({ bis: x.target.value })} aria-label="Gilt bis" style={{ ...eingabe, width: 'auto', flex: '1 1 140px', colorScheme: 'dark' }} />
          </Reihe>
        </Feldzeile>
        <Beschriftung erklaerung="routinen.pause">Pausen</Beschriftung>
        {e.pausen.map((p, i) => (
          <Reihe key={`${p.von}-${p.bis}-${i}`}>
            <span style={{ fontSize: TYP.body, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>{kurzDatum(p.von)} – {kurzDatum(p.bis)}</span>
            <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{GRUENDE.find(g => g.id === p.grund)?.label ?? 'Pause'}</span>
            <SymbolKnopf ariaLabel="Pause entfernen" gefahr onClick={() => setze({ pausen: e.pausen.filter((_, j) => j !== i) })}>×</SymbolKnopf>
          </Reihe>
        ))}
        {e.pausen.length < ROUTINE_GRENZEN.pausen && (
          <Reihe>
            <input type="date" value={pause.von} onChange={x => setPause({ ...pause, von: x.target.value })} aria-label="Pause ab" style={{ ...eingabe, width: 'auto', flex: '1 1 130px', colorScheme: 'dark' }} />
            <input type="date" value={pause.bis} onChange={x => setPause({ ...pause, bis: x.target.value })} aria-label="Pause bis" style={{ ...eingabe, width: 'auto', flex: '1 1 130px', colorScheme: 'dark' }} />
            <select value={pause.grund} onChange={x => setPause({ ...pause, grund: x.target.value as RoutinePause['grund'] })} aria-label="Grund der Pause" style={auswahl}>
              {GRUENDE.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <Knopf leise aus={!pause.von || !pause.bis || pause.bis < pause.von} onClick={() => setze({ pausen: [...e.pausen, pause].sort((a, b) => a.von.localeCompare(b.von)) })}>Pause eintragen</Knopf>
          </Reihe>
        )}
      </Abschnitt>

      <Abschnitt>
        <Feldzeile label="Zahlt ein auf (optional)" erklaerung="routinen.ziel">
          <select value={e.zielId} onChange={x => setze({ zielId: x.target.value })} style={{ ...auswahl, width: '100%' }}>
            <option value="">kein Ziel</option>
            {zielListe.map(z => <option key={z.id} value={z.id}>{z.titel}</option>)}
            {e.zielId && !zielListe.some(z => z.id === e.zielId) && <option value={e.zielId}>gewähltes Ziel</option>}
          </select>
        </Feldzeile>
      </Abschnitt>

      {versucht && fehler.length > 0 && <Hinweis art="achtung" titel="Noch nicht speicherbar">{fehler.join(' ')}</Hinweis>}
      <Reihe>
        <Knopf haupt onClick={speichern}>{neu ? 'Routine anlegen' : 'Speichern'}</Knopf>
        <Knopf leise onClick={onZu}>Abbrechen</Knopf>
      </Reihe>
    </Fenster>
  );
}
