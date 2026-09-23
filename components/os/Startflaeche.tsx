'use client';

// ─── MAKE OS — Startfläche ──────────────────────────────────────────────────
// Neu gestaltet 06.09. nach Kevins UX-Analyse (Vorbilder Whoop & N26).
//
// Vorher beantwortete diese Seite fünfzehn Fragen gleichzeitig: 41 klickbare
// Elemente im ersten Bild, fünf Säulenkarten neben dem Score, unter jeder
// Kachel bis zu sieben 9,5-px-Chips.
//
// Jetzt gilt die Disziplin der Vorbilder:
//   1. EINE Heldenzahl — der Score als Ring, ohne Konkurrenz daneben.
//   2. EIN Satz dazu, der sagt, was zu tun ist.
//   3. Die fünf Säulen als ein Streifen statt fünf Karten.
//   4. Acht Kacheln mit je EINER Zahl. Die Unterseiten stehen in der
//      Navigation des Bereichs — sie müssen nicht auch noch hier stehen.
//
// Farbe bedeutet ab hier Zustand, nicht Zugehörigkeit: der Punkt an der
// Kachel färbt sich nach der Lage, nicht nach dem Bereich.

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pin, Sparkles } from 'lucide-react';
import { THEME as T } from '@/lib/make-one/os-data';
import { FARBE as C, TYP, SCHRIFT, ABSTAND as A, RADIUS, MIKRO, ZIFFERN, zustandFarbe } from '@/lib/make-one/design';
import { modusLesen, beiWechsel } from '@/lib/make-one/arbeitsplatz-browser';
import { ALLE_SEITEN, bereicheFuer, type Modus } from '@/lib/make-one/bereiche';
import type { LucideIcon } from 'lucide-react';

interface Zahl { wert: string; label: string; farbe?: string }
interface Lage { kennzahlen?: Zahl[]; status?: { text: string; farbe: string } }
interface Score {
  index: number | null; label: string; hebel: string | null; abdeckung: number; stand: string; trend: number | null;
  modi?: Record<string, { index: number | null; label: string; abdeckung: number }>;
  saeulen: { key: string; label: string; wert: number | null; gewicht: number; zuDuenn: boolean; hinweis?: string }[];
}
interface Antwort { lage?: Record<string, Lage>; score?: Score }
interface EigeneKachel { id: string; titel: string; href: string; satz?: string }
interface Aufbau { reihenfolge: string[]; versteckt: string[]; eigene: EigeneKachel[] }

/** Zustandsnamen aus der Lage-Antwort auf die drei Systemfarben. */
const ZUSTAND: Record<string, string> = { gut: C.gut, warn: C.achtung, krit: C.kritisch, still: C.inkLeise };

/**
 * Wohin eine Säule führt. Kevins Ansage: „Jede Säule kann eine eigene Zahl
 * sein, wo man danach auf den Bereich kommt, der notwendig ist." Also dorthin,
 * wo die Arbeit liegt, die den Wert hebt — nicht auf die Erklärseite.
 */
const SAEULE_ZIEL: Record<string, string> = {
  health: '/os/gesundheit',
  business: '/os/netzwerk',
  planning: '/os/aufgaben',
  finance: '/os/finanzen',
  social: '/os/saeule/social',
};

/** Kurzname für den Säulen-Streifen — die Langform sprengt die Spalte. */
const SAEULE_KURZ: Record<string, string> = {
  health: 'Gesundheit', business: 'Business', planning: 'Planung',
  finance: 'Finanzen', social: 'Beziehung',
};

/**
 * Der Held: ein Ring, eine Zahl, ein Satz. Nichts daneben.
 * Das ist Whoops Recovery-Ring — man versteht ihn aus drei Metern Entfernung.
 */
function ScoreHeld({ s, modus }: { s: Score; modus: Modus }) {
  const eigen = s.modi?.[modus];
  const index = eigen?.index ?? s.index;
  const label = eigen?.label ?? s.label;
  const abdeckung = Math.round((eigen?.abdeckung ?? s.abdeckung) * 100);
  const farbe = zustandFarbe(index);

  const R = 72, UMFANG = 2 * Math.PI * R;
  const anteil = index == null ? 0 : Math.max(0, Math.min(100, index)) / 100;

  // Der Hebel kommt aus dem Score selbst — NICHT hier neu gerechnet.
  // (Ein erster Versuch rechnete ihn nach und kam auf „Finanzen", während das
  // System „Business-Performance" sagte. Zwei Antworten auf dieselbe Frage
  // sind schlimmer als gar keine.)
  const schwach = s.hebel ? s.saeulen.find(x => x.label === s.hebel) : undefined;

  return (
    <section style={{
      display: 'flex', alignItems: 'center', gap: A.xxl, flexWrap: 'wrap',
      padding: `${A.xl}px 0 ${A.xl}px`,
    }}>
      <Link href="/os/performance" aria-label={`MAKE Score ${index ?? 'ohne Wert'} — Details öffnen`}
        style={{ position: 'relative', width: 168, height: 168, flex: '0 0 auto', textDecoration: 'none' }}>
        <svg width="168" height="168" viewBox="0 0 168 168" aria-hidden="true">
          <circle cx="84" cy="84" r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="10" />
          <circle cx="84" cy="84" r={R} fill="none" stroke={farbe} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={UMFANG.toFixed(1)} strokeDashoffset={(UMFANG * (1 - anteil)).toFixed(1)}
            transform="rotate(-90 84 84)" />
        </svg>
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <span style={{ ...ZIFFERN, fontSize: TYP.held, fontWeight: 700, color: farbe, lineHeight: 1 }}>
            {index ?? '—'}
          </span>
          <span style={MIKRO}>MAKE Score</span>
        </span>
      </Link>

      <div style={{ minWidth: 0, flex: '1 1 320px' }}>
        <h1 style={{
          fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600,
          letterSpacing: '-.01em', margin: `0 0 ${A.s}px`, color: C.ink, textWrap: 'balance',
        }}>
          {label}{schwach ? ' — und du weißt, wo.' : '.'}
        </h1>
        {schwach && (
          <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.55, margin: 0, maxWidth: '38ch' }}>
            Größter Hebel ist{' '}
            <Link href={SAEULE_ZIEL[schwach.key] ?? '/os/performance'}
              style={{
                display: 'inline-block', color: C.ink, fontWeight: 600, textDecoration: 'none',
                borderBottom: `1px solid ${C.aktiv}66`,
                // Klickziel auf Mindestmaß bringen, ohne die Zeile zu sprengen.
                paddingTop: 5, paddingBottom: 3,
              }}>
              {schwach.label}
            </Link>{' '}
            mit {schwach.wert}.
          </p>
        )}
        <div style={{ ...MIKRO, marginTop: A.m }}>
          {s.trend != null && s.trend !== 0 && <>{s.trend > 0 ? '+' : ''}{s.trend} seit gestern · </>}
          {abdeckung}% Datenbasis · Stand {s.stand.slice(8, 10)}.{s.stand.slice(5, 7)}.
        </div>
      </div>
    </section>
  );
}

/**
 * Die fünf Säulen als ein Streifen: Breite = Gewicht, Füllung = Wert.
 * Vorher waren das fünf Karten, die mit dem Score um Aufmerksamkeit rangen.
 * Säulen ohne tragfähige Daten bleiben leer und gestrichelt — sie behaupten
 * keine Null.
 */
function SaeulenStreifen({ saeulen }: { saeulen: Score['saeulen'] }) {
  return (
    <section style={{ paddingTop: A.l, borderTop: `1px solid ${C.linieWeich}` }}>
      <div style={MIKRO}>Die fünf Säulen · Breite = Gewicht</div>
      <div style={{ display: 'flex', gap: 3, height: 8, margin: `${A.m}px 0 ${A.s}px` }}>
        {saeulen.map(s => (
          <div key={s.key} style={{
            flex: s.gewicht, borderRadius: 2, overflow: 'hidden',
            background: s.zuDuenn ? 'none' : 'rgba(255,255,255,.06)',
            border: s.zuDuenn ? `1px dashed ${C.linie}` : 'none',
          }}>
            {!s.zuDuenn && s.wert != null && (
              <span style={{
                display: 'block', height: '100%', width: `${Math.max(0, Math.min(100, s.wert))}%`,
                background: zustandFarbe(s.wert), borderRadius: 2,
              }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {saeulen.map(s => (
          <Link key={s.key} href={SAEULE_ZIEL[s.key] ?? '/os/performance'}
            title={s.zuDuenn ? `${s.label} — zu wenig Daten${s.hinweis ? `: ${s.hinweis}` : ''}` : `${s.label}: ${s.wert}`}
            style={{ flex: s.gewicht, minWidth: 0, textDecoration: 'none', paddingTop: 2 }}>
            <span style={{
              ...ZIFFERN, display: 'block', fontSize: TYP.bedien, fontWeight: 600,
              color: s.zuDuenn ? C.inkLeise : C.inkDim,
            }}>{s.zuDuenn || s.wert == null ? '—' : s.wert}</span>
            <span style={{
              display: 'block', fontSize: TYP.mikro, color: C.inkLeise,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{SAEULE_KURZ[s.key] ?? s.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Startflaeche() {
  const [d, setD] = useState<Antwort | null>(null);
  // Kevins Ansage: Kacheln verschieben, wenn man etwas länger draufbleibt —
  // und selbst entscheiden, was vorne draufkommt.
  const [aufbau, setAufbau] = useState<Aufbau>({ reihenfolge: [], versteckt: [], eigene: [] });
  const [bearbeiten, setBearbeiten] = useState(false);
  const [zieht, setZieht] = useState<string | null>(null);
  const [zufuegen, setZufuegen] = useState(false);
  const [modus, setModus] = useState<Modus>('alles');
  const druck = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetch('/api/startflaeche').then(r => r.json()).then(setD).catch(() => setD({}));
    setModus(modusLesen());
    fetch('/api/state/startflaeche').then(r => r.json()).then((a: Aufbau) => setAufbau({
      reihenfolge: a.reihenfolge ?? [], versteckt: a.versteckt ?? [], eigene: a.eigene ?? [],
    })).catch(() => {});
  }, []);

  useEffect(() => beiWechsel(w => setModus(w.modus)), []);

  const speichern = (next: Aufbau) => {
    setAufbau(next);
    fetch('/api/state/startflaeche', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next), keepalive: true,
    }).catch(() => {});
  };

  /** Alle Kacheln in Kevins Reihenfolge: Bereiche plus eigene, Verstecktes raus. */
  const kacheln = useMemo(() => {
    const bereiche = bereicheFuer(modus).map(b => ({
      id: b.id, titel: b.titel, href: b.start, icon: b.icon as LucideIcon, eigen: false,
    }));
    const eigene = aufbau.eigene.map(k => ({
      id: k.id, titel: k.titel, href: k.href, icon: Pin as LucideIcon, eigen: true,
    }));
    const rang = (id: string) => {
      const i = aufbau.reihenfolge.indexOf(id);
      return i === -1 ? 999 : i;
    };
    return [...bereiche, ...eigene]
      .filter(k => !aufbau.versteckt.includes(k.id))
      .sort((a, b) => rang(a.id) - rang(b.id));
  }, [aufbau, modus]);

  /** Langer Druck schaltet das Verschieben frei. */
  const druckStart = () => {
    clearTimeout(druck.current);
    druck.current = setTimeout(() => setBearbeiten(true), 550);
  };
  const druckEnde = () => clearTimeout(druck.current);

  const tauschen = (von: string, nach: string) => {
    if (von === nach) return;
    const ids = kacheln.map(k => k.id);
    const i = ids.indexOf(von), j = ids.indexOf(nach);
    if (i < 0 || j < 0) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    speichern({ ...aufbau, reihenfolge: ids });
  };

  const lage = d?.lage ?? {};
  const knopf = {
    display: 'flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, fontWeight: 600,
    textDecoration: 'none', borderRadius: RADIUS.bauteil, padding: `9px ${A.m}px`, minHeight: 36,
  } as const;

  return (
    <div style={{ minHeight: '100vh', background: C.grund, color: C.ink, fontFamily: SCHRIFT.text }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: `${A.xxl}px clamp(16px,3vw,40px) ${A.xxxl}px` }}>

        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: A.l, flexWrap: 'wrap' }}>
          <span style={MIKRO}>MAKE OS · Startfläche</span>
          <Link href="/os" style={{ ...knopf, background: C.gut, border: `1px solid ${C.gut}`, color: C.grund }}>
            <Sparkles size={13} strokeWidth={2} />
            Lagebericht öffnen
          </Link>
        </header>

        {/* Der Held: Ring + ein Satz. Alles andere tritt zurück. */}
        {d?.score && <ScoreHeld s={d.score} modus={modus} />}
        {d?.score?.saeulen?.length ? <SaeulenStreifen saeulen={d.score.saeulen} /> : null}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: A.m, flexWrap: 'wrap', marginTop: A.xxl, marginBottom: A.m }}>
          <h2 style={{ fontFamily: SCHRIFT.display, fontSize: TYP.titel, fontWeight: 600, letterSpacing: '-.01em', margin: 0 }}>
            {bearbeiten ? 'Kacheln einrichten' : 'Wo möchtest du arbeiten?'}
          </h2>
          {bearbeiten ? (
            <span style={{ display: 'flex', gap: A.s, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <button onClick={() => setZufuegen(v => !v)}
                style={{ ...knopf, cursor: 'pointer', border: `1px solid ${C.aktiv}`, background: zufuegen ? C.aktivSanft : 'transparent', color: C.aktiv }}>+ Kachel</button>
              {!!aufbau.versteckt.length && (
                <button onClick={() => speichern({ ...aufbau, versteckt: [] })}
                  style={{ ...knopf, cursor: 'pointer', border: `1px solid ${C.linie}`, background: 'transparent', color: C.inkDim }}>
                  {aufbau.versteckt.length} zurückholen
                </button>
              )}
              <button onClick={() => { setBearbeiten(false); setZufuegen(false); }}
                style={{ ...knopf, cursor: 'pointer', border: `1px solid ${C.linie}`, background: 'transparent', color: C.inkDim }}>Fertig</button>
            </span>
          ) : (
            <span style={{ ...MIKRO, marginLeft: 'auto' }}>lange drücken zum Einrichten</span>
          )}
        </div>

        {/* Eigene Kachel anlegen: jede Seite des Systems kann nach vorn */}
        {bearbeiten && zufuegen && (
          <div style={{ background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)', padding: A.l, marginBottom: A.m }}>
            <div style={{ ...MIKRO, marginBottom: A.s }}>Was soll vorne draufkommen?</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxHeight: 190, overflowY: 'auto' }}>
              {ALLE_SEITEN
                .filter(s => !aufbau.eigene.some(e => e.href === s.href))
                .map(s => (
                  <button key={s.href} onClick={() => {
                    const neu = { id: `eigen-${s.href.replace(/\W+/g, '-')}`, titel: s.label, href: s.href, satz: s.bereich };
                    speichern({ ...aufbau, eigene: [...aufbau.eigene, neu], reihenfolge: [...kacheln.map(k => k.id), neu.id] });
                    setZufuegen(false);
                  }}
                    style={{
                      fontFamily: SCHRIFT.text, fontSize: TYP.bedien, padding: `6px ${A.m}px`, minHeight: 32,
                      borderRadius: RADIUS.bauteil, cursor: 'pointer', border: `1px solid ${C.linie}`,
                      background: 'transparent', color: C.inkDim,
                    }}>
                    {s.label}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Acht Kacheln, je EINE Zahl. Die Unterseiten stehen in der
            Bereichs-Navigation — hier wären sie nur Rauschen. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))', gap: A.m }}>
          {kacheln.map(b => {
            const l = lage[b.id] ?? {};
            const haupt = l.kennzahlen?.[0];
            const weitere = l.kennzahlen?.[1];
            const Icon = b.icon;
            // Der Punkt trägt den ZUSTAND, nicht die Bereichsfarbe.
            const punkt = l.status ? (ZUSTAND[l.status.farbe] ?? C.inkLeise) : C.inkLeise;
            return (
              // next/link reicht eigene DOM-Handler nicht durch — deshalb trägt
              // ein Rahmen-div Langdruck und Ziehen, und der Link darin legt
              // sich unsichtbar über die ganze Kachel (Tastatur und ⌘-Klick
              // funktionieren dadurch weiter).
              <div key={b.id} className="bereich-kachel"
                onPointerDown={druckStart} onPointerUp={druckEnde} onPointerLeave={druckEnde} onPointerCancel={druckEnde}
                draggable={bearbeiten}
                onDragStart={() => setZieht(b.id)}
                onDragOver={e => { if (bearbeiten && zieht) e.preventDefault(); }}
                onDrop={e => { if (bearbeiten && zieht) { e.preventDefault(); tauschen(zieht, b.id); setZieht(null); } }}
                onDragEnd={() => setZieht(null)}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', gap: A.s,
                  background: C.flaecheHoch, border: `1px solid ${zieht === b.id ? C.aktiv : C.linie}`,
                  borderRadius: RADIUS.bauteil, padding: A.l, minHeight: 118,
                  cursor: bearbeiten ? 'grab' : 'pointer', opacity: zieht === b.id ? 0.5 : 1,
                  outline: bearbeiten ? `1px dashed ${C.linie}` : 'none', outlineOffset: 3,
                }}>
                {!bearbeiten && (
                  <Link href={b.href} aria-label={b.titel}
                    style={{ position: 'absolute', inset: 0, borderRadius: RADIUS.bauteil, zIndex: 1 }} />
                )}
                {bearbeiten && (
                  <button onClick={e => {
                    e.preventDefault(); e.stopPropagation();
                    if (b.eigen) speichern({ ...aufbau, eigene: aufbau.eigene.filter(k => k.id !== b.id) });
                    else speichern({ ...aufbau, versteckt: [...aufbau.versteckt, b.id] });
                  }} title={b.eigen ? 'Kachel löschen' : 'Von der Startfläche nehmen'}
                    style={{
                      position: 'absolute', top: -9, right: -9, zIndex: 2, width: 24, height: 24, borderRadius: '50%',
                      display: 'grid', placeItems: 'center', lineHeight: 1, background: C.grund,
                      border: `1px solid ${C.kritisch}77`, color: C.kritisch, cursor: 'pointer', fontSize: 12, padding: 0,
                    }}>✕</button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: A.s }}>
                  <Icon size={15} strokeWidth={1.75} color={C.inkLeise} style={{ flex: '0 0 auto' }} />
                  <span style={{ fontSize: TYP.bedien, fontWeight: 600, color: C.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.titel}
                  </span>
                  {l.status && (
                    <span title={l.status.text} aria-label={l.status.text}
                      style={{ width: 7, height: 7, borderRadius: '50%', background: punkt, flex: '0 0 auto', marginLeft: 'auto' }} />
                  )}
                </div>

                {haupt ? (
                  <>
                    <div style={{ ...ZIFFERN, fontSize: TYP.zahl, fontWeight: 600, lineHeight: 1.1, color: ZUSTAND[haupt.farbe ?? ''] ?? C.ink }}>
                      {haupt.wert}
                    </div>
                    <div style={{ ...MIKRO, marginTop: 'auto' }}>
                      {haupt.label}{weitere ? ` · ${weitere.wert} ${weitere.label}` : ''}
                    </div>
                  </>
                ) : (
                  <div style={{ ...MIKRO, marginTop: 'auto' }}>{l.status?.text ?? 'öffnen'}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .bereich-kachel { transition: border-color .16s ease, background .16s ease; }
        .bereich-kachel:hover { border-color: ${C.aktiv}66; background: #1D2326; }
        .bereich-kachel a:focus-visible { outline: 2px solid ${C.aktiv}; outline-offset: 2px; }
      ` }} />
    </div>
  );
}
