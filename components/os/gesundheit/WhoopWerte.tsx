'use client';

// ─── Gesundheit: die weiteren WHOOP-Werte als schlichte Karten (09.10.2026) ──────────────────────────────────────────────
// Kevin 09.10.: „Strain wird nicht angezeigt“ → „optimiere das Cockpit mit allen Daten, die du bekommen kannst“; dann: die große
// Neugestaltung wartet, bis die trainierende Person sagt, was sie braucht (research/gesundheit/COCKPIT_VORSCHLAG.md). Für jetzt zwei
// kleine Karten neben dem Morgen-Check, ohne die Seite umzubauen:
//   Schlaf       geschlafen gegen Bedarf, Phasen als ein Balken, Leistung · Konsistenz · Effizienz · Störungen
//   Körperwerte  HRV, Ruhepuls, Atemfrequenz, SpO2, Hauttemperatur — gegen den EIGENEN Ø der 7 Tage davor; dazu Energie und Schritte
// Die Werte rechnet der Server (lib/gesundheit/koerperwerte.ts, über /api/gesundheit/stand — dasselbe Art.-9-Tor wie die Vitalwerte);
// hier wird nur gezeigt. Fehlt ein Wert: „—“, nie eine Null. Keine ärztliche Beratung.

import { FARBE as C, TYP, SCHRIFT, RAND, ECKE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Fortschritt, LEUCHT } from '../ui';
import { phasenAnteile, type Koerperwerte, type KoerperWert } from '@/lib/gesundheit/koerperwerte';

const zahl = (n: number, stellen = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
const vorz = (n: number, stellen = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${zahl(Math.abs(n), stellen)}`;
/** Stunden als „7:24 h“ (Dauer liest sich so schneller als 7,4 h). */
const hm = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`; };
const tagText = (tag: string, heute: string) => (tag === heute ? 'heute' : `vom ${tag.slice(8, 10)}.${tag.slice(5, 7)}.`);

/** Farben der Schlafphasen — eine Farbfamilie (Schlaf-Violett), Wach neutral. */
const PHASE = [
  { id: 'tief', label: 'Tief', farbe: LEUCHT.schlaf },
  { id: 'rem', label: 'REM', farbe: LEUCHT.puls },
  { id: 'leicht', label: 'Leicht', farbe: `${LEUCHT.schlaf}80` },
  { id: 'wach', label: 'Wach', farbe: C.inkLeise },
] as const;

function Wert({ label, wert, unter }: { label: string; wert?: string; unter?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.titel, fontVariantNumeric: 'tabular-nums', color: wert ? C.ink : C.inkLeise }}>{wert ?? '—'}</div>
      <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>{label}</div>
      {unter && <div style={{ fontSize: TYP.bedien, color: C.inkLeise }}>{unter}</div>}
    </div>
  );
}

export function SchlafDetailKarte({ k, heute, i = 0 }: { k: Koerperwerte; heute: string; i?: number }) {
  const s = k.schlaf;
  const p = phasenAnteile(s.phasen);
  const fehlt = s.dauer !== undefined && s.bedarf !== undefined ? s.bedarf - s.dauer : undefined;
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.schlaf} rechts={tagText(k.tag, heute)}>Schlaf</Ueberschrift>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontFamily: SCHRIFT.display, fontSize: TYP.zahl, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.dauer !== undefined ? C.ink : C.inkLeise }}>{s.dauer !== undefined ? hm(s.dauer) : '—'}</span>
        <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{s.bedarf !== undefined ? `geschlafen · Bedarf ${hm(s.bedarf)}` : 'geschlafen'}</span>
      </div>
      {s.dauer !== undefined && s.bedarf !== undefined && s.bedarf > 0 && (
        <>
          <Fortschritt anteil={s.dauer / s.bedarf} farbe={LEUCHT.schlaf} />
          <div style={{ fontSize: TYP.bedien, color: C.inkLeise, marginTop: 4 }}>{fehlt !== undefined && fehlt > 0.05 ? `${hm(fehlt)} unter dem Bedarf` : 'Bedarf gedeckt'}</div>
        </>
      )}
      {p && s.phasen && (
        <div style={{ marginTop: 14 }}>
          <div role="img" aria-label={`Schlafphasen: ${PHASE.map(x => `${x.label} ${hm(s.phasen![x.id])}`).join(', ')}`}
            style={{ display: 'flex', height: 12, borderRadius: ECKE.eingabe, overflow: 'hidden', border: `1px solid ${RAND.flaeche}` }}>
            {PHASE.map(x => <span key={x.id} style={{ width: `${p[x.id] * 100}%`, background: x.farbe }} />)}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: TYP.bedien, color: C.inkDim }}>
            {PHASE.map(x => (
              <span key={x.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: x.farbe }} />{x.label} <b style={{ color: C.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{hm(s.phasen![x.id])}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 12, marginTop: 16 }}>
        <Wert label="Leistung" wert={s.leistung !== undefined ? `${zahl(s.leistung, 0)} %` : undefined} />
        <Wert label="Konsistenz" wert={s.konsistenz !== undefined ? `${zahl(s.konsistenz, 0)} %` : undefined} />
        <Wert label="Effizienz" wert={s.effizienz !== undefined ? `${zahl(s.effizienz, 0)} %` : undefined} />
        <Wert label="Störungen" wert={s.stoerungen !== undefined ? zahl(s.stoerungen, 0) : undefined} />
      </div>
    </Karte>
  );
}

const LAGE_FARBE = { gut: LEUCHT.gut, achtung: LEUCHT.achtung, neutral: C.inkDim } as const;

function KoerperZeile({ w }: { w: KoerperWert }) {
  const stellen = w.id === 'hrv' || w.id === 'rhr' ? 0 : 1;
  const haupt = w.nurAbweichung
    ? (w.diff !== undefined ? `${vorz(w.diff, 1)} ${w.einheit}` : undefined)
    : (w.wert !== undefined ? `${zahl(w.wert, stellen)} ${w.einheit}` : undefined);
  const unter = w.nurAbweichung
    ? (w.diff !== undefined ? 'gegen Ø 7 Tage' : w.wert !== undefined ? 'Bezug ab 3 Tagen' : undefined)
    : w.diff !== undefined && w.bezug !== undefined ? `${vorz(w.diff, stellen)} gegen Ø ${zahl(w.bezug, stellen)}` : w.wert !== undefined ? 'Bezug ab 3 Tagen' : undefined;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${RAND.haar}`, minHeight: 44 }}>
      <span style={{ fontSize: TYP.body, color: C.ink }}>{w.label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: TYP.body, fontVariantNumeric: 'tabular-nums', color: haupt ? C.ink : C.inkLeise }}>{haupt ?? '—'}</span>
        {unter && <span style={{ display: 'block', fontSize: TYP.bedien, color: LAGE_FARBE[w.lage] }}>{unter}</span>}
      </span>
    </div>
  );
}

export function KoerperwerteKarte({ k, heute, i = 0 }: { k: Koerperwerte; heute: string; i?: number }) {
  return (
    <Karte i={i}>
      <Ueberschrift farbe={LEUCHT.puls} rechts={tagText(k.tag, heute)}>Körperwerte</Ueberschrift>
      <div>{k.koerper.map(w => <KoerperZeile key={w.id} w={w} />)}</div>
      {(k.kcal !== undefined || k.schritte !== undefined) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
          <Wert label="Energie des Tages" wert={k.kcal !== undefined ? `${zahl(k.kcal, 0)} kcal` : undefined} />
          <Wert label="Schritte" wert={k.schritte !== undefined ? zahl(k.schritte, 0) : undefined} />
        </div>
      )}
      <p style={{ fontSize: TYP.bedien, color: C.inkLeise, margin: '12px 0 0', lineHeight: 1.5 }}>Abweichung vom eigenen Ø der 7 Tage davor — Tracking, keine ärztliche Beratung.</p>
    </Karte>
  );
}
