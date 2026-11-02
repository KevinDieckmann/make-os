'use client';

// ─── Angebots-Tool · das Angebot als Blatt (28.09.; seit 08.10. auch Rechnungen, `d.art`) ─
// HTML-Vorschau im Layout des PDFs — beide bauen auf lib/crm/angebot-dokument.ts auf.
// Ein weißes A4-Blatt (Papier), damit man sieht, was der Kunde bekommt. Die IBAN
// steht hier maskiert; im PDF (Server) steht sie voll.
//
// Gestaltung (02.11., wie lib/crm/angebot-pdf.ts): Band oben in der Akzentfarbe der Gesellschaft (ohne: Tinte), links die
// Hauptspalte (Rücksendezeile, Anschrift, „Rechnung Nr. …“ + Unterzeile, Positionen auf hellen Flächen, großer Endbetrag),
// rechts eine schmale Spalte mit Logo bzw. Wortmarke, den Angaben (gesperrte Großbuchstaben + fetter Wert) und unten der
// Absender-Leiste (Rückfall: die `fuss`-Zeilen alter Schnappschüsse). Schmal (Handy) rutscht die rechte Spalte jeweils darunter.

import type { CSSProperties, ReactNode } from 'react';
import type { AngebotDokument } from '@/lib/crm/angebot-dokument';
import { TYP } from '@/lib/make-one/design';

// Papier/Tinte-Satz des PDFs — ein Dokument, darum hell.
const PAPIER = '#FFFFFF';
const TINTE = '#0B0E10';
const DIM = '#4F5A5D';
const LEISE = '#6A7376';
const FLAECHE = '#F2F0EA';
const HAAR = '#D9D6CD';
const ENTWURF = '#C0561A';

const SPALTE_HAUPT: CSSProperties = { flex: '1 1 340px', minWidth: 0 };
const SPALTE_RECHTS: CSSProperties = { flex: '0 1 170px', minWidth: 0 };
const LABEL: CSSProperties = { fontSize: TYP.mikro, letterSpacing: '.12em', textTransform: 'uppercase', color: LEISE, whiteSpace: 'nowrap' };

/** Eine Zeile aus Haupt- und rechter Spalte; schmal bricht die rechte Spalte darunter um. */
function Reihe({ haupt, rechts, unten, abstand = 0 }: { haupt: ReactNode; rechts?: ReactNode; unten?: boolean; abstand?: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px', marginTop: abstand, alignItems: unten ? 'flex-end' : 'flex-start' }}>
      <div style={SPALTE_HAUPT}>{haupt}</div>
      <div style={SPALTE_RECHTS}>{rechts}</div>
    </div>
  );
}

/** Beschriftung + fetter Wert; passt beides nicht nebeneinander, steht der Wert darunter. */
function Angabe({ label, wert, leise }: { label: string; wert: string; leise?: boolean }) {
  if (!label) return <div style={{ fontSize: 12, fontWeight: leise ? 400 : 700, color: leise ? DIM : TINTE }}>{wert}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 6, alignItems: 'baseline' }}>
      <span style={LABEL}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: TINTE }}>{wert}</span>
    </div>
  );
}

export function Blatt({ d, logoUrl }: { d: AngebotDokument; logoUrl?: string | null }) {
  const rechts = { textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
  // Spalte „Art.-Nr.“ (25.10.) wie im PDF: nur, wenn mindestens eine Position eine Artikelnummer trägt.
  const mitArtNr = d.positionen.some(p => !!p.artikelnummer);
  const akzent = d.absender.akzent && /^#[0-9a-f]{6}$/i.test(d.absender.akzent) ? d.absender.akzent : TINTE;
  const mitLeiste = !!d.absender.leiste?.length;
  const gruppen = mitLeiste ? d.absender.leiste! : [d.absender.fuss.map(w => ({ label: '', wert: w }))];
  const letzteStark = d.summen.map(z => !!z.stark).lastIndexOf(true);
  const zelle: CSSProperties = { padding: '8px 6px', background: FLAECHE };
  const kopf: CSSProperties = { padding: '4px 6px', fontWeight: 700, whiteSpace: 'nowrap' };
  const ecken = (erste: boolean, letzte: boolean): CSSProperties => ({
    ...(erste ? { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, paddingLeft: 10 } : {}),
    ...(letzte ? { borderTopRightRadius: 3, borderBottomRightRadius: 3, paddingRight: 10 } : {}),
  });
  return (
    <div role="document" aria-label={`${d.art ?? 'Angebot'} ${d.nummer}`} style={{ background: PAPIER, color: TINTE, borderRadius: 6, boxShadow: '0 12px 40px -12px rgba(0,0,0,.6)', padding: 'clamp(18px, 4vw, 44px)', paddingTop: 'calc(clamp(18px, 4vw, 44px) + 6px)', fontFamily: 'Helvetica, Arial, sans-serif', fontSize: TYP.bedien, lineHeight: 1.45, width: '100%', maxWidth: 820, minWidth: 0, boxSizing: 'border-box', margin: '0 auto', position: 'relative', overflow: 'hidden', overflowWrap: 'anywhere' }}>
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: akzent }} />

      {/* Rücksendezeile + Anschrift | Logo bzw. Wortmarke */}
      <Reihe
        haupt={<div style={{ paddingTop: 34 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DIM, marginBottom: 10 }}>{d.absenderZeile.split(' · ').join('  ·  ')}</div>
          {d.empfaenger.map((z, i) => <div key={i} style={{ fontSize: 13 }}>{z}</div>)}
        </div>}
        rechts={logoUrl
          // eslint-disable-next-line @next/next/no-img-element -- Logo aus der Ablage (Anhang), kein next/image-Pfad
          ? <img src={logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: 60, objectFit: 'contain', display: 'block' }} />
          : <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.15 }}>{d.absender.firmierung}</div>}
      />

      {/* Überschrift + Unterzeile | Angaben, bündig mit der Überschrift */}
      <Reihe abstand={34}
        haupt={<div>
          <h2 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, margin: 0 }}>{d.ueberschrift ?? `Angebot: ${d.titel}`}</h2>
          {d.unterzeile?.trim() && <div style={{ fontSize: 14, color: DIM, marginTop: 6 }}>{d.unterzeile}</div>}
          {d.entwurf && <div style={{ ...LABEL, color: ENTWURF, fontWeight: 700, marginTop: 6 }}>ENTWURF — NOCH NICHT GESTELLT</div>}
        </div>}
        rechts={<div style={{ display: 'grid', gap: 4, paddingTop: 2 }}>
          {d.meta.filter(m => m.wert).map(m => <Angabe key={m.label} label={m.label} wert={m.wert} />)}
        </div>}
      />

      <Reihe abstand={26} unten
        haupt={<div>
          {d.einleitung && <div style={{ whiteSpace: 'pre-wrap', marginBottom: 18 }}>{d.einleitung}</div>}

          {/* Schmal (375 px): die Tabelle behält ihre 520 px und scrollt in sich — das Blatt selbst bleibt so breit wie der Bildschirm
              (Blatt `width: 100%` + `minWidth: 0`, die umgebenden Raster `minmax(0, 1fr)`; Sichtprüfung 29.09., F2). */}
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', minWidth: 520 }}>
              <thead>
                <tr style={{ fontSize: 12, textAlign: 'left' }}>
                  {/* 25.10. (Kern-Bau-Test 2): „Pos.“ brach in der Spalte um („Pos“ / „.“) — breit genug und ohne Umbruch. */}
                  <th style={{ ...kopf, paddingLeft: 10, width: 38, whiteSpace: 'nowrap' }}>Pos.</th>
                  {mitArtNr && <th style={{ ...kopf }}>Art.-Nr.</th>}
                  <th style={{ ...kopf }}>Beschreibung</th>
                  <th style={{ ...kopf, ...rechts }}>Menge</th>
                  <th style={{ ...kopf, ...rechts }}>Einzelpreis</th>
                  <th style={{ ...kopf, ...rechts, paddingRight: 10 }}>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {d.positionen.map(p => (
                  <tr key={p.nr} style={{ verticalAlign: 'top' }}>
                    <td style={{ ...zelle, ...ecken(true, false), color: DIM }}>{p.nr}.</td>
                    {mitArtNr && <td style={{ ...zelle, color: LEISE, fontSize: 12 }}>{p.artikelnummer ?? ''}</td>}
                    <td style={zelle}>
                      <div style={{ fontWeight: 700 }}>{p.titel}</div>
                      {(p.basis || p.rabatt) && <div style={{ fontSize: 12, color: DIM }}>{p.basis}{p.rabatt ? `${p.basis ? ' · ' : ''}Rabatt ${p.rabatt}` : ''}</div>}
                      {p.text && <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginTop: 3 }}>{p.text}</div>}
                    </td>
                    <td style={{ ...zelle, ...rechts }}>{p.menge}</td>
                    <td style={{ ...zelle, ...rechts }}>{p.einzelpreis}</td>
                    <td style={{ ...zelle, ...rechts, ...ecken(false, true) }}>{p.betrag}</td>
                  </tr>
                ))}
                {!d.positionen.length && <tr><td colSpan={mitArtNr ? 6 : 5} style={{ ...zelle, borderRadius: 3, color: LEISE, textAlign: 'center' }}>Noch keine Position.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Summen: netto ohne Fläche, Steuer auf Fläche, Endbetrag groß */}
          <div style={{ marginTop: 6, display: 'grid', gap: 2 }}>
            {d.summen.map((z, i) => i === letzteStark ? (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 10px 4px' }}>
                <span style={{ fontWeight: 700 }}>{z.label}</span>
                <span style={{ fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>{z.wert}</span>
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 10px', borderRadius: 3, background: z.leise ? FLAECHE : 'transparent', color: z.leise ? DIM : TINTE, fontWeight: z.stark ? 700 : 400 }}>
                <span>{z.label}</span><span style={{ whiteSpace: 'nowrap' }}>{z.wert}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: 'grid', gap: 4 }}>{d.hinweise.map((h, i) => <div key={i}>{h}</div>)}</div>
          {d.schluss && <div style={{ whiteSpace: 'pre-wrap', marginTop: 18 }}>{d.schluss}</div>}
          {/* Annahmeblock (25.10.) wie im PDF: Ort/Datum und Unterschrift des Kunden. */}
          {d.annahme && (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontWeight: 700, marginBottom: 34 }}>Angebot angenommen</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, fontSize: 12, color: LEISE }}>
                <div style={{ borderTop: `1px solid ${TINTE}`, paddingTop: 4 }}>Ort, Datum</div>
                <div style={{ borderTop: `1px solid ${TINTE}`, paddingTop: 4 }}>Unterschrift und Name (Kunde)</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 30, paddingTop: 8, borderTop: `1px solid ${HAAR}`, fontSize: 12, color: LEISE, display: 'grid', gap: 2 }}>
            {d.agb && <div>Es gelten unsere Allgemeinen Geschäftsbedingungen: <a href={d.agb} target="_blank" rel="noopener noreferrer" style={{ color: LEISE }}>{d.agb}</a></div>}
            <div style={{ letterSpacing: '.04em' }}>{d.art ?? 'Angebot'} {d.nummer}</div>
          </div>
        </div>}
        rechts={<div style={{ display: 'grid', gap: 10 }}>
          {gruppen.map((gr, gi) => (
            <div key={gi} style={{ display: 'grid', gap: 2 }}>
              {gr.map((r, ri) => <Angabe key={ri} label={r.label} wert={r.wert} leise={!mitLeiste} />)}
            </div>
          ))}
        </div>}
      />
    </div>
  );
}
