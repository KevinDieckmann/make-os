'use client';

// ─── MAKE OS — Wie laut gerade gesprochen wird ──────────────────────────────
// Kevins Kritik vom 07.09.: „da ist ja nichts Lebendiges dran."
//
// Der eigentliche Grund dafür war, dass das Hirn nichts WEISS. Es pulsierte
// nach einer festen Kurve, egal ob jemand redet oder nicht. Ein Orb, der auf
// die eigene Stimme reagiert, fühlt sich sofort an, als würde er zuhören —
// und das kostet nur eine Zahl zwischen 0 und 1.
//
// Drei Dinge, die aus der Recherche kamen und den Unterschied machen:
//   · autoGainControl AUS. Sonst regelt der Browser die Lautstärke glatt und
//     der Ausschlag verschwindet genau dann, wenn er interessant wäre.
//   · Nur das Sprachband messen (siehe lib/make-one/pegel.ts), nicht das
//     ganze Spektrum. Sonst reagiert der Kranz auf den Lüfter.
//   · Der Wert geht nur alle 50 ms nach React. 60 Renderdurchläufe je
//     Sekunde wären in einer React-Anwendung das teuerste, was man tun kann.
//     Die Bewegung dazwischen macht das SVG selbst.
//
// Zum Mikrofon: der Zugriff wird NUR gehalten, solange wirklich zugehört
// wird. Beim Loslassen wird der Datenstrom beendet, nicht nur pausiert —
// sonst zeigt der Browser dauerhaft die rote Aufnahme-Anzeige, und das wäre
// unehrlich.

import { useCallback, useEffect, useRef, useState } from 'react';
import { sprachBereich, huelle, spreize } from '@/lib/make-one/pegel';

/** Wie oft der Wert nach React geht. 20 mal je Sekunde reicht fürs Auge. */
const MELDE_ABSTAND = 50;

export function useLautstaerke(): {
  /** 0 bis 1, geglättet. 0, solange nicht gehört wird. */
  pegel: number;
  starte: () => Promise<void>;
  stoppe: () => void;
  laeuft: boolean;
  /** Wenn das Mikrofon abgelehnt oder nicht gefunden wurde. */
  fehler: string;
} {
  const [pegel, setPegel] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState('');
  const kontext = useRef<AudioContext | null>(null);
  const strom = useRef<MediaStream | null>(null);
  const bild = useRef<number | null>(null);
  const geglaettet = useRef(0);

  const stoppe = useCallback(() => {
    if (bild.current != null) { cancelAnimationFrame(bild.current); bild.current = null; }
    strom.current?.getTracks().forEach(t => t.stop());
    strom.current = null;
    kontext.current?.close().catch(() => {});
    kontext.current = null;
    geglaettet.current = 0;
    setPegel(0);
    setLaeuft(false);
  }, []);

  const starte = useCallback(async () => {
    if (kontext.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Echo und Rauschen darf der Browser wegrechnen — das hilft der
          // Erkennung. Die Verstärkungsregelung darf er NICHT: sie macht
          // laut und leise gleich laut, und genau der Unterschied ist hier
          // die ganze Information.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      // Auf manchen Rechnern startet der Audiokontext angehalten; die Geste
      // (Knopf gedrückt) liegt vor, also darf er geweckt werden.
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const quelle = ctx.createMediaStreamSource(s);
      const messer = ctx.createAnalyser();
      // 1024 gibt Fächer von rund 47 Hz — fein genug, um das Sprachband zu
      // treffen, grob genug, um billig zu bleiben.
      messer.fftSize = 1024;
      messer.smoothingTimeConstant = 0.75;
      quelle.connect(messer);

      strom.current = s;
      kontext.current = ctx;
      setLaeuft(true);
      setFehler('');

      // Einmal angelegt, nie wieder: ein neues Array je Bild wäre Arbeit für
      // die Speicherbereinigung und damit ein Ruckler alle paar Sekunden.
      const werte = new Uint8Array(messer.frequencyBinCount);
      const band = sprachBereich(ctx.sampleRate, messer.frequencyBinCount);
      let letzteMeldung = 0;

      const takt = (t: number) => {
        messer.getByteFrequencyData(werte);
        let summe = 0;
        for (let i = band.von; i <= band.bis; i++) summe += werte[i];
        const roh = summe / (band.bis - band.von + 1) / 255;
        geglaettet.current = huelle(geglaettet.current, spreize(roh));
        if (t - letzteMeldung > MELDE_ABSTAND) {
          letzteMeldung = t;
          setPegel(Math.round(geglaettet.current * 100) / 100);
        }
        bild.current = requestAnimationFrame(takt);
      };
      bild.current = requestAnimationFrame(takt);
    } catch (e) {
      // Kein Mikrofon oder abgelehnt: das Hirn atmet dann eben nach Uhr.
      // Gesagt wird es trotzdem — stilles Nichtfunktionieren ist das
      // Schlimmste, was eine Oberfläche tun kann.
      const name = (e as { name?: string })?.name ?? '';
      setFehler(name === 'NotAllowedError' ? 'Mikrofon nicht freigegeben' : 'Kein Mikrofon gefunden');
      setLaeuft(false);
    }
  }, []);

  useEffect(() => stoppe, [stoppe]);

  return { pegel, starte, stoppe, laeuft, fehler };
}
