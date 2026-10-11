'use client';

// ─── Markttraktion · Planung — der Kreislauf (10.10.) ────────────────────────────────────────────────────────────
// Kevin: „Basis ist unser Sales-Kreislauf: man klickt auf die einzelnen Bereiche … Leadkanäle → Qualifizierung je Leadkanal → Abschluss und
// Follow-up → Fulfillment (über Produkte und Kunden) → zu Ende, Upselling, Cross-Selling, Bewertung, Testimonial, Newsletter → wieder
// verkaufen — der Kunde bleibt immer in diesem Kreis mit unseren Produkten.“ Ein ruhiger Ring (Rechner) bzw. eine Liste (Handy); jede
// Stufe zeigt ihre Zahl, Plan gegen Ist der Umwandlung („Annahme“, solange nichts geplant ist) und führt in die VORHANDENE Ansicht.
// Gerechnet wird nichts hier — alles kommt aus lib/crm/planung.ts `kreislauf`.
// 11.10. (Kevin: „über die Visualisierungen verstehen“): jede Zahl im Ring trägt ihr Wort („offen“, „fällig“ …), der Kanal-Filter ist ein
// Auswahl-Chip im Kopf der Karte statt einer dritten Pillenreihe, und die gewählte Stufe zeigt Plan und Ist als zwei Kacheln nebeneinander.

import { useState, type ReactNode } from 'react';
import { FARBE as C, SCHRIFT, TYP, TIEF, FLAECHE_STIL, ECKE } from '@/lib/make-one/design';
import { Karte, Ueberschrift, Beschriftung, Knopf, Zeile, Liste, Chip, Hinweis, Leer, LEUCHT, useHandy } from '../../ui';
import { WELT_FARBE } from '../Ueberblick';
import type { KreislaufId, KreislaufStufe, NachLeistungZeile } from '@/lib/crm/planung';
import type { PlanungApi, PlanungLage } from './daten';

const KURZ: Record<KreislaufId, [string, string?]> = {
  kanaele: ['Leadkanäle'], leads: ['Leads &', 'Qualifizierung'], deals: ['Deals'], followup: ['Abschluss &', 'Follow-up'],
  fulfillment: ['Fulfillment'], nachher: ['Nach der', 'Leistung'], wiederkauf: ['Wiederkauf'],
};
/** Was die Zahl einer Stufe zählt — ein Wort unter der Zahl im Ring (lib/crm/planung.ts `KreislaufStufe.anzahl`). */
export const KREISLAUF_EINHEIT: Record<KreislaufId, string> = {
  kanaele: 'aktiv', leads: 'in Arbeit', deals: 'offen', followup: 'fällig', fulfillment: 'aktiv', nachher: 'Kunden offen', wiederkauf: 'Kunden',
};
/** Farbe je Stufe: Marketing (Kanäle, Leads), Sales (Deals, Follow-up), Kunde (Fulfillment, danach), Wiederkauf = zurück in den Kreis. */
const farbeVon = (id: KreislaufId): string =>
  id === 'kanaele' || id === 'leads' ? WELT_FARBE.marketing : id === 'deals' || id === 'followup' ? WELT_FARBE.sales : id === 'wiederkauf' ? C.aktiv : LEUCHT.gut;

function Ring({ stufen, aktiv, onWahl }: { stufen: KreislaufStufe[]; aktiv: KreislaufId; onWahl: (id: KreislaufId) => void }) {
  const G = 560, M = G / 2, R = 200, r = 62;
  const pos = (i: number) => { const w = -Math.PI / 2 + (2 * Math.PI * i) / stufen.length; return { x: M + R * Math.cos(w), y: M + R * Math.sin(w), w }; };
  return (
    <svg viewBox={`0 0 ${G} ${G}`} role="group" aria-label="Der Kreislauf der Markttraktion" style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }}>
      <circle cx={M} cy={M} r={R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth={2} strokeDasharray="4 7" />
      {/* Pfeile auf dem Ring zwischen den Stufen — im Uhrzeigersinn. */}
      {stufen.map((_, i) => {
        const w = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / stufen.length;
        const x = M + R * Math.cos(w), y = M + R * Math.sin(w), grad = (w * 180) / Math.PI + 90;
        return <path key={`p${i}`} d="M -6 -5 L 3 0 L -6 5" transform={`translate(${x} ${y}) rotate(${grad - 90})`} fill="none" stroke={C.inkLeise} strokeWidth={2} strokeLinecap="round" />;
      })}
      <text x={M} y={M - 8} textAnchor="middle" fill={C.inkDim} fontSize={TYP.bedien} fontFamily={SCHRIFT.text}>Der Kunde bleibt</text>
      <text x={M} y={M + 12} textAnchor="middle" fill={C.inkDim} fontSize={TYP.bedien} fontFamily={SCHRIFT.text}>im Kreis</text>
      {stufen.map((s, i) => {
        const p = pos(i), f = farbeVon(s.id), an = s.id === aktiv, [z1, z2] = KURZ[s.id];
        // Zeilen von oben: Name (eine oder zwei Zeilen) · Zahl · Wort zur Zahl — alles innerhalb des Kreises (r = 62).
        const y0 = z2 ? -24 : -14;
        return (
          <g key={s.id} role="button" tabIndex={0} aria-pressed={an} aria-label={`${s.label}: ${s.anzahl} ${KREISLAUF_EINHEIT[s.id]}`} style={{ cursor: 'pointer', outline: 'none' }}
            onClick={() => onWahl(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWahl(s.id); } }}>
            <circle cx={p.x} cy={p.y} r={r} fill={an ? `${f}33` : C.flaeche} stroke={an ? f : TIEF.rand(f)} strokeWidth={an ? 2.5 : 1.5} />
            <text x={p.x} y={p.y + y0} textAnchor="middle" fill={C.ink} fontSize={TYP.bedien} fontWeight={600} fontFamily={SCHRIFT.text}>{z1}</text>
            {z2 && <text x={p.x} y={p.y + y0 + 16} textAnchor="middle" fill={C.ink} fontSize={TYP.bedien} fontWeight={600} fontFamily={SCHRIFT.text}>{z2}</text>}
            <text x={p.x} y={p.y + (z2 ? 20 : 12)} textAnchor="middle" fill={f} fontSize={TYP.titel} fontWeight={700} fontFamily={SCHRIFT.display}>{s.anzahl.toLocaleString('de-DE')}</text>
            <text x={p.x} y={p.y + (z2 ? 38 : 30)} textAnchor="middle" fill={C.inkDim} fontSize={TYP.bedien} fontFamily={SCHRIFT.text}>{KREISLAUF_EINHEIT[s.id]}</text>
          </g>
        );
      })}
    </svg>
  );
}

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
  const handy = useHandy();
  const [aktiv, setAktiv] = useState<KreislaufId>('kanaele');
  const k = lage.kreislauf;
  const s = k.stufen.find(x => x.id === aktiv) ?? k.stufen[0];
  const f = farbeVon(s.id);
  const oeffnen = s.id === 'kanaele' ? <Knopf onClick={zuKanaele}>{s.hrefLabel}</Knopf> : s.href ? <Knopf href={s.href}>{s.hrefLabel}</Knopf> : null;
  return (
    <>
      <Karte i={0}>
        <Ueberschrift rechts={kanalWahl}>Der Kreislauf</Ueberschrift>
        <div style={{ fontSize: TYP.bedien, color: C.inkDim, margin: '-4px 0 8px' }}>Eine Stufe antippen — darunter stehen Plan und Ist und der Weg in die Liste.</div>
        {handy ? (
          <Liste>
            {k.stufen.map(x => <Zeile key={x.id} aktiv={x.id === aktiv} onClick={() => setAktiv(x.id)} titel={x.label} unter={x.zusatz}
              links={<span aria-hidden style={{ width: 12, height: 12, borderRadius: 99, background: farbeVon(x.id), display: 'inline-block' }} />}
              rechts={<span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}><b style={{ color: farbeVon(x.id), fontSize: TYP.body }}>{x.anzahl.toLocaleString('de-DE')}</b><span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{KREISLAUF_EINHEIT[x.id]}</span></span>} />)}
          </Liste>
        ) : <Ring stufen={k.stufen} aktiv={aktiv} onWahl={setAktiv} />}
      </Karte>
      <Karte i={1} ton={f}>
        <Ueberschrift rechts={oeffnen}>{s.label}</Ueberschrift>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'baseline', fontSize: TYP.body }}>
          <b style={{ fontSize: TYP.zahl, fontFamily: SCHRIFT.display, color: f }}>{s.anzahl.toLocaleString('de-DE')}</b>
          <span style={{ color: C.ink, fontWeight: 600 }}>{KREISLAUF_EINHEIT[s.id]}</span>
          {/* Bei den Leadkanälen sagt der Zusatz dasselbe wie „Plan“ — dann nur einmal. */}
          {!(s.id === 'kanaele' && s.plan) && <span style={{ color: C.inkDim }}>· {s.zusatz}</span>}
        </div>
        {(s.plan || s.ist) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10, marginTop: 12 }}>
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
            {k.wiederkauf.kunden} Kunden · {k.wiederkauf.wiederkaeufer} haben wieder gekauft · {k.wiederkauf.offen} offene Deals mit Bestandskunden.
            {' '}Nach der Leistung zählen Upselling und Cross-Selling — sie führen zurück in die Deals.
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
