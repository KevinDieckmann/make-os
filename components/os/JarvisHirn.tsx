'use client';

// ─── MAKE OS — Das Hirn ─────────────────────────────────────────────────────
// Nach Kevins Vorlage vom 07.09. (magnific, „Futuristic time machines design"):
// konzentrische Ringe, feines technisches Linienwerk, ein leuchtender Kern.
//
// Bewusst GEZEICHNET und nicht als Bilddatei eingebunden. Nur so kann es
// pulsieren und auf etwas reagieren — und nur so hängen die Farben an
// design.ts statt an einem fremden PNG. Die beiden Farben der Vorlage sind
// ohnehin genau die des Hauses: Türkis trägt, Bernstein zeichnet.
//
// Alles hier ist deterministisch gerechnet, kein Zufall: Server und Browser
// müssen dieselben Koordinaten bekommen, sonst meldet React eine Abweichung
// (an genau dem Fehler hing heute schon das Agenten-Hirn). Deshalb werden
// auch alle Werte gerundet.
//
// AUFBAU (07.09., zweiter Durchgang). Kevins Einwand war berechtigt: das Bild
// war schön, aber tot. Es reagierte auf nichts. Jetzt gilt:
//   · Das GERÜST (rund 400 Elemente) ist memoisiert und rechnet nur neu, wenn
//     sich Zustand oder Auslastung ändern. Sonst würde jeder Bildschritt der
//     Uhr das ganze SVG neu bauen — das wäre bei 20 Bildern je Sekunde die
//     teuerste Startseite der Welt.
//   · Nur der KERN und der STIMMKRANZ hängen an der laufenden Uhr. Das sind
//     rund 70 Elemente statt 400.
//   · Die Zustände unterscheiden sich an der FARBE, nicht nur am Tempo — man
//     erkennt aus dem Augenwinkel, ob Jarvis zuhört, denkt oder spricht.

import { memo, useEffect, useState } from 'react';
import { useNachziehen } from '@/hooks/useAtem';
import { FARBE as C } from '@/lib/make-one/design';

const MITTE = 310;
const rund = (z: number) => Math.round(z * 100) / 100;

/** Punkt auf einem Kreis. Grad, 0° = oben, im Uhrzeigersinn. */
function pol(r: number, grad: number): { x: number; y: number } {
  const b = ((grad - 90) * Math.PI) / 180;
  return { x: rund(MITTE + r * Math.cos(b)), y: rund(MITTE + r * Math.sin(b)) };
}

/** Kreisbogen als Pfad — für Segmente mit Lücke. */
function bogen(r: number, von: number, bis: number): string {
  const a = pol(r, von), b = pol(r, bis);
  const gross = bis - von > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${gross} 1 ${b.x} ${b.y}`;
}

/** Gleichmäßig verteilte Winkel. */
const winkel = (n: number, versatz = 0) => Array.from({ length: n }, (_, i) => (i * 360) / n + versatz);

/** Vieleck auf einem Kreis — gibt der Mitte eine technische Form. */
function vieleck(r: number, n: number, versatz = 0): string {
  return winkel(n, versatz).map((g, i) => {
    const p = pol(r, g);
    return `${i ? 'L' : 'M'} ${p.x} ${p.y}`;
  }).join(' ') + ' Z';
}

/**
 * Die stillen Ringe. In der Vorlage liegen sehr viele feine Kreise
 * übereinander — sie tragen keine Bedeutung, sie machen die Dichte. Fest
 * aufgezählt statt zufällig, damit Server und Browser dasselbe zeichnen.
 */
const STILLE_RINGE: { r: number; op: number; strich?: string; farbe?: 'aktiv' | 'achtung' }[] = [
  { r: 288, op: 0.10, farbe: 'achtung' },
  { r: 256, op: 0.14, strich: '1 6' },
  { r: 240, op: 0.10, farbe: 'achtung', strich: '3 5' },
  { r: 226, op: 0.12 },
  { r: 204, op: 0.16, strich: '1 4' },
  { r: 196, op: 0.09, farbe: 'achtung' },
  { r: 178, op: 0.13, strich: '2 7' },
  { r: 158, op: 0.10, farbe: 'achtung' },
  { r: 132, op: 0.14, strich: '1 5' },
  { r: 108, op: 0.10, farbe: 'achtung', strich: '2 4' },
  { r: 84, op: 0.16, strich: '1 3' },
  { r: 62, op: 0.12 },
];

/** Strahlenlänge: die vier Hauptrichtungen reichen weiter als die dazwischen. */
const fernStrahl = (g: number) => (Math.round(g) % 90 === 0 ? 314 : 302);

export type Zustand = 'ruht' | 'hoert' | 'denkt' | 'spricht';

/**
 * Die vier Zustände sind an der FARBE unterscheidbar, nicht nur am Tempo.
 * Türkis ist der Grundton; beim Zuhören wandert er ins Kühle, beim Denken ins
 * Bernstein des Hauses, beim Sprechen wird er heller und weiter.
 */
export const TON: Record<Zustand, {
  farbe: string; takt: number; weite: number; wort: string; richtung: number;
}> = {
  // `richtung` ist die wichtigste Zahl in dieser Tabelle.
  //
  // Beim ZUHÖREN zieht sich die Membran nach INNEN zusammen, beim SPRECHEN
  // dehnt sie sich nach AUSSEN. Beide Zustände hängen an einem Pegel — wenn
  // beide wachsen würden, wüsste man nie, wer gerade dran ist. So ist es auf
  // einen Blick unterscheidbar, ohne ein einziges Wort zu lesen.
  ruht:    { farbe: C.aktiv,   takt: 5.4, weite: 1.00, wort: 'bereit',     richtung:  0 },
  hoert:   { farbe: '#5AC8E8', takt: 4.2, weite: 0.94, wort: 'hört zu',    richtung: -1 },
  denkt:   { farbe: C.achtung, takt: 4.8, weite: 1.00, wort: 'denkt nach', richtung:  0 },
  spricht: { farbe: '#7BF0E4', takt: 3.2, weite: 1.06, wort: 'spricht',    richtung: +1 },
};

/**
 * Weiche Verformung ohne Rauschbibliothek: drei überlagerte Sinuswellen mit
 * teilerfremden Frequenzen. Das wiederholt sich erst nach sehr langer Zeit und
 * wirkt deshalb organisch — kostet aber fast nichts und ist auf Server und
 * Browser identisch.
 */
function beule(grad: number, t: number): number {
  const w = (grad * Math.PI) / 180;
  return (
    Math.sin(w * 3 + t * 0.9) * 0.55 +
    Math.sin(w * 5 - t * 0.61) * 0.30 +
    Math.sin(w * 2 + t * 1.37) * 0.15
  );
}

/** Geschlossener Pfad aus verformten Punkten — der lebende Kern. */
export function blob(r: number, t: number, staerke: number, punkte = 44): string {
  let d = '';
  for (let i = 0; i < punkte; i++) {
    const g = (i * 360) / punkte;
    const p = pol(r + beule(g, t) * staerke, g);
    d += `${i ? 'L' : 'M'} ${p.x} ${p.y} `;
  }
  return d + 'Z';
}

// ── Das Gerüst ──────────────────────────────────────────────────────────────
// Alles, was NICHT je Bild neu gerechnet werden muss. Memoisiert: rechnet nur,
// wenn sich Farbe, Takt, Helligkeit oder die Zahl der Aufträge ändern.

const Geruest = memo(function Geruest({ farbe, takt, glanz, aktiv, lebt }: {
  farbe: string; takt: number; glanz: number; aktiv: number; lebt: boolean;
}) {
  return (
    <>
      {/* ── Strahlen nach außen: geben dem Bild seine Reichweite ─────────── */}
      <g stroke={farbe} strokeLinecap="round" className="hirn-auf" style={{ animationDelay: '.05s' }}>
        {winkel(8, 22.5).map(g => {
          const a = pol(292, g), b = pol(fernStrahl(g), g);
          return <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="1" opacity="0.3" />;
        })}
      </g>
      <g fill={farbe} opacity="0.4" className="hirn-auf" style={{ animationDelay: '.05s' }}>
        {winkel(8, 22.5).map(g => {
          const p = pol(fernStrahl(g) + 5, g);
          return <path key={g} d="M 0 -5 L 4 3 L -4 3 Z" transform={`translate(${p.x} ${p.y}) rotate(${rund(g)})`} />;
        })}
      </g>

      {/* ── Die stillen Ringe: sie tragen die Dichte ─────────────────────── */}
      <g fill="none" className="hirn-auf" style={{ animationDelay: '.14s' }}>
        {STILLE_RINGE.map(r => (
          <circle key={r.r} cx={MITTE} cy={MITTE} r={r.r}
            stroke={r.farbe === 'achtung' ? C.achtung : farbe}
            strokeWidth="0.8" opacity={rund(r.op * 1.6)}
            {...(r.strich ? { strokeDasharray: r.strich } : {})} />
        ))}
      </g>

      {/* ── Äußerer Teilkreis: 144 Striche, jeder sechste länger ─────────── */}
      <g stroke={C.achtung} strokeLinecap="butt" className="hirn-auf" style={{ animationDelay: '.22s' }}>
        {winkel(144).map((g, i) => {
          const lang = i % 6 === 0;
          const a = pol(lang ? 268 : 278, g);
          const b = pol(290, g);
          return (
            <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              strokeWidth={lang ? 1.6 : 0.8} opacity={lang ? 0.8 : 0.4} />
          );
        })}
      </g>
      <circle cx={MITTE} cy={MITTE} r="262" fill="none" stroke={C.achtung} strokeWidth="0.9" opacity="0.45" />

      {/* ── Laufender Ring: dreht langsam im Uhrzeigersinn ───────────────── */}
      <circle
        className={lebt ? 'hirn-dreht' : undefined}
        cx={MITTE} cy={MITTE} r="246" fill="none"
        stroke={farbe} strokeWidth="1.2" opacity="0.5"
        strokeDasharray="2 14"
        style={{ transformOrigin: `${MITTE}px ${MITTE}px`, animationDuration: `${takt * 16}s` }}
      />

      {/* ── Glyphenring in Bernstein: kleine Marken auf dem Kreis ────────── */}
      <g fill={C.achtung} opacity="0.65" className="hirn-auf" style={{ animationDelay: '.3s' }}>
        {winkel(24, 7.5).map(g => {
          const p = pol(232, g);
          return <rect key={g} x={rund(p.x - 2.6)} y={rund(p.y - 1.2)} width="5.2" height="2.4" rx="0.6"
            transform={`rotate(${rund(g)} ${p.x} ${p.y})`} />;
        })}
      </g>

      {/* ── Tragende Segmente: sechs Bögen mit Lücke, das Rückgrat ───────── */}
      <g fill="none" stroke={farbe} strokeLinecap="round" filter="url(#hirnGlanz)">
        {winkel(6).map(g => (
          <path key={g} d={bogen(214, g + 4, g + 56)} strokeWidth="3.4" opacity={glanz} />
        ))}
      </g>
      <g fill={farbe}>
        {winkel(6).map(g => {
          const p = pol(214, g + 4);
          return <circle key={g} cx={p.x} cy={p.y} r="3.4" opacity={glanz} />;
        })}
      </g>

      {/* ── Speichen: feines Gitter nach innen ───────────────────────────── */}
      <g stroke={farbe} strokeWidth="0.7" opacity="0.24">
        {winkel(36).map(g => {
          const a = pol(152, g), b = pol(198, g);
          return <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {/* ── Gegenläufiger Ring ───────────────────────────────────────────── */}
      <circle
        className={lebt ? 'hirn-dreht-zurueck' : undefined}
        cx={MITTE} cy={MITTE} r="186" fill="none"
        stroke={farbe} strokeWidth="1" opacity="0.34"
        strokeDasharray="18 10"
        style={{ transformOrigin: `${MITTE}px ${MITTE}px`, animationDuration: `${takt * 22}s` }}
      />

      {/* ── Zwölf Knoten ─────────────────────────────────────────────────── */}
      <g>
        {winkel(12).map((g, i) => {
          const p = pol(168, g);
          const stark = i % 3 === 0;
          return (
            <circle key={g} cx={p.x} cy={p.y} r={stark ? 4.2 : 2.2}
              fill={stark ? farbe : C.achtung}
              opacity={stark ? glanz : 0.42}
              filter={stark ? 'url(#hirnGlanz)' : undefined} />
          );
        })}
      </g>

      {/* ── Innere Ringe ─────────────────────────────────────────────────── */}
      <circle cx={MITTE} cy={MITTE} r="144" fill="none" stroke={farbe} strokeWidth="0.9" opacity="0.26" strokeDasharray="30 8" />
      <circle cx={MITTE} cy={MITTE} r="120" fill="none" stroke={C.achtung} strokeWidth="0.7" opacity="0.24" />
      <circle cx={MITTE} cy={MITTE} r="96" fill="none" stroke={farbe} strokeWidth="1.1" opacity="0.36" strokeDasharray="4 9" />

      {/* ── Feine Bernstein-Striche innen ────────────────────────────────── */}
      <g stroke={C.achtung} opacity="0.45">
        {winkel(72).map((g, i) => {
          const a = pol(i % 3 === 0 ? 122 : 127, g), b = pol(131, g);
          return <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="0.6" />;
        })}
      </g>

      {/* ── Innere Geometrie: zwei versetzte Vielecke ────────────────────── */}
      <path d={vieleck(74, 6)} fill="none" stroke={farbe} strokeWidth="0.8" opacity="0.28" />
      <path d={vieleck(74, 6, 30)} fill="none" stroke={C.achtung} strokeWidth="0.7" opacity="0.2" />

      {/* ── Marken an den vier Himmelsrichtungen ─────────────────────────── */}
      <g fill={farbe} opacity="0.66">
        {winkel(4).map(g => {
          const p = pol(206, g);
          return <path key={g} d="M 0 -7 L 6 0 L 0 7 L -6 0 Z"
            transform={`translate(${p.x} ${p.y}) rotate(${rund(g)})`} />;
        })}
      </g>

      {/* ── Laufende Aufträge: je Auftrag ein kreisender Bogen ───────────── */}
      {lebt && aktiv > 0 && (
        <g fill="none" stroke={farbe} strokeLinecap="round" filter="url(#hirnGlanz)">
          {Array.from({ length: Math.min(8, aktiv) }).map((_, i) => (
            <path
              key={i}
              className="hirn-auftrag"
              d={bogen(258, 0, 26)}
              strokeWidth="2.4"
              opacity="0.85"
              style={{
                transformOrigin: `${MITTE}px ${MITTE}px`,
                animationDuration: `${takt * 2.4}s`,
                animationDelay: `${rund(i * -0.45)}s`,
              }}
            />
          ))}
        </g>
      )}
    </>
  );
});

export function JarvisHirn({
  aktiv = 0, groesse = 460, zustand = 'ruht', pegel = 0, zeit = 0,
  maus = { x: 0, y: 0 }, ruhig = false,
}: {
  /** Wie viele Aufträge gerade laufen — treibt Tempo und Helligkeit. */
  aktiv?: number;
  groesse?: number;
  /** Was Jarvis gerade tut. Bestimmt Farbe, Takt und Weite. */
  zustand?: Zustand;
  /** Lautstärke 0..1 — beim Zuhören die von Kevin, beim Sprechen die eigene. */
  pegel?: number;
  /** Sekunden seit dem Öffnen, aus useAtem — eine Uhr für die ganze Seite. */
  zeit?: number;
  /** Zeigerposition -1..1, für die Parallaxe. */
  maus?: { x: number; y: number };
  /** Bewegung unerwünscht (System-Einstellung). */
  ruhig?: boolean;
}) {
  // Erst nach dem Einhängen animieren: der erste Aufbau soll auf Server und
  // Browser identisch sein.
  const [lebt, setLebt] = useState(false);
  useEffect(() => { setLebt(true); }, []);

  const ton = TON[zustand];
  const wach = aktiv > 0;

  // Der Atem bleibt langsam: 4–6 Sekunden ist Ruheatmung. Alles unter zwei
  // Sekunden liest das Auge als PULS, und Puls heißt Alarm. Unter Last wird
  // es etwas schneller, aber nie hektisch.
  const takt = rund(wach ? Math.max(2.6, ton.takt - aktiv * 0.18) : ton.takt);

  // Zustandswechsel werden nachgezogen statt geschaltet — sonst wirkt es wie
  // ein ausgetauschtes Bild.
  const weite = useNachziehen(ton.weite, zeit);
  const richtung = useNachziehen(ton.richtung, zeit);
  const glanz = rund(Math.min(1, 0.7 + aktiv * 0.04 + pegel * 0.3));

  const laut = ruhig ? 0 : pegel;
  // Die Stimme wirkt sofort — der Kern folgt dem Pegel ohne Umweg über eine
  // Animation. Beim Denken gibt es keinen Pegel; dort trägt der Takt allein.
  const kernR = rund(16 * weite + laut * richtung * 9);
  const t = ruhig ? 0 : zeit;

  // Parallaxe: außen und innen wandern gegenläufig, das erzeugt Tiefe ohne
  // eine einzige Schattenfläche. Werte klein halten — es soll sich lehnen,
  // nicht schwanken.
  const px = ruhig ? 0 : maus.x;
  const py = ruhig ? 0 : maus.y;
  const fern = `translate(${rund(px * -7)} ${rund(py * -7)})`;
  const nah = `translate(${rund(px * 12)} ${rund(py * 12)})`;

  // Das Bild ist dekorativ (aria-hidden): was Jarvis tut, steht als Text
  // darunter, mit aria-live, damit ein Screenreader den Wechsel meldet statt
  // ihn nur beim Vorlesen des Bildes zu erwähnen.
  return (
    <svg
      viewBox="0 0 620 620"
      width={groesse}
      height={groesse}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="hirnKern">
          <stop offset="0%" stopColor={ton.farbe} stopOpacity="0.95" />
          <stop offset="35%" stopColor={ton.farbe} stopOpacity="0.38" />
          <stop offset="100%" stopColor={ton.farbe} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="hirnHof">
          <stop offset="55%" stopColor={ton.farbe} stopOpacity="0" />
          <stop offset="100%" stopColor={ton.farbe} stopOpacity="0.08" />
        </radialGradient>
        <filter id="hirnGlanz" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="weich" />
          <feMerge><feMergeNode in="weich" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Starkes Leuchten nur für den Kern — teuer, deshalb sparsam. */}
        <filter id="hirnBloom" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="9" result="hof" />
          <feMerge><feMergeNode in="hof" /><feMergeNode in="hof" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Hof — gibt dem Ganzen Tiefe, ohne eine Kante zu setzen */}
      <circle cx={MITTE} cy={MITTE} r="300" fill="url(#hirnHof)" />

      <g transform={fern} style={{ transition: 'transform .4s cubic-bezier(.22,1,.36,1)' }}>
        <Geruest farbe={ton.farbe} takt={takt} glanz={glanz} aktiv={aktiv} lebt={lebt} />
      </g>

      <g transform={nah} style={{ transition: 'transform .4s cubic-bezier(.22,1,.36,1)' }}>
        {/* ── Stimmkranz: 60 Striche, die auf die Lautstärke ausschlagen ──
            Das ist der eine Ort, an dem man SIEHT, dass Jarvis zuhört. Ohne
            Pegel liegt der Kranz flach an — er verschwindet nicht, er ruht. */}
        {lebt && (
          <g stroke={ton.farbe} strokeLinecap="round" opacity={rund(0.28 + laut * 0.6)}>
            {winkel(60).map((g, i) => {
              // Jeder Strich hat eine eigene Phase — sonst pumpt der ganze
              // Kranz im Gleichtakt und wirkt wie ein Kreis, der wächst.
              const eigen = 0.55 + 0.45 * Math.sin(i * 1.7 + t * 3.1);
              const h = rund(4 + laut * 32 * eigen);
              // Beim Zuhören schlägt der Kranz nach innen aus, beim Sprechen
              // nach außen — dieselbe Regel wie bei der Membran.
              const innen = richtung < -0.2;
              const fuss = innen ? 52 : 56;
              const a = pol(fuss, g), b = pol(innen ? fuss - h : fuss + h, g);
              return <line key={g} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="1.6" />;
            })}
          </g>
        )}

        {/* ── Der Kern ─────────────────────────────────────────────────────
            Kein Kreis mehr, sondern eine weich verformte Fläche: sie bewegt
            sich langsam in sich, auch wenn nichts passiert. Das ist der
            Unterschied zwischen „pulsiert" und „lebt". */}
        <path
          d={blob(rund(74 * weite + laut * richtung * 7), t * 0.55, 5 + laut * 7)}
          fill="url(#hirnKern)"
        />
        {/* Die Membran: der Ring, an dem man Zuhören und Sprechen auseinander
            hält. Nach innen heißt „ich höre dich", nach außen „ich rede". */}
        <path
          d={blob(rund(46 * weite + laut * richtung * 12), t * 0.8, 1.6 + laut * 3)}
          fill="none" stroke={ton.farbe} strokeWidth="1.6" opacity={glanz}
        />
        {/* Farbsaum wie durch eine Linse: zwei versetzte Kopien in Bernstein
            und Weiß, additiv überlagert. Nimmt der Grafik die perfekte
            digitale Sauberkeit — man sieht es nicht, man spürt es. */}
        <g style={{ mixBlendMode: 'screen' }}>
          <path d={blob(kernR, t * 1.1, 2.4 + laut * 4)} fill={C.achtung} opacity="0.5"
            transform="translate(1.6 -1)" filter="url(#hirnGlanz)" />
          <path d={blob(kernR, t * 1.1, 2.4 + laut * 4)} fill="#FFFFFF" opacity="0.28"
            transform="translate(-1.4 1.2)" filter="url(#hirnGlanz)" />
        </g>
        <path
          className={lebt && !ruhig ? 'hirn-kern' : undefined}
          d={blob(kernR, t * 1.1, 2.4 + laut * 4)}
          fill={ton.farbe}
          filter="url(#hirnBloom)"
          style={{ transformOrigin: `${MITTE}px ${MITTE}px`, animationDuration: `${takt}s` }}
        />

        {/* Zustandswechsel als einmalige Welle. Der key sorgt dafür, dass
            React das Element neu einhängt — nur so läuft die Animation
            wirklich jedes Mal neu an. */}
        {lebt && !ruhig && (
          <circle
            key={zustand}
            className="hirn-welle"
            cx={MITTE} cy={MITTE} r="60" fill="none"
            stroke={ton.farbe} strokeWidth="2"
            style={{ transformOrigin: `${MITTE}px ${MITTE}px` }}
          />
        )}
      </g>
    </svg>
  );
}
