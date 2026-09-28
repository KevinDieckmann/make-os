'use client';

// ─── Markttraktion · Wertelisten-Wahl (Malins Rückmeldung 27.09.) ──────────
// Zwei Bauteile auf demselben Schreibweg:
//  · WertelistenWahl — Branchen (mehrfach): ALLE Werte der Werteliste als
//    Pillen in einer scrollbaren Box (etwa vier Zeilen hoch), ab SUCHE_AB
//    Werten ein Suchfeld darüber, und „+ neu“ direkt in der Akte.
//  · WertelistenMehrfachWahl — Typ, Kategorie und Labels (mehrfach seit 28.09.,
//    vorher Einzelwahl): Wahl-Chips (./Wahl.tsx WahlMehrfach) — gesetzte Werte mit ×,
//    „+“ öffnet das Menü mit Suche, „+ neu …“ und „Pflegen ›“ im Fuß.
// Neu anlegen läuft in beiden über useWertelisteAnlegen: POST /api/crm/stammdaten
// · aktion wertelisten (Prüfung und Säuberung in lib/crm/wertelisten.ts), der
// Wert wird sofort gewählt. Feste Standardwerte sind nicht löschbar;
// Umbenennen und Löschen bleibt unter Stammdaten › Wertelisten.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FARBE as C, TYP, SCHRIFT } from '@/lib/make-one/design';
import { feld, LEUCHT } from '../schlank';
import { wertelisteZurWahl, SUCHE_AB, WERT_MIN, WERT_MAX } from '@/lib/crm/wertelisten';
import { markttraktion } from '@/lib/crm/adresse';
import Link from 'next/link';
import type { CrmApi } from './daten';
import { WahlMehrfach, type WahlEintrag } from './Wahl';

export type WertelisteName = 'branchen' | 'typen' | 'kategorien' | 'labels';
const LISTE_LABEL: Record<WertelisteName, string> = { branchen: 'Branche', typen: 'Typ', kategorien: 'Kategorie', labels: 'Label' };

/**
 * „+ neu“ für eine Werteliste: eigene Werte der Liste + dieser, über den
 * Schreibweg der Stammdaten. Gibt den Wert zurück (bei gleichnamigem Bestand
 * dessen Schreibweise) und lädt danach den Bestand neu; wirft mit dem
 * Fehlertext des Servers. Feste Werte fängt der Server (bleiben, wie sie sind).
 */
export function useWertelisteAnlegen(liste: WertelisteName, werte: { wert: string; fest: boolean }[], api: Pick<CrmApi, 'laden'>): (text: string) => Promise<string> {
  return useCallback(async (roh: string) => {
    const t = roh.replace(/\s+/g, ' ').trim();
    if (t.length < WERT_MIN || t.length > WERT_MAX) throw new Error(`${LISTE_LABEL[liste]}: ${WERT_MIN}–${WERT_MAX} Zeichen.`);
    const vorhanden = werte.find(x => x.wert.toLowerCase() === t.toLowerCase());
    if (vorhanden) return vorhanden.wert;
    const eigene = werte.filter(x => !x.fest).map(x => x.wert);
    const r = await fetch('/api/crm/stammdaten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'wertelisten', wertelisten: { [liste]: [...eigene, t] } }) })
      .then(x => x.json() as Promise<{ ok: boolean; fehler?: string }>).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    if (!r.ok) throw new Error(r.fehler ?? 'Nicht gespeichert.');
    void api.laden();
    return t;
  }, [liste, werte, api]);
}

/**
 * Typ, Kategorie oder Labels als Mehrfach-Chips (28.09., Kevins Entscheidung): gesetzte Werte als Chips mit ×,
 * „+“ öffnet das Menü mit Suche, „+ neu …“ legt einen eigenen Wert in der Werteliste an und wählt ihn,
 * Fuß „Pflegen ›“. Bestandswerte, die in keiner Liste stehen, bleiben sichtbar (Hinweis „Bestand“).
 */
export function WertelistenMehrfachWahl({ liste, werte, wert, onWahl, api, farbe = C.aktiv, klein }: {
  liste: Exclude<WertelisteName, 'branchen'>;
  werte: { wert: string; fest: boolean }[];
  wert: readonly string[];
  onWahl: (werte: string[]) => void;
  api: Pick<CrmApi, 'laden'>;
  farbe?: string;
  klein?: boolean;
}) {
  const anlegen = useWertelisteAnlegen(liste, werte, api);
  const eintraege: WahlEintrag<string>[] = useMemo(
    () => wertelisteZurWahl(werte, wert).map(o => ({ id: o.wert, label: o.wert, ...(o.fremd ? { hinweis: 'Bestand' } : {}) })),
    [werte, wert],
  );
  return (
    <WahlMehrfach label={LISTE_LABEL[liste]} liste={eintraege} wert={wert} farbe={farbe} klein={klein} onWahl={onWahl}
      onNeu={anlegen} neuMin={WERT_MIN} neuMax={WERT_MAX}
      fuss={<Link href={markttraktion('stammdaten', 'wertelisten')} style={{ color: C.inkLeise, textDecoration: 'none', padding: '4px 2px' }}>Pflegen ›</Link>} />
  );
}

export function WertelistenWahl({ liste, werte, aktiv, mehrfach, onWahl, api, farbe = C.aktiv }: {
  /** Welche Werteliste — entscheidet, wohin „+ neu“ schreibt. */
  liste: WertelisteName;
  /** Alle Werte der Liste (fest + eigene), aus `wertelistenVollstaendig`. */
  werte: { wert: string; fest: boolean }[];
  /** Gewählt — bei Einzelwahl höchstens ein Eintrag. */
  aktiv: string[];
  mehrfach?: boolean;
  onWahl: (aktiv: string[]) => void;
  /** Nach dem Anlegen lädt die Akte den Bestand neu, damit der Wert überall steht. */
  api: Pick<CrmApi, 'laden'>;
  farbe?: string;
}) {
  const [suche, setSuche] = useState('');
  const [neu, setNeu] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const neuFeld = useRef<HTMLInputElement>(null);
  useEffect(() => { if (neu !== null) neuFeld.current?.focus(); }, [neu]);

  const optionen = useMemo(() => wertelisteZurWahl(werte, aktiv, suche), [werte, aktiv, suche]);
  const gewaehlt = (w: string) => aktiv.includes(w);
  const waehle = (w: string) => {
    if (mehrfach) onWahl(gewaehlt(w) ? aktiv.filter(x => x !== w) : [...aktiv, w]);
    else onWahl(gewaehlt(w) ? [] : [w]);
  };

  /** Neuen Wert anlegen (useWertelisteAnlegen), dann sofort wählen. */
  const anlegenWert = useWertelisteAnlegen(liste, werte, api);
  const anlegen = async () => {
    const t = (neu ?? '').replace(/\s+/g, ' ').trim();
    if (!t) { setNeu(null); return; }
    setLaeuft(true); setFehler(null);
    try { waehleNeu(await anlegenWert(t)); }
    catch (e) { setFehler(e instanceof Error ? e.message : 'Nicht gespeichert.'); }
    finally { setLaeuft(false); }
  };
  const waehleNeu = (w: string) => { if (!gewaehlt(w)) onWahl(mehrfach ? [...aktiv, w] : [w]); setNeu(null); setSuche(''); setFehler(null); };

  const pille = (o: { wert: string; fest: boolean; fremd?: boolean }) => {
    const an = gewaehlt(o.wert);
    return (
      <button key={o.wert} type="button" onClick={e => { e.stopPropagation(); waehle(o.wert); }} className="fassbar" aria-pressed={an}
        title={o.fremd ? 'Bestandswert — steht in keiner Werteliste' : o.fest ? 'Vorbelegt' : 'Eigener Wert'}
        style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, border: `1px solid ${an ? farbe : o.fremd ? `${LEUCHT.achtung}66` : 'rgba(255,255,255,.1)'}`, background: an ? `${farbe}22` : 'transparent', color: an ? farbe : o.fremd ? LEUCHT.achtung : C.inkDim, whiteSpace: 'nowrap' }}>
        {an && mehrfach ? '✓ ' : ''}{o.wert}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      {(werte.length >= SUCHE_AB || suche) && (
        <input value={suche} onChange={e => setSuche(e.target.value)} placeholder={`${LISTE_LABEL[liste]} suchen …`} aria-label={`${LISTE_LABEL[liste]} suchen`}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setSuche(''); } if (e.key === 'Enter' && optionen.length === 1) { e.preventDefault(); waehle(optionen[0].wert); setSuche(''); } }}
          style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px' }} />
      )}
      <div role={mehrfach ? 'group' : 'radiogroup'} aria-label={`${LISTE_LABEL[liste]} wählen`}
        style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignContent: 'flex-start', maxHeight: 136, overflowY: 'auto', padding: '2px 2px 2px 0', scrollbarWidth: 'thin' }}>
        {optionen.map(pille)}
        {!optionen.length && <span style={{ fontSize: 12.5, color: C.inkLeise, padding: '5px 0' }}>Nichts passt zu „{suche}“ — unten „+ neu“.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {neu === null
          ? <button type="button" onClick={() => { setNeu(suche.trim()); setFehler(null); }} className="fassbar" style={{ background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: SCHRIFT.text, fontWeight: 600 }}>+ neu</button>
          : <>
            <input ref={neuFeld} value={neu} maxLength={WERT_MAX} disabled={laeuft} placeholder={`Neue ${LISTE_LABEL[liste]} (${WERT_MIN}–${WERT_MAX} Zeichen) — Enter legt an`} aria-label={`Neue ${LISTE_LABEL[liste]}`}
              onChange={e => setNeu(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void anlegen(); } if (e.key === 'Escape') { e.stopPropagation(); setNeu(null); setFehler(null); } }}
              style={{ ...feld, fontSize: TYP.bedien, padding: '7px 10px', flex: 1, minWidth: 180 }} />
            <button type="button" onClick={() => void anlegen()} disabled={laeuft || !neu.trim()} className="fassbar" style={{ background: 'none', border: `1px solid ${C.aktiv}66`, color: C.aktiv, borderRadius: 999, cursor: laeuft ? 'wait' : 'pointer', fontSize: 12, padding: '4px 10px', fontFamily: SCHRIFT.text, fontWeight: 600, opacity: laeuft || !neu.trim() ? .5 : 1 }}>{laeuft ? 'legt an …' : 'Anlegen'}</button>
            <button type="button" onClick={() => { setNeu(null); setFehler(null); }} style={{ background: 'none', border: 'none', color: C.inkLeise, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: SCHRIFT.text }}>abbrechen</button>
          </>}
        <Link href={markttraktion('stammdaten', 'wertelisten')} style={{ marginLeft: 'auto', fontSize: 11.5, color: C.inkLeise, textDecoration: 'none' }}>Pflegen ›</Link>
      </div>
      {fehler && <div role="alert" style={{ fontSize: 12, color: LEUCHT.kritisch }}>{fehler}</div>}
    </div>
  );
}
