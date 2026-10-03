'use client';

// ─── Angebots-Tool · das Angebot als Blatt (28.09.) ─────────────────────────
// HTML-Vorschau im Layout des PDFs — beide bauen auf lib/crm/angebot-dokument.ts auf.
// Ein weißes A4-Blatt (Papier), damit man sieht, was der Kunde bekommt. Die IBAN
// steht hier maskiert; im PDF (Server) steht sie voll.

import type { AngebotDokument } from '@/lib/crm/angebot-dokument';
import { TYP } from '@/lib/make-one/design';

const PAPIER = '#FFFFFF';
const TINTE = '#1A1A1F';
const LEISE = '#6B6B75';
const LINIE = '#D2D2D8';
const AKZENT = '#21B5AA';

export function Blatt({ d, logoUrl }: { d: AngebotDokument; logoUrl?: string | null }) {
  const rechts = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  return (
    <div role="document" aria-label={`Angebot ${d.nummer}`} style={{ background: PAPIER, color: TINTE, borderRadius: 6, boxShadow: '0 12px 40px -12px rgba(0,0,0,.6)', padding: 'clamp(18px, 4vw, 44px)', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: TYP.bedien, lineHeight: 1.45, width: '100%', maxWidth: 820, minWidth: 0, boxSizing: 'border-box', margin: '0 auto', position: 'relative', overflowWrap: 'anywhere' }}>
      {d.entwurf && <div aria-hidden style={{ position: 'absolute', top: 14, right: 18, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', color: '#C0561A' }}>ENTWURF</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{d.absender.firmierung}</div>
          {[...d.absender.zeilen, ...d.absender.kontakt].map((z, i) => <div key={i} style={{ fontSize: 12, color: LEISE }}>{z}</div>)}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Logo aus der Ablage (Anhang), kein next/image-Pfad */}
        {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxWidth: 170, maxHeight: 60, objectFit: 'contain' }} />}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginTop: 30, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, color: LEISE, borderBottom: `1px solid ${LINIE}`, paddingBottom: 2, marginBottom: 8, display: 'inline-block' }}>{d.absenderZeile}</div>
          {d.empfaenger.map((z, i) => <div key={i} style={{ fontSize: 13 }}>{z}</div>)}
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: TYP.bedien }}>
          <tbody>{d.meta.map(m => <tr key={m.label}><td style={{ color: LEISE, paddingRight: 14 }}>{m.label}</td><td style={{ ...rechts, fontWeight: m.label === 'Angebot' ? 700 : 400 }}>{m.wert}</td></tr>)}</tbody>
        </table>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '28px 0 10px' }}>Angebot: {d.titel}</h2>
      {d.einleitung && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{d.einleitung}</div>}

      {/* Schmal (375 px): die Tabelle behält ihre 520 px und scrollt in sich — das Blatt selbst bleibt so breit wie der Bildschirm
          (Blatt `width: 100%` + `minWidth: 0`, die umgebenden Raster `minmax(0, 1fr)`; Sichtprüfung 29.09., F2). */}
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr style={{ color: LEISE, fontSize: 12, fontWeight: 700, textAlign: 'left' }}>
              <th style={{ padding: '6px 4px', borderBottom: `1px solid ${LINIE}`, width: 30 }}>Pos.</th>
              <th style={{ padding: '6px 4px', borderBottom: `1px solid ${LINIE}` }}>Leistung</th>
              <th style={{ padding: '6px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts }}>Menge</th>
              <th style={{ padding: '6px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts }}>Einzelpreis</th>
              <th style={{ padding: '6px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts }}>Betrag netto</th>
            </tr>
          </thead>
          <tbody>
            {d.positionen.map(p => (
              <tr key={p.nr} style={{ verticalAlign: 'top' }}>
                <td style={{ padding: '8px 4px', borderBottom: `1px solid ${LINIE}`, color: LEISE }}>{p.nr}</td>
                <td style={{ padding: '8px 4px', borderBottom: `1px solid ${LINIE}` }}>
                  <div style={{ fontWeight: 700 }}>{p.titel}</div>
                  <div style={{ fontSize: 12, color: AKZENT }}>{p.basis}{p.rabatt ? ` · Rabatt ${p.rabatt}` : ''}</div>
                  {p.text && <div style={{ fontSize: 12, color: LEISE, whiteSpace: 'pre-wrap', marginTop: 3 }}>{p.text}</div>}
                </td>
                <td style={{ padding: '8px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts }}>{p.menge}</td>
                <td style={{ padding: '8px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts }}>{p.einzelpreis}</td>
                <td style={{ padding: '8px 4px', borderBottom: `1px solid ${LINIE}`, ...rechts, fontWeight: 700 }}>{p.betrag}</td>
              </tr>
            ))}
            {!d.positionen.length && <tr><td colSpan={5} style={{ padding: 14, color: LEISE, textAlign: 'center' }}>Noch keine Position.</td></tr>}
          </tbody>
        </table>
      </div>

      <table style={{ marginLeft: 'auto', marginTop: 12, borderCollapse: 'collapse', fontSize: TYP.bedien }}>
        <tbody>{d.summen.map((z, i) => (
          <tr key={i} style={{ color: z.leise ? LEISE : TINTE, fontWeight: z.stark ? 700 : 400 }}>
            <td style={{ padding: '2px 16px 2px 0', textAlign: 'right' }}>{z.label}</td><td style={{ padding: '2px 4px', ...rechts }}>{z.wert}</td>
          </tr>
        ))}</tbody>
      </table>

      <div style={{ marginTop: 18, fontSize: 12, color: LEISE }}>{d.hinweise.map((h, i) => <div key={i}>{h}</div>)}</div>
      {d.schluss && <div style={{ whiteSpace: 'pre-wrap', marginTop: 18 }}>{d.schluss}</div>}

      <div style={{ marginTop: 30, paddingTop: 8, borderTop: `1px solid ${LINIE}`, fontSize: 12, color: LEISE, display: 'grid', gap: 2 }}>
        {d.absender.fuss.map((z, i) => <div key={i}>{z}</div>)}
      </div>
    </div>
  );
}
