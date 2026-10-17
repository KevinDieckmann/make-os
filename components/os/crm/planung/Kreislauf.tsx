'use client';

// ─── Markttraktion · Planung — der Kreislauf (10.10.) ────────────────────────────────────────────────────────────
// Kevin: „Basis ist unser Sales-Kreislauf: man klickt auf die einzelnen Bereiche … Leadkanäle → Qualifizierung je Leadkanal → Abschluss und
// Follow-up → Fulfillment (über Produkte und Kunden) → zu Ende, Upselling, Cross-Selling, Bewertung, Testimonial, Newsletter → wieder
// verkaufen — der Kunde bleibt immer in diesem Kreis mit unseren Produkten.“ Ein ruhiger Ring (Rechner) bzw. eine Liste (Handy); jede
// Stufe zeigt ihre Zahl, Plan gegen Ist der Umwandlung („Annahme“, solange nichts geplant ist) und führt in die VORHANDENE Ansicht.
// Gerechnet wird nichts hier — alles kommt aus lib/crm/planung.ts `kreislauf`.
// 11.10. (Kevin: „über die Visualisierungen verstehen“): jede Zahl im Ring trägt ihr Wort („offen“, „fällig“ …), der Kanal-Filter ist ein
// Auswahl-Chip im Kopf der Karte statt einer dritten Pillenreihe, und die gewählte Stufe zeigt Plan und Ist als zwei Kacheln nebeneinander.
// 17.10. (Kevin: „Markttraktion-Kreislauf, Onboarding und Planung bekommen dieselbe Reise- und Ablauf-Darstellung“): statt des Rings die Reise als EINE
// Zeile (components/os/ui/reise `ReiseBild` — derselbe Baustein wie im Fulfillment): je Stufe ihre Zahl mit Wort und die kurzen Sätze als Kästchen, das Band
// „Kunde“ gestrichelt bis zur Stufe Fulfillment, ab da durchgezogen (lib/crm/kreislauf-bild.ts). Ein Tipp auf eine Stufe zeigt darunter ihre Liste
// (Plan/Ist, Produkte, Kunden) und den Weg in ihre Ansicht — jede Zahl steht nur einmal (die Zahl in der Reise, Plan/Ist in der Stufe). Am Handy senkrecht.

import { useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF, FLAECHE_STIL, ECKE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Beschriftung, Knopf, Zeile, Liste, Chip, Hinweis, Leer, LEUCHT } from '../../ui';
import { ReiseBild } from '../../ui/reise/ReiseBild';
import { WELT_FARBE } from '../Ueberblick';
import { kreislaufSpalten } from '@/lib/crm/kreislauf-bild';
import type { KreislaufId, NachLeistungZeile } from '@/lib/crm/planung';
import type { PlanungApi, PlanungLage } from './daten';
/** Was die Zahl einer Stufe zählt — das Wort hinter der Zahl im ersten Kästchen der Reise (lib/crm/planung.ts `KreislaufStufe.anzahl`). */
export const KREISLAUF_EINHEIT: Record<KreislaufId, string> = {
  kanaele: 'aktiv', leads: 'in Arbeit', deals: 'offen', followup: 'fällig', fulfillment: 'aktiv', nachher: 'Kunden offen', wiederkauf: 'Kunden',
};
/** Farbe je Stufe: Marketing (Kanäle, Leads), Sales (Deals, Follow-up), Kunde (Fulfillment, danach), Wiederkauf = zurück in den Kreis. */
const farbeVon = (id: KreislaufId): string =>
  id === 'kanaele' || id === 'leads' ? WELT_FARBE.marketing : id === 'deals' || id === 'followup' ? WELT_FARBE.sales : id === 'wiederkauf' ? C.aktiv : LEUCHT.gut;

function Schritte({ k, schreibe }: { k: NachLeistungZeile; schreibe: PlanungApi['schreibe'] }) {
  const nachher = k.status === 'beendet';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {k.schritte.map(s => {
        const gesperrt = s.quelle === 'abgeleitet' || (s.id === 'ende' && !nachher);
        const f = s.erledigt ? LEUCHT.gut : C.inkLeise;
        const titel = s.quelle === 'abgeleitet' ? `Aus den Daten: ${s.grund ?? ''}` : s.quelle === 'hand' ? `Abgehakt am ${s.am} — antippen nimmt es zurück` : s.id === 'ende' && !nachher ? 'Erst, wenn die Leistung beendet ist (Mandat › Status)' : 'Antippen hakt ab';
        return (
          <button key={s.id} type="button" disabled={gesperrt} title={titel} aria-pressed={s.erledigt}
            onClick={() => { void schreibe([{ op: 'schritt', mandatId: k.mandatId, schritt: s.id, erledigt: !s.erledigt }]); }}
            className="fassbar" style={{ minHeight: 40, padding: '6px 12px', borderRadius: 999, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, cursor: gesperrt ? 'default' : 'pointer',
              background: s.erledigt ? `${f}22` : 'transparent', color: s.erledigt ? f : C.inkDim, border: `1px ${s.erledigt ? 'solid' : 'dashed'} ${s.erledigt ? TIEF.rand(f) : 'rgba(255,255,255,.18)'}`, opacity: gesperrt && !s.erledigt ? 0.55 : 1 }}>
            {s.erledigt ? '✓ ' : ''}{s.label}
          </button>
        );
      })}
    </div>
  );
}

/** Plan oder Ist einer Stufe als flache Kachel (Beschriftung + Satz) — nebeneinander, damit man sie vergleicht. */
function PlanIst({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div style={{ ...FLAECHE_STIL.flach, borderRadius: ECKE.flach, padding: '12px 14px', minWidth: 0 }}>
      <Beschriftung>{titel}</Beschriftung>
      <div style={{ fontSize: TYP.body, fontWeight: 600, color: C.ink, lineHeight: 1.4 }}>{children}</div>
    </div>
  );
}

/** `kanalWahl` (11.10.): der Filter auf einen Leadkanal als Auswahl-Chip im Kopf der Karte (kommt von der Seite, components/os/crm/planung/Planung.tsx). */
export function Kreislauf({ api, lage, zuKanaele, kanalWahl }: { api: PlanungApi; lage: PlanungLage; zuKanaele: () => void; kanalWahl?: ReactNode }) {
  const [aktiv, setAktiv] = useState<KreislaufId>('kanaele');
  const k = lage.kreislauf;
  const s = k.stufen.find(x => x.id === aktiv) ?? k.stufen[0];
  const f = farbeVon(s.id);
  const oeffnen = s.id === 'kanaele' ? <Knopf onClick={zuKanaele}>{s.hrefLabel}</Knopf> : s.href ? <Knopf href={s.href}>{s.hrefLabel}</Knopf> : null;
  const spalten = kreislaufSpalten(k, KREISLAUF_EINHEIT, farbeVon);
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={kanalWahl}>Der Kreislauf</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '-4px 0 10px' }}>Eine Stufe antippen, um Plan, Ist und den Weg in die Liste zu sehen.</div>
        {/* Die Reise (17.10.): dieselbe Zeile wie im Fulfillment — der Kunde bleibt im Kreis, der Wiederkauf führt zurück in die Deals. */}
        <ReiseBild spalten={spalten} wort="Stufe" mehrWort="Angaben" label="Der Kreislauf der Markttraktion" aktiv={s.id} onPhase={id => setAktiv(id as KreislaufId)} onKaestchen={id => setAktiv(id as KreislaufId)}
          ende={<button type="button" className="fassbar" onClick={() => setAktiv('deals')} aria-label="Zurück in den Kreis: der Wiederkauf führt in die Deals"
            style={{ minHeight: 44, padding: '0 10px', background: 'none', border: `1px dashed ${TIEF.rand(C.aktiv)}`, borderRadius: 999, color: C.inkDim, fontSize: TYP.bedien, cursor: 'pointer', whiteSpace: 'nowrap' }}>↺ in die Deals</button>} />
      </Karte>
      <Karte i={1} ton={f}>
        <Ueberschrift rechts={oeffnen}>{s.label}</Ueberschrift>
        {/* Die Zahl und die Sätze der Stufe stehen oben in der Reise — hier nur, was dort nicht steht: Plan und Ist, die Liste, der Weg in die Ansicht. */}
        {(s.plan || s.ist) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
            {s.plan && <PlanIst titel={s.annahme ? 'Plan (Annahme)' : 'Plan'}>{s.plan}</PlanIst>}
            {s.ist && <PlanIst titel="Ist">{s.ist}</PlanIst>}
          </div>
        )}
        {s.annahme && <div style={{ marginTop: 10 }}><Hinweis>Die Plan-Quote ist eine Annahme (Pipeline-Wahrscheinlichkeiten bzw. Startwerte) — unter „Leadkanäle“ je Kanal planen oder den gemessenen Wert übernehmen.</Hinweis></div>}
        {s.id === 'fulfillment' && (
          <div style={{ marginTop: 12 }}>
            {k.fulfillment.length ? <Liste>{k.fulfillment.map(x => <Zeile key={`${x.produktId}|${x.phase}`} titel={x.produkt} unter={x.phase ? `Phase: ${x.phase}` : 'ohne Phase'} rechts={<Knopf leise href={x.href}>{x.anzahl}</Knopf>} />)}</Liste>
              : <Leer>Kein aktives Mandat — Fulfillment beginnt mit dem ersten gewonnenen Deal (Produkte & Mandate).</Leer>}
          </div>
        )}
        {s.id === 'wiederkauf' && (
          <div style={{ marginTop: 12, fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.5 }}>
            {k.wiederkauf.kunden} Kunden insgesamt. Nach der Leistung zählen Upselling und Cross-Selling — sie führen zurück in die Deals.
          </div>
        )}
      </Karte>
      {(s.id === 'nachher' || s.id === 'fulfillment') && (
        <Karte i={2}>
          <Ueberschrift rechts={<Chip farbe={LEUCHT.gut}>{k.kunden.filter(x => x.offen > 0).length} mit offenen Schritten</Chip>}>Nach der Leistung — je Kunde</Ueberschrift>
          <div style={{ fontSize: TYP.bedien, color: C.inkDim, marginBottom: 10, lineHeight: 1.5 }}>
            Am besten schon während des Fulfillments: Newsletter, Bewertung und Testimonial anstoßen, Upselling und Cross-Selling vorbereiten. Was die Daten
            schon sagen (beendet, neuer Deal, Newsletter-Einwilligung), ist abgehakt; den Rest hakt ihr von Hand ab.
          </div>
          {k.kunden.length ? (
            <Liste>
              {k.kunden.map(x => (
                <div key={x.mandatId} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.06)', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <span style={{ fontSize: TYP.body, fontWeight: 600 }}>{x.kunde}<span style={{ color: C.inkDim, fontWeight: 400 }}> · {x.titel}{x.produkt ? ` · ${x.produkt}` : ''}{x.phase ? ` (${x.phase})` : ''}</span></span>
                    <Knopf leise href={x.href}>{x.status === 'beendet' ? 'beendet' : 'aktiv'} ›</Knopf>
                  </div>
                  {/* Fortschritt im Paket (10.10., Leistungstreppe unter Produkte & Mandate) — nur, wenn eine Treppe gepflegt ist. */}
                  {(x.paket || x.naechsteStufe) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {x.paket && <Chip farbe={LEUCHT.business}>Paket: {x.paket}{x.lieferungen ? ` · ${x.lieferungen} geliefert` : ''}</Chip>}
                      {x.naechsteStufe && <Chip farbe={LEUCHT.gut}>reif für: {x.naechsteStufe}</Chip>}
                    </div>
                  )}
                  <Schritte k={x} schreibe={api.schreibe} />
                </div>
              ))}
            </Liste>
          ) : <Leer>Noch keine Kunden im Fulfillment oder im letzten Jahr beendet.</Leer>}
        </Karte>
      )}
    </>
  );
}
