'use client';

// ─── MAKE OS — Onboarding ───────────────────────────────────────────────────
// Kevins Ansage: „Alles, was wir fürs Onboarding brauchen, damit die Software
// reibungslos läuft für mich und Malin — Schritt für Schritt, jeweils eigene
// Spur, weil wir unterschiedliche Daten brauchen."
//
// Der Plan prüft sich selbst: Schritte, die das System messen kann, stehen mit
// echtem Zustand da („5 überfällig von 56"). Nur was sich nicht messen lässt,
// hakt man von Hand ab — und das wird sofort gespeichert.
// 24.09.: auf das lebendige Muster umgezogen (Seite/Karte/Zeile, LEUCHT).

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { SCHRITTE, SPUREN, schritteVon, type Schritt, type Spur } from '@/lib/make-one/onboarding-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Fortschritt as FortschrittBalken, LEUCHT } from './schlank';

/** Ein Verweis, der wie ein leiser Knopf aussieht. */
const linkKnopf: CSSProperties = {
  fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 700, padding: '9px 15px', borderRadius: 11, whiteSpace: 'nowrap',
  background: 'rgba(255,255,255,.06)', color: C.ink, textDecoration: 'none',
};
const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };

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

/** Fortschritt einer Spur: „12/20 · noch 45 Min." mit leuchtendem Balken. */
export function Fortschritt({ spur, z, gross }: { spur: Spur; z: Zustand | null; gross?: boolean }) {
  const alle = schritteVon(spur);
  const fertig = alle.filter(s => istFertig(s, z)).length;
  const anteil = alle.length ? fertig / alle.length : 0;
  const offen = alle.filter(s => !istFertig(s, z));
  const minuten = offen.reduce((s, x) => s + x.minuten, 0);
  const farbe = anteil === 1 ? LEUCHT.gut : LEUCHT.schlaf;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: gross ? 'clamp(28px,4vw,36px)' : TYP.zahl, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: anteil === 1 ? LEUCHT.gut : C.ink, fontVariantNumeric: 'tabular-nums' }}>
          {fertig}<span style={{ color: C.inkLeise, fontWeight: 400 }}>/{alle.length}</span>
        </span>
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>
          {anteil === 1 ? 'fertig' : `noch ${minuten} Min.`}
        </span>
      </div>
      <FortschrittBalken anteil={anteil} farbe={farbe} />
    </div>
  );
}

/** Der Haken am Schritt — leuchtet grün, wenn getan; grau, wenn die Software ihn selbst setzt. */
function Hakerl({ fertig, automatisch, onClick, titel, label }: { fertig: boolean; automatisch: boolean; onClick: () => void; titel: string; label: string }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }} disabled={automatisch} title={titel} aria-label={label} className="fassbar" style={{
      width: 24, height: 24, borderRadius: 8, flex: '0 0 auto', cursor: automatisch ? 'default' : 'pointer', display: 'grid', placeItems: 'center', padding: 0,
      border: `2px solid ${fertig ? LEUCHT.gut : C.inkLeise}`, background: fertig ? LEUCHT.gut : 'transparent', color: C.grund, fontSize: 13, fontWeight: 800,
      boxShadow: fertig ? `0 0 12px ${LEUCHT.gut}88` : undefined, transition: 'background .2s ease, box-shadow .2s ease',
    }}>{fertig ? '✓' : ''}</button>
  );
}

/** Eine Schritt-Zeile. Funktion statt Komponente — sonst baut React sie bei jedem Klick neu auf. */
function karte(s: Schritt, nr: number, z: Zustand | null, haken: (id: string, an: boolean, von: Spur) => void) {
  const befund = s.pruefung ? z?.befunde[s.pruefung] : undefined;
  const automatisch = !!befund?.erfuellt;
  const handisch = !!z?.erledigt[s.id];
  const fertig = automatisch || handisch;

  return (
    <div key={s.id} style={{ opacity: fertig ? 0.72 : 1 }}>
      <Zeile
        links={
          <Hakerl fertig={fertig} automatisch={automatisch}
            onClick={() => { if (!automatisch) haken(s.id, !handisch, s.spur); }}
            titel={automatisch ? 'Das prüft die Software selbst' : handisch ? 'Häkchen entfernen' : 'Als erledigt markieren'}
            label={`${s.titel} ${fertig ? 'erledigt' : 'offen'}`} />
        }
        titel={<><span style={{ color: C.inkLeise, fontWeight: 400 }}>{String(nr).padStart(2, '0')} · </span><span style={{ color: fertig ? C.inkDim : C.ink, textDecoration: fertig ? 'line-through' : 'none' }}>{s.titel}</span></>}
        unter={<span title={s.warum}>{s.warum}</span>}
        rechts={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {s.wer && <Chip farbe={LEUCHT.beziehung}>{s.wer}</Chip>}
            {befund && <Chip farbe={befund.erfuellt ? LEUCHT.gut : LEUCHT.achtung}>{befund.erfuellt ? '✓ ' : '◇ '}{befund.wert}</Chip>}
            <Chip farbe={C.inkLeise}>{s.minuten} Min.</Chip>
          </div>
        } />

      <div style={{ padding: '4px 2px 12px 38px' }}>
        {!fertig && (
          <>
            <p style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, margin: 0 }}>{s.warum}</p>
            <ol style={{ margin: '8px 0 0', paddingLeft: 17 }}>
              {s.wie.map((w, i) => (
                <li key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, marginBottom: 2 }}>{w}</li>
              ))}
            </ol>
            {s.befehl && (
              <pre style={{
                margin: '9px 0 0', padding: '9px 11px', background: 'rgba(255,255,255,.05)', borderRadius: 9,
                fontFamily: SCHRIFT.mono, fontSize: 12, color: LEUCHT.geld, overflowX: 'auto', whiteSpace: 'pre',
              }}>{s.befehl}</pre>
            )}
          </>
        )}
        {(s.wo || (handisch && !automatisch && z?.erledigt[s.id])) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: fertig ? 0 : 8, fontSize: 12, color: C.inkLeise }}>
            {s.wo && <Link href={s.wo.href} style={link}>{s.wo.label} ›</Link>}
            {handisch && !automatisch && z?.erledigt[s.id] && <span>abgehakt von {z.erledigt[s.id].von}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function SpurView({ spur }: { spur: Spur }) {
  const { z, haken } = useOnboarding();
  const meta = SPUREN.find(s => s.id === spur)!;
  const schritte = schritteVon(spur);

  return (
    <Rahmen titel={meta.titel} unter={meta.satz} rechts={<Link href="/os/onboarding" className="fassbar" style={linkKnopf}>Onboarding ›</Link>}>
      <Karte i={0} akzent={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf}>Stand der Spur</Ueberschrift>
        <Fortschritt spur={spur} z={z} gross />
      </Karte>
      <Karte i={1}>
        <Ueberschrift rechts={`${schritte.length} Schritte`}>Die Schritte</Ueberschrift>
        <Liste>{schritte.map((s, i) => karte(s, i + 1, z, haken))}</Liste>
      </Karte>
      <Karte i={2}>
        <Ueberschrift>Die anderen Spuren</Ueberschrift>
        <Liste>
          {SPUREN.filter(s => s.id !== spur).map(s => (
            <Link key={s.id} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile onClick={() => {}} titel={s.titel} unter={s.satz} rechts={<span style={{ color: C.inkLeise }}>›</span>} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Rahmen>
  );
}

export function OnboardingUebersicht() {
  const { z, haken } = useOnboarding();
  const alle = SCHRITTE;
  const fertig = alle.filter(s => istFertig(s, z)).length;
  const restMinuten = alle.filter(s => !istFertig(s, z)).reduce((s, x) => s + x.minuten, 0);
  const stunden = Math.round(restMinuten / 60 * 10) / 10;

  return (
    <Rahmen titel="Onboarding" unter="Alles, was drin sein muss, damit MAKE OS für euch beide reibungslos läuft.">
      <Karte i={0} akzent={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={`${fertig} von ${alle.length} Schritten`}>Stand</Ueberschrift>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: SCHRIFT.display, fontSize: 'clamp(28px,4vw,36px)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: fertig === alle.length ? LEUCHT.gut : C.ink, fontVariantNumeric: 'tabular-nums' }}>
            {fertig}<span style={{ color: C.inkLeise, fontWeight: 400 }}>/{alle.length}</span>
          </span>
          <span style={{ fontSize: 12.5, color: C.inkLeise }}>{fertig === alle.length ? 'fertig' : `noch rund ${stunden} Stunden`}</span>
        </div>
        <FortschrittBalken anteil={alle.length ? fertig / alle.length : 0} farbe={fertig === alle.length ? LEUCHT.gut : LEUCHT.schlaf} />
        <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.6, margin: '14px 0 0' }}>
          <strong style={{ color: C.ink, fontWeight: 600 }}>{fertig} von {alle.length}</strong> Schritten stehen — noch rund <strong style={{ color: C.ink, fontWeight: 600 }}>{stunden} Stunden</strong> Arbeit,
          verteilt auf drei Spuren. Vieles prüft die Software selbst: Schritte mit einem grünen Befund sind schon erledigt, ohne dass jemand ein Häkchen setzen muss.
        </p>
      </Karte>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(268px, 1fr))', gap: 14 }}>
        {SPUREN.map((s, i) => {
          const offen = schritteVon(s.id).filter(x => !istFertig(x, z));
          return (
            <Link key={s.id} href={s.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <Karte i={1 + i} style={{ height: '100%' }}>
                <Ueberschrift rechts={<span>›</span>}>{s.titel}</Ueberschrift>
                <p style={{ fontSize: 12.5, color: C.inkLeise, lineHeight: 1.5, margin: '0 0 12px', minHeight: 34 }}>{s.satz}</p>
                <Fortschritt spur={s.id} z={z} />
                {!!offen.length && (
                  <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    als Nächstes: {offen[0].titel}
                  </div>
                )}
              </Karte>
            </Link>
          );
        })}
      </div>

      <Karte i={4}>
        <Ueberschrift rechts={`${schritteVon('fundament').length} Schritte`}>Fundament — einmal aufsetzen, dann läuft es für beide</Ueberschrift>
        <Liste>{schritteVon('fundament').map((s, i) => karte(s, i + 1, z, haken))}</Liste>
      </Karte>

      <Karte i={5}>
        <Ueberschrift>Danach</Ueberschrift>
        <p style={{ fontSize: TYP.body, color: C.inkDim, lineHeight: 1.65, margin: 0 }}>
          Wenn das Fundament steht, geht jeder seine eigene Spur — <Link href="/os/onboarding/kevin" style={{ color: C.ink, textDecoration: 'none', fontWeight: 600 }}>Kevin</Link> füllt
          Kalender, Postfach, Kompass und Gesundheit, <Link href="/os/onboarding/malin" style={{ color: C.ink, textDecoration: 'none', fontWeight: 600 }}>Malin</Link> die
          Finanzen und offenen Posten. Die Regeln fürs Nebeneinander stehen unter{' '}
          <Link href="/os/onboarding/zusammenarbeit" style={{ color: C.ink, textDecoration: 'none', fontWeight: 600 }}>Zusammenarbeit</Link>.
        </p>
      </Karte>
    </Rahmen>
  );
}

export function Rahmen({ titel, unter, rechts, children }: { titel: string; unter: string; rechts?: ReactNode; children: ReactNode }) {
  return (
    <Seite titel={titel} unter={unter} rechts={rechts}>
      {children}
    </Seite>
  );
}
