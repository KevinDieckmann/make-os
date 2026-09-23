'use client';

// ─── MAKE OS — Der Empfang ──────────────────────────────────────────────────
// Kevins Ansage vom 07.09.: „Wenn die Software hochgefahren wird, begrüßt mich
// erst Jarvis und ich kann mit ihm die ganzen Sachen durchquatschen."
//
// Zweiter Durchgang, gleicher Tag. Sein Einwand: „da ist ja nichts lebendiges
// dran". Er hatte recht — es war ein Bild, ein Absatz, ein Eingabefeld. Was
// jetzt anders ist, folgt einem Gedanken: die Oberfläche muss ZEIGEN, was
// gerade passiert, ohne dass man es liest.
//
//   · Das Hirn reagiert auf die echte Lautstärke des Mikrofons. Wenn Kevin
//     spricht, schlägt der Kranz aus — nicht als Animation, sondern gemessen.
//   · Vier Zustände mit eigener Farbe: ruht · hört zu · denkt · spricht.
//   · Der Text kommt Wort für Wort an, wie gesprochen — nicht als Block.
//   · Tiefe durch Hof, Vignette und Korn statt durch Rahmen.
//   · Eine Uhr für die ganze Seite (useAtem), nicht eine je Element.
//
// Was bewusst NICHT hier steht: Zahlen. Wer Zahlen sehen will, geht eine
// Ebene tiefer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO } from '@/lib/make-one/design';
import { JarvisHirn, TON } from './JarvisHirn';
import { useStimme } from '@/hooks/useStimme';
import { useLautstaerke } from '@/hooks/useLautstaerke';
import { useAtem } from '@/hooks/useAtem';
import { fuerStimme, ohneMarkdown } from '@/lib/make-one/jarvis-verlauf';
import { zustandVon, inWorte, wortVerzug, vorschlaege, tagesWort } from '@/lib/make-one/empfang';

interface Zug { wer: 'kevin' | 'jarvis'; text: string }

/** Text, der Wort für Wort ankommt. Der Schlüssel hängt am Text: ein neuer
 *  Satz läuft neu an, ein erneutes Rendern desselben Satzes nicht. */
function Ankunft({ text, stil }: { text: string; stil?: React.CSSProperties }) {
  const worte = useMemo(() => inWorte(text), [text]);
  return (
    // pre-wrap auf dem Behälter: nur so überleben Absätze und Aufzählungen.
    <span style={{ whiteSpace: 'pre-wrap', ...stil }}>
      {worte.map((w, i) =>
        // Zwischenräume bleiben roher Text. Ein Zeilenumbruch in einem
        // inline-block bricht nur INNERHALB des Kastens — die Aufzählung
        // stand deshalb erst als eine einzige lange Zeile da.
        /^\s+$/.test(w)
          ? <span key={`${i}-l`}>{w}</span>
          : <span key={`${i}-${w}`} className="wort" style={{ animationDelay: `${wortVerzug(i)}s` }}>{w}</span>,
      )}
    </span>
  );
}

/** Drei Punkte statt eines Wortes: es steht nichts da, was man lesen und
 *  gleich wieder vergessen müsste. */
function Denkpunkte({ farbe }: { farbe: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', height: 20 }} aria-label="Jarvis denkt nach">
      {[0, 1, 2].map(i => (
        <span key={i} className="denk-punkt" style={{
          width: 6, height: 6, borderRadius: '50%', background: farbe,
          animationDelay: `${i * 0.16}s`,
        }} />
      ))}
    </span>
  );
}

/** Zeigerposition als CSS-Größen auf das Element schreiben — die Taschen-
 *  lampe in globals.css liest sie. Ohne React-Zustand: ein Lichtfleck darf
 *  keinen Renderdurchlauf kosten. */
function lampe(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
}

export function JarvisStart() {
  const [aktiv, setAktiv] = useState(0);
  const [empfang, setEmpfang] = useState('');
  const [zuege, setZuege] = useState<Zug[]>([]);
  const [eingabe, setEingabe] = useState('');
  const [denkt, setDenkt] = useState(false);
  const [stunde, setStunde] = useState(12);
  const gesprochen = useRef(false);
  const ende = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLInputElement>(null);

  const atem = useAtem();
  const laut = useLautstaerke();
  const stimme = useStimme(satz => { void frag(satz); });

  const zustand = zustandVon({ hoert: stimme.hoert, spricht: stimme.spricht, denkt });
  const ton = TON[zustand];

  // Der Pegel: beim Zuhören gemessen, beim Sprechen gerechnet.
  // Ehrlich benannt — die Sprachausgabe des Browsers gibt keine Lautstärke
  // heraus, also kann der Ausschlag beim Sprechen nur ein Mundwinkel sein,
  // keine Messung. Beim Zuhören dagegen ist es das echte Mikrofon.
  const pegel = stimme.hoert
    ? laut.pegel
    : stimme.spricht
      ? 0.3 + 0.22 * Math.sin(atem.zeit * 7.3) + 0.12 * Math.sin(atem.zeit * 11.7)
      : 0;

  // Wie viel gerade läuft — das treibt den Puls des Hirns.
  useEffect(() => {
    const holen = () => fetch('/api/jarvis/auftraege')
      .then(r => r.json())
      .then(d => setAktiv(Number(d?.stand?.laeuft ?? 0) + Number(d?.stand?.offen ?? 0)))
      .catch(() => {});
    holen();
    const iv = setInterval(holen, 5000);
    return () => clearInterval(iv);
  }, []);

  // Stunde erst im Browser setzen: auf dem Server wäre es die Zeit des
  // Rechners, und React würde die Abweichung melden.
  useEffect(() => { setStunde(new Date().getHours()); }, []);

  // Der Empfang: zwei Sätze, serverseitig je Stunde gerechnet und gehalten.
  useEffect(() => {
    fetch('/api/jarvis/empfang')
      .then(r => r.json())
      .then(d => {
        if (!d?.text) return;
        setEmpfang(d.text);
        // Einmal vorlesen, nicht bei jedem erneuten Rendern.
        if (!gesprochen.current) { gesprochen.current = true; stimme.lies(fuerStimme(d.text)); }
      })
      .catch(() => setEmpfang('Ich bin da, Sir. Die Lage bekomme ich gerade nicht — frag mich trotzdem.'));
    // stimme absichtlich nicht in den Abhängigkeiten: sonst liest er bei jedem
    // Wechsel des Sprach-Zustands erneut vor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Das Neueste ist immer sichtbar — ohne Sprung, damit es nicht reißt.
  // Ein Bild abwarten: die Wörter der Antwort werden erst beim Zeichnen
  // eingehängt, vorher wäre die Rolle noch zu kurz und der letzte Satz bliebe
  // unter dem Eingabefeld stehen.
  useEffect(() => {
    const b = requestAnimationFrame(() =>
      ende.current?.scrollIntoView({ behavior: atem.ruhig ? 'auto' : 'smooth', block: 'end' }));
    return () => cancelAnimationFrame(b);
  }, [zuege.length, denkt, atem.ruhig]);

  const frag = useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || denkt) return;
    setEingabe('');
    setZuege(z => [...z, { wer: 'kevin', text: q }]);
    setDenkt(true);
    try {
      const r = await fetch('/api/kimmi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const d = await r.json();
      const antwort = d.reply ?? 'Dazu habe ich gerade keine Antwort.';
      setZuege(z => [...z, { wer: 'jarvis', text: antwort }]);
      stimme.lies(fuerStimme(antwort));
    } catch {
      setZuege(z => [...z, { wer: 'jarvis', text: 'Ich bin gerade nicht erreichbar.' }]);
    }
    setDenkt(false);
  }, [denkt, stimme]);

  // Mikrofon und Erkennung laufen zusammen los und hören zusammen auf. Sonst
  // bliebe die Aufnahmeanzeige des Browsers stehen, nachdem er fertig ist.
  const anfangen = useCallback(() => {
    if (stimme.hoert) return;
    stimme.schweig();          // wer spricht, wird unterbrochen — nicht übertönt
    stimme.hoerZu();
    void laut.starte();
  }, [stimme, laut]);

  const aufhoeren = useCallback(() => {
    stimme.hoerAuf();
    laut.stoppe();
  }, [stimme, laut]);

  // Leertaste halten und sprechen — ohne die Hand zur Maus zu nehmen.
  // Nicht, während im Eingabefeld getippt wird: dort ist Leertaste ein Wort.
  useEffect(() => {
    const imFeld = (e: KeyboardEvent) => {
      const z = e.target as HTMLElement | null;
      return !!z && (z.tagName === 'INPUT' || z.tagName === 'TEXTAREA' || z.isContentEditable);
    };
    const runter = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !imFeld(e)) { e.preventDefault(); anfangen(); }
      if (e.key === 'Escape') { stimme.schweig(); aufhoeren(); }
      // Ein Tastendruck ins Feld: schreiben können, ohne erst zu klicken.
      if (e.key === '/' && !imFeld(e)) { e.preventDefault(); feld.current?.focus(); }
    };
    const hoch = (e: KeyboardEvent) => { if (e.code === 'Space' && !imFeld(e)) aufhoeren(); };
    window.addEventListener('keydown', runter);
    window.addEventListener('keyup', hoch);
    return () => { window.removeEventListener('keydown', runter); window.removeEventListener('keyup', hoch); };
  }, [anfangen, aufhoeren, stimme]);

  const vorschlag = vorschlaege(stunde);
  const zeigeVorschlaege = zuege.length === 0 && !!empfang;

  return (
    // Feste Höhe, drei Zonen: Kopf (Hirn), Rolle (Gespräch), Fuß (Eingabe).
    // Vorher wuchs die Seite mit der Antwort — nach dem ersten längeren Satz
    // war das Eingabefeld nicht mehr zu sehen. Jetzt wächst nur die Rolle,
    // und sie hat einen Rollbalken.
    <div className="buehne" style={{
      height: '100dvh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: `${A.l}px ${A.l}px ${A.l}px`, overflow: 'hidden',
    }}>
      {/* ── Tiefe. Drei Schichten, keine davon anfassbar ──────────────────
          Der Hof nimmt die Farbe des Zustands an: wenn Jarvis denkt, wird der
          ganze Raum bernsteinfarben. Das sieht man aus zwei Metern. */}
      <div className="buehne-hof" style={{
        background: `radial-gradient(ellipse 55% 45% at 50% 40%, ${ton.farbe}22, transparent 70%)`,
        transition: 'background .8s ease',
      }} />
      {/* Zweite, engere Lichtschicht. Bloom entsteht durch gestapelte
          Verläufe, nicht durch einen animierten Weichzeichner — ein
          Weichzeichner mit fester Stärke läuft auf dem Compositor, ein
          animierter nicht. */}
      <div style={{
        position: 'absolute', left: '50%', top: '30%', width: 'min(620px, 90vw)', height: 'min(620px, 90vw)',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 1,
        background: `radial-gradient(circle, ${ton.farbe}26 0%, ${ton.farbe}0F 34%, transparent 68%)`,
        transition: 'background .8s ease',
      }} />
      <div className="buehne-vignette" />
      <div className="buehne-korn" />

      <div style={{
        position: 'relative', zIndex: 4, width: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        flex: 1, minHeight: 0,
      }}>
        {/* ── Das Hirn ──────────────────────────────────────────────────── */}
        {/* Sobald ein Gespräch läuft, tritt das Hirn zurück: es bleibt
            sichtbar (der Zustand muss ablesbar bleiben), gibt aber den Platz
            an das ab, was gerade gesagt wird. */}
        <div style={{
          flex: '0 0 auto',
          width: zuege.length ? 'min(230px, 38vw, 22vh)' : 'min(520px, 72vw, 40vh)',
          marginTop: 'clamp(0px,1.5vh,20px)',
          transition: 'width .7s cubic-bezier(.22,1,.36,1)',
        }}>
          <JarvisHirn
            aktiv={aktiv}
            groesse={460}
            zustand={zustand}
            pegel={pegel}
            zeit={atem.zeit}
            maus={atem.maus}
            ruhig={atem.ruhig}
          />
        </div>

        {/* ── Die Zustandszeile ─────────────────────────────────────────────
            Sie ist nicht Beiwerk, sondern die barrierefreie Fassung des
            ganzen Hirns: das SVG ist aria-hidden, hier steht im Klartext,
            was gerade passiert. aria-live meldet jeden Wechsel. */}
        <div role="status" aria-live="polite" className="zeile-auf" style={{
          animationDelay: '.55s', flex: '0 0 auto',
          ...MIKRO, marginTop: A.m, display: 'flex', alignItems: 'center', gap: A.s,
          color: zustand === 'ruht' ? C.inkLeise : ton.farbe, transition: 'color .4s ease',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: ton.farbe,
            boxShadow: zustand === 'ruht' ? 'none' : `0 0 10px ${ton.farbe}`,
            transition: 'box-shadow .4s ease, background .4s ease',
          }} />
          {ton.wort}
          <span style={{ color: C.inkLeise }}>· {tagesWort(stunde)}</span>
          {aktiv > 0 && <span style={{ color: C.achtung }}>· {aktiv} laufen</span>}
        </div>

        {/* ── Die Rolle ─────────────────────────────────────────────────
            Alles Gesagte in einer einzigen rollbaren Bahn: sein Empfangssatz,
            die Einstiege, das Gespräch. Nur DIESE Zone wächst — Hirn oben und
            Eingabe unten stehen fest. Vorher schob eine lange Antwort das
            Eingabefeld aus dem Bild. */}
        <div style={{
          flex: 1, minHeight: 0, width: '100%', maxWidth: 680,
          overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column',
          padding: `${A.l}px 2px`,
          // Der obere Rand blendet aus statt abzuschneiden — abgeschnittene
          // Schrift sieht aus, als wäre etwas kaputt.
          maskImage: 'linear-gradient(to bottom, transparent, #000 20px)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 20px)',
        }}>
        {/* Das Neueste sitzt unten, direkt über der Eingabe — wie in jedem
            Gespräch. Umgesetzt mit `margin-top: auto` statt mit
            `justify-content: flex-end`: bei flex-end schneiden manche
            Browser den Anfang ab, sobald mehr Inhalt da ist als Platz.
            Solange nichts gesagt wurde, zentriert `margin: auto 0`. */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: A.m,
          margin: zuege.length ? 'auto 0 0' : 'auto 0',
        }}>
          {/* Sein Satz. Bleibt oben in der Rolle stehen und wandert mit hoch,
              wenn das Gespräch länger wird — er ist der erste Zug, nicht eine
              Überschrift. */}
          <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
            {empfang ? (
              <Ankunft
                text={ohneMarkdown(empfang)}
                stil={{
                  fontFamily: SCHRIFT.display,
                  fontSize: zuege.length ? TYP.body : TYP.titel,
                  fontWeight: 500, lineHeight: 1.45,
                  color: zuege.length ? C.inkDim : C.ink, textWrap: 'balance',
                }}
              />
            ) : (
              <Denkpunkte farbe={C.inkLeise} />
            )}
          </div>

          {/* Was man ihn fragen kann. Ein leeres Eingabefeld ist die
              unfreundlichste Oberfläche, die es gibt — man weiß nicht, was
              das Ding kann. Verschwindet, sobald etwas gesagt wurde. */}
          {zeigeVorschlaege && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: A.s, justifyContent: 'center',
              marginTop: A.s, flex: '0 0 auto',
            }}>
              {vorschlag.map((v, i) => (
                <button
                  key={v}
                  className="fassbar lampe zeile-auf"
                  onClick={() => void frag(v)}
                  onPointerMove={lampe}
                  style={{
                    animationDelay: `${1.1 + i * 0.07}s`,
                    fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkDim,
                    background: 'transparent', border: `1px solid ${C.linie}`,
                    borderRadius: RADIUS.pille, padding: `7px ${A.l}px`, cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${ton.farbe}66`; e.currentTarget.style.color = C.ink; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.linie; e.currentTarget.style.color = C.inkDim; }}
                >{v}</button>
              ))}
            </div>
          )}

          {/* Das Gespräch */}
          {zuege.map((z, i) => (
            <div key={i} className="zeile-auf" style={{
              alignSelf: z.wer === 'kevin' ? 'flex-end' : 'flex-start',
              flex: '0 0 auto',
              maxWidth: '88%', fontSize: TYP.body, lineHeight: 1.6,
              color: z.wer === 'kevin' ? C.inkDim : C.ink,
              background: z.wer === 'kevin' ? C.flaeche : 'transparent',
              border: z.wer === 'kevin' ? `1px solid ${C.linie}` : 'none',
              borderRadius: RADIUS.behaelter, padding: z.wer === 'kevin' ? `${A.s}px ${A.l}px` : 0,
              whiteSpace: 'pre-wrap',
            }}>
              {z.wer === 'jarvis'
                ? <Ankunft text={ohneMarkdown(z.text)} />
                : z.text}
            </div>
          ))}
          {denkt && <div style={{ alignSelf: 'flex-start', flex: '0 0 auto' }}><Denkpunkte farbe={ton.farbe} /></div>}
          <div ref={ende} style={{ flex: '0 0 auto' }} />
        </div>
        </div>

        {/* ── Das Wort ──────────────────────────────────────────────────── */}
        <div className="zeile-auf" style={{ animationDelay: '.9s', flex: '0 0 auto', width: '100%', maxWidth: 680, display: 'flex', gap: A.s, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 auto', width: 46, height: 46 }}>
            {/* Der Ring läuft nur, solange wirklich aufgenommen wird. Er ist
                die Zusage: das Mikrofon ist an. */}
            {stimme.hoert && (
              <span className="hoer-ring" style={{
                position: 'absolute', inset: 0, borderRadius: RADIUS.pille,
                border: `1.5px solid ${ton.farbe}`, pointerEvents: 'none',
              }} />
            )}
            <button
              className="fassbar"
              onMouseDown={anfangen}
              onMouseUp={aufhoeren}
              onMouseLeave={() => { if (stimme.hoert) aufhoeren(); }}
              onTouchStart={e => { e.preventDefault(); anfangen(); }}
              onTouchEnd={aufhoeren}
              title="Gedrückt halten und sprechen — oder Leertaste"
              aria-label="Sprechen"
              aria-pressed={stimme.hoert}
              style={{
                width: 46, height: 46, borderRadius: RADIUS.pille, cursor: 'pointer',
                border: `1px solid ${stimme.hoert ? ton.farbe : C.linie}`,
                background: stimme.hoert ? `${ton.farbe}22` : 'transparent',
                color: stimme.hoert ? ton.farbe : C.inkDim, fontSize: 17,
                // Der Knopf selbst wächst mit der Lautstärke. Kleine Geste,
                // aber sie sitzt unter dem Finger — man spürt sie förmlich.
                transform: `scale(${(1 + (stimme.hoert ? laut.pegel * 0.14 : 0)).toFixed(3)})`,
                boxShadow: stimme.hoert ? `0 0 ${Math.round(8 + laut.pegel * 26)}px ${ton.farbe}55` : 'none',
              }}
            >●</button>
          </div>
          <div className="lampe" onPointerMove={lampe} style={{ flex: 1, minWidth: 0, borderRadius: RADIUS.pille }}>
          <input
            ref={feld}
            value={eingabe}
            onChange={e => setEingabe(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void frag(eingabe); }}
            placeholder={stimme.hoert ? (stimme.teil || 'ich höre …') : 'Sprich mit mir — oder tipp es'}
            aria-label="Nachricht an Jarvis"
            style={{
              width: '100%', background: C.flaeche,
              border: `1px solid ${stimme.hoert ? `${ton.farbe}66` : C.linie}`,
              borderRadius: RADIUS.pille, padding: `0 ${A.xl}px`, height: 46,
              color: C.ink, fontFamily: SCHRIFT.text, fontSize: TYP.body, outline: 'none',
              transition: 'border-color .3s ease, background .3s ease',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = `${ton.farbe}88`; }}
            onBlur={e => { e.currentTarget.style.borderColor = stimme.hoert ? `${ton.farbe}66` : C.linie; }}
          />
          </div>
        </div>

        {/* Was Mikrofon oder Erkennung melden — leise, aber nicht verschwiegen. */}
        {(stimme.fehler || laut.fehler) && (
          <div role="alert" style={{ ...MIKRO, color: C.achtung, marginTop: A.s, maxWidth: 680, textAlign: 'center', flex: '0 0 auto' }}>
            {stimme.fehler || laut.fehler}
          </div>
        )}

        {/* ── Was man drücken kann ──────────────────────────────────────────
            Ein Kürzel, das nirgends steht, existiert nicht. Deshalb steht es
            hier — leise, am schwächsten im Kontrast, ganz zuletzt. */}
        {/* Tastenkürzel nur dort, wo es eine Tastatur gibt. Auf dem Handy
            wäre „Leertaste halten" ein Hinweis auf etwas, das es nicht gibt. */}
        <div className="zeile-auf nur-tastatur" style={{
          ...MIKRO, marginTop: A.m, display: 'flex', gap: A.l, flexWrap: 'wrap',
          justifyContent: 'center', animationDelay: '1.5s', flex: '0 0 auto',
        }}>
          <span><kbd className="taste">Leertaste</kbd> halten und sprechen</span>
          <span><kbd className="taste">/</kbd> tippen</span>
          <span><kbd className="taste">Esc</kbd> abbrechen</span>
        </div>

        {/* ── Der Weg weiter ────────────────────────────────────────────── */}
        <Link
          href="/os"
          className="fassbar"
          style={{
            marginTop: A.m, flex: '0 0 auto',
            fontFamily: SCHRIFT.text, fontSize: TYP.bedien, color: C.inkLeise, textDecoration: 'none',
          }}
        >Weiter zu Heute ›</Link>
      </div>
    </div>
  );
}
