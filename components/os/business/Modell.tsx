'use client';

// ─── Geschäftsmodell — woraus das Geld kommt (25.09.) ───────────────────────
// Umsatz je Produktlinie und Produkt (wiederkehrend + einmalig), die Mandate
// mit ihrem Anteil und wie weit jedes die Fixkosten trägt. Jede Zeile führt
// zum Produkt bzw. Mandat.

import Link from 'next/link';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Fortschritt, LEUCHT } from '../schlank';
import type { Geschaeftsmodell, ModellZeile } from '@/lib/business/modell';
import { WEG } from '@/lib/wege';

const euro = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
const pz = (n: number) => `${Math.round(n * 100)} %`;
const LINIEN_FARBE = [LEUCHT.business, LEUCHT.schlaf, LEUCHT.geld, LEUCHT.puls, LEUCHT.gut];

function Zeile({ z, farbe, eingerueckt, rechts }: { z: ModellZeile; farbe: string; eingerueckt?: boolean; rechts?: string }) {
  return (
    <Link href={z.href} className="fassbar" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(60px, 1fr) auto', gap: 12, alignItems: 'center', padding: eingerueckt ? '5px 8px 5px 22px' : '7px 8px', borderRadius: 10, textDecoration: 'none', color: C.ink }}>
      <span style={{ minWidth: 0, display: 'grid' }}>
        <span style={{ fontSize: eingerueckt ? 12.5 : TYP.bedien, fontWeight: eingerueckt ? 500 : 700, color: eingerueckt ? C.inkDim : C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.titel}</span>
        {z.unter && <span style={{ fontSize: 11.5, color: C.inkLeise, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.unter}</span>}
      </span>
      <Fortschritt anteil={Math.min(1, z.anteil)} farbe={farbe} />
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: eingerueckt ? 12.5 : TYP.bedien, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap', color: eingerueckt ? C.inkDim : C.ink }}>
        {rechts ?? `${z.mrr ? `${euro(z.mrr)}/M` : ''}${z.mrr && z.einmalig ? ' · ' : ''}${z.einmalig ? `${euro(z.einmalig)} einm.` : ''}`} <span style={{ color: C.inkLeise, fontWeight: 600 }}>{pz(z.anteil)}</span>
      </span>
    </Link>
  );
}

export function ModellKarte({ m, i = 4 }: { m: Geschaeftsmodell; i?: number }) {
  const leer = !m.linien.length;
  return (
    <Karte i={i} id="modell" style={{ scrollMarginTop: 90 }}>
      <Ueberschrift farbe={LEUCHT.business} rechts={<Link href={WEG.produkt()} style={{ color: C.inkLeise, textDecoration: 'none' }}>Produkte ›</Link>}>Geschäftsmodell</Ueberschrift>
      {leer ? (
        <div style={{ fontSize: TYP.bedien, color: C.inkDim }}>Keine laufenden Mandate mit Honorar in dieser Sicht. <Link href={WEG.mandat()} style={{ color: LEUCHT.puls, textDecoration: 'none', fontWeight: 600 }}>Mandate pflegen ›</Link></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {[
              { w: euro(m.mrr), l: 'wiederkehrend je Monat', f: C.ink },
              { w: euro(m.einmalig), l: 'einmalig (laufende Mandate)', f: C.inkDim },
              ...(m.fixDeckung != null ? [{ w: pz(m.fixDeckung), l: `der Fixkosten (${euro(m.fixkosten ?? 0)}/Monat) trägt der MRR`, f: m.fixDeckung >= 1 ? LEUCHT.gut : m.fixDeckung >= 0.7 ? LEUCHT.achtung : LEUCHT.kritisch }] : []),
            ].map(x => (
              <div key={x.l} style={{ display: 'grid', gap: 2 }}>
                <span style={{ fontFamily: SCHRIFT.display, fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: x.f, fontVariantNumeric: 'tabular-nums' }}>{x.w}</span>
                <span style={{ fontSize: 12, color: C.inkLeise }}>{x.l}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Je Produktlinie und Produkt</span>
            {m.linien.map((l, i) => (
              <div key={l.id} style={{ display: 'grid' }}>
                <Zeile z={l} farbe={LINIEN_FARBE[i % LINIEN_FARBE.length]} />
                {l.produkte.length > 1 || l.produkte[0]?.titel !== l.titel ? l.produkte.map(p => <Zeile key={p.id} z={p} farbe={`${LINIEN_FARBE[i % LINIEN_FARBE.length]}99`} eingerueckt />) : null}
              </div>
            ))}
            {m.ohneProdukt > 0 && <div style={{ fontSize: 12, color: LEUCHT.achtung, padding: '4px 8px' }}>{m.ohneProdukt} Mandat{m.ohneProdukt === 1 ? '' : 'e'} ohne Produkt — im Mandat ein Produkt wählen, dann stimmt die Aufteilung.</div>}
          </div>
          {m.mandate.length > 0 && (
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: C.inkLeise, letterSpacing: '.08em', textTransform: 'uppercase' }}>Je Mandat · Anteil und Fixkosten-Deckung</span>
              {m.mandate.slice(0, 8).map(z => (
                <Zeile key={z.id} z={z} farbe={LEUCHT.geld} rechts={`${euro(z.mrr)}/M${z.fixDeckung != null ? ` · trägt ${pz(z.fixDeckung)} Fix` : ''}`} />
              ))}
            </div>
          )}
          <div style={{ fontSize: 12, color: C.inkLeise, lineHeight: 1.5 }}>
            Anteil = Monatshonorar (einmalige Honorare ÷ 12) am Gesamt. „Trägt x % Fix“ = Monatshonorar ÷ Fixkosten der Sicht. Ein echter Deckungsbeitrag je Mandat braucht die direkten Kosten (Freelancer, Reisen) — die kommen über den Monatsabschluss.
          </div>
        </div>
      )}
    </Karte>
  );
}
