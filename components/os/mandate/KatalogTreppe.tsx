'use client';

// ─── Produkte · der Katalog als Treppe (P2, 19.10. — PRODUKTE_KONZEPT.md „Oberfläche“) ───────────────────────────────────────────────
// EINE Ansicht statt Treppe + Liste: die Karten nach Stufen — von links (Einstieg) nach rechts (Ziel), Alternativen übereinander; am Handy
// untereinander. Je Kachel Name, Preis (alle Preis-Teile), Kunden jetzt und Plätze; Antippen öffnet die Karte. Gespeicherte Stufen ohne Produkt
// stehen gestrichelt an ihrer Stelle mit „Als Produkt anlegen“. Unter den Stufen läuft der Faden (Markenzeichen, DESIGN_STANDARD.md › Flow):
// hell bis zur höchsten Stufe mit Kunden, dahinter gedämpft. Gerechnet wird nichts hier — die Ansicht kommt aus lib/crm/produkt-katalog.ts.

import { FARBE as C, SCHRIFT, TYP, TIEF, ECKE, RAND } from '@/lib/make-one/design';
import { Chip, Knopf, SymbolKnopf, FlowLinie, LEUCHT, useHandy } from '../ui';
import { FLOW_TON } from '../ui/reise/formen';
import { belegungText, treppenFaden, type KatalogAnsicht, type KatalogKachel, type TreppenBalken } from '@/lib/crm/produkt-katalog';
import { farbeVonEbene } from './treppe/bausteine';

const beschriftung = { fontSize: TYP.mikro, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' as const } as const;

export interface KatalogTreppeProps {
  ansicht: KatalogAnsicht;
  /** Eine Kachel antippen → die Karte des Produkts. */
  onOeffnen: (leistungId: string) => void;
  /** „+ Stufe“ am Ende → geführtes Anlegen mit dieser Ebene. */
  onNeu?: (ebene: number) => void;
  /** Gespeicherte Stufe ohne Produkt → Karte anlegen und verknüpfen (nur auf Klick). */
  onAusStufe?: (stufeId: string) => unknown;
  /** Gespeicherte Stufe ohne Produkt entfernen (mit Rückfrage beim Aufrufer). */
  onStufeWeg?: (stufeId: string) => void;
  /** Höchste Ebene, die „+ Stufe“ anbieten darf. */
  maxEbene?: number;
}

/** Die Fäden aus dem Bild messen: je Stufe ihr Balken (quer am Rechner, senkrecht am Handy). */
function messen(eltern: HTMLElement, leinwand: DOMRect) {
  const els = Array.from(eltern.querySelectorAll<HTMLElement>('[data-pk-balken]'));
  if (els.length < 2) return [];
  const r0 = els[0].getBoundingClientRect();
  const senkrecht = r0.height > r0.width;
  const balken: TreppenBalken[] = els.map(el => {
    const r = el.getBoundingClientRect();
    const x = r.left - leinwand.left, y = r.top - leinwand.top;
    return senkrecht
      ? { a0: y, a1: y + r.height, q: x + r.width / 2, farbe: el.dataset.farbe ?? C.aktiv, kunden: Number(el.dataset.kunden ?? 0), ueber: el.dataset.ueber === '1' }
      : { a0: x, a1: x + r.width, q: y + r.height / 2, farbe: el.dataset.farbe ?? C.aktiv, kunden: Number(el.dataset.kunden ?? 0), ueber: el.dataset.ueber === '1' };
  });
  const f = treppenFaden(balken, senkrecht ? 'senkrecht' : 'quer', { basis: FLOW_TON.basis, rot: FLOW_TON.rot });
  return f ? [f] : [];
}

export function KatalogTreppe({ ansicht, onOeffnen, onNeu, onAusStufe, onStufeWeg, maxEbene = 12 }: KatalogTreppeProps) {
  const handy = useHandy();
  const ebenen = ansicht.ebenen;
  const naechste = (ebenen[ebenen.length - 1]?.ebene ?? 0) + 1;
  return (
    <div className="pk-treppe-rahmen">
      <div className="pk-treppe" role="group" aria-label="Die Leistungstreppe — von links (Einstieg) nach rechts (Ziel)">
        {ebenen.map((e, i) => {
          const f = farbeVonEbene(e.ebene);
          const kunden = e.kacheln.reduce((a, k) => a + k.kunden, 0);
          const ueber = e.kacheln.some(k => k.plaetze?.ueber);
          return (
            <div key={e.ebene} className="pk-stufe" style={{ marginBottom: handy ? 0 : i * 22 }}>
              <span style={{ ...beschriftung, color: f }}>Stufe {e.ebene}{e.kacheln.length > 1 ? ' · Alternativen' : ''}</span>
              {e.kacheln.map(k => (k.ohneProdukt
                ? <StufeOhneProdukt key={k.stufeId} k={k} farbe={f} onAusStufe={onAusStufe} onStufeWeg={onStufeWeg} />
                : <Kachel key={k.stufeId} k={k} farbe={f} onOeffnen={onOeffnen} />))}
              <span aria-hidden data-pk-balken="" data-farbe={f} data-kunden={kunden} data-ueber={ueber ? '1' : '0'} className="pk-balken" style={{ background: f }} />
            </div>
          );
        })}
        {onNeu && naechste <= maxEbene && (
          <div className="pk-stufe" style={{ marginBottom: handy ? 0 : ebenen.length * 22 }}>
            <span style={{ ...beschriftung, color: C.inkLeise }}>Stufe {naechste}</span>
            <button type="button" className="fassbar" onClick={() => onNeu(naechste)}
              style={{ minHeight: 64, padding: '12px 14px', borderRadius: ECKE.knopf, border: RAND.leer, background: 'transparent', color: C.inkDim, fontFamily: SCHRIFT.text, fontSize: TYP.bedien, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              + Produkt auf Stufe {naechste}
            </button>
          </div>
        )}
        <FlowLinie messen={messen} />
      </div>
    </div>
  );
}

function Kachel({ k, farbe, onOeffnen }: { k: KatalogKachel; farbe: string; onOeffnen: (id: string) => void }) {
  const belegFarbe = k.plaetze?.ueber ? LEUCHT.kritisch : k.plaetze?.voll ? LEUCHT.achtung : k.kunden ? farbe : C.inkLeise;
  return (
    <button type="button" className="fassbar pk-kachel" onClick={() => k.leistungId && onOeffnen(k.leistungId)} aria-label={`${k.name} öffnen — ${k.preisText}, ${belegungText(k)}`}
      style={{ textAlign: 'left', minHeight: 44, padding: '12px 14px', borderRadius: ECKE.knopf, cursor: 'pointer', fontFamily: SCHRIFT.text, color: C.ink,
        background: TIEF.flaeche(farbe), border: `1px solid ${TIEF.rand(farbe)}`, display: 'grid', gap: 4, width: '100%', minWidth: 0 }}>
      <span style={{ fontSize: TYP.body, fontWeight: 700, lineHeight: 1.3, overflowWrap: 'break-word', hyphens: 'auto' }}>{k.name}</span>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim, lineHeight: 1.4 }}>{k.preisText}</span>
      <span style={{ fontSize: TYP.bedien, color: belegFarbe }}>{belegungText(k)}</span>
      {(k.status === 'entwurf' || k.rolle !== 'haupt' || (k.status === 'aktiv' && k.textFehlt)) && (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {k.status === 'entwurf' && <Chip farbe={LEUCHT.achtung}>Entwurf</Chip>}
          {k.rolle === 'zusatz' && <Chip farbe={LEUCHT.planung}>Zusatzmodul</Chip>}
          {k.rolle === 'beides' && <Chip farbe={LEUCHT.planung}>auch als Zusatz</Chip>}
          {k.status === 'aktiv' && k.textFehlt && <Chip farbe={LEUCHT.achtung}>Text fehlt</Chip>}
        </span>
      )}
    </button>
  );
}

function StufeOhneProdukt({ k, farbe, onAusStufe, onStufeWeg }: { k: KatalogKachel; farbe: string; onAusStufe?: (id: string) => unknown; onStufeWeg?: (id: string) => void }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: ECKE.knopf, border: RAND.leer, display: 'grid', gap: 6, minWidth: 0 }}>
      <span style={{ display: 'flex', gap: 6, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: TYP.body, fontWeight: 700, lineHeight: 1.3, color: C.inkDim, minWidth: 0, overflowWrap: 'break-word', hyphens: 'auto' }}>{k.name}</span>
        {onStufeWeg && k.stufeId && <SymbolKnopf ariaLabel={`Stufe „${k.name}“ entfernen`} onClick={() => onStufeWeg(k.stufeId!)}>×</SymbolKnopf>}
      </span>
      <span style={{ fontSize: TYP.bedien, color: C.inkDim }}>{k.preisText} · {belegungText(k)}</span>
      <span style={{ fontSize: TYP.bedien, color: C.inkLeise }}>Stufe ohne Produkt — Preis, Text und Ablauf gehören an ein Produkt.</span>
      {onAusStufe && k.stufeId && <Knopf leise farbe={farbe} onClick={() => onAusStufe(k.stufeId!)}>Als Produkt anlegen</Knopf>}
    </div>
  );
}
