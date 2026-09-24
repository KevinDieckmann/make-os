'use client';

// ─── MAKE OS — Finanz-Grundlage ─────────────────────────────────────────────
// Kevins Ansage: „Malins Dashboard als Finanzgrundlage nehmen — das sind die
// einzigen Zahlen, die du wirklich hast. Darauf möchte ich aufbauen."
//
// Diese Seite ist genau das: das gepflegte Kassenbuch, aufgeschlagen. Jede
// Zahl hier stammt aus Malins Export, keine ist geschätzt. Wo etwas fehlt oder
// nicht eindeutig ist, steht das als Lücke da — statt weggerechnet zu werden.
// 24.09.: auf das lebendige Muster umgezogen (Karten, Leuchtfarben, Listen).

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP } from '@/lib/make-one/design';
import type { Grundlage, Kennzahlen, MonatsZeile, Position } from '@/lib/make-one/grundlage';
import { MONAT_KURZ } from '@/lib/make-one/grundlage';
import { Seite, Karte, Ueberschrift, Liste, Zeile, Leer, Chip, Knopf, Zahl, Fortschritt, LEUCHT } from './schlank';

/** Cent-genau — hier wird ein Kassenbuch gelesen, nicht überschlagen. */
const eurC = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const datum = (d?: string) => (d ? `${d.slice(8)}.${d.slice(5, 7)}.` : '—');

const geld: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', minWidth: 96 };
const tag: CSSProperties = { fontFamily: SCHRIFT.display, fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: C.inkDim, width: 48, flex: '0 0 auto' };
const leise: CSSProperties = { fontSize: 12, color: C.inkLeise, whiteSpace: 'nowrap' };

interface Antwort {
  vorhanden: boolean; stand?: string; geladen?: string; hinweis?: string;
  grundlage?: Grundlage; kennzahlen?: Kennzahlen; monate?: MonatsZeile[];
  kategorien?: { kategorie: string; netto: number; anzahl: number }[];
}

/** Zeile eines Kassenbuch-Postens. Als Funktion, nicht als Komponente — sonst
 *  baut React sie bei jedem Tastendruck neu auf. */
function posten(p: Position, farbe: string, vorzeichen: string) {
  return (
    <Zeile key={p.id}
      links={<span style={tag}>{datum(p.datum)}</span>}
      titel={p.wer}
      unter={p.zweck && p.zweck !== p.wer ? p.zweck : undefined}
      rechts={<>
        {p.wie === 'erkannt' && (
          <span title="Ohne Typ im Dashboard — anhand der Belegnummer und der sauber herausgerechneten Umsatzsteuer als Umsatz gelesen.">
            <Chip farbe={LEUCHT.achtung}>eingeordnet</Chip>
          </span>
        )}
        <span style={{ ...geld, color: farbe }}>{vorzeichen}{eurC(p.brutto)}</span>
      </>} />
  );
}

/** Beschriftung | Balken | Betrag — eine Zeile im Monatsbild und bei den Kategorien. */
function Anteil({ links, anteil, farbe, rechts, extra }: { links: ReactNode; anteil: number; farbe: string; rechts: string; extra?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `minmax(70px,150px) 1fr 96px${extra ? ' 28px' : ''}`, alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{links}</span>
      <Fortschritt anteil={anteil} farbe={farbe} />
      <span style={{ fontFamily: SCHRIFT.display, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', color: farbe, textAlign: 'right' }}>{rechts}</span>
      {extra}
    </div>
  );
}

export function GrundlageView() {
  const [d, setD] = useState<Antwort | null>(null);
  const [alleKosten, setAlleKosten] = useState(false);

  useEffect(() => { fetch('/api/state/grundlage').then(r => r.json()).then(setD).catch(() => setD({ vorhanden: false })); }, []);

  if (!d) return <Seite titel="Grundlage" unter="Malins Kassenbuch"><Karte i={0}><Leer>lädt …</Leer></Karte></Seite>;

  if (!d.vorhanden || !d.grundlage || !d.kennzahlen) {
    return (
      <Seite titel="Grundlage" unter="Malins Kassenbuch">
        <Karte i={0}>
          <Ueberschrift farbe={LEUCHT.achtung}>Noch keine Grundlage</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.6 }}>{d.hinweis ?? 'Noch keine Grundlage geladen.'}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: C.inkLeise, lineHeight: 1.6 }}>
            Im Finanz-Dashboard exportieren, dann als PUT an <span style={{ fontFamily: SCHRIFT.mono, color: C.inkDim }}>/api/state/grundlage</span> — danach rechnet das System damit.
          </div>
        </Karte>
      </Seite>
    );
  }

  const g = d.grundlage, k = d.kennzahlen;
  const monate = d.monate ?? [];
  const kats = d.kategorien ?? [];
  const maxMonat = Math.max(...monate.map(m => Math.max(m.umsatzNetto, m.kostenNetto)), 1);
  const maxKat = Math.max(...kats.map(x => x.netto), 1);
  const stand = d.stand ? `${d.stand.slice(8)}.${d.stand.slice(5, 7)}.${d.stand.slice(0, 4)}` : '—';

  const luecken = [
    g.konfiguration.kvPvKevinMonat === 0 ? 'Kevins KV + PV als Selbstständiger steht auf 0 €/Monat — jede Liquiditätsrechnung ist damit zu optimistisch.' : '',
    g.konfiguration.malinBruttoMonat === 0 ? 'Malins Bruttogehalt steht auf 0 €/Monat — die Anstellung ist im Dashboard noch nicht hinterlegt.' : '',
    g.konfiguration.fixkostenBetriebMonat === 0 && g.fixkosten.length <= 1 ? 'Sonstige Betriebs-Fixkosten stehen auf 0 € — außer dem Office Club ist nichts erfasst.' : '',
    g.offen.length ? `${g.offen.length} Position${g.offen.length === 1 ? '' : 'en'} ohne Typ — unten aufgeführt, muss zugeordnet werden.` : '',
  ].filter(Boolean);

  return (
    <Seite titel="Grundlage" unter={`Malins Kassenbuch · Stand ${stand}`}>
      <Karte i={0} akzent={LEUCHT.geld}>
        <Ueberschrift farbe={LEUCHT.geld}>Ergebnis netto</Ueberschrift>
        <Zahl gross wert={eurC(k.ergebnisNetto)} farbe={k.ergebnisNetto >= 0 ? LEUCHT.gut : LEUCHT.kritisch} label={`${k.monate} Monate: ${MONAT_KURZ(k.vonMonat)}–${MONAT_KURZ(k.bisMonat)}`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginTop: 14 }}>
          <Zahl wert={eurC(k.umsatzNetto)} farbe={LEUCHT.gut} label={`Umsatz netto · ${eurC(k.umsatzBrutto)} brutto · ${g.umsatz.length} Rechnungen`} />
          <Zahl wert={eurC(k.kostenNetto)} farbe={LEUCHT.achtung} label={`Kosten netto · ${g.kosten.length} Belege`} />
          <Zahl wert={eurC(k.umsatzProMonat)} label="Ø Umsatz / Monat · netto, ab dem ersten Beleg" />
          <Zahl wert={eurC(k.entnahmen)} farbe={C.inkDim} label="Entnahmen · privat ausgezahlt" />
        </div>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, marginTop: 16 }}>
          Alle Zahlen auf dieser Seite stammen aus <strong style={{ color: C.ink }}>Malins Finanz-Dashboard</strong> — Stand <strong style={{ color: C.ink }}>{stand}</strong>.
          Gepflegt wird dort, gerechnet wird hier. MAKE OS erfindet nichts dazu.
        </div>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 5 }}>
          {g.umsatz.length + g.kosten.length + g.entnahmen.length + g.offen.length} Positionen Betrieb · Privatkonto und private Schulden stehen seit 24.09. unter Zahlen → Privat
        </div>
      </Karte>

      {!!luecken.length && (
        <Karte i={1}>
          <Ueberschrift farbe={LEUCHT.achtung}>Lücken in der Grundlage</Ueberschrift>
          {luecken.map((l, i) => (
            <div key={i} style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.55, padding: '3px 0' }}>◇ {l}</div>
          ))}
        </Karte>
      )}

      <Karte i={2}>
        <Ueberschrift farbe={LEUCHT.puls} rechts="netto">Monat für Monat</Ueberschrift>
        <div style={{ display: 'grid', gap: 12 }}>
          {monate.map(m => (
            <div key={m.monat} style={{ display: 'grid', gap: 5, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.06)' }}>
              <Anteil links={`${MONAT_KURZ(m.monat)} ${m.monat.slice(2, 4)}`} anteil={m.umsatzNetto / maxMonat} farbe={LEUCHT.gut} rechts={eurC(m.umsatzNetto)} />
              <Anteil links="" anteil={m.kostenNetto / maxMonat} farbe={LEUCHT.achtung} rechts={`−${eurC(m.kostenNetto)}`} />
              <div style={{ fontSize: 12, color: C.inkLeise }}>Ergebnis {eurC(m.ergebnis)} · Entnahme {eurC(m.entnahmen)}</div>
            </div>
          ))}
        </div>
      </Karte>

      <Karte i={3}>
        <Ueberschrift farbe={LEUCHT.gut} rechts={`${g.umsatz.length} Positionen · ${eurC(k.umsatzBrutto)} brutto`}>Umsatz</Ueberschrift>
        <Liste>{g.umsatz.map(p => posten(p, LEUCHT.gut, '+'))}</Liste>
      </Karte>

      <Karte i={4}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={`${eurC(k.kostenNetto)} netto`}>Kosten nach Kategorie</Ueberschrift>
        <div style={{ display: 'grid', gap: 9 }}>
          {kats.map((x, xi) => (
            <Anteil key={`${x.kategorie}-${xi}`} links={x.kategorie} anteil={x.netto / maxKat} farbe={LEUCHT.achtung} rechts={eurC(x.netto)}
              extra={<span style={{ ...leise, textAlign: 'right' }}>{x.anzahl}</span>} />
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <Knopf leise onClick={() => setAlleKosten(v => !v)}>{alleKosten ? 'Belege einklappen' : `alle ${g.kosten.length} Belege zeigen`}</Knopf>
        </div>
        {alleKosten && <Liste>{g.kosten.map(p => posten(p, LEUCHT.achtung, '−'))}</Liste>}
      </Karte>

      <Karte i={5}>
        <Ueberschrift rechts={`${eurC(k.entnahmen)} · ${g.entnahmen.length} Auszahlungen`}>Entnahmen</Ueberschrift>
        <Liste>{g.entnahmen.map(p => posten(p, C.inkDim, '−'))}</Liste>
      </Karte>

      {/* 24.09.: Die „Verbindlichkeiten“ hier waren Malins PRIVATE Schulden (p.sch)
          und standen auf einer Business-Seite. Sie leben jetzt unter Zahlen → Privat. */}

      <Karte i={7}>
        <Ueberschrift farbe={LEUCHT.achtung} rechts={`${eurC(k.fixkostenMonatBrutto)} pro Monat brutto`}>Laufende Fixkosten</Ueberschrift>
        <Liste>
          {g.fixkosten.map(f => (
            <Zeile key={f.id} titel={f.name} unter={f.kategorie} rechts={<span style={{ ...geld, color: LEUCHT.achtung }}>{eurC(f.brutto)}</span>} />
          ))}
          {!g.fixkosten.length && <Leer>Keine laufenden Fixkosten im Dashboard erfasst.</Leer>}
        </Liste>
      </Karte>

      {!!g.ugRechnungen.length && (
        <Karte i={8}>
          <Ueberschrift rechts={`${g.ugRechnungen.length} Belege`}>KD Management UG — Eingangsrechnungen</Ueberschrift>
          <Liste>
            {g.ugRechnungen.map(r => (
              <Zeile key={r.id} links={<span style={tag}>{datum(r.datum)}</span>} titel={r.lieferant} unter={r.zweck}
                rechts={<>
                  <Chip farbe={r.status === 'bezahlt' ? LEUCHT.gut : LEUCHT.achtung}>{r.status}</Chip>
                  <span style={{ ...geld, color: C.inkDim }}>{eurC(r.brutto)}</span>
                </>} />
            ))}
          </Liste>
        </Karte>
      )}

      {!!g.offen.length && (
        <Karte i={9}>
          <Ueberschrift farbe={LEUCHT.achtung} rechts="im Dashboard nachtragen">Ohne Typ — bitte einordnen</Ueberschrift>
          <Liste>{g.offen.map(p => posten(p, C.inkLeise, ''))}</Liste>
        </Karte>
      )}

      <Karte i={10}>
        <Ueberschrift>Konfiguration aus dem Dashboard</Ueberschrift>
        <Liste>
          {[
            ['Malins Bruttogehalt', `${eurC(g.konfiguration.malinBruttoMonat)} / Monat`],
            ['AG-Sozialabgaben darauf', `${g.konfiguration.agSatzProzent} %`],
            ['Sonstige Fixkosten Betrieb', `${eurC(g.konfiguration.fixkostenBetriebMonat)} / Monat`],
            ['Kevins KV + PV (selbstständig)', `${eurC(g.konfiguration.kvPvKevinMonat)} / Monat`],
            ['Gewerbesteuer-Hebesatz Berlin', `${g.konfiguration.gewerbesteuerHebesatz} %`],
          ].map(([a, b]) => (
            <Zeile key={a} titel={a} rechts={<span style={{ ...geld, fontWeight: 600, fontSize: 14, color: b.startsWith('0,00') ? LEUCHT.achtung : C.ink }}>{b}</span>} />
          ))}
        </Liste>
        <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 14, lineHeight: 1.6 }}>
          Neuer Stand aus dem Dashboard? Export dort ziehen und an <span style={{ fontFamily: SCHRIFT.mono, color: C.inkDim }}>/api/state/grundlage</span> schicken —
          die Ableitung rechnet sich neu, das Original bleibt unverändert liegen.
        </div>
      </Karte>
    </Seite>
  );
}
