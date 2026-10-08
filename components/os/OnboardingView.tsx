'use client';

// ─── MAKE OS — Onboarding „Einrichtung“ ─────────────────────────────────────
// Kevin 08.10. spät: „Ein komplettes Onboarding mit Erklärung, sodass wir alles wirklich sauber verbinden können. Auch alle Zahlen,
// Daten, Fakten sollen sauber rein.“ Paket B0 (ONBOARDING_PLAN.md A5): alle Schritte der Etappen 0–8 mit Erklärung (warum, was
// passiert, was danach anders ist), die Datenkarte und der Ablauf — in den bestehenden Spuren, neutral benannt (Inhaber · Zweite Person).
//
// Der Plan prüft sich selbst: Schritte, die das System messen kann, stehen mit echtem Zustand da (nur ja/nein oder Zähler). Nur was
// sich nicht messen lässt, hakt man von Hand ab — persönliche Häkchen je Person, gemeinsame für den Haushalt; Inhaber-Schritte hakt
// nur der Inhaber ab (der Server prüft das, die Oberfläche zeigt es nur an). Daten aus /api/onboarding.

import Link from 'next/link';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import {
  ABLAUF, DATENKARTE, ETAPPEN, SPUREN, fortschrittVon, istFertig, schritteFuer, schritteVon, spurFuerRolle, werText,
  type Kontext, type Schritt, type Spur,
} from '@/lib/make-one/onboarding-data';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Chip, Hinweis, HakenZiel, Knopf, Fortschritt as FortschrittBalken, LEUCHT } from './ui';

const link: CSSProperties = { color: C.inkDim, textDecoration: 'none' };
const absatz: CSSProperties = { fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6, margin: 0 };

interface Befund { erfuellt: boolean; wert: string }
export interface Zustand { erledigt: Record<string, { at: string; von: string }>; befunde: Record<string, Befund>; ich: Kontext | null }

export function useOnboarding() {
  const [z, setZ] = useState<Zustand | null>(null);
  const [meldung, setMeldung] = useState('');

  const laden = useCallback(() => {
    fetch('/api/onboarding', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
      .then(d => setZ(d ? { erledigt: d.erledigt ?? {}, befunde: d.befunde ?? {}, ich: d.ich ?? null } : { erledigt: {}, befunde: {}, ich: null }))
      .catch(() => setZ({ erledigt: {}, befunde: {}, ich: null }));
  }, []);
  useEffect(laden, [laden]);

  const haken = useCallback(async (id: string, an: boolean) => {
    // Sofort sichtbar, dann geschrieben; der Server antwortet mit dem gültigen Stand (oder einem Grund — dann zurück).
    setMeldung('');
    setZ(alt => alt ? {
      ...alt,
      erledigt: an ? { ...alt.erledigt, [id]: { at: new Date().toISOString(), von: 'dir' } } : Object.fromEntries(Object.entries(alt.erledigt).filter(([k]) => k !== id)),
    } : alt);
    try {
      const r = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, an }), keepalive: true });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.erledigt) setZ(alt => (alt ? { ...alt, erledigt: d.erledigt } : alt));
      else { setMeldung(d?.error ?? 'Nicht gespeichert.'); laden(); }
    } catch { setMeldung('Nicht gespeichert — offline?'); laden(); }
  }, [laden]);

  return { z, haken, laden, meldung };
}

/** Fortschritt einer Schrittliste: „12/20 · noch 45 Min.“ mit Balken. */
export function Fortschritt({ schritte, z, gross }: { schritte: readonly Schritt[]; z: Zustand | null; gross?: boolean }) {
  const f = fortschrittVon(schritte, z);
  const anteil = f.gesamt ? f.fertig / f.gesamt : 0;
  const fertig = f.gesamt > 0 && f.fertig === f.gesamt;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: gross ? 'clamp(28px,4vw,36px)' : TYP.zahl, fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1, color: fertig ? LEUCHT.gut : C.ink, fontVariantNumeric: 'tabular-nums' }}>
          {f.fertig}<span style={{ color: C.inkLeise, fontWeight: 400 }}>/{f.gesamt}</span>
        </span>
        <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{fertig ? 'fertig' : `noch ${stundenText(f.offeneMinuten)}`}</span>
      </div>
      <FortschrittBalken anteil={anteil} farbe={fertig ? LEUCHT.gut : LEUCHT.schlaf} />
    </div>
  );
}

const stundenText = (min: number) => (min < 60 ? `${min} Min.` : `rund ${Math.round(min / 60 * 10) / 10} Std.`);

/** Der Haken am Schritt: automatisch geprüft = Anzeige; von Hand = Haken (44 px); Inhaber-Schritt für andere = gesperrt. */
function SchrittHaken({ s, fertig, automatisch, darf, onKlick }: { s: Schritt; fertig: boolean; automatisch: boolean; darf: boolean; onKlick: () => void }) {
  if (automatisch || !darf) {
    return (
      <span title={automatisch ? 'Das prüft die Software selbst' : 'Diesen Schritt hakt nur der Inhaber ab'} aria-label={`${s.titel} ${fertig ? 'erledigt' : 'offen'}`}
        style={{ width: 44, height: 44, flex: '0 0 auto', display: 'grid', placeItems: 'center' }}>
        <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', boxSizing: 'border-box', border: `2px solid ${fertig ? LEUCHT.gut : C.inkLeise}`, background: fertig ? `${LEUCHT.gut}33` : 'transparent', color: LEUCHT.gut, fontSize: 13, fontWeight: 800, opacity: darf || fertig ? 1 : 0.5 }}>{fertig ? '✓' : ''}</span>
      </span>
    );
  }
  return <HakenZiel an={fertig} onChange={onKlick} farbe={C.inkLeise} label={s.titel} />;
}

/** Eine Schritt-Zeile. Funktion statt Komponente — sonst baut React sie bei jedem Klick neu auf. */
function schrittZeile(s: Schritt, z: Zustand | null, haken: (id: string, an: boolean) => void) {
  const befund = s.pruefung ? z?.befunde[s.pruefung] : undefined;
  const automatisch = !!befund?.erfuellt;
  const handisch = !!z?.erledigt[s.id];
  const fertig = istFertig(s, z);
  const darf = !s.nurInhaber || !!z?.ich?.inhaber;
  const wann = handisch && !automatisch ? z?.erledigt[s.id] : undefined;
  return (
    <div key={s.id} style={{ opacity: fertig ? 0.72 : 1 }}>
      <Zeile umbrechen
        links={<SchrittHaken s={s} fertig={fertig} automatisch={automatisch} darf={darf} onKlick={() => haken(s.id, !handisch)} />}
        titel={<><span style={{ color: C.inkLeise, fontWeight: 400 }}>{s.nr} · </span><span style={{ color: fertig ? C.inkDim : C.ink, textDecoration: fertig ? 'line-through' : 'none' }}>{s.titel}</span></>}
        rechts={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Chip farbe={s.ebene === 'ich' ? LEUCHT.schlaf : s.nurInhaber ? LEUCHT.puls : LEUCHT.beziehung}>{werText(s)}</Chip>
            {s.optional && <Chip farbe={C.inkLeise}>optional</Chip>}
            {befund && <Chip umbrechen farbe={befund.erfuellt ? LEUCHT.gut : LEUCHT.achtung}>{befund.erfuellt ? '✓ ' : '◇ '}{befund.wert}</Chip>}
            <Chip farbe={C.inkLeise}>{s.minuten} Min.</Chip>
          </div>
        } />
      <div style={{ padding: '2px 2px 14px 54px' }}>
        {!fertig && (
          <>
            <p style={absatz}>{s.warum}</p>
            <ol style={{ margin: '8px 0 0', paddingLeft: 17 }}>
              {s.wie.map((w, i) => <li key={i} style={{ ...absatz, marginBottom: 3 }}>{w}</li>)}
            </ol>
            {s.befehl && (
              <pre style={{ margin: '9px 0 0', padding: '9px 11px', background: 'rgba(255,255,255,.05)', borderRadius: 9, fontFamily: SCHRIFT.mono, fontSize: TYP.bedien, color: LEUCHT.geld, overflowX: 'auto', whiteSpace: 'pre' }}>{s.befehl}</pre>
            )}
            {s.danach && <p style={{ ...absatz, marginTop: 8 }}><span style={{ color: C.ink, fontWeight: 600 }}>Danach: </span>{s.danach}</p>}
          </>
        )}
        {(s.wo || wann) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: fertig ? 0 : 8, fontSize: TYP.bedien, color: C.inkLeise }}>
            {s.wo && <Link href={s.wo.href} style={link}>{s.wo.label} ›</Link>}
            {wann && <span>abgehakt von {wann.von}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Die Schritte nach Etappen gruppiert — mit Satz und den Hinweisen der Etappe (entschieden, aber noch nicht gebaut). */
function NachEtappen({ schritte, z, haken, start }: { schritte: readonly Schritt[]; z: Zustand | null; haken: (id: string, an: boolean) => void; start: number }) {
  const etappen = ETAPPEN.filter(e => schritte.some(s => s.etappe === e.nr));
  return (
    <>
      {etappen.map((e, i) => {
        const liste = schritte.filter(s => s.etappe === e.nr);
        const fertig = liste.filter(s => istFertig(s, z)).length;
        return (
          <Karte key={e.nr} i={start + i}>
            <Ueberschrift rechts={`${fertig} von ${liste.length}`}>{`Etappe ${e.nr} · ${e.titel}`}</Ueberschrift>
            <p style={{ ...absatz, marginBottom: 10 }}>{e.satz}</p>
            {(e.hinweise ?? []).map(h => (
              <div key={h.titel} style={{ marginBottom: 10 }}><Hinweis art="info" titel={`${h.titel} — ${h.wann}`}>{h.satz}</Hinweis></div>
            ))}
            {(e.nr === 3 || e.nr === 5) && <p style={{ ...absatz, marginBottom: 10 }}>Welche Zahl wohin gehört, steht in der <Link href="/os/onboarding#datenkarte" style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>Datenkarte ›</Link></p>}
            <Liste>{liste.map(s => schrittZeile(s, z, haken))}</Liste>
          </Karte>
        );
      })}
    </>
  );
}

/** Die Datenkarte (ONBOARDING_PLAN.md A3): je Fakt EIN Eingabeort. */
export function DatenkarteKarte({ i }: { i: number }) {
  return (
    <Karte i={i} id="datenkarte">
      <Ueberschrift rechts={`${DATENKARTE.length} Fakten`}>Datenkarte — welche Zahl wohin</Ueberschrift>
      <p style={{ ...absatz, marginBottom: 10 }}>Jede Zahl hat genau einen Eingabeort. Wo es heute noch einen zweiten gibt, steht er rechts — dort nicht (noch einmal) pflegen.</p>
      <Liste>
        {DATENKARTE.map(d => (
          <Zeile key={d.fakt} umbrechen titel={d.fakt}
            unter={<span><span style={{ color: LEUCHT.gut }}>hier: </span>{d.href ? <Link href={d.href} style={{ color: C.ink, textDecoration: 'none' }}>{d.hier} ›</Link> : d.hier}{d.nicht !== '–' && <><span style={{ color: LEUCHT.achtung }}> · nicht: </span>{d.nicht}</>}</span>} />
        ))}
      </Liste>
    </Karte>
  );
}

function Meldung({ text }: { text: string }) {
  return text ? <Hinweis art="achtung" rolle="alert">{text}</Hinweis> : null;
}

export function SpurView({ spur }: { spur: Exclude<Spur, 'ich'> }) {
  const { z, haken, meldung } = useOnboarding();
  const meta = SPUREN.find(s => s.id === spur)!;
  const schritte = schritteVon(spur);
  const meine = z?.ich ? spurFuerRolle(z.ich.inhaber) === spur : false;
  return (
    <Seite titel={meta.titel} unter={meta.satz} rechts={<Knopf leise href="/os/onboarding">Einrichtung ›</Knopf>}>
      <Meldung text={meldung} />
      <Karte i={0} ton={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={meine ? <Chip farbe={LEUCHT.gut}>deine Spur</Chip> : undefined}>Stand der Spur</Ueberschrift>
        <Fortschritt schritte={schritte} z={z} gross />
        {(spur === 'kevin' || spur === 'malin') && (
          <p style={{ ...absatz, marginTop: 12 }}>
            Schritte mit „jede Person“ gehören zu „Meine Einrichtung“: Prüfung und Häkchen gelten immer der Person, die gerade angemeldet ist — jede sieht nur ihren eigenen Stand, nie den einer anderen.
          </p>
        )}
      </Karte>
      <NachEtappen schritte={schritte} z={z} haken={haken} start={1} />
      {spur === 'kevin' && <DatenkarteKarte i={10} />}
      <Karte i={11}>
        <Ueberschrift>Die anderen Spuren</Ueberschrift>
        <Liste>
          {SPUREN.filter(s => s.id !== spur).map(s => (
            <Link key={s.id} href={s.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Zeile onClick={() => {}} titel={s.titel} unter={s.satz} />
            </Link>
          ))}
        </Liste>
      </Karte>
    </Seite>
  );
}

export function OnboardingUebersicht() {
  const { z, haken, meldung } = useOnboarding();
  const meine = schritteFuer(z?.ich ?? null);
  const f = fortschrittVon(meine, z);
  const eigeneSpur = z?.ich ? spurFuerRolle(z.ich.inhaber) : null;
  return (
    <Seite titel="Einrichtung" unter="Alles verbinden und eure echten Zahlen eintragen — Schritt für Schritt, mit Erklärung.">
      <Meldung text={meldung} />
      <Karte i={0} ton={LEUCHT.schlaf}>
        <Ueberschrift farbe={LEUCHT.schlaf} rechts={`${f.fertig} von ${f.gesamt} Schritten`}>Dein Stand</Ueberschrift>
        <Fortschritt schritte={meine} z={z} gross />
        <p style={{ ...absatz, marginTop: 12 }}>
          Gezählt werden deine Schritte („Meine Einrichtung“), die gemeinsamen{z?.ich?.inhaber ? ' und — als Inhaber — die der Instanz' : ''}. Vieles prüft die Software selbst:
          ein grüner Befund heißt erledigt, ohne dass jemand ein Häkchen setzt. Optionale Schritte zählen erst, wenn sie getan sind.
          {f.naechster && <> Als Nächstes: <strong style={{ color: C.ink, fontWeight: 600 }}>{f.naechster.nr} · {f.naechster.titel}</strong>.</>}
        </p>
      </Karte>

      <Karte i={1}>
        <Ueberschrift>So läuft die Einrichtung</Ueberschrift>
        <Liste>{ABLAUF.map(a => <Zeile key={a.wann} umbrechen titel={a.wann} unter={a.was} />)}</Liste>
        <p style={{ ...absatz, marginTop: 10 }}>
          Drei Ebenen: <strong style={{ color: C.ink, fontWeight: 600 }}>Instanz</strong> (Server und Einstellungen — nur der Inhaber),{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>Gemeinsam</strong> (Haushalt und Firmen — alle sehen den Stand) und{' '}
          <strong style={{ color: C.ink, fontWeight: 600 }}>Meine Einrichtung</strong> (jede Person für sich). Prüfungen zeigen nur ja/nein oder Zähler — nie Werte.
          Nichts geht ohne euren Klick nach außen; Schritte am Server zeigen nur den Befehl, nie einen Wert.
        </p>
      </Karte>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(268px, 100%), 1fr))', gap: 14 }}>
        {SPUREN.map((s, i) => {
          const liste = schritteVon(s.id);
          const naechster = fortschrittVon(liste, z).naechster;
          return (
            <Link key={s.id} href={s.id === 'fundament' ? '#etappe-liste' : s.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <Karte i={2 + i} style={{ height: '100%' }}>
                <Ueberschrift rechts={eigeneSpur === s.id ? <Chip farbe={LEUCHT.gut}>deine Spur</Chip> : <span>›</span>}>{s.titel}</Ueberschrift>
                <p style={{ ...absatz, margin: '0 0 12px' }}>{s.satz}</p>
                <Fortschritt schritte={liste} z={z} />
                {naechster && <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginTop: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>als Nächstes: {naechster.titel}</div>}
              </Karte>
            </Link>
          );
        })}
      </div>

      <div id="etappe-liste" />
      <Karte i={5} flach>
        <Ueberschrift rechts={`${schritteVon('fundament').length} Schritte`}>Instanz & Gemeinsam</Ueberschrift>
        <p style={absatz}>
          Die Schritte für Server, Instanz und alles Gemeinsame. Was nur der Inhaber einträgt und „Meine Einrichtung“ stehen in den Spuren{' '}
          <Link href={SPUREN[1].href} style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>{SPUREN[1].titel}</Link> und{' '}
          <Link href={SPUREN[2].href} style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>{SPUREN[2].titel}</Link>. Die Regeln fürs Nebeneinander stehen unter{' '}
          <Link href="/os/onboarding/zusammenarbeit" style={{ color: C.ink, fontWeight: 600, textDecoration: 'none' }}>Zusammenarbeit</Link>.
        </p>
      </Karte>
      <NachEtappen schritte={schritteVon('fundament')} z={z} haken={haken} start={6} />
      <DatenkarteKarte i={15} />
    </Seite>
  );
}
