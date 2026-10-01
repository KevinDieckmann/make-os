'use client';

// ─── MAKE OS — Meilenstein anlegen und bearbeiten (30.09.) ──────────────────
// Kevin & Malin tragen ab 01.10. die Planung ein — schnell, auch fürs nächste
// Jahr: ein Fenster, das vom Zeitstrahl (Klick auf eine Stelle, „+ Meilenstein“,
// Klick auf einen Marker) und aus der Liste geöffnet wird. Felder, soweit das
// Modell sie hat: Titel, Datum, Privat/Business, Einheit (nur Business, Werteliste
// je Haushalt aus lib/planung/einheiten.ts), Mandat (Chip), Ziel-Bezug, Fortschritt,
// erledigt, Messlatte. Geschrieben wird NUR über den vorhandenen Schreibweg
// (usePlanung.persistMs → PATCH /api/state/meilensteine mit Stand) — keinen zweiten.
// „Speichern + nächster“: das Fenster bleibt offen, Datum, Bereich und Einheit
// bleiben stehen — mehrere Meilensteine hintereinander.
// Löschen nur mit „Rückgängig“ (wie Aufgaben); Abgeleitetes (aus einem Jahresziel
// mit Termin) wird beim Ändern „angepasst“ und erst danach löschbar.
// Aufgaben-Logik gehört NICHT hierher (Paket „meilensteine“: Detailseite).

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { WEG } from '@/lib/wege';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SPACE_LABEL, SPACE_FARBE, type SpaceId } from '@/lib/make-one/space-regeln';
import { bereichAusSpace, meilensteinSpace } from '@/lib/planung/meilensteine';
import { naechsterRang, offenErledigt } from '@/lib/planung/rang';
import { zielJahr } from '@/lib/planung/zeitstrahl';
import type { Meilenstein, Ziel } from '@/lib/planung/typen';
import { ohneStand } from '@/lib/make-one/liste-stand';
import { neueKennung } from '@/lib/kennung';
import { Fenster } from '../Fenster';
import { Knopf, feld, LEUCHT } from '../schlank';
import { MandatWahl, useMandate } from '../zeit/MandatWahl';
import type { PlanungStand } from './usePlanung';
import type { Rueckgaengig } from './Rueckgaengig';

/** Was das Fenster beim Anlegen vorbelegt (aus Klick-Stelle und aktivem Filter). */
export interface MsVorgabe { faellig?: string; space?: SpaceId; einheit?: string }

interface Form {
  titel: string; faellig: string; space: SpaceId; einheit: string; mandatId: string; zielId: string;
  fortschritt: number; erledigt: boolean; messlatte: string;
  /** Nur beim Anlegen (01.10., Kevin: „dahinter muss etwas sein“): erste Aufgaben, eine je Zeile — echte Aufgaben in der Meilenstein-Liste. */
  aufgaben: string;
}
const AUFGABEN_MAX = 30;
/** Die ersten Aufgaben aus dem Textfeld: je Zeile eine, leer und doppelt raus, höchstens 30, je 300 Zeichen (wie der Schreibweg). */
export function ersteAufgaben(text: string): string[] {
  const seen = new Set<string>();
  return text.split(/\r?\n/).map(z => z.replace(/^\s*[-•*]\s*/, '').trim()).filter(z => z && z.length <= 300 && !seen.has(z.toLowerCase()) && seen.add(z.toLowerCase())).slice(0, AUFGABEN_MAX);
}
/** Legt die Aufgaben nacheinander über den EINEN Schreibweg an (/api/tasks/create mit meilensteinId → seine Liste). */
async function aufgabenAnlegen(meilensteinId: string, titel: string[]): Promise<number> {
  let ok = 0;
  for (const t of titel) {
    try {
      const r = await fetch('/api/tasks/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t, meilensteinId }) });
      if (r.ok) ok++;
    } catch { /* gezählt: die Zahl unten sagt, was fehlt */ }
  }
  return ok;
}
const NEU_EINHEIT = '__neu__';
const wahl: CSSProperties = { ...feld, colorScheme: 'dark', cursor: 'pointer' };
const beschriftung: CSSProperties = { display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: C.inkLeise, minWidth: 0 };
const col = (v: number) => (v >= 70 ? LEUCHT.gut : v >= 40 ? LEUCHT.achtung : LEUCHT.kritisch);

function formAus(m: Meilenstein | null, v: MsVorgabe): Form {
  if (m) {
    const sp = meilensteinSpace(m);
    return { titel: m.titel, faellig: m.faellig ?? '', space: sp, einheit: m.einheit ?? '', mandatId: m.mandatId ?? '', zielId: m.zielId ?? '', fortschritt: m.fortschritt, erledigt: m.erledigt, messlatte: m.messlatte ?? '', aufgaben: '' };
  }
  return { titel: '', faellig: v.faellig ?? '', space: v.space ?? 'business', einheit: v.space === 'privat' ? '' : v.einheit ?? '', mandatId: '', zielId: '', fortschritt: 0, erledigt: false, messlatte: '', aufgaben: '' };
}

export interface MeilensteinFensterApi {
  /** Neu anlegen, vorbelegt. */
  oeffneNeu: (v: MsVorgabe) => void;
  /** Einen bestehenden Meilenstein bearbeiten/verschieben. */
  oeffne: (id: string) => void;
  /** Das Fenster (null, wenn zu) — einmal in die Seite hängen. */
  fenster: ReactNode;
}

/** Das Fenster samt Schreiben über `planung.persistMs`. `rueck` zeigt nach dem Löschen „Rückgängig“. */
export function useMeilensteinFenster(planung: PlanungStand, rueck: Rueckgaengig, heute: string): MeilensteinFensterApi {
  const router = useRouter();
  const [zustand, setZustand] = useState<{ id: string | null; vorgabe: MsVorgabe; runde: number } | null>(null);
  // Der jüngste Stand für Rückgängig (das Zurückholen läuft später, nach anderen Änderungen).
  const stand = useRef(planung); stand.current = planung;

  const oeffneNeu = useCallback((v: MsVorgabe) => setZustand({ id: null, vorgabe: v, runde: Date.now() }), []);
  const oeffne = useCallback((id: string) => setZustand({ id, vorgabe: {}, runde: Date.now() }), []);

  const bestehend = zustand?.id ? planung.ms.find(m => m.id === zustand.id) ?? null : null;

  /** Speichert; bei einem neuen Meilenstein die Kennung (sonst null). */
  const speichern = (f: Form): Meilenstein | null => {
    const p = stand.current;
    const business = f.space === 'business';
    const felder = {
      titel: f.titel.trim().slice(0, 200), space: f.space, bereich: bereichAusSpace(f.space),
      faellig: f.faellig || undefined, fortschritt: f.erledigt ? 100 : f.fortschritt, erledigt: f.erledigt,
      einheit: business && f.einheit ? f.einheit : undefined,
      mandatId: business && f.mandatId ? f.mandatId : undefined,
      zielId: f.zielId || undefined,
      messlatte: f.messlatte.trim() ? f.messlatte.trim().slice(0, 300) : undefined,
    };
    if (bestehend) {
      p.persistMs(p.ms.map(m => (m.id !== bestehend.id ? m : {
        ...m, ...felder,
        erledigtAm: f.erledigt ? (m.erledigtAm ?? heute) : undefined,
        // Mandat weg → auch die abgeleitete Firma weg (der Server leitet sie sonst neu ab).
        ...(felder.mandatId ? {} : { firmaId: undefined }),
        ...(m.abgeleitetVon ? { angepasst: true } : {}),
      })));
      return null;
    }
    const offen = offenErledigt(p.ms).offen;
    const neu: Meilenstein = { id: neueKennung('ms'), ...felder, ...(f.erledigt ? { erledigtAm: heute } : {}), rang: naechsterRang(offen) };
    return neu;
  };
  /** Neu anlegen: sofort speichern (abwartbar), dann die ersten Aufgaben anlegen; `oeffnen` führt ins Detail (Reiter Aufgaben). */
  const anlegen = async (neu: Meilenstein, f: Form, oeffnen: boolean): Promise<string | null> => {
    const p = stand.current;
    const ok = await p.persistMsJetzt([...p.ms, neu]);
    if (!ok) return 'Nicht gespeichert — bitte noch einmal.';
    const titel = ersteAufgaben(f.aufgaben);
    const angelegt = titel.length ? await aufgabenAnlegen(neu.id, titel) : 0;
    if (oeffnen) { setZustand(null); router.push(WEG.meilenstein(neu.id, 'aufgaben')); }
    return angelegt < titel.length ? `${titel.length - angelegt} von ${titel.length} Aufgaben nicht angelegt — im Meilenstein nachtragen.` : null;
  };

  const loeschen = () => {
    if (!bestehend) return;
    const p = stand.current;
    const alt = ohneStand(bestehend as Meilenstein & { stand?: string });
    p.persistMs(p.ms.filter(m => m.id !== alt.id));
    rueck.melden(`„${alt.titel}“ gelöscht`, () => { const q = stand.current; if (!q.ms.some(m => m.id === alt.id)) q.persistMs([...q.ms, alt]); });
    setZustand(null);
  };

  const fenster = zustand && (zustand.id === null || bestehend) ? (
    <MeilensteinForm key={zustand.runde} m={bestehend} vorgabe={zustand.vorgabe} planung={planung}
      onSpeichern={async (f, weiter) => {
        const neu = speichern(f);
        if (!neu) { if (!weiter) setZustand(null); return null; }
        return anlegen(neu, f, !weiter);
      }}
      onOeffnen={bestehend ? () => { setZustand(null); router.push(WEG.meilenstein(bestehend.id, 'aufgaben')); } : undefined}
      onLoeschen={bestehend && (!bestehend.abgeleitetVon || bestehend.angepasst) ? loeschen : undefined}
      onZu={() => setZustand(null)} />
  ) : null;
  // Verschwindet der Meilenstein, während das Fenster offen ist (anderswo gelöscht): schließen.
  useEffect(() => { if (zustand?.id && planung.geladen && !bestehend) setZustand(null); }, [zustand, planung.geladen, bestehend]);

  return { oeffneNeu, oeffne, fenster };
}

function MeilensteinForm({ m, vorgabe, planung, onSpeichern, onLoeschen, onOeffnen, onZu }: {
  m: Meilenstein | null; vorgabe: MsVorgabe; planung: PlanungStand;
  /** Antwort: Hinweistext (z. B. Aufgaben nicht angelegt) oder null. */
  onSpeichern: (f: Form, weiter: boolean) => Promise<string | null>; onLoeschen?: () => void; onOeffnen?: () => void; onZu: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [f, setF] = useState<Form>(() => formAus(m, vorgabe));
  const [angelegt, setAngelegt] = useState(0);
  const [fehlt, setFehlt] = useState(false);
  const titelRef = useRef<HTMLInputElement>(null);
  // Mandat-Chip nur, wenn es aktive Mandate gibt (oder schon eins gesetzt ist) — sonst stünde ein leeres Feld da.
  const { zugang, mandate } = useMandate();
  const mandatZugang = zugang && mandate.length > 0;
  const business = f.space === 'business';
  const laufend = Number(planung.heute.slice(0, 4));
  const jahr = f.faellig ? Number(f.faellig.slice(0, 4)) : laufend;
  // Ziel-Bezug: Jahresziele im Jahr des Datums und im selben Bereich (gemeinsame zählen mit) — der gesetzte bleibt wählbar.
  const zielWahl: Ziel[] = planung.ziele.filter(z => !z.abgeleitetVon && (z.id === f.zielId || ((!z.space || z.space === f.space) && zielJahr(z, laufend) === jahr && !z.erledigt)));

  const setze = (patch: Partial<Form>) => setF(x => ({ ...x, ...patch }));
  const los = async (weiter: boolean) => {
    if (laeuft) return;
    if (!f.titel.trim()) { setFehlt(true); titelRef.current?.focus(); return; }
    setLaeuft(true); setMeldung(null);
    const hinweis = await onSpeichern(f, weiter).finally(() => setLaeuft(false));
    setMeldung(hinweis);
    if (weiter && !(hinweis && hinweis.startsWith('Nicht gespeichert'))) {
      // Schnell-Eingabe: Datum, Bereich, Einheit (und Mandat/Ziel) bleiben stehen — nur Titel, Aufgaben und Stand neu.
      setF(x => ({ ...x, titel: '', fortschritt: 0, erledigt: false, messlatte: '', aufgaben: '' }));
      setAngelegt(n => n + 1); setFehlt(false);
      titelRef.current?.focus();
    }
  };
  const abgeleitet = !!m?.abgeleitetVon && !m.angepasst;

  return (
    <Fenster titel={m ? 'Meilenstein bearbeiten' : 'Neuer Meilenstein'} onZu={onZu} breit={560}>
      {abgeleitet && <p style={{ margin: 0, fontSize: TYP.bedien, color: LEUCHT.agenten, lineHeight: 1.5 }}>Aus einem Jahresziel mit Termin. Wer hier ändert, löst ihn vom Ziel („angepasst“) — danach lässt er sich auch löschen.</p>}
      {/* Kein <form>: die Knöpfe (Knopf) sind type=submit — Enter im Titel speichert (neu: und nächster). */}
      <div style={{ display: 'grid', gap: 12 }}>
        <label style={beschriftung}>Titel
          <input ref={titelRef} autoFocus value={f.titel} onChange={e => { setze({ titel: e.target.value }); setFehlt(false); }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void los(!m); } }} placeholder="Woran erkennen wir den Schritt?" aria-invalid={fehlt || undefined}
            style={{ ...feld, fontWeight: 600, ...(fehlt ? { borderColor: LEUCHT.kritisch } : {}) }} maxLength={200} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
          <label style={beschriftung}>Datum
            <input type="date" value={f.faellig} onChange={e => setze({ faellig: e.target.value })} style={{ ...feld, colorScheme: 'dark' }} />
          </label>
          <label style={beschriftung}>Bereich
            <select value={f.space} onChange={e => { const s: SpaceId = e.target.value === 'privat' ? 'privat' : 'business'; setze({ space: s, ...(s === 'privat' ? { einheit: '', mandatId: '' } : {}) }); }} style={{ ...wahl, color: SPACE_FARBE[f.space] }}>
              <option value="business">{SPACE_LABEL.business}</option>
              <option value="privat">{SPACE_LABEL.privat}</option>
            </select>
          </label>
          {business && (
            <label style={beschriftung}>Einheit
              <select value={f.einheit} onChange={async e => {
                if (e.target.value === NEU_EINHEIT) { const n = window.prompt('Neue Einheit (z. B. eine Firma, ein Kunde):'); const s = n ? await planung.einheitAnlegen(n) : null; setze({ einheit: s ?? '' }); return; }
                setze({ einheit: e.target.value });
              }} style={wahl}>
                <option value="">ohne Einheit</option>
                {planung.einheiten.map(x => <option key={x} value={x}>{x}</option>)}
                <option value={NEU_EINHEIT}>+ neue Einheit</option>
              </select>
            </label>
          )}
        </div>
        {(business && (mandatZugang || f.mandatId)) || zielWahl.length ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
            {business && (mandatZugang || f.mandatId) && (
              <div style={beschriftung}>Mandat
                <MandatWahl ohneLink wert={f.mandatId || undefined} setzen={x => setze({ mandatId: x?.id ?? '', ...(x?.einheit ? { einheit: x.einheit } : {}) })} />
              </div>
            )}
            {zielWahl.length > 0 && (
              <label style={{ ...beschriftung, flex: '1 1 200px' }}>Zahlt auf Ziel ein
                <select value={f.zielId} onChange={e => setze({ zielId: e.target.value })} style={wahl}>
                  <option value="">kein Ziel</option>
                  {zielWahl.map(z => <option key={z.id} value={z.id}>{z.titel}{zielJahr(z, laufend) !== jahr ? ` (${zielJahr(z, laufend)})` : ''}</option>)}
                </select>
              </label>
            )}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...beschriftung, flex: '1 1 220px' }}>Fortschritt
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="range" min={0} max={100} step={5} value={f.erledigt ? 100 : f.fortschritt} disabled={f.erledigt} onChange={e => setze({ fortschritt: Number(e.target.value) })} style={{ flex: 1, accentColor: col(f.fortschritt) }} aria-label="Fortschritt" />
              <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.bedien, width: 44, textAlign: 'right', color: col(f.erledigt ? 100 : f.fortschritt), fontVariantNumeric: 'tabular-nums' }}>{f.erledigt ? 100 : f.fortschritt} %</span>
            </span>
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: TYP.bedien, color: C.inkDim, cursor: 'pointer', minHeight: 44 }}>
            <input type="checkbox" checked={f.erledigt} onChange={e => setze({ erledigt: e.target.checked })} style={{ width: 18, height: 18, accentColor: LEUCHT.gut }} /> erledigt
          </label>
        </div>
        {!m && (
          <label style={beschriftung}>Erste Aufgaben (optional, eine je Zeile)
            <textarea value={f.aufgaben} onChange={e => setze({ aufgaben: e.target.value })} rows={4} placeholder={'Vertrag entwerfen\nTermin mit Steuerberater\nKonto eröffnen'} style={{ ...feld, resize: 'vertical', minHeight: 90, fontFamily: 'inherit' }} />
            <span style={{ fontSize: 12, color: C.inkLeise }}>Werden echte Aufgaben im Meilenstein — Unteraufgaben, Fristen und Verantwortliche danach im Meilenstein.</span>
          </label>
        )}
        <label style={beschriftung}>Messlatte (optional)
          <input value={f.messlatte} onChange={e => setze({ messlatte: e.target.value })} placeholder="Woran messen wir „fertig“?" style={feld} maxLength={300} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end' }}>
          {meldung && <span style={{ fontSize: 12, color: LEUCHT.achtung, flexBasis: '100%' }}>{meldung}</span>}
          {angelegt > 0 && <span style={{ fontSize: 12, color: LEUCHT.gut, marginRight: 'auto' }}>{angelegt} angelegt — Datum und Einheit bleiben stehen</span>}
          {onOeffnen && <Knopf leise onClick={onOeffnen}>Aufgaben & Verlauf öffnen ›</Knopf>}
          {onLoeschen && <span style={{ marginRight: angelegt ? 0 : 'auto' }}><Knopf leise onClick={onLoeschen}>Löschen</Knopf></span>}
          <Knopf leise onClick={onZu}>{angelegt ? 'Fertig' : 'Abbrechen'}</Knopf>
          {!m && <Knopf leise onClick={() => void los(true)}>{laeuft ? 'speichert …' : 'Speichern + nächster'}</Knopf>}
          <Knopf onClick={() => void los(false)}>{laeuft ? 'speichert …' : m ? 'Speichern' : 'Speichern & öffnen'}</Knopf>
        </div>
      </div>
    </Fenster>
  );
}
