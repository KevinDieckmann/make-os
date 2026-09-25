'use client';

// ─── Markttraktion · Wochen-Scoreboard ──────────────────────────────────────
// Der EOS-Gedanke (25.09.): wenige Kennzahlen, Woche für Woche, mit Ziel —
// damit man sieht, ob die Arbeit einen Rhythmus hat, nicht nur, wie es heute
// steht. Oben der Verlauf des Traction-Scores (ein Schnappschuss je Tag),
// darunter die Tabelle: Kennzahl · Ziel · acht Kalenderwochen, die laufende
// hervorgehoben. Die Zelle trägt ihre Ampel als dezenten Hintergrund; grau =
// noch nichts gemessen, „offen“ = die Woche läuft noch (oder die Zeile hat
// kein Ziel). Rechnung und Regeln: lib/crm/scoreboard.ts.
//
// Die Daten holt die Karte selbst von /api/crm/traktion — dieselbe Quelle wie
// der Überblick, aber ohne die Arbeitsdaten der Seite (api) zu belasten. Auf
// dem Handy scrollt nur die Tabelle seitlich, in ihrem eigenen Behälter; die
// erste Spalte bleibt dabei stehen. Die Seite selbst scrollt nie seitlich.
//
// Darunter der Hinweis auf den Boten: ohne Telegram keine Morgen-Nachricht.
// Gekoppelt wird unter Konto › Der Bote (components/os/KontoView.tsx).

import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { FARBE as C, TYP, leuchtFarbe } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Leer, Punkt, LEUCHT } from '../schlank';
import { useAbgleich } from '@/hooks/useAbgleich';
import type { Scoreboard as ScoreboardDaten, ScoreAmpel, ScoreZeile, VerlaufTag } from '@/lib/crm/scoreboard';
import type { Welt } from '@/lib/crm/traktion';
import { nameVon, verantwortlich } from '@/lib/crm/team';
import { Person } from './team';
// Zirkulär (Ueberblick bindet diese Karte ein) — deshalb WELT_FARBE nur beim
// Zeichnen lesen, nie auf Modulebene.
import { WELT_FARBE } from './Ueberblick';
import type { CrmApi } from './daten';

interface Daten {
  heute: string;
  ich: string;
  verlauf: VerlaufTag[];
  scoreboard: ScoreboardDaten;
  telegram?: { konfiguriert: boolean; gekoppelt: boolean };
}

const AMPEL: Record<ScoreAmpel, string | null> = { gruen: LEUCHT.gut, gelb: LEUCHT.achtung, rot: LEUCHT.kritisch, grau: null, offen: null };
const WELT_LABEL: Record<Welt, string> = { sales: 'Sales', marketing: 'Marketing', event: 'Event' };
/** Hintergrund der ersten Spalte — deckend, weil sie beim seitlichen Scrollen über den Zellen steht. */
const SPALTE_GRUND = '#161C1F';
const LAUFEND_GRUND = 'rgba(255,255,255,.035)';

const anzeige = (wert: number | null, z: ScoreZeile) => (wert === null ? '—' : `${wert}${z.einheit ? ' %' : ''}`);
const tagKurz = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;

// ── Verlauf ─────────────────────────────────────────────────────────────────

function Verlauf({ tage, heute }: { tage: VerlaufTag[]; heute: string }) {
  const verlaufId = useId().replace(/:/g, '');
  const punkte = tage.filter((t): t is VerlaufTag & { score: number } => t.score !== null);
  const letzter = punkte[punkte.length - 1];
  if (punkte.length < 2) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '4px 0 14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>Traction-Score im Verlauf</span>
        {letzter && <b style={{ fontSize: TYP.body, fontVariantNumeric: 'tabular-nums', color: leuchtFarbe(letzter.score) }}>{letzter.score}</b>}
        <span style={{ fontSize: 12.5, color: C.inkLeise }}>Verlauf entsteht ab morgen — je Tag ein Schnappschuss.</span>
      </div>
    );
  }
  // x nach Kalendertagen (Lücken bleiben Lücken), y im Band um die Werte, mindestens 20 Punkte hoch.
  const t0 = Date.parse(`${punkte[0].tag}T12:00:00Z`);
  const spanne = Math.max(1, (Date.parse(`${letzter.tag}T12:00:00Z`) - t0) / 864e5);
  const werte = punkte.map(p => p.score);
  const mitte = (Math.min(...werte) + Math.max(...werte)) / 2;
  const halb = Math.max(10, (Math.max(...werte) - Math.min(...werte)) / 2 + 4);
  const unten = Math.max(0, Math.min(100 - 2 * halb, mitte - halb)), oben = Math.min(100, unten + 2 * halb);
  const xy = (p: { tag: string; score: number }) => [((Date.parse(`${p.tag}T12:00:00Z`) - t0) / 864e5 / spanne) * 100, (1 - (p.score - unten) / (oben - unten)) * 100] as const;
  const linie = punkte.map(p => xy(p).map(v => v.toFixed(2)).join(',')).join(' ');
  const [ex, ey] = xy(letzter);
  const farbe = leuchtFarbe(letzter.score);
  const vorWoche = [...punkte].reverse().find(p => p.tag <= new Date(Date.parse(`${letzter.tag}T12:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10));
  const delta = vorWoche ? letzter.score - vorWoche.score : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '2px 0 16px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkLeise, marginBottom: 6 }}>
          <span>Traction-Score · {punkte.length} Tage</span>
          <span>{tagKurz(punkte[0].tag)} – {letzter.tag === heute ? 'heute' : tagKurz(letzter.tag)}</span>
        </div>
        <div style={{ position: 'relative', height: 52 }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              <linearGradient id={`vl-${verlaufId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={farbe} stopOpacity={0.22} />
                <stop offset="100%" stopColor={farbe} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${linie} ${ex.toFixed(2)},100`} fill={`url(#vl-${verlaufId})`} />
            <polyline points={linie} fill="none" stroke={farbe} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span title={`${tagKurz(letzter.tag)}: ${letzter.score}`} style={{ position: 'absolute', left: `${ex}%`, top: `${ey}%`, width: 9, height: 9, borderRadius: '50%', background: farbe, boxShadow: `0 0 10px ${farbe}33`, transform: 'translate(-50%,-50%)' }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        <div style={{ fontSize: TYP.zahl, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: farbe, lineHeight: 1 }}>{letzter.score}</div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 4, whiteSpace: 'nowrap' }}>
          {delta === null ? 'Traktion' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)} in 7 Tagen`}
        </div>
      </div>
    </div>
  );
}

// ── Tabelle ─────────────────────────────────────────────────────────────────

function Zelle({ wert, ampel, zeile, titel, laufend }: { wert: number | null; ampel: ScoreAmpel; zeile: ScoreZeile; titel: string; laufend: boolean }) {
  const f = AMPEL[ampel];
  return (
    <td title={titel} style={{ padding: '3px 3px', background: laufend ? LAUFEND_GRUND : undefined }}>
      <span style={{
        display: 'block', minWidth: 40, padding: '5px 4px', borderRadius: 7, textAlign: 'center',
        fontSize: TYP.bedien, fontWeight: zeile.person ? 500 : 650, fontVariantNumeric: 'tabular-nums',
        background: f ? `${f}24` : ampel === 'offen' ? 'rgba(255,255,255,.04)' : 'transparent',
        boxShadow: f ? `inset 0 0 0 1px ${f}33` : undefined,
        color: wert === null ? C.inkLeise : f ? C.ink : C.inkDim,
      }}>{anzeige(wert, zeile)}</span>
    </td>
  );
}

function Tabelle({ sb }: { sb: ScoreboardDaten }) {
  const spalten = sb.wochen.length;
  const welten = (['sales', 'marketing', 'event'] as Welt[]).filter(w => sb.zeilen.some(z => z.welt === w));
  const erste: CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: SPALTE_GRUND, textAlign: 'left', padding: '6px 10px 6px 2px', whiteSpace: 'nowrap' };
  return (
    // Eigener Behälter: nur er scrollt seitlich, die Seite nie.
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -4px', padding: '0 4px' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 190 + 60 + spalten * 50 }}>
        <colgroup>
          <col style={{ width: 190 }} />
          <col style={{ width: 60 }} />
          {sb.wochen.map(w => <col key={w.von} />)}
        </colgroup>
        <thead>
          <tr>
            <th style={{ ...erste, fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise }}>Kennzahl</th>
            <th style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.inkLeise, textAlign: 'center', padding: '6px 4px' }}>Ziel</th>
            {sb.wochen.map(w => (
              <th key={w.von} title={`${tagKurz(w.von)}–${tagKurz(w.bis)}${w.laufend ? ' · laufende Woche' : ''}`} style={{ padding: '6px 3px', textAlign: 'center', fontSize: 12, fontWeight: w.laufend ? 700 : 500, color: w.laufend ? C.ink : C.inkLeise, whiteSpace: 'nowrap', borderRadius: w.laufend ? '8px 8px 0 0' : undefined, background: w.laufend ? LAUFEND_GRUND : undefined }}>
                {w.label}
                {w.laufend && <div style={{ fontSize: 11, fontWeight: 600, color: LEUCHT.puls, marginTop: 1 }}>läuft</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {welten.map(welt => (
            <Gruppe key={welt} welt={welt} zeilen={sb.zeilen.filter(z => z.welt === welt)} sb={sb} erste={erste} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Gruppe({ welt, zeilen, sb, erste }: { welt: Welt; zeilen: ScoreZeile[]; sb: ScoreboardDaten; erste: CSSProperties }) {
  const v = verantwortlich(welt);
  return (
    <>
      <tr>
        <th scope="rowgroup" style={{ ...erste, padding: '14px 10px 4px 2px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.inkDim }}>
            <Punkt farbe={WELT_FARBE[welt]} groesse={7} />{WELT_LABEL[welt]}
            <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: C.inkLeise }}>· {nameVon(v)}</span>
          </span>
        </th>
        <td colSpan={sb.wochen.length + 1} />
      </tr>
      {zeilen.map(z => (
        <tr key={z.id}>
          <th scope="row" title={z.quelle} style={{ ...erste, fontWeight: 400, paddingLeft: z.person ? 18 : 2 }}>
            {z.person
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: C.inkLeise }}><Person id={z.person} groesse={16} />{nameVon(z.person)}</span>
              : <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{z.label}</span>}
          </th>
          <td title={z.person ? 'Anteil am Teamziel' : z.ziel === null ? 'kein Wochenziel' : 'Ziel je Woche'} style={{ textAlign: 'center', fontSize: 12.5, color: C.inkLeise, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', padding: '3px 4px' }}>{z.zielText}</td>
          {z.werte.map((wert, i) => {
            const w = sb.wochen[i];
            const wer = z.person ? ` · ${nameVon(z.person)}` : '';
            return <Zelle key={w.von} wert={wert} ampel={z.ampeln[i]} zeile={z} laufend={w.laufend}
              titel={`${z.label}${wer} · ${w.label} (${tagKurz(w.von)}–${tagKurz(w.bis)}): ${wert === null ? 'noch nicht gemessen' : anzeige(wert, z)}${z.ziel !== null ? ` · Ziel ${z.zielText}` : ''}`} />;
          })}
        </tr>
      ))}
    </>
  );
}

// ── Karte ───────────────────────────────────────────────────────────────────

export function Scoreboard(_: { api: CrmApi }) {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState(false);
  const laden = useCallback(() => fetch('/api/crm/traktion', { cache: 'no-store' }).then(r => r.json())
    .then(x => { if (x?.ok && x.scoreboard) { setD(x); setFehler(false); } }).catch(() => setFehler(true)), []);
  useEffect(() => { void laden(); }, [laden]);
  // Das Scoreboard ändert sich langsam — seltener abgleichen als der Überblick.
  useAbgleich(laden, { alle: 120_000 });

  if (!d) return <Karte i={3}><Ueberschrift>Wochen-Scoreboard</Ueberschrift><Leer>{fehler ? 'Scoreboard nicht erreichbar.' : 'Lädt …'}</Leer></Karte>;
  const tg = d.telegram;
  return (
    <Karte i={3}>
      <Ueberschrift rechts={<span>{d.scoreboard.wochen.length} Wochen · Ziel je Woche</span>}>Wochen-Scoreboard</Ueberschrift>
      <Verlauf tage={d.verlauf ?? []} heute={d.heute} />
      <Tabelle sb={d.scoreboard} />
      <p style={{ fontSize: 12, color: C.inkLeise, margin: '12px 0 0', lineHeight: 1.5 }}>
        Rückwirkend aus Power Hours, Verlauf, Chancen, Redaktionsplan und Events. Grün = Ziel erreicht, gelb = mindestens die Hälfte, rot = darunter; die laufende Woche wird erst am Sonntag bewertet. Je Person gilt der Anteil am Teamziel. Grau = noch nicht gemessen.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12.5, color: C.inkDim, flexWrap: 'wrap' }}>
        <Punkt farbe={tg?.gekoppelt ? LEUCHT.gut : tg?.konfiguriert ? LEUCHT.achtung : C.inkLeise} groesse={7} />
        {!tg?.konfiguriert
          ? <span>Morgen-Nachricht aufs Handy: <Link href="/os/konto" style={{ color: C.ink }}>Telegram-Bot einrichten (Konto › Der Bote)</Link></span>
          : !tg.gekoppelt
            ? <span>Morgen-Nachricht aufs Handy: <Link href="/os/konto" style={{ color: C.ink }}>Telegram koppeln (Konto › Der Bote)</Link></span>
            : <span>Per Telegram: werktags ab 7:30 deine Morgen-Nachricht, freitags ab 15 Uhr dieses Scoreboard.</span>}
      </div>
    </Karte>
  );
}
