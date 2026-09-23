'use client';

// ─── MAKE OS — Stimme ───────────────────────────────────────────────────────
// Kevins Ansage: „und gleichzeitig auch mit ihm sprechen."
//
// Beides läuft im Browser, ohne fremden Dienst: die Spracherkennung (Web Speech
// API) und die Ausgabe (SpeechSynthesis). Kein Audio verlässt das System außer
// zur Erkennung durch den Browser selbst — nichts wird bei uns gespeichert.
//
// Regeln, die hier drinstecken:
//   · Beim Vorlesen wird das Mikrofon abgeschaltet — sonst hört Jarvis sich
//     selbst zu und antwortet auf die eigene Stimme.
//   · Diktat endet von selbst, wenn Kevin aufhört zu reden (continuous=false).
//     Der fertige Satz geht dann als Nachricht raus.
//   · Deutsche Stimme wird gezielt gewählt, nicht dem Zufall überlassen.

import { useCallback, useEffect, useRef, useState } from 'react';

// Die Web-Speech-Typen fehlen in lib.dom — wir deklarieren das Nötigste selbst.
interface ErkennungsErgebnis { isFinal: boolean; 0: { transcript: string }; length: number }
interface ErkennungsEvent { resultIndex: number; results: { length: number; [i: number]: ErkennungsErgebnis } }
interface Erkennung {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: ErkennungsEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onstart: (() => void) | null;
}
type ErkennungsKlasse = new () => Erkennung;

function erkennungsKlasse(): ErkennungsKlasse | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: ErkennungsKlasse; webkitSpeechRecognition?: ErkennungsKlasse };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Deutsche Stimmen in der Reihenfolge, in der sie sich am wenigsten nach
 * Automat anhören. „Anna" ist die alte macOS-Stimme und klingt blechern —
 * die neueren (Reed, Sandy, Shelley, Flo) sind die modernen Siri-Stimmen und
 * stehen deshalb vorn. Kevin kann die Stimme trotzdem selbst wählen.
 */
const LIEBLINGE = ['reed', 'sandy', 'shelley', 'flo', 'rocko', 'eddy', 'google deutsch', 'petra', 'markus', 'anna'];

export function deutscheStimmen(alle: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const de = alle.filter(v => v.lang?.toLowerCase().startsWith('de'));
  const rang = (v: SpeechSynthesisVoice) => {
    const i = LIEBLINGE.findIndex(n => v.name.toLowerCase().includes(n));
    return i === -1 ? LIEBLINGE.length : i;
  };
  return de.slice().sort((a, b) => rang(a) - rang(b));
}

function besteStimme(alle: SpeechSynthesisVoice[], wunsch?: string): SpeechSynthesisVoice | null {
  const de = deutscheStimmen(alle);
  if (!de.length) return null;
  if (wunsch) {
    const gewaehlt = de.find(v => v.name === wunsch);
    if (gewaehlt) return gewaehlt;
  }
  return de[0];
}

/** Kurzform des Namens: „Reed (Deutsch (Deutschland))" → „Reed". */
export const stimmKurz = (name: string) => name.split('(')[0].trim();

export interface Stimme {
  /** Erkennung im Browser vorhanden? */
  kannHoeren: boolean;
  /** Ausgabe im Browser vorhanden? */
  kannSprechen: boolean;
  hoert: boolean;
  spricht: boolean;
  /** Was gerade erkannt wird, noch nicht abgeschickt. */
  teil: string;
  /** Letzter Fehler im Klartext (z. B. Mikrofon verweigert). */
  fehler: string;
  stimmName: string;
  /** Alle deutschen Stimmen des Rechners, beste zuerst. */
  stimmen: { name: string; kurz: string }[];
  waehleStimme(name: string): void;
  hoerZu(): void;
  hoerAuf(): void;
  lies(text: string, danach?: () => void): void;
  schweig(): void;
}

const MERKER_STIMME = 'make-os-jarvis-stimmname';

export function useStimme(onSatz: (text: string) => void): Stimme {
  const [kannHoeren, setKannHoeren] = useState(false);
  const [kannSprechen, setKannSprechen] = useState(false);
  const [hoert, setHoert] = useState(false);
  const [spricht, setSpricht] = useState(false);
  const [teil, setTeil] = useState('');
  const [fehler, setFehler] = useState('');
  const [stimmName, setStimmName] = useState('');

  const erk = useRef<Erkennung | null>(null);
  const fertig = useRef('');
  const stimme = useRef<SpeechSynthesisVoice | null>(null);
  const danachRef = useRef<(() => void) | null>(null);
  // onSatz kommt aus dem Panel und ändert sich bei jedem Render — über den Ref
  // bleibt der einmal gebaute Erkenner trotzdem aktuell.
  const satzRef = useRef(onSatz);
  satzRef.current = onSatz;

  // ── Erkennung einmal aufbauen ──
  useEffect(() => {
    const K = erkennungsKlasse();
    if (!K) return;
    setKannHoeren(true);
    const r = new K();
    r.lang = 'de-DE';
    r.continuous = false;   // hört von selbst auf, wenn Kevin fertig ist
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onstart = () => { setHoert(true); setFehler(''); };
    r.onresult = e => {
      let offen = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fertig.current = `${fertig.current} ${t}`.trim();
        else offen += t;
      }
      setTeil(offen);
    };
    r.onerror = e => {
      const c = e.error ?? '';
      setFehler(
        c === 'not-allowed' || c === 'service-not-allowed' ? 'Mikrofon nicht erlaubt — im Browser freigeben.'
        : c === 'no-speech' ? '' // still geblieben, kein echter Fehler
        : c === 'audio-capture' ? 'Kein Mikrofon gefunden.'
        : c === 'network' ? 'Erkennung offline nicht erreichbar.'
        : c ? `Erkennung: ${c}` : '',
      );
    };
    r.onend = () => {
      setHoert(false);
      setTeil('');
      const t = fertig.current.trim();
      fertig.current = '';
      if (t) satzRef.current(t);
    };
    erk.current = r;
    return () => { try { r.onend = null; r.abort(); } catch { /* egal */ } };
  }, []);

  // ── Stimme wählen (Liste kommt bei manchen Browsern verzögert) ──
  const [stimmen, setStimmen] = useState<{ name: string; kurz: string }[]>([]);
  const wunsch = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    setKannSprechen(true);
    try { wunsch.current = localStorage.getItem(MERKER_STIMME) ?? undefined; } catch { /* egal */ }
    const waehle = () => {
      const alle = window.speechSynthesis.getVoices();
      const de = deutscheStimmen(alle);
      setStimmen(de.map(v => ({ name: v.name, kurz: stimmKurz(v.name) })));
      const v = besteStimme(alle, wunsch.current);
      if (v) { stimme.current = v; setStimmName(v.name); }
    };
    waehle();
    window.speechSynthesis.addEventListener('voiceschanged', waehle);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', waehle);
      try { window.speechSynthesis.cancel(); } catch { /* egal */ }
    };
  }, []);

  const waehleStimme = useCallback((name: string) => {
    wunsch.current = name;
    try { localStorage.setItem(MERKER_STIMME, name); } catch { /* egal */ }
    const v = window.speechSynthesis.getVoices().find(x => x.name === name);
    if (v) { stimme.current = v; setStimmName(v.name); }
  }, []);

  const hoerAuf = useCallback(() => { try { erk.current?.stop(); } catch { /* egal */ } }, []);

  const schweig = useCallback(() => {
    danachRef.current = null;
    try { window.speechSynthesis.cancel(); } catch { /* egal */ }
    setSpricht(false);
  }, []);

  const hoerZu = useCallback(() => {
    if (!erk.current) return;
    // Nie gleichzeitig reden und hören — sonst diktiert Jarvis sich selbst.
    schweig();
    fertig.current = '';
    setTeil('');
    try { erk.current.start(); } catch { /* läuft schon */ }
  }, [schweig]);

  const lies = useCallback((text: string, danach?: () => void) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { danach?.(); return; }
    hoerAuf();
    try { window.speechSynthesis.cancel(); } catch { /* egal */ }
    const sauber = text.trim();
    if (!sauber) { danach?.(); return; }
    danachRef.current = danach ?? null;
    const u = new SpeechSynthesisUtterance(sauber.slice(0, 4000));
    if (stimme.current) u.voice = stimme.current;
    u.lang = stimme.current?.lang ?? 'de-DE';
    u.rate = 1.02;   // ruhig, aber nicht schläfrig
    u.pitch = 0.95;
    u.onstart = () => setSpricht(true);
    const raus = () => {
      setSpricht(false);
      const d = danachRef.current;
      danachRef.current = null;
      d?.();
    };
    u.onend = raus;
    u.onerror = raus;
    window.speechSynthesis.speak(u);
  }, [hoerAuf]);

  // Beim Verlassen der Seite nicht weiterreden.
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* egal */ } }, []);

  return { kannHoeren, kannSprechen, hoert, spricht, teil, fehler, stimmName, stimmen, waehleStimme, hoerZu, hoerAuf, lies, schweig };
}
