'use client';

// ─── MAKE OS — Onboarding ───────────────────────────────────────────────────
// Kevins Ansage: „Alles, was wir fürs Onboarding brauchen, damit die Software
// reibungslos läuft für mich und Malin — Schritt für Schritt, jeweils eigene
// Spur, weil wir unterschiedliche Daten brauchen."
//
// Der Plan prüft sich selbst: Schritte, die das System messen kann, stehen mit
// echtem Zustand da („5 überfällig von 56"). Nur was sich nicht messen lässt,
// hakt man von Hand ab — und das wird sofort gespeichert.

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import { SCHRITTE, SPUREN, schritteVon, type Schritt, type Spur } from '@/lib/make-one/onboarding-data';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

interface Befund { erfuellt: boolean; wert: string }
interface Zustand { erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, Befund> }

/** Ein Schritt gilt als getan, wenn die Prüfung greift ODER er von Hand abgehakt wurde. */
export function istFertig(s: Schritt, z: Zustand | null): boolean {
  if (!z) return false;
  if (s.pruefung && z.befunde[s.pruefung]?.erfuellt) return true;
  return !!z.erledigt[s.id];
}

export function useOnboarding() {
  const [z, setZ] = useState<Zustand | null>(null);

  const laden = useCallback(() => {
    fetch('/api/onboarding').then(r => r.json()).then(setZ).catch(() => setZ({ erledigt: {}, befunde: {} }));
  }, []);
  useEffect(laden, [laden]);

  const haken = useCallback((id: string, an: boolean, von: Spur) => {
    // Sofort sichtbar, sofort geschrieben — Kevins Regel: gleicher Stand beim nächsten Reingucken.
    setZ(alt => alt ? {
      ...alt,
      erledigt: an ? { ...alt.erledigt, [id]: { at: new Date().toISOString(), von: von === 'malin' ? 'Malin' : 'Kevin' } }
        : Object.fromEntries(Object.entries(alt.erledigt).filter(([k]) => k !== id)),
    } : alt);
    fetch('/api/onboarding', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, an, von }), keepalive: true,
    }).catch(() => {});
  }, []);

  return { z, haken, laden };
}

export function Fortschritt({ spur, z, gross }: { spur: Spur; z: Zustand | null; gross?: boolean }) {
  const alle = schritteVon(spur);
  const fertig = alle.filter(s => istFertig(s, z)).length;
  const anteil = alle.length ? fertig / alle.length : 0;
  const offen = alle.filter(s => !istFertig(s, z));
  const minuten = offen.reduce((s, x) => s + x.minuten, 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: gross ? 21 : 17, fontWeight: 700, color: anteil === 1 ? T.accent : T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {fertig}<span style={{ color: T.muted, fontWeight: 400 }}>/{alle.length}</span>
        </span>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
          {anteil === 1 ? 'fertig' : `noch ${minuten} Min.`}
        </span>
      </div>
      <div style={{ height: 6, background: T.void, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(anteil * 100)}%`, height: '100%', background: anteil === 1 ? T.accent : T.accentInk, borderRadius: 3, transition: 'width .2s ease' }} />
      </div>
    </div>
  );
}

/** Eine Schritt-Karte. Funktion statt Komponente — sonst baut React sie bei jedem Klick neu auf. */
function karte(s: Schritt, nr: number, z: Zustand | null, haken: (id: string, an: boolean, von: Spur) => void) {
  const befund = s.pruefung ? z?.befunde[s.pruefung] : undefined;
  const automatisch = !!befund?.erfuellt;
  const handisch = !!z?.erledigt[s.id];
  const fertig = automatisch || handisch;

  return (
    <div key={s.id} style={{
      ...panel, padding: '15px 18px', marginBottom: 10,
      borderLeft: `3px solid ${fertig ? T.accent : T.line}`,
      opacity: fertig ? 0.72 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={() => { if (!automatisch) haken(s.id, !handisch, s.spur); }}
          disabled={automatisch}
          title={automatisch ? 'Das prüft die Software selbst' : handisch ? 'Häkchen entfernen' : 'Als erledigt markieren'}
          aria-label={`${s.titel} ${fertig ? 'erledigt' : 'offen'}`}
          style={{
            flex: '0 0 auto', width: 20, height: 20, marginTop: 1, borderRadius: 6, cursor: automatisch ? 'default' : 'pointer',
            border: `1.5px solid ${fertig ? T.accent : T.line}`, background: fertig ? T.accent : 'transparent',
            color: T.void, fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center', padding: 0,
          }}>
          {fertig ? '✓' : ''}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{String(nr).padStart(2, '0')}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: fertig ? T.inkDim : T.ink, textDecoration: fertig ? 'line-through' : 'none' }}>{s.titel}</span>
            {s.wer && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, border: `1px solid ${T.line}`, borderRadius: 5, padding: '1px 6px' }}>{s.wer}</span>}
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 'auto' }}>{s.minuten} Min.</span>
          </div>

          <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55, margin: '5px 0 0' }}>{s.warum}</p>

          {!fertig && (
            <ol style={{ margin: '9px 0 0', paddingLeft: 17 }}>
              {s.wie.map((w, i) => (
                <li key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.6, marginBottom: 2 }}>{w}</li>
              ))}
            </ol>
          )}

          {s.befehl && !fertig && (
            <pre style={{
              margin: '9px 0 0', padding: '9px 11px', background: T.void, border: `1px solid ${T.line}`, borderRadius: 9,
              fontFamily: T.mono, fontSize: 11, color: T.accentInk, overflowX: 'auto', whiteSpace: 'pre',
            }}>{s.befehl}</pre>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 9 }}>
            {befund && (
              <span style={{
                fontFamily: T.mono, fontSize: 11, borderRadius: 6, padding: '2px 8px',
                color: befund.erfuellt ? T.accent : T.amber,
                border: `1px solid ${befund.erfuellt ? T.accent : T.amber}44`,
                background: `${befund.erfuellt ? T.accent : T.amber}12`,
              }}>
                {befund.erfuellt ? '✓ ' : '◇ '}{befund.wert}
              </span>
            )}
            {s.wo && (
              <Link href={s.wo.href} style={{ fontFamily: T.mono, fontSize: 11, color: T.accentInk, textDecoration: 'none' }}>{s.wo.label} ›</Link>
            )}
            {handisch && !automatisch && z?.erledigt[s.id] && (
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>
                abgehakt von {z.erledigt[s.id].von}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpurView({ spur }: { spur: Spur }) {
  const { z, haken } = useOnboarding();
  const meta = SPUREN.find(s => s.id === spur)!;
  const schritte = schritteVon(spur);

  return (
    <Rahmen titel={meta.titel} unter={meta.satz}>
      <div style={{ ...panel, padding: '15px 19px', marginBottom: 16 }}>
        <Fortschritt spur={spur} z={z} gross />
      </div>
      {schritte.map((s, i) => karte(s, i + 1, z, haken))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {SPUREN.filter(s => s.id !== spur).map(s => (
          <Link key={s.id} href={s.href} style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim, textDecoration: 'none', border: `1px solid ${T.line}`, borderRadius: 8, padding: '6px 11px' }}>
            {s.titel} ›
          </Link>
        ))}
      </div>
    </Rahmen>
  );
}

export function OnboardingUebersicht() {
  const { z, haken } = useOnboarding();
  const alle = SCHRITTE;
  const fertig = alle.filter(s => istFertig(s, z)).length;
  const restMinuten = alle.filter(s => !istFertig(s, z)).reduce((s, x) => s + x.minuten, 0);

  return (
    <Rahmen titel="Onboarding" unter="Alles, was drin sein muss, damit MAKE OS für euch beide reibungslos läuft.">
      <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '15px 19px', marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>
          <strong>{fertig} von {alle.length}</strong> Schritten stehen — noch rund <strong>{Math.round(restMinuten / 60 * 10) / 10} Stunden</strong> Arbeit,
          verteilt auf drei Spuren. Vieles prüft die Software selbst: Schritte mit einem grünen Befund sind schon erledigt, ohne dass jemand ein Häkchen setzen muss.
        </div>
      </div>

      <div style={{ ...lbl, marginBottom: 8 }}>Die drei Spuren</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(268px,1fr))', gap: 12, marginBottom: 22 }}>
        {SPUREN.map(s => {
          const offen = schritteVon(s.id).filter(x => !istFertig(x, z));
          return (
            <Link key={s.id} href={s.href} className="bereich-kachel" style={{ ...panel, padding: '16px 18px', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, marginBottom: 3 }}>{s.titel}</div>
              <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 11, minHeight: 34 }}>{s.satz}</div>
              <Fortschritt spur={s.id} z={z} />
              {!!offen.length && (
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  als Nächstes: {offen[0].titel}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      <div style={{ ...lbl, marginBottom: 8 }}>Fundament — einmal aufsetzen, dann läuft es für beide</div>
      {schritteVon('fundament').map((s, i) => karte(s, i + 1, z, haken))}

      <div style={{ ...panel, padding: '15px 19px', marginTop: 18 }}>
        <div style={{ ...lbl, marginBottom: 7 }}>Danach</div>
        <div style={{ fontSize: 13, color: T.inkDim, lineHeight: 1.65 }}>
          Wenn das Fundament steht, geht jeder seine eigene Spur — <Link href="/os/onboarding/kevin" style={{ color: T.accentInk, textDecoration: 'none' }}>Kevin</Link> füllt
          Kalender, Postfach, Kompass und Gesundheit, <Link href="/os/onboarding/malin" style={{ color: T.accentInk, textDecoration: 'none' }}>Malin</Link> die
          Finanzen und offenen Posten. Die Regeln fürs Nebeneinander stehen unter{' '}
          <Link href="/os/onboarding/zusammenarbeit" style={{ color: T.accentInk, textDecoration: 'none' }}>Zusammenarbeit</Link>.
        </div>
      </div>
    </Rahmen>
  );
}

export function Rahmen({ titel, unter, children }: { titel: string; unter: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '26px clamp(16px,3vw,36px) 60px' }}>
        <Link href="/os/onboarding" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Onboarding</Link>
        <Seitenkopf
          rubrik={<>Onboarding</>}
          titel={<>{titel}</>}
          satz={<>{unter}</>}
        />
        {children}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .bereich-kachel { transition: border-color .16s ease, background .16s ease; }
        .bereich-kachel:hover { border-color: ${T.lineHot}; background: ${T.panel2}; }
      ` }} />
    </div>
  );
}
