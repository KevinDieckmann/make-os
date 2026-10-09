'use client';

// ─── MAKE OS — Der Kopf über jeder Seite (Aufräumen Etappe 1, 08.10.) ───────
// Kevin (08.10.): „Die Software wirkt unaufgeräumt und überladen.“ Seitdem trägt der Kopf nur noch vier Dinge: links den
// Schalter Alles · Privat · Business (Nachbesserung 08.10.: EIN Schalter, oben, mit „Alles“ — die Leiste zeigt die Punkte der
// Wahl, Heute folgt ihm; am Handy kompakt), in der Mitte die Suche (⌘K), rechts
// die Glocke und den Fokus-Zähler. Heute, Inbox und Kalender stehen in der Leiste; der Wachstums-Score und der Index des
// Space sind Karten auf Heute (und unter Planung › Wachstum bzw. Finanzen). Datei hieß bis 26.09. WachstumsKopf.tsx.

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { useRueckfrage } from './ui';
import { Search, Timer, Square, Tag } from 'lucide-react';
import { useSpace } from '@/hooks/useSpace';
import { SPACE_WAHLEN, wahlInfo, wechselZiel, type SpaceId, type SpaceWahl } from '@/lib/make-one/spaces';
import { teile } from '@/lib/zeitmessung/modell';
import { gemerkterFokus, fokusMerken, fokusAbgleichen, FOKUS_MERKER, FOKUS_EREIGNIS, type LaufenderFokus } from '@/lib/zeitmessung/fokus-laufend';
import { useTasks } from '@/context/TasksContext';
import { ZuordnungWahl, type Zuordnung } from './zeit/Zuordnung';
import { useMandate } from './zeit/useMandate';
import { fokusTitel } from '@/lib/zeitmessung/fokus-regeln';
import { zeitSchluessel } from '@/lib/zeitmessung/bereich';
import { Glocke } from './Glocke';
import { UpdateHinweis } from './UpdateHinweis';
import { useNurBusiness } from './useInhaber';

/** Zeit-Ereignis: der Fokus-Zähler meldet einen gespeicherten Block (Zeit je Einheit/Mandat laden dann neu). */
export const ZEIT_EREIGNIS = 'make-zeit-geaendert';

/**
 * Der Schalter (08.10., Nachbesserung): drei Knöpfe Alles · Privat · Business in ihrer Farbe — der EINE Ort, an dem der Bereich
 * gewählt wird (Heute hat keinen eigenen mehr). Ein Klick wechselt die Wahl; steht man auf einem Punkt der Leiste mit Gegenstück
 * in der neuen Wahl (Inbox, Aufgaben, Finanzen …), geht es dorthin; Seiten nur eines Bereichs bleiben stehen (`wechselZiel`).
 */
function SpaceSchalter({ wahl, setzen }: { wahl: SpaceWahl; setzen: (s: SpaceWahl) => void }) {
  const router = useRouter();
  const pfad = usePathname() ?? '/os';
  const { suche, ausAdresse } = useSpace();
  // Konto „nur Business“ (09.10., E4-Rest): kein Knopf „Privat“ — der Server liefert dort nichts aus dem Haushalt. Ein nur GEMERKTES
  // „Privat“ (keine Seite, kein `?space=`) springt einmal auf Business; eine Adresse mit Privat bleibt, wie sie ist (Seiten zeigen dann leer).
  const nurBusiness = useNurBusiness();
  const wahlen = nurBusiness ? SPACE_WAHLEN.filter(id => id !== 'privat') : SPACE_WAHLEN;
  useEffect(() => { if (nurBusiness && wahl === 'privat' && !ausAdresse) setzen('business'); }, [nurBusiness, wahl, ausAdresse, setzen]);
  const waehlen = (s: SpaceWahl) => {
    if (s === wahl) return;
    setzen(s);
    const ziel = wechselZiel(pfad, suche, s);
    if (ziel) router.push(ziel);
  };
  return (
    <span role="group" aria-label="Bereich wählen" className="kopf-space" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', flex: '0 0 auto' }}>
      {SPACE_WAHLEN.map(id => {
        if (!wahlen.includes(id)) return null;
        const s = wahlInfo(id);
        const an = id === wahl;
        return (
          <button key={id} type="button" onClick={() => waehlen(id)} aria-pressed={an} title={an ? `${s.label} ist gewählt` : id === 'alles' ? 'Privat und Business zusammen' : `Nur ${s.label}`} className="fassbar"
            style={{ minHeight: 40, minWidth: 44, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, whiteSpace: 'nowrap',
              border: `1px solid ${an ? `${s.farbe}66` : 'transparent'}`, background: an ? `${s.farbe}1F` : 'transparent', color: an ? s.farbe : C.inkDim }}>
            {s.label}
          </button>
        );
      })}
    </span>
  );
}

// ── Fokus-Zähler (Kevin 26.09. spät: „mit Fokus auch wieder messen“) ────────
// Startet bewusste Zeit für den Bereich, auf dem man gerade ist. Läuft über Seitenwechsel
// hinweg (localStorage, lib/zeitmessung/fokus-laufend.ts) und wird beim Stopp als Block verbucht
// (/api/state/zeit). Seit 27.09. spät: im Business lässt sich der laufende Block gleich einer
// Aufgabe oder Einheit zuordnen (Chip neben dem Zähler); das Aufgaben-Detail kann ihn starten.
// Seit 28.09. auch einem Mandat (Kevin: „Mandat an Zielen und Zeit“ — Zeit je Mandat).
const uhr = (sek: number) => {
  const h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
/**
 * Zuordnen im Kopf (27.09. spät): ein kleiner Knopf neben dem laufenden Zähler öffnet ein Feld mit Aufgabe und Einheit —
 * zwei Chips direkt im Kopf hätten ihn überlaufen lassen. Punkt am Knopf = zugeordnet.
 */
const MENUES = '[data-wahl-menue],.wahl-hinter,[role="listbox"],[role="menu"]';
function FokusZuordnenKnopf({ wert, setzen }: { wert: Zuordnung; setzen: (z: Zuordnung) => void }) {
  const [auf, setAuf] = useState(false);
  const feldRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!auf) return;
    // Die Menüs der Chips hängen als Portal am Seitenende — ein Klick dort schließt das Feld nicht.
    const weg = (e: MouseEvent) => {
      const z = e.target as HTMLElement | null;
      if (feldRef.current?.contains(z) || z?.closest?.(MENUES)) return;
      setAuf(false);
    };
    const taste = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector(MENUES)) setAuf(false); };
    document.addEventListener('mousedown', weg);
    document.addEventListener('keydown', taste);
    return () => { document.removeEventListener('mousedown', weg); document.removeEventListener('keydown', taste); };
  }, [auf]);
  const gesetzt = !!(wert.aufgabeId || wert.einheit || wert.mandatId);
  return (
    <span ref={feldRef} className="wachstum-kopf-label" style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAuf(a => !a)} aria-expanded={auf} aria-label="Fokus einer Aufgabe, einem Mandat oder einer Einheit zuordnen" title={gesetzt ? 'Zuordnung ändern' : 'Einer Aufgabe, einem Mandat oder einer Einheit zuordnen'} className="fassbar kopf-rund" style={{ ...rund(gesetzt), position: 'relative', cursor: 'pointer', background: 'none', padding: 0 }}>
        <Tag size={14} strokeWidth={1.9} />
      </button>
      {auf && (
        <span role="group" aria-label="Fokus zuordnen" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 40, display: 'grid', gap: 8, padding: '12px 14px', minWidth: 280, maxWidth: 380, borderRadius: 14, background: C.flaeche, border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 18px 50px -12px rgba(0,0,0,.75)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Fokus zuordnen</span>
          <ZuordnungWahl klein wert={wert} setzen={setzen} />
          <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Zählt auf das Mandat und seine Einheit — sonst auf die Einheit der Aufgabe oder die gewählte.</span>
        </span>
      )}
    </span>
  );
}

function FokusZaehler({ pfad, space }: { pfad: string; space: SpaceId }) {
  const [laufend, setLaufend] = useState<LaufenderFokus | null>(null);
  const [jetzt, setJetzt] = useState(0);
  const { state } = useTasks();
  const { bestaetigen, dialog: frage } = useRueckfrage();
  // Der Kopf hat `backdrop-filter` (.wachstum-kopf) — darin wäre das fixierte Overlay auf die Kopfhöhe begrenzt: ins <body> hängen.
  const dialog = frage && typeof document !== 'undefined' ? createPortal(frage, document.body) : null;
  // Mandat im Kopf nennen (29.09.) — die Mandate nur laden, wenn eins zugeordnet ist (der Kopf steht auf jeder Seite).
  const { karte: mandate } = useMandate(!!laufend?.mandatId);
  useEffect(() => {
    const lesen = () => { setLaufend(gemerkterFokus()); setJetzt(Date.now()); };
    lesen();
    // Der Server hält den laufenden Fokus je Person (29.09.) — beim Öffnen und bei Fokus abgleichen (anderes Gerät, Tab-Verlust).
    void fokusAbgleichen();
    const fokus = () => { void fokusAbgleichen(); };
    const fremd = (e: StorageEvent) => { if (e.key === FOKUS_MERKER) lesen(); };
    window.addEventListener(FOKUS_EREIGNIS, lesen);
    window.addEventListener('storage', fremd);
    window.addEventListener('focus', fokus);
    return () => { window.removeEventListener(FOKUS_EREIGNIS, lesen); window.removeEventListener('storage', fremd); window.removeEventListener('focus', fokus); };
  }, []);
  useEffect(() => {
    if (!laufend) return;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [laufend]);
  const starten = () => {
    const { schluessel, bereich } = zeitSchluessel(pfad, window.location.search, space);
    fokusMerken({ von: new Date().toISOString(), schluessel, label: bereich.label });
  };
  const zuordnen = (z: Zuordnung) => {
    if (!laufend) return;
    const { aufgabeId: _a, einheit: _e, mandatId: _m, ...rest } = laufend;
    fokusMerken({ ...rest, ...(z.aufgabeId ? { aufgabeId: z.aufgabeId } : {}), ...(z.einheit ? { einheit: z.einheit } : {}), ...(z.mandatId ? { mandatId: z.mandatId } : {}) });
  };
  const stoppen = async () => {
    if (!laufend) return;
    const l = laufend;
    // Erst der fertige Block, dann den laufenden löschen (29.09.) — scheitert das Speichern, läuft der Zähler weiter,
    // statt dass die Fokus-Zeit still verloren geht.
    let status = 0, grund = '';
    try {
      const r = await fetch('/api/state/zeit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktion: 'fokus', von: l.von, bis: new Date().toISOString(), schluessel: l.schluessel, label: l.label, aufgabeId: l.aufgabeId, einheit: l.einheit, mandatId: l.mandatId, terminUid: l.terminUid }) });
      status = r.status;
      if (!r.ok) grund = String(((await r.json().catch(() => ({}))) as { error?: string }).error ?? '');
    } catch { status = 0; }
    if (status < 200 || status >= 300) {
      // Inhaltlich abgelehnt (400): fragen statt endlos weiterzählen; sonst (Netz, 5xx, Sitzung) weiterlaufen lassen.
      if (status === 400 && (await bestaetigen({ titel: 'Zähler trotzdem beenden?', text: `Fokus-Block abgelehnt${grund ? `: ${grund}` : ''}.\n\nDiese Zeit wird nicht gezählt.`, ja: 'Beenden', gefahr: true }))) fokusMerken(null);
      else if (status !== 400) window.alert('Fokus-Zeit nicht gespeichert (keine Verbindung oder Server nicht erreichbar). Der Zähler läuft weiter — bitte gleich noch einmal beenden.');
      return;
    }
    fokusMerken(null);
    window.dispatchEvent(new Event(ZEIT_EREIGNIS));
  };
  if (laufend) {
    const sek = Math.max(0, Math.round((jetzt - Date.parse(laufend.von)) / 1000));
    const aufgabe = laufend.aufgabeId ? state.tasks.find(t => t.id === laufend.aufgabeId)?.title : undefined;
    const titel = fokusTitel(laufend, aufgabe, laufend.mandatId ? mandate.get(laufend.mandatId) : null);
    const text = titel.length > 22 ? `${titel.slice(0, 21)}…` : titel;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto', minWidth: 0 }}>
        <button onClick={stoppen} title={`Fokus „${titel}“ beenden`} className="fassbar fokus-laeuft" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', minHeight: 40, borderRadius: 999, border: `1px solid ${C.aktiv}66`, background: `${C.aktiv}14`, color: C.ink, cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap', flex: '0 0 auto' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: C.aktiv, boxShadow: `0 0 8px ${C.aktiv}` }} />
          <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{uhr(sek)}</span>
          <span className="wachstum-kopf-label" style={{ fontSize: TYP.bedien, color: C.inkDim }}>{text}</span>
          <Square size={10} fill="currentColor" strokeWidth={0} style={{ color: C.inkLeise }} />
        </button>
        {teile(laufend.schluessel).space === 'business' && (
          <FokusZuordnenKnopf wert={{ aufgabeId: laufend.aufgabeId, einheit: laufend.einheit, mandatId: laufend.mandatId }} setzen={zuordnen} />
        )}
        {dialog}
      </span>
    );
  }
  return (
    <>
      <button onClick={starten} title="Fokus starten — bewusste Zeit für diesen Bereich" aria-label="Fokus starten" className="kopf-knopf" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div className="kopf-rund" style={rund(false)}><Timer size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: C.inkLeise }}>Fokus</span></div>
      </button>
      {dialog}
    </>
  );
}

/** Runder Kopf-Knopf: Größe über `.kopf-rund` (globals.css: 40 px am Rechner, 44 px am Handy), hier nur Farbe/Rand nach Zustand. */
const rund = (an: boolean) => ({ border: `2px solid ${an ? C.aktiv : 'rgba(255,255,255,.1)'}`, color: an ? C.aktiv : C.inkDim } as const);

export function Kopf() {
  const pfad = usePathname() ?? '';
  const { space, wahl, setzen } = useSpace();
  const sp = wahlInfo(wahl);
  const suchen = () => window.dispatchEvent(new CustomEvent('make-suche', { detail: { space } }));
  return (
    <div className="wachstum-kopf os-auf">
      {/* Update-Hinweis (08.10., Phase 0): eine ruhige Zeile über dem Kopf, nur solange ein Update läuft bzw. eine neue Version da ist. */}
      <UpdateHinweis />
      <div className="wachstum-kopf-innen">
        {/* Links der Schalter Alles · Privat · Business, dann die Suche ausgeglichen in der Mitte (gibt zuerst nach, flex-shrink 1000), rechts Glocke und Fokus. */}
        <SpaceSchalter wahl={wahl} setzen={setzen} />
        <button onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" className="wachstum-kopf-suche fassbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1000 520px', minWidth: 150, maxWidth: 960, margin: '0 auto', padding: '9px 14px', minHeight: 44, borderRadius: 12, cursor: 'text', border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', color: C.inkLeise, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, textAlign: 'left' }}>
          <Search size={15} strokeWidth={1.9} style={{ flex: '0 0 auto' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{sp.suche}</span>
          <span className="nur-tastatur kopf-kuerzel" style={{ flex: '0 0 auto', fontSize: TYP.mikro, border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, padding: '1px 6px', color: C.inkLeise }}>⌘K</span>
        </button>
        <div className="wachstum-kopf-saeulen" style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center', minWidth: 0 }}>
          <button className="wachstum-kopf-lupe kopf-knopf" onClick={suchen} title="Suchen (⌘K)" aria-label="Suchen" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><div className="kopf-rund" style={rund(false)}><Search size={15} strokeWidth={1.9} /></div><span className="wachstum-kopf-label" style={{ fontSize: TYP.mikro, color: C.inkLeise }}>Suche</span></div>
          </button>
          {/* Glocke (28.09. abends): Zuweisungen, Kommentare/Erwähnungen, fällig/überfällig — rot bei Ungelesenem */}
          <Glocke />
          <FokusZaehler pfad={pfad} space={space} />
        </div>
      </div>
    </div>
  );
}
