'use client';

// ─── MAKE OS — Finanz-Grundlage ─────────────────────────────────────────────
// Kevins Ansage: „Malins Dashboard als Finanzgrundlage nehmen — das sind die
// einzigen Zahlen, die du wirklich hast. Darauf möchte ich aufbauen."
//
// Diese Seite ist genau das: das gepflegte Kassenbuch, aufgeschlagen. Jede
// Zahl hier stammt aus Malins Export, keine ist geschätzt. Wo etwas fehlt oder
// nicht eindeutig ist, steht das als Lücke da — statt weggerechnet zu werden.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { THEME as T } from '@/lib/make-one/os-data';
import type { Grundlage, Kennzahlen, MonatsZeile, Position } from '@/lib/make-one/grundlage';
import { MONAT_KURZ } from '@/lib/make-one/grundlage';
import { Seitenkopf } from './Seitenkopf';

const panel = { background: 'linear-gradient(165deg, #1A2024 0%, #12171A 100%)', border: 'none', borderRadius: 20, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px rgba(0,0,0,.35)' };
const lbl = { fontFamily: T.mono, fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' as const, color: T.muted };

/** Cent-genau — hier wird ein Kassenbuch gelesen, nicht überschlagen. */
const eurC = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

interface Antwort {
  vorhanden: boolean; stand?: string; geladen?: string; hinweis?: string;
  grundlage?: Grundlage; kennzahlen?: Kennzahlen; monate?: MonatsZeile[];
  kategorien?: { kategorie: string; netto: number; anzahl: number }[];
}

function Zahl({ titel, wert, farbe, sub }: { titel: string; wert: string; farbe?: string; sub?: string }) {
  return (
    <div style={{ ...panel, padding: '14px 17px', flex: 1, minWidth: 158 }}>
      <div style={lbl}>{titel}</div>
      <div style={{ fontSize: 21, fontWeight: 700, color: farbe ?? T.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{wert}</div>
      {sub && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Balken({ anteil, farbe }: { anteil: number; farbe: string }) {
  return (
    <div style={{ flex: 1, height: 8, background: T.void, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(1, Math.round(anteil * 100))}%`, height: '100%', background: farbe, opacity: 0.8, borderRadius: 4 }} />
    </div>
  );
}

function Abschnitt({ titel, zusatz, children }: { titel: string; zusatz?: string; children: React.ReactNode }) {
  return (
    <div style={{ ...panel, padding: '15px 19px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={lbl}>{titel}</span>
        {zusatz && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.inkDim }}>{zusatz}</span>}
      </div>
      {children}
    </div>
  );
}

/** Zeile eines Kassenbuch-Postens. Als Funktion, nicht als Komponente — sonst
 *  baut React sie bei jedem Tastendruck neu auf. */
function posten(p: Position, farbe: string, vorzeichen: string) {
  return (
    <div key={p.id} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${T.lineSoft}` }}>
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 56, flex: '0 0 auto' }}>
        {p.datum ? `${p.datum.slice(8)}.${p.datum.slice(5, 7)}.` : '—'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.wer}</div>
        {p.zweck && p.zweck !== p.wer && <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.zweck}</div>}
      </div>
      {p.wie === 'erkannt' && (
        <span title="Ohne Typ im Dashboard — anhand der Belegnummer und der sauber herausgerechneten Umsatzsteuer als Umsatz gelesen."
          style={{ fontFamily: T.mono, fontSize: 11, color: T.amber, border: `1px solid ${T.amber}55`, borderRadius: 5, padding: '1px 6px', flex: '0 0 auto' }}>eingeordnet</span>
      )}
      <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: farbe, width: 96, textAlign: 'right', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>
        {vorzeichen}{eurC(p.brutto)}
      </span>
    </div>
  );
}

export function GrundlageView() {
  const [d, setD] = useState<Antwort | null>(null);
  const [alleKosten, setAlleKosten] = useState(false);

  useEffect(() => { fetch('/api/state/grundlage').then(r => r.json()).then(setD).catch(() => setD({ vorhanden: false })); }, []);

  if (!d) return <Rahmen><div style={{ color: T.muted, fontSize: 13, padding: '30px 0' }}>lädt …</div></Rahmen>;

  if (!d.vorhanden || !d.grundlage || !d.kennzahlen) {
    return (
      <Rahmen>
        <div style={{ ...panel, padding: '20px 22px', color: T.inkDim, fontSize: 13, lineHeight: 1.6 }}>
          {d.hinweis ?? 'Noch keine Grundlage geladen.'}
          <div style={{ marginTop: 10, fontFamily: T.mono, fontSize: 11, color: T.muted }}>
            Im Finanz-Dashboard exportieren, dann als PUT an /api/state/grundlage — danach rechnet das System damit.
          </div>
        </div>
      </Rahmen>
    );
  }

  const g = d.grundlage, k = d.kennzahlen;
  const monate = d.monate ?? [];
  const kats = d.kategorien ?? [];
  const maxMonat = Math.max(...monate.map(m => Math.max(m.umsatzNetto, m.kostenNetto)), 1);
  const maxKat = Math.max(...kats.map(x => x.netto), 1);

  const luecken = [
    g.konfiguration.kvPvKevinMonat === 0 ? 'Kevins KV + PV als Selbstständiger steht auf 0 €/Monat — jede Liquiditätsrechnung ist damit zu optimistisch.' : '',
    g.konfiguration.malinBruttoMonat === 0 ? 'Malins Bruttogehalt steht auf 0 €/Monat — die Anstellung ist im Dashboard noch nicht hinterlegt.' : '',
    g.konfiguration.fixkostenBetriebMonat === 0 && g.fixkosten.length <= 1 ? 'Sonstige Betriebs-Fixkosten stehen auf 0 € — außer dem Office Club ist nichts erfasst.' : '',
    g.offen.length ? `${g.offen.length} Position${g.offen.length === 1 ? '' : 'en'} ohne Typ — unten aufgeführt, muss zugeordnet werden.` : '',
  ].filter(Boolean);

  return (
    <Rahmen>
      <div style={{ ...panel, borderLeft: `3px solid ${T.accent}`, padding: '13px 18px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55 }}>
          Alle Zahlen auf dieser Seite stammen aus <strong>Malins Finanz-Dashboard</strong> — Stand{' '}
          <strong>{d.stand ? `${d.stand.slice(8)}.${d.stand.slice(5, 7)}.${d.stand.slice(0, 4)}` : '—'}</strong>.
          Gepflegt wird dort, gerechnet wird hier. MAKE OS erfindet nichts dazu.
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 5 }}>
          {g.umsatz.length + g.kosten.length + g.entnahmen.length + g.offen.length} Positionen Betrieb · {g.privat.length} Buchungen Privatkonto · {g.schulden.length} Verbindlichkeiten
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Zahl titel="Umsatz netto" wert={eurC(k.umsatzNetto)} farbe={T.accent} sub={`${eurC(k.umsatzBrutto)} brutto · ${g.umsatz.length} Rechnungen`} />
        <Zahl titel="Kosten netto" wert={eurC(k.kostenNetto)} farbe={T.amber} sub={`${g.kosten.length} Belege`} />
        <Zahl titel="Ergebnis netto" wert={eurC(k.ergebnisNetto)} farbe={k.ergebnisNetto >= 0 ? T.accent : T.crit} sub={`${k.monate} Monate: ${MONAT_KURZ(k.vonMonat)}–${MONAT_KURZ(k.bisMonat)}`} />
        <Zahl titel="Ø Umsatz / Monat" wert={eurC(k.umsatzProMonat)} sub="netto, ab dem ersten Beleg" />
        <Zahl titel="Entnahmen" wert={eurC(k.entnahmen)} farbe={T.inkDim} sub="privat ausgezahlt" />
      </div>

      {!!luecken.length && (
        <div style={{ ...panel, borderLeft: `3px solid ${T.amber}`, padding: '13px 18px', marginBottom: 12 }}>
          <div style={{ ...lbl, marginBottom: 7 }}>Lücken in der Grundlage</div>
          {luecken.map((l, i) => (
            <div key={i} style={{ fontSize: 12.5, color: T.inkDim, lineHeight: 1.55, padding: '2px 0' }}>◇ {l}</div>
          ))}
        </div>
      )}

      <Abschnitt titel="Monat für Monat" zusatz="netto">
        {monate.map(m => (
          <div key={m.monat} style={{ padding: '7px 0', borderTop: `1px solid ${T.lineSoft}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.inkDim, width: 62, flex: '0 0 auto' }}>{MONAT_KURZ(m.monat)} {m.monat.slice(2, 4)}</span>
              <Balken anteil={m.umsatzNetto / maxMonat} farbe={T.accent} />
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.accent, width: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eurC(m.umsatzNetto)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 3 }}>
              <span style={{ width: 62, flex: '0 0 auto' }} />
              <Balken anteil={m.kostenNetto / maxMonat} farbe={T.amber} />
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.amber, width: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>−{eurC(m.kostenNetto)}</span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginLeft: 73, marginTop: 3 }}>
              Ergebnis {eurC(m.ergebnis)} · Entnahme {eurC(m.entnahmen)}
            </div>
          </div>
        ))}
      </Abschnitt>

      <Abschnitt titel="Umsatz" zusatz={`${g.umsatz.length} Positionen · ${eurC(k.umsatzBrutto)} brutto`}>
        {g.umsatz.map(p => posten(p, T.accent, '+'))}
      </Abschnitt>

      <Abschnitt titel="Kosten nach Kategorie" zusatz={`${eurC(k.kostenNetto)} netto`}>
        {kats.map((x, xi) => (
          <div key={`${x.kategorie}-${xi}`} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 0' }}>
            <span style={{ fontSize: 12.5, color: T.inkDim, width: 168, flex: '0 0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.kategorie}</span>
            <Balken anteil={x.netto / maxKat} farbe={T.amber} />
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.inkDim, width: 92, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{eurC(x.netto)}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 26, textAlign: 'right' }}>{x.anzahl}</span>
          </div>
        ))}
        <button onClick={() => setAlleKosten(v => !v)}
          style={{ marginTop: 9, fontFamily: T.mono, fontSize: 11, color: T.muted, background: 'transparent', border: `1px solid ${T.line}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer' }}>
          {alleKosten ? 'Belege einklappen' : `alle ${g.kosten.length} Belege zeigen`}
        </button>
        {alleKosten && <div style={{ marginTop: 8 }}>{g.kosten.map(p => posten(p, T.amber, '−'))}</div>}
      </Abschnitt>

      <Abschnitt titel="Entnahmen" zusatz={`${eurC(k.entnahmen)} · ${g.entnahmen.length} Auszahlungen`}>
        {g.entnahmen.map(p => posten(p, T.inkDim, '−'))}
      </Abschnitt>

      <Abschnitt titel="Verbindlichkeiten" zusatz={`${eurC(k.schuldenRest)} offen · ${eurC(k.schuldenRateMonat)} Rate/Monat`}>
        {g.schulden.map(s => (
          <div key={s.id} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 12.5, color: T.ink, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: s.rate ? T.accentInk : T.muted, width: 104, textAlign: 'right', flex: '0 0 auto' }}>
              {s.rate ? `${eurC(s.rate)}/Mon.` : 'keine Rate'}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600, color: T.crit, width: 96, textAlign: 'right', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{eurC(s.rest)}</span>
          </div>
        ))}
      </Abschnitt>

      <Abschnitt titel="Laufende Fixkosten" zusatz={`${eurC(k.fixkostenMonatBrutto)} pro Monat brutto`}>
        {g.fixkosten.map(f => (
          <div key={f.id} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 12.5, color: T.ink, flex: 1 }}>{f.name}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, flex: '0 0 auto' }}>{f.kategorie}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.amber, width: 96, textAlign: 'right', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{eurC(f.brutto)}</span>
          </div>
        ))}
        {!g.fixkosten.length && <div style={{ fontSize: 12.5, color: T.muted }}>Keine laufenden Fixkosten im Dashboard erfasst.</div>}
      </Abschnitt>

      {!!g.ugRechnungen.length && (
        <Abschnitt titel="KD Management UG — Eingangsrechnungen" zusatz={`${g.ugRechnungen.length} Belege`}>
          {g.ugRechnungen.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '5px 0', borderTop: `1px solid ${T.lineSoft}` }}>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, width: 56, flex: '0 0 auto' }}>{r.datum ? `${r.datum.slice(8)}.${r.datum.slice(5, 7)}.` : '—'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink }}>{r.lieferant}</div>
                <div style={{ fontSize: 11, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.zweck}</div>
              </div>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: r.status === 'bezahlt' ? T.accent : T.amber, border: `1px solid ${r.status === 'bezahlt' ? T.accent : T.amber}44`, borderRadius: 5, padding: '1px 7px', flex: '0 0 auto' }}>{r.status}</span>
              <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.inkDim, width: 92, textAlign: 'right', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{eurC(r.brutto)}</span>
            </div>
          ))}
        </Abschnitt>
      )}

      {!!g.offen.length && (
        <Abschnitt titel="Ohne Typ — bitte einordnen" zusatz="im Dashboard nachtragen">
          {g.offen.map(p => posten(p, T.muted, ''))}
        </Abschnitt>
      )}

      <Abschnitt titel="Konfiguration aus dem Dashboard">
        {[
          ['Malins Bruttogehalt', `${eurC(g.konfiguration.malinBruttoMonat)} / Monat`],
          ['AG-Sozialabgaben darauf', `${g.konfiguration.agSatzProzent} %`],
          ['Sonstige Fixkosten Betrieb', `${eurC(g.konfiguration.fixkostenBetriebMonat)} / Monat`],
          ['Kevins KV + PV (selbstständig)', `${eurC(g.konfiguration.kvPvKevinMonat)} / Monat`],
          ['Gewerbesteuer-Hebesatz Berlin', `${g.konfiguration.gewerbesteuerHebesatz} %`],
        ].map(([a, b]) => (
          <div key={a} style={{ display: 'flex', gap: 11, alignItems: 'baseline', padding: '4px 0', borderTop: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 12.5, color: T.inkDim, flex: 1 }}>{a}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: b.startsWith('0,00') ? T.amber : T.ink }}>{b}</span>
          </div>
        ))}
      </Abschnitt>

      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 14, lineHeight: 1.6 }}>
        Neuer Stand aus dem Dashboard? Export dort ziehen und an <span style={{ color: T.inkDim }}>/api/state/grundlage</span> schicken —
        die Ableitung rechnet sich neu, das Original bleibt unverändert liegen.
      </div>
    </Rahmen>
  );
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: T.void, color: T.ink, fontFamily: T.sans }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '30px clamp(18px,4vw,48px) 72px' }}>
        <Link href="/os/finanzen" style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textDecoration: 'none', display: 'inline-block', marginBottom: 8 }}>‹ Finanzen</Link>
        <Seitenkopf
          rubrik={<>Finanzen</>}
          titel={<>Grundlage</>}
        />
        {children}
      </div>
    </div>
  );
}
