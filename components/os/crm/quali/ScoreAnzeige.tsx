'use client';

// ─── Score, MQL und SQL auf einen Blick (03.10.) ──────────────────────────────────────────────
// Dieselben Zahlen überall: Runde, Leads-Liste, Kontaktakte, Seitenfenster — gerechnet im Kern (lib/crm/scoring.ts).
// „Score x · Temperatur“, daneben der Weg: Lead → MQL (Marketing-Punkte gegen Schwelle, nur für Marketing-Leads) → SQL (Sales-Punkte gegen Schwelle
// und die Muss-Kriterien). Wer es genau wissen will, klappt die Zusammensetzung auf.

import { useState } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Chip, LEUCHT } from '../../ui';
import { temperaturFarbe, temperaturLabel, type LeadScore } from '@/lib/crm/score';
import type { SeitenErgebnis } from '@/lib/crm/scoring';
import { punkteText } from './hilfen';
import { sqlFortschritt } from '@/lib/crm/leads';

/** Ein Teil des Wegs: „MQL · 22 von 20“ bzw. „SQL · 12 von 28 · fehlt: Schmerz“. */
export function SeitenChip({ s, name, kurz }: { s: SeitenErgebnis; name: 'MQL' | 'SQL'; kurz?: boolean }) {
  // Kein Marketing-Lead (03.10.): kein MQL-Balken — der Lead kommt von Event, Empfehlung oder Direktansprache und wird erst qualifiziert.
  if (name === 'MQL' && s.gilt === false) {
    return (
      <span title="Dieser Lead kommt nicht aus dem Marketing (Kampagne, Newsletter, Anfrage, Inhalte). Er geht direkt in die Qualifizierung — erst die Qualifizierungsfragen entscheiden, ob er SQL wird."
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, fontWeight: 700, color: C.inkDim, border: `1px solid ${C.inkDim}55`, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
        Lead · noch zu qualifizieren
      </span>
    );
  }
  const f = s.erreicht ? LEUCHT.gut : C.inkDim;
  const text = `${name} ${s.erreicht ? '✓' : ''} ${punkteText(s.punkte)}/${punkteText(s.schwelle)}`.replace('  ', ' ');
  return (
    <span title={`${name === 'MQL' ? 'Marketing' : 'Sales'}: ${punkteText(s.punkte)} Punkte, Schwelle ${punkteText(s.schwelle)} (möglich ${punkteText(s.max)})${s.fehlt.length ? ` — fehlt: ${s.fehlt.join(', ')}` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: TYP.bedien, fontWeight: 700, color: f, border: `1px solid ${f}55`, background: s.erreicht ? `${f}14` : 'transparent', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>
      {text}{!kurz && !s.erreicht && s.fehlt.length > 0 && <span style={{ fontWeight: 500, color: C.inkLeise }}>· fehlt: {s.fehlt.join(', ')}</span>}
    </span>
  );
}

/** Der Weg Lead → MQL → SQL als Zeile. */
export function StandKette({ score }: { score: LeadScore }) {
  const e = score.scoring;
  if (!e) return null;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <SeitenChip s={e.marketing} name="MQL" /><span aria-hidden style={{ color: C.inkLeise }}>→</span><SeitenChip s={e.sales} name="SQL" />
    </div>
  );
}

/** Score groß, Temperatur, darunter der Weg — und aufklappbar die Zusammensetzung mit Begründung je Teil. */
export function ScoreKopf({ score, kompakt }: { score: LeadScore; kompakt?: boolean }) {
  const [auf, setAuf] = useState(false);
  const f = temperaturFarbe(score.temperatur);
  const sql = sqlFortschritt(score);
  return (
    <div style={{ display: 'grid', gap: 8, padding: kompakt ? '10px 12px' : '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,.04)', border: `1px solid ${f}33` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span title="Lead-Score — die Temperatur kommt aus den Grenzen der Scoring-Einstellungen" style={{ fontFamily: SCHRIFT.display, fontSize: kompakt ? 26 : 30, fontWeight: 700, letterSpacing: '-.02em', color: f, fontVariantNumeric: 'tabular-nums' }}>{score.punkte}</span>
        <Chip farbe={f}>{temperaturLabel(score.temperatur)}</Chip>
        <button type="button" onClick={() => setAuf(!auf)} aria-expanded={auf} className="fassbar" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.aktiv, cursor: 'pointer', fontSize: TYP.bedien, padding: '10px 4px', minHeight: 44 }}>{auf ? 'Zusammensetzung ausblenden' : 'Zusammensetzung'}</button>
      </div>
      {/* 2.7 (09.10.): statt „von 100“ der Weg zum SQL — Sales-Punkte gegen die Schwelle der Einstellungen. */}
      {sql && (
        <div title={`Sales-Punkte ${punkteText(sql.punkte)} von ${punkteText(sql.schwelle)} (SQL-Schwelle)${sql.fehlt.length ? ` — fehlt: ${sql.fehlt.join(', ')}` : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkDim, marginBottom: 3 }}><span>Bis SQL</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{sql.erreicht ? 'erreicht ✓' : `${sql.prozent} %`}</span></div>
          <div role="progressbar" aria-label="Fortschritt bis SQL" aria-valuenow={sql.prozent} aria-valuemin={0} aria-valuemax={100} style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${sql.prozent}%`, height: '100%', background: sql.erreicht ? LEUCHT.gut : LEUCHT.business, transition: 'width .3s' }} /></div>
        </div>
      )}
      <StandKette score={score} />
      {auf && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {score.teile.map(t => (
            <div key={t.id} title={t.grund}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.inkDim, marginBottom: 3 }}><span>{t.label}{t.seite ? ` · ${t.seite === 'marketing' ? 'Marketing' : 'Sales'}` : ''}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{punkteText(t.punkte)}/{punkteText(t.max)}</span></div>
              <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}><div style={{ width: `${t.max ? (100 * t.punkte) / t.max : 0}%`, height: '100%', background: f, transition: 'width .3s' }} /></div>
              <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 3, lineHeight: 1.35 }}>{t.grund}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
