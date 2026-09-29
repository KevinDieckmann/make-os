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
import { Knopf, Segmente, Chip, feld, LEUCHT } from '../schlank';
import { Fenster } from '../Fenster';
import { ART_FARBE } from '@/types/planer';
import { ART_INFO, TERMIN_FARBEN, SICHTBARKEIT_LABEL, ARBEITSORTE, arbeitsortTitel, erinnerungText, farbeHex, type IcsArt, type Sichtbarkeit, type Arbeitsort, type ArbeitsortArt } from '@/lib/kalender/arten';
import { gmtText, wandzeitIn } from '@/lib/kalender/zeitzone';
import { ausWandzeit } from '@/lib/kalender/zeit';
import { objektSchluessel, type BezugKennungen } from '@/lib/kalender/bezug';
import { TEILNAHME_LABEL, type GastWahl } from '@/lib/kalender/gaeste';
import { TerminVerknuepfen, GaesteWahl, EinladungFrage } from './verknuepfen';
import { fokusFuerTermin } from '@/lib/zeitmessung/fokus-laufend';
import { ZuordnungWahl, type Zuordnung } from '../zeit/Zuordnung';
import type { Abschnitt } from '@/lib/kalender/aufgaben';
import type { Teilnahme, Teilnehmer } from '@/lib/kalender/gaeste';
import { aufgabeZiehStart } from './aufgaben';

export type Wer = 'kevin' | 'malin' | 'beide';
/** Ein Termin, wie ihn /api/kalender liefert (Bezug angewandt, für die ansehende Person maskiert). */
export interface KTermin {
  id: string; uid: string; titel: string; start: string; ende: string; ganztags: boolean;
  kalender: string; wer: Wer; ort?: string; notiz?: string; serie: boolean; mitTeilnehmern: boolean; bearbeitbar: boolean;
  // ── seit 29.09. (K1) ──
  art?: IcsArt; farbeEigen?: string; farbeId?: string; beschaeftigt?: boolean; sichtbarkeit?: Sichtbarkeit; zone?: string;
  erinnerungen?: number[]; arbeitsort?: Arbeitsort; stand?: string; bezug?: BezugKennungen; von?: string; maskiert?: true;
  /** Vorläufig (K4: offene Buchungsanfrage, noch kein fester Termin) — gestrichelt im Raster. */
  vorlaeufig?: true;
  /** Eintrag einer Buchungsanfrage (K4) — Klick öffnet die Buchungsseiten, nicht das Termin-Fenster. */
  buchungId?: string;
  // ── seit 30.09. (K3) ──
  /** Gäste mit ihrer Antwort (ohne das eigene Konto). */
  teilnehmer?: Teilnehmer[];
  organisator?: { email: string; name?: string };
  /** Wir haben eingeladen → ändern nach Bestätigung. */
  ichOrganisator?: boolean;
  /** Wir sind Gast → nur zusagen/absagen (nach Klick). */
  meineAntwort?: Teilnahme;
  /** Kontakt-Kennungen der Gäste aus dem CRM (`kalender-bezug`). */
  gastKontakte?: string[];
}
/** Vorläufiger Eintrag (Buchungsanfrage) — über das Feld `vorlaeufig` (K3: kein Kennungs-Präfix mehr). */
export const istVorlaeufig = (t: Pick<KTermin, 'vorlaeufig'>): boolean => !!t.vorlaeufig;
/** Eine Frist wie GET /api/kalender sie liefert (lib/kalender/eintraege.ts `Frist`; K6a: Steuer-Vorlage, `fuer`, `kuendigung`). */
export interface KFrist { id: string; art: 'meilenstein' | 'etappe' | 'mandat' | 'zahlung' | 'eingang' | 'steuer' | 'dsgvo' | 'angebot' | 'deal'; tag: string; titel: string; unter?: string; href: string; erledigt?: boolean; bereich?: 'privat' | 'business'; fuer?: string; kuendigung?: true }
export interface KErinnerung { id: string; tag: string; zeit?: string; titel: string; liste?: string }
export interface KalenderStand {
  ok: boolean; quelle: 'icloud' | 'mac' | 'leer'; stand: string | null; fehler?: string; icloud: boolean; konto: string | null;
  kalender: { name: string; farbe?: string; schreibbar: boolean; wer: Wer }[];
  termine: KTermin[]; fristen: KFrist[]; erinnerungen: KErinnerung[]; erinnerungenStand: string | null;
  einstellungen?: { kalender: Record<Wer, string> };
  /** R-K1 #51: Alter des Stands („letzter Abgleich vor X Min.“, `veraltet` ab 30 Min., Hinweise je Kalender). */
  abgleich?: import('./AbgleichStand').AbgleichInfo;
}

export const WER_FARBE: Record<Wer, string> = { kevin: LEUCHT.puls, malin: LEUCHT.beziehung, beide: LEUCHT.geld };
export const WER_LABEL: Record<Wer, string> = { kevin: 'Kevin', malin: 'Malin', beide: 'Gemeinsam' };
export const FRIST_ZEICHEN: Record<KFrist['art'], { zeichen: string; farbe: string; label: string }> = {
  meilenstein: { zeichen: '◆', farbe: LEUCHT.agenten, label: 'Meilenstein' },
  etappe: { zeichen: '◇', farbe: LEUCHT.agenten, label: 'Bauplan-Etappe' },
  mandat: { zeichen: '§', farbe: LEUCHT.business, label: 'Mandat' },
  zahlung: { zeichen: '€', farbe: LEUCHT.achtung, label: 'Zahlung' },
  eingang: { zeichen: '€', farbe: LEUCHT.gut, label: 'Zahlungseingang' },
  steuer: { zeichen: '¶', farbe: LEUCHT.achtung, label: 'Steuertermin (Vorlage — keine Steuerberatung)' },
  dsgvo: { zeichen: '⚖', farbe: LEUCHT.kritisch, label: 'DSGVO-Antrag (Frist)' },
  angebot: { zeichen: '✉', farbe: LEUCHT.business, label: 'Angebot gültig bis' },
  deal: { zeichen: '◎', farbe: LEUCHT.business, label: 'Deal: Entscheidung erwartet' },
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
function Pille({ farbe, titel, children, onClick, href, durch, stil: extra }: { farbe: string; titel?: string; children: React.ReactNode; onClick?: () => void; href?: string; durch?: boolean; stil?: React.CSSProperties }) {
  const stil: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5, width: '100%', minWidth: 0, textAlign: 'left', padding: '3px 6px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, lineHeight: 1.3,
    background: `${farbe}1c`, color: farbe, border: 'none', cursor: onClick || href ? 'pointer' : 'default', textDecoration: durch ? 'line-through' : 'none', fontFamily: SCHRIFT.text, ...extra,
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
export function GanztagsZelle({ termine, aufgaben, erinnerungen, fristen, ueberfaellig = 0, onTermin, onAufgabeHaken, onAufgabeOeffnen, aufgabenZiehbar }: {
  termine: KTermin[];
  /** K3: `abschnitt` = Teil des Balkens Start → Deadline, `eltern` = Unteraufgabe von … */
  aufgaben: { id: string; title: string; done: boolean; priority?: string; abschnitt?: Abschnitt; eltern?: string; wiederkehrend?: boolean }[];
  erinnerungen: KErinnerung[]; fristen: KFrist[];
  ueberfaellig?: number; onTermin: (t: KTermin) => void;
  /** Haken. Ohne `onAufgabeOeffnen` hakt der Klick auf die ganze Pille ab (Wochenplaner). */
  onAufgabeHaken: (id: string) => void;
  /** K3: Klick auf den Titel öffnet die Aufgabe, der Haken hakt ab. */
  onAufgabeOeffnen?: (id: string) => void;
  /** K3: Aufgaben lassen sich auf einen anderen Tag oder ins Raster ziehen. */
  aufgabenZiehbar?: boolean;
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
        // K2 (29.09.): Quell-Einträge (Feiertage NRW, Geburtstage) tragen eigene Farbe und Hinweis (components/os/kalender/quellen.tsx).
        // K1 (29.09.): Abwesend rot, eigene Farbe je Termin, privat mit Schloss.
        <Pille key={t.id} farbe={t.art === 'abwesend' ? LEUCHT.kritisch : (t as { farbe?: string }).farbe ?? t.farbeEigen ?? WER_FARBE[t.wer]} titel={`${t.art && t.art !== 'termin' ? `${ART_INFO[t.art].label}: ` : ''}${t.titel} · ${t.kalender}${(t as { hinweis?: string }).hinweis ? ` — ${(t as { hinweis?: string }).hinweis}` : t.bearbeitbar ? '' : ' (nur in Apple änderbar)'}`} onClick={() => onTermin(t)}>
          {t.art === 'abwesend' && <span aria-hidden>⊘</span>}{t.sichtbarkeit === 'privat' && <span aria-hidden>🔒</span>}{t.titel}
        </Pille>
      ))}
      {fristen.map(f => (
        <Pille key={f.id} farbe={FRIST_ZEICHEN[f.art].farbe} titel={`${FRIST_ZEICHEN[f.art].label}: ${f.titel}${f.unter ? ` · ${f.unter}` : ''}`} href={f.href} durch={f.erledigt}>
          <span aria-hidden>{FRIST_ZEICHEN[f.art].zeichen}</span>{f.titel}
        </Pille>
      ))}
      {aufgaben.map(a => {
        // Balken Start → Deadline (K3): links offen ab dem 2. Tag, rechts offen bis zur Deadline, dazwischen gestrichelt.
        const ab = a.abschnitt ?? 'einzel';
        const balken: React.CSSProperties = ab === 'einzel' ? {} : {
          borderRadius: ab === 'start' ? '6px 0 0 6px' : ab === 'ende' ? '0 6px 6px 0' : 0, opacity: ab === 'mitte' ? 0.75 : 1,
          borderTop: `1px dashed ${ART_FARBE.aufgabe}55`, borderBottom: `1px dashed ${ART_FARBE.aufgabe}55`,
        };
        const titel = `Aufgabe${a.eltern ? ` (Unteraufgabe von „${a.eltern}“)` : ''}: ${a.title}${ab === 'start' ? ' — Start' : ab === 'mitte' ? ' — läuft' : ab === 'ende' ? ' — Deadline' : ''}${aufgabenZiehbar ? ' · ziehen verschiebt die Deadline' : ''}`;
        const haken = <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, flex: '0 0 auto', background: a.done ? ART_FARBE.aufgabe : 'transparent' }} />;
        const inhalt = <>{ab === 'mitte' || ab === 'ende' ? <span aria-hidden>‹</span> : null}{a.eltern ? <span aria-label="Unteraufgabe">↳</span> : null}{a.priority === 'critical' ? '‼ ' : ''}{a.wiederkehrend ? <span aria-label="wiederkehrend">↻</span> : null}{a.title}{ab === 'start' || ab === 'mitte' ? <span aria-hidden style={{ marginLeft: 'auto' }}>›</span> : null}</>;
        if (!onAufgabeOeffnen) return <Pille key={a.id} farbe={ART_FARBE.aufgabe} titel={titel} onClick={() => onAufgabeHaken(a.id)} durch={a.done} stil={balken}>{haken}{inhalt}</Pille>;
        return (
          <div key={a.id} data-aufgabe={a.id} draggable={!!aufgabenZiehbar} onDragStart={e => aufgabeZiehStart(e, a.id)} title={titel}
            style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, padding: '3px 6px', borderRadius: 6, background: `${ART_FARBE.aufgabe}1c`, color: ART_FARBE.aufgabe, fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, fontFamily: SCHRIFT.text, cursor: aufgabenZiehbar ? 'grab' : 'default', ...balken }}>
            <button type="button" onClick={() => onAufgabeHaken(a.id)} aria-label={`„${a.title}“ als erledigt markieren`} title="Abhaken"
              style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${ART_FARBE.aufgabe}`, flex: '0 0 auto', background: 'transparent', padding: 0, cursor: 'pointer' }} />
            <button type="button" onClick={() => onAufgabeOeffnen(a.id)} className="fassbar"
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', textDecoration: a.done ? 'line-through' : 'none' }}>
              {inhalt}
            </button>
          </div>
        );
      })}
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
  if (t.maskiert) return `Privater Termin${t.von ? ` von ${WER_LABEL[t.von as Wer] ?? t.von}` : ''} — du siehst nur, dass die Zeit belegt ist.`;
  if (!icloud) return 'iCloud ist noch nicht verbunden — du siehst den zuletzt vom Mac gelieferten Stand. Ändern geht hier, sobald die Verbindung steht.';
  if (t.serie) return 'Serientermin — Änderungen bitte in Apple Kalender (dort fragt Apple „nur dieser oder alle?“).';
  if (t.mitTeilnehmern && !t.ichOrganisator) return 'Du bist hier Gast — ändern kann nur, wer eingeladen hat. Zusagen oder absagen geht unten (nach Bestätigung).';
  return 'Dieser Kalender ist nur lesbar (geteilt ohne Schreibrecht).';
}

/** Farbwahl wie Google: runde Punkte der Palette, „Kalenderfarbe“ zuerst. */
export function FarbPunkte({ wert, onWahl, kalenderFarbe, aus }: { wert: string; onWahl: (id: string) => void; kalenderFarbe: string; aus?: boolean }) {
  const punkt = (id: string, hex: string, label: string) => (
    <button key={id || 'kal'} type="button" disabled={aus} onClick={() => onWahl(id)} title={label} aria-label={`Farbe ${label}`} aria-pressed={wert === id}
      style={{ width: 22, height: 22, borderRadius: '50%', background: hex, border: wert === id ? `2px solid ${C.ink}` : '2px solid transparent', boxShadow: wert === id ? `0 0 0 2px ${C.flaeche}` : undefined, cursor: aus ? 'default' : 'pointer', padding: 0 }} />
  );
  return (
    <div role="group" aria-label="Farbe" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {punkt('', kalenderFarbe, 'Kalenderfarbe')}
      {TERMIN_FARBEN.map(f => punkt(f.id, f.hex, f.label))}
    </div>
  );
}

const MERKER_AENDERUNG = (uid: string) => `make-kalender-aenderung:${uid}`;
/** Entwurf einer Änderung: meine Fassung + die Fassung, von der ich ausging. */
interface Merker { f: Fassung; start: Fassung }
const leseMerker = <T,>(k: string): T | null => { try { const v = window.sessionStorage.getItem(k); return v ? JSON.parse(v) as T : null; } catch { return null; } };
const schreibeMerker = (k: string, v: unknown) => { try { if (v === null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* voll/privat — dann ohne Entwurf */ } };

interface Fassung { titel: string; tag: string; von: string; bis: string; ort: string; notiz: string; farbe: string; beschaeftigt: boolean; sichtbarkeit: Sichtbarkeit; art: IcsArt; arbeitsort: ArbeitsortArt }
const fassungVon = (t: KTermin): Fassung => ({
  titel: t.titel, tag: t.start.slice(0, 10), von: uhr(t.start), bis: uhr(t.ende), ort: t.ort ?? '', notiz: t.notiz ?? '', farbe: t.farbeId ?? '',
  beschaeftigt: t.beschaeftigt ?? !t.ganztags, sichtbarkeit: t.sichtbarkeit ?? 'standard', art: t.art ?? 'termin', arbeitsort: t.arbeitsort?.art ?? 'home',
});

/**
 * Ein Termin im Detail (seit 29.09., K1): Art, Zeit (mit Zone), Ort, Notiz, Farbe, frei/beschäftigt, Sichtbarkeit —
 * ändern (mit Stand: 409 behält „Deine Fassung“), löschen (mit Rückfrage), Fokuszeit starten (Zeitmessung, Aufgabe/
 * Mandat/Einheit wie im Fokus-Kopf). Ungespeicherte Änderungen liegen bis zur Bestätigung im Sitzungsspeicher.
 * Seit 30.09. (K3): mit Kontakt/Firma/Mandat/Deal verknüpfen (auch an Serien und Einladungen — nur `kalender-bezug`),
 * Gäste mit Zusagen/Absagen; haben WIR eingeladen, gehen Änderung, neue Gäste und Löschen erst nach der Rückfrage
 * „Änderung/Absage an n Gäste senden?“ raus; sind wir Gast, nur „Zusagen · Vielleicht · Absagen“ (ebenfalls nach Klick).
 */
export function TerminFenster({ termin, icloud = true, space = 'privat', kalenderFarbe, onZu, onGespeichert }: {
  termin: KTermin; icloud?: boolean; space?: 'privat' | 'business'; kalenderFarbe?: string; onZu: () => void; onGespeichert: () => void;
}) {
  // `start` = die Fassung, von der die Eingabe ausging (Unterschiede = meine Änderungen); `basis` = der zuletzt bekannte
  // Server-Stand (für `stand`). Gespeichert wird NUR, was ich geändert habe — auch nach 409 („Meine Fassung speichern“)
  // und nach dem Wiederherstellen aus dem Sitzungsspeicher (der Entwurf merkt sich seine Ausgangsfassung mit).
  const [gemerkt] = useState(() => { const m = leseMerker<Merker>(MERKER_AENDERUNG(termin.uid)); return m && m.f && m.start ? m : null; });
  const [start, setStart] = useState<Fassung>(() => gemerkt?.start ?? fassungVon(termin));
  const [basis, setBasis] = useState<KTermin>(termin);
  const [f, setFRoh] = useState<Fassung>(() => gemerkt?.f ?? fassungVon(termin));
  const wiederhergestellt = !!gemerkt;
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [konflikt, setKonflikt] = useState<KTermin | null>(null);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const [zuordnung, setZuordnung] = useState<Zuordnung>({ ...(termin.bezug?.aufgabeId ? { aufgabeId: termin.bezug.aufgabeId } : {}), ...(termin.bezug?.mandatId ? { mandatId: termin.bezug.mandatId } : {}) });
  // K3: CRM-Bezug und Gäste (Adressen stehen nur im Termin; die Kennungen der Gäste aus dem CRM ordnet der Server zu).
  const crmStart = { ...(termin.bezug?.kontaktId ? { kontaktId: termin.bezug.kontaktId } : {}), ...(termin.bezug?.firmaId ? { firmaId: termin.bezug.firmaId } : {}), ...(termin.bezug?.mandatId ? { mandatId: termin.bezug.mandatId } : {}), ...(termin.bezug?.dealId ? { dealId: termin.bezug.dealId } : {}) };
  const [crm, setCrm] = useState<Pick<BezugKennungen, 'kontaktId' | 'firmaId' | 'mandatId' | 'dealId'>>(crmStart);
  const gaesteStart: GastWahl[] = (termin.teilnehmer ?? []).map(x => ({ email: x.email, ...(x.name ? { name: x.name } : {}) }));
  const [gaeste, setGaeste] = useState<GastWahl[]>(gaesteStart);
  const [frage, setFrage] = useState<{ was: 'einladung' | 'aenderung' | 'absage' | 'antwort'; adressen: string[]; tun: () => void } | null>(null);
  const [fokusMeldung, setFokusMeldung] = useState<string | null>(null);
  const grund = nurAppleGrund(basis, icloud);
  const aus = !!grund;
  const art = f.art;
  const setF = (n: Fassung) => { setFRoh(n); schreibeMerker(MERKER_AENDERUNG(termin.uid), JSON.stringify(n) === JSON.stringify(start) ? null : { f: n, start }); };
  const endeTag = basis.ganztags ? basis.ende.slice(0, 10) : f.tag;

  /** Nur, was ich gegenüber `start` geändert habe. */
  const aenderungen = (): Record<string, unknown> => {
    const a = start;
    const body: Record<string, unknown> = {};
    const titel = art === 'arbeitsort' ? arbeitsortTitel({ art: f.arbeitsort, ...(f.arbeitsort === 'frei' ? { text: f.titel } : {}) }) : f.titel.trim();
    if (titel !== a.titel) body.titel = titel;
    if (f.ort !== a.ort) body.ort = f.ort;
    if (f.notiz !== a.notiz) body.notiz = f.notiz;
    if (f.farbe !== a.farbe) body.farbe = f.farbe || null;
    if (f.beschaeftigt !== a.beschaeftigt && art !== 'abwesend' && art !== 'fokus') body.beschaeftigt = f.beschaeftigt;
    if (f.sichtbarkeit !== a.sichtbarkeit) body.sichtbarkeit = f.sichtbarkeit;
    if (f.art !== a.art) body.art = f.art;
    if (!basis.ganztags && (f.tag !== a.tag || f.von !== a.von || f.bis !== a.bis)) { body.start = `${f.tag}T${f.von}`; body.ende = `${f.tag}T${f.bis}`; }
    return body;
  };
  const bezugAenderung = (): Record<string, string | null> | null => {
    const alt = termin.bezug ?? {};
    const neu: Record<string, string | null> = {};
    if (art === 'fokus') {
      if ((zuordnung.aufgabeId ?? '') !== (alt.aufgabeId ?? '')) neu.aufgabeId = zuordnung.aufgabeId ?? null;
      if ((zuordnung.mandatId ?? '') !== (alt.mandatId ?? '')) neu.mandatId = zuordnung.mandatId ?? null;
    } else if (art === 'termin') {
      for (const k of ['kontaktId', 'firmaId', 'mandatId', 'dealId'] as const) if ((crm[k] ?? '') !== (alt[k] ?? '')) neu[k] = crm[k] ?? null;
    }
    return Object.keys(neu).length ? neu : null;
  };
  /** Gäste geändert? (nur, wer eingeladen hat bzw. an einem Termin ohne Gäste) */
  const gaesteDarf = !aus && art === 'termin' && !basis.serie;
  const gaesteGeaendert = gaesteDarf && JSON.stringify(gaeste.map(g => g.email).sort()) !== JSON.stringify(gaesteStart.map(g => g.email).sort());

  const speichern = async (b: KTermin = basis, bestaetigt = false) => {
    const stand = b.stand;
    const body: Record<string, unknown> = aus ? {} : aenderungen();
    if (gaesteGeaendert) body.gaeste = gaeste.map(g => ({ email: g.email, ...(g.name ? { name: g.name } : {}), ...(g.kontaktId ? { kontaktId: g.kontaktId } : {}) }));
    const bezug = bezugAenderung();
    if (!Object.keys(body).length && !bezug) { schreibeMerker(MERKER_AENDERUNG(termin.uid), null); onZu(); return; }
    if (body.start && String(body.ende) <= String(body.start)) { setFehler('Das Ende liegt vor dem Anfang.'); return; }
    // Post an Gäste (K3): Änderung eines Termins mit Gästen oder eine neue Gästeliste → erst die Rückfrage.
    const bisher = (b.teilnehmer ?? []).map(x => x.email);
    const betroffen = Array.from(new Set([...(Object.keys(body).length ? bisher : []), ...(gaesteGeaendert ? gaeste.map(g => g.email) : [])]));
    if (betroffen.length && !bestaetigt) { setFrage({ was: bisher.length ? 'aenderung' : 'einladung', adressen: betroffen, tun: () => void speichern(b, true) }); return; }
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/kalender/termin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: objektSchluessel(termin), ...(stand && Object.keys(body).length ? { stand } : {}), ...body, ...(bezug ? { bezug } : {}), ...(bestaetigt ? { einladungBestaetigt: true } : {}) }) })
      .then(async x => ({ status: x.status, d: await x.json().catch(() => ({})) })).catch(() => ({ status: 0, d: { ok: false, fehler: 'Keine Verbindung — deine Änderung bleibt hier gemerkt.' } }));
    setLaeuft(false); setFrage(null);
    if (r.d.ok) { schreibeMerker(MERKER_AENDERUNG(termin.uid), null); onGespeichert(); onZu(); return; }
    if (r.status === 409 && r.d.einladung && Array.isArray(r.d.adressen)) { setFrage({ was: r.d.einladung, adressen: r.d.adressen, tun: () => void speichern(b, true) }); return; }
    if (r.status === 409 && r.d.konflikt) { setKonflikt(r.d.aktuell ?? null); setFehler(r.d.fehler ?? 'Inzwischen woanders geändert.'); return; }
    setFehler(r.d.fehler ?? 'Nicht gespeichert — deine Änderung bleibt hier gemerkt.');
  };
  /** Als Gast antworten (K3) — nach Klick, iCloud schickt die Antwort an die einladende Person. */
  const antworten = (status: 'zugesagt' | 'vielleicht' | 'abgesagt') => setFrage({ was: 'antwort', adressen: basis.organisator ? [basis.organisator.email] : [], tun: async () => {
    setLaeuft(true); setFehler(null);
    const r = await fetch('/api/kalender/termin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid: objektSchluessel(termin), antwort: status, einladungBestaetigt: true, ...(basis.stand ? { stand: basis.stand } : {}) }) }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false); setFrage(null);
    if (r.ok) { onGespeichert(); onZu(); } else setFehler(r.fehler ?? 'Antwort nicht gesendet.');
  } });
  const meineUebernehmen = () => { if (!konflikt) return; const neu = { ...konflikt }; setBasis(neu); setKonflikt(null); void speichern(neu); };
  const serverUebernehmen = () => { if (!konflikt) return; setBasis(konflikt); setStart(fassungVon(konflikt)); setFRoh(fassungVon(konflikt)); schreibeMerker(MERKER_AENDERUNG(termin.uid), null); setKonflikt(null); setFehler(null); };
  const loeschen = async (bestaetigt = false) => {
    // Mit Gästen (K3): iCloud schickt allen eine Absage — erst nach der Rückfrage.
    const bisher = (basis.teilnehmer ?? []).map(x => x.email);
    if (bisher.length && !bestaetigt) { setLoeschenFragen(false); setFrage({ was: 'absage', adressen: bisher, tun: () => void loeschen(true) }); return; }
    setLaeuft(true); setFehler(null);
    const r = await fetch(`/api/kalender/termin?uid=${encodeURIComponent(objektSchluessel(termin))}${basis.stand ? `&stand=${encodeURIComponent(basis.stand)}` : ''}${bestaetigt ? '&einladungBestaetigt=1' : ''}`, { method: 'DELETE' }).then(x => x.json()).catch(() => ({ ok: false, fehler: 'Keine Verbindung.' }));
    setLaeuft(false); setFrage(null);
    if (r.ok) { schreibeMerker(MERKER_AENDERUNG(termin.uid), null); onGespeichert(); onZu(); } else { setFehler(r.fehler ?? 'Nicht gelöscht.'); if (r.aktuell) setKonflikt(r.aktuell); setLoeschenFragen(false); }
  };
  const abbrechen = () => { schreibeMerker(MERKER_AENDERUNG(termin.uid), null); onZu(); };
  const fokusStarten = () => {
    const r = fokusFuerTermin({ uid: objektSchluessel(termin), titel: basis.titel, space }, zuordnung);
    setFokusMeldung(r.art === 'gestartet' ? 'Fokus läuft — der Zähler steht oben im Kopf.' : `Es läuft schon ein Fokus („${r.label}“) — erst im Kopf beenden.`);
  };

  const eingabe = { ...feld, fontSize: TYP.bedien, padding: '9px 12px', colorScheme: 'dark' as const };
  const beschr = { fontSize: 12.5, color: C.inkLeise };
  const tagText = (t: string) => new Date(`${t}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const farbe = farbeHex(f.farbe) ?? basis.farbeEigen ?? kalenderFarbe ?? WER_FARBE[basis.wer];
  // Andere Zone: die Zeit dort zusätzlich nennen („16:00–17:00 · in New York 10:00–11:00 GMT-04“).
  const zonenHinweis = basis.zone && !basis.ganztags ? (() => { const s = ausWandzeit(basis.start), e = ausWandzeit(basis.ende); return `in ${basis.zone.split('/').pop()!.replace(/_/g, ' ')} ${wandzeitIn(s, basis.zone).slice(11, 16)}–${wandzeitIn(e, basis.zone).slice(11, 16)} ${gmtText(basis.zone, s)}`; })() : null;
  return (
    <Fenster breit={580} onZu={onZu} titel={<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 12, height: 12, borderRadius: 4, background: art === 'abwesend' ? LEUCHT.kritisch : farbe, flex: '0 0 auto' }} />{basis.titel}</span>}>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>
        {basis.ganztags ? `${tagText(basis.start.slice(0, 10))}${endeTag > basis.start.slice(0, 10) ? ` – ${tagText(new Date(Date.parse(`${endeTag}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10))}` : ''} · ganztägig` : `${tagText(basis.start.slice(0, 10))} · ${uhr(basis.start)}–${uhr(basis.ende)} ${gmtText('Europe/Berlin', ausWandzeit(basis.start))}`}
        {zonenHinweis ? ` · ${zonenHinweis}` : ''}{' · '}{basis.kalender} ({WER_LABEL[basis.wer]})
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {art !== 'termin' && <Chip farbe={ART_INFO[art].farbe ?? LEUCHT.puls}>{ART_INFO[art].label}</Chip>}
        {!basis.maskiert && <Chip farbe={C.inkLeise}>{basis.beschaeftigt === false ? 'frei' : 'beschäftigt'}</Chip>}
        {basis.sichtbarkeit === 'privat' && <Chip farbe={LEUCHT.beziehung}>privat</Chip>}
        {basis.serie && <Chip farbe={C.inkLeise}>Serie</Chip>}
        {(basis.erinnerungen ?? []).map(m => <Chip key={m} farbe={C.inkLeise}>{erinnerungText(m)}</Chip>)}
      </div>
      {grund && <div style={{ fontSize: TYP.bedien, color: LEUCHT.achtung, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '9px 12px', lineHeight: 1.5 }}>{grund}</div>}
      {wiederhergestellt && !aus && <div style={{ fontSize: 12.5, color: LEUCHT.puls }}>Ungespeicherte Änderung wiederhergestellt.</div>}
      {!basis.maskiert && (<>
        {art === 'arbeitsort' ? (
          <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Arbeitsort</span>
            <Segmente liste={ARBEITSORTE.map(a => ({ id: a.id, label: a.label }))} aktiv={f.arbeitsort} onWahl={a => !aus && setF({ ...f, arbeitsort: a })} />
            {f.arbeitsort === 'frei' && <input value={f.titel} disabled={aus} onChange={e => setF({ ...f, titel: e.target.value })} placeholder="Ort" aria-label="Eigener Ort" style={eingabe} />}
          </div>
        ) : (
          <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Titel</span>
            <input value={f.titel} disabled={aus} onChange={e => setF({ ...f, titel: e.target.value })} style={eingabe} /></label>
        )}
        {!basis.ganztags && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'grid', gap: 4, flex: '1 1 150px' }}><span style={beschr}>Tag</span><input type="date" disabled={aus} value={f.tag} onChange={e => setF({ ...f, tag: e.target.value })} style={eingabe} /></label>
            <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={beschr}>Von</span><input type="time" step={300} disabled={aus} value={f.von} onChange={e => setF({ ...f, von: e.target.value })} style={eingabe} /></label>
            <label style={{ display: 'grid', gap: 4, flex: '0 1 110px' }}><span style={beschr}>Bis</span><input type="time" step={300} disabled={aus} value={f.bis} onChange={e => setF({ ...f, bis: e.target.value })} style={eingabe} /></label>
          </div>
        )}
        {art !== 'arbeitsort' && <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>Ort</span>
          <input value={f.ort} disabled={aus} onChange={e => setF({ ...f, ort: e.target.value })} placeholder="optional" style={eingabe} /></label>}
        <label style={{ display: 'grid', gap: 4 }}><span style={beschr}>{art === 'abwesend' ? 'Hinweis' : 'Beschreibung'}</span>
          <textarea value={f.notiz} disabled={aus} rows={3} onChange={e => setF({ ...f, notiz: e.target.value })} placeholder="optional" style={{ ...eingabe, resize: 'vertical', lineHeight: 1.5 }} /></label>
        {!aus && (
          <div style={{ display: 'grid', gap: 10 }}>
            {art !== 'arbeitsort' && <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Art</span>
              <Segmente liste={(['termin', 'abwesend', 'fokus'] as IcsArt[]).map(a => ({ id: a, label: ART_INFO[a].label }))} aktiv={art} onWahl={a => setF({ ...f, art: a })} /></div>}
            <div style={{ display: 'grid', gap: 6 }}><span style={beschr}>Farbe</span><FarbPunkte wert={f.farbe} onWahl={id => setF({ ...f, farbe: id })} kalenderFarbe={kalenderFarbe ?? WER_FARBE[basis.wer]} /></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
              {art !== 'abwesend' && art !== 'fokus' && <Segmente liste={[{ id: 'b', label: 'Beschäftigt' }, { id: 'f', label: 'Frei' }]} aktiv={f.beschaeftigt ? 'b' : 'f'} onWahl={v => setF({ ...f, beschaeftigt: v === 'b' })} />}
              <select value={f.sichtbarkeit} onChange={e => setF({ ...f, sichtbarkeit: e.target.value as Sichtbarkeit })} aria-label="Sichtbarkeit" style={{ ...eingabe, width: 'auto' }}>
                {(['standard', 'privat', 'oeffentlich'] as Sichtbarkeit[]).map(s => <option key={s} value={s}>{SICHTBARKEIT_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
        )}
        {/* K3: CRM am Termin (auch an Serien/Einladungen — nur der Neben-Bestand) und Gäste */}
        {art === 'termin' && <TerminVerknuepfen wert={crm} onWert={setCrm} />}
        {art === 'termin' && (gaesteDarf || (basis.teilnehmer?.length ?? 0) > 0) && (
          <GaesteWahl gaeste={gaeste} onGaeste={setGaeste} antworten={basis.teilnehmer} aus={!gaesteDarf}
            hinweis={basis.meineAntwort ? `Eingeladen von ${basis.organisator?.name ?? basis.organisator?.email ?? 'jemand anderem'}.` : gaesteGeaendert ? 'Neue Gäste bekommen die Einladung erst nach deiner Bestätigung beim Speichern.' : undefined} />
        )}
        {basis.meineAntwort && (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={beschr}>Deine Antwort: {TEILNAHME_LABEL[basis.meineAntwort]}</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Knopf farbe={LEUCHT.gut} aus={laeuft || basis.meineAntwort === 'zugesagt'} onClick={() => antworten('zugesagt')}>Zusagen</Knopf>
              <Knopf leise aus={laeuft || basis.meineAntwort === 'vielleicht'} onClick={() => antworten('vielleicht')}>Vielleicht</Knopf>
              <Knopf farbe={LEUCHT.kritisch} aus={laeuft || basis.meineAntwort === 'abgesagt'} onClick={() => antworten('abgesagt')}>Absagen</Knopf>
            </div>
          </div>
        )}
        {art === 'fokus' && (
          <div style={{ display: 'grid', gap: 8, background: `${ART_INFO.fokus.farbe}14`, border: `1px solid ${ART_INFO.fokus.farbe}40`, borderRadius: 12, padding: '10px 12px' }}>
            <span style={{ fontSize: 12.5, color: C.inkDim }}>Fokuszeit — startet die Zeitmessung (wie der Fokus im Kopf). Zählt auf Aufgabe, Mandat oder Einheit:</span>
            <ZuordnungWahl klein wert={zuordnung} setzen={setZuordnung} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Knopf farbe={ART_INFO.fokus.farbe} onClick={fokusStarten}>▶ Fokus starten</Knopf>
              {fokusMeldung && <span style={{ fontSize: 12.5, color: C.inkDim }}>{fokusMeldung}</span>}
            </div>
          </div>
        )}
      </>)}
      {konflikt && (
        <div style={{ display: 'grid', gap: 8, background: `${LEUCHT.achtung}14`, borderRadius: 10, padding: '10px 12px', fontSize: TYP.bedien }}>
          <span>Inzwischen woanders geändert: <b>{konflikt.titel}</b> · {konflikt.ganztags ? 'ganztägig' : `${uhr(konflikt.start)}–${uhr(konflikt.ende)}`} am {tagText(konflikt.start.slice(0, 10))}. Deine Fassung steht oben in den Feldern.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Knopf farbe={LEUCHT.puls} aus={laeuft} onClick={meineUebernehmen}>Meine Fassung speichern</Knopf>
            <Knopf leise onClick={serverUebernehmen}>Andere Fassung übernehmen</Knopf>
          </div>
        </div>
      )}
      {fehler && !konflikt && <div style={{ fontSize: 12.5, color: LEUCHT.kritisch }}>{fehler}</div>}
      {frage && <EinladungFrage was={frage.was} adressen={frage.adressen} laeuft={laeuft} onJa={frage.tun} onNein={() => setFrage(null)} />}
      {!basis.maskiert && !frage && (loeschenFragen && !aus ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: `${LEUCHT.kritisch}14`, borderRadius: 10, padding: '9px 12px' }}>
          <span style={{ fontSize: TYP.bedien, flex: 1 }}>Termin wirklich löschen? Er verschwindet auch auf iPhone und Mac.{basis.teilnehmer?.length ? ' Die Gäste bekommen eine Absage (nächster Schritt).' : ''}</span>
          <Knopf farbe={LEUCHT.kritisch} aus={laeuft} onClick={() => void loeschen()}>Ja, löschen</Knopf>
          <Knopf leise onClick={() => setLoeschenFragen(false)}>Nein</Knopf>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Knopf aus={laeuft || (!aus && art !== 'arbeitsort' && !f.titel.trim())} onClick={() => void speichern()}>{laeuft ? 'Speichert …' : 'Speichern'}</Knopf>
            <Knopf leise onClick={abbrechen}>Abbrechen</Knopf>
          </div>
          {!aus && <Knopf leise onClick={() => setLoeschenFragen(true)}>Löschen</Knopf>}
        </div>
      ))}
    </Fenster>
  );
}
