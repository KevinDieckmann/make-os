'use client';

// ─── Kalender — Bausteine (25.09.) ──────────────────────────────────────────
// Der Wochenplaner ist jetzt der Kalender: Termine aus iCloud (anlegen,
// verschieben, umbenennen, löschen), dazu, was an einem Tag „dran“ ist —
// Aufgaben mit Datum, Apple-Erinnerungen, Fristen aus dem ganzen System.
// Hier: Daten laden (useKalender), Farben, die Ganztags-Zelle und das
// Termin-Fenster.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Knopf, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { ART_FARBE } from '@/types/planer';

export type Wer = 'kevin' | 'malin' | 'beide';
export interface KTermin {
  id: string; uid: string; titel: string; start: string; ende: string; ganztags: boolean;
  kalender: string; wer: Wer; ort?: string; notiz?: string; serie: boolean; mitTeilnehmern: boolean; bearbeitbar: boolean;
}
export interface KFrist { id: string; art: 'meilenstein' | 'etappe' | 'mandat' | 'zahlung' | 'eingang'; tag: string; titel: string; unter?: string; href: string; erledigt?: boolean }
export interface KErinnerung { id: string; tag: string; zeit?: string; titel: string; liste?: string }
export interface KalenderStand {
  ok: boolean; quelle: 'icloud' | 'mac' | 'leer'; stand: string | null; fehler?: string; icloud: boolean; konto: string | null;
  kalender: { name: string; farbe?: string; schreibbar: boolean; wer: Wer }[];
  termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[]; erinnerungenStand: string | null;
  einstellungen?: { kalender: Record<Wer, string> };
}

export const WER_FARBE: Record<Wer, string> = { kevin: LEUCHT.puls, malin: LEUCHT.beziehung, beide: LEUCHT.geld };
export const WER_LABEL: Record<Wer, string> = { kevin: 'Kevin', malin: 'Malin', beide: 'Gemeinsam' };
export const FRIST_ZEICHEN: Record<KFrist['art'], { zeichen: string; farbe: string; label: string }> = {
  meilenstein: { zeichen: '◆', farbe: LEUCHT.agenten, label: 'Meilenstein' },
  etappe: { zeichen: '◇', farbe: LEUCHT.agenten, label: 'Bauplan-Etappe' },
  mandat: { zeichen: '§', farbe: LEUCHT.business, label: 'Mandat' },
  zahlung: { zeichen: '€', farbe: LEUCHT.achtung, label: 'Zahlung' },
  eingang: { zeichen: '€', farbe: LEUCHT.gut, label: 'Zahlungseingang' },
};

/** Die Ebenen, die man ein- und ausblenden kann. */
export type Ebene = 'termine' | 'bloecke' | 'aufgaben' | 'erinnerungen' | 'fristen';
export const EBENEN: { id: Ebene; label: string; farbe: string }[] = [
  { id: 'termine', label: 'Termine', farbe: LEUCHT.puls },
  { id: 'bloecke', label: 'Blöcke', farbe: ART_FARBE.fokus },
  { id: 'aufgaben', label: 'Aufgaben', farbe: ART_FARBE.aufgabe },
  { id: 'erinnerungen', label: 'Erinnerungen', farbe: LEUCHT.schlaf },
  { id: 'fristen', label: 'Fristen', farbe: LEUCHT.agenten },
];

/** Kalender eines Zeitraums laden, jede Minute abgleichen (Änderungen am iPhone erscheinen von selbst). */
export function useKalender(von: string, bis: string) {
  const [daten, setDaten] = useState<KalenderStand | null>(null);
  const [laedt, setLaedt] = useState(false);
  const aktuell = useRef(`${von}|${bis}`);
  aktuell.current = `${von}|${bis}`;
  const laden = useCallback(async () => {
    const schluessel = `${von}|${bis}`;
    setLaedt(true);
    try {
      const d = await fetch(`/api/kalender?von=${von}&bis=${bis}`, { cache: 'no-store' }).then(r => r.json());
      if (aktuell.current === schluessel && d?.ok) setDaten(d);
    } catch { /* nächste Runde */ }
    setLaedt(false);
  }, [von, bis]);
  useEffect(() => { void laden(); const t = setInterval(() => { if (document.visibilityState === 'visible') void laden(); }, 60_000); return () => clearInterval(t); }, [laden]);
  return { daten, laedt, laden, setDaten };
}

const uhr = (wand: string) => wand.slice(11, 16);

/** Ein Eintrag in der Ganztags-Zeile: kleine Pille, farbig nach Art. */
function Pille({ farbe, titel, children, onClick, href, durch }: { farbe: string; titel?: string; children: React.ReactNode; onClick?: () => void; href?: string; durch?: boolean }) {
  const stil: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5, width: '100%', minWidth: 0, textAlign: 'left', padding: '3px 6px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, lineHeight: 1.3,
    background: `${farbe}1c`, color: farbe, border: 'none', cursor: onClick || href ? 'pointer' : 'default', textDecoration: durch ? 'line-through' : 'none', fontFamily: SCHRIFT.text,
  };
  const inhalt = <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>{children}</span>;
  if (href) return <Link href={href} title={titel} style={stil} className="fassbar">{inhalt}</Link>;
  return <button type="button" onClick={onClick} title={titel} style={stil} className="fassbar">{inhalt}</button>;
}

const HOECHSTENS = 4;

/**
 * Was an einem Tag „dran“ ist, ohne Uhrzeit: ganztägige Termine, Fristen,
 * Aufgaben, Erinnerungen. Höchstens vier, der Rest auf Klick — und
 * Überfälliges als eine Pille, sonst verschwindet der Tag darunter.
 */
export function GanztagsZelle({ termine, aufgaben, erinnerungen, fristen, ueberfaellig = 0, onTermin, onAufgabeHaken }: {
  termine: KTermin[]; aufgaben: { id: string; title: string; done: boolean; priority?: string }[]; erinnerungen: KErinnerung[]; fristen: KFrist[];
  ueberfaellig?: number; onTermin: (t: KTermin) => void; onAufgabeHaken: (id: string) => void;
}) {
  const [alle, setAlle] = useState(false);
  const gesamt = termine.length + fristen.length + aufgaben.length + erinnerungen.length;
  let platz = alle ? Infinity : HOECHSTENS;
  const nimm = <T,>(l: T[]) => { const n = l.slice(0, Math.max(0, platz)); platz -= n.length; return n; };
  termine = nimm(termine); fristen = nimm(fristen); aufgaben = nimm(aufgaben); erinnerungen = nimm(erinnerungen);
  const rest = gesamt - termine.length - fristen.length - aufgaben.length - erinnerungen.length;
  return (
    <div style={{ display: 'grid', gap: 3, alignContent: 'start', minWidth: 0 }}>
      {ueberfaellig > 0 && (
        <Pille farbe={LEUCHT.kritisch} href="/os/aufgaben" titel={`${ueberfaellig} Aufgaben sind überfällig — zu den Aufgaben`}>
          <span aria-hidden>‼</span>{ueberfaellig} überfällig
        </Pille>
      )}
      {termine.map(t => (
        <Pille key={t.id} farbe={WER_FARBE[t.wer]} titel={`${t.titel} · ${t.kalender}${t.bearbeitbar ? '' : ' (nur in Apple änderbar)'}`} onClick={() => onTermin(t)}>{t.titel}</Pille>
      ))}
      {fristen.map(f => (
        <Pille key={f.id} farbe={FRIST_ZEICHEN[f.art].farbe} titel={`${FRIST_ZEICHEN[f.art].label}: ${f.titel}${f.unter ? ` · ${f.unter}` : ''}`} href={f.href} durch={f.erledigt}>
          <span aria-hidden>{FRIST_ZEICHEN[f.art].zeichen}</span>{f.titel}
        </Pille>
      ))}
      {aufgaben.map(a => (
        <Pille key={a.id} farbe={ART_FARBE.aufgabe} titel={`Aufgabe: ${a.title} — Klick hakt ab`} onClick={() => onAufgabeHaken(a.id)} durch={a.done}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, flex: '0 0 auto', background: a.done ? ART_FARBE.aufgabe : 'transparent' }} />
          {a.priority === 'critical' ? '‼ ' : ''}{a.title}
        </Pille>
      ))}
      {erinnerungen.map(e => (
        <Pille key={e.id} farbe={LEUCHT.schlaf} titel={`Erinnerung${e.liste ? ` (${e.liste})` : ''}: ${e.titel}`}>
          <span aria-hidden>◷</span>{e.zeit ? `${e.zeit} ` : ''}{e.titel}
        </Pille>
      ))}
      {(rest > 0 || alle) && gesamt > HOECHSTENS && (
        <button type="button" onClick={() => setAlle(!alle)} style={{ background: 'none', border: 'none', color: C.inkLeise, fontSize: 11.5, textAlign: 'left', cursor: 'pointer', padding: '1px 6px', fontFamily: SCHRIFT.text }}>
          {alle ? 'weniger' : `+${rest} mehr`}
        </button>
      )}
    </div>
  );
}

/** Warum ein Termin nur in Apple änderbar ist — in Worten. */
export function nurAppleGrund(t: KTermin, icloud = true): string | null {
  if (t.bearbeitbar) return null;
  if (!icloud) return 'iCloud ist noch nicht verbunden — du siehst den zuletzt vom Mac gelieferten Stand. Ändern geht hier, sobald die Verbindung steht.';
  if (t.serie) return 'Serientermin — Änderungen bitte in Apple Kalender (dort fragt Apple „nur dieser oder alle?“).';
  if (t.mitTeilnehmern) return 'Termin mit Teilnehmern — bitte in Apple Kalender ändern, dort gehen die Einladungen raus. MAKE OS versendet nichts.';
  return 'Dieser Kalender ist nur lesbar (geteilt ohne Schreibrecht).';
}

/** Ein Termin im Detail: Titel, Tag, Uhrzeit, Ort, Notiz — ändern oder löschen (mit Rückfrage). */
export function TerminFenster({ termin, icloud = true, onZu, onGespeichert }: { termin: KTermin; icloud?: boolean; onZu: () => void; onGespeichert: () => void }) {
  const [f, setF] = useState({ titel: termin.titel, tag: termin.start.slice(0, 10), von: uhr(termin.start), bis: uhr(termin.ende), ort: termin.ort ?? '', notiz: termin.notiz ?? '' });
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const grund = nurAppleGrund(termin, icloud);
  const endeTag = termin.ganztags ? termin.ende.slice(0, 10) : f.tag;
  const speichern = async () => {
    setLaeuft(true); setFehler(null);
    const body: Record<string, unknown> = { uid: termin.uid };
    if (f.titel.trim() !== termin.titel) body.titel = f.titel.trim();
    if ((f.ort ?? '') !== (termin.ort ?? '')) body.ort = f.ort;
    if ((f.notiz ?? '') !== (termin.notiz ?? '')) body.notiz = f.notiz;
    if (!termin.ganztags && (f.tag !== termin.start.slice(0, 10) || f.von !== uhr(termin.start) || f.bis !== uhr(termin.ende))) {
      if (f.bis <= f.von) { setLaeuft(false); setFehler('Das Ende liegt vor dem Anfang.'); return; }
      body.start = `${f.tag}T${f.von}`; body.ende = `${f.tag}T${f.bis}`;
    }
    if (Object.keys(body).length === 1) { setLaeuft(false); onZu(); return; }
    const r = await fetch('/api/kalender/termin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (r.ok) { onGespeichert(); onZu(); } else setFehler(r.fehler ?? 'Nicht gespeichert.');
  };
  const loeschen = async () => {
    setLaeuft(true); setFehler(null);
    const r = await fetch(`/api/kalender/termin?uid=${encodeURIComponent(termin.uid)}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false);
    if (r.ok) { onGespeichert(); onZu(); } else { setFehler(r.fehler ?? 'Nicht gelöscht.'); setLoeschenFragen(false); }
  };
  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px', colorScheme: 'dark' as const };
  const aus = !!grund;
  const tagText = (t: string) => new Date(`${t}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <Fenster breit={560} onZu={onZu} titel={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: WER_FARBE[termin.wer], flex: '0 0 auto' }} />{termin.titel}</span>}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>
        {termin.ganztags ? `${tagText(termin.start.slice(0, 10))}${endeTag > termin.start.slice(0, 10) && endeTag !== termin.start.slice(0, 10) ? ' · ganztägig' : ''}` : `${tagText(termin.start.slice(0, 10))} · ${uhr(termin.start)}–${uhr(termin.ende)}`}
        {' · '}{termin.kalender} ({WER_LABEL[termin.wer]})
      </div>
      {grund && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>{grund}</div>}
      <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Titel</span>
        <input value={f.titel} disabled={aus} onChange={e => setF({ ...f, titel: e.target.value })} style={eingabe} /></label>
      {!termin.ganztags && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 4, flex: '1 1 150px' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Tag</span><input type="date" disabled={aus} value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} style={eingabe} /></label>
          <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Von</span><input type="time" step={300} disabled={aus} value={f.von} onChange={e => setF({ ...f, von: e.target.value })} style={eingabe} /></label>
          <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Bis</span><input type="time" step={300} disabled={aus} value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} style={eingabe} /></label>
        </div>
      )}
      <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Ort</span>
        <input value={f.ort} disabled={aus} onChange={e => setF({ ...f, ort: e.target.value })} placeholder="optional" style={eingabe} /></label>
      <label style={{ display: 'grid', gap: 4 }}><span style={{ fontSize: 12.5, color: C.inkLeise }}>Notiz</span>
        <textarea value={f.notiz} disabled={aus} rows={3} onChange={e => setF({ ...f, notiz: e.target.value })} placeholder="optional" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} /></label>
      {fehler && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      {!aus && (loeschenFragen ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: `${LEUCHT.kritisch}14`, borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: TYP.bedien, flex: 1 }}>Termin wirklich löschen? Er verschwindet auch auf iPhone und Mac.</span>
          <Knopf farbe={LEUCHT.kritisch} aus={laeuft} onClick={() => void loeschen()}>Ja, löschen</Knopf>
          <Knopf leise onClick={() => setLoeschenFragen(false)}>Nein</Knopf>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Knopf aus={laeuft || !f.titel.trim()} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
            <Knopf leise onClick={onZu}>Abbrechen</Knopf>
          </div>
          <Knopf leise onClick={() => setLoeschenFragen(true)}>Löschen</Knopf>
        </div>
      ))}
    </Fenster>
  );
}
