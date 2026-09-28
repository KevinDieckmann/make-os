'use client';

// ─── Markttraktion · BEAN-Kundengruppe in der Oberfläche (28.09., Paket H4) ──
// B Bestandskunde · E Ehemalig · A Angebotskunde · N Neu — Logik rein in
// lib/crm/bean.ts. Hier: der Wahl-Chip (abgeleitet sichtbar, „von Hand“
// markiert, „– zurück auf automatisch“), das Kurz-Badge für Listen, die
// Verteilungskarte für den Überblick (Klick filtert die Kartei) und der Hook
// für die offenen Angebote aus der Dateiablage.
// Die Ablage liest nur die Oberfläche (/api/crm/dateien, Haushalt des
// Inhabers; sonst 403 → ohne Ablage gerechnet) — nie ein Agent, nie ein Export.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FARBE as C, TYP } from '@/lib/make-one/design';
import { LEUCHT, Karte, Ueberschrift } from '../schlank';
import { BEAN_IDS, BEAN_LABEL, BEAN_HINWEIS, BEAN_WAHL, offeneAngebote, type AngebotHinweis, type BeanErgebnis, type BeanId } from '@/lib/crm/bean';
import { karteiBean } from '@/lib/crm/adresse';
import { Wahl } from './Wahl';

/** Farbe je Gruppe: Bestand grün, Angebot Geld, Ehemalige violett, Neue orange (Vertrieb). */
export const BEAN_FARBE: Record<BeanId, string> = { B: LEUCHT.gut, E: LEUCHT.agenten, A: LEUCHT.geld, N: LEUCHT.business };

// ── Offene Angebote aus der Dateiablage ──────────────────────────────────────
// Einmal je Minute für alle Stellen der Seite (Kopf, Kartei, Leads, Überblick).
let zwischen: { zeit: number; wert: Promise<AngebotHinweis[]> } | null = null;
const HALTBAR_MS = 60_000;
function ladeAngebote(): Promise<AngebotHinweis[]> {
  if (zwischen && Date.now() - zwischen.zeit < HALTBAR_MS) return zwischen.wert;
  const wert = fetch('/api/crm/dateien', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : { eintraege: [] }))
    .then((x: { eintraege?: Parameters<typeof offeneAngebote>[0] }) => offeneAngebote(x.eintraege ?? []))
    .catch(() => [] as AngebotHinweis[]);
  zwischen = { zeit: Date.now(), wert };
  return wert;
}

/** Offene Angebote (nur Bezüge) — leer, solange nichts geladen ist oder die Ablage nicht zugänglich ist. */
export function useOffeneAngebote(): AngebotHinweis[] {
  const [a, setA] = useState<AngebotHinweis[]>([]);
  useEffect(() => { let an = true; void ladeAngebote().then(x => { if (an) setA(x); }); return () => { an = false; }; }, []);
  return a;
}

// ── Kurz-Badge ───────────────────────────────────────────────────────────────
/** Der Buchstabe als kleines Badge — voll, wenn von Hand, sonst leiser Rand. */
export function BeanBadge({ bean, vonHand, grund }: { bean: BeanId; vonHand?: boolean; grund?: string }) {
  const f = BEAN_FARBE[bean];
  return (
    <span title={`${BEAN_LABEL[bean]}${grund ? ` — ${grund}` : ''}`} aria-label={`BEAN ${BEAN_LABEL[bean]}`}
      style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 6, fontSize: 11, fontWeight: 800, color: f,
        background: vonHand ? `${f}26` : 'transparent', border: `1px ${vonHand ? 'solid' : 'dashed'} ${f}${vonHand ? '88' : '66'}`, flex: '0 0 auto' }}>{bean}</span>
  );
}

// ── Wahl-Chip ────────────────────────────────────────────────────────────────
/**
 * BEAN als Wahl-Chip: gesetzt = voller Chip und „von Hand“; nicht gesetzt = die Ableitung als
 * gestrichelter Chip (Grund im Hinweis) — ein Klick wählt von Hand, „zurück auf automatisch“ leert.
 * `ergebnis` kommt aus beanVon/beanFirma; `wert` ist das Handfeld (Kontakt.bean bzw. Firma.bean).
 */
export function BeanWahl({ wert, ergebnis, onSetze, klein, ohneMarke }: { wert: BeanId | undefined; ergebnis: BeanErgebnis; onSetze: (b: BeanId | undefined) => void; klein?: boolean; ohneMarke?: boolean }) {
  const auto = ergebnis.abgeleitet;
  const marke = wert ? 'von Hand' : ergebnis.vonHand ? 'von der Firma' : 'automatisch';
  const titel = wert
    ? `BEAN von Hand: ${BEAN_LABEL[wert]} — automatisch wäre ${BEAN_LABEL[auto.bean]} (${auto.grund})`
    : `BEAN ${marke}: ${BEAN_LABEL[ergebnis.bean]} — ${ergebnis.grund}`;
  return (
    <span title={titel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
      <Wahl label="BEAN" klein={klein} liste={BEAN_WAHL} wert={wert} farbe={BEAN_FARBE[wert ?? ergebnis.bean]}
        leer={`${ergebnis.bean} · ${BEAN_LABEL[ergebnis.bean]} ▾`}
        onWahl={b => onSetze(b)} onLeeren={wert ? () => onSetze(undefined) : undefined}
        leerenLabel={`zurück auf automatisch (${auto.bean} · ${BEAN_LABEL[auto.bean]})`} />
      {!ohneMarke && <span style={{ fontSize: 11, color: C.inkLeise, whiteSpace: 'nowrap' }}>{marke}</span>}
    </span>
  );
}

// ── Verteilung (Überblick) ───────────────────────────────────────────────────
/** Vier Kacheln B · E · A · N mit Anzahl — ein Klick öffnet die Kartei gefiltert auf die Gruppe. */
export function BeanVerteilungKarte({ je, vonHand, i = 0 }: { je: Record<BeanId, number>; vonHand: number; i?: number }) {
  const gesamt = BEAN_IDS.reduce((s, b) => s + je[b], 0);
  return (
    <Karte i={i}>
      <Ueberschrift rechts={<span>{gesamt} Kontakte{vonHand ? ` · ${vonHand} von Hand` : ''}</span>}>Kundengruppen · BEAN</Ueberschrift>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        {BEAN_IDS.map(b => {
          const f = BEAN_FARBE[b];
          const anteil = gesamt ? Math.round((je[b] / gesamt) * 100) : 0;
          return (
            <Link key={b} href={karteiBean(b)} className="fassbar" title={`${BEAN_LABEL[b]}: ${BEAN_HINWEIS[b]} — in der Kartei zeigen`}
              style={{ display: 'grid', gap: 4, padding: '10px 12px', borderRadius: 12, textDecoration: 'none', color: C.ink, background: `${f}10`, border: `1px solid ${f}33` }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BeanBadge bean={b} vonHand />
                <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{BEAN_LABEL[b]}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <b style={{ fontSize: 22, fontWeight: 700, color: f, fontVariantNumeric: 'tabular-nums' }}>{je[b]}</b>
                <span style={{ fontSize: TYP.mikro, color: C.inkLeise }}>{anteil} %</span>
              </span>
            </Link>
          );
        })}
      </div>
      <div style={{ fontSize: 12, color: C.inkLeise, marginTop: 8, lineHeight: 1.5 }}>Abgeleitet aus Mandaten, Deals und offenen Angeboten — von Hand überschreibbar unter „Kontakt öffnen“. Neu = Leads zum Qualifizieren.</div>
    </Karte>
  );
}
